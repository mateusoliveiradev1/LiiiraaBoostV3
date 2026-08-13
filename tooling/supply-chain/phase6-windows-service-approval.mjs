import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const approvalPath = path.join(
  repositoryRoot,
  '.planning',
  'phases',
  '06-transactional-plans-and-recovery',
  '06-04-SUPPLY-CHAIN-APPROVAL.md',
);
const expected = Object.freeze({
  name: 'windows-service',
  version: '0.8.1',
  registry: 'https://crates.io',
  registryRecordUrl: 'https://crates.io/api/v1/crates/windows-service/0.8.1',
  registryDependenciesUrl: 'https://crates.io/api/v1/crates/windows-service/0.8.1/dependencies',
  sourceRepositoryUrl: 'https://github.com/mullvad/windows-service-rs',
  sourceTag: 'v0.8.1',
});
const githubApiRoot = 'https://api.github.com/repos/mullvad/windows-service-rs';
const recordStart = '<!-- phase6-windows-service-approval-record:start';
const recordEnd = 'phase6-windows-service-approval-record:end -->';
const ignoredDirectories = new Set(['.git', '.next', '.turbo', 'node_modules', 'target']);

function redact(value) {
  return String(value)
    .replace(/([?&](?:access_?token|auth|key|password|token)=)[^&\s]+/gi, '$1[REDACTED]')
    .replace(/(https?:\/\/)[^/@\s]+@/gi, '$1[REDACTED]@')
    .replace(/\b(?:npm_[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9_]{20,})\b/g, '[REDACTED]');
}

function fail(message) {
  throw new Error(redact(message));
}

function normalizeNewlines(value) {
  return value.replaceAll('\r\n', '\n');
}

function normalizeRepository(value) {
  if (typeof value !== 'string') return '';
  try {
    const parsed = new URL(
      value.replace(/^git\+/, '').replace(/^git@github\.com:/i, 'https://github.com/'),
    );
    parsed.username = '';
    parsed.password = '';
    parsed.search = '';
    parsed.hash = '';
    return `${parsed.protocol}//${parsed.host.toLowerCase()}${parsed.pathname}`
      .replace(/\.git$/i, '')
      .replace(/\/+$/, '')
      .toLowerCase();
  } catch {
    return '';
  }
}

function assertExactKeys(value, keys, label) {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    fail(`${label} must be an object`);
  }
  const actual = Object.keys(value).sort();
  const wanted = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    fail(`${label} fields mismatch: expected ${wanted.join(', ')}, received ${actual.join(', ')}`);
  }
}

function assertNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') fail(`${label} must be a non-empty string`);
}

function stableCompare(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function fetchJson(url, accept = 'application/json') {
  let response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: accept,
        'User-Agent': 'liiiraa-boost-phase6-approval/1.0',
        ...(url.startsWith('https://api.github.com/')
          ? { 'X-GitHub-Api-Version': '2022-11-28' }
          : {}),
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    fail(`unable to fetch ${url}: ${error.message}`);
  }
  if (!response.ok) fail(`official metadata request ${url} returned HTTP ${response.status}`);
  try {
    return await response.json();
  } catch (error) {
    fail(`official metadata response ${url} was not JSON: ${error.message}`);
  }
}

