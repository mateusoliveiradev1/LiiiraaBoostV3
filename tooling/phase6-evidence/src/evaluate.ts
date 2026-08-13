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

export const PHASE6_REQUIREMENTS = ['PLAN-01', 'PLAN-05', 'PLAN-06', 'PLAN-07', 'PLAN-08'] as const;

export const PHASE6_DECISIONS = Array.from(
  { length: 35 },
  (_, index) => `D-${String(index + 1).padStart(2, '0')}`,
);

export type Phase6PromotionStage = (typeof PHASE6_PROMOTION_STAGES)[number];
export type Phase6PhysicalStage = Exclude<Phase6PromotionStage, 'deterministic-simulation'>;

export interface Phase6ArtifactReference {
  path: string;
  sha256: string;
}

export interface Phase6RunEvidence {
  id: string;
  stage: Phase6PromotionStage;
  evidenceKind: 'deterministic' | 'physical';
  status: 'PASS' | 'FAIL';
  operationVersion: string;
  buildId: string;
  participantId: string;
  recordedAt: string;
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
  accessibility: {
    status: 'PASS' | 'FAIL';
    seriousOrCriticalViolations: number;
  };
  diagnostics: {
    redacted: boolean;
    previewed: boolean;
    consentBound: boolean;
    autoUpload: boolean;
    rawFieldsFound: string[];
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

export type Phase6HumanReview =
  | { status: 'pending' | 'not-required' }
  | {
      status: 'approved' | 'rejected';
      id: string;
      reviewerId: string;
      participantId: string;
      recordedAt: string;
      response: 'APPROVED' | 'REJECTED';
      verdict: 'APPROVED' | 'REJECTED';
      operationVersion: string;
      buildId: string;
      stage: Phase6PromotionStage;
      runEvidenceId: string;
      runEvidenceSha256: string;
      artifactHashes: string[];
    };

type Phase6DecidedReview = Extract<Phase6HumanReview, { status: 'approved' | 'rejected' }>;

export interface Phase6EvidenceManifest {
  schemaVersion: 1;
  generatedAt: string;
  operationVersion: string;
  immutableBuild: {
    id: string;
    commit: string;
    artifact: Phase6ArtifactReference;
  };
  promotionStage: Phase6PromotionStage;
  requirementsCoverage: string[];
  decisionCoverage: string[];
  stages: {
    stage: Phase6PromotionStage;
    predecessorStage: Phase6PromotionStage | null;
    runEvidence: Phase6RunEvidence | null;
    humanReview: Phase6HumanReview;
  }[];
}

export interface Phase6EvidenceDiagnostic {
  code: string;
  path: string;
  message: string;
}

export interface Phase6EvaluationContext {
  mode: 'planned' | 'final';
  evaluatedAt: string;
  artifactContents: Readonly<Record<string, string | Uint8Array>>;
  requireRunEvidence?: Phase6PromotionStage;
}

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
  ) {
    return null;
  }
  return value as unknown as Phase6ArtifactReference;
};

