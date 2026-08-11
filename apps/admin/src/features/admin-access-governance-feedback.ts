import type { WebLocale } from '@liiiraa/web-core';

import type { AdminMutationResult } from '../admin-authority';

export type MutationFeedback = Readonly<{
  detail: string;
  state: 'degraded';
  title: string;
}>;

export const mutationFeedback = (
  mutation: AdminMutationResult | null | undefined,
  locale: WebLocale,
): MutationFeedback | null => {
  if (
    mutation === null ||
    mutation === undefined ||
    mutation.status === 'complete' ||
    mutation.status === 'partial' ||
    mutation.status === 'conflict'
  ) {
    return null;
  }

  return locale === 'pt-BR'
    ? Object.freeze({
        detail: 'Revise a sessão e tente novamente. Nenhuma alteração foi aplicada.',
        state: 'degraded' as const,
        title: 'A operação não foi aplicada',
      })
    : Object.freeze({
        detail: 'Review the session and try again. No change was applied.',
        state: 'degraded' as const,
        title: 'The operation was not applied',
      });
};
