import { describe, expect, it } from 'vitest';

import canonicalPolicy from '../../../architecture/module-boundaries.json' with { type: 'json' };
import allowedGraph from '../fixtures/allowed-graph.json' with { type: 'json' };
import cargoForbiddenEdge from '../fixtures/cargo-forbidden-edge.json' with { type: 'json' };
import cycleGraph from '../fixtures/cycle.json' with { type: 'json' };
import forbiddenEdge from '../fixtures/forbidden-edge.json' with { type: 'json' };
import { normalizeCargoMetadata } from './check-cargo.ts';
import {
  createDependencyCruiserRestrictions,
  normalizeDependencyCruiserResult,
  runArchitectureAdapters,
} from './check-workspace.ts';
import { evaluateGraph, validatePolicy } from './policy.ts';

const productionNode = (path: string) => ({
  path,
  runtimeClass: 'production',
});

const fixtureNode = (path: string) => ({
  path,
  runtimeClass: 'fixture',
});

describe('policy evaluator', () => {
  it('accepts an allowed layer direction through public roots', () => {
    const graph = {
      schemaVersion: 1,
      nodes: [
        productionNode('packages/desktop-client/src/index.ts'),
        productionNode('packages/contracts-ts/src/index.ts'),
      ],
      edges: [
        {
          from: 'packages/desktop-client/src/index.ts',
          to: 'packages/contracts-ts/src/index.ts',
          importPath: '@liiiraa/contracts-ts',
          kind: 'typescript',
        },
      ],
    };

    expect(evaluateGraph(canonicalPolicy, graph)).toEqual({
      ok: true,
      diagnostics: [],
    });
  });

  it('rejects an invalid policy document before evaluating a graph', () => {
    const invalidPolicy = {
      ...canonicalPolicy,
      schemaVersion: 2,
    };

    expect(evaluateGraph(invalidPolicy, { schemaVersion: 1, nodes: [], edges: [] })).toEqual({
      ok: false,
      diagnostics: [
        {
          code: 'POLICY_SCHEMA_INVALID',
          path: '$.schemaVersion',
          message: 'Expected schemaVersion to equal 1.',
        },
      ],
    });
  });

  it('rejects source paths with no declared owner', () => {
    const graph = {
      schemaVersion: 1,
      nodes: [productionNode('packages/unowned/src/index.ts')],
      edges: [],
    };

    expect(evaluateGraph(canonicalPolicy, graph)).toEqual({
      ok: false,
      diagnostics: [
        {
          code: 'UNKNOWN_OWNER',
          path: 'packages/unowned/src/index.ts',
          message: 'No module owns "packages/unowned/src/index.ts".',
        },
      ],
    });
  });

  it('rejects policy roots that assign one path to duplicate owners', () => {
    const firstModule = canonicalPolicy.modules[0];
    if (firstModule === undefined) {
      throw new Error('Canonical policy must declare at least one module.');
    }

    const duplicateOwnerPolicy = {
      ...canonicalPolicy,
      modules: [
        ...canonicalPolicy.modules,
        {
          ...firstModule,
          id: 'shadow-contracts-source',
          owner: 'architecture-test-shadow',
        },
      ],
    };

    expect(validatePolicy(duplicateOwnerPolicy)).toEqual({
      ok: false,
      diagnostics: [
        {
          code: 'DUPLICATE_OWNER',
          path: 'packages/contracts-source',
          message:
            'Root "packages/contracts-source" is owned by both "contracts-source" and "shadow-contracts-source".',
        },
      ],
    });
  });

  it('rejects cross-module deep imports with the exact target path', () => {
    const graph = {
      schemaVersion: 1,
      nodes: [
        productionNode('packages/desktop-client/src/index.ts'),
        productionNode('packages/contracts-ts/src/private.ts'),
      ],
      edges: [
        {
          from: 'packages/desktop-client/src/index.ts',
          to: 'packages/contracts-ts/src/private.ts',
          importPath: '@liiiraa/contracts-ts/src/private',
          kind: 'typescript',
        },
      ],
    };

    expect(evaluateGraph(canonicalPolicy, graph)).toEqual({
      ok: false,
      diagnostics: [
        {
          code: 'DEEP_IMPORT',
          path: 'packages/contracts-ts/src/private.ts',
          message:
            'Import "@liiiraa/contracts-ts/src/private" targets a private path in module "contracts-ts".',
        },
      ],
    });
  });

  it('rejects production dependencies on fixture modules', () => {
    const graph = {
      schemaVersion: 1,
      nodes: [
        productionNode('apps/desktop/src/index.ts'),
        fixtureNode('packages/desktop-simulator/src/index.ts'),
      ],
      edges: [
        {
          from: 'apps/desktop/src/index.ts',
          to: 'packages/desktop-simulator/src/index.ts',
          importPath: '@liiiraa/desktop-simulator',
          kind: 'typescript',
        },
      ],
    };

    expect(evaluateGraph(canonicalPolicy, graph)).toEqual({
      ok: false,
      diagnostics: [
        {
          code: 'PRODUCTION_TO_FIXTURE',
          path: 'apps/desktop/src/index.ts -> packages/desktop-simulator/src/index.ts',
          message:
            'Production module "desktop-app" cannot depend on fixture module "desktop-simulator".',
        },
      ],
    });
  });

  it('rejects cycles with one deterministic path', () => {
    const graph = {
      schemaVersion: 1,
      nodes: [
        productionNode('packages/desktop-client/src/a.ts'),
        productionNode('packages/desktop-client/src/b.ts'),
      ],
      edges: [
        {
          from: 'packages/desktop-client/src/a.ts',
          to: 'packages/desktop-client/src/b.ts',
          importPath: './b.ts',
          kind: 'typescript',
        },
        {
          from: 'packages/desktop-client/src/b.ts',
          to: 'packages/desktop-client/src/a.ts',
          importPath: './a.ts',
          kind: 'typescript',
        },
      ],
    };

    expect(evaluateGraph(canonicalPolicy, graph)).toEqual({
      ok: false,
      diagnostics: [
        {
          code: 'CYCLE',
          path: 'packages/desktop-client/src/a.ts -> packages/desktop-client/src/b.ts -> packages/desktop-client/src/a.ts',
          message:
            'Dependency cycle detected: packages/desktop-client/src/a.ts -> packages/desktop-client/src/b.ts -> packages/desktop-client/src/a.ts.',
        },
      ],
    });
  });

  it('permits only the exact forbidden layer edge named by an exception', () => {
    const policyWithException = {
      ...canonicalPolicy,
      exceptions: [
        ...canonicalPolicy.exceptions,
        {
          name: 'contracts-source-to-desktop-client-test',
          from: 'contracts-source',
          to: 'desktop-client',
          reason: 'Proves named exceptions are exact and reviewable.',
        },
      ],
    };
    const graph = {
      schemaVersion: 1,
      nodes: [
        productionNode('packages/contracts-source/src/index.ts'),
        productionNode('packages/desktop-client/src/index.ts'),
      ],
      edges: [
        {
          from: 'packages/contracts-source/src/index.ts',
          to: 'packages/desktop-client/src/index.ts',
          importPath: '@liiiraa/desktop-client',
          kind: 'typescript',
        },
      ],
    };

    expect(evaluateGraph(policyWithException, graph)).toEqual({
      ok: true,
      diagnostics: [],
    });
  });
});