const asRun = (value: unknown): Phase6RunEvidence | null => {
  if (
    !isObject(value) ||
    !hasExactKeys(value, [
      'id',
      'stage',
      'evidenceKind',
      'status',
      'operationVersion',
      'buildId',
      'participantId',
      'recordedAt',
      'expiresAt',
      'artifacts',
      'cycle',
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
    ]) ||
    typeof value['id'] !== 'string' ||
    !isStage(value['stage']) ||
    !['deterministic', 'physical'].includes(String(value['evidenceKind'])) ||
    !['PASS', 'FAIL'].includes(String(value['status'])) ||
    typeof value['operationVersion'] !== 'string' ||
    typeof value['buildId'] !== 'string' ||
    typeof value['participantId'] !== 'string' ||
    typeof value['recordedAt'] !== 'string' ||
    typeof value['expiresAt'] !== 'string' ||
    !Array.isArray(value['artifacts']) ||
    value['artifacts'].some((artifact) => asArtifact(artifact) === null) ||
    !isObject(value['cycle']) ||
    !hasExactKeys(value['cycle'], [
      'prepare',
      'apply',
      'verifyApply',
      'restartRequired',
      'restart',
      'restore',
      'verifyRestore',
    ]) ||
    typeof value['cycle']['prepare'] !== 'string' ||
    typeof value['cycle']['apply'] !== 'string' ||
    typeof value['cycle']['verifyApply'] !== 'string' ||
    typeof value['cycle']['restartRequired'] !== 'boolean' ||
    typeof value['cycle']['restart'] !== 'string' ||
    typeof value['cycle']['restore'] !== 'string' ||
    typeof value['cycle']['verifyRestore'] !== 'string' ||
    typeof value['journalSha256'] !== 'string' ||
    typeof value['receiptSha256'] !== 'string' ||
    !isObject(value['security']) ||
    !hasExactKeys(value['security'], [
      'ipcAdversarial',
      'replayRejected',
      'identitySpoofRejected',
      'sessionSwapRejected',
    ]) ||
    typeof value['security']['ipcAdversarial'] !== 'string' ||
    typeof value['security']['replayRejected'] !== 'boolean' ||
    typeof value['security']['identitySpoofRejected'] !== 'boolean' ||
    typeof value['security']['sessionSwapRejected'] !== 'boolean' ||
    !isObject(value['faults']) ||
    !hasExactKeys(value['faults'], ['diskFull', 'crash', 'reboot', 'drift']) ||
    typeof value['faults']['diskFull'] !== 'string' ||
    typeof value['faults']['crash'] !== 'string' ||
    typeof value['faults']['reboot'] !== 'string' ||
    typeof value['faults']['drift'] !== 'string' ||
    !isObject(value['accessibility']) ||
    !hasExactKeys(value['accessibility'], ['status', 'seriousOrCriticalViolations']) ||
    typeof value['accessibility']['status'] !== 'string' ||
    typeof value['accessibility']['seriousOrCriticalViolations'] !== 'number' ||
    !isObject(value['diagnostics']) ||
    !hasExactKeys(value['diagnostics'], [
      'redacted',
      'previewed',
      'consentBound',
      'autoUpload',
      'rawFieldsFound',
    ]) ||
    typeof value['diagnostics']['redacted'] !== 'boolean' ||
    typeof value['diagnostics']['previewed'] !== 'boolean' ||
    typeof value['diagnostics']['consentBound'] !== 'boolean' ||
    typeof value['diagnostics']['autoUpload'] !== 'boolean' ||
    !Array.isArray(value['diagnostics']['rawFieldsFound']) ||
    value['diagnostics']['rawFieldsFound'].some((field) => typeof field !== 'string') ||
    !isObject(value['revocation']) ||
    !hasExactKeys(value['revocation'], [
      'signed',
      'blocksNewApply',
      'localRecoveryAvailable',
      'remoteRollback',
      'remoteExecution',
    ]) ||
    typeof value['revocation']['signed'] !== 'boolean' ||
    typeof value['revocation']['blocksNewApply'] !== 'boolean' ||
    typeof value['revocation']['localRecoveryAvailable'] !== 'boolean' ||
    typeof value['revocation']['remoteRollback'] !== 'boolean' ||
    typeof value['revocation']['remoteExecution'] !== 'boolean' ||
    !Array.isArray(value['coverageGaps']) ||
    value['coverageGaps'].some((gap) => typeof gap !== 'string') ||
    typeof value['universalSupportClaim'] !== 'boolean' ||
    typeof value['manualOverride'] !== 'boolean'
  ) {
    return null;
  }
  return value as unknown as Phase6RunEvidence;
};

