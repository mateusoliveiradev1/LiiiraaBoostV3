import {
  auditRouteProjection,
  projectIndexing,
  projectSitemap,
  WEB_LOCALES,
  WEB_ORIGINS,
  type RouteProjection,
  type WebLocale,
} from '@liiiraa/web-core';

export type PublicSitemapProjection = Readonly<{
  alternates: Readonly<Record<WebLocale, string>>;
  id: string;
  locale: WebLocale;
  url: string;
}>;

export type PublicRobotsProjection = Readonly<{
  allow: readonly string[];
  disallow: readonly string[];
  host: string;
  sitemap: string;
}>;

export type PublicSitemapCoverage = Readonly<{
  concreteRouteIds: readonly string[];
  unresolvedRouteIds: readonly string[];
}>;

const PUBLIC_ORIGIN = WEB_ORIGINS['public-origin'];
const INTERNAL_DISALLOW = Object.freeze(['/_next/', '/api/', '/_vercel/']);

const projectionFailure = (
  context: 'indexing' | 'sitemap',
  result: ReturnType<typeof auditRouteProjection>,
): never => {
  if (result.ok) {
    throw new Error(`Unexpected successful ${context} projection result.`);
  }

  throw new Error(`${context.toUpperCase()}_${result.error.code}:${result.error.path}`);
};

const assertProjection = (
  context: 'indexing' | 'sitemap',
  routes: readonly RouteProjection[],
): void => {
  const result = auditRouteProjection(context, routes);

  if (!result.ok) {
    projectionFailure(context, result);
  }
};

const localizedTemplate = (route: RouteProjection, locale: WebLocale): string =>
  route.href.replace('[locale]', locale);

const absoluteTemplate = (route: RouteProjection, locale: WebLocale): string =>
  new URL(localizedTemplate(route, locale), PUBLIC_ORIGIN).href;

const isConcreteSitemapRoute = (route: RouteProjection): boolean =>
  !localizedTemplate(route, WEB_LOCALES[0]).includes('[');

export const projectPublicSitemapCoverage = (
  routes: readonly RouteProjection[] = projectSitemap(),
): PublicSitemapCoverage => {
  assertProjection('sitemap', routes);

  return Object.freeze({
    concreteRouteIds: Object.freeze(routes.filter(isConcreteSitemapRoute).map(({ id }) => id)),
    unresolvedRouteIds: Object.freeze(
      routes.filter((route) => !isConcreteSitemapRoute(route)).map(({ id }) => id),
    ),
  });
};

export const projectPublicSitemap = (
  routes: readonly RouteProjection[] = projectSitemap(),
): readonly PublicSitemapProjection[] => {
  const coverage = projectPublicSitemapCoverage(routes);
  const concreteRouteIds = new Set(coverage.concreteRouteIds);

  return Object.freeze(
    routes
      .filter(({ id }) => concreteRouteIds.has(id))
      .flatMap((route) => {
        const alternates = Object.freeze(
          Object.fromEntries(
            WEB_LOCALES.map((locale) => [locale, absoluteTemplate(route, locale)]),
          ) as Record<WebLocale, string>,
        );

        return WEB_LOCALES.map((locale) =>
          Object.freeze({
            alternates,
            id: route.id,
            locale,
            url: absoluteTemplate(route, locale),
          }),
        );
      }),
  );
};

export const routePatternForRobots = (route: RouteProjection, locale: WebLocale): string =>
  localizedTemplate(route, locale).replace(/\[[^\]]+\]/gu, '*');

const mustDisallow = (route: RouteProjection): boolean =>
  route.surface !== 'public' ||
  route.indexing !== 'index' ||
  route.scenarioRequirement !== 'available' ||
  route.owner === 'public-errors';

export const projectPublicRobots = (
  routes: readonly RouteProjection[] = projectIndexing(),
): PublicRobotsProjection => {
  assertProjection('indexing', routes);

  const routePatterns = routes
    .filter(mustDisallow)
    .flatMap((route) => WEB_LOCALES.map((locale) => routePatternForRobots(route, locale)));

  return Object.freeze({
    allow: Object.freeze(['/', ...WEB_LOCALES.map((locale) => `/${locale}/`)]),
    disallow: Object.freeze([...new Set([...INTERNAL_DISALLOW, ...routePatterns])].sort()),
    host: PUBLIC_ORIGIN,
    sitemap: `${PUBLIC_ORIGIN}/sitemap.xml`,
  });
};
