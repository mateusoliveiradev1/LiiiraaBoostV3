import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

interface SourceFile {
  readonly path: string;
  readonly contents: string;
}

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const GENERATOR_ENTRY = join(
  REPOSITORY_ROOT,
  'tooling',
  'contract-generation',
  'src',
  'generate.ts',
);
const GENERATED_ARTIFACT_PATHS = Object.freeze([
  join('contracts', 'generated', 'desktop', 'v1', 'diagnostic-value.schema.json'),
  join('contracts', 'generated', 'desktop', 'v1', 'inspect-system.schema.json'),
  join('contracts', 'generated', 'desktop', 'v1', 'message-envelope.schema.json'),
  join('contracts', 'generated', 'desktop', 'v1', 'shell-message.schema.json'),
  join('contracts', 'generated', 'control-plane', 'v1', 'control-plane-document.schema.json'),
  join('contracts', 'generated', 'http', 'openapi.json'),
  join('contracts', 'generated', 'web', 'v1', 'web-document.schema.json'),
  join('packages', 'contracts-ts', 'src', 'generated', 'index.ts'),
  join('packages', 'contracts-ts', 'src', 'generated', 'models.ts'),
  join('packages', 'contracts-ts', 'src', 'generated', 'standalone-validators.d.ts'),
  join('packages', 'contracts-ts', 'src', 'generated', 'standalone-validators.js'),
  join('crates', 'contracts-rust', 'src', 'generated.rs'),
]);
const TRANSPORT_DECLARATION_NAMES = Object.freeze([
  'CorrelationId',
  'DiagnosticPrimitive',
  'DiagnosticValue',
  'FixtureDiagnosticValue',
  'HostToRendererShellEvent',
  'InspectionId',
  'InspectSystemRequest',
  'InspectSystemRequestPayload',
  'InspectSystemResult',
  'InspectSystemResultPayload',
  'MeasuredDiagnosticValue',
  'ModeledDiagnosticValue',
  'ObservedDiagnosticValue',
  'ProvenanceDescription',
  'ProvenanceIdentifier',
  'RendererToHostShellCommand',
  'RequestId',
  'ShellCloseContext',
  'ShellInstallerIdentity',
  'ShellNavigationIntent',
  'ShellNotificationCategory',
  'ShellNotificationPreference',
  'ShellStartupState',
  'ShellTrayPreference',
  'ShellWindowState',
  'UnavailableDiagnosticValue',
]);

function normalizePath(path: string): string {
  return path.replaceAll('\\', '/');
}

function executeFile(
  command: string,
  arguments_: string[],
  environment?: Record<string, string | undefined>,
): Promise<string> {
  return new Promise((resolvePromise, rejectPromise) => {
    execFile(
      command,
      arguments_,
      {
        cwd: REPOSITORY_ROOT,
        encoding: 'utf8',
        ...(environment === undefined ? {} : { env: environment }),
        maxBuffer: 16 * 1024 * 1024,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        if (error !== null) {
          rejectPromise(
            new Error(
              `${command} ${arguments_.join(' ')} failed:\n${stderr.trim() || error.message}`,
            ),
          );
          return;
        }

        resolvePromise(stdout);
      },
    );
  });
}

async function readGeneratedArtifacts(root: string): Promise<Map<string, string>> {
  const paths = GENERATED_ARTIFACT_PATHS.map(normalizePath).sort();
  const artifacts = new Map<string, string>();

  for (const path of paths) {
    try {
      artifacts.set(path, await readFile(join(root, path), 'utf8'));
    } catch {
      // A declared singleton output may be absent; compareGeneratedArtifacts reports it.
    }
  }

  return artifacts;
}

export function compareGeneratedArtifacts(
  expected: ReadonlyMap<string, string>,
  actual: ReadonlyMap<string, string>,
): string[] {
  const diagnostics: string[] = [];

  for (const [path, expectedContents] of expected) {
    const actualContents = actual.get(path);
    if (actualContents === undefined) {
      diagnostics.push(`missing: ${path}`);
    } else if (actualContents !== expectedContents) {
      diagnostics.push(`changed: ${path}`);
    }
  }

  for (const path of actual.keys()) {
    if (!expected.has(path)) {
      diagnostics.push(`extra: ${path}`);
    }
  }

  return diagnostics.sort();
}

export function findHandwrittenTransportDeclarations(files: readonly SourceFile[]): string[] {
  const diagnostics: string[] = [];
  const names = TRANSPORT_DECLARATION_NAMES.join('|');
  const declarationPattern = new RegExp(
    `\\b(?:class|enum|interface|struct|type)\\s+(${names})\\b`,
    'g',
  );

  for (const file of files) {
    for (const match of file.contents.matchAll(declarationPattern)) {
      diagnostics.push(`${normalizePath(file.path)}: handwritten ${String(match[1])} declaration`);
    }
  }

  return diagnostics.sort();
}

async function readHandwrittenSourceFiles(): Promise<SourceFile[]> {
  const trackedFiles = (await executeFile('git', ['ls-files', '--', 'apps', 'packages', 'crates']))
    .split(/\r?\n/u)
    .filter((path) => path.length > 0)
    .map(normalizePath)
    .filter((path) => /\.(?:rs|ts|tsx)$/u.test(path))
    .filter((path) => !/(?:^|\/)(?:generated|fixtures)(?:\/|$)/u.test(path))
    .filter((path) => !GENERATED_ARTIFACT_PATHS.map(normalizePath).includes(path))
    .filter((path) => !/\.(?:spec|test)\.(?:ts|tsx)$/u.test(path))
    .filter((path) => !path.startsWith('packages/contracts-source/'));

  return Promise.all(
    trackedFiles.map(async (path) => ({
      path,
      contents: await readFile(join(REPOSITORY_ROOT, path), 'utf8'),
    })),
  );
}

export async function checkContractDrift(): Promise<void> {
  const stagingRoot = await mkdtemp(join(tmpdir(), 'liiiraa-contract-drift-'));

  try {
    await executeFile(process.execPath, [GENERATOR_ENTRY], {
      ...process.env,
      LIIIRAA_GENERATION_STAGING_ROOT: stagingRoot,
    });

    const expected = await readGeneratedArtifacts(stagingRoot);
    const actual = await readGeneratedArtifacts(REPOSITORY_ROOT);
    const drift = compareGeneratedArtifacts(expected, actual);
    const duplicateDeclarations = findHandwrittenTransportDeclarations(
      await readHandwrittenSourceFiles(),
    );
    const diagnostics = [...drift, ...duplicateDeclarations].sort();

    if (diagnostics.length > 0) {
      throw new Error(`Contract generation drift detected:\n${diagnostics.join('\n')}`);
    }

    console.log(`Contract generation drift check passed (${String(expected.size)} artifacts).`);
  } finally {
    await rm(stagingRoot, { force: true, recursive: true });
  }
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isDirectExecution) {
  try {
    await checkContractDrift();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
