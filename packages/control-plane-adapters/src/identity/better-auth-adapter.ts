import type {
  AuthenticationDependencies,
  SessionAuthorityPort,
  SessionAuthorityRecord,
  SessionAuthorityTransaction,
} from '@liiiraa/control-plane-application';
import type {
  IdentityProviderFailureCode,
  IdentityProviderPort,
  IdentityProviderResult,
  IdentitySession,
  IdentitySignInChallenge,
  IdentitySignInMethod,
} from '@liiiraa/control-plane-application';
export interface BetterAuthGatewaySession {
  readonly accountId: string;
  readonly providerSessionId: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly accessToken?: string;
  readonly refreshToken?: string;
}

export interface BetterAuthGateway {
  completeDirect(
    input: Readonly<{
      method: IdentitySignInMethod;
      email?: string;
      emailVerified?: boolean;
    }>,
  ): Promise<BetterAuthGatewaySession>;
  exchangeAuthorizationCode(
    input: Readonly<{
      authorizationCode: string;
      codeVerifier: string;
      redirectUri: string;
      clientId: 'liiiraa-windows-public-client';
    }>,
  ): Promise<BetterAuthGatewaySession>;
  revokeSession(input: Readonly<{ providerSessionId: string }>): Promise<void>;
}

export interface BetterAuthAdapterOptions {
  readonly issuer: string;
}

interface StoredChallenge extends IdentitySignInChallenge {
  readonly email?: string;
  readonly codeVerifier?: string;
  consumed: boolean;
}

const APPROVED_METHODS = new Set<IdentitySignInMethod>([
  'password',
  'google',
  'discord',
  'passkey',
]);
const CLIENT_ID = 'liiiraa-windows-public-client' as const;

const success = <T>(value: T): IdentityProviderResult<T> => ({ ok: true, value });
const failure = <T>(code: IdentityProviderFailureCode): IdentityProviderResult<T> => ({
  ok: false,
  code,
  retryable: code === 'ADAPTER_UNAVAILABLE' || code === 'RATE_LIMITED',
});

const base64Url = (bytes: Uint8Array): string => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
};

const randomToken = (bytes: number): string =>
  base64Url(crypto.getRandomValues(new Uint8Array(bytes)));

const s256 = async (value: string): Promise<string> =>
  base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))));

const exactLoopbackRedirect = (redirectUri: string): boolean => {
  try {
    const url = new URL(redirectUri);
    return (
      url.protocol === 'http:' &&
      url.hostname === '127.0.0.1' &&
      url.port.length > 0 &&
      url.pathname === '/oauth/callback' &&
      url.username.length === 0 &&
      url.password.length === 0 &&
      url.search.length === 0 &&
      url.hash.length === 0
    );
  } catch {
    return false;
  }
};

const boundedSession = (
  challenge: StoredChallenge,
  gatewaySession: BetterAuthGatewaySession,
): IdentitySession => ({
  id: gatewaySession.providerSessionId,
  accountId: gatewaySession.accountId,
  method: challenge.method,
  strength: challenge.method === 'passkey' ? 'passkey' : 'password',
  state: 'active',
  createdAt: gatewaySession.createdAt,
});

