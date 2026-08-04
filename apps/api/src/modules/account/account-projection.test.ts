import { describe, expect, it } from 'vitest';

const ACCOUNT_PROJECTION_RED_OWNER = '04-17-01';

const expectedAccountProjectionRed = (behavior: string): never => {
  throw new Error(`EXPECTED_RED[${ACCOUNT_PROJECTION_RED_OWNER}]: ${behavior}`);
};

describe('account-projection pre-implementation API witnesses', () => {
  it('WEB-04 rejects a stale expected version without projecting the rejected mutation', () => {
    const competingVersions = Object.freeze({ actual: 8, expected: 7 });

    expect(competingVersions.actual).not.toBe(competingVersions.expected);
    expectedAccountProjectionRed(
      'version-aware account mutation must reject the stale expected version and preserve the authoritative projection',
    );
  });

  it('WEB-04 returns one truthful account projection version across web and desktop reads', () => {
    expectedAccountProjectionRed(
      'web and desktop account reads must project the same authoritative version after an accepted mutation',
    );
  });
});
