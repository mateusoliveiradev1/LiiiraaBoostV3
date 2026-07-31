import { createHash } from 'node:crypto';
import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

import { WEB_LOCALES, webRoutes, type WebLocale } from '@liiiraa/web-core';

export const ROUTE_REACHABILITY_SCHEMA_VERSION = 1 as const;
export const ROUTE_REACHABILITY_COMMAND =
  'pnpm --filter @liiiraa/web-evidence exec playwright test tests/public.spec.ts tests/account.spec.ts tests/admin.spec.ts --project=public-final-desktop-960 --project=account-final-desktop-960 --project=admin-final-desktop-960' as const;

export type RouteReachabilitySurface = 'public' | 'account' | 'admin';
export type RouteReachabilityStatus = 403 | 404 | 410 | 500;

export interface RouteReachabilityObservation {
  readonly authorityConnected: boolean;
  readonly contentSha256: string;
  readonly diagnosticsRedacted: boolean;
  readonly locale: WebLocale;
  readonly localePreserved: boolean;
  readonly pathname: string;
  readonly recoveryValid: boolean;
  readonly redirected: boolean;
  readonly responseStatus: number;
  readonly routeId: string;
  readonly semanticStatus: RouteReachabilityStatus;
  readonly surface: RouteReachabilitySurface;
}

const SPEC_SOURCE_FILES = [
  'tooling/web-evidence/tests/public.spec.ts',
  'tooling/web-evidence/tests/account.spec.ts',
  'tooling/web-evidence/tests/admin.spec.ts',
] as const;
type RouteReachabilitySpecSource = (typeof SPEC_SOURCE_FILES)[number];

export interface RouteReachabilityEvidence {
  readonly canonicalRouteSourceSha256: string;
  readonly command: typeof ROUTE_REACHABILITY_COMMAND;
  readonly id: 'route-reachability';
  readonly observations: readonly RouteReachabilityObservation[];
  readonly owner: 'plan-03-35';
  readonly schemaVersion: typeof ROUTE_REACHABILITY_SCHEMA_VERSION;
  readonly specSourceHashes: Readonly<Record<RouteReachabilitySpecSource, string>>;
  readonly status: 'planned' | 'passed';
}

export interface RouteReachabilityTarget {
  readonly locale: WebLocale;
  readonly pathname: string;
  readonly routeId: string;
  readonly semanticStatus: RouteReachabilityStatus;
  readonly surface: RouteReachabilitySurface;
}

export type RouteReachabilityValidationResult = Readonly<
  { diagnostics: readonly []; ok: true } | { diagnostics: readonly string[]; ok: false }
>;

export interface WriteRouteReachabilityEvidenceInput {
  readonly evidencePath?: string;
  readonly observations: readonly RouteReachabilityObservation[];
  readonly repositoryRoot?: string;
  readonly surface: RouteReachabilitySurface;
}

const ROUTE_SOURCE_FILE = 'packages/web-core/src/routes.ts';
const DEFAULT_EVIDENCE_FILE = 'quality/evidence/phase-03/web/route-reachability.json';
const SHA256 = /^[a-f0-9]{64}$/u;
const ERROR_ROUTE_ID = /^(public|account|admin)-error-(403|404|410|500)$/u;
const EVIDENCE_KEYS = new Set([
  'canonicalRouteSourceSha256',
  'command',
  'id',
  'observations',
  'owner',
  'schemaVersion',
  'specSourceHashes',
  'status',
]);
const OBSERVATION_KEYS = new Set([
  'authorityConnected',
  'contentSha256',
  'diagnosticsRedacted',
  'locale',
  'localePreserved',
  'pathname',
  'recoveryValid',
  'redirected',
  'responseStatus',
  'routeId',
  'semanticStatus',
  'surface',
]);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const exactKeys = (value: Record<string, unknown>, expected: ReadonlySet<string>): boolean =>
  Object.keys(value).length === expected.size &&
  Object.keys(value).every((key) => expected.has(key));

const hashFile = (repositoryRoot: string, file: string): string =>
  createHash('sha256')
    .update(readFileSync(join(repositoryRoot, file)))
    .digest('hex');

