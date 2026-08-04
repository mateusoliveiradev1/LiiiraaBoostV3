import { expect, test, type Page, type TestInfo } from '@playwright/test';

const OWNER_TASK_ID = '04-18-02';
const PRODUCTION_AUTHORITY_RED =
  'EXPECTED_RED[04-18-02]: production account authority is not activated';

const onlyCanonicalAuthorityAxis = (testInfo: TestInfo): void => {
  test.skip(
    testInfo.project.metadata['axis'] !== 'wide-1440',
    'The authority smoke journey has one canonical browser axis.',
  );
};

const expectAccountShell = async (page: Page): Promise<void> => {
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
};

const requireProductionAccountAuthority = (): void => {
  expect(false, PRODUCTION_AUTHORITY_RED).toBe(true);
};

test(`@final @account @authority-smoke [owner:${OWNER_TASK_ID}] projects account authority and returns a versioned profile mutation receipt`, async ({
  page,
}, testInfo) => {
  onlyCanonicalAuthorityAxis(testInfo);
  await page.goto('/en/account/profile');
  await expectAccountShell(page);

  requireProductionAccountAuthority();

  await expect(page.getByRole('region', { name: 'Account authority status' })).toContainText(
    'Connected',
  );
  await page.getByRole('button', { name: 'Edit profile' }).click();
  await page.getByRole('textbox', { name: 'Display name' }).fill('Liiiraa Authority');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('status', { name: 'Profile update receipt' })).toContainText('Saved');
});

test(`@final @account @authority-smoke [owner:${OWNER_TASK_ID}] preserves the active PC when replacement is inside the cooldown`, async ({
  page,
}, testInfo) => {
  onlyCanonicalAuthorityAxis(testInfo);
  await page.goto('/en/account/device');
  await expectAccountShell(page);

  requireProductionAccountAuthority();

  await page.getByRole('button', { name: 'Replace device' }).click();
  await expect(page.getByRole('alert', { name: 'Device replacement unavailable' })).toContainText(
    '30 days',
  );
  await expect(page.getByRole('region', { name: 'Active device' })).toContainText('Active');
});
