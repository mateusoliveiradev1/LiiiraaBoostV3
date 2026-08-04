import { describe, it } from 'vitest';

const RECOVERY_RED_OWNER = '04-12-01';

const recoveryWitnesses = [
  {
    id: 'D-03 recovery evidence',
    behavior:
      'verified email or a one-use recovery code may start recovery while total factor loss enters security review',
  },
  {
    id: 'D-04 exceptional recovery review',
    behavior:
      'an approved exceptional recovery creates a critical-action hold of at least 24 hours and notifies trusted sessions',
  },
  {
    id: 'D-05 recovery hold policy',
    behavior:
      'ordinary access remains available during the hold while security-method, device-transfer, refund, and protected-data actions are denied',
  },
  {
    id: 'D-06 recovery contest',
    behavior:
      'a trusted-session contest extends the hold and records the risk transition without granting takeover authority',
  },
] as const;

const expectedRecoveryRed = (id: string, behavior: string): never => {
  throw new Error(`EXPECTED_RED[${RECOVERY_RED_OWNER}][${id}]: ${behavior}`);
};

describe('identity-recovery pre-implementation policy witnesses', () => {
  it.each(recoveryWitnesses)('$id', ({ id, behavior }) => {
    expectedRecoveryRed(id, behavior);
  });
});
