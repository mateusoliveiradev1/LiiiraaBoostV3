import type { WebLocale, WebRouteId } from '@liiiraa/web-core';

import type { AdminPreviewRole } from '../proxy';
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

export const isAdminPreviewRoute = (routeId: WebRouteId): routeId is AdminPreviewRoute =>
  ADMIN_ENTRY_ROUTE_IDS.includes(routeId as AdminPreviewRoute);

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
