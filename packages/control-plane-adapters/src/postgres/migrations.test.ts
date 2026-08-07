import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createControlPlaneDatabase,
  type ControlPlaneDatabase,
  type ControlPlaneMigrationDatabase,
  type ControlPlaneQueryResult,
  type ControlPlaneTransaction,
} from './database.ts';
import { inspectControlPlaneSchema, migrateControlPlane, schemaHash } from './migrate.ts';

const migrationUrl = new URL('./migrations/0001_control_plane.sql', import.meta.url);
const invitationMigrationUrl = new URL('./migrations/0004_admin_invitations.sql', import.meta.url);
const governanceMigrationUrl = new URL('./migrations/0005_admin_governance.sql', import.meta.url);
const syntheticIdentity = /(?:^|[-_])(synthetic|test)(?:[-_]|$)/iu;
const productionIdentity = /(?:^|[-_])(live|prod|production)(?:[-_]|$)/iu;
const unsafeDatabaseMessage =
  'Migration proof requires an explicitly synthetic PostgreSQL database identity.';

const requireSyntheticDatabase = (databaseUrl: string): string => {
  try {
    const parsed = new URL(databaseUrl);
    const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//u, ''));
    const identity = [parsed.hostname, parsed.username, databaseName].join('-');
    if (
      (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') ||
      databaseName.length === 0 ||
      productionIdentity.test(identity) ||
      !syntheticIdentity.test(identity)
    ) {
      throw new Error(unsafeDatabaseMessage);
    }
    return databaseUrl;
  } catch {
    throw new Error(unsafeDatabaseMessage);
  }
};

const environment = (
  globalThis as unknown as {
    readonly process?: {
      readonly env?: {
        readonly CI?: string;
        readonly POSTGRES_TEST_STRATEGY?: string;
        readonly TEST_DATABASE_URL?: string;
      };
    };
  }
).process?.env;
const configuredDatabaseUrl = environment?.TEST_DATABASE_URL?.trim();
const harness = Object.freeze(
  configuredDatabaseUrl !== undefined && configuredDatabaseUrl.length > 0
    ? {
        databaseUrl: requireSyntheticDatabase(configuredDatabaseUrl),
        strategy: 'synthetic-url' as const,
      }
    : environment?.POSTGRES_TEST_STRATEGY === 'unit'
      ? { databaseUrl: undefined, strategy: 'unit' as const }
      : environment?.POSTGRES_TEST_STRATEGY === 'testcontainers' ||
          environment?.CI === '1' ||
          environment?.CI === 'true'
        ? { databaseUrl: undefined, strategy: 'testcontainers' as const }
        : { databaseUrl: undefined, strategy: 'unit' as const },
);

class MemoryMigrationDatabase implements ControlPlaneMigrationDatabase {
  checksum: string | undefined;
  migrationApplications = 0;
  failNextApplication = false;

  async query<TRow extends Record<string, unknown> = Record<string, unknown>>(
    statement: string,
    values: readonly unknown[] = [],
  ): Promise<ControlPlaneQueryResult<TRow>> {
    return this.executeAgainst(this, statement, values) as Promise<ControlPlaneQueryResult<TRow>>;
  }

  async transaction<TResult>(
    operation: (transaction: ControlPlaneTransaction) => Promise<TResult>,
  ): Promise<TResult> {
    const staged = new MemoryMigrationDatabase();
    staged.checksum = this.checksum;
    staged.migrationApplications = this.migrationApplications;
    staged.failNextApplication = this.failNextApplication;

    try {
      const result = await operation(staged);
      this.checksum = staged.checksum;
      this.migrationApplications = staged.migrationApplications;
      this.failNextApplication = staged.failNextApplication;
      return result;
    } catch (error) {
      this.failNextApplication = staged.failNextApplication;
      throw error;
    }
  }

  private async executeAgainst(
    state: MemoryMigrationDatabase,
    statement: string,
    values: readonly unknown[],
  ): Promise<ControlPlaneQueryResult<Record<string, unknown>>> {
    const normalized = statement.replace(/\s+/gu, ' ').trim().toLowerCase();
    if (
      normalized.includes('select version, checksum') &&
      normalized.includes('schema_migrations')
    ) {
      const rows =
        state.checksum === undefined
          ? []
          : [{ checksum: state.checksum, version: '0001_control_plane' }];
      return { rowCount: rows.length, rows };
    }

    if (normalized.startsWith('insert into control_plane_schema_migrations')) {
      state.checksum = String(values[1]);
      return { rowCount: 1, rows: [] };
    }

    if (normalized.includes('create table identities')) {
      state.migrationApplications += 1;
      if (state.failNextApplication) {
        state.failNextApplication = false;
        throw new Error('synthetic migration interruption');
      }
    }

    return { rowCount: 0, rows: [] };
  }
}

const resetSyntheticSchema = async (database: ControlPlaneDatabase): Promise<void> => {
  await database.query('DROP SCHEMA public CASCADE');
  await database.query('CREATE SCHEMA public');
};

describe('control-plane migration deterministic proof', () => {
  it('keeps the executable schema checksum bound to the reviewed SQL bytes', async () => {
    const migrationSql = await readFile(migrationUrl, 'utf8');
    const expectedHash = createHash('sha256').update(migrationSql).digest('hex');

    expect(schemaHash).toBe(expectedHash);
    expect(schemaHash).toMatch(/^[a-f0-9]{64}$/u);
  });

  it('applies once, replays idempotently, and rejects checksum drift', async () => {
    const database = new MemoryMigrationDatabase();

    await expect(migrateControlPlane(database)).resolves.toEqual({
      applied: true,
      schemaHash,
      version: '0001_control_plane',
    });
    await expect(migrateControlPlane(database)).resolves.toEqual({
      applied: false,
      schemaHash,
      version: '0001_control_plane',
    });
    expect(database.migrationApplications).toBe(1);

    database.checksum = '0'.repeat(64);
    await expect(migrateControlPlane(database)).rejects.toThrow(/checksum/i);
  });

  it('rolls back an interrupted application and can reapply cleanly', async () => {
    const database = new MemoryMigrationDatabase();
    database.failNextApplication = true;

    await expect(migrateControlPlane(database)).rejects.toThrow(/interruption/i);
    expect(database.checksum).toBeUndefined();
    expect(database.migrationApplications).toBe(0);

    await expect(migrateControlPlane(database)).resolves.toMatchObject({ applied: true });
    expect(database.migrationApplications).toBe(1);
  });

  it('declares every authoritative object and required database invariant', async () => {
    const migrationSql = await readFile(migrationUrl, 'utf8');
    const requiredTables = [
      'identities',
      'sessions',
      'security_factors',
      'recovery_holds',
      'subscriptions',
      'invoices',
      'provider_inbox',
      'outbox_jobs',
      'premium_entitlements',
      'device_bindings',
      'support_cases',
      'case_messages',
      'diagnostic_consents',
      'object_metadata',
      'audit_events',
      'audit_chain_heads',
      'deletion_requests',
    ] as const;

    for (const table of requiredTables) {
      expect(migrationSql).toMatch(new RegExp(`CREATE TABLE ${table}\\b`, 'u'));
    }
    expect(migrationSql).toMatch(
      /CREATE UNIQUE INDEX uq_device_bindings_one_active_per_entitlement[\s\S]*WHERE revoked_at IS NULL/iu,
    );
    expect(migrationSql).toMatch(/UNIQUE \(provider, provider_event_id\)/iu);
    expect(migrationSql).toMatch(/aggregate_version BIGINT/iu);
    expect(migrationSql).toMatch(/sequence_number BIGINT/iu);
    expect(migrationSql).toMatch(/previous_hash CHAR\(64\)/iu);
    expect(migrationSql).toMatch(/event_hash CHAR\(64\)/iu);
    expect(migrationSql).toMatch(/locked_at TIMESTAMPTZ/iu);
    expect(migrationSql).toMatch(/locked_by TEXT/iu);
    expect(migrationSql).toMatch(/consent_scope TEXT/iu);
    expect(migrationSql).toMatch(/scheduled_for TIMESTAMPTZ/iu);
    expect(migrationSql).toMatch(/retain_until TIMESTAMPTZ/iu);
    expect(migrationSql).toMatch(/REVOKE UPDATE, DELETE, TRUNCATE ON audit_events FROM PUBLIC/iu);
    expect(migrationSql).toMatch(/CREATE TRIGGER audit_events_insert_only/iu);
    expect(migrationSql).toMatch(/CREATE TRIGGER audit_events_reject_truncate/iu);

    for (const forbiddenColumn of [
      'raw_serial',
      'full_card_number',
      'bearer_token',
      'password_plaintext',
      'diagnostic_blob',
    ]) {
      expect(migrationSql).not.toMatch(new RegExp(`\\b${forbiddenColumn}\\b`, 'iu'));
    }
  });
});

describe('admin invitation migration authority', () => {
  it('declares the complete durable invitation lifecycle without plaintext identity or secrets', async () => {
    const sql = await readFile(invitationMigrationUrl, 'utf8');
    for (const table of [
      'admin_invitation_capacity',
      'admin_invitations',
      'admin_invitation_secrets',
      'admin_invitation_events',
      'admin_invitation_commands',
      'admin_invitation_jobs',
      'admin_invitation_receipts',
      'admin_invitation_audit',
    ])
      expect(sql).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`, 'iu'));

    expect(sql).toMatch(
      /recipient_digest CHAR\(64\)[\s\S]*CHECK \(recipient_digest ~ '\^\[0-9a-f\]\{64\}\$'\)/iu,
    );
    expect(sql).toMatch(/secret_digest CHAR\(64\)[\s\S]*UNIQUE/iu);
    expect(sql).toMatch(/CHECK \(active_beta_count BETWEEN 0 AND 25\)/iu);
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX[\s\S]*recipient_digest[\s\S]*WHERE status IN \('queued', 'pending'\)/iu,
    );
    expect(sql).toMatch(/CREATE TRIGGER admin_invitation_events_insert_only/iu);
    expect(sql).toMatch(/REVOKE UPDATE, DELETE, TRUNCATE ON admin_invitation_events FROM PUBLIC/iu);
    expect(sql).toMatch(/FOR UPDATE/iu);
    expect(sql).toMatch(/SKIP LOCKED/iu);
    expect(sql).toMatch(/retention_state/iu);
    expect(sql).toMatch(/campaign/iu);
    expect(sql).toMatch(/cohort/iu);
    expect(sql).toMatch(/note_reference/iu);
    expect(sql).not.toMatch(/plaintext_secret|raw_email|invitation_token/iu);
  });

  it('contains an upgrade path that pseudonymizes legacy email and never copies legacy token material', async () => {
    const sql = await readFile(invitationMigrationUrl, 'utf8');
    expect(sql).toMatch(/identity_invitations/iu);
    expect(sql).toMatch(/digest\(lower\(trim\(legacy\.email\)\)/iu);
    expect(sql).toMatch(
      /row_number\(\) OVER \(ORDER BY deduplicated\.issued_at, deduplicated\.id\)/iu,
    );
    expect(sql).toMatch(/active_beta_rank > 25[\s\S]*'queued'/iu);
    expect(sql).toMatch(/active_beta_rank - 25/iu);
    expect(sql).toMatch(/ON CONFLICT DO NOTHING/iu);
    expect(sql).not.toMatch(/legacy\.token_digest/iu);
  });
});

describe('admin governance migration authority', () => {
  it('normalizes membership, function, capability, scope, approval, review, and offboarding truth', async () => {
    const sql = await readFile(governanceMigrationUrl, 'utf8');
    for (const table of [
      'admin_governance_memberships',
      'admin_membership_functions',
      'admin_membership_capabilities',
      'admin_membership_scopes',
      'admin_function_sessions',
      'admin_delegations',
      'admin_permission_impacts',
      'admin_approval_requests',
      'admin_approval_decisions',
      'admin_access_reviews',
      'admin_inactivity_notices',
      'admin_offboarding_events',
      'admin_work_reassignments',
      'admin_audit_reveals',
      'admin_governance_commands',
      'admin_governance_receipts',
      'admin_governance_audit',
    ]) {
      expect(sql).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`, 'iu'));
    }
    expect(sql).toMatch(/uq_admin_function_sessions_one_active[\s\S]*WHERE ended_at IS NULL/iu);
    expect(sql).toMatch(/reject_admin_standing_super_admin/iu);
    expect(sql).toMatch(/reject_admin_self_approval/iu);
    expect(sql).toMatch(/approval\.expires_at <= NEW\.decided_at/iu);
    expect(sql).toMatch(/CHECK \(expires_at > created_at\)/iu);
    expect(sql).toMatch(/CREATE TRIGGER admin_governance_audit_insert_only/iu);
    expect(sql).toMatch(/REVOKE UPDATE, DELETE, TRUNCATE ON admin_governance_audit FROM PUBLIC/iu);
    expect(sql).toMatch(/environment_identity[\s\S]*synthetic-non-production/iu);
  });

  it('upgrades persisted admin identities without adding functions, capabilities, or scopes', async () => {
    const sql = await readFile(governanceMigrationUrl, 'utf8');
    expect(sql).toMatch(/FROM identities AS identity/iu);
    expect(sql).toMatch(/identity\.role IN \('support', 'operations', 'security', 'audit'\)/iu);
    expect(sql).toMatch(/SELECT[\s\S]*identity\.role[\s\S]*FROM identities AS identity/iu);
    expect(sql).not.toMatch(/CROSS JOIN[\s\S]*admin_(?:membership_)?functions/iu);
    expect(sql).not.toMatch(/super-admin|wildcard|all-capabilities/iu);
  });
});

