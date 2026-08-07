import type {
  AdminAlertProjectionJson,
  AdminAuditEventProjectionJson,
  AdminCapacityProjectionJson,
  AdminConfigurationProjectionJson,
  AdminEmergencyStopProjectionJson,
  AdminEnvironmentProjectionJson,
  AdminExportProjectionJson,
  AdminIncidentProjectionJson,
  AdminJobProjectionJson,
  AdminOperationReceiptJson,
  AdminPrivacyCaseProjectionJson,
} from '@liiiraa/contracts-ts';
import type { Meta, StoryObj } from '@storybook/react-vite';

import type { AdminMutationResult } from '../admin-authority';
import {
  AdminOperationsSystemView,
  type OperationsSystemModel,
  type OperationsSystemSurface,
} from './admin-operations-system';

const observedAt = '2026-08-07T12:00:00.000Z';
const environment = Object.freeze({
  environmentId: 'staging-brasil',
  kind: 'staging' as const,
  label: 'Staging Brasil',
});
const freshness = Object.freeze({
  observedAt,
  sequence: '88',
  source: 'admin-operations',
  state: 'live' as const,
});
const common = Object.freeze({
  aggregateVersion: '7',
  correlationId: 'correlation-admin-operations-0001',
  environment,
  freshness,
  provenance: 'postgres-authority' as const,
  schemaVersion: '1.0' as const,
});

const jobs = Object.freeze([
  Object.freeze({
    ...common,
    completedItems: 42,
    etag: 'job-reconciliation-0001-v7',
    failedItems: 0,
    jobId: 'job-reconciliation-0001',
    jobType: 'reconciliation',
    kind: 'admin-job-projection',
    ownerReference: 'administrator-operations-0001',
    progressPercent: 70,
    startedAt: '2026-08-07T11:55:00.000Z',
    state: 'running',
    totalItems: 60,
  }),
  Object.freeze({
    ...common,
    aggregateVersion: '12',
    completedItems: 18,
    etag: 'job-export-0002-v12',
    failedItems: 2,
    jobId: 'job-configuration-export-0002',
    jobType: 'configuration-export',
    kind: 'admin-job-projection',
    ownerReference: 'administrator-operations-0001',
    progressPercent: 100,
    receiptReference: 'receipt-export-0002',
    startedAt: '2026-08-07T11:40:00.000Z',
    state: 'partial',
    totalItems: 20,
  }),
] satisfies readonly AdminJobProjectionJson[]);

const incidents = Object.freeze([
  Object.freeze({
    ...common,
    affectedCapabilities: ['invitation-delivery'] as [string],
    etag: 'incident-delivery-0001-v7',
    impactReferences: ['private-beta-invitations'] as [string],
    incidentId: 'incident-delivery-0001',
    kind: 'admin-incident-projection',
    nextUpdateAt: '2026-08-07T12:20:00.000Z',
    ownerReference: 'administrator-security-0001',
    severity: 'critical',
    state: 'open',
    substituteReference: 'administrator-operations-0002',
    title: 'Entrega de convites degradada na janela privada',
  }),
] satisfies readonly AdminIncidentProjectionJson[]);

const configurations = Object.freeze([
  Object.freeze({
    ...common,
    cohortReference: 'private-beta-brasil',
    configurationId: 'configuration-release-safety-0001',
    etag: 'configuration-release-safety-0001-v7',
    kind: 'admin-configuration-projection',
    rollbackVersion: '1.3.0',
    state: 'published',
    validationReference: 'validation-staging-0042',
    version: '1.4.0',
  }),
] satisfies readonly AdminConfigurationProjectionJson[]);

const privacyCases = Object.freeze([
  Object.freeze({
    ...common,
    dataCategoryReferences: ['account-profile', 'device-inventory'] as [string, string],
    etag: 'privacy-case-0001-v7',
    kind: 'admin-privacy-case-projection',
    legalBasisReference: 'lgpd-subject-request',
    ownerReference: 'administrator-privacy-0001',
    privacyCaseId: 'privacy-case-0001',
    requestType: 'access',
    retentionReferences: ['billing-audit-minimum'],
    state: 'approval-pending',
    subjectReference: 'account-redacted-0042',
  }),
] satisfies readonly AdminPrivacyCaseProjectionJson[]);

const emergencyStops = Object.freeze([
  Object.freeze({
    ...common,
    actorReference: 'administrator-security-0001',
    capabilityReference: 'invitation-delivery',
    etag: 'emergency-stop-0001-v7',
    expiresAt: '2026-08-07T12:15:00.000Z',
    kind: 'admin-emergency-stop-projection',
    reasonRedacted: 'Motivo restrito de contenção emergencial',
    requestedAt: '2026-08-07T11:58:00.000Z',
    safeRestorationDefined: true,
    state: 'active',
    stopId: 'emergency-stop-0001',
  }),
] satisfies readonly AdminEmergencyStopProjectionJson[]);

