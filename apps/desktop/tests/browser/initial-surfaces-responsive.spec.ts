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

test('@premium-auth keeps the 150% login below the title bar with internal scrolling', async ({
  page,
}) => {
  await page.setViewportSize({ height: 785, width: 1278 });
  await openDesktopTestCase(page, {
    appScale: 150,
    initialPath: '/login',
    operationalState: 'fixture',
    scenarioId: 'S01',
    windowsLocale: 'pt-BR',
  });

  const shell = page.locator('.desktop-auth-root');
  const title = page.locator('.desktop-title-region');
  const surface = page.locator('.desktop-auth-surface');
  const story = page.locator('.desktop-auth-story');
  const panel = page.locator('.desktop-login-panel');

  await expect(shell).toHaveAttribute('data-app-scale', '150');
  await expect(story).toBeHidden();

  const initialGeometry = await page.evaluate(() => {
    const titleRegion = document.querySelector<HTMLElement>('.desktop-title-region');
    const authSurface = document.querySelector<HTMLElement>('.desktop-auth-surface');
    const loginPanel = document.querySelector<HTMLElement>('.desktop-login-panel');
    if (titleRegion === null || authSurface === null || loginPanel === null) {
      throw new Error('Tela de acesso incompleta');
    }

    const titleRect = titleRegion.getBoundingClientRect();
    const surfaceRect = authSurface.getBoundingClientRect();
    const panelRect = loginPanel.getBoundingClientRect();

    return {
      documentClientHeight: document.documentElement.clientHeight,
      documentClientWidth: document.documentElement.clientWidth,
      documentScrollHeight: document.documentElement.scrollHeight,
      documentScrollWidth: document.documentElement.scrollWidth,
      panelTop: panelRect.top,
      surfaceClientWidth: authSurface.clientWidth,
      surfaceScrollWidth: authSurface.scrollWidth,
      surfaceTop: surfaceRect.top,
      titleBottom: titleRect.bottom,
      titleTop: titleRect.top,
    };
  });

  expect(initialGeometry.documentScrollWidth).toBeLessThanOrEqual(
    initialGeometry.documentClientWidth,
  );
  expect(initialGeometry.documentScrollHeight).toBeLessThanOrEqual(
    initialGeometry.documentClientHeight,
  );
  expect(initialGeometry.surfaceScrollWidth).toBeLessThanOrEqual(
    initialGeometry.surfaceClientWidth,
  );
  expect(initialGeometry.titleTop).toBe(0);
  expect(Math.abs(initialGeometry.surfaceTop - initialGeometry.titleBottom)).toBeLessThanOrEqual(1);
  expect(initialGeometry.panelTop).toBeGreaterThanOrEqual(initialGeometry.surfaceTop);

  await surface.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });

  await expect(title).toBeVisible();
  await expect(panel).toBeVisible();

  const finalGeometry = await page.evaluate(() => {
    const titleRegion = document.querySelector<HTMLElement>('.desktop-title-region');
    const authSurface = document.querySelector<HTMLElement>('.desktop-auth-surface');
    const loginPanel = document.querySelector<HTMLElement>('.desktop-login-panel');
    if (titleRegion === null || authSurface === null || loginPanel === null) {
      throw new Error('Tela de acesso incompleta');
    }

    const titleRect = titleRegion.getBoundingClientRect();
    const panelRect = loginPanel.getBoundingClientRect();

    return {
      panelBottom: panelRect.bottom,
      scrollBottom: authSurface.scrollTop + authSurface.clientHeight,
      scrollHeight: authSurface.scrollHeight,
      titleTop: titleRect.top,
    };
  });

  expect(finalGeometry.titleTop).toBe(0);
  expect(finalGeometry.scrollBottom).toBeCloseTo(finalGeometry.scrollHeight, 0);
  expect(finalGeometry.panelBottom).toBeLessThanOrEqual(page.viewportSize()?.height ?? 785);
});
