import { describe, expect, it } from 'vitest';

import { normalizePostgresResult } from './database.ts';

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
});
