'use client';

import { LbButton, LbTextArea } from '@liiiraa/design-system';
import {
  PreviewBoundary,
  PreviewWorkflow,
  ProvenanceLabel,
  ResponsiveDataTable,
  RouteHeader,
  StatusSignal,
  createPreviewWorkflowMachine,
  type PreviewActionFamily,
  type PreviewRole,
  type PreviewWorkflowInput,
} from '@liiiraa/web-features';
import {
  routeHref,
  validateWebDocument,
  type WebDocumentValidationResult,
  type WebLocale,
  type WebRouteId,
} from '@liiiraa/web-core';
import {
  createWebPreviewAuthority,
  getWebScenario,
  type WebScenarioId,
} from '@liiiraa/web-preview';
import { useEffect, useMemo, useState } from 'react';

import type { AdminPreviewRole } from '../../proxy';
import adminEnJson from '../content/admin.en.json';
import adminPtBrJson from '../content/admin.pt-BR.json';

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
export type AdminPreviewState =
  'ready' | 'offline' | 'stale' | 'expired-session' | 'permission-denied' | 'partial-failure';

type AdminContent = Readonly<
  Omit<typeof adminEnJson, 'locale'> & {
    readonly locale: WebLocale;
  }
>;

type ValidatedWebDocument = Extract<WebDocumentValidationResult, { readonly ok: true }>['value'];
export type AdminAuditEvent = Extract<
  ValidatedWebDocument,
  { readonly eventId: string; readonly result: 'simulated-no-change' }
>;

export type DiagnosticConsent = Readonly<{
  actor: string;
  auditEventId: string;
  expiresAt: string;
  granted: boolean;
  permittedFields: readonly string[];
  purpose: string;
}>;

export type DiagnosticConsentDecision = 'allowed' | 'expired' | 'missing' | 'wrong-scope';

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const deepFreeze = <Value,>(value: Value, visited = new Set<object>()): Readonly<Value> => {
  if (typeof value !== 'object' || value === null || visited.has(value)) return value;
  visited.add(value);
  for (const child of Object.values(value)) deepFreeze(child, visited);
  return Object.freeze(value);
};

const hasSameContentShape = (candidate: unknown, reference: unknown): boolean => {
  if (Array.isArray(reference)) {
    return (
      Array.isArray(candidate) &&
      candidate.length > 0 &&
      candidate.every((entry) => typeof entry === 'string' && entry.trim().length > 0)
    );
  }
  if (isRecord(reference)) {
    if (!isRecord(candidate)) return false;
    const referenceKeys = Object.keys(reference).sort();
    const candidateKeys = Object.keys(candidate).sort();
    return (
      referenceKeys.length === candidateKeys.length &&
      referenceKeys.every((key, index) => key === candidateKeys[index]) &&
      referenceKeys.every((key) => hasSameContentShape(candidate[key], reference[key]))
    );
  }
  return (
    typeof candidate === typeof reference && (typeof candidate !== 'string' || candidate.length > 0)
  );
};

const admitAdminContent = (candidate: unknown, locale: WebLocale): AdminContent => {
  if (
    !isRecord(candidate) ||
    candidate['schemaVersion'] !== 1 ||
    candidate['locale'] !== locale ||
    !hasSameContentShape(candidate, adminEnJson)
  ) {
    throw new Error(`ADMIN_CONTENT_INVALID:${locale}`);
  }
  return deepFreeze(candidate) as AdminContent;
};

const ADMIN_CONTENT = deepFreeze({
  en: admitAdminContent(adminEnJson, 'en'),
  'pt-BR': admitAdminContent(adminPtBrJson, 'pt-BR'),
});

const ROLE_ROUTE_ACCESS = deepFreeze({
  support: ['admin-role', 'admin-support'],
  operations: ['admin-role', 'admin-operations', 'admin-audit'],
  security: ['admin-role', 'admin-security', 'admin-diagnostics', 'admin-audit'],
  audit: ['admin-role', 'admin-audit', 'admin-audit-event'],
} as const satisfies Readonly<Record<AdminPreviewRole, readonly AdminPreviewRoute[]>>);

