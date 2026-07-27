type DirectoryEntry = Readonly<{
  name: string;
  isDirectory: () => boolean;
  isFile: () => boolean;
  isSymbolicLink: () => boolean;
}>;

type FileSystem = Readonly<{
  readdirSync: (
    path: string,
    options: Readonly<{ withFileTypes: true }>,
  ) => readonly DirectoryEntry[];
  readFileSync: (path: string, encoding: 'utf8') => string;
  realpathSync: (path: string) => string;
  statSync: (path: string) => Readonly<{ size: number; isDirectory: () => boolean }>;
}>;

type PathModule = Readonly<{
  basename: (path: string) => string;
  extname: (path: string) => string;
  isAbsolute: (path: string) => boolean;
  join: (...paths: readonly string[]) => string;
  relative: (from: string, to: string) => string;
  resolve: (path: string) => string;
  sep: string;
}>;

type UrlModule = Readonly<{
  fileURLToPath: (url: URL) => string;
}>;

declare const process: {
  getBuiltinModule(specifier: 'node:fs' | 'node:path' | 'node:url'): unknown;
};

export type ArtifactGuardFindingCode =
  | 'ARTIFACT_LIMIT_EXCEEDED'
  | 'FIXTURE_PACKAGE'
  | 'FIXTURE_PAYLOAD'
  | 'FIXTURE_SENTINEL'
  | 'INVALID_DISTRIBUTION_ROOT'
  | 'SOURCE_MAP_ROOT'
  | 'SYMLINK_REFUSED'
  | 'UNSUPPORTED_ARTIFACT_EXTENSION';

export interface ArtifactGuardFinding {
  readonly code: ArtifactGuardFindingCode;
  readonly path: string;
  readonly message: string;
}

export interface ArtifactGuardOptions {
  readonly distributionRoot: string | URL;
  readonly maxFiles?: number;
  readonly maxBytes?: number;
}

export interface ArtifactGuardResult {
  readonly ok: boolean;
  readonly findings: readonly ArtifactGuardFinding[];
  readonly scannedFiles: number;
  readonly scannedBytes: number;
}

const DEFAULT_MAX_FILES = 512;
const DEFAULT_MAX_BYTES = 16 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([
  '.cjs',
  '.css',
  '.html',
  '.js',
  '.json',
  '.map',
  '.mjs',
  '.txt',
  '.wasm',
]);
const SOURCE_TREE_NAMES = new Set(['src', 'source', 'test', 'tests']);
const FIXTURE_PACKAGES = ['@liiiraa/desktop-simulator-reference', '@liiiraa/fixture-guard'];

const asFileSystem = (value: unknown): FileSystem => value as FileSystem;
const asPathModule = (value: unknown): PathModule => value as PathModule;
const asUrlModule = (value: unknown): UrlModule => value as UrlModule;

const fs = asFileSystem(process.getBuiltinModule('node:fs'));
const path = asPathModule(process.getBuiltinModule('node:path'));
const url = asUrlModule(process.getBuiltinModule('node:url'));

const finding = (
  code: ArtifactGuardFindingCode,
  artifactPath: string,
  message: string,
): ArtifactGuardFinding =>
  Object.freeze({
    code,
    path: artifactPath,
    message,
  });

const normalizeRelativePath = (value: string): string => value.split(path.sep).join('/');

const resolveDistributionRoot = (value: string | URL): string => {
  const candidate =
    value instanceof URL ? (value.protocol === 'file:' ? url.fileURLToPath(value) : '') : value;

  if (candidate.length === 0 || !path.isAbsolute(candidate)) {
    throw new Error('distributionRoot must be an explicit absolute path or file URL');
  }

  return path.resolve(candidate);
};

const inspectSourceMap = (
  contents: string,
  artifactPath: string,
): ArtifactGuardFinding | undefined => {
  try {
    const parsed = JSON.parse(contents) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return undefined;
    }

    const map = parsed as Record<string, unknown>;
    const roots = [
      typeof map['sourceRoot'] === 'string' ? map['sourceRoot'] : '',
      ...(Array.isArray(map['sources'])
        ? map['sources'].filter((source): source is string => typeof source === 'string')
        : []),
    ];
    if (
      roots.some((root) => /(^|[/\\]|\.\.)(src|source|test|tests|fixtures)([/\\]|$)/iu.test(root))
    ) {
      return finding(
        'SOURCE_MAP_ROOT',
        artifactPath,
        'Source map points outside the distributable production tree.',
      );
    }
  } catch {
    return undefined;
  }

  return undefined;
};

