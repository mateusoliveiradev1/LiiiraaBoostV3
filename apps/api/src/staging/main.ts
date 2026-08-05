import type { ApiEnvironmentInput } from '../config/env.js';
import { startStagingInfrastructureServer } from './infrastructure-server.js';

interface StagingProcess {
  readonly env: ApiEnvironmentInput & Readonly<Record<string, string | undefined>>;
}

const stagingProcess = (globalThis as unknown as { readonly process: StagingProcess }).process;
const configuredPort = Number(stagingProcess.env['PORT'] ?? '3000');

if (!Number.isInteger(configuredPort) || configuredPort < 1 || configuredPort > 65_535) {
  throw new Error('STAGING_API_STARTUP_REJECTED:PORT');
}

await startStagingInfrastructureServer({
  environment: stagingProcess.env,
  host: stagingProcess.env['HOST'] ?? '0.0.0.0',
  port: configuredPort,
});