const currentSourceHashes = (
  repositoryRoot: string,
): Readonly<{
  canonicalRouteSourceSha256: string;
  specSourceHashes: Readonly<Record<RouteReachabilitySpecSource, string>>;
}> => ({
  canonicalRouteSourceSha256: hashFile(repositoryRoot, ROUTE_SOURCE_FILE),
  specSourceHashes: Object.fromEntries(
    SPEC_SOURCE_FILES.map((file) => [file, hashFile(repositoryRoot, file)]),
  ) as unknown as Readonly<Record<RouteReachabilitySpecSource, string>>,
});

const compareObservations = (
  left: RouteReachabilityObservation,
  right: RouteReachabilityObservation,
): number =>
  left.surface.localeCompare(right.surface) ||
  left.routeId.localeCompare(right.routeId) ||
  left.locale.localeCompare(right.locale);

const compareTargets = (left: RouteReachabilityTarget, right: RouteReachabilityTarget): number =>
  left.surface.localeCompare(right.surface) ||
  left.routeId.localeCompare(right.routeId) ||
  left.locale.localeCompare(right.locale);

const canonicalTargets = Object.freeze(
  webRoutes
    .flatMap((route): RouteReachabilityTarget[] => {
      const match = ERROR_ROUTE_ID.exec(route.id);
      if (match === null) return [];
      const surface = match[1] as RouteReachabilitySurface;
      const semanticStatus = Number(match[2]) as RouteReachabilityStatus;
      if (route.surface !== surface || route.owner !== `${surface}-errors`) {
        throw new Error(`Canonical error route ownership mismatch: ${route.id}`);
      }
      return WEB_LOCALES.map((locale) => ({
        locale,
        pathname: route.pathnameTemplate.replace('[locale]', locale),
        routeId: route.id,
        semanticStatus,
        surface,
      }));
    })
    .toSorted(compareTargets),
);

if (canonicalTargets.length !== 24) {
  throw new Error(
    `Expected 24 canonical error-route targets, received ${canonicalTargets.length}.`,
  );
}

export const routeReachabilityTargets = (
  surface?: RouteReachabilitySurface,
): readonly RouteReachabilityTarget[] =>
  Object.freeze(
    canonicalTargets
      .filter((target) => surface === undefined || target.surface === surface)
      .map((target) => Object.freeze({ ...target })),
  );

const targetKey = (value: Readonly<{ locale: string; routeId: string; surface: string }>): string =>
  `${value.surface}:${value.routeId}:${value.locale}`;

const expectedByKey = new Map(canonicalTargets.map((target) => [targetKey(target), target]));

const validateSourceHashes = (
  value: Record<string, unknown>,
  repositoryRoot: string,
  diagnostics: string[],
  requiredSurfaces: ReadonlySet<RouteReachabilitySurface>,
): void => {
  const current = currentSourceHashes(repositoryRoot);
  if (
    typeof value['canonicalRouteSourceSha256'] !== 'string' ||
    !SHA256.test(value['canonicalRouteSourceSha256']) ||
    value['canonicalRouteSourceSha256'] !== current.canonicalRouteSourceSha256
  ) {
    diagnostics.push('CANONICAL_ROUTE_SOURCE_HASH_MISMATCH $.canonicalRouteSourceSha256');
  }

  if (!isObject(value['specSourceHashes'])) {
    diagnostics.push('SPEC_SOURCE_HASHES_INVALID $.specSourceHashes');
    return;
  }
  const expectedKeys = new Set<string>(SPEC_SOURCE_FILES);
  if (!exactKeys(value['specSourceHashes'], expectedKeys)) {
    diagnostics.push('SPEC_SOURCE_HASH_SET_MISMATCH $.specSourceHashes');
    return;
  }
  for (const file of SPEC_SOURCE_FILES) {
    const surface = file.includes('/public.')
      ? 'public'
      : file.includes('/account.')
        ? 'account'
        : 'admin';
    if (!requiredSurfaces.has(surface)) continue;
    const hash = value['specSourceHashes'][file];
    if (typeof hash !== 'string' || !SHA256.test(hash) || hash !== current.specSourceHashes[file]) {
      diagnostics.push(`SPEC_SOURCE_HASH_MISMATCH $.specSourceHashes.${file}`);
    }
  }
};

