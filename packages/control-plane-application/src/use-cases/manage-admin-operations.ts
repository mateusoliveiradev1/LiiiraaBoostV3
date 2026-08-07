import {
  authorizeAdminEnvironment,
  authorizeSensitiveExport,
  decideAdminConfigurationTransition,
  decideEmergencyCapabilityStop,
  decideIncidentRecovery,
  decideAdminJobTransition,
  decideOperationalOwnership,
  decidePrivacyCase,
  decideOperationalFreshness,
  resolveAdminVersionConflict,
  validateAdminOperationalAudit,
  type AdminEnvironment,
} from '@liiiraa/control-plane-domain/admin/operations';

import type {
  AdminEmergencyStopRecord,
  AdminExportRecord,
  AdminIncidentRecord,
  AdminOperationsCapability,
  AdminOperationsCommandResult,
  AdminOperationsDependencies,
  AdminOperationsTransaction,
  AdminPrivacyCaseRecord,
  AdminSearchQuery,
} from '../ports/admin-operations.js';

const failure = (code: string, extra: Readonly<Record<string, unknown>> = {}) =>
  Object.freeze({ ok: false, code, ...extra });

const nonEmpty = (value: string): boolean => value.trim().length > 0;
const validInstant = (value: string): boolean => Number.isFinite(Date.parse(value));

const validOperationContext = (...values: readonly string[]): boolean => values.every(nonEmpty);

const environmentAllowed = (
  dependencies: AdminOperationsDependencies,
  targetEnvironment: AdminEnvironment,
): boolean => dependencies.environment === targetEnvironment;

const authorize = (
  dependencies: AdminOperationsDependencies,
  actorId: string,
  capability: AdminOperationsCapability,
  targetEnvironment: AdminEnvironment,
) => dependencies.authorization.authorize({ actorId, capability, targetEnvironment });

interface DurableOperationInput {
  readonly actorId: string;
  readonly commandId: string;
  readonly idempotencyKey: string;
  readonly correlationId: string;
  readonly subjectId: string;
  readonly outcome: string;
  readonly scope: string;
  readonly reason: string;
  readonly occurredAt: string;
  readonly before: string;
  readonly after: string;
  readonly result?: Readonly<Record<string, unknown>>;
  readonly work?: Readonly<Record<string, unknown>>;
}

const durableOperation = async (
  dependencies: AdminOperationsDependencies,
  transaction: AdminOperationsTransaction,
  input: DurableOperationInput,
): Promise<AdminOperationsCommandResult> => {
  const auditAdmission = validateAdminOperationalAudit({
    actorId: input.actorId,
    activeFunction: 'operations',
    scope: input.scope,
    reason: input.reason,
    approvals: [],
    before: input.before,
    after: input.after,
    origin: dependencies.environment,
    correlationId: input.correlationId,
    outcome: input.outcome,
  });
  if (!auditAdmission.valid) throw new Error(auditAdmission.code);
  if (input.work !== undefined) await transaction.enqueueWork(input.work);
  const auditReference = await transaction.appendAudit({
    eventId: dependencies.ids.next(),
    actorId: input.actorId,
    subjectId: input.subjectId,
    action: input.outcome,
    scope: input.scope,
    reason: input.reason,
    before: input.before,
    after: input.after,
    origin: dependencies.environment,
    correlationId: input.correlationId,
    occurredAt: input.occurredAt,
  });
  await transaction.enqueueOutbox({
    outboxId: dependencies.ids.next(),
    topic: 'admin.operations.changed',
    subjectId: input.subjectId,
    outcome: input.outcome,
    auditReference,
    availableAt: input.occurredAt,
  });
  const receiptId = dependencies.ids.next();
  await transaction.saveReceipt({
    receiptId,
    commandId: input.commandId,
    idempotencyKey: input.idempotencyKey,
    actorId: input.actorId,
    subjectId: input.subjectId,
    outcome: input.outcome,
    occurredAt: input.occurredAt,
    auditReference,
  });
  const result = Object.freeze({
    ok: true,
    outcome: input.outcome,
    auditReference,
    receiptId,
    commandId: input.commandId,
    subjectId: input.subjectId,
    occurredAt: input.occurredAt,
    ...input.result,
  });
  await transaction.rememberCommandResult(input.commandId, result);
  return result;
};

