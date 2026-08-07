import type {
  AdminDensityJson,
  AdminFreshnessStateJson,
  AdminJobProjectionJson,
  AdminJobStateJson,
  AdminSavedViewVisibilityJson,
} from '@liiiraa/contracts-ts';

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const QUERY = /^[\p{L}\p{N} ._:/-]*$/u;
const FILTER_VALUE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/u;
const MAX_QUERY_LENGTH = 160;
const MAX_FILTERS = 16;
const MAX_PAGE = 1_000;

const QUEUE_TABS = Object.freeze(['queue', 'search', 'views', 'inbox', 'jobs'] as const);
const SORT_FIELDS = Object.freeze([
  'updated',
  'deadline',
  'severity',
  'owner',
  'state',
  'reference',
] as const);
const FILTER_FIELDS = new Set([
  'assignment',
  'domain',
  'owner',
  'severity',
  'state',
  'status',
  'type',
]);

export type QueueTab = (typeof QUEUE_TABS)[number];
export type QueueSortField = (typeof SORT_FIELDS)[number];
export type QueueSort = Readonly<{
  direction: 'asc' | 'desc';
  field: QueueSortField;
}>;

export type QueueUrlState = Readonly<{
  cursor?: string;
  density: AdminDensityJson;
  filters: readonly string[];
  page: number;
  query: string;
  selectedId?: string;
  sort: QueueSort;
  tab: QueueTab;
  viewId?: string;
}>;

type QueueStateReader = Readonly<{ get: (name: string) => string | null }>;

const isIdentifier = (value: string): boolean => IDENTIFIER.test(value) && !value.includes('@');

const admitIdentifier = (value: string | null): string | undefined => {
  const candidate = value?.trim() ?? '';
  return isIdentifier(candidate) ? candidate : undefined;
};

const admitQuery = (value: string | null): string => {
  const candidate = value?.trim() ?? '';
  return candidate.length <= MAX_QUERY_LENGTH && QUERY.test(candidate) && !candidate.includes('@')
    ? candidate
    : '';
};

const admitFilters = (value: string | null): readonly string[] => {
  if (!value) return Object.freeze([]);
  const admitted: string[] = [];
  for (const candidate of value.split(',')) {
    if (admitted.length >= MAX_FILTERS) break;
    const separator = candidate.indexOf(':');
    if (separator <= 0) continue;
    const field = candidate.slice(0, separator).trim();
    const filterValue = candidate.slice(separator + 1).trim();
    if (!FILTER_FIELDS.has(field) || !FILTER_VALUE.test(filterValue)) continue;
    admitted.push(`${field}:${filterValue}`);
  }
  return Object.freeze([...new Set(admitted)]);
};

const admitPage = (value: string | null): number => {
  if (!/^[1-9]\d{0,3}$/u.test(value ?? '')) return 1;
  const page = Number(value);
  return page <= MAX_PAGE ? page : 1;
};

const admitSort = (value: string | null): QueueSort => {
  const [field = '', direction = ''] = value?.split(':', 2) ?? [];
  if (
    SORT_FIELDS.includes(field as QueueSortField) &&
    (direction === 'asc' || direction === 'desc')
  ) {
    return Object.freeze({ direction, field: field as QueueSortField });
  }
  return Object.freeze({ direction: 'desc', field: 'updated' });
};

const admitTab = (value: string | null): QueueTab =>
  QUEUE_TABS.includes(value as QueueTab) ? (value as QueueTab) : 'queue';

export const parseQueueUrlState = (parameters: QueueStateReader): QueueUrlState => {
  const cursor = admitIdentifier(parameters.get('cursor'));
  const selectedId = admitIdentifier(parameters.get('selected'));
  const viewId = admitIdentifier(parameters.get('view'));
  return Object.freeze({
    ...(cursor === undefined ? {} : { cursor }),
    density: parameters.get('density') === 'compact' ? 'compact' : 'comfortable',
    filters: admitFilters(parameters.get('filter')),
    page: admitPage(parameters.get('page')),
    query: admitQuery(parameters.get('q')),
    ...(selectedId === undefined ? {} : { selectedId }),
    sort: admitSort(parameters.get('sort')),
    tab: admitTab(parameters.get('tab')),
    ...(viewId === undefined ? {} : { viewId }),
  });
};

export const createQueueHref = (pathname: string, state: QueueUrlState): string => {
  const parameters = new URLSearchParams();
  if (state.query) parameters.set('q', state.query);
  if (state.filters.length > 0) parameters.set('filter', state.filters.join(','));
  if (state.sort.field !== 'updated' || state.sort.direction !== 'desc') {
    parameters.set('sort', `${state.sort.field}:${state.sort.direction}`);
  }
  if (state.page !== 1) parameters.set('page', String(state.page));
  if (state.cursor) parameters.set('cursor', state.cursor);
  if (state.tab !== 'queue') parameters.set('tab', state.tab);
  if (state.density !== 'comfortable') parameters.set('density', state.density);
  if (state.viewId) parameters.set('view', state.viewId);
  if (state.selectedId) parameters.set('selected', state.selectedId);
  const query = parameters.toString();
  const cleanPath = pathname.split('?')[0] ?? pathname;
  return query ? `${cleanPath}?${query}` : cleanPath;
};

