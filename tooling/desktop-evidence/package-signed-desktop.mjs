import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const prefix = '[package-signed-desktop]';
const workspaceRoot = resolve(import.meta.dirname, '../..');
const tauriConfigPath = resolve(workspaceRoot, 'apps/desktop/src-tauri/tauri.conf.json');
const cargoManifestPath = resolve(workspaceRoot, 'apps/desktop/src-tauri/Cargo.toml');
const defaultLocalOutput = resolve(
  workspaceRoot,
  'quality/evidence/phase-02/artifacts/signed-desktop-package.json',
);
const defaultCiOutput = resolve(
  workspaceRoot,
  'quality/evidence/phase-02/artifacts/unsigned-ci-build.json',
);
const defaultStageDirectory = resolve(workspaceRoot, 'quality/evidence/phase-02/staged');
const codeSigningEku = '1.3.6.1.5.5.7.3.3';
const certificateStore = 'Cert:\\CurrentUser\\My';
const keyProvider = 'Microsoft Software Key Storage Provider';
const certificateSubject = 'CN=Liiiraa Boost Local Development';
const forbiddenSecretFields = new Set([
  'certificate',
  'certificateBase64',
  'certificateMaterial',
  'password',
  'passphrase',
  'pfx',
  'pfxBase64',
  'pin',
  'privateKey',
  'privateKeyBase64',
  'privateKeyMaterial',
  'secret',
  'token',
]);
const forbiddenSigningEnvironment = Object.freeze([
  'AZURE_KEY_VAULT_URI',
  'PFX_PASSWORD',
  'PFX_PATH',
  'TAURI_SIGNING_PRIVATE_KEY',
  'TAURI_SIGNING_PRIVATE_KEY_PASSWORD',
  'WINDOWS_CERTIFICATE',
  'WINDOWS_CERTIFICATE_PASSWORD',
]);

const fail = (message) => {
  throw new Error(`${prefix} ${message}`);
};

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;
const isSha256 = (value) => typeof value === 'string' && /^[A-Fa-f0-9]{64}$/u.test(value);
const isThumbprint = (value) => typeof value === 'string' && /^[A-F0-9]{40,64}$/u.test(value);

const assertFalse = (record, field, label = field) => {
  if (record[field] !== false) {
    fail(`${label} must be false.`);
  }
};

const assertTrue = (record, field, label = field) => {
  if (record[field] !== true) {
    fail(`${label} must be true.`);
  }
};

const assertIsoTimestamp = (value, field) => {
  if (!isNonEmptyString(value)) {
    fail(`${field} must be an ISO timestamp.`);
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    fail(`${field} must be an ISO timestamp.`);
  }
};

const findForbiddenSecretField = (value) => {
  if (Array.isArray(value)) {
    for (const item of value) {
      const match = findForbiddenSecretField(item);
      if (match !== undefined) {
        return match;
      }
    }
    return undefined;
  }
  if (!isRecord(value)) {
    return undefined;
  }
  for (const [key, nested] of Object.entries(value)) {
    if (forbiddenSecretFields.has(key)) {
      return key;
    }
    const match = findForbiddenSecretField(nested);
    if (match !== undefined) {
      return match;
    }
  }
  return undefined;
};

const assertNoSecretMaterial = (value) => {
  const field = findForbiddenSecretField(value);
  if (field !== undefined) {
    fail(`secret-shaped field is forbidden: ${field}.`);
  }
};

const assertTimestampNotApplicable = (timestamp, label = 'timestamp') => {
  if (!isRecord(timestamp) || timestamp.state !== 'not-applicable') {
    fail(`${label} state must be not-applicable.`);
  }
  if (Object.keys(timestamp).length !== 1) {
    fail(
      `${label} cannot contain an authority or receipt without verified official free evidence.`,
    );
  }
};

