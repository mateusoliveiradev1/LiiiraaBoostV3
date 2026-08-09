import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import type {
  AccountDeletionState,
  ActiveAdminRoleSession,
  AdminCommandDependencies,
  AdminGovernanceCapability,
  AdminGovernanceDependencies,
  AdminGovernanceStepUpEvidence,
  AdminInvitationDependencies,
  AdminOperationsCapability,
  AdminOperationsDependencies,
  AdminProjectionResource,
  AdminRoleAuthorityDependencies,
  DeviceBindingRecord,
  SubscriptionState,
  SupportCaseState,
} from '@liiiraa/control-plane-application';
import type {
  DeviceBindingProjectionJson,
  SubscriptionProjectionJson,
} from '@liiiraa/contracts-ts';
import { controlPlaneDocumentValidator } from '@liiiraa/contracts-ts';
import {
  createPostgresCommerceAuthorityRepository,
  createPostgresDeviceBindingRepository,
  createPostgresSubscriptionManagementRepository,
  createPostgresSupportLifecycleRepository,
  createStripeCommerceProvider,
  listRuntimeAuthority,
  projectRuntimeAggregate,
  verifyRawWebhook,
} from '@liiiraa/control-plane-adapters/runtime-control-plane';
import {
  createPostgresAdminGovernanceRepository,
  migrateAdminGovernance,
} from '@liiiraa/control-plane-adapters/postgres/admin-governance';
import {
  createPostgresAdminInvitationRepository,
  migrateAdminInvitations,
} from '@liiiraa/control-plane-adapters/postgres/admin-invitations';
import {
  createPostgresAdminOperationsRepository,
  migrateAdminOperations,
} from '@liiiraa/control-plane-adapters/postgres/admin-operations';
import {
  createControlPlaneDatabase,
  createPostgresIdentityPersistence,
  createRealIdentityAuthority,
  migrateControlPlane,
  migrateIdentityStrongAuth,
  migrateRealIdentity,
  migrateRuntimeAuthorities,
  type IdentityActor,
} from '@liiiraa/control-plane-adapters/runtime-identity';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import Stripe from 'stripe';
import {
  ADMIN_FUNCTION_POLICIES,
  type AdminFunction,
} from '@liiiraa/control-plane-domain/admin/governance';
import type { AdminEnvironment } from '@liiiraa/control-plane-domain/admin/operations';

import { admitApiEnvironment, type ApiEnvironmentInput } from '../config/env.ts';
import type { AdminApprovalRouteDependencies } from '../modules/admin/approval-routes.ts';
import type {
  AdminGovernanceRouteDependencies,
  AdminGovernanceRouteSession,
} from '../modules/admin/governance-routes.ts';
import type { AdminInvitationRouteDependencies } from '../modules/admin/invitation-routes.ts';
import type { AdminOperationsRouteDependencies } from '../modules/admin/operations-routes.ts';
import {
  registerCompleteAdminRoutes,
  type AdminRouteDependencies,
  type CompleteAdminRouteDependencies,
} from '../modules/admin/routes.ts';
import { accountSubscriptionUrl, registerCommerceRoutes } from '../modules/commerce/routes.ts';
import { createDeviceEvidenceProtector, registerDeviceRoutes } from '../modules/devices/routes.ts';
import { registerRealIdentityRoutes } from '../modules/identity/real-routes.ts';
import { registerStrongAuthRoutes } from '../modules/identity/strong-auth-routes.ts';
import { registerSupportRoutes } from '../modules/support/routes.ts';
import {
  createPostgresStagingStrongAuthRepository,
  createStagingStrongAuth,
  type StagingStrongAuth,
} from './strong-auth.ts';

export const REAL_STAGING_CAPABILITIES = Object.freeze([
  'invitation-signup',
  'password-session',
  'totp-strong-auth',
  'desktop-pkce',
  'account',
  'commerce-stripe-test',
  'billing-portal',
  'device-authority',
  'support-consent-authority',
  'admin-read-authority',
  'admin-invitation-authority',
  'admin-governance-authority',
  'admin-operations-authority',
  'admin-worker-authority',
] as const);

const freeSubscriptionState = (accountId: string): SubscriptionState => ({
  accountId,
  version: 0n,
  plan: 'free',
  status: 'free',
  cancelAtPeriodEnd: false,
  checkoutStatus: 'none',
  capabilities: { newPremiumActions: false, safetyHistoryRestoration: true },
});

export interface RealStagingEnvironment extends ApiEnvironmentInput {
  readonly STAGING_AUTH_SECRET?: string;
}

interface StagingAdminDatabase {
  query(
    statement: string,
    values?: readonly unknown[],
  ): Promise<Readonly<{ rows: readonly Readonly<Record<string, unknown>>[] }>>;
  transaction?<T>(operation: (transaction: StagingAdminDatabase) => Promise<T>): Promise<T>;
}

type StagingSubscriptionDatabase = StagingAdminDatabase;

interface StagingAdminIdentityAuthority {
  resolveCredential(credential: string): Promise<IdentityActor | null>;
}

interface PersistentStagingAdminInput {
  readonly adminOrigin: string;
  readonly clock?: Readonly<{ now(): Date }>;
  readonly database: StagingAdminDatabase;
  readonly identity: StagingAdminIdentityAuthority;
  readonly strongAuth?: StagingStrongAuth;
}

interface PersistentStagingAdminAuthorityInput {
  readonly adminOrigin: string;
  readonly authSecret: string;
  readonly clock?: Readonly<{ now(): Date }>;
  readonly database: PersistentAdminDatabase;
  readonly environmentId: AdminEnvironment;
  readonly identity: StagingAdminIdentityAuthority;
  readonly strongAuth?: StagingStrongAuth;
}

type PersistentAdminDatabase = Parameters<typeof createPostgresAdminOperationsRepository>[0];

const ADMIN_ROLES = new Set<Exclude<IdentityActor['role'], 'tester'>>([
  'audit',
  'operations',
  'security',
  'support',
]);
const ADMIN_RECORD_LIMIT = '100';

export const resolveStagingSubscription = async (
  database: StagingSubscriptionDatabase,
  actor: IdentityActor,
  correlationId: string,
): Promise<SubscriptionProjectionJson> => {
  const result = await database.query(
    `SELECT id::text AS id, status, valid_until, version
       FROM premium_entitlements
      WHERE identity_id = $1
        AND status IN ('active', 'grace')
        AND valid_from <= CURRENT_TIMESTAMP
        AND (valid_until IS NULL OR valid_until > CURRENT_TIMESTAMP)
      ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END,
               valid_until DESC NULLS FIRST,
               created_at DESC
      LIMIT 1`,
    [actor.accountId],
  );
  const row = result.rows[0];
  if (row === undefined) {
    return {
      schemaVersion: '1.0',
      aggregateVersion: '0',
      etag: `subscription-${actor.accountId}-v0`,
      correlationId,
      provenance: 'postgres-authority',
      kind: 'subscription-projection',
      subscriptionId: `free-${actor.accountId}`,
      accountId: actor.accountId,
      state: 'none',
      plan: 'free',
      entitlements: [],
      cancelAtPeriodEnd: false,
    };
  }

  const entitlementId = text(row['id']);
  const version = text(row['version']);
  const validUntil = text(row['valid_until']);
  return {
    schemaVersion: '1.0',
    aggregateVersion: version,
    etag: `subscription-${entitlementId}-v${version}`,
    correlationId,
    provenance: 'postgres-authority',
    kind: 'subscription-projection',
    subscriptionId: entitlementId,
    accountId: actor.accountId,
    state: 'active',
    plan: 'premium',
    entitlements: ['premium-actions'],
    ...(validUntil.length === 0 ? {} : { currentPeriodEndsAt: validUntil }),
    cancelAtPeriodEnd: false,
  };
};

const cookieCredential = (
  request: Parameters<AdminRouteDependencies['resolveAdminSession']>[0],
) => {
  const cookie = request.headers.cookie;
  if (typeof cookie !== 'string') return null;
  for (const entry of cookie.split(';')) {
    const [name, ...parts] = entry.trim().split('=');
    if (name !== '__Host-liiiraa_session') continue;
    try {
      const credential = decodeURIComponent(parts.join('='));
      return credential.length >= 43 && credential.length <= 256 ? credential : null;
    } catch {
      return null;
    }
  }
  return null;
};

const requestCredential = (request: FastifyRequest): string | null => {
  const authorization = request.headers.authorization;
  if (typeof authorization === 'string' && authorization.startsWith('Bearer ')) {
    const bearer = authorization.slice('Bearer '.length);
    return bearer.length >= 43 && bearer.length <= 256 ? bearer : null;
  }
  return cookieCredential(request);
};

const deviceProjection = (
  record: DeviceBindingRecord,
  correlationId: string,
): DeviceBindingProjectionJson => ({
  schemaVersion: '1.0',
  aggregateVersion: String(record.version),
  etag: `device-${record.bindingId}-v${String(record.version)}`,
  correlationId,
  provenance: 'postgres-authority',
  kind: 'device-binding-projection',
  deviceBindingId: record.bindingId,
  accountId: record.accountId,
  state: record.revokedAt === null ? 'active' : 'revoked',
  deviceLabel: record.deviceLabel,
  evidenceVersion: String(record.evidence.keyVersion),
  boundAt: record.boundAt,
  replacementEligibleAt: record.replacementEligibleAt,
});

const signedWebhookBody = (request: FastifyRequest): Uint8Array | null => {
  const body = request.body;
  if (Buffer.isBuffer(body)) return Uint8Array.from(body);
  return body instanceof Uint8Array ? Uint8Array.from(body) : null;
};

const persistedOperator = async (
  request: Parameters<AdminRouteDependencies['resolveAdminSession']>[0],
  identity: StagingAdminIdentityAuthority,
  database: StagingAdminDatabase,
): Promise<IdentityActor | null> => {
  const credential = cookieCredential(request);
  if (credential === null) return null;
  const actor = await identity.resolveCredential(credential);
  if (actor?.sessionKind !== 'admin' || actor.role === 'tester' || !ADMIN_ROLES.has(actor.role))
    return null;
  const governed = await database.query(
    `SELECT membership.id
       FROM admin_governance_memberships AS membership
       INNER JOIN security_factors AS factor
         ON factor.identity_id = membership.identity_id
        AND factor.factor_kind IN ('passkey', 'totp') AND factor.revoked_at IS NULL
      WHERE membership.identity_id = $1::uuid AND membership.status = 'active'
      LIMIT 1`,
    [actor.accountId],
  );
  return governed.rows[0] === undefined ? null : actor;
};

