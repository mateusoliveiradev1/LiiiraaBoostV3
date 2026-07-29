import { expect, test } from '@playwright/test';

import { openDesktopTestCase } from './fixtures.js';

test('@premium-auth resizes without horizontal scrolling', async ({ page }) => {
  for (const viewport of [
    { height: 800, width: 1280 },
    { height: 700, width: 960 },
    { height: 600, width: 760 },
  ]) {
    await page.setViewportSize(viewport);
    await openDesktopTestCase(page, {
      initialPath: '/login',
      operationalState: 'fixture',
      scenarioId: 'S01',
      windowsLocale: 'pt-BR',
    });

    const geometry = await page.evaluate(() => {
      const surface = document.querySelector<HTMLElement>('.desktop-auth-surface');
      const panel = document.querySelector<HTMLElement>('.desktop-login-panel');
      if (surface === null || panel === null) throw new Error('Tela de acesso incompleta');

      const viewportRight = document.documentElement.getBoundingClientRect().right;
      return {
        documentClientWidth: document.documentElement.clientWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        panelRight: panel.getBoundingClientRect().right,
        surfaceClientWidth: surface.clientWidth,
        surfaceScrollWidth: surface.scrollWidth,
        viewportRight,
      };
    });

    expect(geometry.documentScrollWidth).toBeLessThanOrEqual(geometry.documentClientWidth);
    expect(geometry.surfaceScrollWidth).toBeLessThanOrEqual(geometry.surfaceClientWidth);
    expect(geometry.panelRight).toBeLessThanOrEqual(geometry.viewportRight);
  }
});
