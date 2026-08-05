import { spawnSync } from 'node:child_process';

const requested = process.argv.slice(2).filter((argument) => argument !== '--');
const forwarded =
  requested.includes('--run') || requested.includes('run') ? requested : ['--run', ...requested];
const pnpmEntry = process.env['npm_execpath'];
const command = pnpmEntry ? process.execPath : process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const args = pnpmEntry
  ? [pnpmEntry, 'exec', 'vitest', '--config', 'vitest.config.ts', ...forwarded]
  : ['exec', 'vitest', '--config', 'vitest.config.ts', ...forwarded];
const result = spawnSync(command, args, { cwd: process.cwd(), stdio: 'inherit' });
process.exit(result.status ?? 1);
