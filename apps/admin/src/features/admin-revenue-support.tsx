'use client';

import type { AdminJobProjectionJson, AuditEventJson } from '@liiiraa/contracts-ts';
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
  AdminMutationResult,
  AdminProjectionRecord,
  AdminQueryResult,
  AdminSensitiveExportReceipt,
} from '../admin-authority';
import { useAdminAuthority } from './admin-authority';
import {
  projectRevenueAuthority,
  projectSupportCaseAuthority,
  reduceDiagnosticAuthority,
  reviewSensitiveExport,
  type DiagnosticAuthorityState,
} from './admin-revenue-support-model';
import styles from './admin-revenue-support.module.css';

type AuthorityState = 'live' | 'reconnecting' | 'stale' | 'offline' | 'degraded';

export type RevenueRow = Readonly<{
  amount: ReturnType<typeof projectRevenueAuthority>['amount'];
  id: string;
  observedAt: string;
  paidState: ReturnType<typeof projectRevenueAuthority>['paidState'];
  providerState: ReturnType<typeof projectRevenueAuthority>['providerState'];
  reconciliationState: ReturnType<typeof projectRevenueAuthority>['reconciliationState'];
  source: string;
  validUntil?: string;
  version: string;
}>;

export type SupportRow = ReturnType<typeof projectSupportCaseAuthority> &
  Readonly<{ diagnosticId?: string; observedAt: string; version: string }>;

export type DiagnosticEvidence = Readonly<{
  action: string;
  at: string;
  reference: string;
  result: string;
}>;

export type RevenueSupportModel = Readonly<{
  authority: Readonly<{ canMutate: boolean; state: AuthorityState }>;
  degradedFamilies: readonly string[];
  jobs: readonly AdminJobProjectionJson[];
  observedAt?: string;
  revenue: readonly RevenueRow[];
  selectedId?: string;
  support: readonly SupportRow[];
  surface: 'revenue' | 'support';
}>;

export type SensitiveExportRequest = Readonly<{
  approvalReference: string;
  expiresAt: string;
  fields: readonly string[];
  purpose: string;
  targetId: string;
  version: string;
}>;

type ReadyViewProps = Readonly<{
  diagnostic: DiagnosticAuthorityState;
  diagnosticEvidence: readonly DiagnosticEvidence[];
  exportReceipt?: AdminSensitiveExportReceipt;
  locale: WebLocale;
  model: RevenueSupportModel;
  mutation?: AdminMutationResult | null;
  onExport?: (request: SensitiveExportRequest) => void;
  onOpenDiagnostic?: (record: SupportRow) => void;
  onRefresh?: () => void;
  onSelect?: (id?: string) => void;
  state: 'ready';
}>;

type ViewProps =
  | ReadyViewProps
  | Readonly<{ code?: string; locale: WebLocale; state: 'error' }>
  | Readonly<{ locale: WebLocale; state: 'loading' }>;

const txt = (locale: WebLocale, pt: string, en: string): string => (locale === 'pt-BR' ? pt : en);

