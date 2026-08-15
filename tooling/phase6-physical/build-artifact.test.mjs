import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { transactionalRecoveryDocumentValidator } from '../../packages/contracts-ts/src/generated/standalone-validators.js';
import * as artifactBuilder from './build-artifact.mjs';

import {
  CANONICAL_COMMANDS,
  INSTALLED_ROLES,
  PHYSICAL_PRODUCT_CODE,
  PORTABLE_ROLES,
  TRUSTED_INSTALLER_SPKI_SHA256,
  assertDeclaredInputState,
  assertImmutableFile,
  buildCanonicalRunConfigs,
  canonicalBytes,
  physicalPackageVersion,
  patchTauriBundleTypeForMsi,
  selectUnusedOperationVersion,
  validateTauriDriverInstallReceipt,
  validateArtifactManifest,
  validateInstallationManifest,
  validateMsiInspection,
  validatePhysicalProfile,
  validatePortableRootAclSnapshot,
  validateServiceRuntimeDependencies,
  validateWebView2RuntimeEvidence,
  validateWixContract,
  verifyDetachedCmsEvidence,
} from './build-artifact.mjs';

const sha = (character) => `sha256:${character.repeat(64)}`;
const clone = (value) => JSON.parse(JSON.stringify(value));
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

test('portable artifact publication requires exact protected native ACL before rename', () => {
  const userSid = 'S-1-5-21-111111111-222222222-333333333-1001';
  const exact = {
    ownerSid: 'S-1-5-32-544',
    protected: true,
    rules: [
      {
        sid: 'S-1-5-18',
        rights: 2032127,
        accessType: 'Allow',
        inherited: false,
        inheritanceFlags: 3,
        propagationFlags: 0,
      },
      {
        sid: 'S-1-5-32-544',
        rights: 2032127,
        accessType: 'Allow',
        inherited: false,
        inheritanceFlags: 3,
        propagationFlags: 0,
      },
      {
        sid: userSid,
        rights: 1179817,
        accessType: 'Allow',
        inherited: false,
        inheritanceFlags: 3,
        propagationFlags: 0,
      },
    ],
  };
  assert.doesNotThrow(() => validatePortableRootAclSnapshot(exact, userSid));
  for (const mutate of [
    (value) => (value.ownerSid = userSid),
    (value) => (value.protected = false),
    (value) => (value.rules[0].rights = 131241),
    (value) => (value.rules[2].rights = 2032127),
    (value) => (value.rules[2].inherited = true),
    (value) => value.rules.push({ ...value.rules[2], sid: 'S-1-5-11' }),
  ]) {
    const value = clone(exact);
    mutate(value);
    assert.throws(() => validatePortableRootAclSnapshot(value, userSid), /portable root ACL/u);
  }

  const builder = readFileSync('tooling/phase6-physical/build-artifact.mjs', 'utf8');
  const helper = readFileSync('tooling/phase6-physical/protect-artifact-root.ps1', 'utf8');
  assert.ok(
    builder.indexOf('protectPortableArtifactRoot(workRoot)') <
      builder.indexOf('renameSync(workRoot, finalRoot)'),
  );
  assert.doesNotMatch(builder, /chmodSync\(workRoot/u);
  assert.match(helper, /target[\\/]phase6-physical[\\/]_work/u);
  assert.match(helper, /SetSecurityDescriptorSddlForm/u);
  assert.match(helper, /S-1-5-18[\s\S]*S-1-5-32-544/u);
  assert.doesNotMatch(helper, /icacls|takeown|Remove-Item|Start-Process/u);
});

test('tauri-driver provenance requires the exact Cargo 2.0.6 crates.io receipt', () => {
  const exactKey = 'tauri-driver 2.0.6 (registry+https://github.com/rust-lang/crates.io-index)';
  const cargoInstallReceipt = {
    schemaVersion: '1.0',
    packageName: 'tauri-driver',
    packageVersion: '2.0.6',
    versionRequirement: '=2.0.6',
    source: 'registry+https://github.com/rust-lang/crates.io-index',
    binaryName: 'tauri-driver.exe',
  };
  assert.deepEqual(
    validateTauriDriverInstallReceipt({
      installs: {
        [exactKey]: { version_req: '=2.0.6', bins: ['tauri-driver.exe'] },
      },
    }),
    { version: '2.0.6', cargoInstallReceipt },
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
  const identity = {
    role: name,
    relativePath,
    sizeBytes: 10,
    sha256: sha(character),
    version: expected?.versionPolicy === 'not-applicable' ? 'not-applicable' : '1.0',
    versionPolicy: expected?.versionPolicy ?? 'file-version',
    signaturePolicy: expected?.signaturePolicy ?? 'authenticode-required',
  };
  if (name === 'tauri-driver') {
    identity.version = '2.0.6';
    identity.versionPolicy = 'cargo-install-receipt';
    identity.cargoInstallReceipt = {
      schemaVersion: '1.0',
      packageName: 'tauri-driver',
      packageVersion: '2.0.6',
      versionRequirement: '=2.0.6',
      source: 'registry+https://github.com/rust-lang/crates.io-index',
      binaryName: 'tauri-driver.exe',
    };
  }
  return identity;
};
const installedRole = (name, relativePath, character = 'a') => ({
  role: name,
  relativePath,
  sizeBytes: 10,
  sha256: sha(character),
  version: '1.0.0',
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
      webviewInstallMode: { type: 'skip' },
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
    <DirectoryRef Id="TARGETDIR">
      <Directory Id="CommonAppDataFolder">
        <Directory Id="LiiiraaBoostProgramData" Name="Liiiraa Boost">
          <Component Id="PhysicalProgramDataAclComponent" Guid="{E13FCD86-47D1-5ED7-9FB2-72F546A789D4}" Permanent="yes">
            <CreateFolder>
              <PermissionEx Sddl="O:SYD:P(A;OICI;FA;;;SY)(A;OICI;FA;;;BA)(A;OICI;FA;;;S-1-5-80-2609031853-1645808008-1428639046-3057950850-171131564)" />
            </CreateFolder>
          </Component>
        </Directory>
      </Directory>
    </DirectoryRef>
    <DirectoryRef Id="INSTALLDIR">
      <Component Id="PhysicalInstallDirectoryAclComponent" Guid="{3BA41754-6199-4B96-BD9A-613FDBBD270A}">
        <CreateFolder>
          <PermissionEx Sddl="D:P(A;OICI;FA;;;SY)(A;OICI;FA;;;BA)(A;OICI;GRGX;;;BU)(A;OICI;GRGX;;;S-1-5-80-2609031853-1645808008-1428639046-3057950850-171131564)" />
        </CreateFolder>
      </Component>
      <Component Id="InstallationManifestComponent" Guid="*">
        <File Id="InstallationManifestFile" Source="../../../../../apps/desktop/src-tauri/installer/physical-staging/installation-manifest.json" KeyPath="yes">
          <PermissionEx Sddl="D:P(A;;FA;;;SY)(A;;FR;;;S-1-5-80-2609031853-1645808008-1428639046-3057950850-171131564)" />
        </File>
      </Component>
      <Component Id="InstallationManifestSignatureComponent" Guid="*">
        <File Id="InstallationManifestSignatureFile" Source="../../../../../apps/desktop/src-tauri/installer/physical-staging/installation-manifest.json.p7s" KeyPath="yes">
          <PermissionEx Sddl="D:P(A;;FA;;;SY)(A;;FR;;;S-1-5-80-2609031853-1645808008-1428639046-3057950850-171131564)" />
        </File>
      </Component>
      <Component Id="OptimizerServiceComponent" Guid="*">
        <File Id="OptimizerServiceFile" Source="../../../../../apps/desktop/src-tauri/installer/physical-staging/liiiraa-optimizer-service.exe" KeyPath="yes" />
        <ServiceInstall Id="OptimizerServiceInstall" Name="LiiiraaBoostOptimizer" Type="ownProcess" Start="auto" Account="LocalSystem" ErrorControl="normal">
          <ServiceConfig ServiceSid="restricted" OnInstall="yes" OnReinstall="yes" />
        </ServiceInstall>
        <ServiceControl Id="OptimizerServiceControl" Name="LiiiraaBoostOptimizer" Start="install" Stop="both" Remove="uninstall" Wait="yes" />
      </Component>
    </DirectoryRef>
    <ComponentGroup Id="Phase6PhysicalRuntime">
      <ComponentRef Id="PhysicalProgramDataAclComponent" />
      <ComponentRef Id="PhysicalInstallDirectoryAclComponent" />
      <ComponentRef Id="InstallationManifestComponent" />
      <ComponentRef Id="InstallationManifestSignatureComponent" />
      <ComponentRef Id="OptimizerServiceComponent" />
      <ComponentRef Id="phase6_physical_runner" />
    </ComponentGroup>
  </Fragment>
</Wix>`;

const rejectsMutation = (base, mutate, validate, pattern) => {
  const value = clone(base);
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
        delete value.bundle.windows.webviewInstallMode;
      },
      /WebView2.*skip/u,
    ],
    [
      (value) => {
        value.bundle.windows.webviewInstallMode = { type: 'downloadBootstrapper' };
      },
      /WebView2.*skip/u,
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

  const physical = JSON.parse(
    readFileSync('apps/desktop/src-tauri/tauri.phase6-physical.conf.json', 'utf8'),
  );
  assert.deepEqual(physical.bundle.windows.webviewInstallMode, { type: 'skip' });
  for (const path of [
    'apps/desktop/src-tauri/tauri.conf.json',
    'apps/desktop/src-tauri/tauri.staging.conf.json',
  ]) {
    const profile = JSON.parse(readFileSync(path, 'utf8'));
    assert.notDeepEqual(
      profile.bundle?.windows?.webviewInstallMode,
      { type: 'skip' },
      `${path} must retain its distribution WebView2 policy`,
    );
  }
});

const validWebView2RuntimeEvidence = () => ({
  registryHive: 'HKEY_LOCAL_MACHINE',
  registryKey:
    'HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Microsoft\\EdgeUpdate\\Clients\\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}',
  registryVersion: '151.0.4129.78',
  executablePath:
    'C:\\Program Files (x86)\\Microsoft\\EdgeWebView\\Application\\151.0.4129.78\\msedgewebview2.exe',
  fileVersion: '151.0.4129.78',
  productName: 'Microsoft Edge WebView2',
  signatureStatus: 'Valid',
  publisher: 'Microsoft Corporation',
  executableSha256: sha('d'),
});

test('WebView2 preflight accepts only the official runtime registry identity and signed matching runtime binary', () => {
  assert.deepEqual(validateWebView2RuntimeEvidence(validWebView2RuntimeEvidence()), {
    version: '151.0.4129.78',
    executablePath:
      'C:\\Program Files (x86)\\Microsoft\\EdgeWebView\\Application\\151.0.4129.78\\msedgewebview2.exe',
    executableSha256: sha('d'),
  });

  for (const [mutate, pattern] of [
    [(value) => delete value.registryVersion, /version/u],
    [(value) => (value.registryVersion = '0.0.0.0'), /version/u],
    [(value) => (value.fileVersion = '150.0.0.0'), /version/u],
    [
      (value) =>
        (value.registryKey =
          'HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Microsoft\\EdgeUpdate\\Clients\\{NOT-WEBVIEW2}'),
      /registry/u,
    ],
    [
      (value) =>
        (value.executablePath =
          'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\151.0.4129.78\\msedge.exe'),
      /Runtime executable/u,
    ],
    [(value) => (value.productName = 'Microsoft Edge'), /WebView2 product/u],
    [(value) => (value.signatureStatus = 'UnknownError'), /signature/u],
    [(value) => (value.publisher = 'Example Publisher'), /Microsoft publisher/u],
    [(value) => (value.executableSha256 = ''), /SHA-256/u],
  ])
    rejectsMutation(
      validWebView2RuntimeEvidence(),
      mutate,
      validateWebView2RuntimeEvidence,
      pattern,
    );

  const lifecycle = readFileSync('tooling/phase6-physical/lifecycle-smoke.ps1', 'utf8');
  assert.match(lifecycle, /F3017226-FE2A-4295-8BDF-00C3A9A7E4C5/u);
  assert.match(lifecycle, /msedgewebview2\.exe/u);
  assert.match(lifecycle, /Microsoft Edge WebView2/u);
  assert.match(lifecycle, /Microsoft Corporation/u);
  assert.doesNotMatch(lifecycle, /Microsoft\\Edge\\Application|msedge\.exe/u);
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
  assert.throws(() => validateWixContract(nestedComponentGroup), /ComponentGroup.*DirectoryRef/u);
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
  assert.throws(
    () =>
      validateWixContract(
        wix().replace(
          /\s*<Component Id="PhysicalInstallDirectoryAclComponent"[\s\S]*?<\/Component>/u,
          '',
        ),
      ),
    /runtime directory ACL/u,
  );
  assert.throws(
    () =>
      validateWixContract(
        wix().replace(
          'Id="PhysicalInstallDirectoryAclComponent" Guid="{3BA41754-6199-4B96-BD9A-613FDBBD270A}"',
          'Id="PhysicalInstallDirectoryAclComponent" Guid="*"',
        ),
      ),
    /stable component GUID/u,
  );
  assert.throws(
    () =>
      validateWixContract(
        wix().replace(
          'D:P(A;OICI;FA;;;SY)(A;OICI;FA;;;BA)(A;OICI;GRGX;;;BU)(A;OICI;GRGX;;;S-1-5-80-2609031853-1645808008-1428639046-3057950850-171131564)',
          'D:P(A;OICI;FA;;;SY)(A;OICI;FA;;;BA)(A;OICI;GRGX;;;BU)',
        ),
      ),
    /runtime directory ACL/u,
  );
  assert.throws(
    () =>
      validateWixContract(
        wix().replaceAll(
          '../../../../../apps/desktop/src-tauri/installer/physical-staging/',
          'installer/physical-staging/',
        ),
      ),
    /link working directory.*staging/u,
  );
  assert.throws(
    () =>
      validateWixContract(
        wix().replace('Id="phase6_physical_runner"', 'Id="Phase6RunnerComponent"'),
      ),
    /generated runner component/u,
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
  assert.throws(() => {
    const source = wix();
    const manifestComponent = source.match(
      /\s*<Component Id="InstallationManifestComponent"[\s\S]*?<\/Component>/u,
    )[0];
    const signatureComponent = source.match(
      /\s*<Component Id="InstallationManifestSignatureComponent"[\s\S]*?<\/Component>/u,
    )[0];
    validateWixContract(
      source
        .replace(manifestComponent, '')
        .replace(signatureComponent, '')
        .replace('</DirectoryRef>', `${manifestComponent}${signatureComponent}</DirectoryRef>`),
    );
  }, /manifest.*service/u);
});

test('WiX provisions the protected ProgramData root before restricted service startup', () => {
  const source = readFileSync('apps/desktop/src-tauri/installer/optimizer-service.wxs', 'utf8');
  const serviceSid = 'S-1-5-80-2609031853-1645808008-1428639046-3057950850-171131564';
  const storageSddl = `O:SYD:P(A;OICI;FA;;;SY)(A;OICI;FA;;;BA)(A;OICI;FA;;;${serviceSid})`;

  assert.match(
    source,
    /<DirectoryRef\b[^>]*Id="TARGETDIR"[\s\S]*?<Directory\b[^>]*Id="CommonAppDataFolder"/u,
  );
  assert.match(source, /<Directory\b[^>]*Id="LiiiraaBoostProgramData"[^>]*Name="Liiiraa Boost"/u);
  assert.match(
    source,
    /<Component\b[^>]*Id="PhysicalProgramDataAclComponent"[^>]*Guid="\{[0-9A-F-]+\}"[^>]*Permanent="yes"/u,
  );
  assert.ok(source.includes(`Sddl="${storageSddl}"`));
  assert.match(source, /<ComponentRef\b[^>]*Id="PhysicalProgramDataAclComponent"/u);

  const directoryIndex = source.indexOf('Id="PhysicalProgramDataAclComponent"');
  const serviceStartIndex = source.indexOf('<ServiceControl');
  assert.ok(directoryIndex >= 0 && directoryIndex < serviceStartIndex);
});

test('RED: real v53 MSI 1920 fixture binds service startup to the exact service SID', () => {
  const fixturePath = 'tooling/phase6-physical/fixtures/v53-msi-safe-summary.json';
  assert.equal(existsSync(fixturePath), true, 'sanitized v53 MSI fixture must be retained');
  const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
  assert.deepEqual(fixture, {
    kind: 'phase6-v53-sanitized-msi-fixture',
    schemaVersion: '1.0',
    sourceLogSha256: 'sha256:bca766b5884f090ffb35756e64343165c6e22e568dafcdceac12604bb238b073',
    sourceLogSizeBytes: 138200,
    encodingCode: 'utf16le-bom',
    installerExitCode: 1603,
    returnValue3ActionCode: 'install',
    returnValue3ActionIdentifier: 'INSTALL',
    msiErrorCode: 1920,
  });

  const source = readFileSync('apps/optimizer-service/src/windows_pipe.rs', 'utf8');
  const exactSid = 'S-1-5-80-2609031853-1645808008-1428639046-3057950850-171131564';
  assert.match(source, new RegExp(`EXPECTED_SERVICE_SID[\\s\\S]{0,96}${exactSid}`, 'u'));
  assert.match(source, /select_expected_service_sid/u);
  assert.doesNotMatch(source, /find\(\|\(_, sid\)\| sid\.starts_with\("S-1-5-80-"\)\)/u);
});

test('RED: physical service uses static CRT and rejects clean-VM runtime dependencies', () => {
  const dynamic = [
    'Image has the following dependencies:',
    '  kernel32.dll',
    '  VCRUNTIME140.dll',
    '  api-ms-win-crt-runtime-l1-1-0.dll',
  ].join('\r\n');
  assert.throws(() => validateServiceRuntimeDependencies(dynamic), /dynamic CRT/u);
  assert.deepEqual(
    validateServiceRuntimeDependencies(
      ['Image has the following dependencies:', '  kernel32.dll', '  advapi32.dll'].join('\r\n'),
    ),
    ['advapi32.dll', 'kernel32.dll'],
  );

  const source = readFileSync('tooling/phase6-physical/build-artifact.mjs', 'utf8');
  assert.match(source, /STATIC_CRT_RUSTFLAGS\s*=\s*'-C target-feature=\+crt-static'/u);
  assert.match(
    source,
    /liiiraa-optimizer-service[\s\S]{0,512}RUSTFLAGS:\s*STATIC_CRT_RUSTFLAGS/u,
  );
  const dependencyGateIndex = source.lastIndexOf('validateServiceRuntimeDependencies(');
  const signingIndex = source.indexOf('signAuthenticode(signtool, signer.thumbprint, path)');
  assert.ok(dependencyGateIndex >= 0 && dependencyGateIndex < signingIndex);
});

test('RED: installed admission is readable without exposing service-only storage', () => {
  const ipc = readFileSync('apps/optimizer-service/src/ipc.rs', 'utf8');
  const host = readFileSync('apps/optimizer-service/src/windows_pipe.rs', 'utf8');
  const runner = readFileSync('apps/desktop/src-tauri/src/physical_runner.rs', 'utf8');

  assert.match(ipc, /service_storage_directory_sddl[\s\S]{0,256}\(A;;GX;;;IU\)/u);
  assert.match(ipc, /service_admission_sddl[\s\S]{0,256}\(A;;GR;;;IU\)/u);
  assert.match(host, /create_protected_directory\(&root,\s*&directory_security\)/u);
  assert.match(host, /ensure_protected_file\(&database_path,\s*&storage_security\)/u);
  assert.match(host, /record_admission\(&custody,\s*manifest,\s*&admission_security\)/u);
  assert.match(runner, /installed_custody_failure/u);
  for (const code of [
    'installed-custody-acl-invalid',
    'installed-custody-authenticode-invalid',
    'installed-custody-live-byte-mismatch',
    'installed-custody-required-byte-missing',
    'installed-custody-canonical-path-invalid',
    'installed-custody-generated-schema-invalid',
    'installed-custody-signature-invalid',
    'installed-custody-version-invalid',
  ])
    assert.match(runner, new RegExp(code, 'u'));
  assert.doesNotMatch(runner, /installed-custody-\{.*detail/iu);
});

test('physical lifecycle proves the installed desktop owns a read-only broker lease across reconnect', () => {
  const lifecycle = readFileSync('tooling/phase6-physical/lifecycle-smoke.ps1', 'utf8');
  const desktop = readFileSync('apps/desktop/src-tauri/src/main.rs', 'utf8');
  const executor = readFileSync('apps/desktop/src-tauri/src/plan_executor.rs', 'utf8');

  assert.match(lifecycle, /function Assert-BrokerClientBinding/u);
  assert.match(lifecycle, /liiiraa-desktop\.exe/u);
  assert.match(lifecycle, /--phase6-lifecycle-broker-probe/u);
  assert.match(lifecycle, /brokerClientBinding\s*=\s*'passed'/u);
  assert.match(lifecycle, /RedirectStandardError/u);
  assert.match(lifecycle, /broker-probe-.*\.stderr\.log/u);
  assert.equal((lifecycle.match(/Assert-BrokerClientBinding/gu) ?? []).length, 3);
  assert.match(desktop, /--phase6-lifecycle-broker-probe/u);
  assert.match(executor, /probe_installed_broker_observation/u);
  assert.match(executor, /observe-power-scheme-request/u);
});

test('physical lifecycle composes protected manifest custody without administrator read access', () => {
  const lifecycle = readFileSync('tooling/phase6-physical/lifecycle-smoke.ps1', 'utf8');
  const builder = readFileSync('tooling/phase6-physical/build-artifact.mjs', 'utf8');

  assert.match(lifecycle, /function Assert-InstalledManifestAdministratorReadDenied/u);
  assert.match(lifecycle, /\[IO\.File\]::ReadAllBytes\(\$manifestPath\)/u);
  assert.match(lifecycle, /administrator unexpectedly read protected installed manifest/u);
  assert.match(lifecycle, /function Get-ExpectedInstallationManifestCustody/u);
  assert.match(lifecycle, /Join-Path \$OutputRoot 'installation-manifest\.json'/u);
  assert.match(lifecycle, /@\(\$manifest\.files\.PSObject\.Properties\)\.Count -ne 3/u);
  assert.doesNotMatch(lifecycle, /\$manifest\.files\.PSObject\.Properties\.Count -ne 3/u);
  assert.match(lifecycle, /VersionInfo\.FileVersion/u);
  assert.match(lifecycle, /Get-AuthenticodeSignature/u);
  assert.match(lifecycle, /installedManifestAdministratorReadDenied\s*=\s*\$true/u);
  assert.match(lifecycle, /serviceAcceptedProtectedManifest\s*=\s*\$true/u);
  assert.match(
    lifecycle,
    /Invoke-MsiExpectedFailure @\('\/i',[^\n]*'REINSTALL=ALL'[^\n]*'REINSTALLMODE=amus'[^\n]*'MSIRESTARTMANAGERCONTROL=Disable'\) 'rollback-failure'/u,
  );
  assert.equal((lifecycle.match(/MSIRESTARTMANAGERCONTROL=Disable/gu) ?? []).length, 2);
  assert.match(lifecycle, /function Assert-RollbackMsiProperties/u);
  assert.match(lifecycle, /rollback log did not preserve explicit MSI properties/u);
  assert.match(lifecycle, /Assert-RollbackMsiProperties/u);
  assert.match(lifecycle, /\$rollbackCompletionPattern\s*=/u);
  assert.match(lifecycle, /\[regex\]::Matches\(\$log, \$rollbackCompletionPattern\)\.Count -ne 1/u);
  assert.match(lifecycle, /\$unexpectedReturnThree/u);
  assert.match(lifecycle, /\$unexpected1603/u);
  assert.match(lifecycle, /MainEngineThread is returning 1603/u);
  assert.match(lifecycle, /\[DateTime\]::TryParseExact/u);
  assert.doesNotMatch(lifecycle, /\$log -match 'Error in rollback skipped'/u);
  assert.match(lifecycle, /function Invoke-CoordinatedRollbackFailure/u);
  assert.match(lifecycle, /rollback-lock-ready/u);
  assert.match(lifecycle, /Error 1306/u);
  assert.match(lifecycle, /rollback lock-holder did not exit cleanly/u);
  assert.match(lifecycle, /rollback lock release timed out/u);
  assert.match(lifecycle, /\[IO\.FileShare\]::ReadWrite -bor \[IO\.FileShare\]::Delete/u);
  assert.match(lifecycle, /\$offset/u);
  assert.match(lifecycle, /65536/u);
  assert.match(lifecycle, /\[Text\.Encoding\]::Unicode\.GetString/u);
  assert.match(lifecycle, /Substring\(`?\$tail\.Length - 8192\)/u);
  const rollbackHolder = lifecycle.slice(
    lifecycle.indexOf('function Invoke-CoordinatedRollbackFailure'),
    lifecycle.indexOf('function Assert-ServiceRunning'),
  );
  assert.doesNotMatch(rollbackHolder, /ReadAllText/u);
  assert.doesNotMatch(lifecycle, /schtasks|New-Service/u);
  assert.match(
    builder,
    /verifyDetachedCms\(installationPath,[\s\S]*TRUSTED_INSTALLER_SPKI_SHA256\)/u,
  );
  assert.doesNotMatch(lifecycle, /Set-Acl|icacls|SeBackupPrivilege|schtasks/u);
  assert.match(lifecycle, /function Assert-DowngradeRejected/u);
  assert.match(lifecycle, /WIX_DOWNGRADE_DETECTED/u);
  assert.match(lifecycle, /Skipping FindRelatedProducts action: not run in maintenance mode/u);
  assert.match(lifecycle, /downgrade probe entered maintenance mode/u);

  const rollbackVerification = lifecycle.slice(
    lifecycle.indexOf('$rollbackExit = Invoke-CoordinatedRollbackFailure'),
    lifecycle.indexOf('$downgradeExit = Invoke-MsiExpectedFailure'),
  );
  assert.match(
    rollbackVerification,
    /Assert-RollbackMsiProperties[\s\S]*Assert-ServiceRunning[\s\S]*Get-InstalledSetHash \$expectedCustody[\s\S]*Get-RecoveryCustodyHash/u,
  );
  const downgradeVerification = lifecycle.slice(
    lifecycle.indexOf('$downgradeExit = Invoke-MsiExpectedFailure'),
    lifecycle.indexOf("Invoke-Msi @('/x'"),
  );
  assert.match(
    downgradeVerification,
    /Assert-DowngradeRejected[\s\S]*Assert-ServiceRunning[\s\S]*Get-InstalledSetHash \$expectedCustody[\s\S]*Get-RecoveryCustodyHash/u,
  );
});

test(
  'rollback parser accepts only the exact completed MSI failure context',
  { skip: process.platform !== 'win32' },
  () => {
    const root = mkdtempSync(join(tmpdir(), 'liiiraa-rollback-parser-'));
    const lifecyclePath = join(process.cwd(), 'tooling/phase6-physical/lifecycle-smoke.ps1');
    const desktopPath = join(root, 'liiiraa-desktop.exe');
    const logPath = join(root, 'rollback-failure.msiexec.log');
    const quote = (value) => `'${value.replaceAll("'", "''")}'`;
    const exactLog = [
      'MSI (s) (10:20) [00:00:00:000]: Command Line: REINSTALLMODE=amus MSIRESTARTMANAGERCONTROL=Disable',
      `Error 1306. Another application has exclusive access to the file '${desktopPath}'. Please shut down all other applications, then click Retry.`,
      'Action ended 00:00:00: InstallFinalize. Return value 3.',
      'MSI (s) (10:20) [00:00:00:001]: Executing op: End(Checksum=0,ProgressTotalHDWord=0,ProgressTotalLDWord=0)',
      'MSI (s) (10:20) [00:00:00:001]: Error in rollback skipped. Return: 5',
      'Action ended 00:00:00: INSTALL. Return value 3.',
      'MSI (s) (10:20) [00:00:00:002]: MainEngineThread is returning 1603',
      'MSI (c) (30:40) [00:00:00:003]: MainEngineThread is returning 1603',
    ].join('\r\n');

    const runParser = (log, includeReleased = true) => {
      writeFileSync(
        logPath,
        Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(log, 'utf16le')]),
      );
      writeFileSync(join(root, 'rollback-lock-ready'), 'ready');
      if (includeReleased) {
        writeFileSync(join(root, 'rollback-lock-released'), '2026-08-14T11:57:43.5567509Z');
      } else {
        rmSync(join(root, 'rollback-lock-released'), { force: true });
      }
      const script = `
$ErrorActionPreference = 'Stop'
$tokens = $null
$errors = $null
$ast = [Management.Automation.Language.Parser]::ParseFile(${quote(lifecyclePath)}, [ref]$tokens, [ref]$errors)
if ($errors.Count -ne 0) { throw ($errors | Out-String) }
$functionAst = $ast.Find({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Assert-RollbackMsiProperties' }, $true)
Invoke-Expression $functionAst.Extent.Text
$OutputRoot = ${quote(root)}
$installedRoot = ${quote(root)}
Assert-RollbackMsiProperties
`;
      execFileSync('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-EncodedCommand',
        Buffer.from(script, 'utf16le').toString('base64'),
      ]);
    };

    try {
      assert.doesNotThrow(() => runParser(exactLog));
      assert.throws(() => runParser(exactLog.replace('Return: 5', 'Return: 3')));
      assert.throws(() =>
        runParser(
          exactLog.replace('Executing op: End', 'Service failed to start\r\nExecuting op: End'),
        ),
      );
      assert.throws(() =>
        runParser(
          exactLog.replace('Executing op: End', 'Unexpected failure 1603\r\nExecuting op: End'),
        ),
      );
      assert.throws(() =>
        runParser(
          exactLog.replace('InstallFinalize. Return value 3', 'StartServices. Return value 3'),
        ),
      );
      assert.throws(() => runParser(exactLog, false));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
);

