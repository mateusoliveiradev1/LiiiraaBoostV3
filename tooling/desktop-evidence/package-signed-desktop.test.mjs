import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import {
  validateArtifactEvidence,
  validateDevelopmentSigningPolicy,
} from './package-signed-desktop.mjs';

const workspaceRoot = resolve(import.meta.dirname, '../..');
const workflowPath = resolve(
  workspaceRoot,
  'tooling/desktop-evidence/package-signed-desktop.mjs',
);
const hashA = 'A'.repeat(64);
const hashB = 'B'.repeat(64);
const thumbprint = 'C'.repeat(40);

const clone = (value) => JSON.parse(JSON.stringify(value));

const runCli = (...arguments_) =>
  spawnSync(process.execPath, [workflowPath, ...arguments_], {
    cwd: workspaceRoot,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  });

const signedArtifact = ({
  kind,
  sourcePath,
  stagedPath,
  sha256,
  sizeBytes,
}) => ({
  kind,
  sourcePath,
  stagedPath,
  sizeBytes,
  sha256,
  stagedSha256: sha256,
  signature: {
    status: 'Valid',
    signerThumbprint: thumbprint,
    digestAlgorithm: 'SHA-256',
    chainClass: 'self-signed-untrusted-root',
    timestamp: {
      state: 'not-applicable',
    },
  },
});

const localDevelopmentEvidence = () => ({
  schemaVersion: '1.0',
  evidenceKind: 'desktop-signed-artifact',
  artifactClass: 'self-signed-development',
  generatedAt: '2026-07-28T00:00:00.000Z',
  build: {
    productName: 'Liiiraa Boost',
    version: '0.0.0',
    identifier: 'com.liiiraa.boost',
    target: 'x86_64-pc-windows-msvc',
    elevatedUi: false,
  },
  signing: {
    trustClass: 'self-signed-development',
    certificateStore: 'Cert:\\CurrentUser\\My',
    certificateThumbprint: thumbprint,
    extendedKeyUsage: '1.3.6.1.5.5.7.3.3',
    digestAlgorithm: 'SHA-256',
    keyProvider: 'Microsoft Software Key Storage Provider',
    keyCustody: {
      scope: 'current-user',
      technology: 'CNG',
      exportable: false,
      ciPrivateKeyAccess: false,
    },
    timestamp: {
      state: 'not-applicable',
    },
    publicTrust: false,
    smartScreenReputation: false,
    productionReady: false,
    distributionAllowed: false,
    productionSigningDeferredTo: 'Phase 10',
  },
  artifacts: [
    signedArtifact({
      kind: 'installer',
      sourcePath: 'target/release/bundle/nsis/Liiiraa Boost_0.0.0_x64-setup.exe',
      stagedPath:
        'quality/evidence/phase-02/staged/Liiiraa Boost_0.0.0_x64-setup.exe',
      sha256: hashA,
      sizeBytes: 10_000,
    }),
    signedArtifact({
      kind: 'executable',
      sourcePath: 'target/release/liiiraa-desktop.exe',
      stagedPath: 'quality/evidence/phase-02/staged/liiiraa-desktop.exe',
      sha256: hashB,
      sizeBytes: 20_000,
    }),
  ],
  staging: {
    allowed: true,
    published: false,
    promoted: false,
    releaseReady: false,
  },
});

const unsignedCiEvidence = () => ({
  schemaVersion: '1.0',
  evidenceKind: 'desktop-unsigned-ci-build',
  artifactClass: 'unsigned-ci',
  generatedAt: '2026-07-28T00:00:00.000Z',
  ci: {
    privateKeyAccess: false,
    signed: false,
    stagingAllowed: false,
    publishingAllowed: false,
    promotionAllowed: false,
    releaseReady: false,
    productionReady: false,
    distributionAllowed: false,
  },
  artifacts: [
    {
      kind: 'installer',
      path: 'target/release/bundle/nsis/Liiiraa Boost_0.0.0_x64-setup.exe',
      signatureStatus: 'NotSigned',
      sha256: hashA,
      sizeBytes: 10_000,
    },
    {
      kind: 'executable',
      path: 'target/release/liiiraa-desktop.exe',
      signatureStatus: 'NotSigned',
      sha256: hashB,
      sizeBytes: 20_000,
    },
  ],
  labels: ['development-only', 'unsigned', 'non-promotable'],
});

