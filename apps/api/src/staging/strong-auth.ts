import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes as secureRandomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';

import type { IdentityActor } from '@liiiraa/control-plane-adapters';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_UP_LIFETIME_MS = 5 * 60_000;
const ENROLLMENT_LIFETIME_MS = 10 * 60_000;
const TOTP_PERIOD_MS = 30_000;
const BOUNDED_AUTHORITY = /^[A-Za-z0-9._:@/-]{1,256}$/u;

export interface StoredStrongFactor {
  readonly accountId: string;
  readonly encryptedSecret: Buffer;
  readonly factorId: string;
  readonly lastUsedAt: string | null;
  readonly verifiedAt: string;
}

export interface StoredStepUpReceipt {
  readonly accountId: string;
  readonly action: string;
  readonly authorizationContextId: string;
  readonly expiresAt: string;
  readonly factorId: string;
  readonly receiptDigest: string;
  readonly receiptId: string;
  readonly redactedTarget: string;
  readonly resource: string;
  readonly sessionId: string;
  readonly usedAt: string | null;
  readonly verifiedAt: string;
}

export interface StagingStrongAuthRepository {
  loadTotpFactor(accountId: string): Promise<StoredStrongFactor | null>;
  storeTotpFactor(record: StoredStrongFactor): Promise<void>;
  useTotpFactor(factorId: string, counterStartedAt: string, usedAt: string): Promise<boolean>;
  storeStepUpReceipt(record: StoredStepUpReceipt): Promise<void>;
  consumeStepUpReceipt(
    input: Readonly<{
      accountId: string;
      action: string;
      authorizationContextId: string;
      receiptDigest: string;
      redactedTarget: string;
      resource: string;
      sessionId: string;
      usedAt: string;
    }>,
  ): Promise<StoredStepUpReceipt | null>;
  provisionStagingAdministrator(actor: IdentityActor): Promise<void>;
}

interface StrongAuthTransaction {
  query(
    statement: string,
    values?: readonly unknown[],
  ): Promise<
    Readonly<{
      rowCount?: number;
      rows: readonly Readonly<Record<string, unknown>>[];
    }>
  >;
}

interface StrongAuthDatabase extends StrongAuthTransaction {
  transaction<T>(operation: (transaction: StrongAuthTransaction) => Promise<T>): Promise<T>;
}

interface EnrollmentEnvelope {
  readonly accountId: string;
  readonly expiresAt: string;
  readonly secret: string;
  readonly sessionId: string;
}

export interface StrongAuthBinding {
  readonly action: string;
  readonly authorizationContextId: string;
  readonly redactedTarget: string;
  readonly resource: string;
}

export type StrongAuthFailureCode =
  'INVALID_ENROLLMENT' | 'INVALID_TOTP' | 'REPLAYED_TOTP' | 'STRONG_FACTOR_REQUIRED';

const base32 = (value: Uint8Array): string => {
  let bits = '';
  for (const byte of value) bits += byte.toString(2).padStart(8, '0');
  let encoded = '';
  for (let offset = 0; offset < bits.length; offset += 5) {
    encoded += BASE32_ALPHABET.charAt(
      Number.parseInt(bits.slice(offset, offset + 5).padEnd(5, '0'), 2),
    );
  }
  return encoded;
};

const decodeBase32 = (value: string): Buffer | null => {
  if (!/^[A-Z2-7]{16,128}$/u.test(value)) return null;
  let bits = '';
  for (const character of value) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index < 0) return null;
    bits += index.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
    bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
  }
  return Buffer.from(bytes);
};

const digest = (value: string): string => createHash('sha256').update(value).digest('hex');
const keyFor = (secret: string): Buffer => createHash('sha256').update(secret, 'utf8').digest();

const seal = (value: string, key: Buffer, randomBytes: (size: number) => Buffer): string => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `v1.${iv.toString('base64url')}.${ciphertext.toString('base64url')}.${cipher
    .getAuthTag()
    .toString('base64url')}`;
};

const unseal = (value: string, key: Buffer): string | null => {
  const [version, ivValue, ciphertextValue, tagValue, extra] = value.split('.');
  if (version !== 'v1' || !ivValue || !ciphertextValue || !tagValue || extra !== undefined)
    return null;
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivValue, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextValue, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return null;
  }
};

