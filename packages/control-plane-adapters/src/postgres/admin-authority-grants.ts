import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import type { ControlPlaneMigrationDatabase } from './database.ts';

const migrationVersion = '0008_admin_authority_grants';
const migrationSql = readFileSync(
  new URL('./migrations/0008_admin_authority_grants.sql', import.meta.url),
  'utf8',
);

export const adminAuthorityGrantsSchemaHash = createHash('sha256')
  .update(migrationSql)
  .digest('hex');

export const migrateAdminAuthorityGrants = async (
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
      if (existing.rows[0].checksum !== adminAuthorityGrantsSchemaHash) {
        throw new Error(`Migration ${migrationVersion} checksum does not match reviewed SQL.`);
      }
      return {
        applied: false,
        schemaHash: adminAuthorityGrantsSchemaHash,
        version: migrationVersion,
      };
    }
    await transaction.query(migrationSql);
    await transaction.query(
      `INSERT INTO control_plane_schema_migrations (version, checksum) VALUES ($1, $2)`,
      [migrationVersion, adminAuthorityGrantsSchemaHash],
    );
    return {
      applied: true,
      schemaHash: adminAuthorityGrantsSchemaHash,
      version: migrationVersion,
    };
  });
