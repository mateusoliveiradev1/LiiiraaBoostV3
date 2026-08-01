import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, test, type Page, type TestInfo } from '@playwright/test';

import {
  routeReachabilityTargets,
  writeRouteReachabilityEvidence,
  type RouteReachabilityObservation,
} from '../src/route-reachability.js';

type Scenario = Readonly<{
  id: string;
  locale: 'pt-BR' | 'en';
  requiredRouteIds: readonly string[];
  routeId: string;
  terminalState: string;
}>;

const scenarios = (
  JSON.parse(
    readFileSync(
      new URL('../../../contracts/scenarios/web-scenarios.json', import.meta.url),
      'utf8',
    ),
  ) as Readonly<{ scenarios: readonly Scenario[] }>
).scenarios;
const canonicalRouteSource = readFileSync(
  new URL('../../../packages/web-core/src/routes.ts', import.meta.url),
  'utf8',
);
const canonicalRouteIds = new Set(
  [...canonicalRouteSource.matchAll(/(?:public|account|admin)Route\('([^']+)'/gu)].map(
    (match) => match[1],
  ),
);
const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));

const scenario = (id: string): Scenario => {
  const value = scenarios.find((candidate) => candidate.id === id);
  if (value === undefined) throw new Error(`Missing canonical web scenario: ${id}`);
  return value;
};

const onlyAxis = (testInfo: TestInfo, axis: string) => {
  test.skip(testInfo.project.metadata['axis'] !== axis, `Covered by the ${axis} project.`);
};

const gotoWithRecoverableRetry = async (page: Page, path: string) => {
  let response = await page.goto(path, { waitUntil: 'domcontentloaded' });
  if (
    (response !== null && response.status() >= 500) ||
    (await page.locator('#public-failure-500-title').count()) > 0
  ) {
    response = await page.reload({ waitUntil: 'domcontentloaded' });
  }
  expect(response?.status()).toBeLessThan(500);
  await expect(page.locator('#public-failure-500-title')).toHaveCount(0);
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

const expectScenarioRoutesCanonical = (id: string) => {
  const record = scenario(id);
  expect(canonicalRouteIds.has(record.routeId)).toBe(true);
  expect(record.requiredRouteIds.every((routeId) => canonicalRouteIds.has(routeId))).toBe(true);
};

test('@final @public navigation and language preserve the active documentation route', async ({
  page,
}, testInfo) => {
  onlyAxis(testInfo, 'wide-1440');
  await gotoWithRecoverableRetry(page, '/en/docs/current');

  const current = page.locator(
    'nav.public-navigation--desktop:visible a[aria-current="page"]',
  );
  await expect(current).toHaveCount(1);
  await expect(current).toContainText('Documentation');

  const locale = page.locator('a.lb-web-locale-switcher:visible');
  await expect(locale).toHaveCount(1);
  await expect(locale).toHaveAccessibleName('Switch language to Português');
  await expect(locale).toContainText('🇧🇷');
  await expect(locale).toContainText('Português');
  await expect(locale).toHaveAttribute('href', '/pt-BR/docs/current');

  await locale.click();
  await expect(page).toHaveURL(/\/pt-BR\/docs\/current$/u);
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
  await expect(
    page.locator('nav.public-navigation--desktop:visible a[aria-current="page"]'),
  ).toHaveCount(1);
});

test('@final @public Cobalt Ignition Bay geometry keeps the focal product above the fold', async ({
  page,
}, testInfo) => {
  onlyAxis(testInfo, 'wide-1440');
  await gotoWithRecoverableRetry(page, '/en');

  const header = await page.locator('.public-header__bar').boundingBox();
  const heading = page.getByRole('heading', { level: 1 });
  const stage = await page.locator('.home-ignition-hero__stage').boundingBox();
  expect(header?.height).toBe(72);
  const headingSize = Number.parseFloat(await heading.evaluate((node) => getComputedStyle(node).fontSize));
  expect(headingSize).toBeGreaterThanOrEqual(52);
  expect(headingSize).toBeLessThanOrEqual(76);
  expect(stage).not.toBeNull();
  expect(stage?.width).toBeGreaterThanOrEqual(1_000);
  expect(Math.abs((stage?.x ?? 0) + (stage?.width ?? 0) / 2 - 720)).toBeLessThanOrEqual(2);
  expect(stage?.y).toBeLessThanOrEqual(560);
  expect(Math.min((stage?.y ?? 0) + (stage?.height ?? 0), 900) - Math.max(stage?.y ?? 0, 0)).toBeGreaterThanOrEqual(260);
});

for (const axis of ['mobile-390', 'reflow-320'] as const) {
  test(`@final @public mobile geometry navigation locale and reflow close at ${axis}`, async ({
    page,
  }, testInfo) => {
    onlyAxis(testInfo, axis);
    await gotoWithRecoverableRetry(page, '/en');

    expect((await page.locator('.public-header__bar').boundingBox())?.height).toBe(60);
    const disclosure = page.locator('details.public-mobile-menu');
    await expect(disclosure).not.toHaveAttribute('open', '');
    expect((await disclosure.locator('summary').boundingBox())?.height).toBeGreaterThanOrEqual(48);
    const locale = page.locator('.public-mobile-locale .lb-web-locale-switcher');
    expect((await locale.boundingBox())?.height).toBeGreaterThanOrEqual(48);
    await expect(locale).toContainText('Português');
    await expect(locale).toHaveAttribute('href', '/pt-BR');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      await page.evaluate(() => document.documentElement.clientWidth),
    );
    await disclosure.locator('summary').click();
    await expect(page.locator('a[aria-current="page"]:visible')).toHaveCount(1);
    await expect(page.locator('[data-high-risk-action="true"]')).toHaveCount(0);
  });
}

