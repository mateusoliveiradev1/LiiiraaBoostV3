import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import {
  createControlPlaneDatabase,
  createPostgresIdentityPersistence,
  createRealIdentityAuthority,
  migrateControlPlane,
  migrateRealIdentity,
} from '@liiiraa/control-plane-adapters';
import Fastify, { type FastifyInstance } from 'fastify';

import { admitApiEnvironment, type ApiEnvironmentInput } from '../config/env.js';
import { registerRealIdentityRoutes } from '../modules/identity/real-routes.js';

export interface RealStagingEnvironment extends ApiEnvironmentInput {
  readonly STAGING_AUTH_SECRET?: string;
}

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
  await registerRealIdentityRoutes(app, {
    accountOrigin: environment.accountOrigin,
    adminOrigin: environment.adminOrigin,
    authority: identity,
    csrfSecret: secret,
    issuer,
  });

  app.get('/health', () => ({ status: 'ok' }));
  app.get('/ready', async (_request, reply) => {
    try {
      await database.query('SELECT 1 AS authority_ready');
      return await reply.code(200).send({
        authorityConnected: true,
        buildId: environment.buildId,
        capabilities: ['invitation-signup', 'password-session', 'desktop-pkce', 'account'],
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
