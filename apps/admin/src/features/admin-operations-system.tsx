'use client';

import type {
  AdminAlertProjectionJson,
  AdminAuditEventProjectionJson,
  AdminCapacityProjectionJson,
  AdminConfigurationProjectionJson,
  AdminEmergencyStopProjectionJson,
  AdminEnvironmentProjectionJson,
  AdminExportProjectionJson,
  AdminIncidentProjectionJson,
  AdminJobProjectionJson,
  AdminPrivacyCaseProjectionJson,
} from '@liiiraa/contracts-ts';
import {
  LbButton,
  LbCheckbox,
  LbOperationalNotice,
  LbProgress,
  LbSkeletonRegion,
  LbTextArea,
  LbTextField,
  ProductIcon,
} from '@liiiraa/design-system';
import type { WebLocale } from '@liiiraa/web-core';
import { useEffect, useMemo, useRef, useState } from 'react';

import type {
  AdminAuthorityDocument,
  AdminMutationInput,
  AdminMutationResult,
  AdminQueryFamily,
  AdminQueryResult,
} from '../admin-authority';
import { useAdminAuthority } from './admin-authority';
import { projectCapacityAuthority, projectOperationalJob } from './admin-operations-system-model';
import styles from './admin-operations-system.module.css';

export type OperationsSystemSurface = 'operation' | 'security' | 'system';

export type OperationsSystemModel = Readonly<{
  alerts: readonly AdminAlertProjectionJson[];
  audit: readonly AdminAuditEventProjectionJson[];
  authority: Readonly<{
    canMutate: boolean;
    observedAt?: string;
    state: 'live' | 'reconnecting' | 'offline' | 'degraded';
  }>;
  capacity: readonly AdminCapacityProjectionJson[];
  configurations: readonly AdminConfigurationProjectionJson[];
  emergencyStops: readonly AdminEmergencyStopProjectionJson[];
  environments: readonly AdminEnvironmentProjectionJson[];
  exports: readonly AdminExportProjectionJson[];
  incidents: readonly AdminIncidentProjectionJson[];
  jobs: readonly AdminJobProjectionJson[];
  privacyCases: readonly AdminPrivacyCaseProjectionJson[];
  surface: OperationsSystemSurface;
}>;

type ViewProps =
  | Readonly<{ locale: WebLocale; state: 'loading'; surface: OperationsSystemSurface }>
  | Readonly<{
      code?: string;
      locale: WebLocale;
      state: 'error';
      surface: OperationsSystemSurface;
    }>
  | Readonly<{
      locale: WebLocale;
      model: OperationsSystemModel;
      mutation?: AdminMutationResult | null;
      onMutate?: (input: AdminMutationInput) => void;
      onRefresh?: () => void;
      state: 'ready';
    }>;

const txt = (locale: WebLocale, pt: string, en: string): string => (locale === 'pt-BR' ? pt : en);

const surfaceCopy = (locale: WebLocale, surface: OperationsSystemSurface) => {
  if (surface === 'operation')
    return {
      description: txt(
        locale,
        'Trabalhos duráveis, exportações, configurações e capacidade com autoridade explícita.',
        'Durable jobs, exports, configuration, and capacity with explicit authority.',
      ),
      title: txt(locale, 'Operação', 'Operation'),
    };
  if (surface === 'security')
    return {
      description: txt(
        locale,
        'Incidentes, alertas, recuperação, privacidade e contenção sem execução arbitrária.',
        'Incidents, alerts, recovery, privacy, and containment without arbitrary execution.',
      ),
      title: txt(locale, 'Segurança', 'Security'),
    };
  return {
    description: txt(
      locale,
      'Ambientes, versões, integridade operacional, auditoria e limites seguros.',
      'Environments, versions, operational integrity, audit, and safe limits.',
    ),
    title: txt(locale, 'Sistema', 'System'),
  };
};

const formatDate = (value: string | undefined, locale: WebLocale): string => {
  if (value === undefined) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(date);
};