export const getAdminContent = (locale: WebLocale): AdminContent => ADMIN_CONTENT[locale];

export const isAdminPreviewRoute = (routeId: WebRouteId): routeId is AdminPreviewRoute =>
  ADMIN_ENTRY_ROUTE_IDS.includes(routeId as AdminPreviewRoute);

export const adminRoleCanAccess = (role: AdminPreviewRole, routeId: AdminPreviewRoute): boolean =>
  ROLE_ROUTE_ACCESS[role].includes(routeId as never);

const routeMetadata = (content: AdminContent, routeId: AdminPreviewRoute) => {
  switch (routeId) {
    case 'admin-role':
      return content.landing;
    case 'admin-support':
      return content.support;
    case 'admin-operations':
      return content.operations;
    case 'admin-security':
      return content.security;
    case 'admin-diagnostics':
      return content.diagnostics;
    case 'admin-audit':
    case 'admin-audit-event':
      return content.audit;
  }
};

export const getAdminPreviewMetadata = (locale: WebLocale, routeId: AdminPreviewRoute) => {
  const metadata = routeMetadata(getAdminContent(locale), routeId);
  return Object.freeze({ summary: metadata.summary, title: metadata.title });
};

const hrefFor = (routeId: AdminPreviewRoute, locale: WebLocale, role: AdminPreviewRole): string => {
  const parameters: Record<string, string> = { locale };
  if (routeId === 'admin-support') parameters['caseId'] = 'case-preview';
  if (routeId === 'admin-operations' || routeId === 'admin-security') {
    parameters['reviewId'] = 'review-preview';
  }
  if (routeId === 'admin-diagnostics') parameters['diagnosticId'] = 'diagnostic-preview';
  if (routeId === 'admin-audit-event') parameters['eventId'] = 'event-preview';
  const result = routeHref(routeId, parameters);
  if (!result.ok) throw new Error(`ADMIN_ROUTE_UNAVAILABLE:${routeId}`);
  return role === 'support' ? result.value : `${result.value}?role=${role}`;
};

const FixtureHeader = ({
  content,
  summary,
  title,
}: Readonly<{ content: AdminContent; summary: string; title: string }>) => (
  <RouteHeader
    actions={
      <ProvenanceLabel detail={content.fixtureLabel} kind="simulated" locale={content.locale} />
    }
    description={summary}
    title={title}
  />
);

const staticReceipt = (
  scenarioId: 'W14' | 'W15' | 'W16',
  action: 'admin.review' | 'diagnostic.review' | 'support.review',
  correlationId: string,
) =>
  deepFreeze({
    receiptVersion: '1.0' as const,
    authority: {
      phase: 'Phase 4' as const,
      surface: 'admin' as const,
      command: action,
      description: 'Phase 4 admin authority',
    },
    requestedAction: action,
    reviewedInputs: ['target-reviewed'] as [string, ...string[]],
    reviewedAt: '2026-01-15T12:00:00.000Z',
    correlationId,
    provenance: {
      kind: 'fixture' as const,
      value: 'SIMULATED SCENARIO' as const,
      scenarioId,
      fixtureVersion: 'web-scenarios-v1' as const,
    },
    remoteStateChanged: false as const,
    nextPhase: 'Phase 4' as const,
  });

const createImmutableAuditEvent = (event: AdminAuditEvent): AdminAuditEvent => {
  const validation = validateWebDocument(event);
  if (!validation.ok) throw new Error(`ADMIN_AUDIT_EVENT_INVALID:${event.eventId}`);
  return deepFreeze(event);
};

