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
  | 'audit-transition'
  | 'notify-trusted-sessions'
  | 'revoke-affected-sessions';

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
  _state: RecoveryState,
  _command: RecoveryCommand,
): RecoveryTransition => ({ accepted: false, code: 'INVALID_TRANSITION' });

export const authorizeSensitiveAction = (_input: {
  readonly action: SensitiveAction;
  readonly now: string;
  readonly recoveryHoldUntil?: string;
  readonly stepUp?: StepUpEvidence;
}): SensitiveActionAuthorization => ({ allowed: false, code: 'STEP_UP_REQUIRED' });
