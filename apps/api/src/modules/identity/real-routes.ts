import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import type {
  AccountProjectionJson,
  SessionProjectionJson,
  SubscriptionProjectionJson,
} from '@liiiraa/contracts-ts';
import type {
  IdentityActor,
  IdentityLocale,
  RealIdentityAuthority,
} from '@liiiraa/control-plane-adapters';
import { controlPlaneDocumentValidator } from '@liiiraa/contracts-ts/runtime-control-plane-validator';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export type RealIdentityRouteAuthority = Pick<
  RealIdentityAuthority,
  | 'approveDesktopAuthorization'
  | 'beginDesktopAuthorization'
  | 'exchangeDesktopAuthorization'
  | 'resolveCredential'
  | 'signIn'
  | 'signOut'
  | 'signUp'
  | 'updateProfile'
>;

export type RealAccountSecurityMethodProjection = Readonly<{
  factor: 'password' | 'passkey' | 'totp' | 'recovery-code';
  methodId: string;
  verifiedAt: string;
}>;

export interface RealIdentityRouteDependencies {
  readonly accountOrigin: string;
  readonly adminOrigin: string;
  readonly authority: RealIdentityRouteAuthority;
  readonly csrfSecret: string;
  readonly issuer: string;
  readonly resolveSecurityMethods: (
    actor: IdentityActor,
  ) => Promise<readonly RealAccountSecurityMethodProjection[]>;
  readonly resolveSubscription: (
    actor: IdentityActor,
    correlationId: string,
  ) => Promise<SubscriptionProjectionJson>;
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const stringValue = (value: Readonly<Record<string, unknown>>, key: string): string =>
  typeof value[key] === 'string' ? value[key] : '';
const localeValue = (value: unknown): IdentityLocale | null =>
  value === 'pt-BR' || value === 'en' ? value : null;
const correlationId = (request: FastifyRequest): string => {
  const header = request.headers['x-correlation-id'];
  return typeof header === 'string' && header.length <= 128 ? header : `identity-${request.id}`;
};

const csrfSignature = (secret: string, nonce: string): string =>
  createHmac('sha256', secret).update(nonce, 'utf8').digest('base64url');
const issueCsrf = (secret: string): string => {
  const nonce = randomBytes(32).toString('base64url');
  return `${nonce}.${csrfSignature(secret, nonce)}`;
};
const verifyCsrf = (secret: string, candidate: unknown): boolean => {
  if (typeof candidate !== 'string' || candidate.length > 256) return false;
  const [nonce, signature, extra] = candidate.split('.');
  if (!nonce || !signature || extra !== undefined) return false;
  const expected = Buffer.from(csrfSignature(secret, nonce), 'utf8');
  const actual = Buffer.from(signature, 'utf8');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
};

const sessionCookie = (credential: string): string =>
  `__Host-liiiraa_session=${encodeURIComponent(credential)}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=2592000`;
const clearSessionCookie = (): string =>
  '__Host-liiiraa_session=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0';

const cookieCredential = (request: FastifyRequest): string | null => {
  const cookie = request.headers.cookie;
  if (typeof cookie !== 'string') return null;
  for (const entry of cookie.split(';')) {
    const [name, ...parts] = entry.trim().split('=');
    if (name !== '__Host-liiiraa_session') continue;
    try {
      return decodeURIComponent(parts.join('='));
    } catch {
      return null;
    }
  }
  return null;
};

const requestCredential = (request: FastifyRequest): string | null => {
  const authorization = request.headers.authorization;
  if (typeof authorization === 'string' && authorization.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length);
  }
  return cookieCredential(request);
};

const bearerCredential = (request: FastifyRequest): string | null => {
  const authorization = request.headers.authorization;
  if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) return null;
  const credential = authorization.slice('Bearer '.length);
  return credential.length > 0 && credential.length <= 4_096 ? credential : null;
};

const noStore = (reply: FastifyReply): FastifyReply =>
  reply.header('cache-control', 'no-store, private');
const safeActor = (actor: IdentityActor) => ({
  accountId: actor.accountId,
  displayName: actor.displayName,
  email: actor.email,
  locale: actor.locale,
  role: actor.role,
  sessionId: actor.sessionId,
  sessionKind: actor.sessionKind,
  expiresAt: actor.expiresAt,
});

const redactEmail = (email: string): string => {
  const separator = email.lastIndexOf('@');
  return separator > 0 ? `${email.slice(0, 1)}***${email.slice(separator)}` : '***';
};

