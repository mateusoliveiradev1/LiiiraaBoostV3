import { describe, expect, it } from 'vitest';

import {
  RECOVERY_MINIMUM_HOLD_MS,
  authorizeSensitiveAction,
  decideRecoveryTransition,
  type RecoveryState,
  type SensitiveAction,
} from './recovery.js';

const REQUESTED_AT = '2030-03-01T09:00:00.000Z';
const REVIEWED_AT = '2030-03-02T09:00:00.000Z';
const HOLD_UNTIL = '2030-03-03T09:00:00.000Z';

const idle = (): RecoveryState => ({ status: 'idle', version: 1n });

const pendingReview = (): RecoveryState => {
  const decision = decideRecoveryTransition(idle(), {
    kind: 'request',
    evidence: 'all-factors-lost',
    now: REQUESTED_AT,
  });
  if (!decision.accepted) throw new Error(decision.code);
  return decision.state;
};

describe('identity-recovery policy witnesses', () => {
  it('D-03 recovery evidence routes verified email and one-use code directly but total loss to review', () => {
    for (const evidence of ['verified-email', 'recovery-code'] as const) {
      expect(
        decideRecoveryTransition(idle(), { kind: 'request', evidence, now: REQUESTED_AT }),
      ).toMatchObject({
        accepted: true,
        state: { status: 'ready', route: evidence, version: 2n },
      });
    }
    expect(
      decideRecoveryTransition(idle(), {
        kind: 'request',
        evidence: 'all-factors-lost',
        now: REQUESTED_AT,
      }),
    ).toMatchObject({
      accepted: true,
      state: { status: 'pending-review', route: 'security-review', version: 2n },
    });
  });

  it('D-04 exceptional recovery approval enforces a 24-hour hold and security effects', () => {
    const tooShort = new Date(Date.parse(REVIEWED_AT) + RECOVERY_MINIMUM_HOLD_MS - 1).toISOString();
    expect(
      decideRecoveryTransition(pendingReview(), {
        kind: 'approve',
        reviewedBy: 'security-reviewer',
        now: REVIEWED_AT,
        holdUntil: tooShort,
      }),
    ).toEqual({ accepted: false, code: 'HOLD_TOO_SHORT' });

    expect(
      decideRecoveryTransition(pendingReview(), {
        kind: 'approve',
        reviewedBy: 'security-reviewer',
        now: REVIEWED_AT,
        holdUntil: HOLD_UNTIL,
      }),
    ).toEqual({
      accepted: true,
      state: {
        status: 'active-hold',
        route: 'security-review',
        requestedAt: REQUESTED_AT,
        startsAt: REVIEWED_AT,
        endsAt: HOLD_UNTIL,
        version: 3n,
      },
      effects: ['revoke-affected-sessions', 'notify-trusted-sessions', 'audit-transition'],
    });
  });

  it('D-05 recovery hold allows ordinary access and blocks every critical action', () => {
    expect(
      authorizeSensitiveAction({
        action: 'ordinary-access',
        now: REVIEWED_AT,
        recoveryHoldUntil: HOLD_UNTIL,
      }),
    ).toEqual({ allowed: true });

    const criticalActions: readonly SensitiveAction[] = [
      'security-method-change',
      'device-transfer',
      'refund',
      'protected-data-access',
    ];
    for (const action of criticalActions) {
      expect(
        authorizeSensitiveAction({
          action,
          now: REVIEWED_AT,
          recoveryHoldUntil: HOLD_UNTIL,
          stepUp: {
            action,
            factor: 'passkey',
            verifiedAt: REVIEWED_AT,
            expiresAt: HOLD_UNTIL,
          },
        }),
      ).toEqual({ allowed: false, code: 'RECOVERY_HOLD_ACTIVE' });
    }

    const afterHold = '2030-03-03T10:00:00.000Z';
    expect(
      authorizeSensitiveAction({
        action: 'refund',
        now: afterHold,
        recoveryHoldUntil: HOLD_UNTIL,
        stepUp: {
          action: 'refund',
          factor: 'totp',
          verifiedAt: afterHold,
          expiresAt: '2030-03-03T10:05:00.000Z',
        },
      }),
    ).toEqual({ allowed: true });
    expect(
      authorizeSensitiveAction({
        action: 'refund',
        now: afterHold,
        stepUp: {
          action: 'device-transfer',
          factor: 'passkey',
          verifiedAt: afterHold,
          expiresAt: '2030-03-03T10:05:00.000Z',
        },
      }),
    ).toEqual({ allowed: false, code: 'STEP_UP_WRONG_ACTION' });
    expect(
      authorizeSensitiveAction({
        action: 'refund',
        now: afterHold,
        stepUp: {
          action: 'refund',
          factor: 'email',
          verifiedAt: afterHold,
          expiresAt: '2030-03-03T10:05:00.000Z',
        },
      }),
    ).toEqual({ allowed: false, code: 'UNAPPROVED_FACTOR' });
    expect(
      authorizeSensitiveAction({
        action: 'refund',
        now: afterHold,
        stepUp: {
          action: 'refund',
          factor: 'recovery-code',
          verifiedAt: '2030-03-03T09:00:00.000Z',
          expiresAt: '2030-03-03T09:05:00.000Z',
        },
      }),
    ).toEqual({ allowed: false, code: 'STEP_UP_STALE' });
  });

  it('D-06 contest extends the hold and records risk without restoring critical authority', () => {
    const approved = decideRecoveryTransition(pendingReview(), {
      kind: 'approve',
      reviewedBy: 'security-reviewer',
      now: REVIEWED_AT,
      holdUntil: HOLD_UNTIL,
    });
    if (!approved.accepted) throw new Error(approved.code);
    const extendedUntil = '2030-03-05T09:00:00.000Z';
    const contested = decideRecoveryTransition(approved.state, {
      kind: 'contest',
      now: '2030-03-02T10:00:00.000Z',
      extendUntil: extendedUntil,
    });
    expect(contested).toMatchObject({
      accepted: true,
      state: { status: 'contested', endsAt: extendedUntil, version: 4n },
      effects: ['notify-trusted-sessions', 'audit-transition'],
    });
    if (!contested.accepted || contested.state.status !== 'contested') {
      throw new Error('contest transition rejected');
    }
    expect(
      authorizeSensitiveAction({
        action: 'refund',
        now: '2030-03-03T10:00:00.000Z',
        recoveryHoldUntil: contested.state.endsAt,
      }),
    ).toEqual({ allowed: false, code: 'RECOVERY_HOLD_ACTIVE' });
  });
});
