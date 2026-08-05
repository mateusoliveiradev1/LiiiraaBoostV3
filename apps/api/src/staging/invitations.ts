import { syntheticIdentityFor, type SyntheticStagingIdentity } from './seed.js';

export interface StagingInvitation {
  readonly code: string;
  readonly email: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly buildId: string;
  readonly redeemedAt: string | null;
}

export type StagingInvitationRepository = Map<string, StagingInvitation>;

export interface IssueInvitationInput {
  readonly code: string;
  readonly email: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly buildId: string;
}

export type RedeemInvitationResult =
  | Readonly<{ ok: true; identity: SyntheticStagingIdentity }>
  | Readonly<{
      ok: false;
      code: 'INVITATION_NOT_FOUND' | 'INVITATION_EXPIRED' | 'INVITATION_USED';
    }>;

const instant = (value: string): number => {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error('INVITATION_REJECTED:instant');
  return parsed;
};

export const issueInvitation = (
  repository: StagingInvitationRepository,
  input: IssueInvitationInput,
): StagingInvitation => {
  if (!/^[a-z0-9][a-z0-9-]{7,127}$/u.test(input.code)) {
    throw new Error('INVITATION_REJECTED:code');
  }
  if (!/^[^@\s]+@[^@\s]+\.test$/u.test(input.email) || repository.has(input.code)) {
    throw new Error('INVITATION_REJECTED:identity');
  }
  if (instant(input.expiresAt) <= instant(input.issuedAt)) {
    throw new Error('INVITATION_REJECTED:expiry');
  }
  const invitation = Object.freeze({ ...input, email: input.email.toLowerCase(), redeemedAt: null });
  repository.set(input.code, invitation);
  return invitation;
};

export const redeemInvitation = (
  repository: StagingInvitationRepository,
  input: Readonly<{ code: string; now: string }>,
): RedeemInvitationResult => {
  const invitation = repository.get(input.code);
  if (invitation === undefined) return { ok: false, code: 'INVITATION_NOT_FOUND' };
  if (invitation.redeemedAt !== null) return { ok: false, code: 'INVITATION_USED' };
  if (instant(input.now) >= instant(invitation.expiresAt)) {
    return { ok: false, code: 'INVITATION_EXPIRED' };
  }
  repository.set(input.code, Object.freeze({ ...invitation, redeemedAt: input.now }));
  return {
    ok: true,
    identity: syntheticIdentityFor(invitation.buildId, invitation.email, 'tester'),
  };
};
