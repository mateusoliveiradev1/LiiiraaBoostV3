import { describe, expect, it } from 'vitest';

import canonicalPolicy from '../../../architecture/module-boundaries.json' with { type: 'json' };
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
          path:
            'packages/desktop-client/src/a.ts -> packages/desktop-client/src/b.ts -> packages/desktop-client/src/a.ts',
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
