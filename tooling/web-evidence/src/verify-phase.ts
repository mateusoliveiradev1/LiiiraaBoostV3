import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  validateRouteReachabilityEvidence,
  type RouteReachabilityEvidence,
} from './route-reachability.ts';

export const PHASE_3_REQUIREMENTS = ['WEB-01', 'WEB-02', 'WEB-03', 'WEB-08'] as const;
export const PHASE_3_SUCCESS_CRITERIA = ['SC-01', 'SC-02', 'SC-03', 'SC-04'] as const;
export const PHASE_3_DECISIONS = Array.from(
  { length: 101 },
  (_, index) => `D-${String(index + 1).padStart(2, '0')}`,
);
export const PHASE_3_SCENARIOS = Array.from(
  { length: 18 },
  (_, index) => `W${String(index + 1).padStart(2, '0')}`,
);
export const PHASE_3_LOCALES = ['pt-BR', 'en'] as const;
export const PHASE_3_ROUTES = [
  'public-home',
  'public-product',
  'public-results',
  'public-evidence',
  'public-compatibility',
  'public-plans',
  'public-download',
  'public-search',
  'public-support',
  'public-status',
  'public-policies',
  'public-privacy-policy',
  'public-terms',
  'public-responsible-disclosure',
  'docs-index',
  'docs-task',
  'docs-article',
  'docs-reference',
  'docs-troubleshooting',
  'docs-history',
  'releases-index',
  'releases-channel',
  'releases-version',
  'releases-integrity',
  'releases-download',
  'releases-install',
  'account-sign-in',
  'account-sign-up',
  'account-onboarding',
  'account-overview',
  'account-profile',
  'account-security',
  'account-subscription',
  'account-invoices',
  'account-device',
  'account-downloads',
  'account-privacy',
  'account-support',
  'admin-role',
  'admin-support',
  'admin-operations',
  'admin-security',
  'admin-diagnostics',
  'admin-audit',
  'admin-audit-event',
  'public-error-404',
  'public-error-403',
  'public-error-410',
  'public-error-500',
  'account-error-404',
  'account-error-403',
  'account-error-410',
  'account-error-500',
  'admin-error-404',
  'admin-error-403',
  'admin-error-410',
  'admin-error-500',
] as const;

const QUALITY_DIMENSIONS = [
  'security',
  'privacy',
  'accessibility',
  'performance',
  'recovery',
] as const;

export const PHASE_3_EVIDENCE_DIMENSIONS = PHASE_3_REQUIREMENTS.flatMap((requirement) =>
  QUALITY_DIMENSIONS.map((dimension) => `${requirement}:${dimension}`),
);

export const PHASE_3_PROOFS = [
  {
    file: 'quality/evidence/phase-03/web/public-routes.json',
    id: 'public-routes',
    owner: 'plan-03-32',
  },
  {
    file: 'quality/evidence/phase-03/web/content-publication.json',
    id: 'content-publication',
    owner: 'plan-03-32',
  },
  {
    file: 'quality/evidence/phase-03/web/visual-report.json',
    id: 'visual-report',
    owner: 'plan-03-32',
  },
  {
    file: 'quality/evidence/phase-03/web/docs-routes.json',
    id: 'docs-routes',
    owner: 'plan-03-32',
  },
  {
    file: 'quality/evidence/phase-03/web/docs-publication.json',
    id: 'docs-publication',
    owner: 'plan-03-32',
  },
  {
    file: 'quality/evidence/phase-03/web/release-gate.json',
    id: 'release-gate',
    owner: 'plan-03-32',
  },
  {
    file: 'quality/evidence/phase-03/web/release-artifact.json',
    id: 'release-artifact',
    owner: 'plan-03-32',
  },
  {
    file: 'quality/evidence/phase-03/web/security-boundaries.json',
    id: 'security-boundaries',
    owner: 'plan-03-32',
  },
  {
    file: 'quality/evidence/phase-03/web/preview-boundaries.json',
    id: 'preview-boundaries',
    owner: 'plan-03-32',
  },
  {
    file: 'quality/evidence/phase-03/web/accessibility-report.json',
    id: 'accessibility-report',
    owner: 'plan-03-32',
  },
  {
    file: 'quality/evidence/phase-03/web/approved-publication-bundle.json',
    id: 'approved-publication-bundle',
    owner: 'plan-03-32',
  },
  {
    file: 'quality/evidence/phase-03/web/route-reachability.json',
    id: 'route-reachability',
    owner: 'plan-03-35',
  },
] as const;

