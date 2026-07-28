/// <reference lib="dom" />

import type { ReactNode } from 'react';
// @ts-expect-error The approved runtime includes react-dom, but @types/react-dom is not an approved identity.
import { renderToStaticMarkup as reactRenderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  createNoChangeReceipt,
  createPhaseBoundaryExplanation,
  mapFeedbackChannels,
  reduceActivity,
  reduceFavorites,
  searchCommands,
  selectCommand,
  type ActivityEvent,
  type CommandSearchEntry,
  type Favorite,
  ACTIVITY_FILTERS,
  FAVORITE_LIMITS,
  type FeedbackSignal,
} from '../model/interaction-policy.js';
import type { HomeCalibrationState } from '../model/calibration.js';
import { ActivitySurface, FeedbackSurface } from './activity.js';
import {
  CALIBRATION_SURFACE_STATES,
  CalibrationWorkspace,
  type ShellLocale,
} from './calibration.js';
import { GlobalCommandCenter } from './command-center.js';
import { FavoritesManager, type FavoriteCandidate } from './favorites.js';
import {
  HOME_VARIANTS,
  ContextualHome,
  type HomeClaim,
  type SelectedGame,
} from './home.js';

const renderToStaticMarkup = reactRenderToStaticMarkup as (node: ReactNode) => string;

const semanticAudit = (markup: string): readonly string[] => {
  const findings: string[] = [];
  const ids = [...markup.matchAll(/\sid="([^"]+)"/gu)].map((match) => match[1]);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicateIds.length > 0) findings.push(`duplicate ids: ${duplicateIds.join(', ')}`);

  for (const match of markup.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/gu)) {
    const attributes = match[1] ?? '';
    const text = (match[2] ?? '').replace(/<[^>]+>/gu, '').trim();
    if (!attributes.includes('aria-label=') && text.length === 0) {
      findings.push('button has no accessible name');
    }
  }

  for (const match of markup.matchAll(/aria-(?:controls|labelledby)="([^"]+)"/gu)) {
    const references = (match[1] ?? '').split(/\s+/u);
    for (const reference of references) {
      if (reference.length > 0 && !ids.includes(reference)) {
        findings.push(`ARIA relationship points to missing id: ${reference}`);
      }
    }
  }

  if (markup.includes('role="dialog"') && !markup.includes('aria-labelledby=')) {
    findings.push('dialog has no accessible name');
  }
  if (markup.includes('tabindex="1"')) findings.push('positive tabindex is forbidden');
  if (markup.includes('undefined') || markup.includes('null</')) {
    findings.push('unresolved copy reached accessible output');
  }

  return findings;
};

const readyCalibration: HomeCalibrationState = {
  access: 'ready',
  requiredComplete: true,
  optionalProgress: { completed: 5, total: 5 },
  trustedSteps: [
    'trustPrivacy',
    'systemInventory',
    'performanceDiagnosis',
    'recoveryReadiness',
    'goals',
    'priorityGames',
    'review',
  ],
  incompleteSteps: [],
  recommendationsAllowed: true,
  continueAction: {
    prominence: 'hidden',
    messageId: 'calibration.action.continue',
    step: null,
  },
};

const incompleteCalibration: HomeCalibrationState = {
  ...readyCalibration,
  access: 'progressive',
  optionalProgress: { completed: 2, total: 5 },
  trustedSteps: ['trustPrivacy', 'systemInventory', 'goals', 'priorityGames'],
  incompleteSteps: ['performanceDiagnosis', 'recoveryReadiness', 'review'],
  continueAction: {
    prominence: 'dominant',
    messageId: 'calibration.action.continue',
    step: 'performanceDiagnosis',
  },
};

const blockedCalibration: HomeCalibrationState = {
  ...incompleteCalibration,
  access: 'blocked',
  requiredComplete: false,
  trustedSteps: ['trustPrivacy'],
  incompleteSteps: [
    'systemInventory',
    'performanceDiagnosis',
    'recoveryReadiness',
    'goals',
    'priorityGames',
    'review',
  ],
  recommendationsAllowed: false,
  continueAction: {
    prominence: 'dominant',
    messageId: 'calibration.action.continue',
    step: 'systemInventory',
  },
};

const limitedCalibration: HomeCalibrationState = {
  ...blockedCalibration,
  access: 'limited',
};

