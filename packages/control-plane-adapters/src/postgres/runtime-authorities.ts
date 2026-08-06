import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

import type {
  AccountDeletionState,
  CommerceAuthorityRepository,
  CommerceEntitlementRecord,
  CommerceInvoiceRecord,
  CommerceSubscriptionRecord,
  DeviceAuthorityResult,
  DeviceBindingRecord,
  DeviceBindingRepository,
  DeviceExceptionRecord,
  DiagnosticConsentState,
  ManageSubscriptionResult,
  SupportCaseState,
  SupportLifecycleCommandResult,
  SupportLifecycleRepository,
  SubscriptionManagementRepository,
  SubscriptionState,
} from '@liiiraa/control-plane-application';
import type { ProviderEventJson } from '@liiiraa/contracts-ts';

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

const listAggregates = async <T>(
  transaction: ControlPlaneTransaction,
  authority: string,
  accountId: string,
): Promise<readonly T[]> => {
  const result = await transaction.query<{ state: unknown }>(
    `SELECT state
       FROM runtime_aggregates
      WHERE authority = $1 AND identity_id = $2
      ORDER BY updated_at DESC
      FOR UPDATE`,
    [authority, accountId],
  );
  return result.rows.map(({ state }) => decode<T>(state));
};

const validUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);

const outboxId = (value: string): string => (validUuid(value) ? value : randomUUID());

const subscriptionStatus = (
  status: CommerceSubscriptionRecord['status'],
): 'active' | 'past-due' | 'grace' | 'canceled' | 'expired' => {
  if (status === 'active' || status === 'grace' || status === 'canceled' || status === 'expired') {
    return status;
  }
  if (status === 'payment-pending') return 'past-due';
  return status === 'free' ? 'expired' : 'active';
};

