import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const PHASE5_AUTOMATED_GATES = [
  'contract',
  'conformance',
  'migration',
  'policy',
  'trace',
  'fault',
  'ui',
  'accessibility',
  'report',
  'tamper',
  'resource',
] as const;

export const PHASE5_HARDWARE_CLASSES = [
  'cpu',
  'gpu',
  'memory',
  'storage',
  'network',
  'display',
  'audio',
  'usb',
  'windows',
  'drivers',
  'security',
  'games',
] as const;

export type Phase5AutomatedGate = (typeof PHASE5_AUTOMATED_GATES)[number];
export type Phase5HardwareClass = (typeof PHASE5_HARDWARE_CLASSES)[number];
export type Phase5RunKind = 'deterministic-ci' | 'local-development' | 'packaged-physical';

export interface Phase5HardwareEvidence {
  hardwareClass: Phase5HardwareClass;
  state: 'observed' | 'unavailable';
  source: string;
  reasonCode?: string;
}

export interface Phase5MatrixIdentity {
  os: 'windows-10' | 'windows-11';
  cpu: 'intel' | 'amd' | 'other';
  gpu: Array<'nvidia' | 'amd' | 'intel' | 'other'>;
  formFactor: 'desktop' | 'notebook' | 'other';
  storage: Array<'nvme' | 'sata-ssd' | 'other'>;
  network: Array<'ethernet' | 'wifi' | 'other'>;
}

export interface Phase5EvidenceManifest {
  schemaVersion: 1;
  runId: string;
  runKind: Phase5RunKind;
  generatedAt: string;
  build: {
    commit: string;
    collectorVersion: string;
    artifactPath: string;
    artifactSha256: string;
  };
  environment: {
    physical: boolean;
    os: {
      family: 'windows';
      edition: string;
      lifecycle: 'windows-11' | 'windows-10-ltsc-esu' | 'windows-10-unsupported';
      version: string;
      build: string;
      architecture: string;
    };
    hardwareClasses: Phase5HardwareEvidence[];
    matrix?: Phase5MatrixIdentity;
  };
  gates: Array<{
    id: Phase5AutomatedGate;
    status: 'passed' | 'failed' | 'pending';
    evidenceKind: 'deterministic' | 'physical';
    evidenceSha256: string;
  }>;
  budgets: {
    memoryPeakMb: number;
    idleCpuPercent: number;
    pollingHz: number;
    cancellationMs: number;
    sampleDurationSeconds: number;
  };
  privacy: {
    rawIdentifiersFound: string[];
    scanSha256: string;
  };
  report: {
    path: string;
    sha256: string;
  };
  phase4PhysicalGaps: Array<{
    id: string;
    status: 'pending' | 'passed';
    detail: string;
  }>;
}

export interface Phase5EvidenceDiagnostic {
  code: string;
  path: string;
  message: string;
}

export interface Phase5EvaluationContext {
  mode: 'planned' | 'final';
  artifactContents: Readonly<Record<string, string | Uint8Array>>;
  gateEvidenceContents: Readonly<Record<string, string | Uint8Array>>;
}

export interface Phase5EvidenceResult {
  ok: boolean;
  automatedOk: boolean;
  currentPcAdmitted: boolean;
  releaseReady: boolean;
  physicalMatrixGaps: string[];
  phase4PhysicalGaps: string[];
  diagnostics: Phase5EvidenceDiagnostic[];
}

const HASH_PATTERN = /^[a-f0-9]{64}$/u;
const COMMIT_PATTERN = /^[a-f0-9]{40}$/u;

const sha256 = (value: string | Uint8Array): string =>
  createHash('sha256').update(value).digest('hex');

const diagnostic = (code: string, path: string, message: string): Phase5EvidenceDiagnostic => ({
  code,
  path,
  message,
});

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isExactRelativePath = (value: string): boolean =>
  value.length > 0 &&
  !value.includes('\\') &&
  !value.startsWith('/') &&
  !/^[A-Za-z]:/u.test(value) &&
  !/[*?[\]{}]/u.test(value) &&
  value.split('/').every((segment) => segment.length > 0 && segment !== '.' && segment !== '..');

