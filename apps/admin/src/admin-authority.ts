import {
  controlPlaneDocumentValidator,
  type AdminActionJson,
  type AdminCommandJson,
  type AdminRoleJson,
  type AuditEventJson,
  type AuthorityReceiptJson,
  type DiagnosticConsentJson,
} from '@liiiraa/contracts-ts';

export const ADMIN_PROJECTION_RESOURCES = Object.freeze([
  'support-cases',
  'devices',
  'entitlements',
  'sessions',
  'diagnostic-metadata',
  'audit-events',
] as const);

export type AdminProjectionCollection = (typeof ADMIN_PROJECTION_RESOURCES)[number];

export type AdminSessionProjection = Readonly<{
  actorId: string;
  expiresAt: string;
  role: AdminRoleJson;
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
  authorizationContextId: string;
  verifiedAt: string;
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
  session(): Promise<AdminSessionProjection | null>;
  list(collection: AdminProjectionCollection): Promise<AdminAuthorityListResult>;
  execute(input: AdminCommandInput): Promise<AdminCommandResult>;
  breakGlass(input: Readonly<{
    expiresAt: string;
    reason: string;
    stepUp: AdminStepUp;
    targetReference: string;
  }>): Promise<
    | Readonly<{ metadata: BreakGlassMetadata; status: 'complete' }>
    | Readonly<{ code: 'invalid-authority' | 'unauthorized' | 'unavailable'; status: 'denied' | 'error' }>
  >;
  openDiagnostic(input: Readonly<{
    diagnosticId: string;
    onClear: (result: Readonly<{
      auditEvents: readonly AuditEventJson[];
      reason: AdminDiagnosticClearReason;
    }>) => void;
    onProjection: (projection: AdminDiagnosticProjection) => void;
    signal?: AbortSignal;
  }>): Promise<AdminDiagnosticLifecycle>;
}

export interface CreateAdminAuthorityOptions {
  readonly baseUrl?: string;
  readonly clock?: () => string;
  readonly commandId?: () => string;
  readonly correlationId: () => string;
  readonly csrfToken: () => string;
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
    !isRole(value['role']) ||
    typeof value['expiresAt'] !== 'string' ||
    Number.isNaN(Date.parse(value['expiresAt']))
  ) {
    return null;
  }
  return Object.freeze({
    actorId: value['actorId'],
    expiresAt: value['expiresAt'],
    role: value['role'],
  });
};

const admitRecord = (value: unknown): AdminProjectionRecord | null => {
  if (!isRecord(value) || typeof value['id'] !== 'string' || !TOKEN.test(value['id'])) return null;
  if (
    (value['redactedTarget'] !== undefined &&
      (typeof value['redactedTarget'] !== 'string' || !REDACTED_TEXT.test(value['redactedTarget']))) ||
    (value['summary'] !== undefined &&
      (typeof value['summary'] !== 'string' || !REDACTED_TEXT.test(value['summary'])))
  ) {
    return null;
  }
  return Object.freeze({ ...value, id: value['id'] });
};

const isGenerated = <Kind extends string>(value: unknown, kind: Kind): boolean =>
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
  return Object.freeze({ ...value }) as BreakGlassMetadata;
};

export const createAdminAuthority = ({
  baseUrl = '',
  clock = () => new Date().toISOString(),
  commandId = () => globalThis.crypto.randomUUID(),
  correlationId,
  csrfToken,
  subscribeToConsent,
  transport = globalThis.fetch.bind(globalThis),
}: CreateAdminAuthorityOptions): AdminAuthority => {
  let activeSession: AdminSessionProjection | null = null;

  const headers = (correlation: string): Record<string, string> => ({
    accept: 'application/json',
    'cache-control': 'no-store',
    'x-correlation-id': correlation,
    'x-csrf-token': csrfToken(),
  });

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

  return Object.freeze({
    session: readSession,

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
        Number.isNaN(Date.parse(input.stepUp.verifiedAt)) ||
        Date.parse(clock()) - Date.parse(input.stepUp.verifiedAt) > 5 * 60_000
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
          body: JSON.stringify({ command, confirmed: true, impactReviewed: true }),
          cache: 'no-store',
          credentials: 'include',
          headers: {
            ...headers(correlation),
            'content-type': 'application/json',
            'x-liiiraa-admin-step-up': input.stepUp.authorizationContextId,
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
        !TOKEN.test(input.stepUp.authorizationContextId)
      ) {
        return { code: 'invalid-authority', status: 'error' } as const;
      }
      try {
        const response = await transport(`${baseUrl}/v1/admin/break-glass/metadata`, {
          body: JSON.stringify({
            expiresAt: input.expiresAt,
            reason,
            targetReference: input.targetReference,
          }),
          cache: 'no-store',
          credentials: 'include',
          headers: {
            ...headers(correlationId()),
            'content-type': 'application/json',
            'x-liiiraa-admin-step-up': input.stepUp.authorizationContextId,
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

    async openDiagnostic(input: Parameters<AdminAuthority['openDiagnostic']>[0]): Promise<AdminDiagnosticLifecycle> {
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
        else input.signal.addEventListener('abort', () => close(), { once: true });
      }
      await refresh();
      if (!closed && subscribeToConsent !== undefined) {
        unsubscribe = subscribeToConsent(() => {
          void refresh();
        });
      }
      return Object.freeze({ settled, signal: controller.signal, stop: () => close() });
    },
  });
};
