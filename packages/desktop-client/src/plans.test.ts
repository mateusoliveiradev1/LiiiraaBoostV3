import { describe, expect, it, vi } from 'vitest';

import type {
  PlanApprovalDocumentJson,
  PlanTransactionDocumentJson,
  ProgressEventDocumentJson,
  ProgressSnapshotDocumentJson,
  RedactedDiagnosticExportDocumentJson,
  TransactionalPlanDocumentJson,
} from '@liiiraa/contracts-ts';

import {
  PLAN_COMMANDS,
  createDeterministicPlanAuthority,
  createTauriPlanAuthority,
  type PlanEventSubscribe,
  type PlanInvoke,
  type PlanInvokeCommand,
} from './plans.js';

const NOW = '2026-08-13T10:00:00Z';
const HASH_A = `sha256:${'a'.repeat(64)}`;
const HASH_B = `sha256:${'b'.repeat(64)}`;
const HASH_C = `sha256:${'c'.repeat(64)}`;
const HASH_D = `sha256:${'d'.repeat(64)}`;
const PRIOR_SCHEME = '11111111-1111-4111-8111-111111111111';
const REQUESTED_SCHEME = '22222222-2222-4222-8222-222222222222';

const device = Object.freeze({
  deviceBindingId: 'device-0001',
  hardwareFingerprint: HASH_C,
  securityPostureFingerprint: HASH_D,
});

const exactState = (schemeId: string, hash: string) =>
  Object.freeze({
    state: 'observed' as const,
    schemeId,
    canonicalStateHash: hash,
    observedAt: NOW,
  });

const plan = (revision = 1): TransactionalPlanDocumentJson =>
  Object.freeze({
    kind: 'transactional-plan',
    schemaVersion: '1.0',
    planId: 'plan-0001',
    revision,
    revisionFingerprint: HASH_A,
    evidenceFingerprint: HASH_B,
    device,
    lifecycle: 'composed',
    riskCeiling: 'advanced',
    effectiveRisk: 'verified',
    createdAt: NOW,
    operations: [
      Object.freeze({
        operationVersionId: 'power-scheme-v1',
        operationKind: 'managed-power-scheme-v1',
        purpose: 'Activate a separately owned power scheme.',
        expectedImpact: 'Establish reversible power-policy authority.',
        risk: 'verified',
        evidence: [
          Object.freeze({
            evidenceId: 'inventory-0001',
            evidenceHash: HASH_B,
            capturedAt: NOW,
            validUntil: '2026-08-13T11:00:00Z',
            quality: 'valid',
          }),
        ],
        compatibility: Object.freeze({
          verdict: 'compatible',
          reasons: ['The exact Windows capability was observed.'],
        }),
        restartEffect: 'none',
        previousValue: exactState(PRIOR_SCHEME, HASH_A),
        requestedValue: exactState(REQUESTED_SCHEME, HASH_B),
        recoveryMethod: 'exact-prior-scheme',
        dependencyGroupId: 'group-0001',
      }),
    ],
    dependencyGroups: [
      Object.freeze({
        dependencyGroupId: 'group-0001',
        operationVersionIds: ['power-scheme-v1'],
        dependsOnGroupIds: [],
      }),
    ],
  }) as TransactionalPlanDocumentJson;

const approval = Object.freeze({
  kind: 'plan-approval',
  schemaVersion: '1.0',
  approvalId: 'approval-0001',
  planId: 'plan-0001',
  planRevision: 1,
  revisionFingerprint: HASH_A,
  evidenceFingerprint: HASH_B,
  device,
  approvedRisk: 'verified',
  compatibility: 'compatible',
  recoveryCoverage: 'ready',
  intent: 'apply',
  proof: Object.freeze({
    proofReference: 'proof-0001',
    action: 'approve-plan-apply',
    issuedAt: NOW,
    expiresAt: '2026-08-13T10:05:00Z',
  }),
  approvedAt: NOW,
  audit: Object.freeze({ auditId: 'audit-0001', recordedAt: NOW }),
  operationVersionIds: ['power-scheme-v1'],
}) as PlanApprovalDocumentJson;

const transaction = (intent: PlanTransactionDocumentJson['intent']): PlanTransactionDocumentJson =>
  Object.freeze({
    kind: 'plan-transaction',
    schemaVersion: '1.0',
    transactionId: `transaction-${intent}`,
    planId: 'plan-0001',
    planRevision: 1,
    revisionFingerprint: HASH_A,
    approvalId: 'approval-0001',
    intent,
    startedAt: NOW,
    audit: Object.freeze({ auditId: `audit-${intent}`, recordedAt: NOW }),
  });

