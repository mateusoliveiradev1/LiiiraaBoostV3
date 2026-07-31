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
export { createContentIdentity } from './content.js';
export type {
  ContentIdentity,
  ContentIdentityErrorCode,
  ContentIdentityResult,
} from './content.js';
