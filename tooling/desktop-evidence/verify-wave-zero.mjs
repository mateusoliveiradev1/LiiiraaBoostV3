import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const prefix = '[wave-zero]';
const workspaceRoot = fileURLToPath(new URL('../..', import.meta.url));
const storyManifestPath = 'tooling/desktop-evidence/story-manifest.json';
const canonicalCatalogPath = 'contracts/scenarios/desktop-scenarios.json';
const qualityDimensions = Object.freeze([
  'security',
  'privacy',
  'accessibility',
  'performance',
  'recovery',
]);
const packagedRecordIds = Object.freeze(['windows-10', 'windows-11', 'local-development-signing']);
const packagedCheckIds = Object.freeze([
  'authenticode',
  'non-elevation',
  'startup',
  'single-instance',
  'tray',
  'deep-link',
  'startup-timing',
  'working-set',
  'nvda',
  'forced-colors',
  'scale',
]);

const fail = (code, message) => {
  throw new Error(`${prefix} ${code}: ${message}`);
};

const normalizePath = (path) => path.split(sep).join('/');
const clone = (value) => JSON.parse(JSON.stringify(value));
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const nonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;
const orderedUnique = (values) => [...new Set(values)];

const readJson = (relativePath) =>
  JSON.parse(readFileSync(resolve(workspaceRoot, relativePath), 'utf8'));

const discoverPackageManifests = () => {
  const packages = {};
  for (const parent of ['apps', 'packages', 'tooling']) {
    const parentPath = resolve(workspaceRoot, parent);
    if (!existsSync(parentPath)) {
      continue;
    }
    for (const entry of readdirSync(parentPath, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === 'node_modules') {
        continue;
      }
      const relativePath = normalizePath(join(parent, entry.name, 'package.json'));
      const absolutePath = resolve(workspaceRoot, relativePath);
      if (!existsSync(absolutePath) || !statSync(absolutePath).isFile()) {
        continue;
      }
      const manifest = readJson(relativePath);
      if (nonEmptyString(manifest.name)) {
        packages[manifest.name] = { manifest, path: relativePath };
      }
    }
  }
  return packages;
};

const loadPlaywrightProjection = async () => {
  const configPath = resolve(workspaceRoot, 'apps/desktop/playwright.config.ts');
  const module = await import(pathToFileURL(configPath).href);
  const projects = Array.isArray(module.default?.projects) ? module.default.projects : [];
  return projects.map((project) => ({
    metadata: clone(project.metadata ?? {}),
    name: project.name,
    viewport:
      isRecord(project.use?.viewport) &&
      Number.isInteger(project.use.viewport.width) &&
      Number.isInteger(project.use.viewport.height)
        ? {
            width: project.use.viewport.width,
            height: project.use.viewport.height,
          }
        : undefined,
  }));
};

export const loadWaveZeroSnapshot = async () => ({
  catalog: readJson(canonicalCatalogPath),
  desktopLifecycleSource: readFileSync(
    resolve(workspaceRoot, 'apps/desktop/scripts/desktop-lifecycle.mjs'),
    'utf8',
  ),
  desktopPackage: readJson('apps/desktop/package.json'),
  packages: discoverPackageManifests(),
  packagedMatrix: readJson('apps/desktop/tests/packaged/windows-matrix.json'),
  playwrightProjects: await loadPlaywrightProjection(),
  rootPackage: readJson('package.json'),
  storyManifest: readJson(storyManifestPath),
  uxManifests: Array.from({ length: 12 }, (_value, index) => {
    const id = String(index + 1).padStart(2, '0');
    const path = `quality/features/ux-${id}.json`;
    return { document: readJson(path), path };
  }),
});

const createDiagnostics = () => {
  const diagnostics = [];
  const add = (code, subject, message) => {
    diagnostics.push({ code, message, subject });
  };
  return { add, diagnostics };
};

const expectedIdsFromRange = (range) => {
  if (
    !isRecord(range) ||
    !nonEmptyString(range.prefix) ||
    !Number.isInteger(range.first) ||
    !Number.isInteger(range.last) ||
    !Number.isInteger(range.pad) ||
    range.first > range.last
  ) {
    return [];
  }
  return Array.from({ length: range.last - range.first + 1 }, (_value, index) => {
    const sequence = String(range.first + index).padStart(range.pad, '0');
    return `${range.prefix}${sequence}`;
  });
};

