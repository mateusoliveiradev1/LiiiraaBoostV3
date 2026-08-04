import { describe, it } from 'vitest';

const IDENTITY_CONFORMANCE_RED_OWNER = '04-11-01';

const supportedIdentityMethods = [
  'verified-email-password',
  'google',
  'discord',
  'passkey',
] as const;

const rejectedIdentityPaths = [
  'unverified-email',
  'microsoft-provider',
  'missing-invitation',
  'disabled-or-revoked-identity',
  'replayed-provider-result',
  'wrong-origin',
  'public-registration',
] as const;

const expectedIdentityConformanceRed = (behavior: string): never => {
  throw new Error(`EXPECTED_RED[${IDENTITY_CONFORMANCE_RED_OWNER}]: ${behavior}`);
};

describe('identity-conformance pre-implementation API witnesses', () => {
  it.each(supportedIdentityMethods)('IDEN-01 authenticates launch method %s', (method) => {
    expectedIdentityConformanceRed(
      `${method} must authenticate through the approved identity adapter and return the authenticated projection`,
    );
  });

  it.each(rejectedIdentityPaths)('IDEN-01 rejects forbidden launch path %s', (path) => {
    expectedIdentityConformanceRed(
      `${path} must fail closed without exposing credentials, tokens, or authenticated authority`,
    );
  });

  it('IDEN-01 binds desktop authorization exchange to one PKCE, state, issuer, and callback transaction', () => {
    expectedIdentityConformanceRed(
      'desktop system-browser authentication must keep provider exchange in the API and return no provider password, client secret, or provider token',
    );
  });

  it('IDEN-01 lists and revokes bounded sessions independently of Premium device binding', () => {
    expectedIdentityConformanceRed(
      'each web or desktop session must be visible and individually revocable without revoking the one-PC Premium binding',
    );
  });
});
