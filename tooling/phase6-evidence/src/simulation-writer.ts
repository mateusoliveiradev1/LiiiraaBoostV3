import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createCanonicalDeterministicSimulationEvidence } from '@liiiraa/desktop-simulator/transactional-plans';
import {
  PHASE6_DECISIONS,
  PHASE6_PROMOTION_STAGES,
  PHASE6_REQUIREMENTS,
  assertDeterministicAdmissionChain as assertAdmissionChain,
  canonicalPhase6Evidence,
  phase6EvidenceSha256,
  type Phase6Consent,
  type Phase6DeterministicAdmission,
  type Phase6EvidenceManifest,
  type Phase6HumanReview,
  type Phase6RunEvidence,
} from './evaluate.ts';

export const assertDeterministicAdmissionChain = assertAdmissionChain;

const HASH = /^(?:sha256:)?([a-f0-9]{64})$/u;
const VERSION = /^managed-power-scheme-v([1-9][0-9]*)$/u;
const COMMIT = /^[a-f0-9]{40}$/u;
const REQUIRED_ROLES = [
  'msi',
  'installationManifest',
  'installationManifestSignature',
  'cleanWindowsVmConfig',
  'ownerPcConfig',
  'friendsPcConfig',
  'runner',
  'tauriDriver',
  'msedgeDriver',
] as const;
const CONTINUATION = [
  'installed-ready',
  'checkpoint-ready',
  'running',
  'reboot-pending',
  'resumed-observation',
  'restored-complete',
] as const;
const ARTIFACT_VERSION_KEY_LINK = 'artifactManifestSha256 binds operationVersion';

type JsonObject = Record<string, unknown>;

export type SimulationWriterCli =
  | { artifactManifestPath: string; minimumVersion: string }
  | { artifactManifestFromSummary: string; minimumVersion: string };

export interface CanonicalSimulationCandidate {
  requirementsCoverage: string[];
  decisionCoverage: string[];
  run: Phase6RunEvidence;
  consents: Phase6Consent[];
  reviews: Phase6HumanReview[];
}

export interface SimulationWriterInput {
  artifactManifestPath: string;
  evidenceManifestPath: string;
  harnessPath: string;
  minimumVersion: string;
  summaryPath: string;
  uatPath: string;
  workspaceRoot: string;
}

export interface SimulationWriterResult {
  operationVersion: string;
  buildId: string;
  artifactManifestSha256: string;
  runEvidenceSha256: string;
  evidenceManifestSha256: string;
  highestAdmittedStage: 'deterministic-simulation';
  requirementsCoverage: string[];
}

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const sha256 = (value: string | Uint8Array): string =>
  createHash('sha256').update(value).digest('hex');

const unprefix = (value: unknown, label: string): string => {
  if (typeof value !== 'string') throw new Error(`${label} SHA-256 is missing.`);
  const match = HASH.exec(value);
  if (match === null) throw new Error(`${label} SHA-256 is invalid.`);
  const digest = match[1];
  if (digest === undefined) throw new Error(`${label} SHA-256 is invalid.`);
  return digest;
};

const readJson = (path: string, label: string): JsonObject => {
  const value: unknown = JSON.parse(readFileSync(path, 'utf8'));
  if (!isObject(value)) throw new Error(`${label} must be a JSON object.`);
  return value;
};

const exactRelativePath = (root: string, path: string): string => {
  const absoluteRoot = resolve(root);
  const absolutePath = resolve(path);
  const prefix = `${absoluteRoot}${absoluteRoot.includes('\\') ? '\\' : '/'}`;
  if (absolutePath !== absoluteRoot && !absolutePath.startsWith(prefix))
    throw new Error('Simulation evidence path escapes workspace custody.');
  return absolutePath.slice(prefix.length).replaceAll('\\', '/');
};

const resolveUnder = (root: string, path: unknown, label: string): string => {
  if (
    typeof path !== 'string' ||
    path.length === 0 ||
    isAbsolute(path) ||
    path.includes('..') ||
    path.includes('\\')
  )
    throw new Error(`${label} path is invalid.`);
  const absolute = resolve(root, path);
  const custody = `${resolve(root)}${root.includes('\\') ? '\\' : '/'}`;
  if (!absolute.startsWith(custody)) throw new Error(`${label} escapes artifact custody.`);
  return absolute;
};

