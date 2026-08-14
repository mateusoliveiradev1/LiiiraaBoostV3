#!/usr/bin/env node

import { X509Certificate, createHash, randomUUID } from 'node:crypto';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Key-link witnesses: phase6-physical
// 'phase6-physical-runner tauri-driver msedgedriver'
// 'clean-windows-vm.run-config.json owner-pc.run-config.json friends-pc.run-config.json artifact-manifest.json.p7s'

export const TRUSTED_INSTALLER_SPKI_SHA256 =
  'sha256:1951cb0610550369bdffafffaec6ed48bb7c5e7ddbf9b99733cfbd288e86fdf2';
export const PHYSICAL_PRODUCT_CODE = '72696290-c079-44db-9fdd-6e7cc11aa2c2';
const INSTALLATION_MANIFEST_SDDL =
  'D:P(A;;FA;;;SY)(A;;FR;;;S-1-5-80-2609031853-1645808008-1428639046-3057950850-171131564)';
const INSTALLATION_DIRECTORY_SDDL =
  'D:P(A;OICI;FA;;;SY)(A;OICI;FA;;;BA)(A;OICI;GRGX;;;BU)(A;OICI;GRGX;;;S-1-5-80-2609031853-1645808008-1428639046-3057950850-171131564)';
const INSTALLATION_DIRECTORY_COMPONENT_GUID = '{3BA41754-6199-4B96-BD9A-613FDBBD270A}';
const PROGRAM_DATA_STORAGE_SDDL =
  'O:SYD:P(A;OICI;FA;;;SY)(A;OICI;FA;;;BA)(A;OICI;FA;;;S-1-5-80-2609031853-1645808008-1428639046-3057950850-171131564)';
const PROGRAM_DATA_COMPONENT_GUID = '{E13FCD86-47D1-5ED7-9FB2-72F546A789D4}';

export const CANONICAL_COMMANDS = Object.freeze({
  composePlan: 'compose_plan',
  revisePlan: 'revise_plan',
  approvePlan: 'approve_plan',
  applyPlan: 'apply_plan',
  restorePlanOperation: 'restore_plan_operation',
  restorePlan: 'restore_plan',
  restoreRecoveryCheckpoint: 'restore_recovery_checkpoint',
  readPlanExecution: 'read_plan_execution',
  subscribePlanExecution: 'subscribe_plan_execution',
  previewPlanDiagnostic: 'preview_plan_diagnostic',
  exportPlanDiagnostic: 'export_plan_diagnostic',
  readAdvancedPreference: 'read_advanced_preference',
  enableAdvancedPreference: 'enable_advanced_preference',
  revokeAdvancedPreference: 'revoke_advanced_preference',
});

export const INSTALLED_ROLES = Object.freeze([
  { key: 'desktop', role: 'desktop', path: 'liiiraa-desktop.exe' },
  { key: 'service', role: 'service', path: 'liiiraa-optimizer-service.exe' },
  { key: 'runner', role: 'runner', path: 'phase6-physical-runner.exe' },
]);

export const PORTABLE_ROLES = Object.freeze([
  {
    key: 'msi',
    role: 'msi',
    path: 'liiiraa-boost.msi',
    versionPolicy: 'package-version',
    signaturePolicy: 'authenticode-required',
  },
  {
    key: 'installationManifest',
    role: 'installation-manifest',
    path: 'installation-manifest.json',
    versionPolicy: 'schema-version',
    signaturePolicy: 'detached-cms-required',
  },
  {
    key: 'installationManifestSignature',
    role: 'installation-manifest-signature',
    path: 'installation-manifest.json.p7s',
    versionPolicy: 'not-applicable',
    signaturePolicy: 'detached-cms-required',
  },
  {
    key: 'cleanWindowsVmConfig',
    role: 'clean-windows-vm-config',
    path: 'configs/clean-windows-vm.run-config.json',
    versionPolicy: 'schema-version',
    signaturePolicy: 'manifest-authenticated',
  },
  {
    key: 'ownerPcConfig',
    role: 'owner-pc-config',
    path: 'configs/owner-pc.run-config.json',
    versionPolicy: 'schema-version',
    signaturePolicy: 'manifest-authenticated',
  },
  {
    key: 'friendsPcConfig',
    role: 'friends-pc-config',
    path: 'configs/friends-pc.run-config.json',
    versionPolicy: 'schema-version',
    signaturePolicy: 'manifest-authenticated',
  },
  {
    key: 'runner',
    role: 'runner',
    path: 'phase6-physical-runner.exe',
    versionPolicy: 'file-version',
    signaturePolicy: 'authenticode-required',
  },
  {
    key: 'tauriDriver',
    role: 'tauri-driver',
    path: 'tauri-driver.exe',
    versionPolicy: 'file-version',
    signaturePolicy: 'authenticode-required',
  },
  {
    key: 'msedgeDriver',
    role: 'msedgedriver',
    path: 'msedgedriver.exe',
    versionPolicy: 'file-version',
    signaturePolicy: 'authenticode-required',
  },
]);

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PHYSICAL_CONFIG = 'apps/desktop/src-tauri/tauri.phase6-physical.conf.json';
const WIX_FRAGMENT = 'apps/desktop/src-tauri/installer/optimizer-service.wxs';
const LIFECYCLE_HELPER = 'tooling/phase6-physical/lifecycle-smoke.ps1';
const DECLARED_INPUTS = Object.freeze([
  PHYSICAL_CONFIG,
  WIX_FRAGMENT,
  'apps/desktop/src-tauri/Cargo.toml',
  'apps/desktop/src-tauri/src',
  'apps/optimizer-service/Cargo.toml',
  'apps/optimizer-service/build.rs',
  'apps/optimizer-service/src',
  'crates/contracts-rust',
  'crates/plan-engine',
  'Cargo.lock',
  'pnpm-lock.yaml',
  'tooling/phase6-physical/build-artifact.mjs',
  LIFECYCLE_HELPER,
]);
const SHA_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const COMMIT_PATTERN = /^[0-9a-f]{40}$/u;
const MINIMUM_OPERATION = /^managed-power-scheme-v([1-9][0-9]*)$/u;
const WEBVIEW2_CLIENT_GUID = '{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}';
const WEBVIEW2_VERSION_PATTERN = /^[1-9][0-9]*\.[0-9]+\.[0-9]+\.[0-9]+$/u;
const WEBVIEW2_REGISTRY_KEYS = new Set([
  `HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Microsoft\\EdgeUpdate\\Clients\\${WEBVIEW2_CLIENT_GUID}`,
  `HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\EdgeUpdate\\Clients\\${WEBVIEW2_CLIENT_GUID}`,
  `HKEY_CURRENT_USER\\Software\\Microsoft\\EdgeUpdate\\Clients\\${WEBVIEW2_CLIENT_GUID}`,
]);

const fail = (message) => {
  throw new Error(message);
};
const deepEqual = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const sha256 = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const canonicalValue = (value) => {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalValue(value[key])]),
    );
  }
  return value;
};
export const canonicalBytes = (value) => Buffer.from(JSON.stringify(canonicalValue(value)), 'utf8');

const TAURI_BUNDLE_TYPE_UNKNOWN = Buffer.from('__TAURI_BUNDLE_TYPE_VAR_UNK', 'ascii');
const TAURI_BUNDLE_TYPE_MSI = Buffer.from('__TAURI_BUNDLE_TYPE_VAR_MSI', 'ascii');

export const patchTauriBundleTypeForMsi = (path) => {
  const executable = readFileSync(path);
  const first = executable.indexOf(TAURI_BUNDLE_TYPE_UNKNOWN);
  if (first < 0) {
    if (executable.indexOf(TAURI_BUNDLE_TYPE_MSI) < 0)
      fail('desktop executable has no recognized Tauri bundle marker');
    return false;
  }
  if (executable.indexOf(TAURI_BUNDLE_TYPE_UNKNOWN, first + 1) >= 0)
    fail('desktop executable must contain exactly one mutable Tauri bundle marker');
  TAURI_BUNDLE_TYPE_MSI.copy(executable, first);
  if (executable.indexOf(TAURI_BUNDLE_TYPE_UNKNOWN) >= 0)
    fail('desktop executable retained the mutable Tauri bundle marker');
  writeFileSync(path, executable);
  return true;
};

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    stdio: options.capture ? 'pipe' : 'inherit',
    ...options,
  });
  if (result.error) fail(`${command} could not start: ${result.error.message}`);
  if (result.status !== 0) {
    const detail = options.capture ? `: ${(result.stderr || result.stdout || '').trim()}` : '';
    fail(`${command} exited ${result.status}${detail}`);
  }
  return options.capture ? (result.stdout || '').trim() : '';
};