const hotp = (secret: Buffer, counter: number): string => {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const signature = createHmac('sha1', secret).update(message).digest();
  const lastByte = signature.at(-1);
  if (lastByte === undefined) throw new Error('TOTP_SIGNATURE_EMPTY');
  const offset = lastByte & 0x0f;
  return String((signature.readUInt32BE(offset) & 0x7fff_ffff) % 1_000_000).padStart(6, '0');
};

const matchedCounter = (secret: string, code: string, now: Date): number | null => {
  if (!/^[0-9]{6}$/u.test(code)) return null;
  const decoded = decodeBase32(secret);
  if (decoded === null) return null;
  const current = Math.floor(now.getTime() / TOTP_PERIOD_MS);
  const provided = Buffer.from(code, 'utf8');
  for (const counter of [current, current - 1, current + 1]) {
    const expected = Buffer.from(hotp(decoded, counter), 'utf8');
    if (expected.length === provided.length && timingSafeEqual(expected, provided)) return counter;
  }
  return null;
};

const admittedBinding = (value: StrongAuthBinding): boolean =>
  BOUNDED_AUTHORITY.test(value.action) &&
  BOUNDED_AUTHORITY.test(value.authorizationContextId) &&
  BOUNDED_AUTHORITY.test(value.resource) &&
  BOUNDED_AUTHORITY.test(value.redactedTarget);

const rowText = (row: Readonly<Record<string, unknown>>, key: string): string => {
  const value = row[key];
  return value instanceof Date
    ? value.toISOString()
    : typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint'
      ? String(value)
      : '';
};