export const createPostgresCommerceAuthorityRepository = (
  database: ControlPlaneMigrationDatabase,
): CommerceAuthorityRepository => ({
  claimProviderEvent: (providerEvent: ProviderEventJson) =>
    database.transaction(async (transaction) => {
      await transaction.query(
        `INSERT INTO provider_inbox
           (id, provider, provider_event_id, event_type, payload_digest, received_at, processing_state)
         VALUES ($1, 'stripe', $2, $3, $4, $5, 'received')
         ON CONFLICT (provider, provider_event_id) DO NOTHING`,
        [
          randomUUID(),
          providerEvent.providerEventId,
          providerEvent.eventType,
          providerEvent.payloadDigest,
          providerEvent.receivedAt,
        ],
      );
      const claimed = await transaction.query(
        `UPDATE provider_inbox
            SET processing_state = 'processing', error_code = NULL
          WHERE provider = 'stripe'
            AND provider_event_id = $1
            AND processing_state IN ('received', 'retryable')
          RETURNING id`,
        [providerEvent.providerEventId],
      );
      return claimed.rowCount === 1 ? 'claimed' : 'duplicate';
    }),
  markProviderEventRetryable: async (providerEventId, errorCode) => {
    await database.query(
      `UPDATE provider_inbox
          SET processing_state = 'retryable', error_code = $2
        WHERE provider = 'stripe' AND provider_event_id = $1`,
      [providerEventId, errorCode],
    );
  },
  transaction: (_providerCustomerId, operation) =>
    database.transaction((transaction) =>
      operation({
        resolveAccountId: async (requestedCustomerId) => {
          const result = await transaction.query<{ identity_id: string }>(
            `SELECT identity_id::text AS identity_id
               FROM stripe_customer_links
              WHERE provider_customer_id = $1
              FOR UPDATE`,
            [requestedCustomerId],
          );
          return result.rows[0]?.identity_id ?? null;
        },
        lockSubscription: async (requestedCustomerId, providerSubscriptionId) => {
          const account = await transaction.query<{ identity_id: string }>(
            `SELECT identity_id::text AS identity_id
               FROM stripe_customer_links
              WHERE provider_customer_id = $1
              FOR UPDATE`,
            [requestedCustomerId],
          );
          const accountId = account.rows[0]?.identity_id;
          if (accountId === undefined) return null;
          const state = await loadAggregate<CommerceSubscriptionRecord>(
            transaction,
            'subscription',
            accountId,
          );
          return state?.providerSubscriptionId === providerSubscriptionId ? state : null;
        },
        saveSubscription: async (record: CommerceSubscriptionRecord) => {
          await saveAggregate(
            transaction,
            'subscription',
            record.accountId,
            record.accountId,
            record.version,
            record,
          );
          await transaction.query(
            `INSERT INTO subscriptions
               (id, identity_id, provider, provider_customer_id, provider_subscription_id,
                status, currency, current_period_start, current_period_end,
                cancel_at_period_end, version)
             VALUES ($1, $2, 'stripe', $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (provider, provider_subscription_id) DO UPDATE
               SET status = EXCLUDED.status,
                   currency = EXCLUDED.currency,
                   current_period_start = EXCLUDED.current_period_start,
                   current_period_end = EXCLUDED.current_period_end,
                   cancel_at_period_end = EXCLUDED.cancel_at_period_end,
                   version = EXCLUDED.version,
                   updated_at = CURRENT_TIMESTAMP`,
            [
              randomUUID(),
              record.accountId,
              record.providerCustomerId,
              record.providerSubscriptionId,
              subscriptionStatus(record.status),
              record.currency ?? 'BRL',
              record.currentPeriodStart,
              record.currentPeriodEnd,
              record.cancelAtPeriodEnd,
              record.version.toString(),
            ],
          );
        },
        upsertInvoice: async (record: CommerceInvoiceRecord) => {
          const status =
            record.state === 'disputed' ? 'open' : record.state === 'refunded' ? 'refunded' : record.state;
          await transaction.query(
            `INSERT INTO invoices
               (id, subscription_id, provider, provider_invoice_id, status, currency,
                amount_total_minor, amount_paid_minor, provider_created_at, paid_at, version)
             SELECT $1, subscription.id, 'stripe', $2, $3, $4, $5, $6, $7, $8, $9
               FROM subscriptions AS subscription
              WHERE subscription.provider = 'stripe' AND subscription.provider_subscription_id = $10
             ON CONFLICT (provider, provider_invoice_id) DO UPDATE
               SET status = EXCLUDED.status,
                   amount_total_minor = EXCLUDED.amount_total_minor,
                   amount_paid_minor = EXCLUDED.amount_paid_minor,
                   paid_at = EXCLUDED.paid_at,
                   version = EXCLUDED.version`,
            [
              randomUUID(),
              record.providerInvoiceId,
              status,
              record.currency.toUpperCase(),
              record.amountDueMinor,
              record.amountPaidMinor,
              record.issuedAt,
              record.settledAt ?? null,
              record.version.toString(),
              record.subscriptionId,
            ],
          );
        },
        saveEntitlement: async (record: CommerceEntitlementRecord) => {
          await saveAggregate(
            transaction,
            'entitlement',
            record.entitlementId,
            record.accountId,
            record.version,
            record,
          );
          await transaction.query(
            `INSERT INTO premium_entitlements
               (id, identity_id, subscription_id, status, source, valid_from, valid_until,
                version, authority_reference)
             SELECT $1, $2, subscription.id, $3, 'subscription', $4, $5, $6, $7
               FROM subscriptions AS subscription
              WHERE subscription.provider = 'stripe' AND subscription.provider_subscription_id = $8
             ON CONFLICT (authority_reference) DO UPDATE
               SET status = EXCLUDED.status,
                   valid_from = EXCLUDED.valid_from,
                   valid_until = EXCLUDED.valid_until,
                   version = EXCLUDED.version,
                   updated_at = CURRENT_TIMESTAMP`,
            [
              randomUUID(),
              record.accountId,
              record.status,
              record.validFrom,
              record.validUntil ?? null,
              record.version.toString(),
              record.entitlementId,
              record.subscriptionId,
            ],
          );
        },
        appendAudit: async (input) => {
          await appendReceipt(transaction, {
            accountId: input.accountId,
            authority: 'commerce',
            commandId: input.providerEventId,
            eventType: input.eventType,
            occurredAt: input.occurredAt,
            target: input.auditReference,
            details: { aggregateVersion: String(input.aggregateVersion) },
          });
        },
        enqueueOutbox: async (input) => {
          await transaction.query(
            `INSERT INTO outbox_jobs
               (id, topic, aggregate_type, aggregate_id, aggregate_version, payload, available_at)
             VALUES ($1, $2, 'identity', $3, $4, $5::jsonb, $6)
             ON CONFLICT (id) DO NOTHING`,
            [
              outboxId(input.jobId),
              input.topic,
              input.accountId,
              input.aggregateVersion.toString(),
              encode(input),
              input.availableAt,
            ],
          );
        },
        markProviderEventProcessed: async (providerEventId, aggregateVersion) => {
          await transaction.query(
            `UPDATE provider_inbox
                SET processing_state = 'processed',
                    aggregate_version = $2,
                    processed_at = CURRENT_TIMESTAMP,
                    error_code = NULL
              WHERE provider = 'stripe' AND provider_event_id = $1`,
            [providerEventId, aggregateVersion.toString()],
          );
        },
      }),
    ),
});

