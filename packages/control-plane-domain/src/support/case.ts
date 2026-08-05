export const SUPPORT_REOPEN_WINDOW_MS = 14 * 24 * 60 * 60 * 1_000;
export const SUPPORT_ATTACHMENT_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;
export const DIAGNOSTIC_CONSENT_MAX_MS = 72 * 60 * 60 * 1_000;
export const ACCOUNT_DELETION_PENDING_MS = 7 * 24 * 60 * 60 * 1_000;

export type SupportPlan = 'free' | 'premium';
export type SupportCategory = 'general' | 'billing' | 'security' | 'restoration';
export type SupportDiagnosticFieldClass =
  | 'hardware-summary'
  | 'application-log-redacted'
  | 'optimization-plan-receipt'
  | 'recovery-journal-excerpt'
  | 'crash-metadata';
export type SupportCaseStatus =
  'open' | 'waiting-customer' | 'waiting-support' | 'resolved' | 'closed';

export interface SupportMessage {
  readonly messageId: string;
  readonly author: 'customer' | 'support' | 'system';
  readonly body: string;
  readonly createdAt: string;
}

export interface SupportAttachmentMetadata {
  readonly attachmentId: string;
  readonly checksumSha256: string;
  readonly fieldClass: SupportDiagnosticFieldClass;
  readonly objectKey: string;
  readonly byteLength: number;
}

