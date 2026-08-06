import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';

import type { ControlPlaneMigrationDatabase, ControlPlaneTransaction } from './database.ts';

export type IdentityRole = 'tester' | 'support' | 'operations' | 'security' | 'audit';
export type IdentityLocale = 'pt-BR' | 'en';

export interface InvitationRecord {
  readonly id: string;
  readonly emailDigest: string;
  readonly tokenDigest: string;
  readonly role: IdentityRole;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly redeemedAt: string | null;
  readonly redeemedBy: string | null;
}

export interface IdentityRecord {
  readonly id: string;
  readonly email: string;
  readonly emailVerifiedAt: string;
  readonly passwordHash: string;
  readonly displayName: string;
  readonly locale: IdentityLocale;
  readonly role: IdentityRole;
  readonly status: 'active' | 'locked' | 'deletion-pending' | 'deleted';
  readonly version: bigint;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PersistedSessionRecord {
  readonly id: string;
  readonly accountId: string;
  readonly tokenDigest: string;
  readonly kind: 'web' | 'desktop' | 'admin';
  readonly authenticationMethod: 'password' | 'passkey';
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly lastSeenAt: string;
  readonly revokedAt: string | null;
  readonly version: bigint;
}

export interface DesktopChallengeRecord {
  readonly id: string;
  readonly email: string;
  readonly redirectUri: string;
  readonly issuer: string;
  readonly stateDigest: string;
  readonly codeChallenge: string;
  readonly codeDigest: string | null;
  readonly approvedBy: string | null;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly consumedAt: string | null;
}

export interface IdentityPersistence {
  createInvitation(record: InvitationRecord): Promise<void>;
  redeemInvitation(
    input: Readonly<{
      identity: IdentityRecord;
      invitationDigest: string;
      now: string;
    }>,
  ): Promise<IdentityRecord | null>;
  findIdentityByEmail(email: string): Promise<IdentityRecord | null>;
  findIdentityById(id: string): Promise<IdentityRecord | null>;
  createSession(record: PersistedSessionRecord): Promise<void>;
  findSessionByDigest(digest: string, now: string): Promise<PersistedSessionRecord | null>;
  revokeSessionByDigest(digest: string, now: string): Promise<boolean>;
  updateIdentityProfile(
    input: Readonly<{
      accountId: string;
      displayName?: string;
      expectedVersion: bigint;
      locale?: IdentityLocale;
      now: string;
    }>,
  ): Promise<IdentityRecord | 'conflict' | null>;
  createDesktopChallenge(record: DesktopChallengeRecord): Promise<void>;
  approveDesktopChallenge(
    input: Readonly<{
      accountId: string;
      challengeId: string;
      codeDigest: string;
      now: string;
      stateDigest: string;
    }>,
  ): Promise<DesktopChallengeRecord | null>;
  consumeDesktopChallenge(
    input: Readonly<{
      challengeId: string;
      codeChallenge: string;
      codeDigest: string;
      now: string;
      stateDigest: string;
    }>,
  ): Promise<DesktopChallengeRecord | null>;
}

export interface IdentityActor {
  readonly accountId: string;
  readonly displayName: string;
  readonly email: string;
  readonly locale: IdentityLocale;
  readonly role: IdentityRole;
  readonly sessionId: string;
  readonly sessionKind: PersistedSessionRecord['kind'];
  readonly authenticationMethod: PersistedSessionRecord['authenticationMethod'];
  readonly authenticatedAt: string;
  readonly expiresAt: string;
  readonly lastSeenAt: string;
  readonly sessionVersion: bigint;
  readonly identityVersion: bigint;
  readonly createdAt: string;
  readonly updatedAt: string;
}

type AuthenticationFailure = Readonly<{ ok: false; code: 'AUTHENTICATION_FAILED' }>;
type AuthenticationSuccess = Readonly<{
  ok: true;
  actor: IdentityActor;
  credential: string;
}>;
export type AuthenticationResult = AuthenticationFailure | AuthenticationSuccess;

const failure = (): AuthenticationFailure => ({ ok: false, code: 'AUTHENTICATION_FAILED' });
const normalizeEmail = (value: string): string => value.trim().toLowerCase();
const validEmail = (value: string): boolean =>
  value.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(value);
const validPassword = (value: string): boolean =>
  value.length >= 10 &&
  value.length <= 128 &&
  /[a-z]/u.test(value) &&
  /[A-Z]/u.test(value) &&
  /[0-9]/u.test(value) &&
  !value.includes('\0');
const validDisplayName = (value: string): boolean => {
  const length = [
    ...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value.trim()),
  ].length;
  return length >= 2 && length <= 80 && !/[\u0000-\u001F\u007F]/u.test(value);
};

