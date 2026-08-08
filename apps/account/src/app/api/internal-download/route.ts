import { get } from '@vercel/blob';

import {
  authenticateInternalDownload,
  createInternalDownloadHandler,
  resolveInternalDownloadArtifact,
  type InternalDownloadBlob,
} from '../../../features/internal-download';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const artifact = resolveInternalDownloadArtifact({
  INTERNAL_DOWNLOAD_BUILD_ID: process.env['INTERNAL_DOWNLOAD_BUILD_ID'],
  INTERNAL_DOWNLOAD_FILENAME: process.env['INTERNAL_DOWNLOAD_FILENAME'],
  INTERNAL_DOWNLOAD_PATHNAME: process.env['INTERNAL_DOWNLOAD_PATHNAME'],
  INTERNAL_DOWNLOAD_SHA256: process.env['INTERNAL_DOWNLOAD_SHA256'],
});

if (
  process.env['VERCEL'] === '1' &&
  (artifact === null || !/^store_[A-Za-z0-9]+$/u.test(process.env['BLOB_STORE_ID'] ?? ''))
) {
  throw new Error('INTERNAL_DOWNLOAD_ARTIFACT_CONFIGURATION_REQUIRED');
}

const readPrivateBlob = async (pathname: string): Promise<InternalDownloadBlob | null> => {
  const result = await get(pathname, { access: 'private' });
  if (result?.statusCode !== 200) return null;
  return {
    contentLength: result.blob.size,
    contentType: result.blob.contentType,
    etag: result.blob.etag,
    stream: result.stream,
  };
};

const handleDownload = createInternalDownloadHandler({
  artifact,
  authenticate: authenticateInternalDownload,
  readPrivateBlob,
});

export const GET = (request: Request): Promise<Response> => handleDownload(request);
