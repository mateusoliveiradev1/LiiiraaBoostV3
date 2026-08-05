import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  CRITICAL_GATES,
  evaluatePhase4Evidence,
  type BuildIdentity,
  type Phase4EvidenceManifest,
  type PromotionStage,
  type RealPcCoverageMatrix,
} from './evaluate.ts';

const REQUIREMENTS = [
  'WEB-04',
  'WEB-05',
  'WEB-06',
  'WEB-07',
  'IDEN-01',
  'IDEN-02',
  'IDEN-03',
  'IDEN-04',
  'IDEN-05',
  'IDEN-06',
  'IDEN-07',
  'IDEN-08',
  'IDEN-09',
] as const;

const sha256 = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');

const build: BuildIdentity = {
  commit: '51770454aa1d17647c4fe734ae1e57f3e0b403b0',
  ociDigest: `sha256:${'a'.repeat(64)}`,
  desktopBuildId: 'internal-023001',
  contractHash: sha256('control-plane-contract'),
  schemaHash: sha256('control-plane-schema'),
};

const buildFingerprint = sha256(
  [build.commit, build.ociDigest, build.desktopBuildId, build.contractHash, build.schemaHash].join(
    '\n',
  ),
);

const artifactContents: Record<string, string> = Object.fromEntries([
  ...[...REQUIREMENTS, ...CRITICAL_GATES].map(
    (id) => [`evidence/${id.toLowerCase()}.json`, `immutable evidence for ${id}`] as const,
  ),
  ['evidence/contract-openapi.json', 'control-plane-contract'] as const,
  ['evidence/control-plane-schema.json', 'control-plane-schema'] as const,
]);

const requiredAt = <T>(values: readonly T[], index: number): T => {
  const value = values[index];
  if (value === undefined) {
    throw new Error(`Expected fixture value at index ${String(index)}.`);
  }
  return value;
};

const artifactId = (id: string): string => `artifact-${id.toLowerCase()}`;

const historyHash = (input: {
  sequence: number;
  gate: (typeof CRITICAL_GATES)[number];
  status: 'passed' | 'failed';
  buildFingerprint: string;
  evidenceId: string;
  previousHash: string | null;
}): string =>
  sha256(
    JSON.stringify({
      sequence: input.sequence,
      gate: input.gate,
      status: input.status,
      buildFingerprint: input.buildFingerprint,
      evidenceId: input.evidenceId,
      previousHash: input.previousHash,
    }),
  );

const validManifest = (): Phase4EvidenceManifest => {
  const artifacts = [...REQUIREMENTS, ...CRITICAL_GATES].map((id) => ({
    id: artifactId(id),
    path: `evidence/${id.toLowerCase()}.json`,
    sha256: sha256(`immutable evidence for ${id}`),
    buildFingerprint,
  }));
  artifacts.push(
    {
      id: 'contract-openapi',
      path: 'evidence/contract-openapi.json',
      sha256: build.contractHash,
      buildFingerprint,
    },
    {
      id: 'control-plane-schema',
      path: 'evidence/control-plane-schema.json',
      sha256: build.schemaHash,
      buildFingerprint,
    },
  );

  let previousHash: string | null = null;
  const gateHistory = CRITICAL_GATES.map((gate, index) => {
    const record = {
      sequence: index + 1,
      gate,
      status: 'passed' as const,
      buildFingerprint,
      evidenceId: artifactId(gate),
      previousHash,
    };
    const recordHash = historyHash(record);
    previousHash = recordHash;
    return { ...record, recordHash };
  });

  return {
    schemaVersion: 1,
    build,
    buildFingerprint,
    artifacts,
    requirements: REQUIREMENTS.map((id) => ({ id, evidenceId: artifactId(id) })),
    gateHistory,
    gateHistoryHead: previousHash,
    promotionEvidence: [
      { stage: 'local', status: 'passed', evidenceIds: [artifactId('WEB-04')] },
      { stage: 'preview', status: 'passed', evidenceIds: [artifactId('WEB-05')] },
      {
        stage: 'internal-staging',
        status: 'passed',
        evidenceIds: [artifactId('WEB-06')],
      },
      {
        stage: 'invited-alpha',
        status: 'passed',
        evidenceIds: [artifactId('WEB-07')],
      },
    ],
    defects: [
      {
        id: 'copy-polish-01',
        category: 'minor-ux',
        severity: 'minor',
        material: false,
        documented: true,
        status: 'open',
      },
    ],
    ownerReviewRequired: true,
  };
};

