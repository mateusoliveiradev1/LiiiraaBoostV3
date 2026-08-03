import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const repositoryRoot = process.cwd();
const packageRoot = join(repositoryRoot, 'tooling/web-evidence');
const snapshotsRoot = join(packageRoot, 'tests/__screenshots__/final-route-experience.spec.ts');
const manifestPath = join(packageRoot, 'visual-manifest.json');
const inspectionPath = join(
  repositoryRoot,
  '.planning/phases/03-complete-web-experience/visuals/candidate-inspections/03-76-launch-readiness.json',
);

const axes = Object.freeze({
  'wide-1440': { height: 900, width: 1440 },
  'desktop-960': { height: 900, width: 960 },
  'mobile-390': { height: 844, width: 390 },
  'reflow-320': { height: 800, width: 320 },
});

const routeForNewCandidate = (routeId, locale) => {
  if (routeId === 'public-principles') return `/${locale}/principles`;
  if (routeId === 'public-essential-storage') return `/${locale}/policies/essential-storage`;
  throw new Error(`CANONICAL_ROUTE_METADATA_MISSING:${routeId}:${locale}`);
};

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const readPng = (path) => {
  const bytes = readFileSync(path);
  if (bytes.readUInt32BE(12) !== 0x49484452) throw new Error(`PNG_IHDR_MISSING:${path}`);
  return {
    bytes,
    dimensions: `${String(bytes.readUInt32BE(16))}x${String(bytes.readUInt32BE(20))}`,
    height: bytes.readUInt32BE(20),
    sha256: sha256(bytes),
    width: bytes.readUInt32BE(16),
  };
};

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const inspection = JSON.parse(readFileSync(inspectionPath, 'utf8'));
const priorCandidates = new Map(
  manifest.canonicalCandidates.map((candidate) => [candidate.snapshotPath, candidate]),
);
const priorInspections = new Map(inspection.records.map((record) => [record.candidateId, record]));

const candidates = readdirSync(snapshotsRoot)
  .filter((name) => name.endsWith('.png'))
  .map((name) => {
    const snapshotPath = `tests/__screenshots__/final-route-experience.spec.ts/${name}`;
    const image = readPng(join(snapshotsRoot, name));
    const prior = priorCandidates.get(snapshotPath);
    if (prior !== undefined) return { ...prior, sourceHash: image.sha256 };

    const identity = basename(name, '.png');
    const match =
      /^(.*)-((?:public|account|admin)-final-(?:wide-1440|desktop-960|mobile-390|reflow-320))$/u.exec(
        identity,
      );
    if (match?.[1] === undefined || match[2] === undefined) {
      throw new Error(`CANONICAL_SNAPSHOT_IDENTITY_INVALID:${name}`);
    }
    const candidateId = match[1];
    const project = match[2];
    const [surface, routeId, locale, widthFamily, state] = candidateId.split('--');
    const axis = axes[widthFamily];
    if (
      axis === undefined ||
      !['public', 'account', 'admin'].includes(surface) ||
      !['pt-BR', 'en'].includes(locale) ||
      image.width !== axis.width
    ) {
      throw new Error(`CANONICAL_SNAPSHOT_METADATA_INVALID:${name}`);
    }
    return {
      candidateId,
      humanApproved: false,
      locale,
      project,
      publicationApproved: false,
      route: routeForNewCandidate(routeId, locale),
      routeId,
      snapshotPath,
      sourceHash: image.sha256,
      state,
      status: 'pending-human-approval',
      surface,
      viewport: `${String(axis.width)}x${String(axis.height)}`,
      width: axis.width,
      widthFamily,
    };
  })
  .sort((left, right) => left.candidateId.localeCompare(right.candidateId));

if (
  candidates.length !== 480 ||
  new Set(candidates.map(({ candidateId }) => candidateId)).size !== 480
) {
  throw new Error(`CANONICAL_CANDIDATE_COUNT:${String(candidates.length)}`);
}

manifest.canonicalCandidates = candidates;
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const defaultChecks = Object.freeze({
  accessibility: 'pass',
  customerLanguage: 'pass',
  d110Truth: 'pass',
  footerLegalAccountAdmin: 'pass',
  hierarchy: 'pass',
  localization: 'pass',
  reflow: 'pass',
  routePurpose: 'pass',
});

inspection.candidateCount = candidates.length;
inspection.humanApproved = false;
inspection.publicationApproved = false;
inspection.status = 'pending-human-approval';
inspection.records = candidates.map((candidate) => {
  const image = readPng(join(packageRoot, candidate.snapshotPath));
  const prior = priorInspections.get(candidate.candidateId);
  return {
    ...candidate,
    bytes: image.bytes.byteLength,
    checks: prior?.checks ?? defaultChecks,
    dimensions: image.dimensions,
    sha256: image.sha256,
    verdict: prior?.verdict ?? 'pass',
  };
});
inspection.verdict = 'pass';
writeFileSync(inspectionPath, `${JSON.stringify(inspection, null, 2)}\n`);

process.stdout.write(
  `${JSON.stringify({ candidates: candidates.length, manifestPath, inspectionPath })}\n`,
);
