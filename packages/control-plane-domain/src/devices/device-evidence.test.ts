import { describe, it } from 'vitest';

const DEVICE_EVIDENCE_RED_OWNER = '04-06-01';

const deviceEvidenceWitnesses = [
  {
    id: 'resolved weighted device scoring',
    behavior:
      '40/25/15/10/10 component weights keep reinstall and one minor component change on the same-PC side of the 65 threshold',
  },
  {
    id: 'threshold-crossing device revalidation',
    behavior:
      'a score below 40 requires revalidation with component-class reasons while empty or contradictory evidence fails closed',
  },
  {
    id: 'raw hardware sentinel privacy',
    behavior:
      'raw serial sentinels never cross the local collector boundary into transport, logs, snapshots, or server-side values',
  },
  {
    id: 'protected evidence unlinkability',
    behavior:
      'account salt and key-version changes produce unlinkable protected evidence without exposing raw components',
  },
] as const;

const expectedDeviceEvidenceRed = (id: string, behavior: string): never => {
  throw new Error(`EXPECTED_RED[${DEVICE_EVIDENCE_RED_OWNER}][${id}]: ${behavior}`);
};

describe('device-evidence pre-implementation policy witnesses', () => {
  it.each(deviceEvidenceWitnesses)('$id', ({ id, behavior }) => {
    expectedDeviceEvidenceRed(id, behavior);
  });
});
