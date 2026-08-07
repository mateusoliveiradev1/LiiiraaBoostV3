export type AdminJobStatus =
  'queued' | 'running' | 'paused' | 'completed' | 'partial' | 'failed' | 'cancelled';

export interface AdminJobState {
  readonly jobId: string;
  readonly kind: string;
  readonly status: AdminJobStatus;
  readonly version: bigint;
  readonly progress: number;
  readonly affectedItems: number;
  readonly idempotencyKey: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly receiptId?: string;
}

const instant = (value: string): number => {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error('admin operations require ISO date-time values');
  return parsed;
};

const nonEmpty = (value: string): boolean => value.trim().length > 0;
const terminalJob = (status: AdminJobStatus): boolean =>
  status === 'completed' || status === 'cancelled';

export type AdminJobDecision =
  | Readonly<{ accepted: true; state: AdminJobState; idempotent?: true }>
  | Readonly<{
      accepted: false;
      code:
        | 'JOB_STATE_INVALID'
        | 'JOB_PROGRESS_INVALID'
        | 'CANCELLATION_UNSAFE'
        | 'RECEIPT_REQUIRED'
        | 'IDEMPOTENCY_MISMATCH';
    }>;

export const decideAdminJobTransition = (
  input: Readonly<{
    state: AdminJobState;
    command: 'start' | 'pause' | 'resume' | 'complete' | 'partial' | 'fail' | 'cancel' | 'retry';
    now: string;
    progress?: number;
    receiptId?: string;
    safeCancellation?: boolean;
    idempotencyKey?: string;
  }>,
): AdminJobDecision => {
  instant(input.now);
  if (input.idempotencyKey !== undefined && input.idempotencyKey !== input.state.idempotencyKey) {
    return { accepted: false, code: 'IDEMPOTENCY_MISMATCH' };
  }
  if (terminalJob(input.state.status)) {
    if (input.state.status === 'completed' && input.command === 'complete') {
      return { accepted: true, state: input.state, idempotent: true };
    }
    return { accepted: false, code: 'JOB_STATE_INVALID' };
  }
  let status: AdminJobStatus;
  if (input.command === 'start' && input.state.status === 'queued') status = 'running';
  else if (input.command === 'pause' && input.state.status === 'running') status = 'paused';
  else if (input.command === 'resume' && input.state.status === 'paused') status = 'running';
  else if (
    input.command === 'retry' &&
    (input.state.status === 'failed' || input.state.status === 'partial')
  )
    status = 'queued';
  else if (input.command === 'cancel') {
    if (!input.safeCancellation) return { accepted: false, code: 'CANCELLATION_UNSAFE' };
    status = 'cancelled';
  } else if (input.command === 'complete' && input.state.status === 'running') status = 'completed';
  else if (input.command === 'partial' && input.state.status === 'running') status = 'partial';
  else if (input.command === 'fail' && input.state.status === 'running') status = 'failed';
  else return { accepted: false, code: 'JOB_STATE_INVALID' };

  const progress = input.command === 'retry' ? 0 : (input.progress ?? input.state.progress);
  if (!Number.isSafeInteger(progress) || progress < 0 || progress > 100) {
    return { accepted: false, code: 'JOB_PROGRESS_INVALID' };
  }
  if (status === 'completed' && (progress !== 100 || !nonEmpty(input.receiptId ?? ''))) {
    return { accepted: false, code: 'RECEIPT_REQUIRED' };
  }
  return {
    accepted: true,
    ...(input.command === 'retry' ? { idempotent: true as const } : {}),
    state: {
      ...input.state,
      status,
      version: input.state.version + 1n,
      progress,
      updatedAt: input.now,
      ...(input.receiptId === undefined ? {} : { receiptId: input.receiptId }),
    },
  };
};

