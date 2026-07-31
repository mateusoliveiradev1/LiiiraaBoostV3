import { readFileSync } from 'node:fs';

import { defineConfig, devices, type Project } from '@playwright/test';

const FROZEN_CLOCK = '2026-01-15T12:00:00.000Z';

type Scenario = Readonly<{ id: string; routeId: string }>;

const scenarioManifest = JSON.parse(
  readFileSync(new URL('../../contracts/scenarios/web-scenarios.json', import.meta.url), 'utf8'),
) as Readonly<{ scenarios: readonly Scenario[] }>;

const surfaces = [
  {
    app: '@liiiraa/web',
    baseURL: 'http://public.localhost:3100',
    port: 3100,
    readinessPath: '/pt-BR',
    surface: 'public',
  },
  {
    app: '@liiiraa/account',
    baseURL: 'http://account.localhost:3101',
    port: 3101,
    readinessPath: '/pt-BR/sign-in',
    surface: 'account',
  },
  {
    app: '@liiiraa/admin',
    baseURL: 'http://admin.localhost:3102',
    port: 3102,
    readinessPath: '/pt-BR/admin',
    surface: 'admin',
  },
] as const;

const axes = [
  {
    forcedColors: 'none',
    id: 'wide-1440',
    locale: 'pt-BR',
    reducedMotion: 'no-preference',
    textScalePercent: 100,
    viewport: { height: 900, width: 1440 },
    zoomPercent: 100,
  },
  {
    forcedColors: 'none',
    id: 'wide-1280',
    locale: 'en-US',
    reducedMotion: 'no-preference',
    textScalePercent: 100,
    viewport: { height: 800, width: 1280 },
    zoomPercent: 100,
  },
  {
    forcedColors: 'none',
    id: 'desktop-960',
    locale: 'pt-BR',
    reducedMotion: 'no-preference',
    textScalePercent: 100,
    viewport: { height: 900, width: 960 },
    zoomPercent: 100,
  },
  {
    forcedColors: 'none',
    id: 'tablet-768',
    locale: 'en-US',
    reducedMotion: 'no-preference',
    textScalePercent: 100,
    viewport: { height: 1024, width: 768 },
    zoomPercent: 100,
  },
  {
    forcedColors: 'none',
    id: 'mobile-390',
    locale: 'en-US',
    reducedMotion: 'no-preference',
    textScalePercent: 100,
    viewport: { height: 844, width: 390 },
    zoomPercent: 100,
  },
  {
    forcedColors: 'none',
    id: 'reflow-320',
    locale: 'en-US',
    reducedMotion: 'no-preference',
    textScalePercent: 100,
    viewport: { height: 800, width: 320 },
    zoomPercent: 400,
  },
  {
    forcedColors: 'none',
    id: 'text-200',
    locale: 'pt-BR',
    reducedMotion: 'no-preference',
    textScalePercent: 200,
    viewport: { height: 900, width: 960 },
    zoomPercent: 100,
  },
  {
    forcedColors: 'none',
    id: 'reduced-motion',
    locale: 'pt-BR',
    reducedMotion: 'reduce',
    textScalePercent: 100,
    viewport: { height: 900, width: 1440 },
    zoomPercent: 100,
  },
  {
    forcedColors: 'active',
    id: 'forced-colors',
    locale: 'en-US',
    reducedMotion: 'reduce',
    textScalePercent: 100,
    viewport: { height: 800, width: 1280 },
    zoomPercent: 100,
  },
] as const;

const scenarioSurface = (routeId: string): (typeof surfaces)[number]['surface'] =>
  routeId.startsWith('account-') ? 'account' : routeId.startsWith('admin-') ? 'admin' : 'public';

