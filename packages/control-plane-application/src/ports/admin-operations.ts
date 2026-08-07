import type {
  AdminConfigurationState,
  AdminEnvironment,
  AdminJobState,
} from '@liiiraa/control-plane-domain';

export type AdminOperationsCapability =
  | 'admin-operations:search'
  | 'admin-operations:jobs'
  | 'admin-operations:conflicts'
  | 'admin-operations:incidents'
  | 'admin-operations:exports'
  | 'admin-operations:configuration'
  | 'admin-operations:privacy'
  | 'admin-operations:emergency';

export type AdminOperationsAuthorizationResult =
  | Readonly<{
      allowed: true;
      allowedScopes: readonly string[];
      ownerId?: string;
    }>
  | Readonly<{ allowed: false; code: string }>;

export interface AdminOperationsAuthorizationPort {
  authorize(
    input: Readonly<{
      actorId: string;
      capability: AdminOperationsCapability;
      targetEnvironment: AdminEnvironment;
    }>,
  ): Promise<AdminOperationsAuthorizationResult>;
}

export interface AdminSearchRecord {
  readonly recordId: string;
  readonly scope: string;
  readonly ownerId?: string;
  readonly maskedTitle: string;
  readonly [key: string]: unknown;
}

export interface AdminSearchQuery {
  readonly query: string;
  readonly environment: AdminEnvironment;
  readonly allowedScopes: readonly string[];
  readonly ownerId?: string;
  readonly view: Readonly<{ kind: 'official' | 'personal'; viewId: string }>;
}

export interface AdminConflictDraft {
  readonly draftId: string;
  readonly subjectId: string;
  readonly actorId: string;
  readonly expectedVersion: bigint;
  readonly actualVersion: bigint;
  readonly localDraft: Readonly<Record<string, unknown>>;
  readonly remote: Readonly<Record<string, unknown>>;
  readonly conflictingFields: readonly string[];
  readonly preservedAt: string;
}

export interface AdminIncidentRecord {
  readonly incidentId: string;
  readonly procedureVersion: string;
  readonly severity: string;
  readonly ownerId: string;
  readonly substituteId: string;
  readonly environment: AdminEnvironment;
  readonly status: 'recovery-started';
  readonly startedAt: string;
}

export interface AdminExportRecord {
  readonly exportId: string;
  readonly actorId: string;
  readonly purpose: string;
  readonly fields: readonly string[];
  readonly encrypted: true;
  readonly masked: true;
  readonly environment: AdminEnvironment;
  readonly expiresAt: string;
  readonly createdAt: string;
}

export interface AdminPrivacyCaseRecord {
  readonly caseId: string;
  readonly actorId: string;
  readonly legalBasis: string;
  readonly environment: AdminEnvironment;
  readonly status: 'execution-pending';
  readonly createdAt: string;
}

export interface AdminEmergencyStopRecord {
  readonly stopId: string;
  readonly actorId: string;
  readonly capability: string;
  readonly environment: AdminEnvironment;
  readonly reason: string;
  readonly requestedAt: string;
  readonly expiresAt: string;
  readonly status: 'active';
}

export type AdminOperationsCommandResult = Readonly<{
  ok: boolean;
  outcome?: string;
  code?: string;
  [key: string]: unknown;
}>;

export interface AdminOperationsReceipt {
  readonly receiptId: string;
  readonly commandId: string;
  readonly idempotencyKey: string;
  readonly actorId: string;
  readonly subjectId: string;
  readonly outcome: string;
  readonly occurredAt: string;
  readonly auditReference: string;
}

export interface AdminOperationsTransaction {
  findCommandResult(commandId: string): Promise<AdminOperationsCommandResult | null>;
  rememberCommandResult(commandId: string, result: AdminOperationsCommandResult): Promise<void>;
  loadJob(jobId: string): Promise<AdminJobState | null>;
  saveJob(state: AdminJobState): Promise<void>;
  loadConfiguration(configurationId: string): Promise<AdminConfigurationState | null>;
  saveConfiguration(state: AdminConfigurationState): Promise<void>;
  saveConflictDraft(draft: AdminConflictDraft): Promise<void>;
  saveIncident(incident: AdminIncidentRecord): Promise<void>;
  saveExport(record: AdminExportRecord): Promise<void>;
  savePrivacyCase(record: AdminPrivacyCaseRecord): Promise<void>;
  saveEmergencyStop(record: AdminEmergencyStopRecord): Promise<void>;
  enqueueWork(work: Readonly<Record<string, unknown>>): Promise<void>;
  appendAudit(event: Readonly<Record<string, unknown>>): Promise<string>;
  enqueueOutbox(event: Readonly<Record<string, unknown>>): Promise<void>;
  saveReceipt(receipt: AdminOperationsReceipt): Promise<void>;
}

export interface AdminOperationsRepositoryPort {
  search(query: AdminSearchQuery): Promise<readonly AdminSearchRecord[]>;
  transaction<T>(
    subjectId: string,
    operation: (transaction: AdminOperationsTransaction) => Promise<T>,
  ): Promise<T>;
}

export interface AdminExternalAlertPort {
  send(
    alert: Readonly<{
      incidentId: string;
      severity: string;
      ownerReference: string;
      correlationId: string;
    }>,
  ): Promise<void>;
}

export interface AdminOperationsDependencies {
  readonly authorization: AdminOperationsAuthorizationPort;
  readonly repository: AdminOperationsRepositoryPort;
  readonly alerts: AdminExternalAlertPort;
  readonly clock: Readonly<{ now(): Date }>;
  readonly ids: Readonly<{ next(): string }>;
  readonly environment: AdminEnvironment;
  readonly allowedProcedureVersions: readonly string[];
  readonly allowedEmergencyCapabilities: readonly string[];
}
