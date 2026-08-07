import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

import type {
  AdminConflictDraft,
  AdminEmergencyStopRecord,
  AdminExportRecord,
  AdminIncidentRecord,
  AdminOperationsCommandResult,
  AdminOperationsReceipt,
  AdminOperationsRepositoryPort,
  AdminOperationsTransaction,
  AdminPrivacyCaseRecord,
  AdminSearchQuery,
  AdminSearchRecord,
} from '@liiiraa/control-plane-application';
import type {
  AdminConfigurationState,
  AdminEnvironment,
  AdminJobState,
  AdminJobStatus,
} from '@liiiraa/control-plane-domain';

import type { ControlPlaneMigrationDatabase, ControlPlaneTransaction } from './database.ts';

const migrationVersion = '0006_admin_operations';
const migrationSql = readFileSync(
  new URL('./migrations/0006_admin_operations.sql', import.meta.url),
  'utf8',
);
export const adminOperationsSchemaHash = createHash('sha256').update(migrationSql).digest('hex');

const encode = (value: unknown): string =>
  JSON.stringify(value, (_key, item: unknown) => (typeof item === 'bigint' ? String(item) : item));

const decode = (value: unknown): unknown => {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  return JSON.parse(serialized, (key, item: unknown) =>
    key.toLowerCase().includes('version') &&
    typeof item === 'string' &&
    /^(?:0|[1-9][0-9]*)$/u.test(item)
      ? BigInt(item)
      : item,
  ) as unknown;
};

const iso = (value: string | Date): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const validUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);

const uuid = (value: unknown): string => {
  const candidate = typeof value === 'string' ? value : '';
  return validUuid(candidate) ? candidate : randomUUID();
};

const minimizedWork = (
  work: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> => {
  const allowed = ['kind', 'incidentId', 'procedureVersion', 'exportId', 'caseId'] as const;
  const result: Record<string, unknown> = {};
  for (const key of allowed) if (work[key] !== undefined) result[key] = work[key];
  return Object.freeze(result);
};

const boundedText = (value: unknown, fallback: string): string => {
  const text =
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
      ? String(value).trim()
      : fallback;
  return (text.length === 0 ? fallback : text).slice(0, 500);
};

export const migrateAdminOperations = async (
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
    const applied = existing.rows[0];
    if (applied !== undefined) {
      if (applied.checksum !== adminOperationsSchemaHash) {
        throw new Error(`Migration ${migrationVersion} checksum does not match reviewed SQL.`);
      }
      return { applied: false, schemaHash: adminOperationsSchemaHash, version: migrationVersion };
    }
    await transaction.query(migrationSql);
    await transaction.query(
      `INSERT INTO control_plane_schema_migrations (version, checksum) VALUES ($1, $2)`,
      [migrationVersion, adminOperationsSchemaHash],
    );
    return { applied: true, schemaHash: adminOperationsSchemaHash, version: migrationVersion };
  });

export interface PostgresAdminOperationsOptions {
  readonly environment: AdminEnvironment;
  readonly environmentId: string;
}

const validateOptions = (options: PostgresAdminOperationsOptions): void => {
  if (!validUuid(options.environmentId))
    throw new Error('Admin operations environment ID is invalid.');
  if (options.environment === 'production') {
    throw new Error('Synthetic admin operations storage cannot represent production authority.');
  }
};

interface SearchRow extends Record<string, unknown> {
  readonly record_id: string;
  readonly scope: string;
  readonly owner_id: string | null;
  readonly masked_title: string;
}

interface JobRow extends Record<string, unknown> {
  readonly job_id: string;
  readonly kind: string;
  readonly status: AdminJobStatus;
  readonly version: string | number | bigint;
  readonly progress: number;
  readonly affected_items: number;
  readonly idempotency_key: string;
  readonly receipt_id: string | null;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
}

const projectJob = (row: JobRow): AdminJobState => ({
  jobId: row.job_id,
  kind: row.kind,
  status: row.status,
  version: BigInt(row.version),
  progress: row.progress,
  affectedItems: row.affected_items,
  idempotencyKey: row.idempotency_key,
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
  ...(row.receipt_id === null ? {} : { receiptId: row.receipt_id }),
});

