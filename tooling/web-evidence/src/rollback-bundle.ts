import { createHash } from 'node:crypto';

import {
  PUBLICATION_ARTIFACT_KINDS,
  evaluateWebPublication,
  type PublicationArtifactKind,
  type PublicationFailure,
  type WebPublicationInput,
  type WebPublicationResult,
  type WebSurface,
} from './publication.js';

export interface ApprovedWebAppArtifact {
  readonly buildId: string;
  readonly contentId: string;
  readonly hash: string;
  readonly path: string;
  readonly surface: WebSurface;
}

export interface ApprovedWebBundle {
  readonly appArtifacts: readonly ApprovedWebAppArtifact[];
  readonly approvalFingerprint: string;
  readonly approvedAt: string;
  readonly assetHashes: Readonly<{
    assets: string;
    capture: string;
    screenshots: string;
    visual: string;
  }>;
  readonly buildId: string;
  readonly bundleHash: string;
  readonly commit: string;
  readonly contentId: string;
  readonly evidenceHashes: Readonly<{
    gates: string;
    policies: string;
    publication: string;
    quality: string;
  }>;
  readonly finalApproved: boolean;
  readonly manifestHashes: Readonly<Record<PublicationArtifactKind, string>>;
  readonly releaseHash: string;
  readonly routeHash: string;
}

export interface CreateApprovedWebBundleInput {
  readonly approvedAt: string;
  readonly commit: string;
  readonly input: WebPublicationInput;
  readonly publication: WebPublicationResult;
}

export type CreateApprovedWebBundleResult = Readonly<
  | { bundle: ApprovedWebBundle; failures: readonly []; ok: true }
  | { failures: readonly PublicationFailure[]; ok: false }
>;

export interface ResolveWebRollbackInput {
  readonly approvedBundles: readonly ApprovedWebBundle[];
  readonly currentCommit: string;
  readonly rollbackExternalData: boolean;
  readonly rollbackMigrations: boolean;
  readonly targetCommit: string;
}

export interface WebRollbackPlan {
  readonly appArtifacts: readonly ApprovedWebAppArtifact[];
  readonly assetHashes: ApprovedWebBundle['assetHashes'];
  readonly buildId: string;
  readonly contentId: string;
  readonly evidenceHashes: ApprovedWebBundle['evidenceHashes'];
  readonly externalStatePolicy: Readonly<{
    databases: 'excluded';
    externalData: 'excluded';
    migrations: 'excluded';
  }>;
  readonly manifestHashes: ApprovedWebBundle['manifestHashes'];
  readonly operation: 'redeploy-approved-web-bundle';
  readonly targetCommit: string;
}

export type WebRollbackResult = Readonly<
  | { failures: readonly PublicationFailure[]; ok: false }
  | { failures: readonly []; ok: true; plan: WebRollbackPlan }
>;

const SHA256 = /^[a-f0-9]{64}$/u;
const GIT_COMMIT = /^[a-f0-9]{40}$/u;
const REQUIRED_SURFACES = ['public', 'account', 'admin'] as const;

const failure = (code: string, path: string): PublicationFailure => Object.freeze({ code, path });

const sortedFailures = (failures: readonly PublicationFailure[]): readonly PublicationFailure[] =>
  Object.freeze(
    [...failures].toSorted(
      (left, right) => left.path.localeCompare(right.path) || left.code.localeCompare(right.code),
    ),
  );

const canonicalValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .toSorted(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalValue(nested)]),
    );
  }
  return value;
};

const hashValue = (value: unknown): string =>
  createHash('sha256')
    .update(JSON.stringify(canonicalValue(value)))
    .digest('hex');

const deepFreeze = <Value>(value: Value): Value => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value as Readonly<Record<string, unknown>>)) {
      deepFreeze(nested);
    }
    Object.freeze(value);
  }
  return value;
};

type ApprovedWebBundlePayload = Omit<ApprovedWebBundle, 'bundleHash'>;

const bundlePayload = (bundle: ApprovedWebBundle): ApprovedWebBundlePayload => ({
  appArtifacts: bundle.appArtifacts,
  approvalFingerprint: bundle.approvalFingerprint,
  approvedAt: bundle.approvedAt,
  assetHashes: bundle.assetHashes,
  buildId: bundle.buildId,
  commit: bundle.commit,
  contentId: bundle.contentId,
  evidenceHashes: bundle.evidenceHashes,
  finalApproved: bundle.finalApproved,
  manifestHashes: bundle.manifestHashes,
  releaseHash: bundle.releaseHash,
  routeHash: bundle.routeHash,
});

