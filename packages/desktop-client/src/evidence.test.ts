import { describe, expect, it, vi } from 'vitest';

import type {
  EvidenceComparisonJson,
  EvidenceReportJson,
  IncompleteMeasurementSessionJson,
  InventorySnapshotJson,
} from '@liiiraa/contracts-ts';

import {
  EVIDENCE_COMMANDS,
  createDeterministicEvidenceAuthority,
  createTauriEvidenceAuthority,
  type EvidenceInvoke,
  type EvidenceInvokeCommand,
} from './evidence.js';

const NOW = '2026-08-12T12:00:00Z';
const HASH_A = `sha256:${'a'.repeat(64)}`;
const HASH_B = `sha256:${'b'.repeat(64)}`;

const execution = Object.freeze({
  sourceCapability: 'native-readonly',
  deadlineAt: '2026-08-12T12:00:10Z',
  cancellationState: 'not-requested',
  health: Object.freeze({
    state: 'healthy',
    checkedAt: NOW,
    detail: 'Collector ready.',
  }),
  overhead: Object.freeze({
    sampleWindowMs: 1_000,
    cpuTimeMs: 8,
    peakWorkingSetBytes: '8388608',
    quality: 'valid',
  }),
} as const);

const observed = (value: string) =>
  Object.freeze({
    state: 'observed',
    value,
    source: 'windows-native-api',
    observedAt: NOW,
  } as const);

const inventory = (evidenceId = 'inventory-1'): InventorySnapshotJson =>
  Object.freeze({
    kind: 'inventory-snapshot',
    schemaVersion: '1.0',
    evidenceId,
    evidenceVersion: 1,
    collectedAt: NOW,
    evidenceHash: HASH_A,
    execution,
    cpu: observed('AMD Ryzen 7 7800X3D'),
    gpu: observed('NVIDIA GeForce RTX 4070'),
    memory: observed('32 GiB'),
    storage: observed('NVMe SSD'),
    network: observed('Ethernet'),
    display: observed('2560x1440@144'),
    audio: observed('USB audio'),
    usb: observed('4 controllers'),
    windows: observed('Windows 11 Pro 24H2'),
    drivers: observed('12 signed packages'),
    security: observed('Secure Boot enabled'),
    games: observed('2 discovered'),
  });

const capture: IncompleteMeasurementSessionJson = Object.freeze({
  kind: 'measurement-session',
  schemaVersion: '1.0',
  sessionId: 'session-1',
  evidenceVersion: 1,
  status: 'incomplete',
  startedAt: NOW,
  execution,
  baseline: Object.freeze({
    baselineId: 'baseline-1',
    inventoryEvidenceId: 'inventory-1',
    inventoryEvidenceHash: HASH_A,
    capturedAt: NOW,
  }),
  chunks: [],
  reason: 'Capture is active.',
});

const comparison: EvidenceComparisonJson = Object.freeze({
  kind: 'comparison',
  schemaVersion: '1.0',
  comparisonId: 'comparison-1',
  state: 'accepted',
  beforeSessionId: 'session-before',
  afterSessionId: 'session-after',
  comparedAt: NOW,
  acceptedResult: Object.freeze({
    metric: 'frame-time-ms',
    unit: 'milliseconds',
    before: 8.4,
    after: 7.2,
    delta: -1.2,
    quality: 'valid',
    evidenceHash: HASH_B,
  }),
});

const report: EvidenceReportJson = Object.freeze({
  kind: 'evidence-report',
  schemaVersion: '1.0',
  reportId: 'report-1',
  evidenceVersion: 1,
  generatedAt: NOW,
  evidenceIds: ['comparison-1'] as [string],
  evidenceHashes: [HASH_B] as [string],
  provenance: Object.freeze({ source: 'local-evidence-store', collectedAt: NOW }),
  limitations: ['Valid only for the admitted sessions.'] as [string],
});

const refreshInput = (signal?: AbortSignal) => ({
  request: Object.freeze({
    schemaVersion: '1.0' as const,
    evidenceId: 'inventory-1',
    evidenceVersion: 1,
    collectedAt: NOW,
    deadlineAt: '2026-08-12T12:00:10Z',
    perSourceTimeoutMs: 500,
    policyDate: 20260812,
  }),
  ...(signal === undefined ? {} : { signal }),
});

const startInput = {
  request: Object.freeze({
    schemaVersion: '1.0' as const,
    sessionId: 'session-1',
    evidenceVersion: 1,
    startedAt: NOW,
    deadlineAt: '2026-08-12T12:05:00Z',
    baselineId: 'baseline-1',
    inventoryEvidenceId: 'inventory-1',
    inventoryEvidenceHash: HASH_A,
    collectorVersion: '1.0.0',
  }),
};

