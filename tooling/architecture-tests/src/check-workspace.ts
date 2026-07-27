import canonicalPolicy from '../../../architecture/module-boundaries.json' with { type: 'json' };
import {
  execFileUtf8,
  normalizeRepositoryPath,
  runLiveCargoCheck,
  runtimeClassForPath,
  type CargoCheckResult,
  type NormalizedDependencyEdge,
  type NormalizedDependencyGraph,
} from './check-cargo.ts';
import { evaluateGraph, type PolicyResult } from './policy.ts';

export interface DependencyCruiserRestriction {
  name: string;
  severity: 'error';
  comment: string;
  from: {
    path?: string;
    pathNot?: string;
  };
  to: {
    path?: string;
    pathNot?: string;
    circular?: boolean;
  };
}

export interface WorkspaceCheckResult {
  adapter: 'workspace';
  graph: NormalizedDependencyGraph;
  policy: PolicyResult;
}

export interface ArchitectureCheckResult {
  ok: boolean;
  executionCounts: {
    workspace: number;
    cargo: number;
  };
  workspace: WorkspaceCheckResult;
  cargo: CargoCheckResult;
}

interface CanonicalLayer {
  name: string;
  allowedDependencies: string[];
}

interface CanonicalModule {
  id: string;
  layer: string;
  roots: string[];
  publicRoots: string[];
  runtimeClass: 'production' | 'fixture' | 'tooling';
}

interface CanonicalException {
  from: string;
  to: string;
}

interface CanonicalPolicy {
  layers: CanonicalLayer[];
  modules: CanonicalModule[];
  exceptions: CanonicalException[];
}

declare const process: {
  argv: string[];
  cwd: () => string;
  execPath: string;
  exitCode?: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];

const isRuntimeClass = (value: unknown): value is CanonicalModule['runtimeClass'] =>
  value === 'production' || value === 'fixture' || value === 'tooling';

const readCanonicalPolicy = (policyInput: unknown): CanonicalPolicy => {
  if (
    !isRecord(policyInput) ||
    !Array.isArray(policyInput['layers']) ||
    !Array.isArray(policyInput['modules']) ||
    !Array.isArray(policyInput['exceptions'])
  ) {
    throw new Error('Canonical policy must define layers, modules, and exceptions.');
  }

  const layers = policyInput['layers'].map((layerInput, index) => {
    if (!isRecord(layerInput) || typeof layerInput['name'] !== 'string') {
      throw new Error(`Canonical layer at index ${String(index)} is invalid.`);
    }
    return {
      name: layerInput['name'],
      allowedDependencies: readStringArray(layerInput['allowedDependencies']),
    };
  });
  const modules = policyInput['modules'].map((moduleInput, index) => {
    const runtimeClass = isRecord(moduleInput) ? moduleInput['runtimeClass'] : undefined;
    if (
      !isRecord(moduleInput) ||
      typeof moduleInput['id'] !== 'string' ||
      typeof moduleInput['layer'] !== 'string' ||
      !Array.isArray(moduleInput['roots']) ||
      !Array.isArray(moduleInput['publicRoots']) ||
      !isRuntimeClass(runtimeClass)
    ) {
      throw new Error(`Canonical module at index ${String(index)} is invalid.`);
    }
    return {
      id: moduleInput['id'],
      layer: moduleInput['layer'],
      roots: readStringArray(moduleInput['roots']).map(normalizeRepositoryPath),
      publicRoots: readStringArray(moduleInput['publicRoots']).map(normalizeRepositoryPath),
      runtimeClass,
    };
  });
  const exceptions = policyInput['exceptions'].map((exceptionInput, index) => {
    if (
      !isRecord(exceptionInput) ||
      typeof exceptionInput['from'] !== 'string' ||
      typeof exceptionInput['to'] !== 'string'
    ) {
      throw new Error(`Canonical exception at index ${String(index)} is invalid.`);
    }
    return {
      from: exceptionInput['from'],
      to: exceptionInput['to'],
    };
  });

  return { layers, modules, exceptions };
};

