import type {
  IdentityActionScope,
  IdentityProviderFailureCode,
  IdentityProviderPort,
  IdentityProviderResult,
  IdentityRecoveryChallenge,
  IdentitySession,
  IdentitySignInChallenge,
  IdentitySignInMethod,
} from '@liiiraa/control-plane-application';

export interface BetterAuthRuntimeEvidence {
  readonly packageVersions: Readonly<{
    betterAuth: '1.6.25';
    passkey: '1.6.25';
    oauthProvider: '1.6.25';
  }>;
  readonly requireEmailVerification: true;
  readonly socialProviders: readonly ['google', 'discord'];
  readonly pluginIds: readonly ['two-factor', 'passkey', 'jwt', 'oauth-provider'];
  readonly apiNames: readonly string[];
  readonly twoFactorEndpoints: readonly string[];
  readonly passkeyEndpoints: readonly string[];
  readonly oauthProviderEndpoints: readonly string[];
  readonly nativeClient: Readonly<{
    type: 'native';
    tokenEndpointAuthMethod: 'none';
    requirePkce: true;
    codeChallengeMethod: 'S256';
    backendCodeExchange: true;
    tokenEndpointPath: '/oauth2/token';
    tokenEndpointMethod: 'POST';
    acceptsPublicCodeExchangeWithoutSecret: true;
  }>;
}

interface StoredChallenge extends IdentitySignInChallenge {
  readonly email?: string;
  readonly codeVerifier?: string;
  consumed: boolean;
}

interface StoredRecovery extends IdentityRecoveryChallenge {
  consumed: boolean;
}

const APPROVED_METHODS = new Set<IdentitySignInMethod>([
  'password',
  'google',
  'discord',
  'passkey',
]);
const APPROVED_FACTORS = new Set(['totp', 'passkey', 'recovery-code']);
const ADMIN_ROLES = new Set(['support', 'operations', 'security', 'audit']);
const REQUIRED_APIS = [
  'signInEmail',
  'signInSocial',
  'verifyEmail',
  'verifyTOTP',
  'verifyBackupCode',
  'verifyPasskeyAuthentication',
  'listSessions',
  'revokeSession',
  'oauth2Authorize',
  'oauth2Token',
  'oauth2Revoke',
] as const;
const REQUIRED_TWO_FACTOR_ENDPOINTS = [
  'verifyTOTP',
  'verifyBackupCode',
  'generateBackupCodes',
] as const;
const REQUIRED_PASSKEY_ENDPOINTS = [
  'generatePasskeyRegistrationOptions',
  'verifyPasskeyRegistration',
  'generatePasskeyAuthenticationOptions',
  'verifyPasskeyAuthentication',
] as const;
const REQUIRED_OAUTH_ENDPOINTS = ['oauth2Authorize', 'oauth2Token', 'oauth2Revoke'] as const;

const success = <T>(value: T): IdentityProviderResult<T> => ({ ok: true, value });
const failure = <T>(
  code: IdentityProviderFailureCode,
  retryable = false,
): IdentityProviderResult<T> => ({ ok: false, code, retryable });

const hasEvery = (values: readonly string[], required: readonly string[]) =>
  required.every((value) => values.includes(value));

const evidenceIsComplete = (evidence: BetterAuthRuntimeEvidence): boolean =>
  evidence.packageVersions.betterAuth === '1.6.25' &&
  evidence.packageVersions.passkey === '1.6.25' &&
  evidence.packageVersions.oauthProvider === '1.6.25' &&
  evidence.requireEmailVerification &&
  evidence.socialProviders.join(',') === 'google,discord' &&
  evidence.pluginIds.join(',') === 'two-factor,passkey,jwt,oauth-provider' &&
  hasEvery(evidence.apiNames, REQUIRED_APIS) &&
  hasEvery(evidence.twoFactorEndpoints, REQUIRED_TWO_FACTOR_ENDPOINTS) &&
  hasEvery(evidence.passkeyEndpoints, REQUIRED_PASSKEY_ENDPOINTS) &&
  hasEvery(evidence.oauthProviderEndpoints, REQUIRED_OAUTH_ENDPOINTS) &&
  evidence.nativeClient.type === 'native' &&
  evidence.nativeClient.tokenEndpointAuthMethod === 'none' &&
  evidence.nativeClient.requirePkce &&
  evidence.nativeClient.codeChallengeMethod === 'S256' &&
  evidence.nativeClient.backendCodeExchange &&
  evidence.nativeClient.tokenEndpointPath === '/oauth2/token' &&
  evidence.nativeClient.tokenEndpointMethod === 'POST' &&
  evidence.nativeClient.acceptsPublicCodeExchangeWithoutSecret;

