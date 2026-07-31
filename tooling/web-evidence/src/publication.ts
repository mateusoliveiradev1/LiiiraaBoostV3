import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const PUBLICATION_GATE_NAMES = [
  'route',
  'link',
  'contract',
  'schema',
  'type',
  'build',
  'security',
  'privacy',
  'accessibility',
  'responsive',
  'visual',
  'performance',
  'seo',
  'localization',
  'screenshot',
  'evidence',
  'e2e',
] as const;

export type PublicationGateName = (typeof PUBLICATION_GATE_NAMES)[number];
export type WebPublicationMode = 'planned' | 'final';
export type WebSurface = 'public' | 'account' | 'admin';

export const PUBLICATION_ARTIFACT_KINDS = [
  'content',
  'routes',
  'release',
  'support',
  'assets',
  'screenshots',
  'channels',
  'policies',
  'evidence',
  'visual',
  'capture',
] as const;

export type PublicationArtifactKind = (typeof PUBLICATION_ARTIFACT_KINDS)[number];

export interface PublicationFailure {
  readonly code: string;
  readonly path: string;
}

export interface PublicationAppArtifact {
  readonly buildId: string;
  readonly classification: 'production-build' | 'development' | 'source-tree';
  readonly contentId: string;
  readonly hash: string;
  readonly path: string;
  readonly state: 'planned' | 'observed';
  readonly surface: WebSurface;
}

export interface PublicationArtifact {
  readonly buildId: string;
  readonly contentId: string;
  readonly hash: string;
  readonly id: string;
  readonly kind: PublicationArtifactKind;
  readonly path: string;
}

export interface PublicationContentRecord {
  readonly criticalCopyLocales: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly id: string;
  readonly imageryLocales: readonly string[];
  readonly locales: readonly string[];
  readonly reviewBy: string;
  readonly screenshotIds: readonly string[];
  readonly warningLocales: readonly string[];
}

export interface PublicationCapture {
  readonly approved: boolean;
  readonly id: string;
  readonly imageHash: string;
  readonly locale: string;
  readonly publicationBuildId: string;
  readonly scenarioId: string;
  readonly sidecarHash: string;
  readonly sourceBuildId: string;
}

export interface PublicationGate {
  readonly command: string;
  readonly evidenceId: string;
  readonly file: string;
  readonly name: PublicationGateName;
  readonly state: 'planned' | 'passed' | 'failed';
}

export interface PublicationQualityManifest {
  readonly featureId: string;
  readonly hash: string;
  readonly owner: string;
  readonly requirement: 'WEB-01' | 'WEB-02' | 'WEB-03' | 'WEB-08';
  readonly state: 'planned' | 'passed' | 'failed';
}

export interface PublicationVisual {
  readonly hash: string;
  readonly routeId: string;
  readonly scenarioId: string;
  readonly state: 'planned' | 'passed' | 'failed';
}

export interface WebPublicationInput {
  readonly appArtifacts: readonly PublicationAppArtifact[];
  readonly artifacts: readonly PublicationArtifact[];
  readonly asOf: string;
  readonly bundle: Readonly<{
    buildId: string;
    contentId: string;
    evidenceId: string;
    policyId: string;
    releaseId: string;
    routeId: string;
    screenshotId: string;
  }>;
  readonly captures: readonly PublicationCapture[];
  readonly content: readonly PublicationContentRecord[];
  readonly gates: readonly PublicationGate[];
  readonly mode: WebPublicationMode;
  readonly observedCommands: readonly string[];
  readonly observedFiles: readonly string[];
  readonly qualityManifests: readonly PublicationQualityManifest[];
  readonly releaseTruth: Readonly<{
    developmentArtifactDetected: boolean;
    downloadAvailable: boolean;
    officialArtifact: 'unavailable' | 'available';
    previewAuthorityConnected: Readonly<Record<WebSurface, boolean>>;
    publicDistributionApproved: boolean;
  }>;
  readonly routeParity: Readonly<{
    canonicalLinkIds: readonly string[];
    canonicalRouteIds: readonly string[];
    emittedLinkIds: readonly string[];
    emittedRouteIds: readonly string[];
  }>;
  readonly visuals: readonly PublicationVisual[];
}

export type WebPublicationResult = Readonly<
  | {
      failures: readonly PublicationFailure[];
      ok: false;
    }
  | {
      failures: readonly [];
      fingerprint: string;
      ok: true;
    }
