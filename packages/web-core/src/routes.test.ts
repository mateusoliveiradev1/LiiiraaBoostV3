import { describe, expect, it } from 'vitest';
import { validateWebDocument } from '@liiiraa/contracts-ts/web-validation';
import {
  auditRouteProjection,
  createBoundaryLink,
  createDesktopAnalyzeLink,
  matchWebRoute,
  projectBreadcrumbs,
  projectDesktopLinks,
  projectIndexing,
  projectNavigation,
  projectRedirects,
  projectSitemap,
  resolveLocalizedCurrentRoute,
  routeHref,
  webRoutes,
  type RouteProjection,
} from './routes.ts';
import { createContentIdentity } from './content.ts';

const REQUIRED_ROUTE_IDS = Object.freeze([
  'public-home',
  'public-product',
  'public-results',
  'public-evidence',
  'public-compatibility',
  'public-plans',
  'public-download',
  'public-search',
  'public-support',
  'public-status',
  'public-policies',
  'public-privacy-policy',
  'public-terms',
  'public-responsible-disclosure',
  'docs-index',
  'docs-task',
  'docs-article',
  'docs-reference',
  'docs-troubleshooting',
  'docs-history',
  'releases-index',
  'releases-channel',
  'releases-version',
  'releases-integrity',
  'releases-download',
  'releases-install',
  'account-sign-in',
  'account-sign-up',
  'account-onboarding',
  'account-overview',
  'account-profile',
  'account-security',
  'account-subscription',
  'account-invoices',
  'account-device',
  'account-downloads',
  'account-privacy',
  'account-support',
  'admin-role',
  'admin-support',
  'admin-operations',
  'admin-security',
  'admin-diagnostics',
  'admin-audit',
  'admin-audit-event',
  'public-error-404',
  'public-error-403',
  'public-error-410',
  'public-error-500',
  'account-error-404',
  'account-error-403',
  'account-error-410',
  'account-error-500',
  'admin-error-404',
  'admin-error-403',
  'admin-error-410',
  'admin-error-500',
] as const);

const expectDeeplyFrozen = (value: unknown): void => {
  if (typeof value !== 'object' || value === null) {
    return;
  }
  expect(Object.isFrozen(value)).toBe(true);
  for (const nested of Object.values(value)) {
    expectDeeplyFrozen(nested);
  }
};

const requireProjection = (projection: RouteProjection | undefined): RouteProjection => {
  if (projection === undefined) {
    throw new Error('Expected canonical route projection');
  }
  return projection;
};

