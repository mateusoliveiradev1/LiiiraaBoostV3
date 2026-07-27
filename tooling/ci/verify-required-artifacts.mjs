import { readFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url));
const normalizePath = (path) => path.split(sep).join('/');

const QUALITY_MANIFESTS = Object.freeze(
  Array.from({ length: 6 }, (_, index) => `quality/features/found-0${String(index + 1)}.json`),
);

export const REQUIRED_ARTIFACTS = Object.freeze([
  'package.json',
  'turbo.json',
  'architecture/quality-manifest.schema.json',
  'architecture/decisions/0002-contract-versioning-and-compatibility.md',
  'contracts/corpus/manifest.json',
  'contracts/corpus/valid/provenance-vectors.json',
  'contracts/corpus/invalid/rejection-vectors.json',
  'tooling/contract-compat/fixtures/accepted-change.json',
  'tooling/contract-compat/fixtures/breaking-change.json',
  'tooling/contract-compat/fixtures/versioned-baseline.json',
  'tooling/contract-compat/src/check-compat.test.ts',
  'tooling/contract-generation/src/check-drift.test.ts',
  'packages/contracts-ts/src/validation.test.ts',
  'crates/contracts-rust/tests/golden_corpus.rs',
  'crates/contracts-rust/tests/provenance_properties.rs',
  'packages/desktop-client/src/conformance.test.ts',
  'tooling/architecture-tests/fixtures/forbidden-edge.json',
  'tooling/architecture-tests/fixtures/cargo-forbidden-edge.json',
  'tooling/architecture-tests/fixtures/cycle.json',
  'tooling/architecture-tests/src/policy.test.ts',
  'tooling/fixture-guard/fixtures/static-runtime-leaks.json',
  'tooling/fixture-guard/fixtures/production-fixture-type.ts',
  'tooling/fixture-guard/fixtures/leaking-artifact/fixture-sentinel.txt',
  'tooling/fixture-guard/src/fixture-guard.test.ts',
  'tooling/acceptance-policy/fixtures/omission-matrix.json',
  'tooling/acceptance-policy/src/policy.test.ts',
  'tooling/ci/verify-required-artifacts.mjs',
  'tooling/ci/verify-required-artifacts.test.mjs',
  ...QUALITY_MANIFESTS,
]);

export const NEGATIVE_PROOFS = Object.freeze([
  {
    path: 'contracts/corpus/invalid/rejection-vectors.json',
    marker: 'synthetic-invalid-unknown-kind',
  },
  {
    path: 'tooling/contract-compat/fixtures/breaking-change.json',
    marker: 'expectedCaseCount',
  },
  {
    path: 'tooling/contract-generation/src/check-drift.test.ts',
    marker: 'Drift diagnostics must be complete and deterministically sorted.',
  },
  {
    path: 'packages/desktop-client/src/conformance.test.ts',
    marker: 'rejects $defect',
  },
  {
    path: 'tooling/architecture-tests/fixtures/forbidden-edge.json',
    marker: '@liiiraa/desktop-simulator',
  },
  {
    path: 'tooling/architecture-tests/fixtures/cargo-forbidden-edge.json',
    marker: '"importPath": "desktop-application"',
  },
  {
    path: 'tooling/architecture-tests/fixtures/cycle.json',
    marker: './a.ts',
  },
  {
    path: 'tooling/fixture-guard/fixtures/static-runtime-leaks.json',
    marker: 'expectedCaseCount',
  },
  {
    path: 'tooling/fixture-guard/fixtures/production-fixture-type.ts',
    marker: 'SYNTHETIC TYPE LEAK',
  },
  {
    path: 'tooling/fixture-guard/fixtures/leaking-artifact/fixture-sentinel.txt',
    marker: 'LIIIRAA_FIXTURE_SENTINEL',
  },
  {
    path: 'tooling/acceptance-policy/fixtures/omission-matrix.json',
    marker: 'final-planned-unresolved-reference',
  },
]);