const isIsoDate = (value: string): boolean =>
  value.length > 0 && Number.isFinite(Date.parse(value));

const asManifest = (value: unknown): Phase5EvidenceManifest | null => {
  if (!isObject(value) || value['schemaVersion'] !== 1) return null;
  if (
    typeof value['runId'] !== 'string' ||
    !['deterministic-ci', 'local-development', 'packaged-physical'].includes(
      String(value['runKind']),
    ) ||
    typeof value['generatedAt'] !== 'string' ||
    !isObject(value['build']) ||
    !isObject(value['environment']) ||
    !Array.isArray(value['gates']) ||
    !isObject(value['budgets']) ||
    !isObject(value['privacy']) ||
    !isObject(value['report']) ||
    !Array.isArray(value['phase4PhysicalGaps'])
  ) {
    return null;
  }
  return value as unknown as Phase5EvidenceManifest;
};

const validateBuild = (
  manifest: Phase5EvidenceManifest,
  index: number,
  context: Phase5EvaluationContext,
  diagnostics: Phase5EvidenceDiagnostic[],
): void => {
  const path = `$[${String(index)}].build`;
  const { build } = manifest;
  if (!COMMIT_PATTERN.test(build.commit)) {
    diagnostics.push(diagnostic('BUILD_COMMIT_INVALID', `${path}.commit`, 'Commit must be exact.'));
  }
  if (build.collectorVersion.length === 0) {
    diagnostics.push(
      diagnostic(
        'COLLECTOR_VERSION_MISSING',
        `${path}.collectorVersion`,
        'Collector version is required.',
      ),
    );
  }
  if (!isExactRelativePath(build.artifactPath) || !HASH_PATTERN.test(build.artifactSha256)) {
    diagnostics.push(
      diagnostic(
        'ARTIFACT_IDENTITY_INVALID',
        path,
        'Packaged artifact path and SHA-256 must be exact.',
      ),
    );
    return;
  }
  const contents = context.artifactContents[build.artifactPath];
  if (contents === undefined) {
    diagnostics.push(
      diagnostic('ARTIFACT_MISSING', `${path}.artifactPath`, 'Referenced artifact is missing.'),
    );
  } else if (sha256(contents) !== build.artifactSha256) {
    diagnostics.push(
      diagnostic(
        'ARTIFACT_HASH_MISMATCH',
        `${path}.artifactSha256`,
        'Packaged artifact bytes do not match the manifest.',
      ),
    );
  }
};

const validateEnvironment = (
  manifest: Phase5EvidenceManifest,
  index: number,
  diagnostics: Phase5EvidenceDiagnostic[],
): void => {
  const path = `$[${String(index)}].environment`;
  const { environment } = manifest;
  if (environment.os.family !== 'windows') {
    diagnostics.push(diagnostic('OS_FAMILY_INVALID', `${path}.os.family`, 'Windows is required.'));
  }
  if (environment.os.edition.length === 0 || environment.os.version.length === 0) {
    diagnostics.push(
      diagnostic('OS_IDENTITY_MISSING', `${path}.os`, 'OS edition and version are required.'),
    );
  }
  if (environment.os.build.length === 0) {
    diagnostics.push(
      diagnostic('OS_BUILD_MISSING', `${path}.os.build`, 'Exact Windows build is required.'),
    );
  }
  if (environment.os.architecture.length === 0) {
    diagnostics.push(
      diagnostic(
        'OS_ARCHITECTURE_MISSING',
        `${path}.os.architecture`,
        'Windows architecture is required.',
      ),
    );
  }

  const seen = new Set<Phase5HardwareClass>();
  for (const [hardwareIndex, evidence] of environment.hardwareClasses.entries()) {
    const evidencePath = `${path}.hardwareClasses[${String(hardwareIndex)}]`;
    if (!PHASE5_HARDWARE_CLASSES.includes(evidence.hardwareClass)) continue;
    if (seen.has(evidence.hardwareClass)) {
      diagnostics.push(
        diagnostic(
          'HARDWARE_CLASS_DUPLICATE',
          evidencePath,
          `Hardware class ${evidence.hardwareClass} repeats.`,
        ),
      );
    }
    seen.add(evidence.hardwareClass);
    if (evidence.source.length === 0) {
      diagnostics.push(
        diagnostic(
          'SOURCE_EVIDENCE_MISSING',
          `${evidencePath}.source`,
          `Hardware class ${evidence.hardwareClass} has no admitted source.`,
        ),
      );
    }
    if (evidence.state === 'unavailable' && (evidence.reasonCode?.length ?? 0) === 0) {
      diagnostics.push(
        diagnostic(
          'UNAVAILABLE_REASON_MISSING',
          `${evidencePath}.reasonCode`,
          `Unavailable hardware class ${evidence.hardwareClass} requires a reason.`,
        ),
      );
    }
  }
  for (const hardwareClass of PHASE5_HARDWARE_CLASSES) {
    if (!seen.has(hardwareClass)) {
      diagnostics.push(
        diagnostic(
          'HARDWARE_CLASS_MISSING',
          `${path}.hardwareClasses`,
          `Hardware class ${hardwareClass} has no observed or unavailable record.`,
        ),
      );
    }
  }
};

