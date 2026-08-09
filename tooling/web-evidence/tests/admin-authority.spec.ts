import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route, type TestInfo } from '@playwright/test';

const OWNER_TASK_ID = '04-19-02';

type AdminRole = 'support' | 'operations' | 'security' | 'audit';

const onlyCanonicalAuthorityAxis = (testInfo: TestInfo): void => {
  test.skip(
    testInfo.project.metadata['axis'] !== 'wide-1440',
    'The authority smoke journey has one canonical browser axis.',
  );
};

const onlyAuthorityRecoveryAxis = (testInfo: TestInfo): void => {
  const axis = testInfo.project.metadata['axis'];
  test.skip(
    axis !== 'wide-1440' && axis !== 'mobile-390' && axis !== 'reduced-motion',
    'The visual recovery witness runs at the canonical desktop, mobile, and reduced-motion axes.',
  );
};

const fulfill = (route: Route, body: unknown, status = 200): Promise<void> =>
  route.fulfill({
    body: JSON.stringify(body),
    contentType: 'application/json',
    headers: { 'cache-control': 'no-store, private' },
    status,
  });

const authorityReceipt = () => ({
  schemaVersion: '1.0',
  kind: 'authority-receipt',
  receiptId: 'receipt-admin-browser-01',
  commandId: 'admin-browser-1',
  aggregateId: 'release-017',
  aggregateVersion: '8',
  etag: 'release-release-017-v8',
  correlationId: 'admin-browser-command',
  auditReference: 'audit-admin-browser-01',
  outcome: 'applied',
  provenance: 'postgres-authority',
  recordedAt: new Date().toISOString(),
});

const installAdminAuthority = async (page: Page, initialRole: AdminRole) => {
  let role = initialRole;
  const requests: Readonly<{ body: unknown; method: string; url: string }>[] = [];
  await page.context().addCookies([
    {
      name: 'liiiraa-csrf',
      url: 'http://admin.localhost:3102',
      value: `csrf.${'a'.repeat(43)}`,
    },
  ]);
  await page.route('**/v1/identity/strong-auth/step-up', async (route) => {
    const request = route.request();
    requests.push({
      body: request.postDataJSON(),
      method: request.method(),
      url: '/v1/identity/strong-auth/step-up',
    });
    await fulfill(route, {
      expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      method: 'totp',
      ok: true,
      receipt: 'opaque-step-up-receipt-abcdefghijklmnopqrstuvwxyz0123456789',
      verifiedAt: new Date().toISOString(),
    });
  });
  await page.route('**/v1/admin/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/v1/admin/session') {
      await fulfill(route, {
        actorId: 'developer-browser-01',
        expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
        role,
      });
      return;
    }
    if (url.pathname === '/v1/admin/roles/handoff') {
      const body = request.postDataJSON() as { role?: AdminRole };
      if (body.role !== undefined) role = body.role;
      requests.push({ body, method: request.method(), url: url.pathname });
      await fulfill(route, {
        actorId: 'developer-browser-01',
        expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
        role,
      });
      return;
    }
    if (url.pathname === '/v1/admin/commands') {
      requests.push({ body: request.postDataJSON(), method: request.method(), url: url.pathname });
      await fulfill(route, authorityReceipt());
      return;
    }
    if (url.pathname === '/v1/admin/break-glass/metadata') {
      requests.push({ body: request.postDataJSON(), method: request.method(), url: url.pathname });
      await fulfill(route, {
        accountReference: 'account-••••-015',
        caseId: 'case-015',
        riskClass: 'high',
        sessionReference: 'session-••••-083',
      });
      return;
    }
    await fulfill(route, {
      records: [
        {
          id: role === 'operations' ? 'OPS-117' : role === 'security' ? 'SEC-083' : 'AUD-204',
          redactedTarget: 'Target ••••-017',
        },
      ],
    });
  });
  return { requests, role: () => role };
};

const expectProductionShell = async (page: Page): Promise<void> => {
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-runtime-class', 'server-authority');
  await expect(page.locator('[data-admin-runtime="production"]')).toBeVisible();
};

