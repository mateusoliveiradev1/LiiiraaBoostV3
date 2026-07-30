import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const defaultWorkspaceRoot = resolve(scriptDirectory, '..', '..');
const prefix = '[phase-02-final]';

const fail = (message) => {
  throw new Error(`${prefix} ${message}`);
};

const readJson = (path, label) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return fail(`${label} is not readable JSON: ${detail}`);
  }
};

const requireFile = (workspaceRoot, relativePath, label = relativePath) => {
  const absolutePath = resolve(workspaceRoot, relativePath);
  if (!existsSync(absolutePath)) {
    fail(`${label} is missing: ${relativePath}`);
  }
  return absolutePath;
};

const sha256 = (path) =>
  createHash('sha256').update(readFileSync(path)).digest('hex').toUpperCase();

const validateArtifactReference = (workspaceRoot, record, label) => {
  if (record.status !== 'observed' || record.result !== 'passed') {
    fail(`${label} must be an observed passing record.`);
  }
  if (
    record.trustClass !== 'self-signed-development' ||
    record.publicTrust !== false ||
    record.productionReady !== false ||
    record.distributionAllowed !== false
  ) {
    fail(`${label} must preserve the self-signed development trust boundary.`);
  }
  if (!/^[A-F0-9]{64}$/u.test(record.artifactHash)) {
    fail(`${label} must contain an uppercase SHA-256 artifact hash.`);
  }
  if (!Array.isArray(record.attachments) || record.attachments.length === 0) {
    fail(`${label} must reference at least one attachment.`);
  }
  const recordDirectory = dirname(record.__path);
  for (const attachment of record.attachments) {
    const attachmentPath = isAbsolute(attachment)
      ? attachment
      : resolve(recordDirectory, attachment);
    const containedPath = relative(recordDirectory, attachmentPath);
    if (containedPath.startsWith('..') || isAbsolute(containedPath)) {
      fail(`${label} attachment escapes the manual evidence directory.`);
    }
    if (!existsSync(attachmentPath)) {
      fail(`${label} attachment is missing: ${attachment}`);
    }
  }

  const artifactPath = requireFile(workspaceRoot, record.artifactPath, `${label} artifact`);
  return {
    currentArtifact: sha256(artifactPath) === record.artifactHash,
    hash: record.artifactHash,
    id: record.id,
  };
};

const collectManifestEvidence = (manifest) =>
  Object.values(manifest.acceptance ?? {}).flatMap((dimension) =>
    Array.isArray(dimension.evidence) ? dimension.evidence : [],
  );

export const verifyPhase02 = ({ workspaceRoot = defaultWorkspaceRoot } = {}) => {
  const signedPackagePath = requireFile(
    workspaceRoot,
    'quality/evidence/phase-02/artifacts/signed-desktop-package.json',
  );
  const signedPackage = readJson(signedPackagePath, 'signed desktop package');
  if (
    signedPackage.artifactClass !== 'self-signed-development' ||
    signedPackage.signing?.publicTrust !== false ||
    signedPackage.signing?.smartScreenReputation !== false ||
    signedPackage.signing?.productionReady !== false ||
    signedPackage.signing?.distributionAllowed !== false ||
    signedPackage.signing?.productionSigningDeferredTo !== 'Phase 10'
  ) {
    fail('signed package must remain development-only with production signing deferred.');
  }

  for (const artifact of signedPackage.artifacts ?? []) {
    const stagedPath = requireFile(workspaceRoot, artifact.stagedPath, artifact.kind);
    const observedHash = sha256(stagedPath);
    if (observedHash !== artifact.stagedSha256 || observedHash !== artifact.sha256) {
      fail(`${artifact.kind} hash does not match the signed package record.`);
    }
  }

  const requirementIds = [];
  const evidenceFiles = new Set();
  for (let index = 1; index <= 12; index += 1) {
    const id = `UX-${String(index).padStart(2, '0')}`;
    const manifestPath = requireFile(
      workspaceRoot,
      `quality/features/ux-${String(index).padStart(2, '0')}.json`,
      `${id} manifest`,
    );
    const manifest = readJson(manifestPath, `${id} manifest`);
    if (!Array.isArray(manifest.requirements) || !manifest.requirements.includes(id)) {
      fail(`${id} manifest does not own its requirement.`);
    }
    requirementIds.push(id);
    for (const evidence of collectManifestEvidence(manifest)) {
      if (typeof evidence.file !== 'string' || typeof evidence.command !== 'string') {
        fail(`${id} contains an incomplete evidence reference.`);
      }
      requireFile(workspaceRoot, evidence.file, `${id} evidence`);
      evidenceFiles.add(evidence.file);
    }
  }

  const manualRecords = [
    'nvda.json',
    'forced-colors.json',
    'text-scale-200.json',
    'app-scale-150.json',
  ].map((name) => {
    const path = requireFile(
      workspaceRoot,
      join('quality/evidence/phase-02/manual', name),
      `manual observation ${name}`,
    );
    const record = readJson(path, `manual observation ${name}`);
    return validateArtifactReference(workspaceRoot, { ...record, __path: path }, name);
  });

  requireFile(workspaceRoot, 'contracts/scenarios/desktop-scenarios.json');
  requireFile(workspaceRoot, 'tooling/desktop-evidence/story-manifest.json');
  requireFile(workspaceRoot, 'tooling/ci/verify-required-artifacts.mjs');
  requireFile(workspaceRoot, 'tooling/ci/verify-required-artifacts.test.mjs');

  const windows10 = readJson(
    requireFile(workspaceRoot, 'quality/evidence/phase-02/environment/windows-10-image.json'),
    'Windows 10 environment record',
  );

  const warnings = [];
  if (windows10.status !== 'observed' && windows10.status !== 'reviewed') {
    warnings.push(
      'Windows 10 packaged validation remains explicitly unresolved and must be completed before public compatibility or distribution claims.',
    );
  }
  if (manualRecords.some((record) => !record.currentArtifact)) {
    warnings.push(
      'NVDA or contrast evidence remains tied to its originally observed development artifact; no observation was rewritten or fabricated.',
    );
  }

  return {
    acceptance: 'passed',
    scope: 'phase-02-development-visual-ux',
    requirements: requirementIds,
    evidenceReferences: evidenceFiles.size,
    manualObservations: manualRecords.map(({ id, hash }) => ({ id, hash })),
    signedArtifactClass: signedPackage.artifactClass,
    publicTrust: false,
    productionReady: false,
    distributionAllowed: false,
    warnings,
  };
};

const parseArguments = (arguments_) => {
  const supported = new Set(['--mode', 'final', '--smoke']);
  for (const argument of arguments_) {
    if (!supported.has(argument)) {
      fail(`unsupported argument: ${argument}`);
    }
  }
  const modeIndex = arguments_.indexOf('--mode');
  if (modeIndex !== -1 && arguments_[modeIndex + 1] !== 'final') {
    fail('only --mode final is supported.');
  }
};

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMain) {
  try {
    parseArguments(process.argv.slice(2));
    process.stdout.write(`${JSON.stringify(verifyPhase02(), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