export interface SupportCaseState {
  readonly caseId: string;
  readonly accountId: string;
  readonly version: bigint;
  readonly status: SupportCaseStatus;
  readonly plan: SupportPlan;
  readonly category: SupportCategory;
  readonly priority: 'normal' | 'priority';
  readonly subjectRedacted: string;
  readonly responseTargetBusinessHours: 24 | 72;
  readonly expectedResponseAt: string;
  readonly history: readonly SupportMessage[];
  readonly attachments: readonly SupportAttachmentMetadata[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly closedAt?: string;
  readonly relatedCaseId?: string;
}

export type SupportCaseCommand =
  | Readonly<{
      kind: 'create';
      accountId: string;
      caseId: string;
      plan: SupportPlan;
      category: SupportCategory;
      subjectRedacted: string;
      message: string;
      messageId: string;
      now: string;
    }>
  | Readonly<{
      kind: 'reply';
      author: SupportMessage['author'];
      message: string;
      messageId: string;
      now: string;
    }>
  | Readonly<{
      kind: 'attach-metadata';
      attachment: SupportAttachmentMetadata;
      now: string;
    }>
  | Readonly<{ kind: 'close'; now: string }>
  | Readonly<{ kind: 'reopen'; now: string; relatedCaseId?: string }>;

export type SupportCaseEffect =
  | Readonly<{
      kind: 'schedule-attachment-purge';
      caseId: string;
      availableAt: string;
    }>
  | Readonly<{ kind: 'expire-case-consents'; caseId: string }>;

export type SupportCaseDecision =
  | Readonly<{
      accepted: true;
      outcome: 'created' | 'updated' | 'closed' | 'reopened' | 'related-case-created';
      state: SupportCaseState;
      effects: readonly SupportCaseEffect[];
    }>
  | Readonly<{
      accepted: false;
      code:
        | 'CASE_NOT_FOUND'
        | 'CASE_ALREADY_EXISTS'
        | 'CASE_CLOSED'
        | 'INVALID_ATTACHMENT_METADATA'
        | 'INVALID_CASE_CONTENT'
        | 'REOPEN_WINDOW_EXPIRED';
    }>;

const instant = (value: string): number => {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error('lifecycle decisions require ISO date-time values');
  return parsed;
};

const isWeekend = (date: Date): boolean => date.getUTCDay() === 0 || date.getUTCDay() === 6;

const addBusinessHours = (value: string, hours: number): string => {
  const result = new Date(instant(value));
  let remainingDays = hours / 24;
  while (remainingDays > 0) {
    result.setUTCDate(result.getUTCDate() + 1);
    if (!isWeekend(result)) remainingDays -= 1;
  }
  return result.toISOString();
};

const responseTarget = (plan: SupportPlan, category: SupportCategory): 24 | 72 =>
  plan === 'premium' || category !== 'general' ? 24 : 72;

const validText = (value: string): boolean => value.trim().length > 0 && value.length <= 4_096;

const validAttachment = (caseId: string, attachment: SupportAttachmentMetadata): boolean =>
  /^[a-f0-9]{64}$/u.test(attachment.checksumSha256) &&
  Number.isSafeInteger(attachment.byteLength) &&
  attachment.byteLength >= 0 &&
  attachment.byteLength <= 5 * 1_024 * 1_024 &&
  attachment.objectKey === `diagnostics/${caseId}/${attachment.attachmentId}` &&
  !('content' in attachment) &&
  !('bytes' in attachment);

export const decideSupportCaseTransition = (
  current: SupportCaseState | null,
  command: SupportCaseCommand,
): SupportCaseDecision => {
  if (command.kind === 'create') {
    if (current !== null) return { accepted: false, code: 'CASE_ALREADY_EXISTS' };
    if (!validText(command.subjectRedacted) || !validText(command.message)) {
      return { accepted: false, code: 'INVALID_CASE_CONTENT' };
    }
    const target = responseTarget(command.plan, command.category);
    return {
      accepted: true,
      outcome: 'created',
      effects: [],
      state: {
        caseId: command.caseId,
        accountId: command.accountId,
        version: 1n,
        status: 'open',
        plan: command.plan,
        category: command.category,
        priority: command.category === 'general' ? 'normal' : 'priority',
        subjectRedacted: command.subjectRedacted,
        responseTargetBusinessHours: target,
        expectedResponseAt: addBusinessHours(command.now, target),
        history: [
          {
            messageId: command.messageId,
            author: 'customer',
            body: command.message,
            createdAt: command.now,
          },
        ],
        attachments: [],
        createdAt: command.now,
        updatedAt: command.now,
      },
    };
  }
  if (current === null) return { accepted: false, code: 'CASE_NOT_FOUND' };
  if (command.kind === 'reply') {
    if (current.status === 'closed') return { accepted: false, code: 'CASE_CLOSED' };
    if (!validText(command.message)) return { accepted: false, code: 'INVALID_CASE_CONTENT' };
    return {
      accepted: true,
      outcome: 'updated',
      effects: [],
      state: {
        ...current,
        version: current.version + 1n,
        status: command.author === 'customer' ? 'waiting-support' : 'waiting-customer',
        history: [
          ...current.history,
          {
            messageId: command.messageId,
            author: command.author,
            body: command.message,
            createdAt: command.now,
          },
        ],
        updatedAt: command.now,
      },
    };
  }
  if (command.kind === 'attach-metadata') {
    if (current.status === 'closed') return { accepted: false, code: 'CASE_CLOSED' };
    if (!validAttachment(current.caseId, command.attachment)) {
      return { accepted: false, code: 'INVALID_ATTACHMENT_METADATA' };
    }
    return {
      accepted: true,
      outcome: 'updated',
      effects: [],
      state: {
        ...current,
        version: current.version + 1n,
        attachments: [...current.attachments, command.attachment],
        updatedAt: command.now,
      },
    };
  }
  if (command.kind === 'close') {
    if (current.status === 'closed') return { accepted: false, code: 'CASE_CLOSED' };
    return {
      accepted: true,
      outcome: 'closed',
      effects: [
        {
          kind: 'schedule-attachment-purge',
          caseId: current.caseId,
          availableAt: new Date(
            instant(command.now) + SUPPORT_ATTACHMENT_RETENTION_MS,
          ).toISOString(),
        },
      ],
      state: {
        ...current,
        version: current.version + 1n,
        status: 'closed',
        closedAt: command.now,
        updatedAt: command.now,
      },
    };
  }
  if (current.status !== 'closed' || current.closedAt === undefined) {
    return { accepted: false, code: 'CASE_CLOSED' };
  }
  if (instant(command.now) - instant(current.closedAt) <= SUPPORT_REOPEN_WINDOW_MS) {
    return {
      accepted: true,
      outcome: 'reopened',
      effects: [{ kind: 'expire-case-consents', caseId: current.caseId }],
      state: {
        ...current,
        version: current.version + 1n,
        status: 'open',
        updatedAt: command.now,
      },
    };
  }
  if (command.relatedCaseId === undefined) {
    return { accepted: false, code: 'REOPEN_WINDOW_EXPIRED' };
  }
  const { closedAt: _closedAt, ...reopenedSource } = current;
  void _closedAt;
  return {
    accepted: true,
    outcome: 'related-case-created',
    effects: [],
    state: {
      ...reopenedSource,
      caseId: command.relatedCaseId,
      relatedCaseId: current.caseId,
      version: 1n,
      status: 'open',
      history: [],
      attachments: [],
      createdAt: command.now,
      updatedAt: command.now,
    },
  };
};

export interface DiagnosticConsentState {
  readonly consentId: string;
  readonly accountId: string;
  readonly caseId: string;
  readonly purpose: string;
  readonly fieldClasses: readonly SupportDiagnosticFieldClass[];
  readonly grantedAt: string;
  readonly expiresAt: string;
  readonly status: 'active' | 'revoked' | 'expired';
  readonly version: bigint;
  readonly revokedAt?: string;
}

export type ConsentCommand =
  | Readonly<{
      kind: 'grant';
      consentId: string;
      accountId: string;
      caseId: string;
      purpose: string;
      fieldClasses: readonly SupportDiagnosticFieldClass[];
      grantedAt: string;
      expiresAt: string;
    }>
  | Readonly<{ kind: 'revoke' | 'expire'; now: string }>;

export type ConsentDecision =
  | Readonly<{
      accepted: true;
      state: DiagnosticConsentState;
      effects: readonly (
        | Readonly<{ kind: 'notify-active-streams'; consentId: string }>
        | Readonly<{
            kind: 'append-revocation-receipt';
            consentId: string;
            consentVersion: bigint;
            occurredAt: string;
          }>
      )[];
    }>
  | Readonly<{
      accepted: false;
      code:
        | 'CONSENT_NOT_FOUND'
        | 'CONSENT_WINDOW_INVALID'
        | 'CONSENT_SCOPE_INVALID'
        | 'FRESH_CONSENT_REQUIRED'
        | 'CONSENT_NOT_ACTIVE';
    }>;

const allowedFieldClasses = new Set<SupportDiagnosticFieldClass>([
  'hardware-summary',
  'application-log-redacted',
  'optimization-plan-receipt',
  'recovery-journal-excerpt',
  'crash-metadata',
]);

export const decideConsentTransition = (
  current: DiagnosticConsentState | null,
  command: ConsentCommand,
): ConsentDecision => {
  if (command.kind === 'grant') {
    if (current !== null) return { accepted: false, code: 'FRESH_CONSENT_REQUIRED' };
    const grantedAt = instant(command.grantedAt);
    const expiresAt = instant(command.expiresAt);
    if (expiresAt <= grantedAt || expiresAt - grantedAt > DIAGNOSTIC_CONSENT_MAX_MS) {
      return { accepted: false, code: 'CONSENT_WINDOW_INVALID' };
    }
    if (
      !validText(command.purpose) ||
      command.fieldClasses.length === 0 ||
      new Set(command.fieldClasses).size !== command.fieldClasses.length ||
      command.fieldClasses.some((fieldClass) => !allowedFieldClasses.has(fieldClass))
    ) {
      return { accepted: false, code: 'CONSENT_SCOPE_INVALID' };
    }
    return {
      accepted: true,
      effects: [],
      state: {
        consentId: command.consentId,
        accountId: command.accountId,
        caseId: command.caseId,
        purpose: command.purpose,
        fieldClasses: [...command.fieldClasses],
        grantedAt: command.grantedAt,
        expiresAt: command.expiresAt,
        status: 'active',
        version: 1n,
      },
    };
  }
  if (current === null) return { accepted: false, code: 'CONSENT_NOT_FOUND' };
  if (current.status !== 'active') return { accepted: false, code: 'CONSENT_NOT_ACTIVE' };
  if (command.kind === 'expire' && instant(command.now) < instant(current.expiresAt)) {
    return { accepted: false, code: 'CONSENT_NOT_ACTIVE' };
  }
  const next = {
    ...current,
    version: current.version + 1n,
    status: command.kind === 'revoke' ? ('revoked' as const) : ('expired' as const),
    ...(command.kind === 'revoke' ? { revokedAt: command.now } : {}),
  };
  return {
    accepted: true,
    state: next,
    effects: [
      { kind: 'notify-active-streams', consentId: current.consentId },
      ...(command.kind === 'revoke'
        ? [
            {
              kind: 'append-revocation-receipt' as const,
              consentId: current.consentId,
              consentVersion: next.version,
              occurredAt: command.now,
            },
          ]
        : []),
    ],
  };
};

export type RetainedEvidenceClass =
  'billing-invoice-tax' | 'antifraud-dispute' | 'security-recovery' | 'administrative-audit';

export interface MinimizedRetentionRecord {
  readonly evidenceClass: RetainedEvidenceClass;
  readonly purpose: string;
  readonly sourceAt: string;
  readonly retainUntil: string;
  readonly legalHold?: Readonly<{
    authorizedBy: string;
    purpose: string;
    expiresAt: string;
  }>;
}

export interface AccountDeletionState {
  readonly accountId: string;
  readonly version: bigint;
  readonly status: 'none' | 'pending' | 'canceled' | 'completed' | 'partially-retained';
  readonly retentionRecords: readonly MinimizedRetentionRecord[];
  readonly requestId?: string;
  readonly requestedAt?: string;
  readonly finalizeAt?: string;
  readonly canceledAt?: string;
  readonly finalizedAt?: string;
}

export const initialDeletionState = (accountId: string): AccountDeletionState => ({
  accountId,
  version: 0n,
  status: 'none',
  retentionRecords: [],
});

export type DeletionEvidence = Readonly<{
  evidenceClass: RetainedEvidenceClass;
  sourceAt: string;
}>;

export type LegalHold = Readonly<{
  evidenceClass: RetainedEvidenceClass;
  authorizedBy: string;
  purpose: string;
  expiresAt: string;
}>;

export type DeletionCommand =
  | Readonly<{
      kind: 'request';
      requestId: string;
      strongAuthVerified: boolean;
      now: string;
    }>
  | Readonly<{ kind: 'cancel'; now: string }>
  | Readonly<{
      kind: 'finalize';
      now: string;
      evidence: readonly DeletionEvidence[];
      legalHolds?: readonly LegalHold[];
    }>;

export type DeletionEffect =
  | Readonly<{ kind: 'schedule-account-finalization'; requestId: string; availableAt: string }>
  | Readonly<{ kind: 'cancel-account-finalization'; requestId: string }>
  | Readonly<{ kind: 'erase-ordinary-account-data'; accountId: string }>;

export type DeletionDecision =
  | Readonly<{
      accepted: true;
      state: AccountDeletionState;
      effects: readonly DeletionEffect[];
    }>
  | Readonly<{
      accepted: false;
      code:
        | 'STRONG_AUTH_REQUIRED'
        | 'DELETION_ALREADY_REQUESTED'
        | 'DELETION_NOT_PENDING'
        | 'DELETION_WINDOW_ACTIVE'
        | 'DELETION_WINDOW_ELAPSED'
        | 'LEGAL_HOLD_INVALID';
    }>;

const retentionYears: Readonly<Record<RetainedEvidenceClass, number>> = {
  'billing-invoice-tax': 5,
  'antifraud-dispute': 5,
  'security-recovery': 2,
  'administrative-audit': 5,
};

const retentionPurpose: Readonly<Record<RetainedEvidenceClass, string>> = {
  'billing-invoice-tax': 'legal-billing-invoice-tax-evidence',
  'antifraud-dispute': 'antifraud-and-dispute-evidence',
  'security-recovery': 'security-and-recovery-evidence',
  'administrative-audit': 'administrative-and-audit-chain-evidence',
};

const addUtcYears = (value: string, years: number): string => {
  const date = new Date(instant(value));
  date.setUTCFullYear(date.getUTCFullYear() + years);
  return date.toISOString();
};

export const decideDeletionTransition = (
  current: AccountDeletionState,
  command: DeletionCommand,
): DeletionDecision => {
  if (command.kind === 'request') {
    if (!command.strongAuthVerified) return { accepted: false, code: 'STRONG_AUTH_REQUIRED' };
    if (current.status === 'pending')
      return { accepted: false, code: 'DELETION_ALREADY_REQUESTED' };
    const finalizeAt = new Date(instant(command.now) + ACCOUNT_DELETION_PENDING_MS).toISOString();
    return {
      accepted: true,
      effects: [
        {
          kind: 'schedule-account-finalization',
          requestId: command.requestId,
          availableAt: finalizeAt,
        },
      ],
      state: {
        accountId: current.accountId,
        version: current.version + 1n,
        status: 'pending',
        retentionRecords: [],
        requestId: command.requestId,
        requestedAt: command.now,
        finalizeAt,
      },
    };
  }
  if (
    current.status !== 'pending' ||
    current.requestId === undefined ||
    current.finalizeAt === undefined
  ) {
    return { accepted: false, code: 'DELETION_NOT_PENDING' };
  }
  if (command.kind === 'cancel') {
    if (instant(command.now) >= instant(current.finalizeAt)) {
      return { accepted: false, code: 'DELETION_WINDOW_ELAPSED' };
    }
    return {
      accepted: true,
      effects: [{ kind: 'cancel-account-finalization', requestId: current.requestId }],
      state: {
        ...current,
        version: current.version + 1n,
        status: 'canceled',
        canceledAt: command.now,
      },
    };
  }
  if (instant(command.now) < instant(current.finalizeAt)) {
    return { accepted: false, code: 'DELETION_WINDOW_ACTIVE' };
  }
  const holds = command.legalHolds ?? [];
  if (
    holds.some(
      (hold) =>
        !validText(hold.purpose) ||
        hold.authorizedBy.trim().length === 0 ||
        instant(hold.expiresAt) <= instant(command.now),
    )
  ) {
    return { accepted: false, code: 'LEGAL_HOLD_INVALID' };
  }
  const retentionRecords = command.evidence.map<MinimizedRetentionRecord>((evidence) => {
    const hold = holds.find((candidate) => candidate.evidenceClass === evidence.evidenceClass);
    const defaultUntil = addUtcYears(evidence.sourceAt, retentionYears[evidence.evidenceClass]);
    return {
      evidenceClass: evidence.evidenceClass,
      purpose: retentionPurpose[evidence.evidenceClass],
      sourceAt: evidence.sourceAt,
      retainUntil:
        hold !== undefined && instant(hold.expiresAt) > instant(defaultUntil)
          ? hold.expiresAt
          : defaultUntil,
      ...(hold === undefined
        ? {}
        : {
            legalHold: {
              authorizedBy: hold.authorizedBy,
              purpose: hold.purpose,
              expiresAt: hold.expiresAt,
            },
          }),
    };
  });
  return {
    accepted: true,
    effects: [{ kind: 'erase-ordinary-account-data', accountId: current.accountId }],
    state: {
      ...current,
      version: current.version + 1n,
      status: retentionRecords.length === 0 ? 'completed' : 'partially-retained',
      retentionRecords,
      finalizedAt: command.now,
    },
  };
};
