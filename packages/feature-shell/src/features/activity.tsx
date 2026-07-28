import { LbButton, RouteHeader, ScenarioMarker, StatusSignal } from '@liiiraa/design-system';
import { useMemo, useState } from 'react';

import {
  ACTIVITY_FILTERS,
  mapFeedbackChannels,
  reduceActivity,
  selectActivityGroups,
  type ActivityEvent,
  type ActivityFilter,
  type ActivityState,
  type FeedbackSignal,
  type ScenarioPreviewReceipt,
} from '../model/interaction-policy.js';
import type { ShellLocale } from './calibration.js';

export interface ActivitySurfaceProps {
  readonly events: readonly ActivityEvent[];
  readonly locale: ShellLocale;
  readonly onNavigate?: (route: string) => void;
  readonly receipts?: readonly ScenarioPreviewReceipt[];
  readonly scenarioId: string;
}

const GROUP_LABELS: Readonly<Record<ShellLocale, Readonly<Record<ActivityState, string>>>> = {
  en: {
    'requires-action': 'Requires action',
    'in-progress': 'In progress',
    completed: 'Completed',
    history: 'History',
  },
  'pt-BR': {
    'requires-action': 'Requer ação',
    'in-progress': 'Em andamento',
    completed: 'Concluído',
    history: 'Histórico',
  },
};

const FILTER_LABELS: Readonly<Record<ShellLocale, Readonly<Record<ActivityFilter, string>>>> = {
  en: {
    all: 'All',
    plans: 'Plans',
    games: 'Games',
    recovery: 'Recovery',
    account: 'Account',
    updates: 'Updates',
  },
  'pt-BR': {
    all: 'Tudo',
    plans: 'Planos',
    games: 'Jogos',
    recovery: 'Recuperação',
    account: 'Conta',
    updates: 'Atualizações',
  },
};