const claims: readonly HomeClaim[] = [
  {
    capturedAt: '2030-01-15T18:00:00.000Z',
    detail: 'Fixture inventory is internally consistent.',
    freshness: 'current',
    id: 'inventory',
    label: 'System inventory',
    source: 'scenario:S01',
    state: 'fixture',
  },
  {
    capturedAt: '2030-01-14T18:00:00.000Z',
    detail: 'GPU driver source is stale.',
    freshness: 'stale',
    id: 'driver',
    label: 'GPU driver',
    source: 'scenario:S06',
    state: 'stale-evidence',
  },
  {
    capturedAt: '2030-01-15T18:00:00.000Z',
    detail: 'Restore source is unavailable.',
    freshness: 'unknown',
    id: 'restore',
    label: 'Restore readiness',
    source: 'scenario:S17',
    state: 'unsupported',
  },
];

const selectedGame: SelectedGame = {
  capturedAt: '2030-01-15T18:00:00.000Z',
  freshness: 'current',
  lastReliableResult: 'Last scenario check: ready',
  launchRoute: 'Review launch route',
  name: 'Northstar Arena',
  profileState: 'Verified fixture profile',
  readiness: ['Launcher found', 'Recovery preview ready'],
  source: 'scenario:S01',
};

const commandEntries: readonly CommandSearchEntry[] = [
  {
    id: 'game-northstar',
    kind: 'game',
    label: 'Northstar Arena',
    keywords: ['competitive', 'shooter'],
    scope: 'Selected scenario game',
    consequence: 'Opens the game runway without launching anything.',
    route: '/games/detail',
    risk: 'safe',
    contextTags: ['home', 'selected-game'],
  },
  {
    id: 'operation-power',
    kind: 'operation',
    label: 'Review power profile',
    keywords: ['power', 'plan'],
    scope: 'Scenario power component',
    consequence: 'Opens complete review; no operation executes here.',
    route: '/improve/component',
    reviewRoute: '/plans/review',
    risk: 'review-required',
    contextTags: ['home'],
  },
  {
    id: 'docs-boundary',
    kind: 'documentation',
    label: 'Cloud optimization',
    keywords: ['cloud'],
    scope: 'Future connected capability',
    consequence: 'Explains the phase boundary and opens a demonstration.',
    route: '/ai',
    risk: 'safe',
    contextTags: ['assistant'],
  },
];

const favoriteCandidates: readonly FavoriteCandidate[] = [
  { id: 'game-1', kind: 'game', label: 'Northstar Arena', eligibility: 'safe' },
  { id: 'metric-1', kind: 'metric', label: 'Frame time', eligibility: 'safe' },
  { id: 'safe-1', kind: 'safe-action', label: 'Open Activity', eligibility: 'safe' },
  {
    id: 'restricted-1',
    kind: 'safe-action',
    label: 'Apply extreme profile',
    eligibility: 'restricted',
    restrictionReason: 'Privileged actions require full review.',
  },
];

const activityEvents: readonly ActivityEvent[] = [
  {
    correlationId: 'S16-restart-0001',
    category: 'plans',
    state: 'requires-action',
    severity: 'warning',
    title: 'Review restart schedule',
    affectedObject: 'Scenario plan',
    occurredAt: '2030-01-15T18:00:00.000Z',
    source: 'scenario:S16',
    acknowledged: false,
    resolved: false,
    dismissed: false,
    scenarioMarked: true,
    nextAction: { label: 'Review restart', route: '/restart' },
    notificationCategory: 'restart-deadline',
  },
  {
    correlationId: 'S17-recovery-0001',
    category: 'recovery',
    state: 'requires-action',
    severity: 'critical',
    title: 'Review interrupted preview recovery',
    affectedObject: 'Recovery checkpoint',
    occurredAt: '2030-01-15T18:01:00.000Z',
    source: 'scenario:S17',
    acknowledged: false,
    resolved: false,
    dismissed: false,
    scenarioMarked: true,
    notificationCategory: 'recovery-required',
    sensitiveDetail: 'GPU serial must never enter a notification.',
  },
  {
    correlationId: 'S01-complete-0001',
    category: 'games',
    state: 'completed',
    severity: 'normal',
    title: 'Scenario runway reviewed',
    affectedObject: 'Northstar Arena',
    occurredAt: '2030-01-15T17:59:00.000Z',
    source: 'scenario:S01',
    acknowledged: true,
    resolved: true,
    dismissed: false,
    scenarioMarked: true,
    notificationCategory: 'ordinary-completion',
  },
];

