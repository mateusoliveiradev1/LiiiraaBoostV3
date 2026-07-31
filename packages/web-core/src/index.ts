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
} from './routes.js';
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
} from './routes.js';
export { validateWebDocument } from '@liiiraa/contracts-ts';
export type {
  FutureAuthorityCommandJson,
  NoChangeReceiptJson,
  WebDocumentValidationResult,
} from '@liiiraa/contracts-ts';
export { createContentIdentity } from './content.js';
export type {
  ContentIdentity,
  ContentIdentityErrorCode,
  ContentIdentityResult,
} from './content.js';
export { CONTENT_BUNDLE_SCHEMA_VERSION, admitContentBundle } from './content-admission.js';
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
} from './content-admission.js';
export { buildPublicSearchIndex, searchPublicContent } from './search.js';
export type {
  PublicSearchIndex,
  PublicSearchIndexError,
  PublicSearchIndexErrorCode,
  PublicSearchIndexResult,
  PublicSearchResponse,
  SearchDocument,
  SearchFilters,
  SearchResult,
} from './search.js';

export {
  DOCUMENTATION_DOMAINS,
  DOCUMENTATION_PLATFORMS,
  DOCUMENTATION_SECTION_ORDER,
  resolveDesktopDocumentationLink,
  resolveDocument,
  searchDocumentation,
} from './documentation.js';
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
} from './documentation.js';
