import { evaluateGraph, type PolicyResult, type RuntimeClass } from './policy.ts';

export interface NormalizedGraphNode {
  path: string;
  runtimeClass: RuntimeClass;
}

export interface NormalizedDependencyEdge {
  from: string;
  to: string;
  importPath: string;
  kind: 'typescript' | 'cargo';
}

export interface NormalizedDependencyGraph {
  schemaVersion: 1;
  nodes: NormalizedGraphNode[];
  edges: NormalizedDependencyEdge[];
}

export interface CargoCheckResult {
  adapter: 'cargo';
  graph: NormalizedDependencyGraph;
  policy: PolicyResult;
}

interface CanonicalModule {
  roots: string[];
  runtimeClass: RuntimeClass;
}

interface CargoPackage {
  id: string;
  name: string;
  sourcePath: string;
}

declare const process: {
  cwd: () => string;
  getBuiltinModule: (specifier: string) => unknown;
};

type ExecFileSync = (
  file: string,
  arguments_: string[],
  options: {
    cwd: string;
    encoding: 'utf8';
    maxBuffer: number;
    windowsHide: true;
  },
) => unknown;

const ARCHITECTURE_COMMAND_MAX_BUFFER_BYTES = 32 * 1024 * 1024;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasExecFileSync = (value: unknown): value is { execFileSync: ExecFileSync } =>
  isRecord(value) && typeof value['execFileSync'] === 'function';

export const execFileUtf8 = (file: string, arguments_: string[]): string => {
  const childProcess = process.getBuiltinModule('node:child_process');
  if (!hasExecFileSync(childProcess)) {
    throw new Error('Node child_process.execFileSync is unavailable.');
  }
  const output = childProcess.execFileSync(file, arguments_, {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: ARCHITECTURE_COMMAND_MAX_BUFFER_BYTES,
    windowsHide: true,
  });
  if (typeof output !== 'string') {
    throw new Error(`${file} did not return UTF-8 output.`);
  }
  return output;
};

export const normalizeRepositoryPath = (value: string): string =>
  value.replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/+/g, '/');

const isRuntimeClass = (value: unknown): value is RuntimeClass =>
  value === 'production' || value === 'fixture' || value === 'tooling';

const readStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];

const readCanonicalModules = (policyInput: unknown): CanonicalModule[] => {
  if (!isRecord(policyInput) || !Array.isArray(policyInput['modules'])) {
    throw new Error('Canonical policy must contain a modules array.');
  }

  return policyInput['modules'].map((moduleInput, index) => {
    if (
      !isRecord(moduleInput) ||
      !Array.isArray(moduleInput['roots']) ||
      !isRuntimeClass(moduleInput['runtimeClass'])
    ) {
      throw new Error(`Canonical module at index ${String(index)} is invalid.`);
    }
    const roots = readStringArray(moduleInput['roots']).map(normalizeRepositoryPath);
    if (roots.length === 0) {
      throw new Error(`Canonical module at index ${String(index)} has no roots.`);
    }
    return {
      roots,
      runtimeClass: moduleInput['runtimeClass'],
    };
  });
};

const pathIsWithin = (root: string, path: string): boolean =>
  path === root || path.startsWith(`${root}/`);

export const runtimeClassForPath = (policyInput: unknown, path: string): RuntimeClass => {
  const normalizedPath = normalizeRepositoryPath(path);
  const owner = readCanonicalModules(policyInput).find(({ roots }) =>
    roots.some((root) => pathIsWithin(root, normalizedPath)),
  );
  return owner?.runtimeClass ?? 'tooling';
};

const repositoryRelativePath = (repositoryRoot: string, path: string): string | undefined => {
  const normalizedRoot = normalizeRepositoryPath(repositoryRoot).replace(/\/$/, '');
  const normalizedPath = normalizeRepositoryPath(path);
  const rootPrefix = `${normalizedRoot}/`;
  if (normalizedPath.startsWith(rootPrefix)) {
    return normalizedPath.slice(rootPrefix.length);
  }
  if (!/^(?:[A-Za-z]:\/|\/)/.test(normalizedPath)) {
    return normalizedPath;
  }
  return undefined;
};

