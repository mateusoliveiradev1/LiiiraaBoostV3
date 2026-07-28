import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';

const prefix = '[packaged-wave-zero]';

const requiredManualIds = Object.freeze([
  'authenticode',
  'non-elevation',
  'startup',
  'single-instance',
  'tray',
  'deep-link',
  'startup-timing',
  'working-set',
  'nvda',
  'forced-colors',
  'scale',
]);

const forbiddenSecretFields = new Set([
  'certificate',
  'certificateBase64',
  'certificateMaterial',
  'password',
  'passphrase',
  'pfx',
  'pfxBase64',
  'privateKey',
  'privateKeyBase64',
  'privateKeyMaterial',
  'secret',
]);

const fail = (message) => {
  throw new Error(`${prefix} ${message}`);
};

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

const nonEmptyReviewedValue = (value) =>
  typeof value === 'string' && value.trim().length > 0 && value !== 'unresolved';

const isIsoTimestamp = (value) => {
  if (!nonEmptyReviewedValue(value)) {
    return false;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
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

const optionValue = (arguments_, option) => {
  const index = arguments_.indexOf(option);
  if (index === -1) {
    return undefined;
  }
  const value = arguments_[index + 1];
  return value === undefined || value.startsWith('--') ? fail(`${option} requires a path.`) : value;
};

const assertOnlyArguments = (arguments_, allowed) => {
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (!allowed.has(argument)) {
      fail(`unsupported argument: ${String(argument)}`);
    }
    if (argument === '--environment' || argument === '--manual') {
      index += 1;
      if (arguments_[index] === undefined) {
        fail(`${argument} requires a path.`);
      }
    }
  }
};

const detectMode = (arguments_) => {
  const environmentPath = optionValue(arguments_, '--environment');
  const manualPath = optionValue(arguments_, '--manual');
  const requireReviewed = arguments_.includes('--require-reviewed');
  const requireObserved = arguments_.includes('--require-observed');
  const dryRun = arguments_.includes('--dry-run');

  if (environmentPath !== undefined) {
    if (!requireReviewed) {
      fail('--environment requires --require-reviewed.');
    }
    if (manualPath !== undefined || requireObserved || dryRun) {
      fail('reviewed environment mode cannot be combined with another mode.');
    }
    assertOnlyArguments(arguments_, new Set(['--environment', '--require-reviewed']));
    return { kind: 'environment', path: resolve(environmentPath) };
  }

  if (manualPath !== undefined) {
    if (!requireObserved) {
      fail('--manual requires --require-observed.');
    }
    if (requireReviewed || dryRun) {
      fail('observed manual mode cannot be combined with another mode.');
    }
    assertOnlyArguments(arguments_, new Set(['--manual', '--require-observed']));
    return { kind: 'manual', path: resolve(manualPath) };
  }

  if (requireReviewed || requireObserved) {
    fail('a reviewed or observed gate requires its evidence path.');
  }
  assertOnlyArguments(arguments_, new Set(['--dry-run']));
  return { kind: 'dry-run' };
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
  for (const [key, nestedValue] of Object.entries(value)) {
    if (forbiddenSecretFields.has(key)) {
      return key;
    }
    const match = findForbiddenSecretField(nestedValue);
    if (match !== undefined) {
      return match;
    }
  }
  return undefined;
};

const assertPackagedProvenance = (record, label, timestampField) => {
  if (record.status !== (timestampField === 'reviewedAt' ? 'reviewed' : 'observed')) {
    fail(`${label} status must be ${timestampField === 'reviewedAt' ? 'reviewed' : 'observed'}.`);
  }
  if (!isRecord(record.provenance)) {
    fail(`${label} provenance must be present.`);
  }
  const provenanceKind = record.provenance.kind;
  if (
    typeof provenanceKind === 'string' &&
    provenanceKind.toLocaleLowerCase('en').includes('browser')
  ) {
    fail('browser evidence cannot substitute for packaged evidence.');
  }
  if (!nonEmptyReviewedValue(provenanceKind) || !nonEmptyReviewedValue(record.provenance.source)) {
    fail(`${label} provenance kind and source must be non-empty.`);
  }
  if (!nonEmptyReviewedValue(record.observer)) {
    fail(`${label} observer must be present.`);
  }
  if (!isIsoTimestamp(record[timestampField])) {
    fail(`${label} ${timestampField} must be an ISO timestamp.`);
  }
};

const assertWindowsImage = (record, release) => {
  const label = `windows-${release}`;
  assertPackagedProvenance(record, label, 'reviewedAt');
  if (!isRecord(record.windows)) {
    fail(`${label} windows metadata must be present.`);
  }
  if (record.windows.family !== 'Windows' || record.windows.release !== release) {
    fail(`${label} must identify Windows ${release}.`);
  }
  for (const field of ['edition', 'build']) {
    if (!nonEmptyReviewedValue(record.windows[field])) {
      fail(`${label} ${field} must be a non-empty reviewed value.`);
    }
  }
  if (record.windows.architecture !== 'x64') {
    fail(`${label} architecture must be x64.`);
  }
  for (const field of ['imageIdentity', 'runnerIdentity', 'evidencePath']) {
    if (!nonEmptyReviewedValue(record[field])) {
      fail(`${label} ${field} must be a non-empty reviewed value.`);
    }
  }
  if (
    !isRecord(record.webView2) ||
    record.webView2.status !== 'available' ||
    !nonEmptyReviewedValue(record.webView2.version)
  ) {
    fail(`${label} WebView2 metadata must identify an available reviewed version.`);
  }
  if (record.developmentSigningAccess !== 'current-user-local-only') {
    fail(`${label} developmentSigningAccess must be current-user-local-only.`);
  }
};

const assertFalse = (record, field, diagnostic) => {
  if (record[field] !== false) {
    fail(diagnostic);
  }
};

const assertDevelopmentSigning = (record) => {
  const label = 'development signing';
  assertPackagedProvenance(record, label, 'reviewedAt');
  if (record.trustClass !== 'self-signed-development') {
    fail('development signing trustClass must be self-signed-development.');
  }
  if (record.certificateStore !== 'Cert:\\CurrentUser\\My') {
    fail('development signing certificateStore must be Cert:\\CurrentUser\\My.');
  }
  if (
    typeof record.certificateThumbprint !== 'string' ||
    !/^[A-F0-9]{40,64}$/u.test(record.certificateThumbprint)
  ) {
    fail('development signing certificateThumbprint must be a non-secret hexadecimal thumbprint.');
  }
  if (record.extendedKeyUsage !== '1.3.6.1.5.5.7.3.3') {
    fail('development signing extendedKeyUsage must be the code-signing EKU.');
  }
  if (record.digestAlgorithm !== 'SHA-256') {
    fail('development signing digestAlgorithm must be SHA-256.');
  }
  if (record.keyProvider !== 'Microsoft Software Key Storage Provider') {
    fail('development signing keyProvider must be Microsoft Software Key Storage Provider.');
  }
  if (
    !isRecord(record.keyCustody) ||
    record.keyCustody.scope !== 'current-user' ||
    record.keyCustody.technology !== 'CNG'
  ) {
    fail('development signing key custody must be current-user CNG.');
  }
  if (record.keyCustody.exportable !== false) {
    fail('development signing key must be non-exportable.');
  }
  if (record.keyCustody.ciPrivateKeyAccess !== false) {
    fail('CI private-key access must remain false.');
  }
  assertFalse(record, 'publicTrust', 'development signing publicTrust must be false.');
  assertFalse(
    record,
    'smartScreenReputation',
    'development signing smartScreenReputation must be false.',
  );
  assertFalse(record, 'productionReady', 'development signing productionReady must be false.');
  assertFalse(
    record,
    'distributionAllowed',
    'development signing distributionAllowed must be false.',
  );
  if (record.productionSigningDeferredTo !== 'Phase 10') {
    fail('development signing production trust must remain deferred to Phase 10.');
  }
  if (!nonEmptyReviewedValue(record.evidencePath)) {
    fail('development signing evidencePath must be a non-empty reviewed value.');
  }
  if (!isRecord(record.timestamp)) {
    fail('development signing timestamp metadata must be present.');
  }
  if (record.timestamp.state === 'not-applicable') {
    return;
  }
  if (record.timestamp.state === 'verified-official-free') {
    if (
      !nonEmptyReviewedValue(record.timestamp.authority) ||
      !nonEmptyReviewedValue(record.timestamp.evidencePath)
    ) {
      fail('verified official-free timestamp requires authority and evidencePath.');
    }
    return;
  }
  fail('development signing timestamp state is invalid.');
};

const requireRecord = (records, recordType, id, label) => {
  const matches = records.filter((record) => record.recordType === recordType && record.id === id);
  if (matches.length !== 1) {
    fail(`exactly one ${label} record is required.`);
  }
  return matches[0];
};

const validateEnvironment = (path) => {
  const document = readJsonObject(path, 'environment evidence');
  const secretField = findForbiddenSecretField(document);
  if (secretField !== undefined) {
    fail(`secret-shaped field is forbidden: ${secretField}.`);
  }
  if (
    document.schemaVersion !== '1.0' ||
    document.evidenceKind !== 'desktop-packaged-environment' ||
    !Array.isArray(document.records) ||
    !document.records.every(isRecord)
  ) {
    fail('environment evidence must use desktop-packaged-environment schemaVersion 1.0.');
  }
  const records = document.records;
  if (records.length > 3) {
    fail('exactly three environment records are required.');
  }
  const windows10 = requireRecord(records, 'windows-image', 'windows-10', 'Windows 10 image');
  const windows11 = requireRecord(records, 'windows-image', 'windows-11', 'Windows 11 image');
  const signing = requireRecord(
    records,
    'development-signing',
    'local-development-signing',
    'local development-signing',
  );
  if (records.length !== 3) {
    fail('exactly three environment records are required.');
  }

  assertWindowsImage(windows10, '10');
  assertWindowsImage(windows11, '11');
  assertDevelopmentSigning(signing);

  return {
    mode: 'reviewed-environment',
    acceptance: 'reviewed',
    packagedAcceptance: false,
    observationsCreated: false,
    recordIds: ['windows-10', 'windows-11', 'local-development-signing'],
  };
};

const assertContainedAttachment = (manualPath, recordId, attachment) => {
  if (!nonEmptyReviewedValue(attachment)) {
    fail(`${recordId} attachment reference must be non-empty.`);
  }
  const evidenceDirectory = dirname(manualPath);
  const attachmentPath = resolve(evidenceDirectory, attachment);
  const relativePath = relative(evidenceDirectory, attachmentPath);
  if (relativePath.length === 0 || relativePath.startsWith('..') || isAbsolute(relativePath)) {
    fail(`${recordId} attachment must stay beside the manual evidence file.`);
  }
  if (!existsSync(attachmentPath) || !statSync(attachmentPath).isFile()) {
    fail(`${recordId} attachment is not reachable: ${attachment}.`);
  }
};

const validateManual = (path) => {
  const document = readJsonObject(path, 'manual evidence');
  const secretField = findForbiddenSecretField(document);
  if (secretField !== undefined) {
    fail(`secret-shaped field is forbidden: ${secretField}.`);
  }
  if (
    document.schemaVersion !== '1.0' ||
    document.evidenceKind !== 'desktop-packaged-manual-observations' ||
    !Array.isArray(document.records) ||
    !document.records.every(isRecord)
  ) {
    fail('manual evidence must use desktop-packaged-manual-observations schemaVersion 1.0.');
  }
  const records = document.records;
  if (records.length !== requiredManualIds.length) {
    fail(`exactly ${String(requiredManualIds.length)} manual observation records are required.`);
  }

  const orderedRecords = requiredManualIds.map((id) =>
    requireRecord(records, 'manual-observation', id, `${id} manual observation`),
  );
  for (const record of orderedRecords) {
    assertPackagedProvenance(record, record.id, 'observedAt');
    if (!Array.isArray(record.attachments) || record.attachments.length === 0) {
      fail(`${record.id} must reference at least one attachment.`);
    }
    for (const attachment of record.attachments) {
      assertContainedAttachment(path, record.id, attachment);
    }
  }

  return {
    mode: 'observed-manual',
    acceptance: 'observed',
    packagedAcceptance: true,
    observationsCreated: false,
    recordIds: [...requiredManualIds],
  };
};

const dryRunReport = () => ({
  mode: 'dry-run',
  acceptance: 'planned',
  packagedAcceptance: false,
  observationsCreated: false,
  prerequisites: [
    'reviewed Windows 10 packaged image',
    'reviewed Windows 11 packaged image',
    'reviewed local development signing',
    'observed NVDA evidence',
    'observed forced colors evidence',
    'observed scale evidence',
  ],
});

try {
  const mode = detectMode(process.argv.slice(2));
  const report =
    mode.kind === 'dry-run'
      ? dryRunReport()
      : mode.kind === 'environment'
        ? validateEnvironment(mode.path)
        : validateManual(mode.path);
  process.stdout.write(`${JSON.stringify(report, undefined, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
