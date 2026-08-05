import type { DeviceBindingProjectionJson } from '@liiiraa/contracts-ts';
import {
  decideDeviceBinding,
  type ActiveDeviceBinding,
  type DeviceBindingCommand,
  type DeviceBindingDecision,
  type DeviceBindingState,
  type DeviceTransferException,
  type ProtectedDeviceEvidence,
} from '@liiiraa/control-plane-domain';

export interface DeviceEntitlementRecord {
  readonly entitlementId: string;
  readonly accountId: string;
  readonly status: 'active' | 'grace' | 'expired' | 'revoked';
  readonly version: bigint;
}

export interface DeviceBindingRecord extends ActiveDeviceBinding {
  readonly accountId: string;
  readonly entitlementId: string;
  readonly revokedAt: string | null;
  readonly version: bigint;
}

export interface DeviceExceptionRecord extends DeviceTransferException {
  readonly version: bigint;
}

export type DeviceAuthorityResult =
  | Readonly<{
      ok: true;
      outcome: 'applied' | 'no-op' | 'revalidation-required';
      projection: DeviceBindingProjectionJson;
      auditReference: string;
    }>
  | Readonly<{
      ok: false;
      code: 'UNAUTHORIZED' | 'NOT_FOUND' | 'STALE' | 'POLICY_DENIED';
      reason: string;
      projection?: DeviceBindingProjectionJson;
    }>;

export interface DeviceBindingTransaction {
  lockEntitlement(accountId: string): Promise<DeviceEntitlementRecord | null>;
  findCommandResult(commandId: string): Promise<DeviceAuthorityResult | null>;
  getActiveBinding(entitlementId: string): Promise<DeviceBindingRecord | null>;
  getLatestBinding(entitlementId: string): Promise<DeviceBindingRecord | null>;
  lockException(exceptionId: string): Promise<DeviceExceptionRecord | null>;
  insertBinding(record: DeviceBindingRecord): Promise<void>;
  revokeBinding(bindingId: string, revokedAt: string): Promise<void>;
  consumeException(exceptionId: string, consumedAt: string, expectedVersion: bigint): Promise<void>;
  incrementEntitlementVersion(entitlementId: string, expectedVersion: bigint): Promise<bigint>;
  appendAudit(
    input: Readonly<{
      auditReference: string;
      accountId: string;
      eventType: string;
      reason: string;
      aggregateVersion: bigint;
      occurredAt: string;
    }>,
  ): Promise<void>;
  enqueueOutbox(
    input: Readonly<{
      jobId: string;
      topic: 'device-binding.changed';
      entitlementId: string;
      aggregateVersion: bigint;
      bindingId: string;
      outcome: string;
      availableAt: string;
    }>,
  ): Promise<void>;
  rememberCommandResult(commandId: string, result: DeviceAuthorityResult): Promise<void>;
}

export interface DeviceBindingRepository {
  transaction<T>(
    accountId: string,
    operation: (transaction: DeviceBindingTransaction) => Promise<T>,
  ): Promise<T>;
}

export interface DeviceActorAuthorizer {
  authorize(
    input: Readonly<{
      actorAccountId: string;
      accountId: string;
      scope: 'device-bind' | 'device-transfer' | 'device-revoke' | 'device-revalidation';
    }>,
  ): Promise<boolean>;
}

export interface DeviceAuthorityDependencies {
  readonly repository: DeviceBindingRepository;
  readonly authorizer: DeviceActorAuthorizer;
  readonly clock: Readonly<{ now(): Date }>;
  readonly ids: Readonly<{ next(): string }>;
}

export interface BindDeviceInput {
  readonly commandId: string;
  readonly actorAccountId: string;
  readonly accountId: string;
  readonly expectedVersion: bigint;
  readonly bindingId: string;
  readonly deviceDigest: string;
  readonly deviceLabel: string;
  readonly evidence: ProtectedDeviceEvidence;
  readonly confirmedFriendlyIdentity: boolean;
  readonly confirmedOnePcConsequences: boolean;
  readonly correlationId: string;
}

export interface DeviceMutationContext {
  readonly commandId: string;
  readonly actorAccountId: string;
  readonly accountId: string;
  readonly expectedVersion: bigint;
  readonly correlationId: string;
  readonly scope: 'device-bind' | 'device-transfer' | 'device-revoke' | 'device-revalidation';
  readonly createCommand: (
    transaction: DeviceBindingTransaction,
    now: string,
  ) => Promise<DeviceBindingCommand>;
}

