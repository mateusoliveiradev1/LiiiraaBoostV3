export const ADMIN_QUEUE_SAVED_VIEWS = Object.freeze([
  'assigned',
  'sla-risk',
  'unowned',
  'all-permitted',
] as const);
export const ADMIN_QUEUE_PRIORITIES = Object.freeze(['critical', 'high', 'normal', 'low'] as const);
export const ADMIN_QUEUE_STATUSES = Object.freeze(['attention', 'waiting', 'blocked', 'stable'] as const);
export const ADMIN_QUEUE_OWNERS = Object.freeze(['all', 'mine', 'unassigned'] as const);

export type AdminQueueSavedView = (typeof ADMIN_QUEUE_SAVED_VIEWS)[number];
export type AdminQueuePriority = (typeof ADMIN_QUEUE_PRIORITIES)[number];
export type AdminQueueStatus = (typeof ADMIN_QUEUE_STATUSES)[number];
export type AdminQueueOwnerFilter = (typeof ADMIN_QUEUE_OWNERS)[number];

export type AdminQueueUrlState = Readonly<{
  owner: AdminQueueOwnerFilter;
  priority: AdminQueuePriority | 'all';
  query: string;
  savedView: AdminQueueSavedView;
  selectedId: string | undefined;
  status: AdminQueueStatus | 'all';
}>;

const ADMIN_QUEUE_QUERY_LIMIT = 64;
const ADMIN_QUEUE_ID_PATTERN = /^(?:SUP|OPS|SEC|DIA|AUD)-\d{3,4}$/u;
const ADMIN_QUEUE_QUERY_PATTERN = /^[\p{L}\p{N} ._-]*$/u;

const isMember = <Value extends string>(values: readonly Value[], value: string): value is Value =>
  values.includes(value as Value);

const admitQueueQuery = (value: string | null): string => {
  const query = value?.trim() ?? '';
  return query.length <= ADMIN_QUEUE_QUERY_LIMIT && ADMIN_QUEUE_QUERY_PATTERN.test(query)
    ? query
    : '';
};

type QueueStateReader = Readonly<{ get: (name: string) => string | null }>;

export const parseAdminQueueUrlState = (parameters: QueueStateReader): AdminQueueUrlState => {
  const savedView = parameters.get('view') ?? '';
  const priority = parameters.get('priority') ?? '';
  const status = parameters.get('status') ?? '';
  const owner = parameters.get('owner') ?? '';
  const selectedId = parameters.get('selected') ?? '';

  return Object.freeze({
    owner: isMember(ADMIN_QUEUE_OWNERS, owner) ? owner : 'all',
    priority: isMember(ADMIN_QUEUE_PRIORITIES, priority) ? priority : 'all',
    query: admitQueueQuery(parameters.get('q')),
    savedView: isMember(ADMIN_QUEUE_SAVED_VIEWS, savedView) ? savedView : 'assigned',
    selectedId: ADMIN_QUEUE_ID_PATTERN.test(selectedId) ? selectedId : undefined,
    status: isMember(ADMIN_QUEUE_STATUSES, status) ? status : 'all',
  });
};
