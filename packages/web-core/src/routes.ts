import type {
  CapabilityAvailabilityJson,
  IndexingPolicyJson,
  SafeContextKeyJson,
  WebRouteRecordJson,
  WebSecurityBoundaryJson,
  WebShellJson,
  WebSurfaceJson,
} from '@liiiraa/contracts-ts/generated';
import { validateWebDocument } from '@liiiraa/contracts-ts/web-validation';

export const WEB_LOCALES = Object.freeze(['pt-BR', 'en'] as const);
export const WEB_VERSIONS = Object.freeze(['current', '1.0.0'] as const);
export const WEB_CHANNELS = Object.freeze(['stable', 'beta', 'experimental'] as const);
export const WEB_DOCUMENT_SECTIONS = Object.freeze([
  'getting-started',
  'preparing',
  'measuring',
  'optimizing',
  'restoring',
  'troubleshooting',
] as const);

export type WebLocale = (typeof WEB_LOCALES)[number];
export type WebVersion = (typeof WEB_VERSIONS)[number];
export type WebChannel = (typeof WEB_CHANNELS)[number];
export type WebDocumentSection = (typeof WEB_DOCUMENT_SECTIONS)[number];

type RouteOptions = Readonly<{
  indexing?: IndexingPolicyJson;
  owner?: string;
  safeContextKeys?: WebRouteRecordJson['safeContextKeys'];
  scenarioRequirement?: CapabilityAvailabilityJson;
}>;

type LiteralRoute<Id extends string> = Readonly<
  Omit<WebRouteRecordJson, 'id'> & { readonly id: Id }
>;

const defaultSafeContextKeys = ['locale'] satisfies WebRouteRecordJson['safeContextKeys'];

const createRoute = <const Id extends string>(
  id: Id,
  surface: WebSurfaceJson,
  pathnameTemplate: string,
  options: RouteOptions = {},
): LiteralRoute<Id> => ({
  id,
  indexing: options.indexing ?? 'index',
  localePolicy: 'required',
  owner: options.owner ?? `${surface}-content`,
  pathnameTemplate,
  safeContextKeys: options.safeContextKeys ?? defaultSafeContextKeys,
  scenarioRequirement: options.scenarioRequirement ?? 'available',
  securityBoundary: `${surface}-origin` as WebSecurityBoundaryJson,
  shell: surface,
  surface,
});

const publicRoute = <const Id extends string>(
  id: Id,
  pathnameTemplate: string,
  options?: RouteOptions,
): LiteralRoute<Id> => createRoute(id, 'public', pathnameTemplate, options);

const accountRoute = <const Id extends string>(
  id: Id,
  pathnameTemplate: string,
  options?: RouteOptions,
): LiteralRoute<Id> =>
  createRoute(id, 'account', pathnameTemplate, {
    indexing: 'noindex',
    scenarioRequirement: 'demonstrative-preview',
    ...options,
  });

const adminRoute = <const Id extends string>(
  id: Id,
  pathnameTemplate: string,
  options?: RouteOptions,
): LiteralRoute<Id> =>
  createRoute(id, 'admin', pathnameTemplate, {
    indexing: 'noindex',
    scenarioRequirement: 'demonstrative-preview',
    ...options,
  });

export const ADMIN_DOMAIN_ROUTE_IDS = Object.freeze({
  operation: Object.freeze([
    'admin-operation',
    'admin-operation-queue',
    'admin-operation-jobs',
    'admin-operation-imports',
    'admin-operation-exports',
    'admin-operation-releases',
    'admin-operation-configurations',
    'admin-operation-capacity',
  ] as const),
  overview: Object.freeze(['admin-overview'] as const),
  people: Object.freeze([
    'admin-people',
    'admin-people-users',
    'admin-people-invitations',
    'admin-people-team',
    'admin-people-access-reviews',
  ] as const),
  revenue: Object.freeze([
    'admin-revenue',
    'admin-revenue-subscriptions',
    'admin-revenue-invoices',
    'admin-revenue-payments',
    'admin-revenue-refunds',
    'admin-revenue-disputes',
  ] as const),
  security: Object.freeze([
    'admin-security-domain',
    'admin-security-alerts',
    'admin-security-recovery',
    'admin-security-privacy',
    'admin-security-incidents',
  ] as const),
  support: Object.freeze([
    'admin-support-domain',
    'admin-support-cases',
    'admin-support-diagnostics',
  ] as const),
  system: Object.freeze([
    'admin-system',
    'admin-system-integrations',
    'admin-system-webhooks',
    'admin-system-audit',
    'admin-system-environments',
    'admin-system-service-health',
  ] as const),
});

export const ADMIN_CANONICAL_ROUTE_IDS = Object.freeze([
  ...ADMIN_DOMAIN_ROUTE_IDS.overview,
  ...ADMIN_DOMAIN_ROUTE_IDS.people,
  'admin-people-user',
  'admin-people-invitation',
  'admin-people-team-member',
  'admin-people-access-review',
  ...ADMIN_DOMAIN_ROUTE_IDS.revenue,
  'admin-revenue-subscription',
  'admin-revenue-invoice',
  'admin-revenue-payment',
  'admin-revenue-refund',
  'admin-revenue-dispute',
  ...ADMIN_DOMAIN_ROUTE_IDS.operation,
  'admin-operation-queue-item',
  'admin-operation-job',
  'admin-operation-import',
  'admin-operation-export',
  'admin-operation-release',
  'admin-operation-configuration',
  ...ADMIN_DOMAIN_ROUTE_IDS.support,
  'admin-support-case',
  'admin-support-diagnostic',
  ...ADMIN_DOMAIN_ROUTE_IDS.security,
  'admin-security-alert',
  'admin-security-recovery-case',
  'admin-security-privacy-case',
  'admin-security-incident',
  ...ADMIN_DOMAIN_ROUTE_IDS.system,
  'admin-system-integration',
  'admin-system-webhook',
  'admin-system-audit-event',
  'admin-system-environment',
  'admin-search',
  'admin-inbox',
  'admin-saved-views',
  'admin-activity',
] as const);

