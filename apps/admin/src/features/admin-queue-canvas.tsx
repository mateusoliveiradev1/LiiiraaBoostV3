'use client';

import type {
  AdminInboxItemProjectionJson,
  AdminJobProjectionJson,
  AdminSavedViewProjectionJson,
} from '@liiiraa/contracts-ts';
import {
  LbButton,
  LbOperationalNotice,
  LbSearchField,
  LbSkeletonRegion,
  ProductIcon,
} from '@liiiraa/design-system';
import type { WebLocale } from '@liiiraa/web-core';
import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react';

import type {
  AdminAuthorityDocument,
  AdminMutationResult,
  AdminQueryResult,
} from '../admin-authority';
import { useAdminAuthority } from './admin-authority';
import {
  createQueueHref,
  deriveQueueAuthorityState,
  parseQueueUrlState,
  projectQueueJob,
  type QueueAuthorityState,
  type QueueJobProjection,
  type QueueSavedView,
  type QueueTab,
  type QueueUrlState,
} from './admin-queue-model';
import styles from './admin-queue-canvas.module.css';

const copy = Object.freeze({
  en: Object.freeze({
    clearFilters: 'Clear filters',
    closeInspector: 'Close record inspector',
    compact: 'Compact',
    comfortable: 'Comfortable',
    deadline: 'Deadline',
    degradedDetail:
      'One or more capabilities could not refresh. Available authorized work remains readable.',
    degradedTitle: 'Queue partially degraded',
    density: 'Density',
    description:
      'Search, triage, saved views, inbox, and durable jobs share one authority-safe workspace.',
    empty: 'No authorized records match this view.',
    emptyAction: 'Reset the safe filters to return to the complete permitted queue.',
    errorDetail:
      'The server did not admit queue records for this session. No record existence is disclosed.',
    errorTitle: 'Authorized queue unavailable',
    firstUse: 'No queue has been admitted for this administrative function yet.',
    filters: 'Filters',
    inbox: 'Inbox',
    inspector: 'Record detail',
    jobs: 'Jobs',
    loading: 'Loading server-authorized queue records',
    mutateBlocked: 'Refresh authoritative data before changing this record.',
    next: 'Next page',
    noDeadline: 'No deadline',
    noOwner: 'Unassigned',
    official: 'Official · read-only',
    owner: 'Owner',
    page: 'Page',
    partialJob: 'Completed effects remain valid; failed items require review.',
    personal: 'Personal',
    previous: 'Previous page',
    progress: 'Job progress',
    queue: 'Queue',
    receipt: 'Receipt',
    reconnectingDetail:
      'Current records remain marked stale while canonical HTTP projections refresh.',
    reconnectingTitle: 'Reconnecting to queue authority',
    reference: 'Reference',
    resultCount: 'authorized records',
    savedViews: 'Saved views',
    search: 'Search',
    searchLabel: 'Search permitted administrative records',
    searchPlaceholder: 'Reference, safe label, or permitted domain',
    selected: 'selected',
    sort: 'Sort',
    staleDetail: 'Review the synchronization time. Authority-dependent mutations are paused.',
    staleTitle: 'Queue data is stale',
    state: 'State',
    statusFilter: 'Record state',
    title: 'Operational queue',
    updated: 'Updated',
    version: 'Version',
    viewOwner: 'View owner',
    views: 'Views',
  }),
  'pt-BR': Object.freeze({
    clearFilters: 'Limpar filtros',
    closeInspector: 'Fechar inspeção do registro',
    compact: 'Compacta',
    comfortable: 'Confortável',
    deadline: 'Prazo',
    degradedDetail:
      'Uma ou mais capacidades não atualizaram. O trabalho autorizado disponível permanece legível.',
    degradedTitle: 'Fila parcialmente degradada',
    density: 'Densidade',
    description:
      'Busca, triagem, visões salvas, caixa de entrada e trabalhos duráveis compartilham uma superfície segura.',
    empty: 'Nenhum registro autorizado corresponde a esta visão.',
    emptyAction: 'Limpe os filtros seguros para voltar à fila permitida completa.',
    errorDetail:
      'O servidor não admitiu registros da fila para esta sessão. A existência dos registros não é revelada.',
    errorTitle: 'Fila autorizada indisponível',
    firstUse: 'Nenhuma fila foi admitida para esta função administrativa ainda.',
    filters: 'Filtros',
    inbox: 'Caixa de entrada',
    inspector: 'Detalhe do registro',
    jobs: 'Trabalhos',
    loading: 'Carregando registros autorizados pelo servidor',
    mutateBlocked: 'Atualize os dados autoritativos antes de alterar este registro.',
    next: 'Próxima página',
    noDeadline: 'Sem prazo',
    noOwner: 'Sem responsável',
    official: 'Oficial · somente leitura',
    owner: 'Responsável',
    page: 'Página',
    partialJob: 'Os efeitos concluídos continuam válidos; os itens com falha exigem revisão.',
    personal: 'Pessoal',
    previous: 'Página anterior',
    progress: 'Progresso do trabalho',
    queue: 'Fila',
    receipt: 'Comprovante',
    reconnectingDetail:
      'Os registros atuais permanecem marcados como antigos enquanto as projeções HTTP canônicas atualizam.',
    reconnectingTitle: 'Reconectando à autoridade da fila',
    reference: 'Referência',
    resultCount: 'registros autorizados',
    savedViews: 'Visões salvas',
    search: 'Busca',
    searchLabel: 'Buscar registros administrativos permitidos',
    searchPlaceholder: 'Referência, rótulo seguro ou domínio permitido',
    selected: 'selecionados',
    sort: 'Ordenar',
    staleDetail: 'Revise a sincronização. Mutações dependentes de autoridade estão pausadas.',
    staleTitle: 'Dados da fila estão antigos',
    state: 'Estado',
    statusFilter: 'Estado do registro',
    title: 'Fila operacional',
    updated: 'Atualizado',
    version: 'Versão',
    viewOwner: 'Responsável pela visão',
    views: 'Visões',
  }),
});

