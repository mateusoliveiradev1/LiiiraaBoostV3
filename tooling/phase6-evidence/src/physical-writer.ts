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
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PHASE6_PROMOTION_STAGES,
  canonicalPhase6Evidence,
  phase6EvidenceSha256,
  type Phase6Consent,
  type Phase6EvidenceManifest,
  type Phase6FriendsRoster,
  type Phase6HumanReview,
  type Phase6PhysicalStage,
  type Phase6RunEvidence,
} from './evaluate.js';

const evidenceManifestPath = (): string => {
  const packageLocal = resolve('evidence-manifest.json');
  return existsSync(packageLocal)
    ? packageLocal
    : resolve('tooling/phase6-evidence/evidence-manifest.json');
};
const MAX_REDACTED_BYTES = 65_536;
const TRUSTED_INSTALLER_SPKI_SHA256 =
  'sha256:1951cb0610550369bdffafffaec6ed48bb7c5e7ddbf9b99733cfbd288e86fdf2';
const HASH = /^(?:sha256:)?([a-f0-9]{64})$/u;
const SECRET =
  /(?:authorization\s*:|bearer\s+|password\s*[=:]|secret\s*[=:]|token\s*[=:]|S-1-5-\d|serial(?:number)?\s*[=:])/iu;
const CONTINUATION = [
  'installed-ready',
  'checkpoint-ready',
  'running',
  'reboot-pending',
  'resumed-observation',
  'restored-complete',
] as const;
const PHYSICAL_STAGES = PHASE6_PROMOTION_STAGES.slice(1) as readonly Phase6PhysicalStage[];
const ARTIFACT_VERIFIER_KEY_LINK = 'phase6-artifact-verifier --artifact-manifest';

type JsonObject = Record<string, unknown>;

interface VerifiedArtifactAuthority {
  root: string;
  artifactManifestSha256: string;
  operationVersionId: string;
  buildId: string;
  sourceCommit: string;
  artifact: JsonObject;
}

interface StageAuthority extends VerifiedArtifactAuthority {
  config: JsonObject;
  configPath: string;
  configSha256: string;
  runnerPath: string;
  runnerSha256: string;
  msiPath: string;
  msiSha256: string;
}

export type PhysicalWriterCli =
  | {
      command: 'ingest';
      artifactManifestPath: string;
      runEnvelopePath: string;
      stage: Phase6PhysicalStage;
    }
  | { command: 'freeze-roster'; artifactManifestPath: string; rosterCandidatePath: string }
  | { command: 'review'; stage: Phase6PhysicalStage; reviewPath: string };

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const sha256 = (value: string | Uint8Array): string =>
  createHash('sha256').update(value).digest('hex');

const unprefix = (value: unknown, label: string): string => {
  if (typeof value !== 'string') throw new Error(`${label} hash is missing.`);
  const match = HASH.exec(value);
  if (match === null) throw new Error(`${label} hash is invalid.`);
  return match[1]!;
};

const prefixed = (value: unknown, label: string): string => `sha256:${unprefix(value, label)}`;

const readJson = (path: string, label: string): JsonObject => {
  const value: unknown = JSON.parse(readFileSync(path, 'utf8'));
  if (!isObject(value)) throw new Error(`${label} must be a JSON object.`);
  return value;
};

const assertExactKeys = (value: JsonObject, expected: readonly string[], label: string): void => {
  const keys = Object.keys(value);
  if (keys.length !== expected.length || keys.some((key) => !expected.includes(key)))
    throw new Error(`${label} has an invalid closed shape.`);
};

const assertPhysicalStage: (value: unknown) => asserts value is Phase6PhysicalStage = (value) => {
  if (typeof value !== 'string' || !PHYSICAL_STAGES.includes(value as Phase6PhysicalStage))
    throw new Error('Physical writer CLI requires a canonical physical stage.');
};

const requireAbsolute = (path: string, label: string): string => {
  if (!isAbsolute(path)) throw new Error(`Physical writer CLI requires absolute ${label}.`);
  return resolve(path);
};

export const parsePhysicalWriterCli = (
  command: string,
  args: readonly string[],
): PhysicalWriterCli => {
  if (
    command === 'ingest' &&
    args.length === 6 &&
    args[0] === '--artifact-manifest' &&
    args[2] === '--run-envelope' &&
    args[4] === '--stage'
  ) {
    assertPhysicalStage(args[5]);
    return {
      command,
      artifactManifestPath: requireAbsolute(args[1]!, 'artifact manifest path'),
      runEnvelopePath: requireAbsolute(args[3]!, 'run envelope path'),
      stage: args[5],
    };
  }
  if (
    command === 'freeze-roster' &&
    args.length === 4 &&
    args[0] === '--artifact-manifest' &&
    args[2] === '--roster'
  )
    return {
      command,
      artifactManifestPath: requireAbsolute(args[1]!, 'artifact manifest path'),
      rosterCandidatePath: requireAbsolute(args[3]!, 'roster candidate path'),
    };
  if (
    command === 'review' &&
    args.length === 4 &&
    args[0] === '--stage' &&
    args[2] === '--review'
  ) {
    assertPhysicalStage(args[1]);
    return { command, stage: args[1], reviewPath: requireAbsolute(args[3]!, 'review path') };
  }
  throw new Error('Physical writer CLI invocation is not in the closed grammar.');
};