const escapeRegularExpression = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const rootPattern = (roots: string[]): string => {
  const escapedRoots = roots.map(escapeRegularExpression);
  return escapedRoots.length === 1
    ? `^${escapedRoots[0] ?? ''}(?:/|$)`
    : `^(?:${escapedRoots.join('|')})(?:/|$)`;
};

const exactPathPattern = (paths: string[]): string => {
  const escapedPaths = paths.map(escapeRegularExpression);
  return escapedPaths.length === 1
    ? `^${escapedPaths[0] ?? ''}$`
    : `^(?:${escapedPaths.join('|')})$`;
};

export const createCanonicalRootPattern = (policyInput: unknown): string =>
  rootPattern(readCanonicalPolicy(policyInput).modules.flatMap(({ roots }) => roots));

export const createDependencyCruiserRestrictions = (
  policyInput: unknown,
): DependencyCruiserRestriction[] => {
  const policy = readCanonicalPolicy(policyInput);
  const layers = new Map(policy.layers.map((layer) => [layer.name, layer]));
  const exceptions = new Set(policy.exceptions.map(({ from, to }) => `${from}\u0000${to}`));
  const allRoots = policy.modules.flatMap(({ roots }) => roots);
  const rules: DependencyCruiserRestriction[] = [
    {
      name: 'canonical-no-cycles',
      severity: 'error',
      comment: 'Canonical modules must remain acyclic.',
      from: { path: rootPattern(allRoots) },
      to: { circular: true },
    },
  ];

  const productionRoots = policy.modules
    .filter(({ runtimeClass }) => runtimeClass === 'production')
    .flatMap(({ roots }) => roots);
  const fixtureRoots = policy.modules
    .filter(({ runtimeClass }) => runtimeClass === 'fixture')
    .flatMap(({ roots }) => roots);
  if (productionRoots.length > 0 && fixtureRoots.length > 0) {
    rules.push({
      name: 'canonical-no-production-fixture',
      severity: 'error',
      comment: 'Production modules cannot depend on fixture modules.',
      from: { path: rootPattern(productionRoots) },
      to: { path: rootPattern(fixtureRoots) },
    });
  }

  for (const sourceModule of policy.modules) {
    const allowedLayers = layers.get(sourceModule.layer)?.allowedDependencies ?? [];
    const forbiddenRoots = policy.modules
      .filter(
        (targetModule) =>
          targetModule.id !== sourceModule.id &&
          !allowedLayers.includes(targetModule.layer) &&
          !exceptions.has(`${sourceModule.id}\u0000${targetModule.id}`),
      )
      .flatMap(({ roots }) => roots);
    if (forbiddenRoots.length > 0) {
      rules.push({
        name: `canonical-layer-${sourceModule.id}`,
        severity: 'error',
        comment: 'Dependency direction is derived from the canonical layer policy.',
        from: { path: rootPattern(sourceModule.roots) },
        to: { path: rootPattern(forbiddenRoots) },
      });
    }

    rules.push({
      name: `canonical-public-${sourceModule.id}`,
      severity: 'error',
      comment: 'Cross-module imports must target a canonical public root.',
      from: {
        path: rootPattern(allRoots),
        pathNot: rootPattern(sourceModule.roots),
      },
      to: {
        path: rootPattern(sourceModule.roots),
        pathNot: exactPathPattern(sourceModule.publicRoots),
      },
    });
  }

  return rules.toSorted((left, right) => left.name.localeCompare(right.name));
};

const isRepositoryDependency = (dependency: Record<string, unknown>): boolean => {
  if (dependency['couldNotResolve'] === true || typeof dependency['resolved'] !== 'string') {
    return false;
  }
  const dependencyTypes = readStringArray(dependency['dependencyTypes']);
  const isExternal = dependencyTypes.some(
    (dependencyType) => dependencyType === 'core' || dependencyType.startsWith('npm'),
  );
  return !isExternal && !normalizeRepositoryPath(dependency['resolved']).includes('node_modules/');
};

