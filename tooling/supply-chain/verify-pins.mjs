import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const allowlistPath = path.join(repositoryRoot, 'architecture', 'dependency-allowlist.json');
const allowedEcosystems = new Set(['cargo', 'npm', 'toolchain']);
const allowedDispositions = new Set(['OK', 'REVIEW_REQUIRED']);
const lifecycleNames = [
  'install',
  'postinstall',
  'postpack',
  'postpublish',
  'preinstall',
  'prepack',
  'prepare',
  'prepublish',
  'prepublishOnly',
  'publish',
];
const trustedToolchains = {
  node: {
    registry: 'https://nodejs.org/dist/index.json',
    repository: 'https://github.com/nodejs/node',
    license: 'MIT',
  },
  rust: {
    registry: 'https://static.rust-lang.org/dist',
    repository: 'https://github.com/rust-lang/rust',
    license: 'Apache-2.0 OR MIT',
  },
};

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function entryKey(entry) {
  return `${entry.ecosystem}:${entry.name}@${entry.version}`;
}

function redact(value) {
  return String(value)
    .replace(/([?&](?:access_?token|auth|key|password|token)=)[^&\s]+/gi, '$1[REDACTED]')
    .replace(/(https?:\/\/)[^/@\s]+@/gi, '$1[REDACTED]@')
    .replace(/\b(?:npm_[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9_]{20,})\b/g, '[REDACTED]');
}

function fail(message) {
  throw new Error(redact(message));
}

