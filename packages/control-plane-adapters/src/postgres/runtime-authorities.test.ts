import { describe, expect, it, vi } from 'vitest';

import {
  createPostgresSubscriptionManagementRepository,
  migrateRuntimeAuthorities,
  runtimeAuthoritiesSchemaHash,
} from './runtime-authorities.js';

describe('persistent runtime authorities', () => {
  it('applies the append-only 0003 migration under the shared migration lock', async () => {
    const statements: string[] = [];
    const transaction = {
      query: vi.fn((statement: string) => {
        statements.push(statement);
        if (statement.includes('SELECT checksum')) return Promise.resolve({ rowCount: 0, rows: [] });
        return Promise.resolve({ rowCount: 1, rows: [] });
      }),
    };
    const database = {
      query: vi.fn(),
      transaction: vi.fn((operation: (value: typeof transaction) => Promise<unknown>) =>
        operation(transaction),
      ),
    };

    await expect(migrateRuntimeAuthorities(database)).resolves.toEqual({
      applied: true,
      schemaHash: runtimeAuthoritiesSchemaHash,
      version: '0003_runtime_authorities',
    });
    expect(statements.join('\n')).toContain('stripe_customer_links');
    expect(statements.join('\n')).toContain('control_plane_command_results');
    expect(statements.join('\n')).toContain('runtime_aggregates');
    expect(statements.join('\n')).toContain(
      "pg_advisory_xact_lock(hashtext('liiiraa-boost-control-plane-migrations'))",
    );
  });

  it('round-trips a subscription intent through PostgreSQL JSON without losing bigint versions', async () => {
    const stored = new Map<string, unknown>();
    const query = vi.fn((statement: string, values: readonly unknown[] = []) => {
      if (statement.includes('SELECT state') && statement.includes('runtime_aggregates')) {
        const state = stored.get(String(values[1]));
        return Promise.resolve({
          rowCount: state === undefined ? 0 : 1,
          rows: state === undefined ? [] : [{ state }],
        });
      }
      if (statement.includes('INSERT INTO runtime_aggregates')) {
        stored.set(String(values[1]), JSON.parse(String(values[4])));
      }
      return Promise.resolve({ rowCount: 1, rows: [] });
    });
    const database = {
      query,
      transaction: vi.fn((operation: (value: { query: typeof query }) => Promise<unknown>) =>
        operation({ query }),
      ),
    };
    const repository = createPostgresSubscriptionManagementRepository(database);
    const state = {
      accountId: '00000000-0000-4000-8000-000000000001',
      version: 7n,
      plan: 'premium' as const,
      status: 'active' as const,
      cancelAtPeriodEnd: false,
      checkoutStatus: 'reconciled' as const,
      capabilities: { newPremiumActions: true, safetyHistoryRestoration: true as const },
    };

    await repository.transaction(state.accountId, async (authority) => {
      await authority.saveIntent(state);
      await expect(authority.loadSubscription(state.accountId)).resolves.toEqual(state);
    });
  });
});
