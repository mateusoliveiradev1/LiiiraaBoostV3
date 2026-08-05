import { expect, test, type Page, type Route, type TestInfo } from '@playwright/test';

const OWNER_TASK_ID = '04-18-02';
const DAY_MS = 86_400_000;

type ProjectionOptions = Readonly<{
  accountVersion?: string;
  cancelAtPeriodEnd?: boolean;
  displayName?: string;
  invoiceState?: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  provenance?: 'online' | 'offline' | 'stale' | 'pending' | 'conflict';
  subscriptionState?: 'none' | 'trialing' | 'active' | 'past-due' | 'canceled' | 'expired';
}>;

const accountProjection = ({
  accountVersion = '7',
  cancelAtPeriodEnd = false,
  displayName = 'Astra Player',
  invoiceState = 'paid',
  provenance = 'online',
  subscriptionState = 'active',
}: ProjectionOptions = {}) => ({
  account: {
    schemaVersion: '1.0',
    aggregateVersion: accountVersion,
    etag: `account-account-01-v${accountVersion}`,
    correlationId: 'account-browser-evidence',
    provenance: 'postgres-authority',
    kind: 'account-projection',
    accountId: 'account-01',
    state: 'active',
    displayName,
    emailRedacted: 'a***@example.com',
    locale: 'en',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-15T12:00:00.000Z',
  },
  provenance,
  securityMethods: [
    { factor: 'passkey', methodId: 'method-passkey', verifiedAt: '2026-01-15T10:00:00.000Z' },
    { factor: 'totp', methodId: 'method-mfa', verifiedAt: '2026-01-15T10:05:00.000Z' },
    {
      factor: 'recovery-code',
      methodId: 'method-recovery',
      verifiedAt: '2026-01-15T10:06:00.000Z',
    },
  ],
  sessions: [
    {
      schemaVersion: '1.0',
      aggregateVersion: '3',
      etag: 'session-session-01-v3',
      correlationId: 'account-browser-evidence',
      provenance: 'postgres-authority',
      kind: 'session-projection',
      sessionId: 'session-01',
      accountId: 'account-01',
      state: 'active',
      authenticationStrength: 'passkey',
      scopes: ['session-web'],
      authenticatedAt: '2026-01-15T10:00:00.000Z',
      expiresAt: '2026-01-16T10:00:00.000Z',
      lastSeenAt: '2026-01-15T12:00:00.000Z',
    },
  ],
  subscription: {
    schemaVersion: '1.0',
    aggregateVersion: '4',
    etag: 'subscription-account-01-v4',
    correlationId: 'account-browser-evidence',
    provenance: 'postgres-authority',
    kind: 'subscription-projection',
    subscriptionId: 'subscription-01',
    accountId: 'account-01',
    state: subscriptionState,
    plan: subscriptionState === 'none' || subscriptionState === 'trialing' ? 'free' : 'premium',
    entitlements: subscriptionState === 'active' ? ['premium-actions'] : [],
    currentPeriodEndsAt: '2026-02-15T12:00:00.000Z',
    cancelAtPeriodEnd,
  },
  invoices: [
    {
      schemaVersion: '1.0',
      aggregateVersion: '2',
      etag: 'invoice-invoice-01-v2',
      correlationId: 'account-browser-evidence',
      provenance: 'postgres-authority',
      kind: 'invoice-projection',
      invoiceId: 'invoice-01',
      accountId: 'account-01',
      subscriptionId: 'subscription-01',
      state: invoiceState,
      currency: 'BRL',
      amountDueMinor: '4990',
      amountPaidMinor: invoiceState === 'paid' ? '4990' : '0',
      issuedAt: '2026-01-15T11:00:00.000Z',
      ...(invoiceState === 'paid' ? { settledAt: '2026-01-15T11:01:00.000Z' } : {}),
    },
  ],
  supportCases: [
    {
      schemaVersion: '1.0',
      aggregateVersion: '1',
      etag: 'support-case-01-v1',
      correlationId: 'account-browser-evidence',
      provenance: 'postgres-authority',
      kind: 'support-case-projection',
      supportCaseId: 'case-01',
      accountId: 'account-01',
      state: 'open',
      subjectRedacted: 'First access help',
      auditReference: 'support-audit-case-01',
      createdAt: '2026-01-15T11:10:00.000Z',
      updatedAt: '2026-01-15T11:10:00.000Z',
    },
  ],
  activeDevice: {
    schemaVersion: '1.0',
    aggregateVersion: '5',
    etag: 'device-binding-01-v5',
    correlationId: 'account-browser-evidence',
    provenance: 'device-verified',
    kind: 'device-binding-projection',
    deviceBindingId: 'binding-01',
    accountId: 'account-01',
    state: 'active',
    deviceLabel: 'Astra-PC',
    evidenceVersion: '2',
    boundAt: new Date(Date.now() - 5 * DAY_MS).toISOString(),
    replacementEligibleAt: new Date(Date.now() + 30 * DAY_MS).toISOString(),
  },
});

