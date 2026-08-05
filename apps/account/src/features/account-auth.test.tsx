import { readFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import {
  admitInvitationToken,
  createAccountAuth,
  type AccountAuthTransport,
} from '../account-auth';

const actor = Object.freeze({
  accountId: '00000000-0000-4000-8000-000000000001',
  displayName: 'Real Tester',
  email: 'tester@example.com',
  locale: 'pt-BR' as const,
  role: 'tester' as const,
  sessionId: '00000000-0000-4000-8000-000000000002',
  sessionKind: 'web' as const,
  expiresAt: '2030-02-01T00:00:00.000Z',
});

const response = (body: unknown, status = 200): Response =>
  new Response(body === undefined ? undefined : JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status,
  });

describe('real account authentication client', () => {
  it('bootstraps in-memory CSRF and signs in without sending diagnostic data', async () => {
    const transport = vi
      .fn<AccountAuthTransport>()
      .mockResolvedValueOnce(response({ token: 'csrf-token-abcdefghijklmnopqrstuvwxyz0123456789' }))
      .mockResolvedValueOnce(response({ actor }, 201));
    const auth = createAccountAuth({
      correlationId: () => 'account-auth-01',
      transport,
    });

    await expect(
      auth.signIn({ email: 'tester@example.com', password: 'CorrectHorse1' }),
    ).resolves.toEqual({ actor, status: 'authenticated' });
    expect(transport).toHaveBeenNthCalledWith(1, '/v1/identity/csrf', {
      credentials: 'include',
      headers: { accept: 'application/json', 'x-correlation-id': 'account-auth-01' },
      method: 'GET',
    });
    const signInRequest = transport.mock.calls[1]?.[1];
    expect(signInRequest).toMatchObject({ credentials: 'include', method: 'POST' });
    expect(JSON.parse(String(signInRequest?.body))).toEqual({
      email: 'tester@example.com',
      password: 'CorrectHorse1',
    });
    expect(String(signInRequest?.body)).not.toMatch(/diagnostic|device|hardware|telemetry/iu);
  });

  it('creates an invited account and restores the cookie session through a fresh client read', async () => {
    const invitationToken = 'i'.repeat(64);
    const signupTransport = vi
      .fn<AccountAuthTransport>()
      .mockResolvedValueOnce(response({ token: 'csrf-token-abcdefghijklmnopqrstuvwxyz0123456789' }))
      .mockResolvedValueOnce(response({ actor }, 201));
    const signup = createAccountAuth({
      correlationId: () => 'account-signup-01',
      transport: signupTransport,
    });
    await expect(
      signup.signUp({
        displayName: 'Real Tester',
        email: 'tester@example.com',
        invitationToken,
        locale: 'pt-BR',
        password: 'CorrectHorse1',
      }),
    ).resolves.toEqual({ actor, status: 'authenticated' });
    expect(JSON.parse(String(signupTransport.mock.calls[1]?.[1]?.body))).toEqual({
      displayName: 'Real Tester',
      email: 'tester@example.com',
      invitationToken,
      locale: 'pt-BR',
      password: 'CorrectHorse1',
    });

    const restored = createAccountAuth({
      correlationId: () => 'account-session-01',
      transport: vi.fn<AccountAuthTransport>().mockResolvedValue(response({ actor })),
    });
    await expect(restored.session()).resolves.toEqual({ actor, status: 'authenticated' });
  });

  it('uses the same generic rejection for a used invitation and a bad password', async () => {
    const rejected = () =>
      createAccountAuth({
        correlationId: () => 'account-rejected-01',
        transport: vi
          .fn<AccountAuthTransport>()
          .mockResolvedValueOnce(
            response({ token: 'csrf-token-abcdefghijklmnopqrstuvwxyz0123456789' }),
          )
          .mockResolvedValueOnce(response({ code: 'AUTHENTICATION_FAILED' }, 401)),
      });
    await expect(
      rejected().signIn({ email: 'unknown@example.com', password: 'Incorrect1A' }),
    ).resolves.toEqual({ code: 'authentication-failed', status: 'error' });
    await expect(
      rejected().signUp({
        displayName: 'Real Tester',
        email: 'tester@example.com',
        invitationToken: 'i'.repeat(64),
        locale: 'pt-BR',
        password: 'CorrectHorse1',
      }),
    ).resolves.toEqual({ code: 'authentication-failed', status: 'error' });
  });

  it('admits only bounded base64url invitation tokens', () => {
    expect(admitInvitationToken('i'.repeat(64))).toBe('i'.repeat(64));
    expect(admitInvitationToken('used invitation')).toBeNull();
    expect(admitInvitationToken('short')).toBeNull();
  });
});

describe('production account composition', () => {
  it('routes authentication to the real client and removes deterministic identity chrome', () => {
    const pageSource = readFileSync(
      new URL('../app/[locale]/[[...responsibility]]/page.tsx', import.meta.url),
      'utf8',
    );
    const layoutSource = readFileSync(new URL('../app/[locale]/layout.tsx', import.meta.url), 'utf8');
    const authSource = readFileSync(new URL('./account-auth.tsx', import.meta.url), 'utf8');

    expect(pageSource).toContain('AccountAuthPage');
    expect(pageSource).toContain('isAccountAuthRoute');
    expect(authSource).not.toContain('@liiiraa/web-preview');
    expect(layoutSource).not.toContain('Astra Player');
    expect(layoutSource).not.toContain('astra.player@example.com');
    expect(layoutSource).not.toContain('Premium · Modo Competitivo');
    expect(layoutSource).not.toContain('Premium · Competitive Mode');
  });
});
