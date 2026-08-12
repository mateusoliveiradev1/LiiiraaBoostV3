import {
  controlPlaneDocumentValidator,
  type AdminInvitationProjectionJson,
  type AdminEnvironmentKindJson,
  type AdminActionJson,
  type AdminCommandJson,
  type AdminRoleJson,
  type AuditEventJson,
  type AuthorityReceiptJson,
  type DiagnosticConsentJson,
  type ControlPlaneDocumentJson,
} from '@liiiraa/contracts-ts';

export const ADMIN_QUERY_FAMILIES = Object.freeze([
  'briefing',
  'search',
  'invitations',
  'team',
  'approvals',
  'jobs',
  'incidents',
  'exports',
  'configurations',
  'capacity',
  'environments',
  'audit',
  'alerts',
  'privacy',
  'emergency',
] as const);

export type AdminQueryFamily = (typeof ADMIN_QUERY_FAMILIES)[number];

export type AdminAuthorityDocument = Extract<
  ControlPlaneDocumentJson,
  Readonly<{ kind: `admin-${string}` }>
>;

export type AdminQueryOptions = Readonly<{
  cursor?: string;
  environment: AdminEnvironmentKindJson;
  limit?: number;
  query?: string;
  signal?: AbortSignal;
}>;

export type AdminQueryResult =
  | Readonly<{
      freshness?: Readonly<{
        observedAt: string;
        sequence: string;
        source: string;
        state: 'live' | 'reconnecting' | 'stale' | 'offline' | 'degraded';
      }>;
      nextCursor: string | null;
      records: readonly AdminAuthorityDocument[];
      status: 'online';
    }>
  | Readonly<{
      code: 'invalid-authority' | 'unauthorized' | 'unavailable' | 'rate-limit';
      records: readonly [];
      status: 'denied' | 'error';
    }>;

export type AdminMutationFamily =
  | 'preflight-invitations'
  | 'issue-invitations'
  | 'resend-invitation'
  | 'revoke-invitation'
  | 'batch-invitations'
  | 'invite-team-member'
  | 'preview-permission-impact'
  | 'switch-function'
  | 'offboard-member'
  | 'activate-member'
  | 'create-delegation'
  | 'review-access'
  | 'request-approval'
  | 'approve-request'
  | 'cancel-request'
  | 'reassign-request'
  | 'governance-break-glass'
  | 'transition-job'
  | 'resolve-conflict'
  | 'recover-incident'
  | 'export-data'
  | 'transition-configuration'
  | 'execute-privacy'
  | 'emergency-stop';

export type AdminMutationInput = Readonly<{
  approvalReferences?: readonly string[];
  expectedEtag?: string;
  expectedVersion?: string;
  family: AdminMutationFamily;
  idempotencyKey: string;
  payload: Readonly<Record<string, unknown>>;
  reason?: string;
  signal?: AbortSignal;
  stepUp?: AdminStepUp;
  targetId?: string;
}>;

export type AdminInvitationPreflightAuthority = Readonly<{
  kind: 'admin-invitation-preflight';
  rows: readonly Readonly<{
    classification: 'valid' | 'duplicate' | 'active' | 'invalid' | 'ineligible';
    rowId: string;
  }>[];
}>;

export type AdminInvitationDetailResult =
  | Readonly<{
      invitation: AdminInvitationProjectionJson;
      retention: Readonly<{
        action: 'retain' | 'delete-personal-data' | 'pseudonymize-personal-data';
        basis?: 'operational' | 'purpose' | 'legal-hold';
        preserveMinimumAuditReceipt?: true;
      }>;
      status: 'online';
      timeline: readonly Readonly<{ at: string; kind: string; outcome?: string }>[];
    }>
  | Readonly<{
      code: 'invalid-authority' | 'unauthorized' | 'unavailable';
      status: 'denied' | 'error';
    }>;

export type AdminMutationResult =
  | Readonly<{ document: AdminAuthorityDocument; status: 'complete' | 'partial' }>
  | Readonly<{ preflight: AdminInvitationPreflightAuthority; status: 'complete' }>
  | Readonly<{ receipt: AdminSensitiveExportReceipt; status: 'complete' }>
  | Readonly<{
      code: 'conflict';
      document?: AdminAuthorityDocument;
      status: 'conflict';
    }>
  | Readonly<{
      code: 'degraded' | 'invalid-authority' | 'rate-limit' | 'unauthorized' | 'unavailable';
      status: 'denied' | 'error';
    }>;

export type AdminSensitiveExportReceipt = Readonly<{
  auditReference: string;
  createdAt: string;
  encrypted: true;
  environment: AdminEnvironmentKindJson;
  expiresAt: string;
  exportId: string;
  fields: readonly string[];
  masked: true;
  outcome: 'export-started';
  purpose: string;
}>;

export type AdminFreshnessInvalidation = Readonly<{
  cursor: string;
  resources: readonly string[];
  updatedAt: string;
  version: string;
}>;

export type AdminFreshnessLifecycle = Readonly<{
  settled: Promise<void>;
  signal: AbortSignal;
  stop: () => void;
}>;

export type AdminFreshnessInput = Readonly<{
  cursor?: string;
  environment: AdminEnvironmentKindJson;
  onInvalidate: (event: AdminFreshnessInvalidation) => void;
  onState: (state: 'live' | 'reconnecting' | 'offline' | 'degraded') => void;
  refetch: (resources: readonly string[], signal: AbortSignal) => Promise<void>;
  signal?: AbortSignal;
}>;

export const ADMIN_PROJECTION_RESOURCES = Object.freeze([
  'support-cases',
  'devices',
  'entitlements',
  'sessions',
  'diagnostic-metadata',
  'audit-events',
] as const);

export type AdminProjectionCollection = (typeof ADMIN_PROJECTION_RESOURCES)[number];

export const adminRoleProjectionCollection = (role: AdminRoleJson): AdminProjectionCollection => {
  switch (role) {
    case 'support':
      return 'support-cases';
    case 'operations':
      return 'entitlements';
    case 'security':
      return 'sessions';
    case 'audit':
      return 'audit-events';
  }
};

export type AdminSessionProjection = Readonly<{
  actorId: string;
  assignedFunctions: readonly AdminRoleJson[];
  expiresAt: string;
  role: AdminRoleJson;
  sessionId?: string;
}>;

export type AdminEnrollmentRequired = Readonly<{
  kind: 'enrollment-required';
}>;

export type AdminAccessProjection = AdminEnrollmentRequired | AdminSessionProjection;

export type AdminTotpEnrollment = Readonly<{
  enrollmentToken: string;
  expiresAt: string;
  otpauthUri: string;
  secret: string;
}>;

export type AdminProjectionRecord = Readonly<{
  id: string;
  redactedTarget?: string;
  summary?: string;
  [key: string]: unknown;
}>;

export type AdminDiagnosticProjection = Readonly<{
  auditEvents: readonly AuditEventJson[];
  consent: DiagnosticConsentJson;
  fields: Readonly<Record<string, string>>;
}>;

export type AdminAuthorityTransport = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type AdminAuthorityListResult =
  | Readonly<{
      records: readonly AdminProjectionRecord[];
      role: AdminRoleJson;
      status: 'online';
    }>
  | Readonly<{
      code: 'invalid-authority' | 'unauthorized' | 'unavailable';
      records: readonly [];
      status: 'denied' | 'error';
    }>;

export type AdminStepUp = Readonly<{
  action: string;
  authorizationContextId: string;
  expiresAt: string;
  method: 'totp';
  receipt: string;
  redactedTarget: string;
  resource: string;
  verifiedAt: string;
}>;