export const decideOperationalFreshness = (
  input: Readonly<{
    connection: 'connected' | 'reconnecting' | 'disconnected' | 'degraded';
    lastUpdatedAt: string;
    now: string;
    maximumAgeMs: number;
    action: 'read' | 'mutation' | 'critical-mutation';
  }>,
):
  | Readonly<{ allowed: true; freshness: 'current' | 'stale'; manualRefreshRequired: boolean }>
  | Readonly<{ allowed: false; code: 'AUTHORITY_UNCERTAIN'; secretlyQueued: false }> => {
  const age = instant(input.now) - instant(input.lastUpdatedAt);
  const current = input.connection === 'connected' && age >= 0 && age <= input.maximumAgeMs;
  if (input.action !== 'read' && !current) {
    return { allowed: false, code: 'AUTHORITY_UNCERTAIN', secretlyQueued: false };
  }
  return {
    allowed: true,
    freshness: current ? 'current' : 'stale',
    manualRefreshRequired: !current,
  };
};

type ConflictRecord = Readonly<Record<string, unknown>>;
export const resolveAdminVersionConflict = (
  input: Readonly<{
    expectedVersion: bigint;
    actualVersion: bigint;
    base: ConflictRecord;
    local: ConflictRecord;
    remote: ConflictRecord;
  }>,
):
  | Readonly<{ resolved: true; merged: ConflictRecord }>
  | Readonly<{
      resolved: false;
      code: 'CONFLICT_REVIEW_REQUIRED';
      localDraft: ConflictRecord;
      remote: ConflictRecord;
      conflictingFields: readonly string[];
    }> => {
  if (input.expectedVersion === input.actualVersion) return { resolved: true, merged: input.local };
  const keys = new Set([
    ...Object.keys(input.base),
    ...Object.keys(input.local),
    ...Object.keys(input.remote),
  ]);
  const merged: Record<string, unknown> = { ...input.remote };
  const conflictingFields: string[] = [];
  for (const key of keys) {
    const localChanged = !Object.is(input.local[key], input.base[key]);
    const remoteChanged = !Object.is(input.remote[key], input.base[key]);
    if (localChanged && remoteChanged && !Object.is(input.local[key], input.remote[key])) {
      conflictingFields.push(key);
    } else if (localChanged) merged[key] = input.local[key];
  }
  return conflictingFields.length === 0
    ? { resolved: true, merged }
    : {
        resolved: false,
        code: 'CONFLICT_REVIEW_REQUIRED',
        localDraft: input.local,
        remote: input.remote,
        conflictingFields,
      };
};

const secretPattern = /(?:secret|password|token|private.?key)\s*[:=]/iu;
export const validateAdminOperationalAudit = (
  input: Readonly<{
    actorId: string;
    activeFunction: string;
    scope: string;
    reason: string;
    approvals: readonly string[];
    before: string;
    after: string;
    origin: string;
    correlationId: string;
    outcome: string;
    correctionOf?: string;
  }>,
):
  | Readonly<{ valid: true; appendOnlyRequired: true; correctionMustLink: true }>
  | Readonly<{ valid: false; code: 'AUDIT_FIELDS_REQUIRED' | 'AUDIT_SECRET_FORBIDDEN' }> => {
  const required = [
    input.actorId,
    input.activeFunction,
    input.scope,
    input.reason,
    input.before,
    input.after,
    input.origin,
    input.correlationId,
    input.outcome,
  ];
  if (required.some((value) => !nonEmpty(value)))
    return { valid: false, code: 'AUDIT_FIELDS_REQUIRED' };
  if (secretPattern.test(`${input.before}\n${input.after}`)) {
    return { valid: false, code: 'AUDIT_SECRET_FORBIDDEN' };
  }
  return { valid: true, appendOnlyRequired: true, correctionMustLink: true };
};

export const decideAdminAbuseControl = (
  input: Readonly<{
    riskScore: number;
    stepUpSatisfied: boolean;
    override: boolean;
  }>,
): Readonly<{
  action: 'allow' | 'slow' | 'require-step-up' | 'temporary-block';
  securityAlertRequired: boolean;
  auditRequired: true;
}> => {
  const action =
    input.override || input.riskScore < 30
      ? 'allow'
      : input.riskScore < 50
        ? 'slow'
        : input.riskScore < 80
          ? input.stepUpSatisfied
            ? 'allow'
            : 'require-step-up'
          : 'temporary-block';
  return { action, securityAlertRequired: action === 'temporary-block', auditRequired: true };
};

