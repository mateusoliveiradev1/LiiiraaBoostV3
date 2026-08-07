import type {
  AdminAccessContextProjectionJson,
  AdminFreshnessStateJson,
  AdminGovernanceProjectionJson,
  AdminInboxItemProjectionJson,
  AdminIncidentProjectionJson,
  AdminInvitationCapacityProjectionJson,
  AdminJobProjectionJson,
  AdminSeverityJson,
} from '@liiiraa/contracts-ts';
import type { WebLocale } from '@liiiraa/web-core';

import type { AdminAuthorityDocument } from '../admin-authority';

export type AdminBriefingAuthorityState = 'live' | 'reconnecting' | 'offline' | 'degraded';

export type AdminBriefingAction = Readonly<{
  capability: string;
  href: string;
  label: string;
}>;

export type AdminBriefingHandoff = Readonly<{
  escalation: 'none' | 'critical' | 'overdue';
  ownerReference: string;
  state: 'covered' | 'uncovered';
  substituteReference: string | null;
}>;

export type AdminBriefingPriority = Readonly<{
  action: AdminBriefingAction | null;
  context: string;
  deadlineAt: string | null;
  freshness: AdminFreshnessStateJson;
  handoff: AdminBriefingHandoff;
  id: string;
  kind: 'governance' | 'inbox' | 'incident' | 'job';
  severity: AdminSeverityJson;
  title: string;
  version: string;
}>;

export type AdminBriefingCapacity = Readonly<{
  action: AdminBriefingAction | null;
  activeCount?: number;
  activeLimit?: number;
  forecastExhaustionAt?: string;
  observedAt?: string;
  queuedCount?: number;
  status: 'live' | 'stale' | 'degraded' | 'unavailable';
  trend?: string;
}>;

export type AdminBriefingModel = Readonly<{
  activeFunction: string | null;
  connection: AdminBriefingAuthorityState;
  context: Readonly<{
    capacity: AdminBriefingCapacity;
    environment: Readonly<{ id: string; kind: string; label: string }> | null;
    observedAt: string | null;
  }>;
  degradedCapabilities: readonly string[];
  priorities: readonly AdminBriefingPriority[];
  statement: string;
  status: 'live' | 'stale' | 'offline' | 'degraded';
}>;

export type AdminBriefingInput = Readonly<{
  authorityState: AdminBriefingAuthorityState;
  locale: WebLocale;
  now: string;
  queueState: Readonly<{ cursor?: string; view?: string }>;
  records: readonly AdminAuthorityDocument[];
  session?: Readonly<{
    activeFunction: string;
    actorId: string;
  }>;
}>;

const severityRank = Object.freeze({ critical: 0, warning: 1, information: 2 });

const isKind = <Kind extends AdminAuthorityDocument['kind']>(
  document: AdminAuthorityDocument,
  kind: Kind,
): document is Extract<AdminAuthorityDocument, Readonly<{ kind: Kind }>> => document.kind === kind;

const hasProjectionMetadata = (
  document: AdminAuthorityDocument,
): document is AdminAuthorityDocument &
  Pick<AdminAccessContextProjectionJson, 'environment' | 'freshness'> =>
  'environment' in document && 'freshness' in document;

const hrefFor = ({
  activeFunction,
  locale,
  path,
  queueState,
  version,
}: Readonly<{
  activeFunction: string;
  locale: WebLocale;
  path: string;
  queueState: AdminBriefingInput['queueState'];
  version: string;
}>): string => {
  const parameters = new URLSearchParams();
  parameters.set('function', activeFunction);
  if (queueState.view !== undefined) parameters.set('view', queueState.view);
  if (queueState.cursor !== undefined) parameters.set('cursor', queueState.cursor);
  parameters.set('version', version);
  return `/${locale}/admin/${path}?${parameters.toString()}`;
};

const copy = Object.freeze({
  en: Object.freeze({
    governance: 'Review governance request',
    incident: 'Open incident',
    inbox: 'Open priority',
    invitationCapacity: 'Manage invitation capacity',
    job: 'Open job',
    noPriority: 'No authorized priority work is waiting in this view.',
    priority: 'Current priority',
  }),
  'pt-BR': Object.freeze({
    governance: 'Revisar solicitação de governança',
    incident: 'Abrir incidente',
    inbox: 'Abrir prioridade',
    invitationCapacity: 'Gerenciar capacidade de convites',
    job: 'Abrir trabalho',
    noPriority: 'Nenhum trabalho prioritário autorizado aguarda nesta visão.',
    priority: 'Prioridade atual',
  }),
});

