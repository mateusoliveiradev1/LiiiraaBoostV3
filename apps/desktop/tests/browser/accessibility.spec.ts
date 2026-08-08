import { expect, test } from '@playwright/test';

import scenarioCatalogJson from '../../../../contracts/scenarios/desktop-scenarios.json' with { type: 'json' };
import type { ShellOperationalState } from '../../src/app.tsx';
import { expectNoAxeViolations } from './axe.ts';
import { DESKTOP_APP_URL, DESKTOP_SCENARIO_MARKER, openDesktopTestCase } from './fixtures.ts';
import { expectKeyboardFocus, runKeyboardJourney } from './keyboard.ts';

interface AccessibilityScenario {
  readonly clock: string;
  readonly id: string;
  readonly latencyMs: number;
  readonly locale: string;
  readonly requiredStates: readonly Readonly<{
    route: string;
    state: string;
  }>[];
  readonly seed: number;
}

interface AccessibilityCatalog {
  readonly scenarios: readonly AccessibilityScenario[];
}

const catalog = scenarioCatalogJson as unknown as AccessibilityCatalog;
const browserRoutes: Readonly<Partial<Record<string, string>>> = Object.freeze({
  '/activity': '/activity',
  '/ai': '/assistant',
  '/calibration': '/calibration/welcome',
  '/games': '/games',
  '/games/detail': '/games/vector-strike-arena/overview',
  '/home': '/home',
  '/improve/component': '/components/cpu-power',
  '/measure': '/measure/overview',
  '/measure/comparison': '/measure/compare',
  '/plans/review': '/plans/scenario-plan/review',
  '/recover': '/recover/overview',
  '/restart': '/plans/scenario-plan/restart',
  '/session/active': '/session/scenario-session/active',
  '/settings/appearance': '/settings/appearance',
  '/startup': '/documentation/local-startup',
  '/support': '/documentation/support-boundary',
  '/updates': '/settings/updates',
});
const operationalStates = new Set<ShellOperationalState>([
  'loading',
  'empty',
  'offline',
  'permission',
  'unsupported',
  'partial-failure',
  'restart-pending',
  'recovery',
  'expired-entitlement',
  'stale-evidence',
  'contradictory-evidence',
  'fixture',
]);

test('@a11y-visual-smoke rejects serious and critical axe findings on all 59 canonical pairs', async ({
  browser,
}) => {
  test.setTimeout(240_000);

  const context = await browser.newContext({
    baseURL: DESKTOP_APP_URL,
    locale: 'en-US',
    reducedMotion: 'reduce',
    viewport: { height: 900, width: 1440 },
  });
  let auditedPairCount = 0;

  try {
    for (const scenario of catalog.scenarios) {
      for (const requirement of scenario.requiredStates) {
        const initialPath = browserRoutes[requirement.route];
        if (
          initialPath === undefined ||
          !operationalStates.has(requirement.state as ShellOperationalState)
        ) {
          throw new Error(
            `Unmapped accessibility case ${scenario.id}::${requirement.route}::${requirement.state}`,
          );
        }

        const page = await context.newPage();
        try {
          await openDesktopTestCase(
            page,
            {
              initialPath,
              operationalState: requirement.state as ShellOperationalState,
              reducedMotion: true,
              scenarioId: scenario.id,
              windowsLocale: scenario.locale,
            },
            {
              clock: scenario.clock,
              id: scenario.id,
              latencyMs: scenario.latencyMs,
              marker: DESKTOP_SCENARIO_MARKER,
              seed: scenario.seed,
            },
          );

          await expectNoAxeViolations(page, ['.desktop-app-shell']);
          await expect(
            page.locator('[tabindex]:not([tabindex="0"]):not([tabindex="-1"])'),
          ).toHaveCount(0);
          await expect(page.locator('main')).toHaveCount(1);
          await expect(page.locator('h1')).toHaveCount(1);
          auditedPairCount += 1;
        } finally {
          await page.close();
        }
      }
    }
  } finally {
    await context.close();
  }

  expect(auditedPairCount).toBe(59);
});

