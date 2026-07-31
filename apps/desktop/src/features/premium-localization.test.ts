import { describe, expect, it } from 'vitest';

import { translatePremiumText } from './premium-localization.js';

describe('premium desktop localization', () => {
  it('translates dynamic Home profile values in the English capture', () => {
    expect(translatePremiumText('Aguardando medição')).toBe('Awaiting measurement');
    expect(translatePremiumText('Competitivo')).toBe('Competitive');
  });
});
