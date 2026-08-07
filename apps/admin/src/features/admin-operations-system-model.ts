import type { AdminFreshnessStateJson, AdminJobStateJson } from '@liiiraa/contracts-ts';

const REASON_MINIMUM = 8;
const EMERGENCY_WINDOW_MS = 60 * 60 * 1_000;

const timestamp = (value: string, code: string): number => {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(code);
  return parsed;
};

const version = (value: string): bigint => {
  if (!/^(?:0|[1-9][0-9]{0,19})$/u.test(value)) throw new Error('AUTHORITY_VERSION_INVALID');
  return BigInt(value);
};

const boundedReference = (value: string): boolean => value.length > 0 && value.length <= 128;

const JOB_TRANSITIONS = Object.freeze({
  cancelled: Object.freeze([]),
  completed: Object.freeze([]),
  failed: Object.freeze(['retry', 'cancel']),
  partial: Object.freeze(['retry', 'cancel']),
  paused: Object.freeze(['resume', 'cancel']),
  queued: Object.freeze(['start', 'cancel']),
  running: Object.freeze(['pause', 'complete', 'partial', 'fail', 'cancel']),
} as const satisfies Readonly<Record<AdminJobStateJson, readonly string[]>>);

export const projectOperationalJob = (
  input: Readonly<{
    completedItems: number;
    failedItems: number;
    freshness: AdminFreshnessStateJson;
    progressPercent: number;
    receiptReference?: string;
    state: AdminJobStateJson;
    totalItems: number;
  }>,
) => {
  const counts = [input.completedItems, input.failedItems, input.totalItems];
  if (
    counts.some((value) => !Number.isSafeInteger(value) || value < 0) ||
    input.completedItems + input.failedItems > input.totalItems ||
    !Number.isFinite(input.progressPercent) ||
    input.progressPercent < 0 ||
    input.progressPercent > 100 ||
    (input.receiptReference !== undefined && !boundedReference(input.receiptReference))
  ) {
    throw new Error('JOB_PROJECTION_INVALID');
  }
  const base = {
    completedItems: input.completedItems,
    failedItems: input.failedItems,
    nextTransitions: Object.freeze([...JOB_TRANSITIONS[input.state]]),
    pendingItems: input.totalItems - input.completedItems - input.failedItems,
    progressPercent: input.progressPercent,
    ...(input.receiptReference === undefined ? {} : { receiptReference: input.receiptReference }),
    state: input.state,
  };
  return input.freshness === 'live'
    ? Object.freeze(base)
    : Object.freeze({
        ...base,
        mutationsAllowed: false as const,
        nextTransitions: Object.freeze([]),
        safeCode: 'AUTHORITATIVE_REFRESH_REQUIRED' as const,
        secretlyQueued: false as const,
      });
};

export type IncidentRecoveryReviewInput = Readonly<{
  allowedProcedureVersions: readonly string[];
  approved: boolean;
  boundedOperation: boolean;
  compensationDefined: boolean;
  ownerAvailable: boolean;
  ownerReference: string;
  previewed: boolean;
  procedureVersion: string;
  rehearsed: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  substituteReference: string;
  validationDefined: boolean;
}> &
  Readonly<Record<string, unknown>>;

export const reviewIncidentRecovery = (input: IncidentRecoveryReviewInput) => {
  const forbidden = Object.keys(input).some((key) =>
    /(?:script|powershell|commandText|registryOperation|serviceOperation)/iu.test(key),
  );
  if (forbidden) {
    return Object.freeze({
      admitted: false as const,
      code: 'ARBITRARY_EXECUTION_FORBIDDEN' as const,
    });
  }
  if (!input.allowedProcedureVersions.includes(input.procedureVersion)) {
    return Object.freeze({ admitted: false as const, code: 'PROCEDURE_NOT_ALLOWLISTED' as const });
  }
  if (!input.boundedOperation || !input.previewed) {
    return Object.freeze({ admitted: false as const, code: 'RECOVERY_PREVIEW_REQUIRED' as const });
  }
  if (!input.rehearsed || !input.approved) {
    return Object.freeze({ admitted: false as const, code: 'RECOVERY_APPROVAL_REQUIRED' as const });
  }
  if (!input.validationDefined || !input.compensationDefined) {
    return Object.freeze({
      admitted: false as const,
      code: 'RECOVERY_SAFETY_PATH_REQUIRED' as const,
    });
  }
  if (!boundedReference(input.ownerReference) || !boundedReference(input.substituteReference)) {
    throw new Error('RECOVERY_OWNER_INVALID');
  }
  return Object.freeze({
    admitted: true as const,
    compensationRequired: true as const,
    executionOwner: input.ownerAvailable ? input.ownerReference : input.substituteReference,
    procedureVersion: input.procedureVersion,
    validationRequired: true as const,
  });
};