const rawWebRoutes = [
  publicRoute('public-home', '/[locale]'),
  publicRoute('public-about', '/[locale]/about'),
  publicRoute('public-principles', '/[locale]/principles'),
  publicRoute('public-product', '/[locale]/product', { owner: 'public-navigation' }),
  publicRoute('public-results', '/[locale]/results', { owner: 'public-navigation' }),
  publicRoute('public-evidence', '/[locale]/evidence', { owner: 'public-content' }),
  publicRoute('public-compatibility', '/[locale]/compatibility', {
    owner: 'public-navigation',
  }),
  publicRoute('public-plans', '/[locale]/plans', { owner: 'public-navigation' }),
  publicRoute('public-download', '/[locale]/download', { owner: 'public-navigation' }),
  publicRoute('public-search', '/[locale]/search', { indexing: 'noindex' }),
  publicRoute('public-support', '/[locale]/support', { owner: 'public-navigation' }),
  publicRoute('public-status', '/[locale]/status'),
  publicRoute('public-policies', '/[locale]/policies'),
  publicRoute('public-privacy-policy', '/[locale]/policies/privacy'),
  publicRoute('public-terms', '/[locale]/policies/terms'),
  publicRoute('public-essential-storage', '/[locale]/policies/essential-storage'),
  publicRoute('public-responsible-disclosure', '/[locale]/responsible-disclosure'),
  publicRoute('docs-index', '/[locale]/docs', {
    owner: 'docs-content',
    safeContextKeys: ['locale', 'version'],
  }),
  publicRoute('docs-task', '/[locale]/docs/tasks/[section]', {
    owner: 'docs-content',
    safeContextKeys: ['locale', 'version', 'destination'],
  }),
  publicRoute('docs-article', '/[locale]/docs/[version]/articles/[article]', {
    owner: 'docs-content',
    safeContextKeys: ['locale', 'version'],
  }),
  publicRoute('docs-reference', '/[locale]/docs/[version]/reference/[reference]', {
    owner: 'docs-content',
    safeContextKeys: ['locale', 'version'],
  }),
  publicRoute('docs-troubleshooting', '/[locale]/docs/[version]/troubleshooting/[code]', {
    owner: 'docs-content',
    safeContextKeys: ['locale', 'version'],
  }),
  publicRoute('docs-history', '/[locale]/docs/history/[version]/[article]', {
    indexing: 'noindex',
    owner: 'docs-content',
    safeContextKeys: ['locale', 'version'],
  }),
  publicRoute('releases-index', '/[locale]/releases', {
    owner: 'release-content',
    safeContextKeys: ['locale', 'version', 'channel'],
  }),
  publicRoute('releases-channel', '/[locale]/releases/[channel]', {
    owner: 'release-content',
    safeContextKeys: ['locale', 'version', 'channel'],
  }),
  publicRoute('releases-version', '/[locale]/releases/[channel]/[version]', {
    owner: 'release-content',
    safeContextKeys: ['locale', 'version', 'channel'],
  }),
  publicRoute('releases-integrity', '/[locale]/releases/[channel]/[version]/integrity', {
    owner: 'release-content',
    safeContextKeys: ['locale', 'version', 'channel'],
  }),
  publicRoute('releases-download', '/[locale]/download/[channel]/[version]', {
    indexing: 'noindex',
    owner: 'release-content',
    safeContextKeys: ['locale', 'version', 'channel'],
    scenarioRequirement: 'demonstrative-preview',
  }),
  publicRoute('releases-install', '/[locale]/releases/[channel]/[version]/install', {
    owner: 'release-content',
    safeContextKeys: ['locale', 'version', 'channel'],
  }),
  accountRoute('account-sign-in', '/[locale]/login', {
    owner: 'account-auth',
    safeContextKeys: ['locale', 'destination', 'return-path'],
  }),
  accountRoute('account-sign-up', '/[locale]/register', {
    owner: 'account-auth',
    safeContextKeys: ['locale', 'destination', 'return-path'],
  }),
  accountRoute('account-onboarding', '/[locale]/onboarding', {
    owner: 'account-auth',
    safeContextKeys: ['locale', 'destination', 'return-path'],
  }),
  accountRoute('account-overview', '/[locale]/account', {
    owner: 'account-navigation',
    safeContextKeys: ['locale', 'destination', 'return-path'],
  }),
  accountRoute('account-profile', '/[locale]/account/profile', {
    owner: 'account-navigation',
  }),
  accountRoute('account-security', '/[locale]/account/security', {
    owner: 'account-navigation',
  }),
  accountRoute('account-subscription', '/[locale]/account/subscription', {
    owner: 'account-navigation',
  }),
  accountRoute('account-invoices', '/[locale]/account/invoices', {
    owner: 'account-navigation',
  }),
  accountRoute('account-device', '/[locale]/account/device', {
    owner: 'account-navigation',
  }),
  accountRoute('account-downloads', '/[locale]/account/downloads', {
    owner: 'account-navigation',
  }),
  accountRoute('account-privacy', '/[locale]/account/privacy', {
    owner: 'account-navigation',
  }),
  accountRoute('account-support', '/[locale]/account/support', {
    owner: 'account-navigation',
  }),
  adminRoute('admin-overview', '/[locale]/admin/overview', { owner: 'admin-overview' }),
  adminRoute('admin-people', '/[locale]/admin/people', { owner: 'admin-people' }),
  adminRoute('admin-people-users', '/[locale]/admin/people/users', { owner: 'admin-people' }),
  adminRoute('admin-people-user', '/[locale]/admin/people/users/[userId]', {
    owner: 'admin-people',
  }),
  adminRoute('admin-people-invitations', '/[locale]/admin/people/invitations', {
    owner: 'admin-people',
  }),
  adminRoute('admin-people-invitation', '/[locale]/admin/people/invitations/[invitationId]', {
    owner: 'admin-people',
  }),
  adminRoute('admin-people-team', '/[locale]/admin/people/team', { owner: 'admin-people' }),
  adminRoute('admin-people-team-member', '/[locale]/admin/people/team/[memberId]', {
    owner: 'admin-people',
  }),
  adminRoute('admin-people-access-reviews', '/[locale]/admin/people/access-reviews', {
    owner: 'admin-people',
  }),
  adminRoute('admin-people-access-review', '/[locale]/admin/people/access-reviews/[reviewId]', {
    owner: 'admin-people',
  }),
  adminRoute('admin-revenue', '/[locale]/admin/revenue', { owner: 'admin-revenue' }),
  adminRoute('admin-revenue-subscriptions', '/[locale]/admin/revenue/subscriptions', {
    owner: 'admin-revenue',
  }),
  adminRoute(
    'admin-revenue-subscription',
    '/[locale]/admin/revenue/subscriptions/[subscriptionId]',
    { owner: 'admin-revenue' },
  ),
  adminRoute('admin-revenue-invoices', '/[locale]/admin/revenue/invoices', {
    owner: 'admin-revenue',
  }),
  adminRoute('admin-revenue-invoice', '/[locale]/admin/revenue/invoices/[invoiceId]', {
    owner: 'admin-revenue',
  }),
  adminRoute('admin-revenue-payments', '/[locale]/admin/revenue/payments', {
    owner: 'admin-revenue',
  }),
  adminRoute('admin-revenue-payment', '/[locale]/admin/revenue/payments/[paymentId]', {
    owner: 'admin-revenue',
  }),
  adminRoute('admin-revenue-refunds', '/[locale]/admin/revenue/refunds', {
    owner: 'admin-revenue',
  }),
  adminRoute('admin-revenue-refund', '/[locale]/admin/revenue/refunds/[refundId]', {
    owner: 'admin-revenue',
  }),
  adminRoute('admin-revenue-disputes', '/[locale]/admin/revenue/disputes', {
    owner: 'admin-revenue',
  }),
  adminRoute('admin-revenue-dispute', '/[locale]/admin/revenue/disputes/[disputeId]', {
    owner: 'admin-revenue',
  }),
  adminRoute('admin-operation', '/[locale]/admin/operation', { owner: 'admin-operation' }),
  adminRoute('admin-operation-queue', '/[locale]/admin/operation/queue', {
    owner: 'admin-operation',
  }),
  adminRoute('admin-operation-queue-item', '/[locale]/admin/operation/queue/[itemId]', {
    owner: 'admin-operation',
  }),
  adminRoute('admin-operation-jobs', '/[locale]/admin/operation/jobs', {
    owner: 'admin-operation',
  }),
  adminRoute('admin-operation-job', '/[locale]/admin/operation/jobs/[jobId]', {
    owner: 'admin-operation',
  }),
  adminRoute('admin-operation-imports', '/[locale]/admin/operation/imports', {
    owner: 'admin-operation',
  }),
  adminRoute('admin-operation-import', '/[locale]/admin/operation/imports/[importId]', {
    owner: 'admin-operation',
  }),
  adminRoute('admin-operation-exports', '/[locale]/admin/operation/exports', {
    owner: 'admin-operation',
  }),
  adminRoute('admin-operation-export', '/[locale]/admin/operation/exports/[exportId]', {
    owner: 'admin-operation',
  }),
  adminRoute('admin-operation-releases', '/[locale]/admin/operation/releases', {
    owner: 'admin-operation',
  }),
  adminRoute('admin-operation-release', '/[locale]/admin/operation/releases/[releaseId]', {
    owner: 'admin-operation',
  }),
  adminRoute('admin-operation-configurations', '/[locale]/admin/operation/configurations', {
    owner: 'admin-operation',
  }),
  adminRoute(
    'admin-operation-configuration',
    '/[locale]/admin/operation/configurations/[configurationId]',
    { owner: 'admin-operation' },
  ),
  adminRoute('admin-operation-capacity', '/[locale]/admin/operation/capacity', {
    owner: 'admin-operation',
  }),
  adminRoute('admin-support-domain', '/[locale]/admin/support', { owner: 'admin-support' }),
  adminRoute('admin-support-cases', '/[locale]/admin/support/cases', { owner: 'admin-support' }),
  adminRoute('admin-support-case', '/[locale]/admin/support/cases/[caseId]', {
    owner: 'admin-support',
  }),
  adminRoute('admin-support-diagnostics', '/[locale]/admin/support/diagnostics', {
    owner: 'admin-support',
  }),
  adminRoute('admin-support-diagnostic', '/[locale]/admin/support/diagnostics/[diagnosticId]', {
    owner: 'admin-support',
  }),
  adminRoute('admin-security-domain', '/[locale]/admin/security', { owner: 'admin-security' }),
  adminRoute('admin-security-alerts', '/[locale]/admin/security/alerts', {
    owner: 'admin-security',
  }),
  adminRoute('admin-security-alert', '/[locale]/admin/security/alerts/[alertId]', {
    owner: 'admin-security',
  }),
  adminRoute('admin-security-recovery', '/[locale]/admin/security/recovery', {
    owner: 'admin-security',
  }),
  adminRoute('admin-security-recovery-case', '/[locale]/admin/security/recovery/[recoveryId]', {
    owner: 'admin-security',
  }),
  adminRoute('admin-security-privacy', '/[locale]/admin/security/privacy', {
    owner: 'admin-security',
  }),
  adminRoute('admin-security-privacy-case', '/[locale]/admin/security/privacy/[privacyCaseId]', {
    owner: 'admin-security',
  }),
  adminRoute('admin-security-incidents', '/[locale]/admin/security/incidents', {
    owner: 'admin-security',
  }),
  adminRoute('admin-security-incident', '/[locale]/admin/security/incidents/[incidentId]', {
    owner: 'admin-security',
  }),
  adminRoute('admin-system', '/[locale]/admin/system', { owner: 'admin-system' }),
  adminRoute('admin-system-integrations', '/[locale]/admin/system/integrations', {
    owner: 'admin-system',
  }),
  adminRoute('admin-system-integration', '/[locale]/admin/system/integrations/[integrationId]', {
    owner: 'admin-system',
  }),
  adminRoute('admin-system-webhooks', '/[locale]/admin/system/webhooks', {
    owner: 'admin-system',
  }),
  adminRoute('admin-system-webhook', '/[locale]/admin/system/webhooks/[webhookId]', {
    owner: 'admin-system',
  }),
  adminRoute('admin-system-audit', '/[locale]/admin/system/audit', { owner: 'admin-system' }),
  adminRoute('admin-system-audit-event', '/[locale]/admin/system/audit/[eventId]', {
    owner: 'admin-system',
  }),
  adminRoute('admin-system-environments', '/[locale]/admin/system/environments', {
    owner: 'admin-system',
  }),
  adminRoute('admin-system-environment', '/[locale]/admin/system/environments/[environmentId]', {
    owner: 'admin-system',
  }),
  adminRoute('admin-system-service-health', '/[locale]/admin/system/service-health', {
    owner: 'admin-system',
  }),
  adminRoute('admin-search', '/[locale]/admin/search', { owner: 'admin-utilities' }),
  adminRoute('admin-inbox', '/[locale]/admin/inbox', { owner: 'admin-utilities' }),
  adminRoute('admin-saved-views', '/[locale]/admin/views', { owner: 'admin-utilities' }),
  adminRoute('admin-activity', '/[locale]/admin/activity', { owner: 'admin-utilities' }),
  adminRoute('admin-role', '/[locale]/admin', { owner: 'admin-navigation' }),
  adminRoute('admin-support', '/[locale]/admin/support/[caseId]', {
    owner: 'admin-navigation',
  }),
  adminRoute('admin-operations', '/[locale]/admin/operations/[reviewId]', {
    owner: 'admin-navigation',
  }),
  adminRoute('admin-security', '/[locale]/admin/security/[reviewId]', {
    owner: 'admin-navigation',
  }),
  adminRoute('admin-diagnostics', '/[locale]/admin/diagnostics/[diagnosticId]', {
    owner: 'admin-security',
  }),
  adminRoute('admin-audit', '/[locale]/admin/audit', {
    owner: 'admin-navigation',
  }),
  adminRoute('admin-audit-event', '/[locale]/admin/audit/[eventId]', {
    owner: 'admin-audit',
  }),
  publicRoute('public-error-404', '/[locale]/errors/404', {
    indexing: 'noindex',
    owner: 'public-errors',
  }),
  publicRoute('public-error-403', '/[locale]/errors/403', {
    indexing: 'noindex',
    owner: 'public-errors',
  }),
  publicRoute('public-error-410', '/[locale]/errors/410', {
    indexing: 'noindex',
    owner: 'public-errors',
  }),
  publicRoute('public-error-500', '/[locale]/errors/500', {
    indexing: 'noindex',
    owner: 'public-errors',
  }),
  accountRoute('account-error-404', '/[locale]/errors/404', {
    owner: 'account-errors',
  }),
  accountRoute('account-error-403', '/[locale]/errors/403', {
    owner: 'account-errors',
  }),
  accountRoute('account-error-410', '/[locale]/errors/410', {
    owner: 'account-errors',
  }),
  accountRoute('account-error-500', '/[locale]/errors/500', {
    owner: 'account-errors',
  }),
  adminRoute('admin-error-404', '/[locale]/errors/404', { owner: 'admin-errors' }),
  adminRoute('admin-error-403', '/[locale]/errors/403', { owner: 'admin-errors' }),
  adminRoute('admin-error-410', '/[locale]/errors/410', { owner: 'admin-errors' }),
  adminRoute('admin-error-500', '/[locale]/errors/500', { owner: 'admin-errors' }),
] as const satisfies readonly WebRouteRecordJson[];

