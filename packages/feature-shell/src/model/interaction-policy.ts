import type {
  DesktopRoute,
  DesktopScenarioId,
  PhaseBoundaryExplanation,
  PreviewReceipt,
} from '@liiiraa/desktop-client';

export const FAVORITE_LIMITS = Object.freeze({
  game: 5,
  metric: 4,
  'safe-action': 4,
} as const);

export const HOME_PRIORITY_REGIONS = Object.freeze([
  'next-action',
  'game-runway',
  'system-state',
] as const);

export const ACTIVITY_RETENTION_DAYS = 30 as const;

export const ACTIVITY_STATES = Object.freeze([
  'requires-action',
  'in-progress',
  'completed',
  'history',
] as const);

export const ACTIVITY_FILTERS = Object.freeze([
  'all',
  'plans',
  'games',
  'recovery',
  'account',
  'updates',
] as const);

export const WINDOWS_NOTIFICATION_CATEGORIES = Object.freeze([
  'recovery-required',
  'restart-deadline',
  'game-profile-restore-failed',
  'signed-update-action-required',
  'account-security-event',
] as const);

export type CommandSearchKind =
  | 'route'
  | 'game'
  | 'launcher'
  | 'component'
  | 'operation'
  | 'setting'
  | 'history'
  | 'documentation'
  | 'safe-action';

export type CommandRisk = 'safe' | 'review-required';

export interface CommandSearchEntry {
  readonly id: string;
  readonly kind: CommandSearchKind;
  readonly label: string;
  readonly keywords: readonly string[];
  readonly scope: string;
  readonly consequence: string;
  readonly route: DesktopRoute;
  readonly reviewRoute?: DesktopRoute;
  readonly risk: CommandRisk;
  readonly contextTags: readonly string[];
}

export interface CommandSearchContext {
  readonly contextTags: readonly string[];
}

export interface CommandSearchResult {
  readonly entry: CommandSearchEntry;
  readonly reasons: readonly SearchRankReason[];
}

export type SearchRankReason = 'context' | 'exact' | 'prefix' | 'keyword';

export interface CommandSelection {
  readonly kind: 'navigate';
  readonly route: DesktopRoute;
  readonly reviewRequired: boolean;
  readonly execution: 'none';
}

export type FavoriteKind = keyof typeof FAVORITE_LIMITS;

export interface Favorite {
  readonly id: string;
  readonly kind: FavoriteKind;
  readonly label: string;
}

export type FavoriteAction =
  | Readonly<{ type: 'pin'; favorite: Favorite }>
  | Readonly<{ type: 'remove'; id: string }>
  | Readonly<{
      type: 'move';
      id: string;
      direction: 'left' | 'right';
    }>;

export interface HomeRegions {
  readonly priorities: typeof HOME_PRIORITY_REGIONS;
  readonly favorites: readonly Favorite[];
}

export type ActivityState = (typeof ACTIVITY_STATES)[number];
export type ActivityFilter = (typeof ACTIVITY_FILTERS)[number];
export type ActivityCategory = Exclude<ActivityFilter, 'all'>;
export type ActivitySeverity = 'normal' | 'warning' | 'critical';
export type WindowsNotificationCategory =
  (typeof WINDOWS_NOTIFICATION_CATEGORIES)[number];

export interface ActivityAction {
  readonly label: string;
  readonly route: DesktopRoute;
}

export interface ActivityEvent {
  readonly correlationId: string;
  readonly category: ActivityCategory;
  readonly state: ActivityState;
  readonly severity: ActivitySeverity;
  readonly title: string;
  readonly affectedObject: string;
  readonly occurredAt: string;
  readonly source: string;
  readonly acknowledged: boolean;
  readonly resolved: boolean;
  readonly dismissed: boolean;
  readonly scenarioMarked: boolean;
  readonly nextAction?: ActivityAction;
  readonly notificationCategory?:
    | WindowsNotificationCategory
    | 'ordinary-completion';
  readonly sensitiveDetail?: string;
}