const fullCoverage = (): RealPcCoverageMatrix => ({
  schemaVersion: 1,
  buildFingerprint,
  cells: [
    {
      id: 'win10-intel-nvidia-desktop',
      os: 'windows-10',
      cpu: 'intel',
      gpu: 'nvidia',
      formFactor: 'desktop',
      storage: 'nvme',
      network: 'ethernet',
      journeys: ['clean-install', 'offline', 'failure', 'restoration'],
      evidenceId: artifactId('compatibility'),
    },
    {
      id: 'win11-amd-amd-notebook',
      os: 'windows-11',
      cpu: 'amd',
      gpu: 'amd',
      formFactor: 'notebook',
      storage: 'sata-ssd',
      network: 'wifi',
      journeys: ['upgrade', 'rollback', 'uninstall'],
      evidenceId: artifactId('compatibility'),
    },
    {
      id: 'win11-intel-intel-notebook',
      os: 'windows-11',
      cpu: 'intel',
      gpu: 'intel',
      formFactor: 'notebook',
      storage: 'nvme',
      network: 'wifi',
      journeys: ['clean-install', 'restoration'],
      evidenceId: artifactId('compatibility'),
    },
  ],
});

const evaluate = (
  manifest = validManifest(),
  coverage = fullCoverage(),
  requestedStage: PromotionStage = 'internal-staging',
) => evaluatePhase4Evidence(manifest, coverage, { requestedStage, artifactContents });

const codes = (result: ReturnType<typeof evaluate>): string[] =>
  result.diagnostics.map(({ code }) => code);

describe('build-bound Phase 4 evidence', () => {
  it('accepts complete immutable evidence through invited alpha only', () => {
    const result = evaluate(validManifest(), fullCoverage(), 'invited-alpha');

    expect(result.ok).toBe(true);
    expect(result.highestAllowedStage).toBe('invited-alpha');
    expect(result.buildFingerprint).toBe(buildFingerprint);
    expect(result.diagnostics).toEqual([]);
  });

  it('rejects an omitted requirement witness', () => {
    const manifest = validManifest();
    manifest.requirements = manifest.requirements.filter(({ id }) => id !== 'IDEN-09');

    expect(codes(evaluate(manifest))).toContain('REQUIREMENT_EVIDENCE_MISSING');
  });

  it('rejects artifact mutation after admission', () => {
    const mutatedContents = { ...artifactContents, 'evidence/web-04.json': 'mutated bytes' };
    const result = evaluatePhase4Evidence(validManifest(), fullCoverage(), {
      requestedStage: 'internal-staging',
      artifactContents: mutatedContents,
    });

    expect(codes(result)).toContain('ARTIFACT_HASH_MISMATCH');
    expect(result.ok).toBe(false);
  });

  it('rejects a stale recorded artifact hash', () => {
    const manifest = validManifest();
    manifest.artifacts[0] = { ...requiredAt(manifest.artifacts, 0), sha256: '0'.repeat(64) };

    expect(codes(evaluate(manifest))).toContain('ARTIFACT_HASH_MISMATCH');
  });

  it('rejects evidence bound to another build', () => {
    const manifest = validManifest();
    manifest.artifacts[0] = {
      ...requiredAt(manifest.artifacts, 0),
      buildFingerprint: 'f'.repeat(64),
    };

    expect(codes(evaluate(manifest))).toContain('ARTIFACT_BUILD_MISMATCH');
  });

  it('rejects a prior critical failure even after a later pass', () => {
    const manifest = validManifest();
    const prior = requiredAt(manifest.gateHistory, 0);
    const failed = { ...prior, status: 'failed' as const };
    failed.recordHash = historyHash(failed);

    let previousHash = failed.recordHash;
    const laterHistory = manifest.gateHistory.slice(1).map((record, index) => {
      const next = { ...record, sequence: index + 2, previousHash };
      const recordHash = historyHash(next);
      previousHash = recordHash;
      return { ...next, recordHash };
    });
    const laterPass = {
      ...failed,
      sequence: laterHistory.length + 2,
      status: 'passed' as const,
      previousHash,
    };
    laterPass.recordHash = historyHash(laterPass);
    manifest.gateHistory = [failed, ...laterHistory, laterPass];
    manifest.gateHistoryHead = laterPass.recordHash;

    expect(codes(evaluate(manifest))).toContain('CRITICAL_FAILURE_IN_HISTORY');
  });

  it('rejects mutation of an append-only gate record', () => {
    const manifest = validManifest();
    manifest.gateHistory[0] = { ...requiredAt(manifest.gateHistory, 0), status: 'failed' };

    expect(codes(evaluate(manifest))).toContain('GATE_HISTORY_HASH_MISMATCH');
  });
});