const git = (...args) => run('git', args, { capture: true });

const locatePnpmCli = () => {
  const candidates = [
    join(process.env.APPDATA || '', 'npm', 'node_modules', 'pnpm', 'bin', 'pnpm.mjs'),
    join(process.env.LOCALAPPDATA || '', 'pnpm', 'pnpm.mjs'),
  ];
  const path = candidates.find((candidate) => candidate && existsSync(candidate));
  if (!path) fail('the installed pnpm JavaScript entrypoint is unavailable');
  const version = run(process.execPath, [path, '--version'], { capture: true });
  if (version !== '11.17.0') fail(`pnpm exact release mismatch: ${version}`);
  return path;
};

const walkFiles = (absolutePath) => {
  if (!existsSync(absolutePath)) fail(`declared input is missing: ${relative(ROOT, absolutePath)}`);
  if (statSync(absolutePath).isFile()) return [absolutePath];
  return readdirSync(absolutePath, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => walkFiles(join(absolutePath, entry.name)));
};

const inputTreeHash = () => {
  const digest = createHash('sha256');
  for (const declared of DECLARED_INPUTS) {
    for (const path of walkFiles(join(ROOT, declared))) {
      digest.update(relative(ROOT, path).split(sep).join('/'));
      digest.update(Buffer.from([0]));
      digest.update(readFileSync(path));
      digest.update(Buffer.from([0]));
    }
  }
  return `sha256:${digest.digest('hex')}`;
};

export function assertDeclaredInputState({ porcelain, declaredPaths }) {
  const dirty = String(porcelain)
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => line.slice(3).replaceAll('\\', '/'));
  const declared = declaredPaths.map((path) => path.replaceAll('\\', '/').replace(/\/$/u, ''));
  const conflict = dirty.find((path) =>
    declared.some((prefix) => path === prefix || path.startsWith(`${prefix}/`)),
  );
  if (conflict) fail(`dirty declared input is forbidden: ${conflict}`);
  return true;
}

export function selectUnusedOperationVersion({ minimumVersion, usedVersions }) {
  const match = MINIMUM_OPERATION.exec(minimumVersion);
  if (!match || Number(match[1]) < 3)
    fail('minimum operation version must be managed-power-scheme-v3 or newer');
  if (usedVersions.includes(minimumVersion))
    fail(`operation version is already used: ${minimumVersion}`);
  return minimumVersion;
}

export function physicalPackageVersion(operationVersionId) {
  const match = MINIMUM_OPERATION.exec(operationVersionId);
  if (!match) fail('operation version cannot produce an MSI package version');
  const build = Number(match[1]);
  if (!Number.isSafeInteger(build) || build > 65_535)
    fail('operation version exceeds the MSI range');
  return `0.1.${build}`;
}

const assertExactRoles = (files, roles, label) => {
  if (!files || typeof files !== 'object') fail(`${label} files are required`);
  const expectedKeys = roles.map(({ key }) => key).sort();
  const actualKeys = Object.keys(files).sort();
  if (!deepEqual(actualKeys, expectedKeys))
    fail(`${label} must contain exact ${label} roles: ${expectedKeys.join(', ')}`);
  for (const expected of roles) {
    const entry = files[expected.key];
    if (entry.role !== expected.role) fail(`${label} role mismatch for ${expected.key}`);
    if (entry.relativePath !== expected.path)
      fail(`canonical ${label} path mismatch for ${expected.key}`);
    if (!Number.isSafeInteger(entry.sizeBytes) || entry.sizeBytes <= 0)
      fail(`${label} size must be positive for ${expected.key}`);
    if (!SHA_PATTERN.test(entry.sha256)) fail(`${label} SHA-256 is invalid for ${expected.key}`);
    if (
      expected.versionPolicy &&
      (entry.versionPolicy !== expected.versionPolicy ||
        entry.signaturePolicy !== expected.signaturePolicy)
    ) {
      fail(`${label} policy mismatch for ${expected.key}`);
    }
  }
};

export function validatePhysicalProfile(profile) {
  if (!profile?.bundle?.active || !deepEqual(profile.bundle.targets, ['msi']))
    fail('physical profile must be MSI-only');
  if (profile.bundle.createUpdaterArtifacts !== false)
    fail('physical profile updater artifacts must remain disabled');
  if (profile.bundle.windows?.allowDowngrades !== false)
    fail('physical profile must reject downgrade');
  if (!deepEqual(profile.bundle.windows?.webviewInstallMode, { type: 'skip' }))
    fail('physical profile WebView2 install mode must be exactly skip');
  const wix = profile.bundle.windows?.wix;
  if (!deepEqual(wix?.fragmentPaths, ['./installer/optimizer-service.wxs']))
    fail('physical profile must bind the optimizer service fragment');
  if (!deepEqual(wix?.componentGroupRefs, ['Phase6PhysicalRuntime']))
    fail('physical profile must bind the physical runtime component group');
  if ('template' in wix) fail('physical profile may not replace the audited WiX template');
  const updater = profile.plugins?.updater;
  if (
    !updater ||
    updater.pubkey !== '' ||
    !deepEqual(updater.endpoints, []) ||
    updater.windows !== null
  )
    fail('physical profile updater must remain inert');
  if (
    JSON.stringify(profile.app || {}).match(
      /requireAdministrator|highestAvailable|requestedExecutionLevel/iu,
    )
  )
    fail('desktop must remain non-elevated/asInvoker');
  return true;
}

export function validateWebView2RuntimeEvidence(evidence) {
  if (!WEBVIEW2_VERSION_PATTERN.test(evidence?.registryVersion || ''))
    fail('WebView2 Runtime registry version is missing or invalid');
  if (!WEBVIEW2_REGISTRY_KEYS.has(evidence.registryKey))
    fail('WebView2 Runtime registry identity is invalid');
  if (
    evidence.registryHive !== 'HKEY_LOCAL_MACHINE' &&
    evidence.registryHive !== 'HKEY_CURRENT_USER'
  )
    fail('WebView2 Runtime registry hive is invalid');
  if (!evidence.registryKey.startsWith(`${evidence.registryHive}\\`))
    fail('WebView2 Runtime registry hive does not match its key');
  const escapedVersion = evidence.registryVersion.replaceAll('.', '\\.');
  const runtimePath = new RegExp(
    `^[A-Za-z]:\\\\.*\\\\Microsoft\\\\EdgeWebView\\\\Application\\\\${escapedVersion}\\\\msedgewebview2\\.exe$`,
    'iu',
  );
  if (!runtimePath.test(evidence.executablePath || ''))
    fail('WebView2 Runtime executable path is invalid');
  if (evidence.fileVersion !== evidence.registryVersion)
    fail('WebView2 Runtime file version does not match the registry version');
  if (evidence.productName !== 'Microsoft Edge WebView2')
    fail('WebView2 product identity is invalid');
  if (evidence.signatureStatus !== 'Valid') fail('WebView2 Runtime signature is invalid');
  if (evidence.publisher !== 'Microsoft Corporation')
    fail('WebView2 Runtime is not signed by the Microsoft publisher');
  if (!SHA_PATTERN.test(evidence.executableSha256 || ''))
    fail('WebView2 Runtime executable SHA-256 is invalid');
  return {
    version: evidence.registryVersion,
    executablePath: evidence.executablePath,
    executableSha256: evidence.executableSha256,
  };
}

