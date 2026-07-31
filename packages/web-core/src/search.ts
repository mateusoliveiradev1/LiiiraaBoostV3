import MiniSearch, { type SearchResult as MiniSearchResult } from 'minisearch';

import { validateWebDocument } from '@liiiraa/contracts-ts/web-validation';

import type {
  AdmittedContentBundle,
  AdmittedContentRecord,
  ContentAvailability,
  ContentRisk,
  ContentType,
} from './content-admission.ts';
import { webRoutes, type WebLocale } from './routes.ts';

const SEARCH_INDEX_SCHEMA_VERSION = 1 as const;
const INDEXED_CONTENT_TYPES = new Set<ContentType>([
  'product',
  'capability',
  'compatibility',
  'plan',
  'documentation',
  'release',
  'support',
]);
const PRIVATE_DOMAIN = /^(?:account|admin|internal|preview|scenario)(?:$|[-:/])/iu;
const TOKEN_PATTERN = /[\p{L}\p{N}]+(?:[._:#-][\p{L}\p{N}]+)*/gu;
const INDEX = Symbol('public-search-index');
const DOCUMENTS = Symbol('public-search-documents');
const SUGGESTIONS = Symbol('public-search-suggestions');

export type SearchDocument = Readonly<{
  searchId: string;
  routeId: string;
  locale: WebLocale;
  version: string;
  domain: string;
  risk: ContentRisk;
  availability: ContentAvailability;
  validationState: 'validated';
  contentType:
    'product' | 'capability' | 'compatibility' | 'plan' | 'documentation' | 'release' | 'support';
  title: string;
  summary: string;
  body: string;
  identifiers: readonly string[];
  errorCodes: readonly string[];
}>;

export type SearchFilters = Readonly<{
  locale: WebLocale;
  version?: string;
  domain?: string;
  risk?: ContentRisk;
  availability?: ContentAvailability;
}>;

export type SearchResult = Readonly<
  SearchDocument & {
    score: number;
  }
>;

type AuthoredSuggestion = Readonly<{
  value: string;
  locale: WebLocale;
  version: string;
  domain: string;
  risk: ContentRisk;
  availability: ContentAvailability;
}>;

export type PublicSearchIndex = Readonly<{
  schemaVersion: typeof SEARCH_INDEX_SCHEMA_VERSION;
  contentId: string;
  documentCount: number;
  serialized: string;
  [INDEX]: MiniSearch<SearchDocument>;
  [DOCUMENTS]: ReadonlyMap<string, SearchDocument>;
  [SUGGESTIONS]: readonly AuthoredSuggestion[];
}>;

export type PublicSearchIndexErrorCode =
  | 'BUNDLE_INVALID'
  | 'NOINDEX_RECORD'
  | 'PRIVATE_RECORD'
  | 'SCENARIO_RECORD'
  | 'SEARCHABLE_ROUTE_DRIFT';

export type PublicSearchIndexError = Readonly<{
  code: PublicSearchIndexErrorCode;
  path: string;
}>;

export type PublicSearchIndexResult =
  | Readonly<{ ok: true; value: PublicSearchIndex }>
  | Readonly<{ ok: false; error: PublicSearchIndexError }>;

export type PublicSearchResponse = Readonly<{
  state: 'results' | 'no-results';
  submittedQuery: string;
  filters: SearchFilters;
  results: readonly SearchResult[];
  suggestions: readonly string[];
}>;

const freeze = <Value>(value: Value): Value => {
  if (
    value !== null &&
    typeof value === 'object' &&
    !(value instanceof MiniSearch) &&
    !(value instanceof Map) &&
    !Object.isFrozen(value)
  ) {
    for (const child of Object.values(value)) {
      freeze(child);
    }
    Object.freeze(value);
  }
  return value;
};

const failure = (code: PublicSearchIndexErrorCode, path: string): PublicSearchIndexResult =>
  freeze({
    ok: false,
    error: { code, path },
  });

const normalizeTerm = (term: string): string =>
  term
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLocaleLowerCase('en-US');

const tokenize = (text: string): string[] => text.match(TOKEN_PATTERN) ?? [];

const processTerm = (term: string): string | string[] | null => {
  const normalized = normalizeTerm(term);
  if (normalized.length === 0) {
    return null;
  }
  const components = normalized.split(/[._:#-]+/u).filter(Boolean);
  return components.length > 1 ? [...new Set([normalized, ...components])] : normalized;
};

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stableValue(child)]),
    );
  }
  return value;
};