const validateCanonicalCoverage = (snapshot, referenceCatalog, add) => {
  const scenarios = Array.isArray(snapshot.catalog?.scenarios) ? snapshot.catalog.scenarios : [];
  const canonicalIds = scenarios.map((scenario) => String(scenario?.id));
  const referenceScenarios = new Map(
    (Array.isArray(referenceCatalog?.scenarios) ? referenceCatalog.scenarios : []).map(
      (scenario) => [String(scenario.id), scenario],
    ),
  );
  const seenIds = new Set();
  const pairs = [];

  if (snapshot.catalog?.schemaVersion !== 1 || !nonEmptyString(snapshot.catalog?.fixtureVersion)) {
    add(
      'CATALOG_SHAPE_INVALID',
      canonicalCatalogPath,
      'the canonical catalog requires schemaVersion 1 and a fixtureVersion.',
    );
  }
  if (scenarios.length !== 24) {
    add(
      'SCENARIO_COUNT_MISMATCH',
      canonicalCatalogPath,
      `expected 24 canonical scenarios, received ${String(scenarios.length)}.`,
    );
  }

  for (const [index, scenario] of scenarios.entries()) {
    const scenarioId = String(scenario?.id);
    const expectedId = `S${String(index + 1).padStart(2, '0')}`;
    if (scenarioId !== expectedId) {
      add(
        'SCENARIO_SEQUENCE_MISMATCH',
        scenarioId,
        `canonical position ${String(index + 1)} must be ${expectedId}.`,
      );
    }
    if (seenIds.has(scenarioId)) {
      add('SCENARIO_DUPLICATE', scenarioId, 'canonical scenario identifiers must be unique.');
    }
    seenIds.add(scenarioId);

    const routes = Array.isArray(scenario?.requiredRoutes)
      ? scenario.requiredRoutes.map(String)
      : [];
    const states = Array.isArray(scenario?.requiredStates) ? scenario.requiredStates : [];
    const routeSet = new Set(routes);
    const stateRoutes = new Set();
    const pairKeys = new Set();
    const reference = referenceScenarios.get(scenarioId);
    const referenceRoutes = new Set(reference?.requiredRoutes ?? routes);
    const referenceStates = new Map();
    for (const requirement of reference?.requiredStates ?? states) {
      const stateSet = referenceStates.get(requirement.route) ?? new Set();
      stateSet.add(requirement.state);
      referenceStates.set(requirement.route, stateSet);
    }

    if (routeSet.size !== routes.length) {
      add('REQUIRED_ROUTE_DUPLICATE', scenarioId, 'requiredRoutes contains a duplicate route.');
    }
    for (const requirement of states) {
      const route = String(requirement?.route);
      const state = String(requirement?.state);
      const key = `${route}\u0000${state}`;
      if (!routeSet.has(route)) {
        add(
          'REQUIRED_STATE_ROUTE_UNDECLARED',
          `${scenarioId}:${route}`,
          'requiredStates route is absent from requiredRoutes.',
        );
      }
      if (!referenceRoutes.has(route)) {
        add(
          'REQUIRED_ROUTE_DRIFT',
          `${scenarioId}:${route}`,
          'route disagrees with the canonical reference.',
        );
      } else if (!referenceStates.get(route)?.has(state)) {
        add(
          'REQUIRED_STATE_DRIFT',
          `${scenarioId}:${route}:${state}`,
          'state disagrees with the canonical reference.',
        );
      }
      if (pairKeys.has(key)) {
        add(
          'REQUIRED_STATE_DUPLICATE',
          `${scenarioId}:${route}:${state}`,
          'route/state pairs must be unique inside a scenario.',
        );
      }
      pairKeys.add(key);
      stateRoutes.add(route);
      pairs.push({ route, scenarioId, state });
    }
    for (const route of routeSet) {
      if (!stateRoutes.has(route)) {
        add(
          'REQUIRED_ROUTE_STATE_MISSING',
          `${scenarioId}:${route}`,
          'every required route must name at least one required state.',
        );
      }
    }
  }

  const canonicalReference = snapshot.storyManifest?.canonicalCatalog;
  const resolvedCatalogPath = nonEmptyString(canonicalReference?.path)
    ? normalizePath(
        relative(
          workspaceRoot,
          resolve(workspaceRoot, dirname(storyManifestPath), canonicalReference.path),
        ),
      )
    : '';
  if (
    resolvedCatalogPath !== canonicalCatalogPath ||
    canonicalReference?.collectionField !== 'scenarios' ||
    canonicalReference?.scenarioIdField !== 'id' ||
    canonicalReference?.requiredRoutesField !== 'requiredRoutes' ||
    canonicalReference?.requiredStatesField !== 'requiredStates'
  ) {
    add(
      'STORY_CATALOG_PARITY',
      storyManifestPath,
      'story discovery must point to the canonical scenario fields and catalog.',
    );
  }
  for (const duplicateField of ['scenarios', 'requiredRoutes', 'requiredStates']) {
    if (Object.hasOwn(snapshot.storyManifest ?? {}, duplicateField)) {
      add(
        'DUPLICATED_SCENARIO_TRUTH',
        `${storyManifestPath}:${duplicateField}`,
        'the story manifest must derive coverage instead of persisting scenario truth.',
      );
    }
  }
  if (snapshot.storyManifest?.coverage?.strategy !== 'derive-required-states') {
    add(
      'STORY_COVERAGE_STRATEGY',
      storyManifestPath,
      'coverage strategy must be derive-required-states.',
    );
  }
  const storyIds = expectedIdsFromRange(snapshot.storyManifest?.coverage?.scenarioRange);
  if (!same(storyIds, canonicalIds)) {
    add(
      'STORY_SCENARIO_PARITY',
      storyManifestPath,
      'story scenario range must project exactly from the canonical catalog.',
    );
  }

  return { pairCount: pairs.length, scenarioIds: canonicalIds };
};