async function fetchText(url) {
  let response;
  try {
    response = await fetch(url, {
      headers: { 'User-Agent': 'liiiraa-boost-phase6-approval/1.0' },
      redirect: 'follow',
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    fail(`unable to fetch ${url}: ${error.message}`);
  }
  if (!response.ok) fail(`official source request ${url} returned HTTP ${response.status}`);
  return response.text();
}

async function resolveTagCommit() {
  const reference = await fetchJson(
    `${githubApiRoot}/git/ref/tags/${encodeURIComponent(expected.sourceTag)}`,
    'application/vnd.github+json',
  );
  let object = reference.object;
  let tagObjectSha = null;
  let tagSignatureVerified = null;
  if (object?.type === 'tag') {
    tagObjectSha = object.sha;
    const tag = await fetchJson(object.url, 'application/vnd.github+json');
    if (tag.tag !== expected.sourceTag) fail('source tag object does not match v0.8.1');
    tagSignatureVerified = tag.verification?.verified === true;
    object = tag.object;
  }
  if (object?.type !== 'commit' || !/^[0-9a-f]{40}$/.test(object.sha ?? '')) {
    fail('source tag does not resolve to an immutable 40-character commit');
  }
  return { commit: object.sha, tagObjectSha, tagSignatureVerified };
}

function dependencySummary(dependencies) {
  if (!Array.isArray(dependencies)) fail('crates.io dependency response is malformed');
  return dependencies
    .map((dependency) => ({
      name: dependency.crate_id,
      requirement: dependency.req,
      kind: dependency.kind,
      target: dependency.target,
      optional: dependency.optional,
      defaultFeatures: dependency.default_features,
      features: [...dependency.features].sort(),
    }))
    .sort(
      (left, right) =>
        left.name.localeCompare(right.name) ||
        String(left.target).localeCompare(String(right.target)) ||
        left.kind.localeCompare(right.kind),
    );
}

async function fetchOfficialCandidate() {
  const payload = await fetchJson(expected.registryRecordUrl);
  const metadata = payload.version;
  if (metadata?.crate !== expected.name || metadata?.num !== expected.version) {
    fail('crates.io returned a differently named crate or version');
  }
  if (normalizeRepository(metadata.repository) !== expected.sourceRepositoryUrl) {
    fail(`crates.io source mismatch: received ${metadata.repository ?? '[missing]'}`);
  }
  if (!/^[0-9a-f]{64}$/.test(metadata.checksum ?? '')) {
    fail('crates.io did not return an immutable SHA-256 checksum');
  }
  assertNonEmptyString(metadata.license, 'crates.io SPDX license');
  assertNonEmptyString(metadata.created_at, 'crates.io publication timestamp');
  assertNonEmptyString(metadata.published_by?.login, 'crates.io publisher login');

  const dependencyPayload = await fetchJson(expected.registryDependenciesUrl);
  const tag = await resolveTagCommit();
  const sourceManifestUrl = `https://raw.githubusercontent.com/mullvad/windows-service-rs/${tag.commit}/Cargo.toml`;
  const [sourceManifest, sourceTree] = await Promise.all([
    fetchText(sourceManifestUrl),
    fetchJson(
      `${githubApiRoot}/git/trees/${tag.commit}?recursive=1`,
      'application/vnd.github+json',
    ),
  ]);
  if (!Array.isArray(sourceTree.tree) || sourceTree.truncated === true) {
    fail('immutable source tree is unavailable or truncated');
  }
  const rootBuildScriptPresent = sourceTree.tree.some(
    (entry) => entry.type === 'blob' && entry.path === 'build.rs',
  );
  const packageStart = sourceManifest.indexOf('[package]');
  const followingSection = sourceManifest.indexOf('\n[', packageStart + '[package]'.length);
  const packageSection =
    packageStart === -1
      ? ''
      : sourceManifest.slice(
          packageStart,
          followingSection === -1 ? sourceManifest.length : followingSection,
        );
  const manifestDeclaresBuildScript = /^\s*build\s*=/m.test(packageSection);
  const manifestDeclaresNativeLinks = /^\s*links\s*=/m.test(packageSection);
  const binaryNames = Array.isArray(metadata.bin_names) ? [...metadata.bin_names].sort() : [];

  return {
    name: expected.name,
    version: expected.version,
    registry: expected.registry,
    registryRecordUrl: expected.registryRecordUrl,
    registryDependenciesUrl: expected.registryDependenciesUrl,
    registryDownloadUrl: `${expected.registry}/api/v1/crates/${expected.name}/${expected.version}/download`,
    sourceRepositoryUrl: expected.sourceRepositoryUrl,
    sourceTag: expected.sourceTag,
    sourceTagUrl: `${expected.sourceRepositoryUrl}/releases/tag/${expected.sourceTag}`,
    sourceTagObjectSha: tag.tagObjectSha,
    sourceTagSignatureVerified: tag.tagSignatureVerified,
    sourceCommit: tag.commit,
    sourceCommitUrl: `${expected.sourceRepositoryUrl}/commit/${tag.commit}`,
    sourceArchiveUrl: `${expected.sourceRepositoryUrl}/archive/${tag.commit}.tar.gz`,
    sourceManifestUrl,
    checksumSha256: metadata.checksum,
    spdxLicense: metadata.license,
    dependencies: dependencySummary(dependencyPayload.dependencies),
    publishedBy: {
      cratesIoUserId: metadata.published_by.id,
      login: metadata.published_by.login,
      name: metadata.published_by.name,
      profileUrl: metadata.published_by.url,
    },
    publishedAtUtc: metadata.created_at,
    crateSizeBytes: metadata.crate_size,
    rustVersion: metadata.rust_version,
    yanked: metadata.yanked,
    buildInstallBehavior: {
      hasLibrary: metadata.has_lib === true,
      binaryNames,
      cargoNativeLinks: metadata.lib_links,
      rootBuildScriptPresent,
      manifestDeclaresBuildScript,
      manifestDeclaresNativeLinks,
      summary:
        !rootBuildScriptPresent &&
        !manifestDeclaresBuildScript &&
        !manifestDeclaresNativeLinks &&
        binaryNames.length === 0
          ? 'Library-only crate; no root build.rs, explicit Cargo build script, native links declaration, or installable binary was found at the immutable source commit.'
          : 'The crate declares build/install behavior that requires explicit reviewer investigation.',
    },
  };
}

async function walkManifestFiles(directory = repositoryRoot) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await walkManifestFiles(absolute)));
    if (entry.isFile() && (entry.name === 'Cargo.toml' || entry.name === 'Cargo.lock')) {
      result.push(absolute);
    }
  }
  return result.sort();
}