const escalationFor = (
  severity: AdminSeverityJson,
  deadlineAt: string | null,
  now: string,
): AdminBriefingHandoff['escalation'] => {
  if (deadlineAt !== null && Date.parse(deadlineAt) <= Date.parse(now)) return 'overdue';
  return severity === 'critical' ? 'critical' : 'none';
};

const handoffFor = ({
  deadlineAt,
  now,
  ownerReference,
  severity,
  substituteReference,
}: Readonly<{
  deadlineAt: string | null;
  now: string;
  ownerReference: string;
  severity: AdminSeverityJson;
  substituteReference: string | null;
}>): AdminBriefingHandoff =>
  Object.freeze({
    escalation: escalationFor(severity, deadlineAt, now),
    ownerReference,
    state: substituteReference === null ? 'uncovered' : 'covered',
    substituteReference,
  });

const authorizedAction = ({
  activeFunction,
  capabilities,
  capability,
  degradedCapabilities,
  href,
  label,
}: Readonly<{
  activeFunction: string | null;
  capabilities: ReadonlySet<string>;
  capability: string;
  degradedCapabilities: ReadonlySet<string>;
  href: string;
  label: string;
}>): AdminBriefingAction | null =>
  activeFunction !== null && capabilities.has(capability) && !degradedCapabilities.has(capability)
    ? Object.freeze({ capability, href, label })
    : null;

const freshnessFor = (document: AdminAuthorityDocument): AdminFreshnessStateJson =>
  'freshness' in document ? document.freshness.state : 'stale';

const projectInbox = ({
  access,
  capabilities,
  degradedCapabilities,
  input,
  record,
}: Readonly<{
  access: AdminAccessContextProjectionJson | null;
  capabilities: ReadonlySet<string>;
  degradedCapabilities: ReadonlySet<string>;
  input: AdminBriefingInput;
  record: AdminInboxItemProjectionJson;
}>): AdminBriefingPriority => {
  const labels = copy[input.locale];
  const path = `operation/queue/${encodeURIComponent(record.relatedRecordReference)}`;
  const href =
    access === null
      ? ''
      : hrefFor({
          activeFunction: access.activeFunction,
          locale: input.locale,
          path,
          queueState: input.queueState,
          version: record.aggregateVersion,
        });
  return Object.freeze({
    action: authorizedAction({
      activeFunction: access?.activeFunction ?? null,
      capabilities,
      capability: 'queue.review',
      degradedCapabilities,
      href,
      label: labels.inbox,
    }),
    context: record.relatedRecordReference,
    deadlineAt: record.deadlineAt ?? null,
    freshness: record.freshness.state,
    handoff: handoffFor({
      deadlineAt: record.deadlineAt ?? null,
      now: input.now,
      ownerReference: record.ownerReference ?? 'unassigned',
      severity: record.severity,
      substituteReference: null,
    }),
    id: record.inboxItemId,
    kind: 'inbox',
    severity: record.severity,
    title: record.title,
    version: record.aggregateVersion,
  });
};

const projectIncident = ({
  access,
  capabilities,
  degradedCapabilities,
  input,
  record,
}: Readonly<{
  access: AdminAccessContextProjectionJson | null;
  capabilities: ReadonlySet<string>;
  degradedCapabilities: ReadonlySet<string>;
  input: AdminBriefingInput;
  record: AdminIncidentProjectionJson;
}>): AdminBriefingPriority => {
  const labels = copy[input.locale];
  const href =
    access === null
      ? ''
      : hrefFor({
          activeFunction: access.activeFunction,
          locale: input.locale,
          path: `operation/incidents/${encodeURIComponent(record.incidentId)}`,
          queueState: input.queueState,
          version: record.aggregateVersion,
        });
  return Object.freeze({
    action: authorizedAction({
      activeFunction: access?.activeFunction ?? null,
      capabilities,
      capability: 'incident.review',
      degradedCapabilities,
      href,
      label: labels.incident,
    }),
    context: record.impactReferences.join(' · '),
    deadlineAt: record.nextUpdateAt,
    freshness: record.freshness.state,
    handoff: handoffFor({
      deadlineAt: record.nextUpdateAt,
      now: input.now,
      ownerReference: record.ownerReference,
      severity: record.severity,
      substituteReference: record.substituteReference,
    }),
    id: record.incidentId,
    kind: 'incident',
    severity: record.severity,
    title: record.title,
    version: record.aggregateVersion,
  });
};

const governanceSeverity = (record: AdminGovernanceProjectionJson): AdminSeverityJson =>
  record.risk === 'critical' || record.risk === 'irreversible'
    ? 'critical'
    : record.risk === 'high' || record.risk === 'medium'
      ? 'warning'
      : 'information';

