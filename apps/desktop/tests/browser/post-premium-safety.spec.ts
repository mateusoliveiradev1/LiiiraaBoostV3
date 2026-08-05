import { expect, test, type Page } from '@playwright/test';

import { openDesktopTestCase } from './fixtures.ts';

const OWNER_TASK_ID = '04-21-01';

const openPostPremiumSafetyRoute = async (page: Page, initialPath: string): Promise<void> => {
  await openDesktopTestCase(page, {
    initialPath,
    operationalState: 'expired-entitlement',
    scenarioId: 'S01',
    windowsLocale: 'pt-BR',
  });
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
};

test(`@safety-smoke [owner:${OWNER_TASK_ID}] diagnostic history remains available after Premium loss`, async ({
  page,
}) => {
  await openPostPremiumSafetyRoute(page, '/measure/sessions');

  await expect(page.getByRole('region', { name: 'Histórico de diagnóstico' })).toBeVisible();
});

test(`@safety-smoke [owner:${OWNER_TASK_ID}] security warnings remain available after Premium loss`, async ({
  page,
}) => {
  await openPostPremiumSafetyRoute(page, '/security');

  await expect(page.getByRole('region', { name: 'Alertas de segurança' })).toBeVisible();
});

test(`@safety-smoke [owner:${OWNER_TASK_ID}] restoration remains available after Premium loss`, async ({
  page,
}) => {
  await openPostPremiumSafetyRoute(page, '/restoration');

  await expect(page.getByRole('button', { name: 'Iniciar restauração segura' })).toBeEnabled();
});
