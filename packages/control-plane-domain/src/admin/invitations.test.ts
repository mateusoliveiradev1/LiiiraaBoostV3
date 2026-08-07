import { describe, expect, it } from 'vitest';

const OWNER = '04-42-01';
const NOW = '2030-01-01T12:00:00.000Z';
const DAY_MS = 24 * 60 * 60 * 1_000;

type InvitationModule = Readonly<Record<string, unknown>>;

const loadInvitations = async (): Promise<InvitationModule> =>
  import('./invitations.js')
    .then((module) => module as InvitationModule)
    .catch((): InvitationModule => ({}));

const requireFunction = <T extends (...args: never[]) => unknown>(
  module: InvitationModule,
  name: string,
): T => {
  const value = module[name];
  if (typeof value !== 'function') {
    throw new Error(`EXPECTED_RED[${OWNER}][${name}]: invitation policy is not implemented`);
  }
  return value as T;
};

const requireNumber = (module: InvitationModule, name: string): number => {
  const value = module[name];
  if (typeof value !== 'number') {
    throw new Error(`EXPECTED_RED[${OWNER}][${name}]: invitation bound is not implemented`);
  }
  return value;
};

const admissionInput = (overrides: Readonly<Record<string, unknown>> = {}) => ({
  invitationId: 'invitation-one',
  recipientKey: 'recipient:sha256:one',
  locale: 'pt-BR',
  campaign: 'private-beta',
  cohort: 'founding-testers',
  noteReference: 'note:encrypted:one',
  now: NOW,
  activeCount: 0,
  queuePosition: 1,
  ...overrides,
});

