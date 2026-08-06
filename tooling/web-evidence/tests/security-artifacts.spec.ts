import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { expect, test, type APIRequestContext, type TestInfo } from '@playwright/test';

const STAGING_API_ORIGIN = 'https://liiiraa-api-staging.onrender.com';

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
  allowedProtectedStatuses: readonly number[] = [],
) => {
  const response = await request.get(url);
  expect(response.status() < 400 || allowedProtectedStatuses.includes(response.status())).toBe(
    true,
  );
  const headers = response.headers();
  expect(headers['content-security-policy']).toContain("default-src 'self'");
  expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['permissions-policy']).toContain('camera=()');
  expect(headers['referrer-policy']).toBe(referrerPolicy);
  expect(headers['set-cookie']).toBeUndefined();
};

type VercelSurfaceContract = Readonly<{
  $schema: string;
  buildCommand: string;
  framework: string;
  headers: readonly Readonly<{
    headers: readonly Readonly<{ key: string; value: string }>[];
    source: string;
  }>[];
  installCommand: string;
  name: string;
  outputDirectory: string;
  rewrites: readonly Readonly<{ destination: string; source: string }>[];
}>;

const readVercelSurfaceContract = (repositoryRoot: string, surface: string) =>
  JSON.parse(
    readFileSync(join(repositoryRoot, `apps/${surface}/vercel.json`), 'utf8'),
  ) as VercelSurfaceContract;

test('@staging-origin-smoke keeps three static Vercel surfaces isolated on one exact API authority', () => {
  const repositoryRoot = resolve(import.meta.dirname, '../../..');
  const contracts = ['web', 'account', 'admin'].map((surface) => ({
    contract: readVercelSurfaceContract(repositoryRoot, surface),
    surface,
  }));

  expect(new Set(contracts.map(({ contract }) => contract.name)).size).toBe(3);
  for (const { contract, surface } of contracts) {
    expect(contract.$schema).toBe('https://openapi.vercel.sh/vercel.json');
    expect(contract.framework).toBe('nextjs');
    expect(contract.buildCommand).toBe(
      `cd ../.. && pnpm --filter @liiiraa/${surface === 'web' ? 'web' : surface} build`,
    );
    expect(contract.installCommand).toContain(
      'corepack pnpm@11.17.0 install --frozen-lockfile --ignore-scripts',
    );
    expect(contract.outputDirectory).toBe('.next');
    expect(contract.rewrites).toEqual([
      {
        destination: `${STAGING_API_ORIGIN}/v1/:path*`,
        source: '/v1/:path*',
      },
    ]);
    const headers = Object.fromEntries(
      contract.headers.flatMap((entry) => entry.headers.map(({ key, value }) => [key, value])),
    );
    expect(headers['X-Robots-Tag']).toBe('noindex,nofollow,noarchive');
    expect(headers['X-Liiiraa-Staging-Surface']).toBe(surface === 'web' ? 'public' : surface);
    expect(Object.keys(headers).map((key) => key.toLowerCase())).not.toContain('set-cookie');
  }

  const accountIdentityRoutes = readFileSync(
    join(repositoryRoot, 'apps/api/src/modules/identity/routes.ts'),
    'utf8',
  );
  expect(accountIdentityRoutes).toContain('__Host-liiiraa_session=');
  expect(accountIdentityRoutes).not.toMatch(/Domain=/u);

  const workflow = readFileSync(
    join(repositoryRoot, '.github/workflows/phase-4-surfaces.yml'),
    'utf8',
  );
  expect(workflow).toContain(`STAGING_API_ORIGIN: ${STAGING_API_ORIGIN}`);
  expect(workflow).toContain('environment: staging-public');
  expect(workflow).toContain('environment: staging-account');
  expect(workflow).toContain('environment: staging-admin');
  expect(workflow).toContain('SURFACE_SCOPE: bounded-provider-preview');
  expect(workflow).toContain('broader-beta-promotion');
  expect(workflow).toContain('OWNED_CALLBACK_ORIGINS');
  expect(workflow).toContain('OWNED_EMAIL_IDENTITY');
  expect(workflow).toContain("LIIIRAA_ACCOUNT_PREVIEW: 'false'");
  expect(workflow).toContain("LIIIRAA_ADMIN_PREVIEW: 'false'");
  expect(workflow).toContain('LIIIRAA_ACCOUNT_ORIGIN: account.origin');
  expect(workflow).toContain('needs: [verify-contracts, deploy-account]');
  expect(workflow).toContain('src/staging/provision-invitations.test.ts');
  expect(workflow).not.toContain('DATABASE_URL');
  expect(workflow).not.toContain('STRIPE_SECRET_KEY');
});

