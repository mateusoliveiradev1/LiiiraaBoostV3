import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

type Stage = 'deterministic-simulation' | 'clean-windows-vm' | 'owner-pc' | 'friends-pc';
type Mode = 'planned' | 'final';

interface Diagnostic {
  code: string;
  path: string;
  message: string;
}

interface Result {
  ok: boolean;
  releaseReady: boolean;
  highestAdmittedStage: Stage | null;
  runReadyForReview: boolean;
  pendingStages: Stage[];
  coverageGaps: string[];
  diagnostics: Diagnostic[];
}

interface Context {
  mode: Mode;
  evaluatedAt: string;
  artifactContents: Readonly<Record<string, string | Uint8Array>>;
  requireRunEvidence?: Stage;
}

type Evaluator = (manifest: unknown, context: Context) => Result;

const missingEvaluator: Evaluator = () => ({
  ok: false,
  releaseReady: false,
  highestAdmittedStage: null,
  runReadyForReview: false,
  pendingStages: [],
  coverageGaps: [],
  diagnostics: [
    {
      code: 'EVALUATOR_NOT_IMPLEMENTED',
      path: '$',
      message: 'Phase 6 evidence evaluator is not implemented.',
    },
  ],
});

const moduleUrl = new URL('../src/evaluate.ts', import.meta.url).href;
const loaded = (await import(/* @vite-ignore */ moduleUrl).catch(() => ({
  evaluatePhase6Evidence: missingEvaluator,
}))) as { evaluatePhase6Evidence: Evaluator };
const { evaluatePhase6Evidence } = loaded;

const sha256 = (value: string | Uint8Array): string =>
  createHash('sha256').update(value).digest('hex');

