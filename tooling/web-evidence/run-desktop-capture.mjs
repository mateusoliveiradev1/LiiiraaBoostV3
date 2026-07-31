import { spawnSync } from 'node:child_process';

const pnpmRuntime = process.env.npm_execpath;
if (pnpmRuntime === undefined) {
  throw new Error('pnpm lifecycle runtime is unavailable.');
}

const arguments_ = process.argv.slice(2).filter((argument) => argument !== '--');
const child = spawnSync(
  process.execPath,
  [pnpmRuntime, 'exec', 'vitest', '--run', '-t', 'desktop capture CLI'],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      LIIIRAA_DESKTOP_CAPTURE_ARGS: JSON.stringify(arguments_),
    },
    stdio: 'inherit',
  },
);

process.exitCode = child.status ?? 1;