export const reviewConfigurationTransition = (
  input: Readonly<{
    approved: boolean;
    authority: AdminFreshnessStateJson;
    impactReviewed: boolean;
    integrationEnvironment: 'development' | 'staging' | 'production';
    knownVersion: string;
    rollbackVersion?: string;
    sessionEnvironment: 'development' | 'staging' | 'production';
    strongAccess: boolean;
    targetEnvironment: 'development' | 'staging' | 'production';
    transition: 'publish' | 'pause' | 'resume' | 'complete' | 'rollback';
    validated: boolean;
  }>,
) => {
  if (input.authority !== 'live') {
    return Object.freeze({
      admitted: false as const,
      code: 'AUTHORITATIVE_REFRESH_REQUIRED' as const,
    });
  }
  if (
    input.sessionEnvironment !== input.targetEnvironment ||
    input.integrationEnvironment !== input.targetEnvironment
  ) {
    return Object.freeze({
      admitted: false as const,
      code: 'ENVIRONMENT_CROSSING_FORBIDDEN' as const,
    });
  }
  if (input.targetEnvironment === 'production' && !input.strongAccess) {
    return Object.freeze({
      admitted: false as const,
      code: 'PRODUCTION_STRONG_ACCESS_REQUIRED' as const,
    });
  }
  if (input.rollbackVersion === undefined || input.rollbackVersion.trim().length === 0) {
    return Object.freeze({ admitted: false as const, code: 'ROLLBACK_PATH_REQUIRED' as const });
  }
  if (!input.validated || !input.impactReviewed) {
    return Object.freeze({
      admitted: false as const,
      code: 'CONFIGURATION_REVIEW_REQUIRED' as const,
    });
  }
  if (!input.approved) {
    return Object.freeze({
      admitted: false as const,
      code: 'CONFIGURATION_APPROVAL_REQUIRED' as const,
    });
  }
  if (input.knownVersion.length > 64 || input.rollbackVersion.length > 64) {
    throw new Error('CONFIGURATION_VERSION_INVALID');
  }
  return Object.freeze({
    admitted: true as const,
    knownVersion: input.knownVersion,
    rollbackVersion: input.rollbackVersion,
    transition: input.transition,
  });
};

export const projectCapacityAuthority = (
  input: Readonly<{
    currentUse: number;
    forecastExhaustionAt?: string;
    growthPerDay?: number;
    observedAt: string;
    safeLimit: number;
  }>,
) => {
  timestamp(input.observedAt, 'CAPACITY_OBSERVED_AT_INVALID');
  if (
    !Number.isFinite(input.currentUse) ||
    input.currentUse < 0 ||
    !Number.isFinite(input.safeLimit) ||
    input.safeLimit <= 0
  ) {
    throw new Error('CAPACITY_VALUE_INVALID');
  }
  const utilizationPercent = Math.round((input.currentUse / input.safeLimit) * 100);
  const remaining = Math.max(0, input.safeLimit - input.currentUse);
  if (input.growthPerDay === undefined || input.forecastExhaustionAt === undefined) {
    return Object.freeze({
      currentUse: input.currentUse,
      forecastState: 'unknown' as const,
      observedAt: input.observedAt,
      recommendedAction: 'measure-growth' as const,
      remaining,
      safeLimit: input.safeLimit,
      state: 'uncertain' as const,
      utilizationPercent,
    });
  }
  if (!Number.isFinite(input.growthPerDay) || input.growthPerDay < 0) {
    throw new Error('CAPACITY_GROWTH_INVALID');
  }
  timestamp(input.forecastExhaustionAt, 'CAPACITY_FORECAST_INVALID');
  const state =
    utilizationPercent >= 100 ? 'critical' : utilizationPercent >= 80 ? 'warning' : 'stable';
  return Object.freeze({
    currentUse: input.currentUse,
    forecastExhaustionAt: input.forecastExhaustionAt,
    growthPerDay: input.growthPerDay,
    observedAt: input.observedAt,
    recommendedAction: state === 'stable' ? ('none' as const) : ('review-capacity' as const),
    remaining,
    safeLimit: input.safeLimit,
    state,
    utilizationPercent,
  });
};

