import type { NextConfig } from 'next';

import { ADMIN_RUNTIME_BOUNDARY, ADMIN_TEST_ORIGIN, resolveAdminOrigin } from './src/admin-runtime';

const ADMIN_BUILD_ID_PREFIX = 'admin-preview';
const ADMIN_API_ORIGIN =
  process.env['LIIIRAA_ADMIN_API_ORIGIN'] ?? 'https://liiiraa-api-staging.onrender.com';

const adminApiOrigin = new URL(ADMIN_API_ORIGIN);
if (
  adminApiOrigin.protocol !== 'https:' ||
  adminApiOrigin.origin !== ADMIN_API_ORIGIN ||
  adminApiOrigin.username.length > 0 ||
  adminApiOrigin.password.length > 0
) {
  throw new Error('Admin API origin must be an exact credential-free HTTPS origin.');
}

const nextConfig = {
  devIndicators: false,
  env: {
    LIIIRAA_ADMIN_ORIGIN: resolveAdminOrigin(),
  },
  output: 'standalone',
  poweredByHeader: false,
  typedRoutes: true,
  generateBuildId: () => `${ADMIN_BUILD_ID_PREFIX}-scaffold`,
  async rewrites() {
    return [
      {
        destination: `${ADMIN_API_ORIGIN}/v1/:path*`,
        source: '/v1/:path*',
      },
    ];
  },
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