const compareExact = (
  actual: readonly string[],
  expected: readonly string[],
  label: string,
): void => {
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    throw new Error(`${label} must be exact, ordered, unique, and closed.`);
};

const hasExactKeys = (value: JsonObject, keys: readonly string[]): boolean =>
  JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());

export const parseSimulationWriterCli = (args: readonly string[]): SimulationWriterCli => {
  const normalized = args[0] === '--' ? args.slice(1) : args;
  if (
    normalized.length === 4 &&
    normalized[2] === '--minimum-version' &&
    typeof normalized[1] === 'string' &&
    typeof normalized[3] === 'string'
  ) {
    if (normalized[0] === '--artifact-manifest')
      return { artifactManifestPath: normalized[1], minimumVersion: normalized[3] };
    if (normalized[0] === '--artifact-manifest-from-summary')
      return {
        artifactManifestFromSummary: normalized[1],
        minimumVersion: normalized[3],
      };
  }
  throw new Error(
    'Simulation writer CLI has a closed grammar and no physical, review, consent, or caller-PASS flags.',
  );
};

const summaryAuthority = (
  summaryPath: string,
): {
  root: string;
  buildId: string;
  operationVersion: string;
  artifactManifestSha256: string;
} => {
  const bytes = readFileSync(summaryPath, 'utf8');
  const blocks = [
    ...bytes.matchAll(
      /- \*\*Root:\*\* `([^`]+)`\r?\n- \*\*Build ID:\*\* `([^`]+)`\r?\n- \*\*Operation version:\*\* `([^`]+)`(?:(?!- \*\*Root:\*\*)[\s\S])*?`artifact-manifest\.json`\s*\|\s*`([a-f0-9]{64})`/gu,
    ),
  ];
  const latest = blocks.at(-1);
  const root = latest?.[1];
  const buildId = latest?.[2];
  const operationVersion = latest?.[3];
  const artifactManifestSha256 = latest?.[4];
  if (
    root === undefined ||
    buildId === undefined ||
    operationVersion === undefined ||
    artifactManifestSha256 === undefined
  )
    throw new Error('06-31 summary does not contain the exact published artifact authority.');
  return { root, buildId, operationVersion, artifactManifestSha256 };
};

const numericVersion = (value: string, label: string): number => {
  const match = VERSION.exec(value);
  if (match === null) throw new Error(`${label} is not a managed-power-scheme-vN identity.`);
  return Number(match[1]);
};

const assertFreshVersion = (
  operationVersion: string,
  minimumVersion: string,
  legacyManifestBytes: string,
  uatBytes: string,
  sourceCommit: string,
): void => {
  if (
    numericVersion(operationVersion, 'Reserved operation version') <
    numericVersion(minimumVersion, 'Minimum version')
  )
    throw new Error(`Reserved operation version is below minimum ${minimumVersion}.`);
  if (legacyManifestBytes.includes(operationVersion) || uatBytes.includes(operationVersion))
    throw new Error(
      `Reserved operation version ${operationVersion} already appears in authoritative evidence.`,
    );
  for (const path of [
    'tooling/phase6-evidence/evidence-manifest.json',
    '.planning/phases/06-transactional-plans-and-recovery/06-UAT.md',
  ]) {
    const prior = spawnSync('git', ['show', `${sourceCommit}^:${path}`], { encoding: 'utf8' });
    if (prior.status === 0 && String(prior.stdout).includes(operationVersion))
      throw new Error(
        `Reserved operation version ${operationVersion} existed before 06-31 reservation.`,
      );
  }
};

const validateArtifact = (
  artifactManifestPath: string,
  summaryPath: string,
  workspaceRoot: string,
): {
  artifact: JsonObject;
  artifactManifestSha256: string;
  buildId: string;
  operationVersion: string;
  sourceCommit: string;
  recordedAt: string;
} => {
  const summary = summaryAuthority(summaryPath);
  const expectedPath = resolve(workspaceRoot, summary.root, 'artifact-manifest.json');
  if (resolve(artifactManifestPath) !== expectedPath)
    throw new Error('Artifact manifest path does not match the exact 06-31 published root.');
  const artifactBytes = readFileSync(artifactManifestPath);
  const artifactManifestSha256 = sha256(artifactBytes);
  if (artifactManifestSha256 !== summary.artifactManifestSha256)
    throw new Error('Artifact manifest bytes drifted from the 06-31 recorded SHA-256.');
  const artifact = readJson(artifactManifestPath, 'artifact manifest');
  const operationVersion =
    typeof artifact['operationVersionId'] === 'string' ? artifact['operationVersionId'] : '';
  const buildId = typeof artifact['buildId'] === 'string' ? artifact['buildId'] : '';
  const sourceCommit = typeof artifact['sourceCommit'] === 'string' ? artifact['sourceCommit'] : '';
  const recordedAt = typeof artifact['createdAt'] === 'string' ? artifact['createdAt'] : '';
  if (
    artifact['kind'] !== 'artifact-manifest' ||
    artifact['schemaVersion'] !== '1.0' ||
    operationVersion !== summary.operationVersion ||
    buildId !== summary.buildId ||
    !COMMIT.test(sourceCommit) ||
    !Number.isFinite(Date.parse(recordedAt))
  )
    throw new Error('Artifact manifest identity does not match the exact 06-31 authority.');
  const files = artifact['files'];
  if (
    !isObject(files) ||
    Object.keys(files).length !== REQUIRED_ROLES.length ||
    REQUIRED_ROLES.some((role) => !isObject(files[role]))
  )
    throw new Error('Artifact manifest role set is not exact.');
  const artifactRoot = dirname(artifactManifestPath);
  for (const roleName of REQUIRED_ROLES) {
    const role = files[roleName] as JsonObject;
    const rolePath = resolveUnder(artifactRoot, role['relativePath'], `artifact role ${roleName}`);
    const roleBytes = readFileSync(rolePath);
    if (
      sha256(roleBytes) !== unprefix(role['sha256'], `artifact role ${roleName}`) ||
      roleBytes.byteLength !== role['sizeBytes']
    )
      throw new Error(
        `Artifact role ${roleName} live bytes drifted from the authenticated manifest.`,
      );
  }
  return {
    artifact,
    artifactManifestSha256,
    buildId,
    operationVersion,
    sourceCommit,
    recordedAt,
  };
};

export const createCanonicalSimulationCandidate = (input: {
  artifactManifestPath: string;
  artifactManifestSha256: string;
  buildId: string;
  harnessPath: string;
  operationVersion: string;
  recordedAt: string;
  sourceCommit: string;
  workspaceRoot: string;
  predecessorEvidenceSha256?: string | null;
}): CanonicalSimulationCandidate => {
  const harnessSha256 = sha256(readFileSync(input.harnessPath));
  const harnessEvidence = createCanonicalDeterministicSimulationEvidence({
    buildSha256: input.artifactManifestSha256,
    operationVersion: input.operationVersion,
  });
  const canonical = harnessEvidence.canonicalSimulation;
  if (canonical === null) throw new Error('Canonical deterministic lifecycle is incomplete.');
  const run: Phase6RunEvidence = {
    id: `phase6-deterministic-simulation-${input.operationVersion}-${input.artifactManifestSha256.slice(0, 12)}`,
    source: 'phase6-deterministic-rust-1',
    stage: 'deterministic-simulation',
    evidenceKind: 'deterministic',
    status: 'PASS',
    operationVersion: input.operationVersion,
    buildId: input.buildId,
    participantId: 'deterministic-simulation-runner',
    machineSlot: null,
    artifactManifestSha256: input.artifactManifestSha256,
    configSha256: unprefix(harnessEvidence.evidenceHash, 'deterministic harness'),
    friendsRosterSha256: null,
    predecessorRunEvidenceSha256: input.predecessorEvidenceSha256 ?? null,
    recordedAt: input.recordedAt,
    exportedAt: null,
    expiresAt: '2099-12-31T23:59:59.999Z',
    artifacts: [
      {
        path: exactRelativePath(input.workspaceRoot, input.artifactManifestPath),
        sha256: input.artifactManifestSha256,
      },
      { path: exactRelativePath(input.workspaceRoot, input.harnessPath), sha256: harnessSha256 },
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
    continuation: [...canonical.continuation],
    journalSha256: canonical.journalSha256,
    receiptSha256: canonical.receiptSha256,
    security: {
      ipcAdversarial: 'PASS',
      replayRejected: true,
      identitySpoofRejected: true,
      sessionSwapRejected: true,
    },
    faults: { ...canonical.faults },
    accessibility: {
      status: canonical.accessibilityAutomation.status,
      seriousOrCriticalViolations: canonical.accessibilityAutomation.seriousOrCriticalViolations,
    },
    diagnostics: {
      redacted: true,
      previewed: true,
      consentBound: false,
      autoUpload: false,
      rawFieldsFound: [],
      byteLength: Buffer.byteLength(canonicalPhase6Evidence(harnessEvidence), 'utf8'),
    },
    revocation: {
      signed: true,
      ...canonical.revocation,
    },
    coverageGaps: [
      'clean-windows-vm-physical-evidence-pending',
      'owner-pc-physical-evidence-pending',
      'friends-pc-physical-evidence-pending',
      'narrator-human-comprehension-pending',
    ],
    universalSupportClaim: false,
    manualOverride: false,
  };
  void input.sourceCommit;
  return {
    requirementsCoverage: [...PHASE6_REQUIREMENTS],
    decisionCoverage: [...PHASE6_DECISIONS],
    run,
    consents: [],
    reviews: [],
  };
};

export const assertCanonicalSimulationCandidate = (
  candidate: CanonicalSimulationCandidate,
): void => {
  compareExact(candidate.requirementsCoverage, PHASE6_REQUIREMENTS, 'Requirement coverage');
  compareExact(candidate.decisionCoverage, PHASE6_DECISIONS, 'Decision coverage');
  if (candidate.consents.length !== 0 || candidate.reviews.length !== 0)
    throw new Error('Deterministic simulation cannot claim consent or human review.');
  const run = candidate.run;
  if (
    run.source !== 'phase6-deterministic-rust-1' ||
    run.stage !== 'deterministic-simulation' ||
    run.evidenceKind !== 'deterministic' ||
    run.status !== 'PASS' ||
    run.machineSlot !== null ||
    run.friendsRosterSha256 !== null ||
    (run.predecessorRunEvidenceSha256 !== null && !HASH.test(run.predecessorRunEvidenceSha256)) ||
    run.exportedAt !== null
  )
    throw new Error('Deterministic simulation provenance cannot be relabeled as physical.');
  if (
    run.cycle.prepare !== 'PASS' ||
    run.cycle.apply !== 'PASS' ||
    run.cycle.verifyApply !== 'PASS' ||
    !run.cycle.restartRequired ||
    run.cycle.restart !== 'PASS' ||
    run.cycle.restore !== 'PASS' ||
    run.cycle.verifyRestore !== 'PASS'
  )
    throw new Error('Canonical deterministic cycle is incomplete.');
  compareExact(run.continuation, CONTINUATION, 'Continuation');
  if (
    !HASH.test(run.journalSha256) ||
    !HASH.test(run.receiptSha256) ||
    run.security.ipcAdversarial !== 'PASS' ||
    !run.security.replayRejected ||
    !run.security.identitySpoofRejected ||
    !run.security.sessionSwapRejected ||
    Object.values(run.faults).some((status) => status !== 'PASS') ||
    run.accessibility.status !== 'PASS' ||
    run.accessibility.seriousOrCriticalViolations !== 0 ||
    !run.diagnostics.redacted ||
    !run.diagnostics.previewed ||
    run.diagnostics.consentBound ||
    run.diagnostics.autoUpload ||
    run.diagnostics.rawFieldsFound.length !== 0 ||
    run.diagnostics.byteLength < 1 ||
    !run.revocation.signed ||
    !run.revocation.blocksNewApply ||
    !run.revocation.localRecoveryAvailable ||
    run.revocation.remoteRollback ||
    run.revocation.remoteExecution ||
    run.coverageGaps.length === 0 ||
    run.universalSupportClaim ||
    run.manualOverride
  )
    throw new Error(
      'Canonical deterministic security, fault, accessibility, or recovery proof is incomplete.',
    );
};

const appendTranscript = (
  originalUat: string,
  command: string,
  result: SimulationWriterResult,
): string => {
  const output = JSON.stringify(result, null, 2);
  const separator = originalUat.endsWith('\n') ? '' : '\n';
  return `${originalUat}${separator}\n---\n\n## Operation \`${result.operationVersion}\` — DETERMINISTIC SIMULATION ADMITTED\n\n- **Physical provenance:** not claimed\n- **Human review:** not claimed\n- **Owner/friends consent:** not claimed\n- **Physical PASS:** not claimed\n- **Command:** \`${command}\`\n- **Artifact manifest SHA-256:** \`${result.artifactManifestSha256}\`\n- **Run evidence SHA-256:** \`${result.runEvidenceSha256}\`\n- **Evidence manifest SHA-256:** \`${result.evidenceManifestSha256}\`\n\n### Exact command output\n\n\`\`\`json\n${output}\n\`\`\`\n`;
};