const adminSession = async (
  actor: IdentityActor,
  database: StagingAdminDatabase,
): Promise<ActiveAdminRoleSession> => {
  const active = await database.query(
    `SELECT governed.active_function
       FROM admin_function_sessions AS governed
       INNER JOIN admin_governance_memberships AS membership
         ON membership.id = governed.membership_id
      WHERE governed.session_id = $1 AND membership.identity_id = $2::uuid
        AND governed.ended_at IS NULL AND membership.status = 'active'
      ORDER BY governed.started_at DESC LIMIT 1`,
    [actor.sessionId, actor.accountId],
  );
  const role = asAdminFunction(active.rows[0]?.['active_function']) ?? actor.role;
  return Object.freeze({
    actorId: actor.accountId,
    assumedAt: actor.authenticatedAt,
    expiresAt: actor.expiresAt,
    nonProduction: true,
    premiumTestGrant: false,
    role: role as ActiveAdminRoleSession['role'],
    sessionId: actor.sessionId,
  });
};

const projectionStatement = (resource: AdminProjectionResource): string => {
  switch (resource) {
    case 'support-case':
      return `SELECT sc.id::text AS id, sc.status, sc.priority, sc.assigned_role,
          sc.version::text AS version, sc.created_at, sc.updated_at,
          dc.id::text AS consent_id, dc.consent_scope, dc.expires_at AS consent_expires_at,
          dc.revoked_at AS consent_revoked_at, dc.version::text AS consent_version
        FROM support_cases sc
        LEFT JOIN LATERAL (
          SELECT id, consent_scope, expires_at, revoked_at, version
          FROM diagnostic_consents
          WHERE case_id = sc.id
          ORDER BY granted_at DESC
          LIMIT 1
        ) dc ON TRUE
        ORDER BY sc.created_at DESC LIMIT ${ADMIN_RECORD_LIMIT}`;
    case 'device':
      return `SELECT id::text AS id, bound_at, revoked_at, replacement_available_at
        FROM device_bindings ORDER BY bound_at DESC LIMIT ${ADMIN_RECORD_LIMIT}`;
    case 'entitlement':
      return `SELECT pe.id::text AS id, pe.status, pe.source, pe.valid_until,
          pe.version::text AS version, pe.updated_at,
          s.status AS subscription_status, s.provider, s.currency, s.current_period_end,
          s.cancel_at_period_end,
          invoice.status AS invoice_status, invoice.amount_total_minor::text AS amount_minor,
          invoice.currency AS invoice_currency,
          COALESCE(provider.pending_events, FALSE) AS pending_provider_events
        FROM premium_entitlements pe
        LEFT JOIN subscriptions s ON s.id = pe.subscription_id
        LEFT JOIN LATERAL (
          SELECT status, amount_total_minor, currency
          FROM invoices
          WHERE subscription_id = s.id AND status = 'paid'
          ORDER BY provider_created_at DESC
          LIMIT 1
        ) invoice ON TRUE
        LEFT JOIN LATERAL (
          SELECT BOOL_OR(processing_state IN ('received', 'processing', 'retryable')) AS pending_events
          FROM provider_inbox
          WHERE aggregate_type = 'subscription' AND aggregate_id = s.id
        ) provider ON TRUE
        ORDER BY pe.created_at DESC LIMIT ${ADMIN_RECORD_LIMIT}`;
    case 'session':
      return `SELECT id::text AS id, session_kind, expires_at, revoked_at
        FROM sessions ORDER BY issued_at DESC LIMIT ${ADMIN_RECORD_LIMIT}`;
    case 'diagnostic-metadata':
      return `SELECT id::text AS id, consent_scope, expires_at, revoked_at
        FROM diagnostic_consents ORDER BY granted_at DESC LIMIT ${ADMIN_RECORD_LIMIT}`;
    case 'audit-event':
      return `SELECT id::text AS id, event_type, actor_kind, occurred_at
        FROM audit_events ORDER BY occurred_at DESC LIMIT ${ADMIN_RECORD_LIMIT}`;
  }
};

const text = (value: unknown): string =>
  typeof value === 'string'
    ? value
    : value instanceof Date
      ? value.toISOString()
      : typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean'
        ? String(value)
        : '';

const recordValue = (value: unknown): Readonly<Record<string, unknown>> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : null;

const admittedId = (value: unknown): string | null => {
  const id = text(value);
  return /^[A-Za-z0-9._:-]{1,128}$/u.test(id) ? id : null;
};

const projectionSummary = (
  resource: AdminProjectionResource,
  row: Readonly<Record<string, unknown>>,
): string => {
  switch (resource) {
    case 'support-case':
      return [text(row['status']), text(row['priority']), text(row['assigned_role'])]
        .filter(Boolean)
        .join(' · ');
    case 'device':
      return `${row['revoked_at'] === null ? 'active' : 'revoked'} · bound ${text(row['bound_at'])}`;
    case 'entitlement':
      return [text(row['status']), text(row['source']), text(row['valid_until'])]
        .filter(Boolean)
        .join(' · ');
    case 'session':
      return `${text(row['session_kind'])} · ${row['revoked_at'] === null ? 'active' : 'revoked'} · expires ${text(row['expires_at'])}`;
    case 'diagnostic-metadata':
      return `${text(row['consent_scope'])} · ${row['revoked_at'] === null ? 'active' : 'revoked'} · expires ${text(row['expires_at'])}`;
    case 'audit-event':
      return [text(row['event_type']), text(row['actor_kind']), text(row['occurred_at'])]
        .filter(Boolean)
        .join(' · ');
  }
};

const projectionRecord = (
  resource: AdminProjectionResource,
  row: Readonly<Record<string, unknown>>,
  now: string,
): Readonly<Record<string, unknown>> | null => {
  const id = admittedId(row['id']);
  if (id === null) return null;
  const summary = projectionSummary(resource, row).slice(0, 256);
  if (resource === 'entitlement') {
    const subscription = text(row['subscription_status']);
    const subscriptionState =
      subscription === 'active'
        ? 'paid'
        : ['past-due', 'grace'].includes(subscription)
          ? 'past-due'
          : ['canceled', 'expired'].includes(subscription)
            ? 'canceled'
            : 'unknown';
    const amountMinor = text(row['amount_minor']);
    const currency = text(row['invoice_currency']) || text(row['currency']);
    return Object.freeze({
      id,
      ...(amountMinor.length > 0 && currency.length === 3 ? { amountMinor, currency } : {}),
      cancelAtPeriodEnd: row['cancel_at_period_end'] === true,
      currentPeriodEndsAt: text(row['current_period_end']),
      observedAt: text(row['updated_at']) || now,
      providerState: 'unknown',
      reconciliationState:
        text(row['provider']).length === 0
          ? 'unknown'
          : row['pending_provider_events'] === true
            ? 'pending'
            : 'reconciled',
      source: text(row['source']),
      subscriptionState,
      summary,
      validUntil: text(row['valid_until']),
      version: text(row['version']) || '1',
    });
  }
  if (resource === 'support-case') {
    const createdAt = text(row['created_at']) || now;
    const priority = text(row['priority']) || 'normal';
    const deadlineHours =
      priority === 'urgent' ? 1 : priority === 'high' ? 4 : priority === 'low' ? 48 : 24;
    const consentId = admittedId(row['consent_id']);
    const consentExpiresAt = text(row['consent_expires_at']);
    const consentState =
      consentId === null
        ? 'absent'
        : row['consent_revoked_at'] !== null && row['consent_revoked_at'] !== undefined
          ? 'revoked'
          : consentExpiresAt.length > 0 && Date.parse(consentExpiresAt) <= Date.parse(now)
            ? 'expired'
            : 'active';
    return Object.freeze({
      id,
      ...(consentId === null
        ? {}
        : {
            consent: Object.freeze({
              consentId,
              expiresAt: consentExpiresAt,
              scopes: Object.freeze(['support-diagnostics']),
              state: consentState,
              version: text(row['consent_version']) || '1',
            }),
            diagnosticId: consentId,
          }),
      deadlineAt: new Date(Date.parse(createdAt) + deadlineHours * 60 * 60 * 1_000).toISOString(),
      metadata: Object.freeze({
        caseReference: `case-••••${id.replaceAll('-', '').slice(-6)}`,
        diagnosticCategory: priority,
      }),
      observedAt: text(row['updated_at']) || now,
      ownerReference: text(row['assigned_role']) || 'unassigned',
      state: text(row['status']) || 'open',
      subjectRedacted: `Support case ••••${id.replaceAll('-', '').slice(-6)}`,
      summary,
      version: text(row['version']) || '1',
    });
  }
  return Object.freeze({ id, ...(summary.length === 0 ? {} : { summary }) });
};

const loadDiagnosticProjection = async (
  database: StagingAdminDatabase,
  id: string,
  now: string,
): Promise<Readonly<Record<string, unknown>> | null> => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(id)) {
    return null;
  }
  const result = await database.query(
    `SELECT id::text AS id, case_id::text AS case_id, identity_id::text AS identity_id,
        access_reason, granted_at, expires_at, revoked_at, version::text AS version
      FROM diagnostic_consents
      WHERE id = $1::uuid
      LIMIT 1`,
    [id],
  );
  const row = result.rows[0];
  if (row === undefined) return null;
  const consentId = admittedId(row['id']);
  const accountId = admittedId(row['identity_id']);
  const purpose = text(row['access_reason']).slice(0, 256);
  const grantedAt = text(row['granted_at']);
  const expiresAt = text(row['expires_at']);
  const aggregateVersion = text(row['version']);
  if (
    consentId === null ||
    accountId === null ||
    purpose.length === 0 ||
    !/^(?:0|[1-9][0-9]{0,19})$/u.test(aggregateVersion) ||
    Number.isNaN(Date.parse(grantedAt)) ||
    Number.isNaN(Date.parse(expiresAt))
  ) {
    return null;
  }
  const state =
    row['revoked_at'] !== null && row['revoked_at'] !== undefined
      ? 'revoked'
      : Date.parse(expiresAt) <= Date.parse(now)
        ? 'expired'
        : 'active';
  return Object.freeze({
    auditEvents: Object.freeze([]),
    consent: Object.freeze({
      schemaVersion: '1.0',
      aggregateVersion,
      etag: `diagnostic-consent-${consentId}-v${aggregateVersion}`,
      correlationId: `admin-diagnostic-${consentId}`,
      provenance: 'postgres-authority',
      kind: 'diagnostic-consent',
      consentId,
      accountId,
      state,
      scopes: Object.freeze(['support-diagnostics']),
      purpose,
      grantedAt,
      expiresAt,
      ...(row['revoked_at'] === null || row['revoked_at'] === undefined
        ? {}
        : { revokedAt: text(row['revoked_at']) }),
    }),
    fields: Object.freeze({}),
    id: consentId,
  });
};

const requireAdminTransaction = <T>(
  database: StagingAdminDatabase,
  operation: (transaction: StagingAdminDatabase) => Promise<T>,
): Promise<T> => {
  if (database.transaction === undefined) {
    return Promise.reject(new Error('STAGING_ADMIN_TRANSACTION_UNAVAILABLE'));
  }
  return database.transaction(operation);
};

