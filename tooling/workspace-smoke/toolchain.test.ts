import { describe, expect, it } from 'vitest';

import { verifyWorkspaceSnapshot, type WorkspaceSnapshot } from './check-toolchain.mjs';

const exactVersions = {
  node: '24.18.0',
  pnpm: '11.17.0',
};

function exactSnapshot(): WorkspaceSnapshot {
  return {
    packageManifest: {
      packageManager: 'pnpm@11.17.0',
      devEngines: {
        runtime: {
          name: 'node',
          version: '24.18.0',
        },
        packageManager: {
          name: 'pnpm',
          version: '11.17.0',
        },
      },
      devDependencies: {
        typescript: '6.0.3',
      },
    },
    pnpmRoots: ['apps/*', 'packages/*', 'tooling/*'],
    rust: {
      channel: '1.97.1',
      profile: 'minimal',
      components: ['clippy', 'rustfmt'],
    },
    cargo: {
      resolver: '3',
      memberRoots: ['crates/*', 'tooling/*/rust'],
    },
    packageNames: ['@liiiraa/architecture-tests', '@liiiraa/workspace-smoke'],
  };
}

describe('workspace toolchain contract', () => {
  it('accepts the exact Node, pnpm, TypeScript, Rust, and workspace pins', () => {
    expect(() => {
      verifyWorkspaceSnapshot(exactSnapshot(), exactVersions);
    }).not.toThrow();
  });

  it.each([
    ['Node', '24.18.1', /Node pin.*24\.18\.0/u],
    ['pnpm', '11.16.0', /pnpm pin.*11\.17\.0/u],
    ['TypeScript', '6.0.4', /TypeScript pin.*6\.0\.3/u],
  ])('rejects a changed %s pin', (name, replacement, message) => {
    const snapshot = exactSnapshot();
    if (name === 'Node') {
      snapshot.packageManifest.devEngines.runtime.version = replacement;
    } else if (name === 'pnpm') {
      snapshot.packageManifest.packageManager = `pnpm@${replacement}`;
    } else {
      snapshot.packageManifest.devDependencies.typescript = replacement;
    }

    expect(() => {
      verifyWorkspaceSnapshot(snapshot, exactVersions);
    }).toThrow(message);
  });

  it('rejects a changed Rust pin', () => {
    const snapshot = exactSnapshot();
    snapshot.rust.channel = 'stable';

    expect(() => {
      verifyWorkspaceSnapshot(snapshot, exactVersions);
    }).toThrow(/Rust pin.*1\.97\.1/u);
  });

  it('rejects missing JavaScript or Rust workspace roots', () => {
    const snapshot = exactSnapshot();
    snapshot.pnpmRoots = ['packages/*', 'tooling/*'];

    expect(() => {
      verifyWorkspaceSnapshot(snapshot, exactVersions);
    }).toThrow(/missing required workspace root.*apps\/\*/u);

    snapshot.pnpmRoots = ['apps/*', 'packages/*', 'tooling/*'];
    snapshot.cargo.memberRoots = ['crates/*'];

    expect(() => {
      verifyWorkspaceSnapshot(snapshot, exactVersions);
    }).toThrow(/missing required Cargo member.*tooling\/\*\/rust/u);
  });

  it('rejects a non-resolver-3 Cargo workspace', () => {
    const snapshot = exactSnapshot();
    snapshot.cargo.resolver = '2';

    expect(() => {
      verifyWorkspaceSnapshot(snapshot, exactVersions);
    }).toThrow(/Cargo resolver.*3/u);
  });

  it('reports actionable local Node and pnpm mismatches', () => {
    expect(() => {
      verifyWorkspaceSnapshot(exactSnapshot(), {
        node: '24.16.0',
        pnpm: '10.0.0',
      });
    }).toThrow(/Node 24\.18\.0.*pnpm install/u);

    expect(() => {
      verifyWorkspaceSnapshot(exactSnapshot(), {
        node: '24.18.0',
        pnpm: '10.0.0',
      });
    }).toThrow(/pnpm 11\.17\.0.*Corepack/u);
  });

  it('rejects catch-all package names', () => {
    const snapshot = exactSnapshot();
    snapshot.packageNames.push('@liiiraa/shared');

    expect(() => {
      verifyWorkspaceSnapshot(snapshot, exactVersions);
    }).toThrow(/catch-all package name.*@liiiraa\/shared/u);
  });
});