describe('localized current route projection', () => {
  const routeMatrix = Object.freeze([
    {
      boundary: 'public-origin',
      expected: '/en',
      pathname: '/pt-BR',
      routeId: 'public-home',
      targetLocale: 'en',
    },
    {
      boundary: 'public-origin',
      expected: '/pt-BR/docs/tasks/troubleshooting',
      pathname: '/en/docs/tasks/troubleshooting',
      routeId: 'docs-task',
      targetLocale: 'pt-BR',
    },
    {
      boundary: 'public-origin',
      expected: '/en/docs/1.0.0/articles/frame-pacing',
      pathname: '/pt-BR/docs/1.0.0/articles/frame-pacing',
      routeId: 'docs-article',
      targetLocale: 'en',
    },
    {
      boundary: 'public-origin',
      expected: '/pt-BR/docs/history/1.0.0/legacy-install',
      pathname: '/en/docs/history/1.0.0/legacy-install',
      routeId: 'docs-history',
      targetLocale: 'pt-BR',
    },
    {
      boundary: 'public-origin',
      expected: '/en/releases/beta/1.0.0/integrity',
      pathname: '/pt-BR/releases/beta/1.0.0/integrity',
      routeId: 'releases-integrity',
      targetLocale: 'en',
    },
    {
      boundary: 'public-origin',
      expected: '/pt-BR/download/experimental/current',
      pathname: '/en/download/experimental/current',
      routeId: 'releases-download',
      targetLocale: 'pt-BR',
    },
    {
      boundary: 'account-origin',
      expected: '/en/login',
      pathname: '/pt-BR/login',
      routeId: 'account-sign-in',
      targetLocale: 'en',
    },
    {
      boundary: 'account-origin',
      expected: '/en/account/profile',
      pathname: '/pt-BR/account/profile',
      routeId: 'account-profile',
      targetLocale: 'en',
    },
    {
      boundary: 'admin-origin',
      expected: '/pt-BR/admin/support/CASE-2048',
      pathname: '/en/admin/support/CASE-2048',
      routeId: 'admin-support',
      targetLocale: 'pt-BR',
    },
    {
      boundary: 'admin-origin',
      expected: '/en/admin/security/REVIEW-8',
      pathname: '/pt-BR/admin/security/REVIEW-8',
      routeId: 'admin-security',
      targetLocale: 'en',
    },
  ] as const);

  it('changes only the locale while preserving the canonical route and path parameters', () => {
    for (const entry of routeMatrix) {
      const source = matchWebRoute({
        pathname: entry.pathname,
        securityBoundary: entry.boundary,
      });
      expect(source, entry.routeId).toMatchObject({
        ok: true,
        value: { route: { id: entry.routeId } },
      });

      const localized = resolveLocalizedCurrentRoute({
        pathname: entry.pathname,
        securityBoundary: entry.boundary,
        targetLocale: entry.targetLocale,
      });
      expect(localized, entry.routeId).toEqual({ ok: true, value: entry.expected });

      if (source.ok && localized.ok) {
        const projected = matchWebRoute({
          pathname: localized.value,
          securityBoundary: entry.boundary,
        });
        expect(projected, entry.routeId).toMatchObject({
          ok: true,
          value: {
            parameters: { ...source.value.parameters, locale: entry.targetLocale },
            route: { id: source.value.route.id },
          },
        });
      }
    }
  });

  it('keeps profile, support case, documentation identity, and release identity unchanged', () => {
    expect(routeMatrix).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ routeId: 'account-profile' }),
        expect.objectContaining({ pathname: expect.stringContaining('CASE-2048') }),
        expect.objectContaining({ pathname: expect.stringContaining('frame-pacing') }),
        expect.objectContaining({ pathname: expect.stringContaining('/beta/1.0.0/') }),
      ]),
    );
  });

  it.each([
    ['', 'public-origin', 'en', 'EMPTY_PATHNAME'],
    ['not-a-path', 'public-origin', 'en', 'UNSAFE_PATHNAME'],
    ['/pt-BR/account/profile', 'public-origin', 'en', 'UNKNOWN_ROUTE'],
    ['/pt-BR/admin/support/CASE-2048', 'account-origin', 'en', 'UNKNOWN_ROUTE'],
    ['/pt-BR/unknown', 'public-origin', 'en', 'UNKNOWN_ROUTE'],
    ['/pt-BR/docs?version=current', 'public-origin', 'en', 'UNSAFE_PATHNAME'],
    ['/pt-BR/releases#stable', 'public-origin', 'en', 'UNSAFE_PATHNAME'],
    ['/es/account/profile', 'account-origin', 'en', 'INVALID_LOCALE'],
    ['https://user:secret@evil.example/pt-BR', 'public-origin', 'en', 'UNSAFE_PATHNAME'],
    ['/pt-BR/account/profile', 'account-origin', 'es', 'INVALID_LOCALE'],
  ] as const)(
    'fails closed for unsafe locale projection input %s',
    (pathname, securityBoundary, targetLocale, code) => {
      expect(
        resolveLocalizedCurrentRoute({
          pathname,
          securityBoundary,
          targetLocale: targetLocale as never,
        }),
      ).toMatchObject({ error: { code }, ok: false });
    },
  );
});