export const PHASE_3_SOURCE_FILES = [
  '.planning/ROADMAP.md',
  '.planning/REQUIREMENTS.md',
  '.planning/phases/03-complete-web-experience/03-CONTEXT.md',
  'contracts/scenarios/web-scenarios.json',
  'packages/web-core/src/routes.ts',
  'apps/web/src/content/public/catalog.pt-BR.json',
  'apps/web/src/content/public/catalog.en.json',
  'apps/web/src/content/docs/docs.metadata.json',
  'apps/web/src/content/releases/releases.metadata.json',
  'tooling/web-evidence/capture-manifest.json',
  'tooling/web-evidence/visual-manifest.json',
  'tooling/web-evidence/tests/public.spec.ts',
  'tooling/web-evidence/tests/documentation.spec.ts',
  'tooling/web-evidence/tests/releases.spec.ts',
  'tooling/web-evidence/tests/account.spec.ts',
  'tooling/web-evidence/tests/admin.spec.ts',
  'tooling/web-evidence/tests/security-artifacts.spec.ts',
  'tooling/web-evidence/tests/accessibility-responsive.spec.ts',
  'tooling/web-evidence/src/publication.ts',
  'tooling/web-evidence/src/route-reachability.ts',
  'tooling/web-evidence/src/rollback-bundle.ts',
  'quality/features/WEB-01.json',
  'quality/features/WEB-02.json',
  'quality/features/WEB-03.json',
  'quality/features/WEB-08.json',
] as const;

export type Phase3VerificationMode = 'planned' | 'final';
type Requirement = (typeof PHASE_3_REQUIREMENTS)[number];
type WebLocale = (typeof PHASE_3_LOCALES)[number];
type WebSurface = 'public' | 'account' | 'admin';

export interface Phase3Diagnostic {
  readonly code: string;
  readonly path: string;
}

export interface Phase3EvidenceReference {
  command: string;
  file: string;
  id: string;
  identity: string;
  owner: string;
  status: 'planned' | 'passed';
}

export interface Phase3VerificationArtifacts {
  appArtifacts: {
    classification: 'production-build' | 'development' | 'source-tree';
    hash: string;
    path: string;
    state: 'planned' | 'observed';
    surface: WebSurface;
  }[];
  authority: {
    adminMutationConnected: boolean;
    billingConnected: boolean;
    diagnosticUploadConnected: boolean;
    identityConnected: boolean;
    publicDistributionConnected: boolean;
    supportSubmissionConnected: boolean;
  };
  captures: {
    approved: boolean;
    hash: string;
    locale: WebLocale;
    path: string;
    scenarioId: string;
    sidecarPath: string;
  }[];
  decisions: string[];
  evidence: Phase3EvidenceReference[];
  locales: string[];
  proofs: {
    file: string;
    id: string;
    owner: string;
    status: 'planned' | 'passed';
  }[];
  publication: {
    approved: boolean;
    bundleFile: string;
    developmentArtifactDetected: boolean;
    downloadAvailable: boolean;
    officialArtifact: 'available' | 'unavailable';
    publicDistributionApproved: boolean;
  };
  requirements: string[];
  routeReachability: RouteReachabilityEvidence;
  routes: string[];
  scenarios: string[];
  sourceHashes: { file: string; sha256: string }[];
  successCriteria: string[];
}

export interface Phase3VerificationInput {
  artifacts: Phase3VerificationArtifacts;
  commands: string[];
  mode: string;
  repositoryFiles: string[];
}