test('@final @public W01 keeps the PT-BR command runway truthful and distribution gated', async ({
  page,
}, testInfo) => {
  onlyAxis(testInfo, 'wide-1440');
  expectScenarioRoutesCanonical('W01');

  await gotoWithRecoverableRetry(page, '/pt-BR');

  await expect(page.locator('main')).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Prepare seu PC. Prove o resultado. Restaure com controle.',
  );
  await expect(
    page.getByRole('link', { name: 'Verificar compatibilidade', exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole('note').filter({ hasText: 'O que esta captura comprova' }),
  ).toBeVisible();
  await expect(page.locator('.public-boundary')).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText(/Superfície pública|\bPUBLIC\b/u);
  await expect(page.locator('.public-home')).toHaveAttribute(
    'data-capture-state',
    'CAPTURE_ADMITTED',
  );
  await expect(page.getByRole('link', { name: /captura completa/i })).toHaveAttribute(
    'href',
    /desktop-home\.pt-BR\.webp$/u,
  );
  await expect(page.locator('.home-chapter')).toHaveCount(6);
  await expect(
    page.getByText('Download público ainda não disponível', { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator('a[href$=".exe"], a[href*="target/release"], a[href*="self-signed"]'),
  ).toHaveCount(0);
  await expectNoDeadControls(page);
});

test('@final @public W02 preserves the complete English mobile hierarchy and menu', async ({
  page,
}, testInfo) => {
  onlyAxis(testInfo, 'mobile-390');
  expectScenarioRoutesCanonical('W02');

  await gotoWithRecoverableRetry(page, '/en');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Prepare your PC. Prove result. Restore control.',
  );
  const menu = page.locator('details.public-mobile-menu');
  await menu.locator('summary').click();
  await expect(menu).toHaveAttribute('open', '');
  await expect(
    menu.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link'),
  ).toHaveCount(6);
  await expect(menu.getByRole('link', { name: 'Search' })).toBeVisible();
  await expect(menu.getByRole('link', { name: 'Português' })).toBeVisible();
  await expect(page.getByRole('link', { name: /complete screenshot/i })).toBeVisible();
  await expectNoDeadControls(page);
});

test('@final @public W06 keeps search and filters URL-addressable without private results', async ({
  page,
}, testInfo) => {
  onlyAxis(testInfo, 'desktop-960');
  expectScenarioRoutesCanonical('W06');

  await page.goto('/en/search?q=no-such-trusted-record&availability=available');
  await expect(page).toHaveURL(/\/en\/search\?q=no-such-trusted-record&availability=available$/u);
  await expect(
    page.getByLabel(/Search product, evidence, compatibility, plans, and support/u),
  ).toHaveValue('no-such-trusted-record');
  await expect(page.getByLabel('Availability')).toHaveValue('available');
  await expect(page.getByRole('heading', { name: 'No trusted results' })).toBeVisible();
  await expect(page.locator('main')).not.toContainText(
    /account-preview|admin-|SIMULATED SCENARIO/iu,
  );

  await page
    .getByLabel(/Search product, evidence, compatibility, plans, and support/u)
    .fill('compatibility');
  await page.getByLabel('Availability').selectOption('');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page).toHaveURL(/q=compatibility/u);
  await expect(
    page.getByRole('link', { name: 'One compatibility flow, explicit limits' }),
  ).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/q=no-such-trusted-record&availability=available$/u);
  await page.reload();
  await expect(
    page.getByLabel(/Search product, evidence, compatibility, plans, and support/u),
  ).toHaveValue('no-such-trusted-record');
  await page.goForward();
  await expect(page).toHaveURL(/q=compatibility&availability=$/u);
  await page.reload();
  await expect(
    page.getByLabel(/Search product, evidence, compatibility, plans, and support/u),
  ).toHaveValue('compatibility');
  await expectNoDeadControls(page);
});

