import { spawnSync } from 'node:child_process';

const identityFlag = process.argv.indexOf('--identity');
const requestedIdentity =
  identityFlag === -1 ? undefined : process.argv[identityFlag + 1];

const testsByIdentity = Object.freeze({
  simulator: 'packages/desktop-simulator/src/conformance.test.ts',
  production: 'packages/desktop-production-reference/src/conformance.test.ts',
});

if (
  requestedIdentity !== undefined &&
  !Object.hasOwn(testsByIdentity, requestedIdentity)
) {
  console.error(
    `Unknown adapter identity "${requestedIdentity}". Expected simulator or production.`,
  );
  process.exit(2);
}

const testFiles =
  requestedIdentity === undefined
    ? Object.values(testsByIdentity)
    : [testsByIdentity[requestedIdentity]];
const pnpmCli = process.env['npm_execpath'];

if (pnpmCli === undefined || pnpmCli.length === 0) {
  console.error('pnpm CLI path is unavailable.');
  process.exit(2);
}

const result = spawnSync(
  process.execPath,
  [pnpmCli, 'exec', 'vitest', '--run', ...testFiles],
  {
    cwd: process.cwd(),
    stdio: 'inherit',
  },
);

if (result.error !== undefined) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