const sessionProjection = (actor: IdentityActor, correlation: string): SessionProjectionJson => ({
  schemaVersion: '1.0',
  aggregateVersion: actor.sessionVersion.toString(),
  etag: `session-${actor.sessionId}-v${actor.sessionVersion.toString()}`,
  correlationId: correlation,
  provenance: 'postgres-authority',
  kind: 'session-projection',
  sessionId: actor.sessionId,
  accountId: actor.accountId,
  state: 'active',
  authenticationStrength: actor.authenticationMethod,
  scopes: [`session-${actor.sessionKind}`],
  authenticatedAt: actor.authenticatedAt,
  expiresAt: actor.expiresAt,
  lastSeenAt: actor.lastSeenAt,
});

const accountProjection = (
  actor: IdentityActor,
  correlation: string,
  securityMethods: readonly RealAccountSecurityMethodProjection[],
  subscription: SubscriptionProjectionJson,
) => {
  const account: AccountProjectionJson = {
    schemaVersion: '1.0',
    aggregateVersion: actor.identityVersion.toString(),
    etag: `account-${actor.accountId}-v${actor.identityVersion.toString()}`,
    correlationId: correlation,
    provenance: 'postgres-authority',
    kind: 'account-projection',
    accountId: actor.accountId,
    state: 'active',
    displayName: actor.displayName,
    emailRedacted: redactEmail(actor.email),
    ...(actor.role === 'tester' ? {} : { administrativeRole: actor.role }),
    locale: actor.locale,
    createdAt: actor.createdAt,
    updatedAt: actor.updatedAt,
  };
  if (
    subscription.accountId !== actor.accountId ||
    !controlPlaneDocumentValidator(account) ||
    !controlPlaneDocumentValidator(subscription)
  ) {
    throw new Error('REAL_ACCOUNT_PROJECTION_REJECTED');
  }
  return Object.freeze({
    account,
    provenance: 'online' as const,
    securityMethods: Object.freeze([...securityMethods]),
    sessions: Object.freeze([sessionProjection(actor, correlation)]),
    subscription,
    invoices: Object.freeze([]),
    supportCases: Object.freeze([]),
    activeDevice: null,
  });
};

const parseExpectedVersion = (header: unknown): bigint | null => {
  if (typeof header !== 'string' || header.length > 256) return null;
  const candidate = header.trim();
  const match =
    /^(?:([0-9]{1,19})|"([0-9]{1,19})"|"account-[A-Za-z0-9][A-Za-z0-9-]{0,127}-v([0-9]{1,19})")$/u.exec(
      candidate,
    );
  const digits = match?.[1] ?? match?.[2] ?? match?.[3];
  if (digits === undefined) return null;
  const version = BigInt(digits);
  return version <= 9_223_372_036_854_775_807n ? version : null;
};

const expectedVersion = (request: FastifyRequest): bigint | null => {
  const applicationVersion = request.headers['x-liiiraa-expected-version'];
  const standardVersion = request.headers['if-match'];
  if (applicationVersion === undefined) return parseExpectedVersion(standardVersion);
  const parsedApplicationVersion = parseExpectedVersion(applicationVersion);
  if (standardVersion === undefined) return parsedApplicationVersion;
  const parsedStandardVersion = parseExpectedVersion(standardVersion);
  return parsedApplicationVersion !== null && parsedApplicationVersion === parsedStandardVersion
    ? parsedApplicationVersion
    : null;
};

