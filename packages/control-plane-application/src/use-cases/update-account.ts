import type { AccountCommandJson } from '@liiiraa/contracts-ts';

import {
  assembleAccountProjection,
  type AccountAuthorityRecord,
  type AccountOwnerAuthorizer,
  type AccountProjectionProvenance,
  type AccountProjectionSnapshot,
  type AccountProjectionSnapshotReader,
  type SharedAccountProjection,
} from './project-account.js';

export interface AccountMutationTransaction extends AccountProjectionSnapshotReader {
  saveAccount(record: AccountAuthorityRecord): Promise<void>;
}

export interface AccountMutationRepository {
  transaction<T>(
    accountId: string,
    operation: (transaction: AccountMutationTransaction) => Promise<T>,
  ): Promise<T>;
}

export interface UpdateAccountDependencies {
  readonly repository: AccountMutationRepository;
  readonly authorizer: AccountOwnerAuthorizer;
  readonly clock: Readonly<{ now(): Date }>;
}

export interface UpdateAccountInput {
  readonly actorAccountId: string;
  readonly command: AccountCommandJson;
  readonly patch: Readonly<{ displayName?: string; locale?: 'pt-BR' | 'en' }>;
  readonly localDraftToken: string;
}

export type UpdateAccountResult =
  | Readonly<{ ok: true; projection: SharedAccountProjection }>
  | Readonly<{
      ok: false;
      code: 'CONFLICT';
      projection: SharedAccountProjection;
      localDraftToken: string;
    }>
  | Readonly<{
      ok: false;
      code: 'UNAUTHORIZED' | 'NOT_FOUND' | 'INVALID_REQUEST' | 'CONTRADICTORY_SNAPSHOT';
    }>;

const expectedVersion = (value: string): bigint | null =>
  /^(?:0|[1-9][0-9]*)$/u.test(value) ? BigInt(value) : null;

const withProvenance = (
  projection: SharedAccountProjection,
  provenance: Extract<AccountProjectionProvenance, 'conflict'>,
): SharedAccountProjection => Object.freeze({ ...projection, provenance });

const validPatch = (value: unknown): value is UpdateAccountInput['patch'] => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const patch = value as Readonly<Record<string, unknown>>;
  if (Object.keys(patch).some((key) => key !== 'displayName' && key !== 'locale')) return false;
  if (patch['displayName'] === undefined && patch['locale'] === undefined) return false;
  if (
    patch['displayName'] !== undefined &&
    (typeof patch['displayName'] !== 'string' ||
      patch['displayName'].trim().length === 0 ||
      patch['displayName'].length > 256)
  ) {
    return false;
  }
  return patch['locale'] === undefined || patch['locale'] === 'pt-BR' || patch['locale'] === 'en';
};

export const updateAccount = async (
  dependencies: UpdateAccountDependencies,
  input: UpdateAccountInput,
): Promise<UpdateAccountResult> => {
  const version = expectedVersion(input.command.expectedVersion);
  if (
    version === null ||
    input.command.action !== 'update-profile' ||
    input.localDraftToken.length === 0 ||
    input.localDraftToken.length > 128 ||
    !validPatch(input.patch)
  ) {
    return { ok: false, code: 'INVALID_REQUEST' };
  }
  if (
    input.actorAccountId !== input.command.accountId ||
    !(await dependencies.authorizer.authorizeOwner({
      actorAccountId: input.actorAccountId,
      accountId: input.command.accountId,
    }))
  ) {
    return { ok: false, code: 'UNAUTHORIZED' };
  }

  return dependencies.repository.transaction(input.command.accountId, async (transaction) => {
    const snapshot = await transaction.loadSnapshot(input.command.accountId);
    if (snapshot === null) return { ok: false, code: 'NOT_FOUND' } as const;
    try {
      const currentProjection = assembleAccountProjection(snapshot, input.command.correlationId);
      if (snapshot.account.version !== version) {
        return {
          ok: false,
          code: 'CONFLICT',
          projection: withProvenance(currentProjection, 'conflict'),
          localDraftToken: input.localDraftToken,
        } as const;
      }

      const updated: AccountAuthorityRecord = {
        ...snapshot.account,
        version: snapshot.account.version + 1n,
        ...(input.patch.displayName === undefined
          ? {}
          : { displayName: input.patch.displayName.trim() }),
        ...(input.patch.locale === undefined ? {} : { locale: input.patch.locale }),
        updatedAt: dependencies.clock.now().toISOString(),
      };
      const updatedSnapshot: AccountProjectionSnapshot = { ...snapshot, account: updated };
      const projection = assembleAccountProjection(updatedSnapshot, input.command.correlationId);
      await transaction.saveAccount(updated);
      return {
        ok: true,
        projection,
      } as const;
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('ACCOUNT_PROJECTION_CONTRADICTION:')) {
        return { ok: false, code: 'CONTRADICTORY_SNAPSHOT' } as const;
      }
      throw error;
    }
  });
};