export const createPostgresDeviceBindingRepository = (
  database: ControlPlaneMigrationDatabase,
): DeviceBindingRepository => ({
  transaction: (accountId, operation) =>
    database.transaction((transaction) =>
      operation({
        lockEntitlement: async (requestedAccountId) => {
          const result = await transaction.query<{
            id: string;
            status: 'active' | 'grace' | 'expired' | 'revoked';
            version: string | number | bigint;
          }>(
            `SELECT id::text AS id, status, version
               FROM premium_entitlements
              WHERE identity_id = $1
              ORDER BY created_at DESC
              LIMIT 1
              FOR UPDATE`,
            [requestedAccountId],
          );
          const row = result.rows[0];
          return row === undefined
            ? null
            : {
                entitlementId: row.id,
                accountId: requestedAccountId,
                status: row.status,
                version: BigInt(row.version),
              };
        },
        findCommandResult: (commandId) =>
          loadCommand<DeviceAuthorityResult>(transaction, 'device', commandId),
        getActiveBinding: async (entitlementId) => {
          const records = await listAggregates<DeviceBindingRecord>(transaction, 'device', accountId);
          return (
            records.find(
              (record) => record.entitlementId === entitlementId && record.revokedAt === null,
            ) ?? null
          );
        },
        getLatestBinding: async (entitlementId) => {
          const records = await listAggregates<DeviceBindingRecord>(transaction, 'device', accountId);
          return records.find((record) => record.entitlementId === entitlementId) ?? null;
        },
        lockException: async (exceptionId) => {
          const result = await transaction.query<{ state: unknown }>(
            `SELECT state
               FROM device_transfer_exceptions
              WHERE exception_id = $1 AND identity_id = $2
              FOR UPDATE`,
            [exceptionId, accountId],
          );
          return result.rows[0] === undefined
            ? null
            : decode<DeviceExceptionRecord>(result.rows[0].state);
        },
        insertBinding: async (record) => {
          await saveAggregate(
            transaction,
            'device',
            record.bindingId,
            record.accountId,
            record.version,
            record,
          );
          await transaction.query(
            `INSERT INTO device_bindings
               (id, premium_entitlement_id, device_digest, wrapped_evidence, display_label,
                bound_at, revoked_at, replacement_available_at, version, authority_reference)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (authority_reference) DO UPDATE
               SET revoked_at = EXCLUDED.revoked_at,
                   replacement_available_at = EXCLUDED.replacement_available_at,
                   version = EXCLUDED.version`,
            [
              randomUUID(),
              record.entitlementId,
              record.deviceDigest,
              Buffer.from(encode(record.evidence), 'utf8'),
              record.deviceLabel,
              record.boundAt,
              record.revokedAt,
              record.replacementEligibleAt,
              record.version.toString(),
              record.bindingId,
            ],
          );
        },
        revokeBinding: async (bindingId, revokedAt) => {
          const current = await loadAggregate<DeviceBindingRecord>(
            transaction,
            'device',
            bindingId,
          );
          if (current !== null) {
            await saveAggregate(
              transaction,
              'device',
              bindingId,
              current.accountId,
              current.version + 1n,
              { ...current, revokedAt, version: current.version + 1n },
            );
          }
          await transaction.query(
            `UPDATE device_bindings
                SET revoked_at = $2, version = version + 1
              WHERE authority_reference = $1 AND revoked_at IS NULL`,
            [bindingId, revokedAt],
          );
        },
        consumeException: async (exceptionId, consumedAt, expectedVersion) => {
          await transaction.query(
            `UPDATE device_transfer_exceptions
                SET consumed_at = $2,
                    aggregate_version = aggregate_version + 1,
                    state = jsonb_set(state, '{consumedAt}', to_jsonb($2::text)),
                    updated_at = CURRENT_TIMESTAMP
              WHERE exception_id = $1 AND aggregate_version = $3 AND consumed_at IS NULL`,
            [exceptionId, consumedAt, expectedVersion.toString()],
          );
        },
        incrementEntitlementVersion: async (entitlementId, expectedVersion) => {
          const result = await transaction.query<{ version: string | number | bigint }>(
            `UPDATE premium_entitlements
                SET version = version + 1, updated_at = CURRENT_TIMESTAMP
              WHERE id = $1 AND version = $2
              RETURNING version`,
            [entitlementId, expectedVersion.toString()],
          );
          const row = result.rows[0];
          if (row === undefined) throw new Error('device-entitlement-version-conflict');
          return BigInt(row.version);
        },
        appendAudit: async (input) => {
          await appendReceipt(transaction, {
            accountId: input.accountId,
            authority: 'device',
            commandId: input.auditReference,
            eventType: input.eventType,
            occurredAt: input.occurredAt,
            target: input.reason,
            details: { aggregateVersion: String(input.aggregateVersion) },
          });
        },
        enqueueOutbox: async (input) => {
          await transaction.query(
            `INSERT INTO outbox_jobs
               (id, topic, aggregate_type, aggregate_id, aggregate_version, payload, available_at)
             SELECT $1, $2, 'premium-entitlement', id, $3, $4::jsonb, $5
               FROM premium_entitlements WHERE id = $6
             ON CONFLICT (id) DO NOTHING`,
            [
              outboxId(input.jobId),
              input.topic,
              input.aggregateVersion.toString(),
              encode(input),
              input.availableAt,
              input.entitlementId,
            ],
          );
        },
        rememberCommandResult: async (commandId, result) => {
          await saveCommand(transaction, 'device', commandId, accountId, result);
        },
      }),
    ),
});