const progress = (sequence = 1): ProgressSnapshotDocumentJson =>
  Object.freeze({
    kind: 'progress-snapshot',
    schemaVersion: '1.0',
    transactionId: 'transaction-apply',
    sequence,
    state: sequence >= 3 ? 'completed' : 'applying',
    completedOperations: sequence >= 3 ? 1 : 0,
    totalOperations: 1,
    currentOperationVersionId: 'power-scheme-v1',
    updatedAt: NOW,
    displayText: sequence >= 3 ? 'Plan completed and verified.' : 'Applying plan.',
  });

const event = (sequence: number, previousSequence = sequence - 1): ProgressEventDocumentJson =>
  Object.freeze({
    kind: 'progress-event',
    schemaVersion: '1.0',
    eventId: `progress-${String(sequence)}`,
    transactionId: 'transaction-apply',
    sequence,
    ...(sequence === 0 ? {} : { previousSequence }),
    state: sequence >= 3 ? 'completed' : 'verifying',
    occurredAt: NOW,
    operationVersionId: 'power-scheme-v1',
    displayText: sequence >= 3 ? 'Plan completed and verified.' : 'Verifying state.',
  });

const diagnostic = Object.freeze({
  kind: 'redacted-diagnostic-export',
  schemaVersion: '1.0',
  exportId: 'export-0001',
  planId: 'plan-0001',
  generatedAt: NOW,
  journalHeadHash: HASH_A,
  entries: [
    Object.freeze({
      eventId: 'event-0001',
      transactionId: 'transaction-apply',
      operationVersionId: 'power-scheme-v1',
      state: 'completed',
      occurredAt: NOW,
      eventHash: HASH_A,
    }),
  ],
  redactionsApplied: ['credentials', 'raw-hardware-identifiers'],
  audit: Object.freeze({ auditId: 'audit-export', recordedAt: NOW }),
}) as RedactedDiagnosticExportDocumentJson;

const composeInput = Object.freeze({
  request: Object.freeze({
    goalReferences: ['gaming-latency'],
    evidenceReferences: ['inventory-0001'],
    riskCeiling: 'advanced' as const,
  }),
});

const reviseInput = Object.freeze({
  request: Object.freeze({
    planId: 'plan-0001',
    planRevision: 1,
    changeReferences: ['exclude-restart-required'],
  }),
});

const approveInput = Object.freeze({
  request: Object.freeze({
    planId: 'plan-0001',
    planRevision: 1,
    intent: 'apply' as const,
    proofReference: 'proof-0001',
  }),
});

const applyInput = Object.freeze({
  request: Object.freeze({
    planId: 'plan-0001',
    planRevision: 1,
    approvalId: 'approval-0001',
  }),
});

type Script = Partial<Record<PlanInvokeCommand, unknown | (() => Promise<unknown>)>>;

const scriptedInvoke = (script: Script): PlanInvoke =>
  vi.fn(async (command: PlanInvokeCommand) => {
    const response = script[command];
    return typeof response === 'function' ? response() : response;
  });

const conformingScript = (): Script => ({
  [PLAN_COMMANDS.compose]: plan(),
  [PLAN_COMMANDS.revise]: plan(2),
  [PLAN_COMMANDS.approve]: approval,
  [PLAN_COMMANDS.apply]: transaction('apply'),
  [PLAN_COMMANDS.restoreOperation]: transaction('restore-operation'),
  [PLAN_COMMANDS.restorePlan]: transaction('restore-plan'),
  [PLAN_COMMANDS.restoreCheckpoint]: transaction('restore-checkpoint'),
  [PLAN_COMMANDS.readExecution]: progress(),
  [PLAN_COMMANDS.previewDiagnostic]: diagnostic,
  [PLAN_COMMANDS.exportDiagnostic]: diagnostic,
});

const inertSubscribe: PlanEventSubscribe = vi.fn(async () => () => undefined);

describe('plan command registry', () => {
  it('contains only named plan, recovery, progress, and diagnostic intents', () => {
    expect(PLAN_COMMANDS).toEqual({
      compose: 'compose_plan',
      revise: 'revise_plan',
      approve: 'approve_plan',
      apply: 'apply_plan',
      restoreOperation: 'restore_plan_operation',
      restorePlan: 'restore_plan',
      restoreCheckpoint: 'restore_recovery_checkpoint',
      readExecution: 'read_plan_execution',
      subscribeExecution: 'subscribe_plan_execution',
      previewDiagnostic: 'preview_plan_diagnostic',
      exportDiagnostic: 'export_plan_diagnostic',
    });
    expect(Object.values(PLAN_COMMANDS)).not.toEqual(
      expect.arrayContaining([
        expect.stringMatching(/(?:execute|registry|file|service|powershell|script|shell)/iu),
      ]),
    );
  });
});

