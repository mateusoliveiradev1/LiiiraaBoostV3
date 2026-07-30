import { expect, test } from '@playwright/test';

import { openDesktopTestCase } from './fixtures.ts';

test('@premium-settings start with Windows reflects confirmed state changes', async ({ page }) => {
  await openDesktopTestCase(page, {
    initialPath: '/settings/general',
    operationalState: 'fixture',
    scenarioId: 'S01',
    windowsLocale: 'pt-BR',
  });

  await expect(
    page.getByText('Abre o Liiiraa Boost ao entrar na sua conta do Windows.'),
  ).toBeVisible();

  const enableSwitch = page.getByRole('switch', {
    name: 'Ativar Iniciar com o Windows',
  });
  await expect(enableSwitch).not.toBeChecked();
  await enableSwitch.click();

  const disableSwitch = page.getByRole('switch', {
    name: 'Desativar Iniciar com o Windows',
  });
  await expect(disableSwitch).toBeChecked();
  await expect(page.getByRole('status')).toContainText('Liiiraa Boost iniciará com o Windows.');

  await disableSwitch.click();
  await expect(enableSwitch).not.toBeChecked();
  await expect(page.getByRole('status')).toContainText('Inicialização com o Windows desativada.');
});

test('@premium-settings system theme follows live Windows color scheme changes', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await openDesktopTestCase(page, {
    initialPath: '/settings/appearance',
    operationalState: 'fixture',
    scenarioId: 'S01',
    windowsLocale: 'pt-BR',
  });

  await page.getByRole('radio', { name: 'Sistema' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme-preference', 'system');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.getByText('Seguindo o Windows: claro.')).toBeVisible();

  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByText('Seguindo o Windows: escuro.')).toBeVisible();

  await page.getByRole('radio', { name: 'Claro' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme-preference', 'light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('@premium-settings data actions execute and update their visible state', async ({ page }) => {
  await openDesktopTestCase(page, {
    initialPath: '/settings/advanced',
    operationalState: 'fixture',
    scenarioId: 'S01',
    windowsLocale: 'pt-BR',
  });

  const profileDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: /Exportar perfil/u }).click();
  const downloadedProfile = await profileDownload;
  expect(downloadedProfile.suggestedFilename()).toMatch(
    /^liiiraa-boost-perfil-\d{4}-\d{2}-\d{2}\.json$/u,
  );

  await page.getByRole('button', { name: /Reexaminar hardware/u }).click();
  await expect(page.getByText(/Inventário demonstrativo atualizado às/u)).toBeVisible();

  await page.getByRole('button', { name: /Rever primeira abertura/u }).click();
  await expect(page.locator('.desktop-app-shell')).toHaveAttribute(
    'data-route-path',
    '/calibration/welcome',
  );
});