const verifier = (
  artifactManifestPath: string,
): { manifestSha256: string; operationVersionId: string } => {
  void ARTIFACT_VERIFIER_KEY_LINK;
  // Key-link: phase6-artifact-verifier --artifact-manifest is the only artifact authority.
  const result = spawnSync(
    'cargo',
    [
      'run',
      '--quiet',
      '-p',
      'liiiraa-optimizer-service',
      '--bin',
      'phase6-artifact-verifier',
      '--',
      '--artifact-manifest',
      artifactManifestPath,
    ],
    { encoding: 'utf8' },
  );
  if (result.status !== 0)
    throw new Error(`Fixed artifact verifier rejected the artifact: ${String(result.stderr)}`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(result.stdout).trim());
  } catch {
    throw new Error('Fixed artifact verifier returned malformed evidence.');
  }
  if (!isObject(parsed) || parsed['verdict'] !== 'verified')
    throw new Error('Fixed artifact verifier did not return a verified verdict.');
  return {
    manifestSha256: prefixed(parsed['manifestSha256'], 'verified artifact manifest'),
    operationVersionId: String(parsed['operationVersionId'] ?? ''),
  };
};

const role = (artifact: JsonObject, name: string): JsonObject => {
  const files = artifact['files'];
  if (!isObject(files) || !isObject(files[name]))
    throw new Error(`Authenticated artifact role ${name} is missing.`);
  return files[name];
};

const resolveUnderRoot = (root: string, relative: unknown, label: string): string => {
  if (
    typeof relative !== 'string' ||
    relative.length === 0 ||
    relative.includes('..') ||
    isAbsolute(relative)
  )
    throw new Error(`${label} path is invalid.`);
  const resolved = resolve(root, relative);
  if (resolved !== root && !resolved.startsWith(`${root}\\`) && !resolved.startsWith(`${root}/`))
    throw new Error(`${label} escapes artifact custody.`);
  return resolved;
};

const verifyLiveRole = (
  root: string,
  entry: JsonObject,
  label: string,
): { path: string; sha256: string } => {
  const path = resolveUnderRoot(root, entry['relativePath'], label);
  const expected = unprefix(entry['sha256'], label);
  if (sha256(readFileSync(path)) !== expected)
    throw new Error(`${label} live bytes do not match authenticated manifest.`);
  return { path, sha256: expected };
};

const verifyArtifactAuthority = (artifactManifestPath: string): VerifiedArtifactAuthority => {
  const verified = verifier(artifactManifestPath);
  const artifact = readJson(artifactManifestPath, 'artifact manifest');
  const root = dirname(artifactManifestPath);
  if (artifact['kind'] !== 'artifact-manifest' || artifact['schemaVersion'] !== '1.0')
    throw new Error('Authenticated artifact manifest has the wrong generated kind/version.');
  if (artifact['operationVersionId'] !== verified.operationVersionId)
    throw new Error('Artifact verifier operation identity mismatch.');
  const requiredRoles = [
    'msi',
    'installationManifest',
    'installationManifestSignature',
    'cleanWindowsVmConfig',
    'ownerPcConfig',
    'friendsPcConfig',
    'runner',
    'tauriDriver',
    'msedgeDriver',
  ];
  const files = artifact['files'];
  if (
    !isObject(files) ||
    Object.keys(files).length !== requiredRoles.length ||
    requiredRoles.some((name) => !isObject(files[name]))
  )
    throw new Error('Authenticated artifact manifest does not contain the exact role set.');
  return {
    root,
    artifactManifestSha256: verified.manifestSha256,
    operationVersionId: verified.operationVersionId,
    buildId: String(artifact['buildId'] ?? ''),
    sourceCommit: String(artifact['sourceCommit'] ?? ''),
    artifact,
  };
};

const configRoleName = (stage: Phase6PhysicalStage): string =>
  stage === 'clean-windows-vm'
    ? 'cleanWindowsVmConfig'
    : stage === 'owner-pc'
      ? 'ownerPcConfig'
      : 'friendsPcConfig';