export const digestOpaqueToken = (value: string, encoding: 'hex' | 'base64url' = 'hex'): string =>
  createHash('sha256').update(value, 'utf8').digest(encoding);

const scryptPassword = (password: string, salt: Uint8Array, length: number): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      length,
      { N: 32_768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (error, derived) => {
        if (error) reject(error);
        else resolve(derived);
      },
    );
  });

export const hashIdentityPassword = async (
  password: string,
  salt: Uint8Array = randomBytes(16),
): Promise<string> => {
  if (!validPassword(password) || salt.byteLength !== 16) {
    throw new Error('IDENTITY_PASSWORD_REJECTED');
  }
  const hash = await scryptPassword(password, salt, 64);
  return `scrypt$32768$8$1$${Buffer.from(salt).toString('base64url')}$${hash.toString('base64url')}`;
};

export const verifyIdentityPassword = async (
  password: string,
  encoded: string,
): Promise<boolean> => {
  const [algorithm, cost, blockSize, parallelism, saltValue, hashValue, extra] = encoded.split('$');
  if (
    algorithm !== 'scrypt' ||
    cost !== '32768' ||
    blockSize !== '8' ||
    parallelism !== '1' ||
    !saltValue ||
    !hashValue ||
    extra !== undefined ||
    password.length > 128
  ) {
    return false;
  }
  try {
    const expected = Buffer.from(hashValue, 'base64url');
    const actual = await scryptPassword(
      password,
      Buffer.from(saltValue, 'base64url'),
      expected.length,
    );
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
};

interface IdentityAuthorityOptions {
  readonly clock?: Readonly<{ now(): Date }>;
  readonly ids?: Readonly<{ next(): string }>;
  readonly passwords?: Readonly<{
    hash(password: string): Promise<string>;
    verify(password: string, encoded: string): Promise<boolean>;
  }>;
  readonly randomToken?: (bytes: number) => string;
}

export interface DesktopAuthorizationChallenge {
  readonly challengeId: string;
  readonly authorizationUrl: string;
  readonly state: string;
  readonly codeChallenge: string;
  readonly codeChallengeMethod: 'S256';
  readonly issuer: string;
  readonly redirectUri: string;
}

const exactHttpsOrigin = (value: string): boolean => {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.origin === value &&
      url.pathname === '/' &&
      url.username.length === 0 &&
      url.password.length === 0
    );
  } catch {
    return false;
  }
};

const exactLoopbackRedirect = (value: string): boolean => {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'http:' &&
      url.hostname === '127.0.0.1' &&
      url.port.length > 0 &&
      url.pathname === '/oauth/callback' &&
      url.search.length === 0 &&
      url.hash.length === 0 &&
      url.username.length === 0 &&
      url.password.length === 0
    );
  } catch {
    return false;
  }
};

const base64UrlValue = (value: string): boolean =>
  value.length >= 43 && value.length <= 128 && /^[A-Za-z0-9_-]+$/u.test(value);