describe('promotion and coverage policy', () => {
  it.each(['frozen-rc', 'production'] as const)('rejects unsupported Phase 4 stage %s', (stage) => {
    const result = evaluate(validManifest(), fullCoverage(), stage);

    expect(result.ok).toBe(false);
    expect(codes(result)).toContain('PHASE4_STAGE_FORBIDDEN');
  });

  it('rejects invited alpha when a required real-PC coverage axis is absent', () => {
    const coverage = fullCoverage();
    coverage.cells = coverage.cells.filter(({ gpu }) => gpu !== 'intel');

    const result = evaluate(validManifest(), coverage, 'invited-alpha');

    expect(result.ok).toBe(false);
    expect(result.coverageGaps).toContain('gpu:intel');
    expect(codes(result)).toContain('REAL_PC_COVERAGE_GAP');
  });

  it('rejects invited alpha when a required journey is absent', () => {
    const coverage = fullCoverage();
    coverage.cells = coverage.cells.map((cell) => ({
      ...cell,
      journeys: cell.journeys.filter((journey) => journey !== 'rollback'),
    }));

    const result = evaluate(validManifest(), coverage, 'invited-alpha');

    expect(result.coverageGaps).toContain('journey:rollback');
    expect(result.ok).toBe(false);
  });

  it('permits internal staging while reporting invited-alpha coverage gaps', () => {
    const coverage = fullCoverage();
    coverage.cells = [];

    const result = evaluate(validManifest(), coverage, 'internal-staging');

    expect(result.ok).toBe(true);
    expect(result.highestAllowedStage).toBe('internal-staging');
    expect(result.coverageGaps.length).toBeGreaterThan(0);
  });

  it('rejects known critical or material defects', () => {
    const manifest = validManifest();
    manifest.defects.push({
      id: 'security-01',
      category: 'security',
      severity: 'critical',
      material: true,
      documented: true,
      status: 'open',
    });

    expect(codes(evaluate(manifest))).toContain('KNOWN_CRITICAL_DEFECT');
  });

  it('rejects even minor open defects in a release-critical category', () => {
    const manifest = validManifest();
    manifest.defects.push({
      id: 'accessibility-01',
      category: 'accessibility',
      severity: 'minor',
      material: false,
      documented: true,
      status: 'open',
    });

    expect(codes(evaluate(manifest))).toContain('KNOWN_CRITICAL_DEFECT');
  });

  it('rejects undocumented open defects but admits documented non-material minor defects', () => {
    const manifest = validManifest();
    manifest.defects[0] = { ...requiredAt(manifest.defects, 0), documented: false };

    expect(codes(evaluate(manifest))).toContain('UNDOCUMENTED_OPEN_DEFECT');
    expect(evaluate().ok).toBe(true);
  });

  it('requires owner review to remain explicitly pending', () => {
    const manifest = validManifest();
    manifest.ownerReviewRequired = false;

    expect(codes(evaluate(manifest))).toContain('OWNER_REVIEW_INFERRED');
  });
});
