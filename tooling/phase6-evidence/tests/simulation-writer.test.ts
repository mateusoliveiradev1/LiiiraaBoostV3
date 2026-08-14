import { createHash } from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { PHASE6_DECISIONS, PHASE6_REQUIREMENTS } from '../src/evaluate.js';
import {
  assertCanonicalSimulationCandidate,
  createCanonicalSimulationCandidate,
  parseSimulationWriterCli,
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
  const uatPath = join(
    root,
    '.planning/phases/06-transactional-plans-and-recovery/06-UAT.md',
  );
  const uatBytes = '# UAT\n\nmanaged-power-scheme-v1 BLOCKED\nmanaged-power-scheme-v2 BLOCKED\n';
  write(uatPath, uatBytes);
  const evidenceManifestPath = join(root, 'tooling/phase6-evidence/evidence-manifest.json');
  const legacyBytes = `${JSON.stringify({
    schemaVersion: 1,
    operationVersion: 'managed-power-scheme-v2',
    requirementsCoverage: ['PLAN-01', 'PLAN-05', 'PLAN-06', 'PLAN-07', 'PLAN-08'],
  }, null, 2)}\n`;
  write(evidenceManifestPath, legacyBytes);
  const harnessPath = join(root, 'apps/desktop/tests/packaged/transactional-plans.ts');
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

describe('closed simulation writer CLI', () => {
  it('accepts only summary/direct artifact input plus the explicit minimum version', () => {
    expect(
      parseSimulationWriterCli([
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
    expect(() => assertCanonicalSimulationCandidate(candidate)).not.toThrow();
  });

  it.each([
    ['omitted requirement', (value: any) => value.requirementsCoverage.pop()],
    ['reordered requirement', (value: any) => value.requirementsCoverage.reverse()],
    ['duplicate requirement', (value: any) => (value.requirementsCoverage[7] = 'PLAN-07')],
    ['unknown requirement', (value: any) => (value.requirementsCoverage[7] = 'PLAN-99')],
    ['partial cycle', (value: any) => (value.run.cycle.restore = 'FAIL')],
    ['physical relabel', (value: any) => (value.run.evidenceKind = 'physical')],
    ['physical source', (value: any) => (value.run.source = 'phase6-physical-runner-rust-1')],
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
    const manifest = JSON.parse(readFileSync(setup.evidenceManifestPath, 'utf8')) as any;
    const uat = readFileSync(setup.uatPath, 'utf8');
    const legacyPath = resolve(setup.root, manifest.legacyBlockedAttempts[0].path);

    expect(result.operationVersion).toBe('managed-power-scheme-v41');
    expect(manifest.schemaVersion).toBe(2);
    expect(manifest.requirementsCoverage).toEqual(PHASE6_REQUIREMENTS);
    expect(manifest.stages[0].runs).toHaveLength(1);
    expect(manifest.stages.slice(1).every((cell: any) => cell.runs.length === 0)).toBe(true);
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