describe.each([
  [
    'native',
    (invoke: PlanInvoke, subscribe: PlanEventSubscribe) =>
      createTauriPlanAuthority({ invoke, subscribe }),
  ],
  [
    'deterministic',
    (invoke: PlanInvoke, subscribe: PlanEventSubscribe) =>
      createDeterministicPlanAuthority({ invoke, subscribe }),
  ],
] as const)('%s plan adapter conformance', (origin, createAuthority) => {
  it('validates, freezes, and preserves identity across every closed operation', async () => {
    const invoke = scriptedInvoke(conformingScript());
    const authority = createAuthority(invoke, inertSubscribe);

    const composed = await authority.compose(composeInput);
    const revised = await authority.revise(reviseInput);
    const approved = await authority.approve(approveInput);
    const applied = await authority.apply(applyInput);
    const restoredOperation = await authority.restoreOperation({
      request: { planId: 'plan-0001', operationVersionId: 'power-scheme-v1' },
    });
    const restoredPlan = await authority.restorePlan({ request: { planId: 'plan-0001' } });
    const restoredCheckpoint = await authority.restoreCheckpoint({
      request: { checkpointId: 'checkpoint-0001' },
    });
    const read = await authority.readExecution({ transactionId: 'transaction-apply' });
    const previewed = await authority.previewDiagnostic({ request: { planId: 'plan-0001' } });
    const exported = await authority.exportDiagnostic({
      request: { planId: 'plan-0001', exportId: 'export-0001' },
    });

    const results = [
      composed,
      revised,
      approved,
      applied,
      restoredOperation,
      restoredPlan,
      restoredCheckpoint,
      read,
      previewed,
      exported,
    ];
    expect(results.every((result) => result.ok)).toBe(true);
    expect(authority.origin).toBe(origin);
    expect(authority.snapshot()).toMatchObject({ origin, stale: false, sequence: 1 });
    expect(Object.isFrozen(authority.snapshot())).toBe(true);
    expect(Object.isFrozen(authority.snapshot().plan)).toBe(true);
    expect(Object.isFrozen(authority.snapshot().plan?.operations[0]?.evidence[0])).toBe(true);
    expect(Object.isFrozen(authority.snapshot().progress)).toBe(true);
    expect(invoke).toHaveBeenCalledWith(PLAN_COMMANDS.compose, composeInput);
    expect(invoke).toHaveBeenCalledWith(PLAN_COMMANDS.readExecution, {
      transactionId: 'transaction-apply',
    });
  });

  it('rejects malformed generated documents without changing admitted truth', async () => {
    const invoke = scriptedInvoke({ [PLAN_COMMANDS.compose]: plan() });
    const authority = createAuthority(invoke, inertSubscribe);
    await authority.compose(composeInput);
    vi.mocked(invoke).mockResolvedValueOnce({
      kind: 'transactional-plan',
      schemaVersion: '999',
      lifecycle: 'completed',
    });

    const result = await authority.compose(composeInput);

    expect(result).toMatchObject({ ok: false, error: { code: 'CONTRACT_INVALID' } });
    expect(authority.snapshot().plan).toEqual(plan());
  });

  it('allows local recovery without entitlement or authentication claims', async () => {
    const invoke = scriptedInvoke(conformingScript());
    const authority = createAuthority(invoke, inertSubscribe);

    await expect(
      authority.restoreOperation({
        request: { planId: 'plan-0001', operationVersionId: 'power-scheme-v1' },
      }),
    ).resolves.toMatchObject({ ok: true });
    await expect(
      authority.restorePlan({ request: { planId: 'plan-0001' } }),
    ).resolves.toMatchObject({ ok: true });
    await expect(
      authority.restoreCheckpoint({ request: { checkpointId: 'checkpoint-0001' } }),
    ).resolves.toMatchObject({ ok: true });
  });

  it('rejects renderer-owned authority and success claims before invoke', async () => {
    const invoke = scriptedInvoke(conformingScript());
    const authority = createAuthority(invoke, inertSubscribe);
    const result = await authority.compose({
      request: {
        ...composeInput.request,
        compatible: true,
        authenticated: true,
        verified: true,
      },
    } as never);

    expect(result).toEqual({
      ok: false,
      error: { code: 'INTENT_INVALID', path: '$.request.authenticated' },
    });
    expect(invoke).not.toHaveBeenCalled();
  });
});

