import type {
  IdentityActionScope,
  IdentityProviderPort,
  IdentitySecondFactor,
  IdentitySignInMethod,
} from '@liiiraa/control-plane-application';
import { beforeEach, describe, expect, it } from 'vitest';

import { createBetterAuthSpikeAdapter } from './better-auth-spike.js';

const ISSUER = 'https://identity.test.liiiraa.dev';
const REDIRECT_URI = 'http://127.0.0.1:49152/oauth/callback';

const expectSuccess = <T>(result: Awaited<ReturnType<() => Promise<T>>>) => {
  expect(result).toMatchObject({ ok: true });
  if (!(result as { ok: boolean }).ok) {
    throw new Error('Expected the identity provider operation to succeed');
  }
  return (result as { ok: true; value: unknown }).value;
};

const expectFailure = (result: { readonly ok: boolean; readonly code?: string }, code: string) => {
  expect(result).toMatchObject({ ok: false, code });
};

const completeDirectSignIn = async (
  provider: IdentityProviderPort,
  method: IdentitySignInMethod,
  emailVerified = true,
) => {
  const challenge = await provider.beginSignIn({ method, email: 'player@example.test' });
  expectSuccess(challenge);
  if (!challenge.ok) throw new Error('Sign-in challenge unavailable');
  const completed = await provider.completeSignIn({
    challengeId: challenge.value.id,
    emailVerified,
  });
  expectSuccess(completed);
  if (!completed.ok) throw new Error('Sign-in completion unavailable');
  return completed.value;
};

