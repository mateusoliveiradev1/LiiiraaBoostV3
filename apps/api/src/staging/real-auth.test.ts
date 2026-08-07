import { controlPlaneDocumentValidator } from '@liiiraa/contracts-ts';
import type { IdentityActor } from '@liiiraa/control-plane-adapters';
import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';

import {
  registerRealIdentityRoutes,
  type RealIdentityRouteAuthority,
} from '../modules/identity/real-routes.js';
import { registerStrongAuthRoutes } from '../modules/identity/strong-auth-routes.js';
import type { StagingStrongAuth } from './strong-auth.js';
import { resolveStagingSubscription } from './runtime.js';

const accountOrigin = 'https://account.staging.example';
const adminOrigin = 'https://admin.staging.example';
const issuer = 'https://api.staging.example';
const csrfSecret = 'synthetic-auth-secret-with-at-least-32-characters';
const credential = 'session-credential-abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG';
const actor: IdentityActor = {
  accountId: '00000000-0000-4000-8000-000000000001',
  displayName: 'Real Tester',
  email: 'tester@example.com',
  locale: 'pt-BR',
  role: 'tester',
  sessionId: '00000000-0000-4000-8000-000000000002',
  sessionKind: 'web',
  authenticationMethod: 'password',
  authenticatedAt: '2030-01-01T00:00:00.000Z',
  expiresAt: '2030-02-01T00:00:00.000Z',
  lastSeenAt: '2030-01-01T00:00:00.000Z',
  sessionVersion: 1n,
  identityVersion: 1n,
  createdAt: '2030-01-01T00:00:00.000Z',
  updatedAt: '2030-01-01T00:00:00.000Z',
};

const authority = () => {
  let active = true;
  return {
    signUp: vi.fn(() => Promise.resolve({ ok: true as const, actor, credential })),
    signIn: vi.fn(() => Promise.resolve({ ok: true as const, actor, credential })),
    resolveCredential: vi.fn((candidate: string) =>
      Promise.resolve(active && candidate === credential ? actor : null),
    ),
    signOut: vi.fn(() => {
      active = false;
      return Promise.resolve(true);
    }),
    updateProfile: vi.fn(),
    beginDesktopAuthorization: vi.fn(() =>
      Promise.resolve({
        ok: true as const,
        challenge: {
          challengeId: '00000000-0000-4000-8000-000000000003',
          authorizationUrl:
            'https://account.staging.example/pt-BR/login?desktop_challenge=00000000-0000-4000-8000-000000000003&state=desktop-state-abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGH',
          state: 'desktop-state-abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGH',
          codeChallenge: 'a'.repeat(43),
          codeChallengeMethod: 'S256' as const,
          issuer,
          redirectUri: 'http://127.0.0.1:43117/oauth/callback',
        },
      }),
    ),
    approveDesktopAuthorization: vi.fn(() =>
      Promise.resolve({
        ok: true as const,
        callbackUrl:
          'http://127.0.0.1:43117/oauth/callback?code=desktop-code-abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHI&state=desktop-state-abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGH',
      }),
    ),
    exchangeDesktopAuthorization: vi.fn(() =>
      Promise.resolve({
        ok: true as const,
        actor: { ...actor, sessionKind: 'desktop' as const },
        credential,
      }),
    ),
  } satisfies RealIdentityRouteAuthority;
};

