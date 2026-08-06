import { describe, expect, it } from 'vitest';

import { checkoutReturnUrls, commerceJson } from './routes.js';

describe('commerce HTTP boundary', () => {
  it('builds checkout returns exclusively from the admitted account origin and locale', () => {
    expect(checkoutReturnUrls('https://account.example', 'pt-BR')).toEqual({
      cancelUrl: 'https://account.example/pt-BR/account/subscription?checkout=cancelled',
      successUrl:
        'https://account.example/pt-BR/account/subscription?checkout=success&session_id={CHECKOUT_SESSION_ID}',
    });
    expect(() => checkoutReturnUrls('http://account.example', 'en')).toThrow(
      'INVALID_ACCOUNT_ORIGIN',
    );
  });

  it('serializes authoritative bigint versions without losing their exact value', () => {
    expect(commerceJson({ nested: { version: 9_007_199_254_740_993n } })).toEqual({
      nested: { version: '9007199254740993' },
    });
  });
});