const persistentRoleAuthority = (
  database: StagingAdminDatabase,
  clock: Readonly<{ now(): Date }>,
): AdminRoleAuthorityDependencies => ({
  clock,
  ids: { next: randomUUID },
  repository: {
    transaction: (actorId, operation) =>
      requireAdminTransaction(database, async (transaction) =>
        operation({
          loadActive: async () => {
            const result = await transaction.query(
              `SELECT governed.session_id, governed.active_function, governed.started_at,
                      governed.version, session.expires_at
                 FROM admin_function_sessions AS governed
                 INNER JOIN admin_governance_memberships AS membership
                   ON membership.id = governed.membership_id
                 INNER JOIN sessions AS session ON session.id::text = governed.session_id
                WHERE membership.identity_id = $1::uuid
                  AND governed.ended_at IS NULL
                  AND session.revoked_at IS NULL
                ORDER BY governed.started_at DESC LIMIT 1 FOR UPDATE`,
              [actorId],
            );
            const row = result.rows[0];
            const role = asAdminFunction(row?.['active_function']);
            return row === undefined || role === null
              ? null
              : {
                  sessionId: text(row['session_id']),
                  actorId,
                  role,
                  assumedAt: text(row['started_at']),
                  expiresAt: text(row['expires_at']),
                  nonProduction: true,
                  premiumTestGrant: false,
                };
          },
          replaceActive: async (session) => {
            await transaction.query(
              `UPDATE admin_function_sessions AS governed SET ended_at = $2
                FROM admin_governance_memberships AS membership
               WHERE governed.membership_id = membership.id
                 AND membership.identity_id = $1::uuid
                 AND governed.ended_at IS NULL`,
              [actorId, clock.now().toISOString()],
            );
            if (session !== null) {
              await transaction.query(
                `INSERT INTO admin_function_sessions
                  (id, session_id, membership_id, active_function, simulation, version, started_at)
                 SELECT $1, identity_session.id::text, membership.id, $3, FALSE, 1, $4
                   FROM admin_governance_memberships AS membership
                   INNER JOIN sessions AS identity_session
                     ON identity_session.identity_id = membership.identity_id
                  WHERE membership.identity_id = $2::uuid
                    AND identity_session.revoked_at IS NULL
                    AND identity_session.expires_at > $4
                  ORDER BY identity_session.issued_at DESC LIMIT 1`,
                [session.sessionId, actorId, session.role, session.assumedAt],
              );
            }
          },
          appendAudit: async (event) => {
            await transaction.query(
              `INSERT INTO admin_governance_audit
                (id, actor_id, subject_id, action, details, occurred_at)
               VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
              [
                text(event['eventId']) || randomUUID(),
                actorId,
                actorId,
                text(event['action']) || 'admin-role-transition',
                JSON.stringify(event),
                text(event['occurredAt']) || clock.now().toISOString(),
              ],
            );
          },
          enqueueOutbox: async (event) => {
            await transaction.query(
              `INSERT INTO outbox_jobs
                (id, topic, aggregate_type, aggregate_id, aggregate_version, payload, available_at)
               VALUES ($1, $2, 'admin-role', $3::uuid, 1, $4::jsonb, $5)
               ON CONFLICT (id) DO NOTHING`,
              [
                text(event['eventId']) || randomUUID(),
                text(event['topic']) || 'admin.role.changed',
                actorId,
                JSON.stringify(event),
                text(event['availableAt']) || clock.now().toISOString(),
              ],
            );
          },
        }),
      ),
  },
});

const commandProjectionStatement = (resource: AdminProjectionResource): string => {
  switch (resource) {
    case 'support-case':
      return `SELECT version, status AS state FROM support_cases WHERE id = $1::uuid FOR UPDATE`;
    case 'device':
      return `SELECT version, CASE WHEN revoked_at IS NULL THEN 'active' ELSE 'revoked' END AS state
        FROM device_bindings WHERE id = $1::uuid FOR UPDATE`;
    case 'entitlement':
      return `SELECT version, status AS state FROM premium_entitlements WHERE id = $1::uuid FOR UPDATE`;
    case 'session':
      return `SELECT version, CASE WHEN revoked_at IS NULL THEN 'active' ELSE 'revoked' END AS state
        FROM sessions WHERE id = $1::uuid FOR UPDATE`;
    case 'diagnostic-metadata':
      return `SELECT version, CASE WHEN revoked_at IS NULL THEN 'active' ELSE 'revoked' END AS state
        FROM diagnostic_consents WHERE id = $1::uuid FOR UPDATE`;
    case 'audit-event':
      return `SELECT sequence_number AS version, event_type AS state
        FROM audit_events WHERE id = $1::uuid FOR UPDATE`;
  }
};

const persistentCommandAuthority = (
  database: StagingAdminDatabase,
  clock: Readonly<{ now(): Date }>,
): AdminCommandDependencies => ({
  clock,
  ids: { next: randomUUID },
  repository: {
    transaction: (redactedTarget, operation) =>
      requireAdminTransaction(database, async (transaction) =>
        operation({
          findCommandResult: async (commandId) => {
            const result = await transaction.query(
              `SELECT result FROM admin_governance_commands WHERE command_id = $1`,
              [commandId],
            );
            const stored = result.rows[0]?.['result'];
            return typeof stored === 'object' && stored !== null ? (stored as never) : null;
          },
          loadAggregate: async (resource) => {
            const result = await transaction.query(commandProjectionStatement(resource), [
              redactedTarget,
            ]);
            const row = result.rows[0];
            return row === undefined
              ? null
              : { version: BigInt(text(row['version'])), state: text(row['state']) };
          },
          apply: async (command, aggregate) => {
            let result: Awaited<ReturnType<StagingAdminDatabase['query']>> | null = null;
            if (command.action === 'revoke-session') {
              result = await transaction.query(
                `UPDATE sessions SET revoked_at = $2, version = version + 1
                  WHERE id = $1::uuid AND revoked_at IS NULL RETURNING version`,
                [redactedTarget, clock.now().toISOString()],
              );
            } else if (command.action === 'revoke-device') {
              result = await transaction.query(
                `UPDATE device_bindings SET revoked_at = $2, version = version + 1
                  WHERE id = $1::uuid AND revoked_at IS NULL RETURNING version`,
                [redactedTarget, clock.now().toISOString()],
              );
            } else if (command.action === 'correct-entitlement') {
              result = await transaction.query(
                `UPDATE premium_entitlements SET version = version + 1
                  WHERE id = $1::uuid RETURNING version`,
                [redactedTarget],
              );
            }
            const version = result?.rows[0]?.['version'];
            return {
              ...aggregate,
              version: version === undefined ? aggregate.version : BigInt(text(version)),
            };
          },
          appendAudit: async (event) => {
            const auditReference = text(event['eventId']) || randomUUID();
            await transaction.query(
              `INSERT INTO admin_governance_audit
                (id, actor_id, subject_id, action, details, occurred_at)
               VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
              [
                auditReference,
                text(event['actorId']),
                redactedTarget,
                text(event['action']) || 'admin-command',
                JSON.stringify(event),
                text(event['occurredAt']) || clock.now().toISOString(),
              ],
            );
            return auditReference;
          },
          enqueueOutbox: async (event) => {
            await transaction.query(
              `INSERT INTO outbox_jobs
                (id, topic, aggregate_type, aggregate_id, aggregate_version, payload, available_at)
               VALUES ($1, $2, $3, $4::uuid, $5, $6::jsonb, $7)
               ON CONFLICT (id) DO NOTHING`,
              [
                text(event['jobId']) || randomUUID(),
                text(event['topic']) || 'admin.command.executed',
                text(event['resource']) || 'admin',
                redactedTarget,
                text(event['aggregateVersion']) || '0',
                JSON.stringify(event),
                text(event['availableAt']) || clock.now().toISOString(),
              ],
            );
          },
          rememberCommandResult: async (commandId, result) => {
            await transaction.query(
              `INSERT INTO admin_governance_commands (command_id, subject_id, result)
               VALUES ($1, $2, $3::jsonb) ON CONFLICT (command_id) DO NOTHING`,
              [commandId, redactedTarget, JSON.stringify(result)],
            );
          },
        }),
      ),
  },
});

export const createPersistentStagingAdminDependencies = ({
  adminOrigin,
  clock = { now: () => new Date() },
  database,
  identity,
  strongAuth,
}: PersistentStagingAdminInput): AdminRouteDependencies => {
  const listProjection = async (resource: AdminProjectionResource) => {
    const result = await database.query(projectionStatement(resource));
    const now = clock.now().toISOString();
    return result.rows.flatMap((row) => {
      const record = projectionRecord(resource, row, now);
      return record === null ? [] : [record];
    });
  };
  return Object.freeze({
    allowedOrigin: adminOrigin,
    commands: persistentCommandAuthority(database, clock),
    listProjection,
    loadProjection: async (resource: AdminProjectionResource, id: string) =>
      resource === 'diagnostic-metadata'
        ? loadDiagnosticProjection(database, id, clock.now().toISOString())
        : ((await listProjection(resource)).find((record) => record['id'] === id) ?? null),
    resolveAdminSession: async (
      request: Parameters<AdminRouteDependencies['resolveAdminSession']>[0],
    ) => {
      const actor = await persistedOperator(request, identity, database);
      return actor === null ? null : adminSession(actor, database);
    },
    resolveDeveloperActor: async (
      request: Parameters<AdminRouteDependencies['resolveDeveloperActor']>[0],
    ) => {
      const actor = await persistedOperator(request, identity, database);
      return actor === null ? null : { actorId: actor.accountId, nonProduction: true };
    },
    resolveStepUp: async (request: Parameters<AdminRouteDependencies['resolveStepUp']>[0]) => {
      const actor = await persistedOperator(request, identity, database);
      const body = recordValue(request.body);
      const command = recordValue(body?.['command']);
      const breakGlassMetadata = request.url.startsWith('/v1/admin/break-glass/metadata');
      const action = breakGlassMetadata ? 'export-audit-reference' : text(command?.['action']);
      const resource: AdminProjectionResource | null =
        action === 'view-support-diagnostics'
          ? 'diagnostic-metadata'
          : action === 'revoke-session'
            ? 'session'
            : action === 'revoke-device'
              ? 'device'
              : action === 'correct-entitlement'
                ? 'entitlement'
                : action === 'export-audit-reference'
                  ? 'audit-event'
                  : null;
      const receipt = request.headers['x-liiiraa-admin-step-up'];
      const authorizationContextId = request.headers['x-admin-authorization-context'];
      const evidence =
        actor === null ||
        strongAuth === undefined ||
        typeof receipt !== 'string' ||
        typeof authorizationContextId !== 'string'
          ? null
          : await strongAuth.consumeStepUpReceipt(actor, {
              action,
              authorizationContextId,
              receipt,
              redactedTarget: breakGlassMetadata
                ? text(body?.['targetReference'])
                : text(command?.['redactedTarget']),
              resource: resource ?? '',
            });
      if (evidence === null || (!breakGlassMetadata && command === null) || resource === null) {
        return null;
      }
      return {
        actorId: evidence.actorId,
        action: action as
          | 'view-support-diagnostics'
          | 'revoke-session'
          | 'revoke-device'
          | 'correct-entitlement'
          | 'export-audit-reference',
        resource,
        redactedTarget: evidence.redactedTarget,
        authorizationContextId: evidence.authorizationContextId,
        method: evidence.method,
        verifiedAt: evidence.verifiedAt,
        expiresAt: evidence.expiresAt,
      };
    },
    roles: persistentRoleAuthority(database, clock),
  });
};