describe('native plan authority truth boundary', () => {
  it('recursively refuses fixture and scenario markers before immutable projection', async () => {
    const malicious = {
      ...plan(),
      operations: [
        {
          ...plan().operations[0],
          evidence: [
            {
              ...plan().operations[0]!.evidence[0],
              provenance: { nested: [{ scenarioId: 'fixture-plan-success' }] },
            },
          ],
        },
      ],
    };
    const authority = createTauriPlanAuthority({
      invoke: scriptedInvoke({ [PLAN_COMMANDS.compose]: malicious }),
      subscribe: inertSubscribe,
    });

    await expect(authority.compose(composeInput)).resolves.toEqual({
      ok: false,
      error: {
        code: 'FIXTURE_PROVENANCE_REFUSED',
        path: '$.operations[0].evidence[0].provenance.nested[0]',
      },
    });
    expect(authority.snapshot().plan).toBeNull();
  });

  it('never converts a native failure into deterministic success', async () => {
    const authority = createTauriPlanAuthority({
      invoke: vi.fn(async () => {
        throw new Error('native unavailable');
      }),
      subscribe: inertSubscribe,
    });

    await expect(authority.compose(composeInput)).resolves.toEqual({
      ok: false,
      error: { code: 'COMMAND_FAILED', command: PLAN_COMMANDS.compose },
    });
    expect(authority.snapshot()).toMatchObject({ plan: null, status: 'error' });
  });

  it('bounds malformed contract detail and never echoes rejected values', async () => {
    const malformed = Object.fromEntries(
      Array.from({ length: 32 }, (_, index) => [
        `secret-${String(index)}`,
        `value-${String(index)}`,
      ]),
    );
    const authority = createTauriPlanAuthority({
      invoke: scriptedInvoke({ [PLAN_COMMANDS.compose]: malformed }),
      subscribe: inertSubscribe,
    });

    const result = await authority.compose(composeInput);

    expect(result).toMatchObject({ ok: false, error: { code: 'CONTRACT_INVALID' } });
    if (result.ok || result.error.code !== 'CONTRACT_INVALID') {
      throw new Error('Expected a bounded generated-contract error.');
    }
    expect(result.error.issues.length).toBeLessThanOrEqual(8);
    expect(
      result.error.issues.every((issue) => Object.keys(issue).toSorted().join() === 'keyword,path'),
    ).toBe(true);
    expect(JSON.stringify(result.error)).not.toContain('value-');
  });

  it('rejects a valid transaction returned for the wrong closed command', async () => {
    const authority = createTauriPlanAuthority({
      invoke: scriptedInvoke({ [PLAN_COMMANDS.apply]: transaction('restore-plan') }),
      subscribe: inertSubscribe,
    });

    await expect(authority.apply(applyInput)).resolves.toEqual({
      ok: false,
      error: {
        code: 'CONTRACT_INVALID',
        expectedKind: 'plan-transaction',
        issues: [{ path: '$.intent', keyword: 'const' }],
      },
    });
    expect(authority.snapshot().transaction).toBeNull();
  });
});