const stageAuthority = (
  artifactManifestPath: string,
  stage: Phase6PhysicalStage,
): StageAuthority => {
  const authority = verifyArtifactAuthority(artifactManifestPath);
  const configEntry = role(authority.artifact, configRoleName(stage));
  const configRole = verifyLiveRole(authority.root, configEntry, `${stage} config`);
  const config = readJson(configRole.path, `${stage} config`);
  if (
    config['kind'] !== 'physical-run-config' ||
    config['schemaVersion'] !== '1.0' ||
    config['stage'] !== stage ||
    config['configPath'] !== configEntry['relativePath'] ||
    config['operationVersionId'] !== authority.operationVersionId ||
    config['buildId'] !== authority.buildId ||
    config['sourceCommit'] !== authority.sourceCommit
  )
    throw new Error('Signed physical config binding is invalid.');
  const runner = verifyLiveRole(authority.root, role(authority.artifact, 'runner'), 'runner');
  const msi = verifyLiveRole(authority.root, role(authority.artifact, 'msi'), 'msi');
  return {
    ...authority,
    config,
    configPath: configRole.path,
    configSha256: configRole.sha256,
    runnerPath: runner.path,
    runnerSha256: runner.sha256,
    msiPath: msi.path,
    msiSha256: msi.sha256,
  };
};

const loadEvidence = (): { bytes: string; manifest: Phase6EvidenceManifest } => {
  const bytes = readFileSync(evidenceManifestPath(), 'utf8');
  const value: unknown = JSON.parse(bytes);
  if (!isObject(value) || value['schemaVersion'] !== 2)
    throw new Error('Current Phase 6 evidence manifest must be schema v2.');
  return { bytes, manifest: value as unknown as Phase6EvidenceManifest };
};

const writeExclusiveJson = (path: string, value: unknown): void => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
};

const unlinkIfPresent = (path: string): void => {
  if (existsSync(path)) unlinkSync(path);
};