const deepFreeze = <Value>(value: Value): Readonly<Value> => {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) {
    return value;
  }
  for (const nested of Object.values(value)) {
    deepFreeze(nested);
  }
  return Object.freeze(value);
};

for (const route of rawWebRoutes) {
  const validation = validateWebDocument(route);
  if (!validation.ok) {
    throw new Error(`Canonical web route failed generated validation: ${route.id}`);
  }
}

export const webRoutes = deepFreeze(rawWebRoutes);
export type WebRoute = (typeof webRoutes)[number];
export type WebRouteId = WebRoute['id'];

export type WebRouteErrorCode =
  | 'EMPTY_PATHNAME'
  | 'INVALID_LOCALE'
  | 'INVALID_PARAMETER'
  | 'INVALID_VERSION'
  | 'MISSING_PARAMETER'
  | 'UNKNOWN_ORIGIN'
  | 'UNKNOWN_PARAMETER'
  | 'UNKNOWN_ROUTE'
  | 'UNKNOWN_ROUTE_ID'
  | 'UNSAFE_PATHNAME';

export type WebRouteError = Readonly<{
  code: WebRouteErrorCode;
  path: string;
}>;

export type WebRouteMatch = Readonly<{
  parameters: Readonly<Record<string, string>>;
  pathname: string;
  route: WebRoute;
}>;