>;

const SHA256 = /^[a-f0-9]{64}$/u;
const REQUIRED_LOCALES = ['pt-BR', 'en'] as const;
const REQUIRED_REQUIREMENTS = ['WEB-01', 'WEB-02', 'WEB-03', 'WEB-08'] as const;
const REQUIRED_SURFACES = ['public', 'account', 'admin'] as const;
const REQUIRED_VISUALS = Array.from(
  { length: 18 },
  (_, index) => `W${String(index + 1).padStart(2, '0')}`,
);

const failure = (code: string, path: string): PublicationFailure => Object.freeze({ code, path });

const sortedFailures = (failures: readonly PublicationFailure[]): readonly PublicationFailure[] =>
  Object.freeze(
    [...failures].toSorted(
      (left, right) => left.path.localeCompare(right.path) || left.code.localeCompare(right.code),
    ),
  );

const exactSet = (expected: readonly string[], actual: readonly string[]): boolean =>
  expected.length === actual.length &&
  [...expected].toSorted().every((value, index) => value === [...actual].toSorted()[index]);

const isNonEmpty = (value: string): boolean => value.trim().length > 0;

const hasLocales = (locales: readonly string[]): boolean =>
  REQUIRED_LOCALES.every((locale) => locales.includes(locale));

const isFinalState = (mode: WebPublicationMode, state: 'planned' | 'passed' | 'failed'): boolean =>
  mode === 'planned' || state === 'passed';

const validateBundle = (input: WebPublicationInput, failures: PublicationFailure[]): void => {
  for (const [name, value] of Object.entries(input.bundle)) {
    if (!isNonEmpty(value)) failures.push(failure('EMPTY_BUNDLE_IDENTITY', `$.bundle.${name}`));
  }
  if (!Number.isFinite(Date.parse(`${input.asOf}T00:00:00.000Z`))) {
    failures.push(failure('PUBLICATION_CONTEXT_INVALID', '$.asOf'));
  }
};

const validateArtifacts = (input: WebPublicationInput, failures: PublicationFailure[]): void => {
  for (const kind of PUBLICATION_ARTIFACT_KINDS) {
    const matching = input.artifacts.filter((artifact) => artifact.kind === kind);
    if (matching.length === 0) {
      failures.push(failure(`MISSING_${kind.toUpperCase()}_ARTIFACT`, `$.artifacts.${kind}`));
      continue;
    }
    if (matching.length > 1) {
      failures.push(failure('DUPLICATE_ARTIFACT', `$.artifacts.${kind}`));
    }
  }

  const identityIds: Readonly<Partial<Record<PublicationArtifactKind, string>>> = {
    evidence: input.bundle.evidenceId,
    policies: input.bundle.policyId,
    release: input.bundle.releaseId,
    routes: input.bundle.routeId,
    screenshots: input.bundle.screenshotId,
  };

  for (const artifact of input.artifacts) {
    const path = `$.artifacts.${artifact.kind}`;
    if (!isNonEmpty(artifact.id) || !isNonEmpty(artifact.path) || !SHA256.test(artifact.hash)) {
      failures.push(failure('EMPTY_ARTIFACT', path));
    }
    if (
      artifact.buildId !== input.bundle.buildId ||
      artifact.contentId !== input.bundle.contentId ||
      (identityIds[artifact.kind] !== undefined && identityIds[artifact.kind] !== artifact.id)
    ) {
      failures.push(failure('ARTIFACT_COHERENCE_MISMATCH', path));
    }
  }
};

const validateAppArtifacts = (input: WebPublicationInput, failures: PublicationFailure[]): void => {
  const hashes = new Set<string>();
  for (const surface of REQUIRED_SURFACES) {
    const matches = input.appArtifacts.filter((artifact) => artifact.surface === surface);
    if (matches.length !== 1) {
      failures.push(failure('APP_ARTIFACT_SET_INCOMPLETE', `$.appArtifacts.${surface}`));
    }
  }

  for (const artifact of input.appArtifacts) {
    const path = `$.appArtifacts.${artifact.surface}`;
    if (artifact.classification !== 'production-build') {
      failures.push(failure('DEVELOPMENT_ARTIFACT_REJECTED', `${path}.classification`));
    }
    if (
      artifact.buildId !== input.bundle.buildId ||
      artifact.contentId !== input.bundle.contentId ||
      !SHA256.test(artifact.hash) ||
      !isNonEmpty(artifact.path)
    ) {
      failures.push(failure('APP_ARTIFACT_COHERENCE_MISMATCH', path));
    }
    if (hashes.has(artifact.hash)) failures.push(failure('APP_ARTIFACTS_NOT_INDEPENDENT', path));
    hashes.add(artifact.hash);

    if (input.mode === 'final') {
      if (artifact.state !== 'observed') {
        failures.push(failure('BUILD_ARTIFACT_NOT_OBSERVED', `${path}.state`));
      }
      if (!input.observedFiles.includes(artifact.path)) {
        failures.push(failure('BUILD_ARTIFACT_FILE_MISSING', `${path}.path`));
      }
    }
  }
};

