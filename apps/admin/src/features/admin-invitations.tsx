'use client';

import type {
  AdminInvitationCapacityProjectionJson,
  AdminInvitationProjectionJson,
  AdminJobProjectionJson,
  AdminOperationActionJson,
  AdminOperationCommandJson,
} from '@liiiraa/contracts-ts';
import {
  LbButton,
  LbOperationalNotice,
  LbSkeletonRegion,
  ProductIcon,
} from '@liiiraa/design-system';
import type { WebLocale } from '@liiiraa/web-core';
import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';

import type {
  AdminAuthorityDocument,
  AdminMutationInput,
  AdminMutationResult,
  AdminQueryResult,
} from '../admin-authority';
import { useAdminAuthority } from './admin-authority';
import {
  classifyInvitationActions,
  projectInvitationJob,
  reviewInvitationPreflight,
  type InvitationAuthorityState,
} from './admin-invitations-model';
import styles from './admin-invitations.module.css';

type InvitationView =
  'active' | 'queue' | 'delivery' | 'expiring' | 'accepted' | 'declined' | 'revoked' | 'history';

type InvitationTimelineEvent = Readonly<{
  at: string;
  kind: string;
  outcome?: string;
}>;

type InvitationJob = ReturnType<typeof projectInvitationJob>;
type InvitationPreflight = Readonly<{
  capacity: Readonly<{ activeAfter: number; activeLimit: number; queuedAfter: number }>;
  canIssue: boolean;
  counts: Readonly<{
    active: number;
    duplicate: number;
    ineligible: number;
    invalid: number;
    queued: number;
    skipped: number;
    valid: number;
    willActivate: number;
  }>;
  mode: 'individual' | 'csv';
  rows: readonly Readonly<{
    classification: 'valid' | 'duplicate' | 'active' | 'invalid' | 'ineligible';
    recipientMasked: string;
    rowId: string;
  }>[];
}>;

type InvitationRetention = Readonly<{
  action: 'retain' | 'delete-personal-data' | 'pseudonymize-personal-data';
  basis?: 'operational' | 'purpose' | 'legal-hold';
  preserveMinimumAuditReceipt?: true;
}>;

export type InvitationWorkspaceModel = Readonly<{
  authority: Readonly<{
    canMutate: boolean;
    requiresRefetch: boolean;
    state: InvitationAuthorityState;
  }>;
  capacity: AdminInvitationCapacityProjectionJson | null;
  firstUse: boolean;
  invitations: readonly AdminInvitationProjectionJson[];
  jobs: readonly InvitationJob[];
  mutationFeedback?: AdminMutationResult | null;
  nextCursor: string | null;
  observedAt?: string;
  preflight: InvitationPreflight | null;
  retention: InvitationRetention | null;
  selectedId?: string;
  timeline: readonly InvitationTimelineEvent[];
  view: InvitationView;
}>;

type PreflightInput = Readonly<{
  campaign: string;
  locale: WebLocale;
  mode: 'individual' | 'csv';
  recipients: readonly string[];
}>;

type IssueInput = PreflightInput & Readonly<{ reason: string }>;
type BatchInput = Readonly<{
  action: 'resend' | 'revoke';
  approvalGranted: boolean;
  impactReviewed: boolean;
  invitationIds: readonly string[];
  reason: string;
}>;

interface InvitationReadyActions {
  readonly onBatch?: (input: BatchInput) => void;
  readonly onIssue?: (input: IssueInput) => void;
  readonly onPreflight?: (input: PreflightInput) => void;
  readonly onRefresh?: () => void;
  readonly onSelect?: (invitationId: string | undefined) => void;
  readonly onResend?: (
    invitation: AdminInvitationProjectionJson,
    input: Readonly<{ expiryMode: 'preserve' | 'restart'; reason: string }>,
  ) => void;
  readonly onRevoke?: (invitation: AdminInvitationProjectionJson, reason: string) => void;
  readonly onViewChange?: (view: InvitationView) => void;
}

type AdminInvitationsViewProps =
  | Readonly<{ locale: WebLocale; state: 'loading' }>
  | Readonly<{ errorCode?: string; locale: WebLocale; state: 'error' }>
  | (Readonly<{ locale: WebLocale; model: InvitationWorkspaceModel; state: 'ready' }> &
      InvitationReadyActions);

