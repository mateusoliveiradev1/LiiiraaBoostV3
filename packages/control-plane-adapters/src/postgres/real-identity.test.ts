import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import {
  createPostgresIdentityPersistence,
  createRealIdentityAuthority,
  digestOpaqueToken,
  hashIdentityPassword,
  type DesktopChallengeRecord,
  type IdentityPersistence,
  type IdentityRecord,
  type InvitationRecord,
  type PersistedSessionRecord,
} from './real-identity.js';

const NOW = '2030-01-01T12:00:00.000Z';
const LATER = '2030-01-02T12:00:00.000Z';

class MemoryIdentityPersistence implements IdentityPersistence {
  readonly invitations = new Map<string, InvitationRecord>();
  readonly identities = new Map<string, IdentityRecord>();
  readonly sessions = new Map<string, PersistedSessionRecord>();
  readonly challenges = new Map<string, DesktopChallengeRecord>();
  private tail: Promise<void> = Promise.resolve();

  createInvitation(record: InvitationRecord): Promise<void> {
    this.invitations.set(record.tokenDigest, record);
    return Promise.resolve();
  }

  async redeemInvitation(input: {
    identity: IdentityRecord;
    invitationDigest: string;
    now: string;
  }): Promise<IdentityRecord | null> {
    return this.lock(() => {
      const invitation = this.invitations.get(input.invitationDigest);
      if (invitation?.redeemedAt !== null) {
        return Promise.resolve(null);
      }
      if (
        Date.parse(invitation.expiresAt) <= Date.parse(input.now) ||
        invitation.emailDigest !== digestOpaqueToken(input.identity.email)
      ) {
        return Promise.resolve(null);
      }
      this.invitations.set(input.invitationDigest, {
        ...invitation,
        redeemedAt: input.now,
        redeemedBy: input.identity.id,
      });
      this.identities.set(input.identity.id, input.identity);
      return Promise.resolve(input.identity);
    });
  }

  findIdentityByEmail(email: string): Promise<IdentityRecord | null> {
    return Promise.resolve(
      [...this.identities.values()].find((identity) => identity.email === email) ?? null,
    );
  }

  findIdentityById(id: string): Promise<IdentityRecord | null> {
    return Promise.resolve(this.identities.get(id) ?? null);
  }

  createSession(record: PersistedSessionRecord): Promise<void> {
    this.sessions.set(record.tokenDigest, record);
    return Promise.resolve();
  }

  findSessionByDigest(digest: string, now: string): Promise<PersistedSessionRecord | null> {
    const session = this.sessions.get(digest);
    return Promise.resolve(
      session?.revokedAt === null && Date.parse(session.expiresAt) > Date.parse(now)
        ? session
        : null,
    );
  }

  revokeSessionByDigest(digest: string, now: string): Promise<boolean> {
    const session = this.sessions.get(digest);
    if (session?.revokedAt !== null) return Promise.resolve(false);
    this.sessions.set(digest, { ...session, revokedAt: now, version: session.version + 1n });
    return Promise.resolve(true);
  }

  updateIdentityProfile(input: {
    accountId: string;
    displayName?: string;
    expectedVersion: bigint;
    locale?: 'pt-BR' | 'en';
    now: string;
  }): Promise<IdentityRecord | 'conflict' | null> {
    const identity = this.identities.get(input.accountId);
    if (identity === undefined) return Promise.resolve(null);
    if (identity.version !== input.expectedVersion) return Promise.resolve('conflict');
    const updated: IdentityRecord = {
      ...identity,
      ...(input.displayName === undefined ? {} : { displayName: input.displayName }),
      ...(input.locale === undefined ? {} : { locale: input.locale }),
      updatedAt: input.now,
      version: identity.version + 1n,
    };
    this.identities.set(identity.id, updated);
    return Promise.resolve(updated);
  }

  createDesktopChallenge(record: DesktopChallengeRecord): Promise<void> {
    this.challenges.set(record.id, record);
    return Promise.resolve();
  }

  approveDesktopChallenge(input: {
    accountId: string;
    challengeId: string;
    codeDigest: string;
    now: string;
    stateDigest: string;
  }): Promise<DesktopChallengeRecord | null> {
    const challenge = this.challenges.get(input.challengeId);
    const identity = this.identities.get(input.accountId);
    if (challenge === undefined) return Promise.resolve(null);
    if (
      identity?.email !== challenge.email ||
      challenge.stateDigest !== input.stateDigest ||
      challenge.codeDigest !== null ||
      Date.parse(challenge.expiresAt) <= Date.parse(input.now)
    ) {
      return Promise.resolve(null);
    }
    const approved = { ...challenge, approvedBy: input.accountId, codeDigest: input.codeDigest };
    this.challenges.set(input.challengeId, approved);
    return Promise.resolve(approved);
  }

