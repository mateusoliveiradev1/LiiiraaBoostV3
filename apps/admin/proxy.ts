import { NextResponse, type NextRequest } from 'next/server';

import {
  ADMIN_CANONICAL_ENTRY,
  ADMIN_DENIAL_COPY,
  resolveAdminOrigin,
  type AdminLocale,
} from './src/admin-runtime';

export const ADMIN_PREVIEW_ROLES = Object.freeze([
  'support',
  'operations',
  'security',
  'audit',
] as const);

export type AdminPreviewRole = (typeof ADMIN_PREVIEW_ROLES)[number];

export type AdminAccessBoundaryResult = Readonly<{
  authoritativeAccessConnected: false;
  reason:
    | 'cross-surface-cookie-rejected'
    | 'deterministic-role-preview'
    | 'origin-rejected'
    | 'unsafe-context-rejected'
    | 'unknown-role-rejected';
  role: AdminPreviewRole;
}>;

type AdminAccessBoundaryInput = Readonly<{
  cookieHeader: string | null;
  url: URL;
}>;

const EMPTY_POLICIES = Object.freeze([
  'camera=()',
  'display-capture=()',
  'geolocation=()',
  'microphone=()',
  'payment=()',
  'usb=()',
]);

const UNSAFE_CONTEXT_KEYS = Object.freeze(['destination', 'redirect', 'returnPath', 'returnUrl']);

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

const isAdminPreviewRole = (value: string | null): value is AdminPreviewRole =>
  value !== null && ADMIN_PREVIEW_ROLES.includes(value as AdminPreviewRole);

const containsCrossSurfaceCookie = (cookieHeader: string | null): boolean => {
  if (cookieHeader === null || cookieHeader.trim().length === 0) {
    return false;
  }

  return cookieHeader
    .split(';')
    .map((cookie) => cookie.split('=', 1)[0]?.trim().toLowerCase() ?? '')
    .some((name) =>
      /^(?:__host-|__secure-)?(?:liiiraa[._-])?(?:public|account)(?:[._-]|$)/u.test(name),
    );
};

const hasUnsafeContext = (url: URL): boolean =>
  UNSAFE_CONTEXT_KEYS.some((key) => url.searchParams.has(key));

const isDocumentNavigation = (request: NextRequest): boolean => {
  const destination = request.headers.get('sec-fetch-dest')?.toLowerCase();
  const mode = request.headers.get('sec-fetch-mode')?.toLowerCase();
  const accept = request.headers.get('accept')?.toLowerCase() ?? '';

  return (destination === 'document' || mode === 'navigate') && accept.includes('text/html');
};

const denialLocale = (request: NextRequest): AdminLocale => {
  const firstSegment = request.nextUrl.pathname.split('/').filter(Boolean)[0];

  if (firstSegment === 'pt-BR' || firstSegment === 'en') {
    return firstSegment;
  }

  return request.headers.get('accept-language')?.toLowerCase().includes('pt-br') === true
    ? 'pt-BR'
    : 'en';
};

