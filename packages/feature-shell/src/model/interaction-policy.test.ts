import { describe, expect, it } from 'vitest';

import {
  ACTIVITY_RETENTION_DAYS,
  FAVORITE_LIMITS,
  composeHomeRegions,
  createNoChangeReceipt,
  createPhaseBoundaryExplanation,
  createWindowsNotification,
  getCommandNoResultMessage,
  reduceActivity,
  reduceFavorites,
  searchCommands,
  selectActivityGroups,
  selectCommand,
  selectDependencyProminence,
  mapFeedbackChannels,
  type ActivityEvent,
  type CommandSearchEntry,
  type Favorite,
} from './interaction-policy.js';

const commandIndex = Object.freeze([
  {
    id: 'route-games',
    kind: 'route',
    label: 'Games',
    keywords: ['library'],
    scope: 'Game library',
    consequence: 'Opens the game library.',
    route: '/games',
    risk: 'safe',
    contextTags: ['home'],
  },
  {
    id: 'game-anchor',
    kind: 'game',
    label: 'Games',
    keywords: ['anchor arena'],
    scope: 'Anchor Arena',
    consequence: 'Opens the selected game.',
    route: '/games/detail',
    risk: 'safe',
    contextTags: ['games'],
  },
  {
    id: 'operation-power',
    kind: 'operation',
    label: 'Power plan',
    keywords: ['performance'],
    scope: 'System power',
    consequence: 'Requires a full plan review before preview.',
    route: '/improve/component',
    reviewRoute: '/plans/review',
    risk: 'review-required',
    contextTags: ['improve'],
  },
] as const satisfies readonly CommandSearchEntry[]);

const activity = (
  overrides: Partial<ActivityEvent> & Pick<ActivityEvent, 'correlationId'>,
): ActivityEvent => {
  const { correlationId, ...rest } = overrides;

  return {
    category: 'plans',
    state: 'completed',
    severity: 'normal',
    title: 'Reviewed plan',
    affectedObject: 'Competitive profile',
    occurredAt: '2026-07-28T12:00:00.000Z',
    source: 'desktop-preview',
    acknowledged: true,
    resolved: true,
    dismissed: false,
    scenarioMarked: true,
    ...rest,
    correlationId,
  };
};

describe('UX-05 command policy', () => {
  it('ranks contextual results before exact matches and keeps deterministic ties', () => {
    expect(
      searchCommands(commandIndex, 'games', { contextTags: ['games'] }).map(
        ({ entry, reasons }) => [entry.id, reasons],
      ),
    ).toEqual([
      ['game-anchor', ['context', 'exact']],
      ['route-games', ['exact']],
    ]);
  });

  it('routes risky results to review and never assigns command execution', () => {
    const result = searchCommands(commandIndex, 'power', {
      contextTags: ['improve'],
    })[0];

    if (result === undefined) {
      throw new Error('Expected the power-plan result.');
    }
    expect(result.entry.id).toBe('operation-power');
    expect(selectCommand(result.entry)).toEqual({
      kind: 'navigate',
      route: '/plans/review',
      reviewRequired: true,
      execution: 'none',
    });
  });

  it('provides the locked localized no-result guidance', () => {
    expect(getCommandNoResultMessage('pt-BR', 'latência')).toBe(
      'Não encontramos “latência”. Pesquise por um jogo, componente, configuração ou documento.',
    );
    expect(getCommandNoResultMessage('en-US', 'latency')).toBe(
      'We couldn’t find “latency”. Search for a game, component, setting, or document.',
    );
  });
});