interface ConfigurationRow extends Record<string, unknown> {
  readonly configuration_id: string;
  readonly version: string | number | bigint;
  readonly status: AdminConfigurationState['status'];
  readonly cohort: string;
  readonly known_version: string;
  readonly created_at: string | Date;
}

interface ConflictRow extends Record<string, unknown> {
  readonly draft_id: string;
  readonly subject_id: string;
  readonly actor_id: string;
  readonly expected_version: string | number | bigint;
  readonly actual_version: string | number | bigint;
  readonly local_draft: unknown;
  readonly remote_state: unknown;
  readonly conflicting_fields: readonly string[];
  readonly preserved_at: string | Date;
}

const projectConflict = (row: ConflictRow): AdminConflictDraft => ({
  draftId: row.draft_id,
  subjectId: row.subject_id,
  actorId: row.actor_id,
  expectedVersion: BigInt(row.expected_version),
  actualVersion: BigInt(row.actual_version),
  localDraft: decode(row.local_draft) as Readonly<Record<string, unknown>>,
  remote: decode(row.remote_state) as Readonly<Record<string, unknown>>,
  conflictingFields: row.conflicting_fields,
  preservedAt: iso(row.preserved_at),
});

const assertRecordEnvironment = (
  options: PostgresAdminOperationsOptions,
  environment: AdminEnvironment,
): void => {
  if (environment !== options.environment) {
    throw new Error('Admin operations environment crossing is forbidden.');
  }
};