describe('D-88 through D-98 deterministic private-beta invitation policy', () => {
  it('classifies every preflight row without issuing or projecting a usable secret', async () => {
    const module = await loadInvitations();
    const preflight = requireFunction<
      (input: Readonly<Record<string, unknown>>) => readonly Readonly<Record<string, unknown>>[]
    >(module, 'preflightBetaInvitationRows');

    const result = preflight({
      activeRecipientKeys: ['recipient:sha256:active'],
      rows: [
        { rowId: 'row-valid', recipientKey: 'recipient:sha256:valid', emailValid: true, eligible: true },
        { rowId: 'row-duplicate', recipientKey: 'recipient:sha256:valid', emailValid: true, eligible: true },
        { rowId: 'row-active', recipientKey: 'recipient:sha256:active', emailValid: true, eligible: true },
        { rowId: 'row-invalid', recipientKey: 'recipient:sha256:invalid', emailValid: false, eligible: true },
        { rowId: 'row-ineligible', recipientKey: 'recipient:sha256:ineligible', emailValid: true, eligible: false },
      ],
    });

    expect(result.map(({ rowId, classification }) => ({ rowId, classification }))).toEqual([
      { rowId: 'row-valid', classification: 'valid' },
      { rowId: 'row-duplicate', classification: 'duplicate' },
      { rowId: 'row-active', classification: 'active' },
      { rowId: 'row-invalid', classification: 'invalid' },
      { rowId: 'row-ineligible', classification: 'ineligible' },
    ]);
    expect(JSON.stringify(result)).not.toMatch(/secret|token|link|email@/iu);
  });

  it('admits at most 25 active beta invitations and promotes queued recipients in stable order', async () => {
    const module = await loadInvitations();
    const limit = requireNumber(module, 'BETA_INVITATION_ACTIVE_LIMIT');
    const admit = requireFunction<
      (input: Readonly<Record<string, unknown>>) => Readonly<Record<string, unknown>>
    >(module, 'decideBetaInvitationAdmission');
    const selectPromotions = requireFunction<
      (queue: readonly Readonly<Record<string, unknown>>[], slots: number) => readonly string[]
    >(module, 'selectNextBetaInvitationPromotions');

    expect(limit).toBe(25);
    const issued = admit(admissionInput({ activeCount: 24 }));
    expect(issued).toMatchObject({
      accepted: true,
      state: { kind: 'beta', status: 'pending', reminderCount: 0 },
      effects: [{ kind: 'issue-secret' }, { kind: 'send-invitation' }],
    });
    const queued = admit(admissionInput({ invitationId: 'queued-b', activeCount: 25, queuePosition: 2 }));
    expect(queued).toMatchObject({
      accepted: true,
      state: { status: 'queued', queuePosition: 2 },
      effects: [],
    });
    expect(JSON.stringify(queued)).not.toMatch(/expiresAt|secret|send-invitation/iu);

    const queue = [
      (queued as { state: Readonly<Record<string, unknown>> }).state,
      (
        admit(
          admissionInput({
            invitationId: 'queued-a',
            recipientKey: 'recipient:sha256:two',
            activeCount: 25,
            queuePosition: 1,
          }),
        ) as { state: Readonly<Record<string, unknown>> }
      ).state,
      (
        admit(
          admissionInput({
            invitationId: 'queued-c',
            recipientKey: 'recipient:sha256:three',
            activeCount: 25,
            queuePosition: 2,
            now: '2030-01-01T12:00:01.000Z',
          }),
        ) as { state: Readonly<Record<string, unknown>> }
      ).state,
    ];
    expect(selectPromotions(queue, 2)).toEqual(['queued-a', 'queued-b']);
  });

  it('rotates resend authority, makes expiry policy explicit, and never mutates the recipient', async () => {
    const module = await loadInvitations();
    const admit = requireFunction<
      (input: Readonly<Record<string, unknown>>) => Readonly<Record<string, unknown>>
    >(module, 'decideBetaInvitationAdmission');
    const transition = requireFunction<
      (
        state: Readonly<Record<string, unknown>>,
        command: Readonly<Record<string, unknown>>,
      ) => Readonly<Record<string, unknown>>
    >(module, 'decideBetaInvitationTransition');
    const issued = admit(admissionInput()) as { state: Readonly<Record<string, unknown>> };
    const originalExpiry = issued.state.expiresAt;

    const preserve = transition(issued.state, {
      kind: 'resend',
      now: '2030-01-02T12:00:00.000Z',
      expiryMode: 'preserve',
      justification: 'recipient requested another delivery',
    });
    expect(preserve).toMatchObject({
      accepted: true,
      state: { expiresAt: originalExpiry, recipientKey: issued.state.recipientKey },
      effects: [
        { kind: 'invalidate-secret' },
        { kind: 'issue-secret' },
        { kind: 'send-invitation' },
      ],
    });
    const restart = transition(issued.state, {
      kind: 'resend',
      now: '2030-01-02T12:00:00.000Z',
      expiryMode: 'restart',
      justification: 'approved delivery recovery',
    });
    expect(restart).toMatchObject({
      accepted: true,
      state: { expiresAt: '2030-01-16T12:00:00.000Z' },
    });
    expect(
      transition(issued.state, {
        kind: 'change-recipient',
        recipientKey: 'recipient:sha256:changed',
        now: '2030-01-02T12:00:00.000Z',
      }),
    ).toEqual({ accepted: false, code: 'RECIPIENT_IMMUTABLE' });
  });

  it('bounds localized reminders and closes capacity on every terminal lifecycle outcome', async () => {
    const module = await loadInvitations();
    const admit = requireFunction<
      (input: Readonly<Record<string, unknown>>) => Readonly<Record<string, unknown>>
    >(module, 'decideBetaInvitationAdmission');
    const transition = requireFunction<
      (
        state: Readonly<Record<string, unknown>>,
        command: Readonly<Record<string, unknown>>,
      ) => Readonly<Record<string, unknown>>
    >(module, 'decideBetaInvitationTransition');
    const countActive = requireFunction<
      (states: readonly Readonly<Record<string, unknown>>[], now: string) => number
    >(module, 'countActiveBetaInvitations');
    const issued = admit(admissionInput()) as { state: Readonly<Record<string, unknown>> };

    const first = transition(issued.state, {
      kind: 'remind',
      now: new Date(Date.parse(NOW) + 4 * DAY_MS).toISOString(),
    }) as { accepted: boolean; state: Readonly<Record<string, unknown>> };
    expect(first).toMatchObject({
      accepted: true,
      state: { reminderCount: 1 },
      effects: [{ kind: 'send-reminder', reminderNumber: 1, locale: 'pt-BR' }],
    });
    const second = transition(first.state, {
      kind: 'remind',
      now: new Date(Date.parse(NOW) + 12 * DAY_MS).toISOString(),
    }) as { accepted: boolean; state: Readonly<Record<string, unknown>> };
    expect(second).toMatchObject({ accepted: true, state: { reminderCount: 2 } });
    expect(
      transition(second.state, {
        kind: 'remind',
        now: new Date(Date.parse(NOW) + 13 * DAY_MS).toISOString(),
      }),
    ).toEqual({ accepted: false, code: 'REMINDER_LIMIT_REACHED' });

    for (const command of [
      { kind: 'decline', now: '2030-01-05T12:00:00.000Z' },
      { kind: 'permanently-bounce', now: '2030-01-05T12:00:00.000Z' },
      { kind: 'revoke', now: '2030-01-05T12:00:00.000Z', reason: 'operator decision' },
      { kind: 'expire', now: '2030-01-15T12:00:00.000Z' },
    ] as const) {
      const closed = transition(issued.state, command) as {
        accepted: boolean;
        state: Readonly<Record<string, unknown>>;
      };
      expect(closed.accepted).toBe(true);
      expect(countActive([closed.state], command.now)).toBe(0);
      expect(transition(closed.state, { kind: 'remind', now: command.now })).toMatchObject({
        accepted: false,
      });
    }
    expect(countActive([issued.state], '2030-01-15T12:00:00.000Z')).toBe(0);
  });

  it('keeps forwarded lookup generic and consumes only after completed recipient activation', async () => {
    const module = await loadInvitations();
    const admit = requireFunction<
      (input: Readonly<Record<string, unknown>>) => Readonly<Record<string, unknown>>
    >(module, 'decideBetaInvitationAdmission');
    const transition = requireFunction<
      (
        state: Readonly<Record<string, unknown>>,
        command: Readonly<Record<string, unknown>>,
      ) => Readonly<Record<string, unknown>>
    >(module, 'decideBetaInvitationTransition');
    const projectAccess = requireFunction<
      (
        state: Readonly<Record<string, unknown>> | null,
        evidence: Readonly<Record<string, unknown>>,
      ) => Readonly<Record<string, unknown>>
    >(module, 'projectBetaInvitationAccess');
    const issued = admit(admissionInput()) as { state: Readonly<Record<string, unknown>> };

    const forwarded = projectAccess(issued.state, { recipientPossessionVerified: false });
    expect(forwarded).toEqual({ accepted: false, code: 'INVITATION_UNAVAILABLE' });
    expect(projectAccess(null, { recipientPossessionVerified: false })).toEqual(forwarded);
    expect(JSON.stringify(forwarded)).not.toMatch(/recipient|account|email|exists/iu);

    const interrupted = transition(issued.state, {
      kind: 'complete-activation',
      now: '2030-01-03T12:00:00.000Z',
      recipientPossessionVerified: true,
      accountActivationCompleted: false,
      accountReference: 'account:opaque:one',
    });
    expect(interrupted).toEqual({ accepted: false, code: 'ACTIVATION_INCOMPLETE' });
    const accepted = transition(issued.state, {
      kind: 'complete-activation',
      now: '2030-01-03T12:00:00.000Z',
      recipientPossessionVerified: true,
      accountActivationCompleted: true,
      essentialTermsAccepted: true,
      accountReference: 'account:opaque:one',
    });
    expect(accepted).toMatchObject({
      accepted: true,
      state: { status: 'accepted', accountReference: 'account:opaque:one' },
      effects: [{ kind: 'consume-secret' }, { kind: 'handoff-beta-access' }],
    });
  });

  it('keeps accepted accounts and team invitations outside beta revocation and applies purpose-bound retention', async () => {
    const module = await loadInvitations();
    const admit = requireFunction<
      (input: Readonly<Record<string, unknown>>) => Readonly<Record<string, unknown>>
    >(module, 'decideBetaInvitationAdmission');
    const transition = requireFunction<
      (
        state: Readonly<Record<string, unknown>>,
        command: Readonly<Record<string, unknown>>,
      ) => Readonly<Record<string, unknown>>
    >(module, 'decideBetaInvitationTransition');
    const retention = requireFunction<
      (
        state: Readonly<Record<string, unknown>>,
        input: Readonly<Record<string, unknown>>,
      ) => Readonly<Record<string, unknown>>
    >(module, 'decideInvitationRetention');
    const issued = admit(admissionInput()) as { state: Readonly<Record<string, unknown>> };
    const accepted = transition(issued.state, {
      kind: 'complete-activation',
      now: '2030-01-03T12:00:00.000Z',
      recipientPossessionVerified: true,
      accountActivationCompleted: true,
      essentialTermsAccepted: true,
      accountReference: 'account:opaque:one',
    }) as { state: Readonly<Record<string, unknown>> };

    expect(
      transition(accepted.state, {
        kind: 'revoke',
        now: '2030-01-04T12:00:00.000Z',
        reason: 'must use account authority instead',
      }),
    ).toEqual({ accepted: false, code: 'ACCEPTED_AUTHORITY_SEPARATE' });
    expect(
      transition(
        {
          kind: 'administrative-team',
          invitationId: 'team-one',
          recipientKey: 'recipient:sha256:team',
          role: 'support',
          status: 'pending',
          version: 1n,
          createdAt: NOW,
          updatedAt: NOW,
        },
        { kind: 'revoke', now: '2030-01-04T12:00:00.000Z', reason: 'team policy' },
      ),
    ).toEqual({ accepted: false, code: 'INVITATION_KIND_UNSUPPORTED' });

    expect(
      retention(accepted.state, {
        now: '2030-06-01T00:00:00.000Z',
        purposeRetentionUntil: '2030-07-01T00:00:00.000Z',
        afterRetention: 'pseudonymize-personal-data',
      }),
    ).toEqual({ action: 'retain', basis: 'purpose' });
    expect(
      retention(accepted.state, {
        now: '2030-08-01T00:00:00.000Z',
        purposeRetentionUntil: '2030-07-01T00:00:00.000Z',
        legalHoldUntil: '2031-01-01T00:00:00.000Z',
        afterRetention: 'delete-personal-data',
      }),
    ).toEqual({ action: 'retain', basis: 'legal-hold' });
    expect(
      retention(accepted.state, {
        now: '2031-02-01T00:00:00.000Z',
        purposeRetentionUntil: '2030-07-01T00:00:00.000Z',
        legalHoldUntil: '2031-01-01T00:00:00.000Z',
        afterRetention: 'delete-personal-data',
      }),
    ).toEqual({
      action: 'delete-personal-data',
      preserveMinimumAuditReceipt: true,
    });
  });

  it('requires essential terms and governs risky batch actions before durable execution', async () => {
    const module = await loadInvitations();
    const admit = requireFunction<
      (input: Readonly<Record<string, unknown>>) => Readonly<Record<string, unknown>>
    >(module, 'decideBetaInvitationAdmission');
    const transition = requireFunction<
      (
        state: Readonly<Record<string, unknown>>,
        command: Readonly<Record<string, unknown>>,
      ) => Readonly<Record<string, unknown>>
    >(module, 'decideBetaInvitationTransition');
    const batchAdmission = requireFunction<
      (input: Readonly<Record<string, unknown>>) => Readonly<Record<string, unknown>>
    >(module, 'decideInvitationBatchAdmission');
    const issued = admit(admissionInput()) as { state: Readonly<Record<string, unknown>> };

    expect(
      transition(issued.state, {
        kind: 'complete-activation',
        now: '2030-01-03T12:00:00.000Z',
        recipientPossessionVerified: true,
        accountActivationCompleted: true,
        essentialTermsAccepted: false,
        accountReference: 'account:opaque:one',
      }),
    ).toEqual({ accepted: false, code: 'ESSENTIAL_TERMS_REQUIRED' });
    expect(
      batchAdmission({
        action: 'revoke',
        targetCount: 20,
        impactReviewed: true,
        reason: ' ',
        risk: 'high',
        approvalGranted: false,
      }),
    ).toEqual({ accepted: false, code: 'REASON_REQUIRED' });
    expect(
      batchAdmission({
        action: 'revoke',
        targetCount: 20,
        impactReviewed: true,
        reason: 'close compromised campaign',
        risk: 'high',
        approvalGranted: false,
      }),
    ).toEqual({ accepted: false, code: 'APPROVAL_REQUIRED' });
    expect(
      batchAdmission({
        action: 'revoke',
        targetCount: 20,
        impactReviewed: true,
        reason: 'close compromised campaign',
        risk: 'high',
        approvalGranted: true,
      }),
    ).toEqual({
      accepted: true,
      jobRequired: true,
      partialFailureReportingRequired: true,
      finalReceiptRequired: true,
      irreversible: true,
    });

    const delivered = transition(issued.state, {
      kind: 'record-delivery',
      now: '2030-01-01T12:01:00.000Z',
      outcome: 'delivered',
    }) as { state: Readonly<Record<string, unknown>> };
    expect(delivered.state).toMatchObject({
      events: [{ kind: 'created' }, { kind: 'sent' }, { kind: 'delivered' }],
    });
    expect(JSON.stringify(delivered.state)).not.toMatch(/open-pixel|click|fingerprint|device-id/iu);
  });
});
