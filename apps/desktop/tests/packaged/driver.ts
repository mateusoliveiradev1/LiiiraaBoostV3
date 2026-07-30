import { existsSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  runPackagedJourneys,
  startPackagedSession,
  stopPackagedSession,
} from './journeys.ts';
import { measurePackagedPerformance } from './performance.ts';
import { verifyDevelopmentArtifact } from './signature.ts';

type JsonRecord = Record<string, unknown>;

type DriverArguments = Readonly<{
  artifactRecordPath: string;
  developerWorkstation: boolean;
  driverPath?: string;
  dryRun: boolean;
  grep?: string;
  matrixPath: string;
  nativeDriverPath?: string;
  runnerId?: string;
  schemaSmoke: boolean;
}>;

const desktopRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const workspaceRoot = resolve(desktopRoot, '../..');
const defaultMatrixPath = resolve(workspaceRoot, 'apps/desktop/tests/packaged/windows-matrix.json');
const defaultArtifactRecordPath = resolve(
  workspaceRoot,
  'quality/evidence/phase-02/artifacts/signed-desktop-package.json',
);
const shellSchemaPath = resolve(
  workspaceRoot,
  'contracts/generated/desktop/v1/shell-message.schema.json',
);

const fail = (message: string): never => {
  throw new Error(`[packaged-driver] ${message}`);
};

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readJsonObject = (path: string, label: string): JsonRecord => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return fail(`${label} is not readable JSON: ${detail}`);
  }
  return isRecord(parsed) ? parsed : fail(`${label} must be a JSON object.`);
};

const optionValue = (arguments_: readonly string[], option: string): string | undefined => {
  const index = arguments_.indexOf(option);
  if (index === -1) {
    return undefined;
  }
  const value = arguments_[index + 1];
  return value === undefined || value.startsWith('--')
    ? fail(`${option} requires a value.`)
    : value;
};

const parseArguments = (arguments_: readonly string[]): DriverArguments => {
  const optionsWithValues = new Set([
    '--artifact-record',
    '--driver-path',
    '--grep',
    '--matrix',
    '--native-driver',
    '--runner',
  ]);
  const flags = new Set(['--developer-workstation', '--dry-run', '--schema-smoke']);
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === undefined) {
      continue;
    }
    if (flags.has(argument)) {
      continue;
    }
    if (optionsWithValues.has(argument)) {
      index += 1;
      if (arguments_[index] === undefined) {
        fail(`${argument} requires a value.`);
      }
      continue;
    }
    fail(`unsupported argument: ${argument}`);
  }

  return {
    artifactRecordPath: resolve(
      optionValue(arguments_, '--artifact-record') ?? defaultArtifactRecordPath,
    ),
    developerWorkstation: arguments_.includes('--developer-workstation'),
    driverPath: optionValue(arguments_, '--driver-path') ?? process.env.TAURI_DRIVER_PATH,
    dryRun: arguments_.includes('--dry-run'),
    grep: optionValue(arguments_, '--grep'),
    matrixPath: resolve(optionValue(arguments_, '--matrix') ?? defaultMatrixPath),
    nativeDriverPath:
      optionValue(arguments_, '--native-driver') ?? process.env.MSEDGEDRIVER_PATH,
    runnerId: optionValue(arguments_, '--runner'),
    schemaSmoke: arguments_.includes('--schema-smoke'),
  };
};

const requiredDefinition = (definitions: JsonRecord, name: string): JsonRecord => {
  const definition = definitions[name];
  return isRecord(definition)
    ? definition
    : fail(`generated shell schema is missing $defs.${name}.`);
};

const buildShellFixtures = (schema: JsonRecord): readonly JsonRecord[] => {
  const definitions = schema['$defs'];
  if (!isRecord(definitions)) {
    return fail('generated shell schema is missing $defs.');
  }
  requiredDefinition(definitions, 'ShellStartupState');
  requiredDefinition(definitions, 'ShellWindowState');
  const startupEvent = requiredDefinition(definitions, 'ShellStartupStateChangedEvent');
  const windowEvent = requiredDefinition(definitions, 'ShellWindowStateChangedEvent');
  const startupMessageType = isRecord(startupEvent.properties)
    ? startupEvent.properties.messageType
    : undefined;
  const windowMessageType = isRecord(windowEvent.properties)
    ? windowEvent.properties.messageType
    : undefined;
  if (
    !isRecord(startupMessageType) ||
    startupMessageType.const !== 'desktop.shell.startup-state-changed.event' ||
    !isRecord(windowMessageType) ||
    windowMessageType.const !== 'desktop.shell.window-state-changed.event'
  ) {
    return fail('generated shell lifecycle event literals do not match the packaged harness.');
  }

  return Object.freeze([
    Object.freeze({
      schemaVersion: '1.0',
      messageType: startupMessageType.const,
      requestId: 'packaged-wave-zero-startup',
      issuedAt: '2026-01-01T00:00:00.000Z',
      payload: Object.freeze({ state: Object.freeze({ kind: 'ready' }) }),
    }),
    Object.freeze({
      schemaVersion: '1.0',
      messageType: windowMessageType.const,
      requestId: 'packaged-wave-zero-window',
      issuedAt: '2026-01-01T00:00:00.000Z',
      payload: Object.freeze({
        state: Object.freeze({
          kind: 'normal',
          x: 0,
          y: 0,
          width: 1280,
          height: 800,
          monitorId: 'packaged-wave-zero-monitor',
        }),
      }),
    }),
  ]);
};

