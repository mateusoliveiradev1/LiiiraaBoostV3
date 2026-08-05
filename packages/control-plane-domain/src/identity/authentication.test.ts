import { describe, expect, it } from 'vitest';

import * as domain from '../index.ts';

type AdmissionInput = Readonly<{
  method: string;
  invitationAccepted: boolean;
  emailVerified: boolean;
  identityState: 'active' | 'disabled' | 'revoked';
  origin: string;
  expectedOrigin: string;
  csrfVerified: boolean;
  riskAllowed: boolean;
}>;

type AuthenticationDomain = Readonly<{
  decideAuthenticationAdmission?: (
    input: AdmissionInput,
  ) =>
    | Readonly<{ accepted: true; method: 'password' | 'google' | 'discord' | 'passkey' }>
    | Readonly<{ accepted: false; code: 'AUTHENTICATION_FAILED' }>;
}>;

const implementation = domain as AuthenticationDomain;

const decide = (overrides: Partial<AdmissionInput> = {}) => {
  const decideAuthenticationAdmission = implementation.decideAuthenticationAdmission;
  if (typeof decideAuthenticationAdmission !== 'function') {
    throw new Error(
      'EXPECTED_RED[04-11-01][domain-admission]: authentication admission is not implemented',
    );
  }

  return decideAuthenticationAdmission({
    method: 'password',
    invitationAccepted: true,
    emailVerified: true,
    identityState: 'active',
    origin: 'https://account.test.liiiraa.dev',
    expectedOrigin: 'https://account.test.liiiraa.dev',
    csrfVerified: true,
    riskAllowed: true,
    ...overrides,
  });
};

describe('authentication domain admission', () => {
  it.each(['password', 'google', 'discord', 'passkey'] as const)(
    'admits the approved %s method through one closed decision',
    (method) => {
      expect(decide({ method })).toEqual({ accepted: true, method });
    },
  );

  it.each([
    ['unverified email', { emailVerified: false }],
    ['unsupported provider', { method: 'microsoft' }],
    ['missing invitation', { invitationAccepted: false }],
    ['disabled identity', { identityState: 'disabled' }],
    ['revoked identity', { identityState: 'revoked' }],
    ['wrong origin', { origin: 'https://attacker.example' }],
    ['missing CSRF proof', { csrfVerified: false }],
    ['denied risk decision', { riskAllowed: false }],
  ] satisfies readonly (readonly [string, Partial<AdmissionInput>])[])(
    'rejects %s with the same provider-independent error',
    (_name, input) => {
      expect(decide(input)).toEqual({ accepted: false, code: 'AUTHENTICATION_FAILED' });
    },
  );
});
