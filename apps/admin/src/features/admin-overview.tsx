'use client';

import { LbOperationalNotice, LbSkeletonRegion, ProductIcon } from '@liiiraa/design-system';
import type { WebLocale } from '@liiiraa/web-core';

import type { AdminQueryFamily, AdminQueryResult } from '../admin-authority';
import { useAdminAuthority } from './admin-authority';
import {
  projectAdminBriefing,
  type AdminBriefingModel,
  type AdminBriefingPriority,
} from './admin-overview-model';
import styles from './admin-overview.module.css';

const overviewCopy = Object.freeze({
  en: Object.freeze({
    activeFunction: 'Active function',
    capacity: 'Invitation capacity',
    capacityDegraded: 'Capacity remains readable; invitation delivery actions are paused.',
    capacityEmpty: 'Capacity is unavailable from the current authorized projection.',
    context: 'Operational context',
    contextDetail: 'Only evidence that changes a decision now.',
    deadline: 'Deadline',
    degradedDetail:
      'Affected actions are unavailable. Unaffected authorized work remains available.',
    degradedTitle: 'Capability-specific degradation',
    description: 'Operational priorities first; verified business context follows.',
    environment: 'Environment',
    errorDetail:
      'This view could not admit authoritative records. No hidden count or record detail is shown.',
    errorTitle: 'Authorized briefing unavailable',
    empty: 'No authorized priority work is waiting in this view.',
    firstUse:
      'This function does not have an admitted briefing yet. Work appears only after server authority is available.',
    forecast: 'Forecast exhaustion',
    freshness: 'Freshness',
    handoffCovered: 'Substitute assigned',
    handoffUncovered: 'No substitute assigned',
    loading: 'Loading authorized operational briefing',
    nextActions: 'Next actions',
    nextActionsDetail: 'Ordered by risk, deadline, assignment, and stable reference.',
    observed: 'Observed',
    offlineDetail: 'Safe reading is unavailable until the administrative authority reconnects.',
    offlineTitle: 'Administrative authority offline',
    owner: 'Owner',
    priority: 'Operational briefing',
    queued: 'queued',
    reconnectingDetail:
      'Existing authorized records remain marked stale while the canonical HTTP projection refreshes.',
    reconnectingTitle: 'Refreshing authoritative records',
    staleDetail: 'Review the freshness time before acting. Authority-dependent actions are paused.',
    staleTitle: 'Briefing data is stale',
    substitute: 'Substitute',
    title: 'Overview',
    unavailable: 'Unavailable',
  }),
  'pt-BR': Object.freeze({
    activeFunction: 'Função ativa',
    capacity: 'Capacidade de convites',
    capacityDegraded:
      'A capacidade permanece legível; ações de entrega de convites estão pausadas.',
    capacityEmpty: 'A capacidade não está disponível na projeção autorizada atual.',
    context: 'Contexto operacional',
    contextDetail: 'Somente evidências que mudam uma decisão agora.',
    deadline: 'Prazo',
    degradedDetail:
      'As ações afetadas estão indisponíveis. O trabalho autorizado não afetado permanece disponível.',
    degradedTitle: 'Degradação específica de capacidade',
    description: 'Prioridades operacionais primeiro; contexto verificado do negócio logo depois.',
    environment: 'Ambiente',
    errorDetail:
      'Esta visão não admitiu registros autoritativos. Nenhuma contagem oculta ou detalhe de registro é exibido.',
    errorTitle: 'Briefing autorizado indisponível',
    empty: 'Nenhum trabalho prioritário autorizado aguarda nesta visão.',
    firstUse:
      'Esta função ainda não possui um briefing admitido. O trabalho aparece somente após a autoridade do servidor estar disponível.',
    forecast: 'Previsão de saturação',
    freshness: 'Atualização',
    handoffCovered: 'Substituto definido',
    handoffUncovered: 'Sem substituto definido',
    loading: 'Carregando briefing operacional autorizado',
    nextActions: 'Próximas ações',
    nextActionsDetail: 'Ordenadas por risco, prazo, atribuição e referência estável.',
    observed: 'Observado',
    offlineDetail: 'A leitura segura está indisponível até a autoridade administrativa reconectar.',
    offlineTitle: 'Autoridade administrativa offline',
    owner: 'Responsável',
    priority: 'Briefing operacional',
    queued: 'na fila',
    reconnectingDetail:
      'Os registros autorizados existentes permanecem marcados como antigos enquanto a projeção HTTP canônica atualiza.',
    reconnectingTitle: 'Atualizando registros autoritativos',
    staleDetail:
      'Revise o horário de atualização antes de agir. Ações dependentes de autoridade estão pausadas.',
    staleTitle: 'Dados do briefing estão antigos',
    substitute: 'Substituto',
    title: 'Visão geral',
    unavailable: 'Indisponível',
  }),
});