export type Phase3VerificationResult = Readonly<
  | { diagnostics: readonly Phase3Diagnostic[]; ok: false }
  | {
      counts: Readonly<{
        decisions: number;
        evidenceDimensions: number;
        requirements: number;
        routeOutcomes: number;
        routes: number;
        scenarios: number;
        successCriteria: number;
      }>;
      diagnostics: readonly [];
      fingerprint: string;
      ok: true;
    }
>;

const SHA256 = /^[a-f0-9]{64}$/u;
const EXACT_PATH = /^(?![A-Za-z]:)(?!\/)(?!.*(?:^|\/)\.\.?\/)(?!.*[*?\[\]{}])[^\\\r\n]+$/u;
const ROOT_COMMANDS = ['pnpm web:verify:phase -- --mode final', 'pnpm verify'] as const;

const diagnostic = (code: string, path: string): Phase3Diagnostic => Object.freeze({ code, path });

const sortedDiagnostics = (diagnostics: readonly Phase3Diagnostic[]): readonly Phase3Diagnostic[] =>
  Object.freeze(
    [...diagnostics].toSorted(
      (left, right) => left.path.localeCompare(right.path) || left.code.localeCompare(right.code),
    ),
  );

const duplicates = (values: readonly string[]): readonly string[] =>
  [...new Set(values.filter((value, index) => values.indexOf(value) !== index))].toSorted();

const validateClosedSet = (
  expected: readonly string[],
  actual: readonly string[],
  label: string,
  diagnostics: Phase3Diagnostic[],
): void => {
  for (const value of expected) {
    if (!actual.includes(value))
      diagnostics.push(diagnostic(`MISSING_${label}`, `$.${label}.${value}`));
  }
  for (const value of actual) {
    if (!expected.includes(value))
      diagnostics.push(diagnostic(`UNKNOWN_${label}`, `$.${label}.${value}`));
  }
  for (const value of duplicates(actual)) {
    diagnostics.push(diagnostic(`DUPLICATE_${label}`, `$.${label}.${value}`));
  }
};

const validateEvidence = (
  input: Phase3VerificationInput,
  diagnostics: Phase3Diagnostic[],
): void => {
  validateClosedSet(
    PHASE_3_EVIDENCE_DIMENSIONS,
    input.artifacts.evidence.map(({ identity }) => identity),
    'EVIDENCE_DIMENSION',
    diagnostics,
  );

  for (const evidence of input.artifacts.evidence) {
    const path = `$.evidence.${evidence.identity}`;
    if (evidence.owner !== 'plan-03-32')
      diagnostics.push(diagnostic('EVIDENCE_OWNER_MISMATCH', `${path}.owner`));
    if (!EXACT_PATH.test(evidence.file))
      diagnostics.push(diagnostic('EVIDENCE_PATH_NOT_EXACT', `${path}.file`));
    if (/(?:&&|\|\||[;<>]|--watch|\s-w(?:\s|$))/u.test(evidence.command)) {
      diagnostics.push(diagnostic('EVIDENCE_COMMAND_NOT_TERMINATING', `${path}.command`));
    }
    if (input.mode === 'final' && evidence.status !== 'passed') {
      diagnostics.push(diagnostic('EVIDENCE_NOT_FINAL', `${path}.status`));
    }
    if (input.mode === 'final' && !input.repositoryFiles.includes(evidence.file)) {
      diagnostics.push(diagnostic('EVIDENCE_FILE_MISSING', `${path}.file`));
    }
    if (input.mode === 'final' && !input.commands.includes(evidence.command)) {
      diagnostics.push(diagnostic('EVIDENCE_COMMAND_UNRESOLVED', `${path}.command`));
    }
  }
};

