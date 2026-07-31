import { describe, expect, it } from 'vitest';
import { validateWebDocument } from '@liiiraa/contracts-ts';
import {
  auditRouteProjection,
  createBoundaryLink,
  matchWebRoute,
  projectBreadcrumbs,
  projectDesktopLinks,
  projectIndexing,
  projectNavigation,
  projectRedirects,
  projectSitemap,
  routeHref,
  webRoutes,
  type RouteProjection,
} from './routes.js';

const REQUIRED_ROUTE_IDS = Object.freeze([
  'public-home',
  'public-product',
  'public-evidence',
  'public-compatibility',
  'public-plans',
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
    expect(routeHref('missing-route' as never, { locale: 'en' })).toMatchObject({
      error: { code: 'UNKNOWN_ROUTE_ID' },
      ok: false,
    });
    expect(
      routeHref('public-home', { locale: 'en', unexpected: 'value' } as never),
    ).toMatchObject({
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
      'public-evidence',
      'public-compatibility',
      'public-plans',
      'docs-index',
      'releases-index',
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

    const mutationMatrix: ReadonlyArray<
      readonly [
        string,
        Parameters<typeof auditRouteProjection>[0],
        readonly RouteProjection[],
        string,
      ]
    > = [
      ['missing', 'navigation:public', navigation.slice(1), 'PROJECTION_MISSING_ROUTE'],
      [
        'extra',
        'navigation:public',
        [...navigation, { ...navigation[0]!, id: 'renamed-route' }],
        'PROJECTION_UNKNOWN_ROUTE',
      ],
      [
        'renamed href',
        'navigation:public',
        [{ ...navigation[0]!, href: '/en/renamed' }, ...navigation.slice(1)],
        'PROJECTION_ROUTE_DRIFT',
      ],
      [
        'duplicate',
        'navigation:public',
        [...navigation, navigation[0]!],
        'PROJECTION_DUPLICATE_ROUTE',
      ],
      [
        'unowned',
        'navigation:public',
        [{ ...navigation[0]!, owner: '' }, ...navigation.slice(1)],
        'PROJECTION_OWNER_DRIFT',
      ],
      [
        'private leak',
        'navigation:public',
        [...navigation, accountRoute!],
        'PROJECTION_PRIVATE_LEAK',
      ],
      [
        'noindex leak',
        'sitemap',
        [...sitemap, searchRoute!],
        'PROJECTION_NOINDEX_LEAK',
      ],
      [
        'scenario leak',
        'sitemap',
        [...sitemap, previewRoute!],
        'PROJECTION_SCENARIO_LEAK',
      ],
      [
        'redirect drift',
        'redirects',
        [{ ...redirects[0]!, href: '/en/renamed' }, ...redirects.slice(1)],
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