describe('UX-06 favorite policy', () => {
  const favorites = Object.freeze([
    { id: 'game-1', kind: 'game', label: 'Game 1' },
    { id: 'metric-1', kind: 'metric', label: 'Frame time' },
    { id: 'action-1', kind: 'safe-action', label: 'Open diagnostics' },
  ] as const satisfies readonly Favorite[]);

  it('enforces five games, four metrics, and four safe actions', () => {
    expect(FAVORITE_LIMITS).toEqual({
      game: 5,
      metric: 4,
      'safe-action': 4,
    });

    const fiveGames = Array.from({ length: 5 }, (_, index) => ({
      id: `game-${String(index)}`,
      kind: 'game' as const,
      label: `Game ${String(index)}`,
    }));
    const unchanged = reduceFavorites(fiveGames, {
      type: 'pin',
      favorite: { id: 'game-over-limit', kind: 'game', label: 'Extra game' },
    });

    expect(unchanged).toEqual(fiveGames);
    expect(Object.isFrozen(unchanged)).toBe(true);
  });

  it('supports keyboard moves without changing fixed Home priorities', () => {
    const moved = reduceFavorites(favorites, {
      type: 'move',
      id: 'metric-1',
      direction: 'left',
    });

    expect(moved.map(({ id }) => id)).toEqual(['metric-1', 'game-1', 'action-1']);
    expect(composeHomeRegions(moved)).toMatchObject({
      priorities: ['next-action', 'game-runway', 'system-state'],
      favorites: moved,
    });
  });
});

describe('UX-08 Activity policy', () => {
  it('orders groups by urgency, filters categories, and preserves deterministic ties', () => {
    const events = [
      activity({
        correlationId: 'completed-b',
        category: 'games',
        state: 'completed',
      }),
      activity({
        correlationId: 'action-b',
        category: 'recovery',
        state: 'requires-action',
        severity: 'critical',
        acknowledged: false,
        resolved: false,
      }),
      activity({
        correlationId: 'action-a',
        category: 'plans',
        state: 'requires-action',
        severity: 'warning',
        acknowledged: false,
        resolved: false,
      }),
    ];

    expect(
      selectActivityGroups(events, 'all').map(({ state, events: items }) => [
        state,
        items.map(({ correlationId }) => correlationId),
      ]),
    ).toEqual([
      ['requires-action', ['action-a', 'action-b']],
      ['completed', ['completed-b']],
    ]);
    expect(
      selectActivityGroups(events, 'recovery')[0]?.events.map(({ correlationId }) => correlationId),
    ).toEqual(['action-b']);
  });

  it('does not dismiss a critical event until it is acknowledged and resolved', () => {
    const critical = activity({
      correlationId: 'critical-recovery',
      state: 'requires-action',
      severity: 'critical',
      acknowledged: false,
      resolved: false,
      dismissed: false,
    });

    const refused = reduceActivity([critical], {
      type: 'dismiss',
      correlationId: critical.correlationId,
    });
    const acknowledged = reduceActivity(refused, {
      type: 'acknowledge',
      correlationId: critical.correlationId,
    });
    const resolved = reduceActivity(acknowledged, {
      type: 'resolve',
      correlationId: critical.correlationId,
    });
    const dismissed = reduceActivity(resolved, {
      type: 'dismiss',
      correlationId: critical.correlationId,
    });

    expect(refused[0]?.dismissed).toBe(false);
    expect(acknowledged[0]?.acknowledged).toBe(true);
    expect(dismissed[0]).toMatchObject({
      state: 'history',
      dismissed: true,
      acknowledged: true,
      resolved: true,
    });
  });

  it('retains scenario completion for thirty days and keeps dismissed audit history', () => {
    expect(ACTIVITY_RETENTION_DAYS).toBe(30);
    const old = activity({
      correlationId: 'old',
      occurredAt: '2026-06-01T00:00:00.000Z',
    });
    const recent = activity({
      correlationId: 'recent',
      occurredAt: '2026-07-15T00:00:00.000Z',
    });

    const retained = reduceActivity([old, recent], {
      type: 'prune',
      now: '2026-07-28T00:00:00.000Z',
    });
    const history = reduceActivity(retained, {
      type: 'dismiss',
      correlationId: 'recent',
    });

    expect(retained.map(({ correlationId }) => correlationId)).toEqual(['recent']);
    expect(selectActivityGroups(history, 'all')).toEqual([]);
    expect(selectActivityGroups(history, 'all', { includeHistory: true })[0]).toMatchObject({
      state: 'history',
      events: [{ correlationId: 'recent' }],
    });
  });
});

