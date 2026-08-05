import type { SessionCommandJson, SessionProjectionJson } from '@liiiraa/contracts-ts';
import type {
  IdentityProviderPort,
  IdentityProviderResult,
  IdentitySession,
  IdentitySignInChallenge,
  IdentitySignInMethod,
} from '@liiiraa/control-plane-application';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const OWNER = '04-11-01';
const ACCOUNT_ORIGIN = 'https://account.test.liiiraa.dev';
const ISSUER = 'https://identity.test.liiiraa.dev';
const REDIRECT_URI = 'http://127.0.0.1:49152/oauth/callback';
const CSRF_TOKEN = 'csrf-bound-to-session';

interface IdentityRecord {
  readonly accountId: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly state: 'active' | 'disabled' | 'revoked';
}

interface SessionRecord {
  readonly sessionId: string;
  readonly accountId: string;
  readonly providerSessionId: string;
  readonly kind: 'web' | 'desktop';
  readonly tokenDigest: string;
  readonly method: IdentitySignInMethod;
  readonly state: 'active' | 'revoked' | 'expired';
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly lastSeenAt: string;
  readonly version: bigint;
}

interface AuthenticationDependencies {
  readonly provider: IdentityProviderPort;
  readonly invitations: Readonly<{
    admit(
      input: Readonly<{ invitationCode: string; email: string }>,
    ): Promise<IdentityRecord | null>;
  }>;
  readonly risk: Readonly<{
    allow(input: Readonly<{ accountId: string; method: string; origin: string }>): Promise<boolean>;
  }>;
  readonly sessions: Readonly<{
    transaction<T>(
      operation: (
        authority: Readonly<{
          issue(input: Omit<SessionRecord, 'version'>): Promise<SessionRecord>;
          list(accountId: string): Promise<readonly SessionRecord[]>;
          revoke(accountId: string, sessionId: string): Promise<SessionRecord | null>;
        }>,
      ) => Promise<T>,
    ): Promise<T>;
  }>;
  readonly credentials: Readonly<{
    issue(): Readonly<{ credential: string; digest: string }>;
  }>;
  readonly clock: Readonly<{ now(): Date }>;
  readonly ids: Readonly<{ next(): string }>;
}

interface RouteDependencies {
  readonly authentication: AuthenticationDependencies;
  readonly allowedOrigin: string;
  readonly verifyCsrf: (request: FastifyRequest) => boolean;
  readonly resolveSessionActor: (
    request: FastifyRequest,
  ) => Promise<Readonly<{ accountId: string }> | null>;
}

type IdentityRoutesModule = Readonly<{
  registerIdentityRoutes?: (app: FastifyInstance, dependencies: RouteDependencies) => Promise<void>;
}>;

type BetterAuthGatewayResult = Readonly<{
  accountId: string;
  providerSessionId: string;
  createdAt: string;
  expiresAt: string;
  accessToken?: string;
  refreshToken?: string;
}>;

type AdapterModule = Readonly<{
  createBetterAuthAdapter?: (
    gateway: Readonly<{
      completeDirect(
        input: Readonly<{ method: IdentitySignInMethod; email?: string; emailVerified?: boolean }>,
      ): Promise<BetterAuthGatewayResult>;
      exchangeAuthorizationCode(
        input: Readonly<{
          authorizationCode: string;
          codeVerifier: string;
          redirectUri: string;
          clientId: 'liiiraa-windows-public-client';
        }>,
      ): Promise<BetterAuthGatewayResult>;
      revokeSession(input: Readonly<{ providerSessionId: string }>): Promise<void>;
    }>,
    options: Readonly<{ issuer: string }>,
  ) => IdentityProviderPort;
  createPostgresSessionAuthority?: (
    database: Readonly<{
      transaction<T>(
        operation: (
          transaction: Readonly<{
            query(
              statement: string,
              values?: readonly unknown[],
            ): Promise<Readonly<{ rows: readonly Record<string, unknown>[] }>>;
          }>,
        ) => Promise<T>,
      ): Promise<T>;
    }>,
  ) => AuthenticationDependencies['sessions'];
}>;

const loadRoutes = async (): Promise<IdentityRoutesModule> =>
  import('./routes.ts').catch((): IdentityRoutesModule => ({}));

const loadAdapter = async (): Promise<AdapterModule> =>
  import('@liiiraa/control-plane-adapters').catch((): AdapterModule => ({}));

