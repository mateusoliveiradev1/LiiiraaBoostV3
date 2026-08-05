import { createServer } from 'node:http';

import { admitApiEnvironment } from '../config/env.ts';

const admitted = admitApiEnvironment(process.env);
const port = Number(process.env.PORT ?? '3000');

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error('STAGING_API_STARTUP_REJECTED:PORT');
}

const payloads = new Map([
  ['/health', { status: 'ok' }],
  [
    '/ready',
    {
      authorityConnected: false,
      buildId: admitted.buildId,
      dataClassification: admitted.dataClassification,
      invitationOnly: admitted.invitationOnly,
      mode: 'bounded-provider-preview',
      ready: true,
    },
  ],
]);

const server = createServer((request, response) => {
  const payload = request.method === 'GET' ? payloads.get(request.url ?? '') : undefined;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (payload === undefined) {
    response.writeHead(404).end(JSON.stringify({ code: 'NOT_FOUND' }));
    return;
  }
  response.writeHead(200).end(JSON.stringify(payload));
});

server.listen(port, process.env.HOST ?? '0.0.0.0');

const shutdown = () => server.close();
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