export const createRealIdentityAuthority = (
  persistence: IdentityPersistence,
  options: IdentityAuthorityOptions = {},
) => {
  const clock = options.clock ?? { now: () => new Date() };
  const ids = options.ids ?? { next: () => randomUUID() };
  const passwords = options.passwords ?? {
    hash: hashIdentityPassword,
    verify: verifyIdentityPassword,
  };
  const randomToken =
    options.randomToken ?? ((bytes: number) => randomBytes(bytes).toString('base64url'));

  const actorFor = (identity: IdentityRecord, session: PersistedSessionRecord): IdentityActor => ({
    accountId: identity.id,
    displayName: identity.displayName,
    email: identity.email,
    locale: identity.locale,
    role: identity.role,
    sessionId: session.id,
    sessionKind: session.kind,
    authenticationMethod: session.authenticationMethod,
    authenticatedAt: session.issuedAt,
    expiresAt: session.expiresAt,
    lastSeenAt: session.lastSeenAt,
    sessionVersion: session.version,
    identityVersion: identity.version,
    createdAt: identity.createdAt,
    updatedAt: identity.updatedAt,
  });

  const issueSession = async (
    identity: IdentityRecord,
    kind: PersistedSessionRecord['kind'],
  ): Promise<AuthenticationSuccess> => {
    const now = clock.now();
    const credential = randomToken(48);
    const session: PersistedSessionRecord = {
      id: ids.next(),
      accountId: identity.id,
      tokenDigest: digestOpaqueToken(credential),
      kind,
      authenticationMethod: 'password',
      issuedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 30 * 86_400_000).toISOString(),
      lastSeenAt: now.toISOString(),
      revokedAt: null,
      version: 1n,
    };
    await persistence.createSession(session);
    return { ok: true, actor: actorFor(identity, session), credential };
  };

  return Object.freeze({
    async issueInvitation(
      input: Readonly<{ email: string; expiresAt: string; role: IdentityRole }>,
    ) {
      const email = normalizeEmail(input.email);
      const now = clock.now().toISOString();
      if (
        !validEmail(email) ||
        !Number.isFinite(Date.parse(input.expiresAt)) ||
        Date.parse(input.expiresAt) <= Date.parse(now)
      ) {
        throw new Error('IDENTITY_INVITATION_REJECTED');
      }
      const token = randomToken(48);
      const record: InvitationRecord = {
        id: ids.next(),
        emailDigest: digestOpaqueToken(email),
        tokenDigest: digestOpaqueToken(token),
        role: input.role,
        issuedAt: now,
        expiresAt: input.expiresAt,
        redeemedAt: null,
        redeemedBy: null,
      };
      await persistence.createInvitation(record);
      return Object.freeze({ token, tokenDigest: record.tokenDigest, expiresAt: record.expiresAt });
    },

    async signUp(
      input: Readonly<{
        displayName: string;
        email: string;
        invitationToken: string;
        locale: IdentityLocale;
        password: string;
      }>,
    ): Promise<AuthenticationResult> {
      const email = normalizeEmail(input.email);
      const displayName = input.displayName.trim();
      if (
        !validEmail(email) ||
        !validDisplayName(displayName) ||
        !validPassword(input.password) ||
        !base64UrlValue(input.invitationToken)
      ) {
        return failure();
      }
      let passwordHash: string;
      try {
        passwordHash = await passwords.hash(input.password);
      } catch {
        return failure();
      }
      const now = clock.now().toISOString();
      const pendingIdentity: IdentityRecord = {
        id: ids.next(),
        email,
        emailVerifiedAt: now,
        passwordHash,
        displayName,
        locale: input.locale,
        role: 'tester',
        status: 'active',
        version: 1n,
        createdAt: now,
        updatedAt: now,
      };
      const identity = await persistence.redeemInvitation({
        identity: pendingIdentity,
        invitationDigest: digestOpaqueToken(input.invitationToken),
        now,
      });
      if (identity === null) return failure();
      return issueSession(identity, identity.role === 'tester' ? 'web' : 'admin');
    },

    async signIn(
      input: Readonly<{ email: string; password: string }>,
    ): Promise<AuthenticationResult> {
      const email = normalizeEmail(input.email);
      if (!validEmail(email) || input.password.length > 128) return failure();
      const identity = await persistence.findIdentityByEmail(email);
      if (
        identity?.status !== 'active' ||
        !(await passwords.verify(input.password, identity.passwordHash))
      ) {
        return failure();
      }
      return issueSession(identity, identity.role === 'tester' ? 'web' : 'admin');
    },

    async resolveCredential(credential: string): Promise<IdentityActor | null> {
      if (!base64UrlValue(credential)) return null;
      const session = await persistence.findSessionByDigest(
        digestOpaqueToken(credential),
        clock.now().toISOString(),
      );
      if (session === null) return null;
      const identity = await persistence.findIdentityById(session.accountId);
      return identity?.status === 'active' ? actorFor(identity, session) : null;
    },

    signOut(credential: string): Promise<boolean> {
      if (!base64UrlValue(credential)) return Promise.resolve(false);
      return persistence.revokeSessionByDigest(
        digestOpaqueToken(credential),
        clock.now().toISOString(),
      );
    },

    async updateProfile(
      input: Readonly<{
        actor: IdentityActor;
        displayName?: string;
        expectedVersion: bigint;
        locale?: IdentityLocale;
      }>,
    ): Promise<
      | Readonly<{ ok: true; actor: IdentityActor }>
      | Readonly<{ ok: false; code: 'CONFLICT' | 'INVALID_REQUEST' }>
    > {
      const displayName = input.displayName?.trim();
      if (
        (displayName === undefined && input.locale === undefined) ||
        (displayName !== undefined && !validDisplayName(displayName))
      ) {
        return { ok: false, code: 'INVALID_REQUEST' };
      }
      const updated = await persistence.updateIdentityProfile({
        accountId: input.actor.accountId,
        expectedVersion: input.expectedVersion,
        now: clock.now().toISOString(),
        ...(displayName === undefined ? {} : { displayName }),
        ...(input.locale === undefined ? {} : { locale: input.locale }),
      });
      if (updated === null || updated === 'conflict') return { ok: false, code: 'CONFLICT' };
      return {
        ok: true,
        actor: {
          ...input.actor,
          displayName: updated.displayName,
          locale: updated.locale,
          identityVersion: updated.version,
          updatedAt: updated.updatedAt,
        },
      };
    },

    async beginDesktopAuthorization(
      input: Readonly<{
        accountOrigin: string;
        codeChallenge: string;
        email: string;
        issuer: string;
        redirectUri: string;
      }>,
    ): Promise<
      Readonly<{ ok: true; challenge: DesktopAuthorizationChallenge }> | AuthenticationFailure
    > {
      const email = normalizeEmail(input.email);
      if (
        !validEmail(email) ||
        !exactHttpsOrigin(input.accountOrigin) ||
        !exactHttpsOrigin(input.issuer) ||
        !exactLoopbackRedirect(input.redirectUri) ||
        !base64UrlValue(input.codeChallenge)
      ) {
        return failure();
      }
      const now = clock.now();
      const state = randomToken(48);
      const record: DesktopChallengeRecord = {
        id: ids.next(),
        email,
        redirectUri: input.redirectUri,
        issuer: input.issuer,
        stateDigest: digestOpaqueToken(state),
        codeChallenge: input.codeChallenge,
        codeDigest: null,
        approvedBy: null,
        issuedAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + 10 * 60_000).toISOString(),
        consumedAt: null,
      };
      await persistence.createDesktopChallenge(record);
      const authorizationUrl = new URL('/pt-BR/account/sign-in', input.accountOrigin);
      authorizationUrl.searchParams.set('desktop_challenge', record.id);
      authorizationUrl.searchParams.set('state', state);
      return {
        ok: true,
        challenge: {
          challengeId: record.id,
          authorizationUrl: authorizationUrl.toString(),
          state,
          codeChallenge: record.codeChallenge,
          codeChallengeMethod: 'S256',
          issuer: record.issuer,
          redirectUri: record.redirectUri,
        },
      };
    },

    async approveDesktopAuthorization(
      input: Readonly<{
        actor: IdentityActor;
        challengeId: string;
        state: string;
      }>,
    ): Promise<Readonly<{ ok: true; callbackUrl: string }> | AuthenticationFailure> {
      if (!base64UrlValue(input.state)) return failure();
      const code = randomToken(48);
      const challenge = await persistence.approveDesktopChallenge({
        accountId: input.actor.accountId,
        challengeId: input.challengeId,
        codeDigest: digestOpaqueToken(code),
        now: clock.now().toISOString(),
        stateDigest: digestOpaqueToken(input.state),
      });
      if (challenge === null) return failure();
      const callbackUrl = new URL(challenge.redirectUri);
      callbackUrl.searchParams.set('code', code);
      callbackUrl.searchParams.set('state', input.state);
      return { ok: true, callbackUrl: callbackUrl.toString() };
    },

    async exchangeDesktopAuthorization(
      input: Readonly<{
        authorizationCode: string;
        challengeId: string;
        codeVerifier: string;
        state: string;
      }>,
    ): Promise<AuthenticationResult> {
      if (
        !base64UrlValue(input.authorizationCode) ||
        !base64UrlValue(input.codeVerifier) ||
        !base64UrlValue(input.state)
      ) {
        return failure();
      }
      const challenge = await persistence.consumeDesktopChallenge({
        challengeId: input.challengeId,
        codeChallenge: digestOpaqueToken(input.codeVerifier, 'base64url'),
        codeDigest: digestOpaqueToken(input.authorizationCode),
        now: clock.now().toISOString(),
        stateDigest: digestOpaqueToken(input.state),
      });
      if (challenge?.approvedBy === null || challenge?.approvedBy === undefined) return failure();
      const identity = await persistence.findIdentityById(challenge.approvedBy);
      return identity?.status === 'active' ? issueSession(identity, 'desktop') : failure();
    },
  });
};

