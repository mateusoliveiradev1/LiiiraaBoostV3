import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const prefix = '[wave-zero]';
const workspaceRoot = fileURLToPath(new URL('../..', import.meta.url));

const fail = (code, message) => {
  throw new Error(`${prefix} ${code}: ${message}`);
};

const readJson = (relativePath) =>
  JSON.parse(readFileSync(resolve(workspaceRoot, relativePath), 'utf8'));

export const loadWaveZeroSnapshot = () => ({
  catalog: readJson('contracts/scenarios/desktop-scenarios.json'),
  desktopPackage: readJson('apps/desktop/package.json'),
  packagedMatrix: readJson('apps/desktop/tests/packaged/windows-matrix.json'),
  rootPackage: readJson('package.json'),
  storyManifest: readJson('tooling/desktop-evidence/story-manifest.json'),
  uxManifests: Array.from({ length: 12 }, (_value, index) => {
    const id = String(index + 1).padStart(2, '0');
    return readJson(`quality/features/ux-${id}.json`);
  }),
});

export const verifyWaveZero = (_snapshot) => {
  fail('WAVE_ZERO_IMPLEMENTATION_REQUIRED', 'unified Wave 0 verification is not implemented.');
};

const parseArguments = (arguments_) => {
  if (
    arguments_.length !== 3 ||
    arguments_[0] !== '--mode' ||
    arguments_[1] !== 'planned' ||
    arguments_[2] !== '--smoke'
  ) {
    fail('CLI_USAGE', 'expected --mode planned --smoke.');
  }
  return { mode: 'planned', selector: 'smoke' };
};

const isDirectExecution =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isDirectExecution) {
  try {
    parseArguments(process.argv.slice(2));
    verifyWaveZero(loadWaveZeroSnapshot());
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