export interface SearchAdminOperationsInput {
  readonly actorId: string;
  readonly query: string;
  readonly targetEnvironment: AdminEnvironment;
  readonly view: Readonly<{ kind: 'official' | 'personal'; viewId: string }>;
}

export const searchAdminOperations = async (
  dependencies: AdminOperationsDependencies,
  input: SearchAdminOperationsInput,
): Promise<AdminOperationsCommandResult> => {
  const authorization = await authorize(
    dependencies,
    input.actorId,
    'admin-operations:search',
    input.targetEnvironment,
  );
  if (!authorization.allowed) return failure(authorization.code);
  if (!environmentAllowed(dependencies, input.targetEnvironment)) {
    return failure('ENVIRONMENT_CROSSING_FORBIDDEN');
  }
  const query: AdminSearchQuery = {
    query: input.query.trim(),
    environment: input.targetEnvironment,
    allowedScopes: authorization.allowedScopes,
    view: input.view,
    ...(authorization.ownerId === undefined ? {} : { ownerId: authorization.ownerId }),
  };
  const records = await dependencies.repository.search(query);
  return Object.freeze({ ok: true, freshness: 'current', records });
};

export interface TransitionAdminOperationalJobInput {
  readonly actorId: string;
  readonly commandId: string;
  readonly correlationId: string;
  readonly jobId: string;
  readonly expectedVersion: bigint;
  readonly idempotencyKey: string;
  readonly command:
    'start' | 'pause' | 'resume' | 'complete' | 'partial' | 'fail' | 'cancel' | 'retry';
  readonly progress?: number;
  readonly receiptId?: string;
  readonly safeCancellation?: boolean;
  readonly connection: 'connected' | 'reconnecting' | 'disconnected' | 'degraded';
  readonly lastUpdatedAt: string;
  readonly targetEnvironment: AdminEnvironment;
  readonly reason: string;
}

export const transitionAdminOperationalJob = async (
  dependencies: AdminOperationsDependencies,
  input: TransitionAdminOperationalJobInput,
): Promise<AdminOperationsCommandResult> => {
  const authorization = await authorize(
    dependencies,
    input.actorId,
    'admin-operations:jobs',
    input.targetEnvironment,
  );
  if (!authorization.allowed) return failure(authorization.code);
  if (!environmentAllowed(dependencies, input.targetEnvironment)) {
    return failure('ENVIRONMENT_CROSSING_FORBIDDEN');
  }
  if (
    !validOperationContext(
      input.commandId,
      input.correlationId,
      input.idempotencyKey,
      input.jobId,
      input.reason,
    ) ||
    !validInstant(input.lastUpdatedAt)
  ) {
    return failure('OPERATION_CONTEXT_REQUIRED');
  }
  const occurredAt = dependencies.clock.now().toISOString();
  const freshness = decideOperationalFreshness({
    connection: input.connection,
    lastUpdatedAt: input.lastUpdatedAt,
    now: occurredAt,
    maximumAgeMs: 30_000,
    action:
      input.command === 'complete' || input.command === 'cancel' ? 'critical-mutation' : 'mutation',
  });
  if (!freshness.allowed) return failure(freshness.code, { secretlyQueued: false });
  try {
    return await dependencies.repository.transaction(input.jobId, async (transaction) => {
      const replay = await transaction.findCommandResult(input.commandId);
      if (replay !== null) return replay;
      const current = await transaction.loadJob(input.jobId);
      if (current === null) return failure('JOB_NOT_FOUND');
      if (current.version !== input.expectedVersion) return failure('STALE');
      const decision = decideAdminJobTransition({
        state: current,
        command: input.command,
        now: occurredAt,
        idempotencyKey: input.idempotencyKey,
        ...(input.progress === undefined ? {} : { progress: input.progress }),
        ...(input.receiptId === undefined ? {} : { receiptId: input.receiptId }),
        ...(input.safeCancellation === undefined
          ? {}
          : { safeCancellation: input.safeCancellation }),
      });
      if (!decision.accepted) return failure(decision.code);
      await transaction.saveJob(decision.state);
      return durableOperation(dependencies, transaction, {
        actorId: input.actorId,
        commandId: input.commandId,
        idempotencyKey: input.idempotencyKey,
        correlationId: input.correlationId,
        subjectId: input.jobId,
        outcome: 'job-transitioned',
        scope: 'jobs',
        reason: input.reason.trim(),
        occurredAt,
        before: `${current.status}:${String(current.progress)}`,
        after: `${decision.state.status}:${String(decision.state.progress)}`,
        result: { state: decision.state },
      });
    });
  } catch {
    return failure('OPERATIONS_UNAVAILABLE');
  }
};

