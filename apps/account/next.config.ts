import type { NextConfig } from "next";

const ACCOUNT_BUILD_ID_PREFIX = "account-preview";

const nextConfig = {
  output: "standalone",
  typedRoutes: true,
  generateBuildId: () => `${ACCOUNT_BUILD_ID_PREFIX}-scaffold`,
} satisfies NextConfig;

export default nextConfig;
