import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  ACCOUNT_AUTHORITY_REFRESH_MS,
  ACCOUNT_SYNC_COMMAND,
  DesktopAccountAuthority,
  type AccountAuthorityTransport,
} from './account-authority.js';

const events = new EventTarget();

beforeAll(() => {
  vi.stubGlobal('dispatchEvent', events.dispatchEvent.bind(events));
  vi.stubGlobal('addEventListener', events.addEventListener.bind(events));
  vi.stubGlobal('removeEventListener', events.removeEventListener.bind(events));
});

afterAll(() => {
  vi.unstubAllGlobals();
});

const projection = (displayName: string, version: string, locale: 'en' | 'pt-BR' = 'pt-BR') => ({
  account: {
    schemaVersion: '1.0',
    aggregateVersion: version,
    etag: `account-account-01-v${version}`,
    correlationId: 'account-authority-test',
    provenance: 'postgres-authority',
    kind: 'account-projection',
    accountId: 'account-01',
    state: 'active',
    displayName,
    emailRedacted: 'w***@gmail.com',
    administrativeRole: 'security',
    locale,
    createdAt: '2030-01-01T00:00:00.000Z',
    updatedAt: '2030-01-15T00:00:00.000Z',
  },
  provenance: 'online',
  securityMethods: [],
  sessions: [
    {
      schemaVersion: '1.0',
      aggregateVersion: '1',
      etag: 'session-session-01-v1',
      correlationId: 'account-authority-test',
      provenance: 'postgres-authority',
      kind: 'session-projection',
      sessionId: 'session-01',
      accountId: 'account-01',
      state: 'active',
      authenticationStrength: 'password',
      scopes: ['session-desktop'],
      authenticatedAt: '2030-01-15T00:00:00.000Z',
      expiresAt: '2030-01-16T00:00:00.000Z',
      lastSeenAt: '2030-01-15T00:00:00.000Z',
    },
  ],
  subscription: {
    schemaVersion: '1.0',
    aggregateVersion: '1',
    etag: 'subscription-subscription-01-v1',
    correlationId: 'account-authority-test',
    provenance: 'postgres-authority',
    kind: 'subscription-projection',
    subscriptionId: 'subscription-01',
    accountId: 'account-01',
    state: 'active',
    plan: 'premium',
    entitlements: ['premium-actions'],
    cancelAtPeriodEnd: false,
  },
  invoices: [],
  supportCases: [],
  activeDevice: null,
});

describe('desktop account authority mutations', () => {
  it('keeps synchronizing remote account changes while the desktop stays open', async () => {
    vi.useFakeTimers();
    try {
      const invoke = vi
        .fn<AccountAuthorityTransport['invoke']>()
        .mockResolvedValueOnce({
          state: 'online',
          projection: projection('Mateus Winchester', '8'),
        })
        .mockResolvedValueOnce({ state: 'online', projection: projection('Mateus Oliveira', '9') });
      const authority = new DesktopAccountAuthority({ invoke });

      authority.start();
      await Promise.resolve();
      await Promise.resolve();
      expect(authority.snapshot()).toMatchObject({
        projection: { account: { displayName: 'Mateus Winchester' } },
      });

      await vi.advanceTimersByTimeAsync(ACCOUNT_AUTHORITY_REFRESH_MS);
      expect(authority.snapshot()).toMatchObject({
        projection: { account: { displayName: 'Mateus Oliveira', aggregateVersion: '9' } },
      });
      expect(invoke.mock.calls.at(-1)?.[1]).toMatchObject({
        request: { trigger: 'reconnection' },
      });
      authority.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps lifecycle reads from superseding an in-flight committed profile mutation', async () => {
    let resolveMutation: ((value: unknown) => void) | undefined;
    const mutationResponse = new Promise<unknown>((resolve) => {
      resolveMutation = resolve;
    });
    const invoke = vi
      .fn<AccountAuthorityTransport['invoke']>()
      .mockResolvedValueOnce({ state: 'online', projection: projection('Mateus Oliveira', '7') })
      .mockReturnValueOnce(mutationResponse)
      .mockResolvedValueOnce({
        state: 'online',
        projection: projection('Mateus Winchester', '8'),
      });
    const authority = new DesktopAccountAuthority({ invoke });

    await authority.synchronize('launch');
    const mutation = authority.updateProfile({ displayName: 'Mateus Winchester', locale: 'pt-BR' });
    await Promise.resolve();
    await authority.synchronize('resume');
    resolveMutation?.({
      state: 'online',
      projection: projection('Mateus Winchester', '8'),
    });

    await expect(mutation).resolves.toMatchObject({ status: 'committed' });
    await Promise.resolve();
    await Promise.resolve();
    expect(invoke).toHaveBeenCalledTimes(3);
    expect(invoke.mock.calls.at(-1)?.[0]).toBe(ACCOUNT_SYNC_COMMAND);
    expect(invoke.mock.calls[1]?.[1]).toMatchObject({ request: { trigger: 'mutation' } });
    expect(invoke.mock.calls.at(-1)?.[1]).toMatchObject({ request: { trigger: 'resume' } });
    expect(authority.snapshot()).toMatchObject({
      state: 'online',
      projection: { account: { displayName: 'Mateus Winchester', aggregateVersion: '8' } },
    });
  });

  it('returns a visible failure result and preserves the local draft when authority rejects it', async () => {
    const invoke = vi
      .fn<AccountAuthorityTransport['invoke']>()
      .mockResolvedValueOnce({ state: 'online', projection: projection('Mateus Oliveira', '7') })
      .mockResolvedValueOnce({
        state: 'stale',
        projection: projection('Mateus Oliveira', '7'),
        localDraft: { displayName: 'Mateus Winchester', locale: 'pt-BR' },
        error: 'invalid-response',
      });
    const authority = new DesktopAccountAuthority({ invoke });

    await authority.synchronize('launch');

    await expect(
      authority.updateProfile({ displayName: 'Mateus Winchester', locale: 'pt-BR' }),
    ).resolves.toEqual({ status: 'failed', error: 'invalid-response' });
    expect(authority.snapshot()).toMatchObject({
      state: 'stale',
      localDraft: { displayName: 'Mateus Winchester' },
    });
  });

  it('rejects a nominally online response that did not commit the requested name', async () => {
    const invoke = vi
      .fn<AccountAuthorityTransport['invoke']>()
      .mockResolvedValueOnce({ state: 'online', projection: projection('Mateus Oliveira', '7') })
      .mockResolvedValueOnce({ state: 'online', projection: projection('Mateus Oliveira', '7') });
    const authority = new DesktopAccountAuthority({ invoke });

    await authority.synchronize('launch');

    await expect(
      authority.updateProfile({ displayName: 'Mateus Winchester', locale: 'pt-BR' }),
    ).resolves.toEqual({ status: 'failed', error: 'invalid-response' });
    expect(authority.snapshot()).toMatchObject({
      state: 'stale',
      projection: { account: { displayName: 'Mateus Oliveira' } },
      localDraft: { displayName: 'Mateus Winchester' },
    });
  });
});