const ADMIN_OPERATIONS_ENVIRONMENT_ID = '00000000-0000-4000-8000-000000000006';

const GOVERNANCE_CAPABILITIES = Object.freeze([
  'admin-membership:activate',
  'admin-membership:manage',
  'admin-permissions:manage',
  'admin-delegation:manage',
  'admin-approval:manage',
  'admin-access:review',
  'admin-audit:reveal',
  'admin-function:simulate',
] as const satisfies readonly AdminGovernanceCapability[]);

const OPERATIONS_CAPABILITIES = Object.freeze([
  'admin-operations:search',
  'admin-operations:jobs',
  'admin-operations:conflicts',
  'admin-operations:incidents',
  'admin-operations:exports',
  'admin-operations:configuration',
  'admin-operations:privacy',
  'admin-operations:emergency',
] as const satisfies readonly AdminOperationsCapability[]);

const asAdminFunction = (value: unknown): AdminFunction | null =>
  value === 'support' || value === 'operations' || value === 'security' || value === 'audit'
    ? value
    : null;

const governanceCapabilitiesFor = (
  activeFunction: AdminFunction,
): readonly AdminGovernanceCapability[] => {
  switch (activeFunction) {
    case 'security':
      return GOVERNANCE_CAPABILITIES;
    case 'audit':
      return ['admin-access:review', 'admin-audit:reveal', 'admin-function:simulate'];
    case 'operations':
      return ['admin-delegation:manage', 'admin-access:review', 'admin-function:simulate'];
    case 'support':
      return ['admin-function:simulate'];
  }
};

const resolveGovernanceSession = async (
  request: FastifyRequest,
  database: PersistentAdminDatabase,
  identity: StagingAdminIdentityAuthority,
): Promise<AdminGovernanceRouteSession | null> => {
  const actor = await persistedOperator(request, identity, database);
  if (actor === null) return null;
  const active = await database.query<{
    active_function: string;
    simulation: boolean;
    version: string | number | bigint;
  }>(
    `SELECT governed.active_function, governed.simulation, governed.version
       FROM admin_function_sessions AS governed
       INNER JOIN admin_governance_memberships AS membership
         ON membership.id = governed.membership_id
      WHERE governed.session_id = $1
        AND governed.ended_at IS NULL
        AND membership.identity_id = $2
        AND membership.status = 'active'
      ORDER BY governed.started_at DESC
      LIMIT 1`,
    [actor.sessionId, actor.accountId],
  );
  const row = active.rows[0];
  const activeFunction = asAdminFunction(row?.active_function) ?? asAdminFunction(actor.role);
  if (activeFunction === null) return null;
  const policy = ADMIN_FUNCTION_POLICIES[activeFunction];
  return Object.freeze({
    sessionId: actor.sessionId,
    actorId: actor.accountId,
    activeFunction,
    navigation: policy.navigation,
    dataScopes: policy.dataScopes,
    capabilities: policy.capabilities,
    governanceCapabilities: governanceCapabilitiesFor(activeFunction),
    governanceScopes: ['team', 'delegations', 'reviews', 'history'] as const,
    simulation: row?.simulation === true,
    version: row === undefined ? actor.sessionVersion : BigInt(row.version),
  });
};

const resolveGovernanceStepUp = async (
  request: FastifyRequest,
  identity: StagingAdminIdentityAuthority,
  database: PersistentAdminDatabase,
  strongAuth: StagingStrongAuth | undefined,
): Promise<AdminGovernanceStepUpEvidence | null> => {
  const actor = await persistedOperator(request, identity, database);
  const body = recordValue(request.body);
  const command = recordValue(body?.['command']);
  const targetReferences = command?.['targetReferences'];
  const expectedAction = text(command?.['action']);
  const expectedResource = request.url.includes('/approvals') ? 'approvals' : 'governance';
  const expectedTarget = Array.isArray(targetReferences) ? text(targetReferences[0]) : '';
  const expectedAuthorizationContextId = text(body?.['authorizationContextId']);
  const receipt = request.headers['x-liiiraa-admin-step-up'];
  const authorizationContextId = request.headers['x-admin-authorization-context'];
  const action = request.headers['x-admin-step-up-action'];
  const resource = request.headers['x-admin-step-up-resource'];
  const redactedTarget = request.headers['x-admin-step-up-target'];
  if (
    actor === null ||
    strongAuth === undefined ||
    typeof receipt !== 'string' ||
    typeof authorizationContextId !== 'string' ||
    typeof action !== 'string' ||
    typeof resource !== 'string' ||
    typeof redactedTarget !== 'string' ||
    action !== expectedAction ||
    resource !== expectedResource ||
    redactedTarget !== expectedTarget ||
    authorizationContextId !== expectedAuthorizationContextId
  ) {
    return null;
  }
  const evidence = await strongAuth.consumeStepUpReceipt(actor, {
    action: expectedAction,
    authorizationContextId: expectedAuthorizationContextId,
    receipt,
    redactedTarget: expectedTarget,
    resource: expectedResource,
  });
  if (evidence === null) return null;
  return Object.freeze({
    evidenceId: evidence.evidenceId,
    actorId: evidence.actorId,
    authorizationContextId: evidence.authorizationContextId,
    action: evidence.action,
    resource: evidence.resource,
    redactedTarget: evidence.redactedTarget,
    method: evidence.method,
    verifiedAt: evidence.verifiedAt,
    expiresAt: evidence.expiresAt,
  });
};

const invitationQueries = (
  database: PersistentAdminDatabase,
): AdminInvitationRouteDependencies['queries'] => ({
  list: async ({ limit, cursor }) => {
    const result = await database.query(
      `SELECT invitation.id::text AS invitation_id, invitation.recipient_digest,
              invitation.status, invitation.locale, invitation.campaign, invitation.version,
              invitation.delivery_state, invitation.reminder_count, invitation.owner_reference,
              invitation.expires_at, invitation.updated_at
         FROM admin_invitations AS invitation
        WHERE ($2::uuid IS NULL OR invitation.id < $2::uuid)
        ORDER BY invitation.id DESC LIMIT $1`,
      [limit, cursor ?? null],
    );
    const records = result.rows.map((row) => ({
      invitationId: text(row['invitation_id']),
      recipientMasked: `recipient:${text(row['recipient_digest']).slice(0, 12)}`,
      lifecycleState: text(row['status']) === 'pending' ? 'active' : text(row['status']),
      locale: text(row['locale']),
      ...(text(row['campaign']).length === 0 ? {} : { campaignReference: text(row['campaign']) }),
      deliveryState: text(row['delivery_state']),
      reminderCount: Number(row['reminder_count']),
      ...(text(row['owner_reference']).length === 0
        ? {}
        : { ownerReference: text(row['owner_reference']) }),
      version: text(row['version']),
      ...(text(row['expires_at']).length === 0 ? {} : { expiresAt: text(row['expires_at']) }),
      lastEventAt: text(row['updated_at']),
    }));
    const capacityResult = await database.query(
      `SELECT capacity.active_beta_count, capacity.version, capacity.updated_at,
              (SELECT COUNT(*)::integer FROM admin_invitations WHERE kind = 'beta' AND status = 'queued') AS queued_count
         FROM admin_invitation_capacity AS capacity WHERE capacity.singleton = TRUE`,
    );
    const capacityRow = capacityResult.rows[0];
    const jobsResult = await database.query(
      `SELECT job.id::text AS job_id, job.action, job.status, job.items, job.progress,
              job.created_at, job.completed_at, receipt.id::text AS receipt_reference
         FROM admin_invitation_jobs AS job
         LEFT JOIN admin_invitation_receipts AS receipt ON receipt.aggregate_id = job.id::text
        ORDER BY job.created_at DESC LIMIT 50`,
    );
    const jobs = jobsResult.rows.map((row) => {
      const items = Array.isArray(row['items']) ? row['items'] : [];
      const progress = recordValue(row['progress']);
      const issued = Array.isArray(progress?.['issued']) ? progress['issued'].length : 0;
      const queued = Array.isArray(progress?.['queued']) ? progress['queued'].length : 0;
      const skipped = Array.isArray(progress?.['skipped']) ? progress['skipped'].length : 0;
      const failed = Array.isArray(progress?.['failed']) ? progress['failed'].length : 0;
      return {
        jobId: text(row['job_id']),
        action: text(row['action']),
        state: text(row['status']),
        totalItems: items.length,
        completedItems: issued + queued + skipped,
        failedItems: failed,
        version: `${text(row['status'])}:${String(issued + queued + skipped)}:${String(failed)}`,
        startedAt: text(row['created_at']),
        ...(text(row['completed_at']).length === 0
          ? {}
          : { completedAt: text(row['completed_at']) }),
        ...(text(row['receipt_reference']).length === 0
          ? {}
          : { receiptReference: text(row['receipt_reference']) }),
      };
    });
    return {
      records,
      capacity: {
        activeCount: Number(capacityRow?.['active_beta_count']),
        activeLimit: 25,
        queuedCount: Number(capacityRow?.['queued_count']),
        version: text(capacityRow?.['version']),
        updatedAt: text(capacityRow?.['updated_at']),
      },
      jobs,
      nextCursor: records.length === limit ? (records.at(-1)?.invitationId ?? '') : null,
    };
  },
  load: async (invitationId) => {
    const result = await database.query(
      `SELECT id::text AS invitation_id, recipient_digest, status, locale, campaign, version,
              delivery_state, reminder_count, owner_reference, retention_state,
              expires_at, updated_at FROM admin_invitations WHERE id = $1::uuid`,
      [invitationId],
    );
    const row = result.rows[0];
    return row === undefined
      ? null
      : {
          invitationId: text(row['invitation_id']),
          recipientMasked: `recipient:${text(row['recipient_digest']).slice(0, 12)}`,
          lifecycleState: text(row['status']) === 'pending' ? 'active' : text(row['status']),
          locale: text(row['locale']),
          ...(text(row['campaign']).length === 0
            ? {}
            : { campaignReference: text(row['campaign']) }),
          deliveryState: text(row['delivery_state']),
          reminderCount: Number(row['reminder_count']),
          ...(text(row['owner_reference']).length === 0
            ? {}
            : { ownerReference: text(row['owner_reference']) }),
          retentionState: text(row['retention_state']),
          version: text(row['version']),
          ...(text(row['expires_at']).length === 0 ? {} : { expiresAt: text(row['expires_at']) }),
          lastEventAt: text(row['updated_at']),
        };
  },
  timeline: async (invitationId) => {
    const result = await database.query(
      `SELECT event_kind, occurred_at FROM admin_invitation_events
        WHERE invitation_id = $1::uuid ORDER BY sequence_number`,
      [invitationId],
    );
    return result.rows.map((row) => ({
      kind: text(row['event_kind']),
      at: text(row['occurred_at']),
    }));
  },
});