export const validateDevelopmentSigningPolicy = (policy) => {
  if (!isRecord(policy)) {
    fail('development signing policy must be an object.');
  }
  if (policy.platform !== 'win32') {
    fail('local Authenticode signing is Windows-only.');
  }
  if (policy.trustClass !== 'self-signed-development') {
    fail('trustClass must be self-signed-development.');
  }
  if (policy.certificateStore !== certificateStore) {
    fail(`certificateStore must be ${certificateStore}.`);
  }
  if (policy.keyProvider !== keyProvider) {
    fail(`keyProvider must be ${keyProvider}.`);
  }
  if (policy.extendedKeyUsage !== codeSigningEku) {
    fail('extendedKeyUsage must be the code-signing EKU.');
  }
  if (policy.digestAlgorithm !== 'SHA-256') {
    fail('digestAlgorithm must be SHA-256.');
  }
  if (policy.keyExportable !== false) {
    fail('the development key must be non-exportable.');
  }
  if (policy.ciPrivateKeyAccess !== false) {
    fail('CI private-key access must remain false.');
  }
  if (policy.timestampState !== 'not-applicable') {
    fail('timestamp state must be not-applicable without verified official free evidence.');
  }
  if (policy.paidProvider !== false) {
    fail('a paid signing provider is forbidden in Phase 2.');
  }
  if (policy.pfxWorkflow !== false) {
    fail('a PFX or exported-key workflow is forbidden in Phase 2.');
  }
  if (policy.elevatedUi !== false) {
    fail('the desktop UI must remain non-elevated.');
  }
  assertFalse(policy, 'publicTrust');
  assertFalse(policy, 'smartScreenReputation');
  assertFalse(policy, 'productionReady');
  assertFalse(policy, 'distributionAllowed');
  return policy;
};

const validateSignedArtifact = (artifact, signing) => {
  if (!isRecord(artifact)) {
    fail('each local artifact must be an object.');
  }
  if (!['installer', 'executable'].includes(artifact.kind)) {
    fail('local artifact kind must be installer or executable.');
  }
  if (!isNonEmptyString(artifact.sourcePath) || !isNonEmptyString(artifact.stagedPath)) {
    fail(`${String(artifact.kind)} sourcePath and stagedPath must be present.`);
  }
  if (!Number.isInteger(artifact.sizeBytes) || artifact.sizeBytes < 1) {
    fail(`${String(artifact.kind)} sizeBytes must be a positive integer.`);
  }
  if (!isSha256(artifact.sha256) || !isSha256(artifact.stagedSha256)) {
    fail(`${String(artifact.kind)} hashes must be SHA-256 digests.`);
  }
  if (artifact.sha256.toUpperCase() !== artifact.stagedSha256.toUpperCase()) {
    fail(`${String(artifact.kind)} staged hash must match signed source hash.`);
  }
  if (!isRecord(artifact.signature)) {
    fail(`${String(artifact.kind)} signature metadata must be present.`);
  }
  if (!['Valid', 'SelfSignedUntrustedRoot'].includes(artifact.signature.status)) {
    fail(`${String(artifact.kind)} Authenticode signature must be cryptographically present.`);
  }
  if (artifact.signature.signerThumbprint !== signing.certificateThumbprint) {
    fail(`${String(artifact.kind)} signer thumbprint must match certificate thumbprint.`);
  }
  if (artifact.signature.digestAlgorithm !== 'SHA-256') {
    fail(`${String(artifact.kind)} signature digestAlgorithm must be SHA-256.`);
  }
  if (artifact.signature.chainClass !== 'self-signed-untrusted-root') {
    fail(`${String(artifact.kind)} chainClass must be self-signed-untrusted-root.`);
  }
  assertTimestampNotApplicable(artifact.signature.timestamp, `${String(artifact.kind)} timestamp`);
};