const validateStoryAxes = (snapshot, add) => {
  const projects = Array.isArray(snapshot.playwrightProjects) ? snapshot.playwrightProjects : [];
  const browserProjects = projects.filter(
    (project) => nonEmptyString(project.name) && project.name.startsWith('browser-'),
  );
  const harnessProjects = projects.filter((project) => project.name === 'harness');
  const storybookProjects = projects.filter((project) => project.name === 'storybook');
  const axes = {
    viewports: orderedUnique(
      browserProjects
        .map((project) => project.viewport)
        .filter(isRecord)
        .map((viewport) => JSON.stringify(viewport)),
    ).map((viewport) => JSON.parse(viewport)),
    locales: orderedUnique(browserProjects.map((project) => project.metadata?.locale)),
    scales: orderedUnique(browserProjects.map((project) => Number(project.metadata?.appScale))),
    motion: orderedUnique(browserProjects.map((project) => project.metadata?.motion)),
    forcedColors: orderedUnique(browserProjects.map((project) => project.metadata?.contrast)),
  };
  const expectedProjectCount = Object.values(axes).reduce(
    (product, values) => product * values.length,
    1,
  );

  if (harnessProjects.length !== 1 || storybookProjects.length !== 1) {
    add(
      'STORY_PROJECT_FAMILY_MISMATCH',
      'apps/desktop/playwright.config.ts',
      'exactly one harness and one Storybook project are required.',
    );
  }
  if (
    browserProjects.length !== expectedProjectCount ||
    new Set(browserProjects.map((project) => project.name)).size !== browserProjects.length
  ) {
    add(
      'STORY_PROJECT_MATRIX_MISMATCH',
      'apps/desktop/playwright.config.ts',
      'browser projects must cover the Cartesian story axes exactly once.',
    );
  }
  if (!same(snapshot.storyManifest?.axes, axes)) {
    add(
      'STORY_AXIS_PARITY',
      storyManifestPath,
      'story axes must match the Playwright project projection exactly.',
    );
  }
  const harnessMetadata = harnessProjects[0]?.metadata ?? {};
  for (const [metadataField, axisName] of [
    ['viewportAxes', 'viewports'],
    ['localeAxes', 'locales'],
    ['scaleAxes', 'scales'],
    ['motionAxes', 'motion'],
    ['contrastAxes', 'forcedColors'],
  ]) {
    if (harnessMetadata[metadataField] !== axes[axisName].length) {
      add(
        'STORY_HARNESS_AXIS_COUNT',
        metadataField,
        `harness metadata must report ${axisName} exactly.`,
      );
    }
  }

  return { axes, browserProjectCount: browserProjects.length };
};

const validateWindowsRecord = (record, release, add) => {
  const subject = `apps/desktop/tests/packaged/windows-matrix.json:windows-${release}`;
  if (
    record?.recordType !== 'windows-image' ||
    record?.status !== 'unresolved' ||
    record?.windows?.family !== 'Windows' ||
    record?.windows?.release !== release ||
    record?.windows?.architecture !== 'x64' ||
    record?.webView2?.status !== 'unresolved' ||
    record?.developmentSigningAccess !== 'unresolved'
  ) {
    add(
      'PACKAGED_WINDOWS_PLANNED_STATE',
      subject,
      `Windows ${release} must remain an explicit unresolved x64 prerequisite.`,
    );
  }
};