export type QueueCanvasRecord = Readonly<{
  deadlineAt?: string;
  href: string;
  id: string;
  kind: string;
  ownerReference?: string;
  severity: 'information' | 'warning' | 'critical';
  state: string;
  summary: string;
  updatedAt?: string;
  version: string;
}>;

export type QueueCanvasModel = Readonly<{
  authority: QueueAuthorityState;
  basePath: string;
  degradedFamilies: readonly string[];
  firstUse: boolean;
  inbox: readonly AdminInboxItemProjectionJson[];
  jobs: readonly QueueJobProjection[];
  nextCursor: string | null;
  observedAt?: string;
  records: readonly QueueCanvasRecord[];
  savedViews: readonly QueueSavedView[];
  urlState: QueueUrlState;
}>;

const stringField = (
  record: AdminAuthorityDocument,
  keys: readonly string[],
): string | undefined => {
  const fields = record as unknown as Readonly<Record<string, unknown>>;
  for (const key of keys) {
    const value = fields[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return undefined;
};

const severityFor = (record: AdminAuthorityDocument): QueueCanvasRecord['severity'] => {
  const severity = stringField(record, ['severity', 'risk']);
  if (severity === 'critical' || severity === 'high' || severity === 'irreversible')
    return 'critical';
  if (severity === 'warning' || severity === 'medium') return 'warning';
  return 'information';
};

const projectRecord = (
  record: AdminAuthorityDocument,
  basePath: string,
  urlState: QueueUrlState,
): QueueCanvasRecord => {
  const version = stringField(record, ['aggregateVersion']) ?? 'unavailable';
  const id =
    stringField(record, [
      'inboxItemId',
      'jobId',
      'invitationId',
      'governanceRecordId',
      'incidentId',
      'configurationId',
      'capacityId',
      'auditEventId',
      'savedViewId',
      'actorId',
    ]) ?? `${record.kind}:${version}`;
  const state =
    stringField(record, ['state', 'lifecycleState', 'deliveryState', 'governanceKind']) ??
    'available';
  const summary =
    stringField(record, ['title', 'name', 'recipientMasked', 'label']) ??
    record.kind.replaceAll('-', ' ');
  const deadlineAt = stringField(record, ['deadlineAt', 'expiresAt']);
  const ownerReference = stringField(record, ['ownerReference', 'authorReference']);
  const updatedAt = stringField(record, ['updatedAt', 'lastEventAt', 'observedAt']);
  return Object.freeze({
    ...(deadlineAt === undefined ? {} : { deadlineAt }),
    href: createQueueHref(
      `${basePath}/${encodeURIComponent(record.kind)}/${encodeURIComponent(id)}`,
      {
        ...urlState,
        selectedId: id,
      },
    ),
    id,
    kind: record.kind,
    ...(ownerReference === undefined ? {} : { ownerReference }),
    severity: severityFor(record),
    state,
    summary,
    ...(updatedAt === undefined ? {} : { updatedAt }),
    version,
  });
};

const isSavedView = (record: AdminAuthorityDocument): record is AdminSavedViewProjectionJson =>
  record.kind === 'admin-saved-view-projection';
const isInboxItem = (record: AdminAuthorityDocument): record is AdminInboxItemProjectionJson =>
  record.kind === 'admin-inbox-item-projection';
const isJob = (record: AdminAuthorityDocument): record is AdminJobProjectionJson =>
  record.kind === 'admin-job-projection';

const formatDate = (value: string | undefined, locale: WebLocale, fallback: string): string => {
  if (value === undefined) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(date);
};

const tabCopy = (locale: WebLocale): Readonly<Record<QueueTab, string>> => {
  const labels = copy[locale];
  return {
    inbox: labels.inbox,
    jobs: labels.jobs,
    queue: labels.queue,
    search: labels.search,
    views: labels.views,
  };
};

const noticeFor = (
  model: QueueCanvasModel,
  locale: WebLocale,
): Readonly<{
  detail: string;
  state: 'reconnecting' | 'stale' | 'offline' | 'degraded';
  title: string;
}> | null => {
  const labels = copy[locale];
  if (model.authority.state === 'live') return null;
  if (model.authority.state === 'reconnecting') {
    return {
      detail: labels.reconnectingDetail,
      state: 'reconnecting',
      title: labels.reconnectingTitle,
    };
  }
  if (model.authority.state === 'stale') {
    return { detail: labels.staleDetail, state: 'stale', title: labels.staleTitle };
  }
  return {
    detail: labels.degradedDetail,
    state: model.authority.state === 'offline' ? 'offline' : 'degraded',
    title: labels.degradedTitle,
  };
};

const EmptyState = ({ children }: Readonly<{ children: ReactNode }>) => (
  <div className={styles['empty']} role="status">
    <ProductIcon name="list" size={24} />
    {children}
  </div>
);

const QueueTable = ({
  locale,
  model,
  onOpen,
  onSort,
}: Readonly<{
  locale: WebLocale;
  model: QueueCanvasModel;
  onOpen: (event: MouseEvent<HTMLAnchorElement>, record: QueueCanvasRecord) => void;
  onSort: (field: QueueUrlState['sort']['field']) => void;
}>) => {
  const labels = copy[locale];
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const columns = [
    ['reference', labels.reference],
    ['state', labels.state],
    ['owner', labels.owner],
    ['deadline', labels.deadline],
  ] as const;
  return (
    <>
      <p className={styles['selectionStatus']} aria-live="polite">
        {selected.size} {labels.selected}
      </p>
      <div className={styles['tableViewport']} role="region" aria-label={labels.title} tabIndex={0}>
        <table className={styles['table']}>
          <caption className="lb-visually-hidden">{labels.title}</caption>
          <thead>
            <tr>
              <th scope="col">
                <span className="lb-visually-hidden">{labels.selected}</span>
              </th>
              {columns.map(([field, label]) => (
                <th
                  key={field}
                  aria-sort={
                    model.urlState.sort.field === field
                      ? model.urlState.sort.direction === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                  scope="col"
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSort(field);
                    }}
                  >
                    {label}
                    <span aria-hidden="true"> ↕</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {model.records.map((record) => (
              <tr key={`${record.kind}:${record.id}`} data-severity={record.severity}>
                <td>
                  <label className={styles['rowCheckbox']}>
                    <input
                      aria-label={`${labels.reference} ${record.id}`}
                      checked={selected.has(record.id)}
                      onChange={(event) => {
                        const next = new Set(selected);
                        if (event.currentTarget.checked) next.add(record.id);
                        else next.delete(record.id);
                        setSelected(next);
                      }}
                      type="checkbox"
                    />
                  </label>
                </td>
                <td>
                  <a
                    href={record.href}
                    onClick={(event) => {
                      onOpen(event, record);
                    }}
                  >
                    <code>{record.id}</code>
                    <span>{record.summary}</span>
                  </a>
                </td>
                <td>
                  <span className={styles['state']} data-state={record.severity}>
                    {record.state}
                  </span>
                </td>
                <td>{record.ownerReference ?? labels.noOwner}</td>
                <td>{formatDate(record.deadlineAt, locale, labels.noDeadline)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className={styles['mobileList']} aria-label={labels.title}>
        {model.records.map((record) => (
          <li key={`${record.kind}:${record.id}`} data-severity={record.severity}>
            <a href={record.href}>
              <span>
                <code>{record.id}</code>
                <span className={styles['state']}>{record.state}</span>
              </span>
              <strong>{record.summary}</strong>
              <span>
                {record.ownerReference ?? labels.noOwner} ·{' '}
                {formatDate(record.deadlineAt, locale, labels.noDeadline)}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </>
  );
};

const SavedViews = ({
  locale,
  model,
}: Readonly<{ locale: WebLocale; model: QueueCanvasModel }>) => {
  const labels = copy[locale];
  if (model.savedViews.length === 0)
    return (
      <EmptyState>
        <p>{labels.empty}</p>
      </EmptyState>
    );
  return (
    <ul className={styles['ledger']}>
      {model.savedViews.map((view) => (
        <li key={view.savedViewId}>
          <div>
            <ProductIcon name="pin" size={18} />
            <strong>{view.savedViewId}</strong>
          </div>
          <span>{view.visibility === 'official' ? labels.official : labels.personal}</span>
          <dl>
            <div>
              <dt>{labels.version}</dt>
              <dd>{view.aggregateVersion}</dd>
            </div>
            <div>
              <dt>{labels.viewOwner}</dt>
              <dd>{view.ownerReference ?? '—'}</dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
  );
};

const Inbox = ({ locale, model }: Readonly<{ locale: WebLocale; model: QueueCanvasModel }>) => {
  const labels = copy[locale];
  if (model.inbox.length === 0)
    return (
      <EmptyState>
        <p>{labels.empty}</p>
      </EmptyState>
    );
  return (
    <ul className={styles['ledger']}>
      {model.inbox.map((item) => (
        <li key={item.inboxItemId} data-severity={item.severity}>
          <div>
            <ProductIcon name="bell" size={18} />
            <strong>{item.title}</strong>
          </div>
          <span>{item.state}</span>
          <dl>
            <div>
              <dt>{labels.owner}</dt>
              <dd>{item.ownerReference}</dd>
            </div>
            <div>
              <dt>{labels.deadline}</dt>
              <dd>{formatDate(item.deadlineAt, locale, labels.noDeadline)}</dd>
            </div>
            <div>
              <dt>{labels.reference}</dt>
              <dd>{item.relatedRecordReference}</dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
  );
};

const Jobs = ({
  locale,
  model,
  onCancel,
}: Readonly<{
  locale: WebLocale;
  model: QueueCanvasModel;
  onCancel?: (job: QueueJobProjection) => void;
}>) => {
  const labels = copy[locale];
  if (model.jobs.length === 0)
    return (
      <EmptyState>
        <p>{labels.empty}</p>
      </EmptyState>
    );
  return (
    <ul className={styles['ledger']}>
      {model.jobs.map((job) => (
        <li key={job.jobId} data-state={job.state}>
          <div>
            <ProductIcon name="activity" size={18} />
            <strong>{job.jobId}</strong>
          </div>
          <span>{job.state}</span>
          {job.progressPercent === undefined ? null : (
            <progress
              aria-label={`${labels.progress}: ${job.jobId}`}
              max={100}
              value={job.progressPercent}
            />
          )}
          <p>
            {job.completedItems} / {job.totalItems} · {job.failedItems} failed
          </p>
          {job.state === 'partial' ? <p>{labels.partialJob}</p> : null}
          {job.receiptReference === undefined ? null : (
            <code>
              {labels.receipt}: {job.receiptReference}
            </code>
          )}
          {onCancel === undefined || !['queued', 'running', 'paused'].includes(job.state) ? null : (
            <LbButton
              isDisabled={!model.authority.canMutate}
              onPress={() => {
                onCancel(job);
              }}
              variant="secondary"
            >
              {locale === 'pt-BR' ? 'Cancelar trabalho' : 'Cancel job'}
            </LbButton>
          )}
        </li>
      ))}
    </ul>
  );
};

type AdminQueueCanvasViewProps =
  | Readonly<{ locale: WebLocale; state: 'loading' }>
  | Readonly<{ errorCode?: string; locale: WebLocale; state: 'error' }>
  | Readonly<{
      locale: WebLocale;
      model: QueueCanvasModel;
      mutationFeedback?: AdminMutationResult | null;
      onCancelJob?: (job: QueueJobProjection) => void;
      onStateChange?: (state: QueueUrlState) => void;
      state: 'ready';
    }>;

export const AdminQueueCanvasView = (props: AdminQueueCanvasViewProps) => {
  const labels = copy[props.locale];
  const requestedSelectedId = props.state === 'ready' ? props.model.urlState.selectedId : undefined;
  const [selectedId, setSelectedId] = useState(requestedSelectedId);
  const opener = useRef<HTMLAnchorElement | null>(null);
  useEffect(() => {
    setSelectedId(requestedSelectedId);
  }, [requestedSelectedId]);
  if (props.state === 'loading') {
    return (
      <article className={styles['canvas']} data-queue-state="loading">
        <header className={styles['routeHeader']}>
          <div>
            <h1>{labels.title}</h1>
            <p>{labels.description}</p>
          </div>
        </header>
        <LbSkeletonRegion label={labels.loading} rows={7} />
      </article>
    );
  }
  if (props.state === 'error') {
    return (
      <article className={styles['canvas']} data-queue-state="error">
        <header className={styles['routeHeader']}>
          <div>
            <h1>{labels.title}</h1>
            <p>{labels.description}</p>
          </div>
        </header>
        <LbOperationalNotice
          detail={`${labels.errorDetail}${props.errorCode ? ` · ${props.errorCode}` : ''}`}
          state="degraded"
          title={labels.errorTitle}
        />
      </article>
    );
  }
  const { model } = props;
  const notice = noticeFor(model, props.locale);
  const selectedRecord = model.records.find((record) => record.id === selectedId);
  type QueueStatePatch = { [Key in keyof QueueUrlState]?: QueueUrlState[Key] | undefined };
  const setState = (patch: QueueStatePatch) => {
    const cursor = 'cursor' in patch ? patch.cursor : model.urlState.cursor;
    const selectedId = 'selectedId' in patch ? patch.selectedId : model.urlState.selectedId;
    const viewId = 'viewId' in patch ? patch.viewId : model.urlState.viewId;
    const next: QueueUrlState = Object.freeze({
      ...(cursor === undefined ? {} : { cursor }),
      density: patch.density ?? model.urlState.density,
      filters: patch.filters ?? model.urlState.filters,
      page: patch.page ?? model.urlState.page,
      query: patch.query ?? model.urlState.query,
      ...(selectedId === undefined ? {} : { selectedId }),
      sort: patch.sort ?? model.urlState.sort,
      tab: patch.tab ?? model.urlState.tab,
      ...(viewId === undefined ? {} : { viewId }),
    });
    props.onStateChange?.(next);
  };
  const openRecord = (event: MouseEvent<HTMLAnchorElement>, record: QueueCanvasRecord) => {
    if (window.matchMedia('(min-width: 640px)').matches) {
      event.preventDefault();
      opener.current = event.currentTarget;
      setSelectedId(record.id);
      setState({ selectedId: record.id });
    }
  };
  const activeTab = model.urlState.tab;
  const body =
    activeTab === 'views' ? (
      <SavedViews locale={props.locale} model={model} />
    ) : activeTab === 'inbox' ? (
      <Inbox locale={props.locale} model={model} />
    ) : activeTab === 'jobs' ? (
      <Jobs
        locale={props.locale}
        model={model}
        {...(props.onCancelJob === undefined ? {} : { onCancel: props.onCancelJob })}
      />
    ) : model.records.length === 0 ? (
      <EmptyState>
        <div>
          <strong>{model.firstUse ? labels.firstUse : labels.empty}</strong>
          <p>{labels.emptyAction}</p>
        </div>
      </EmptyState>
    ) : (
      <QueueTable
        locale={props.locale}
        model={model}
        onOpen={openRecord}
        onSort={(field) => {
          setState({
            sort: {
              direction:
                model.urlState.sort.field === field && model.urlState.sort.direction === 'desc'
                  ? 'asc'
                  : 'desc',
              field,
            },
          });
        }}
      />
    );
  return (
    <article
      className={styles['canvas']}
      data-density={model.urlState.density}
      data-queue-state={model.authority.state}
    >
      <header className={styles['routeHeader']}>
        <div>
          <h1>{labels.title}</h1>
          <p>{labels.description}</p>
        </div>
        <span className={styles['freshness']} role="status" data-state={model.authority.state}>
          <span aria-hidden="true" />
          {model.authority.state}
        </span>
      </header>
      {notice === null ? null : (
        <LbOperationalNotice detail={notice.detail} state={notice.state} title={notice.title} />
      )}
      {props.mutationFeedback?.status === 'conflict' ? (
        <LbOperationalNotice
          detail={labels.mutateBlocked}
          state="stale"
          title={localeConflict(props.locale)}
        />
      ) : null}
      <section className={styles['toolbar']} aria-label={labels.filters}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const searchValue = data.get('queue-search');
            setState({
              page: 1,
              query: typeof searchValue === 'string' ? searchValue : '',
              tab: 'search',
            });
          }}
        >
          <LbSearchField
            defaultValue={model.urlState.query}
            label={labels.searchLabel}
            maxLength={160}
            name="queue-search"
            placeholder={labels.searchPlaceholder}
          />
          <LbButton type="submit" variant="primary">
            {labels.search}
          </LbButton>
        </form>
        <label>
          <span>{labels.statusFilter}</span>
          <select
            value={
              model.urlState.filters.find((item) => item.startsWith('status:'))?.slice(7) ?? 'all'
            }
            onChange={(event) => {
              setState({
                filters:
                  event.currentTarget.value === 'all'
                    ? []
                    : [`status:${event.currentTarget.value}`],
                page: 1,
              });
            }}
          >
            <option value="all">{localeAll(props.locale)}</option>
            <option value="open">open</option>
            <option value="waiting">waiting</option>
            <option value="blocked">blocked</option>
            <option value="completed">completed</option>
          </select>
        </label>
        <div className={styles['density']} role="group" aria-label={labels.density}>
          <LbButton
            onPress={() => {
              setState({ density: 'comfortable' });
            }}
            variant={model.urlState.density === 'comfortable' ? 'primary' : 'quiet'}
          >
            {labels.comfortable}
          </LbButton>
          <LbButton
            onPress={() => {
              setState({ density: 'compact' });
            }}
            variant={model.urlState.density === 'compact' ? 'primary' : 'quiet'}
          >
            {labels.compact}
          </LbButton>
        </div>
      </section>
      <nav className={styles['tabs']} aria-label={labels.title}>
        {(['queue', 'search', 'views', 'inbox', 'jobs'] as const).map((tab) => (
          <a
            key={tab}
            aria-current={activeTab === tab ? 'page' : undefined}
            href={createQueueHref(model.basePath, { ...model.urlState, page: 1, tab })}
            onClick={(event) => {
              event.preventDefault();
              setState({ page: 1, tab });
            }}
          >
            {tabCopy(props.locale)[tab]}
          </a>
        ))}
      </nav>
      <div
        className={styles['workspace']}
        data-inspector-open={selectedRecord !== undefined || undefined}
      >
        <section className={styles['workSurface']} aria-labelledby="queue-results-title">
          <header className={styles['sectionHeader']}>
            <div>
              <h2 id="queue-results-title">{tabCopy(props.locale)[activeTab]}</h2>
              <p>
                {model.records.length} {labels.resultCount}
              </p>
            </div>
            <span>
              {labels.updated}: {formatDate(model.observedAt, props.locale, '—')}
            </span>
          </header>
          {body}
          <footer className={styles['pagination']}>
            <LbButton
              isDisabled={model.urlState.page <= 1}
              onPress={() => {
                setState({ page: Math.max(1, model.urlState.page - 1) });
              }}
              variant="quiet"
            >
              {labels.previous}
            </LbButton>
            <span>
              {labels.page} {model.urlState.page}
            </span>
            <LbButton
              isDisabled={model.nextCursor === null}
              onPress={() => {
                setState({ cursor: model.nextCursor ?? undefined, page: model.urlState.page + 1 });
              }}
              variant="quiet"
            >
              {labels.next}
            </LbButton>
          </footer>
        </section>
        {selectedRecord === undefined ? null : (
          <aside className={styles['inspector']} aria-labelledby="queue-inspector-title">
            <header>
              <div>
                <span>{labels.inspector}</span>
                <h2 id="queue-inspector-title">{selectedRecord.summary}</h2>
              </div>
              <LbButton
                ariaLabel={labels.closeInspector}
                onPress={() => {
                  setSelectedId(undefined);
                  setState({ selectedId: undefined });
                  requestAnimationFrame(() => opener.current?.focus());
                }}
                variant="quiet"
              >
                <ProductIcon name="close" size={18} />
              </LbButton>
            </header>
            <dl>
              <div>
                <dt>{labels.reference}</dt>
                <dd>
                  <code>{selectedRecord.id}</code>
                </dd>
              </div>
              <div>
                <dt>{labels.state}</dt>
                <dd>{selectedRecord.state}</dd>
              </div>
              <div>
                <dt>{labels.owner}</dt>
                <dd>{selectedRecord.ownerReference ?? labels.noOwner}</dd>
              </div>
              <div>
                <dt>{labels.deadline}</dt>
                <dd>{formatDate(selectedRecord.deadlineAt, props.locale, labels.noDeadline)}</dd>
              </div>
              <div>
                <dt>{labels.version}</dt>
                <dd>{selectedRecord.version}</dd>
              </div>
            </dl>
            <p>{model.authority.canMutate ? selectedRecord.kind : labels.mutateBlocked}</p>
            <a href={selectedRecord.href}>{localeFullRoute(props.locale)}</a>
          </aside>
        )}
      </div>
    </article>
  );
};

const localeAll = (locale: WebLocale): string => (locale === 'pt-BR' ? 'Todos' : 'All');
const localeConflict = (locale: WebLocale): string =>
  locale === 'pt-BR' ? 'Conflito de versão' : 'Version conflict';
const localeFullRoute = (locale: WebLocale): string =>
  locale === 'pt-BR' ? 'Abrir rota completa' : 'Open full route';

const onlineRecords = (result: AdminQueryResult): readonly AdminAuthorityDocument[] =>
  result.status === 'online' ? result.records : [];

export const AdminQueueCanvas = ({
  initialSelectedId,
  locale,
}: Readonly<{ initialSelectedId?: string; locale: WebLocale }>) => {
  const { authority, freshness, revision, session } = useAdminAuthority();
  const basePath = `/${locale}/admin/operation`;
  const [urlState, setUrlState] = useState<QueueUrlState>(() => {
    const parsed = parseQueueUrlState(
      typeof window === 'undefined'
        ? new URLSearchParams()
        : new URLSearchParams(window.location.search),
    );
    return initialSelectedId === undefined
      ? parsed
      : Object.freeze({ ...parsed, selectedId: initialSelectedId });
  });
  const [results, setResults] = useState<Readonly<{
    briefing: AdminQueryResult;
    jobs: AdminQueryResult;
    search: AdminQueryResult;
  }> | null>(null);
  const [invalidated, setInvalidated] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [mutationFeedback, setMutationFeedback] = useState<AdminMutationResult | null>(null);
  useEffect(() => {
    if (freshness !== 'live') setInvalidated(true);
  }, [freshness]);
  useEffect(() => {
    if (session === null || session === undefined) return undefined;
    const controller = new AbortController();
    void Promise.all([
      authority.query('search', {
        environment: 'staging',
        limit: 50,
        query: urlState.query,
        signal: controller.signal,
      }),
      authority.query('briefing', { environment: 'staging', limit: 50, signal: controller.signal }),
      authority.query('jobs', { environment: 'staging', limit: 50, signal: controller.signal }),
    ]).then(([search, briefing, jobs]) => {
      if (controller.signal.aborted) return;
      setResults(Object.freeze({ briefing, jobs, search }));
      if ([search, briefing, jobs].some((result) => result.status === 'online'))
        setInvalidated(false);
    });
    return () => {
      controller.abort();
    };
  }, [authority, refresh, revision, session, urlState.query]);
  const model = useMemo<QueueCanvasModel | null>(() => {
    if (results === null || session === null || session === undefined) return null;
    const briefing = onlineRecords(results.briefing);
    const jobRecords = onlineRecords(results.jobs);
    const searchRecords = onlineRecords(results.search);
    const failures = (Object.entries(results) as readonly [string, AdminQueryResult][])
      .filter(([, result]) => result.status !== 'online')
      .map(([family]) => family);
    const authorityState = deriveQueueAuthorityState({ freshness, invalidated });
    const savedViews = briefing.filter(isSavedView).map((view) =>
      Object.freeze({
        aggregateVersion: view.aggregateVersion,
        ownerReference: view.visibility === 'personal' ? session.actorId : undefined,
        savedViewId: view.savedViewId,
        visibility: view.visibility,
      }),
    );
    const projectedAuthority: QueueAuthorityState =
      failures.length > 0 && authorityState.state === 'live'
        ? Object.freeze({ canMutate: false, requiresRefetch: true, state: 'degraded' })
        : authorityState;
    return Object.freeze({
      authority: projectedAuthority,
      basePath,
      degradedFamilies: Object.freeze(failures),
      firstUse: searchRecords.length === 0 && briefing.length === 0 && jobRecords.length === 0,
      inbox: Object.freeze(briefing.filter(isInboxItem)),
      jobs: Object.freeze(jobRecords.filter(isJob).map(projectQueueJob)),
      nextCursor: results.search.status === 'online' ? results.search.nextCursor : null,
      ...(results.search.status === 'online' && results.search.freshness?.observedAt
        ? { observedAt: results.search.freshness.observedAt }
        : {}),
      records: Object.freeze(
        searchRecords
          .filter((record) => !isSavedView(record) && !isInboxItem(record) && !isJob(record))
          .map((record) => projectRecord(record, basePath, urlState)),
      ),
      savedViews: Object.freeze(savedViews),
      urlState,
    });
  }, [basePath, freshness, invalidated, results, session, urlState]);
  if (results !== null && Object.values(results).every((result) => result.status !== 'online')) {
    const failure = Object.values(results).find((result) => result.status !== 'online');
    const errorCode = failure?.code;
    return (
      <AdminQueueCanvasView
        {...(errorCode === undefined ? {} : { errorCode })}
        locale={locale}
        state="error"
      />
    );
  }
  if (model === null) return <AdminQueueCanvasView locale={locale} state="loading" />;
  const updateState = (next: QueueUrlState) => {
    setUrlState(next);
    window.history.replaceState(window.history.state, '', createQueueHref(basePath, next));
  };
  return (
    <AdminQueueCanvasView
      locale={locale}
      model={model}
      mutationFeedback={mutationFeedback}
      onCancelJob={(job) => {
        if (!model.authority.canMutate) return;
        void authority
          .mutate({
            expectedVersion: job.aggregateVersion,
            family: 'transition-job',
            idempotencyKey: crypto.randomUUID(),
            payload: { transition: 'cancelled' },
            targetId: job.jobId,
          })
          .then((result) => {
            setMutationFeedback(result);
            if (result.status === 'complete' || result.status === 'partial')
              setRefresh((value) => value + 1);
          });
      }}
      onStateChange={updateState}
      state="ready"
    />
  );
};