const validateLocalDevelopmentEvidence = (record) => {
  if (record.evidenceKind !== 'desktop-signed-artifact') {
    fail('local evidenceKind must be desktop-signed-artifact.');
  }
  if (record.artifactClass !== 'self-signed-development') {
    fail('local artifactClass must be self-signed-development.');
  }
  assertIsoTimestamp(record.generatedAt, 'generatedAt');
  if (!isRecord(record.build)) {
    fail('local build metadata must be present.');
  }
  if (
    record.build.productName !== 'Liiiraa Boost' ||
    !isNonEmptyString(record.build.version) ||
    record.build.identifier !== 'com.liiiraa.boost' ||
    record.build.target !== 'x86_64-pc-windows-msvc'
  ) {
    fail('local build identity must match the pinned Tauri application.');
  }
  assertFalse(record.build, 'elevatedUi', 'build elevatedUi');
  if (!isRecord(record.signing)) {
    fail('local signing metadata must be present.');
  }
  validateDevelopmentSigningPolicy({
    platform: 'win32',
    trustClass: record.signing.trustClass,
    certificateStore: record.signing.certificateStore,
    keyProvider: record.signing.keyProvider,
    extendedKeyUsage: record.signing.extendedKeyUsage,
    digestAlgorithm: record.signing.digestAlgorithm,
    keyExportable: record.signing.keyCustody?.exportable,
    ciPrivateKeyAccess: record.signing.keyCustody?.ciPrivateKeyAccess,
    timestampState: record.signing.timestamp?.state,
    paidProvider: false,
    pfxWorkflow: false,
    elevatedUi: record.build.elevatedUi,
    publicTrust: record.signing.publicTrust,
    smartScreenReputation: record.signing.smartScreenReputation,
    productionReady: record.signing.productionReady,
    distributionAllowed: record.signing.distributionAllowed,
  });
  if (
    !isRecord(record.signing.keyCustody) ||
    record.signing.keyCustody.scope !== 'current-user' ||
    record.signing.keyCustody.technology !== 'CNG'
  ) {
    fail('key custody must remain current-user CNG.');
  }
  if (!isThumbprint(record.signing.certificateThumbprint)) {
    fail('certificateThumbprint must be a non-secret uppercase hexadecimal thumbprint.');
  }
  assertTimestampNotApplicable(record.signing.timestamp);
  if (record.signing.productionSigningDeferredTo !== 'Phase 10') {
    fail('production signing must remain deferred to Phase 10.');
  }
  if (!Array.isArray(record.artifacts) || record.artifacts.length !== 2) {
    fail('local evidence must contain exactly two signed artifacts.');
  }
  const artifactKinds = record.artifacts.map(({ kind }) => kind).sort();
  if (artifactKinds.join(',') !== 'executable,installer') {
    fail('local evidence must contain one installer and one executable.');
  }
  const artifactPaths = record.artifacts.flatMap(({ sourcePath, stagedPath }) => [
    sourcePath,
    stagedPath,
  ]);
  if (new Set(artifactPaths).size !== artifactPaths.length) {
    fail('artifact paths must be unique.');
  }
  for (const artifact of record.artifacts) {
    validateSignedArtifact(artifact, record.signing);
  }
  if (!isRecord(record.staging)) {
    fail('local staging metadata must be present.');
  }
  assertTrue(record.staging, 'allowed', 'local staging allowed');
  assertFalse(record.staging, 'published', 'local staging published');
  assertFalse(record.staging, 'promoted', 'local staging promoted');
  assertFalse(record.staging, 'releaseReady', 'local staging releaseReady');
};

const validateUnsignedCiEvidence = (record) => {
  if (record.evidenceKind !== 'desktop-unsigned-ci-build') {
    fail('unsigned CI evidenceKind must be desktop-unsigned-ci-build.');
  }
  if (record.artifactClass !== 'unsigned-ci') {
    fail('unsigned CI artifactClass must be unsigned-ci.');
  }
  assertIsoTimestamp(record.generatedAt, 'generatedAt');
  if (!isRecord(record.ci)) {
    fail('unsigned CI policy must be present.');
  }
  for (const field of [
    'privateKeyAccess',
    'signed',
    'stagingAllowed',
    'publishingAllowed',
    'promotionAllowed',
    'releaseReady',
    'productionReady',
    'distributionAllowed',
  ]) {
    assertFalse(record.ci, field);
  }
  if (!Array.isArray(record.artifacts) || record.artifacts.length !== 2) {
    fail('unsigned CI evidence must contain exactly two artifacts.');
  }
  const artifactKinds = record.artifacts.map(({ kind }) => kind).sort();
  if (artifactKinds.join(',') !== 'executable,installer') {
    fail('unsigned CI evidence must contain one installer and one executable.');
  }
  for (const artifact of record.artifacts) {
    if (
      !isRecord(artifact) ||
      !isNonEmptyString(artifact.path) ||
      artifact.signatureStatus !== 'NotSigned' ||
      !isSha256(artifact.sha256) ||
      !Number.isInteger(artifact.sizeBytes) ||
      artifact.sizeBytes < 1
    ) {
      fail('unsigned CI artifact metadata must prove an unsigned hashed build output.');
    }
  }
  if (
    !Array.isArray(record.labels) ||
    record.labels.join(',') !== 'development-only,unsigned,non-promotable'
  ) {
    fail('unsigned CI labels must be exactly development-only, unsigned, non-promotable.');
  }
};