export type ActivityReducerAction =
  | Readonly<{ type: 'append'; event: ActivityEvent }>
  | Readonly<{ type: 'acknowledge'; correlationId: string }>
  | Readonly<{ type: 'resolve'; correlationId: string }>
  | Readonly<{ type: 'dismiss'; correlationId: string }>
  | Readonly<{ type: 'prune'; now: string }>;

export interface ActivityGroup {
  readonly state: ActivityState;
  readonly events: readonly ActivityEvent[];
}

export interface ActivitySelectionOptions {
  readonly includeHistory?: boolean;
}

export interface WindowsNotification {
  readonly productName: 'Liiiraa Boost';
  readonly category: WindowsNotificationCategory;
  readonly issue: string;
  readonly action: ActivityAction;
  readonly correlationId: string;
}

export type FeedbackPlacement =
  | 'same-control'
  | 'cross-route'
  | 'durable';

export type FeedbackChannel = 'inline' | 'toast' | 'activity' | 'windows';

export interface FeedbackSignal {
  readonly placement: FeedbackPlacement;
  readonly event: ActivityEvent;
}

export interface FeedbackPolicy {
  readonly channels: readonly FeedbackChannel[];
  readonly inlineDurationMs: 4000 | null;
  readonly maximumVisibleToasts: 2 | null;
  readonly windowsNotification: WindowsNotification | null;
}

export interface NoChangeReceiptInput {
  readonly scenarioId: string;
  readonly locale: 'pt-BR' | 'en-US';
  readonly correlationId: string;
  readonly createdAt: string;
  readonly requestedOperations: readonly string[];
}

export interface ScenarioPreviewReceipt extends PreviewReceipt {
  readonly requestedOperations: readonly string[];
}

export interface NoChangeReceiptResult {
  readonly receipt: ScenarioPreviewReceipt;
  readonly activity: ActivityEvent;
}

export interface BoundaryExplanationInput {
  readonly capability: string;
  readonly owningPhase: string;
  readonly locale: 'pt-BR' | 'en-US';
  readonly availableScenarioId: string;
}

export interface ActionablePhaseBoundary extends PhaseBoundaryExplanation {
  readonly action: Readonly<{
    kind: 'demonstration';
    label: string;
    scenarioId: DesktopScenarioId;
  }>;
}

const normalizeSearchText = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLocaleLowerCase('en-US');

const deepFreeze = <Value>(value: Value): Readonly<Value> => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
    Object.freeze(value);
  }

  return value;
};

const compareText = (left: string, right: string): number =>
  left.localeCompare(right, 'en-US');

const searchRank = (
  entry: CommandSearchEntry,
  query: string,
  contextTags: ReadonlySet<string>,
): Readonly<{
  reasons: readonly SearchRankReason[];
  score: readonly number[];
}> | null => {
  const label = normalizeSearchText(entry.label);
  const searchable = [
    label,
    normalizeSearchText(entry.scope),
    ...entry.keywords.map(normalizeSearchText),
  ];
  const context = entry.contextTags.some((tag) =>
    contextTags.has(normalizeSearchText(tag)),
  );
  const exact = label === query;
  const prefix = label.startsWith(query);
  const keyword = searchable.some((candidate) => candidate.includes(query));

  if (!keyword) {
    return null;
  }

  const reasons: SearchRankReason[] = [];
  if (context) reasons.push('context');
  if (exact) reasons.push('exact');
  else if (prefix) reasons.push('prefix');
  else reasons.push('keyword');

  return deepFreeze({
    reasons,
    score: [context ? 1 : 0, exact ? 1 : 0, prefix ? 1 : 0],
  });
};

