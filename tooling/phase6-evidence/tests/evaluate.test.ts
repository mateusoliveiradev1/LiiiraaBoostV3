import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  PHASE6_PROMOTION_STAGES,
  PHASE6_REQUIREMENTS,
  evaluatePhase6Evidence,
  parsePhase6CliOptions,
  phase6EvidenceSha256,
} from '../src/evaluate.js';

type Stage = (typeof PHASE6_PROMOTION_STAGES)[number];
type PhysicalStage = Exclude<Stage, 'deterministic-simulation'>;

const REQUIREMENTS = [
  'PLAN-01',
  'PLAN-02',
  'PLAN-03',
  'PLAN-04',
  'PLAN-05',
  'PLAN-06',
  'PLAN-07',
  'PLAN-08',
] as const;
const DECISIONS = Array.from(
  { length: 35 },
  (_, index) => `D-${String(index + 1).padStart(2, '0')}`,
);
const buildBytes = 'phase-6 immutable packaged build';
const evidenceBytes = 'phase-6 bounded evidence';
const buildPath = 'artifacts/liiiraa-boost-phase6.exe';
const evidencePath = 'evidence/phase6-cycle.json';
const artifactManifestSha256 = createHash('sha256').update('artifact manifest').digest('hex');
const configSha256 = createHash('sha256').update('stage config').digest('hex');
const rosterSha256 = createHash('sha256').update('signed friends roster').digest('hex');

const sha256 = (value: string | Uint8Array): string =>
  createHash('sha256').update(value).digest('hex');

const runEvidence = (
  stage: Stage,
  participantId: string,
  machineSlot: string | null = null,
  predecessorRunEvidenceSha256: string | null = null,
) => ({
  id: `run-${stage}-${participantId}`,
  source:
    stage === 'deterministic-simulation'
      ? 'phase6-deterministic-rust-1'
      : 'phase6-physical-runner-rust-1',
  stage,
  evidenceKind: stage === 'deterministic-simulation' ? 'deterministic' : 'physical',
  status: 'PASS',
  operationVersion: 'power-scheme@3.0.0',
  buildId: 'phase6-build-003',
  participantId,
  machineSlot,
  artifactManifestSha256,
  configSha256,
  friendsRosterSha256: stage === 'friends-pc' ? rosterSha256 : null,
  predecessorRunEvidenceSha256,
  recordedAt: '2030-01-15T18:00:00.000Z',
  exportedAt: stage === 'friends-pc' ? '2030-01-15T18:30:00.000Z' : null,
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
  continuation: [
    'installed-ready',
    'checkpoint-ready',
    'running',
    'reboot-pending',
    'resumed-observation',
    'restored-complete',
  ],
  journalSha256: sha256(`journal-${stage}-${participantId}`),
  receiptSha256: sha256(`receipt-${stage}-${participantId}`),
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
    consentBound: stage !== 'deterministic-simulation',
    autoUpload: false,
    rawFieldsFound: [] as string[],
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
});

type Run = ReturnType<typeof runEvidence>;

const consentFor = (run: Run) => ({
  id: `consent-${run.participantId}`,
  participantId: run.participantId,
  machineSlot: run.machineSlot,
  recordedAt: '2030-01-15T18:15:00.000Z',
  artifactManifestSha256,
  configSha256,
  friendsRosterSha256: rosterSha256,
  runEvidenceId: run.id,
  runEvidenceSha256: phase6EvidenceSha256(run),
  previewSha256: sha256(`preview-${run.participantId}`),
  redactedBytesSha256: sha256(`redacted-${run.participantId}`),
  intent: 'export-and-send',
});

const reviewFor = (run: Run, consent: ReturnType<typeof consentFor> | null = null) => ({
  id: `review-${run.participantId}`,
  reviewerId: `reviewer-${run.participantId}`,
  participantId: run.participantId,
  machineSlot: run.machineSlot,
  recordedAt: '2030-01-15T19:00:00.000Z',
  response: 'APPROVED',
  verdict: 'APPROVED',
  operationVersion: run.operationVersion,
  buildId: run.buildId,
  stage: run.stage,
  artifactManifestSha256,
  configSha256,
  friendsRosterSha256: run.friendsRosterSha256,
  runEvidenceId: run.id,
  runEvidenceSha256: phase6EvidenceSha256(run),
  consentId: consent?.id ?? null,
  consentSha256: consent === null ? null : phase6EvidenceSha256(consent),
  artifactHashes: run.artifacts.map(({ sha256: hash }) => hash),
});