const createApp = async () => {
  const app = Fastify();
  const identity = authority();
  const strongAuth = {
    status: vi.fn(() => Promise.resolve({ enabled: false })),
    beginTotpEnrollment: vi.fn(() => ({
      enrollmentToken: 'sealed-enrollment-token',
      expiresAt: '2030-01-01T00:10:00.000Z',
      otpauthUri: 'otpauth://totp/Liiiraa%20Boost%3Atester%40example.com',
      secret: 'ABCDEFGHIJKLMNOPQRSTUVWX23456789',
    })),
    confirmTotpEnrollment: vi.fn(() =>
      Promise.resolve({
        ok: true as const,
        factor: 'totp' as const,
        factorId: '00000000-0000-4000-8000-000000000004',
        verifiedAt: '2030-01-01T00:00:00.000Z',
      }),
    ),
    verifyTotpStepUp: vi.fn(() =>
      Promise.resolve({
        ok: true as const,
        expiresAt: '2030-01-01T00:05:00.000Z',
        method: 'totp' as const,
        receipt: 'opaque-step-up-receipt-abcdefghijklmnopqrstuvwxyz0123456789',
        verifiedAt: '2030-01-01T00:00:00.000Z',
      }),
    ),
    consumeStepUpReceipt: vi.fn(),
  } as unknown as StagingStrongAuth;
  await registerRealIdentityRoutes(app, {
    accountOrigin,
    adminOrigin,
    authority: identity,
    csrfSecret,
    issuer,
    resolveSubscription: vi.fn(() =>
      Promise.resolve({
        schemaVersion: '1.0' as const,
        aggregateVersion: '4',
        etag: 'subscription-premium-owner-v4',
        correlationId: 'premium-owner-test',
        provenance: 'postgres-authority' as const,
        kind: 'subscription-projection' as const,
        subscriptionId: 'premium-owner',
        accountId: actor.accountId,
        state: 'active' as const,
        plan: 'premium' as const,
        entitlements: ['premium-actions'] as ['premium-actions'],
        cancelAtPeriodEnd: false,
      }),
    ),
  });
  await registerStrongAuthRoutes(app, {
    allowedOrigins: [accountOrigin, adminOrigin],
    authority: strongAuth,
    csrfSecret,
    resolveActor: async (request) => {
      const match = /(?:^|;\s*)__Host-liiiraa_session=([^;]+)/u.exec(
        request.headers.cookie ?? '',
      );
      return match?.[1] === undefined
        ? null
        : identity.resolveCredential(decodeURIComponent(match[1]));
    },
  });
  await app.ready();
  return { app, identity, strongAuth };
};

const csrf = async (app: Awaited<ReturnType<typeof createApp>>['app']) => {
  const response = await app.inject({
    headers: { origin: accountOrigin },
    method: 'GET',
    url: '/v1/identity/csrf',
  });
  expect(response.statusCode).toBe(200);
  return response.json<{ token: string }>().token;
};

