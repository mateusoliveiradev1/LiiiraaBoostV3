import type {
  ReleaseArtifactEvidenceJson,
  ReleaseRecordJson,
  ShellReleaseChannelJson,
} from '@liiiraa/contracts-ts/generated';
import { validateWebDocument } from '@liiiraa/contracts-ts/web-validation';

export type PublicReleaseChannel = Exclude<ShellReleaseChannelJson, 'development'>;

export type ExperimentalChannelAcknowledgement = Readonly<{
  risk: 'high-change';
  audience: 'hardware-enthusiasts';
  support: 'limited';
  updates: 'manual-only';
}>;

type ExperimentalChannelAcknowledgementInput = Readonly<{
  risk: string;
  audience: string;
  support: string;
  updates: string;
}>;

export type ReleaseChannelRequest = Readonly<{
  requested?: ShellReleaseChannelJson;
  betaOptIn?: boolean;
  experimentalAcknowledgement?: ExperimentalChannelAcknowledgementInput;
}>;

type ReleaseChannelPolicy = Readonly<{
  audience: 'general' | 'opted-in-testers' | 'hardware-enthusiasts';
  risk: 'standard' | 'pre-release' | 'high-change';
  support: 'supported' | 'best-effort' | 'limited';
  updates: 'stable-only' | 'beta-track' | 'manual-only';
}>;

export type ReleaseChannelSelection =
  | Readonly<{
      status: 'selected';
      channel: PublicReleaseChannel;
      policy: ReleaseChannelPolicy;
    }>
  | Readonly<{
      status: 'blocked';
      requested: ShellReleaseChannelJson;
      reason:
        | 'beta-opt-in-required'
        | 'development-channel-not-public'
        | 'experimental-policy-acknowledgement-required';
    }>;

export type ReleaseProvenance =
  'public-trust-production' | 'self-signed-development' | 'local' | 'ci' | 'unknown';

export type ReleaseManifestEvidence = Readonly<{
  manifestId: string;
  artifactId: string;
  channel: string;
  version: string;
  architecture: string;
  windowsLifecycle: readonly string[];
  compatibility: readonly string[];
  publisher: string;
  sha256: string;
  sizeBytes: string;
  signatureState: string;
  origin: string;
  provenance: ReleaseProvenance;
  publicDistributionApproved: boolean;
  artifactAvailable: boolean;
}>;

export type InspectedReleaseArtifact = Readonly<
  ReleaseManifestEvidence & {
    artifactName: string;
    sourcePath: string;
    trustClass: string;
  }
>;

export type IntegrityField =
  | 'manifestId'
  | 'artifactId'
  | 'channel'
  | 'version'
  | 'architecture'
  | 'windowsLifecycle'
  | 'compatibility'
  | 'publisher'
  | 'sha256'
  | 'sizeBytes'
  | 'signatureState'
  | 'origin'
  | 'provenance'
  | 'publicDistributionApproved'
  | 'artifactAvailable'
  | 'artifactIdentity';

export type IntegrityValueClass =
  'matching' | 'different' | 'missing' | 'untrusted' | 'development';

export type IntegrityDisagreement = Readonly<{
  field: IntegrityField;
  manifestValueClass: IntegrityValueClass;
  artifactValueClass: IntegrityValueClass;
}>;

export type ReleaseIntegrityResult =
  | Readonly<{ ok: true; classification: 'verified' }>
  | Readonly<{
      ok: false;
      classification: 'development-artifact' | 'integrity-disagreement';
      disagreements: readonly IntegrityDisagreement[];
    }>;

export type VerificationStep = Readonly<{
  kind: 'authenticode' | 'sha256' | 'size' | 'version' | 'compatibility' | 'manifest';
  instruction:
    | 'confirm-authenticode-publisher-and-chain'
    | 'compare-sha256-with-canonical-manifest'
    | 'compare-file-size-with-canonical-manifest'
    | 'confirm-installer-version'
    | 'confirm-windows-lifecycle-and-architecture'
    | 'confirm-canonical-release-manifest';
}>;

export type HistoricalReleaseState = 'current' | 'supported' | 'unsafe' | 'unavailable';

