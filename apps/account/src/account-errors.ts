import {
  routeHref,
  WEB_LOCALES,
  type WebLocale,
  type WebRouteId,
} from '@liiiraa/web-core';

export type AccountFailureKind = '403' | '404' | '410' | '500';

type FailureCopy = Readonly<{
  action: string;
  affectedCapability: string;
  detail: string;
  recovery: string;
  safeWork: string;
  support: string;
  title: string;
}>;

const COPY = Object.freeze({
  'pt-BR': Object.freeze({
    '403': Object.freeze({
      action: 'Revisar visão geral',
      affectedCapability: 'Acesso à responsabilidade solicitada',
      detail:
        'Esta responsabilidade da conta foi negada porque não pertence ao escopo disponível nesta prévia determinística.',
      recovery:
        'Revise as responsabilidades disponíveis na visão geral ou abra o suporte para entender o acesso esperado.',
      safeWork: 'Nenhuma sessão, permissão ou alteração remota foi criada.',
      support: 'Abrir suporte',
      title: 'Responsabilidade da conta não permitida',
    }),
    '404': Object.freeze({
      action: 'Voltar à visão geral',
      affectedCapability: 'Localização da área da conta',
      detail:
        'O endereço não corresponde a uma responsabilidade conhecida desta prévia de conta.',
      recovery:
        'Use a visão geral para escolher uma responsabilidade conhecida ou abra o suporte.',
      safeWork: 'Nenhuma sessão ou alteração remota foi criada.',
      support: 'Abrir suporte',
      title: 'Área da conta não encontrada',
    }),
    '410': Object.freeze({
      action: 'Abrir visão geral atual',
      affectedCapability: 'Acesso a uma área histórica da conta',
      detail:
        'Esta área histórica não está mais disponível neste endereço. O contexto permanece explícito, sem substituir silenciosamente o destino.',
      recovery:
        'Abra a visão geral atual para encontrar a responsabilidade vigente ou consulte o suporte.',
      safeWork: 'Nenhum trabalho local válido foi descartado e nenhuma ação remota foi executada.',
      support: 'Abrir suporte',
      title: 'Área histórica da conta removida',
    }),
    '500': Object.freeze({
      action: 'Tentar novamente',
      affectedCapability: 'Renderização da prévia da conta',
      detail:
        'Esta área da prévia não pôde ser renderizada. A falha permanece explícita e nenhuma ação remota foi executada.',
      recovery:
        'Tente novamente. Se a falha continuar, abra o suporte com o identificador de correlação redigido.',
      safeWork:
        'Rascunhos não sensíveis permanecem neste navegador quando for seguro preservá-los.',
      support: 'Abrir suporte',
      title: 'A prévia da conta encontrou uma falha',
    }),
  }),
  en: Object.freeze({
    '403': Object.freeze({
      action: 'Review overview',
      affectedCapability: 'Access to the requested responsibility',
      detail:
        'This account responsibility was denied because it is outside the scope available in this deterministic preview.',
      recovery:
        'Review the available responsibilities in Overview or open Support to understand the expected access.',
      safeWork: 'No session, permission, or remote change was created.',
      support: 'Open support',
      title: 'Account responsibility not permitted',
    }),
    '404': Object.freeze({
      action: 'Return to overview',
      affectedCapability: 'Account area location',
      detail: 'This address does not match a known responsibility in the account preview.',
      recovery: 'Use Overview to choose a known responsibility or open Support.',
      safeWork: 'No session or remote change was created.',
      support: 'Open support',
      title: 'Account area not found',
    }),
    '410': Object.freeze({
      action: 'Open current overview',
      affectedCapability: 'Access to a historical account area',
      detail:
        'This historical account area is no longer available at this address. Its context remains explicit instead of silently replacing the destination.',
      recovery:
        'Open the current Overview to find the active responsibility or consult Support.',
      safeWork: 'No valid local work was discarded and no remote action ran.',
      support: 'Open support',
      title: 'Historical account area removed',
    }),
    '500': Object.freeze({
      action: 'Try again',
      affectedCapability: 'Account preview rendering',
      detail:
        'This preview area could not render. The failure remains explicit and no remote action ran.',
      recovery:
        'Try again. If the failure continues, open Support with the redacted correlation identifier.',
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