const atomicAppend = (
  originalBytes: string,
  manifest: Phase6EvidenceManifest,
  createdPaths: readonly string[],
): void => {
  const manifestPath = evidenceManifestPath();
  const temporary = `${manifestPath}.${process.pid}.tmp`;
  try {
    if (readFileSync(manifestPath, 'utf8') !== originalBytes)
      throw new Error('Evidence manifest changed during compare-and-append.');
    writeFileSync(temporary, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
    if (readFileSync(manifestPath, 'utf8') !== originalBytes)
      throw new Error('Evidence manifest changed before atomic replacement.');
    renameSync(temporary, manifestPath);
  } catch (error) {
    unlinkIfPresent(temporary);
    for (const path of createdPaths) unlinkIfPresent(path);
    throw error;
  }
};

const validateRun = (
  run: unknown,
  stage: Phase6PhysicalStage,
  authority: StageAuthority,
  manifest: Phase6EvidenceManifest,
): Phase6RunEvidence => {
  if (!isObject(run)) throw new Error('Physical runner envelope is invalid.');
  if (run['source'] !== 'phase6-physical-runner-rust-1' || run['evidenceKind'] !== 'physical')
    throw new Error('Only Rust physical runner provenance is admissible.');
  if (run['stage'] !== stage || run['status'] !== 'PASS')
    throw new Error('Physical runner stage/status mismatch.');
  if (
    run['operationVersion'] !== authority.operationVersionId ||
    run['buildId'] !== authority.buildId
  )
    throw new Error('Physical runner build/operation mismatch.');
  if (
    unprefix(run['artifactManifestSha256'], 'run artifact') !==
      unprefix(authority.artifactManifestSha256, 'artifact authority') ||
    unprefix(run['configSha256'], 'run config') !== authority.configSha256
  )
    throw new Error('Physical runner artifact/config hash mismatch.');
  const artifacts = run['artifacts'];
  if (!Array.isArray(artifacts)) throw new Error('Physical runner artifacts are missing.');
  const has = (path: string, digest: string): boolean =>
    artifacts.some(
      (entry) =>
        isObject(entry) &&
        entry['path'] === path.slice(authority.root.length + 1).replaceAll('\\', '/') &&
        unprefix(entry['sha256'], 'run artifact') === digest,
    );
  if (
    !has(authority.runnerPath, authority.runnerSha256) ||
    !has(authority.msiPath, authority.msiSha256) ||
    !has(authority.configPath, authority.configSha256)
  )
    throw new Error('Physical runner does not bind authenticated MSI, runner, and config bytes.');
  if (JSON.stringify(run['continuation']) !== JSON.stringify(CONTINUATION))
    throw new Error('Physical continuation chain mismatch.');
  const cycle = run['cycle'];
  if (
    !isObject(cycle) ||
    cycle['prepare'] !== 'PASS' ||
    cycle['apply'] !== 'PASS' ||
    cycle['verifyApply'] !== 'PASS' ||
    cycle['restore'] !== 'PASS' ||
    cycle['verifyRestore'] !== 'PASS' ||
    cycle['restart'] !== (cycle['restartRequired'] === true ? 'PASS' : 'NOT_REQUIRED')
  )
    throw new Error('Physical lifecycle is incomplete.');
  const diagnostics = run['diagnostics'];
  if (
    !isObject(diagnostics) ||
    diagnostics['redacted'] !== true ||
    diagnostics['previewed'] !== true ||
    diagnostics['consentBound'] !== true ||
    diagnostics['autoUpload'] !== false ||
    !Array.isArray(diagnostics['rawFieldsFound']) ||
    diagnostics['rawFieldsFound'].length !== 0 ||
    typeof diagnostics['byteLength'] !== 'number' ||
    diagnostics['byteLength'] < 1 ||
    diagnostics['byteLength'] > MAX_REDACTED_BYTES
  )
    throw new Error('Physical diagnostics are not bounded/redacted/previewed.');
  const stageIndex = PHASE6_PROMOTION_STAGES.indexOf(stage);
  const predecessor = manifest.stages[stageIndex - 1]?.runs.at(-1);
  if (
    predecessor === undefined ||
    run['predecessorRunEvidenceSha256'] !== phase6EvidenceSha256(predecessor)
  )
    throw new Error('Physical runner predecessor mismatch.');
  return run as unknown as Phase6RunEvidence;
};

const validateFriendsRunCustody = (run: Phase6RunEvidence, authority: StageAuthority): void => {
  if (run.stage !== 'friends-pc') {
    if (run.friendsRosterSha256 !== null)
      throw new Error('Friends roster authority is forbidden outside friends stage.');
    return;
  }
  const rosterPath = resolveUnderRoot(
    authority.root,
    authority.config['friendsRosterPath'],
    'friends roster',
  );
  const signaturePath = resolveUnderRoot(
    authority.root,
    authority.config['friendsRosterSignaturePath'],
    'friends roster signature',
  );
  if (
    signaturePath !== `${rosterPath}.p7s` ||
    !existsSync(rosterPath) ||
    !existsSync(signaturePath)
  )
    throw new Error('Friends roster signed pair is missing from fixed config custody.');
  verifyRosterCms(rosterPath, signaturePath);
  const roster = readJson(rosterPath, 'friends roster');
  validateRosterCandidate(roster, authority);
  const rosterBytes = readFileSync(rosterPath, 'utf8');
  if (rosterBytes !== `${canonicalPhase6Evidence(roster)}\n`)
    throw new Error('Friends roster bytes are not canonical immutable bytes.');
  if (unprefix(run.friendsRosterSha256, 'run friends roster') !== sha256(rosterBytes))
    throw new Error('Physical runner friends roster hash mismatch.');
  const participants = roster['participants'];
  if (
    !Array.isArray(participants) ||
    !participants.some(
      (participant) =>
        isObject(participant) &&
        participant['participantId'] === run.participantId &&
        participant['machineSlot'] === run.machineSlot,
    )
  )
    throw new Error('Physical runner participant/slot is not in the signed friends roster.');
};

const validateConsent = (
  value: unknown,
  run: Phase6RunEvidence,
  redactedOutput: string,
): Phase6Consent | null => {
  if (run.stage !== 'friends-pc') {
    if (value !== null) throw new Error('Consent is forbidden outside friends stage.');
    return null;
  }
  if (!isObject(value)) throw new Error('Friends run requires local consent.');
  if (
    value['participantId'] !== run.participantId ||
    value['machineSlot'] !== run.machineSlot ||
    value['runEvidenceId'] !== run.id ||
    value['runEvidenceSha256'] !== phase6EvidenceSha256(run) ||
    value['artifactManifestSha256'] !== run.artifactManifestSha256 ||
    value['configSha256'] !== run.configSha256 ||
    value['friendsRosterSha256'] !== run.friendsRosterSha256
  )
    throw new Error('Friends consent binding mismatch.');
  if (
    typeof value['recordedAt'] !== 'string' ||
    typeof run.exportedAt !== 'string' ||
    Date.parse(value['recordedAt']) >= Date.parse(run.exportedAt)
  )
    throw new Error('Friends consent must strictly precede export.');
  const redactedSha256 = sha256(redactedOutput);
  if (
    unprefix(value['previewSha256'], 'consent preview') !== redactedSha256 ||
    unprefix(value['redactedBytesSha256'], 'consent redacted bytes') !== redactedSha256
  )
    throw new Error('Friends consent does not bind the locally previewed redacted bytes.');
  return value as unknown as Phase6Consent;
};

const writePhysicalObservationAttempt = (
  envelope: JsonObject,
  stage: Phase6PhysicalStage,
  authority: StageAuthority,
  manifest: Phase6EvidenceManifest,
): { run: Phase6RunEvidence; runRecordPath: string; consentRecordPath: null } => {
  assertExactKeys(
    envelope,
    ['observation', 'consent', 'redactedOutput'],
    'physical observation envelope',
  );
  const observation = envelope['observation'];
  const redactedOutput = envelope['redactedOutput'];
  if (!isObject(observation) || typeof redactedOutput !== 'string')
    throw new Error('Physical observation envelope is invalid.');
  assertExactKeys(
    observation,
    [
      'id',
      'source',
      'stage',
      'participantId',
      'machineSlot',
      'artifactManifestSha256',
      'configSha256',
      'friendsRosterSha256',
      'continuation',
      'lifecycle',
      'journalObservationSha256',
      'receiptObservationSha256',
      'diagnostics',
      'coverageGaps',
      'recordedAt',
    ],
    'physical runner observation',
  );
  if (
    observation['source'] !== 'phase6-physical-runner-rust-1' ||
    observation['stage'] !== stage ||
    observation['artifactManifestSha256'] !== authority.artifactManifestSha256 ||
    unprefix(observation['configSha256'], 'observation config') !== authority.configSha256 ||
    JSON.stringify(observation['continuation']) !== JSON.stringify(CONTINUATION)
  )
    throw new Error('Physical observation custody or continuation mismatch.');
  const lifecycle = observation['lifecycle'];
  if (
    !isObject(lifecycle) ||
    lifecycle['prepareObserved'] !== true ||
    lifecycle['applyObserved'] !== true ||
    lifecycle['rebootBoundaryObserved'] !== true ||
    lifecycle['resumeObservedBeforeMutation'] !== true ||
    lifecycle['restoreObserved'] !== true
  )
    throw new Error('Physical observation lifecycle is incomplete.');
  const diagnostics = observation['diagnostics'];
  if (
    !isObject(diagnostics) ||
    diagnostics['redacted'] !== true ||
    diagnostics['autoUpload'] !== false ||
    !Array.isArray(diagnostics['rawFieldsFound']) ||
    diagnostics['rawFieldsFound'].length !== 0 ||
    diagnostics['byteLength'] !== Buffer.byteLength(redactedOutput, 'utf8') ||
    Buffer.byteLength(redactedOutput, 'utf8') > MAX_REDACTED_BYTES ||
    SECRET.test(redactedOutput)
  )
    throw new Error('Physical observation diagnostics are unsafe or inconsistent.');
  const gaps = observation['coverageGaps'];
  if (!Array.isArray(gaps) || gaps.length === 0 || !gaps.every((gap) => typeof gap === 'string'))
    throw new Error('Physical observation must disclose every unmeasured gate.');
  const predecessor = manifest.stages[PHASE6_PROMOTION_STAGES.indexOf(stage) - 1]?.runs.at(-1);
  if (predecessor === undefined)
    throw new Error('Physical observation predecessor is unavailable.');
  const relative = (path: string): string =>
    path.slice(authority.root.length + 1).replaceAll('\\', '/');
  const run: Phase6RunEvidence = {
    id: String(observation['id']),
    source: 'phase6-physical-runner-rust-1',
    stage,
    evidenceKind: 'physical',
    status: 'FAIL',
    operationVersion: authority.operationVersionId,
    buildId: authority.buildId,
    participantId: String(observation['participantId']),
    machineSlot: typeof observation['machineSlot'] === 'string' ? observation['machineSlot'] : null,
    artifactManifestSha256: unprefix(authority.artifactManifestSha256, 'artifact authority'),
    configSha256: authority.configSha256,
    friendsRosterSha256:
      typeof observation['friendsRosterSha256'] === 'string'
        ? unprefix(observation['friendsRosterSha256'], 'observation friends roster')
        : null,
    predecessorRunEvidenceSha256: phase6EvidenceSha256(predecessor),
    recordedAt: String(observation['recordedAt']),
    exportedAt: null,
    expiresAt: String(observation['recordedAt']),
    artifacts: [
      { path: relative(authority.msiPath), sha256: authority.msiSha256 },
      { path: relative(authority.runnerPath), sha256: authority.runnerSha256 },
      { path: relative(authority.configPath), sha256: authority.configSha256 },
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
    journalSha256: unprefix(observation['journalObservationSha256'], 'journal observation'),
    receiptSha256: unprefix(observation['receiptObservationSha256'], 'receipt observation'),
    security: {
      ipcAdversarial: 'FAIL',
      replayRejected: false,
      identitySpoofRejected: false,
      sessionSwapRejected: false,
    },
    faults: { diskFull: 'FAIL', crash: 'FAIL', reboot: 'PASS', drift: 'FAIL' },
    accessibility: { status: 'FAIL', seriousOrCriticalViolations: 0 },
    diagnostics: {
      redacted: true,
      previewed: diagnostics['previewed'] === true,
      consentBound: diagnostics['consentBound'] === true,
      autoUpload: false,
      rawFieldsFound: [],
      byteLength: Buffer.byteLength(redactedOutput, 'utf8'),
    },
    revocation: {
      signed: true,
      blocksNewApply: false,
      localRecoveryAvailable: true,
      remoteRollback: false,
      remoteExecution: false,
    },
    coverageGaps: gaps as string[],
    universalSupportClaim: false,
    manualOverride: false,
  };
  if (stage === 'friends-pc') {
    if (!isObject(envelope['consent']))
      throw new Error('Friends observation requires local consent.');
  } else if (envelope['consent'] !== null) {
    throw new Error('Consent is forbidden outside friends observations.');
  }
  const runRecordPath = join(
    'tooling/phase6-evidence/records',
    stage,
    'attempts',
    `${run.id}.json`,
  );
  if (existsSync(runRecordPath))
    throw new Error('Create-only physical observation already exists.');
  writeExclusiveJson(runRecordPath, run);
  return { run, runRecordPath, consentRecordPath: null };
};

export const writePhysicalRunEvidence = (input: {
  artifactManifestPath: string;
  runEnvelopePath: string;
  stage: Phase6PhysicalStage;
}): { run: Phase6RunEvidence; runRecordPath: string; consentRecordPath: string | null } => {
  assertPhysicalStage(input.stage);
  const authority = stageAuthority(
    requireAbsolute(input.artifactManifestPath, 'artifact manifest path'),
    input.stage,
  );
  const expectedEnvelope = isObject(authority.config['paths'])
    ? authority.config['paths']['rawEnvelopePath']
    : null;
  if (
    resolve(input.runEnvelopePath) !==
    resolveUnderRoot(authority.root, expectedEnvelope, 'raw envelope')
  )
    throw new Error('Run envelope path is not the signed config path.');
  const envelope = readJson(input.runEnvelopePath, 'physical run envelope');
  if ('observation' in envelope) {
    const loaded = loadEvidence();
    return writePhysicalObservationAttempt(envelope, input.stage, authority, loaded.manifest);
  }
  assertExactKeys(envelope, ['run', 'consent', 'redactedOutput'], 'physical run envelope');
  if (
    typeof envelope['redactedOutput'] !== 'string' ||
    Buffer.byteLength(envelope['redactedOutput'], 'utf8') > MAX_REDACTED_BYTES ||
    SECRET.test(envelope['redactedOutput'])
  )
    throw new Error('Physical output is oversized or contains raw secret/SID/serial data.');
  const loaded = loadEvidence();
  if (
    loaded.manifest.operationVersion !== authority.operationVersionId ||
    loaded.manifest.immutableBuild.id !== authority.buildId ||
    loaded.manifest.immutableBuild.artifactManifestSha256 !==
      unprefix(authority.artifactManifestSha256, 'artifact authority')
  )
    throw new Error('Evidence manifest immutable build authority mismatch.');
  const run = validateRun(envelope['run'], input.stage, authority, loaded.manifest);
  validateFriendsRunCustody(run, authority);
  if (run.diagnostics.byteLength !== Buffer.byteLength(envelope['redactedOutput'], 'utf8'))
    throw new Error('Physical diagnostics byte length does not match redacted output bytes.');
  const consent = validateConsent(envelope['consent'], run, envelope['redactedOutput']);
  const cell = loaded.manifest.stages[PHASE6_PROMOTION_STAGES.indexOf(input.stage)]!;
  if (
    cell.runs.some(({ id }) => id === run.id) ||
    cell.consents.some(({ id }) => id === consent?.id)
  )
    throw new Error('duplicate run or consent ID is forbidden.');
  const recordRoot = resolve('tooling/phase6-evidence/records', input.stage);
  const runRecordPath = join(recordRoot, 'runs', `${run.id}.json`);
  const consentRecordPath =
    consent === null ? null : join(recordRoot, 'consents', `${consent.id}.json`);
  if (existsSync(runRecordPath) || (consentRecordPath !== null && existsSync(consentRecordPath)))
    throw new Error('Create-only run or consent already exists.');
  const created: string[] = [];
  try {
    writeExclusiveJson(runRecordPath, run);
    created.push(runRecordPath);
    if (consentRecordPath !== null) {
      writeExclusiveJson(consentRecordPath, consent);
      created.push(consentRecordPath);
    }
    cell.runs.push(run);
    if (consent !== null) cell.consents.push(consent);
    atomicAppend(loaded.bytes, loaded.manifest, created);
  } catch (error) {
    for (const path of created) unlinkIfPresent(path);
    throw error;
  }
  return { run, runRecordPath, consentRecordPath };
};

const validateRosterCandidate = (candidate: JsonObject, authority: StageAuthority): void => {
  assertExactKeys(
    candidate,
    [
      'kind',
      'schemaVersion',
      'rosterId',
      'artifactManifestSha256',
      'friendsConfigSha256',
      'operationVersionId',
      'buildId',
      'sourceCommit',
      'purpose',
      'createdAt',
      'participants',
    ],
    'friends roster',
  );
  if (
    candidate['kind'] !== 'friends-roster' ||
    candidate['schemaVersion'] !== '1.0' ||
    candidate['purpose'] !== 'phase6-friends-physical-validation' ||
    candidate['operationVersionId'] !== authority.operationVersionId ||
    candidate['buildId'] !== authority.buildId ||
    candidate['sourceCommit'] !== authority.sourceCommit ||
    prefixed(candidate['artifactManifestSha256'], 'roster artifact') !==
      authority.artifactManifestSha256 ||
    unprefix(candidate['friendsConfigSha256'], 'roster config') !== authority.configSha256
  )
    throw new Error('Friends roster generated binding is invalid.');
  const participants = candidate['participants'];
  if (!Array.isArray(participants) || participants.length < 2 || participants.length > 32)
    throw new Error('Friends roster participant cardinality is invalid.');
  const ids = new Set<string>();
  const slots = new Set<string>();
  for (const [index, participant] of participants.entries()) {
    if (!isObject(participant)) throw new Error('Friends roster participant is invalid.');
    assertExactKeys(participant, ['participantId', 'machineSlot'], 'friends roster participant');
    const id = prefixed(participant['participantId'], 'participant');
    const expectedSlot = `friends-slot-${String(index + 1).padStart(2, '0')}`;
    if (participant['machineSlot'] !== expectedSlot || ids.has(id) || slots.has(expectedSlot))
      throw new Error('Friends roster contains duplicate or reordered participants/slots.');
    ids.add(id);
    slots.add(expectedSlot);
  }
};

const signRoster = (rosterPath: string, signaturePath: string): void => {
  const script = `
param([string]$RosterPath,[string]$SignaturePath)
$pin='${TRUSTED_INSTALLER_SPKI_SHA256}'
$cert=Get-ChildItem Cert:\\CurrentUser\\My | Where-Object { $_.HasPrivateKey } | Where-Object {
  $spki=$_.PublicKey.ExportSubjectPublicKeyInfo()
  ('sha256:'+([Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($spki))).ToLowerInvariant()) -eq $pin
} | Select-Object -First 1
if ($null -eq $cert) { throw 'compiled-SPKI non-exportable signer unavailable' }
$bytes=[IO.File]::ReadAllBytes($RosterPath)
$cms=[Security.Cryptography.Pkcs.SignedCms]::new([Security.Cryptography.Pkcs.ContentInfo]::new($bytes),$true)
$cms.ComputeSignature([Security.Cryptography.Pkcs.CmsSigner]::new($cert))
$encoded=$cms.Encode()
$stream=[IO.File]::Open($SignaturePath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
try { $stream.Write($encoded,0,$encoded.Length) } finally { $stream.Dispose() }
`;
  const result = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', script, rosterPath, signaturePath],
    { encoding: 'utf8' },
  );
  if (result.status !== 0 || !existsSync(signaturePath))
    throw new Error(`Friends roster same-SPKI CMS signing failed: ${String(result.stderr)}`);
};

const verifyRosterCms = (rosterPath: string, signaturePath: string): void => {
  const script = `
param([string]$RosterPath,[string]$SignaturePath)
$pin='${TRUSTED_INSTALLER_SPKI_SHA256}'
$content=[IO.File]::ReadAllBytes($RosterPath)
$cms=[Security.Cryptography.Pkcs.SignedCms]::new([Security.Cryptography.Pkcs.ContentInfo]::new($content),$true)
$cms.Decode([IO.File]::ReadAllBytes($SignaturePath)); $cms.CheckSignature($true)
if ($cms.SignerInfos.Count -ne 1) { throw 'invalid signer cardinality' }
$cert=$cms.SignerInfos[0].Certificate
$actual='sha256:'+([Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($cert.PublicKey.ExportSubjectPublicKeyInfo()))).ToLowerInvariant()
if ($actual -ne $pin) { throw 'compiled SPKI mismatch' }
`;
  const result = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', script, rosterPath, signaturePath],
    { encoding: 'utf8' },
  );
  if (result.status !== 0)
    throw new Error(`Friends roster same-SPKI verification failed: ${String(result.stderr)}`);
};

