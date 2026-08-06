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

const createContentSecurityPolicy = (nonce: string, runtimeMode: string | undefined): string =>
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
    [
      `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
      runtimeMode === 'development' ? "'unsafe-eval'" : undefined,
    ]
      .filter((directive): directive is string => directive !== undefined)
      .join(' '),
    `style-src 'self' 'nonce-${nonce}'`,
    "worker-src 'self'",
  ].join('; ');

export const createRequestNonce = (): string => {
  const entropy = globalThis.crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...entropy));
};

export const accountHeaderContract = (
  nonce: string,
  runtimeMode: string | undefined,
): readonly Readonly<{ key: string; value: string }>[] =>
  Object.freeze([
    Object.freeze({ key: 'Cache-Control', value: 'private, no-store, max-age=0' }),
    Object.freeze({
      key: 'Content-Security-Policy',
      value: createContentSecurityPolicy(nonce, runtimeMode),
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
  const localeSegment = url.pathname.split('/').find(Boolean);
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

const INVITATION_TOKEN = /^[A-Za-z0-9_-]{32,512}$/u;

const accountRootDestination = (request: NextRequest): URL | undefined => {
  if (request.nextUrl.pathname === '/') {
    return new URL('/pt-BR/login', request.nextUrl.origin);
  }
  const root = /^\/(en|pt-BR)\/?$/u.exec(request.nextUrl.pathname);
  if (root === null) return undefined;

  const locale = root[1] as WebLocale;
  const invitation =
    request.nextUrl.searchParams.get('invitation') ?? request.nextUrl.searchParams.get('invite');
  const destination = new URL(`/${locale}/login`, request.nextUrl.origin);
  if (invitation !== null && INVITATION_TOKEN.test(invitation)) {
    destination.pathname = locale === 'pt-BR' ? '/pt-BR/cadastro' : '/en/register';
    destination.searchParams.set('invitation', invitation);
  }
  return destination;
};

const localizedLegacyDestination = (request: NextRequest): URL | undefined => {
  if (request.nextUrl.pathname !== '/pt-BR/register') return undefined;

  const destination = request.nextUrl.clone();
  destination.pathname = '/pt-BR/cadastro';
  return destination;
};

export default function accountProxy(request: NextRequest): NextResponse {
  if (request.nextUrl.pathname === '/v1' || request.nextUrl.pathname.startsWith('/v1/')) {
    return NextResponse.next();
  }

  const nonce = createRequestNonce();
  const headerContract = accountHeaderContract(nonce, process.env.NODE_ENV);
  const rootDestination = accountRootDestination(request);
  const redirectDestination = rootDestination ?? localizedLegacyDestination(request);
  if (redirectDestination !== undefined) {
    const response = NextResponse.redirect(redirectDestination, 307);
    for (const { key, value } of headerContract) response.headers.set(key, value);
    return response;
  }

  const requestHeaders = new Headers(request.headers);
  const safeContext = accountContextFromUrl(request.nextUrl);
  const contentSecurityPolicy = headerContract.find(
    ({ key }) => key === 'Content-Security-Policy',
  )?.value;

  requestHeaders.set('x-liiiraa-account-context', JSON.stringify(safeContext));
  requestHeaders.delete('x-liiiraa-preview-authority');
  if (process.env['LIIIRAA_ACCOUNT_PREVIEW'] === 'true') {
    requestHeaders.set('x-liiiraa-preview-authority', 'disconnected');
  }
  requestHeaders.set('x-nonce', nonce);
  if (contentSecurityPolicy !== undefined) {
    requestHeaders.set('Content-Security-Policy', contentSecurityPolicy);
  }

  const routeMatch = matchWebRoute({
    pathname: request.nextUrl.pathname,
    securityBoundary: 'account-origin',
  });
  const isNotFound = !routeMatch.ok || routeMatch.value.route.id === 'account-error-404';
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
  matcher: ['/((?!api|v1|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
