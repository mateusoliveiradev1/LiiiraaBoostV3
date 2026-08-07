import {
  OFFLINE_ENTITLEMENT_VALIDITY_SECONDS,
  controlPlaneDocumentValidator,
  encodeBase64Url,
  encodeOfflineEntitlementPayload,
  type OfflineEntitlementEnvelopeJson,
} from '@liiiraa/contracts-ts';

import type { EntitlementSigningPort } from '../ports/entitlement-signing.js';

const MAX_IDENTIFIER_LENGTH = 128;

export interface EntitlementSubscriptionRecord {
  readonly accountId: string;
  readonly subscriptionId: string;
  readonly status: 'active' | 'grace' | 'expired' | 'canceled' | 'disputed';
  readonly checkoutStatus: 'pending' | 'reconciled';
  readonly allowNewPremiumActions: boolean;
  readonly version: bigint;
}

export interface EntitlementRecord {
  readonly entitlementId: string;
  readonly accountId: string;
  readonly subscriptionId: string;
  readonly status: 'active' | 'grace' | 'expired' | 'revoked';
  readonly allowNewPremiumActions: boolean;
  readonly version: bigint;
  readonly offlineValidUntil: string | null;
  readonly signingKeyId: string | null;
}

export interface EntitlementDeviceRecord {
  readonly bindingId: string;
  readonly entitlementId: string;
  readonly accountId: string;
  readonly state: 'active' | 'revalidating' | 'revoked';
  readonly version: bigint;
  readonly revokedAt: string | null;
}

export type OfflineEntitlementFailureCode =
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'STALE'
  | 'AUTHORITY_DENIED'
  | 'SIGNING_UNAVAILABLE'
  | 'PERSISTENCE_FAILED';

export type OfflineEntitlementCommandResult =
  | Readonly<{
      ok: true;
      outcome: 'issued' | 'renewed';
      envelope: OfflineEntitlementEnvelopeJson;
      aggregateVersion: string;
      deviceVersion: string;
    }>
  | Readonly<{
      ok: true;
      outcome: 'revoked';
      aggregateVersion: string;
      deviceVersion: string;
    }>
  | Readonly<{
      ok: false;
      code: OfflineEntitlementFailureCode;
      reason: string;
    }>;

export interface EntitlementAuthorityTransaction {
  findCommandResult(commandId: string): Promise<OfflineEntitlementCommandResult | null>;
  lockSubscription(accountId: string): Promise<EntitlementSubscriptionRecord | null>;
  lockEntitlement(accountId: string): Promise<EntitlementRecord | null>;
  lockActiveDevice(entitlementId: string): Promise<EntitlementDeviceRecord | null>;
  persistIssuance(
    input: Readonly<{
      entitlementId: string;
      expectedEntitlementVersion: bigint;
      nextEntitlementVersion: bigint;
      issuedAt: string;
      expiresAt: string;
      keyId: string;
    }>,
  ): Promise<void>;
  revokeEntitlement(
    input: Readonly<{
      entitlementId: string;
      expectedEntitlementVersion: bigint;
      nextEntitlementVersion: bigint;
      revokedAt: string;
    }>,
  ): Promise<void>;
  revokeDevice(bindingId: string, expectedVersion: bigint, revokedAt: string): Promise<void>;
  appendAudit(
    input: Readonly<{
      auditReference: string;
      accountId: string;
      eventType:
        'entitlement.offline-issued' | 'entitlement.offline-renewed' | 'entitlement.revoked';
      aggregateVersion: bigint;
      deviceBinding: string;
      keyId?: string;
      reason: string;
      correlationId: string;
      occurredAt: string;
    }>,
  ): Promise<void>;
  enqueueOutbox(
    input: Readonly<{
      jobId: string;
      topic: 'entitlement.authority-changed';
      entitlementId: string;
      aggregateVersion: bigint;
      deviceBinding: string;
      outcome: 'issued' | 'renewed' | 'revoked';
      availableAt: string;
    }>,
  ): Promise<void>;
  rememberCommandResult(commandId: string, result: OfflineEntitlementCommandResult): Promise<void>;
}

export interface EntitlementAuthorityRepository {
  transaction<T>(
    accountId: string,
    operation: (transaction: EntitlementAuthorityTransaction) => Promise<T>,
  ): Promise<T>;
}

export interface EntitlementActorAuthorizer {
  authorize(
    input: Readonly<{
      actorAccountId: string;
      accountId: string;
      scope: 'entitlement-issue' | 'entitlement-renew' | 'entitlement-revoke';
    }>,
  ): Promise<boolean>;
}

export interface OfflineEntitlementDependencies {
  readonly repository: EntitlementAuthorityRepository;
  readonly signer: EntitlementSigningPort;
  readonly authorizer: EntitlementActorAuthorizer;
  readonly clock: Readonly<{ now(): Date }>;
  readonly ids: Readonly<{ next(): string }>;
}