const validateObservation = (
  value: unknown,
  index: number,
  diagnostics: string[],
): value is RouteReachabilityObservation => {
  const path = `$.observations[${String(index)}]`;
  if (!isObject(value) || !exactKeys(value, OBSERVATION_KEYS)) {
    diagnostics.push(`OBSERVATION_SHAPE_INVALID ${path}`);
    return false;
  }
  const key = targetKey({
    locale: typeof value['locale'] === 'string' ? value['locale'] : '',
    routeId: typeof value['routeId'] === 'string' ? value['routeId'] : '',
    surface: typeof value['surface'] === 'string' ? value['surface'] : '',
  });
  const expected = expectedByKey.get(key);
  if (expected === undefined) {
    diagnostics.push(`OBSERVATION_IDENTITY_UNKNOWN ${path}`);
    return false;
  }
  if (
    value['pathname'] !== expected.pathname ||
    value['semanticStatus'] !== expected.semanticStatus ||
    value['responseStatus'] !== (expected.semanticStatus === 404 ? 404 : 200)
  ) {
    diagnostics.push(`OBSERVATION_ROUTE_OUTCOME_MISMATCH ${path}`);
  }
  if (
    value['redirected'] !== false ||
    value['localePreserved'] !== true ||
    value['diagnosticsRedacted'] !== true ||
    value['recoveryValid'] !== true ||
    value['authorityConnected'] !== false
  ) {
    diagnostics.push(`OBSERVATION_SAFETY_ASSERTION_FAILED ${path}`);
  }
  if (typeof value['contentSha256'] !== 'string' || !SHA256.test(value['contentSha256'])) {
    diagnostics.push(`OBSERVATION_CONTENT_HASH_INVALID ${path}.contentSha256`);
  }
  return true;
};

const validateEvidence = (
  input: unknown,
  repositoryRoot: string,
  requireComplete: boolean,
): RouteReachabilityValidationResult => {
  const diagnostics: string[] = [];
  if (!isObject(input) || !exactKeys(input, EVIDENCE_KEYS)) {
    return Object.freeze({
      diagnostics: Object.freeze(['EVIDENCE_SHAPE_INVALID $']),
      ok: false,
    });
  }
  if (
    input['schemaVersion'] !== ROUTE_REACHABILITY_SCHEMA_VERSION ||
    input['id'] !== 'route-reachability' ||
    input['owner'] !== 'plan-03-35' ||
    input['command'] !== ROUTE_REACHABILITY_COMMAND ||
    (input['status'] !== 'planned' && input['status'] !== 'passed')
  ) {
    diagnostics.push('EVIDENCE_IDENTITY_INVALID $');
  }
  const observedSurfaces = new Set<RouteReachabilitySurface>();
  if (Array.isArray(input['observations'])) {
    for (const observation of input['observations']) {
      if (
        isObject(observation) &&
        (observation['surface'] === 'public' ||
          observation['surface'] === 'account' ||
          observation['surface'] === 'admin')
      ) {
        observedSurfaces.add(observation['surface']);
      }
    }
  }
  validateSourceHashes(
    input,
    repositoryRoot,
    diagnostics,
    requireComplete
      ? new Set<RouteReachabilitySurface>(['public', 'account', 'admin'])
      : observedSurfaces,
  );

  if (!Array.isArray(input['observations'])) {
    diagnostics.push('OBSERVATIONS_INVALID $.observations');
  } else {
    const valid = input['observations'].filter((value, index) =>
      validateObservation(value, index, diagnostics),
    ) as RouteReachabilityObservation[];
    const keys = valid.map(targetKey);
    if (new Set(keys).size !== keys.length) {
      diagnostics.push('OBSERVATION_DUPLICATE $.observations');
    }
    for (const surface of ['public', 'account', 'admin'] as const) {
      const slice = valid.filter((observation) => observation.surface === surface);
      if (slice.length > 0) {
        const expected = canonicalTargets.filter((target) => target.surface === surface);
        if (
          slice.length !== expected.length ||
          !expected.every((target) => keys.includes(targetKey(target)))
        ) {
          diagnostics.push(`SURFACE_SLICE_INCOMPLETE $.observations.${surface}`);
        }
      }
    }

    const complete =
      valid.length === canonicalTargets.length &&
      canonicalTargets.every((target) => keys.includes(targetKey(target)));
    if (requireComplete && !complete) diagnostics.push('OBSERVATION_SET_INCOMPLETE $.observations');
    if (input['status'] !== (complete ? 'passed' : 'planned')) {
      diagnostics.push('EVIDENCE_STATUS_MISMATCH $.status');
    }
  }

  if (diagnostics.length > 0) {
    return Object.freeze({ diagnostics: Object.freeze(diagnostics.toSorted()), ok: false });
  }
  return Object.freeze({ diagnostics: [] as const, ok: true });
};