export type WebRouteResult<Value = WebRouteMatch> =
  Readonly<{ ok: true; value: Readonly<Value> }> | Readonly<{ error: WebRouteError; ok: false }>;

export type AdminRouteState = Readonly<{
  cursor?: string;
  density?: 'comfortable' | 'compact';
  filters?: readonly string[];
  recordId?: string;
  savedViewId?: string;
  sort?: readonly string[];
  tab?: string;
}>;

export type AdminRouteStateErrorCode =
  | 'ADMIN_QUERY_BOUNDS'
  | 'INVALID_ADMIN_QUERY'
  | 'INVALID_ADMIN_QUERY_VALUE'
  | 'UNKNOWN_ADMIN_QUERY_KEY';

export type AdminRouteStateResult<Value = AdminRouteState> =
  | Readonly<{ ok: true; value: Readonly<Value> }>
  | Readonly<{
      error: Readonly<{ code: AdminRouteStateErrorCode; path: string }>;
      ok: false;
    }>;

const routeFailure = <Value = never>(
  code: WebRouteErrorCode,
  path: string,
): WebRouteResult<Value> =>
  deepFreeze({
    error: { code, path },
    ok: false,
  });

const routeSuccess = <Value>(value: Value): WebRouteResult<Value> =>
  deepFreeze({ ok: true, value });

const isOneOf = <Value extends string>(value: string, allowed: readonly Value[]): value is Value =>
  allowed.includes(value as Value);

const routeById = (id: string): WebRoute | undefined => webRoutes.find((route) => route.id === id);

const requiredRouteById = (id: WebRouteId): WebRoute => {
  const route = routeById(id);
  if (route === undefined) {
    throw new Error(`Canonical web route is missing: ${id}`);
  }
  return route;
};

const localizedPathname = (
  route: WebRoute,
  parameters: Readonly<Record<string, string>>,
): string | undefined => {
  if (route.id === 'account-sign-up' && parameters['locale'] === 'pt-BR') {
    return '/pt-BR/cadastro';
  }
  return undefined;
};

export const isWebRouteId = (id: string): id is WebRouteId => routeById(id) !== undefined;

const PARAMETER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const PLACEHOLDER_PATTERN = /\[([A-Za-z][A-Za-z0-9]*)\]/gu;