export const ADMIN_AUDIT_EVENTS = deepFreeze([
  createImmutableAuditEvent({
    eventId: 'admin-event-001',
    actor: 'support.preview',
    role: 'support',
    action: 'support.review',
    redactedTarget: 'Customer target ••••-042',
    reason: 'Review a synthetic support response',
    consentReference: 'audit-consent-014',
    occurredAt: '2026-01-15T12:00:00.000Z',
    result: 'simulated-no-change',
    correlationId: 'W14-support-authority-1',
    receipt: staticReceipt('W14', 'support.review', 'W14-support-authority-1'),
  }),
  createImmutableAuditEvent({
    eventId: 'admin-event-002',
    actor: 'security.preview',
    role: 'security',
    action: 'diagnostic.review',
    redactedTarget: 'Diagnostic target ••••-015',
    reason: 'Record a blocked diagnostic consent review',
    consentReference: 'audit-consent-015',
    occurredAt: '2026-01-15T12:00:00.000Z',
    result: 'simulated-no-change',
    correlationId: 'W15-diagnostic-authority-1',
    receipt: staticReceipt('W15', 'diagnostic.review', 'W15-diagnostic-authority-1'),
  }),
  createImmutableAuditEvent({
    eventId: 'admin-event-003',
    actor: 'operations.preview',
    role: 'operations',
    action: 'admin.review',
    redactedTarget: 'Deployment target ••••-017',
    reason: 'Review a synthetic publication hold',
    occurredAt: '2026-01-15T12:00:00.000Z',
    result: 'simulated-no-change',
    correlationId: 'W16-admin-authority-1',
    receipt: staticReceipt('W16', 'admin.review', 'W16-admin-authority-1'),
  }),
  createImmutableAuditEvent({
    eventId: 'admin-event-004',
    actor: 'security.preview',
    role: 'security',
    action: 'admin.review',
    redactedTarget: 'Security target ••••-083',
    reason: 'Review a synthetic containment action',
    occurredAt: '2026-01-15T12:00:00.000Z',
    result: 'simulated-no-change',
    correlationId: 'W15-admin-authority-1',
    receipt: staticReceipt('W15', 'admin.review', 'W15-admin-authority-1'),
  }),
] as const);

export const evaluateDiagnosticConsent = (
  consent: DiagnosticConsent | null | undefined,
  requiredPurpose: string,
  requiredFields: readonly string[],
  now: string,
  requiredActor: string,
  requiredAuditEventId: string,
): DiagnosticConsentDecision => {
  if (consent?.granted !== true) return 'missing';
  if (
    Number.isNaN(Date.parse(consent.expiresAt)) ||
    Date.parse(consent.expiresAt) <= Date.parse(now)
  ) {
    return 'expired';
  }
  if (
    consent.purpose !== requiredPurpose ||
    consent.actor !== requiredActor ||
    consent.auditEventId !== requiredAuditEventId ||
    requiredFields.some((field) => !consent.permittedFields.includes(field)) ||
    consent.permittedFields.some((field) => !requiredFields.includes(field))
  ) {
    return 'wrong-scope';
  }
  return 'allowed';
};

const workflowInput = ({
  consent,
  family,
  fields,
  impact,
  label,
  purpose,
  review,
  role,
  safeDraftFields = [],
  viewportWidth,
}: Readonly<{
  consent?: PreviewWorkflowInput['consent'];
  family: PreviewActionFamily;
  fields: Readonly<Record<string, string>>;
  impact: string;
  label: string;
  purpose: string;
  review: PreviewWorkflowInput['review'];
  role: PreviewRole;
  safeDraftFields?: readonly string[];
  viewportWidth: number;
}>): PreviewWorkflowInput => ({
  action: { family, id: `${family}.review`, objectLabel: label, surface: 'admin' },
  ...(consent === undefined ? {} : { consent }),
  fields,
  impact,
  purpose,
  requiredFields: Object.keys(fields),
  review,
  role,
  safeDraftFields,
  viewport: { width: viewportWidth },
});

