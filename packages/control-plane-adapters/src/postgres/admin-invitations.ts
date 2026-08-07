import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

import type {
  AdminInvitationAuditRecord,
  AdminInvitationCommandResult,
  AdminInvitationReceipt,
  AdminInvitationRepositoryPort,
  AdminInvitationTransaction,
  InvitationBatchJob,
  InvitationLifecycleRecord,
  InvitationOutboxRecord,
} from '@liiiraa/control-plane-application';
import type {
  AdministrativeTeamInvitationState,
  BetaInvitationEvent,
  BetaInvitationState,
  InvitationState,
} from '@liiiraa/control-plane-domain';

import type { ControlPlaneMigrationDatabase, ControlPlaneTransaction } from './database.ts';

const migrationVersion = '0004_admin_invitations';
const migrationSql = readFileSync(
  new URL('./migrations/0004_admin_invitations.sql', import.meta.url),
  'utf8',
);
export const adminInvitationsSchemaHash = createHash('sha256').update(migrationSql).digest('hex');

const encode = (value: unknown): string =>
  JSON.stringify(value, (_key, item: unknown) => (typeof item === 'bigint' ? String(item) : item));

const decode = (value: unknown): unknown => {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  return JSON.parse(serialized, (key, item: unknown) =>
    (key === 'version' || key === 'invitationVersion') &&
    typeof item === 'string' &&
    /^(?:0|[1-9][0-9]*)$/u.test(item)
      ? BigInt(item)
      : item,
  );
};

export const migrateAdminInvitations = async (
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
      if (applied.checksum !== adminInvitationsSchemaHash)
        throw new Error(`Migration ${migrationVersion} checksum does not match reviewed SQL.`);
      return { applied: false, schemaHash: adminInvitationsSchemaHash, version: migrationVersion };
    }
    await transaction.query(migrationSql);
    await transaction.query(
      `INSERT INTO control_plane_schema_migrations (version, checksum) VALUES ($1, $2)`,
      [migrationVersion, adminInvitationsSchemaHash],
    );
    return { applied: true, schemaHash: adminInvitationsSchemaHash, version: migrationVersion };
  });

interface InvitationRow extends Record<string, unknown> {
  readonly id: string;
  readonly kind: 'beta' | 'administrative-team';
  readonly recipient_digest: string;
  readonly status: string;
  readonly version: string | number | bigint;
  readonly locale: string;
  readonly campaign: string | null;
  readonly cohort: string | null;
  readonly note_reference: string | null;
  readonly queue_position: string | number | null;
  readonly expires_at: string | Date | null;
  readonly reminder_count: number;
  readonly reminder_window_started_at: string | Date;
  readonly administrative_role: string | null;
  readonly account_reference: string | null;
  readonly closed_at: string | Date | null;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
}

const iso = (value: string | Date): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const loadEvents = async (
  transaction: ControlPlaneTransaction,
  invitationId: string,
): Promise<readonly BetaInvitationEvent[]> => {
  const result = await transaction.query<{
    event_kind: BetaInvitationEvent['kind'];
    occurred_at: string | Date;
  }>(
    `SELECT event_kind, occurred_at FROM admin_invitation_events WHERE invitation_id = $1 ORDER BY sequence_number`,
    [invitationId],
  );
  return result.rows.map(({ event_kind, occurred_at }) => ({
    kind: event_kind,
    at: iso(occurred_at),
  }));
};

const projectInvitation = async (
  transaction: ControlPlaneTransaction,
  row: InvitationRow,
): Promise<InvitationState> => {
  if (row.kind === 'administrative-team') {
    return {
      kind: 'administrative-team',
      invitationId: row.id,
      recipientKey: row.recipient_digest,
      role: row.administrative_role ?? 'support',
      status: row.status as AdministrativeTeamInvitationState['status'],
      version: BigInt(row.version),
      createdAt: iso(row.created_at),
      updatedAt: iso(row.updated_at),
    };
  }
  return {
    kind: 'beta',
    invitationId: row.id,
    recipientKey: row.recipient_digest,
    locale: row.locale,
    version: BigInt(row.version),
    status: row.status as BetaInvitationState['status'],
    reminderCount: row.reminder_count,
    reminderWindowStartedAt: iso(row.reminder_window_started_at),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    events: await loadEvents(transaction, row.id),
    ...(row.campaign === null ? {} : { campaign: row.campaign }),
    ...(row.cohort === null ? {} : { cohort: row.cohort }),
    ...(row.note_reference === null ? {} : { noteReference: row.note_reference }),
    ...(row.queue_position === null ? {} : { queuePosition: Number(row.queue_position) }),
    ...(row.expires_at === null ? {} : { expiresAt: iso(row.expires_at) }),
    ...(row.closed_at === null ? {} : { closedAt: iso(row.closed_at) }),
    ...(row.account_reference === null ? {} : { accountReference: row.account_reference }),
  };
};

