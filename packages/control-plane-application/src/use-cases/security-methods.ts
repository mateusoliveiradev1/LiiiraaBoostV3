import {
  APPROVED_SECURITY_FACTORS,
  authorizeSensitiveAction,
  type SensitiveAction,
  type StepUpEvidence,
} from '@liiiraa/control-plane-domain';

export type { SensitiveAction, StepUpEvidence } from '@liiiraa/control-plane-domain';

import type {
  IdentityActionScope,
  IdentityProviderPort,
  IdentitySecondFactor,
} from '../ports/identity.js';

export interface SecurityMethodRecord {
  readonly methodId: string;
  readonly accountId: string;
  readonly factor: IdentitySecondFactor;
  readonly credentialReference: string;
  readonly verifiedAt: string;
  readonly revokedAt: string | null;
  readonly version: bigint;
}

export interface SecurityMethodTransaction {
  insert(record: SecurityMethodRecord): Promise<void>;
  revoke(methodId: string, revokedAt: string): Promise<boolean>;
  appendAudit(
    input: Readonly<{ accountId: string; action: string; occurredAt: string }>,
  ): Promise<void>;
}

export interface SecurityMethodRepository {
  transaction<T>(
    accountId: string,
    operation: (transaction: SecurityMethodTransaction) => Promise<T>,
  ): Promise<T>;
}

export interface SecurityMethodDependencies {
  readonly provider: Pick<IdentityProviderPort, 'enrollFactor' | 'stepUp'>;
  readonly repository: SecurityMethodRepository;
  readonly clock: Readonly<{ now(): Date }>;
  readonly ids: Readonly<{ next(): string }>;
}

export type SecurityMethodResult =
  | Readonly<{ ok: true; method: SecurityMethodRecord; stepUp: StepUpEvidence }>
  | Readonly<{ ok: false; code: string }>;

export interface EnrollSecurityMethodInput {
  readonly accountId: string;
  readonly sessionId: string;
  readonly factor: string;
  readonly credentialReference: string;
  readonly stepUpFactor: string;
  readonly stepUpProof: string;
  readonly action?: SensitiveAction;
  readonly recoveryHoldUntil?: string;
}

const approvedFactor = (factor: string): factor is IdentitySecondFactor =>
  APPROVED_SECURITY_FACTORS.some((candidate) => candidate === factor);

const actionScope = (action: SensitiveAction): IdentityActionScope => {
  switch (action) {
    case 'security-method-change':
      return 'security-methods';
    case 'device-transfer':
      return 'device-transfer';
    case 'refund':
      return 'refund';
    case 'protected-data-access':
      return 'protected-data';
    case 'ordinary-access':
      return 'security-methods';
  }
};

const scopedStepUp = async (
  dependencies: SecurityMethodDependencies,
  input: Readonly<{
    sessionId: string;
    factor: string;
    proof: string;
    action: SensitiveAction;
    recoveryHoldUntil?: string;
  }>,
): Promise<
  Readonly<{ ok: true; evidence: StepUpEvidence }> | Readonly<{ ok: false; code: string }>
> => {
  if (!approvedFactor(input.factor)) return { ok: false, code: 'INVALID_FACTOR' };
  const receipt = await dependencies.provider.stepUp({
    sessionId: input.sessionId,
    actionScope: actionScope(input.action),
    factor: input.factor,
    proof: input.proof,
  });
  if (!receipt.ok) return { ok: false, code: receipt.code };
  if (receipt.value.actionScope !== actionScope(input.action)) {
    return { ok: false, code: 'STEP_UP_WRONG_ACTION' };
  }
  const evidence: StepUpEvidence = {
    factor: receipt.value.factor,
    action: input.action,
    verifiedAt: receipt.value.verifiedAt,
    expiresAt: receipt.value.expiresAt,
  };
  const authorization = authorizeSensitiveAction({
    action: input.action,
    now: dependencies.clock.now().toISOString(),
    ...(input.recoveryHoldUntil ? { recoveryHoldUntil: input.recoveryHoldUntil } : {}),
    stepUp: evidence,
  });
  return authorization.allowed ? { ok: true, evidence } : { ok: false, code: authorization.code };
};

export const authorizeScopedSensitiveAction = (
  clock: Readonly<{ now(): Date }>,
  input: Readonly<{
    action: SensitiveAction;
    recoveryHoldUntil?: string;
    stepUp?: StepUpEvidence;
  }>,
) =>
  authorizeSensitiveAction({
    action: input.action,
    now: clock.now().toISOString(),
    ...(input.recoveryHoldUntil ? { recoveryHoldUntil: input.recoveryHoldUntil } : {}),
    ...(input.stepUp ? { stepUp: input.stepUp } : {}),
  });

export const enrollSecurityMethod = async (
  dependencies: SecurityMethodDependencies,
  input: EnrollSecurityMethodInput,
): Promise<SecurityMethodResult> => {
  if (!approvedFactor(input.factor)) return { ok: false, code: 'INVALID_FACTOR' };
  const action = input.action ?? 'security-method-change';
  const stepUp = await scopedStepUp(dependencies, {
    sessionId: input.sessionId,
    factor: input.stepUpFactor,
    proof: input.stepUpProof,
    action,
    ...(input.recoveryHoldUntil ? { recoveryHoldUntil: input.recoveryHoldUntil } : {}),
  });
  if (!stepUp.ok) return stepUp;
  const enrolled = await dependencies.provider.enrollFactor({
    sessionId: input.sessionId,
    factor: input.factor,
  });
  if (!enrolled.ok) return { ok: false, code: enrolled.code };
  const verifiedAt = dependencies.clock.now().toISOString();
  const method: SecurityMethodRecord = {
    methodId: dependencies.ids.next(),
    accountId: input.accountId,
    factor: enrolled.value.factor,
    credentialReference: input.credentialReference,
    verifiedAt,
    revokedAt: null,
    version: 1n,
  };
  await dependencies.repository.transaction(input.accountId, async (transaction) => {
    await transaction.insert(method);
    await transaction.appendAudit({
      accountId: input.accountId,
      action: 'identity.security-method-enrolled',
      occurredAt: verifiedAt,
    });
  });
  return { ok: true, method, stepUp: stepUp.evidence };
};

export const disableSecurityMethod = async (
  dependencies: SecurityMethodDependencies,
  input: Readonly<{
    accountId: string;
    sessionId: string;
    methodId: string;
    stepUpFactor: string;
    stepUpProof: string;
    recoveryHoldUntil?: string;
  }>,
): Promise<Readonly<{ ok: boolean; code?: string }>> => {
  const stepUp = await scopedStepUp(dependencies, {
    sessionId: input.sessionId,
    factor: input.stepUpFactor,
    proof: input.stepUpProof,
    action: 'security-method-change',
    ...(input.recoveryHoldUntil ? { recoveryHoldUntil: input.recoveryHoldUntil } : {}),
  });
  if (!stepUp.ok) return stepUp;
  const revokedAt = dependencies.clock.now().toISOString();
  return dependencies.repository.transaction(input.accountId, async (transaction) => {
    if (!(await transaction.revoke(input.methodId, revokedAt))) {
      return { ok: false, code: 'SECURITY_METHOD_NOT_FOUND' } as const;
    }
    await transaction.appendAudit({
      accountId: input.accountId,
      action: 'identity.security-method-disabled',
      occurredAt: revokedAt,
    });
    return { ok: true } as const;
  });
};
