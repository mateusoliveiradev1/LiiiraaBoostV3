import type {
  AdminInvitationCapacityProjectionJson,
  AdminInvitationDeliveryStateJson,
  AdminInvitationLifecycleStateJson,
  AdminInvitationProjectionJson,
} from '@liiiraa/contracts-ts';
import type { Meta, StoryObj } from '@storybook/react-vite';

import type { AdminMutationResult } from '../admin-authority';
import { AdminInvitationsView, type InvitationWorkspaceModel } from './admin-invitations';

const observedAt = '2026-08-07T12:00:00.000Z';
const environment = Object.freeze({
  environmentId: 'staging-brasil',
  kind: 'staging' as const,
  label: 'Staging Brasil',
});
const freshness = Object.freeze({
  observedAt,
  sequence: '57',
  source: 'admin-invitations',
  state: 'live' as const,
});

const invitation = (
  invitationId: string,
  lifecycleState: AdminInvitationLifecycleStateJson,
  deliveryState: AdminInvitationDeliveryStateJson,
  options: Readonly<
    Partial<
      Pick<
        AdminInvitationProjectionJson,
        | 'campaignReference'
        | 'expiresAt'
        | 'lastEventAt'
        | 'locale'
        | 'recipientMasked'
        | 'reminderCount'
      >
    >
  > = {},
): AdminInvitationProjectionJson =>
  Object.freeze({
    aggregateVersion: `version-${invitationId}`,
    campaignReference: 'private-beta-august',
    correlationId: `correlation-${invitationId}`,
    deliveryState,
    environment,
    etag: `etag-${invitationId}`,
    expiresAt: '2026-08-20T12:00:00.000Z',
    freshness,
    invitationId,
    kind: 'admin-invitation-projection' as const,
    lastEventAt: '2026-08-07T11:42:00.000Z',
    lifecycleState,
    locale: 'pt-BR' as const,
    ownerReference: 'administrator-operations-0001',
    provenance: 'postgres-authority' as const,
    recipientMasked: 'ma••••@example.test',
    reminderCount: 0,
    schemaVersion: '1.0' as const,
    ...options,
  });

const capacity = (activeCount = 18, queuedCount = 4): AdminInvitationCapacityProjectionJson =>
  Object.freeze({
    activeCount,
    activeLimit: 25,
    aggregateVersion: `capacity-${activeCount.toString()}-${queuedCount.toString()}`,
    capacityId: 'invitation-capacity-staging',
    correlationId: 'correlation-invitation-capacity',
    environment,
    etag: `etag-capacity-${activeCount.toString()}-${queuedCount.toString()}`,
    forecastExhaustionAt: '2026-08-12T20:00:00.000Z',
    freshness,
    kind: 'admin-invitation-capacity-projection',
    provenance: 'postgres-authority',
    queuedCount,
    schemaVersion: '1.0',
  });

const invitations = Object.freeze([
  invitation('invitation-active-0001', 'active', 'delivered', {
    recipientMasked: 'ma••••@example.test',
    reminderCount: 1,
  }),
  invitation('invitation-queued-0002', 'queued', 'pending', {
    recipientMasked: 'lu••••@example.test',
  }),
  invitation('invitation-failed-0003', 'active', 'failed', {
    recipientMasked: 'an••••@example.test',
    reminderCount: 2,
  }),
  invitation('invitation-bounced-0004', 'bounced', 'permanent-bounce', {
    recipientMasked: 'jo••••@example.test',
  }),
  invitation('invitation-expiring-0005', 'active', 'sent', {
    expiresAt: '2026-08-09T12:00:00.000Z',
    recipientMasked: 'be••••@example.test',
  }),
  invitation('invitation-accepted-0006', 'accepted', 'delivered', {
    expiresAt: '2026-08-05T12:00:00.000Z',
    recipientMasked: 'ra••••@example.test',
  }),
  invitation('invitation-declined-0007', 'declined', 'delivered', {
    expiresAt: '2026-08-04T12:00:00.000Z',
    recipientMasked: 'ca••••@example.test',
  }),
  invitation('invitation-revoked-0008', 'revoked', 'delivered', {
    expiresAt: '2026-08-03T12:00:00.000Z',
    recipientMasked: 'fe••••@example.test',
  }),
]);

const timeline = Object.freeze([
  Object.freeze({ at: '2026-08-01T12:00:00.000Z', kind: 'created' }),
  Object.freeze({ at: '2026-08-01T12:00:01.000Z', kind: 'sent', outcome: 'provider-accepted' }),
  Object.freeze({ at: '2026-08-01T12:03:00.000Z', kind: 'delivered' }),
  Object.freeze({ at: '2026-08-06T12:00:00.000Z', kind: 'reminded' }),
]);

