import { createHmac, randomUUID } from 'node:crypto';

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import {
  createControlPlaneDatabase,
  createPostgresIdentityPersistence,
  createRealIdentityAuthority,
} from '@liiiraa/control-plane-adapters';

const OWNER_TASK_ID = '04-61-01';
const ADMIN_ORIGIN = new URL(
  process.env['ADMIN_STAGING_ORIGIN'] ?? 'https://admin.staging.localhost:3444',
).origin;
const PASSWORD = 'Liiiraa!Admin6101';

const base32Decode = (value: string): Buffer => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const character of value.toUpperCase().replace(/=+$/u, '')) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new Error('INVALID_TOTP_SECRET');
    bits += index.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
    bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
  }
  return Buffer.from(bytes);
};

const totp = (secret: string, now = Date.now()): string => {
  const counter = BigInt(Math.floor(now / 30_000));
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(counter);
  const digest = createHmac('sha1', base32Decode(secret)).update(message).digest();
  const offset = (digest.at(-1) ?? 0) & 0x0f;
  const binary =
    ((digest[offset] ?? 0) & 0x7f) * 0x1_00_00_00 +
    (digest[offset + 1] ?? 0) * 0x1_00_00 +
    (digest[offset + 2] ?? 0) * 0x100 +
    (digest[offset + 3] ?? 0);
  return String(binary % 1_000_000).padStart(6, '0');
};

const expectNoPageOverflow = async (page: Page): Promise<void> => {
  await expect
    .poll(() =>
      page.evaluate(() => ({
        body: document.body.scrollWidth,
        viewport: document.documentElement.clientWidth,
      })),
    )
    .toMatchObject({ body: expect.any(Number), viewport: expect.any(Number) });
  const dimensions = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport + 1);
};

const attachScreenshot = async (page: Page, testInfo: TestInfo, name: string): Promise<void> => {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ animations: 'disabled', fullPage: true, path });
  await testInfo.attach(name, { contentType: 'image/png', path });
};

const expectAdminOverviewReady = async (page: Page): Promise<void> => {
  await expect(page.locator('.admin-production-loading')).toBeHidden({ timeout: 30_000 });
  await expect(page.locator('html')).toHaveAttribute('data-admin-session-state', 'verified', {
    timeout: 30_000,
  });
  const overview = page.locator('[data-admin-overview-state]');
  await expect(overview).toBeVisible({ timeout: 30_000 });
  await expect(overview).not.toHaveAttribute('data-admin-overview-state', /^(?:error|loading)$/u, {
    timeout: 30_000,
  });
  await expect(overview).toHaveAttribute('data-admin-overview-state', 'live', {
    timeout: 30_000,
  });
  await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible();
};

const browserSignUp = async (
  page: Page,
  input: Readonly<{
    displayName: string;
    email: string;
    invitationToken: string;
    password: string;
  }>,
): Promise<Readonly<{ csrfStatus: number; signUpStatus: number }>> =>
  page.evaluate(async (candidate) => {
    const csrf = await fetch('/v1/identity/csrf', {
      cache: 'no-store',
      credentials: 'include',
      headers: { accept: 'application/json' },
    });
    const csrfBody = (await csrf.json()) as { token?: string };
    const signUp = await fetch('/v1/identity/sign-up', {
      body: JSON.stringify({ ...candidate, locale: 'pt-BR' }),
      cache: 'no-store',
      credentials: 'include',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-csrf-token': csrfBody.token ?? '',
      },
      method: 'POST',
    });
    return { csrfStatus: csrf.status, signUpStatus: signUp.status };
  }, input);

const queryAdminFamilies = async (page: Page, paths: readonly string[]) =>
  page.evaluate(async (requestedPaths) => {
    return Promise.all(
      requestedPaths.map(async (path) => {
        const response = await fetch(path, {
          cache: 'no-store',
          credentials: 'include',
          headers: { accept: 'application/json' },
        });
        const body = (await response.json()) as Record<string, unknown>;
        return {
          cacheControl: response.headers.get('cache-control'),
          path,
          records: Array.isArray(body['records']) ? body['records'].length : null,
          status: response.status,
        };
      }),
    );
  }, paths);