const parameterError = (name: string, value: string): WebRouteErrorCode | undefined => {
  if (name === 'locale') {
    return isOneOf(value, WEB_LOCALES) ? undefined : 'INVALID_LOCALE';
  }
  if (name === 'version') {
    return isOneOf(value, WEB_VERSIONS) ? undefined : 'INVALID_VERSION';
  }
  if (name === 'channel') {
    return isOneOf(value, WEB_CHANNELS) ? undefined : 'INVALID_PARAMETER';
  }
  if (name === 'section') {
    return isOneOf(value, WEB_DOCUMENT_SECTIONS) ? undefined : 'INVALID_PARAMETER';
  }
  return PARAMETER_PATTERN.test(value) ? undefined : 'INVALID_PARAMETER';
};

const templateParameters = (template: string): readonly string[] =>
  Object.freeze([...template.matchAll(PLACEHOLDER_PATTERN)].map((match) => match[0].slice(1, -1)));

export const routeHref = (
  routeId: string,
  parameters: Readonly<Record<string, string>>,
): WebRouteResult<string> => {
  const route = routeById(routeId);
  if (route === undefined) {
    return routeFailure('UNKNOWN_ROUTE_ID', '$.routeId');
  }

  const required = templateParameters(route.pathnameTemplate);
  for (const key of Object.keys(parameters)) {
    if (!required.includes(key)) {
      return routeFailure('UNKNOWN_PARAMETER', `$.parameters.${key}`);
    }
  }

  let href = route.pathnameTemplate;
  for (const parameter of required) {
    const value = parameters[parameter];
    if (value === undefined) {
      return routeFailure('MISSING_PARAMETER', `$.parameters.${parameter}`);
    }
    const invalid = parameterError(parameter, value);
    if (invalid !== undefined) {
      return routeFailure(invalid, `$.parameters.${parameter}`);
    }
    href = href.replace(`[${parameter}]`, encodeURIComponent(value));
  }

  return routeSuccess(localizedPathname(route, parameters) ?? href);
};

const decodePathSegments = (pathname: string): readonly string[] | undefined => {
  try {
    return pathname
      .split('/')
      .filter((segment) => segment.length > 0)
      .map((segment) => decodeURIComponent(segment));
  } catch {
    return undefined;
  }
};

const SECURITY_BOUNDARIES = Object.freeze([
  'public-origin',
  'account-origin',
  'admin-origin',
] as const satisfies readonly WebSecurityBoundaryJson[]);

export const matchWebRoute = (
  input: Readonly<{
    pathname: string;
    securityBoundary: WebSecurityBoundaryJson;
  }>,
): WebRouteResult => {
  if (!isOneOf(input.securityBoundary, SECURITY_BOUNDARIES)) {
    return routeFailure('UNKNOWN_ORIGIN', '$.securityBoundary');
  }
  if (input.pathname.length === 0) {
    return routeFailure('EMPTY_PATHNAME', '$.pathname');
  }
  if (
    !input.pathname.startsWith('/') ||
    input.pathname.includes('://') ||
    input.pathname.includes('?') ||
    input.pathname.includes('#') ||
    input.pathname.includes('\\') ||
    (input.pathname.length > 1 && input.pathname.endsWith('/'))
  ) {
    return routeFailure('UNSAFE_PATHNAME', '$.pathname');
  }

  const pathSegments = decodePathSegments(input.pathname);
  if (pathSegments === undefined) {
    return routeFailure('INVALID_PARAMETER', '$.pathname');
  }

  if (
    input.securityBoundary === 'account-origin' &&
    input.pathname === '/pt-BR/cadastro'
  ) {
    return routeSuccess({
      parameters: deepFreeze({ locale: 'pt-BR' }),
      pathname: input.pathname,
      route: requiredRouteById('account-sign-up'),
    });
  }

  let closestParameterFailure: WebRouteResult | undefined;
  for (const route of webRoutes) {
    if (route.securityBoundary !== input.securityBoundary) {
      continue;
    }
    const templateSegments = decodePathSegments(route.pathnameTemplate);
    if (templateSegments?.length !== pathSegments.length) {
      continue;
    }

    const parameters: Record<string, string> = {};
    let matches = true;
    for (const [index, templateSegment] of templateSegments.entries()) {
      const pathSegment = pathSegments[index];
      if (pathSegment === undefined) {
        matches = false;
        break;
      }
      if (templateSegment.startsWith('[') && templateSegment.endsWith(']')) {
        const name = templateSegment.slice(1, -1);
        const invalid = parameterError(name, pathSegment);
        if (invalid !== undefined) {
          closestParameterFailure = routeFailure(invalid, `$.parameters.${name}`);
          matches = false;
          break;
        }
        parameters[name] = pathSegment;
      } else if (templateSegment !== pathSegment) {
        matches = false;
        break;
      }
    }

    if (matches) {
      return routeSuccess({
        parameters: deepFreeze(parameters),
        pathname: input.pathname,
        route,
      });
    }
  }

  return closestParameterFailure ?? routeFailure('UNKNOWN_ROUTE', '$.pathname');
};

export const resolveLocalizedCurrentRoute = (
  input: Readonly<{
    pathname: string;
    securityBoundary: WebSecurityBoundaryJson;
    targetLocale: WebLocale;
  }>,
): WebRouteResult<string> => {
  const matched = matchWebRoute({
    pathname: input.pathname,
    securityBoundary: input.securityBoundary,
  });
  if (!matched.ok) {
    return matched;
  }

  return routeHref(matched.value.route.id, {
    ...matched.value.parameters,
    locale: input.targetLocale,
  });
};

export const createDesktopAnalyzeLink = (): 'liiiraaboost://analyze' => 'liiiraaboost://analyze';

export type RouteProjection = Readonly<{
  from?: string;
  href: string;
  id: string;
  indexing: IndexingPolicyJson;
  owner: string;
  scenarioRequirement: CapabilityAvailabilityJson;
  securityBoundary: WebSecurityBoundaryJson;
  shell: WebShellJson;
  surface: WebSurfaceJson;
}>;

const projectRoute = (route: WebRoute): RouteProjection =>
  deepFreeze({
    href: route.pathnameTemplate,
    id: route.id,
    indexing: route.indexing,
    owner: route.owner,
    scenarioRequirement: route.scenarioRequirement,
    securityBoundary: route.securityBoundary,
    shell: route.shell,
    surface: route.surface,
  });