const roster = () => ({
  id: 'friends-roster-alpha-001',
  recordedAt: '2030-01-15T17:00:00.000Z',
  operationVersion: 'power-scheme@3.0.0',
  buildId: 'phase6-build-003',
  artifactManifestSha256,
  configSha256,
  rosterSha256,
  cmsSha256: sha256('friends roster cms'),
  participants: [
    { participantId: 'friend-alpha', machineSlot: 'friends-slot-01' },
    { participantId: 'friend-bravo', machineSlot: 'friends-slot-02' },
  ],
});

const manifest = () => {
  const deterministic = runEvidence('deterministic-simulation', 'deterministic-runner');
  return {
    schemaVersion: 2,
    generatedAt: '2030-01-15T20:00:00.000Z',
    operationVersion: 'power-scheme@3.0.0',
    immutableBuild: {
      id: 'phase6-build-003',
      commit: '51770454aa1d17647c4fe734ae1e57f3e0b403b0',
      artifact: { path: buildPath, sha256: sha256(buildBytes) },
      artifactManifestSha256,
    },
    promotionStage: 'deterministic-simulation' as Stage,
    requirementsCoverage: [...REQUIREMENTS] as string[],
    decisionCoverage: [...DECISIONS],
    legacyBlockedAttempts: [
      { path: 'evidence/legacy/managed-power-scheme-v2.json', sha256: sha256('legacy') },
    ],
    stages: PHASE6_PROMOTION_STAGES.map((stage, index) => ({
      stage,
      predecessorStage: index === 0 ? null : PHASE6_PROMOTION_STAGES[index - 1]!,
      friendsRoster: null as ReturnType<typeof roster> | null,
      runs: stage === 'deterministic-simulation' ? [deterministic] : ([] as Run[]),
      consents: [] as ReturnType<typeof consentFor>[],
      reviews: [] as ReturnType<typeof reviewFor>[],
    })),
  };
};

type Manifest = ReturnType<typeof manifest>;

const context = (overrides: Record<string, unknown> = {}) =>
  ({
    mode: 'planned' as const,
    requireAdmittedStage: 'deterministic-simulation' as const,
    evaluatedAt: '2030-01-16T00:00:00.000Z',
    artifactContents: { [buildPath]: buildBytes, [evidencePath]: evidenceBytes },
    ...overrides,
  }) as Parameters<typeof evaluatePhase6Evidence>[1];

const codes = (result: ReturnType<typeof evaluatePhase6Evidence>): string[] =>
  result.diagnostics.map(({ code }) => code);

const appendPhysical = (value: Manifest, stage: PhysicalStage, review = true): Run[] => {
  const index = PHASE6_PROMOTION_STAGES.indexOf(stage);
  const cell = value.stages[index]!;
  const predecessor = value.stages[index - 1]?.runs.at(-1);
  const bindings =
    stage === 'friends-pc'
      ? roster().participants
      : [{ participantId: `participant-${stage}`, machineSlot: null }];
  if (stage === 'friends-pc') cell.friendsRoster = roster();
  cell.runs = bindings.map(({ participantId, machineSlot }) =>
    runEvidence(
      stage,
      participantId,
      machineSlot,
      predecessor === undefined ? sha256('missing predecessor') : phase6EvidenceSha256(predecessor),
    ),
  );
  if (stage === 'friends-pc') cell.consents = cell.runs.map(consentFor);
  if (review) {
    cell.reviews = cell.runs.map((run, runIndex) =>
      reviewFor(run, stage === 'friends-pc' ? cell.consents[runIndex]! : null),
    );
  }
  value.promotionStage = stage;
  return cell.runs;
};

const reviewedThrough = (stage: PhysicalStage): Manifest => {
  const value = manifest();
  appendPhysical(value, 'clean-windows-vm');
  if (stage === 'owner-pc' || stage === 'friends-pc') appendPhysical(value, 'owner-pc');
  if (stage === 'friends-pc') appendPhysical(value, 'friends-pc');
  return value;
};

