import type { WebLocale } from '@liiiraa/web-core';

export const CLIENT_WEB_LOCALES = Object.freeze([
  'pt-BR',
  'en',
] as const satisfies readonly WebLocale[]);

export type ClientRecoveryRouteId =
  'docs-index' | 'public-compatibility' | 'public-home' | 'public-status' | 'public-support';

const assertNever = (value: never): never => {
  throw new Error(`Unreachable client recovery route: ${String(value)}`);
};

export const clientPublicBoundaryHref = (
  routeId: ClientRecoveryRouteId,
  locale: WebLocale,
): string => {
  switch (routeId) {
    case 'public-home':
      return `/${locale}`;
    case 'docs-index':
      return `/${locale}/docs`;
    case 'public-compatibility':
      return `/${locale}/compatibility`;
    case 'public-status':
      return `/${locale}/status`;
    case 'public-support':
      return `/${locale}/support`;
    default:
      return assertNever(routeId);
  }
};

export const clientAccountBoundaryHref = (locale: WebLocale): string =>
  `https://account.liiiraa.com/${locale}/sign-in`;