const asReview = (value: unknown): Phase6HumanReview | null => {
  if (!isObject(value) || typeof value['status'] !== 'string') return null;
  if (value['status'] === 'pending' || value['status'] === 'not-required') {
    return hasExactKeys(value, ['status']) ? (value as Phase6HumanReview) : null;
  }
  if (
    !['approved', 'rejected'].includes(value['status']) ||
    !hasExactKeys(value, [
      'status',
      'id',
      'reviewerId',
      'participantId',
      'recordedAt',
      'response',
      'verdict',
      'operationVersion',
      'buildId',
      'stage',
      'runEvidenceId',
      'runEvidenceSha256',
      'artifactHashes',
    ]) ||
    typeof value['id'] !== 'string' ||
    typeof value['reviewerId'] !== 'string' ||
    typeof value['participantId'] !== 'string' ||
    typeof value['recordedAt'] !== 'string' ||
    !['APPROVED', 'REJECTED'].includes(String(value['response'])) ||
    !['APPROVED', 'REJECTED'].includes(String(value['verdict'])) ||
    typeof value['operationVersion'] !== 'string' ||
    typeof value['buildId'] !== 'string' ||
    !isStage(value['stage']) ||
    typeof value['runEvidenceId'] !== 'string' ||
    typeof value['runEvidenceSha256'] !== 'string' ||
    !Array.isArray(value['artifactHashes']) ||
    value['artifactHashes'].some((hash) => typeof hash !== 'string')
  ) {
    return null;
  }
  return value as unknown as Phase6HumanReview;
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
      'stages',
    ]) ||
    value['schemaVersion'] !== 1 ||
    typeof value['generatedAt'] !== 'string' ||
    typeof value['operationVersion'] !== 'string' ||
    !isObject(value['immutableBuild']) ||
    !hasExactKeys(value['immutableBuild'], ['id', 'commit', 'artifact']) ||
    typeof value['immutableBuild']['id'] !== 'string' ||
    typeof value['immutableBuild']['commit'] !== 'string' ||
    asArtifact(value['immutableBuild']['artifact']) === null ||
    !isStage(value['promotionStage']) ||
    !Array.isArray(value['requirementsCoverage']) ||
    !Array.isArray(value['decisionCoverage']) ||
    !Array.isArray(value['stages'])
  ) {
    return null;
  }
  for (const cell of value['stages']) {
    if (
      !isObject(cell) ||
      !hasExactKeys(cell, ['stage', 'predecessorStage', 'runEvidence', 'humanReview']) ||
      !isStage(cell['stage']) ||
      (cell['predecessorStage'] !== null && !isStage(cell['predecessorStage'])) ||
      (cell['runEvidence'] !== null && asRun(cell['runEvidence']) === null) ||
      asReview(cell['humanReview']) === null
    ) {
      return null;
    }
  }
  return value as unknown as Phase6EvidenceManifest;
};

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
  if (contents === undefined) {
    diagnostics.push(diagnostic('ARTIFACT_MISSING', path, 'Immutable artifact is missing.'));
  } else if (sha256(contents) !== artifact.sha256) {
    diagnostics.push(
      diagnostic('ARTIFACT_HASH_MISMATCH', path, 'Immutable artifact bytes changed.'),
    );
  }
};