interface IdentityRow extends Record<string, unknown> {
  id: string;
  email: string;
  email_verified_at: Date | string;
  password_hash: string;
  display_name: string;
  locale: IdentityLocale;
  role: IdentityRole;
  status: IdentityRecord['status'];
  version: bigint | number | string;
  created_at: Date | string;
  updated_at: Date | string;
}

interface SessionRow extends Record<string, unknown> {
  id: string;
  identity_id: string;
  session_kind: PersistedSessionRecord['kind'];
  authentication_method: PersistedSessionRecord['authenticationMethod'];
  token_digest: string;
  issued_at: Date | string;
  expires_at: Date | string;
  last_seen_at: Date | string | null;
  revoked_at: Date | string | null;
  version: bigint | number | string;
}

interface ChallengeRow extends Record<string, unknown> {
  id: string;
  email: string;
  redirect_uri: string;
  issuer: string;
  state_digest: string;
  code_challenge: string;
  code_digest: string | null;
  approved_by: string | null;
  issued_at: Date | string;
  expires_at: Date | string;
  consumed_at: Date | string | null;
}

const iso = (value: Date | string): string =>
  (value instanceof Date ? value : new Date(value)).toISOString();

const identityFromRow = (row: Record<string, unknown>): IdentityRecord => {
  const value = row as IdentityRow;
  return {
    id: value.id,
    email: value.email,
    emailVerifiedAt: iso(value.email_verified_at),
    passwordHash: value.password_hash,
    displayName: value.display_name,
    locale: value.locale,
    role: value.role,
    status: value.status,
    version: BigInt(value.version),
    createdAt: iso(value.created_at),
    updatedAt: iso(value.updated_at),
  };
};

