import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const PHASE4_REQUIREMENTS = [
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

export const CRITICAL_GATES = [
  'security',
  'privacy',
  'billing',
  'licensing',
  'data',
  'restoration',
  'signing',
  'update',
  'accessibility',
  'compatibility',
] as const;

export const PROMOTION_STAGES = [
  'local',
  'preview',
  'internal-staging',
  'invited-alpha',
  'frozen-rc',
  'production',
] as const;

const PHASE4_MAXIMUM_STAGE: PromotionStage = 'invited-alpha';
const RELEASE_BLOCKING_DEFECT_CATEGORIES = new Set<string>(CRITICAL_GATES);
const HASH_PATTERN = /^[a-f0-9]{64}$/u;
const COMMIT_PATTERN = /^[a-f0-9]{40}$/u;

export type Phase4Requirement = (typeof PHASE4_REQUIREMENTS)[number];
export type CriticalGate = (typeof CRITICAL_GATES)[number];
export type PromotionStage = (typeof PROMOTION_STAGES)[number];

export interface BuildIdentity {
  commit: string;
  ociDigest: string;
  desktopBuildId: string;
  contractHash: string;
  schemaHash: string;
}

export interface EvidenceArtifact {
  id: string;
  path: string;
  sha256: string;
  buildFingerprint: string;
}

export interface RequirementWitness {
  id: Phase4Requirement;
  evidenceId: string;
}

export interface GateHistoryRecord {
  sequence: number;
  gate: CriticalGate;
  status: 'passed' | 'failed';
  buildFingerprint: string;
  evidenceId: string;
  previousHash: string | null;
  recordHash: string;
}

export interface PromotionEvidence {
  stage: Exclude<PromotionStage, 'frozen-rc' | 'production'>;
  status: 'passed';
  evidenceIds: string[];
}

export interface KnownDefect {
  id: string;
  category: string;
  severity: 'minor' | 'critical';
  material: boolean;
  documented: boolean;
  status: 'open' | 'resolved';
}

export interface Phase4EvidenceManifest {
  schemaVersion: 1;
  build: BuildIdentity;
  buildFingerprint: string;
  artifacts: EvidenceArtifact[];
  requirements: RequirementWitness[];
  gateHistory: GateHistoryRecord[];
  gateHistoryHead: string | null;
  promotionEvidence: PromotionEvidence[];
  defects: KnownDefect[];
  ownerReviewRequired: boolean;
}

export type WindowsCoverage = 'windows-10' | 'windows-11';
export type CpuCoverage = 'intel' | 'amd';
export type GpuCoverage = 'nvidia' | 'amd' | 'intel';
export type FormFactorCoverage = 'notebook' | 'desktop';
export type StorageCoverage = 'nvme' | 'sata-ssd';
export type NetworkCoverage = 'ethernet' | 'wifi';
export type JourneyCoverage =
  'clean-install' | 'upgrade' | 'offline' | 'failure' | 'restoration' | 'rollback' | 'uninstall';

export interface RealPcCoverageCell {
  id: string;
  os: WindowsCoverage;
  cpu: CpuCoverage;
  gpu: GpuCoverage;
  formFactor: FormFactorCoverage;
  storage: StorageCoverage;
  network: NetworkCoverage;
  journeys: JourneyCoverage[];
  evidenceId: string;
}

export interface RealPcCoverageMatrix {
  schemaVersion: 1;
  buildFingerprint: string;
  cells: RealPcCoverageCell[];
}

export interface EvidenceDiagnostic {
  code: string;
  path: string;
  message: string;
}

export interface Phase4EvaluationContext {
  requestedStage: PromotionStage;
  artifactContents: Readonly<Record<string, string | Uint8Array>>;
}

export interface Phase4EvidenceResult {
  ok: boolean;
  requestedStage: PromotionStage;
  highestAllowedStage: PromotionStage;
  buildFingerprint: string | null;
  coverageGaps: string[];
  diagnostics: EvidenceDiagnostic[];
}

const hash = (value: string | Uint8Array): string =>
  createHash('sha256').update(value).digest('hex');

const diagnostic = (code: string, path: string, message: string): EvidenceDiagnostic => ({
  code,
  path,
  message,
});

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isExactPath = (value: string): boolean =>
  value.length > 0 &&
  !value.includes('\\') &&
  !value.startsWith('/') &&
  !/^[A-Za-z]:/u.test(value) &&
  !/[*?[\]{}]/u.test(value) &&
  value.split('/').every((segment) => segment.length > 0 && segment !== '.' && segment !== '..');

const isBuildIdentity = (value: unknown): value is BuildIdentity =>
  isObject(value) &&
  typeof value['commit'] === 'string' &&
  COMMIT_PATTERN.test(value['commit']) &&
  typeof value['ociDigest'] === 'string' &&
  /^sha256:[a-f0-9]{64}$/u.test(value['ociDigest']) &&
  typeof value['desktopBuildId'] === 'string' &&
  value['desktopBuildId'].length > 0 &&
  typeof value['contractHash'] === 'string' &&
  HASH_PATTERN.test(value['contractHash']) &&
  typeof value['schemaHash'] === 'string' &&
  HASH_PATTERN.test(value['schemaHash']);

export const fingerprintBuild = (build: BuildIdentity): string =>
  hash(
    [
      build.commit,
      build.ociDigest,
      build.desktopBuildId,
      build.contractHash,
      build.schemaHash,
    ].join('\n'),
  );

const gateRecordPayload = (record: Omit<GateHistoryRecord, 'recordHash'>): string =>
  JSON.stringify({
    sequence: record.sequence,
    gate: record.gate,
    status: record.status,
    buildFingerprint: record.buildFingerprint,
    evidenceId: record.evidenceId,
    previousHash: record.previousHash,
  });

export const fingerprintGateRecord = (record: Omit<GateHistoryRecord, 'recordHash'>): string =>
  hash(gateRecordPayload(record));

const asManifest = (value: unknown): Phase4EvidenceManifest | null => {
  if (!isObject(value) || value['schemaVersion'] !== 1 || !isBuildIdentity(value['build'])) {
    return null;
  }
  if (
    typeof value['buildFingerprint'] !== 'string' ||
    !Array.isArray(value['artifacts']) ||
    !Array.isArray(value['requirements']) ||
    !Array.isArray(value['gateHistory']) ||
    !Array.isArray(value['promotionEvidence']) ||
    !Array.isArray(value['defects']) ||
    typeof value['ownerReviewRequired'] !== 'boolean'
  ) {
    return null;
  }
  if (value['gateHistoryHead'] !== null && typeof value['gateHistoryHead'] !== 'string') {
    return null;
  }
  return value as unknown as Phase4EvidenceManifest;
};

const asCoverage = (value: unknown): RealPcCoverageMatrix | null => {
  if (
    !isObject(value) ||
    value['schemaVersion'] !== 1 ||
    typeof value['buildFingerprint'] !== 'string' ||
    !Array.isArray(value['cells'])
  ) {
    return null;
  }
  return value as unknown as RealPcCoverageMatrix;
};

const collectCoverageGaps = (coverage: RealPcCoverageMatrix): string[] => {
  const dimensions = [
    ['os', ['windows-10', 'windows-11']],
    ['cpu', ['intel', 'amd']],
    ['gpu', ['nvidia', 'amd', 'intel']],
    ['form-factor', ['notebook', 'desktop']],
    ['storage', ['nvme', 'sata-ssd']],
    ['network', ['ethernet', 'wifi']],
  ] as const;
  const journeys = [
    'clean-install',
    'upgrade',
    'offline',
    'failure',
    'restoration',
    'rollback',
    'uninstall',
  ] as const;
  const gaps: string[] = [];

  for (const [label, values] of dimensions) {
    for (const required of values) {
      const covered = coverage.cells.some((cell) => {
        switch (label) {
          case 'os':
            return cell.os === required;
          case 'cpu':
            return cell.cpu === required;
          case 'gpu':
            return cell.gpu === required;
          case 'form-factor':
            return cell.formFactor === required;
          case 'storage':
            return cell.storage === required;
          case 'network':
            return cell.network === required;
        }
      });
      if (!covered) {
        gaps.push(`${label}:${required}`);
      }
    }
  }
  for (const journey of journeys) {
    if (!coverage.cells.some((cell) => cell.journeys.includes(journey))) {
      gaps.push(`journey:${journey}`);
    }
  }
  return gaps.toSorted();
};

const stageIndex = (stage: PromotionStage): number => PROMOTION_STAGES.indexOf(stage);

const minimumStage = (left: PromotionStage, right: PromotionStage): PromotionStage =>
  stageIndex(left) <= stageIndex(right) ? left : right;

export const evaluatePhase4Evidence = (
  manifestInput: unknown,
  coverageInput: unknown,
  context: Phase4EvaluationContext,
): Phase4EvidenceResult => {
  const diagnostics: EvidenceDiagnostic[] = [];
  const manifest = asManifest(manifestInput);
  const coverage = asCoverage(coverageInput);

  if (manifest === null) {
    return {
      ok: false,
      requestedStage: context.requestedStage,
      highestAllowedStage: 'local',
      buildFingerprint: null,
      coverageGaps: [],
      diagnostics: [
        diagnostic(
          'EVIDENCE_MANIFEST_INVALID',
          '$',
          'Evidence manifest is incomplete or attempts to infer owner approval.',
        ),
      ],
    };
  }

  const expectedBuildFingerprint = fingerprintBuild(manifest.build);
  if (!manifest.ownerReviewRequired) {
    diagnostics.push(
      diagnostic(
        'OWNER_REVIEW_INFERRED',
        '$.ownerReviewRequired',
        'Phase 4 must leave owner approval explicitly pending and cannot infer production readiness.',
      ),
    );
  }
  if (manifest.buildFingerprint !== expectedBuildFingerprint) {
    diagnostics.push(
      diagnostic(
        'BUILD_FINGERPRINT_MISMATCH',
        '$.buildFingerprint',
        'Build fingerprint does not match the exact commit, image, desktop, contract, and schema identity.',
      ),
    );
  }

  const artifactById = new Map<string, EvidenceArtifact>();
  for (const [index, artifactInput] of (manifest.artifacts as unknown[]).entries()) {
    const path = `$.artifacts[${String(index)}]`;
    const artifact = artifactInput;
    if (
      !isObject(artifact) ||
      typeof artifact['id'] !== 'string' ||
      typeof artifact['path'] !== 'string' ||
      typeof artifact['sha256'] !== 'string' ||
      typeof artifact['buildFingerprint'] !== 'string' ||
      !isExactPath(artifact['path']) ||
      !HASH_PATTERN.test(artifact['sha256'])
    ) {
      diagnostics.push(
        diagnostic(
          'ARTIFACT_RECORD_INVALID',
          path,
          'Artifact record must be exact and hash-bound.',
        ),
      );
      continue;
    }
    if (artifactById.has(artifact['id'])) {
      diagnostics.push(
        diagnostic(
          'DUPLICATE_ARTIFACT_ID',
          `${path}.id`,
          `Artifact ID "${artifact['id']}" repeats.`,
        ),
      );
      continue;
    }
    const typedArtifact = artifact as unknown as EvidenceArtifact;
    artifactById.set(typedArtifact.id, typedArtifact);
    if (typedArtifact.buildFingerprint !== manifest.buildFingerprint) {
      diagnostics.push(
        diagnostic(
          'ARTIFACT_BUILD_MISMATCH',
          `${path}.buildFingerprint`,
          `Artifact "${typedArtifact.id}" is bound to another build.`,
        ),
      );
    }
    const contents = context.artifactContents[typedArtifact.path];
    if (contents === undefined) {
      diagnostics.push(
        diagnostic(
          'ARTIFACT_MISSING',
          `${path}.path`,
          `Artifact "${typedArtifact.path}" cannot be resolved.`,
        ),
      );
    } else if (hash(contents) !== typedArtifact.sha256) {
      diagnostics.push(
        diagnostic(
          'ARTIFACT_HASH_MISMATCH',
          `${path}.sha256`,
          `Artifact "${typedArtifact.path}" does not match its immutable SHA-256 identity.`,
        ),
      );
    }
  }

  for (const [artifactId, expectedHash] of [
    ['contract-openapi', manifest.build.contractHash],
    ['control-plane-schema', manifest.build.schemaHash],
  ] as const) {
    const buildArtifact = artifactById.get(artifactId);
    if (buildArtifact?.sha256 !== expectedHash) {
      diagnostics.push(
        diagnostic(
          'BUILD_ARTIFACT_MISSING',
          '$.artifacts',
          `Build identity does not resolve exact artifact "${artifactId}".`,
        ),
      );
    }
  }

  const requirementCounts = new Map<Phase4Requirement, number>(
    PHASE4_REQUIREMENTS.map((requirement) => [requirement, 0]),
  );
  for (const [index, witnessInput] of (manifest.requirements as unknown[]).entries()) {
    const path = `$.requirements[${String(index)}]`;
    const witness = witnessInput;
    if (
      !isObject(witness) ||
      !PHASE4_REQUIREMENTS.includes(witness['id'] as Phase4Requirement) ||
      typeof witness['evidenceId'] !== 'string'
    ) {
      diagnostics.push(
        diagnostic('REQUIREMENT_WITNESS_INVALID', path, 'Requirement witness is not recognized.'),
      );
      continue;
    }
    const requirement = witness['id'] as Phase4Requirement;
    requirementCounts.set(requirement, (requirementCounts.get(requirement) ?? 0) + 1);
    if (!artifactById.has(witness['evidenceId'])) {
      diagnostics.push(
        diagnostic(
          'REQUIREMENT_ARTIFACT_MISSING',
          `${path}.evidenceId`,
          `Requirement ${requirement} does not resolve an immutable artifact.`,
        ),
      );
    }
  }
  for (const [requirement, count] of requirementCounts) {
    if (count === 0) {
      diagnostics.push(
        diagnostic(
          'REQUIREMENT_EVIDENCE_MISSING',
          '$.requirements',
          `Requirement ${requirement} has no build-bound witness.`,
        ),
      );
    } else if (count > 1) {
      diagnostics.push(
        diagnostic(
          'REQUIREMENT_EVIDENCE_DUPLICATE',
          '$.requirements',
          `Requirement ${requirement} has ${String(count)} competing witnesses.`,
        ),
      );
    }
  }

  let expectedPreviousHash: string | null = null;
  const gatesSeen = new Set<CriticalGate>();
  let historicalCriticalFailure = false;
  for (const [index, recordInput] of (manifest.gateHistory as unknown[]).entries()) {
    const path = `$.gateHistory[${String(index)}]`;
    const record = recordInput;
    if (
      !isObject(record) ||
      record['sequence'] !== index + 1 ||
      !CRITICAL_GATES.includes(record['gate'] as CriticalGate) ||
      (record['status'] !== 'passed' && record['status'] !== 'failed') ||
      typeof record['buildFingerprint'] !== 'string' ||
      typeof record['evidenceId'] !== 'string' ||
      (record['previousHash'] !== null && typeof record['previousHash'] !== 'string') ||
      typeof record['recordHash'] !== 'string'
    ) {
      diagnostics.push(
        diagnostic('GATE_HISTORY_RECORD_INVALID', path, 'Gate history record is incomplete.'),
      );
      continue;
    }
    const typedRecord = record as unknown as GateHistoryRecord;
    gatesSeen.add(typedRecord.gate);
    if (
      typedRecord.status === 'failed' &&
      typedRecord.buildFingerprint === manifest.buildFingerprint
    ) {
      historicalCriticalFailure = true;
    }
    if (typedRecord.buildFingerprint !== manifest.buildFingerprint) {
      diagnostics.push(
        diagnostic(
          'GATE_HISTORY_BUILD_MISMATCH',
          `${path}.buildFingerprint`,
          'Gate record belongs to another build.',
        ),
      );
    }
    if (!artifactById.has(typedRecord.evidenceId)) {
      diagnostics.push(
        diagnostic(
          'GATE_HISTORY_ARTIFACT_MISSING',
          `${path}.evidenceId`,
          'Gate record does not resolve immutable evidence.',
        ),
      );
    }
    if (
      typedRecord.previousHash !== expectedPreviousHash ||
      typedRecord.recordHash !== fingerprintGateRecord(typedRecord)
    ) {
      diagnostics.push(
        diagnostic(
          'GATE_HISTORY_HASH_MISMATCH',
          path,
          'Gate history sequence or hash chain was mutated, reordered, or truncated.',
        ),
      );
    }
    expectedPreviousHash = typedRecord.recordHash;
  }
  if (manifest.gateHistoryHead !== expectedPreviousHash) {
    diagnostics.push(
      diagnostic(
        'GATE_HISTORY_HEAD_MISMATCH',
        '$.gateHistoryHead',
        'Gate history head does not match the last immutable record.',
      ),
    );
  }
  for (const gate of CRITICAL_GATES) {
    if (!gatesSeen.has(gate)) {
      diagnostics.push(
        diagnostic(
          'CRITICAL_GATE_MISSING',
          '$.gateHistory',
          `Critical ${gate} gate has no build-bound history.`,
        ),
      );
    }
  }
  if (historicalCriticalFailure) {
    diagnostics.push(
      diagnostic(
        'CRITICAL_FAILURE_IN_HISTORY',
        '$.gateHistory',
        'A critical failure for this exact build remains authoritative after later passes.',
      ),
    );
  }

  let evidencedStage: PromotionStage = 'local';
  let expectedPromotionIndex = 0;
  for (const [index, evidenceInput] of (manifest.promotionEvidence as unknown[]).entries()) {
    const path = `$.promotionEvidence[${String(index)}]`;
    const expectedStage = PROMOTION_STAGES[expectedPromotionIndex];
    const evidence = evidenceInput;
    if (
      !isObject(evidence) ||
      evidence['status'] !== 'passed' ||
      evidence['stage'] !== expectedStage ||
      stageIndex(evidence['stage'] as PromotionStage) > stageIndex(PHASE4_MAXIMUM_STAGE) ||
      !Array.isArray(evidence['evidenceIds']) ||
      evidence['evidenceIds'].length === 0 ||
      evidence['evidenceIds'].some((id) => typeof id !== 'string' || !artifactById.has(id))
    ) {
      diagnostics.push(
        diagnostic(
          'PROMOTION_EVIDENCE_INVALID',
          path,
          'Promotion evidence must be contiguous, non-production, passed, and artifact-bound.',
        ),
      );
      break;
    }
    evidencedStage = evidence['stage'] as PromotionStage;
    expectedPromotionIndex += 1;
  }

  let criticalDefect = false;
  for (const [index, defectInput] of (manifest.defects as unknown[]).entries()) {
    const path = `$.defects[${String(index)}]`;
    const defect = defectInput;
    if (
      !isObject(defect) ||
      typeof defect['id'] !== 'string' ||
      typeof defect['category'] !== 'string' ||
      (defect['severity'] !== 'minor' && defect['severity'] !== 'critical') ||
      typeof defect['material'] !== 'boolean' ||
      typeof defect['documented'] !== 'boolean' ||
      (defect['status'] !== 'open' && defect['status'] !== 'resolved')
    ) {
      diagnostics.push(diagnostic('DEFECT_RECORD_INVALID', path, 'Defect record is incomplete.'));
      continue;
    }
    if (
      defect['status'] === 'open' &&
      (defect['severity'] === 'critical' ||
        defect['material'] ||
        RELEASE_BLOCKING_DEFECT_CATEGORIES.has(defect['category']))
    ) {
      criticalDefect = true;
      diagnostics.push(
        diagnostic(
          'KNOWN_CRITICAL_DEFECT',
          path,
          `Open defect "${defect['id']}" has critical or material impact.`,
        ),
      );
    } else if (defect['status'] === 'open' && !defect['documented']) {
      diagnostics.push(
        diagnostic(
          'UNDOCUMENTED_OPEN_DEFECT',
          path,
          `Open minor defect "${defect['id']}" is not documented.`,
        ),
      );
    }
  }

  let coverageGaps: string[] = [];
  if (coverage === null) {
    coverageGaps = ['matrix:invalid'];
  } else {
    if (coverage.buildFingerprint !== manifest.buildFingerprint) {
      coverageGaps.push('matrix:wrong-build');
    }
    for (const [index, cellInput] of (coverage.cells as unknown[]).entries()) {
      const cell = cellInput;
      if (
        !isObject(cell) ||
        typeof cell['id'] !== 'string' ||
        !['windows-10', 'windows-11'].includes(cell['os'] as string) ||
        !['intel', 'amd'].includes(cell['cpu'] as string) ||
        !['nvidia', 'amd', 'intel'].includes(cell['gpu'] as string) ||
        !['notebook', 'desktop'].includes(cell['formFactor'] as string) ||
        !['nvme', 'sata-ssd'].includes(cell['storage'] as string) ||
        !['ethernet', 'wifi'].includes(cell['network'] as string) ||
        !Array.isArray(cell['journeys']) ||
        typeof cell['evidenceId'] !== 'string' ||
        !artifactById.has(cell['evidenceId'])
      ) {
        coverageGaps.push(`cell:${String(index)}:invalid`);
      }
    }
    coverageGaps.push(...collectCoverageGaps(coverage));
    coverageGaps = [...new Set(coverageGaps)].toSorted();
  }

  let highestAllowedStage = evidencedStage;
  if (coverageGaps.length > 0) {
    highestAllowedStage = minimumStage(highestAllowedStage, 'internal-staging');
  }
  if (historicalCriticalFailure || criticalDefect) {
    highestAllowedStage = 'local';
  }

  if (stageIndex(context.requestedStage) > stageIndex(PHASE4_MAXIMUM_STAGE)) {
    diagnostics.push(
      diagnostic(
        'PHASE4_STAGE_FORBIDDEN',
        '$.requestedStage',
        'Phase 4 cannot grant frozen release-candidate or production authority.',
      ),
    );
  } else if (stageIndex(context.requestedStage) > stageIndex(highestAllowedStage)) {
    if (context.requestedStage === 'invited-alpha' && coverageGaps.length > 0) {
      diagnostics.push(
        diagnostic(
          'REAL_PC_COVERAGE_GAP',
          '$.coverage',
          'Invited alpha requires every D-67 Windows, hardware, form-factor, storage, network, and journey cell.',
        ),
      );
    } else {
      diagnostics.push(
        diagnostic(
          'PROMOTION_STAGE_UNEVIDENCED',
          '$.requestedStage',
          `Requested stage ${context.requestedStage} exceeds ${highestAllowedStage}.`,
        ),
      );
    }
  }

  const sortedDiagnostics = diagnostics.toSorted(
    (left, right) => left.path.localeCompare(right.path) || left.code.localeCompare(right.code),
  );
  return {
    ok: sortedDiagnostics.length === 0,
    requestedStage: context.requestedStage,
    highestAllowedStage,
    buildFingerprint: manifest.buildFingerprint,
    coverageGaps,
    diagnostics: sortedDiagnostics,
  };
};

const parseStage = (arguments_: readonly string[]): PromotionStage => {
  const stageIndexValue = arguments_.indexOf('--stage');
  const value = stageIndexValue === -1 ? undefined : arguments_[stageIndexValue + 1];
  if (value === undefined || !PROMOTION_STAGES.includes(value as PromotionStage)) {
    throw new Error(`Missing or invalid --stage ${PROMOTION_STAGES.join('|')}.`);
  }
  return value as PromotionStage;
};

const runCli = (): void => {
  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const repositoryRoot = resolve(packageRoot, '..', '..');
  const manifest = JSON.parse(
    readFileSync(resolve(packageRoot, 'evidence-manifest.json'), 'utf8'),
  ) as unknown;
  const coverage = JSON.parse(
    readFileSync(resolve(packageRoot, 'real-pc-coverage.json'), 'utf8'),
  ) as unknown;
  const typedManifest = asManifest(manifest);
  const artifactContents: Record<string, Uint8Array> = {};
  if (typedManifest !== null) {
    for (const artifact of typedManifest.artifacts) {
      if (typeof artifact.path === 'string' && isExactPath(artifact.path)) {
        try {
          artifactContents[artifact.path] = readFileSync(resolve(repositoryRoot, artifact.path));
        } catch {
          // Missing evidence remains absent so the evaluator emits one provider-neutral diagnostic.
        }
      }
    }
  }
  const result = evaluatePhase4Evidence(manifest, coverage, {
    requestedStage: parseStage(process.argv.slice(2)),
    artifactContents,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) {
    process.exitCode = 1;
  }
};

const entryPoint = process.argv[1];
if (entryPoint !== undefined && pathToFileURL(resolve(entryPoint)).href === import.meta.url) {
  runCli();
}