const validateAppArtifacts = (
  input: Phase3VerificationInput,
  diagnostics: Phase3Diagnostic[],
): void => {
  const surfaces = input.artifacts.appArtifacts.map(({ surface }) => surface);
  validateClosedSet(['public', 'account', 'admin'], surfaces, 'APP_ARTIFACT', diagnostics);
  const paths = input.artifacts.appArtifacts.map(({ path }) => path);
  const hashes = input.artifacts.appArtifacts.map(({ hash }) => hash);
  if (new Set(paths).size !== paths.length || new Set(hashes).size !== hashes.length) {
    diagnostics.push(diagnostic('APP_ARTIFACTS_NOT_INDEPENDENT', '$.appArtifacts'));
  }
  for (const artifact of input.artifacts.appArtifacts) {
    const path = `$.appArtifacts.${artifact.surface}`;
    const expectedPath =
      artifact.surface === 'public'
        ? 'apps/web/.next/standalone'
        : `apps/${artifact.surface}/.next/standalone`;
    if (artifact.path !== expectedPath) {
      diagnostics.push(diagnostic('APP_ARTIFACT_PATH_MISMATCH', `${path}.path`));
    }
    if (artifact.classification !== 'production-build') {
      diagnostics.push(diagnostic('DEVELOPMENT_ARTIFACT_REJECTED', `${path}.classification`));
    }
    if (!SHA256.test(artifact.hash))
      diagnostics.push(diagnostic('APP_ARTIFACT_HASH_INVALID', `${path}.hash`));
    if (input.mode === 'final' && artifact.state !== 'observed') {
      diagnostics.push(diagnostic('APP_ARTIFACT_NOT_OBSERVED', `${path}.state`));
    }
    if (input.mode === 'final' && !input.repositoryFiles.includes(artifact.path)) {
      diagnostics.push(diagnostic('APP_ARTIFACT_FILE_MISSING', `${path}.path`));
    }
  }
};

const validateCaptures = (
  input: Phase3VerificationInput,
  diagnostics: Phase3Diagnostic[],
): void => {
  validateClosedSet(
    PHASE_3_LOCALES,
    input.artifacts.captures.map(({ locale }) => locale),
    'CAPTURE',
    diagnostics,
  );
  for (const capture of input.artifacts.captures) {
    const path = `$.captures.${capture.locale}`;
    if (!capture.approved || capture.scenarioId !== 'S01' || !SHA256.test(capture.hash)) {
      diagnostics.push(diagnostic('CAPTURE_NOT_APPROVED', path));
    }
    if (
      input.mode === 'final' &&
      (!input.repositoryFiles.includes(capture.path) ||
        !input.repositoryFiles.includes(capture.sidecarPath))
    ) {
      diagnostics.push(diagnostic('CAPTURE_FILE_MISSING', path));
    }
  }
};

const validateProofs = (input: Phase3VerificationInput, diagnostics: Phase3Diagnostic[]): void => {
  validateClosedSet(
    PHASE_3_PROOFS.map(({ id }) => id),
    input.artifacts.proofs.map(({ id }) => id),
    'PROOF',
    diagnostics,
  );
  for (const proof of input.artifacts.proofs) {
    const expected = PHASE_3_PROOFS.find(({ id }) => id === proof.id);
    const path = `$.proofs.${proof.id}`;
    if (expected !== undefined && proof.file !== expected.file) {
      diagnostics.push(diagnostic('PROOF_PATH_MISMATCH', `${path}.file`));
    }
    if (expected !== undefined && proof.owner !== expected.owner) {
      diagnostics.push(diagnostic('PROOF_OWNER_MISMATCH', `${path}.owner`));
    }
    if (input.mode === 'final' && proof.status !== 'passed') {
      diagnostics.push(diagnostic('PROOF_NOT_FINAL', `${path}.status`));
    }
    if (input.mode === 'final' && !input.repositoryFiles.includes(proof.file)) {
      diagnostics.push(diagnostic('PROOF_FILE_MISSING', `${path}.file`));
    }
  }
};

