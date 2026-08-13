import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { phase6EvidenceSha256 } from '../src/evaluate.js';
import {
  appendPhysicalReview,
  freezeFriendsRoster,
  parsePhysicalWriterCli,
  writePhysicalRunEvidence,
} from '../src/physical-writer.js';

vi.mock('node:child_process', () => ({ spawnSync: vi.fn() }));

const hash = (value: string | Uint8Array): string =>
  createHash('sha256').update(value).digest('hex');
const prefixed = (value: string | Uint8Array): string => `sha256:${hash(value)}`;
const ARTIFACT_HASH = prefixed('artifact-manifest');
const CONFIG_HASH = prefixed('clean-config');
const RUNNER_HASH = prefixed('runner');
const CONTINUATION = [
  'installed-ready',
  'checkpoint-ready',
  'running',
  'reboot-pending',
  'resumed-observation',
  'restored-complete',
];

let sandbox = '';
let previousCwd = '';

const manifestPath = () => join(sandbox, 'artifact-manifest.json');
const envelopePath = () => join(sandbox, 'evidence', 'clean-windows-vm', 'raw-run-envelope.json');
const evidencePath = () => resolve('tooling/phase6-evidence/evidence-manifest.json');

const physicalRun = (stage = 'clean-windows-vm') => {
  const initial = JSON.parse(readFileSync(evidencePath(), 'utf8')) as {
    stages: { runs: unknown[] }[];
  };
  const predecessor = initial.stages[0]!.runs[0]!;
  return {
    id: `run-${stage}-001`,
    source: 'phase6-physical-runner-rust-1',
    stage,
    evidenceKind: 'physical',
    status: 'PASS',
    operationVersion: 'managed-power-scheme-v3',
    buildId: 'physical-build-0001',
    participantId: 'participant-owner',
    machineSlot: null,
    artifactManifestSha256: ARTIFACT_HASH.slice(7),
    configSha256: CONFIG_HASH.slice(7),
    friendsRosterSha256: null,
    predecessorRunEvidenceSha256: phase6EvidenceSha256(predecessor),
    recordedAt: '2030-01-15T18:00:00.000Z',
    exportedAt: null,
    expiresAt: '2031-01-15T18:00:00.000Z',
    artifacts: [
      { path: 'phase6-physical-runner.exe', sha256: RUNNER_HASH.slice(7) },
      { path: 'configs/clean-windows-vm.run-config.json', sha256: CONFIG_HASH.slice(7) },
    ],
    cycle: {
      prepare: 'PASS',
      apply: 'PASS',
      verifyApply: 'PASS',
      restartRequired: true,
      restart: 'PASS',
      restore: 'PASS',
      verifyRestore: 'PASS',
    },
    continuation: [...CONTINUATION],
    journalSha256: hash('journal'),
    receiptSha256: hash('receipt'),
    security: {
      ipcAdversarial: 'PASS',
      replayRejected: true,
      identitySpoofRejected: true,
      sessionSwapRejected: true,
    },
    faults: { diskFull: 'PASS', crash: 'PASS', reboot: 'PASS', drift: 'PASS' },
    accessibility: { status: 'PASS', seriousOrCriticalViolations: 0 },
    diagnostics: {
      redacted: true,
      previewed: true,
      consentBound: false,
      autoUpload: false,
      rawFieldsFound: [],
      byteLength: 1024,
    },
    revocation: {
      signed: true,
      blocksNewApply: true,
      localRecoveryAvailable: true,
      remoteRollback: false,
      remoteExecution: false,
    },
    coverageGaps: ['additional-hardware'],
    universalSupportClaim: false,
    manualOverride: false,
  };
};

const writeJson = (path: string, value: unknown): void => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
};