const compareInput = {
  request: Object.freeze({
    schemaVersion: '1.0' as const,
    comparisonId: 'comparison-1',
    before: Object.freeze({
      sessionId: 'session-before',
      evidenceHash: HASH_A,
      inventoryEvidenceId: 'inventory-1',
      inventoryEvidenceHash: HASH_A,
      workloadId: 'workload-1',
      environmentId: 'environment-1',
      methodologyId: 'methodology-1',
      durationMs: 60_000,
      coveragePpm: 1_000_000,
      sourceHealthy: true,
      quality: 'valid' as const,
      metric: Object.freeze({
        kind: 'frame-time-ms' as const,
        unit: 'milliseconds' as const,
        value: 8.4,
        quality: 'valid' as const,
      }),
    }),
    after: Object.freeze({
      sessionId: 'session-after',
      evidenceHash: HASH_B,
      inventoryEvidenceId: 'inventory-1',
      inventoryEvidenceHash: HASH_A,
      workloadId: 'workload-1',
      environmentId: 'environment-1',
      methodologyId: 'methodology-1',
      durationMs: 60_000,
      coveragePpm: 1_000_000,
      sourceHealthy: true,
      quality: 'valid' as const,
      metric: Object.freeze({
        kind: 'frame-time-ms' as const,
        unit: 'milliseconds' as const,
        value: 7.2,
        quality: 'valid' as const,
      }),
    }),
    comparedAt: NOW,
  }),
};

type Script = Partial<Record<EvidenceInvokeCommand, unknown | (() => Promise<unknown>)>>;

const scriptedInvoke = (script: Script): EvidenceInvoke =>
  vi.fn(async (command: EvidenceInvokeCommand) => {
    const response = script[command];
    return typeof response === 'function' ? response() : response;
  });

const conformingScript = (): Script => ({
  [EVIDENCE_COMMANDS.refreshInventory]: inventory(),
  [EVIDENCE_COMMANDS.readInventory]: inventory(),
  [EVIDENCE_COMMANDS.startCapture]: capture,
  [EVIDENCE_COMMANDS.sampleCapture]: Object.freeze({
    schemaVersion: '1.0',
    readOnly: true,
    cpu: Object.freeze({ state: 'observed' }),
    memory: Object.freeze({ state: 'observed' }),
    gpu: Object.freeze({ state: 'unavailable' }),
    collectionLatency: Object.freeze({ state: 'observed' }),
  }),
  [EVIDENCE_COMMANDS.cancelCapture]: Object.freeze({ state: 'acknowledged', latencyMs: 100 }),
  [EVIDENCE_COMMANDS.finishCapture]: capture,
  [EVIDENCE_COMMANDS.compareSessions]: comparison,
  [EVIDENCE_COMMANDS.renderReport]: report,
  [EVIDENCE_COMMANDS.exportReport]: Object.freeze({
    reportId: 'report-1',
    format: 'json',
    fileName: 'report-1.json',
    stored: true,
  }),
  [EVIDENCE_COMMANDS.readHealth]: Object.freeze({
    authority: 'available',
    inventory: 'ready',
    capture: 'idle',
    comparisons: 1,
    reports: 1,
    overhead: Object.freeze({
      counterPollCeilingHz: 1,
      cancellationBudgetMs: 250,
      elevated: false,
    }),
  }),
});

describe.each([
  ['native', (invoke: EvidenceInvoke) => createTauriEvidenceAuthority({ invoke })],
  ['deterministic', (invoke: EvidenceInvoke) => createDeterministicEvidenceAuthority({ invoke })],
] as const)('%s evidence adapter conformance', (_name, createAuthority) => {
  it('shares immutable refresh, capture, compare, export and health semantics', async () => {
    const invoke = scriptedInvoke(conformingScript());
    const authority = createAuthority(invoke);

    const refreshed = await authority.refreshInventory(refreshInput());
    const started = await authority.startCapture(startInput);
    const sampled = await authority.sampleCapture();
    const cancelled = await authority.cancelCapture({
      request: { schemaVersion: '1.0', monotonicNs: 1_000_000 },
    });
    authority.setComparisonSelection('session-before', 'session-after');
    const compared = await authority.compareSessions(compareInput);
    const rendered = await authority.renderReport({
      request: {
        schemaVersion: '1.0',
        reportId: 'report-1',
        comparisonId: 'comparison-1',
        generatedAt: NOW,
        limitations: ['Valid only for the admitted sessions.'],
      },
    });
    const exported = await authority.exportReport({
      request: {
        schemaVersion: '1.0',
        reportId: 'report-1',
        format: 'json',
        fileName: 'report-1.json',
      },
    });
    const health = await authority.readHealth();

    expect([refreshed, started, sampled, cancelled, compared, rendered, exported, health]).toEqual(
      expect.arrayContaining([expect.objectContaining({ ok: true })]),
    );
    expect(Object.isFrozen(authority.snapshot())).toBe(true);
    expect(Object.isFrozen(authority.snapshot().inventory)).toBe(true);
    expect(authority.snapshot().comparison).toBe(compared.ok ? compared.value : undefined);
    expect(authority.snapshot().selection).toEqual({
      beforeSessionId: 'session-before',
      afterSessionId: 'session-after',
    });
    expect(invoke).toHaveBeenCalledWith(EVIDENCE_COMMANDS.refreshInventory, {
      request: refreshInput().request,
    });
    expect(invoke).toHaveBeenCalledWith(EVIDENCE_COMMANDS.sampleCapture, undefined);
  });
});

