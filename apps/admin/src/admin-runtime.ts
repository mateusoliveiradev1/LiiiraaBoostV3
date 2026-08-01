export const ADMIN_LOCAL_ORIGIN = 'http://admin.localhost:3002';
export const ADMIN_TEST_ORIGIN = ADMIN_LOCAL_ORIGIN;

export const ADMIN_CANONICAL_ENTRY = Object.freeze({
  en: '/en/admin',
  'pt-BR': '/pt-BR/admin',
} as const);

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      readonly LIIIRAA_ADMIN_ORIGIN?: string;
    }
  }
}

export const resolveAdminOrigin = (value = process.env.LIIIRAA_ADMIN_ORIGIN): string => {
  const candidate = value ?? ADMIN_LOCAL_ORIGIN;
  const url = new URL(candidate);
  const exactLocalHostname = url.hostname === 'admin.localhost';
  const localHttp = url.protocol === 'http:' && exactLocalHostname;
  const dedicatedHttps =
    url.protocol === 'https:' &&
    (exactLocalHostname ||
      (url.hostname.startsWith('admin.') && !url.hostname.includes('localhost')));

  if (
    (!localHttp && !dedicatedHttps) ||
    url.hostname.includes('*') ||
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
  origin: ADMIN_LOCAL_ORIGIN,
} as const);
