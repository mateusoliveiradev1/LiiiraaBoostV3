import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  PHASE6_DECISIONS,
  PHASE6_REQUIREMENTS,
  evaluatePhase6Evidence,
  phase6EvidenceSha256,
} from '../src/evaluate.js';
import {
  assertCanonicalSimulationCandidate,
  assertDeterministicAdmissionChain,
  createCanonicalSimulationCandidate,
  parseSimulationWriterCli,
  type CanonicalSimulationCandidate,
  writeCanonicalSimulationEvidence,
} from '../src/simulation-writer.js';

const sha256 = (value: string | Uint8Array): string =>
  createHash('sha256').update(value).digest('hex');

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { force: true, recursive: true });
});

const write = (path: string, value: string): void => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value);
};

const fixture = (operationVersion = 'managed-power-scheme-v41') => {
  const root = mkdtempSync(join(tmpdir(), 'phase6-simulation-writer-'));
  roots.push(root);
  const artifactRoot = join(root, 'target', 'phase6-physical', 'source-commit', 'build-v41');
  const roles = [
    ['msi', 'liiiraa-boost.msi'],
    ['installationManifest', 'installation-manifest.json'],
    ['installationManifestSignature', 'installation-manifest.json.p7s'],
    ['cleanWindowsVmConfig', 'configs/clean.json'],
    ['ownerPcConfig', 'configs/owner.json'],
    ['friendsPcConfig', 'configs/friends.json'],
    ['runner', 'phase6-physical-runner.exe'],
    ['tauriDriver', 'tauri-driver.exe'],
    ['msedgeDriver', 'msedgedriver.exe'],
  ] as const;
  const files = Object.fromEntries(
    roles.map(([name, relativePath]) => {
      const bytes = `${name}-bytes-v41`;
      write(join(artifactRoot, relativePath), bytes);
      return [
        name,
        {
          relativePath,
          role: name,
          sha256: `sha256:${sha256(bytes)}`,
          sizeBytes: Buffer.byteLength(bytes, 'utf8'),
        },
      ];
    }),
  );
  const artifact = {
    buildId: 'physical-build-managed-power-scheme-v41',
    createdAt: '2026-08-14T13:24:00.195Z',
    files,
    kind: 'artifact-manifest',
    manifestId: 'artifact-manifest-v41',
    operationVersionId: operationVersion,
    schemaVersion: '1.0',
    sourceCommit: 'a'.repeat(40),
  };
  const artifactPath = join(artifactRoot, 'artifact-manifest.json');
  const artifactBytes = `${JSON.stringify(artifact)}\n`;
  write(artifactPath, artifactBytes);
  const artifactSha256 = sha256(artifactBytes);
  const relativeArtifactRoot = artifactRoot.slice(root.length + 1).replaceAll('\\', '/');
  const summaryPath = join(
    root,
    '.planning/phases/06-transactional-plans-and-recovery/06-31-SUMMARY.md',
  );
  write(
    summaryPath,
    [
      `- **Root:** \`${relativeArtifactRoot}\``,
      `- **Build ID:** \`${artifact.buildId}\``,
      `- **Operation version:** \`${operationVersion}\``,
      `- **Source commit:** \`${artifact.sourceCommit}\``,
      `| \`artifact-manifest.json\` | \`${artifactSha256}\` | ${String(Buffer.byteLength(artifactBytes, 'utf8'))} |`,
      '',
    ].join('\n'),
  );
  const uatPath = join(root, '.planning/phases/06-transactional-plans-and-recovery/06-UAT.md');
  const uatBytes = '# UAT\n\nmanaged-power-scheme-v1 BLOCKED\nmanaged-power-scheme-v2 BLOCKED\n';
  write(uatPath, uatBytes);
  const evidenceManifestPath = join(root, 'tooling/phase6-evidence/evidence-manifest.json');
  const legacyBytes = `${JSON.stringify(
    {
      schemaVersion: 1,
      operationVersion: 'managed-power-scheme-v2',
      requirementsCoverage: ['PLAN-01', 'PLAN-05', 'PLAN-06', 'PLAN-07', 'PLAN-08'],
    },
    null,
    2,
  )}\n`;
  write(evidenceManifestPath, legacyBytes);
  const harnessPath = join(root, 'packages/desktop-simulator/src/transactional-plans.ts');
  write(harnessPath, 'export const deterministicHarness = true;\n');
  return {
    artifact,
    artifactPath,
    artifactSha256,
    evidenceManifestPath,
    harnessPath,
    legacyBytes,
    root,
    summaryPath,
    uatBytes,
    uatPath,
  };
};

