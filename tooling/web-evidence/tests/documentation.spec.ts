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

const assertNoDeadLinks = async (page: Page) => {
  const invalid = await page.locator('a').evaluateAll((links) =>
    links.filter((link) => {
      const href = link.getAttribute('href');
      return href === null || href.trim() === '' || href === '#' || href.startsWith('javascript:');
    }).length,
  );
  expect(invalid).toBe(0);
};

test('@final @public W03 exposes current task-led documentation, metadata, and exact links', async ({
  page,
}, testInfo) => {
  onlyAxis(testInfo, 'wide-1280');
  assertScenarioParity('W03');

  await page.goto('/pt-BR/docs/current');
  await expect(page.getByRole('heading', { level: 1, name: 'Central de ajuda' })).toBeVisible();
  await expect(page.getByRole('group', { name: /Versão · Canal/u })).toContainText(
    'Guias atuais',
  );
  await expect(page.getByRole('group', { name: /Versão · Canal/u })).toContainText(
    'Recomendado para uso agora',
  );
  await expect(page.getByRole('navigation', { name: 'Guias rápidos' })).toBeVisible();
  await expect(page.locator('#documentation-task-index-title')).toBeVisible();
  const article = page
    .locator('#documentation-task-index-title')
    .locator('..')
    .getByRole('link')
    .first();
  await expect(article).toHaveAttribute('href', /^\/pt-BR\/docs\/current\//u);
  await article.click();
  await expect(page.locator('.lb-web-article-metadata')).toContainText(/Última revisão|Responsável/u);
  await expect(page.locator('article')).toContainText(/Evidência|Compatibilidade|Recuperação/u);
  await page.goBack();
  await expect(page).toHaveURL(/\/pt-BR\/docs\/current$/u);
  await assertNoDeadLinks(page);
});

test('@final @public W04 keeps historical unsupported guidance visible without redirecting', async ({
  page,
}, testInfo) => {
  onlyAxis(testInfo, 'wide-1280');
  assertScenarioParity('W04');

  const historical = '/en/docs/history/1.0.0/legacy-capture';
  await page.goto(historical);
  await expect(page).toHaveURL(new RegExp(`${historical}$`, 'u'));
  const staleNotice = page.locator('.lb-web-boundary').filter({ hasText: 'Historical documentation' });
  await expect(staleNotice).toContainText('Historical documentation');
  await expect(staleNotice).toContainText('has not been redirected');
  await expect(page.getByRole('link', { name: 'Open the current canonical version' })).toHaveAttribute(
    'href',
    /^\/en\/docs\/current\//u,
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/iu);
  await assertNoDeadLinks(page);
});

test('@final @public W05 traces an observed error through evidence, safe steps, and escalation', async ({
  page,
}, testInfo) => {
  onlyAxis(testInfo, 'wide-1280');
  assertScenarioParity('W05');

  await page.goto('/pt-BR/docs/current/troubleshooting/lb-err-0x80070005');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Estado observado' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 3, name: 'Evidências' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Etapas seguras' })).toBeVisible();
  await expect(page.getByText(/Escalonamento:/u)).toBeVisible();
  await expect(page.locator('article')).not.toContainText(/powershell|reg add|curl .+\|/iu);
  await assertNoDeadLinks(page);
});
