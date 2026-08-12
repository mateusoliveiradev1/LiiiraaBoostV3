import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import type { ControlPlaneMigrationDatabase } from './database.ts';

const migrationVersion = '0009_admin_self_service_grants';
const migrationSql = readFileSync(
  new URL('./migrations/0009_admin_self_service_grants.sql', import.meta.url),
  'utf8',
);

export const adminSelfServiceGrantsSchemaHash = createHash('sha256')
  .update(migrationSql)
  .digest('hex');

export const migrateAdminSelfServiceGrants = async (
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
      if (existing.rows[0].checksum !== adminSelfServiceGrantsSchemaHash) {
        throw new Error(`Migration ${migrationVersion} checksum does not match reviewed SQL.`);
      }
      return {
        applied: false,
        schemaHash: adminSelfServiceGrantsSchemaHash,
        version: migrationVersion,
      };
    }
    await transaction.query(migrationSql);
    await transaction.query(
      `INSERT INTO control_plane_schema_migrations (version, checksum) VALUES ($1, $2)`,
      [migrationVersion, adminSelfServiceGrantsSchemaHash],
    );
    return {
      applied: true,
      schemaHash: adminSelfServiceGrantsSchemaHash,
      version: migrationVersion,
    };
  });
