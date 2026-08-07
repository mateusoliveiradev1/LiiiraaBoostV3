import { describe, expect, it, vi } from 'vitest';

import {
  adminGovernanceSchemaHash,
  createPostgresAdminGovernanceRepository,
  migrateAdminGovernance,
} from './admin-governance.js';

const membershipId = '00000000-0000-4000-8000-000000000001';
const identityId = '00000000-0000-4000-8000-000000000002';
const actorId = '00000000-0000-4000-8000-000000000003';

describe('PostgreSQL admin governance authority', () => {
  it('applies migration 0005 once under the shared advisory lock and rejects checksum drift', async () => {
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

    await expect(migrateAdminGovernance(database)).resolves.toEqual({
      applied: true,
      schemaHash: adminGovernanceSchemaHash,
      version: '0005_admin_governance',
    });
    await expect(migrateAdminGovernance(database)).resolves.toMatchObject({ applied: false });
    expect(statements.join('\n')).toContain(
      "pg_advisory_xact_lock(hashtext('liiiraa-boost-control-plane-migrations'))",
    );
    checksum = '0'.repeat(64);
    await expect(migrateAdminGovernance(database)).rejects.toThrow(/checksum/iu);
  });

  it('loads masked normalized membership authority and locks aggregate state before versioned writes', async () => {
    const statements: Array<{ sql: string; values: readonly unknown[] }> = [];
    const query = vi.fn((sql: string, values: readonly unknown[] = []) => {
      statements.push({ sql, values });
      if (sql.includes('FROM admin_governance_memberships AS membership')) {
        return Promise.resolve({
          rowCount: 1,
          rows: [
            {
              id: membershipId,
              identity_id: identityId,
              status: 'active',
              strong_factor: 'passkey',
              version: '1',
              activated_at: '2030-01-01T00:00:00.000Z',
              offboarded_at: null,
              offboarding_reason: null,
            },
          ],
        });
      }
      if (sql.includes('FROM admin_membership_functions')) {
        return Promise.resolve({ rowCount: 1, rows: [{ value: 'support' }] });
      }
      if (sql.includes('FROM admin_membership_capabilities')) {
        return Promise.resolve({
          rowCount: 2,
          rows: [{ value: 'support:reply' }, { value: 'support:view' }],
        });
      }
      if (sql.includes('FROM admin_membership_scopes')) {
        return Promise.resolve({ rowCount: 1, rows: [{ value: 'support-cases' }] });
      }
      return Promise.resolve({ rowCount: 1, rows: [] });
    });
    const database = {
      query,
      transaction: vi.fn((operation: (value: { query: typeof query }) => Promise<unknown>) =>
        operation({ query }),
      ),
    };
    const repository = createPostgresAdminGovernanceRepository(database);

    await expect(repository.loadMembership(identityId)).resolves.toMatchObject({
      identityId,
      functions: ['support'],
      permissions: {
        capabilities: ['support:reply', 'support:view'],
        scopes: ['support-cases'],
      },
    });
    await repository.transaction(identityId, async (transaction) => {
      const membership = await transaction.loadMembership(identityId);
      if (membership === null) throw new Error('membership fixture missing');
      await transaction.saveMembership({
        ...membership,
        functions: ['operations'],
        permissions: {
          functions: ['operations'],
          capabilities: ['device:manage'],
          scopes: ['devices'],
        },
        version: 2n,
      });
    });

    const sql = statements.map(({ sql: statement }) => statement).join('\n');
    expect(sql).toMatch(/admin_governance_memberships[\s\S]*FOR UPDATE/iu);
    expect(sql).toMatch(/WHERE admin_governance_memberships\.version < EXCLUDED\.version/iu);
    expect(sql).toMatch(/admin_membership_functions/iu);
    expect(sql).toMatch(/admin_membership_capabilities/iu);
    expect(sql).toMatch(/admin_membership_scopes/iu);
    expect(sql).not.toMatch(/identities\.email|password_hash|token_digest/iu);
  });

  it('serializes function switch, independent approval, and atomic authority removal', async () => {
    const statements: string[] = [];
    const query = vi.fn((sql: string) => {
      statements.push(sql);
      if (sql.includes('FROM admin_approval_requests')) {
        return Promise.resolve({
          rowCount: 1,
          rows: [
            {
              id: 'approval-1',
              command_id: 'critical-1',
              author_id: identityId,
              beneficiary_id: membershipId,
              capability: 'session:revoke',
              scope: 'sessions',
              risk: 'critical',
              status: 'pending',
              assigned_approver_id: actorId,
              version: '1',
              created_at: '2030-01-01T00:00:00.000Z',
              expires_at: '2030-01-01T00:15:00.000Z',
              cancelled_at: null,
              approver_id: null,
              approved_at: null,
            },
          ],
        });
      }
      return Promise.resolve({ rowCount: 1, rows: [] });
    });
    const database = {
      query,
      transaction: vi.fn((operation: (value: { query: typeof query }) => Promise<unknown>) =>
        operation({ query }),
      ),
    };
    const repository = createPostgresAdminGovernanceRepository(database);

    await repository.transaction(identityId, async (transaction) => {
      const approval = await transaction.loadApproval('approval-1');
      if (approval === null) throw new Error('approval fixture missing');
      await transaction.saveApproval({
        ...approval,
        status: 'approved',
        approverId: actorId,
        approvedAt: '2030-01-01T00:05:00.000Z',
        version: 2n,
      });
      await transaction.saveSession({
        sessionId: 'session-1',
        actorId: identityId,
        activeFunction: 'security',
        navigation: ['security'],
        dataScopes: ['sessions'],
        capabilities: ['session:revoke'],
        simulation: false,
        version: 2n,
      });
      await transaction.revokeSessions(identityId, '2030-01-01T00:05:00.000Z');
      await transaction.revokeDelegations(identityId, '2030-01-01T00:05:00.000Z');
      await transaction.removeFutureApprovals(identityId, '2030-01-01T00:05:00.000Z');
      await transaction.reassignPendingWork(identityId, '2030-01-01T00:05:00.000Z');
      await transaction.appendAudit({
        actorId,
        subjectId: identityId,
        action: 'identity-offboarded',
        reason: 'Compromised credential',
        compromise: true,
        occurredAt: '2030-01-01T00:05:00.000Z',
      });
    });

    const sql = statements.join('\n');
    expect(sql).toMatch(/admin_approval_requests[\s\S]*FOR UPDATE/iu);
    expect(sql).toMatch(/INSERT INTO admin_approval_decisions/iu);
    expect(sql).toMatch(/UPDATE admin_function_sessions[\s\S]*ended_at/iu);
    expect(sql).toMatch(/INSERT INTO admin_function_sessions/iu);
    expect(sql).toMatch(/UPDATE sessions[\s\S]*revoked_at/iu);
    expect(sql).toMatch(/UPDATE admin_delegations/iu);
    expect(sql).toMatch(/UPDATE admin_approval_requests/iu);
    expect(sql).toMatch(/INSERT INTO admin_work_reassignments/iu);
    expect(sql).toMatch(/INSERT INTO admin_offboarding_events/iu);
  });

  it('persists reveal reason and authorization context without diagnostic or audit field values', async () => {
    const statements: Array<{ sql: string; values: readonly unknown[] }> = [];
    const query = vi.fn((sql: string, values: readonly unknown[] = []) => {
      statements.push({ sql, values });
      return Promise.resolve({ rowCount: 1, rows: [{ id: 'audit-1' }] });
    });
    const database = {
      query,
      transaction: vi.fn((operation: (value: { query: typeof query }) => Promise<unknown>) =>
        operation({ query }),
      ),
    };
    const repository = createPostgresAdminGovernanceRepository(database);

    await repository.transaction('audit:1', async (transaction) => {
      await transaction.appendAudit({
        eventId: '00000000-0000-4000-8000-000000000004',
        actorId,
        subjectId: 'audit:1',
        action: 'audit-revealed',
        reason: 'Investigate chain discrepancy',
        authorizationContextId: 'context-reveal-1',
        occurredAt: '2030-01-01T00:00:00.000Z',
      });
    });

    expect(statements.some(({ sql }) => sql.includes('admin_governance_audit'))).toBe(true);
    expect(statements.some(({ sql }) => sql.includes('admin_audit_reveals'))).toBe(true);
    expect(JSON.stringify(statements)).toContain('Investigate chain discrepancy');
    expect(JSON.stringify(statements)).toContain('context-reveal-1');
    expect(JSON.stringify(statements)).not.toMatch(/sensitive-value|diagnostic_blob|raw_value/iu);
  });
});
