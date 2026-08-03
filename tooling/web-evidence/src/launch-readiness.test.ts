import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
const inspectionPath = join(
  repositoryRoot,
  '.planning/phases/03-complete-web-experience/visuals/candidate-inspections/03-76-launch-readiness.json',
);
const REQUIRED_DECISIONS = Object.freeze(
  Array.from({ length: 9 }, (_, index) => `D-${String(index + 102)}`),
);
const REQUIRED_CHECKS = Object.freeze([
  'accessibility',
  'customerLanguage',
  'd110Truth',
  'footerLegalAccountAdmin',
  'hierarchy',
  'localization',
  'reflow',
  'routePurpose',
] as const);

type CanonicalCandidate = Readonly<{
  candidateId: string;
  humanApproved: false;
  locale: 'pt-BR' | 'en';
  project: string;
  publicationApproved: false;
  route: string;
  routeId: string;
  snapshotPath: string;
  sourceHash: string;
  state: string;
  status: 'pending-human-approval';
  surface: 'public' | 'account' | 'admin';
  viewport: string;
  width: number;
  widthFamily: 'wide-1440' | 'desktop-960' | 'mobile-390' | 'reflow-320';
}>;

type InspectionRecord = Readonly<
  Omit<CanonicalCandidate, 'sourceHash'> & {
    bytes: number;
    checks: Readonly<Record<(typeof REQUIRED_CHECKS)[number], 'pass'>>;
    dimensions: string;
    sha256: string;
    verdict: 'pass';
  }
>;

type LaunchReadiness = Readonly<{
  candidateCount: number;
  decisionOutcomes: readonly Readonly<{ decision: string; verdict: 'pass' }>[];
  humanApproved: false;
  inspectionMode: 'original-resolution';
  plan: '03-81';
  publicationApproved: false;
  records: readonly InspectionRecord[];
  status: 'pending-human-approval';
  verdict: 'pass';
}>;

const visualManifest = JSON.parse(
  readFileSync(new URL('../visual-manifest.json', import.meta.url), 'utf8'),
) as Readonly<{ canonicalCandidates: readonly CanonicalCandidate[] }>;

const sha256 = (path: string): string =>
  createHash('sha256').update(readFileSync(path)).digest('hex');

export const launchReadinessDiagnostics = (
  manifest: readonly CanonicalCandidate[],
  inspection: LaunchReadiness,
): readonly string[] => {
  const diagnostics: string[] = [];
  if (inspection.inspectionMode !== 'original-resolution') diagnostics.push('INSPECTION_MODE');
  if (inspection.status !== 'pending-human-approval' || inspection.humanApproved || inspection.publicationApproved) diagnostics.push('APPROVAL_BOUNDARY');
  if (inspection.candidateCount !== manifest.length || inspection.records.length !== manifest.length) diagnostics.push('CANDIDATE_COUNT');
  const records = new Map(inspection.records.map((record) => [record.candidateId, record]));
  if (records.size !== inspection.records.length) diagnostics.push('DUPLICATE_INSPECTION');
  for (const candidate of manifest) {
    const record = records.get(candidate.candidateId);
    if (record === undefined) {
      diagnostics.push(`MISSING_INSPECTION:${candidate.candidateId}`);
      continue;
    }
    for (const key of ['snapshotPath', 'surface', 'routeId', 'route', 'locale', 'width', 'widthFamily', 'viewport', 'state', 'project', 'status', 'humanApproved', 'publicationApproved'] as const) {
      if (record[key] !== candidate[key]) diagnostics.push(`BINDING_MISMATCH:${candidate.candidateId}:${key}`);
    }
    if (record.sha256 !== candidate.sourceHash) diagnostics.push(`HASH_MISMATCH:${candidate.candidateId}`);
    if (record.verdict !== 'pass' || REQUIRED_CHECKS.some((check) => record.checks[check] !== 'pass')) diagnostics.push(`QUALITATIVE_VERDICT:${candidate.candidateId}`);
  }
  if (inspection.records.some(({ candidateId }) => !manifest.some((candidate) => candidate.candidateId === candidateId))) diagnostics.push('EXTRA_INSPECTION');
  if (JSON.stringify(inspection.decisionOutcomes.map(({ decision }) => decision)) !== JSON.stringify(REQUIRED_DECISIONS) || inspection.decisionOutcomes.some(({ verdict }) => verdict !== 'pass')) diagnostics.push('DECISION_OUTCOMES');
  return diagnostics;
};

