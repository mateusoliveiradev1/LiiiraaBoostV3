import { expect, test } from '@playwright/test';

import { openDesktopTestCase } from './fixtures.ts';

test('@premium-settings start with Windows reports native failure without simulating success', async ({
  page,
}) => {
  await openDesktopTestCase(page, {
    initialPath: '/settings/general',
    operationalState: 'fixture',
    scenarioId: 'S01',
    windowsLocale: 'pt-BR',
  });

  const launchSwitch = page.getByRole('switch', {
    name: 'Ativar Iniciar com o Windows',
  });
  await expect(launchSwitch).toBeEnabled();
  await expect(launchSwitch).not.toBeChecked();
  await expect(page.getByText('Não foi possível verificar. Tente novamente.')).toBeVisible();
  await launchSwitch.click();
  await expect(launchSwitch).not.toBeChecked();
  await expect(page.getByText('Não foi possível verificar. Tente novamente.')).toBeVisible();
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

  const rescanHardware = page.getByRole('button', { name: /Reexaminar hardware/u });
  await expect(rescanHardware).toBeDisabled();
  await expect(
    page.getByText('Indisponível até a conexão do inventário nativo real.'),
  ).toBeVisible();

  await page.getByRole('button', { name: /Rever primeira abertura/u }).click();
  await expect(page.locator('.desktop-app-shell')).toHaveAttribute(
    'data-route-path',
    '/calibration/welcome',
  );
});