describe('canonical web route manifest', () => {
  it('contains each required route family exactly once as a generated-valid frozen record', () => {
    expect(webRoutes.map(({ id }) => id)).toEqual(REQUIRED_ROUTE_IDS);
    expect(new Set(webRoutes.map(({ id }) => id)).size).toBe(webRoutes.length);

    for (const route of webRoutes) {
      expect(validateWebDocument(route)).toMatchObject({ ok: true });
      expect(route.owner.length).toBeGreaterThan(0);
      expect(route.localePolicy).toBe('required');
      expect(route.securityBoundary).toBe(`${route.surface}-origin`);
      expectDeeplyFrozen(route);
    }
    expectDeeplyFrozen(webRoutes);
  });

  it('resolves exact localized parameters and rejects unknown routes, parameters, and origins', () => {
    expect(
      routeHref('docs-troubleshooting', {
        code: 'LB-403',
        locale: 'pt-BR',
        version: '1.0.0',
      }),
    ).toEqual({
      ok: true,
      value: '/pt-BR/docs/1.0.0/troubleshooting/LB-403',
    });
    expect(routeHref('missing-route', { locale: 'en' })).toMatchObject({
      error: { code: 'UNKNOWN_ROUTE_ID' },
      ok: false,
    });
    expect(routeHref('public-home', { locale: 'en', unexpected: 'value' })).toMatchObject({
      error: { code: 'UNKNOWN_PARAMETER' },
      ok: false,
    });
    expect(
      matchWebRoute({
        pathname: '/pt-BR/docs/1.0.0/troubleshooting/LB-403',
        securityBoundary: 'public-origin',
      }),
    ).toMatchObject({
      ok: true,
      value: {
        parameters: { code: 'LB-403', locale: 'pt-BR', version: '1.0.0' },
        route: { id: 'docs-troubleshooting' },
      },
    });
    expect(
      matchWebRoute({
        pathname: 'https://evil.example/pt-BR',
        securityBoundary: 'public-origin',
      }),
    ).toMatchObject({ error: { code: 'UNSAFE_PATHNAME' }, ok: false });
    expect(
      matchWebRoute({
        pathname: '/pt-BR/account',
        securityBoundary: 'evil-origin' as never,
      }),
    ).toMatchObject({ error: { code: 'UNKNOWN_ORIGIN' }, ok: false });
  });

  it('derives private-safe navigation, breadcrumbs, sitemap, redirects, desktop links, and indexing', () => {
    expect(projectNavigation('public').map(({ id }) => id)).toEqual([
      'public-product',
      'public-results',
      'public-compatibility',
      'public-plans',
      'public-download',
      'public-support',
    ]);
    expect(projectNavigation('account').map(({ id }) => id)).toEqual([
      'account-overview',
      'account-profile',
      'account-security',
      'account-subscription',
      'account-invoices',
      'account-device',
      'account-downloads',
      'account-privacy',
      'account-support',
    ]);
    expect(projectNavigation('admin').map(({ id }) => id)).toEqual([
      'admin-role',
      'admin-support',
      'admin-operations',
      'admin-security',
      'admin-audit',
    ]);

    expect(projectBreadcrumbs('docs-troubleshooting').map(({ id }) => id)).toEqual([
      'public-home',
      'docs-index',
      'docs-troubleshooting',
    ]);
    expect(projectSitemap().every((entry) => entry.surface === 'public')).toBe(true);
    expect(projectSitemap().every((entry) => entry.indexing === 'index')).toBe(true);
    expect(projectRedirects().length).toBeGreaterThan(0);
    expect(projectDesktopLinks().map(({ id }) => id)).toContain('docs-article');
    expect(projectIndexing()).toHaveLength(webRoutes.length);
  });

  it('creates only canonical cross-origin links with the target route safe-context allowlist', () => {
    expect(
      createBoundaryLink({
        context: {
          locale: 'pt-BR',
          requestedDestination: 'account-subscription',
          returnRouteId: 'public-plans',
        },
        fromRouteId: 'public-plans',
        toRouteId: 'account-overview',
      }),
    ).toEqual({
      ok: true,
      value: {
        crossesBoundary: true,
        from: 'public-origin',
        href:
          'https://account.liiiraa.com/pt-BR/account' +
          '?destination=account-subscription&returnPath=public-plans',
        preservedContext: {
          locale: 'pt-BR',
          requestedDestination: 'account-subscription',
          returnRouteId: 'public-plans',
        },
        to: 'account-origin',
      },
    });
    expect(
      createBoundaryLink({
        context: {
          locale: 'en',
          section: 'troubleshooting',
          version: 'current',
        },
        fromRouteId: 'public-support',
        toRouteId: 'docs-task',
      }),
    ).toMatchObject({
      ok: true,
      value: {
        href: 'https://liiiraa.com/en/docs/tasks/troubleshooting?version=current',
        preservedContext: {
          locale: 'en',
          section: 'troubleshooting',
          version: 'current',
        },
      },
    });
    expect(
      createBoundaryLink({
        context: { locale: 'es' as never },
        fromRouteId: 'public-home',
        toRouteId: 'account-overview',
      }),
    ).toMatchObject({ error: { code: 'UNSAFE_LOCALE' }, ok: false });
    expect(
      createBoundaryLink({
        context: { locale: 'en', session: 'secret' } as never,
        fromRouteId: 'public-home',
        toRouteId: 'account-overview',
      }),
    ).toMatchObject({ error: { code: 'UNSAFE_CONTEXT_KEY' }, ok: false });
    expect(
      createBoundaryLink({
        context: { locale: 'en', returnRouteId: 'admin-role' },
        fromRouteId: 'public-home',
        toRouteId: 'account-overview',
      }),
    ).toMatchObject({ error: { code: 'UNSAFE_RETURN_ROUTE' }, ok: false });
  });

  it('creates only the allowlisted desktop analysis action without URL state', () => {
    expect(createDesktopAnalyzeLink()).toBe('liiiraaboost://analyze');
    expect(createDesktopAnalyzeLink()).not.toContain('?');
    expect(createDesktopAnalyzeLink()).not.toContain('#');
  });

  it('derives localized content identity and ownership from the canonical route', () => {
    expect(
      createContentIdentity({
        channel: 'stable',
        locale: 'pt-BR',
        routeId: 'docs-article',
        version: '1.0.0',
      }),
    ).toEqual({
      ok: true,
      value: {
        channel: 'stable',
        indexing: 'index',
        locale: 'pt-BR',
        owner: 'docs-content',
        routeId: 'docs-article',
        version: '1.0.0',
      },
    });
    expect(
      createContentIdentity({
        channel: 'stable',
        locale: 'es',
        routeId: 'docs-article',
        version: '1.0.0',
      }),
    ).toMatchObject({ error: { code: 'INVALID_LOCALE' }, ok: false });
  });

  it('fails every seeded consumer omission, addition, rename, duplicate, owner, leak, and redirect mutation', () => {
    const navigation = projectNavigation('public');
    const sitemap = projectSitemap();
    const redirects = projectRedirects();
    const accountRoute = projectIndexing().find(({ id }) => id === 'account-overview');
    const searchRoute = projectIndexing().find(({ id }) => id === 'public-search');
    const previewRoute = projectIndexing().find(({ id }) => id === 'releases-download');
    expect(accountRoute).toBeDefined();
    expect(searchRoute).toBeDefined();
    expect(previewRoute).toBeDefined();

    const firstNavigation = requireProjection(navigation[0]);
    const firstRedirect = requireProjection(redirects[0]);
    const mutationMatrix: readonly (readonly [
      string,
      Parameters<typeof auditRouteProjection>[0],
      readonly RouteProjection[],
      string,
    ])[] = [
      ['missing', 'navigation:public', navigation.slice(1), 'PROJECTION_MISSING_ROUTE'],
      [
        'extra',
        'navigation:public',
        [...navigation, { ...firstNavigation, id: 'renamed-route' }],
        'PROJECTION_UNKNOWN_ROUTE',
      ],
      [
        'renamed href',
        'navigation:public',
        [{ ...firstNavigation, href: '/en/renamed' }, ...navigation.slice(1)],
        'PROJECTION_ROUTE_DRIFT',
      ],
      [
        'duplicate',
        'navigation:public',
        [...navigation, firstNavigation],
        'PROJECTION_DUPLICATE_ROUTE',
      ],
      [
        'unowned',
        'navigation:public',
        [{ ...firstNavigation, owner: '' }, ...navigation.slice(1)],
        'PROJECTION_OWNER_DRIFT',
      ],
      [
        'private leak',
        'navigation:public',
        [...navigation, requireProjection(accountRoute)],
        'PROJECTION_PRIVATE_LEAK',
      ],
      [
        'noindex leak',
        'sitemap',
        [...sitemap, requireProjection(searchRoute)],
        'PROJECTION_NOINDEX_LEAK',
      ],
      [
        'scenario leak',
        'sitemap',
        [...sitemap, requireProjection(previewRoute)],
        'PROJECTION_SCENARIO_LEAK',
      ],
      [
        'redirect drift',
        'redirects',
        [{ ...firstRedirect, href: '/en/renamed' }, ...redirects.slice(1)],
        'PROJECTION_REDIRECT_DRIFT',
      ],
    ];

    for (const [name, consumer, entries, code] of mutationMatrix) {
      expect(auditRouteProjection(consumer, entries), name).toMatchObject({
        error: { code },
        ok: false,
      });
    }
  });
});
