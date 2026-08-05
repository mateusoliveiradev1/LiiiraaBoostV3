export type PremiumAuthorityState =
  | 'approaching-expiry'
  | 'clock-rollback'
  | 'contradictory'
  | 'expired'
  | 'offline-valid'
  | 'revoked'
  | 'stale'
  | 'tampered'
  | 'verified';

export type PaidActionKind =
  | 'account-access'
  | 'continue-active-game'
  | 'continue-in-flight-operation'
  | 'diagnostic-history'
  | 'diagnostics'
  | 'existing-change-review'
  | 'restoration'
  | 'security-warnings'
  | 'start-new-paid-action';

export type PaidActionDecisionCode =
  | 'allowed'
  | 'allowed-with-expiry-warning'
  | 'continued'
  | 'online-verification-required'
  | 'safety-preserved';

export type PaidActionNotice =
  'access-changed' | 'approaching-expiry' | 'contradictory' | 'expired' | 'none' | 'stale';

export interface PaidActionDecision {
  readonly allowed: boolean;
  readonly code: PaidActionDecisionCode;
  readonly interruptsActiveWork: false;
  readonly notice: PaidActionNotice;
  readonly preservesExistingChanges: true;
  readonly requiresOnlineVerification: boolean;
}

export interface PaidActionPolicyInput {
  readonly action: PaidActionKind;
  readonly authority: PremiumAuthorityState;
}

export type PaidActionNoticeLocale = 'en' | 'pt-BR';

export const decidePaidAction = (_input: PaidActionPolicyInput): PaidActionDecision => {
  throw new Error('EXPECTED_RED[04-21-01]: paid-action capability matrix is not implemented');
};

export const getPaidActionNoticeCopy = (
  _notice: PaidActionNotice,
  _locale: PaidActionNoticeLocale,
): string => {
  throw new Error('EXPECTED_RED[04-21-01]: paid-action notice mapping is not implemented');
};