  consumeDesktopChallenge(input: {
    challengeId: string;
    codeChallenge: string;
    codeDigest: string;
    now: string;
    stateDigest: string;
  }): Promise<DesktopChallengeRecord | null> {
    const challenge = this.challenges.get(input.challengeId);
    if (challenge === undefined) return Promise.resolve(null);
    if (
      challenge.consumedAt !== null ||
      challenge.approvedBy === null ||
      challenge.codeDigest !== input.codeDigest ||
      challenge.stateDigest !== input.stateDigest ||
      challenge.codeChallenge !== input.codeChallenge ||
      Date.parse(challenge.expiresAt) <= Date.parse(input.now)
    ) {
      return Promise.resolve(null);
    }
    const consumed = { ...challenge, consumedAt: input.now };
    this.challenges.set(input.challengeId, consumed);
    return Promise.resolve(consumed);
  }

  private async lock<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.tail;
    let release = (): void => undefined;
    this.tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }
}

const authority = (persistence: IdentityPersistence) => {
  const tokens = [
    'invite-token-abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJ',
    'web-session-abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJ',
    'web-session-2-abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGH',
    'desktop-state-abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGH',
    'desktop-code-abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHI',
    'desktop-session-abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG',
  ];
  let id = 0;
  return createRealIdentityAuthority(persistence, {
    clock: { now: () => new Date(NOW) },
    ids: { next: () => `00000000-0000-4000-8000-${String(++id).padStart(12, '0')}` },
    passwords: {
      hash: (password) => Promise.resolve(`hashed:${password}`),
      verify: (password, encoded) => Promise.resolve(encoded === `hashed:${password}`),
    },
    randomToken: () => {
      const token = tokens.shift();
      if (token === undefined) throw new Error('test token queue exhausted');
      return token;
    },
  });
};