export const decideIncidentRecovery = (
  input: Readonly<{
    incidentId: string;
    severity: string;
    ownerId: string;
    procedureVersion: string;
    boundedOperation: boolean;
    previewed: boolean;
    rehearsed: boolean;
    riskApproved: boolean;
    idempotencyKey: string;
    validationDefined: boolean;
    compensationDefined: boolean;
  }>,
):
  | Readonly<{
      allowed: true;
      incidentWorkspaceRequired: true;
      validationRequired: true;
      compensationRequired: true;
    }>
  | Readonly<{ allowed: false; code: string }> => {
  if (!input.boundedOperation) return { allowed: false, code: 'FREE_FORM_RECOVERY_FORBIDDEN' };
  if (
    ![
      input.incidentId,
      input.severity,
      input.ownerId,
      input.procedureVersion,
      input.idempotencyKey,
    ].every(nonEmpty)
  )
    return { allowed: false, code: 'INCIDENT_CONTEXT_REQUIRED' };
  if (!input.previewed) return { allowed: false, code: 'RECOVERY_PREVIEW_REQUIRED' };
  if (!input.riskApproved) return { allowed: false, code: 'RECOVERY_APPROVAL_REQUIRED' };
  if (!input.validationDefined || !input.compensationDefined)
    return { allowed: false, code: 'RECOVERY_SAFETY_REQUIRED' };
  return {
    allowed: true,
    incidentWorkspaceRequired: true,
    validationRequired: true,
    compensationRequired: true,
  };
};

export const authorizeSensitiveExport = (
  input: Readonly<{
    purpose: string;
    fields: readonly string[];
    minimumFields: readonly string[];
    previewed: boolean;
    masked: boolean;
    approved: boolean;
    encrypted: boolean;
    expiresAt: string;
    now: string;
  }>,
):
  | Readonly<{
      allowed: true;
      auditRequired: true;
      downloadAuditRequired: true;
      expiryAuditRequired: true;
    }>
  | Readonly<{ allowed: false; code: string }> => {
  if (!nonEmpty(input.purpose)) return { allowed: false, code: 'EXPORT_PURPOSE_REQUIRED' };
  if (
    input.fields.length === 0 ||
    input.fields.some((field) => !input.minimumFields.includes(field))
  )
    return { allowed: false, code: 'EXPORT_SCOPE_EXCESSIVE' };
  if (!input.previewed) return { allowed: false, code: 'EXPORT_PREVIEW_REQUIRED' };
  if (!input.masked) return { allowed: false, code: 'EXPORT_MASKING_REQUIRED' };
  if (!input.approved) return { allowed: false, code: 'EXPORT_APPROVAL_REQUIRED' };
  if (!input.encrypted) return { allowed: false, code: 'EXPORT_ENCRYPTION_REQUIRED' };
  const lifetime = instant(input.expiresAt) - instant(input.now);
  if (lifetime <= 0 || lifetime > 60 * 60 * 1_000)
    return { allowed: false, code: 'EXPORT_EXPIRY_INVALID' };
  return {
    allowed: true,
    auditRequired: true,
    downloadAuditRequired: true,
    expiryAuditRequired: true,
  };
};

export interface AdminConfigurationState {
  readonly configurationId: string;
  readonly version: bigint;
  readonly status: 'draft' | 'rolling-out' | 'paused' | 'published' | 'rolled-back';
  readonly environment: string;
  readonly cohort: string;
  readonly knownVersion: string;
  readonly updatedAt?: string;
}

