import 'server-only';

import { resolveAdminRuntimeConfig, type AdminRuntimeConfig } from './admin-runtime';

export const resolveAdminServerRuntimeConfig = (): AdminRuntimeConfig =>
  resolveAdminRuntimeConfig({
    authorityBaseUrl: process.env['LIIIRAA_ADMIN_AUTHORITY_ORIGIN'] ?? '',
    previewEnabled: process.env['LIIIRAA_ADMIN_PREVIEW'] === 'true',
  });
