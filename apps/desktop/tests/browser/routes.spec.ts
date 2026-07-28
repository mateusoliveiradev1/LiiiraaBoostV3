import { expect, test } from '@playwright/test';

import { desktopRouteTree } from '../../src/routes.tsx';
import {
  DESKTOP_APP_URL,
  DESKTOP_SCENARIO_MARKER,
  openDesktopTestCase,
} from './fixtures.ts';

const concretePathFor = (pattern: string): string =>
  pattern
    .replace(':gameId', 'vector-strike-arena')
    .replace(':sessionId', 'session-s01')
    .replace(':componentId', 'cpu-power')
    .replace(':operationId', 'balanced-power')
    .replace(':planId', 'plan-s01')
    .replace(':documentId', 'local-overview');

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
  expect(DESKTOP_SCENARIO_MARKER).toBe('SIMULATED SCENARIO');
});
