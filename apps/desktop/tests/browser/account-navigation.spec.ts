import { expect, test } from '@playwright/test';

import { openDesktopTestCase } from './fixtures.ts';

test('@premium-navigation profile, plan and optimization details are connected', async ({
  page,
}) => {
  await openDesktopTestCase(page, {
    initialPath: '/home',
    operationalState: 'fixture',
    scenarioId: 'S01',
    windowsLocale: 'pt-BR',
  });

  await expect(page.locator('.desktop-app-shell')).toHaveAttribute('data-route-path', '/home');
  const titleBarBox = await page.locator('.lb-title-bar').boundingBox();
  const accountBox = await page.getByRole('button', { name: 'Abrir perfil e conta' }).boundingBox();
  expect(titleBarBox).not.toBeNull();
  expect(accountBox).not.toBeNull();
  expect((accountBox?.x ?? 0) + (accountBox?.width ?? 0)).toBeGreaterThan(
    (titleBarBox?.x ?? 0) + (titleBarBox?.width ?? 0) * 0.75,
  );

  await page.getByRole('button', { name: 'Abrir perfil e conta' }).click();
  await expect(page.locator('.desktop-app-shell')).toHaveAttribute(
    'data-route-path',
    '/account/overview',
  );
  await expect(page.getByRole('heading', { name: 'Liiiraa Player' })).toBeVisible();

  await page.getByRole('button', { name: 'Plano', exact: true }).click();
  await expect(page.locator('.desktop-app-shell')).toHaveAttribute(
    'data-route-path',
    '/account/subscription',
  );
  await expect(page.getByRole('heading', { name: 'Escolha seu nível de controle' })).toBeVisible();

  await page.getByRole('button', { name: 'Controles rápidos', exact: true }).click();
  await expect(page.locator('.desktop-app-shell')).toHaveAttribute('data-route-path', '/toggles');
  await expect(page.getByRole('heading', { name: 'Controles rápidos' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Modo Jogo do Windows' })).toBeVisible();

  const gameModeRow = page.locator('.premium-operation-row').filter({
    has: page.getByRole('heading', { name: 'Modo Jogo do Windows' }),
  });
  const gameModeSwitch = gameModeRow.getByRole('switch');
  await gameModeSwitch.click();
  await expect(gameModeSwitch).not.toBeChecked();
  await page.getByRole('button', { name: 'Revisar plano' }).click();
  await expect(page.getByRole('dialog', { name: 'Revise antes de continuar' })).toBeVisible();
  await page.getByRole('button', { name: 'Fechar revisão' }).click();

  await page.getByRole('button', { name: 'Configurações', exact: true }).click();
  await page.getByRole('button', { name: 'Aparência', exact: true }).click();
  await expect(page.locator('.desktop-app-shell')).toHaveAttribute(
    'data-route-path',
    '/settings/appearance',
  );
});

test('@premium-navigation security score stays centered and account tabs remain stable', async ({
  page,
}) => {
  await openDesktopTestCase(page, {
    initialPath: '/account/security',
    operationalState: 'fixture',
    scenarioId: 'S01',
    windowsLocale: 'pt-BR',
  });

  await expect(
    page.getByRole('heading', { name: 'Base forte, duas etapas pendentes' }),
  ).toBeVisible();
  const ringBox = await page.locator('.desktop-security-ring').boundingBox();
  const valueBox = await page.locator('.desktop-security-value').boundingBox();
  expect(ringBox).not.toBeNull();
  expect(valueBox).not.toBeNull();
  expect(
    Math.abs(
      (ringBox?.x ?? 0) +
        (ringBox?.width ?? 0) / 2 -
        ((valueBox?.x ?? 0) + (valueBox?.width ?? 0) / 2),
    ),
  ).toBeLessThan(2);
  expect(
    Math.abs(
      (ringBox?.y ?? 0) +
        (ringBox?.height ?? 0) / 2 -
        ((valueBox?.y ?? 0) + (valueBox?.height ?? 0) / 2),
    ),
  ).toBeLessThan(2);

  await page.getByRole('button', { name: 'Perfil', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Liiiraa Player' })).toBeVisible();
  await page
    .locator('.desktop-account-tabs')
    .getByRole('button', { name: 'Segurança', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Base forte, duas etapas pendentes' }),
  ).toBeVisible();
});
