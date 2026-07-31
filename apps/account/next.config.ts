import type { NextConfig } from "next";

export const ACCOUNT_ORIGIN = "https://account.liiiraa.com";
export const ACCOUNT_BUILD_ID_PREFIX = "account-preview";
export const ACCOUNT_RUNTIME_BOUNDARY = Object.freeze({
  authorityConnected: false,
  cookiePolicy: "none",
  indexing: "noindex",
  origin: ACCOUNT_ORIGIN,
} as const);

const nextConfig = {
  output: "standalone",
  poweredByHeader: false,
  typedRoutes: true,
  generateBuildId: () => `${ACCOUNT_BUILD_ID_PREFIX}-isolated`,
  webpack(config) {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
} satisfies NextConfig;

export default nextConfig;
