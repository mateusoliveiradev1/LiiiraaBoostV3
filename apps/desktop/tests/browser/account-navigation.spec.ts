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

  await page.getByRole('button', { name: 'Otimização', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir', exact: true }).first().click();
  await expect(page.locator('.desktop-app-shell')).toHaveAttribute(
    'data-route-path',
    '/components/windows',
  );
  await expect(page.getByRole('heading', { name: 'Windows' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Revisar ajuste' })).toHaveCount(3);
  await expect(
    page.locator('.lb-operation-row strong').filter({
      hasText: 'Revisar o Modo de Jogo do Windows',
    }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Revisar ajuste' }).first().click();
  await expect(page.locator('.desktop-app-shell')).toHaveAttribute(
    'data-route-path',
    '/operations/windows-game-mode-review',
  );
  await expect(page.getByText('Operação: Revisar o Modo de Jogo do Windows')).toBeVisible();

  await page.getByRole('button', { name: 'Otimização', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir', exact: true }).first().click();
  await page.getByRole('button', { name: 'Revisar plano recomendado' }).click();
  await expect(page.locator('.desktop-app-shell')).toHaveAttribute(
    'data-route-path',
    '/plans/recommended-plan/review',
  );

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
  await page.getByRole('button', { name: 'Segurança', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Base forte, duas etapas pendentes' }),
  ).toBeVisible();
});
