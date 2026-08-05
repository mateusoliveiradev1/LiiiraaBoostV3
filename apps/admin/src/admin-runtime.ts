import type { AdminRoleJson } from '@liiiraa/contracts-ts';

export const ADMIN_LOCAL_ORIGIN = 'http://admin.localhost:3002';
export const ADMIN_TEST_ORIGIN = ADMIN_LOCAL_ORIGIN;

export const ADMIN_CANONICAL_ENTRY = Object.freeze({
  en: '/en/admin',
  'pt-BR': '/pt-BR/admin',
} as const);

export type AdminLocale = keyof typeof ADMIN_CANONICAL_ENTRY;

export const ADMIN_AUTHORITY_ROUTE_IDS = Object.freeze([
  'admin-role',
  'admin-support',
  'admin-operations',
  'admin-security',
  'admin-diagnostics',
  'admin-audit',
  'admin-audit-event',
] as const);

export type AdminAuthorityRoute = (typeof ADMIN_AUTHORITY_ROUTE_IDS)[number];

export const ADMIN_ROLE_ROUTE_ACCESS = Object.freeze({
  support: ['admin-role', 'admin-support'],
  operations: ['admin-role', 'admin-operations', 'admin-audit'],
  security: ['admin-role', 'admin-security', 'admin-diagnostics', 'admin-audit'],
  audit: ['admin-role', 'admin-audit', 'admin-audit-event'],
} as const satisfies Readonly<Record<AdminRoleJson, readonly AdminAuthorityRoute[]>>);

export const adminRoleCanAccessRoute = (
  role: AdminRoleJson,
  routeId: AdminAuthorityRoute,
): boolean => ADMIN_ROLE_ROUTE_ACCESS[role].includes(routeId as never);

export type AdminRuntimeConfig =
  | Readonly<{ kind: 'preview' }>
  | Readonly<{ authorityBaseUrl: string; kind: 'production' }>;

export const resolveAdminRuntimeConfig = ({
  authorityBaseUrl = '',
  previewEnabled = false,
}: Readonly<{
  authorityBaseUrl?: string;
  previewEnabled?: boolean;
}>): AdminRuntimeConfig =>
  previewEnabled ? { kind: 'preview' } : { authorityBaseUrl, kind: 'production' };

export const ADMIN_DENIAL_COPY = Object.freeze({
  en: Object.freeze({
    body: 'This request did not match the isolated administrative origin. No session was created and no application data was loaded.',
    recovery: 'Open the secure admin entry',
    reference: 'Request reference',
    title: 'Administrative access not authorized',
  }),
  'pt-BR': Object.freeze({
    body: 'Esta solicitação não corresponde à origem administrativa isolada. Nenhuma sessão foi criada e nenhum dado do aplicativo foi carregado.',
    recovery: 'Abrir entrada administrativa segura',
    reference: 'Referência da solicitação',
    title: 'Acesso administrativo não autorizado',
  }),
} satisfies Readonly<
  Record<
    AdminLocale,
    Readonly<{
      body: string;
      recovery: string;
      reference: string;
      title: string;
    }>
  >
>);

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