export const registerRealIdentityRoutes = (
  app: FastifyInstance,
  dependencies: RealIdentityRouteDependencies,
): Promise<void> => {
  if (dependencies.csrfSecret.length < 32) throw new Error('REAL_IDENTITY_CSRF_SECRET_REJECTED');
  const browserOrigins = new Set([dependencies.accountOrigin, dependencies.adminOrigin]);
  const browserMutationAllowed = (request: FastifyRequest): boolean =>
    typeof request.headers.origin === 'string' &&
    browserOrigins.has(request.headers.origin) &&
    verifyCsrf(dependencies.csrfSecret, request.headers['x-csrf-token']);
  const accountMutationAllowed = (request: FastifyRequest): boolean =>
    request.headers.origin === undefined
      ? bearerCredential(request) !== null
      : browserMutationAllowed(request);
  const resolveActor = async (
    request: FastifyRequest,
  ): Promise<Readonly<{ actor: IdentityActor; credential: string }> | null> => {
    const credential = requestCredential(request);
    if (credential === null) return null;
    const actor = await dependencies.authority.resolveCredential(credential);
    return actor === null ? null : { actor, credential };
  };

  app.get('/v1/identity/csrf', (request, reply) => {
    const origin = request.headers.origin;
    if (typeof origin !== 'string' || !browserOrigins.has(origin)) {
      return noStore(reply).code(403).send({ code: 'REQUEST_DENIED' });
    }
    return noStore(reply)
      .code(200)
      .send({ token: issueCsrf(dependencies.csrfSecret) });
  });

  app.post('/v1/identity/sign-up', async (request, reply) => {
    if (!browserMutationAllowed(request) || !isRecord(request.body)) {
      return noStore(reply).code(403).send({ code: 'AUTHENTICATION_FAILED' });
    }
    const locale = localeValue(request.body['locale']);
    const result =
      locale === null
        ? { ok: false as const, code: 'AUTHENTICATION_FAILED' as const }
        : await dependencies.authority.signUp({
            displayName: stringValue(request.body, 'displayName'),
            email: stringValue(request.body, 'email'),
            invitationToken: stringValue(request.body, 'invitationToken'),
            locale,
            password: stringValue(request.body, 'password'),
          });
    if (!result.ok) {
      return noStore(reply).code(401).send({ code: 'AUTHENTICATION_FAILED' });
    }
    return noStore(reply)
      .header('set-cookie', sessionCookie(result.credential))
      .code(201)
      .send({ actor: safeActor(result.actor) });
  });

  app.post('/v1/identity/sign-in', async (request, reply) => {
    if (!browserMutationAllowed(request) || !isRecord(request.body)) {
      return noStore(reply).code(403).send({ code: 'AUTHENTICATION_FAILED' });
    }
    const result = await dependencies.authority.signIn({
      email: stringValue(request.body, 'email'),
      password: stringValue(request.body, 'password'),
    });
    if (!result.ok) {
      return noStore(reply).code(401).send({ code: 'AUTHENTICATION_FAILED' });
    }
    return noStore(reply)
      .header('set-cookie', sessionCookie(result.credential))
      .code(201)
      .send({ actor: safeActor(result.actor) });
  });

  app.get('/v1/identity/session', async (request, reply) => {
    const resolved = await resolveActor(request);
    return resolved === null
      ? noStore(reply).code(401).send({ code: 'AUTHENTICATION_REQUIRED' })
      : noStore(reply)
          .code(200)
          .send({ actor: safeActor(resolved.actor) });
  });

  app.post('/v1/identity/sign-out', async (request, reply) => {
    if (!browserMutationAllowed(request)) {
      return noStore(reply).code(403).send({ code: 'REQUEST_DENIED' });
    }
    const resolved = await resolveActor(request);
    if (resolved === null) {
      return noStore(reply).header('set-cookie', clearSessionCookie()).code(204).send();
    }
    await dependencies.authority.signOut(resolved.credential);
    return noStore(reply).header('set-cookie', clearSessionCookie()).code(204).send();
  });

  app.post('/v1/identity/desktop/authorizations', async (request, reply) => {
    if (!isRecord(request.body)) {
      return noStore(reply).code(401).send({ code: 'AUTHENTICATION_FAILED' });
    }
    const result = await dependencies.authority.beginDesktopAuthorization({
      accountOrigin: dependencies.accountOrigin,
      codeChallenge: stringValue(request.body, 'codeChallenge'),
      email: stringValue(request.body, 'email'),
      issuer: stringValue(request.body, 'issuer'),
      redirectUri: stringValue(request.body, 'redirectUri'),
    });
    return result.ok
      ? noStore(reply).code(201).send(result.challenge)
      : noStore(reply).code(401).send({ code: 'AUTHENTICATION_FAILED' });
  });

  app.post<{ Params: { challengeId: string } }>(
    '/v1/identity/desktop/authorizations/:challengeId/approve',
    async (request, reply) => {
      if (!browserMutationAllowed(request) || !isRecord(request.body)) {
        return noStore(reply).code(403).send({ code: 'AUTHENTICATION_FAILED' });
      }
      const resolved = await resolveActor(request);
      if (resolved === null) {
        return noStore(reply).code(401).send({ code: 'AUTHENTICATION_FAILED' });
      }
      const result = await dependencies.authority.approveDesktopAuthorization({
        actor: resolved.actor,
        challengeId: request.params.challengeId,
        state: stringValue(request.body, 'state'),
      });
      return result.ok
        ? noStore(reply).code(200).send({ callbackUrl: result.callbackUrl })
        : noStore(reply).code(401).send({ code: 'AUTHENTICATION_FAILED' });
    },
  );

  app.post('/v1/identity/desktop/exchanges', async (request, reply) => {
    if (!isRecord(request.body)) {
      return noStore(reply).code(401).send({ code: 'AUTHENTICATION_FAILED' });
    }
    const result = await dependencies.authority.exchangeDesktopAuthorization({
      authorizationCode: stringValue(request.body, 'authorizationCode'),
      challengeId: stringValue(request.body, 'challengeId'),
      codeVerifier: stringValue(request.body, 'codeVerifier'),
      state: stringValue(request.body, 'state'),
    });
    if (!result.ok) {
      return noStore(reply).code(401).send({ code: 'AUTHENTICATION_FAILED' });
    }
    return noStore(reply)
      .code(201)
      .send({
        session: sessionProjection(result.actor, correlationId(request)),
        credentialCustody: {
          kind: 'windows-credential-manager',
          credential: result.credential,
          expiresAt: result.actor.expiresAt,
        },
      });
  });

  app.post('/v1/identity/desktop/sign-out', async (request, reply) => {
    const credential = bearerCredential(request);
    if (credential === null) {
      return noStore(reply).code(403).send({ code: 'REQUEST_DENIED' });
    }
    const actor = await dependencies.authority.resolveCredential(credential);
    if (actor === null) return noStore(reply).code(204).send();
    await dependencies.authority.signOut(credential);
    return noStore(reply).code(204).send();
  });

  app.get('/v1/account', async (request, reply) => {
    const resolved = await resolveActor(request);
    if (resolved === null) return noStore(reply).code(401).send({ code: 'UNAUTHORIZED' });
    const correlation = correlationId(request);
    const [securityMethods, subscription] = await Promise.all([
      dependencies.resolveSecurityMethods(resolved.actor),
      dependencies.resolveSubscription(resolved.actor, correlation),
    ]);
    const projection = accountProjection(
      resolved.actor,
      correlation,
      securityMethods,
      subscription,
    );
    return noStore(reply).header('etag', `"${projection.account.etag}"`).code(200).send(projection);
  });

  app.patch('/v1/account', async (request, reply) => {
    if (!accountMutationAllowed(request) || !isRecord(request.body)) {
      return noStore(reply).code(403).send({ code: 'REQUEST_DENIED' });
    }
    const resolved = await resolveActor(request);
    const version = expectedVersion(request);
    const patch = request.body['patch'];
    if (resolved === null || version === null || !isRecord(patch)) {
      return noStore(reply)
        .code(resolved === null ? 401 : 400)
        .send({ code: 'INVALID_REQUEST' });
    }
    const locale = patch['locale'] === undefined ? undefined : localeValue(patch['locale']);
    if (locale === null) return noStore(reply).code(400).send({ code: 'INVALID_REQUEST' });
    const result = await dependencies.authority.updateProfile({
      actor: resolved.actor,
      expectedVersion: version,
      ...(typeof patch['displayName'] === 'string' ? { displayName: patch['displayName'] } : {}),
      ...(locale === undefined ? {} : { locale }),
    });
    if (!result.ok) {
      const correlation = correlationId(request);
      const [securityMethods, subscription] = await Promise.all([
        dependencies.resolveSecurityMethods(resolved.actor),
        dependencies.resolveSubscription(resolved.actor, correlation),
      ]);
      const projection = accountProjection(
        resolved.actor,
        correlation,
        securityMethods,
        subscription,
      );
      return noStore(reply)
        .code(result.code === 'CONFLICT' ? 409 : 400)
        .send({
          code: result.code,
          ...(result.code === 'CONFLICT'
            ? { projection: { ...projection, provenance: 'conflict' } }
            : {}),
        });
    }
    const correlation = correlationId(request);
    const [securityMethods, subscription] = await Promise.all([
      dependencies.resolveSecurityMethods(result.actor),
      dependencies.resolveSubscription(result.actor, correlation),
    ]);
    const projection = accountProjection(result.actor, correlation, securityMethods, subscription);
    return noStore(reply).header('etag', `"${projection.account.etag}"`).code(200).send(projection);
  });
  return Promise.resolve();
};