const PreviewWorkflowRunner = ({
  input,
  locale,
  scenarioId,
}: Readonly<{
  input: PreviewWorkflowInput;
  locale: WebLocale;
  scenarioId: WebScenarioId;
}>) => {
  const machine = useMemo(() => {
    const scenario = getWebScenario(scenarioId);
    const clock = () => scenario.clock;
    let cancellationIndex = 0;
    const authority = createWebPreviewAuthority({
      clock,
      correlationIds: Array.from(
        { length: 8 },
        (_, index) => `${scenario.id}-${input.action.family}-authority-${String(index + 1)}`,
      ),
      scenario,
    });
    return createPreviewWorkflowMachine({
      authority,
      clock,
      correlationId: () => {
        cancellationIndex += 1;
        return `${scenario.id}-${input.action.family}-cancel-${String(cancellationIndex)}`;
      },
    });
  }, [input.action.family, scenarioId]);
  return <PreviewWorkflow input={input} locale={locale} machine={machine} />;
};

const useViewportWidth = (fixedWidth?: number): number => {
  const [width, setWidth] = useState(fixedWidth ?? 1280);
  useEffect(() => {
    if (fixedWidth !== undefined) {
      setWidth(fixedWidth);
      return undefined;
    }
    const update = () => {
      setWidth(window.innerWidth);
    };
    update();
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
    };
  }, [fixedWidth]);
  return width;
};

export const AdminNoChangeReceipt = ({
  content,
  event,
}: Readonly<{ content: AdminContent; event: AdminAuditEvent }>) => (
  <section
    aria-labelledby={`${event.eventId}-receipt-title`}
    className="lb-web-receipt"
    data-immutable="true"
    data-remote-state-changed="false"
  >
    <StatusSignal label={content.receipt.title} state="preview" />
    <h2 id={`${event.eventId}-receipt-title`}>{content.receipt.title}</h2>
    <p>{content.receipt.body}</p>
    <dl>
      <div>
        <dt>{content.audit.receipt}</dt>
        <dd>
          <code>{event.receipt.correlationId}</code>
        </dd>
      </div>
      <div>
        <dt>{content.locale === 'pt-BR' ? 'Estado remoto alterado' : 'Remote state changed'}</dt>
        <dd>{content.locale === 'pt-BR' ? 'Não' : 'No'}</dd>
      </div>
    </dl>
  </section>
);

export const CorrelatedEventDetail = ({
  content,
  event,
}: Readonly<{ content: AdminContent; event: AdminAuditEvent }>) => {
  const fields = [
    [content.audit.actor, event.actor],
    [content.audit.role, event.role],
    [content.audit.action, event.action],
    [content.audit.target, event.redactedTarget],
    [content.audit.reason, event.reason],
    [content.audit.consent, event.consentReference ?? content.audit.noConsent],
    [content.audit.timestamp, event.occurredAt],
    [content.audit.result, event.result],
    [content.audit.correlation, event.correlationId],
  ] as const;
  return (
    <section aria-labelledby={`${event.eventId}-detail-title`} data-audit-event={event.eventId}>
      <h2 id={`${event.eventId}-detail-title`}>{content.audit.detailAction}</h2>
      <dl>
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>
              <code>{value}</code>
            </dd>
          </div>
        ))}
      </dl>
      <AdminNoChangeReceipt content={content} event={event} />
    </section>
  );
};

export const ImmutableAuditTimeline = ({
  content,
  role,
}: Readonly<{ content: AdminContent; role: AdminPreviewRole }>) => {
  const visibleEvents =
    role === 'audit'
      ? ADMIN_AUDIT_EVENTS
      : ADMIN_AUDIT_EVENTS.filter((event) => event.role === role);
  return (
    <article data-admin-workspace="immutable audit">
      <FixtureHeader
        content={content}
        summary={content.audit.summary}
        title={content.audit.title}
      />
      <ResponsiveDataTable
        caption={content.audit.caption}
        columns={[
          { id: 'event', label: content.locale === 'pt-BR' ? 'Evento' : 'Event' },
          { id: 'actor', label: content.audit.actor },
          { id: 'action', label: content.audit.action },
          { id: 'result', label: content.audit.result, essential: false },
          { id: 'time', label: content.audit.timestamp, essential: false },
        ]}
        rows={visibleEvents.map((event) => ({
          id: event.eventId,
          cells: {
            event: <code>{event.eventId}</code>,
            actor: <code>{event.actor}</code>,
            action: event.action,
            result: <StatusSignal label={event.result} state="preview" />,
            time: <time dateTime={event.occurredAt}>{event.occurredAt}</time>,
          },
          detail: <CorrelatedEventDetail content={content} event={event} />,
        }))}
      />
    </article>
  );
};