describe('plan execution continuity', () => {
  it('applies contiguous events and refetches one authoritative snapshot on a gap', async () => {
    const invoke = scriptedInvoke({ [PLAN_COMMANDS.readExecution]: progress(1) });
    let receive: ((payload: unknown) => void) | undefined;
    const subscribe = vi.fn<PlanEventSubscribe>(async (_command, _input, listener) => {
      receive = listener;
      return () => undefined;
    });
    const authority = createTauriPlanAuthority({ invoke, subscribe });
    await authority.readExecution({ transactionId: 'transaction-apply' });
    vi.mocked(invoke).mockResolvedValueOnce(progress(4));
    await authority.subscribeExecution({ transactionId: 'transaction-apply' });

    receive?.(event(2, 1));
    expect(authority.snapshot()).toMatchObject({ sequence: 2, stale: false });
    receive?.(event(4, 3));
    receive?.(event(5, 4));
    await vi.waitFor(() => {
      expect(authority.snapshot()).toMatchObject({ sequence: 4, stale: false });
    });

    expect(invoke).toHaveBeenCalledTimes(2);
    expect(invoke).toHaveBeenNthCalledWith(2, PLAN_COMMANDS.readExecution, {
      transactionId: 'transaction-apply',
    });
    expect(invoke).not.toHaveBeenCalledWith(PLAN_COMMANDS.apply, expect.anything());
  });

  it('deduplicates reload and tray-reopen reads while a refetch is pending', async () => {
    let release: ((value: unknown) => void) | undefined;
    const pending = new Promise<unknown>((resolve) => {
      release = resolve;
    });
    const invoke = scriptedInvoke({ [PLAN_COMMANDS.readExecution]: () => pending });
    const authority = createTauriPlanAuthority({ invoke, subscribe: inertSubscribe });

    const reload = authority.reconnect('transaction-apply');
    const trayReopen = authority.reconnect('transaction-apply');
    expect(authority.snapshot().stale).toBe(true);
    expect(invoke).toHaveBeenCalledTimes(1);
    release?.(progress(3));
    await expect(Promise.all([reload, trayReopen])).resolves.toEqual([
      expect.objectContaining({ ok: true }),
      expect.objectContaining({ ok: true }),
    ]);
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it('deduplicates malformed nested events and reconnect races behind one read gate', async () => {
    let release: ((value: unknown) => void) | undefined;
    const pending = new Promise<unknown>((resolve) => {
      release = resolve;
    });
    const invoke = scriptedInvoke({ [PLAN_COMMANDS.readExecution]: progress(1) });
    let receive: ((payload: unknown) => void) | undefined;
    const subscribe = vi.fn<PlanEventSubscribe>(async (_command, _input, listener) => {
      receive = listener;
      return () => undefined;
    });
    const authority = createTauriPlanAuthority({ invoke, subscribe });
    await authority.readExecution({ transactionId: 'transaction-apply' });
    vi.mocked(invoke).mockImplementation(async () => pending);
    await authority.subscribeExecution({ transactionId: 'transaction-apply' });

    const malformedNested = {
      ...event(2, 1),
      detail: { provenance: [{ fixtureVersion: 'fixture-v1' }] },
    };
    receive?.(malformedNested);
    const trayReopen = authority.reconnect('transaction-apply');
    receive?.(event(4, 3));

    expect(authority.snapshot()).toMatchObject({ sequence: 1, stale: true });
    expect(invoke).toHaveBeenCalledTimes(2);
    release?.(progress(4));
    await expect(trayReopen).resolves.toMatchObject({ ok: true });
    expect(authority.snapshot()).toMatchObject({ sequence: 4, stale: false });
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it('detaches native and local listeners on unsubscribe and dispose', async () => {
    const detachNative = vi.fn();
    const subscribe = vi.fn<PlanEventSubscribe>(async () => detachNative);
    const authority = createDeterministicPlanAuthority({
      invoke: scriptedInvoke(conformingScript()),
      subscribe,
    });
    const listener = vi.fn();
    const detachLocal = authority.subscribe(listener);
    detachLocal();
    const watched = await authority.subscribeExecution({ transactionId: 'transaction-apply' });
    authority.dispose();

    expect(watched).toMatchObject({ ok: true });
    expect(detachNative).toHaveBeenCalledOnce();
    expect(authority.snapshot().status).toBe('disposed');
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('mutation cancellation semantics', () => {
  it('reports cancel-requested before dispatch without invoking mutation', async () => {
    const invoke = scriptedInvoke(conformingScript());
    const authority = createTauriPlanAuthority({ invoke, subscribe: inertSubscribe });
    const controller = new AbortController();
    controller.abort();

    await expect(authority.apply({ ...applyInput, signal: controller.signal })).resolves.toEqual({
      ok: false,
      error: { code: 'CANCEL_REQUESTED', dispatched: false },
    });
    expect(invoke).not.toHaveBeenCalled();
  });

  it('reports unknown after dispatch and reconciles without retrying mutation', async () => {
    let release: ((value: unknown) => void) | undefined;
    const pending = new Promise<unknown>((resolve) => {
      release = resolve;
    });
    const invoke = scriptedInvoke({ [PLAN_COMMANDS.apply]: () => pending });
    const authority = createTauriPlanAuthority({ invoke, subscribe: inertSubscribe });
    const controller = new AbortController();

    const applying = authority.apply({ ...applyInput, signal: controller.signal });
    await vi.waitFor(() => expect(invoke).toHaveBeenCalledWith(PLAN_COMMANDS.apply, applyInput));
    controller.abort();

    await expect(applying).resolves.toEqual({
      ok: false,
      error: { code: 'UNKNOWN_AFTER_DISPATCH', command: PLAN_COMMANDS.apply },
    });
    expect(authority.snapshot()).toMatchObject({ status: 'unknown', stale: true });
    expect(
      vi.mocked(invoke).mock.calls.filter(([command]) => command === PLAN_COMMANDS.apply),
    ).toHaveLength(1);
    release?.(transaction('apply'));
  });
});