export function validateWixContract(xml) {
  const componentGroupIndex = xml.indexOf('<ComponentGroup');
  const containingDirectoryStart = xml.lastIndexOf('<DirectoryRef', componentGroupIndex);
  const containingDirectoryEnd = xml.indexOf('</DirectoryRef>', containingDirectoryStart);
  if (
    componentGroupIndex >= 0 &&
    containingDirectoryStart >= 0 &&
    componentGroupIndex < containingDirectoryEnd
  )
    fail('WiX ComponentGroup must remain outside DirectoryRef');
  const runtimeGroup = xml.match(
    /<ComponentGroup\b[^>]*Id="Phase6PhysicalRuntime"[^>]*>([\s\S]*?)<\/ComponentGroup>/iu,
  );
  if (!runtimeGroup) fail('WiX contract requires the physical runtime component group');
  if (/<Component\b/iu.test(runtimeGroup[1]))
    fail('WiX ComponentGroup must reference DirectoryRef components');
  if (!/<ComponentRef\b[^>]*Id="phase6_physical_runner"/iu.test(runtimeGroup[1]))
    fail('WiX contract requires the Tauri-generated runner component');
  const installDirectory = xml.match(
    /<DirectoryRef\b[^>]*Id="INSTALLDIR"[^>]*>([\s\S]*?)<\/DirectoryRef>/iu,
  );
  if (
    !installDirectory ||
    !installDirectory[1].includes('installation-manifest.json') ||
    !installDirectory[1].includes('OptimizerServiceComponent')
  )
    fail('WiX manifest and service must share the protected install directory');
  const permissions = [...xml.matchAll(/<PermissionEx\b([^>]*)\/?\s*>/giu)].map(
    (permission) => permission[1],
  );
  const directoryAcl = xml.match(
    /<Component\b[^>]*Id="PhysicalInstallDirectoryAclComponent"[^>]*>[\s\S]*?<CreateFolder\b[^>]*>[\s\S]*?<PermissionEx\b([^>]*)\/?\s*>[\s\S]*?<\/CreateFolder>[\s\S]*?<\/Component>/iu,
  );
  if (
    !directoryAcl ||
    !directoryAcl[1].includes(`Sddl="${INSTALLATION_DIRECTORY_SDDL}"`) ||
    !/<ComponentRef\b[^>]*Id="PhysicalInstallDirectoryAclComponent"/iu.test(runtimeGroup[1])
  )
    fail('WiX contract requires the protected inherited runtime directory ACL');
  const programDataAcl = xml.match(
    /<DirectoryRef\b[^>]*Id="TARGETDIR"[^>]*>[\s\S]*?<Directory\b[^>]*Id="CommonAppDataFolder"[^>]*>[\s\S]*?<Directory\b[^>]*Id="LiiiraaBoostProgramData"[^>]*Name="Liiiraa Boost"[^>]*>[\s\S]*?<Component\b([^>]*)Id="PhysicalProgramDataAclComponent"([^>]*)>[\s\S]*?<CreateFolder\b[^>]*>[\s\S]*?<PermissionEx\b([^>]*)\/?\s*>[\s\S]*?<\/CreateFolder>[\s\S]*?<\/Component>[\s\S]*?<\/Directory>[\s\S]*?<\/Directory>[\s\S]*?<\/DirectoryRef>/iu,
  );
  if (
    !programDataAcl ||
    !`${programDataAcl[1]}${programDataAcl[2]}`.includes(`Guid="${PROGRAM_DATA_COMPONENT_GUID}"`) ||
    !`${programDataAcl[1]}${programDataAcl[2]}`.includes('Permanent="yes"') ||
    !programDataAcl[3].includes(`Sddl="${PROGRAM_DATA_STORAGE_SDDL}"`) ||
    !/<ComponentRef\b[^>]*Id="PhysicalProgramDataAclComponent"/iu.test(runtimeGroup[1])
  )
    fail('WiX contract requires the permanent protected ProgramData storage root');
  if (
    !xml.includes(
      `Id="PhysicalInstallDirectoryAclComponent" Guid="${INSTALLATION_DIRECTORY_COMPONENT_GUID}"`,
    )
  )
    fail('WiX runtime directory ACL requires a stable component GUID');
  const manifestPermissions = permissions.filter((permission) =>
    permission.includes(`Sddl="${INSTALLATION_MANIFEST_SDDL}"`),
  );
  if (
    permissions.length !== 4 ||
    manifestPermissions.length !== 2 ||
    !permissions.includes(directoryAcl[1]) ||
    !permissions.includes(programDataAcl[3])
  )
    fail(
      'WiX PermissionEx must use the reviewed runtime, ProgramData, and installation-manifest SDDL',
    );
  const required = [
    ['Name="LiiiraaBoostOptimizer"', 'named optimizer service'],
    ['Type="ownProcess"', 'ownProcess service'],
    ['Start="auto"', 'auto service'],
    ['Account="LocalSystem"', 'LocalSystem service'],
    ['ServiceSid="restricted"', 'restricted service SID'],
    ['Start="install"', 'start on install'],
    ['Stop="both"', 'stop on update/uninstall'],
    ['Remove="uninstall"', 'remove on uninstall'],
    ['installation-manifest.json', 'installation manifest'],
    ['PermissionEx', 'protected ACL'],
  ];
  for (const [needle, description] of required)
    if (!xml.includes(needle)) fail(`WiX contract requires ${description}`);
  const manifestIndex = xml.indexOf('installation-manifest.json');
  const aclIndex = xml.indexOf('PermissionEx', manifestIndex);
  const storageIndex = xml.indexOf('Id="PhysicalProgramDataAclComponent"');
  const serviceStartIndex = xml.indexOf('<ServiceControl');
  if (
    manifestIndex < 0 ||
    aclIndex < manifestIndex ||
    storageIndex < 0 ||
    serviceStartIndex < aclIndex ||
    serviceStartIndex < storageIndex
  )
    fail('manifest, runtime ACL, and ProgramData storage ACL must precede service start');
  const forbidden = [
    [/<CustomAction\b|powershell(?:\.exe)?|cmd(?:\.exe)?/iu, 'custom action or shell authority'],
    [/tauri-driver\.exe|msedgedriver\.exe/iu, 'portable driver in MSI'],
    [
      /PROGRAMDATA.*(?:RemoveFile|RemoveFolder)|(?:RemoveFile|RemoveFolder).*PROGRAMDATA/isu,
      'recovery custody deletion',
    ],
    [/<(?:ScheduleReboot|ForceReboot)\b/iu, 'forced reboot'],
  ];
  for (const [pattern, description] of forbidden)
    if (pattern.test(xml)) fail(`WiX contract forbids ${description}`);
  const stagedSources = [...xml.matchAll(/<File\b[^>]*Source="([^"]+)"/giu)];
  if (
    stagedSources.length === 0 ||
    stagedSources.some(
      (source) =>
        !source[1].startsWith('../../../../../apps/desktop/src-tauri/installer/physical-staging/'),
    )
  )
    fail('WiX File sources must use the Tauri link working directory staging path');
  return true;
}

export function validateInstallationManifest(document) {
  if (document?.kind !== 'installation-manifest' || document.schemaVersion !== '1.0')
    fail('installation manifest identity is invalid');
  if (
    !COMMIT_PATTERN.test(document.sourceCommit || '') ||
    !SHA_PATTERN.test(document.inputTreeHash || '')
  )
    fail('installation manifest source identity is invalid');
  if (document.signerSpkiSha256 !== TRUSTED_INSTALLER_SPKI_SHA256)
    fail('installation manifest SPKI is not trusted');
  if (!/^managed-power-scheme-v([3-9]|[1-9][0-9]+)$/u.test(document.operationVersionId || ''))
    fail('installation manifest operation version is below v3');
  assertExactRoles(document.files, INSTALLED_ROLES, 'installed');
  for (const { key } of INSTALLED_ROLES) {
    if (!/^[0-9]+\.[0-9]+\.[0-9]+(?:\.[0-9]+)?$/u.test(document.files[key].version || ''))
      fail(`installed file version missing for ${key}`);
    if (
      document.files[key].authenticodePublisher !== 'Liiiraa Boost Local Development' ||
      !SHA_PATTERN.test(document.files[key].authenticodeThumbprint || '')
    ) {
      fail(`installed Authenticode identity missing for ${key}`);
    }
  }
  return true;
}

export function validateArtifactManifest(document) {
  if (document?.kind !== 'artifact-manifest' || document.schemaVersion !== '1.0')
    fail('artifact manifest identity is invalid');
  if (
    !COMMIT_PATTERN.test(document.sourceCommit || '') ||
    !SHA_PATTERN.test(document.inputTreeHash || '')
  )
    fail('artifact manifest source identity is invalid');
  assertExactRoles(document.files, PORTABLE_ROLES, 'portable');
  return true;
}

export function verifyDetachedCmsEvidence(evidence) {
  if (evidence.signerSpkiSha256 !== TRUSTED_INSTALLER_SPKI_SHA256)
    fail('detached CMS signer SPKI mismatch');
  if (
    !evidence.contentMatched ||
    !evidence.signatureValid ||
    !evidence.liveHashesMatched ||
    !evidence.authenticodeValid
  ) {
    fail('detached CMS custody verification failed');
  }
  return true;
}