const loadInvitation = async (
  transaction: ControlPlaneTransaction,
  invitationId: string,
): Promise<InvitationState | null> => {
  const result = await transaction.query<InvitationRow>(
    `SELECT * FROM admin_invitations WHERE id = $1 FOR UPDATE`,
    [invitationId],
  );
  return result.rows[0] === undefined ? null : projectInvitation(transaction, result.rows[0]);
};

const saveInvitation = async (
  transaction: ControlPlaneTransaction,
  state: BetaInvitationState,
): Promise<void> => {
  await transaction.query(
    `INSERT INTO admin_invitations
       (id, kind, recipient_digest, status, version, locale, campaign, cohort, note_reference, queue_position, expires_at,
        reminder_count, reminder_window_started_at, delivery_state, account_reference, closed_at, retention_state, created_at, updated_at)
     VALUES ($1, 'beta', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'not-requested', $13, $14, 'operational', $15, $16)
     ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, version = EXCLUDED.version, locale = EXCLUDED.locale,
       campaign = EXCLUDED.campaign, cohort = EXCLUDED.cohort, note_reference = EXCLUDED.note_reference,
       queue_position = EXCLUDED.queue_position, expires_at = EXCLUDED.expires_at, reminder_count = EXCLUDED.reminder_count,
       reminder_window_started_at = EXCLUDED.reminder_window_started_at, account_reference = EXCLUDED.account_reference,
       closed_at = EXCLUDED.closed_at, updated_at = EXCLUDED.updated_at
     WHERE admin_invitations.version < EXCLUDED.version`,
    [
      state.invitationId,
      state.recipientKey,
      state.status,
      state.version.toString(),
      state.locale,
      state.campaign ?? null,
      state.cohort ?? null,
      state.noteReference ?? null,
      state.queuePosition ?? null,
      state.expiresAt ?? null,
      state.reminderCount,
      state.reminderWindowStartedAt,
      state.accountReference ?? null,
      state.closedAt ?? null,
      state.createdAt,
      state.updatedAt,
    ],
  );
};

const transactionPort = (transaction: ControlPlaneTransaction): AdminInvitationTransaction => ({
  findCommandResult: async (commandKey) => {
    const result = await transaction.query<{ result: unknown }>(
      `SELECT result FROM admin_invitation_commands WHERE command_key = $1`,
      [commandKey],
    );
    return result.rows[0] === undefined
      ? null
      : (decode(result.rows[0].result) as AdminInvitationCommandResult);
  },
  rememberCommandResult: async (commandKey, result) => {
    await transaction.query(
      `INSERT INTO admin_invitation_commands (command_key, result) VALUES ($1, $2::jsonb) ON CONFLICT (command_key) DO NOTHING`,
      [commandKey, encode(result)],
    );
  },
  findActiveRecipient: async (recipientKey) => {
    const result = await transaction.query<InvitationRow>(
      `SELECT * FROM admin_invitations WHERE recipient_digest = $1 AND status IN ('queued', 'pending') FOR UPDATE`,
      [recipientKey],
    );
    return result.rows[0] === undefined ? null : projectInvitation(transaction, result.rows[0]);
  },
  countActiveBetaInvitations: async () => {
    const result = await transaction.query<{ active_beta_count: number }>(
      `SELECT active_beta_count FROM admin_invitation_capacity WHERE singleton = TRUE FOR UPDATE`,
    );
    return result.rows[0]?.active_beta_count ?? 0;
  },
  nextQueuePosition: async () => {
    const result = await transaction.query<{ next_position: string | number }>(
      `SELECT COALESCE(MAX(queue_position), 0) + 1 AS next_position FROM admin_invitations WHERE status = 'queued'`,
    );
    return Number(result.rows[0]?.next_position ?? 1);
  },
  loadInvitation: (invitationId) => loadInvitation(transaction, invitationId),
  saveInvitation: (state) => saveInvitation(transaction, state),
  invalidateSecretDigest: async (invitationId) => {
    await transaction.query(
      `UPDATE admin_invitation_secrets SET invalidated_at = CURRENT_TIMESTAMP WHERE invitation_id = $1 AND invalidated_at IS NULL AND consumed_at IS NULL`,
      [invitationId],
    );
  },
  saveSecretDigest: async (invitationId, digest) => {
    await transaction.query(
      `INSERT INTO admin_invitation_secrets (id, invitation_id, secret_digest, issued_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
      [randomUUID(), invitationId, digest],
    );
  },
  verifySecretDigest: async (invitationId, digest) => {
    const result = await transaction.query(
      `SELECT invitation_id FROM admin_invitation_secrets WHERE invitation_id = $1 AND secret_digest = $2 AND invalidated_at IS NULL AND consumed_at IS NULL FOR UPDATE`,
      [invitationId, digest],
    );
    return result.rowCount === 1;
  },
  appendLifecycleEvent: async (record: InvitationLifecycleRecord) => {
    await transaction.query(
      `INSERT INTO admin_invitation_events (invitation_id, sequence_number, invitation_version, event_kind, occurred_at)
      SELECT $1, COALESCE(MAX(sequence_number), 0) + 1, $2, $3, $4 FROM admin_invitation_events WHERE invitation_id = $1 ON CONFLICT DO NOTHING`,
      [record.invitationId, record.version.toString(), record.event.kind, record.event.at],
    );
  },
  appendAudit: async (record: AdminInvitationAuditRecord) => {
    await transaction.query(
      `INSERT INTO admin_invitation_audit (id, actor_digest, action, command_id, redacted_target, occurred_at) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        randomUUID(),
        createHash('sha256').update(record.actorId).digest('hex'),
        record.action,
        record.commandId,
        record.redactedTarget,
        record.occurredAt,
      ],
    );
  },
  enqueueOutbox: async (record: InvitationOutboxRecord) => {
    await transaction.query(
      `INSERT INTO outbox_jobs (id, topic, aggregate_type, aggregate_id, aggregate_version, payload, available_at)
      VALUES ($1, $2, 'admin-invitation', $3, 0, $4::jsonb, $5) ON CONFLICT (id) DO NOTHING`,
      [
        record.outboxId,
        record.topic,
        record.aggregateId,
        encode(record.payload),
        record.availableAt,
      ],
    );
  },
  saveJob: async (job: InvitationBatchJob) => {
    await transaction.query(
      `INSERT INTO admin_invitation_jobs (id, command_id, action, status, items, progress, created_at)
      VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7) ON CONFLICT (command_id) DO NOTHING`,
      [
        job.jobId,
        job.commandId,
        job.action,
        job.status,
        encode(job.items),
        encode(job.items),
        job.createdAt,
      ],
    );
  },
  saveReceipt: async (receipt: AdminInvitationReceipt) => {
    await transaction.query(
      `INSERT INTO admin_invitation_receipts (id, command_id, idempotency_key, aggregate_id, outcome, results, occurred_at)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7) ON CONFLICT (command_id) DO NOTHING`,
      [
        receipt.receiptId,
        receipt.commandId,
        receipt.idempotencyKey,
        receipt.aggregateId,
        receipt.outcome,
        encode(receipt.results ?? null),
        receipt.occurredAt,
      ],
    );
  },
  consumeInvitationAndActivateAccount: async (input) => {
    const result = await transaction.query(
      `WITH consumed AS (
      UPDATE admin_invitation_secrets SET consumed_at = $4 WHERE invitation_id = $1 AND secret_digest = $2
        AND invalidated_at IS NULL AND consumed_at IS NULL RETURNING invitation_id)
      UPDATE admin_invitations AS invitation SET status = 'accepted', account_reference = $3, closed_at = $4, updated_at = $4
      FROM consumed WHERE invitation.id = consumed.invitation_id AND invitation.status = 'pending' RETURNING invitation.id`,
      [input.invitationId, input.secretDigest, input.accountReference, input.activatedAt],
    );
    return result.rowCount === 1;
  },
});