export const createPostgresStagingStrongAuthRepository = (
  database: StrongAuthDatabase,
): StagingStrongAuthRepository => ({
  async loadTotpFactor(accountId) {
    const result = await database.query(
      `SELECT id::text AS factor_id, identity_id::text AS account_id, encrypted_secret,
              verified_at, last_used_at
         FROM security_factors
        WHERE identity_id = $1::uuid AND factor_kind = 'totp' AND revoked_at IS NULL
        ORDER BY verified_at DESC LIMIT 1`,
      [accountId],
    );
    const row = result.rows[0];
    if (row === undefined || !Buffer.isBuffer(row['encrypted_secret'])) return null;
    return {
      accountId: rowText(row, 'account_id'),
      encryptedSecret: row['encrypted_secret'],
      factorId: rowText(row, 'factor_id'),
      lastUsedAt: row['last_used_at'] === null ? null : rowText(row, 'last_used_at'),
      verifiedAt: rowText(row, 'verified_at'),
    };
  },

  storeTotpFactor: (record) =>
    database.transaction(async (transaction) => {
      await transaction.query(
        `UPDATE security_factors
            SET revoked_at = $3, version = version + 1
          WHERE identity_id = $1::uuid AND factor_kind = 'totp' AND revoked_at IS NULL
            AND id <> $2::uuid`,
        [record.accountId, record.factorId, record.verifiedAt],
      );
      await transaction.query(
        `INSERT INTO security_factors
          (id, identity_id, factor_kind, credential_reference, encrypted_secret, verified_at)
         VALUES ($1::uuid, $2::uuid, 'totp', 'totp-primary', $3, $4)
         ON CONFLICT (identity_id, factor_kind, credential_reference) DO UPDATE SET
           encrypted_secret = EXCLUDED.encrypted_secret, verified_at = EXCLUDED.verified_at,
           last_used_at = NULL, revoked_at = NULL, version = security_factors.version + 1`,
        [record.factorId, record.accountId, record.encryptedSecret, record.verifiedAt],
      );
    }),

  async useTotpFactor(factorId, counterStartedAt, usedAt) {
    const result = await database.query(
      `UPDATE security_factors SET last_used_at = $3, version = version + 1
        WHERE id = $1::uuid AND revoked_at IS NULL
          AND (last_used_at IS NULL OR last_used_at < $2::timestamptz)
        RETURNING id`,
      [factorId, counterStartedAt, usedAt],
    );
    return result.rows[0] !== undefined || result.rowCount === 1;
  },

  async storeStepUpReceipt(record) {
    await database.query(
      `INSERT INTO identity_step_up_receipts
        (id, receipt_digest, identity_id, session_id, factor_id, authorization_context_id,
         action, resource, redacted_target, verified_at, expires_at)
       VALUES ($1::uuid, $2, $3::uuid, $4::uuid, $5::uuid, $6, $7, $8, $9, $10, $11)`,
      [
        record.receiptId,
        record.receiptDigest,
        record.accountId,
        record.sessionId,
        record.factorId,
        record.authorizationContextId,
        record.action,
        record.resource,
        record.redactedTarget,
        record.verifiedAt,
        record.expiresAt,
      ],
    );
  },

  async consumeStepUpReceipt(input) {
    const result = await database.query(
      `UPDATE identity_step_up_receipts
          SET used_at = $9
        WHERE receipt_digest = $1 AND identity_id = $2::uuid AND session_id = $3::uuid
          AND authorization_context_id = $4 AND action = $5 AND resource = $6
          AND redacted_target = $7 AND used_at IS NULL AND expires_at > $8
        RETURNING id::text AS receipt_id, receipt_digest, identity_id::text AS account_id,
          session_id::text AS session_id, factor_id::text AS factor_id,
          authorization_context_id, action, resource, redacted_target,
          verified_at, expires_at, used_at`,
      [
        input.receiptDigest,
        input.accountId,
        input.sessionId,
        input.authorizationContextId,
        input.action,
        input.resource,
        input.redactedTarget,
        input.usedAt,
        input.usedAt,
      ],
    );
    const row = result.rows[0];
    return row === undefined
      ? null
      : {
          receiptId: rowText(row, 'receipt_id'),
          receiptDigest: rowText(row, 'receipt_digest'),
          accountId: rowText(row, 'account_id'),
          sessionId: rowText(row, 'session_id'),
          factorId: rowText(row, 'factor_id'),
          authorizationContextId: rowText(row, 'authorization_context_id'),
          action: rowText(row, 'action'),
          resource: rowText(row, 'resource'),
          redactedTarget: rowText(row, 'redacted_target'),
          verifiedAt: rowText(row, 'verified_at'),
          expiresAt: rowText(row, 'expires_at'),
          usedAt: rowText(row, 'used_at'),
        };
  },

  provisionStagingAdministrator: (actor) =>
    database.transaction(async (transaction) => {
      const ownerFunctions = actor.role === 'security' ? ['security', 'operations'] : [actor.role];
      const ownerCapabilities =
        actor.role === 'security'
          ? [
              'support:reply',
              'support:view',
              'device:manage',
              'entitlement:correct',
              'session:revoke',
              'diagnostics:view',
              'audit:reveal-sensitive',
              'audit:export',
              'beta-invitations:manage',
              'beta-invitations:preflight',
              'beta-invitations:issue',
              'beta-invitations:batch',
              'admin-membership:manage',
              'admin-membership:activate',
              'admin-function:simulate',
              'admin-access:review',
              'admin-delegation:manage',
              'admin-permissions:manage',
              'admin-approval:manage',
            ]
          : actor.role === 'support'
            ? ['support:reply', 'support:view']
            : actor.role === 'operations'
              ? ['device:manage', 'entitlement:correct']
              : ['audit:export', 'audit:reveal-sensitive'];
      const ownerScopes =
        actor.role === 'security'
          ? [
              'support-cases',
              'devices',
              'entitlements',
              'sessions',
              'diagnostic-metadata',
              'audit-events',
              'team',
              'history',
              'delegations',
              'reviews',
            ]
          : actor.role === 'support'
            ? ['support-cases']
            : actor.role === 'operations'
              ? ['devices', 'entitlements']
              : ['audit-events'];
      await transaction.query(
        `INSERT INTO admin_governance_memberships
          (id, identity_id, status, strong_factor, version, activated_at, created_at, updated_at)
         VALUES ($1::uuid, $1::uuid, 'active', 'mfa', 1, $2, $2, $2)
         ON CONFLICT (identity_id) DO UPDATE SET status = 'active', strong_factor = 'mfa',
           version = admin_governance_memberships.version + 1, updated_at = EXCLUDED.updated_at`,
        [actor.accountId, actor.updatedAt],
      );
      await transaction.query(
        `INSERT INTO admin_membership_functions
          (id, membership_id, function, assigned_at, assigned_by)
         SELECT gen_random_uuid(), $2::uuid, grant_value, $3, $2::uuid
           FROM unnest($1::text[]) AS grant_row(grant_value)
         ON CONFLICT DO NOTHING`,
        [ownerFunctions, actor.accountId, actor.updatedAt],
      );
      await transaction.query(
        `INSERT INTO admin_membership_capabilities
          (id, membership_id, capability, assigned_at, assigned_by)
         SELECT gen_random_uuid(), $2::uuid, grant_value, $3, $2::uuid
           FROM unnest($1::text[]) AS grant_row(grant_value)
         ON CONFLICT DO NOTHING`,
        [ownerCapabilities, actor.accountId, actor.updatedAt],
      );
      await transaction.query(
        `INSERT INTO admin_membership_scopes
          (id, membership_id, scope, assigned_at, assigned_by)
         SELECT gen_random_uuid(), $2::uuid, grant_value, $3, $2::uuid
           FROM unnest($1::text[]) AS grant_row(grant_value)
         ON CONFLICT DO NOTHING`,
        [ownerScopes, actor.accountId, actor.updatedAt],
      );
      await transaction.query(
        `UPDATE admin_function_sessions SET ended_at = $3
          WHERE session_id = $1 AND membership_id = $2::uuid AND ended_at IS NULL`,
        [actor.sessionId, actor.accountId, actor.updatedAt],
      );
      await transaction.query(
        `INSERT INTO admin_function_sessions
          (id, session_id, membership_id, active_function, simulation, version, started_at)
         VALUES ($1::uuid, $2, $3::uuid, $4, FALSE, 1, $5)`,
        [randomUUID(), actor.sessionId, actor.accountId, actor.role, actor.updatedAt],
      );
    }),
});

