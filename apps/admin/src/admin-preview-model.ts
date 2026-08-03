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

export const ADMIN_QUEUE_SAVED_VIEWS = Object.freeze([
  'assigned',
  'sla-risk',
  'unowned',
  'all-permitted',
] as const);
export const ADMIN_QUEUE_PRIORITIES = Object.freeze(['critical', 'high', 'normal', 'low'] as const);
export const ADMIN_QUEUE_STATUSES = Object.freeze([
  'attention',
  'waiting',
  'blocked',
  'stable',
] as const);
export const ADMIN_QUEUE_OWNERS = Object.freeze(['all', 'mine', 'unassigned'] as const);

export type AdminQueueSavedView = (typeof ADMIN_QUEUE_SAVED_VIEWS)[number];
export type AdminQueuePriority = (typeof ADMIN_QUEUE_PRIORITIES)[number];
export type AdminQueueStatus = (typeof ADMIN_QUEUE_STATUSES)[number];
export type AdminQueueOwnerFilter = (typeof ADMIN_QUEUE_OWNERS)[number];

export type AdminQueueUrlState = Readonly<{
  owner: AdminQueueOwnerFilter;
  priority: AdminQueuePriority | 'all';
  query: string;
  savedView: AdminQueueSavedView;
  selectedId: string | undefined;
  status: AdminQueueStatus | 'all';
}>;

export type AdminQueueItem = Readonly<{
  age: string;
  hrefRouteId: Exclude<AdminPreviewRoute, 'admin-role'>;
  id: string;
  lastEvent: string;
  owner: string;
  priority: AdminQueuePriority;
  redactedTarget: string;
  sla: string;
  status: AdminQueueStatus;
  summary: string;
}>;

type LocalizedQueueText = Readonly<Record<WebLocale, string>>;
type AdminQueueRecord = Readonly<{
  ageMinutes: number;
  auditEventId: string;
  hrefRouteId: AdminQueueItem['hrefRouteId'];
  id: string;
  lastEvent: LocalizedQueueText;
  owner: string | null;
  permittedRoles: readonly AdminPreviewRole[];
  priority: AdminQueuePriority;
  redactedTarget: LocalizedQueueText;
  slaMinutes: number | null;
  status: AdminQueueStatus;
  summary: LocalizedQueueText;
}>;

const ADMIN_QUEUE_RECORDS = Object.freeze([
  {
    ageMinutes: 14,
    auditEventId: 'admin-event-001',
    hrefRouteId: 'admin-support',
    id: 'SUP-2048',
    lastEvent: {
      en: 'Support response draft prepared',
      'pt-BR': 'Rascunho da resposta de suporte preparado',
    },
    owner: 'support.operator',
    permittedRoles: ['support'],
    priority: 'high',
    redactedTarget: { en: 'Customer ••••-042', 'pt-BR': 'Cliente ••••-042' },
    slaMinutes: 46,
    status: 'waiting',
    summary: {
      en: 'Startup guidance after a Windows update',
      'pt-BR': 'Orientação de inicialização após atualização do Windows',
    },
  },
  {
    ageMinutes: 51,
    auditEventId: 'admin-event-003',
    hrefRouteId: 'admin-operations',
    id: 'OPS-117',
    lastEvent: {
      en: 'Manifest mismatch confirmed',
      'pt-BR': 'Divergência do manifesto confirmada',
    },
    owner: 'operations.operator',
    permittedRoles: ['operations'],
    priority: 'critical',
    redactedTarget: { en: 'Release ••••-017', 'pt-BR': 'Versão ••••-017' },
    slaMinutes: 9,
    status: 'blocked',
    summary: {
      en: 'Publication remains held pending integrity evidence',
      'pt-BR': 'Publicação retida enquanto aguarda evidência de integridade',
    },
  },
  {
    ageMinutes: 38,
    auditEventId: 'admin-event-004',
    hrefRouteId: 'admin-security',
    id: 'SEC-083',
    lastEvent: {
      en: 'Containment retry evidence recorded',
      'pt-BR': 'Evidência de repetição da contenção registrada',
    },
    owner: 'security.operator',
    permittedRoles: ['security'],
    priority: 'critical',
    redactedTarget: { en: 'Session ••••-083', 'pt-BR': 'Sessão ••••-083' },
    slaMinutes: 22,
    status: 'attention',
    summary: {
      en: 'Containment review requires retry evidence',
      'pt-BR': 'Revisão de contenção requer evidência de repetição',
    },
  },
  {
    ageMinutes: 23,
    auditEventId: 'admin-event-002',
    hrefRouteId: 'admin-diagnostics',
    id: 'DIA-015',
    lastEvent: {
      en: 'Consent scope review recorded',
      'pt-BR': 'Revisão do escopo de consentimento registrada',
    },
    owner: 'security.operator',
    permittedRoles: ['security'],
    priority: 'normal',
    redactedTarget: { en: 'Diagnostic ••••-015', 'pt-BR': 'Diagnóstico ••••-015' },
    slaMinutes: 97,
    status: 'waiting',
    summary: {
      en: 'Diagnostic fields remain closed pending consent match',
      'pt-BR': 'Campos de diagnóstico fechados até validar o consentimento',
    },
  },
  {
    ageMinutes: 67,
    auditEventId: 'admin-event-003',
    hrefRouteId: 'admin-audit-event',
    id: 'AUD-204',
    lastEvent: {
      en: 'Immutable event admitted',
      'pt-BR': 'Evento imutável admitido',
    },
    owner: 'audit.operator',
    permittedRoles: ['audit'],
    priority: 'high',
    redactedTarget: { en: 'Release ••••-017', 'pt-BR': 'Versão ••••-017' },
    slaMinutes: 53,
    status: 'stable',
    summary: {
      en: 'Verify the publication-hold audit chain',
      'pt-BR': 'Verificar a cadeia de auditoria da retenção',
    },
  },
  {
    ageMinutes: 11,
    auditEventId: 'admin-event-001',
    hrefRouteId: 'admin-audit',
    id: 'AUD-221',
    lastEvent: {
      en: 'Ownership review requested',
      'pt-BR': 'Revisão de responsável solicitada',
    },
    owner: null,
    permittedRoles: ['audit'],
    priority: 'normal',
    redactedTarget: { en: 'Customer ••••-042', 'pt-BR': 'Cliente ••••-042' },
    slaMinutes: 119,
    status: 'attention',
    summary: {
      en: 'Assign an owner to the support audit event',
      'pt-BR': 'Atribuir responsável ao evento de auditoria de suporte',
    },
  },
] as const satisfies readonly AdminQueueRecord[]);

