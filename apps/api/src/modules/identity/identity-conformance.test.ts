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
}>;

const loadRoutes = async (): Promise<IdentityRoutesModule> =>
  import('./routes.ts').catch(() => ({}) as IdentityRoutesModule);

const loadAdapter = async (): Promise<AdapterModule> =>
  import('../../../../../packages/control-plane-adapters/src/identity/better-auth-adapter.ts').catch(
    () => ({}) as AdapterModule,
  );

const requireFunction = <T extends (...args: never[]) => unknown>(
  value: T | undefined,
  caseId: string,
): T => {
  expect(
    value,
    `EXPECTED_RED[${OWNER}][${caseId}]: production identity authority is not implemented`,
  ).toBeTypeOf('function');
  return value!;
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
    beginSignIn: async (input) => {
      if (!['password', 'google', 'discord', 'passkey'].includes(input.method)) {
        return failure('UNSUPPORTED_METHOD');
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
            email: input.email,
            consumed: false,
          };
      challenges.set(id, challenge);
      return success(challenge);
    },
    completeSignIn: async (input) => {
      const challenge = challenges.get(input.challengeId);
      if (!challenge) return failure('INVALID_CHALLENGE');
      if (challenge.consumed) return failure('REPLAYED_CHALLENGE');
      if (
        challenge.transport === 'direct' &&
        challenge.method === 'password' &&
        !input.emailVerified
      ) {
        return failure('UNVERIFIED_EMAIL');
      }
      if (challenge.transport === 'external-browser') {
        if (input.redirectUri !== challenge.redirectUri) return failure('REDIRECT_MISMATCH');
        if (input.issuer !== challenge.issuer) return failure('ISSUER_MISMATCH');
        if (input.state !== challenge.state) return failure('STATE_MISMATCH');
        if (!input.authorizationCode) return failure('INVALID_CHALLENGE');
      }
      challenges.set(challenge.id, { ...challenge, consumed: true });
      const session: IdentitySession = {
        id: `provider-session-${String(sequence)}`,
        method: challenge.method,
        strength: challenge.method === 'passkey' ? 'passkey' : 'password',
        state: 'active',
        createdAt: '2030-01-02T03:04:05.000Z',
      };
      return success(session);
    },
    verifyEmail: async () => success({ verified: true }),
    enrollFactor: async (input) => success({ factor: input.factor }),
    stepUp: async () => failure('SESSION_REVOKED'),
    listSessions: async () => success([]),
    revokeSession: async (input) => success({ sessionId: input.sessionId, state: 'revoked' }),
    beginRecovery: async () => failure('INVALID_CHALLENGE'),
    completeRecovery: async () => failure('INVALID_CHALLENGE'),
  };
};

const createHarness = async () => {
  const records = new Map<string, SessionRecord>();
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
  ]);
  const dependencies: RouteDependencies = {
    allowedOrigin: ACCOUNT_ORIGIN,
    verifyCsrf: (request) => request.headers['x-csrf-token'] === CSRF_TOKEN,
    resolveSessionActor: async (request) =>
      request.headers.authorization === 'Session local-session-1'
        ? { accountId: 'account-player' }
        : null,
    authentication: {
      provider,
      invitations: {
        admit: async ({ invitationCode, email }) => {
          const identity = identityByInvitation.get(invitationCode);
          return identity?.email === email ? identity : null;
        },
      },
      risk: { allow: async () => true },
      sessions: {
        transaction: async (operation) =>
          operation({
            issue: async (input) => {
              const record = { ...input, version: 1n };
              records.set(record.sessionId, record);
              return record;
            },
            list: async (accountId) =>
              [...records.values()].filter((record) => record.accountId === accountId),
            revoke: async (accountId, sessionId) => {
              const record = records.get(sessionId);
              if (!record || record.accountId !== accountId) return null;
              const revoked = {
                ...record,
                state: 'revoked' as const,
                version: record.version + 1n,
              };
              records.set(sessionId, revoked);
              return revoked;
            },
          }),
      },
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
  return { app, records };
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
  expect(serialized).not.toMatch(/token|secret|password|providerSession/iu);
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
    ['unverified-email', { method: 'password', emailVerified: false }, ACCOUNT_ORIGIN],
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
  ] as const)('IDEN-01 rejects forbidden launch path %s', async (_path, body, origin) => {
    const response = await authenticate(app, body, origin);
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      code: 'AUTHENTICATION_FAILED',
      message: 'Authentication failed',
    });
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
    const exchangeAuthorizationCode = vi.fn(async () => ({
      accountId: 'account-player',
      providerSessionId: 'provider-session-private',
      createdAt: '2030-01-02T03:04:05.000Z',
      expiresAt: '2030-02-01T03:04:05.000Z',
      accessToken: 'provider-access-token',
      refreshToken: 'provider-refresh-token',
    }));
    const provider = createBetterAuthAdapter(
      {
        completeDirect: async () => ({
          accountId: 'account-player',
          providerSessionId: 'provider-session-private',
          createdAt: '2030-01-02T03:04:05.000Z',
          expiresAt: '2030-02-01T03:04:05.000Z',
        }),
        exchangeAuthorizationCode,
        revokeSession: async () => undefined,
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
    const completed = await provider.completeSignIn({
      challengeId: challenge.value.id,
      authorizationCode: 'one-shot-code',
      state: challenge.value.state,
      issuer: ISSUER,
      redirectUri: REDIRECT_URI,
    });
    expect(completed.ok).toBe(true);
    expect(exchangeAuthorizationCode).toHaveBeenCalledOnce();
    const exchangeInput = exchangeAuthorizationCode.mock.calls[0]?.[0];
    expect(exchangeInput).toEqual({
      authorizationCode: 'one-shot-code',
      codeVerifier: expect.any(String),
      redirectUri: REDIRECT_URI,
      clientId: 'liiiraa-windows-public-client',
    });
    expect(JSON.stringify(exchangeInput)).not.toMatch(/secret/iu);
    expect(JSON.stringify(completed)).not.toMatch(/accessToken|refreshToken|clientSecret/iu);
  });

  it('IDEN-01 lists and revokes sessions without changing Premium device binding', async () => {
    const first = await authenticate(app, { method: 'password' });
    const second = await authenticate(app, { method: 'passkey', sessionKind: 'desktop' });
    const web = expectBoundedProjection(first.json());
    const desktop = expectBoundedProjection(second.json());
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
