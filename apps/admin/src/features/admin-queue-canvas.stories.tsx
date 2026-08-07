import type { Meta, StoryObj } from '@storybook/react-vite';

import type { AdminMutationResult } from '../admin-authority';
import { AdminQueueCanvasView, type QueueCanvasModel } from './admin-queue-canvas';

const baseState = Object.freeze({
  density: 'comfortable' as const,
  filters: Object.freeze([]),
  page: 1,
  query: '',
  sort: Object.freeze({ direction: 'desc' as const, field: 'updated' as const }),
  tab: 'queue' as const,
});

const records = Object.freeze([
  Object.freeze({
    deadlineAt: '2026-08-07T09:20:00.000Z',
    href: '/pt-BR/admin/operation/admin-incident-projection/incident_0001?selected=incident_0001',
    id: 'incident_0001',
    kind: 'admin-incident-projection',
    ownerReference: 'administrator_operations_0001',
    severity: 'critical' as const,
    state: 'open',
    summary: 'Entrega de convites requer contenção antes da janela de publicação',
    updatedAt: '2026-08-07T08:03:00.000Z',
    version: '17',
  }),
  Object.freeze({
    deadlineAt: '2026-08-07T11:00:00.000Z',
    href: '/pt-BR/admin/operation/admin-inbox-item-projection/inbox_0002?selected=inbox_0002',
    id: 'inbox_0002',
    kind: 'admin-inbox-item-projection',
    ownerReference: 'administrator_support_0003',
    severity: 'warning' as const,
    state: 'acknowledged',
    summary: 'Revisar capacidade da campanha beta privada da América do Sul',
    updatedAt: '2026-08-07T08:01:00.000Z',
    version: '8',
  }),
  Object.freeze({
    href: '/pt-BR/admin/operation/admin-configuration-projection/config_0003?selected=config_0003',
    id: 'config_0003',
    kind: 'admin-configuration-projection',
    severity: 'information' as const,
    state: 'active',
    summary: 'Política de retenção de recibos administrativos',
    updatedAt: '2026-08-07T07:54:00.000Z',
    version: '22',
  }),
]);

const liveModel = Object.freeze({
  authority: Object.freeze({ canMutate: true, requiresRefetch: false, state: 'live' as const }),
  basePath: '/pt-BR/admin/operation',
  degradedFamilies: Object.freeze([]),
  firstUse: false,
  inbox: Object.freeze([
    Object.freeze({
      aggregateVersion: '8',
      correlationId: 'corr-inbox-0002',
      deadlineAt: '2026-08-07T11:00:00.000Z',
      environment: Object.freeze({
        environmentId: 'staging-brasil',
        kind: 'staging' as const,
        label: 'Staging Brasil',
      }),
      etag: 'etag-inbox-8',
      freshness: Object.freeze({
        observedAt: '2026-08-07T08:03:00.000Z',
        sequence: '8',
        source: 'admin-inbox',
        state: 'live' as const,
      }),
      inboxItemId: 'inbox_0002',
      kind: 'admin-inbox-item-projection' as const,
      ownerReference: 'administrator_support_0003',
      provenance: 'postgres-authority' as const,
      relatedRecordReference: 'invitation_batch_0042',
      schemaVersion: '1.0' as const,
      severity: 'warning' as const,
      state: 'acknowledged' as const,
      title: 'Revisar capacidade da campanha beta privada',
      updatedAt: '2026-08-07T08:01:00.000Z',
    }),
  ]),
  jobs: Object.freeze([
    Object.freeze({
      aggregateVersion: '11',
      completedItems: 18,
      failedItems: 2,
      jobId: 'job_export_0001',
      ownerReference: 'administrator_operations_0001',
      progressPercent: 100,
      receiptReference: 'receipt_export_0001',
      state: 'partial' as const,
      totalItems: 20,
    }),
    Object.freeze({
      aggregateVersion: '4',
      completedItems: 7,
      failedItems: 0,
      jobId: 'job_import_0002',
      ownerReference: 'administrator_operations_0001',
      progressPercent: 35,
      state: 'running' as const,
      totalItems: 20,
    }),
  ]),
  nextCursor: 'cursor_002',
  observedAt: '2026-08-07T08:03:00.000Z',
  records,
  savedViews: Object.freeze([
    Object.freeze({
      aggregateVersion: '12',
      ownerReference: undefined,
      savedViewId: 'official_sla_risk',
      visibility: 'official' as const,
    }),
    Object.freeze({
      aggregateVersion: '3',
      ownerReference: 'administrator_operations_0001',
      savedViewId: 'personal_release_window',
      visibility: 'personal' as const,
    }),
  ]),
  urlState: baseState,
} satisfies QueueCanvasModel);