describe('real staging authentication routes', () => {
  it('exposes authenticated TOTP enrollment, confirmation and action-bound step-up over HTTP', async () => {
    const { app, strongAuth } = await createApp();
    const cookie = `__Host-liiiraa_session=${encodeURIComponent(credential)}`;
    const csrfToken = await csrf(app);

    const status = await app.inject({
      headers: { cookie, origin: adminOrigin },
      method: 'GET',
      url: '/v1/identity/strong-auth/status',
    });
    expect(status.statusCode).toBe(200);
    expect(status.json()).toEqual({ enabled: false });

    const denied = await app.inject({
      headers: { cookie, origin: adminOrigin },
      method: 'POST',
      url: '/v1/identity/strong-auth/totp/enrollment',
    });
    expect(denied.statusCode).toBe(403);

    const headers = { cookie, origin: adminOrigin, 'x-csrf-token': csrfToken };
    const enrollment = await app.inject({
      headers,
      method: 'POST',
      url: '/v1/identity/strong-auth/totp/enrollment',
    });
    expect(enrollment.statusCode).toBe(201);
    expect(enrollment.json()).toMatchObject({ enrollmentToken: 'sealed-enrollment-token' });

    const confirmation = await app.inject({
      headers,
      method: 'POST',
      payload: { code: '123456', enrollmentToken: 'sealed-enrollment-token' },
      url: '/v1/identity/strong-auth/totp/confirm',
    });
    expect(confirmation.statusCode).toBe(200);
    expect(strongAuth.confirmTotpEnrollment).toHaveBeenCalledWith(
      actor,
      'sealed-enrollment-token',
      '123456',
    );

    const binding = {
      action: 'switch-function',
      authorizationContextId: 'context-one',
      code: '654321',
      redactedTarget: 'owner-membership',
      resource: 'governance',
    };
    const stepUp = await app.inject({
      headers,
      method: 'POST',
      payload: binding,
      url: '/v1/identity/strong-auth/step-up',
    });
    expect(stepUp.statusCode).toBe(200);
    expect(stepUp.json()).toMatchObject({ method: 'totp' });
    expect(strongAuth.verifyTotpStepUp).toHaveBeenCalledWith(actor, binding);
    await app.close();
  });

  it('creates an invited account, persists a secure cookie, projects real account state and revokes logout', async () => {
    const { app, identity } = await createApp();
    expect((await app.inject({ method: 'GET', url: '/v1/account' })).statusCode).toBe(401);
    const csrfToken = await csrf(app);
    const signup = await app.inject({
      headers: { origin: accountOrigin, 'x-csrf-token': csrfToken },
      method: 'POST',
      payload: {
        displayName: 'Real Tester',
        email: 'tester@example.com',
        invitationToken: 'invite-token-abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJ',
        locale: 'pt-BR',
        password: 'CorrectHorse1',
      },
      url: '/v1/identity/sign-up',
    });
    expect(signup.statusCode).toBe(201);
    expect(signup.headers['set-cookie']).toContain('__Host-liiiraa_session=');
    expect(signup.headers['set-cookie']).toContain('HttpOnly');
    expect(signup.headers['set-cookie']).toContain('SameSite=None');
    expect(signup.body).not.toContain(credential);
    const cookie = `__Host-liiiraa_session=${encodeURIComponent(credential)}`;

    const account = await app.inject({
      headers: { cookie, origin: accountOrigin },
      method: 'GET',
      url: '/v1/account',
    });
    expect(account.statusCode).toBe(200);
    expect(account.json()).toMatchObject({
      account: {
        accountId: actor.accountId,
        displayName: 'Real Tester',
        provenance: 'postgres-authority',
      },
      provenance: 'online',
      subscription: { plan: 'premium', state: 'active' },
    });
    const projection = account.json<{ account: unknown; subscription: unknown }>();
    expect(controlPlaneDocumentValidator(projection.account)).toBe(true);
    expect(controlPlaneDocumentValidator(projection.subscription)).toBe(true);

    const signout = await app.inject({
      headers: { cookie, origin: accountOrigin, 'x-csrf-token': csrfToken },
      method: 'POST',
      url: '/v1/identity/sign-out',
    });
    expect(signout.statusCode).toBe(204);
    expect(signout.headers['set-cookie']).toContain('Max-Age=0');
    expect(identity.signOut).toHaveBeenCalledWith(credential);
    expect(
      (await app.inject({ headers: { cookie }, method: 'GET', url: '/v1/account' })).statusCode,
    ).toBe(401);
    await app.close();
  });

  it('rejects state-changing browser requests without exact origin and CSRF while allowing native PKCE exchange', async () => {
    const { app, identity } = await createApp();
    const denied = await app.inject({
      headers: { origin: 'https://attacker.example', 'x-csrf-token': 'forged' },
      method: 'POST',
      payload: { email: 'tester@example.com', password: 'CorrectHorse1' },
      url: '/v1/identity/sign-in',
    });
    expect(denied.statusCode).toBe(403);
    expect(identity.signIn).not.toHaveBeenCalled();

    const begin = await app.inject({
      method: 'POST',
      payload: {
        codeChallenge: 'a'.repeat(43),
        email: 'tester@example.com',
        issuer,
        redirectUri: 'http://127.0.0.1:43117/oauth/callback',
      },
      url: '/v1/identity/desktop/authorizations',
    });
    expect(begin.statusCode).toBe(201);
    const exchange = await app.inject({
      method: 'POST',
      payload: {
        authorizationCode: 'desktop-code-abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHI',
        challengeId: '00000000-0000-4000-8000-000000000003',
        codeVerifier: 'v'.repeat(64),
        state: 'desktop-state-abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGH',
      },
      url: '/v1/identity/desktop/exchanges',
    });
    expect(exchange.statusCode).toBe(201);
    expect(exchange.json()).toMatchObject({
      credentialCustody: { kind: 'windows-credential-manager' },
      session: { accountId: actor.accountId, state: 'active' },
    });
    expect(exchange.body).toContain(credential);
    const nativeSignOut = await app.inject({
      headers: { authorization: `Bearer ${credential}` },
      method: 'POST',
      url: '/v1/identity/desktop/sign-out',
    });
    expect(nativeSignOut.statusCode).toBe(204);
    expect(identity.signOut).toHaveBeenCalledWith(credential);
    await app.close();
  });

  it('allows a bearer-authenticated native profile update without browser CSRF and still rejects a hostile Origin', async () => {
    const { app, identity } = await createApp();
    identity.updateProfile.mockResolvedValue({
      ok: true,
      actor: {
        ...actor,
        displayName: 'Mateus Winchester',
        identityVersion: 2n,
        updatedAt: '2030-01-02T00:00:00.000Z',
      },
    });
    const current = await app.inject({
      headers: { authorization: `Bearer ${credential}` },
      method: 'GET',
      url: '/v1/account',
    });
    expect(current.statusCode).toBe(200);

    const nativeUpdate = await app.inject({
      headers: {
        authorization: `Bearer ${credential}`,
        'if-match': `"${actor.identityVersion.toString()}"`,
      },
      method: 'PATCH',
      payload: { patch: { displayName: 'Mateus Winchester', locale: 'pt-BR' } },
      url: '/v1/account',
    });
    expect(nativeUpdate.statusCode).toBe(200);
    expect(nativeUpdate.json()).toMatchObject({
      account: { displayName: 'Mateus Winchester' },
    });

    identity.updateProfile.mockClear();
    for (const invalidIfMatch of ['*', '"1", "2"', '"-1"', '"account-invalid-v1']) {
      const invalidUpdate = await app.inject({
        headers: {
          authorization: `Bearer ${credential}`,
          'if-match': invalidIfMatch,
        },
        method: 'PATCH',
        payload: { patch: { displayName: 'Invalid Version', locale: 'pt-BR' } },
        url: '/v1/account',
      });
      expect(invalidUpdate.statusCode).toBe(400);
    }
    expect(identity.updateProfile).not.toHaveBeenCalled();

    const hostileUpdate = await app.inject({
      headers: {
        authorization: `Bearer ${credential}`,
        'if-match': current.headers.etag,
        origin: 'https://attacker.example',
        'x-csrf-token': 'forged',
      },
      method: 'PATCH',
      payload: { patch: { displayName: 'Attacker Name', locale: 'pt-BR' } },
      url: '/v1/account',
    });
    expect(hostileUpdate.statusCode).toBe(403);
    expect(identity.updateProfile).not.toHaveBeenCalled();
    await app.close();
  });
});

