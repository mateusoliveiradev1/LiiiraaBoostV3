import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import type { ControlPlaneMigrationDatabase } from './database.ts';

const migrationVersion = '0001_control_plane';
const migrationUrl = new URL('./migrations/0001_control_plane.sql', import.meta.url);
const migrationSql = readFileSync(migrationUrl, 'utf8');
const migrationTableSql = `
  CREATE TABLE IF NOT EXISTS control_plane_schema_migrations (
    version TEXT PRIMARY KEY,
    checksum CHAR(64) NOT NULL CHECK (checksum ~ '^[0-9a-f]{64}$'),
    applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`;

export const schemaHash = createHash('sha256').update(migrationSql).digest('hex');

export interface ControlPlaneMigrationResult {
  readonly applied: boolean;
  readonly schemaHash: string;
  readonly version: string;
}

export interface ControlPlaneSchemaInspection {
  readonly columns: readonly string[];
  readonly indexes: readonly string[];
  readonly publicAuditPrivileges: readonly string[];
  readonly schemaHash: string | undefined;
  readonly tables: readonly string[];
  readonly triggers: readonly string[];
}

export const migrateControlPlane = async (
  database: ControlPlaneMigrationDatabase,
): Promise<ControlPlaneMigrationResult> => {
  await database.query(migrationTableSql);

  return database.transaction(async (transaction) => {
    await transaction.query(
      `SELECT pg_advisory_xact_lock(hashtext('liiiraa-boost-control-plane-migrations'))`,
    );
    const existing = await transaction.query<{ checksum: string; version: string }>(
      `SELECT version, checksum
       FROM control_plane_schema_migrations
       WHERE version = $1`,
      [migrationVersion],
    );
    const applied = existing.rows[0];
    if (applied !== undefined) {
      if (applied.checksum !== schemaHash) {
        throw new Error(`Migration ${migrationVersion} checksum does not match reviewed SQL.`);
      }
      return Object.freeze({
        applied: false,
        schemaHash,
        version: migrationVersion,
      });
    }

    await transaction.query(migrationSql);
    await transaction.query(
      `INSERT INTO control_plane_schema_migrations (version, checksum)
       VALUES ($1, $2)`,
      [migrationVersion, schemaHash],
    );

    return Object.freeze({
      applied: true,
      schemaHash,
      version: migrationVersion,
    });
  });
};

export const inspectControlPlaneSchema = async (
  database: ControlPlaneMigrationDatabase,
): Promise<ControlPlaneSchemaInspection> => {
  const [migration, tableRows, columnRows, indexRows, triggerRows, privilegeRows] =
    await Promise.all([
      database.query<{ checksum: string }>(
        `SELECT checksum
         FROM control_plane_schema_migrations
         WHERE version = $1`,
        [migrationVersion],
      ),
      database.query<{ table_name: string }>(
        `SELECT tablename AS table_name
         FROM pg_catalog.pg_tables
         WHERE schemaname = current_schema()
         ORDER BY tablename`,
      ),
      database.query<{ column_name: string; table_name: string }>(
        `SELECT table_name, column_name
         FROM information_schema.columns
         WHERE table_schema = current_schema()
         ORDER BY table_name, ordinal_position`,
      ),
      database.query<{ index_name: string }>(
        `SELECT indexname AS index_name
         FROM pg_catalog.pg_indexes
         WHERE schemaname = current_schema()
         ORDER BY indexname`,
      ),
      database.query<{ trigger_name: string }>(
        `SELECT trigger.tgname AS trigger_name
         FROM pg_catalog.pg_trigger AS trigger
         INNER JOIN pg_catalog.pg_class AS relation ON relation.oid = trigger.tgrelid
         INNER JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
         WHERE namespace.nspname = current_schema()
           AND NOT trigger.tgisinternal
         ORDER BY trigger.tgname`,
      ),
      database.query<{ privilege_type: string }>(
        `SELECT privilege_type
         FROM information_schema.role_table_grants
         WHERE table_schema = current_schema()
           AND table_name = 'audit_events'
           AND grantee = 'PUBLIC'
         ORDER BY privilege_type`,
      ),
    ]);

  return Object.freeze({
    columns: Object.freeze(
      columnRows.rows.map(({ column_name, table_name }) => `${table_name}.${column_name}`),
    ),
    indexes: Object.freeze(indexRows.rows.map(({ index_name }) => index_name)),
    publicAuditPrivileges: Object.freeze(
      privilegeRows.rows.map(({ privilege_type }) => privilege_type),
    ),
    schemaHash: migration.rows[0]?.checksum,
    tables: Object.freeze(tableRows.rows.map(({ table_name }) => table_name)),
    triggers: Object.freeze(triggerRows.rows.map(({ trigger_name }) => trigger_name)),
  });
};