const capacity = Object.freeze([
  Object.freeze({
    ...common,
    capacityId: 'capacity-invitations-0001',
    currentUse: '18',
    etag: 'capacity-invitations-0001-v7',
    forecastExhaustionAt: '2026-08-12T20:00:00.000Z',
    growthPerDay: 1.4,
    kind: 'admin-capacity-projection',
    observedAt,
    recommendedAction: 'review-capacity',
    resourceReference: 'private-beta-invitations',
    safeLimit: '25',
  }),
  Object.freeze({
    ...common,
    capacityId: 'capacity-support-0002',
    currentUse: '6',
    etag: 'capacity-support-0002-v7',
    kind: 'admin-capacity-projection',
    observedAt,
    recommendedAction: 'none',
    resourceReference: 'support-active-cases',
    safeLimit: '40',
  }),
] satisfies readonly AdminCapacityProjectionJson[]);

const environments = Object.freeze([
  Object.freeze({
    ...common,
    environmentReference: 'staging-brasil',
    etag: 'environment-staging-brasil-v7',
    health: 'healthy',
    integrationEnvironment: 'staging',
    kind: 'admin-environment-projection',
    sessionEnvironment: 'staging',
    updatedAt: observedAt,
  }),
  Object.freeze({
    ...common,
    environmentReference: 'development-local',
    etag: 'environment-development-local-v7',
    health: 'degraded',
    integrationEnvironment: 'development',
    kind: 'admin-environment-projection',
    sessionEnvironment: 'development',
    updatedAt: observedAt,
  }),
] satisfies readonly AdminEnvironmentProjectionJson[]);

const audit = Object.freeze([
  Object.freeze({
    ...common,
    action: 'configuration-published',
    actorReference: 'administrator-operations-0001',
    auditEventId: 'audit-operation-0001',
    etag: 'audit-operation-0001-v7',
    kind: 'admin-audit-event-projection',
    occurredAt: observedAt,
    outcome: 'applied',
    scope: 'configuration',
    subjectReference: 'configuration-release-safety-0001',
  }),
  Object.freeze({
    ...common,
    action: 'export-completed-partially',
    actorReference: 'administrator-operations-0001',
    auditEventId: 'audit-operation-0002',
    etag: 'audit-operation-0002-v7',
    kind: 'admin-audit-event-projection',
    occurredAt: '2026-08-07T11:48:00.000Z',
    outcome: 'partial',
    scope: 'configuration-export',
    subjectReference: 'job-configuration-export-0002',
  }),
] satisfies readonly AdminAuditEventProjectionJson[]);

const alerts = Object.freeze([
  Object.freeze({
    ...common,
    alertId: 'alert-invitation-delivery-0001',
    deadlineAt: '2026-08-07T12:10:00.000Z',
    etag: 'alert-invitation-delivery-0001-v7',
    kind: 'admin-alert-projection',
    ownerReference: 'channel-security-critical',
    safeSummary: 'Entrega de convites exige revisão operacional',
    severity: 'critical',
    state: 'open',
    subjectReference: 'incident-delivery-0001',
  }),
] satisfies readonly AdminAlertProjectionJson[]);

const exports = Object.freeze([
  Object.freeze({
    ...common,
    actorReference: 'administrator-operations-0001',
    createdAt: '2026-08-07T11:40:00.000Z',
    encrypted: true,
    etag: 'export-configuration-0001-v7',
    expiresAt: '2026-08-07T12:40:00.000Z',
    exportId: 'export-configuration-0001',
    fieldReferences: ['configuration-reference', 'validation-reference'] as [string, string],
    kind: 'admin-export-projection',
    masked: true,
    purposeRedacted: 'Finalidade administrativa restrita',
    state: 'ready',
  }),
] satisfies readonly AdminExportProjectionJson[]);

const model = (
  surface: OperationsSystemSurface,
  overrides: Partial<OperationsSystemModel> = {},
): OperationsSystemModel =>
  Object.freeze({
    alerts,
    audit,
    authority: Object.freeze({ canMutate: true, observedAt, state: 'live' as const }),
    capacity,
    configurations,
    emergencyStops,
    environments,
    exports,
    incidents,
    jobs,
    privacyCases,
    surface,
    ...overrides,
  });

const storyRecordAt = <Record,>(records: readonly Record[], index: number): Record => {
  const record = records[index];
  if (record === undefined) throw new globalThis.Error(`STORY_RECORD_MISSING:${String(index)}`);
  return record;
};