const validateSigningRecord = (record, add) => {
  const subject = 'apps/desktop/tests/packaged/windows-matrix.json:local-development-signing';
  const exactDevelopmentContract =
    record?.recordType === 'development-signing' &&
    record?.status === 'unresolved' &&
    record?.trustClass === 'self-signed-development' &&
    record?.certificateStore === 'Cert:\\CurrentUser\\My' &&
    record?.certificateThumbprint === 'unresolved' &&
    record?.extendedKeyUsage === '1.3.6.1.5.5.7.3.3' &&
    record?.digestAlgorithm === 'SHA-256' &&
    record?.keyProvider === 'Microsoft Software Key Storage Provider' &&
    record?.keyCustody?.scope === 'current-user' &&
    record?.keyCustody?.technology === 'CNG' &&
    record?.keyCustody?.exportable === false &&
    record?.keyCustody?.ciPrivateKeyAccess === false &&
    record?.timestamp?.state === 'not-applicable' &&
    record?.publicTrust === false &&
    record?.smartScreenReputation === false &&
    record?.productionReady === false &&
    record?.distributionAllowed === false &&
    record?.productionSigningDeferredTo === 'Phase 10';
  if (!exactDevelopmentContract) {
    add(
      'PACKAGED_SIGNING_CONTRACT',
      subject,
      'signing must remain unresolved, local, self-signed, non-exportable, and non-distributable.',
    );
  }
};

const validatePackagedMatrix = (snapshot, add) => {
  const records = Array.isArray(snapshot.packagedMatrix?.records)
    ? snapshot.packagedMatrix.records
    : [];
  const recordIds = records.map((record) => String(record?.id));
  if (
    snapshot.packagedMatrix?.schemaVersion !== '1.0' ||
    snapshot.packagedMatrix?.evidenceKind !== 'desktop-packaged-environment'
  ) {
    add(
      'PACKAGED_MATRIX_SHAPE',
      'apps/desktop/tests/packaged/windows-matrix.json',
      'packaged matrix identity must remain desktop-packaged-environment 1.0.',
    );
  }
  if (!same(recordIds, packagedRecordIds)) {
    add(
      'PACKAGED_ROW_PARITY',
      'apps/desktop/tests/packaged/windows-matrix.json',
      'exact Windows 10, Windows 11, and local development-signing rows are required.',
    );
  }
  validateWindowsRecord(
    records.find((record) => record?.id === 'windows-10'),
    '10',
    add,
  );
  validateWindowsRecord(
    records.find((record) => record?.id === 'windows-11'),
    '11',
    add,
  );
  validateSigningRecord(
    records.find((record) => record?.id === 'local-development-signing'),
    add,
  );

  const checks = Array.isArray(snapshot.packagedMatrix?.plannedChecks)
    ? snapshot.packagedMatrix.plannedChecks
    : [];
  if (
    !same(
      checks.map((check) => String(check?.id)),
      packagedCheckIds,
    )
  ) {
    add(
      'PACKAGED_CHECK_PARITY',
      'apps/desktop/tests/packaged/windows-matrix.json',
      'every packaged Wave 0 prerequisite check is required exactly once.',
    );
  }
  for (const check of checks) {
    if (
      check?.status !== 'planned' ||
      !Array.isArray(check?.requires) ||
      check.requires.length === 0 ||
      new Set(check.requires).size !== check.requires.length
    ) {
      add(
        'PACKAGED_CHECK_PLANNED_STATE',
        String(check?.id),
        'packaged checks must remain planned with non-empty unique prerequisites.',
      );
    }
  }

  return {
    plannedChecks: checks.length,
    unresolvedRows: records.filter((record) => record?.status === 'unresolved').length,
  };
};

const validateRootReachability = (snapshot, add) => {
  const rootScripts = snapshot.rootPackage?.scripts ?? {};
  const desktopScripts = snapshot.desktopPackage?.scripts ?? {};
  const expectedRoot = {
    'verify:quick': 'pnpm --filter @liiiraa/desktop verify:quick',
    verify: 'pnpm --filter @liiiraa/desktop verify',
  };
  for (const [name, command] of Object.entries(expectedRoot)) {
    if (rootScripts[name] !== command) {
      add('ROOT_COMMAND_UNREACHABLE', `package.json:${name}`, `expected exact command ${command}.`);
    }
  }
  for (const [name, command] of Object.entries({
    'test:wave-zero': 'node scripts/desktop-lifecycle.mjs wave-zero --',
    'verify:quick': 'node scripts/desktop-lifecycle.mjs quick --',
    verify: 'node scripts/desktop-lifecycle.mjs final --',
  })) {
    if (desktopScripts[name] !== command) {
      add(
        'DESKTOP_COMMAND_UNREACHABLE',
        `apps/desktop/package.json:${name}`,
        `expected exact command ${command}.`,
      );
    }
  }
  for (const marker of [
    "case 'wave-zero':",
    "case 'quick':",
    "case 'final':",
    "runPnpm(['verify:foundation:quick'], workspaceRoot);",
    "runPnpm(['verify:foundation'], workspaceRoot);",
  ]) {
    if (!snapshot.desktopLifecycleSource.includes(marker)) {
      add(
        'LIFECYCLE_ROUTE_MISSING',
        'apps/desktop/scripts/desktop-lifecycle.mjs',
        `missing lifecycle marker ${marker}.`,
      );
    }
  }
  for (const [name, markers] of Object.entries({
    'verify:foundation:quick': ['pnpm test:acceptance-policy -- --mode planned'],
    'verify:foundation': ['pnpm verify:quick', 'pnpm test', 'pnpm build'],
  })) {
    const script = rootScripts[name];
    if (!nonEmptyString(script) || markers.some((marker) => !script.includes(marker))) {
      add(
        'FOUNDATION_COMMAND_UNREACHABLE',
        `package.json:${name}`,
        'the root verification graph is missing a required terminating delegate.',
      );
    }
  }

  return {
    finalAggregator: existsSync(resolve(workspaceRoot, 'tooling/desktop-evidence/verify-phase.mjs'))
      ? 'resolved'
      : 'planned',
    finalAggregatorOwner: 'plan-02-30',
    rootEntries: Object.keys(expectedRoot),
  };
};