const governanceQueries = (
  database: PersistentAdminDatabase,
): AdminGovernanceRouteDependencies['queries'] => ({
  listTeam: async ({ limit, cursor }) => {
    const result = await database.query(
      `SELECT membership.identity_id::text AS identity_id, identity.display_name,
              identity.email, membership.status, membership.strong_factor, membership.version,
              COALESCE((SELECT array_agg(membership_grant.function ORDER BY membership_grant.function)
                FROM admin_membership_functions AS membership_grant
                WHERE membership_grant.membership_id = membership.id AND membership_grant.revoked_at IS NULL), ARRAY[]::text[]) AS functions,
              COALESCE((SELECT array_agg(membership_grant.capability ORDER BY membership_grant.capability)
                FROM admin_membership_capabilities AS membership_grant
                WHERE membership_grant.membership_id = membership.id AND membership_grant.revoked_at IS NULL), ARRAY[]::text[]) AS capabilities,
              COALESCE((SELECT array_agg(membership_grant.scope ORDER BY membership_grant.scope)
                FROM admin_membership_scopes AS membership_grant
                WHERE membership_grant.membership_id = membership.id AND membership_grant.revoked_at IS NULL), ARRAY[]::text[]) AS scopes,
              (SELECT session.active_function FROM admin_function_sessions AS session
                WHERE session.membership_id = membership.id AND session.ended_at IS NULL
                ORDER BY session.started_at DESC LIMIT 1) AS active_function,
              COALESCE((SELECT array_agg(session.session_id ORDER BY session.started_at DESC)
                FROM admin_function_sessions AS session
                WHERE session.membership_id = membership.id AND session.ended_at IS NULL), ARRAY[]::text[]) AS session_references,
              COALESCE((SELECT array_agg(delegation.id ORDER BY delegation.expires_at)
                FROM admin_delegations AS delegation
                WHERE delegation.status = 'active'
                  AND (delegation.delegator_id = membership.identity_id OR delegation.delegate_id = membership.identity_id)), ARRAY[]::text[]) AS active_delegation_references,
              (SELECT MAX(session.started_at) FROM admin_function_sessions AS session
                WHERE session.membership_id = membership.id) AS last_active_at,
              (SELECT MAX(review.next_review_at) FROM admin_access_reviews AS review
                WHERE review.membership_id = membership.id) AS next_review_at
         FROM admin_governance_memberships AS membership
         INNER JOIN identities AS identity ON identity.id = membership.identity_id
        WHERE ($2::uuid IS NULL OR membership.identity_id < $2::uuid)
        ORDER BY membership.identity_id DESC LIMIT $1`,
      [limit, cursor ?? null],
    );
    const records = result.rows.map((row) => ({
      identityId: text(row['identity_id']),
      displayName: text(row['display_name']),
      email: text(row['email']),
      status: text(row['status']),
      strongFactor: text(row['strong_factor']),
      version: text(row['version']),
      functions: row['functions'],
      capabilities: row['capabilities'],
      scopes: row['scopes'],
      activeFunction: text(row['active_function']),
      sessionReferences: row['session_references'],
      activeDelegationReferences: row['active_delegation_references'],
      lastActiveAt: text(row['last_active_at']),
      nextReviewAt: text(row['next_review_at']),
    }));
    return {
      records,
      nextCursor: records.length === limit ? (records.at(-1)?.identityId ?? '') : null,
    };
  },
  loadTeamMember: async (identityId) => {
    const result = await database.query(
      `SELECT membership.identity_id::text AS identity_id, identity.display_name, identity.email,
              membership.status, membership.strong_factor, membership.version,
              COALESCE((SELECT array_agg(membership_grant.function ORDER BY membership_grant.function)
                FROM admin_membership_functions AS membership_grant
                WHERE membership_grant.membership_id = membership.id AND membership_grant.revoked_at IS NULL), ARRAY[]::text[]) AS functions,
              COALESCE((SELECT array_agg(membership_grant.capability ORDER BY membership_grant.capability)
                FROM admin_membership_capabilities AS membership_grant
                WHERE membership_grant.membership_id = membership.id AND membership_grant.revoked_at IS NULL), ARRAY[]::text[]) AS capabilities,
              COALESCE((SELECT array_agg(membership_grant.scope ORDER BY membership_grant.scope)
                FROM admin_membership_scopes AS membership_grant
                WHERE membership_grant.membership_id = membership.id AND membership_grant.revoked_at IS NULL), ARRAY[]::text[]) AS scopes,
              (SELECT session.active_function FROM admin_function_sessions AS session
                WHERE session.membership_id = membership.id AND session.ended_at IS NULL
                ORDER BY session.started_at DESC LIMIT 1) AS active_function,
              COALESCE((SELECT array_agg(session.session_id ORDER BY session.started_at DESC)
                FROM admin_function_sessions AS session
                WHERE session.membership_id = membership.id AND session.ended_at IS NULL), ARRAY[]::text[]) AS session_references,
              COALESCE((SELECT array_agg(delegation.id ORDER BY delegation.expires_at)
                FROM admin_delegations AS delegation
                WHERE delegation.status = 'active'
                  AND (delegation.delegator_id = membership.identity_id OR delegation.delegate_id = membership.identity_id)), ARRAY[]::text[]) AS active_delegation_references,
              (SELECT MAX(session.started_at) FROM admin_function_sessions AS session
                WHERE session.membership_id = membership.id) AS last_active_at,
              (SELECT MAX(review.next_review_at) FROM admin_access_reviews AS review
                WHERE review.membership_id = membership.id) AS next_review_at
         FROM admin_governance_memberships AS membership
         INNER JOIN identities AS identity ON identity.id = membership.identity_id
         WHERE membership.identity_id = $1::uuid`,
      [identityId],
    );
    const row = result.rows[0];
    return row === undefined
      ? null
      : {
          identityId: text(row['identity_id']),
          displayName: text(row['display_name']),
          email: text(row['email']),
          status: text(row['status']),
          strongFactor: text(row['strong_factor']),
          version: text(row['version']),
          functions: row['functions'],
          capabilities: row['capabilities'],
          scopes: row['scopes'],
          activeFunction: text(row['active_function']),
          sessionReferences: row['session_references'],
          activeDelegationReferences: row['active_delegation_references'],
          lastActiveAt: text(row['last_active_at']),
          nextReviewAt: text(row['next_review_at']),
        };
  },
  history: async (identityId) => {
    const result = await database.query(
      `SELECT action, occurred_at FROM admin_governance_audit
        WHERE subject_id = $1 ORDER BY occurred_at DESC LIMIT 100`,
      [identityId],
    );
    return result.rows;
  },
});

const approvalQueries = (
  database: PersistentAdminDatabase,
): AdminApprovalRouteDependencies['queries'] => {
  const project = (row: Readonly<Record<string, unknown>>) => ({
    requestId: text(row['request_id']),
    authorId: text(row['author_id']),
    beneficiaryId: text(row['beneficiary_id']),
    capability: text(row['capability']),
    scope: text(row['scope']),
    risk: text(row['risk']),
    status: text(row['status']),
    assignedApproverId: text(row['assigned_approver_id']),
    version: text(row['version']),
    createdAt: text(row['created_at']),
    expiresAt: text(row['expires_at']),
  });
  const selection = `SELECT id AS request_id, author_id::text, beneficiary_id::text,
      capability, scope, risk, status, assigned_approver_id::text, version, created_at, expires_at
      FROM admin_approval_requests`;
  return {
    listApprovals: async ({ limit, cursor }) => {
      const result = await database.query(
        `${selection}
          WHERE ($2::text IS NULL OR id < $2)
          ORDER BY id DESC LIMIT $1`,
        [limit, cursor ?? null],
      );
      const records = result.rows.map(project);
      return {
        records,
        nextCursor: records.length === limit ? (records.at(-1)?.requestId ?? null) : null,
      };
    },
    loadApproval: async (requestId) => {
      const result = await database.query(`${selection} WHERE id = $1 LIMIT 1`, [requestId]);
      const row = result.rows[0];
      return row === undefined ? null : project(row);
    },
  };
};

const OPERATIONS_QUERY = Object.freeze({
  queues: `SELECT job.environment_id, job.job_id AS record_id, job.kind, job.status, job.version, job.progress,
      job.affected_items, job.receipt_id, job.claimed_by, job.created_at, job.updated_at,
      COUNT(item.item_id)::integer AS total_items,
      COUNT(item.item_id) FILTER (WHERE item.status = 'completed')::integer AS completed_items,
      COUNT(item.item_id) FILTER (WHERE item.status = 'failed')::integer AS failed_items
    FROM admin_operational_jobs AS job
    LEFT JOIN admin_operational_job_items AS item
      ON item.environment_id = job.environment_id AND item.job_id = job.job_id
    GROUP BY job.environment_id, job.job_id`,
  views: `SELECT environment_id, id AS record_id, kind, name, query_text, version, updated_at FROM admin_saved_views`,
  inbox: `SELECT environment_id, record_id, scope, owner_id, status, priority, masked_title, occurred_at, updated_at, version FROM admin_inbox_items`,
  jobs: `SELECT job.environment_id, job.job_id AS record_id, job.kind, job.status, job.version, job.progress,
      job.affected_items, job.receipt_id, job.claimed_by, job.created_at, job.updated_at,
      COUNT(item.item_id)::integer AS total_items,
      COUNT(item.item_id) FILTER (WHERE item.status = 'completed')::integer AS completed_items,
      COUNT(item.item_id) FILTER (WHERE item.status = 'failed')::integer AS failed_items
    FROM admin_operational_jobs AS job
    LEFT JOIN admin_operational_job_items AS item
      ON item.environment_id = job.environment_id AND item.job_id = job.job_id
    GROUP BY job.environment_id, job.job_id`,
  incidents: `SELECT environment_id, incident_id AS record_id, procedure_version, severity, status, version,
      owner_id, substitute_id, started_at, updated_at FROM admin_incidents`,
  exports: `SELECT environment_id, export_id AS record_id, actor_id, purpose, fields, status, masked, encrypted,
      created_at, expires_at FROM admin_sensitive_exports`,
  configurations: `SELECT environment_id, configuration_id AS record_id, version, status, cohort, known_version,
      previous_version, created_at FROM admin_configuration_versions`,
  capacity: `SELECT sample.environment_id, sample.sample_id AS record_id, sample.resource, sample.current_use,
      sample.safe_limit, sample.sampled_at, forecast.level, forecast.forecast_exhaustion_days,
      forecast.early_action_required
    FROM admin_capacity_samples AS sample
    LEFT JOIN LATERAL (
      SELECT level, forecast_exhaustion_days, early_action_required
      FROM admin_capacity_forecasts
      WHERE environment_id = sample.environment_id AND resource = sample.resource
      ORDER BY calculated_at DESC LIMIT 1
    ) AS forecast ON TRUE`,
  environments: `SELECT id AS environment_id, id::text AS record_id, environment_identity, created_at FROM admin_operational_environments`,
  'audit-events': `SELECT environment_id, event_id AS record_id, actor_id, subject_id, action, scope, occurred_at FROM admin_operations_audit`,
  alerts: `SELECT alert.environment_id, alert.alert_id AS record_id, alert.subject_id, alert.severity,
      alert.channel_reference, alert.status, alert.created_at, alert.updated_at,
      acknowledgement.occurred_at AS acknowledged_at
    FROM admin_alerts AS alert
    LEFT JOIN admin_alert_acknowledgements AS acknowledgement
      ON acknowledgement.environment_id = alert.environment_id AND acknowledgement.alert_id = alert.alert_id`,
  'privacy-cases': `SELECT environment_id, case_id AS record_id, actor_id, legal_basis, status, version,
      created_at, completed_at, retention_expires_at FROM admin_privacy_cases`,
  'emergency-stops': `SELECT environment_id, stop_id AS record_id, actor_id, capability, reason, status, version,
      requested_at, expires_at, restored_at FROM admin_emergency_controls`,
} as const);

