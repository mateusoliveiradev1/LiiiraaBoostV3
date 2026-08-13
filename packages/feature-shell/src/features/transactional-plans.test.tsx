// @ts-expect-error The approved runtime includes react-dom; @types/react-dom is intentionally absent.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type {
  PlanApprovalDocumentJson,
  ProgressSnapshotDocumentJson,
  TransactionalPlanDocumentJson,
  TransactionalRecoveryDocumentJson,
} from '@liiiraa/contracts-ts';
import type { PlanAuthority, PlanAuthoritySnapshot } from '@liiiraa/desktop-client';

import { ImproveSurface } from './improve.js';

const NOW = '2026-08-13T16:00:00Z';
const HASH_A = `sha256:${'a'.repeat(64)}`;
const HASH_B = `sha256:${'b'.repeat(64)}`;
const HASH_C = `sha256:${'c'.repeat(64)}`;
const HASH_D = `sha256:${'d'.repeat(64)}`;

const observedState = (schemeId: string, canonicalStateHash: string) => ({
  state: 'observed' as const,
  schemeId,
  canonicalStateHash,
  observedAt: NOW,
});

const operation = (
  operationVersionId: string,
  risk: 'verified' | 'advanced' | 'experimental' | 'extreme-locked',
  dependencyGroupId: string,
) => ({
  operationVersionId,
  operationKind: 'managed-power-scheme-v1' as const,
  purpose: `Purpose for ${operationVersionId}`,
  expectedImpact: `Expected direction for ${operationVersionId}`,
  risk,
  evidence: [
    {
      evidenceId: `evidence-${operationVersionId}`,
      evidenceHash: HASH_B,
      capturedAt: NOW,
      validUntil: '2026-08-13T17:00:00Z',
      quality: 'valid' as const,
    },
  ] as const,
  compatibility: {
    verdict: 'compatible' as const,
    reasons: [`Compatible reason for ${operationVersionId}`] as const,
  },
  restartEffect: risk === 'advanced' ? ('required' as const) : ('none' as const),
  previousValue: observedState('11111111-1111-4111-8111-111111111111', HASH_A),
  requestedValue: observedState('22222222-2222-4222-8222-222222222222', HASH_B),
  recoveryMethod: 'exact-prior-scheme' as const,
  dependencyGroupId,
});

const createPlan = (
  effectiveRisk: TransactionalPlanDocumentJson['effectiveRisk'] = 'advanced',
): TransactionalPlanDocumentJson =>
  ({
    kind: 'transactional-plan',
    schemaVersion: '1.0',
    planId: 'plan-authoritative-0001',
    revision: 7,
    revisionFingerprint: HASH_A,
    evidenceFingerprint: HASH_B,
    device: {
      deviceBindingId: 'device-0001',
      hardwareFingerprint: HASH_C,
      securityPostureFingerprint: HASH_D,
    },
    lifecycle: 'awaiting-approval',
    riskCeiling: 'experimental',
    effectiveRisk,
    createdAt: NOW,
    operations: [
      operation('power-base-v1', 'verified', 'group-base'),
      operation('power-advanced-v2', 'advanced', 'group-tuning'),
    ],
    dependencyGroups: [
      {
        dependencyGroupId: 'group-base',
        operationVersionIds: ['power-base-v1'],
        dependsOnGroupIds: [],
      },
      {
        dependencyGroupId: 'group-tuning',
        operationVersionIds: ['power-advanced-v2'],
        dependsOnGroupIds: ['group-base'],
      },
    ],
  }) as unknown as TransactionalPlanDocumentJson;

const createApproval = (revision = 7): PlanApprovalDocumentJson => ({
  kind: 'plan-approval',
  schemaVersion: '1.0',
  approvalId: 'approval-0001',
  planId: 'plan-authoritative-0001',
  planRevision: revision,
  revisionFingerprint: revision === 7 ? HASH_A : HASH_C,
  evidenceFingerprint: HASH_B,
  device: {
    deviceBindingId: 'device-0001',
    hardwareFingerprint: HASH_C,
    securityPostureFingerprint: HASH_D,
  },
  approvedRisk: 'advanced',
  compatibility: 'compatible',
  recoveryCoverage: 'ready',
  intent: 'apply',
  proof: {
    proofReference: 'proof-0001',
    action: 'approve-plan-apply',
    issuedAt: NOW,
    expiresAt: '2026-08-13T16:05:00Z',
  },
  approvedAt: NOW,
  audit: { auditId: 'audit-approval', recordedAt: NOW },
  operationVersionIds: ['power-base-v1', 'power-advanced-v2'],
});

const createSnapshot = (overrides: Partial<PlanAuthoritySnapshot> = {}): PlanAuthoritySnapshot => ({
  revision: 1,
  origin: 'native',
  status: 'ready',
  plan: createPlan(),
  approval: null,
  transaction: null,
  transactionId: null,
  progress: null,
  diagnostic: null,
  sequence: null,
  stale: false,
  error: null,
  ...overrides,
});