export const validateArtifactEvidence = (record) => {
  if (!isRecord(record) || record.schemaVersion !== '1.0') {
    fail('artifact evidence must be a schemaVersion 1.0 object.');
  }
  assertNoSecretMaterial(record);
  if (record.artifactClass === 'self-signed-development') {
    validateLocalDevelopmentEvidence(record);
  } else if (record.artifactClass === 'unsigned-ci') {
    validateUnsignedCiEvidence(record);
  } else {
    fail('artifactClass must be self-signed-development or unsigned-ci.');
  }
  return record;
};

const readJsonObject = (path, label) => {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return fail(`${label} is not readable JSON: ${detail}`);
  }
  return isRecord(parsed) ? parsed : fail(`${label} must be a JSON object.`);
};

const readPinnedBuildIdentity = () => {
  const config = readJsonObject(tauriConfigPath, 'Tauri configuration');
  const cargoManifest = readFileSync(cargoManifestPath, 'utf8');
  const binaryMatch = cargoManifest.match(/\[\[bin\]\][\s\S]*?\bname\s*=\s*"([^"]+)"/u);
  if (binaryMatch === null) {
    fail('Cargo manifest must define the pinned desktop binary.');
  }
  if (
    config.productName !== 'Liiiraa Boost' ||
    config.identifier !== 'com.liiiraa.boost' ||
    !isNonEmptyString(config.version)
  ) {
    fail('Tauri application identity is not pinned to Liiiraa Boost.');
  }
  if (
    config.bundle?.active !== true ||
    !Array.isArray(config.bundle.targets) ||
    config.bundle.targets.join(',') !== 'nsis'
  ) {
    fail('Tauri bundle must target exactly NSIS.');
  }
  if (
    config.bundle.windows?.digestAlgorithm !== 'sha256' ||
    config.bundle.windows?.timestampUrl !== null ||
    config.bundle.windows?.certificateThumbprint !== null
  ) {
    fail(
      'tracked Tauri config must keep SHA-256 and contain no certificate or timestamp identity.',
    );
  }
  if (config.bundle.windows?.nsis?.installMode !== 'currentUser') {
    fail('Tauri NSIS installMode must remain currentUser.');
  }
  const serialized = JSON.stringify(config);
  if (/requireAdministrator|highestAvailable/iu.test(serialized)) {
    fail('the pinned Tauri configuration must keep the desktop UI non-elevated.');
  }
  const signing = config.plugins?.['liiiraa-shell']?.identity?.signing;
  if (
    signing?.class !== 'self-signed-development' ||
    signing?.timestamp !== 'not-applicable' ||
    signing?.publicTrust !== false ||
    signing?.smartScreenReputation !== false ||
    signing?.productionReady !== false ||
    signing?.distributionAllowed !== false
  ) {
    fail('Tauri development signing identity must preserve all false public-release claims.');
  }
  return {
    config,
    binaryName: binaryMatch[1],
  };
};

const expectedArtifacts = (identity) => {
  const releaseDirectory = resolve(workspaceRoot, 'target/release');
  return [
    {
      kind: 'installer',
      path: resolve(
        releaseDirectory,
        'bundle/nsis',
        `${identity.config.productName}_${identity.config.version}_x64-setup.exe`,
      ),
    },
    {
      kind: 'executable',
      path: resolve(releaseDirectory, `${identity.binaryName}.exe`),
    },
  ];
};

const developmentPolicy = (platform = process.platform) => ({
  platform,
  trustClass: 'self-signed-development',
  certificateStore,
  keyProvider,
  extendedKeyUsage: codeSigningEku,
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
});

const assertNoSigningSecretsInEnvironment = () => {
  const found = forbiddenSigningEnvironment.filter((name) => isNonEmptyString(process.env[name]));
  if (found.length > 0) {
    fail(`secret or paid-provider signing environment is forbidden: ${found.join(', ')}.`);
  }
};