const negativeFixtures = [
  {
    name: 'production fixture edge',
    graph: forbiddenEdge,
    expectedDiagnostic: {
      code: 'PRODUCTION_TO_FIXTURE',
      path: 'apps/desktop/src/index.ts -> packages/desktop-simulator/src/index.ts',
      message:
        'Production module "desktop-app" cannot depend on fixture module "desktop-simulator".',
    },
  },
  {
    name: 'dependency cycle',
    graph: cycleGraph,
    expectedDiagnostic: {
      code: 'CYCLE',
      path: 'packages/desktop-client/src/a.ts -> packages/desktop-client/src/b.ts -> packages/desktop-client/src/a.ts',
      message:
        'Dependency cycle detected: packages/desktop-client/src/a.ts -> packages/desktop-client/src/b.ts -> packages/desktop-client/src/a.ts.',
    },
  },
  {
    name: 'acyclic Cargo layer edge',
    graph: cargoForbiddenEdge,
    expectedDiagnostic: {
      code: 'LAYER_DIRECTION',
      path: 'crates/contracts-rust/src/lib.rs -> crates/desktop-application/src/lib.rs',
      message:
        'Layer "generated" in module "contracts-rust" cannot depend on layer "application" in module "desktop-application".',
    },
  },
] as const;

describe('policy graph fixtures', () => {
  it('accepts the complete allowed graph fixture', () => {
    expect(evaluateGraph(canonicalPolicy, allowedGraph)).toEqual({
      ok: true,
      diagnostics: [],
    });
  });

  it.each(negativeFixtures)(
    'rejects only the seeded invariant in $name',
    ({ graph, expectedDiagnostic }) => {
      expect(evaluateGraph(canonicalPolicy, graph)).toEqual({
        ok: false,
        diagnostics: [expectedDiagnostic],
      });
    },
  );

  it('executes the complete negative fixture corpus', () => {
    expect(negativeFixtures).toHaveLength(3);
    expect(
      negativeFixtures.map(({ expectedDiagnostic }) => expectedDiagnostic.code).toSorted(),
    ).toEqual(['CYCLE', 'LAYER_DIRECTION', 'PRODUCTION_TO_FIXTURE']);
  });

  it('detects a deep-import mutation of the allowed fixture', () => {
    const mutatedGraph = {
      ...allowedGraph,
      nodes: [...allowedGraph.nodes, productionNode('packages/contracts-ts/src/private.ts')],
      edges: [
        ...allowedGraph.edges,
        {
          from: 'packages/desktop-client/src/index.ts',
          to: 'packages/contracts-ts/src/private.ts',
          importPath: '@liiiraa/contracts-ts/src/private',
          kind: 'typescript',
        },
      ],
    };

    expect(evaluateGraph(canonicalPolicy, mutatedGraph)).toEqual({
      ok: false,
      diagnostics: [
        {
          code: 'DEEP_IMPORT',
          path: 'packages/contracts-ts/src/private.ts',
          message:
            'Import "@liiiraa/contracts-ts/src/private" targets a private path in module "contracts-ts".',
        },
      ],
    });
  });

  it.each(negativeFixtures)(
    'passes $name after removing its seeded violating edges',
    ({ graph }) => {
      expect(evaluateGraph(canonicalPolicy, { ...graph, edges: [] })).toEqual({
        ok: true,
        diagnostics: [],
      });
    },
  );
});