async function capturePreInstallGuard() {
  const files = await walkManifestFiles();
  const guarded = [];
  for (const absolute of files) {
    const contents = await readFile(absolute, 'utf8');
    const relativePath = path.relative(repositoryRoot, absolute).replaceAll(path.sep, '/');
    if (/\bwindows-service\b/.test(contents)) {
      fail(
        `${relativePath} already contains windows-service; approval preparation must precede mutation`,
      );
    }
    guarded.push({
      path: relativePath,
      sha256: createHash('sha256').update(contents).digest('hex'),
    });
  }
  if (!guarded.some((file) => file.path === 'Cargo.toml')) fail('root Cargo.toml was not found');
  if (!guarded.some((file) => file.path === 'Cargo.lock')) fail('root Cargo.lock was not found');
  return { dependencyAbsent: true, files: guarded };
}

function validateCandidateShape(candidate) {
  assertExactKeys(
    candidate,
    [
      'buildInstallBehavior',
      'checksumSha256',
      'crateSizeBytes',
      'dependencies',
      'name',
      'publishedAtUtc',
      'publishedBy',
      'registry',
      'registryDependenciesUrl',
      'registryDownloadUrl',
      'registryRecordUrl',
      'rustVersion',
      'sourceArchiveUrl',
      'sourceCommit',
      'sourceCommitUrl',
      'sourceManifestUrl',
      'sourceRepositoryUrl',
      'sourceTag',
      'sourceTagObjectSha',
      'sourceTagSignatureVerified',
      'sourceTagUrl',
      'spdxLicense',
      'version',
      'yanked',
    ],
    'candidate',
  );
  if (candidate.name !== expected.name || candidate.version !== expected.version) {
    fail('candidate identity must be exactly windows-service 0.8.1');
  }
  if (
    candidate.registry !== expected.registry ||
    candidate.registryRecordUrl !== expected.registryRecordUrl ||
    candidate.sourceRepositoryUrl !== expected.sourceRepositoryUrl ||
    candidate.sourceTag !== expected.sourceTag
  ) {
    fail('candidate registry or source identity is not the approved official boundary');
  }
  if (!/^[0-9a-f]{40}$/.test(candidate.sourceCommit)) {
    fail('candidate source identity must contain an immutable commit SHA');
  }
  if (
    candidate.sourceCommitUrl !== `${expected.sourceRepositoryUrl}/commit/${candidate.sourceCommit}`
  ) {
    fail('candidate source commit URL does not match its immutable commit');
  }
  if (!/^[0-9a-f]{64}$/.test(candidate.checksumSha256)) {
    fail('candidate checksum must be a crates.io SHA-256 digest');
  }
  assertNonEmptyString(candidate.spdxLicense, 'candidate SPDX license');
  if (!Array.isArray(candidate.dependencies) || candidate.dependencies.length === 0) {
    fail('candidate dependency summary is missing');
  }
  if (candidate.yanked !== false) fail('candidate is yanked');
  if (candidate.buildInstallBehavior?.summary?.trim() === '') {
    fail('candidate build/install behavior is missing');
  }
}