export interface ResolveAdminOperationalConflictInput {
  readonly actorId: string;
  readonly commandId: string;
  readonly idempotencyKey: string;
  readonly correlationId: string;
  readonly subjectId: string;
  readonly expectedVersion: bigint;
  readonly actualVersion: bigint;
  readonly base: Readonly<Record<string, unknown>>;
  readonly local: Readonly<Record<string, unknown>>;
  readonly remote: Readonly<Record<string, unknown>>;
  readonly targetEnvironment: AdminEnvironment;
}

export const resolveAdminOperationalConflict = async (
  dependencies: AdminOperationsDependencies,
  input: ResolveAdminOperationalConflictInput,
): Promise<AdminOperationsCommandResult> => {
  const authorization = await authorize(
    dependencies,
    input.actorId,
    'admin-operations:conflicts',
    input.targetEnvironment,
  );
  if (!authorization.allowed) return failure(authorization.code);
  if (!environmentAllowed(dependencies, input.targetEnvironment)) {
    return failure('ENVIRONMENT_CROSSING_FORBIDDEN');
  }
  if (
    !validOperationContext(
      input.commandId,
      input.idempotencyKey,
      input.correlationId,
      input.subjectId,
    )
  ) {
    return failure('OPERATION_CONTEXT_REQUIRED');
  }
  const decision = resolveAdminVersionConflict(input);
  if (decision.resolved)
    return Object.freeze({ ok: true, outcome: 'conflict-merged', merged: decision.merged });
  const occurredAt = dependencies.clock.now().toISOString();
  try {
    return await dependencies.repository.transaction(input.subjectId, async (transaction) => {
      const replay = await transaction.findCommandResult(input.commandId);
      if (replay !== null) return replay;
      await transaction.saveConflictDraft({
        draftId: dependencies.ids.next(),
        subjectId: input.subjectId,
        actorId: input.actorId,
        expectedVersion: input.expectedVersion,
        actualVersion: input.actualVersion,
        localDraft: decision.localDraft,
        remote: decision.remote,
        conflictingFields: decision.conflictingFields,
        preservedAt: occurredAt,
      });
      const auditReference = await transaction.appendAudit({
        eventId: dependencies.ids.next(),
        actorId: input.actorId,
        subjectId: input.subjectId,
        action: 'conflict-preserved',
        scope: 'conflicts',
        reason: 'Preserve incompatible local draft',
        origin: dependencies.environment,
        correlationId: input.correlationId,
        conflictingFields: decision.conflictingFields,
        occurredAt,
      });
      await transaction.enqueueOutbox({
        outboxId: dependencies.ids.next(),
        topic: 'admin.operations.conflict-preserved',
        subjectId: input.subjectId,
        auditReference,
        availableAt: occurredAt,
      });
      await transaction.saveReceipt({
        receiptId: dependencies.ids.next(),
        commandId: input.commandId,
        idempotencyKey: input.idempotencyKey,
        actorId: input.actorId,
        subjectId: input.subjectId,
        outcome: 'conflict-preserved',
        occurredAt,
        auditReference,
      });
      const result = Object.freeze({ ok: false, ...decision, auditReference });
      await transaction.rememberCommandResult(input.commandId, result);
      return result;
    });
  } catch {
    return failure('OPERATIONS_UNAVAILABLE');
  }
};

