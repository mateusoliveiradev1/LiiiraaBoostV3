import { routeHref, webRoutes, type WebLocale, type WebRouteId } from '@liiiraa/web-core';
import type { AdminDomainJson } from '@liiiraa/contracts-ts';

import { ADMIN_ROLES, type AdminRole } from './admin-runtime';

export const ADMIN_DOMAIN_ORDER = Object.freeze([
  'overview',
  'people',
  'revenue',
  'operation',
  'support',
  'security',
  'system',
] as const satisfies readonly AdminDomainJson[]);

export type AdminShellDomain = (typeof ADMIN_DOMAIN_ORDER)[number];

export type AdminNavigationItem = Readonly<{
  domain: AdminShellDomain;
  href: string;
  label: string;
  routeId: WebRouteId;
}>;

type AdminDomainNavigationDefinition = Readonly<{
  label: Readonly<Record<WebLocale, string>>;
  routeId: WebRouteId;
}>;

const CANONICAL_ADMIN_ROUTES = new Set(
  webRoutes.filter(({ surface }) => surface === 'admin').map(({ id }) => id),
);

const ADMIN_DOMAIN_NAVIGATION = Object.freeze({
  overview: Object.freeze({
    label: { 'pt-BR': 'Visão geral', en: 'Overview' },
    routeId: 'admin-overview',
  }),
  people: Object.freeze({
    label: { 'pt-BR': 'Pessoas', en: 'People' },
    routeId: 'admin-people',
  }),
  revenue: Object.freeze({
    label: { 'pt-BR': 'Receita', en: 'Revenue' },
    routeId: 'admin-revenue',
  }),
  operation: Object.freeze({
    label: { 'pt-BR': 'Operação', en: 'Operation' },
    routeId: 'admin-operation',
  }),
  support: Object.freeze({
    label: { 'pt-BR': 'Atendimento', en: 'Support' },
    routeId: 'admin-support-domain',
  }),
  security: Object.freeze({
    label: { 'pt-BR': 'Segurança', en: 'Security' },
    routeId: 'admin-security-domain',
  }),
  system: Object.freeze({
    label: { 'pt-BR': 'Sistema', en: 'System' },
    routeId: 'admin-system',
  }),
} as const satisfies Readonly<Record<AdminShellDomain, AdminDomainNavigationDefinition>>);

const ROLE_DOMAINS = Object.freeze({
  support: Object.freeze(['overview', 'support'] as const),
  operations: Object.freeze(['overview', 'people', 'revenue', 'operation', 'system'] as const),
  security: Object.freeze(['overview', 'people', 'security'] as const),
  audit: Object.freeze(['overview', 'system'] as const),
} satisfies Readonly<Record<AdminRole, readonly AdminShellDomain[]>>);

export const ADMIN_ROLE_COPY = Object.freeze({
  support: Object.freeze({
    'pt-BR': 'Suporte',
    en: 'Support',
  }),
  operations: Object.freeze({
    'pt-BR': 'Operações',
    en: 'Operations',
  }),
  security: Object.freeze({
    'pt-BR': 'Segurança',
    en: 'Security',
  }),
  audit: Object.freeze({
    'pt-BR': 'Auditoria',
    en: 'Audit',
  }),
} satisfies Readonly<Record<AdminRole, Readonly<Record<WebLocale, string>>>>);

export const adminRoleFromHeader = (value: string | null): AdminRole =>
  ADMIN_ROLES.includes(value as AdminRole) ? (value as AdminRole) : 'support';

const uniqueDomainsInStableOrder = (
  domains: readonly AdminDomainJson[],
): readonly AdminShellDomain[] => {
  const authorized = new Set(domains);
  return Object.freeze(ADMIN_DOMAIN_ORDER.filter((domain) => authorized.has(domain)));
};

/**
 * Projects only the domain identifiers admitted by the server. The client owns labels and
 * stable ordering, but never adds a destination that was absent from the authority projection.
 */
export const projectAdminDomainNavigation = (
  domains: readonly AdminDomainJson[],
  locale: WebLocale,
): readonly AdminNavigationItem[] =>
  Object.freeze(
    uniqueDomainsInStableOrder(domains).map((domain) => {
      const definition = ADMIN_DOMAIN_NAVIGATION[domain];
      if (!CANONICAL_ADMIN_ROUTES.has(definition.routeId)) {
        throw new Error(`Admin domain navigation route is not canonical: ${definition.routeId}`);
      }

      const result = routeHref(definition.routeId, { locale });
      if (!result.ok) {
        throw new Error(`Admin domain navigation route is unavailable: ${definition.routeId}`);
      }

      return Object.freeze({
        domain,
        href: result.value,
        label: definition.label[locale],
        routeId: definition.routeId,
      });
    }),
  );

/**
 * Projects the bounded role admitted by the server. URL role claims never reach this boundary.
 */
export const projectAdminRoleNavigation = (
  role: AdminRole,
  locale: WebLocale,
): readonly AdminNavigationItem[] => projectAdminDomainNavigation(ROLE_DOMAINS[role], locale);