const switchAdminFunction = async (
  page: Page,
  input: Readonly<{ actorId: string; sessionId: string }>,
): Promise<Readonly<{ code?: string; status: number }>> =>
  page.evaluate(async (candidate) => {
    const csrf = await fetch('/v1/identity/csrf', {
      cache: 'no-store',
      credentials: 'include',
      headers: { accept: 'application/json' },
    });
    const csrfBody = (await csrf.json()) as { token?: string };
    const now = new Date().toISOString();
    const commandId = `switch-operations-${candidate.sessionId}`.slice(0, 128);
    const response = await fetch('/v1/admin/governance/functions/switch', {
      body: JSON.stringify({
        command: {
          schemaVersion: '1.0',
          kind: 'admin-operation-command',
          commandId,
          actorId: candidate.actorId,
          activeFunction: 'security',
          action: 'update-access',
          targetReferences: [candidate.sessionId],
          reason: 'Switch to Operations for the bounded production authority proof',
          expectedVersion: '1',
          expectedEtag: `admin-${candidate.sessionId}-v1`,
          approvalReferences: [],
          correlationId: 'admin-e2e-switch-operations',
          requestedAt: now,
        },
        targetFunction: 'operations',
      }),
      cache: 'no-store',
      credentials: 'include',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-correlation-id': 'admin-e2e-switch-operations',
        'x-csrf-token': csrfBody.token ?? '',
      },
      method: 'POST',
    });
    const body = (await response.json()) as { code?: string };
    return { code: body.code, status: response.status };
  }, input);

