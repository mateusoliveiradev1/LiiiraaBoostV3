import { routeHref, WEB_LOCALES, type WebLocale, type WebRouteId } from '@liiiraa/web-core';

export type AdminFailureKind = '403' | '404' | '410' | '500';

type AdminFailureCopy = Readonly<{
  action: string;
  affected: string;
  detail: string;
  safeState: string;
  title: string;
}>;

const COPY = Object.freeze({
  'pt-BR': Object.freeze({
    '403': Object.freeze({
      action: 'Voltar à área da função',
      affected: 'A função demonstrativa atual não inclui esta responsabilidade.',
      detail: 'O acesso foi bloqueado antes de qualquer dado ou autoridade administrativa.',
      safeState:
        'Nenhuma credencial foi aceita, nenhuma sessão foi criada e nenhum evento remoto foi alterado.',
      title: 'Acesso administrativo não permitido',
    }),
    '404': Object.freeze({
      action: 'Voltar à área da função',
      affected: 'O endereço não corresponde a uma área conhecida da prévia administrativa.',
      detail: 'A falha permanece visível; não redirecionamos para ocultar o endereço inválido.',
      safeState: 'Nenhum identificador de cliente ou detalhe operacional foi exposto.',
      title: 'Área administrativa não encontrada',
    }),
    '410': Object.freeze({
      action: 'Voltar à área da função',
      affected: 'Esta referência pertence ao histórico e não aceita mais operações.',
      detail:
        'O contexto histórico permanece preservado sem restaurar uma responsabilidade encerrada.',
      safeState:
        'Nenhuma autoridade foi conectada, nenhum dado operacional foi exposto e nenhuma ação remota foi executada.',
      title: 'A referência administrativa não está mais disponível',
    }),
    '500': Object.freeze({
      action: 'Tentar novamente',
      affected: 'A área administrativa de prévia não pôde ser renderizada.',
      detail:
        'A parte afetada está indisponível. A navegação segura da função permanece disponível.',
      safeState: 'Nenhuma ação remota foi executada e os detalhes técnicos permanecem redigidos.',
      title: 'A prévia administrativa encontrou uma falha',
    }),
  }),
  en: Object.freeze({
    '403': Object.freeze({
      action: 'Return to role workspace',
      affected: 'The current demonstrative role does not include this responsibility.',
      detail: 'Access was blocked before any administrative data or authority was reached.',
      safeState: 'No credential was accepted, no session was created, and no remote event changed.',
      title: 'Administrative access is not permitted',
    }),
    '404': Object.freeze({
      action: 'Return to role workspace',
      affected: 'This address does not match a known area in the administrative preview.',
      detail: 'The failure remains visible; we do not redirect to hide the invalid address.',
      safeState: 'No customer identifier or operational detail was exposed.',
      title: 'Administrative area not found',
    }),
    '410': Object.freeze({
      action: 'Return to role workspace',
      affected: 'This reference is historical and no longer accepts operations.',
      detail: 'The historical context remains preserved without restoring an ended responsibility.',
      safeState:
        'No authority was connected, no operational data was exposed, and no remote action ran.',
      title: 'The administrative reference is no longer available',
    }),
    '500': Object.freeze({
      action: 'Try again',
      affected: 'The administrative preview area could not render.',
      detail: 'The affected part is unavailable. Safe role navigation remains available.',
      safeState: 'No remote action ran and technical details remain redacted.',
      title: 'The administrative preview encountered a failure',
    }),
  }),
} satisfies Readonly<Record<WebLocale, Readonly<Record<AdminFailureKind, AdminFailureCopy>>>>);

const localizedHref = (routeId: WebRouteId, locale: WebLocale): string => {
  const result = routeHref(routeId, { locale });

  if (!result.ok) {
    throw new Error(`Admin failure destination unavailable: ${routeId}`);
  }

  return result.value;
};

export const adminFailureLocale = (requestedLocale?: string): WebLocale =>
  WEB_LOCALES.includes(requestedLocale as WebLocale) ? (requestedLocale as WebLocale) : 'pt-BR';

export const redactedAdminCorrelationId = (kind: AdminFailureKind, digest?: string): string => {
  const safeDigest =
    digest !== undefined && /^[A-Za-z0-9_-]{8,32}$/u.test(digest) ? digest : 'REDACTED';

  return `LB-ADM-${kind}-${safeDigest}`;
};

export const createAdminFailureModel = (
  kind: AdminFailureKind,
  locale: WebLocale,
  digest?: string,
) =>
  Object.freeze({
    copy: COPY[locale][kind],
    correlationId: redactedAdminCorrelationId(kind, digest),
    destinations: Object.freeze({
      role: localizedHref('admin-role', locale),
    }),
    kind,
    locale,
  });
