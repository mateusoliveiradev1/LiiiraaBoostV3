import {
  WEB_CHANNELS,
  WEB_LOCALES,
  WEB_VERSIONS,
  isWebRouteId,
  webRoutes,
  type WebChannel,
  type WebLocale,
  type WebRouteId,
  type WebVersion,
} from './routes.ts';

export type ContentIdentity = Readonly<{
  channel: WebChannel;
  indexing: 'index' | 'noindex';
  locale: WebLocale;
  owner: string;
  routeId: WebRouteId;
  version: WebVersion;
}>;

export type ContentIdentityErrorCode =
  'INVALID_CHANNEL' | 'INVALID_LOCALE' | 'INVALID_VERSION' | 'UNKNOWN_ROUTE_ID' | 'UNOWNED_ROUTE';

export type ContentIdentityResult =
  | Readonly<{ ok: true; value: ContentIdentity }>
  | Readonly<{
      error: Readonly<{ code: ContentIdentityErrorCode; path: string }>;
      ok: false;
    }>;

const failure = (code: ContentIdentityErrorCode, path: string): ContentIdentityResult =>
  Object.freeze({
    error: Object.freeze({ code, path }),
    ok: false,
  });

const includes = <Value extends string>(value: string, allowed: readonly Value[]): value is Value =>
  allowed.includes(value as Value);

export const createContentIdentity = (
  input: Readonly<{
    channel: string;
    locale: string;
    routeId: string;
    version: string;
  }>,
): ContentIdentityResult => {
  if (!isWebRouteId(input.routeId)) {
    return failure('UNKNOWN_ROUTE_ID', '$.routeId');
  }
  if (!includes(input.locale, WEB_LOCALES)) {
    return failure('INVALID_LOCALE', '$.locale');
  }
  if (!includes(input.version, WEB_VERSIONS)) {
    return failure('INVALID_VERSION', '$.version');
  }
  if (!includes(input.channel, WEB_CHANNELS)) {
    return failure('INVALID_CHANNEL', '$.channel');
  }

  const route = webRoutes.find(({ id }) => id === input.routeId);
  if (route === undefined || route.owner.length === 0) {
    return failure('UNOWNED_ROUTE', '$.routeId');
  }

  return Object.freeze({
    ok: true,
    value: Object.freeze({
      channel: input.channel,
      indexing: route.indexing,
      locale: input.locale,
      owner: route.owner,
      routeId: input.routeId,
      version: input.version,
    }),
  });
};