const base64Url = (bytes: Uint8Array): string => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
};

const randomToken = (size: number): string =>
  base64Url(crypto.getRandomValues(new Uint8Array(size)));

const s256 = async (value: string): Promise<string> =>
  base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))));

const id = (prefix: string): string => `${prefix}_${crypto.randomUUID().replaceAll('-', '')}`;

const methodStrength = (method: IdentitySignInMethod): IdentitySession['strength'] =>
  method === 'passkey' ? 'passkey' : 'password';

const isExactLoopbackRedirect = (redirectUri: string): boolean => {
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

export const createBetterAuthSpikeAdapter = (
  evidence: BetterAuthRuntimeEvidence,
  now: () => Date = () => new Date('2026-08-04T12:00:00.000Z'),
): IdentityProviderPort => {
  if (!evidenceIsComplete(evidence)) {
    const unavailable = async <T>(): Promise<IdentityProviderResult<T>> =>
      failure('ADAPTER_UNAVAILABLE');
    return {
      beginSignIn: unavailable,
      completeSignIn: unavailable,
      verifyEmail: unavailable,
      enrollFactor: unavailable,
      stepUp: unavailable,
      listSessions: unavailable,
      revokeSession: unavailable,
      beginRecovery: unavailable,
      completeRecovery: unavailable,
    };
  }

  const challenges = new Map<string, StoredChallenge>();
  const recoveries = new Map<string, StoredRecovery>();
  const sessions = new Map<string, IdentitySession>();
  const verifiedEmails = new Set(['player@example.test']);
  const enrolledFactors = new Map<string, Set<string>>();
  const attempts = new Map<string, number>();
  const usedRecoveryCodes = new Set<string>();
  let activeRole: string | undefined;

  const createSession = (method: IdentitySignInMethod, holdUntil?: string): IdentitySession => ({
    id: id('session'),
    method,
    strength: methodStrength(method),
    state: 'active',
    createdAt: now().toISOString(),
    ...(holdUntil ? { criticalActionHoldUntil: holdUntil } : {}),
  });

  return {
    beginSignIn: async (input) => {
      if (!APPROVED_METHODS.has(input.method)) return failure('UNSUPPORTED_METHOD');
      const attemptKey = `${input.method}:${input.email ?? 'desktop'}`;
      const count = (attempts.get(attemptKey) ?? 0) + 1;
      attempts.set(attemptKey, count);
      if (count > 5) return failure('RATE_LIMITED', true);

      if (input.desktop) {
        if (!isExactLoopbackRedirect(input.desktop.redirectUri)) {
          return failure('REDIRECT_MISMATCH');
        }
        if (input.desktop.issuer !== 'https://identity.test.liiiraa.dev') {
          return failure('ISSUER_MISMATCH');
        }
        const state = randomToken(32);
        const codeVerifier = randomToken(48);
        const codeChallenge = await s256(codeVerifier);
        const authorizationUrl = new URL('/api/auth/oauth2/authorize', input.desktop.issuer);
        authorizationUrl.searchParams.set('response_type', 'code');
        authorizationUrl.searchParams.set('client_id', 'liiiraa-windows-public-client');
        authorizationUrl.searchParams.set('redirect_uri', input.desktop.redirectUri);
        authorizationUrl.searchParams.set('state', state);
        authorizationUrl.searchParams.set('code_challenge', codeChallenge);
        authorizationUrl.searchParams.set('code_challenge_method', 'S256');

        const challenge: StoredChallenge = {
          id: id('challenge'),
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
        challenges.set(challenge.id, challenge);
        return success(challenge);
      }

      const challenge: StoredChallenge = {
        id: id('challenge'),
        method: input.method,
        transport: 'direct',
        email: input.email,
        consumed: false,
      };
      challenges.set(challenge.id, challenge);
      return success(challenge);
    },

    completeSignIn: async (input) => {
      const challenge = challenges.get(input.challengeId);
      if (!challenge) return failure('INVALID_CHALLENGE');
      if (challenge.consumed) return failure('REPLAYED_CHALLENGE');

      if (challenge.transport === 'external-browser') {
        if (input.redirectUri !== challenge.redirectUri) return failure('REDIRECT_MISMATCH');
        if (input.issuer !== challenge.issuer) return failure('ISSUER_MISMATCH');
        if (input.state !== challenge.state) return failure('STATE_MISMATCH');
        if (!input.authorizationCode) return failure('INVALID_CHALLENGE');
        if (!challenge.codeVerifier) return failure('INVALID_CHALLENGE');
      } else if (challenge.method === 'password' && input.emailVerified !== true) {
        return failure('UNVERIFIED_EMAIL');
      }

      challenge.consumed = true;
      const session = createSession(challenge.method);
      sessions.set(session.id, session);
      return success(session);
    },

    verifyEmail: async (input) => {
      if (!input.verificationToken.startsWith('verified-email-')) {
        return failure('UNVERIFIED_EMAIL');
      }
      verifiedEmails.add(input.email);
      return success({ verified: true });
    },

    enrollFactor: async (input) => {
      const session = sessions.get(input.sessionId);
      if (!session) return failure('UNVERIFIED_EMAIL');
      if (!APPROVED_FACTORS.has(input.factor)) return failure('INVALID_FACTOR');
      const factors = enrolledFactors.get(session.id) ?? new Set<string>();
      factors.add(input.factor);
      enrolledFactors.set(session.id, factors);
      return success({ factor: input.factor });
    },

    stepUp: async (input) => {
      const session = sessions.get(input.sessionId);
      if (!session || session.state === 'revoked') return failure('SESSION_REVOKED');
      if (!APPROVED_FACTORS.has(input.factor)) return failure('INVALID_FACTOR');
      if (input.proof.startsWith('stale:')) return failure('STEP_UP_STALE');
      if (
        session.criticalActionHoldUntil &&
        Date.parse(session.criticalActionHoldUntil) > now().getTime()
      ) {
        return failure('RECOVERY_HOLD_ACTIVE');
      }

      let assumedRole: 'support' | 'operations' | 'security' | 'audit' | undefined;
      if (input.actionScope.startsWith('admin-role:')) {
        const role = input.actionScope.slice('admin-role:'.length);
        if (!ADMIN_ROLES.has(role)) return failure('STEP_UP_REQUIRED');
        if (!input.proof.startsWith('role:') && !input.proof.startsWith('non-production-role:')) {
          return failure('STEP_UP_REQUIRED');
        }
        activeRole = role;
        assumedRole = role as typeof assumedRole;
      } else if (activeRole && input.actionScope.startsWith('admin-action:')) {
        const roleFromScope = input.actionScope.slice('admin-action:'.length).split(':', 1)[0];
        if (roleFromScope !== activeRole) return failure('STEP_UP_REQUIRED');
      }

      if (input.factor === 'recovery-code') {
        if (usedRecoveryCodes.has(input.proof)) return failure('INVALID_FACTOR');
        usedRecoveryCodes.add(input.proof);
      }

      const verifiedAt = now();
      return success({
        sessionId: session.id,
        actionScope: input.actionScope,
        factor: input.factor,
        verifiedAt: verifiedAt.toISOString(),
        expiresAt: new Date(verifiedAt.getTime() + 5 * 60 * 1_000).toISOString(),
        auditReceiptId: id('audit'),
        ...(assumedRole ? { assumedRole } : {}),
      });
    },

    listSessions: async () => success([...sessions.values()]),

    revokeSession: async (input) => {
      const session = sessions.get(input.sessionId);
      if (!session) return failure('SESSION_REVOKED');
      sessions.set(input.sessionId, { ...session, state: 'revoked' });
      return success({ sessionId: input.sessionId, state: 'revoked' });
    },

    beginRecovery: async (input) => {
      const route = input.evidence === 'all-factors-lost' ? 'security-review' : input.evidence;
      const challenge: StoredRecovery = {
        id: id('recovery'),
        route,
        genericNotice: true,
        consumed: false,
      };
      recoveries.set(challenge.id, challenge);
      return success(challenge);
    },

    completeRecovery: async (input) => {
      const challenge = recoveries.get(input.challengeId);
      if (!challenge || challenge.consumed) return failure('INVALID_CHALLENGE');
      if (challenge.route === 'security-review' && !input.reviewedBySecurity) {
        return failure('RECOVERY_REVIEW_REQUIRED');
      }
      challenge.consumed = true;
      const reviewed = challenge.route === 'security-review';
      const holdUntil = reviewed
        ? new Date(now().getTime() + 24 * 60 * 60 * 1_000).toISOString()
        : undefined;
      const session = createSession('password', holdUntil);
      sessions.set(session.id, session);
      return success({
        session,
        reviewed,
        ...(holdUntil ? { criticalActionHoldUntil: holdUntil } : {}),
        ...(reviewed ? { trustedSessionNoticeId: id('notice') } : {}),
        contestable: reviewed,
      });
    },
  };
};