const validateRouteReachability = (
  input: Phase3VerificationInput,
  diagnostics: Phase3Diagnostic[],
  repositoryRoot: string,
): void => {
  const result = validateRouteReachabilityEvidence(
    input.artifacts.routeReachability,
    repositoryRoot,
  );
  if (!result.ok) {
    for (const item of result.diagnostics) {
      const separator = item.indexOf(' ');
      const code = separator < 0 ? item : item.slice(0, separator);
      const sourcePath = separator < 0 ? '$' : item.slice(separator + 1);
      const path =
        sourcePath === '$' ? '$.routeReachability' : `$.routeReachability${sourcePath.slice(1)}`;
      diagnostics.push(diagnostic(`ROUTE_REACHABILITY_${code}`, path));
    }
  }

  const proof = input.artifacts.proofs.find(({ id }) => id === 'route-reachability');
  const artifact = input.artifacts.routeReachability;
  if (
    proof !== undefined &&
    artifact !== undefined &&
    (proof.owner !== artifact.owner || proof.status !== artifact.status)
  ) {
    diagnostics.push(diagnostic('ROUTE_REACHABILITY_PROOF_MISMATCH', '$.routeReachability'));
  }
};

const validateSources = (input: Phase3VerificationInput, diagnostics: Phase3Diagnostic[]): void => {
  validateClosedSet(
    PHASE_3_SOURCE_FILES,
    input.artifacts.sourceHashes.map(({ file }) => file),
    'SOURCE_HASH',
    diagnostics,
  );
  for (const source of input.artifacts.sourceHashes) {
    if (!SHA256.test(source.sha256)) {
      diagnostics.push(diagnostic('SOURCE_HASH_INVALID', `$.sourceHashes.${source.file}`));
    }
    if (input.mode === 'final' && !input.repositoryFiles.includes(source.file)) {
      diagnostics.push(diagnostic('SOURCE_FILE_MISSING', `$.sourceHashes.${source.file}`));
    }
  }
};

const validateTruth = (input: Phase3VerificationInput, diagnostics: Phase3Diagnostic[]): void => {
  if (Object.values(input.artifacts.authority).some(Boolean)) {
    diagnostics.push(diagnostic('DEFERRED_AUTHORITY_CONNECTED', '$.authority'));
  }
  const publication = input.artifacts.publication;
  if (
    !publication.approved ||
    publication.downloadAvailable ||
    publication.publicDistributionApproved ||
    publication.officialArtifact !== 'unavailable' ||
    publication.developmentArtifactDetected
  ) {
    diagnostics.push(diagnostic('PUBLIC_DISTRIBUTION_TRUTH_VIOLATION', '$.publication'));
  }
  if (publication.bundleFile !== 'quality/evidence/phase-03/web/approved-publication-bundle.json') {
    diagnostics.push(diagnostic('PUBLICATION_BUNDLE_PATH_MISMATCH', '$.publication.bundleFile'));
  }
};

