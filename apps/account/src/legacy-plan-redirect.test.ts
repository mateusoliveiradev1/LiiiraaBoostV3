import { describe, expect, it } from 'vitest';

import nextConfig from '../next.config';

describe('legacy Stripe account returns', () => {
  it('preserves old /plan sessions by redirecting to the canonical subscription route', async () => {
    const redirects = await nextConfig.redirects?.();
    expect(redirects).toContainEqual({
      destination: '/:locale/account/subscription',
      permanent: true,
      source: '/:locale(pt-BR|en)/plan',
    });
  });
});
