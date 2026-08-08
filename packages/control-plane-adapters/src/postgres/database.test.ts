import { describe, expect, it } from 'vitest';

import { normalizePostgresPoolError, normalizePostgresResult } from './database.ts';

describe('PostgreSQL result normalization', () => {
  it('normalizes a single query result', () => {
    expect(
      normalizePostgresResult<{ id: string }>({
        rowCount: 1,
        rows: [{ id: 'single' }],
      }),
    ).toEqual({ rowCount: 1, rows: [{ id: 'single' }] });
  });

  it('normalizes and aggregates multi-statement pg results', () => {
    expect(
      normalizePostgresResult<{ id: string }>([
        { rowCount: null, rows: [{ id: 'first' }] },
        { rowCount: 2, rows: [{ id: 'second' }, { id: 'third' }] },
        { rowCount: null, rows: [] },
      ]),
    ).toEqual({
      rowCount: 3,
      rows: [{ id: 'first' }, { id: 'second' }, { id: 'third' }],
    });
  });

  it('reduces idle pool failures to bounded metadata without connection details', () => {
    expect(
      normalizePostgresPoolError({
        code: '57P01',
        connectionParameters: {
          password: 'must-never-leak',
        },
      }),
    ).toEqual({ code: '57P01' });
    expect(normalizePostgresPoolError(new Error('socket closed'))).toEqual({
      code: 'postgres-pool-error',
    });
  });
});