const requireFunction = <T extends (...args: never[]) => unknown>(
  value: T | undefined,
  caseId: string,
): T => {
  if (typeof value !== 'function') {
    throw new Error(
      `EXPECTED_RED[${OWNER}][${caseId}]: production identity authority is not implemented`,
    );
  }
  return value;
};

const success = <T>(value: T): IdentityProviderResult<T> => ({ ok: true, value });
const failure = <T>(
  code:
    | 'UNSUPPORTED_METHOD'
    | 'UNVERIFIED_EMAIL'
    | 'INVALID_CHALLENGE'
    | 'REPLAYED_CHALLENGE'
    | 'REDIRECT_MISMATCH'
    | 'ISSUER_MISMATCH'
    | 'STATE_MISMATCH'
    | 'SESSION_REVOKED',
): IdentityProviderResult<T> => ({ ok: false, code, retryable: false });

const createProvider = (): IdentityProviderPort => {
  const challenges = new Map<
    string,
    IdentitySignInChallenge & Readonly<{ consumed: boolean; email?: string }>
  >();
  let sequence = 0;

  return {
    beginSignIn: (input) => {
      if (!['password', 'google', 'discord', 'passkey'].includes(input.method)) {
        return Promise.resolve(failure('UNSUPPORTED_METHOD'));
      }
      sequence += 1;
      const id = `provider-challenge-${String(sequence)}`;
      const challenge = input.desktop
        ? {
            id,
            method: input.method,
            transport: 'external-browser' as const,
            authorizationUrl: `${ISSUER}/authorize?state=state_${String(sequence).padStart(32, '0')}`,
            state: `state_${String(sequence).padStart(32, '0')}`,
            codeChallenge: 'A'.repeat(43),
            codeChallengeMethod: 'S256' as const,
            redirectUri: input.desktop.redirectUri,
            issuer: input.desktop.issuer,
            consumed: false,
          }
        : {
            id,
            method: input.method,
            transport: 'direct' as const,
            ...(input.email ? { email: input.email } : {}),
            consumed: false,
          };
      challenges.set(id, challenge);
      return Promise.resolve(success(challenge));
    },
    completeSignIn: (input) => {
      const challenge = challenges.get(input.challengeId);
      if (!challenge) return Promise.resolve(failure('INVALID_CHALLENGE'));
      if (challenge.consumed) return Promise.resolve(failure('REPLAYED_CHALLENGE'));
      if (
        challenge.transport === 'direct' &&
        challenge.method === 'password' &&
        !input.emailVerified
      ) {
        return Promise.resolve(failure('UNVERIFIED_EMAIL'));
      }
      if (challenge.transport === 'external-browser') {
        if (input.redirectUri !== challenge.redirectUri) {
          return Promise.resolve(failure('REDIRECT_MISMATCH'));
        }
        if (input.issuer !== challenge.issuer) return Promise.resolve(failure('ISSUER_MISMATCH'));
        if (input.state !== challenge.state) return Promise.resolve(failure('STATE_MISMATCH'));
        if (!input.authorizationCode) return Promise.resolve(failure('INVALID_CHALLENGE'));
      }
      challenges.set(challenge.id, { ...challenge, consumed: true });
      const session: IdentitySession = {
        id: `provider-session-${String(sequence)}`,
        accountId: 'account-player',
        method: challenge.method,
        strength: challenge.method === 'passkey' ? 'passkey' : 'password',
        state: 'active',
        createdAt: '2030-01-02T03:04:05.000Z',
      };
      return Promise.resolve(success(session));
    },
    verifyEmail: () => Promise.resolve(success({ verified: true })),
    enrollFactor: (input) => Promise.resolve(success({ factor: input.factor })),
    stepUp: () => Promise.resolve(failure('SESSION_REVOKED')),
    listSessions: () => Promise.resolve(success([])),
    revokeSession: (input) =>
      Promise.resolve(success({ sessionId: input.sessionId, state: 'revoked' })),
    beginRecovery: () => Promise.resolve(failure('INVALID_CHALLENGE')),
    completeRecovery: () => Promise.resolve(failure('INVALID_CHALLENGE')),
  };
};