export const createStagingStrongAuth = ({
  clock = { now: () => new Date() },
  encryptionSecret,
  ids = { next: randomUUID },
  randomBytes = secureRandomBytes,
  repository,
}: Readonly<{
  clock?: Readonly<{ now(): Date }>;
  encryptionSecret: string;
  ids?: Readonly<{ next(): string }>;
  randomBytes?: (size: number) => Buffer;
  repository: StagingStrongAuthRepository;
}>) => {
  if (encryptionSecret.length < 43) throw new Error('STRONG_AUTH_SECRET_REJECTED');
  const encryptionKey = keyFor(encryptionSecret);

  const decryptFactor = (factor: StoredStrongFactor): string | null =>
    unseal(factor.encryptedSecret.toString('utf8'), encryptionKey);

  return Object.freeze({
    async status(actor: IdentityActor) {
      const factor = await repository.loadTotpFactor(actor.accountId);
      return factor === null
        ? { enabled: false as const }
        : {
            enabled: true as const,
            factor: 'totp' as const,
            methodId: factor.factorId,
            verifiedAt: factor.verifiedAt,
          };
    },

    beginTotpEnrollment(actor: IdentityActor) {
      const now = clock.now();
      const secret = base32(randomBytes(20));
      const expiresAt = new Date(now.getTime() + ENROLLMENT_LIFETIME_MS).toISOString();
      const envelope: EnrollmentEnvelope = {
        accountId: actor.accountId,
        expiresAt,
        secret,
        sessionId: actor.sessionId,
      };
      const enrollmentToken = seal(JSON.stringify(envelope), encryptionKey, randomBytes);
      const label = encodeURIComponent(`Liiiraa Boost:${actor.email}`);
      const parameters = new URLSearchParams({
        algorithm: 'SHA1',
        digits: '6',
        issuer: 'Liiiraa Boost',
        period: '30',
        secret,
      });
      return Object.freeze({
        enrollmentToken,
        expiresAt,
        otpauthUri: `otpauth://totp/${label}?${parameters.toString()}`,
        secret,
      });
    },

    async confirmTotpEnrollment(actor: IdentityActor, enrollmentToken: string, code: string) {
      const payload = unseal(enrollmentToken, encryptionKey);
      if (payload === null) return { ok: false as const, code: 'INVALID_ENROLLMENT' as const };
      let envelope: EnrollmentEnvelope;
      try {
        envelope = JSON.parse(payload) as EnrollmentEnvelope;
      } catch {
        return { ok: false as const, code: 'INVALID_ENROLLMENT' as const };
      }
      const now = clock.now();
      if (
        envelope.accountId !== actor.accountId ||
        envelope.sessionId !== actor.sessionId ||
        Date.parse(envelope.expiresAt) <= now.getTime()
      )
        return { ok: false as const, code: 'INVALID_ENROLLMENT' as const };
      if (matchedCounter(envelope.secret, code, now) === null)
        return { ok: false as const, code: 'INVALID_TOTP' as const };
      const verifiedAt = now.toISOString();
      const factorId = ids.next();
      await repository.storeTotpFactor({
        accountId: actor.accountId,
        encryptedSecret: Buffer.from(seal(envelope.secret, encryptionKey, randomBytes), 'utf8'),
        factorId,
        lastUsedAt: null,
        verifiedAt,
      });
      await repository.provisionStagingAdministrator(actor);
      return { ok: true as const, factor: 'totp' as const, factorId, verifiedAt };
    },

    async verifyTotpStepUp(
      actor: IdentityActor,
      input: StrongAuthBinding & Readonly<{ code: string }>,
    ) {
      if (!admittedBinding(input)) return { ok: false as const, code: 'INVALID_TOTP' as const };
      const factor = await repository.loadTotpFactor(actor.accountId);
      if (factor === null) return { ok: false as const, code: 'STRONG_FACTOR_REQUIRED' as const };
      const secret = decryptFactor(factor);
      const now = clock.now();
      const counter = secret === null ? null : matchedCounter(secret, input.code, now);
      if (counter === null) return { ok: false as const, code: 'INVALID_TOTP' as const };
      const counterStartedAt = new Date(counter * TOTP_PERIOD_MS).toISOString();
      if (!(await repository.useTotpFactor(factor.factorId, counterStartedAt, now.toISOString())))
        return { ok: false as const, code: 'REPLAYED_TOTP' as const };
      const receipt = randomBytes(48).toString('base64url');
      const expiresAt = new Date(now.getTime() + STEP_UP_LIFETIME_MS).toISOString();
      await repository.storeStepUpReceipt({
        accountId: actor.accountId,
        action: input.action,
        authorizationContextId: input.authorizationContextId,
        expiresAt,
        factorId: factor.factorId,
        receiptDigest: digest(receipt),
        receiptId: ids.next(),
        redactedTarget: input.redactedTarget,
        resource: input.resource,
        sessionId: actor.sessionId,
        usedAt: null,
        verifiedAt: now.toISOString(),
      });
      return {
        ok: true as const,
        expiresAt,
        method: 'totp' as const,
        receipt,
        verifiedAt: now.toISOString(),
      };
    },

    async consumeStepUpReceipt(
      actor: IdentityActor,
      input: StrongAuthBinding & Readonly<{ receipt: string }>,
    ) {
      if (
        !admittedBinding(input) ||
        input.receipt.length < 43 ||
        input.receipt.length > 256 ||
        !/^[A-Za-z0-9_-]+$/u.test(input.receipt)
      )
        return null;
      const consumed = await repository.consumeStepUpReceipt({
        accountId: actor.accountId,
        action: input.action,
        authorizationContextId: input.authorizationContextId,
        receiptDigest: digest(input.receipt),
        redactedTarget: input.redactedTarget,
        resource: input.resource,
        sessionId: actor.sessionId,
        usedAt: clock.now().toISOString(),
      });
      return consumed === null
        ? null
        : Object.freeze({
            actorId: consumed.accountId,
            action: consumed.action,
            authorizationContextId: consumed.authorizationContextId,
            evidenceId: consumed.receiptId,
            expiresAt: consumed.expiresAt,
            method: 'totp' as const,
            redactedTarget: consumed.redactedTarget,
            resource: consumed.resource,
            verifiedAt: consumed.verifiedAt,
          });
    },
  });
};

export type StagingStrongAuth = ReturnType<typeof createStagingStrongAuth>;
