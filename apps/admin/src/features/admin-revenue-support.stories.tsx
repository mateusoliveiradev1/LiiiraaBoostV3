import type { AdminJobProjectionJson } from '@liiiraa/contracts-ts';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import type { AdminSensitiveExportReceipt } from '../admin-authority';
import {
  AdminRevenueSupportView,
  type DiagnosticEvidence,
  type RevenueRow,
  type RevenueSupportModel,
  type SupportRow,
} from './admin-revenue-support';
import {
  projectRevenueAuthority,
  projectSupportCaseAuthority,
  type DiagnosticAuthorityState,
} from './admin-revenue-support-model';

const observedAt = '2026-08-07T12:00:00.000Z';

const revenue = (
  input: Readonly<{
    amountMinor?: string;
    currency?: string;
    id: string;
    providerState?: 'available' | 'degraded' | 'unknown';
    reconciliationState?: 'reconciled' | 'pending' | 'failed' | 'unknown';
    subscriptionState?: 'paid' | 'past-due' | 'canceled' | 'unknown';
  }>,
): RevenueRow =>
  Object.freeze({
    ...projectRevenueAuthority({
      ...(input.amountMinor === undefined ? {} : { amountMinor: input.amountMinor }),
      ...(input.currency === undefined ? {} : { currency: input.currency }),
      observedAt,
      providerState: input.providerState ?? 'available',
      reconciliationState: input.reconciliationState ?? 'reconciled',
      subscriptionState: input.subscriptionState ?? 'paid',
    }),
    id: input.id,
    source: 'subscription',
    validUntil: '2026-09-07T12:00:00.000Z',
    version: '7',
  });

const support = (
  input: Readonly<{
    consent?: 'active' | 'expired' | 'revoked' | 'absent';
    id: string;
    overdue?: boolean;
    subject?: string;
  }>,
): SupportRow => {
  const consent = input.consent ?? 'active';
  const projected = projectSupportCaseAuthority({
    caseId: input.id,
    ...(consent === 'absent'
      ? {}
      : {
          consent: {
            consentId: `consent-${input.id}`,
            expiresAt:
              consent === 'expired' ? '2026-08-07T11:59:00.000Z' : '2026-08-07T12:15:00.000Z',
            scopes: ['support-diagnostics'],
            state: consent,
            version: '3',
          },
        }),
    deadlineAt: input.overdue ? '2026-08-07T11:40:00.000Z' : '2026-08-07T12:20:00.000Z',
    metadata: {
      deviceClass: 'desktop',
      diagnosticCategory: 'performance',
      releaseChannel: 'private-beta',
    },
    now: observedAt,
    ownerReference: 'administrator-support-0001',
    state: input.overdue ? 'escalated' : 'awaiting-support',
    substituteReference: 'administrator-support-0002',
    subjectRedacted: input.subject ?? `Caso de suporte ••••${input.id.slice(-4)}`,
  });
  return Object.freeze({
    ...projected,
    ...(consent === 'absent' ? {} : { diagnosticId: `diagnostic-${input.id}` }),
    observedAt,
    version: '5',
  });
};

const jobs = Object.freeze([
  Object.freeze({
    aggregateVersion: '11',
    completedItems: 18,
    correlationId: 'correlation-export-0001',
    environment: Object.freeze({
      environmentId: 'staging-brasil',
      kind: 'staging' as const,
      label: 'Staging Brasil',
    }),
    etag: 'admin-job-export-0001-v11',
    failedItems: 2,
    freshness: Object.freeze({
      observedAt,
      sequence: '51',
      source: 'admin-jobs',
      state: 'live' as const,
    }),
    jobId: 'job-export-0001',
    jobType: 'configuration-export',
    kind: 'admin-job-projection' as const,
    ownerReference: 'administrator-support-0001',
    progressPercent: 100,
    provenance: 'postgres-authority' as const,
    receiptReference: 'receipt-export-0001',
    schemaVersion: '1.0' as const,
    startedAt: '2026-08-07T11:55:00.000Z',
    state: 'partial' as const,
    totalItems: 20,
  }),
] satisfies readonly AdminJobProjectionJson[]);

