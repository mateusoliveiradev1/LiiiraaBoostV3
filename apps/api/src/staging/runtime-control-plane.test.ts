import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { REAL_STAGING_CAPABILITIES } from './runtime.js';

describe('real staging control-plane composition', () => {
  it('advertises only the real persistent authorities registered by the runtime', () => {
    expect(REAL_STAGING_CAPABILITIES).toEqual([
      'invitation-signup',
      'password-session',
      'totp-strong-auth',
      'desktop-pkce',
      'account',
      'commerce-stripe-test',
      'billing-portal',
      'device-authority',
      'support-consent-authority',
      'admin-read-authority',
      'admin-invitation-authority',
      'admin-governance-authority',
      'admin-operations-authority',
      'admin-worker-authority',
    ]);
  });

  it('uses the canonical account subscription route for Stripe portal returns', () => {
    const source = readFileSync(new URL('./runtime.ts', import.meta.url), 'utf8');
    expect(source).toContain('accountSubscriptionUrl');
    expect(source).not.toContain('`${environment.accountOrigin}/${locale}/plan`');
  });

  it('keeps published governance free from browser-evidence identities and streams freshness to every admin function', () => {
    const source = readFileSync(new URL('./runtime.ts', import.meta.url), 'utf8');

    expect(source).toContain("identity.email NOT LIKE 'admin-e2e-%@example.test'");
    expect(source).toContain(
      "session.activeFunction === 'operations' ? OPERATIONS_CAPABILITIES : ([] as const)",
    );
  });

  it('admits private-beta invitation authority to both governed owner functions', () => {
    const source = readFileSync(new URL('./runtime.ts', import.meta.url), 'utf8');

    expect(source).toContain("['operations', 'security'].includes(session.activeFunction)");
  });
});