describe('evidence authority state and truth', () => {
  it('retains admitted evidence and stable selections while refresh is pending', async () => {
    let release: ((value: unknown) => void) | undefined;
    const pending = new Promise<unknown>((resolve) => {
      release = resolve;
    });
    const invoke = scriptedInvoke({
      [EVIDENCE_COMMANDS.refreshInventory]: inventory('inventory-original'),
    });
    const authority = createTauriEvidenceAuthority({ invoke });
    await authority.refreshInventory(refreshInput());
    authority.setComparisonSelection('before-stable', 'after-stable');
    vi.mocked(invoke).mockImplementationOnce(async () => pending);

    const refresh = authority.refreshInventory(refreshInput());
    expect(authority.snapshot()).toMatchObject({
      status: 'refreshing',
      staleInventory: true,
      inventoryActionable: false,
      inventory: { evidenceId: 'inventory-original' },
      selection: { beforeSessionId: 'before-stable', afterSessionId: 'after-stable' },
    });

    release?.(inventory('inventory-new'));
    await expect(refresh).resolves.toMatchObject({ ok: true });
    expect(authority.snapshot().inventory?.evidenceId).toBe('inventory-new');
  });

  it('honors refresh cancellation without admitting a late response', async () => {
    let release: ((value: unknown) => void) | undefined;
    const pending = new Promise<unknown>((resolve) => {
      release = resolve;
    });
    const invoke = scriptedInvoke({
      [EVIDENCE_COMMANDS.refreshInventory]: () => pending,
    });
    const authority = createTauriEvidenceAuthority({ invoke });
    const controller = new AbortController();

    const refresh = authority.refreshInventory(refreshInput(controller.signal));
    controller.abort();
    await expect(refresh).resolves.toEqual({ ok: false, error: { code: 'CANCELLED' } });
    release?.(inventory('inventory-too-late'));
    await Promise.resolve();
    expect(authority.snapshot().inventory).toBeNull();
  });

  it('recursively rejects fixture provenance in production with a stable path', async () => {
    const malicious = {
      ...inventory(),
      cpu: {
        ...observed('spoofed'),
        provenance: { nested: [{ kind: 'fixture', scenarioId: 'S01' }] },
      },
    };
    const authority = createTauriEvidenceAuthority({
      invoke: scriptedInvoke({ [EVIDENCE_COMMANDS.refreshInventory]: malicious }),
    });

    await expect(authority.refreshInventory(refreshInput())).resolves.toEqual({
      ok: false,
      error: {
        code: 'FIXTURE_PROVENANCE_REFUSED',
        path: '$.cpu.provenance.nested[0]',
      },
    });
    expect(authority.snapshot()).toMatchObject({ inventory: null, inventoryActionable: false });
  });

  it('keeps the last admitted snapshot when a malformed refresh fails', async () => {
    const invoke = scriptedInvoke({
      [EVIDENCE_COMMANDS.refreshInventory]: inventory('inventory-admitted'),
    });
    const authority = createTauriEvidenceAuthority({ invoke });
    await authority.refreshInventory(refreshInput());
    vi.mocked(invoke).mockResolvedValueOnce({ kind: 'inventory-snapshot', schemaVersion: '999' });

    const result = await authority.refreshInventory(refreshInput());
    expect(result).toMatchObject({ ok: false, error: { code: 'CONTRACT_INVALID' } });
    expect(authority.snapshot()).toMatchObject({
      inventory: { evidenceId: 'inventory-admitted' },
      staleInventory: true,
      inventoryActionable: false,
    });
  });

  it('cleans subscriptions and never notifies an unsubscribed consumer', async () => {
    const authority = createDeterministicEvidenceAuthority({
      invoke: scriptedInvoke(conformingScript()),
    });
    const listener = vi.fn();
    const unsubscribe = authority.subscribe(listener);
    unsubscribe();

    await authority.refreshInventory(refreshInput());
    expect(listener).not.toHaveBeenCalled();
  });
});