test('@final @public W09 identifies unavailable capabilities while public content and docs remain reachable', async ({
  page,
}, testInfo) => {
  onlyAxis(testInfo, 'wide-1280');
  expectScenarioRoutesCanonical('W09');

  await page.goto('/pt-BR/status');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('[data-state]')).not.toHaveCount(0);
  await expect(page.locator('main')).toContainText(/Download|conta|otimização nativa/iu);
  await expect(page.getByRole('link', { name: 'Documentação', exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Suporte', exact: true }).last()).toBeVisible();
  await expectNoDeadControls(page);
});

test('@final @public W17 exposes distinct localized and redacted public error states', async ({
  page,
}, testInfo) => {
  onlyAxis(testInfo, 'desktop-960');
  expectScenarioRoutesCanonical('W17');

  const expectedTitles = {
    'en:403': 'This resource requires another permission',
    'en:404': 'Page not found',
    'en:410': 'This content has been retired',
    'en:500': 'The request could not be completed',
    'pt-BR:403': 'Este recurso exige outra permissão',
    'pt-BR:404': 'Página não encontrada',
    'pt-BR:410': 'Este conteúdo foi retirado',
    'pt-BR:500': 'Não foi possível concluir',
  } as const;
  const sensitiveDiagnostic =
    /(?:node_modules|at\s+[A-Za-z_$][\w$]*\s*\(|[A-Za-z]:\\(?:Users|src)\\|\/(?:Users|home)\/|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|Bearer\s+[A-Za-z0-9._~-]+|"(?:password|authorization|cookie)"\s*:)/iu;
  const observations: RouteReachabilityObservation[] = [];
  const headings = new Map<string, Set<string>>();
  const mutationRequests: string[] = [];
  page.on('request', (request) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      mutationRequests.push(`${request.method()} ${request.url()}`);
    }
  });

  for (const target of routeReachabilityTargets('public')) {
    const response = await page.goto(target.pathname, { waitUntil: 'domcontentloaded' });
    expect(response).not.toBeNull();
    const responseStatus = response?.status() ?? 0;
    expect(responseStatus).toBe(target.semanticStatus === 404 ? 404 : 200);
    expect(response?.request().redirectedFrom()).toBeNull();
    expect(new URL(page.url()).pathname).toBe(target.pathname);
    await expect(page.locator('html')).toHaveAttribute('lang', target.locale);
    await expect(page.locator('.public-not-found__identity > span')).toHaveText(
      String(target.semanticStatus),
    );
    await expect(page.locator('.public-not-found__identity code')).toHaveText(target.routeId);

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
    await expect(page.locator('.public-not-found__diagnostic code')).toHaveText(
      /^LB-WEB-(?:404|(?:403|410|500)-REDACTED)$/u,
    );
    await expect(page.locator('[data-authority-connected="true"]')).toHaveCount(0);

    const recoveryLinks = page.locator('.public-not-found__actions a');
    expect(await recoveryLinks.count()).toBeGreaterThan(0);
    const recoveryHrefs = await recoveryLinks.evaluateAll((links) =>
      links.map((link) => (link as HTMLAnchorElement).href),
    );
    expect(
      recoveryHrefs.every((href) => {
        const recovery = new URL(href);
        return recovery.pathname.startsWith(`/${target.locale}`) && recovery.search === '';
      }),
    ).toBe(true);
    expect(recoveryHrefs.some((href) => new URL(href).origin === new URL(page.url()).origin)).toBe(
      true,
    );
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
  expect(mutationRequests).toEqual([]);
  writeRouteReachabilityEvidence({ observations, repositoryRoot, surface: 'public' });
});
