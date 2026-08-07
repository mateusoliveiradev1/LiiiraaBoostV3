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
    'admin-role': { title: 'Admin access', summary: 'Verify your protected administrative session.' },
    'admin-support': { title: 'Support', summary: 'Work only with server-authorized support records.' },
    'admin-operations': { title: 'Operations', summary: 'Review bounded operational authority.' },
    'admin-security': { title: 'Security', summary: 'Review protected security operations.' },
    'admin-diagnostics': { title: 'Diagnostics', summary: 'Inspect consented diagnostic metadata.' },
    'admin-audit': { title: 'Audit', summary: 'Review immutable administrative events.' },
    'admin-audit-event': { title: 'Audit event', summary: 'Inspect one authorized audit event.' },
  }),
  'pt-BR': Object.freeze({
    'admin-role': { title: 'Acesso Admin', summary: 'Verifique sua sessão administrativa protegida.' },
    'admin-support': { title: 'Suporte', summary: 'Atue apenas em registros de suporte autorizados.' },
    'admin-operations': { title: 'Operações', summary: 'Revise a autoridade operacional limitada.' },
    'admin-security': { title: 'Segurança', summary: 'Revise operações protegidas de segurança.' },
    'admin-diagnostics': { title: 'Diagnósticos', summary: 'Consulte metadados de diagnóstico consentidos.' },
    'admin-audit': { title: 'Auditoria', summary: 'Revise eventos administrativos imutáveis.' },
    'admin-audit-event': { title: 'Evento de auditoria', summary: 'Consulte um evento de auditoria autorizado.' },
  }),
} as const satisfies Readonly<Record<WebLocale, Readonly<Record<AdminAuthorityRoute, Readonly<{ summary: string; title: string }>>>>>);

export const getAdminRouteMetadata = (locale: WebLocale, routeId: AdminAuthorityRoute) =>
  ADMIN_ROUTE_METADATA[locale][routeId];