const projection = (
  binding: DeviceBindingRecord,
  accountId: string,
  aggregateVersion: bigint,
  correlationId: string,
  state: DeviceBindingProjectionJson['state'] = binding.revokedAt === null ? 'active' : 'revoked',
): DeviceBindingProjectionJson => ({
  schemaVersion: '1.0',
  aggregateVersion: aggregateVersion.toString(),
  etag: `device-${binding.bindingId}-v${aggregateVersion.toString()}`,
  correlationId,
  provenance: 'postgres-authority',
  kind: 'device-binding-projection',
  deviceBindingId: binding.bindingId,
  accountId,
  state,
  deviceLabel: binding.deviceLabel,
  evidenceVersion: String(binding.evidence.keyVersion),
  boundAt: binding.boundAt,
  replacementEligibleAt: binding.replacementEligibleAt,
});

const decisionState = (
  entitlement: DeviceEntitlementRecord,
  activeBinding: DeviceBindingRecord | null,
): DeviceBindingState => ({
  accountId: entitlement.accountId,
  version: entitlement.version,
  premiumActive: entitlement.status === 'active',
  ...(activeBinding ? { activeBinding } : {}),
});

const denied = (
  decision: Extract<DeviceBindingDecision, { outcome: 'denied' | 'cooldown' }>,
  remote: DeviceBindingRecord | null,
  entitlement: DeviceEntitlementRecord,
  correlationId: string,
): DeviceAuthorityResult => ({
  ok: false,
  code: decision.outcome === 'cooldown' ? 'POLICY_DENIED' : 'POLICY_DENIED',
  reason: decision.reason,
  ...(remote
    ? {
        projection: projection(
          remote,
          entitlement.accountId,
          entitlement.version,
          correlationId,
          decision.outcome === 'cooldown' ? 'replacement-cooldown' : undefined,
        ),
      }
    : {}),
});

const applyDecision = async (
  transaction: DeviceBindingTransaction,
  entitlement: DeviceEntitlementRecord,
  activeBinding: DeviceBindingRecord | null,
  decision: DeviceBindingDecision,
  context: DeviceMutationContext,
  now: string,
  dependencies: DeviceAuthorityDependencies,
): Promise<DeviceAuthorityResult> => {
  if (decision.outcome === 'denied' || decision.outcome === 'cooldown') {
    return denied(decision, activeBinding, entitlement, context.correlationId);
  }
  if (decision.outcome === 'retain') {
    if (!activeBinding) return { ok: false, code: 'NOT_FOUND', reason: 'binding-not-found' };
    return {
      ok: true,
      outcome: 'no-op',
      projection: projection(
        activeBinding,
        entitlement.accountId,
        entitlement.version,
        context.correlationId,
      ),
      auditReference: `no-op:${context.commandId}`,
    };
  }
  if (decision.outcome === 'revalidation-required') {
    if (!activeBinding) return { ok: false, code: 'NOT_FOUND', reason: 'binding-not-found' };
    const auditReference = dependencies.ids.next();
    await transaction.appendAudit({
      auditReference,
      accountId: entitlement.accountId,
      eventType: 'device.revalidation-required',
      reason: decision.reasons.join(','),
      aggregateVersion: entitlement.version,
      occurredAt: now,
    });
    return {
      ok: true,
      outcome: 'revalidation-required',
      projection: projection(
        activeBinding,
        entitlement.accountId,
        entitlement.version,
        context.correlationId,
      ),
      auditReference,
    };
  }

  if (decision.outcome === 'revoke' || decision.outcome === 'replace') {
    const bindingId = decision.outcome === 'revoke' ? decision.bindingId : decision.revokeBindingId;
    await transaction.revokeBinding(bindingId, now);
  }
  if (decision.outcome === 'replace' && decision.consumeExceptionId) {
    const exception = await transaction.lockException(decision.consumeExceptionId);
    if (exception?.consumedAt !== null) {
      return { ok: false, code: 'POLICY_DENIED', reason: 'exception-already-consumed' };
    }
    await transaction.consumeException(exception.exceptionId, now, exception.version);
  }

  const bindingValue =
    decision.outcome === 'bind' || decision.outcome === 'replace'
      ? decision.binding
      : activeBinding;
  if (!bindingValue) return { ok: false, code: 'NOT_FOUND', reason: 'binding-not-found' };
  const nextVersion = await transaction.incrementEntitlementVersion(
    entitlement.entitlementId,
    entitlement.version,
  );
  const record: DeviceBindingRecord = {
    ...bindingValue,
    accountId: entitlement.accountId,
    entitlementId: entitlement.entitlementId,
    revokedAt: decision.outcome === 'revoke' ? now : null,
    version:
      decision.outcome === 'bind' || decision.outcome === 'replace'
        ? 1n
        : bindingValue === activeBinding
          ? activeBinding.version + 1n
          : 1n,
  };
  if (decision.outcome === 'bind' || decision.outcome === 'replace') {
    await transaction.insertBinding(record);
  }

  const auditReference = dependencies.ids.next();
  const jobId = dependencies.ids.next();
  await transaction.appendAudit({
    auditReference,
    accountId: entitlement.accountId,
    eventType: `device.${decision.outcome}`,
    reason: decision.reason,
    aggregateVersion: nextVersion,
    occurredAt: now,
  });
  await transaction.enqueueOutbox({
    jobId,
    topic: 'device-binding.changed',
    entitlementId: entitlement.entitlementId,
    aggregateVersion: nextVersion,
    bindingId: record.bindingId,
    outcome: decision.outcome,
    availableAt: now,
  });
  return {
    ok: true,
    outcome: 'applied',
    projection: projection(record, entitlement.accountId, nextVersion, context.correlationId),
    auditReference,
  };
};

