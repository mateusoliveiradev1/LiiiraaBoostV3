import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

import type {
  ManageSubscriptionResult,
  SubscriptionManagementRepository,
  SubscriptionState,
} from '@liiiraa/control-plane-application';

import type {
  ControlPlaneMigrationDatabase,
  ControlPlaneTransaction,
} from './database.ts';

const migrationVersion = '0003_runtime_authorities';
const migrationSql = readFileSync(
  new URL('./migrations/0003_runtime_authorities.sql', import.meta.url),
  'utf8',
);
export const runtimeAuthoritiesSchemaHash = createHash('sha256')
  .update(migrationSql)
  .digest('hex');

export const migrateRuntimeAuthorities = async (
  database: ControlPlaneMigrationDatabase,
): Promise<Readonly<{ applied: boolean; schemaHash: string; version: string }>> =>
  database.transaction(async (transaction) => {
    await transaction.query(
      `SELECT pg_advisory_xact_lock(hashtext('liiiraa-boost-control-plane-migrations'))`,
    );
    const existing = await transaction.query<{ checksum: string }>(
      `SELECT checksum FROM control_plane_schema_migrations WHERE version = $1`,
      [migrationVersion],
    );
    if (existing.rows[0] !== undefined) {
      if (existing.rows[0].checksum !== runtimeAuthoritiesSchemaHash) {
        throw new Error(`Migration ${migrationVersion} checksum does not match reviewed SQL.`);
      }
      return {
        applied: false,
        schemaHash: runtimeAuthoritiesSchemaHash,
        version: migrationVersion,
      };
    }
    await transaction.query(migrationSql);
    await transaction.query(
      `INSERT INTO control_plane_schema_migrations (version, checksum) VALUES ($1, $2)`,
      [migrationVersion, runtimeAuthoritiesSchemaHash],
    );
    return {
      applied: true,
      schemaHash: runtimeAuthoritiesSchemaHash,
      version: migrationVersion,
    };
  });

const encode = (value: unknown): string =>
  JSON.stringify(value, (_key, item: unknown) => (typeof item === 'bigint' ? String(item) : item));

const decode = <T>(value: unknown): T => {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  return JSON.parse(serialized, (key, item: unknown) =>
    key === 'version' && typeof item === 'string' && /^(?:0|[1-9][0-9]*)$/u.test(item)
      ? BigInt(item)
      : item,
  ) as T;
};

const loadAggregate = async <T>(
  transaction: ControlPlaneTransaction,
  authority: string,
  aggregateId: string,
): Promise<T | null> => {
  const result = await transaction.query<{ state: unknown }>(
    `SELECT state
       FROM runtime_aggregates
      WHERE authority = $1 AND aggregate_id = $2
      FOR UPDATE`,
    [authority, aggregateId],
  );
  return result.rows[0] === undefined ? null : decode<T>(result.rows[0].state);
};

const saveAggregate = (
  transaction: ControlPlaneTransaction,
  authority: string,
  aggregateId: string,
  accountId: string,
  version: bigint,
  state: unknown,
): Promise<unknown> =>
  transaction.query(
    `INSERT INTO runtime_aggregates
       (authority, aggregate_id, identity_id, aggregate_version, state)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     ON CONFLICT (authority, aggregate_id) DO UPDATE
       SET identity_id = EXCLUDED.identity_id,
           aggregate_version = EXCLUDED.aggregate_version,
           state = EXCLUDED.state,
           updated_at = CURRENT_TIMESTAMP`,
    [authority, aggregateId, accountId, version.toString(), encode(state)],
  );

const loadCommand = async <T>(
  transaction: ControlPlaneTransaction,
  authority: string,
  commandId: string,
): Promise<T | null> => {
  const result = await transaction.query<{ result: unknown }>(
    `SELECT result
       FROM control_plane_command_results
      WHERE authority = $1 AND command_id = $2`,
    [authority, commandId],
  );
  return result.rows[0] === undefined ? null : decode<T>(result.rows[0].result);
};

const saveCommand = (
  transaction: ControlPlaneTransaction,
  authority: string,
  commandId: string,
  accountId: string,
  result: unknown,
): Promise<unknown> =>
  transaction.query(
    `INSERT INTO control_plane_command_results
       (authority, command_id, identity_id, result)
     VALUES ($1, $2, $3, $4::jsonb)
     ON CONFLICT (authority, command_id) DO NOTHING`,
    [authority, commandId, accountId, encode(result)],
  );

const appendReceipt = (
  transaction: ControlPlaneTransaction,
  input: Readonly<{
    accountId: string;
    authority: string;
    commandId: string;
    eventType: string;
    occurredAt: string;
    target: string;
    details?: Readonly<Record<string, unknown>>;
  }>,
): Promise<unknown> =>
  transaction.query(
    `INSERT INTO runtime_audit_receipts
       (id, identity_id, authority, event_type, command_id, redacted_target_digest, details, occurred_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
    [
      randomUUID(),
      input.accountId,
      input.authority,
      input.eventType,
      input.commandId,
      createHash('sha256').update(input.target).digest('hex'),
      encode(input.details ?? {}),
      input.occurredAt,
    ],
  );

export const createPostgresSubscriptionManagementRepository = (
  database: ControlPlaneMigrationDatabase,
): SubscriptionManagementRepository => ({
  transaction: (accountId, operation) =>
    database.transaction((transaction) =>
      operation({
        findCommandResult: (commandId) =>
          loadCommand<ManageSubscriptionResult>(transaction, 'commerce', commandId),
        loadSubscription: (requestedAccountId) =>
          loadAggregate<SubscriptionState>(transaction, 'subscription', requestedAccountId),
        saveIntent: async (state) => {
          await saveAggregate(
            transaction,
            'subscription',
            state.accountId,
            state.accountId,
            state.version,
            state,
          );
        },
        appendAudit: async (input) => {
          await appendReceipt(transaction, {
            accountId: input.accountId,
            authority: 'commerce',
            commandId: input.commandId,
            eventType: input.action,
            occurredAt: input.occurredAt,
            target: input.accountId,
          });
        },
        enqueueOutbox: async (input) => {
          await transaction.query(
            `INSERT INTO outbox_jobs
               (id, topic, aggregate_type, aggregate_id, aggregate_version, payload, available_at)
             VALUES ($1, $2, 'identity', $3, 0, $4::jsonb, $5)
             ON CONFLICT (id) DO NOTHING`,
            [input.jobId, input.topic, input.accountId, encode(input), input.availableAt],
          );
        },
        rememberCommandResult: async (commandId, result) => {
          await saveCommand(transaction, 'commerce', commandId, accountId, result);
        },
      }),
    ),
});

export const runtimeAuthorityJson = Object.freeze({ decode, encode });
