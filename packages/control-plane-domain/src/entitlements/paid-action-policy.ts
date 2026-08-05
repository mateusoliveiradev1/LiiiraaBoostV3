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

const CONTINUATION_ACTIONS: ReadonlySet<PaidActionKind> = new Set([
  'continue-active-game',
  'continue-in-flight-operation',
]);

const SAFETY_ACTIONS: ReadonlySet<PaidActionKind> = new Set([
  'account-access',
  'diagnostic-history',
  'diagnostics',
  'existing-change-review',
  'restoration',
  'security-warnings',
]);

const DENIED_START_NOTICE: Readonly<
  Record<
    Exclude<PremiumAuthorityState, 'approaching-expiry' | 'offline-valid' | 'verified'>,
    PaidActionNotice
  >
> = Object.freeze({
  'clock-rollback': 'contradictory',
  contradictory: 'contradictory',
  expired: 'expired',
  revoked: 'access-changed',
  stale: 'stale',
  tampered: 'contradictory',
});

const decision = (
  allowed: boolean,
  code: PaidActionDecisionCode,
  notice: PaidActionNotice,
  requiresOnlineVerification: boolean,
): PaidActionDecision =>
  Object.freeze({
    allowed,
    code,
    interruptsActiveWork: false,
    notice,
    preservesExistingChanges: true,
    requiresOnlineVerification,
  });

export const decidePaidAction = (input: PaidActionPolicyInput): PaidActionDecision => {
  if (CONTINUATION_ACTIONS.has(input.action)) {
    return decision(true, 'continued', 'none', false);
  }
  if (SAFETY_ACTIONS.has(input.action)) {
    return decision(true, 'safety-preserved', 'none', false);
  }
  if (input.authority === 'approaching-expiry') {
    return decision(true, 'allowed-with-expiry-warning', 'approaching-expiry', false);
  }
  if (input.authority === 'offline-valid' || input.authority === 'verified') {
    return decision(true, 'allowed', 'none', false);
  }
  return decision(
    false,
    'online-verification-required',
    DENIED_START_NOTICE[input.authority],
    true,
  );
};

const NOTICE_COPY: Readonly<
  Record<PaidActionNoticeLocale, Readonly<Record<PaidActionNotice, string>>>
> = Object.freeze({
  en: Object.freeze({
    'access-changed':
      'Premium access changed after the latest contact. Verify online before starting new Premium work.',
    'approaching-expiry':
      'Offline Premium authorization is approaching expiry. Connect soon to renew it silently.',
    contradictory:
      'Local authorization evidence disagrees. Verify online before starting new Premium work; safety and restoration remain available.',
    expired:
      'Offline Premium authorization expired. A new Premium action requires online verification; active work and restoration continue.',
    none: '',
    stale:
      'Premium authority is stale or unavailable. Verify online before starting new Premium work.',
  }),
  'pt-BR': Object.freeze({
    'access-changed':
      'O acesso Premium mudou após o último contato. Verifique online antes de iniciar um novo trabalho Premium.',
    'approaching-expiry':
      'A autorização Premium offline está perto de expirar. Conecte-se em breve para renová-la silenciosamente.',
    contradictory:
      'As evidências locais de autorização divergem. Verifique online antes de iniciar um novo trabalho Premium; segurança e restauração continuam disponíveis.',
    expired:
      'A autorização Premium offline expirou. Nova ação Premium exige verificação online; trabalho ativo e restauração continuam.',
    none: '',
    stale:
      'A autoridade Premium está desatualizada ou indisponível. Verifique online antes de iniciar um novo trabalho Premium.',
  }),
});

export const getPaidActionNoticeCopy = (
  notice: PaidActionNotice,
  locale: PaidActionNoticeLocale,
): string => NOTICE_COPY[locale][notice];