export const validateRouteReachabilityEvidence = (
  input: unknown,
  repositoryRoot = process.cwd(),
): RouteReachabilityValidationResult => validateEvidence(input, resolve(repositoryRoot), true);

const parseExistingEvidence = (
  evidencePath: string,
  repositoryRoot: string,
): RouteReachabilityEvidence | undefined => {
  if (!existsSync(evidencePath)) return undefined;
  const input = JSON.parse(readFileSync(evidencePath, 'utf8')) as unknown;
  const result = validateEvidence(input, repositoryRoot, false);
  if (!result.ok) {
    throw new Error(
      `Existing route reachability evidence is invalid: ${result.diagnostics.join('; ')}`,
    );
  }
  return input as RouteReachabilityEvidence;
};

const assertCompleteSurfaceSlice = (
  surface: RouteReachabilitySurface,
  observations: readonly RouteReachabilityObservation[],
): void => {
  const expected = canonicalTargets.filter((target) => target.surface === surface);
  const diagnostics: string[] = [];
  const valid = observations.filter((value, index) =>
    validateObservation(value, index, diagnostics),
  );
  const keys = valid.map(targetKey);
  if (
    observations.length !== expected.length ||
    valid.length !== expected.length ||
    new Set(keys).size !== keys.length ||
    !observations.every((observation) => observation.surface === surface) ||
    !expected.every((target) => keys.includes(targetKey(target)))
  ) {
    diagnostics.push(`SURFACE_SLICE_INCOMPLETE $.observations.${surface}`);
  }
  if (diagnostics.length > 0) {
    throw new Error(`Invalid ${surface} route reachability slice: ${diagnostics.join('; ')}`);
  }
};

export const writeRouteReachabilityEvidence = (
  input: WriteRouteReachabilityEvidenceInput,
): RouteReachabilityEvidence => {
  const repositoryRoot = resolve(input.repositoryRoot ?? process.cwd());
  const evidencePath = resolve(input.evidencePath ?? join(repositoryRoot, DEFAULT_EVIDENCE_FILE));
  if (basename(evidencePath) !== 'route-reachability.json') {
    throw new Error('Route reachability writes are limited to route-reachability.json.');
  }
  assertCompleteSurfaceSlice(input.surface, input.observations);

  const existing = parseExistingEvidence(evidencePath, repositoryRoot);
  const observations = [
    ...(existing?.observations.filter(({ surface }) => surface !== input.surface) ?? []),
    ...input.observations,
  ].toSorted(compareObservations);
  const complete =
    observations.length === canonicalTargets.length &&
    canonicalTargets.every((target) =>
      observations.some((value) => targetKey(value) === targetKey(target)),
    );
  const evidence: RouteReachabilityEvidence = Object.freeze({
    ...currentSourceHashes(repositoryRoot),
    command: ROUTE_REACHABILITY_COMMAND,
    id: 'route-reachability',
    observations: Object.freeze(
      observations.map((observation) => Object.freeze({ ...observation })),
    ),
    owner: 'plan-03-35',
    schemaVersion: ROUTE_REACHABILITY_SCHEMA_VERSION,
    status: complete ? 'passed' : 'planned',
  });
  const validation = validateEvidence(evidence, repositoryRoot, complete);
  if (!validation.ok) {
    throw new Error(
      `Refusing to write invalid route reachability evidence: ${validation.diagnostics.join('; ')}`,
    );
  }

  const temporaryPath = join(
    dirname(evidencePath),
    `.${basename(evidencePath)}.${String(process.pid)}.tmp`,
  );
  try {
    writeFileSync(temporaryPath, `${JSON.stringify(evidence, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    });
    renameSync(temporaryPath, evidencePath);
  } finally {
    if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
  }
  return evidence;
};