function validateRecordShape(record) {
  assertExactKeys(
    record,
    ['candidate', 'preInstallGuard', 'review', 'schemaVersion', 'status'],
    'record',
  );
  if (record.schemaVersion !== 1) fail('record schemaVersion must be 1');
  if (!['PENDING', 'APPROVED', 'REJECTED'].includes(record.status))
    fail('record status is invalid');
  validateCandidateShape(record.candidate);
  assertExactKeys(record.preInstallGuard, ['dependencyAbsent', 'files'], 'preInstallGuard');
  if (
    record.preInstallGuard.dependencyAbsent !== true ||
    !Array.isArray(record.preInstallGuard.files)
  ) {
    fail('pre-install dependency absence evidence is incomplete');
  }
  for (const file of record.preInstallGuard.files) {
    assertExactKeys(file, ['path', 'sha256'], `preInstallGuard file ${file?.path ?? '[unknown]'}`);
    if (
      path.isAbsolute(file.path) ||
      file.path.includes('..') ||
      !/^[0-9a-f]{64}$/.test(file.sha256)
    ) {
      fail(`invalid pre-install guard entry: ${file.path ?? '[unknown]'}`);
    }
  }
  assertExactKeys(
    record.review,
    ['approvedIdentity', 'reviewedAtUtc', 'reviewerIdentity', 'reviewerResponse', 'verdict'],
    'review',
  );
}

function approvedIdentity(candidate) {
  return {
    name: candidate.name,
    version: candidate.version,
    registryRecordUrl: candidate.registryRecordUrl,
    sourceRepositoryUrl: candidate.sourceRepositoryUrl,
    sourceTag: candidate.sourceTag,
    sourceCommit: candidate.sourceCommit,
    sourceCommitUrl: candidate.sourceCommitUrl,
    checksumSha256: candidate.checksumSha256,
    spdxLicense: candidate.spdxLicense,
  };
}

function renderRecord(record) {
  const candidate = record.candidate;
  const dependencyRows = candidate.dependencies
    .map(
      (dependency) =>
        `| \`${dependency.name}\` | \`${dependency.requirement}\` | ${dependency.kind} | \`${dependency.target ?? 'all'}\` | ${dependency.optional ? 'yes' : 'no'} |`,
    )
    .join('\n');
  const reviewStatus =
    record.status === 'PENDING'
      ? 'Awaiting the non-auto-approvable human legitimacy decision.'
      : `Recorded verdict: \`${record.status}\` by \`${record.review.reviewerIdentity}\` at \`${record.review.reviewedAtUtc}\`.`;
  return `# Phase 6 windows-service Supply-Chain Approval

> Generated before dependency installation by \`tooling/supply-chain/phase6-windows-service-approval.mjs\`. The machine-readable record is authoritative; do not approve a different identity.

## Gate status

${reviewStatus}

- Status: \`${record.status}\`
- Exact crate: \`${candidate.name} ${candidate.version}\`
- Registry record: [crates.io ${candidate.name} ${candidate.version}](${candidate.registryRecordUrl})
- Registry checksum (SHA-256): \`${candidate.checksumSha256}\`
- SPDX license: \`${candidate.spdxLicense}\`
- Source repository: [Mullvad windows-service-rs](${candidate.sourceRepositoryUrl})
- Source tag: [${candidate.sourceTag}](${candidate.sourceTagUrl})
- Immutable source commit: [\`${candidate.sourceCommit}\`](${candidate.sourceCommitUrl})
- Signed tag verified by GitHub: \`${candidate.sourceTagSignatureVerified}\`
- Publisher: \`${candidate.publishedBy.login}\` (${candidate.publishedBy.name}) at \`${candidate.publishedAtUtc}\`

## Dependency summary

| Dependency | Requirement | Kind | Target | Optional |
| --- | --- | --- | --- | --- |
${dependencyRows}

## Build and install behavior

${candidate.buildInstallBehavior.summary}

- Cargo library: \`${candidate.buildInstallBehavior.hasLibrary}\`
- Binary targets: \`${candidate.buildInstallBehavior.binaryNames.join(', ') || 'none'}\`
- Root \`build.rs\`: \`${candidate.buildInstallBehavior.rootBuildScriptPresent}\`
- Explicit package \`build\`: \`${candidate.buildInstallBehavior.manifestDeclaresBuildScript}\`
- Native \`links\`: \`${candidate.buildInstallBehavior.manifestDeclaresNativeLinks}\`

## Reviewer instructions

Open the registry, repository, tag, and immutable commit links above. Compare the exact name, version, checksum, license, source ownership/history, dependency tree, and build/install behavior. Approve only \`windows-service 0.8.1\`; any mismatch is a rejection.

## Machine-readable approval record

${recordStart}
${JSON.stringify(record, null, 2)}
${recordEnd}
`;
}

