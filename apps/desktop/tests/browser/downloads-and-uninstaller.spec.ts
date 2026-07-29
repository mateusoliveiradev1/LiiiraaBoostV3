import { expect, test } from '@playwright/test';

import { openDesktopTestCase } from './fixtures.ts';

test('@premium-download completed preparation advances to installation', async ({ page }) => {
  await openDesktopTestCase(page, {
    initialPath: '/downloads',
    operationalState: 'fixture',
    scenarioId: 'S01',
    windowsLocale: 'pt-BR',
  });

  const braveCard = page.locator('.premium-download-grid article').filter({ hasText: 'Brave' });
  await braveCard.getByRole('button', { name: 'Preparar download' }).click();

  await expect(braveCard.getByText('Pronto para instalar')).toBeVisible();
  await expect(braveCard.getByText('100%')).toBeVisible();
  await expect(braveCard.getByRole('button', { name: 'Preparar novamente' })).toHaveCount(0);

  await braveCard.getByRole('button', { name: 'Instalar' }).click();
  await expect(
    braveCard.getByRole('progressbar').getByText('Instalado', { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByRole('status')).toContainText(
    'Brave foi instalado no cenário demonstrativo.',
  );
});

test('@premium-uninstaller reviews and confirms selected applications', async ({ page }) => {
  await openDesktopTestCase(page, {
    initialPath: '/uninstaller',
    operationalState: 'fixture',
    scenarioId: 'S01',
    windowsLocale: 'pt-BR',
  });

  await page.getByRole('checkbox', { name: /Docker Desktop/ }).check();
  const uninstallButton = page.getByRole('button', { name: 'Desinstalar selecionado' });
  await expect(uninstallButton).toBeEnabled();
  await uninstallButton.click();

  const dialog = page.getByRole('dialog', { name: 'Confirmar desinstalação' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Docker Desktop');
  await expect(dialog).toContainText('2,7 GB');
  await expect(dialog).toContainText('Nenhuma alteração real será feita nesta fase');

  await page.locator('.premium-dialog-backdrop').click({ position: { x: 8, y: 8 } });
  await expect(dialog).toBeHidden();

  await uninstallButton.click();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  await uninstallButton.click();
  await dialog.getByRole('button', { name: 'Confirmar desinstalação' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('.premium-app-list')).not.toContainText('Docker Desktop');
  await expect(page.getByText('0 selecionados')).toBeVisible();
  await expect(page.getByRole('status')).toContainText(
    'Docker Desktop foi removido no cenário demonstrativo.',
  );

  await expect(page.getByRole('checkbox', { name: /AMD Chipset Software/ })).toBeDisabled();
});

test('@premium-uninstaller selects every removable app at once', async ({ page }) => {
  await openDesktopTestCase(page, {
    initialPath: '/uninstaller',
    operationalState: 'fixture',
    scenarioId: 'S01',
    windowsLocale: 'pt-BR',
  });

  const selectAll = page.getByRole('checkbox', {
    name: 'Selecionar todos os aplicativos removíveis',
  });
  await selectAll.check();
  await expect(selectAll).toBeChecked();
  await expect(page.getByText('6 selecionados')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /AMD Chipset Software/ })).toBeDisabled();
  await expect(page.getByRole('checkbox', { name: /WebView2 Runtime/ })).toBeDisabled();

  await page.getByRole('button', { name: 'Desinstalar selecionado' }).click();
  const dialog = page.getByRole('dialog', { name: 'Confirmar desinstalação' });
  await expect(dialog.locator('.premium-uninstall-selection li')).toHaveCount(6);
  await expect(dialog).toContainText('Counter-Strike 2');
  await dialog.getByRole('button', { name: 'Confirmar desinstalação' }).click();

  await expect(dialog).toBeHidden();
  await expect(page.locator('.premium-app-list label')).toHaveCount(2);
  await expect(page.getByRole('status')).toContainText(
    '6 aplicativos foram removidos no cenário demonstrativo.',
  );
});

test('@premium-operations keeps download and uninstall actions localized in English', async ({
  page,
}) => {
  await openDesktopTestCase(page, {
    initialPath: '/uninstaller',
    operationalState: 'fixture',
    scenarioId: 'S01',
    windowsLocale: 'en-US',
  });

  await page.getByRole('checkbox', { name: /Docker Desktop/ }).check();
  await page.getByRole('button', { name: 'Uninstall selected' }).click();
  const dialog = page.getByRole('dialog', { name: 'Confirm uninstall' });
  await expect(dialog).toContainText('No real changes will be made in this phase');
  await dialog.getByRole('button', { name: 'Cancel' }).click();

  await page.getByRole('button', { name: 'Downloads', exact: true }).click();
  const braveCard = page.locator('.premium-download-grid article').filter({ hasText: 'Brave' });
  await braveCard.getByRole('button', { name: 'Prepare download' }).click();
  await expect(braveCard.getByText('Ready to install')).toBeVisible();
  await expect(braveCard.getByRole('button', { name: 'Install' })).toBeVisible();
});