describe('UX-09 feedback, receipt, and boundary policies', () => {
  it('maps inline, cross-route, durable, and native feedback channels', () => {
    const inline = mapFeedbackChannels({
      placement: 'same-control',
      event: activity({ correlationId: 'inline' }),
    });
    const toast = mapFeedbackChannels({
      placement: 'cross-route',
      event: activity({ correlationId: 'toast' }),
    });
    const native = mapFeedbackChannels({
      placement: 'durable',
      event: activity({
        correlationId: 'native',
        notificationCategory: 'restart-deadline',
      }),
    });

    expect(inline).toMatchObject({
      channels: ['inline', 'activity'],
      inlineDurationMs: 4000,
      maximumVisibleToasts: null,
    });
    expect(toast).toMatchObject({
      channels: ['toast', 'activity'],
      inlineDurationMs: null,
      maximumVisibleToasts: 2,
    });
    expect(native).toMatchObject({
      channels: ['activity', 'windows'],
      windowsNotification: {
        category: 'restart-deadline',
        correlationId: 'native',
      },
    });
  });

  it('maps only approved actionable categories to redacted Windows notifications', () => {
    const approved = createWindowsNotification(
      activity({
        correlationId: 'recovery-required',
        category: 'recovery',
        notificationCategory: 'recovery-required',
        severity: 'critical',
        state: 'requires-action',
        acknowledged: false,
        resolved: false,
        sensitiveDetail: 'GPU serial 1234 and CPU model',
      }),
    );
    const rejected = createWindowsNotification(
      activity({
        correlationId: 'ordinary-plan',
        notificationCategory: 'ordinary-completion',
      }),
    );

    expect(approved).toEqual({
      productName: 'Liiiraa Boost',
      category: 'recovery-required',
      issue: 'Recovery requires attention.',
      action: {
        label: 'Review recovery',
        route: '/recover',
      },
      correlationId: 'recovery-required',
    });
    expect(JSON.stringify(approved)).not.toContain('GPU');
    expect(rejected).toBeNull();
  });

  it('implements D-08 by increasing optional-step prominence only when required', () => {
    expect(selectDependencyProminence(true, false)).toBe('quiet');
    expect(selectDependencyProminence(true, true)).toBe('dominant');
    expect(selectDependencyProminence(false, true)).toBe('hidden');
  });

  it('implements D-15 with mandatory requested operations and scenario Activity', () => {
    const result = createNoChangeReceipt({
      scenarioId: 'S18',
      locale: 'pt-BR',
      correlationId: 'receipt-S18',
      createdAt: '2026-07-28T12:00:00.000Z',
      requestedOperations: ['Solicitar alteração da proteção'],
    });

    expect(result.receipt).toMatchObject({
      receiptKind: 'scenario-preview',
      scenarioId: 'S18',
      changed: false,
      summary: 'Prévia concluída — nenhuma alteração foi feita neste PC.',
      requestedOperations: ['Solicitar alteração da proteção'],
    });
    expect(result.activity).toMatchObject({
      correlationId: 'receipt-S18',
      state: 'completed',
      scenarioMarked: true,
    });
    expect(() =>
      createNoChangeReceipt({
        scenarioId: 'S18',
        locale: 'en-US',
        correlationId: 'invalid-receipt',
        createdAt: '2026-07-28T12:00:00.000Z',
        requestedOperations: [],
      }),
    ).toThrow('requested operation');
  });

  it('implements D-16 with capability, owning phase, and an actionable demo', () => {
    expect(
      createPhaseBoundaryExplanation({
        capability: 'Apply a privileged protection change',
        owningPhase: 'Phase 8',
        locale: 'en-US',
        availableScenarioId: 'S18',
      }),
    ).toEqual({
      kind: 'phase-boundary',
      capability: 'Apply a privileged protection change',
      owningPhase: 'Phase 8',
      availableScenarioId: 'S18',
      explanation:
        'Apply a privileged protection change is not available in this phase. Phase 8 owns the real capability.',
      action: {
        kind: 'demonstration',
        label: 'Open demonstration scenario',
        scenarioId: 'S18',
      },
    });
  });
});
