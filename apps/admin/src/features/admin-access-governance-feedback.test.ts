import { describe, expect, it } from 'vitest';

import { mutationFeedback } from './admin-access-governance-feedback';

describe('Admin access governance mutation feedback', () => {
  it('explains a rejected mutation instead of failing silently', () => {
    expect(mutationFeedback({ code: 'invalid-authority', status: 'error' }, 'pt-BR')).toEqual({
      detail: 'Revise a sessão e tente novamente. Nenhuma alteração foi aplicada.',
      state: 'degraded',
      title: 'A operação não foi aplicada',
    });
  });

  it('does not duplicate conflict feedback or render without a mutation', () => {
    expect(mutationFeedback({ code: 'conflict', status: 'conflict' }, 'en')).toBeNull();
    expect(mutationFeedback(undefined, 'en')).toBeNull();
  });
});
