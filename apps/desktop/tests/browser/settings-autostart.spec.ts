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
