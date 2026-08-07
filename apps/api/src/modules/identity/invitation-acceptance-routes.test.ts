import { createHmac } from 'node:crypto';

import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';

import {
  registerInvitationAcceptanceRoutes,
  type InvitationAcceptanceProgress,
} from './invitation-acceptance-routes.js';

const origin = 'https://account.test.liiiraa.dev';
const secret = 'synthetic-account-invitation-csrf-secret-12345678';
const now = '2030-01-01T00:00:00.000Z';
const token = 'invitation-secret-abcdefghijklmnopqrstuvwxyz0123456789';

const csrf = (nonce = 'acceptance-nonce-abcdefghijklmnopqrstuvwxyz') =>
  `${nonce}.${createHmac('sha256', secret).update(nonce).digest('base64url')}`;

const buildApp = async () => {
  const progress = new Map<string, InvitationAcceptanceProgress>();
  const inspect = {
    validate: vi.fn((input: Readonly<{ plaintextSecret: string }>) =>
      Promise.resolve(
        input.plaintextSecret === token
          ? {
              invitationId: 'invitation-1',
              version: 1n,
              locale: 'pt-BR' as const,
              resumeId: 'resume-opaque-1',
              possessionChallengeId: 'challenge-opaque-1',
            }
          : null,
      ),
    ),
  };
  const possession = {
    verify: vi.fn((input: Readonly<{ proof: string }>) =>
      Promise.resolve(
        input.proof === 'verified-email-proof'
          ? { verified: true as const, expiresAt: '2030-01-01T00:10:00.000Z' }
          : { verified: false as const },
      ),
    ),
  };
  const operations = {
    accept: vi.fn(() =>
      Promise.resolve({ ok: true as const, outcome: 'accepted' as const, receiptId: 'receipt-1' }),
    ),
  };
  const app = Fastify();
  await registerInvitationAcceptanceRoutes(app, {
    accountOrigin: origin,
    csrfSecret: secret,
    invitations: {} as never,
    inspect,
    possession,
    progress: {
      load: (invitationId, resumeId) =>
        Promise.resolve(progress.get(`${invitationId}:${resumeId}`) ?? null),
      save: (invitationId, resumeId, state) => {
        progress.set(`${invitationId}:${resumeId}`, state);
        return Promise.resolve();
      },
    },
    activateAccount: vi.fn(() =>
      Promise.resolve({ completed: true as const, accountReference: 'account-opaque-1' }),
    ),
    operations,
    rateLimit: vi.fn(() => Promise.resolve(true)),
    clock: { now: () => new Date(now) },
  });
  await app.ready();
  return { app, inspect, possession, operations, progress };
};

describe('recipient invitation acceptance routes', () => {
  it('returns the same generic denial for hostile origin, invalid token, and unknown invitation', async () => {
    const { app, inspect } = await buildApp();
    const responses = [
      await app.inject({
        method: 'POST',
        url: '/v1/identity/invitations/validate',
        headers: { origin: 'https://attacker.example', 'x-csrf-token': csrf() },
        payload: { invitationId: 'invitation-1', plaintextSecret: token },
      }),
      await app.inject({
        method: 'POST',
        url: '/v1/identity/invitations/validate',
        headers: { origin, 'x-csrf-token': csrf() },
        payload: {
          invitationId: 'invitation-1',
          plaintextSecret: 'invalid-token-abcdefghijklmnopqrstuvwxyz0123456789',
        },
      }),
    ];
    for (const response of responses) {
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ ok: false, code: 'INVITATION_UNAVAILABLE' });
      expect(response.body).not.toMatch(/email|account|token|secret|digest/iu);
    }
    expect(inspect.validate).toHaveBeenCalledTimes(1);
    await app.close();
  });

  it('validates into opaque resumable state without exposing the secret or invited email', async () => {
    const { app } = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/identity/invitations/validate',
      headers: { origin, 'x-csrf-token': csrf() },
      payload: { invitationId: 'invitation-1', plaintextSecret: token },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      invitationId: 'invitation-1',
      locale: 'pt-BR',
      resumeId: 'resume-opaque-1',
      possessionChallengeId: 'challenge-opaque-1',
      state: 'validated',
      version: '1',
    });
    expect(response.body).not.toMatch(/@|invitation-secret|digest/iu);
    await app.close();
  });

  it('derives possession from trusted verification and safely resumes only bounded progress', async () => {
    const { app, possession, progress } = await buildApp();
    await app.inject({
      method: 'POST',
      url: '/v1/identity/invitations/validate',
      headers: { origin, 'x-csrf-token': csrf() },
      payload: { invitationId: 'invitation-1', plaintextSecret: token },
    });
    const verified = await app.inject({
      method: 'POST',
      url: '/v1/identity/invitations/invitation-1/possession',
      headers: { origin, 'x-csrf-token': csrf() },
      payload: {
        resumeId: 'resume-opaque-1',
        possessionChallengeId: 'challenge-opaque-1',
        proof: 'verified-email-proof',
        recipientPossessionVerified: false,
      },
    });
    expect(verified.statusCode).toBe(200);
    expect(possession.verify).toHaveBeenCalledOnce();
    expect(progress.get('invitation-1:resume-opaque-1')).toMatchObject({
      possessionVerified: true,
      possessionEvidenceExpiresAt: '2030-01-01T00:10:00.000Z',
    });
    const resumed = await app.inject({
      method: 'GET',
      url: '/v1/identity/invitations/invitation-1/progress?resumeId=resume-opaque-1',
      headers: { origin },
    });
    expect(resumed.statusCode).toBe(200);
    expect(resumed.body).not.toMatch(/proof|token|secret|email|digest/iu);
    await app.close();
  });

  it('consumes only after trusted possession and completed account activation, with replay delegated atomically', async () => {
    const { app, operations } = await buildApp();
    const denied = await app.inject({
      method: 'POST',
      url: '/v1/identity/invitations/invitation-1/activate',
      headers: { origin, 'x-csrf-token': csrf() },
      payload: {
        resumeId: 'missing',
        commandId: 'accept-1',
        idempotencyKey: 'accept-idem',
        plaintextSecret: token,
        essentialTermsAccepted: true,
      },
    });
    expect(denied.statusCode).toBe(404);
    expect(operations.accept).not.toHaveBeenCalled();

    await app.inject({
      method: 'POST',
      url: '/v1/identity/invitations/validate',
      headers: { origin, 'x-csrf-token': csrf() },
      payload: { invitationId: 'invitation-1', plaintextSecret: token },
    });
    await app.inject({
      method: 'POST',
      url: '/v1/identity/invitations/invitation-1/possession',
      headers: { origin, 'x-csrf-token': csrf() },
      payload: {
        resumeId: 'resume-opaque-1',
        possessionChallengeId: 'challenge-opaque-1',
        proof: 'verified-email-proof',
      },
    });
    const accepted = await app.inject({
      method: 'POST',
      url: '/v1/identity/invitations/invitation-1/activate',
      headers: { origin, 'x-csrf-token': csrf() },
      payload: {
        resumeId: 'resume-opaque-1',
        commandId: 'accept-1',
        idempotencyKey: 'accept-idem',
        plaintextSecret: token,
        essentialTermsAccepted: true,
      },
    });
    expect(accepted.statusCode).toBe(200);
    expect(operations.accept).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        recipientPossessionVerified: true,
        accountActivationCompleted: true,
        accountReference: 'account-opaque-1',
      }),
    );
    expect(accepted.body).not.toMatch(/invitation-secret|account-opaque-1/iu);
    await app.close();
  });
});
