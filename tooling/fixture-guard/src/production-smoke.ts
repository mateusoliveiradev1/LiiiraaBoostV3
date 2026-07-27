import { DIAGNOSTIC_VALUE_SCHEMA_ID, validateDiagnosticValue } from '@liiiraa/contracts-ts';

import { inspectBuiltArtifact } from './artifact-guard.ts';
import { inspectProductionRuntimeBoundary, type RuntimeGuardFinding } from './runtime-guard.ts';

type ChildProcess = Readonly<{
  execFileSync: (
    file: string,
    arguments_: readonly string[],
    options: Readonly<{
      cwd: string;
      encoding: 'utf8';
      windowsHide: true;
    }>,
  ) => string;
}>;

type FileSystem = Readonly<{
  readFileSync: (path: string, encoding: 'utf8') => string;
  statSync: (path: string) => Readonly<{ isFile: () => boolean }>;
}>;

type PathModule = Readonly<{
  dirname: (path: string) => string;
  isAbsolute: (path: string) => boolean;
  join: (...paths: readonly string[]) => string;
  relative: (from: string, to: string) => string;
  resolve: (...paths: readonly string[]) => string;
  sep: string;
}>;

type UrlModule = Readonly<{
  fileURLToPath: (url: URL) => string;
  pathToFileURL: (path: string) => URL;
}>;

declare const process: {
  readonly execPath: string;
  readonly platform: string;
  getBuiltinModule(specifier: 'node:child_process' | 'node:fs' | 'node:path' | 'node:url'): unknown;
};

interface ProductionSmokeBoundary {
  readonly mode: unknown;
  readonly identity: unknown;
  readonly schemaVersion: unknown;
  readonly result: unknown;
}

export interface ProductionSmokeEvidence {
  readonly expectedEntry: URL;
  readonly loadedModule: unknown;
  readonly boundary: ProductionSmokeBoundary;
}

export interface ProductionSmokeFinding {
  readonly code: 'ENTRY_MISMATCH' | RuntimeGuardFinding['code'];
  readonly path: string;
}

export interface ProductionSmokeEvidenceResult {
  readonly ok: boolean;
  readonly findings: readonly ProductionSmokeFinding[];
}

export interface ProductionSmokeResult {
  readonly ok: boolean;
  readonly executedEntry: string;
  readonly artifactScannedFiles: number;
  readonly artifactScannedBytes: number;
  readonly mode: unknown;
  readonly identity: unknown;
  readonly schemaVersion: unknown;
  readonly result: unknown;
}

const childProcess = process.getBuiltinModule('node:child_process') as ChildProcess;
const fs = process.getBuiltinModule('node:fs') as FileSystem;
const path = process.getBuiltinModule('node:path') as PathModule;
const url = process.getBuiltinModule('node:url') as UrlModule;

const repositoryRoot = url.fileURLToPath(new URL('../../../', import.meta.url));
const packageDirectory = path.join(repositoryRoot, 'packages', 'desktop-production-reference');
const packageManifestPath = path.join(packageDirectory, 'package.json');

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseBoundary = (
  stdout: string,
): Readonly<{
  loadedModule: unknown;
  boundary: ProductionSmokeBoundary;
  contractDiagnostics: unknown;
}> => {
  const parsed = JSON.parse(stdout) as unknown;
  if (!isRecord(parsed) || !isRecord(parsed['boundary'])) {
    throw new Error('Production subprocess emitted an invalid smoke envelope.');
  }

  const boundary = parsed['boundary'];
  return Object.freeze({
    loadedModule: parsed['loadedModule'],
    contractDiagnostics: parsed['contractDiagnostics'],
    boundary: Object.freeze({
      mode: boundary['mode'],
      identity: boundary['identity'],
      schemaVersion: boundary['schemaVersion'],
      result: boundary['result'],
    }),
  });
};

const resolvePublicBuildEntry = (): string => {
  const manifest = JSON.parse(fs.readFileSync(packageManifestPath, 'utf8')) as unknown;
  if (!isRecord(manifest) || !isRecord(manifest['exports'])) {
    throw new Error('Production package must declare a public export map.');
  }

  const rootExport = manifest['exports']['.'];
  if (!isRecord(rootExport) || typeof rootExport['default'] !== 'string') {
    throw new Error('Production package must declare a default root export.');
  }

  const exportedPath = rootExport['default'];
  if (
    !exportedPath.startsWith('./dist/') ||
    exportedPath.includes('..') ||
    path.isAbsolute(exportedPath)
  ) {
    throw new Error('Production package default export must resolve inside ./dist.');
  }

  const entryPath = path.resolve(packageDirectory, exportedPath);
  const relativeToPackage = path.relative(packageDirectory, entryPath);
  if (
    relativeToPackage.startsWith('..') ||
    path.isAbsolute(relativeToPackage) ||
    !fs.statSync(entryPath).isFile()
  ) {
    throw new Error('Production package export escaped or is not a file.');
  }

  return entryPath;
};

