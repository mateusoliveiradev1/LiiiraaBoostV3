export const WEB_CORE_CONTRACT_VERSION = 1 as const;

export {
  WEB_CHANNELS,
  WEB_DOCUMENT_SECTIONS,
  WEB_LOCALES,
  WEB_ORIGINS,
  WEB_VERSIONS,
  auditRouteProjection,
  createBoundaryLink,
  isWebRouteId,
  matchWebRoute,
  projectBreadcrumbs,
  projectDesktopLinks,
  projectIndexing,
  projectNavigation,
  projectRedirects,
  projectSitemap,
  routeHref,
  webRoutes,
} from './routes.ts';
export type {
  BoundaryContext,
  BoundaryLink,
  BoundaryLinkErrorCode,
  BoundaryLinkResult,
  RouteProjection,
  RouteProjectionAuditResult,
  RouteProjectionConsumer,
  RouteProjectionErrorCode,
  WebChannel,
  WebDocumentSection,
  WebLocale,
  WebRoute,
  WebRouteError,
  WebRouteErrorCode,
  WebRouteId,
  WebRouteMatch,
  WebRouteResult,
  WebVersion,
} from './routes.ts';
export { validateWebDocument } from '@liiiraa/contracts-ts/web-validation';
export type {
  FutureAuthorityCommandJson,
  NoChangeReceiptJson,
} from '@liiiraa/contracts-ts/generated';
export type { WebDocumentValidationResult } from '@liiiraa/contracts-ts/web-validation';
export { createContentIdentity } from './content.ts';
export type {
  ContentIdentity,
  ContentIdentityErrorCode,
  ContentIdentityResult,
} from './content.ts';
export { CONTENT_BUNDLE_SCHEMA_VERSION, admitContentBundle } from './content-admission.ts';
export type {
  AdmittedContentBundle,
  AdmittedContentRecord,
  ContentAdmissionError,
  ContentAdmissionErrorCode,
  ContentAdmissionInput,
  ContentAdmissionResult,
  ContentAsset,
  ContentAvailability,
  ContentRisk,
  ContentType,
  RepositoryContentRecord,
} from './content-admission.ts';
export { buildPublicSearchIndex, searchPublicContent } from './search.ts';
export type {
  PublicSearchIndex,
  PublicSearchIndexError,
  PublicSearchIndexErrorCode,
  PublicSearchIndexResult,
  PublicSearchResponse,
  SearchDocument,
  SearchFilters,
  SearchResult,
} from './search.ts';

export {
  DOCUMENTATION_DOMAINS,
  DOCUMENTATION_PLATFORMS,
  DOCUMENTATION_SECTION_ORDER,
  resolveDesktopDocumentationLink,
  resolveDocument,
  searchDocumentation,
} from './documentation.ts';
export { decideDownload, selectReleaseChannel, verifyReleaseIntegrity } from './releases.ts';
export type {
  DownloadBlockedReason,
  DownloadDecision,
  DownloadDecisionInput,
  ExperimentalChannelAcknowledgement,
  HistoricalReleaseState,
  InspectedReleaseArtifact,
  IntegrityDisagreement,
  IntegrityField,
  IntegrityValueClass,
  PublicReleaseChannel,
  ReleaseChannelRequest,
  ReleaseChannelSelection,
  ReleaseIntegrityResult,
  ReleaseManifestEvidence,
  ReleaseProvenance,
  VerificationStep,
} from './releases.ts';
export type {
  CurrentDocumentResolution,
  DesktopDocumentationIntent,
  DesktopDocumentationLinkErrorCode,
  DesktopDocumentationLinkResult,
  DocumentIdentity,
  DocumentResolution,
  DocumentResolutionErrorCode,
  DocumentationArticle,
  DocumentationDomain,
  DocumentationKind,
  DocumentationMetadata,
  DocumentationPlatform,
  DocumentationSearchFilters,
  DocumentationSearchResponse,
  DocumentationSearchResult,
  DocumentationSection,
  DocumentationSectionKind,
  StaleDocumentResolution,
  TroubleshootingPath,
} from './documentation.ts';
