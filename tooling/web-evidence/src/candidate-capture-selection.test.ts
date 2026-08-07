import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { routeHref, WEB_LOCALES, webRoutes, type WebLocale, type WebRoute } from '@liiiraa/web-core';
import { describe, expect, it } from 'vitest';

import { PHASE_3_ROUTES } from './verify-phase.js';

const AXES = Object.freeze([
  { axis: 'wide-1440', height: 900, width: 1440 },
  { axis: 'desktop-960', height: 900, width: 960 },
  { axis: 'mobile-390', height: 844, width: 390 },
  { axis: 'reflow-320', height: 800, width: 320 },
] as const);
const SURFACES = Object.freeze(['public', 'account', 'admin'] as const);
const ERROR_ROUTE = /-error-(?:403|404|410|500)$/u;

type Surface = (typeof SURFACES)[number];

type LegacyVisualEntry = Readonly<{ captureId: string; snapshotPath: string }>;
export type CanonicalCandidate = Readonly<{
  candidateId: string;
  humanApproved: false;
  locale: WebLocale;
  project: string;
  publicationApproved: false;
  route: string;
  routeId: string;
  snapshotPath: string;
  sourceHash: string;
  state: string;
  status: 'pending-human-approval';
  surface: Surface;
  viewport: string;
  width: number;
  widthFamily: (typeof AXES)[number]['axis'];
}>;

type VisualManifest = Readonly<{
  canonicalCandidates: readonly CanonicalCandidate[];
  entries: readonly LegacyVisualEntry[];
}>;

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const playwrightCli = createRequire(import.meta.url).resolve('@playwright/test/cli');
const visualManifest = JSON.parse(
  readFileSync(new URL('../visual-manifest.json', import.meta.url), 'utf8'),
) as VisualManifest;

const candidateProjects = SURFACES.flatMap((surface) =>
  AXES.map(({ axis }) => `${surface}-final-${axis}`),
);

const routeParameters = Object.freeze({
  article: 'getting-started',
  caseId: 'case-preview',
  channel: 'stable',
  code: 'lb-err-0x80070005',
  diagnosticId: 'diagnostic-preview',
  eventId: 'event-preview',
  locale: 'pt-BR',
  reference: 'evidence-identifiers',
  reviewId: 'review-preview',
  section: 'preparing',
  version: 'current',
} as const);

const roleFor = (routeId: string): string | undefined => {
  if (routeId === 'admin-operations' || routeId === 'admin-role') return 'operations';
  if (routeId === 'admin-security' || routeId === 'admin-diagnostics') return 'security';
  if (routeId === 'admin-audit' || routeId === 'admin-audit-event') return 'audit';
  return undefined;
};

const pathFor = (route: WebRoute, locale: WebLocale): string => {
  const placeholders = [...route.pathnameTemplate.matchAll(/\[([A-Za-z][A-Za-z0-9]*)\]/gu)].map(
    (match) => match[1],
  );
  const parameters = Object.fromEntries(
    placeholders.map((name) => {
      const value =
        name === 'locale'
          ? locale
          : name === 'version' && route.id === 'docs-history'
            ? '1.0.0'
            : name === 'article' && route.id === 'docs-history'
              ? 'legacy-capture'
              : routeParameters[name as keyof typeof routeParameters];
      if (value === undefined) throw new Error(`No candidate value for ${route.id}:${name}`);
      return [name, value];
    }),
  );
  const href = routeHref(route.id, parameters);
  if (!href.ok) throw new Error(`Unable to project ${route.id}: ${href.error.code}`);
  const role = roleFor(route.id);
  return role === undefined ? href.value : `${href.value}?role=${role}`;
};

export const expectedCanonicalCandidates = (): readonly CanonicalCandidate[] =>
  webRoutes
    .filter(({ id }) => (PHASE_3_ROUTES as readonly string[]).includes(id))
    .flatMap((route) =>
      WEB_LOCALES.flatMap((locale) =>
        AXES.map(({ axis, height, width }) => {
        const surface = route.surface;
        const state = ERROR_ROUTE.test(route.id)
          ? route.id.slice(route.id.lastIndexOf('error-'))
          : 'ready';
        const candidateId = [surface, route.id, locale, axis, state].join('--');
        const project = `${surface}-final-${axis}`;
        return {
          candidateId,
          humanApproved: false,
          locale,
          project,
          publicationApproved: false,
          route: pathFor(route, locale),
          routeId: route.id,
          snapshotPath: `tests/__screenshots__/final-route-experience.spec.ts/${candidateId}-${project}.png`,
          sourceHash: 'pending-capture',
          state,
          status: 'pending-human-approval',
          surface,
          viewport: `${String(width)}x${String(height)}`,
          width,
          widthFamily: axis,
        } satisfies CanonicalCandidate;
        }),
      ),
    );

const sha256 = (path: string): string =>
  createHash('sha256').update(readFileSync(path)).digest('hex');

