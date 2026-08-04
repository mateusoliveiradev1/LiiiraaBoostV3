import { expect, test, type Page } from '@playwright/test';

import { openDesktopTestCase } from './fixtures.ts';

const OWNER_TASK_ID = '04-21-01';
const PRODUCTION_ENTITLEMENT_RED =
  'EXPECTED_RED[04-21-01]: verified production entitlement authority is not activated';

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

const requireVerifiedEntitlementAuthority = (): void => {
  expect(false, PRODUCTION_ENTITLEMENT_RED).toBe(true);
};

test(`@entitlement-smoke [owner:${OWNER_TASK_ID}] expiry blocks the next new Premium action`, async ({
  page,
}) => {
  await openExpiredAuthority(page, '/competitive');

  requireVerifiedEntitlementAuthority();

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

  requireVerifiedEntitlementAuthority();

  await expect(page.getByRole('status', { name: 'Sessão Premium em andamento' })).toContainText(
    'continua',
  );
  await expect(page.getByRole('button', { name: 'Encerrar sessão com segurança' })).toBeEnabled();
});