const resolveEvidenceCommand = (command, snapshot) => {
  const pnpmMatch = /^pnpm --filter (?<packageName>\S+) (?<scriptName>[a-z][\w:-]*)(?:\s|$)/u.exec(
    command,
  );
  if (pnpmMatch?.groups !== undefined) {
    const packageEntry = snapshot.packages?.[pnpmMatch.groups.packageName];
    return {
      kind: 'package-script',
      resolved: nonEmptyString(packageEntry?.manifest?.scripts?.[pnpmMatch.groups.scriptName]),
      target: `${pnpmMatch.groups.packageName}:${pnpmMatch.groups.scriptName}`,
    };
  }
  const nodeMatch = /^node (?<path>[^\s]+)(?:\s|$)/u.exec(command);
  if (nodeMatch?.groups !== undefined) {
    const path = normalizePath(nodeMatch.groups.path);
    return {
      kind: 'node-script',
      resolved: existsSync(resolve(workspaceRoot, path)),
      target: path,
    };
  }
  return { kind: 'unsupported', resolved: false, target: command };
};

const validateQualityManifests = (snapshot, add) => {
  const manifests = Array.isArray(snapshot.uxManifests) ? snapshot.uxManifests : [];
  const expectedPaths = Array.from({ length: 12 }, (_value, index) => {
    const id = String(index + 1).padStart(2, '0');
    return `quality/features/ux-${id}.json`;
  });
  const paths = manifests.map((manifest) => manifest?.path);
  if (manifests.length !== 12 || !same(paths, expectedPaths)) {
    add(
      'UX_MANIFEST_PARITY',
      'quality/features',
      'exactly ux-01.json through ux-12.json are required in order.',
    );
  }

  const requirements = [];
  const evidenceIds = new Set();
  const plannedArtifacts = [];
  const plannedCommands = [];
  for (const [index, entry] of manifests.entries()) {
    const document = entry?.document;
    const expectedNumber = index + 1;
    const expectedRequirement = `UX-${String(expectedNumber).padStart(2, '0')}`;
    const expectedOwner = expectedNumber <= 6 ? 'plan-02-28' : 'plan-02-29';
    const subject = entry?.path ?? `quality/features/index-${String(index)}`;
    if (
      !isRecord(document) ||
      !same(document.requirements, [expectedRequirement]) ||
      document.owner !== expectedOwner
    ) {
      add(
        'UX_REQUIREMENT_OWNER_PARITY',
        subject,
        `${expectedRequirement} must be owned exactly by ${expectedOwner}.`,
      );
    }
    requirements.push(...(Array.isArray(document?.requirements) ? document.requirements : []));
    const dimensions = isRecord(document?.acceptance) ? Object.keys(document.acceptance) : [];
    if (!same(dimensions, qualityDimensions)) {
      add(
        'UX_QUALITY_DIMENSION_PARITY',
        subject,
        `quality dimensions must be ${qualityDimensions.join(', ')}.`,
      );
    }

    for (const dimension of qualityDimensions) {
      const acceptance = document?.acceptance?.[dimension];
      if (
        acceptance?.status !== 'tested' ||
        !Array.isArray(acceptance?.evidence) ||
        acceptance.evidence.length === 0
      ) {
        add(
          'UX_DIMENSION_EVIDENCE_MISSING',
          `${subject}:${dimension}`,
          'tested dimensions require at least one planned evidence entry.',
        );
        continue;
      }
      for (const evidence of acceptance.evidence) {
        const evidenceSubject = `${subject}:${dimension}:${String(evidence?.id)}`;
        if (
          !nonEmptyString(evidence?.id) ||
          !nonEmptyString(evidence?.command) ||
          !nonEmptyString(evidence?.file) ||
          evidence?.owner !== document.owner ||
          evidence?.status !== 'planned'
        ) {
          add(
            'UX_EVIDENCE_PLANNED_CONTRACT',
            evidenceSubject,
            'planned evidence requires an id, command, exact file, matching owner, and planned status.',
          );
          continue;
        }
        if (evidenceIds.has(evidence.id)) {
          add('UX_EVIDENCE_ID_DUPLICATE', evidence.id, 'evidence identifiers must be unique.');
        }
        evidenceIds.add(evidence.id);
        if (
          evidence.file.includes('*') ||
          normalizePath(evidence.file).startsWith('../') ||
          resolve(workspaceRoot, evidence.file) === workspaceRoot
        ) {
          add(
            'UX_EVIDENCE_PATH_INVALID',
            evidenceSubject,
            'evidence paths must be exact files contained by the repository.',
          );
        }
        if (/(?:\|\|\s*true|--watch\b|--watchAll\b|continue-on-error)/u.test(evidence.command)) {
          add(
            'UX_EVIDENCE_COMMAND_NON_TERMINATING',
            evidenceSubject,
            'planned evidence commands must terminate and fail closed.',
          );
        }
        const command = resolveEvidenceCommand(evidence.command, snapshot);
        if (command.kind === 'unsupported') {
          add(
            'UX_EVIDENCE_COMMAND_UNSUPPORTED',
            evidenceSubject,
            `unsupported command target ${command.target}.`,
          );
        }
        plannedCommands.push({
          command: evidence.command,
          owner: evidence.owner,
          resolution: command.resolved ? 'resolved' : 'planned-unresolved',
          target: command.target,
        });
        plannedArtifacts.push({
          file: evidence.file,
          owner: evidence.owner,
          resolution: existsSync(resolve(workspaceRoot, evidence.file))
            ? 'resolved'
            : 'planned-unresolved',
        });
      }
    }
  }
  const expectedRequirements = expectedPaths.map((_path, index) => {
    return `UX-${String(index + 1).padStart(2, '0')}`;
  });
  if (!same(requirements, expectedRequirements)) {
    add(
      'UX_REQUIREMENT_PARITY',
      'quality/features',
      'UX-01 through UX-12 must each appear exactly once.',
    );
  }

  for (const requiredStoryEvidence of ['ux-04', 'ux-05', 'ux-06']) {
    const manifest = manifests.find((entry) =>
      entry.path.endsWith(`${requiredStoryEvidence}.json`),
    );
    const evidence = Object.values(manifest?.document?.acceptance ?? {})
      .flatMap((entry) => entry.evidence ?? [])
      .find((entry) => entry.id === `${requiredStoryEvidence}-canonical-story-parity`);
    if (
      evidence?.command !==
        'node tooling/desktop-evidence/verify-wave-zero.mjs --mode planned --smoke' ||
      evidence?.file !== storyManifestPath
    ) {
      add(
        'UX_CANONICAL_STORY_LINK',
        manifest?.path ?? requiredStoryEvidence,
        'canonical story evidence must point to the Wave 0 smoke and story manifest.',
      );
    }
  }

  const uniqueArtifacts = [
    ...new Map(
      plannedArtifacts.map((artifact) => [`${artifact.owner}\u0000${artifact.file}`, artifact]),
    ).values(),
  ].sort((left, right) => left.file.localeCompare(right.file));
  const uniqueCommands = [
    ...new Map(
      plannedCommands.map((command) => [`${command.owner}\u0000${command.command}`, command]),
    ).values(),
  ].sort((left, right) => left.command.localeCompare(right.command));
  return {
    evidenceCount: evidenceIds.size,
    manifests: manifests.length,
    plannedArtifacts: uniqueArtifacts,
    plannedCommands: uniqueCommands,
  };
};

