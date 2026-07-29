import { expect, test } from '@playwright/test';

import { openDesktopTestCase } from './fixtures.ts';

test('@premium-notifications drawer is dismissible and never changes shell geometry', async ({
  page,
}) => {
  await openDesktopTestCase(page, {
    initialPath: '/home',
    operationalState: 'fixture',
    scenarioId: 'S01',
    windowsLocale: 'pt-BR',
  });

  const shell = page.locator('.desktop-app-shell');
  const rail = page.locator('.desktop-goal-region');
  const workCanvas = page.locator('.desktop-work-canvas');
  const activityButton = page.getByRole('button', { name: 'Abrir atividade' });
  const geometryBefore = {
    rail: await rail.boundingBox(),
    shell: await shell.boundingBox(),
    workCanvas: await workCanvas.boundingBox(),
  };

  await activityButton.click();
  const drawer = page.getByRole('dialog', { name: 'Notificações' });
  await expect(drawer).toBeVisible();
  await expect(drawer).toContainText('Recuperação pronta para revisão');
  await expect(drawer).not.toContainText('Activity');
  await expect(drawer).not.toContainText('Recovery required');
  await expect(drawer).not.toContainText('Close');
  await expect(drawer).toHaveScreenshot('notification-drawer-pt-br.png');

  expect(await shell.boundingBox()).toEqual(geometryBefore.shell);
  expect(await rail.boundingBox()).toEqual(geometryBefore.rail);
  expect(await workCanvas.boundingBox()).toEqual(geometryBefore.workCanvas);

  await drawer.getByRole('heading', { name: 'Notificações' }).click();
  await expect(drawer).toBeVisible();

  await page.locator('[data-notification-layer]').click({ position: { x: 12, y: 12 } });
  await expect(drawer).toBeHidden();
  await expect(activityButton).toBeFocused();

  await activityButton.click();
  await expect(drawer).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await expect(activityButton).toBeFocused();

  await activityButton.click();
  await drawer.getByRole('button', { name: 'Fechar notificações' }).click();
  await expect(drawer).toBeHidden();
  await expect(activityButton).toBeFocused();
});

test('@premium-optimization adjustments use scalable switches and keep detail navigation', async ({
  page,
}) => {
  await openDesktopTestCase(page, {
    initialPath: '/components/windows',
    operationalState: 'fixture',
    scenarioId: 'S01',
    windowsLocale: 'pt-BR',
  });

  const switches = page.getByRole('switch');
  await expect(switches).toHaveCount(3);
  await expect(switches.first()).toBeChecked();
  await expect(page.getByText('2 ajustes selecionados')).toBeVisible();
  await expect(page.locator('.lb-component-workspace')).toHaveScreenshot(
    'optimization-switches-windows-pt-br.png',
  );

  const firstInfoButton = page
    .locator('.lb-component-operation')
    .first()
    .getByRole('button', { name: /^O que .+ faz$/u });
  await firstInfoButton.hover();
  await page.waitForTimeout(600);
  await expect(page.getByRole('tooltip')).toBeVisible();
  await expect(page.getByRole('tooltip')).toContainText('O que faz');

  await page.locator('.lb-switch').first().click();
  await expect(switches.first()).not.toBeChecked();
  await expect(page.getByText('1 ajuste selecionado')).toBeVisible();

  await page
    .locator('.lb-component-operation')
    .first()
    .getByRole('button', { name: 'Detalhes' })
    .click();
  await expect(page.locator('.desktop-app-shell')).toHaveAttribute(
    'data-route-path',
    '/operations/windows-game-mode-review',
  );

  await page.getByRole('button', { name: 'Otimização', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir', exact: true }).first().click();
  await expect(page.locator('.desktop-app-shell')).toHaveAttribute(
    'data-route-path',
    '/components/windows',
  );
  await expect(page.getByRole('button', { name: 'Revisar plano selecionado' })).toBeVisible();
});

test('@premium-optimization excludes unsafe adjustments from selection', async ({ page }) => {
  await openDesktopTestCase(page, {
    initialPath: '/components/gpu',
    operationalState: 'fixture',
    scenarioId: 'S06',
    windowsLocale: 'pt-BR',
  });

  const excludedAdjustment = page.locator('.lb-component-operation[data-eligibility="excluded"]');
  await expect(excludedAdjustment).toBeVisible();
  await expect(excludedAdjustment.getByRole('switch')).toBeDisabled();
  await expect(excludedAdjustment).toContainText('Indisponível');
});
