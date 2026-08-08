import { EventEmitter } from 'node:events';

import { describe, expect, it, vi } from 'vitest';

import { closePostgresPool, normalizePostgresResult } from './database.ts';

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

  it('waits for every PostgreSQL client socket to close before teardown continues', async () => {
    const lifecycle = new EventEmitter() as EventEmitter & { totalCount: number };
    lifecycle.totalCount = 2;
    let finishDestroy: (() => void) | undefined;
    const destroy = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishDestroy = resolve;
        }),
    );

    let closed = false;
    const closing = closePostgresPool(lifecycle, destroy).then(() => {
      closed = true;
    });
    await vi.waitFor(() => expect(destroy).toHaveBeenCalledOnce());

    lifecycle.emit('remove');
    lifecycle.emit('remove');
    await Promise.resolve();
    expect(closed).toBe(false);

    finishDestroy?.();
    await closing;
    expect(closed).toBe(true);
    expect(lifecycle.listenerCount('remove')).toBe(0);
  });
});