type AccountProjection = ReturnType<typeof accountProjection>;

const onlyCanonicalAuthorityAxis = (testInfo: TestInfo): void => {
  test.skip(
    testInfo.project.metadata['axis'] !== 'wide-1440',
    'The authority smoke journey has one canonical browser axis.',
  );
};

const expectAccountShell = async (page: Page): Promise<void> => {
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-runtime-class', 'server-authority');
  await expect(page.locator('[data-account-runtime="production"]')).toBeVisible();
};

const fulfillJson = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    body: JSON.stringify(body),
    contentType: 'application/json',
    headers: { etag: '"account-account-01-v7"' },
    status,
  });

const installAccountAuthority = async (
  page: Page,
  options: Readonly<{
    conflict?: boolean;
    projection?: AccountProjection;
  }> = {},
) => {
  let current = options.projection ?? accountProjection();
  const requests: Readonly<{ body: unknown; headers: Record<string, string>; method: string }>[] =
    [];
  await page.route('**/v1/identity/csrf', (route) =>
    fulfillJson(route, { token: 'csrf-browser-evidence-token-abcdefghijklmnopqrstuvwxyz' }),
  );
  await page.route('**/v1/identity/session', (route) =>
    fulfillJson(route, {
      actor: {
        accountId: 'account-01',
        displayName: current.account.displayName,
        email: 'tester@example.com',
        expiresAt: '2030-01-01T00:00:00.000Z',
        locale: current.account.locale,
        role: 'tester',
        sessionId: 'session-01',
        sessionKind: 'web',
      },
    }),
  );
  await page.context().addCookies([
    {
      name: 'liiiraa-csrf',
      url: 'http://account.localhost:3101',
      value: 'csrf-browser-evidence',
    },
  ]);
  await page.route('**/v1/account', async (route) => {
    const request = route.request();
    if (request.method() === 'GET') {
      await fulfillJson(route, current);
      return;
    }
    const body: unknown = request.postDataJSON();
    requests.push({ body, headers: request.headers(), method: request.method() });
    if (options.conflict === true) {
      current = accountProjection({
        accountVersion: '8',
        displayName: 'Remote Player',
        provenance: 'conflict',
      });
      await fulfillJson(
        route,
        { code: 'CONFLICT', localDraftToken: 'server-opaque', ok: false, projection: current },
        409,
      );
      return;
    }
    const candidate = body as {
      patch?: { displayName?: string };
    };
    current = accountProjection({
      accountVersion: '8',
      displayName: candidate.patch?.displayName ?? current.account.displayName,
    });
    await fulfillJson(route, current);
  });
  return { requests };
};

test(`@final @account @authority-smoke [owner:${OWNER_TASK_ID}] projects account authority and returns a versioned profile mutation receipt`, async ({
  page,
}, testInfo) => {
  onlyCanonicalAuthorityAxis(testInfo);
  const authority = await installAccountAuthority(page);
  await page.goto('/en/account/profile');
  await expectAccountShell(page);

  await expect(page.getByRole('region', { name: 'Account authority status' })).toContainText(
    'Connected',
  );
  await page.getByRole('button', { name: 'Edit profile' }).click();
  await page.getByRole('textbox', { name: 'Display name' }).fill('Liiiraa Authority');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('status', { name: 'Profile update receipt' })).toContainText('Saved');

  expect(authority.requests).toHaveLength(1);
  expect(authority.requests[0]?.headers['if-match']).toBe('"account-account-01-v7"');
  expect(authority.requests[0]?.headers['x-csrf-token']).toBe(
    'csrf-browser-evidence-token-abcdefghijklmnopqrstuvwxyz',
  );
  expect(authority.requests[0]?.body).toMatchObject({
    command: { action: 'update-profile', expectedVersion: '7' },
    patch: { displayName: 'Liiiraa Authority', locale: 'en' },
  });
});