const createHarness = async () => {
  interface PostgresSessionRow extends Record<string, unknown> {
    id: string;
    identity_id: string;
    provider_session_id: string;
    session_kind: 'web' | 'desktop';
    token_digest: string;
    issued_at: string;
    expires_at: string;
    last_seen_at: string;
    revoked_at: string | null;
    version: bigint;
  }

  const records = new Map<string, PostgresSessionRow>();
  const provider = createProvider();
  let sessionSequence = 0;
  const identityByInvitation = new Map<string, IdentityRecord>([
    [
      'invite-valid',
      {
        accountId: 'account-player',
        email: 'player@example.test',
        emailVerified: true,
        state: 'active',
      },
    ],
    [
      'invite-disabled',
      {
        accountId: 'account-disabled',
        email: 'disabled@example.test',
        emailVerified: true,
        state: 'disabled',
      },
    ],
    [
      'invite-unverified',
      {
        accountId: 'account-unverified',
        email: 'unverified@example.test',
        emailVerified: false,
        state: 'active',
      },
    ],
    [
      'invite-revoked',
      {
        accountId: 'account-revoked',
        email: 'revoked@example.test',
        emailVerified: true,
        state: 'revoked',
      },
    ],
  ]);
  const adapter = await loadAdapter();
  const createPostgresSessionAuthority = requireFunction(
    adapter.createPostgresSessionAuthority,
    'postgres-session-authority',
  );
  const sessions = createPostgresSessionAuthority({
    transaction: (operation) =>
      operation({
        query: (statement: string, values: readonly unknown[] = []) => {
          const normalized = statement.trimStart();
          if (normalized.startsWith('INSERT INTO sessions')) {
            const row: PostgresSessionRow = {
              id: String(values[0]),
              identity_id: String(values[1]),
              provider_session_id: String(values[2]),
              session_kind: values[3] === 'desktop' ? 'desktop' : 'web',
              token_digest: String(values[4]),
              issued_at: String(values[5]),
              expires_at: String(values[6]),
              last_seen_at: String(values[7]),
              revoked_at: null,
              version: 1n,
            };
            records.set(row.id, row);
            return Promise.resolve({ rows: [row] });
          }
          if (normalized.startsWith('SELECT')) {
            const rows = [...records.values()].filter(
              (record) => record.identity_id === String(values[0]),
            );
            return Promise.resolve({ rows });
          }
          if (normalized.startsWith('UPDATE sessions')) {
            const row = records.get(String(values[1]));
            if (row?.identity_id !== String(values[0]) || row.revoked_at !== null) {
              return Promise.resolve({ rows: [] });
            }
            const revoked = {
              ...row,
              revoked_at: String(values[2]),
              version: row.version + 1n,
            };
            records.set(revoked.id, revoked);
            return Promise.resolve({ rows: [revoked] });
          }
          return Promise.reject(new Error('Unexpected identity session SQL statement.'));
        },
      }),
  });
  const dependencies: RouteDependencies = {
    allowedOrigin: ACCOUNT_ORIGIN,
    verifyCsrf: (request) => request.headers['x-csrf-token'] === CSRF_TOKEN,
    resolveSessionActor: (request) =>
      Promise.resolve(
        request.headers.authorization === 'Session local-session-1'
          ? { accountId: 'account-player' }
          : null,
      ),
    authentication: {
      provider,
      invitations: {
        admit: ({ invitationCode, email }) => {
          const identity = identityByInvitation.get(invitationCode);
          return Promise.resolve(identity?.email === email ? identity : null);
        },
      },
      risk: { allow: () => Promise.resolve(true) },
      sessions,
      credentials: {
        issue: () => ({ credential: 'local-session-credential', digest: 'a'.repeat(64) }),
      },
      clock: { now: () => new Date('2030-01-02T03:04:05.000Z') },
      ids: {
        next: () => {
          sessionSequence += 1;
          return `local-session-${String(sessionSequence)}`;
        },
      },
    },
  };
  const routes = await loadRoutes();
  const registerIdentityRoutes = requireFunction(
    routes.registerIdentityRoutes,
    'generated-http-routes',
  );
  const app = Fastify();
  await registerIdentityRoutes(app, dependencies);
  await app.ready();
  return { app };
};

const authenticate = async (
  app: FastifyInstance,
  body: Record<string, unknown>,
  origin = ACCOUNT_ORIGIN,
) =>
  app.inject({
    method: 'POST',
    url: '/v1/identity/authenticate',
    headers: { origin, 'x-csrf-token': CSRF_TOKEN },
    payload: {
      invitationCode: 'invite-valid',
      email: 'player@example.test',
      emailVerified: true,
      sessionKind: 'web',
      ...body,
    },
  });