describe.sequential.skipIf(harness.strategy === 'unit')(
  'control-plane migration live PostgreSQL proof',
  () => {
    let container: StartedTestContainer | undefined;
    let database: ControlPlaneDatabase;

    beforeAll(async () => {
      let databaseUrl = harness.databaseUrl;
      if (harness.strategy === 'testcontainers') {
        container = await new GenericContainer('postgres:18-alpine')
          .withEnvironment({
            POSTGRES_DB: 'liiiraa_synthetic_test',
            POSTGRES_PASSWORD: 'synthetic-secret',
            POSTGRES_USER: 'liiiraa_synthetic',
          })
          .withExposedPorts(5432)
          .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/iu))
          .start();
        databaseUrl = `postgresql://liiiraa_synthetic:synthetic-secret@${container.getHost()}:${container.getMappedPort(5432)}/liiiraa_synthetic_test`;
      }

      database = createControlPlaneDatabase(requireSyntheticDatabase(databaseUrl ?? ''));
    }, 120_000);

    afterAll(async () => {
      await database?.close();
      await container?.stop();
    });

    it('migrates fresh and pre-bootstrapped schemas, replays, and exposes the expected hash', async () => {
      await resetSyntheticSchema(database);
      await expect(migrateControlPlane(database)).resolves.toMatchObject({ applied: true });
      await expect(migrateControlPlane(database)).resolves.toMatchObject({ applied: false });

      const freshInspection = await inspectControlPlaneSchema(database);
      expect(freshInspection.schemaHash).toBe(schemaHash);
      expect(freshInspection.tables).toContain('premium_entitlements');

      await resetSyntheticSchema(database);
      await database.query(`
        CREATE TABLE control_plane_schema_migrations (
          version TEXT PRIMARY KEY,
          checksum CHAR(64) NOT NULL,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await expect(migrateControlPlane(database)).resolves.toMatchObject({ applied: true });
      await expect(inspectControlPlaneSchema(database)).resolves.toMatchObject({
        schemaHash,
      });
    });

    it('enforces active-device concurrency and insert-only audit rows', async () => {
      const entitlementId = '00000000-0000-4000-8000-000000000001';
      const identityId = '00000000-0000-4000-8000-000000000002';
      await database.query(
        `INSERT INTO identities (id, email, email_verified_at, version)
         VALUES ($1, 'synthetic@example.invalid', CURRENT_TIMESTAMP, 1)`,
        [identityId],
      );
      await database.query(
        `INSERT INTO premium_entitlements
           (id, identity_id, status, source, valid_from, version)
         VALUES ($1, $2, 'active', 'subscription', CURRENT_TIMESTAMP, 1)`,
        [entitlementId, identityId],
      );

      const insertDevice = (id: string, digest: string) =>
        database.query(
          `INSERT INTO device_bindings
             (id, premium_entitlement_id, device_digest, bound_at, version)
           VALUES ($1, $2, $3, CURRENT_TIMESTAMP, 1)`,
          [id, entitlementId, digest],
        );
      const attempts = await Promise.allSettled([
        insertDevice('00000000-0000-4000-8000-000000000003', 'a'.repeat(64)),
        insertDevice('00000000-0000-4000-8000-000000000004', 'b'.repeat(64)),
      ]);
      expect(attempts.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
      expect(attempts.filter(({ status }) => status === 'rejected')).toHaveLength(1);

      await database.query(
        `INSERT INTO audit_chain_heads (stream_id, last_sequence, last_hash)
         VALUES ('synthetic-stream', 0, $1)`,
        ['0'.repeat(64)],
      );
      await database.query(
        `INSERT INTO audit_events
           (id, stream_id, sequence_number, event_type, actor_kind, previous_hash, event_hash, occurred_at)
         VALUES ($1, 'synthetic-stream', 1, 'synthetic-created', 'system', $2, $3, CURRENT_TIMESTAMP)`,
        ['00000000-0000-4000-8000-000000000005', '0'.repeat(64), '1'.repeat(64)],
      );
      await expect(
        database.query(`UPDATE audit_events SET event_type = 'tampered'`),
      ).rejects.toThrow(/insert-only/i);
      await expect(database.query('DELETE FROM audit_events')).rejects.toThrow(/insert-only/i);
    });

    it('proves provider, version, outbox, consent, deletion, retention, and minimization fields', async () => {
      const inspection = await inspectControlPlaneSchema(database);
      expect(inspection.indexes).toContain('uq_device_bindings_one_active_per_entitlement');
      expect(inspection.triggers).toContain('audit_events_insert_only');
      expect(inspection.columns).toEqual(
        expect.arrayContaining([
          'provider_inbox.provider_event_id',
          'provider_inbox.aggregate_version',
          'outbox_jobs.locked_at',
          'outbox_jobs.locked_by',
          'diagnostic_consents.consent_scope',
          'deletion_requests.scheduled_for',
          'object_metadata.retain_until',
          'audit_events.sequence_number',
          'audit_events.event_hash',
        ]),
      );
      expect(inspection.columns).not.toEqual(
        expect.arrayContaining([
          expect.stringMatching(
            /\.(raw_serial|full_card_number|bearer_token|password_plaintext|diagnostic_blob)$/iu,
          ),
        ]),
      );
      expect(inspection.publicAuditPrivileges).not.toEqual(
        expect.arrayContaining(['UPDATE', 'DELETE', 'TRUNCATE']),
      );
    });
  },
);
