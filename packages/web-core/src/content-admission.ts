import {
  validateWebDocument,
  type ContentRecordJson,
  type ScreenshotProvenanceJson,
  type WebRouteRecordJson,
} from '@liiiraa/contracts-ts';

export const CONTENT_BUNDLE_SCHEMA_VERSION = 1 as const;

const REVIEW_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1_000;
const ALLOWED_EVIDENCE_HOSTS = new Set(['liiiraa.com', 'www.liiiraa.com']);
const SAFE_ASSET_PATH = /^\/(?:media|product)\/[A-Za-z0-9][A-Za-z0-9._/-]*\.(?:avif|webp)$/u;
const RAW_EXECUTABLE_CONTENT =
  /(?:<\s*script\b|<\s*[A-Z][A-Za-z0-9]*\b|dangerouslySetInnerHTML|javascript:|^\s*(?:import|export)\s.+\sfrom\s+['"])/imu;
const MUTATION_RECIPE =
  /(?:```\s*(?:powershell|pwsh|batch|cmd)|\bSet-ItemProperty\b|\bNew-ItemProperty\b|\bInvoke-Expression\b|\breg(?:\.exe)?\s+(?:add|delete)\b|\bsc(?:\.exe)?\s+(?:config|create|delete)\b)/iu;

export type ContentType =
  | 'product'
  | 'capability'
  | 'compatibility'
  | 'plan'
  | 'documentation'
  | 'release'
  | 'support'
  | 'legal'
  | 'error'
  | 'critical-notice';

export type ContentRisk = 'none' | 'low' | 'medium' | 'high' | 'critical';
export type ContentAvailability =
  'available' | 'under-validation' | 'planned' | 'unsupported' | 'obsolete';

export type ContentAsset = Readonly<{
  id: string;
  path: string;
  purpose: 'social' | 'screenshot';
  provenance: unknown;
}>;

export type RepositoryContentRecord = Readonly<{
  document: ContentRecordJson;
  translationKey: string;
  contentType: ContentType;
  source: string;
  title: string;
  summary: string;
  body: string;
  metadata: Readonly<{
    title: string;
    description: string;
    socialImageId: string;
  }>;
  warnings: readonly string[];
  screenshotAssetIds: readonly string[];
  actionableClaims: readonly string[];
  identifiers: readonly string[];
  errorCodes: readonly string[];
  suggestions: readonly string[];
  domain: string;
  risk: ContentRisk;
  availability: ContentAvailability;
  canonicalRouteId?: string;
}>;

export type ContentAdmissionInput = Readonly<{
  records: readonly RepositoryContentRecord[];
  clock: Date;
  routeManifest: readonly WebRouteRecordJson[];
  assetIndex: readonly ContentAsset[];
}>;

export type ContentAdmissionErrorCode =
  | 'ASSET_INVALID'
  | 'ASSET_MISSING'
  | 'CANONICAL_ROUTE_INVALID'
  | 'CONTENT_EMPTY'
  | 'DUPLICATE_RECORD'
  | 'EVIDENCE_ORIGIN_UNSUPPORTED'
  | 'EVIDENCE_UNTRUSTED'
  | 'EVIDENCE_VERSION_MISMATCH'
  | 'EXECUTABLE_CONTENT'
  | 'INDEXING_MISMATCH'
  | 'LOCALE_PARITY_MISMATCH'
  | 'LOCALE_PARITY_MISSING'
  | 'METADATA_INCOMPLETE'
  | 'MUTATION_RECIPE'
  | 'REVIEW_DATE_INVALID'
  | 'REVIEW_STALE'
  | 'ROUTE_NOT_PUBLIC'
  | 'ROUTE_OWNER_MISMATCH'
  | 'ROUTE_UNKNOWN'
  | 'SCHEMA_INVALID'
  | 'SOURCE_NOT_REPOSITORY'
  | 'WARNING_MISSING';

export type ContentAdmissionError = Readonly<{
  code: ContentAdmissionErrorCode;
  path: string;
}>;

export type AdmittedContentRecord = Readonly<
  Omit<RepositoryContentRecord, 'document' | 'actionableClaims'> & {
    document: ContentRecordJson;
    actionableClaims: readonly string[];
    historyState: 'current' | 'stale-history';
  }
>;

export type AdmittedContentBundle = Readonly<{
  schemaVersion: typeof CONTENT_BUNDLE_SCHEMA_VERSION;
  buildId: string;
  contentId: string;
  records: readonly AdmittedContentRecord[];
  searchableRouteIds: readonly string[];
}>;

export type ContentAdmissionResult =
  | Readonly<{ ok: true; value: AdmittedContentBundle }>
  | Readonly<{ ok: false; error: ContentAdmissionError }>;

const freeze = <Value>(value: Value): Value => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) {
      freeze(child);
    }
    Object.freeze(value);
  }
  return value;
};

const failure = (code: ContentAdmissionErrorCode, path: string): ContentAdmissionResult =>
  freeze({
    ok: false,
    error: { code, path },
  });

const isNonEmpty = (value: string): boolean => value.trim().length > 0;

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, child]) => child !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stableValue(child)]),
    );
  }
  return value;
};

const digest = async (value: unknown): Promise<string> => {
  const bytes = new TextEncoder().encode(JSON.stringify(stableValue(value)));
  const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

const routeFor = (
  routeManifest: readonly WebRouteRecordJson[],
  routeId: string,
): WebRouteRecordJson | undefined => routeManifest.find((route) => route.id === routeId);

const hasSupportedEvidenceOrigin = (source: string): boolean => {
  try {
    const url = new URL(source);
    return url.protocol === 'https:' && ALLOWED_EVIDENCE_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
};

const validateAsset = (
  assetId: string,
  purpose: ContentAsset['purpose'],
  record: ContentRecordJson,
  assetIndex: readonly ContentAsset[],
  path: string,
): ContentAdmissionResult | ScreenshotProvenanceJson => {
  const asset = assetIndex.find(({ id }) => id === assetId);
  if (asset === undefined) {
    return failure('ASSET_MISSING', path);
  }
  if (asset.purpose !== purpose || !SAFE_ASSET_PATH.test(asset.path)) {
    return failure('ASSET_INVALID', path);
  }
  const validation = validateWebDocument(asset.provenance);
  if (!validation.ok || !('scenarioId' in validation.value)) {
    return failure('ASSET_INVALID', path);
  }
  const provenance = validation.value;
  if (
    provenance.reviewState !== 'approved' ||
    provenance.locale !== record.locale ||
    provenance.version !== record.version
  ) {
    return failure('ASSET_INVALID', path);
  }
  return provenance;
};

const isFailure = (
  value: ContentAdmissionResult | ScreenshotProvenanceJson,
): value is ContentAdmissionResult => 'ok' in value;

const isStaleHistory = (document: ContentRecordJson, route: WebRouteRecordJson): boolean =>
  route.indexing === 'noindex' && document.validationState === 'stale';

const validateEvidence = (
  record: RepositoryContentRecord,
  history: boolean,
  path: string,
): ContentAdmissionResult | undefined => {
  for (const [index, item] of record.document.evidence.entries()) {
    const evidencePath = `${path}.document.evidence[${String(index)}]`;
    if (!hasSupportedEvidenceOrigin(item.source)) {
      return failure('EVIDENCE_ORIGIN_UNSUPPORTED', `${evidencePath}.source`);
    }
    if (item.applicableVersion !== record.document.version) {
      return failure('EVIDENCE_VERSION_MISMATCH', `${evidencePath}.applicableVersion`);
    }
    if (
      !history &&
      (item.validationState !== 'validated' ||
        item.unproven ||
        item.provenance.kind === 'unavailable' ||
        item.provenance.kind === 'fixture')
    ) {
      return failure('EVIDENCE_UNTRUSTED', evidencePath);
    }
  }
  return undefined;
};

const validateRecord = (
  record: RepositoryContentRecord,
  index: number,
  input: Omit<ContentAdmissionInput, 'records'>,
): ContentAdmissionResult | AdmittedContentRecord => {
  const path = `$.records[${String(index)}]`;
  const validation = validateWebDocument(record.document);
  if (!validation.ok || !('routeId' in validation.value)) {
    return failure('SCHEMA_INVALID', `${path}.document`);
  }
  const document = validation.value;
  const route = routeFor(input.routeManifest, document.routeId);
  if (route === undefined) {
    return failure('ROUTE_UNKNOWN', `${path}.document.routeId`);
  }
  if (
    route.surface !== 'public' ||
    route.securityBoundary !== 'public-origin' ||
    route.scenarioRequirement !== 'available'
  ) {
    return failure('ROUTE_NOT_PUBLIC', `${path}.document.routeId`);
  }
  if (route.owner !== document.owner) {
    return failure('ROUTE_OWNER_MISMATCH', `${path}.document.owner`);
  }
  if (route.indexing !== document.indexing) {
    return failure('INDEXING_MISMATCH', `${path}.document.indexing`);
  }
  if (record.source !== 'repository') {
    return failure('SOURCE_NOT_REPOSITORY', `${path}.source`);
  }

  const history = isStaleHistory(document, route);
  if (document.validationState !== 'validated' && !history) {
    return failure('EVIDENCE_UNTRUSTED', `${path}.document.validationState`);
  }

  const reviewedAt = Date.parse(document.lastReviewedAt);
  if (!Number.isFinite(reviewedAt) || reviewedAt > input.clock.getTime()) {
    return failure('REVIEW_DATE_INVALID', `${path}.document.lastReviewedAt`);
  }
  if (!history && input.clock.getTime() - reviewedAt > REVIEW_MAX_AGE_MS) {
    return failure('REVIEW_STALE', `${path}.document.lastReviewedAt`);
  }

  const evidenceFailure = validateEvidence(record, history, path);
  if (evidenceFailure !== undefined) {
    return evidenceFailure;
  }

  if (
    !isNonEmpty(record.translationKey) ||
    !isNonEmpty(record.title) ||
    !isNonEmpty(record.summary) ||
    !isNonEmpty(record.body) ||
    !isNonEmpty(record.domain)
  ) {
    return failure('CONTENT_EMPTY', path);
  }
  if (
    !isNonEmpty(record.metadata.title) ||
    !isNonEmpty(record.metadata.description) ||
    !isNonEmpty(record.metadata.socialImageId)
  ) {
    return failure('METADATA_INCOMPLETE', `${path}.metadata`);
  }
  if (record.warnings.length === 0 || record.warnings.some((item) => !isNonEmpty(item))) {
    return failure('WARNING_MISSING', `${path}.warnings`);
  }

  const authoredText = [
    record.title,
    record.summary,
    record.body,
    record.metadata.title,
    record.metadata.description,
    ...record.warnings,
    ...record.actionableClaims,
    ...record.suggestions,
  ].join('\n');
  if (RAW_EXECUTABLE_CONTENT.test(authoredText)) {
    return failure('EXECUTABLE_CONTENT', `${path}.body`);
  }
  if (MUTATION_RECIPE.test(authoredText)) {
    return failure('MUTATION_RECIPE', `${path}.body`);
  }

  const social = validateAsset(
    record.metadata.socialImageId,
    'social',
    document,
    input.assetIndex,
    `${path}.metadata.socialImageId`,
  );
  if (isFailure(social)) {
    return social;
  }
  if (record.screenshotAssetIds.length === 0) {
    return failure('ASSET_MISSING', `${path}.screenshotAssetIds`);
  }
  for (const [assetIndex, assetId] of record.screenshotAssetIds.entries()) {
    const screenshotResult = validateAsset(
      assetId,
      'screenshot',
      document,
      input.assetIndex,
      `${path}.screenshotAssetIds[${String(assetIndex)}]`,
    );
    if (isFailure(screenshotResult)) {
      return screenshotResult;
    }
  }

  let canonicalRouteId = record.canonicalRouteId;
  if (history) {
    const canonicalRoute =
      canonicalRouteId === undefined ? undefined : routeFor(input.routeManifest, canonicalRouteId);
    if (
      canonicalRoute?.surface !== 'public' ||
      canonicalRoute.securityBoundary !== 'public-origin' ||
      canonicalRoute.indexing !== 'index' ||
      canonicalRoute.scenarioRequirement !== 'available'
    ) {
      return failure('CANONICAL_ROUTE_INVALID', `${path}.canonicalRouteId`);
    }
    canonicalRouteId = canonicalRoute.id;
  }

  return freeze({
    ...record,
    document,
    ...(canonicalRouteId === undefined ? {} : { canonicalRouteId }),
    actionableClaims: history ? [] : [...record.actionableClaims],
    historyState: history ? 'stale-history' : 'current',
  });
};

const admittedFailure = (
  value: ContentAdmissionResult | AdmittedContentRecord,
): value is ContentAdmissionResult => 'ok' in value;

const compareRecords = (left: AdmittedContentRecord, right: AdmittedContentRecord): number => {
  const leftKey = `${left.translationKey}\u0000${left.document.routeId}\u0000${left.document.version}\u0000${left.document.locale}\u0000${left.document.id}`;
  const rightKey = `${right.translationKey}\u0000${right.document.routeId}\u0000${right.document.version}\u0000${right.document.locale}\u0000${right.document.id}`;
  return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
};

const validateParity = (
  records: readonly AdmittedContentRecord[],
): ContentAdmissionResult | undefined => {
  const groups = new Map<string, AdmittedContentRecord[]>();
  for (const record of records) {
    const groupKey = `${record.translationKey}\u0000${record.document.version}\u0000${record.document.channel}`;
    const group = groups.get(groupKey) ?? [];
    group.push(record);
    groups.set(groupKey, group);
  }

  for (const group of groups.values()) {
    const locales = new Set(group.map(({ document }) => document.locale));
    if (locales.size !== group.length) {
      return failure('DUPLICATE_RECORD', '$.records');
    }
    if (!locales.has('pt-BR') || !locales.has('en') || group.length !== 2) {
      return failure('LOCALE_PARITY_MISSING', '$.records');
    }
    const [first, second] = group;
    if (
      first?.document.routeId !== second?.document.routeId ||
      first?.document.owner !== second?.document.owner ||
      first?.document.indexing !== second?.document.indexing ||
      first?.contentType !== second?.contentType ||
      first?.domain !== second?.domain ||
      first?.risk !== second?.risk ||
      first?.availability !== second?.availability ||
      first?.historyState !== second?.historyState
    ) {
      return failure('LOCALE_PARITY_MISMATCH', '$.records');
    }
  }
  return undefined;
};

export const admitContentBundle = async (
  records: readonly RepositoryContentRecord[],
  context: Omit<ContentAdmissionInput, 'records'>,
): Promise<ContentAdmissionResult> => {
  const admitted: AdmittedContentRecord[] = [];
  for (const [index, record] of records.entries()) {
    const result = validateRecord(record, index, context);
    if (admittedFailure(result)) {
      return result;
    }
    admitted.push(result);
  }

  const parityFailure = validateParity(admitted);
  if (parityFailure !== undefined) {
    return parityFailure;
  }

  admitted.sort(compareRecords);
  const searchableRouteIds = [
    ...new Set(
      admitted
        .filter(
          ({ document, historyState }) =>
            document.indexing === 'index' &&
            document.validationState === 'validated' &&
            historyState === 'current',
        )
        .map(({ document }) => document.routeId),
    ),
  ].sort();
  const contentId = `content-${await digest(admitted)}`;
  const buildId = `build-${await digest({
    schemaVersion: CONTENT_BUNDLE_SCHEMA_VERSION,
    contentId,
    clock: context.clock.toISOString(),
    searchableRouteIds,
  })}`;

  return freeze({
    ok: true,
    value: {
      schemaVersion: CONTENT_BUNDLE_SCHEMA_VERSION,
      buildId,
      contentId,
      records: admitted,
      searchableRouteIds,
    },
  });
};