const projectGovernance = ({
  access,
  capabilities,
  degradedCapabilities,
  input,
  record,
}: Readonly<{
  access: AdminAccessContextProjectionJson | null;
  capabilities: ReadonlySet<string>;
  degradedCapabilities: ReadonlySet<string>;
  input: AdminBriefingInput;
  record: AdminGovernanceProjectionJson;
}>): AdminBriefingPriority => {
  const labels = copy[input.locale];
  const severity = governanceSeverity(record);
  const href =
    access === null
      ? ''
      : hrefFor({
          activeFunction: access.activeFunction,
          locale: input.locale,
          path: `security/approvals/${encodeURIComponent(record.governanceRecordId)}`,
          queueState: input.queueState,
          version: record.aggregateVersion,
        });
  return Object.freeze({
    action: authorizedAction({
      activeFunction: access?.activeFunction ?? null,
      capabilities,
      capability: 'approval.review',
      degradedCapabilities,
      href,
      label: labels.governance,
    }),
    context: record.impactedReferences.join(' · '),
    deadlineAt: record.expiresAt ?? null,
    freshness: record.freshness.state,
    handoff: handoffFor({
      deadlineAt: record.expiresAt ?? null,
      now: input.now,
      ownerReference: record.authorReference,
      severity,
      substituteReference: record.eligibleApproverReferences[0] ?? null,
    }),
    id: record.governanceRecordId,
    kind: 'governance',
    severity,
    title: `${record.governanceKind} · ${record.risk}`,
    version: record.aggregateVersion,
  });
};

const jobSeverity = (record: AdminJobProjectionJson): AdminSeverityJson =>
  record.state === 'failed'
    ? 'critical'
    : record.state === 'partial' || record.failedItems > 0
      ? 'warning'
      : 'information';

const projectJob = ({
  access,
  capabilities,
  degradedCapabilities,
  input,
  record,
}: Readonly<{
  access: AdminAccessContextProjectionJson | null;
  capabilities: ReadonlySet<string>;
  degradedCapabilities: ReadonlySet<string>;
  input: AdminBriefingInput;
  record: AdminJobProjectionJson;
}>): AdminBriefingPriority => {
  const labels = copy[input.locale];
  const severity = jobSeverity(record);
  const href =
    access === null
      ? ''
      : hrefFor({
          activeFunction: access.activeFunction,
          locale: input.locale,
          path: `operation/jobs/${encodeURIComponent(record.jobId)}`,
          queueState: input.queueState,
          version: record.aggregateVersion,
        });
  return Object.freeze({
    action: authorizedAction({
      activeFunction: access?.activeFunction ?? null,
      capabilities,
      capability: 'job.review',
      degradedCapabilities,
      href,
      label: labels.job,
    }),
    context: `${String(record.completedItems)}/${String(record.totalItems)}`,
    deadlineAt: record.startedAt ?? null,
    freshness: record.freshness.state,
    handoff: handoffFor({
      deadlineAt: null,
      now: input.now,
      ownerReference: record.ownerReference,
      severity,
      substituteReference: null,
    }),
    id: record.jobId,
    kind: 'job',
    severity,
    title: `${record.jobType} · ${record.state}`,
    version: record.aggregateVersion,
  });
};

const prioritySort = (
  actorId: string | null,
  left: AdminBriefingPriority,
  right: AdminBriefingPriority,
): number => {
  const severity = severityRank[left.severity] - severityRank[right.severity];
  if (severity !== 0) return severity;
  const leftDeadline =
    left.deadlineAt === null ? Number.POSITIVE_INFINITY : Date.parse(left.deadlineAt);
  const rightDeadline =
    right.deadlineAt === null ? Number.POSITIVE_INFINITY : Date.parse(right.deadlineAt);
  if (leftDeadline !== rightDeadline) return leftDeadline - rightDeadline;
  const leftAssigned = actorId !== null && left.handoff.ownerReference === actorId ? 0 : 1;
  const rightAssigned = actorId !== null && right.handoff.ownerReference === actorId ? 0 : 1;
  if (leftAssigned !== rightAssigned) return leftAssigned - rightAssigned;
  return left.id.localeCompare(right.id, 'en');
};

