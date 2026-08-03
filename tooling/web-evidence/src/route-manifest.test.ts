import { readFileSync } from 'node:fs';

import { WEB_LOCALES, webRoutes } from '@liiiraa/web-core';
import { describe, expect, it } from 'vitest';

import {
  inspectRouteEvidence,
  inspectWorkspaceReadiness,
  type RouteEvidence,
} from './web-evidence-harness.js';

const routeMatrixSource = readFileSync(
  new URL(
    '../../../.planning/phases/03-complete-web-experience/03-ROUTE-EXPERIENCE-MATRIX.md',
    import.meta.url,
  ),
  'utf8',
);

const finalRouteExperienceSource = readFileSync(
  new URL('../tests/final-route-experience.spec.ts', import.meta.url),
  'utf8',
);

const completeRouteEvidence = (): RouteEvidence => ({
  routes: [
    {
      id: 'public-home',
      owner: 'public-navigation',
      safeContextKeys: ['locale'],
      surface: 'public',
    },
    {
      id: 'docs-index',
      owner: 'docs-content',
      safeContextKeys: ['locale', 'version'],
      surface: 'public',
    },
  ],
  expectedRouteIds: ['public-home', 'docs-index'],
  navigationRouteIds: ['public-home'],
  expectedNavigationRouteIds: ['public-home'],
  sitemapRouteIds: ['public-home', 'docs-index'],
  expectedSitemapRouteIds: ['public-home', 'docs-index'],
  redirectRouteIds: ['public-home', 'docs-index'],
  expectedRedirectRouteIds: ['public-home', 'docs-index'],
  desktopLinkRouteIds: ['docs-index'],
  expectedDesktopLinkRouteIds: ['docs-index'],
});

describe('web evidence harness self-test: route manifest', () => {
  it('accepts a complete isolated route fixture', () => {
    expect(inspectRouteEvidence(completeRouteEvidence())).toEqual({
      diagnostics: [],
      ok: true,
    });
  });

  it.each([
    [
      'missing route',
      (fixture: RouteEvidence) => ({
        ...fixture,
        routes: fixture.routes.filter(({ id }) => id !== 'docs-index'),
      }),
      'MISSING_ROUTE',
    ],
    [
      'missing navigation projection',
      (fixture: RouteEvidence) => ({ ...fixture, navigationRouteIds: [] }),
      'MISSING_NAVIGATION_ROUTE',
    ],
    [
      'missing sitemap projection',
      (fixture: RouteEvidence) => ({ ...fixture, sitemapRouteIds: [] }),
      'MISSING_SITEMAP_ROUTE',
    ],
    [
      'missing redirect projection',
      (fixture: RouteEvidence) => ({ ...fixture, redirectRouteIds: [] }),
      'MISSING_REDIRECT_ROUTE',
    ],
    [
      'missing desktop-link projection',
      (fixture: RouteEvidence) => ({ ...fixture, desktopLinkRouteIds: [] }),
      'MISSING_DESKTOP_LINK_ROUTE',
    ],
    [
      'unsafe route context',
      (fixture: RouteEvidence) => ({
        ...fixture,
        routes: fixture.routes.map((route) =>
          route.id === 'docs-index'
            ? { ...route, safeContextKeys: [...route.safeContextKeys, 'token'] }
            : route,
        ),
      }),
      'UNSAFE_CONTEXT_KEY',
    ],
  ] as const)('detects %s with a stable diagnostic', (_name, mutate, expectedCode) => {
    expect(inspectRouteEvidence(mutate(completeRouteEvidence())).diagnostics[0]?.code).toBe(
      expectedCode,
    );
  });
});

describe('workspace readiness: route manifest', () => {
  it('fails closed for omitted real WEB-02 consumers', () => {
    const result = inspectWorkspaceReadiness({
      requirement: 'WEB-02',
      repositoryRoot: 'Z:/isolated-empty-workspace',
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe('MISSING_BUILD_ROOT');
  });

  it('rejects source directories as distributable route evidence', () => {
    const result = inspectWorkspaceReadiness({
      buildRoots: { public: 'apps/web/src' },
      requirement: 'WEB-02',
      repositoryRoot: '.',
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe('SOURCE_TREE_EVIDENCE_REJECTED');
  });
});

describe('D-100 complete canonical route experience contract', () => {
  it('binds every canonical route to both locales and all four required widths', () => {
    expect(routeMatrixSource).toContain('D-87 through D-110');
    expect(routeMatrixSource).toContain('`public-about`');
    expect(routeMatrixSource).toContain('1440');
    expect(routeMatrixSource).toContain('960');
    expect(routeMatrixSource).toContain('390');
    expect(routeMatrixSource).toContain('320');

    for (const route of webRoutes) {
      const familyMarker = `\`${route.surface}-error-403/404/410/500\``;
      expect(routeMatrixSource).toContain(
        /-error-(?:403|404|410|500)$/u.test(route.id) ? familyMarker : `\`${route.id}\``,
      );
    }

    expect(WEB_LOCALES).toEqual(['pt-BR', 'en']);
    expect(finalRouteExperienceSource).toContain('for (const route of webRoutes)');
    expect(finalRouteExperienceSource).toContain('for (const locale of WEB_LOCALES)');
    expect(finalRouteExperienceSource).not.toContain('isHighRisk');
  });

  it('keeps existing truth, origin, CSP, indexing, locale, accessibility, and fail-closed gates explicit', () => {
    for (const detector of [
      'expectNoBlockingAxeViolations',
      'expectRoutePreservingLocale',
      'expectSurfaceAuthority',
      'expectTargetsAndFocus',
      'FORBIDDEN_ORDINARY_COPY',
      'meta[name="robots"]',
      'a[href$=".exe"]',
    ]) {
      expect(finalRouteExperienceSource).toContain(detector);
    }
  });
});
