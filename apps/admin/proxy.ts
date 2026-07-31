import { NextResponse, type NextRequest } from 'next/server';

import { resolveAdminOrigin } from './src/admin-runtime';

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
    return applyAdminHeaders(
      NextResponse.json(
        {
          authoritativeAccessConnected: false,
          code: 'ADMIN_PREVIEW_ACCESS_DENIED',
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
