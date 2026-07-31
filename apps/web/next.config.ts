import createMDX from '@next/mdx';
import type { NextConfig } from 'next';

const enforcedCsp = [
  "default-src 'self'",
  "base-uri 'none'",
  "connect-src 'self'",
  "font-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "img-src 'self' data:",
  "manifest-src 'self'",
  "media-src 'self'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "worker-src 'self'",
].join('; ');

const reportOnlyCsp = [
  "default-src 'self'",
  "base-uri 'none'",
  "connect-src 'self'",
  "font-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "img-src 'self' data:",
  "manifest-src 'self'",
  "media-src 'self'",
  "object-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "worker-src 'self'",
].join('; ');

export const publicCspProbe = Object.freeze({
  blockingDirectives: Object.freeze(['script-src', 'style-src'] as const),
  reason:
    'Next.js static bootstrap and generated styles still require inline execution in the production artifact.',
  status: 'report-only-blocked',
} as const);

export const publicHeaderContract = Object.freeze([
  Object.freeze({
    key: 'Cache-Control',
    value: 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
  }),
  Object.freeze({ key: 'Content-Security-Policy', value: enforcedCsp }),
  Object.freeze({ key: 'Content-Security-Policy-Report-Only', value: reportOnlyCsp }),
  Object.freeze({ key: 'Cross-Origin-Opener-Policy', value: 'same-origin' }),
  Object.freeze({ key: 'Cross-Origin-Resource-Policy', value: 'same-origin' }),
  Object.freeze({
    key: 'Permissions-Policy',
    value:
      'accelerometer=(), autoplay=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()',
  }),
  Object.freeze({ key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }),
  Object.freeze({ key: 'X-Content-Type-Options', value: 'nosniff' }),
  Object.freeze({ key: 'X-Frame-Options', value: 'DENY' }),
] as const);

const nextConfig = {
  output: 'standalone',
  typedRoutes: true,
  async headers() {
    return [
      {
        headers: publicHeaderContract.map((header) => ({ ...header })),
        source: '/:path*',
      },
    ];
  },
  pageExtensions: ['ts', 'tsx', 'md', 'mdx'],
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [],
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

const withMDX = createMDX({
  extension: /\.mdx?$/,
});

export default withMDX(nextConfig);
