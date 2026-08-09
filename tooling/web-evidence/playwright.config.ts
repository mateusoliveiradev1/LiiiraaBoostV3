import { readFileSync } from 'node:fs';

import { defineConfig, devices, type Project } from '@playwright/test';

const FROZEN_CLOCK = '2026-01-15T12:00:00.000Z';
const PUBLISHED_AUTHORITY_RUN_MARKER = 'LIIIRAA_PLAYWRIGHT_PUBLISHED_AUTHORITY_RUN';
const PRODUCTION_AUTHORITY_RUN_MARKER = 'LIIIRAA_PLAYWRIGHT_PRODUCTION_AUTHORITY_RUN';
const STAGING_ORIGIN_RUN_MARKER = 'LIIIRAA_PLAYWRIGHT_STAGING_ORIGIN_RUN';

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
    readinessPath: '/pt-BR/login',
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

const finalProjectGrep = (surface: (typeof surfaces)[number]['surface'], axis: string): RegExp =>
  new RegExp(
    `(?:@final @${surface}(?! @candidate-capture)|@final @${surface} @candidate-capture @project-${surface}-final-${axis}(?:\\s|$))`,
    'u',
  );

const isStagingOriginRun = (arguments_: readonly string[]): boolean =>
  arguments_.some((argument) => argument.includes('@staging-origin-'));

const isPublishedAuthorityRun = (arguments_: readonly string[]): boolean =>
  arguments_.some(
    (argument) =>
      argument.includes('@published-authority') ||
      argument.includes('--project=published-authority'),
  );

const isProductionAuthorityRun = (arguments_: readonly string[]): boolean =>
  arguments_.some(
    (argument) =>
      argument.includes('admin-operations.spec.ts') ||
      argument.includes('@production-authority') ||
      argument.includes('--project=production-authority'),
  );

const resolveConditionalProjectRuns = (
  arguments_: readonly string[],
  environment: NodeJS.ProcessEnv = process.env,
) => {
  const publishedAuthorityRun =
    isPublishedAuthorityRun(arguments_) || environment[PUBLISHED_AUTHORITY_RUN_MARKER] === '1';
  const productionAuthorityRun =
    !publishedAuthorityRun &&
    (isProductionAuthorityRun(arguments_) || environment[PRODUCTION_AUTHORITY_RUN_MARKER] === '1');
  const stagingOriginRun =
    isStagingOriginRun(arguments_) || environment[STAGING_ORIGIN_RUN_MARKER] === '1';

  if (publishedAuthorityRun) environment[PUBLISHED_AUTHORITY_RUN_MARKER] = '1';
  if (productionAuthorityRun) environment[PRODUCTION_AUTHORITY_RUN_MARKER] = '1';
  if (stagingOriginRun) environment[STAGING_ORIGIN_RUN_MARKER] = '1';

  return { productionAuthorityRun, publishedAuthorityRun, stagingOriginRun } as const;
};

export const resolvePublishedAdminOrigin = (environment: NodeJS.ProcessEnv): string => {
  const value = environment['ADMIN_STAGING_ORIGIN'];
  try {
    const origin = new URL(value ?? '');
    if (
      origin.protocol !== 'https:' ||
      origin.username ||
      origin.password ||
      origin.pathname !== '/' ||
      origin.search ||
      origin.hash
    ) {
      throw new Error('invalid');
    }
    return origin.origin;
  } catch {
    throw new Error('PUBLISHED_AUTHORITY_REQUIRES_CANONICAL_HTTPS_ADMIN_STAGING_ORIGIN');
  }
};

export const selectWebTestSurfaces = (
  arguments_: readonly string[],
): readonly (typeof surfaces)[number][] => {
  if (
    isStagingOriginRun(arguments_) ||
    isPublishedAuthorityRun(arguments_) ||
    isProductionAuthorityRun(arguments_)
  )
    return [];
  const selector = arguments_
    .filter(
      (argument) => /\.(?:spec|pw)\.ts(?:$|:)/u.test(argument) || argument.startsWith('--project='),
    )
    .join(' ');
  const hasExplicitProject = selector.includes('--project=');
  const isCrossSurfaceSecurityRun = selector.includes('security-artifacts.spec.ts');
  const isCrossSurfaceConsentRun = selector.includes('admin-consent-revocation.spec.ts');
  const startsEverySurface =
    selector.length === 0 ||
    isCrossSurfaceSecurityRun ||
    (!hasExplicitProject &&
      /accessibility-responsive|motion-contract|matrix\.config|final-route-experience/u.test(
        selector,
      ));
  return surfaces.filter(({ surface }) =>
    isCrossSurfaceConsentRun
      ? surface === 'account' || surface === 'admin'
      : startsEverySurface
        ? true
        : surface === 'public'
          ? /public|documentation|releases/u.test(selector)
          : selector.includes(surface),
  );
};

