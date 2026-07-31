import { routeHref, webRoutes, type WebLocale, type WebRouteId } from '@liiiraa/web-core';

import { ADMIN_PREVIEW_ROLES, type AdminPreviewRole } from '../proxy';

export type AdminNavigationItem = Readonly<{
  href: string;
  label: string;
  routeId: WebRouteId;
}>;

type AdminNavigationDefinition = Readonly<{
  label: Readonly<Record<WebLocale, string>>;
  parameters?: Readonly<Record<string, string>>;
  routeId: WebRouteId;
}>;

const CANONICAL_ADMIN_ROUTES = new Set(
  webRoutes.filter(({ surface }) => surface === 'admin').map(({ id }) => id),
);

const ROLE_NAVIGATION = Object.freeze({
  support: Object.freeze([
    {
      label: { 'pt-BR': 'Área da função', en: 'Role workspace' },
      routeId: 'admin-role',
    },
    {
      label: { 'pt-BR': 'Caso de suporte', en: 'Support case' },
      parameters: { caseId: 'case-preview' },
      routeId: 'admin-support',
    },
  ]),
  operations: Object.freeze([
    {
      label: { 'pt-BR': 'Área da função', en: 'Role workspace' },
      routeId: 'admin-role',
    },
    {
      label: { 'pt-BR': 'Revisão operacional', en: 'Operations review' },
      parameters: { reviewId: 'review-preview' },
      routeId: 'admin-operations',
    },
    {
      label: { 'pt-BR': 'Auditoria', en: 'Audit' },
      routeId: 'admin-audit',
    },
  ]),
  security: Object.freeze([
    {
      label: { 'pt-BR': 'Área da função', en: 'Role workspace' },
      routeId: 'admin-role',
    },
    {
      label: { 'pt-BR': 'Revisão de segurança', en: 'Security review' },
      parameters: { reviewId: 'review-preview' },
      routeId: 'admin-security',
    },
    {
      label: { 'pt-BR': 'Diagnóstico com consentimento', en: 'Consent diagnostic' },
      parameters: { diagnosticId: 'diagnostic-preview' },
      routeId: 'admin-diagnostics',
    },
    {
      label: { 'pt-BR': 'Auditoria', en: 'Audit' },
      routeId: 'admin-audit',
    },
  ]),
  audit: Object.freeze([
    {
      label: { 'pt-BR': 'Área da função', en: 'Role workspace' },
      routeId: 'admin-role',
    },
    {
      label: { 'pt-BR': 'Linha do tempo de auditoria', en: 'Audit timeline' },
      routeId: 'admin-audit',
    },
    {
      label: { 'pt-BR': 'Evento correlacionado', en: 'Correlated event' },
      parameters: { eventId: 'event-preview' },
      routeId: 'admin-audit-event',
    },
  ]),
} as const satisfies Readonly<Record<AdminPreviewRole, readonly AdminNavigationDefinition[]>>);

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
} satisfies Readonly<Record<AdminPreviewRole, Readonly<Record<WebLocale, string>>>>);

export const adminRoleFromHeader = (value: string | null): AdminPreviewRole =>
  ADMIN_PREVIEW_ROLES.includes(value as AdminPreviewRole) ? (value as AdminPreviewRole) : 'support';

export const projectAdminRoleNavigation = (
  role: AdminPreviewRole,
  locale: WebLocale,
): readonly AdminNavigationItem[] =>
  Object.freeze(
    ROLE_NAVIGATION[role].map((definition) => {
      if (!CANONICAL_ADMIN_ROUTES.has(definition.routeId)) {
        throw new Error(`Admin role navigation route is not canonical: ${definition.routeId}`);
      }

      const result = routeHref(definition.routeId, {
        locale,
        ...('parameters' in definition ? definition.parameters : {}),
      });

      if (!result.ok) {
        throw new Error(`Admin role navigation route is unavailable: ${definition.routeId}`);
      }

      const roleContext = role === 'support' ? '' : `?role=${role}`;

      return Object.freeze({
        href: `${result.value}${roleContext}`,
        label: definition.label[locale],
        routeId: definition.routeId,
      });
    }),
  );