export const executeDeviceMutation = async (
  dependencies: DeviceAuthorityDependencies,
  context: DeviceMutationContext,
): Promise<DeviceAuthorityResult> => {
  const authorized = await dependencies.authorizer.authorize({
    actorAccountId: context.actorAccountId,
    accountId: context.accountId,
    scope: context.scope,
  });
  if (!authorized) return { ok: false, code: 'UNAUTHORIZED', reason: 'owner-required' };

  return dependencies.repository.transaction(context.accountId, async (transaction) => {
    const idempotent = await transaction.findCommandResult(context.commandId);
    if (idempotent) return idempotent;
    const entitlement = await transaction.lockEntitlement(context.accountId);
    if (!entitlement) return { ok: false, code: 'NOT_FOUND', reason: 'entitlement-not-found' };
    const activeBinding = await transaction.getActiveBinding(entitlement.entitlementId);
    const latestBinding =
      activeBinding ?? (await transaction.getLatestBinding(entitlement.entitlementId));
    if (entitlement.version !== context.expectedVersion) {
      return {
        ok: false,
        code: 'STALE',
        reason: 'expected-version-mismatch',
        ...(latestBinding
          ? {
              projection: projection(
                latestBinding,
                entitlement.accountId,
                entitlement.version,
                context.correlationId,
              ),
            }
          : {}),
      };
    }
    const now = dependencies.clock.now().toISOString();
    const command = await context.createCommand(transaction, now);
    const decision = decideDeviceBinding(decisionState(entitlement, latestBinding), command);
    const result = await applyDecision(
      transaction,
      entitlement,
      latestBinding,
      decision,
      context,
      now,
      dependencies,
    );
    if (result.ok) await transaction.rememberCommandResult(context.commandId, result);
    return result;
  });
};

export const bindDevice = (
  dependencies: DeviceAuthorityDependencies,
  input: BindDeviceInput,
): Promise<DeviceAuthorityResult> =>
  executeDeviceMutation(dependencies, {
    commandId: input.commandId,
    actorAccountId: input.actorAccountId,
    accountId: input.accountId,
    expectedVersion: input.expectedVersion,
    correlationId: input.correlationId,
    scope: 'device-bind',
    createCommand: (_transaction, now) =>
      Promise.resolve({
        kind: 'bind',
        bindingId: input.bindingId,
        deviceDigest: input.deviceDigest,
        deviceLabel: input.deviceLabel,
        evidence: input.evidence,
        confirmedFriendlyIdentity: input.confirmedFriendlyIdentity,
        confirmedOnePcConsequences: input.confirmedOnePcConsequences,
        now,
      }),
  });
