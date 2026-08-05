import Fastify, { type FastifyInstance } from 'fastify';

import { admitApiEnvironment, type ApiEnvironmentInput } from '../config/env.js';

export interface StartStagingInfrastructureServerOptions {
  readonly environment: ApiEnvironmentInput;
  readonly host?: string;
  readonly port?: number;
}

export const buildStagingInfrastructureApp = async (
  environment: ApiEnvironmentInput,
): Promise<FastifyInstance> => {
  const admitted = admitApiEnvironment(environment);
  const app = Fastify({ logger: false, trustProxy: false });

  app.get('/health', () => ({ status: 'ok' }));
  app.get('/ready', () => ({
    authorityConnected: false,
    buildId: admitted.buildId,
    dataClassification: admitted.dataClassification,
    invitationOnly: admitted.invitationOnly,
    mode: 'bounded-provider-preview',
    ready: true,
  }));

  await app.ready();
  return app;
};

export const startStagingInfrastructureServer = async (
  options: StartStagingInfrastructureServerOptions,
): Promise<FastifyInstance> => {
  const app = await buildStagingInfrastructureApp(options.environment);
  await app.listen({
    host: options.host ?? '0.0.0.0',
    port: options.port ?? 3_000,
  });
  return app;
};
