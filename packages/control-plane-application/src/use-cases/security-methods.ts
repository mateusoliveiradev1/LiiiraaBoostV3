import type { SensitiveAction, StepUpEvidence } from '@liiiraa/control-plane-domain';

import type { IdentityProviderPort, IdentitySecondFactor } from '../ports/identity.js';

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
  appendAudit(input: Readonly<{ accountId: string; action: string; occurredAt: string }>): Promise<void>;
}

export interface SecurityMethodRepository {
  transaction<T>(accountId: string, operation: (transaction: SecurityMethodTransaction) => Promise<T>): Promise<T>;
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
}

export const enrollSecurityMethod = async (
  _dependencies: SecurityMethodDependencies,
  _input: EnrollSecurityMethodInput,
): Promise<SecurityMethodResult> => ({ ok: false, code: 'NOT_IMPLEMENTED' });

export const disableSecurityMethod = async (
  _dependencies: SecurityMethodDependencies,
  _input: Readonly<{
    accountId: string;
    sessionId: string;
    methodId: string;
    stepUpFactor: string;
    stepUpProof: string;
  }>,
): Promise<Readonly<{ ok: boolean; code?: string }>> => ({ ok: false, code: 'NOT_IMPLEMENTED' });