export function assertImmutableFile(path, bytes) {
  if (!existsSync(path)) return 'absent';
  if (!readFileSync(path).equals(bytes))
    fail(`immutable identity already exists with different bytes: ${path}`);
  return 'verified-identical';
}

export function buildCanonicalRunConfigs({ operationVersionId, buildId, sourceCommit }) {
  if (!COMMIT_PATTERN.test(sourceCommit)) fail('source commit is invalid');
  const selected = selectUnusedOperationVersion({
    minimumVersion: operationVersionId,
    usedVersions: [],
  });
  const make = (stage) => ({
    kind: 'physical-run-config',
    schemaVersion: '1.0',
    configId: `${stage}-${buildId}`,
    stage,
    configPath: `configs/${stage}.run-config.json`,
    artifactManifestPath: 'artifact-manifest.json',
    operationVersionId: selected,
    buildId,
    sourceCommit,
    participantIdentityMode: 'purpose-bound-local-hash',
    scenarios: {
      prepareRecovery: true,
      apply: true,
      verifyApplied: true,
      rebootWhenRequired: true,
      restore: true,
      verifyRestored: true,
    },
    paths: {
      runRecordPath: `state/${stage}/run-record.json`,
      installedReadyRecordPath: `state/${stage}/installed-ready.json`,
      checkpointReadyRecordPath: `state/${stage}/checkpoint-ready.json`,
      continuationPath: `state/${stage}/physical-continuation.json`,
      rawEnvelopePath: `evidence/${stage}/raw-run-envelope.json`,
    },
    tauriCommands: CANONICAL_COMMANDS,
  });
  const configs = {
    'clean-windows-vm': make('clean-windows-vm'),
    'owner-pc': make('owner-pc'),
    'friends-pc': {
      ...make('friends-pc'),
      friendsRosterPath: 'friends/friends-roster.json',
      friendsRosterSignaturePath: 'friends/friends-roster.json.p7s',
    },
  };
  return configs;
}

const collectUsedVersions = () => {
  const roots = [join(ROOT, 'tooling', 'phase6-evidence'), join(ROOT, 'target', 'phase6-physical')];
  const used = new Set();
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const path of walkFiles(root)) {
      if (!/\.(?:json|md|txt)$/iu.test(path)) continue;
      const text = readFileSync(path, 'utf8');
      for (const match of text.matchAll(/managed-power-scheme-v[0-9]+/gu)) used.add(match[0]);
    }
  }
  return [...used].sort();
};

const parseArgs = (argv) => {
  const options = {
    mode: null,
    reserve: false,
    minimumVersion: null,
    requireMsi: false,
    requireLifecycle: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--mode') options.mode = argv[++index];
    else if (arg === '--reserve-operation-version') options.reserve = true;
    else if (arg === '--minimum-version') options.minimumVersion = argv[++index];
    else if (arg === '--require-msi') options.requireMsi = true;
    else if (arg === '--require-lifecycle') options.requireLifecycle = true;
    else fail(`unsupported argument: ${arg}`);
  }
  if (!['dry-run', 'build-and-smoke'].includes(options.mode))
    fail('--mode must be dry-run or build-and-smoke');
  if (!options.reserve || !options.minimumVersion)
    fail('operation version reservation is mandatory');
  if (options.mode === 'build-and-smoke' && (!options.requireMsi || !options.requireLifecycle))
    fail('real mode requires --require-msi and --require-lifecycle');
  return options;
};

const findSignTool = () => {
  const kits = 'C:\\Program Files (x86)\\Windows Kits\\10\\bin';
  if (!existsSync(kits)) return null;
  return (
    readdirSync(kits, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^10\./u.test(entry.name))
      .sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true }))
      .map((entry) => join(kits, entry.name, 'x64', 'signtool.exe'))
      .find(existsSync) || null
  );
};

const powershellJson = (script) => {
  const output = run('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], {
    capture: true,
  });
  return JSON.parse(output);
};

export const detectWebView2Runtime = () => {
  const evidence = powershellJson(`
$ErrorActionPreference = 'Stop'
$clientId = '${WEBVIEW2_CLIENT_GUID}'
$registrations = @(
  [pscustomobject]@{ hive = 'HKEY_LOCAL_MACHINE'; key = "HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Microsoft\\EdgeUpdate\\Clients\\$clientId"; providerPath = "HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\EdgeUpdate\\Clients\\$clientId"; roots = @([Environment]::GetFolderPath('ProgramFilesX86'), $env:ProgramFiles) },
  [pscustomobject]@{ hive = 'HKEY_LOCAL_MACHINE'; key = "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\EdgeUpdate\\Clients\\$clientId"; providerPath = "HKLM:\\SOFTWARE\\Microsoft\\EdgeUpdate\\Clients\\$clientId"; roots = @($env:ProgramFiles, [Environment]::GetFolderPath('ProgramFilesX86')) },
  [pscustomobject]@{ hive = 'HKEY_CURRENT_USER'; key = "HKEY_CURRENT_USER\\Software\\Microsoft\\EdgeUpdate\\Clients\\$clientId"; providerPath = "HKCU:\\Software\\Microsoft\\EdgeUpdate\\Clients\\$clientId"; roots = @($env:LOCALAPPDATA) }
)
$results = @()
foreach ($registration in $registrations) {
  if (-not (Test-Path -LiteralPath $registration.providerPath)) { continue }
  $version = [string](Get-ItemPropertyValue -LiteralPath $registration.providerPath -Name 'pv' -ErrorAction Stop)
  $runtime = $registration.roots |
    Where-Object { $_ } |
    ForEach-Object { Join-Path $_ "Microsoft\\EdgeWebView\\Application\\$version\\msedgewebview2.exe" } |
    Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } |
    Select-Object -First 1
  $item = if ($runtime) { Get-Item -LiteralPath $runtime } else { $null }
  $signature = if ($runtime) { Get-AuthenticodeSignature -LiteralPath $runtime } else { $null }
  $publisher = if ($signature -and $signature.SignerCertificate) {
    $signature.SignerCertificate.GetNameInfo([Security.Cryptography.X509Certificates.X509NameType]::SimpleName, $false)
  } else { $null }
  $results += [pscustomobject]@{
    registryHive = $registration.hive
    registryKey = $registration.key
    registryVersion = $version
    executablePath = $runtime
    fileVersion = if ($item) { $item.VersionInfo.FileVersion } else { $null }
    productName = if ($item) { $item.VersionInfo.ProductName } else { $null }
    signatureStatus = if ($signature) { $signature.Status.ToString() } else { $null }
    publisher = $publisher
    executableSha256 = if ($runtime) { 'sha256:' + (Get-FileHash -Algorithm SHA256 -LiteralPath $runtime).Hash.ToLowerInvariant() } else { $null }
  }
}
@($results) | ConvertTo-Json -Depth 5 -Compress
`);
  const candidates = Array.isArray(evidence) ? evidence : evidence ? [evidence] : [];
  if (candidates.length === 0) fail('Microsoft Edge WebView2 Runtime registration is unavailable');
  const verified = candidates.map(validateWebView2RuntimeEvidence);
  return verified[0];
};

const certificateSpkiSha256 = (certificateBase64) => {
  const certificate = new X509Certificate(Buffer.from(certificateBase64, 'base64'));
  return sha256(certificate.publicKey.export({ type: 'spki', format: 'der' }));
};

const signerIdentity = (expectedSpki) => {
  const candidates = powershellJson(`
$ErrorActionPreference = 'Stop'
$certificates = @(Get-ChildItem Cert:\\CurrentUser\\My |
  Where-Object { $_.Subject -eq 'CN=Liiiraa Boost Local Development' -and $_.HasPrivateKey } |
  ForEach-Object {
    [pscustomobject]@{
      thumbprint = $_.Thumbprint
      subject = $_.Subject
      certificateBase64 = [Convert]::ToBase64String($_.RawData)
      store = $_.PSParentPath
    }
  })
$certificates | ConvertTo-Json -Compress
`);
  const matches = (Array.isArray(candidates) ? candidates : [candidates])
    .filter(Boolean)
    .map((candidate) => ({
      ...candidate,
      spkiSha256: certificateSpkiSha256(candidate.certificateBase64),
    }))
    .filter((candidate) => candidate.spkiSha256 === expectedSpki);
  if (matches.length !== 1)
    fail(
      `expected exactly one CurrentUser development signer matching the compiled SPKI, found ${matches.length}`,
    );
  const [{ certificateBase64: _publicCertificate, ...signer }] = matches;
  return signer;
};

