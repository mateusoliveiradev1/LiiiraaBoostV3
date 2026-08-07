import type { AdminFreshnessStateJson } from '@liiiraa/contracts-ts';

const REASON_MINIMUM = 8;
const EXPORT_WINDOW_MS = 15 * 60 * 1_000;
const SAFE_SUPPORT_METADATA = new Set([
  'caseReference',
  'clientVersion',
  'deviceClass',
  'diagnosticCategory',
  'platform',
  'releaseChannel',
]);

const timestamp = (value: string, code: string): number => {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(code);
  return parsed;
};

const version = (value: string): bigint => {
  if (!/^(?:0|[1-9][0-9]{0,19})$/u.test(value)) throw new Error('AUTHORITY_VERSION_INVALID');
  return BigInt(value);
};

const uniqueBounded = (values: readonly string[], maximum: number): boolean =>
  values.length > 0 &&
  values.length <= maximum &&
  new Set(values).size === values.length &&
  values.every((value) => value.length > 0 && value.length <= 128);

export type RevenueAuthorityInput = Readonly<{
  amountMinor?: string;
  currency?: string;
  observedAt: string;
  providerState: 'available' | 'degraded' | 'unknown';
  reconciliationState: 'reconciled' | 'pending' | 'failed' | 'unknown';
  subscriptionState: 'paid' | 'past-due' | 'canceled' | 'unknown';
}>;

export const projectRevenueAuthority = (input: RevenueAuthorityInput) => {
  timestamp(input.observedAt, 'REVENUE_OBSERVED_AT_INVALID');
  const hasAmount = input.amountMinor !== undefined || input.currency !== undefined;
  if (
    hasAmount &&
    (input.amountMinor === undefined ||
      input.currency === undefined ||
      !/^(?:0|[1-9][0-9]{0,18})$/u.test(input.amountMinor) ||
      !/^[A-Z]{3}$/u.test(input.currency))
  ) {
    throw new Error('REVENUE_AMOUNT_INVALID');
  }
  return Object.freeze({
    amount:
      input.amountMinor === undefined || input.currency === undefined
        ? Object.freeze({ state: 'unknown' as const })
        : Object.freeze({
            currency: input.currency,
            minor: input.amountMinor,
            state: 'known' as const,
          }),
    observedAt: input.observedAt,
    paidState: input.subscriptionState,
    providerState: input.providerState,
    reconciliationState: input.reconciliationState,
  });
};

export type SupportConsentAuthority = Readonly<{
  consentId: string;
  expiresAt: string;
  scopes: readonly string[];
  state: 'active' | 'expired' | 'revoked' | 'absent';
  version: string;
}>;

export const projectSupportCaseAuthority = (
  input: Readonly<{
    caseId: string;
    consent?: SupportConsentAuthority;
    deadlineAt: string;
    metadata: Readonly<Record<string, unknown>>;
    now: string;
    ownerReference?: string;
    state: string;
    subjectRedacted: string;
    substituteReference?: string;
  }>,
) => {
  const current = timestamp(input.now, 'SUPPORT_NOW_INVALID');
  const deadline = timestamp(input.deadlineAt, 'SUPPORT_DEADLINE_INVALID');
  if (input.caseId.length < 1 || input.caseId.length > 128 || input.subjectRedacted.length > 512) {
    throw new Error('SUPPORT_CASE_INVALID');
  }
  const metadata = Object.freeze(
    Object.fromEntries(
      Object.entries(input.metadata).filter(
        ([key, value]) =>
          SAFE_SUPPORT_METADATA.has(key) && typeof value === 'string' && value.length <= 256,
      ),
    ) as Readonly<Record<string, string>>,
  );
  const consent = input.consent;
  const activeConsent =
    consent?.state === 'active' &&
    timestamp(consent.expiresAt, 'SUPPORT_CONSENT_EXPIRY_INVALID') > current;
  if (consent !== undefined) {
    version(consent.version);
    if (!uniqueBounded(consent.scopes, 3)) throw new Error('SUPPORT_CONSENT_SCOPE_INVALID');
  }
  return Object.freeze({
    caseId: input.caseId,
    consent:
      consent === undefined
        ? Object.freeze({ active: false, state: 'absent' as const })
        : Object.freeze({
            active: activeConsent,
            consentId: consent.consentId,
            expiresAt: consent.expiresAt,
            scopes: Object.freeze([...consent.scopes]),
            state: activeConsent ? ('active' as const) : consent.state,
            version: consent.version,
          }),
    deadline: Object.freeze({
      at: input.deadlineAt,
      overdue: deadline <= current,
      remainingMinutes: Math.max(0, Math.ceil((deadline - current) / (60 * 1_000))),
    }),
    metadata,
    ...(input.ownerReference === undefined ? {} : { ownerReference: input.ownerReference }),
    state: input.state,
    subjectRedacted: input.subjectRedacted,
    ...(input.substituteReference === undefined
      ? {}
      : { substituteReference: input.substituteReference }),
  });
};

