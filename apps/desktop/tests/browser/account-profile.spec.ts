import { expect, test } from '@playwright/test';

import { openDesktopTestCase } from './fixtures.ts';

const openProfile = async (
  page: Parameters<typeof openDesktopTestCase>[0],
  windowsLocale = 'pt-BR',
): Promise<void> => {
  await openDesktopTestCase(page, {
    initialPath: '/account/overview',
    operationalState: 'fixture',
    scenarioId: 'S01',
    windowsLocale,
  });
};

test('@premium-profile edits, validates and persists the complete local identity', async ({
  page,
}) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await openProfile(page);

  await page.getByRole('button', { name: 'Editar perfil' }).click();
  await page.getByRole('textbox', { name: 'Nome de exibição' }).fill('x');
  await page.getByRole('textbox', { name: 'Identificador do jogador' }).fill('!!');
  await page.getByRole('button', { name: 'Salvar alterações' }).click();

  await expect(page.getByText('Use entre 2 e 40 caracteres.')).toBeVisible();
  await expect(page.getByText('Use um identificador válido de 3 a 20 caracteres.')).toBeVisible();
  await expect(page.getByText('Revise os campos destacados antes de salvar.')).toBeVisible();

  await page.getByRole('textbox', { name: 'Nome de exibição' }).fill('Liiiraa Prime');
  await page.getByRole('textbox', { name: 'Identificador do jogador' }).fill('liiiraa.prime');
  await page
    .getByRole('textbox', { name: 'Apresentação curta' })
    .fill('Perfil competitivo configurado neste dispositivo.');

  await page.locator('.desktop-profile-avatar-editor input[type="file"]').setInputFiles({
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z1m8AAAAASUVORK5CYII=',
      'base64',
    ),
    mimeType: 'image/png',
    name: 'avatar.png',
  });
  await expect(page.locator('.desktop-profile-avatar-editor img')).toBeVisible();
  await page.getByRole('button', { name: 'Remover' }).click();
  await page.getByRole('button', { name: 'Usar avatar violet' }).click();

  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(page.getByRole('button', { name: 'Salvando perfil' })).toBeDisabled();
  await expect(page.getByText('Perfil salvo neste dispositivo.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Liiiraa Prime' })).toBeVisible();
  await expect(page.locator('.lb-account-trigger-copy strong')).toHaveText('Liiiraa Prime');
  await expect(page.locator('.lb-account-avatar')).toHaveText('LP');
  await expect(page.locator('.desktop-profile-avatar').first()).toHaveAttribute(
    'data-accent',
    'violet',
  );

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Liiiraa Prime' })).toBeVisible();
  await expect(page.locator('.desktop-profile-identity > p')).toContainText('@liiiraa.prime');
  await expect(page.getByText('Perfil competitivo configurado neste dispositivo.')).toBeVisible();

  await page
    .locator('label.lb-switch')
    .filter({ hasText: 'Mostrar identificador do jogador' })
    .click();
  await expect(page.locator('.desktop-profile-identity > p')).not.toContainText('@liiiraa.prime');

  await page
    .locator('label.lb-switch')
    .filter({ hasText: 'Mostrar atividade local recente' })
    .click();
  await expect(page.getByRole('heading', { name: 'Atividade local recente' })).toHaveCount(0);

  await page.reload();
  await expect(page.locator('.desktop-profile-identity > p')).not.toContainText('@liiiraa.prime');
  await expect(page.getByRole('heading', { name: 'Atividade local recente' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Copiar' }).click();
  await expect(page.getByText('Identificador da conta copiado.')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => globalThis.navigator.clipboard.readText()))
    .toBe('LB-7F2A-91C8');

  await page.evaluate(() => {
    const createObjectUrl = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob: Blob): string => {
      void blob.text().then((content) => {
        Reflect.set(globalThis, '__LIIIRAA_EXPORTED_PROFILE__', content);
      });
      return createObjectUrl(blob);
    };
  });

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('liiiraa-boost-perfil-liiiraa.prime.json');

  await expect
    .poll(() =>
      page.evaluate(() => String(Reflect.get(globalThis, '__LIIIRAA_EXPORTED_PROFILE__') ?? '')),
    )
    .toContain('Liiiraa Prime');
  const exportedProfile = await page.evaluate(
    () =>
      JSON.parse(String(Reflect.get(globalThis, '__LIIIRAA_EXPORTED_PROFILE__'))) as {
        readonly profile: { readonly displayName: string; readonly playerTag: string };
      },
  );
  expect(exportedProfile.profile).toMatchObject({
    displayName: 'Liiiraa Prime',
    playerTag: 'liiiraa.prime',
  });
});

test('@premium-profile keeps native wheel scrolling available in the installed shell layout', async ({
  page,
}) => {
  await openProfile(page);

  const workCanvas = page.locator('.desktop-work-canvas');
  await expect(workCanvas).toHaveCSS('overflow-y', 'auto');

  const before = await workCanvas.evaluate((element) => element.scrollTop);
  await workCanvas.hover({ position: { x: 500, y: 500 } });
  await page.mouse.wheel(0, 900);

  await expect
    .poll(() => workCanvas.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(before);
  await expect(page.getByRole('heading', { name: 'Conta e dados locais' })).toBeVisible();
});

test('@premium-profile clear confirmation and sign-out preserve honest local behavior', async ({
  page,
}) => {
  await openProfile(page);

  await page.getByRole('button', { name: 'Editar perfil' }).click();
  await page.getByRole('textbox', { name: 'Nome de exibição' }).fill('Perfil Temporário');
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(page.getByRole('heading', { name: 'Perfil Temporário' })).toBeVisible();

  await page.getByRole('button', { name: /Limpar prévia local/ }).click();
  await expect(page.getByText('Limpar este perfil local?')).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByText('Limpar este perfil local?')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Perfil Temporário' })).toBeVisible();

  await page.getByRole('button', { name: /Limpar prévia local/ }).click();
  await page.getByRole('button', { name: 'Limpar dados locais' }).click();
  await expect(page.getByRole('heading', { name: 'Liiiraa Player' })).toBeVisible();
  await expect(page.locator('.lb-account-trigger-copy strong')).toHaveText('Liiiraa Player');
  await expect(page.getByText('Perfil local restaurado ao estado padrão.')).toBeVisible();

  await page.getByRole('button', { name: /Sair da prévia/ }).click();
  await expect(page.locator('.desktop-app-shell')).toHaveAttribute('data-route-path', '/login');
  await expect(page.getByRole('heading', { name: 'Acesse sua central de comando' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Explorar modo demonstração' })).toHaveCount(0);
});

test('@premium-profile English catalog covers profile, editor and local-data actions', async ({
  page,
}) => {
  await openProfile(page, 'en-US');

  await expect(page.getByRole('heading', { exact: true, level: 1, name: 'Account' })).toBeVisible();
  await expect(page.getByText('Competitive player focused on consistency')).toBeVisible();
  await expect(
    page.getByText(
      'Jogador competitivo focado em consistência, baixa latência e decisões reversíveis.',
    ),
  ).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Export local profile' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign out of preview' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Clear local preview' })).toBeVisible();

  await page.getByRole('button', { name: 'Edit profile' }).click();
  await expect(page.getByRole('textbox', { name: 'Display name' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Player identifier' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Short bio' })).toHaveValue(
    'Competitive player focused on consistency, low latency and reversible decisions.',
  );
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeVisible();
});