export const searchCommands = (
  index: readonly CommandSearchEntry[],
  rawQuery: string,
  context: CommandSearchContext,
): readonly CommandSearchResult[] => {
  const query = normalizeSearchText(rawQuery);
  if (query.length === 0) {
    return Object.freeze([]);
  }

  const contextTags = new Set(context.contextTags.map(normalizeSearchText));
  const ranked = index.flatMap((entry) => {
    const rank = searchRank(entry, query, contextTags);
    return rank === null ? [] : [{ entry, ...rank }];
  });

  ranked.sort((left, right) => {
    for (let index = 0; index < left.score.length; index += 1) {
      const delta = (right.score[index] ?? 0) - (left.score[index] ?? 0);
      if (delta !== 0) return delta;
    }

    return (
      compareText(left.entry.label, right.entry.label) ||
      compareText(left.entry.id, right.entry.id)
    );
  });

  return deepFreeze(
    ranked.map(({ entry, reasons }) => ({
      entry: deepFreeze({ ...entry, keywords: [...entry.keywords], contextTags: [...entry.contextTags] }),
      reasons: [...reasons],
    })),
  );
};

export const selectCommand = (
  entry: CommandSearchEntry,
): Readonly<CommandSelection> => {
  const reviewRequired = entry.risk === 'review-required';
  if (reviewRequired && entry.reviewRoute === undefined) {
    throw new Error('Review-required command must define a review route.');
  }

  return deepFreeze({
    kind: 'navigate',
    route: reviewRequired ? entry.reviewRoute! : entry.route,
    reviewRequired,
    execution: 'none',
  });
};

export const getCommandNoResultMessage = (
  locale: 'pt-BR' | 'en-US',
  query: string,
): string =>
  locale === 'pt-BR'
    ? `Não encontramos “${query}”. Pesquise por um jogo, componente, configuração ou documento.`
    : `We couldn’t find “${query}”. Search for a game, component, setting, or document.`;

const freezeFavorites = (
  favorites: readonly Favorite[],
): readonly Favorite[] =>
  deepFreeze(favorites.map((favorite) => ({ ...favorite })));

export const reduceFavorites = (
  current: readonly Favorite[],
  action: FavoriteAction,
): readonly Favorite[] => {
  const favorites = current.map((favorite) => ({ ...favorite }));

  if (action.type === 'pin') {
    const duplicate = favorites.some(
      (favorite) => favorite.id === action.favorite.id,
    );
    const kindCount = favorites.filter(
      (favorite) => favorite.kind === action.favorite.kind,
    ).length;
    if (
      duplicate ||
      kindCount >= FAVORITE_LIMITS[action.favorite.kind]
    ) {
      return freezeFavorites(favorites);
    }

    favorites.push({ ...action.favorite });
    return freezeFavorites(favorites);
  }

  const currentIndex = favorites.findIndex(
    (favorite) => favorite.id === action.id,
  );
  if (currentIndex === -1) {
    return freezeFavorites(favorites);
  }

  if (action.type === 'remove') {
    favorites.splice(currentIndex, 1);
    return freezeFavorites(favorites);
  }

  const nextIndex =
    action.direction === 'left' ? currentIndex - 1 : currentIndex + 1;
  if (nextIndex < 0 || nextIndex >= favorites.length) {
    return freezeFavorites(favorites);
  }

  const [favorite] = favorites.splice(currentIndex, 1);
  favorites.splice(nextIndex, 0, favorite!);
  return freezeFavorites(favorites);
};

export const composeHomeRegions = (
  favorites: readonly Favorite[],
): Readonly<HomeRegions> =>
  deepFreeze({
    priorities: [...HOME_PRIORITY_REGIONS],
    favorites: favorites.map((favorite) => ({ ...favorite })),
  }) as Readonly<HomeRegions>;

const freezeActivity = (
  events: readonly ActivityEvent[],
): readonly ActivityEvent[] =>
  deepFreeze(
    events.map((event) => ({
      ...event,
      ...(event.nextAction === undefined
        ? {}
        : { nextAction: { ...event.nextAction } }),
    })),
  );