const fileVersion = (path) => {
  const escaped = path.replaceAll("'", "''");
  return (
    run(
      'powershell',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `(Get-Item -LiteralPath '${escaped}').VersionInfo.FileVersion`,
      ],
      { capture: true },
    ) || 'unversioned'
  );
};

const authenticodeIdentity = (path) => {
  const escaped = path.replaceAll("'", "''");
  return powershellJson(`
$signature = Get-AuthenticodeSignature -LiteralPath '${escaped}'
if (-not $signature.SignerCertificate) { throw 'missing Authenticode signer: ${escaped}' }
$certificateSha256 = 'sha256:' + [BitConverter]::ToString($signature.SignerCertificate.GetCertHash([Security.Cryptography.HashAlgorithmName]::SHA256)).Replace('-', '').ToLowerInvariant()
[pscustomobject]@{ status = $signature.Status.ToString(); publisher = $signature.SignerCertificate.GetNameInfo([Security.Cryptography.X509Certificates.X509NameType]::SimpleName, $false); thumbprint = $certificateSha256 } | ConvertTo-Json -Compress
`);
};

const signAuthenticode = (signtool, thumbprint, path) => {
  run(signtool, ['sign', '/sha1', thumbprint, '/fd', 'sha256', '/v', path]);
  const identity = authenticodeIdentity(path);
  if (!['Valid', 'UnknownError'].includes(identity.status))
    fail(`AuthentiCode verification failed for ${path}: ${identity.status}`);
  return identity;
};

