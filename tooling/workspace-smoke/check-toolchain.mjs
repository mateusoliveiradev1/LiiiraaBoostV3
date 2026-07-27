import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const expected = Object.freeze({
  cargoMemberRoots: ['crates/*', 'tooling/*/rust'],
  cargoResolver: '3',
  node: '24.18.0',
  pnpm: '11.17.0',
  pnpmRoots: ['apps/*', 'packages/*', 'tooling/*'],
  rust: '1.97.1',
  rustComponents: ['clippy', 'rustfmt'],
  typescript: '6.0.3',
});

const forbiddenCatchAllNames = new Set(['common', 'services', 'shared', 'utils']);

function fail(message) {
  throw new Error(`Workspace toolchain contract failed: ${message}`);
}

function readText(root, relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!existsSync(absolutePath)) {
    fail(`missing required repository file: ${relativePath}`);
  }
  return readFileSync(absolutePath, 'utf8');
}

function readJson(root, relativePath) {
  const contents = readText(root, relativePath);
  try {
    return JSON.parse(contents);
  } catch (error) {
    fail(
      `${relativePath} must contain valid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function assertExact(actual, wanted, label) {
  if (actual !== wanted) {
    fail(`${label} must be exactly ${wanted}; found ${String(actual)}`);
  }
}

function parseList(text, key, source) {
  const match = new RegExp(`${key}\\s*=\\s*\\[([\\s\\S]*?)\\]`, 'u').exec(text);
  if (!match) {
    fail(`${source} must declare ${key}`);
  }
  return [...match[1].matchAll(/"([^"]+)"/gu)].map((entry) => entry[1]);
}

function parsePnpmRoots(text) {
  return text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).replace(/^["']|["']$/gu, ''));
}

function assertContainsAll(actual, required, label) {
  for (const item of required) {
    if (!actual.includes(item)) {
      const requirement = label.includes('Cargo') ? 'Cargo member' : 'workspace root';
      fail(`${label} is missing required ${requirement} ${item}`);
    }
  }
}

function packageManifestPaths(root) {
  const manifests = [];
  const pending = ['apps', 'packages', 'tooling']
    .map((directory) => path.join(root, directory))
    .filter((directory) => existsSync(directory));

  while (pending.length > 0) {
    const current = pending.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.') || entry.isSymbolicLink()) {
        continue;
      }
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(entryPath);
      } else if (entry.isFile() && entry.name === 'package.json') {
        manifests.push(entryPath);
      }
    }
  }

  return manifests;
}

function packageNames(root) {
  return packageManifestPaths(root).map((manifestPath) => {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    if (typeof manifest.name !== 'string') {
      fail(`${path.relative(root, manifestPath)} must declare a string package name`);
    }
    return manifest.name;
  });
}

function assertOwnedPackageNames(names) {
  for (const name of names) {
    const capabilityName = name.split('/').at(-1)?.toLowerCase();
    if (capabilityName && forbiddenCatchAllNames.has(capabilityName)) {
      fail(`catch-all package name is forbidden: ${name}`);
    }
  }
}

function readWorkspaceSnapshot(root) {
  const rustToolchain = readText(root, 'rust-toolchain.toml');
  const cargoManifest = readText(root, 'Cargo.toml');
  return {
    packageManifest: readJson(root, 'package.json'),
    pnpmRoots: parsePnpmRoots(readText(root, 'pnpm-workspace.yaml')),
    rust: {
      channel: /channel\s*=\s*"([^"]+)"/u.exec(rustToolchain)?.[1],
      profile: /profile\s*=\s*"([^"]+)"/u.exec(rustToolchain)?.[1],
      components: parseList(rustToolchain, 'components', 'rust-toolchain.toml'),
    },
    cargo: {
      resolver: /resolver\s*=\s*"([^"]+)"/u.exec(cargoManifest)?.[1],
      memberRoots: parseList(cargoManifest, 'member-roots', 'Cargo.toml'),
    },
    packageNames: packageNames(root),
  };
}

function assertRepositoryConfiguration(snapshot) {
  const { packageManifest } = snapshot;
  assertExact(
    packageManifest.packageManager,
    `pnpm@${expected.pnpm}`,
    'pnpm pin in packageManager',
  );
  assertExact(packageManifest.devEngines?.runtime?.name, 'node', 'Node runtime name');
  assertExact(
    packageManifest.devEngines?.runtime?.version,
    expected.node,
    'Node pin in devEngines',
  );
  assertExact(
    packageManifest.devEngines?.packageManager?.name,
    'pnpm',
    'pnpm package manager name',
  );
  assertExact(
    packageManifest.devEngines?.packageManager?.version,
    expected.pnpm,
    'pnpm pin in devEngines',
  );
  assertExact(packageManifest.devDependencies?.typescript, expected.typescript, 'TypeScript pin');

  assertContainsAll(snapshot.pnpmRoots, expected.pnpmRoots, 'pnpm workspace');

  assertExact(snapshot.rust.channel, expected.rust, 'Rust pin');
  assertExact(snapshot.rust.profile, 'minimal', 'Rust toolchain profile');
  assertContainsAll(snapshot.rust.components, expected.rustComponents, 'Rust toolchain components');

  assertExact(snapshot.cargo.resolver, expected.cargoResolver, 'Cargo resolver');
  assertContainsAll(snapshot.cargo.memberRoots, expected.cargoMemberRoots, 'Cargo workspace');

  assertOwnedPackageNames(snapshot.packageNames);
}

function assertLocalVersions(actualVersions) {
  if (actualVersions.node !== expected.node) {
    fail(
      `expected local Node ${expected.node}, found ${actualVersions.node || 'unknown'}. Run pnpm install so devEngines downloads the pinned runtime, then invoke checks through pnpm.`,
    );
  }
  if (actualVersions.pnpm !== expected.pnpm) {
    fail(
      `expected local pnpm ${expected.pnpm}, found ${actualVersions.pnpm || 'unknown'}. Enable Corepack and run corepack prepare pnpm@${expected.pnpm} --activate.`,
    );
  }
}

export function verifyWorkspaceSnapshot(snapshot, actualVersions) {
  assertRepositoryConfiguration(snapshot);
  assertLocalVersions(actualVersions);
  return expected;
}

export function verifyWorkspace(root, actualVersions) {
  return verifyWorkspaceSnapshot(readWorkspaceSnapshot(root), actualVersions);
}

function pnpmVersionFromUserAgent(userAgent) {
  return /^pnpm\/([^\s]+)/u.exec(userAgent ?? '')?.[1] ?? '';
}

const modulePath = fileURLToPath(import.meta.url);
if (
  process.argv[1] &&
  path.resolve(process.argv[1]).toLowerCase() === path.resolve(modulePath).toLowerCase()
) {
  const repositoryRoot = path.resolve(path.dirname(modulePath), '..', '..');
  try {
    verifyWorkspace(repositoryRoot, {
      node: process.versions.node,
      pnpm: pnpmVersionFromUserAgent(process.env.npm_config_user_agent),
    });
    console.log(
      `Workspace toolchain contract verified: Node ${expected.node}, pnpm ${expected.pnpm}, TypeScript ${expected.typescript}, Rust ${expected.rust}, Cargo resolver ${expected.cargoResolver}.`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
