import type { AdminRoleJson } from '@liiiraa/contracts-ts';
import { ADMIN_CANONICAL_ROUTE_IDS, type WebLocale, type WebRouteId } from '@liiiraa/web-core';

import { projectAdminRoleNavigation, type AdminShellDomain } from '../admin-shell';

export type AdminCanonicalRouteId = (typeof ADMIN_CANONICAL_ROUTE_IDS)[number];

export type AdminWorkspaceDefinition = Readonly<{
  domain: AdminShellDomain;
  kind:
    | 'access-governance'
    | 'invitations'
    | 'operation'
    | 'overview'
    | 'queue'
    | 'revenue'
    | 'security'
    | 'support'
    | 'system';
  routeId: AdminCanonicalRouteId;
}>;

const canonicalRoutes = new Set<WebRouteId>(ADMIN_CANONICAL_ROUTE_IDS);

export const isAdminCanonicalRoute = (routeId: WebRouteId): routeId is AdminCanonicalRouteId =>
  canonicalRoutes.has(routeId);

export const resolveAdminWorkspaceRecordId = (
  routeId: AdminCanonicalRouteId,
  parameters: Readonly<Record<string, string>>,
): string | undefined => {
  if (!isAdminCanonicalRoute(routeId)) return undefined;
  const entry = Object.entries(parameters).find(([key]) => key !== 'locale');
  return entry?.[1];
};

export const resolveAdminWorkspaceDefinition = (
  routeId: WebRouteId,
): AdminWorkspaceDefinition | null => {
  if (!isAdminCanonicalRoute(routeId)) return null;
  if (routeId === 'admin-overview')
    return Object.freeze({ domain: 'overview', kind: 'overview', routeId });
  if (routeId.startsWith('admin-people-invitation'))
    return Object.freeze({ domain: 'people', kind: 'invitations', routeId });
  if (routeId.startsWith('admin-people'))
    return Object.freeze({ domain: 'people', kind: 'access-governance', routeId });
  if (routeId.startsWith('admin-revenue'))
    return Object.freeze({ domain: 'revenue', kind: 'revenue', routeId });
  if (
    routeId === 'admin-operation-queue' ||
    routeId === 'admin-operation-queue-item' ||
    routeId === 'admin-search' ||
    routeId === 'admin-inbox' ||
    routeId === 'admin-saved-views' ||
    routeId === 'admin-activity'
  )
    return Object.freeze({ domain: 'overview', kind: 'queue', routeId });
  if (routeId.startsWith('admin-operation'))
    return Object.freeze({ domain: 'operation', kind: 'operation', routeId });
  if (routeId.startsWith('admin-support'))
    return Object.freeze({ domain: 'support', kind: 'support', routeId });
  if (routeId.startsWith('admin-security'))
    return Object.freeze({ domain: 'security', kind: 'security', routeId });
  return Object.freeze({ domain: 'system', kind: 'system', routeId });
};

export const adminSessionCanOpenWorkspace = (
  definition: AdminWorkspaceDefinition,
  locale: WebLocale,
  role: AdminRoleJson,
): boolean =>
  projectAdminRoleNavigation(role, locale).some(({ domain }) => domain === definition.domain);