test.describe('real production Admin authority', () => {
  test.describe.configure({ mode: 'serial' });

  const databaseUrl = process.env['STAGING_DATABASE_URL'];
  if (!databaseUrl?.includes('liiiraa_staging')) {
    throw new Error('PRODUCTION_AUTHORITY_REQUIRES_STAGING_DATABASE_URL');
  }
  const database = createControlPlaneDatabase(databaseUrl);
  const email = `admin-e2e-${Date.now()}-${randomUUID().slice(0, 8)}@example.test`;
  let invitationToken = '';

  test.beforeAll(async () => {
    const identity = createRealIdentityAuthority(createPostgresIdentityPersistence(database));
    const invitation = await identity.issueInvitation({
      email,
      expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
      role: 'security',
    });
    invitationToken = invitation.token;
  });

  test.afterAll(async () => {
    await database.close();
  });

  test(`@production-authority @published-authority [owner:${OWNER_TASK_ID}] signs up, enrolls real TOTP, persists authority, and proves the complete Admin matrix`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(5 * 60_000);
    const requests: string[] = [];
    const responses: Readonly<{ status: number; url: string }>[] = [];
    const consoleErrors: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/v1/')) requests.push(request.url());
    });
    page.on('response', (response) => {
      if (response.url().includes('/v1/')) {
        responses.push({ status: response.status(), url: response.url() });
      }
    });
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    await page.goto('/pt-BR/admin');
    await expect(page.locator('html')).toHaveAttribute('data-runtime-class', 'server-authority');
    await expect(page.locator('[data-admin-runtime="production"]')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Entrar no painel administrativo' }),
    ).toBeVisible();

    await expect(
      browserSignUp(page, {
        displayName: 'Admin Evidence 61',
        email,
        invitationToken,
        password: PASSWORD,
      }),
    ).resolves.toEqual({ csrfStatus: 200, signUpStatus: 201 });

    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'Proteja sua conta administrativa' }),
    ).toBeVisible();
    const secret = (await page.locator('.admin-auth__totp-secret').textContent())?.trim() ?? '';
    expect(secret).toMatch(/^[A-Z2-7]{32,}$/u);
    await page
      .getByRole('textbox', { name: 'Código de seis dígitos do autenticador' })
      .fill(totp(secret));
    const confirmationResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith('/v1/identity/strong-auth/totp/confirm') &&
        response.request().method() === 'POST',
      { timeout: 30_000 },
    );
    await page.getByRole('button', { name: 'Ativar acesso protegido ao Admin' }).click();
    const confirmation = await confirmationResponse;
    expect(confirmation.status(), confirmation.statusText()).toBe(200);

    await expect(page.locator('[data-admin-role="security"]')).toBeVisible();
    await page.reload();
    await expect(page.locator('[data-admin-role="security"]')).toBeVisible();

    const securityQueries = await queryAdminFamilies(page, [
      '/v1/admin/governance/team?limit=50',
      '/v1/admin/governance/approvals?limit=50',
    ]);
    const persistedIdentity = await database.query<{
      actor_id: string;
      factor_count: number;
      role: string;
      session_count: number;
      session_id: string;
    }>(
      `SELECT identity.id::text AS actor_id, identity.role,
         COUNT(DISTINCT factor.id)::integer AS factor_count,
         COUNT(DISTINCT session.id)::integer AS session_count,
         MAX(session.id::text) AS session_id
       FROM identities AS identity
       LEFT JOIN security_factors AS factor
         ON factor.identity_id = identity.id AND factor.revoked_at IS NULL
       LEFT JOIN sessions AS session
         ON session.identity_id = identity.id AND session.revoked_at IS NULL
       WHERE lower(identity.email) = lower($1)
       GROUP BY identity.id`,
      [email],
    );
    expect(persistedIdentity.rows[0]).toMatchObject({
      factor_count: 1,
      role: 'security',
      session_count: 1,
    });
    const persistedActor = persistedIdentity.rows[0];
    if (persistedActor === undefined) throw new Error('PERSISTED_ADMIN_IDENTITY_REQUIRED');

    const beforeInvitation = await database.query<{
      audit_count: number;
      invitation_count: number;
      receipt_count: number;
    }>(
      `SELECT
         (SELECT COUNT(*)::integer FROM admin_invitations) AS invitation_count,
         (SELECT COUNT(*)::integer FROM admin_invitation_audit) AS audit_count,
         (SELECT COUNT(*)::integer FROM admin_invitation_receipts) AS receipt_count`,
    );
    await page.goto('/en/admin/people/invitations');
    await expect(page.getByRole('heading', { name: 'Private-beta invitations' })).toBeVisible();
    await expect(page.locator('[data-invitation-state="live"]')).toBeVisible();
    await page.getByRole('button', { name: 'Create invitations' }).click();
    const createInvitations = page.getByRole('region', { name: 'Create invitations' });
    await expect(createInvitations).toBeVisible();
    const recipient = `friend-${Date.now()}@example.test`;
    await createInvitations.getByRole('textbox', { name: 'Recipient email' }).fill(recipient);
    await createInvitations
      .getByRole('textbox', { name: 'Campaign reference' })
      .fill('admin-e2e-04-61');
    await createInvitations
      .getByRole('textbox', { name: 'Operational reason' })
      .fill('Validate durable invitation delivery authority');
    await createInvitations.getByRole('button', { name: 'Run preflight' }).click();
    let stepUp = page.getByRole('dialog', { name: 'Verify critical operation' });
    await expect(stepUp).toBeVisible();
    await stepUp.getByRole('textbox', { name: 'Six-digit authenticator code' }).fill(totp(secret));
    await stepUp.getByRole('button', { name: 'Verify with a strong credential' }).click();
    await expect(page.getByRole('region', { name: 'Preflight review' })).toBeVisible();

    await createInvitations.getByRole('button', { name: 'Issue reviewed invitations' }).click();
    stepUp = page.getByRole('dialog', { name: 'Verify critical operation' });
    await expect(stepUp).toBeVisible();
    await stepUp
      .getByRole('textbox', { name: 'Six-digit authenticator code' })
      .fill(totp(secret, Date.now() + 30_000));
    const issueResponsePromise = page.waitForResponse(
      (response) => {
        const url = new URL(response.url());
        return response.request().method() === 'POST' && url.pathname === '/v1/admin/invitations';
      },
      { timeout: 30_000 },
    );
    await stepUp.getByRole('button', { name: 'Verify with a strong credential' }).click();
    await expect(stepUp).toBeHidden();
    const issueResponse = await issueResponsePromise;
    expect(issueResponse.status()).toBe(201);
    await expect(
      page.getByRole('alert').filter({ hasText: 'Invitation operation failed' }),
    ).toBeHidden();
    await expect(page.getByRole('status').filter({ hasText: 'Operation recorded' })).toBeVisible();

    const durableInvitation = await database.query<{
      audit_count: number;
      invitation_count: number;
      receipt_count: number;
    }>(
      `SELECT
         (SELECT COUNT(*)::integer FROM admin_invitations) AS invitation_count,
         (SELECT COUNT(*)::integer FROM admin_invitation_audit) AS audit_count,
         (SELECT COUNT(*)::integer FROM admin_invitation_receipts) AS receipt_count`,
    );
    expect(durableInvitation.rows[0]).toEqual({
      audit_count: beforeInvitation.rows[0]!.audit_count + 1,
      invitation_count: beforeInvitation.rows[0]!.invitation_count + 1,
      receipt_count: beforeInvitation.rows[0]!.receipt_count + 1,
    });

    await expect(
      switchAdminFunction(page, {
        actorId: persistedActor.actor_id,
        sessionId: persistedActor.session_id,
      }),
    ).resolves.toEqual({ code: undefined, status: 200 });
    await page.goto('/en/admin/overview');
    await expect(
      page.getByRole('group').filter({ hasText: 'Admin session' }).getByText('Operations', {
        exact: true,
      }),
    ).toBeVisible();

    const operationsQueries = await queryAdminFamilies(page, [
      '/v1/admin/invitations?limit=50',
      '/v1/admin/operations/jobs?environment=staging&limit=50',
      '/v1/admin/operations/search?environment=staging&limit=50&q=e2e',
      '/v1/admin/operations/incidents?environment=staging&limit=50',
      '/v1/admin/operations/configurations?environment=staging&limit=50',
      '/v1/admin/operations/privacy-cases?environment=staging&limit=50',
      '/v1/admin/operations/emergency-stops?environment=staging&limit=50',
      '/v1/admin/operations/audit-events?environment=staging&limit=50',
    ]);
    const queryResults = [...securityQueries, ...operationsQueries];
    expect(queryResults.map(({ path }) => path)).toHaveLength(10);
    for (const result of queryResults) {
      expect(result.status, result.path).toBe(200);
      expect(result.cacheControl, result.path).toContain('no-store');
      expect(result.records, result.path).not.toBeNull();
    }

    const viewportMatrix = [
      { height: 1000, width: 1600 },
      { height: 800, width: 1280 },
      { height: 768, width: 1024 },
      { height: 1024, width: 768 },
      { height: 844, width: 390 },
      { height: 568, width: 320 },
    ] as const;
    for (const viewport of viewportMatrix) {
      await page.setViewportSize(viewport);
      await page.goto('/en/admin/overview');
      await expectAdminOverviewReady(page);
      await expectNoPageOverflow(page);
      await attachScreenshot(page, testInfo, `admin-${viewport.width}x${viewport.height}`);
    }

    await page.setViewportSize({ height: 568, width: 320 });
    const textScale = await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
      return Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    });
    expect(textScale).toBeGreaterThanOrEqual(32);
    await expectAdminOverviewReady(page);
    await expectNoPageOverflow(page);
    await attachScreenshot(page, testInfo, 'admin-320x568-200-percent-text');

    await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
    await page.reload();
    await expectAdminOverviewReady(page);
    await expectNoPageOverflow(page);
    await attachScreenshot(page, testInfo, 'admin-320x568-forced-colors-reduced-motion');

    const accessibility = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(accessibility.violations).toEqual([]);

    const runtimeGuards = await page.evaluate(() => ({
      mockServiceWorker: 'MockServiceWorker' in globalThis,
      serviceWorkerControlled: navigator.serviceWorker.controller !== null,
    }));
    expect(runtimeGuards).toEqual({ mockServiceWorker: false, serviceWorkerControlled: false });
    expect(requests.some((url) => url.includes('/v1/admin/operations/live'))).toBe(true);
    expect(responses.some(({ status }) => status >= 500)).toBe(false);
    const unexpectedConsoleErrors = consoleErrors.filter(
      (message) =>
        !/^Failed to load resource: the server responded with a status of 4\d\d \([^)]*\)$/u.test(
          message,
        ),
    );
    expect(unexpectedConsoleErrors).toEqual([]);
    expect(new URL(page.url()).origin).toBe(ADMIN_ORIGIN);
  });
});