export const SupportCaseWorkspace = ({
  content,
  viewportWidth,
}: Readonly<{ content: AdminContent; viewportWidth: number }>) => {
  const [response, setResponse] = useState('I reviewed the synthetic startup evidence.');
  const [cancelled, setCancelled] = useState(false);
  const [workflow, setWorkflow] = useState<PreviewWorkflowInput | null>(null);
  if (workflow !== null) {
    return <PreviewWorkflowRunner input={workflow} locale={content.locale} scenarioId="W14" />;
  }
  return (
    <article data-admin-workspace="role-scoped admin support">
      <FixtureHeader
        content={content}
        summary={content.support.summary}
        title={content.support.title}
      />
      <PreviewBoundary description={content.support.summary} />
      <dl>
        <div>
          <dt>{content.support.caseLabel}</dt>
          <dd>{content.support.subject}</dd>
        </div>
        <div>
          <dt>{content.audit.target}</dt>
          <dd>
            <code>{content.support.target}</code>
          </dd>
        </div>
        <div>
          <dt>{content.audit.result}</dt>
          <dd>
            <StatusSignal label={content.support.status} state="preview" />
          </dd>
        </div>
      </dl>
      <p>{content.support.detail}</p>
      <LbTextArea
        description={content.support.responseHint}
        label={content.support.responseLabel}
        maxLength={600}
        onChange={(value) => {
          setCancelled(false);
          setResponse(value);
        }}
        value={response}
      />
      {cancelled ? <p role="status">{content.support.cancelled}</p> : null}
      <div role="group" aria-label={content.support.responseLabel}>
        <LbButton
          onPress={() => {
            setResponse('');
            setCancelled(true);
          }}
          variant="quiet"
        >
          {content.support.cancelAction}
        </LbButton>
        <LbButton
          isDisabled={response.trim().length === 0}
          onPress={() => {
            setWorkflow(
              workflowInput({
                consent: {
                  expiresAt: '2026-01-15T13:00:00.000Z',
                  granted: true,
                  permittedFields: ['case', 'response'],
                  purpose: content.support.purpose,
                  requestingActor: 'support.preview',
                },
                family: 'support',
                fields: { case: 'case-preview', response },
                impact: content.support.impact,
                label: content.support.reviewAction,
                purpose: content.support.purpose,
                review: [
                  {
                    field: 'case',
                    label: content.support.caseLabel,
                    before: 'Unreviewed',
                    after: 'Scoped review',
                  },
                  {
                    field: 'response',
                    label: content.support.responseLabel,
                    before: 'Not sent',
                    after: response,
                  },
                ],
                role: 'support',
                safeDraftFields: ['case'],
                viewportWidth,
              }),
            );
          }}
        >
          {content.support.reviewAction}
        </LbButton>
      </div>
      <CorrelatedEventDetail content={content} event={ADMIN_AUDIT_EVENTS[0]} />
    </article>
  );
};

export const PurposeAndImpactReview = ({
  action,
  content,
  impact,
  purpose,
  target,
}: Readonly<{
  action: string;
  content: AdminContent;
  impact: string;
  purpose: string;
  target: string;
}>) => (
  <section aria-labelledby="purpose-impact-title" className="lb-web-boundary">
    <h2 id="purpose-impact-title">
      {content.locale === 'pt-BR' ? 'Finalidade e impacto' : 'Purpose and impact'}
    </h2>
    <dl>
      <div>
        <dt>{content.audit.action}</dt>
        <dd>{action}</dd>
      </div>
      <div>
        <dt>{content.audit.target}</dt>
        <dd>
          <code>{target}</code>
        </dd>
      </div>
      <div>
        <dt>{content.diagnostics.purposeLabel}</dt>
        <dd>{purpose}</dd>
      </div>
      <div>
        <dt>{content.locale === 'pt-BR' ? 'Impacto' : 'Impact'}</dt>
        <dd>{impact}</dd>
      </div>
    </dl>
  </section>
);

