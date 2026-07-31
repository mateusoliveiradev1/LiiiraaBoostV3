import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  projectIndexing,
  projectSitemap,
  WEB_LOCALES,
  type RouteProjection,
} from '@liiiraa/web-core';
import { createPublicNotFoundModel } from './public-not-found';
import {
  projectPublicRobots,
  projectPublicSitemap,
  projectPublicSitemapCoverage,
  routePatternForRobots,
} from './public-indexing';

const requireRoute = (routes: readonly RouteProjection[], routeId: string): RouteProjection => {
  const route = routes.find(({ id }) => id === routeId);

  if (route === undefined) {
    throw new Error(`Test fixture route missing: ${routeId}`);
  }

  return route;
};

describe('sitemap', () => {
  it('projects every canonical indexable public route in both locales', () => {
    const canonical = projectSitemap();
    const sitemap = projectPublicSitemap();
    const coverage = projectPublicSitemapCoverage();
    const concrete = canonical.filter(({ id }) => coverage.concreteRouteIds.includes(id));

    expect(sitemap).toHaveLength(concrete.length * WEB_LOCALES.length);
    expect(coverage.concreteRouteIds.length + coverage.unresolvedRouteIds.length).toBe(
      canonical.length,
    );
    expect(coverage.unresolvedRouteIds).toContain('docs-article');
    expect(sitemap.every(({ url }) => !url.includes('['))).toBe(true);

    for (const route of concrete) {
      for (const locale of WEB_LOCALES) {
        expect(sitemap).toContainEqual(
          expect.objectContaining({
            id: route.id,
            locale,
            url: expect.stringContaining(`/${locale}`),
          }),
        );
      }
    }

    expect(() => projectPublicSitemap(canonical.slice(1))).toThrow('PROJECTION_MISSING_ROUTE');
    expect(() =>
      projectPublicSitemap([
        ...canonical,
        {
          ...requireRoute(projectIndexing(), 'account-overview'),
          indexing: 'index',
          scenarioRequirement: 'available',
        },
      ]),
    ).toThrow(/PROJECTION_(PRIVATE_LEAK|UNKNOWN_ROUTE)/u);
  });
});

describe('robots', () => {
  it('blocks private, preview, obsolete, error, and internal-search route classes', () => {
    const indexing = projectIndexing();
    const robots = projectPublicRobots(indexing);
    const forbiddenRouteIds = [
      'account-overview',
      'admin-role',
      'docs-history',
      'public-error-404',
      'public-search',
      'releases-download',
    ] as const;

    expect(robots.disallow).toEqual(expect.arrayContaining(['/_next/', '/api/', '/_vercel/']));

    for (const routeId of forbiddenRouteIds) {
      const route = requireRoute(indexing, routeId);

      for (const locale of WEB_LOCALES) {
        expect(robots.disallow).toContain(routePatternForRobots(route, locale));
      }
    }

    expect(robots.disallow).not.toContain('/pt-BR/product');
    expect(robots.disallow).not.toContain('/en/docs');
  });
});

describe('404', () => {
  it('renders an explicit localized recovery state without redirecting or leaking request data', () => {
    const portuguese = createPublicNotFoundModel('pt-BR');
    const english = createPublicNotFoundModel('en');
    const componentSource = readFileSync(new URL('./public-not-found.ts', import.meta.url), 'utf8');

    expect(componentSource).toMatch(/createElement\(\s*['"]h1['"]/u);
    expect(componentSource).toContain('tabIndex: -1');
    expect(portuguese.copy.title).toBe('Página não encontrada');
    expect(portuguese.destinations.documentation).toBe('/pt-BR/docs');
    expect(english.copy.title).toBe('Page not found');
    expect(english.destinations.support).toBe('/en/support');

    for (const model of [portuguese, english]) {
      expect(model.routeId).toBe('public-error-404');
      expect(model.diagnosticId).toBe('LB-WEB-404');
    }

    expect(componentSource).not.toMatch(
      /http-equiv=.refresh|window\.location|redirect\(|pathname|stack trace|request-id/iu,
    );
  });
});
