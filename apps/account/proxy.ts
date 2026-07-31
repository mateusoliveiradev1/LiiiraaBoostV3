import {
  createBoundaryLink,
  isWebRouteId,
  matchWebRoute,
  WEB_LOCALES,
  type WebLocale,
  type WebRouteId,
} from '@liiiraa/web-core';
import { NextResponse, type NextRequest } from 'next/server';

export type AccountSafeContext = Readonly<{
  destination?: WebRouteId;
  locale: WebLocale;
  returnPath?: WebRouteId;
}>;

const EMPTY_POLICIES = Object.freeze([
  'camera=()',
  'geolocation=()',
  'microphone=()',
  'payment=()',
  'usb=()',
]);

const createContentSecurityPolicy = (nonce: string): string =>
  [
    "default-src 'self'",
    "base-uri 'none'",
    "connect-src 'self'",
    "font-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "img-src 'self' data:",
    "manifest-src 'self'",
    "media-src 'self'",
    "object-src 'none'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'nonce-${nonce}'`,
    "worker-src 'self'",
  ].join('; ');

export const createRequestNonce = (): string => {
  const entropy = globalThis.crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...entropy));
};

export const accountHeaderContract = (
  nonce: string,
): readonly Readonly<{ key: string; value: string }>[] =>
  Object.freeze([
    Object.freeze({ key: 'Cache-Control', value: 'private, no-store, max-age=0' }),
    Object.freeze({
      key: 'Content-Security-Policy',
      value: createContentSecurityPolicy(nonce),
    }),
    Object.freeze({ key: 'Cross-Origin-Opener-Policy', value: 'same-origin' }),
    Object.freeze({ key: 'Cross-Origin-Resource-Policy', value: 'same-origin' }),
    Object.freeze({ key: 'Permissions-Policy', value: EMPTY_POLICIES.join(', ') }),
    Object.freeze({ key: 'Referrer-Policy', value: 'no-referrer' }),
    Object.freeze({ key: 'X-Content-Type-Options', value: 'nosniff' }),
    Object.freeze({ key: 'X-Frame-Options', value: 'DENY' }),
    Object.freeze({ key: 'X-Robots-Tag', value: 'noindex,nofollow,noarchive' }),
  ]);

const localeFromUrl = (url: URL): WebLocale => {
  const localeSegment = url.pathname.split('/').filter(Boolean)[0];
  return WEB_LOCALES.find((locale) => locale === localeSegment) ?? 'pt-BR';
};

const asRouteId = (value: string | null): WebRouteId | undefined =>
  value !== null && isWebRouteId(value) ? value : undefined;

export const accountContextFromUrl = (url: URL): AccountSafeContext => {
  const locale = localeFromUrl(url);
  const destination = asRouteId(url.searchParams.get('destination'));
  const returnPath = asRouteId(url.searchParams.get('returnPath'));

  if (destination === undefined && returnPath === undefined) {
    return Object.freeze({ locale });
  }

  const validation = createBoundaryLink({
    context: {
      locale,
      ...(destination === undefined ? {} : { requestedDestination: destination }),
      ...(returnPath === undefined ? {} : { returnRouteId: returnPath }),
    },
    fromRouteId: returnPath ?? 'public-home',
    toRouteId: 'account-overview',
  });

  if (!validation.ok) {
    return Object.freeze({ locale });
  }

  return Object.freeze({
    ...(destination === undefined ? {} : { destination }),
    locale,
    ...(returnPath === undefined ? {} : { returnPath }),
  });
};

export default function accountProxy(request: NextRequest): NextResponse {
  const nonce = createRequestNonce();
  const requestHeaders = new Headers(request.headers);
  const safeContext = accountContextFromUrl(request.nextUrl);
  const headerContract = accountHeaderContract(nonce);
  const contentSecurityPolicy = headerContract.find(
    ({ key }) => key === 'Content-Security-Policy',
  )?.value;

  requestHeaders.set('x-liiiraa-account-context', JSON.stringify(safeContext));
  requestHeaders.set('x-liiiraa-preview-authority', 'disconnected');
  requestHeaders.set('x-nonce', nonce);
  if (contentSecurityPolicy !== undefined) {
    requestHeaders.set('Content-Security-Policy', contentSecurityPolicy);
  }

  const routeMatch = matchWebRoute({
    pathname: request.nextUrl.pathname,
    securityBoundary: 'account-origin',
  });
  const isNotFound =
    !routeMatch.ok || routeMatch.value.route.id === 'account-error-404';
  if (isNotFound) {
    requestHeaders.set('x-liiiraa-account-failure-kind', '404');
  }
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
    ...(isNotFound ? { status: 404 } : {}),
  });

  for (const { key, value } of headerContract) {
    response.headers.set(key, value);
  }

  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