export type DiagnosticAuthorityState =
  | Readonly<{ fields: Readonly<Record<string, string>>; state: 'empty' }>
  | Readonly<{
      consentId: string;
      expiresAt: string;
      fields: Readonly<Record<string, string>>;
      state: 'active';
      version: string;
    }>
  | Readonly<{
      abortRequired: true;
      auditReference?: string;
      consentId: string;
      fields: Readonly<Record<string, never>>;
      state: 'cleared';
      version: string;
    }>;

export type DiagnosticAuthorityEvent =
  | Readonly<{
      consentId: string;
      expiresAt: string;
      fields: Readonly<Record<string, unknown>>;
      now: string;
      type: 'projection';
      version: string;
    }>
  | Readonly<{
      auditReference?: string;
      consentId: string;
      type: 'expire' | 'revoke';
      version: string;
    }>;

const safeDiagnosticFields = (
  fields: Readonly<Record<string, unknown>>,
): Readonly<Record<string, string>> => {
  const entries = Object.entries(fields);
  if (
    entries.length > 32 ||
    entries.some(
      ([key, value]) =>
        /(?:email|password|secret|token|raw|payload)/iu.test(key) ||
        typeof value !== 'string' ||
        value.length > 512,
    )
  ) {
    throw new Error('DIAGNOSTIC_FIELDS_INVALID');
  }
  return Object.freeze(Object.fromEntries(entries) as Record<string, string>);
};

export const reduceDiagnosticAuthority = (
  current: DiagnosticAuthorityState,
  event: DiagnosticAuthorityEvent,
): DiagnosticAuthorityState => {
  const nextVersion = version(event.version);
  if (current.state === 'cleared' && current.consentId === event.consentId) {
    return current;
  }
  if (
    current.state === 'active' &&
    current.consentId === event.consentId &&
    nextVersion < version(current.version)
  ) {
    return current;
  }
  if (event.type !== 'projection') {
    return Object.freeze({
      abortRequired: true as const,
      ...(event.auditReference === undefined ? {} : { auditReference: event.auditReference }),
      consentId: event.consentId,
      fields: Object.freeze({}),
      state: 'cleared' as const,
      version: event.version,
    });
  }
  const expired =
    timestamp(event.expiresAt, 'DIAGNOSTIC_EXPIRY_INVALID') <=
    timestamp(event.now, 'DIAGNOSTIC_NOW_INVALID');
  if (expired) {
    return Object.freeze({
      abortRequired: true as const,
      consentId: event.consentId,
      fields: Object.freeze({}),
      state: 'cleared' as const,
      version: event.version,
    });
  }
  return Object.freeze({
    consentId: event.consentId,
    expiresAt: event.expiresAt,
    fields: safeDiagnosticFields(event.fields),
    state: 'active' as const,
    version: event.version,
  });
};