const validateRouteParity = (input: WebPublicationInput, failures: PublicationFailure[]): void => {
  if (
    !exactSet(input.routeParity.canonicalRouteIds, input.routeParity.emittedRouteIds) ||
    new Set(input.routeParity.canonicalRouteIds).size !== input.routeParity.canonicalRouteIds.length
  ) {
    failures.push(failure('ROUTE_PARITY_MISMATCH', '$.routeParity.emittedRouteIds'));
  }
  if (
    !exactSet(input.routeParity.canonicalLinkIds, input.routeParity.emittedLinkIds) ||
    new Set(input.routeParity.canonicalLinkIds).size !== input.routeParity.canonicalLinkIds.length
  ) {
    failures.push(failure('LINK_PARITY_MISMATCH', '$.routeParity.emittedLinkIds'));
  }
};

const validateContent = (input: WebPublicationInput, failures: PublicationFailure[]): void => {
  if (input.content.length === 0) failures.push(failure('CONTENT_SET_EMPTY', '$.content'));
  const captureIds = new Set(input.captures.map(({ id }) => id));
  const asOf = Date.parse(`${input.asOf}T00:00:00.000Z`);

  for (const record of input.content) {
    const path = `$.content.${record.id}`;
    if (
      !hasLocales(record.locales) ||
      !hasLocales(record.imageryLocales) ||
      !hasLocales(record.warningLocales) ||
      !hasLocales(record.criticalCopyLocales)
    ) {
      failures.push(failure('LOCALIZATION_INCOMPLETE', `${path}.locales`));
    }
    if (!Number.isFinite(asOf) || Date.parse(`${record.reviewBy}T00:00:00.000Z`) <= asOf) {
      failures.push(failure('STALE_CONTENT', `${path}.reviewBy`));
    }
    if (record.evidenceIds.length === 0) {
      failures.push(failure('MISSING_CONTENT_EVIDENCE', `${path}.evidenceIds`));
    }
    if (
      record.screenshotIds.length === 0 ||
      record.screenshotIds.some((id) => !captureIds.has(id))
    ) {
      failures.push(failure('MISSING_CONTENT_SCREENSHOT', `${path}.screenshotIds`));
    }
  }
};

const validateCaptures = (input: WebPublicationInput, failures: PublicationFailure[]): void => {
  for (const locale of REQUIRED_LOCALES) {
    if (!input.captures.some((capture) => capture.locale === locale)) {
      failures.push(failure('CAPTURE_LOCALE_MISSING', `$.captures.${locale}`));
    }
  }
  for (const capture of input.captures) {
    const path = `$.captures.${capture.id}`;
    if (!capture.approved) failures.push(failure('CAPTURE_NOT_APPROVED', `${path}.approved`));
    if (
      capture.publicationBuildId !== input.bundle.buildId ||
      !isNonEmpty(capture.sourceBuildId) ||
      !isNonEmpty(capture.scenarioId) ||
      !SHA256.test(capture.imageHash) ||
      !SHA256.test(capture.sidecarHash)
    ) {
      failures.push(failure('CAPTURE_COHERENCE_MISMATCH', path));
    }
  }
};

const validateVisuals = (input: WebPublicationInput, failures: PublicationFailure[]): void => {
  const scenarioIds = input.visuals.map(({ scenarioId }) => scenarioId);
  if (!exactSet(REQUIRED_VISUALS, scenarioIds)) {
    failures.push(failure('GOLDEN_MATRIX_INCOMPLETE', '$.visuals'));
  }
  for (const visual of input.visuals) {
    const path = `$.visuals.${visual.scenarioId}`;
    if (
      !SHA256.test(visual.hash) ||
      !input.routeParity.canonicalRouteIds.includes(visual.routeId)
    ) {
      failures.push(failure('VISUAL_COHERENCE_MISMATCH', path));
    }
    if (visual.state === 'failed' || !isFinalState(input.mode, visual.state)) {
      failures.push(failure('VISUAL_NOT_FINAL', `${path}.state`));
    }
  }
};

