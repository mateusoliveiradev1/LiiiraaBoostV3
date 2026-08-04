import type { AuthenticationStrengthJson, SessionStateJson } from '@liiiraa/contracts-ts';

export const IDENTITY_SIGN_IN_METHODS = Object.freeze([
  'password',
  'google',
  'discord',
  'passkey',
] as const);

export type IdentitySignInMethod = (typeof IDENTITY_SIGN_IN_METHODS)[number];

export const IDENTITY_SECOND_FACTORS = Object.freeze(['totp', 'passkey', 'recovery-code'] as const);

export type IdentitySecondFactor = (typeof IDENTITY_SECOND_FACTORS)[number];

export type IdentityActionScope =
  | 'security-methods'
  | 'device-transfer'
  | 'refund'
  | 'protected-data'
  | `admin-role:${'support' | 'operations' | 'security' | 'audit'}`
  | `admin-action:${string}`;

export type IdentityProviderFailureCode =
  | 'ADAPTER_UNAVAILABLE'
  | 'UNVERIFIED_EMAIL'
  | 'UNSUPPORTED_METHOD'
  | 'INVALID_CHALLENGE'
  | 'REPLAYED_CHALLENGE'
  | 'REDIRECT_MISMATCH'
  | 'ISSUER_MISMATCH'
  | 'STATE_MISMATCH'
  | 'INVALID_FACTOR'
  | 'STEP_UP_REQUIRED'
  | 'STEP_UP_STALE'
  | 'RECOVERY_REVIEW_REQUIRED'
  | 'RECOVERY_HOLD_ACTIVE'
  | 'RECOVERY_CONTESTED'
  | 'RATE_LIMITED'
  | 'SESSION_REVOKED';

export type IdentityProviderResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{
      ok: false;
      code: IdentityProviderFailureCode;
      retryable: boolean;
    }>;

export interface IdentitySession {
  readonly id: string;
  readonly method: IdentitySignInMethod;
  readonly strength: AuthenticationStrengthJson;
  readonly state: SessionStateJson;
  readonly createdAt: string;
  readonly criticalActionHoldUntil?: string;
}

export interface IdentitySignInChallenge {
  readonly id: string;
  readonly method: IdentitySignInMethod;
  readonly transport: 'direct' | 'external-browser';
  readonly authorizationUrl?: string;
  readonly state?: string;
  readonly codeChallenge?: string;
  readonly codeChallengeMethod?: 'S256';
  readonly redirectUri?: string;
  readonly issuer?: string;
}

export interface IdentityStepUpReceipt {
  readonly sessionId: string;
  readonly actionScope: IdentityActionScope;
  readonly factor: IdentitySecondFactor;
  readonly verifiedAt: string;
  readonly expiresAt: string;
  readonly auditReceiptId: string;
  readonly assumedRole?: 'support' | 'operations' | 'security' | 'audit';
}

export interface IdentityRecoveryChallenge {
  readonly id: string;
  readonly route: 'verified-email' | 'recovery-code' | 'security-review';
  readonly genericNotice: true;
}

export interface IdentityRecoveryReceipt {
  readonly session: IdentitySession;
  readonly reviewed: boolean;
  readonly criticalActionHoldUntil?: string;
  readonly trustedSessionNoticeId?: string;
  readonly contestable: boolean;
}

export interface IdentityProviderPort {
  beginSignIn(input: {
    readonly method: IdentitySignInMethod;
    readonly email?: string;
    readonly desktop?: Readonly<{
      issuer: string;
      redirectUri: string;
    }>;
  }): Promise<IdentityProviderResult<IdentitySignInChallenge>>;

  completeSignIn(input: {
    readonly challengeId: string;
    readonly emailVerified?: boolean;
    readonly authorizationCode?: string;
    readonly state?: string;
    readonly issuer?: string;
    readonly redirectUri?: string;
  }): Promise<IdentityProviderResult<IdentitySession>>;

  verifyEmail(input: {
    readonly email: string;
    readonly verificationToken: string;
  }): Promise<IdentityProviderResult<Readonly<{ verified: true }>>>;

  enrollFactor(input: {
    readonly sessionId: string;
    readonly factor: IdentitySecondFactor;
  }): Promise<IdentityProviderResult<Readonly<{ factor: IdentitySecondFactor }>>>;

  stepUp(input: {
    readonly sessionId: string;
    readonly actionScope: IdentityActionScope;
    readonly factor: IdentitySecondFactor;
    readonly proof: string;
  }): Promise<IdentityProviderResult<IdentityStepUpReceipt>>;

  listSessions(input: {
    readonly accountId: string;
  }): Promise<IdentityProviderResult<readonly IdentitySession[]>>;

  revokeSession(input: {
    readonly accountId: string;
    readonly sessionId: string;
  }): Promise<IdentityProviderResult<Readonly<{ sessionId: string; state: 'revoked' }>>>;

  beginRecovery(input: {
    readonly email: string;
    readonly evidence: 'verified-email' | 'recovery-code' | 'all-factors-lost';
  }): Promise<IdentityProviderResult<IdentityRecoveryChallenge>>;

  completeRecovery(input: {
    readonly challengeId: string;
    readonly evidence: string;
    readonly reviewedBySecurity?: boolean;
  }): Promise<IdentityProviderResult<IdentityRecoveryReceipt>>;
}
