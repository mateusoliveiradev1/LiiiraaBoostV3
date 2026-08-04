import { expect, test, type Page, type TestInfo } from '@playwright/test';

const OWNER_TASK_ID = '04-19-02';
const PRODUCTION_AUTHORITY_RED =
  'EXPECTED_RED[04-19-02]: production administrative authority is not activated';

const onlyCanonicalAuthorityAxis = (testInfo: TestInfo): void => {
  test.skip(
    testInfo.project.metadata['axis'] !== 'wide-1440',
    'The authority smoke journey has one canonical browser axis.',
  );
};

const expectAdminShell = async (page: Page): Promise<void> => {
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
};

const requireProductionAdminAuthority = (): void => {
  expect(false, PRODUCTION_AUTHORITY_RED).toBe(true);
};

test(`@final @admin @authority-smoke [owner:${OWNER_TASK_ID}] admits exactly one server-derived administrative role`, async ({
  page,
}, testInfo) => {
  onlyCanonicalAuthorityAxis(testInfo);
  await page.goto('/en/admin?role=security');
  await expectAdminShell(page);

  requireProductionAdminAuthority();

  await expect(page.getByRole('status', { name: 'Active administrative role' })).toHaveText(
    'Security',
  );
  await expect(page.getByRole('link', { name: 'Support case queue' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Diagnostic access' })).toBeVisible();
});

test(`@final @admin @authority-smoke [owner:${OWNER_TASK_ID}] requires scoped step-up before a critical operation`, async ({
  page,
}, testInfo) => {
  onlyCanonicalAuthorityAxis(testInfo);
  await page.goto('/en/admin/operations/OPS-117?role=operations');
  await expectAdminShell(page);

  requireProductionAdminAuthority();

  await page.getByRole('button', { name: 'Review publication hold' }).click();
  const stepUp = page.getByRole('dialog', { name: 'Verify critical operation' });
  await expect(stepUp).toBeVisible();
  await expect(stepUp.getByRole('textbox', { name: 'Reason' })).toBeVisible();
  await expect(stepUp.getByRole('button', { name: 'Confirm publication hold' })).toBeDisabled();
});
