import { expect, test } from '@playwright/test';

import storyManifestJson from '../../../../tooling/desktop-evidence/story-manifest.json' with { type: 'json' };
import { DESKTOP_APP_URL, openDesktopTestCase, type DesktopTestComposition } from './fixtures.ts';

interface VisualAxis {
  readonly appScale: 100 | 125 | 150;
  readonly catalogLocale?: 'pseudo';
  readonly forcedColors: 'active' | 'none';
  readonly id: string;
  readonly locale: string;
  readonly reducedMotion: 'no-preference' | 'reduce';
  readonly scenarioId: string;
  readonly viewport: Readonly<{ height: number; width: number }>;
}

interface StoryManifest {
  readonly axes: Readonly<{
    forcedColors: readonly string[];
    locales: readonly string[];
    motion: readonly string[];
    scales: readonly number[];
    viewports: readonly Readonly<{ height: number; width: number }>[];
  }>;
}

const manifest = storyManifestJson as unknown as StoryManifest;
const visualAxes: readonly VisualAxis[] = Object.freeze([
  {
    appScale: 100,
    forcedColors: 'none',
    id: '1440x900-pt-BR-scale-100-responsive-normal',
    locale: 'pt-BR',
    reducedMotion: 'no-preference',
    scenarioId: 'S01',
    viewport: { height: 900, width: 1440 },
  },
  {
    appScale: 125,
    forcedColors: 'none',
    id: '1280x800-en-scale-125-reduced-normal',
    locale: 'en-US',
    reducedMotion: 'reduce',
    scenarioId: 'S24',
    viewport: { height: 800, width: 1280 },
  },
  {
    appScale: 100,
    catalogLocale: 'pseudo',
    forcedColors: 'none',
    id: '960x700-pseudo-scale-100-responsive-normal',
    locale: 'en-XA',
    reducedMotion: 'no-preference',
    scenarioId: 'S01',
    viewport: { height: 700, width: 960 },
  },
  {
    appScale: 150,
    forcedColors: 'none',
    id: '760x600-pt-BR-scale-150-responsive-normal',
    locale: 'pt-BR',
    reducedMotion: 'no-preference',
    scenarioId: 'S23',
    viewport: { height: 600, width: 760 },
  },
  {
    appScale: 150,
    forcedColors: 'active',
    id: '760x600-en-scale-150-reduced-forced',
    locale: 'en-US',
    reducedMotion: 'reduce',
    scenarioId: 'S24',
    viewport: { height: 600, width: 760 },
  },
]);

test('@a11y-visual-smoke locks every visual axis value to deterministic browser cases', () => {
  expect(
    new Set(
      visualAxes.map(({ viewport }) => `${String(viewport.width)}x${String(viewport.height)}`),
    ),
  ).toEqual(
    new Set(
      manifest.axes.viewports.map(({ width, height }) => `${String(width)}x${String(height)}`),
    ),
  );
  expect(new Set(visualAxes.map(({ locale, catalogLocale }) => catalogLocale ?? locale))).toEqual(
    new Set(['pt-BR', 'en-US', 'pseudo']),
  );
  expect(new Set(visualAxes.map(({ appScale }) => appScale))).toEqual(
    new Set(manifest.axes.scales),
  );
  expect(
    new Set(
      visualAxes.map(({ reducedMotion }) =>
        reducedMotion === 'reduce' ? 'reduced' : 'responsive',
      ),
    ),
  ).toEqual(new Set(manifest.axes.motion));
  expect(
    new Set(
      visualAxes.map(({ forcedColors }) => (forcedColors === 'active' ? 'forced' : 'normal')),
    ),
  ).toEqual(new Set(manifest.axes.forcedColors));
});

for (const axis of visualAxes) {
  test(`@a11y-visual-smoke ${axis.id} has no clipping, color-only status, or pixel drift`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      baseURL: DESKTOP_APP_URL,
      deviceScaleFactor: axis.appScale / 100,
      forcedColors: axis.forcedColors,
      locale: axis.locale,
      reducedMotion: axis.reducedMotion,
      viewport: axis.viewport,
    });
    const page = await context.newPage();

    try {
      const composition = {
        appScale: axis.appScale,
        ...(axis.catalogLocale === undefined ? {} : { catalogLocale: axis.catalogLocale }),
        forcedColors: axis.forcedColors === 'active',
        initialPath: '/home',
        operationalState: 'fixture',
        reducedMotion: axis.reducedMotion === 'reduce',
        scenarioId: axis.scenarioId,
        textScale: axis.appScale === 150 ? 200 : 100,
        viewportWidth: axis.viewport.width,
        windowsLocale: axis.locale,
      } satisfies DesktopTestComposition;
      await openDesktopTestCase(page, composition);

      const shell = page.locator('.desktop-app-shell');
      await expect(shell).toHaveAttribute('data-app-scale', String(axis.appScale));
      await expect(shell).toHaveAttribute(
        'data-motion',
        axis.reducedMotion === 'reduce' ? 'reduced' : 'responsive',
      );
      await expect(shell).toHaveAttribute(
        'data-forced-colors',
        axis.forcedColors === 'active' ? 'active' : 'system',
      );
      await expect(shell).toHaveAttribute('data-page-horizontal-scroll', 'forbidden');
      await expect(page.locator('body')).toContainText(
        new RegExp(`DEMO.*${axis.scenarioId}`, 'iu'),
      );

      const layout = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
      const clippedControls = await page
        .locator('a, button, input, select, textarea, [role="button"]')
        .evaluateAll((controls) =>
          controls
            .filter((control) => {
              const element = control as HTMLElement;
              const style = globalThis.getComputedStyle(element);
              return (
                style.display !== 'none' &&
                style.visibility !== 'hidden' &&
                element.clientWidth > 1 &&
                element.scrollWidth > element.clientWidth + 1
              );
            })
            .map((control) => {
              const element = control as HTMLElement;
              return element.getAttribute('aria-label') ?? element.textContent.trim();
            }),
        );
      expect(clippedControls).toEqual([]);

      const currentStatus = page.getByRole('region', {
        name: /Current operational state|Estado operacional atual/iu,
      });
      await expect(currentStatus).toContainText(/\S{8,}/u);
      await expect(currentStatus.locator('[data-state]')).toHaveCount(1);

      if (axis.catalogLocale === 'pseudo') {
        await expect(page.locator('html')).toHaveAttribute('lang', 'x-pseudo');
        await expect(page.locator('body')).toContainText('⟦');
      }

      await expect(shell).toHaveScreenshot(`${axis.scenarioId}-${axis.id}.png`, {
        animations: 'disabled',
      });
    } finally {
      await context.close();
    }
  });
}