const operationTimestamp = (value: unknown): string => {
  const projected = text(value);
  if (projected.length === 0 || Number.isNaN(Date.parse(projected))) {
    throw new Error('ADMIN_OPERATION_TIMESTAMP_INVALID');
  }
  return projected;
};

const operationVersion = (row: Readonly<Record<string, unknown>>, observedAt: string): string => {
  const persisted = text(row['version']);
  if (/^(?:0|[1-9][0-9]{0,18})$/u.test(persisted)) return persisted;
  return String(Math.max(1, Date.parse(observedAt)));
};

const operationProjectionMetadata = (
  kind: string,
  recordId: string,
  version: string,
  observedAt: string,
  environmentKind: AdminEnvironment,
) => ({
  schemaVersion: '1.0' as const,
  aggregateVersion: version,
  etag: `admin-operations-${version}`,
  correlationId: `operations-${recordId}`,
  provenance: 'postgres-authority' as const,
  environment: {
    environmentId: 'synthetic-non-production',
    kind: environmentKind,
    label: environmentKind === 'staging' ? 'Staging' : 'Development',
  },
  freshness: {
    state: 'live' as const,
    source: 'postgres-admin-operations',
    sequence: version,
    observedAt,
  },
  kind,
});

const operationJobType = (value: unknown) => {
  const kind = text(value);
  return [
    'invitation-import',
    'invitation-export',
    'invitation-resend',
    'invitation-revoke',
    'reconciliation',
    'recalculation',
    'release',
    'configuration-export',
    'privacy-export',
  ].includes(kind)
    ? kind
    : 'reconciliation';
};

export const projectStagingAdminOperationRecord = (
  resource: keyof typeof OPERATIONS_QUERY,
  row: Readonly<Record<string, unknown>>,
  environmentKind: AdminEnvironment,
): Readonly<Record<string, unknown>> => {
  const recordId = text(row['record_id']);
  if (recordId.length === 0 || recordId.length > 128) {
    throw new Error('ADMIN_OPERATION_IDENTIFIER_INVALID');
  }
  const observedAt = operationTimestamp(
    row['updated_at'] ??
      row['occurred_at'] ??
      row['sampled_at'] ??
      row['created_at'] ??
      row['requested_at'],
  );
  const version = operationVersion(row, observedAt);
  const metadata = (kind: string) =>
    operationProjectionMetadata(kind, recordId, version, observedAt, environmentKind);
  let projection: Readonly<Record<string, unknown>>;
  switch (resource) {
    case 'queues':
    case 'jobs': {
      const affectedItems = Number(row['affected_items']);
      const totalItems = Math.max(affectedItems, Number(row['total_items']));
      projection = {
        ...metadata('admin-job-projection'),
        jobId: recordId,
        jobType: operationJobType(row['kind']),
        state: text(row['status']),
        progressPercent: Number(row['progress']),
        totalItems,
        completedItems: Number(row['completed_items']),
        failedItems: Number(row['failed_items']),
        ownerReference: text(row['claimed_by']) || 'unassigned',
        startedAt: operationTimestamp(row['created_at']),
        ...(text(row['receipt_id']).length === 0
          ? {}
          : { receiptReference: text(row['receipt_id']) }),
        ...(text(row['status']) === 'completed' ? { completedAt: observedAt } : {}),
      };
      break;
    }
    case 'views':
      projection = {
        ...metadata('admin-saved-view-projection'),
        savedViewId: recordId,
        domain: 'operation',
        name: text(row['name']),
        visibility: text(row['kind']),
        state: {
          filters: text(row['query_text']).length === 0 ? [] : [text(row['query_text'])],
          sort: [],
          density: 'comfortable',
        },
      };
      break;
    case 'inbox':
      projection = {
        ...metadata('admin-inbox-item-projection'),
        inboxItemId: recordId,
        severity:
          text(row['priority']) === 'critical'
            ? 'critical'
            : text(row['priority']) === 'urgent'
              ? 'warning'
              : 'information',
        state:
          text(row['status']) === 'closed'
            ? 'resolved'
            : text(row['status']) === 'acknowledged'
              ? 'acknowledged'
              : 'open',
        title: text(row['masked_title']),
        ...(text(row['owner_id']).length === 0 ? {} : { ownerReference: text(row['owner_id']) }),
        relatedRecordReference: recordId,
        updatedAt: observedAt,
      };
      break;
    case 'incidents':
      projection = {
        ...metadata('admin-incident-projection'),
        incidentId: recordId,
        severity:
          text(row['severity']) === 'critical'
            ? 'critical'
            : text(row['severity']) === 'urgent'
              ? 'warning'
              : 'information',
        state:
          text(row['status']) === 'recovery-started'
            ? 'contained'
            : text(row['status']) === 'recovered' || text(row['status']) === 'closed'
              ? 'resolved'
              : 'open',
        title: `Incident ${recordId}`,
        ownerReference: text(row['owner_id']),
        substituteReference: text(row['substitute_id']),
        affectedCapabilities: [text(row['procedure_version'])],
        impactReferences: [`incident-${recordId}`],
        nextUpdateAt: observedAt,
      };
      break;
    case 'exports':
      projection = {
        ...metadata('admin-export-projection'),
        exportId: recordId,
        state: text(row['status']),
        actorReference: text(row['actor_id']),
        purposeRedacted: 'Restricted administrative export purpose',
        fieldReferences: row['fields'],
        encrypted: true,
        masked: true,
        createdAt: operationTimestamp(row['created_at']),
        expiresAt: operationTimestamp(row['expires_at']),
      };
      break;
    case 'configurations':
      projection = {
        ...metadata('admin-configuration-projection'),
        configurationId: recordId,
        state:
          text(row['status']) === 'rolling-out'
            ? 'approval-pending'
            : text(row['status']) === 'published'
              ? 'published'
              : text(row['status']) === 'paused'
                ? 'paused'
                : text(row['status']) === 'rolled-back'
                  ? 'rolled-back'
                  : 'draft',
        version: text(row['known_version']),
        cohortReference: text(row['cohort']),
        validationReference: `validated-${text(row['known_version'])}`,
        ...(text(row['previous_version']).length === 0
          ? {}
          : { rollbackVersion: text(row['previous_version']) }),
      };
      break;
    case 'capacity': {
      const days = Number(row['forecast_exhaustion_days']);
      projection = {
        ...metadata('admin-capacity-projection'),
        capacityId: recordId,
        resourceReference: text(row['resource']),
        currentUse: text(row['current_use']),
        safeLimit: text(row['safe_limit']),
        ...(Number.isSafeInteger(days) && days >= 0
          ? {
              forecastExhaustionAt: new Date(
                Date.parse(observedAt) + days * 86_400_000,
              ).toISOString(),
            }
          : {}),
        recommendedAction: row['early_action_required'] === true ? 'review-capacity' : 'none',
        observedAt,
      };
      break;
    }
    case 'environments':
      projection = {
        ...metadata('admin-environment-projection'),
        environmentReference: text(row['environment_identity']),
        sessionEnvironment: environmentKind,
        integrationEnvironment: environmentKind,
        health: 'healthy',
        updatedAt: observedAt,
      };
      break;
    case 'audit-events':
      projection = {
        ...metadata('admin-audit-event-projection'),
        auditEventId: recordId,
        action: text(row['action']),
        scope: text(row['scope']),
        outcome: 'applied',
        actorReference: text(row['actor_id']),
        subjectReference: text(row['subject_id']),
        occurredAt: observedAt,
      };
      break;
    case 'alerts':
      projection = {
        ...metadata('admin-alert-projection'),
        alertId: recordId,
        severity:
          text(row['severity']) === 'critical'
            ? 'critical'
            : text(row['severity']) === 'urgent'
              ? 'warning'
              : 'information',
        state:
          text(row['status']) === 'acknowledged'
            ? 'acknowledged'
            : text(row['status']) === 'failed'
              ? 'failed'
              : 'open',
        ownerReference: text(row['channel_reference']),
        subjectReference: text(row['subject_id']),
        safeSummary: `Alert ${recordId}`,
        ...(text(row['acknowledged_at']).length === 0
          ? {}
          : { acknowledgedAt: operationTimestamp(row['acknowledged_at']) }),
      };
      break;
    case 'privacy-cases':
      projection = {
        ...metadata('admin-privacy-case-projection'),
        privacyCaseId: recordId,
        state:
          text(row['status']) === 'running'
            ? 'executing'
            : text(row['status']) === 'completed'
              ? 'completed'
              : text(row['status']) === 'failed'
                ? 'denied'
                : 'approval-pending',
        requestType: 'unspecified',
        subjectReference: text(row['actor_id']),
        legalBasisReference: 'legal-basis-recorded',
        dataCategoryReferences: ['requested-data-scope-redacted'],
        retentionReferences: [`retention-until-${operationTimestamp(row['retention_expires_at'])}`],
        ownerReference: text(row['actor_id']),
      };
      break;
    case 'emergency-stops':
      projection = {
        ...metadata('admin-emergency-stop-projection'),
        stopId: recordId,
        capabilityReference: text(row['capability']),
        state: text(row['status']),
        actorReference: text(row['actor_id']),
        reasonRedacted: 'Restricted emergency containment reason',
        requestedAt: operationTimestamp(row['requested_at']),
        expiresAt: operationTimestamp(row['expires_at']),
        ...(text(row['restored_at']).length === 0
          ? {}
          : { restoredAt: operationTimestamp(row['restored_at']) }),
        safeRestorationDefined: true,
      };
      break;
  }
  if (!controlPlaneDocumentValidator(projection)) {
    throw new Error(`ADMIN_OPERATION_PROJECTION_INVALID:${resource}:${recordId}`);
  }
  return Object.freeze(projection);
};

