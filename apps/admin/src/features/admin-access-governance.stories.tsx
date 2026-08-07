import type {
  AdminGovernanceProjectionJson,
  AdminPermissionImpactProjectionJson,
  AdminRiskLevelJson,
  AdminTeamMemberProjectionJson,
} from '@liiiraa/contracts-ts';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useMemo, useState } from 'react';

import type { AdminMutationResult } from '../admin-authority';
import {
  AdminAccessGovernanceView,
  type GovernanceWorkspaceModel,
} from './admin-access-governance';

const observedAt = '2026-08-07T12:00:00.000Z';
const environment = Object.freeze({
  environmentId: 'staging-brasil',
  kind: 'staging' as const,
  label: 'Staging Brasil',
});
const freshness = Object.freeze({
  observedAt,
  sequence: '58',
  source: 'admin-access-governance',
  state: 'live' as const,
});
const metadata = (id: string) =>
  Object.freeze({
    aggregateVersion: `version-${id}`,
    correlationId: `correlation-${id}`,
    environment,
    etag: `etag-${id}`,
    freshness,
    provenance: 'postgres-authority' as const,
    schemaVersion: '1.0' as const,
  });
const contractList = <T extends string[]>(...values: T): T => values;

const member = (
  identityReference: string,
  displayName: string,
  options: Partial<AdminTeamMemberProjectionJson> = {},
): AdminTeamMemberProjectionJson =>
  Object.freeze({
    ...metadata(identityReference),
    activeDelegationReferences: contractList(),
    activeFunction: 'operations' as const,
    capabilities: contractList('device:manage', 'session:revoke'),
    displayName,
    functions: contractList('operations'),
    identityReference,
    kind: 'admin-team-member-projection' as const,
    lastActiveAt: '2026-08-07T11:52:00.000Z',
    maskedEmail: `${displayName.slice(0, 2).toLowerCase()}••••••••••••••••`,
    nextReviewAt: '2026-09-07T12:00:00.000Z',
    scopes: contractList('devices', 'sessions'),
    sessionReferences: contractList(`session-${identityReference}`),
    state: 'active' as const,
    strongFactor: 'passkey' as const,
    ...options,
  });

const approval = (
  governanceRecordId: string,
  risk: AdminRiskLevelJson,
  state: AdminGovernanceProjectionJson['state'] = 'pending',
  options: Partial<AdminGovernanceProjectionJson> = {},
): AdminGovernanceProjectionJson =>
  Object.freeze({
    ...metadata(governanceRecordId),
    authorReference: 'administrator-owner-0001',
    beneficiaryReference: 'administrator-operations-0002',
    eligibleApproverReferences: contractList('administrator-security-0003'),
    expiresAt: '2026-08-07T12:15:00.000Z',
    governanceKind: 'permission-change' as const,
    governanceRecordId,
    impactedReferences: contractList('session:revoke', 'sessions'),
    kind: 'admin-governance-projection' as const,
    risk,
    state,
    ...options,
  });

const members = Object.freeze([
  member('administrator-owner-0001', 'Mateus Oliveira', {
    activeFunction: 'owner',
    capabilities: contractList(
      'support:reply',
      'device:manage',
      'entitlement:correct',
      'session:revoke',
      'audit:reveal-sensitive',
    ),
    functions: contractList('owner', 'operations', 'security'),
    scopes: contractList('support-cases', 'devices', 'entitlements', 'sessions', 'audit-events'),
  }),
  member('administrator-operations-0002', 'Luana Ribeiro', {
    activeDelegationReferences: contractList('delegation-release-window-0042'),
  }),
  member('administrator-security-0003', 'Rafael Nascimento', {
    activeFunction: 'security',
    capabilities: contractList('session:revoke', 'audit:reveal-sensitive'),
    functions: contractList('security', 'audit'),
    scopes: contractList('sessions', 'audit-events'),
    strongFactor: 'mfa',
  }),
]);

const approvals = Object.freeze([
  approval('approval-routine-0001', 'low'),
  approval('approval-sensitive-0002', 'high'),
  approval('approval-critical-0003', 'critical'),
  approval('approval-irreversible-0004', 'irreversible'),
]);

const impact = Object.freeze({
  ...metadata('impact-administrator-operations-0002'),
  affectedData: contractList('devices', 'sessions', 'audit-events'),
  after: Object.freeze({
    capabilities: contractList('device:manage', 'session:revoke', 'audit:reveal-sensitive'),
    functions: contractList('operations', 'audit'),
    scopes: contractList('devices', 'sessions', 'audit-events'),
  }),
  before: Object.freeze({
    capabilities: contractList('device:manage', 'session:revoke'),
    functions: contractList('operations'),
    scopes: contractList('devices', 'sessions'),
  }),
  conflicts: contractList('independent-approval-required'),
  identityReference: 'administrator-operations-0002',
  impactId: 'impact-administrator-operations-0002',
  invalidatesPendingApprovals: true,
  kind: 'admin-permission-impact-projection' as const,
  projectedAt: observedAt,
  sessionReferences: contractList('session-administrator-operations-0002'),
} satisfies AdminPermissionImpactProjectionJson);

const liveAuthority = Object.freeze({
  canMutate: true,
  requiresRefetch: false,
  state: 'live' as const,
});
const liveModel = Object.freeze({
  approvals,
  authority: liveAuthority,
  conflict: false,
  members,
  observedAt,
} satisfies GovernanceWorkspaceModel);

const authorityModel = (
  state: 'reconnecting' | 'stale' | 'degraded' | 'offline',
): GovernanceWorkspaceModel =>
  Object.freeze({
    ...liveModel,
    authority: Object.freeze({ canMutate: false, requiresRefetch: true, state }),
  });