export type DownloadBlockedReason =
  | 'artifact-unavailable'
  | 'channel-selection-blocked'
  | 'development-artifact-rejected'
  | 'distribution-not-approved'
  | 'historical-release-unavailable'
  | 'historical-release-unsafe'
  | 'integrity-disagreement'
  | 'official-artifact-unavailable'
  | 'record-invalid';

export type DownloadDecision =
  | Readonly<{
      status: 'blocked';
      reason: DownloadBlockedReason;
      historyState: HistoricalReleaseState;
      verificationSteps: readonly [];
      postDownloadGuidance: readonly [];
    }>
  | Readonly<{
      status: 'available';
      channel: PublicReleaseChannel;
      historyState: 'current' | 'supported';
      artifact: Readonly<{
        id: string;
        origin: 'liiiraa-download-origin' | 'liiiraa-release-origin';
      }>;
      verificationSteps: readonly VerificationStep[];
      postDownloadGuidance: readonly [
        'verify-before-running',
        'cancel-on-unexpected-warning',
        'contact-support-on-disagreement',
      ];
    }>;

export type DownloadDecisionInput = Readonly<{
  record: unknown;
  channelRequest?: ReleaseChannelRequest;
  historyState: HistoricalReleaseState;
  manifest?: ReleaseManifestEvidence;
  artifact?: InspectedReleaseArtifact;
}>;

type FutureReleaseRecord = Omit<
  ReleaseRecordJson,
  'artifactEvidence' | 'officialArtifact' | 'publicDistributionApproved'
> & {
  artifactEvidence?: ReleaseArtifactEvidenceJson;
  officialArtifact: 'available' | 'unavailable';
  publicDistributionApproved: boolean;
};

const OFFICIAL_ORIGINS = Object.freeze([
  'liiiraa-download-origin',
  'liiiraa-release-origin',
] as const);

const DEVELOPMENT_ARTIFACT_NAMES = new Set([
  'Liiiraa Boost_0.0.0_x64-setup.exe',
  'liiiraa-desktop.exe',
]);

const DEVELOPMENT_ARTIFACT_PATHS = new Set([
  'target/release/bundle/nsis/Liiiraa Boost_0.0.0_x64-setup.exe',
  'target/release/liiiraa-desktop.exe',
  'quality/evidence/phase-02/staged/Liiiraa Boost_0.0.0_x64-setup.exe',
  'quality/evidence/phase-02/staged/liiiraa-desktop.exe',
]);

const DEVELOPMENT_TRUST_CLASSES = new Set([
  'ci',
  'local',
  'self-signed-development',
  'self-signed-untrusted-root',
]);

const SHA_256 = /^[A-Fa-f0-9]{64}$/u;
const MAX_ARTIFACT_BYTES = 10_737_418_240n;

const deepFreeze = <Value>(value: Value): Value => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }

  return value;
};

const isExperimentalAcknowledgement = (
  value: ExperimentalChannelAcknowledgementInput | undefined,
): value is ExperimentalChannelAcknowledgement =>
  value?.risk === 'high-change' &&
  value.audience === 'hardware-enthusiasts' &&
  value.support === 'limited' &&
  value.updates === 'manual-only';

export const selectReleaseChannel = (
  request: ReleaseChannelRequest = {},
): ReleaseChannelSelection => {
  const requested = request.requested ?? 'stable';

  switch (requested) {
    case 'stable':
      return deepFreeze({
        status: 'selected',
        channel: 'stable',
        policy: {
          audience: 'general',
          risk: 'standard',
          support: 'supported',
          updates: 'stable-only',
        },
      });
    case 'beta':
      return request.betaOptIn === true
        ? deepFreeze({
            status: 'selected',
            channel: 'beta',
            policy: {
              audience: 'opted-in-testers',
              risk: 'pre-release',
              support: 'best-effort',
              updates: 'beta-track',
            },
          })
        : deepFreeze({
            status: 'blocked',
            requested,
            reason: 'beta-opt-in-required',
          });
    case 'experimental':
      return isExperimentalAcknowledgement(request.experimentalAcknowledgement)
        ? deepFreeze({
            status: 'selected',
            channel: 'experimental',
            policy: { ...request.experimentalAcknowledgement },
          })
        : deepFreeze({
            status: 'blocked',
            requested,
            reason: 'experimental-policy-acknowledgement-required',
          });
    case 'development':
      return deepFreeze({
        status: 'blocked',
        requested,
        reason: 'development-channel-not-public',
      });
  }
};

