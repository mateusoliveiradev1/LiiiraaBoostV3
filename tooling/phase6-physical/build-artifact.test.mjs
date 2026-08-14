import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { transactionalRecoveryDocumentValidator } from '../../packages/contracts-ts/src/generated/standalone-validators.js';

import {
  CANONICAL_COMMANDS,
  INSTALLED_ROLES,
  PORTABLE_ROLES,
  TRUSTED_INSTALLER_SPKI_SHA256,
  assertDeclaredInputState,
  assertImmutableFile,
  buildCanonicalRunConfigs,
  selectUnusedOperationVersion,
  validateTauriDriverInstallReceipt,
  validateArtifactManifest,
  validateInstallationManifest,
  validatePhysicalProfile,
  validateWixContract,
  verifyDetachedCmsEvidence,
} from './build-artifact.mjs';

const sha = (character) => `sha256:${character.repeat(64)}`;
const ROTATED_DEVELOPMENT_SPKI_SHA256 =
  'sha256:1951cb0610550369bdffafffaec6ed48bb7c5e7ddbf9b99733cfbd288e86fdf2';

test('development signing trust is pinned atomically to the rotated CNG identity', () => {
  assert.equal(TRUSTED_INSTALLER_SPKI_SHA256, ROTATED_DEVELOPMENT_SPKI_SHA256);

  for (const path of [
    'apps/optimizer-service/src/installation_manifest.rs',
    'tooling/phase6-evidence/src/physical-writer.ts',
  ]) {
    const source = readFileSync(path, 'utf8');
    assert.match(source, new RegExp(ROTATED_DEVELOPMENT_SPKI_SHA256, 'u'));
  }
});

test('tauri-driver provenance requires the exact Cargo 2.0.6 crates.io receipt', () => {
  const exactKey = 'tauri-driver 2.0.6 (registry+https://github.com/rust-lang/crates.io-index)';
  assert.deepEqual(
    validateTauriDriverInstallReceipt({
      installs: {
        [exactKey]: { version_req: '=2.0.6', bins: ['tauri-driver.exe'] },
      },
    }),
    { version: '2.0.6', source: 'registry+https://github.com/rust-lang/crates.io-index' },
  );
  assert.throws(
    () =>
      validateTauriDriverInstallReceipt({
        installs: {
          'tauri-driver 2.0.5 (registry+https://github.com/rust-lang/crates.io-index)': {
            version_req: '=2.0.5',
            bins: ['tauri-driver.exe'],
          },
        },
      }),
    /exact 2\.0\.6/u,
  );
});

test('physical signing and lifecycle scripts remain compatible with Windows PowerShell 5.1', () => {
  const builder = readFileSync('tooling/phase6-physical/build-artifact.mjs', 'utf8');
  for (const path of [
    'tooling/phase6-physical/build-artifact.mjs',
    'tooling/phase6-physical/lifecycle-smoke.ps1',
  ]) {
    assert.doesNotMatch(readFileSync(path, 'utf8'), /\[Convert\]::ToHexString/u);
  }
  assert.match(
    builder,
    /Add-Type -AssemblyName System\.Security[\s\S]*SignedCms[\s\S]*Add-Type -AssemblyName System\.Security[\s\S]*SignedCms/u,
  );
});

const role = (name, relativePath, character = 'a') => {
  const expected = PORTABLE_ROLES.find(
    (candidate) => candidate.role === name && candidate.path === relativePath,
  );
  return {
    role: name,
    relativePath,
    sizeBytes: 10,
    sha256: sha(character),
    version: expected?.versionPolicy === 'not-applicable' ? 'not-applicable' : '1.0',
    versionPolicy: expected?.versionPolicy ?? 'file-version',
    signaturePolicy: expected?.signaturePolicy ?? 'authenticode-required',
  };
};
const installedRole = (name, relativePath, character = 'a') => ({
  role: name,
  relativePath,
  sizeBytes: 10,
  sha256: sha(character),
  version: '1.0',
  authenticodePublisher: 'Liiiraa Boost Local Development',
  authenticodeThumbprint: sha('c'),
});

const installationManifest = () => ({
  kind: 'installation-manifest',
  schemaVersion: '1.0',
  manifestId: 'installation-manifest-test',
  productCode: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  packageVersion: '0.1.0',
  sourceCommit: 'a'.repeat(40),
  inputTreeHash: sha('b'),
  buildId: 'physical-build-test',
  operationVersionId: 'managed-power-scheme-v3',
  createdAt: '2026-08-14T00:00:00Z',
  signerSpkiSha256: TRUSTED_INSTALLER_SPKI_SHA256,
  files: {
    desktop: installedRole('desktop', 'liiiraa-desktop.exe'),
    service: installedRole('service', 'liiiraa-optimizer-service.exe'),
    runner: installedRole('runner', 'phase6-physical-runner.exe'),
  },
});