const appendSuccessorArtifact = (
  setup: ReturnType<typeof fixture>,
  operationVersion = 'managed-power-scheme-v43',
) => {
  const buildId = `physical-build-${operationVersion}`;
  const versionNumber = Number(operationVersion.slice(operationVersion.lastIndexOf('v') + 1));
  const artifactRoot = join(setup.root, 'target', 'phase6-physical', 'successor', buildId);
  const artifact = {
    ...setup.artifact,
    buildId,
    createdAt: `2026-08-14T${String(Math.min(versionNumber, 23)).padStart(2, '0')}:00:00.000Z`,
    manifestId: `artifact-manifest-v${String(versionNumber)}`,
    operationVersionId: operationVersion,
    sourceCommit: String.fromCharCode(97 + (versionNumber % 6)).repeat(40),
  };
  for (const entry of Object.values(artifact.files)) {
    const relativePath = entry.relativePath;
    write(
      join(artifactRoot, relativePath),
      readFileSync(join(dirname(setup.artifactPath), relativePath), 'utf8'),
    );
  }
  const artifactPath = join(artifactRoot, 'artifact-manifest.json');
  const artifactBytes = `${JSON.stringify(artifact)}\n`;
  write(artifactPath, artifactBytes);
  const artifactSha256 = sha256(artifactBytes);
  const relativeRoot = artifactRoot.slice(setup.root.length + 1).replaceAll('\\', '/');
  const originalSummary = readFileSync(setup.summaryPath, 'utf8');
  write(
    setup.summaryPath,
    `${originalSummary}\n- **Root:** \`${relativeRoot}\`\n- **Build ID:** \`${buildId}\`\n- **Operation version:** \`${operationVersion}\`\n- **Source commit:** \`${artifact.sourceCommit}\`\n| \`artifact-manifest.json\` | \`${artifactSha256}\` | ${String(Buffer.byteLength(artifactBytes, 'utf8'))} |\n`,
  );
  return { artifact, artifactPath, artifactSha256 };
};

describe('closed simulation writer CLI', () => {
  it('accepts only summary/direct artifact input plus the explicit minimum version', () => {
    expect(
      parseSimulationWriterCli([
        '--',
        '--artifact-manifest-from-summary',
        '.planning/phases/06-transactional-plans-and-recovery/06-31-SUMMARY.md',
        '--minimum-version',
        'managed-power-scheme-v3',
      ]),
    ).toEqual({
      artifactManifestFromSummary:
        '.planning/phases/06-transactional-plans-and-recovery/06-31-SUMMARY.md',
      minimumVersion: 'managed-power-scheme-v3',
    });
    expect(() =>
      parseSimulationWriterCli([
        '--artifact-manifest',
        'artifact-manifest.json',
        '--minimum-version',
        'managed-power-scheme-v3',
        '--physical',
      ]),
    ).toThrow(/closed grammar/iu);
  });
});