const validateGates = (
  manifest: Phase5EvidenceManifest,
  index: number,
  context: Phase5EvaluationContext,
  diagnostics: Phase5EvidenceDiagnostic[],
): void => {
  const expectedKind = manifest.runKind === 'packaged-physical' ? 'physical' : 'deterministic';
  const seen = new Set<Phase5AutomatedGate>();
  for (const [gateIndex, gate] of manifest.gates.entries()) {
    const path = `$[${String(index)}].gates[${String(gateIndex)}]`;
    if (!PHASE5_AUTOMATED_GATES.includes(gate.id)) continue;
    if (seen.has(gate.id)) {
      diagnostics.push(diagnostic('GATE_DUPLICATE', path, `Gate ${gate.id} repeats.`));
    }
    seen.add(gate.id);
    if (gate.evidenceKind !== expectedKind) {
      diagnostics.push(
        diagnostic(
          'GATE_EVIDENCE_KIND_MISMATCH',
          `${path}.evidenceKind`,
          `Gate ${gate.id} cannot change ${expectedKind} evidence into ${gate.evidenceKind}.`,
        ),
      );
    }
    if (gate.status !== 'passed') {
      diagnostics.push(
        diagnostic('GATE_NOT_PASSED', `${path}.status`, `Gate ${gate.id} is ${gate.status}.`),
      );
    }
    const contents =
      context.gateEvidenceContents[`${manifest.runId}:${gate.id}`] ??
      context.gateEvidenceContents[gate.id];
    if (!HASH_PATTERN.test(gate.evidenceSha256) || contents === undefined) {
      diagnostics.push(
        diagnostic(
          'GATE_EVIDENCE_MISSING',
          `${path}.evidenceSha256`,
          `Gate ${gate.id} has no resolvable immutable evidence.`,
        ),
      );
    } else if (sha256(contents) !== gate.evidenceSha256) {
      diagnostics.push(
        diagnostic(
          'GATE_EVIDENCE_HASH_MISMATCH',
          `${path}.evidenceSha256`,
          `Gate ${gate.id} evidence was changed after admission.`,
        ),
      );
    }
  }
  for (const gate of PHASE5_AUTOMATED_GATES) {
    if (!seen.has(gate)) {
      diagnostics.push(
        diagnostic(
          'AUTOMATED_GATE_MISSING',
          `$[${String(index)}].gates`,
          `Required automated gate ${gate} is missing.`,
        ),
      );
    }
  }
};

