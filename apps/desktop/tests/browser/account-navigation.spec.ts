import { expect, test } from '@playwright/test';

import { openDesktopTestCase } from './fixtures.ts';

test('@premium-navigation login, profile, plan and optimization details are connected', async ({
  page,
}) => {
  await openDesktopTestCase(page, {
    initialPath: '/login',
    operationalState: 'fixture',
    scenarioId: 'S01',
    windowsLocale: 'pt-BR',
  });

  await expect(page.getByRole('heading', { name: 'Seu PC, otimizado com provas.' })).toBeVisible();
  await page.getByRole('button', { name: 'Explorar modo demonstração' }).click();
  await expect(page.locator('.desktop-app-shell')).toHaveAttribute('data-route-path', '/home');

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

  await page.getByRole('button', { name: 'Otimização', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir', exact: true }).first().click();
  await expect(page.locator('.desktop-app-shell')).toHaveAttribute(
    'data-route-path',
    '/components/windows',
  );
  await expect(page.getByRole('heading', { name: 'Windows' })).toBeVisible();

  await page.getByRole('button', { name: 'Configurações', exact: true }).click();
  await page.getByRole('button', { name: 'Aparência', exact: true }).click();
  await expect(page.locator('.desktop-app-shell')).toHaveAttribute(
    'data-route-path',
    '/settings/appearance',
  );
});