const priorityCopy = Object.freeze({
  critical: Object.freeze({ en: 'Critical', 'pt-BR': 'Crítica' }),
  information: Object.freeze({ en: 'Information', 'pt-BR': 'Informativa' }),
  warning: Object.freeze({ en: 'Warning', 'pt-BR': 'Atenção' }),
});

const dateTime = (value: string | null, locale: WebLocale): string =>
  value === null
    ? '—'
    : new Intl.DateTimeFormat(locale, {
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        month: 'short',
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
      }).format(new Date(value));

const noticeFor = (
  model: AdminBriefingModel,
  locale: WebLocale,
): Readonly<{
  detail: string;
  state: 'reconnecting' | 'stale' | 'offline' | 'degraded';
  title: string;
}> | null => {
  const labels = overviewCopy[locale];
  if (model.status === 'live') return null;
  if (model.status === 'offline') {
    return { detail: labels.offlineDetail, state: 'offline', title: labels.offlineTitle };
  }
  if (model.status === 'degraded') {
    return { detail: labels.degradedDetail, state: 'degraded', title: labels.degradedTitle };
  }
  if (model.connection === 'reconnecting') {
    return {
      detail: labels.reconnectingDetail,
      state: 'reconnecting',
      title: labels.reconnectingTitle,
    };
  }
  return {
    detail: labels.staleDetail,
    state: 'stale',
    title: labels.staleTitle,
  };
};

const PriorityRow = ({
  locale,
  priority,
}: Readonly<{ locale: WebLocale; priority: AdminBriefingPriority }>) => {
  const labels = overviewCopy[locale];
  return (
    <li className={styles['priorityRow']} data-severity={priority.severity}>
      <span aria-hidden="true" className={styles['severityMark']} />
      <div className={styles['priorityBody']}>
        <div className={styles['priorityHeading']}>
          <div>
            <span className={styles['severityLabel']}>
              {priorityCopy[priority.severity][locale]}
            </span>
            <h3>{priority.title}</h3>
          </div>
          <code>{priority.id}</code>
        </div>
        <p className={styles['priorityContext']}>{priority.context}</p>
        <dl className={styles['priorityMetadata']}>
          <div>
            <dt>{labels.owner}</dt>
            <dd>{priority.handoff.ownerReference}</dd>
          </div>
          <div>
            <dt>{labels.substitute}</dt>
            <dd>
              {priority.handoff.substituteReference ?? labels.handoffUncovered}
              <span className="lb-visually-hidden">
                {priority.handoff.state === 'covered'
                  ? labels.handoffCovered
                  : labels.handoffUncovered}
              </span>
            </dd>
          </div>
          <div>
            <dt>{labels.deadline}</dt>
            <dd data-escalation={priority.handoff.escalation}>
              {dateTime(priority.deadlineAt, locale)}
            </dd>
          </div>
          <div>
            <dt>{labels.freshness}</dt>
            <dd>{priority.freshness}</dd>
          </div>
        </dl>
      </div>
      {priority.action === null ? null : (
        <a className={styles['rowAction']} href={priority.action.href}>
          {priority.action.label}
        </a>
      )}
    </li>
  );
};