const longIncident = Object.freeze({
  ...storyRecordAt(incidents, 0),
  incidentId: 'incident-entrega-convite-private-beta-america-sul-janela-operacional-0001',
  title:
    'Degradação intermitente da entrega de convites da América do Sul antes da próxima janela operacional',
}) satisfies AdminIncidentProjectionJson;

const longConfiguration = Object.freeze({
  ...storyRecordAt(configurations, 0),
  configurationId:
    'configuration-release-private-beta-validation-and-safe-rollback-south-america-0001',
}) satisfies AdminConfigurationProjectionJson;

const receipt = Object.freeze({
  ...common,
  affectedReferences: ['configuration-release-safety-0001'] as [string],
  approvalReferences: [] as [],
  auditReference: 'audit-operation-receipt-0001',
  commandId: 'command-configuration-transition-0001',
  etag: 'operation-receipt-0001-v7',
  kind: 'admin-operation-receipt',
  outcome: 'applied',
  receiptId: 'operation-receipt-0001',
  recordedAt: observedAt,
}) satisfies AdminOperationReceiptJson;

interface StoryProps {
  readonly locale: 'pt-BR' | 'en';
  readonly model: OperationsSystemModel;
  readonly mutation?: AdminMutationResult | null;
  readonly state: 'error' | 'loading' | 'ready';
  readonly textScale: boolean;
}

const OperationsSystemStory = ({
  locale,
  model: storyModel,
  mutation,
  state,
  textScale,
}: StoryProps) => (
  <div style={textScale ? { fontSize: '200%' } : undefined}>
    {state === 'loading' ? (
      <AdminOperationsSystemView locale={locale} state="loading" surface={storyModel.surface} />
    ) : state === 'error' ? (
      <AdminOperationsSystemView
        code="unavailable"
        locale={locale}
        state="error"
        surface={storyModel.surface}
      />
    ) : (
      <AdminOperationsSystemView
        locale={locale}
        model={storyModel}
        {...(mutation === undefined ? {} : { mutation })}
        onMutate={() => undefined}
        onRefresh={() => undefined}
        state="ready"
      />
    )}
  </div>
);

const meta = {
  args: {
    locale: 'pt-BR',
    model: model('operation'),
    state: 'ready',
    textScale: false,
  },
  component: OperationsSystemStory,
  parameters: { layout: 'fullscreen' },
  title: 'Admin/Workspaces/Operations and System',
} satisfies Meta<typeof OperationsSystemStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OperationLive: Story = {};
export const SecurityLive: Story = { args: { model: model('security') } };
export const SystemLive: Story = { args: { model: model('system') } };
export const English: Story = { args: { locale: 'en', model: model('system') } };
export const Loading: Story = { args: { state: 'loading' } };
export const Empty: Story = {
  args: {
    model: model('operation', {
      capacity: [],
      configurations: [],
      exports: [],
      jobs: [],
    }),
  },
};
export const Reconnecting: Story = {
  args: {
    model: model('operation', {
      authority: Object.freeze({ canMutate: false, observedAt, state: 'reconnecting' }),
    }),
  },
};
export const StaleDegraded: Story = {
  args: {
    model: model('system', {
      authority: Object.freeze({ canMutate: false, observedAt, state: 'degraded' }),
    }),
  },
};
export const Error: Story = { args: { state: 'error' } };
export const Conflict: Story = {
  args: { model: model('security'), mutation: { code: 'conflict', status: 'conflict' } },
};
export const SuccessReceipt: Story = {
  args: { mutation: { document: receipt, status: 'complete' } },
};
export const PartialJob: Story = {
  args: { model: model('operation', { jobs: [storyRecordAt(jobs, 1)] }) },
};
export const LongIncidentAndConfigurationNames: Story = {
  args: {
    model: model('security', {
      configurations: [longConfiguration],
      incidents: [longIncident],
    }),
  },
};
export const Tablet: Story = {
  args: { model: model('security') },
  parameters: { viewport: { defaultViewport: 'tablet1024' } },
};
export const Mobile: Story = {
  args: { model: model('security') },
  parameters: { viewport: { defaultViewport: 'mobile390' } },
};
export const MobileAtThreeTwenty: Story = {
  args: { model: model('operation', { configurations: [longConfiguration] }) },
  parameters: { viewport: { defaultViewport: 'mobile320' } },
};
export const TextAtTwoHundredPercent: Story = {
  args: { model: model('system'), textScale: true },
};
export const ForcedColors: Story = { globals: { contrast: 'forced' } };
export const ReducedMotion: Story = { globals: { motion: 'reduced' } };
