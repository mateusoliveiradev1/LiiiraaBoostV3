const deploymentRevision = (): string => {
  const revision = process.env['VERCEL_GIT_COMMIT_SHA'];
  return revision !== undefined && /^[0-9a-f]{40}$/u.test(revision) ? revision : 'unavailable';
};

export function GET(): Response {
  return Response.json(
    { revision: deploymentRevision() },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      },
    },
  );
}
