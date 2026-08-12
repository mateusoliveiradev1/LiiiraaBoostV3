import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  PHASE5_AUTOMATED_GATES,
  PHASE5_HARDWARE_CLASSES,
  evaluatePhase5Evidence,
  type Phase5EvidenceManifest,
} from '../src/evaluate.ts';

const sha256 = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');

const gateEvidence = 'phase-5 deterministic evidence';
const artifactBytes = 'packaged desktop artifact';
const reportBytes = 'phase-5 report';

const validManifest = (
  runKind: Phase5EvidenceManifest['runKind'] = 'deterministic-ci',
): Phase5EvidenceManifest => ({
  schemaVersion: 1,
  runId: `phase5-${runKind}`,
  runKind,
  generatedAt: '2030-01-15T18:00:00.000Z',
  build: {
    commit: '51770454aa1d17647c4fe734ae1e57f3e0b403b0',
    collectorVersion: 'liiiraa-native-evidence@1',
    artifactPath: 'artifacts/liiiraa-boost.exe',
    artifactSha256: sha256(artifactBytes),
  },
  environment: {
    physical: runKind === 'packaged-physical',
    os: {
      family: 'windows',
      edition: 'Windows 11 Pro',
      lifecycle: 'windows-11',
      version: '10.0',
      build: '26100',
      architecture: 'x64',
    },
    hardwareClasses: PHASE5_HARDWARE_CLASSES.map((hardwareClass) => ({
      hardwareClass,
      state: 'observed',
      source: 'windows-native-api',
    })),
    matrix: {
      os: 'windows-11',
      cpu: 'amd',
      gpu: ['nvidia'],
      formFactor: 'desktop',
      storage: ['nvme'],
      network: ['ethernet'],
    },
  },
  gates: PHASE5_AUTOMATED_GATES.map((id) => ({
    id,
    status: 'passed',
    evidenceKind: runKind === 'packaged-physical' ? 'physical' : 'deterministic',
    evidenceSha256: sha256(gateEvidence),
  })),
  budgets: {
    memoryPeakMb: 24.5,
    idleCpuPercent: 0.4,
    pollingHz: 1,
    cancellationMs: 240,
    sampleDurationSeconds: runKind === 'packaged-physical' ? 300 : 30,
  },
  privacy: {
    rawIdentifiersFound: [],
    scanSha256: sha256('privacy scan'),
  },
  report: {
    path: 'evidence/phase5-report.json',
    sha256: sha256(reportBytes),
  },
  phase4PhysicalGaps: [
    {
      id: 'PHASE4-WIN10-CLEAN-INSTALL',
      status: 'pending',
      detail: 'Requires an independent clean Windows 10 machine.',
    },
  ],
});

const context = {
  artifactContents: {
    'artifacts/liiiraa-boost.exe': artifactBytes,
    'evidence/phase5-report.json': reportBytes,
  },
  gateEvidenceContents: Object.fromEntries(PHASE5_AUTOMATED_GATES.map((id) => [id, gateEvidence])),
};

const codes = (result: ReturnType<typeof evaluatePhase5Evidence>): string[] =>
  result.diagnostics.map(({ code }) => code);

describe('Phase 5 deterministic and physical evidence admission', () => {
  it('admits deterministic gates without claiming a physical run', () => {
    const result = evaluatePhase5Evidence([validManifest()], { ...context, mode: 'planned' });

    expect(result.automatedOk).toBe(true);
    expect(result.currentPcAdmitted).toBe(false);
    expect(result.releaseReady).toBe(false);
    expect(result.diagnostics).toEqual([]);
  });

  it('requires current-PC packaged evidence in final mode', () => {
    const result = evaluatePhase5Evidence([validManifest()], { ...context, mode: 'final' });

    expect(result.ok).toBe(false);
    expect(codes(result)).toContain('PHYSICAL_CURRENT_PC_MISSING');
  });

  it('rejects simulation presented as physical evidence', () => {
    const manifest = validManifest('packaged-physical');
    manifest.environment.physical = false;

    const result = evaluatePhase5Evidence([validManifest(), manifest], {
      ...context,
      mode: 'final',
    });

    expect(codes(result)).toContain('RUN_KIND_PHYSICAL_MISMATCH');
    expect(result.currentPcAdmitted).toBe(false);
  });

  it('fails exact missing environment and source coverage', () => {
    const manifest = validManifest('packaged-physical');
    manifest.environment.os.build = '';
    manifest.environment.hardwareClasses = manifest.environment.hardwareClasses.filter(
      ({ hardwareClass }) => hardwareClass !== 'audio',
    );
    manifest.environment.hardwareClasses[0] = {
      ...manifest.environment.hardwareClasses[0]!,
      source: '',
    };

    const result = evaluatePhase5Evidence([validManifest(), manifest], {
      ...context,
      mode: 'final',
    });

    expect(codes(result)).toEqual(
      expect.arrayContaining([
        'OS_BUILD_MISSING',
        'HARDWARE_CLASS_MISSING',
        'SOURCE_EVIDENCE_MISSING',
      ]),
    );
  });

  it.each([
    ['memoryPeakMb', 25.01, 'MEMORY_BUDGET_EXCEEDED'],
    ['idleCpuPercent', 0.51, 'IDLE_CPU_BUDGET_EXCEEDED'],
    ['pollingHz', 1.01, 'POLLING_BUDGET_EXCEEDED'],
    ['cancellationMs', 251, 'CANCELLATION_BUDGET_EXCEEDED'],
  ] as const)('rejects %s beyond the approved limit', (field, value, expectedCode) => {
    const manifest = validManifest();
    manifest.budgets[field] = value;

    const result = evaluatePhase5Evidence([manifest], { ...context, mode: 'planned' });

    expect(codes(result)).toContain(expectedCode);
  });

  it('rejects raw hardware identifier leakage', () => {
    const manifest = validManifest();
    manifest.privacy.rawIdentifiersFound = ['MachineGuid'];

    const result = evaluatePhase5Evidence([manifest], { ...context, mode: 'planned' });

    expect(codes(result)).toContain('RAW_IDENTIFIER_LEAK');
  });

  it('rejects mutated packaged artifacts and reports', () => {
    const result = evaluatePhase5Evidence([validManifest()], {
      ...context,
      mode: 'planned',
      artifactContents: {
        'artifacts/liiiraa-boost.exe': 'mutated artifact',
        'evidence/phase5-report.json': 'mutated report',
      },
    });

    expect(codes(result)).toEqual(
      expect.arrayContaining(['ARTIFACT_HASH_MISMATCH', 'REPORT_HASH_MISMATCH']),
    );
  });

  it('admits this physical PC while keeping the unrun matrix and Phase 4 gaps explicit', () => {
    const result = evaluatePhase5Evidence([validManifest(), validManifest('packaged-physical')], {
      ...context,
      mode: 'final',
    });

    expect(result.ok).toBe(true);
    expect(result.automatedOk).toBe(true);
    expect(result.currentPcAdmitted).toBe(true);
    expect(result.releaseReady).toBe(false);
    expect(result.physicalMatrixGaps).toEqual(
      expect.arrayContaining(['os:windows-10', 'cpu:intel', 'gpu:amd', 'gpu:intel']),
    );
    expect(result.phase4PhysicalGaps).toEqual(['PHASE4-WIN10-CLEAN-INSTALL']);
    expect(result.diagnostics).toEqual([]);
  });
});
