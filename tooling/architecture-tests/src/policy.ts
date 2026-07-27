export type RuntimeClass = 'production' | 'fixture' | 'tooling';
export type ModuleStatus = 'active' | 'reserved';
export type DependencyKind = 'typescript' | 'cargo';

export interface PolicyDiagnostic {
  code: string;
  path: string;
  message: string;
}

export interface PolicyResult {
  ok: boolean;
  diagnostics: PolicyDiagnostic[];
}

interface LayerPolicy {
  name: string;
  allowedDependencies: string[];
}

interface ModulePolicy {
  id: string;
  owner: string;
  layer: string;
  roots: string[];
  publicRoots: string[];
  runtimeClass: RuntimeClass;
  status: ModuleStatus;
}

interface NamedException {
  name: string;
  from: string;
  to: string;
  reason: string;
}

interface ModuleBoundaryPolicy {
  schemaVersion: 1;
  layers: LayerPolicy[];
  modules: ModulePolicy[];
  exceptions: NamedException[];
}

interface GraphNode {
  path: string;
  runtimeClass: RuntimeClass;
}

interface DependencyEdge {
  from: string;
  to: string;
  importPath: string;
  kind: DependencyKind;
}

interface DependencyGraph {
  schemaVersion: 1;
  nodes: GraphNode[];
  edges: DependencyEdge[];
}

interface ParsedPolicy {
  policy?: ModuleBoundaryPolicy;
  diagnostics: PolicyDiagnostic[];
}

interface ParsedGraph {
  graph?: DependencyGraph;
  diagnostics: PolicyDiagnostic[];
}

const POLICY_KEYS = new Set(['$schema', 'schemaVersion', 'layers', 'modules', 'exceptions']);
const LAYER_KEYS = new Set(['name', 'allowedDependencies']);
const MODULE_KEYS = new Set([
  'id',
  'owner',
  'layer',
  'roots',
  'publicRoots',
  'runtimeClass',
  'status',
]);
const EXCEPTION_KEYS = new Set(['name', 'from', 'to', 'reason']);
const GRAPH_KEYS = new Set(['schemaVersion', 'nodes', 'edges']);
const NODE_KEYS = new Set(['path', 'runtimeClass']);
const EDGE_KEYS = new Set(['from', 'to', 'importPath', 'kind']);