export const candidateDiagnostics = (
  actual: readonly CanonicalCandidate[],
  expected: readonly CanonicalCandidate[],
  hashForPath: (path: string) => string | undefined,
): readonly string[] => {
  const diagnostics: string[] = [];
  const expectedById = new Map(expected.map((candidate) => [candidate.candidateId, candidate]));
  const actualById = new Map(actual.map((candidate) => [candidate.candidateId, candidate]));
  if (actual.length !== expected.length || actualById.size !== actual.length) {
    diagnostics.push('CANDIDATE_CARDINALITY_OR_DUPLICATE');
  }
  if ([...actualById.keys()].some((id) => !expectedById.has(id))) diagnostics.push('EXTRA_CANDIDATE');
  if ([...expectedById.keys()].some((id) => !actualById.has(id))) diagnostics.push('MISSING_CANDIDATE');
  if (new Set(actual.map(({ snapshotPath }) => snapshotPath)).size !== actual.length) {
    diagnostics.push('SNAPSHOT_PATH_COLLISION');
  }
  for (const [id, expectedCandidate] of expectedById) {
    const candidate = actualById.get(id);
    if (candidate === undefined) continue;
    const { sourceHash: _expectedHash, ...expectedMetadata } = expectedCandidate;
    void _expectedHash;
    const { sourceHash, ...actualMetadata } = candidate;
    if (JSON.stringify(actualMetadata) !== JSON.stringify(expectedMetadata)) {
      diagnostics.push(`CANDIDATE_METADATA_MISMATCH:${id}`);
    }
    const currentHash = hashForPath(candidate.snapshotPath);
    if (sourceHash !== (currentHash ?? 'pending-capture')) diagnostics.push(`STALE_SOURCE_HASH:${id}`);
  }
  return diagnostics;
};

const listedCandidates = (): readonly Readonly<{ candidateId: string; project: string }>[] => {
  const result = spawnSync(
    process.execPath,
    [
      playwrightCli,
      'test',
      'tests/final-route-experience.spec.ts',
      '--list',
      '--grep',
      '@canonical-candidate',
      ...candidateProjects.map((project) => `--project=${project}`),
    ],
    { cwd: packageRoot, encoding: 'utf8', shell: false, timeout: 60_000 },
  );
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
  const listed = result.stdout.split(/\r?\n/u).flatMap((line) => {
    const match = /^\s*\[([^\]]+)\].*@canonical-candidate\s+(\S+)\s*$/u.exec(line);
    return match?.[1] === undefined || match[2] === undefined
      ? []
      : [{ candidateId: match[2], project: match[1] }];
  });
  expect(result.stdout).toMatch(
    new RegExp(`Total: ${String(PHASE_3_ROUTES.length * 8)} tests in 1 file`, 'u'),
  );
  return listed;
};

describe('candidate capture Playwright selection', () => {
  it('dry-lists canonical routes × locales × widths under one exact owning project', () => {
    const expected = expectedCanonicalCandidates();
    const listed = listedCandidates();
    expect(listed).toHaveLength(expected.length);
    expect(new Set(listed.map(({ candidateId }) => candidateId)).size).toBe(expected.length);
    expect(
      listed
        .map(({ candidateId, project }) => ({ candidateId, project }))
        .sort((left, right) => left.candidateId.localeCompare(right.candidateId)),
    ).toEqual(
      expected
        .map(({ candidateId, project }) => ({ candidateId, project }))
        .sort((left, right) => left.candidateId.localeCompare(right.candidateId)),
    );
  });

  it('binds the manifest exactly and rejects missing, extra, stale, colliding, or approved candidates', () => {
    const expected = expectedCanonicalCandidates();
    const hashForPath = (path: string): string | undefined => {
      const absolute = join(packageRoot, path);
      return existsSync(absolute) ? sha256(absolute) : undefined;
    };
    expect(candidateDiagnostics(visualManifest.canonicalCandidates ?? [], expected, hashForPath)).toEqual([]);

    const valid = expected.map((candidate) => ({ ...candidate, sourceHash: 'hash' }));
    expect(candidateDiagnostics(valid.slice(1), expected, () => 'hash')).toContain('MISSING_CANDIDATE');
    expect(candidateDiagnostics([...valid, { ...valid[0]!, candidateId: 'extra' }], expected, () => 'hash')).toContain('EXTRA_CANDIDATE');
    expect(candidateDiagnostics(valid.map((candidate, index) => index === 0 ? { ...candidate, sourceHash: 'stale' } : candidate), expected, () => 'hash')).toContain(`STALE_SOURCE_HASH:${expected[0]!.candidateId}`);
    expect(candidateDiagnostics(valid.map((candidate, index) => index === 1 ? { ...candidate, snapshotPath: valid[0]!.snapshotPath } : candidate), expected, () => 'hash')).toContain('SNAPSHOT_PATH_COLLISION');
    expect(candidateDiagnostics(valid.map((candidate, index) => index === 0 ? { ...candidate, humanApproved: true as never } : candidate), expected, () => 'hash')).toContain(`CANDIDATE_METADATA_MISMATCH:${expected[0]!.candidateId}`);
  });

  it('retains W01-W18 and G01-G07 as separate continuity evidence', () => {
    const expectedIds = [
      ...Array.from({ length: 18 }, (_, index) => `W${String(index + 1).padStart(2, '0')}`),
      ...Array.from({ length: 7 }, (_, index) => `G${String(index + 1).padStart(2, '0')}`),
    ];
    expect(visualManifest.entries.map(({ captureId }) => captureId)).toEqual(expectedIds);
    expect(new Set(visualManifest.entries.map(({ snapshotPath }) => snapshotPath)).size).toBe(25);
  });
});
