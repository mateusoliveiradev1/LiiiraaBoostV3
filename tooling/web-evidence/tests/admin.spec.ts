import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { expect, test, type Page, type TestInfo } from '@playwright/test';

import {
  routeReachabilityTargets,
  writeRouteReachabilityEvidence,
  type RouteReachabilityObservation,
} from '../src/route-reachability.js';

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));

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

const expectNoDeadControls = async (page: Page) => {
  const deadLinks = await page
    .locator('a')
    .evaluateAll((links) =>
      links
        .map((link) => link.getAttribute('href'))
        .filter(
          (href) =>
            href === null || href.trim() === '' || href === '#' || href.startsWith('javascript:'),
        ),
    );
  expect(deadLinks).toEqual([]);
};

const advanceButtonWorkflow = async (page: Page) => {
  await page.getByRole('button', { name: 'Check details' }).click();
  await page.getByRole('button', { name: 'Check details' }).click();
  await page.getByRole('button', { name: 'Continue to confirmation' }).click();
  await page.getByRole('button', { name: 'Continue without verifying a credential' }).click();
};

test('@final @admin navigation and language preserve the active audit role', async ({
  page,
}, testInfo) => {
  onlyAxis(testInfo, 'wide-1440');
  await page.goto('/en/admin/audit?role=audit');

  const current = page.locator('a[aria-current="page"]:visible');
  await expect(current).toHaveCount(1);
  await expect(current).toContainText('Audit');

  const locale = page.locator('a.lb-web-locale-switcher:visible');
  await expect(locale).toHaveCount(1);
  await expect(locale).toHaveAccessibleName('Switch language to Português');
  await expect(locale.locator('[data-locale-flag="br"]')).toHaveCount(1);
  await expect(locale).toContainText('Português');
  await expect(locale).toHaveAttribute('href', '/pt-BR/admin/audit?role=audit');

  await locale.click();
  await expect(page).toHaveURL(/\/pt-BR\/admin\/audit\?role=audit$/u);
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
  await expect(page.locator('a[aria-current="page"]:visible')).toHaveCount(1);
});

test('@final @admin geometry preserves the 72 280 focal queue workspace', async ({
  page,
}, testInfo) => {
  onlyAxis(testInfo, 'wide-1440');
  await page.goto('/en/admin?role=operations');

  expect((await page.locator('.admin-header__bar').boundingBox())?.height).toBe(72);
  expect((await page.locator('.admin-nav__desktop').boundingBox())?.width).toBe(280);
  await expect(page.locator('.admin-preview-band')).toHaveCount(0);
  expect(
    Number.parseFloat(
      await page.locator('main h1').evaluate((node) => getComputedStyle(node).fontSize),
    ),
  ).toBe(32);
  await expect(page.locator('[data-admin-grid="8-4"]')).toBeVisible();
  const gridColumns = await page
    .locator('[data-admin-grid="8-4"]')
    .evaluate((node) =>
      getComputedStyle(node).gridTemplateColumns.split(' ').map(Number.parseFloat),
    );
  expect(gridColumns[0] / gridColumns[1]).toBeGreaterThanOrEqual(1.95);
  await expect(page.locator('.admin-landing__queue')).toBeVisible();
  const queueTable = page.getByRole('table', {
    name: 'Role-permitted work ordered by priority, SLA, and age',
  });
  await expect(queueTable).toBeVisible();
  await expect(queueTable.getByRole('columnheader', { name: 'Status' })).toBeVisible();
  await expect(queueTable.getByRole('cell', { name: 'Blocked', exact: true })).toBeVisible();
  await expect(page.locator('.admin-nav__desktop a[aria-current="page"]')).toContainText(
    'Role workspace',
  );
});

for (const axis of ['mobile-390', 'reflow-320'] as const) {
  test(`@final @admin compact navigation is closed and keyboard-operable at ${axis}`, async ({
    page,
  }, testInfo) => {
    onlyAxis(testInfo, axis);
    await page.goto('/en/admin/support/case-preview?role=support');

    const disclosure = page.locator('details.admin-nav__mobile');
    await expect(disclosure).not.toHaveAttribute('open', '');
    expect((await page.locator('.admin-header__bar').boundingBox())?.height).toBe(60);
    expect((await disclosure.locator('summary').boundingBox())?.height).toBeGreaterThanOrEqual(48);
    expect(
      (await page.locator('.admin-header .lb-web-locale-switcher').boundingBox())?.height,
    ).toBeGreaterThanOrEqual(48);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      await page.evaluate(() => document.documentElement.clientWidth),
    );
    await expect(page.locator('a[aria-current="page"]')).toHaveCount(1);
    await expect(page.locator('[data-high-risk-action="true"]')).toBeHidden();
    await expect(disclosure.locator('summary')).toContainText('Support case');
    await expect(disclosure.getByRole('link')).toBeHidden();

    await disclosure.locator('summary').focus();
    await expect(disclosure.locator('summary')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(disclosure).toHaveAttribute('open', '');
    await expect(
      disclosure.getByRole('link', { name: 'Role workspace', exact: true }),
    ).toBeVisible();
  });
}

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
  await page.getByRole('button', { name: 'Cancel' }).click();
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
  await expect(
    page.getByRole('heading', { name: 'Acesso ao diagnóstico bloqueado' }),
  ).toBeVisible();
  await expect(page.locator('main')).toContainText('startup-state, application-version');
  await expect(page.locator('main')).toContainText('security.operator');
  await expect(page.locator('main')).toContainText('audit-consent-015');
  await expect(page.locator('main')).not.toContainText('synthetic-ready');
  await expect(page.locator('[data-high-risk-action="true"]')).toHaveCount(0);
});

