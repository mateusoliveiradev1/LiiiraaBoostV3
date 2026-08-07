export const BETA_INVITATION_ACTIVE_LIMIT = 25;
export const BETA_INVITATION_DEFAULT_VALIDITY_MS = 14 * 24 * 60 * 60 * 1_000;
export const BETA_INVITATION_MAX_REMINDERS = 2;
export const BETA_INVITATION_FIRST_REMINDER_AFTER_MS = 4 * 24 * 60 * 60 * 1_000;
export const BETA_INVITATION_FINAL_REMINDER_BEFORE_EXPIRY_MS = 2 * 24 * 60 * 60 * 1_000;

export type InvitationKind = 'beta' | 'administrative-team';
export type BetaInvitationStatus =
  | 'queued'
  | 'pending'
  | 'accepted'
  | 'expired'
  | 'declined'
  | 'revoked'
  | 'permanently-bounced';
export type BetaInvitationTerminalStatus = Exclude<BetaInvitationStatus, 'queued' | 'pending'>;
export type InvitationPreflightClassification =
  | 'valid'
  | 'duplicate'
  | 'active'
  | 'invalid'
  | 'ineligible';

export interface InvitationPreflightRow {
  readonly rowId: string;
  readonly recipientKey: string;
  readonly emailValid: boolean;
  readonly eligible: boolean;
}

export interface InvitationPreflightResult {
  readonly rowId: string;
  readonly recipientKey: string;
  readonly classification: InvitationPreflightClassification;
}

export interface BetaInvitationEvent {
  readonly kind:
    | 'created'
    | 'queued'
    | 'sent'
    | 'delivered'
    | 'delivery-failed'
    | 'resent'
    | 'reminded'
    | 'accepted'
    | 'expired'
    | 'declined'
    | 'revoked'
    | 'permanently-bounced';
  readonly at: string;
}

export interface BetaInvitationState {
  readonly kind: 'beta';
  readonly invitationId: string;
  readonly recipientKey: string;
  readonly locale: string;
  readonly version: bigint;
  readonly status: BetaInvitationStatus;
  readonly reminderCount: number;
  readonly reminderWindowStartedAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly events: readonly BetaInvitationEvent[];
  readonly campaign?: string;
  readonly cohort?: string;
  readonly noteReference?: string;
  readonly queuePosition?: number;
  readonly expiresAt?: string;
  readonly closedAt?: string;
  readonly accountReference?: string;
}