test(
  'downgrade parser requires real related-product detection and launch-condition refusal',
  { skip: process.platform !== 'win32' },
  () => {
    const root = mkdtempSync(join(tmpdir(), 'liiiraa-downgrade-parser-'));
    const lifecyclePath = join(process.cwd(), 'tooling/phase6-physical/lifecycle-smoke.ps1');
    const logPath = join(root, 'downgrade-rejection.msiexec.log');
    const quote = (value) => `'${value.replaceAll("'", "''")}'`;
    const probeProduct = '{DDDDDDDD-DDDD-4DDD-8DDD-DDDDDDDDDDDD}';
    const probePackage = '{EEEEEEEE-EEEE-4EEE-8EEE-EEEEEEEEEEEE}';
    const installedProduct = '{AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA}';
    const productIdentityLine = `MSI (s) (10:20) [00:00:00:001]: Product Code from property table after transforms:  '${probeProduct}'`;
    const exactLog = [
      `PROPERTY CHANGE: Adding PackageCode property. Its value is '${probePackage}'.`,
      productIdentityLine,
      'Doing action: FindRelatedProducts',
      `PROPERTY CHANGE: Adding WIX_DOWNGRADE_DETECTED property. Its value is '${installedProduct}'.`,
      'Action ended 00:00:00: FindRelatedProducts. Return value 1.',
      'Action start 00:00:00: LaunchConditions.',
      'Product: Liiiraa Boost -- A newer version of Liiiraa Boost is already installed.',
      'Action ended 00:00:00: LaunchConditions. Return value 3.',
      'Property(S): ProductVersion = 0.0.1',
      'Action ended 00:00:00: INSTALL. Return value 3.',
      'MSI (s) (10:20) [00:00:00:002]: MainEngineThread is returning 1603',
      'MSI (c) (30:40) [00:00:00:003]: MainEngineThread is returning 1603',
    ].join('\r\n');

    const runParser = (log, exitCode = 1603) => {
      writeFileSync(
        logPath,
        Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(log, 'utf16le')]),
      );
      const script = `
$ErrorActionPreference = 'Stop'
$tokens = $null
$errors = $null
$ast = [Management.Automation.Language.Parser]::ParseFile(${quote(lifecyclePath)}, [ref]$tokens, [ref]$errors)
if ($errors.Count -ne 0) { throw ($errors | Out-String) }
$functionAst = $ast.Find({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Assert-DowngradeRejected' }, $true)
Invoke-Expression $functionAst.Extent.Text
$OutputRoot = ${quote(root)}
Assert-DowngradeRejected ${exitCode} ${quote(probeProduct)} ${quote(probePackage)} ${quote(installedProduct)}
`;
      execFileSync('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-EncodedCommand',
        Buffer.from(script, 'utf16le').toString('base64'),
      ]);
    };

    try {
      assert.doesNotThrow(() => runParser(exactLog));
      assert.doesNotThrow(() => runParser(exactLog.replace('MSI (s) (10:20)', 'MSI (c) (A0:BF)')));
      assert.throws(() => runParser(exactLog, 0));
      assert.throws(() => runParser(exactLog.replace(probePackage, installedProduct)));
      assert.throws(() => runParser(exactLog.replace(probeProduct, installedProduct)));
      assert.throws(() =>
        runParser(exactLog.replace('ProductVersion = 0.0.1', 'ProductVersion = 0.1.36')),
      );
      assert.throws(() =>
        runParser(exactLog.replace('WIX_DOWNGRADE_DETECTED', 'UNRELATED_PRODUCT')),
      );
      assert.throws(() =>
        runParser(
          exactLog.replace(
            'Doing action: FindRelatedProducts',
            'Skipping FindRelatedProducts action: not run in maintenance mode',
          ),
        ),
      );
      assert.throws(() =>
        runParser(
          exactLog.replace('LaunchConditions. Return value 3', 'LaunchConditions. Return value 1'),
        ),
      );
      assert.throws(() =>
        runParser(`${exactLog}\r\nProduct registered: entering maintenance mode`),
      );
      assert.throws(() =>
        runParser(
          exactLog.replace(
            productIdentityLine,
            productIdentityLine.replace(/^MSI \(s\) \(10:20\) \[00:00:00:001\]: /u, ''),
          ),
        ),
      );
      assert.throws(() => runParser(`${exactLog}\r\n${productIdentityLine}`));
      assert.throws(() =>
        runParser(exactLog.replace(productIdentityLine, `Error payload: ${productIdentityLine}`)),
      );
      assert.throws(() => runParser(exactLog.replace('MSI (s) (10:20)', 'MSI (x) (10:20)')));
      assert.throws(() =>
        runParser(exactLog.replace('MSI (s) (10:20) [00:00:00:001]:', 'MSI (s) malformed:')),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
);

test('Windows handle-growth proof runs in a dedicated subprocess', () => {
  const source = readFileSync('apps/optimizer-service/tests/physical_user_context.rs', 'utf8');
  assert.match(source, /current_exe\(\)/u);
  assert.match(source, /LIIIRAA_HANDLE_GROWTH_CHILD/u);
  assert.match(source, /--exact/u);
  assert.match(source, /after <= before \+ 2/u);
});

test('final MSI inspection requires exact runtime files and zero CustomAction authority', () => {
  const programDataSddl =
    'O:SYD:P(A;OICI;FA;;;SY)(A;OICI;FA;;;BA)(A;OICI;FA;;;S-1-5-80-2609031853-1645808008-1428639046-3057950850-171131564)';
  const expected = {
    productCode: '{AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA}',
    packageVersion: '0.1.0',
    files: [
      'short.exe|liiiraa-desktop.exe',
      'runner.exe|phase6-physical-runner.exe',
      'manifest.jso|installation-manifest.json',
      'manifest.p7s|installation-manifest.json.p7s',
      'service.exe|liiiraa-optimizer-service.exe',
    ],
    customActionCount: 0,
    customActions: [],
    programDataStorage: {
      component: 'PhysicalProgramDataAclComponent',
      directory: 'LiiiraaBoostProgramData',
      parent: 'CommonAppDataFolder',
      feature: 'External',
      createFolder: true,
      sddl: programDataSddl,
    },
  };
  assert.doesNotThrow(() =>
    validateMsiInspection(expected, {
      productCode: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      packageVersion: '0.1.0',
    }),
  );
  rejectsMutation(
    expected,
    (value) => {
      value.customActionCount = 1;
      value.customActions = [
        { action: 'DownloadAndInvokeBootstrapper', source: 'powershell.exe', target: 'download' },
      ];
    },
    (value) =>
      validateMsiInspection(value, {
        productCode: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        packageVersion: '0.1.0',
      }),
    /zero CustomAction/u,
  );
  rejectsMutation(
    expected,
    (value) => {
      value.files.push('driver.exe|msedgedriver.exe');
    },
    (value) =>
      validateMsiInspection(value, {
        productCode: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        packageVersion: '0.1.0',
      }),
    /exact installed files/u,
  );
  rejectsMutation(
    expected,
    (value) => {
      delete value.programDataStorage;
    },
    (value) =>
      validateMsiInspection(value, {
        productCode: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        packageVersion: '0.1.0',
      }),
    /ProgramData storage/u,
  );
});

test('downgrade probe has a fresh package identity in the same upgrade family', () => {
  assert.equal(typeof artifactBuilder.validateDowngradeProbeIdentity, 'function');
  assert.equal(typeof artifactBuilder.formatMsiGuid, 'function');
  assert.equal(
    artifactBuilder.formatMsiGuid('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'ProductCode'),
    '{DDDDDDDD-DDDD-4DDD-8DDD-DDDDDDDDDDDD}',
  );
  for (const unsafeGuid of [
    '',
    '{DDDDDDDD-DDDD-4DDD-8DDD-DDDDDDDDDDDD}',
    "dddddddd-dddd-4ddd-8ddd-dddddddddddd'; Remove-Item C:\\",
  ]) {
    assert.throws(() => artifactBuilder.formatMsiGuid(unsafeGuid, 'ProductCode'), /exact UUID/u);
  }
  const main = {
    productCode: '{AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA}',
    packageCode: '{BBBBBBBB-BBBB-4BBB-8BBB-BBBBBBBBBBBB}',
    upgradeCode: '{CCCCCCCC-CCCC-4CCC-8CCC-CCCCCCCCCCCC}',
    packageVersion: '0.1.36',
  };
  const probe = {
    productCode: '{DDDDDDDD-DDDD-4DDD-8DDD-DDDDDDDDDDDD}',
    packageCode: '{EEEEEEEE-EEEE-4EEE-8EEE-EEEEEEEEEEEE}',
    upgradeCode: main.upgradeCode,
    packageVersion: '0.0.1',
    upgradeRows: [
      {
        upgradeCode: main.upgradeCode,
        versionMin: '',
        versionMax: '0.0.1',
        language: '',
        attributes: 513,
        remove: '',
        actionProperty: 'WIX_UPGRADE_DETECTED',
      },
      {
        upgradeCode: main.upgradeCode,
        versionMin: '0.0.1',
        versionMax: '',
        language: '',
        attributes: 2,
        remove: '',
        actionProperty: 'WIX_DOWNGRADE_DETECTED',
      },
    ],
  };
  const expectedProbeIdentity = {
    productCode: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    packageCode: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    packageVersion: '0.0.1',
  };
  const validate = artifactBuilder.validateDowngradeProbeIdentity;
  assert.doesNotThrow(() => validate(main, probe, expectedProbeIdentity));
  for (const [property, value, pattern] of [
    ['productCode', main.productCode, /ProductCode/u],
    ['packageCode', main.packageCode, /PackageCode/u],
    ['upgradeCode', '{FFFFFFFF-FFFF-4FFF-8FFF-FFFFFFFFFFFF}', /UpgradeCode/u],
    ['packageVersion', '0.1.36', /0\.0\.1/u],
  ]) {
    assert.throws(
      () => validate(main, { ...probe, [property]: value }, expectedProbeIdentity),
      pattern,
    );
  }
  assert.throws(
    () =>
      validate(main, probe, {
        ...expectedProbeIdentity,
        productCode: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      }),
    /expected ProductCode/u,
  );
  assert.throws(
    () =>
      validate(main, probe, {
        ...expectedProbeIdentity,
        packageCode: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      }),
    /expected PackageCode/u,
  );
  assert.throws(
    () =>
      validate(
        main,
        { ...probe, upgradeRows: [...probe.upgradeRows, probe.upgradeRows[0]] },
        expectedProbeIdentity,
      ),
    /exactly two Upgrade rows/u,
  );
  for (const [index, property, value, pattern] of [
    [0, 'versionMax', '0.1.38', /WIX_UPGRADE_DETECTED.*VersionMax.*0\.0\.1/u],
    [1, 'versionMin', '0.1.38', /WIX_DOWNGRADE_DETECTED.*VersionMin.*0\.0\.1/u],
    [0, 'attributes', 1, /attributes/u],
    [1, 'actionProperty', 'WIX_UPGRADE_DETECTED', /exact Upgrade actions/u],
  ]) {
    const upgradeRows = clone(probe.upgradeRows);
    upgradeRows[index][property] = value;
    assert.throws(() => validate(main, { ...probe, upgradeRows }, expectedProbeIdentity), pattern);
  }

  const source = readFileSync('tooling/phase6-physical/build-artifact.mjs', 'utf8');
  assert.match(source, /SummaryInformation\(1\)/u);
  assert.match(source, /Set-StrictMode -Version Latest/u);
  assert.match(source, /\$msiPackageCode\s*=\s*'\$\{msiPackageCode\}'/u);
  assert.match(source, /\.Property\(9\)\s*=\s*\$msiPackageCode/u);
  assert.match(source, /const downgradeIdentity\s*=\s*\{/u);
  assert.match(source, /setMsiIdentity\(downgradeMsiPath, downgradeIdentity, msiInspection\)/u);
  assert.match(
    source,
    /validateDowngradeProbeIdentity\(msiInspection, downgradeInspection, downgradeIdentity\)/u,
  );
  assert.match(source, /packageCode\s*=\s*\$database\.SummaryInformation\(0\)\.Property\(9\)/u);
  assert.match(source, /upgradeCode\s*=\s*Read-Property 'UpgradeCode'/u);
  assert.ok(
    source.includes(
      'SELECT \\`UpgradeCode\\`,\\`VersionMin\\`,\\`VersionMax\\`,\\`Language\\`,\\`Attributes\\`,\\`Remove\\`,\\`ActionProperty\\` FROM \\`Upgrade\\`',
    ),
  );

  const identityWriter = source.slice(
    source.indexOf('const setMsiIdentity'),
    source.indexOf('const runLifecycleSmoke'),
  );
  const summaryPropertyIndex = identityWriter.indexOf('$summary.Property(9) = $msiPackageCode');
  const persistIndex = identityWriter.indexOf('$summary.Persist()');
  const finalCommitIndex = identityWriter.indexOf('$database.Commit()');
  assert.ok(summaryPropertyIndex >= 0);
  assert.ok(summaryPropertyIndex < persistIndex);
  assert.ok(persistIndex < finalCommitIndex, 'SummaryInformation must persist before final commit');
  assert.doesNotMatch(identityWriter, /UPDATE \\`Upgrade\\` SET/u);
  assert.match(identityWriter, /DELETE FROM \\`Upgrade\\` WHERE/u);
  assert.match(identityWriter, /INSERT INTO \\`Upgrade\\`/u);
  assert.match(identityWriter, /CreateRecord\(7\)/u);
  assert.match(source, /original Upgrade rows must be exact/u);

  const probeFlow = source.slice(
    source.indexOf("const downgradeMsiPath = join(workRoot, 'downgrade-probe.msi')"),
    source.indexOf('const lifecycle = runLifecycleSmoke'),
  );
  assert.match(source, /setMsiIdentity\(downgradeMsiPath, downgradeIdentity, msiInspection\)/u);
  const mutateIndex = probeFlow.indexOf('setMsiIdentity(downgradeMsiPath');
  const reopenIndex = probeFlow.indexOf('inspectMsi(downgradeMsiPath)');
  const validateIndex = probeFlow.indexOf(
    'validateDowngradeProbeIdentity(msiInspection, downgradeInspection, downgradeIdentity)',
  );
  const signIndex = probeFlow.indexOf(
    'signAuthenticode(signtool, signer.thumbprint, downgradeMsiPath)',
  );
  assert.ok(mutateIndex >= 0 && mutateIndex < reopenIndex);
  assert.ok(reopenIndex < validateIndex);
  assert.ok(validateIndex < signIndex, 'final reopened MSI identity must pass before signing');
});

test('real bundle removes and rejects stale generated MSI output', () => {
  const source = readFileSync('tooling/phase6-physical/build-artifact.mjs', 'utf8');
  const clearIndex = source.indexOf('removeStaleBuiltMsis();');
  const bundleIndex = source.indexOf("'bundle'", clearIndex);
  const freshIndex = source.indexOf('findBuiltMsi(msiBuildStartedAt)', bundleIndex);
  assert.ok(clearIndex >= 0 && clearIndex < bundleIndex);
  assert.ok(bundleIndex >= 0 && bundleIndex < freshIndex);
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

test('each reserved operation version advances the MSI package version monotonically', () => {
  assert.equal(physicalPackageVersion('managed-power-scheme-v21'), '0.1.21');
  assert.equal(physicalPackageVersion('managed-power-scheme-v22'), '0.1.22');
  assert.equal(physicalPackageVersion('managed-power-scheme-v65535'), '0.1.65535');
  assert.throws(() => physicalPackageVersion('managed-power-scheme-v0'), /operation version/u);
  assert.throws(() => physicalPackageVersion('managed-power-scheme-v65536'), /MSI range/u);

  const source = readFileSync('tooling/phase6-physical/build-artifact.mjs', 'utf8');
  assert.match(source, /const packageVersion = physicalPackageVersion\(operationVersionId\)/u);
  assert.match(source, /LIIIRAA_PHYSICAL_PACKAGE_VERSION: packageVersion/u);
  assert.match(source, /effectivePhysicalProfile/u);
  assert.match(source, /JSON\.stringify\(effectivePhysicalProfile\)/u);
});

test('physical updates preserve the product identity already admitted by installed custody', () => {
  assert.equal(PHYSICAL_PRODUCT_CODE, '72696290-c079-44db-9fdd-6e7cc11aa2c2');
  const source = readFileSync('tooling/phase6-physical/build-artifact.mjs', 'utf8');
  assert.match(source, /const productCode = PHYSICAL_PRODUCT_CODE/u);
  assert.equal(
    (source.match(/productCode: randomUUID\(\)/gu) ?? []).length,
    1,
    'only the lower-version downgrade probe may use a distinct ProductCode',
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
      value.files.service.version = 'unversioned';
    },
    validateInstallationManifest,
    /version/u,
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

test('desktop bundle type is patched to MSI before signing and manifest custody', () => {
  const directory = mkdtempSync(join(tmpdir(), 'liiiraa-bundle-type-'));
  const executable = join(directory, 'liiiraa-desktop.exe');
  try {
    writeFileSync(executable, Buffer.from('prefix__TAURI_BUNDLE_TYPE_VAR_UNK\0suffix', 'ascii'));
    assert.equal(patchTauriBundleTypeForMsi(executable), true);
    assert.equal(
      readFileSync(executable).toString('ascii'),
      'prefix__TAURI_BUNDLE_TYPE_VAR_MSI\0suffix',
    );
    assert.equal(patchTauriBundleTypeForMsi(executable), false, 'MSI patch must be idempotent');

    writeFileSync(
      executable,
      Buffer.from('__TAURI_BUNDLE_TYPE_VAR_UNK__TAURI_BUNDLE_TYPE_VAR_UNK'),
    );
    assert.throws(() => patchTauriBundleTypeForMsi(executable), /exactly one/u);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }

  const source = readFileSync('tooling/phase6-physical/build-artifact.mjs', 'utf8');
  const patchCall = source.indexOf('patchTauriBundleTypeForMsi(built.desktop)');
  const signingLoop = source.indexOf('for (const [key, path] of Object.entries(built))');
  const manifestIdentity = source.indexOf('installedRoleIdentity(role, path, built[key]');
  assert.ok(patchCall >= 0, 'builder must patch the final MSI bundle marker');
  assert.ok(patchCall < signingLoop, 'bundle patch must happen before Authenticode signing');
  assert.ok(signingLoop < manifestIdentity, 'signing must happen before manifest identity capture');
});

test('detached CMS input matches the Rust compact canonical JSON representation', () => {
  assert.deepEqual(
    canonicalBytes({ z: 1, a: { y: 2, x: 3 } }),
    Buffer.from('{"a":{"x":3,"y":2},"z":1}', 'utf8'),
  );
});

test('optimizer service embeds the physical package version in Windows VERSIONINFO', () => {
  const buildScript = readFileSync('apps/optimizer-service/build.rs', 'utf8');
  assert.match(buildScript, /LIIIRAA_PHYSICAL_PACKAGE_VERSION/u);
  assert.match(buildScript, /VERSIONINFO/u);
  assert.match(buildScript, /rustc-link-arg-bin=liiiraa-optimizer-service/u);
});

test('MSI ProductVersion inspection is fixed to the typed read-only persistence sentinel', () => {
  const source = readFileSync('apps/optimizer-service/src/installation_manifest.rs', 'utf8');
  assert.match(source, /MsiOpenDatabaseW\([\s\S]*MSIDBOPEN_READONLY/u);
  assert.doesNotMatch(source, /let\s+read_only\s*=\s*\[0_u16\]/u);
  assert.doesNotMatch(
    source,
    /MSIDBOPEN_(?:DIRECT|TRANSACT|CREATE|CREATEDIRECT|PATCHFILE)/u,
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
  for (const mutate of [
    (value) => delete value.files.tauriDriver.cargoInstallReceipt,
    (value) => {
      value.files.tauriDriver.cargoInstallReceipt.packageVersion = '2.0.5';
    },
    (value) => {
      value.files.tauriDriver.version = '2.0.5';
    },
    (value) => {
      value.files.msedgeDriver.versionPolicy = 'cargo-install-receipt';
    },
  ]) {
    assert.throws(() => {
      const value = artifactManifest();
      mutate(value);
      validateArtifactManifest(value);
    }, /policy|receipt|version/u);
  }
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
