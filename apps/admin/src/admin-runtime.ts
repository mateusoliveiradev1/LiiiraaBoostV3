export const ADMIN_TEST_ORIGIN = 'https://admin.localhost';

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      readonly LIIIRAA_ADMIN_ORIGIN?: string;
    }
  }
}

export const resolveAdminOrigin = (value = process.env.LIIIRAA_ADMIN_ORIGIN): string => {
  const candidate = value ?? ADMIN_TEST_ORIGIN;
  const url = new URL(candidate);
  const localHttp = url.protocol === 'http:' && url.hostname.endsWith('.localhost');

  if (
    (url.protocol !== 'https:' && !localHttp) ||
    url.username.length > 0 ||
    url.password.length > 0 ||
    url.pathname !== '/' ||
    url.search.length > 0 ||
    url.hash.length > 0
  ) {
    throw new Error('Admin origin must be a credential-free dedicated origin.');
  }

  return url.origin;
};

export const ADMIN_RUNTIME_BOUNDARY = Object.freeze({
  authoritativeAccessConnected: false,
  cookiePolicy: 'reject-cross-surface',
  indexing: 'noindex',
  origin: ADMIN_TEST_ORIGIN,
} as const);