const setupFixture = (): void => {
  const deterministic = {
    ...physicalRunWithoutManifest(),
    id: 'run-deterministic-001',
    source: 'phase6-deterministic-rust-1',
    stage: 'deterministic-simulation',
    evidenceKind: 'deterministic',
    participantId: 'deterministic-runner',
    predecessorRunEvidenceSha256: null,
  };
  const manifest = {
    schemaVersion: 2,
    generatedAt: '2030-01-15T17:00:00.000Z',
    operationVersion: 'managed-power-scheme-v3',
    immutableBuild: {
      id: 'physical-build-0001',
      commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      artifact: { path: 'liiiraa-boost.msi', sha256: hash('msi') },
      artifactManifestSha256: ARTIFACT_HASH.slice(7),
    },
    promotionStage: 'deterministic-simulation',
    requirementsCoverage: Array.from(
      { length: 8 },
      (_, index) => `PLAN-${String(index + 1).padStart(2, '0')}`,
    ),
    decisionCoverage: Array.from(
      { length: 35 },
      (_, index) => `D-${String(index + 1).padStart(2, '0')}`,
    ),
    legacyBlockedAttempts: [],
    stages: ['deterministic-simulation', 'clean-windows-vm', 'owner-pc', 'friends-pc'].map(
      (stage, index, stages) => ({
        stage,
        predecessorStage: index === 0 ? null : stages[index - 1],
        friendsRoster: null,
        runs: index === 0 ? [deterministic] : [],
        consents: [],
        reviews: [],
      }),
    ),
  };
  writeJson(evidencePath(), manifest);

  const config = {
    kind: 'physical-run-config',
    schemaVersion: '1.0',
    configId: 'clean-config-0001',
    stage: 'clean-windows-vm',
    configPath: 'configs/clean-windows-vm.run-config.json',
    artifactManifestPath: 'artifact-manifest.json',
    artifactManifestSha256: ARTIFACT_HASH,
    operationVersionId: 'managed-power-scheme-v3',
    buildId: 'physical-build-0001',
    sourceCommit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    participantIdentityMode: 'purpose-bound-local-hash',
    scenarios: {
      prepareRecovery: true,
      apply: true,
      verifyApplied: true,
      rebootWhenRequired: true,
      restore: true,
      verifyRestored: true,
    },
    paths: {
      runRecordPath: 'state/clean-windows-vm/run-record.json',
      installedReadyRecordPath: 'state/clean-windows-vm/installed-ready.json',
      checkpointReadyRecordPath: 'state/clean-windows-vm/checkpoint-ready.json',
      continuationPath: 'state/clean-windows-vm/physical-continuation.json',
      rawEnvelopePath: 'evidence/clean-windows-vm/raw-run-envelope.json',
    },
    tauriCommands: {},
  };
  writeJson(join(sandbox, config.configPath), config);
  const artifact = {
    kind: 'artifact-manifest',
    schemaVersion: '1.0',
    manifestId: 'artifact-manifest-0001',
    sourceCommit: config.sourceCommit,
    inputTreeHash: prefixed('tree'),
    buildId: config.buildId,
    operationVersionId: config.operationVersionId,
    createdAt: '2030-01-15T17:00:00.000Z',
    files: {
      msi: { relativePath: 'liiiraa-boost.msi', sha256: prefixed('msi') },
      installationManifest: {
        relativePath: 'installation-manifest.json',
        sha256: prefixed('install'),
      },
      installationManifestSignature: {
        relativePath: 'installation-manifest.json.p7s',
        sha256: prefixed('install-sig'),
      },
      cleanWindowsVmConfig: { relativePath: config.configPath, sha256: CONFIG_HASH },
      ownerPcConfig: {
        relativePath: 'configs/owner-pc.run-config.json',
        sha256: prefixed('owner-config'),
      },
      friendsPcConfig: {
        relativePath: 'configs/friends-pc.run-config.json',
        sha256: prefixed('friends-config'),
      },
      runner: { relativePath: 'phase6-physical-runner.exe', sha256: RUNNER_HASH },
      tauriDriver: { relativePath: 'tauri-driver.exe', sha256: prefixed('tauri') },
      msedgeDriver: { relativePath: 'msedgedriver.exe', sha256: prefixed('edge') },
    },
  };
  writeJson(manifestPath(), artifact);
  writeJson(envelopePath(), {
    run: physicalRun(),
    consent: null,
    redactedOutput: 'bounded-safe-output',
  });
};

