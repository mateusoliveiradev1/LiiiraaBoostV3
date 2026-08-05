import { expect, test, type Page } from '@playwright/test';

import { openDesktopTestCase } from './fixtures.ts';

const OWNER_TASK_ID = '04-21-01';

const openExpiredAuthority = async (page: Page, initialPath: string): Promise<void> => {
  await openDesktopTestCase(page, {
    initialPath,
    operationalState: 'expired-entitlement',
    scenarioId: 'S01',
    windowsLocale: 'pt-BR',
  });
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
};

test(`@entitlement-smoke [owner:${OWNER_TASK_ID}] expiry blocks the next new Premium action`, async ({
  page,
}) => {
  await openExpiredAuthority(page, '/competitive');

  await expect(page.getByRole('alert', { name: 'Premium authorization expired' })).toContainText(
    'Nova ação Premium',
  );
  await expect(page.getByRole('button', { name: 'Ativar modo competitivo' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Verificar Premium online' })).toBeVisible();
});

test(`@entitlement-smoke [owner:${OWNER_TASK_ID}] expiry does not interrupt in-flight Premium work`, async ({
  page,
}) => {
  await openExpiredAuthority(page, '/session/demo-session/active');

  await expect(page.getByRole('status', { name: 'Sessão Premium em andamento' })).toContainText(
    'continua',
  );
  await expect(page.getByRole('button', { name: 'Encerrar sessão com segurança' })).toBeEnabled();
});

test(`@entitlement-smoke [owner:${OWNER_TASK_ID}] verified seven-day offline authority admits a new Premium action`, async ({
  page,
}) => {
  await openDesktopTestCase(page, {
    initialPath: '/competitive',
    operationalState: 'offline',
    premiumAuthorityState: 'offline-valid',
    scenarioId: 'S01',
    windowsLocale: 'pt-BR',
  });

  await expect(page.locator('[data-premium-new-work-blocked="false"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Iniciar sessão' })).toBeEnabled();
  await expect(page.getByRole('alert', { name: 'Premium authorization expired' })).toHaveCount(0);
});

test(`@entitlement-smoke [owner:${OWNER_TASK_ID}] approaching expiry warns without blocking the new Premium action`, async ({
  page,
}) => {
  await openDesktopTestCase(page, {
    initialPath: '/competitive',
    operationalState: 'offline',
    premiumAuthorityState: 'approaching-expiry',
    scenarioId: 'S01',
    windowsLocale: 'pt-BR',
  });

  await expect(
    page.getByRole('status', { name: 'Autorização Premium perto de expirar' }),
  ).toContainText('perto de expirar');
  await expect(page.getByRole('button', { name: 'Iniciar sessão' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Verificar Premium online' })).toBeVisible();
});
