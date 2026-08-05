import type { FastifyInstance } from 'fastify';

import { buildApp, type ApiModuleRegistrar } from './app.js';
import type { ApiEnvironmentInput } from './config/env.js';

export interface StartServerOptions {
  readonly environment: ApiEnvironmentInput;
  readonly modules: readonly ApiModuleRegistrar[];
  readonly host?: string;
  readonly port?: number;
}

export const startServer = async (options: StartServerOptions): Promise<FastifyInstance> => {
  const app = await buildApp({ environment: options.environment, modules: options.modules });
  await app.listen({
    host: options.host ?? '0.0.0.0',
    port: options.port ?? 3_000,
  });
  return app;
};
