import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { delimiter, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const COMMAND_TIMEOUT_MS = 120_000;
const BROWSER_TIMEOUT_MS = 15 * 60_000;
const QUICK_FOUNDATION_TIMEOUT_MS = 10 * 60_000;
const FINAL_FOUNDATION_TIMEOUT_MS = 25 * 60_000;
const desktopRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workspaceRoot = resolve(desktopRoot, '..', '..');
const isPnpmNodeCli = (candidate) =>
  candidate !== undefined &&
  /(?:^|[\\/])pnpm\.(?:c?js|mjs)$/iu.test(candidate) &&
  existsSync(candidate);
const pnpmCliPath = [
  process.env.npm_execpath,
  ...(process.env.PATH?.split(delimiter).map((pathEntry) =>
    resolve(pathEntry, 'node_modules', 'pnpm', 'bin', 'pnpm.cjs'),
  ) ?? []),
].find(isPnpmNodeCli);

const requiredScripts = Object.freeze([
  'build',
  'check',
  'test',
  'test:stories',
  'test:e2e',
  'test:packaged',
  'test:scenarios',
  'test:localization',
  'test:evidence',
  'test:wave-zero',
  'verify:quick',
  'verify',
]);

const requiredLifecycleFiles = Object.freeze(['package.json', 'tsconfig.json', 'vite.config.ts']);

const fail = (message) => {
  process.stderr.write(`[desktop-lifecycle] ${message}\n`);
  process.exitCode = 1;
};

const requirePath = (relativePath, owner) => {
  const absolutePath = resolve(workspaceRoot, relativePath);
  if (!existsSync(absolutePath)) {
    throw new Error(
      `${owner} artifact is missing: ${relativePath}. Run its owning Phase 02 plan before claiming this gate.`,
    );
  }
  return absolutePath;
};

const run = (executable, arguments_, cwd = desktopRoot, timeoutMs = COMMAND_TIMEOUT_MS) => {
  const result = spawnSync(executable, arguments_, {
    cwd,
    encoding: 'utf8',
    stdio: 'inherit',
    timeout: timeoutMs,
  });

  if (result.error?.code === 'ETIMEDOUT') {
    throw new Error(
      `Command exceeded the ${timeoutMs / 1_000}-second lifecycle budget: ${executable} ${arguments_.join(' ')}`,
    );
  }

  if (result.error !== undefined) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `Command failed with exit code ${String(result.status)}: ${executable} ${arguments_.join(' ')}`,
    );
  }
};

const runPnpm = (arguments_, cwd = desktopRoot, timeoutMs = COMMAND_TIMEOUT_MS) => {
  if (pnpmCliPath === undefined || !isPnpmNodeCli(pnpmCliPath)) {
    throw new Error(
      'Unable to resolve the active pnpm Node CLI from npm_execpath. Run this lifecycle through pnpm.',
    );
  }
  run(process.execPath, [pnpmCliPath, ...arguments_], cwd, timeoutMs);
};

const hasFlag = (arguments_, flag) => arguments_.includes(flag);

const withoutFlag = (arguments_, flag) => arguments_.filter((argument) => argument !== flag);

const optionValue = (arguments_, option) => {
  const optionIndex = arguments_.indexOf(option);
  return optionIndex === -1 ? undefined : arguments_[optionIndex + 1];
};

const withoutOption = (arguments_, option) => {
  const optionIndex = arguments_.indexOf(option);
  if (optionIndex === -1) {
    return arguments_;
  }
  return arguments_.filter(
    (_argument, index) => index !== optionIndex && index !== optionIndex + 1,
  );
};