const hasSafeContextKey = (route: WebRoute, key: SafeContextKeyJson): boolean =>
  (route.safeContextKeys as readonly SafeContextKeyJson[]).includes(key);

export const projectNavigation = (shell: WebShellJson): readonly RouteProjection[] =>
  deepFreeze(
    webRoutes
      .filter((route) => route.shell === shell && route.owner === `${shell}-navigation`)
      .map(projectRoute),
  );

const rootRouteFor = (route: WebRoute): WebRoute => {
  if (route.shell === 'public') {
    return requiredRouteById('public-home');
  }
  if (route.shell === 'account') {
    return requiredRouteById('account-overview');
  }
  return requiredRouteById('admin-role');
};

export const projectBreadcrumbs = (routeId: string): readonly RouteProjection[] => {
  const route = routeById(routeId);
  if (route === undefined) {
    return Object.freeze([]);
  }

  const breadcrumbs: WebRoute[] = [rootRouteFor(route)];
  if (route.id.startsWith('docs-') && route.id !== 'docs-index') {
    breadcrumbs.push(requiredRouteById('docs-index'));
  } else if (route.id.startsWith('releases-') && route.id !== 'releases-index') {
    breadcrumbs.push(requiredRouteById('releases-index'));
  } else if (route.id.startsWith('admin-audit-') && route.id !== 'admin-audit') {
    breadcrumbs.push(requiredRouteById('admin-audit'));
  }
  if (!breadcrumbs.some(({ id }) => id === route.id)) {
    breadcrumbs.push(route);
  }
  return deepFreeze(breadcrumbs.map(projectRoute));
};

export const projectSitemap = (): readonly RouteProjection[] =>
  deepFreeze(
    webRoutes
      .filter(
        (route) =>
          route.surface === 'public' &&
          route.indexing === 'index' &&
          route.scenarioRequirement === 'available',
      )
      .map(projectRoute),
  );

export const projectRedirects = (): readonly RouteProjection[] =>
  deepFreeze(
    webRoutes.map((route) => ({
      ...projectRoute(route),
      from: `${route.pathnameTemplate}/`,
    })),
  );

export const projectDesktopLinks = (): readonly RouteProjection[] =>
  deepFreeze(
    webRoutes
      .filter(
        (route) =>
          route.surface === 'public' &&
          (hasSafeContextKey(route, 'version') || hasSafeContextKey(route, 'channel')),
      )
      .map(projectRoute),
  );

export const projectIndexing = (): readonly RouteProjection[] =>
  deepFreeze(webRoutes.map(projectRoute));

export type RouteProjectionConsumer =
  | 'navigation:public'
  | 'navigation:account'
  | 'navigation:admin'
  | 'sitemap'
  | 'redirects'
  | 'desktop-links'
  | 'indexing';

export type RouteProjectionErrorCode =
  | 'PROJECTION_DUPLICATE_ROUTE'
  | 'PROJECTION_MISSING_ROUTE'
  | 'PROJECTION_NOINDEX_LEAK'
  | 'PROJECTION_OWNER_DRIFT'
  | 'PROJECTION_PRIVATE_LEAK'
  | 'PROJECTION_REDIRECT_DRIFT'
  | 'PROJECTION_ROUTE_DRIFT'
  | 'PROJECTION_SCENARIO_LEAK'
  | 'PROJECTION_UNKNOWN_ROUTE';

export type RouteProjectionAuditResult =
  | Readonly<{ ok: true }>
  | Readonly<{
      error: Readonly<{ code: RouteProjectionErrorCode; path: string }>;
      ok: false;
    }>;

const projectionFailure = (
  code: RouteProjectionErrorCode,
  path: string,
): RouteProjectionAuditResult =>
  deepFreeze({
    error: { code, path },
    ok: false,
  });

const expectedProjection = (consumer: RouteProjectionConsumer): readonly RouteProjection[] => {
  switch (consumer) {
    case 'navigation:public':
      return projectNavigation('public');
    case 'navigation:account':
      return projectNavigation('account');
    case 'navigation:admin':
      return projectNavigation('admin');
    case 'sitemap':
      return projectSitemap();
    case 'redirects':
      return projectRedirects();
    case 'desktop-links':
      return projectDesktopLinks();
    case 'indexing':
      return projectIndexing();
  }
};

const sameProjection = (left: RouteProjection, right: RouteProjection): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

export const auditRouteProjection = (
  consumer: RouteProjectionConsumer,
  entries: readonly RouteProjection[],
): RouteProjectionAuditResult => {
  const seen = new Set<string>();
  for (const [index, entry] of entries.entries()) {
    if (seen.has(entry.id)) {
      return projectionFailure('PROJECTION_DUPLICATE_ROUTE', `$.entries[${String(index)}].id`);
    }
    seen.add(entry.id);
  }

  const expected = expectedProjection(consumer);
  for (const [index, entry] of entries.entries()) {
    if (consumer === 'navigation:public' && entry.surface !== 'public') {
      return projectionFailure('PROJECTION_PRIVATE_LEAK', `$.entries[${String(index)}]`);
    }
    if (consumer === 'sitemap' && entry.scenarioRequirement !== 'available') {
      return projectionFailure('PROJECTION_SCENARIO_LEAK', `$.entries[${String(index)}]`);
    }
    if (consumer === 'sitemap' && entry.indexing !== 'index') {
      return projectionFailure('PROJECTION_NOINDEX_LEAK', `$.entries[${String(index)}]`);
    }

    const canonical = routeById(entry.id);
    if (canonical === undefined) {
      return projectionFailure('PROJECTION_UNKNOWN_ROUTE', `$.entries[${String(index)}].id`);
    }
    if (entry.owner !== canonical.owner || entry.owner.length === 0) {
      return projectionFailure('PROJECTION_OWNER_DRIFT', `$.entries[${String(index)}].owner`);
    }

    const expectedEntry = expected.find(({ id }) => id === entry.id);
    if (expectedEntry === undefined) {
      return projectionFailure('PROJECTION_UNKNOWN_ROUTE', `$.entries[${String(index)}].id`);
    }
    if (!sameProjection(entry, expectedEntry)) {
      return projectionFailure(
        consumer === 'redirects' ? 'PROJECTION_REDIRECT_DRIFT' : 'PROJECTION_ROUTE_DRIFT',
        `$.entries[${String(index)}]`,
      );
    }
  }

  const missing = expected.find(
    (expectedEntry) => !entries.some(({ id }) => id === expectedEntry.id),
  );
  return missing === undefined
    ? deepFreeze({ ok: true })
    : projectionFailure('PROJECTION_MISSING_ROUTE', `$.entries.${missing.id}`);
};

