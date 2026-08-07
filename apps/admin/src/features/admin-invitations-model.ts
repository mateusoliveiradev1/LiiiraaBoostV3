import type {
  AdminInvitationDeliveryStateJson,
  AdminInvitationLifecycleStateJson,
} from '@liiiraa/contracts-ts';

export const INVITATION_ACTIVE_LIMIT = 25;
export const INVITATION_DEFAULT_EXPIRY_DAYS = 14;
export const INVITATION_MAX_PREFLIGHT_ROWS = 100;
export const INVITATION_MAX_BATCH_TARGETS = 1_000;
export const INVITATION_MAX_REMINDERS = 2;

export type InvitationAuthorityState = 'live' | 'reconnecting' | 'stale' | 'offline' | 'degraded';
export type InvitationPreflightClassification =
  'valid' | 'duplicate' | 'active' | 'invalid' | 'ineligible';
export type InvitationKind = 'beta' | 'administrative-team';

export type InvitationRecordAuthority = Readonly<{
  aggregateVersion: string;
  deliveryState: AdminInvitationDeliveryStateJson;
  expiresAt?: string;
  invitationId: string;
  lifecycleState: AdminInvitationLifecycleStateJson;
  recipientMasked: string;
  reminderCount: number;
}>;

type PreflightRowInput = Readonly<{
  classification: InvitationPreflightClassification;
  recipient: string;
  rowId: string;
}>;

type InvitationCapacityAuthority = Readonly<{
  activeCount: number;
  activeLimit: number;
  queuedCount: number;
}>;

const isBoundedInteger = (value: number, minimum: number, maximum: number): boolean =>
  Number.isSafeInteger(value) && value >= minimum && value <= maximum;

const instant = (value: string, code: string): number => {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(code);
  return parsed;
};

const reasonIsValid = (value: string): boolean => {
  const length = value.trim().length;
  return length >= 8 && length <= 256;
};

export const maskInvitationRecipient = (value: string): string => {
  const normalized = value.trim().toLowerCase();
  const separator = normalized.lastIndexOf('@');
  if (separator < 1 || separator === normalized.length - 1) return 'recipient-unavailable';
  const local = normalized.slice(0, separator);
  const domain = normalized.slice(separator + 1);
  const prefix = local.slice(0, Math.min(2, local.length));
  return `${prefix}••••@${domain}`;
};

export const reviewInvitationPreflight = (
  input: Readonly<{
    capacity: InvitationCapacityAuthority;
    mode: 'individual' | 'csv';
    rows: readonly PreflightRowInput[];
  }>,
) => {
  if (
    input.capacity.activeLimit !== INVITATION_ACTIVE_LIMIT ||
    !isBoundedInteger(input.capacity.activeCount, 0, input.capacity.activeLimit) ||
    !isBoundedInteger(input.capacity.queuedCount, 0, Number.MAX_SAFE_INTEGER)
  ) {
    throw new Error('INVITATION_CAPACITY_INVALID');
  }
  const maximumRows = input.mode === 'individual' ? 1 : INVITATION_MAX_PREFLIGHT_ROWS;
  if (input.rows.length < 1 || input.rows.length > maximumRows) {
    throw new Error('INVITATION_PREFLIGHT_BOUNDS_INVALID');
  }
  const rowIds = new Set<string>();
  const counts = {
    active: 0,
    duplicate: 0,
    ineligible: 0,
    invalid: 0,
    valid: 0,
  };
  const rows = input.rows.map((row) => {
    if (
      row.rowId.trim().length < 1 ||
      row.rowId.length > 128 ||
      rowIds.has(row.rowId) ||
      !['valid', 'duplicate', 'active', 'invalid', 'ineligible'].includes(row.classification)
    ) {
      throw new Error('INVITATION_PREFLIGHT_ROW_INVALID');
    }
    rowIds.add(row.rowId);
    counts[row.classification] += 1;
    return Object.freeze({
      classification: row.classification,
      recipientMasked: maskInvitationRecipient(row.recipient),
      rowId: row.rowId,
    });
  });
  const availableSlots = input.capacity.activeLimit - input.capacity.activeCount;
  const willActivate = Math.min(counts.valid, availableSlots);
  const queued = counts.valid - willActivate;
  const skipped = counts.active + counts.duplicate + counts.ineligible + counts.invalid;
  return Object.freeze({
    canIssue: counts.valid > 0,
    capacity: Object.freeze({
      activeAfter: input.capacity.activeCount + willActivate,
      activeLimit: input.capacity.activeLimit,
      queuedAfter: input.capacity.queuedCount + queued,
    }),
    counts: Object.freeze({ ...counts, queued, skipped, willActivate }),
    mode: input.mode,
    rows: Object.freeze(rows),
  });
};