const operationsQueries = (
  database: PersistentAdminDatabase,
  environmentKind: AdminEnvironment,
): AdminOperationsRouteDependencies['queries'] => ({
  list: async ({ resource, targetEnvironment, limit }) => {
    if (targetEnvironment === 'production') throw new Error('PRODUCTION_ADMIN_QUERY_FORBIDDEN');
    const result = await database.query(
      `SELECT * FROM (${OPERATIONS_QUERY[resource]}) AS authority_record
       WHERE authority_record.environment_id = $1 ORDER BY authority_record.record_id DESC LIMIT $2`,
      [ADMIN_OPERATIONS_ENVIRONMENT_ID, limit],
    );
    const observedAt = new Date().toISOString();
    return {
      records: result.rows.map((row) =>
        projectStagingAdminOperationRecord(resource, row, environmentKind),
      ),
      nextCursor: null,
      freshness: {
        state: 'live',
        source: 'postgres-admin-operations',
        sequence: String(Math.max(1, Date.parse(observedAt))),
        observedAt,
      },
    };
  },
});

export const createPersistentStagingAdminAuthority = ({
  adminOrigin,
  authSecret,
  clock = { now: () => new Date() },
  database,
  environmentId,
  identity,
  strongAuth,
}: PersistentStagingAdminAuthorityInput): CompleteAdminRouteDependencies => {
  if (authSecret.length < 43) throw new Error('STAGING_ADMIN_AUTH_SECRET_REJECTED');
  if (environmentId === 'production') throw new Error('STAGING_ADMIN_ENVIRONMENT_REJECTED');
  const ids = Object.freeze({ next: randomUUID });
  const invitationsRepository = createPostgresAdminInvitationRepository(database);
  const governanceRepository = createPostgresAdminGovernanceRepository(database);
  const operationsRepository = createPostgresAdminOperationsRepository(database, {
    environment: environmentId,
    environmentId: ADMIN_OPERATIONS_ENVIRONMENT_ID,
  });
  const governance: AdminGovernanceDependencies = {
    authorization: {
      authorize: async ({ actorId, capability }) => {
        const membership = await governanceRepository.loadMembership(actorId);
        if (membership?.status !== 'active') return false;
        return membership.functions.some((adminFunction) =>
          governanceCapabilitiesFor(adminFunction).includes(capability),
        );
      },
    },
    stepUp: {
      verify: (evidence) =>
        Promise.resolve(
          evidence.method === 'totp' &&
            Date.parse(evidence.verifiedAt) <= clock.now().getTime() &&
            Date.parse(evidence.expiresAt) > clock.now().getTime(),
        ),
    },
    repository: governanceRepository,
    clock,
    ids,
  };
  const invitationAuthorization = async (actorId: string): Promise<boolean> => {
    const membership = await governanceRepository.loadMembership(actorId);
    return membership?.status === 'active' && membership.functions.includes('operations');
  };
  const invitations: AdminInvitationDependencies = {
    authorization: { authorize: ({ actorId }) => invitationAuthorization(actorId) },
    recipients: {
      hash: (recipient) =>
        createHmac('sha256', authSecret).update(recipient.trim().toLowerCase()).digest('hex'),
    },
    secrets: {
      issue: () => {
        const plaintext = randomBytes(32).toString('base64url');
        return {
          plaintext,
          digest: createHmac('sha256', authSecret).update(plaintext).digest('hex'),
        };
      },
      digest: (plaintext) => createHmac('sha256', authSecret).update(plaintext).digest('hex'),
    },
    delivery: {
      handoff: () => Promise.reject(new Error('STAGING_INVITATION_DELIVERY_PROVIDER_UNAVAILABLE')),
    },
    repository: invitationsRepository,
    clock,
    ids,
  };
  const operations: AdminOperationsDependencies = {
    authorization: {
      authorize: async ({ actorId, targetEnvironment }) => {
        const membership = await governanceRepository.loadMembership(actorId);
        if (
          membership?.status !== 'active' ||
          !membership.functions.includes('operations') ||
          targetEnvironment !== environmentId
        ) {
          return { allowed: false, code: 'AUTHORIZATION_FAILED' };
        }
        return {
          allowed: true,
          allowedScopes: membership.permissions.scopes,
          ownerId: actorId,
        };
      },
    },
    repository: operationsRepository,
    alerts: {
      send: async (alert) => {
        await database.query(
          `INSERT INTO admin_alerts
            (environment_id, alert_id, severity, status, title, owner_id, created_at)
           VALUES ($1, $2, $3, 'open', $4, $5, CURRENT_TIMESTAMP)
           ON CONFLICT (environment_id, alert_id) DO NOTHING`,
          [
            ADMIN_OPERATIONS_ENVIRONMENT_ID,
            alert.incidentId,
            alert.severity,
            `Incident ${alert.incidentId}`,
            alert.ownerReference,
          ],
        );
      },
    },
    clock,
    ids,
    environment: environmentId,
    allowedProcedureVersions: ['recover-provider-v1', 'recover-database-v1'],
    allowedEmergencyCapabilities: ['provider-checkout', 'invitation-delivery', 'admin-writes'],
  };
  const resolveSession = (request: FastifyRequest) =>
    resolveGovernanceSession(request, database, identity);
  const resolveStepUp = (request: FastifyRequest) =>
    resolveGovernanceStepUp(request, identity, database, strongAuth);
  const rateLimit = async (key: string) => {
    const result = await database.query(
      `SELECT COUNT(*)::integer AS count FROM admin_operations_audit
        WHERE actor_id = $1 AND occurred_at > CURRENT_TIMESTAMP - INTERVAL '1 minute'`,
      [key.split(':', 1)[0]],
    );
    return Number(result.rows[0]?.['count'] ?? 0) < 120;
  };
  const core = createPersistentStagingAdminDependencies({
    adminOrigin,
    clock,
    database,
    identity,
    ...(strongAuth === undefined ? {} : { strongAuth }),
  });
  const governanceRoutes: AdminGovernanceRouteDependencies = {
    allowedOrigin: adminOrigin,
    clock,
    csrfSecret: authSecret,
    environment: {
      environmentId: ADMIN_OPERATIONS_ENVIRONMENT_ID,
      kind: environmentId,
      label: environmentId === 'staging' ? 'Staging' : 'Development',
    },
    governance,
    inviteTeam: async (input) => {
      const recipientDigest = createHmac('sha256', authSecret)
        .update(input.recipient.trim().toLowerCase())
        .digest('hex');
      await database.query(
        `INSERT INTO admin_governance_audit
          (id, actor_id, subject_id, action, details, occurred_at)
         VALUES ($1, $2, $3, 'administrative-invitation-recorded', $4::jsonb, $5)`,
        [
          input.invitationId,
          input.actorId,
          input.invitationId,
          JSON.stringify({
            invitationKind: input.invitationKind,
            recipientDigest,
            functions: input.functions,
          }),
          clock.now().toISOString(),
        ],
      );
      return { ok: true, outcome: 'administrative-invitation-recorded' };
    },
    queries: governanceQueries(database),
    resolveSession,
    resolveStepUp,
    rateLimit,
  };
  const approvals: AdminApprovalRouteDependencies = {
    allowedOrigin: adminOrigin,
    csrfSecret: authSecret,
    environment: {
      environmentId: ADMIN_OPERATIONS_ENVIRONMENT_ID,
      kind: environmentId,
      label: environmentId === 'staging' ? 'Staging' : 'Development',
    },
    governance,
    queries: approvalQueries(database),
    resolveSession,
    resolveStepUp,
    loadBreakGlassContext: async (targetReference) => {
      const result = await database.query(
        `SELECT risk, expires_at FROM admin_approval_requests
          WHERE id = $1 AND status = 'approved' LIMIT 1`,
        [targetReference],
      );
      const row = result.rows[0];
      return row === undefined
        ? null
        : {
            administratorCount: 1,
            risk: text(row['risk']) as 'routine' | 'sensitive' | 'critical' | 'irreversible',
            massAction: false,
            strongFactor: 'passkey',
            safetyDelayUntil: clock.now().toISOString(),
            alertsSent: true,
          };
    },
    executeBreakGlass: async (input) => {
      await database.query(
        `INSERT INTO admin_governance_audit
          (id, actor_id, subject_id, action, details, occurred_at)
         VALUES ($1, $2, $3, 'break-glass-scheduled', $4::jsonb, $5)`,
        [
          randomUUID(),
          input.actorId,
          input.targetReference,
          JSON.stringify({
            commandId: input.commandId,
            executeAt: input.executeAt,
            expiresAt: input.expiresAt,
            authorizationContextId: input.authorizationContextId,
          }),
          clock.now().toISOString(),
        ],
      );
      return { ok: true, outcome: 'break-glass-scheduled' };
    },
    rateLimit,
    clock,
  };
  return Object.freeze({
    core,
    invitations: {
      allowedOrigin: adminOrigin,
      clock,
      csrfSecret: authSecret,
      environment: {
        environmentId: ADMIN_OPERATIONS_ENVIRONMENT_ID,
        kind: environmentId,
        label: environmentId === 'staging' ? 'Staging' : 'Development',
      },
      invitations,
      queries: invitationQueries(database),
      resolveSession: async (request: FastifyRequest) => {
        const session = await resolveSession(request);
        return session?.activeFunction === 'operations'
          ? {
              actorId: session.actorId,
              activeFunction: session.activeFunction,
              capabilities: [
                'beta-invitations:preflight',
                'beta-invitations:issue',
                'beta-invitations:manage',
                'beta-invitations:batch',
              ] as const,
              scopes: ['invitations'] as const,
            }
          : null;
      },
      rateLimit,
    },
    governance: governanceRoutes,
    approvals,
    operations: {
      allowedOrigin: adminOrigin,
      csrfSecret: authSecret,
      operations,
      queries: operationsQueries(database, environmentId),
      freshness: {
        current: async (
          input: Parameters<AdminOperationsRouteDependencies['freshness']['current']>[0],
        ) => {
          const result = await database.query(
            `SELECT COALESCE(MAX(occurred_at), CURRENT_TIMESTAMP) AS updated_at,
                    COUNT(*)::text AS version
               FROM admin_operations_audit WHERE actor_id = $1`,
            [input.actorId],
          );
          const version = text(result.rows[0]?.['version']) || '0';
          return {
            cursor: `operations-${version}`,
            version,
            updatedAt: text(result.rows[0]?.['updated_at']) || clock.now().toISOString(),
            resources: ['inbox', 'jobs', 'incidents', 'alerts'] as const,
          };
        },
      },
      resolveSession: async (request: FastifyRequest) => {
        const session = await resolveSession(request);
        return session?.activeFunction === 'operations'
          ? {
              sessionId: session.sessionId,
              actorId: session.actorId,
              activeFunction: session.activeFunction,
              capabilities: OPERATIONS_CAPABILITIES,
              scopes: session.dataScopes,
            }
          : null;
      },
      rateLimit,
      clock,
    },
  });
};

