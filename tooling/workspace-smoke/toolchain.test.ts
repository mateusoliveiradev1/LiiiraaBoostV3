import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { verifyWorkspace } from './check-toolchain.mjs';

const exactVersions = {
  node: '24.18.0',
  pnpm: '11.17.0',
};

const temporaryRoots: string[] = [];

async function createWorkspaceFixture(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'liiiraa-workspace-smoke-'));
  temporaryRoots.push(root);

  await mkdir(path.join(root, 'tooling', 'architecture-tests'), {
    recursive: true,
  });
  await writeFile(
    path.join(root, 'package.json'),
    `${JSON.stringify(
      {
        name: '@liiiraa/workspace',
        version: '0.0.0',
        private: true,
        packageManager: 'pnpm@11.17.0',
        devEngines: {
          runtime: {
            name: 'node',
            version: '24.18.0',
            onFail: 'download',
          },
          packageManager: {
            name: 'pnpm',
            version: '11.17.0',
            onFail: 'download',
          },
        },
        devDependencies: {
          typescript: '6.0.3',
        },
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    path.join(root, 'tooling', 'architecture-tests', 'package.json'),
    `${JSON.stringify(
      {
        name: '@liiiraa/architecture-tests',
        version: '0.0.0',
        private: true,
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    path.join(root, 'pnpm-workspace.yaml'),
    'packages:\n  - apps/*\n  - packages/*\n  - tooling/*\n',
  );
  await writeFile(
    path.join(root, 'rust-toolchain.toml'),
    '[toolchain]\nchannel = "1.97.1"\nprofile = "minimal"\ncomponents = ["clippy", "rustfmt"]\n',
  );
  await writeFile(
    path.join(root, 'Cargo.toml'),
    '[workspace]\nresolver = "3"\nmembers = ["crates/*", "tooling/*/rust"]\n',
  );

  return root;
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map(async (root) => {
      await rm(root, { force: true, recursive: true });
    }),
  );
});

describe('workspace toolchain contract', () => {
  it('accepts the exact Node, pnpm, TypeScript, Rust, and workspace pins', async () => {
    const root = await createWorkspaceFixture();

    expect(() => {
      verifyWorkspace(root, exactVersions);
    }).not.toThrow();
  });

  it.each([
    ['Node', '"24.18.0"', '"24.18.1"', /Node pin.*24\.18\.0/u],
    ['pnpm', '"pnpm@11.17.0"', '"pnpm@11.16.0"', /pnpm pin.*11\.17\.0/u],
    ['TypeScript', '"6.0.3"', '"6.0.4"', /TypeScript pin.*6\.0\.3/u],
  ])('rejects a changed %s pin', async (_name, expected, replacement, message) => {
    const root = await createWorkspaceFixture();
    const packagePath = path.join(root, 'package.json');
    const contents = await import('node:fs/promises').then(({ readFile }) =>
      readFile(packagePath, 'utf8'),
    );
    await writeFile(packagePath, contents.replace(expected, replacement));

    expect(() => {
      verifyWorkspace(root, exactVersions);
    }).toThrow(message);
  });

  it('rejects a changed Rust pin', async () => {
    const root = await createWorkspaceFixture();
    await writeFile(
      path.join(root, 'rust-toolchain.toml'),
      '[toolchain]\nchannel = "stable"\nprofile = "minimal"\ncomponents = ["clippy", "rustfmt"]\n',
    );

    expect(() => {
      verifyWorkspace(root, exactVersions);
    }).toThrow(/Rust pin.*1\.97\.1/u);
  });

  it('rejects missing JavaScript or Rust workspace roots', async () => {
    const root = await createWorkspaceFixture();
    await writeFile(
      path.join(root, 'pnpm-workspace.yaml'),
      'packages:\n  - packages/*\n  - tooling/*\n',
    );

    expect(() => {
      verifyWorkspace(root, exactVersions);
    }).toThrow(/missing required workspace root.*apps\/\*/u);

    await writeFile(
      path.join(root, 'pnpm-workspace.yaml'),
      'packages:\n  - apps/*\n  - packages/*\n  - tooling/*\n',
    );
    await writeFile(
      path.join(root, 'Cargo.toml'),
      '[workspace]\nresolver = "3"\nmembers = ["crates/*"]\n',
    );

    expect(() => {
      verifyWorkspace(root, exactVersions);
    }).toThrow(/missing required Cargo member.*tooling\/\*\/rust/u);
  });

  it('rejects a non-resolver-3 Cargo workspace', async () => {
    const root = await createWorkspaceFixture();
    await writeFile(
      path.join(root, 'Cargo.toml'),
      '[workspace]\nresolver = "2"\nmembers = ["crates/*", "tooling/*/rust"]\n',
    );

    expect(() => {
      verifyWorkspace(root, exactVersions);
    }).toThrow(/Cargo resolver.*3/u);
  });

  it('reports actionable local Node and pnpm mismatches', async () => {
    const root = await createWorkspaceFixture();

    expect(() => {
      verifyWorkspace(root, { node: '24.16.0', pnpm: '10.0.0' });
    }).toThrow(/Node 24\.18\.0.*pnpm install/u);

    expect(() => {
      verifyWorkspace(root, { node: '24.18.0', pnpm: '10.0.0' });
    }).toThrow(/pnpm 11\.17\.0.*Corepack/u);
  });

  it('rejects catch-all JavaScript package names', async () => {
    const root = await createWorkspaceFixture();
    await mkdir(path.join(root, 'packages', 'shared'), { recursive: true });
    await writeFile(
      path.join(root, 'packages', 'shared', 'package.json'),
      '{"name":"@liiiraa/shared","version":"0.0.0","private":true}\n',
    );

    expect(() => {
      verifyWorkspace(root, exactVersions);
    }).toThrow(/catch-all package name.*@liiiraa\/shared/u);
  });
});
