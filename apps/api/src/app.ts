import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import Fastify, { type FastifyInstance } from 'fastify';

import {
  admitApiEnvironment,
  type ApiEnvironmentInput,
} from './config/env.js';

export const REQUIRED_API_MODULES = Object.freeze([
  'identity',
  'security',
  'account',
  'commerce',
  'devices',
  'entitlements',
  'support',
  'admin',
  'commerce-worker',
  'email-worker',
  'privacy-lifecycle-worker',
  'audit-anchor-worker',
] as const);

export type ApiModuleName = (typeof REQUIRED_API_MODULES)[number];

export interface ApiModuleRegistrar {
  readonly name: ApiModuleName;
  readonly register: (app: FastifyInstance) => Promise<void>;
}

export interface BuildAppOptions {
  readonly environment: ApiEnvironmentInput;
  readonly modules: readonly ApiModuleRegistrar[];
}

export const registerApiModules = async (
  app: FastifyInstance,
  modules: readonly ApiModuleRegistrar[],
): Promise<void> => {
  const expected = new Set<ApiModuleName>(REQUIRED_API_MODULES);
  const actual = new Set<ApiModuleName>();
  for (const module of modules) {
    if (!expected.has(module.name) || actual.has(module.name)) {
      throw new Error(`API_MODULE_COMPOSITION_REJECTED:${module.name}`);
    }
    actual.add(module.name);
  }
  const missing = REQUIRED_API_MODULES.find((name) => !actual.has(name));
  if (missing !== undefined) throw new Error(`API_MODULE_COMPOSITION_REJECTED:${missing}`);

  const byName = new Map(modules.map((module) => [module.name, module] as const));
  for (const name of REQUIRED_API_MODULES) {
    const module = byName.get(name);
    if (module === undefined) throw new Error(`API_MODULE_COMPOSITION_REJECTED:${name}`);
    await module.register(app);
  }
};

export const buildApp = async (options: BuildAppOptions): Promise<FastifyInstance> => {
  const environment = admitApiEnvironment(options.environment);
  const app = Fastify({
    logger: false,
    trustProxy: false,
  });
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
  app.get('/health', () => ({ status: 'ok' }));
  app.get('/ready', () => ({
    ready: true,
    buildId: environment.buildId,
    dataClassification: environment.dataClassification,
    invitationOnly: environment.invitationOnly,
    modules: REQUIRED_API_MODULES,
  }));
  await registerApiModules(app, options.modules);
  await app.ready();
  return app;
};
