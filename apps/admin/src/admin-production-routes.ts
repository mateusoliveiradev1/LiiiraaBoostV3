import type { WebLocale, WebRouteId } from '@liiiraa/web-core';

import type { AdminFailureKind } from './admin-errors';
import { ADMIN_AUTHORITY_ROUTE_IDS, type AdminAuthorityRoute } from './admin-runtime';

export const ADMIN_ERROR_ROUTE_IDS = Object.freeze([
  'admin-error-404',
  'admin-error-403',
  'admin-error-410',
  'admin-error-500',
] as const satisfies readonly WebRouteId[]);

export type AdminErrorRoute = (typeof ADMIN_ERROR_ROUTE_IDS)[number];

const ADMIN_FAILURE_KIND_BY_ROUTE = Object.freeze({
  'admin-error-403': '403',
  'admin-error-404': '404',
  'admin-error-410': '410',
  'admin-error-500': '500',
} as const satisfies Readonly<Record<AdminErrorRoute, AdminFailureKind>>);

export const isAdminAuthorityRoute = (routeId: WebRouteId): routeId is AdminAuthorityRoute =>
  ADMIN_AUTHORITY_ROUTE_IDS.includes(routeId as AdminAuthorityRoute);

export const isAdminErrorRoute = (routeId: WebRouteId): routeId is AdminErrorRoute =>
  ADMIN_ERROR_ROUTE_IDS.includes(routeId as AdminErrorRoute);

export const adminFailureKindForRoute = (routeId: WebRouteId): AdminFailureKind | undefined =>
  isAdminErrorRoute(routeId) ? ADMIN_FAILURE_KIND_BY_ROUTE[routeId] : undefined;

const ADMIN_ROUTE_METADATA = Object.freeze({
  en: Object.freeze({
    'admin-role': {
      title: 'Admin access',
      summary: 'Verify your protected administrative session.',
    },
    'admin-support': {
      title: 'Support',
      summary: 'Work only with server-authorized support records.',
    },
    'admin-operations': { title: 'Operations', summary: 'Review bounded operational authority.' },
    'admin-security': { title: 'Security', summary: 'Review protected security operations.' },
    'admin-diagnostics': {
      title: 'Diagnostics',
      summary: 'Inspect consented diagnostic metadata.',
    },
    'admin-audit': { title: 'Audit', summary: 'Review immutable administrative events.' },
    'admin-audit-event': { title: 'Audit event', summary: 'Inspect one authorized audit event.' },
  }),
  'pt-BR': Object.freeze({
    'admin-role': {
      title: 'Acesso Admin',
      summary: 'Verifique sua sessão administrativa protegida.',
    },
    'admin-support': {
      title: 'Suporte',
      summary: 'Atue apenas em registros de suporte autorizados.',
    },
    'admin-operations': {
      title: 'Operações',
      summary: 'Revise a autoridade operacional limitada.',
    },
    'admin-security': { title: 'Segurança', summary: 'Revise operações protegidas de segurança.' },
    'admin-diagnostics': {
      title: 'Diagnósticos',
      summary: 'Consulte metadados de diagnóstico consentidos.',
    },
    'admin-audit': { title: 'Auditoria', summary: 'Revise eventos administrativos imutáveis.' },
    'admin-audit-event': {
      title: 'Evento de auditoria',
      summary: 'Consulte um evento de auditoria autorizado.',
    },
  }),
} as const satisfies Readonly<
  Record<
    WebLocale,
    Readonly<Record<AdminAuthorityRoute, Readonly<{ summary: string; title: string }>>>
  >
>);

export const getAdminRouteMetadata = (locale: WebLocale, routeId: AdminAuthorityRoute) =>
  ADMIN_ROUTE_METADATA[locale][routeId];

export type AdminAuthorityPresentation = Readonly<{
  description: string;
  emptyDescription: string;
  emptyTitle: string;
  eyebrow: string;
  title: string;
}>;