export type AdminStepUpBinding = Readonly<{
  action: string;
  authorizationContextId: string;
  redactedTarget: string;
  resource: string;
}>;

export type AdminCommandInput = Readonly<{
  action: AdminActionJson;
  actorId: string;
  assumedRole: AdminRoleJson;
  confirmed: boolean;
  expectedVersion: string;
  impactReviewed: boolean;
  reason: string;
  redactedTarget: string;
  stepUp: AdminStepUp | null;
}>;

export type AdminCommandResult =
  | Readonly<{ receipt: AuthorityReceiptJson; status: 'complete' }>
  | Readonly<{
      code:
        | 'invalid-authority'
        | 'step-up-required'
        | 'review-required'
        | 'unauthorized'
        | 'unavailable';
      status: 'denied' | 'error';
    }>;

export type BreakGlassMetadata = Readonly<{
  accountReference?: string;
  caseId?: string;
  riskClass?: string;
  sessionReference?: string;
}>;

export type AdminDiagnosticClearReason = 'expired' | 'revoked' | 'unauthorized' | 'invalid';

export type AdminDiagnosticLifecycle = Readonly<{
  settled: Promise<void>;
  signal: AbortSignal;
  stop: () => void;
}>;

export interface AdminAuthority {
  beginTotpEnrollment(): Promise<AdminTotpEnrollment | null>;
  confirmTotpEnrollment(
    input: Readonly<{ code: string; enrollmentToken: string }>,
  ): Promise<AdminSessionProjection | null>;
  loadInvitation(
    input: Readonly<{ invitationId: string; signal?: AbortSignal }>,
  ): Promise<AdminInvitationDetailResult>;
  query(family: AdminQueryFamily, options: AdminQueryOptions): Promise<AdminQueryResult>;
  mutate(input: AdminMutationInput): Promise<AdminMutationResult>;
  openFreshness(input: AdminFreshnessInput): AdminFreshnessLifecycle;
  signIn(
    input: Readonly<{ email: string; password: string }>,
  ): Promise<AdminAccessProjection | null>;
  signOut(): Promise<boolean>;
  session(): Promise<AdminAccessProjection | null>;
  verifyStepUp(input: AdminStepUpBinding & Readonly<{ code: string }>): Promise<AdminStepUp | null>;
  verifyMutationStepUp(
    input: AdminMutationInput & Readonly<{ code: string }>,
  ): Promise<AdminStepUp | null>;
  list(collection: AdminProjectionCollection): Promise<AdminAuthorityListResult>;
  execute(input: AdminCommandInput): Promise<AdminCommandResult>;
  breakGlass(
    input: Readonly<{
      expiresAt: string;
      reason: string;
      stepUp: AdminStepUp;
      targetReference: string;
    }>,
  ): Promise<
    | Readonly<{ metadata: BreakGlassMetadata; status: 'complete' }>
    | Readonly<{
        code: 'invalid-authority' | 'unauthorized' | 'unavailable';
        status: 'denied' | 'error';
      }>
  >;
  openDiagnostic(
    input: Readonly<{
      diagnosticId: string;
      onClear: (
        result: Readonly<{
          auditEvents: readonly AuditEventJson[];
          reason: AdminDiagnosticClearReason;
        }>,
      ) => void;
      onProjection: (projection: AdminDiagnosticProjection) => void;
      signal?: AbortSignal;
    }>,
  ): Promise<AdminDiagnosticLifecycle>;
}

export interface CreateAdminAuthorityOptions {
  readonly baseUrl?: string;
  readonly clock?: () => string;
  readonly commandId?: () => string;
  readonly correlationId: () => string;
  readonly csrfToken: () => string;
  readonly reconnectDelayMs?: number;
  readonly subscribeToConsent?: (listener: () => void) => () => void;
  readonly transport?: AdminAuthorityTransport;
}

const ADMIN_ROLES = Object.freeze([
  'support',
  'operations',
  'security',
  'audit',
] as const satisfies readonly AdminRoleJson[]);

const TOKEN = /^[A-Za-z0-9._:-]{1,128}$/u;
const REDACTED_TEXT = /^.{1,256}$/u;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isRole = (value: unknown): value is AdminRoleJson =>
  typeof value === 'string' && ADMIN_ROLES.includes(value as AdminRoleJson);

const safeJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const admitSession = (value: unknown): AdminSessionProjection | null => {
  if (
    !isRecord(value) ||
    typeof value['actorId'] !== 'string' ||
    !TOKEN.test(value['actorId']) ||
    (value['sessionId'] !== undefined &&
      (typeof value['sessionId'] !== 'string' || !TOKEN.test(value['sessionId']))) ||
    !isRole(value['role']) ||
    typeof value['expiresAt'] !== 'string' ||
    Number.isNaN(Date.parse(value['expiresAt']))
  ) {
    return null;
  }
  const assignedFunctions = Array.isArray(value['assignedFunctions'])
    ? value['assignedFunctions'].filter(isRole)
    : [];
  const admittedFunctions = assignedFunctions.includes(value['role'])
    ? assignedFunctions
    : [value['role'], ...assignedFunctions];
  return Object.freeze({
    actorId: value['actorId'],
    assignedFunctions: Object.freeze([...new Set(admittedFunctions)]),
    expiresAt: value['expiresAt'],
    role: value['role'],
    ...(typeof value['sessionId'] === 'string' ? { sessionId: value['sessionId'] } : {}),
  });
};

const validCsrfToken = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length >= 43 &&
  value.length <= 256 &&
  /^[A-Za-z0-9._-]+$/u.test(value);

const admitSignedInSession = (value: unknown): AdminSessionProjection | null => {
  if (!isRecord(value) || !isRecord(value['actor'])) return null;
  const actor = value['actor'];
  if (
    typeof actor['accountId'] !== 'string' ||
    !TOKEN.test(actor['accountId']) ||
    (actor['sessionId'] !== undefined &&
      (typeof actor['sessionId'] !== 'string' || !TOKEN.test(actor['sessionId']))) ||
    !isRole(actor['role']) ||
    actor['sessionKind'] !== 'admin' ||
    typeof actor['expiresAt'] !== 'string' ||
    Number.isNaN(Date.parse(actor['expiresAt']))
  ) {
    return null;
  }
  return Object.freeze({
    actorId: actor['accountId'],
    assignedFunctions: Object.freeze([actor['role']]),
    expiresAt: actor['expiresAt'],
    role: actor['role'],
    ...(typeof actor['sessionId'] === 'string' ? { sessionId: actor['sessionId'] } : {}),
  });
};

const admitStrongAuthStatus = (value: unknown): boolean | null =>
  isRecord(value) && typeof value['enabled'] === 'boolean' ? value['enabled'] : null;

const admitTotpEnrollment = (value: unknown): AdminTotpEnrollment | null => {
  if (
    !isRecord(value) ||
    typeof value['enrollmentToken'] !== 'string' ||
    value['enrollmentToken'].length < 32 ||
    typeof value['secret'] !== 'string' ||
    !/^[A-Z2-7]{16,128}$/u.test(value['secret']) ||
    typeof value['otpauthUri'] !== 'string' ||
    !value['otpauthUri'].startsWith('otpauth://totp/') ||
    typeof value['expiresAt'] !== 'string' ||
    Number.isNaN(Date.parse(value['expiresAt']))
  )
    return null;
  return Object.freeze({
    enrollmentToken: value['enrollmentToken'],
    expiresAt: value['expiresAt'],
    otpauthUri: value['otpauthUri'],
    secret: value['secret'],
  });
};