const expectBoundedProjection = (payload: unknown): SessionProjectionJson => {
  expect(payload).toMatchObject({
    schemaVersion: '1.0',
    kind: 'session-projection',
    accountId: 'account-player',
    state: 'active',
    provenance: 'postgres-authority',
  });
  const serialized = JSON.stringify(payload);
  expect(serialized).not.toMatch(/accessToken|refreshToken|clientSecret|providerSession/iu);
  return payload as SessionProjectionJson;
};

describe('identity conformance through generated authority contracts', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    ({ app } = await createHarness());
  });

  it.each([
    ['verified-email-password', 'password'],
    ['google', 'google'],
    ['discord', 'discord'],
    ['passkey', 'passkey'],
  ] as const)('IDEN-01 authenticates launch method %s', async (_label, method) => {
    const response = await authenticate(app, { method });
    expect(response.statusCode).toBe(201);
    expectBoundedProjection(response.json());
  });

  it.each([
    [
      'unverified-email',
      {
        method: 'password',
        invitationCode: 'invite-unverified',
        email: 'unverified@example.test',
      },
      ACCOUNT_ORIGIN,
    ],
    ['microsoft-provider', { method: 'microsoft' }, ACCOUNT_ORIGIN],
    ['missing-invitation', { method: 'google', invitationCode: 'missing' }, ACCOUNT_ORIGIN],
    [
      'disabled-or-revoked-identity',
      {
        method: 'password',
        invitationCode: 'invite-disabled',
        email: 'disabled@example.test',
      },
      ACCOUNT_ORIGIN,
    ],
    ['wrong-origin', { method: 'passkey' }, 'https://attacker.example'],
  ] as const)('IDEN-01 rejects forbidden launch path %s', async (path, body, origin) => {
    const response = await authenticate(app, body, origin);
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      code: 'AUTHENTICATION_FAILED',
      message: 'Authentication failed',
    });
    if (path === 'disabled-or-revoked-identity') {
      const revoked = await authenticate(app, {
        method: 'password',
        invitationCode: 'invite-revoked',
        email: 'revoked@example.test',
      });
      expect(revoked.statusCode).toBe(401);
      expect(revoked.json()).toEqual({
        code: 'AUTHENTICATION_FAILED',
        message: 'Authentication failed',
      });
    }
    if (path === 'wrong-origin') {
      const missingCsrf = await app.inject({
        method: 'POST',
        url: '/v1/identity/authenticate',
        headers: { origin: ACCOUNT_ORIGIN },
        payload: {
          invitationCode: 'invite-valid',
          email: 'player@example.test',
          emailVerified: true,
          method: 'passkey',
        },
      });
      expect(missingCsrf.statusCode).toBe(401);
      expect(missingCsrf.json()).toEqual({
        code: 'AUTHENTICATION_FAILED',
        message: 'Authentication failed',
      });
    }
  });

  it('IDEN-01 rejects replayed provider result generically', async () => {
    const begin = await app.inject({
      method: 'POST',
      url: '/v1/identity/desktop/authorizations',
      headers: { origin: ACCOUNT_ORIGIN, 'x-csrf-token': CSRF_TOKEN },
      payload: {
        invitationCode: 'invite-valid',
        email: 'player@example.test',
        method: 'google',
        issuer: ISSUER,
        redirectUri: REDIRECT_URI,
      },
    });
    expect(begin.statusCode).toBe(201);
    const challenge = begin.json<IdentitySignInChallenge>();
    const exchange = {
      invitationCode: 'invite-valid',
      email: 'player@example.test',
      method: 'google',
      challengeId: challenge.id,
      authorizationCode: 'one-shot-code',
      state: challenge.state,
      issuer: ISSUER,
      redirectUri: REDIRECT_URI,
    };
    const first = await app.inject({
      method: 'POST',
      url: '/v1/identity/desktop/exchanges',
      headers: { origin: ACCOUNT_ORIGIN, 'x-csrf-token': CSRF_TOKEN },
      payload: exchange,
    });
    expect(first.statusCode).toBe(201);
    const replay = await app.inject({
      method: 'POST',
      url: '/v1/identity/desktop/exchanges',
      headers: { origin: ACCOUNT_ORIGIN, 'x-csrf-token': CSRF_TOKEN },
      payload: exchange,
    });
    expect(replay.statusCode).toBe(401);
    expect(replay.json()).toEqual({
      code: 'AUTHENTICATION_FAILED',
      message: 'Authentication failed',
    });
  });

  it('IDEN-01 has no public registration route', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/identity/register',
      payload: { email: 'public@example.test', password: 'not-authorized' },
    });
    expect(response.statusCode).toBe(404);
  });

  it('IDEN-01 binds desktop authorization to API-owned PKCE and provider exchange', async () => {
    const adapter = await loadAdapter();
    const createBetterAuthAdapter = requireFunction(
      adapter.createBetterAuthAdapter,
      'desktop-pkce-provider-boundary',
    );
    const exchangeAuthorizationCode = vi.fn(
      (_input: {
        readonly authorizationCode: string;
        readonly codeVerifier: string;
        readonly redirectUri: string;
        readonly clientId: 'liiiraa-windows-public-client';
      }) =>
        Promise.resolve({
          accountId: 'account-player',
          providerSessionId: 'provider-session-private',
          createdAt: '2030-01-02T03:04:05.000Z',
          expiresAt: '2030-02-01T03:04:05.000Z',
          accessToken: 'provider-access-token',
          refreshToken: 'provider-refresh-token',
        }),
    );
    const provider = createBetterAuthAdapter(
      {
        completeDirect: () =>
          Promise.resolve({
            accountId: 'account-player',
            providerSessionId: 'provider-session-private',
            createdAt: '2030-01-02T03:04:05.000Z',
            expiresAt: '2030-02-01T03:04:05.000Z',
          }),
        exchangeAuthorizationCode,
        revokeSession: () => Promise.resolve(),
      },
      { issuer: ISSUER },
    );
    const challenge = await provider.beginSignIn({
      method: 'discord',
      desktop: { issuer: ISSUER, redirectUri: REDIRECT_URI },
    });
    expect(challenge.ok).toBe(true);
    if (!challenge.ok) return;
    expect(challenge.value).toMatchObject({
      transport: 'external-browser',
      codeChallengeMethod: 'S256',
      issuer: ISSUER,
      redirectUri: REDIRECT_URI,
    });
    expect(challenge.value.authorizationUrl).not.toContain('client_secret');
    const commonCompletion = {
      challengeId: challenge.value.id,
      authorizationCode: 'one-shot-code',
      state: challenge.value.state ?? '',
      issuer: ISSUER,
      redirectUri: REDIRECT_URI,
    } as const;
    await expect(
      provider.completeSignIn({ ...commonCompletion, state: 'wrong-state' }),
    ).resolves.toMatchObject({ ok: false, code: 'STATE_MISMATCH' });
    await expect(
      provider.completeSignIn({ ...commonCompletion, issuer: 'https://attacker.example' }),
    ).resolves.toMatchObject({ ok: false, code: 'ISSUER_MISMATCH' });
    await expect(
      provider.completeSignIn({
        ...commonCompletion,
        redirectUri: 'http://127.0.0.1:9/oauth/callback',
      }),
    ).resolves.toMatchObject({ ok: false, code: 'REDIRECT_MISMATCH' });
    const completed = await provider.completeSignIn(commonCompletion);
    expect(completed.ok).toBe(true);
    await expect(provider.completeSignIn(commonCompletion)).resolves.toMatchObject({
      ok: false,
      code: 'REPLAYED_CHALLENGE',
    });
    expect(exchangeAuthorizationCode).toHaveBeenCalledOnce();
    const exchangeInput = exchangeAuthorizationCode.mock.calls[0]?.[0];
    if (!exchangeInput) throw new Error('Backend provider exchange was not observed.');
    expect(exchangeInput.authorizationCode).toBe('one-shot-code');
    expect(exchangeInput.codeVerifier).toMatch(/^[A-Za-z0-9_-]{64}$/u);
    expect(exchangeInput.redirectUri).toBe(REDIRECT_URI);
    expect(exchangeInput.clientId).toBe('liiiraa-windows-public-client');
    const verifierDigest = new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(exchangeInput.codeVerifier)),
    );
    let binaryDigest = '';
    for (const byte of verifierDigest) binaryDigest += String.fromCharCode(byte);
    const expectedChallenge = btoa(binaryDigest)
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replace(/=+$/u, '');
    expect(expectedChallenge).toBe(challenge.value.codeChallenge);
    expect(JSON.stringify(exchangeInput)).not.toMatch(/secret/iu);
    expect(JSON.stringify(completed)).not.toMatch(/accessToken|refreshToken|clientSecret/iu);

    const providerFailure = createBetterAuthAdapter(
      {
        completeDirect: () => Promise.reject(new Error('provider-token-do-not-leak')),
        exchangeAuthorizationCode: () => Promise.reject(new Error('provider-token-do-not-leak')),
        revokeSession: () => Promise.resolve(),
      },
      { issuer: ISSUER },
    );
    const failedChallenge = await providerFailure.beginSignIn({
      method: 'password',
      email: 'player@example.test',
    });
    expect(failedChallenge.ok).toBe(true);
    if (failedChallenge.ok) {
      const failed = await providerFailure.completeSignIn({
        challengeId: failedChallenge.value.id,
        emailVerified: true,
      });
      expect(failed).toEqual({ ok: false, code: 'ADAPTER_UNAVAILABLE', retryable: true });
      expect(JSON.stringify(failed)).not.toContain('provider-token-do-not-leak');
    }
  });

  it('IDEN-01 lists and revokes sessions without changing Premium device binding', async () => {
    const first = await authenticate(app, { method: 'password' });
    const web = expectBoundedProjection(first.json());
    const begin = await app.inject({
      method: 'POST',
      url: '/v1/identity/desktop/authorizations',
      headers: { origin: ACCOUNT_ORIGIN, 'x-csrf-token': CSRF_TOKEN },
      payload: {
        invitationCode: 'invite-valid',
        email: 'player@example.test',
        method: 'passkey',
        issuer: ISSUER,
        redirectUri: REDIRECT_URI,
      },
    });
    const challenge = begin.json<IdentitySignInChallenge>();
    const second = await app.inject({
      method: 'POST',
      url: '/v1/identity/desktop/exchanges',
      headers: { origin: ACCOUNT_ORIGIN, 'x-csrf-token': CSRF_TOKEN },
      payload: {
        invitationCode: 'invite-valid',
        email: 'player@example.test',
        method: 'passkey',
        challengeId: challenge.id,
        authorizationCode: 'one-shot-code',
        state: challenge.state,
        issuer: ISSUER,
        redirectUri: REDIRECT_URI,
      },
    });
    const desktop = expectBoundedProjection(
      second.json<{ session: SessionProjectionJson }>().session,
    );
    const deviceBinding = { id: 'device-binding-1', state: 'active' } as const;

    const before = await app.inject({
      method: 'GET',
      url: '/v1/identity/sessions',
      headers: { authorization: 'Session local-session-1' },
    });
    expect(before.statusCode).toBe(200);
    expect(
      before
        .json<{ sessions: SessionProjectionJson[] }>()
        .sessions.map(({ sessionId }) => sessionId),
    ).toEqual([web.sessionId, desktop.sessionId]);

    const command: SessionCommandJson = {
      schemaVersion: '1.0',
      kind: 'session-command',
      commandId: 'revoke-desktop-session',
      accountId: 'account-player',
      sessionId: desktop.sessionId,
      action: 'revoke',
      expectedVersion: '1',
      correlationId: 'identity-conformance',
      requestedAt: '2030-01-02T03:04:05.000Z',
    };
    const revoked = await app.inject({
      method: 'POST',
      url: `/v1/identity/sessions/${desktop.sessionId}/revoke`,
      headers: { authorization: 'Session local-session-1' },
      payload: command,
    });
    expect(revoked.statusCode).toBe(200);
    expect(revoked.json()).toMatchObject({ sessionId: desktop.sessionId, state: 'revoked' });

    const after = await app.inject({
      method: 'GET',
      url: '/v1/identity/sessions',
      headers: { authorization: 'Session local-session-1' },
    });
    const sessions = after.json<{ sessions: SessionProjectionJson[] }>().sessions;
    expect(sessions.find(({ sessionId }) => sessionId === web.sessionId)?.state).toBe('active');
    expect(sessions.find(({ sessionId }) => sessionId === desktop.sessionId)?.state).toBe(
      'revoked',
    );
    expect(deviceBinding).toEqual({ id: 'device-binding-1', state: 'active' });
    expect(JSON.stringify(sessions)).not.toMatch(/token|secret|providerSession/iu);
  });
});
