import { expect, test, type Page, type Route, type TestInfo } from '@playwright/test';

const OWNER_TASK_ID = '04-19-02';

type AdminRole = 'support' | 'operations' | 'security' | 'audit';

const onlyCanonicalAuthorityAxis = (testInfo: TestInfo): void => {
  test.skip(
    testInfo.project.metadata['axis'] !== 'wide-1440',
    'The authority smoke journey has one canonical browser axis.',
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
    { name: 'liiiraa-csrf', url: 'http://admin.localhost:3102', value: 'csrf-admin-browser' },
  ]);
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
  await page.goto('/en/admin?role=audit');
  await expectProductionShell(page);

  await expect(page.getByRole('status', { name: 'Active administrative role' })).toHaveText(
    'Security',
  );
  await expect(page.getByRole('link', { name: 'Support case queue' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Diagnostic access' })).toBeVisible();
  await expect(page.locator('[data-admin-role="audit"]')).toHaveCount(0);
});

test(`@final @admin @authority-smoke [owner:${OWNER_TASK_ID}] denies route and detail before loading records`, async ({
  page,
}, testInfo) => {
  onlyCanonicalAuthorityAxis(testInfo);
  const authority = await installAdminAuthority(page, 'security');
  await page.goto('/en/admin/support/case-secret?role=support');
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
  await page.goto('/en/admin/operations/OPS-117?role=security');
  await expectProductionShell(page);

  await page.getByRole('button', { name: 'Review publication hold' }).click();
  const stepUp = page.getByRole('dialog', { name: 'Verify critical operation' });
  await expect(stepUp).toBeVisible();
  const confirm = stepUp.getByRole('button', { name: 'Confirm publication hold' });
  await expect(confirm).toBeDisabled();
  await stepUp
    .getByRole('textbox', { name: 'Reason' })
    .fill('Keep publication held while integrity is reviewed');
  await stepUp.getByRole('checkbox').check();
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
  await page.goto('/en/admin/security/SEC-083?role=operations');
  await expect(page.getByRole('status', { name: 'Active administrative role' })).toHaveText(
    'Security',
  );
  await page.getByRole('button', { name: 'Open break-glass metadata' }).click();
  const metadata = page.getByRole('region', { name: 'Redacted break-glass metadata' });
  await expect(metadata).toContainText('session-••••-083');
  await expect(metadata).not.toContainText(/raw|diagnostic bytes|email|token/iu);
  expect(authority.role()).toBe('security');
});