const inspectContents = (
  contents: string,
  artifactPath: string,
  extension: string,
): readonly ArtifactGuardFinding[] => {
  if (contents.includes('LIIIRAA_FIXTURE_SENTINEL')) {
    return [
      finding('FIXTURE_SENTINEL', artifactPath, 'Built artifact contains a fixture sentinel.'),
    ];
  }

  const findings: ArtifactGuardFinding[] = [];
  for (const packageName of FIXTURE_PACKAGES) {
    if (contents.includes(packageName)) {
      findings.push(
        finding(
          'FIXTURE_PACKAGE',
          artifactPath,
          `Built artifact references forbidden fixture package ${packageName}.`,
        ),
      );
    }
  }

  if (
    /"kind"\s*:\s*"fixture"/u.test(contents) ||
    /"fixtureVersion"\s*:/u.test(contents) ||
    /"scenarioId"\s*:/u.test(contents)
  ) {
    findings.push(
      finding(
        'FIXTURE_PAYLOAD',
        artifactPath,
        'Built artifact contains fixture-only payload fields.',
      ),
    );
  }

  if (extension === '.map') {
    const sourceMapFinding = inspectSourceMap(contents, artifactPath);
    if (sourceMapFinding !== undefined) {
      findings.push(sourceMapFinding);
    }
  }

  return findings;
};

export const inspectBuiltArtifact = (options: ArtifactGuardOptions): ArtifactGuardResult => {
  const distributionRoot = resolveDistributionRoot(options.distributionRoot);
  const rootName = path.basename(distributionRoot).toLowerCase();
  if (SOURCE_TREE_NAMES.has(rootName)) {
    return Object.freeze({
      ok: false,
      findings: Object.freeze([
        finding(
          'INVALID_DISTRIBUTION_ROOT',
          '.',
          'Source and test trees cannot be scanned as production artifacts.',
        ),
      ]),
      scannedFiles: 0,
      scannedBytes: 0,
    });
  }

  const canonicalRoot = fs.realpathSync(distributionRoot);
  if (!fs.statSync(canonicalRoot).isDirectory()) {
    throw new Error('distributionRoot must identify a directory');
  }

  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const findings: ArtifactGuardFinding[] = [];
  let scannedFiles = 0;
  let scannedBytes = 0;

  const scanDirectory = (directory: string): void => {
    const entries = fs
      .readdirSync(directory, { withFileTypes: true })
      .toSorted((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name);
      const relativePath = normalizeRelativePath(path.relative(canonicalRoot, entryPath));
      if (
        relativePath === '..' ||
        relativePath.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relativePath)
      ) {
        findings.push(
          finding(
            'INVALID_DISTRIBUTION_ROOT',
            relativePath,
            'Artifact traversal escaped the explicit distribution root.',
          ),
        );
        continue;
      }

      if (entry.isSymbolicLink()) {
        findings.push(
          finding(
            'SYMLINK_REFUSED',
            relativePath,
            'Symbolic links are refused in production artifacts.',
          ),
        );
        continue;
      }
      if (entry.isDirectory()) {
        scanDirectory(entryPath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }

      const extension = path.extname(entry.name).toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(extension)) {
        findings.push(
          finding(
            'UNSUPPORTED_ARTIFACT_EXTENSION',
            relativePath,
            `Artifact extension ${extension || '<none>'} is not allowlisted.`,
          ),
        );
        continue;
      }

      const fileSize = fs.statSync(entryPath).size;
      if (scannedFiles + 1 > maxFiles || scannedBytes + fileSize > maxBytes) {
        findings.push(
          finding(
            'ARTIFACT_LIMIT_EXCEEDED',
            relativePath,
            'Artifact scan exceeded the configured file or byte bound.',
          ),
        );
        continue;
      }

      scannedFiles += 1;
      scannedBytes += fileSize;
      findings.push(
        ...inspectContents(fs.readFileSync(entryPath, 'utf8'), relativePath, extension),
      );
    }
  };

  scanDirectory(canonicalRoot);
  findings.sort(
    (left, right) =>
      left.path.localeCompare(right.path) ||
      left.code.localeCompare(right.code) ||
      left.message.localeCompare(right.message),
  );

  return Object.freeze({
    ok: findings.length === 0,
    findings: Object.freeze(findings),
    scannedFiles,
    scannedBytes,
  });
};