test('@final @admin W16 preserves safe mobile review while hiding high-risk authority', async ({
  page,
}, testInfo) => {
  onlyAxis(testInfo, 'mobile-390');
  await page.goto('/en/admin/operations/review-preview?role=operations');
  await expect(page.getByRole('heading', { level: 1, name: 'Publication held' })).toBeVisible();
  await expect(
    page.getByText(/Check the impact and confirm the review when you are ready/iu),
  ).toBeVisible();
  const safeReview = page.locator('[data-high-risk-action="true"]');
  await expect(safeReview).toBeVisible();
  await expect(safeReview.getByRole('button', { name: 'Review publication hold' })).toBeVisible();
  const unavailableAuthority = page.getByRole('region', {
    name: 'Publication channel unavailable',
  });
  await expect(unavailableAuthority).toHaveAttribute('data-authority-state', 'disconnected');
  await expect(unavailableAuthority).toHaveAttribute('data-authority-action', 'unavailable');
  await expect(
    unavailableAuthority.getByRole('button', { name: 'Retain publication hold — unavailable' }),
  ).toBeDisabled();
  await expect(page.locator('main')).toContainText('Deployment target ••••-017');
});

test('@final @admin W17 keeps admin errors distinct, localized, and redacted', async ({
  page,
}, testInfo) => {
  onlyAxis(testInfo, 'desktop-960');
  const expectedTitles = {
    'en:403': 'Administrative access is not permitted',
    'en:404': 'Administrative area not found',
    'en:410': 'The administrative reference is no longer available',
    'en:500': 'The administrative area encountered a failure',
    'pt-BR:403': 'Acesso administrativo não permitido',
    'pt-BR:404': 'Área administrativa não encontrada',
    'pt-BR:410': 'A referência administrativa não está mais disponível',
    'pt-BR:500': 'A área administrativa encontrou uma falha',
  } as const;
  const sensitiveDiagnostic =
    /(?:node_modules|at\s+[A-Za-z_$][\w$]*\s*\(|[A-Za-z]:\\(?:Users|src)\\|\/(?:Users|home)\/|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|Bearer\s+[A-Za-z0-9._~-]+|"(?:password|authorization|cookie)"\s*:)/iu;
  const observations: RouteReachabilityObservation[] = [];
  const headings = new Map<string, Set<string>>();
  const mutations = mutationRequests(page);

  for (const target of routeReachabilityTargets('admin')) {
    const response = await page.goto(target.pathname, { waitUntil: 'domcontentloaded' });
    expect(response).not.toBeNull();
    const responseStatus = response?.status() ?? 0;
    expect(responseStatus).toBe(target.semanticStatus === 404 ? 404 : 200);
    expect(response?.request().redirectedFrom()).toBeNull();
    expect(new URL(page.url()).pathname).toBe(target.pathname);
    await expect(page.locator('html')).toHaveAttribute('lang', target.locale);
    await expect(page.locator('.admin-failure__code')).toHaveText(String(target.semanticStatus));

    const heading = page.getByRole('heading', { level: 1 });
    const expectedTitle = expectedTitles[`${target.locale}:${target.semanticStatus}`];
    await expect(heading).toHaveText(expectedTitle);
    const title = (await heading.textContent())?.trim() ?? '';
    const localizedHeadings = headings.get(target.routeId) ?? new Set<string>();
    localizedHeadings.add(title);
    headings.set(target.routeId, localizedHeadings);

    const main = page.locator('main');
    const mainText = (await main.innerText()).replace(/\s+/gu, ' ').trim().slice(0, 4096);
    expect(mainText).not.toMatch(sensitiveDiagnostic);
    await expect(page.locator('.admin-failure__correlation')).toContainText(
      new RegExp(`LB-ADM-${String(target.semanticStatus)}-REDACTED`, 'u'),
    );
    await expect(page.locator('[data-authoritative-access-connected="false"]')).not.toHaveCount(0);
    await expect(page.locator('[data-authoritative-access-connected="true"]')).toHaveCount(0);

    const recoveryLinks = page.locator('.admin-failure__actions a');
    expect(await recoveryLinks.count()).toBe(1);
    const recoveryHref = await recoveryLinks.first().getAttribute('href');
    expect(recoveryHref).not.toBeNull();
    const recovery = new URL(recoveryHref ?? '', page.url());
    expect(recovery.origin).toBe(new URL(page.url()).origin);
    expect(recovery.pathname).toBe(`/${target.locale}/admin`);
    expect(recovery.search).toBe('');
    await expectNoDeadControls(page);

    observations.push({
      authorityConnected: false,
      contentSha256: createHash('sha256').update(JSON.stringify({ mainText, title })).digest('hex'),
      diagnosticsRedacted: true,
      locale: target.locale,
      localePreserved: true,
      pathname: target.pathname,
      recoveryValid: true,
      redirected: false,
      responseStatus,
      routeId: target.routeId,
      semanticStatus: target.semanticStatus,
      surface: target.surface,
    });
  }

  expect([...headings.values()].every((localized) => localized.size === 2)).toBe(true);
  expect(mutations).toEqual([]);
  writeRouteReachabilityEvidence({ observations, repositoryRoot, surface: 'admin' });
});