function normalizeRepository(value) {
  const raw =
    typeof value === 'string' ? value : value && typeof value.url === 'string' ? value.url : '';
  const trimmed = raw.trim();
  const githubShorthand = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?$/.test(trimmed)
    ? `https://github.com/${trimmed}`
    : trimmed;
  const httpsRepository = githubShorthand
    .trim()
    .replace(/^git\+/, '')
    .replace(/^git@github\.com:/i, 'https://github.com/')
    .replace(/^ssh:\/\/git@github\.com\//i, 'https://github.com/')
    .replace(/^git:\/\/github\.com\//i, 'https://github.com/');

  try {
    const parsed = new URL(httpsRepository);
    parsed.username = '';
    parsed.password = '';
    parsed.search = '';
    parsed.hash = '';
    return `${parsed.protocol}//${parsed.host.toLowerCase()}${parsed.pathname}`
      .replace(/\.git$/i, '')
      .replace(/\/+$/, '')
      .toLowerCase();
  } catch {
    return httpsRepository
      .replace(/\.git$/i, '')
      .replace(/\/+$/, '')
      .toLowerCase();
  }
}

function validateAllowlist(allowlist) {
  if (allowlist.schemaVersion !== 1) {
    fail('dependency allowlist schemaVersion must be 1');
  }
  if (
    typeof allowlist.reviewReport !== 'string' ||
    path.isAbsolute(allowlist.reviewReport) ||
    allowlist.reviewReport.includes('..')
  ) {
    fail('reviewReport must be a repository-relative path');
  }
  if (!Array.isArray(allowlist.entries) || allowlist.entries.length === 0) {
    fail('dependency allowlist must contain entries');
  }

  const seen = new Set();
  const actualOrder = allowlist.entries.map(entryKey);
  const expectedOrder = [...actualOrder].sort(compareText);
  if (JSON.stringify(actualOrder) !== JSON.stringify(expectedOrder)) {
    fail('dependency allowlist entries must be sorted by ecosystem, name, and version');
  }

  for (const entry of allowlist.entries) {
    const requiredStrings = [
      'name',
      'version',
      'ecosystem',
      'registry',
      'repository',
      'license',
      'purpose',
      'disposition',
      'reviewReason',
    ];
    for (const field of requiredStrings) {
      if (typeof entry[field] !== 'string') {
        fail(`${entryKey(entry)} has a non-string ${field}`);
      }
    }
    if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(entry.version)) {
      fail(`${entryKey(entry)} does not use an exact semantic version`);
    }
    if (!allowedEcosystems.has(entry.ecosystem)) {
      fail(`${entryKey(entry)} uses unsupported ecosystem ${entry.ecosystem}`);
    }
    if (!allowedDispositions.has(entry.disposition)) {
      fail(`${entryKey(entry)} has invalid disposition ${entry.disposition}`);
    }
    if (entry.disposition === 'REVIEW_REQUIRED' && entry.reviewReason.trim() === '') {
      fail(`${entryKey(entry)} requires a review reason`);
    }
    if (
      !entry.allowedLifecycleScripts ||
      Array.isArray(entry.allowedLifecycleScripts) ||
      typeof entry.allowedLifecycleScripts !== 'object'
    ) {
      fail(`${entryKey(entry)} must declare allowedLifecycleScripts as an object`);
    }
    for (const [name, command] of Object.entries(entry.allowedLifecycleScripts)) {
      if (!lifecycleNames.includes(name) || typeof command !== 'string' || command === '') {
        fail(`${entryKey(entry)} has an invalid lifecycle script allowlist entry: ${name}`);
      }
    }
    const key = entryKey(entry);
    if (seen.has(key)) {
      fail(`duplicate dependency allowlist entry: ${key}`);
    }
    seen.add(key);
  }
}

function validatePhaseTwoMetadata(allowlist) {
  const allowedVerdicts = new Set(['OK', 'SUS: too-new']);
  const phaseTwoEntries = allowlist.entries.filter((entry) => entry.scope === 'phase-02');

  if (phaseTwoEntries.length === 0) {
    fail('dependency allowlist must contain Phase 2 entries');
  }

  for (const entry of allowlist.entries) {
    if (entry.scope !== undefined && entry.scope !== 'phase-02') {
      fail(`${entryKey(entry)} has unsupported scope ${entry.scope}`);
    }
    if (entry.scope !== 'phase-02') {
      if (entry.verdict !== undefined) {
        fail(`${entryKey(entry)} declares a verdict without a Phase 2 scope`);
      }
      continue;
    }
    if (!allowedVerdicts.has(entry.verdict)) {
      fail(`${entryKey(entry)} has unsupported Phase 2 verdict ${entry.verdict}`);
    }
    const expectedDisposition = entry.verdict === 'OK' ? 'OK' : 'REVIEW_REQUIRED';
    if (entry.disposition !== expectedDisposition) {
      fail(
        `${entryKey(entry)} verdict ${entry.verdict} requires disposition ${expectedDisposition}`,
      );
    }
  }

  const expectedExcluded = new Map([
    [
      'npm:@tauri-apps/plugin-single-instance',
      {
        verdict: 'SLOP',
        reason:
          'The npm identity does not exist; use the verified tauri-plugin-single-instance Rust crate.',
      },
    ],
    [
      'npm:msw',
      {
        verdict: 'SLOP by required seam',
        reason:
          'Excluded by the Phase 2 legitimacy seam; use the existing deterministic desktop adapter port.',
      },
    ],
  ]);
  if (!Array.isArray(allowlist.excluded) || allowlist.excluded.length !== expectedExcluded.size) {
    fail('dependency allowlist must record exactly the two Phase 2 SLOP exclusions');
  }

  const excludedKeys = allowlist.excluded.map((entry) => `${entry.ecosystem}:${entry.name}`);
  if (JSON.stringify(excludedKeys) !== JSON.stringify([...excludedKeys].sort(compareText))) {
    fail('excluded dependency identities must be sorted by ecosystem and name');
  }

  for (const excluded of allowlist.excluded) {
    const key = `${excluded.ecosystem}:${excluded.name}`;
    const expected = expectedExcluded.get(key);
    if (!expected || excluded.verdict !== expected.verdict || excluded.reason !== expected.reason) {
      fail(`unexpected excluded dependency record: ${key}`);
    }
    if (
      allowlist.entries.some(
        (entry) => entry.ecosystem === excluded.ecosystem && entry.name === excluded.name,
      )
    ) {
      fail(`${key} is excluded and cannot appear in dependency entries`);
    }
  }
}

async function fetchText(url) {
  let response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: 'application/json, text/plain;q=0.9, */*;q=0.1',
        'User-Agent': 'liiiraa-boost-dependency-review/1.0',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    fail(`unable to fetch ${url}: ${error.message}`);
  }
  if (!response.ok) {
    fail(`registry request ${url} returned HTTP ${response.status}`);
  }
  return response.text();
}

async function fetchJson(url) {
  const text = await fetchText(url);
  try {
    return JSON.parse(text);
  } catch (error) {
    fail(`registry response ${url} was not JSON: ${error.message}`);
  }
}

