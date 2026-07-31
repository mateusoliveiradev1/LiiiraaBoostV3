import type { WebLocale, WebRouteId } from '@liiiraa/web-core';

import type { AdminPreviewRole } from '../proxy';
import type { AdminFailureKind } from './admin-errors';
import adminEn from './content/admin.en.json';
import adminPtBr from './content/admin.pt-BR.json';

export const ADMIN_ENTRY_ROUTE_IDS = Object.freeze([
  'admin-role',
  'admin-support',
  'admin-operations',
  'admin-security',
  'admin-diagnostics',
  'admin-audit',
  'admin-audit-event',
] as const satisfies readonly WebRouteId[]);

export type AdminPreviewRoute = (typeof ADMIN_ENTRY_ROUTE_IDS)[number];

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

export const isAdminPreviewRoute = (routeId: WebRouteId): routeId is AdminPreviewRoute =>
  ADMIN_ENTRY_ROUTE_IDS.includes(routeId as AdminPreviewRoute);

export const isAdminErrorRoute = (routeId: WebRouteId): routeId is AdminErrorRoute =>
  ADMIN_ERROR_ROUTE_IDS.includes(routeId as AdminErrorRoute);

export const adminFailureKindForRoute = (routeId: WebRouteId): AdminFailureKind | undefined =>
  isAdminErrorRoute(routeId) ? ADMIN_FAILURE_KIND_BY_ROUTE[routeId] : undefined;

export const ADMIN_ROLE_ROUTE_ACCESS = Object.freeze({
  support: ['admin-role', 'admin-support'],
  operations: ['admin-role', 'admin-operations', 'admin-audit'],
  security: ['admin-role', 'admin-security', 'admin-diagnostics', 'admin-audit'],
  audit: ['admin-role', 'admin-audit', 'admin-audit-event'],
} as const satisfies Readonly<Record<AdminPreviewRole, readonly AdminPreviewRoute[]>>);

export const adminRoleCanAccess = (role: AdminPreviewRole, routeId: AdminPreviewRoute): boolean =>
  ADMIN_ROLE_ROUTE_ACCESS[role].includes(routeId as never);

const contentByLocale = { en: adminEn, 'pt-BR': adminPtBr } as const;

export const getAdminPreviewMetadata = (locale: WebLocale, routeId: AdminPreviewRoute) => {
  const content = contentByLocale[locale];
  const metadata =
    routeId === 'admin-role'
      ? content.landing
      : routeId === 'admin-support'
        ? content.support
        : routeId === 'admin-operations'
          ? content.operations
          : routeId === 'admin-security'
            ? content.security
            : routeId === 'admin-diagnostics'
              ? content.diagnostics
              : content.audit;
  return Object.freeze({ summary: metadata.summary, title: metadata.title });
};