export interface IssueOfflineEntitlementInput {
  readonly operation: 'issue' | 'renew';
  readonly commandId: string;
  readonly actorAccountId: string;
  readonly accountId: string;
  readonly deviceBinding: string;
  readonly audience: string;
  readonly expectedEntitlementVersion: bigint;
  readonly expectedDeviceVersion: bigint;
  readonly correlationId: string;
}

export interface RevokeOfflineEntitlementInput {
  readonly commandId: string;
  readonly actorAccountId: string;
  readonly accountId: string;
  readonly deviceBinding: string;
  readonly expectedEntitlementVersion: bigint;
  readonly expectedDeviceVersion: bigint;
  readonly correlationId: string;
  readonly reason: 'customer-request' | 'security' | 'commerce';
}

const failure = (
  code: OfflineEntitlementFailureCode,
  reason: string,
): OfflineEntitlementCommandResult => ({ ok: false, code, reason });

const boundedIdentifier = (value: string): boolean =>
  value.length > 0 && value.length <= MAX_IDENTIFIER_LENGTH;

const eligibleAuthority = (
  subscription: EntitlementSubscriptionRecord,
  entitlement: EntitlementRecord,
  device: EntitlementDeviceRecord,
  input: IssueOfflineEntitlementInput,
): boolean =>
  subscription.status === 'active' &&
  subscription.checkoutStatus === 'reconciled' &&
  subscription.allowNewPremiumActions &&
  entitlement.status === 'active' &&
  entitlement.allowNewPremiumActions &&
  entitlement.subscriptionId === subscription.subscriptionId &&
  device.state === 'active' &&
  device.bindingId === input.deviceBinding &&
  device.accountId === input.accountId;

export const issueOfflineEntitlement = async (
  dependencies: OfflineEntitlementDependencies,
  input: IssueOfflineEntitlementInput,
): Promise<OfflineEntitlementCommandResult> => {
  const authorized = await dependencies.authorizer.authorize({
    actorAccountId: input.actorAccountId,
    accountId: input.accountId,
    scope: input.operation === 'issue' ? 'entitlement-issue' : 'entitlement-renew',
  });
  if (!authorized) return failure('UNAUTHORIZED', 'owner-required');
  if (
    !boundedIdentifier(input.commandId) ||
    !boundedIdentifier(input.accountId) ||
    !boundedIdentifier(input.deviceBinding) ||
    !boundedIdentifier(input.audience) ||
    !boundedIdentifier(input.correlationId)
  ) {
    return failure('AUTHORITY_DENIED', 'bounded-identifiers-required');
  }

  try {
    return await dependencies.repository.transaction(input.accountId, async (transaction) => {
      const remembered = await transaction.findCommandResult(input.commandId);
      if (remembered !== null) return remembered;
      const subscription = await transaction.lockSubscription(input.accountId);
      const entitlement = await transaction.lockEntitlement(input.accountId);
      if (subscription === null || entitlement === null) {
        return failure('NOT_FOUND', 'entitlement-authority-not-found');
      }
      const device = await transaction.lockActiveDevice(entitlement.entitlementId);
      if (device === null || !eligibleAuthority(subscription, entitlement, device, input)) {
        return failure('AUTHORITY_DENIED', 'reconciled-active-premium-device-required');
      }
      if (
        entitlement.version !== input.expectedEntitlementVersion ||
        device.version !== input.expectedDeviceVersion
      ) {
        return failure('STALE', 'expected-version-mismatch');
      }
      const nextVersion = entitlement.version + 1n;
      const numericVersion = Number(nextVersion);
      if (!Number.isSafeInteger(numericVersion)) {
        return failure('AUTHORITY_DENIED', 'entitlement-version-out-of-range');
      }
      const issuedAt = dependencies.clock.now().toISOString();
      const expiresAt = new Date(
        Date.parse(issuedAt) + OFFLINE_ENTITLEMENT_VALIDITY_SECONDS * 1_000,
      ).toISOString();
      const payloadBytes = encodeOfflineEntitlementPayload({
        schemaVersion: '1.0',
        accountId: input.accountId,
        deviceBinding: input.deviceBinding,
        audience: input.audience,
        entitlementVersion: numericVersion,
        issuedAt,
        expiresAt,
        validitySeconds: OFFLINE_ENTITLEMENT_VALIDITY_SECONDS,
      });
      let signature: Awaited<ReturnType<EntitlementSigningPort['sign']>>;
      let verificationKeys: Awaited<ReturnType<EntitlementSigningPort['publicVerificationData']>>;
      try {
        signature = await dependencies.signer.sign(payloadBytes);
        verificationKeys = await dependencies.signer.publicVerificationData();
      } catch {
        return failure('SIGNING_UNAVAILABLE', 'entitlement-signing-unavailable');
      }
      const signingKey = verificationKeys.find(({ keyId }) => keyId === signature.keyId);
      const issuedAtUnixSeconds = Date.parse(issuedAt) / 1_000;
      if (
        signingKey?.status !== 'current' ||
        issuedAtUnixSeconds < signingKey.notBeforeUnixSeconds ||
        issuedAtUnixSeconds > signingKey.notAfterUnixSeconds
      ) {
        return failure('SIGNING_UNAVAILABLE', 'entitlement-signing-key-not-current');
      }
      const envelope: OfflineEntitlementEnvelopeJson = {
        schemaVersion: '1.0',
        kind: 'offline-entitlement-envelope',
        payloadBytes: encodeBase64Url(payloadBytes),
        signature: signature.signature,
        algorithm: signature.algorithm,
        keyId: signature.keyId,
        audience: input.audience,
        deviceBinding: input.deviceBinding,
        issuedAt,
        expiresAt,
        validitySeconds: OFFLINE_ENTITLEMENT_VALIDITY_SECONDS,
      };
      if (!controlPlaneDocumentValidator(envelope)) {
        return failure('SIGNING_UNAVAILABLE', 'signed-envelope-invalid');
      }
      const outcome = input.operation === 'issue' ? 'issued' : 'renewed';
      const result: OfflineEntitlementCommandResult = {
        ok: true,
        outcome,
        envelope,
        aggregateVersion: nextVersion.toString(),
        deviceVersion: device.version.toString(),
      };
      await transaction.persistIssuance({
        entitlementId: entitlement.entitlementId,
        expectedEntitlementVersion: entitlement.version,
        nextEntitlementVersion: nextVersion,
        issuedAt,
        expiresAt,
        keyId: signature.keyId,
      });
      await transaction.appendAudit({
        auditReference: dependencies.ids.next(),
        accountId: input.accountId,
        eventType:
          input.operation === 'issue'
            ? 'entitlement.offline-issued'
            : 'entitlement.offline-renewed',
        aggregateVersion: nextVersion,
        deviceBinding: input.deviceBinding,
        reason: input.operation,
        keyId: signature.keyId,
        correlationId: input.correlationId,
        occurredAt: issuedAt,
      });
      await transaction.enqueueOutbox({
        jobId: dependencies.ids.next(),
        topic: 'entitlement.authority-changed',
        entitlementId: entitlement.entitlementId,
        aggregateVersion: nextVersion,
        deviceBinding: input.deviceBinding,
        outcome,
        availableAt: issuedAt,
      });
      await transaction.rememberCommandResult(input.commandId, result);
      return result;
    });
  } catch {
    return failure('PERSISTENCE_FAILED', 'entitlement-transaction-failed');
  }
};