const validateRun = (
  manifest: Phase6EvidenceManifest,
  run: Phase6RunEvidence,
  stage: Phase6PromotionStage,
  path: string,
  context: Phase6EvaluationContext,
  diagnostics: Phase6EvidenceDiagnostic[],
): boolean => {
  const before = diagnostics.length;
  const physical = stage !== 'deterministic-simulation';
  push(
    diagnostics,
    run.evidenceKind !== (physical ? 'physical' : 'deterministic'),
    physical ? 'SIMULATED_AS_PHYSICAL' : 'PHYSICAL_AS_SIMULATION',
    `${path}.evidenceKind`,
    'Evidence kind cannot be relabeled for another promotion environment.',
  );
  push(
    diagnostics,
    run.status !== 'PASS',
    'RUN_EVIDENCE_NOT_PASSED',
    `${path}.status`,
    'Run evidence must have a PASS status.',
  );
  push(
    diagnostics,
    run.operationVersion !== manifest.operationVersion,
    'OPERATION_VERSION_MISMATCH',
    `${path}.operationVersion`,
    'Run operation version differs from the manifest authority.',
  );
  push(
    diagnostics,
    run.buildId !== manifest.immutableBuild.id,
    'BUILD_ID_MISMATCH',
    `${path}.buildId`,
    'Run immutable build differs from the manifest authority.',
  );
  push(
    diagnostics,
    run.stage !== stage,
    'RUN_STAGE_MISMATCH',
    `${path}.stage`,
    'Run stage differs from its immutable stage cell.',
  );
  push(
    diagnostics,
    run.id.length === 0 || run.participantId.length === 0,
    'RUN_IDENTITY_MISSING',
    path,
    'Run and participant identities are required.',
  );
  push(
    diagnostics,
    !isIsoDate(run.recordedAt) || !isIsoDate(run.expiresAt),
    'RUN_TIMESTAMP_INVALID',
    path,
    'Run timestamps must be exact UTC-compatible date-times.',
  );
  if (isIsoDate(run.expiresAt) && isIsoDate(context.evaluatedAt)) {
    push(
      diagnostics,
      Date.parse(run.expiresAt) <= Date.parse(context.evaluatedAt),
      'RUN_EVIDENCE_STALE',
      `${path}.expiresAt`,
      'Expired evidence cannot authorize promotion.',
    );
  }
  if (isIsoDate(run.recordedAt) && isIsoDate(manifest.generatedAt)) {
    push(
      diagnostics,
      Date.parse(run.recordedAt) > Date.parse(manifest.generatedAt),
      'RUN_AFTER_MANIFEST',
      `${path}.recordedAt`,
      'Manifest cannot predate admitted run evidence.',
    );
  }
  push(
    diagnostics,
    run.artifacts.length < 2,
    'RUN_ARTIFACTS_INCOMPLETE',
    `${path}.artifacts`,
    'Run evidence requires packaged build and bounded evidence artifacts.',
  );
  const seenArtifacts = new Set<string>();
  for (const [index, artifact] of run.artifacts.entries()) {
    const artifactPath = `${path}.artifacts[${String(index)}]`;
    validateArtifact(artifact, artifactPath, context, diagnostics);
    push(
      diagnostics,
      seenArtifacts.has(artifact.path),
      'RUN_ARTIFACT_DUPLICATE',
      artifactPath,
      'Artifact paths must not repeat.',
    );
    seenArtifacts.add(artifact.path);
  }
  push(
    diagnostics,
    !run.artifacts.some(
      ({ path: artifactPath, sha256: hash }) =>
        artifactPath === manifest.immutableBuild.artifact.path &&
        hash === manifest.immutableBuild.artifact.sha256,
    ),
    'BUILD_ARTIFACT_BINDING_MISSING',
    `${path}.artifacts`,
    'Run evidence must bind the exact immutable build artifact.',
  );

  const cycleChecks = [
    ['prepare', run.cycle.prepare, 'PASS', 'CYCLE_PREPARE_NOT_PASSED'],
    ['apply', run.cycle.apply, 'PASS', 'CYCLE_APPLY_NOT_PASSED'],
    ['verifyApply', run.cycle.verifyApply, 'PASS', 'CYCLE_VERIFY_APPLY_NOT_PASSED'],
    [
      'restart',
      run.cycle.restart,
      run.cycle.restartRequired ? 'PASS' : 'NOT_REQUIRED',
      'CYCLE_RESTART_NOT_PASSED',
    ],
    ['restore', run.cycle.restore, 'PASS', 'CYCLE_RESTORE_NOT_PASSED'],
    ['verifyRestore', run.cycle.verifyRestore, 'PASS', 'CYCLE_VERIFY_RESTORE_NOT_PASSED'],
  ] as const;
  for (const [field, actual, expected, code] of cycleChecks) {
    push(
      diagnostics,
      actual !== expected,
      code,
      `${path}.cycle.${field}`,
      `Complete recovery cycle requires ${field}=${expected}.`,
    );
  }
  push(
    diagnostics,
    !HASH_PATTERN.test(run.journalSha256),
    'JOURNAL_HASH_INVALID',
    `${path}.journalSha256`,
    'Journal evidence requires an exact SHA-256.',
  );
  push(
    diagnostics,
    !HASH_PATTERN.test(run.receiptSha256),
    'RECEIPT_HASH_INVALID',
    `${path}.receiptSha256`,
    'Receipt evidence requires an exact SHA-256.',
  );

  const exactChecks = [
    [
      run.security.ipcAdversarial !== 'PASS',
      'IPC_ADVERSARIAL_NOT_PASSED',
      'security.ipcAdversarial',
    ],
    [!run.security.replayRejected, 'IPC_REPLAY_NOT_REJECTED', 'security.replayRejected'],
    [
      !run.security.identitySpoofRejected,
      'IPC_IDENTITY_SPOOF_NOT_REJECTED',
      'security.identitySpoofRejected',
    ],
    [
      !run.security.sessionSwapRejected,
      'IPC_SESSION_SWAP_NOT_REJECTED',
      'security.sessionSwapRejected',
    ],
    [run.faults.diskFull !== 'PASS', 'FAULT_DISK_FULL_NOT_PASSED', 'faults.diskFull'],
    [run.faults.crash !== 'PASS', 'FAULT_CRASH_NOT_PASSED', 'faults.crash'],
    [run.faults.reboot !== 'PASS', 'FAULT_REBOOT_NOT_PASSED', 'faults.reboot'],
    [run.faults.drift !== 'PASS', 'FAULT_DRIFT_NOT_PASSED', 'faults.drift'],
    [run.accessibility.status !== 'PASS', 'ACCESSIBILITY_NOT_PASSED', 'accessibility.status'],
    [
      run.accessibility.seriousOrCriticalViolations !== 0,
      'ACCESSIBILITY_VIOLATIONS_FOUND',
      'accessibility.seriousOrCriticalViolations',
    ],
    [!run.diagnostics.redacted, 'DIAGNOSTICS_NOT_REDACTED', 'diagnostics.redacted'],
    [!run.diagnostics.previewed, 'DIAGNOSTICS_NOT_PREVIEWED', 'diagnostics.previewed'],
    [!run.diagnostics.consentBound, 'DIAGNOSTICS_CONSENT_MISSING', 'diagnostics.consentBound'],
    [run.diagnostics.autoUpload, 'DIAGNOSTICS_AUTO_UPLOAD_FORBIDDEN', 'diagnostics.autoUpload'],
    [
      run.diagnostics.rawFieldsFound.length > 0,
      'DIAGNOSTICS_RAW_DATA_LEAK',
      'diagnostics.rawFieldsFound',
    ],
    [!run.revocation.signed, 'REVOCATION_NOT_SIGNED', 'revocation.signed'],
    [!run.revocation.blocksNewApply, 'REVOCATION_APPLY_NOT_BLOCKED', 'revocation.blocksNewApply'],
    [
      !run.revocation.localRecoveryAvailable,
      'REVOCATION_RECOVERY_BLOCKED',
      'revocation.localRecoveryAvailable',
    ],
    [
      run.revocation.remoteRollback,
      'REVOCATION_REMOTE_ROLLBACK_FORBIDDEN',
      'revocation.remoteRollback',
    ],
    [
      run.revocation.remoteExecution,
      'REVOCATION_REMOTE_EXECUTION_FORBIDDEN',
      'revocation.remoteExecution',
    ],
    [run.manualOverride, 'MANUAL_OVERRIDE_FORBIDDEN', 'manualOverride'],
    [run.universalSupportClaim, 'UNIVERSAL_SUPPORT_CLAIM_FORBIDDEN', 'universalSupportClaim'],
  ] as const;
  for (const [failed, code, suffix] of exactChecks) {
    push(
      diagnostics,
      failed,
      code,
      `${path}.${suffix}`,
      'Required fail-closed evidence field has an unsafe value.',
    );
  }
  push(
    diagnostics,
    run.coverageGaps.length === 0 || run.coverageGaps.some((gap) => gap.length === 0),
    'COVERAGE_GAPS_MISSING',
    `${path}.coverageGaps`,
    'Bounded evidence must preserve explicit physical coverage gaps.',
  );
  return diagnostics.length === before;
};