const createAuthority = (snapshot: PlanAuthoritySnapshot): PlanAuthority =>
  ({
    origin: 'native',
    snapshot: () => snapshot,
    subscribe: () => () => undefined,
    compose: vi.fn(),
    revise: vi.fn(),
    approve: vi.fn(),
    apply: vi.fn(),
    restoreOperation: vi.fn(),
    restorePlan: vi.fn(),
    restoreCheckpoint: vi.fn(),
    readExecution: vi.fn(),
    subscribeExecution: vi.fn(),
    previewDiagnostic: vi.fn(),
    exportDiagnostic: vi.fn(),
    reconnect: vi.fn(),
    dispose: vi.fn(),
  }) as unknown as PlanAuthority;

describe('authoritative plan review', () => {
  it('renders immutable revision, evidence, mixed-risk dependency order, and every operation field', () => {
    const markup = renderToStaticMarkup(
      <ImproveSurface
        authority={createAuthority(createSnapshot())}
        locale="en"
        scenarioId="S01"
        view="plan-review"
      />,
    );

    expect(markup).toContain('plan-authoritative-0001 · revision 7');
    expect(markup).toContain(HASH_B);
    expect(markup).toContain('Advanced');
    expect(markup).toContain('2');
    expect(markup.indexOf('power-base-v1')).toBeLessThan(markup.indexOf('power-advanced-v2'));
    expect(markup).toContain('Purpose for power-base-v1');
    expect(markup).toContain('Expected direction for power-base-v1');
    expect(markup).toContain('Compatible reason for power-base-v1');
    expect(markup).toContain('11111111-1111-4111-8111-111111111111');
    expect(markup).toContain('22222222-2222-4222-8222-222222222222');
    expect(markup).toContain('exact-prior-scheme');
    expect(markup).not.toMatch(/preview|demo|simulat/iu);
  });

  it('keeps Extreme explanatory and structurally omits apply and confirmation controls', () => {
    const markup = renderToStaticMarkup(
      <ImproveSurface
        authority={createAuthority(createSnapshot({ plan: createPlan('extreme-locked') }))}
        locale="en"
        scenarioId="S01"
        view="confirmation"
      />,
    );

    expect(markup).toContain('Extreme operations remain visible for explanation only');
    expect(markup).not.toMatch(/Apply verified plan|APPLY EXPERIMENTAL PLAN/u);
  });
});

describe('approval authority', () => {
  it('shows an exact stale approval diff, a focus target, and an adjacent apply blocker', () => {
    const markup = renderToStaticMarkup(
      <ImproveSurface
        authority={createAuthority(createSnapshot({ approval: createApproval(6) }))}
        locale="en"
        scenarioId="S01"
        view="confirmation"
      />,
    );

    expect(markup).toContain('The plan changed after approval');
    expect(markup).toContain('Review the differences before confirming again.');
    expect(markup).toContain('tabindex="-1"');
    expect(markup).toContain('Approved revision');
    expect(markup).toContain('Current revision');
    expect(markup).toContain('aria-describedby="plan-apply-blocker"');
    expect(markup).toContain('disabled=""');
  });

  it('renders exact bilingual confirmation copy without accepting renderer authority booleans', () => {
    const markup = renderToStaticMarkup(
      <ImproveSurface
        approvalProofReference="proof-native-reference"
        authority={createAuthority(createSnapshot())}
        locale="pt-BR"
        scenarioId="S01"
        view="confirmation"
      />,
    );

    expect(markup).toContain('Limite máximo de risco');
    expect(markup).toContain('Aplicar plano verificado');
    expect(markup).not.toContain('strongAuth');
  });
});

describe('authoritative execution', () => {
  it('uses named native stages and withholds success when no immutable receipt exists', () => {
    const progress: ProgressSnapshotDocumentJson = {
      kind: 'progress-snapshot',
      schemaVersion: '1.0',
      transactionId: 'transaction-apply',
      sequence: 8,
      state: 'completed',
      completedOperations: 2,
      totalOperations: 2,
      currentOperationVersionId: 'power-advanced-v2',
      updatedAt: NOW,
      displayText: 'Native execution reached completed state.',
    };
    const markup = renderToStaticMarkup(
      <ImproveSurface
        authority={createAuthority(
          createSnapshot({
            approval: createApproval(),
            transaction: {
              kind: 'plan-transaction',
              schemaVersion: '1.0',
              transactionId: 'transaction-apply',
              planId: 'plan-authoritative-0001',
              planRevision: 7,
              revisionFingerprint: HASH_A,
              approvalId: 'approval-0001',
              intent: 'apply',
              startedAt: NOW,
              audit: { auditId: 'audit-transaction', recordedAt: NOW },
            },
            transactionId: 'transaction-apply',
            progress,
            sequence: 8,
          }),
        )}
        locale="en"
        scenarioId="S01"
        validatedDocuments={[] satisfies readonly TransactionalRecoveryDocumentJson[]}
        view="confirmation"
      />,
    );

    expect(markup).toContain('Preparing recovery');
    expect(markup).toContain('Applying');
    expect(markup).toContain('Observing Windows');
    expect(markup).toContain('Verifying result');
    expect(markup).toContain('Verified receipt pending');
    expect(markup).not.toContain('Plan applied and verified');
    expect(markup).not.toContain('data-progress-percentage');
  });
});