const stringField = (
  record: Readonly<Record<string, unknown>>,
  key: string,
): string | undefined => {
  const value = record[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
};

const recordField = (
  record: AdminProjectionRecord,
  key: string,
): Readonly<Record<string, unknown>> | undefined => {
  const value = record[key];
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : undefined;
};

const knownState = <T extends string>(
  value: string | undefined,
  admitted: readonly T[],
  fallback: T,
): T => (value !== undefined && admitted.includes(value as T) ? (value as T) : fallback);

const projectRevenue = (record: AdminProjectionRecord): RevenueRow | null => {
  try {
    const observedAt = stringField(record, 'observedAt');
    if (observedAt === undefined) return null;
    const amountMinor = stringField(record, 'amountMinor');
    const currency = stringField(record, 'currency');
    const validUntil = stringField(record, 'validUntil');
    const authority = projectRevenueAuthority({
      ...(amountMinor === undefined ? {} : { amountMinor }),
      ...(currency === undefined ? {} : { currency }),
      observedAt,
      providerState: knownState(
        stringField(record, 'providerState'),
        ['available', 'degraded', 'unknown'] as const,
        'unknown',
      ),
      reconciliationState: knownState(
        stringField(record, 'reconciliationState'),
        ['reconciled', 'pending', 'failed', 'unknown'] as const,
        'unknown',
      ),
      subscriptionState: knownState(
        stringField(record, 'subscriptionState'),
        ['paid', 'past-due', 'canceled', 'unknown'] as const,
        'unknown',
      ),
    });
    return Object.freeze({
      ...authority,
      id: record.id,
      source: stringField(record, 'source') ?? 'unknown',
      ...(validUntil === undefined ? {} : { validUntil }),
      version: stringField(record, 'version') ?? '1',
    });
  } catch {
    return null;
  }
};

const projectSupport = (record: AdminProjectionRecord): SupportRow | null => {
  try {
    const observedAt = stringField(record, 'observedAt');
    const deadlineAt = stringField(record, 'deadlineAt');
    const subjectRedacted = stringField(record, 'subjectRedacted');
    if (observedAt === undefined || deadlineAt === undefined || subjectRedacted === undefined)
      return null;
    const consent = recordField(record, 'consent');
    const consentId = consent === undefined ? undefined : stringField(consent, 'consentId');
    const scopes = consent?.['scopes'];
    const consentAuthority =
      consent === undefined ||
      consentId === undefined ||
      !Array.isArray(scopes) ||
      !scopes.every((item) => typeof item === 'string')
        ? undefined
        : {
            consentId,
            expiresAt: stringField(consent, 'expiresAt') ?? observedAt,
            scopes,
            state: knownState(
              stringField(consent, 'state'),
              ['active', 'expired', 'revoked', 'absent'] as const,
              'absent',
            ),
            version: stringField(consent, 'version') ?? '1',
          };
    const ownerReference = stringField(record, 'ownerReference');
    const substituteReference = stringField(record, 'substituteReference');
    const diagnosticId = stringField(record, 'diagnosticId');
    const projected = projectSupportCaseAuthority({
      caseId: record.id,
      ...(consentAuthority === undefined ? {} : { consent: consentAuthority }),
      deadlineAt,
      metadata: recordField(record, 'metadata') ?? {},
      now: observedAt,
      ...(ownerReference === undefined ? {} : { ownerReference }),
      state: stringField(record, 'state') ?? 'open',
      subjectRedacted,
      ...(substituteReference === undefined ? {} : { substituteReference }),
    });
    return Object.freeze({
      ...projected,
      ...(diagnosticId === undefined ? {} : { diagnosticId }),
      observedAt,
      version: stringField(record, 'version') ?? '1',
    });
  } catch {
    return null;
  }
};

const formatDate = (value: string | undefined, locale: WebLocale): string => {
  if (value === undefined) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(date);
};

const formatAmount = (row: RevenueRow, locale: WebLocale): string => {
  if (row.amount.state === 'unknown') return txt(locale, 'Não informado', 'Unavailable');
  const numeric = Number(row.amount.minor);
  if (!Number.isSafeInteger(numeric)) return `${row.amount.currency} ${row.amount.minor}`;
  return new Intl.NumberFormat(locale, {
    currency: row.amount.currency,
    style: 'currency',
  }).format(numeric / 100);
};

const stateLabel = (value: string): string => value.replaceAll('-', ' ');

const authorityNotice = (locale: WebLocale, state: AuthorityState) => {
  if (state === 'live') return null;
  if (state === 'reconnecting')
    return {
      detail: txt(
        locale,
        'Os registros ficam marcados como antigos até a projeção canônica ser recarregada.',
        'Records remain marked stale until the canonical projection is reloaded.',
      ),
      state: 'reconnecting' as const,
      title: txt(locale, 'Reconectando à autoridade', 'Reconnecting to authority'),
    };
  if (state === 'stale')
    return {
      detail: txt(
        locale,
        'Atualize antes de executar qualquer ação.',
        'Refresh before any action.',
      ),
      state: 'stale' as const,
      title: txt(locale, 'Dados administrativos antigos', 'Administrative data is stale'),
    };
  return {
    detail: txt(
      locale,
      'As leituras autorizadas permanecem visíveis; mutações dependentes da capacidade foram pausadas.',
      'Authorized reads remain visible; capability-dependent mutations are paused.',
    ),
    state: 'degraded' as const,
    title: txt(locale, 'Autoridade em modo somente leitura', 'Authority is read-only'),
  };
};

const JobLedger = ({
  jobs,
  locale,
}: Readonly<{ jobs: readonly AdminJobProjectionJson[]; locale: WebLocale }>) => (
  <section className={styles['jobs']} aria-labelledby="revenue-support-jobs">
    <header>
      <div>
        <ProductIcon name="gauge" size={20} />
        <h2 id="revenue-support-jobs">{txt(locale, 'Trabalhos duráveis', 'Durable jobs')}</h2>
      </div>
      <span>{jobs.length}</span>
    </header>
    {jobs.length === 0 ? (
      <p className={styles['muted']}>
        {txt(locale, 'Nenhum trabalho autorizado.', 'No authorized jobs.')}
      </p>
    ) : (
      <ol>
        {jobs.slice(0, 4).map((job) => (
          <li key={job.jobId}>
            <div>
              <code>{job.jobId}</code>
              <span className={styles['state']} data-state={job.state}>
                {stateLabel(job.state)}
              </span>
            </div>
            <LbProgress label={txt(locale, 'Progresso', 'Progress')} value={job.progressPercent} />
            {job.state === 'partial' ? (
              <small>
                {txt(
                  locale,
                  'Efeitos concluídos preservados; falhas exigem revisão.',
                  'Completed effects preserved; failures require review.',
                )}
              </small>
            ) : null}
          </li>
        ))}
      </ol>
    )}
  </section>
);

const ExportReview = ({
  locale,
  model,
  onExport,
  target,
}: Readonly<{
  locale: WebLocale;
  model: RevenueSupportModel;
  onExport?: (request: SensitiveExportRequest) => void;
  target: Readonly<{ fields: readonly string[]; id: string; version: string }>;
}>) => {
  const [purpose, setPurpose] = useState('');
  const [approvalReference, setApprovalReference] = useState('');
  const [reviewed, setReviewed] = useState(false);
  const observedAt = model.observedAt;
  const expiresAt =
    observedAt === undefined
      ? undefined
      : new Date(Date.parse(observedAt) + 15 * 60 * 1_000).toISOString();
  const review =
    expiresAt === undefined || observedAt === undefined
      ? { admitted: false as const, code: 'AUTHORITATIVE_REFRESH_REQUIRED' as const }
      : reviewSensitiveExport({
          approved: approvalReference.trim().length > 0,
          authority: model.authority.state,
          encrypted: true,
          expiresAt,
          masked: true,
          minimumFields: target.fields,
          now: observedAt,
          previewed: reviewed,
          purpose,
          requestedFields: target.fields,
        });
  return (
    <section className={styles['exportReview']} aria-labelledby="export-review-title">
      <header>
        <ProductIcon name="download" size={20} />
        <div>
          <h3 id="export-review-title">
            {txt(locale, 'Exportação protegida', 'Protected export')}
          </h3>
          <p>
            {txt(
              locale,
              'Prévia mascarada · criptografada · expira em 15 minutos',
              'Masked preview · encrypted · expires in 15 minutes',
            )}
          </p>
        </div>
      </header>
      <ul
        className={styles['fieldPreview']}
        aria-label={txt(locale, 'Campos mínimos', 'Minimum fields')}
      >
        {target.fields.map((field) => (
          <li key={field}>{field}</li>
        ))}
      </ul>
      <LbTextArea
        isRequired
        label={txt(locale, 'Finalidade operacional', 'Operational purpose')}
        maxLength={256}
        onChange={setPurpose}
        value={purpose}
      />
      <LbTextField
        isRequired
        label={txt(locale, 'Referência da aprovação', 'Approval reference')}
        maxLength={128}
        onChange={setApprovalReference}
        value={approvalReference}
      />
      <LbCheckbox isSelected={reviewed} onChange={setReviewed}>
        {txt(
          locale,
          'Revisei a prévia mascarada e o escopo mínimo',
          'I reviewed the masked preview and minimum scope',
        )}
      </LbCheckbox>
      <div className={styles['exportAction']}>
        <span data-admitted={review.admitted || undefined} role="status">
          {review.admitted
            ? txt(locale, 'Pronta para criar', 'Ready to create')
            : stateLabel(review.code)}
        </span>
        <LbButton
          isDisabled={!review.admitted || !model.authority.canMutate}
          onPress={() => {
            if (!review.admitted || expiresAt === undefined) return;
            onExport?.({
              approvalReference,
              expiresAt,
              fields: target.fields,
              purpose: review.purpose,
              targetId: target.id,
              version: target.version,
            });
          }}
          variant="primary"
        >
          {txt(locale, 'Criar exportação', 'Create export')}
        </LbButton>
      </div>
    </section>
  );
};

const RevenueInspector = ({
  locale,
  model,
  onClose,
  onExport,
  row,
}: Readonly<{
  locale: WebLocale;
  model: RevenueSupportModel;
  onClose: () => void;
  onExport?: (request: SensitiveExportRequest) => void;
  row: RevenueRow;
}>) => (
  <aside
    className={styles['inspector']}
    aria-label={txt(locale, 'Detalhe da receita', 'Revenue detail')}
  >
    <header>
      <div>
        <span>{txt(locale, 'Receita', 'Revenue')}</span>
        <h2>{row.id}</h2>
      </div>
      <LbButton onPress={onClose} variant="quiet">
        {txt(locale, 'Fechar', 'Close')}
      </LbButton>
    </header>
    <dl className={styles['detailList']}>
      <div>
        <dt>{txt(locale, 'Estado', 'State')}</dt>
        <dd>{stateLabel(row.paidState)}</dd>
      </div>
      <div>
        <dt>{txt(locale, 'Valor confirmado', 'Confirmed amount')}</dt>
        <dd>{formatAmount(row, locale)}</dd>
      </div>
      <div>
        <dt>{txt(locale, 'Provedor', 'Provider')}</dt>
        <dd>{stateLabel(row.providerState)}</dd>
      </div>
      <div>
        <dt>{txt(locale, 'Reconciliação', 'Reconciliation')}</dt>
        <dd>{stateLabel(row.reconciliationState)}</dd>
      </div>
      <div>
        <dt>{txt(locale, 'Observado', 'Observed')}</dt>
        <dd>{formatDate(row.observedAt, locale)}</dd>
      </div>
      <div>
        <dt>{txt(locale, 'Versão', 'Version')}</dt>
        <dd>{row.version}</dd>
      </div>
    </dl>
    <ExportReview
      locale={locale}
      model={model}
      {...(onExport === undefined ? {} : { onExport })}
      target={{ fields: ['reference', 'state', 'observed-at'], id: row.id, version: row.version }}
    />
  </aside>
);

const SupportInspector = ({
  diagnostic,
  evidence,
  locale,
  model,
  onClose,
  onExport,
  onOpenDiagnostic,
  row,
}: Readonly<{
  diagnostic: DiagnosticAuthorityState;
  evidence: readonly DiagnosticEvidence[];
  locale: WebLocale;
  model: RevenueSupportModel;
  onClose: () => void;
  onExport?: (request: SensitiveExportRequest) => void;
  onOpenDiagnostic?: (record: SupportRow) => void;
  row: SupportRow;
}>) => (
  <aside
    className={styles['inspector']}
    aria-label={txt(locale, 'Detalhe do atendimento', 'Support detail')}
  >
    <header>
      <div>
        <span>{txt(locale, 'Atendimento', 'Support')}</span>
        <h2>{row.subjectRedacted}</h2>
      </div>
      <LbButton onPress={onClose} variant="quiet">
        {txt(locale, 'Fechar', 'Close')}
      </LbButton>
    </header>
    <dl className={styles['detailList']}>
      <div>
        <dt>{txt(locale, 'Caso', 'Case')}</dt>
        <dd>{row.caseId}</dd>
      </div>
      <div>
        <dt>{txt(locale, 'Responsável', 'Owner')}</dt>
        <dd>{row.ownerReference ?? txt(locale, 'Sem responsável', 'Unassigned')}</dd>
      </div>
      <div>
        <dt>{txt(locale, 'Substituto', 'Substitute')}</dt>
        <dd>{row.substituteReference ?? '—'}</dd>
      </div>
      <div>
        <dt>SLA</dt>
        <dd>
          {row.deadline.overdue
            ? txt(locale, 'Vencido', 'Overdue')
            : `${String(row.deadline.remainingMinutes)} min`}
        </dd>
      </div>
      <div>
        <dt>{txt(locale, 'Consentimento', 'Consent')}</dt>
        <dd>{stateLabel(row.consent.state)}</dd>
      </div>
      <div>
        <dt>{txt(locale, 'Expira', 'Expires')}</dt>
        <dd>
          {formatDate('expiresAt' in row.consent ? row.consent.expiresAt : undefined, locale)}
        </dd>
      </div>
    </dl>
    <section
      className={styles['diagnostic']}
      data-state={diagnostic.state}
      aria-labelledby="diagnostic-title"
    >
      <header>
        <ProductIcon name="shield" size={20} />
        <div>
          <h3 id="diagnostic-title">
            {txt(locale, 'Diagnóstico consentido', 'Consented diagnostic')}
          </h3>
          <p>
            {txt(
              locale,
              'Só existe em memória enquanto a autoridade permite.',
              'Exists in memory only while authority permits.',
            )}
          </p>
        </div>
      </header>
      {diagnostic.state === 'active' ? (
        Object.keys(diagnostic.fields).length === 0 ? (
          <p role="status">
            {txt(
              locale,
              'O consentimento está ativo, mas nenhum campo diagnóstico foi autorizado.',
              'Consent is active, but no diagnostic fields were authorized.',
            )}
          </p>
        ) : (
          <dl>
            {Object.entries(diagnostic.fields).map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        )
      ) : diagnostic.state === 'cleared' ? (
        <p role="status">
          {txt(
            locale,
            'Conteúdo limpo imediatamente. Apenas o comprovante imutável permanece.',
            'Content cleared immediately. Only immutable evidence remains.',
          )}
        </p>
      ) : (
        <p>
          {row.consent.active
            ? txt(
                locale,
                'O conteúdo ainda não foi revelado.',
                'Content has not been revealed yet.',
              )
            : txt(locale, 'Sem consentimento ativo.', 'No active consent.')}
        </p>
      )}
      <LbButton
        isDisabled={
          !row.consent.active || row.diagnosticId === undefined || diagnostic.state === 'active'
        }
        onPress={() => onOpenDiagnostic?.(row)}
        variant="secondary"
      >
        {txt(locale, 'Revelar durante o consentimento', 'Reveal during consent')}
      </LbButton>
    </section>
    <section className={styles['audit']} aria-labelledby="diagnostic-audit-title">
      <h3 id="diagnostic-audit-title">
        {txt(locale, 'Linha do tempo imutável', 'Immutable timeline')}
      </h3>
      {evidence.length === 0 ? (
        <p className={styles['muted']}>
          {txt(locale, 'Nenhum evento revelado.', 'No events revealed.')}
        </p>
      ) : (
        <ol>
          {evidence.map((event) => (
            <li key={event.reference}>
              <span>{formatDate(event.at, locale)}</span>
              <strong>{event.action}</strong>
              <code>{event.reference}</code>
              <small>{event.result}</small>
            </li>
          ))}
        </ol>
      )}
    </section>
    <ExportReview
      locale={locale}
      model={model}
      {...(onExport === undefined ? {} : { onExport })}
      target={{ fields: ['case-reference', 'event-time'], id: row.caseId, version: row.version }}
    />
  </aside>
);

export const AdminRevenueSupportView = (props: ViewProps) => {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  if (props.state === 'loading')
    return (
      <article className={styles['route']} data-state="loading">
        <header className={styles['routeHeader']}>
          <div>
            <h1>{txt(props.locale, 'Receita e atendimento', 'Revenue and support')}</h1>
            <p>
              {txt(
                props.locale,
                'Carregando projeções autorizadas.',
                'Loading authorized projections.',
              )}
            </p>
          </div>
        </header>
        <LbSkeletonRegion
          label={txt(props.locale, 'Carregando área operacional', 'Loading operational workspace')}
          rows={9}
        />
      </article>
    );
  if (props.state === 'error')
    return (
      <article className={styles['route']} data-state="error">
        <header className={styles['routeHeader']}>
          <div>
            <h1>{txt(props.locale, 'Receita e atendimento', 'Revenue and support')}</h1>
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
  const selectedRevenue = model.revenue.find((row) => row.id === model.selectedId);
  const selectedSupport = model.support.find((row) => row.caseId === model.selectedId);
  const records = model.surface === 'revenue' ? model.revenue : model.support;
  return (
    <article
      className={styles['route']}
      data-state={model.authority.state}
      data-surface={model.surface}
    >
      <header className={styles['routeHeader']}>
        <div>
          <h1>
            {model.surface === 'revenue'
              ? txt(props.locale, 'Receita', 'Revenue')
              : txt(props.locale, 'Atendimento', 'Support')}
          </h1>
          <p>
            {model.surface === 'revenue'
              ? txt(
                  props.locale,
                  'Assinaturas e reconciliação sem inferir valores do provedor.',
                  'Subscriptions and reconciliation without inferring provider values.',
                )
              : txt(
                  props.locale,
                  'Casos, SLA e diagnósticos estritamente limitados pelo consentimento.',
                  'Cases, SLA, and diagnostics strictly bounded by consent.',
                )}
          </p>
        </div>
        <div className={styles['freshness']} data-state={model.authority.state}>
          <span aria-hidden="true" />
          <strong>{stateLabel(model.authority.state)}</strong>
          <small>{formatDate(model.observedAt, props.locale)}</small>
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
            'O rascunho foi preservado para comparação com a versão remota.',
            'The draft was preserved for comparison with the remote version.',
          )}
          state="conflict"
          title={txt(props.locale, 'Conflito de versão', 'Version conflict')}
        />
      ) : null}
      {props.exportReceipt === undefined ? null : (
        <section className={styles['receipt']} role="status">
          <ProductIcon name="receipt" size={22} />
          <div>
            <strong>{txt(props.locale, 'Exportação criada', 'Export created')}</strong>
            <code>{props.exportReceipt.exportId}</code>
            <span>
              {txt(props.locale, 'Auditoria', 'Audit')}: {props.exportReceipt.auditReference}
            </span>
            <small>
              {txt(props.locale, 'Expira', 'Expires')}{' '}
              {formatDate(props.exportReceipt.expiresAt, props.locale)}
            </small>
          </div>
        </section>
      )}
      <section
        className={styles['summaryStrip']}
        aria-label={txt(props.locale, 'Resumo operacional', 'Operational summary')}
      >
        <div>
          <span>{txt(props.locale, 'Autorizados', 'Authorized')}</span>
          <strong>{records.length}</strong>
        </div>
        <div>
          <span>
            {model.surface === 'revenue'
              ? txt(props.locale, 'Reconciliação pendente', 'Pending reconciliation')
              : txt(props.locale, 'SLA vencido', 'Overdue SLA')}
          </span>
          <strong>
            {model.surface === 'revenue'
              ? model.revenue.filter((row) => row.reconciliationState === 'pending').length
              : model.support.filter((row) => row.deadline.overdue).length}
          </strong>
        </div>
        <div>
          <span>
            {model.surface === 'revenue'
              ? txt(props.locale, 'Provedor degradado', 'Provider degraded')
              : txt(props.locale, 'Consentimento ativo', 'Active consent')}
          </span>
          <strong>
            {model.surface === 'revenue'
              ? model.revenue.filter((row) => row.providerState === 'degraded').length
              : model.support.filter((row) => row.consent.active).length}
          </strong>
        </div>
      </section>
      <div
        className={styles['workspace']}
        data-inspector-open={
          selectedRevenue !== undefined || selectedSupport !== undefined || undefined
        }
      >
        <section className={styles['workSurface']} aria-labelledby="revenue-support-list">
          <header className={styles['sectionHeader']}>
            <div>
              <h2 id="revenue-support-list">
                {model.surface === 'revenue'
                  ? txt(props.locale, 'Assinaturas autorizadas', 'Authorized subscriptions')
                  : txt(props.locale, 'Casos autorizados', 'Authorized cases')}
              </h2>
              <p>
                {txt(
                  props.locale,
                  'Abra um registro para revisar a autoridade atual.',
                  'Open a record to review current authority.',
                )}
              </p>
            </div>
            <span>{records.length}</span>
          </header>
          {records.length === 0 ? (
            <div className={styles['empty']} role="status">
              <ProductIcon name={model.surface === 'revenue' ? 'receipt' : 'lifebuoy'} size={28} />
              <p>
                {txt(
                  props.locale,
                  'Nenhum registro autorizado para esta função.',
                  'No records authorized for this function.',
                )}
              </p>
            </div>
          ) : model.surface === 'revenue' ? (
            <>
              <div className={styles['tableViewport']}>
                <table>
                  <thead>
                    <tr>
                      <th>{txt(props.locale, 'Referência', 'Reference')}</th>
                      <th>{txt(props.locale, 'Estado', 'State')}</th>
                      <th>{txt(props.locale, 'Valor', 'Amount')}</th>
                      <th>{txt(props.locale, 'Provedor', 'Provider')}</th>
                      <th>{txt(props.locale, 'Reconciliação', 'Reconciliation')}</th>
                      <th>{txt(props.locale, 'Observado', 'Observed')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {model.revenue.map((row) => (
                      <tr key={row.id} data-selected={row.id === model.selectedId || undefined}>
                        <td>
                          <button
                            ref={row.id === model.selectedId ? triggerRef : undefined}
                            type="button"
                            onClick={(event) => {
                              triggerRef.current = event.currentTarget;
                              props.onSelect?.(row.id);
                            }}
                          >
                            <code>{row.id}</code>
                          </button>
                        </td>
                        <td>
                          <span className={styles['state']} data-state={row.paidState}>
                            {stateLabel(row.paidState)}
                          </span>
                        </td>
                        <td>{formatAmount(row, props.locale)}</td>
                        <td>{stateLabel(row.providerState)}</td>
                        <td>{stateLabel(row.reconciliationState)}</td>
                        <td>{formatDate(row.observedAt, props.locale)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className={styles['mobileList']}>
                {model.revenue.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={(event) => {
                        triggerRef.current = event.currentTarget;
                        props.onSelect?.(row.id);
                      }}
                    >
                      <span>
                        <code>{row.id}</code>
                        <strong>{formatAmount(row, props.locale)}</strong>
                      </span>
                      <span className={styles['state']}>{stateLabel(row.paidState)}</span>
                      <small>
                        {stateLabel(row.reconciliationState)} ·{' '}
                        {formatDate(row.observedAt, props.locale)}
                      </small>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <div className={styles['tableViewport']}>
                <table>
                  <thead>
                    <tr>
                      <th>{txt(props.locale, 'Caso', 'Case')}</th>
                      <th>{txt(props.locale, 'Assunto mascarado', 'Masked subject')}</th>
                      <th>{txt(props.locale, 'Responsável', 'Owner')}</th>
                      <th>SLA</th>
                      <th>{txt(props.locale, 'Consentimento', 'Consent')}</th>
                      <th>{txt(props.locale, 'Estado', 'State')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {model.support.map((row) => (
                      <tr
                        key={row.caseId}
                        data-selected={row.caseId === model.selectedId || undefined}
                      >
                        <td>
                          <button
                            type="button"
                            onClick={(event) => {
                              triggerRef.current = event.currentTarget;
                              props.onSelect?.(row.caseId);
                            }}
                          >
                            <code>{row.caseId}</code>
                          </button>
                        </td>
                        <td>{row.subjectRedacted}</td>
                        <td>{row.ownerReference ?? '—'}</td>
                        <td data-overdue={row.deadline.overdue || undefined}>
                          {row.deadline.overdue
                            ? txt(props.locale, 'Vencido', 'Overdue')
                            : `${String(row.deadline.remainingMinutes)} min`}
                        </td>
                        <td>
                          <span className={styles['state']} data-state={row.consent.state}>
                            {stateLabel(row.consent.state)}
                          </span>
                        </td>
                        <td>{stateLabel(row.state)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className={styles['mobileList']}>
                {model.support.map((row) => (
                  <li key={row.caseId}>
                    <button
                      type="button"
                      onClick={(event) => {
                        triggerRef.current = event.currentTarget;
                        props.onSelect?.(row.caseId);
                      }}
                    >
                      <span>
                        <code>{row.caseId}</code>
                        <strong>{row.subjectRedacted}</strong>
                      </span>
                      <span className={styles['state']}>{stateLabel(row.consent.state)}</span>
                      <small>
                        {row.ownerReference ?? '—'} ·{' '}
                        {row.deadline.overdue
                          ? txt(props.locale, 'SLA vencido', 'SLA overdue')
                          : `${String(row.deadline.remainingMinutes)} min`}
                      </small>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
        {selectedRevenue === undefined ? null : (
          <RevenueInspector
            locale={props.locale}
            model={model}
            {...(props.onExport === undefined ? {} : { onExport: props.onExport })}
            row={selectedRevenue}
            onClose={() => {
              props.onSelect?.(undefined);
              globalThis.setTimeout(() => triggerRef.current?.focus(), 0);
            }}
          />
        )}
        {selectedSupport === undefined ? null : (
          <SupportInspector
            diagnostic={props.diagnostic}
            evidence={props.diagnosticEvidence}
            locale={props.locale}
            model={model}
            {...(props.onExport === undefined ? {} : { onExport: props.onExport })}
            {...(props.onOpenDiagnostic === undefined
              ? {}
              : { onOpenDiagnostic: props.onOpenDiagnostic })}
            row={selectedSupport}
            onClose={() => {
              props.onSelect?.(undefined);
              globalThis.setTimeout(() => triggerRef.current?.focus(), 0);
            }}
          />
        )}
      </div>
      <JobLedger jobs={model.jobs} locale={props.locale} />
    </article>
  );
};

const jobsFrom = (result: AdminQueryResult | null): readonly AdminJobProjectionJson[] =>
  result?.status === 'online'
    ? result.records.filter(
        (record): record is AdminJobProjectionJson => record.kind === 'admin-job-projection',
      )
    : [];

const auditEvidence = (events: readonly AuditEventJson[]): readonly DiagnosticEvidence[] =>
  Object.freeze(
    events.map((event) =>
      Object.freeze({
        action: event.action,
        at: event.occurredAt,
        reference: event.auditEventId,
        result: event.result,
      }),
    ),
  );

export const AdminRevenueSupport = ({
  initialSelectedId,
  locale,
  surface,
}: Readonly<{ initialSelectedId?: string; locale: WebLocale; surface: 'revenue' | 'support' }>) => {
  const { authority, freshness, revision, session } = useAdminAuthority();
  const [collections, setCollections] = useState<Readonly<{
    entitlements: Awaited<ReturnType<typeof authority.list>>;
    jobs: AdminQueryResult;
    support: Awaited<ReturnType<typeof authority.list>>;
  }> | null>(null);
  const [selectedId, setSelectedId] = useState<string | undefined>(initialSelectedId);
  const [diagnostic, setDiagnostic] = useState<DiagnosticAuthorityState>({
    fields: {},
    state: 'empty',
  });
  const [evidence, setEvidence] = useState<readonly DiagnosticEvidence[]>([]);
  const [mutation, setMutation] = useState<AdminMutationResult | null>(null);
  const [exportReceipt, setExportReceipt] = useState<AdminSensitiveExportReceipt>();
  const [refresh, setRefresh] = useState(0);
  const diagnosticController = useRef<AbortController | null>(null);
  const diagnosticStop = useRef<(() => void) | null>(null);
  const clearDiagnostic = () => {
    diagnosticController.current?.abort();
    diagnosticStop.current?.();
    diagnosticController.current = null;
    diagnosticStop.current = null;
    setDiagnostic({ fields: {}, state: 'empty' });
    setEvidence([]);
  };
  useEffect(() => {
    if (session === null || session === undefined) return undefined;
    const controller = new AbortController();
    void Promise.all([
      authority.list('entitlements'),
      authority.list('support-cases'),
      authority.query('jobs', { environment: 'staging', limit: 25, signal: controller.signal }),
    ]).then(([entitlements, support, jobs]) => {
      if (!controller.signal.aborted) setCollections({ entitlements, jobs, support });
    });
    return () => {
      controller.abort();
    };
  }, [authority, refresh, revision, session]);
  const model = useMemo<RevenueSupportModel | null>(() => {
    if (collections === null) return null;
    const revenue =
      collections.entitlements.status === 'online'
        ? collections.entitlements.records.flatMap((record) => {
            const projected = projectRevenue(record);
            return projected === null ? [] : [projected];
          })
        : [];
    const support =
      collections.support.status === 'online'
        ? collections.support.records.flatMap((record) => {
            const projected = projectSupport(record);
            return projected === null ? [] : [projected];
          })
        : [];
    const observedAt =
      (surface === 'revenue' ? revenue[0]?.observedAt : support[0]?.observedAt) ??
      revenue[0]?.observedAt ??
      support[0]?.observedAt;
    return Object.freeze({
      authority: Object.freeze({
        canMutate:
          freshness === 'live' &&
          session?.role === 'operations' &&
          collections.entitlements.status === 'online' &&
          collections.support.status === 'online',
        state: freshness,
      }),
      degradedFamilies: Object.freeze([
        ...(collections.entitlements.status === 'online' ? [] : ['entitlements']),
        ...(collections.support.status === 'online' ? [] : ['support-cases']),
        ...(collections.jobs.status === 'online' ? [] : ['jobs']),
      ]),
      jobs: Object.freeze(jobsFrom(collections.jobs)),
      ...(observedAt === undefined ? {} : { observedAt }),
      revenue: Object.freeze(revenue),
      ...(selectedId === undefined ? {} : { selectedId }),
      support: Object.freeze(support),
      surface,
    });
  }, [collections, freshness, selectedId, session?.role, surface]);
  useEffect(() => {
    const selected = model?.support.find((row) => row.caseId === selectedId);
    if (selected?.consent.active !== true) clearDiagnostic();
  }, [model, selectedId]);
  useEffect(
    () => () => {
      clearDiagnostic();
    },
    [],
  );
  if (collections !== null) {
    const active = surface === 'revenue' ? collections.entitlements : collections.support;
    if (active.status !== 'online')
      return <AdminRevenueSupportView code={active.code} locale={locale} state="error" />;
  }
  if (model === null) return <AdminRevenueSupportView locale={locale} state="loading" />;
  const openDiagnostic = (record: SupportRow) => {
    if (
      !record.consent.active ||
      !('consentId' in record.consent) ||
      record.diagnosticId === undefined
    )
      return;
    const consent = record.consent;
    clearDiagnostic();
    const controller = new AbortController();
    diagnosticController.current = controller;
    void authority
      .openDiagnostic({
        diagnosticId: record.diagnosticId,
        onClear: ({ auditEvents, reason }) => {
          controller.abort();
          setEvidence(auditEvidence(auditEvents));
          const auditReference = auditEvents.at(-1)?.auditEventId;
          setDiagnostic((current) =>
            reduceDiagnosticAuthority(current, {
              ...(auditReference === undefined ? {} : { auditReference }),
              consentId: consent.consentId,
              type: reason === 'expired' ? 'expire' : 'revoke',
              version: consent.version,
            }),
          );
        },
        onProjection: (projection) => {
          setEvidence(auditEvidence(projection.auditEvents));
          setDiagnostic((current) =>
            reduceDiagnosticAuthority(current, {
              consentId: projection.consent.consentId,
              expiresAt: projection.consent.expiresAt,
              fields: projection.fields,
              now: record.observedAt,
              type: 'projection',
              version: projection.consent.aggregateVersion,
            }),
          );
        },
        signal: controller.signal,
      })
      .then((lifecycle) => {
        if (controller.signal.aborted) lifecycle.stop();
        else diagnosticStop.current = lifecycle.stop;
      });
  };
  const startExport = (request: SensitiveExportRequest) => {
    if (!model.authority.canMutate) return;
    const id = crypto.randomUUID();
    void authority
      .mutate({
        approvalReferences: [request.approvalReference],
        expectedVersion: request.version,
        family: 'export-data',
        idempotencyKey: id,
        payload: {
          approved: true,
          encrypted: true,
          expiresAt: request.expiresAt,
          fields: request.fields,
          masked: true,
          minimumFields: request.fields,
          previewed: true,
          purpose: request.purpose,
          targetEnvironment: 'staging',
        },
        reason: request.purpose,
        targetId: request.targetId,
      })
      .then((result) => {
        setMutation(result);
        if (result.status === 'complete' && 'receipt' in result) setExportReceipt(result.receipt);
        if (result.status === 'complete' || result.status === 'partial')
          setRefresh((value) => value + 1);
      });
  };
  return (
    <AdminRevenueSupportView
      diagnostic={diagnostic}
      diagnosticEvidence={evidence}
      {...(exportReceipt === undefined ? {} : { exportReceipt })}
      locale={locale}
      model={model}
      mutation={mutation}
      onExport={startExport}
      onOpenDiagnostic={openDiagnostic}
      onRefresh={() => {
        setRefresh((value) => value + 1);
      }}
      onSelect={(id) => {
        if (id !== selectedId) clearDiagnostic();
        setSelectedId(id);
      }}
      state="ready"
    />
  );
};