export const freezeFriendsRoster = (input: {
  artifactManifestPath: string;
  rosterCandidatePath: string;
}): { rosterPath: string; signaturePath: string } => {
  const authority = stageAuthority(
    requireAbsolute(input.artifactManifestPath, 'artifact manifest path'),
    'friends-pc',
  );
  const candidate = readJson(
    requireAbsolute(input.rosterCandidatePath, 'roster candidate path'),
    'friends roster candidate',
  );
  validateRosterCandidate(candidate, authority);
  const rosterPath = resolveUnderRoot(
    authority.root,
    authority.config['friendsRosterPath'],
    'friends roster',
  );
  const signaturePath = resolveUnderRoot(
    authority.root,
    authority.config['friendsRosterSignaturePath'],
    'friends roster signature',
  );
  if (signaturePath !== `${rosterPath}.p7s`)
    throw new Error('Friends roster signature is not the adjacent fixed path.');
  if (existsSync(rosterPath) || existsSync(signaturePath))
    throw new Error('Friends roster pair is already frozen or half-created.');
  const canonicalBytes = `${canonicalPhase6Evidence(candidate)}\n`;
  mkdirSync(dirname(rosterPath), { recursive: true });
  try {
    writeFileSync(rosterPath, canonicalBytes, { flag: 'wx' });
    signRoster(rosterPath, signaturePath);
    verifyRosterCms(rosterPath, signaturePath);
    const loaded = loadEvidence();
    const cell = loaded.manifest.stages[PHASE6_PROMOTION_STAGES.indexOf('friends-pc')]!;
    if (cell.friendsRoster !== null)
      throw new Error('Friends roster is already frozen in evidence.');
    const participants = candidate['participants'] as {
      participantId: string;
      machineSlot: string;
    }[];
    const roster: Phase6FriendsRoster = {
      id: String(candidate['rosterId']),
      recordedAt: String(candidate['createdAt']),
      operationVersion: authority.operationVersionId,
      buildId: authority.buildId,
      artifactManifestSha256: unprefix(authority.artifactManifestSha256, 'artifact authority'),
      configSha256: authority.configSha256,
      rosterSha256: sha256(canonicalBytes),
      cmsSha256: sha256(readFileSync(signaturePath)),
      participants: participants.map(({ participantId, machineSlot }) => ({
        participantId,
        machineSlot,
      })),
    };
    cell.friendsRoster = roster;
    atomicAppend(loaded.bytes, loaded.manifest, [rosterPath, signaturePath]);
  } catch (error) {
    unlinkIfPresent(signaturePath);
    unlinkIfPresent(rosterPath);
    throw error;
  }
  return { rosterPath, signaturePath };
};

