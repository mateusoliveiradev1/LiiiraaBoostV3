import {
  projectIndexing,
  projectNavigation,
  routeHref,
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

  if (route?.securityBoundary !== 'public-origin') {
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

type PublicAccountRouteId = 'account-overview' | 'account-sign-in' | 'account-sign-up';

export const STAGING_ACCOUNT_ORIGIN = 'https://liiiraa-boost-account-staging.vercel.app';

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

export const resolveAccountBoundaryOrigin = (
  configuredOrigin: string | undefined,
  providerPreview: boolean,
): string =>
  exactAccountOrigin(
    configuredOrigin ?? (providerPreview ? STAGING_ACCOUNT_ORIGIN : WEB_ORIGINS['account-origin']),
  );

export const accountRouteBoundaryHref = (
  routeId: PublicAccountRouteId,
  locale: WebLocale,
  origin = WEB_ORIGINS['account-origin'],
): string => {
  const accountRoute = publicRoutes.find(({ id }) => id === routeId);

  if (accountRoute?.securityBoundary !== 'account-origin') {
    throw new Error(`Canonical account route is unavailable: ${routeId}`);
  }

  const href = routeHref(routeId, { locale });
  if (!href.ok) {
    throw new Error(`Canonical account route could not be localized: ${routeId}`);
  }

  return `${exactAccountOrigin(origin)}${href.value}`;
};

export const accountBoundaryHref = (locale: WebLocale): string =>
  accountRouteBoundaryHref('account-sign-in', locale);