export const verifyWaveZero = (snapshot, { referenceCatalog = snapshot.catalog } = {}) => {
  const { add, diagnostics } = createDiagnostics();
  const canonical = validateCanonicalCoverage(snapshot, referenceCatalog, add);
  const story = validateStoryAxes(snapshot, add);
  const packaged = validatePackagedMatrix(snapshot, add);
  const rootReachability = validateRootReachability(snapshot, add);
  const quality = validateQualityManifests(snapshot, add);

  diagnostics.sort(
    (left, right) =>
      left.code.localeCompare(right.code) ||
      left.subject.localeCompare(right.subject) ||
      left.message.localeCompare(right.message),
  );
  return {
    diagnostics,
    ok: diagnostics.length === 0,
    report: {
      acceptance: 'planned',
      authority: canonicalCatalogPath,
      canonical: {
        pairCount: canonical.pairCount,
        scenarioCount: canonical.scenarioIds.length,
      },
      packaged,
      quality: {
        evidenceCount: quality.evidenceCount,
        manifests: quality.manifests,
        plannedArtifacts: quality.plannedArtifacts,
        plannedCommands: quality.plannedCommands,
      },
      rootReachability,
      story: {
        axes: story.axes,
        browserProjectCount: story.browserProjectCount,
      },
    },
  };
};

