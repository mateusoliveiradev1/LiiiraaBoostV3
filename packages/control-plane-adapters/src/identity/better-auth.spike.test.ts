import type { AuthenticationStrengthJson, SessionStateJson } from '@liiiraa/contracts-ts';
import { describe, expect, it } from 'vitest';

const BETTER_AUTH_RED_OWNER = '04-05-01';

const identityDecisionMatrix = [
  {
    id: 'D-01',
    name: 'launch authentication methods',
    contractStrength: 'password' as AuthenticationStrengthJson,
    behavior:
      'verified email and password, Google, Discord, and passkeys must authenticate while Microsoft remains disabled at launch',
  },
  {
    id: 'D-02',
    name: 'verified registration and passkey offer',
    contractStrength: 'passkey' as AuthenticationStrengthJson,
    behavior:
      'unverified email must create no authoritative session and passkey enrollment is offered only after the first verified login',
  },
  {
    id: 'D-03',
    name: 'cross-method scoped step-up',
    contractStrength: 'mfa' as AuthenticationStrengthJson,
    behavior:
      'password, social, and passkey sessions must complete action-scoped step-up before sensitive account, device, refund, or diagnostic access',
  },
  {
    id: 'D-04',
    name: 'approved second factors',
    contractStrength: 'mfa' as AuthenticationStrengthJson,
    behavior:
      'TOTP, passkeys, and one-use recovery codes are accepted while SMS and email codes fail closed as second factors',
  },
  {
    id: 'D-05',
    name: 'reviewed total-factor recovery',
    contractStrength: 'mfa' as AuthenticationStrengthJson,
    behavior:
      'verified email or recovery code may begin recovery while loss of every factor enters security-reviewed support recovery',
  },
  {
    id: 'D-06',
    name: 'critical-action recovery hold and contest',
    contractStrength: 'mfa' as AuthenticationStrengthJson,
    behavior:
      'exceptional recovery must impose the 24-hour critical-action hold, notify trusted sessions, and preserve contest evidence',
  },
  {
    id: 'D-07',
    name: 'independently revocable sessions',
    contractStrength: 'password' as AuthenticationStrengthJson,
    contractSessionState: 'revoked' as SessionStateJson,
    behavior:
      'web and desktop sessions remain individually visible and revocable without conflating account access with the one-PC Premium binding',
  },
  {
    id: 'D-08',
    name: 'separated administrative roles',
    contractStrength: 'mfa' as AuthenticationStrengthJson,
    behavior:
      'support, operations, security, and audit identities remain separate active roles without an omnipotent production administrator',
  },
  {
    id: 'D-09',
    name: 'audited non-production role assumption',
    contractStrength: 'mfa' as AuthenticationStrengthJson,
    behavior:
      'the non-production developer identity assumes exactly one administrative role at a time and every assumption and action is audited',
  },
  {
    id: 'D-10',
    name: 'Windows system-browser PKCE',
    contractStrength: 'passkey' as AuthenticationStrengthJson,
    behavior:
      'desktop authentication must use the external browser, authorization code, S256 PKCE, random state, exact issuer and redirect, a one-shot callback, backend exchange, no client secret, and revocable credential-manager sessions',
  },
] as const;

const expectedBetterAuthRed = (id: string, behavior: string): never => {
  throw new Error(`EXPECTED_RED[${BETTER_AUTH_RED_OWNER}][${id}]: ${behavior}`);
};

describe('Better Auth terminating pre-implementation identity adapter matrix', () => {
  it.each(identityDecisionMatrix)('$id $name', ({ id, contractStrength, behavior }) => {
    expect(['password', 'mfa', 'passkey']).toContain(contractStrength);
    expectedBetterAuthRed(id, behavior);
  });
});