const validateReview = (
  manifest: Phase6EvidenceManifest,
  run: Phase6RunEvidence,
  review: Phase6HumanReview,
  stage: Phase6PhysicalStage,
  path: string,
  diagnostics: Phase6EvidenceDiagnostic[],
): boolean => {
  const before = diagnostics.length;
  if (review.status === 'pending' || review.status === 'not-required') return false;
  if (review.status === 'rejected') {
    diagnostics.push(
      diagnostic('HUMAN_REVIEW_REJECTED', `${path}.status`, 'Rejected evidence cannot promote.'),
    );
    return false;
  }
  const approvedReview = review as Phase6DecidedReview;
  push(
    diagnostics,
    approvedReview.response !== 'APPROVED' || approvedReview.verdict !== 'APPROVED',
    'HUMAN_REVIEW_NOT_APPROVED',
    path,
    'Review response and verdict must both be exactly APPROVED.',
  );
  push(
    diagnostics,
    approvedReview.id.length === 0 ||
      approvedReview.reviewerId.length === 0 ||
      approvedReview.participantId.length === 0,
    'REVIEW_IDENTITY_MISSING',
    path,
    'Review, reviewer, and participant identities are required.',
  );
  push(
    diagnostics,
    approvedReview.operationVersion !== manifest.operationVersion ||
      approvedReview.operationVersion !== run.operationVersion,
    'REVIEW_OPERATION_VERSION_MISMATCH',
    `${path}.operationVersion`,
    'Review must bind the exact run operation version.',
  );
  push(
    diagnostics,
    approvedReview.buildId !== manifest.immutableBuild.id || approvedReview.buildId !== run.buildId,
    'REVIEW_BUILD_ID_MISMATCH',
    `${path}.buildId`,
    'Review must bind the exact immutable build.',
  );
  push(
    diagnostics,
    approvedReview.stage !== stage || approvedReview.stage !== run.stage,
    'REVIEW_STAGE_MISMATCH',
    `${path}.stage`,
    'Review must bind the exact physical stage.',
  );
  push(
    diagnostics,
    approvedReview.runEvidenceId !== run.id,
    'REVIEW_RUN_ID_MISMATCH',
    `${path}.runEvidenceId`,
    'Review must bind the exact persisted run ID.',
  );
  push(
    diagnostics,
    approvedReview.participantId !== run.participantId,
    'REVIEW_PARTICIPANT_MISMATCH',
    `${path}.participantId`,
    'Review participant must match the physical run.',
  );
  push(
    diagnostics,
    approvedReview.runEvidenceSha256 !== phase6EvidenceSha256(run),
    'REVIEW_RUN_HASH_MISMATCH',
    `${path}.runEvidenceSha256`,
    'Review must bind the canonical immutable run bytes.',
  );
  push(
    diagnostics,
    canonicalPhase6Evidence(approvedReview.artifactHashes) !==
      canonicalPhase6Evidence(run.artifacts.map(({ sha256: hash }) => hash)),
    'REVIEW_ARTIFACT_HASH_MISMATCH',
    `${path}.artifactHashes`,
    'Review artifact hashes must exactly match the persisted run.',
  );
  push(
    diagnostics,
    !isIsoDate(approvedReview.recordedAt),
    'REVIEW_TIMESTAMP_INVALID',
    `${path}.recordedAt`,
    'Review timestamp must be an exact UTC-compatible date-time.',
  );
  if (isIsoDate(approvedReview.recordedAt) && isIsoDate(run.recordedAt)) {
    push(
      diagnostics,
      Date.parse(approvedReview.recordedAt) <= Date.parse(run.recordedAt),
      'REVIEW_NOT_AFTER_RUN',
      `${path}.recordedAt`,
      'Human review must be persisted strictly after run evidence.',
    );
  }
  if (isIsoDate(approvedReview.recordedAt) && isIsoDate(manifest.generatedAt)) {
    push(
      diagnostics,
      Date.parse(approvedReview.recordedAt) > Date.parse(manifest.generatedAt),
      'REVIEW_AFTER_MANIFEST',
      `${path}.recordedAt`,
      'Manifest cannot predate its human review.',
    );
  }
  return diagnostics.length === before;
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

export const evaluatePhase6Evidence = (
  input: unknown,
  context: Phase6EvaluationContext,
): Phase6EvidenceResult => {
  const diagnostics: Phase6EvidenceDiagnostic[] = [];
  const manifest = asManifest(input);
  if (manifest === null) {
    return invalidResult([
      diagnostic(
        'EVIDENCE_MANIFEST_INVALID',
        '$',
        'Manifest does not satisfy the closed Phase 6 evidence schema.',
      ),
    ]);
  }
  if (!isIsoDate(context.evaluatedAt) || !isIsoDate(manifest.generatedAt)) {
    diagnostics.push(
      diagnostic('EVIDENCE_TIMESTAMP_INVALID', '$.generatedAt', 'Exact timestamps are required.'),
    );
  }
  push(
    diagnostics,
    manifest.operationVersion.length === 0,
    'OPERATION_VERSION_MISSING',
    '$.operationVersion',
    'Operation version is required.',
  );
  push(
    diagnostics,
    manifest.immutableBuild.id.length === 0 || !COMMIT_PATTERN.test(manifest.immutableBuild.commit),
    'IMMUTABLE_BUILD_INVALID',
    '$.immutableBuild',
    'Immutable build ID and exact commit are required.',
  );
  validateArtifact(
    manifest.immutableBuild.artifact,
    '$.immutableBuild.artifact',
    context,
    diagnostics,
  );

  for (const requirement of PHASE6_REQUIREMENTS) {
    push(
      diagnostics,
      !manifest.requirementsCoverage.includes(requirement),
      'REQUIREMENT_COVERAGE_MISSING',
      '$.requirementsCoverage',
      `Required coverage reference ${requirement} is missing.`,
    );
  }
  for (const decision of PHASE6_DECISIONS) {
    push(
      diagnostics,
      !manifest.decisionCoverage.includes(decision),
      'DECISION_COVERAGE_MISSING',
      '$.decisionCoverage',
      `Decision coverage reference ${decision} is missing.`,
    );
  }
  push(
    diagnostics,
    new Set(manifest.requirementsCoverage).size !== manifest.requirementsCoverage.length ||
      manifest.requirementsCoverage.some((id) => !PHASE6_REQUIREMENTS.includes(id as never)),
    'REQUIREMENT_COVERAGE_INVALID',
    '$.requirementsCoverage',
    'Requirement coverage must be the exact closed set.',
  );
  push(
    diagnostics,
    new Set(manifest.decisionCoverage).size !== manifest.decisionCoverage.length ||
      manifest.decisionCoverage.some((id) => !PHASE6_DECISIONS.includes(id)),
    'DECISION_COVERAGE_INVALID',
    '$.decisionCoverage',
    'Decision coverage must be the exact D-01 through D-35 set.',
  );

  const sequenceValid =
    manifest.stages.length === PHASE6_PROMOTION_STAGES.length &&
    manifest.stages.every((cell, index) => {
      const expectedStage = PHASE6_PROMOTION_STAGES.at(index);
      const expectedPredecessor =
        index === 0 ? null : (PHASE6_PROMOTION_STAGES.at(index - 1) ?? null);
      return (
        expectedStage !== undefined &&
        cell.stage === expectedStage &&
        cell.predecessorStage === expectedPredecessor
      );
    });
  push(
    diagnostics,
    !sequenceValid,
    'PROMOTION_STAGE_SEQUENCE_INVALID',
    '$.stages',
    'All four stage cells and exact predecessor identities are required in order.',
  );
  if (!sequenceValid) return invalidResult(diagnostics);

  let highestAdmittedStage: Phase6PromotionStage | null = null;
  let predecessorAdmitted = true;
  let runReadyForReview = false;
  const pendingStages: Phase6PromotionStage[] = [];
  const coverageGaps = new Set<string>();
  let highestSuppliedStage: Phase6PromotionStage = 'deterministic-simulation';

  for (const [index, cell] of manifest.stages.entries()) {
    const stage = cell.stage;
    const cellPath = `$.stages[${String(index)}]`;
    const run = cell.runEvidence;
    if (run === null) {
      if (
        stage !== 'deterministic-simulation' &&
        (context.mode === 'final' || context.requireRunEvidence === stage)
      ) {
        diagnostics.push(
          diagnostic(
            'PHYSICAL_RUN_EVIDENCE_MISSING',
            `${cellPath}.runEvidence`,
            `Physical stage ${stage} requires already-persisted exact run evidence.`,
          ),
        );
      }
      if (cell.humanReview.status === 'approved' || cell.humanReview.status === 'rejected') {
        diagnostics.push(
          diagnostic(
            'REVIEW_WITHOUT_RUN',
            `${cellPath}.humanReview`,
            'Human review cannot replace persisted run evidence.',
          ),
        );
      }
      pendingStages.push(stage);
      predecessorAdmitted = false;
      continue;
    }
    highestSuppliedStage = stage;
    const runValid = validateRun(
      manifest,
      run,
      stage,
      `${cellPath}.runEvidence`,
      context,
      diagnostics,
    );
    for (const gap of run.coverageGaps) coverageGaps.add(gap);
    if (!predecessorAdmitted) {
      diagnostics.push(
        diagnostic(
          'PROMOTION_STAGE_SKIPPED',
          cellPath,
          `${stage} cannot precede an unadmitted earlier stage.`,
        ),
      );
    }

    let reviewValid = stage === 'deterministic-simulation';
    if (stage === 'deterministic-simulation') {
      push(
        diagnostics,
        cell.humanReview.status !== 'not-required',
        'SIMULATION_REVIEW_INVALID',
        `${cellPath}.humanReview`,
        'Deterministic simulation cannot carry physical human approval.',
      );
    } else if (context.requireRunEvidence === stage) {
      push(
        diagnostics,
        cell.humanReview.status !== 'pending',
        'RUN_REVIEW_ALREADY_DECIDED',
        `${cellPath}.humanReview.status`,
        'Run-evidence collection requires an explicitly pending later review.',
      );
      runReadyForReview = runValid && predecessorAdmitted && cell.humanReview.status === 'pending';
    } else if (
      cell.humanReview.status === 'pending' ||
      cell.humanReview.status === 'not-required'
    ) {
      if (context.mode === 'final') {
        diagnostics.push(
          diagnostic(
            'HUMAN_REVIEW_PENDING',
            `${cellPath}.humanReview.status`,
            'Physical stage requires a later explicit human review.',
          ),
        );
      }
    } else {
      reviewValid = validateReview(
        manifest,
        run,
        cell.humanReview,
        stage,
        `${cellPath}.humanReview`,
        diagnostics,
      );
    }

    const admitted: boolean = runValid && predecessorAdmitted && reviewValid;
    if (admitted) {
      highestAdmittedStage = stage;
    } else {
      pendingStages.push(stage);
    }
    predecessorAdmitted = admitted;
  }

  push(
    diagnostics,
    manifest.promotionStage !== highestSuppliedStage,
    'PROMOTION_STAGE_IDENTITY_MISMATCH',
    '$.promotionStage',
    'Promotion stage must identify the latest stage carrying persisted run evidence.',
  );

  const requireStage = context.requireRunEvidence;
  const plannedAdmission =
    highestAdmittedStage === 'deterministic-simulation' ||
    PHASE6_PROMOTION_STAGES.indexOf(highestAdmittedStage ?? 'deterministic-simulation') > 0;
  const modeSatisfied =
    requireStage === undefined
      ? context.mode === 'planned'
        ? plannedAdmission
        : highestAdmittedStage === 'friends-pc'
      : runReadyForReview;
  const sortedGaps = [...coverageGaps].toSorted();
  const ok = diagnostics.length === 0 && modeSatisfied;
  return {
    ok,
    releaseReady:
      ok &&
      context.mode === 'final' &&
      highestAdmittedStage === 'friends-pc' &&
      sortedGaps.length === 0,
    highestAdmittedStage,
    runReadyForReview,
    pendingStages,
    coverageGaps: sortedGaps,
    diagnostics,
  };
};

const parseArgument = (args: readonly string[], name: string): string | undefined => {
  const equals = args.find((argument) => argument.startsWith(`${name}=`));
  if (equals !== undefined) return equals.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const runCli = (): void => {
  const args = process.argv.slice(2);
  const mode = parseArgument(args, '--mode') === 'final' ? 'final' : 'planned';
  const requiredStageInput = parseArgument(args, '--require-run-evidence');
  const requireRunEvidence = isStage(requiredStageInput) ? requiredStageInput : undefined;
  if (requiredStageInput !== undefined && requireRunEvidence === undefined) {
    process.stderr.write(`Unknown Phase 6 promotion stage: ${requiredStageInput}\n`);
    process.exitCode = 1;
    return;
  }
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
  const manifestPath = resolve(root, 'tooling/phase6-evidence/evidence-manifest.json');
  const manifestInput = JSON.parse(readFileSync(manifestPath, 'utf8')) as unknown;
  const manifest = asManifest(manifestInput);
  const artifactContents: Record<string, Uint8Array> = {};
  if (manifest !== null) {
    const references = [
      manifest.immutableBuild.artifact,
      ...manifest.stages.flatMap(({ runEvidence }) => runEvidence?.artifacts ?? []),
    ];
    for (const reference of references) {
      const absolute = resolve(root, reference.path);
      if (existsSync(absolute)) artifactContents[reference.path] = readFileSync(absolute);
    }
  }
  const result = evaluatePhase6Evidence(manifestInput, {
    mode,
    evaluatedAt: new Date().toISOString(),
    artifactContents,
    ...(requireRunEvidence === undefined ? {} : { requireRunEvidence }),
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exitCode = 1;
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) runCli();
