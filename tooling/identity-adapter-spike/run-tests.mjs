import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const toolingDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(toolingDirectory, '..', '..');
const result = spawnSync(
  process.execPath,
  [
    resolve(repositoryRoot, 'node_modules', 'vitest', 'vitest.mjs'),
    '--run',
    resolve(
      repositoryRoot,
      'packages',
      'control-plane-adapters',
      'src',
      'identity',
      'better-auth.spike.test.ts',
    ),
  ],
  { cwd: repositoryRoot, stdio: 'inherit' },
);

process.exit(result.status ?? 1);
