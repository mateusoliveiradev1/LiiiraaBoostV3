import { describe, expect, it } from 'vitest';

import {
  decidePaidAction,
  getPaidActionNoticeCopy,
  type PaidActionKind,
  type PremiumAuthorityState,
} from './paid-action-policy.js';

const START_AUTHORITY_MATRIX = [
  ['verified', true, 'allowed', 'none', false],
  ['offline-valid', true, 'allowed', 'none', false],
  ['approaching-expiry', true, 'allowed-with-expiry-warning', 'approaching-expiry', false],
  ['stale', false, 'online-verification-required', 'stale', true],
  ['expired', false, 'online-verification-required', 'expired', true],
  ['revoked', false, 'online-verification-required', 'access-changed', true],
  ['tampered', false, 'online-verification-required', 'contradictory', true],
  ['clock-rollback', false, 'online-verification-required', 'contradictory', true],
  ['contradictory', false, 'online-verification-required', 'contradictory', true],
] as const satisfies ReadonlyArray<
  readonly [PremiumAuthorityState, boolean, string, string, boolean]
>;

const NON_START_AUTHORITY_STATES = START_AUTHORITY_MATRIX.map(([authority]) => authority);

const CONTINUATION_ACTIONS = [
  'continue-active-game',
  'continue-in-flight-operation',
] as const satisfies readonly PaidActionKind[];

const SAFETY_ACTIONS = [
  'account-access',
  'diagnostic-history',
  'diagnostics',
  'existing-change-review',
  'restoration',
  'security-warnings',
] as const satisfies readonly PaidActionKind[];

describe('paid action capability policy', () => {
  it.each(START_AUTHORITY_MATRIX)(
    'maps %s authority at the next new paid action boundary',
    (authority, allowed, code, notice, requiresOnlineVerification) => {
      expect(decidePaidAction({ action: 'start-new-paid-action', authority })).toEqual({
        allowed,
        code,
        interruptsActiveWork: false,
        notice,
        preservesExistingChanges: true,
        requiresOnlineVerification,
      });
    },
  );

  it.each(NON_START_AUTHORITY_STATES)(
    'never interrupts active games or in-flight operations for %s authority',
    (authority) => {
      for (const action of CONTINUATION_ACTIONS) {
        expect(decidePaidAction({ action, authority })).toEqual({
          allowed: true,
          code: 'continued',
          interruptsActiveWork: false,
          notice: 'none',
          preservesExistingChanges: true,
          requiresOnlineVerification: false,
        });
      }
    },
  );

  it.each(NON_START_AUTHORITY_STATES)(
    'preserves safety, evidence, restoration and account access for %s authority',
    (authority) => {
      for (const action of SAFETY_ACTIONS) {
        expect(decidePaidAction({ action, authority })).toEqual({
          allowed: true,
          code: 'safety-preserved',
          interruptsActiveWork: false,
          notice: 'none',
          preservesExistingChanges: true,
          requiresOnlineVerification: false,
        });
      }
    },
  );

  it('uses distinct non-accusatory copy for approaching, stale, expired and contradictory states', () => {
    const notices = ['approaching-expiry', 'stale', 'expired', 'contradictory'] as const;

    for (const locale of ['en', 'pt-BR'] as const) {
      const messages = notices.map((notice) => getPaidActionNoticeCopy(notice, locale));
      expect(new Set(messages).size).toBe(notices.length);
      expect(messages.join(' ').toLowerCase()).not.toMatch(/fraud|fraude|culpa|tamper/iu);
    }
  });
});
