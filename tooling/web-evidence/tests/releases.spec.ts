import { readFileSync } from 'node:fs';

import { expect, test, type Page, type TestInfo } from '@playwright/test';

type Scenario = Readonly<{ id: string; requiredRouteIds: readonly string[]; routeId: string }>;
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

const onlyAxis = (testInfo: TestInfo, axis: string) => {
  test.skip(testInfo.project.metadata['axis'] !== axis, `Covered by the ${axis} project.`);
};

const assertScenarioParity = (id: string) => {
  const value = scenarios.find((candidate) => candidate.id === id);
  if (value === undefined) throw new Error(`Missing scenario ${id}`);
  expect(canonicalRouteIds.has(value.routeId)).toBe(true);
  expect(value.requiredRouteIds.every((routeId) => canonicalRouteIds.has(routeId))).toBe(true);
};

const assertNoExecutableArtifact = async (page: Page) => {
  const hrefs = await page.locator('a').evaluateAll((links) =>
    links.map((link) => link.getAttribute('href') ?? ''),
  );
  expect(hrefs.some((href) => /\.(?:exe|msi|msix)(?:$|\?)/iu.test(href))).toBe(false);
  expect(hrefs.some((href) => /target\/release|self-signed|development-installer/iu.test(href))).toBe(false);
  expect(hrefs.some((href) => href === '' || href === '#' || href.startsWith('javascript:'))).toBe(false);
};

test('@final @public W07 renders a complete demonstrative manifest and a terminal download gate', async ({
  page,
}, testInfo) => {
  onlyAxis(testInfo, 'wide-1440');
  assertScenarioParity('W07');

  await page.goto('/pt-BR/download/stable/current');
  await expect(page.locator('[data-release-route="releases-download"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ainda não há um instalador público' })).toBeVisible();
  await expect(page.locator('.lb-web-manifest')).toContainText(/SHA-256|Authenticode|publisher|publicDistributionApproved/iu);
  await expect(page.locator('p[aria-live="assertive"]')).toContainText(
    /Não use espelhos|instaladores de desenvolvimento|terceiros/iu,
  );
  const terminalGate = page.getByRole('alert').filter({
    has: page.getByRole('heading', { name: 'Ainda não há um instalador público', exact: true }),
  });
  const terminalActions = terminalGate.getByRole('navigation', {
    name: 'Ainda não há um instalador público',
    exact: true,
  });
  await expect(
    terminalActions.getByRole('link', { name: 'Checar meu PC', exact: true }),
  ).toBeVisible();
  const terminalActionHrefs = await terminalActions.getByRole('link').evaluateAll((links) =>
    links.map((link) => link.getAttribute('href')),
  );
  expect(terminalActionHrefs).toEqual([
    '/pt-BR/compatibility',
    '/pt-BR/releases',
    '/pt-BR/support',
  ]);
  await assertNoExecutableArtifact(page);
});

test('@final @public W08 blocks every integrity disagreement without bypass', async ({
  page,
}, testInfo) => {
  onlyAxis(testInfo, 'wide-1440');
  assertScenarioParity('W08');

  await page.goto('/en/releases/stable/current/integrity');
  await expect(page.locator('[data-release-route="releases-integrity"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Every integrity disagreement blocks download' })).toBeVisible();
  await expect(page.getByText('There is no continue-anyway action. Close the artifact, preserve only non-sensitive evidence, and contact support.', { exact: true }).first()).toBeVisible();
  await expect(page.locator('main')).toContainText(/publisher|signature|hash|manifest/iu);
  await expect(page.getByRole('link', { name: /continue anyway|download now/iu })).toHaveCount(0);
  await assertNoExecutableArtifact(page);
});

test('@final @public release channel and browser history remain canonical and explicit', async ({
  page,
}, testInfo) => {
  onlyAxis(testInfo, 'wide-1280');

  await page.goto('/en/releases');
  await expect(page.getByRole('link', { name: 'Stable', exact: true }).first()).toHaveAttribute(
    'aria-current',
    'page',
  );
  await page.getByRole('link', { name: 'Beta', exact: true }).first().click();
  await expect(page).toHaveURL(/\/en\/releases\/beta$/u);
  await expect(page.locator('main')).toContainText('Explicit opt-in required');
  await page.goBack();
  await expect(page).toHaveURL(/\/en\/releases$/u);
  await page.goForward();
  await expect(page).toHaveURL(/\/en\/releases\/beta$/u);
  await assertNoExecutableArtifact(page);
});