export const verifyPhase3 = (
  input: Phase3VerificationInput,
  repositoryRoot = resolve(import.meta.dirname, '../../..'),
): Phase3VerificationResult => {
  const diagnostics: Phase3Diagnostic[] = [];
  if (input.mode !== 'planned' && input.mode !== 'final') {
    diagnostics.push(diagnostic('VERIFICATION_MODE_INVALID', '$.mode'));
  }

  validateClosedSet(PHASE_3_REQUIREMENTS, input.artifacts.requirements, 'REQUIREMENT', diagnostics);
  validateClosedSet(
    PHASE_3_SUCCESS_CRITERIA,
    input.artifacts.successCriteria,
    'SUCCESS_CRITERION',
    diagnostics,
  );
  validateClosedSet(PHASE_3_DECISIONS, input.artifacts.decisions, 'DECISION', diagnostics);
  validateClosedSet(PHASE_3_SCENARIOS, input.artifacts.scenarios, 'SCENARIO', diagnostics);
  validateClosedSet(PHASE_3_ROUTES, input.artifacts.routes, 'ROUTE', diagnostics);
  validateRouteReachability(input, diagnostics, resolve(repositoryRoot));
  validateClosedSet(PHASE_3_LOCALES, input.artifacts.locales, 'LOCALE', diagnostics);
  validateEvidence(input, diagnostics);
  validateAppArtifacts(input, diagnostics);
  validateCaptures(input, diagnostics);
  validateProofs(input, diagnostics);
  validateSources(input, diagnostics);
  validateTruth(input, diagnostics);

  if (input.mode === 'final') {
    for (const command of ROOT_COMMANDS) {
      if (!input.commands.includes(command)) {
        diagnostics.push(diagnostic('ROOT_COMMAND_UNREACHABLE', `$.commands.${command}`));
      }
    }
  }

  const failures = sortedDiagnostics(diagnostics);
  if (failures.length > 0) return Object.freeze({ diagnostics: failures, ok: false });

  return Object.freeze({
    counts: Object.freeze({
      decisions: PHASE_3_DECISIONS.length,
      evidenceDimensions: PHASE_3_EVIDENCE_DIMENSIONS.length,
      requirements: PHASE_3_REQUIREMENTS.length,
      routeOutcomes: input.artifacts.routeReachability.observations.length,
      routes: PHASE_3_ROUTES.length,
      scenarios: PHASE_3_SCENARIOS.length,
      successCriteria: PHASE_3_SUCCESS_CRITERIA.length,
    }),
    diagnostics: [] as const,
    fingerprint: createHash('sha256').update(JSON.stringify(input)).digest('hex'),
    ok: true,
  });
};

interface QualityManifestShape {
  readonly acceptance: Readonly<
    Record<string, Readonly<{ evidence?: readonly Phase3EvidenceReference[] }>>
  >;
  readonly requirements: readonly Requirement[];
}

interface CaptureManifestShape {
  readonly captures: readonly Readonly<{
    imageSha256: string;
    locale: WebLocale;
    outputPath: string;
    review: Readonly<{ state: string }>;
    scenarioId: string;
    sidecarPath: string;
  }>[];
}

interface ScenarioManifestShape {
  readonly scenarios: readonly Readonly<{ id: string }>[];
}

interface ProofShape {
  readonly id: string;
  readonly owner: string;
  readonly status: string;
}

interface PreviewProofShape extends ProofShape {
  readonly authority: Phase3VerificationArtifacts['authority'];
}

interface ApprovedBundleShape extends ProofShape {
  readonly appArtifacts: readonly Readonly<{
    hash: string;
    path: string;
    surface: WebSurface;
  }>[];
  readonly finalApproved: boolean;
  readonly releaseTruth: Readonly<{
    developmentArtifactDetected: boolean;
    downloadAvailable: boolean;
    officialArtifact: 'available' | 'unavailable';
    publicDistributionApproved: boolean;
  }>;
}

const readJson = (repositoryRoot: string, file: string): unknown =>
  JSON.parse(readFileSync(join(repositoryRoot, file), 'utf8')) as unknown;

const fileHash = (repositoryRoot: string, file: string): string =>
  createHash('sha256')
    .update(readFileSync(join(repositoryRoot, file)))
    .digest('hex');

const canonicalTextFileHash = (repositoryRoot: string, file: string): string =>
  createHash('sha256')
    .update(readFileSync(join(repositoryRoot, file), 'utf8').replaceAll('\r\n', '\n'))
    .digest('hex');

const nonEmptyDirectory = (repositoryRoot: string, file: string): boolean => {
  const path = join(repositoryRoot, file);
  return existsSync(path) && statSync(path).isDirectory() && readdirSync(path).length > 0;
};

