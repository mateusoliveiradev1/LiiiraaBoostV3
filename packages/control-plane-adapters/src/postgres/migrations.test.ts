import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createPostgresHarness,
  requireSyntheticDatabase,
} from '../../../../apps/api/src/testing/postgres.ts';
import {
  createControlPlaneDatabase,
  type ControlPlaneDatabase,
  type ControlPlaneQueryResult,
} from './database.ts';
import {
  inspectControlPlaneSchema,
  migrateControlPlane,
  schemaHash,
} from './migrate.ts';

const migrationUrl = new URL('./migrations/0001_control_plane.sql', import.meta.url);
const harness = createPostgresHarness();

class MemoryMigrationDatabase implements ControlPlaneDatabase {
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
    operation: (transaction: ControlPlaneDatabase) => Promise<TResult>,
  ): Promise<TResult> {
    const staged = new MemoryMigrationDatabase();
    staged.checksum = this.checksum;
    staged.migrationApplications = this.migrationApplications;
    staged.failNextApplication = this.failNextApplication;

    const result = await operation(staged);
    this.checksum = staged.checksum;
    this.migrationApplications = staged.migrationApplications;
    this.failNextApplication = staged.failNextApplication;
    return result;
  }

  async close(): Promise<void> {}

  private async executeAgainst(
    state: MemoryMigrationDatabase,
    statement: string,
    values: readonly unknown[],
  ): Promise<ControlPlaneQueryResult<Record<string, unknown>>> {
    const normalized = statement.replace(/\s+/gu, ' ').trim().toLowerCase();
    if (normalized.includes('select checksum') && normalized.includes('schema_migrations')) {
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
    expect(migrationSql).toMatch(
      /REVOKE UPDATE, DELETE, TRUNCATE ON audit_events FROM PUBLIC/iu,
    );
    expect(migrationSql).toMatch(/CREATE TRIGGER audit_events_insert_only/iu);

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
        [
          '00000000-0000-4000-8000-000000000005',
          '0'.repeat(64),
          '1'.repeat(64),
        ],
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