const parseArguments = (arguments_) => {
  const modes = [
    ['--dry-run', 'dry-run'],
    ['--execute-local-development', 'local-development'],
    ['--ci-unsigned', 'ci-unsigned'],
  ].filter(([flag]) => arguments_.includes(flag));
  if (modes.length !== 1) {
    fail('exactly one mode is required: --dry-run, --execute-local-development, or --ci-unsigned.');
  }
  const values = new Map();
  const valueOptions = new Set(['--output', '--environment', '--stage-directory']);
  const allowed = new Set([
    '--dry-run',
    '--execute-local-development',
    '--ci-unsigned',
    ...valueOptions,
  ]);
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (!allowed.has(argument)) {
      fail(`unsupported argument: ${String(argument)}.`);
    }
    if (valueOptions.has(argument)) {
      const value = arguments_[index + 1];
      if (value === undefined || value.startsWith('--')) {
        fail(`${argument} requires a path.`);
      }
      values.set(argument, resolve(workspaceRoot, value));
      index += 1;
    }
  }
  return {
    kind: modes[0][1],
    output: values.get('--output'),
    environment: values.get('--environment'),
    stageDirectory: values.get('--stage-directory'),
  };
};

const workspaceRelative = (path) => {
  const relativePath = relative(workspaceRoot, path);
  return relativePath.startsWith('..') ? path : relativePath.replaceAll('\\', '/');
};

const dryRun = (options) => {
  const identity = readPinnedBuildIdentity();
  const policy = developmentPolicy();
  validateDevelopmentSigningPolicy(policy);
  assertNoSigningSecretsInEnvironment();
  return {
    mode: 'dry-run',
    sideEffects: false,
    cost: 'zero',
    outputRequested: options.output === undefined ? null : workspaceRelative(options.output),
    policy,
    expectedArtifacts: expectedArtifacts(identity).map(({ kind, path }) => ({
      kind,
      path: workspaceRelative(path),
    })),
    commandsPlanned: [
      'New-SelfSignedCertificate (CurrentUser CNG, non-exportable, code-signing EKU)',
      'pnpm --filter @liiiraa/desktop exec tauri build',
      'Set-AuthenticodeSignature -HashAlgorithm SHA256 (no timestamp server)',
      'Get-AuthenticodeSignature and staged SHA-256 verification',
    ],
  };
};

