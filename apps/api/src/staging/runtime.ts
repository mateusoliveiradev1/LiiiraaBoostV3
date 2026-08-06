import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { randomUUID } from 'node:crypto';
import type {
  AccountDeletionState,
  ActiveAdminRoleSession,
  AdminCommandDependencies,
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
  createControlPlaneDatabase,
  createPostgresIdentityPersistence,
  createRealIdentityAuthority,
  migrateControlPlane,
  migrateRealIdentity,
  migrateRuntimeAuthorities,
  type IdentityActor,
} from '@liiiraa/control-plane-adapters/runtime-identity';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import Stripe from 'stripe';

import { admitApiEnvironment, type ApiEnvironmentInput } from '../config/env.ts';
import { registerAdminRoutes, type AdminRouteDependencies } from '../modules/admin/routes.ts';
import { accountSubscriptionUrl, registerCommerceRoutes } from '../modules/commerce/routes.ts';
import { registerDeviceRoutes } from '../modules/devices/routes.ts';
import { registerRealIdentityRoutes } from '../modules/identity/real-routes.ts';
import { registerSupportRoutes } from '../modules/support/routes.ts';

export const REAL_STAGING_CAPABILITIES = Object.freeze([
  'invitation-signup',
  'password-session',
  'desktop-pkce',
  'account',
  'commerce-stripe-test',
  'billing-portal',
  'device-authority',
  'support-consent-authority',
  'admin-read-authority',
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
}

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
): Promise<IdentityActor | null> => {
  const credential = cookieCredential(request);
  if (credential === null) return null;
  const actor = await identity.resolveCredential(credential);
  return actor !== null &&
    actor.sessionKind === 'admin' &&
    actor.role !== 'tester' &&
    ADMIN_ROLES.has(actor.role)
    ? actor
    : null;
};

const adminSession = (actor: IdentityActor): ActiveAdminRoleSession =>
  Object.freeze({
    actorId: actor.accountId,
    assumedAt: actor.authenticatedAt,
    expiresAt: actor.expiresAt,
    nonProduction: true,
    premiumTestGrant: false,
    role: actor.role as ActiveAdminRoleSession['role'],
    sessionId: actor.sessionId,
  });

const projectionStatement = (resource: AdminProjectionResource): string => {
  switch (resource) {
    case 'support-case':
      return `SELECT id::text AS id, status, priority, assigned_role
        FROM support_cases ORDER BY created_at DESC LIMIT ${ADMIN_RECORD_LIMIT}`;
    case 'device':
      return `SELECT id::text AS id, bound_at, revoked_at, replacement_available_at
        FROM device_bindings ORDER BY bound_at DESC LIMIT ${ADMIN_RECORD_LIMIT}`;
    case 'entitlement':
      return `SELECT id::text AS id, status, source, valid_until
        FROM premium_entitlements ORDER BY created_at DESC LIMIT ${ADMIN_RECORD_LIMIT}`;
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

const deniedRoleAuthority = (clock: Readonly<{ now(): Date }>): AdminRoleAuthorityDependencies => ({
  clock,
  ids: { next: randomUUID },
  repository: {
    transaction: () => Promise.reject(new Error('STAGING_ADMIN_ROLE_MUTATION_UNAVAILABLE')),
  },
});

const deniedCommandAuthority = (clock: Readonly<{ now(): Date }>): AdminCommandDependencies => ({
  clock,
  ids: { next: randomUUID },
  repository: {
    transaction: () => Promise.reject(new Error('STAGING_ADMIN_COMMAND_UNAVAILABLE')),
  },
});

export const createPersistentStagingAdminDependencies = ({
  adminOrigin,
  clock = { now: () => new Date() },
  database,
  identity,
}: PersistentStagingAdminInput): AdminRouteDependencies => {
  const listProjection = async (resource: AdminProjectionResource) => {
    const result = await database.query(projectionStatement(resource));
    return result.rows.flatMap((row) => {
      const id = admittedId(row['id']);
      if (id === null) return [];
      const summary = projectionSummary(resource, row).slice(0, 256);
      return [Object.freeze({ id, ...(summary.length === 0 ? {} : { summary }) })];
    });
  };
  return Object.freeze({
    allowedOrigin: adminOrigin,
    commands: deniedCommandAuthority(clock),
    listProjection,
    loadProjection: async (resource: AdminProjectionResource, id: string) =>
      (await listProjection(resource)).find((record) => record.id === id) ?? null,
    resolveAdminSession: async (
      request: Parameters<AdminRouteDependencies['resolveAdminSession']>[0],
    ) => {
      const actor = await persistedOperator(request, identity);
      return actor === null ? null : adminSession(actor);
    },
    resolveDeveloperActor: () => Promise.resolve(null),
    resolveStepUp: () => Promise.resolve(null),
    roles: deniedRoleAuthority(clock),
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
    resolveSubscription: (actor, correlation) =>
      resolveStagingSubscription(database, actor, correlation),
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
  await registerAdminRoutes(
    app,
    createPersistentStagingAdminDependencies({
      adminOrigin: environment.adminOrigin,
      database,
      identity,
    }),
  );

  app.get('/health', () => ({ status: 'ok' }));
  app.get('/ready', async (_request, reply) => {
    try {
      await database.query('SELECT 1 AS authority_ready');
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