function collectLifecycleScripts(metadata) {
  const scripts = metadata && typeof metadata.scripts === 'object' ? metadata.scripts : {};
  return Object.fromEntries(
    lifecycleNames
      .filter((name) => typeof scripts[name] === 'string')
      .map((name) => [name, scripts[name]]),
  );
}

function assertEvidence(entry, evidence) {
  if (normalizeRepository(evidence.repository) !== normalizeRepository(entry.repository)) {
    fail(
      `${entryKey(entry)} repository mismatch: expected ${entry.repository}, received ${evidence.repository}`,
    );
  }
  if (evidence.license !== entry.license) {
    fail(
      `${entryKey(entry)} license mismatch: expected ${entry.license}, received ${evidence.license}`,
    );
  }
  const expectedScripts = JSON.stringify(entry.allowedLifecycleScripts);
  const actualScripts = JSON.stringify(evidence.lifecycleScripts);
  if (expectedScripts !== actualScripts) {
    fail(
      `${entryKey(entry)} lifecycle scripts mismatch: expected ${expectedScripts}, received ${actualScripts}`,
    );
  }
}

async function verifyNpm(entry) {
  if (entry.registry !== 'https://registry.npmjs.org') {
    fail(`${entryKey(entry)} must use the canonical npm registry`);
  }
  const evidenceUrl = `${entry.registry}/${encodeURIComponent(entry.name)}/${entry.version}`;
  const metadata = await fetchJson(evidenceUrl);
  if (metadata.name !== entry.name || metadata.version !== entry.version) {
    fail(`${entryKey(entry)} registry identity or exact version was not found`);
  }
  const evidence = {
    evidenceUrl,
    repository: metadata.repository,
    license: metadata.license,
    lifecycleScripts: collectLifecycleScripts(metadata),
  };
  assertEvidence(entry, evidence);
  return evidence;
}

async function verifyCargo(entry) {
  if (entry.registry !== 'https://crates.io') {
    fail(`${entryKey(entry)} must use the canonical crates.io registry`);
  }
  const evidenceUrl = `${entry.registry}/api/v1/crates/${encodeURIComponent(entry.name)}/${entry.version}`;
  const payload = await fetchJson(evidenceUrl);
  const metadata = payload.version;
  if (!metadata || metadata.crate !== entry.name || metadata.num !== entry.version) {
    fail(`${entryKey(entry)} registry identity or exact version was not found`);
  }
  const evidence = {
    evidenceUrl,
    repository: metadata.repository,
    license: metadata.license,
    lifecycleScripts: {},
  };
  assertEvidence(entry, evidence);
  return evidence;
}

async function verifyToolchain(entry) {
  const trusted = trustedToolchains[entry.name];
  if (!trusted) {
    fail(`${entryKey(entry)} is not an allowlisted toolchain provider`);
  }
  if (
    entry.registry !== trusted.registry ||
    normalizeRepository(entry.repository) !== normalizeRepository(trusted.repository) ||
    entry.license !== trusted.license
  ) {
    fail(`${entryKey(entry)} does not match its canonical toolchain source`);
  }

  if (entry.name === 'node') {
    const releases = await fetchJson(entry.registry);
    if (!releases.some((release) => release.version === `v${entry.version}`)) {
      fail(`${entryKey(entry)} exact release was not found in the Node.js release index`);
    }
    return {
      evidenceUrl: entry.registry,
      repository: trusted.repository,
      license: trusted.license,
      lifecycleScripts: {},
    };
  }

  const evidenceUrl = `${entry.registry}/channel-rust-${entry.version}.toml`;
  const manifest = await fetchText(evidenceUrl);
  if (!new RegExp(`version = "${entry.version.replaceAll('.', '\\.')} `).test(manifest)) {
    fail(`${entryKey(entry)} exact release was not found in the Rust channel manifest`);
  }
  return {
    evidenceUrl,
    repository: trusted.repository,
    license: trusted.license,
    lifecycleScripts: {},
  };
}

async function verifyEntry(entry) {
  if (entry.ecosystem === 'npm') {
    return verifyNpm(entry);
  }
  if (entry.ecosystem === 'cargo') {
    return verifyCargo(entry);
  }
  return verifyToolchain(entry);
}

function escapeCell(value) {
  return String(value).replaceAll('|', '\\|').replaceAll('\r', ' ').replaceAll('\n', ' ');
}

function markdownLink(label, url) {
  return `[${escapeCell(label)}](${redact(url)})`;
}

