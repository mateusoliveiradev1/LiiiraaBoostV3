import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  AccountAuthority,
  AccountAuthorityProjection,
  AccountAuthorityReadResult,
} from './account-authority';
import {
  ACCOUNT_LIVE_REFRESH_MS,
  isAccountSessionUnavailable,
  LiveAccountAuthority,
} from './live-account-authority';

const projection = (displayName: string, version: string): AccountAuthorityProjection =>
  ({
    account: {
      accountId: 'account-01',
      aggregateVersion: version,
      displayName,
      locale: 'pt-BR',
    },
    provenance: 'online',
  }) as AccountAuthorityProjection;

const windowEvents = new EventTarget();
const documentEvents = new EventTarget();

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(documentEvents, 'visibilityState', {
    configurable: true,
    value: 'visible',
  });
  vi.stubGlobal('addEventListener', windowEvents.addEventListener.bind(windowEvents));
  vi.stubGlobal('removeEventListener', windowEvents.removeEventListener.bind(windowEvents));
  vi.stubGlobal('document', documentEvents);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('live account authority', () => {
  it('publishes an immediate unavailable session snapshot after browser sign-out', () => {
    const authority = {
      project: vi.fn<AccountAuthority['project']>(() => new Promise(() => undefined)),
      updateProfile: vi.fn<AccountAuthority['updateProfile']>(),
    } satisfies AccountAuthority;
    const live = new LiveAccountAuthority(authority);
    const listener = vi.fn<(result: AccountAuthorityReadResult | null) => void>();
    const unsubscribe = live.subscribe(listener);
    listener.mockClear();

    live.markSessionUnavailable();

    expect(live.snapshot()).toEqual({ code: 'unauthorized', status: 'error' });
    expect(isAccountSessionUnavailable(live.snapshot())).toBe(true);
    expect(listener).toHaveBeenCalledWith({ code: 'unauthorized', status: 'error' });
    unsubscribe();
  });

  it('shares one periodic remote projection with every open account surface', async () => {
    const authority = {
      project: vi
        .fn<AccountAuthority['project']>()
        .mockResolvedValueOnce({
          projection: projection('Mateus Winchester', '8'),
          status: 'online',
        })
        .mockResolvedValueOnce({
          projection: projection('Mateus Oliveira', '9'),
          status: 'online',
        }),
      updateProfile: vi.fn<AccountAuthority['updateProfile']>(),
    } satisfies AccountAuthority;
    const live = new LiveAccountAuthority(authority);
    const pageListener = vi.fn<(result: AccountAuthorityReadResult | null) => void>();
    const chromeListener = vi.fn<(result: AccountAuthorityReadResult | null) => void>();
    const unsubscribePage = live.subscribe(pageListener);
    const unsubscribeChrome = live.subscribe(chromeListener);

    await Promise.resolve();
    await Promise.resolve();
    const firstResult = pageListener.mock.calls.at(-1)?.[0];
    expect(firstResult !== null && firstResult !== undefined && 'projection' in firstResult).toBe(
      true,
    );
    if (firstResult !== null && firstResult !== undefined && 'projection' in firstResult) {
      expect(firstResult.projection.account.displayName).toBe('Mateus Winchester');
    }

    await vi.advanceTimersByTimeAsync(ACCOUNT_LIVE_REFRESH_MS);
    const refreshedResult = chromeListener.mock.calls.at(-1)?.[0];
    expect(
      refreshedResult !== null && refreshedResult !== undefined && 'projection' in refreshedResult,
    ).toBe(true);
    if (
      refreshedResult !== null &&
      refreshedResult !== undefined &&
      'projection' in refreshedResult
    ) {
      expect(refreshedResult.projection.account.displayName).toBe('Mateus Oliveira');
      expect(refreshedResult.projection.account.aggregateVersion).toBe('9');
    }
    expect(authority.project).toHaveBeenCalledTimes(2);

    unsubscribePage();
    unsubscribeChrome();
  });
});
