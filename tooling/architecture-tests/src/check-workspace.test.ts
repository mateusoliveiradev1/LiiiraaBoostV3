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
  scripts?: Record<string, string>;
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
    workspaceDependencies: [
      '@liiiraa/contracts-ts',
      '@liiiraa/design-system',
      '@liiiraa/design-tokens',
      '@liiiraa/desktop-production-reference',
      '@liiiraa/feature-shell',
    ],
  },
] as const;

const phase3WebModules = [
  {
    id: 'web-core',
    owner: 'web-platform',
    root: 'packages/web-core',
    publicRoot: 'packages/web-core/src/index.ts',
    layer: 'application',
    runtimeClass: 'production',
    packageName: '@liiiraa/web-core',
    workspaceDependencies: ['@liiiraa/contracts-ts'],
  },
  {
    id: 'web-preview',
    owner: 'web-platform',
    root: 'packages/web-preview',
    publicRoot: 'packages/web-preview/src/index.ts',
    layer: 'adapter',
    runtimeClass: 'fixture',
    packageName: '@liiiraa/web-preview',
    workspaceDependencies: ['@liiiraa/web-core'],
  },
  {
    id: 'web-features',
    owner: 'web-ui',
    root: 'packages/web-features',
    publicRoot: 'packages/web-features/src/index.ts',
    layer: 'feature',
    runtimeClass: 'production',
    packageName: '@liiiraa/web-features',
    workspaceDependencies: [
      '@liiiraa/contracts-ts',
      '@liiiraa/design-system',
      '@liiiraa/design-tokens',
      '@liiiraa/web-core',
    ],
  },
  {
    id: 'web-evidence',
    owner: 'architecture',
    root: 'tooling/web-evidence',
    publicRoot: 'tooling/web-evidence/src/index.ts',
    layer: 'tooling',
    runtimeClass: 'tooling',
    packageName: '@liiiraa/web-evidence',
    workspaceDependencies: [
      '@liiiraa/contracts-ts',
      '@liiiraa/web-core',
      '@liiiraa/web-features',
      '@liiiraa/web-preview',
    ],
  },
  {
    id: 'web-app',
    owner: 'web',
    root: 'apps/web',
    publicRoot: 'apps/web/src/index.ts',
    layer: 'composition',
    runtimeClass: 'production',
    packageName: '@liiiraa/web',
    workspaceDependencies: [
      '@liiiraa/design-system',
      '@liiiraa/design-tokens',
      '@liiiraa/web-core',
      '@liiiraa/web-features',
    ],
  },
  {
    id: 'account-app',
    owner: 'account',
    root: 'apps/account',
    publicRoot: 'apps/account/src/index.ts',
    layer: 'composition',
    runtimeClass: 'fixture',
    packageName: '@liiiraa/account',
    workspaceDependencies: [
      '@liiiraa/contracts-ts',
      '@liiiraa/design-system',
      '@liiiraa/design-tokens',
      '@liiiraa/web-core',
      '@liiiraa/web-features',
      '@liiiraa/web-preview',
    ],
  },
  {
    id: 'admin-app',
    owner: 'admin',
    root: 'apps/admin',
    publicRoot: 'apps/admin/src/index.ts',
    layer: 'composition',
    runtimeClass: 'fixture',
    packageName: '@liiiraa/admin',
    workspaceDependencies: [
      '@liiiraa/design-system',
      '@liiiraa/design-tokens',
      '@liiiraa/web-core',
      '@liiiraa/web-features',
      '@liiiraa/web-preview',
    ],
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

describe('Phase 3 live web activation', { concurrent: false }, () => {
  it('activates every web root exactly once with manifest and dependency parity', () => {
    const discoveredRoots = new Set(discoverPnpmWorkspaceRoots(repositoryRoot));

    expect(
      phase3WebModules.map(
        ({
          id,
          owner,
          root,
          publicRoot,
          layer,
          runtimeClass,
          packageName,
          workspaceDependencies,
        }) => {
          const matches = canonicalPolicy.modules.filter((module) => module.id === id);

          expect(matches).toHaveLength(1);

          const [module] = matches;
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
            layer: module?.layer,
            runtimeClass: module?.runtimeClass,
            status: module?.status,
            manifestExists: fileSystem.existsSync(
              pathApi.join(repositoryRoot, root, 'package.json'),
            ),
            discoverable: discoveredRoots.has(root),
            packageName: manifest.name,
            workspaceDependencies: actualWorkspaceDependencies,
            expectedOwner: owner,
            expectedPublicRoot: publicRoot,
            expectedLayer: layer,
            expectedRuntimeClass: runtimeClass,
            expectedPackageName: packageName,
            expectedWorkspaceDependencies: [...workspaceDependencies].toSorted(),
          };
        },
      ),
    ).toEqual(
      phase3WebModules.map(
        ({
          id,
          owner,
          root,
          publicRoot,
          layer,
          runtimeClass,
          packageName,
          workspaceDependencies,
        }) => ({
          id,
          owner,
          roots: [root],
          publicRoots: [publicRoot],
          layer,
          runtimeClass,
          status: 'active',
          manifestExists: true,
          discoverable: true,
          packageName,
          workspaceDependencies: [...workspaceDependencies].toSorted(),
          expectedOwner: owner,
          expectedPublicRoot: publicRoot,
          expectedLayer: layer,
          expectedRuntimeClass: runtimeClass,
          expectedPackageName: packageName,
          expectedWorkspaceDependencies: [...workspaceDependencies].toSorted(),
        }),
      ),
    );
  });

  it('declares every terminating root web lifecycle command', () => {
    const rootManifest = readManifest('.');

    expect(
      Object.fromEntries(
        [
          'web:check',
          'web:test',
          'web:build',
          'web:verify:quick',
          'web:verify',
          'verify:quick',
          'verify',
        ].map((command) => [command, rootManifest.scripts?.[command]]),
      ),
    ).toEqual({
      'web:check':
        'turbo run check --filter=@liiiraa/web-core --filter=@liiiraa/web-preview --filter=@liiiraa/web-features --filter=@liiiraa/web-evidence --filter=@liiiraa/web --filter=@liiiraa/account --filter=@liiiraa/admin',
      'web:test':
        'turbo run test --filter=@liiiraa/web-core --filter=@liiiraa/web-preview --filter=@liiiraa/web-features --filter=@liiiraa/web-evidence --filter=@liiiraa/web --filter=@liiiraa/account --filter=@liiiraa/admin',
      'web:build':
        'turbo run build --filter=@liiiraa/web-core --filter=@liiiraa/web-preview --filter=@liiiraa/web-features --filter=@liiiraa/web-evidence --filter=@liiiraa/web --filter=@liiiraa/account --filter=@liiiraa/admin',
      'web:verify:quick': 'node tooling/web-evidence/run-web-verify.mjs',
      'web:verify':
        'pnpm web:verify:quick && pnpm web:build && pnpm --filter @liiiraa/web-evidence exec playwright test && pnpm web:verify:phase -- --mode final',
      'verify:quick': 'pnpm --filter @liiiraa/desktop verify:quick && pnpm web:verify:quick',
      verify: 'pnpm --filter @liiiraa/desktop verify && pnpm web:verify',
    });
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
    const packagedHarnessApproval = fileSystem.readFileSync(
      pathApi.join(
        repositoryRoot,
        '.planning/phases/02-complete-desktop-experience/02-27-SUMMARY.md',
      ),
      'utf8',
    );
    expect(packagedHarnessApproval).toContain('"@types/node@24.13.3"');
    approvedNpmVersions.set('@types/node', '24.13.3');
    const review = fileSystem.readFileSync(
      pathApi.join(repositoryRoot, 'architecture/dependency-review.md'),
      'utf8',
    );
    const directExternalIdentities = phase2Packages.flatMap(({ root }) =>
      manifestEntries(readManifest(root))
        .filter(([name]) => !name.startsWith('@liiiraa/') && approvedNpmVersions.has(name))
        .map(([name, version]) => {
          const approvedVersion = approvedNpmVersions.get(name);
          if (approvedVersion !== undefined) {
            expect(version).toBe(approvedVersion);
          }
          expect(review).toContain(`\`${name}@${version}\``);
          return `npm:${name}@${version}`;
        }),
    );

    expect(approvedIdentities).toHaveLength(33);
    for (const { ecosystem, name, version } of approvedIdentities.filter(
      ({ ecosystem, name }) => ecosystem === 'npm' && name !== '@typespec/openapi',
    )) {
      expect(directExternalIdentities).toContain(`${ecosystem}:${name}@${version}`);
    }
    expect(directExternalIdentities).toContain('npm:@types/node@24.13.3');

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

describe('Phase 3 web isolation', () => {
  const activatedGraph = createActivatedWorkspaceGraph(
    canonicalPolicy,
    [
      'contracts-ts',
      'design-system',
      'architecture-tests',
      'web-core',
      'web-preview',
      'web-features',
      'web-evidence',
      'web-app',
      'account-app',
      'admin-app',
    ],
    [
      { from: 'web-core', to: 'contracts-ts' },
      { from: 'web-preview', to: 'web-core' },
      { from: 'web-features', to: 'web-core' },
      { from: 'web-features', to: 'design-system' },
      { from: 'web-app', to: 'web-features' },
      { from: 'account-app', to: 'web-features' },
      { from: 'account-app', to: 'web-preview' },
      { from: 'admin-app', to: 'web-features' },
      { from: 'admin-app', to: 'web-preview' },
      { from: 'web-evidence', to: 'architecture-tests' },
    ],
  );

  const withEdge = (from: string, to: string, importPath: string): typeof activatedGraph => ({
    ...activatedGraph,
    edges: [
      ...activatedGraph.edges,
      {
        from,
        to,
        importPath,
        kind: 'typescript' as const,
      },
    ],
  });

  it('accepts the legal web-core, design, feature, adapter, and composition graph', () => {
    expect(evaluateGraph(canonicalPolicy, activatedGraph)).toEqual({
      ok: true,
      diagnostics: [],
    });
  });

  it('rejects the public composition importing the preview adapter', () => {
    expect(
      evaluateGraph(
        canonicalPolicy,
        withEdge(
          'apps/web/src/index.ts',
          'packages/web-preview/src/index.ts',
          '@liiiraa/web-preview',
        ),
      ),
    ).toEqual({
      ok: false,
      diagnostics: [
        {
          code: 'PRODUCTION_TO_FIXTURE',
          path: 'apps/web/src/index.ts -> packages/web-preview/src/index.ts',
          message: 'Production module "web-app" cannot depend on fixture module "web-preview".',
        },
      ],
    });
  });

  it.each([
    {
      targetId: 'account-app',
      targetPath: 'apps/account/src/index.ts',
      importPath: '@liiiraa/account',
    },
    {
      targetId: 'admin-app',
      targetPath: 'apps/admin/src/index.ts',
      importPath: '@liiiraa/admin',
    },
  ])(
    'rejects the public composition importing fixture composition $targetId',
    ({ targetId, targetPath, importPath }) => {
      const dependencyPath = `apps/web/src/index.ts -> ${targetPath}`;

      expect(
        evaluateGraph(canonicalPolicy, withEdge('apps/web/src/index.ts', targetPath, importPath)),
      ).toEqual({
        ok: false,
        diagnostics: [
          {
            code: 'LAYER_DIRECTION',
            path: dependencyPath,
            message:
              `Layer "composition" in module "web-app" cannot depend on layer ` +
              `"composition" in module "${targetId}".`,
          },
          {
            code: 'PRODUCTION_TO_FIXTURE',
            path: dependencyPath,
            message:
              `Production module "web-app" cannot depend on fixture module ` + `"${targetId}".`,
          },
        ],
      });
    },
  );

  it('rejects the account composition importing the admin composition', () => {
    const dependencyPath = 'apps/account/src/index.ts -> apps/admin/src/index.ts';

    expect(
      evaluateGraph(
        canonicalPolicy,
        withEdge('apps/account/src/index.ts', 'apps/admin/src/index.ts', '@liiiraa/admin'),
      ),
    ).toEqual({
      ok: false,
      diagnostics: [
        {
          code: 'LAYER_DIRECTION',
          path: dependencyPath,
          message:
            'Layer "composition" in module "account-app" cannot depend on layer ' +
            '"composition" in module "admin-app".',
        },
      ],
    });
  });

  it('rejects a deep import into the shared design module', () => {
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
          from: 'packages/web-features/src/index.ts',
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

  it('rejects an admin route group nested inside the public deployment root', () => {
    const routeGroupPolicy = {
      ...canonicalPolicy,
      modules: canonicalPolicy.modules.map((module) =>
        module.id === 'admin-app'
          ? {
              ...module,
              roots: ['apps/web/src/app/(admin)'],
              publicRoots: ['apps/web/src/app/(admin)/src/index.ts'],
            }
          : module,
      ),
    };

    expect(evaluateGraph(routeGroupPolicy, activatedGraph)).toEqual({
      ok: false,
      diagnostics: [
        {
          code: 'DUPLICATE_OWNER',
          path: 'apps/web/src/app/(admin)',
          message: 'Root "apps/web/src/app/(admin)" is owned by both "admin-app" and "web-app".',
        },
      ],
    });
  });

  it.each([
    {
      moduleId: 'account-app',
      path: 'apps/account/src/index.ts',
    },
    {
      moduleId: 'admin-app',
      path: 'apps/admin/src/index.ts',
    },
  ])(
    'keeps independently buildable fixture composition $moduleId from claiming production authority',
    ({ moduleId, path }) => {
      const graph = {
        ...activatedGraph,
        nodes: activatedGraph.nodes.map((node) =>
          node.path === path
            ? {
                ...node,
                runtimeClass: 'production' as const,
              }
            : node,
        ),
      };

      expect(evaluateGraph(canonicalPolicy, graph)).toEqual({
        ok: false,
        diagnostics: [
          {
            code: 'RUNTIME_CLASS_MISMATCH',
            path,
            message:
              `Node "${path}" claims runtime class "production", but module ` +
              `"${moduleId}" is "fixture".`,
          },
        ],
      });
    },
  );

  it('rejects a cycle between web evidence and architecture tooling', () => {
    const graph = withEdge(
      'tooling/architecture-tests/src/policy.ts',
      'tooling/web-evidence/src/index.ts',
      '@liiiraa/web-evidence',
    );
    const cycle =
      'tooling/architecture-tests/src/policy.ts -> ' +
      'tooling/web-evidence/src/index.ts -> ' +
      'tooling/architecture-tests/src/policy.ts';

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