const publicRoute = (routeId: string) => webRoutes.find(({ id }) => id === routeId);

const searchIdFor = (record: AdmittedContentRecord): string =>
  [
    record.document.routeId,
    record.document.locale,
    record.document.version,
    record.document.id,
  ].join(':');

const toSearchDocument = (record: AdmittedContentRecord): SearchDocument | undefined => {
  if (!INDEXED_CONTENT_TYPES.has(record.contentType)) {
    return undefined;
  }
  return freeze({
    searchId: searchIdFor(record),
    routeId: record.document.routeId,
    locale: record.document.locale,
    version: record.document.version,
    domain: record.domain,
    risk: record.risk,
    availability: record.availability,
    validationState: 'validated',
    contentType: record.contentType as SearchDocument['contentType'],
    title: record.title,
    summary: record.summary,
    body: record.body,
    identifiers: [...record.identifiers],
    errorCodes: [...record.errorCodes],
  });
};

const expectedSearchableRouteIds = (records: readonly AdmittedContentRecord[]): readonly string[] =>
  [
    ...new Set(
      records
        .filter(
          ({ document, historyState }) =>
            document.indexing === 'index' &&
            document.validationState === 'validated' &&
            historyState === 'current',
        )
        .map(({ document }) => document.routeId),
    ),
  ].sort();

const sameStrings = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const validateBundle = (bundle: AdmittedContentBundle): PublicSearchIndexResult | undefined => {
  const runtimeBundle = bundle as unknown as Readonly<Record<string, unknown>>;
  if (
    runtimeBundle['schemaVersion'] !== 1 ||
    typeof runtimeBundle['buildId'] !== 'string' ||
    !/^build-[a-f0-9]{64}$/u.test(runtimeBundle['buildId']) ||
    typeof runtimeBundle['contentId'] !== 'string' ||
    !/^content-[a-f0-9]{64}$/u.test(runtimeBundle['contentId']) ||
    !Array.isArray(runtimeBundle['records']) ||
    !Array.isArray(runtimeBundle['searchableRouteIds'])
  ) {
    return failure('BUNDLE_INVALID', '$');
  }

  for (const [index, record] of bundle.records.entries()) {
    const path = `$.records[${String(index)}]`;
    const validation = validateWebDocument(record.document);
    if (!validation.ok || !('routeId' in validation.value)) {
      return failure('BUNDLE_INVALID', `${path}.document`);
    }
    const route = publicRoute(record.document.routeId);
    if (route?.surface !== 'public' || route.securityBoundary !== 'public-origin') {
      return failure('PRIVATE_RECORD', `${path}.document.routeId`);
    }
    if (route.scenarioRequirement !== 'available') {
      return failure('SCENARIO_RECORD', `${path}.document.routeId`);
    }
    if (PRIVATE_DOMAIN.test(record.domain) || record.document.owner !== route.owner) {
      return failure('PRIVATE_RECORD', path);
    }
    if (record.document.indexing === 'noindex') {
      if (record.historyState !== 'stale-history' || record.availability !== 'obsolete') {
        return failure('NOINDEX_RECORD', `${path}.document.indexing`);
      }
      continue;
    }
    if (
      route.indexing !== 'index' ||
      record.document.validationState !== 'validated' ||
      record.historyState !== 'current'
    ) {
      return failure('BUNDLE_INVALID', path);
    }
  }

  const expected = expectedSearchableRouteIds(bundle.records);
  if (!sameStrings(bundle.searchableRouteIds, expected)) {
    return failure('SEARCHABLE_ROUTE_DRIFT', '$.searchableRouteIds');
  }
  return undefined;
};

const suggestionFor = (record: AdmittedContentRecord, value: string): AuthoredSuggestion =>
  freeze({
    value,
    locale: record.document.locale,
    version: record.document.version,
    domain: record.domain,
    risk: record.risk,
    availability: record.availability,
  });