export const ActivitySurface = ({
  events: initialEvents,
  locale,
  onNavigate,
  receipts = [],
  scenarioId,
}: ActivitySurfaceProps) => {
  const [events, setEvents] = useState(initialEvents);
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [includeHistory, setIncludeHistory] = useState(false);
  const isPtBr = locale === 'pt-BR';
  const groups = useMemo(
    () => selectActivityGroups(events, filter, { includeHistory }),
    [events, filter, includeHistory],
  );

  const dispatch = (
    action:
      | Readonly<{ type: 'acknowledge'; correlationId: string }>
      | Readonly<{ type: 'dismiss'; correlationId: string }>
      | Readonly<{ type: 'resolve'; correlationId: string }>,
  ) => {
    setEvents((current) => reduceActivity(current, action));
  };

  return (
    <main
      aria-labelledby="activity-surface-title"
      data-scenario-id={scenarioId}
      data-surface="activity"
    >
      <ScenarioMarker scenarioId={scenarioId} />
      <RouteHeader
        purpose={
          isPtBr
            ? 'Revise eventos duráveis, ações pendentes e recibos sem alteração.'
            : 'Review durable events, pending actions, and no-change receipts.'
        }
        title={isPtBr ? 'Atividade' : 'Activity'}
      />
      <h1 className="lb-visually-hidden" id="activity-surface-title">
        {isPtBr ? 'Atividade' : 'Activity'}
      </h1>

      <fieldset>
        <legend>{isPtBr ? 'Filtrar atividade' : 'Filter activity'}</legend>
        {ACTIVITY_FILTERS.map((candidate) => (
          <label key={candidate}>
            <input
              checked={filter === candidate}
              name="activity-filter"
              onChange={() => { setFilter(candidate); }}
              type="radio"
            />
            {FILTER_LABELS[locale][candidate]}
          </label>
        ))}
        <label>
          <input
            checked={includeHistory}
            onChange={(event) => { setIncludeHistory(event.currentTarget.checked); }}
            type="checkbox"
          />
          {isPtBr ? 'Incluir histórico dispensado' : 'Include dismissed history'}
        </label>
      </fieldset>

      {groups.length === 0 ? (
        <StatusSignal
          detail={
            isPtBr
              ? 'Nenhum evento corresponde a este filtro.'
              : 'No event matches this filter.'
          }
          state="empty"
        />
      ) : (
        groups.map((group) => (
          <section aria-labelledby={`activity-group-${group.state}`} key={group.state}>
            <h2 id={`activity-group-${group.state}`}>{GROUP_LABELS[locale][group.state]}</h2>
            <ol>
              {group.events.map((event) => {
                const dismissalBlocked =
                  event.severity === 'critical' && (!event.acknowledged || !event.resolved);
                return (
                  <li data-severity={event.severity} key={event.correlationId}>
                    <article>
                      <header>
                        <h3>{event.title}</h3>
                        <StatusSignal
                          detail={event.affectedObject}
                          state={
                            event.severity === 'critical'
                              ? 'recovery'
                              : event.state === 'in-progress'
                                ? 'loading'
                                : 'fixture'
                          }
                        />
                      </header>
                      <dl>
                        <dt>{isPtBr ? 'Objeto afetado' : 'Affected object'}</dt>
                        <dd>{event.affectedObject}</dd>
                        <dt>{isPtBr ? 'Horário' : 'Time'}</dt>
                        <dd>
                          <time dateTime={event.occurredAt}>{event.occurredAt}</time>
                        </dd>
                        <dt>{isPtBr ? 'Fonte' : 'Source'}</dt>
                        <dd>{event.source}</dd>
                        <dt>{isPtBr ? 'ID de correlação' : 'Correlation ID'}</dt>
                        <dd>
                          <code>{event.correlationId}</code>
                        </dd>
                      </dl>
                      {event.scenarioMarked ? (
                        <p>{isPtBr ? 'Evento de cenário — nenhuma alteração real.' : 'Scenario event — no real change.'}</p>
                      ) : null}
                      {event.nextAction ? (
                        <LbButton
                          onPress={() => onNavigate?.(event.nextAction?.route ?? '/activity')}
                          variant="primary"
                        >
                          {event.nextAction.label}
                        </LbButton>
                      ) : null}
                      {event.severity === 'critical' && !event.acknowledged ? (
                        <LbButton
                          onPress={() =>
                            { dispatch({ type: 'acknowledge', correlationId: event.correlationId }); }
                          }
                          variant="secondary"
                        >
                          {isPtBr ? 'Reconhecer evento' : 'Acknowledge event'}
                        </LbButton>
                      ) : null}
                      {event.severity === 'critical' && !event.resolved ? (
                        <LbButton
                          onPress={() =>
                            { dispatch({ type: 'resolve', correlationId: event.correlationId }); }
                          }
                          variant="secondary"
                        >
                          {isPtBr ? 'Marcar como resolvido' : 'Mark resolved'}
                        </LbButton>
                      ) : null}
                      <LbButton
                        isDisabled={dismissalBlocked}
                        onPress={() =>
                          { dispatch({ type: 'dismiss', correlationId: event.correlationId }); }
                        }
                        variant="quiet"
                      >
                        {isPtBr ? 'Dispensar da lista ativa' : 'Dismiss from active list'}
                      </LbButton>
                      {dismissalBlocked ? (
                        <p>
                          {isPtBr
                            ? 'Eventos críticos só podem ser dispensados após reconhecimento e resolução.'
                            : 'Critical events can be dismissed only after acknowledgement and resolution.'}
                        </p>
                      ) : null}
                    </article>
                  </li>
                );
              })}
            </ol>
          </section>
        ))
      )}

      {receipts.length > 0 ? (
        <section aria-labelledby="no-change-receipts-title">
          <h2 id="no-change-receipts-title">
            {isPtBr ? 'Recibos de prévia sem alteração' : 'No-change preview receipts'}
          </h2>
          <ol>
            {receipts.map((receipt) => (
              <li data-changed={String(receipt.changed)} key={`${receipt.scenarioId}-${receipt.summary}`}>
                <ScenarioMarker scenarioId={receipt.scenarioId} />
                <strong>{receipt.summary}</strong>
                <p>
                  {isPtBr
                    ? 'Nenhuma alteração foi feita neste PC.'
                    : 'No change was made to this PC.'}
                </p>
                <ul>
                  {receipt.requestedOperations.map((operation) => (
                    <li key={operation}>{operation}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </main>
  );
};

export interface FeedbackSurfaceProps {
  readonly locale: ShellLocale;
  readonly onNavigate?: (route: string) => void;
  readonly signal: FeedbackSignal;
}

export const FeedbackSurface = ({ locale, onNavigate, signal }: FeedbackSurfaceProps) => {
  const policy = mapFeedbackChannels(signal);
  const isPtBr = locale === 'pt-BR';

  return (
    <section
      aria-label={isPtBr ? 'Confirmação da ação' : 'Action feedback'}
      data-feedback-channels={policy.channels.join(' ')}
    >
      {policy.channels.includes('inline') ? (
        <div aria-live="polite" data-duration-ms={policy.inlineDurationMs} role="status">
          {signal.event.title}
        </div>
      ) : null}
      {policy.channels.includes('toast') ? (
        <aside aria-live="polite" data-maximum-visible={policy.maximumVisibleToasts}>
          {signal.event.title}
        </aside>
      ) : null}
      <p>
        {isPtBr
          ? 'Este evento permanece disponível em Atividade.'
          : 'This event remains available in Activity.'}
      </p>
      {policy.windowsNotification ? (
        <aside aria-label={isPtBr ? 'Prévia da notificação do Windows' : 'Windows notification preview'}>
          <strong>{policy.windowsNotification.productName}</strong>
          <p>{policy.windowsNotification.issue}</p>
          <LbButton
            onPress={() => onNavigate?.(policy.windowsNotification?.action.route ?? '/activity')}
            variant="secondary"
          >
            {policy.windowsNotification.action.label}
          </LbButton>
          <code>{policy.windowsNotification.correlationId}</code>
        </aside>
      ) : null}
    </section>
  );
};