const supportStatus = (status: SupportCaseState['status']): string =>
  status === 'waiting-customer'
    ? 'awaiting-customer'
    : status === 'waiting-support'
      ? 'awaiting-support'
      : status;

export const createPostgresSupportLifecycleRepository = (
  database: ControlPlaneMigrationDatabase,
): SupportLifecycleRepository => ({
  transaction: (accountId, operation) =>
    database.transaction((transaction) =>
      operation({
        findCommandResult: (commandId) =>
          loadCommand<SupportLifecycleCommandResult>(transaction, 'support', commandId),
        rememberCommandResult: async (commandId, result) => {
          await saveCommand(transaction, 'support', commandId, accountId, result);
        },
        loadCase: (caseId) =>
          loadAggregate<SupportCaseState>(transaction, 'support-case', caseId),
        saveCase: async (state) => {
          await saveAggregate(
            transaction,
            'support-case',
            state.caseId,
            state.accountId,
            state.version,
            state,
          );
          await transaction.query(
            `INSERT INTO support_cases
               (id, identity_id, status, priority, subject, retain_until, version,
                authority_reference, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (authority_reference) DO UPDATE
               SET status = EXCLUDED.status,
                   priority = EXCLUDED.priority,
                   subject = EXCLUDED.subject,
                   version = EXCLUDED.version,
                   updated_at = EXCLUDED.updated_at`,
            [
              randomUUID(),
              state.accountId,
              supportStatus(state.status),
              state.priority === 'priority' ? 'high' : 'normal',
              state.subjectRedacted,
              new Date(Date.parse(state.updatedAt) + 365 * 86_400_000).toISOString(),
              state.version.toString(),
              state.caseId,
              state.createdAt,
              state.updatedAt,
            ],
          );
        },
        loadConsent: (consentId) =>
          loadAggregate<DiagnosticConsentState>(transaction, 'diagnostic-consent', consentId),
        saveConsent: async (state) => {
          await saveAggregate(
            transaction,
            'diagnostic-consent',
            state.consentId,
            state.accountId,
            state.version,
            state,
          );
          await transaction.query(
            `INSERT INTO diagnostic_consents
               (id, case_id, identity_id, consent_scope, access_reason, granted_at, expires_at,
                revoked_at, version, authority_reference)
             SELECT $1, support.id, $2, 'case-session', $3, $4, $5, $6, $7, $8
               FROM support_cases AS support WHERE support.authority_reference = $9
             ON CONFLICT (authority_reference) DO UPDATE
               SET revoked_at = EXCLUDED.revoked_at,
                   expires_at = EXCLUDED.expires_at,
                   version = EXCLUDED.version`,
            [
              randomUUID(),
              state.accountId,
              state.purpose,
              state.grantedAt,
              state.expiresAt,
              state.revokedAt ?? (state.status === 'expired' ? state.expiresAt : null),
              state.version.toString(),
              state.consentId,
              state.caseId,
            ],
          );
        },
        expireCaseConsents: async (caseId, expiredAt) => {
          const states = await listAggregates<DiagnosticConsentState>(
            transaction,
            'diagnostic-consent',
            accountId,
          );
          const active = states.filter(
            (state) => state.caseId === caseId && state.status === 'active',
          );
          for (const state of active) {
            const expired = {
              ...state,
              status: 'expired' as const,
              version: state.version + 1n,
            };
            await saveAggregate(
              transaction,
              'diagnostic-consent',
              state.consentId,
              accountId,
              expired.version,
              expired,
            );
            await transaction.query(
              `UPDATE diagnostic_consents
                  SET revoked_at = $2, version = version + 1
                WHERE authority_reference = $1 AND revoked_at IS NULL`,
              [state.consentId, expiredAt],
            );
          }
          return active.map(({ consentId }) => consentId);
        },
        loadDeletion: (requestedAccountId) =>
          loadAggregate<AccountDeletionState>(
            transaction,
            'account-deletion',
            requestedAccountId,
          ),
        saveDeletion: async (state) => {
          await saveAggregate(
            transaction,
            'account-deletion',
            state.accountId,
            state.accountId,
            state.version,
            state,
          );
          if (state.status !== 'none') {
            const dbStatus =
              state.status === 'pending'
                ? 'scheduled'
                : state.status === 'canceled'
                  ? 'canceled'
                  : state.status === 'completed'
                    ? 'completed'
                    : 'partially-retained';
            await transaction.query(
              `INSERT INTO deletion_requests
                 (id, identity_id, requested_by_identity_id, status, requested_at, scheduled_for,
                  canceled_at, completed_at, version, authority_reference)
               VALUES ($1, $2, $2, $3, $4, $5, $6, $7, $8, $9)
               ON CONFLICT (authority_reference) DO UPDATE
                 SET status = EXCLUDED.status,
                     canceled_at = EXCLUDED.canceled_at,
                     completed_at = EXCLUDED.completed_at,
                     version = EXCLUDED.version`,
              [
                randomUUID(),
                state.accountId,
                dbStatus,
                state.requestedAt ?? new Date().toISOString(),
                state.finalizeAt ?? new Date(Date.now() + 86_400_000).toISOString(),
                state.canceledAt ?? null,
                state.finalizedAt ?? null,
                state.version.toString(),
                state.requestId ?? state.accountId,
              ],
            );
          }
        },
        eraseOrdinaryAccountData: async (requestedAccountId, erasedAt) => {
          await transaction.query(
            `UPDATE identities
                SET display_name = 'Deleted account',
                    email = CONCAT('deleted+', id::text, '@invalid.local'),
                    password_hash = NULL,
                    status = 'deleted',
                    updated_at = $2,
                    version = version + 1
              WHERE id = $1`,
            [requestedAccountId, erasedAt],
          );
          await transaction.query(
            `DELETE FROM runtime_aggregates
              WHERE identity_id = $1 AND authority IN ('support-case', 'diagnostic-consent', 'device')`,
            [requestedAccountId],
          );
        },
        appendAudit: async (input) => {
          await appendReceipt(transaction, {
            accountId: input.accountId,
            authority: 'support',
            commandId: input.commandId,
            eventType: input.action,
            occurredAt: input.occurredAt,
            target: input.redactedTarget,
          });
        },
        enqueueOutbox: async (input) => {
          await transaction.query(
            `INSERT INTO outbox_jobs
               (id, topic, aggregate_type, aggregate_id, aggregate_version, payload, available_at)
             VALUES ($1, $2, 'identity', $3, 0, $4::jsonb, $5)
             ON CONFLICT (id) DO NOTHING`,
            [
              outboxId(input.jobId),
              input.topic,
              accountId,
              encode(input),
              input.availableAt,
            ],
          );
        },
      }),
    ),
});

export const projectRuntimeAggregate = async <T>(
  database: Pick<ControlPlaneMigrationDatabase, 'query'>,
  authority: string,
  aggregateId: string,
): Promise<T | null> => {
  const result = await database.query<{ state: unknown }>(
    `SELECT state FROM runtime_aggregates WHERE authority = $1 AND aggregate_id = $2`,
    [authority, aggregateId],
  );
  return result.rows[0] === undefined ? null : decode<T>(result.rows[0].state);
};

export const listRuntimeAuthority = async <T>(
  database: Pick<ControlPlaneMigrationDatabase, 'query'>,
  authority: string,
  accountId: string,
): Promise<readonly T[]> => {
  const result = await database.query<{ state: unknown }>(
    `SELECT state
       FROM runtime_aggregates
      WHERE authority = $1 AND identity_id = $2
      ORDER BY updated_at DESC`,
    [authority, accountId],
  );
  return result.rows.map(({ state }) => decode<T>(state));
};

export const runtimeAuthorityJson = Object.freeze({ decode, encode });