const ROOT_QUICK_GATES = Object.freeze([
  'verify:workspace',
  'format:check',
  'check',
  'contracts:check',
  'contracts:compat',
  'test:architecture',
  'test:contracts',
  'test:adapters',
  'test:runtime-truth',
  'test:acceptance-policy -- --mode planned',
  'verify:artifacts',
]);

const ROOT_FULL_GATES = Object.freeze([
  'verify:quick',
  'test',
  'build',
  'test:production-truth',
  'supply-chain:check',
  'test:acceptance-policy -- --mode final',
  'acceptance:check -- --mode final',
]);

const readPaths = async (root, paths) => {
  const snapshot = new Map();

  for (const path of paths) {
    try {
      snapshot.set(path, await readFile(join(root, path), 'utf8'));
    } catch {
      // Missing artifacts remain absent and receive a stable diagnostic.
    }
  }
  return snapshot;
};

export const loadRepositorySnapshot = async (root, { ciPath = undefined } = {}) => {
  const resolvedRoot = resolve(root);
  const paths = new Set(REQUIRED_ARTIFACTS);
  if (ciPath !== undefined) paths.add(ciPath);
  const snapshot = await readPaths(resolvedRoot, paths);

  for (const manifestPath of QUALITY_MANIFESTS) {
    const contents = snapshot.get(manifestPath);
    if (contents === undefined) continue;
    try {
      const manifest = JSON.parse(contents);
      for (const entry of Object.values(manifest.acceptance ?? {})) {
        for (const evidence of entry.evidence ?? []) {
          if (typeof evidence.file === 'string') paths.add(evidence.file);
        }
      }
    } catch {
      // JSON diagnostics are emitted by the verifier.
    }
  }

  return readPaths(resolvedRoot, paths);
};

const parseJson = (snapshot, path, diagnostics) => {
  const contents = snapshot.get(path);
  if (contents === undefined) {
    return undefined;
  }
  try {
    return JSON.parse(contents);
  } catch (error) {
    diagnostics.push(`${path}: invalid JSON (${String(error)})`);
    return undefined;
  }
};

const scriptGraph = (scripts, entry) => {
  const visited = new Set();
  const bodies = [];

  const visit = (name) => {
    if (visited.has(name)) return;
    visited.add(name);
    const body = scripts[name];
    if (typeof body !== 'string') return;
    bodies.push(body);
    for (const match of body.matchAll(/(?:^|&&)\s*pnpm\s+([a-z][\w:-]*)/gu)) {
      visit(match[1]);
    }
  };

  visit(entry);
  return bodies.join('\n');
};

const checkRootScripts = (snapshot, diagnostics) => {
  const manifest = parseJson(snapshot, 'package.json', diagnostics);
  if (manifest === undefined || typeof manifest.scripts !== 'object') {
    diagnostics.push('package.json: scripts map is required');
    return '';
  }
  const scripts = manifest.scripts;
  for (const [entry, requiredGates] of [
    ['verify:quick', ROOT_QUICK_GATES],
    ['verify', ROOT_FULL_GATES],
  ]) {
    const body = scripts[entry];
    if (typeof body !== 'string') {
      diagnostics.push(`package.json:${entry}: required terminating script missing`);
      continue;
    }
    for (const gate of requiredGates) {
      if (!body.includes(`pnpm ${gate}`)) {
        diagnostics.push(`package.json:${entry}: missing "pnpm ${gate}"`);
      }
    }
    if (/(?:\|\|\s*true|--watch\b|--watchAll\b|continue-on-error)/u.test(body)) {
      diagnostics.push(`package.json:${entry}: optional or non-terminating gate forbidden`);
    }
  }
  return scriptGraph(scripts, 'verify');
};

const checkTurbo = (snapshot, diagnostics) => {
  const turbo = parseJson(snapshot, 'turbo.json', diagnostics);
  if (turbo === undefined || typeof turbo.tasks !== 'object') {
    diagnostics.push('turbo.json: tasks map is required');
    return;
  }
  for (const [taskName, task] of Object.entries(turbo.tasks)) {
    if (task?.persistent === true) {
      diagnostics.push(`turbo.json:${taskName}: persistent tasks cannot enter verification`);
    }
  }
};

