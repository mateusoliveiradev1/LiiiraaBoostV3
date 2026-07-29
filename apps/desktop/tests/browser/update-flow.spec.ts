import { expect, test } from '@playwright/test';

import { openDesktopTestCase } from './fixtures.ts';

test('@premium-updater completes the honest simulated update flow', async ({ page }) => {
  await openDesktopTestCase(page, {
    initialPath: '/about',
    operationalState: 'fixture',
    scenarioId: 'S01',
    windowsLocale: 'pt-BR',
  });

  const updater = page.getByTestId('premium-updater');
  await expect(updater).toContainText('SIMULAÇÃO SEGURA');
  await expect(updater).toContainText('nenhum servidor, arquivo ou instalador real');
  await expect(updater).toContainText('Versão instalada');
  await expect(updater).toContainText('0.0.0');

  await page.getByRole('button', { name: 'Verificar atualizações' }).click();
  await expect(page.getByRole('button', { name: 'Verificando…' })).toBeDisabled();
  await expect(updater).toHaveAttribute('data-phase', 'available', { timeout: 5_000 });
  await expect(updater).toContainText('Nova versão disponível');
  await expect(updater).toContainText('v0.1.0');
  await expect(updater).toContainText('18,6 MB');

  await page.getByRole('button', { name: 'Baixar atualização' }).click();
  await expect(updater).toHaveAttribute('data-phase', 'downloading');
  await expect(page.getByRole('progressbar', { name: 'Progresso da atualização' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar download' }).click();
  await expect(updater).toHaveAttribute('data-phase', 'available');

  await page.getByRole('button', { name: 'Baixar atualização' }).click();
  await expect(updater).toHaveAttribute('data-phase', 'ready', { timeout: 5_000 });
  await expect(updater).toContainText('Pronto para instalar');

  await page.getByRole('button', { name: 'Instalar ao fechar' }).click();
  await expect(updater).toHaveAttribute('data-phase', 'scheduled');
  await expect(updater).toContainText('Nenhuma reinicialização agora');
  await expect(page.getByRole('status')).toContainText('Instalação demonstrativa preparada');

  for (const viewport of [
    { height: 800, width: 1280 },
    { height: 700, width: 960 },
    { height: 600, width: 760 },
  ]) {
    await page.setViewportSize(viewport);
    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalOverflow, `${String(viewport.width)}px viewport`).toBe(false);
  }
});
