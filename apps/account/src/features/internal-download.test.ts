import { describe, expect, it, vi } from 'vitest';

import {
  authenticateInternalDownload,
  createInternalDownloadHandler,
  resolveInternalDownloadArtifact,
  type InternalDownloadArtifact,
  type InternalDownloadBlob,
} from './internal-download';

const artifact: InternalDownloadArtifact = Object.freeze({
  buildId: 'internal-023001',
  fileName: 'Liiiraa Boost_0.0.1_x64-setup.exe',
  pathname: 'internal/windows/internal-023001/Liiiraa Boost_0.0.1_x64-setup.exe',
  sha256: 'a'.repeat(64),
});

const sessionActor = Object.freeze({
  accountId: '00000000-0000-4000-8000-000000000001',
  displayName: 'Invited tester',
  email: 'tester@example.com',
  expiresAt: '2026-08-09T12:00:00.000Z',
  locale: 'pt-BR',
  role: 'tester',
  sessionId: '00000000-0000-4000-8000-000000000002',
  sessionKind: 'web',
});

const request = (cookie = 'liiiraa_session=opaque-session') =>
  new Request('https://account.example.test/api/internal-download', {
    headers: cookie.length === 0 ? {} : { cookie },
  });

describe('private Internal installer delivery', () => {
  it('admits only the fixed immutable Internal artifact identity', () => {
    expect(
      resolveInternalDownloadArtifact({
        INTERNAL_DOWNLOAD_BUILD_ID: artifact.buildId,
        INTERNAL_DOWNLOAD_FILENAME: artifact.fileName,
        INTERNAL_DOWNLOAD_PATHNAME: artifact.pathname,
        INTERNAL_DOWNLOAD_SHA256: artifact.sha256,
      }),
    ).toEqual(artifact);

    const invalidArtifacts: ReadonlyArray<Partial<typeof artifact>> = [
      {},
      { ...artifact, pathname: 'https://public.example.test/setup.exe' },
      { ...artifact, pathname: '../setup.exe' },
      { ...artifact, pathname: 'internal/windows/other/setup.exe' },
      { ...artifact, sha256: 'not-a-digest' },
    ];
    for (const invalid of invalidArtifacts) {
      expect(
        resolveInternalDownloadArtifact({
          INTERNAL_DOWNLOAD_BUILD_ID: invalid.buildId,
          INTERNAL_DOWNLOAD_FILENAME: invalid.fileName,
          INTERNAL_DOWNLOAD_PATHNAME: invalid.pathname,
          INTERNAL_DOWNLOAD_SHA256: invalid.sha256,
        }),
      ).toBeNull();
    }
  });

  it('forwards only the incoming cookie to the same-origin session authority', async () => {
    const transport = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ actor: sessionActor }), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      }),
    );

    await expect(authenticateInternalDownload(request(), transport)).resolves.toBe(true);
    expect(transport).toHaveBeenCalledWith(
      'https://account.example.test/v1/identity/session',
      expect.objectContaining({
        cache: 'no-store',
        headers: {
          accept: 'application/json',
          cookie: 'liiiraa_session=opaque-session',
        },
        method: 'GET',
        redirect: 'manual',
      }),
    );
  });

  it('rejects absent cookies, failed sessions, redirects, and malformed actors', async () => {
    const transport = vi.fn();
    await expect(authenticateInternalDownload(request(''), transport)).resolves.toBe(false);
    expect(transport).not.toHaveBeenCalled();

    for (const response of [
      new Response(null, { status: 401 }),
      new Response(null, { headers: { location: 'https://attacker.test' }, status: 307 }),
      new Response(JSON.stringify({ actor: { accountId: 'forged' } }), { status: 200 }),
    ]) {
      transport.mockResolvedValueOnce(response);
      await expect(authenticateInternalDownload(request(), transport)).resolves.toBe(false);
    }
  });

  it('checks authentication before private storage and fails closed', async () => {
    const readPrivateBlob = vi.fn();
    const handler = createInternalDownloadHandler({
      artifact,
      authenticate: vi.fn().mockResolvedValue(false),
      readPrivateBlob,
    });

    const response = await handler(request());

    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(readPrivateBlob).not.toHaveBeenCalled();
  });

  it('does not redirect or expose storage identity when the private object is unavailable', async () => {
    const handler = createInternalDownloadHandler({
      artifact,
      authenticate: vi.fn().mockResolvedValue(true),
      readPrivateBlob: vi.fn().mockResolvedValue(null),
    });

    const response = await handler(request());

    expect(response.status).toBe(503);
    expect(response.headers.get('location')).toBeNull();
    await expect(response.text()).resolves.not.toContain(artifact.pathname);
  });

  it('streams the exact private object with bounded download headers', async () => {
    const bytes = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]);
    const blob: InternalDownloadBlob = {
      contentLength: bytes.byteLength,
      contentType: 'application/vnd.microsoft.portable-executable',
      etag: '"internal-etag"',
      stream: new Blob([bytes]).stream(),
    };
    const readPrivateBlob = vi.fn().mockResolvedValue(blob);
    const handler = createInternalDownloadHandler({
      artifact,
      authenticate: vi.fn().mockResolvedValue(true),
      readPrivateBlob,
    });

    const response = await handler(request());

    expect(response.status).toBe(200);
    expect(readPrivateBlob).toHaveBeenCalledWith(artifact.pathname);
    expect(response.headers.get('content-disposition')).toBe(
      `attachment; filename="${artifact.fileName}"`,
    );
    expect(response.headers.get('content-length')).toBe(String(bytes.byteLength));
    expect(response.headers.get('content-type')).toBe(
      'application/vnd.microsoft.portable-executable',
    );
    expect(response.headers.get('cache-control')).toBe('private, no-store, max-age=0');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('content-security-policy')).toBe(
      "default-src 'none'; frame-ancestors 'none'",
    );
    expect(response.headers.get('location')).toBeNull();
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
  });
});
