import type { SessionCommandJson, SessionProjectionJson } from '@liiiraa/contracts-ts';
import { decideAuthenticationAdmission } from '@liiiraa/control-plane-domain';

import type {
  IdentityProviderPort,
  IdentitySession,
  IdentitySignInChallenge,
  IdentitySignInMethod,
} from '../ports/identity.js';

export interface IdentityAuthorityRecord {
  readonly accountId: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly state: 'active' | 'disabled' | 'revoked';
}

export interface InvitationAuthorityPort {
  admit(
    input: Readonly<{
      invitationCode: string;
      email: string;
    }>,
  ): Promise<IdentityAuthorityRecord | null>;
}

export interface IdentityRiskPort {
  allow(
    input: Readonly<{
      accountId: string;
      method: string;
      origin: string;
    }>,
  ): Promise<boolean>;
}

export interface SessionAuthorityRecord {
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

export interface SessionAuthorityTransaction {
  issue(input: Omit<SessionAuthorityRecord, 'version'>): Promise<SessionAuthorityRecord>;
  list(accountId: string): Promise<readonly SessionAuthorityRecord[]>;
  revoke(
    accountId: string,
    sessionId: string,
    revokedAt?: string,
  ): Promise<SessionAuthorityRecord | null>;
}

export interface SessionAuthorityPort {
  transaction<T>(operation: (authority: SessionAuthorityTransaction) => Promise<T>): Promise<T>;
}

export interface SessionCredentialPort {
  issue(): Readonly<{ credential: string; digest: string }>;
}

export interface AuthenticationDependencies {
  readonly provider: IdentityProviderPort;
  readonly invitations: InvitationAuthorityPort;
  readonly risk: IdentityRiskPort;
  readonly sessions: SessionAuthorityPort;
  readonly credentials: SessionCredentialPort;
  readonly clock: Readonly<{ now(): Date }>;
  readonly ids: Readonly<{ next(): string }>;
}

interface AdmissionInput {
  readonly invitationCode: string;
  readonly email: string;
  readonly method: string;
  readonly origin: string;
  readonly expectedOrigin: string;
  readonly csrfVerified: boolean;
}

export interface AuthenticateInput extends AdmissionInput {
  readonly sessionKind: 'web' | 'desktop';
  readonly correlationId: string;
  readonly challengeId?: string;
  readonly authorizationCode?: string;
  readonly state?: string;
  readonly issuer?: string;
  readonly redirectUri?: string;
}

export interface BeginDesktopAuthorizationInput extends AdmissionInput {
  readonly issuer: string;
  readonly redirectUri: string;
}

export type AuthenticationFailure = Readonly<{
  ok: false;
  code: 'AUTHENTICATION_FAILED';
}>;

export type AuthenticationResult =
  | Readonly<{
      ok: true;
      session: SessionProjectionJson;
      credential: string;
    }>
  | AuthenticationFailure;

export type DesktopAuthorizationResult =
  Readonly<{ ok: true; challenge: IdentitySignInChallenge }> | AuthenticationFailure;

export type SessionListResult = Readonly<{
  ok: true;
  sessions: readonly SessionProjectionJson[];
}>;

export type SessionRevocationResult =
  | Readonly<{ ok: true; session: SessionProjectionJson }>
  | Readonly<{ ok: false; code: 'SESSION_NOT_FOUND' }>;

const failure = (): AuthenticationFailure => ({ ok: false, code: 'AUTHENTICATION_FAILED' });

const admit = async (
  dependencies: AuthenticationDependencies,
  input: AdmissionInput,
): Promise<
  | Readonly<{ accepted: true; identity: IdentityAuthorityRecord; method: IdentitySignInMethod }>
  | Readonly<{ accepted: false }>
> => {
  const identity = await dependencies.invitations.admit({
    invitationCode: input.invitationCode,
    email: input.email,
  });
  const riskAllowed = identity
    ? await dependencies.risk.allow({
        accountId: identity.accountId,
        method: input.method,
        origin: input.origin,
      })
    : false;
  const decision = decideAuthenticationAdmission({
    method: input.method,
    invitationAccepted: identity !== null,
    emailVerified: identity?.emailVerified ?? false,
    identityState: identity?.state ?? 'revoked',
    origin: input.origin,
    expectedOrigin: input.expectedOrigin,
    csrfVerified: input.csrfVerified,
    riskAllowed,
  });

  if (!decision.accepted || identity === null) return { accepted: false };
  return { accepted: true, identity, method: decision.method };
};

const sessionProjection = (
  record: SessionAuthorityRecord,
  correlationId: string,
): SessionProjectionJson => ({
  schemaVersion: '1.0',
  aggregateVersion: record.version.toString(),
  etag: `session-${record.sessionId}-v${record.version.toString()}`,
  correlationId,
  provenance: 'postgres-authority',
  kind: 'session-projection',
  sessionId: record.sessionId,
  accountId: record.accountId,
  state: record.state,
  authenticationStrength: record.method === 'passkey' ? 'passkey' : 'password',
  scopes: [`session-${record.kind}`],
  authenticatedAt: record.issuedAt,
  expiresAt: record.expiresAt,
  lastSeenAt: record.lastSeenAt,
});

const issueSession = async (
  dependencies: AuthenticationDependencies,
  identity: IdentityAuthorityRecord,
  providerSession: IdentitySession,
  sessionKind: 'web' | 'desktop',
  correlationId: string,
): Promise<AuthenticationResult> => {
  const issuedAt = dependencies.clock.now();
  const expiresAt = new Date(issuedAt.getTime() + 30 * 24 * 60 * 60 * 1_000);
  const credential = dependencies.credentials.issue();
  const record = await dependencies.sessions.transaction((authority) =>
    authority.issue({
      sessionId: dependencies.ids.next(),
      accountId: identity.accountId,
      providerSessionId: providerSession.id,
      kind: sessionKind,
      tokenDigest: credential.digest,
      method: providerSession.method,
      state: 'active',
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      lastSeenAt: issuedAt.toISOString(),
    }),
  );

  return {
    ok: true,
    session: sessionProjection(record, correlationId),
    credential: credential.credential,
  };
};

export const beginDesktopAuthorization = async (
  dependencies: AuthenticationDependencies,
  input: BeginDesktopAuthorizationInput,
): Promise<DesktopAuthorizationResult> => {
  const admission = await admit(dependencies, input);
  if (!admission.accepted) return failure();
  const challenge = await dependencies.provider.beginSignIn({
    method: admission.method,
    email: input.email,
    desktop: { issuer: input.issuer, redirectUri: input.redirectUri },
  });
  return challenge.ok ? { ok: true, challenge: challenge.value } : failure();
};

export const authenticate = async (
  dependencies: AuthenticationDependencies,
  input: AuthenticateInput,
): Promise<AuthenticationResult> => {
  const admission = await admit(dependencies, input);
  if (!admission.accepted) return failure();

  let challengeId = input.challengeId;
  if (!challengeId) {
    const challenge = await dependencies.provider.beginSignIn({
      method: admission.method,
      email: input.email,
    });
    if (!challenge.ok) return failure();
    challengeId = challenge.value.id;
  }

  const completion = await dependencies.provider.completeSignIn({
    challengeId,
    emailVerified: admission.identity.emailVerified,
    ...(input.authorizationCode ? { authorizationCode: input.authorizationCode } : {}),
    ...(input.state ? { state: input.state } : {}),
    ...(input.issuer ? { issuer: input.issuer } : {}),
    ...(input.redirectUri ? { redirectUri: input.redirectUri } : {}),
  });
  if (!completion.ok) return failure();
  if (completion.value.accountId !== admission.identity.accountId) return failure();

  return issueSession(
    dependencies,
    admission.identity,
    completion.value,
    input.sessionKind,
    input.correlationId,
  );
};

export const listSessions = async (
  dependencies: AuthenticationDependencies,
  input: Readonly<{ accountId: string; correlationId: string }>,
): Promise<SessionListResult> => {
  const records = await dependencies.sessions.transaction((authority) =>
    authority.list(input.accountId),
  );
  return {
    ok: true,
    sessions: records.map((record) => sessionProjection(record, input.correlationId)),
  };
};

export const revokeSession = async (
  dependencies: AuthenticationDependencies,
  command: SessionCommandJson,
): Promise<SessionRevocationResult> => {
  const revokedAt = dependencies.clock.now().toISOString();
  const record = await dependencies.sessions.transaction((authority) =>
    authority.revoke(command.accountId, command.sessionId, revokedAt),
  );
  if (!record) return { ok: false, code: 'SESSION_NOT_FOUND' };

  await dependencies.provider.revokeSession({
    accountId: command.accountId,
    sessionId: record.providerSessionId,
  });
  return { ok: true, session: sessionProjection(record, command.correlationId) };
};