const copy = Object.freeze({
  en: Object.freeze({
    acceptedAccount: 'An accepted account has separate authority and is never suspended here.',
    active: 'Active',
    batch: 'Batch action',
    batchApproval: 'Required independent approval has been granted',
    batchImpact: 'I reviewed the affected invitations and irreversible effects',
    campaign: 'Campaign reference',
    capacityUnavailable: 'Invitation capacity is currently unavailable.',
    close: 'Close invitation inspector',
    create: 'Create invitations',
    createDescription:
      'Preflight classifies every recipient before any invitation is admitted or queued.',
    csv: 'Batch / CSV',
    decline: 'Declined',
    delivery: 'Delivery problems',
    description:
      'Create, queue, inspect, resend, revoke, and audit private-beta invitations under one authority.',
    empty: 'No invitation is available in this authorized view.',
    errorDetail: 'No invitation existence is disclosed when this authority cannot be admitted.',
    errorTitle: 'Invitation authority unavailable',
    expiring: 'Expiring soon',
    expiry: 'Expiry',
    firstUse: 'No private-beta invitation has been admitted yet.',
    history: 'All history',
    individual: 'Individual',
    inspector: 'Invitation detail',
    issue: 'Issue reviewed invitations',
    jobs: 'Durable invitation jobs',
    legalRetention: 'Retention and legal hold',
    list: 'Invitation ledger',
    loading: 'Loading server-authorized invitations',
    locale: 'Invitation locale',
    mutationErrorDetail:
      'No invitation was admitted and no durable receipt was created. Retry only after delivery authority is available.',
    mutationErrorTitle: 'Invitation operation failed',
    mutationsPaused: 'Refresh authoritative data before changing invitations.',
    preflight: 'Run preflight',
    preflightResults: 'Preflight review',
    queue: 'Queue',
    reason: 'Operational reason',
    recipient: 'Recipient email',
    recipientsCsv: 'One recipient per line or a CSV recipient column',
    refresh: 'Refresh authority',
    reminders: 'Reminders',
    resend: 'Resend invitation',
    resendDescription:
      'The current secret stops working. Choose whether the existing expiry stays or restarts for 14 days.',
    restartExpiry: 'Restart the 14-day window',
    retainExpiry: 'Keep the current expiry',
    revoke: 'Revoke invitation',
    revokeDescription:
      'The invitation link stops immediately. An already-created account is not suspended.',
    revoked: 'Revoked',
    selected: 'selected',
    separateTeam:
      'Administrative team invitations use separate governance authority and never share beta actions.',
    state: 'State',
    success: 'Authoritative projection updated. Durable evidence remains available below.',
    teamLink: 'Open team governance',
    timeline: 'Immutable timeline',
    title: 'Private-beta invitations',
    updated: 'Updated',
  }),
  'pt-BR': Object.freeze({
    acceptedAccount: 'Uma conta aceita tem autoridade separada e nunca é suspensa por esta tela.',
    active: 'Ativos',
    batch: 'Ação em lote',
    batchApproval: 'A aprovação independente obrigatória foi concedida',
    batchImpact: 'Revisei os convites afetados e os efeitos irreversíveis',
    campaign: 'Referência da campanha',
    capacityUnavailable: 'A capacidade de convites está indisponível no momento.',
    close: 'Fechar inspeção do convite',
    create: 'Criar convites',
    createDescription:
      'O preflight classifica cada destinatário antes de qualquer convite entrar na capacidade ou fila.',
    csv: 'Lote / CSV',
    decline: 'Recusados',
    delivery: 'Problemas de entrega',
    description:
      'Crie, enfileire, inspecione, reenvie, revogue e audite convites da beta privada sob uma única autoridade.',
    empty: 'Nenhum convite está disponível nesta visão autorizada.',
    errorDetail:
      'A existência de convites não é revelada quando a autoridade não pode ser admitida.',
    errorTitle: 'Autoridade de convites indisponível',
    expiring: 'Expirando em breve',
    expiry: 'Validade',
    firstUse: 'Nenhum convite da beta privada foi admitido ainda.',
    history: 'Todo o histórico',
    individual: 'Individual',
    inspector: 'Detalhe do convite',
    issue: 'Emitir convites revisados',
    jobs: 'Trabalhos duráveis de convite',
    legalRetention: 'Retenção e bloqueio legal',
    list: 'Livro de convites',
    loading: 'Carregando convites autorizados pelo servidor',
    locale: 'Idioma do convite',
    mutationErrorDetail:
      'Nenhum convite foi admitido e nenhum comprovante durável foi criado. Tente novamente apenas quando a autoridade de entrega estiver disponível.',
    mutationErrorTitle: 'Falha na operação de convite',
    mutationsPaused: 'Atualize os dados autoritativos antes de alterar convites.',
    preflight: 'Executar preflight',
    preflightResults: 'Revisão do preflight',
    queue: 'Fila',
    reason: 'Motivo operacional',
    recipient: 'E-mail do destinatário',
    recipientsCsv: 'Um destinatário por linha ou uma coluna recipient em CSV',
    refresh: 'Atualizar autoridade',
    reminders: 'Lembretes',
    resend: 'Reenviar convite',
    resendDescription:
      'O segredo atual para de funcionar. Escolha se a validade atual permanece ou reinicia por 14 dias.',
    restartExpiry: 'Reiniciar a janela de 14 dias',
    retainExpiry: 'Manter a validade atual',
    revoke: 'Revogar convite',
    revokeDescription:
      'O link para imediatamente. Uma conta já criada não será suspensa por esta ação.',
    revoked: 'Revogados',
    selected: 'selecionados',
    separateTeam:
      'Convites da equipe administrativa usam autoridade de governança separada e nunca compartilham ações da beta.',
    state: 'Estado',
    success:
      'A projeção autoritativa foi atualizada. A evidência durável permanece disponível abaixo.',
    teamLink: 'Abrir governança da equipe',
    timeline: 'Linha do tempo imutável',
    title: 'Convites da beta privada',
    updated: 'Atualizado',
  }),
});

const formatDate = (value: string | undefined, locale: WebLocale): string => {
  if (value === undefined || Number.isNaN(Date.parse(value))) return '—';
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(value));
};

const viewLabels = (locale: WebLocale): Readonly<Record<InvitationView, string>> => {
  const labels = copy[locale];
  return {
    accepted: locale === 'pt-BR' ? 'Aceitos' : 'Accepted',
    active: labels.active,
    declined: labels.decline,
    delivery: labels.delivery,
    expiring: labels.expiring,
    history: labels.history,
    queue: labels.queue,
    revoked: labels.revoked,
  };
};

const filterInvitation = (
  invitation: AdminInvitationProjectionJson,
  view: InvitationView,
): boolean => {
  if (view === 'history') return true;
  if (view === 'active') return invitation.lifecycleState === 'active';
  if (view === 'queue') return invitation.lifecycleState === 'queued';
  if (view === 'delivery') return ['failed', 'permanent-bounce'].includes(invitation.deliveryState);
  if (view === 'expiring')
    return (
      invitation.lifecycleState === 'active' &&
      invitation.expiresAt !== undefined &&
      Date.parse(invitation.expiresAt) - Date.now() <= 3 * 24 * 60 * 60 * 1_000
    );
  if (view === 'accepted') return invitation.lifecycleState === 'accepted';
  if (view === 'declined') return invitation.lifecycleState === 'declined';
  return invitation.lifecycleState === 'revoked';
};

