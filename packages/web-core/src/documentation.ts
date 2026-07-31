import {
  WEB_CHANNELS,
  WEB_DOCUMENT_SECTIONS,
  WEB_LOCALES,
  WEB_ORIGINS,
  WEB_VERSIONS,
  routeHref,
  type WebChannel,
  type WebDocumentSection,
  type WebLocale,
  type WebRouteId,
  type WebVersion,
} from './routes.ts';
import type { ContentRisk } from './content-admission.ts';

export const DOCUMENTATION_DOMAINS = Object.freeze([
  'getting-started',
  'preparing',
  'measuring',
  'optimizing',
  'restoring',
  'troubleshooting',
] as const);

export const DOCUMENTATION_SECTION_ORDER = Object.freeze([
  'purpose',
  'next-action',
  'evidence',
  'risks',
  'compatibility',
  'recovery',
  'technical-detail',
] as const);

export const DOCUMENTATION_PLATFORMS = Object.freeze(['windows-10', 'windows-11'] as const);

export type DocumentationDomain = (typeof DOCUMENTATION_DOMAINS)[number];
export type DocumentationSectionKind = (typeof DOCUMENTATION_SECTION_ORDER)[number];
export type DocumentationPlatform = (typeof DOCUMENTATION_PLATFORMS)[number];
export type DocumentationKind = 'article' | 'reference' | 'troubleshooting';

export type DocumentIdentity = Readonly<{
  locale: WebLocale;
  version: WebVersion;
  channel: WebChannel;
  slug: string;
  section: WebDocumentSection;
}>;

export type DocumentationSection = Readonly<{
  id: string;
  kind: DocumentationSectionKind;
  heading: string;
  body: string;
}>;

export type DocumentationMetadata = Readonly<{
  lastReviewedAt: string;
  owner: string;
  validationState: 'validated' | 'under-validation' | 'unsupported';
  evidenceReferences: readonly string[];
  releaseReferences: readonly string[];
}>;

export type TroubleshootingPath = Readonly<{
  observedState: string;
  evidence: readonly string[];
  safeSteps: readonly string[];
  recovery: readonly string[];
  escalation: string;
}>;

export type DocumentationArticle = Readonly<{
  identity: DocumentIdentity;
  domain: DocumentationDomain;
  kind: DocumentationKind;
  title: string;
  summary: string;
  platform: readonly DocumentationPlatform[];
  risk: ContentRisk;
  metadata: DocumentationMetadata;
  sections: readonly DocumentationSection[];
  identifiers: readonly string[];
  errorCodes: readonly string[];
  supported: boolean;
  canonicalIdentity?: DocumentIdentity;
  troubleshooting?: TroubleshootingPath;
}>;

export type CurrentDocumentResolution = Readonly<{
  status: 'current';
  document: DocumentationArticle;
  href: string;
  routeId: DocumentationRouteId;
}>;

export type StaleDocumentResolution = Readonly<{
  status: 'stale';
  document: DocumentationArticle;
  href: string;
  routeId: 'docs-history';
  notice: Readonly<{
    persistent: true;
    reason: 'historical' | 'unsupported';
    canonical: Readonly<{
      identity: DocumentIdentity;
      href: string;
    }>;
  }>;
}>;

export type DocumentResolutionErrorCode =
  | 'CANONICAL_DOCUMENT_MISSING'
  | 'INCOMPATIBLE_CHANNEL'
  | 'INCOMPATIBLE_LOCALE'
  | 'INCOMPATIBLE_VERSION'
  | 'INVALID_DOCUMENT'
  | 'ROUTE_INVALID'
  | 'UNKNOWN_DOCUMENT'
  | 'UNSAFE_CONTENT'
  | 'UNSAFE_IDENTITY';

export type DocumentResolution = Readonly<
  | {
      ok: true;
      value: CurrentDocumentResolution | StaleDocumentResolution;
    }
  | {
      ok: false;
      error: Readonly<{
        code: DocumentResolutionErrorCode;
        path: string;
        fallbackIdentity?: DocumentIdentity;
      }>;
    }
>;

export type DocumentationSearchFilters = Readonly<{
  locale: WebLocale;
  version?: WebVersion;
  channel?: WebChannel;
  platform?: DocumentationPlatform;
  risk?: ContentRisk;
  domain?: DocumentationDomain;
}>;

export type DocumentationSearchResult = Readonly<{
  document: DocumentationArticle;
  href: string;
  matchedBy: 'body' | 'error-code' | 'identifier' | 'natural-language' | 'title';
  score: number;
}>;