describe('canonical simulation candidate', () => {
  it('rejects forked, cyclic, duplicate, downgraded, or reactivated admission chains', () => {
    const hash = (digit: string): string => digit.repeat(64);
    const valid = [
      {
        status: 'superseded',
        operationVersion: 'managed-power-scheme-v41',
        buildId: 'physical-build-v41',
        artifactManifestSha256: hash('1'),
        runEvidenceId: 'run-v41',
        runEvidenceSha256: hash('2'),
        predecessorEvidenceSha256: null,
        successorEvidenceSha256: hash('4'),
        manifestRecord: { path: 'records/v41.json', sha256: hash('3') },
      },
      {
        status: 'active',
        operationVersion: 'managed-power-scheme-v43',
        buildId: 'physical-build-v43',
        artifactManifestSha256: hash('5'),
        runEvidenceId: 'run-v43',
        runEvidenceSha256: hash('4'),
        predecessorEvidenceSha256: hash('2'),
        successorEvidenceSha256: null,
        manifestRecord: null,
      },
    ];
    expect(() => assertDeterministicAdmissionChain(valid)).not.toThrow();

    const mutations = [
      (value: typeof valid) => (value[1]!.operationVersion = value[0]!.operationVersion),
      (value: typeof valid) => (value[1]!.runEvidenceId = value[0]!.runEvidenceId),
      (value: typeof valid) =>
        (value[1]!.artifactManifestSha256 = value[0]!.artifactManifestSha256),
      (value: typeof valid) => (value[1]!.predecessorEvidenceSha256 = null),
      (value: typeof valid) => (value[1]!.predecessorEvidenceSha256 = hash('9')),
      (value: typeof valid) => (value[0]!.successorEvidenceSha256 = hash('9')),
      (value: typeof valid) => (value[0]!.predecessorEvidenceSha256 = hash('4')),
      (value: typeof valid) => (value[0]!.status = 'active'),
      (value: typeof valid) => (value[0]!.manifestRecord = null),
      (value: typeof valid) => value.push(structuredClone(value[1]!)),
    ];
    for (const mutate of mutations) {
      const candidate = structuredClone(valid);
      mutate(candidate);
      expect(() => assertDeterministicAdmissionChain(candidate)).toThrow();
    }
  });

  it('uses the evaluator authority for exact PLAN-01..08 and D-01..35 coverage', () => {
    const setup = fixture();
    const candidate = createCanonicalSimulationCandidate({
      artifactManifestPath: setup.artifactPath,
      artifactManifestSha256: setup.artifactSha256,
      buildId: setup.artifact.buildId,
      harnessPath: setup.harnessPath,
      operationVersion: setup.artifact.operationVersionId,
      recordedAt: setup.artifact.createdAt,
      sourceCommit: setup.artifact.sourceCommit,
      workspaceRoot: setup.root,
    });

    expect(candidate.requirementsCoverage).toEqual(PHASE6_REQUIREMENTS);
    expect(candidate.decisionCoverage).toEqual(PHASE6_DECISIONS);
    expect(candidate.run).toMatchObject({
      evidenceKind: 'deterministic',
      source: 'phase6-deterministic-rust-1',
      stage: 'deterministic-simulation',
      status: 'PASS',
      diagnostics: { consentBound: false },
    });
    expect(candidate.reviews).toEqual([]);
    expect(candidate.consents).toEqual([]);
    expect(candidate.run.artifacts[1]?.path).toBe(
      'packages/desktop-simulator/src/transactional-plans.ts',
    );
    expect(() => assertCanonicalSimulationCandidate(candidate)).not.toThrow();
  });

  it.each<[string, (value: CanonicalSimulationCandidate) => unknown]>([
    ['omitted requirement', (value) => value.requirementsCoverage.pop()],
    ['reordered requirement', (value) => value.requirementsCoverage.reverse()],
    ['duplicate requirement', (value) => (value.requirementsCoverage[7] = 'PLAN-07')],
    ['unknown requirement', (value) => (value.requirementsCoverage[7] = 'PLAN-99')],
    ['partial cycle', (value) => (value.run.cycle.restore = 'FAIL')],
    ['physical relabel', (value) => (value.run.evidenceKind = 'physical')],
    ['physical source', (value) => (value.run.source = 'phase6-physical-runner-rust-1')],
  ])('rejects %s before any persistence', (_name, mutate) => {
    const setup = fixture();
    const candidate = structuredClone(
      createCanonicalSimulationCandidate({
        artifactManifestPath: setup.artifactPath,
        artifactManifestSha256: setup.artifactSha256,
        buildId: setup.artifact.buildId,
        harnessPath: setup.harnessPath,
        operationVersion: setup.artifact.operationVersionId,
        recordedAt: setup.artifact.createdAt,
        sourceCommit: setup.artifact.sourceCommit,
        workspaceRoot: setup.root,
      }),
    );
    mutate(candidate);
    const beforeManifest = readFileSync(setup.evidenceManifestPath, 'utf8');
    const beforeUat = readFileSync(setup.uatPath, 'utf8');

    expect(() => assertCanonicalSimulationCandidate(candidate)).toThrow();
    expect(readFileSync(setup.evidenceManifestPath, 'utf8')).toBe(beforeManifest);
    expect(readFileSync(setup.uatPath, 'utf8')).toBe(beforeUat);
  });
});