describe('real graph adapters', () => {
  it('normalizes dependency-cruiser output into the canonical graph vocabulary', () => {
    const cruiseResult = {
      modules: [
        {
          source: 'packages/desktop-client/src/index.ts',
          dependencies: [
            {
              module: '@liiiraa/contracts-ts',
              resolved: 'packages/contracts-ts/src/index.ts',
              couldNotResolve: false,
            },
          ],
        },
        {
          source: 'packages/contracts-ts/src/index.ts',
          dependencies: [],
        },
      ],
    };

    expect(normalizeDependencyCruiserResult(canonicalPolicy, cruiseResult)).toEqual({
      schemaVersion: 1,
      nodes: [
        productionNode('packages/contracts-ts/src/index.ts'),
        productionNode('packages/desktop-client/src/index.ts'),
      ],
      edges: [
        {
          from: 'packages/desktop-client/src/index.ts',
          to: 'packages/contracts-ts/src/index.ts',
          importPath: '@liiiraa/contracts-ts',
          kind: 'typescript',
        },
      ],
    });
  });

  it('rejects a dependency-cruiser private-path import through the shared evaluator', () => {
    const graph = normalizeDependencyCruiserResult(canonicalPolicy, {
      modules: [
        {
          source: 'packages/desktop-client/src/index.ts',
          dependencies: [
            {
              module: '@liiiraa/contracts-ts/src/private',
              resolved: 'packages/contracts-ts/src/private.ts',
              couldNotResolve: false,
            },
          ],
        },
        {
          source: 'packages/contracts-ts/src/private.ts',
          dependencies: [],
        },
      ],
    });

    expect(evaluateGraph(canonicalPolicy, graph)).toEqual({
      ok: false,
      diagnostics: [
        {
          code: 'DEEP_IMPORT',
          path: 'packages/contracts-ts/src/private.ts',
          message:
            'Import "@liiiraa/contracts-ts/src/private" targets a private path in module "contracts-ts".',
        },
      ],
    });
  });

  it('rejects production fixture leakage from dependency-cruiser output', () => {
    const graph = normalizeDependencyCruiserResult(canonicalPolicy, {
      modules: [
        {
          source: 'apps/desktop/src/index.ts',
          dependencies: [
            {
              module: '@liiiraa/desktop-simulator',
              resolved: 'packages/desktop-simulator/src/index.ts',
              couldNotResolve: false,
            },
          ],
        },
        {
          source: 'packages/desktop-simulator/src/index.ts',
          dependencies: [],
        },
      ],
    });

    expect(evaluateGraph(canonicalPolicy, graph)).toEqual({
      ok: false,
      diagnostics: [
        {
          code: 'PRODUCTION_TO_FIXTURE',
          path: 'apps/desktop/src/index.ts -> packages/desktop-simulator/src/index.ts',
          message:
            'Production module "desktop-app" cannot depend on fixture module "desktop-simulator".',
        },
      ],
    });
  });

  it('normalizes Cargo metadata and rejects an acyclic forbidden Rust edge', () => {
    const graph = normalizeCargoMetadata(
      canonicalPolicy,
      {
        packages: [
          {
            id: 'path+file:///repo/crates/contracts-rust#0.0.0',
            name: 'contracts-rust',
            targets: [{ src_path: 'C:/repo/crates/contracts-rust/src/lib.rs' }],
          },
          {
            id: 'path+file:///repo/crates/desktop-application#0.0.0',
            name: 'desktop-application',
            targets: [{ src_path: 'C:/repo/crates/desktop-application/src/lib.rs' }],
          },
        ],
        resolve: {
          nodes: [
            {
              id: 'path+file:///repo/crates/contracts-rust#0.0.0',
              dependencies: ['path+file:///repo/crates/desktop-application#0.0.0'],
            },
            {
              id: 'path+file:///repo/crates/desktop-application#0.0.0',
              dependencies: [],
            },
          ],
        },
      },
      'C:/repo',
    );

    expect(evaluateGraph(canonicalPolicy, graph)).toEqual({
      ok: false,
      diagnostics: [
        {
          code: 'LAYER_DIRECTION',
          path: 'crates/contracts-rust/src/lib.rs -> crates/desktop-application/src/lib.rs',
          message:
            'Layer "generated" in module "contracts-rust" cannot depend on layer "application" in module "desktop-application".',
        },
      ],
    });
  });

  it('derives dependency-cruiser layer and public-export rules from canonical policy', () => {
    const rules = createDependencyCruiserRestrictions(canonicalPolicy);
    const generatedDirectionRule = rules.find(
      ({ name }) => name === 'canonical-layer-contracts-rust',
    );
    const contractsPrivateRule = rules.find(
      ({ name }) => name === 'canonical-public-contracts-ts',
    );

    expect(generatedDirectionRule).toMatchObject({
      from: { path: '^crates/contracts-rust(?:/|$)' },
      to: {
        path: expect.stringContaining('crates/desktop-application'),
      },
    });
    expect(contractsPrivateRule).toEqual({
      name: 'canonical-public-contracts-ts',
      severity: 'error',
      comment: 'Cross-module imports must target a canonical public root.',
      from: {
        path: expect.any(String),
        pathNot: '^packages/contracts-ts(?:/|$)',
      },
      to: {
        path: '^packages/contracts-ts(?:/|$)',
        pathNot: '^packages/contracts-ts/src/index\\.ts$',
      },
    });

    const generatedLayer = canonicalPolicy.layers.find(({ name }) => name === 'generated');
    if (generatedLayer === undefined) {
      throw new Error('Canonical policy must declare the generated layer.');
    }
    const relaxedPolicy = {
      ...canonicalPolicy,
      layers: canonicalPolicy.layers.map((layer) =>
        layer.name === 'generated'
          ? {
              ...generatedLayer,
              allowedDependencies: [...generatedLayer.allowedDependencies, 'application'],
            }
          : layer,
      ),
    };
    const relaxedRule = createDependencyCruiserRestrictions(relaxedPolicy).find(
      ({ name }) => name === 'canonical-layer-contracts-rust',
    );

    expect(relaxedRule?.to.path).not.toContain('crates/desktop-application');
  });

  it('executes each live adapter exactly once and reports both execution counts', async () => {
    const okPolicy = { ok: true, diagnostics: [] };
    const result = await runArchitectureAdapters(
      async () => ({
        adapter: 'workspace',
        graph: { schemaVersion: 1, nodes: [], edges: [] },
        policy: okPolicy,
      }),
      async () => ({
        adapter: 'cargo',
        graph: { schemaVersion: 1, nodes: [], edges: [] },
        policy: okPolicy,
      }),
    );

    expect(result).toEqual({
      ok: true,
      executionCounts: {
        workspace: 1,
        cargo: 1,
      },
      workspace: {
        adapter: 'workspace',
        graph: { schemaVersion: 1, nodes: [], edges: [] },
        policy: okPolicy,
      },
      cargo: {
        adapter: 'cargo',
        graph: { schemaVersion: 1, nodes: [], edges: [] },
        policy: okPolicy,
      },
    });
  });
});