export const decideAdminConfigurationTransition = (
  input: Readonly<{
    state: AdminConfigurationState;
    command: 'publish' | 'pause' | 'resume' | 'complete' | 'rollback';
    validated?: boolean;
    impactReviewed?: boolean;
    approved?: boolean;
    rollbackVersion?: string;
    now: string;
  }>,
):
  | Readonly<{ accepted: true; state: AdminConfigurationState }>
  | Readonly<{ accepted: false; code: string }> => {
  instant(input.now);
  if (input.command === 'publish') {
    if (input.state.status !== 'draft')
      return { accepted: false, code: 'CONFIGURATION_STATE_INVALID' };
    if (!input.validated) return { accepted: false, code: 'VALIDATION_REQUIRED' };
    if (!input.impactReviewed) return { accepted: false, code: 'IMPACT_REVIEW_REQUIRED' };
    if (!input.approved) return { accepted: false, code: 'APPROVAL_REQUIRED' };
    return {
      accepted: true,
      state: {
        ...input.state,
        status: 'rolling-out',
        version: input.state.version + 1n,
        updatedAt: input.now,
      },
    };
  }
  if (input.command === 'pause' && input.state.status === 'rolling-out')
    return {
      accepted: true,
      state: {
        ...input.state,
        status: 'paused',
        version: input.state.version + 1n,
        updatedAt: input.now,
      },
    };
  if (input.command === 'resume' && input.state.status === 'paused')
    return {
      accepted: true,
      state: {
        ...input.state,
        status: 'rolling-out',
        version: input.state.version + 1n,
        updatedAt: input.now,
      },
    };
  if (input.command === 'complete' && input.state.status === 'rolling-out')
    return {
      accepted: true,
      state: {
        ...input.state,
        status: 'published',
        version: input.state.version + 1n,
        updatedAt: input.now,
      },
    };
  const rollbackVersion = input.rollbackVersion;
  if (
    input.command === 'rollback' &&
    (input.state.status === 'rolling-out' ||
      input.state.status === 'paused' ||
      input.state.status === 'published') &&
    rollbackVersion !== undefined &&
    nonEmpty(rollbackVersion)
  )
    return {
      accepted: true,
      state: {
        ...input.state,
        status: 'rolled-back',
        knownVersion: rollbackVersion,
        version: input.state.version + 1n,
        updatedAt: input.now,
      },
    };
  return { accepted: false, code: 'CONFIGURATION_STATE_INVALID' };
};

export type AdminCapacityResource =
  'invitations' | 'jobs' | 'email' | 'database' | 'storage' | 'provider';
export const evaluateAdminCapacity = (
  input: Readonly<{
    resource: AdminCapacityResource;
    currentUse: number;
    safeLimit: number;
    growthPerDay: number;
    warningWindowDays: number;
  }>,
): Readonly<{
  level: 'healthy' | 'warning' | 'exhausted';
  forecastExhaustionDays: number | null;
  earlyActionRequired: boolean;
}> => {
  const remaining = input.safeLimit - input.currentUse;
  const forecast =
    input.growthPerDay > 0 ? Math.max(0, Math.ceil(remaining / input.growthPerDay)) : null;
  const level =
    remaining <= 0
      ? 'exhausted'
      : forecast !== null && forecast <= input.warningWindowDays
        ? 'warning'
        : 'healthy';
  return { level, forecastExhaustionDays: forecast, earlyActionRequired: level !== 'healthy' };
};

export type AdminEnvironment = 'development' | 'staging' | 'production';
export const authorizeAdminEnvironment = (
  input: Readonly<{
    sessionEnvironment: AdminEnvironment;
    targetEnvironment: AdminEnvironment;
    productionStrongAccess: boolean;
    integrationEnvironment: AdminEnvironment;
  }>,
):
  | Readonly<{ allowed: true; visualIdentityRequired: true }>
  | Readonly<{ allowed: false; code: string }> => {
  if (
    input.sessionEnvironment !== input.targetEnvironment ||
    input.integrationEnvironment !== input.targetEnvironment
  )
    return { allowed: false, code: 'ENVIRONMENT_CROSSING_FORBIDDEN' };
  if (input.targetEnvironment === 'production' && !input.productionStrongAccess)
    return { allowed: false, code: 'PRODUCTION_STRONG_ACCESS_REQUIRED' };
  return { allowed: true, visualIdentityRequired: true };
};