const ADMIN_QUEUE_QUERY_LIMIT = 64;
const ADMIN_QUEUE_ID_PATTERN = /^(?:SUP|OPS|SEC|DIA|AUD)-\d{3,4}$/u;
const ADMIN_QUEUE_QUERY_PATTERN = /^[\p{L}\p{N} ._-]*$/u;

const isMember = <Value extends string>(values: readonly Value[], value: string): value is Value =>
  values.includes(value as Value);

const admitQueueQuery = (value: string | null): string => {
  const query = value?.trim() ?? '';
  return query.length <= ADMIN_QUEUE_QUERY_LIMIT && ADMIN_QUEUE_QUERY_PATTERN.test(query)
    ? query
    : '';
};

type QueueStateReader = Readonly<{ get: (name: string) => string | null }>;

export const parseAdminQueueUrlState = (parameters: QueueStateReader): AdminQueueUrlState => {
  const savedView = parameters.get('view') ?? '';
  const priority = parameters.get('priority') ?? '';
  const status = parameters.get('status') ?? '';
  const owner = parameters.get('owner') ?? '';
  const selectedId = parameters.get('selected') ?? '';

  return Object.freeze({
    owner: isMember(ADMIN_QUEUE_OWNERS, owner) ? owner : 'all',
    priority: isMember(ADMIN_QUEUE_PRIORITIES, priority) ? priority : 'all',
    query: admitQueueQuery(parameters.get('q')),
    savedView: isMember(ADMIN_QUEUE_SAVED_VIEWS, savedView) ? savedView : 'assigned',
    selectedId: ADMIN_QUEUE_ID_PATTERN.test(selectedId) ? selectedId : undefined,
    status: isMember(ADMIN_QUEUE_STATUSES, status) ? status : 'all',
  });
};

const appendQueueState = (parameters: URLSearchParams, state: AdminQueueUrlState): void => {
  if (state.query) parameters.set('q', state.query);
  if (state.savedView !== 'assigned') parameters.set('view', state.savedView);
  if (state.priority !== 'all') parameters.set('priority', state.priority);
  if (state.status !== 'all') parameters.set('status', state.status);
  if (state.owner !== 'all') parameters.set('owner', state.owner);
  if (state.selectedId) parameters.set('selected', state.selectedId);
};