export const classifyInvitationActions = (
  input: Readonly<{
    invitation: InvitationRecordAuthority;
    invitationKind: InvitationKind;
    now: string;
  }>,
) => {
  if (input.invitationKind !== 'beta') {
    return Object.freeze({
      admitted: false as const,
      code: 'INVITATION_CAPABILITY_SEPARATE' as const,
    });
  }
  const now = instant(input.now, 'INVITATION_NOW_INVALID');
  const expiresAt =
    input.invitation.expiresAt === undefined
      ? null
      : instant(input.invitation.expiresAt, 'INVITATION_EXPIRY_INVALID');
  const active =
    input.invitation.lifecycleState === 'active' && expiresAt !== null && expiresAt > now;
  const queued = input.invitation.lifecycleState === 'queued';
  const deliveryStopped = input.invitation.deliveryState === 'permanent-bounce';
  return Object.freeze({
    admitted: true as const,
    canCorrectAddress: active || queued,
    canRemind:
      active && !deliveryStopped && input.invitation.reminderCount < INVITATION_MAX_REMINDERS,
    canResend: active && !deliveryStopped,
    canRevoke: active || queued,
    recipientImmutable: true,
  });
};

const mutationAuthorityFailure = (authority: InvitationAuthorityState) =>
  authority === 'live'
    ? null
    : Object.freeze({ admitted: false as const, code: 'AUTHORITATIVE_REFRESH_REQUIRED' as const });

export const reviewInvitationResend = (
  input: Readonly<{
    authority: InvitationAuthorityState;
    expiryMode: 'preserve' | 'restart';
    invitation: InvitationRecordAuthority;
    reason: string;
  }>,
) => {
  const authorityFailure = mutationAuthorityFailure(input.authority);
  if (authorityFailure !== null) return authorityFailure;
  if (
    input.invitation.lifecycleState !== 'active' ||
    input.invitation.deliveryState === 'permanent-bounce'
  ) {
    return Object.freeze({ admitted: false as const, code: 'RESEND_UNAVAILABLE' as const });
  }
  if (!reasonIsValid(input.reason)) {
    return Object.freeze({ admitted: false as const, code: 'REASON_REQUIRED' as const });
  }
  return Object.freeze({
    admitted: true as const,
    expiryDays: INVITATION_DEFAULT_EXPIRY_DAYS,
    expiryMode: input.expiryMode,
    expectedVersion: input.invitation.aggregateVersion,
    recipientImmutable: true,
    secretRotated: true,
  });
};

export const reviewInvitationRevoke = (
  input: Readonly<{
    authority: InvitationAuthorityState;
    invitation: InvitationRecordAuthority;
    reason: string;
  }>,
) => {
  const authorityFailure = mutationAuthorityFailure(input.authority);
  if (authorityFailure !== null) return authorityFailure;
  if (input.invitation.lifecycleState === 'accepted') {
    return Object.freeze({ admitted: false as const, code: 'ACCOUNT_AUTHORITY_SEPARATE' as const });
  }
  if (!['active', 'queued'].includes(input.invitation.lifecycleState)) {
    return Object.freeze({ admitted: false as const, code: 'REVOKE_UNAVAILABLE' as const });
  }
  if (!reasonIsValid(input.reason)) {
    return Object.freeze({ admitted: false as const, code: 'REASON_REQUIRED' as const });
  }
  return Object.freeze({
    accountUnaffected: true,
    admitted: true as const,
    expectedVersion: input.invitation.aggregateVersion,
    irreversible: true,
    secretStopsImmediately: true,
  });
};

export const reviewInvitationBatch = (
  input: Readonly<{
    action: 'resend' | 'revoke';
    approvalGranted: boolean;
    authority: InvitationAuthorityState;
    impactReviewed: boolean;
    reason: string;
    risk: 'standard' | 'high';
    targetCount: number;
  }>,
) => {
  const authorityFailure = mutationAuthorityFailure(input.authority);
  if (authorityFailure !== null) return authorityFailure;
  if (!isBoundedInteger(input.targetCount, 1, INVITATION_MAX_BATCH_TARGETS)) {
    return Object.freeze({ admitted: false as const, code: 'BATCH_BOUNDS_INVALID' as const });
  }
  if (!input.impactReviewed) {
    return Object.freeze({ admitted: false as const, code: 'IMPACT_REVIEW_REQUIRED' as const });
  }
  if (!reasonIsValid(input.reason)) {
    return Object.freeze({ admitted: false as const, code: 'REASON_REQUIRED' as const });
  }
  if (input.risk === 'high' && !input.approvalGranted) {
    return Object.freeze({ admitted: false as const, code: 'APPROVAL_REQUIRED' as const });
  }
  return Object.freeze({
    admitted: true as const,
    durableJobRequired: true,
    finalReceiptRequired: true,
    irreversible: input.action === 'revoke',
    partialFailureReportingRequired: true,
  });
};

const TIMELINE_KINDS = new Set([
  'created',
  'queued',
  'sent',
  'delivered',
  'delivery-failed',
  'resent',
  'reminded',
  'accepted',
  'expired',
  'declined',
  'revoked',
  'permanently-bounced',
  'suspicious-attempt',
]);

