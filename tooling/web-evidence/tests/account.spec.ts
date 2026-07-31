import { readFileSync } from 'node:fs';

import { expect, test, type Page, type TestInfo } from '@playwright/test';

const onlyAxis = (testInfo: TestInfo, axis: string) => {
  test.skip(testInfo.project.metadata['axis'] !== axis, `Covered by the ${axis} project.`);
};

const expectNoDeadControls = async (page: Page) => {
  const deadLinks = await page.locator('a').evaluateAll((links) =>
    links
      .map((link) => link.getAttribute('href'))
      .filter((href) => href === null || href.trim() === '' || href === '#' || href.startsWith('javascript:')),
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
    .getByRole('button', { name: locale === 'en' ? 'Review action boundary' : 'Revisar limite da ação' })
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
  await expect(
    page.getByRole('alert', { name: 'Correct the email address' }),
  ).toContainText('Enter a complete email address');

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
  await expect(page.locator('body')).toContainText(/No remote account authority|authority is connected/iu);

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

test('@final @account W17 keeps account errors localized and redacted', async ({ page }, testInfo) => {
  onlyAxis(testInfo, 'desktop-960');
  await page.goto('/pt-BR/errors/404');
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/não encontrada/iu);
  await expect(page.locator('main')).not.toContainText(/stack|node_modules|C:\\|src\//u);
  await expectNoDeadControls(page);
});
