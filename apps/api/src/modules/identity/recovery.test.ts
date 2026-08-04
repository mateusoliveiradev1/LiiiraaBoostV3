import { describe, it } from 'vitest';

const RECOVERY_RED_OWNER = '04-12-01';

const recoveryWitnesses = [
  {
    id: 'IDEN-02 approved second factors',
    behavior:
      'authenticator applications, passkeys, and one-use recovery codes must be accepted while SMS and email codes are rejected as second factors',
  },
  {
    id: 'IDEN-02 reviewed recovery',
    behavior:
      'total factor loss must enter reviewed recovery without immediately granting takeover authority',
  },
  {
    id: 'IDEN-02 critical-action hold',
    behavior:
      'approved exceptional recovery must impose the locked critical-action hold while ordinary access remains available',
  },
  {
    id: 'IDEN-02 trusted-session contest',
    behavior:
      'a trusted-session contest must extend the hold and preserve the recorded risk transition',
  },
  {
    id: 'IDEN-02 session revocation',
    behavior:
      'recovery completion must revoke the affected sessions before new authenticated authority is projected',
  },
] as const;

const expectedRecoveryRed = (id: string, behavior: string): never => {
  throw new Error(`EXPECTED_RED[${RECOVERY_RED_OWNER}][${id}]: ${behavior}`);
};

describe('identity-recovery pre-implementation API witnesses', () => {
  it.each(recoveryWitnesses)('$id', ({ id, behavior }) => {
    expectedRecoveryRed(id, behavior);
  });
});
