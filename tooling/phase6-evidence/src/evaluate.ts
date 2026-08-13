import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const PHASE6_PROMOTION_STAGES = [
  'deterministic-simulation',
  'clean-windows-vm',
  'owner-pc',
  'friends-pc',
] as const;

export const PHASE6_REQUIREMENTS = [
  'PLAN-01',
  'PLAN-02',
  'PLAN-03',
  'PLAN-04',
  'PLAN-05',
  'PLAN-06',
  'PLAN-07',
  'PLAN-08',
] as const;

export const PHASE6_DECISIONS = Array.from(
  { length: 35 },
  (_, index) => `D-${String(index + 1).padStart(2, '0')}`,
);

export type Phase6PromotionStage = (typeof PHASE6_PROMOTION_STAGES)[number];
export type Phase6PhysicalStage = Exclude<Phase6PromotionStage, 'deterministic-simulation'>;

export type Phase6CliOptions =
  | { mode: 'planned'; requireRunEvidence: Phase6PromotionStage }
  | { mode: 'planned'; requireAdmittedStage: Phase6PromotionStage }
  | { mode: 'final' };

export interface Phase6ArtifactReference {
  path: string;
  sha256: string;
}

export interface Phase6RunEvidence {
  id: string;
  source: 'phase6-deterministic-rust-1' | 'phase6-physical-runner-rust-1';
  stage: Phase6PromotionStage;
  evidenceKind: 'deterministic' | 'physical';
  status: 'PASS' | 'FAIL';
  operationVersion: string;
  buildId: string;
  participantId: string;
  machineSlot: string | null;
  artifactManifestSha256: string;
  configSha256: string;
  friendsRosterSha256: string | null;
  predecessorRunEvidenceSha256: string | null;
  recordedAt: string;
  exportedAt: string | null;
  expiresAt: string;
  artifacts: Phase6ArtifactReference[];
  cycle: {
    prepare: 'PASS' | 'FAIL';
    apply: 'PASS' | 'FAIL';
    verifyApply: 'PASS' | 'FAIL';
    restartRequired: boolean;
    restart: 'PASS' | 'FAIL' | 'NOT_REQUIRED';
    restore: 'PASS' | 'FAIL';
    verifyRestore: 'PASS' | 'FAIL';
  };
  continuation: string[];
  journalSha256: string;
  receiptSha256: string;
  security: {
    ipcAdversarial: 'PASS' | 'FAIL';
    replayRejected: boolean;
    identitySpoofRejected: boolean;
    sessionSwapRejected: boolean;
  };
  faults: {
    diskFull: 'PASS' | 'FAIL';
    crash: 'PASS' | 'FAIL';
    reboot: 'PASS' | 'FAIL';
    drift: 'PASS' | 'FAIL';
  };
  accessibility: { status: 'PASS' | 'FAIL'; seriousOrCriticalViolations: number };
  diagnostics: {
    redacted: boolean;
    previewed: boolean;
    consentBound: boolean;
    autoUpload: boolean;
    rawFieldsFound: string[];
    byteLength: number;
  };
  revocation: {
    signed: boolean;
    blocksNewApply: boolean;
    localRecoveryAvailable: boolean;
    remoteRollback: boolean;
    remoteExecution: boolean;
  };
  coverageGaps: string[];
  universalSupportClaim: boolean;
  manualOverride: boolean;
}

export interface Phase6Consent {
  id: string;
  participantId: string;
  machineSlot: string | null;
  recordedAt: string;
  artifactManifestSha256: string;
  configSha256: string;
  friendsRosterSha256: string;
  runEvidenceId: string;
  runEvidenceSha256: string;
  previewSha256: string;
  redactedBytesSha256: string;
  intent: 'export' | 'send' | 'export-and-send';
}

export interface Phase6HumanReview {
  id: string;
  reviewerId: string;
  participantId: string;
  machineSlot: string | null;
  recordedAt: string;
  response: 'APPROVED' | 'REJECTED';
  verdict: 'APPROVED' | 'REJECTED';
  operationVersion: string;
  buildId: string;
  stage: Phase6PromotionStage;
  artifactManifestSha256: string;
  configSha256: string;
  friendsRosterSha256: string | null;
  runEvidenceId: string;
  runEvidenceSha256: string;
  consentId: string | null;
  consentSha256: string | null;
  artifactHashes: string[];
}

export interface Phase6FriendsRoster {
  id: string;
  recordedAt: string;
  operationVersion: string;
  buildId: string;
  artifactManifestSha256: string;
  configSha256: string;
  rosterSha256: string;
  cmsSha256: string;
  participants: { participantId: string; machineSlot: string }[];
}

export interface Phase6StageEvidence {
  stage: Phase6PromotionStage;
  predecessorStage: Phase6PromotionStage | null;
  friendsRoster: Phase6FriendsRoster | null;
  runs: Phase6RunEvidence[];
  consents: Phase6Consent[];
  reviews: Phase6HumanReview[];
}

export interface Phase6EvidenceManifest {
  schemaVersion: 2;
  generatedAt: string;
  operationVersion: string;
  immutableBuild: {
    id: string;
    commit: string;
    artifact: Phase6ArtifactReference;
    artifactManifestSha256: string;
  };
  promotionStage: Phase6PromotionStage;
  requirementsCoverage: string[];
  decisionCoverage: string[];
  legacyBlockedAttempts: Phase6ArtifactReference[];
  stages: Phase6StageEvidence[];
}

