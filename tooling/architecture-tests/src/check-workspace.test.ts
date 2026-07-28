import { describe, expect, it } from 'vitest';

import canonicalPolicy from '../../../architecture/module-boundaries.json' with { type: 'json' };

import { createActivatedWorkspaceGraph, discoverPnpmWorkspaceRoots } from './check-workspace.ts';
import { evaluateGraph } from './policy.ts';

interface FileSystem {
  existsSync: (path: string) => boolean;
  readFileSync: (path: string, encoding: 'utf8') => string;
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

interface WorkspaceManifest {
  name?: unknown;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

const phase2Packages = [
  {
    id: 'design-tokens',
    owner: 'design-system',
    root: 'packages/design-tokens',
    publicRoot: 'packages/design-tokens/src/index.ts',
    packageName: '@liiiraa/design-tokens',
    workspaceDependencies: [],
  },
  {
    id: 'design-system',
    owner: 'design-system',
    root: 'packages/design-system',
    publicRoot: 'packages/design-system/src/index.ts',
    packageName: '@liiiraa/design-system',
    workspaceDependencies: ['@liiiraa/design-tokens'],
  },
  {
    id: 'feature-shell',
    owner: 'desktop-ui',
    root: 'packages/feature-shell',
    publicRoot: 'packages/feature-shell/src/index.ts',
    packageName: '@liiiraa/feature-shell',
    workspaceDependencies: [
      '@liiiraa/contracts-ts',
      '@liiiraa/design-system',
      '@liiiraa/desktop-client',
    ],
  },
  {
    id: 'desktop-app',
    owner: 'desktop',
    root: 'apps/desktop',
    publicRoot: 'apps/desktop/src/index.ts',
    packageName: '@liiiraa/desktop',
    workspaceDependencies: ['@liiiraa/desktop-production-reference', '@liiiraa/feature-shell'],
  },
] as const;

const repositoryRoot = pathApi.resolve(process.cwd(), '..', '..');

const readManifest = (root: string): WorkspaceManifest =>
  JSON.parse(
    fileSystem.readFileSync(pathApi.join(repositoryRoot, root, 'package.json'), 'utf8'),
  ) as WorkspaceManifest;

const manifestEntries = (manifest: WorkspaceManifest): readonly (readonly [string, string])[] =>
  [
    ...Object.entries(manifest.dependencies ?? {}),
    ...Object.entries(manifest.devDependencies ?? {}),
    ...Object.entries(manifest.peerDependencies ?? {}),
  ].toSorted(([leftName], [rightName]) => leftName.localeCompare(rightName));

const readApprovedIdentities = (): readonly {
  ecosystem: 'cargo' | 'npm';
  name: string;
  version: string;
}[] => {
  const approval = fileSystem.readFileSync(
    pathApi.join(
      repositoryRoot,
      '.planning/phases/02-complete-desktop-experience/02-DEPENDENCY-APPROVAL.md',
    ),
    'utf8',
  );

  return [
    ...approval.matchAll(/^\d+\. `(?<ecosystem>cargo|npm):(?<name>.+)@(?<version>[^@`]+)`$/gmu),
  ]
    .map(({ groups }) => ({
      ecosystem: groups?.['ecosystem'] as 'cargo' | 'npm',
      name: groups?.['name'] ?? '',
      version: groups?.['version'] ?? '',
    }))
    .filter(({ name, version }) => name.length > 0 && version.length > 0);
};

describe('Phase 2 live workspace activation', { concurrent: false }, () => {
  it('keeps the four owned roots reserved and undiscoverable before activation', () => {
    const discoveredRoots = new Set(discoverPnpmWorkspaceRoots(repositoryRoot));

    expect(
      phase2Packages.map(({ id, owner, root, publicRoot }) => {
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
          manifestExists: fileSystem.existsSync(pathApi.join(repositoryRoot, root, 'package.json')),
          discoverable: discoveredRoots.has(root),
          expectedOwner: owner,
          expectedPublicRoot: publicRoot,
        };
      }),
    ).toEqual(
      phase2Packages.map(({ id, owner, root, publicRoot }) => ({
        id,
        owner,
        roots: [root],
        publicRoots: [publicRoot],
        runtimeClass: 'production',
        status: 'active',
        manifestExists: true,
        discoverable: true,
        expectedOwner: owner,
        expectedPublicRoot: publicRoot,
      })),
    );
  });
});

describe('Phase 2 manifest gates', { concurrent: false }, () => {
  it('workspace discovery finds each manifest-backed root exactly once', () => {
    const discoveredRoots = discoverPnpmWorkspaceRoots(repositoryRoot);

    expect(
      phase2Packages.map(({ root }) => ({
        root,
        manifestExists: fileSystem.existsSync(pathApi.join(repositoryRoot, root, 'package.json')),
        occurrences: discoveredRoots.filter((discoveredRoot) => discoveredRoot === root).length,
      })),
    ).toEqual(
      phase2Packages.map(({ root }) => ({
        root,
        manifestExists: true,
        occurrences: 1,
      })),
    );
  });

  it('package ownership has one active owner and canonical public root', () => {
    expect(
      phase2Packages.map(({ id, root }) => {
        const matches = canonicalPolicy.modules.filter((module) => module.id === id);
        expect(matches).toHaveLength(1);

        const [module] = matches;
        expect(module).toBeDefined();

        const manifest = readManifest(root);
        const actualWorkspaceDependencies = manifestEntries(manifest)
          .filter(([name]) => name.startsWith('@liiiraa/'))
          .map(([name, version]) => {
            expect(version).toBe('workspace:*');
            return name;
          })
          .toSorted();

        return {
          id: module?.id,
          owner: module?.owner,
          roots: module?.roots,
          publicRoots: module?.publicRoots,
          runtimeClass: module?.runtimeClass,
          status: module?.status,
          packageName: manifest.name,
          workspaceDependencies: actualWorkspaceDependencies,
        };
      }),
    ).toEqual(
      phase2Packages.map(({ id, owner, root, publicRoot, packageName, workspaceDependencies }) => ({
        id,
        owner,
        roots: [root],
        publicRoots: [publicRoot],
        runtimeClass: 'production',
        status: 'active',
        packageName,
        workspaceDependencies: [...workspaceDependencies].toSorted(),
      })),
    );
  });

  it('approved manifest identities match the versioned approval and generated review', () => {
    const approvedIdentities = readApprovedIdentities();
    const approvedNpmVersions = new Map(
      approvedIdentities
        .filter(({ ecosystem }) => ecosystem === 'npm')
        .map(({ name, version }) => [name, version]),
    );
    const review = fileSystem.readFileSync(
      pathApi.join(repositoryRoot, 'architecture/dependency-review.md'),
      'utf8',
    );
    const directExternalIdentities = phase2Packages.flatMap(({ root }) =>
      manifestEntries(readManifest(root))
        .filter(([name]) => !name.startsWith('@liiiraa/'))
        .map(([name, version]) => {
          expect(version).toBe(approvedNpmVersions.get(name));
          expect(review).toContain(`\`${name}@${version}\``);
          return `npm:${name}@${version}`;
        }),
    );

    expect(approvedIdentities).toHaveLength(33);
    expect(new Set(directExternalIdentities)).toEqual(
      new Set(
        approvedIdentities
          .filter(({ ecosystem, name }) => ecosystem === 'npm' && name !== '@typespec/openapi')
          .map(({ ecosystem, name, version }) => `${ecosystem}:${name}@${version}`),
      ),
    );

    expect(manifestEntries(readManifest('tooling/contract-generation'))).toContainEqual([
      '@typespec/openapi',
      '1.14.0',
    ]);

    for (const { name, version } of approvedIdentities) {
      expect(review).toContain(`\`${name}@${version}\``);
    }

    expect(directExternalIdentities).not.toContain('npm:msw');
    expect(directExternalIdentities).not.toContain('npm:@tauri-apps/plugin-single-instance');
    expect(
      phase2Packages.flatMap(({ root }) =>
        manifestEntries(readManifest(root)).map(([name]) => name),
      ),
    ).not.toContain('@liiiraa/desktop-simulator');
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
            'packages/feature-shell/src/index.ts -> ' + 'packages/desktop-simulator/src/index.ts',
          message:
            'Layer "feature" in module "feature-shell" cannot depend on ' +
            'layer "adapter" in module "desktop-simulator".',
        },
        {
          code: 'PRODUCTION_TO_FIXTURE',
          path:
            'packages/feature-shell/src/index.ts -> ' + 'packages/desktop-simulator/src/index.ts',
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