const validateQualityManifests = (
  input: WebPublicationInput,
  failures: PublicationFailure[],
): void => {
  const requirements = input.qualityManifests.map(({ requirement }) => requirement);
  if (!exactSet(REQUIRED_REQUIREMENTS, requirements)) {
    failures.push(failure('QUALITY_MANIFEST_SET_INCOMPLETE', '$.qualityManifests'));
  }
  for (const manifest of input.qualityManifests) {
    const path = `$.qualityManifests.${manifest.requirement}`;
    if (
      !SHA256.test(manifest.hash) ||
      !isNonEmpty(manifest.featureId) ||
      !isNonEmpty(manifest.owner)
    ) {
      failures.push(failure('QUALITY_MANIFEST_INVALID', path));
    }
    if (manifest.state === 'failed' || !isFinalState(input.mode, manifest.state)) {
      failures.push(failure('QUALITY_MANIFEST_NOT_FINAL', `${path}.state`));
    }
  }
};

const validateGates = (input: WebPublicationInput, failures: PublicationFailure[]): void => {
  for (const name of PUBLICATION_GATE_NAMES) {
    const matching = input.gates.filter((gate) => gate.name === name);
    if (matching.length !== 1) {
      failures.push(failure(`MISSING_${name.toUpperCase()}_GATE`, `$.gates.${name}`));
      continue;
    }
    const gate = matching[0];
    if (gate === undefined) continue;
    const path = `$.gates.${name}`;
    if (!isNonEmpty(gate.evidenceId) || !isNonEmpty(gate.file) || !isNonEmpty(gate.command)) {
      failures.push(failure('GATE_EVIDENCE_EMPTY', path));
    }
    if (gate.state === 'failed') {
      failures.push(failure(`${name.toUpperCase()}_GATE_FAILED`, `${path}.state`));
    } else if (input.mode === 'final' && gate.state !== 'passed') {
      failures.push(failure('GATE_NOT_FINAL', `${path}.state`));
    }
    if (input.mode === 'final' && !input.observedFiles.includes(gate.file)) {
      failures.push(failure('EVIDENCE_FILE_MISSING', `${path}.file`));
    }
    if (input.mode === 'final' && !input.observedCommands.includes(gate.command)) {
      failures.push(failure('EVIDENCE_COMMAND_UNRESOLVED', `${path}.command`));
    }
  }
};

const validateReleaseTruth = (input: WebPublicationInput, failures: PublicationFailure[]): void => {
  if (
    input.releaseTruth.downloadAvailable ||
    input.releaseTruth.publicDistributionApproved ||
    input.releaseTruth.officialArtifact !== 'unavailable' ||
    input.releaseTruth.developmentArtifactDetected ||
    Object.values(input.releaseTruth.previewAuthorityConnected).some(Boolean)
  ) {
    failures.push(failure('PHASE_3_RELEASE_TRUTH_VIOLATION', '$.releaseTruth'));
  }
};

export const evaluateWebPublication = (input: WebPublicationInput): WebPublicationResult => {
  const failures: PublicationFailure[] = [];
  validateBundle(input, failures);
  validateArtifacts(input, failures);
  validateAppArtifacts(input, failures);
  validateRouteParity(input, failures);
  validateContent(input, failures);
  validateCaptures(input, failures);
  validateVisuals(input, failures);
  validateQualityManifests(input, failures);
  validateGates(input, failures);
  validateReleaseTruth(input, failures);

  const diagnostics = sortedFailures(failures);
  if (diagnostics.length > 0) return Object.freeze({ failures: diagnostics, ok: false });

  return Object.freeze({
    failures: [] as const,
    fingerprint: createHash('sha256').update(JSON.stringify(input)).digest('hex'),
    ok: true,
  });
};

interface CaptureManifestShape {
  readonly captures: readonly Readonly<{
    buildId: string;
    id: string;
    imageSha256: string;
    locale: string;
    scenarioId: string;
    sidecarPath: string;
  }>[];
  readonly source: Readonly<{ buildId: string }>;
}

