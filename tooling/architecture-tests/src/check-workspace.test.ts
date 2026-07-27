import { describe, expect, it } from 'vitest';

import canonicalPolicy from '../../../architecture/module-boundaries.json' with { type: 'json' };

import {
  createActivatedWorkspaceGraph,
  discoverPnpmWorkspaceRoots,
} from './check-workspace.ts';
import { evaluateGraph } from './policy.ts';

interface FileSystem {
  existsSync: (path: string) => boolean;
}

interface PathApi {
  join: (...parts: string[]) => string;
  resolve: (...parts: string[]) => string;
}

declare const process: {
  cwd: () => string;
  getBuiltinModule: (specifier: string) => unknown;
};

const fileSystem = process.getBuiltinModule('node:fs') as FileSystem;
const pathApi = process.getBuiltinModule('node:path') as PathApi;

const phase2Reservations = [
  {
    id: 'design-tokens',
    owner: 'design-system',
    root: 'packages/design-tokens',
    publicRoot: 'packages/design-tokens/src/index.ts',
  },
  {
    id: 'design-system',
    owner: 'design-system',
    root: 'packages/design-system',
    publicRoot: 'packages/design-system/src/index.ts',
  },
  {
    id: 'feature-shell',
    owner: 'desktop-ui',
    root: 'packages/feature-shell',
    publicRoot: 'packages/feature-shell/src/index.ts',
  },
  {
    id: 'desktop-app',
    owner: 'desktop',
    root: 'apps/desktop',
    publicRoot: 'apps/desktop/src/index.ts',
  },
] as const;

const repositoryRoot = pathApi.resolve(process.cwd(), '..', '..');

describe('Phase 2 reservation', { concurrent: false }, () => {
  it('keeps the four owned roots reserved and undiscoverable before activation', () => {
    const discoveredRoots = new Set(discoverPnpmWorkspaceRoots(repositoryRoot));

    expect(
      phase2Reservations.map(({ id, owner, root, publicRoot }) => {
        const matches = canonicalPolicy.modules.filter((module) => module.id === id);

        expect(matches).toHaveLength(1);

        const [module] = matches;
        expect(module).toBeDefined();

        return {
          id: module?.id,
          owner: module?.owner,
          roots: module?.roots,
          publicRoots: module?.publicRoots,
          runtimeClass: module?.runtimeClass,
          status: module?.status,
          manifestExists: fileSystem.existsSync(
            pathApi.join(repositoryRoot, root, 'package.json'),
          ),
          discoverable: discoveredRoots.has(root),
          expectedOwner: owner,
          expectedPublicRoot: publicRoot,
        };
      }),
    ).toEqual(
      phase2Reservations.map(({ id, owner, root, publicRoot }) => ({
        id,
        owner,
        roots: [root],
        publicRoots: [publicRoot],
        runtimeClass: 'production',
        status: 'reserved',
        manifestExists: false,
        discoverable: false,
        expectedOwner: owner,
        expectedPublicRoot: publicRoot,
      })),
    );
  });
});

describe('Phase 2 ownership', () => {
  const activatedGraph = createActivatedWorkspaceGraph(
    canonicalPolicy,
    [
      'contracts-ts',
      'desktop-client',
      'desktop-simulator',
      'design-tokens',
      'design-system',
      'feature-shell',
      'desktop-app',
    ],
    [
      { from: 'desktop-client', to: 'contracts-ts' },
      { from: 'design-system', to: 'design-tokens' },
      { from: 'feature-shell', to: 'desktop-client' },
      { from: 'feature-shell', to: 'design-system' },
      { from: 'desktop-app', to: 'feature-shell' },
    ],
  );

  it('accepts the legal synthetic activation graph', () => {
    expect(evaluateGraph(canonicalPolicy, activatedGraph)).toEqual({
      ok: true,
      diagnostics: [],
    });
  });

  it('rejects a root without canonical ownership', () => {
    const graph = {
      ...activatedGraph,
      nodes: [
        ...activatedGraph.nodes,
        {
          path: 'packages/unowned-phase2/src/index.ts',
          runtimeClass: 'production' as const,
        },
      ],
    };

    expect(evaluateGraph(canonicalPolicy, graph)).toEqual({
      ok: false,
      diagnostics: [
        {
          code: 'UNKNOWN_OWNER',
          path: 'packages/unowned-phase2/src/index.ts',
          message: 'No module owns "packages/unowned-phase2/src/index.ts".',
        },
      ],
    });
  });

  it('rejects a production feature dependency on the simulator fixture', () => {
    const graph = {
      ...activatedGraph,
      edges: [
        ...activatedGraph.edges,
        {
          from: 'packages/feature-shell/src/index.ts',
          to: 'packages/desktop-simulator/src/index.ts',
          importPath: '@liiiraa/desktop-simulator',
          kind: 'typescript' as const,
        },
      ],
    };

    expect(evaluateGraph(canonicalPolicy, graph)).toEqual({
      ok: false,
      diagnostics: [
        {
          code: 'LAYER_DIRECTION',
          path:
            'packages/feature-shell/src/index.ts -> ' +
            'packages/desktop-simulator/src/index.ts',
          message:
            'Layer "feature" in module "feature-shell" cannot depend on ' +
            'layer "adapter" in module "desktop-simulator".',
        },
        {
          code: 'PRODUCTION_TO_FIXTURE',
          path:
            'packages/feature-shell/src/index.ts -> ' +
            'packages/desktop-simulator/src/index.ts',
          message:
            'Production module "feature-shell" cannot depend on fixture module ' +
            '"desktop-simulator".',
        },
      ],
    });
  });

  it('rejects a deep import into a Phase 2 design module', () => {
    const graph = {
      ...activatedGraph,
      nodes: [
        ...activatedGraph.nodes,
        {
          path: 'packages/design-system/src/private.ts',
          runtimeClass: 'production' as const,
        },
      ],
      edges: [
        ...activatedGraph.edges,
        {
          from: 'packages/feature-shell/src/index.ts',
          to: 'packages/design-system/src/private.ts',
          importPath: '@liiiraa/design-system/src/private',
          kind: 'typescript' as const,
        },
      ],
    };

    expect(evaluateGraph(canonicalPolicy, graph)).toEqual({
      ok: false,
      diagnostics: [
        {
          code: 'DEEP_IMPORT',
          path: 'packages/design-system/src/private.ts',
          message:
            'Import "@liiiraa/design-system/src/private" targets a private path ' +
            'in module "design-system".',
        },
      ],
    });
  });

  it('rejects a cycle between Phase 2 design modules', () => {
    const graph = {
      ...activatedGraph,
      edges: [
        ...activatedGraph.edges,
        {
          from: 'packages/design-tokens/src/index.ts',
          to: 'packages/design-system/src/index.ts',
          importPath: '@liiiraa/design-system',
          kind: 'typescript' as const,
        },
      ],
    };

    const cycle =
      'packages/design-system/src/index.ts -> ' +
      'packages/design-tokens/src/index.ts -> ' +
      'packages/design-system/src/index.ts';

    expect(evaluateGraph(canonicalPolicy, graph)).toEqual({
      ok: false,
      diagnostics: [
        {
          code: 'CYCLE',
          path: cycle,
          message: `Dependency cycle detected: ${cycle}.`,
        },
      ],
    });
  });
});
