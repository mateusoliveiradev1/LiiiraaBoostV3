import type { AdminCommandJson } from '@liiiraa/contracts-ts';
import {
  authorizeAdminCommand,
  type AdminCommandAuthorizationContext,
  type AdminProjectionResource,
  type AdminSessionClaim,
} from '@liiiraa/control-plane-domain';

export interface AdminAggregateProjection {
  readonly version: bigint;
  readonly state: string;
  readonly [key: string]: unknown;
}

export type AdminCommandResult =
  | Readonly<{
      ok: true;
      outcome: 'applied';
      aggregateVersion: string;
      auditReference: string;
      resource: AdminProjectionResource;
    }>
  | Readonly<{ ok: false; code: string }>;

export interface AdminCommandTransaction {
  findCommandResult(commandId: string): Promise<AdminCommandResult | null>;
  loadAggregate(
    resource: AdminProjectionResource,
    redactedTarget: string,
  ): Promise<AdminAggregateProjection | null>;
  apply(
    command: AdminCommandJson,
    aggregate: AdminAggregateProjection,
  ): Promise<AdminAggregateProjection>;
  appendAudit(event: Readonly<Record<string, unknown>>): Promise<string>;
  enqueueOutbox(event: Readonly<Record<string, unknown>>): Promise<void>;
  rememberCommandResult(commandId: string, result: AdminCommandResult): Promise<void>;
}

export interface AdminCommandRepository {
  transaction<T>(
    redactedTarget: string,
    operation: (transaction: AdminCommandTransaction) => Promise<T>,
  ): Promise<T>;
}

export interface AdminCommandDependencies {
  readonly repository: AdminCommandRepository;
  readonly clock: Readonly<{ now(): Date }>;
  readonly ids: Readonly<{ next(): string }>;
}

export interface ExecuteAdminCommandInput {
  readonly session: AdminSessionClaim;
  readonly command: AdminCommandJson;
  readonly stepUp?: AdminCommandAuthorizationContext['stepUp'];
  readonly impactReviewed: boolean;
  readonly confirmed: boolean;
}

const expectedVersion = (value: string): bigint | null =>
  /^(?:0|[1-9][0-9]*)$/u.test(value) ? BigInt(value) : null;

export const executeAdminCommand = async (
  dependencies: AdminCommandDependencies,
  input: ExecuteAdminCommandInput,
): Promise<AdminCommandResult> => {
  const now = dependencies.clock.now().toISOString();
  const authorization = authorizeAdminCommand(input.session, input.command, {
    now,
    impactReviewed: input.impactReviewed,
    confirmed: input.confirmed,
    ...(input.stepUp === undefined ? {} : { stepUp: input.stepUp }),
  });
  if (!authorization.allowed || authorization.resource === undefined) {
    return { ok: false, code: authorization.code };
  }
  const version = expectedVersion(input.command.expectedVersion);
  if (version === null) return { ok: false, code: 'INVALID_VERSION' };
  const resource = authorization.resource;
  return dependencies.repository.transaction(input.command.redactedTarget, async (transaction) => {
    const replay = await transaction.findCommandResult(input.command.commandId);
    if (replay !== null) return replay;
    const aggregate = await transaction.loadAggregate(resource, input.command.redactedTarget);
    if (aggregate === null) return { ok: false, code: 'NOT_FOUND' };
    if (aggregate.version !== version) return { ok: false, code: 'STALE' };
    const updated = await transaction.apply(input.command, aggregate);
    const auditReference = await transaction.appendAudit(
      Object.freeze({
        eventId: dependencies.ids.next(),
        actorId: input.session.actorId,
        assumedRole: input.session.role,
        action: input.command.action,
        redactedTarget: input.command.redactedTarget,
        reason: input.command.reason,
        authorizationContextId: input.command.authorizationContextId,
        impactReviewed: true,
        confirmed: true,
        correlationId: input.command.correlationId,
        occurredAt: now,
        result: 'succeeded',
      }),
    );
    await transaction.enqueueOutbox(
      Object.freeze({
        jobId: dependencies.ids.next(),
        topic: 'admin.command.executed',
        commandId: input.command.commandId,
        resource,
        aggregateVersion: String(updated.version),
        auditReference,
        availableAt: now,
      }),
    );
    const result = Object.freeze({
      ok: true,
      outcome: 'applied',
      aggregateVersion: String(updated.version),
      auditReference,
      resource,
    } as const satisfies AdminCommandResult);
    await transaction.rememberCommandResult(input.command.commandId, result);
    return result;
  });
};