const normalizedList = (value: unknown): string =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')
    ? JSON.stringify([...value].sort((left, right) => left.localeCompare(right)))
    : '';

const isPresentString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const isPositiveBoundedSize = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  if (!/^[1-9][0-9]*$/u.test(value)) return false;

  try {
    return BigInt(value) <= MAX_ARTIFACT_BYTES;
  } catch {
    return false;
  }
};

const isOfficialOrigin = (value: unknown): value is (typeof OFFICIAL_ORIGINS)[number] =>
  typeof value === 'string' && OFFICIAL_ORIGINS.some((origin) => origin === value);

const developmentArtifactDisagreement = (
  artifact: Partial<InspectedReleaseArtifact>,
): readonly IntegrityDisagreement[] => {
  const normalizedPath =
    typeof artifact.sourcePath === 'string' ? artifact.sourcePath.replaceAll('\\', '/') : '';
  const explicitPhaseTwoIdentity =
    (typeof artifact.artifactName === 'string' &&
      DEVELOPMENT_ARTIFACT_NAMES.has(artifact.artifactName)) ||
    DEVELOPMENT_ARTIFACT_PATHS.has(normalizedPath) ||
    (typeof artifact.trustClass === 'string' && DEVELOPMENT_TRUST_CLASSES.has(artifact.trustClass));
  const genericDevelopmentIdentity =
    /(?:^|\/)(?:ci|local|target\/release|quality\/evidence\/phase-02)(?:\/|$)/iu.test(
      normalizedPath,
    ) ||
    /(?:development|self[- ]signed)/iu.test(artifact.artifactName ?? '') ||
    /(?:development|self[- ]signed|untrusted|^ci$|^local$)/iu.test(artifact.trustClass ?? '');

  return explicitPhaseTwoIdentity || genericDevelopmentIdentity
    ? [
        {
          field: 'artifactIdentity',
          manifestValueClass: 'matching',
          artifactValueClass: 'development',
        },
      ]
    : [];
};

const artifactIdentityDisagreement = (
  artifact: Partial<InspectedReleaseArtifact>,
): IntegrityDisagreement | undefined => {
  const identityPresent =
    isPresentString(artifact.artifactName) &&
    isPresentString(artifact.sourcePath) &&
    isPresentString(artifact.trustClass);
  const identityTrusted = identityPresent && artifact.trustClass === 'public-trust-production';

  return identityTrusted
    ? undefined
    : {
        field: 'artifactIdentity',
        manifestValueClass: 'matching',
        artifactValueClass: identityPresent ? 'untrusted' : 'missing',
      };
};

type ComparableRule = Readonly<{
  field: Exclude<IntegrityField, 'artifactIdentity'>;
  manifest: unknown;
  artifact: unknown;
  manifestTrusted: boolean;
  artifactTrusted: boolean;
}>;

const classifySide = (trusted: boolean, present: boolean): IntegrityValueClass => {
  if (!present) return 'missing';
  return trusted ? 'matching' : 'untrusted';
};

const compareRule = (rule: ComparableRule): IntegrityDisagreement | undefined => {
  const manifestPresent =
    rule.manifest !== undefined && rule.manifest !== null && rule.manifest !== '';
  const artifactPresent =
    rule.artifact !== undefined && rule.artifact !== null && rule.artifact !== '';

  if (rule.manifestTrusted && rule.artifactTrusted && rule.manifest === rule.artifact) {
    return undefined;
  }

  return {
    field: rule.field,
    manifestValueClass: classifySide(rule.manifestTrusted, manifestPresent),
    artifactValueClass:
      rule.manifestTrusted && rule.artifactTrusted && rule.manifest !== rule.artifact
        ? 'different'
        : classifySide(rule.artifactTrusted, artifactPresent),
  };
};

