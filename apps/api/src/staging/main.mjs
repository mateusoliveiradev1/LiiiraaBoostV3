import 'tsx/esm';

let app;
try {
  const { startRealStagingServer } = await import('./runtime.ts');
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