const revenueRows = Object.freeze([
  revenue({ amountMinor: '9990', currency: 'BRL', id: 'entitlement-0001' }),
  revenue({
    amountMinor: '19990',
    currency: 'BRL',
    id: 'entitlement-0002',
    providerState: 'degraded',
    reconciliationState: 'pending',
  }),
  revenue({
    id: 'entitlement-0003',
    providerState: 'unknown',
    reconciliationState: 'unknown',
    subscriptionState: 'unknown',
  }),
]);

const supportRows = Object.freeze([
  support({ id: 'case-0001' }),
  support({ consent: 'absent', id: 'case-0002', overdue: true }),
  support({ consent: 'expired', id: 'case-0003' }),
  support({ consent: 'revoked', id: 'case-0004' }),
]);

const model = (
  surface: 'revenue' | 'support',
  overrides: Partial<RevenueSupportModel> = {},
): RevenueSupportModel =>
  Object.freeze({
    authority: Object.freeze({ canMutate: true, state: 'live' as const }),
    degradedFamilies: Object.freeze([]),
    jobs,
    observedAt,
    revenue: revenueRows,
    support: supportRows,
    surface,
    ...overrides,
  });

const emptyDiagnostic = Object.freeze({ fields: Object.freeze({}), state: 'empty' as const });
const activeDiagnostic = Object.freeze({
  consentId: 'consent-case-0001',
  expiresAt: '2026-08-07T12:15:00.000Z',
  fields: Object.freeze({
    cpu: 'AMD Ryzen 7 7800X3D',
    gpu: 'NVIDIA GeForce RTX 4070',
    sessionReference: 'session-••••0042',
  }),
  state: 'active' as const,
  version: '3',
});
const clearedDiagnostic = Object.freeze({
  abortRequired: true as const,
  auditReference: 'audit-consent-revoked-0001',
  consentId: 'consent-case-0001',
  fields: Object.freeze({}),
  state: 'cleared' as const,
  version: '4',
});

const evidence = Object.freeze([
  Object.freeze({
    action: 'diagnostic-viewed',
    at: '2026-08-07T12:01:00.000Z',
    reference: 'audit-diagnostic-0001',
    result: 'applied',
  }),
] satisfies readonly DiagnosticEvidence[]);

const exportReceipt = Object.freeze({
  auditReference: 'audit-export-0001',
  createdAt: '2026-08-07T12:02:00.000Z',
  encrypted: true,
  environment: 'staging',
  expiresAt: '2026-08-07T12:17:00.000Z',
  exportId: 'export-0001',
  fields: Object.freeze(['case-reference', 'event-time']),
  masked: true,
  outcome: 'export-started',
  purpose: 'Investigar o atendimento consentido.',
} satisfies AdminSensitiveExportReceipt);

interface StoryProps {
  readonly diagnostic: DiagnosticAuthorityState;
  readonly exportReceipt?: AdminSensitiveExportReceipt;
  readonly locale: 'pt-BR' | 'en';
  readonly model: RevenueSupportModel;
  readonly state: 'error' | 'loading' | 'ready';
  readonly textScale: boolean;
}

const RevenueSupportStory = ({
  diagnostic,
  exportReceipt: receipt,
  locale,
  model: storyModel,
  state,
  textScale,
}: StoryProps) => {
  const [selectedId, setSelectedId] = useState(storyModel.selectedId);
  const interactiveModel = Object.freeze({
    ...storyModel,
    ...(selectedId === undefined ? {} : { selectedId }),
  });
  return (
    <div style={textScale ? { fontSize: '200%' } : undefined}>
      {state === 'loading' ? (
        <AdminRevenueSupportView locale={locale} state="loading" />
      ) : state === 'error' ? (
        <AdminRevenueSupportView code="unavailable" locale={locale} state="error" />
      ) : (
        <AdminRevenueSupportView
          diagnostic={diagnostic}
          diagnosticEvidence={evidence}
          {...(receipt === undefined ? {} : { exportReceipt: receipt })}
          locale={locale}
          model={interactiveModel}
          onSelect={setSelectedId}
          state="ready"
        />
      )}
    </div>
  );
};