const physicalRunWithoutManifest = () => ({
  id: 'placeholder',
  source: 'phase6-physical-runner-rust-1',
  stage: 'clean-windows-vm',
  evidenceKind: 'physical',
  status: 'PASS',
  operationVersion: 'managed-power-scheme-v3',
  buildId: 'physical-build-0001',
  participantId: 'participant-owner',
  machineSlot: null,
  artifactManifestSha256: ARTIFACT_HASH.slice(7),
  configSha256: CONFIG_HASH.slice(7),
  friendsRosterSha256: null,
  predecessorRunEvidenceSha256: null,
  recordedAt: '2030-01-15T16:00:00.000Z',
  exportedAt: null,
  expiresAt: '2031-01-15T16:00:00.000Z',
  artifacts: [{ path: 'fixture', sha256: hash('fixture') }],
  cycle: {
    prepare: 'PASS',
    apply: 'PASS',
    verifyApply: 'PASS',
    restartRequired: true,
    restart: 'PASS',
    restore: 'PASS',
    verifyRestore: 'PASS',
  },
  continuation: [...CONTINUATION],
  journalSha256: hash('journal'),
  receiptSha256: hash('receipt'),
  security: {
    ipcAdversarial: 'PASS',
    replayRejected: true,
    identitySpoofRejected: true,
    sessionSwapRejected: true,
  },
  faults: { diskFull: 'PASS', crash: 'PASS', reboot: 'PASS', drift: 'PASS' },
  accessibility: { status: 'PASS', seriousOrCriticalViolations: 0 },
  diagnostics: {
    redacted: true,
    previewed: true,
    consentBound: true,
    autoUpload: false,
    rawFieldsFound: [],
    byteLength: 10,
  },
  revocation: {
    signed: true,
    blocksNewApply: true,
    localRecoveryAvailable: true,
    remoteRollback: false,
    remoteExecution: false,
  },
  coverageGaps: ['additional-hardware'],
  universalSupportClaim: false,
  manualOverride: false,
});

const snapshot = (root = sandbox): Record<string, string> => {
  const result: Record<string, string> = {};
  const visit = (path: string): void => {
    if (!existsSync(path)) return;
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const child = join(path, entry.name);
      if (entry.isDirectory()) visit(child);
      else result[child.slice(root.length + 1)] = readFileSync(child).toString('base64');
    }
  };
  visit(root);
  return result;
};

const verified = (): void => {
  vi.mocked(spawnSync).mockReturnValue({
    status: 0,
    stdout: Buffer.from(
      `${JSON.stringify({ verdict: 'verified', manifestSha256: ARTIFACT_HASH, operationVersionId: 'managed-power-scheme-v3', friendsRosterVerified: true })}\n`,
    ),
    stderr: Buffer.alloc(0),
    pid: 1,
    output: [],
    signal: null,
  });
};

beforeEach(() => {
  previousCwd = process.cwd();
  sandbox = mkdtempSync(join(tmpdir(), 'phase6-writer-'));
  process.chdir(sandbox);
  setupFixture();
  verified();
});

afterEach(() => {
  process.chdir(previousCwd);
  rmSync(sandbox, { recursive: true, force: true });
  vi.clearAllMocks();
});

describe('closed physical writer CLI', () => {
  it.each([
    [
      'ingest',
      [
        '--artifact-manifest',
        manifestPath(),
        '--run-envelope',
        envelopePath(),
        '--stage',
        'clean-windows-vm',
      ],
    ],
    [
      'freeze-roster',
      ['--artifact-manifest', manifestPath(), '--roster', join(sandbox, 'candidate.json')],
    ],
    ['review', ['--stage', 'clean-windows-vm', '--review', join(sandbox, 'review.json')]],
  ])('accepts the canonical %s grammar', (command, args) => {
    expect(parsePhysicalWriterCli(command, args)).toBeTruthy();
  });

  it.each(['--output', '--signer', '--pin', '--participant', '--overwrite'])(
    'rejects authority override %s',
    (flag) => {
      expect(() =>
        parsePhysicalWriterCli('freeze-roster', [
          '--artifact-manifest',
          manifestPath(),
          '--roster',
          'candidate.json',
          flag,
          'attacker',
        ]),
      ).toThrow(/CLI/u);
    },
  );
});