const sourcePaths = Object.freeze([
  canonicalCatalogPath,
  storyManifestPath,
  'tooling/desktop-evidence/verify-wave-zero.mjs',
  'apps/desktop/package.json',
  'apps/desktop/playwright.config.ts',
  'apps/desktop/scripts/desktop-lifecycle.mjs',
  'apps/desktop/tests/packaged/windows-matrix.json',
  'package.json',
  ...Array.from({ length: 12 }, (_value, index) => {
    const id = String(index + 1).padStart(2, '0');
    return `quality/features/ux-${id}.json`;
  }),
]);

const sourceHashes = () =>
  Object.fromEntries(
    sourcePaths.map((path) => [
      path,
      createHash('sha256')
        .update(readFileSync(resolve(workspaceRoot, path)))
        .digest('hex'),
    ]),
  );

const firstEvidence = (snapshot, manifestIndex, dimension) => {
  const evidence =
    snapshot.uxManifests?.[manifestIndex]?.document?.acceptance?.[dimension]?.evidence;
  if (!Array.isArray(evidence) || evidence.length === 0) {
    fail('MUTATION_FIXTURE_INVALID', `missing ${dimension} evidence in UX manifest fixture.`);
  }
  return evidence[0];
};

const mutationCases = Object.freeze([
  {
    expectedCode: 'SCENARIO_COUNT_MISMATCH',
    id: 'scenario-removed',
    mutate: (snapshot) => {
      snapshot.catalog.scenarios.shift();
    },
  },
  {
    expectedCode: 'SCENARIO_SEQUENCE_MISMATCH',
    id: 'scenario-renamed',
    mutate: (snapshot) => {
      snapshot.catalog.scenarios[0].id = 'S99';
    },
  },
  {
    expectedCode: 'REQUIRED_STATE_ROUTE_UNDECLARED',
    id: 'required-route-removed',
    mutate: (snapshot) => {
      snapshot.catalog.scenarios[0].requiredRoutes.shift();
    },
  },
  {
    expectedCode: 'REQUIRED_STATE_DRIFT',
    id: 'required-state-renamed',
    mutate: (snapshot) => {
      snapshot.catalog.scenarios[0].requiredStates[0].state = 'renamed-state';
    },
  },
  {
    expectedCode: 'STORY_AXIS_PARITY',
    id: 'story-axis-removed',
    mutate: (snapshot) => {
      snapshot.storyManifest.axes.scales.pop();
    },
  },
  {
    expectedCode: 'PACKAGED_ROW_PARITY',
    id: 'packaged-row-removed',
    mutate: (snapshot) => {
      snapshot.packagedMatrix.records.pop();
    },
  },
  {
    expectedCode: 'UX_MANIFEST_PARITY',
    id: 'ux-manifest-removed',
    mutate: (snapshot) => {
      snapshot.uxManifests.pop();
    },
  },
  {
    expectedCode: 'UX_QUALITY_DIMENSION_PARITY',
    id: 'quality-dimension-removed',
    mutate: (snapshot) => {
      delete snapshot.uxManifests[0].document.acceptance.recovery;
    },
  },
  {
    expectedCode: 'UX_EVIDENCE_PLANNED_CONTRACT',
    id: 'evidence-owner-renamed',
    mutate: (snapshot) => {
      firstEvidence(snapshot, 0, 'security').owner = 'plan-02-99';
    },
  },
  {
    expectedCode: 'UX_CANONICAL_STORY_LINK',
    id: 'artifact-path-renamed',
    mutate: (snapshot) => {
      const evidence = Object.values(snapshot.uxManifests[3].document.acceptance)
        .flatMap((entry) => entry.evidence ?? [])
        .find((entry) => entry.id === 'ux-04-canonical-story-parity');
      if (evidence === undefined) {
        fail('MUTATION_FIXTURE_INVALID', 'UX-04 canonical story evidence is missing.');
      }
      evidence.file = 'tooling/desktop-evidence/renamed-story-manifest.json';
    },
  },
  {
    expectedCode: 'ROOT_COMMAND_UNREACHABLE',
    id: 'root-command-removed',
    mutate: (snapshot) => {
      delete snapshot.rootPackage.scripts['verify:quick'];
    },
  },
  {
    expectedCode: 'STORY_CATALOG_PARITY',
    id: 'story-catalog-drift',
    mutate: (snapshot) => {
      snapshot.storyManifest.canonicalCatalog.path = '../../contracts/scenarios/renamed.json';
    },
  },
  {
    expectedCode: 'DUPLICATED_SCENARIO_TRUTH',
    id: 'duplicated-story-scenario-source',
    mutate: (snapshot) => {
      snapshot.storyManifest.scenarios = snapshot.catalog.scenarios.map((scenario) => scenario.id);
    },
  },
]);

