import 'server-only';

import { resolveAdminRuntimeConfig, type AdminRuntimeConfig } from './admin-runtime';

const environment = process.env as Readonly<{
  LIIIRAA_ACCOUNT_ORIGIN?: string;
  LIIIRAA_ADMIN_AUTHORITY_ORIGIN?: string;
  LIIIRAA_ADMIN_PREVIEW?: string;
}>;

export const resolveAdminServerRuntimeConfig = (): AdminRuntimeConfig =>
  resolveAdminRuntimeConfig({
    accountOrigin: environment.LIIIRAA_ACCOUNT_ORIGIN ?? '',
    authorityBaseUrl: environment.LIIIRAA_ADMIN_AUTHORITY_ORIGIN ?? '',
    previewEnabled: environment.LIIIRAA_ADMIN_PREVIEW === 'true',
  });