const readCargoPackages = (
  metadata: Record<string, unknown>,
  repositoryRoot: string,
): Map<string, CargoPackage> => {
  const workspaceMembers = new Set(readStringArray(metadata['workspace_members']));
  const packages = new Map<string, CargoPackage>();
  if (!Array.isArray(metadata['packages'])) {
    throw new Error('Cargo metadata must contain a packages array.');
  }

  for (const packageInput of metadata['packages']) {
    if (!isRecord(packageInput)) {
      continue;
    }
    const id = packageInput['id'];
    const name = packageInput['name'];
    if (
      typeof id !== 'string' ||
      typeof name !== 'string' ||
      (workspaceMembers.size > 0 && !workspaceMembers.has(id)) ||
      !Array.isArray(packageInput['targets'])
    ) {
      continue;
    }
    const sourcePath = packageInput['targets']
      .filter(isRecord)
      .map((target) => target['src_path'])
      .find((value): value is string => typeof value === 'string');
    if (sourcePath === undefined) {
      continue;
    }
    const relativeSourcePath = repositoryRelativePath(repositoryRoot, sourcePath);
    if (relativeSourcePath !== undefined) {
      packages.set(id, { id, name, sourcePath: relativeSourcePath });
    }
  }
  return packages;
};

const readResolveDependencies = (node: Record<string, unknown>): string[] => {
  const dependencies = readStringArray(node['dependencies']);
  if (dependencies.length > 0 || !Array.isArray(node['deps'])) {
    return dependencies;
  }
  return node['deps']
    .filter(isRecord)
    .map((dependency) => dependency['pkg'])
    .filter((value): value is string => typeof value === 'string');
};

export const normalizeCargoMetadata = (
  policyInput: unknown,
  metadataInput: unknown,
  repositoryRoot: string,
): NormalizedDependencyGraph => {
  if (!isRecord(metadataInput)) {
    throw new Error('Cargo metadata must be an object.');
  }
  const packages = readCargoPackages(metadataInput, repositoryRoot);
  const nodes = [...packages.values()]
    .map(({ sourcePath }) => ({
      path: sourcePath,
      runtimeClass: runtimeClassForPath(policyInput, sourcePath),
    }))
    .toSorted((left, right) => left.path.localeCompare(right.path));

  const edges: NormalizedDependencyEdge[] = [];
  const resolve = metadataInput['resolve'];
  if (isRecord(resolve) && Array.isArray(resolve['nodes'])) {
    for (const nodeInput of resolve['nodes']) {
      if (!isRecord(nodeInput) || typeof nodeInput['id'] !== 'string') {
        continue;
      }
      const sourcePackage = packages.get(nodeInput['id']);
      if (sourcePackage === undefined) {
        continue;
      }
      for (const dependencyId of readResolveDependencies(nodeInput)) {
        const targetPackage = packages.get(dependencyId);
        if (targetPackage === undefined) {
          continue;
        }
        edges.push({
          from: sourcePackage.sourcePath,
          to: targetPackage.sourcePath,
          importPath: targetPackage.name,
          kind: 'cargo',
        });
      }
    }
  }

  return {
    schemaVersion: 1,
    nodes,
    edges: edges.toSorted(
      (left, right) =>
        left.from.localeCompare(right.from) ||
        left.to.localeCompare(right.to) ||
        left.importPath.localeCompare(right.importPath),
    ),
  };
};

const readCargoMetadata = (): unknown => {
  return JSON.parse(
    execFileUtf8('cargo', ['metadata', '--format-version', '1', '--no-deps']),
  ) as unknown;
};

export const runLiveCargoCheck = (policyInput: unknown): Promise<CargoCheckResult> => {
  const metadata = readCargoMetadata();
  const repositoryRoot =
    isRecord(metadata) && typeof metadata['workspace_root'] === 'string'
      ? metadata['workspace_root']
      : process.cwd();
  const graph = normalizeCargoMetadata(policyInput, metadata, repositoryRoot);
  return Promise.resolve({
    adapter: 'cargo' as const,
    graph,
    policy: evaluateGraph(policyInput, graph),
  });
};