const CriticalReview = ({
  action,
  content,
  impact,
  purpose,
  role,
  scenarioId,
  target,
  viewportWidth,
}: Readonly<{
  action: string;
  content: AdminContent;
  impact: string;
  purpose: string;
  role: Extract<AdminPreviewRole, 'operations' | 'security'>;
  scenarioId: 'W15' | 'W16';
  target: string;
  viewportWidth: number;
}>) => {
  const [workflow, setWorkflow] = useState<PreviewWorkflowInput | null>(null);
  return (
    <>
      <PurposeAndImpactReview
        action={action}
        content={content}
        impact={impact}
        purpose={purpose}
        target={target}
      />
      <p className="admin-viewport-gate__mobile" id="admin-mobile-high-risk-block" role="status">
        {content.operations.mobile}
      </p>
      <div aria-describedby="admin-mobile-high-risk-block" data-high-risk-action="true">
        {workflow === null ? (
          <LbButton
            onPress={() => {
              setWorkflow(
                workflowInput({
                  consent: {
                    expiresAt: '2026-01-15T13:00:00.000Z',
                    granted: true,
                    permittedFields: ['target'],
                    purpose,
                    requestingActor: `${role}.preview`,
                  },
                  family: 'admin',
                  fields: { target: `${role}-target-preview` },
                  impact,
                  label: action,
                  purpose,
                  review: [
                    {
                      field: 'target',
                      label: content.audit.target,
                      before: target,
                      after: 'Review only',
                    },
                  ],
                  role,
                  viewportWidth,
                }),
              );
            }}
          >
            {action}
          </LbButton>
        ) : (
          <PreviewWorkflowRunner input={workflow} locale={content.locale} scenarioId={scenarioId} />
        )}
      </div>
    </>
  );
};

export const OperationsReview = ({
  content,
  viewportWidth,
}: Readonly<{ content: AdminContent; viewportWidth: number }>) => (
  <article data-admin-workspace="operations">
    <FixtureHeader
      content={content}
      summary={content.operations.summary}
      title={content.operations.title}
    />
    <StatusSignal label={content.operations.state} state="warning" />
    <p>{content.operations.detail}</p>
    <CriticalReview
      action={content.operations.action}
      content={content}
      impact={content.operations.impact}
      purpose={content.operations.purpose}
      role="operations"
      scenarioId="W16"
      target={content.operations.target}
      viewportWidth={viewportWidth}
    />
    <CorrelatedEventDetail content={content} event={ADMIN_AUDIT_EVENTS[2]} />
  </article>
);

export const SecurityReview = ({
  content,
  viewportWidth,
}: Readonly<{ content: AdminContent; viewportWidth: number }>) => (
  <article data-admin-workspace="security">
    <FixtureHeader
      content={content}
      summary={content.security.summary}
      title={content.security.title}
    />
    <StatusSignal label={content.security.state} state="warning" />
    <p>{content.security.detail}</p>
    <CriticalReview
      action={content.security.action}
      content={content}
      impact={content.security.impact}
      purpose={content.security.purpose}
      role="security"
      scenarioId="W15"
      target={content.security.target}
      viewportWidth={viewportWidth}
    />
    <CorrelatedEventDetail content={content} event={ADMIN_AUDIT_EVENTS[3]} />
  </article>
);