const validateBudgetsAndPrivacy = (
  manifest: Phase5EvidenceManifest,
  index: number,
  diagnostics: Phase5EvidenceDiagnostic[],
): void => {
  const path = `$[${String(index)}]`;
  const { budgets } = manifest;
  const limits = [
    ['memoryPeakMb', budgets.memoryPeakMb, 25, 'MEMORY_BUDGET_EXCEEDED'],
    ['idleCpuPercent', budgets.idleCpuPercent, 0.5, 'IDLE_CPU_BUDGET_EXCEEDED'],
    ['pollingHz', budgets.pollingHz, 1, 'POLLING_BUDGET_EXCEEDED'],
    ['cancellationMs', budgets.cancellationMs, 250, 'CANCELLATION_BUDGET_EXCEEDED'],
  ] as const;
  for (const [field, value, limit, code] of limits) {
    if (!Number.isFinite(value) || value < 0 || value > limit) {
      diagnostics.push(
        diagnostic(
          code,
          `${path}.budgets.${field}`,
          `${field}=${String(value)} exceeds the approved limit ${String(limit)}.`,
        ),
      );
    }
  }
  if (manifest.runKind === 'packaged-physical' && budgets.sampleDurationSeconds < 300) {
    diagnostics.push(
      diagnostic(
        'PHYSICAL_SAMPLE_TOO_SHORT',
        `${path}.budgets.sampleDurationSeconds`,
        'Physical resource evidence requires at least five minutes.',
      ),
    );
  }
  if (manifest.privacy.rawIdentifiersFound.length > 0) {
    diagnostics.push(
      diagnostic(
        'RAW_IDENTIFIER_LEAK',
        `${path}.privacy.rawIdentifiersFound`,
        `Raw identifiers were found: ${manifest.privacy.rawIdentifiersFound.join(', ')}.`,
      ),
    );
  }
  if (!HASH_PATTERN.test(manifest.privacy.scanSha256)) {
    diagnostics.push(
      diagnostic(
        'PRIVACY_SCAN_INVALID',
        `${path}.privacy.scanSha256`,
        'Privacy scan must have an immutable SHA-256 identity.',
      ),
    );
  }
};

const validateReport = (
  manifest: Phase5EvidenceManifest,
  index: number,
  context: Phase5EvaluationContext,
  diagnostics: Phase5EvidenceDiagnostic[],
): void => {
  const path = `$[${String(index)}].report`;
  if (!isExactRelativePath(manifest.report.path) || !HASH_PATTERN.test(manifest.report.sha256)) {
    diagnostics.push(
      diagnostic('REPORT_IDENTITY_INVALID', path, 'Report path and SHA-256 must be exact.'),
    );
    return;
  }
  const contents = context.artifactContents[manifest.report.path];
  if (contents === undefined) {
    diagnostics.push(diagnostic('REPORT_MISSING', `${path}.path`, 'Evidence report is missing.'));
  } else if (sha256(contents) !== manifest.report.sha256) {
    diagnostics.push(
      diagnostic(
        'REPORT_HASH_MISMATCH',
        `${path}.sha256`,
        'Evidence report bytes do not match the manifest.',
      ),
    );
  }
};

const matrixGaps = (physical: readonly Phase5EvidenceManifest[]): string[] => {
  const matrices = physical.flatMap(({ environment }) =>
    environment.matrix === undefined ? [] : [environment.matrix],
  );
  const axes = [
    ['os', ['windows-10', 'windows-11']],
    ['cpu', ['intel', 'amd']],
    ['gpu', ['nvidia', 'amd', 'intel']],
    ['formFactor', ['desktop', 'notebook']],
    ['storage', ['nvme', 'sata-ssd']],
    ['network', ['ethernet', 'wifi']],
  ] as const;
  const gaps: string[] = [];
  for (const [axis, requiredValues] of axes) {
    for (const required of requiredValues) {
      const present = matrices.some((matrix) => {
        const value = matrix[axis];
        return Array.isArray(value) ? value.includes(required as never) : value === required;
      });
      if (!present) gaps.push(`${axis}:${required}`);
    }
  }
  return gaps.toSorted();
};