export const reduceActivity = (
  current: readonly ActivityEvent[],
  action: ActivityReducerAction,
): readonly ActivityEvent[] => {
  if (action.type === 'append') {
    const withoutDuplicate = current.filter(
      ({ correlationId }) => correlationId !== action.event.correlationId,
    );
    return freezeActivity([...withoutDuplicate, action.event]);
  }

  if (action.type === 'prune') {
    const now = Date.parse(action.now);
    if (!Number.isFinite(now)) {
      throw new Error('Activity prune time must be a valid timestamp.');
    }
    const cutoff = now - ACTIVITY_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    return freezeActivity(
      current.filter(({ occurredAt }) => {
        const occurredAtTime = Date.parse(occurredAt);
        return Number.isFinite(occurredAtTime) && occurredAtTime >= cutoff;
      }),
    );
  }

  return freezeActivity(
    current.map((event) => {
      if (event.correlationId !== action.correlationId) {
        return event;
      }

      if (action.type === 'acknowledge') {
        return { ...event, acknowledged: true };
      }
      if (action.type === 'resolve') {
        return { ...event, resolved: true };
      }
      if (
        event.severity === 'critical' &&
        (!event.acknowledged || !event.resolved)
      ) {
        return event;
      }

      return { ...event, state: 'history' as const, dismissed: true };
    }),
  );
};

const ACTIVITY_STATE_ORDER: Readonly<Record<ActivityState, number>> =
  Object.freeze({
    'requires-action': 0,
    'in-progress': 1,
    completed: 2,
    history: 3,
  });

export const selectActivityGroups = (
  events: readonly ActivityEvent[],
  filter: ActivityFilter,
  options: ActivitySelectionOptions = {},
): readonly ActivityGroup[] => {
  const selected = events.filter(
    (event) =>
      (filter === 'all' || event.category === filter) &&
      (options.includeHistory === true
        ? true
        : !event.dismissed && event.state !== 'history'),
  );
  const groups = new Map<ActivityState, ActivityEvent[]>();
  for (const event of selected) {
    const stateEvents = groups.get(event.state) ?? [];
    stateEvents.push(event);
    groups.set(event.state, stateEvents);
  }

  return deepFreeze(
    [...groups.entries()]
      .sort(
        ([left], [right]) =>
          ACTIVITY_STATE_ORDER[left] - ACTIVITY_STATE_ORDER[right],
      )
      .map(([state, stateEvents]) => ({
        state,
        events: stateEvents
          .sort(
            (left, right) =>
              Date.parse(right.occurredAt) - Date.parse(left.occurredAt) ||
              compareText(left.correlationId, right.correlationId),
          )
          .map((event) => ({ ...event })),
      })),
  );
};

const NOTIFICATION_COPY: Readonly<
  Record<
    WindowsNotificationCategory,
    Readonly<{ issue: string; label: string; route: DesktopRoute }>
  >
> = deepFreeze({
  'recovery-required': {
    issue: 'Recovery requires attention.',
    label: 'Review recovery',
    route: '/recover',
  },
  'restart-deadline': {
    issue: 'A selected restart deadline requires attention.',
    label: 'Review restart',
    route: '/restart',
  },
  'game-profile-restore-failed': {
    issue: 'A game profile could not be restored.',
    label: 'Review game activity',
    route: '/activity',
  },
  'signed-update-action-required': {
    issue: 'A signed update requires attention.',
    label: 'Review update',
    route: '/updates',
  },
  'account-security-event': {
    issue: 'An account security event requires attention.',
    label: 'Review account security',
    route: '/activity',
  },
});

const isWindowsNotificationCategory = (
  value: ActivityEvent['notificationCategory'],
): value is WindowsNotificationCategory =>
  WINDOWS_NOTIFICATION_CATEGORIES.some((category) => category === value);

export const createWindowsNotification = (
  event: ActivityEvent,
): Readonly<WindowsNotification> | null => {
  if (!isWindowsNotificationCategory(event.notificationCategory)) {
    return null;
  }

  const copy = NOTIFICATION_COPY[event.notificationCategory];
  return deepFreeze({
    productName: 'Liiiraa Boost',
    category: event.notificationCategory,
    issue: copy.issue,
    action: {
      label: copy.label,
      route: copy.route,
    },
    correlationId: event.correlationId,
  });
};