const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .toSorted(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${canonical(nested)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
};

const STAGES = ['deterministic-simulation', 'clean-windows-vm', 'owner-pc', 'friends-pc'] as const;
const REQUIREMENTS = ['PLAN-01', 'PLAN-05', 'PLAN-06', 'PLAN-07', 'PLAN-08'] as const;
const DECISIONS = Array.from(
  { length: 35 },
  (_, index) => `D-${String(index + 1).padStart(2, '0')}`,
);
const buildBytes = 'phase-6 immutable packaged build';
const evidenceBytes = 'phase-6 bounded deterministic evidence';
const buildPath = 'artifacts/liiiraa-boost-phase6.exe';
const evidencePath = 'evidence/phase6-cycle.json';

const runEvidence = (stage: Stage, evidenceKind: 'deterministic' | 'physical') => ({
  id: `run-${stage}`,
  stage,
  evidenceKind,
  status: 'PASS',
  operationVersion: 'power-scheme@1.0.0',
  buildId: 'phase6-build-001',
  participantId: evidenceKind === 'physical' ? `participant-${stage}` : 'deterministic-runner',
  recordedAt: '2030-01-15T18:00:00.000Z',
  expiresAt: '2031-01-15T18:00:00.000Z',
  artifacts: [
    { path: buildPath, sha256: sha256(buildBytes) },
    { path: evidencePath, sha256: sha256(evidenceBytes) },
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
  journalSha256: sha256(`journal-${stage}`),
  receiptSha256: sha256(`receipt-${stage}`),
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
    rawFieldsFound: [] as string[],
  },
  revocation: {
    signed: true,
    blocksNewApply: true,
    localRecoveryAvailable: true,
    remoteRollback: false,
    remoteExecution: false,
  },
  coverageGaps: ['windows-10-hardware-matrix', 'additional-friends-hardware'],
  universalSupportClaim: false,
  manualOverride: false,
});

type RunEvidence = ReturnType<typeof runEvidence>;

const approvedReview = (run: RunEvidence) => ({
  status: 'approved',
  id: `review-${run.stage}`,
  reviewerId: `reviewer-${run.stage}`,
  participantId: run.participantId,
  recordedAt: '2030-01-15T19:00:00.000Z',
  response: 'APPROVED',
  verdict: 'APPROVED',
  operationVersion: run.operationVersion,
  buildId: run.buildId,
  stage: run.stage,
  runEvidenceId: run.id,
  runEvidenceSha256: sha256(canonical(run)),
  artifactHashes: run.artifacts.map(({ sha256: hash }) => hash),
});

const validManifest = () => {
  const deterministic = runEvidence('deterministic-simulation', 'deterministic');
  return {
    schemaVersion: 1,
    generatedAt: '2030-01-15T20:00:00.000Z',
    operationVersion: 'power-scheme@1.0.0',
    immutableBuild: {
      id: 'phase6-build-001',
      commit: '51770454aa1d17647c4fe734ae1e57f3e0b403b0',
      artifact: { path: buildPath, sha256: sha256(buildBytes) },
    },
    promotionStage: 'deterministic-simulation',
    requirementsCoverage: [...REQUIREMENTS],
    decisionCoverage: [...DECISIONS],
    stages: [
      {
        stage: 'deterministic-simulation',
        predecessorStage: null,
        runEvidence: deterministic,
        humanReview: { status: 'not-required' },
      },
      {
        stage: 'clean-windows-vm',
        predecessorStage: 'deterministic-simulation',
        runEvidence: null,
        humanReview: { status: 'pending' },
      },
      {
        stage: 'owner-pc',
        predecessorStage: 'clean-windows-vm',
        runEvidence: null,
        humanReview: { status: 'pending' },
      },
      {
        stage: 'friends-pc',
        predecessorStage: 'owner-pc',
        runEvidence: null,
        humanReview: { status: 'pending' },
      },
    ],
  };
};

type Manifest = ReturnType<typeof validManifest>;
type StageCell = Manifest['stages'][number];

const context = (overrides: Partial<Context> = {}): Context => ({
  mode: 'planned',
  evaluatedAt: '2030-01-16T00:00:00.000Z',
  artifactContents: { [buildPath]: buildBytes, [evidencePath]: evidenceBytes },
  ...overrides,
});

const codes = (result: Result): string[] => result.diagnostics.map(({ code }) => code);

const withPhysicalStage = (
  manifest: Manifest,
  stage: Exclude<Stage, 'deterministic-simulation'>,
  review: 'pending' | 'approved' = 'approved',
): RunEvidence => {
  const cell = manifest.stages[STAGES.indexOf(stage)] as StageCell;
  const run = runEvidence(stage, 'physical');
  cell.runEvidence = run as StageCell['runEvidence'];
  cell.humanReview = (review === 'approved' ? approvedReview(run) : { status: 'pending' }) as never;
  manifest.promotionStage = stage;
  return run;
};

const fullyReviewedManifest = (): Manifest => {
  const manifest = validManifest();
  withPhysicalStage(manifest, 'clean-windows-vm');
  withPhysicalStage(manifest, 'owner-pc');
  withPhysicalStage(manifest, 'friends-pc');
  return manifest;
};

describe('Phase 6 exact-version sequential evidence authority', () => {
  it('admits only deterministic simulation in planned mode and names every physical blocker', () => {
    const result = evaluatePhase6Evidence(validManifest(), context());

    expect(result.ok).toBe(true);
    expect(result.highestAdmittedStage).toBe('deterministic-simulation');
    expect(result.pendingStages).toEqual(['clean-windows-vm', 'owner-pc', 'friends-pc']);
    expect(result.releaseReady).toBe(false);
    expect(result.diagnostics).toEqual([]);
  });

  it('reports each missing physical run explicitly in final mode', () => {
    const result = evaluatePhase6Evidence(validManifest(), context({ mode: 'final' }));

    expect(result.ok).toBe(false);
    expect(codes(result).filter((code) => code === 'PHYSICAL_RUN_EVIDENCE_MISSING')).toHaveLength(
      3,
    );
    expect(result.pendingStages).toEqual(['clean-windows-vm', 'owner-pc', 'friends-pc']);
  });

  it('accepts persisted physical run evidence for later review without admitting the stage', () => {
    const manifest = validManifest();
    withPhysicalStage(manifest, 'clean-windows-vm', 'pending');

    const result = evaluatePhase6Evidence(
      manifest,
      context({ requireRunEvidence: 'clean-windows-vm' }),
    );

    expect(result.ok).toBe(true);
    expect(result.runReadyForReview).toBe(true);
    expect(result.highestAdmittedStage).toBe('deterministic-simulation');
    expect(result.pendingStages).toContain('clean-windows-vm');
  });

  it('admits exact physical stages only after later matching APPROVED reviews', () => {
    const result = evaluatePhase6Evidence(fullyReviewedManifest(), context({ mode: 'final' }));

    expect(result.ok).toBe(true);
    expect(result.highestAdmittedStage).toBe('friends-pc');
    expect(result.pendingStages).toEqual([]);
    expect(result.coverageGaps).toEqual([
      'additional-friends-hardware',
      'windows-10-hardware-matrix',
    ]);
    expect(result.releaseReady).toBe(false);
  });

  it('does not let approval transform deterministic composition into physical evidence', () => {
    const manifest = validManifest();
    const cell = manifest.stages[1]!;
    const simulated = runEvidence('clean-windows-vm', 'deterministic');
    cell.runEvidence = simulated as never;
    cell.humanReview = approvedReview(simulated) as never;
    manifest.promotionStage = 'clean-windows-vm';

    expect(codes(evaluatePhase6Evidence(manifest, context({ mode: 'final' })))).toContain(
      'SIMULATED_AS_PHYSICAL',
    );
  });

  it('rejects an approved review without persisted run evidence', () => {
    const manifest = validManifest();
    const run = runEvidence('clean-windows-vm', 'physical');
    manifest.stages[1]!.humanReview = approvedReview(run) as never;
    manifest.promotionStage = 'clean-windows-vm';

    expect(codes(evaluatePhase6Evidence(manifest, context({ mode: 'final' })))).toContain(
      'REVIEW_WITHOUT_RUN',
    );
  });

  it('rejects a persisted physical run without an approved final review', () => {
    const manifest = validManifest();
    withPhysicalStage(manifest, 'clean-windows-vm', 'pending');

    expect(codes(evaluatePhase6Evidence(manifest, context({ mode: 'final' })))).toContain(
      'HUMAN_REVIEW_PENDING',
    );
  });

  it('rejects an explicit human rejection', () => {
    const manifest = validManifest();
    const run = withPhysicalStage(manifest, 'clean-windows-vm');
    manifest.stages[1]!.humanReview = {
      ...approvedReview(run),
      status: 'rejected',
      response: 'REJECTED',
      verdict: 'REJECTED',
    } as never;

    expect(codes(evaluatePhase6Evidence(manifest, context({ mode: 'final' })))).toContain(
      'HUMAN_REVIEW_REJECTED',
    );
  });

  it('rejects a review bound to another immutable run hash', () => {
    const manifest = validManifest();
    const run = withPhysicalStage(manifest, 'clean-windows-vm');
    manifest.stages[1]!.humanReview = {
      ...approvedReview(run),
      runEvidenceSha256: sha256('another run'),
    } as never;

    expect(codes(evaluatePhase6Evidence(manifest, context({ mode: 'final' })))).toContain(
      'REVIEW_RUN_HASH_MISMATCH',
    );
  });

  it('rejects skipped physical predecessors', () => {
    const manifest = validManifest();
    withPhysicalStage(manifest, 'owner-pc');

    expect(codes(evaluatePhase6Evidence(manifest, context({ mode: 'final' })))).toContain(
      'PROMOTION_STAGE_SKIPPED',
    );
  });

  it.each([
    ['operationVersion', 'power-scheme@2.0.0', 'OPERATION_VERSION_MISMATCH'],
    ['buildId', 'another-build', 'BUILD_ID_MISMATCH'],
    ['stage', 'owner-pc', 'RUN_STAGE_MISMATCH'],
  ] as const)('rejects mixed %s authority', (field, value, code) => {
    const manifest = validManifest();
    const run = withPhysicalStage(manifest, 'clean-windows-vm');
    (run as unknown as Record<string, unknown>)[field] = value;
    manifest.stages[1]!.humanReview = approvedReview(run) as never;

    expect(codes(evaluatePhase6Evidence(manifest, context({ mode: 'final' })))).toContain(code);
  });

  it.each([
    ['prepare', 'CYCLE_PREPARE_NOT_PASSED'],
    ['apply', 'CYCLE_APPLY_NOT_PASSED'],
    ['verifyApply', 'CYCLE_VERIFY_APPLY_NOT_PASSED'],
    ['restart', 'CYCLE_RESTART_NOT_PASSED'],
    ['restore', 'CYCLE_RESTORE_NOT_PASSED'],
    ['verifyRestore', 'CYCLE_VERIFY_RESTORE_NOT_PASSED'],
  ] as const)('rejects incomplete %s recovery-cycle evidence', (field, expected) => {
    const manifest = validManifest();
    const run = manifest.stages[0]!.runEvidence!;
    (run.cycle as unknown as Record<string, unknown>)[field] = 'FAIL';

    expect(codes(evaluatePhase6Evidence(manifest, context()))).toContain(expected);
  });

  it.each([
    ['journalSha256', '', 'JOURNAL_HASH_INVALID'],
    ['receiptSha256', '', 'RECEIPT_HASH_INVALID'],
  ] as const)('rejects invalid %s proof', (field, value, code) => {
    const manifest = validManifest();
    (manifest.stages[0]!.runEvidence as unknown as Record<string, unknown>)[field] = value;
    expect(codes(evaluatePhase6Evidence(manifest, context()))).toContain(code);
  });

  it.each([
    ['ipcAdversarial', 'FAIL', 'IPC_ADVERSARIAL_NOT_PASSED'],
    ['replayRejected', false, 'IPC_REPLAY_NOT_REJECTED'],
    ['identitySpoofRejected', false, 'IPC_IDENTITY_SPOOF_NOT_REJECTED'],
    ['sessionSwapRejected', false, 'IPC_SESSION_SWAP_NOT_REJECTED'],
  ] as const)('rejects security proof mutation %s', (field, value, code) => {
    const manifest = validManifest();
    (manifest.stages[0]!.runEvidence!.security as unknown as Record<string, unknown>)[field] =
      value;
    expect(codes(evaluatePhase6Evidence(manifest, context()))).toContain(code);
  });

  it.each([
    ['diskFull', 'FAULT_DISK_FULL_NOT_PASSED'],
    ['crash', 'FAULT_CRASH_NOT_PASSED'],
    ['reboot', 'FAULT_REBOOT_NOT_PASSED'],
    ['drift', 'FAULT_DRIFT_NOT_PASSED'],
  ] as const)('rejects missing %s fault evidence', (field, code) => {
    const manifest = validManifest();
    (manifest.stages[0]!.runEvidence!.faults as unknown as Record<string, unknown>)[field] = 'FAIL';
    expect(codes(evaluatePhase6Evidence(manifest, context()))).toContain(code);
  });

  it('rejects failed accessibility evidence', () => {
    const manifest = validManifest();
    manifest.stages[0]!.runEvidence!.accessibility.status = 'FAIL';
    manifest.stages[0]!.runEvidence!.accessibility.seriousOrCriticalViolations = 1;

    expect(codes(evaluatePhase6Evidence(manifest, context()))).toEqual(
      expect.arrayContaining(['ACCESSIBILITY_NOT_PASSED', 'ACCESSIBILITY_VIOLATIONS_FOUND']),
    );
  });

  it.each([
    ['redacted', false, 'DIAGNOSTICS_NOT_REDACTED'],
    ['previewed', false, 'DIAGNOSTICS_NOT_PREVIEWED'],
    ['consentBound', false, 'DIAGNOSTICS_CONSENT_MISSING'],
    ['autoUpload', true, 'DIAGNOSTICS_AUTO_UPLOAD_FORBIDDEN'],
  ] as const)('rejects privacy mutation %s', (field, value, code) => {
    const manifest = validManifest();
    (manifest.stages[0]!.runEvidence!.diagnostics as unknown as Record<string, unknown>)[field] =
      value;
    expect(codes(evaluatePhase6Evidence(manifest, context()))).toContain(code);
  });

  it('rejects forbidden raw diagnostic fields', () => {
    const manifest = validManifest();
    manifest.stages[0]!.runEvidence!.diagnostics.rawFieldsFound = ['MachineGuid'];
    expect(codes(evaluatePhase6Evidence(manifest, context()))).toContain(
      'DIAGNOSTICS_RAW_DATA_LEAK',
    );
  });

  it.each([
    ['signed', false, 'REVOCATION_NOT_SIGNED'],
    ['blocksNewApply', false, 'REVOCATION_APPLY_NOT_BLOCKED'],
    ['localRecoveryAvailable', false, 'REVOCATION_RECOVERY_BLOCKED'],
    ['remoteRollback', true, 'REVOCATION_REMOTE_ROLLBACK_FORBIDDEN'],
    ['remoteExecution', true, 'REVOCATION_REMOTE_EXECUTION_FORBIDDEN'],
  ] as const)('rejects revocation mutation %s', (field, value, code) => {
    const manifest = validManifest();
    (manifest.stages[0]!.runEvidence!.revocation as unknown as Record<string, unknown>)[field] =
      value;
    expect(codes(evaluatePhase6Evidence(manifest, context()))).toContain(code);
  });

  it.each([
    ['manualOverride', true, 'MANUAL_OVERRIDE_FORBIDDEN'],
    ['universalSupportClaim', true, 'UNIVERSAL_SUPPORT_CLAIM_FORBIDDEN'],
  ] as const)('rejects forbidden %s', (field, value, code) => {
    const manifest = validManifest();
    (manifest.stages[0]!.runEvidence as unknown as Record<string, unknown>)[field] = value;
    expect(codes(evaluatePhase6Evidence(manifest, context()))).toContain(code);
  });

  it('rejects stale run evidence', () => {
    const manifest = validManifest();
    manifest.stages[0]!.runEvidence!.expiresAt = '2030-01-15T23:59:59.000Z';
    expect(codes(evaluatePhase6Evidence(manifest, context()))).toContain('RUN_EVIDENCE_STALE');
  });

  it('requires review to be persisted strictly after its run evidence', () => {
    const manifest = validManifest();
    const run = withPhysicalStage(manifest, 'clean-windows-vm');
    manifest.stages[1]!.humanReview = {
      ...approvedReview(run),
      recordedAt: run.recordedAt,
    } as never;
    expect(codes(evaluatePhase6Evidence(manifest, context({ mode: 'final' })))).toContain(
      'REVIEW_NOT_AFTER_RUN',
    );
  });

  it('rejects changed or missing immutable artifacts', () => {
    const changed = evaluatePhase6Evidence(
      validManifest(),
      context({ artifactContents: { [buildPath]: 'tampered', [evidencePath]: evidenceBytes } }),
    );
    const missing = evaluatePhase6Evidence(
      validManifest(),
      context({ artifactContents: { [buildPath]: buildBytes } }),
    );

    expect(codes(changed)).toContain('ARTIFACT_HASH_MISMATCH');
    expect(codes(missing)).toContain('ARTIFACT_MISSING');
  });

  it.each([
    ['requirementsCoverage', 'PLAN-05', 'REQUIREMENT_COVERAGE_MISSING'],
    ['decisionCoverage', 'D-34', 'DECISION_COVERAGE_MISSING'],
  ] as const)('requires complete %s references', (field, omitted, code) => {
    const manifest = validManifest();
    (manifest as unknown as Record<string, string[]>)[field] = (
      manifest as unknown as Record<string, string[]>
    )[field]!.filter((id) => id !== omitted);
    expect(codes(evaluatePhase6Evidence(manifest, context()))).toContain(code);
  });

  it('requires all four exact ordered stage cells', () => {
    const manifest = validManifest();
    manifest.stages[2]!.stage = 'friends-pc';
    expect(codes(evaluatePhase6Evidence(manifest, context()))).toContain(
      'PROMOTION_STAGE_SEQUENCE_INVALID',
    );
  });

  const requiredRunFields = [
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
  ] as const;

  it.each(requiredRunFields)('rejects omitted run evidence field %s', (field) => {
    const manifest = validManifest();
    delete (manifest.stages[0]!.runEvidence as unknown as Record<string, unknown>)[field];
    expect(codes(evaluatePhase6Evidence(manifest, context()))).toContain(
      'EVIDENCE_MANIFEST_INVALID',
    );
  });

  const nestedRunFields = [
    ['cycle', 'prepare'],
    ['cycle', 'apply'],
    ['cycle', 'verifyApply'],
    ['cycle', 'restartRequired'],
    ['cycle', 'restart'],
    ['cycle', 'restore'],
    ['cycle', 'verifyRestore'],
    ['security', 'ipcAdversarial'],
    ['security', 'replayRejected'],
    ['security', 'identitySpoofRejected'],
    ['security', 'sessionSwapRejected'],
    ['faults', 'diskFull'],
    ['faults', 'crash'],
    ['faults', 'reboot'],
    ['faults', 'drift'],
    ['accessibility', 'status'],
    ['accessibility', 'seriousOrCriticalViolations'],
    ['diagnostics', 'redacted'],
    ['diagnostics', 'previewed'],
    ['diagnostics', 'consentBound'],
    ['diagnostics', 'autoUpload'],
    ['diagnostics', 'rawFieldsFound'],
    ['revocation', 'signed'],
    ['revocation', 'blocksNewApply'],
    ['revocation', 'localRecoveryAvailable'],
    ['revocation', 'remoteRollback'],
    ['revocation', 'remoteExecution'],
  ] as const;

  it.each(nestedRunFields)('rejects omitted nested evidence field %s.%s', (group, field) => {
    const manifest = validManifest();
    const run = manifest.stages[0]!.runEvidence as unknown as Record<string, unknown>;
    delete (run[group] as Record<string, unknown>)[field];
    expect(codes(evaluatePhase6Evidence(manifest, context()))).toContain(
      'EVIDENCE_MANIFEST_INVALID',
    );
  });

  const requiredReviewFields = [
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
  ] as const;

  it.each(requiredReviewFields)('rejects omitted decided-review field %s', (field) => {
    const manifest = validManifest();
    withPhysicalStage(manifest, 'clean-windows-vm');
    delete (manifest.stages[1]!.humanReview as unknown as Record<string, unknown>)[field];
    expect(codes(evaluatePhase6Evidence(manifest, context({ mode: 'final' })))).toContain(
      'EVIDENCE_MANIFEST_INVALID',
    );
  });

  it('rejects a review artifact-hash swap even when its run hash still matches', () => {
    const manifest = validManifest();
    const run = withPhysicalStage(manifest, 'clean-windows-vm');
    manifest.stages[1]!.humanReview = {
      ...approvedReview(run),
      artifactHashes: [sha256('swapped'), run.artifacts[1]!.sha256],
    } as never;
    expect(codes(evaluatePhase6Evidence(manifest, context({ mode: 'final' })))).toContain(
      'REVIEW_ARTIFACT_HASH_MISMATCH',
    );
  });

  it('rejects a failed earlier physical run and blocks every supplied later stage', () => {
    const manifest = fullyReviewedManifest();
    manifest.stages[1]!.runEvidence!.status = 'FAIL';
    expect(codes(evaluatePhase6Evidence(manifest, context({ mode: 'final' })))).toEqual(
      expect.arrayContaining(['RUN_EVIDENCE_NOT_PASSED', 'PROMOTION_STAGE_SKIPPED']),
    );
  });

  it('rejects already-decided review bytes in run-evidence collection mode', () => {
    const manifest = validManifest();
    withPhysicalStage(manifest, 'clean-windows-vm');
    expect(
      codes(evaluatePhase6Evidence(manifest, context({ requireRunEvidence: 'clean-windows-vm' }))),
    ).toContain('RUN_REVIEW_ALREADY_DECIDED');
  });

  it('rejects additional unreviewed fields at every closed trust boundary', () => {
    const manifest = validManifest();
    (manifest.stages[0]!.runEvidence as unknown as Record<string, unknown>)['rawMachineId'] =
      'forbidden';
    expect(codes(evaluatePhase6Evidence(manifest, context()))).toContain(
      'EVIDENCE_MANIFEST_INVALID',
    );
  });
});