export const ConsentScopePanel = ({
  consent,
  content,
  decision,
}: Readonly<{
  consent: DiagnosticConsent | null | undefined;
  content: AdminContent;
  decision: DiagnosticConsentDecision;
}>) => (
  <section aria-labelledby="diagnostic-consent-title" className="lb-web-boundary">
    <StatusSignal
      label={
        decision === 'allowed' ? content.diagnostics.allowedTitle : content.diagnostics.blockedTitle
      }
      state={decision === 'allowed' ? 'preview' : 'error'}
    />
    <h2 id="diagnostic-consent-title">
      {decision === 'allowed' ? content.diagnostics.allowedTitle : content.diagnostics.blockedTitle}
    </h2>
    <p>{decision === 'allowed' ? content.diagnostics.summary : content.diagnostics.blockedBody}</p>
    <dl>
      <div>
        <dt>{content.diagnostics.purposeLabel}</dt>
        <dd>{consent?.purpose ?? content.diagnostics.requiredPurpose}</dd>
      </div>
      <div>
        <dt>{content.diagnostics.fieldsLabel}</dt>
        <dd>{(consent?.permittedFields ?? content.diagnostics.requiredFields).join(', ')}</dd>
      </div>
      <div>
        <dt>{content.diagnostics.expirationLabel}</dt>
        <dd>
          <time dateTime={consent?.expiresAt ?? content.diagnostics.expiration}>
            {consent?.expiresAt ?? content.diagnostics.expiration}
          </time>
        </dd>
      </div>
      <div>
        <dt>{content.diagnostics.actorLabel}</dt>
        <dd>
          <code>{consent?.actor ?? content.diagnostics.actor}</code>
        </dd>
      </div>
      <div>
        <dt>{content.diagnostics.auditLabel}</dt>
        <dd>
          <code>{consent?.auditEventId ?? content.diagnostics.auditReference}</code>
        </dd>
      </div>
    </dl>
  </section>
);

export const DiagnosticFieldDisclosure = ({
  consent,
  content,
  viewportWidth,
}: Readonly<{
  consent?: DiagnosticConsent | null;
  content: AdminContent;
  viewportWidth: number;
}>) => {
  const decision = evaluateDiagnosticConsent(
    consent,
    content.diagnostics.requiredPurpose,
    content.diagnostics.requiredFields,
    '2026-01-15T12:00:00.000Z',
    content.diagnostics.actor,
    content.diagnostics.auditReference,
  );
  const admittedConsent = decision === 'allowed' && consent != null ? consent : null;
  const [workflow, setWorkflow] = useState<PreviewWorkflowInput | null>(null);
  return (
    <article data-admin-workspace="consent-scoped diagnostics" data-consent-decision={decision}>
      <FixtureHeader
        content={content}
        summary={content.diagnostics.summary}
        title={content.diagnostics.title}
      />
      <ConsentScopePanel consent={consent} content={content} decision={decision} />
      {admittedConsent !== null ? (
        <section aria-labelledby="diagnostic-fields-title">
          <h2 id="diagnostic-fields-title">{content.diagnostics.allowedTitle}</h2>
          <dl>
            <div>
              <dt>startup-state</dt>
              <dd>
                <code>synthetic-ready</code>
              </dd>
            </div>
            <div>
              <dt>application-version</dt>
              <dd>
                <code>1.0.0-preview</code>
              </dd>
            </div>
          </dl>
          <div data-high-risk-action="true">
            {workflow === null ? (
              <LbButton
                onPress={() => {
                  setWorkflow(
                    workflowInput({
                      consent: {
                        expiresAt: admittedConsent.expiresAt,
                        granted: admittedConsent.granted,
                        permittedFields: admittedConsent.permittedFields,
                        purpose: admittedConsent.purpose,
                        requestingActor: admittedConsent.actor,
                      },
                      family: 'diagnostic',
                      fields: { diagnostic: 'diagnostic-preview' },
                      impact: content.diagnostics.denial,
                      label: content.diagnostics.allowedTitle,
                      purpose: admittedConsent.purpose,
                      review: [
                        {
                          field: 'diagnostic',
                          label: content.diagnostics.title,
                          before: 'Blocked',
                          after: 'Scoped synthetic review',
                        },
                      ],
                      role: 'security',
                      viewportWidth,
                    }),
                  );
                }}
              >
                {content.diagnostics.allowedTitle}
              </LbButton>
            ) : (
              <PreviewWorkflowRunner input={workflow} locale={content.locale} scenarioId="W15" />
            )}
          </div>
        </section>
      ) : (
        <p role="status">{content.diagnostics.denial}</p>
      )}
      <CorrelatedEventDetail content={content} event={ADMIN_AUDIT_EVENTS[1]} />
    </article>
  );
};