describe('artifact-verifier-first physical ingestion', () => {
  it('invokes only the fixed 06-35 verifier before reading the envelope', () => {
    vi.mocked(spawnSync).mockReturnValueOnce({
      status: 2,
      stdout: Buffer.alloc(0),
      stderr: Buffer.from('tampered'),
      pid: 1,
      output: [],
      signal: null,
    });
    rmSync(envelopePath());
    const before = snapshot();
    expect(() =>
      writePhysicalRunEvidence({
        artifactManifestPath: manifestPath(),
        runEnvelopePath: envelopePath(),
        stage: 'clean-windows-vm',
      }),
    ).toThrow(/artifact verifier/u);
    expect(snapshot()).toEqual(before);
    expect(spawnSync).toHaveBeenCalledWith(
      'cargo',
      expect.arrayContaining(['phase6-artifact-verifier', '--artifact-manifest', manifestPath()]),
      expect.objectContaining({ encoding: 'utf8' }),
    );
  });

  it.each([
    'bad-cms',
    'wrong-spki',
    'manifest',
    'config',
    'msi',
    'runner',
    'tauri-driver',
    'msedge-driver',
  ])('leaves every byte unchanged when 06-35 rejects %s mutation', (reason) => {
    vi.mocked(spawnSync).mockReturnValueOnce({
      status: 2,
      stdout: Buffer.alloc(0),
      stderr: Buffer.from(reason),
      pid: 1,
      output: [],
      signal: null,
    });
    const before = snapshot();
    expect(() =>
      writePhysicalRunEvidence({
        artifactManifestPath: manifestPath(),
        runEnvelopePath: envelopePath(),
        stage: 'clean-windows-vm',
      }),
    ).toThrow();
    expect(snapshot()).toEqual(before);
  });

  it.each([
    [
      'deterministic relabel',
      (run: Record<string, unknown>) => {
        run.source = 'phase6-deterministic-rust-1';
      },
    ],
    [
      'browser callback',
      (run: Record<string, unknown>) => {
        run.source = 'apps/desktop/tests/packaged/transactional-plans.ts';
      },
    ],
    [
      'stage mismatch',
      (run: Record<string, unknown>) => {
        run.stage = 'owner-pc';
      },
    ],
    [
      'config mismatch',
      (run: Record<string, unknown>) => {
        run.configSha256 = hash('forged');
      },
    ],
    [
      'predecessor mismatch',
      (run: Record<string, unknown>) => {
        run.predecessorRunEvidenceSha256 = hash('forged');
      },
    ],
    [
      'continuation mismatch',
      (run: Record<string, unknown>) => {
        run.continuation = ['installed-ready'];
      },
    ],
    [
      'raw secret',
      (_run: Record<string, unknown>, envelope: Record<string, unknown>) => {
        envelope.redactedOutput = 'Authorization: Bearer secret-token';
      },
    ],
    [
      'oversize',
      (_run: Record<string, unknown>, envelope: Record<string, unknown>) => {
        envelope.redactedOutput = 'x'.repeat(65_537);
      },
    ],
  ])('rejects %s atomically', (_name, mutate) => {
    const envelope = JSON.parse(readFileSync(envelopePath(), 'utf8')) as {
      run: Record<string, unknown>;
      redactedOutput: string;
    };
    mutate(envelope.run, envelope);
    writeFileSync(envelopePath(), `${JSON.stringify(envelope)}\n`);
    const before = snapshot();
    expect(() =>
      writePhysicalRunEvidence({
        artifactManifestPath: manifestPath(),
        runEnvelopePath: envelopePath(),
        stage: 'clean-windows-vm',
      }),
    ).toThrow();
    expect(snapshot()).toEqual(before);
  });

  it('creates one unique run record and rejects duplicate ingestion without mutation', () => {
    const result = writePhysicalRunEvidence({
      artifactManifestPath: manifestPath(),
      runEnvelopePath: envelopePath(),
      stage: 'clean-windows-vm',
    });
    expect(existsSync(result.runRecordPath)).toBe(true);
    const stored = JSON.parse(readFileSync(evidencePath(), 'utf8')) as {
      stages: { runs: unknown[] }[];
    };
    expect(stored.stages[1]!.runs).toHaveLength(1);
    const before = snapshot();
    expect(() =>
      writePhysicalRunEvidence({
        artifactManifestPath: manifestPath(),
        runEnvelopePath: envelopePath(),
        stage: 'clean-windows-vm',
      }),
    ).toThrow(/duplicate|exists/u);
    expect(snapshot()).toEqual(before);
  });
});

