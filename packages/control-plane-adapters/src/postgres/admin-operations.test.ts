import { describe, expect, it, vi } from 'vitest';

import {
  adminOperationsSchemaHash,
  createPostgresAdminOperationsRepository,
  createPostgresAdminOperationsWorker,
  migrateAdminOperations,
} from './admin-operations.js';

const environment = 'staging' as const;
const environmentId = '00000000-0000-4000-8000-000000000006';
const now = '2030-01-01T00:00:00.000Z';

describe('PostgreSQL admin operations authority', () => {
  it('applies migration 0006 once under the shared advisory lock and rejects checksum drift', async () => {
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

    await expect(migrateAdminOperations(database)).resolves.toEqual({
      applied: true,
      schemaHash: adminOperationsSchemaHash,
      version: '0006_admin_operations',
    });
    await expect(migrateAdminOperations(database)).resolves.toMatchObject({ applied: false });
    expect(statements.join('\n')).toContain(
      "pg_advisory_xact_lock(hashtext('liiiraa-boost-control-plane-migrations'))",
    );
    checksum = '0'.repeat(64);
    await expect(migrateAdminOperations(database)).rejects.toThrow(/checksum/iu);
  });

  it('filters environment, scope, and owner before matching and returns masked stable search rows', async () => {
    const statements: Array<{ sql: string; values: readonly unknown[] }> = [];
    const query = vi.fn((sql: string, values: readonly unknown[] = []) => {
      statements.push({ sql, values });
      return Promise.resolve({
        rowCount: 1,
        rows: [
          {
            record_id: 'case-1',
            scope: 'support-cases',
            owner_id: 'operator-1',
            masked_title: 'Case •••1',
          },
        ],
      });
    });
    const repository = createPostgresAdminOperationsRepository(
      { query, transaction: vi.fn() },
      { environment, environmentId },
    );

    await expect(
      repository.search({
        query: 'case',
        environment,
        allowedScopes: ['support-cases'],
        ownerId: 'operator-1',
        view: { kind: 'personal', viewId: 'mine' },
      }),
    ).resolves.toEqual([
      {
        recordId: 'case-1',
        scope: 'support-cases',
        ownerId: 'operator-1',
        maskedTitle: 'Case •••1',
      },
    ]);

    const search = statements[0];
    expect(search?.sql).toMatch(
      /environment_id = \$1[\s\S]*scope = ANY\(\$2::text\[\]\)[\s\S]*owner_id = \$3/iu,
    );
    expect(search?.sql).toMatch(/ORDER BY occurred_at DESC, record_id/iu);
    expect(search?.values).toEqual([environmentId, ['support-cases'], 'operator-1', 'case']);
    expect(JSON.stringify(statements)).not.toMatch(/email|credential|token|diagnostic/iu);
  });

  it('reloads exact partial jobs and preserved conflict drafts under the environment key', async () => {
    const query = vi.fn((sql: string) => {
      if (sql.includes('FROM admin_operational_jobs')) {
        return Promise.resolve({
          rowCount: 1,
          rows: [
            {
              job_id: 'job-1',
              kind: 'import',
              status: 'partial',
              version: '2',
              progress: 60,
              affected_items: 10,
              idempotency_key: 'job-idem',
              receipt_id: 'receipt-1',
              created_at: now,
              updated_at: now,
            },
          ],
        });
      }
      if (sql.includes('FROM admin_operational_conflicts')) {
        return Promise.resolve({
          rowCount: 1,
          rows: [
            {
              draft_id: 'draft-1',
              subject_id: 'config-1',
              actor_id: 'operator-1',
              expected_version: '1',
              actual_version: '2',
              local_draft: { cohort: 'local' },
              remote_state: { cohort: 'remote' },
              conflicting_fields: ['cohort'],
              preserved_at: now,
            },
          ],
        });
      }
      return Promise.resolve({ rowCount: 0, rows: [] });
    });
    const database = {
      query,
      transaction: vi.fn((operation: (value: { query: typeof query }) => Promise<unknown>) =>
        operation({ query }),
      ),
    };
    const repository = createPostgresAdminOperationsRepository(database, {
      environment,
      environmentId,
    });

    await repository.transaction('job-1', async (transaction) => {
      await expect(transaction.loadJob('job-1')).resolves.toMatchObject({
        status: 'partial',
        version: 2n,
        progress: 60,
        receiptId: 'receipt-1',
      });
    });
    await expect(repository.loadConflictDraft('draft-1')).resolves.toMatchObject({
      localDraft: { cohort: 'local' },
      remote: { cohort: 'remote' },
      conflictingFields: ['cohort'],
    });
  });

  it('claims each job item once through the bounded PostgreSQL claim function', async () => {
    let claim = 0;
    const query = vi.fn((sql: string) => {
      expect(sql).toMatch(/claim_admin_operational_job_items/iu);
      claim += 1;
      return Promise.resolve({
        rowCount: claim === 1 ? 1 : 0,
        rows:
          claim === 1
            ? [
                {
                  item_id: 'item-1',
                  job_id: 'job-1',
                  item_reference: 'account-1',
                  status: 'running',
                  version: '2',
                  attempt_count: 1,
                  claimed_at: now,
                  claim_expires_at: '2030-01-01T00:05:00.000Z',
                },
              ]
            : [],
      });
    });
    const worker = createPostgresAdminOperationsWorker(
      { query, transaction: vi.fn() },
      {
        environment,
        environmentId,
      },
    );

    await expect(
      worker.claim({
        workerId: 'worker-1',
        maximumItems: 1,
        leaseUntil: '2030-01-01T00:05:00.000Z',
      }),
    ).resolves.toEqual([expect.objectContaining({ itemId: 'item-1', attemptCount: 1 })]);
    await expect(
      worker.claim({
        workerId: 'worker-2',
        maximumItems: 1,
        leaseUntil: '2030-01-01T00:05:00.000Z',
      }),
    ).resolves.toEqual([]);
  });

  it('uses version guards and preserves completed state, configuration history, receipts, and audit', async () => {
    const statements: string[] = [];
    const query = vi.fn((sql: string) => {
      statements.push(sql);
      return Promise.resolve({ rowCount: 1, rows: [{ id: 'audit-1' }] });
    });
    const database = {
      query,
      transaction: vi.fn((operation: (value: { query: typeof query }) => Promise<unknown>) =>
        operation({ query }),
      ),
    };
    const repository = createPostgresAdminOperationsRepository(database, {
      environment,
      environmentId,
    });

    await repository.transaction('job-1', async (transaction) => {
      await transaction.saveJob({
        jobId: 'job-1',
        kind: 'import',
        status: 'cancelled',
        version: 3n,
        progress: 60,
        affectedItems: 10,
        idempotencyKey: 'job-idem',
        createdAt: now,
        updatedAt: now,
      });
      await transaction.saveConfiguration({
        configurationId: 'config-1',
        version: 2n,
        status: 'rolled-back',
        environment,
        cohort: 'internal',
        knownVersion: 'v0',
        updatedAt: now,
      });
      await transaction.saveReceipt({
        receiptId: 'receipt-1',
        commandId: 'command-1',
        idempotencyKey: 'receipt-idem',
        actorId: 'operator-1',
        subjectId: 'job-1',
        outcome: 'job-cancelled',
        occurredAt: now,
        auditReference: 'audit-1',
      });
      await transaction.appendAudit({
        eventId: 'audit-1',
        actorId: 'operator-1',
        subjectId: 'job-1',
        action: 'job-cancelled',
        scope: 'jobs',
        reason: 'Safe cancellation',
        origin: environment,
        correlationId: 'correlation-1',
        before: 'partial:60',
        after: 'cancelled:60',
        occurredAt: now,
      });
    });

    const sql = statements.join('\n');
    expect(sql).toMatch(/admin_operational_jobs[\s\S]*version < EXCLUDED\.version/iu);
    expect(sql).toMatch(/admin_operational_jobs[\s\S]*status <> 'completed'/iu);
    expect(sql).toMatch(/INSERT INTO admin_configuration_versions/iu);
    expect(sql).not.toMatch(/UPDATE admin_configuration_versions/iu);
    expect(sql).toMatch(/INSERT INTO admin_operations_receipts/iu);
    expect(sql).toMatch(/INSERT INTO admin_operations_audit/iu);
  });
});
