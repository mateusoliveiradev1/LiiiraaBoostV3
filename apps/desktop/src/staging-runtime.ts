export interface InternalChannelManifest {
  readonly schemaVersion: '1.0';
  readonly channel: 'internal';
  readonly buildNumber: number;
  readonly buildId: string;
  readonly commit: string;
  readonly digest: string;
  readonly checksum: string;
  readonly accessScope: 'invited-pcs';
  readonly changeNotes: 'CHANGE-NOTES.md';
  readonly rollbackBuildId: string;
  readonly apiOrigin: string;
  readonly apiVersion: string;
  readonly contractVersion: string;
  readonly entitlementKeyId: string;
  readonly artifact: {
    readonly availability: 'not-published';
    readonly fileName: string;
    readonly format: 'nsis';
    readonly signingClass: 'self-signed-development';
  };
  readonly sbom: {
    readonly digest: string;
    readonly format: 'spdx-json';
  };
  readonly provenance: {
    readonly attested: false;
    readonly digest: string;
    readonly kind: 'github-actions-slsa';
  };
  readonly trust: {
    readonly distributionAllowed: false;
    readonly productionReady: false;
    readonly publicDownload: false;
    readonly publicTrust: false;
    readonly smartScreenReputation: false;
  };
}

export interface StagingRuntimeExpectation {
  readonly apiOrigin: string;
  readonly apiVersion: string;
  readonly contractVersion: string;
  readonly entitlementKeyIds: readonly string[];
}

type AdmissionFailure = Readonly<{ ok: false; reason: string }>;
type AdmissionSuccess<T> = Readonly<{ ok: true; value: T }>;
type AdmissionResult<T> = AdmissionFailure | AdmissionSuccess<T>;

const manifestKeys = [
  'accessScope',
  'apiOrigin',
  'apiVersion',
  'artifact',
  'buildId',
  'buildNumber',
  'changeNotes',
  'channel',
  'checksum',
  'commit',
  'contractVersion',
  'digest',
  'entitlementKeyId',
  'provenance',
  'rollbackBuildId',
  'sbom',
  'schemaVersion',
  'trust',
] as const;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasExactKeys = (value: Readonly<Record<string, unknown>>, keys: readonly string[]) => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
};

const isSha256 = (value: unknown) =>
  typeof value === 'string' && /^(?:sha256:)?[a-f0-9]{64}$/u.test(value);

const buildIdFor = (buildNumber: number) => `internal-${buildNumber.toString().padStart(6, '0')}`;

const rollbackNumber = (buildId: string) => {
  const match = /^internal-(\d{6,})$/u.exec(buildId);
  return match === null ? undefined : Number(match[1]);
};

const validateNestedClaims = (candidate: Readonly<Record<string, unknown>>) => {
  const artifact = candidate['artifact'];
  const sbom = candidate['sbom'];
  const provenance = candidate['provenance'];
  const trust = candidate['trust'];
  if (
    !isRecord(artifact) ||
    !hasExactKeys(artifact, ['availability', 'fileName', 'format', 'signingClass']) ||
    artifact['availability'] !== 'not-published' ||
    typeof artifact['fileName'] !== 'string' ||
    artifact['fileName'].length === 0 ||
    artifact['format'] !== 'nsis' ||
    artifact['signingClass'] !== 'self-signed-development'
  ) {
    return 'invalid restricted artifact claim';
  }
  if (
    !isRecord(sbom) ||
    !hasExactKeys(sbom, ['digest', 'format']) ||
    !isSha256(sbom['digest']) ||
    sbom['format'] !== 'spdx-json'
  ) {
    return 'invalid SBOM identity';
  }
  if (
    !isRecord(provenance) ||
    !hasExactKeys(provenance, ['attested', 'digest', 'kind']) ||
    provenance['attested'] !== false ||
    !isSha256(provenance['digest']) ||
    provenance['kind'] !== 'github-actions-slsa'
  ) {
    return 'invalid non-production provenance claim';
  }
  if (
    !isRecord(trust) ||
    !hasExactKeys(trust, [
      'distributionAllowed',
      'productionReady',
      'publicDownload',
      'publicTrust',
      'smartScreenReputation',
    ]) ||
    Object.values(trust).some((claim) => claim !== false)
  ) {
    return 'public trust and distribution claims are forbidden';
  }
  return undefined;
};