export const mapFeedbackChannels = (
  signal: FeedbackSignal,
): Readonly<FeedbackPolicy> => {
  const windowsNotification = createWindowsNotification(signal.event);
  const channels: FeedbackChannel[] =
    signal.placement === 'same-control'
      ? ['inline', 'activity']
      : signal.placement === 'cross-route'
        ? ['toast', 'activity']
        : ['activity'];

  if (windowsNotification !== null) {
    channels.push('windows');
  }

  return deepFreeze({
    channels,
    inlineDurationMs: signal.placement === 'same-control' ? 4000 : null,
    maximumVisibleToasts: signal.placement === 'cross-route' ? 2 : null,
    windowsNotification,
  });
};

export const selectDependencyProminence = (
  optionalStepIncomplete: boolean,
  currentDecisionDependsOnStep: boolean,
): 'hidden' | 'quiet' | 'dominant' => {
  if (!optionalStepIncomplete) return 'hidden';
  return currentDecisionDependsOnStep ? 'dominant' : 'quiet';
};

const asScenarioId = (scenarioId: string): DesktopScenarioId => {
  if (!/^S(?:0[1-9]|1[0-9]|2[0-4])$/.test(scenarioId)) {
    throw new Error('Scenario ID must be one of S01 through S24.');
  }

  return scenarioId as DesktopScenarioId;
};

export const createNoChangeReceipt = (
  input: NoChangeReceiptInput,
): Readonly<NoChangeReceiptResult> => {
  if (input.requestedOperations.length === 0) {
    throw new Error('At least one requested operation is required.');
  }
  if (input.requestedOperations.some((operation) => operation.trim() === '')) {
    throw new Error('Every requested operation must be named.');
  }

  const scenarioId = asScenarioId(input.scenarioId);
  const summary =
    input.locale === 'pt-BR'
      ? 'Prévia concluída — nenhuma alteração foi feita neste PC.'
      : 'Preview complete — no changes made to this PC.';
  const requestedOperations = [...input.requestedOperations];

  return deepFreeze({
    receipt: {
      receiptKind: 'scenario-preview',
      scenarioId,
      changed: false,
      summary,
      requestedOperations,
    },
    activity: {
      correlationId: input.correlationId,
      category: 'plans',
      state: 'completed',
      severity: 'normal',
      title:
        input.locale === 'pt-BR'
          ? 'Revise a prévia concluída'
          : 'Review completed preview',
      affectedObject:
        input.locale === 'pt-BR'
          ? 'Operações solicitadas'
          : 'Requested operations',
      occurredAt: input.createdAt,
      source: `scenario:${scenarioId}`,
      acknowledged: true,
      resolved: true,
      dismissed: false,
      scenarioMarked: true,
      nextAction: {
        label: input.locale === 'pt-BR' ? 'Abrir atividade' : 'Open Activity',
        route: '/activity',
      },
    },
  });
};

export const createPhaseBoundaryExplanation = (
  input: BoundaryExplanationInput,
): Readonly<ActionablePhaseBoundary> => {
  const availableScenarioId = asScenarioId(input.availableScenarioId);
  const explanation =
    input.locale === 'pt-BR'
      ? `${input.capability} não está disponível nesta fase. ${input.owningPhase} é responsável pela capacidade real.`
      : `${input.capability} is not available in this phase. ${input.owningPhase} owns the real capability.`;

  return deepFreeze({
    kind: 'phase-boundary',
    capability: input.capability,
    owningPhase: input.owningPhase,
    availableScenarioId,
    explanation,
    action: {
      kind: 'demonstration',
      label:
        input.locale === 'pt-BR'
          ? 'Abrir cenário de demonstração'
          : 'Open demonstration scenario',
      scenarioId: availableScenarioId,
    },
  });
};