describe('closed Phase 6 CLI grammar', () => {
  it.each([
    [['--mode', 'planned'], { mode: 'planned', requireAdmittedStage: 'deterministic-simulation' }],
    [
      ['--mode', 'planned', '--require-run-evidence', 'clean-windows-vm'],
      { mode: 'planned', requireRunEvidence: 'clean-windows-vm' },
    ],
    [
      ['--mode', 'planned', '--require-admitted-stage', 'owner-pc'],
      { mode: 'planned', requireAdmittedStage: 'owner-pc' },
    ],
    [['--mode', 'final'], { mode: 'final' }],
  ] as const)('accepts only canonical invocation %j', (args, expected) => {
    expect(parsePhase6CliOptions(args)).toEqual(expected);
  });

  const invalidArguments = [
    [],
    ['--mode'],
    ['--mode', 'other'],
    ['--mode', 'final', '--require-run-evidence', 'friends-pc'],
    ['--mode', 'planned', '--require-run-evidence'],
    ['--mode', 'planned', '--require-admitted-stage'],
    ['--mode', 'planned', '--require-run-evidence', 'clean-vm'],
    ['--mode', 'planned', '--require-run-evidence', 'friends-pcs'],
    ['--mode', 'planned', '--stage', 'clean-windows-vm'],
    ['--mode', 'planned', '--unknown'],
    [
      '--mode',
      'planned',
      '--require-run-evidence',
      'clean-windows-vm',
      '--require-admitted-stage',
      'clean-windows-vm',
    ],
  ].map((args) => [args] as const);

  it.each(invalidArguments)('rejects noncanonical invocation %j before evaluation', (args) => {
    expect(() => parsePhase6CliOptions(args)).toThrow(/Phase 6 CLI/u);
  });
});

describe('exact PLAN-01 through PLAN-08 coverage', () => {
  it('keeps evaluator and schema on the exact ordered closed set', () => {
    const schema = JSON.parse(
      readFileSync(
        fileURLToPath(new URL('../evidence-manifest.schema.json', import.meta.url).href),
        'utf8',
      ),
    ) as {
      properties: {
        requirementsCoverage: {
          items: { enum: string[] };
          minItems: number;
          maxItems: number;
          uniqueItems: boolean;
        };
      };
    };
    const coverage = schema.properties.requirementsCoverage;

    expect(PHASE6_REQUIREMENTS).toEqual(REQUIREMENTS);
    expect(coverage.items.enum).toEqual(REQUIREMENTS);
    expect(coverage).toMatchObject({ minItems: 8, maxItems: 8, uniqueItems: true });
  });

  it.each(['PLAN-02', 'PLAN-03', 'PLAN-04'] as const)(
    'reports REQUIREMENT_COVERAGE_MISSING when %s is omitted',
    (omitted) => {
      const value = manifest();
      value.requirementsCoverage = value.requirementsCoverage.filter((id) => id !== omitted);
      expect(
        codes(
          evaluatePhase6Evidence(
            value,
            context({ requireAdmittedStage: 'deterministic-simulation' }),
          ),
        ),
      ).toContain('REQUIREMENT_COVERAGE_MISSING');
    },
  );

  it.each([
    ['reordered', (ids: string[]) => [ids[1]!, ids[0]!, ...ids.slice(2)]],
    ['duplicate', (ids: string[]) => [...ids.slice(0, 7), ids[6]!]],
    ['unknown', (ids: string[]) => [...ids.slice(0, 7), 'PLAN-99']],
    ['fewer', (ids: string[]) => ids.slice(0, 7)],
    ['more', (ids: string[]) => [...ids, 'PLAN-99']],
  ])('rejects %s requirement coverage', (_name, mutate) => {
    const value = manifest();
    value.requirementsCoverage = mutate(value.requirementsCoverage);
    expect(
      codes(
        evaluatePhase6Evidence(
          value,
          context({ requireAdmittedStage: 'deterministic-simulation' }),
        ),
      ),
    ).toContain('REQUIREMENT_COVERAGE_INVALID');
  });
});

describe('targeted and final stage evaluation', () => {
  it('accepts one pending clean run while later stages are absent', () => {
    const value = manifest();
    appendPhysical(value, 'clean-windows-vm', false);
    const result = evaluatePhase6Evidence(
      value,
      context({ requireRunEvidence: 'clean-windows-vm' }),
    );
    expect(result.ok).toBe(true);
    expect(result.runReadyForReview).toBe(true);
    expect(result.highestAdmittedStage).toBe('deterministic-simulation');
  });

  it('accepts an admitted owner stage while friends remains absent', () => {
    const value = reviewedThrough('owner-pc');
    const result = evaluatePhase6Evidence(value, context({ requireAdmittedStage: 'owner-pc' }));
    expect(result.ok).toBe(true);
    expect(result.highestAdmittedStage).toBe('owner-pc');
  });

  it('requires the complete four-stage chain in final mode', () => {
    expect(
      evaluatePhase6Evidence(reviewedThrough('friends-pc'), context({ mode: 'final' })).ok,
    ).toBe(true);
    expect(evaluatePhase6Evidence(reviewedThrough('owner-pc'), context({ mode: 'final' })).ok).toBe(
      false,
    );
  });

  it('rejects skipped predecessors even for targeted gates', () => {
    const value = manifest();
    appendPhysical(value, 'owner-pc', false);
    expect(
      codes(evaluatePhase6Evidence(value, context({ requireRunEvidence: 'owner-pc' }))),
    ).toContain('PROMOTION_STAGE_SKIPPED');
  });
});

