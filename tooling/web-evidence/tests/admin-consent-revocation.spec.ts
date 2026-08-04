import { expect, test, type Page, type TestInfo } from '@playwright/test';

const OWNER_TASK_ID = '04-19-02';
const PRODUCTION_CONSENT_RED =
  'EXPECTED_RED[04-19-02]: cross-origin production consent authority is not activated';

const onlyCanonicalConsentAxis = (testInfo: TestInfo): void => {
  test.skip(
    testInfo.project.metadata['axis'] !== 'wide-1440',
    'The consent smoke journey has one canonical browser axis.',
  );
};

const expectRenderedApplication = async (page: Page): Promise<void> => {
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
};

test(`@final @admin @consent-smoke [owner:${OWNER_TASK_ID}] clears an active diagnostic view after account-origin revocation`, async ({
  context,
  page: adminPage,
}, testInfo) => {
  onlyCanonicalConsentAxis(testInfo);
  await adminPage.goto('/en/admin/diagnostics/DIA-015?role=security');
  await expectRenderedApplication(adminPage);

  expect(false, PRODUCTION_CONSENT_RED).toBe(true);

  const diagnosticView = adminPage.getByRole('region', { name: 'Consented diagnostic view' });
  await expect(diagnosticView).toBeVisible();
  await expect(diagnosticView).toHaveAttribute('data-cache-policy', 'no-store');

  const accountPage = await context.newPage();
  await accountPage.goto('http://account.localhost:3101/en/account/privacy');
  await expectRenderedApplication(accountPage);
  await accountPage.getByRole('button', { name: 'Revoke diagnostic access' }).click();
  await expect(
    accountPage.getByRole('status', { name: 'Consent revocation receipt' }),
  ).toBeVisible();

  await expect(diagnosticView).toHaveCount(0);
  await expect(adminPage.getByRole('status', { name: 'Diagnostic access revoked' })).toBeVisible();
  await expect(adminPage.locator('a[download], a[href^="blob:"]')).toHaveCount(0);
  await expect(adminPage.getByRole('row', { name: /diagnostic access revoked/iu })).toBeVisible();
});