const checkManifestEvidence = (snapshot, verificationGraph, diagnostics) => {
  for (const manifestPath of QUALITY_MANIFESTS) {
    const manifest = parseJson(snapshot, manifestPath, diagnostics);
    if (manifest === undefined || typeof manifest.acceptance !== 'object') {
      diagnostics.push(`${manifestPath}: acceptance map is required`);
      continue;
    }
    for (const [dimension, entry] of Object.entries(manifest.acceptance)) {
      if (entry?.status !== 'tested' || !Array.isArray(entry.evidence)) {
        continue;
      }
      for (const evidence of entry.evidence) {
        const prefix = `${manifestPath}:${dimension}`;
        if (evidence?.status !== 'passed') {
          diagnostics.push(`${prefix}: final evidence must have status "passed"`);
        }
        if (typeof evidence?.file !== 'string' || !snapshot.has(evidence.file)) {
          diagnostics.push(`${prefix}: final evidence file missing: ${String(evidence?.file)}`);
        }
        if (
          typeof evidence?.command !== 'string' ||
          !verificationGraph.includes(evidence.command)
        ) {
          diagnostics.push(
            `${prefix}: final evidence command is not reachable from verify: ${String(evidence?.command)}`,
          );
        }
      }
    }
  }
};

const checkCi = (snapshot, ciPath, diagnostics) => {
  if (ciPath === undefined) return;
  const ci = snapshot.get(ciPath);
  if (ci === undefined) {
    diagnostics.push(`${ciPath}: required CI workflow missing`);
    return;
  }
  for (const marker of [
    'permissions:',
    'contents: read',
    'pnpm verify:quick',
    'pnpm verify',
    'pnpm contracts:compat',
    '--mode final',
  ]) {
    if (!ci.includes(marker)) {
      diagnostics.push(`${ciPath}: missing "${marker}"`);
    }
  }
  if (/continue-on-error:\s*true|permissions:\s*write-all/u.test(ci)) {
    diagnostics.push(`${ciPath}: verification must fail closed with read-only permissions`);
  }
};

export const verifyRequiredArtifacts = (snapshot, { ciPath = undefined } = {}) => {
  const diagnostics = [];
  for (const path of REQUIRED_ARTIFACTS) {
    if (!snapshot.has(path)) diagnostics.push(`required artifact missing: ${path}`);
  }
  for (const proof of NEGATIVE_PROOFS) {
    const contents = snapshot.get(proof.path);
    if (contents === undefined || !contents.includes(proof.marker)) {
      diagnostics.push(`${proof.path}: required negative proof marker missing: ${proof.marker}`);
    }
  }
  const verificationGraph = checkRootScripts(snapshot, diagnostics);
  checkTurbo(snapshot, diagnostics);
  checkManifestEvidence(snapshot, verificationGraph, diagnostics);
  checkCi(snapshot, ciPath, diagnostics);
  return diagnostics.toSorted();
};

const parseArguments = (arguments_) => {
  if (arguments_.length === 0) return {};
  if (arguments_.length === 2 && arguments_[0] === '--ci') {
    return { ciPath: normalizePath(arguments_[1]) };
  }
  throw new Error('Usage: node tooling/ci/verify-required-artifacts.mjs [--ci <workflow>]');
};

const isDirectExecution =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isDirectExecution) {
  try {
    const options = parseArguments(process.argv.slice(2));
    const snapshot = await loadRepositorySnapshot(repositoryRoot, options);
    const diagnostics = verifyRequiredArtifacts(snapshot, options);
    if (diagnostics.length > 0) {
      throw new Error(`Required Phase 1 artifact verification failed:\n${diagnostics.join('\n')}`);
    }
    console.log(
      `Required Phase 1 artifacts verified (${String(REQUIRED_ARTIFACTS.length)} artifacts, ${String(NEGATIVE_PROOFS.length)} negative proofs).`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
