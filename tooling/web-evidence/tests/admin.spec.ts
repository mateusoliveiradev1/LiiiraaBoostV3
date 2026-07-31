import { expect, test, type Page, type TestInfo } from '@playwright/test';

const onlyAxis = (testInfo: TestInfo, axis: string) => {
  test.skip(testInfo.project.metadata['axis'] !== axis, `Covered by the ${axis} project.`);
};

const mutationRequests = (page: Page): string[] => {
  const mutations: string[] = [];
  page.on('request', (request) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      mutations.push(`${request.method()} ${request.url()}`);
    }
  });
  return mutations;
};

const advanceButtonWorkflow = async (page: Page) => {
  await page.getByRole('button', { name: 'Validate reviewed fields' }).click();
  await page.getByRole('button', { name: 'Validate reviewed fields' }).click();
  await page.getByRole('button', { name: 'Review action boundary' }).click();
  await page.getByRole('button', { name: 'Complete reauthentication simulation' }).click();
};

test('@final @admin W14 keeps support role-scoped, redacted, cancellable, and immutable', async ({
  page,
}, testInfo) => {
  onlyAxis(testInfo, 'wide-1440');
  const mutations = mutationRequests(page);
  await page.goto('/en/admin/support/case-preview?role=support');
  await expect(page.getByRole('heading', { level: 1, name: 'Support case review' })).toBeVisible();
  await expect(page.locator('main')).toContainText('Customer target ••••-042');
  await expect(page.locator('main')).not.toContainText(/@[a-z0-9.-]+\.[a-z]{2,}/iu);

  await page
    .getByRole('textbox', { name: 'Support response draft' })
    .fill('Reviewed synthetic guidance only.');
  await page.getByRole('button', { name: 'Review support response' }).click();
  await advanceButtonWorkflow(page);
  await page.getByRole('button', { name: 'Cancel preview' }).click();
  await expect(page.locator('[data-preview-region="receipt"]')).toHaveAttribute(
    'data-remote-state-changed',
    'false',
  );
  await expect(page.locator('[data-immutable="true"]')).toBeVisible();
  expect(mutations).toEqual([]);
});

test('@final @admin W15 blocks diagnostics without exact consent and explains every scope', async ({
  page,
}, testInfo) => {
  onlyAxis(testInfo, 'wide-1440');
  await page.goto('/pt-BR/admin/diagnostics/diagnostic-preview?role=security');
  await expect(page.locator('[data-consent-decision="missing"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Acesso ao diagnóstico bloqueado' })).toBeVisible();
  await expect(page.locator('main')).toContainText('startup-state, application-version');
  await expect(page.locator('main')).toContainText('security.preview');
  await expect(page.locator('main')).toContainText('audit-consent-015');
  await expect(page.locator('main')).not.toContainText('synthetic-ready');
  await expect(page.locator('[data-high-risk-action="true"]')).toHaveCount(0);
});

test('@final @admin W16 preserves safe mobile review while hiding high-risk authority', async ({
  page,
}, testInfo) => {
  onlyAxis(testInfo, 'mobile-390');
  await page.goto('/en/admin/operations/review-preview?role=operations');
  await expect(page.getByRole('heading', { level: 1, name: 'Operations review' })).toBeVisible();
  await expect(page.getByText(/Alert triage and evidence review remain available on mobile/iu)).toBeVisible();
  await expect(page.locator('[data-high-risk-action="true"]')).toBeHidden();
  await expect(page.locator('main')).toContainText('Deployment target ••••-017');
});

test('@final @admin W17 keeps admin errors distinct, localized, and redacted', async ({
  page,
}, testInfo) => {
  onlyAxis(testInfo, 'desktop-960');
  const paths = ['/pt-BR/errors/403', '/pt-BR/errors/404', '/pt-BR/errors/500'] as const;
  const headings = new Set<string>();
  for (const path of paths) {
    await page.goto(path);
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
    const heading = page.getByRole('heading', { level: 1 });
    headings.add((await heading.textContent()) ?? '');
    await expect(page.locator('main')).not.toContainText(/stack|node_modules|C:\\|src\//u);
  }
  expect(headings.size).toBe(paths.length);
});