const admitStepUp = (value: unknown, binding: AdminStepUpBinding): AdminStepUp | null => {
  if (
    !isRecord(value) ||
    value['ok'] !== true ||
    value['method'] !== 'totp' ||
    typeof value['receipt'] !== 'string' ||
    value['receipt'].length < 43 ||
    value['receipt'].length > 256 ||
    !/^[A-Za-z0-9_-]+$/u.test(value['receipt']) ||
    typeof value['verifiedAt'] !== 'string' ||
    Number.isNaN(Date.parse(value['verifiedAt'])) ||
    typeof value['expiresAt'] !== 'string' ||
    Number.isNaN(Date.parse(value['expiresAt']))
  )
    return null;
  return Object.freeze({
    ...binding,
    expiresAt: value['expiresAt'],
    method: 'totp',
    receipt: value['receipt'],
    verifiedAt: value['verifiedAt'],
  });
};

const admitRecord = (value: unknown): AdminProjectionRecord | null => {
  if (!isRecord(value) || typeof value['id'] !== 'string' || !TOKEN.test(value['id'])) return null;
  if (
    (value['redactedTarget'] !== undefined &&
      (typeof value['redactedTarget'] !== 'string' ||
        !REDACTED_TEXT.test(value['redactedTarget']))) ||
    (value['summary'] !== undefined &&
      (typeof value['summary'] !== 'string' || !REDACTED_TEXT.test(value['summary'])))
  ) {
    return null;
  }
  return Object.freeze({ ...value, id: value['id'] });
};

const isGenerated = (value: unknown, kind: string): boolean =>
  isRecord(value) && value['kind'] === kind && controlPlaneDocumentValidator(value);

const admitDiagnostic = (value: unknown): AdminDiagnosticProjection | null => {
  if (
    !isRecord(value) ||
    !isGenerated(value['consent'], 'diagnostic-consent') ||
    !isRecord(value['fields']) ||
    Object.keys(value['fields']).length > 16 ||
    !Object.entries(value['fields']).every(
      ([key, field]) => TOKEN.test(key) && typeof field === 'string' && field.length <= 256,
    ) ||
    !Array.isArray(value['auditEvents']) ||
    !value['auditEvents'].every((event) => isGenerated(event, 'audit-event'))
  ) {
    return null;
  }
  return Object.freeze({
    auditEvents: Object.freeze([...(value['auditEvents'] as AuditEventJson[])]),
    consent: value['consent'] as DiagnosticConsentJson,
    fields: Object.freeze({ ...(value['fields'] as Record<string, string>) }),
  });
};

const cachePolicyIsPrivate = (response: Response): boolean =>
  response.headers.get('cache-control')?.toLowerCase().includes('no-store') === true;

const reasonForConsent = (consent: DiagnosticConsentJson): AdminDiagnosticClearReason | null => {
  if (consent.state === 'revoked') return 'revoked';
  if (consent.state === 'expired') return 'expired';
  return null;
};

const admitBreakGlass = (value: unknown): BreakGlassMetadata | null => {
  if (!isRecord(value)) return null;
  const allowed = ['accountReference', 'caseId', 'riskClass', 'sessionReference'] as const;
  if (
    Object.keys(value).some((key) => !allowed.includes(key as (typeof allowed)[number])) ||
    !Object.values(value).every((item) => typeof item === 'string' && item.length <= 128)
  ) {
    return null;
  }
  return Object.freeze({ ...value });
};

const QUERY_PATHS = Object.freeze({
  approvals: '/v1/admin/governance/approvals',
  alerts: '/v1/admin/operations/alerts',
  audit: '/v1/admin/operations/audit-events',
  briefing: '/v1/admin/operations/queues',
  capacity: '/v1/admin/operations/capacity',
  configurations: '/v1/admin/operations/configurations',
  emergency: '/v1/admin/operations/emergency-stops',
  environments: '/v1/admin/operations/environments',
  exports: '/v1/admin/operations/exports',
  incidents: '/v1/admin/operations/incidents',
  invitations: '/v1/admin/invitations',
  jobs: '/v1/admin/operations/jobs',
  privacy: '/v1/admin/operations/privacy-cases',
  search: '/v1/admin/operations/search',
  team: '/v1/admin/governance/team',
} satisfies Readonly<Record<AdminQueryFamily, string>>);

const OPERATION_QUERY_FAMILIES = new Set<AdminQueryFamily>([
  'audit',
  'alerts',
  'briefing',
  'capacity',
  'configurations',
  'emergency',
  'environments',
  'exports',
  'incidents',
  'jobs',
  'privacy',
  'search',
]);

const boundedToken = (value: unknown): value is string =>
  typeof value === 'string' && TOKEN.test(value);

const admitFreshness = (
  value: unknown,
): Exclude<Extract<AdminQueryResult, { status: 'online' }>['freshness'], undefined> | null => {
  if (
    !isRecord(value) ||
    !['live', 'reconnecting', 'stale', 'offline', 'degraded'].includes(String(value['state'])) ||
    !boundedToken(value['source']) ||
    !boundedToken(value['sequence']) ||
    typeof value['observedAt'] !== 'string' ||
    Number.isNaN(Date.parse(value['observedAt']))
  ) {
    return null;
  }
  return Object.freeze({
    observedAt: value['observedAt'],
    sequence: value['sequence'],
    source: value['source'],
    state: value['state'] as 'live' | 'reconnecting' | 'stale' | 'offline' | 'degraded',
  });
};

const admitAdminDocument = (value: unknown): AdminAuthorityDocument | null => {
  if (
    !isRecord(value) ||
    typeof value['kind'] !== 'string' ||
    !value['kind'].startsWith('admin-') ||
    !controlPlaneDocumentValidator(value)
  ) {
    return null;
  }
  return Object.freeze({ ...value }) as AdminAuthorityDocument;
};

const extractAdminDocument = (value: unknown): AdminAuthorityDocument | null => {
  const direct = admitAdminDocument(value);
  if (direct !== null) return direct;
  if (!isRecord(value)) return null;
  for (const key of ['document', 'projection', 'receipt', 'result'] as const) {
    const nested = admitAdminDocument(value[key]);
    if (nested !== null) return nested;
  }
  return null;
};

const PREFLIGHT_CLASSIFICATIONS = new Set([
  'valid',
  'duplicate',
  'active',
  'invalid',
  'ineligible',
]);

const admitInvitationPreflight = (value: unknown): AdminInvitationPreflightAuthority | null => {
  if (!isRecord(value) || value['ok'] !== true || !Array.isArray(value['rows'])) return null;
  if (value['rows'].length < 1 || value['rows'].length > 100) return null;
  const rowIds = new Set<string>();
  const rows: AdminInvitationPreflightAuthority['rows'][number][] = [];
  for (const candidate of value['rows']) {
    if (!isRecord(candidate)) return null;
    const rowId = candidate['rowId'];
    const classification = candidate['classification'];
    if (
      !boundedToken(rowId) ||
      rowIds.has(rowId) ||
      typeof classification !== 'string' ||
      !PREFLIGHT_CLASSIFICATIONS.has(classification)
    ) {
      return null;
    }
    rowIds.add(rowId);
    rows.push({
      rowId,
      classification:
        classification as AdminInvitationPreflightAuthority['rows'][number]['classification'],
    });
  }
  return Object.freeze({
    kind: 'admin-invitation-preflight',
    rows: Object.freeze(rows.map((row) => Object.freeze(row))),
  });
};