const stateLabel = (value: string): string => value.replaceAll('-', ' ');

const mutationDocumentReference = (document: AdminAuthorityDocument): string => {
  if ('receiptId' in document) return document.receiptId;
  if ('etag' in document && typeof document.etag === 'string') return document.etag;
  return document.kind;
};

const isKind = <Kind extends AdminAuthorityDocument['kind']>(
  document: AdminAuthorityDocument,
  kind: Kind,
): document is Extract<AdminAuthorityDocument, Readonly<{ kind: Kind }>> => document.kind === kind;

const documents = <Kind extends AdminAuthorityDocument['kind']>(
  result: AdminQueryResult,
  kind: Kind,
): readonly Extract<AdminAuthorityDocument, Readonly<{ kind: Kind }>>[] =>
  result.status === 'online'
    ? result.records.filter((record): record is Extract<AdminAuthorityDocument, { kind: Kind }> =>
        isKind(record, kind),
      )
    : [];

const authorityNotice = (locale: WebLocale, state: OperationsSystemModel['authority']['state']) => {
  if (state === 'live') return null;
  if (state === 'reconnecting')
    return {
      detail: txt(
        locale,
        'A leitura permanece disponível, mas toda mutação aguarda a projeção canônica.',
        'Reading remains available, but every mutation waits for the canonical projection.',
      ),
      state: 'reconnecting' as const,
      title: txt(locale, 'Reconectando à autoridade', 'Reconnecting to authority'),
    };
  return {
    detail: txt(
      locale,
      'Nenhuma ação crítica será enfileirada em segredo. Atualize a autoridade antes de agir.',
      'No critical action will be secretly queued. Refresh authority before acting.',
    ),
    state: 'degraded' as const,
    title: txt(locale, 'Controles em modo somente leitura', 'Controls are read-only'),
  };
};

