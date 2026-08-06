import { existsSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import * as publicConfig from '../next.config';
import catalogEnJson from './content/public/catalog.en.json';
import catalogPtBrJson from './content/public/catalog.pt-BR.json';
import {
  accountRouteBoundaryHref,
  publicBoundaryHref,
  publicNavigation,
  resolveAccountBoundaryOrigin,
  routing,
} from './public-boundary';
import {
  CLIENT_WEB_LOCALES,
  clientAccountBoundaryHref,
  clientPublicBoundaryHref,
  type ClientRecoveryRouteId,
} from './public-client-boundary';
import {
  getPublicFooterState,
  getPublicNavigationState,
  type PublicPillarId,
} from './public-navigation';
import { generateMetadata as generatePublicCatchAllMetadata } from './app/[locale]/(public)/[[...slug]]/page';

const layoutSource = readFileSync(new URL('./app/[locale]/layout.tsx', import.meta.url), 'utf8');
const navigationSource = readFileSync(new URL('./public-navigation.tsx', import.meta.url), 'utf8');
const proxySource = readFileSync(new URL('../proxy.ts', import.meta.url), 'utf8');
const shellStyles = readFileSync(new URL('./app/public-shell.css', import.meta.url), 'utf8');
const publicCatchAllSource = readFileSync(
  new URL('./app/[locale]/(public)/[[...slug]]/page.tsx', import.meta.url),
  'utf8',
);
const aboutCatalogs = [catalogPtBrJson, catalogEnJson] as const;
const routeOwnedSources = [
  './app/[locale]/(public)/[[...slug]]/page.tsx',
  './app/[locale]/download/[channel]/[version]/page.tsx',
  './app/[locale]/releases/[[...release]]/page.tsx',
  './features/documentation.tsx',
].map((path) => readFileSync(new URL(path, import.meta.url), 'utf8'));

describe('public shell', () => {
  it('redirects the bare provider origin to the default localized public entry', () => {
    expect(proxySource).toContain("request.nextUrl.pathname === '/'");
    expect(proxySource).toContain("destination.pathname = '/pt-BR'");
  });

  it('leaves the shared API authority path outside locale routing', () => {
    expect(proxySource).toContain("matcher: ['/((?!api|v1|_next|_vercel|.*\\\\..*).*)']");
  });

  it('builds the shared API rewrite into the Next routing manifest', async () => {
    const rewrites = Reflect.get(publicConfig.default, 'rewrites') as
      (() => Promise<readonly { destination: string; source: string }[]>) | undefined;

    expect(rewrites).toBeTypeOf('function');
    await expect(rewrites?.()).resolves.toEqual([
      {
        destination: 'https://liiiraa-api-staging.onrender.com/v1/:path*',
        source: '/v1/:path*',
      },
    ]);
  });

  it('publishes the official brand favicon from the root app boundary', () => {
    const iconUrl = new URL('./app/icon.svg', import.meta.url);

    expect(existsSync(iconUrl)).toBe(true);
    if (!existsSync(iconUrl)) return;

    const icon = readFileSync(iconUrl, 'utf8');
    expect(icon).toContain('aria-label="Liiiraa Boost"');
    expect(icon).toContain('M2 25.5 10.6 2h7.2l-5.7 15.2h9.2l-7.1 8.3H2Z');
  });

  it.each([
    ['/en/product', 'public-product'],
    ['/en/results', 'public-results'],
    ['/en/compatibility', 'public-compatibility'],
    ['/en/plans', 'public-plans'],
    ['/en/download', 'public-download'],
  ] as const)(
    'projects %s to one current task pillar on desktop and mobile',
    (pathname, activeId) => {
      const state = getPublicNavigationState(pathname, 'en');

      expect(state.items.filter((item) => item.current).map((item) => item.id)).toEqual([
        activeId satisfies PublicPillarId,
      ]);
      expect(state.mobileItems.filter((item) => item.current).map((item) => item.id)).toEqual([
        activeId satisfies PublicPillarId,
      ]);
    },
  );

  it.each([
    ['/pt-BR/about', '/en/about'],
    [
      '/pt-BR/docs/current/articles/measurement-basics',
      '/en/docs/current/articles/measurement-basics',
    ],
    ['/pt-BR/docs/current', '/en/docs/current'],
    ['/pt-BR/releases/stable/1.0.0', '/en/releases/stable/1.0.0'],
    ['/pt-BR/search', '/en/search'],
    ['/pt-BR/support', '/en/support'],
  ] as const)('preserves the canonical route while switching %s', (pathname, expectedHref) => {
    expect(getPublicNavigationState(pathname, 'pt-BR').localeHref).toBe(expectedHref);
  });

  it('shows the target flag and language with an explicit textual accessible name', () => {
    expect(getPublicNavigationState('/pt-BR/docs', 'pt-BR')).toMatchObject({
      localeAccessibleName: 'Mudar idioma para English',
      localeFlag: '🇺🇸',
      localeLabel: 'English',
    });
    expect(getPublicNavigationState('/en/docs', 'en')).toMatchObject({
      localeAccessibleName: 'Switch language to Português',
      localeFlag: '🇧🇷',
      localeLabel: 'Português',
    });
  });

  it('uses visitor task language and renders route-preserving header and footer locale controls', () => {
    expect(layoutSource).toContain("'public-product': 'Como funciona'");
    expect(layoutSource).toContain("'public-results': 'Resultados'");
    expect(layoutSource).toContain("'public-compatibility': 'Seu PC'");
    expect(layoutSource).toContain("'public-download': 'Download'");
    expect(layoutSource).toContain("download: 'Baixar grátis'");
    expect(layoutSource).toContain("download: 'Download free'");
    expect(layoutSource).toContain("'public-product': 'How it works'");
    expect(layoutSource).toContain("'public-results': 'Results'");
    expect(layoutSource).toContain("'public-compatibility': 'Your PC'");
    expect(navigationSource.match(/<LocaleSwitcher/gu)).toHaveLength(2);
    expect(navigationSource).toContain('className="public-header__locale"');
    expect(navigationSource).not.toContain('public-mobile-locale');
  });

  it('exposes localized sign-in and registration calls to the stable account origin', () => {
    const accountOrigin = 'https://liiiraa-boost-account-staging.vercel.app';

    expect(resolveAccountBoundaryOrigin(undefined, true)).toBe(accountOrigin);

    expect(accountRouteBoundaryHref('account-sign-in', 'pt-BR', accountOrigin)).toBe(
      `${accountOrigin}/pt-BR/login`,
    );
    expect(accountRouteBoundaryHref('account-sign-up', 'en', accountOrigin)).toBe(
      `${accountOrigin}/en/register`,
    );
    expect(layoutSource).toContain("signIn: 'Entrar'");
    expect(layoutSource).toContain("signUp: 'Criar conta'");
    expect(layoutSource).toContain("signIn: 'Sign in'");
    expect(layoutSource).toContain("signUp: 'Create account'");
    expect(navigationSource).toContain('href={accountLinks.signIn}');
    expect(navigationSource).toContain('href={accountLinks.signUp}');
  });

  it('uses the approved product lockup without exposing substitute initials', () => {
    expect(layoutSource).toContain('ProductLockup');
    expect(layoutSource).not.toContain('public-brand__mark');
    expect(layoutSource).not.toMatch(/>\s*LB\s*</u);
  });

  it('owns all public authoring styles at the locale layout boundary', () => {
    expect(layoutSource).toContain("import '../public-shell.css';");
    expect(layoutSource).toContain("import '../../styles/public.css';");
    expect(routeOwnedSources.every((source) => !source.includes('styles/public.css'))).toBe(true);
  });

  it('builds a substantial 72px branded desktop topbar with six intent pillars', () => {
    expect(publicNavigation).toHaveLength(6);
    expect(shellStyles).toMatch(
      /\.public-header__bar\s*\{[\s\S]*max-inline-size:\s*1280px;[\s\S]*min-block-size:\s*72px;[\s\S]*margin-inline:\s*auto;/u,
    );
    expect(layoutSource).toContain('<ProductLockup />');
    expect(navigationSource).toContain("publicBoundaryHref('public-download', locale)");
    expect(navigationSource).toContain('public-action--primary');
    expect(shellStyles).toMatch(/html\s*\{[\s\S]*overflow-x:\s*clip/u);
    expect(shellStyles).toMatch(/body\s*\{[\s\S]*overflow-x:\s*clip/u);
  });

  it('uses a 60px mobile topbar and a full-height task menu with 48px targets', () => {
    expect(shellStyles).toMatch(
      /@media \(width < 1100px\)[\s\S]*\.public-navigation--desktop[\s\S]*display:\s*none/u,
    );
    expect(shellStyles).toMatch(
      /@media \(width < 960px\)[\s\S]*\.public-header__bar\s*\{[\s\S]*min-block-size:\s*60px/u,
    );
    expect(shellStyles).toMatch(
      /\.public-mobile-menu__surface\s*\{[\s\S]*position:\s*fixed;[\s\S]*inset:\s*60px 0 0;[\s\S]*overflow:\s*auto/u,
    );
    expect(shellStyles).toMatch(
      /\.public-mobile-menu > summary\s*\{[\s\S]*min-inline-size:\s*48px;[\s\S]*min-block-size:\s*48px/u,
    );
  });

  it('keeps internal origin boundaries out of ordinary visitor chrome', () => {
    expect(layoutSource).not.toContain('public-boundary-notice');
    expect(layoutSource).not.toMatch(/>\s*PUBLIC\s*</u);
    expect(shellStyles).not.toContain('.public-boundary-notice');
  });

  it('retains accessible navigation, locale switching, and responsive menu behavior', () => {
    expect(layoutSource).toContain('className="public-skip-link"');
    expect(layoutSource).toContain('<PublicNavigation');
    expect(shellStyles).toMatch(
      /@media \(width < 960px\)[\s\S]*\.public-mobile-menu__surface\s*\{[\s\S]*position:\s*fixed/u,
    );
    expect(shellStyles).toMatch(
      /@media \(width < 960px\)[\s\S]*\.public-navigation--desktop[\s\S]*display:\s*none/u,
    );
  });

  it('keeps native route-preserving locale anchors and fails unmatched paths to Home', () => {
    expect(navigationSource).not.toMatch(/from ['"]next\/link['"]/u);
    expect(navigationSource).toContain('href={state.localeHref}');
    expect(getPublicNavigationState('/pt-BR/not-a-canonical-route', 'pt-BR').localeHref).toBe(
      '/en',
    );
  });

  it('retains visible focus, skip-link, forced-color, and noindex boundary hooks', () => {
    expect(layoutSource).toContain('className="public-skip-link"');
    expect(shellStyles).toContain(':focus-visible');
    expect(shellStyles).toContain('@media (forced-colors: active)');
    expect(publicConfig.publicHeaderContract).toEqual(expect.any(Array));
    expect(publicCatchAllSource).toContain('indexing: resolution.value.route.indexing');
    expect(publicCatchAllSource).toContain("resolution.indexing === 'noindex'");
    expect(publicCatchAllSource).toContain('robots: { follow: false, index: false }');
  });

  it('projects noindex metadata for every public error without inventing copy metadata', async () => {
    for (const locale of ['pt-BR', 'en'] as const) {
      for (const code of ['403', '404', '410', '500'] as const) {
        const metadata = await generatePublicCatchAllMetadata({
          params: Promise.resolve({ locale, slug: ['errors', code] }),
          searchParams: Promise.resolve({}),
        });

        expect(metadata.robots, `${locale} public error ${code}`).toEqual({
          follow: false,
          index: false,
        });
        expect(metadata.description).toBeUndefined();
        expect(metadata.title).toBeUndefined();
      }
    }
  });

  it('derives every public navigation pillar and both locale roots from route authority', () => {
    expect(routing.locales).toEqual(['pt-BR', 'en']);
    expect(publicNavigation.map(({ id }) => id)).toEqual([
      'public-product',
      'public-results',
      'public-compatibility',
      'public-plans',
      'public-download',
      'public-support',
    ]);
    expect(publicBoundaryHref('docs-index', 'pt-BR')).toBe('/pt-BR/docs');
    expect(publicBoundaryHref('releases-index', 'en')).toBe('/en/releases');
  });

  it('renders a truthful bilingual about story limited to the D-107 narrative', () => {
    expect(publicCatchAllSource).toContain("'public-about'");
    expect(publicCatchAllSource).toContain('className="public-about"');

    for (const catalog of aboutCatalogs) {
      expect(catalog.about.routeId).toBe('public-about');
      expect(Array.isArray(catalog.about.chapters)).toBe(true);
      expect(catalog.about.chapters.map(({ id }: { id: string }) => id)).toEqual([
        'motivation',
        'principles',
        'trust',
        'reversibility',
        'ambition',
      ]);
      expect(JSON.stringify(catalog.about)).not.toMatch(
        /\b(founder|founder-led|founded|fundador|fundadora|fundada|customers?|clientes?|users?|usuários?|awards?|prêmios?|partners?|parceiros?|traction|tração|team|equipe|testimonials?|depoimentos?)\b/iu,
      );
      expect(JSON.stringify(catalog.about)).not.toMatch(/\b(?:19|20)\d{2}\b/u);
    }

    expect(getPublicNavigationState('/pt-BR/about', 'pt-BR').activeId).toBe('public-product');
    expect(getPublicNavigationState('/en/about', 'en').activeId).toBe('public-product');
  });

  it('publishes Principles as a bilingual canonical destination independent from Our Story', async () => {
    expect(publicCatchAllSource).toContain("'public-principles'");
    expect(publicCatchAllSource).toContain('className="public-about public-principles"');

    for (const catalog of aboutCatalogs) {
      expect(catalog.principles.routeId).toBe('public-principles');
      expect(catalog.principles.chapters.map(({ id }: { id: string }) => id)).toEqual([
        'evidence',
        'stability',
        'local-first',
        'reversibility',
      ]);
      expect(catalog.principles.metadata.title).not.toBe(catalog.about.metadata.title);
    }

    for (const [locale, expectedTitle] of [
      ['pt-BR', 'Princípios | Liiiraa Boost'],
      ['en', 'Principles | Liiiraa Boost'],
    ] as const) {
      const metadata = await generatePublicCatchAllMetadata({
        params: Promise.resolve({ locale, slug: ['principles'] }),
        searchParams: Promise.resolve({}),
      });
      expect(metadata.title).toBe(expectedTitle);
      expect(metadata.alternates?.canonical).toBe(`/${locale}/principles`);
    }

    expect(getPublicNavigationState('/pt-BR/principles', 'pt-BR').localeHref).toBe(
      '/en/principles',
    );
    expect(getPublicNavigationState('/en/principles', 'en').localeHref).toBe('/pt-BR/principles');
  });

  it('projects the complete localized footer from canonical destinations on every public shell', () => {
    expect(layoutSource).toContain('<PublicFooter');

    const expectedGroups = {
      company: ['about', 'principles', 'contact'],
      legal: ['terms', 'privacy', 'security', 'essential-storage', 'responsible-disclosure'],
      product: ['how-it-works', 'your-pc', 'results', 'plans', 'download'],
      resources: ['documentation', 'help', 'releases', 'status'],
    };

    for (const [locale, pathname, targetPathname] of [
      ['pt-BR', '/pt-BR/about', '/en/about'],
      ['en', '/en/about', '/pt-BR/about'],
    ] as const) {
      const footer = getPublicFooterState(pathname, locale);
      const legalLinks = footer.groups.find(({ id }) => id === 'legal')?.links;
      const companyLinks = footer.groups.find(({ id }) => id === 'company')?.links;
      expect(
        Object.fromEntries(
          footer.groups.map((group) => [group.id, group.links.map(({ id }) => id)]),
        ),
      ).toEqual(expectedGroups);
      expect(
        footer.groups
          .flatMap(({ links }) => links)
          .every(({ href }) => href.startsWith(`/${locale}/`)),
      ).toBe(true);
      expect(Object.fromEntries((legalLinks ?? []).map(({ href, id }) => [id, href]))).toEqual({
        'essential-storage': `/${locale}/policies/essential-storage`,
        privacy: `/${locale}/policies/privacy`,
        'responsible-disclosure': `/${locale}/responsible-disclosure`,
        security: `/${locale}/policies`,
        terms: `/${locale}/policies/terms`,
      });
      expect(new Set((legalLinks ?? []).map(({ href }) => href)).size).toBe(5);
      expect((legalLinks ?? []).every(({ href }) => href.length > 0)).toBe(true);
      expect(Object.fromEntries((companyLinks ?? []).map(({ href, id }) => [id, href]))).toEqual({
        about: `/${locale}/about`,
        contact: `/${locale}/support`,
        principles: `/${locale}/principles`,
      });
      expect(new Set((companyLinks ?? []).map(({ href }) => href).slice(0, 2)).size).toBe(2);
      expect(footer.localeHref).toBe(targetPathname);
      expect(footer.ctaHref).toBe(`/${locale}/download`);
    }
  });

  it('admits Essential Storage through the public catch-all allowlist', () => {
    expect(publicCatchAllSource).toMatch(/CATALOG_ROUTES[\s\S]*'public-essential-storage'/u);
    expect(getPublicNavigationState('/pt-BR/policies/essential-storage', 'pt-BR').activeId).toBe(
      'public-support',
    );
  });

  it('keeps the complete footer useful at 320px and route-preserving at 400% zoom', () => {
    expect(shellStyles).toMatch(
      /\.public-footer__groups\s*\{[\s\S]*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/u,
    );
    expect(shellStyles).toMatch(
      /@media \(width < 960px\)[\s\S]*\.public-footer__groups\s*\{[\s\S]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/u,
    );
    expect(shellStyles).toMatch(
      /@media \(width < 480px\)[\s\S]*\.public-footer__groups\s*\{[\s\S]*grid-template-columns:\s*1fr/u,
    );
    expect(shellStyles).toMatch(/\.public-footer__link\s*\{[\s\S]*min-block-size:\s*44px/u);
  });

  it('keeps the client recovery subset byte-equal to canonical server routes', () => {
    const recoveryRoutes = [
      'docs-index',
      'public-compatibility',
      'public-home',
      'public-status',
      'public-support',
    ] as const satisfies readonly ClientRecoveryRouteId[];

    expect(CLIENT_WEB_LOCALES).toEqual(routing.locales);
    for (const locale of routing.locales) {
      for (const routeId of recoveryRoutes) {
        expect(clientPublicBoundaryHref(routeId, locale)).toBe(publicBoundaryHref(routeId, locale));
      }
      expect(clientAccountBoundaryHref(locale)).toBe(`https://account.liiiraa.com/${locale}/login`);
    }
  });
});

describe('public CSP', () => {
  const headersFor = (runtimeMode: 'development' | 'production' | 'test') => {
    const builder = Reflect.get(publicConfig, 'buildPublicHeaderContract') as
      ((mode: typeof runtimeMode) => readonly { key: string; value: string }[]) | undefined;
    const contract = builder?.(runtimeMode) ?? publicConfig.publicHeaderContract;

    return Object.fromEntries(contract.map(({ key, value }) => [key.toLowerCase(), value]));
  };

  it('constructs an explicit development policy for React and Turbopack debugging', () => {
    expect(Reflect.get(publicConfig, 'buildPublicHeaderContract')).toBeTypeOf('function');

    const enforced = headersFor('development')['content-security-policy'];
    const scriptDirective = enforced
      ?.split(';')
      .find((directive) => directive.trim().startsWith('script-src'));

    expect(scriptDirective).toBe(" script-src 'self' 'unsafe-inline' 'unsafe-eval'");
    expect(scriptDirective?.match(/'unsafe-eval'/gu)).toHaveLength(1);
  });

  it.each(['production', 'test'] as const)(
    'keeps the %s policy no-eval while retaining the public static contract',
    (runtimeMode) => {
      const headers = headersFor(runtimeMode);
      const enforced = headers['content-security-policy'];
      const reportOnly = headers['content-security-policy-report-only'];

      expect(enforced).toContain("script-src 'self' 'unsafe-inline'");
      expect(enforced).not.toContain("'unsafe-eval'");
      expect(reportOnly).toContain("script-src 'self'");
      expect(reportOnly).not.toContain("'unsafe-eval'");
      expect(enforced).toContain("frame-ancestors 'none'");
      expect(enforced).toContain("object-src 'none'");
      expect(enforced).toContain("base-uri 'none'");
      expect(enforced).toContain("form-action 'self'");
      expect(headers['cross-origin-opener-policy']).toBe('same-origin');
      expect(headers['cross-origin-resource-policy']).toBe('same-origin');
      expect(Object.keys(headers)).not.toContain('set-cookie');
    },
  );

  it('keeps the production origin cookie-free, frame-closed, and third-party-free', () => {
    const headers = headersFor('production');
    const enforced = headers['content-security-policy'];

    expect(enforced).toContain("default-src 'self'");
    expect(enforced).toContain("frame-ancestors 'none'");
    expect(enforced).toContain("object-src 'none'");
    expect(enforced).toContain("form-action 'self'");
    const scriptDirective = enforced
      ?.split(';')
      .find((directive) => directive.trim().startsWith('script-src'));

    expect(scriptDirective).not.toMatch(/https?:|data:|nonce-/u);
    expect(Object.keys(headers)).not.toContain('set-cookie');
    expect(publicConfig.publicCspProbe).toMatchObject({
      blockingDirectives: ['script-src', 'style-src'],
      status: 'report-only-blocked',
    });
  });
});