export const revokeOfflineEntitlement = async (
  dependencies: OfflineEntitlementDependencies,
  input: RevokeOfflineEntitlementInput,
): Promise<OfflineEntitlementCommandResult> => {
  const authorized = await dependencies.authorizer.authorize({
    actorAccountId: input.actorAccountId,
    accountId: input.accountId,
    scope: 'entitlement-revoke',
  });
  if (!authorized) return failure('UNAUTHORIZED', 'owner-required');

  try {
    return await dependencies.repository.transaction(input.accountId, async (transaction) => {
      const remembered = await transaction.findCommandResult(input.commandId);
      if (remembered !== null) return remembered;
      const entitlement = await transaction.lockEntitlement(input.accountId);
      if (entitlement === null) return failure('NOT_FOUND', 'entitlement-authority-not-found');
      const device = await transaction.lockActiveDevice(entitlement.entitlementId);
      if (
        device === null ||
        entitlement.status === 'revoked' ||
        device.bindingId !== input.deviceBinding ||
        device.state !== 'active'
      ) {
        return failure('AUTHORITY_DENIED', 'active-entitlement-device-required');
      }
      if (
        entitlement.version !== input.expectedEntitlementVersion ||
        device.version !== input.expectedDeviceVersion
      ) {
        return failure('STALE', 'expected-version-mismatch');
      }
      const revokedAt = dependencies.clock.now().toISOString();
      const nextVersion = entitlement.version + 1n;
      await transaction.revokeEntitlement({
        entitlementId: entitlement.entitlementId,
        expectedEntitlementVersion: entitlement.version,
        nextEntitlementVersion: nextVersion,
        revokedAt,
      });
      await transaction.revokeDevice(device.bindingId, device.version, revokedAt);
      const result: OfflineEntitlementCommandResult = {
        ok: true,
        outcome: 'revoked',
        aggregateVersion: nextVersion.toString(),
        deviceVersion: (device.version + 1n).toString(),
      };
      await transaction.appendAudit({
        auditReference: dependencies.ids.next(),
        accountId: input.accountId,
        eventType: 'entitlement.revoked',
        aggregateVersion: nextVersion,
        deviceBinding: input.deviceBinding,
        reason: input.reason,
        correlationId: input.correlationId,
        occurredAt: revokedAt,
      });
      await transaction.enqueueOutbox({
        jobId: dependencies.ids.next(),
        topic: 'entitlement.authority-changed',
        entitlementId: entitlement.entitlementId,
        aggregateVersion: nextVersion,
        deviceBinding: input.deviceBinding,
        outcome: 'revoked',
        availableAt: revokedAt,
      });
      await transaction.rememberCommandResult(input.commandId, result);
      return result;
    });
  } catch {
    return failure('PERSISTENCE_FAILED', 'entitlement-transaction-failed');
  }
};