export type DocumentationSearchResponse = Readonly<{
  state: 'results' | 'no-results';
  submittedQuery: string;
  filters: DocumentationSearchFilters;
  results: readonly DocumentationSearchResult[];
}>;

export type DesktopDocumentationIntent = Readonly<
  DocumentIdentity & {
    articleSectionId: string;
  }
>;

export type DesktopDocumentationLinkErrorCode =
  DocumentResolutionErrorCode | 'INCOMPATIBLE_VERSION' | 'UNKNOWN_SECTION';

export type DesktopDocumentationLinkResult = Readonly<
  | {
      ok: true;
      value: Readonly<{
        identity: DocumentIdentity;
        articleSectionId: string;
        href: string;
        routeId: DocumentationRouteId;
      }>;
    }
  | {
      ok: false;
      error: Readonly<{
        code: DesktopDocumentationLinkErrorCode;
        path: string;
        fallbackIdentity?: DocumentIdentity;
      }>;
    }
>;

type DocumentationRouteId =
  'docs-article' | 'docs-history' | 'docs-reference' | 'docs-troubleshooting';

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const UNSAFE_TECHNICAL_CONTENT =
  /(?:<\s*script\b|javascript:|```\s*(?:powershell|pwsh|batch|cmd)|\b(?:Set|New)-ItemProperty\b|\bInvoke-Expression\b|\breg(?:\.exe)?\s+(?:add|delete)\b|\bsc(?:\.exe)?\s+(?:config|create|delete)\b)/iu;

const SECTION_RANK = new Map<DocumentationSectionKind, number>(
  DOCUMENTATION_SECTION_ORDER.map((kind, index) => [kind, index]),
);

const deepFreeze = <Value>(value: Value): Value => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
    Object.freeze(value);
  }
  return value;
};

const success = (value: CurrentDocumentResolution | StaleDocumentResolution): DocumentResolution =>
  deepFreeze({ ok: true, value });

const failure = (
  code: DocumentResolutionErrorCode,
  path: string,
  fallbackIdentity?: DocumentIdentity,
): DocumentResolution =>
  deepFreeze({
    ok: false,
    error: {
      code,
      path,
      ...(fallbackIdentity === undefined ? {} : { fallbackIdentity }),
    },
  });

const includes = <Value extends string>(values: readonly Value[], value: string): value is Value =>
  values.includes(value as Value);

const IDENTITY_KEYS = Object.freeze(['locale', 'version', 'channel', 'slug', 'section'] as const);

const safeIdentity = (
  identity: DocumentIdentity,
  allowedExtraKeys: readonly string[] = [],
): boolean => {
  const candidate: unknown = identity;
  if (candidate === null || typeof candidate !== 'object') return false;

  const keys = Object.keys(candidate);
  if (keys.some((key) => !includes(IDENTITY_KEYS, key) && !allowedExtraKeys.includes(key))) {
    return false;
  }

  return (
    typeof identity.locale === 'string' &&
    typeof identity.version === 'string' &&
    typeof identity.channel === 'string' &&
    typeof identity.section === 'string' &&
    typeof identity.slug === 'string' &&
    includes(WEB_LOCALES, identity.locale) &&
    includes(WEB_VERSIONS, identity.version) &&
    includes(WEB_CHANNELS, identity.channel) &&
    includes(WEB_DOCUMENT_SECTIONS, identity.section) &&
    SAFE_ID.test(identity.slug)
  );
};

const sameIdentity = (left: DocumentIdentity, right: DocumentIdentity): boolean =>
  left.locale === right.locale &&
  left.version === right.version &&
  left.channel === right.channel &&
  left.slug === right.slug &&
  left.section === right.section;

const textIsSafe = (article: DocumentationArticle): boolean => {
  const authoredText = [
    article.title,
    article.summary,
    ...article.sections.flatMap(({ heading, body }) => [heading, body]),
    ...(article.troubleshooting === undefined
      ? []
      : [
          article.troubleshooting.observedState,
          ...article.troubleshooting.evidence,
          ...article.troubleshooting.safeSteps,
          ...article.troubleshooting.recovery,
          article.troubleshooting.escalation,
        ]),
  ].join('\n');

  return !UNSAFE_TECHNICAL_CONTENT.test(authoredText);
};

const validArticle = (article: DocumentationArticle): boolean => {
  if (
    !safeIdentity(article.identity) ||
    article.domain !== article.identity.section ||
    !includes(DOCUMENTATION_DOMAINS, article.domain) ||
    !includes(DOCUMENTATION_PLATFORMS, article.platform[0] ?? '') ||
    article.platform.some((platform) => !includes(DOCUMENTATION_PLATFORMS, platform)) ||
    article.title.trim().length === 0 ||
    article.summary.trim().length === 0 ||
    article.metadata.owner.trim().length === 0 ||
    !Number.isFinite(Date.parse(article.metadata.lastReviewedAt)) ||
    article.sections.length === 0 ||
    article.sections.some(
      ({ id, heading, body, kind }) =>
        !SAFE_ID.test(id) ||
        !includes(DOCUMENTATION_SECTION_ORDER, kind) ||
        heading.trim().length === 0 ||
        body.trim().length === 0,
    ) ||
    new Set(article.sections.map(({ id }) => id)).size !== article.sections.length
  ) {
    return false;
  }

  if (
    article.kind === 'troubleshooting' &&
    (article.troubleshooting === undefined ||
      article.errorCodes.length === 0 ||
      article.troubleshooting.observedState.trim().length === 0 ||
      article.troubleshooting.evidence.length === 0 ||
      article.troubleshooting.safeSteps.length === 0 ||
      article.troubleshooting.recovery.length === 0 ||
      article.troubleshooting.escalation.trim().length === 0)
  ) {
    return false;
  }

  return article.canonicalIdentity === undefined || safeIdentity(article.canonicalIdentity);
};

const cloneIdentity = (identity: DocumentIdentity): DocumentIdentity => deepFreeze({ ...identity });

const orderedDocument = (article: DocumentationArticle): DocumentationArticle =>
  deepFreeze({
    ...article,
    identity: cloneIdentity(article.identity),
    ...(article.canonicalIdentity === undefined
      ? {}
      : { canonicalIdentity: cloneIdentity(article.canonicalIdentity) }),
    platform: [...article.platform],
    metadata: {
      ...article.metadata,
      evidenceReferences: [...article.metadata.evidenceReferences],
      releaseReferences: [...article.metadata.releaseReferences],
    },
    sections: [...article.sections]
      .map((item) => ({ ...item }))
      .sort(
        (left, right) =>
          (SECTION_RANK.get(left.kind) ?? Number.MAX_SAFE_INTEGER) -
            (SECTION_RANK.get(right.kind) ?? Number.MAX_SAFE_INTEGER) ||
          left.id.localeCompare(right.id),
      ),
    identifiers: [...article.identifiers],
    errorCodes: [...article.errorCodes],
    ...(article.troubleshooting === undefined
      ? {}
      : {
          troubleshooting: {
            ...article.troubleshooting,
            evidence: [...article.troubleshooting.evidence],
            safeSteps: [...article.troubleshooting.safeSteps],
            recovery: [...article.troubleshooting.recovery],
          },
        }),
  });

const routeIdFor = (article: DocumentationArticle, stale: boolean): DocumentationRouteId => {
  if (stale) return 'docs-history';
  if (article.kind === 'reference') return 'docs-reference';
  if (article.kind === 'troubleshooting') return 'docs-troubleshooting';
  return 'docs-article';
};

const articleHref = (
  article: DocumentationArticle,
  stale: boolean,
): Readonly<{ href: string; routeId: DocumentationRouteId }> | undefined => {
  const routeId = routeIdFor(article, stale);
  const parameters =
    routeId === 'docs-history'
      ? {
          locale: article.identity.locale,
          version: article.identity.version,
          article: article.identity.slug,
        }
      : routeId === 'docs-reference'
        ? {
            locale: article.identity.locale,
            version: article.identity.version,
            reference: article.identity.slug,
          }
        : routeId === 'docs-troubleshooting'
          ? {
              locale: article.identity.locale,
              version: article.identity.version,
              code: article.identity.slug,
            }
          : {
              locale: article.identity.locale,
              version: article.identity.version,
              article: article.identity.slug,
            };
  const path = routeHref(routeId satisfies WebRouteId, parameters);
  if (!path.ok) return undefined;

  return deepFreeze({
    href: `${WEB_ORIGINS['public-origin']}${path.value}`,
    routeId,
  });
};

const suggestedIdentity = (
  catalog: readonly DocumentationArticle[],
  requested: DocumentIdentity,
): Readonly<{
  code:
    'INCOMPATIBLE_CHANNEL' | 'INCOMPATIBLE_LOCALE' | 'INCOMPATIBLE_VERSION' | 'UNKNOWN_DOCUMENT';
  identity?: DocumentIdentity;
}> => {
  const sameArticle = catalog.filter(
    ({ identity }) => identity.slug === requested.slug && identity.section === requested.section,
  );
  const sameLocale = sameArticle.filter(({ identity }) => identity.locale === requested.locale);
  const sameVersion = sameLocale.filter(({ identity }) => identity.version === requested.version);

  const channelFallback = sameVersion.at(0);
  if (channelFallback !== undefined) {
    return {
      code: 'INCOMPATIBLE_CHANNEL',
      identity: cloneIdentity(channelFallback.identity),
    };
  }
  const versionFallback = sameLocale.at(0);
  if (versionFallback !== undefined) {
    const current =
      sameLocale.find(({ identity, supported }) => identity.version === 'current' && supported) ??
      versionFallback;
    return {
      code: 'INCOMPATIBLE_VERSION',
      identity: cloneIdentity(current.identity),
    };
  }
  const localeFallback = sameArticle.at(0);
  if (localeFallback !== undefined) {
    const preferred =
      sameArticle.find(
        ({ identity, supported }) =>
          identity.locale === 'en' && identity.version === 'current' && supported,
      ) ?? localeFallback;
    return {
      code: 'INCOMPATIBLE_LOCALE',
      identity: cloneIdentity(preferred.identity),
    };
  }
  return { code: 'UNKNOWN_DOCUMENT' };
};

export const resolveDocument = (
  catalog: readonly DocumentationArticle[],
  identity: DocumentIdentity,
): DocumentResolution => {
  if (!safeIdentity(identity)) {
    return failure('UNSAFE_IDENTITY', '$.identity');
  }

  const matches = catalog.filter((article) => sameIdentity(article.identity, identity));
  if (matches.length === 0) {
    const suggestion = suggestedIdentity(catalog, identity);
    return failure(suggestion.code, '$.identity', suggestion.identity);
  }
  const article = matches.at(0);
  if (matches.length !== 1 || article === undefined || !validArticle(article)) {
    return failure('INVALID_DOCUMENT', '$.catalog');
  }
  if (!textIsSafe(article)) {
    return failure('UNSAFE_CONTENT', '$.document');
  }

  const stale = article.identity.version !== 'current' || !article.supported;
  const route = articleHref(article, stale);
  if (route === undefined) {
    return failure('ROUTE_INVALID', '$.document.identity');
  }

  const document = orderedDocument(article);
  if (!stale) {
    return success({
      status: 'current',
      document,
      href: route.href,
      routeId: route.routeId,
    });
  }

  if (article.canonicalIdentity === undefined) {
    return failure('CANONICAL_DOCUMENT_MISSING', '$.document.canonicalIdentity');
  }
  const canonicalIdentity = article.canonicalIdentity;
  const canonical = catalog.find(
    (candidate) =>
      sameIdentity(candidate.identity, canonicalIdentity) &&
      candidate.supported &&
      validArticle(candidate) &&
      textIsSafe(candidate),
  );
  if (canonical === undefined) {
    return failure('CANONICAL_DOCUMENT_MISSING', '$.document.canonicalIdentity');
  }
  const canonicalRoute = articleHref(canonical, false);
  if (canonicalRoute === undefined) {
    return failure('ROUTE_INVALID', '$.document.canonicalIdentity');
  }

  return success({
    status: 'stale',
    document,
    href: route.href,
    routeId: 'docs-history',
    notice: {
      persistent: true,
      reason: article.supported ? 'historical' : 'unsupported',
      canonical: {
        identity: cloneIdentity(canonical.identity),
        href: canonicalRoute.href,
      },
    },
  });
};

const normalize = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('en')
    .trim();

const matchesSearchFilters = (
  article: DocumentationArticle,
  filters: DocumentationSearchFilters,
): boolean =>
  article.identity.locale === filters.locale &&
  (filters.version === undefined || article.identity.version === filters.version) &&
  (filters.channel === undefined || article.identity.channel === filters.channel) &&
  (filters.platform === undefined || article.platform.includes(filters.platform)) &&
  (filters.risk === undefined || article.risk === filters.risk) &&
  (filters.domain === undefined || article.domain === filters.domain);

const searchMatch = (
  article: DocumentationArticle,
  query: string,
):
  | Readonly<{
      matchedBy: DocumentationSearchResult['matchedBy'];
      score: number;
    }>
  | undefined => {
  const normalizedQuery = normalize(query);
  if (normalizedQuery.length === 0) return undefined;

  if (article.errorCodes.some((code) => normalize(code) === normalizedQuery)) {
    return { matchedBy: 'error-code', score: 500 };
  }
  if (article.identifiers.some((identifier) => normalize(identifier) === normalizedQuery)) {
    return { matchedBy: 'identifier', score: 400 };
  }

  const title = normalize(article.title);
  if (title.includes(normalizedQuery)) {
    return {
      matchedBy: 'title',
      score: title === normalizedQuery ? 350 : 300,
    };
  }

  const naturalText = normalize(`${article.summary} ${article.title}`);
  if (naturalText.includes(normalizedQuery)) {
    return { matchedBy: 'natural-language', score: 200 };
  }

  const terms = normalizedQuery.split(/\s+/u).filter(Boolean);
  const body = normalize(
    [
      article.summary,
      ...article.sections.flatMap(({ heading, body: sectionBody }) => [heading, sectionBody]),
      ...article.identifiers,
      ...article.errorCodes,
      ...(article.troubleshooting === undefined
        ? []
        : [
            article.troubleshooting.observedState,
            ...article.troubleshooting.evidence,
            ...article.troubleshooting.safeSteps,
            ...article.troubleshooting.recovery,
            article.troubleshooting.escalation,
          ]),
    ].join(' '),
  );
  if (terms.every((term) => body.includes(term))) {
    return { matchedBy: 'body', score: 100 + terms.length };
  }
  return undefined;
};

export const searchDocumentation = (
  catalog: readonly DocumentationArticle[],
  input: Readonly<{
    query: string;
    filters: DocumentationSearchFilters;
  }>,
): DocumentationSearchResponse => {
  const filters = deepFreeze({ ...input.filters });
  const results = catalog
    .filter(
      (article) =>
        validArticle(article) && textIsSafe(article) && matchesSearchFilters(article, filters),
    )
    .map((article): DocumentationSearchResult | undefined => {
      const match = searchMatch(article, input.query);
      if (match === undefined) return undefined;
      const stale = article.identity.version !== 'current' || !article.supported;
      const route = articleHref(article, stale);
      if (route === undefined) return undefined;
      return deepFreeze({
        document: orderedDocument(article),
        href: route.href,
        matchedBy: match.matchedBy,
        score: match.score,
      });
    })
    .filter((result): result is DocumentationSearchResult => result !== undefined)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.document.title.localeCompare(right.document.title) ||
        left.document.identity.slug.localeCompare(right.document.identity.slug),
    );

  return deepFreeze({
    state: results.length === 0 ? 'no-results' : 'results',
    submittedQuery: input.query.trim(),
    filters,
    results,
  });
};

const desktopFailure = (
  code: DesktopDocumentationLinkErrorCode,
  path: string,
  fallbackIdentity?: DocumentIdentity,
): DesktopDocumentationLinkResult =>
  deepFreeze({
    ok: false,
    error: {
      code,
      path,
      ...(fallbackIdentity === undefined ? {} : { fallbackIdentity }),
    },
  });

export const resolveDesktopDocumentationLink = (
  catalog: readonly DocumentationArticle[],
  intent: DesktopDocumentationIntent,
): DesktopDocumentationLinkResult => {
  if (
    !safeIdentity(intent, ['articleSectionId']) ||
    typeof intent.articleSectionId !== 'string' ||
    !SAFE_ID.test(intent.articleSectionId)
  ) {
    return desktopFailure('UNSAFE_IDENTITY', '$.intent');
  }

  const identity: DocumentIdentity = {
    locale: intent.locale,
    version: intent.version,
    channel: intent.channel,
    slug: intent.slug,
    section: intent.section,
  };
  const resolution = resolveDocument(catalog, identity);
  if (!resolution.ok) {
    return desktopFailure(
      resolution.error.code,
      resolution.error.path,
      resolution.error.fallbackIdentity,
    );
  }
  if (resolution.value.status !== 'current') {
    return desktopFailure(
      'INCOMPATIBLE_VERSION',
      '$.intent.version',
      resolution.value.notice.canonical.identity,
    );
  }
  if (!resolution.value.document.sections.some(({ id }) => id === intent.articleSectionId)) {
    return desktopFailure('UNKNOWN_SECTION', '$.intent.articleSectionId');
  }

  return deepFreeze({
    ok: true,
    value: {
      identity: cloneIdentity(resolution.value.document.identity),
      articleSectionId: intent.articleSectionId,
      href: `${resolution.value.href}#${encodeURIComponent(intent.articleSectionId)}`,
      routeId: resolution.value.routeId,
    },
  });
};