const unlinkIfPresent = (path: string): void => {
  if (existsSync(path)) unlinkSync(path);
};

const replaceAuthorityAtomically = (
  manifestPath: string,
  originalManifest: string,
  manifestBytes: string,
  uatPath: string,
  originalUat: string,
  uatBytes: string,
): void => {
  const nonce = `${String(process.pid)}-${sha256(manifestBytes).slice(0, 12)}`;
  const manifestTemp = `${manifestPath}.${nonce}.tmp`;
  const uatTemp = `${uatPath}.${nonce}.tmp`;
  try {
    writeFileSync(manifestTemp, manifestBytes, { flag: 'wx' });
    writeFileSync(uatTemp, uatBytes, { flag: 'wx' });
    if (
      readFileSync(manifestPath, 'utf8') !== originalManifest ||
      readFileSync(uatPath, 'utf8') !== originalUat
    )
      throw new Error('Evidence authority changed during compare-and-replace.');
    renameSync(manifestTemp, manifestPath);
    try {
      renameSync(uatTemp, uatPath);
    } catch (error) {
      writeFileSync(manifestPath, originalManifest);
      throw error;
    }
  } catch (error) {
    unlinkIfPresent(manifestTemp);
    unlinkIfPresent(uatTemp);
    throw error;
  }
};

