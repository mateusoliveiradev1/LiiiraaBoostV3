import 'server-only';

import {
  accountPreviewRuntimeAllowed,
  resolveAccountRuntimeConfig,
  type AccountRuntimeConfig,
} from './account-runtime';

export const resolveAccountServerRuntimeConfig = (): AccountRuntimeConfig =>
  resolveAccountRuntimeConfig({
    authorityBaseUrl: process.env['LIIIRAA_ACCOUNT_AUTHORITY_ORIGIN'] ?? '',
    previewAllowed: accountPreviewRuntimeAllowed({
      nodeEnv: process.env.NODE_ENV,
      vercel: process.env['VERCEL'],
    }),
    previewEnabled: process.env['LIIIRAA_ACCOUNT_PREVIEW'] === 'true',
  });