function lifecycleSummary(scripts) {
  const names = Object.keys(scripts);
  return names.length === 0
    ? 'None'
    : names.map((name) => `\`${name}\`: \`${scripts[name].replaceAll('`', '\\`')}\``).join('<br>');
}

function dependencyTable(rows) {
  const lines = [
    '| Identity | Ecosystem | Registry evidence | Official repository | License | Lifecycle scripts | Review rationale |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const { entry, evidence } of rows) {
    lines.push(
      `| \`${escapeCell(entry.name)}@${escapeCell(entry.version)}\` | ${escapeCell(entry.ecosystem)} | ${markdownLink('verified exact version', evidence.evidenceUrl)} | ${markdownLink(entry.repository, entry.repository)} | \`${escapeCell(entry.license)}\` | ${lifecycleSummary(entry.allowedLifecycleScripts)} | ${escapeCell(entry.reviewReason || 'Registry and repository evidence matched the researched pin.')} |`,
    );
  }
  return lines.join('\n');
}

function renderReport(verified) {
  const reviewRequired = verified.filter(({ entry }) => entry.disposition === 'REVIEW_REQUIRED');
  const approved = verified.filter(({ entry }) => entry.disposition === 'OK');
  const lifecycleFindings = verified.filter(
    ({ entry }) => Object.keys(entry.allowedLifecycleScripts).length > 0,
  );
  const represented = verified.map(({ entry }) => entryKey(entry));

  return `# Phase 1 Dependency Evidence Review

> Generated by \`tooling/supply-chain/verify-pins.mjs\` from the versioned allowlist. Do not edit this report by hand.

## Review gate

No dependency package has been installed. The verifier fetched public registry endpoints without registry credentials, confirmed every exact identity and version, compared canonical repositories and license expectations, and rejected lifecycle-script drift.

The ${reviewRequired.length} entries under **Review required before installation** need explicit human approval because the research legitimacy audit classified their recent official releases as \`SUS: too-new\`. That classification is a review trigger, not evidence of a malicious package.

## Review required before installation

${dependencyTable(reviewRequired)}

## Registry-verified pins without an additional recency review

${dependencyTable(approved)}

## Lifecycle-script findings

${dependencyTable(lifecycleFindings)}

Only \`preinstall\`, \`install\`, and \`postinstall\` execute during a normal registry package installation. None of the reviewed npm packages declares those consumer-install hooks. The packaging and publication hooks shown above are still exact-allowlisted so metadata drift fails verification.

## Scope boundary

This evidence set contains only the Phase 1 toolchains, contract generation and validation packages, test tools, architecture enforcement, formatting, and Rust dependencies named by \`01-RESEARCH.md\`. It intentionally excludes cloud, UI, Windows mutation, database, authentication, and optimizer dependencies.

## Reproduce the evidence

\`\`\`powershell
rtk node tooling/supply-chain/verify-pins.mjs --check
\`\`\`

The command performs read-only public metadata requests and never executes package lifecycle scripts.

<!-- represented-dependencies
${represented.map((key) => `${key}`).join('\n')}
-->
`;
}

function phaseTwoDependencyTable(rows) {
  const lines = [
    '| Identity | Ecosystem | Verdict | Registry evidence | Official repository | License | Lifecycle scripts | Review rationale |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const { entry, evidence } of rows) {
    lines.push(
      `| \`${escapeCell(entry.name)}@${escapeCell(entry.version)}\` | ${escapeCell(entry.ecosystem)} | \`${escapeCell(entry.verdict)}\` | ${markdownLink('verified exact version', evidence.evidenceUrl)} | ${markdownLink(entry.repository, entry.repository)} | \`${escapeCell(entry.license)}\` | ${lifecycleSummary(entry.allowedLifecycleScripts)} | ${escapeCell(entry.reviewReason || 'Registry and repository evidence matched the Phase 2 researched pin.')} |`,
    );
  }
  return lines.join('\n');
}

