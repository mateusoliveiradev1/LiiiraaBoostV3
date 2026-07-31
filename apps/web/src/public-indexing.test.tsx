import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  projectIndexing,
  projectSitemap,
  WEB_LOCALES,
  type RouteProjection,
} from '@liiiraa/web-core';

import { PublicNotFound } from './public-not-found';
import {
  projectPublicRobots,
  projectPublicSitemap,
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

    expect(sitemap).toHaveLength(canonical.length * WEB_LOCALES.length);

    for (const route of canonical) {
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
      projectPublicSitemap([...canonical, requireRoute(projectIndexing(), 'account-overview')]),
    ).toThrow('PROJECTION_PRIVATE_LEAK');
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
    const portuguese = renderToStaticMarkup(createElement(PublicNotFound, { locale: 'pt-BR' }));
    const english = renderToStaticMarkup(createElement(PublicNotFound, { locale: 'en' }));

    expect(portuguese).toContain('<h1');
    expect(portuguese).toContain('Página não encontrada');
    expect(portuguese).toContain('/pt-BR/docs');
    expect(english).toContain('Page not found');
    expect(english).toContain('/en/support');

    for (const output of [portuguese, english]) {
      expect(output).toContain('public-error-404');
      expect(output).not.toMatch(/http-equiv=.refresh|window\.location|request|stack/iu);
    }
  });
});