describe('UX-02 UX-03 shell states and accessibility', () => {
  it('renders every calibration operational state with a reason, safe action, fixture marker, and status pattern', () => {
    for (const locale of ['pt-BR', 'en'] as const satisfies readonly ShellLocale[]) {
      for (const state of CALIBRATION_SURFACE_STATES) {
        const markup = renderToStaticMarkup(
          <CalibrationWorkspace
            elapsed="00:42"
            locale={locale}
            scenarioId={state === 'permission-denied' ? 'S14' : 'S22'}
            surfaceState={state}
          />,
        );

        expect(markup).toContain(`data-calibration-state="${state}"`);
        expect(markup).toContain('DEMO ·');
        expect(markup).toContain('data-testid="status-signal"');
        expect(markup).toContain('data-pattern=');
        expect(markup).toContain('aria-live="polite"');
        expect(markup).not.toContain('undefined');
        expect(semanticAudit(markup)).toEqual([]);
      }
    }
  });

  it('renders all S01/S03/S05/S06/S12/S13/S16/S17 Home variants in the fixed three-region order', () => {
    for (const variant of HOME_VARIANTS) {
      const calibration =
        variant === 'calibration-incomplete'
          ? blockedCalibration
          : variant === 'unsupported-windows' || variant === 'critical-security'
            ? limitedCalibration
            : variant === 'evidence-stale'
              ? incompleteCalibration
              : readyCalibration;
      const markup = renderToStaticMarkup(
        <ContextualHome
          calibration={calibration}
          claims={claims}
          limitationReason="The required scenario inventory is unavailable."
          locale="en"
          nextAction={{
            consequence: 'No change occurs before review.',
            cta: 'Review recommended plan',
            evidence: 'Fixture evidence is current.',
            reason: 'One safe opportunity is available.',
            title: 'Review a safe scenario plan',
          }}
          scenarioId="S01"
          selectedGame={selectedGame}
          variant={variant}
        />,
      );

      const first = markup.indexOf('data-home-region-order="1"');
      const second = markup.indexOf('data-home-region-order="2"');
      const third = markup.indexOf('data-home-region-order="3"');
      expect(first).toBeGreaterThan(-1);
      expect(second).toBeGreaterThan(first);
      expect(third).toBeGreaterThan(second);
      expect(markup).toContain('scenario:S01');
      expect(markup).not.toContain('health score');
      expect(markup).not.toContain('undefined');
      expect(semanticAudit(markup)).toEqual([]);
    }
  });

  it('suppresses recommendations and exposes only Retry in limited Home', () => {
    const markup = renderToStaticMarkup(
      <ContextualHome
        calibration={limitedCalibration}
        claims={claims}
        limitationReason="System inventory permission was denied."
        locale="en"
        nextAction={{
          consequence: 'This content must not render.',
          cta: 'Forbidden recommendation',
          evidence: 'No trusted evidence.',
          reason: 'No valid reason.',
          title: 'Forbidden recommendation',
        }}
        scenarioId="S14"
        variant="critical-security"
      />,
    );

    expect(markup).toContain('Safe limited mode');
    expect(markup).toContain('Retry');
    expect(markup).not.toContain('Forbidden recommendation');
  });
});