const { productionAuthorityRun, publishedAuthorityRun, stagingOriginRun } =
  resolveConditionalProjectRuns(process.argv.slice(2));
const selectedSurfaces =
  productionAuthorityRun || publishedAuthorityRun || stagingOriginRun
    ? []
    : selectWebTestSurfaces(process.argv.slice(2));
const accountAuthorityRun = process.argv.some((argument) =>
  argument.includes('account-authority.spec.ts'),
);
const adminAuthorityRun = process.argv.some(
  (argument) =>
    argument.includes('admin-authority.spec.ts') ||
    argument.includes('admin-consent-revocation.spec.ts'),
);

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
    grep: finalProjectGrep(surface, axis.id),
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
    testIgnore: '**/admin-operations.spec.ts',
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

const stagingOriginProject: Project = {
  grep: /@staging-origin-(?:smoke|live)/u,
  metadata: {
    axis: 'staging-origin',
    finalOnly: false,
    frozenClock: FROZEN_CLOCK,
    scenarioIds: '',
    surface: 'staging',
  },
  name: 'staging-origin',
  testMatch: '**/*.spec.ts',
  use: {
    ...chromium,
    browserName: 'chromium',
    colorScheme: 'dark',
    locale: 'pt-BR',
    reducedMotion: 'reduce',
    viewport: { height: 900, width: 1440 },
  },
};

const productionAuthorityProject: Project = {
  grep: /@production-authority/u,
  metadata: {
    axis: 'production-authority',
    finalOnly: false,
    frozenClock: FROZEN_CLOCK,
    scenarioIds: '',
    surface: 'admin',
  },
  name: 'production-authority',
  testMatch: '**/admin-operations.spec.ts',
  use: {
    ...chromium,
    baseURL: 'https://admin.staging.localhost:3444',
    browserName: 'chromium',
    colorScheme: 'dark',
    ignoreHTTPSErrors: true,
    locale: 'pt-BR',
    reducedMotion: 'reduce',
    viewport: { height: 1000, width: 1600 },
  },
};

const publishedAuthorityProject = (baseURL: string): Project => ({
  grep: /@published-authority/u,
  metadata: {
    axis: 'published-authority',
    finalOnly: false,
    frozenClock: FROZEN_CLOCK,
    scenarioIds: '',
    surface: 'admin',
  },
  name: 'published-authority',
  testMatch: '**/admin-operations.spec.ts',
  use: {
    ...chromium,
    baseURL,
    browserName: 'chromium',
    colorScheme: 'dark',
    locale: 'pt-BR',
    reducedMotion: 'reduce',
    viewport: { height: 1000, width: 1600 },
  },
});

const webServers = publishedAuthorityRun
  ? []
  : productionAuthorityRun
    ? [
        {
          command: 'pnpm --filter @liiiraa/web-evidence real-admin:harness',
          cwd: '../..',
          ignoreHTTPSErrors: true,
          reuseExistingServer: false,
          stderr: 'pipe' as const,
          stdout: 'pipe' as const,
          timeout: 300_000,
          url: 'https://admin.staging.localhost:3444/pt-BR/admin',
        },
      ]
    : selectedSurfaces.map(({ app, baseURL, port, readinessPath }) => ({
        command: `pnpm --filter ${app} build && pnpm --filter ${app} start --hostname ${new URL(baseURL).hostname} --port ${String(port)}`,
        cwd: '../..',
        env:
          app === '@liiiraa/admin'
            ? {
                LIIIRAA_ACCOUNT_ORIGIN: 'https://liiiraa-boost-account-staging.vercel.app',
                LIIIRAA_ADMIN_ORIGIN: baseURL,
                LIIIRAA_ADMIN_PREVIEW: adminAuthorityRun ? 'false' : 'true',
              }
            : app === '@liiiraa/account'
              ? { LIIIRAA_ACCOUNT_PREVIEW: accountAuthorityRun ? 'false' : 'true' }
              : {},
        reuseExistingServer: false,
        stderr: 'pipe' as const,
        stdout: 'pipe' as const,
        timeout: 300_000,
        url: `${baseURL}${readinessPath}`,
      }));

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
  projects: [
    ...quickProjects,
    ...finalProjects,
    ...(stagingOriginRun ? [stagingOriginProject] : []),
    ...(productionAuthorityRun ? [productionAuthorityProject] : []),
    ...(publishedAuthorityRun
      ? [publishedAuthorityProject(resolvePublishedAdminOrigin(process.env))]
      : []),
  ],
  reporter: [['list']],
  retries: 0,
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}-{projectName}{ext}',
  testDir: './tests',
  timeout: 30_000,
  updateSnapshots: 'none',
  use: {
    actionTimeout: 5_000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off',
  },
  webServer: webServers,
  workers: 1,
});

export { axes as WEB_BROWSER_AXES, scenarioIdsBySurface, surfaces as WEB_TEST_SURFACES };
