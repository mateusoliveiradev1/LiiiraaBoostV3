import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
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

const mutationRequests = (page: Page): string[] => {
  const mutations: string[] = [];
  page.on('request', (request) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      mutations.push(`${request.method()} ${request.url()}`);
    }
  });
  return mutations;
};

const advanceToConfirmation = async (page: Page, locale: 'en' | 'pt-BR') => {
  const validate = locale === 'en' ? 'Validate reviewed fields' : 'Validar campos revisados';
  await page.getByRole('button', { name: validate }).click();
  await page.getByRole('button', { name: validate }).click();
  await page
    .getByRole('button', {
      name: locale === 'en' ? 'Review action boundary' : 'Revisar limite da ação',
    })
    .click();
  const reauthentication = page.getByRole('button', {
    name:
      locale === 'en'
        ? 'Complete reauthentication simulation'
        : 'Concluir simulação de reautenticação',
  });
  if ((await reauthentication.count()) > 0) {
    await reauthentication.click();
  } else {
    await page
      .getByRole('button', {
        name: locale === 'en' ? 'Continue review' : 'Continuar revisão',
      })
      .click();
  }
  await expect(page.locator('[data-preview-state="confirming"]')).toBeVisible();
};

test('@final @account W10 validates sign-in and completes without creating a session', async ({
  page,
}, testInfo) => {
  onlyAxis(testInfo, 'desktop-960');
  const mutations = mutationRequests(page);

  await page.goto('/en/sign-in');
  await expect(page.getByRole('heading', { level: 1, name: 'Sign-in preview' })).toBeVisible();
  await expect(page.locator('[data-authority-connected="false"]')).not.toHaveCount(0);
  await page.getByRole('textbox', { name: 'Email address' }).fill('invalid-address');
  await page.getByRole('button', { name: 'Review email sign-in' }).click();
  await expect(page.getByRole('alert', { name: 'Correct the email address' })).toContainText(
    'Enter a complete email address',
  );

  await page.getByRole('textbox', { name: 'Email address' }).fill('player@example.com');
  await page.getByRole('button', { name: 'Review email sign-in' }).click();
  await advanceToConfirmation(page, 'en');
  await page.getByRole('button', { name: 'Review sign in' }).click();

  const receipt = page.locator('[data-preview-region="receipt"]');
  await expect(receipt).toContainText('Preview complete — no change was made');
  await expect(receipt).toContainText('Remote state changed');
  await expect(receipt).toContainText('No');
  await expect(receipt).toHaveAttribute('data-remote-state-changed', 'false');
  expect(mutations).toEqual([]);
  await expectNoDeadControls(page);
});

test('@final @account W11 exposes every responsibility with persistent preview provenance', async ({
  page,
}, testInfo) => {
  onlyAxis(testInfo, 'wide-1440');
  const responsibilities = [
    ['/pt-BR/account', 'account-overview'],
    ['/pt-BR/account/profile', 'account-profile'],
    ['/pt-BR/account/security', 'account-security'],
    ['/pt-BR/account/subscription', 'account-subscription'],
    ['/pt-BR/account/invoices', 'account-invoices'],
    ['/pt-BR/account/device', 'account-device'],
    ['/pt-BR/account/downloads', 'account-downloads'],
    ['/pt-BR/account/privacy', 'account-privacy'],
    ['/pt-BR/account/support', 'account-support'],
  ] as const;

  for (const [path, routeId] of responsibilities) {
    await page.goto(path);
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
    await expect(page.locator('main h1')).toHaveCount(1);
    await expect(page.locator('[data-account-preview="deterministic"]')).toHaveAttribute(
      'data-route-id',
      routeId,
    );
    await expect(page.getByRole('complementary', { name: 'Prévia determinística' })).toBeVisible();
    await expectNoDeadControls(page);
  }
});

test('@final @account W12 keeps degraded recovery authored and authority disconnected', async ({
  page,
}, testInfo) => {
  onlyAxis(testInfo, 'wide-1280');
  await page.goto('/en/account');
  await expect(page.locator('[data-authority-connected="false"]')).not.toHaveCount(0);
  await expect(page.getByText(/No real account activity/u)).toBeVisible();
  await expect(page.locator('body')).toContainText(
    /No remote account authority|authority is connected/iu,
  );

  const source = readFileSync(
    new URL('../../../apps/account/src/features/account-preview.tsx', import.meta.url),
    'utf8',
  );
  for (const state of ['offline', 'stale', 'expired-session', 'partial-failure']) {
    expect(source).toContain(state);
  }
  expect(source).toContain('displayName, locale, supportSubject');
});

