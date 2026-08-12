import { spawnSync } from 'node:child_process';

const modeIndex = process.argv.findIndex((argument) => argument === '--mode');
const mode =
  modeIndex >= 0
    ? (process.argv[modeIndex + 1] ?? 'planned')
    : process.argv.includes('final')
      ? 'final'
      : 'planned';

const commands = [
  ['pnpm', ['--filter', '@liiiraa/phase5-evidence', 'test', '--', '--run']],
  ['pnpm', ['--filter', '@liiiraa/phase5-evidence', 'check']],
  ['pnpm', ['contracts:check']],
  ['pnpm', ['--filter', '@liiiraa/desktop-client', 'test', '--', '--run']],
  [
    'pnpm',
    ['--filter', '@liiiraa/feature-shell', 'test', '--', '--run', 'technical-surfaces.test.tsx'],
  ],
  ['pnpm', ['--filter', '@liiiraa/desktop', 'check']],
  ['pnpm', ['--filter', '@liiiraa/desktop', 'build']],
  [
    'cargo',
    [
      'test',
      '--manifest-path',
      'apps/desktop/src-tauri/Cargo.toml',
      'evidence',
      '--',
      '--nocapture',
    ],
  ],
  ['pnpm', ['--filter', '@liiiraa/desktop', 'test:e2e', '--', '--grep', 'measurement authority']],
];

for (const [command, args] of commands) {
  const result = spawnSync(command, args, { shell: true, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const probeArgs = [
  '-NoProfile',
  '-ExecutionPolicy',
  'Bypass',
  '-File',
  'tooling/phase5-evidence/src/windows-probe.ps1',
  '-Mode',
  mode === 'final' ? 'All' : 'Deterministic',
];
const probe = spawnSync('powershell', probeArgs, { shell: true, stdio: 'inherit' });
if (probe.status !== 0) process.exit(probe.status ?? 1);

const evaluation = spawnSync(
  'node',
  ['--experimental-strip-types', 'tooling/phase5-evidence/src/evaluate.ts', '--mode', mode],
  { shell: true, stdio: 'inherit' },
);
process.exit(evaluation.status ?? 1);
