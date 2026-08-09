import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { describe, expect, it, vi } from 'vitest';

import {
  provisionStagingInvitations,
  repairInvitationOutputPayload,
  type ProtectedInvitationOutput,
  type StagingInvitationProvisioningEnvironment,
} from './provision-invitations.js';

const emails = ['owner@example.com', 'friend-one@example.com', 'friend-two@example.com'] as const;
const environment = (): StagingInvitationProvisioningEnvironment => ({
  ACCOUNT_STAGING_ORIGIN: 'https://account.staging.example',
  STAGING_INVITATION_EMAILS_JSON: JSON.stringify(emails),
  STAGING_INVITATION_OUTPUT_PATH: 'C:\\protected\\liiiraa-invitations.json',
});

const digest = (value: string): string => createHash('sha256').update(value).digest('hex');

describe('secret-driven staging invitation provisioning', () => {
  it('creates exactly three single-use tester invitations and exposes raw URLs only to protected output', async () => {
    const committed: string[] = [];
    const commit = vi.fn((payload: string): Promise<void> => {
      committed.push(payload);
      return Promise.resolve();
    });
    const output: ProtectedInvitationOutput = {
      abort: vi.fn(() => Promise.resolve()),
      commit,
    };
    const database = {
      query: vi.fn((_statement: string, _values?: readonly unknown[]) =>
        Promise.resolve({ rowCount: 0, rows: [] }),
      ),
    };
    let tokenSequence = 0;
    const invitations = {
      issueInvitation: vi.fn(
        (input: Readonly<{ email: string; expiresAt: string; role: string }>) => {
          tokenSequence += 1;
          const token = `invite-token-${String(tokenSequence)}-${'x'.repeat(48)}`;
          return Promise.resolve({
            expiresAt: input.expiresAt,
            token,
            tokenDigest: digest(token),
          });
        },
      ),
    };

    const result = await provisionStagingInvitations(environment(), {
      clock: { now: () => new Date('2030-01-15T12:00:00.000Z') },
      database,
      invitations,
      openProtectedOutput: vi.fn(() => Promise.resolve(output)),
      repositoryRoot: 'C:\\workspace\\liiiraa-boost',
    });

    expect(result).toEqual({ created: 3, skipped: 0, status: 'complete' });
    expect(JSON.stringify(result)).not.toMatch(/@|invite-token/iu);
    expect(invitations.issueInvitation).toHaveBeenCalledTimes(3);
    expect(invitations.issueInvitation.mock.calls.map(([input]) => input.role)).toEqual([
      'tester',
      'tester',
      'tester',
    ]);
    const queryValues = database.query.mock.calls.map(([, values]) => values);
    expect(queryValues).toEqual(emails.map((email) => [digest(email), '2030-01-15T12:00:00.000Z']));
    expect(JSON.stringify(queryValues)).not.toContain('@');
    expect(commit).toHaveBeenCalledTimes(1);
    expect(committed).toHaveLength(1);
    const protectedPayload = JSON.parse(committed[0] ?? '{}') as {
      invitations?: readonly { email?: string; invitationUrl?: string }[];
    };
    expect(protectedPayload.invitations?.map(({ email }) => email)).toEqual(emails);
    expect(
      protectedPayload.invitations?.every(({ invitationUrl }) =>
        invitationUrl?.startsWith('https://account.staging.example/pt-BR/register?invitation='),
      ),
    ).toBe(true);
  });

  it('repairs legacy protected links without changing their invitation authority', () => {
    const token = 'a'.repeat(64);
    const legacyPayload = JSON.stringify({
      invitations: emails.map((email) => ({
        email,
        expiresAt: '2030-01-29T12:00:00.000Z',
        invitationUrl: `https://account.staging.example/pt-BR/account/sign-up?invitation=${token}`,
      })),
    });

    const repaired = JSON.parse(
      repairInvitationOutputPayload(legacyPayload, 'https://account.staging.example'),
    ) as {
      invitations: readonly { email: string; invitationUrl: string }[];
    };

    expect(repaired.invitations.map(({ email }) => email)).toEqual(emails);
    expect(
      repaired.invitations.every(
        ({ invitationUrl }) =>
          invitationUrl === `https://account.staging.example/pt-BR/register?invitation=${token}`,
      ),
    ).toBe(true);
    expect(() =>
      repairInvitationOutputPayload(
        legacyPayload.replace('account.staging.example', 'attacker.example'),
        'https://account.staging.example',
      ),
    ).toThrow('STAGING_INVITATION_PROVISIONING_REJECTED');
  });

  it('is idempotent and never reconstructs or reveals prior active invitation tokens', async () => {
    const database = {
      query: vi.fn((_statement: string, _values?: readonly unknown[]) =>
        Promise.resolve({ rowCount: 1, rows: [{ token_digest: 'a'.repeat(64) }] }),
      ),
    };
    const invitations = { issueInvitation: vi.fn() };
    const openProtectedOutput = vi.fn();

    await expect(
      provisionStagingInvitations(environment(), {
        clock: { now: () => new Date('2030-01-15T12:00:00.000Z') },
        database,
        invitations,
        openProtectedOutput,
        repositoryRoot: 'C:\\workspace\\liiiraa-boost',
      }),
    ).resolves.toEqual({ created: 0, skipped: 3, status: 'complete' });
    expect(invitations.issueInvitation).not.toHaveBeenCalled();
    expect(openProtectedOutput).not.toHaveBeenCalled();
  });

  it('reissues only the two owner-approved active tester invitations for the protected recipients', async () => {
    const committed: string[] = [];
    const database = {
      query: vi.fn((statement: string, _values?: readonly unknown[]) => {
        if (statement.includes('UPDATE identity_invitations')) {
          return Promise.resolve({
            rowCount: 2,
            rows: [{ token_digest: 'a'.repeat(64) }, { token_digest: 'b'.repeat(64) }],
          });
        }
        return Promise.resolve({ rowCount: 0, rows: [] });
      }),
    };
    const invitations = {
      issueInvitation: vi.fn(
        (input: Readonly<{ email: string; expiresAt: string; role: string }>) =>
          Promise.resolve({
            expiresAt: input.expiresAt,
            token: `replacement-${digest(input.email)}`,
            tokenDigest: digest(`replacement-${input.email}`),
          }),
      ),
    };

    await expect(
      provisionStagingInvitations(
        { ...environment(), STAGING_INVITATION_REISSUE_ACTIVE: 'owner-approved-exactly-two' },
        {
          clock: { now: () => new Date('2030-01-15T12:00:00.000Z') },
          database,
          invitations,
          openProtectedOutput: vi.fn(() =>
            Promise.resolve({
              abort: vi.fn(() => Promise.resolve()),
              commit: vi.fn((payload: string) => {
                committed.push(payload);
                return Promise.resolve();
              }),
            }),
          ),
          repositoryRoot: 'C:\\workspace\\liiiraa-boost',
        },
      ),
    ).resolves.toEqual({ created: 3, skipped: 0, status: 'complete' });

    const recoveryCall = database.query.mock.calls[0];
    expect(recoveryCall?.[0]).toContain("role = 'tester'");
    expect(recoveryCall?.[0]).toContain('redeemed_at IS NULL');
    expect(recoveryCall?.[1]).toEqual([
      emails.map((email) => digest(email)),
      '2030-01-15T12:00:00.000Z',
    ]);
    expect(JSON.stringify(recoveryCall?.[1])).not.toContain('@');
    expect(invitations.issueInvitation).toHaveBeenCalledTimes(3);
    expect(committed).toHaveLength(1);
  });

  it('aborts recovery unless the database returns exactly two lost active invitations', async () => {
    const database = {
      query: vi.fn(() =>
        Promise.resolve({ rowCount: 1, rows: [{ token_digest: 'a'.repeat(64) }] }),
      ),
    };
    const invitations = { issueInvitation: vi.fn() };
    const openProtectedOutput = vi.fn();

    await expect(
      provisionStagingInvitations(
        { ...environment(), STAGING_INVITATION_REISSUE_ACTIVE: 'owner-approved-exactly-two' },
        {
          clock: { now: () => new Date('2030-01-15T12:00:00.000Z') },
          database,
          invitations,
          openProtectedOutput,
          repositoryRoot: 'C:\\workspace\\liiiraa-boost',
        },
      ),
    ).rejects.toThrow('STAGING_INVITATION_PROVISIONING_REJECTED');
    expect(invitations.issueInvitation).not.toHaveBeenCalled();
    expect(openProtectedOutput).not.toHaveBeenCalled();
  });

  it('limits compensation to the three invitations created inside the failed-run window', async () => {
    const database = {
      query: vi.fn((statement: string, _values?: readonly unknown[]) => {
        if (statement.includes('UPDATE identity_invitations')) {
          return Promise.resolve({
            rowCount: 3,
            rows: [
              { token_digest: 'a'.repeat(64) },
              { token_digest: 'b'.repeat(64) },
              { token_digest: 'c'.repeat(64) },
            ],
          });
        }
        return Promise.resolve({ rowCount: 0, rows: [] });
      }),
    };

    await provisionStagingInvitations(
      {
        ...environment(),
        STAGING_INVITATION_REISSUE_ACTIVE: 'compensate-run-31300134764-exactly-three',
        STAGING_INVITATION_REISSUE_AFTER: '2026-08-09T07:00:00.000Z',
        STAGING_INVITATION_REISSUE_BEFORE: '2026-08-09T07:01:00.000Z',
      },
      {
        clock: { now: () => new Date('2030-01-15T12:00:00.000Z') },
        database,
        invitations: {
          issueInvitation: vi.fn((input: Readonly<{ email: string; expiresAt: string }>) =>
            Promise.resolve({
              expiresAt: input.expiresAt,
              token: `replacement-${digest(input.email)}`,
              tokenDigest: digest(`replacement-${input.email}`),
            }),
          ),
        },
        openProtectedOutput: vi.fn(() =>
          Promise.resolve({
            abort: vi.fn(() => Promise.resolve()),
            commit: vi.fn(() => Promise.resolve()),
          }),
        ),
        repositoryRoot: 'C:\\workspace\\liiiraa-boost',
      },
    );

    const recoveryCall = database.query.mock.calls[0];
    expect(recoveryCall?.[0]).toContain('issued_at >= $3 AND issued_at < $4');
    expect(recoveryCall?.[1]).toEqual([
      emails.map((email) => digest(email)),
      '2030-01-15T12:00:00.000Z',
      '2026-08-09T07:00:00.000Z',
      '2026-08-09T07:01:00.000Z',
    ]);
  });

  it('rejects anything other than three unique valid emails and a protected absolute output path', async () => {
    const dependencies = {
      clock: { now: () => new Date('2030-01-15T12:00:00.000Z') },
      database: {
        query: vi.fn((_statement: string, _values?: readonly unknown[]) =>
          Promise.resolve({ rowCount: 0, rows: [] }),
        ),
      },
      invitations: { issueInvitation: vi.fn() },
      openProtectedOutput: vi.fn(),
      repositoryRoot: 'C:\\workspace\\liiiraa-boost',
    };
    for (const input of [
      { ...environment(), STAGING_INVITATION_EMAILS_JSON: JSON.stringify(emails.slice(0, 2)) },
      {
        ...environment(),
        STAGING_INVITATION_EMAILS_JSON: JSON.stringify([emails[0], emails[0], emails[2]]),
      },
      { ...environment(), STAGING_INVITATION_OUTPUT_PATH: 'relative/invitations.json' },
      {
        ...environment(),
        STAGING_INVITATION_OUTPUT_PATH: 'C:\\workspace\\liiiraa-boost\\invitations.json',
      },
    ]) {
      await expect(provisionStagingInvitations(input, dependencies)).rejects.toThrow(
        'STAGING_INVITATION_PROVISIONING_REJECTED',
      );
    }
    expect(dependencies.database.query).not.toHaveBeenCalled();
  });

  it('keeps invitation issuance outside the ordinary HTTP route authority', async () => {
    const routes = await readFile(
      new URL('../modules/identity/real-routes.ts', import.meta.url),
      'utf8',
    );

    expect(routes).not.toMatch(/\|\s*'issueInvitation'/u);
  });

  it('publishes only an encrypted short-lived recovery artifact', async () => {
    const workflow = await readFile(
      new URL('../../../../.github/workflows/phase-4-invitation-recovery.yml', import.meta.url),
      'utf8',
    );

    expect(workflow).toContain('secrets.STAGING_INVITATION_EMAILS_JSON');
    expect(workflow).toContain('secrets.STAGING_DATABASE_URL');
    expect(workflow).toContain(
      'STAGING_INVITATION_REISSUE_ACTIVE: compensate-run-31300134764-exactly-three',
    );
    expect(workflow).toContain('Prove encryption before touching PostgreSQL');
    expect(workflow).toContain('STAGING_INVITATION_ENCRYPTED_OUTPUT_PATH');
    expect(workflow).toContain('liiiraa-invitations.encrypted.json');
    expect(workflow).toContain('retention-days: 1');
    expect(workflow).toContain('test ! -e');
    expect(workflow).not.toMatch(/^\s+path:\s+.*liiiraa-invitations\.json\s*$/mu);
  });
});
