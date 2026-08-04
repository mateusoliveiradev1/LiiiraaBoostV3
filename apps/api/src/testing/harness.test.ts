import { describe, expect, it, vi } from 'vitest';

import { FrozenClock, SequenceIds } from './determinism.ts';
import {
  createPostgresHarness,
  requireSyntheticDatabase,
  withSerializableTransactions,
} from './postgres.ts';

const syntheticUrl =
  'postgresql://liiiraa_synthetic:secret@ep-example.neon.tech/liiiraa_synthetic_test?sslmode=require';

describe('PostgreSQL test harness admission', () => {
  it.each([
    '',
    'postgresql://developer:secret@localhost/postgres',
    'postgresql://developer:secret@db.example.com/liiiraa_production',
    'postgresql://developer:secret@db.example.com/liiiraa_synthetic_production',
  ])('rejects an unlabeled or production-like URL', (databaseUrl) => {
    expect(() => requireSyntheticDatabase(databaseUrl)).toThrow(/synthetic/i);
  });

  it('accepts an explicitly synthetic database identity', () => {
    expect(requireSyntheticDatabase(syntheticUrl)).toBe(syntheticUrl);
  });

  it('selects daemon-free local, isolated CI, and synthetic URL strategies', () => {
    expect(createPostgresHarness({})).toEqual({
      databaseUrl: undefined,
      requiresDatabaseDaemon: false,
      strategy: 'unit',
    });
    expect(createPostgresHarness({ CI: 'true' })).toEqual({
      databaseUrl: undefined,
      requiresDatabaseDaemon: true,
      strategy: 'testcontainers',
    });
    expect(createPostgresHarness({ TEST_DATABASE_URL: syntheticUrl })).toEqual({
      databaseUrl: syntheticUrl,
      requiresDatabaseDaemon: false,
      strategy: 'synthetic-url',
    });
  });

  it('does not disclose database credentials in admission failures', () => {
    const unsafeUrl = 'postgresql://developer:super-secret@db.example.com/liiiraa_production';

    expect(() => requireSyntheticDatabase(unsafeUrl)).toThrowError(
      expect.objectContaining({ message: expect.not.stringContaining('super-secret') }),
    );
  });

  it('forces serializable isolation through the transaction seam', async () => {
    const transaction = { marker: 'synthetic-transaction' } as const;
    const setIsolationLevel = vi.fn();
    const execute = vi.fn(
      async (operation: (value: typeof transaction) => Promise<string> | string) =>
        operation(transaction),
    );
    const builder = { execute, setIsolationLevel };
    setIsolationLevel.mockReturnValue(builder);
    const database = { transaction: vi.fn(() => builder) };

    await expect(
      withSerializableTransactions<typeof transaction, string>(
        database,
        async (value) => value.marker,
      ),
    ).resolves.toBe('synthetic-transaction');
    expect(setIsolationLevel).toHaveBeenCalledWith('serializable');
  });
});

describe('deterministic test sources', () => {
  it('returns the exact frozen instant without sharing mutable Date instances', () => {
    const clock = new FrozenClock('2030-01-02T03:04:05.678Z');

    expect(clock.now().toISOString()).toBe('2030-01-02T03:04:05.678Z');
    expect(clock.now()).not.toBe(clock.now());
  });

  it('returns IDs in sequence and fails closed on exhaustion', () => {
    const ids = new SequenceIds(['identity-001', 'identity-002']);

    expect(ids.next()).toBe('identity-001');
    expect(ids.next()).toBe('identity-002');
    expect(() => ids.next()).toThrow(/exhausted/i);
  });
});