const ADMIN_AUTHORITY_PRESENTATION = Object.freeze({
  en: Object.freeze({
    'admin-role': Object.freeze({
      description:
        'Start with admitted work and verified operational context for this protected session.',
      emptyDescription:
        'No assigned work is waiting. Authorized context remains available in the navigation.',
      emptyTitle: 'No assigned work',
      eyebrow: 'Administrative command center',
      title: 'Role briefing',
    }),
    'admin-support': Object.freeze({
      description:
        'Review only support cases admitted to the active function and current environment.',
      emptyDescription:
        'No authorized support case is waiting. New admitted cases will appear in this queue.',
      emptyTitle: 'Support queue is clear',
      eyebrow: 'Protected support',
      title: 'Support queue',
    }),
    'admin-operations': Object.freeze({
      description: 'Inspect bounded operational authority before reviewing any protected command.',
      emptyDescription:
        'No operational review is waiting. Critical commands remain unavailable without exact authority.',
      emptyTitle: 'No operational review pending',
      eyebrow: 'Controlled operations',
      title: 'Operational review',
    }),
    'admin-security': Object.freeze({
      description:
        'Prioritize contained incidents and allowlisted emergency evidence for this session.',
      emptyDescription:
        'No authorized security incident is waiting. Emergency access remains strongly verified and audited.',
      emptyTitle: 'Security queue is clear',
      eyebrow: 'Security and containment',
      title: 'Security review',
    }),
    'admin-diagnostics': Object.freeze({
      description: 'Inspect only metadata covered by active, purpose-bound diagnostic consent.',
      emptyDescription:
        'No active diagnostic consent is available. No diagnostic field was loaded or retained.',
      emptyTitle: 'No consented diagnostic',
      eyebrow: 'Active consent',
      title: 'Consented diagnostics',
    }),
    'admin-audit': Object.freeze({
      description: 'Review immutable administrative events admitted to the active audit scope.',
      emptyDescription:
        'No audit event matches the authorized scope. No hidden event identity is disclosed.',
      emptyTitle: 'No admitted audit event',
      eyebrow: 'Immutable record',
      title: 'Administrative audit',
    }),
    'admin-audit-event': Object.freeze({
      description:
        'Inspect one immutable event without widening its authorized redacted projection.',
      emptyDescription:
        'This event is not available to the active scope. No protected detail was loaded.',
      emptyTitle: 'Event unavailable',
      eyebrow: 'Authorized event',
      title: 'Audit event detail',
    }),
  }),
  'pt-BR': Object.freeze({
    'admin-role': Object.freeze({
      description:
        'Comece pelo trabalho admitido e pelo contexto operacional verificado desta sessão protegida.',
      emptyDescription:
        'Nenhum trabalho atribuído está aguardando. O contexto autorizado continua disponível na navegação.',
      emptyTitle: 'Nenhum trabalho atribuído',
      eyebrow: 'Central administrativa',
      title: 'Visão da função',
    }),
    'admin-support': Object.freeze({
      description: 'Revise somente casos admitidos para a função ativa e para o ambiente atual.',
      emptyDescription:
        'Nenhum caso de suporte autorizado está aguardando. Novos casos admitidos aparecerão nesta fila.',
      emptyTitle: 'Fila de atendimento em dia',
      eyebrow: 'Atendimento protegido',
      title: 'Fila de atendimento',
    }),
    'admin-operations': Object.freeze({
      description:
        'Consulte a autoridade operacional limitada antes de revisar qualquer comando protegido.',
      emptyDescription:
        'Nenhuma revisão operacional está aguardando. Comandos críticos continuam bloqueados sem autoridade exata.',
      emptyTitle: 'Nenhuma revisão operacional pendente',
      eyebrow: 'Operação controlada',
      title: 'Revisão operacional',
    }),
    'admin-security': Object.freeze({
      description:
        'Priorize incidentes contidos e evidências emergenciais permitidas para esta sessão.',
      emptyDescription:
        'Nenhum incidente autorizado está aguardando. O acesso emergencial continua fortemente verificado e auditado.',
      emptyTitle: 'Fila de segurança em dia',
      eyebrow: 'Segurança e contenção',
      title: 'Revisão de segurança',
    }),
    'admin-diagnostics': Object.freeze({
      description:
        'Consulte somente metadados cobertos por consentimento de diagnóstico ativo e vinculado ao propósito.',
      emptyDescription:
        'Nenhum consentimento de diagnóstico está ativo. Nenhum campo de diagnóstico foi carregado ou retido.',
      emptyTitle: 'Nenhum diagnóstico consentido',
      eyebrow: 'Consentimento ativo',
      title: 'Diagnóstico consentido',
    }),
    'admin-audit': Object.freeze({
      description:
        'Revise eventos administrativos imutáveis admitidos para o escopo ativo de auditoria.',
      emptyDescription:
        'Nenhum evento corresponde ao escopo autorizado. Nenhuma identidade oculta foi revelada.',
      emptyTitle: 'Nenhum evento de auditoria admitido',
      eyebrow: 'Registro imutável',
      title: 'Auditoria administrativa',
    }),
    'admin-audit-event': Object.freeze({
      description: 'Consulte um evento imutável sem ampliar sua projeção autorizada e redigida.',
      emptyDescription:
        'Este evento não está disponível para o escopo ativo. Nenhum detalhe protegido foi carregado.',
      emptyTitle: 'Evento indisponível',
      eyebrow: 'Evento autorizado',
      title: 'Detalhe do evento',
    }),
  }),
} as const satisfies Readonly<
  Record<WebLocale, Readonly<Record<AdminAuthorityRoute, AdminAuthorityPresentation>>>
>);

export const resolveAdminAuthorityPresentation = (
  locale: WebLocale,
  routeId: AdminAuthorityRoute,
): AdminAuthorityPresentation => ADMIN_AUTHORITY_PRESENTATION[locale][routeId];

export type AdminVisibleStatus =
  'live' | 'stale' | 'reconnecting' | 'offline' | 'degraded' | 'unavailable';

const ADMIN_STATUS_LABEL = Object.freeze({
  en: Object.freeze({
    degraded: 'Partially available',
    live: 'Live',
    offline: 'Offline',
    reconnecting: 'Refreshing',
    stale: 'Stale',
    unavailable: 'Unavailable',
  }),
  'pt-BR': Object.freeze({
    degraded: 'Parcialmente disponível',
    live: 'Atualizado',
    offline: 'Sem conexão',
    reconnecting: 'Atualizando',
    stale: 'Dados antigos',
    unavailable: 'Indisponível',
  }),
} as const satisfies Readonly<Record<WebLocale, Readonly<Record<AdminVisibleStatus, string>>>>);

export const adminOverviewStatusLabel = (locale: WebLocale, status: AdminVisibleStatus): string =>
  ADMIN_STATUS_LABEL[locale][status];
