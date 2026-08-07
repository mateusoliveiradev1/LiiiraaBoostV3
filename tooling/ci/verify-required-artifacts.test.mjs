import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  NEGATIVE_PROOFS,
  REQUIRED_ARTIFACTS,
  REQUIRED_DOCS,
  loadRepositorySnapshot,
  verifyRequiredArtifacts,
} from './verify-required-artifacts.mjs';

const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url));
const ciPath = '.github/workflows/ci.yml';

const loadCleanSnapshot = async () => loadRepositorySnapshot(repositoryRoot);

const expectFailure = (snapshot, expectedFragment, options = {}) => {
  const diagnostics = verifyRequiredArtifacts(snapshot, options);
  assert.ok(
    diagnostics.some((diagnostic) => diagnostic.includes(expectedFragment)),
    `Expected a diagnostic containing "${expectedFragment}", received:\n${diagnostics.join('\n')}`,
  );
};

test('the checked-in repository satisfies every required Phase 1 artifact', async () => {
  const snapshot = await loadCleanSnapshot();

  assert.deepEqual(verifyRequiredArtifacts(snapshot), []);
});

test('removing any required artifact is rejected', async () => {
  const clean = await loadCleanSnapshot();

  for (const path of REQUIRED_ARTIFACTS) {
    const mutated = new Map(clean);
    mutated.delete(path);
    expectFailure(mutated, path);
  }
});

test('docs-only verification rejects every required contributor document omission', async () => {
  const clean = await loadCleanSnapshot();
  assert.deepEqual(verifyRequiredArtifacts(clean, { docsOnly: true }), []);

  for (const path of REQUIRED_DOCS) {
    const mutated = new Map(clean);
    mutated.delete(path);
    expectFailure(mutated, path, { docsOnly: true });
  }
});

test('removing any named negative proof is rejected', async () => {
  const clean = await loadCleanSnapshot();

  for (const proof of NEGATIVE_PROOFS) {
    const mutated = new Map(clean);
    const contents = mutated.get(proof.path);
    assert.equal(typeof contents, 'string', `Missing baseline proof ${proof.path}`);
    assert.ok(
      contents.includes(proof.marker),
      `Baseline proof ${proof.path} is missing marker "${proof.marker}"`,
    );
    mutated.set(proof.path, contents.replace(proof.marker, ''));
    expectFailure(mutated, proof.path);
  }
});

test('removing any final evidence reference is rejected', async () => {
  const clean = await loadCleanSnapshot();

  for (const manifestPath of REQUIRED_ARTIFACTS.filter((path) =>
    path.startsWith('quality/features/'),
  )) {
    const manifest = JSON.parse(clean.get(manifestPath));
    for (const [dimension, entry] of Object.entries(manifest.acceptance)) {
      for (let index = 0; index < entry.evidence.length; index += 1) {
        const mutatedManifest = JSON.parse(JSON.stringify(manifest));
        mutatedManifest.acceptance[dimension].evidence[index].status = 'planned';
        const mutated = new Map(clean);
        mutated.set(manifestPath, JSON.stringify(mutatedManifest));
        expectFailure(mutated, `${manifestPath}:${dimension}`);

        const missingEvidence = new Map(clean);
        missingEvidence.delete(entry.evidence[index].file);
        expectFailure(missingEvidence, entry.evidence[index].file);
      }
    }
  }
});

test('root and CI reachability reject compatibility or final-policy omission', async () => {
  const clean = await loadCleanSnapshot();
  clean.set(
    ciPath,
    [
      'permissions:',
      '  contents: read',
      'run: pnpm verify:quick',
      'run: pnpm verify',
      'run: pnpm contracts:compat',
      'run: pnpm acceptance:check -- --mode final',
    ].join('\n'),
  );
  const packageManifest = JSON.parse(clean.get('package.json'));

  packageManifest.scripts['verify:foundation:quick'] = packageManifest.scripts[
    'verify:foundation:quick'
  ].replace('pnpm contracts:compat', '');
  const withoutQuickCompatibility = new Map(clean);
  withoutQuickCompatibility.set('package.json', JSON.stringify(packageManifest));
  expectFailure(withoutQuickCompatibility, 'verify:quick');

  const withoutCiCompatibility = new Map(clean);
  withoutCiCompatibility.set(ciPath, clean.get(ciPath).replace('pnpm contracts:compat', ''));
  assert.ok(
    verifyRequiredArtifacts(withoutCiCompatibility, { ciPath }).some((diagnostic) =>
      diagnostic.includes('contracts:compat'),
    ),
  );

  const withoutFinalMode = new Map(clean);
  withoutFinalMode.set(ciPath, clean.get(ciPath).replace('--mode final', ''));
  assert.ok(
    verifyRequiredArtifacts(withoutFinalMode, { ciPath }).some((diagnostic) =>
      diagnostic.includes('--mode final'),
    ),
  );
});

test('all CI verification jobs fetch immutable contract baseline history', async () => {
  const clean = await loadCleanSnapshot();
  const ci = await readFile(
    fileURLToPath(new URL('../../.github/workflows/ci.yml', import.meta.url)),
    'utf8',
  );
  const shallowCheckout = new Map(clean);
  shallowCheckout.set(ciPath, ci.replace('fetch-depth: 0', 'fetch-depth: 1'));
  assert.ok(
    verifyRequiredArtifacts(shallowCheckout, { ciPath }).some((diagnostic) =>
      diagnostic.includes('all three verification jobs must fetch complete history'),
    ),
  );
});