export interface ExecuteAdminIncidentRecoveryInput {
  readonly actorId: string;
  readonly commandId: string;
  readonly correlationId: string;
  readonly incidentId: string;
  readonly severity: string;
  readonly ownerId: string;
  readonly substituteId: string;
  readonly ownerAvailable: boolean;
  readonly deadline: string;
  readonly procedureVersion: string;
  readonly boundedOperation: boolean;
  readonly previewed: boolean;
  readonly rehearsed: boolean;
  readonly riskApproved: boolean;
  readonly idempotencyKey: string;
  readonly validationDefined: boolean;
  readonly compensationDefined: boolean;
  readonly targetEnvironment: AdminEnvironment;
}

export const executeAdminIncidentRecovery = async (
  dependencies: AdminOperationsDependencies,
  input: ExecuteAdminIncidentRecoveryInput,
): Promise<AdminOperationsCommandResult> => {
  const authorization = await authorize(
    dependencies,
    input.actorId,
    'admin-operations:incidents',
    input.targetEnvironment,
  );
  if (!authorization.allowed) return failure(authorization.code);
  if (!environmentAllowed(dependencies, input.targetEnvironment)) {
    return failure('ENVIRONMENT_CROSSING_FORBIDDEN');
  }
  if (
    !validOperationContext(
      input.commandId,
      input.correlationId,
      input.incidentId,
      input.severity,
      input.ownerId,
      input.substituteId,
      input.procedureVersion,
      input.idempotencyKey,
    ) ||
    !validInstant(input.deadline)
  ) {
    return failure('OPERATION_CONTEXT_REQUIRED');
  }
  const admission = decideIncidentRecovery(input);
  if (!admission.allowed) return failure(admission.code);
  if (!dependencies.allowedProcedureVersions.includes(input.procedureVersion)) {
    return failure('PROCEDURE_NOT_ALLOWLISTED');
  }
  const occurredAt = dependencies.clock.now().toISOString();
  const ownership = decideOperationalOwnership({
    priority: input.severity === 'critical' ? 'critical' : 'urgent',
    ownerId: input.ownerId,
    substituteId: input.substituteId,
    ownerAvailable: input.ownerAvailable,
    deadline: input.deadline,
    now: occurredAt,
    externalChannelVerified: true,
    acknowledged: false,
    containsSensitivePayload: false,
  });
  const incident: AdminIncidentRecord = {
    incidentId: input.incidentId,
    procedureVersion: input.procedureVersion,
    severity: input.severity,
    ownerId: ownership.action === 'retain-owner' ? input.ownerId : input.substituteId,
    substituteId: input.substituteId,
    environment: input.targetEnvironment,
    status: 'recovery-started',
    startedAt: occurredAt,
  };
  try {
    const result = await dependencies.repository.transaction(
      input.incidentId,
      async (transaction) => {
        const replay = await transaction.findCommandResult(input.commandId);
        if (replay !== null) return replay;
        await transaction.saveIncident(incident);
        return durableOperation(dependencies, transaction, {
          actorId: input.actorId,
          commandId: input.commandId,
          idempotencyKey: input.idempotencyKey,
          correlationId: input.correlationId,
          subjectId: input.incidentId,
          outcome: 'recovery-started',
          scope: 'incidents',
          reason: `Execute ${input.procedureVersion}`,
          occurredAt,
          before: 'incident-open',
          after: 'recovery-started',
          result: { incident },
          work: {
            kind: 'incident-recovery',
            incidentId: input.incidentId,
            procedureVersion: input.procedureVersion,
            validationRequired: true,
            compensationRequired: true,
          },
        });
      },
    );
    if (result.ok && ownership.externalAlertRequired) {
      await dependencies.alerts.send({
        incidentId: input.incidentId,
        severity: input.severity,
        ownerReference: incident.ownerId,
        correlationId: input.correlationId,
      });
    }
    return result;
  } catch {
    return failure('OPERATIONS_UNAVAILABLE');
  }
};