test(`@final @account @authority-smoke [owner:${OWNER_TASK_ID}] preserves the active PC when replacement is inside the cooldown`, async ({
  page,
}, testInfo) => {
  onlyCanonicalAuthorityAxis(testInfo);
  const authority = await installAccountAuthority(page);
  await page.goto('/en/account/device');
  await expectAccountShell(page);

  await page.getByRole('button', { name: 'Replace device' }).click();
  await expect(page.getByRole('alert', { name: 'Device replacement unavailable' })).toContainText(
    '30 days',
  );
  await expect(page.getByRole('region', { name: 'Active device' })).toContainText('Active');
  expect(authority.requests).toEqual([]);
});

test(`@final @account @authority-smoke [owner:${OWNER_TASK_ID}] exposes security, commerce, support, consent, and sign-out truth in both locales`, async ({
  page,
}, testInfo) => {
  onlyCanonicalAuthorityAxis(testInfo);
  await installAccountAuthority(page, {
    projection: accountProjection({
      cancelAtPeriodEnd: true,
      invoiceState: 'void',
      provenance: 'pending',
      subscriptionState: 'trialing',
    }),
  });

  for (const locale of ['en', 'pt-BR'] as const) {
    await page.goto(`/${locale}/account/security`);
    await expectAccountShell(page);
    const security = page.getByRole('region', {
      name: locale === 'en' ? 'Security authority' : 'Autoridade de segurança',
    });
    await expect(security).toContainText('Passkey: active');
    await expect(security).toContainText('MFA: active');
    await expect(security).toContainText(
      locale === 'en' ? 'Recovery methods' : 'Métodos de recuperação',
    );

    await page.goto(`/${locale}/account/subscription`);
    await expect(
      page
        .getByRole('region', {
          name: locale === 'en' ? 'Subscription authority' : 'Autoridade da assinatura',
        })
        .getByRole('status'),
    ).toContainText(locale === 'en' ? 'Pending reconciliation' : 'Reconciliação pendente');
    await expect(page.getByRole('main')).toContainText(
      locale === 'en' ? 'Cancellation scheduled' : 'Cancelamento agendado',
    );

    await page.goto(`/${locale}/account/invoices`);
    await expect(
      page.getByRole('region', {
        name: locale === 'en' ? 'Authoritative invoices' : 'Faturas autoritativas',
      }),
    ).toContainText('invoice-01: void');

    await page.goto(`/${locale}/account/support`);
    await expect(
      page.getByRole('region', {
        name: locale === 'en' ? 'Support authority' : 'Autoridade de suporte',
      }),
    ).toContainText('1');

    await page.goto(`/${locale}/account/privacy`);
    await expect(
      page.getByRole('region', {
        name: locale === 'en' ? 'Consent authority' : 'Autoridade de consentimento',
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: locale === 'en' ? 'Sign out' : 'Sair' }),
    ).toBeVisible();
  }
});

test(`@final @account @authority-smoke [owner:${OWNER_TASK_ID}] preserves remote truth, a safe local draft, and degraded observations`, async ({
  page,
}, testInfo) => {
  onlyCanonicalAuthorityAxis(testInfo);
  await installAccountAuthority(page, { conflict: true });
  await page.goto('/en/account/profile');
  await page.getByRole('button', { name: 'Edit profile' }).click();
  await page.getByRole('textbox', { name: 'Display name' }).fill('Safe Local Draft');
  await page.getByRole('button', { name: 'Save changes' }).click();
  const conflict = page.getByRole('alert', { name: 'Profile update conflict' });
  await expect(conflict).toContainText('Remote Player');
  await expect(conflict).toContainText('Safe Local Draft');

  await page.unroute('**/v1/account');
  for (const state of ['stale', 'offline'] as const) {
    await installAccountAuthority(page, { projection: accountProjection({ provenance: state }) });
    await page.goto('/en/account');
    await expect(page.locator('[data-account-state]')).toHaveAttribute('data-account-state', state);
    await expect(page.getByRole('region', { name: 'Account authority status' })).toContainText(
      state === 'stale' ? 'Stale' : 'Offline',
    );
    await page.unroute('**/v1/account');
  }
});