const artifactHash = (
  input: WebPublicationInput,
  kind: PublicationArtifactKind,
): string | undefined => input.artifacts.find((artifact) => artifact.kind === kind)?.hash;

const invalidCreation = (
  failures: readonly PublicationFailure[],
): CreateApprovedWebBundleResult => ({ failures: sortedFailures(failures), ok: false });

export const createApprovedWebBundle = (
  request: CreateApprovedWebBundleInput,
): CreateApprovedWebBundleResult => {
  const failures: PublicationFailure[] = [];
  if (request.input.mode !== 'final') {
    failures.push(failure('FINAL_PUBLICATION_REQUIRED', '$.input.mode'));
  }
  if (!GIT_COMMIT.test(request.commit)) {
    failures.push(failure('INVALID_APPROVAL_COMMIT', '$.commit'));
  }
  if (!Number.isFinite(Date.parse(request.approvedAt))) {
    failures.push(failure('INVALID_APPROVAL_TIMESTAMP', '$.approvedAt'));
  }

  const independentlyEvaluated = evaluateWebPublication(request.input);
  if (!independentlyEvaluated.ok) {
    failures.push(failure('FINAL_PUBLICATION_REQUIRED', '$.publication'));
  } else if (
    !request.publication.ok ||
    request.publication.fingerprint !== independentlyEvaluated.fingerprint
  ) {
    failures.push(failure('PUBLICATION_APPROVAL_MISMATCH', '$.publication.fingerprint'));
  }

  if (failures.length > 0 || !independentlyEvaluated.ok || !request.publication.ok) {
    return invalidCreation(failures);
  }

  const manifestEntries = PUBLICATION_ARTIFACT_KINDS.map(
    (kind) => [kind, artifactHash(request.input, kind)] as const,
  );
  if (manifestEntries.some(([, hash]) => hash === undefined)) {
    return invalidCreation([failure('APPROVED_BUNDLE_INCOMPLETE', '$.input.artifacts')]);
  }
  const manifestHashes = Object.fromEntries(manifestEntries) as Readonly<
    Record<PublicationArtifactKind, string>
  >;

  const payload: ApprovedWebBundlePayload = {
    appArtifacts: request.input.appArtifacts.map(({ buildId, contentId, hash, path, surface }) => ({
      buildId,
      contentId,
      hash,
      path,
      surface,
    })),
    approvalFingerprint: independentlyEvaluated.fingerprint,
    approvedAt: request.approvedAt,
    assetHashes: {
      assets: manifestHashes.assets,
      capture: manifestHashes.capture,
      screenshots: manifestHashes.screenshots,
      visual: manifestHashes.visual,
    },
    buildId: request.input.bundle.buildId,
    commit: request.commit,
    contentId: request.input.bundle.contentId,
    evidenceHashes: {
      gates: hashValue(request.input.gates),
      policies: manifestHashes.policies,
      publication: manifestHashes.evidence,
      quality: hashValue(request.input.qualityManifests),
    },
    finalApproved: true,
    manifestHashes,
    releaseHash: manifestHashes.release,
    routeHash: manifestHashes.routes,
  };

  const bundle = deepFreeze<ApprovedWebBundle>({
    ...payload,
    bundleHash: hashValue(payload),
  });
  return Object.freeze({ bundle, failures: [] as const, ok: true });
};

