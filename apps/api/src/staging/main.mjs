import { startRealStagingServer } from './runtime.ts';

let app;
try {
  app = await startRealStagingServer(process.env);
} catch {
  console.error('STAGING_API_STARTUP_FAILED');
  process.exitCode = 1;
}

const shutdown = () => {
  void app?.close();
};
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