type AdminOverviewViewProps =
  | Readonly<{ locale: WebLocale; state: 'loading' }>
  | Readonly<{ errorCode?: string; locale: WebLocale; state: 'error' }>
  | Readonly<{ locale: WebLocale; model: AdminBriefingModel; state: 'ready' }>;

export const AdminOverviewView = (props: AdminOverviewViewProps) => {
  const labels = overviewCopy[props.locale];
  if (props.state === 'loading') {
    return (
      <article className={styles['overview']} data-admin-overview-state="loading">
        <header className={styles['routeHeader']}>
          <div>
            <h1>{labels.title}</h1>
            <p>{labels.description}</p>
          </div>
        </header>
        <LbSkeletonRegion label={labels.loading} rows={5} />
      </article>
    );
  }
  if (props.state === 'error') {
    return (
      <article className={styles['overview']} data-admin-overview-state="error">
        <header className={styles['routeHeader']}>
          <div>
            <h1>{labels.title}</h1>
            <p>{labels.description}</p>
          </div>
        </header>
        <LbOperationalNotice
          detail={`${labels.errorDetail}${props.errorCode === undefined ? '' : ` · ${props.errorCode}`}`}
          state="degraded"
          title={labels.errorTitle}
        />
      </article>
    );
  }

  const { model } = props;
  const notice = noticeFor(model, props.locale);
  const capacity = model.context.capacity;
  const capacityAvailable =
    capacity.activeCount !== undefined && capacity.activeLimit !== undefined;
  return (
    <article className={styles['overview']} data-admin-overview-state={model.status}>
      <header className={styles['routeHeader']}>
        <div>
          <h1>{labels.title}</h1>
          <p>{labels.description}</p>
        </div>
        <span className={styles['liveIdentity']} data-status={model.status} role="status">
          <span aria-hidden="true" />
          {model.status}
        </span>
      </header>

      {notice === null ? null : (
        <LbOperationalNotice detail={notice.detail} state={notice.state} title={notice.title} />
      )}

      <section className={styles['briefing']} aria-labelledby="admin-overview-briefing">
        <div className={styles['briefingCopy']}>
          <span className={styles['briefingLabel']}>
            <ProductIcon name="shield" size={17} />
            {labels.priority}
          </span>
          <h2 id="admin-overview-briefing">{model.statement}</h2>
        </div>
        <dl className={styles['briefingFacts']}>
          <div>
            <dt>{labels.activeFunction}</dt>
            <dd>{model.activeFunction ?? labels.unavailable}</dd>
          </div>
          <div>
            <dt>{labels.environment}</dt>
            <dd>{model.context.environment?.label ?? labels.unavailable}</dd>
          </div>
          <div>
            <dt>{labels.observed}</dt>
            <dd>{dateTime(model.context.observedAt, props.locale)}</dd>
          </div>
        </dl>
      </section>

      <div className={styles['workspace']}>
        <section className={styles['workRegion']} aria-labelledby="admin-overview-actions">
          <header className={styles['sectionHeader']}>
            <div>
              <h2 id="admin-overview-actions">{labels.nextActions}</h2>
              <p>{labels.nextActionsDetail}</p>
            </div>
          </header>
          {model.priorities.length === 0 ? (
            <div className={styles['emptyState']} role="status">
              <ProductIcon name="check" size={22} />
              <p>{model.activeFunction === null ? labels.firstUse : labels.empty}</p>
            </div>
          ) : (
            <ol className={styles['priorityList']}>
              {model.priorities.map((priority) => (
                <PriorityRow
                  key={`${priority.kind}:${priority.id}`}
                  locale={props.locale}
                  priority={priority}
                />
              ))}
            </ol>
          )}
        </section>

        <aside className={styles['contextRegion']} aria-labelledby="admin-overview-context">
          <header className={styles['sectionHeader']}>
            <div>
              <h2 id="admin-overview-context">{labels.context}</h2>
              <p>{labels.contextDetail}</p>
            </div>
          </header>
          <div className={styles['contextBody']}>
            <section className={styles['capacity']} data-status={capacity.status}>
              <header>
                <div>
                  <ProductIcon name={capacity.status === 'live' ? 'check' : 'warning'} size={18} />
                  <h3>{labels.capacity}</h3>
                </div>
                <span>{capacity.status}</span>
              </header>
              {capacityAvailable ? (
                <>
                  <p className={styles['capacityStatement']}>
                    <strong>
                      {String(capacity.activeCount)} / {String(capacity.activeLimit)}
                    </strong>
                    {capacity.queuedCount === undefined ? null : (
                      <span>
                        {String(capacity.queuedCount)} {labels.queued}
                      </span>
                    )}
                  </p>
                  <dl>
                    <div>
                      <dt>{labels.observed}</dt>
                      <dd>{dateTime(capacity.observedAt ?? null, props.locale)}</dd>
                    </div>
                    {capacity.forecastExhaustionAt === undefined ? null : (
                      <div>
                        <dt>{labels.forecast}</dt>
                        <dd>{dateTime(capacity.forecastExhaustionAt, props.locale)}</dd>
                      </div>
                    )}
                  </dl>
                  {capacity.status === 'degraded' ? <p>{labels.capacityDegraded}</p> : null}
                  {capacity.action === null ? null : (
                    <a href={capacity.action.href}>{capacity.action.label}</a>
                  )}
                </>
              ) : (
                <p>{labels.capacityEmpty}</p>
              )}
            </section>

            {model.degradedCapabilities.length === 0 ? null : (
              <section
                className={styles['degradedCapabilities']}
                aria-labelledby="degraded-capabilities"
              >
                <h3 id="degraded-capabilities">{labels.degradedTitle}</h3>
                <ul>
                  {model.degradedCapabilities.map((capability) => (
                    <li key={capability}>
                      <ProductIcon name="warning" size={16} />
                      <code>{capability}</code>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </aside>
      </div>
    </article>
  );
};

const OVERVIEW_FAMILIES = Object.freeze([
  'briefing',
  'approvals',
  'jobs',
  'incidents',
  'capacity',
  'invitations',
] as const satisfies readonly AdminQueryFamily[]);

export const AdminOverview = ({
  locale,
  queueState = Object.freeze({ view: 'assigned' }),
}: Readonly<{
  locale: WebLocale;
  queueState?: Readonly<{ cursor?: string; view?: string }>;
}>) => {
  const { freshness, projections, session } = useAdminAuthority();
  const results = OVERVIEW_FAMILIES.map((family) => projections[family]);
  if (results.some((result) => result === undefined)) {
    return <AdminOverviewView locale={locale} state="loading" />;
  }
  const admitted = results.filter(
    (result): result is Extract<AdminQueryResult, { status: 'online' }> =>
      result?.status === 'online',
  );
  const failed = results.filter(
    (result): result is Exclude<AdminQueryResult, { status: 'online' }> =>
      result !== undefined && result.status !== 'online',
  );
  if (admitted.length === 0) {
    return (
      <AdminOverviewView
        errorCode={failed[0]?.code ?? 'unavailable'}
        locale={locale}
        state="error"
      />
    );
  }
  const records = admitted.flatMap((result) => result.records);
  const authorityState = results.some((result) => result?.status === 'error')
    ? 'degraded'
    : freshness;
  const model = projectAdminBriefing({
    authorityState,
    locale,
    now: new Date().toISOString(),
    queueState,
    records,
    ...(session === null || session === undefined
      ? {}
      : {
          session: {
            activeFunction: session.role,
            actorId: session.actorId,
          },
        }),
  });
  return <AdminOverviewView locale={locale} model={model} state="ready" />;
};