interface VisualManifestShape {
  readonly entries: readonly Readonly<{
    routeId: string;
    scenarioId: string;
    sourceHash: string;
  }>[];
}

const fileHash = (path: string): string =>
  createHash('sha256').update(readFileSync(path)).digest('hex');

const repositoryFileHash = (repositoryRoot: string, path: string): string =>
  fileHash(join(repositoryRoot, path));

const sourceArtifactPaths = [
  'apps/web/package.json',
  'apps/account/package.json',
  'apps/admin/package.json',
  'apps/web/src/content/releases/releases.metadata.json',
  'packages/web-core/src/routes.ts',
  'apps/web/src/content/public/catalog.pt-BR.json',
  'apps/web/src/content/public/catalog.en.json',
  'tooling/web-evidence/visual-manifest.json',
  'tooling/web-evidence/capture-manifest.json',
  'quality/features/WEB-01.json',
  'quality/features/WEB-02.json',
  'quality/features/WEB-03.json',
  'quality/features/WEB-08.json',
] as const;

const repositoryInput = (mode: WebPublicationMode, repositoryRoot: string): WebPublicationInput => {
  const hashes = Object.fromEntries(
    sourceArtifactPaths.map((path) => [path, repositoryFileHash(repositoryRoot, path)]),
  ) as Readonly<Record<(typeof sourceArtifactPaths)[number], string>>;
  const buildId = `web-build-${hashes['apps/web/package.json'].slice(0, 16)}`;
  const contentId = `web-content-${hashes[
    'apps/web/src/content/releases/releases.metadata.json'
  ].slice(0, 16)}`;
  const captureManifest = JSON.parse(
    readFileSync(join(repositoryRoot, 'tooling/web-evidence/capture-manifest.json'), 'utf8'),
  ) as CaptureManifestShape;
  const visualManifest = JSON.parse(
    readFileSync(join(repositoryRoot, 'tooling/web-evidence/visual-manifest.json'), 'utf8'),
  ) as VisualManifestShape;
  const canonicalRouteIds = [...new Set(visualManifest.entries.map(({ routeId }) => routeId))];
  const rootRouteId = canonicalRouteIds[0] ?? '';
  const canonicalLinkIds = canonicalRouteIds.slice(1).map((routeId) => `${rootRouteId}:${routeId}`);
  const artifactSources: Readonly<Record<PublicationArtifactKind, string>> = {
    assets: 'apps/web/src/content/public/catalog.en.json',
    capture: 'tooling/web-evidence/capture-manifest.json',
    channels: 'apps/web/src/content/releases/releases.metadata.json',
    content: 'apps/web/src/content/public/catalog.pt-BR.json',
    evidence: 'quality/features/WEB-08.json',
    policies: 'quality/features/WEB-01.json',
    release: 'apps/web/src/content/releases/releases.metadata.json',
    routes: 'packages/web-core/src/routes.ts',
    screenshots: 'tooling/web-evidence/capture-manifest.json',
    support: 'apps/web/src/content/public/catalog.en.json',
    visual: 'tooling/web-evidence/visual-manifest.json',
  };
  const artifactIds: Readonly<Record<PublicationArtifactKind, string>> = {
    assets: 'assets-v1',
    capture: 'capture-v1',
    channels: 'channels-v1',
    content: 'content-v1',
    evidence: 'evidence-v1',
    policies: 'policies-v1',
    release: 'release-v1',
    routes: 'routes-v1',
    screenshots: 'screenshots-v1',
    support: 'support-v1',
    visual: 'visual-v1',
  };
  const gateFile = (name: PublicationGateName): string =>
    `quality/evidence/phase-03/web/${name}.json`;
  const gateCommand = (name: PublicationGateName): string => `pnpm web:gate:${name}`;

  return {
    appArtifacts: (['public', 'account', 'admin'] as const).map((surface) => {
      const appPath = `apps/${surface === 'public' ? 'web' : surface}` as const;
      const packagePath = `${appPath}/package.json` as (typeof sourceArtifactPaths)[number];
      return {
        buildId,
        classification: 'production-build' as const,
        contentId,
        hash: hashes[packagePath],
        path: `${appPath}/.next/standalone`,
        state: 'planned' as const,
        surface,
      };
    }),
    artifacts: PUBLICATION_ARTIFACT_KINDS.map((kind) => {
      const path = artifactSources[kind] as (typeof sourceArtifactPaths)[number];
      return {
        buildId,
        contentId,
        hash: hashes[path],
        id: artifactIds[kind],
        kind,
        path,
      };
    }),
    asOf: new Date().toISOString().slice(0, 10),
    bundle: {
      buildId,
      contentId,
      evidenceId: artifactIds.evidence,
      policyId: artifactIds.policies,
      releaseId: artifactIds.release,
      routeId: artifactIds.routes,
      screenshotId: artifactIds.screenshots,
    },
    captures: captureManifest.captures.map((capture) => ({
      approved: true,
      id: capture.id,
      imageHash: capture.imageSha256,
      locale: capture.locale,
      publicationBuildId: buildId,
      scenarioId: capture.scenarioId,
      sidecarHash: repositoryFileHash(repositoryRoot, capture.sidecarPath),
      sourceBuildId: capture.buildId,
    })),
    content: [
      {
        criticalCopyLocales: REQUIRED_LOCALES,
        evidenceIds: ['quality-features-web-01-through-web-08'],
        id: contentId,
        imageryLocales: REQUIRED_LOCALES,
        locales: REQUIRED_LOCALES,
        reviewBy: '2027-12-31',
        screenshotIds: captureManifest.captures.map(({ id }) => id),
        warningLocales: REQUIRED_LOCALES,
      },
    ],
    gates: PUBLICATION_GATE_NAMES.map((name) => ({
      command: gateCommand(name),
      evidenceId: `${name}-evidence-planned`,
      file: gateFile(name),
      name,
      state: 'planned',
    })),
    mode,
    observedCommands: [],
    observedFiles: [],
    qualityManifests: REQUIRED_REQUIREMENTS.map((requirement) => {
      const path = `quality/features/${requirement}.json` as (typeof sourceArtifactPaths)[number];
      return {
        featureId: `${requirement.toLowerCase()}-phase-03`,
        hash: hashes[path],
        owner: 'plan-03-32',
        requirement,
        state: 'planned',
      };
    }),
    releaseTruth: {
      developmentArtifactDetected: false,
      downloadAvailable: false,
      officialArtifact: 'unavailable',
      previewAuthorityConnected: { account: false, admin: false, public: false },
      publicDistributionApproved: false,
    },
    routeParity: {
      canonicalLinkIds,
      canonicalRouteIds,
      emittedLinkIds: canonicalLinkIds,
      emittedRouteIds: canonicalRouteIds,
    },
    visuals: visualManifest.entries.map((entry) => ({
      hash: entry.sourceHash,
      routeId: entry.routeId,
      scenarioId: entry.scenarioId,
      state: 'planned',
    })),
  };
};