const liveModel = Object.freeze({
  authority: Object.freeze({ canMutate: true, requiresRefetch: false, state: 'live' as const }),
  capacity: capacity(),
  firstUse: false,
  invitations,
  jobs: Object.freeze([
    Object.freeze({
      completedItems: 7,
      failedItems: 1,
      jobId: 'job-invitation-batch-0042',
      progressPercent: 100,
      receiptReference: 'receipt-invitation-batch-0042',
      retryEligibleFailures: 1,
      state: 'partial' as const,
      totalItems: 8,
    }),
    Object.freeze({
      completedItems: 9,
      failedItems: 0,
      jobId: 'job-invitation-import-0043',
      progressPercent: 45,
      retryEligibleFailures: 0,
      state: 'running' as const,
      totalItems: 20,
    }),
  ]),
  mutationFeedback: null,
  nextCursor: 'cursor-invitations-002',
  observedAt,
  preflight: null,
  retention: Object.freeze({ action: 'retain' as const, basis: 'operational' as const }),
  timeline,
  view: 'active' as const,
} satisfies InvitationWorkspaceModel);

const emptyModel = Object.freeze({
  ...liveModel,
  invitations: Object.freeze([]),
  jobs: Object.freeze([]),
  nextCursor: null,
} satisfies InvitationWorkspaceModel);
const firstUseModel = Object.freeze({
  ...emptyModel,
  firstUse: true,
} satisfies InvitationWorkspaceModel);
const reconnectingModel = Object.freeze({
  ...liveModel,
  authority: Object.freeze({
    canMutate: false,
    requiresRefetch: true,
    state: 'reconnecting' as const,
  }),
} satisfies InvitationWorkspaceModel);
const staleModel = Object.freeze({
  ...liveModel,
  authority: Object.freeze({ canMutate: false, requiresRefetch: true, state: 'stale' as const }),
} satisfies InvitationWorkspaceModel);
const degradedModel = Object.freeze({
  ...liveModel,
  authority: Object.freeze({
    canMutate: false,
    requiresRefetch: true,
    state: 'degraded' as const,
  }),
  capacity: null,
} satisfies InvitationWorkspaceModel);
const offlineModel = Object.freeze({
  ...liveModel,
  authority: Object.freeze({ canMutate: false, requiresRefetch: true, state: 'offline' as const }),
} satisfies InvitationWorkspaceModel);

const individualPreflight = Object.freeze({
  ...liveModel,
  preflight: Object.freeze({
    canIssue: true,
    capacity: Object.freeze({ activeAfter: 19, activeLimit: 25, queuedAfter: 4 }),
    counts: Object.freeze({
      active: 0,
      duplicate: 0,
      ineligible: 0,
      invalid: 0,
      queued: 0,
      skipped: 0,
      valid: 1,
      willActivate: 1,
    }),
    mode: 'individual' as const,
    rows: Object.freeze([
      Object.freeze({
        classification: 'valid' as const,
        recipientMasked: 'no••••@example.test',
        rowId: 'row-001',
      }),
    ]),
  }),
} satisfies InvitationWorkspaceModel);

const csvPartialPreflight = Object.freeze({
  ...liveModel,
  preflight: Object.freeze({
    canIssue: true,
    capacity: Object.freeze({ activeAfter: 21, activeLimit: 25, queuedAfter: 5 }),
    counts: Object.freeze({
      active: 1,
      duplicate: 1,
      ineligible: 1,
      invalid: 1,
      queued: 1,
      skipped: 4,
      valid: 4,
      willActivate: 3,
    }),
    mode: 'csv' as const,
    rows: Object.freeze([
      Object.freeze({
        classification: 'valid' as const,
        recipientMasked: 'vi••••@example.test',
        rowId: 'row-001',
      }),
      Object.freeze({
        classification: 'duplicate' as const,
        recipientMasked: 'du••••@example.test',
        rowId: 'row-002',
      }),
      Object.freeze({
        classification: 'active' as const,
        recipientMasked: 'ac••••@example.test',
        rowId: 'row-003',
      }),
      Object.freeze({
        classification: 'invalid' as const,
        recipientMasked: 'recipient-unavailable',
        rowId: 'row-004',
      }),
      Object.freeze({
        classification: 'ineligible' as const,
        recipientMasked: 'in••••@example.test',
        rowId: 'row-005',
      }),
    ]),
  }),
} satisfies InvitationWorkspaceModel);

const modelFor = (
  invitationId: string,
  view: InvitationWorkspaceModel['view'],
  extras: Partial<InvitationWorkspaceModel> = {},
): InvitationWorkspaceModel =>
  Object.freeze({
    ...liveModel,
    selectedId: invitationId,
    view,
    ...extras,
  });

