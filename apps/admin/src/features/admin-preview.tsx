'use client';

import { LbButton, LbTextArea, ProductIcon } from '@liiiraa/design-system';
import {
  PreviewWorkflow,
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
} from '@liiiraa/web-core';
import {
  createWebPreviewAuthority,
  getWebScenario,
  type WebScenarioId,
} from '@liiiraa/web-preview';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import type { AdminRole as AdminPreviewRole } from '../admin-runtime';
import adminEnJson from '../content/admin.en.json';
import adminPtBrJson from '../content/admin.pt-BR.json';
import {
  adminRoleCanAccess,
  createAdminQueueHref,
  parseAdminQueueUrlState,
  projectAdminQueue,
  selectAdminQueueItem,
  type AdminPreviewRoute,
} from '../admin-preview-model';
export type AdminPreviewState =
  | 'ready'
  | 'loading'
  | 'empty'
  | 'offline'
  | 'stale'
  | 'expired-session'
  | 'permission-denied'
  | 'partial-failure';

type AdminContent = Readonly<
  Omit<typeof adminEnJson, 'audit' | 'locale'> & {
    readonly audit: Readonly<
      Omit<typeof adminEnJson.audit, 'events'> & {
        readonly events: Readonly<
          Record<string, Readonly<{ readonly reason: string; readonly target: string }>>
        >;
      }
    >;
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

export const getAdminContent = (locale: WebLocale): AdminContent => ADMIN_CONTENT[locale];

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
  showProvenance = false,
  summary,
  title,
}: Readonly<{
  content: AdminContent;
  showProvenance?: boolean;
  summary: string;
  title: string;
}>) => (
  <RouteHeader
    actions={
      showProvenance ? (
        <span className="admin-protected-data">
          <ProductIcon name="lock" size={16} />
          {content.fixtureLabel}
        </span>
      ) : undefined
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
    actor: 'support.operator',
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
    actor: 'security.operator',
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
    actor: 'operations.operator',
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
    actor: 'security.operator',
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

const presentAuditEvent = (content: AdminContent, event: AdminAuditEvent) => {
  const eventCopy = content.audit.events[event.eventId] ?? {
    reason: content.locale === 'pt-BR' ? 'Motivo indisponível' : 'Reason unavailable',
    target: content.locale === 'pt-BR' ? 'Alvo indisponível' : 'Target unavailable',
  };
  const action =
    content.locale === 'pt-BR'
      ? {
          'admin.review': 'Revisão administrativa',
          'diagnostic.review': 'Revisão de diagnóstico',
          'support.review': 'Revisão de resposta de suporte',
        }[event.action]
      : {
          'admin.review': 'Administrative review',
          'diagnostic.review': 'Diagnostic review',
          'support.review': 'Support response review',
        }[event.action];

  return Object.freeze({
    action,
    reason: eventCopy.reason,
    result: content.locale === 'pt-BR' ? 'Sem alteração aplicada' : 'No change applied',
    role: Object.hasOwn(content.roles, event.role)
      ? content.roles[event.role as AdminPreviewRole]
      : content.locale === 'pt-BR'
        ? 'Função indisponível'
        : 'Role unavailable',
    target: eventCopy.target,
  });
};

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
  return (
    <PreviewWorkflow
      input={input}
      locale={locale}
      machine={machine}
      title={input.action.objectLabel}
    />
  );
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
  const presentation = presentAuditEvent(content, event);
  const fields = [
    [content.audit.actor, event.actor],
    [content.audit.role, presentation.role],
    [content.audit.action, presentation.action],
    [content.audit.target, presentation.target],
    [content.audit.reason, presentation.reason],
    [content.audit.consent, event.consentReference ?? content.audit.noConsent],
    [content.audit.timestamp, event.occurredAt],
    [content.audit.result, presentation.result],
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
    <article className="admin-decision admin-audit-timeline" data-admin-workspace="immutable audit">
      <FixtureHeader
        content={content}
        showProvenance={true}
        summary={content.audit.summary}
        title={content.audit.title}
      />
      <ResponsiveDataTable
        caption={content.audit.caption}
        columns={[
          { id: 'event', label: content.locale === 'pt-BR' ? 'Evento' : 'Event' },
          { id: 'actor', label: content.audit.actor, essential: false },
          { id: 'action', label: content.audit.action, essential: false },
          { id: 'result', label: content.audit.result, essential: false },
          { id: 'time', label: content.audit.timestamp, essential: false },
        ]}
        rows={visibleEvents.map((event) => {
          const presentation = presentAuditEvent(content, event);
          return {
            id: event.eventId,
            cells: {
              event: <code>{event.eventId}</code>,
              actor: <code>{event.actor}</code>,
              action: presentation.action,
              result: <StatusSignal label={presentation.result} state="preview" />,
              time: <time dateTime={event.occurredAt}>{event.occurredAt}</time>,
            },
            detail: <CorrelatedEventDetail content={content} event={event} />,
          };
        })}
      />
    </article>
  );
};

const DisconnectedAuthority = ({
  action,
  body,
  title,
}: Readonly<{ action: string; body: string; title: string }>) => (
  <section
    aria-labelledby="admin-disconnected-authority-title"
    className="admin-disconnected-authority"
    data-authority-action="unavailable"
    data-authority-state="disconnected"
  >
    <div>
      <StatusSignal label={title} state="unavailable" />
      <h2 id="admin-disconnected-authority-title">{title}</h2>
      <p>{body}</p>
    </div>
    <LbButton isDisabled>{action}</LbButton>
  </section>
);

export const SupportCaseWorkspace = ({
  content,
  viewportWidth,
}: Readonly<{ content: AdminContent; viewportWidth: number }>) => {
  const [response, setResponse] = useState(content.support.draftValue);
  const [cancelled, setCancelled] = useState(false);
  const [workflow, setWorkflow] = useState<PreviewWorkflowInput | null>(null);
  if (workflow !== null) {
    return <PreviewWorkflowRunner input={workflow} locale={content.locale} scenarioId="W14" />;
  }
  return (
    <article
      className="admin-decision"
      data-admin-grid="8-4"
      data-admin-workspace="role-scoped admin support"
      data-authority-state="disconnected"
    >
      <FixtureHeader
        content={content}
        summary={content.support.summary}
        title={content.support.title}
      />

      <section aria-labelledby="support-decision-title" className="admin-decision__context">
        <div>
          <p>{content.support.caseLabel}</p>
          <h2 id="support-decision-title">{content.support.decisionTitle}</h2>
          <p>{content.support.decisionBody}</p>
        </div>
        <StatusSignal label={content.support.status} state="warning" />
      </section>

      <section aria-labelledby="support-evidence-title" className="admin-decision__evidence">
        <h2 id="support-evidence-title">{content.support.evidenceTitle}</h2>
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
            <dd>{content.support.detail}</dd>
          </div>
        </dl>
      </section>

      <div className="admin-decision__workbench">
        <section aria-labelledby="support-response-title" className="admin-decision__editor">
          <h2 id="support-response-title">{content.support.responseLabel}</h2>
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
                      expiresAt: content.support.consentExpires,
                      granted: true,
                      permittedFields: ['case', 'response'],
                      purpose: content.support.purpose,
                      requestingActor: content.support.consentActor,
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
                        before: content.locale === 'pt-BR' ? 'Não revisado' : 'Unreviewed',
                        after: content.locale === 'pt-BR' ? 'Revisão delimitada' : 'Scoped review',
                      },
                      {
                        field: 'response',
                        label: content.support.responseLabel,
                        before: content.locale === 'pt-BR' ? 'Não enviada' : 'Not sent',
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
        </section>

        <aside aria-labelledby="support-constraints-title" className="admin-decision__constraints">
          <h2 id="support-constraints-title">{content.support.constraintsTitle}</h2>
          <p>{content.support.constraintsBody}</p>
          <dl>
            <div>
              <dt>{content.diagnostics.purposeLabel}</dt>
              <dd>{content.support.purpose}</dd>
            </div>
            <div>
              <dt>{content.diagnostics.fieldsLabel}</dt>
              <dd>
                <code>{content.support.permittedFields}</code>
              </dd>
            </div>
            <div>
              <dt>{content.diagnostics.expirationLabel}</dt>
              <dd>
                <time dateTime={content.support.consentExpires}>
                  {content.support.consentExpires}
                </time>
              </dd>
            </div>
            <div>
              <dt>{content.diagnostics.actorLabel}</dt>
              <dd>
                <code>{content.support.consentActor}</code>
              </dd>
            </div>
            <div>
              <dt>{content.diagnostics.auditLabel}</dt>
              <dd>
                <code>{content.support.consentAudit}</code>
              </dd>
            </div>
          </dl>
        </aside>
      </div>

      <DisconnectedAuthority
        action={content.support.authorityAction}
        body={content.support.authorityBody}
        title={content.support.authorityTitle}
      />

      <section aria-labelledby="support-audit-title" className="admin-decision__audit">
        <h2 id="support-audit-title">{content.support.auditTitle}</h2>
        <CorrelatedEventDetail content={content} event={ADMIN_AUDIT_EVENTS[0]} />
      </section>
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
    <div
      className="admin-high-risk-flow"
      data-high-risk-action="true"
      data-high-risk-sequence="evidence-impact-reauth-confirm-receipt"
    >
      <PurposeAndImpactReview
        action={action}
        content={content}
        impact={impact}
        purpose={purpose}
        target={target}
      />
      <p className="admin-high-risk-flow__availability" role="status">
        {content.operations.mobile}
      </p>
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
                  requestingActor: `${role}.operator`,
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
                    after: content.locale === 'pt-BR' ? 'Somente revisão' : 'Review only',
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
  );
};

export const OperationsReview = ({
  content,
  viewportWidth,
}: Readonly<{ content: AdminContent; viewportWidth: number }>) => (
  <article
    className="admin-decision admin-decision--critical"
    data-admin-grid="8-4"
    data-admin-workspace="operations"
    data-authority-state="disconnected"
  >
    <FixtureHeader
      content={content}
      summary={content.operations.summary}
      title={content.operations.title}
    />
    <section aria-labelledby="operations-decision-title" className="admin-decision__context">
      <div>
        <p>{content.operations.reviewLabel}</p>
        <h2 id="operations-decision-title">{content.operations.decisionTitle}</h2>
        <p>{content.operations.detail}</p>
      </div>
      <StatusSignal label={content.operations.state} state="warning" />
    </section>
    <section aria-labelledby="operations-evidence-title" className="admin-decision__evidence">
      <h2 id="operations-evidence-title">{content.operations.evidenceTitle}</h2>
      <dl>
        <div>
          <dt>{content.audit.target}</dt>
          <dd>
            <code>{content.operations.target}</code>
          </dd>
        </div>
        <div>
          <dt>{content.diagnostics.purposeLabel}</dt>
          <dd>{content.operations.purpose}</dd>
        </div>
        <div>
          <dt>{content.locale === 'pt-BR' ? 'Impacto' : 'Impact'}</dt>
          <dd>{content.operations.impact}</dd>
        </div>
      </dl>
    </section>
    <section aria-labelledby="operations-constraints-title" className="admin-decision__constraints">
      <h2 id="operations-constraints-title">{content.operations.constraintsTitle}</h2>
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
    </section>
    <DisconnectedAuthority
      action={content.operations.authorityAction}
      body={content.operations.authorityBody}
      title={content.operations.authorityTitle}
    />
    <section aria-labelledby="operations-audit-title" className="admin-decision__audit">
      <h2 id="operations-audit-title">{content.operations.auditTitle}</h2>
      <CorrelatedEventDetail content={content} event={ADMIN_AUDIT_EVENTS[2]} />
    </section>
  </article>
);

export const SecurityReview = ({
  content,
  viewportWidth,
}: Readonly<{ content: AdminContent; viewportWidth: number }>) => (
  <article
    className="admin-decision admin-decision--critical"
    data-admin-grid="8-4"
    data-admin-workspace="security"
    data-authority-state="disconnected"
  >
    <FixtureHeader
      content={content}
      summary={content.security.summary}
      title={content.security.title}
    />
    <section aria-labelledby="security-decision-title" className="admin-decision__context">
      <div>
        <p>{content.security.reviewLabel}</p>
        <h2 id="security-decision-title">{content.security.decisionTitle}</h2>
        <p>{content.security.detail}</p>
      </div>
      <StatusSignal label={content.security.state} state="warning" />
    </section>
    <section aria-labelledby="security-evidence-title" className="admin-decision__evidence">
      <h2 id="security-evidence-title">{content.security.evidenceTitle}</h2>
      <dl>
        <div>
          <dt>{content.audit.target}</dt>
          <dd>
            <code>{content.security.target}</code>
          </dd>
        </div>
        <div>
          <dt>{content.diagnostics.purposeLabel}</dt>
          <dd>{content.security.purpose}</dd>
        </div>
        <div>
          <dt>{content.locale === 'pt-BR' ? 'Impacto' : 'Impact'}</dt>
          <dd>{content.security.impact}</dd>
        </div>
      </dl>
    </section>
    <section aria-labelledby="security-constraints-title" className="admin-decision__constraints">
      <h2 id="security-constraints-title">{content.security.constraintsTitle}</h2>
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
    </section>
    <DisconnectedAuthority
      action={content.security.authorityAction}
      body={content.security.authorityBody}
      title={content.security.authorityTitle}
    />
    <section aria-labelledby="security-audit-title" className="admin-decision__audit">
      <h2 id="security-audit-title">{content.security.auditTitle}</h2>
      <CorrelatedEventDetail content={content} event={ADMIN_AUDIT_EVENTS[3]} />
    </section>
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
    <article
      className="admin-decision admin-decision--diagnostic"
      data-admin-grid="8-4"
      data-admin-workspace="consent-scoped diagnostics"
      data-consent-decision={decision}
    >
      <FixtureHeader
        content={content}
        summary={content.diagnostics.summary}
        title={content.diagnostics.title}
      />
      <section aria-labelledby="diagnostic-decision-title" className="admin-decision__context">
        <div>
          <p>{content.diagnostics.auditReference}</p>
          <h2 id="diagnostic-decision-title">
            {decision === 'allowed'
              ? content.locale === 'pt-BR'
                ? 'Revisão de diagnóstico admitida'
                : 'Diagnostic review admitted'
              : content.locale === 'pt-BR'
                ? 'O consentimento não admite esta revisão'
                : 'Consent does not admit this review'}
          </h2>
          <p>{content.diagnostics.denial}</p>
        </div>
        <StatusSignal
          label={
            decision === 'allowed'
              ? content.diagnostics.allowedTitle
              : content.diagnostics.blockedTitle
          }
          state={decision === 'allowed' ? 'preview' : 'error'}
        />
      </section>
      <div className="admin-diagnostic__scope">
        <ConsentScopePanel consent={consent} content={content} decision={decision} />
        {admittedConsent !== null ? (
          <section aria-labelledby="diagnostic-fields-title" className="admin-decision__evidence">
            <h2 id="diagnostic-fields-title">{content.diagnostics.allowedTitle}</h2>
            <dl>
              <div>
                <dt>startup-state</dt>
                <dd>
                  {content.locale === 'pt-BR'
                    ? 'Estado de inicialização disponível'
                    : 'Startup state available'}
                </dd>
              </div>
              <div>
                <dt>application-version</dt>
                <dd>
                  <code>1.0.0</code>
                </dd>
              </div>
            </dl>
            <div
              className="admin-high-risk-flow"
              data-high-risk-action="true"
              data-high-risk-sequence="evidence-impact-reauth-confirm-receipt"
            >
              <p className="admin-high-risk-flow__availability" role="status">
                {content.diagnostics.reflow}
              </p>
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
                        impact: content.diagnostics.impact,
                        label: content.diagnostics.allowedTitle,
                        purpose: admittedConsent.purpose,
                        review: [
                          {
                            field: 'diagnostic',
                            label: content.diagnostics.title,
                            before: content.locale === 'pt-BR' ? 'Bloqueado' : 'Blocked',
                            after:
                              content.locale === 'pt-BR' ? 'Revisão delimitada' : 'Scoped review',
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
      </div>
      <section aria-labelledby="diagnostic-audit-title" className="admin-decision__audit">
        <h2 id="diagnostic-audit-title">{content.audit.detailAction}</h2>
        <CorrelatedEventDetail content={content} event={ADMIN_AUDIT_EVENTS[1]} />
      </section>
    </article>
  );
};

const RoleLanding = ({
  content,
  role,
  state,
}: Readonly<{
  content: AdminContent;
  role: AdminPreviewRole;
  state: Extract<
    AdminPreviewState,
    'ready' | 'loading' | 'empty' | 'offline' | 'stale' | 'partial-failure'
  >;
}>) => {
  const searchParameters = useSearchParams();
  const queueState = parseAdminQueueUrlState(searchParameters);
  const roleHomeHref = hrefFor('admin-role', content.locale, role);
  const projectedQueue = projectAdminQueue({
    locale: content.locale,
    owner: queueState.owner,
    priority: queueState.priority,
    query: queueState.query,
    role,
    savedView: queueState.savedView,
    status: queueState.status,
  });
  const queue = state === 'empty' || state === 'loading' ? [] : projectedQueue;
  const selectedItem = selectAdminQueueItem(queue, queueState.selectedId);
  const stateMessage =
    state === 'loading'
      ? content.queue.loading
      : state === 'empty'
        ? content.queue.emptyBody
        : state === 'offline'
          ? content.queue.offline
          : state === 'stale'
            ? content.queue.stale
            : state === 'partial-failure'
              ? content.queue.partial
              : undefined;
  const savedViewLabels = {
    assigned: content.queue.savedViews.assigned,
    'sla-risk': content.queue.savedViews.slaRisk,
    unowned: content.queue.savedViews.unowned,
    'all-permitted': content.queue.savedViews.allPermitted,
  } as const;

  return (
    <article
      className="admin-landing"
      data-admin-role={role}
      data-admin-workspace="operational queue"
      data-focal-route="admin-role"
    >
      <header className="admin-landing__header">
        <div>
          <p>{content.roles[role]}</p>
          <h1>{content.queue.title}</h1>
          <p>{content.landing.summary}</p>
        </div>
        <span data-state="current">
          {savedViewLabels[queueState.savedView]} · {projectedQueue.length}
        </span>
      </header>

      <form action={roleHomeHref.split('?')[0]} className="admin-queue__filters" method="get">
        {role !== 'support' ? <input name="role" type="hidden" value={role} /> : null}
        {queueState.query ? <input name="q" type="hidden" value={queueState.query} /> : null}
        <label>
          <span>{content.queue.savedView}</span>
          <select defaultValue={queueState.savedView} name="view">
            <option value="assigned">{savedViewLabels.assigned}</option>
            <option value="sla-risk">{savedViewLabels['sla-risk']}</option>
            <option value="unowned">{savedViewLabels.unowned}</option>
            <option value="all-permitted">{savedViewLabels['all-permitted']}</option>
          </select>
        </label>
        <label>
          <span>{content.queue.priorityFilter}</span>
          <select defaultValue={queueState.priority} name="priority">
            <option value="all">{content.queue.all}</option>
            <option value="critical">{content.queue.priorityLabels.critical}</option>
            <option value="high">{content.queue.priorityLabels.high}</option>
            <option value="normal">{content.queue.priorityLabels.normal}</option>
            <option value="low">{content.queue.priorityLabels.low}</option>
          </select>
        </label>
        <label>
          <span>{content.queue.statusFilter}</span>
          <select defaultValue={queueState.status} name="status">
            <option value="all">{content.queue.all}</option>
            <option value="attention">{content.queue.statusLabels.attention}</option>
            <option value="waiting">{content.queue.statusLabels.waiting}</option>
            <option value="blocked">{content.queue.statusLabels.blocked}</option>
            <option value="stable">{content.queue.statusLabels.stable}</option>
          </select>
        </label>
        <label>
          <span>{content.queue.ownerFilter}</span>
          <select defaultValue={queueState.owner} name="owner">
            <option value="all">{content.queue.all}</option>
            <option value="mine">{content.queue.mine}</option>
            <option value="unassigned">{content.queue.unassigned}</option>
          </select>
        </label>
        <div className="admin-queue__filter-actions">
          <button type="submit">{content.queue.applyFilters}</button>
          <a
            href={createAdminQueueHref(
              roleHomeHref,
              role,
              parseAdminQueueUrlState(new URLSearchParams()),
            )}
          >
            {content.queue.clearFilters}
          </a>
        </div>
      </form>

      <div className="admin-landing__layout" data-admin-grid="8-4">
        <section
          aria-busy={state === 'loading'}
          aria-labelledby="admin-queue-title"
          className="admin-landing__queue"
        >
          <div className="admin-queue__heading">
            <h2 id="admin-queue-title">{content.queue.title}</h2>
            <span>{savedViewLabels[queueState.savedView]}</span>
          </div>
          {stateMessage ? (
            <div className="admin-queue__state" data-state={state} role="status">
              <ProductIcon name={state === 'loading' ? 'loading' : 'info'} size={18} />
              <span>{stateMessage}</span>
            </div>
          ) : null}
          {state === 'loading' ? (
            <div aria-hidden="true" className="admin-queue__skeleton">
              <span />
              <span />
              <span />
            </div>
          ) : queue.length === 0 ? (
            <div className="admin-queue__empty">
              <h3>{content.queue.emptyTitle}</h3>
              <p>{content.queue.emptyBody}</p>
            </div>
          ) : (
            <ResponsiveDataTable
              caption={content.queue.caption}
              columns={[
                { id: 'case', label: content.queue.case },
                { id: 'priority', label: content.queue.priority },
                { id: 'sla', label: content.queue.sla },
                { id: 'age', label: content.queue.age, essential: false },
                { id: 'owner', label: content.queue.owner, essential: false },
                { id: 'lastEvent', label: content.queue.lastEvent, essential: false },
                { id: 'status', label: content.queue.status, essential: false },
              ]}
              rows={queue.map((item) => {
                const isSelected = selectedItem?.id === item.id;
                const selectionHref = createAdminQueueHref(roleHomeHref, role, queueState, {
                  selectedId: item.id,
                });
                return {
                  id: item.id,
                  cells: {
                    case: (
                      <a aria-current={isSelected ? 'true' : undefined} href={selectionHref}>
                        <strong>{item.id}</strong>
                        <span>{item.summary}</span>
                      </a>
                    ),
                    priority: content.queue.priorityLabels[item.priority],
                    sla: item.sla,
                    age: item.age,
                    owner: item.owner,
                    lastEvent: item.lastEvent,
                    status: content.queue.statusLabels[item.status],
                  },
                  detail: (
                    <dl className="admin-landing__queue-detail">
                      <div>
                        <dt>{content.queue.case}</dt>
                        <dd>{item.id}</dd>
                      </div>
                      <div>
                        <dt>{content.queue.priority}</dt>
                        <dd>{content.queue.priorityLabels[item.priority]}</dd>
                      </div>
                      <div>
                        <dt>{content.queue.sla}</dt>
                        <dd>{item.sla}</dd>
                      </div>
                      <div>
                        <dt>{content.queue.age}</dt>
                        <dd>{item.age}</dd>
                      </div>
                      <div>
                        <dt>{content.queue.owner}</dt>
                        <dd>{item.owner}</dd>
                      </div>
                      <div>
                        <dt>{content.queue.lastEvent}</dt>
                        <dd>{item.lastEvent}</dd>
                      </div>
                      <div>
                        <dt>{content.queue.status}</dt>
                        <dd>{content.queue.statusLabels[item.status]}</dd>
                      </div>
                    </dl>
                  ),
                };
              })}
            />
          )}
        </section>

        <aside aria-labelledby="admin-queue-selection-title" className="admin-queue__selection">
          <p>{content.queue.selectionTitle}</p>
          {selectedItem ? (
            <>
              <h2 id="admin-queue-selection-title">{selectedItem.id}</h2>
              <p>{selectedItem.summary}</p>
              <dl className="admin-queue__selection-evidence">
                <div>
                  <dt>{content.queue.owner}</dt>
                  <dd>{selectedItem.owner}</dd>
                </div>
                <div>
                  <dt>{content.queue.status}</dt>
                  <dd>{content.queue.statusLabels[selectedItem.status]}</dd>
                </div>
                <div>
                  <dt>{content.audit.target}</dt>
                  <dd>{selectedItem.redactedTarget}</dd>
                </div>
                <div>
                  <dt>{content.queue.history}</dt>
                  <dd>{selectedItem.lastEvent}</dd>
                </div>
                <div>
                  <dt>{content.queue.consent}</dt>
                  <dd>{content.queue.consentGuarded}</dd>
                </div>
                <div>
                  <dt>{content.queue.impact}</dt>
                  <dd>{selectedItem.summary}</dd>
                </div>
                <div>
                  <dt>{content.queue.permittedAction}</dt>
                  <dd>{content.queue.permittedReview}</dd>
                </div>
              </dl>
              <p>{content.queue.selectionHint}</p>
              <a
                href={createAdminQueueHref(
                  hrefFor(selectedItem.hrefRouteId, content.locale, role),
                  role,
                  queueState,
                )}
              >
                {content.queue.open}
              </a>
            </>
          ) : (
            <>
              <h2 id="admin-queue-selection-title">{content.landing.scopeTitle}</h2>
              <p>{content.queue.selectionHint}</p>
            </>
          )}
        </aside>
      </div>
    </article>
  );
};

const DegradedAdminPreview = ({
  content,
  role,
  state,
}: Readonly<{
  content: AdminContent;
  role: AdminPreviewRole;
  state: Exclude<AdminPreviewState, 'ready'>;
}>) => {
  const message =
    state === 'loading'
      ? content.locale === 'pt-BR'
        ? 'Preparando a área segura da sua função.'
        : 'Preparing your secure role workspace.'
      : state === 'empty'
        ? content.locale === 'pt-BR'
          ? 'Não há itens atribuídos para revisar agora.'
          : 'There are no assigned items to review right now.'
        : state === 'offline'
          ? content.recovery.offline
          : state === 'stale'
            ? content.recovery.stale
            : state === 'expired-session'
              ? content.recovery.expired
              : state === 'permission-denied'
                ? content.recovery.permission
                : content.recovery.failure;
  const copy =
    content.locale === 'pt-BR'
      ? {
          affected: 'Capacidade afetada',
          blocked: 'Ação bloqueada',
          blockedBody:
            state === 'permission-denied'
              ? 'Fila, alvo, consentimento e auditoria permanecem ocultos para esta função.'
              : 'Confirmações administrativas permanecem bloqueadas até a recuperação.',
          preserved: 'Trabalho preservado',
          preservedBody:
            state === 'expired-session'
              ? 'A navegação da função permanece disponível; credenciais e rascunhos sensíveis foram descartados.'
              : 'A navegação da função e o contexto seguro continuam disponíveis.',
          recovery: 'Voltar à área da função',
        }
      : {
          affected: 'Affected capability',
          blocked: 'Blocked action',
          blockedBody:
            state === 'permission-denied'
              ? 'Queue, target, consent, and audit details remain hidden from this role.'
              : 'Administrative confirmations remain blocked until recovery.',
          preserved: 'Preserved work',
          preservedBody:
            state === 'expired-session'
              ? 'Role navigation remains available; credentials and sensitive drafts were discarded.'
              : 'Role navigation and safe context remain available.',
          recovery: 'Return to role workspace',
        };
  return (
    <article className="admin-degraded" data-admin-state={state}>
      <FixtureHeader content={content} summary={message} title={content.recovery.title} />
      <section className="admin-degraded__status" role="status">
        <StatusSignal label={message} state={state === 'permission-denied' ? 'error' : 'warning'} />
        <p>{message}</p>
      </section>
      <dl className="admin-degraded__facts">
        <div>
          <dt>{copy.affected}</dt>
          <dd>{message}</dd>
        </div>
        <div>
          <dt>{copy.preserved}</dt>
          <dd>{copy.preservedBody}</dd>
        </div>
        <div>
          <dt>{copy.blocked}</dt>
          <dd>{copy.blockedBody}</dd>
        </div>
      </dl>
      <a className="admin-degraded__recovery" href={hrefFor('admin-role', content.locale, role)}>
        <ProductIcon name="recovery" size={17} />
        {copy.recovery}
      </a>
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
    return <DegradedAdminPreview content={content} role={role} state="permission-denied" />;
  }
  if (routeId === 'admin-role') {
    if (state === 'expired-session' || state === 'permission-denied') {
      return <DegradedAdminPreview content={content} role={role} state={state} />;
    }
    return <RoleLanding content={content} role={role} state={state} />;
  }
  if (state !== 'ready')
    return <DegradedAdminPreview content={content} role={role} state={state} />;
  switch (routeId) {
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