export const createBetterAuthAdapter = (
  gateway: BetterAuthGateway,
  options: BetterAuthAdapterOptions,
): IdentityProviderPort => {
  const challenges = new Map<string, StoredChallenge>();
  const sessions = new Map<string, IdentitySession>();
  const attempts = new Map<string, number>();

  return {
    beginSignIn: async (input) => {
      if (!APPROVED_METHODS.has(input.method)) return failure('UNSUPPORTED_METHOD');
      const attemptKey = `${input.method}:${input.email ?? 'desktop'}`;
      const attemptCount = (attempts.get(attemptKey) ?? 0) + 1;
      attempts.set(attemptKey, attemptCount);
      if (attemptCount > 5) return failure('RATE_LIMITED');

      const id = `challenge_${crypto.randomUUID().replaceAll('-', '')}`;
      if (!input.desktop) {
        const challenge: StoredChallenge = {
          id,
          method: input.method,
          transport: 'direct',
          ...(input.email ? { email: input.email } : {}),
          consumed: false,
        };
        challenges.set(id, challenge);
        return success(challenge);
      }

      if (!exactLoopbackRedirect(input.desktop.redirectUri)) {
        return failure('REDIRECT_MISMATCH');
      }
      if (input.desktop.issuer !== options.issuer) return failure('ISSUER_MISMATCH');

      const state = randomToken(32);
      const codeVerifier = randomToken(48);
      const codeChallenge = await s256(codeVerifier);
      const authorizationUrl = new URL('/api/auth/oauth2/authorize', options.issuer);
      authorizationUrl.searchParams.set('response_type', 'code');
      authorizationUrl.searchParams.set('client_id', CLIENT_ID);
      authorizationUrl.searchParams.set('redirect_uri', input.desktop.redirectUri);
      authorizationUrl.searchParams.set('state', state);
      authorizationUrl.searchParams.set('code_challenge', codeChallenge);
      authorizationUrl.searchParams.set('code_challenge_method', 'S256');

      const challenge: StoredChallenge = {
        id,
        method: input.method,
        transport: 'external-browser',
        authorizationUrl: authorizationUrl.toString(),
        state,
        codeChallenge,
        codeChallengeMethod: 'S256',
        redirectUri: input.desktop.redirectUri,
        issuer: input.desktop.issuer,
        codeVerifier,
        consumed: false,
      };
      challenges.set(id, challenge);
      return success(challenge);
    },

    completeSignIn: async (input) => {
      const challenge = challenges.get(input.challengeId);
      if (!challenge) return failure('INVALID_CHALLENGE');
      if (challenge.consumed) return failure('REPLAYED_CHALLENGE');

      try {
        let gatewaySession: BetterAuthGatewaySession;
        if (challenge.transport === 'external-browser') {
          if (input.redirectUri !== challenge.redirectUri) return failure('REDIRECT_MISMATCH');
          if (input.issuer !== challenge.issuer) return failure('ISSUER_MISMATCH');
          if (input.state !== challenge.state) return failure('STATE_MISMATCH');
          if (!input.authorizationCode || !challenge.codeVerifier || !challenge.redirectUri) {
            return failure('INVALID_CHALLENGE');
          }
          gatewaySession = await gateway.exchangeAuthorizationCode({
            authorizationCode: input.authorizationCode,
            codeVerifier: challenge.codeVerifier,
            redirectUri: challenge.redirectUri,
            clientId: CLIENT_ID,
          });
        } else {
          if (challenge.method === 'password' && input.emailVerified !== true) {
            return failure('UNVERIFIED_EMAIL');
          }
          gatewaySession = await gateway.completeDirect({
            method: challenge.method,
            ...(challenge.email ? { email: challenge.email } : {}),
            ...(input.emailVerified === undefined ? {} : { emailVerified: input.emailVerified }),
          });
        }

        challenge.consumed = true;
        const session = boundedSession(challenge, gatewaySession);
        sessions.set(session.id, session);
        return success(session);
      } catch {
        return failure('ADAPTER_UNAVAILABLE');
      }
    },

    verifyEmail: () => Promise.resolve(failure('ADAPTER_UNAVAILABLE')),
    enrollFactor: () => Promise.resolve(failure('ADAPTER_UNAVAILABLE')),
    stepUp: () => Promise.resolve(failure('ADAPTER_UNAVAILABLE')),
    listSessions: () => Promise.resolve(success([...sessions.values()])),
    revokeSession: async (input) => {
      const session = sessions.get(input.sessionId);
      if (!session) return failure('SESSION_REVOKED');
      try {
        await gateway.revokeSession({ providerSessionId: input.sessionId });
      } catch {
        return failure('ADAPTER_UNAVAILABLE');
      }
      sessions.set(input.sessionId, { ...session, state: 'revoked' });
      return success({ sessionId: input.sessionId, state: 'revoked' });
    },
    beginRecovery: () => Promise.resolve(failure('ADAPTER_UNAVAILABLE')),
    completeRecovery: () => Promise.resolve(failure('ADAPTER_UNAVAILABLE')),
  };
};

interface SessionRow extends Record<string, unknown> {
  readonly id: string;
  readonly identity_id: string;
  readonly provider_session_id: string;
  readonly session_kind: 'web' | 'desktop';
  readonly token_digest: string;
  readonly issued_at: Date | string;
  readonly expires_at: Date | string;
  readonly last_seen_at: Date | string | null;
  readonly revoked_at: Date | string | null;
  readonly version: bigint | number | string;
}

interface PostgresSessionTransaction {
  query(
    statement: string,
    values?: readonly unknown[],
  ): Promise<Readonly<{ rows: readonly Record<string, unknown>[] }>>;
}