describe('frozen friends roster and one-to-one append-only evidence', () => {
  it('admits exactly one run, consent, and later review for each frozen roster member', () => {
    const result = evaluatePhase6Evidence(
      reviewedThrough('friends-pc'),
      context({ mode: 'final' }),
    );
    expect(result.ok).toBe(true);
    expect(result.highestAdmittedStage).toBe('friends-pc');
  });

  it.each([
    ['missing run', (value: Manifest) => value.stages[3]!.runs.pop()],
    [
      'extra run',
      (value: Manifest) =>
        value.stages[3]!.runs.push({
          ...value.stages[3]!.runs[0]!,
          id: 'run-extra',
          participantId: 'friend-extra',
          machineSlot: 'friends-slot-03',
        }),
    ],
    ['duplicate run', (value: Manifest) => value.stages[3]!.runs.push(value.stages[3]!.runs[0]!)],
    ['missing consent', (value: Manifest) => value.stages[3]!.consents.pop()],
    [
      'extra consent',
      (value: Manifest) =>
        value.stages[3]!.consents.push({ ...value.stages[3]!.consents[0]!, id: 'consent-extra' }),
    ],
    ['missing review', (value: Manifest) => value.stages[3]!.reviews.pop()],
    [
      'extra review',
      (value: Manifest) =>
        value.stages[3]!.reviews.push({ ...value.stages[3]!.reviews[0]!, id: 'review-extra' }),
    ],
    [
      'swapped slot',
      (value: Manifest) => {
        value.stages[3]!.runs[0]!.machineSlot = 'friends-slot-02';
      },
    ],
    [
      'unknown participant',
      (value: Manifest) => {
        value.stages[3]!.runs[0]!.participantId = 'friend-unknown';
      },
    ],
    [
      'rejected review',
      (value: Manifest) => {
        value.stages[3]!.reviews[0]!.verdict = 'REJECTED';
        value.stages[3]!.reviews[0]!.response = 'REJECTED';
      },
    ],
    [
      'review before run',
      (value: Manifest) => {
        value.stages[3]!.reviews[0]!.recordedAt = value.stages[3]!.runs[0]!.recordedAt;
      },
    ],
    [
      'consent after export',
      (value: Manifest) => {
        value.stages[3]!.consents[0]!.recordedAt = value.stages[3]!.runs[0]!.exportedAt!;
      },
    ],
    [
      'roster hash mismatch',
      (value: Manifest) => {
        value.stages[3]!.runs[0]!.friendsRosterSha256 = sha256('other roster');
      },
    ],
    [
      'run hash mismatch',
      (value: Manifest) => {
        value.stages[3]!.reviews[0]!.runEvidenceSha256 = sha256('other run');
      },
    ],
  ])('blocks final admission for %s', (_name, mutate) => {
    const value = reviewedThrough('friends-pc');
    mutate(value);
    expect(evaluatePhase6Evidence(value, context({ mode: 'final' })).ok).toBe(false);
  });

  it.each([
    [
      'duplicate participant',
      (value: Manifest) => {
        value.stages[3]!.friendsRoster!.participants[1]!.participantId = 'friend-alpha';
      },
    ],
    [
      'duplicate slot',
      (value: Manifest) => {
        value.stages[3]!.friendsRoster!.participants[1]!.machineSlot = 'friends-slot-01';
      },
    ],
  ])('rejects %s in the immutable roster', (_name, mutate) => {
    const value = reviewedThrough('friends-pc');
    mutate(value);
    expect(codes(evaluatePhase6Evidence(value, context({ mode: 'final' })))).toContain(
      'FRIENDS_ROSTER_INVALID',
    );
  });
});

describe('legacy evidence remains blocked history', () => {
  it('never upgrades schema v1 bytes into current PASS evidence', () => {
    const legacy = { ...manifest(), schemaVersion: 1 };
    const result = evaluatePhase6Evidence(legacy, context({ mode: 'final' }));
    expect(result.ok).toBe(false);
    expect(codes(result)).toContain('LEGACY_EVIDENCE_BLOCKED');
  });

  it('does not count legacy blocked references toward current cardinality', () => {
    const value = reviewedThrough('owner-pc');
    value.legacyBlockedAttempts.push({
      path: 'evidence/legacy/friends-pass.json',
      sha256: sha256('fake pass'),
    });
    expect(evaluatePhase6Evidence(value, context({ mode: 'final' })).ok).toBe(false);
  });
});