const riskModel = (risk: AdminRiskLevelJson): GovernanceWorkspaceModel =>
  Object.freeze({
    ...liveModel,
    approvals: Object.freeze(approvals.filter((item) => item.risk === risk)),
    selectedId: 'administrator-operations-0002',
  });

const longModel = Object.freeze({
  ...liveModel,
  members: Object.freeze([
    member(
      'administrator-product-configuration-south-america-competitive-operations-0004',
      'Responsável por configuração de produto e operações competitivas da América do Sul',
      {
        activeFunction: 'product-configuration',
        functions: contractList('product-configuration', 'operations'),
      },
    ),
  ]),
} satisfies GovernanceWorkspaceModel);

interface StoryProps {
  readonly locale: 'pt-BR' | 'en';
  readonly model: GovernanceWorkspaceModel;
  readonly mutation: AdminMutationResult | null;
  readonly state: 'loading' | 'ready' | 'error';
  readonly textScale: boolean;
}

const GovernanceStory = ({ locale, model, mutation, state, textScale }: StoryProps) => {
  const [selectedId, setSelectedId] = useState(model.selectedId);
  useEffect(() => {
    setSelectedId(model.selectedId);
  }, [model]);
  const interactiveModel = useMemo(
    () => Object.freeze({ ...model, ...(selectedId === undefined ? {} : { selectedId }) }),
    [model, selectedId],
  );

  return (
    <div style={textScale ? { fontSize: '200%' } : undefined}>
      {state === 'loading' ? (
        <AdminAccessGovernanceView locale={locale} state="loading" />
      ) : state === 'error' ? (
        <AdminAccessGovernanceView code="authority-unavailable" locale={locale} state="error" />
      ) : (
        <AdminAccessGovernanceView
          locale={locale}
          model={interactiveModel}
          mutation={mutation}
          onAction={() => undefined}
          onRefresh={() => undefined}
          onSelect={setSelectedId}
          state="ready"
        />
      )}
    </div>
  );
};

const meta = {
  args: {
    locale: 'pt-BR',
    model: liveModel,
    mutation: null,
    state: 'ready',
    textScale: false,
  },
  component: GovernanceStory,
  parameters: { layout: 'fullscreen' },
  title: 'Admin/People/Access Governance',
} satisfies Meta<typeof GovernanceStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Live: Story = {};
export const Loading: Story = { args: { state: 'loading' } };
export const Empty: Story = {
  args: {
    model: Object.freeze({
      ...liveModel,
      approvals: Object.freeze([]),
      members: Object.freeze([]),
    }),
  },
};
export const Error: Story = { args: { state: 'error' } };
export const Reconnecting: Story = { args: { model: authorityModel('reconnecting') } };
export const Stale: Story = { args: { model: authorityModel('stale') } };
export const Degraded: Story = { args: { model: authorityModel('degraded') } };
export const Offline: Story = { args: { model: authorityModel('offline') } };
export const Conflict: Story = {
  args: {
    model: Object.freeze({ ...liveModel, conflict: true }),
    mutation: Object.freeze({ code: 'conflict', status: 'conflict' }),
  },
};
export const RoutineApproval: Story = { args: { model: riskModel('low') } };
export const SensitiveApproval: Story = { args: { model: riskModel('high') } };
export const CriticalApproval: Story = { args: { model: riskModel('critical') } };
export const IrreversibleApproval: Story = { args: { model: riskModel('irreversible') } };
export const PendingApproval: Story = { args: { model: riskModel('critical') } };
export const ExpiredApproval: Story = {
  args: {
    model: Object.freeze({
      ...liveModel,
      approvals: Object.freeze([approval('approval-expired-0005', 'critical', 'expired')]),
    }),
  },
};
export const ReassignedApproval: Story = {
  args: {
    model: Object.freeze({
      ...liveModel,
      approvals: Object.freeze([
        approval('approval-reassigned-0006', 'high', 'pending', {
          eligibleApproverReferences: contractList('administrator-audit-0005'),
        }),
      ]),
    }),
  },
};
export const PermissionImpact: Story = {
  args: {
    model: Object.freeze({
      ...liveModel,
      impact,
      selectedId: 'administrator-operations-0002',
    }),
  },
};
export const ReadOnlySimulation: Story = {
  args: {
    model: Object.freeze({
      ...liveModel,
      selectedId: 'administrator-owner-0001',
      simulatedFunction: 'security',
    }),
  },
};
export const English: Story = { args: { locale: 'en' } };
export const LongLocalizedLabels: Story = { args: { model: longModel } };
export const InspectorAndFocusReturn: Story = {
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector<HTMLButtonElement>(
      'section[aria-labelledby="team-title"] li button',
    );
    if (trigger === null) throw new globalThis.Error('Member trigger was not rendered.');
    trigger.click();
    await new Promise((resolve) => globalThis.setTimeout(resolve, 0));
    const close = canvasElement.querySelector<HTMLButtonElement>(
      'button[aria-label="Fechar detalhe do membro"]',
    );
    if (close === null) throw new globalThis.Error('Member inspector did not open.');
    close.click();
    await new Promise((resolve) => globalThis.setTimeout(resolve, 0));
    if (document.activeElement !== trigger)
      throw new globalThis.Error('Focus did not return to the member trigger.');
  },
};
export const Tablet: Story = { parameters: { viewport: { defaultViewport: 'tablet1024' } } };
export const Mobile: Story = { parameters: { viewport: { defaultViewport: 'mobile390' } } };
export const ForcedColors: Story = { globals: { contrast: 'forced' } };
export const ReducedMotion: Story = { globals: { motion: 'reduced' } };
export const TextAtTwoHundredPercent: Story = {
  args: { model: longModel, textScale: true },
};
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