export type QueueSavedView = Readonly<{
  aggregateVersion: string;
  ownerReference: string | undefined;
  savedViewId: string;
  visibility: AdminSavedViewVisibilityJson;
}>;

export type SavedViewWriteDecision =
  | Readonly<{ allowed: true; expectedVersion: string }>
  | Readonly<{
      allowed: false;
      reason: 'official-read-only' | 'owner-mismatch' | 'version-conflict';
    }>;

export const validateSavedViewWrite = ({
  actorReference,
  expectedVersion,
  view,
}: Readonly<{
  actorReference: string;
  expectedVersion: string;
  view: QueueSavedView;
}>): SavedViewWriteDecision => {
  if (view.visibility === 'official')
    return Object.freeze({ allowed: false, reason: 'official-read-only' });
  if (view.ownerReference !== actorReference)
    return Object.freeze({ allowed: false, reason: 'owner-mismatch' });
  if (view.aggregateVersion !== expectedVersion)
    return Object.freeze({ allowed: false, reason: 'version-conflict' });
  return Object.freeze({ allowed: true, expectedVersion });
};

export type QueueAuthorityState = Readonly<{
  canMutate: boolean;
  requiresRefetch: boolean;
  state: AdminFreshnessStateJson;
}>;

export const deriveQueueAuthorityState = ({
  freshness,
  invalidated,
}: Readonly<{
  freshness: Exclude<AdminFreshnessStateJson, 'stale'>;
  invalidated: boolean;
}>): QueueAuthorityState => {
  const state: AdminFreshnessStateJson = invalidated ? 'stale' : freshness;
  return Object.freeze({
    canMutate: state === 'live',
    requiresRefetch: state !== 'live',
    state,
  });
};

type QueueRecordDraft = Readonly<Record<string, string | number | boolean | null | undefined>>;

const changedFields = (base: QueueRecordDraft, candidate: QueueRecordDraft): readonly string[] =>
  Object.freeze(
    [...new Set([...Object.keys(base), ...Object.keys(candidate)])]
      .filter((field) => base[field] !== candidate[field])
      .sort(),
  );

export type QueueConflictResult<RecordShape extends QueueRecordDraft> =
  | Readonly<{ merged: RecordShape; status: 'merged' }>
  | Readonly<{
      before: RecordShape;
      conflictingFields: readonly string[];
      current: RecordShape;
      draft: RecordShape;
      status: 'review';
    }>;

export const reconcileQueueConflict = <RecordShape extends QueueRecordDraft>({
  base,
  current,
  draft,
}: Readonly<{
  base: RecordShape;
  current: RecordShape;
  draft: RecordShape;
}>): QueueConflictResult<RecordShape> => {
  const currentChanges = changedFields(base, current);
  const draftChanges = changedFields(base, draft);
  const conflicts = currentChanges.filter((field) => draftChanges.includes(field));
  if (conflicts.length > 0) {
    return Object.freeze({
      before: base,
      conflictingFields: Object.freeze(conflicts),
      current,
      draft,
      status: 'review',
    });
  }
  const merged = { ...current } as Record<string, unknown>;
  for (const field of draftChanges) merged[field] = draft[field];
  return Object.freeze({ merged: Object.freeze(merged) as RecordShape, status: 'merged' });
};

export type QueueJobProjection = Readonly<{
  aggregateVersion: string;
  completedItems: number;
  failedItems: number;
  jobId: string;
  ownerReference: string;
  progressPercent?: number;
  receiptReference?: string;
  state: AdminJobStateJson;
  totalItems: number;
}>;

export const projectQueueJob = (job: AdminJobProjectionJson): QueueJobProjection => {
  const truthfulProgress =
    Number.isFinite(job.progressPercent) &&
    job.progressPercent >= 0 &&
    job.progressPercent <= 100 &&
    job.totalItems >= 0 &&
    job.completedItems >= 0 &&
    job.failedItems >= 0 &&
    job.completedItems + job.failedItems <= job.totalItems;
  return Object.freeze({
    aggregateVersion: job.aggregateVersion,
    completedItems: job.completedItems,
    failedItems: job.failedItems,
    jobId: job.jobId,
    ownerReference: job.ownerReference,
    ...(truthfulProgress ? { progressPercent: job.progressPercent } : {}),
    ...(job.receiptReference === undefined ? {} : { receiptReference: job.receiptReference }),
    state: job.state,
    totalItems: job.totalItems,
  });
};