const artifactManifest = () => ({
  kind: 'artifact-manifest',
  schemaVersion: '1.0',
  manifestId: 'artifact-manifest-test',
  sourceCommit: 'a'.repeat(40),
  inputTreeHash: sha('b'),
  buildId: 'physical-build-test',
  operationVersionId: 'managed-power-scheme-v3',
  createdAt: '2026-08-14T00:01:00Z',
  files: Object.fromEntries(
    PORTABLE_ROLES.map(({ key, role: name, path }, index) => [
      key,
      role(name, path, String((index + 1) % 10)),
    ]),
  ),
});

const physicalProfile = () => ({
  productName: 'Liiiraa Boost',
  version: '0.1.0',
  identifier: 'com.liiiraa.boost.phase6',
  build: { beforeBuildCommand: 'pnpm build', frontendDist: '../dist' },
  bundle: {
    active: true,
    targets: ['msi'],
    createUpdaterArtifacts: false,
    windows: {
      allowDowngrades: false,
      wix: {
        fragmentPaths: ['./installer/optimizer-service.wxs'],
        componentGroupRefs: ['Phase6PhysicalRuntime'],
      },
    },
  },
  plugins: { updater: { endpoints: [], pubkey: '', windows: null } },
});

const wix = () => `<?xml version="1.0"?>
<Wix xmlns="http://schemas.microsoft.com/wix/2006/wi">
  <Fragment>
    <DirectoryRef Id="INSTALLDIR">
      <Component Id="InstallationManifestComponent" Guid="*">
        <File Id="InstallationManifestFile" Source="installation-manifest.json" KeyPath="yes">
          <PermissionEx Sddl="D:P(A;;FA;;;SY)(A;;FR;;;S-1-5-80-2609031853-1645808008-1428639046-3057950850-171131564)" />
        </File>
      </Component>
      <Component Id="OptimizerServiceComponent" Guid="*">
        <File Id="OptimizerServiceFile" Source="liiiraa-optimizer-service.exe" KeyPath="yes" />
        <ServiceInstall Id="OptimizerServiceInstall" Name="LiiiraaBoostOptimizer" Type="ownProcess" Start="auto" Account="LocalSystem" ErrorControl="normal">
          <ServiceConfig ServiceSid="restricted" OnInstall="yes" OnReinstall="yes" />
        </ServiceInstall>
        <ServiceControl Id="OptimizerServiceControl" Name="LiiiraaBoostOptimizer" Start="install" Stop="both" Remove="uninstall" Wait="yes" />
      </Component>
    </DirectoryRef>
    <ComponentGroup Id="Phase6PhysicalRuntime">
      <ComponentRef Id="InstallationManifestComponent" />
      <ComponentRef Id="OptimizerServiceComponent" />
    </ComponentGroup>
  </Fragment>
</Wix>`;

const rejectsMutation = (base, mutate, validate, pattern) => {
  const value = structuredClone(base);
  mutate(value);
  assert.throws(() => validate(value), pattern);
};

test('physical Tauri profile is MSI-only, non-elevated, downgrade-safe, updater-free, and feature-bound', () => {
  assert.doesNotThrow(() => validatePhysicalProfile(physicalProfile()));
  for (const [mutate, pattern] of [
    [
      (value) => {
        value.bundle.targets = ['nsis'];
      },
      /MSI-only/u,
    ],
    [
      (value) => {
        value.bundle.createUpdaterArtifacts = true;
      },
      /updater/u,
    ],
    [
      (value) => {
        value.bundle.windows.allowDowngrades = true;
      },
      /downgrade/u,
    ],
    [
      (value) => {
        value.bundle.windows.wix.fragmentPaths = [];
      },
      /fragment/u,
    ],
    [
      (value) => {
        value.plugins.updater.endpoints = ['https://example.invalid'];
      },
      /updater/u,
    ],
    [
      (value) => {
        value.bundle.windows.wix.template = 'custom.wxs';
      },
      /template/u,
    ],
    [
      (value) => {
        value.app = { windows: [{ label: 'main', title: 'x', requireAdministrator: true }] };
      },
      /elevated/u,
    ],
  ])
    rejectsMutation(physicalProfile(), mutate, validatePhysicalProfile, pattern);
});