test('dry-run resolves pinned Tauri outputs without building, signing, or writing evidence', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'liiiraa-signing-dry-run-'));
  t.after(() => rmSync(directory, { force: true, recursive: true }));
  const output = join(directory, 'must-not-exist.json');
  const startedAt = Date.now();
  const result = runCli('--dry-run', '--output', output);

  assert.equal(result.status, 0, result.stderr);
  assert.ok(Date.now() - startedAt < 120_000);
  assert.equal(existsSync(output), false);

  const report = JSON.parse(result.stdout);
  assert.equal(report.mode, 'dry-run');
  assert.equal(report.sideEffects, false);
  assert.equal(report.cost, 'zero');
  assert.equal(report.policy.trustClass, 'self-signed-development');
  assert.equal(report.policy.certificateStore, 'Cert:\\CurrentUser\\My');
  assert.equal(report.policy.extendedKeyUsage, '1.3.6.1.5.5.7.3.3');
  assert.equal(report.policy.digestAlgorithm, 'SHA-256');
  assert.equal(report.policy.keyExportable, false);
  assert.equal(report.policy.timestampState, 'not-applicable');
  assert.equal(report.policy.publicTrust, false);
  assert.equal(report.policy.smartScreenReputation, false);
  assert.equal(report.policy.productionReady, false);
  assert.equal(report.policy.distributionAllowed, false);
  assert.deepEqual(
    report.expectedArtifacts.map(({ kind }) => kind),
    ['installer', 'executable'],
  );
  assert.match(report.expectedArtifacts[0].path, /bundle[\\/]nsis.+setup\.exe$/u);
  assert.match(report.expectedArtifacts[1].path, /liiiraa-desktop\.exe$/u);
});

test('development signing policy rejects paid, exported, elevated, CI-key, and non-Windows assumptions', async (t) => {
  const policy = {
    platform: 'win32',
    trustClass: 'self-signed-development',
    certificateStore: 'Cert:\\CurrentUser\\My',
    keyProvider: 'Microsoft Software Key Storage Provider',
    extendedKeyUsage: '1.3.6.1.5.5.7.3.3',
    digestAlgorithm: 'SHA-256',
    keyExportable: false,
    ciPrivateKeyAccess: false,
    timestampState: 'not-applicable',
    paidProvider: false,
    pfxWorkflow: false,
    elevatedUi: false,
    publicTrust: false,
    smartScreenReputation: false,
    productionReady: false,
    distributionAllowed: false,
  };

  validateDevelopmentSigningPolicy(policy);

  const mutations = [
    ['paid provider', 'paidProvider', true, /paid signing provider/u],
    ['PFX workflow', 'pfxWorkflow', true, /PFX or exported-key workflow/u],
    ['exportable key', 'keyExportable', true, /non-exportable/u],
    ['CI key access', 'ciPrivateKeyAccess', true, /CI private-key access/u],
    ['elevated UI', 'elevatedUi', true, /non-elevated/u],
    ['public trust', 'publicTrust', true, /publicTrust must be false/u],
    [
      'SmartScreen reputation',
      'smartScreenReputation',
      true,
      /smartScreenReputation must be false/u,
    ],
    ['production readiness', 'productionReady', true, /productionReady must be false/u],
    [
      'distribution permission',
      'distributionAllowed',
      true,
      /distributionAllowed must be false/u,
    ],
    ['fabricated timestamp', 'timestampState', 'present', /timestamp state/u],
    ['non-Windows signing', 'platform', 'linux', /Windows-only/u],
  ];

  for (const [name, field, value, diagnostic] of mutations) {
    await t.test(name, () => {
      const fixture = { ...policy, [field]: value };
      assert.throws(() => validateDevelopmentSigningPolicy(fixture), diagnostic);
    });
  }
});

