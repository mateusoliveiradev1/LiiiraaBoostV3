import { expect, test } from '@playwright/test';

import { openDesktopTestCase } from './fixtures.ts';

const readShellGeometry = async (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const boxFor = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (element === null) {
        throw new Error(`Missing geometry target: ${selector}`);
      }
      const box = element.getBoundingClientRect();
      return {
        height: Math.round(box.height),
        width: Math.round(box.width),
        x: Math.round(box.x),
        y: Math.round(box.y),
      };
    };

    const main = boxFor('.desktop-work-canvas > main');
    return {
      body: boxFor('.desktop-shell-body'),
      canvas: boxFor('.desktop-work-canvas'),
      main: { width: main.width, x: main.x },
      rail: boxFor('.desktop-goal-region'),
      shell: boxFor('.desktop-app-shell'),
      title: boxFor('.desktop-title-region'),
    };
  });

test('@premium-navigation every sidebar route preserves the same shell geometry', async ({
  page,
}) => {
  await openDesktopTestCase(page, {
    initialPath: '/home',
    operationalState: 'fixture',
    scenarioId: 'S01',
    windowsLocale: 'pt-BR',
  });

  const routes = [
    { label: 'Modo Competitivo', path: '/competitive' },
    { label: 'Controles rápidos', path: '/toggles' },
    { label: 'Atalhos', path: '/shortcuts' },
    { label: 'Planos de energia', path: '/power' },
    { label: 'Rede', path: '/network' },
    { label: 'Tweaks', path: '/tweaks' },
    { label: 'Segurança', path: '/security' },
    { label: 'Serviços', path: '/services' },
    { label: 'Restauração', path: '/restoration' },
    { label: 'Desinstalador', path: '/uninstaller' },
    { label: 'Downloads', path: '/downloads' },
    { label: 'Configurações', path: '/settings/general' },
    { label: 'Sobre', path: '/about' },
    { label: 'Visão geral', path: '/home' },
  ] as const;

  for (const width of [1440, 1280, 1024]) {
    await page.setViewportSize({ height: 800, width });
    await page.getByRole('button', { name: 'Visão geral', exact: true }).click();
    const geometry = await readShellGeometry(page);

    for (const route of routes) {
      await page.getByRole('button', { name: route.label, exact: true }).click();
      await expect(page.locator('.desktop-app-shell')).toHaveAttribute(
        'data-route-path',
        route.path,
      );
      expect(await readShellGeometry(page)).toEqual(geometry);
    }
  }
});

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

