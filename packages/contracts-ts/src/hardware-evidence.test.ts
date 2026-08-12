import { describe, expect, it } from 'vitest';

import {
  hardwareEvidenceDocumentValidator,
  type HardwareEvidenceDocument,
  type HardwareUnavailableReasonJson,
} from './generated/index.js';

const observed = (value: string) =>
  ({
    state: 'observed',
    value,
    source: 'windows-native-api',
    observedAt: '2026-08-12T12:00:00Z',
  }) as const;

const unavailable = (reasonCode: HardwareUnavailableReasonJson = 'not-reported') =>
  ({
    state: 'unavailable',
    reasonCode,
    detail: 'The operating system did not expose this class.',
  }) as const;

const execution = {
  sourceCapability: 'native-readonly',
  deadlineAt: '2026-08-12T12:00:10Z',
  cancellationState: 'not-requested',
  health: {
    state: 'healthy',
    checkedAt: '2026-08-12T12:00:00Z',
    detail: 'Collector ready.',
  },
  overhead: {
    sampleWindowMs: 1_000,
    cpuTimeMs: 12,
    peakWorkingSetBytes: '8388608',
    quality: 'valid',
  },
} as const;

const inventory = {
  kind: 'inventory-snapshot',
  schemaVersion: '1.0',
  evidenceId: 'inventory-0001',
  evidenceVersion: 1,
  collectedAt: '2026-08-12T12:00:01Z',
  evidenceHash: `sha256:${'a'.repeat(64)}`,
  execution,
  cpu: observed('AMD Ryzen 7'),
  gpu: observed('NVIDIA GeForce'),
  memory: observed('32 GiB'),
  storage: observed('NVMe SSD'),
  network: observed('Ethernet'),
  display: observed('2560x1440@144'),
  audio: unavailable(),
  usb: observed('4 controllers'),
  windows: observed('Windows 11'),
  drivers: observed('12 signed packages'),
  security: observed('Secure Boot enabled'),
  games: unavailable('not-discovered'),
} as const;

const metricChunk = {
  chunkId: 'chunk-0001',
  sequence: 0,
  startedAt: '2026-08-12T12:00:01Z',
  endedAt: '2026-08-12T12:00:02Z',
  metric: 'frame-time-ms',
  unit: 'milliseconds',
  values: [7.1, 7.3, 8.2],
  evidenceHash: `sha256:${'b'.repeat(64)}`,
  quality: 'valid',
} as const;

const completedSession = {
  kind: 'measurement-session',
  schemaVersion: '1.0',
  sessionId: 'session-0001',
  evidenceVersion: 1,
  status: 'completed',
  startedAt: '2026-08-12T12:00:01Z',
  completedAt: '2026-08-12T12:00:02Z',
  execution,
  baseline: {
    baselineId: 'baseline-0001',
    inventoryEvidenceId: inventory.evidenceId,
    inventoryEvidenceHash: inventory.evidenceHash,
    capturedAt: '2026-08-12T12:00:01Z',
  },
  chunks: [metricChunk],
  evidenceHash: `sha256:${'c'.repeat(64)}`,
  limitations: ['Synthetic workload is not a game benchmark.'],
} as const;

const acceptedComparison = {
  kind: 'comparison',
  schemaVersion: '1.0',
  comparisonId: 'comparison-0001',
  state: 'accepted',
  beforeSessionId: 'session-before',
  afterSessionId: 'session-after',
  comparedAt: '2026-08-12T12:05:00Z',
  acceptedResult: {
    metric: 'frame-time-ms',
    unit: 'milliseconds',
    before: 8.4,
    after: 7.2,
    delta: -1.2,
    quality: 'valid',
    evidenceHash: `sha256:${'d'.repeat(64)}`,
  },
} as const;

const rejectedComparison = {
  kind: 'comparison',
  schemaVersion: '1.0',
  comparisonId: 'comparison-0002',
  state: 'rejected',
  beforeSessionId: 'session-before',
  afterSessionId: 'session-after',
  comparedAt: '2026-08-12T12:05:00Z',
  blockers: ['hardware-drift', 'insufficient-samples'],
} as const;

const report = {
  kind: 'evidence-report',
  schemaVersion: '1.0',
  reportId: 'report-0001',
  evidenceVersion: 1,
  generatedAt: '2026-08-12T12:10:00Z',
  evidenceIds: ['inventory-0001', 'session-0001'],
  evidenceHashes: [inventory.evidenceHash, completedSession.evidenceHash],
  provenance: {
    source: 'local-evidence-store',
    collectedAt: '2026-08-12T12:10:00Z',
  },
  limitations: ['Results apply only to the captured hardware state.'],
} as const;

const claim = {
  kind: 'claim-admission',
  schemaVersion: '1.0',
  claimId: 'claim-0001',
  claim: 'Frame-time improved in the accepted comparison.',
  state: 'admitted',
  evidenceIds: ['comparison-0001'],
  evidenceHashes: [acceptedComparison.acceptedResult.evidenceHash],
  provenance: {
    source: 'comparison-engine',
    collectedAt: '2026-08-12T12:10:00Z',
  },
  limitations: ['This is not a guarantee for other games or sessions.'],
} as const;

const validates = (value: unknown): boolean => hardwareEvidenceDocumentValidator(value);

describe('hardware evidence contracts', () => {
  it.each([inventory, completedSession, acceptedComparison, rejectedComparison, report, claim])(
    'accepts a complete evidence document',
    (document) => {
      const accepted = hardwareEvidenceDocumentValidator(document);
      expect(accepted, JSON.stringify(hardwareEvidenceDocumentValidator.errors)).toBe(true);
      if (!accepted) {
        throw new Error('The generated validator rejected a valid hardware evidence document.');
      }
      const typed: HardwareEvidenceDocument = document;
      expect(typed.kind).toBe(document.kind);
    },
  );

  it('requires every inventory category and keeps absence explicit', () => {
    const { games: _games, ...missingCategory } = inventory;
    expect(validates(missingCategory)).toBe(false);
    expect(validates({ ...inventory, games: { state: 'unavailable', value: 0 } })).toBe(false);
  });

  it('rejects fixture provenance and raw hardware identifiers', () => {
    expect(validates({ ...inventory, cpu: { kind: 'fixture', value: 'CPU' } })).toBe(false);
    expect(validates({ ...inventory, serialNumber: 'SENSITIVE-RAW-ID' })).toBe(false);
  });

  it('keeps session lifecycle shapes mutually exclusive', () => {
    expect(validates({ ...completedSession, status: 'incomplete' })).toBe(false);
    expect(
      validates({
        ...completedSession,
        chunks: [{ ...metricChunk, values: [] }],
      }),
    ).toBe(false);
  });

  it('never mixes accepted projections with rejection blockers', () => {
    expect(validates({ ...acceptedComparison, blockers: ['hardware-drift'] })).toBe(false);
    expect(
      validates({
        ...rejectedComparison,
        acceptedResult: acceptedComparison.acceptedResult,
      }),
    ).toBe(false);
  });

  it('requires durable identity, hashes, provenance, and limitations', () => {
    const { evidenceHashes: _hashes, ...missingHashes } = report;
    expect(validates(missingHashes)).toBe(false);
    expect(validates({ ...claim, limitations: [] })).toBe(false);
  });
});