export interface Phase6EvidenceDiagnostic {
  code: string;
  path: string;
  message: string;
}

export type Phase6EvaluationContext = Phase6CliOptions & {
  evaluatedAt: string;
  artifactContents: Readonly<Record<string, string | Uint8Array>>;
};

export interface Phase6EvidenceResult {
  ok: boolean;
  releaseReady: boolean;
  highestAdmittedStage: Phase6PromotionStage | null;
  runReadyForReview: boolean;
  pendingStages: Phase6PromotionStage[];
  coverageGaps: string[];
  diagnostics: Phase6EvidenceDiagnostic[];
}

const HASH_PATTERN = /^[a-f0-9]{64}$/u;
const COMMIT_PATTERN = /^[a-f0-9]{40}$/u;
const CONTINUATION = [
  'installed-ready',
  'checkpoint-created',
  'reboot-requested',
  'resumed-observation',
  'restore-requested',
  'restored-complete',
] as const;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isStage = (value: unknown): value is Phase6PromotionStage =>
  typeof value === 'string' && PHASE6_PROMOTION_STAGES.includes(value as Phase6PromotionStage);

const isIsoDate = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && Number.isFinite(Date.parse(value));

const isExactRelativePath = (value: string): boolean =>
  value.length > 0 &&
  !value.includes('\\') &&
  !value.startsWith('/') &&
  !/^[A-Za-z]:/u.test(value) &&
  !/[*?[\]{}]/u.test(value) &&
  value.split('/').every((segment) => segment.length > 0 && segment !== '.' && segment !== '..');

const hasExactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
};

const sha256 = (value: string | Uint8Array): string =>
  createHash('sha256').update(value).digest('hex');