describe('UX-05 UX-06 UX-08 UX-09 keyboard and policy interactions', () => {
  it('groups command results, preserves listbox semantics, and routes risk through review', () => {
    const boundary = createPhaseBoundaryExplanation({
      capability: 'Cloud optimization',
      owningPhase: 'Phase 8',
      locale: 'en-US',
      availableScenarioId: 'S19',
    });
    const markup = renderToStaticMarkup(
      <GlobalCommandCenter
        boundaries={{ 'docs-boundary': boundary }}
        context={{ contextTags: ['home'] }}
        entries={commandEntries}
        initialQuery="power"
        initiallyOpen
        locale="en"
        onNavigate={() => undefined}
        onOpenScenario={() => undefined}
        scenarioId="S01"
      />,
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('role="combobox"');
    expect(markup).toContain('role="listbox"');
    expect(markup).toContain('Review power profile');
    expect(markup).toContain('Opens safe review');
    expect(markup).toContain('aria-keyshortcuts="Control+K"');
    expect(semanticAudit(markup)).toEqual([]);

    const results = searchCommands(commandEntries, 'power', { contextTags: ['home'] });
    expect(results[0]?.entry.id).toBe('operation-power');
    const firstResult = results[0];
    if (!firstResult) throw new Error('Expected a command result for the power query.');
    expect(selectCommand(firstResult.entry)).toEqual({
      kind: 'navigate',
      route: '/plans/review',
      reviewRequired: true,
      execution: 'none',
    });
  });

  it('renders exact no-result copy and keeps trigger available for focus return', () => {
    const markup = renderToStaticMarkup(
      <GlobalCommandCenter
        context={{ contextTags: ['home'] }}
        entries={commandEntries}
        initialQuery="zzzz"
        initiallyOpen
        locale="pt-BR"
        onNavigate={() => undefined}
        onOpenScenario={() => undefined}
        scenarioId="S03"
      />,
    );
    expect(markup).toContain('Não encontramos “zzzz”');
    expect(markup).toContain('aria-haspopup="dialog"');
    expect(markup).toContain('Fechar');
  });

  it('enforces favorite limits, keyboard reorder/removal, and restricted-item exclusion', () => {
    let favorites: readonly Favorite[] = [];
    for (let index = 0; index < FAVORITE_LIMITS.game + 1; index += 1) {
      favorites = reduceFavorites(favorites, {
        type: 'pin',
        favorite: { id: `game-${String(index)}`, kind: 'game', label: `Game ${String(index)}` },
      });
    }
    expect(favorites).toHaveLength(FAVORITE_LIMITS.game);

    favorites = reduceFavorites(favorites, {
      type: 'move',
      id: 'game-0',
      direction: 'right',
    });
    expect(favorites[1]?.id).toBe('game-0');
    favorites = reduceFavorites(favorites, { type: 'remove', id: 'game-0' });
    expect(favorites.some((favorite) => favorite.id === 'game-0')).toBe(false);

    const markup = renderToStaticMarkup(
      <FavoritesManager
        candidates={favoriteCandidates}
        initialFavorites={favoriteCandidates.slice(0, 3)}
        locale="en"
      />,
    );
    expect(markup).toContain('Locked Home priorities');
    expect(markup).toContain('Move left');
    expect(markup).toContain('Move right');
    expect(markup).toContain('Remove');
    expect(markup).toContain('Privileged actions require full review.');
    expect(semanticAudit(markup)).toEqual([]);
  });

  it('keeps critical Activity durable until acknowledged and resolved', () => {
    const criticalId = 'S17-recovery-0001';
    let events = reduceActivity(activityEvents, { type: 'dismiss', correlationId: criticalId });
    expect(events.find((event) => event.correlationId === criticalId)?.dismissed).toBe(false);
    events = reduceActivity(events, { type: 'acknowledge', correlationId: criticalId });
    events = reduceActivity(events, { type: 'resolve', correlationId: criticalId });
    events = reduceActivity(events, { type: 'dismiss', correlationId: criticalId });
    expect(events.find((event) => event.correlationId === criticalId)?.dismissed).toBe(true);
  });

  it('renders all Activity groups, filters, correlation IDs, durable receipts, and no-change truth', () => {
    const noChange = createNoChangeReceipt({
      scenarioId: 'S01',
      locale: 'en-US',
      correlationId: 'S01-receipt-0001',
      createdAt: '2030-01-15T18:02:00.000Z',
      requestedOperations: ['Review balanced power profile'],
    });
    const markup = renderToStaticMarkup(
      <ActivitySurface
        events={[...activityEvents, noChange.activity]}
        locale="en"
        receipts={[noChange.receipt]}
        scenarioId="S17"
      />,
    );

    for (const filter of ACTIVITY_FILTERS) {
      expect(markup).toContain(`value="${filter}"`);
    }
    expect(markup).toContain('Requires action');
    expect(markup).toContain('Completed');
    expect(markup).toContain('S17-recovery-0001');
    expect(markup).toContain('No change was made to this PC.');
    expect(markup).toContain('Review balanced power profile');
    expect(semanticAudit(markup)).toEqual([]);
  });

  it('keeps feedback policy-controlled, redacted, durable, and bounded to two toasts', () => {
    const criticalEvent = activityEvents.find(
      (event) => event.correlationId === 'S17-recovery-0001',
    );
    if (!criticalEvent) throw new Error('Expected the S17 recovery fixture event.');
    const signal: FeedbackSignal = {
      placement: 'cross-route',
      event: criticalEvent,
    };
    const policy = mapFeedbackChannels(signal);
    expect(policy.channels).toEqual(['toast', 'activity', 'windows']);
    expect(policy.maximumVisibleToasts).toBe(2);
    expect(policy.windowsNotification?.issue).not.toContain('GPU serial');

    const markup = renderToStaticMarkup(<FeedbackSurface locale="en" signal={signal} />);
    expect(markup).toContain('data-maximum-visible="2"');
    expect(markup).toContain('This event remains available in Activity.');
    expect(markup).toContain('Liiiraa Boost');
    expect(markup).not.toContain('GPU serial');
    expect(semanticAudit(markup)).toEqual([]);
  });
});

describe('shell states accessibility axes', () => {
  it('preserves semantics under PT-BR/English, scale, reduced motion, and forced colors', () => {
    for (const locale of ['pt-BR', 'en'] as const satisfies readonly ShellLocale[]) {
      const markup = renderToStaticMarkup(
        <div
          data-density="compact"
          data-forced-colors="active"
          data-motion="reduced"
          data-scale="150"
        >
          <ContextualHome
            calibration={incompleteCalibration}
            claims={claims}
            locale={locale}
            scenarioId="S24"
            selectedGame={selectedGame}
            variant="evidence-stale"
          />
        </div>,
      );
      expect(markup).toContain('data-scale="150"');
      expect(markup).toContain('data-motion="reduced"');
      expect(markup).toContain('data-forced-colors="active"');
      expect(markup).toContain('data-pattern=');
      expect(semanticAudit(markup)).toEqual([]);
    }
  });

  it('provides polite screen-reader announcements, named regions, and F6-compatible landmarks', () => {
    const calibrationMarkup = renderToStaticMarkup(
      <CalibrationWorkspace locale="en" scenarioId="S22" surfaceState="slow" />,
    );
    const homeMarkup = renderToStaticMarkup(
      <ContextualHome
        calibration={incompleteCalibration}
        claims={claims}
        locale="en"
        scenarioId="S06"
        variant="evidence-stale"
      />,
    );
    const favoritesMarkup = renderToStaticMarkup(
      <FavoritesManager candidates={favoriteCandidates} initialFavorites={[]} locale="en" />,
    );

    expect(calibrationMarkup).toContain('aria-live="polite"');
    expect(calibrationMarkup).toContain('data-lb-region');
    expect(homeMarkup.match(/data-home-region-order=/gu)).toHaveLength(3);
    expect(homeMarkup).toContain('<main');
    expect(favoritesMarkup).toContain('aria-live="polite"');
  });

  it('reports zero serious or critical semantic axe admission findings across representative surfaces', () => {
    const noChange = createNoChangeReceipt({
      scenarioId: 'S01',
      locale: 'pt-BR',
      correlationId: 'S01-axe-0001',
      createdAt: '2030-01-15T18:02:00.000Z',
      requestedOperations: ['Revisar perfil de energia equilibrado'],
    });
    const samples = [
      renderToStaticMarkup(
        <CalibrationWorkspace locale="pt-BR" scenarioId="S14" surfaceState="permission-denied" />,
      ),
      renderToStaticMarkup(
        <ContextualHome
          calibration={limitedCalibration}
          claims={claims}
          locale="pt-BR"
          scenarioId="S05"
          variant="unsupported-windows"
        />,
      ),
      renderToStaticMarkup(
        <GlobalCommandCenter
          context={{ contextTags: ['home'] }}
          entries={commandEntries}
          initialQuery="jogo"
          initiallyOpen
          locale="pt-BR"
          onNavigate={() => undefined}
          onOpenScenario={() => undefined}
          scenarioId="S03"
        />,
      ),
      renderToStaticMarkup(
        <ActivitySurface
          events={activityEvents}
          locale="pt-BR"
          receipts={[noChange.receipt]}
          scenarioId="S17"
        />,
      ),
    ];

    expect(samples.flatMap(semanticAudit)).toEqual([]);
  });
});
