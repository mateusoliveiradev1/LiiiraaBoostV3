import { defineConfig, devices, type Project } from '@playwright/test';

const viewports = Object.freeze([
  Object.freeze({ height: 900, id: '1440x900', width: 1440 }),
  Object.freeze({ height: 800, id: '1280x800', width: 1280 }),
  Object.freeze({ height: 700, id: '960x700', width: 960 }),
  Object.freeze({ height: 600, id: '760x600', width: 760 }),
]);

const locales = Object.freeze([
  Object.freeze({ browserLocale: 'pt-BR', id: 'pt-BR' }),
  Object.freeze({ browserLocale: 'en-US', id: 'en' }),
  Object.freeze({ browserLocale: 'en-XA', id: 'pseudo' }),
]);

const scales = Object.freeze([
  Object.freeze({ deviceScaleFactor: 1, id: '100' }),
  Object.freeze({ deviceScaleFactor: 1.25, id: '125' }),
  Object.freeze({ deviceScaleFactor: 1.5, id: '150' }),
]);

const motions = Object.freeze([
  Object.freeze({ id: 'responsive', reducedMotion: 'no-preference' as const }),
  Object.freeze({ id: 'reduced', reducedMotion: 'reduce' as const }),
]);

const contrasts = Object.freeze([
  Object.freeze({ forcedColors: 'none' as const, id: 'normal' }),
  Object.freeze({ forcedColors: 'active' as const, id: 'forced' }),
]);

const browserProjects: Project[] = viewports.flatMap((viewport) =>
  locales.flatMap((locale) =>
    scales.flatMap((scale) =>
      motions.flatMap((motion) =>
        contrasts.map((contrast) => ({
          metadata: {
            appScale: scale.id,
            contrast: contrast.id,
            locale: locale.id,
            motion: motion.id,
            scenarioMarker: 'SIMULATED SCENARIO',
            viewport: viewport.id,
          },
          name: [
            'browser',
            viewport.id,
            locale.id,
            `scale-${scale.id}`,
            motion.id,
            contrast.id,
          ].join('-'),
          testMatch: '**/*.browser.spec.ts',
          use: {
            ...devices['Desktop Chrome'],
            baseURL: 'http://127.0.0.1:4173',
            contextOptions: {
              reducedMotion: motion.reducedMotion,
            },
            deviceScaleFactor: scale.deviceScaleFactor,
            forcedColors: contrast.forcedColors,
            locale: locale.browserLocale,
            viewport: { height: viewport.height, width: viewport.width },
          },
        })),
      ),
    ),
  ),
);

export default defineConfig({
  expect: {
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    },
  },
  forbidOnly: true,
  fullyParallel: false,
  outputDir: 'test-results/browser',
  projects: [
    {
      metadata: {
        contrastAxes: contrasts.length,
        localeAxes: locales.length,
        motionAxes: motions.length,
        scaleAxes: scales.length,
        scenarioMarker: 'SIMULATED SCENARIO',
        viewportAxes: viewports.length,
      },
      name: 'harness',
      testMatch: '**/*.config.pw.ts',
    },
    {
      metadata: {
        appScale: '100',
        contrast: 'normal',
        locale: 'pt-BR',
        motion: 'responsive',
        scenarioMarker: 'SIMULATED SCENARIO',
        viewport: '1440x900',
      },
      name: 'chromium',
      testMatch: '**/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://127.0.0.1:4173',
        locale: 'pt-BR',
        viewport: { height: 900, width: 1440 },
      },
    },
    {
      name: 'storybook',
      testMatch: '**/*.stories.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://127.0.0.1:6006',
        contextOptions: {
          reducedMotion: 'reduce',
        },
        locale: 'pt-BR',
        viewport: { height: 900, width: 1440 },
      },
    },
    ...browserProjects,
  ],
  reporter: [['list']],
  retries: 0,
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}-{projectName}{ext}',
  testDir: './tests/browser',
  timeout: 30_000,
  use: {
    actionTimeout: 5_000,
    colorScheme: 'dark',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off',
  },
  webServer: {
    command: 'pnpm build && pnpm exec vite preview',
    reuseExistingServer: process.env['CI'] !== 'true',
    stderr: 'pipe',
    stdout: 'pipe',
    timeout: 120_000,
    url: 'http://127.0.0.1:4173',
  },
  workers: 1,
});