const signDetachedCms = (thumbprint, contentPath, signaturePath) => {
  const content = contentPath.replaceAll("'", "''");
  const signature = signaturePath.replaceAll("'", "''");
  run('powershell', [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security
$cert = Get-ChildItem Cert:\\CurrentUser\\My, Cert:\\LocalMachine\\My | Where-Object { $_.Thumbprint -eq '${thumbprint}' -and $_.HasPrivateKey } | Select-Object -First 1
if (-not $cert) { throw 'CMS signing certificate disappeared' }
$cms = [Security.Cryptography.Pkcs.SignedCms]::new([Security.Cryptography.Pkcs.ContentInfo]::new([IO.File]::ReadAllBytes('${content}')), $true)
$cms.ComputeSignature([Security.Cryptography.Pkcs.CmsSigner]::new($cert))
[IO.File]::WriteAllBytes('${signature}', $cms.Encode())
`,
  ]);
};

const verifyDetachedCms = (contentPath, signaturePath, expectedSpki) => {
  const content = contentPath.replaceAll("'", "''");
  const signature = signaturePath.replaceAll("'", "''");
  const evidence = powershellJson(`
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security
$content = [IO.File]::ReadAllBytes('${content}')
$cms = [Security.Cryptography.Pkcs.SignedCms]::new([Security.Cryptography.Pkcs.ContentInfo]::new($content), $true)
$cms.Decode([IO.File]::ReadAllBytes('${signature}'))
$cms.CheckSignature($true)
$cert = $cms.SignerInfos[0].Certificate
[pscustomobject]@{ contentMatched = $true; signatureValid = $true; signerCertificateBase64 = [Convert]::ToBase64String($cert.RawData); liveHashesMatched = $true; authenticodeValid = $true } | ConvertTo-Json -Compress
`);
  evidence.signerSpkiSha256 = certificateSpkiSha256(evidence.signerCertificateBase64);
  delete evidence.signerCertificateBase64;
  if (evidence.signerSpkiSha256 !== expectedSpki)
    fail('CMS signer SPKI does not match compiled trust pin');
  return evidence;
};

const installedRoleIdentity = (role, relativePath, absolutePath, signature) => ({
  role,
  relativePath,
  sizeBytes: statSync(absolutePath).size,
  sha256: sha256(readFileSync(absolutePath)),
  version: fileVersion(absolutePath),
  authenticodePublisher: signature.publisher,
  authenticodeThumbprint: signature.thumbprint,
});

const portableRoleIdentity = (role, relativePath, absolutePath, metadata) => ({
  role,
  relativePath,
  sizeBytes: statSync(absolutePath).size,
  sha256: sha256(readFileSync(absolutePath)),
  version: metadata.version,
  versionPolicy: metadata.versionPolicy,
  signaturePolicy: metadata.signaturePolicy,
});

const writeCreateOnce = (path, bytes) => {
  const state = assertImmutableFile(path, bytes);
  if (state === 'verified-identical') return state;
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temporary, bytes, { flag: 'wx' });
  renameSync(temporary, path);
  return 'created';
};

export function validateTauriDriverInstallReceipt(receipt, executableName = 'tauri-driver.exe') {
  const exactKey = 'tauri-driver 2.0.6 (registry+https://github.com/rust-lang/crates.io-index)';
  const installed = receipt?.installs?.[exactKey];
  if (
    installed?.version_req !== '=2.0.6' ||
    !Array.isArray(installed.bins) ||
    !installed.bins.includes(executableName)
  ) {
    fail('tauri-driver exact 2.0.6 crates.io install receipt is invalid');
  }
  return { version: '2.0.6', source: 'registry+https://github.com/rust-lang/crates.io-index' };
}

const locateTauriDriver = () => {
  const candidates = [
    join(process.env.USERPROFILE || '', '.cargo', 'bin', 'tauri-driver.exe'),
    join(ROOT, 'target', 'phase6-tools', 'bin', 'tauri-driver.exe'),
  ];
  const path = candidates.find((candidate) => candidate && existsSync(candidate));
  if (!path)
    fail(
      'tauri-driver 2.0.6 is unavailable; install the approved exact release before the physical build',
    );
  const receiptPath = join(dirname(dirname(path)), '.crates2.json');
  if (!existsSync(receiptPath)) fail('tauri-driver Cargo install receipt is unavailable');
  const provenance = validateTauriDriverInstallReceipt(
    JSON.parse(readFileSync(receiptPath, 'utf8')),
    basename(path),
  );
  return { path, ...provenance };
};

const edgeVersion = () =>
  run(
    'powershell',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `
$paths = @(
  "$env:ProgramFiles (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "$env:ProgramFiles\\Microsoft\\Edge\\Application\\msedge.exe"
)
$edge = $paths | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $edge) { throw 'Microsoft Edge is unavailable' }
(Get-Item -LiteralPath $edge).VersionInfo.FileVersion
`,
    ],
    { capture: true },
  );

const locateMsEdgeDriver = () => {
  const version = edgeVersion();
  const candidates = [
    join(ROOT, 'target', 'phase6-tools', version, 'msedgedriver.exe'),
    join(process.env.LOCALAPPDATA || '', 'LiiiraaBoost', 'drivers', version, 'msedgedriver.exe'),
  ];
  const path = candidates.find((candidate) => candidate && existsSync(candidate));
  if (!path)
    fail(
      `msedgedriver ${version} is unavailable; stage the exact official Edge-matched release before the physical build`,
    );
  const reported = run(path, ['--version'], { capture: true });
  if (!reported.includes(version))
    fail(`msedgedriver exact release mismatch: expected ${version}, got ${reported}`);
  const publisher = authenticodeIdentity(path);
  if (!/Microsoft/iu.test(publisher.publisher))
    fail('msedgedriver source release is not Microsoft Authenticode signed');
  return path;
};

const builtMsiDirectory = () =>
  join(ROOT, 'target', 'x86_64-pc-windows-msvc', 'release', 'bundle', 'msi');

const removeStaleBuiltMsis = () => {
  const directory = builtMsiDirectory();
  if (!existsSync(directory)) return;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isFile() && /\.msi$/iu.test(entry.name))
      rmSync(join(directory, entry.name), { force: true });
  }
};

const findBuiltMsi = (notBeforeMillis) => {
  const directory = builtMsiDirectory();
  if (!existsSync(directory)) fail('Tauri did not emit an MSI directory');
  const files = walkFiles(directory).filter((path) => /\.msi$/iu.test(path));
  if (files.length !== 1) fail(`expected exactly one physical MSI, found ${files.length}`);
  if (statSync(files[0]).mtimeMs < notBeforeMillis)
    fail('Tauri emitted MSI is stale relative to the current bundle invocation');
  return files[0];
};

export const inspectMsi = (path) => {
  const escaped = path.replaceAll("'", "''");
  return powershellJson(`
$ErrorActionPreference = 'Stop'
$installer = New-Object -ComObject WindowsInstaller.Installer
$database = $installer.OpenDatabase('${escaped}', 0)
function Read-Property([string]$name) {
  $view = $database.OpenView("SELECT Value FROM Property WHERE Property='$name'")
  $null = $view.Execute(); $record = $view.Fetch(); $null = $view.Close()
  if ($record) { return $record.StringData(1) }
  return $null
}
$files = $database.OpenView('SELECT FileName FROM File')
$null = $files.Execute(); $names = @(); while ($record = $files.Fetch()) { $names += $record.StringData(1) }; $null = $files.Close()
$custom = $database.OpenView('SELECT Action, Type, Source, Target FROM CustomAction'); $null = $custom.Execute(); $customActions = @(); while ($record = $custom.Fetch()) { $customActions += [pscustomobject]@{ action = $record.StringData(1); type = $record.IntegerData(2); source = $record.StringData(3); target = $record.StringData(4) } }; $null = $custom.Close()
function Read-Record([string]$query) {
  $view = $database.OpenView($query); $null = $view.Execute(); $record = $view.Fetch(); $null = $view.Close(); return $record
}
$storageComponent = Read-Record "SELECT \`Component\`, \`Directory_\` FROM \`Component\` WHERE \`Component\`='PhysicalProgramDataAclComponent'"
$storageDirectory = Read-Record "SELECT \`Directory_Parent\` FROM \`Directory\` WHERE \`Directory\`='LiiiraaBoostProgramData'"
$storageCreate = Read-Record "SELECT \`Directory_\`, \`Component_\` FROM \`CreateFolder\` WHERE \`Directory_\`='LiiiraaBoostProgramData'"
$storagePermission = Read-Record "SELECT \`SDDLText\` FROM \`MsiLockPermissionsEx\` WHERE \`LockObject\`='LiiiraaBoostProgramData'"
$storageFeature = Read-Record "SELECT \`Feature_\` FROM \`FeatureComponents\` WHERE \`Component_\`='PhysicalProgramDataAclComponent'"
$programDataStorage = $null
if ($storageComponent -and $storageDirectory -and $storageCreate -and $storagePermission -and $storageFeature) {
  $programDataStorage = [pscustomobject]@{
    component = $storageComponent.StringData(1)
    directory = $storageComponent.StringData(2)
    parent = $storageDirectory.StringData(1)
    feature = $storageFeature.StringData(1)
    createFolder = ($storageCreate.StringData(1) -eq 'LiiiraaBoostProgramData' -and $storageCreate.StringData(2) -eq 'PhysicalProgramDataAclComponent')
    sddl = $storagePermission.StringData(1)
  }
}
[pscustomobject]@{ productCode = Read-Property 'ProductCode'; packageVersion = Read-Property 'ProductVersion'; files = $names; customActionCount = $customActions.Count; customActions = @($customActions); programDataStorage = $programDataStorage } | ConvertTo-Json -Depth 5 -Compress
`);
};

const stripMsiCustomActions = (path) => {
  const escaped = path.replaceAll("'", "''");
  run('powershell', [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    `
$ErrorActionPreference = 'Stop'
$installer = New-Object -ComObject WindowsInstaller.Installer
$database = $installer.OpenDatabase('${escaped}', 1)
$view = $database.OpenView('SELECT Action FROM CustomAction')
$null = $view.Execute()
$actions = @()
while ($record = $view.Fetch()) { $actions += $record.StringData(1) }
$null = $view.Close()
$sequenceTables = @('InstallExecuteSequence', 'InstallUISequence', 'AdminExecuteSequence', 'AdminUISequence', 'AdvtExecuteSequence')
foreach ($action in $actions) {
  $literal = $action.Replace("'", "''")
  foreach ($table in $sequenceTables) {
    $delete = $database.OpenView("DELETE FROM $table WHERE Action='$literal'")
    $null = $delete.Execute()
    $null = $delete.Close()
  }
  $deleteEvents = $database.OpenView("DELETE FROM ControlEvent WHERE Event='DoAction' AND Argument='$literal'")
  $null = $deleteEvents.Execute()
  $null = $deleteEvents.Close()
  $deleteAction = $database.OpenView("DELETE FROM CustomAction WHERE Action='$literal'")
  $null = $deleteAction.Execute()
  $null = $deleteAction.Close()
}
$deleteWixCa = $database.OpenView("DELETE FROM Binary WHERE Name='WixUIWixca'")
$null = $deleteWixCa.Execute()
$null = $deleteWixCa.Close()
$database.Commit()
`,
  ]);
};

export function validateMsiInspection(inspection, expected) {
  const actualProductCode = String(inspection?.productCode || '')
    .replace(/[{}]/gu, '')
    .toLowerCase();
  if (
    actualProductCode !== expected.productCode.toLowerCase() ||
    inspection?.packageVersion !== expected.packageVersion
  )
    fail('MSI ProductCode/package version does not match the signed installation manifest');
  const expectedFiles = [
    'installation-manifest.json',
    'installation-manifest.json.p7s',
    'liiiraa-desktop.exe',
    'liiiraa-optimizer-service.exe',
    'phase6-physical-runner.exe',
  ].sort();
  const actualFiles = (inspection.files || [])
    .map((name) => name.split('|').at(-1).toLowerCase())
    .sort();
  if (!deepEqual(actualFiles, expectedFiles)) fail('MSI must contain the exact installed files');
  if (
    inspection.customActionCount !== 0 ||
    !Array.isArray(inspection.customActions) ||
    inspection.customActions.length !== 0
  )
    fail('MSI must contain zero CustomAction authority');
  if (
    /DownloadAndInvokeBootstrapper|powershell(?:\.exe)?|cmd(?:\.exe)?/iu.test(
      JSON.stringify(inspection),
    )
  )
    fail('MSI inspection contains forbidden bootstrapper or shell authority');
  const storage = inspection.programDataStorage;
  if (
    !storage ||
    storage.component !== 'PhysicalProgramDataAclComponent' ||
    storage.directory !== 'LiiiraaBoostProgramData' ||
    storage.parent !== 'CommonAppDataFolder' ||
    storage.feature !== 'External' ||
    storage.createFolder !== true ||
    storage.sddl !== PROGRAM_DATA_STORAGE_SDDL
  )
    fail('MSI must contain the protected ProgramData storage tables');
  return true;
}

const setMsiProductCode = (path, productCode) => {
  const escaped = path.replaceAll("'", "''");
  const msiProductCode = `{${productCode.toUpperCase()}}`;
  run('powershell', [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    `
$ErrorActionPreference = 'Stop'
$installer = New-Object -ComObject WindowsInstaller.Installer
$database = $installer.OpenDatabase('${escaped}', 1)
$view = $database.OpenView("UPDATE Property SET Value='${msiProductCode}' WHERE Property='ProductCode'")
$view.Execute(); $view.Close(); $database.Commit()
`,
  ]);
};

const setMsiIdentity = (path, { productCode, packageVersion }) => {
  const escaped = path.replaceAll("'", "''");
  const msiProductCode = `{${productCode.toUpperCase()}}`;
  run('powershell', [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    `
$ErrorActionPreference = 'Stop'
$installer = New-Object -ComObject WindowsInstaller.Installer
$database = $installer.OpenDatabase('${escaped}', 1)
$product = $database.OpenView("UPDATE Property SET Value='${msiProductCode}' WHERE Property='ProductCode'")
$product.Execute(); $product.Close()
$version = $database.OpenView("UPDATE Property SET Value='${packageVersion}' WHERE Property='ProductVersion'")
$version.Execute(); $version.Close(); $database.Commit()
`,
  ]);
};

const runLifecycleSmoke = ({
  msiPath,
  downgradeMsiPath,
  productCode,
  outputRoot,
  webView2Runtime,
  installationManifestSha256,
  installationSignatureSha256,
}) => {
  const resultPath = join(outputRoot, 'elevated-lifecycle-result.json');
  const helper = join(ROOT, LIFECYCLE_HELPER);
  const script = `
$ErrorActionPreference = 'Stop'
$arguments = @(
  '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'RemoteSigned', '-File',
  '${helper.replaceAll("'", "''")}',
  '-MsiPath', '"${msiPath.replaceAll("'", "''")}"',
  '-DowngradeMsiPath', '"${downgradeMsiPath.replaceAll("'", "''")}"',
  '-ProductCode', '${productCode.replaceAll("'", "''")}',
  '-OutputRoot', '"${outputRoot.replaceAll("'", "''")}"',
  '-ExpectedWebView2Version', '${webView2Runtime.version.replaceAll("'", "''")}',
  '-ExpectedWebView2Sha256', '${webView2Runtime.executableSha256.replaceAll("'", "''")}',
  '-ExpectedInstallationManifestSha256', '${installationManifestSha256}',
  '-ExpectedInstallationSignatureSha256', '${installationSignatureSha256}',
  '-ResultPath', '"${resultPath.replaceAll("'", "''")}"'
)
$process = Start-Process -FilePath 'powershell.exe' -ArgumentList $arguments -Verb RunAs -WindowStyle Normal -Wait -PassThru
if ($process.ExitCode -ne 0) { throw "elevated lifecycle helper exited $($process.ExitCode)" }
`;
  run('powershell', ['-NoProfile', '-NonInteractive', '-Command', script]);
  if (!existsSync(resultPath)) fail('elevated lifecycle helper did not produce its result');
  const result = JSON.parse(readFileSync(resultPath, 'utf8').replace(/^\uFEFF/u, ''));
  if (
    result.status !== 'PASSED' ||
    result.install !== 'passed' ||
    result.repairUpdate !== 'passed' ||
    result.rollbackFailureDrill !== 'passed' ||
    result.downgradeRejected !== true ||
    result.uninstall !== 'passed' ||
    result.recoveryCustodyPreserved !== true ||
    result.forcedReboot !== false ||
    result.residualsAbsent !== true ||
    result.installedManifestAdministratorReadDenied !== true ||
    result.artifactManifestCanonicalCmsVerified !== true ||
    result.installedBinaryIdentitiesVerified !== 3 ||
    result.serviceAcceptedProtectedManifest !== true ||
    result.webView2RuntimeVersion !== webView2Runtime.version ||
    result.webView2RuntimeSha256 !== webView2Runtime.executableSha256
  ) {
    fail('elevated lifecycle result did not satisfy the closed lifecycle contract');
  }
  return result;
};

const writeBlockedReport = (error, context) => {
  const directory = join(ROOT, 'target', 'phase6-physical', '_blocked');
  mkdirSync(directory, { recursive: true });
  const report = {
    kind: 'phase6-physical-blocked-build',
    schemaVersion: '1.0',
    status: 'BLOCKED',
    createdAt: new Date().toISOString(),
    reason: error.message,
    ...context,
    artifactPublished: false,
    msiBuilt: false,
    lifecycleVerified: false,
  };
  const path = join(directory, `BLOCKED-${Date.now()}-${process.pid}.json`);
  writeFileSync(path, canonicalBytes(report), { flag: 'wx' });
  return relative(ROOT, path).replaceAll('\\', '/');
};

const dryRun = (options) => {
  validatePhysicalProfile(JSON.parse(readFileSync(join(ROOT, PHYSICAL_CONFIG), 'utf8')));
  validateWixContract(readFileSync(join(ROOT, WIX_FRAGMENT), 'utf8'));
  const usedVersions = collectUsedVersions();
  const operationVersionId = selectUnusedOperationVersion({
    minimumVersion: options.minimumVersion,
    usedVersions,
  });
  const result = {
    mode: 'dry-run',
    writesPerformed: false,
    sourceCommit: git('rev-parse', 'HEAD'),
    inputTreeHash: inputTreeHash(),
    operationVersionId,
    packageVersion: physicalPackageVersion(operationVersionId),
    installedRuntimeRoles: INSTALLED_ROLES.map(({ role }) => role),
    exactRuntimeRoles: ['desktop', 'service', 'runner', 'tauri-driver', 'msedgedriver'],
    portableOnlyRoles: ['tauri-driver', 'msedgedriver'],
    msiProfile: PHYSICAL_CONFIG,
    wixFragment: WIX_FRAGMENT,
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
};

const buildAndSmoke = (options) => {
  const context = { mode: 'build-and-smoke', sourceCommit: null, operationVersionId: null };
  try {
    if (process.platform !== 'win32') fail('physical artifact build requires Windows');
    const webView2Runtime = detectWebView2Runtime();
    const signtool = findSignTool();
    if (!signtool) fail('Windows SDK signtool.exe is unavailable');
    const signer = signerIdentity(TRUSTED_INSTALLER_SPKI_SHA256);
    if (signer.spkiSha256 !== TRUSTED_INSTALLER_SPKI_SHA256)
      fail(`certificate SPKI mismatch: ${signer.spkiSha256}`);
    assertDeclaredInputState({
      porcelain: git('status', '--porcelain'),
      declaredPaths: DECLARED_INPUTS,
    });
    const physicalProfile = JSON.parse(readFileSync(join(ROOT, PHYSICAL_CONFIG), 'utf8'));
    validatePhysicalProfile(physicalProfile);
    validateWixContract(readFileSync(join(ROOT, WIX_FRAGMENT), 'utf8'));

    const sourceCommit = git('rev-parse', 'HEAD');
    const treeHash = inputTreeHash();
    const operationVersionId = selectUnusedOperationVersion({
      minimumVersion: options.minimumVersion,
      usedVersions: collectUsedVersions(),
    });
    const packageVersion = physicalPackageVersion(operationVersionId);
    const effectivePhysicalProfile = { ...physicalProfile, version: packageVersion };
    const effectivePhysicalProfileJson = JSON.stringify(effectivePhysicalProfile);
    const buildId = `physical-${treeHash.slice(7, 23)}-${operationVersionId}`;
    Object.assign(context, { sourceCommit, operationVersionId, buildId, inputTreeHash: treeHash });
    const finalRoot = join(ROOT, 'target', 'phase6-physical', sourceCommit, buildId);
    if (existsSync(finalRoot))
      fail(`immutable artifact identity already exists: ${relative(ROOT, finalRoot)}`);
    const workRoot = join(
      ROOT,
      'target',
      'phase6-physical',
      '_work',
      `${buildId}-${process.pid}-${randomUUID()}`,
    );
    mkdirSync(join(workRoot, 'configs'), { recursive: true });

    const tauriDriverSource = locateTauriDriver();
    const msedgeDriverSource = locateMsEdgeDriver();
    const pnpmCli = locatePnpmCli();
    run(
      'cargo',
      [
        'build',
        '--release',
        '--target',
        'x86_64-pc-windows-msvc',
        '-p',
        'liiiraa-optimizer-service',
      ],
      {
        env: {
          ...process.env,
          LIIIRAA_PHYSICAL_PACKAGE_VERSION: packageVersion,
        },
      },
    );
    run('cargo', [
      'build',
      '--release',
      '--target',
      'x86_64-pc-windows-msvc',
      '-p',
      'liiiraa-desktop',
      '--bin',
      'phase6-physical-runner',
      '--features',
      'phase6-physical',
    ]);
    run(process.execPath, [
      pnpmCli,
      '--filter',
      '@liiiraa/desktop',
      'exec',
      'tauri',
      'build',
      '--no-bundle',
      '--target',
      'x86_64-pc-windows-msvc',
      '--features',
      'phase6-physical',
      '--config',
      effectivePhysicalProfileJson,
    ]);

    const release = join(ROOT, 'target', 'x86_64-pc-windows-msvc', 'release');
    const built = {
      desktop: join(release, 'liiiraa-desktop.exe'),
      service: join(release, 'liiiraa-optimizer-service.exe'),
      runner: join(release, 'phase6-physical-runner.exe'),
    };
    for (const path of Object.values(built))
      if (!existsSync(path)) fail(`release runtime is missing: ${path}`);
    patchTauriBundleTypeForMsi(built.desktop);
    const signatures = {};
    for (const [key, path] of Object.entries(built))
      signatures[key] = signAuthenticode(signtool, signer.thumbprint, path);

    const portableDrivers = {
      tauriDriver: join(workRoot, 'tauri-driver.exe'),
      msedgeDriver: join(workRoot, 'msedgedriver.exe'),
    };
    copyFileSync(tauriDriverSource.path, portableDrivers.tauriDriver);
    copyFileSync(msedgeDriverSource, portableDrivers.msedgeDriver);
    signatures.tauriDriver = signAuthenticode(
      signtool,
      signer.thumbprint,
      portableDrivers.tauriDriver,
    );
    signatures.msedgeDriver = signAuthenticode(
      signtool,
      signer.thumbprint,
      portableDrivers.msedgeDriver,
    );
    copyFileSync(built.runner, join(workRoot, 'phase6-physical-runner.exe'));

    const productCode = PHYSICAL_PRODUCT_CODE;
    const createdAt = new Date().toISOString();
    const installationManifest = {
      kind: 'installation-manifest',
      schemaVersion: '1.0',
      manifestId: `installation-manifest-${buildId}`,
      productCode,
      packageVersion,
      sourceCommit,
      inputTreeHash: treeHash,
      buildId,
      operationVersionId,
      createdAt,
      signerSpkiSha256: TRUSTED_INSTALLER_SPKI_SHA256,
      files: Object.fromEntries(
        INSTALLED_ROLES.map(({ key, role, path }) => [
          key,
          installedRoleIdentity(role, path, built[key], signatures[key]),
        ]),
      ),
    };
    validateInstallationManifest(installationManifest);
    const installationPath = join(workRoot, 'installation-manifest.json');
    writeCreateOnce(installationPath, canonicalBytes(installationManifest));
    signDetachedCms(signer.thumbprint, installationPath, `${installationPath}.p7s`);
    verifyDetachedCms(installationPath, `${installationPath}.p7s`, TRUSTED_INSTALLER_SPKI_SHA256);

    const wixStaging = join(ROOT, 'apps', 'desktop', 'src-tauri', 'installer', 'physical-staging');
    if (existsSync(wixStaging))
      fail('WiX physical staging directory already exists; refusing ambiguous input');
    mkdirSync(wixStaging, { recursive: false });
    let msiBuildStartedAt = 0;
    try {
      copyFileSync(built.service, join(wixStaging, 'liiiraa-optimizer-service.exe'));
      copyFileSync(built.runner, join(wixStaging, 'phase6-physical-runner.exe'));
      copyFileSync(installationPath, join(wixStaging, 'installation-manifest.json'));
      copyFileSync(`${installationPath}.p7s`, join(wixStaging, 'installation-manifest.json.p7s'));
      removeStaleBuiltMsis();
      msiBuildStartedAt = Date.now();
      run(process.execPath, [
        pnpmCli,
        '--filter',
        '@liiiraa/desktop',
        'exec',
        'tauri',
        'bundle',
        '--target',
        'x86_64-pc-windows-msvc',
        '--bundles',
        'msi',
        '--config',
        effectivePhysicalProfileJson,
      ]);
    } finally {
      rmSync(wixStaging, { recursive: true, force: true });
    }
    const emittedMsi = findBuiltMsi(msiBuildStartedAt);
    const msiPath = join(workRoot, 'liiiraa-boost.msi');
    copyFileSync(emittedMsi, msiPath);
    stripMsiCustomActions(msiPath);
    setMsiProductCode(msiPath, productCode);
    const msiInspection = inspectMsi(msiPath);
    validateMsiInspection(msiInspection, { productCode, packageVersion });
    signatures.msi = signAuthenticode(signtool, signer.thumbprint, msiPath);

    const configs = buildCanonicalRunConfigs({ operationVersionId, buildId, sourceCommit });
    for (const [stage, config] of Object.entries(configs))
      writeCreateOnce(
        join(workRoot, 'configs', `${stage}.run-config.json`),
        canonicalBytes(config),
      );
    const portableSources = {
      msi: msiPath,
      installationManifest: installationPath,
      installationManifestSignature: `${installationPath}.p7s`,
      cleanWindowsVmConfig: join(workRoot, 'configs', 'clean-windows-vm.run-config.json'),
      ownerPcConfig: join(workRoot, 'configs', 'owner-pc.run-config.json'),
      friendsPcConfig: join(workRoot, 'configs', 'friends-pc.run-config.json'),
      runner: join(workRoot, 'phase6-physical-runner.exe'),
      tauriDriver: portableDrivers.tauriDriver,
      msedgeDriver: portableDrivers.msedgeDriver,
    };
    const portableMetadata = {
      msi: {
        version: packageVersion,
        versionPolicy: 'package-version',
        signaturePolicy: 'authenticode-required',
      },
      installationManifest: {
        version: '1.0',
        versionPolicy: 'schema-version',
        signaturePolicy: 'detached-cms-required',
      },
      installationManifestSignature: {
        version: 'not-applicable',
        versionPolicy: 'not-applicable',
        signaturePolicy: 'detached-cms-required',
      },
      cleanWindowsVmConfig: {
        version: '1.0',
        versionPolicy: 'schema-version',
        signaturePolicy: 'manifest-authenticated',
      },
      ownerPcConfig: {
        version: '1.0',
        versionPolicy: 'schema-version',
        signaturePolicy: 'manifest-authenticated',
      },
      friendsPcConfig: {
        version: '1.0',
        versionPolicy: 'schema-version',
        signaturePolicy: 'manifest-authenticated',
      },
      runner: {
        version: fileVersion(portableSources.runner),
        versionPolicy: 'file-version',
        signaturePolicy: 'authenticode-required',
      },
      tauriDriver: {
        version: tauriDriverSource.version,
        versionPolicy: 'file-version',
        signaturePolicy: 'authenticode-required',
      },
      msedgeDriver: {
        version: fileVersion(portableSources.msedgeDriver),
        versionPolicy: 'file-version',
        signaturePolicy: 'authenticode-required',
      },
    };
    const manifestDocument = {
      kind: 'artifact-manifest',
      schemaVersion: '1.0',
      manifestId: `artifact-manifest-${buildId}`,
      sourceCommit,
      inputTreeHash: treeHash,
      buildId,
      operationVersionId,
      createdAt,
      files: Object.fromEntries(
        PORTABLE_ROLES.map(({ key, role, path }) => [
          key,
          portableRoleIdentity(role, path, portableSources[key], portableMetadata[key]),
        ]),
      ),
    };
    validateArtifactManifest(manifestDocument);
    const artifactBytes = canonicalBytes(manifestDocument);
    const artifactPath = join(workRoot, 'artifact-manifest.json');
    writeCreateOnce(artifactPath, artifactBytes);
    signDetachedCms(signer.thumbprint, artifactPath, `${artifactPath}.p7s`);
    const cmsEvidence = verifyDetachedCms(
      artifactPath,
      `${artifactPath}.p7s`,
      TRUSTED_INSTALLER_SPKI_SHA256,
    );
    verifyDetachedCmsEvidence(cmsEvidence);
    const downgradeMsiPath = join(workRoot, 'downgrade-probe.msi');
    copyFileSync(msiPath, downgradeMsiPath);
    setMsiIdentity(downgradeMsiPath, {
      productCode: randomUUID(),
      packageVersion: '0.0.1',
    });
    signAuthenticode(signtool, signer.thumbprint, downgradeMsiPath);
    const lifecycle = runLifecycleSmoke({
      msiPath,
      downgradeMsiPath,
      productCode: msiInspection.productCode,
      outputRoot: workRoot,
      webView2Runtime,
      installationManifestSha256: sha256(readFileSync(installationPath)),
      installationSignatureSha256: sha256(readFileSync(`${installationPath}.p7s`)),
    });
    rmSync(downgradeMsiPath, { force: true });
    writeCreateOnce(
      join(workRoot, 'lifecycle-report.json'),
      canonicalBytes({
        kind: 'phase6-physical-lifecycle',
        schemaVersion: '1.0',
        ...lifecycle,
        msiInspection,
      }),
    );
    chmodSync(workRoot, 0o555);
    mkdirSync(dirname(finalRoot), { recursive: true });
    renameSync(workRoot, finalRoot);
    process.stdout.write(
      `${JSON.stringify({ status: 'PASSED', artifactRoot: relative(ROOT, finalRoot).replaceAll('\\', '/'), sourceCommit, buildId, operationVersionId, artifactManifestSha256: sha256(artifactBytes), webView2Runtime, lifecycle }, null, 2)}\n`,
    );
  } catch (error) {
    const reportPath = writeBlockedReport(error, context);
    process.stderr.write(`BLOCKED: ${error.message}\nBLOCKED report: ${reportPath}\n`);
    process.exitCode = 1;
  }
};

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.mode === 'dry-run') dryRun(options);
    else buildAndSmoke(options);
  } catch (error) {
    process.stderr.write(`ERROR: ${error.message}\n`);
    process.exitCode = 1;
  }
}