const sessionFromRow = (row: Record<string, unknown>): PersistedSessionRecord => {
  const value = row as SessionRow;
  return {
    id: value.id,
    accountId: value.identity_id,
    kind: value.session_kind,
    authenticationMethod: value.authentication_method,
    tokenDigest: value.token_digest,
    issuedAt: iso(value.issued_at),
    expiresAt: iso(value.expires_at),
    lastSeenAt: iso(value.last_seen_at ?? value.issued_at),
    revokedAt: value.revoked_at === null ? null : iso(value.revoked_at),
    version: BigInt(value.version),
  };
};

const challengeFromRow = (row: Record<string, unknown>): DesktopChallengeRecord => {
  const value = row as ChallengeRow;
  return {
    id: value.id,
    email: value.email,
    redirectUri: value.redirect_uri,
    issuer: value.issuer,
    stateDigest: value.state_digest,
    codeChallenge: value.code_challenge,
    codeDigest: value.code_digest,
    approvedBy: value.approved_by,
    issuedAt: iso(value.issued_at),
    expiresAt: iso(value.expires_at),
    consumedAt: value.consumed_at === null ? null : iso(value.consumed_at),
  };
};

const identityColumns = `id, email, email_verified_at, password_hash, display_name, locale,
  role, status, version, created_at, updated_at`;
const sessionColumns = `id, identity_id, session_kind, authentication_method, token_digest,
  issued_at, expires_at, last_seen_at, revoked_at, version`;