export const verifyReleaseIntegrity = (
  manifest: ReleaseManifestEvidence,
  artifact: InspectedReleaseArtifact,
): ReleaseIntegrityResult => {
  const developmentDisagreements = developmentArtifactDisagreement(artifact);
  if (developmentDisagreements.length > 0) {
    return deepFreeze({
      ok: false,
      classification: 'development-artifact',
      disagreements: developmentDisagreements,
    });
  }

  const identityDisagreement = artifactIdentityDisagreement(artifact);
  const manifestLifecycle = normalizedList(manifest.windowsLifecycle);
  const artifactLifecycle = normalizedList(artifact.windowsLifecycle);
  const manifestCompatibility = normalizedList(manifest.compatibility);
  const artifactCompatibility = normalizedList(artifact.compatibility);

  const rules: readonly ComparableRule[] = [
    {
      field: 'manifestId',
      manifest: manifest.manifestId,
      artifact: artifact.manifestId,
      manifestTrusted: isPresentString(manifest.manifestId),
      artifactTrusted: isPresentString(artifact.manifestId),
    },
    {
      field: 'artifactId',
      manifest: manifest.artifactId,
      artifact: artifact.artifactId,
      manifestTrusted: isPresentString(manifest.artifactId),
      artifactTrusted: isPresentString(artifact.artifactId),
    },
    {
      field: 'channel',
      manifest: manifest.channel,
      artifact: artifact.channel,
      manifestTrusted:
        manifest.channel === 'stable' ||
        manifest.channel === 'beta' ||
        manifest.channel === 'experimental',
      artifactTrusted:
        artifact.channel === 'stable' ||
        artifact.channel === 'beta' ||
        artifact.channel === 'experimental',
    },
    {
      field: 'version',
      manifest: manifest.version,
      artifact: artifact.version,
      manifestTrusted: isPresentString(manifest.version),
      artifactTrusted: isPresentString(artifact.version),
    },
    {
      field: 'architecture',
      manifest: manifest.architecture,
      artifact: artifact.architecture,
      manifestTrusted: isPresentString(manifest.architecture),
      artifactTrusted: isPresentString(artifact.architecture),
    },
    {
      field: 'windowsLifecycle',
      manifest: manifestLifecycle,
      artifact: artifactLifecycle,
      manifestTrusted:
        Array.isArray(manifest.windowsLifecycle) && manifest.windowsLifecycle.length > 0,
      artifactTrusted:
        Array.isArray(artifact.windowsLifecycle) && artifact.windowsLifecycle.length > 0,
    },
    {
      field: 'compatibility',
      manifest: manifestCompatibility,
      artifact: artifactCompatibility,
      manifestTrusted: Array.isArray(manifest.compatibility) && manifest.compatibility.length > 0,
      artifactTrusted: Array.isArray(artifact.compatibility) && artifact.compatibility.length > 0,
    },
    {
      field: 'publisher',
      manifest: manifest.publisher,
      artifact: artifact.publisher,
      manifestTrusted: isPresentString(manifest.publisher),
      artifactTrusted: isPresentString(artifact.publisher),
    },
    {
      field: 'sha256',
      manifest:
        typeof manifest.sha256 === 'string' ? manifest.sha256.toLowerCase() : manifest.sha256,
      artifact:
        typeof artifact.sha256 === 'string' ? artifact.sha256.toLowerCase() : artifact.sha256,
      manifestTrusted: typeof manifest.sha256 === 'string' && SHA_256.test(manifest.sha256),
      artifactTrusted: typeof artifact.sha256 === 'string' && SHA_256.test(artifact.sha256),
    },
    {
      field: 'sizeBytes',
      manifest: manifest.sizeBytes,
      artifact: artifact.sizeBytes,
      manifestTrusted: isPositiveBoundedSize(manifest.sizeBytes),
      artifactTrusted: isPositiveBoundedSize(artifact.sizeBytes),
    },
    {
      field: 'signatureState',
      manifest: manifest.signatureState,
      artifact: artifact.signatureState,
      manifestTrusted: manifest.signatureState === 'verified',
      artifactTrusted: artifact.signatureState === 'verified',
    },
    {
      field: 'origin',
      manifest: manifest.origin,
      artifact: artifact.origin,
      manifestTrusted: isOfficialOrigin(manifest.origin),
      artifactTrusted: isOfficialOrigin(artifact.origin),
    },
    {
      field: 'provenance',
      manifest: manifest.provenance,
      artifact: artifact.provenance,
      manifestTrusted: manifest.provenance === 'public-trust-production',
      artifactTrusted: artifact.provenance === 'public-trust-production',
    },
    {
      field: 'publicDistributionApproved',
      manifest: manifest.publicDistributionApproved,
      artifact: artifact.publicDistributionApproved,
      manifestTrusted: manifest.publicDistributionApproved,
      artifactTrusted: artifact.publicDistributionApproved,
    },
    {
      field: 'artifactAvailable',
      manifest: manifest.artifactAvailable,
      artifact: artifact.artifactAvailable,
      manifestTrusted: manifest.artifactAvailable,
      artifactTrusted: artifact.artifactAvailable,
    },
  ];

  const disagreements = [identityDisagreement, ...rules.map(compareRule)].filter(
    (item): item is IntegrityDisagreement => item !== undefined,
  );

  return disagreements.length === 0
    ? deepFreeze({ ok: true, classification: 'verified' })
    : deepFreeze({
        ok: false,
        classification: 'integrity-disagreement',
        disagreements,
      });
};