const verifyLifecycleContract = () => {
  for (const relativePath of requiredLifecycleFiles) {
    requirePath(`apps/desktop/${relativePath}`, 'Plan 02-15 lifecycle');
  }

  const desktopPackage = JSON.parse(readFileSync(resolve(desktopRoot, 'package.json'), 'utf8'));
  const workspacePackage = JSON.parse(readFileSync(resolve(workspaceRoot, 'package.json'), 'utf8'));
  const scripts = desktopPackage.scripts ?? {};
  const workspaceScripts = workspacePackage.scripts ?? {};

  for (const scriptName of requiredScripts) {
    const command = scripts[scriptName];
    if (typeof command !== 'string' || command.trim() === '') {
      throw new Error(`Desktop lifecycle script is missing: ${scriptName}`);
    }
    if (/(^|\s)(watch|dev)(\s|$)/u.test(command)) {
      throw new Error(
        `Desktop lifecycle script must terminate and cannot use watch mode: ${scriptName}`,
      );
    }
  }

  const expectedRootLinks = Object.freeze({
    'verify:quick': 'pnpm --filter @liiiraa/desktop verify:quick && pnpm web:verify:quick',
    verify: 'pnpm --filter @liiiraa/desktop verify && pnpm web:verify',
  });

  for (const [scriptName, expectedCommand] of Object.entries(expectedRootLinks)) {
    if (workspaceScripts[scriptName] !== expectedCommand) {
      throw new Error(
        `Root lifecycle script ${scriptName} must resolve exactly to the desktop and web packages.`,
      );
    }
  }

  for (const foundationScript of ['verify:foundation:quick', 'verify:foundation']) {
    if (
      typeof workspaceScripts[foundationScript] !== 'string' ||
      workspaceScripts[foundationScript].trim() === ''
    ) {
      throw new Error(`Root foundation lifecycle is missing: ${foundationScript}`);
    }
  }

  for (const packageRoot of [
    'packages/design-tokens',
    'packages/design-system',
    'packages/feature-shell',
    'apps/desktop',
  ]) {
    requirePath(`${packageRoot}/package.json`, 'Workspace package');
    requirePath(`${packageRoot}/tsconfig.json`, 'Strict compiler');
  }

  const publicRoot = readFileSync(
    requirePath('apps/desktop/src/index.ts', 'Desktop public root'),
    'utf8',
  );
  const exportedNames = [
    ...publicRoot.matchAll(/\bexport\s+(?:interface|type|const|class|function)\s+(\w+)/gu),
  ].map((match) => match[1]);

  if (exportedNames.length !== 1 || exportedNames[0] !== 'DesktopCompositionBootstrap') {
    throw new Error(
      'Desktop public root must export only DesktopCompositionBootstrap during Plan 02-15.',
    );
  }

  runPnpm(['exec', 'turbo', 'ls'], workspaceRoot);

  process.stdout.write(
    '[desktop-lifecycle] lifecycle smoke passed: strict configs, bounded scripts, and empty composition public root are wired.\n',
  );
};

const runVitest = (arguments_) => {
  runPnpm([
    'exec',
    'vitest',
    '--run',
    '--exclude',
    'tests/browser/**/*.spec.ts',
    ...arguments_.filter((argument) => argument !== '--run'),
  ]);
};

const runPlaywright = (arguments_, defaultProject) => {
  requirePath('apps/desktop/playwright.config.ts', 'Browser Wave 0');
  requirePath('apps/desktop/tests/browser', 'Browser Wave 0');
  const projectArguments =
    defaultProject !== undefined && !hasFlag(arguments_, '--project')
      ? ['--project', defaultProject]
      : [];
  runPnpm(
    [
      'exec',
      'playwright',
      'test',
      '--config',
      'playwright.config.ts',
      ...projectArguments,
      ...arguments_,
    ],
    desktopRoot,
    BROWSER_TIMEOUT_MS,
  );
};

const runFocusedVitest = (arguments_, option, prefix) => {
  const focus = optionValue(arguments_, option);
  const forwarded = withoutOption(arguments_, option);
  runVitest(focus === undefined ? forwarded : ['-t', `${prefix}.*${focus}`, ...forwarded]);
};