export const decideOperationalOwnership = (
  input: Readonly<{
    priority: 'normal' | 'urgent' | 'critical';
    ownerId: string;
    substituteId: string;
    ownerAvailable: boolean;
    deadline: string;
    now: string;
    externalChannelVerified: boolean;
    acknowledged: boolean;
    containsSensitivePayload: boolean;
  }>,
): Readonly<{
  action: 'retain-owner' | 'transfer-to-substitute' | 'escalate-to-substitute';
  externalAlertRequired: boolean;
  acknowledgementRequired: boolean;
}> => {
  instant(input.deadline);
  instant(input.now);
  const critical = input.priority === 'critical';
  const mustTransfer = !input.ownerAvailable;
  const overdue = instant(input.now) >= instant(input.deadline);
  const externalAlertRequired =
    critical && input.externalChannelVerified && !input.containsSensitivePayload;
  const action =
    mustTransfer && (critical || overdue)
      ? 'escalate-to-substitute'
      : mustTransfer
        ? 'transfer-to-substitute'
        : 'retain-owner';
  return {
    action,
    externalAlertRequired,
    acknowledgementRequired: critical && !input.acknowledged,
  };
};

export const decidePrivacyCase = (
  input: Readonly<{
    identityVerified: boolean;
    legalBasis: string;
    dataDiscovered: boolean;
    mandatoryRetentionReviewed: boolean;
    impactReviewed: boolean;
    approved: boolean;
    executionDefined: boolean;
    finalReceiptRequired: boolean;
  }>,
):
  | Readonly<{ allowed: true; finalReceiptRequired: true }>
  | Readonly<{ allowed: false; code: string }> => {
  if (!input.identityVerified) return { allowed: false, code: 'PRIVACY_IDENTITY_REQUIRED' };
  if (!nonEmpty(input.legalBasis)) return { allowed: false, code: 'PRIVACY_LEGAL_BASIS_REQUIRED' };
  if (!input.dataDiscovered || !input.mandatoryRetentionReviewed)
    return { allowed: false, code: 'PRIVACY_DISCOVERY_REQUIRED' };
  if (!input.impactReviewed || !input.approved)
    return { allowed: false, code: 'PRIVACY_APPROVAL_REQUIRED' };
  if (!input.executionDefined || !input.finalReceiptRequired)
    return { allowed: false, code: 'PRIVACY_EXECUTION_REQUIRED' };
  return { allowed: true, finalReceiptRequired: true };
};

export const decideEmergencyCapabilityStop = (
  input: Readonly<{
    capability: string;
    strongAuth: boolean;
    reason: string;
    requestedAt: string;
    expiresAt: string;
    safeRestorationDefined: boolean;
  }>,
):
  | Readonly<{
      allowed: true;
      pausedCapability: string;
      globalStop: false;
      promptReviewRequired: true;
    }>
  | Readonly<{ allowed: false; code: string }> => {
  if (input.capability === '*' || !nonEmpty(input.capability))
    return { allowed: false, code: 'GLOBAL_STOP_FORBIDDEN' };
  if (!input.strongAuth) return { allowed: false, code: 'EMERGENCY_STRONG_AUTH_REQUIRED' };
  if (!nonEmpty(input.reason)) return { allowed: false, code: 'EMERGENCY_REASON_REQUIRED' };
  const lifetime = instant(input.expiresAt) - instant(input.requestedAt);
  if (lifetime <= 0 || lifetime > 30 * 60 * 1_000)
    return { allowed: false, code: 'EMERGENCY_WINDOW_INVALID' };
  if (!input.safeRestorationDefined) return { allowed: false, code: 'SAFE_RESTORATION_REQUIRED' };
  return {
    allowed: true,
    pausedCapability: input.capability,
    globalStop: false,
    promptReviewRequired: true,
  };
};