test(`@final @admin @authority-smoke [owner:${OWNER_TASK_ID}] admits exactly one server-derived administrative role`, async ({
  page,
}, testInfo) => {
  onlyCanonicalAuthorityAxis(testInfo);
  await installAdminAuthority(page, 'security');
  await page.goto('/en/admin');
  await expectProductionShell(page);

  await expect(page.getByRole('status', { name: 'Active administrative role' })).toHaveText(
    'Security',
  );
  await expect(page.getByRole('link', { name: 'Support' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Security' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Revenue' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Operation' })).toHaveCount(0);
  await expect(page.locator('[data-admin-role="audit"]')).toHaveCount(0);
});

test(`@final @admin @authority-smoke [owner:${OWNER_TASK_ID}] denies route and detail before loading records`, async ({
  page,
}, testInfo) => {
  onlyCanonicalAuthorityAxis(testInfo);
  const authority = await installAdminAuthority(page, 'security');
  await page.goto('/en/admin/support/case-secret');
  await expectProductionShell(page);

  await expect(
    page.getByRole('alert').filter({ hasText: 'Administrative authority unavailable' }),
  ).toBeVisible();
  expect(authority.requests).toEqual([]);
  await expect(page.locator('main')).not.toContainText('case-secret');
});

test(`@final @admin @authority-smoke [owner:${OWNER_TASK_ID}] requires scoped step-up before a critical operation and renders its receipt`, async ({
  page,
}, testInfo) => {
  onlyCanonicalAuthorityAxis(testInfo);
  const authority = await installAdminAuthority(page, 'operations');
  await page.goto('/en/admin/operations/OPS-117');
  await expectProductionShell(page);

  await page.getByRole('button', { name: 'Review publication hold' }).click();
  const stepUp = page.getByRole('dialog', { name: 'Verify critical operation' });
  await expect(stepUp).toBeVisible();
  const confirm = stepUp.getByRole('button', { name: 'Confirm publication hold' });
  await expect(confirm).toBeDisabled();
  await stepUp
    .getByRole('textbox', { name: 'Reason' })
    .fill('Keep publication held while integrity is reviewed');
  await stepUp.getByRole('textbox', { name: 'Six-digit authenticator code' }).fill('123456');
  await stepUp.getByRole('checkbox').focus();
  await stepUp.getByRole('checkbox').press('Space');
  await expect(stepUp.getByRole('checkbox')).toBeChecked();
  await expect(confirm).toBeDisabled();
  await stepUp.getByRole('button', { name: 'Verify with a strong credential' }).click();
  await expect(confirm).toBeEnabled();
  await confirm.click();

  await expect(page.getByRole('status', { name: 'Immutable authority receipt' })).toContainText(
    'audit-admin-browser-01',
  );
  expect(authority.requests.find(({ url }) => url === '/v1/admin/commands')).toMatchObject({
    body: {
      command: {
        action: 'correct-entitlement',
        assumedRole: 'operations',
        reason: 'Keep publication held while integrity is reviewed',
      },
      confirmed: true,
      impactReviewed: true,
    },
    method: 'POST',
  });
});

test(`@final @admin @authority-smoke [owner:${OWNER_TASK_ID}] handoff replaces the role and break-glass stays redacted`, async ({
  page,
}, testInfo) => {
  onlyCanonicalAuthorityAxis(testInfo);
  const authority = await installAdminAuthority(page, 'operations');
  await page.goto('/en/admin');
  await expectProductionShell(page);

  const handoff = await page.evaluate(async () => {
    const response = await fetch('/v1/admin/roles/handoff', {
      body: JSON.stringify({ reason: 'Explicit security handoff', role: 'security' }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    return response.json();
  });
  expect(handoff).toMatchObject({ role: 'security' });
  await page.goto('/en/admin/security/SEC-083');
  await expect(page.getByRole('status', { name: 'Active administrative role' })).toHaveText(
    'Security',
  );
  await page.getByRole('textbox', { name: 'Six-digit authenticator code' }).fill('123456');
  await page.getByRole('button', { name: 'Open break-glass metadata' }).click();
  const metadata = page.getByRole('region', { name: 'Redacted break-glass metadata' });
  await expect(metadata).toContainText('session-••••-083');
  await expect(metadata).not.toContainText(/raw|diagnostic bytes|email|token/iu);
  expect(authority.role()).toBe('security');
});

test(`@final @admin @authority-visual [owner:04-64-03] keeps the real authority workspace authored and responsive`, async ({
  page,
}, testInfo) => {
  onlyAuthorityRecoveryAxis(testInfo);
  await installAdminAuthority(page, 'security');
  await page.goto('/pt-BR/admin');
  await expectProductionShell(page);

  await expect(page.getByRole('heading', { level: 1, name: 'Visão da função' })).toBeVisible();
  await expect(page.getByText('Central administrativa')).toBeVisible();
  await expect(page.getByRole('status', { name: 'Função administrativa ativa' })).toHaveText(
    'Segurança',
  );
  await expect(page.getByRole('link', { name: 'Abrir detalhe autorizado' })).toBeVisible();
  await expect(page.locator('main')).not.toContainText(/\b(?:live|stale|degraded)\b/u);

  const detailTarget = page.getByRole('link', { name: 'Abrir detalhe autorizado' });
  await detailTarget.focus();
  await expect(detailTarget).toBeFocused();
  const targetBox = await detailTarget.boundingBox();
  expect(targetBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  const overflow = await page
    .locator('html')
    .evaluate((root) => root.scrollWidth - root.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  const accessibility = await new AxeBuilder({ page }).analyze();
  const blocking = accessibility.violations.filter(
    ({ impact }) => impact === 'critical' || impact === 'serious',
  );
  expect(blocking, `Blocking axe findings:\n${JSON.stringify(blocking, null, 2)}`).toEqual([]);

  await page.screenshot({
    animations: 'disabled',
    fullPage: true,
    path: testInfo.outputPath(`admin-authority-${String(testInfo.project.metadata['axis'])}.png`),
  });
});