const blockedDecision = (
  reason: DownloadBlockedReason,
  historyState: HistoricalReleaseState,
): DownloadDecision =>
  deepFreeze({
    status: 'blocked',
    reason,
    historyState,
    verificationSteps: [],
    postDownloadGuidance: [],
  });

const isReleaseRecord = (value: unknown): value is ReleaseRecordJson => {
  if (value === null || typeof value !== 'object') return false;

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate['channel'] === 'string' &&
    typeof candidate['version'] === 'string' &&
    Array.isArray(candidate['compatibility']) &&
    typeof candidate['manifest'] === 'string' &&
    typeof candidate['availability'] === 'string' &&
    typeof candidate['publicDistributionApproved'] === 'boolean' &&
    typeof candidate['officialArtifact'] === 'string'
  );
};

const recordDisagreements = (
  record: FutureReleaseRecord,
  manifest: ReleaseManifestEvidence,
): readonly IntegrityDisagreement[] => {
  const artifactEvidence = record.artifactEvidence;
  const checks: readonly ComparableRule[] = [
    {
      field: 'manifestId',
      manifest: record.manifest,
      artifact: manifest.manifestId,
      manifestTrusted: isPresentString(record.manifest),
      artifactTrusted: isPresentString(manifest.manifestId),
    },
    {
      field: 'channel',
      manifest: record.channel,
      artifact: manifest.channel,
      manifestTrusted: record.channel !== 'development',
      artifactTrusted: manifest.channel !== 'development',
    },
    {
      field: 'version',
      manifest: record.version,
      artifact: manifest.version,
      manifestTrusted: isPresentString(record.version),
      artifactTrusted: isPresentString(manifest.version),
    },
    {
      field: 'compatibility',
      manifest: normalizedList(record.compatibility),
      artifact: normalizedList(manifest.compatibility),
      manifestTrusted: record.compatibility.length > 0,
      artifactTrusted: manifest.compatibility.length > 0,
    },
    {
      field: 'publisher',
      manifest: artifactEvidence?.publisher,
      artifact: manifest.publisher,
      manifestTrusted:
        artifactEvidence !== undefined && isPresentString(artifactEvidence.publisher),
      artifactTrusted: isPresentString(manifest.publisher),
    },
    {
      field: 'sha256',
      manifest: artifactEvidence?.sha256.toLowerCase(),
      artifact: manifest.sha256.toLowerCase(),
      manifestTrusted: artifactEvidence !== undefined && SHA_256.test(artifactEvidence.sha256),
      artifactTrusted: SHA_256.test(manifest.sha256),
    },
    {
      field: 'sizeBytes',
      manifest: artifactEvidence?.sizeBytes,
      artifact: manifest.sizeBytes,
      manifestTrusted:
        artifactEvidence !== undefined && isPositiveBoundedSize(artifactEvidence.sizeBytes),
      artifactTrusted: isPositiveBoundedSize(manifest.sizeBytes),
    },
    {
      field: 'signatureState',
      manifest: artifactEvidence?.signatureState,
      artifact: manifest.signatureState,
      manifestTrusted: artifactEvidence?.signatureState === 'verified',
      artifactTrusted: manifest.signatureState === 'verified',
    },
    {
      field: 'origin',
      manifest: artifactEvidence?.origin,
      artifact: manifest.origin,
      manifestTrusted: artifactEvidence !== undefined && isOfficialOrigin(artifactEvidence.origin),
      artifactTrusted: isOfficialOrigin(manifest.origin),
    },
    {
      field: 'publicDistributionApproved',
      manifest: record.publicDistributionApproved,
      artifact: manifest.publicDistributionApproved,
      manifestTrusted: record.publicDistributionApproved,
      artifactTrusted: manifest.publicDistributionApproved,
    },
    {
      field: 'artifactAvailable',
      manifest: record.officialArtifact === 'available',
      artifact: manifest.artifactAvailable,
      manifestTrusted: record.officialArtifact === 'available',
      artifactTrusted: manifest.artifactAvailable,
    },
  ];

  return checks
    .map(compareRule)
    .filter((item): item is IntegrityDisagreement => item !== undefined);
};

