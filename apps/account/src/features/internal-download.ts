import { admitAccountAuthActor, type AccountAuthTransport } from '../account-auth';

export type InternalDownloadArtifact = Readonly<{
  buildId: string;
  fileName: string;
  pathname: string;
  sha256: string;
}>;

export type InternalDownloadBlob = Readonly<{
  contentLength: number;
  contentType: string;
  etag: string;
  stream: ReadableStream<Uint8Array>;
}>;

export type InternalDownloadEnvironment = Readonly<{
  INTERNAL_DOWNLOAD_BUILD_ID?: string | undefined;
  INTERNAL_DOWNLOAD_FILENAME?: string | undefined;
  INTERNAL_DOWNLOAD_PATHNAME?: string | undefined;
  INTERNAL_DOWNLOAD_SHA256?: string | undefined;
}>;

type InternalDownloadDependencies = Readonly<{
  artifact: InternalDownloadArtifact | null;
  authenticate(request: Request): Promise<boolean>;
  readPrivateBlob(pathname: string): Promise<InternalDownloadBlob | null>;
}>;

const BUILD_ID = /^internal-[0-9]{6}$/u;
const FILE_NAME = /^Liiiraa Boost_[0-9]+\.[0-9]+\.[0-9]+_x64-setup\.exe$/u;
const SHA256 = /^[a-f0-9]{64}$/u;

const noStoreHeaders = Object.freeze({
  'cache-control': 'no-store',
  'content-type': 'application/json; charset=utf-8',
  'x-content-type-options': 'nosniff',
});

const unavailable = (status: 401 | 503): Response =>
  Response.json(
    { code: status === 401 ? 'AUTHENTICATION_REQUIRED' : 'DOWNLOAD_UNAVAILABLE' },
    { headers: noStoreHeaders, status },
  );

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const resolveInternalDownloadArtifact = (
  environment: InternalDownloadEnvironment,
): InternalDownloadArtifact | null => {
  const buildId = environment.INTERNAL_DOWNLOAD_BUILD_ID?.trim();
  const fileName = environment.INTERNAL_DOWNLOAD_FILENAME?.trim();
  const pathname = environment.INTERNAL_DOWNLOAD_PATHNAME?.trim();
  const sha256 = environment.INTERNAL_DOWNLOAD_SHA256?.trim().toLowerCase();
  if (
    buildId === undefined ||
    fileName === undefined ||
    pathname === undefined ||
    sha256 === undefined ||
    !BUILD_ID.test(buildId) ||
    !FILE_NAME.test(fileName) ||
    !SHA256.test(sha256) ||
    pathname !== `internal/windows/${buildId}/${fileName}`
  ) {
    return null;
  }
  return Object.freeze({ buildId, fileName, pathname, sha256 });
};

export const authenticateInternalDownload = async (
  request: Request,
  transport: AccountAuthTransport = globalThis.fetch.bind(globalThis),
): Promise<boolean> => {
  const cookie = request.headers.get('cookie')?.trim();
  if (cookie === undefined || cookie.length === 0 || cookie.length > 4_096) return false;
  try {
    const authorityUrl = new URL('/v1/identity/session', request.url);
    if (authorityUrl.origin !== new URL(request.url).origin) return false;
    const response = await transport(authorityUrl.toString(), {
      cache: 'no-store',
      headers: { accept: 'application/json', cookie },
      method: 'GET',
      redirect: 'manual',
    });
    if (!response.ok || response.status !== 200 || response.redirected) return false;
    const body: unknown = await response.json().catch(() => null);
    return isRecord(body) && admitAccountAuthActor(body['actor']) !== null;
  } catch {
    return false;
  }
};

export const createInternalDownloadHandler = ({
  artifact,
  authenticate,
  readPrivateBlob,
}: InternalDownloadDependencies): ((request: Request) => Promise<Response>) => {
  return async (request: Request): Promise<Response> => {
    if (!(await authenticate(request))) return unavailable(401);
    if (artifact === null) return unavailable(503);
    let blob: InternalDownloadBlob | null;
    try {
      blob = await readPrivateBlob(artifact.pathname);
    } catch {
      blob = null;
    }
    if (blob === null || blob.contentLength < 1 || !Number.isSafeInteger(blob.contentLength)) {
      return unavailable(503);
    }
    return new Response(blob.stream, {
      headers: {
        'cache-control': 'private, no-store, max-age=0',
        'content-disposition': `attachment; filename="${artifact.fileName}"`,
        'content-length': String(blob.contentLength),
        'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
        'content-type': blob.contentType,
        etag: blob.etag,
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'DENY',
        'x-liiiraa-build-id': artifact.buildId,
        'x-liiiraa-sha256': artifact.sha256,
      },
      status: 200,
    });
  };
};