export const canonicalPhase6Evidence = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonicalPhase6Evidence).join(',')}]`;
  if (isObject(value)) {
    return `{${Object.entries(value)
      .toSorted(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${canonicalPhase6Evidence(nested)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
};

export const phase6EvidenceSha256 = (value: unknown): string =>
  sha256(canonicalPhase6Evidence(value));

const diagnostic = (code: string, path: string, message: string): Phase6EvidenceDiagnostic => ({
  code,
  path,
  message,
});

const push = (
  diagnostics: Phase6EvidenceDiagnostic[],
  condition: boolean,
  code: string,
  path: string,
  message: string,
): void => {
  if (condition) diagnostics.push(diagnostic(code, path, message));
};

const asArtifact = (value: unknown): Phase6ArtifactReference | null => {
  if (
    !isObject(value) ||
    !hasExactKeys(value, ['path', 'sha256']) ||
    typeof value['path'] !== 'string' ||
    typeof value['sha256'] !== 'string'
  )
    return null;
  return value as unknown as Phase6ArtifactReference;
};

const asRun = (value: unknown): Phase6RunEvidence | null => {
  const keys = [
    'id',
    'source',
    'stage',
    'evidenceKind',
    'status',
    'operationVersion',
    'buildId',
    'participantId',
    'machineSlot',
    'artifactManifestSha256',
    'configSha256',
    'friendsRosterSha256',
    'predecessorRunEvidenceSha256',
    'recordedAt',
    'exportedAt',
    'expiresAt',
    'artifacts',
    'cycle',
    'continuation',
    'journalSha256',
    'receiptSha256',
    'security',
    'faults',
    'accessibility',
    'diagnostics',
    'revocation',
    'coverageGaps',
    'universalSupportClaim',
    'manualOverride',
  ] as const;
  if (!isObject(value) || !hasExactKeys(value, keys)) return null;
  if (
    typeof value['id'] !== 'string' ||
    typeof value['source'] !== 'string' ||
    !isStage(value['stage']) ||
    typeof value['evidenceKind'] !== 'string' ||
    typeof value['status'] !== 'string' ||
    typeof value['operationVersion'] !== 'string' ||
    typeof value['buildId'] !== 'string' ||
    typeof value['participantId'] !== 'string' ||
    (value['machineSlot'] !== null && typeof value['machineSlot'] !== 'string') ||
    typeof value['artifactManifestSha256'] !== 'string' ||
    typeof value['configSha256'] !== 'string' ||
    (value['friendsRosterSha256'] !== null && typeof value['friendsRosterSha256'] !== 'string') ||
    (value['predecessorRunEvidenceSha256'] !== null &&
      typeof value['predecessorRunEvidenceSha256'] !== 'string') ||
    typeof value['recordedAt'] !== 'string' ||
    (value['exportedAt'] !== null && typeof value['exportedAt'] !== 'string') ||
    typeof value['expiresAt'] !== 'string' ||
    !Array.isArray(value['artifacts']) ||
    value['artifacts'].some((artifact) => asArtifact(artifact) === null) ||
    !Array.isArray(value['continuation']) ||
    !Array.isArray(value['coverageGaps']) ||
    !isObject(value['cycle']) ||
    !isObject(value['security']) ||
    !isObject(value['faults']) ||
    !isObject(value['accessibility']) ||
    !isObject(value['diagnostics']) ||
    !isObject(value['revocation'])
  )
    return null;
  return value as unknown as Phase6RunEvidence;
};

const asConsent = (value: unknown): Phase6Consent | null => {
  const keys = [
    'id',
    'participantId',
    'machineSlot',
    'recordedAt',
    'artifactManifestSha256',
    'configSha256',
    'friendsRosterSha256',
    'runEvidenceId',
    'runEvidenceSha256',
    'previewSha256',
    'redactedBytesSha256',
    'intent',
  ] as const;
  if (!isObject(value) || !hasExactKeys(value, keys)) return null;
  if (keys.some((key) => key !== 'machineSlot' && typeof value[key] !== 'string')) return null;
  if (value['machineSlot'] !== null && typeof value['machineSlot'] !== 'string') return null;
  return value as unknown as Phase6Consent;
};

const asReview = (value: unknown): Phase6HumanReview | null => {
  const keys = [
    'id',
    'reviewerId',
    'participantId',
    'machineSlot',
    'recordedAt',
    'response',
    'verdict',
    'operationVersion',
    'buildId',
    'stage',
    'artifactManifestSha256',
    'configSha256',
    'friendsRosterSha256',
    'runEvidenceId',
    'runEvidenceSha256',
    'consentId',
    'consentSha256',
    'artifactHashes',
  ] as const;
  if (
    !isObject(value) ||
    !hasExactKeys(value, keys) ||
    !isStage(value['stage']) ||
    !Array.isArray(value['artifactHashes'])
  )
    return null;
  for (const key of keys) {
    if (
      [
        'machineSlot',
        'friendsRosterSha256',
        'consentId',
        'consentSha256',
        'artifactHashes',
      ].includes(key)
    )
      continue;
    if (typeof value[key] !== 'string') return null;
  }
  for (const key of ['machineSlot', 'friendsRosterSha256', 'consentId', 'consentSha256'] as const) {
    if (value[key] !== null && typeof value[key] !== 'string') return null;
  }
  return value as unknown as Phase6HumanReview;
};

const asRoster = (value: unknown): Phase6FriendsRoster | null => {
  const keys = [
    'id',
    'recordedAt',
    'operationVersion',
    'buildId',
    'artifactManifestSha256',
    'configSha256',
    'rosterSha256',
    'cmsSha256',
    'participants',
  ] as const;
  if (!isObject(value) || !hasExactKeys(value, keys) || !Array.isArray(value['participants']))
    return null;
  if (keys.slice(0, -1).some((key) => typeof value[key] !== 'string')) return null;
  for (const participant of value['participants']) {
    if (
      !isObject(participant) ||
      !hasExactKeys(participant, ['participantId', 'machineSlot']) ||
      typeof participant['participantId'] !== 'string' ||
      typeof participant['machineSlot'] !== 'string'
    )
      return null;
  }
  return value as unknown as Phase6FriendsRoster;
};

const asManifest = (value: unknown): Phase6EvidenceManifest | null => {
  if (
    !isObject(value) ||
    !hasExactKeys(value, [
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
    value['schemaVersion'] !== 2 ||
    typeof value['generatedAt'] !== 'string' ||
    typeof value['operationVersion'] !== 'string' ||
    !isStage(value['promotionStage']) ||
    !Array.isArray(value['requirementsCoverage']) ||
    !Array.isArray(value['decisionCoverage']) ||
    !Array.isArray(value['legacyBlockedAttempts']) ||
    value['legacyBlockedAttempts'].some((entry) => asArtifact(entry) === null) ||
    !Array.isArray(value['stages']) ||
    !isObject(value['immutableBuild']) ||
    !hasExactKeys(value['immutableBuild'], [
      'id',
      'commit',
      'artifact',
      'artifactManifestSha256',
    ]) ||
    typeof value['immutableBuild']['id'] !== 'string' ||
    typeof value['immutableBuild']['commit'] !== 'string' ||
    typeof value['immutableBuild']['artifactManifestSha256'] !== 'string' ||
    asArtifact(value['immutableBuild']['artifact']) === null
  )
    return null;
  for (const cell of value['stages']) {
    if (
      !isObject(cell) ||
      !hasExactKeys(cell, [
        'stage',
        'predecessorStage',
        'friendsRoster',
        'runs',
        'consents',
        'reviews',
      ]) ||
      !isStage(cell['stage']) ||
      (cell['predecessorStage'] !== null && !isStage(cell['predecessorStage'])) ||
      (cell['friendsRoster'] !== null && asRoster(cell['friendsRoster']) === null) ||
      !Array.isArray(cell['runs']) ||
      cell['runs'].some((run) => asRun(run) === null) ||
      !Array.isArray(cell['consents']) ||
      cell['consents'].some((consent) => asConsent(consent) === null) ||
      !Array.isArray(cell['reviews']) ||
      cell['reviews'].some((review) => asReview(review) === null)
    )
      return null;
  }
  return value as unknown as Phase6EvidenceManifest;
};

const invalidResult = (diagnostics: Phase6EvidenceDiagnostic[]): Phase6EvidenceResult => ({
  ok: false,
  releaseReady: false,
  highestAdmittedStage: null,
  runReadyForReview: false,
  pendingStages: [...PHASE6_PROMOTION_STAGES],
  coverageGaps: [],
  diagnostics,
});

const validateArtifact = (
  artifact: Phase6ArtifactReference,
  path: string,
  context: Phase6EvaluationContext,
  diagnostics: Phase6EvidenceDiagnostic[],
): void => {
  if (!isExactRelativePath(artifact.path) || !HASH_PATTERN.test(artifact.sha256)) {
    diagnostics.push(
      diagnostic('ARTIFACT_IDENTITY_INVALID', path, 'Artifact path and SHA-256 must be exact.'),
    );
    return;
  }
  const contents = context.artifactContents[artifact.path];
  if (contents === undefined)
    diagnostics.push(diagnostic('ARTIFACT_MISSING', path, 'Immutable artifact is missing.'));
  else if (sha256(contents) !== artifact.sha256)
    diagnostics.push(
      diagnostic('ARTIFACT_HASH_MISMATCH', path, 'Immutable artifact bytes changed.'),
    );
};

const validateRun = (
  manifest: Phase6EvidenceManifest,
  run: Phase6RunEvidence,
  cell: Phase6StageEvidence,
  predecessor: Phase6StageEvidence | undefined,
  path: string,
  context: Phase6EvaluationContext,
  diagnostics: Phase6EvidenceDiagnostic[],
): boolean => {
  const before = diagnostics.length;
  const physical = cell.stage !== 'deterministic-simulation';
  push(
    diagnostics,
    run.source !== (physical ? 'phase6-physical-runner-rust-1' : 'phase6-deterministic-rust-1'),
    'RUN_SOURCE_INVALID',
    `${path}.source`,
    'Only the canonical native runner source is admissible.',
  );
  push(
    diagnostics,
    run.evidenceKind !== (physical ? 'physical' : 'deterministic'),
    physical ? 'SIMULATED_AS_PHYSICAL' : 'PHYSICAL_AS_SIMULATION',
    `${path}.evidenceKind`,
    'Evidence provenance cannot be relabeled.',
  );
  push(
    diagnostics,
    run.status !== 'PASS',
    'RUN_EVIDENCE_NOT_PASSED',
    `${path}.status`,
    'Run evidence must pass.',
  );
  push(
    diagnostics,
    run.operationVersion !== manifest.operationVersion,
    'OPERATION_VERSION_MISMATCH',
    `${path}.operationVersion`,
    'Operation version mismatch.',
  );
  push(
    diagnostics,
    run.buildId !== manifest.immutableBuild.id,
    'BUILD_ID_MISMATCH',
    `${path}.buildId`,
    'Build identity mismatch.',
  );
  push(
    diagnostics,
    run.stage !== cell.stage,
    'RUN_STAGE_MISMATCH',
    `${path}.stage`,
    'Stage identity mismatch.',
  );
  push(
    diagnostics,
    run.artifactManifestSha256 !== manifest.immutableBuild.artifactManifestSha256,
    'ARTIFACT_MANIFEST_HASH_MISMATCH',
    `${path}.artifactManifestSha256`,
    'Run must bind the authenticated artifact manifest.',
  );
  push(
    diagnostics,
    !HASH_PATTERN.test(run.configSha256),
    'CONFIG_HASH_INVALID',
    `${path}.configSha256`,
    'Run must bind an exact signed config hash.',
  );
  const predecessorRun = predecessor?.runs.at(-1);
  const expectedPredecessor =
    predecessorRun === undefined ? null : phase6EvidenceSha256(predecessorRun);
  push(
    diagnostics,
    run.predecessorRunEvidenceSha256 !== expectedPredecessor,
    'RUN_PREDECESSOR_HASH_MISMATCH',
    `${path}.predecessorRunEvidenceSha256`,
    'Run must bind its exact admitted predecessor.',
  );
  push(
    diagnostics,
    !isIsoDate(run.recordedAt) || !isIsoDate(run.expiresAt),
    'RUN_TIMESTAMP_INVALID',
    path,
    'Run timestamps must be valid.',
  );
  if (isIsoDate(run.expiresAt) && isIsoDate(context.evaluatedAt))
    push(
      diagnostics,
      Date.parse(run.expiresAt) <= Date.parse(context.evaluatedAt),
      'RUN_EVIDENCE_STALE',
      `${path}.expiresAt`,
      'Expired evidence is blocked.',
    );
  push(
    diagnostics,
    run.artifacts.length < 2,
    'RUN_ARTIFACTS_INCOMPLETE',
    `${path}.artifacts`,
    'Build and evidence artifacts are required.',
  );
  for (const [index, artifact] of run.artifacts.entries())
    validateArtifact(artifact, `${path}.artifacts[${String(index)}]`, context, diagnostics);
  push(
    diagnostics,
    !run.artifacts.some(
      (artifact) =>
        artifact.path === manifest.immutableBuild.artifact.path &&
        artifact.sha256 === manifest.immutableBuild.artifact.sha256,
    ),
    'BUILD_ARTIFACT_BINDING_MISSING',
    `${path}.artifacts`,
    'Exact build artifact binding is required.',
  );
  const cycle = run.cycle;
  push(
    diagnostics,
    cycle.prepare !== 'PASS' ||
      cycle.apply !== 'PASS' ||
      cycle.verifyApply !== 'PASS' ||
      cycle.restore !== 'PASS' ||
      cycle.verifyRestore !== 'PASS' ||
      cycle.restart !== (cycle.restartRequired ? 'PASS' : 'NOT_REQUIRED'),
    'RUN_CYCLE_INCOMPLETE',
    `${path}.cycle`,
    'The complete apply/restart/restore cycle must pass.',
  );
  push(
    diagnostics,
    JSON.stringify(run.continuation) !== JSON.stringify(CONTINUATION),
    'RUN_CONTINUATION_INVALID',
    `${path}.continuation`,
    'The exact observation-first continuation chain is required.',
  );
  push(
    diagnostics,
    !HASH_PATTERN.test(run.journalSha256) || !HASH_PATTERN.test(run.receiptSha256),
    'RUN_PROOF_HASH_INVALID',
    path,
    'Journal and receipt hashes are required.',
  );
  push(
    diagnostics,
    run.security.ipcAdversarial !== 'PASS' ||
      !run.security.replayRejected ||
      !run.security.identitySpoofRejected ||
      !run.security.sessionSwapRejected,
    'RUN_SECURITY_INVALID',
    `${path}.security`,
    'All security witnesses must pass.',
  );
  push(
    diagnostics,
    Object.values(run.faults).some((status) => status !== 'PASS'),
    'RUN_FAULTS_INVALID',
    `${path}.faults`,
    'All fault witnesses must pass.',
  );
  push(
    diagnostics,
    run.accessibility.status !== 'PASS' || run.accessibility.seriousOrCriticalViolations !== 0,
    'RUN_ACCESSIBILITY_INVALID',
    `${path}.accessibility`,
    'Accessibility evidence must pass.',
  );
  push(
    diagnostics,
    !run.diagnostics.redacted ||
      !run.diagnostics.previewed ||
      !run.diagnostics.consentBound ||
      run.diagnostics.autoUpload ||
      run.diagnostics.rawFieldsFound.length > 0 ||
      !Number.isInteger(run.diagnostics.byteLength) ||
      run.diagnostics.byteLength < 1 ||
      run.diagnostics.byteLength > 65_536,
    'RUN_DIAGNOSTICS_INVALID',
    `${path}.diagnostics`,
    'Diagnostics must be bounded, redacted, previewed, and consent-bound.',
  );
  push(
    diagnostics,
    !run.revocation.signed ||
      !run.revocation.blocksNewApply ||
      !run.revocation.localRecoveryAvailable ||
      run.revocation.remoteRollback ||
      run.revocation.remoteExecution,
    'RUN_REVOCATION_INVALID',
    `${path}.revocation`,
    'Revocation must fail closed while preserving local recovery.',
  );
  push(
    diagnostics,
    run.coverageGaps.length === 0 || run.universalSupportClaim || run.manualOverride,
    'RUN_COVERAGE_INVALID',
    path,
    'Coverage gaps must remain visible without override.',
  );
  return diagnostics.length === before;
};

const validateRoster = (
  manifest: Phase6EvidenceManifest,
  roster: Phase6FriendsRoster,
  path: string,
  diagnostics: Phase6EvidenceDiagnostic[],
): boolean => {
  const before = diagnostics.length;
  const participants = roster.participants.map(({ participantId }) => participantId);
  const slots = roster.participants.map(({ machineSlot }) => machineSlot);
  push(
    diagnostics,
    roster.participants.length < 2 ||
      new Set(participants).size !== participants.length ||
      new Set(slots).size !== slots.length ||
      participants.some((id) => id.length === 0) ||
      slots.some((slot) => slot.length === 0),
    'FRIENDS_ROSTER_INVALID',
    `${path}.participants`,
    'Roster requires unique purpose-bound participants and machine slots.',
  );
  push(
    diagnostics,
    roster.operationVersion !== manifest.operationVersion ||
      roster.buildId !== manifest.immutableBuild.id ||
      roster.artifactManifestSha256 !== manifest.immutableBuild.artifactManifestSha256 ||
      !HASH_PATTERN.test(roster.configSha256) ||
      !HASH_PATTERN.test(roster.rosterSha256) ||
      !HASH_PATTERN.test(roster.cmsSha256),
    'FRIENDS_ROSTER_BINDING_INVALID',
    path,
    'Roster must bind authenticated artifact/config/build identity and CMS bytes.',
  );
  return diagnostics.length === before;
};

const validateConsent = (
  run: Phase6RunEvidence,
  consent: Phase6Consent,
  roster: Phase6FriendsRoster,
  path: string,
  diagnostics: Phase6EvidenceDiagnostic[],
): boolean => {
  const before = diagnostics.length;
  push(
    diagnostics,
    consent.participantId !== run.participantId || consent.machineSlot !== run.machineSlot,
    'CONSENT_PARTICIPANT_MISMATCH',
    path,
    'Consent must bind the local roster member.',
  );
  push(
    diagnostics,
    consent.artifactManifestSha256 !== run.artifactManifestSha256 ||
      consent.configSha256 !== run.configSha256 ||
      consent.friendsRosterSha256 !== roster.rosterSha256,
    'CONSENT_AUTHORITY_MISMATCH',
    path,
    'Consent must bind artifact, config, and roster authority.',
  );
  push(
    diagnostics,
    consent.runEvidenceId !== run.id || consent.runEvidenceSha256 !== phase6EvidenceSha256(run),
    'CONSENT_RUN_MISMATCH',
    path,
    'Consent must bind the immutable local run.',
  );
  push(
    diagnostics,
    !HASH_PATTERN.test(consent.previewSha256) || !HASH_PATTERN.test(consent.redactedBytesSha256),
    'CONSENT_PREVIEW_INVALID',
    path,
    'Consent must bind previewed redacted bytes.',
  );
  push(
    diagnostics,
    !isIsoDate(consent.recordedAt) ||
      !isIsoDate(run.exportedAt) ||
      Date.parse(consent.recordedAt) >= Date.parse(run.exportedAt ?? ''),
    'CONSENT_NOT_BEFORE_EXPORT',
    `${path}.recordedAt`,
    'Consent must precede export strictly.',
  );
  return diagnostics.length === before;
};

const validateReview = (
  manifest: Phase6EvidenceManifest,
  run: Phase6RunEvidence,
  review: Phase6HumanReview,
  consent: Phase6Consent | null,
  path: string,
  diagnostics: Phase6EvidenceDiagnostic[],
): boolean => {
  const before = diagnostics.length;
  push(
    diagnostics,
    review.response !== 'APPROVED' || review.verdict !== 'APPROVED',
    'HUMAN_REVIEW_REJECTED',
    path,
    'Only exact APPROVED review is admissible.',
  );
  push(
    diagnostics,
    review.participantId !== run.participantId || review.machineSlot !== run.machineSlot,
    'REVIEW_PARTICIPANT_MISMATCH',
    path,
    'Review must bind the run participant.',
  );
  push(
    diagnostics,
    review.operationVersion !== manifest.operationVersion ||
      review.buildId !== manifest.immutableBuild.id ||
      review.stage !== run.stage,
    'REVIEW_AUTHORITY_MISMATCH',
    path,
    'Review must bind operation, build, and stage.',
  );
  push(
    diagnostics,
    review.artifactManifestSha256 !== run.artifactManifestSha256 ||
      review.configSha256 !== run.configSha256 ||
      review.friendsRosterSha256 !== run.friendsRosterSha256,
    'REVIEW_AUTHORITY_HASH_MISMATCH',
    path,
    'Review authority hashes must match the run.',
  );
  push(
    diagnostics,
    review.runEvidenceId !== run.id || review.runEvidenceSha256 !== phase6EvidenceSha256(run),
    'REVIEW_RUN_HASH_MISMATCH',
    path,
    'Review must bind exact immutable run bytes.',
  );
  push(
    diagnostics,
    JSON.stringify(review.artifactHashes) !==
      JSON.stringify(run.artifacts.map(({ sha256: hash }) => hash)),
    'REVIEW_ARTIFACT_HASH_MISMATCH',
    path,
    'Review artifact hashes must match exactly.',
  );
  if (consent === null)
    push(
      diagnostics,
      review.consentId !== null || review.consentSha256 !== null,
      'REVIEW_CONSENT_UNEXPECTED',
      path,
      'Non-friends review cannot invent consent.',
    );
  else
    push(
      diagnostics,
      review.consentId !== consent.id || review.consentSha256 !== phase6EvidenceSha256(consent),
      'REVIEW_CONSENT_MISMATCH',
      path,
      'Friends review must bind exact consent bytes.',
    );
  push(
    diagnostics,
    !isIsoDate(review.recordedAt) ||
      Date.parse(review.recordedAt) <= Date.parse(run.recordedAt) ||
      (consent !== null && Date.parse(review.recordedAt) <= Date.parse(consent.recordedAt)),
    'REVIEW_NOT_AFTER_RUN',
    `${path}.recordedAt`,
    'Review must be strictly later than run and consent.',
  );
  return diagnostics.length === before;
};

const validateStageShape = (
  cell: Phase6StageEvidence,
  path: string,
  diagnostics: Phase6EvidenceDiagnostic[],
): void => {
  if (cell.stage === 'deterministic-simulation') {
    push(
      diagnostics,
      cell.runs.length !== 1 ||
        cell.reviews.length !== 0 ||
        cell.consents.length !== 0 ||
        cell.friendsRoster !== null,
      'DETERMINISTIC_CARDINALITY_INVALID',
      path,
      'Deterministic evidence is exactly one run with no physical records.',
    );
  } else if (cell.stage !== 'friends-pc') {
    push(
      diagnostics,
      cell.runs.length > 1 ||
        cell.reviews.length > 1 ||
        cell.consents.length !== 0 ||
        cell.friendsRoster !== null,
      'PHYSICAL_CARDINALITY_INVALID',
      path,
      'Clean VM and owner stages admit at most one run and review.',
    );
  }
};

export const evaluatePhase6Evidence = (
  input: unknown,
  context: Phase6EvaluationContext,
): Phase6EvidenceResult => {
  if (isObject(input) && input['schemaVersion'] === 1)
    return invalidResult([
      diagnostic(
        'LEGACY_EVIDENCE_BLOCKED',
        '$.schemaVersion',
        'Legacy evidence is immutable blocked history and cannot promote.',
      ),
    ]);
  const manifest = asManifest(input);
  if (manifest === null)
    return invalidResult([
      diagnostic(
        'EVIDENCE_MANIFEST_INVALID',
        '$',
        'Manifest does not satisfy the closed Phase 6 v2 evidence contract.',
      ),
    ]);
  const diagnostics: Phase6EvidenceDiagnostic[] = [];
  if (!isIsoDate(context.evaluatedAt) || !isIsoDate(manifest.generatedAt))
    diagnostics.push(
      diagnostic('EVIDENCE_TIMESTAMP_INVALID', '$.generatedAt', 'Exact timestamps are required.'),
    );
  push(
    diagnostics,
    manifest.operationVersion.length === 0,
    'OPERATION_VERSION_MISSING',
    '$.operationVersion',
    'Operation version is required.',
  );
  push(
    diagnostics,
    manifest.immutableBuild.id.length === 0 ||
      !COMMIT_PATTERN.test(manifest.immutableBuild.commit) ||
      !HASH_PATTERN.test(manifest.immutableBuild.artifactManifestSha256),
    'IMMUTABLE_BUILD_INVALID',
    '$.immutableBuild',
    'Immutable build identity is invalid.',
  );
  validateArtifact(
    manifest.immutableBuild.artifact,
    '$.immutableBuild.artifact',
    context,
    diagnostics,
  );

  for (const requirement of PHASE6_REQUIREMENTS)
    push(
      diagnostics,
      !manifest.requirementsCoverage.includes(requirement),
      'REQUIREMENT_COVERAGE_MISSING',
      '$.requirementsCoverage',
      `Required coverage reference ${requirement} is missing.`,
    );
  push(
    diagnostics,
    JSON.stringify(manifest.requirementsCoverage) !== JSON.stringify(PHASE6_REQUIREMENTS),
    'REQUIREMENT_COVERAGE_INVALID',
    '$.requirementsCoverage',
    'Requirement coverage must be exact ordered PLAN-01 through PLAN-08.',
  );
  for (const decision of PHASE6_DECISIONS)
    push(
      diagnostics,
      !manifest.decisionCoverage.includes(decision),
      'DECISION_COVERAGE_MISSING',
      '$.decisionCoverage',
      `Decision ${decision} is missing.`,
    );
  push(
    diagnostics,
    JSON.stringify(manifest.decisionCoverage) !== JSON.stringify(PHASE6_DECISIONS),
    'DECISION_COVERAGE_INVALID',
    '$.decisionCoverage',
    'Decision coverage must be exact D-01 through D-35.',
  );

  const sequenceValid =
    manifest.stages.length === PHASE6_PROMOTION_STAGES.length &&
    manifest.stages.every(
      (cell, index) =>
        cell.stage === PHASE6_PROMOTION_STAGES[index] &&
        cell.predecessorStage === (index === 0 ? null : PHASE6_PROMOTION_STAGES[index - 1]),
    );
  push(
    diagnostics,
    !sequenceValid,
    'PROMOTION_STAGE_SEQUENCE_INVALID',
    '$.stages',
    'All four exact ordered stage cells are required.',
  );
  if (!sequenceValid) return invalidResult(diagnostics);

  const target =
    context.mode === 'final'
      ? 'friends-pc'
      : 'requireRunEvidence' in context
        ? context.requireRunEvidence
        : context.requireAdmittedStage;
  const targetIndex = PHASE6_PROMOTION_STAGES.indexOf(target);
  let predecessorAdmitted = true;
  let highestAdmittedStage: Phase6PromotionStage | null = null;
  let runReadyForReview = false;
  const pendingStages: Phase6PromotionStage[] = [];
  const coverageGaps = new Set<string>();

  for (const [index, cell] of manifest.stages.entries()) {
    if (index > targetIndex) {
      if (cell.runs.length === 0) pendingStages.push(cell.stage);
      continue;
    }
    const path = `$.stages[${String(index)}]`;
    validateStageShape(cell, path, diagnostics);
    const predecessor = index === 0 ? undefined : manifest.stages[index - 1];
    const isTargetRunGate =
      context.mode === 'planned' && 'requireRunEvidence' in context && cell.stage === target;
    const requiresAdmission = !isTargetRunGate;

    if (cell.runs.length === 0) {
      diagnostics.push(
        diagnostic(
          cell.stage === 'deterministic-simulation'
            ? 'DETERMINISTIC_RUN_EVIDENCE_MISSING'
            : 'PHYSICAL_RUN_EVIDENCE_MISSING',
          `${path}.runs`,
          `Stage ${cell.stage} requires persisted run evidence.`,
        ),
      );
      pendingStages.push(cell.stage);
      predecessorAdmitted = false;
      continue;
    }
    if (!predecessorAdmitted)
      diagnostics.push(
        diagnostic(
          'PROMOTION_STAGE_SKIPPED',
          path,
          `${cell.stage} cannot precede an unadmitted stage.`,
        ),
      );

    let rosterValid = true;
    if (cell.stage === 'friends-pc') {
      if (cell.friendsRoster === null) {
        diagnostics.push(
          diagnostic(
            'FRIENDS_ROSTER_MISSING',
            `${path}.friendsRoster`,
            'Friends stage requires its frozen signed roster.',
          ),
        );
        rosterValid = false;
      } else
        rosterValid = validateRoster(
          manifest,
          cell.friendsRoster,
          `${path}.friendsRoster`,
          diagnostics,
        );
    }
    const runValidity = cell.runs.map((run, runIndex) => {
      for (const gap of run.coverageGaps) coverageGaps.add(gap);
      return validateRun(
        manifest,
        run,
        cell,
        predecessor,
        `${path}.runs[${String(runIndex)}]`,
        context,
        diagnostics,
      );
    });

    let collectionsValid = true;
    if (cell.stage === 'friends-pc' && cell.friendsRoster !== null) {
      const rosterBindings = new Map(
        cell.friendsRoster.participants.map((entry) => [entry.participantId, entry.machineSlot]),
      );
      const runBindings = new Map<string, Phase6RunEvidence>();
      for (const run of cell.runs) {
        if (
          runBindings.has(run.participantId) ||
          rosterBindings.get(run.participantId) !== run.machineSlot ||
          run.friendsRosterSha256 !== cell.friendsRoster.rosterSha256
        )
          collectionsValid = false;
        runBindings.set(run.participantId, run);
      }
      if (
        cell.runs.length !== rosterBindings.size ||
        runBindings.size !== rosterBindings.size ||
        [...rosterBindings.keys()].some((id) => !runBindings.has(id))
      )
        collectionsValid = false;
      const consents = new Map<string, Phase6Consent>();
      for (const [consentIndex, consent] of cell.consents.entries()) {
        const run = runBindings.get(consent.participantId);
        if (
          run === undefined ||
          consents.has(consent.participantId) ||
          !validateConsent(
            run,
            consent,
            cell.friendsRoster,
            `${path}.consents[${String(consentIndex)}]`,
            diagnostics,
          )
        )
          collectionsValid = false;
        consents.set(consent.participantId, consent);
      }
      if (cell.consents.length !== rosterBindings.size || consents.size !== rosterBindings.size)
        collectionsValid = false;
      if (requiresAdmission) {
        const reviews = new Map<string, Phase6HumanReview>();
        for (const [reviewIndex, review] of cell.reviews.entries()) {
          const run = runBindings.get(review.participantId);
          const consent = consents.get(review.participantId);
          if (
            run === undefined ||
            consent === undefined ||
            reviews.has(review.participantId) ||
            !validateReview(
              manifest,
              run,
              review,
              consent,
              `${path}.reviews[${String(reviewIndex)}]`,
              diagnostics,
            )
          )
            collectionsValid = false;
          reviews.set(review.participantId, review);
        }
        if (cell.reviews.length !== rosterBindings.size || reviews.size !== rosterBindings.size)
          collectionsValid = false;
      } else if (cell.reviews.length !== 0) collectionsValid = false;
      if (!collectionsValid)
        diagnostics.push(
          diagnostic(
            'FRIENDS_CARDINALITY_INVALID',
            path,
            'Roster, runs, consents, and reviews must correspond one-to-one.',
          ),
        );
    } else if (cell.stage !== 'deterministic-simulation') {
      if (requiresAdmission) {
        if (
          cell.runs.length !== 1 ||
          cell.reviews.length !== 1 ||
          !validateReview(
            manifest,
            cell.runs[0]!,
            cell.reviews[0]!,
            null,
            `${path}.reviews[0]`,
            diagnostics,
          )
        )
          collectionsValid = false;
      } else if (cell.runs.length !== 1 || cell.reviews.length !== 0) collectionsValid = false;
      if (!collectionsValid)
        diagnostics.push(
          diagnostic(
            'PHYSICAL_CARDINALITY_INVALID',
            path,
            'Physical stage requires exact run/review cardinality.',
          ),
        );
    }

    const runValid = runValidity.every(Boolean);
    const admitted: boolean =
      predecessorAdmitted && rosterValid && runValid && collectionsValid && requiresAdmission;
    if (isTargetRunGate)
      runReadyForReview = predecessorAdmitted && rosterValid && runValid && collectionsValid;
    if (admitted) highestAdmittedStage = cell.stage;
    else pendingStages.push(cell.stage);
    predecessorAdmitted = isTargetRunGate ? false : admitted;
  }

  const suppliedStages = manifest.stages.filter((cell) => cell.runs.length > 0);
  const highestSupplied = suppliedStages.at(-1)?.stage ?? 'deterministic-simulation';
  push(
    diagnostics,
    manifest.promotionStage !== highestSupplied,
    'PROMOTION_STAGE_IDENTITY_MISMATCH',
    '$.promotionStage',
    'Promotion stage must identify the latest persisted run collection.',
  );
  const modeSatisfied =
    context.mode === 'final'
      ? highestAdmittedStage === 'friends-pc'
      : 'requireRunEvidence' in context
        ? runReadyForReview
        : highestAdmittedStage === context.requireAdmittedStage;
  const sortedGaps = [...coverageGaps].toSorted();
  const ok = diagnostics.length === 0 && modeSatisfied;
  return {
    ok,
    releaseReady: ok && context.mode === 'final' && sortedGaps.length === 0,
    highestAdmittedStage,
    runReadyForReview,
    pendingStages: [...new Set(pendingStages)],
    coverageGaps: sortedGaps,
    diagnostics,
  };
};

export const parsePhase6CliOptions = (args: readonly string[] | undefined): Phase6CliOptions => {
  const fail = (): never => {
    throw new Error(
      'Phase 6 CLI accepts only --mode planned with one canonical stage gate, or bare --mode final.',
    );
  };
  if (!Array.isArray(args)) return fail();
  if (args.length === 2 && args[0] === '--mode' && args[1] === 'final') return { mode: 'final' };
  if (args.length !== 4 || args[0] !== '--mode' || args[1] !== 'planned' || !isStage(args[3]))
    return fail();
  if (args[2] === '--require-run-evidence') return { mode: 'planned', requireRunEvidence: args[3] };
  if (args[2] === '--require-admitted-stage')
    return { mode: 'planned', requireAdmittedStage: args[3] };
  return fail();
};

const runCli = (): void => {
  let options: Phase6CliOptions;
  try {
    options = parsePhase6CliOptions(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : 'Phase 6 CLI arguments are invalid.'}\n`,
    );
    process.exitCode = 1;
    return;
  }
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
  const manifestPath = resolve(root, 'tooling/phase6-evidence/evidence-manifest.json');
  const input = JSON.parse(readFileSync(manifestPath, 'utf8')) as unknown;
  const manifest = asManifest(input);
  const artifactContents: Record<string, Uint8Array> = {};
  if (manifest !== null) {
    const references = [
      manifest.immutableBuild.artifact,
      ...manifest.stages.flatMap(({ runs }) => runs.flatMap(({ artifacts }) => artifacts)),
    ];
    for (const reference of references) {
      const absolute = resolve(root, reference.path);
      if (existsSync(absolute)) artifactContents[reference.path] = readFileSync(absolute);
    }
  }
  const result = evaluatePhase6Evidence(input, {
    ...options,
    evaluatedAt: new Date().toISOString(),
    artifactContents,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exitCode = 1;
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) runCli();