const verificationSteps = (): readonly VerificationStep[] =>
  deepFreeze([
    {
      kind: 'authenticode',
      instruction: 'confirm-authenticode-publisher-and-chain',
    },
    {
      kind: 'sha256',
      instruction: 'compare-sha256-with-canonical-manifest',
    },
    {
      kind: 'size',
      instruction: 'compare-file-size-with-canonical-manifest',
    },
    { kind: 'version', instruction: 'confirm-installer-version' },
    {
      kind: 'compatibility',
      instruction: 'confirm-windows-lifecycle-and-architecture',
    },
    {
      kind: 'manifest',
      instruction: 'confirm-canonical-release-manifest',
    },
  ]);

export const decideDownload = (input: DownloadDecisionInput): DownloadDecision => {
  const validation = validateWebDocument(input.record);
  if (!validation.ok || !isReleaseRecord(validation.value)) {
    return blockedDecision('record-invalid', input.historyState);
  }

  const record = validation.value as FutureReleaseRecord;
  const channelSelection = selectReleaseChannel({
    ...input.channelRequest,
    requested: record.channel,
  });

  switch (input.historyState) {
    case 'unsafe':
      return blockedDecision('historical-release-unsafe', input.historyState);
    case 'unavailable':
      return blockedDecision('historical-release-unavailable', input.historyState);
    case 'current':
    case 'supported':
      break;
  }

  if (channelSelection.status === 'blocked') {
    return blockedDecision('channel-selection-blocked', input.historyState);
  }
  if (record.channel === 'development') {
    return blockedDecision('development-artifact-rejected', input.historyState);
  }
  if (!record.publicDistributionApproved) {
    return blockedDecision('distribution-not-approved', input.historyState);
  }
  if (record.officialArtifact !== 'available') {
    return blockedDecision('official-artifact-unavailable', input.historyState);
  }
  if (record.availability !== 'available') {
    return blockedDecision('artifact-unavailable', input.historyState);
  }
  if (input.manifest === undefined || input.artifact === undefined) {
    return blockedDecision('artifact-unavailable', input.historyState);
  }
  if (channelSelection.channel !== input.manifest.channel) {
    return blockedDecision('integrity-disagreement', input.historyState);
  }

  const releaseRecordDisagreements = recordDisagreements(record, input.manifest);
  if (releaseRecordDisagreements.length > 0) {
    return blockedDecision('integrity-disagreement', input.historyState);
  }

  const integrity = verifyReleaseIntegrity(input.manifest, input.artifact);
  if (!integrity.ok) {
    return blockedDecision(
      integrity.classification === 'development-artifact'
        ? 'development-artifact-rejected'
        : 'integrity-disagreement',
      input.historyState,
    );
  }

  if (
    !isOfficialOrigin(input.manifest.origin) ||
    !['stable', 'beta', 'experimental'].includes(input.manifest.channel)
  ) {
    return blockedDecision('integrity-disagreement', input.historyState);
  }

  return deepFreeze({
    status: 'available',
    channel: input.manifest.channel,
    historyState: input.historyState,
    artifact: {
      id: input.manifest.artifactId,
      origin: input.manifest.origin,
    },
    verificationSteps: verificationSteps(),
    postDownloadGuidance: [
      'verify-before-running',
      'cancel-on-unexpected-warning',
      'contact-support-on-disagreement',
    ],
  });
};