const SummaryLedger = ({
  locale,
  model,
}: Readonly<{ locale: WebLocale; model: OperationsSystemModel }>) => {
  const facts =
    model.surface === 'operation'
      ? [
          [
            txt(locale, 'Em andamento', 'In progress'),
            model.jobs.filter((job) => ['queued', 'running', 'paused'].includes(job.state)).length,
          ],
          [
            txt(locale, 'Falhas parciais', 'Partial failures'),
            model.jobs.filter((job) => job.state === 'partial' || job.state === 'failed').length,
          ],
          [txt(locale, 'Configurações', 'Configurations'), model.configurations.length],
        ]
      : model.surface === 'security'
        ? [
            [
              txt(locale, 'Incidentes abertos', 'Open incidents'),
              model.incidents.filter((incident) => incident.state !== 'resolved').length,
            ],
            [
              txt(locale, 'Alertas ativos', 'Active alerts'),
              model.alerts.filter((alert) => alert.state === 'open' || alert.state === 'failed')
                .length,
            ],
            [
              txt(locale, 'Contenções ativas', 'Active containment'),
              model.emergencyStops.filter((stop) => stop.state === 'active').length,
            ],
          ]
        : [
            [txt(locale, 'Ambientes', 'Environments'), model.environments.length],
            [txt(locale, 'Eventos de auditoria', 'Audit events'), model.audit.length],
            [txt(locale, 'Limites observados', 'Observed limits'), model.capacity.length],
          ];
  return (
    <section
      className={styles['summary']}
      aria-label={txt(locale, 'Resumo operacional', 'Operational summary')}
    >
      {facts.map(([label, value]) => (
        <div key={String(label)}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </section>
  );
};

type SelectedRecord =
  | AdminJobProjectionJson
  | AdminIncidentProjectionJson
  | AdminConfigurationProjectionJson
  | AdminPrivacyCaseProjectionJson
  | AdminEmergencyStopProjectionJson;

const recordId = (record: SelectedRecord): string => {
  if (record.kind === 'admin-job-projection') return record.jobId;
  if (record.kind === 'admin-incident-projection') return record.incidentId;
  if (record.kind === 'admin-configuration-projection') return record.configurationId;
  if (record.kind === 'admin-privacy-case-projection') return record.privacyCaseId;
  return record.stopId;
};

const RiskAction = ({
  locale,
  model,
  onMutate,
  record,
}: Readonly<{
  locale: WebLocale;
  model: OperationsSystemModel;
  onMutate?: (input: AdminMutationInput) => void;
  record: SelectedRecord;
}>) => {
  const [reason, setReason] = useState('');
  const [reviewed, setReviewed] = useState(false);
  const [capability, setCapability] = useState('invitation-delivery');
  const valid = reason.trim().length >= 8 && reviewed && model.authority.canMutate;
  const submit = () => {
    if (!valid) return;
    const idempotencyKey = crypto.randomUUID();
    if (record.kind === 'admin-job-projection') {
      const projected = projectOperationalJob({
        completedItems: record.completedItems,
        failedItems: record.failedItems,
        freshness: record.freshness.state,
        progressPercent: record.progressPercent,
        ...(record.receiptReference === undefined
          ? {}
          : { receiptReference: record.receiptReference }),
        state: record.state,
        totalItems: record.totalItems,
      });
      const transition = projected.nextTransitions[0];
      if (transition === undefined) return;
      onMutate?.({
        expectedVersion: record.aggregateVersion,
        family: 'transition-job',
        idempotencyKey,
        payload: {
          connection: 'connected',
          lastUpdatedAt: record.freshness.observedAt,
          safeCancellation: transition === 'cancel',
          targetEnvironment: record.environment.kind,
          transition,
        },
        reason,
        targetId: record.jobId,
      });
      return;
    }
    if (record.kind === 'admin-incident-projection') {
      onMutate?.({
        expectedVersion: record.aggregateVersion,
        family: 'recover-incident',
        idempotencyKey,
        payload: {
          boundedOperation: true,
          compensationDefined: true,
          deadline: record.nextUpdateAt,
          ownerAvailable: true,
          ownerId: record.ownerReference,
          previewed: true,
          procedureVersion: record.affectedCapabilities[0],
          rehearsed: true,
          riskApproved: true,
          severity: record.severity === 'critical' ? 'critical' : 'high',
          substituteId: record.substituteReference,
          targetEnvironment: record.environment.kind,
          validationDefined: true,
        },
        reason,
        targetId: record.incidentId,
      });
      return;
    }
    if (record.kind === 'admin-configuration-projection') {
      const transition = record.rollbackVersion === undefined ? 'publish' : 'rollback';
      onMutate?.({
        expectedVersion: record.aggregateVersion,
        family: 'transition-configuration',
        idempotencyKey,
        payload: {
          approved: true,
          impactReviewed: true,
          integrationEnvironment: record.environment.kind,
          productionStrongAccess: false,
          ...(record.rollbackVersion === undefined
            ? {}
            : { rollbackVersion: record.rollbackVersion }),
          sessionEnvironment: record.environment.kind,
          targetEnvironment: record.environment.kind,
          transition,
          validated: true,
        },
        reason,
        targetId: record.configurationId,
      });
      return;
    }
    if (record.kind === 'admin-privacy-case-projection') {
      onMutate?.({
        expectedVersion: record.aggregateVersion,
        family: 'execute-privacy',
        idempotencyKey,
        payload: {
          approved: true,
          dataDiscovered: true,
          executionDefined: true,
          finalReceiptRequired: true,
          identityVerified: true,
          impactReviewed: true,
          legalBasis: reason,
          mandatoryRetentionReviewed: true,
          targetEnvironment: record.environment.kind,
        },
        reason,
        targetId: record.privacyCaseId,
      });
      return;
    }
    const now = model.authority.observedAt ?? record.freshness.observedAt;
    onMutate?.({
      expectedVersion: record.aggregateVersion,
      family: 'emergency-stop',
      idempotencyKey,
      payload: {
        capability,
        expiresAt: new Date(Date.parse(now) + 15 * 60 * 1_000).toISOString(),
        safeRestorationDefined: true,
        strongAuth: true,
        targetEnvironment: record.environment.kind,
      },
      reason,
      targetId: record.stopId,
    });
  };
  const action =
    record.kind === 'admin-job-projection'
      ? txt(locale, 'Executar próxima transição', 'Run next transition')
      : record.kind === 'admin-incident-projection'
        ? txt(locale, 'Iniciar recuperação selecionada', 'Start selected recovery')
        : record.kind === 'admin-configuration-projection'
          ? txt(locale, 'Aplicar transição versionada', 'Apply versioned transition')
          : record.kind === 'admin-privacy-case-projection'
            ? txt(locale, 'Executar caso de privacidade', 'Execute privacy case')
            : txt(locale, 'Conter capacidade', 'Contain capability');
  return (
    <section className={styles['riskAction']} aria-labelledby="operations-risk-title">
      <header>
        <ProductIcon name="shield" size={20} />
        <div>
          <h3 id="operations-risk-title">{action}</h3>
          <p>
            {txt(
              locale,
              'Prévia, impacto, validação e recibo são obrigatórios.',
              'Preview, impact, validation, and receipt are required.',
            )}
          </p>
        </div>
      </header>
      {record.kind === 'admin-emergency-stop-projection' ? (
        <LbTextField
          label={txt(locale, 'Capacidade específica', 'Specific capability')}
          maxLength={128}
          onChange={setCapability}
          value={capability}
        />
      ) : null}
      <LbTextArea
        isRequired
        label={txt(locale, 'Motivo auditável', 'Auditable reason')}
        maxLength={512}
        onChange={setReason}
        value={reason}
      />
      <LbCheckbox isSelected={reviewed} onChange={setReviewed}>
        {txt(
          locale,
          'Revisei o escopo, o impacto e o caminho de restauração',
          'I reviewed scope, impact, and the restoration path',
        )}
      </LbCheckbox>
      <LbButton isDisabled={!valid} onPress={submit} variant="primary">
        {action}
      </LbButton>
    </section>
  );
};

const RecordList = ({
  label,
  locale,
  onSelect,
  records,
}: Readonly<{
  label: string;
  locale: WebLocale;
  onSelect: (record: SelectedRecord, trigger: HTMLButtonElement) => void;
  records: readonly SelectedRecord[];
}>) => (
  <section className={styles['ledger']} aria-labelledby={`${label.replaceAll(' ', '-')}-title`}>
    <header>
      <div>
        <h2 id={`${label.replaceAll(' ', '-')}-title`}>{label}</h2>
        <p>
          {txt(
            locale,
            'Abra um registro para revisar evidência e ações permitidas.',
            'Open a record to review evidence and permitted actions.',
          )}
        </p>
      </div>
      <span>{records.length}</span>
    </header>
    {records.length === 0 ? (
      <div className={styles['empty']}>
        <ProductIcon name="check" size={22} />
        <p>
          {txt(
            locale,
            'Nenhum registro autorizado nesta visão.',
            'No authorized records in this view.',
          )}
        </p>
      </div>
    ) : (
      <ul>
        {records.map((record) => {
          const id = recordId(record);
          const state = 'state' in record ? record.state : 'available';
          const observedAt = record.freshness.observedAt;
          return (
            <li key={`${record.kind}-${id}`}>
              <button
                type="button"
                onClick={(event) => {
                  onSelect(record, event.currentTarget);
                }}
              >
                <span>
                  <code>{id}</code>
                  <small>{record.kind.replace('admin-', '').replace('-projection', '')}</small>
                </span>
                <span className={styles['state']} data-state={state}>
                  {stateLabel(state)}
                </span>
                <time dateTime={observedAt}>{formatDate(observedAt, locale)}</time>
                <ProductIcon name="chevronRight" size={16} />
              </button>
            </li>
          );
        })}
      </ul>
    )}
  </section>
);

const CapacityLedger = ({
  locale,
  rows,
}: Readonly<{ locale: WebLocale; rows: readonly AdminCapacityProjectionJson[] }>) => (
  <section className={styles['capacity']} aria-labelledby="capacity-ledger-title">
    <header>
      <ProductIcon name="gauge" size={20} />
      <h2 id="capacity-ledger-title">{txt(locale, 'Capacidade', 'Capacity')}</h2>
    </header>
    {rows.length === 0 ? (
      <p>{txt(locale, 'Sem amostras autorizadas.', 'No authorized samples.')}</p>
    ) : (
      <ul>
        {rows.map((row) => {
          const authority = projectCapacityAuthority({
            currentUse: Number(row.currentUse),
            ...(row.forecastExhaustionAt === undefined
              ? {}
              : {
                  forecastExhaustionAt: row.forecastExhaustionAt,
                  growthPerDay: row.growthPerDay ?? 0,
                }),
            observedAt: row.observedAt,
            safeLimit: Number(row.safeLimit),
          });
          return (
            <li key={row.capacityId} data-state={authority.state}>
              <div>
                <strong>{row.resourceReference}</strong>
                <span>
                  {authority.currentUse} / {authority.safeLimit}
                </span>
              </div>
              <LbProgress
                label={txt(locale, 'Uso seguro', 'Safe use')}
                maxValue={authority.safeLimit}
                value={authority.currentUse}
              />
              <small>{stateLabel(authority.recommendedAction)}</small>
            </li>
          );
        })}
      </ul>
    )}
  </section>
);

const ExportLedger = ({
  locale,
  rows,
}: Readonly<{ locale: WebLocale; rows: readonly AdminExportProjectionJson[] }>) => (
  <section className={styles['exports']} aria-labelledby="exports-ledger-title">
    <header>
      <div>
        <h2 id="exports-ledger-title">
          {txt(locale, 'Exportações protegidas', 'Protected exports')}
        </h2>
        <p>
          {txt(
            locale,
            'Somente estado, escopo mascarado e validade deixam a autoridade.',
            'Only state, masked scope, and validity leave authority.',
          )}
        </p>
      </div>
      <span>{rows.length}</span>
    </header>
    {rows.length === 0 ? (
      <div className={styles['empty']}>
        <ProductIcon name="check" size={22} />
        <p>
          {txt(
            locale,
            'Nenhuma exportação autorizada nesta visão.',
            'No authorized exports in this view.',
          )}
        </p>
      </div>
    ) : (
      <ol>
        {rows.map((row) => (
          <li key={row.exportId}>
            <div>
              <code>{row.exportId}</code>
              <span className={styles['state']} data-state={row.state}>
                {stateLabel(row.state)}
              </span>
            </div>
            <strong>{row.fieldReferences.join(' · ')}</strong>
            <span>{txt(locale, 'Criptografada e mascarada', 'Encrypted and masked')}</span>
            <time dateTime={row.expiresAt}>
              {txt(locale, 'Expira', 'Expires')} {formatDate(row.expiresAt, locale)}
            </time>
          </li>
        ))}
      </ol>
    )}
  </section>
);

const SystemEvidence = ({
  locale,
  model,
}: Readonly<{ locale: WebLocale; model: OperationsSystemModel }>) => (
  <div className={styles['evidenceGrid']}>
    <section className={styles['environment']} aria-labelledby="environment-title">
      <header>
        <ProductIcon name="database" size={20} />
        <h2 id="environment-title">
          {txt(locale, 'Ambientes e saúde', 'Environments and health')}
        </h2>
      </header>
      <ul>
        {model.environments.map((row) => (
          <li key={row.environmentReference}>
            <div>
              <strong>{row.environmentReference}</strong>
              <span>
                {row.sessionEnvironment} · {row.integrationEnvironment}
              </span>
            </div>
            <span className={styles['state']} data-state={row.health}>
              {stateLabel(row.health)}
            </span>
          </li>
        ))}
      </ul>
    </section>
    <section className={styles['audit']} aria-labelledby="audit-title">
      <header>
        <ProductIcon name="history" size={20} />
        <h2 id="audit-title">{txt(locale, 'Auditoria imutável', 'Immutable audit')}</h2>
      </header>
      <ol>
        {model.audit.slice(0, 12).map((event) => (
          <li key={event.auditEventId}>
            <code>{event.auditEventId}</code>
            <strong>{event.action}</strong>
            <span>
              {event.scope} · {event.outcome}
            </span>
            <time dateTime={event.occurredAt}>{formatDate(event.occurredAt, locale)}</time>
          </li>
        ))}
      </ol>
    </section>
  </div>
);

export const AdminOperationsSystemView = (props: ViewProps) => {
  const inspector = useRef<HTMLElement | null>(null);
  const selectedTrigger = useRef<HTMLButtonElement | null>(null);
  const [selected, setSelected] = useState<SelectedRecord>();
  useEffect(() => {
    if (selected === undefined) return;
    const frame = requestAnimationFrame(() => {
      inspector.current?.focus();
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [selected]);
  const labels = surfaceCopy(
    props.locale,
    props.state === 'ready' ? props.model.surface : props.surface,
  );
  if (props.state === 'loading')
    return (
      <article className={styles['route']} data-state="loading">
        <header className={styles['routeHeader']}>
          <div>
            <h1>{labels.title}</h1>
            <p>{labels.description}</p>
          </div>
        </header>
        <LbSkeletonRegion
          label={txt(
            props.locale,
            'Carregando controles operacionais',
            'Loading operational controls',
          )}
          rows={10}
        />
      </article>
    );
  if (props.state === 'error')
    return (
      <article className={styles['route']} data-state="error">
        <header className={styles['routeHeader']}>
          <div>
            <h1>{labels.title}</h1>
            <p>{labels.description}</p>
          </div>
        </header>
        <LbOperationalNotice
          detail={`${txt(props.locale, 'A sessão não recebeu esta coleção. Nenhuma existência foi revelada.', 'The session was not admitted to this collection. No existence was disclosed.')} ${props.code ?? ''}`}
          state="degraded"
          title={txt(props.locale, 'Autoridade indisponível', 'Authority unavailable')}
        />
      </article>
    );
  const { model } = props;
  const notice = authorityNotice(props.locale, model.authority.state);
  const primaryRecords: readonly SelectedRecord[] =
    model.surface === 'operation'
      ? [...model.jobs, ...model.configurations]
      : model.surface === 'security'
        ? [...model.incidents, ...model.privacyCases, ...model.emergencyStops]
        : [...model.configurations];
  const closeInspector = () => {
    setSelected(undefined);
    requestAnimationFrame(() => selectedTrigger.current?.focus());
  };
  return (
    <article
      className={styles['route']}
      data-state={model.authority.state}
      data-surface={model.surface}
    >
      <header className={styles['routeHeader']}>
        <div>
          <h1>{labels.title}</h1>
          <p>{labels.description}</p>
        </div>
        <div className={styles['freshness']} data-state={model.authority.state}>
          <span aria-hidden="true" />
          <strong>{stateLabel(model.authority.state)}</strong>
          <small>{formatDate(model.authority.observedAt, props.locale)}</small>
        </div>
      </header>
      {notice === null ? null : (
        <LbOperationalNotice
          action={
            <LbButton onPress={() => props.onRefresh?.()} variant="secondary">
              {txt(props.locale, 'Atualizar', 'Refresh')}
            </LbButton>
          }
          detail={notice.detail}
          state={notice.state}
          title={notice.title}
        />
      )}
      {props.mutation?.status === 'conflict' ? (
        <LbOperationalNotice
          detail={txt(
            props.locale,
            'O rascunho local foi preservado para reconciliação deliberada.',
            'The local draft was preserved for deliberate reconciliation.',
          )}
          state="conflict"
          title={txt(props.locale, 'Conflito de versão', 'Version conflict')}
        />
      ) : null}
      {props.mutation?.status === 'complete' && 'document' in props.mutation ? (
        <section className={styles['receipt']} role="status">
          <ProductIcon name="receipt" size={22} />
          <div>
            <strong>{txt(props.locale, 'Operação registrada', 'Operation recorded')}</strong>
            <code>{mutationDocumentReference(props.mutation.document)}</code>
            <span>
              {txt(
                props.locale,
                'A projeção será atualizada pela autoridade.',
                'The projection will be refreshed by authority.',
              )}
            </span>
          </div>
        </section>
      ) : null}
      <SummaryLedger locale={props.locale} model={model} />
      <div
        className={styles['workspace']}
        data-inspector-open={selected !== undefined || undefined}
      >
        <div className={styles['main']}>
          {model.surface === 'system' ? (
            <SystemEvidence locale={props.locale} model={model} />
          ) : (
            <RecordList
              label={
                model.surface === 'operation'
                  ? txt(props.locale, 'Fila operacional', 'Operational queue')
                  : txt(props.locale, 'Incidentes e controles', 'Incidents and controls')
              }
              locale={props.locale}
              onSelect={(record, trigger) => {
                selectedTrigger.current = trigger;
                setSelected(record);
              }}
              records={primaryRecords}
            />
          )}
          {model.surface === 'security' ? (
            <section className={styles['alerts']} aria-labelledby="alerts-title">
              <header>
                <ProductIcon name="bell" size={20} />
                <h2 id="alerts-title">{txt(props.locale, 'Alertas seguros', 'Safe alerts')}</h2>
              </header>
              <ul>
                {model.alerts.map((alert) => (
                  <li key={alert.alertId}>
                    <strong>{alert.safeSummary}</strong>
                    <span className={styles['state']} data-state={alert.state}>
                      {stateLabel(alert.state)}
                    </span>
                    <code>{alert.subjectReference}</code>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {model.surface === 'operation' ? (
            <ExportLedger locale={props.locale} rows={model.exports} />
          ) : null}
          {model.surface === 'security' ? null : (
            <CapacityLedger locale={props.locale} rows={model.capacity} />
          )}
        </div>
        {selected === undefined ? null : (
          <aside
            className={styles['inspector']}
            aria-label={txt(props.locale, 'Detalhes do registro', 'Record details')}
            ref={inspector}
            tabIndex={-1}
          >
            <header>
              <div>
                <span>{selected.kind}</span>
                <h2>{recordId(selected)}</h2>
              </div>
              <LbButton onPress={closeInspector} variant="quiet">
                {txt(props.locale, 'Fechar detalhes', 'Close details')}
              </LbButton>
            </header>
            <dl>
              <div>
                <dt>{txt(props.locale, 'Versão', 'Version')}</dt>
                <dd>{selected.aggregateVersion}</dd>
              </div>
              <div>
                <dt>{txt(props.locale, 'Ambiente', 'Environment')}</dt>
                <dd>{selected.environment.kind}</dd>
              </div>
              <div>
                <dt>{txt(props.locale, 'Atualização', 'Updated')}</dt>
                <dd>{formatDate(selected.freshness.observedAt, props.locale)}</dd>
              </div>
              <div>
                <dt>{txt(props.locale, 'Origem', 'Source')}</dt>
                <dd>{selected.provenance}</dd>
              </div>
            </dl>
            <RiskAction
              locale={props.locale}
              model={model}
              {...(props.onMutate === undefined ? {} : { onMutate: props.onMutate })}
              record={selected}
            />
          </aside>
        )}
      </div>
    </article>
  );
};

const queryFamiliesBySurface = Object.freeze({
  operation: Object.freeze([
    'jobs',
    'exports',
    'configurations',
    'capacity',
  ] as const satisfies readonly AdminQueryFamily[]),
  security: Object.freeze([
    'incidents',
    'alerts',
    'privacy',
    'emergency',
  ] as const satisfies readonly AdminQueryFamily[]),
  system: Object.freeze([
    'environments',
    'audit',
    'configurations',
    'capacity',
  ] as const satisfies readonly AdminQueryFamily[]),
});

export const AdminOperationsSystem = ({
  locale,
  surface,
}: Readonly<{ locale: WebLocale; surface: OperationsSystemSurface }>) => {
  const { authority, freshness, revision, session } = useAdminAuthority();
  const [results, setResults] = useState<
    Readonly<Partial<Record<AdminQueryFamily, AdminQueryResult>>>
  >({});
  const [loadedSurface, setLoadedSurface] = useState<OperationsSystemSurface>();
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [mutation, setMutation] = useState<AdminMutationResult | null>(null);
  useEffect(() => {
    if (session === null || session === undefined) return undefined;
    const controller = new AbortController();
    setLoading(true);
    void Promise.all(
      queryFamiliesBySurface[surface].map(
        async (family) =>
          [
            family,
            await authority.query(family, {
              environment: 'staging',
              limit: 50,
              signal: controller.signal,
            }),
          ] as const,
      ),
    ).then((entries) => {
      if (!controller.signal.aborted) {
        setResults(Object.freeze(Object.fromEntries(entries)));
        setLoadedSurface(surface);
        setLoading(false);
      }
    });
    return () => {
      controller.abort();
    };
  }, [authority, refresh, revision, session]);
  const model = useMemo<OperationsSystemModel | null>(() => {
    if (loading || loadedSurface !== surface) return null;
    const result = (family: AdminQueryFamily): AdminQueryResult =>
      results[family] ?? { code: 'unavailable', records: [], status: 'error' };
    const allResults = queryFamiliesBySurface[surface].map(result);
    const observedAt = allResults.flatMap((entry) =>
      entry.status === 'online' && entry.freshness !== undefined
        ? [entry.freshness.observedAt]
        : [],
    )[0];
    return Object.freeze({
      alerts: documents(result('alerts'), 'admin-alert-projection'),
      audit: documents(result('audit'), 'admin-audit-event-projection'),
      authority: Object.freeze({
        canMutate:
          freshness === 'live' &&
          session?.role === (surface === 'security' ? 'security' : 'operations') &&
          allResults.every((entry) => entry.status === 'online'),
        ...(observedAt === undefined ? {} : { observedAt }),
        state: freshness,
      }),
      capacity: documents(result('capacity'), 'admin-capacity-projection'),
      configurations: documents(result('configurations'), 'admin-configuration-projection'),
      emergencyStops: documents(result('emergency'), 'admin-emergency-stop-projection'),
      environments: documents(result('environments'), 'admin-environment-projection'),
      exports: documents(result('exports'), 'admin-export-projection'),
      incidents: documents(result('incidents'), 'admin-incident-projection'),
      jobs: documents(result('jobs'), 'admin-job-projection'),
      privacyCases: documents(result('privacy'), 'admin-privacy-case-projection'),
      surface,
    });
  }, [freshness, loadedSurface, loading, results, session?.role, surface]);
  const required = queryFamiliesBySurface[surface];
  const denied = required
    .map((family) => results[family])
    .find((result) => result !== undefined && result.status !== 'online');
  if (denied !== undefined)
    return (
      <AdminOperationsSystemView
        code={denied.code}
        locale={locale}
        state="error"
        surface={surface}
      />
    );
  if (model === null)
    return <AdminOperationsSystemView locale={locale} state="loading" surface={surface} />;
  return (
    <AdminOperationsSystemView
      locale={locale}
      model={model}
      mutation={mutation}
      onRefresh={() => {
        setRefresh((value) => value + 1);
      }}
      onMutate={(input) => {
        if (!model.authority.canMutate) return;
        setMutation(null);
        void authority.mutate(input).then((next) => {
          setMutation(next);
          if (next.status === 'complete' || next.status === 'partial')
            setRefresh((value) => value + 1);
        });
      }}
      state="ready"
    />
  );
};