const executeCommand = (command, arguments_) => {
  switch (command) {
    case 'unit':
      runVitest(arguments_);
      return;
    case 'stories':
      requirePath('apps/desktop/.storybook/main.ts', 'Storybook Wave 0');
      if (arguments_.length > 0) {
        throw new Error('Storybook smoke does not accept Playwright selectors.');
      }
      executeCommand('wave-zero', ['--browser-smoke']);
      return;
    case 'browser':
      runPlaywright(arguments_);
      return;
    case 'packaged': {
      const driverPath = requirePath('apps/desktop/tests/packaged/driver.ts', 'Packaged Wave 0');
      run(
        process.execPath,
        ['--experimental-strip-types', driverPath, ...arguments_],
        workspaceRoot,
      );
      return;
    }
    case 'scenarios':
      requirePath('contracts/scenarios/desktop-scenarios.json', 'Canonical scenario');
      runFocusedVitest(arguments_, '--scenario', 'scenario');
      return;
    case 'localization':
      requirePath('apps/desktop/src/locales/pt-BR.json', 'Localization');
      requirePath('apps/desktop/src/locales/en.json', 'Localization');
      runFocusedVitest(arguments_, '--locale', 'locale');
      return;
    case 'evidence': {
      const verifierPath = requirePath(
        'tooling/desktop-evidence/verify-phase.mjs',
        'Final Phase 02 evidence',
      );
      run(process.execPath, [verifierPath, ...arguments_], workspaceRoot);
      return;
    }
    case 'wave-zero': {
      if (hasFlag(arguments_, '--browser-smoke')) {
        requirePath('apps/desktop/.storybook/main.ts', 'Browser Wave 0');
        runPnpm([
          'exec',
          'storybook',
          'dev',
          '--smoke-test',
          '--ci',
          '--no-open',
          '--exact-port',
          '--port',
          '6006',
        ]);
        return;
      }
      if (hasFlag(arguments_, '--story-parity')) {
        requirePath('tooling/desktop-evidence/story-manifest.json', 'Story parity');
        runFocusedVitest([], '--scenario', 'story parity');
        return;
      }
      if (hasFlag(arguments_, '--packaged-schema')) {
        executeCommand('packaged', ['--dry-run', '--schema-smoke']);
        return;
      }
      throw new Error(
        'Wave 0 requires one focused selector: --browser-smoke, --story-parity, or --packaged-schema.',
      );
    }
    case 'quick':
      if (hasFlag(arguments_, '--smoke') && optionValue(arguments_, '--smoke') === 'lifecycle') {
        verifyLifecycleContract();
        return;
      }
      runPnpm(['verify:foundation:quick'], workspaceRoot, QUICK_FOUNDATION_TIMEOUT_MS);
      executeCommand('unit', []);
      executeCommand('stories', []);
      executeCommand('browser', ['--project', 'harness', '--grep', '@browser-smoke']);
      executeCommand('wave-zero', ['--packaged-schema']);
      return;
    case 'final': {
      const packagedSchemaOnly = hasFlag(arguments_, '--packaged-schema-only');
      const forwardedArguments = withoutFlag(arguments_, '--packaged-schema-only');
      runPnpm(['verify:foundation'], workspaceRoot, FINAL_FOUNDATION_TIMEOUT_MS);
      executeCommand('unit', forwardedArguments);
      executeCommand('stories', forwardedArguments);
      executeCommand('browser', forwardedArguments);
      executeCommand(
        'packaged',
        packagedSchemaOnly ? ['--dry-run', '--schema-smoke'] : forwardedArguments,
      );
      executeCommand('scenarios', forwardedArguments);
      executeCommand('localization', forwardedArguments);
      executeCommand('evidence', ['--mode', 'final', ...forwardedArguments]);
      return;
    }
    default:
      throw new Error(`Unknown desktop lifecycle command: ${command}`);
  }
};

const [command, ...rawArguments] = process.argv.slice(2);
while (rawArguments[0] === '--') {
  rawArguments.shift();
}
const arguments_ = rawArguments;

try {
  if (command === undefined) {
    throw new Error('A desktop lifecycle command is required.');
  }
  executeCommand(command, arguments_);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
