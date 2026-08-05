import { expect, test, type BrowserContext, type Page, type Route, type TestInfo } from '@playwright/test';

const OWNER_TASK_ID = '04-19-02';

const onlyCanonicalConsentAxis = (testInfo: TestInfo): void => {
  test.skip(
    testInfo.project.metadata['axis'] !== 'wide-1440',
    'The consent smoke journey has one canonical browser axis.',
  );
};

const auditEvent = (state: 'active' | 'revoked' | 'expired') => ({
  schemaVersion: '1.0',
  kind: 'audit-event',
  auditEventId: `audit-diagnostic-${state}`,
  actorReference: 'security-operator',
  assumedRole: 'security',
  action: `diagnostic-access-${state}`,
  redactedTarget: 'Diagnostic ••••-015',
  reason: state === 'active' ? 'Active bounded consent' : `Diagnostic access ${state}`,
  result: 'succeeded',
  aggregateVersion: state === 'active' ? '4' : '5',
  correlationId: 'admin-consent-browser',
  eventHash: (state === 'active' ? 'a' : 'b').repeat(64),
  occurredAt: new Date().toISOString(),
});

const projection = (state: 'active' | 'revoked' | 'expired') => ({
  consent: {
    schemaVersion: '1.0',
    aggregateVersion: state === 'active' ? '4' : '5',
    etag: `consent-consent-015-${state}`,
    correlationId: 'admin-consent-browser',
    provenance: 'postgres-authority',
    kind: 'diagnostic-consent',
    consentId: 'consent-015',
    accountId: 'account-015',
    state,
    scopes: ['support-diagnostics'],
    purpose: 'Review startup-state and application-version for case DIA-015',
    grantedAt: '2026-01-15T11:00:00.000Z',
    expiresAt:
      state === 'expired'
        ? '2026-01-15T11:59:59.000Z'
        : new Date(Date.now() + 60 * 60_000).toISOString(),
    ...(state === 'revoked' ? { revokedAt: new Date().toISOString() } : {}),
  },
  fields:
    state === 'active' ? { 'application-version': '1.0.0', 'startup-state': 'ready' } : {},
  auditEvents: [auditEvent(state)],
});

const fulfill = (route: Route, body: unknown, status = 200): Promise<void> =>
  route.fulfill({
    body: JSON.stringify(body),
    contentType: 'application/json',
    headers: { 'cache-control': 'no-store, private' },
    status,
  });

const installConsentAuthority = async (
  context: BrowserContext,
  initialState: 'active' | 'expired' = 'active',
) => {
  let state: 'active' | 'revoked' | 'expired' = initialState;
  const requests: string[] = [];
  await context.route('**/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    requests.push(`${request.method()} ${url.origin}${url.pathname}`);
    if (url.pathname === '/v1/admin/session') {
      await fulfill(route, {
        actorId: 'security-operator',
        expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
        role: 'security',
      });
      return;
    }
    if (url.pathname === '/v1/admin/diagnostic-metadata/DIA-015') {
      await fulfill(route, projection(state));
      return;
    }
    if (url.pathname === '/v1/support/consents/consent-015/revoke') {
      state = 'revoked';
      await fulfill(route, {
        schemaVersion: '1.0',
        kind: 'authority-receipt',
        receiptId: 'receipt-consent-revoke',
        commandId: 'command-consent-revoke',
        aggregateId: 'consent-015',
        aggregateVersion: '5',
        etag: 'consent-consent-015-v5',
        correlationId: 'admin-consent-browser',
        auditReference: 'audit-diagnostic-revoked',
        outcome: 'applied',
        provenance: 'postgres-authority',
        recordedAt: new Date().toISOString(),
      });
      return;
    }
    await fulfill(route, { records: [] });
  });
  return { requests, state: () => state };
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
  const authority = await installConsentAuthority(context);
  await adminPage.goto('/en/admin/diagnostics/DIA-015?role=audit');
  await expectRenderedApplication(adminPage);

  const diagnosticView = adminPage.getByRole('region', { name: 'Consented diagnostic view' });
  await expect(diagnosticView).toBeVisible();
  await expect(diagnosticView).toHaveAttribute('data-cache-policy', 'no-store');
  await expect(diagnosticView).toContainText('startup-state');

  const accountPage = await context.newPage();
  await accountPage.goto('http://account.localhost:3101/en/account/privacy');
  await expectRenderedApplication(accountPage);
  const receipt = await accountPage.evaluate(async () => {
    const response = await fetch('/v1/support/consents/consent-015/revoke', {
      body: JSON.stringify({ action: 'revoke' }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    return response.json();
  });
  expect(receipt).toMatchObject({
    auditReference: 'audit-diagnostic-revoked',
    kind: 'authority-receipt',
  });

  await expect(diagnosticView).toHaveCount(0);
  await expect(adminPage.getByRole('status', { name: 'Diagnostic access revoked' })).toBeVisible();
  await expect(adminPage.locator('a[download], a[href^="blob:"]')).toHaveCount(0);
  await expect(adminPage.getByRole('row', { name: /diagnostic access revoked/iu })).toBeVisible();
  expect(authority.state()).toBe('revoked');
  expect(authority.requests.some((request) => request.startsWith('GET http://admin.localhost:3102'))).toBe(true);
  expect(authority.requests.some((request) => request.startsWith('POST http://account.localhost:3101'))).toBe(true);
});

test(`@final @admin @consent-smoke [owner:${OWNER_TASK_ID}] expired consent never renders diagnostic bytes`, async ({
  context,
  page,
}, testInfo) => {
  onlyCanonicalConsentAxis(testInfo);
  await installConsentAuthority(context, 'expired');
  await page.goto('/en/admin/diagnostics/DIA-015');
  await expectRenderedApplication(page);

  await expect(page.getByRole('region', { name: 'Consented diagnostic view' })).toHaveCount(0);
  await expect(page.getByRole('status', { name: 'Diagnostic access expired' })).toBeVisible();
  await expect(page.locator('main')).not.toContainText('ready');
  await expect(page.getByRole('row', { name: /diagnostic access expired/iu })).toBeVisible();
});
