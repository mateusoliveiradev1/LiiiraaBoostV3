import type { AdminRoleJson } from '@liiiraa/contracts-ts';
import { ADMIN_ROLES } from '@liiiraa/control-plane-domain/runtime-admin-authority';

export interface ActiveAdminRoleSession {
  readonly sessionId: string;
  readonly actorId: string;
  readonly role: AdminRoleJson;
  readonly assumedAt: string;
  readonly expiresAt: string;
  readonly nonProduction: true;
  readonly premiumTestGrant: boolean;
}

export interface AdminRoleTransaction {
  loadActive(actorId: string): Promise<ActiveAdminRoleSession | null>;
  replaceActive(session: ActiveAdminRoleSession | null): Promise<void>;
  appendAudit(event: Readonly<Record<string, unknown>>): Promise<void>;
  enqueueOutbox(event: Readonly<Record<string, unknown>>): Promise<void>;
}

export interface AdminRoleRepository {
  transaction<T>(
    actorId: string,
    operation: (transaction: AdminRoleTransaction) => Promise<T>,
  ): Promise<T>;
}

export interface AdminRoleAuthorityDependencies {
  readonly repository: AdminRoleRepository;
  readonly clock: Readonly<{ now(): Date }>;
  readonly ids: Readonly<{ next(): string }>;
}

export interface AssumeAdminRoleInput {
  readonly actorId: string;
  readonly actorIsNonProduction: boolean;
  readonly role: AdminRoleJson;
  readonly reason: string;
  readonly premiumTestGrant?: boolean;
  readonly handoff?: boolean;
}

export type AssumeAdminRoleResult =
  | Readonly<{ ok: true; session: ActiveAdminRoleSession; replacedRole?: AdminRoleJson }>
  | Readonly<{ ok: false; code: string }>;

const ROLE_SESSION_MS = 60 * 60 * 1_000;

const isRole = (value: unknown): value is AdminRoleJson =>
  typeof value === 'string' && ADMIN_ROLES.includes(value as AdminRoleJson);

export const assumeAdminRole = async (
  dependencies: AdminRoleAuthorityDependencies,
  input: AssumeAdminRoleInput,
): Promise<AssumeAdminRoleResult> => {
  if (!input.actorIsNonProduction) return { ok: false, code: 'NON_PRODUCTION_REQUIRED' };
  if (!isRole(input.role)) return { ok: false, code: 'ROLE_INVALID' };
  const reason = input.reason.trim();
  if (reason.length === 0) return { ok: false, code: 'REASON_REQUIRED' };
  return dependencies.repository.transaction(input.actorId, async (transaction) => {
    const active = await transaction.loadActive(input.actorId);
    if (active !== null && active.role !== input.role && input.handoff !== true) {
      return { ok: false, code: 'HANDOFF_REQUIRED' };
    }
    const now = dependencies.clock.now();
    const session = Object.freeze({
      sessionId: dependencies.ids.next(),
      actorId: input.actorId,
      role: input.role,
      assumedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ROLE_SESSION_MS).toISOString(),
      nonProduction: true,
      premiumTestGrant: input.premiumTestGrant === true,
    } as const satisfies ActiveAdminRoleSession);
    await transaction.replaceActive(session);
    await transaction.appendAudit(
      Object.freeze({
        actorId: input.actorId,
        action: active === null ? 'admin.role.assumed' : 'admin.role.handoff',
        assumedRole: input.role,
        previousRole: active?.role,
        reason,
        occurredAt: session.assumedAt,
      }),
    );
    await transaction.enqueueOutbox(
      Object.freeze({
        topic: 'admin.role.changed',
        actorId: input.actorId,
        role: input.role,
        occurredAt: session.assumedAt,
      }),
    );
    return Object.freeze({
      ok: true,
      session,
      ...(active === null ? {} : { replacedRole: active.role }),
    });
  });
};

export const handoffAdminRole = (
  dependencies: AdminRoleAuthorityDependencies,
  input: Omit<AssumeAdminRoleInput, 'handoff'>,
): Promise<AssumeAdminRoleResult> => assumeAdminRole(dependencies, { ...input, handoff: true });

export const releaseAdminRole = async (
  dependencies: AdminRoleAuthorityDependencies,
  input: Readonly<{ actorId: string; reason: string }>,
): Promise<Readonly<{ ok: boolean; code?: string }>> => {
  const reason = input.reason.trim();
  if (reason.length === 0) return { ok: false, code: 'REASON_REQUIRED' };
  return dependencies.repository.transaction(input.actorId, async (transaction) => {
    const active = await transaction.loadActive(input.actorId);
    if (active === null) return { ok: false, code: 'ROLE_NOT_ASSUMED' };
    const occurredAt = dependencies.clock.now().toISOString();
    await transaction.replaceActive(null);
    await transaction.appendAudit({
      actorId: input.actorId,
      action: 'admin.role.released',
      assumedRole: active.role,
      reason,
      occurredAt,
    });
    await transaction.enqueueOutbox({
      topic: 'admin.role.changed',
      actorId: input.actorId,
      role: 'released',
      occurredAt,
    });
    return { ok: true };
  });
};