export const buildPublicSearchIndex = (bundle: AdmittedContentBundle): PublicSearchIndexResult => {
  const invalid = validateBundle(bundle);
  if (invalid !== undefined) {
    return invalid;
  }

  const documents = bundle.records
    .filter(
      ({ document, historyState }) =>
        document.indexing === 'index' &&
        document.validationState === 'validated' &&
        historyState === 'current',
    )
    .map(toSearchDocument)
    .filter((document): document is SearchDocument => document !== undefined)
    .sort((left, right) => left.searchId.localeCompare(right.searchId));

  const miniSearch = new MiniSearch<SearchDocument>({
    idField: 'searchId',
    fields: ['title', 'summary', 'body', 'identifiers', 'errorCodes'],
    storeFields: [
      'routeId',
      'locale',
      'version',
      'domain',
      'risk',
      'availability',
      'validationState',
    ],
    tokenize,
    processTerm,
    stringifyField: (value) => (Array.isArray(value) ? value.join(' ') : String(value)),
  });
  miniSearch.addAll(documents);

  const documentMap = new Map(documents.map((document) => [document.searchId, document] as const));
  const suggestions = bundle.records
    .filter(
      ({ document, historyState }) =>
        document.indexing === 'index' &&
        document.validationState === 'validated' &&
        historyState === 'current',
    )
    .flatMap((record) => record.suggestions.map((value) => suggestionFor(record, value)))
    .sort(
      (left, right) =>
        left.locale.localeCompare(right.locale) || left.value.localeCompare(right.value),
    );
  const serialized = JSON.stringify(stableValue(miniSearch.toJSON()));

  return freeze({
    ok: true,
    value: {
      schemaVersion: SEARCH_INDEX_SCHEMA_VERSION,
      contentId: bundle.contentId,
      documentCount: documents.length,
      serialized,
      [INDEX]: miniSearch,
      [DOCUMENTS]: documentMap,
      [SUGGESTIONS]: suggestions,
    },
  });
};

const matchesFilters = (
  value: Pick<SearchDocument, 'locale' | 'version' | 'domain' | 'risk' | 'availability'>,
  filters: SearchFilters,
): boolean =>
  value.locale === filters.locale &&
  (filters.version === undefined || value.version === filters.version) &&
  (filters.domain === undefined || value.domain === filters.domain) &&
  (filters.risk === undefined || value.risk === filters.risk) &&
  (filters.availability === undefined || value.availability === filters.availability);

const resultDocument = (
  hit: MiniSearchResult,
  documents: ReadonlyMap<string, SearchDocument>,
): SearchResult | undefined => {
  const document = documents.get(String(hit.id));
  return document === undefined
    ? undefined
    : freeze({
        ...document,
        score: hit.score,
      });
};

const authoredSuggestions = (index: PublicSearchIndex, filters: SearchFilters): readonly string[] =>
  freeze(
    [
      ...new Set(
        index[SUGGESTIONS].filter((suggestion) => matchesFilters(suggestion, filters)).map(
          ({ value }) => value,
        ),
      ),
    ]
      .sort((left, right) => left.localeCompare(right))
      .slice(0, 5),
  );

export const searchPublicContent = (
  index: PublicSearchIndex,
  input: Readonly<{
    query: string;
    filters: SearchFilters;
  }>,
): PublicSearchResponse => {
  const filters = freeze({ ...input.filters });
  const query = input.query.trim();
  const hits =
    query.length === 0
      ? []
      : index[INDEX].search(query, {
          prefix: true,
          fuzzy: (term) => (term.length >= 5 && !/[.:#]/u.test(term) ? 0.2 : false),
          boost: {
            title: 3,
            identifiers: 4,
            errorCodes: 5,
          },
          filter: (result) =>
            matchesFilters(
              {
                locale: String(result['locale']) as WebLocale,
                version: String(result['version']),
                domain: String(result['domain']),
                risk: String(result['risk']) as ContentRisk,
                availability: String(result['availability']) as ContentAvailability,
              },
              filters,
            ),
        });
  const results = hits
    .map((hit) => resultDocument(hit, index[DOCUMENTS]))
    .filter((result): result is SearchResult => result !== undefined)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.title.localeCompare(right.title) ||
        left.searchId.localeCompare(right.searchId),
    );

  return freeze({
    state: results.length === 0 ? 'no-results' : 'results',
    submittedQuery: input.query,
    filters,
    results,
    suggestions: results.length === 0 ? authoredSuggestions(index, filters) : [],
  });
};
