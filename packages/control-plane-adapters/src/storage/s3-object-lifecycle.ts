import { DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import type {
  PrivateObjectClass,
  PrivateObjectDeleteRequest,
  PrivateObjectDeleteResult,
  PrivateObjectHeadRequest,
  PrivateObjectHeadResult,
  PrivateObjectLifecyclePort,
} from '@liiiraa/control-plane-application';

const SHA256_HEX = /^[0-9a-f]{64}$/u;
const OBJECT_KEY = /^(?:attachments|diagnostics)\/[A-Za-z0-9._:-]{1,128}\/[A-Za-z0-9._:-]{1,128}$/u;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9._:-]{1,256}$/u;

export interface S3ObjectLifecycleClient {
  send(command: DeleteObjectCommand | HeadObjectCommand): Promise<unknown>;
}

export interface S3ObjectLifecycleOptions {
  readonly buckets: Readonly<Partial<Record<PrivateObjectClass, string>>>;
  readonly client: S3ObjectLifecycleClient;
  readonly now?: () => Date;
}

const failure = (
  code: Extract<PrivateObjectDeleteResult, { ok: false }>['code'],
  retryable: boolean,
): Extract<PrivateObjectDeleteResult, { ok: false }> =>
  Object.freeze({ code, ok: false, retryable });

const isNotFound = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null) return false;
  const record = error as Readonly<Record<string, unknown>>;
  const metadata = record['$metadata'];
  return (
    record['name'] === 'NotFound' ||
    record['name'] === 'NoSuchKey' ||
    (typeof metadata === 'object' &&
      metadata !== null &&
      (metadata as Readonly<Record<string, unknown>>)['httpStatusCode'] === 404)
  );
};

const validRequest = (
  request: PrivateObjectHeadRequest,
  buckets: S3ObjectLifecycleOptions['buckets'],
): boolean =>
  typeof buckets[request.bucketClass] === 'string' &&
  (buckets[request.bucketClass]?.length ?? 0) > 0 &&
  OBJECT_KEY.test(request.objectKey);

export const createS3ObjectLifecycleAdapter = ({
  buckets,
  client,
  now = () => new Date(),
}: S3ObjectLifecycleOptions): PrivateObjectLifecyclePort => {
  const head = async (request: PrivateObjectHeadRequest): Promise<PrivateObjectHeadResult> => {
    if (!validRequest(request, buckets)) return failure('OBJECT_INVALID', false);
    try {
      const response = (await client.send(
        new HeadObjectCommand({
          Bucket: buckets[request.bucketClass],
          Key: request.objectKey,
          ChecksumMode: 'ENABLED',
        }),
      )) as Readonly<Record<string, unknown>>;
      const metadata = response['Metadata'];
      const checksum =
        typeof metadata === 'object' && metadata !== null
          ? (metadata as Readonly<Record<string, unknown>>)['content-digest']
          : undefined;
      const versionId = response['VersionId'];
      if (
        typeof checksum !== 'string' ||
        !SHA256_HEX.test(checksum) ||
        typeof versionId !== 'string' ||
        versionId.length === 0
      ) {
        return failure('OBJECT_PROVIDER_UNAVAILABLE', true);
      }
      return Object.freeze({
        ok: true,
        object: Object.freeze({ checksumSha256: checksum, providerReceipt: versionId }),
      });
    } catch (error) {
      return isNotFound(error)
        ? Object.freeze({ ok: true, object: null })
        : failure('OBJECT_PROVIDER_UNAVAILABLE', true);
    }
  };

  const deleteObject = async (
    request: PrivateObjectDeleteRequest,
  ): Promise<PrivateObjectDeleteResult> => {
    if (!SHA256_HEX.test(request.checksumSha256) || !IDEMPOTENCY_KEY.test(request.idempotencyKey)) {
      return failure('OBJECT_INVALID', false);
    }
    const existing = await head(request);
    if (!existing.ok) return existing;
    if (existing.object === null) {
      return Object.freeze({
        ok: true,
        receipt: Object.freeze({
          alreadyAbsent: true,
          checksumSha256: request.checksumSha256,
          deletedAt: now().toISOString(),
          providerReceipt: `already-absent:${request.idempotencyKey}`,
        }),
      });
    }
    if (existing.object.checksumSha256 !== request.checksumSha256) {
      return failure('OBJECT_CHECKSUM_MISMATCH', false);
    }
    try {
      const response = (await client.send(
        new DeleteObjectCommand({
          Bucket: buckets[request.bucketClass],
          Key: request.objectKey,
          VersionId: existing.object.providerReceipt,
        }),
      )) as Readonly<Record<string, unknown>>;
      const providerReceipt = response['VersionId'];
      if (typeof providerReceipt !== 'string' || providerReceipt.length === 0) {
        return failure('OBJECT_PROVIDER_UNAVAILABLE', true);
      }
      return Object.freeze({
        ok: true,
        receipt: Object.freeze({
          alreadyAbsent: false,
          checksumSha256: request.checksumSha256,
          deletedAt: now().toISOString(),
          providerReceipt,
        }),
      });
    } catch {
      return failure('OBJECT_PROVIDER_UNAVAILABLE', true);
    }
  };

  return Object.freeze({ delete: deleteObject, head });
};
