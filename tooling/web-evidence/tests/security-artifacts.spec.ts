import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { expect, test, type APIRequestContext, type TestInfo } from '@playwright/test';

const onlyProject = (testInfo: TestInfo, surface: string, axis: string) => {
  test.skip(
    testInfo.project.metadata['surface'] !== surface || testInfo.project.metadata['axis'] !== axis,
    `Covered by ${surface}-${axis}.`,
  );
};

const readArtifactText = (root: string): string => {
  const files: string[] = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && /\.(?:html|js|json|txt)$/u.test(entry.name)) files.push(path);
    }
  };
  visit(root);
  return files
    .sort()
    .map((path) => `${relative(root, path)}\n${readFileSync(path, 'utf8')}`)
    .join('\n');
};

const expectSecurityHeaders = async (
  request: APIRequestContext,
  url: string,
  referrerPolicy: string,
) => {
  const response = await request.get(url);
  expect(response.status()).toBeLessThan(400);
  const headers = response.headers();
  expect(headers['content-security-policy']).toContain("default-src 'self'");
  expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['permissions-policy']).toContain('camera=()');
  expect(headers['referrer-policy']).toBe(referrerPolicy);
  expect(headers['set-cookie']).toBeUndefined();
};

test('@final @public WEB-08 compares three independently running policy boundaries', async ({
  request,
}, testInfo) => {
  onlyProject(testInfo, 'public', 'wide-1440');
  await expectSecurityHeaders(request, 'http://public.localhost:3100/pt-BR', 'strict-origin-when-cross-origin');
  await expectSecurityHeaders(request, 'http://account.localhost:3101/pt-BR/login', 'no-referrer');
  await expectSecurityHeaders(request, 'http://admin.localhost:3102/pt-BR/admin', 'no-referrer');

  const rejected = await request.get('http://admin.localhost:3102/pt-BR/admin', {
    headers: { cookie: 'liiiraa_account_session=forbidden-cross-origin-state' },
  });
  expect(rejected.status()).toBe(403);
  await expect(rejected.json()).resolves.toMatchObject({
    authoritativeAccessConnected: false,
    code: 'ADMIN_PREVIEW_ACCESS_DENIED',
  });
});

test('@final @public built artifacts contain no switcher, private index, or development installer', async ({
  page,
}, testInfo) => {
  onlyProject(testInfo, 'public', 'wide-1280');
  const repositoryRoot = resolve(import.meta.dirname, '../../..');
  const publicArtifact = [
    readArtifactText(join(repositoryRoot, 'apps/web/.next/server/app')),
    readArtifactText(join(repositoryRoot, 'apps/web/.next/static/chunks/app')),
  ].join('\n');
  expect(publicArtifact).not.toMatch(/(?:scenario|fixture)(?:Id)?=(?:W\d+|[^&"']+)/iu);
  expect(publicArtifact).not.toMatch(
    /target[\\/]release|self-signed|https?:\/\/[^\s"']+\.exe(?:["'?#]|$)/iu,
  );

  await page.goto('/en/search');
  await expect(page.locator('body')).not.toContainText(/account-overview|admin-role|SIMULATED SCENARIO/iu);
  const sitemap = await page.request.get('/sitemap.xml');
  expect(sitemap.ok()).toBe(true);
  await expect(sitemap.text()).resolves.not.toMatch(/account\.localhost|admin\.localhost|\/(?:account|admin)(?:\/|<)/iu);
});

test('@final @account private artifact remains noindex and mutation-channel free', async ({
  page,
}, testInfo) => {
  onlyProject(testInfo, 'account', 'wide-1280');
  await page.goto('/en/account');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/iu);
  await expect(page.locator('html')).toHaveAttribute('data-authority-connected', 'false');
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(/payment token|session token/iu);
});

test('@final @admin artifact has no ordinary public link or accepted cross-origin state', async ({
  page,
}, testInfo) => {
  onlyProject(testInfo, 'admin', 'wide-1280');
  await page.goto('/en/admin?role=audit');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/iu);
  await expect(page.locator('html')).toHaveAttribute('data-authoritative-access-connected', 'false');
  await expect(page.locator('a[href*="public.localhost"], a[href="https://liiiraa.com"]')).toHaveCount(0);
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
});

test('@final @public build roots are real independent artifacts', async ({}, testInfo) => {
  onlyProject(testInfo, 'public', 'desktop-960');
  const repositoryRoot = resolve(import.meta.dirname, '../../..');
  for (const app of ['web', 'account', 'admin']) {
    const buildRoot = join(repositoryRoot, `apps/${app}/.next`);
    expect(statSync(buildRoot).isDirectory()).toBe(true);
    expect(readFileSync(join(buildRoot, 'BUILD_ID'), 'utf8').trim()).not.toBe('');
  }
});
