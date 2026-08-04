import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type JsonObject = Record<string, unknown>;

interface LockedAsset {
  readonly file: string;
  readonly sha256: string;
}

interface OasdiffLock {
  readonly schemaVersion: 1;
  readonly name: 'oasdiff';
  readonly version: string;
  readonly releaseBaseUrl: string;
  readonly checksumsSource: string;
  readonly assets: Readonly<Record<string, LockedAsset>>;
}

interface CommandResult {
  readonly code: string | number | undefined;
  readonly stdout: string;
  readonly stderr: string;
}

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const LOCK_PATH = join(REPOSITORY_ROOT, 'tooling', 'contract-compat', 'oasdiff.lock.json');
const MAX_ARCHIVE_BYTES = 64 * 1024 * 1024;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;

const runtime = process as typeof process & { readonly arch: string; readonly platform: string };

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function executeFile(command: string, arguments_: string[]): Promise<CommandResult> {
  return new Promise((resolvePromise, rejectPromise) => {
    execFile(
      command,
      arguments_,
      {
        cwd: REPOSITORY_ROOT,
        encoding: 'utf8',
        maxBuffer: MAX_ARCHIVE_BYTES,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        if (error !== null && error.code === 'ENOENT') {
          rejectPromise(new Error(`Required executable is unavailable: ${command}.`));
          return;
        }

        resolvePromise({ code: error?.code, stdout, stderr });
      },
    );
  });
}

function requireSuccess(command: string, result: CommandResult): string {
  if (result.code !== undefined) {
    throw new Error(
      `${command} failed: ${(result.stderr.trim() || result.stdout.trim() || String(result.code)).slice(0, 2048)}`,
    );
  }
  return result.stdout.trim();
}

function requireAsset(value: unknown, key: string): LockedAsset {
  if (
    !isJsonObject(value) ||
    typeof value['file'] !== 'string' ||
    !/^oasdiff_1\.26\.0_[a-z0-9_]+\.tar\.gz$/u.test(value['file']) ||
    typeof value['sha256'] !== 'string' ||
    !SHA256_PATTERN.test(value['sha256'])
  ) {
    throw new Error(`oasdiff lock asset ${key} is invalid.`);
  }
  return value as unknown as LockedAsset;
}

async function readLock(): Promise<OasdiffLock> {
  const value: unknown = JSON.parse(await readFile(LOCK_PATH, 'utf8'));
  if (
    !isJsonObject(value) ||
    value['schemaVersion'] !== 1 ||
    value['name'] !== 'oasdiff' ||
    value['version'] !== '1.26.0' ||
    typeof value['releaseBaseUrl'] !== 'string' ||
    value['releaseBaseUrl'] !== 'https://github.com/oasdiff/oasdiff/releases/download/v1.26.0' ||
    typeof value['checksumsSource'] !== 'string' ||
    value['checksumsSource'] !== `${value['releaseBaseUrl']}/checksums.txt` ||
    !isJsonObject(value['assets'])
  ) {
    throw new Error('oasdiff lock is invalid or not pinned to 1.26.0.');
  }

  const assets = Object.fromEntries(
    Object.entries(value['assets']).map(([key, asset]) => [key, requireAsset(asset, key)]),
  );
  return { ...(value as unknown as OasdiffLock), assets };
}

function runtimeAssetKey(): string {
  const arch = runtime.arch === 'x64' ? 'x64' : runtime.arch === 'arm64' ? 'arm64' : undefined;
  if (arch === undefined || !['darwin', 'linux', 'win32'].includes(runtime.platform)) {
    throw new Error(`oasdiff 1.26.0 is not locked for ${runtime.platform}-${runtime.arch}.`);
  }
  return `${runtime.platform}-${arch}`;
}

async function sha256(path: string): Promise<string> {
  if (runtime.platform === 'win32') {
    const output = requireSuccess(
      'certutil SHA256',
      await executeFile('certutil', ['-hashfile', path, 'SHA256']),
    );
    return (
      output
        .split(/\r?\n/u)
        .map((line) => line.replaceAll(' ', '').toLowerCase())
        .find((line) => SHA256_PATTERN.test(line)) ?? ''
    );
  }

  const command = runtime.platform === 'darwin' ? 'shasum' : 'sha256sum';
  const arguments_ = runtime.platform === 'darwin' ? ['-a', '256', path] : [path];
  return requireSuccess(command, await executeFile(command, arguments_)).split(/\s+/u)[0] ?? '';
}