test('WiX uses installer tables for coherent service custody and contains no driver, shell, reboot, or recovery deletion authority', () => {
  assert.doesNotThrow(() => validateWixContract(wix()));
  const validWix = wix();
  const nestedComponentGroup = validWix
    .replace('    </DirectoryRef>\n    <ComponentGroup', '    <ComponentGroup')
    .replace(
      '    </ComponentGroup>\n  </Fragment>',
      '    </ComponentGroup>\n    </DirectoryRef>\n  </Fragment>',
    );
  assert.throws(
    () => validateWixContract(nestedComponentGroup),
    /ComponentGroup.*DirectoryRef/u,
  );
  assert.throws(
    () =>
      validateWixContract(
        wix().replace(
          'Sddl="D:P(A;;FA;;;SY)(A;;FR;;;S-1-5-80-2609031853-1645808008-1428639046-3057950850-171131564)"',
          'User="SYSTEM" GenericAll="yes"',
        ),
      ),
    /SDDL/u,
  );
  for (const [target, replacement, pattern] of [
    ['Account="LocalSystem"', 'Account="LocalService"', /LocalSystem/u],
    ['Type="ownProcess"', 'Type="shareProcess"', /ownProcess/u],
    ['ServiceSid="restricted"', 'ServiceSid="unrestricted"', /restricted/u],
    ['Start="auto"', 'Start="demand"', /auto/u],
    ['Start="install"', 'Start="uninstall"', /start on install/u],
  ])
    assert.throws(() => validateWixContract(wix().replace(target, replacement)), pattern);
  for (const [addition, pattern] of [
    ['<CustomAction Id="Shell" ExeCommand="powershell.exe" />', /custom action/u],
    ['<File Source="tauri-driver.exe" />', /portable driver/u],
    ['<File Source="msedgedriver.exe" />', /portable driver/u],
    [
      '<RemoveFolder Id="DeleteRecovery" Directory="PROGRAMDATARECOVERY" On="uninstall" />',
      /recovery custody/u,
    ],
    ['<ScheduleReboot />', /forced reboot/u],
  ])
    assert.throws(
      () => validateWixContract(wix().replace('</Fragment>', `${addition}</Fragment>`)),
      pattern,
    );
  assert.throws(
    () =>
      validateWixContract(
        wix()
          .replace('installation-manifest.json', 'delayed-marker.bin')
          .replace(
            '</DirectoryRef>',
            '<Component Id="LateManifest" Guid="*"><File Source="installation-manifest.json" /></Component></DirectoryRef>',
          ),
      ),
    /manifest.*service/u,
  );
});

test('declared input dirt and reused operation identities are rejected', () => {
  assert.doesNotThrow(() =>
    assertDeclaredInputState({
      porcelain: '',
      declaredPaths: ['apps/desktop/src-tauri/Cargo.toml'],
    }),
  );
  assert.throws(
    () =>
      assertDeclaredInputState({
        porcelain: ' M apps/desktop/src-tauri/Cargo.toml',
        declaredPaths: ['apps/desktop/src-tauri/Cargo.toml'],
      }),
    /dirty declared input/u,
  );
  assert.equal(
    selectUnusedOperationVersion({
      minimumVersion: 'managed-power-scheme-v3',
      usedVersions: ['managed-power-scheme-v1', 'managed-power-scheme-v2'],
    }),
    'managed-power-scheme-v3',
  );
  assert.throws(
    () =>
      selectUnusedOperationVersion({
        minimumVersion: 'managed-power-scheme-v3',
        usedVersions: ['managed-power-scheme-v3'],
      }),
    /already used/u,
  );
});

test('installation manifest contains exactly desktop, service, and runner roles', () => {
  assert.deepEqual(
    INSTALLED_ROLES.map(({ role: name }) => name),
    ['desktop', 'service', 'runner'],
  );
  assert.doesNotThrow(() => validateInstallationManifest(installationManifest()));
  assert.equal(
    transactionalRecoveryDocumentValidator(installationManifest()),
    true,
    JSON.stringify(transactionalRecoveryDocumentValidator.errors),
  );
  rejectsMutation(
    installationManifest(),
    (value) => {
      value.files.tauriDriver = role('tauri-driver', 'tauri-driver.exe');
    },
    validateInstallationManifest,
    /installed roles/u,
  );
  rejectsMutation(
    installationManifest(),
    (value) => {
      delete value.files.runner;
    },
    validateInstallationManifest,
    /installed roles/u,
  );
  rejectsMutation(
    installationManifest(),
    (value) => {
      value.signerSpkiSha256 = sha('f');
    },
    validateInstallationManifest,
    /SPKI/u,
  );
  rejectsMutation(
    installationManifest(),
    (value) => {
      value.files.desktop.relativePath = 'drivers/tauri-driver.exe';
    },
    validateInstallationManifest,
    /canonical installed path/u,
  );
});