const collectReachableCommands = (repositoryRoot: string): string[] => {
  const manifest = readJson(repositoryRoot, 'package.json') as {
    readonly scripts?: Readonly<Record<string, string>>;
  };
  const scripts = manifest.scripts ?? {};
  const visited = new Set<string>();
  const bodies: string[] = [];
  const commands = new Set<string>(['pnpm verify']);
  const visit = (name: string): void => {
    if (visited.has(name)) return;
    visited.add(name);
    const body = scripts[name];
    if (body === undefined) return;
    bodies.push(body);
    commands.add(`pnpm ${name}`);
    for (const match of body.matchAll(/(?:^|&&)\s*pnpm\s+([a-z][\w:-]*)/gu)) {
      const child = match[1];
      if (child !== undefined) visit(child);
    }
  };
  visit('verify');
  const graph = bodies.join('\n');
  const browserCommand = 'pnpm --filter @liiiraa/web-evidence exec playwright test';
  if (graph.includes(browserCommand)) commands.add(browserCommand);
  if (
    graph.includes('pnpm web:verify:quick') &&
    readFileSync(join(repositoryRoot, 'tooling/web-evidence/run-web-verify.mjs'), 'utf8').includes(
      "['web:test']",
    )
  ) {
    commands.add('pnpm web:test');
  }
  commands.add('pnpm web:verify:phase -- --mode final');
  return [...commands];
};

export const createRepositoryPhase3Input = (
  mode: Phase3VerificationMode,
  repositoryRoot = process.cwd(),
): Phase3VerificationInput => {
  const evidence = PHASE_3_REQUIREMENTS.flatMap((requirement) => {
    const manifest = readJson(
      repositoryRoot,
      `quality/features/${requirement}.json`,
    ) as QualityManifestShape;
    return Object.entries(manifest.acceptance).flatMap(([dimension, entry]) =>
      (entry.evidence ?? []).map((reference) => ({
        ...reference,
        identity: `${requirement}:${dimension}`,
      })),
    );
  });
  const context = readFileSync(
    join(repositoryRoot, '.planning/phases/03-complete-web-experience/03-CONTEXT.md'),
    'utf8',
  );
  const routeSource = readFileSync(join(repositoryRoot, 'packages/web-core/src/routes.ts'), 'utf8');
  const scenarios = readJson(
    repositoryRoot,
    'contracts/scenarios/web-scenarios.json',
  ) as ScenarioManifestShape;
  const captureManifest = readJson(
    repositoryRoot,
    'tooling/web-evidence/capture-manifest.json',
  ) as CaptureManifestShape;
  const proofs = PHASE_3_PROOFS.map(({ file, id }) => {
    const proof = readJson(repositoryRoot, file) as ProofShape;
    return {
      file,
      id: proof.id === id ? id : proof.id,
      owner: proof.owner,
      status: proof.status as 'planned' | 'passed',
    };
  });
  const routeReachability = readJson(
    repositoryRoot,
    'quality/evidence/phase-03/web/route-reachability.json',
  ) as RouteReachabilityEvidence;
  const previewProof = readJson(
    repositoryRoot,
    'quality/evidence/phase-03/web/preview-boundaries.json',
  ) as PreviewProofShape;
  const approvedBundle = readJson(
    repositoryRoot,
    'quality/evidence/phase-03/web/approved-publication-bundle.json',
  ) as ApprovedBundleShape;
  const appArtifacts = (
    [
      ['public', 'web'],
      ['account', 'account'],
      ['admin', 'admin'],
    ] as const
  ).map(([surface, app]) => {
    const expectedPath = `apps/${app}/.next/standalone`;
    const packageFile = `apps/${app}/package.json`;
    const expectedHashes = new Set([
      fileHash(repositoryRoot, packageFile),
      canonicalTextFileHash(repositoryRoot, packageFile),
    ]);
    const plannedHash = canonicalTextFileHash(repositoryRoot, packageFile);
    const bundled = approvedBundle.appArtifacts.find((artifact) => artifact.surface === surface);
    return {
      classification: 'production-build' as const,
      hash:
        bundled !== undefined && expectedHashes.has(bundled.hash)
          ? bundled.hash
          : mode === 'planned'
            ? plannedHash
            : 'bundle-hash-mismatch',
      path: bundled?.path ?? expectedPath,
      state:
        bundled?.path === expectedPath && nonEmptyDirectory(repositoryRoot, expectedPath)
          ? ('observed' as const)
          : ('planned' as const),
      surface,
    };
  });
  const exactFiles = new Set<string>([
    ...PHASE_3_SOURCE_FILES,
    ...PHASE_3_PROOFS.map(({ file }) => file),
    ...evidence.map(({ file }) => file),
    ...captureManifest.captures.flatMap(({ outputPath, sidecarPath }) => [outputPath, sidecarPath]),
    ...appArtifacts.filter(({ state }) => state === 'observed').map(({ path }) => path),
  ]);

  return {
    artifacts: {
      appArtifacts,
      authority: previewProof.authority,
      captures: captureManifest.captures.map((capture) => ({
        approved: capture.review.state === 'approved',
        hash: capture.imageSha256,
        locale: capture.locale,
        path: capture.outputPath,
        scenarioId: capture.scenarioId,
        sidecarPath: capture.sidecarPath,
      })),
      decisions: [...context.matchAll(/- \*\*(D-\d{2,3}):/gu)].map((match) => match[1] ?? ''),
      evidence,
      locales: [...PHASE_3_LOCALES],
      proofs,
      publication: {
        approved: approvedBundle.finalApproved && approvedBundle.status === 'passed',
        bundleFile: 'quality/evidence/phase-03/web/approved-publication-bundle.json',
        ...approvedBundle.releaseTruth,
      },
      requirements: [...PHASE_3_REQUIREMENTS],
      routeReachability,
      routes: [...routeSource.matchAll(/(?:public|account|admin)Route\('([^']+)'/gu)].map(
        (match) => match[1] ?? '',
      ),
      scenarios: scenarios.scenarios.map(({ id }) => id),
      sourceHashes: PHASE_3_SOURCE_FILES.map((file) => ({
        file,
        sha256: fileHash(repositoryRoot, file),
      })),
      successCriteria: [...PHASE_3_SUCCESS_CRITERIA],
    },
    commands: collectReachableCommands(repositoryRoot),
    mode,
    repositoryFiles: [...exactFiles].filter(
      (file) => existsSync(join(repositoryRoot, file)) || nonEmptyDirectory(repositoryRoot, file),
    ),
  };
};