const recipientsFrom = (value: string): readonly string[] =>
  Object.freeze(
    value
      .split(/\r?\n/u)
      .map((line) => line.trim().replace(/^recipient\s*,?/iu, ''))
      .filter((line) => line.length > 0)
      .slice(0, 100),
  );

const formString = (data: FormData, key: string): string => {
  const value = data.get(key);
  return typeof value === 'string' ? value : '';
};

const Notice = ({
  model,
  locale,
}: Readonly<{ locale: WebLocale; model: InvitationWorkspaceModel }>) => {
  const labels = copy[locale];
  if (model.authority.state === 'live') return null;
  return (
    <LbOperationalNotice
      detail={labels.mutationsPaused}
      state={model.authority.state === 'offline' ? 'offline' : model.authority.state}
      title={
        model.authority.state === 'reconnecting'
          ? locale === 'pt-BR'
            ? 'Reconectando aos convites'
            : 'Reconnecting to invitations'
          : locale === 'pt-BR'
            ? 'Convites aguardando autoridade atual'
            : 'Invitations awaiting current authority'
      }
    />
  );
};

const Capacity = ({
  model,
  locale,
}: Readonly<{ locale: WebLocale; model: InvitationWorkspaceModel }>) => {
  const labels = copy[locale];
  if (model.capacity === null)
    return <p className={styles['capacity']}>{labels.capacityUnavailable}</p>;
  return (
    <p className={styles['capacity']}>
      <strong>
        {model.capacity.activeCount} {locale === 'pt-BR' ? 'de' : 'of'} {model.capacity.activeLimit}{' '}
        {locale === 'pt-BR' ? 'ativos' : 'active'}
      </strong>
      <span>
        {model.capacity.queuedCount} {locale === 'pt-BR' ? 'na fila' : 'queued'}
        {model.capacity.forecastExhaustionAt
          ? ` · ${locale === 'pt-BR' ? 'previsão' : 'forecast'} ${formatDate(model.capacity.forecastExhaustionAt, locale)}`
          : ''}
      </span>
    </p>
  );
};