describe('staging subscription authority', () => {
  it('projects an active permanent entitlement as Premium without an expiration', async () => {
    const query = vi.fn(() =>
      Promise.resolve({
        rows: [
          {
            id: '00000000-0000-4000-8000-000000000004',
            status: 'active',
            valid_until: null,
            version: 4n,
          },
        ],
      }),
    );

    await expect(
      resolveStagingSubscription({ query }, actor, 'premium-authority-test'),
    ).resolves.toEqual({
      schemaVersion: '1.0',
      aggregateVersion: '4',
      etag: 'subscription-00000000-0000-4000-8000-000000000004-v4',
      correlationId: 'premium-authority-test',
      provenance: 'postgres-authority',
      kind: 'subscription-projection',
      subscriptionId: '00000000-0000-4000-8000-000000000004',
      accountId: actor.accountId,
      state: 'active',
      plan: 'premium',
      entitlements: ['premium-actions'],
      cancelAtPeriodEnd: false,
    });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('premium_entitlements'), [
      actor.accountId,
    ]);
  });

  it('projects Free only when no active entitlement exists', async () => {
    const query = vi.fn(() => Promise.resolve({ rows: [] }));
    await expect(
      resolveStagingSubscription({ query }, actor, 'free-authority-test'),
    ).resolves.toMatchObject({ plan: 'free', state: 'none', entitlements: [] });
  });
});
