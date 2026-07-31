export const ADMIN_TEST_ORIGIN = 'https://admin.localhost';

export const ADMIN_RUNTIME_BOUNDARY = Object.freeze({
  authoritativeAccessConnected: false,
  cookiePolicy: 'reject-cross-surface',
  indexing: 'noindex',
  origin: ADMIN_TEST_ORIGIN,
} as const);