test('local development evidence rejects trust, secret, timestamp, path, and hash mutations', async (t) => {
  validateArtifactEvidence(localDevelopmentEvidence());

  const mutations = [
    [
      'missing trust classification',
      (fixture) => delete fixture.signing.trustClass,
      /trustClass must be self-signed-development/u,
    ],
    [
      'secret material',
      (fixture) => {
        fixture.signing.privateKey = 'forbidden';
      },
      /secret-shaped field is forbidden: privateKey/u,
    ],
    [
      'PFX material',
      (fixture) => {
        fixture.pfx = 'forbidden';
      },
      /secret-shaped field is forbidden: pfx/u,
    ],
    [
      'fabricated timestamp',
      (fixture) => {
        fixture.signing.timestamp = { state: 'present', authority: 'invented' };
      },
      /timestamp state must be not-applicable/u,
    ],
    [
      'public trust claim',
      (fixture) => {
        fixture.signing.publicTrust = true;
      },
      /publicTrust must be false/u,
    ],
    [
      'SmartScreen claim',
      (fixture) => {
        fixture.signing.smartScreenReputation = true;
      },
      /smartScreenReputation must be false/u,
    ],
    [
      'production claim',
      (fixture) => {
        fixture.signing.productionReady = true;
      },
      /productionReady must be false/u,
    ],
    [
      'distribution claim',
      (fixture) => {
        fixture.signing.distributionAllowed = true;
      },
      /distributionAllowed must be false/u,
    ],
    [
      'duplicate staged path',
      (fixture) => {
        fixture.artifacts[1].stagedPath = fixture.artifacts[0].stagedPath;
      },
      /artifact paths must be unique/u,
    ],
    [
      'staged hash drift',
      (fixture) => {
        fixture.artifacts[1].stagedSha256 = hashA;
      },
      /staged hash must match signed source hash/u,
    ],
    [
      'wrong signer identity',
      (fixture) => {
        fixture.artifacts[1].signature.signerThumbprint = 'D'.repeat(40);
      },
      /signer thumbprint must match certificate thumbprint/u,
    ],
  ];

  for (const [name, mutate, diagnostic] of mutations) {
    await t.test(name, () => {
      const fixture = localDevelopmentEvidence();
      mutate(fixture);
      assert.throws(() => validateArtifactEvidence(fixture), diagnostic);
    });
  }
});

test('unsigned CI evidence is a separate non-promotable class', async (t) => {
  validateArtifactEvidence(unsignedCiEvidence());

  const mutations = [
    ['private-key access', 'privateKeyAccess', true, /privateKeyAccess must be false/u],
    ['signed output', 'signed', true, /signed must be false/u],
    ['staging', 'stagingAllowed', true, /stagingAllowed must be false/u],
    ['publishing', 'publishingAllowed', true, /publishingAllowed must be false/u],
    ['promotion', 'promotionAllowed', true, /promotionAllowed must be false/u],
    ['release-ready label', 'releaseReady', true, /releaseReady must be false/u],
    ['production label', 'productionReady', true, /productionReady must be false/u],
    [
      'distribution label',
      'distributionAllowed',
      true,
      /distributionAllowed must be false/u,
    ],
  ];

  for (const [name, field, value, diagnostic] of mutations) {
    await t.test(name, () => {
      const fixture = unsignedCiEvidence();
      fixture.ci[field] = value;
      assert.throws(() => validateArtifactEvidence(fixture), diagnostic);
    });
  }

  const promotedLabel = unsignedCiEvidence();
  promotedLabel.labels = ['development-only', 'release-ready'];
  assert.throws(
    () => validateArtifactEvidence(promotedLabel),
    /unsigned CI labels must be exactly development-only, unsigned, non-promotable/u,
  );
});

test('CLI modes are exclusive and CI mode refuses a promotable output location', () => {
  const mixed = runCli('--dry-run', '--ci-unsigned');
  assert.notEqual(mixed.status, 0);
  assert.match(mixed.stderr, /exactly one mode/u);

  const promoted = runCli(
    '--ci-unsigned',
    '--output',
    'quality/evidence/phase-02/artifacts/signed-desktop-package.json',
  );
  assert.notEqual(promoted.status, 0);
  assert.match(promoted.stderr, /unsigned CI record must use unsigned-ci-build\.json/u);
});