const transactionPort = (
  transaction: ControlPlaneTransaction,
  subjectId: string,
  options: PostgresAdminOperationsOptions,
): AdminOperationsTransaction => ({
  findCommandResult: async (commandId) => {
    const result = await transaction.query<{ result: unknown }>(
      `SELECT result FROM admin_operations_commands
       WHERE environment_id = $1 AND command_id = $2`,
      [options.environmentId, commandId],
    );
    return result.rows[0] === undefined
      ? null
      : (decode(result.rows[0].result) as AdminOperationsCommandResult);
  },
  rememberCommandResult: async (commandId, result) => {
    await transaction.query(
      `INSERT INTO admin_operations_commands
        (environment_id, command_id, subject_id, idempotency_key, result)
       VALUES ($1, $2, $3, $2, $4::jsonb)
       ON CONFLICT (environment_id, command_id) DO NOTHING`,
      [options.environmentId, commandId, subjectId, encode(result)],
    );
  },
  loadJob: async (jobId) => {
    const result = await transaction.query<JobRow>(
      `SELECT job_id, kind, status, version, progress, affected_items, idempotency_key,
         receipt_id, created_at, updated_at
       FROM admin_operational_jobs
       WHERE environment_id = $1 AND job_id = $2 FOR UPDATE`,
      [options.environmentId, jobId],
    );
    return result.rows[0] === undefined ? null : projectJob(result.rows[0]);
  },
  saveJob: async (state) => {
    await transaction.query(
      `INSERT INTO admin_operational_jobs
        (environment_id, job_id, kind, status, version, progress, affected_items,
         idempotency_key, receipt_id, expected_version, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (environment_id, job_id) DO UPDATE SET
         status = EXCLUDED.status, version = EXCLUDED.version, progress = EXCLUDED.progress,
         affected_items = EXCLUDED.affected_items, receipt_id = EXCLUDED.receipt_id,
         expected_version = EXCLUDED.expected_version, updated_at = EXCLUDED.updated_at
       WHERE admin_operational_jobs.version < EXCLUDED.version
         AND admin_operational_jobs.status <> 'completed'`,
      [
        options.environmentId,
        state.jobId,
        state.kind,
        state.status,
        state.version.toString(),
        state.progress,
        state.affectedItems,
        state.idempotencyKey,
        state.receiptId ?? null,
        (state.version - 1n).toString(),
        state.createdAt,
        state.updatedAt,
      ],
    );
  },
  loadConfiguration: async (configurationId) => {
    const result = await transaction.query<ConfigurationRow>(
      `SELECT configuration_id, version, status, cohort, known_version, created_at
       FROM admin_configuration_versions
       WHERE environment_id = $1 AND configuration_id = $2
       ORDER BY version DESC LIMIT 1 FOR UPDATE`,
      [options.environmentId, configurationId],
    );
    const row = result.rows[0];
    return row === undefined
      ? null
      : {
          configurationId: row.configuration_id,
          version: BigInt(row.version),
          status: row.status,
          environment: options.environment,
          cohort: row.cohort,
          knownVersion: row.known_version,
          updatedAt: iso(row.created_at),
        };
  },
  saveConfiguration: async (state) => {
    assertRecordEnvironment(options, state.environment as AdminEnvironment);
    await transaction.query(
      `INSERT INTO admin_configuration_versions
        (environment_id, configuration_id, version, status, cohort, known_version,
         previous_version, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (environment_id, configuration_id, version) DO NOTHING`,
      [
        options.environmentId,
        state.configurationId,
        state.version.toString(),
        state.status,
        state.cohort,
        state.knownVersion,
        state.version > 1n ? (state.version - 1n).toString() : null,
        state.updatedAt ?? new Date().toISOString(),
      ],
    );
  },
  saveConflictDraft: async (draft) => {
    await transaction.query(
      `INSERT INTO admin_operational_conflicts
        (environment_id, draft_id, subject_id, actor_id, expected_version, actual_version,
         local_draft, remote_state, conflicting_fields, preserved_at, retention_expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::text[], $10,
         $10::timestamptz + INTERVAL '90 days')`,
      [
        options.environmentId,
        draft.draftId,
        draft.subjectId,
        draft.actorId,
        draft.expectedVersion.toString(),
        draft.actualVersion.toString(),
        encode(draft.localDraft),
        encode(draft.remote),
        draft.conflictingFields,
        draft.preservedAt,
      ],
    );
  },
  saveIncident: async (incident: AdminIncidentRecord) => {
    assertRecordEnvironment(options, incident.environment);
    await transaction.query(
      `INSERT INTO admin_procedures
        (environment_id, procedure_version, operation_kind, bounded, validation_reference,
         compensation_reference, active, created_at)
       VALUES ($1, $2, 'incident-recovery', TRUE, 'required', 'required', TRUE, $3)
       ON CONFLICT (environment_id, procedure_version) DO NOTHING`,
      [options.environmentId, incident.procedureVersion, incident.startedAt],
    );
    await transaction.query(
      `INSERT INTO admin_incidents
        (environment_id, incident_id, procedure_version, severity, owner_id, substitute_id,
         status, version, started_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8, $8)
       ON CONFLICT (environment_id, incident_id) DO NOTHING`,
      [
        options.environmentId,
        incident.incidentId,
        incident.procedureVersion,
        incident.severity,
        incident.ownerId,
        incident.substituteId,
        incident.status,
        incident.startedAt,
      ],
    );
  },
  saveExport: async (record: AdminExportRecord) => {
    assertRecordEnvironment(options, record.environment);
    await transaction.query(
      `INSERT INTO admin_sensitive_exports
        (environment_id, export_id, actor_id, purpose, fields, encrypted, masked, status,
         created_at, expires_at, retention_expires_at)
       VALUES ($1, $2, $3, $4, $5::text[], TRUE, TRUE, 'pending', $6, $7,
         $7::timestamptz + INTERVAL '90 days')
       ON CONFLICT (environment_id, export_id) DO NOTHING`,
      [
        options.environmentId,
        record.exportId,
        record.actorId,
        record.purpose,
        record.fields,
        record.createdAt,
        record.expiresAt,
      ],
    );
  },
  savePrivacyCase: async (record: AdminPrivacyCaseRecord) => {
    assertRecordEnvironment(options, record.environment);
    await transaction.query(
      `INSERT INTO admin_privacy_cases
        (environment_id, case_id, actor_id, legal_basis, status, version, created_at,
         retention_expires_at)
       VALUES ($1, $2, $3, $4, $5, 1, $6, $6::timestamptz + INTERVAL '1 year')
       ON CONFLICT (environment_id, case_id) DO NOTHING`,
      [
        options.environmentId,
        record.caseId,
        record.actorId,
        record.legalBasis,
        record.status,
        record.createdAt,
      ],
    );
  },
  saveEmergencyStop: async (record: AdminEmergencyStopRecord) => {
    assertRecordEnvironment(options, record.environment);
    await transaction.query(
      `INSERT INTO admin_emergency_controls
        (environment_id, stop_id, actor_id, capability, reason, status, version,
         requested_at, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, 1, $7, $8)
       ON CONFLICT (environment_id, stop_id) DO NOTHING`,
      [
        options.environmentId,
        record.stopId,
        record.actorId,
        record.capability,
        record.reason,
        record.status,
        record.requestedAt,
        record.expiresAt,
      ],
    );
  },
  enqueueWork: async (work) => {
    const minimized = minimizedWork(work);
    await transaction.query(
      `INSERT INTO outbox_jobs
        (id, topic, aggregate_type, aggregate_id, aggregate_version, payload, available_at)
       VALUES ($1, 'admin.operations.work', 'admin-operations', $2, 0, $3::jsonb,
         CURRENT_TIMESTAMP) ON CONFLICT (id) DO NOTHING`,
      [randomUUID(), subjectId, encode(minimized)],
    );
  },
  appendAudit: async (event) => {
    const eventId = boundedText(event['eventId'], randomUUID());
    await transaction.query(
      `INSERT INTO admin_operations_audit
        (environment_id, event_id, actor_id, subject_id, action, scope, reason, origin,
         correlation_id, redacted_before, redacted_after, occurred_at, retention_expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
         $12::timestamptz + INTERVAL '7 years')`,
      [
        options.environmentId,
        eventId,
        boundedText(event['actorId'], 'system'),
        boundedText(event['subjectId'], subjectId),
        boundedText(event['action'], 'admin-operation'),
        boundedText(event['scope'], 'operations'),
        boundedText(event['reason'], 'Administrative operation'),
        boundedText(event['origin'], options.environment),
        boundedText(event['correlationId'], eventId),
        boundedText(event['before'], 'not-recorded'),
        boundedText(event['after'], 'recorded'),
        boundedText(event['occurredAt'], new Date().toISOString()),
      ],
    );
    return eventId;
  },
  enqueueOutbox: async (event) => {
    await transaction.query(
      `INSERT INTO outbox_jobs
        (id, topic, aggregate_type, aggregate_id, aggregate_version, payload, available_at)
       VALUES ($1, $2, 'admin-operations', $3, 0, $4::jsonb, $5)
       ON CONFLICT (id) DO NOTHING`,
      [
        uuid(event['outboxId']),
        boundedText(event['topic'], 'admin.operations.changed'),
        boundedText(event['subjectId'], subjectId),
        encode({
          outcome: boundedText(event['outcome'], 'changed'),
          auditReference: boundedText(event['auditReference'], 'pending'),
        }),
        boundedText(event['availableAt'], new Date().toISOString()),
      ],
    );
  },
  saveReceipt: async (receipt: AdminOperationsReceipt) => {
    await transaction.query(
      `INSERT INTO admin_operations_receipts
        (environment_id, receipt_id, command_id, idempotency_key, actor_id, subject_id,
         outcome, audit_reference, occurred_at, retention_expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,
         $9::timestamptz + INTERVAL '7 years')
       ON CONFLICT (environment_id, command_id) DO NOTHING`,
      [
        options.environmentId,
        receipt.receiptId,
        receipt.commandId,
        receipt.idempotencyKey,
        receipt.actorId,
        receipt.subjectId,
        receipt.outcome,
        receipt.auditReference,
        receipt.occurredAt,
      ],
    );
  },
});

