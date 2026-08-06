import { WEB_ORIGINS } from '@liiiraa/web-core';

export const STAGING_PUBLIC_ORIGIN = 'https://liiiraa-boost-public-staging.vercel.app';

const exactHttpsOrigin = (value: string): string => {
  const candidate = new URL(value);
  if (
    candidate.protocol !== 'https:' ||
    candidate.origin !== value ||
    candidate.pathname !== '/' ||
    candidate.search.length > 0 ||
    candidate.hash.length > 0 ||
    candidate.username.length > 0 ||
    candidate.password.length > 0
  ) {
    throw new Error('Public boundary origin must be an exact credential-free HTTPS origin.');
  }
  return candidate.origin;
};

export const resolvePublicBoundaryOrigin = (
  configuredOrigin: string | undefined,
  providerPreview: boolean,
): string =>
  exactHttpsOrigin(
    configuredOrigin ?? (providerPreview ? STAGING_PUBLIC_ORIGIN : WEB_ORIGINS['public-origin']),
  );