const admitSensitiveExportReceipt = (value: unknown): AdminSensitiveExportReceipt | null => {
  if (
    !isRecord(value) ||
    value['ok'] !== true ||
    value['outcome'] !== 'export-started' ||
    !boundedToken(value['auditReference']) ||
    !isRecord(value['export'])
  ) {
    return null;
  }
  const record = value['export'];
  const fields = record['fields'];
  if (
    !boundedToken(record['exportId']) ||
    typeof record['purpose'] !== 'string' ||
    record['purpose'].trim().length < 8 ||
    record['purpose'].length > 256 ||
    !Array.isArray(fields) ||
    fields.length < 1 ||
    fields.length > 32 ||
    !fields.every(boundedToken) ||
    new Set(fields).size !== fields.length ||
    record['encrypted'] !== true ||
    record['masked'] !== true ||
    !['development', 'staging', 'production'].includes(String(record['environment'])) ||
    typeof record['expiresAt'] !== 'string' ||
    Number.isNaN(Date.parse(record['expiresAt'])) ||
    typeof record['createdAt'] !== 'string' ||
    Number.isNaN(Date.parse(record['createdAt']))
  ) {
    return null;
  }
  return Object.freeze({
    auditReference: value['auditReference'],
    createdAt: record['createdAt'],
    encrypted: true,
    environment: record['environment'] as AdminEnvironmentKindJson,
    expiresAt: record['expiresAt'],
    exportId: record['exportId'],
    fields: Object.freeze([...fields]),
    masked: true,
    outcome: 'export-started',
    purpose: record['purpose'].trim(),
  });
};