const InvitationLedger = ({
  invitations,
  locale,
  onOpen,
  selected,
  setSelected,
}: Readonly<{
  invitations: readonly AdminInvitationProjectionJson[];
  locale: WebLocale;
  onOpen: (event: MouseEvent<HTMLAnchorElement>, invitation: AdminInvitationProjectionJson) => void;
  selected: ReadonlySet<string>;
  setSelected: (next: ReadonlySet<string>) => void;
}>) => {
  const labels = copy[locale];
  return (
    <>
      <p className={styles['selection']} aria-live="polite">
        {selected.size} {labels.selected}
      </p>
      <div className={styles['tableViewport']} role="region" aria-label={labels.list} tabIndex={0}>
        <table className={styles['table']}>
          <caption className="lb-visually-hidden">{labels.list}</caption>
          <thead>
            <tr>
              <th scope="col">
                <span className="lb-visually-hidden">{labels.selected}</span>
              </th>
              <th scope="col">{labels.recipient}</th>
              <th scope="col">{labels.state}</th>
              <th scope="col">{labels.campaign}</th>
              <th scope="col">{labels.expiry}</th>
              <th scope="col">{labels.reminders}</th>
            </tr>
          </thead>
          <tbody>
            {invitations.map((invitation) => (
              <tr key={invitation.invitationId} data-state={invitation.lifecycleState}>
                <td>
                  <label className={styles['checkbox']}>
                    <input
                      aria-label={`${labels.recipient} ${invitation.recipientMasked}`}
                      checked={selected.has(invitation.invitationId)}
                      onChange={(event) => {
                        const next = new Set(selected);
                        if (event.currentTarget.checked) next.add(invitation.invitationId);
                        else next.delete(invitation.invitationId);
                        setSelected(next);
                      }}
                      type="checkbox"
                    />
                  </label>
                </td>
                <td>
                  <a
                    href={`/${locale}/admin/people/invitations/${encodeURIComponent(invitation.invitationId)}`}
                    onClick={(event) => {
                      onOpen(event, invitation);
                    }}
                  >
                    <strong>{invitation.recipientMasked}</strong>
                    <code>{invitation.invitationId}</code>
                  </a>
                </td>
                <td>
                  <span className={styles['status']}>{invitation.lifecycleState}</span>
                </td>
                <td>{invitation.campaignReference ?? '—'}</td>
                <td>{formatDate(invitation.expiresAt, locale)}</td>
                <td>{invitation.reminderCount} / 2</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className={styles['mobileList']} aria-label={labels.list}>
        {invitations.map((invitation) => (
          <li key={invitation.invitationId}>
            <a
              href={`/${locale}/admin/people/invitations/${encodeURIComponent(invitation.invitationId)}`}
            >
              <span>
                <strong>{invitation.recipientMasked}</strong>
                <span className={styles['status']}>{invitation.lifecycleState}</span>
              </span>
              <code>{invitation.invitationId}</code>
              <span>
                {invitation.campaignReference ?? '—'} · {formatDate(invitation.expiresAt, locale)}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </>
  );
};

const PreflightReview = ({
  locale,
  preflight,
}: Readonly<{ locale: WebLocale; preflight: InvitationPreflight }>) => {
  const labels = copy[locale];
  return (
    <section className={styles['preflight']} aria-labelledby="invitation-preflight-title">
      <header>
        <h3 id="invitation-preflight-title">{labels.preflightResults}</h3>
        <p>
          {preflight.counts.willActivate}{' '}
          {locale === 'pt-BR' ? 'entram na capacidade' : 'become active'} ·{' '}
          {preflight.counts.queued} {locale === 'pt-BR' ? 'entram na fila' : 'enter the queue'} ·{' '}
          {preflight.counts.skipped} {locale === 'pt-BR' ? 'exigem correção' : 'need remediation'}
        </p>
      </header>
      <ul>
        {preflight.rows.map((row) => (
          <li key={row.rowId}>
            <code>{row.rowId}</code>
            <span>{row.recipientMasked}</span>
            <strong>{row.classification}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
};

const CreateInvitations = ({
  locale,
  model,
  onIssue,
  onPreflight,
}: Readonly<{
  locale: WebLocale;
  model: InvitationWorkspaceModel;
  onIssue?: (input: IssueInput) => void;
  onPreflight?: (input: PreflightInput) => void;
}>) => {
  const labels = copy[locale];
  const [mode, setMode] = useState<'individual' | 'csv'>(model.preflight?.mode ?? 'individual');
  const formRef = useRef<HTMLFormElement | null>(null);
  const formInput = (): PreflightInput => {
    const data = new FormData(formRef.current ?? undefined);
    const raw = formString(data, 'recipients');
    return {
      campaign: formString(data, 'campaign').trim(),
      locale: formString(data, 'locale') === 'en' ? 'en' : 'pt-BR',
      mode,
      recipients: mode === 'individual' ? Object.freeze([raw.trim()]) : recipientsFrom(raw),
    };
  };
  return (
    <section className={styles['create']} aria-labelledby="create-invitations-title">
      <header>
        <div>
          <h2 id="create-invitations-title">{labels.create}</h2>
          <p>{labels.createDescription}</p>
        </div>
        <div className={styles['segmented']} role="group" aria-label={labels.create}>
          <LbButton
            onPress={() => {
              setMode('individual');
            }}
            variant={mode === 'individual' ? 'primary' : 'quiet'}
          >
            {labels.individual}
          </LbButton>
          <LbButton
            onPress={() => {
              setMode('csv');
            }}
            variant={mode === 'csv' ? 'primary' : 'quiet'}
          >
            {labels.csv}
          </LbButton>
        </div>
      </header>
      <form
        ref={formRef}
        onSubmit={(event) => {
          event.preventDefault();
          onPreflight?.(formInput());
        }}
      >
        <label className={styles['field']}>
          <span>{mode === 'individual' ? labels.recipient : labels.recipientsCsv}</span>
          {mode === 'individual' ? (
            <input name="recipients" required type="email" />
          ) : (
            <textarea maxLength={32768} name="recipients" required rows={5} />
          )}
        </label>
        <label className={styles['field']}>
          <span>{labels.campaign}</span>
          <input maxLength={128} name="campaign" required />
        </label>
        <label className={styles['field']}>
          <span>{labels.locale}</span>
          <select defaultValue={locale} name="locale">
            <option value="pt-BR">Português (Brasil)</option>
            <option value="en">English</option>
          </select>
        </label>
        <label className={styles['field']}>
          <span>{labels.reason}</span>
          <textarea maxLength={256} minLength={8} name="reason" required rows={3} />
        </label>
        <div className={styles['formActions']}>
          <LbButton isDisabled={!model.authority.canMutate} type="submit" variant="secondary">
            {labels.preflight}
          </LbButton>
          <LbButton
            isDisabled={!model.authority.canMutate || model.preflight?.canIssue !== true}
            onPress={() => {
              const data = new FormData(formRef.current ?? undefined);
              onIssue?.({ ...formInput(), reason: formString(data, 'reason').trim() });
            }}
            variant="primary"
          >
            {labels.issue}
          </LbButton>
        </div>
      </form>
      {model.preflight === null ? null : (
        <PreflightReview locale={locale} preflight={model.preflight} />
      )}
    </section>
  );
};

const Jobs = ({
  jobs,
  locale,
}: Readonly<{ jobs: readonly InvitationJob[]; locale: WebLocale }>) => {
  const labels = copy[locale];
  return (
    <section className={styles['jobs']} aria-labelledby="invitation-jobs-title">
      <header>
        <h2 id="invitation-jobs-title">{labels.jobs}</h2>
        <span>{jobs.length}</span>
      </header>
      {jobs.length === 0 ? (
        <p>{labels.empty}</p>
      ) : (
        <ul>
          {jobs.map((job) => (
            <li key={job.jobId}>
              <div>
                <ProductIcon name="activity" size={18} />
                <strong>{job.jobId}</strong>
                <span>{job.state}</span>
              </div>
              {job.progressPercent === undefined ? null : (
                <progress
                  aria-label={`${labels.jobs}: ${job.jobId}`}
                  max={100}
                  value={job.progressPercent}
                />
              )}
              <p>
                {job.completedItems} / {job.totalItems} · {job.failedItems}{' '}
                {locale === 'pt-BR' ? 'falhas' : 'failed'}
              </p>
              {job.receiptReference === undefined ? null : <code>{job.receiptReference}</code>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

const Inspector = ({
  invitation,
  locale,
  model,
  onClose,
  onResend,
  onRevoke,
}: Readonly<{
  invitation: AdminInvitationProjectionJson;
  locale: WebLocale;
  model: InvitationWorkspaceModel;
  onClose: () => void;
  onResend?: InvitationReadyActions['onResend'];
  onRevoke?: InvitationReadyActions['onRevoke'];
}>) => {
  const labels = copy[locale];
  const actions = classifyInvitationActions({
    invitation,
    invitationKind: 'beta',
    now: model.observedAt ?? new Date().toISOString(),
  });
  const [expiryMode, setExpiryMode] = useState<'preserve' | 'restart'>('preserve');
  const resendRef = useRef<HTMLFormElement | null>(null);
  const revokeRef = useRef<HTMLFormElement | null>(null);
  return (
    <aside className={styles['inspector']} aria-labelledby="invitation-inspector-title">
      <header>
        <div>
          <span>{labels.inspector}</span>
          <h2 id="invitation-inspector-title">{invitation.recipientMasked}</h2>
          <code>{invitation.invitationId}</code>
        </div>
        <LbButton ariaLabel={labels.close} onPress={onClose} variant="quiet">
          <ProductIcon name="close" size={18} />
        </LbButton>
      </header>
      <dl>
        <div>
          <dt>{labels.state}</dt>
          <dd>
            {invitation.lifecycleState} · {invitation.deliveryState}
          </dd>
        </div>
        <div>
          <dt>{labels.expiry}</dt>
          <dd>{formatDate(invitation.expiresAt, locale)}</dd>
        </div>
        <div>
          <dt>{labels.campaign}</dt>
          <dd>{invitation.campaignReference ?? '—'}</dd>
        </div>
        <div>
          <dt>{labels.reminders}</dt>
          <dd>{invitation.reminderCount} / 2</dd>
        </div>
        <div>
          <dt>{labels.updated}</dt>
          <dd>{formatDate(invitation.lastEventAt, locale)}</dd>
        </div>
      </dl>
      <section className={styles['timeline']} aria-labelledby="invitation-timeline-title">
        <h3 id="invitation-timeline-title">{labels.timeline}</h3>
        {model.timeline.length === 0 ? (
          <p>
            {locale === 'pt-BR'
              ? 'Nenhum evento autorizado disponível.'
              : 'No authorized event is available.'}
          </p>
        ) : (
          <ol>
            {model.timeline.map((event) => (
              <li key={`${event.at}:${event.kind}`}>
                <span>{event.kind}</span>
                <time dateTime={event.at}>{formatDate(event.at, locale)}</time>
                {event.outcome ? <code>{event.outcome}</code> : null}
              </li>
            ))}
          </ol>
        )}
      </section>
      {actions.admitted && actions.canResend ? (
        <form
          ref={resendRef}
          className={styles['actionForm']}
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            onResend?.(invitation, { expiryMode, reason: formString(data, 'reason').trim() });
          }}
        >
          <h3>{labels.resend}</h3>
          <p>{labels.resendDescription}</p>
          <label>
            <input
              checked={expiryMode === 'preserve'}
              name="expiry"
              onChange={() => {
                setExpiryMode('preserve');
              }}
              type="radio"
            />
            {labels.retainExpiry}
          </label>
          <label>
            <input
              checked={expiryMode === 'restart'}
              name="expiry"
              onChange={() => {
                setExpiryMode('restart');
              }}
              type="radio"
            />
            {labels.restartExpiry}
          </label>
          <label className={styles['field']}>
            <span>{labels.reason}</span>
            <textarea maxLength={256} minLength={8} name="reason" required rows={3} />
          </label>
          <LbButton isDisabled={!model.authority.canMutate} type="submit" variant="secondary">
            {labels.resend}
          </LbButton>
        </form>
      ) : null}
      {actions.admitted && actions.canRevoke ? (
        <form
          ref={revokeRef}
          className={styles['actionForm']}
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            onRevoke?.(invitation, formString(data, 'reason').trim());
          }}
        >
          <h3>{labels.revoke}</h3>
          <p>{labels.revokeDescription}</p>
          <label className={styles['field']}>
            <span>{labels.reason}</span>
            <textarea maxLength={256} minLength={8} name="reason" required rows={3} />
          </label>
          <LbButton isDisabled={!model.authority.canMutate} type="submit" variant="destructive">
            {labels.revoke}
          </LbButton>
        </form>
      ) : null}
      {invitation.lifecycleState === 'accepted' ? (
        <p className={styles['acceptedNote']}>{labels.acceptedAccount}</p>
      ) : null}
      <section className={styles['retention']}>
        <h3>{labels.legalRetention}</h3>
        <p>
          {model.retention === null
            ? '—'
            : `${model.retention.action}${model.retention.basis ? ` · ${model.retention.basis}` : ''}`}
        </p>
      </section>
    </aside>
  );
};

export const AdminInvitationsView = (props: AdminInvitationsViewProps) => {
  const labels = copy[props.locale];
  const requestedSelectedId = props.state === 'ready' ? props.model.selectedId : undefined;
  const [selectedId, setSelectedId] = useState(requestedSelectedId);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(
    props.state === 'ready' && props.model.preflight !== null,
  );
  const opener = useRef<HTMLAnchorElement | null>(null);
  useEffect(() => {
    setSelectedId(requestedSelectedId);
  }, [requestedSelectedId]);
  if (props.state === 'loading') {
    return (
      <article className={styles['workspace']} data-invitation-state="loading">
        <header className={styles['routeHeader']}>
          <div>
            <h1>{labels.title}</h1>
            <p>{labels.description}</p>
          </div>
        </header>
        <LbSkeletonRegion label={labels.loading} rows={8} />
      </article>
    );
  }
  if (props.state === 'error') {
    return (
      <article className={styles['workspace']} data-invitation-state="error">
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
  const visible = model.invitations.filter((item) => filterInvitation(item, model.view));
  const selectedInvitation = model.invitations.find((item) => item.invitationId === selectedId);
  const views = Object.keys(viewLabels(props.locale)) as InvitationView[];
  const openInvitation = (
    event: MouseEvent<HTMLAnchorElement>,
    invitation: AdminInvitationProjectionJson,
  ) => {
    if (!window.matchMedia('(min-width: 640px)').matches) return;
    event.preventDefault();
    opener.current = event.currentTarget;
    setSelectedId(invitation.invitationId);
    props.onSelect?.(invitation.invitationId);
  };
  return (
    <article className={styles['workspace']} data-invitation-state={model.authority.state}>
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
      <Notice locale={props.locale} model={model} />
      {model.mutationFeedback?.status === 'conflict' ? (
        <LbOperationalNotice
          detail={labels.mutationsPaused}
          state="stale"
          title={props.locale === 'pt-BR' ? 'Conflito de versão' : 'Version conflict'}
        />
      ) : null}
      {model.mutationFeedback?.status === 'error' || model.mutationFeedback?.status === 'denied' ? (
        <LbOperationalNotice
          detail={labels.mutationErrorDetail}
          state="degraded"
          title={labels.mutationErrorTitle}
        />
      ) : null}
      {model.mutationFeedback?.status === 'complete' ||
      model.mutationFeedback?.status === 'partial' ? (
        <p className={styles['success']} role="status">
          <strong>{props.locale === 'pt-BR' ? 'Operação registrada' : 'Operation recorded'}</strong>
          <span>{labels.success}</span>
        </p>
      ) : null}
      <section className={styles['teamBoundary']}>
        <ProductIcon name="shield" size={20} />
        <p>{labels.separateTeam}</p>
        <a href={`/${props.locale}/admin/people/team`}>{labels.teamLink}</a>
      </section>
      <div className={styles['commandRow']}>
        <Capacity locale={props.locale} model={model} />
        <div>
          <LbButton
            onPress={() => {
              setCreateOpen((value) => !value);
            }}
            variant="primary"
          >
            {labels.create}
          </LbButton>
          <LbButton
            isDisabled={!model.authority.requiresRefetch}
            {...(props.onRefresh === undefined ? {} : { onPress: props.onRefresh })}
            variant="quiet"
          >
            {labels.refresh}
          </LbButton>
        </div>
      </div>
      {createOpen ? (
        <CreateInvitations
          locale={props.locale}
          model={model}
          {...(props.onIssue ? { onIssue: props.onIssue } : {})}
          {...(props.onPreflight ? { onPreflight: props.onPreflight } : {})}
        />
      ) : null}
      <nav className={styles['views']} aria-label={labels.list}>
        {views.map((view) => (
          <a
            key={view}
            aria-current={model.view === view ? 'page' : undefined}
            href={`?view=${view}`}
            onClick={(event) => {
              event.preventDefault();
              props.onViewChange?.(view);
            }}
          >
            {viewLabels(props.locale)[view]}
          </a>
        ))}
      </nav>
      <div
        className={styles['canvas']}
        data-inspector-open={selectedInvitation !== undefined || undefined}
      >
        <section className={styles['ledger']} aria-labelledby="invitation-ledger-title">
          <header>
            <div>
              <h2 id="invitation-ledger-title">{viewLabels(props.locale)[model.view]}</h2>
              <p>
                {visible.length}{' '}
                {props.locale === 'pt-BR' ? 'registros autorizados' : 'authorized records'}
              </p>
            </div>
            <span>
              {labels.updated}: {formatDate(model.observedAt, props.locale)}
            </span>
          </header>
          {visible.length === 0 ? (
            <div className={styles['empty']} role="status">
              <ProductIcon name="list" size={24} />
              <div>
                <strong>{model.firstUse ? labels.firstUse : labels.empty}</strong>
                <p>{model.firstUse ? labels.createDescription : labels.refresh}</p>
              </div>
            </div>
          ) : (
            <InvitationLedger
              invitations={visible}
              locale={props.locale}
              onOpen={openInvitation}
              selected={selected}
              setSelected={setSelected}
            />
          )}
          <form
            className={styles['batch']}
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              props.onBatch?.({
                action: data.get('action') === 'resend' ? 'resend' : 'revoke',
                approvalGranted: data.get('approval') === 'on',
                impactReviewed: data.get('impact') === 'on',
                invitationIds: [...selected],
                reason: formString(data, 'reason').trim(),
              });
            }}
          >
            <h3>{labels.batch}</h3>
            <label className={styles['field']}>
              <span>{labels.state}</span>
              <select name="action">
                <option value="resend">{labels.resend}</option>
                <option value="revoke">{labels.revoke}</option>
              </select>
            </label>
            <label className={styles['field']}>
              <span>{labels.reason}</span>
              <textarea maxLength={256} minLength={8} name="reason" required rows={2} />
            </label>
            <label className={styles['checkLine']}>
              <input name="impact" type="checkbox" />
              {labels.batchImpact}
            </label>
            <label className={styles['checkLine']}>
              <input name="approval" type="checkbox" />
              {labels.batchApproval}
            </label>
            <LbButton
              isDisabled={!model.authority.canMutate || selected.size === 0}
              type="submit"
              variant="destructive"
            >
              {labels.batch}
            </LbButton>
          </form>
        </section>
        {selectedInvitation === undefined ? null : (
          <Inspector
            invitation={selectedInvitation}
            locale={props.locale}
            model={model}
            onClose={() => {
              setSelectedId(undefined);
              props.onSelect?.(undefined);
              requestAnimationFrame(() => opener.current?.focus());
            }}
            {...(props.onResend ? { onResend: props.onResend } : {})}
            {...(props.onRevoke ? { onRevoke: props.onRevoke } : {})}
          />
        )}
      </div>
      <Jobs jobs={model.jobs} locale={props.locale} />
    </article>
  );
};

const onlineRecords = (result: AdminQueryResult): readonly AdminAuthorityDocument[] =>
  result.status === 'online' ? result.records : [];
const isInvitation = (record: AdminAuthorityDocument): record is AdminInvitationProjectionJson =>
  record.kind === 'admin-invitation-projection';
const isCapacity = (
  record: AdminAuthorityDocument,
): record is AdminInvitationCapacityProjectionJson =>
  record.kind === 'admin-invitation-capacity-projection';
const isJob = (record: AdminAuthorityDocument): record is AdminJobProjectionJson =>
  record.kind === 'admin-job-projection';

const invitationJob = (job: AdminJobProjectionJson): InvitationJob =>
  projectInvitationJob({
    completedItems: job.completedItems,
    failedItems: job.failedItems,
    jobId: job.jobId,
    progressPercent: job.progressPercent,
    ...(job.receiptReference === undefined ? {} : { receiptReference: job.receiptReference }),
    state: job.state,
    totalItems: job.totalItems,
  });

const parseView = (): InvitationView => {
  if (typeof window === 'undefined') return 'active';
  const candidate = new URLSearchParams(window.location.search).get('view');
  return [
    'active',
    'queue',
    'delivery',
    'expiring',
    'accepted',
    'declined',
    'revoked',
    'history',
  ].includes(String(candidate))
    ? (candidate as InvitationView)
    : 'active';
};

const parseSelectedInvitation = (): string | undefined => {
  if (typeof window === 'undefined') return undefined;
  const segments = window.location.pathname.split('/').filter(Boolean);
  const invitationsIndex = segments.lastIndexOf('invitations');
  const encoded = invitationsIndex < 0 ? undefined : segments[invitationsIndex + 1];
  if (encoded === undefined) return undefined;
  try {
    const decoded = decodeURIComponent(encoded);
    return /^[A-Za-z0-9._:-]{1,128}$/u.test(decoded) ? decoded : undefined;
  } catch {
    return undefined;
  }
};

export const AdminInvitations = ({
  initialSelectedId,
  locale,
}: Readonly<{ initialSelectedId?: string; locale: WebLocale }>) => {
  const { authority, authorizeMutation, freshness, revision, session } = useAdminAuthority();
  const [results, setResults] = useState<AdminQueryResult | null>(null);
  const [view, setView] = useState<InvitationView>(parseView);
  const [selectedId, setSelectedId] = useState<string | undefined>(
    () => initialSelectedId ?? parseSelectedInvitation(),
  );
  const [detail, setDetail] = useState<Extract<
    Awaited<ReturnType<typeof authority.loadInvitation>>,
    { status: 'online' }
  > | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [invalidated, setInvalidated] = useState(false);
  const [mutationFeedback, setMutationFeedback] = useState<AdminMutationResult | null>(null);
  const [preflight, setPreflight] = useState<Readonly<{
    input: PreflightInput;
    review: InvitationPreflight;
  }> | null>(null);
  useEffect(() => {
    if (freshness !== 'live') setInvalidated(true);
  }, [freshness]);
  useEffect(() => {
    if (session === null || session === undefined) return undefined;
    const controller = new AbortController();
    void authority
      .query('invitations', {
        environment: 'staging',
        limit: 100,
        signal: controller.signal,
      })
      .then((result) => {
        if (controller.signal.aborted) return;
        setResults(result);
        if (result.status === 'online') setInvalidated(false);
      });
    return () => {
      controller.abort();
    };
  }, [authority, refresh, revision, session]);
  useEffect(() => {
    if (session === null || session === undefined || selectedId === undefined) {
      setDetail(null);
      return undefined;
    }
    const controller = new AbortController();
    void authority
      .loadInvitation({ invitationId: selectedId, signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        setDetail(result.status === 'online' ? result : null);
      });
    return () => {
      controller.abort();
    };
  }, [authority, revision, selectedId, session]);
  const model = useMemo<InvitationWorkspaceModel | null>(() => {
    if (results === null || session === null || session === undefined) return null;
    const records = onlineRecords(results);
    const state: InvitationAuthorityState =
      results.status !== 'online'
        ? 'degraded'
        : invalidated || freshness !== 'live'
          ? freshness === 'live'
            ? 'stale'
            : freshness
          : 'live';
    const invitations = records.filter(isInvitation);
    const capacity = records.find(isCapacity) ?? null;
    return Object.freeze({
      authority: Object.freeze({
        canMutate: state === 'live',
        requiresRefetch: state !== 'live',
        state,
      }),
      capacity,
      firstUse: invitations.length === 0,
      invitations: Object.freeze(invitations),
      jobs: Object.freeze(records.filter(isJob).map(invitationJob)),
      mutationFeedback,
      nextCursor: results.status === 'online' ? results.nextCursor : null,
      ...(results.status === 'online' && results.freshness?.observedAt
        ? { observedAt: results.freshness.observedAt }
        : {}),
      preflight: preflight?.review ?? null,
      retention: detail?.retention ?? null,
      ...(selectedId === undefined ? {} : { selectedId }),
      timeline: detail?.timeline ?? Object.freeze([]),
      view,
    });
  }, [
    detail,
    freshness,
    invalidated,
    mutationFeedback,
    preflight,
    results,
    selectedId,
    session,
    view,
  ]);
  if (results !== null && results.status !== 'online') {
    return <AdminInvitationsView errorCode={results.code} locale={locale} state="error" />;
  }
  if (model === null || session === null || session === undefined)
    return <AdminInvitationsView locale={locale} state="loading" />;
  const command = (
    action: AdminOperationActionJson,
    targets: readonly string[],
    reason: string,
    expectedVersion: string,
    expectedEtag: string,
  ): AdminOperationCommandJson => {
    const commandId = crypto.randomUUID();
    return {
      schemaVersion: '1.0',
      kind: 'admin-operation-command',
      commandId,
      actorId: session.actorId,
      activeFunction: session.role,
      action,
      targetReferences: targets as [string, ...string[]],
      reason,
      expectedVersion,
      expectedEtag,
      approvalReferences: [],
      correlationId: `admin-browser-${commandId}`,
      requestedAt: new Date().toISOString(),
    };
  };
  const mutate = async (input: AdminMutationInput, refetch = true) => {
    const authorized = await authorizeMutation(input);
    const result =
      authorized === null
        ? ({ code: 'unauthorized', status: 'denied' } as const)
        : await authority.mutate(authorized);
    setMutationFeedback(result);
    if (refetch && (result.status === 'complete' || result.status === 'partial'))
      setRefresh((value) => value + 1);
    return result;
  };
  const samePreflightInput = (left: PreflightInput, right: PreflightInput): boolean =>
    left.campaign === right.campaign &&
    left.locale === right.locale &&
    left.mode === right.mode &&
    left.recipients.length === right.recipients.length &&
    left.recipients.every((recipient, index) => recipient === right.recipients[index]);
  return (
    <AdminInvitationsView
      locale={locale}
      model={model}
      onBatch={(input) => {
        const key = crypto.randomUUID();
        void mutate({
          family: 'batch-invitations',
          idempotencyKey: key,
          payload: {
            action: input.action,
            approvalGranted: input.approvalGranted,
            authorizationContextId: key,
            command: command(
              input.action === 'resend' ? 'resend-invitations' : 'revoke-invitations',
              input.invitationIds,
              input.reason,
              '0',
              'batch-current',
            ),
            idempotencyKey: key,
            impactReviewed: input.impactReviewed,
            items: input.invitationIds.map((invitationId) => ({ invitationId })),
            risk: input.invitationIds.length > 10 ? 'high' : 'standard',
          },
          reason: input.reason,
        });
      }}
      onIssue={(input) => {
        if (preflight === null || !samePreflightInput(preflight.input, input)) {
          setPreflight(null);
          setMutationFeedback({ code: 'invalid-authority', status: 'error' });
          return;
        }
        const recipients = preflight.review.rows.flatMap((row, index) =>
          row.classification === 'valid' && input.recipients[index] !== undefined
            ? [input.recipients[index]]
            : [],
        );
        void (async () => {
          const outcomes: AdminMutationResult[] = [];
          for (const recipient of recipients) {
            const invitationId = crypto.randomUUID();
            const key = crypto.randomUUID();
            outcomes.push(
              await mutate({
                expectedVersion: '0',
                family: 'issue-invitations',
                idempotencyKey: key,
                payload: {
                  authorizationContextId: key,
                  campaign: input.campaign,
                  command: command(
                    'issue-invitations',
                    [invitationId],
                    input.reason,
                    '0',
                    'new-invitation',
                  ),
                  idempotencyKey: key,
                  invitationId,
                  locale: input.locale,
                  recipient,
                },
                reason: input.reason,
                targetId: invitationId,
              }),
            );
          }
          const completed = outcomes.filter(
            (
              result,
            ): result is Extract<AdminMutationResult, { document: AdminAuthorityDocument }> =>
              (result.status === 'complete' || result.status === 'partial') && 'document' in result,
          );
          const completedDocument = completed.at(-1)?.document;
          const last = outcomes.at(-1);
          setMutationFeedback(
            completedDocument !== undefined && completed.length < outcomes.length
              ? {
                  document: completedDocument,
                  status: 'partial',
                }
              : (last ?? { code: 'invalid-authority', status: 'error' }),
          );
          if (completed.length > 0) setRefresh((value) => value + 1);
          setPreflight(null);
        })();
      }}
      onPreflight={(input) => {
        const capacity = model.capacity;
        if (capacity === null) {
          setPreflight(null);
          setMutationFeedback({ code: 'invalid-authority', status: 'error' });
          return;
        }
        const key = crypto.randomUUID();
        const targets = input.recipients.map((_recipient, index) => `row-${String(index + 1)}`);
        void mutate(
          {
            family: 'preflight-invitations',
            idempotencyKey: key,
            payload: {
              authorizationContextId: key,
              command: command(
                'issue-invitations',
                targets,
                'Review invitation recipients before issuance',
                '0',
                'invitation-preflight',
              ),
              rows: input.recipients.map((recipient, index) => ({
                recipient,
                rowId: `row-${String(index + 1)}`,
              })),
            },
          },
          false,
        ).then((result) => {
          if (result.status !== 'complete' || !('preflight' in result)) {
            setPreflight(null);
            return;
          }
          try {
            const review = reviewInvitationPreflight({
              capacity,
              mode: input.mode,
              rows: result.preflight.rows.map((row, index) => ({
                classification: row.classification,
                recipient: input.recipients[index] ?? '',
                rowId: row.rowId,
              })),
            });
            setPreflight({ input, review });
          } catch {
            setPreflight(null);
            setMutationFeedback({ code: 'invalid-authority', status: 'error' });
          }
        });
      }}
      onRefresh={() => {
        setRefresh((value) => value + 1);
      }}
      onSelect={(invitationId) => {
        setSelectedId(invitationId);
        const url = new URL(window.location.href);
        url.pathname =
          invitationId === undefined
            ? `/${locale}/admin/people/invitations`
            : `/${locale}/admin/people/invitations/${encodeURIComponent(invitationId)}`;
        window.history.replaceState(window.history.state, '', url);
      }}
      onResend={(invitation, input) => {
        const key = crypto.randomUUID();
        void mutate({
          expectedEtag: invitation.etag,
          expectedVersion: invitation.aggregateVersion,
          family: 'resend-invitation',
          idempotencyKey: key,
          payload: {
            authorizationContextId: key,
            command: command(
              'resend-invitations',
              [invitation.invitationId],
              input.reason,
              invitation.aggregateVersion,
              invitation.etag,
            ),
            expiryMode: input.expiryMode,
            idempotencyKey: key,
          },
          reason: input.reason,
          targetId: invitation.invitationId,
        });
      }}
      onRevoke={(invitation, reason) => {
        const key = crypto.randomUUID();
        void mutate({
          expectedEtag: invitation.etag,
          expectedVersion: invitation.aggregateVersion,
          family: 'revoke-invitation',
          idempotencyKey: key,
          payload: {
            authorizationContextId: key,
            command: command(
              'revoke-invitations',
              [invitation.invitationId],
              reason,
              invitation.aggregateVersion,
              invitation.etag,
            ),
            idempotencyKey: key,
          },
          reason,
          targetId: invitation.invitationId,
        });
      }}
      onViewChange={(next) => {
        setView(next);
        const url = new URL(window.location.href);
        url.searchParams.set('view', next);
        window.history.replaceState(window.history.state, '', url);
      }}
      state="ready"
    />
  );
};