export const WEB_ORIGINS = deepFreeze({
  'account-origin': 'https://account.liiiraa.com',
  'admin-origin': 'https://admin.liiiraa.com',
  'public-origin': 'https://liiiraa.com',
} satisfies Readonly<Record<WebSecurityBoundaryJson, string>>);

export type BoundaryContext = Readonly<{
  channel?: WebChannel;
  locale: WebLocale;
  requestedDestination?: WebRouteId;
  returnRouteId?: WebRouteId;
  section?: WebDocumentSection;
  version?: WebVersion;
}>;

export type BoundaryLink = Readonly<{
  crossesBoundary: boolean;
  from: WebSecurityBoundaryJson;
  href: string;
  preservedContext: BoundaryContext;
  to: WebSecurityBoundaryJson;
}>;

export type BoundaryLinkErrorCode =
  | 'UNKNOWN_ROUTE_ID'
  | 'UNSAFE_CHANNEL'
  | 'UNSAFE_CONTEXT_KEY'
  | 'UNSAFE_DESTINATION'
  | 'UNSAFE_LOCALE'
  | 'UNSAFE_RETURN_ROUTE'
  | 'UNSAFE_SECTION'
  | 'UNSAFE_VERSION';

export type BoundaryLinkResult =
  | Readonly<{ ok: true; value: BoundaryLink }>
  | Readonly<{
      error: Readonly<{ code: BoundaryLinkErrorCode; path: string }>;
      ok: false;
    }>;

const boundaryFailure = (code: BoundaryLinkErrorCode, path: string): BoundaryLinkResult =>
  deepFreeze({
    error: { code, path },
    ok: false,
  });

const CONTEXT_KEYS = Object.freeze([
  'channel',
  'locale',
  'requestedDestination',
  'returnRouteId',
  'section',
  'version',
] as const);

const contextPermission = Object.freeze({
  channel: 'channel',
  locale: 'locale',
  requestedDestination: 'destination',
  returnRouteId: 'return-path',
  section: 'destination',
  version: 'version',
} satisfies Readonly<Record<(typeof CONTEXT_KEYS)[number], SafeContextKeyJson>>);

const encodeQuery = (entries: readonly (readonly [string, string])[]): string =>
  entries.length === 0
    ? ''
    : `?${entries
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join('&')}`;

const ADMIN_QUERY_KEYS = Object.freeze([
  'cursor',
  'density',
  'filter',
  'record',
  'sort',
  'tab',
  'view',
] as const);
const ADMIN_QUERY_SINGLETON_KEYS = Object.freeze([
  'cursor',
  'density',
  'record',
  'tab',
  'view',
] as const);
const ADMIN_QUERY_VALUE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const ADMIN_QUERY_SECRET_PREFIX = /^(?:draft|email|reason|secret|token):/iu;

const adminRouteStateFailure = (
  code: AdminRouteStateErrorCode,
  path: string,
): AdminRouteStateResult<never> =>
  deepFreeze({
    error: { code, path },
    ok: false,
  });

const isSafeAdminQueryValue = (value: string): boolean =>
  ADMIN_QUERY_VALUE_PATTERN.test(value) && !ADMIN_QUERY_SECRET_PREFIX.test(value);

const validateAdminRouteState = (state: AdminRouteState): AdminRouteStateResult => {
  const knownStateKeys = Object.freeze([
    'cursor',
    'density',
    'filters',
    'recordId',
    'savedViewId',
    'sort',
    'tab',
  ] as const);
  for (const key of Object.keys(state)) {
    if (!isOneOf(key, knownStateKeys)) {
      return adminRouteStateFailure('UNKNOWN_ADMIN_QUERY_KEY', `$.state.${key}`);
    }
  }

  const filters = state.filters ?? Object.freeze([]);
  const sort = state.sort ?? Object.freeze([]);
  if (filters.length > 16 || sort.length > 8) {
    return adminRouteStateFailure('ADMIN_QUERY_BOUNDS', '$.state');
  }
  if (new Set(filters).size !== filters.length || new Set(sort).size !== sort.length) {
    return adminRouteStateFailure('INVALID_ADMIN_QUERY_VALUE', '$.state');
  }

  for (const [key, values] of [
    ['filters', filters],
    ['sort', sort],
  ] as const) {
    const invalidIndex = values.findIndex((value) => !isSafeAdminQueryValue(value));
    if (invalidIndex >= 0) {
      return adminRouteStateFailure(
        'INVALID_ADMIN_QUERY_VALUE',
        `$.state.${key}[${String(invalidIndex)}]`,
      );
    }
  }

  for (const [key, value] of [
    ['cursor', state.cursor],
    ['recordId', state.recordId],
    ['savedViewId', state.savedViewId],
    ['tab', state.tab],
  ] as const) {
    if (value !== undefined && !isSafeAdminQueryValue(value)) {
      return adminRouteStateFailure('INVALID_ADMIN_QUERY_VALUE', `$.state.${key}`);
    }
  }
  return deepFreeze({
    ok: true,
    value: {
      ...(state.cursor === undefined ? {} : { cursor: state.cursor }),
      ...(state.density === undefined ? {} : { density: state.density }),
      ...(state.filters === undefined ? {} : { filters: [...state.filters] }),
      ...(state.recordId === undefined ? {} : { recordId: state.recordId }),
      ...(state.savedViewId === undefined ? {} : { savedViewId: state.savedViewId }),
      ...(state.sort === undefined ? {} : { sort: [...state.sort] }),
      ...(state.tab === undefined ? {} : { tab: state.tab }),
    },
  });
};

export const encodeAdminRouteState = (
  state: AdminRouteState,
): AdminRouteStateResult<string> => {
  const admitted = validateAdminRouteState(state);
  if (!admitted.ok) return admitted;

  const entries: (readonly [string, string])[] = [];
  for (const value of admitted.value.filters ?? []) entries.push(['filter', value]);
  for (const value of admitted.value.sort ?? []) entries.push(['sort', value]);
  if (admitted.value.cursor !== undefined) entries.push(['cursor', admitted.value.cursor]);
  if (admitted.value.tab !== undefined) entries.push(['tab', admitted.value.tab]);
  if (admitted.value.savedViewId !== undefined) entries.push(['view', admitted.value.savedViewId]);
  if (admitted.value.density !== undefined) entries.push(['density', admitted.value.density]);
  if (admitted.value.recordId !== undefined) entries.push(['record', admitted.value.recordId]);
  return deepFreeze({ ok: true, value: encodeQuery(entries) });
};

