import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  ACCOUNT_AUTHORITY_REFRESH_MS,
  ACCOUNT_SYNC_COMMAND,
  DesktopAccountAuthority,
  OPEN_ACCOUNT_SUBSCRIPTION_COMMAND,
  OPEN_ADMIN_COMMAND,
  resolveDesktopAdminHandoff,
  type AccountAuthorityTransport,
  type SharedAccountProjection,
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

const projection = (
  displayName: string,
  version: string,
  locale: 'en' | 'pt-BR' = 'pt-BR',
  options: Readonly<{
    administrativeRole?: 'audit' | 'operations' | 'security' | 'support' | null;
    expiresAt?: string;
    sessionScopes?: SharedAccountProjection['sessions'][number]['scopes'];
  }> = {},
): SharedAccountProjection => ({
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
    ...(options.administrativeRole === null
      ? {}
      : { administrativeRole: options.administrativeRole ?? 'security' }),
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
      scopes: options.sessionScopes ?? ['session-desktop'],
      authenticatedAt: '2030-01-15T00:00:00.000Z',
      expiresAt: options.expiresAt ?? '2030-01-16T00:00:00.000Z',
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

const NOW = new Date('2030-01-15T12:00:00.000Z');

describe('bounded desktop Admin handoff', () => {
  it('derives membership, active function, and plan only from current account authority', () => {
    expect(
      resolveDesktopAdminHandoff(
        { state: 'online', projection: projection('Mateus Oliveira', '7') },
        NOW,
      ),
    ).toEqual({
      status: 'eligible',
      membership: 'active',
      activeFunction: 'security',
      plan: 'premium',
      actionable: true,
    });

    const standardAccount = projection('Friend Tester', '2', 'pt-BR', {
      administrativeRole: null,
    });
    expect(
      resolveDesktopAdminHandoff({ state: 'online', projection: standardAccount }, NOW),
    ).toMatchObject({ status: 'ineligible', membership: 'none', actionable: false });
  });

  it('fails closed for offline, stale, expired, and revoked authority', () => {
    const currentProjection = projection('Mateus Oliveira', '7');
    const expiredProjection = projection('Mateus Oliveira', '7', 'pt-BR', {
      expiresAt: '2030-01-15T11:59:59.000Z',
    });

    expect(resolveDesktopAdminHandoff({ state: 'offline' }, NOW)).toMatchObject({
      status: 'offline',
      actionable: false,
    });
    expect(
      resolveDesktopAdminHandoff({ state: 'stale', projection: currentProjection }, NOW),
    ).toMatchObject({ status: 'offline', actionable: false });
    expect(
      resolveDesktopAdminHandoff({ state: 'online', projection: expiredProjection }, NOW),
    ).toMatchObject({ status: 'expired', membership: 'expired', actionable: false });
    expect(resolveDesktopAdminHandoff({ state: 'revoked', error: 'unauthorized' }, NOW)).toEqual({
      status: 'revoked',
      membership: 'revoked',
      actionable: false,
    });
  });

  it('opens Admin through one argument-free native command only while eligible', async () => {
    const invoke = vi
      .fn<AccountAuthorityTransport['invoke']>()
      .mockResolvedValueOnce({ state: 'online', projection: projection('Mateus Oliveira', '7') })
      .mockResolvedValueOnce({ status: 'opened' });
    const authority = new DesktopAccountAuthority({ invoke });
    await authority.synchronize('launch');

    await expect(authority.openAdmin(NOW)).resolves.toEqual({ status: 'opened' });
    expect(invoke).toHaveBeenLastCalledWith(OPEN_ADMIN_COMMAND);
    expect(invoke.mock.calls.at(-1)).toHaveLength(1);

    const offlineInvoke = vi
      .fn<AccountAuthorityTransport['invoke']>()
      .mockResolvedValue({ state: 'offline', error: 'network-unavailable' });
    const offlineAuthority = new DesktopAccountAuthority({ invoke: offlineInvoke });
    await offlineAuthority.synchronize('launch');
    await expect(offlineAuthority.openAdmin(NOW)).resolves.toEqual({ status: 'offline' });
    expect(offlineInvoke).toHaveBeenCalledTimes(1);
  });

  it('rejects Admin payloads and Admin sessions instead of retaining them in desktop state', async () => {
    const withAdminRecords = { ...projection('Mateus Oliveira', '7'), adminRecords: [{}] };
    const adminSessionProjection = projection('Mateus Oliveira', '7', 'pt-BR', {
      sessionScopes: ['session-admin'],
    });
    const invoke = vi
      .fn<AccountAuthorityTransport['invoke']>()
      .mockResolvedValueOnce({ state: 'online', projection: withAdminRecords })
      .mockResolvedValueOnce({ state: 'online', projection: adminSessionProjection });
    const authority = new DesktopAccountAuthority({ invoke });

    await authority.synchronize('launch');
    expect(authority.snapshot()).toEqual({ state: 'offline', error: 'invalid-response' });
    await authority.synchronize('reconnection');
    expect(authority.snapshot()).toEqual({ state: 'offline', error: 'invalid-response' });
    expect(JSON.stringify(authority.snapshot())).not.toMatch(
      /adminRecords|session-admin|cookie|credential|accessToken|refreshToken/u,
    );
  });
});

describe('bounded desktop subscription handoff', () => {
  it('opens the Account subscription route through one locale-bound native command', async () => {
    const invoke = vi
      .fn<AccountAuthorityTransport['invoke']>()
      .mockResolvedValueOnce({ state: 'online', projection: projection('Friend Tester', '2') })
      .mockResolvedValueOnce({ status: 'opened' });
    const authority = new DesktopAccountAuthority({ invoke });
    await authority.synchronize('launch');

    await expect(authority.openSubscription('pt-BR')).resolves.toEqual({ status: 'opened' });
    expect(invoke).toHaveBeenLastCalledWith(OPEN_ACCOUNT_SUBSCRIPTION_COMMAND, {
      locale: 'pt-BR',
    });
  });

  it('does not open plan management without a current account authority', async () => {
    const invoke = vi
      .fn<AccountAuthorityTransport['invoke']>()
      .mockResolvedValue({ state: 'offline', error: 'network-unavailable' });
    const authority = new DesktopAccountAuthority({ invoke });
    await authority.synchronize('launch');

    await expect(authority.openSubscription('en')).resolves.toEqual({ status: 'offline' });
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});

describe('desktop account authority mutations', () => {
  it('publishes a confirmed sign-out immediately and idempotently', async () => {
    const invoke = vi
      .fn<AccountAuthorityTransport['invoke']>()
      .mockResolvedValue({ state: 'online', projection: projection('Mateus Oliveira', '7') });
    const authority = new DesktopAccountAuthority({ invoke });

    await authority.synchronize('launch');
    const publishedStates: string[] = [];
    const unsubscribe = authority.subscribe((snapshot) => {
      publishedStates.push(snapshot.state);
    });

    authority.confirmSignedOut();
    authority.confirmSignedOut();

    expect(authority.snapshot()).toEqual({ state: 'revoked', error: 'unauthorized' });
    expect(publishedStates).toEqual(['online', 'revoked']);
    unsubscribe();
  });

  it('ignores an online synchronization that finishes after confirmed sign-out', async () => {
    let resolveRefresh: ((value: unknown) => void) | undefined;
    const refreshResponse = new Promise<unknown>((resolve) => {
      resolveRefresh = resolve;
    });
    const invoke = vi
      .fn<AccountAuthorityTransport['invoke']>()
      .mockResolvedValueOnce({ state: 'online', projection: projection('Mateus Oliveira', '7') })
      .mockReturnValueOnce(refreshResponse);
    const authority = new DesktopAccountAuthority({ invoke });

    await authority.synchronize('launch');
    const refresh = authority.synchronize('reconnection');
    await Promise.resolve();

    authority.confirmSignedOut();
    resolveRefresh?.({ state: 'online', projection: projection('Mateus Oliveira', '8') });
    await refresh;

    expect(authority.snapshot()).toEqual({ state: 'revoked', error: 'unauthorized' });
  });

  it('discards queued lifecycle synchronization after confirmed sign-out', async () => {
    let resolveRefresh: ((value: unknown) => void) | undefined;
    const refreshResponse = new Promise<unknown>((resolve) => {
      resolveRefresh = resolve;
    });
    const invoke = vi
      .fn<AccountAuthorityTransport['invoke']>()
      .mockResolvedValueOnce({ state: 'online', projection: projection('Mateus Oliveira', '7') })
      .mockReturnValueOnce(refreshResponse)
      .mockResolvedValue({ state: 'online', projection: projection('Mateus Oliveira', '9') });
    const authority = new DesktopAccountAuthority({ invoke });

    await authority.synchronize('launch');
    const refresh = authority.synchronize('reconnection');
    await Promise.resolve();
    await authority.synchronize('resume');

    authority.confirmSignedOut();
    resolveRefresh?.({ state: 'online', projection: projection('Mateus Oliveira', '8') });
    await refresh;
    await Promise.resolve();

    expect(invoke).toHaveBeenCalledTimes(2);
    expect(authority.snapshot()).toEqual({ state: 'revoked', error: 'unauthorized' });
  });

  it('keeps a confirmed signed-out state stable during background refresh', async () => {
    const invoke = vi
      .fn<AccountAuthorityTransport['invoke']>()
      .mockResolvedValue({ state: 'revoked', error: 'unauthorized' });
    const authority = new DesktopAccountAuthority({ invoke });

    await authority.synchronize('launch');
    const publishedStates: string[] = [];
    const unsubscribe = authority.subscribe((snapshot) => {
      publishedStates.push(snapshot.state);
    });

    await authority.synchronize('reconnection');

    expect(publishedStates).toEqual(['revoked', 'revoked']);
    unsubscribe();
  });

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

  it('keeps the last confirmed projection visually stable during background refresh', async () => {
    let resolveRefresh: ((value: unknown) => void) | undefined;
    const refreshResponse = new Promise<unknown>((resolve) => {
      resolveRefresh = resolve;
    });
    const invoke = vi
      .fn<AccountAuthorityTransport['invoke']>()
      .mockResolvedValueOnce({ state: 'online', projection: projection('Mateus Oliveira', '7') })
      .mockReturnValueOnce(refreshResponse);
    const authority = new DesktopAccountAuthority({ invoke });

    await authority.synchronize('launch');
    const publishedStates: string[] = [];
    const unsubscribe = authority.subscribe((snapshot) => {
      publishedStates.push(snapshot.state);
    });

    const refresh = authority.synchronize('reconnection');
    await Promise.resolve();

    expect(publishedStates).toEqual(['online']);
    expect(authority.snapshot()).toMatchObject({
      state: 'online',
      projection: { account: { displayName: 'Mateus Oliveira', aggregateVersion: '7' } },
    });

    resolveRefresh?.({ state: 'online', projection: projection('Mateus Oliveira', '8') });
    await refresh;
    expect(publishedStates).toEqual(['online', 'online']);
    unsubscribe();
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