export const inspectProductionSmokeEvidence = (
  evidence: ProductionSmokeEvidence,
): ProductionSmokeEvidenceResult => {
  const findings: ProductionSmokeFinding[] = [];
  if (
    typeof evidence.loadedModule !== 'string' ||
    evidence.loadedModule !== evidence.expectedEntry.href
  ) {
    findings.push(
      Object.freeze({
        code: 'ENTRY_MISMATCH',
        path: '$.loadedModule',
      }),
    );
  }

  findings.push(
    ...inspectProductionRuntimeBoundary(evidence.boundary).findings.map(
      ({ code, path: findingPath }) =>
        Object.freeze({
          code,
          path: findingPath,
        }),
    ),
  );

  return Object.freeze({
    ok: findings.length === 0,
    findings: Object.freeze(findings),
  });
};

const assertGeneratedDiagnosticContract = (diagnostics: unknown): void => {
  if (!isRecord(diagnostics)) {
    throw new Error('Production subprocess did not emit generated contract diagnostics.');
  }

  for (const field of ['deviceLabel', 'logicalProcessorCount', 'totalMemoryBytes'] as const) {
    const validation = validateDiagnosticValue(DIAGNOSTIC_VALUE_SCHEMA_ID, diagnostics[field]);
    if (!validation.ok) {
      throw new Error(
        `Production subprocess ${field} output failed generated contract validation: ${JSON.stringify(validation.error)}`,
      );
    }
  }
};

export const runProductionSmoke = (): ProductionSmokeResult => {
  const packageManager = process.platform === 'win32' ? 'cmd.exe' : 'pnpm';
  const packageManagerArguments =
    process.platform === 'win32'
      ? ['/d', '/s', '/c', 'pnpm --filter @liiiraa/desktop-production-reference build']
      : ['--filter', '@liiiraa/desktop-production-reference', 'build'];
  childProcess.execFileSync(packageManager, packageManagerArguments, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    windowsHide: true,
  });

  const entryPath = resolvePublicBuildEntry();
  const expectedEntry = url.pathToFileURL(entryPath);
  const artifact = inspectBuiltArtifact({
    distributionRoot: path.dirname(entryPath),
  });
  if (!artifact.ok) {
    throw new Error(
      `Production artifact guard rejected build: ${JSON.stringify(artifact.findings)}`,
    );
  }

  const script = `
    const loadedModule = process.argv[1];
    const production = await import(loadedModule);
    const composition = production.createProductionDesktopComposition({
      clock: () => '2000-01-01T00:00:00.000Z',
      inspectionIds: () => 'production-smoke-inspection',
    });
    const result = await composition.client.inspectSystem({
      requestId: 'production-smoke-request',
      issuedAt: '2000-01-01T00:00:00.000Z',
    });
    if (!result.ok) {
      throw new Error('Production smoke inspection failed.');
    }
    const toContractDiagnostic = (value) => ({
      kind: value.kind,
      reason: value.provenance.reason,
    });
    process.stdout.write(JSON.stringify({
      loadedModule,
      contractDiagnostics: {
        deviceLabel: toContractDiagnostic(result.value.deviceLabel),
        logicalProcessorCount: toContractDiagnostic(result.value.logicalProcessorCount),
        totalMemoryBytes: toContractDiagnostic(result.value.totalMemoryBytes),
      },
      boundary: {
        mode: composition.mode,
        identity: composition.client.identity,
        schemaVersion: composition.client.schemaVersion,
        result,
      },
    }));
  `;
  const stdout = childProcess.execFileSync(
    process.execPath,
    ['--input-type=module', '--eval', script, expectedEntry.href],
    {
      cwd: repositoryRoot,
      encoding: 'utf8',
      windowsHide: true,
    },
  );
  const evidence = parseBoundary(stdout);
  const inspected = inspectProductionSmokeEvidence({
    expectedEntry,
    loadedModule: evidence.loadedModule,
    boundary: evidence.boundary,
  });
  assertGeneratedDiagnosticContract(evidence.contractDiagnostics);

  return Object.freeze({
    ok: inspected.ok,
    executedEntry: path.relative(repositoryRoot, entryPath).split(path.sep).join('/'),
    artifactScannedFiles: artifact.scannedFiles,
    artifactScannedBytes: artifact.scannedBytes,
    mode: evidence.boundary.mode,
    identity: evidence.boundary.identity,
    schemaVersion: evidence.boundary.schemaVersion,
    result: evidence.boundary.result,
  });
};