export const projectInvitationTimeline = (
  events: readonly Readonly<Record<string, unknown>>[],
): readonly Readonly<{ at: string; kind: string; outcome?: string }>[] =>
  Object.freeze(
    events.map((event) => {
      const kind = event['kind'];
      const at = event['at'];
      const outcome = event['outcome'];
      if (
        typeof kind !== 'string' ||
        !TIMELINE_KINDS.has(kind) ||
        typeof at !== 'string' ||
        Number.isNaN(Date.parse(at)) ||
        (outcome !== undefined &&
          (typeof outcome !== 'string' || outcome.length > 128 || outcome.includes('@')))
      ) {
        throw new Error('INVITATION_TIMELINE_INVALID');
      }
      return Object.freeze({
        at,
        kind,
        ...(outcome === undefined ? {} : { outcome }),
      });
    }),
  );

export const projectInvitationRetention = (
  input: Readonly<{
    afterRetention: 'delete-personal-data' | 'pseudonymize-personal-data';
    legalHoldUntil?: string;
    lifecycleState: AdminInvitationLifecycleStateJson;
    now: string;
    purposeRetentionUntil: string;
  }>,
) => {
  const now = instant(input.now, 'INVITATION_RETENTION_NOW_INVALID');
  if (input.lifecycleState === 'active' || input.lifecycleState === 'queued') {
    return Object.freeze({ action: 'retain' as const, basis: 'operational' as const });
  }
  if (
    input.legalHoldUntil !== undefined &&
    now < instant(input.legalHoldUntil, 'INVITATION_LEGAL_HOLD_INVALID')
  ) {
    return Object.freeze({ action: 'retain' as const, basis: 'legal-hold' as const });
  }
  if (now < instant(input.purposeRetentionUntil, 'INVITATION_RETENTION_INVALID')) {
    return Object.freeze({ action: 'retain' as const, basis: 'purpose' as const });
  }
  return Object.freeze({
    action: input.afterRetention,
    preserveMinimumAuditReceipt: true as const,
  });
};

export type InvitationDraft = Readonly<{
  expiryMode: 'preserve' | 'restart';
  reason: string;
}>;

export const reconcileInvitationDraft = (
  input: Readonly<{
    base: InvitationDraft;
    current: InvitationDraft;
    currentVersion: string;
    draft: InvitationDraft;
    expectedVersion: string;
  }>,
) => {
  if (input.currentVersion === input.expectedVersion) {
    return Object.freeze({ draft: input.draft, status: 'current' as const });
  }
  const fields = ['expiryMode', 'reason'] as const;
  const conflicting = fields.filter(
    (field) =>
      input.current[field] !== input.base[field] &&
      input.draft[field] !== input.base[field] &&
      input.current[field] !== input.draft[field],
  );
  if (conflicting.length > 0) {
    const preservedDraft = Object.fromEntries(
      conflicting.map((field) => [field, input.draft[field]]),
    ) as Partial<InvitationDraft>;
    return Object.freeze({
      base: input.base,
      current: input.current,
      currentVersion: input.currentVersion,
      expectedVersion: input.expectedVersion,
      preservedDraft: Object.freeze(preservedDraft),
      status: 'review' as const,
    });
  }
  const merged: InvitationDraft = Object.freeze({
    expiryMode:
      input.draft.expiryMode !== input.base.expiryMode
        ? input.draft.expiryMode
        : input.current.expiryMode,
    reason: input.draft.reason !== input.base.reason ? input.draft.reason : input.current.reason,
  });
  return Object.freeze({
    currentVersion: input.currentVersion,
    expectedVersion: input.expectedVersion,
    merged,
    status: 'merged' as const,
  });
};

export const projectInvitationJob = (
  job: Readonly<{
    completedItems: number;
    failedItems: number;
    jobId: string;
    progressPercent?: number;
    receiptReference?: string;
    state: 'queued' | 'running' | 'paused' | 'completed' | 'partial' | 'failed' | 'cancelled';
    totalItems: number;
  }>,
) => {
  if (
    !isBoundedInteger(job.totalItems, 1, INVITATION_MAX_BATCH_TARGETS) ||
    !isBoundedInteger(job.completedItems, 0, job.totalItems) ||
    !isBoundedInteger(job.failedItems, 0, job.totalItems) ||
    job.completedItems + job.failedItems > job.totalItems ||
    (job.progressPercent !== undefined && !isBoundedInteger(job.progressPercent, 0, 100)) ||
    ((job.state === 'completed' || job.state === 'partial') && job.receiptReference === undefined)
  ) {
    throw new Error('INVITATION_JOB_INVALID');
  }
  return Object.freeze({
    completedItems: job.completedItems,
    failedItems: job.failedItems,
    jobId: job.jobId,
    ...(job.progressPercent === undefined ? {} : { progressPercent: job.progressPercent }),
    ...(job.receiptReference === undefined ? {} : { receiptReference: job.receiptReference }),
    retryEligibleFailures: job.state === 'partial' ? job.failedItems : 0,
    state: job.state,
    totalItems: job.totalItems,
  });
};