const scenarioIdsBySurface = Object.freeze({
  public: scenarioManifest.scenarios
    .filter(({ routeId }) => scenarioSurface(routeId) === 'public')
    .map(({ id }) => id),
  account: scenarioManifest.scenarios
    .filter(({ routeId }) => scenarioSurface(routeId) === 'account')
    .map(({ id }) => id),
  admin: scenarioManifest.scenarios
    .filter(({ routeId }) => scenarioSurface(routeId) === 'admin')
    .map(({ id }) => id),
});

const chromium = devices['Desktop Chrome'];

export const selectWebTestSurfaces = (
  arguments_: readonly string[],
): readonly (typeof surfaces)[number][] => {
  const selector = arguments_
    .filter(
      (argument) => /\.(?:spec|pw)\.ts(?:$|:)/u.test(argument) || argument.startsWith('--project='),
    )
    .join(' ');
  const startsEverySurface =
    selector.length === 0 ||
    /accessibility-responsive|security-artifacts|matrix\.config/u.test(selector);
  return surfaces.filter(({ surface }) =>
    startsEverySurface
      ? true
      : surface === 'public'
        ? /public|documentation|releases/u.test(selector)
        : selector.includes(surface),
  );
};

const selectedSurfaces = selectWebTestSurfaces(process.argv.slice(2));

const quickProjects: Project[] = surfaces.map(({ baseURL, surface }) => ({
  grep: new RegExp(`@quick @${surface}`, 'u'),
  metadata: {
    axis: 'quick',
    finalOnly: false,
    frozenClock: FROZEN_CLOCK,
    scenarioIds: scenarioIdsBySurface[surface].join(','),
    surface,
  },
  name: `${surface}-quick`,
  testMatch: '**/*.pw.ts',
  use: {
    ...chromium,
    baseURL,
    browserName: 'chromium',
    colorScheme: 'dark',
    forcedColors: 'none',
    locale: 'pt-BR',
    reducedMotion: 'reduce',
    viewport: { height: 900, width: 1440 },
  },
}));

const finalProjects: Project[] = surfaces.flatMap(({ baseURL, surface }) =>
  axes.map((axis) => ({
    grep: new RegExp(`@final @${surface}`, 'u'),
    metadata: {
      axis: axis.id,
      finalOnly: true,
      frozenClock: FROZEN_CLOCK,
      scenarioIds: scenarioIdsBySurface[surface].join(','),
      surface,
      textScalePercent: axis.textScalePercent,
      zoomPercent: axis.zoomPercent,
    },
    name: `${surface}-final-${axis.id}`,
    testMatch: ['**/*.pw.ts', '**/*.spec.ts'],
    use: {
      ...chromium,
      baseURL,
      browserName: 'chromium',
      colorScheme: 'dark',
      forcedColors: axis.forcedColors,
      locale: axis.locale,
      reducedMotion: axis.reducedMotion,
      viewport: axis.viewport,
    },
  })),
);

export default defineConfig({
  expect: {
    timeout: 5_000,
    toHaveScreenshot: {
      animations: 'disabled',
      scale: 'css',
    },
  },
  forbidOnly: true,
  fullyParallel: false,
  outputDir: 'test-results',
  projects: [...quickProjects, ...finalProjects],
  reporter: [['list']],
  retries: 0,
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}-{projectName}{ext}',
  testDir: './tests',
  timeout: 30_000,
  use: {
    actionTimeout: 5_000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off',
  },
  webServer: selectedSurfaces.map(({ app, baseURL, port, readinessPath }) => ({
    command: `pnpm --filter ${app} build && pnpm --filter ${app} start --hostname ${new URL(baseURL).hostname} --port ${String(port)}`,
    cwd: '../..',
    env: app === '@liiiraa/admin' ? { LIIIRAA_ADMIN_ORIGIN: baseURL } : {},
    reuseExistingServer: false,
    stderr: 'inherit',
    stdout: 'pipe',
    timeout: 300_000,
    url: `${baseURL}${readinessPath}`,
  })),
  workers: 1,
});

export { axes as WEB_BROWSER_AXES, scenarioIdsBySurface, surfaces as WEB_TEST_SURFACES };