describe('frozen friends roster and later review', () => {
  it('creates only the config-fixed canonical roster/CMS pair and rejects a second freeze', () => {
    const candidate = join(sandbox, 'candidate.json');
    writeJson(candidate, {
      kind: 'friends-roster',
      schemaVersion: '1.0',
      rosterId: 'friends-roster-0001',
      artifactManifestSha256: ARTIFACT_HASH,
      friendsConfigSha256: prefixed('friends-config'),
      operationVersionId: 'managed-power-scheme-v3',
      buildId: 'physical-build-0001',
      sourceCommit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      purpose: 'phase6-friends-physical-validation',
      createdAt: '2030-01-15T17:30:00.000Z',
      participants: [
        { participantId: prefixed('friend-a'), machineSlot: 'friends-slot-01' },
        { participantId: prefixed('friend-b'), machineSlot: 'friends-slot-02' },
      ],
    });
    const result = freezeFriendsRoster({
      artifactManifestPath: manifestPath(),
      rosterCandidatePath: candidate,
    });
    expect(result.rosterPath).toBe(join(sandbox, 'friends', 'friends-roster.json'));
    expect(existsSync(result.signaturePath)).toBe(true);
    const before = snapshot();
    expect(() =>
      freezeFriendsRoster({ artifactManifestPath: manifestPath(), rosterCandidatePath: candidate }),
    ).toThrow(/exists|frozen/u);
    expect(snapshot()).toEqual(before);
  });

  it.each([
    [
      'artifact binding',
      (roster: Record<string, unknown>) => {
        roster.artifactManifestSha256 = prefixed('wrong');
      },
    ],
    [
      'config binding',
      (roster: Record<string, unknown>) => {
        roster.friendsConfigSha256 = prefixed('wrong');
      },
    ],
    [
      'duplicate slot',
      (roster: Record<string, unknown>) => {
        const participants = roster.participants as { machineSlot: string }[];
        participants[1]!.machineSlot = participants[0]!.machineSlot;
      },
    ],
    [
      'reordered slot',
      (roster: Record<string, unknown>) => {
        (roster.participants as unknown[]).reverse();
      },
    ],
  ])('rejects invalid roster %s without creating a half pair', (_name, mutate) => {
    const candidate = join(sandbox, 'candidate.json');
    const roster: Record<string, unknown> = {
      kind: 'friends-roster',
      schemaVersion: '1.0',
      rosterId: 'friends-roster-0001',
      artifactManifestSha256: ARTIFACT_HASH,
      friendsConfigSha256: prefixed('friends-config'),
      operationVersionId: 'managed-power-scheme-v3',
      buildId: 'physical-build-0001',
      sourceCommit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      purpose: 'phase6-friends-physical-validation',
      createdAt: '2030-01-15T17:30:00.000Z',
      participants: [
        { participantId: prefixed('friend-a'), machineSlot: 'friends-slot-01' },
        { participantId: prefixed('friend-b'), machineSlot: 'friends-slot-02' },
      ],
    };
    mutate(roster);
    writeJson(candidate, roster);
    const before = snapshot();
    expect(() =>
      freezeFriendsRoster({ artifactManifestPath: manifestPath(), rosterCandidatePath: candidate }),
    ).toThrow();
    expect(snapshot()).toEqual(before);
    expect(existsSync(join(sandbox, 'friends', 'friends-roster.json'))).toBe(false);
    expect(existsSync(join(sandbox, 'friends', 'friends-roster.json.p7s'))).toBe(false);
  });

  it('records only a strictly later exact review and never overwrites it', () => {
    const ingestion = writePhysicalRunEvidence({
      artifactManifestPath: manifestPath(),
      runEnvelopePath: envelopePath(),
      stage: 'clean-windows-vm',
    });
    const run = ingestion.run;
    const review = {
      id: 'review-clean-001',
      reviewerId: 'reviewer-001',
      participantId: run.participantId,
      machineSlot: null,
      recordedAt: '2030-01-15T19:00:00.000Z',
      response: 'APPROVED',
      verdict: 'APPROVED',
      operationVersion: run.operationVersion,
      buildId: run.buildId,
      stage: run.stage,
      artifactManifestSha256: run.artifactManifestSha256,
      configSha256: run.configSha256,
      friendsRosterSha256: null,
      runEvidenceId: run.id,
      runEvidenceSha256: phase6EvidenceSha256(run),
      consentId: null,
      consentSha256: null,
      artifactHashes: run.artifacts.map((artifact: { sha256: string }) => artifact.sha256),
    };
    const reviewPath = join(sandbox, 'review.json');
    writeJson(reviewPath, review);
    const result = appendPhysicalReview({ stage: 'clean-windows-vm', reviewPath });
    expect(existsSync(result.reviewRecordPath)).toBe(true);
    const before = snapshot();
    expect(() => appendPhysicalReview({ stage: 'clean-windows-vm', reviewPath })).toThrow(
      /duplicate|exists/u,
    );
    expect(snapshot()).toEqual(before);
  });
});