export const evaluatePhase5Evidence = (
  inputs: readonly unknown[],
  context: Phase5EvaluationContext,
): Phase5EvidenceResult => {
  const diagnostics: Phase5EvidenceDiagnostic[] = [];
  const validDeterministic: Phase5EvidenceManifest[] = [];
  const validPhysical: Phase5EvidenceManifest[] = [];
  const phase4PhysicalGaps = new Set<string>();

  for (const [index, input] of inputs.entries()) {
    const manifest = asManifest(input);
    if (manifest === null) {
      diagnostics.push(
        diagnostic(
          'EVIDENCE_MANIFEST_INVALID',
          `$[${String(index)}]`,
          'Phase 5 evidence manifest is incomplete.',
        ),
      );
      continue;
    }
    const before = diagnostics.length;
    if (!isIsoDate(manifest.generatedAt)) {
      diagnostics.push(
        diagnostic(
          'GENERATED_AT_INVALID',
          `$[${String(index)}].generatedAt`,
          'Evidence timestamp must be exact ISO date-time.',
        ),
      );
    }
    if (
      (manifest.runKind === 'packaged-physical' && !manifest.environment.physical) ||
      (manifest.runKind !== 'packaged-physical' && manifest.environment.physical)
    ) {
      diagnostics.push(
        diagnostic(
          'RUN_KIND_PHYSICAL_MISMATCH',
          `$[${String(index)}].environment.physical`,
          'Simulation and physical evidence classification disagree.',
        ),
      );
    }
    validateBuild(manifest, index, context, diagnostics);
    validateEnvironment(manifest, index, diagnostics);
    validateGates(manifest, index, context, diagnostics);
    validateBudgetsAndPrivacy(manifest, index, diagnostics);
    validateReport(manifest, index, context, diagnostics);
    for (const gap of manifest.phase4PhysicalGaps) {
      if (gap.status === 'pending') phase4PhysicalGaps.add(gap.id);
    }
    if (diagnostics.length === before) {
      if (manifest.runKind === 'deterministic-ci') validDeterministic.push(manifest);
      if (manifest.runKind === 'packaged-physical') validPhysical.push(manifest);
    }
  }

  const automatedOk = validDeterministic.length > 0;
  const currentPcAdmitted = validPhysical.length > 0;
  if (context.mode === 'final' && !currentPcAdmitted) {
    diagnostics.push(
      diagnostic(
        'PHYSICAL_CURRENT_PC_MISSING',
        '$',
        'Final verification requires one admitted packaged physical Windows run.',
      ),
    );
  }
  const physicalMatrixGaps = matrixGaps(validPhysical);
  const ok =
    diagnostics.length === 0 && automatedOk && (context.mode === 'planned' || currentPcAdmitted);
  const sortedPhase4Gaps = [...phase4PhysicalGaps].toSorted();

  return {
    ok,
    automatedOk,
    currentPcAdmitted,
    releaseReady:
      ok &&
      context.mode === 'final' &&
      physicalMatrixGaps.length === 0 &&
      sortedPhase4Gaps.length === 0,
    physicalMatrixGaps,
    phase4PhysicalGaps: sortedPhase4Gaps,
    diagnostics,
  };
};

const parseMode = (args: readonly string[]): 'planned' | 'final' =>
  args.includes('final') || args.includes('--mode=final') ? 'final' : 'planned';

const readManifest = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8')) as unknown;

const runCli = (): void => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
  const evidenceDirectory = resolve(root, 'tooling/phase5-evidence/evidence');
  const manifestPaths = [
    resolve(evidenceDirectory, 'deterministic-manifest.json'),
    resolve(evidenceDirectory, 'current-pc-manifest.json'),
  ].filter((path) => existsSync(path));
  const manifests = manifestPaths.map(readManifest);
  const artifactContents: Record<string, Uint8Array> = {};
  const gateEvidenceContents: Record<string, Uint8Array> = {};
  for (const manifestInput of manifests) {
    const manifest = asManifest(manifestInput);
    if (manifest === null) continue;
    for (const path of [manifest.build.artifactPath, manifest.report.path]) {
      const absolute = resolve(root, path);
      if (existsSync(absolute)) artifactContents[path] = readFileSync(absolute);
    }
    for (const gate of manifest.gates) {
      const gatePath = resolve(evidenceDirectory, `${manifest.runId}-${gate.id}.txt`);
      if (existsSync(gatePath)) {
        gateEvidenceContents[`${manifest.runId}:${gate.id}`] = readFileSync(gatePath);
      }
    }
  }
  const result = evaluatePhase5Evidence(manifests, {
    mode: parseMode(process.argv.slice(2)),
    artifactContents,
    gateEvidenceContents,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exitCode = 1;
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) runCli();