const validateApprovedBundle = (
  bundle: ApprovedWebBundle,
  failures: PublicationFailure[],
): void => {
  if (!bundle.finalApproved)
    failures.push(failure('TARGET_NOT_APPROVED', '$.target.finalApproved'));
  if (!GIT_COMMIT.test(bundle.commit)) {
    failures.push(failure('INVALID_APPROVAL_COMMIT', '$.target.commit'));
  }
  if (!SHA256.test(bundle.approvalFingerprint)) {
    failures.push(failure('INVALID_APPROVAL_FINGERPRINT', '$.target.approvalFingerprint'));
  }

  for (const surface of REQUIRED_SURFACES) {
    if (bundle.appArtifacts.filter((artifact) => artifact.surface === surface).length !== 1) {
      failures.push(failure('APP_ARTIFACT_SET_INCOMPLETE', `$.target.appArtifacts.${surface}`));
    }
  }
  for (const artifact of bundle.appArtifacts) {
    if (artifact.buildId !== bundle.buildId || artifact.contentId !== bundle.contentId) {
      failures.push(failure('MIXED_BUNDLE_VERSION', `$.target.appArtifacts.${artifact.surface}`));
    }
    if (!SHA256.test(artifact.hash)) {
      failures.push(failure('INVALID_ARTIFACT_HASH', `$.target.appArtifacts.${artifact.surface}`));
    }
  }

  for (const kind of PUBLICATION_ARTIFACT_KINDS) {
    if (!SHA256.test(bundle.manifestHashes[kind])) {
      failures.push(failure('INVALID_MANIFEST_HASH', `$.target.manifestHashes.${kind}`));
    }
  }
  for (const [name, hash] of Object.entries(bundle.assetHashes)) {
    if (!SHA256.test(hash))
      failures.push(failure('INVALID_ASSET_HASH', `$.target.assetHashes.${name}`));
  }
  for (const [name, hash] of Object.entries(bundle.evidenceHashes)) {
    if (!SHA256.test(hash)) {
      failures.push(failure('INVALID_EVIDENCE_HASH', `$.target.evidenceHashes.${name}`));
    }
  }
  if (
    bundle.routeHash !== bundle.manifestHashes.routes ||
    bundle.releaseHash !== bundle.manifestHashes.release ||
    bundle.assetHashes.assets !== bundle.manifestHashes.assets ||
    bundle.assetHashes.capture !== bundle.manifestHashes.capture ||
    bundle.assetHashes.screenshots !== bundle.manifestHashes.screenshots ||
    bundle.assetHashes.visual !== bundle.manifestHashes.visual ||
    bundle.evidenceHashes.policies !== bundle.manifestHashes.policies ||
    bundle.evidenceHashes.publication !== bundle.manifestHashes.evidence
  ) {
    failures.push(failure('MIXED_BUNDLE_VERSION', '$.target.manifestHashes'));
  }
  if (!SHA256.test(bundle.bundleHash) || hashValue(bundlePayload(bundle)) !== bundle.bundleHash) {
    failures.push(failure('BUNDLE_INTEGRITY_MISMATCH', '$.target.bundleHash'));
  }
};

export const resolveWebRollback = (request: ResolveWebRollbackInput): WebRollbackResult => {
  const failures: PublicationFailure[] = [];
  if (request.rollbackExternalData || request.rollbackMigrations) {
    failures.push(failure('EXTERNAL_STATE_ROLLBACK_REJECTED', '$.externalState'));
  }
  if (request.targetCommit === request.currentCommit) {
    failures.push(failure('CURRENT_DEPLOYMENT_REJECTED', '$.targetCommit'));
  }

  const matches = request.approvedBundles.filter(({ commit }) => commit === request.targetCommit);
  if (matches.length === 0) {
    failures.push(failure('APPROVED_BUNDLE_NOT_FOUND', '$.targetCommit'));
  } else if (matches.length > 1) {
    failures.push(failure('AMBIGUOUS_APPROVED_BUNDLE', '$.targetCommit'));
  }
  const target = matches[0];
  if (target !== undefined) validateApprovedBundle(target, failures);

  if (failures.length > 0 || target === undefined) {
    return Object.freeze({ failures: sortedFailures(failures), ok: false });
  }

  const plan = deepFreeze<WebRollbackPlan>({
    appArtifacts: target.appArtifacts.map((artifact) => ({ ...artifact })),
    assetHashes: { ...target.assetHashes },
    buildId: target.buildId,
    contentId: target.contentId,
    evidenceHashes: { ...target.evidenceHashes },
    externalStatePolicy: {
      databases: 'excluded',
      externalData: 'excluded',
      migrations: 'excluded',
    },
    manifestHashes: { ...target.manifestHashes },
    operation: 'redeploy-approved-web-bundle',
    targetCommit: target.commit,
  });
  return Object.freeze({ failures: [] as const, ok: true, plan });
};