test('builder alone emits the three closed canonical run configs', () => {
  const configs = buildCanonicalRunConfigs({
    artifactManifestSha256: sha('a'),
    operationVersionId: 'managed-power-scheme-v3',
    buildId: 'physical-build-test',
    sourceCommit: 'a'.repeat(40),
  });
  assert.deepEqual(Object.keys(configs), ['clean-windows-vm', 'owner-pc', 'friends-pc']);
  for (const config of Object.values(configs)) {
    assert.equal(
      transactionalRecoveryDocumentValidator(config),
      true,
      JSON.stringify(transactionalRecoveryDocumentValidator.errors),
    );
  }
  assert.deepEqual(configs['clean-windows-vm'].tauriCommands, CANONICAL_COMMANDS);
  for (const config of Object.values(configs)) {
    assert.equal(
      'artifactManifestSha256' in config,
      false,
      'manifest authenticates config bytes; config must not hash its own root',
    );
  }
  assert.equal(configs['friends-pc'].friendsRosterPath, 'friends/friends-roster.json');
  assert.equal(configs['friends-pc'].friendsRosterSignaturePath, 'friends/friends-roster.json.p7s');
  assert.equal('friendsRosterSha256' in configs['friends-pc'], false);
  assert.equal('participantId' in configs['friends-pc'], false);
  assert.equal('outputRoot' in configs['friends-pc'], false);
  assert.throws(
    () =>
      buildCanonicalRunConfigs({
        artifactManifestSha256: sha('a'),
        operationVersionId: 'managed-power-scheme-v2',
        buildId: 'x',
        sourceCommit: 'a'.repeat(40),
      }),
    /minimum.*v3/u,
  );
});

test('artifact manifest requires every portable role and authenticates CMS content, SPKI, hashes, and signatures', () => {
  assert.doesNotThrow(() => validateArtifactManifest(artifactManifest()));
  assert.equal(
    transactionalRecoveryDocumentValidator(artifactManifest()),
    true,
    JSON.stringify(transactionalRecoveryDocumentValidator.errors),
  );
  for (const key of [
    'msi',
    'installationManifest',
    'installationManifestSignature',
    'cleanWindowsVmConfig',
    'ownerPcConfig',
    'friendsPcConfig',
    'runner',
    'tauriDriver',
    'msedgeDriver',
  ]) {
    rejectsMutation(
      artifactManifest(),
      (value) => {
        delete value.files[key];
      },
      validateArtifactManifest,
      /portable roles/u,
    );
  }
  rejectsMutation(
    artifactManifest(),
    (value) => {
      value.files.tauriDriver.relativePath = 'Program Files/tauri-driver.exe';
    },
    validateArtifactManifest,
    /canonical portable path/u,
  );
  rejectsMutation(
    artifactManifest(),
    (value) => {
      value.files.runner.sha256 = sha('f');
      value.files.runner.sizeBytes = 0;
    },
    validateArtifactManifest,
    /size/u,
  );
  assert.doesNotThrow(() =>
    verifyDetachedCmsEvidence({
      contentMatched: true,
      signatureValid: true,
      signerSpkiSha256: TRUSTED_INSTALLER_SPKI_SHA256,
      liveHashesMatched: true,
      authenticodeValid: true,
    }),
  );
  for (const field of [
    'contentMatched',
    'signatureValid',
    'liveHashesMatched',
    'authenticodeValid',
  ]) {
    const evidence = {
      contentMatched: true,
      signatureValid: true,
      signerSpkiSha256: TRUSTED_INSTALLER_SPKI_SHA256,
      liveHashesMatched: true,
      authenticodeValid: true,
    };
    evidence[field] = false;
    assert.throws(() => verifyDetachedCmsEvidence(evidence), /custody/u);
  }
  assert.throws(
    () =>
      verifyDetachedCmsEvidence({
        contentMatched: true,
        signatureValid: true,
        signerSpkiSha256: sha('f'),
        liveHashesMatched: true,
        authenticodeValid: true,
      }),
    /SPKI/u,
  );
});

test('existing artifact identity can only be reverified byte-identically', () => {
  const directory = mkdtempSync(join(tmpdir(), 'liiiraa-phase6-builder-'));
  try {
    const path = join(directory, 'artifact-manifest.json');
    writeFileSync(path, 'canonical-bytes');
    assert.equal(assertImmutableFile(path, Buffer.from('canonical-bytes')), 'verified-identical');
    assert.throws(
      () => assertImmutableFile(path, Buffer.from('replacement')),
      /immutable identity/u,
    );
    assert.equal(readFileSync(path, 'utf8'), 'canonical-bytes');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
