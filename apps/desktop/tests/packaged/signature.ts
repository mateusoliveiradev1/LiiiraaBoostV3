import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

type JsonRecord = Record<string, unknown>;

export type VerifiedArtifact = Readonly<{
  executablePath: string;
  executableSha256: string;
  installerPath: string;
  installerSha256: string;
  thumbprint: string;
  trustClass: 'self-signed-development';
}>;

const fail = (message: string): never => {
  throw new Error(`[packaged-signature] ${message}`);
};

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readRecord = (path: string): JsonRecord => {
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    return fail('signed artifact record must be a JSON object.');
  }
  return parsed;
};

const sha256 = (path: string): string =>
  createHash('sha256').update(readFileSync(path)).digest('hex').toUpperCase();

const stringValue = (record: JsonRecord, key: string, label: string): string => {
  const value = record[key];
  return typeof value === 'string' && value.length > 0
    ? value
    : fail(`${label}.${key} must be a non-empty string.`);
};

const verifyAuthenticode = (
  path: string,
  expectedThumbprint: string,
): Readonly<{ signatureType: string; status: string; thumbprint: string }> => {
  const escapedPath = path.replaceAll("'", "''");
  const script = [
    `$signature = Get-AuthenticodeSignature -LiteralPath '${escapedPath}';`,
    '[PSCustomObject]@{',
    'Status = [string]$signature.Status;',
    'StatusMessage = [string]$signature.StatusMessage;',
    'SignatureType = [string]$signature.SignatureType;',
    'Thumbprint = [string]$signature.SignerCertificate.Thumbprint',
    '} | ConvertTo-Json -Compress',
  ].join(' ');
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    encoding: 'utf8',
    shell: false,
    timeout: 20_000,
    windowsHide: true,
  });
  if (result.error !== undefined || result.status !== 0) {
    const stderr = result.stderr.trim();
    const detail =
      result.error?.message ?? (stderr.length > 0 ? stderr : `status ${String(result.status)}`);
    fail(`Authenticode inspection failed for ${path}: ${detail}`);
  }
  const parsed = JSON.parse(result.stdout.trim()) as unknown;
  if (!isRecord(parsed)) {
    return fail(`Authenticode inspection returned invalid JSON for ${path}.`);
  }
  const thumbprint = stringValue(parsed, 'Thumbprint', 'Authenticode').toUpperCase();
  const signatureType = stringValue(parsed, 'SignatureType', 'Authenticode');
  const status = stringValue(parsed, 'Status', 'Authenticode');
  if (thumbprint !== expectedThumbprint || signatureType !== 'Authenticode') {
    fail(`Authenticode identity mismatch for ${path}.`);
  }
  if (!['UnknownError', 'Valid'].includes(status)) {
    fail(`unexpected Authenticode status ${status} for ${path}.`);
  }
  return Object.freeze({ signatureType, status, thumbprint });
};

export const verifyDevelopmentArtifact = (
  workspaceRoot: string,
  recordPath: string,
): VerifiedArtifact => {
  const record = readRecord(recordPath);
  const signing = record['signing'];
  const staging = record['staging'];
  const build = record['build'];
  if (!isRecord(signing) || !isRecord(staging) || !isRecord(build)) {
    return fail('signed artifact record is missing build, signing, or staging.');
  }
  if (
    record['artifactClass'] !== 'self-signed-development' ||
    signing['trustClass'] !== 'self-signed-development' ||
    signing['publicTrust'] !== false ||
    signing['smartScreenReputation'] !== false ||
    signing['productionReady'] !== false ||
    signing['distributionAllowed'] !== false ||
    staging['published'] !== false ||
    staging['promoted'] !== false ||
    staging['releaseReady'] !== false ||
    build['elevatedUi'] !== false
  ) {
    return fail('development trust, non-elevation, or distribution boundary is invalid.');
  }
  const thumbprint = stringValue(
    signing,
    'certificateThumbprint',
    'signed artifact signing',
  ).toUpperCase();
  const artifacts = record['artifacts'];
  if (!Array.isArray(artifacts) || !artifacts.every(isRecord)) {
    return fail('signed artifact record must contain artifact objects.');
  }
  const resolveArtifact = (kind: 'executable' | 'installer') => {
    const artifact = artifacts.find((candidate) => candidate['kind'] === kind);
    if (artifact === undefined) {
      return fail(`signed artifact record is missing ${kind}.`);
    }
    const relativePath = stringValue(artifact, 'stagedPath', `${kind} artifact`);
    const path = resolve(workspaceRoot, relativePath);
    if (!existsSync(path) || !statSync(path).isFile()) {
      return fail(`${kind} staged path is missing: ${relativePath}.`);
    }
    const expectedHash = stringValue(artifact, 'stagedSha256', `${kind} artifact`).toUpperCase();
    const actualHash = sha256(path);
    if (actualHash !== expectedHash) {
      return fail(`${kind} SHA-256 drifted from the signed artifact record.`);
    }
    const signature = artifact['signature'];
    if (
      !isRecord(signature) ||
      signature['chainClass'] !== 'self-signed-untrusted-root' ||
      stringValue(signature, 'signerThumbprint', `${kind} signature`).toUpperCase() !==
        thumbprint
    ) {
      return fail(`${kind} development signature classification is invalid.`);
    }
    verifyAuthenticode(path, thumbprint);
    return Object.freeze({ hash: actualHash, path });
  };

  const installer = resolveArtifact('installer');
  const executable = resolveArtifact('executable');
  return Object.freeze({
    executablePath: executable.path,
    executableSha256: executable.hash,
    installerPath: installer.path,
    installerSha256: installer.hash,
    thumbprint,
    trustClass: 'self-signed-development',
  });
};
