import {
  routeHref,
  WEB_LOCALES,
  type WebLocale,
  type WebRouteId,
} from '@liiiraa/web-core';

type AccountFailureKind = '404' | '500';

type FailureCopy = Readonly<{
  action: string;
  detail: string;
  safeWork: string;
  support: string;
  title: string;
}>;

const COPY = Object.freeze({
  'pt-BR': Object.freeze({
    '404': Object.freeze({
      action: 'Voltar à visão geral',
      detail:
        'O endereço não corresponde a uma responsabilidade conhecida desta prévia de conta.',
      safeWork: 'Nenhuma sessão ou alteração remota foi criada.',
      support: 'Abrir suporte',
      title: 'Área da conta não encontrada',
    }),
    '500': Object.freeze({
      action: 'Tentar novamente',
      detail:
        'Esta área da prévia não pôde ser renderizada. A falha permanece explícita e nenhuma ação remota foi executada.',
      safeWork:
        'Rascunhos não sensíveis permanecem neste navegador quando for seguro preservá-los.',
      support: 'Abrir suporte',
      title: 'A prévia da conta encontrou uma falha',
    }),
  }),
  en: Object.freeze({
    '404': Object.freeze({
      action: 'Return to overview',
      detail: 'This address does not match a known responsibility in the account preview.',
      safeWork: 'No session or remote change was created.',
      support: 'Open support',
      title: 'Account area not found',
    }),
    '500': Object.freeze({
      action: 'Try again',
      detail:
        'This preview area could not render. The failure remains explicit and no remote action ran.',
      safeWork: 'Non-sensitive drafts remain in this browser when they are safe to preserve.',
      support: 'Open support',
      title: 'The account preview encountered a failure',
    }),
  }),
} satisfies Record<WebLocale, Record<AccountFailureKind, FailureCopy>>);

const localizedHref = (routeId: WebRouteId, locale: WebLocale): string => {
  const result = routeHref(routeId, { locale });
  if (!result.ok) {
    throw new Error(`Canonical account recovery route is unavailable: ${routeId}`);
  }
  return result.value;
};

export const accountFailureLocale = (requestedLocale: unknown): WebLocale =>
  typeof requestedLocale === 'string' && WEB_LOCALES.includes(requestedLocale as WebLocale)
    ? (requestedLocale as WebLocale)
    : 'pt-BR';

export const redactedAccountCorrelationId = (
  kind: AccountFailureKind,
  digest?: string,
): string => {
  const safeDigest =
    digest !== undefined && /^[A-Za-z0-9_-]{8,32}$/u.test(digest) ? digest : 'REDACTED';
  return `LB-A${kind}-${safeDigest}`;
};

export const createAccountFailureModel = (
  kind: AccountFailureKind,
  locale: WebLocale,
  digest?: string,
) =>
  Object.freeze({
    code: kind,
    copy: COPY[locale][kind],
    correlationId: redactedAccountCorrelationId(kind, digest),
    destinations: Object.freeze({
      overview: localizedHref('account-overview', locale),
      support: localizedHref('account-support', locale),
    }),
    locale,
    routeId: `account-error-${kind}` as const,
  });