function safeArchiveEntries(listing: string): readonly string[] {
  const entries = listing
    .split(/\r?\n/u)
    .map((entry) => entry.trim().replace(/^\.\//u, ''))
    .filter((entry) => entry.length > 0);

  if (
    entries.length === 0 ||
    entries.some(
      (entry) =>
        entry.startsWith('/') ||
        /^[A-Za-z]:/u.test(entry) ||
        entry.split('/').some((segment) => segment === '..'),
    )
  ) {
    throw new Error('oasdiff archive contains an unsafe path.');
  }

  const executableName = runtime.platform === 'win32' ? 'oasdiff.exe' : 'oasdiff';
  if (entries.filter((entry) => basename(entry) === executableName).length !== 1) {
    throw new Error('oasdiff archive must contain exactly one expected executable.');
  }
  return entries;
}

async function provisionOasdiff(
  expectedVersion: string,
): Promise<Readonly<{ executable: string; stagingRoot: string }>> {
  const lock = await readLock();
  if (expectedVersion !== lock.version) {
    throw new Error(`oasdiff version ${expectedVersion} is not the locked ${lock.version}.`);
  }

  const asset = lock.assets[runtimeAssetKey()];
  if (asset === undefined) {
    throw new Error(`oasdiff lock is missing ${runtimeAssetKey()}.`);
  }

  const stagingRoot = await mkdtemp(join(tmpdir(), 'liiiraa-oasdiff-1.26.0-'));
  const archivePath = join(stagingRoot, asset.file);
  const downloadUrl = `${lock.releaseBaseUrl}/${asset.file}`;
  const curl = runtime.platform === 'win32' ? 'curl.exe' : 'curl';

  try {
    requireSuccess(
      'oasdiff download',
      await executeFile(curl, [
        '--fail',
        '--silent',
        '--show-error',
        '--location',
        '--max-filesize',
        String(MAX_ARCHIVE_BYTES),
        '--output',
        archivePath,
        downloadUrl,
      ]),
    );

    const actualHash = await sha256(archivePath);
    if (actualHash !== asset.sha256) {
      throw new Error(`oasdiff archive checksum mismatch: ${actualHash}.`);
    }

    const listing = requireSuccess(
      'oasdiff archive inspection',
      await executeFile('tar', ['-tzf', archivePath]),
    );
    const entries = safeArchiveEntries(listing);
    requireSuccess(
      'oasdiff archive extraction',
      await executeFile('tar', ['-xzf', archivePath, '-C', stagingRoot]),
    );

    const executableName = runtime.platform === 'win32' ? 'oasdiff.exe' : 'oasdiff';
    const executableEntry = entries.find((entry) => basename(entry) === executableName);
    if (executableEntry === undefined) {
      throw new Error('oasdiff executable was not found after safe archive inspection.');
    }
    const executable = join(stagingRoot, ...executableEntry.split('/'));
    const versionOutput = requireSuccess(
      'oasdiff version',
      await executeFile(executable, ['--version']),
    );
    if (
      !new RegExp(`(?:^|\\D)${lock.version.replaceAll('.', '\\.')}($|\\D)`, 'u').test(versionOutput)
    ) {
      throw new Error(
        `oasdiff binary reported an unexpected version: ${versionOutput.slice(0, 256)}.`,
      );
    }

    return { executable, stagingRoot };
  } catch (error) {
    await rm(stagingRoot, { force: true, recursive: true });
    throw error;
  }
}

export async function runOasdiffBreaking(
  baselinePath: string,
  candidatePath: string,
  expectedVersion = '1.26.0',
): Promise<string> {
  const provisioned = await provisionOasdiff(expectedVersion);
  try {
    const result = await executeFile(provisioned.executable, [
      'breaking',
      resolve(baselinePath),
      resolve(candidatePath),
      '--format',
      'json',
    ]);
    const report = (result.stdout.trim() || result.stderr.trim()).slice(0, 64 * 1024);
    if (report.length === 0) {
      return '';
    }
    try {
      const parsed: unknown = JSON.parse(report);
      if (Array.isArray(parsed) && parsed.length === 0) {
        return '';
      }
    } catch {
      // Non-JSON diagnostics remain a terminating compatibility report.
    }
    return report;
  } finally {
    await rm(provisioned.stagingRoot, { force: true, recursive: true });
  }
}

export async function verifyPinnedOasdiff(expectedVersion = '1.26.0'): Promise<void> {
  const provisioned = await provisionOasdiff(expectedVersion);
  await rm(provisioned.stagingRoot, { force: true, recursive: true });
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isDirectExecution) {
  const versionIndex = process.argv.indexOf('--oasdiff-version');
  const expectedVersion = versionIndex === -1 ? undefined : process.argv[versionIndex + 1];
  const baselineIndex = process.argv.indexOf('--baseline');
  const candidateIndex = process.argv.indexOf('--candidate');
  const baselinePath = baselineIndex === -1 ? undefined : process.argv[baselineIndex + 1];
  const candidatePath = candidateIndex === -1 ? undefined : process.argv[candidateIndex + 1];

  try {
    if (expectedVersion === undefined) {
      throw new Error('--oasdiff-version is required.');
    }
    if ((baselinePath === undefined) !== (candidatePath === undefined)) {
      throw new Error('--baseline and --candidate must be provided together.');
    }

    if (baselinePath === undefined || candidatePath === undefined) {
      await verifyPinnedOasdiff(expectedVersion);
      console.log(`oasdiff ${expectedVersion} checksum and executable verified.`);
    } else {
      const report = await runOasdiffBreaking(baselinePath, candidatePath, expectedVersion);
      if (report.length > 0) {
        throw new Error(`OpenAPI compatibility failed:\n${report}`);
      }
      console.log(`OpenAPI compatibility passed with oasdiff ${expectedVersion}.`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
