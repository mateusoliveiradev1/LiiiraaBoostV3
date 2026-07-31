import {
  projectIndexing,
  projectNavigation,
  WEB_LOCALES,
  WEB_ORIGINS,
  type RouteProjection,
  type WebLocale,
} from '@liiiraa/web-core';
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  defaultLocale: 'pt-BR',
  localeCookie: false,
  localeDetection: false,
  localePrefix: 'always',
  locales: WEB_LOCALES,
});

export const publicNavigation = projectNavigation('public');

const publicRoutes = projectIndexing();

export const publicRouteById = (routeId: string): RouteProjection => {
  const route = publicRoutes.find(({ id }) => id === routeId);

  if (route === undefined || route.securityBoundary !== 'public-origin') {
    throw new Error(`Canonical public route is unavailable: ${routeId}`);
  }

  return route;
};

export const localizedPublicHref = (
  route: Pick<RouteProjection, 'href'>,
  locale: WebLocale,
): string => route.href.replace('[locale]', locale);

export const publicBoundaryHref = (routeId: string, locale: WebLocale): string =>
  localizedPublicHref(publicRouteById(routeId), locale);

export const accountBoundaryHref = (locale: WebLocale): string => {
  const accountRoute = publicRoutes.find(({ id }) => id === 'account-sign-in');

  if (accountRoute === undefined || accountRoute.securityBoundary !== 'account-origin') {
    throw new Error('Canonical account sign-in route is unavailable.');
  }

  return `${WEB_ORIGINS['account-origin']}${localizedPublicHref(accountRoute, locale)}`;
};
