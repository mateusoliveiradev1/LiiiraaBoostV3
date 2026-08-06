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

type PublicAccountRouteId = 'account-sign-in' | 'account-sign-up';

const exactAccountOrigin = (value: string): string => {
  const candidate = new URL(value);
  if (
    candidate.protocol !== 'https:' ||
    candidate.origin !== value ||
    candidate.pathname !== '/' ||
    candidate.username.length > 0 ||
    candidate.password.length > 0
  ) {
    throw new Error('Account boundary origin must be an exact credential-free HTTPS origin.');
  }
  return candidate.origin;
};

export const accountRouteBoundaryHref = (
  routeId: PublicAccountRouteId,
  locale: WebLocale,
  origin = WEB_ORIGINS['account-origin'],
): string => {
  const accountRoute = publicRoutes.find(({ id }) => id === routeId);

  if (accountRoute === undefined || accountRoute.securityBoundary !== 'account-origin') {
    throw new Error(`Canonical account route is unavailable: ${routeId}`);
  }

  return `${exactAccountOrigin(origin)}${localizedPublicHref(accountRoute, locale)}`;
};

export const accountBoundaryHref = (locale: WebLocale): string =>
  accountRouteBoundaryHref('account-sign-in', locale);