export interface StartAdminSensitiveExportInput {
  readonly actorId: string;
  readonly commandId: string;
  readonly idempotencyKey: string;
  readonly correlationId: string;
  readonly purpose: string;
  readonly fields: readonly string[];
  readonly minimumFields: readonly string[];
  readonly previewed: boolean;
  readonly masked: boolean;
  readonly approved: boolean;
  readonly encrypted: boolean;
  readonly expiresAt: string;
  readonly targetEnvironment: AdminEnvironment;
}

export const startAdminSensitiveExport = async (
  dependencies: AdminOperationsDependencies,
  input: StartAdminSensitiveExportInput,
): Promise<AdminOperationsCommandResult> => {
  const authorization = await authorize(
    dependencies,
    input.actorId,
    'admin-operations:exports',
    input.targetEnvironment,
  );
  if (!authorization.allowed) return failure(authorization.code);
  if (!environmentAllowed(dependencies, input.targetEnvironment)) {
    return failure('ENVIRONMENT_CROSSING_FORBIDDEN');
  }
  if (
    !validOperationContext(
      input.commandId,
      input.idempotencyKey,
      input.correlationId,
      input.purpose,
    ) ||
    !validInstant(input.expiresAt)
  ) {
    return failure('OPERATION_CONTEXT_REQUIRED');
  }
  const occurredAt = dependencies.clock.now().toISOString();
  const admission = authorizeSensitiveExport({ ...input, now: occurredAt });
  if (!admission.allowed) return failure(admission.code);
  const record: AdminExportRecord = {
    exportId: dependencies.ids.next(),
    actorId: input.actorId,
    purpose: input.purpose.trim(),
    fields: [...input.fields],
    encrypted: true,
    masked: true,
    environment: input.targetEnvironment,
    expiresAt: input.expiresAt,
    createdAt: occurredAt,
  };
  try {
    return await dependencies.repository.transaction(record.exportId, async (transaction) => {
      const replay = await transaction.findCommandResult(input.commandId);
      if (replay !== null) return replay;
      await transaction.saveExport(record);
      return durableOperation(dependencies, transaction, {
        actorId: input.actorId,
        commandId: input.commandId,
        idempotencyKey: input.idempotencyKey,
        correlationId: input.correlationId,
        subjectId: record.exportId,
        outcome: 'export-started',
        scope: 'exports',
        reason: input.purpose.trim(),
        occurredAt,
        before: 'not-created',
        after: `masked-encrypted:${input.fields.join(',')}`,
        result: { export: record },
        work: { kind: 'minimum-scope-export', exportId: record.exportId, fields: record.fields },
      });
    });
  } catch {
    return failure('OPERATIONS_UNAVAILABLE');
  }
};

export interface ChangeAdminConfigurationInput {
  readonly actorId: string;
  readonly commandId: string;
  readonly idempotencyKey: string;
  readonly correlationId: string;
  readonly configurationId: string;
  readonly expectedVersion: bigint;
  readonly command: 'publish' | 'pause' | 'resume' | 'complete' | 'rollback';
  readonly validated?: boolean;
  readonly impactReviewed?: boolean;
  readonly approved?: boolean;
  readonly rollbackVersion?: string;
  readonly sessionEnvironment: AdminEnvironment;
  readonly targetEnvironment: AdminEnvironment;
  readonly integrationEnvironment: AdminEnvironment;
  readonly productionStrongAccess: boolean;
  readonly reason: string;
}