const rowToJob = (row: Readonly<Record<string, unknown>>): InvitationBatchJob => ({
  jobId: String(row['id']),
  commandId: String(row['command_id']),
  action: row['action'] as InvitationBatchJob['action'],
  status: row['status'] as InvitationBatchJob['status'],
  items: decode(row['items']) as InvitationBatchJob['items'],
  createdAt: iso(row['created_at'] as string | Date),
});

export const createPostgresAdminInvitationRepository = (
  database: ControlPlaneMigrationDatabase,
): AdminInvitationRepositoryPort => ({
  findActiveRecipientKeys: async (recipientKeys) => {
    if (recipientKeys.length === 0) return [];
    const result = await database.query<{ recipient_digest: string }>(
      `SELECT recipient_digest FROM admin_invitations WHERE recipient_digest = ANY($1::text[]) AND status IN ('queued', 'pending')`,
      [recipientKeys],
    );
    return result.rows.map(({ recipient_digest }) => recipient_digest);
  },
  transaction: (operation) =>
    database.transaction((transaction) => operation(transactionPort(transaction))),
  claimJobs: (workerId, limit) =>
    database.transaction(async (transaction) => {
      const result = await transaction.query(
        `WITH candidates AS (
      SELECT id FROM admin_invitation_jobs WHERE status = 'queued' AND available_at <= CURRENT_TIMESTAMP
      ORDER BY available_at, id FOR UPDATE SKIP LOCKED LIMIT $2)
      UPDATE admin_invitation_jobs AS job SET status = 'running', locked_at = CURRENT_TIMESTAMP, locked_by = $1
      FROM candidates WHERE job.id = candidates.id RETURNING job.*`,
        [workerId, Math.max(1, Math.min(limit, 100))],
      );
      return result.rows.map(rowToJob);
    }),
  pseudonymizeClosedRecipient: async (invitationId, pseudonymDigest, occurredAt) => {
    const result = await database.query(
      `UPDATE admin_invitations SET recipient_digest = $2, retention_state = 'pseudonymized',
      updated_at = $3, note_reference = NULL WHERE id = $1 AND status NOT IN ('queued', 'pending') RETURNING id`,
      [invitationId, pseudonymDigest, occurredAt],
    );
    return result.rowCount === 1;
  },
});