export interface PostgresSessionDatabase {
  transaction<T>(operation: (transaction: PostgresSessionTransaction) => Promise<T>): Promise<T>;
}

const instant = (value: Date | string): Date => (value instanceof Date ? value : new Date(value));

const sessionRow = (value: Record<string, unknown>): SessionRow => {
  if (
    typeof value['id'] !== 'string' ||
    typeof value['identity_id'] !== 'string' ||
    typeof value['provider_session_id'] !== 'string' ||
    (value['session_kind'] !== 'web' && value['session_kind'] !== 'desktop') ||
    typeof value['token_digest'] !== 'string' ||
    (!(value['issued_at'] instanceof Date) && typeof value['issued_at'] !== 'string') ||
    (!(value['expires_at'] instanceof Date) && typeof value['expires_at'] !== 'string') ||
    (value['last_seen_at'] !== null &&
      !(value['last_seen_at'] instanceof Date) &&
      typeof value['last_seen_at'] !== 'string') ||
    (value['revoked_at'] !== null &&
      !(value['revoked_at'] instanceof Date) &&
      typeof value['revoked_at'] !== 'string') ||
    !['bigint', 'number', 'string'].includes(typeof value['version'])
  ) {
    throw new Error('Session authority returned an invalid row.');
  }
  return value as unknown as SessionRow;
};

const mapSessionRow = (
  row: SessionRow,
  method: IdentitySignInMethod,
  now: Date,
): SessionAuthorityRecord => ({
  sessionId: row.id,
  accountId: row.identity_id,
  providerSessionId: row.provider_session_id,
  kind: row.session_kind,
  tokenDigest: row.token_digest,
  method,
  state:
    row.revoked_at !== null
      ? 'revoked'
      : instant(row.expires_at).getTime() <= now.getTime()
        ? 'expired'
        : 'active',
  issuedAt: instant(row.issued_at).toISOString(),
  expiresAt: instant(row.expires_at).toISOString(),
  lastSeenAt: instant(row.last_seen_at ?? row.issued_at).toISOString(),
  version: BigInt(row.version),
});

export const createPostgresSessionAuthority = (
  database: PostgresSessionDatabase,
): SessionAuthorityPort => ({
  transaction: async <T>(operation: (authority: SessionAuthorityTransaction) => Promise<T>) =>
    database.transaction(async (transaction) =>
      operation({
        issue: async (input) => {
          const result = await transaction.query(
            `INSERT INTO sessions (
               id, identity_id, provider_session_id, session_kind, token_digest,
               issued_at, expires_at, last_seen_at, version, created_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, $6)
             RETURNING id, identity_id, provider_session_id, session_kind, token_digest,
                       issued_at, expires_at, last_seen_at, revoked_at, version`,
            [
              input.sessionId,
              input.accountId,
              input.providerSessionId,
              input.kind,
              input.tokenDigest,
              input.issuedAt,
              input.expiresAt,
              input.lastSeenAt,
            ],
          );
          const rawRow = result.rows[0];
          const row = rawRow ? sessionRow(rawRow) : undefined;
          if (!row) throw new Error('Session authority did not return the issued session.');
          return mapSessionRow(row, input.method, new Date(input.issuedAt));
        },
        list: async (accountId) => {
          const result = await transaction.query(
            `SELECT id, identity_id, provider_session_id, session_kind, token_digest,
                    issued_at, expires_at, last_seen_at, revoked_at, version
             FROM sessions
             WHERE identity_id = $1
             ORDER BY issued_at ASC`,
            [accountId],
          );
          const now = new Date();
          return result.rows.map((row) => mapSessionRow(sessionRow(row), 'password', now));
        },
        revoke: async (accountId, sessionId, revokedAt) => {
          const revokedInstant = revokedAt ?? new Date().toISOString();
          const result = await transaction.query(
            `UPDATE sessions
             SET revoked_at = $3, version = version + 1
             WHERE identity_id = $1 AND id = $2 AND revoked_at IS NULL
             RETURNING id, identity_id, provider_session_id, session_kind, token_digest,
                       issued_at, expires_at, last_seen_at, revoked_at, version`,
            [accountId, sessionId, revokedInstant],
          );
          const rawRow = result.rows[0];
          const row = rawRow ? sessionRow(rawRow) : undefined;
          return row ? mapSessionRow(row, 'password', new Date(revokedInstant)) : null;
        },
      }),
    ),
});

export type IdentityRuntimeDependencies = AuthenticationDependencies;
