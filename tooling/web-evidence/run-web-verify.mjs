import { spawnSync } from 'node:child_process';

const arguments_ = process.argv.slice(2).filter((argument) => argument !== '--');
const requirementIndex = arguments_.indexOf('--requirement');
const requirement = requirementIndex === -1 ? undefined : arguments_[requirementIndex + 1];

if (
  requirementIndex !== -1 &&
  (requirement === undefined || !['WEB-01', 'WEB-02', 'WEB-03', 'WEB-08'].includes(requirement))
) {
  console.error('--requirement must be WEB-01, WEB-02, WEB-03, or WEB-08.');
  process.exitCode = 1;
} else {
  const pnpmRuntime = process.env.npm_execpath;
  if (pnpmRuntime === undefined) {
    throw new Error('pnpm lifecycle runtime is unavailable.');
  }
  const commands = [
    ['web:check'],
    ['web:test'],
    ...(requirement === undefined
      ? []
      : [['--filter', '@liiiraa/web-evidence', 'readiness', '--', '--requirement', requirement]]),
  ];

  for (const command of commands) {
    const child = spawnSync(process.execPath, [pnpmRuntime, ...command], {
      cwd: process.cwd(),
      stdio: 'inherit',
    });
    if (child.status !== 0) {
      process.exitCode = child.status ?? 1;
      break;
    }
  }
}
