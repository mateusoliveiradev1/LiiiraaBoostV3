export const AUTHENTICATION_METHODS = Object.freeze([
  'password',
  'google',
  'discord',
  'passkey',
] as const);

export type AuthenticationMethod = (typeof AUTHENTICATION_METHODS)[number];
export type AuthenticationIdentityState = 'active' | 'disabled' | 'revoked';

export interface AuthenticationAdmissionInput {
  readonly method: string;
  readonly invitationAccepted: boolean;
  readonly emailVerified: boolean;
  readonly identityState: AuthenticationIdentityState;
  readonly origin: string;
  readonly expectedOrigin: string;
  readonly csrfVerified: boolean;
  readonly riskAllowed: boolean;
}

export type AuthenticationDecision =
  | Readonly<{ accepted: true; method: AuthenticationMethod }>
  | Readonly<{ accepted: false; code: 'AUTHENTICATION_FAILED' }>;

const approvedMethod = (method: string): method is AuthenticationMethod =>
  AUTHENTICATION_METHODS.some((candidate) => candidate === method);

export const decideAuthenticationAdmission = (
  input: AuthenticationAdmissionInput,
): AuthenticationDecision => {
  if (
    !approvedMethod(input.method) ||
    !input.invitationAccepted ||
    !input.emailVerified ||
    input.identityState !== 'active' ||
    input.origin !== input.expectedOrigin ||
    !input.csrfVerified ||
    !input.riskAllowed
  ) {
    return { accepted: false, code: 'AUTHENTICATION_FAILED' };
  }

  return { accepted: true, method: input.method };
};
