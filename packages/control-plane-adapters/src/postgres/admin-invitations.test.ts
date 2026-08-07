import { describe, expect, it, vi } from 'vitest';

import {
  adminInvitationsSchemaHash,
  createPostgresAdminInvitationRepository,
  migrateAdminInvitations,
} from './admin-invitations.js';

describe('PostgreSQL admin invitation authority', () => {
  it('applies 0004 once under the shared migration lock and rejects checksum drift', async () => {
    const statements: string[] = [];
    let checksum: string | undefined;
    const transaction = {
      query: vi.fn((statement: string, values: readonly unknown[] = []) => {
        statements.push(statement);
        if (statement.includes('SELECT checksum'))
          return Promise.resolve({
            rowCount: checksum === undefined ? 0 : 1,
            rows: checksum === undefined ? [] : [{ checksum }],
          });
        if (statement.includes('INSERT INTO control_plane_schema_migrations'))
          checksum = String(values[1]);
        return Promise.resolve({ rowCount: 1, rows: [] });
      }),
    };
    const database = {
      query: vi.fn(),
      transaction: vi.fn((operation: (value: typeof transaction) => Promise<unknown>) =>
        operation(transaction),
      ),
    };

    await expect(migrateAdminInvitations(database)).resolves.toEqual({
      applied: true,
      schemaHash: adminInvitationsSchemaHash,
      version: '0004_admin_invitations',
    });
    await expect(migrateAdminInvitations(database)).resolves.toMatchObject({ applied: false });
    expect(statements.join('\n')).toContain(
      "pg_advisory_xact_lock(hashtext('liiiraa-boost-control-plane-migrations'))",
    );
    expect(statements.join('\n')).toContain('admin_invitation_capacity');
    checksum = '0'.repeat(64);
    await expect(migrateAdminInvitations(database)).rejects.toThrow(/checksum/iu);
  });

  it('locks capacity and aggregate state while persisting only recipient and secret digests', async () => {
    const statements: Array<{ sql: string; values: readonly unknown[] }> = [];
    const query = vi.fn((sql: string, values: readonly unknown[] = []) => {
      statements.push({ sql, values });
      if (sql.includes('active_beta_count'))
        return Promise.resolve({ rowCount: 1, rows: [{ active_beta_count: 24 }] });
      if (sql.includes('MAX(queue_position)'))
        return Promise.resolve({ rowCount: 1, rows: [{ next_position: 7 }] });
      if (sql.includes('FROM admin_invitations') && sql.includes('recipient_digest'))
        return Promise.resolve({ rowCount: 0, rows: [] });
      return Promise.resolve({ rowCount: 1, rows: [] });
    });
    const database = {
      query,
      transaction: vi.fn((operation: (value: { query: typeof query }) => Promise<unknown>) =>
        operation({ query }),
      ),
    };
    const repository = createPostgresAdminInvitationRepository(database);

    await repository.transaction(async (authority) => {
      await expect(authority.countActiveBetaInvitations('2030-01-01T00:00:00.000Z')).resolves.toBe(
        24,
      );
      await expect(authority.nextQueuePosition()).resolves.toBe(7);
      await authority.saveInvitation({
        kind: 'beta',
        invitationId: '00000000-0000-4000-8000-000000000001',
        recipientKey: 'a'.repeat(64),
        locale: 'pt-BR',
        version: 1n,
        status: 'pending',
        reminderCount: 0,
        reminderWindowStartedAt: '2030-01-01T00:00:00.000Z',
        createdAt: '2030-01-01T00:00:00.000Z',
        updatedAt: '2030-01-01T00:00:00.000Z',
        expiresAt: '2030-01-15T00:00:00.000Z',
        events: [{ kind: 'sent', at: '2030-01-01T00:00:00.000Z' }],
      });
      await authority.saveSecretDigest('00000000-0000-4000-8000-000000000001', 'b'.repeat(64));
    });

    expect(
      statements.some(({ sql }) => /admin_invitation_capacity[\s\S]*FOR UPDATE/iu.test(sql)),
    ).toBe(true);
    expect(JSON.stringify(statements)).not.toMatch(/plaintext|alice@|invitation_token/iu);
    expect(statements.some(({ sql }) => sql.includes('ON CONFLICT (id) DO UPDATE'))).toBe(true);
  });

  it('claims jobs with SKIP LOCKED and pseudonymizes only closed invitations', async () => {
    const statements: string[] = [];
    const query = vi.fn((sql: string) => {
      statements.push(sql);
      const claimedJob = sql.includes('RETURNING job.*');
      return Promise.resolve({
        rowCount: claimedJob || sql.includes('RETURNING id') ? 1 : 0,
        rows: claimedJob
          ? [
              {
                id: 'job-1',
                command_id: 'command-1',
                action: 'resend',
                status: 'running',
                items: [],
                created_at: '2030-01-01T00:00:00.000Z',
              },
            ]
          : [],
      });
    });
    const database = {
      query,
      transaction: vi.fn((operation: (value: { query: typeof query }) => Promise<unknown>) =>
        operation({ query }),
      ),
    };
    const repository = createPostgresAdminInvitationRepository(database);

    await expect(repository.claimJobs('worker-1', 10)).resolves.toEqual([
      expect.objectContaining({ jobId: 'job-1', status: 'running' }),
    ]);
    await repository.pseudonymizeClosedRecipient(
      '00000000-0000-4000-8000-000000000001',
      'c'.repeat(64),
      '2030-02-01T00:00:00.000Z',
    );
    expect(statements.join('\n')).toMatch(/FOR UPDATE SKIP LOCKED/iu);
    expect(statements.join('\n')).toMatch(/status NOT IN \('queued', 'pending'\)/iu);
    expect(statements.join('\n')).toContain("retention_state = 'pseudonymized'");
  });
});