export const reviewPrivacyCaseExecution = (
  input: Readonly<{
    approved: boolean;
    dataDiscovered: boolean;
    executionDefined: boolean;
    finalReceiptRequired: boolean;
    identityVerified: boolean;
    impactReviewed: boolean;
    legalBasis: string;
    mandatoryRetentionReviewed: boolean;
  }>,
) => {
  if (!input.identityVerified) {
    return Object.freeze({
      admitted: false as const,
      code: 'IDENTITY_VERIFICATION_REQUIRED' as const,
    });
  }
  if (input.legalBasis.trim().length < REASON_MINIMUM || input.legalBasis.length > 256) {
    return Object.freeze({ admitted: false as const, code: 'LEGAL_BASIS_REQUIRED' as const });
  }
  if (!input.dataDiscovered) {
    return Object.freeze({ admitted: false as const, code: 'DATA_DISCOVERY_REQUIRED' as const });
  }
  if (!input.mandatoryRetentionReviewed) {
    return Object.freeze({ admitted: false as const, code: 'RETENTION_REVIEW_REQUIRED' as const });
  }
  if (!input.impactReviewed || !input.approved) {
    return Object.freeze({ admitted: false as const, code: 'PRIVACY_APPROVAL_REQUIRED' as const });
  }
  if (!input.executionDefined || !input.finalReceiptRequired) {
    return Object.freeze({
      admitted: false as const,
      code: 'PRIVACY_EXECUTION_PATH_REQUIRED' as const,
    });
  }
  return Object.freeze({
    admitted: true as const,
    finalReceiptRequired: true as const,
    legalBasis: input.legalBasis.trim(),
    nextState: 'executing' as const,
  });
};

export const reviewEmergencyCapabilityStop = (
  input: Readonly<{
    allowedCapabilities: readonly string[];
    capability: string;
    expiresAt: string;
    now: string;
    reason: string;
    safeRestorationDefined: boolean;
    strongAuth: boolean;
  }>,
) => {
  if (!input.allowedCapabilities.includes(input.capability) || input.capability === '*') {
    return Object.freeze({ admitted: false as const, code: 'CAPABILITY_NOT_ALLOWLISTED' as const });
  }
  if (!input.strongAuth) {
    return Object.freeze({ admitted: false as const, code: 'STRONG_AUTH_REQUIRED' as const });
  }
  if (input.reason.trim().length < REASON_MINIMUM || input.reason.length > 512) {
    return Object.freeze({ admitted: false as const, code: 'EMERGENCY_REASON_REQUIRED' as const });
  }
  if (!input.safeRestorationDefined) {
    return Object.freeze({ admitted: false as const, code: 'SAFE_RESTORATION_REQUIRED' as const });
  }
  const current = timestamp(input.now, 'EMERGENCY_NOW_INVALID');
  const expiry = timestamp(input.expiresAt, 'EMERGENCY_EXPIRY_INVALID');
  if (expiry <= current || expiry - current > EMERGENCY_WINDOW_MS) {
    return Object.freeze({ admitted: false as const, code: 'EMERGENCY_EXPIRY_INVALID' as const });
  }
  return Object.freeze({
    admitted: true as const,
    capability: input.capability,
    expiresAt: input.expiresAt,
    globalStop: false as const,
    restorationRequired: true as const,
  });
};

export type OperationalDraft = Readonly<{ ownerReference: string; reason: string }>;

export const reconcileOperationalDraft = (
  input: Readonly<{
    base: OperationalDraft;
    current: OperationalDraft;
    currentVersion: string;
    draft: OperationalDraft;
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
        ) as Partial<OperationalDraft>,
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