test('@a11y-visual-smoke completes command, F6, route, locale, and settings journeys by keyboard', async ({
  page,
}) => {
  test.setTimeout(60_000);

  await openDesktopTestCase(page, {
    appScale: 150,
    initialPath: '/calibration/welcome',
    operationalState: 'fixture',
    scenarioId: 'S23',
    viewportWidth: 760,
    windowsLocale: 'en-US',
  });

  await runKeyboardJourney(page, [
    { key: 'F6', kind: 'press' },
    { kind: 'focus', selector: '[data-focus-region="title-bar"]' },
  ]);
  await expectKeyboardFocus(page, '[data-focus-region="title-bar"]');
  await page.keyboard.press('F6');
  await expectKeyboardFocus(page, '[data-focus-region="goal-rail"]');
  await page.keyboard.press('F6');
  await expectKeyboardFocus(page, '[data-focus-region="main"]');
  await page.keyboard.press('F6');
  await expectKeyboardFocus(page, '[data-focus-region="inspector"]');

  await page.keyboard.press('Control+K');
  await expect(page.getByRole('dialog', { name: /Command center/iu })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: /Command center/iu })).toBeHidden();

  await page.keyboard.press('Control+1');
  await expect(page.locator('.desktop-app-shell')).toHaveAttribute('data-route-path', '/home');
  await expect(page.locator('h1')).toBeFocused();
  await page.keyboard.press('Control+Shift+A');
  await expect(page.locator('.desktop-app-shell')).toHaveAttribute('data-route-path', '/activity');
  await page.keyboard.press('Control+,');
  await expect(page.locator('.desktop-app-shell')).toHaveAttribute(
    'data-route-path',
    '/settings/general',
  );

  await expect(page.getByLabel('Language')).toBeVisible();
  const locale = page.locator('#desktop-locale');
  await locale.focus();
  await page.keyboard.press('Home');
  await expect(locale).toHaveValue('pt-BR');
  await expect(page.getByLabel('Idioma')).toBeVisible();

  const appearanceSection = page.getByRole('button', {
    exact: true,
    name: 'Aparência',
  });
  await appearanceSection.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.desktop-app-shell')).toHaveAttribute(
    'data-route-path',
    '/settings/appearance',
  );
  await expect(page.getByLabel('Tema do aplicativo')).toBeVisible();

  const reduceMotion = page.getByRole('switch', {
    name: 'Ativar Reduzir movimento',
  });
  await reduceMotion.focus();
  await page.keyboard.press('Space');
  await expect(reduceMotion).toBeChecked();
});

test('@a11y-visual-smoke keeps preview, restart, recovery, and expired access keyboard reachable', async ({
  browser,
}) => {
  const cases = [
    { initialPath: '/plans/scenario-plan/review', scenarioId: 'S15', state: 'partial-failure' },
    { initialPath: '/plans/scenario-plan/restart', scenarioId: 'S16', state: 'restart-pending' },
    { initialPath: '/recover/emergency', scenarioId: 'S17', state: 'recovery' },
    { initialPath: '/account/security', scenarioId: 'S13', state: 'expired-entitlement' },
  ] as const satisfies readonly Readonly<{
    initialPath: string;
    scenarioId: string;
    state: ShellOperationalState;
  }>[];

  for (const journey of cases) {
    const context = await browser.newContext({
      baseURL: DESKTOP_APP_URL,
      locale: 'en-US',
      viewport: { height: 700, width: 960 },
    });
    const page = await context.newPage();
    try {
      await openDesktopTestCase(page, {
        initialPath: journey.initialPath,
        operationalState: journey.state,
        scenarioId: journey.scenarioId,
        windowsLocale: 'en-US',
      });
      await page.locator('h1').focus();
      await page.keyboard.press('Tab');
      await expect(page.locator(':focus')).toBeVisible();
      await expect(page.locator('.desktop-app-shell')).toHaveAttribute(
        'data-operational-state',
        journey.state,
      );
    } finally {
      await context.close();
    }
  }
});