const matrixRecords = (matrix: JsonRecord): readonly JsonRecord[] => {
  if (
    matrix.schemaVersion !== '1.0' ||
    matrix.evidenceKind !== 'desktop-packaged-environment' ||
    !Array.isArray(matrix.records)
  ) {
    return fail('Windows matrix must use desktop-packaged-environment schemaVersion 1.0.');
  }
  const records = matrix.records;
  if (!records.every(isRecord)) {
    return fail('Windows matrix records must be JSON objects.');
  }
  return records;
};

const unresolvedPrerequisites = (records: readonly JsonRecord[]): readonly string[] => {
  const requirements = [
    ['windows-image', 'windows-10', 'reviewed Windows 10 image'],
    ['windows-image', 'windows-11', 'reviewed Windows 11 image'],
    ['development-signing', 'local-development-signing', 'reviewed local development signing'],
  ] as const;

  return requirements.flatMap(([recordType, id, label]) => {
    const record = records.find(
      (candidate) => candidate.recordType === recordType && candidate.id === id,
    );
    return record?.status === 'reviewed' ? [] : [label];
  });
};

const validateDriverPath = (path: string | undefined): string => {
  if (path === undefined) {
    return fail(
      'tauri-driver 2.0.6 is unavailable; set TAURI_DRIVER_PATH to the reviewed local binary.',
    );
  }
  const resolvedPath = resolve(path);
  if (!existsSync(resolvedPath)) {
    return fail(`tauri-driver 2.0.6 path does not exist: ${resolvedPath}`);
  }
  if (!/^tauri-driver(?:\.exe)?$/iu.test(basename(resolvedPath))) {
    return fail(
      'driver path must name tauri-driver or tauri-driver.exe; browser substitutes are forbidden.',
    );
  }
  return resolvedPath;
};

const validateNativeDriverPath = (path: string | undefined): string => {
  if (path === undefined) {
    return fail(
      'matching Microsoft Edge Driver is unavailable; set MSEDGEDRIVER_PATH to the reviewed signed binary.',
    );
  }
  const resolvedPath = resolve(path);
  if (!existsSync(resolvedPath)) {
    return fail(`Microsoft Edge Driver path does not exist: ${resolvedPath}`);
  }
  if (!/^msedgedriver(?:\.exe)?$/iu.test(basename(resolvedPath))) {
    return fail('native driver path must name msedgedriver or msedgedriver.exe.');
  }
  return resolvedPath;
};

const run = async (): Promise<void> => {
  const parsedArguments = parseArguments(process.argv.slice(2));
  const matrix = readJsonObject(parsedArguments.matrixPath, 'Windows matrix');
  const records = matrixRecords(matrix);
  const schema = readJsonObject(shellSchemaPath, 'generated shell schema');
  const shellFixtures = buildShellFixtures(schema);
  const prerequisites = unresolvedPrerequisites(records);

  if (parsedArguments.dryRun) {
    process.stdout.write(
      `${JSON.stringify(
        {
          mode: 'dry-run',
          acceptance: 'planned',
          packagedAcceptance: false,
          driver: {
            name: 'tauri-driver',
            version: '2.0.6',
            executed: false,
          },
          schemaSmoke: parsedArguments.schemaSmoke,
          matrix: parsedArguments.matrixPath,
          prerequisites,
          shellFixtures,
          plannedChecks: matrix.plannedChecks,
        },
        undefined,
        2,
      )}\n`,
    );
    return;
  }

  if (process.platform !== 'win32') {
    fail('packaged execution requires a reviewed Windows 10 or Windows 11 runner.');
  }
  if (prerequisites.length > 0 && !parsedArguments.developerWorkstation) {
    fail(`packaged execution prerequisites unavailable: ${prerequisites.join(', ')}.`);
  }
  if (!parsedArguments.developerWorkstation && parsedArguments.runnerId === undefined) {
    fail('--runner is required for packaged execution.');
  }
  if (!parsedArguments.developerWorkstation) {
    const runner = records.find(
      (record) =>
        record.recordType === 'windows-image' &&
        record.id === parsedArguments.runnerId &&
        record.status === 'reviewed',
    );
    if (runner === undefined) {
      fail(`runner ${parsedArguments.runnerId} is unsupported or unreviewed.`);
    }
  }

  const driverPath = validateDriverPath(parsedArguments.driverPath);
  const nativeDriverPath = validateNativeDriverPath(parsedArguments.nativeDriverPath);
  const artifact = verifyDevelopmentArtifact(workspaceRoot, parsedArguments.artifactRecordPath);
  const started = performance.now();
  const session = await startPackagedSession(
    driverPath,
    nativeDriverPath,
    artifact.executablePath,
  );
  try {
    const journeys = await runPackagedJourneys(session);
    const measured = await measurePackagedPerformance(session, performance.now() - started);
    process.stdout.write(
      `${JSON.stringify(
        {
          acceptance: parsedArguments.developerWorkstation
            ? 'development-workstation-observed'
            : 'reviewed-image-observed',
          artifact: {
            executableSha256: artifact.executableSha256,
            installerSha256: artifact.installerSha256,
            thumbprint: artifact.thumbprint,
            trustClass: artifact.trustClass,
          },
          driver: {
            name: 'tauri-driver',
            native: basename(nativeDriverPath),
            version: '2.0.6',
          },
          grep: parsedArguments.grep,
          journeys,
          performance: measured,
          publicTrust: false,
          productionReady: false,
          runner: parsedArguments.runnerId ?? 'current-windows-development-workstation',
        },
        undefined,
        2,
      )}\n`,
    );
  } finally {
    await stopPackagedSession(session);
  }
};

try {
  await run();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