export const changeAdminConfiguration = async (
  dependencies: AdminOperationsDependencies,
  input: ChangeAdminConfigurationInput,
): Promise<AdminOperationsCommandResult> => {
  const authorization = await authorize(
    dependencies,
    input.actorId,
    'admin-operations:configuration',
    input.targetEnvironment,
  );
  if (!authorization.allowed) return failure(authorization.code);
  const environment = authorizeAdminEnvironment(input);
  if (!environment.allowed || !environmentAllowed(dependencies, input.targetEnvironment)) {
    return failure(environment.allowed ? 'ENVIRONMENT_CROSSING_FORBIDDEN' : environment.code);
  }
  if (
    !validOperationContext(
      input.commandId,
      input.idempotencyKey,
      input.correlationId,
      input.configurationId,
      input.reason,
    )
  ) {
    return failure('OPERATION_CONTEXT_REQUIRED');
  }
  const occurredAt = dependencies.clock.now().toISOString();
  try {
    return await dependencies.repository.transaction(input.configurationId, async (transaction) => {
      const replay = await transaction.findCommandResult(input.commandId);
      if (replay !== null) return replay;
      const current = await transaction.loadConfiguration(input.configurationId);
      if (current === null) return failure('CONFIGURATION_NOT_FOUND');
      if (current.version !== input.expectedVersion) return failure('STALE');
      const decision = decideAdminConfigurationTransition({
        state: current,
        command: input.command,
        now: occurredAt,
        ...(input.validated === undefined ? {} : { validated: input.validated }),
        ...(input.impactReviewed === undefined ? {} : { impactReviewed: input.impactReviewed }),
        ...(input.approved === undefined ? {} : { approved: input.approved }),
        ...(input.rollbackVersion === undefined ? {} : { rollbackVersion: input.rollbackVersion }),
      });
      if (!decision.accepted) return failure(decision.code);
      await transaction.saveConfiguration(decision.state);
      return durableOperation(dependencies, transaction, {
        actorId: input.actorId,
        commandId: input.commandId,
        idempotencyKey: input.idempotencyKey,
        correlationId: input.correlationId,
        subjectId: input.configurationId,
        outcome: 'configuration-transitioned',
        scope: 'configuration',
        reason: input.reason.trim(),
        occurredAt,
        before: `${current.status}:${current.knownVersion}`,
        after: `${decision.state.status}:${decision.state.knownVersion}`,
        result: { state: decision.state },
      });
    });
  } catch {
    return failure('OPERATIONS_UNAVAILABLE');
  }
};

export interface ExecuteAdminPrivacyCaseInput {
  readonly actorId: string;
  readonly commandId: string;
  readonly idempotencyKey: string;
  readonly correlationId: string;
  readonly caseId: string;
  readonly identityVerified: boolean;
  readonly legalBasis: string;
  readonly dataDiscovered: boolean;
  readonly mandatoryRetentionReviewed: boolean;
  readonly impactReviewed: boolean;
  readonly approved: boolean;
  readonly executionDefined: boolean;
  readonly finalReceiptRequired: boolean;
  readonly targetEnvironment: AdminEnvironment;
}