const parseMode = (arguments_: readonly string[]): WebPublicationMode => {
  const indexes = arguments_
    .map((argument, index) => (argument === '--mode' ? index : -1))
    .filter((index) => index >= 0);
  if (indexes.length !== 1) throw new Error('Provide --mode planned|final exactly once.');
  const modeIndex = indexes[0];
  if (modeIndex === undefined) throw new Error('Provide --mode planned|final exactly once.');
  const mode = arguments_[modeIndex + 1];
  if (mode !== 'planned' && mode !== 'final') {
    throw new Error('--mode must be followed by planned or final.');
  }
  return mode;
};

const isDirectExecution = process.argv[1]?.replaceAll('\\', '/').endsWith('/publication.ts');

if (isDirectExecution) {
  try {
    const mode = parseMode(process.argv.slice(2));
    const repositoryRoot = process.cwd();
    const before = new Map(
      sourceArtifactPaths.map((path) => [path, repositoryFileHash(repositoryRoot, path)]),
    );
    const input = repositoryInput(mode, repositoryRoot);
    const result = evaluateWebPublication(input);
    const mutatedPath = sourceArtifactPaths.find(
      (path) => before.get(path) !== repositoryFileHash(repositoryRoot, path),
    );
    const failures = [
      ...result.failures,
      ...(mutatedPath === undefined
        ? []
        : [failure('SOURCE_ARTIFACT_MUTATED', `$.sourceArtifacts.${mutatedPath}`)]),
    ];

    if (!result.ok || failures.length > 0) {
      for (const diagnostic of sortedFailures(failures)) {
        console.error(`${diagnostic.code} ${diagnostic.path}`);
      }
      process.exitCode = 1;
    } else {
      console.log(`Web publication passed in ${mode} mode (${result.fingerprint}).`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