const RUNTIME_CLASSES = new Set<RuntimeClass>(['production', 'fixture', 'tooling']);
const MODULE_STATUSES = new Set<ModuleStatus>(['active', 'reserved']);
const DEPENDENCY_KINDS = new Set<DependencyKind>(['typescript', 'cargo']);
const IDENTIFIER_PATTERN = /^[a-z][a-z0-9-]*$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizePath = (value: string): string => value.replaceAll('\\', '/').replace(/^\.\//, '');

const isSafeRelativePath = (value: string): boolean => {
  const normalized = normalizePath(value);
  return (
    normalized.length > 0 && !normalized.startsWith('/') && !normalized.split('/').includes('..')
  );
};

const pathIsWithin = (root: string, path: string): boolean => {
  const normalizedRoot = normalizePath(root).replace(/\/+$/, '');
  const normalizedPath = normalizePath(path);
  return normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}/`);
};

const schemaDiagnostic = (path: string, message: string): PolicyDiagnostic => ({
  code: 'POLICY_SCHEMA_INVALID',
  path,
  message,
});

const graphSchemaDiagnostic = (path: string, message: string): PolicyDiagnostic => ({
  code: 'GRAPH_SCHEMA_INVALID',
  path,
  message,
});

const sortDiagnostics = (diagnostics: PolicyDiagnostic[]): PolicyDiagnostic[] =>
  diagnostics.toSorted(
    (left, right) =>
      left.code.localeCompare(right.code) ||
      left.path.localeCompare(right.path) ||
      left.message.localeCompare(right.message),
  );

const addUnexpectedKeyDiagnostics = (
  record: Record<string, unknown>,
  allowedKeys: ReadonlySet<string>,
  path: string,
  diagnostics: PolicyDiagnostic[],
  createDiagnostic: (keyPath: string, message: string) => PolicyDiagnostic,
): void => {
  for (const key of Object.keys(record).toSorted()) {
    if (!allowedKeys.has(key)) {
      diagnostics.push(createDiagnostic(`${path}.${key}`, `Unexpected property "${key}".`));
    }
  }
};

const readString = (
  record: Record<string, unknown>,
  key: string,
  path: string,
  diagnostics: PolicyDiagnostic[],
  createDiagnostic: (keyPath: string, message: string) => PolicyDiagnostic,
): string | undefined => {
  const value = record[key];
  if (typeof value !== 'string' || value.length === 0) {
    diagnostics.push(createDiagnostic(`${path}.${key}`, 'Expected a non-empty string.'));
    return undefined;
  }
  return value;
};

const readStringArray = (
  record: Record<string, unknown>,
  key: string,
  path: string,
  diagnostics: PolicyDiagnostic[],
  createDiagnostic: (keyPath: string, message: string) => PolicyDiagnostic,
  minimumLength: number,
): string[] | undefined => {
  const value = record[key];
  if (!Array.isArray(value) || value.length < minimumLength) {
    diagnostics.push(
      createDiagnostic(
        `${path}.${key}`,
        `Expected an array with at least ${String(minimumLength)} item(s).`,
      ),
    );
    return undefined;
  }

  const result: string[] = [];
  for (const [index, entry] of value.entries()) {
    if (typeof entry !== 'string' || entry.length === 0) {
      diagnostics.push(
        createDiagnostic(`${path}.${key}[${String(index)}]`, 'Expected a non-empty string.'),
      );
      continue;
    }
    result.push(entry);
  }

  if (new Set(result).size !== result.length) {
    diagnostics.push(createDiagnostic(`${path}.${key}`, 'Expected unique items.'));
  }
  return result;
};

const readIdentifier = (
  record: Record<string, unknown>,
  key: string,
  path: string,
  diagnostics: PolicyDiagnostic[],
): string | undefined => {
  const value = readString(record, key, path, diagnostics, schemaDiagnostic);
  if (value !== undefined && !IDENTIFIER_PATTERN.test(value)) {
    diagnostics.push(
      schemaDiagnostic(
        `${path}.${key}`,
        'Expected a lowercase identifier containing only letters, numbers, and hyphens.',
      ),
    );
    return undefined;
  }
  return value;
};

const readPathArray = (
  record: Record<string, unknown>,
  key: string,
  path: string,
  diagnostics: PolicyDiagnostic[],
): string[] | undefined => {
  const values = readStringArray(record, key, path, diagnostics, schemaDiagnostic, 1);
  if (values === undefined) {
    return undefined;
  }
  for (const [index, value] of values.entries()) {
    if (!isSafeRelativePath(value)) {
      diagnostics.push(
        schemaDiagnostic(
          `${path}.${key}[${String(index)}]`,
          'Expected a safe repository-relative path.',
        ),
      );
    }
  }
  return values.map(normalizePath);
};

const parseLayer = (
  value: unknown,
  index: number,
  diagnostics: PolicyDiagnostic[],
): LayerPolicy | undefined => {
  const path = `$.layers[${String(index)}]`;
  if (!isRecord(value)) {
    diagnostics.push(schemaDiagnostic(path, 'Expected an object.'));
    return undefined;
  }
  addUnexpectedKeyDiagnostics(value, LAYER_KEYS, path, diagnostics, schemaDiagnostic);
  const name = readIdentifier(value, 'name', path, diagnostics);
  const allowedDependencies = readStringArray(
    value,
    'allowedDependencies',
    path,
    diagnostics,
    schemaDiagnostic,
    0,
  );
  if (name === undefined || allowedDependencies === undefined) {
    return undefined;
  }
  for (const [dependencyIndex, dependency] of allowedDependencies.entries()) {
    if (!IDENTIFIER_PATTERN.test(dependency)) {
      diagnostics.push(
        schemaDiagnostic(
          `${path}.allowedDependencies[${String(dependencyIndex)}]`,
          'Expected a lowercase identifier containing only letters, numbers, and hyphens.',
        ),
      );
    }
  }
  return { name, allowedDependencies };
};

const parseRuntimeClass = (
  value: unknown,
  path: string,
  diagnostics: PolicyDiagnostic[],
  createDiagnostic: (keyPath: string, message: string) => PolicyDiagnostic,
): RuntimeClass | undefined => {
  if (typeof value !== 'string' || !RUNTIME_CLASSES.has(value as RuntimeClass)) {
    diagnostics.push(
      createDiagnostic(path, 'Expected one of "production", "fixture", or "tooling".'),
    );
    return undefined;
  }
  return value as RuntimeClass;
};

const parseModule = (
  value: unknown,
  index: number,
  diagnostics: PolicyDiagnostic[],
): ModulePolicy | undefined => {
  const path = `$.modules[${String(index)}]`;
  if (!isRecord(value)) {
    diagnostics.push(schemaDiagnostic(path, 'Expected an object.'));
    return undefined;
  }
  addUnexpectedKeyDiagnostics(value, MODULE_KEYS, path, diagnostics, schemaDiagnostic);
  const id = readIdentifier(value, 'id', path, diagnostics);
  const owner = readString(value, 'owner', path, diagnostics, schemaDiagnostic);
  const layer = readIdentifier(value, 'layer', path, diagnostics);
  const roots = readPathArray(value, 'roots', path, diagnostics);
  const publicRoots = readPathArray(value, 'publicRoots', path, diagnostics);
  const runtimeClass = parseRuntimeClass(
    value['runtimeClass'],
    `${path}.runtimeClass`,
    diagnostics,
    schemaDiagnostic,
  );
  const statusValue = value['status'];
  let status: ModuleStatus | undefined;
  if (typeof statusValue === 'string' && MODULE_STATUSES.has(statusValue as ModuleStatus)) {
    status = statusValue as ModuleStatus;
  } else {
    diagnostics.push(schemaDiagnostic(`${path}.status`, 'Expected one of "active" or "reserved".'));
  }

  if (
    id === undefined ||
    owner === undefined ||
    layer === undefined ||
    roots === undefined ||
    publicRoots === undefined ||
    runtimeClass === undefined ||
    status === undefined
  ) {
    return undefined;
  }
  return { id, owner, layer, roots, publicRoots, runtimeClass, status };
};

const parseException = (
  value: unknown,
  index: number,
  diagnostics: PolicyDiagnostic[],
): NamedException | undefined => {
  const path = `$.exceptions[${String(index)}]`;
  if (!isRecord(value)) {
    diagnostics.push(schemaDiagnostic(path, 'Expected an object.'));
    return undefined;
  }
  addUnexpectedKeyDiagnostics(value, EXCEPTION_KEYS, path, diagnostics, schemaDiagnostic);
  const name = readIdentifier(value, 'name', path, diagnostics);
  const from = readIdentifier(value, 'from', path, diagnostics);
  const to = readIdentifier(value, 'to', path, diagnostics);
  const reason = readString(value, 'reason', path, diagnostics, schemaDiagnostic);
  if (name === undefined || from === undefined || to === undefined || reason === undefined) {
    return undefined;
  }
  return { name, from, to, reason };
};

const parsePolicy = (input: unknown): ParsedPolicy => {
  const diagnostics: PolicyDiagnostic[] = [];
  if (!isRecord(input)) {
    return {
      diagnostics: [schemaDiagnostic('$', 'Expected an object.')],
    };
  }

  addUnexpectedKeyDiagnostics(input, POLICY_KEYS, '$', diagnostics, schemaDiagnostic);
  if (input['schemaVersion'] !== 1) {
    diagnostics.push(schemaDiagnostic('$.schemaVersion', 'Expected schemaVersion to equal 1.'));
  }

  const layers: LayerPolicy[] = [];
  if (!Array.isArray(input['layers']) || input['layers'].length === 0) {
    diagnostics.push(schemaDiagnostic('$.layers', 'Expected a non-empty array.'));
  } else {
    for (const [index, layer] of input['layers'].entries()) {
      const parsed = parseLayer(layer, index, diagnostics);
      if (parsed !== undefined) {
        layers.push(parsed);
      }
    }
  }

  const modules: ModulePolicy[] = [];
  if (!Array.isArray(input['modules']) || input['modules'].length === 0) {
    diagnostics.push(schemaDiagnostic('$.modules', 'Expected a non-empty array.'));
  } else {
    for (const [index, module] of input['modules'].entries()) {
      const parsed = parseModule(module, index, diagnostics);
      if (parsed !== undefined) {
        modules.push(parsed);
      }
    }
  }

  const exceptions: NamedException[] = [];
  if (!Array.isArray(input['exceptions'])) {
    diagnostics.push(schemaDiagnostic('$.exceptions', 'Expected an array.'));
  } else {
    for (const [index, exception] of input['exceptions'].entries()) {
      const parsed = parseException(exception, index, diagnostics);
      if (parsed !== undefined) {
        exceptions.push(parsed);
      }
    }
  }

  if (diagnostics.length > 0) {
    return { diagnostics: sortDiagnostics(diagnostics) };
  }
  return {
    policy: {
      schemaVersion: 1,
      layers,
      modules,
      exceptions,
    },
    diagnostics: [],
  };
};

const validatePolicySemantics = (policy: ModuleBoundaryPolicy): PolicyDiagnostic[] => {
  const diagnostics: PolicyDiagnostic[] = [];
  const layersByName = new Map<string, LayerPolicy>();
  for (const layer of policy.layers) {
    if (layersByName.has(layer.name)) {
      diagnostics.push({
        code: 'DUPLICATE_LAYER',
        path: layer.name,
        message: `Layer "${layer.name}" is declared more than once.`,
      });
    } else {
      layersByName.set(layer.name, layer);
    }
  }
  for (const layer of policy.layers) {
    for (const dependency of layer.allowedDependencies) {
      if (!layersByName.has(dependency)) {
        diagnostics.push({
          code: 'UNKNOWN_LAYER',
          path: `${layer.name} -> ${dependency}`,
          message: `Layer "${layer.name}" allows unknown layer "${dependency}".`,
        });
      }
    }
  }

  const modulesById = new Map<string, ModulePolicy>();
  for (const module of policy.modules) {
    if (modulesById.has(module.id)) {
      diagnostics.push({
        code: 'DUPLICATE_MODULE',
        path: module.id,
        message: `Module "${module.id}" is declared more than once.`,
      });
    } else {
      modulesById.set(module.id, module);
    }
    if (!layersByName.has(module.layer)) {
      diagnostics.push({
        code: 'UNKNOWN_LAYER',
        path: module.id,
        message: `Module "${module.id}" uses unknown layer "${module.layer}".`,
      });
    }
    for (const publicRoot of module.publicRoots) {
      if (!module.roots.some((root) => pathIsWithin(root, publicRoot))) {
        diagnostics.push({
          code: 'PUBLIC_ROOT_OUTSIDE_OWNER',
          path: publicRoot,
          message: `Public root "${publicRoot}" is outside module "${module.id}".`,
        });
      }
    }
  }

  const sortedModules = policy.modules.toSorted((left, right) => left.id.localeCompare(right.id));
  for (const [leftIndex, left] of sortedModules.entries()) {
    for (const right of sortedModules.slice(leftIndex + 1)) {
      for (const leftRoot of left.roots) {
        for (const rightRoot of right.roots) {
          if (pathIsWithin(leftRoot, rightRoot) || pathIsWithin(rightRoot, leftRoot)) {
            const diagnosticPath =
              leftRoot.length >= rightRoot.length
                ? normalizePath(leftRoot)
                : normalizePath(rightRoot);
            diagnostics.push({
              code: 'DUPLICATE_OWNER',
              path: diagnosticPath,
              message: `Root "${diagnosticPath}" is owned by both "${left.id}" and "${right.id}".`,
            });
          }
        }
      }
    }
  }

  const exceptionNames = new Set<string>();
  for (const exception of policy.exceptions) {
    if (exceptionNames.has(exception.name)) {
      diagnostics.push({
        code: 'DUPLICATE_EXCEPTION',
        path: exception.name,
        message: `Exception "${exception.name}" is declared more than once.`,
      });
    }
    exceptionNames.add(exception.name);
    if (!modulesById.has(exception.from)) {
      diagnostics.push({
        code: 'UNKNOWN_EXCEPTION_MODULE',
        path: exception.name,
        message: `Exception "${exception.name}" references unknown source module "${exception.from}".`,
      });
    }
    if (!modulesById.has(exception.to)) {
      diagnostics.push({
        code: 'UNKNOWN_EXCEPTION_MODULE',
        path: exception.name,
        message: `Exception "${exception.name}" references unknown target module "${exception.to}".`,
      });
    }
  }
  return sortDiagnostics(diagnostics);
};

const parseAndValidatePolicy = (input: unknown): ParsedPolicy => {
  const parsed = parsePolicy(input);
  if (parsed.policy === undefined) {
    return parsed;
  }
  const diagnostics = validatePolicySemantics(parsed.policy);
  return diagnostics.length === 0 ? parsed : { diagnostics };
};

export const validatePolicy = (input: unknown): PolicyResult => {
  const parsed = parseAndValidatePolicy(input);
  return {
    ok: parsed.policy !== undefined,
    diagnostics: parsed.diagnostics,
  };
};

const parseGraphNode = (
  value: unknown,
  index: number,
  diagnostics: PolicyDiagnostic[],
): GraphNode | undefined => {
  const path = `$.nodes[${String(index)}]`;
  if (!isRecord(value)) {
    diagnostics.push(graphSchemaDiagnostic(path, 'Expected an object.'));
    return undefined;
  }
  addUnexpectedKeyDiagnostics(value, NODE_KEYS, path, diagnostics, graphSchemaDiagnostic);
  const nodePath = readString(value, 'path', path, diagnostics, graphSchemaDiagnostic);
  const runtimeClass = parseRuntimeClass(
    value['runtimeClass'],
    `${path}.runtimeClass`,
    diagnostics,
    graphSchemaDiagnostic,
  );
  if (nodePath === undefined || runtimeClass === undefined) {
    return undefined;
  }
  if (!isSafeRelativePath(nodePath)) {
    diagnostics.push(
      graphSchemaDiagnostic(`${path}.path`, 'Expected a safe repository-relative path.'),
    );
  }
  return { path: normalizePath(nodePath), runtimeClass };
};

const parseGraphEdge = (
  value: unknown,
  index: number,
  diagnostics: PolicyDiagnostic[],
): DependencyEdge | undefined => {
  const path = `$.edges[${String(index)}]`;
  if (!isRecord(value)) {
    diagnostics.push(graphSchemaDiagnostic(path, 'Expected an object.'));
    return undefined;
  }
  addUnexpectedKeyDiagnostics(value, EDGE_KEYS, path, diagnostics, graphSchemaDiagnostic);
  const from = readString(value, 'from', path, diagnostics, graphSchemaDiagnostic);
  const to = readString(value, 'to', path, diagnostics, graphSchemaDiagnostic);
  const importPath = readString(value, 'importPath', path, diagnostics, graphSchemaDiagnostic);
  const kindValue = value['kind'];
  let kind: DependencyKind | undefined;
  if (typeof kindValue === 'string' && DEPENDENCY_KINDS.has(kindValue as DependencyKind)) {
    kind = kindValue as DependencyKind;
  } else {
    diagnostics.push(
      graphSchemaDiagnostic(`${path}.kind`, 'Expected one of "typescript" or "cargo".'),
    );
  }
  if (from === undefined || to === undefined || importPath === undefined || kind === undefined) {
    return undefined;
  }
  return {
    from: normalizePath(from),
    to: normalizePath(to),
    importPath,
    kind,
  };
};

const parseGraph = (input: unknown): ParsedGraph => {
  const diagnostics: PolicyDiagnostic[] = [];
  if (!isRecord(input)) {
    return {
      diagnostics: [graphSchemaDiagnostic('$', 'Expected an object.')],
    };
  }
  addUnexpectedKeyDiagnostics(input, GRAPH_KEYS, '$', diagnostics, graphSchemaDiagnostic);
  if (input['schemaVersion'] !== 1) {
    diagnostics.push(
      graphSchemaDiagnostic('$.schemaVersion', 'Expected schemaVersion to equal 1.'),
    );
  }

  const nodes: GraphNode[] = [];
  if (!Array.isArray(input['nodes'])) {
    diagnostics.push(graphSchemaDiagnostic('$.nodes', 'Expected an array.'));
  } else {
    for (const [index, node] of input['nodes'].entries()) {
      const parsed = parseGraphNode(node, index, diagnostics);
      if (parsed !== undefined) {
        nodes.push(parsed);
      }
    }
  }

  const edges: DependencyEdge[] = [];
  if (!Array.isArray(input['edges'])) {
    diagnostics.push(graphSchemaDiagnostic('$.edges', 'Expected an array.'));
  } else {
    for (const [index, edge] of input['edges'].entries()) {
      const parsed = parseGraphEdge(edge, index, diagnostics);
      if (parsed !== undefined) {
        edges.push(parsed);
      }
    }
  }

  if (diagnostics.length > 0) {
    return { diagnostics: sortDiagnostics(diagnostics) };
  }
  return {
    graph: {
      schemaVersion: 1,
      nodes,
      edges,
    },
    diagnostics: [],
  };
};

const findOwner = (policy: ModuleBoundaryPolicy, path: string): ModulePolicy[] =>
  policy.modules
    .filter((module) => module.roots.some((root) => pathIsWithin(root, path)))
    .toSorted((left, right) => left.id.localeCompare(right.id));

const findCycle = (graph: DependencyGraph): string[] | undefined => {
  const paths = graph.nodes.map((node) => node.path).toSorted();
  const pathSet = new Set(paths);
  const adjacency = new Map<string, string[]>(paths.map((path) => [path, []]));
  const indegree = new Map<string, number>(paths.map((path) => [path, 0]));

  for (const edge of graph.edges) {
    if (!pathSet.has(edge.from) || !pathSet.has(edge.to)) {
      continue;
    }
    const neighbors = adjacency.get(edge.from);
    if (neighbors !== undefined && !neighbors.includes(edge.to)) {
      neighbors.push(edge.to);
      indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
    }
  }
  for (const neighbors of adjacency.values()) {
    neighbors.sort((left, right) => left.localeCompare(right));
  }

  const ready = paths.filter((path) => indegree.get(path) === 0);
  let processedCount = 0;
  while (ready.length > 0) {
    const current = ready.shift();
    if (current === undefined) {
      break;
    }
    processedCount += 1;
    for (const next of adjacency.get(current) ?? []) {
      const nextIndegree = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, nextIndegree);
      if (nextIndegree === 0) {
        ready.push(next);
        ready.sort((left, right) => left.localeCompare(right));
      }
    }
  }
  if (processedCount === paths.length) {
    return undefined;
  }

  const remaining = new Set(paths.filter((path) => (indegree.get(path) ?? 0) > 0));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  const visit = (current: string): string[] | undefined => {
    visiting.add(current);
    stack.push(current);
    for (const next of adjacency.get(current) ?? []) {
      if (!remaining.has(next)) {
        continue;
      }
      if (visiting.has(next)) {
        const cycleStart = stack.indexOf(next);
        return [...stack.slice(cycleStart), next];
      }
      if (!visited.has(next)) {
        const cycle = visit(next);
        if (cycle !== undefined) {
          return cycle;
        }
      }
    }
    stack.pop();
    visiting.delete(current);
    visited.add(current);
    return undefined;
  };

  for (const path of [...remaining].toSorted()) {
    if (!visited.has(path)) {
      const cycle = visit(path);
      if (cycle !== undefined) {
        return cycle;
      }
    }
  }
  return undefined;
};

export const evaluateGraph = (policyInput: unknown, graphInput: unknown): PolicyResult => {
  const parsedPolicy = parseAndValidatePolicy(policyInput);
  if (parsedPolicy.policy === undefined) {
    return { ok: false, diagnostics: parsedPolicy.diagnostics };
  }
  const parsedGraph = parseGraph(graphInput);
  if (parsedGraph.graph === undefined) {
    return { ok: false, diagnostics: parsedGraph.diagnostics };
  }

  const policy = parsedPolicy.policy;
  const graph = parsedGraph.graph;
  const diagnostics: PolicyDiagnostic[] = [];
  const nodePaths = new Set<string>();
  const ownersByPath = new Map<string, ModulePolicy>();

  for (const node of graph.nodes.toSorted((left, right) => left.path.localeCompare(right.path))) {
    if (nodePaths.has(node.path)) {
      diagnostics.push({
        code: 'DUPLICATE_NODE',
        path: node.path,
        message: `Graph node "${node.path}" is declared more than once.`,
      });
      continue;
    }
    nodePaths.add(node.path);
    const owners = findOwner(policy, node.path);
    if (owners.length === 0) {
      diagnostics.push({
        code: 'UNKNOWN_OWNER',
        path: node.path,
        message: `No module owns "${node.path}".`,
      });
      continue;
    }
    if (owners.length > 1) {
      diagnostics.push({
        code: 'DUPLICATE_OWNER',
        path: node.path,
        message: `Path "${node.path}" is owned by ${owners.map((owner) => `"${owner.id}"`).join(', ')}.`,
      });
      continue;
    }
    const owner = owners[0];
    if (owner === undefined) {
      continue;
    }
    ownersByPath.set(node.path, owner);
    if (node.runtimeClass !== owner.runtimeClass) {
      diagnostics.push({
        code: 'RUNTIME_CLASS_MISMATCH',
        path: node.path,
        message: `Node "${node.path}" claims runtime class "${node.runtimeClass}", but module "${owner.id}" is "${owner.runtimeClass}".`,
      });
    }
  }

  const layersByName = new Map(policy.layers.map((layer) => [layer.name, layer]));
  const exceptions = new Set(
    policy.exceptions.map((exception) => `${exception.from}\u0000${exception.to}`),
  );
  const sortedEdges = graph.edges.toSorted(
    (left, right) =>
      left.from.localeCompare(right.from) ||
      left.to.localeCompare(right.to) ||
      left.importPath.localeCompare(right.importPath),
  );

  for (const edge of sortedEdges) {
    if (!nodePaths.has(edge.from)) {
      diagnostics.push({
        code: 'UNKNOWN_EDGE_NODE',
        path: edge.from,
        message: `Dependency source "${edge.from}" is not a graph node.`,
      });
      continue;
    }
    if (!nodePaths.has(edge.to)) {
      diagnostics.push({
        code: 'UNKNOWN_EDGE_NODE',
        path: edge.to,
        message: `Dependency target "${edge.to}" is not a graph node.`,
      });
      continue;
    }
    const sourceOwner = ownersByPath.get(edge.from);
    const targetOwner = ownersByPath.get(edge.to);
    if (
      sourceOwner === undefined ||
      targetOwner === undefined ||
      sourceOwner.id === targetOwner.id
    ) {
      continue;
    }

    if (sourceOwner.runtimeClass === 'production' && targetOwner.runtimeClass === 'fixture') {
      diagnostics.push({
        code: 'PRODUCTION_TO_FIXTURE',
        path: `${edge.from} -> ${edge.to}`,
        message: `Production module "${sourceOwner.id}" cannot depend on fixture module "${targetOwner.id}".`,
      });
    }

    if (!targetOwner.publicRoots.includes(edge.to)) {
      diagnostics.push({
        code: 'DEEP_IMPORT',
        path: edge.to,
        message: `Import "${edge.importPath}" targets a private path in module "${targetOwner.id}".`,
      });
    }

    const sourceLayer = layersByName.get(sourceOwner.layer);
    const isNamedException = exceptions.has(`${sourceOwner.id}\u0000${targetOwner.id}`);
    if (
      sourceLayer !== undefined &&
      !sourceLayer.allowedDependencies.includes(targetOwner.layer) &&
      !isNamedException
    ) {
      diagnostics.push({
        code: 'LAYER_DIRECTION',
        path: `${edge.from} -> ${edge.to}`,
        message: `Layer "${sourceOwner.layer}" in module "${sourceOwner.id}" cannot depend on layer "${targetOwner.layer}" in module "${targetOwner.id}".`,
      });
    }
  }

  const cycle = findCycle(graph);
  if (cycle !== undefined) {
    const cyclePath = cycle.join(' -> ');
    diagnostics.push({
      code: 'CYCLE',
      path: cyclePath,
      message: `Dependency cycle detected: ${cyclePath}.`,
    });
  }

  const sortedDiagnostics = sortDiagnostics(diagnostics);
  return {
    ok: sortedDiagnostics.length === 0,
    diagnostics: sortedDiagnostics,
  };
};
