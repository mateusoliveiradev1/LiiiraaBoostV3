import type { AdminCommandJson, AdminRoleJson } from '@liiiraa/contracts-ts';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { describe, expect, it } from 'vitest';

const ADMIN_AUTHORIZATION_RED_OWNER = '04-16-01';

const ADMIN_ORIGIN = 'https://admin.test.liiiraa.dev';
const NOW = '2030-02-01T12:00:00.000Z';

interface AdminSession {
  readonly sessionId: string;
  readonly actorId: string;
  readonly role: AdminRoleJson;
  readonly assumedAt: string;
  readonly expiresAt: string;
  readonly nonProduction: true;
  readonly premiumTestGrant: boolean;
}

interface RouteDependencies {
  readonly allowedOrigin: string;
  readonly resolveDeveloperActor: (
    request: FastifyRequest,
  ) => Promise<Readonly<{ actorId: string; nonProduction: boolean }> | null>;
  readonly resolveAdminSession: (request: FastifyRequest) => Promise<AdminSession | null>;
  readonly resolveStepUp: (
    request: FastifyRequest,
  ) => Promise<Readonly<Record<string, unknown>> | null>;
  readonly roles: Readonly<Record<string, unknown>>;
  readonly commands: Readonly<Record<string, unknown>>;
  readonly listProjection: (
    resource: string,
  ) => Promise<readonly Readonly<Record<string, unknown>>[]>;
  readonly loadProjection: (
    resource: string,
    id: string,
  ) => Promise<Readonly<Record<string, unknown>> | null>;
}

type RoutesModule = Readonly<{
  registerAdminRoutes?: (app: FastifyInstance, dependencies: RouteDependencies) => Promise<void>;
}>;

type ApplicationModule = Readonly<{
  assumeAdminRole?: (...args: never[]) => unknown;
  executeAdminCommand?: (...args: never[]) => unknown;
}>;

const ROUTES_MODULE_PATH = './routes.ts';
const APPLICATION_MODULE_PATH = '@liiiraa/control-plane-application';

const loadRoutes = async (): Promise<RoutesModule> =>
  import(ROUTES_MODULE_PATH)
    .then((module) => module as RoutesModule)
    .catch((): RoutesModule => ({}));

const loadApplication = async (): Promise<ApplicationModule> =>
  import(APPLICATION_MODULE_PATH)
    .then((module) => module as ApplicationModule)
    .catch((): ApplicationModule => ({}));

const requireFunction = <T extends (...args: never[]) => unknown>(
  value: T | undefined,
  id: string,
): T => {
  if (typeof value !== 'function') {
    throw new Error(
      `EXPECTED_RED[${ADMIN_AUTHORIZATION_RED_OWNER}][${id}]: production admin authority is not implemented`,
    );
  }
  return value;
};

const command = (): AdminCommandJson => ({
  schemaVersion: '1.0',
  kind: 'admin-command',
  commandId: 'admin-command-001',
  actorId: 'developer-001',
  assumedRole: 'security',
  action: 'revoke-session',
  redactedTarget: 'session:[redacted]-001',
  reason: 'contain reviewed credential abuse',
  authorizationContextId: 'step-up-001',
  expectedVersion: '1',
  correlationId: 'admin-correlation-001',
  requestedAt: NOW,
});

const securitySession: AdminSession = Object.freeze({
  sessionId: 'admin-session-001',
  actorId: 'developer-001',
  role: 'security',
  assumedAt: '2030-02-01T11:55:00.000Z',
  expiresAt: '2030-02-01T13:00:00.000Z',
  nonProduction: true,
  premiumTestGrant: false,
});

const createRoleRepository = () => {
  let active: AdminSession | null = null;
  const audits: Readonly<Record<string, unknown>>[] = [];
  return {
    transaction: async <T>(
      _actorId: string,
      operation: (transaction: Readonly<Record<string, unknown>>) => Promise<T>,
    ): Promise<T> =>
      operation({
        loadActive: () => Promise.resolve(active),
        replaceActive: (next: AdminSession | null) => {
          active = next;
          return Promise.resolve();
        },
        appendAudit: (event: Readonly<Record<string, unknown>>) => {
          (audits as Readonly<Record<string, unknown>>[]).push(event);
          return Promise.resolve();
        },
        enqueueOutbox: () => Promise.resolve(),
      }),
    active: () => active,
    audits: () => audits,
  };
};

const createCommandRepository = () => {
  const audits: Readonly<Record<string, unknown>>[] = [];
  const outbox: Readonly<Record<string, unknown>>[] = [];
  let loadCount = 0;
  return {
    transaction: async <T>(
      _target: string,
      operation: (transaction: Readonly<Record<string, unknown>>) => Promise<T>,
    ): Promise<T> =>
      operation({
        findCommandResult: () => Promise.resolve(null),
        loadAggregate: () => {
          loadCount += 1;
          return Promise.resolve({ version: 1n, state: 'active' });
        },
        apply: () => Promise.resolve({ version: 2n, state: 'revoked' }),
        appendAudit: (event: Readonly<Record<string, unknown>>) => {
          (audits as Readonly<Record<string, unknown>>[]).push(event);
          return Promise.resolve('audit-admin-001');
        },
        enqueueOutbox: (event: Readonly<Record<string, unknown>>) => {
          (outbox as Readonly<Record<string, unknown>>[]).push(event);
          return Promise.resolve();
        },
        rememberCommandResult: () => Promise.resolve(),
      }),
    audits: () => audits,
    outbox: () => outbox,
    loadCount: () => loadCount,
  };
};

