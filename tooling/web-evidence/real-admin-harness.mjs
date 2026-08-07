import { spawn } from 'node:child_process';
import { Buffer } from 'node:buffer';
import { webcrypto } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { createServer as createHttpsServer, request as httpsRequest } from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import * as x509 from '@peculiar/x509';

const repositoryRoot = new URL('../..', import.meta.url).pathname.replace(
  /^\/(?:[A-Za-z]:)/u,
  (value) => value.slice(1),
);
const databaseUrl = process.env['STAGING_DATABASE_URL'];
if (databaseUrl === undefined || !databaseUrl.includes('liiiraa_staging')) {
  throw new Error('REAL_ADMIN_HARNESS_REJECTED:STAGING_DATABASE_URL');
}

const origins = Object.freeze({
  account: 'https://account.staging.localhost:3445',
  admin: 'https://admin.staging.localhost:3444',
  api: 'https://api.staging.localhost:3443',
  public: 'https://public.staging.localhost:3446',
});
const pnpmEntry = process.env['npm_execpath'];
if (pnpmEntry === undefined) throw new Error('REAL_ADMIN_HARNESS_REJECTED:PNPM');

const temporaryDirectory = await mkdtemp(join(tmpdir(), 'liiiraa-admin-e2e-'));
const certificatePath = join(temporaryDirectory, 'localhost-ca.pem');
const children = [];
const servers = [];
let stopping = false;

const pem = (label, value) => {
  const base64 =
    Buffer.from(value)
      .toString('base64')
      .match(/.{1,64}/gu)
      ?.join('\n') ?? '';
  return `-----BEGIN ${label}-----\n${base64}\n-----END ${label}-----\n`;
};

const createCertificate = async () => {
  x509.cryptoProvider.set(webcrypto);
  const algorithm = {
    hash: 'SHA-256',
    modulusLength: 2048,
    name: 'RSASSA-PKCS1-v1_5',
    publicExponent: new Uint8Array([1, 0, 1]),
  };
  const keys = await webcrypto.subtle.generateKey(algorithm, true, ['sign', 'verify']);
  const certificate = await x509.X509CertificateGenerator.createSelfSigned({
    extensions: [
      new x509.BasicConstraintsExtension(true, 0, true),
      new x509.KeyUsagesExtension(
        x509.KeyUsageFlags.digitalSignature | x509.KeyUsageFlags.keyCertSign,
        true,
      ),
      new x509.SubjectAlternativeNameExtension([
        { type: 'dns', value: 'admin.staging.localhost' },
        { type: 'dns', value: 'api.staging.localhost' },
        { type: 'dns', value: 'account.staging.localhost' },
        { type: 'dns', value: 'public.staging.localhost' },
        { type: 'ip', value: '127.0.0.1' },
      ]),
    ],
    keys,
    name: 'CN=Liiiraa Boost local staging evidence',
    notAfter: new Date(Date.now() + 24 * 60 * 60_000),
    notBefore: new Date(Date.now() - 60_000),
    serialNumber: Date.now().toString(16),
    signingAlgorithm: algorithm,
  });
  const privateKey = await webcrypto.subtle.exportKey('pkcs8', keys.privateKey);
  const certificatePem = certificate.toString('pem');
  await writeFile(certificatePath, certificatePem, { mode: 0o600 });
  return { certificate: certificatePem, key: pem('PRIVATE KEY', privateKey) };
};

