import 'tsx/esm';

const safeStartupDiagnostic = (error) => {
  const name = error instanceof Error ? error.name : 'UnknownError';
  const message = error instanceof Error ? error.message : String(error);
  const code =
    typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : 'NO_CODE';
  return `${name}:${code}:${message}`
    .replace(/postgres(?:ql)?:\/\/[^\s]+/giu, '[REDACTED_DATABASE_URL]')
    .replace(/(?:sk_(?:live|test)|whsec)_[A-Za-z0-9_]+/gu, '[REDACTED_PROVIDER_SECRET]')
    .replace(/[\r\n]+/gu, ' ')
    .slice(0, 320);
};

let app;
try {
  const { startRealStagingServer } = await import('./runtime.ts');
  app = await startRealStagingServer(process.env);
} catch (error) {
  console.error(`STAGING_API_STARTUP_FAILED:${safeStartupDiagnostic(error)}`);
  process.exitCode = 1;
}

const shutdown = () => {
  void app?.close();
};
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