test('@staging-origin-live probes deployed origin, session, and consent boundaries', async ({
  request,
}) => {
  const origins = {
    account: process.env['ACCOUNT_STAGING_ORIGIN'],
    admin: process.env['ADMIN_STAGING_ORIGIN'],
    public: process.env['PUBLIC_STAGING_ORIGIN'],
  } as const;
  test.skip(
    Object.values(origins).some((origin) => origin === undefined),
    'Protected staging origins are injected only by the deployed smoke workflow.',
  );
  for (const [surface, origin] of Object.entries(origins)) {
    expect(origin, `${surface} staging origin must be injected by the protected workflow`).toMatch(
      /^https:\/\/[^/?#]+$/u,
    );
  }
  expect(new Set(Object.values(origins)).size).toBe(3);

  const publicOrigin = origins.public as string;
  const accountOrigin = origins.account as string;
  const adminOrigin = origins.admin as string;
  await expectSecurityHeaders(request, `${publicOrigin}/pt-BR`, 'strict-origin-when-cross-origin');
  await expectSecurityHeaders(request, `${accountOrigin}/pt-BR/login`, 'no-referrer');
  await expectSecurityHeaders(request, `${adminOrigin}/pt-BR/admin`, 'no-referrer', [403]);

  const crossSurface = await request.get(`${adminOrigin}/pt-BR/admin`, {
    headers: { cookie: '__Host-liiiraa_account_session=forbidden-cross-surface-state' },
  });
  expect(crossSurface.status()).toBe(403);
  expect(crossSurface.headers()['set-cookie']).toBeUndefined();

  const unauthenticatedAccount = await request.get(`${accountOrigin}/v1/account`);
  expect([401, 403]).toContain(unauthenticatedAccount.status());
  expect(unauthenticatedAccount.headers()['set-cookie']).toBeUndefined();

  const unconsentedDiagnostic = await request.get(
    `${adminOrigin}/v1/admin/diagnostic-metadata/DIA-015`,
  );
  expect([401, 403, 404, 410]).toContain(unconsentedDiagnostic.status());
  expect(unconsentedDiagnostic.headers()['cache-control']).toContain('no-store');
});

test('@final @public WEB-08 compares three independently running policy boundaries', async ({
  request,
}, testInfo) => {
  onlyProject(testInfo, 'public', 'wide-1440');
  await expectSecurityHeaders(
    request,
    'http://public.localhost:3100/pt-BR',
    'strict-origin-when-cross-origin',
  );
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
  await expect(page.locator('body')).not.toContainText(
    /account-overview|admin-role|SIMULATED SCENARIO/iu,
  );
  const sitemap = await page.request.get('/sitemap.xml');
  expect(sitemap.ok()).toBe(true);
  await expect(sitemap.text()).resolves.not.toMatch(
    /account\.localhost|admin\.localhost|\/(?:account|admin)(?:\/|<)/iu,
  );
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
  await expect(page.locator('html')).toHaveAttribute(
    'data-authoritative-access-connected',
    'false',
  );
  await expect(
    page.locator('a[href*="public.localhost"], a[href="https://liiiraa.com"]'),
  ).toHaveCount(0);
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