const INVITATION_TIMELINE_KINDS = new Set([
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

const admitInvitationDetail = (value: unknown): AdminInvitationDetailResult | null => {
  if (!isRecord(value)) return null;
  const document = admitAdminDocument(value['document']);
  if (document?.kind !== 'admin-invitation-projection' || !Array.isArray(value['timeline'])) {
    return null;
  }
  const timeline: Extract<AdminInvitationDetailResult, { status: 'online' }>['timeline'][number][] =
    [];
  for (const event of value['timeline']) {
    if (!isRecord(event)) return null;
    const kind = event['kind'];
    const at = event['at'];
    const outcome = event['outcome'];
    if (
      typeof kind !== 'string' ||
      !INVITATION_TIMELINE_KINDS.has(kind) ||
      typeof at !== 'string' ||
      Number.isNaN(Date.parse(at)) ||
      (outcome !== undefined &&
        (typeof outcome !== 'string' || outcome.length > 128 || outcome.includes('@')))
    ) {
      return null;
    }
    timeline.push(Object.freeze({ at, kind, ...(outcome === undefined ? {} : { outcome }) }));
  }
  const retention = value['retention'];
  if (!isRecord(retention)) return null;
  const action = retention['action'];
  const basis = retention['basis'];
  const preserveMinimumAuditReceipt = retention['preserveMinimumAuditReceipt'];
  if (
    typeof action !== 'string' ||
    !['retain', 'delete-personal-data', 'pseudonymize-personal-data'].includes(action) ||
    (basis !== undefined &&
      (typeof basis !== 'string' || !['operational', 'purpose', 'legal-hold'].includes(basis))) ||
    (preserveMinimumAuditReceipt !== undefined && preserveMinimumAuditReceipt !== true)
  ) {
    return null;
  }
  return Object.freeze({
    invitation: document,
    retention: Object.freeze({
      action: action as Extract<
        AdminInvitationDetailResult,
        { status: 'online' }
      >['retention']['action'],
      ...(basis === undefined
        ? {}
        : {
            basis: basis as NonNullable<
              Extract<AdminInvitationDetailResult, { status: 'online' }>['retention']['basis']
            >,
          }),
      ...(preserveMinimumAuditReceipt === true
        ? { preserveMinimumAuditReceipt: true as const }
        : {}),
    }),
    status: 'online',
    timeline: Object.freeze(timeline),
  });
};

const requireMutationTarget = (input: AdminMutationInput): string | null =>
  boundedToken(input.targetId) ? encodeURIComponent(input.targetId) : null;

const mutationPath = (input: AdminMutationInput): string | null => {
  const target = requireMutationTarget(input);
  switch (input.family) {
    case 'preflight-invitations':
      return '/v1/admin/invitations/preflight';
    case 'issue-invitations':
      return '/v1/admin/invitations';
    case 'batch-invitations':
      return '/v1/admin/invitations/batches';
    case 'invite-team-member':
      return '/v1/admin/governance/team/invitations';
    case 'preview-permission-impact':
      return '/v1/admin/governance/impact';
    case 'switch-function':
      return '/v1/admin/governance/functions/switch';
    case 'create-delegation':
      return '/v1/admin/governance/delegations';
    case 'review-access':
      return '/v1/admin/governance/reviews';
    case 'request-approval':
      return '/v1/admin/governance/approvals';
    case 'governance-break-glass':
      return '/v1/admin/governance/break-glass';
    case 'export-data':
      return '/v1/admin/operations/exports';
    case 'emergency-stop':
      return '/v1/admin/operations/emergency-stops';
    case 'resend-invitation':
      return target === null ? null : `/v1/admin/invitations/${target}/resend`;
    case 'revoke-invitation':
      return target === null ? null : `/v1/admin/invitations/${target}/revoke`;
    case 'offboard-member':
      return '/v1/admin/governance/offboard';
    case 'activate-member':
      return '/v1/admin/governance/activate';
    case 'approve-request':
      return target === null ? null : `/v1/admin/governance/approvals/${target}/approve`;
    case 'cancel-request':
      return target === null ? null : `/v1/admin/governance/approvals/${target}/cancel`;
    case 'reassign-request':
      return target === null ? null : `/v1/admin/governance/approvals/${target}/reassign`;
    case 'transition-job':
      return target === null ? null : `/v1/admin/operations/jobs/${target}/transitions`;
    case 'resolve-conflict':
      return target === null ? null : `/v1/admin/operations/conflicts/${target}/resolve`;
    case 'recover-incident':
      return target === null ? null : `/v1/admin/operations/incidents/${target}/recover`;
    case 'transition-configuration':
      return target === null ? null : `/v1/admin/operations/configurations/${target}/transitions`;
    case 'execute-privacy':
      return target === null ? null : `/v1/admin/operations/privacy-cases/${target}/execute`;
  }
};

const admitInvalidation = (value: unknown): AdminFreshnessInvalidation | null => {
  if (
    !isRecord(value) ||
    !boundedToken(value['cursor']) ||
    !boundedToken(value['version']) ||
    typeof value['updatedAt'] !== 'string' ||
    Number.isNaN(Date.parse(value['updatedAt'])) ||
    !Array.isArray(value['resources']) ||
    value['resources'].length === 0 ||
    value['resources'].length > 32 ||
    !value['resources'].every(boundedToken)
  ) {
    return null;
  }
  return Object.freeze({
    cursor: value['cursor'],
    resources: Object.freeze([...value['resources']]),
    updatedAt: value['updatedAt'],
    version: value['version'],
  });
};

const parseInvalidationEvent = (payload: string): AdminFreshnessInvalidation | null => {
  const data = payload
    .split(/\r?\n/gu)
    .find((line) => line.startsWith('data: '))
    ?.slice('data: '.length);
  if (data === undefined) return null;
  try {
    return admitInvalidation(JSON.parse(data));
  } catch {
    return null;
  }
};

export const createAdminAuthority = ({
  baseUrl = '',
  clock = () => new Date().toISOString(),
  commandId = () => globalThis.crypto.randomUUID(),
  correlationId,
  csrfToken,
  reconnectDelayMs = 1_000,
  subscribeToConsent,
  transport = globalThis.fetch.bind(globalThis),
}: CreateAdminAuthorityOptions): AdminAuthority => {
  let activeSession: AdminSessionProjection | null = null;
  let activeCsrfToken: string | null = null;

  const headers = (
    correlation: string,
    token = activeCsrfToken ?? csrfToken(),
  ): Record<string, string> => ({
    accept: 'application/json',
    'cache-control': 'no-store',
    'x-correlation-id': correlation,
    'x-csrf-token': token,
  });

  const requestCsrfToken = async (correlation: string): Promise<string | null> => {
    const response = await transport(`${baseUrl}/v1/identity/csrf`, {
      credentials: 'include',
      headers: { accept: 'application/json', 'x-correlation-id': correlation },
      method: 'GET',
    });
    const body = await safeJson(response);
    const token = isRecord(body) ? body['token'] : undefined;
    if (!response.ok || !validCsrfToken(token)) return null;
    activeCsrfToken = token;
    return token;
  };

  const ensureCsrfToken = async (correlation: string): Promise<string | null> => {
    if (validCsrfToken(activeCsrfToken)) return activeCsrfToken;
    const supplied = csrfToken();
    if (validCsrfToken(supplied)) {
      activeCsrfToken = supplied;
      return supplied;
    }
    return requestCsrfToken(correlation);
  };

  const readSession = async (): Promise<AdminSessionProjection | null> => {
    try {
      const response = await transport(`${baseUrl}/v1/admin/session`, {
        cache: 'no-store',
        credentials: 'include',
        headers: headers(correlationId()),
        method: 'GET',
      });
      if (!response.ok || !cachePolicyIsPrivate(response)) return null;
      const session = admitSession(await safeJson(response));
      activeSession = session;
      return session;
    } catch {
      return null;
    }
  };

  const readStrongAuthStatus = async (): Promise<boolean | null> => {
    try {
      const response = await transport(`${baseUrl}/v1/identity/strong-auth/status`, {
        cache: 'no-store',
        credentials: 'include',
        headers: headers(correlationId()),
        method: 'GET',
      });
      if (!response.ok || !cachePolicyIsPrivate(response)) return null;
      return admitStrongAuthStatus(await safeJson(response));
    } catch {
      return null;
    }
  };

  const readAccess = async (): Promise<AdminAccessProjection | null> => {
    const session = await readSession();
    if (session !== null) return session;
    return (await readStrongAuthStatus()) === false
      ? Object.freeze({ kind: 'enrollment-required' as const })
      : null;
  };

  const requestStepUp = async (
    input: AdminStepUpBinding & Readonly<{ code: string }>,
  ): Promise<AdminStepUp | null> => {
    if (
      !/^\d{6}$/u.test(input.code) ||
      !boundedToken(input.action) ||
      !boundedToken(input.authorizationContextId) ||
      !boundedToken(input.resource) ||
      input.redactedTarget.length < 1 ||
      input.redactedTarget.length > 256
    )
      return null;
    try {
      const correlation = correlationId();
      const token = await ensureCsrfToken(correlation);
      if (token === null) return null;
      const binding: AdminStepUpBinding = {
        action: input.action,
        authorizationContextId: input.authorizationContextId,
        redactedTarget: input.redactedTarget,
        resource: input.resource,
      };
      const response = await transport(`${baseUrl}/v1/identity/strong-auth/step-up`, {
        body: JSON.stringify({ ...binding, code: input.code }),
        cache: 'no-store',
        credentials: 'include',
        headers: { ...headers(correlation, token), 'content-type': 'application/json' },
        method: 'POST',
      });
      return response.ok ? admitStepUp(await safeJson(response), binding) : null;
    } catch {
      return null;
    }
  };

  const GOVERNANCE_MUTATIONS = new Set<AdminMutationFamily>([
    'invite-team-member',
    'preview-permission-impact',
    'switch-function',
    'offboard-member',
    'activate-member',
    'create-delegation',
    'review-access',
    'request-approval',
    'approve-request',
    'cancel-request',
    'reassign-request',
    'governance-break-glass',
  ]);

  const OPERATIONS_MUTATIONS = new Set<AdminMutationFamily>([
    'transition-job',
    'resolve-conflict',
    'recover-incident',
    'export-data',
    'transition-configuration',
    'execute-privacy',
    'emergency-stop',
  ]);

  const mutationPayload = async (
    input: AdminMutationInput,
    correlation: string,
  ): Promise<Readonly<Record<string, unknown>> | null> => {
    if (!GOVERNANCE_MUTATIONS.has(input.family) && !OPERATIONS_MUTATIONS.has(input.family)) {
      return input.payload;
    }
    const operationRequiresCommand =
      input.family === 'recover-incident' ||
      input.family === 'export-data' ||
      input.family === 'transition-configuration' ||
      input.family === 'execute-privacy';
    if (OPERATIONS_MUTATIONS.has(input.family) && !operationRequiresCommand) {
      return Object.freeze({
        ...input.payload,
        commandId: input.idempotencyKey || commandId(),
        correlationId: correlation,
        idempotencyKey: input.idempotencyKey,
        expectedVersion: input.expectedVersion ?? '1',
        reason: input.reason?.trim() ?? 'Reviewed bounded administrative operation',
      });
    }
    const session = activeSession ?? (await readSession());
    if (session === null) return null;
    const candidates =
      input.family === 'switch-function'
        ? [session.sessionId]
        : [
            input.targetId,
            input.payload['identityId'],
            input.payload['requestId'],
            input.payload['invitationId'],
            input.payload['delegationId'],
            input.payload['targetReference'],
            session.actorId,
          ];
    const target = candidates.find(boundedToken);
    if (target === undefined) return null;
    const expectedVersion = input.expectedVersion ?? '1';
    const expectedEtag = input.expectedEtag ?? `admin-${target}-v${expectedVersion}`;
    if (OPERATIONS_MUTATIONS.has(input.family)) {
      const reason = input.reason?.trim() ?? 'Reviewed bounded administrative operation';
      const base = Object.freeze({
        ...input.payload,
        commandId: input.idempotencyKey || commandId(),
        correlationId: correlation,
        idempotencyKey: input.idempotencyKey,
        expectedVersion,
        reason,
      });
      const commandAction =
        input.family === 'recover-incident'
          ? 'resolve-incident'
          : input.family === 'transition-configuration'
            ? input.payload['transition'] === 'rollback'
              ? 'rollback-configuration'
              : 'publish-configuration'
            : input.family === 'execute-privacy'
              ? 'execute-privacy-case'
              : input.family === 'export-data'
                ? 'export-sensitive-data'
                : null;
      if (commandAction === null) return base;
      return Object.freeze({
        ...base,
        command: {
          schemaVersion: '1.0',
          kind: 'admin-operation-command',
          commandId: input.idempotencyKey || commandId(),
          actorId: session.actorId,
          activeFunction: session.role,
          action: commandAction,
          targetReferences: [target],
          reason,
          expectedVersion,
          expectedEtag,
          approvalReferences: input.approvalReferences ?? [],
          correlationId: correlation,
          requestedAt: clock(),
        },
      });
    }
    const action =
      input.family === 'request-approval' ||
      input.family === 'approve-request' ||
      input.family === 'cancel-request' ||
      input.family === 'reassign-request' ||
      input.family === 'governance-break-glass'
        ? 'request-approval'
        : 'update-access';
    return Object.freeze({
      ...input.payload,
      command: {
        schemaVersion: '1.0',
        kind: 'admin-operation-command',
        commandId: input.idempotencyKey || commandId(),
        actorId: session.actorId,
        activeFunction: session.role,
        action,
        targetReferences: [target],
        reason: input.reason?.trim() ?? 'Reviewed administrative governance transition',
        expectedVersion,
        expectedEtag,
        approvalReferences: input.approvalReferences ?? [],
        correlationId: correlation,
        requestedAt: clock(),
      },
    });
  };

  return Object.freeze({
    async beginTotpEnrollment(): Promise<AdminTotpEnrollment | null> {
      try {
        const correlation = correlationId();
        const token = await ensureCsrfToken(correlation);
        if (token === null) return null;
        const response = await transport(`${baseUrl}/v1/identity/strong-auth/totp/enrollment`, {
          cache: 'no-store',
          credentials: 'include',
          headers: headers(correlation, token),
          method: 'POST',
        });
        return response.ok && cachePolicyIsPrivate(response)
          ? admitTotpEnrollment(await safeJson(response))
          : null;
      } catch {
        return null;
      }
    },

    async confirmTotpEnrollment(input: Readonly<{ code: string; enrollmentToken: string }>) {
      if (!/^\d{6}$/u.test(input.code) || input.enrollmentToken.length < 32) return null;
      try {
        const correlation = correlationId();
        const token = await ensureCsrfToken(correlation);
        if (token === null) return null;
        const response = await transport(`${baseUrl}/v1/identity/strong-auth/totp/confirm`, {
          body: JSON.stringify(input),
          cache: 'no-store',
          credentials: 'include',
          headers: { ...headers(correlation, token), 'content-type': 'application/json' },
          method: 'POST',
        });
        if (!response.ok) return null;
        return await readSession();
      } catch {
        return null;
      }
    },

    async loadInvitation(
      input: Readonly<{ invitationId: string; signal?: AbortSignal }>,
    ): Promise<AdminInvitationDetailResult> {
      if (!boundedToken(input.invitationId)) {
        return { code: 'invalid-authority', status: 'error' };
      }
      try {
        const response = await transport(
          `${baseUrl}/v1/admin/invitations/${encodeURIComponent(input.invitationId)}`,
          {
            cache: 'no-store',
            credentials: 'include',
            headers: headers(correlationId()),
            method: 'GET',
            ...(input.signal === undefined ? {} : { signal: input.signal }),
          },
        );
        if ([401, 403, 404].includes(response.status)) {
          return { code: 'unauthorized', status: 'denied' };
        }
        if (!response.ok || !cachePolicyIsPrivate(response)) {
          return { code: 'unavailable', status: 'error' };
        }
        const detail = admitInvitationDetail(await safeJson(response));
        return detail ?? { code: 'invalid-authority', status: 'error' };
      } catch {
        return { code: 'unavailable', status: 'error' };
      }
    },

    async query(family: AdminQueryFamily, options: AdminQueryOptions): Promise<AdminQueryResult> {
      try {
        const parameters = new URLSearchParams();
        if (family === 'search' && options.query?.trim()) {
          parameters.set('q', options.query.trim().slice(0, 128));
        }
        if (OPERATION_QUERY_FAMILIES.has(family)) {
          parameters.set('environment', options.environment);
        }
        parameters.set('limit', String(Math.min(100, Math.max(1, options.limit ?? 50))));
        if (options.cursor !== undefined && boundedToken(options.cursor)) {
          parameters.set('cursor', options.cursor);
        }
        const response = await transport(`${baseUrl}${QUERY_PATHS[family]}?${parameters}`, {
          cache: 'no-store',
          credentials: 'include',
          headers: headers(correlationId()),
          method: 'GET',
          ...(options.signal === undefined ? {} : { signal: options.signal }),
        });
        if ([401, 403, 404].includes(response.status)) {
          return { code: 'unauthorized', records: [], status: 'denied' };
        }
        if (response.status === 429) {
          return { code: 'rate-limit', records: [], status: 'error' };
        }
        if (!response.ok || !cachePolicyIsPrivate(response)) {
          return { code: 'unavailable', records: [], status: 'error' };
        }
        const body = await safeJson(response);
        if (!isRecord(body)) {
          return { code: 'invalid-authority', records: [], status: 'error' };
        }
        const candidateRecords = Array.isArray(body['records']) ? body['records'] : [body];
        const records = candidateRecords.map(admitAdminDocument);
        if (records.some((record) => record === null)) {
          return { code: 'invalid-authority', records: [], status: 'error' };
        }
        const freshness =
          body['freshness'] === undefined ? undefined : admitFreshness(body['freshness']);
        if (body['freshness'] !== undefined && freshness === null) {
          return { code: 'invalid-authority', records: [], status: 'error' };
        }
        const nextCursor = body['nextCursor'];
        if (nextCursor !== undefined && nextCursor !== null && !boundedToken(nextCursor)) {
          return { code: 'invalid-authority', records: [], status: 'error' };
        }
        return Object.freeze({
          ...(freshness === undefined || freshness === null ? {} : { freshness }),
          nextCursor: typeof nextCursor === 'string' ? nextCursor : null,
          records: Object.freeze(records as AdminAuthorityDocument[]),
          status: 'online',
        });
      } catch {
        return { code: 'unavailable', records: [], status: 'error' };
      }
    },

    async mutate(input: AdminMutationInput): Promise<AdminMutationResult> {
      const path = mutationPath(input);
      if (
        path === null ||
        !boundedToken(input.idempotencyKey) ||
        (input.expectedVersion !== undefined && !boundedToken(input.expectedVersion)) ||
        (input.expectedEtag !== undefined && !boundedToken(input.expectedEtag)) ||
        (input.stepUp !== undefined &&
          (!boundedToken(input.stepUp.receipt) ||
            !boundedToken(input.stepUp.authorizationContextId) ||
            !boundedToken(input.stepUp.action) ||
            !boundedToken(input.stepUp.resource) ||
            input.stepUp.redactedTarget.length > 256)) ||
        (input.reason !== undefined &&
          (input.reason.trim().length < 8 || input.reason.trim().length > 256)) ||
        (input.approvalReferences?.some((reference) => !boundedToken(reference)) ?? false)
      ) {
        return { code: 'invalid-authority', status: 'error' };
      }
      try {
        const correlation = correlationId();
        const token = await ensureCsrfToken(correlation);
        if (token === null) return { code: 'unavailable', status: 'error' };
        const payload = await mutationPayload(input, correlation);
        if (payload === null) return { code: 'unauthorized', status: 'denied' };
        const response = await transport(`${baseUrl}${path}`, {
          body: JSON.stringify({
            ...payload,
            ...(input.stepUp === undefined
              ? {}
              : {
                  authorizationContextId: input.stepUp.authorizationContextId,
                  stepUpEvidence: {
                    action: input.stepUp.action,
                    authorizationContextId: input.stepUp.authorizationContextId,
                    receipt: input.stepUp.receipt,
                    redactedTarget: input.stepUp.redactedTarget,
                    resource: input.stepUp.resource,
                  },
                }),
            ...(input.approvalReferences === undefined
              ? {}
              : { approvalReferences: input.approvalReferences }),
            ...(input.expectedEtag === undefined ? {} : { expectedEtag: input.expectedEtag }),
            ...(input.expectedVersion === undefined
              ? {}
              : { expectedVersion: input.expectedVersion }),
            ...(input.reason === undefined ? {} : { reason: input.reason.trim() }),
          }),
          cache: 'no-store',
          credentials: 'include',
          headers: {
            ...headers(correlation, token),
            'content-type': 'application/json',
            'x-idempotency-key': input.idempotencyKey,
            ...(input.expectedEtag === undefined ? {} : { 'if-match': input.expectedEtag }),
            ...(input.expectedVersion === undefined
              ? {}
              : { 'x-expected-version': input.expectedVersion }),
            ...(input.stepUp === undefined
              ? {}
              : {
                  'x-liiiraa-admin-step-up': input.stepUp.receipt,
                  'x-admin-authorization-context': input.stepUp.authorizationContextId,
                  'x-admin-step-up-action': input.stepUp.action,
                  'x-admin-step-up-resource': input.stepUp.resource,
                  'x-admin-step-up-target': input.stepUp.redactedTarget,
                }),
          },
          method: 'POST',
          ...(input.signal === undefined ? {} : { signal: input.signal }),
        });
        const body = await safeJson(response);
        if ([401, 403, 404].includes(response.status)) {
          return { code: 'unauthorized', status: 'denied' };
        }
        if (response.status === 409) {
          const document = extractAdminDocument(body);
          return document === null
            ? { code: 'conflict', status: 'conflict' }
            : { code: 'conflict', document, status: 'conflict' };
        }
        if (response.status === 429) return { code: 'rate-limit', status: 'error' };
        if (response.status === 503) return { code: 'degraded', status: 'error' };
        if (input.family === 'preflight-invitations' && response.ok) {
          const preflight = admitInvitationPreflight(body);
          return preflight === null
            ? { code: 'invalid-authority', status: 'error' }
            : { preflight, status: 'complete' };
        }
        if (input.family === 'export-data' && response.ok) {
          const receipt = admitSensitiveExportReceipt(body);
          return receipt === null
            ? { code: 'invalid-authority', status: 'error' }
            : { receipt, status: 'complete' };
        }
        const document = extractAdminDocument(body);
        if ((!response.ok && response.status !== 207) || document === null) {
          return { code: 'invalid-authority', status: 'error' };
        }
        return {
          document,
          status: response.status === 207 ? 'partial' : 'complete',
        };
      } catch {
        return { code: 'unavailable', status: 'error' };
      }
    },

    openFreshness(input: AdminFreshnessInput): AdminFreshnessLifecycle {
      const controller = new AbortController();
      let resolveSettled = (): void => undefined;
      const settled = new Promise<void>((resolve) => {
        resolveSettled = resolve;
      });
      let cursor = input.cursor;
      let hasLiveAuthority = false;

      const stop = (): void => {
        if (!controller.signal.aborted) controller.abort();
      };
      const isStopped = (): boolean => controller.signal.aborted;
      if (input.signal !== undefined) {
        if (input.signal.aborted) stop();
        else input.signal.addEventListener('abort', stop, { once: true });
      }

      void (async () => {
        try {
          while (!isStopped()) {
            if (!hasLiveAuthority) input.onState('reconnecting');
            const parameters = new URLSearchParams({ environment: input.environment });
            if (cursor !== undefined && boundedToken(cursor)) parameters.set('cursor', cursor);
            try {
              const response = await transport(
                `${baseUrl}/v1/admin/operations/live?${parameters}`,
                {
                  cache: 'no-store',
                  credentials: 'include',
                  headers: headers(correlationId()),
                  method: 'GET',
                  signal: controller.signal,
                },
              );
              if ([401, 403, 404].includes(response.status)) {
                input.onState('offline');
                stop();
                continue;
              }
              if (
                !response.ok ||
                !cachePolicyIsPrivate(response) ||
                !response.headers.get('content-type')?.includes('text/event-stream')
              ) {
                hasLiveAuthority = false;
                input.onState('degraded');
              } else {
                const event = parseInvalidationEvent(await response.text());
                if (event === null) {
                  hasLiveAuthority = false;
                  input.onState('degraded');
                } else {
                  const isNewInvalidation = event.cursor !== cursor;
                  cursor = event.cursor;
                  if (isNewInvalidation) {
                    input.onInvalidate(event);
                    await input.refetch(event.resources, controller.signal);
                  }
                  hasLiveAuthority = true;
                  input.onState('live');
                }
              }
            } catch {
              if (!isStopped()) {
                hasLiveAuthority = false;
                input.onState('degraded');
              }
            }
            if (!isStopped()) {
              await new Promise<void>((resolve) => {
                setTimeout(resolve, Math.max(0, reconnectDelayMs));
              });
            }
          }
        } finally {
          resolveSettled();
        }
      })();

      return Object.freeze({ settled, signal: controller.signal, stop });
    },

    async signIn(input: Readonly<{ email: string; password: string }>) {
      try {
        const correlation = correlationId();
        const token = await requestCsrfToken(correlation);
        if (token === null) return null;

        const response = await transport(`${baseUrl}/v1/identity/sign-in`, {
          body: JSON.stringify({
            email: input.email.trim().toLowerCase(),
            password: input.password,
          }),
          credentials: 'include',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            'x-correlation-id': correlationId(),
            'x-csrf-token': token,
          },
          method: 'POST',
        });
        if (!response.ok) return null;
        const signedIn = admitSignedInSession(await safeJson(response));
        if (signedIn === null) return null;
        const strongAuthEnabled = await readStrongAuthStatus();
        if (strongAuthEnabled === false) {
          activeSession = null;
          return Object.freeze({ kind: 'enrollment-required' as const });
        }
        return strongAuthEnabled === true ? await readSession() : null;
      } catch {
        return null;
      }
    },

    async signOut(): Promise<boolean> {
      try {
        const correlation = correlationId();
        const token = await ensureCsrfToken(correlation);
        if (token === null) return false;
        const response = await transport(`${baseUrl}/v1/identity/sign-out`, {
          credentials: 'include',
          headers: headers(correlation, token),
          method: 'POST',
        });
        if (!response.ok) return false;
        activeSession = null;
        activeCsrfToken = null;
        return true;
      } catch {
        return false;
      }
    },

    session: readAccess,

    async verifyStepUp(input: AdminStepUpBinding & Readonly<{ code: string }>) {
      return requestStepUp(input);
    },

    async verifyMutationStepUp(input: AdminMutationInput & Readonly<{ code: string }>) {
      const correlation = correlationId();
      const payload = await mutationPayload(input, correlation);
      const commandCandidate = payload?.['command'];
      const command = isRecord(commandCandidate) ? commandCandidate : null;
      const targetReferences = command?.['targetReferences'];
      const action = command?.['action'];
      const targets: readonly unknown[] = Array.isArray(targetReferences) ? targetReferences : [];
      const redactedTarget = targets[0];
      const path = mutationPath(input);
      if (path === null || !boundedToken(action) || !boundedToken(redactedTarget)) return null;
      const requestedContext = payload?.['authorizationContextId'];
      const functionSwitch = input.family === 'switch-function';
      return await requestStepUp({
        action: functionSwitch ? 'admin.function.switch' : action,
        authorizationContextId: boundedToken(requestedContext)
          ? requestedContext
          : input.idempotencyKey,
        code: input.code,
        redactedTarget,
        resource: functionSwitch
          ? 'admin-session'
          : path.includes('/approvals')
            ? 'approvals'
            : 'governance',
      });
    },

    async list(collection: AdminProjectionCollection): Promise<AdminAuthorityListResult> {
      const session = activeSession ?? (await readSession());
      if (session === null) return { code: 'unauthorized', records: [], status: 'denied' };
      try {
        const response = await transport(`${baseUrl}/v1/admin/${collection}`, {
          cache: 'no-store',
          credentials: 'include',
          headers: headers(correlationId()),
          method: 'GET',
        });
        if (response.status === 401 || response.status === 403 || response.status === 404) {
          return { code: 'unauthorized', records: [], status: 'denied' };
        }
        if (!response.ok || !cachePolicyIsPrivate(response)) {
          return { code: 'unavailable', records: [], status: 'error' };
        }
        const body = await safeJson(response);
        if (!isRecord(body) || !Array.isArray(body['records'])) {
          return { code: 'invalid-authority', records: [], status: 'error' };
        }
        const records = body['records'].map(admitRecord);
        if (records.some((record) => record === null)) {
          return { code: 'invalid-authority', records: [], status: 'error' };
        }
        return {
          records: Object.freeze(records as AdminProjectionRecord[]),
          role: session.role,
          status: 'online',
        };
      } catch {
        return { code: 'unavailable', records: [], status: 'error' };
      }
    },

    async execute(input: AdminCommandInput): Promise<AdminCommandResult> {
      const reason = input.reason.trim();
      if (
        input.stepUp === null ||
        !TOKEN.test(input.stepUp.authorizationContextId) ||
        !boundedToken(input.stepUp.receipt) ||
        input.stepUp.action !== input.action ||
        input.stepUp.redactedTarget !== input.redactedTarget ||
        Number.isNaN(Date.parse(input.stepUp.verifiedAt)) ||
        Number.isNaN(Date.parse(input.stepUp.expiresAt)) ||
        Date.parse(input.stepUp.expiresAt) <= Date.parse(clock())
      ) {
        return { code: 'step-up-required', status: 'denied' };
      }
      if (!input.impactReviewed || !input.confirmed || reason.length < 8 || reason.length > 256) {
        return { code: 'review-required', status: 'denied' };
      }
      const correlation = correlationId();
      const command: AdminCommandJson = {
        schemaVersion: '1.0',
        kind: 'admin-command',
        commandId: commandId(),
        actorId: input.actorId,
        assumedRole: input.assumedRole,
        action: input.action,
        redactedTarget: input.redactedTarget,
        reason,
        authorizationContextId: input.stepUp.authorizationContextId,
        expectedVersion: input.expectedVersion,
        correlationId: correlation,
        requestedAt: clock(),
      };
      if (!controlPlaneDocumentValidator(command)) {
        return { code: 'invalid-authority', status: 'error' };
      }
      try {
        const response = await transport(`${baseUrl}/v1/admin/commands`, {
          body: JSON.stringify({
            command,
            confirmed: true,
            impactReviewed: true,
            stepUpEvidence: {
              action: input.stepUp.action,
              authorizationContextId: input.stepUp.authorizationContextId,
              receipt: input.stepUp.receipt,
              redactedTarget: input.stepUp.redactedTarget,
              resource: input.stepUp.resource,
            },
          }),
          cache: 'no-store',
          credentials: 'include',
          headers: {
            ...headers(correlation),
            'content-type': 'application/json',
            'x-liiiraa-admin-step-up': input.stepUp.receipt,
            'x-admin-authorization-context': input.stepUp.authorizationContextId,
            'x-admin-step-up-action': input.stepUp.action,
            'x-admin-step-up-resource': input.stepUp.resource,
            'x-admin-step-up-target': input.stepUp.redactedTarget,
          },
          method: 'POST',
        });
        if (response.status === 401 || response.status === 403) {
          return { code: 'unauthorized', status: 'denied' };
        }
        const body = await safeJson(response);
        if (!response.ok || !isGenerated(body, 'authority-receipt')) {
          return { code: 'invalid-authority', status: 'error' };
        }
        return { receipt: body as AuthorityReceiptJson, status: 'complete' };
      } catch {
        return { code: 'unavailable', status: 'error' };
      }
    },

    async breakGlass(input: Parameters<AdminAuthority['breakGlass']>[0]) {
      const reason = input.reason.trim();
      if (
        reason.length < 8 ||
        reason.length > 256 ||
        !TOKEN.test(input.targetReference) ||
        !TOKEN.test(input.stepUp.authorizationContextId) ||
        !boundedToken(input.stepUp.receipt)
      ) {
        return { code: 'invalid-authority', status: 'error' } as const;
      }
      try {
        const response = await transport(`${baseUrl}/v1/admin/break-glass/metadata`, {
          body: JSON.stringify({
            expiresAt: input.expiresAt,
            reason,
            stepUpEvidence: {
              action: input.stepUp.action,
              authorizationContextId: input.stepUp.authorizationContextId,
              receipt: input.stepUp.receipt,
              redactedTarget: input.stepUp.redactedTarget,
              resource: input.stepUp.resource,
            },
            targetReference: input.targetReference,
          }),
          cache: 'no-store',
          credentials: 'include',
          headers: {
            ...headers(correlationId()),
            'content-type': 'application/json',
            'x-liiiraa-admin-step-up': input.stepUp.receipt,
            'x-admin-authorization-context': input.stepUp.authorizationContextId,
            'x-admin-step-up-action': input.stepUp.action,
            'x-admin-step-up-resource': input.stepUp.resource,
            'x-admin-step-up-target': input.stepUp.redactedTarget,
          },
          method: 'POST',
        });
        if (response.status === 401 || response.status === 403) {
          return { code: 'unauthorized', status: 'denied' } as const;
        }
        const metadata = admitBreakGlass(await safeJson(response));
        return response.ok && metadata !== null
          ? ({ metadata, status: 'complete' } as const)
          : ({ code: 'invalid-authority', status: 'error' } as const);
      } catch {
        return { code: 'unavailable', status: 'error' } as const;
      }
    },

    async openDiagnostic(
      input: Parameters<AdminAuthority['openDiagnostic']>[0],
    ): Promise<AdminDiagnosticLifecycle> {
      const controller = new AbortController();
      let resolveSettled = (): void => undefined;
      const settled = new Promise<void>((resolve) => {
        resolveSettled = resolve;
      });
      let unsubscribe = (): void => undefined;
      let closed = false;

      const close = (
        reason?: AdminDiagnosticClearReason,
        auditEvents: readonly AuditEventJson[] = [],
      ): void => {
        if (closed) return;
        closed = true;
        unsubscribe();
        controller.abort(reason);
        if (reason !== undefined) input.onClear({ auditEvents, reason });
        resolveSettled();
      };

      const refresh = async (): Promise<void> => {
        if (closed) return;
        try {
          const response = await transport(
            `${baseUrl}/v1/admin/diagnostic-metadata/${encodeURIComponent(input.diagnosticId)}`,
            {
              cache: 'no-store',
              credentials: 'include',
              headers: headers(correlationId()),
              method: 'GET',
              signal: controller.signal,
            },
          );
          if ([401, 403, 404, 410].includes(response.status)) {
            const body = await safeJson(response);
            const admitted = admitDiagnostic(body);
            close('unauthorized', admitted?.auditEvents ?? []);
            return;
          }
          const projection = admitDiagnostic(await safeJson(response));
          if (!response.ok || !cachePolicyIsPrivate(response) || projection === null) {
            close('invalid');
            return;
          }
          const revoked = reasonForConsent(projection.consent);
          if (revoked !== null) {
            close(revoked, projection.auditEvents);
            return;
          }
          input.onProjection(projection);
        } catch {
          if (!controller.signal.aborted) close('invalid');
        }
      };

      if (input.signal !== undefined) {
        if (input.signal.aborted) close();
        else
          input.signal.addEventListener(
            'abort',
            () => {
              close();
            },
            { once: true },
          );
      }
      await refresh();
      if (!controller.signal.aborted && subscribeToConsent !== undefined) {
        unsubscribe = subscribeToConsent(() => {
          void refresh();
        });
      }
      return Object.freeze({
        settled,
        signal: controller.signal,
        stop: () => {
          close();
        },
      });
    },
  });
};
