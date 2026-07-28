import { expect, test } from '@playwright/test';

import { desktopRouteTree } from '../../src/routes.tsx';
import { DESKTOP_APP_URL, DESKTOP_SCENARIO_MARKER, openDesktopTestCase } from './fixtures.ts';

const concretePathFor = (pattern: string): string =>
  pattern
    .replace(':gameId', 'vector-strike-arena')
    .replace(':sessionId', 'session-s01')
    .replace(':componentId', 'cpu-power')
    .replace(':operationId', 'balanced-power')
    .replace(':planId', 'plan-s01')
    .replace(':documentId', 'local-overview');

const PT_BR_FORBIDDEN_COPY = Object.freeze([
  'Simulated scenario',
  'No records',
  'Loading',
  'Permission required',
  'Unsupported',
  'Partially complete',
  'Restart pending',
  'Recovery required',
  'Entitlement expired',
  'Evidence is stale',
  'Evidence is contradictory',
  'Current',
  'Stale',
  'Unknown',
  'Approved',
  'Degraded',
  'Not evaluated',
] as const);

test('@route-scenario-smoke renders every typed route through the real browser composition', async ({
  browser,
}) => {
  test.setTimeout(120_000);

  const context = await browser.newContext({
    baseURL: DESKTOP_APP_URL,
    locale: 'pt-BR',
    viewport: { height: 900, width: 1440 },
  });
  const executedRoutes: string[] = [];
  const englishLeaks: string[] = [];

  try {
    for (const definition of desktopRouteTree) {
      const initialPath = concretePathFor(definition.pattern);
      const page = await context.newPage();

      try {
        await openDesktopTestCase(page, {
          initialPath,
          operationalState: 'fixture',
          scenarioId: 'S01',
          windowsLocale: 'pt-BR',
        });

        const shell = page.locator('.desktop-app-shell');
        await expect(shell, definition.pattern).toHaveAttribute('data-route-path', initialPath);
        await expect(shell, definition.pattern).toHaveAttribute(
          'data-route-state',
          definition.state,
        );
        await expect(page.locator('main'), definition.pattern).toHaveCount(1);
        await expect(page.locator('h1'), definition.pattern).toHaveCount(1);
        await expect(page.locator('h1'), definition.pattern).toBeVisible();
        await expect(page.locator('body'), definition.pattern).toContainText(/DEMO.*S01/iu);
        await expect(page.locator('body'), definition.pattern).not.toContainText('undefined');
        const visibleText = await page.locator('body').innerText();
        for (const forbiddenCopy of PT_BR_FORBIDDEN_COPY) {
          if (visibleText.includes(forbiddenCopy)) {
            englishLeaks.push(`${definition.pattern}: ${forbiddenCopy}`);
          }
        }

        executedRoutes.push(definition.pattern);
      } finally {
        await page.close();
      }
    }
  } finally {
    await context.close();
  }

  expect(executedRoutes).toEqual(desktopRouteTree.map(({ pattern }) => pattern));
  expect(new Set(executedRoutes).size).toBe(desktopRouteTree.length);
  expect(englishLeaks).toEqual([]);
  expect(DESKTOP_SCENARIO_MARKER).toBe('SIMULATED SCENARIO');
});

test('@interaction-smoke keeps primary navigation and shell controls observably operable', async ({
  page,
}) => {
  await openDesktopTestCase(page, {
    initialPath: '/calibration/welcome',
    operationalState: 'fixture',
    scenarioId: 'S01',
    windowsLocale: 'pt-BR',
  });

  const shell = page.locator('.desktop-app-shell');
  const destinations = [
    ['Visão geral', '/home'],
    ['Otimização', '/improve'],
    ['Jogos', '/prepare'],
    ['Desempenho', '/measure/overview'],
    ['Recuperação', '/recover/overview'],
    ['Configurações', '/settings/general'],
  ] as const;

  for (const [name, path] of destinations) {
    await page.getByRole('button', { exact: true, name }).click();
    await expect(shell, name).toHaveAttribute('data-route-path', path);
    await expect(page.getByRole('button', { exact: true, name }), name).toHaveAttribute(
      'aria-current',
      'page',
    );
  }

  await page.getByRole('button', { name: 'Abrir central de comandos' }).click();
  const commandDialog = page.getByRole('dialog');
  await expect(commandDialog).toBeVisible();
  await expect(commandDialog.getByRole('searchbox')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(commandDialog).toBeHidden();

  await openDesktopTestCase(page, {
    initialPath: '/calibration/welcome',
    operationalState: 'fixture',
    scenarioId: 'S01',
    windowsLocale: 'pt-BR',
  });

  const calibration = page.locator('[data-calibration-state]');
  await expect(calibration).toHaveAttribute('data-calibration-state', 'new');
  await page.getByRole('button', { name: 'Iniciar calibração' }).click();
  await expect(calibration).not.toHaveAttribute('data-calibration-state', 'new');

  const technicalDetails = page.locator('.lb-calibration-technical');
  await technicalDetails.locator('summary').click();
  await expect(technicalDetails).toHaveAttribute('open', '');

  const visibleControls = page.locator(
    'main button:visible, main [role="switch"]:visible, main summary:visible',
  );
  const controlCount = await visibleControls.count();
  expect(controlCount).toBeGreaterThan(0);
  for (let index = 0; index < controlCount; index += 1) {
    await expect(visibleControls.nth(index)).toHaveAccessibleName(/\S/u);
  }
});