const capacityFullModel = Object.freeze({
  ...liveModel,
  capacity: capacity(25, 7),
  invitations: Object.freeze([
    invitation('invitation-queued-capacity-0001', 'queued', 'pending', {
      campaignReference: 'private-beta-capacity-waitlist',
      recipientMasked: 'qu••••@example.test',
    }),
  ]),
  view: 'queue' as const,
} satisfies InvitationWorkspaceModel);
const deliveryModel = modelFor('invitation-failed-0003', 'delivery');
const expiringModel = modelFor('invitation-expiring-0005', 'expiring');
const acceptedModel = modelFor('invitation-accepted-0006', 'accepted', {
  retention: Object.freeze({ action: 'retain', basis: 'purpose' }),
});
const declinedModel = modelFor('invitation-declined-0007', 'declined', {
  retention: Object.freeze({
    action: 'pseudonymize-personal-data',
    preserveMinimumAuditReceipt: true,
  }),
});
const revokedModel = modelFor('invitation-revoked-0008', 'revoked', {
  retention: Object.freeze({ action: 'retain', basis: 'legal-hold' }),
});
const activeInspectorModel = modelFor('invitation-active-0001', 'active');
const partialJobModel = Object.freeze({
  ...liveModel,
  mutationFeedback: Object.freeze({
    document: invitation('invitation-partial-result-0009', 'active', 'delivered'),
    status: 'partial' as const,
  }),
} satisfies InvitationWorkspaceModel);
const longModel = Object.freeze({
  ...activeInspectorModel,
  invitations: Object.freeze([
    invitation('invitation-long-recipient-and-campaign-0001', 'active', 'delivered', {
      campaignReference:
        'private-beta-south-america-competitive-streamers-hardware-specialists-august',
      recipientMasked: 'administrative-recipient-with-long-label••••@subdomain.example.test',
      reminderCount: 1,
    }),
  ]),
  selectedId: 'invitation-long-recipient-and-campaign-0001',
} satisfies InvitationWorkspaceModel);

interface StoryProps {
  readonly locale: 'pt-BR' | 'en';
  readonly model: InvitationWorkspaceModel;
  readonly state: 'loading' | 'ready' | 'error';
  readonly textScale: boolean;
}

const InvitationStory = ({ locale, model, state, textScale }: StoryProps) => (
  <div style={textScale ? { fontSize: '200%' } : undefined}>
    {state === 'loading' ? (
      <AdminInvitationsView locale={locale} state="loading" />
    ) : state === 'error' ? (
      <AdminInvitationsView errorCode="authority-unavailable" locale={locale} state="error" />
    ) : (
      <AdminInvitationsView locale={locale} model={model} state="ready" />
    )}
  </div>
);

const meta = {
  args: { locale: 'pt-BR', model: liveModel, state: 'ready', textScale: false },
  component: InvitationStory,
  parameters: { layout: 'fullscreen' },
  title: 'Admin/People/Invitation Operations',
} satisfies Meta<typeof InvitationStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FirstUse: Story = { args: { model: firstUseModel } };
export const Empty: Story = { args: { model: emptyModel } };
export const Loading: Story = { args: { state: 'loading' } };
export const Live: Story = {};
export const Reconnecting: Story = { args: { model: reconnectingModel } };
export const Stale: Story = { args: { model: staleModel } };
export const Degraded: Story = { args: { model: degradedModel } };
export const Offline: Story = { args: { model: offlineModel } };
export const Error: Story = { args: { state: 'error' } };
export const Conflict: Story = {
  args: {
    model: Object.freeze({
      ...liveModel,
      mutationFeedback: Object.freeze({
        code: 'conflict',
        status: 'conflict',
      } satisfies AdminMutationResult),
    }),
  },
};
export const IndividualPreflight: Story = { args: { model: individualPreflight } };
export const CsvPartialPreflight: Story = { args: { model: csvPartialPreflight } };
export const CapacityFullAndQueue: Story = { args: { model: capacityFullModel } };
export const ActiveInvitation: Story = { args: { model: activeInspectorModel } };
export const DeliveryFailureAndBounce: Story = { args: { model: deliveryModel } };
export const ExpiringSoon: Story = { args: { model: expiringModel } };
export const Accepted: Story = { args: { model: acceptedModel } };
export const Declined: Story = { args: { model: declinedModel } };
export const Revoked: Story = { args: { model: revokedModel } };
export const ResendPreserveExpiry: Story = { args: { model: activeInspectorModel } };
export const ResendRestartExpiry: Story = {
  args: { model: activeInspectorModel },
  play: ({ canvasElement }) => {
    const restart = canvasElement.querySelectorAll<HTMLInputElement>('input[name="expiry"]')[1];
    restart?.click();
  },
};
export const PartialBatchJobAndReceipt: Story = { args: { model: partialJobModel } };
export const RetentionAndLegalHold: Story = { args: { model: revokedModel } };
export const InspectorAndFocusReturn: Story = { args: { model: liveModel } };
export const English: Story = { args: { locale: 'en', model: activeInspectorModel } };
export const LongRecipientAndCampaign: Story = { args: { model: longModel } };
export const Tablet: Story = { parameters: { viewport: { defaultViewport: 'tablet1024' } } };
export const Mobile: Story = { parameters: { viewport: { defaultViewport: 'mobile390' } } };
export const ForcedColors: Story = { globals: { contrast: 'forced' } };
export const ReducedMotion: Story = { globals: { motion: 'reduced' } };
export const TextAtTwoHundredPercent: Story = { args: { model: longModel, textScale: true } };
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
export const MobileAtThreeTwentyWithTwoHundredPercentText: Story = {
  ...MobileAtThreeTwenty,
  args: { model: longModel, textScale: true },
};