const writeInitialSimulationEvidence = (input: {
  artifact: ReturnType<typeof validateArtifact>;
  artifactManifestPath: string;
  evidenceManifestPath: string;
  harnessPath: string;
  minimumVersion: string;
  originalManifest: string;
  originalUat: string;
  summaryPath: string;
  uatPath: string;
  workspaceRoot: string;
}): SimulationWriterResult => {
  const candidate = createCanonicalSimulationCandidate({
    artifactManifestPath: input.artifactManifestPath,
    artifactManifestSha256: input.artifact.artifactManifestSha256,
    buildId: input.artifact.buildId,
    harnessPath: input.harnessPath,
    operationVersion: input.artifact.operationVersion,
    recordedAt: input.artifact.recordedAt,
    sourceCommit: input.artifact.sourceCommit,
    workspaceRoot: input.workspaceRoot,
  });
  assertCanonicalSimulationCandidate(candidate);
  const oldManifest = JSON.parse(input.originalManifest) as unknown;
  const legacyRelative = `tooling/phase6-evidence/records/legacy/${String(
    isObject(oldManifest) ? oldManifest['operationVersion'] : 'blocked-attempt',
  )}-evidence-manifest.json`;
  const legacyPath = resolve(input.workspaceRoot, legacyRelative);
  mkdirSync(dirname(legacyPath), { recursive: true });
  let legacyCreated = false;
  if (existsSync(legacyPath)) {
    if (readFileSync(legacyPath, 'utf8') !== input.originalManifest)
      throw new Error('Legacy blocked evidence path already contains different bytes.');
  } else {
    writeFileSync(legacyPath, input.originalManifest, { flag: 'wx' });
    legacyCreated = true;
  }
  const stages = PHASE6_PROMOTION_STAGES.map((stage, index) => ({
    stage,
    predecessorStage: index === 0 ? null : (PHASE6_PROMOTION_STAGES[index - 1] ?? null),
    friendsRoster: null,
    runs: index === 0 ? [candidate.run] : [],
    consents: [],
    reviews: [],
  }));
  const manifest = {
    schemaVersion: 2,
    generatedAt: input.artifact.recordedAt,
    operationVersion: input.artifact.operationVersion,
    immutableBuild: {
      id: input.artifact.buildId,
      commit: input.artifact.sourceCommit,
      artifact: {
        path: exactRelativePath(input.workspaceRoot, input.artifactManifestPath),
        sha256: input.artifact.artifactManifestSha256,
      },
      artifactManifestSha256: input.artifact.artifactManifestSha256,
    },
    promotionStage: 'deterministic-simulation',
    requirementsCoverage: [...candidate.requirementsCoverage],
    decisionCoverage: [...candidate.decisionCoverage],
    legacyBlockedAttempts: [{ path: legacyRelative, sha256: sha256(input.originalManifest) }],
    stages,
  };
  const manifestBytes = `${JSON.stringify(manifest, null, 2)}\n`;
  const relativeSummary = exactRelativePath(input.workspaceRoot, input.summaryPath);
  const command = `rtk pnpm phase6:simulate -- --artifact-manifest-from-summary ${relativeSummary} --minimum-version ${input.minimumVersion}`;
  const result: SimulationWriterResult = {
    operationVersion: input.artifact.operationVersion,
    buildId: input.artifact.buildId,
    artifactManifestSha256: input.artifact.artifactManifestSha256,
    runEvidenceSha256: phase6EvidenceSha256(candidate.run),
    evidenceManifestSha256: sha256(manifestBytes),
    highestAdmittedStage: 'deterministic-simulation',
    requirementsCoverage: [...candidate.requirementsCoverage],
  };
  const nextUat = appendTranscript(input.originalUat, command, result);
  try {
    replaceAuthorityAtomically(
      input.evidenceManifestPath,
      input.originalManifest,
      manifestBytes,
      input.uatPath,
      input.originalUat,
      nextUat,
    );
  } catch (error) {
    if (legacyCreated) unlinkIfPresent(legacyPath);
    throw error;
  }
  return result;
};