async function readRecord() {
  let markdown;
  try {
    markdown = await readFile(approvalPath, 'utf8');
  } catch (error) {
    fail(`approval record is missing: ${error.message}`);
  }
  const start = markdown.indexOf(recordStart);
  const end = markdown.indexOf(recordEnd);
  if (start === -1 || end === -1 || end <= start)
    fail('machine-readable approval record markers are missing');
  const json = markdown.slice(start + recordStart.length, end).trim();
  try {
    return JSON.parse(json);
  } catch (error) {
    fail(`machine-readable approval record is invalid JSON: ${error.message}`);
  }
}

async function verifyCurrentCandidate(record) {
  const current = await fetchOfficialCandidate();
  if (!stableCompare(record.candidate, current)) {
    fail('prepared candidate no longer matches the current official registry/source identity');
  }
}

async function verifyGuardHashes(record) {
  const current = await capturePreInstallGuard();
  if (!stableCompare(record.preInstallGuard, current)) {
    fail('Cargo.toml or Cargo.lock changed after the PENDING evidence was prepared');
  }
}

async function prepare() {
  const record = {
    schemaVersion: 1,
    status: 'PENDING',
    candidate: await fetchOfficialCandidate(),
    preInstallGuard: await capturePreInstallGuard(),
    review: {
      reviewerIdentity: null,
      reviewedAtUtc: null,
      reviewerResponse: null,
      verdict: null,
      approvedIdentity: null,
    },
  };
  validateRecordShape(record);
  await writeFile(approvalPath, renderRecord(record), 'utf8');
  console.log(`Prepared PENDING approval evidence for ${expected.name} ${expected.version}.`);
}

async function validatePending() {
  const record = await readRecord();
  validateRecordShape(record);
  if (record.status !== 'PENDING') fail('validate-pending requires exact PENDING status');
  if (Object.values(record.review).some((value) => value !== null)) {
    fail('PENDING record must not contain a reviewer verdict or identity');
  }
  await verifyCurrentCandidate(record);
  await verifyGuardHashes(record);
  if (
    normalizeNewlines(await readFile(approvalPath, 'utf8')) !==
    normalizeNewlines(renderRecord(record))
  ) {
    fail('PENDING Markdown evidence does not deterministically match its machine-readable record');
  }
  console.log(
    `Validated PENDING evidence for ${expected.name} ${expected.version}; Cargo files remain unchanged.`,
  );
}

async function validateApproved() {
  const record = await readRecord();
  validateRecordShape(record);
  if (record.status !== 'APPROVED' || record.review.verdict !== 'APPROVED') {
    fail('exact APPROVED record and verdict are required');
  }
  assertNonEmptyString(record.review.reviewerIdentity, 'reviewer identity');
  assertNonEmptyString(record.review.reviewerResponse, 'verbatim reviewer response');
  if (!record.review.reviewerResponse.includes('APPROVED windows-service 0.8.1')) {
    fail('verbatim reviewer response must explicitly approve windows-service 0.8.1');
  }
  if (
    typeof record.review.reviewedAtUtc !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(record.review.reviewedAtUtc) ||
    Number.isNaN(Date.parse(record.review.reviewedAtUtc))
  ) {
    fail('review timestamp must be a valid UTC timestamp ending in Z');
  }
  const exactApprovedIdentity = approvedIdentity(record.candidate);
  if (!stableCompare(record.review.approvedIdentity, exactApprovedIdentity)) {
    fail(
      'reviewed name/version/source/checksum/license identity does not match the prepared candidate',
    );
  }
  await verifyCurrentCandidate(record);
  await verifyGuardHashes(record);
  console.log(`Validated APPROVED evidence for ${expected.name} ${expected.version}.`);
}

async function main() {
  const mode = process.argv[2];
  if (
    process.argv.length !== 3 ||
    !['prepare', 'validate-pending', 'validate-approved'].includes(mode)
  ) {
    fail(
      'usage: node phase6-windows-service-approval.mjs <prepare|validate-pending|validate-approved>',
    );
  }
  if (mode === 'prepare') return prepare();
  if (mode === 'validate-pending') return validatePending();
  return validateApproved();
}

main().catch((error) => {
  console.error(`windows-service approval validation failed: ${redact(error.message)}`);
  process.exitCode = 1;
});