describe('real invitation-only identity authority', () => {
  it('binds the session UUID and provider text through distinct PostgreSQL parameters', async () => {
    let captured:
      | Readonly<{ statement: string; values: readonly unknown[] | undefined }>
      | undefined;
    const database = {
      query(statement: string, values?: readonly unknown[]) {
        captured = { statement, values };
        return Promise.resolve({ rowCount: 1, rows: [] });
      },
    } as unknown as Parameters<typeof createPostgresIdentityPersistence>[0];
    const persistence = createPostgresIdentityPersistence(database);

    await persistence.createSession({
      id: '00000000-0000-4000-8000-000000000010',
      accountId: '00000000-0000-4000-8000-000000000001',
      tokenDigest: 'a'.repeat(64),
      kind: 'admin',
      authenticationMethod: 'password',
      issuedAt: NOW,
      expiresAt: LATER,
      lastSeenAt: NOW,
      revokedAt: null,
      version: 1n,
    });

    expect(captured?.statement).toMatch(
      /VALUES \(\$1, \$2, \$3, \$4, \$5, \$6, \$7, \$8, \$9, 1, \$7\)/u,
    );
    expect(captured?.values).toEqual([
      '00000000-0000-4000-8000-000000000010',
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000010',
      'admin',
      'password',
      'a'.repeat(64),
      NOW,
      LATER,
      NOW,
    ]);
  });

  it('redeems one invitation once and restores/revokes a persisted session after restart', async () => {
    const persistence = new MemoryIdentityPersistence();
    const firstProcess = authority(persistence);
    const invitation = await firstProcess.issueInvitation({
      email: 'Owner@Example.com',
      expiresAt: LATER,
      role: 'tester',
    });
    expect(invitation.token).not.toBe(invitation.tokenDigest);
    expect(persistence.invitations.has(invitation.token)).toBe(false);
    expect(persistence.invitations.has(digestOpaqueToken(invitation.token))).toBe(true);
    expect(persistence.invitations.get(digestOpaqueToken(invitation.token))?.emailDigest).toBe(
      digestOpaqueToken('owner@example.com'),
    );
    expect(JSON.stringify([...persistence.invitations.values()])).not.toContain(
      'owner@example.com',
    );

    const attempts = await Promise.all([
      firstProcess.signUp({
        displayName: 'Owner',
        email: 'owner@example.com',
        invitationToken: invitation.token,
        locale: 'pt-BR',
        password: 'CorrectHorse1',
      }),
      firstProcess.signUp({
        displayName: 'Other',
        email: 'owner@example.com',
        invitationToken: invitation.token,
        locale: 'en',
        password: 'CorrectHorse1',
      }),
    ]);
    expect(attempts.filter((result) => result.ok)).toHaveLength(1);

    await expect(
      firstProcess.signIn({ email: 'owner@example.com', password: 'wrong-password' }),
    ).resolves.toEqual({ ok: false, code: 'AUTHENTICATION_FAILED' });
    const signedIn = await firstProcess.signIn({
      email: 'OWNER@example.com',
      password: 'CorrectHorse1',
    });
    expect(signedIn.ok).toBe(true);
    if (!signedIn.ok) return;

    const restartedProcess = authority(persistence);
    await expect(restartedProcess.resolveCredential(signedIn.credential)).resolves.toMatchObject({
      accountId: signedIn.actor.accountId,
      email: 'owner@example.com',
    });
    await expect(restartedProcess.signOut(signedIn.credential)).resolves.toBe(true);
    await expect(restartedProcess.resolveCredential(signedIn.credential)).resolves.toBeNull();
  });

  it('requires one-time state, code and S256 verifier for desktop exchange', async () => {
    const persistence = new MemoryIdentityPersistence();
    const service = authority(persistence);
    const invitation = await service.issueInvitation({
      email: 'desktop@example.com',
      expiresAt: LATER,
      role: 'tester',
    });
    const signup = await service.signUp({
      displayName: 'Desktop Tester',
      email: 'desktop@example.com',
      invitationToken: invitation.token,
      locale: 'en',
      password: 'CorrectHorse1',
    });
    expect(signup.ok).toBe(true);
    if (!signup.ok) return;

    const verifier = 'v'.repeat(64);
    const codeChallenge = digestOpaqueToken(verifier, 'base64url');
    const challenge = await service.beginDesktopAuthorization({
      accountOrigin: 'https://account.staging.example',
      codeChallenge,
      email: 'desktop@example.com',
      issuer: 'https://api.staging.example',
      redirectUri: 'http://127.0.0.1:43117/oauth/callback',
    });
    expect(challenge.ok).toBe(true);
    if (!challenge.ok) return;
    expect(new URL(challenge.challenge.authorizationUrl).pathname).toBe('/pt-BR/login');
    const state = new URL(challenge.challenge.authorizationUrl).searchParams.get('state');
    expect(state).toBeTruthy();

    const approval = await service.approveDesktopAuthorization({
      actor: signup.actor,
      challengeId: challenge.challenge.challengeId,
      state: state ?? '',
    });
    expect(approval.ok).toBe(true);
    if (!approval.ok) return;
    const callback = new URL(approval.callbackUrl);
    const authorizationCode = callback.searchParams.get('code') ?? '';

    await expect(
      service.exchangeDesktopAuthorization({
        authorizationCode,
        challengeId: challenge.challenge.challengeId,
        codeVerifier: 'x'.repeat(64),
        state: state ?? '',
      }),
    ).resolves.toEqual({ ok: false, code: 'AUTHENTICATION_FAILED' });
    const exchange = await service.exchangeDesktopAuthorization({
      authorizationCode,
      challengeId: challenge.challenge.challengeId,
      codeVerifier: verifier,
      state: state ?? '',
    });
    expect(exchange.ok).toBe(true);
    await expect(
      service.exchangeDesktopAuthorization({
        authorizationCode,
        challengeId: challenge.challenge.challengeId,
        codeVerifier: verifier,
        state: state ?? '',
      }),
    ).resolves.toEqual({ ok: false, code: 'AUTHENTICATION_FAILED' });
  });

  it('uses a bounded memory-hard password encoding and declares digest-only auth tables', async () => {
    const encoded = await hashIdentityPassword('CorrectHorse1', Buffer.alloc(16, 7));
    expect(encoded).toMatch(/^scrypt\$32768\$8\$1\$/u);
    expect(encoded).not.toContain('CorrectHorse1');

    const migration = await readFile(
      new URL('./migrations/0002_real_identity.sql', import.meta.url),
      'utf8',
    );
    expect(migration).toMatch(/identity_invitations[\s\S]*token_digest CHAR\(64\)/iu);
    expect(migration).toMatch(/desktop_authorization_challenges[\s\S]*code_digest CHAR\(64\)/iu);
    expect(migration).not.toMatch(/invitation_token|session_token|authorization_code TEXT/iu);
  });
});
