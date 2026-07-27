import { describe, expect, it } from 'vitest';

import canonicalPolicy from '../../../architecture/module-boundaries.json' with { type: 'json' };

import { discoverPnpmWorkspaceRoots } from './check-workspace.ts';

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