const runPnpm = (arguments_, environment) =>
  spawn(process.execPath, [pnpmEntry, ...arguments_], {
    cwd: repositoryRoot,
    env: { ...process.env, ...environment },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

const forwardLogs = (child, label) => {
  child.stdout?.on('data', (chunk) => process.stdout.write(`[${label}] ${String(chunk)}`));
  child.stderr?.on('data', (chunk) => process.stderr.write(`[${label}] ${String(chunk)}`));
  children.push(child);
  return child;
};

const waitForExit = (child, label) =>
  new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} exited with code ${String(code)}`));
    });
  });

const waitForHttp = async (url, options = {}, attempts = 180) => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return;
    } catch {
      // The process may still be booting or applying migrations.
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 500);
    });
  }
  throw new Error(`REAL_ADMIN_HARNESS_TIMEOUT:${url}`);
};

const waitForHttps = async (url, attempts = 180) => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const ready = await new Promise((resolve) => {
      const request = httpsRequest(url, { rejectUnauthorized: false }, (response) => {
        response.resume();
        resolve((response.statusCode ?? 500) < 400);
      });
      request.once('error', () => resolve(false));
      request.end();
    });
    if (ready) return;
    await new Promise((resolve) => {
      setTimeout(resolve, 500);
    });
  }
  throw new Error(`REAL_ADMIN_HARNESS_TIMEOUT:${url}`);
};

const terminateProcessTree = async (child) => {
  if (child.exitCode !== null || child.pid === undefined) return;
  if (process.platform !== 'win32') {
    child.kill('SIGTERM');
    return;
  }
  await new Promise((resolve) => {
    const terminator = spawn('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    terminator.once('error', resolve);
    terminator.once('exit', resolve);
  });
};

const createTlsProxy = ({ certificate, key, port, targetPort }) => {
  const server = createHttpsServer({ cert: certificate, key }, (request, response) => {
    const forwarded = httpRequest(
      {
        headers: {
          ...request.headers,
          'x-forwarded-host': request.headers.host ?? '',
          'x-forwarded-proto': 'https',
        },
        host: '127.0.0.1',
        method: request.method,
        path: request.url,
        port: targetPort,
      },
      (upstream) => {
        response.writeHead(upstream.statusCode ?? 502, upstream.headers);
        upstream.pipe(response);
      },
    );
    forwarded.on('error', (error) => {
      const code = error instanceof Error && 'code' in error ? String(error.code) : 'unknown';
      process.stderr.write(`[proxy:${String(port)}->${String(targetPort)}] ${code}\n`);
      if (!response.headersSent) response.writeHead(502);
      response.end('upstream unavailable');
    });
    request.pipe(forwarded);
  });
  server.listen(port, '127.0.0.1');
  servers.push(server);
};

const stop = async () => {
  if (stopping) return;
  stopping = true;
  for (const server of servers) {
    await new Promise((resolve) => {
      server.close(resolve);
    });
  }
  await Promise.all(children.map(terminateProcessTree));
  await rm(temporaryDirectory, { force: true, recursive: true });
};

process.once('SIGINT', () => void stop().finally(() => process.exit(0)));
process.once('SIGTERM', () => void stop().finally(() => process.exit(0)));
process.once('exit', () => {
  for (const child of children) {
    if (child.exitCode === null) child.kill('SIGTERM');
  }
});
process.once('uncaughtException', (error) => {
  void stop().finally(() => {
    console.error(error);
    process.exit(1);
  });
});
process.once('unhandledRejection', (error) => {
  void stop().finally(() => {
    console.error(error);
    process.exit(1);
  });
});

const tls = await createCertificate();
const adminEnvironment = {
  LIIIRAA_ACCOUNT_ORIGIN: origins.account,
  LIIIRAA_ADMIN_API_ORIGIN: origins.api,
  LIIIRAA_ADMIN_AUTHORITY_ORIGIN: origins.api,
  LIIIRAA_ADMIN_ORIGIN: origins.admin,
  LIIIRAA_ADMIN_PREVIEW: 'false',
  NODE_EXTRA_CA_CERTS: certificatePath,
};
const build = forwardLogs(
  runPnpm(['--filter', '@liiiraa/admin', 'build'], adminEnvironment),
  'build',
);
await waitForExit(build, 'Admin build');

const migration = forwardLogs(
  runPnpm(['--filter', '@liiiraa/api', 'db:migrate'], {
    STAGING_DATABASE_URL: databaseUrl,
  }),
  'migration',
);
await waitForExit(migration, 'Staging migration');

const api = forwardLogs(
  runPnpm(
    [
      '--filter',
      '@liiiraa/web-evidence',
      'exec',
      'tsx',
      join(repositoryRoot, 'apps/api/src/staging/main.mjs'),
    ],
    {
      ACCOUNT_STAGING_ORIGIN: origins.account,
      ADMIN_STAGING_ORIGIN: origins.admin,
      AUDIT_ANCHOR_BUCKET: 'liiiraa-staging-admin-e2e-audit',
      AWS_REGION: 'us-east-1',
      DESKTOP_STAGING_ORIGIN: 'http://127.0.0.1:43121',
      HOST: '127.0.0.1',
      PORT: '3103',
      PUBLIC_STAGING_ORIGIN: origins.public,
      STAGING_API_ORIGIN: origins.api,
      STAGING_AUTH_SECRET: 'admin_e2e_local_staging_authority_secret_04_61_0000000000000000',
      STAGING_BUILD_ID: 'admin-e2e-04-61',
      STAGING_CHANNEL: 'internal',
      STAGING_DATABASE_URL: databaseUrl,
      STAGING_DATA_CLASSIFICATION: 'synthetic',
      STAGING_INVITATION_ONLY: 'true',
      STAGING_PUBLIC_SIGNUP: 'false',
      STRIPE_SECRET_KEY: 'sk_test_synthetic_admin_e2e',
      STRIPE_WEBHOOK_SECRET: 'whsec_synthetic_admin_e2e',
      SUPPORT_BUCKET: 'liiiraa-staging-admin-e2e-support',
    },
  ),
  'api',
);
await waitForHttp('http://127.0.0.1:3103/ready');

const admin = forwardLogs(
  runPnpm(
    ['--filter', '@liiiraa/admin', 'start', '--hostname', '127.0.0.1', '--port', '3102'],
    adminEnvironment,
  ),
  'admin',
);

createTlsProxy({ ...tls, port: 3443, targetPort: 3103 });
createTlsProxy({ ...tls, port: 3444, targetPort: 3102 });
await waitForHttps(`${origins.admin}/pt-BR/admin`);
process.stdout.write('REAL_ADMIN_HARNESS_READY\n');

await Promise.race([
  new Promise((resolve) => {
    api.once('exit', resolve);
  }),
  new Promise((resolve) => {
    admin.once('exit', resolve);
  }),
]);
await stop();