export const reviewSensitiveExport = (
  input: Readonly<{
    approved: boolean;
    authority: AdminFreshnessStateJson;
    encrypted: boolean;
    expiresAt: string;
    masked: boolean;
    minimumFields: readonly string[];
    now: string;
    previewed: boolean;
    purpose: string;
    requestedFields: readonly string[];
  }>,
) => {
  if (input.authority !== 'live') {
    return Object.freeze({
      admitted: false as const,
      code: 'AUTHORITATIVE_REFRESH_REQUIRED' as const,
    });
  }
  if (
    !uniqueBounded(input.minimumFields, 32) ||
    !uniqueBounded(input.requestedFields, 32) ||
    input.requestedFields.length !== input.minimumFields.length ||
    input.requestedFields.some((field) => !input.minimumFields.includes(field))
  ) {
    return Object.freeze({ admitted: false as const, code: 'EXPORT_SCOPE_NOT_MINIMAL' as const });
  }
  const reasonLength = input.purpose.trim().length;
  if (reasonLength < REASON_MINIMUM || reasonLength > 256) {
    return Object.freeze({ admitted: false as const, code: 'EXPORT_PURPOSE_REQUIRED' as const });
  }
  if (!input.previewed || !input.masked) {
    return Object.freeze({ admitted: false as const, code: 'EXPORT_PREVIEW_REQUIRED' as const });
  }
  if (!input.approved) {
    return Object.freeze({ admitted: false as const, code: 'EXPORT_APPROVAL_REQUIRED' as const });
  }
  if (!input.encrypted) {
    return Object.freeze({ admitted: false as const, code: 'EXPORT_ENCRYPTION_REQUIRED' as const });
  }
  const current = timestamp(input.now, 'EXPORT_NOW_INVALID');
  const expiry = timestamp(input.expiresAt, 'EXPORT_EXPIRY_INVALID');
  if (expiry <= current || expiry - current > EXPORT_WINDOW_MS) {
    return Object.freeze({ admitted: false as const, code: 'EXPORT_EXPIRY_INVALID' as const });
  }
  return Object.freeze({
    admitted: true as const,
    encrypted: true as const,
    fields: Object.freeze([...input.requestedFields]),
    maskedPreview: true as const,
    purpose: input.purpose.trim(),
    shortLived: true as const,
  });
};

export const projectAdaptiveAbuseState = (
  input: Readonly<{
    blocked: boolean;
    rateLimited: boolean;
    retryAt?: string;
    signals: readonly string[];
    stepUpRequired: boolean;
  }>,
) => {
  if (input.retryAt !== undefined) timestamp(input.retryAt, 'ADAPTIVE_RETRY_INVALID');
  return Object.freeze({
    action: input.blocked
      ? ('blocked' as const)
      : input.rateLimited
        ? ('throttled' as const)
        : ('allow' as const),
    ...(input.retryAt === undefined ? {} : { retryAt: input.retryAt }),
    safeCode:
      input.blocked || input.rateLimited
        ? ('ADAPTIVE_CONTROL_ACTIVE' as const)
        : ('AVAILABLE' as const),
    stepUpRequired: input.stepUpRequired,
  });
};

export type RevenueSupportDraft = Readonly<{ ownerReference: string; reason: string }>;

export const reconcileRevenueSupportDraft = (
  input: Readonly<{
    base: RevenueSupportDraft;
    current: RevenueSupportDraft;
    currentVersion: string;
    draft: RevenueSupportDraft;
    expectedVersion: string;
  }>,
) => {
  version(input.currentVersion);
  version(input.expectedVersion);
  if (input.currentVersion === input.expectedVersion) {
    return Object.freeze({ draft: input.draft, status: 'current' as const });
  }
  const fields = ['ownerReference', 'reason'] as const;
  const conflicts = fields.filter(
    (field) =>
      input.current[field] !== input.base[field] &&
      input.draft[field] !== input.base[field] &&
      input.current[field] !== input.draft[field],
  );
  if (conflicts.length > 0) {
    return Object.freeze({
      currentVersion: input.currentVersion,
      expectedVersion: input.expectedVersion,
      preservedDraft: Object.freeze(
        Object.fromEntries(
          conflicts.map((field) => [field, input.draft[field]]),
        ) as Partial<RevenueSupportDraft>,
      ),
      status: 'review' as const,
    });
  }
  return Object.freeze({
    currentVersion: input.currentVersion,
    expectedVersion: input.expectedVersion,
    merged: Object.freeze({
      ownerReference:
        input.draft.ownerReference !== input.base.ownerReference
          ? input.draft.ownerReference
          : input.current.ownerReference,
      reason: input.draft.reason !== input.base.reason ? input.draft.reason : input.current.reason,
    }),
    status: 'merged' as const,
  });
};