test('@final @account W13 proves cancellation and a phrase-confirmed no-change privacy receipt', async ({
  page,
}, testInfo) => {
  onlyAxis(testInfo, 'wide-1280');
  const mutations = mutationRequests(page);

  await page.goto('/pt-BR/account/privacy');
  await page.getByRole('button', { name: 'Revisar exclusão da conta' }).click();
  await advanceToConfirmation(page, 'pt-BR');
  await page.getByRole('button', { name: 'Cancelar prévia' }).click();
  await expect(page.locator('[data-preview-region="receipt"]')).toContainText(
    'Prévia cancelada — nenhuma alteração foi feita',
  );

  await page.reload();
  await page.getByRole('button', { name: 'Revisar exclusão da conta' }).click();
  await advanceToConfirmation(page, 'pt-BR');
  await page.getByLabel('Frase de confirmação').fill('ENVIAR SOLICITAÇÃO DE PRIVACIDADE');
  await page.getByRole('button', { name: 'ENVIAR SOLICITAÇÃO DE PRIVACIDADE' }).click();
  const receipt = page.locator('[data-preview-region="receipt"]');
  await expect(receipt).toContainText('Prévia concluída — nenhuma alteração foi feita');
  await expect(receipt).toHaveAttribute('data-remote-state-changed', 'false');
  expect(mutations).toEqual([]);
});

test('@final @account W17 keeps account errors localized and redacted', async ({
  page,
}, testInfo) => {
  onlyAxis(testInfo, 'desktop-960');
  const expectedTitles = {
    'en:403': 'Account responsibility not permitted',
    'en:404': 'Account area not found',
    'en:410': 'Historical account area removed',
    'en:500': 'The account preview encountered a failure',
    'pt-BR:403': 'Responsabilidade da conta não permitida',
    'pt-BR:404': 'Área da conta não encontrada',
    'pt-BR:410': 'Área histórica da conta removida',
    'pt-BR:500': 'A prévia da conta encontrou uma falha',
  } as const;
  const sensitiveDiagnostic =
    /(?:node_modules|at\s+[A-Za-z_$][\w$]*\s*\(|[A-Za-z]:\\(?:Users|src)\\|\/(?:Users|home)\/|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|Bearer\s+[A-Za-z0-9._~-]+|"(?:password|authorization|cookie)"\s*:)/iu;
  const observations: RouteReachabilityObservation[] = [];
  const headings = new Map<string, Set<string>>();
  const mutations = mutationRequests(page);

  for (const target of routeReachabilityTargets('account')) {
    const response = await page.goto(target.pathname, { waitUntil: 'domcontentloaded' });
    expect(response).not.toBeNull();
    const responseStatus = response?.status() ?? 0;
    expect(responseStatus).toBe(target.semanticStatus === 404 ? 404 : 200);
    expect(response?.request().redirectedFrom()).toBeNull();
    expect(new URL(page.url()).pathname).toBe(target.pathname);
    await expect(page.locator('html')).toHaveAttribute('lang', target.locale);
    await expect(page.locator('.account-failure__code')).toHaveText(String(target.semanticStatus));

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
    await expect(page.locator('.account-failure__correlation')).toContainText(
      new RegExp(`LB-A${String(target.semanticStatus)}-REDACTED`, 'u'),
    );
    await expect(page.locator('[data-authority-connected="false"]')).not.toHaveCount(0);
    await expect(page.locator('[data-authority-connected="true"]')).toHaveCount(0);

    const recoveryLinks = page.locator('.account-failure__actions a');
    expect(await recoveryLinks.count()).toBe(2);
    const recoveryHrefs = await recoveryLinks.evaluateAll((links) =>
      links.map((link) => (link as HTMLAnchorElement).href),
    );
    expect(
      recoveryHrefs.every((href) => {
        const recovery = new URL(href);
        return (
          recovery.origin === new URL(page.url()).origin &&
          recovery.pathname.startsWith(`/${target.locale}`) &&
          recovery.search === ''
        );
      }),
    ).toBe(true);
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
  writeRouteReachabilityEvidence({ observations, repositoryRoot, surface: 'account' });
});
