export const RECOVERY_MINIMUM_HOLD_MS = 24 * 60 * 60 * 1_000;

export const APPROVED_SECURITY_FACTORS = Object.freeze([
  'totp',
  'passkey',
  'recovery-code',
] as const);

export type SecurityFactor = (typeof APPROVED_SECURITY_FACTORS)[number];
export type RecoveryEvidence = 'verified-email' | 'recovery-code' | 'all-factors-lost';
export type RecoveryRoute = 'verified-email' | 'recovery-code' | 'security-review';
export type SensitiveAction =
  | 'ordinary-access'
  | 'security-method-change'
  | 'device-transfer'
  | 'refund'
  | 'protected-data-access';

export interface StepUpEvidence {
  readonly factor: string;
  readonly action: SensitiveAction;
  readonly verifiedAt: string;
  readonly expiresAt: string;
}

export type RecoveryState =
  | Readonly<{ status: 'idle'; version: bigint }>
  | Readonly<{
      status: 'ready';
      route: Exclude<RecoveryRoute, 'security-review'>;
      requestedAt: string;
      version: bigint;
    }>
  | Readonly<{
      status: 'pending-review';
      route: 'security-review';
      requestedAt: string;
      version: bigint;
    }>
  | Readonly<{
      status: 'active-hold' | 'contested';
      route: 'security-review';
      requestedAt: string;
      startsAt: string;
      endsAt: string;
      contestedAt?: string;
      version: bigint;
    }>;

export type RecoveryCommand =
  | Readonly<{ kind: 'request'; evidence: RecoveryEvidence; now: string }>
  | Readonly<{ kind: 'approve'; reviewedBy: string; now: string; holdUntil: string }>
  | Readonly<{ kind: 'contest'; now: string; extendUntil: string }>
  | Readonly<{ kind: 'extend-risk'; now: string; extendUntil: string }>;

export type RecoveryEffect =
  'audit-transition' | 'notify-trusted-sessions' | 'revoke-affected-sessions';

export type RecoveryTransition =
  | Readonly<{
      accepted: true;
      state: RecoveryState;
      effects: readonly RecoveryEffect[];
    }>
  | Readonly<{
      accepted: false;
      code: 'INVALID_TRANSITION' | 'HOLD_TOO_SHORT' | 'RISK_EXTENSION_REQUIRED';
    }>;

export type SensitiveActionAuthorization =
  | Readonly<{ allowed: true }>
  | Readonly<{
      allowed: false;
      code:
        | 'RECOVERY_HOLD_ACTIVE'
        | 'STEP_UP_REQUIRED'
        | 'STEP_UP_STALE'
        | 'STEP_UP_WRONG_ACTION'
        | 'UNAPPROVED_FACTOR';
    }>;

export const decideRecoveryTransition = (
  state: RecoveryState,
  command: RecoveryCommand,
): RecoveryTransition => {
  if (command.kind === 'request') {
    if (state.status !== 'idle') return { accepted: false, code: 'INVALID_TRANSITION' };
    if (command.evidence === 'all-factors-lost') {
      return {
        accepted: true,
        state: {
          status: 'pending-review',
          route: 'security-review',
          requestedAt: command.now,
          version: state.version + 1n,
        },
        effects: ['audit-transition'],
      };
    }
    return {
      accepted: true,
      state: {
        status: 'ready',
        route: command.evidence,
        requestedAt: command.now,
        version: state.version + 1n,
      },
      effects: ['audit-transition'],
    };
  }

  if (command.kind === 'approve') {
    if (state.status !== 'pending-review' || command.reviewedBy.length === 0) {
      return { accepted: false, code: 'INVALID_TRANSITION' };
    }
    if (Date.parse(command.holdUntil) - Date.parse(command.now) < RECOVERY_MINIMUM_HOLD_MS) {
      return { accepted: false, code: 'HOLD_TOO_SHORT' };
    }
    return {
      accepted: true,
      state: {
        status: 'active-hold',
        route: 'security-review',
        requestedAt: state.requestedAt,
        startsAt: command.now,
        endsAt: command.holdUntil,
        version: state.version + 1n,
      },
      effects: ['revoke-affected-sessions', 'notify-trusted-sessions', 'audit-transition'],
    };
  }

  if (state.status !== 'active-hold' && state.status !== 'contested') {
    return { accepted: false, code: 'INVALID_TRANSITION' };
  }
  if (
    Date.parse(command.extendUntil) <= Date.parse(state.endsAt) ||
    Date.parse(command.extendUntil) <= Date.parse(command.now)
  ) {
    return { accepted: false, code: 'RISK_EXTENSION_REQUIRED' };
  }
  if (command.kind === 'contest') {
    return {
      accepted: true,
      state: {
        ...state,
        status: 'contested',
        contestedAt: command.now,
        endsAt: command.extendUntil,
        version: state.version + 1n,
      },
      effects: ['notify-trusted-sessions', 'audit-transition'],
    };
  }
  return {
    accepted: true,
    state: {
      ...state,
      endsAt: command.extendUntil,
      version: state.version + 1n,
    },
    effects: ['notify-trusted-sessions', 'audit-transition'],
  };
};

export const authorizeSensitiveAction = (input: {
  readonly action: SensitiveAction;
  readonly now: string;
  readonly recoveryHoldUntil?: string;
  readonly stepUp?: StepUpEvidence;
}): SensitiveActionAuthorization => {
  if (input.action === 'ordinary-access') return { allowed: true };
  const now = Date.parse(input.now);
  if (input.recoveryHoldUntil && Date.parse(input.recoveryHoldUntil) > now) {
    return { allowed: false, code: 'RECOVERY_HOLD_ACTIVE' };
  }
  if (!input.stepUp) return { allowed: false, code: 'STEP_UP_REQUIRED' };
  if (!APPROVED_SECURITY_FACTORS.some((factor) => factor === input.stepUp?.factor)) {
    return { allowed: false, code: 'UNAPPROVED_FACTOR' };
  }
  if (input.stepUp.action !== input.action) {
    return { allowed: false, code: 'STEP_UP_WRONG_ACTION' };
  }
  const verifiedAt = Date.parse(input.stepUp.verifiedAt);
  const expiresAt = Date.parse(input.stepUp.expiresAt);
  if (
    !Number.isFinite(verifiedAt) ||
    !Number.isFinite(expiresAt) ||
    verifiedAt > now ||
    expiresAt <= now
  ) {
    return { allowed: false, code: 'STEP_UP_STALE' };
  }
  return { allowed: true };
};