const runCommand = (command, arguments_, label) => {
  const result = spawnSync(command, arguments_, {
    cwd: workspaceRoot,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error !== undefined || result.status !== 0) {
    const detail = [result.error?.message, result.stderr, result.stdout]
      .filter(isNonEmptyString)
      .join('\n')
      .trim();
    fail(`${label} failed${detail.length > 0 ? `: ${detail}` : '.'}`);
  }
  return result.stdout;
};

const quotePowerShell = (value) => `'${String(value).replaceAll("'", "''")}'`;

const runPowerShellJson = (script, label) => {
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  const stdout = runCommand(
    'powershell.exe',
    ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', encoded],
    label,
  );
  try {
    return JSON.parse(stdout.trim());
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return fail(`${label} returned invalid JSON: ${detail}`);
  }
};

const ensureDevelopmentCertificate = () => {
  const script = `
$ErrorActionPreference = 'Stop'
$subject = ${quotePowerShell(certificateSubject)}
$eku = ${quotePowerShell(codeSigningEku)}
$cert = Get-ChildItem -Path Cert:\\CurrentUser\\My |
  Where-Object {
    $_.Subject -eq $subject -and
    $_.HasPrivateKey -and
    $_.NotAfter -gt (Get-Date).AddDays(30) -and
    (($_.EnhancedKeyUsageList | ForEach-Object { [string]$_.ObjectId }) -contains $eku)
  } |
  Sort-Object NotAfter -Descending |
  Select-Object -First 1
if ($null -eq $cert) {
  $cert = New-SelfSignedCertificate \
    -Type CodeSigningCert \
    -Subject $subject \
    -KeyAlgorithm RSA \
    -KeyLength 3072 \
    -HashAlgorithm SHA256 \
    -CertStoreLocation 'Cert:\\CurrentUser\\My' \
    -Provider ${quotePowerShell(keyProvider)} \
    -KeyExportPolicy NonExportable \
    -NotAfter (Get-Date).AddYears(2)
}
$actualEkus = @($cert.EnhancedKeyUsageList | ForEach-Object { [string]$_.ObjectId })
if ($actualEkus -notcontains $eku) {
  throw 'The certificate does not carry the code-signing EKU.'
}
$rsa = [System.Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPrivateKey($cert)
if ($rsa -isnot [System.Security.Cryptography.RSACng]) {
  throw 'The certificate private key is not backed by CNG.'
}
$providerName = $rsa.Key.Provider.Provider
$exportable = ([string]$rsa.Key.ExportPolicy) -match 'AllowExport'
[pscustomobject]@{
  thumbprint = $cert.Thumbprint.ToUpperInvariant()
  subject = $cert.Subject
  notAfter = $cert.NotAfter.ToUniversalTime().ToString('o')
  provider = $providerName
  exportable = [bool]$exportable
  hasPrivateKey = [bool]$cert.HasPrivateKey
  eku = $eku
} | ConvertTo-Json -Compress
`;
  const certificate = runPowerShellJson(script, 'development certificate creation');
  if (
    !isThumbprint(certificate.thumbprint) ||
    certificate.provider !== keyProvider ||
    certificate.exportable !== false ||
    certificate.hasPrivateKey !== true ||
    certificate.eku !== codeSigningEku
  ) {
    fail('created certificate does not satisfy the CurrentUser non-exportable CNG contract.');
  }
  return certificate;
};

const buildDesktop = () => {
  const pnpmArguments = ['--filter', '@liiiraa/desktop', 'exec', 'tauri', 'build'];
  if (process.platform === 'win32') {
    runCommand(
      process.env.ComSpec ?? 'cmd.exe',
      ['/d', '/c', 'pnpm.cmd', ...pnpmArguments],
      'pinned Tauri desktop build',
    );
    return;
  }
  runCommand('pnpm', pnpmArguments, 'pinned Tauri desktop build');
};

const inspectAuthenticode = (path) => {
  const script = `
$ErrorActionPreference = 'Stop'
$signature = Get-AuthenticodeSignature -LiteralPath ${quotePowerShell(path)}
[pscustomobject]@{
  status = [string]$signature.Status
  statusMessage = [string]$signature.StatusMessage
  signatureType = [string]$signature.SignatureType
  signerThumbprint = if ($null -eq $signature.SignerCertificate) { $null } else { $signature.SignerCertificate.Thumbprint.ToUpperInvariant() }
} | ConvertTo-Json -Compress
`;
  return runPowerShellJson(script, `Authenticode inspection for ${basename(path)}`);
};

const normalizedSignatureStatus = (inspection) => {
  if (inspection.status === 'Valid') {
    return 'Valid';
  }
  if (
    inspection.status === 'UnknownError' &&
    /root|chain|trust|trusted|confi|raiz/iu.test(inspection.statusMessage)
  ) {
    return 'SelfSignedUntrustedRoot';
  }
  fail(
    `Authenticode signature is not valid development evidence: ${String(inspection.status)} ${String(inspection.statusMessage)}.`,
  );
};

const signArtifact = (path, thumbprint) => {
  const script = `
$ErrorActionPreference = 'Stop'
$cert = Get-Item -LiteralPath ${quotePowerShell(`${certificateStore}\\${thumbprint}`)}
$null = Set-AuthenticodeSignature \
  -LiteralPath ${quotePowerShell(path)} \
  -Certificate $cert \
  -HashAlgorithm SHA256
$signature = Get-AuthenticodeSignature -LiteralPath ${quotePowerShell(path)}
[pscustomobject]@{
  status = [string]$signature.Status
  statusMessage = [string]$signature.StatusMessage
  signatureType = [string]$signature.SignatureType
  signerThumbprint = if ($null -eq $signature.SignerCertificate) { $null } else { $signature.SignerCertificate.Thumbprint.ToUpperInvariant() }
} | ConvertTo-Json -Compress
`;
  const inspection = runPowerShellJson(script, `Authenticode signing for ${basename(path)}`);
  const status = normalizedSignatureStatus(inspection);
  if (inspection.signatureType !== 'Authenticode' || inspection.signerThumbprint !== thumbprint) {
    fail(`Authenticode signer identity mismatch for ${basename(path)}.`);
  }
  return {
    status,
    signerThumbprint: thumbprint,
    digestAlgorithm: 'SHA-256',
    chainClass: 'self-signed-untrusted-root',
    timestamp: {
      state: 'not-applicable',
    },
  };
};

const sha256File = (path) =>
  createHash('sha256').update(readFileSync(path)).digest('hex').toUpperCase();

const assertTamperRejected = (path) => {
  const directory = mkdtempSync(join(tmpdir(), 'liiiraa-authenticode-tamper-'));
  const tamperedPath = join(directory, basename(path));
  try {
    copyFileSync(path, tamperedPath);
    const bytes = readFileSync(tamperedPath);
    if (bytes.length < 3) {
      fail(`tamper check input is unexpectedly short for ${basename(path)}.`);
    }
    bytes[2] ^= 1;
    writeFileSync(tamperedPath, bytes);
    const inspection = inspectAuthenticode(tamperedPath);
    if (inspection.status !== 'HashMismatch') {
      fail(`tamper check was not rejected for ${basename(path)}.`);
    }
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
};

const requireBuildArtifacts = (identity) => {
  const artifacts = expectedArtifacts(identity);
  for (const artifact of artifacts) {
    if (!existsSync(artifact.path) || !statSync(artifact.path).isFile()) {
      fail(
        `expected ${artifact.kind} build output is missing: ${workspaceRelative(artifact.path)}.`,
      );
    }
  }
  return artifacts;
};

const removeExpectedBuildArtifacts = (identity) => {
  for (const artifact of expectedArtifacts(identity)) {
    rmSync(artifact.path, { force: true });
  }
};

const cleanUnsignedCiBuildArtifacts = () => {
  runCommand(
    'cargo',
    ['clean', '--manifest-path', cargoManifestPath],
    'clean unsigned CI workspace build artifacts',
  );
};

const writeJson = (path, value) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, undefined, 2)}\n`, 'utf8');
};

const signingAccessRecord = (certificate, evidencePath) => ({
  schemaVersion: '1.0',
  evidenceKind: 'desktop-packaged-environment-record',
  recordType: 'development-signing',
  id: 'local-development-signing',
  status: 'reviewed',
  trustClass: 'self-signed-development',
  certificateStore,
  certificateThumbprint: certificate.thumbprint,
  extendedKeyUsage: codeSigningEku,
  digestAlgorithm: 'SHA-256',
  keyProvider,
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
  provenance: {
    kind: 'local-windows-certificate-store-inspection',
    source: certificateStore,
  },
  observer: 'package-signed-desktop.mjs',
  reviewedAt: new Date().toISOString(),
  evidencePath: workspaceRelative(evidencePath),
});

const executeLocalDevelopment = (options) => {
  validateDevelopmentSigningPolicy(developmentPolicy());
  assertNoSigningSecretsInEnvironment();
  if (options.environment === undefined) {
    fail('--execute-local-development requires --environment <directory>.');
  }
  const output = options.output ?? defaultLocalOutput;
  if (basename(output) !== 'signed-desktop-package.json') {
    fail('local development record must use signed-desktop-package.json.');
  }
  const identity = readPinnedBuildIdentity();
  const certificate = ensureDevelopmentCertificate();
  buildDesktop();
  const buildArtifacts = requireBuildArtifacts(identity);
  const stageDirectory = options.stageDirectory ?? defaultStageDirectory;
  mkdirSync(stageDirectory, { recursive: true });
  const artifacts = buildArtifacts.map((artifact) => {
    const signature = signArtifact(artifact.path, certificate.thumbprint);
    assertTamperRejected(artifact.path);
    const sourceHash = sha256File(artifact.path);
    const stagedPath = resolve(stageDirectory, basename(artifact.path));
    if (stagedPath === artifact.path) {
      fail('staged path must differ from the build output path.');
    }
    copyFileSync(artifact.path, stagedPath);
    const stagedHash = sha256File(stagedPath);
    if (stagedHash !== sourceHash) {
      fail(`staged hash drift detected for ${artifact.kind}.`);
    }
    const stagedInspection = inspectAuthenticode(stagedPath);
    const stagedStatus = normalizedSignatureStatus(stagedInspection);
    if (
      stagedStatus !== signature.status ||
      stagedInspection.signerThumbprint !== certificate.thumbprint
    ) {
      fail(`staged Authenticode identity drift detected for ${artifact.kind}.`);
    }
    return {
      kind: artifact.kind,
      sourcePath: workspaceRelative(artifact.path),
      stagedPath: workspaceRelative(stagedPath),
      sizeBytes: statSync(stagedPath).size,
      sha256: sourceHash,
      stagedSha256: stagedHash,
      signature,
    };
  });
  const evidence = {
    schemaVersion: '1.0',
    evidenceKind: 'desktop-signed-artifact',
    artifactClass: 'self-signed-development',
    generatedAt: new Date().toISOString(),
    build: {
      productName: identity.config.productName,
      version: identity.config.version,
      identifier: identity.config.identifier,
      target: 'x86_64-pc-windows-msvc',
      elevatedUi: false,
    },
    signing: {
      trustClass: 'self-signed-development',
      certificateStore,
      certificateThumbprint: certificate.thumbprint,
      extendedKeyUsage: codeSigningEku,
      digestAlgorithm: 'SHA-256',
      keyProvider,
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
    artifacts,
    staging: {
      allowed: true,
      published: false,
      promoted: false,
      releaseReady: false,
    },
  };
  validateArtifactEvidence(evidence);
  writeJson(output, evidence);
  const signingAccessPath = resolve(options.environment, 'signing-access.json');
  const accessRecord = signingAccessRecord(certificate, output);
  assertNoSecretMaterial(accessRecord);
  writeJson(signingAccessPath, accessRecord);
  return {
    mode: 'execute-local-development',
    cost: 'zero',
    output: workspaceRelative(output),
    signingAccess: workspaceRelative(signingAccessPath),
    stagedArtifacts: artifacts.map(({ stagedPath }) => stagedPath),
    publicTrust: false,
    smartScreenReputation: false,
    productionReady: false,
    distributionAllowed: false,
  };
};

const executeUnsignedCi = (options) => {
  const output = options.output ?? defaultCiOutput;
  if (basename(output) !== 'unsigned-ci-build.json') {
    fail('unsigned CI record must use unsigned-ci-build.json.');
  }
  if (process.platform !== 'win32') {
    fail('--ci-unsigned requires a Windows runner.');
  }
  assertNoSigningSecretsInEnvironment();
  const identity = readPinnedBuildIdentity();
  cleanUnsignedCiBuildArtifacts();
  removeExpectedBuildArtifacts(identity);
  buildDesktop();
  const artifacts = requireBuildArtifacts(identity).map((artifact) => {
    const inspection = inspectAuthenticode(artifact.path);
    if (inspection.status !== 'NotSigned' || inspection.signerThumbprint !== null) {
      fail(`CI artifact must remain unsigned: ${workspaceRelative(artifact.path)}.`);
    }
    return {
      kind: artifact.kind,
      path: workspaceRelative(artifact.path),
      signatureStatus: 'NotSigned',
      sha256: sha256File(artifact.path),
      sizeBytes: statSync(artifact.path).size,
    };
  });
  const evidence = {
    schemaVersion: '1.0',
    evidenceKind: 'desktop-unsigned-ci-build',
    artifactClass: 'unsigned-ci',
    generatedAt: new Date().toISOString(),
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
    artifacts,
    labels: ['development-only', 'unsigned', 'non-promotable'],
  };
  validateArtifactEvidence(evidence);
  writeJson(output, evidence);
  return {
    mode: 'ci-unsigned',
    output: workspaceRelative(output),
    signed: false,
    stagingAllowed: false,
    promotionAllowed: false,
    releaseReady: false,
  };
};

const main = () => {
  try {
    const options = parseArguments(process.argv.slice(2));
    const report =
      options.kind === 'dry-run'
        ? dryRun(options)
        : options.kind === 'local-development'
          ? executeLocalDevelopment(options)
          : executeUnsignedCi(options);
    process.stdout.write(`${JSON.stringify(report, undefined, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
};

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