export const admitInternalChannelManifest = (
  input: unknown,
  previousManifests: readonly InternalChannelManifest[] = [],
): AdmissionResult<InternalChannelManifest> => {
  if (!isRecord(input) || !hasExactKeys(input, manifestKeys)) {
    return { ok: false, reason: 'manifest shape is not closed' };
  }
  const buildNumber = input['buildNumber'];
  const buildId = input['buildId'];
  const rollbackBuildId = input['rollbackBuildId'];
  if (
    input['schemaVersion'] !== '1.0' ||
    input['channel'] !== 'internal' ||
    !Number.isSafeInteger(buildNumber) ||
    (buildNumber as number) < 1 ||
    typeof buildId !== 'string' ||
    buildId !== buildIdFor(buildNumber as number) ||
    typeof rollbackBuildId !== 'string'
  ) {
    return { ok: false, reason: 'invalid Internal build identity' };
  }
  const previousBuildNumber = rollbackNumber(rollbackBuildId);
  if (previousBuildNumber === undefined || previousBuildNumber >= (buildNumber as number)) {
    return { ok: false, reason: 'rollback must identify an older Internal build' };
  }
  if (
    typeof input['commit'] !== 'string' ||
    !/^[a-f0-9]{40}$/u.test(input['commit']) ||
    !isSha256(input['digest']) ||
    typeof input['checksum'] !== 'string' ||
    !/^[a-f0-9]{64}$/u.test(input['checksum']) ||
    input['accessScope'] !== 'invited-pcs' ||
    input['changeNotes'] !== 'CHANGE-NOTES.md' ||
    typeof input['apiOrigin'] !== 'string' ||
    typeof input['apiVersion'] !== 'string' ||
    typeof input['contractVersion'] !== 'string' ||
    typeof input['entitlementKeyId'] !== 'string'
  ) {
    return { ok: false, reason: 'required immutable metadata is invalid' };
  }
  const nestedFailure = validateNestedClaims(input);
  if (nestedFailure !== undefined) return { ok: false, reason: nestedFailure };
  if (
    previousManifests.some(
      (previous) => previous.buildNumber >= (buildNumber as number) || previous.buildId === buildId,
    )
  ) {
    return { ok: false, reason: 'build numbering is not monotonic' };
  }
  return { ok: true, value: input as unknown as InternalChannelManifest };
};

export const internalManifestIdentity = (manifest: InternalChannelManifest) =>
  `${manifest.buildId}:${manifest.commit}:${manifest.digest}:${manifest.checksum}`;

export const selectRollbackManifest = (
  current: InternalChannelManifest,
  candidates: readonly InternalChannelManifest[],
) => {
  const matching = candidates.filter(
    (candidate) =>
      candidate.buildId === current.rollbackBuildId &&
      candidate.buildNumber < current.buildNumber &&
      admitInternalChannelManifest(candidate).ok,
  );
  if (matching.length !== 1) return undefined;
  const identity = internalManifestIdentity(matching[0]!);
  return candidates.some(
    (candidate) =>
      candidate !== matching[0] &&
      candidate.buildId === current.rollbackBuildId &&
      internalManifestIdentity(candidate) !== identity,
  )
    ? undefined
    : matching[0];
};

export const admitStagingRuntime = (
  input: unknown,
  expected: StagingRuntimeExpectation,
): AdmissionResult<{
  badge: string;
  buildId: string;
  channel: 'internal';
  manifest: InternalChannelManifest;
}> => {
  const admitted = admitInternalChannelManifest(input);
  if (!admitted.ok) return admitted;
  const manifest = admitted.value;
  if (
    manifest.apiOrigin !== expected.apiOrigin ||
    manifest.apiVersion !== expected.apiVersion ||
    manifest.contractVersion !== expected.contractVersion ||
    !expected.entitlementKeyIds.includes(manifest.entitlementKeyId)
  ) {
    return { ok: false, reason: 'runtime authority does not match the staging manifest' };
  }
  return {
    ok: true,
    value: {
      badge: `Internal #${manifest.buildNumber.toString().padStart(6, '0')}`,
      buildId: manifest.buildId,
      channel: 'internal',
      manifest,
    },
  };
};