function renderCombinedReport(verified, excluded) {
  const phaseOne = verified.filter(({ entry }) => entry.scope !== 'phase-02');
  const phaseTwo = verified.filter(({ entry }) => entry.scope === 'phase-02');
  const phaseTwoReviewRequired = phaseTwo.filter(
    ({ entry }) => entry.disposition === 'REVIEW_REQUIRED',
  );
  const phaseTwoApproved = phaseTwo.filter(({ entry }) => entry.disposition === 'OK');
  const phaseTwoLifecycleFindings = phaseTwo.filter(
    ({ entry }) => Object.keys(entry.allowedLifecycleScripts).length > 0,
  );
  const represented = phaseTwo.map(({ entry }) => entryKey(entry));
  const excludedRows = excluded
    .map((entry) => {
      const registryUrl = `https://registry.npmjs.org/${encodeURIComponent(entry.name)}`;
      return `| \`${escapeCell(entry.name)}\` | ${escapeCell(entry.ecosystem)} | \`${escapeCell(entry.verdict)}\` | ${markdownLink('registry identity', registryUrl)} | ${escapeCell(entry.reason)} |`;
    })
    .join('\n');

  return `${renderReport(phaseOne).trimEnd()}

# Phase 2 Dependency Evidence Review

> Generated by \`tooling/supply-chain/verify-pins.mjs\` from the versioned allowlist. Do not edit this report by hand.

## Phase 2 review gate

No Phase 2 dependency package has been installed. The verifier fetched public npm and crates.io metadata without registry credentials, confirmed all ${phaseTwo.length} exact identities and versions, compared canonical repositories and license expectations, and rejected lifecycle-script drift.

The ${phaseTwoReviewRequired.length} rows under **Phase 2 review required before installation** carry the research verdict \`SUS: too-new\`. This is a blocking human-review classification for recent official releases, not evidence that the packages are malicious.

## Phase 2 review required before installation

${phaseTwoDependencyTable(phaseTwoReviewRequired)}

## Phase 2 registry-verified OK pins

${phaseTwoDependencyTable(phaseTwoApproved)}

## Phase 2 lifecycle-script findings

${phaseTwoDependencyTable(phaseTwoLifecycleFindings)}

Only \`preinstall\`, \`install\`, and \`postinstall\` execute during a normal registry package installation. None of the approved Phase 2 npm packages declares those consumer-install hooks. Packaging and publication hooks remain exact-allowlisted so metadata drift fails verification.

## Phase 2 excluded identities

| Identity | Ecosystem | Verdict | Registry evidence | Exclusion rationale |
| --- | --- | --- | --- | --- |
${excludedRows}

Both excluded identities remain outside the installation allowlist. The Rust crate \`tauri-plugin-single-instance@2.4.3\` replaces the nonexistent npm identity, and the existing deterministic desktop adapter port replaces \`msw\` for this phase.

## Phase 2 scope boundary

This evidence set covers only the desktop visual foundation identities named by \`02-RESEARCH.md\`. It does not authorize cloud, database, authentication, optimizer, arbitrary script, or privileged mutation dependencies.

<!-- represented-phase-02-dependencies
${represented.join('\n')}
-->
`;
}

async function main() {
  const allowlist = JSON.parse(await readFile(allowlistPath, 'utf8'));
  validateAllowlist(allowlist);
  validatePhaseTwoMetadata(allowlist);

  const verified = [];
  for (const entry of allowlist.entries) {
    const evidence = await verifyEntry(entry);
    verified.push({ entry, evidence });
  }

  const report = renderCombinedReport(verified, allowlist.excluded);
  const reportPath = path.join(repositoryRoot, allowlist.reviewReport);
  const checkOnly = process.argv.slice(2).includes('--check');
  const unknownArguments = process.argv.slice(2).filter((argument) => argument !== '--check');
  if (unknownArguments.length > 0) {
    fail(`unknown arguments: ${unknownArguments.join(', ')}`);
  }

  if (checkOnly) {
    let current;
    try {
      current = await readFile(reportPath, 'utf8');
    } catch (error) {
      fail(`review report is missing: ${error.message}`);
    }
    if (current.replaceAll('\r\n', '\n') !== report.replaceAll('\r\n', '\n')) {
      fail(
        'dependency review report is stale; run `rtk node tooling/supply-chain/verify-pins.mjs` and review the diff',
      );
    }
  } else {
    await writeFile(reportPath, report, 'utf8');
  }

  console.log(
    `Verified ${verified.length} exact dependency pins, including ${verified.filter(({ entry }) => entry.scope === 'phase-02').length} Phase 2 pins; ${verified.filter(({ entry }) => entry.disposition === 'REVIEW_REQUIRED').length} require explicit review.`,
  );
}

main().catch((error) => {
  console.error(`Dependency pin verification failed: ${redact(error.message)}`);
  process.exitCode = 1;
});