describe('artifact-bound atomic admission', () => {
  it('supersedes v41 with one linear append-only v43 admission', () => {
    const setup = fixture();
    writeCanonicalSimulationEvidence({
      artifactManifestPath: setup.artifactPath,
      evidenceManifestPath: setup.evidenceManifestPath,
      harnessPath: setup.harnessPath,
      minimumVersion: 'managed-power-scheme-v3',
      summaryPath: setup.summaryPath,
      uatPath: setup.uatPath,
      workspaceRoot: setup.root,
    });
    const priorManifestBytes = readFileSync(setup.evidenceManifestPath, 'utf8');
    const priorManifest = JSON.parse(priorManifestBytes) as {
      stages: { runs: unknown[] }[];
    };
    const priorRun = priorManifest.stages[0]?.runs[0];
    if (priorRun === undefined) throw new Error('v41 deterministic run missing');
    const priorRunSha256 = phase6EvidenceSha256(priorRun);
    const uatBefore = readFileSync(setup.uatPath, 'utf8');
    const successor = appendSuccessorArtifact(setup);

    const result = writeCanonicalSimulationEvidence({
      artifactManifestPath: successor.artifactPath,
      evidenceManifestPath: setup.evidenceManifestPath,
      harnessPath: setup.harnessPath,
      minimumVersion: 'managed-power-scheme-v43',
      summaryPath: setup.summaryPath,
      uatPath: setup.uatPath,
      workspaceRoot: setup.root,
    });
    const current = JSON.parse(readFileSync(setup.evidenceManifestPath, 'utf8')) as {
      schemaVersion: number;
      deterministicAdmissions: {
        operationVersion: string;
        status: string;
        runEvidenceSha256: string;
        predecessorEvidenceSha256: string | null;
        successorEvidenceSha256: string | null;
        manifestRecord: { path: string; sha256: string } | null;
      }[];
      stages: { runs: { predecessorRunEvidenceSha256: string | null }[] }[];
    };
    const [historical, active] = current.deterministicAdmissions;
    if (historical === undefined || active === undefined)
      throw new Error('linear deterministic history missing');

    expect(result.operationVersion).toBe('managed-power-scheme-v43');
    expect(current.schemaVersion).toBe(3);
    expect(historical).toMatchObject({
      operationVersion: 'managed-power-scheme-v41',
      status: 'superseded',
      runEvidenceSha256: priorRunSha256,
      predecessorEvidenceSha256: null,
      successorEvidenceSha256: active.runEvidenceSha256,
    });
    expect(active).toMatchObject({
      operationVersion: 'managed-power-scheme-v43',
      status: 'active',
      predecessorEvidenceSha256: priorRunSha256,
      successorEvidenceSha256: null,
      manifestRecord: null,
    });
    expect(current.stages[0]?.runs[0]?.predecessorRunEvidenceSha256).toBe(priorRunSha256);
    expect(historical.manifestRecord).not.toBeNull();
    expect(readFileSync(resolve(setup.root, historical.manifestRecord!.path), 'utf8')).toBe(
      priorManifestBytes,
    );
    expect(historical.manifestRecord!.sha256).toBe(sha256(priorManifestBytes));
    expect(readFileSync(setup.uatPath, 'utf8').startsWith(uatBefore)).toBe(true);
  });

  it('RED: extends an existing schema v3 chain with one authorized v44 successor', () => {
    const setup = fixture();
    writeCanonicalSimulationEvidence({
      artifactManifestPath: setup.artifactPath,
      evidenceManifestPath: setup.evidenceManifestPath,
      harnessPath: setup.harnessPath,
      minimumVersion: 'managed-power-scheme-v3',
      summaryPath: setup.summaryPath,
      uatPath: setup.uatPath,
      workspaceRoot: setup.root,
    });
    const v43 = appendSuccessorArtifact(setup);
    writeCanonicalSimulationEvidence({
      artifactManifestPath: v43.artifactPath,
      evidenceManifestPath: setup.evidenceManifestPath,
      harnessPath: setup.harnessPath,
      minimumVersion: 'managed-power-scheme-v43',
      summaryPath: setup.summaryPath,
      uatPath: setup.uatPath,
      workspaceRoot: setup.root,
    });
    const v43ManifestBytes = readFileSync(setup.evidenceManifestPath, 'utf8');
    const v43Manifest = JSON.parse(v43ManifestBytes) as {
      deterministicAdmissions: {
        operationVersion: string;
        status: string;
        runEvidenceSha256: string;
        successorEvidenceSha256: string | null;
        manifestRecord: { path: string; sha256: string } | null;
      }[];
    };
    const v41Record = structuredClone(v43Manifest.deterministicAdmissions[0]?.manifestRecord);
    const v43Admission = v43Manifest.deterministicAdmissions[1];
    if (v43Admission === undefined) throw new Error('v43 active admission missing');
    const uatBefore = readFileSync(setup.uatPath, 'utf8');
    const v44 = appendSuccessorArtifact(setup, 'managed-power-scheme-v44');

    const result = writeCanonicalSimulationEvidence({
      artifactManifestPath: v44.artifactPath,
      evidenceManifestPath: setup.evidenceManifestPath,
      harnessPath: setup.harnessPath,
      minimumVersion: 'managed-power-scheme-v44',
      summaryPath: setup.summaryPath,
      uatPath: setup.uatPath,
      workspaceRoot: setup.root,
    });
    const current = JSON.parse(readFileSync(setup.evidenceManifestPath, 'utf8')) as {
      generatedAt: string;
      immutableBuild: { artifact: { path: string } };
      legacyBlockedAttempts: { path: string }[];
      deterministicAdmissions: {
        operationVersion: string;
        status: string;
        runEvidenceSha256: string;
        predecessorEvidenceSha256: string | null;
        successorEvidenceSha256: string | null;
        manifestRecord: { path: string; sha256: string } | null;
      }[];
      stages: { runs: { artifacts: { path: string }[] }[] }[];
    };
    const [v41Current, v43Current, v44Current] = current.deterministicAdmissions;
    if (v41Current === undefined || v43Current === undefined || v44Current === undefined)
      throw new Error('three-link deterministic chain missing');

    expect(result.operationVersion).toBe('managed-power-scheme-v44');
    expect(current.deterministicAdmissions).toHaveLength(3);
    expect(v41Current.manifestRecord).toEqual(v41Record);
    expect(v43Current).toMatchObject({
      operationVersion: 'managed-power-scheme-v43',
      status: 'superseded',
      successorEvidenceSha256: v44Current.runEvidenceSha256,
    });
    expect(v44Current).toMatchObject({
      operationVersion: 'managed-power-scheme-v44',
      status: 'active',
      predecessorEvidenceSha256: v43Admission.runEvidenceSha256,
      successorEvidenceSha256: null,
      manifestRecord: null,
    });
    expect(v43Current.manifestRecord).not.toBeNull();
    expect(readFileSync(resolve(setup.root, v43Current.manifestRecord!.path), 'utf8')).toBe(
      v43ManifestBytes,
    );
    expect(v43Current.manifestRecord!.sha256).toBe(sha256(v43ManifestBytes));
    expect(readFileSync(setup.uatPath, 'utf8').startsWith(uatBefore)).toBe(true);

    const referencedPaths = new Set<string>([
      current.immutableBuild.artifact.path,
      ...current.legacyBlockedAttempts.map(({ path }) => path),
      ...current.deterministicAdmissions.flatMap(({ manifestRecord }) =>
        manifestRecord === null ? [] : [manifestRecord.path],
      ),
      ...current.stages.flatMap(({ runs }) =>
        runs.flatMap(({ artifacts }) => artifacts.map(({ path }) => path)),
      ),
    ]);
    const artifactContents = Object.fromEntries(
      [...referencedPaths].map((path) => [path, readFileSync(resolve(setup.root, path))]),
    );
    const evaluation = evaluatePhase6Evidence(current, {
      mode: 'planned',
      requireAdmittedStage: 'deterministic-simulation',
      evaluatedAt: new Date(Date.parse(current.generatedAt) + 1000).toISOString(),
      artifactContents,
    });
    expect(evaluation.diagnostics).toEqual([]);
    expect(evaluation.ok).toBe(true);
  });

  it('selects the latest complete append-only artifact authority block', () => {
    const setup = fixture();
    const latest = readFileSync(setup.summaryPath, 'utf8');
    const historical = latest
      .replace(
        'target/phase6-physical/source-commit/build-v41',
        'target/phase6-physical/old/build-v40',
      )
      .replace('physical-build-managed-power-scheme-v41', 'physical-build-managed-power-scheme-v40')
      .replace('managed-power-scheme-v41', 'managed-power-scheme-v40')
      .replace(setup.artifactSha256, 'b'.repeat(64));
    write(setup.summaryPath, `${historical}\n${latest}`);

    expect(() =>
      writeCanonicalSimulationEvidence({
        artifactManifestPath: setup.artifactPath,
        evidenceManifestPath: setup.evidenceManifestPath,
        harnessPath: setup.harnessPath,
        minimumVersion: 'managed-power-scheme-v3',
        summaryPath: setup.summaryPath,
        uatPath: setup.uatPath,
        workspaceRoot: setup.root,
      }),
    ).not.toThrow();
    expect(readFileSync(setup.summaryPath, 'utf8').startsWith(historical)).toBe(true);
  });

  it('preserves blocked bytes and admits one exact v41 deterministic predecessor', () => {
    const setup = fixture();
    const result = writeCanonicalSimulationEvidence({
      artifactManifestPath: setup.artifactPath,
      evidenceManifestPath: setup.evidenceManifestPath,
      harnessPath: setup.harnessPath,
      minimumVersion: 'managed-power-scheme-v3',
      summaryPath: setup.summaryPath,
      uatPath: setup.uatPath,
      workspaceRoot: setup.root,
    });
    const manifest = JSON.parse(readFileSync(setup.evidenceManifestPath, 'utf8')) as {
      schemaVersion: number;
      requirementsCoverage: string[];
      legacyBlockedAttempts: { path: string }[];
      stages: { runs: unknown[] }[];
    };
    const uat = readFileSync(setup.uatPath, 'utf8');
    const legacy = manifest.legacyBlockedAttempts[0];
    const deterministic = manifest.stages[0];
    if (legacy === undefined || deterministic === undefined)
      throw new Error('admitted manifest omitted deterministic or legacy evidence');
    const legacyPath = resolve(setup.root, legacy.path);

    expect(result.operationVersion).toBe('managed-power-scheme-v41');
    expect(manifest.schemaVersion).toBe(2);
    expect(manifest.requirementsCoverage).toEqual(PHASE6_REQUIREMENTS);
    expect(deterministic.runs).toHaveLength(1);
    expect(manifest.stages.slice(1).every((cell) => cell.runs.length === 0)).toBe(true);
    expect(uat.startsWith(setup.uatBytes)).toBe(true);
    expect(readFileSync(legacyPath, 'utf8')).toBe(setup.legacyBytes);
  });

  it.each(['managed-power-scheme-v1', 'managed-power-scheme-v2'])(
    'rejects reused blocked version %s without changing authority bytes',
    (version) => {
      const setup = fixture(version);
      const beforeManifest = readFileSync(setup.evidenceManifestPath, 'utf8');
      const beforeUat = readFileSync(setup.uatPath, 'utf8');
      expect(() =>
        writeCanonicalSimulationEvidence({
          artifactManifestPath: setup.artifactPath,
          evidenceManifestPath: setup.evidenceManifestPath,
          harnessPath: setup.harnessPath,
          minimumVersion: 'managed-power-scheme-v3',
          summaryPath: setup.summaryPath,
          uatPath: setup.uatPath,
          workspaceRoot: setup.root,
        }),
      ).toThrow(/minimum|already appears/iu);
      expect(readFileSync(setup.evidenceManifestPath, 'utf8')).toBe(beforeManifest);
      expect(readFileSync(setup.uatPath, 'utf8')).toBe(beforeUat);
    },
  );

  it('rejects artifact drift and duplicate admission atomically', () => {
    const drift = fixture();
    write(join(dirname(drift.artifactPath), 'liiiraa-boost.msi'), 'mutated-msi');
    const driftManifest = readFileSync(drift.evidenceManifestPath, 'utf8');
    const driftUat = readFileSync(drift.uatPath, 'utf8');
    expect(() =>
      writeCanonicalSimulationEvidence({
        artifactManifestPath: drift.artifactPath,
        evidenceManifestPath: drift.evidenceManifestPath,
        harnessPath: drift.harnessPath,
        minimumVersion: 'managed-power-scheme-v3',
        summaryPath: drift.summaryPath,
        uatPath: drift.uatPath,
        workspaceRoot: drift.root,
      }),
    ).toThrow(/artifact role.*bytes/iu);
    expect(readFileSync(drift.evidenceManifestPath, 'utf8')).toBe(driftManifest);
    expect(readFileSync(drift.uatPath, 'utf8')).toBe(driftUat);

    const duplicate = fixture();
    writeCanonicalSimulationEvidence({
      artifactManifestPath: duplicate.artifactPath,
      evidenceManifestPath: duplicate.evidenceManifestPath,
      harnessPath: duplicate.harnessPath,
      minimumVersion: 'managed-power-scheme-v3',
      summaryPath: duplicate.summaryPath,
      uatPath: duplicate.uatPath,
      workspaceRoot: duplicate.root,
    });
    const admittedManifest = readFileSync(duplicate.evidenceManifestPath, 'utf8');
    const admittedUat = readFileSync(duplicate.uatPath, 'utf8');
    expect(() =>
      writeCanonicalSimulationEvidence({
        artifactManifestPath: duplicate.artifactPath,
        evidenceManifestPath: duplicate.evidenceManifestPath,
        harnessPath: duplicate.harnessPath,
        minimumVersion: 'managed-power-scheme-v3',
        summaryPath: duplicate.summaryPath,
        uatPath: duplicate.uatPath,
        workspaceRoot: duplicate.root,
      }),
    ).toThrow(/already|duplicate/iu);
    expect(readFileSync(duplicate.evidenceManifestPath, 'utf8')).toBe(admittedManifest);
    expect(readFileSync(duplicate.uatPath, 'utf8')).toBe(admittedUat);
  });
});
