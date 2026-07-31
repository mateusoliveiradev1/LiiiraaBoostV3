import type { NextConfig } from 'next';

import {
  ADMIN_RUNTIME_BOUNDARY,
  ADMIN_TEST_ORIGIN,
} from './src/admin-runtime';

const ADMIN_BUILD_ID_PREFIX = 'admin-preview';

const nextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  typedRoutes: true,
  generateBuildId: () => `${ADMIN_BUILD_ID_PREFIX}-scaffold`,
  webpack(config) {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };

    return config;
  },
} satisfies NextConfig;

export { ADMIN_RUNTIME_BOUNDARY, ADMIN_TEST_ORIGIN };
export default nextConfig;
