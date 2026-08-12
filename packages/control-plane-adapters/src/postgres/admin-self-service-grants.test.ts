import { describe, expect, it, vi } from 'vitest';

import {
  adminSelfServiceGrantsSchemaHash,
  migrateAdminSelfServiceGrants,
} from './admin-self-service-grants.js';

describe('PostgreSQL Admin self-service grant catalog', () => {
  it('applies migration 0009 once and rejects checksum drift', async () => {
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

    await expect(migrateAdminSelfServiceGrants(database)).resolves.toEqual({
      applied: true,
      schemaHash: adminSelfServiceGrantsSchemaHash,
      version: '0009_admin_self_service_grants',
    });
    await expect(migrateAdminSelfServiceGrants(database)).resolves.toMatchObject({
      applied: false,
    });
    expect(statements.join('\n')).toContain("'admin-function:switch-self'");
    expect(statements.join('\n')).toContain("'invitations'");
    checksum = '0'.repeat(64);
    await expect(migrateAdminSelfServiceGrants(database)).rejects.toThrow(/checksum/iu);
  });
});