const meta = {
  args: {
    diagnostic: emptyDiagnostic,
    locale: 'pt-BR',
    model: model('revenue'),
    state: 'ready',
    textScale: false,
  },
  component: RevenueSupportStory,
  parameters: { layout: 'fullscreen' },
  title: 'Admin/Workspaces/Revenue and Support',
} satisfies Meta<typeof RevenueSupportStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RevenueLive: Story = {};
export const RevenueProviderDegraded: Story = {
  args: { model: model('revenue', { selectedId: 'entitlement-0002' }) },
};
export const RevenueUnknownAmount: Story = {
  args: { model: model('revenue', { selectedId: 'entitlement-0003' }) },
};
export const SupportLive: Story = { args: { model: model('support') } };
export const ConsentActive: Story = {
  args: { model: model('support', { selectedId: 'case-0001' }) },
};
export const ConsentAbsent: Story = {
  args: { model: model('support', { selectedId: 'case-0002' }) },
};
export const ConsentExpired: Story = {
  args: { model: model('support', { selectedId: 'case-0003' }) },
};
export const ConsentRevoked: Story = {
  args: { model: model('support', { selectedId: 'case-0004' }) },
};
export const DiagnosticRevealed: Story = {
  args: { diagnostic: activeDiagnostic, model: model('support', { selectedId: 'case-0001' }) },
};
export const DiagnosticClearedImmediately: Story = {
  args: { diagnostic: clearedDiagnostic, model: model('support', { selectedId: 'case-0001' }) },
};
export const ExportReview: Story = {
  args: { model: model('support', { selectedId: 'case-0001' }) },
};
export const ExportReceipt: Story = {
  args: { exportReceipt, model: model('support', { selectedId: 'case-0001' }) },
};
export const EmptyRevenue: Story = {
  args: { model: model('revenue', { jobs: [], revenue: [] }) },
};
export const EmptySupport: Story = {
  args: { model: model('support', { jobs: [], support: [] }) },
};
export const Loading: Story = { args: { state: 'loading' } };
export const Error: Story = { args: { state: 'error' } };
export const Reconnecting: Story = {
  args: {
    model: model('support', {
      authority: Object.freeze({ canMutate: false, state: 'reconnecting' }),
    }),
  },
};
export const Stale: Story = {
  args: {
    model: model('revenue', {
      authority: Object.freeze({ canMutate: false, state: 'stale' }),
    }),
  },
};
export const Degraded: Story = {
  args: {
    model: model('support', {
      authority: Object.freeze({ canMutate: false, state: 'degraded' }),
      degradedFamilies: Object.freeze(['support-cases']),
    }),
  },
};
export const Conflict: Story = {
  args: { model: model('support', { selectedId: 'case-0001' }) },
  render: (args) => (
    <AdminRevenueSupportView
      diagnostic={args.diagnostic}
      diagnosticEvidence={evidence}
      locale={args.locale}
      model={args.model}
      mutation={{ code: 'conflict', status: 'conflict' }}
      state="ready"
    />
  ),
};
export const PartialJob: Story = { args: { model: model('support') } };
export const English: Story = { args: { locale: 'en', model: model('support') } };
export const LongLocalizedContent: Story = {
  args: {
    model: model('support', {
      selectedId: 'case-long-0001',
      support: Object.freeze([
        support({
          id: 'case-long-0001',
          subject:
            'Falha de desempenho intermitente após uma sequência extensa de calibração consentida ••••0001',
        }),
      ]),
    }),
  },
};
export const Tablet: Story = {
  args: { model: model('support', { selectedId: 'case-0001' }) },
  parameters: { viewport: { defaultViewport: 'tablet1024' } },
};
export const Mobile: Story = {
  args: { model: model('support', { selectedId: 'case-0001' }) },
  parameters: { viewport: { defaultViewport: 'mobile390' } },
};
export const MobileAtThreeTwenty: Story = {
  args: { model: model('support', { selectedId: 'case-0001' }) },
  parameters: { viewport: { defaultViewport: 'mobile320' } },
};
export const TextAtTwoHundredPercent: Story = {
  args: { model: model('support', { selectedId: 'case-0001' }), textScale: true },
};
export const ForcedColors: Story = { globals: { contrast: 'forced' } };
export const ReducedMotion: Story = { globals: { motion: 'reduced' } };