const challengeColumns = `id, email, redirect_uri, issuer, state_digest, code_challenge,
  code_digest, approved_by, issued_at, expires_at, consumed_at`;

export const createPostgresIdentityPersistence = (
  database: ControlPlaneMigrationDatabase,
): IdentityPersistence => ({
  async createInvitation(record) {
    await database.query(
      `INSERT INTO identity_invitations
       (id, email, token_digest, role, issued_at, expires_at, redeemed_at, redeemed_by)
       VALUES ($1, $2, $3, $4, $5, $6, NULL, NULL)`,
      [
        record.id,
        record.emailDigest,
        record.tokenDigest,
        record.role,
        record.issuedAt,
        record.expiresAt,
      ],
    );
  },

  redeemInvitation: (input) =>
    database.transaction(async (transaction) => {
      const invitation = await transaction.query<{
        email: string;
        expires_at: Date | string;
        redeemed_at: Date | string | null;
        role: IdentityRole;
      }>(
        `SELECT email, expires_at, redeemed_at, role
         FROM identity_invitations WHERE token_digest = $1 FOR UPDATE`,
        [input.invitationDigest],
      );
      const row = invitation.rows[0];
      if (row?.redeemed_at !== null) {
        return null;
      }
      if (
        row.email !== digestOpaqueToken(input.identity.email) ||
        Date.parse(iso(row.expires_at)) <= Date.parse(input.now)
      ) {
        return null;
      }
      const identity = { ...input.identity, role: row.role };
      await transaction.query(
        `INSERT INTO identities
         (id, email, email_verified_at, password_hash, display_name, locale, role, status,
          version, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', 1, $8, $8)`,
        [
          identity.id,
          identity.email,
          identity.emailVerifiedAt,
          identity.passwordHash,
          identity.displayName,
          identity.locale,
          identity.role,
          identity.createdAt,
        ],
      );
      await transaction.query(
        `UPDATE identity_invitations SET redeemed_at = $2, redeemed_by = $3
         WHERE token_digest = $1 AND redeemed_at IS NULL`,
        [input.invitationDigest, input.now, identity.id],
      );
      return identity;
    }),

  async findIdentityByEmail(email) {
    const result = await database.query(
      `SELECT ${identityColumns} FROM identities WHERE lower(email) = $1`,
      [email],
    );
    return result.rows[0] ? identityFromRow(result.rows[0]) : null;
  },

  async findIdentityById(id) {
    const result = await database.query(`SELECT ${identityColumns} FROM identities WHERE id = $1`, [
      id,
    ]);
    return result.rows[0] ? identityFromRow(result.rows[0]) : null;
  },

  async createSession(record) {
    await database.query(
      `INSERT INTO sessions
       (id, identity_id, provider_session_id, session_kind, authentication_method,
        token_digest, issued_at, expires_at, last_seen_at, version, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1, $7)`,
      [
        record.id,
        record.accountId,
        record.id,
        record.kind,
        record.authenticationMethod,
        record.tokenDigest,
        record.issuedAt,
        record.expiresAt,
        record.lastSeenAt,
      ],
    );
  },

  async findSessionByDigest(digest, now) {
    const result = await database.query(
      `UPDATE sessions SET last_seen_at = $2
       WHERE token_digest = $1 AND revoked_at IS NULL AND expires_at > $2
       RETURNING ${sessionColumns}`,
      [digest, now],
    );
    return result.rows[0] ? sessionFromRow(result.rows[0]) : null;
  },

  async revokeSessionByDigest(digest, now) {
    const result = await database.query(
      `UPDATE sessions SET revoked_at = $2, version = version + 1
       WHERE token_digest = $1 AND revoked_at IS NULL RETURNING id`,
      [digest, now],
    );
    return result.rowCount === 1;
  },

  updateIdentityProfile: (input) =>
    database.transaction(async (transaction) => {
      const result = await transaction.query(
        `UPDATE identities
         SET display_name = COALESCE($3, display_name), locale = COALESCE($4, locale),
             version = version + 1, updated_at = $5
         WHERE id = $1 AND version = $2 AND status = 'active'
         RETURNING ${identityColumns}`,
        [
          input.accountId,
          input.expectedVersion.toString(),
          input.displayName ?? null,
          input.locale ?? null,
          input.now,
        ],
      );
      if (result.rows[0]) return identityFromRow(result.rows[0]);
      const exists = await transaction.query(`SELECT id FROM identities WHERE id = $1`, [
        input.accountId,
      ]);
      return exists.rows[0] ? 'conflict' : null;
    }),

  async createDesktopChallenge(record) {
    await database.query(
      `INSERT INTO desktop_authorization_challenges
       (id, email, redirect_uri, issuer, state_digest, code_challenge, issued_at, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        record.id,
        record.email,
        record.redirectUri,
        record.issuer,
        record.stateDigest,
        record.codeChallenge,
        record.issuedAt,
        record.expiresAt,
      ],
    );
  },

  approveDesktopChallenge: (input) =>
    database.transaction(async (transaction) => {
      const result = await transaction.query(
        `UPDATE desktop_authorization_challenges AS challenge
         SET code_digest = $4, approved_by = $2
         FROM identities AS identity
         WHERE challenge.id = $1 AND identity.id = $2
           AND lower(identity.email) = lower(challenge.email)
           AND challenge.state_digest = $3 AND challenge.code_digest IS NULL
           AND challenge.consumed_at IS NULL AND challenge.expires_at > $5
         RETURNING ${challengeColumns.replaceAll(/\b(id|email|redirect_uri|issuer|state_digest|code_challenge|code_digest|approved_by|issued_at|expires_at|consumed_at)\b/gu, 'challenge.$1')}`,
        [input.challengeId, input.accountId, input.stateDigest, input.codeDigest, input.now],
      );
      return result.rows[0] ? challengeFromRow(result.rows[0]) : null;
    }),

  consumeDesktopChallenge: (input) =>
    database.transaction(async (transaction) => {
      const result = await transaction.query(
        `UPDATE desktop_authorization_challenges
         SET consumed_at = $6
         WHERE id = $1 AND state_digest = $2 AND code_digest = $3
           AND code_challenge = $4 AND approved_by IS NOT NULL
           AND consumed_at IS NULL AND expires_at > $5
         RETURNING ${challengeColumns}`,
        [
          input.challengeId,
          input.stateDigest,
          input.codeDigest,
          input.codeChallenge,
          input.now,
          input.now,
        ],
      );
      return result.rows[0] ? challengeFromRow(result.rows[0]) : null;
    }),
});

const realIdentityMigrationVersion = '0002_real_identity';
const realIdentityMigrationSql = readFileSync(
  new URL('./migrations/0002_real_identity.sql', import.meta.url),
  'utf8',
);
export const realIdentitySchemaHash = digestOpaqueToken(realIdentityMigrationSql);

export const migrateRealIdentity = async (
  database: ControlPlaneMigrationDatabase,
): Promise<Readonly<{ applied: boolean; schemaHash: string; version: string }>> =>
  database.transaction(async (transaction: ControlPlaneTransaction) => {
    await transaction.query(
      `SELECT pg_advisory_xact_lock(hashtext('liiiraa-boost-control-plane-migrations'))`,
    );
    const existing = await transaction.query<{ checksum: string }>(
      `SELECT checksum FROM control_plane_schema_migrations WHERE version = $1`,
      [realIdentityMigrationVersion],
    );
    if (existing.rows[0] !== undefined) {
      if (existing.rows[0].checksum !== realIdentitySchemaHash) {
        throw new Error(
          `Migration ${realIdentityMigrationVersion} checksum does not match reviewed SQL.`,
        );
      }
      return {
        applied: false,
        schemaHash: realIdentitySchemaHash,
        version: realIdentityMigrationVersion,
      };
    }
    await transaction.query(realIdentityMigrationSql);
    await transaction.query(
      `INSERT INTO control_plane_schema_migrations (version, checksum) VALUES ($1, $2)`,
      [realIdentityMigrationVersion, realIdentitySchemaHash],
    );
    return {
      applied: true,
      schemaHash: realIdentitySchemaHash,
      version: realIdentityMigrationVersion,
    };
  });

export type RealIdentityAuthority = ReturnType<typeof createRealIdentityAuthority>;
