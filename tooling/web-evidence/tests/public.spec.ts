import { readFileSync } from 'node:fs';

import { expect, test, type Page, type TestInfo } from '@playwright/test';

type Scenario = Readonly<{
  id: string;
  locale: 'pt-BR' | 'en';
  requiredRouteIds: readonly string[];
  routeId: string;
  terminalState: string;
}>;

const scenarios = (
  JSON.parse(
    readFileSync(new URL('../../../contracts/scenarios/web-scenarios.json', import.meta.url), 'utf8'),
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
  const deadLinks = await page.locator('a').evaluateAll((links) =>
    links
      .map((link) => link.getAttribute('href'))
      .filter((href) => href === null || href.trim() === '' || href === '#' || href.startsWith('javascript:')),
  );
  expect(deadLinks).toEqual([]);
};

const expectScenarioRoutesCanonical = (id: string) => {
  const record = scenario(id);
  expect(canonicalRouteIds.has(record.routeId)).toBe(true);
  expect(record.requiredRouteIds.every((routeId) => canonicalRouteIds.has(routeId))).toBe(true);
};

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
  await expect(page.getByRole('link', { name: 'Verificar compatibilidade', exact: true }).first()).toBeVisible();
  await expect(page.getByRole('note').filter({ hasText: 'Superfície pública' })).toBeVisible();
  await expect(page.locator('.public-home')).toHaveAttribute('data-capture-state', 'CAPTURE_ADMITTED');
  await expect(page.getByRole('link', { name: /captura completa/i })).toHaveAttribute(
    'href',
    /desktop-home\.pt-BR\.webp$/u,
  );
  await expect(page.locator('.home-chapter')).toHaveCount(6);
  await expect(page.getByText('Download público ainda não disponível', { exact: true })).toBeVisible();
  await expect(page.locator('a[href$=".exe"], a[href*="target/release"], a[href*="self-signed"]')).toHaveCount(0);
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
  await expect(menu.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link')).toHaveCount(6);
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
  await expect(page.getByLabel(/Search product, evidence, compatibility, plans, and support/u)).toHaveValue(
    'no-such-trusted-record',
  );
  await expect(page.getByLabel('Availability')).toHaveValue('available');
  await expect(page.getByRole('heading', { name: 'No trusted results' })).toBeVisible();
  await expect(page.locator('main')).not.toContainText(/account-preview|admin-|SIMULATED SCENARIO/iu);

  await page.getByLabel(/Search product, evidence, compatibility, plans, and support/u).fill('compatibility');
  await page.getByLabel('Availability').selectOption('');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page).toHaveURL(/q=compatibility/u);
  await expect(page.getByRole('link', { name: 'One compatibility flow, explicit limits' })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/q=no-such-trusted-record&availability=available$/u);
  await page.reload();
  await expect(page.getByLabel(/Search product, evidence, compatibility, plans, and support/u)).toHaveValue(
    'no-such-trusted-record',
  );
  await page.goForward();
  await expect(page).toHaveURL(/q=compatibility&availability=$/u);
  await page.reload();
  await expect(page.getByLabel(/Search product, evidence, compatibility, plans, and support/u)).toHaveValue(
    'compatibility',
  );
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

  const states = [
    ['/pt-BR/rota-inexistente', '404', /não encontrada/iu],
    ['/pt-BR/forbidden', '403', /outra permissão/iu],
    ['/pt-BR/gone', '410', /retirado/iu],
    ['/pt-BR/errors/500', '500', /não foi possível concluir/iu],
  ] as const;

  const headings = new Set<string>();
  for (const [path, code, title] of states) {
    await page.goto(path);
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
    await expect(page.locator('main')).toContainText(code);
    await expect(page.locator('main')).not.toContainText(/stack|node_modules|C:\\|src\//u);
    headings.add((await page.getByRole('heading', { level: 1 }).textContent()) ?? '');
  }
  expect(headings.size).toBe(states.length);
});