export const decodeAdminRouteState = (query: string): AdminRouteStateResult => {
  if (query.length > 2048 || (query.length > 0 && !query.startsWith('?'))) {
    return adminRouteStateFailure('INVALID_ADMIN_QUERY', '$.query');
  }

  const parameters = new URLSearchParams(query.startsWith('?') ? query.slice(1) : query);
  for (const key of parameters.keys()) {
    if (!isOneOf(key, ADMIN_QUERY_KEYS)) {
      return adminRouteStateFailure('UNKNOWN_ADMIN_QUERY_KEY', `$.query.${key}`);
    }
    if (isOneOf(key, ADMIN_QUERY_SINGLETON_KEYS) && parameters.getAll(key).length !== 1) {
      return adminRouteStateFailure('INVALID_ADMIN_QUERY_VALUE', `$.query.${key}`);
    }
  }

  const filters = parameters.getAll('filter');
  const sort = parameters.getAll('sort');
  const density = parameters.get('density');
  if (density !== null && density !== 'comfortable' && density !== 'compact') {
    return adminRouteStateFailure('INVALID_ADMIN_QUERY_VALUE', '$.state.density');
  }
  return validateAdminRouteState({
    ...(parameters.has('cursor') ? { cursor: parameters.get('cursor') ?? '' } : {}),
    ...(density === null
      ? {}
      : { density }),
    ...(filters.length === 0 ? {} : { filters }),
    ...(parameters.has('record') ? { recordId: parameters.get('record') ?? '' } : {}),
    ...(parameters.has('view') ? { savedViewId: parameters.get('view') ?? '' } : {}),
    ...(sort.length === 0 ? {} : { sort }),
    ...(parameters.has('tab') ? { tab: parameters.get('tab') ?? '' } : {}),
  });
};

export const createBoundaryLink = (
  input: Readonly<{
    context: BoundaryContext;
    fromRouteId: string;
    toRouteId: string;
  }>,
): BoundaryLinkResult => {
  const fromRoute = routeById(input.fromRouteId);
  const toRoute = routeById(input.toRouteId);
  if (fromRoute === undefined) {
    return boundaryFailure('UNKNOWN_ROUTE_ID', '$.fromRouteId');
  }
  if (toRoute === undefined) {
    return boundaryFailure('UNKNOWN_ROUTE_ID', '$.toRouteId');
  }

  for (const key of Object.keys(input.context)) {
    if (!isOneOf(key, CONTEXT_KEYS)) {
      return boundaryFailure('UNSAFE_CONTEXT_KEY', `$.context.${key}`);
    }
    if (!hasSafeContextKey(toRoute, contextPermission[key])) {
      return boundaryFailure('UNSAFE_CONTEXT_KEY', `$.context.${key}`);
    }
  }

  if (!isOneOf(input.context.locale, WEB_LOCALES)) {
    return boundaryFailure('UNSAFE_LOCALE', '$.context.locale');
  }
  if (input.context.version !== undefined && !isOneOf(input.context.version, WEB_VERSIONS)) {
    return boundaryFailure('UNSAFE_VERSION', '$.context.version');
  }
  if (input.context.channel !== undefined && !isOneOf(input.context.channel, WEB_CHANNELS)) {
    return boundaryFailure('UNSAFE_CHANNEL', '$.context.channel');
  }
  if (
    input.context.section !== undefined &&
    !isOneOf(input.context.section, WEB_DOCUMENT_SECTIONS)
  ) {
    return boundaryFailure('UNSAFE_SECTION', '$.context.section');
  }

  if (input.context.requestedDestination !== undefined) {
    const destination = routeById(input.context.requestedDestination);
    if (destination?.surface !== toRoute.surface) {
      return boundaryFailure('UNSAFE_DESTINATION', '$.context.requestedDestination');
    }
  }

  if (input.context.returnRouteId !== undefined) {
    const returnRoute = routeById(input.context.returnRouteId);
    if (
      returnRoute?.surface !== 'public' ||
      returnRoute.indexing !== 'index' ||
      returnRoute.scenarioRequirement !== 'available'
    ) {
      return boundaryFailure('UNSAFE_RETURN_ROUTE', '$.context.returnRouteId');
    }
  }

  const targetParameters = templateParameters(toRoute.pathnameTemplate);
  const parameters: Record<string, string> = { locale: input.context.locale };
  if (input.context.version !== undefined && targetParameters.includes('version')) {
    parameters['version'] = input.context.version;
  }
  if (input.context.channel !== undefined && targetParameters.includes('channel')) {
    parameters['channel'] = input.context.channel;
  }
  if (input.context.section !== undefined && targetParameters.includes('section')) {
    parameters['section'] = input.context.section;
  }
  const href = routeHref(toRoute.id, parameters);
  if (!href.ok) {
    return boundaryFailure('UNSAFE_DESTINATION', '$.toRouteId');
  }

  const query: (readonly [string, string])[] = [];
  if (input.context.version !== undefined && !targetParameters.includes('version')) {
    query.push(['version', input.context.version]);
  }
  if (input.context.channel !== undefined && !targetParameters.includes('channel')) {
    query.push(['channel', input.context.channel]);
  }
  if (input.context.section !== undefined && !targetParameters.includes('section')) {
    query.push(['section', input.context.section]);
  }
  if (input.context.requestedDestination !== undefined) {
    query.push(['destination', input.context.requestedDestination]);
  }
  if (input.context.returnRouteId !== undefined) {
    query.push(['returnPath', input.context.returnRouteId]);
  }

  return deepFreeze({
    ok: true,
    value: {
      crossesBoundary: fromRoute.securityBoundary !== toRoute.securityBoundary,
      from: fromRoute.securityBoundary,
      href: `${WEB_ORIGINS[toRoute.securityBoundary]}${href.value}${encodeQuery(query)}`,
      preservedContext: deepFreeze({ ...input.context }),
      to: toRoute.securityBoundary,
    },
  });
};
