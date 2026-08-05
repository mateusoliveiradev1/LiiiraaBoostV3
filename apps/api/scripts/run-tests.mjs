import { spawnSync } from 'node:child_process';

const forwarded = process.argv.slice(2).filter((argument) => argument !== '--');
const pnpmEntry = process.env['npm_execpath'];
const command = pnpmEntry ? process.execPath : process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const args = pnpmEntry
  ? [pnpmEntry, 'exec', 'vitest', '--config', 'vitest.config.ts', ...forwarded]
  : ['exec', 'vitest', '--config', 'vitest.config.ts', ...forwarded];
const result = spawnSync(command, args, { cwd: process.cwd(), stdio: 'inherit' });
process.exit(result.status ?? 1);