const stepUp = (overrides: Readonly<Record<string, unknown>> = {}) => ({
  method: 'passkey',
  verifiedAt: '2030-02-01T11:58:00.000Z',
  expiresAt: '2030-02-01T12:03:00.000Z',
  authorizationContextId: 'step-up-001',
  actorId: 'developer-001',
  action: 'revoke-session',
  resource: 'session',
  redactedTarget: 'session:[redacted]-001',
  ...overrides,
});

const buildApp = async (
  options: Readonly<{
    session?: AdminSession;
    stepUp?: Readonly<Record<string, unknown>> | null;
  }> = {},
) => {
  const routes = await loadRoutes();
  const register = requireFunction(routes.registerAdminRoutes, 'route-composition');
  const roleRepository = createRoleRepository();
  const commandRepository = createCommandRepository();
  const app = Fastify();
  await register(app, {
    allowedOrigin: ADMIN_ORIGIN,
    resolveDeveloperActor: () => Promise.resolve({ actorId: 'developer-001', nonProduction: true }),
    resolveAdminSession: () => Promise.resolve(options.session ?? securitySession),
    resolveStepUp: () => Promise.resolve(options.stepUp === undefined ? stepUp() : options.stepUp),
    roles: {
      repository: roleRepository,
      clock: { now: () => new Date(NOW) },
      ids: { next: () => 'admin-session-next' },
    },
    commands: {
      repository: commandRepository,
      clock: { now: () => new Date(NOW) },
      ids: { next: () => 'admin-result-next' },
    },
    listProjection: (resource) => Promise.resolve([{ id: `${resource}-001`, resource }]),
    loadProjection: (resource, id) => Promise.resolve({ id, resource }),
  });
  return { app, roleRepository, commandRepository };
};

describe('admin-authorization pre-implementation API witnesses', () => {
  it('WEB-06 singular assumed role', async () => {
    const application = await loadApplication();
    const assume = requireFunction(application.assumeAdminRole, 'WEB-06 singular assumed role');
    expect(assume).toBeTypeOf('function');
    const { app, roleRepository } = await buildApp();

    const first = await app.inject({
      method: 'POST',
      url: '/v1/admin/roles/assume',
      headers: { origin: ADMIN_ORIGIN },
      payload: { role: 'support', reason: 'begin support duty', premiumTestGrant: true },
    });
    expect(first.statusCode).toBe(201);
    const handoff = await app.inject({
      method: 'POST',
      url: '/v1/admin/roles/handoff',
      headers: { origin: ADMIN_ORIGIN },
      payload: { role: 'operations', reason: 'release support access after escalation' },
    });
    expect(handoff.statusCode).toBe(200);
    expect(roleRepository.active()).toMatchObject({ role: 'operations' });
    expect(roleRepository.active()).not.toHaveProperty('roles');
    expect(roleRepository.audits()).toHaveLength(2);
    await app.close();
  });

  it('WEB-06 resource-action authorization', async () => {
    const { app } = await buildApp({ session: { ...securitySession, role: 'support' } });
    const denied = await app.inject({
      method: 'GET',
      url: '/v1/admin/sessions',
      headers: { origin: ADMIN_ORIGIN },
    });
    expect(denied.statusCode).toBe(404);
    expect(denied.json()).toEqual({ records: [] });
    const allowed = await app.inject({
      method: 'GET',
      url: '/v1/admin/support-cases',
      headers: { origin: ADMIN_ORIGIN },
    });
    expect(allowed.statusCode).toBe(200);
    expect(allowed.json().records).toHaveLength(1);
    await app.close();
  });

  it('IDEN-03 scoped step-up', async () => {
    const application = await loadApplication();
    const execute = requireFunction(application.executeAdminCommand, 'IDEN-03 scoped step-up');
    expect(execute).toBeTypeOf('function');
    const { app, commandRepository } = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/admin/commands',
      headers: { origin: ADMIN_ORIGIN },
      payload: { command: command(), impactReviewed: true, confirmed: true },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ ok: true, auditReference: 'audit-admin-001' });
    expect(commandRepository.loadCount()).toBe(1);
    expect(commandRepository.audits()).toHaveLength(1);
    expect(commandRepository.outbox()).toHaveLength(1);
    await app.close();
  });

  it('IDEN-03 stale or mismatched step-up', async () => {
    for (const evidence of [
      stepUp({ verifiedAt: '2030-02-01T11:50:00.000Z' }),
      stepUp({ action: 'revoke-device' }),
      stepUp({ redactedTarget: 'session:[redacted]-other' }),
    ]) {
      const { app, commandRepository } = await buildApp({ stepUp: evidence });
      const response = await app.inject({
        method: 'POST',
        url: '/v1/admin/commands',
        headers: { origin: ADMIN_ORIGIN },
        payload: { command: command(), impactReviewed: true, confirmed: true },
      });
      expect(response.statusCode).toBe(403);
      expect(commandRepository.loadCount()).toBe(0);
      expect(commandRepository.audits()).toHaveLength(0);
      await app.close();
    }
  });
});