export const normalizeDependencyCruiserResult = (
  policyInput: unknown,
  cruiseResultInput: unknown,
): NormalizedDependencyGraph => {
  if (!isRecord(cruiseResultInput) || !Array.isArray(cruiseResultInput['modules'])) {
    throw new Error('Dependency-cruiser output must contain a modules array.');
  }
  const nodePaths = new Set<string>();
  const edges: NormalizedDependencyEdge[] = [];

  for (const moduleInput of cruiseResultInput['modules']) {
    if (
      !isRecord(moduleInput) ||
      typeof moduleInput['source'] !== 'string' ||
      !Array.isArray(moduleInput['dependencies'])
    ) {
      continue;
    }
    const source = normalizeRepositoryPath(moduleInput['source']);
    nodePaths.add(source);
    for (const dependencyInput of moduleInput['dependencies']) {
      if (!isRecord(dependencyInput) || !isRepositoryDependency(dependencyInput)) {
        continue;
      }
      const target = normalizeRepositoryPath(dependencyInput['resolved'] as string);
      const importPath =
        typeof dependencyInput['module'] === 'string' ? dependencyInput['module'] : target;
      nodePaths.add(target);
      edges.push({
        from: source,
        to: target,
        importPath,
        kind: 'typescript',
      });
    }
  }

  return {
    schemaVersion: 1,
    nodes: [...nodePaths]
      .toSorted()
      .map((path) => ({ path, runtimeClass: runtimeClassForPath(policyInput, path) })),
    edges: edges.toSorted(
      (left, right) =>
        left.from.localeCompare(right.from) ||
        left.to.localeCompare(right.to) ||
        left.importPath.localeCompare(right.importPath),
    ),
  };
};

const readCruiseOutput = (output: unknown): unknown => {
  if (typeof output === 'string') {
    return JSON.parse(output) as unknown;
  }
  return output;
};

const runDependencyCruiser = (): unknown => {
  const output = execFileUtf8(process.execPath, [
    'node_modules/dependency-cruiser/bin/dependency-cruise.mjs',
    '--config',
    'dependency-cruiser.config.mjs',
    '--output-type',
    'json',
    '.',
  ]);
  return JSON.parse(output) as unknown;
};

export const runLiveWorkspaceCheck = (policyInput: unknown): Promise<WorkspaceCheckResult> => {
  const graph = normalizeDependencyCruiserResult(
    policyInput,
    readCruiseOutput(runDependencyCruiser()),
  );
  return Promise.resolve({
    adapter: 'workspace' as const,
    graph,
    policy: evaluateGraph(policyInput, graph),
  });
};

export const runArchitectureAdapters = async (
  workspaceAdapter: () => Promise<WorkspaceCheckResult>,
  cargoAdapter: () => Promise<CargoCheckResult>,
): Promise<ArchitectureCheckResult> => {
  let workspaceExecutions = 0;
  let cargoExecutions = 0;
  const workspace = await workspaceAdapter();
  workspaceExecutions += 1;
  const cargo = await cargoAdapter();
  cargoExecutions += 1;
  return {
    ok: workspace.policy.ok && cargo.policy.ok,
    executionCounts: {
      workspace: workspaceExecutions,
      cargo: cargoExecutions,
    },
    workspace,
    cargo,
  };
};

const isDirectExecution = (): boolean =>
  normalizeRepositoryPath(process.argv[1] ?? '').endsWith(
    'tooling/architecture-tests/src/check-workspace.ts',
  );

if (isDirectExecution()) {
  const result = await runArchitectureAdapters(
    async () => runLiveWorkspaceCheck(canonicalPolicy),
    async () => runLiveCargoCheck(canonicalPolicy),
  );
  console.log(
    `Architecture adapters executed: workspace=${String(result.executionCounts.workspace)}, cargo=${String(result.executionCounts.cargo)}.`,
  );
  if (!result.ok) {
    console.error(
      JSON.stringify(
        {
          workspace: result.workspace.policy.diagnostics,
          cargo: result.cargo.policy.diagnostics,
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  }
}