export const appendPhysicalReview = (input: {
  stage: Phase6PhysicalStage;
  reviewPath: string;
}): { reviewRecordPath: string } => {
  assertPhysicalStage(input.stage);
  const review = readJson(
    requireAbsolute(input.reviewPath, 'review path'),
    'human review',
  ) as unknown as Phase6HumanReview;
  const loaded = loadEvidence();
  const cell = loaded.manifest.stages[PHASE6_PROMOTION_STAGES.indexOf(input.stage)]!;
  if (cell.reviews.some(({ id }) => id === review.id))
    throw new Error('duplicate review ID is forbidden.');
  const run = cell.runs.find(({ id }) => id === review.runEvidenceId);
  if (
    run === undefined ||
    review.stage !== input.stage ||
    review.response !== 'APPROVED' ||
    review.verdict !== 'APPROVED' ||
    review.participantId !== run.participantId ||
    review.machineSlot !== run.machineSlot ||
    review.operationVersion !== run.operationVersion ||
    review.buildId !== run.buildId ||
    review.artifactManifestSha256 !== run.artifactManifestSha256 ||
    review.configSha256 !== run.configSha256 ||
    review.friendsRosterSha256 !== run.friendsRosterSha256 ||
    review.runEvidenceSha256 !== phase6EvidenceSha256(run) ||
    JSON.stringify(review.artifactHashes) !==
      JSON.stringify(run.artifacts.map(({ sha256: digest }) => digest)) ||
    Date.parse(review.recordedAt) <= Date.parse(run.recordedAt)
  )
    throw new Error('Human review does not bind the exact immutable run or is not strictly later.');
  const consent = cell.consents.find(({ id }) => id === review.consentId);
  if (input.stage === 'friends-pc') {
    if (
      consent === undefined ||
      review.consentSha256 !== phase6EvidenceSha256(consent) ||
      Date.parse(review.recordedAt) <= Date.parse(consent.recordedAt)
    )
      throw new Error('Friends review does not bind the exact prior consent.');
  } else if (review.consentId !== null || review.consentSha256 !== null)
    throw new Error('Non-friends review cannot invent consent.');
  const reviewRecordPath = resolve(
    'tooling/phase6-evidence/records',
    input.stage,
    'reviews',
    `${review.id}.json`,
  );
  if (existsSync(reviewRecordPath)) throw new Error('Create-only review already exists.');
  writeExclusiveJson(reviewRecordPath, review);
  cell.reviews.push(review);
  atomicAppend(loaded.bytes, loaded.manifest, [reviewRecordPath]);
  return { reviewRecordPath };
};

const runCli = (): void => {
  const parsed = parsePhysicalWriterCli(process.argv[2] ?? '', process.argv.slice(3));
  if (parsed.command === 'ingest') writePhysicalRunEvidence(parsed);
  else if (parsed.command === 'freeze-roster') freezeFriendsRoster(parsed);
  else appendPhysicalReview(parsed);
};

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    runCli();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