const RoleLanding = ({
  content,
  role,
}: Readonly<{ content: AdminContent; role: AdminPreviewRole }>) => (
  <article data-admin-workspace="role landing">
    <FixtureHeader
      content={content}
      summary={content.landing.summary}
      title={content.landing.title}
    />
    <PreviewBoundary description={content.landing.scopeBody} />
    <section aria-labelledby="admin-role-scope-title">
      <h2 id="admin-role-scope-title">{content.landing.scopeTitle}</h2>
      <ul>
        {ROLE_ROUTE_ACCESS[role].map((routeId) => (
          <li key={routeId}>
            <a href={hrefFor(routeId, content.locale, role)}>
              {getAdminPreviewMetadata(content.locale, routeId).title}
            </a>
          </li>
        ))}
      </ul>
    </section>
  </article>
);

const DegradedAdminPreview = ({
  content,
  state,
}: Readonly<{ content: AdminContent; state: Exclude<AdminPreviewState, 'ready'> }>) => {
  const message =
    state === 'offline'
      ? content.recovery.offline
      : state === 'stale'
        ? content.recovery.stale
        : state === 'expired-session'
          ? content.recovery.expired
          : state === 'permission-denied'
            ? content.recovery.permission
            : content.recovery.failure;
  return (
    <article data-admin-state={state}>
      <FixtureHeader content={content} summary={message} title={content.recovery.title} />
      <StatusSignal label={message} state={state === 'permission-denied' ? 'error' : 'warning'} />
      <p role="status">{content.recovery.safeDraft}</p>
      <PreviewBoundary description={content.receipt.body} />
    </article>
  );
};

export type AdminPreviewExperienceProps = Readonly<{
  diagnosticConsent?: DiagnosticConsent | null;
  locale: WebLocale;
  role: AdminPreviewRole;
  routeId: AdminPreviewRoute;
  state?: AdminPreviewState;
  viewportWidth?: number;
}>;

export const AdminPreviewExperience = ({
  diagnosticConsent,
  locale,
  role,
  routeId,
  state = 'ready',
  viewportWidth: fixedViewportWidth,
}: AdminPreviewExperienceProps) => {
  const content = getAdminContent(locale);
  const viewportWidth = useViewportWidth(fixedViewportWidth);
  if (!adminRoleCanAccess(role, routeId)) {
    return <DegradedAdminPreview content={content} state="permission-denied" />;
  }
  if (state !== 'ready') return <DegradedAdminPreview content={content} state={state} />;
  switch (routeId) {
    case 'admin-role':
      return <RoleLanding content={content} role={role} />;
    case 'admin-support':
      return <SupportCaseWorkspace content={content} viewportWidth={viewportWidth} />;
    case 'admin-operations':
      return <OperationsReview content={content} viewportWidth={viewportWidth} />;
    case 'admin-security':
      return <SecurityReview content={content} viewportWidth={viewportWidth} />;
    case 'admin-diagnostics':
      return (
        <DiagnosticFieldDisclosure
          {...(diagnosticConsent === undefined ? {} : { consent: diagnosticConsent })}
          content={content}
          viewportWidth={viewportWidth}
        />
      );
    case 'admin-audit':
      return <ImmutableAuditTimeline content={content} role={role} />;
    case 'admin-audit-event':
      return (
        <article data-admin-workspace="correlated audit event">
          <FixtureHeader
            content={content}
            summary={content.audit.summary}
            title={content.audit.title}
          />
          <CorrelatedEventDetail content={content} event={ADMIN_AUDIT_EVENTS[0]} />
        </article>
      );
  }
};

export const AdminPreviewPage = AdminPreviewExperience;