const boundedRequestId = (request: NextRequest): string | undefined => {
  const candidate = request.headers.get('x-request-id') ?? request.headers.get('x-correlation-id');

  return candidate !== null && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(candidate)
    ? candidate
    : undefined;
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const adminDenialDocument = (
  locale: AdminLocale,
  nonce: string,
  requestId: string | undefined,
): string => {
  const copy = ADMIN_DENIAL_COPY[locale];
  const canonicalHref = `${resolveAdminOrigin()}${ADMIN_CANONICAL_ENTRY[locale]}`;
  const reference =
    requestId === undefined
      ? ''
      : `<p class="reference"><span>${escapeHtml(copy.reference)}</span><code>${escapeHtml(requestId)}</code></p>`;

  return `<!doctype html>
<html lang="${escapeHtml(locale)}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex,nofollow,noarchive">
    <title>${escapeHtml(copy.title)}</title>
    <style nonce="${escapeHtml(nonce)}">
      :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: Canvas; color: CanvasText; }
      * { box-sizing: border-box; }
      body { min-width: 320px; min-height: 100vh; margin: 0; display: grid; place-items: center; padding: 32px; background: Canvas; color: CanvasText; }
      main { width: min(100%, 680px); border-top: 2px solid LinkText; padding-top: 32px; }
      h1 { max-width: 24ch; margin: 0 0 16px; font-size: 2rem; line-height: 1.2; text-wrap: balance; }
      p { max-width: 68ch; margin: 0; color: CanvasText; line-height: 1.65; text-wrap: pretty; }
      a { display: inline-flex; min-height: 44px; align-items: center; margin-top: 24px; padding: 0 16px; border: 1px solid LinkText; color: LinkText; font-weight: 600; text-decoration: none; }
      a:focus-visible { outline: 3px solid Highlight; outline-offset: 4px; }
      .reference { display: grid; gap: 8px; margin-top: 24px; padding-top: 16px; border-top: 1px solid CanvasText; font-size: .875rem; }
      code { color: CanvasText; font-family: ui-monospace, "Cascadia Code", monospace; overflow-wrap: anywhere; }
      @media (max-width: 480px) { body { padding: 20px; } h1 { font-size: 1.625rem; } }
      @media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; } }
      @media (forced-colors: active) { main, a, .reference { border-color: CanvasText; } a { color: LinkText; } }
    </style>
  </head>
  <body>
    <main aria-labelledby="admin-denial-title">
      <h1 id="admin-denial-title">${escapeHtml(copy.title)}</h1>
      <p>${escapeHtml(copy.body)}</p>
      <a href="${escapeHtml(canonicalHref)}">${escapeHtml(copy.recovery)}</a>
      ${reference}
    </main>
  </body>
</html>`;
};

export const createAdminRequestNonce = (): string => {
  const entropy = globalThis.crypto.getRandomValues(new Uint8Array(18));

  return btoa(String.fromCharCode(...entropy));
};

export const adminHeaderContract = (
  nonce: string,
): readonly Readonly<{ key: string; value: string }>[] =>
  Object.freeze([
    Object.freeze({
      key: 'Cache-Control',
      value: 'private, no-store, max-age=0',
    }),
    Object.freeze({
      key: 'Content-Security-Policy',
      value: createContentSecurityPolicy(nonce),
    }),
    Object.freeze({
      key: 'Cross-Origin-Opener-Policy',
      value: 'same-origin',
    }),
    Object.freeze({
      key: 'Cross-Origin-Resource-Policy',
      value: 'same-origin',
    }),
    Object.freeze({
      key: 'Origin-Agent-Cluster',
      value: '?1',
    }),
    Object.freeze({
      key: 'Permissions-Policy',
      value: EMPTY_POLICIES.join(', '),
    }),
    Object.freeze({
      key: 'Referrer-Policy',
      value: 'no-referrer',
    }),
    Object.freeze({
      key: 'X-Content-Type-Options',
      value: 'nosniff',
    }),
    Object.freeze({
      key: 'X-Frame-Options',
      value: 'DENY',
    }),
    Object.freeze({
      key: 'X-Robots-Tag',
      value: 'noindex,nofollow,noarchive',
    }),
  ]);

export const AdminAccessBoundary = ({
  cookieHeader,
  url,
}: AdminAccessBoundaryInput): AdminAccessBoundaryResult => {
  const requestedRole = url.searchParams.get('role');
  const role = isAdminPreviewRole(requestedRole) ? requestedRole : 'support';

  if (url.origin !== resolveAdminOrigin()) {
    return Object.freeze({
      authoritativeAccessConnected: false,
      reason: 'origin-rejected',
      role,
    });
  }

  if (containsCrossSurfaceCookie(cookieHeader)) {
    return Object.freeze({
      authoritativeAccessConnected: false,
      reason: 'cross-surface-cookie-rejected',
      role,
    });
  }

  if (hasUnsafeContext(url)) {
    return Object.freeze({
      authoritativeAccessConnected: false,
      reason: 'unsafe-context-rejected',
      role,
    });
  }

  if (requestedRole !== null && !isAdminPreviewRole(requestedRole)) {
    return Object.freeze({
      authoritativeAccessConnected: false,
      reason: 'unknown-role-rejected',
      role,
    });
  }

  return Object.freeze({
    authoritativeAccessConnected: false,
    reason: 'deterministic-role-preview',
    role,
  });
};

const applyAdminHeaders = (response: NextResponse, nonce: string): NextResponse => {
  for (const { key, value } of adminHeaderContract(nonce)) {
    response.headers.set(key, value);
  }

  return response;
};

export default function adminProxy(request: NextRequest): NextResponse {
  const nonce = createAdminRequestNonce();
  const boundary = AdminAccessBoundary({
    cookieHeader: request.headers.get('cookie'),
    url: request.nextUrl,
  });

  if (boundary.reason !== 'deterministic-role-preview') {
    const requestId = boundedRequestId(request);

    if (isDocumentNavigation(request)) {
      const locale = denialLocale(request);

      return applyAdminHeaders(
        new NextResponse(adminDenialDocument(locale, nonce, requestId), {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
          },
          status: 403,
        }),
        nonce,
      );
    }

    return applyAdminHeaders(
      NextResponse.json(
        {
          authoritativeAccessConnected: false,
          code: 'ADMIN_PREVIEW_ACCESS_DENIED',
          reason: boundary.reason,
          ...(requestId === undefined ? {} : { requestId }),
        },
        { status: 403 },
      ),
      nonce,
    );
  }

  const requestHeaders = new Headers(request.headers);
  const contentSecurityPolicy = adminHeaderContract(nonce).find(
    ({ key }) => key === 'Content-Security-Policy',
  )?.value;

  requestHeaders.delete('cookie');
  requestHeaders.set('x-liiiraa-admin-role', boundary.role);
  requestHeaders.set('x-liiiraa-preview-authority', 'disconnected');
  requestHeaders.set('x-nonce', nonce);

  if (contentSecurityPolicy !== undefined) {
    requestHeaders.set('Content-Security-Policy', contentSecurityPolicy);
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set('x-liiiraa-admin-role', boundary.role);
  response.headers.set('x-liiiraa-preview-authority', 'disconnected');

  return applyAdminHeaders(response, nonce);
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