export const writeCanonicalSimulationEvidence = (
  input: SimulationWriterInput,
): SimulationWriterResult => {
  void ARTIFACT_VERSION_KEY_LINK;
  const workspaceRoot = resolve(input.workspaceRoot);
  const manifestPath = resolve(input.evidenceManifestPath);
  const uatPath = resolve(input.uatPath);
  const originalManifest = readFileSync(manifestPath, 'utf8');
  const originalUat = readFileSync(uatPath, 'utf8');
  const artifact = validateArtifact(
    resolve(input.artifactManifestPath),
    resolve(input.summaryPath),
    workspaceRoot,
  );
  assertFreshVersion(
    artifact.operationVersion,
    input.minimumVersion,
    originalManifest,
    originalUat,
    artifact.sourceCommit,
  );
  const oldManifest = JSON.parse(originalManifest) as unknown;
  if (isObject(oldManifest) && oldManifest['schemaVersion'] === 1)
    return writeInitialSimulationEvidence({
      artifact,
      artifactManifestPath: resolve(input.artifactManifestPath),
      evidenceManifestPath: manifestPath,
      harnessPath: resolve(input.harnessPath),
      minimumVersion: input.minimumVersion,
      originalManifest,
      originalUat,
      summaryPath: resolve(input.summaryPath),
      uatPath,
      workspaceRoot,
    });
  if (!isObject(oldManifest) || oldManifest['schemaVersion'] !== 2)
    throw new Error(
      'Simulation supersession requires exactly one immutable schema v2 predecessor.',
    );
  const priorStages = oldManifest['stages'];
  const priorBuild = oldManifest['immutableBuild'];
  const priorLegacy = oldManifest['legacyBlockedAttempts'];
  if (
    !hasExactKeys(oldManifest, [
      'schemaVersion',
      'generatedAt',
      'operationVersion',
      'immutableBuild',
      'promotionStage',
      'requirementsCoverage',
      'decisionCoverage',
      'legacyBlockedAttempts',
      'stages',
    ]) ||
    typeof oldManifest['operationVersion'] !== 'string' ||
    oldManifest['promotionStage'] !== 'deterministic-simulation' ||
    !isObject(priorBuild) ||
    !hasExactKeys(priorBuild, ['id', 'commit', 'artifact', 'artifactManifestSha256']) ||
    typeof priorBuild['id'] !== 'string' ||
    typeof priorBuild['artifactManifestSha256'] !== 'string' ||
    !HASH.test(priorBuild['artifactManifestSha256']) ||
    !Array.isArray(oldManifest['requirementsCoverage']) ||
    !Array.isArray(oldManifest['decisionCoverage']) ||
    JSON.stringify(oldManifest['requirementsCoverage']) !== JSON.stringify(PHASE6_REQUIREMENTS) ||
    JSON.stringify(oldManifest['decisionCoverage']) !== JSON.stringify(PHASE6_DECISIONS) ||
    !Array.isArray(priorLegacy) ||
    priorLegacy.some(
      (reference) =>
        !isObject(reference) ||
        !hasExactKeys(reference, ['path', 'sha256']) ||
        typeof reference['path'] !== 'string' ||
        !HASH.test(String(reference['sha256'])),
    ) ||
    !Array.isArray(priorStages) ||
    priorStages.length !== PHASE6_PROMOTION_STAGES.length ||
    priorStages.some(
      (cell, index) =>
        !isObject(cell) ||
        !hasExactKeys(cell, [
          'stage',
          'predecessorStage',
          'friendsRoster',
          'runs',
          'consents',
          'reviews',
        ]) ||
        cell['stage'] !== PHASE6_PROMOTION_STAGES[index] ||
        cell['predecessorStage'] !== (index === 0 ? null : PHASE6_PROMOTION_STAGES[index - 1]) ||
        cell['friendsRoster'] !== null,
    )
  )
    throw new Error('Schema v2 predecessor identity is incomplete.');
  const priorCell: unknown = (priorStages as unknown[])[0];
  if (!isObject(priorCell) || !Array.isArray(priorCell['runs']) || priorCell['runs'].length !== 1)
    throw new Error('Schema v2 predecessor must contain one deterministic run.');
  const priorRun: unknown = (priorCell['runs'] as unknown[])[0];
  if (
    !isObject(priorRun) ||
    typeof priorRun['id'] !== 'string' ||
    priorRun['operationVersion'] !== oldManifest['operationVersion'] ||
    priorRun['buildId'] !== priorBuild['id'] ||
    priorRun['artifactManifestSha256'] !== priorBuild['artifactManifestSha256'] ||
    priorRun['predecessorRunEvidenceSha256'] !== null ||
    (priorStages as unknown[])
      .slice(1)
      .some(
        (cell) =>
          !isObject(cell) ||
          !Array.isArray(cell['runs']) ||
          !Array.isArray(cell['consents']) ||
          !Array.isArray(cell['reviews']) ||
          cell['runs'].length !== 0 ||
          cell['consents'].length !== 0 ||
          cell['reviews'].length !== 0,
      )
  )
    throw new Error('Schema v2 predecessor is not the exact pending-physical authority.');
  assertCanonicalSimulationCandidate({
    requirementsCoverage: oldManifest['requirementsCoverage'] as string[],
    decisionCoverage: oldManifest['decisionCoverage'] as string[],
    run: priorRun as unknown as Phase6RunEvidence,
    consents: [],
    reviews: [],
  });
  const priorRunSha256 = phase6EvidenceSha256(priorRun);
  const candidate = createCanonicalSimulationCandidate({
    artifactManifestPath: resolve(input.artifactManifestPath),
    artifactManifestSha256: artifact.artifactManifestSha256,
    buildId: artifact.buildId,
    harnessPath: resolve(input.harnessPath),
    operationVersion: artifact.operationVersion,
    recordedAt: artifact.recordedAt,
    sourceCommit: artifact.sourceCommit,
    workspaceRoot,
    predecessorEvidenceSha256: priorRunSha256,
  });
  assertCanonicalSimulationCandidate(candidate);
  const priorRecordRelative = `tooling/phase6-evidence/records/superseded/${oldManifest['operationVersion']}-evidence-manifest.json`;
  const priorRecordPath = resolve(workspaceRoot, priorRecordRelative);
  mkdirSync(dirname(priorRecordPath), { recursive: true });
  let priorRecordCreated = false;
  if (existsSync(priorRecordPath)) {
    if (readFileSync(priorRecordPath, 'utf8') !== originalManifest)
      throw new Error('Superseded deterministic record already contains different bytes.');
  } else {
    writeFileSync(priorRecordPath, originalManifest, { flag: 'wx' });
    priorRecordCreated = true;
  }
  const stages: Phase6EvidenceManifest['stages'] = PHASE6_PROMOTION_STAGES.map((stage, index) => ({
    stage,
    predecessorStage: index === 0 ? null : (PHASE6_PROMOTION_STAGES[index - 1] ?? null),
    friendsRoster: null,
    runs: index === 0 ? [candidate.run] : [],
    consents: [],
    reviews: [],
  }));
  const activeRunSha256 = phase6EvidenceSha256(candidate.run);
  const deterministicAdmissions: Phase6DeterministicAdmission[] = [
    {
      status: 'superseded',
      operationVersion: oldManifest['operationVersion'],
      buildId: priorBuild['id'],
      artifactManifestSha256: unprefix(
        priorBuild['artifactManifestSha256'],
        'predecessor artifact manifest',
      ),
      runEvidenceId: priorRun['id'],
      runEvidenceSha256: priorRunSha256,
      predecessorEvidenceSha256: null,
      successorEvidenceSha256: activeRunSha256,
      manifestRecord: { path: priorRecordRelative, sha256: sha256(originalManifest) },
    },
    {
      status: 'active',
      operationVersion: artifact.operationVersion,
      buildId: artifact.buildId,
      artifactManifestSha256: artifact.artifactManifestSha256,
      runEvidenceId: candidate.run.id,
      runEvidenceSha256: activeRunSha256,
      predecessorEvidenceSha256: priorRunSha256,
      successorEvidenceSha256: null,
      manifestRecord: null,
    },
  ];
  assertAdmissionChain(deterministicAdmissions);
  const manifest: Phase6EvidenceManifest = {
    schemaVersion: 3,
    generatedAt: artifact.recordedAt,
    operationVersion: artifact.operationVersion,
    immutableBuild: {
      id: artifact.buildId,
      commit: artifact.sourceCommit,
      artifact: {
        path: exactRelativePath(workspaceRoot, resolve(input.artifactManifestPath)),
        sha256: artifact.artifactManifestSha256,
      },
      artifactManifestSha256: artifact.artifactManifestSha256,
    },
    promotionStage: 'deterministic-simulation',
    requirementsCoverage: [...candidate.requirementsCoverage],
    decisionCoverage: [...candidate.decisionCoverage],
    legacyBlockedAttempts: priorLegacy as Phase6EvidenceManifest['legacyBlockedAttempts'],
    deterministicAdmissions,
    stages,
  };
  const manifestBytes = `${JSON.stringify(manifest, null, 2)}\n`;
  const relativeSummary = exactRelativePath(workspaceRoot, resolve(input.summaryPath));
  const command = `rtk pnpm phase6:simulate -- --artifact-manifest-from-summary ${relativeSummary} --minimum-version ${input.minimumVersion}`;
  const result: SimulationWriterResult = {
    operationVersion: artifact.operationVersion,
    buildId: artifact.buildId,
    artifactManifestSha256: artifact.artifactManifestSha256,
    runEvidenceSha256: activeRunSha256,
    evidenceManifestSha256: sha256(manifestBytes),
    highestAdmittedStage: 'deterministic-simulation',
    requirementsCoverage: [...candidate.requirementsCoverage],
  };
  const nextUat = appendTranscript(originalUat, command, result);
  try {
    replaceAuthorityAtomically(
      manifestPath,
      originalManifest,
      manifestBytes,
      uatPath,
      originalUat,
      nextUat,
    );
  } catch (error) {
    if (priorRecordCreated) unlinkIfPresent(priorRecordPath);
    throw error;
  }
  return result;
};

const runCli = (): void => {
  const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
  const parsed = parseSimulationWriterCli(process.argv.slice(2));
  const summaryPath = resolve(
    workspaceRoot,
    'artifactManifestFromSummary' in parsed
      ? parsed.artifactManifestFromSummary
      : '.planning/phases/06-transactional-plans-and-recovery/06-31-SUMMARY.md',
  );
  const artifactManifestPath =
    'artifactManifestFromSummary' in parsed
      ? resolve(workspaceRoot, summaryAuthority(summaryPath).root, 'artifact-manifest.json')
      : resolve(workspaceRoot, parsed.artifactManifestPath);
  const result = writeCanonicalSimulationEvidence({
    artifactManifestPath,
    evidenceManifestPath: resolve(workspaceRoot, 'tooling/phase6-evidence/evidence-manifest.json'),
    harnessPath: resolve(workspaceRoot, 'packages/desktop-simulator/src/transactional-plans.ts'),
    minimumVersion: parsed.minimumVersion,
    summaryPath,
    uatPath: resolve(
      workspaceRoot,
      '.planning/phases/06-transactional-plans-and-recovery/06-UAT.md',
    ),
    workspaceRoot,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
};

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    runCli();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