const fixtureRecord = (candidate: CanonicalCandidate): InspectionRecord => ({
  ...candidate,
  bytes: 1,
  checks: Object.fromEntries(REQUIRED_CHECKS.map((check) => [check, 'pass'])) as InspectionRecord['checks'],
  dimensions: candidate.viewport,
  sha256: candidate.sourceHash,
  verdict: 'pass',
});

const fixtureInspection = (candidates: readonly CanonicalCandidate[]): LaunchReadiness => ({
  candidateCount: candidates.length,
  decisionOutcomes: REQUIRED_DECISIONS.map((decision) => ({ decision, verdict: 'pass' })),
  humanApproved: false,
  inspectionMode: 'original-resolution',
  plan: '03-81',
  publicationApproved: false,
  records: candidates.map(fixtureRecord),
  status: 'pending-human-approval',
  verdict: 'pass',
});

const fixtureCandidates = (): readonly CanonicalCandidate[] =>
  (['pt-BR', 'en'] as const).map((locale) => ({
    candidateId: `public--public-home--${locale}--wide-1440--ready`,
    humanApproved: false,
    locale,
    project: 'public-final-wide-1440',
    publicationApproved: false,
    route: `/${locale}`,
    routeId: 'public-home',
    snapshotPath: `tests/__screenshots__/final-route-experience.spec.ts/public--public-home--${locale}--wide-1440--ready-public-final-wide-1440.png`,
    sourceHash: 'hash',
    state: 'ready',
    status: 'pending-human-approval',
    surface: 'public',
    viewport: '1440x900',
    width: 1440,
    widthFamily: 'wide-1440',
  }));

describe('Plan 03-81 launch readiness binding', () => {
  it('rejects missing/hash/dimension/route/locale/width/state or approval drift', () => {
    const candidates = fixtureCandidates();
    const valid = fixtureInspection(candidates);
    expect(launchReadinessDiagnostics(candidates, valid)).toEqual([]);
    expect(launchReadinessDiagnostics(candidates, { ...valid, records: valid.records.slice(1) })).toContain(`MISSING_INSPECTION:${candidates[0]?.candidateId}`);
    for (const [key, value] of [['snapshotPath', 'wrong.png'], ['route', '/wrong'], ['locale', 'wrong'], ['width', 1], ['state', 'wrong']] as const) {
      const changed = { ...valid.records[0]!, [key]: value };
      expect(launchReadinessDiagnostics(candidates, { ...valid, records: [changed as InspectionRecord, ...valid.records.slice(1)] })).toContain(`BINDING_MISMATCH:${candidates[0]?.candidateId}:${key}`);
    }
    expect(launchReadinessDiagnostics(candidates, { ...valid, records: [{ ...valid.records[0]!, sha256: 'stale' }, ...valid.records.slice(1)] })).toContain(`HASH_MISMATCH:${candidates[0]?.candidateId}`);
    expect(launchReadinessDiagnostics(candidates, { ...valid, humanApproved: true as never })).toContain('APPROVAL_BOUNDARY');
  });

  it.skipIf(!existsSync(inspectionPath))('binds every current manifest candidate to its exact PNG and original dimensions', () => {
    const inspection = JSON.parse(readFileSync(inspectionPath, 'utf8')) as LaunchReadiness;
    expect(launchReadinessDiagnostics(visualManifest.canonicalCandidates ?? [], inspection)).toEqual([]);
    for (const record of inspection.records) {
      const path = join(packageRoot, record.snapshotPath);
      const image = readFileSync(path);
      expect(record.sha256).toBe(sha256(path));
      expect(record.bytes).toBe(image.byteLength);
      expect(record.dimensions).toBe(`${String(image.readUInt32BE(16))}x${String(image.readUInt32BE(20))}`);
    }
  });
});