export const runMutationSuite = (snapshot) => {
  const diagnostics = [];
  const hashesBefore = sourceHashes();
  const referenceCatalog = clone(snapshot.catalog);
  const firstBaseline = verifyWaveZero(clone(snapshot));
  const secondBaseline = verifyWaveZero(clone(snapshot));
  if (!firstBaseline.ok) {
    diagnostics.push({
      code: 'MUTATION_BASELINE_INVALID',
      message: JSON.stringify(firstBaseline.diagnostics),
      subject: 'complete-wave-zero-graph',
    });
  }
  if (!same(firstBaseline, secondBaseline)) {
    diagnostics.push({
      code: 'MUTATION_BASELINE_UNSTABLE',
      message: 'complete Wave 0 verification changed across identical reruns.',
      subject: 'complete-wave-zero-graph',
    });
  }

  const results = [];
  for (const mutation of mutationCases) {
    const mutated = clone(snapshot);
    mutation.mutate(mutated);
    const first = verifyWaveZero(mutated, { referenceCatalog });
    const second = verifyWaveZero(clone(mutated), { referenceCatalog });
    const codes = first.diagnostics.map((diagnostic) => diagnostic.code);
    if (first.ok || !codes.includes(mutation.expectedCode)) {
      diagnostics.push({
        code: 'MUTATION_EXPECTATION_FAILED',
        message: `expected ${mutation.expectedCode}, received ${codes.join(', ') || 'no diagnostic'}.`,
        subject: mutation.id,
      });
    }
    if (!same(first.diagnostics, second.diagnostics)) {
      diagnostics.push({
        code: 'MUTATION_DIAGNOSTIC_UNSTABLE',
        message: 'mutation diagnostics changed across identical reruns.',
        subject: mutation.id,
      });
    }
    results.push({
      diagnostic: mutation.expectedCode,
      id: mutation.id,
      passed: !first.ok && codes.includes(mutation.expectedCode),
    });
  }

  if (!same(hashesBefore, sourceHashes())) {
    diagnostics.push({
      code: 'MUTATION_SOURCE_CHANGED',
      message: 'mutation execution changed a checked-in Wave 0 source artifact.',
      subject: 'source-hashes',
    });
  }
  diagnostics.sort(
    (left, right) =>
      left.code.localeCompare(right.code) ||
      left.subject.localeCompare(right.subject) ||
      left.message.localeCompare(right.message),
  );
  return {
    diagnostics,
    ok: diagnostics.length === 0,
    report: {
      acceptance: 'planned',
      byteStable: diagnostics.every(
        (diagnostic) =>
          diagnostic.code !== 'MUTATION_BASELINE_UNSTABLE' &&
          diagnostic.code !== 'MUTATION_DIAGNOSTIC_UNSTABLE' &&
          diagnostic.code !== 'MUTATION_SOURCE_CHANGED',
      ),
      mutationCount: results.length,
      mutations: results,
      sourceCount: sourcePaths.length,
    },
  };
};

const parseArguments = (arguments_) => {
  if (
    arguments_.length !== 3 ||
    arguments_[0] !== '--mode' ||
    arguments_[1] !== 'planned' ||
    !['--smoke', '--mutations'].includes(arguments_[2])
  ) {
    fail('CLI_USAGE', 'expected --mode planned --smoke|--mutations.');
  }
  return { mode: 'planned', selector: arguments_[2].slice(2) };
};

const isDirectExecution =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isDirectExecution) {
  try {
    const options = parseArguments(process.argv.slice(2));
    const snapshot = await loadWaveZeroSnapshot();
    const result =
      options.selector === 'smoke' ? verifyWaveZero(snapshot) : runMutationSuite(snapshot);
    if (!result.ok) {
      fail('VERIFY_FAILED', JSON.stringify(result.diagnostics));
    }
    process.stdout.write(`${JSON.stringify(result.report, undefined, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