test('@premium-optimization catalog search, switches, and review are connected', async ({
  page,
}) => {
  await openDesktopTestCase(page, {
    initialPath: '/toggles',
    operationalState: 'fixture',
    scenarioId: 'S01',
    windowsLocale: 'pt-BR',
  });

  const switches = page.getByRole('switch');
  await expect(switches).toHaveCount(8);
  await expect(switches.first()).toBeChecked();

  const search = page.getByRole('searchbox', { name: 'Pesquisar nesta rota' });
  await search.fill('Bluetooth');
  await expect(page.locator('.premium-operation-row')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Bluetooth' })).toBeVisible();
  await search.clear();
  await expect(page.locator('.premium-operation-row')).toHaveCount(8);

  await switches.first().click();
  await expect(switches.first()).not.toBeChecked();
  await expect(page.getByText('1 alteração preparada')).toBeVisible();

  await page.getByRole('button', { name: 'Revisar plano' }).click();
  const review = page.getByRole('dialog', { name: 'Revise antes de continuar' });
  await expect(review).toBeVisible();
  await expect(review).toContainText('O motor real ainda não está conectado');
  await page.keyboard.press('Escape');
  await expect(review).toBeHidden();

  await page.getByRole('button', { name: 'Rede', exact: true }).click();
  await expect(page.locator('.desktop-app-shell')).toHaveAttribute('data-route-path', '/network');
  await expect(page.getByRole('heading', { name: 'Rede' })).toBeVisible();
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

test('@premium-game-profile selection updates Home and survives reload', async ({ page }) => {
  await openDesktopTestCase(page, {
    initialPath: '/competitive',
    operationalState: 'fixture',
    scenarioId: 'S01',
    windowsLocale: 'pt-BR',
  });

  const gameSelector = page.getByRole('combobox', { name: 'Jogo' });
  await gameSelector.selectOption('pubg');
  await expect(gameSelector).toHaveValue('pubg');
  await expect(page.locator('.premium-session-status')).toContainText('PUBG: BATTLEGROUNDS');

  await page.getByRole('button', { name: 'Visão geral', exact: true }).click();
  const gameCard = page.locator('.premium-game-card');
  await expect(gameCard.getByRole('heading', { name: 'PUBG: BATTLEGROUNDS' })).toBeVisible();
  await expect(gameCard.locator('img')).toHaveAttribute('src', '/games/pubg.jpg');

  await page.reload();
  await expect(page.locator('.desktop-app-shell')).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Jogo' })).toHaveValue('pubg');
  await page.getByRole('button', { name: 'Visão geral', exact: true }).click();
  await expect(page.locator('.premium-game-card')).toContainText('PUBG: BATTLEGROUNDS');
});

test('@premium-titlebar exposes branded native window controls', async ({ page }) => {
  await openDesktopTestCase(page, {
    initialPath: '/home',
    operationalState: 'fixture',
    scenarioId: 'S01',
    windowsLocale: 'pt-BR',
  });

  await expect(page.locator('.lb-title-bar')).toHaveAttribute('data-tauri-drag-region', 'true');
  await expect(page.getByRole('button', { name: 'Minimizar janela' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Maximizar ou restaurar janela' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fechar janela' })).toBeVisible();
});

test('@premium-game-selector keeps native options legible in the dark theme', async ({ page }) => {
  await openDesktopTestCase(page, {
    initialPath: '/competitive',
    operationalState: 'fixture',
    scenarioId: 'S01',
    windowsLocale: 'pt-BR',
  });

  const selector = page.getByRole('combobox', { name: 'Jogo' });
  await expect(selector).toHaveCSS('color-scheme', 'dark');
  await expect(selector.locator('option').first()).toHaveCSS('background-color', 'rgb(17, 22, 32)');
  await expect(selector.locator('option').first()).toHaveCSS('color', 'rgb(244, 247, 251)');
});

test('@premium-navigation home review action opens the current premium controls route', async ({
  page,
}) => {
  await openDesktopTestCase(page, {
    initialPath: '/home',
    operationalState: 'fixture',
    scenarioId: 'S01',
    windowsLocale: 'pt-BR',
  });

  await page.getByRole('button', { name: 'Revisar ajustes' }).click();

  await expect(page.locator('.desktop-app-shell')).toHaveAttribute('data-route-path', '/toggles');
  await expect(page.getByRole('heading', { name: 'Controles rápidos' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Otimização' })).toHaveCount(0);
});

test('@premium-readiness home analysis exposes progress and refreshes evidence', async ({
  page,
}) => {
  await openDesktopTestCase(page, {
    initialPath: '/home',
    operationalState: 'fixture',
    scenarioId: 'S01',
    windowsLocale: 'pt-BR',
  });

  await expect(page.getByText('Sistema pronto', { exact: true })).toBeVisible();
  await expect(page.locator('.premium-score')).toHaveCount(0);
  await expect(page.getByText('5 ajustes compatíveis', { exact: true })).toBeVisible();

  const analyzeButton = page
    .locator('.premium-readiness-copy .premium-inline-actions')
    .getByRole('button')
    .nth(1);
  await analyzeButton.click();

  await expect(analyzeButton).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Analisando…' })).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Progresso da análise' })).toHaveAttribute(
    'aria-valuenow',
    '24',
  );

  await expect(page.getByRole('progressbar', { name: 'Progresso da análise' })).toHaveAttribute(
    'aria-valuenow',
    '100',
    { timeout: 3_000 },
  );
  await expect(page.getByText('Análise concluída com segurança', { exact: true })).toBeVisible();
  await expect(page.getByText('Verificado agora', { exact: true })).toBeVisible();
  await expect(analyzeButton).toBeEnabled();
  await expect(
    page.getByText(
      'Análise demonstrativa concluída. As evidências foram atualizadas e nenhuma alteração foi aplicada.',
      { exact: true },
    ),
  ).toBeVisible();
});

test('@premium-readiness home readiness and analysis controls are fully localized in English', async ({
  page,
}) => {
  await openDesktopTestCase(page, {
    initialPath: '/home',
    operationalState: 'fixture',
    scenarioId: 'S01',
    windowsLocale: 'en-US',
  });

  await expect(page.getByText('System ready', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ready for your next session' })).toBeVisible();
  await expect(page.getByText('5 compatible controls', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Analyze again' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Review controls' })).toBeVisible();
  await expect(page.getByText('Prontidão do sistema', { exact: true })).toHaveCount(0);
});