const projectCapacity = ({
  access,
  capabilities,
  degradedCapabilities,
  input,
  record,
}: Readonly<{
  access: AdminAccessContextProjectionJson | null;
  capabilities: ReadonlySet<string>;
  degradedCapabilities: ReadonlySet<string>;
  input: AdminBriefingInput;
  record: AdminInvitationCapacityProjectionJson | null;
}>): AdminBriefingCapacity => {
  if (record === null) return Object.freeze({ action: null, status: 'unavailable' });
  const isStale = record.freshness.state !== 'live' || input.authorityState !== 'live';
  const isDegraded = degradedCapabilities.has('invitation.delivery');
  const href =
    access === null
      ? ''
      : hrefFor({
          activeFunction: access.activeFunction,
          locale: input.locale,
          path: 'people/invitations',
          queueState: input.queueState,
          version: record.aggregateVersion,
        });
  return Object.freeze({
    action:
      isStale || isDegraded
        ? null
        : authorizedAction({
            activeFunction: access?.activeFunction ?? null,
            capabilities,
            capability: 'invitation.delivery',
            degradedCapabilities,
            href,
            label: copy[input.locale].invitationCapacity,
          }),
    activeCount: record.activeCount,
    activeLimit: record.activeLimit,
    ...(record.forecastExhaustionAt === undefined
      ? {}
      : { forecastExhaustionAt: record.forecastExhaustionAt }),
    observedAt: record.freshness.observedAt,
    queuedCount: record.queuedCount,
    status: isStale ? 'stale' : isDegraded ? 'degraded' : 'live',
  });
};

const overallStatus = (
  state: AdminBriefingAuthorityState,
  records: readonly AdminAuthorityDocument[],
): AdminBriefingModel['status'] => {
  if (state === 'offline') return 'offline';
  if (state === 'degraded') return 'degraded';
  if (state === 'reconnecting' || records.some((record) => freshnessFor(record) !== 'live')) {
    return 'stale';
  }
  return 'live';
};

export const projectAdminBriefing = (input: AdminBriefingInput): AdminBriefingModel => {
  const access =
    input.records.find((record) => isKind(record, 'admin-access-context-projection')) ?? null;
  const contextRecord = input.records.find(hasProjectionMetadata) ?? null;
  const activeFunction = access?.activeFunction ?? input.session?.activeFunction ?? null;
  const actorId = access?.actorId ?? input.session?.actorId ?? null;
  const environment = access?.environment ?? contextRecord?.environment ?? null;
  const observedAt = access?.freshness.observedAt ?? contextRecord?.freshness.observedAt ?? null;
  const capabilities = new Set(access?.capabilities ?? []);
  const activeIncidents = input.records.filter(
    (record): record is AdminIncidentProjectionJson =>
      isKind(record, 'admin-incident-projection') &&
      record.state !== 'resolved' &&
      record.state !== 'review',
  );
  const degradedCapabilities = new Set(
    activeIncidents.flatMap((record) => record.affectedCapabilities),
  );
  const priorities = input.records.flatMap((record): readonly AdminBriefingPriority[] => {
    if (isKind(record, 'admin-inbox-item-projection') && record.state !== 'resolved') {
      return [projectInbox({ access, capabilities, degradedCapabilities, input, record })];
    }
    if (isKind(record, 'admin-incident-projection') && record.state !== 'resolved') {
      return [projectIncident({ access, capabilities, degradedCapabilities, input, record })];
    }
    if (isKind(record, 'admin-governance-projection') && record.state === 'pending') {
      return [projectGovernance({ access, capabilities, degradedCapabilities, input, record })];
    }
    if (
      isKind(record, 'admin-job-projection') &&
      ['queued', 'running', 'paused', 'partial', 'failed'].includes(record.state)
    ) {
      return [projectJob({ access, capabilities, degradedCapabilities, input, record })];
    }
    return [];
  });
  priorities.sort((left, right) => prioritySort(actorId, left, right));
  const capacityRecord =
    input.records.find((record) => isKind(record, 'admin-invitation-capacity-projection')) ?? null;
  const topPriority = priorities[0];
  return Object.freeze({
    activeFunction,
    connection: input.authorityState,
    context: Object.freeze({
      capacity: projectCapacity({
        access,
        capabilities,
        degradedCapabilities,
        input,
        record: capacityRecord,
      }),
      environment:
        environment === null
          ? null
          : Object.freeze({
              id: environment.environmentId,
              kind: environment.kind,
              label: environment.label,
            }),
      observedAt,
    }),
    degradedCapabilities: Object.freeze([...degradedCapabilities].sort()),
    priorities: Object.freeze(priorities),
    statement:
      topPriority === undefined
        ? copy[input.locale].noPriority
        : `${copy[input.locale].priority}: ${topPriority.title}`,
    status: overallStatus(input.authorityState, input.records),
  });
};