const authSecret = (environment: RealStagingEnvironment): string => {
  const value = environment.STAGING_AUTH_SECRET;
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{43,256}$/u.test(value)) {
    throw new Error('STAGING_API_STARTUP_REJECTED:STAGING_AUTH_SECRET');
  }
  return value;
};

const apiOrigin = (environment: RealStagingEnvironment): string => {
  const value = environment.STAGING_API_ORIGIN;
  try {
    const url = new URL(value ?? '');
    if (
      url.protocol !== 'https:' ||
      url.origin !== value ||
      url.pathname !== '/' ||
      url.username.length > 0 ||
      url.password.length > 0
    ) {
      throw new Error('invalid');
    }
    return value;
  } catch {
    throw new Error('STAGING_API_STARTUP_REJECTED:STAGING_API_ORIGIN');
  }
};

export const buildRealStagingApp = async (
  environmentInput: RealStagingEnvironment,
): Promise<FastifyInstance> => {
  const environment = admitApiEnvironment(environmentInput);
  const secret = authSecret(environmentInput);
  const issuer = apiOrigin(environmentInput);
  const database = createControlPlaneDatabase(environment.databaseUrl);

  try {
    await migrateControlPlane(database);
    await migrateRealIdentity(database);
    await migrateRuntimeAuthorities(database);
    await migrateAdminInvitations(database);
    await migrateAdminGovernance(database);
    await migrateAdminOperations(database);
    await migrateIdentityStrongAuth(database);
    await database.query('SELECT 1 AS authority_ready');
  } catch (error) {
    await database.close();
    throw error;
  }

  const app = Fastify({ logger: false, trustProxy: true });
  const allowedOrigins = new Set(environment.origins);
  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  });
  await app.register(cors, {
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    origin: (origin, callback) => {
      callback(null, origin === undefined || allowedOrigins.has(origin));
    },
    strictPreflight: true,
  });

  const identity = createRealIdentityAuthority(createPostgresIdentityPersistence(database));
  const clock = Object.freeze({ now: () => new Date() });
  const ids = Object.freeze({ next: randomUUID });
  const strongAuth = createStagingStrongAuth({
    clock,
    encryptionSecret: secret,
    repository: createPostgresStagingStrongAuthRepository(database),
  });
  const stripe = new Stripe(environment.stripeSecretKey, { typescript: true });
  const commerceProvider = createStripeCommerceProvider({
    checkoutBranding: {
      iconUrl: `${environment.accountOrigin}/icon.svg`,
    },
    database,
    stripe,
  });
  const resolveSessionActor = async (request: FastifyRequest) => {
    const credential = requestCredential(request);
    if (credential === null) return null;
    const actor = await identity.resolveCredential(credential);
    return actor === null ? null : { accountId: actor.accountId };
  };
  await registerRealIdentityRoutes(app, {
    accountOrigin: environment.accountOrigin,
    adminOrigin: environment.adminOrigin,
    authority: identity,
    csrfSecret: secret,
    issuer,
    resolveSecurityMethods: async (actor) => {
      const status = await strongAuth.status(actor);
      return status.enabled
        ? [
            {
              factor: status.factor,
              methodId: status.methodId,
              verifiedAt: status.verifiedAt,
            },
          ]
        : [];
    },
    resolveSubscription: (actor, correlation) =>
      resolveStagingSubscription(database, actor, correlation),
  });
  await registerStrongAuthRoutes(app, {
    allowedOrigins: [environment.accountOrigin, environment.adminOrigin],
    authority: strongAuth,
    csrfSecret: secret,
    resolveActor: async (request) => {
      const credential = requestCredential(request);
      return credential === null ? null : identity.resolveCredential(credential);
    },
  });
  await registerCommerceRoutes(app, {
    accountOrigin: environment.accountOrigin,
    management: {
      clock,
      ids,
      provider: commerceProvider,
      repository: createPostgresSubscriptionManagementRepository(database),
    },
    reconciliation: {
      clock,
      ids,
      provider: commerceProvider,
      repository: createPostgresCommerceAuthorityRepository(database),
    },
    resolveSessionActor,
    projectSubscription: async (accountId) =>
      (await projectRuntimeAggregate<SubscriptionState>(database, 'subscription', accountId)) ??
      freeSubscriptionState(accountId),
    listInvoices: async (accountId) => {
      const result = await database.query(
        `SELECT invoice.provider_invoice_id AS "invoiceId",
                invoice.status AS state,
                invoice.currency,
                invoice.amount_total_minor AS "amountDueMinor",
                invoice.amount_paid_minor AS "amountPaidMinor",
                invoice.provider_created_at AS "issuedAt",
                invoice.paid_at AS "paidAt"
           FROM invoices AS invoice
           INNER JOIN subscriptions AS subscription ON subscription.id = invoice.subscription_id
          WHERE subscription.identity_id = $1
          ORDER BY invoice.provider_created_at DESC`,
        [accountId],
      );
      return result.rows;
    },
    admitSignedWebhook: async (request) => {
      const body = signedWebhookBody(request);
      const signature = request.headers['stripe-signature'];
      if (body === null || typeof signature !== 'string') return null;
      const verified = await verifyRawWebhook({
        rawBody: body,
        signatureHeader: signature,
        webhookSecret: environment.stripeWebhookSecret,
        stripe,
      });
      return verified.ok ? verified.value.providerEvent : null;
    },
    createBillingPortal: async (accountId, locale) => {
      const portal = await commerceProvider.createBillingPortal({
        accountId,
        returnUrl: accountSubscriptionUrl(environment.accountOrigin, locale),
      });
      return portal.ok ? { ok: true, portalUrl: portal.value.portalUrl } : { ok: false };
    },
  });
  const deviceRepository = createPostgresDeviceBindingRepository(database);
  await registerDeviceRoutes(app, {
    authority: {
      clock,
      ids,
      repository: deviceRepository,
      authorizer: {
        authorize: ({ actorAccountId, accountId }) => Promise.resolve(actorAccountId === accountId),
      },
    },
    evidenceProtector: createDeviceEvidenceProtector({
      contextSecret: createHmac('sha256', secret)
        .update('liiiraa-device-evidence-context-secret-v1')
        .digest('base64url'),
      wrappingKey: createHmac('sha256', secret)
        .update('liiiraa-device-evidence-wrapping-key-v1')
        .digest('base64url'),
      contextVersion: '1',
      keyVersion: 1,
    }),
    resolveSessionActor,
    project: async (accountId, correlationId) => {
      const records = await listRuntimeAuthority<DeviceBindingRecord>(
        database,
        'device',
        accountId,
      );
      const current = records[0];
      return current === undefined ? null : deviceProjection(current, correlationId);
    },
  });
  const supportRepository = createPostgresSupportLifecycleRepository(database);
  await registerSupportRoutes(app, {
    cases: { clock, ids, repository: supportRepository },
    consents: {
      clock,
      ids,
      repository: supportRepository,
      consentChanges: { publish: () => undefined },
    },
    deletion: { clock, ids, repository: supportRepository },
    resolveSessionActor,
    verifyStrongReauthentication: async (request) => {
      const credential = requestCredential(request);
      if (credential === null) return false;
      const actor = await identity.resolveCredential(credential);
      return (
        actor !== null &&
        actor.authenticationMethod === 'password' &&
        Date.now() - Date.parse(actor.authenticatedAt) <= 10 * 60 * 1_000
      );
    },
    listCases: (accountId) =>
      listRuntimeAuthority<SupportCaseState>(database, 'support-case', accountId),
    listAttachmentMetadata: async (accountId, caseId) => {
      const state = await projectRuntimeAggregate<SupportCaseState>(
        database,
        'support-case',
        caseId,
      );
      return state?.accountId === accountId ? state.attachments : [];
    },
    projectDeletion: (accountId) =>
      projectRuntimeAggregate<AccountDeletionState>(database, 'account-deletion', accountId),
  });
  await registerCompleteAdminRoutes(
    app,
    createPersistentStagingAdminAuthority({
      adminOrigin: environment.adminOrigin,
      authSecret: secret,
      database,
      environmentId: 'staging',
      identity,
      strongAuth,
    }),
  );

  app.get('/health', () => ({ status: 'ok' }));
  app.get('/ready', async (_request, reply) => {
    try {
      const authority = await database.query<{
        invitations_ready: boolean;
        governance_ready: boolean;
        operations_ready: boolean;
        worker_ready: boolean;
      }>(
        `SELECT
           to_regclass('admin_invitations') IS NOT NULL AS invitations_ready,
           to_regclass('admin_governance_memberships') IS NOT NULL AS governance_ready,
           to_regclass('admin_operational_environments') IS NOT NULL AS operations_ready,
           to_regprocedure('claim_admin_operational_job_items(uuid,text,integer,timestamptz)')
             IS NOT NULL AS worker_ready`,
      );
      const readiness = authority.rows[0];
      if (
        readiness === undefined ||
        !readiness.invitations_ready ||
        !readiness.governance_ready ||
        !readiness.operations_ready ||
        !readiness.worker_ready
      ) {
        throw new Error('STAGING_ADMIN_AUTHORITY_INCOMPLETE');
      }
      return await reply.code(200).send({
        authorityConnected: true,
        buildId: environment.buildId,
        capabilities: REAL_STAGING_CAPABILITIES,
        dataClassification: environment.dataClassification,
        invitationOnly: environment.invitationOnly,
        ready: true,
      });
    } catch {
      return await reply.code(503).send({
        authorityConnected: false,
        buildId: environment.buildId,
        ready: false,
      });
    }
  });
  app.addHook('onClose', async () => {
    await database.close();
  });
  await app.ready();
  return app;
};

export const startRealStagingServer = async (
  environment: RealStagingEnvironment,
): Promise<FastifyInstance> => {
  const port = Number(environmentInputPort(environment));
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('STAGING_API_STARTUP_REJECTED:PORT');
  }
  const app = await buildRealStagingApp(environment);
  await app.listen({ host: environment.HOST ?? '0.0.0.0', port });
  return app;
};

const environmentInputPort = (environment: RealStagingEnvironment): string =>
  environment.PORT ?? '3000';
