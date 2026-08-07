import type { Meta, StoryObj } from '@storybook/react-vite';

import { AdminOverviewView } from './admin-overview';
import type { AdminBriefingModel } from './admin-overview-model';

const basePriority = Object.freeze({
  action: Object.freeze({
    capability: 'incident.review',
    href: '/pt-BR/admin/operation/incidents/incident-0001?function=operations&view=assigned&version=7',
    label: 'Abrir incidente',
  }),
  context: 'provider:email · private-beta',
  deadlineAt: '2026-08-07T08:30:00.000Z',
  freshness: 'live',
  handoff: Object.freeze({
    escalation: 'critical',
    ownerReference: 'administrator-0001',
    state: 'covered',
    substituteReference: 'administrator-0002',
  }),
  id: 'incident-0001',
  kind: 'incident',
  severity: 'critical',
  title: 'Revisar entrega de convites degradada antes da próxima janela',
  version: '7',
} as const);

const liveModel = Object.freeze({
  activeFunction: 'operations',
  connection: 'live',
  context: Object.freeze({
    capacity: Object.freeze({
      action: Object.freeze({
        capability: 'invitation.delivery',
        href: '/pt-BR/admin/people/invitations?function=operations&view=assigned&version=7',
        label: 'Gerenciar capacidade de convites',
      }),
      activeCount: 18,
      activeLimit: 25,
      forecastExhaustionAt: '2026-08-12T20:00:00.000Z',
      observedAt: '2026-08-07T08:00:00.000Z',
      queuedCount: 4,
      status: 'live',
    }),
    environment: Object.freeze({ id: 'staging-brasil', kind: 'staging', label: 'Staging Brasil' }),
    observedAt: '2026-08-07T08:00:00.000Z',
  }),
  degradedCapabilities: Object.freeze([]),
  priorities: Object.freeze([
    basePriority,
    Object.freeze({
      ...basePriority,
      action: Object.freeze({
        capability: 'queue.review',
        href: '/pt-BR/admin/operation/queue/record-inbox-0002?function=operations&view=assigned&version=8',
        label: 'Abrir prioridade',
      }),
      context: 'record-inbox-0002',
      deadlineAt: '2026-08-07T10:00:00.000Z',
      handoff: Object.freeze({
        escalation: 'none',
        ownerReference: 'administrator-0001',
        state: 'uncovered',
        substituteReference: null,
      }),
      id: 'inbox-0002',
      kind: 'inbox',
      severity: 'warning',
      title: 'Revisar capacidade da fila privada',
      version: '8',
    }),
  ]),
  statement: 'Prioridade atual: revisar entrega de convites degradada',
  status: 'live',
} as const satisfies AdminBriefingModel);

const emptyModel = Object.freeze({
  ...liveModel,
  activeFunction: null,
  context: Object.freeze({
    capacity: Object.freeze({ action: null, status: 'unavailable' }),
    environment: null,
    observedAt: null,
  }),
  priorities: Object.freeze([]),
  statement: 'Nenhum trabalho prioritário autorizado aguarda nesta visão.',
} satisfies AdminBriefingModel);

const noPriorityModel = Object.freeze({
  ...liveModel,
  priorities: Object.freeze([]),
  statement: 'Nenhum trabalho prioritário autorizado aguarda nesta visão.',
} satisfies AdminBriefingModel);

const staleModel = Object.freeze({
  ...liveModel,
  context: Object.freeze({
    ...liveModel.context,
    capacity: Object.freeze({ ...liveModel.context.capacity, action: null, status: 'stale' }),
  }),
  status: 'stale',
} satisfies AdminBriefingModel);

const reconnectingModel = Object.freeze({
  ...staleModel,
  connection: 'reconnecting',
} satisfies AdminBriefingModel);

const degradedModel = Object.freeze({
  ...liveModel,
  context: Object.freeze({
    ...liveModel.context,
    capacity: Object.freeze({ ...liveModel.context.capacity, action: null, status: 'degraded' }),
  }),
  degradedCapabilities: Object.freeze(['invitation.delivery']),
  status: 'degraded',
} satisfies AdminBriefingModel);

const englishModel = Object.freeze({
  ...liveModel,
  priorities: Object.freeze([
    Object.freeze({
      ...basePriority,
      action: Object.freeze({ ...basePriority.action, label: 'Open incident' }),
      title: 'Review degraded invitation delivery before the next release window',
    }),
  ]),
  statement: 'Current priority: review degraded invitation delivery',
} satisfies AdminBriefingModel);

const longModel = Object.freeze({
  ...liveModel,
  priorities: Object.freeze([
    Object.freeze({
      ...basePriority,
      handoff: Object.freeze({
        ...basePriority.handoff,
        ownerReference: 'administrator-responsible-for-private-beta-operations-south-america-0001',
        substituteReference: 'administrator-substitute-for-security-and-delivery-containment-0002',
      }),
      title:
        'Revisar degradação específica da entrega de convites antes da próxima janela operacional da América do Sul',
    }),
  ]),
  statement:
    'Prioridade atual: revisar degradação específica da entrega antes da próxima janela operacional',
} satisfies AdminBriefingModel);

interface OverviewStoryProps {
  readonly locale: 'pt-BR' | 'en';
  readonly model: AdminBriefingModel;
  readonly state: 'loading' | 'ready' | 'error';
  readonly textScale: boolean;
}

const OverviewStory = ({ locale, model, state, textScale }: OverviewStoryProps) => (
  <div style={textScale ? { fontSize: '200%' } : undefined}>
    {state === 'loading' ? (
      <AdminOverviewView locale={locale} state="loading" />
    ) : state === 'error' ? (
      <AdminOverviewView errorCode="unavailable" locale={locale} state="error" />
    ) : (
      <AdminOverviewView locale={locale} model={model} state="ready" />
    )}
  </div>
);

const meta = {
  args: { locale: 'pt-BR', model: liveModel, state: 'ready', textScale: false },
  component: OverviewStory,
  parameters: { layout: 'fullscreen' },
  title: 'Admin/Workspaces/Overview',
} satisfies Meta<typeof OverviewStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FirstUse: Story = { args: { model: emptyModel } };
export const Empty: Story = { args: { model: noPriorityModel } };
export const Loading: Story = { args: { state: 'loading' } };
export const Live: Story = {};
export const Reconnecting: Story = { args: { model: reconnectingModel } };
export const Stale: Story = { args: { model: staleModel } };
export const Degraded: Story = { args: { model: degradedModel } };
export const Error: Story = { args: { state: 'error' } };
export const English: Story = { args: { locale: 'en', model: englishModel } };
export const LongContent: Story = { args: { model: longModel } };
export const Tablet: Story = {
  parameters: { viewport: { defaultViewport: 'tablet1024' } },
};
export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: 'mobile390' } },
};
export const TextAtTwoHundredPercent: Story = { args: { textScale: true } };
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