const parseMode = (arguments_: readonly string[]): Phase3VerificationMode => {
  const indexes = arguments_
    .map((argument, index) => (argument === '--mode' ? index : -1))
    .filter((index) => index >= 0);
  if (indexes.length !== 1) throw new Error('Provide --mode planned|final exactly once.');
  const value = arguments_[(indexes[0] ?? -1) + 1];
  if (value !== 'planned' && value !== 'final') {
    throw new Error('--mode must be followed by planned or final.');
  }
  return value;
};

const isDirectExecution = process.argv[1]?.replaceAll('\\', '/').endsWith('/verify-phase.ts');

if (isDirectExecution) {
  try {
    const mode = parseMode(process.argv.slice(2));
    const repositoryRoot = resolve(process.cwd());
    const before = new Map(
      PHASE_3_SOURCE_FILES.map((file) => [file, fileHash(repositoryRoot, file)]),
    );
    const result = verifyPhase3(createRepositoryPhase3Input(mode, repositoryRoot), repositoryRoot);
    const mutated = PHASE_3_SOURCE_FILES.find(
      (file) => before.get(file) !== fileHash(repositoryRoot, file),
    );
    if (!result.ok || mutated !== undefined) {
      for (const item of result.diagnostics) console.error(`${item.code} ${item.path}`);
      if (mutated !== undefined) console.error(`SOURCE_ARTIFACT_MUTATED $.sourceHashes.${mutated}`);
      process.exitCode = 1;
    } else {
      console.log(
        `Phase 3 verification passed in ${mode} mode (${result.fingerprint}; ${String(result.counts.decisions)} decisions, ${String(result.counts.routes)} routes, ${String(result.counts.routeOutcomes)} observed route outcomes, ${String(result.counts.scenarios)} scenarios).`,
      );
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
