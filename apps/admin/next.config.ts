import type { NextConfig } from 'next';

const ADMIN_BUILD_ID_PREFIX = 'admin-preview';

const nextConfig = {
  output: 'standalone',
  typedRoutes: true,
  generateBuildId: () => `${ADMIN_BUILD_ID_PREFIX}-scaffold`,
} satisfies NextConfig;

export default nextConfig;
