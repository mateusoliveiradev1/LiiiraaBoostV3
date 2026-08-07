import { describe, expect, it, vi } from 'vitest';

import {
  adminAuthorityGrantsSchemaHash,
  migrateAdminAuthorityGrants,
} from './admin-authority-grants.js';

describe('PostgreSQL Admin authority grant catalog', () => {
  it('applies migration 0008 once under the shared advisory lock and rejects checksum drift', async () => {
    const statements: string[] = [];
    let checksum: string | undefined;
    const transaction = {
      query: vi.fn((sql: string, values: readonly unknown[] = []) => {
        statements.push(sql);
        if (sql.includes('SELECT checksum')) {
          return Promise.resolve({
            rowCount: checksum === undefined ? 0 : 1,
            rows: checksum === undefined ? [] : [{ checksum }],
          });
        }
        if (sql.includes('INSERT INTO control_plane_schema_migrations')) {
          checksum = String(values[1]);
        }
        return Promise.resolve({ rowCount: 1, rows: [] });
      }),
    };
    const database = {
      query: vi.fn(),
      transaction: vi.fn((operation: (value: typeof transaction) => Promise<unknown>) =>
        operation(transaction),
      ),
    };

    await expect(migrateAdminAuthorityGrants(database)).resolves.toEqual({
      applied: true,
      schemaHash: adminAuthorityGrantsSchemaHash,
      version: '0008_admin_authority_grants',
    });
    await expect(migrateAdminAuthorityGrants(database)).resolves.toMatchObject({ applied: false });
    expect(statements.join('\n')).toContain(
      "pg_advisory_xact_lock(hashtext('liiiraa-boost-control-plane-migrations'))",
    );
    checksum = '0'.repeat(64);
    await expect(migrateAdminAuthorityGrants(database)).rejects.toThrow(/checksum/iu);
  });
});