export interface PostgresAdminOperationsRepository extends AdminOperationsRepositoryPort {
  loadConflictDraft(draftId: string): Promise<AdminConflictDraft | null>;
}

export const createPostgresAdminOperationsRepository = (
  database: ControlPlaneMigrationDatabase,
  options: PostgresAdminOperationsOptions,
): PostgresAdminOperationsRepository => {
  validateOptions(options);
  return {
    search: async (query: AdminSearchQuery): Promise<readonly AdminSearchRecord[]> => {
      assertRecordEnvironment(options, query.environment);
      if (query.allowedScopes.length === 0) return [];
      const result = await database.query<SearchRow>(
        `SELECT record_id, scope, owner_id, masked_title
         FROM admin_inbox_items
         WHERE environment_id = $1
           AND scope = ANY($2::text[])
           AND ($3::text IS NULL OR owner_id = $3)
           AND ($4 = '' OR masked_title ILIKE '%' || $4 || '%' OR record_id ILIKE '%' || $4 || '%')
         ORDER BY occurred_at DESC, record_id
         LIMIT 100`,
        [options.environmentId, query.allowedScopes, query.ownerId ?? null, query.query],
      );
      return result.rows.map((row) => ({
        recordId: row.record_id,
        scope: row.scope,
        maskedTitle: row.masked_title,
        ...(row.owner_id === null ? {} : { ownerId: row.owner_id }),
      }));
    },
    transaction: (subjectId, operation) =>
      database.transaction(async (transaction) => {
        await transaction.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
          `admin-operations:${options.environmentId}:${subjectId}`,
        ]);
        return operation(transactionPort(transaction, subjectId, options));
      }),
    loadConflictDraft: async (draftId) => {
      const result = await database.query<ConflictRow>(
        `SELECT draft_id, subject_id, actor_id, expected_version, actual_version,
           local_draft, remote_state, conflicting_fields, preserved_at
         FROM admin_operational_conflicts
         WHERE environment_id = $1 AND draft_id = $2`,
        [options.environmentId, draftId],
      );
      return result.rows[0] === undefined ? null : projectConflict(result.rows[0]);
    },
  };
};

