import 'server-only';

import { resolveAccountRuntimeConfig, type AccountRuntimeConfig } from './account-runtime';

export const resolveAccountServerRuntimeConfig = (): AccountRuntimeConfig =>
  resolveAccountRuntimeConfig({
    authorityBaseUrl: process.env['LIIIRAA_ACCOUNT_AUTHORITY_ORIGIN'] ?? '',
    previewEnabled: process.env['LIIIRAA_ACCOUNT_PREVIEW'] === 'true',
  });