export const executeAdminPrivacyCase = async (
  dependencies: AdminOperationsDependencies,
  input: ExecuteAdminPrivacyCaseInput,
): Promise<AdminOperationsCommandResult> => {
  const authorization = await authorize(
    dependencies,
    input.actorId,
    'admin-operations:privacy',
    input.targetEnvironment,
  );
  if (!authorization.allowed) return failure(authorization.code);
  if (!environmentAllowed(dependencies, input.targetEnvironment)) {
    return failure('ENVIRONMENT_CROSSING_FORBIDDEN');
  }
  if (
    !validOperationContext(
      input.commandId,
      input.idempotencyKey,
      input.correlationId,
      input.caseId,
      input.legalBasis,
    )
  ) {
    return failure('OPERATION_CONTEXT_REQUIRED');
  }
  const admission = decidePrivacyCase(input);
  if (!admission.allowed) return failure(admission.code);
  const occurredAt = dependencies.clock.now().toISOString();
  const record: AdminPrivacyCaseRecord = {
    caseId: input.caseId,
    actorId: input.actorId,
    legalBasis: input.legalBasis.trim(),
    environment: input.targetEnvironment,
    status: 'execution-pending',
    createdAt: occurredAt,
  };
  try {
    return await dependencies.repository.transaction(input.caseId, async (transaction) => {
      const replay = await transaction.findCommandResult(input.commandId);
      if (replay !== null) return replay;
      await transaction.savePrivacyCase(record);
      return durableOperation(dependencies, transaction, {
        actorId: input.actorId,
        commandId: input.commandId,
        idempotencyKey: input.idempotencyKey,
        correlationId: input.correlationId,
        subjectId: input.caseId,
        outcome: 'privacy-case-started',
        scope: 'privacy',
        reason: input.legalBasis.trim(),
        occurredAt,
        before: 'approved',
        after: 'execution-pending',
        result: { privacyCase: record },
        work: { kind: 'privacy-case', caseId: input.caseId },
      });
    });
  } catch {
    return failure('OPERATIONS_UNAVAILABLE');
  }
};

export interface StopAdminCapabilityInput {
  readonly actorId: string;
  readonly commandId: string;
  readonly idempotencyKey: string;
  readonly correlationId: string;
  readonly capability: string;
  readonly strongAuth: boolean;
  readonly reason: string;
  readonly expiresAt: string;
  readonly safeRestorationDefined: boolean;
  readonly targetEnvironment: AdminEnvironment;
}

export const stopAdminCapability = async (
  dependencies: AdminOperationsDependencies,
  input: StopAdminCapabilityInput,
): Promise<AdminOperationsCommandResult> => {
  const authorization = await authorize(
    dependencies,
    input.actorId,
    'admin-operations:emergency',
    input.targetEnvironment,
  );
  if (!authorization.allowed) return failure(authorization.code);
  if (!environmentAllowed(dependencies, input.targetEnvironment)) {
    return failure('ENVIRONMENT_CROSSING_FORBIDDEN');
  }
  if (
    !validOperationContext(
      input.commandId,
      input.idempotencyKey,
      input.correlationId,
      input.capability,
      input.reason,
    ) ||
    !validInstant(input.expiresAt)
  ) {
    return failure('OPERATION_CONTEXT_REQUIRED');
  }
  const occurredAt = dependencies.clock.now().toISOString();
  const admission = decideEmergencyCapabilityStop({
    ...input,
    requestedAt: occurredAt,
  });
  if (!admission.allowed) return failure(admission.code);
  if (!dependencies.allowedEmergencyCapabilities.includes(input.capability)) {
    return failure('CAPABILITY_NOT_ALLOWLISTED');
  }
  const record: AdminEmergencyStopRecord = {
    stopId: dependencies.ids.next(),
    actorId: input.actorId,
    capability: input.capability,
    environment: input.targetEnvironment,
    reason: input.reason.trim(),
    requestedAt: occurredAt,
    expiresAt: input.expiresAt,
    status: 'active',
  };
  try {
    return await dependencies.repository.transaction(record.stopId, async (transaction) => {
      const replay = await transaction.findCommandResult(input.commandId);
      if (replay !== null) return replay;
      await transaction.saveEmergencyStop(record);
      return durableOperation(dependencies, transaction, {
        actorId: input.actorId,
        commandId: input.commandId,
        idempotencyKey: input.idempotencyKey,
        correlationId: input.correlationId,
        subjectId: record.stopId,
        outcome: 'capability-paused',
        scope: input.capability,
        reason: input.reason.trim(),
        occurredAt,
        before: 'active',
        after: 'paused',
        result: { globalStop: false, stop: record },
      });
    });
  } catch {
    return failure('OPERATIONS_UNAVAILABLE');
  }
};