export interface AdminOperationsWorkerItem {
  readonly itemId: string;
  readonly jobId: string;
  readonly itemReference: string;
  readonly status: 'running';
  readonly version: bigint;
  readonly attemptCount: number;
  readonly claimedAt: string;
  readonly claimExpiresAt: string;
}

export interface PostgresAdminOperationsWorker {
  claim(
    input: Readonly<{
      workerId: string;
      maximumItems: number;
      leaseUntil: string;
    }>,
  ): Promise<readonly AdminOperationsWorkerItem[]>;
}

interface WorkerRow extends Record<string, unknown> {
  readonly item_id: string;
  readonly job_id: string;
  readonly item_reference: string;
  readonly status: 'running';
  readonly version: string | number | bigint;
  readonly attempt_count: number;
  readonly claimed_at: string | Date;
  readonly claim_expires_at: string | Date;
}

export const createPostgresAdminOperationsWorker = (
  database: ControlPlaneMigrationDatabase,
  options: PostgresAdminOperationsOptions,
): PostgresAdminOperationsWorker => {
  validateOptions(options);
  return {
    claim: async ({ workerId, maximumItems, leaseUntil }) => {
      if (
        workerId.trim().length === 0 ||
        !Number.isSafeInteger(maximumItems) ||
        maximumItems < 1 ||
        maximumItems > 100 ||
        !Number.isFinite(Date.parse(leaseUntil))
      ) {
        throw new Error('Bounded admin operations worker claim required.');
      }
      const result = await database.query<WorkerRow>(
        `SELECT item_id, job_id, item_reference, status, version, attempt_count,
           claimed_at, claim_expires_at
         FROM claim_admin_operational_job_items($1, $2, $3, $4)`,
        [options.environmentId, workerId, maximumItems, leaseUntil],
      );
      return result.rows.map((row) => ({
        itemId: row.item_id,
        jobId: row.job_id,
        itemReference: row.item_reference,
        status: row.status,
        version: BigInt(row.version),
        attemptCount: row.attempt_count,
        claimedAt: iso(row.claimed_at),
        claimExpiresAt: iso(row.claim_expires_at),
      }));
    },
  };
};