export interface AdministrativeTeamInvitationState {
  readonly kind: 'administrative-team';
  readonly invitationId: string;
  readonly recipientKey: string;
  readonly role: string;
  readonly status: 'pending' | 'accepted' | 'expired' | 'declined' | 'revoked';
  readonly version: bigint;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type InvitationState = BetaInvitationState | AdministrativeTeamInvitationState;

export type BetaInvitationEffect =
  | Readonly<{ kind: 'issue-secret' }>
  | Readonly<{ kind: 'invalidate-secret' }>
  | Readonly<{ kind: 'consume-secret' }>
  | Readonly<{ kind: 'send-invitation'; locale: string }>
  | Readonly<{ kind: 'send-reminder'; reminderNumber: 1 | 2; locale: string }>
  | Readonly<{ kind: 'handoff-beta-access'; accountReference: string }>;

export type BetaInvitationDecision =
  | Readonly<{
      accepted: true;
      state: BetaInvitationState;
      effects: readonly BetaInvitationEffect[];
    }>
  | Readonly<{
      accepted: false;
      code:
        | 'CAPACITY_STATE_INVALID'
        | 'INVITATION_INPUT_INVALID'
        | 'INVITATION_KIND_UNSUPPORTED'
        | 'INVITATION_STATE_IMMUTABLE'
        | 'INVITATION_NOT_PENDING'
        | 'INVITATION_NOT_QUEUED'
        | 'INVITATION_EXPIRED'
        | 'EXPIRY_CHOICE_INVALID'
        | 'JUSTIFICATION_REQUIRED'
        | 'RECIPIENT_IMMUTABLE'
        | 'REMINDER_NOT_DUE'
        | 'REMINDER_LIMIT_REACHED'
        | 'EXPIRY_NOT_DUE'
        | 'RECIPIENT_POSSESSION_REQUIRED'
        | 'POSSESSION_EVIDENCE_EXPIRED'
        | 'ACTIVATION_INCOMPLETE'
        | 'ESSENTIAL_TERMS_REQUIRED'
        | 'ACCOUNT_REFERENCE_REQUIRED'
        | 'ACCEPTED_AUTHORITY_SEPARATE'
        | 'ACTION_UNAVAILABLE';
    }>;

export type BetaInvitationCommand =
  | Readonly<{ kind: 'promote'; now: string }>
  | Readonly<{
      kind: 'resend';
      now: string;
      expiryMode: 'preserve' | 'restart';
      justification: string;
    }>
  | Readonly<{ kind: 'remind'; now: string }>
  | Readonly<{
      kind: 'record-delivery';
      now: string;
      outcome: 'delivered' | 'failed' | 'permanently-bounced';
    }>
  | Readonly<{ kind: 'permanently-bounce'; now: string }>
  | Readonly<{ kind: 'decline'; now: string }>
  | Readonly<{ kind: 'revoke'; now: string; reason: string }>
  | Readonly<{ kind: 'expire'; now: string }>
  | Readonly<{
      kind: 'complete-activation';
      now: string;
      recipientPossessionVerified: boolean;
      possessionEvidenceExpiresAt?: string;
      accountActivationCompleted: boolean;
      essentialTermsAccepted: boolean;
      accountReference: string;
    }>
  | Readonly<{ kind: 'change-recipient'; now: string; recipientKey: string }>;

const instant = (value: string): number => {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error('invitation decisions require ISO date-time values');
  return parsed;
};

const futureInstant = (value: string, durationMs: number): string =>
  new Date(instant(value) + durationMs).toISOString();

const nonEmpty = (value: string): boolean => value.trim().length > 0;

const appendEvent = (
  state: BetaInvitationState,
  kind: BetaInvitationEvent['kind'],
  at: string,
): readonly BetaInvitationEvent[] => [...state.events, { kind, at }];

const isTerminal = (status: BetaInvitationStatus): status is BetaInvitationTerminalStatus =>
  status !== 'queued' && status !== 'pending';

export const preflightBetaInvitationRows = (input: Readonly<{
  rows: readonly InvitationPreflightRow[];
  activeRecipientKeys: readonly string[];
}>): readonly InvitationPreflightResult[] => {
  const active = new Set(input.activeRecipientKeys);
  const seen = new Set<string>();

  return input.rows.map((row) => {
    let classification: InvitationPreflightClassification;
    if (!nonEmpty(row.rowId) || !nonEmpty(row.recipientKey) || !row.emailValid) {
      classification = 'invalid';
    } else if (active.has(row.recipientKey)) {
      classification = 'active';
    } else if (seen.has(row.recipientKey)) {
      classification = 'duplicate';
    } else if (!row.eligible) {
      classification = 'ineligible';
    } else {
      classification = 'valid';
    }
    if (nonEmpty(row.recipientKey)) seen.add(row.recipientKey);
    return { rowId: row.rowId, recipientKey: row.recipientKey, classification };
  });
};

export interface BetaInvitationAdmissionInput {
  readonly invitationId: string;
  readonly recipientKey: string;
  readonly locale: string;
  readonly now: string;
  readonly activeCount: number;
  readonly queuePosition: number;
  readonly campaign?: string;
  readonly cohort?: string;
  readonly noteReference?: string;
}

export const decideBetaInvitationAdmission = (
  input: BetaInvitationAdmissionInput,
): BetaInvitationDecision => {
  instant(input.now);
  if (
    !nonEmpty(input.invitationId) ||
    !nonEmpty(input.recipientKey) ||
    !nonEmpty(input.locale) ||
    !Number.isSafeInteger(input.queuePosition) ||
    input.queuePosition < 1
  ) {
    return { accepted: false, code: 'INVITATION_INPUT_INVALID' };
  }
  if (
    !Number.isSafeInteger(input.activeCount) ||
    input.activeCount < 0 ||
    input.activeCount > BETA_INVITATION_ACTIVE_LIMIT
  ) {
    return { accepted: false, code: 'CAPACITY_STATE_INVALID' };
  }

  const common = {
    kind: 'beta' as const,
    invitationId: input.invitationId,
    recipientKey: input.recipientKey,
    locale: input.locale,
    version: 1n,
    reminderCount: 0,
    reminderWindowStartedAt: input.now,
    createdAt: input.now,
    updatedAt: input.now,
    ...(input.campaign === undefined ? {} : { campaign: input.campaign }),
    ...(input.cohort === undefined ? {} : { cohort: input.cohort }),
    ...(input.noteReference === undefined ? {} : { noteReference: input.noteReference }),
  };

  if (input.activeCount === BETA_INVITATION_ACTIVE_LIMIT) {
    return {
      accepted: true,
      effects: [],
      state: {
        ...common,
        status: 'queued',
        queuePosition: input.queuePosition,
        events: [
          { kind: 'created', at: input.now },
          { kind: 'queued', at: input.now },
        ],
      },
    };
  }

  return {
    accepted: true,
    effects: [{ kind: 'issue-secret' }, { kind: 'send-invitation', locale: input.locale }],
    state: {
      ...common,
      status: 'pending',
      expiresAt: futureInstant(input.now, BETA_INVITATION_DEFAULT_VALIDITY_MS),
      events: [
        { kind: 'created', at: input.now },
        { kind: 'sent', at: input.now },
      ],
    },
  };
};

export const selectNextBetaInvitationPromotions = (
  queue: readonly Readonly<BetaInvitationState>[],
  availableSlots: number,
): readonly string[] => {
  if (!Number.isSafeInteger(availableSlots) || availableSlots <= 0) return [];
  const boundedSlots = Math.min(availableSlots, BETA_INVITATION_ACTIVE_LIMIT);
  return queue
    .filter((invitation) => invitation.status === 'queued')
    .toSorted((left, right) => {
      const queueOrder = (left.queuePosition ?? Number.MAX_SAFE_INTEGER) -
        (right.queuePosition ?? Number.MAX_SAFE_INTEGER);
      if (queueOrder !== 0) return queueOrder;
      const createdOrder = instant(left.createdAt) - instant(right.createdAt);
      if (createdOrder !== 0) return createdOrder;
      return left.invitationId.localeCompare(right.invitationId);
    })
    .slice(0, boundedSlots)
    .map((invitation) => invitation.invitationId);
};

export const countActiveBetaInvitations = (
  invitations: readonly Readonly<InvitationState>[],
  now: string,
): number => {
  const at = instant(now);
  return invitations.filter(
    (invitation): invitation is Readonly<BetaInvitationState> =>
      invitation.kind === 'beta' &&
      invitation.status === 'pending' &&
      invitation.expiresAt !== undefined &&
      instant(invitation.expiresAt) > at,
  ).length;
};

const pendingState = (
  state: BetaInvitationState,
): state is BetaInvitationState & Readonly<{ status: 'pending'; expiresAt: string }> =>
  state.status === 'pending' && state.expiresAt !== undefined;

const closeInvitation = (
  state: BetaInvitationState,
  status: BetaInvitationTerminalStatus,
  event: BetaInvitationEvent['kind'],
  now: string,
  extra: Readonly<Partial<Pick<BetaInvitationState, 'accountReference'>>> = {},
  effects: readonly BetaInvitationEffect[] = [],
): BetaInvitationDecision => ({
  accepted: true,
  effects,
  state: {
    ...state,
    ...extra,
    version: state.version + 1n,
    status,
    closedAt: now,
    updatedAt: now,
    events: appendEvent(state, event, now),
  },
});

export const decideBetaInvitationTransition = (
  current: InvitationState,
  command: BetaInvitationCommand,
): BetaInvitationDecision => {
  if (current.kind !== 'beta') return { accepted: false, code: 'INVITATION_KIND_UNSUPPORTED' };
  if (command.kind === 'change-recipient') {
    return { accepted: false, code: 'RECIPIENT_IMMUTABLE' };
  }
  const now = instant(command.now);

  if (current.status === 'accepted' && command.kind === 'revoke') {
    return { accepted: false, code: 'ACCEPTED_AUTHORITY_SEPARATE' };
  }
  if (isTerminal(current.status)) {
    return { accepted: false, code: 'INVITATION_STATE_IMMUTABLE' };
  }

  if (command.kind === 'promote') {
    if (current.status !== 'queued') return { accepted: false, code: 'INVITATION_NOT_QUEUED' };
    const { queuePosition: _queuePosition, ...withoutQueuePosition } = current;
    void _queuePosition;
    return {
      accepted: true,
      effects: [
        { kind: 'issue-secret' },
        { kind: 'send-invitation', locale: current.locale },
      ],
      state: {
        ...withoutQueuePosition,
        version: current.version + 1n,
        status: 'pending',
        expiresAt: futureInstant(command.now, BETA_INVITATION_DEFAULT_VALIDITY_MS),
        reminderWindowStartedAt: command.now,
        reminderCount: 0,
        updatedAt: command.now,
        events: appendEvent(current, 'sent', command.now),
      },
    };
  }

  if (!pendingState(current)) return { accepted: false, code: 'INVITATION_NOT_PENDING' };
  if (now >= instant(current.expiresAt) && command.kind !== 'expire') {
    return { accepted: false, code: 'INVITATION_EXPIRED' };
  }

  if (command.kind === 'resend') {
    if (!nonEmpty(command.justification)) {
      return { accepted: false, code: 'JUSTIFICATION_REQUIRED' };
    }
    if (!new Set<string>(['preserve', 'restart']).has(command.expiryMode)) {
      return { accepted: false, code: 'EXPIRY_CHOICE_INVALID' };
    }
    const restart = command.expiryMode === 'restart';
    return {
      accepted: true,
      effects: [
        { kind: 'invalidate-secret' },
        { kind: 'issue-secret' },
        { kind: 'send-invitation', locale: current.locale },
      ],
      state: {
        ...current,
        version: current.version + 1n,
        expiresAt: restart
          ? futureInstant(command.now, BETA_INVITATION_DEFAULT_VALIDITY_MS)
          : current.expiresAt,
        reminderWindowStartedAt: restart ? command.now : current.reminderWindowStartedAt,
        reminderCount: restart ? 0 : current.reminderCount,
        updatedAt: command.now,
        events: appendEvent(current, 'resent', command.now),
      },
    };
  }

  if (command.kind === 'remind') {
    if (current.reminderCount >= BETA_INVITATION_MAX_REMINDERS) {
      return { accepted: false, code: 'REMINDER_LIMIT_REACHED' };
    }
    const reminderNumber = (current.reminderCount + 1) as 1 | 2;
    const firstDueAt =
      instant(current.reminderWindowStartedAt) + BETA_INVITATION_FIRST_REMINDER_AFTER_MS;
    const finalDueAt =
      instant(current.expiresAt) - BETA_INVITATION_FINAL_REMINDER_BEFORE_EXPIRY_MS;
    const dueAt = reminderNumber === 1 ? firstDueAt : finalDueAt;
    if (now < dueAt) return { accepted: false, code: 'REMINDER_NOT_DUE' };
    return {
      accepted: true,
      effects: [{ kind: 'send-reminder', reminderNumber, locale: current.locale }],
      state: {
        ...current,
        version: current.version + 1n,
        reminderCount: reminderNumber,
        updatedAt: command.now,
        events: appendEvent(current, 'reminded', command.now),
      },
    };
  }

  if (command.kind === 'record-delivery') {
    if (command.outcome === 'permanently-bounced') {
      return closeInvitation(
        current,
        'permanently-bounced',
        'permanently-bounced',
        command.now,
      );
    }
    return {
      accepted: true,
      effects: [],
      state: {
        ...current,
        version: current.version + 1n,
        updatedAt: command.now,
        events: appendEvent(
          current,
          command.outcome === 'delivered' ? 'delivered' : 'delivery-failed',
          command.now,
        ),
      },
    };
  }

  if (command.kind === 'permanently-bounce') {
    return closeInvitation(
      current,
      'permanently-bounced',
      'permanently-bounced',
      command.now,
    );
  }
  if (command.kind === 'decline') {
    return closeInvitation(current, 'declined', 'declined', command.now);
  }
  if (command.kind === 'revoke') {
    if (!nonEmpty(command.reason)) return { accepted: false, code: 'JUSTIFICATION_REQUIRED' };
    return closeInvitation(current, 'revoked', 'revoked', command.now);
  }
  if (command.kind === 'expire') {
    if (now < instant(current.expiresAt)) return { accepted: false, code: 'EXPIRY_NOT_DUE' };
    return closeInvitation(current, 'expired', 'expired', command.now);
  }
  if (!command.recipientPossessionVerified) {
    return { accepted: false, code: 'RECIPIENT_POSSESSION_REQUIRED' };
  }
  if (
    command.possessionEvidenceExpiresAt !== undefined &&
    now >= instant(command.possessionEvidenceExpiresAt)
  ) {
    return { accepted: false, code: 'POSSESSION_EVIDENCE_EXPIRED' };
  }
  if (!command.accountActivationCompleted) {
    return { accepted: false, code: 'ACTIVATION_INCOMPLETE' };
  }
  if (!command.essentialTermsAccepted) {
    return { accepted: false, code: 'ESSENTIAL_TERMS_REQUIRED' };
  }
  if (!nonEmpty(command.accountReference)) {
    return { accepted: false, code: 'ACCOUNT_REFERENCE_REQUIRED' };
  }
  return closeInvitation(
    current,
    'accepted',
    'accepted',
    command.now,
    { accountReference: command.accountReference },
    [
      { kind: 'consume-secret' },
      { kind: 'handoff-beta-access', accountReference: command.accountReference },
    ],
  );
};

export type InvitationAccessProjection =
  | Readonly<{
      accepted: true;
      invitationId: string;
      locale: string;
      campaign?: string;
    }>
  | Readonly<{ accepted: false; code: 'INVITATION_UNAVAILABLE' }>;

export const projectBetaInvitationAccess = (
  invitation: Readonly<InvitationState> | null,
  evidence: Readonly<{ recipientPossessionVerified: boolean }>,
): InvitationAccessProjection => {
  if (
    invitation?.kind !== 'beta' ||
    invitation.status !== 'pending' ||
    !evidence.recipientPossessionVerified
  ) {
    return { accepted: false, code: 'INVITATION_UNAVAILABLE' };
  }
  return {
    accepted: true,
    invitationId: invitation.invitationId,
    locale: invitation.locale,
    ...(invitation.campaign === undefined ? {} : { campaign: invitation.campaign }),
  };
};

export type InvitationBatchAction = 'resend' | 'revoke';
export type InvitationBatchRisk = 'standard' | 'high';

export type InvitationBatchAdmission =
  | Readonly<{
      accepted: true;
      jobRequired: true;
      partialFailureReportingRequired: true;
      finalReceiptRequired: true;
      irreversible: boolean;
    }>
  | Readonly<{
      accepted: false;
      code:
        | 'BATCH_BOUNDS_INVALID'
        | 'IMPACT_REVIEW_REQUIRED'
        | 'REASON_REQUIRED'
        | 'APPROVAL_REQUIRED';
    }>;

export const decideInvitationBatchAdmission = (input: Readonly<{
  action: InvitationBatchAction;
  targetCount: number;
  impactReviewed: boolean;
  reason: string;
  risk: InvitationBatchRisk;
  approvalGranted: boolean;
}>): InvitationBatchAdmission => {
  if (!Number.isSafeInteger(input.targetCount) || input.targetCount < 1 || input.targetCount > 1_000) {
    return { accepted: false, code: 'BATCH_BOUNDS_INVALID' };
  }
  if (!input.impactReviewed) return { accepted: false, code: 'IMPACT_REVIEW_REQUIRED' };
  if (!nonEmpty(input.reason)) return { accepted: false, code: 'REASON_REQUIRED' };
  if (input.risk === 'high' && !input.approvalGranted) {
    return { accepted: false, code: 'APPROVAL_REQUIRED' };
  }
  return {
    accepted: true,
    jobRequired: true,
    partialFailureReportingRequired: true,
    finalReceiptRequired: true,
    irreversible: input.action === 'revoke',
  };
};

export type InvitationRetentionDecision =
  | Readonly<{ action: 'retain'; basis: 'operational' | 'purpose' | 'legal-hold' }>
  | Readonly<{
      action: 'delete-personal-data' | 'pseudonymize-personal-data';
      preserveMinimumAuditReceipt: true;
    }>;

export const decideInvitationRetention = (
  invitation: Readonly<InvitationState>,
  input: Readonly<{
    now: string;
    purposeRetentionUntil: string;
    legalHoldUntil?: string;
    afterRetention: 'delete-personal-data' | 'pseudonymize-personal-data';
  }>,
): InvitationRetentionDecision => {
  const now = instant(input.now);
  if (invitation.status === 'pending' || invitation.status === 'queued') {
    return { action: 'retain', basis: 'operational' };
  }
  if (input.legalHoldUntil !== undefined && now < instant(input.legalHoldUntil)) {
    return { action: 'retain', basis: 'legal-hold' };
  }
  if (now < instant(input.purposeRetentionUntil)) {
    return { action: 'retain', basis: 'purpose' };
  }
  return { action: input.afterRetention, preserveMinimumAuditReceipt: true };
};
