import { controlPlaneDocumentValidator } from '@liiiraa/contracts-ts';
import type { IdentityActor } from '@liiiraa/control-plane-adapters';
import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';

import {
  registerRealIdentityRoutes,
  type RealIdentityRouteAuthority,
} from '../modules/identity/real-routes.js';

const accountOrigin = 'https://account.staging.example';
const adminOrigin = 'https://admin.staging.example';
const issuer = 'https://api.staging.example';
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
    issueInvitation: vi.fn(),
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
            'https://account.staging.example/pt-BR/account/sign-in?desktop_challenge=00000000-0000-4000-8000-000000000003&state=desktop-state-abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGH',
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
  await registerRealIdentityRoutes(app, {
    accountOrigin,
    adminOrigin,
    authority: identity,
    csrfSecret: 'synthetic-auth-secret-with-at-least-32-characters',
    issuer,
  });
  await app.ready();
  return { app, identity };
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
      subscription: { plan: 'free', state: 'none' },
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
});
