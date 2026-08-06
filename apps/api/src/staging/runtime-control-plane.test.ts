import { describe, expect, it } from 'vitest';

import { REAL_STAGING_CAPABILITIES } from './runtime.js';

describe('real staging control-plane composition', () => {
  it('advertises only the real persistent authorities registered by the runtime', () => {
    expect(REAL_STAGING_CAPABILITIES).toEqual([
      'invitation-signup',
      'password-session',
      'desktop-pkce',
      'account',
      'commerce-stripe-test',
      'billing-portal',
      'device-authority',
      'support-consent-authority',
      'admin-read-authority',
    ]);
  });
});