export const createAdminQueueHref = (
  href: string,
  role: AdminPreviewRole,
  state: AdminQueueUrlState,
  override: Partial<AdminQueueUrlState> = {},
): string => {
  const pathname = href.split('?')[0] ?? href;
  const parameters = new URLSearchParams();
  if (role !== 'support') parameters.set('role', role);
  appendQueueState(parameters, Object.freeze({ ...state, ...override }));
  const query = parameters.toString();
  return query ? `${pathname}?${query}` : pathname;
};

type ProjectAdminQueueInput = Readonly<{
  locale: WebLocale;
  owner?: AdminQueueOwnerFilter;
  priority?: AdminQueuePriority | 'all';
  query?: string;
  role: AdminPreviewRole;
  savedView?: AdminQueueSavedView;
  status?: AdminQueueStatus | 'all';
}>;

const priorityRank: Readonly<Record<AdminQueuePriority, number>> = Object.freeze({
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
});

const localizeAge = (locale: WebLocale, minutes: number): string =>
  locale === 'pt-BR' ? `${minutes} min` : `${minutes} min`;

const localizeSla = (locale: WebLocale, minutes: number | null): string => {
  if (minutes === null) return locale === 'pt-BR' ? 'Sem prazo' : 'No deadline';
  return locale === 'pt-BR' ? `${minutes} min restantes` : `${minutes} min left`;
};

export const projectAdminQueue = ({
  locale,
  owner = 'all',
  priority = 'all',
  query = '',
  role,
  savedView = 'assigned',
  status = 'all',
}: ProjectAdminQueueInput): readonly AdminQueueItem[] => {
  // Role admission is deliberately the first operation. Search and filters never see denied rows.
  const roleAdmitted = ADMIN_QUEUE_RECORDS.filter(({ permittedRoles }) =>
    (permittedRoles as readonly AdminPreviewRole[]).includes(role),
  );
  const admittedQuery = admitQueueQuery(query);
  const normalizedQuery = admittedQuery.toLocaleLowerCase(locale);
  const searched = normalizedQuery
    ? roleAdmitted.filter((record) =>
        [
          record.id,
          record.auditEventId,
          record.redactedTarget[locale],
          record.summary[locale],
          record.lastEvent[locale],
        ].some((field) => field.toLocaleLowerCase(locale).includes(normalizedQuery)),
      )
    : roleAdmitted;
  const viewed = searched.filter((record) => {
    if (savedView === 'assigned' && record.owner === null) return false;
    if (savedView === 'sla-risk' && (record.slaMinutes === null || record.slaMinutes > 60))
      return false;
    if (savedView === 'unowned' && record.owner !== null) return false;
    return true;
  });
  const filtered = viewed.filter((record) => {
    if (priority !== 'all' && record.priority !== priority) return false;
    if (status !== 'all' && record.status !== status) return false;
    if (owner === 'mine' && record.owner !== `${role}.operator`) return false;
    if (owner === 'unassigned' && record.owner !== null) return false;
    return true;
  });

  return Object.freeze(
    [...filtered]
      .sort(
        (left, right) =>
          priorityRank[left.priority] - priorityRank[right.priority] ||
          (left.slaMinutes ?? Number.POSITIVE_INFINITY) -
            (right.slaMinutes ?? Number.POSITIVE_INFINITY) ||
          right.ageMinutes - left.ageMinutes ||
          left.id.localeCompare(right.id),
      )
      .map((record) =>
        Object.freeze({
          age: localizeAge(locale, record.ageMinutes),
          hrefRouteId: record.hrefRouteId,
          id: record.id,
          lastEvent: record.lastEvent[locale],
          owner: record.owner ?? (locale === 'pt-BR' ? 'Sem responsável' : 'Unassigned'),
          priority: record.priority,
          redactedTarget: record.redactedTarget[locale],
          sla: localizeSla(locale, record.slaMinutes),
          status: record.status,
          summary: record.summary[locale],
        }),
      ),
  );
};

export const searchAdminQueue = (
  input: Readonly<{
    locale: WebLocale;
    query: string;
    role: AdminPreviewRole;
  }>,
): readonly AdminQueueItem[] => {
  const admittedQuery = admitQueueQuery(input.query);
  if (input.query.trim() && !admittedQuery) return Object.freeze([]);
  return projectAdminQueue({
    ...input,
    owner: 'all',
    query: admittedQuery,
    savedView: 'all-permitted',
  });
};

export const selectAdminQueueItem = (
  queue: readonly AdminQueueItem[],
  selectedId: string | undefined,
): AdminQueueItem | undefined =>
  selectedId && ADMIN_QUEUE_ID_PATTERN.test(selectedId)
    ? queue.find(({ id }) => id === selectedId)
    : undefined;

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
