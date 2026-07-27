import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  NEGATIVE_PROOFS,
  REQUIRED_ARTIFACTS,
  loadRepositorySnapshot,
  verifyRequiredArtifacts,
} from './verify-required-artifacts.mjs';

const repositoryRoot = fileURLToPath(new URL('../../..', import.meta.url));
const ciPath = '.github/workflows/ci.yml';

const loadCleanSnapshot = async () =>
  loadRepositorySnapshot(repositoryRoot, { ciPath });

const expectFailure = (snapshot, expectedFragment) => {
  const diagnostics = verifyRequiredArtifacts(snapshot, { ciPath });
  assert.ok(
    diagnostics.some((diagnostic) => diagnostic.includes(expectedFragment)),
    `Expected a diagnostic containing "${expectedFragment}", received:\n${diagnostics.join('\n')}`,
  );
};

test('the checked-in repository satisfies every required Phase 1 artifact', async () => {
  const snapshot = await loadCleanSnapshot();

  assert.deepEqual(verifyRequiredArtifacts(snapshot, { ciPath }), []);
});

test('removing any required artifact is rejected', async () => {
  const clean = await loadCleanSnapshot();

  for (const path of REQUIRED_ARTIFACTS) {
    const mutated = new Map(clean);
    mutated.delete(path);
    expectFailure(mutated, path);
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
        const mutatedManifest = structuredClone(manifest);
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
  const packageManifest = JSON.parse(clean.get('package.json'));

  packageManifest.scripts['verify:quick'] =
    packageManifest.scripts['verify:quick'].replace('pnpm contracts:compat', '');
  const withoutQuickCompatibility = new Map(clean);
  withoutQuickCompatibility.set(
    'package.json',
    JSON.stringify(packageManifest),
  );
  expectFailure(withoutQuickCompatibility, 'verify:quick');

  const withoutCiCompatibility = new Map(clean);
  withoutCiCompatibility.set(
    ciPath,
    clean.get(ciPath).replace('pnpm contracts:compat', ''),
  );
  expectFailure(withoutCiCompatibility, 'contracts:compat');

  const withoutFinalMode = new Map(clean);
  withoutFinalMode.set(ciPath, clean.get(ciPath).replace('--mode final', ''));
  expectFailure(withoutFinalMode, '--mode final');
});