const emptyModel = Object.freeze({
  ...liveModel,
  records: Object.freeze([]),
  savedViews: Object.freeze([]),
  inbox: Object.freeze([]),
  jobs: Object.freeze([]),
  nextCursor: null,
} satisfies QueueCanvasModel);
const firstUseModel = Object.freeze({ ...emptyModel, firstUse: true } satisfies QueueCanvasModel);
const reconnectingModel = Object.freeze({
  ...liveModel,
  authority: Object.freeze({
    canMutate: false,
    requiresRefetch: true,
    state: 'reconnecting' as const,
  }),
} satisfies QueueCanvasModel);
const staleModel = Object.freeze({
  ...liveModel,
  authority: Object.freeze({ canMutate: false, requiresRefetch: true, state: 'stale' as const }),
} satisfies QueueCanvasModel);
const degradedModel = Object.freeze({
  ...liveModel,
  authority: Object.freeze({ canMutate: false, requiresRefetch: true, state: 'degraded' as const }),
  degradedFamilies: Object.freeze(['search']),
} satisfies QueueCanvasModel);
const compactModel = Object.freeze({
  ...liveModel,
  urlState: Object.freeze({ ...baseState, density: 'compact' as const }),
} satisfies QueueCanvasModel);
const inspectorModel = Object.freeze({
  ...liveModel,
  urlState: Object.freeze({ ...baseState, selectedId: 'incident_0001' }),
} satisfies QueueCanvasModel);
const jobModel = Object.freeze({
  ...liveModel,
  urlState: Object.freeze({ ...baseState, tab: 'jobs' as const }),
} satisfies QueueCanvasModel);
const viewsModel = Object.freeze({
  ...liveModel,
  urlState: Object.freeze({ ...baseState, tab: 'views' as const }),
} satisfies QueueCanvasModel);
const inboxModel = Object.freeze({
  ...liveModel,
  urlState: Object.freeze({ ...baseState, tab: 'inbox' as const }),
} satisfies QueueCanvasModel);
const longModel = Object.freeze({
  ...liveModel,
  records: Object.freeze([
    Object.freeze({
      deadlineAt: '2026-08-07T09:20:00.000Z',
      href: '/pt-BR/admin/operation/admin-incident-projection/incident_0001?selected=incident_0001',
      id: 'incident_0001',
      kind: 'admin-incident-projection',
      ownerReference: 'administrator_responsible_for_private_beta_operations_south_america_0001',
      severity: 'critical' as const,
      state: 'open',
      summary:
        'Revisar degradação específica da entrega de convites antes da próxima janela operacional da América do Sul e preservar toda evidência de compensação',
      updatedAt: '2026-08-07T08:03:00.000Z',
      version: '17',
    }),
  ]),
} satisfies QueueCanvasModel);

interface StoryProps {
  readonly locale: 'pt-BR' | 'en';
  readonly model: QueueCanvasModel;
  readonly mutationFeedback: AdminMutationResult | null;
  readonly state: 'loading' | 'ready' | 'error';
  readonly textScale: boolean;
}

const QueueStory = ({ locale, model, mutationFeedback, state, textScale }: StoryProps) => (
  <div style={textScale ? { fontSize: '200%' } : undefined}>
    {state === 'loading' ? (
      <AdminQueueCanvasView locale={locale} state="loading" />
    ) : state === 'error' ? (
      <AdminQueueCanvasView errorCode="unavailable" locale={locale} state="error" />
    ) : (
      <AdminQueueCanvasView
        locale={locale}
        model={model}
        mutationFeedback={mutationFeedback}
        state="ready"
      />
    )}
  </div>
);

const meta = {
  args: {
    locale: 'pt-BR',
    model: liveModel,
    mutationFeedback: null,
    state: 'ready',
    textScale: false,
  },
  component: QueueStory,
  parameters: { layout: 'fullscreen' },
  title: 'Admin/Workspaces/Queue Canvas',
} satisfies Meta<typeof QueueStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FirstUse: Story = { args: { model: firstUseModel } };
export const Empty: Story = { args: { model: emptyModel } };
export const Loading: Story = { args: { state: 'loading' } };
export const Live: Story = {};
export const Reconnecting: Story = { args: { model: reconnectingModel } };
export const Stale: Story = { args: { model: staleModel } };
export const Degraded: Story = { args: { model: degradedModel } };
export const Error: Story = { args: { state: 'error' } };
export const Conflict: Story = {
  args: { mutationFeedback: { code: 'conflict', status: 'conflict' } },
};
export const PartialJob: Story = { args: { model: jobModel } };
export const SavedViews: Story = { args: { model: viewsModel } };
export const ActionableInbox: Story = { args: { model: inboxModel } };
export const InspectorAndFocusReturn: Story = { args: { model: inspectorModel } };
export const CompactDensity: Story = { args: { model: compactModel } };
export const English: Story = { args: { locale: 'en' } };
export const LongLocalizedRecord: Story = { args: { model: longModel } };
export const Tablet: Story = { parameters: { viewport: { defaultViewport: 'tablet1024' } } };
export const Mobile: Story = { parameters: { viewport: { defaultViewport: 'mobile390' } } };
export const TextAtTwoHundredPercent: Story = { args: { model: longModel, textScale: true } };
export const ForcedColors: Story = { globals: { contrast: 'forced' } };
export const ReducedMotion: Story = { globals: { motion: 'reduced' } };
export const MobileAtThreeTwenty: Story = {
  args: { model: longModel },
  parameters: {
    viewport: {
      defaultViewport: 'mobile320',
      options: {
        mobile320: { name: 'Mobile 320 × 720', styles: { height: '720px', width: '320px' } },
      },
    },
  },
};