describe('Better Auth terminating identity adapter matrix', () => {
  let provider: IdentityProviderPort;

  beforeEach(() => {
    provider = createBetterAuthSpikeAdapter();
  });

  it('D-01 admits only verified password, Google, Discord, and passkey launch methods', async () => {
    const passwordChallenge = await provider.beginSignIn({
      method: 'password',
      email: 'player@example.test',
    });
    expectSuccess(passwordChallenge);
    if (!passwordChallenge.ok) return;

    expectFailure(
      await provider.completeSignIn({
        challengeId: passwordChallenge.value.id,
        emailVerified: false,
      }),
      'UNVERIFIED_EMAIL',
    );

    for (const method of ['password', 'google', 'discord', 'passkey'] as const) {
      const session = await completeDirectSignIn(provider, method);
      expect(session.method).toBe(method);
      expect(session.state).toBe('active');
    }

    expectFailure(
      await provider.beginSignIn({
        method: 'microsoft' as IdentitySignInMethod,
        email: 'player@example.test',
      }),
      'UNSUPPORTED_METHOD',
    );
  });

  it('D-02 offers passkey enrollment only after verified email login', async () => {
    const pending = await provider.beginSignIn({
      method: 'password',
      email: 'new-player@example.test',
    });
    expectSuccess(pending);
    if (!pending.ok) return;

    expectFailure(
      await provider.completeSignIn({ challengeId: pending.value.id, emailVerified: false }),
      'UNVERIFIED_EMAIL',
    );
    expectFailure(
      await provider.enrollFactor({ sessionId: pending.value.id, factor: 'passkey' }),
      'UNVERIFIED_EMAIL',
    );

    expectSuccess(
      await provider.verifyEmail({
        email: 'new-player@example.test',
        verificationToken: 'verified-email-token',
      }),
    );
    const session = await provider.completeSignIn({
      challengeId: pending.value.id,
      emailVerified: true,
    });
    expectSuccess(session);
    if (!session.ok) return;
    expectSuccess(await provider.enrollFactor({ sessionId: session.value.id, factor: 'passkey' }));
  });

  it.each(['password', 'google', 'passkey'] as const)(
    'D-03 enforces fresh action-scoped step-up for %s sessions',
    async (method) => {
      const session = await completeDirectSignIn(provider, method);
      const sensitiveActions: readonly IdentityActionScope[] = [
        'security-methods',
        'device-transfer',
        'refund',
        'protected-data',
      ];

      for (const actionScope of sensitiveActions) {
        const receipt = await provider.stepUp({
          sessionId: session.id,
          actionScope,
          factor: 'totp',
          proof: 'totp:123456',
        });
        expectSuccess(receipt);
        if (receipt.ok) expect(receipt.value.actionScope).toBe(actionScope);
      }

      expectFailure(
        await provider.stepUp({
          sessionId: session.id,
          actionScope: 'refund',
          factor: 'totp',
          proof: 'stale:totp:123456',
        }),
        'STEP_UP_STALE',
      );
    },
  );

  it('D-04 accepts only TOTP, passkey, and one-use recovery code second factors', async () => {
    const session = await completeDirectSignIn(provider, 'password');
    for (const factor of ['totp', 'passkey', 'recovery-code'] as const) {
      expectSuccess(
        await provider.stepUp({
          sessionId: session.id,
          actionScope: 'security-methods',
          factor,
          proof: `${factor}:valid`,
        }),
      );
    }

    expectFailure(
      await provider.stepUp({
        sessionId: session.id,
        actionScope: 'security-methods',
        factor: 'sms' as IdentitySecondFactor,
        proof: 'sms:123456',
      }),
      'INVALID_FACTOR',
    );
    expectFailure(
      await provider.stepUp({
        sessionId: session.id,
        actionScope: 'security-methods',
        factor: 'email' as IdentitySecondFactor,
        proof: 'email:123456',
      }),
      'INVALID_FACTOR',
    );
  });

  it('D-05 routes total-factor loss to reviewed recovery', async () => {
    for (const evidence of ['verified-email', 'recovery-code'] as const) {
      const challenge = await provider.beginRecovery({
        email: 'player@example.test',
        evidence,
      });
      expectSuccess(challenge);
      if (challenge.ok) expect(challenge.value.route).toBe(evidence);
    }

    const reviewed = await provider.beginRecovery({
      email: 'player@example.test',
      evidence: 'all-factors-lost',
    });
    expectSuccess(reviewed);
    if (!reviewed.ok) return;
    expect(reviewed.value.route).toBe('security-review');
    expectFailure(
      await provider.completeRecovery({
        challengeId: reviewed.value.id,
        evidence: 'email-only',
      }),
      'RECOVERY_REVIEW_REQUIRED',
    );
  });

  it('D-06 imposes a 24-hour hold and trusted-session contest notice after reviewed recovery', async () => {
    const challenge = await provider.beginRecovery({
      email: 'player@example.test',
      evidence: 'all-factors-lost',
    });
    expectSuccess(challenge);
    if (!challenge.ok) return;
    const receipt = await provider.completeRecovery({
      challengeId: challenge.value.id,
      evidence: 'security-review-approved',
      reviewedBySecurity: true,
    });
    expectSuccess(receipt);
    if (!receipt.ok) return;

    expect(receipt.value.reviewed).toBe(true);
    expect(receipt.value.contestable).toBe(true);
    expect(receipt.value.trustedSessionNoticeId).toMatch(/^notice_/);
    const holdStart = Date.parse(receipt.value.session.createdAt);
    const holdEnd = Date.parse(receipt.value.criticalActionHoldUntil ?? '');
    expect(holdEnd - holdStart).toBe(24 * 60 * 60 * 1_000);
    expectFailure(
      await provider.stepUp({
        sessionId: receipt.value.session.id,
        actionScope: 'device-transfer',
        factor: 'passkey',
        proof: 'passkey:valid',
      }),
      'RECOVERY_HOLD_ACTIVE',
    );
  });

  it('D-07 lists and independently revokes web and desktop sessions', async () => {
    const web = await completeDirectSignIn(provider, 'password');
    const desktopChallenge = await provider.beginSignIn({
      method: 'google',
      desktop: { issuer: ISSUER, redirectUri: REDIRECT_URI },
    });
    expectSuccess(desktopChallenge);
    if (!desktopChallenge.ok) return;
    const desktop = await provider.completeSignIn({
      challengeId: desktopChallenge.value.id,
      authorizationCode: 'backend-exchanged-code',
      state: desktopChallenge.value.state,
      issuer: ISSUER,
      redirectUri: REDIRECT_URI,
      codeVerifier: 'v'.repeat(64),
    });
    expectSuccess(desktop);
    if (!desktop.ok) return;

    const before = await provider.listSessions({ accountId: 'account_player' });
    expectSuccess(before);
    if (!before.ok) return;
    expect(before.value.map((session) => session.id)).toEqual(
      expect.arrayContaining([web.id, desktop.value.id]),
    );
    expectSuccess(
      await provider.revokeSession({ accountId: 'account_player', sessionId: desktop.value.id }),
    );
    const after = await provider.listSessions({ accountId: 'account_player' });
    expectSuccess(after);
    if (after.ok) {
      expect(after.value.find((session) => session.id === desktop.value.id)?.state).toBe('revoked');
      expect(after.value.find((session) => session.id === web.id)?.state).toBe('active');
    }
  });

  it('D-08 separates administrative roles and rejects an omnipotent production role', async () => {
    const session = await completeDirectSignIn(provider, 'passkey');
    for (const role of ['support', 'operations', 'security', 'audit'] as const) {
      const receipt = await provider.stepUp({
        sessionId: session.id,
        actionScope: `admin-role:${role}`,
        factor: 'passkey',
        proof: `role:${role}`,
      });
      expectSuccess(receipt);
      if (receipt.ok) expect(receipt.value.assumedRole).toBe(role);
    }
    expectFailure(
      await provider.stepUp({
        sessionId: session.id,
        actionScope: 'admin-role:super-admin' as IdentityActionScope,
        factor: 'passkey',
        proof: 'role:super-admin',
      }),
      'STEP_UP_REQUIRED',
    );
  });

  it('D-09 permits one audited non-production role assumption at a time', async () => {
    const session = await completeDirectSignIn(provider, 'passkey');
    const support = await provider.stepUp({
      sessionId: session.id,
      actionScope: 'admin-role:support',
      factor: 'passkey',
      proof: 'non-production-role:support',
    });
    expectSuccess(support);
    if (!support.ok) return;
    expect(support.value.auditReceiptId).toMatch(/^audit_/);
    expect(support.value.assumedRole).toBe('support');

    const security = await provider.stepUp({
      sessionId: session.id,
      actionScope: 'admin-role:security',
      factor: 'passkey',
      proof: 'non-production-role:security',
    });
    expectSuccess(security);
    if (security.ok) {
      expect(security.value.auditReceiptId).not.toBe(support.value.auditReceiptId);
      expect(security.value.assumedRole).toBe('security');
    }
  });

  it('D-10 uses one-shot external-browser S256 PKCE with backend code exchange', async () => {
    const challenge = await provider.beginSignIn({
      method: 'discord',
      desktop: { issuer: ISSUER, redirectUri: REDIRECT_URI },
    });
    expectSuccess(challenge);
    if (!challenge.ok) return;
    expect(challenge.value).toMatchObject({
      transport: 'external-browser',
      codeChallengeMethod: 'S256',
      redirectUri: REDIRECT_URI,
      issuer: ISSUER,
    });
    expect(challenge.value.authorizationUrl).toMatch(/^https:\/\//);
    expect(challenge.value.authorizationUrl).not.toContain('client_secret');
    expect(challenge.value.state).toMatch(/^[A-Za-z0-9_-]{32,}$/);
    expect(challenge.value.codeChallenge).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const input = {
      challengeId: challenge.value.id,
      authorizationCode: 'backend-exchanged-code',
      state: challenge.value.state,
      issuer: ISSUER,
      redirectUri: REDIRECT_URI,
      codeVerifier: 'v'.repeat(64),
    } as const;
    const completed = await provider.completeSignIn(input);
    expectSuccess(completed);
    expectFailure(await provider.completeSignIn(input), 'REPLAYED_CHALLENGE');
  });

  it('fails closed for enumeration, replay, redirect confusion, stale step-up, and rate abuse', async () => {
    const unknown = await provider.beginRecovery({
      email: 'unknown@example.test',
      evidence: 'verified-email',
    });
    const known = await provider.beginRecovery({
      email: 'player@example.test',
      evidence: 'verified-email',
    });
    expect(unknown.ok).toBe(known.ok);
    if (unknown.ok && known.ok) {
      expect(unknown.value.genericNotice).toBe(true);
      expect(known.value.genericNotice).toBe(true);
    }

    const challenge = await provider.beginSignIn({
      method: 'google',
      desktop: { issuer: ISSUER, redirectUri: REDIRECT_URI },
    });
    expectSuccess(challenge);
    if (!challenge.ok) return;
    const common = {
      challengeId: challenge.value.id,
      authorizationCode: 'code',
      state: challenge.value.state,
      issuer: ISSUER,
      redirectUri: REDIRECT_URI,
      codeVerifier: 'v'.repeat(64),
    } as const;
    expectFailure(
      await provider.completeSignIn({ ...common, redirectUri: 'http://127.0.0.1:9/callback' }),
      'REDIRECT_MISMATCH',
    );
    expectFailure(
      await provider.completeSignIn({ ...common, issuer: 'https://attacker.example' }),
      'ISSUER_MISMATCH',
    );
    expectFailure(
      await provider.completeSignIn({ ...common, state: 'wrong-state' }),
      'STATE_MISMATCH',
    );

    let rateLimited = false;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const result = await provider.beginSignIn({
        method: 'password',
        email: 'abuse@example.test',
      });
      if (!result.ok && result.code === 'RATE_LIMITED') rateLimited = true;
    }
    expect(rateLimited).toBe(true);
  });
});
