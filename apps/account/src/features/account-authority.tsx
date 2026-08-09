'use client';

/* eslint @typescript-eslint/no-unnecessary-type-assertion: "off" -- Next.js typed Link requires Route assertions that Linux ESLint misclassifies. */

import { LbButton, LbTextField, ProductIcon } from '@liiiraa/design-system';
import { routeHref, type WebLocale } from '@liiiraa/web-core';
import type { Route } from 'next';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import type {
  AccountAuthorityProjection,
  AccountAuthorityReadResult,
  AccountProfileDraft,
} from '../account-authority';
import { subscriptionBillingKind } from '../account-commerce';
import { primeAccountCsrfToken } from '../account-auth';
import { advanceAccountMutationPhase, type AccountMutationPhase } from '../account-mutation';
import { getAccountRouteMetadata, type AccountRoute } from '../account-production-model';
import { mapAccountAuthorityProjection } from '../account-runtime';
import { getLiveAccountAuthority, type LiveAccountAuthority } from '../live-account-authority';
import { AccountSubscriptionAuthority } from './account-subscription-authority';

type AccountAuthorityPageProps = Readonly<{
  authorityBaseUrl: string;
  locale: WebLocale;
  routeId: AccountRoute;
}>;

type InvoiceState = AccountAuthorityProjection['invoices'][number]['state'];
type SubscriptionState = AccountAuthorityProjection['subscription']['state'];
type SupportCaseState = AccountAuthorityProjection['supportCases'][number]['state'];

const invoiceStateLabels = {
  en: {
    draft: 'Draft',
    open: 'Open',
    paid: 'Paid',
    uncollectible: 'Uncollectible',
    void: 'Voided',
  },
  'pt-BR': {
    draft: 'Rascunho',
    open: 'Em aberto',
    paid: 'Paga',
    uncollectible: 'Não recebida',
    void: 'Cancelada',
  },
} satisfies Record<WebLocale, Record<InvoiceState, string>>;

const subscriptionStateLabels = {
  en: {
    active: 'Active',
    canceled: 'Canceled',
    expired: 'Expired',
    none: 'No subscription',
    'past-due': 'Payment overdue',
    trialing: 'Trial period',
  },
  'pt-BR': {
    active: 'Ativa',
    canceled: 'Cancelada',
    expired: 'Expirada',
    none: 'Sem assinatura',
    'past-due': 'Pagamento pendente',
    trialing: 'Período de teste',
  },
} satisfies Record<WebLocale, Record<SubscriptionState, string>>;

const supportCaseStateLabels = {
  en: {
    closed: 'Closed',
    open: 'In progress',
    resolved: 'Resolved',
    'waiting-customer': 'Waiting for you',
    'waiting-support': 'Waiting for support',
  },
  'pt-BR': {
    closed: 'Encerrado',
    open: 'Em atendimento',
    resolved: 'Resolvido',
    'waiting-customer': 'Aguardando você',
    'waiting-support': 'Aguardando suporte',
  },
} satisfies Record<WebLocale, Record<SupportCaseState, string>>;

const copy = Object.freeze({
  en: Object.freeze({
    active: 'Active',
    authority: 'Account authority status',
    connected: 'Live account',
    conflict: 'The account changed remotely. Review the server value and your safe draft.',
    cooldown: 'Device replacement unavailable',
    edit: 'Edit profile',
    error: 'Account authority is unavailable',
    invoice: 'Billing history',
    loading: 'Loading your account',
    offline: 'Offline · last verified state',
    pending: 'Synchronizing',
    receipt: 'Profile update receipt',
    recovery: 'Recovery methods',
    replace: 'Replace device',
    save: 'Save changes',
    saved: 'Changes saved',
    security: 'Security posture',
    stale: 'Update required',
    support: 'Support requests',
  }),
  'pt-BR': Object.freeze({
    active: 'Ativo',
    authority: 'Status da autoridade da conta',
    connected: 'Conta sincronizada',
    conflict: 'A conta mudou remotamente. Revise o valor do servidor e seu rascunho seguro.',
    cooldown: 'Substituição de dispositivo indisponível',
    edit: 'Editar perfil',
    error: 'A autoridade da conta está indisponível',
    invoice: 'Histórico de cobrança',
    loading: 'Carregando sua conta',
    offline: 'Offline · último estado verificado',
    pending: 'Sincronizando',
    receipt: 'Recibo de atualização do perfil',
    recovery: 'Métodos de recuperação',
    replace: 'Substituir dispositivo',
    save: 'Salvar alterações',
    saved: 'Alterações salvas',
    security: 'Postura de segurança',
    stale: 'Atualização necessária',
    support: 'Solicitações de suporte',
  }),
});

const hrefFor = (routeId: AccountRoute, locale: WebLocale): string => {
  const result = routeHref(routeId, { locale });
  if (!result.ok) throw new Error(`ACCOUNT_ROUTE_UNAVAILABLE:${routeId}`);
  return result.value;
};

const formatDate = (value: string | undefined, locale: WebLocale): string =>
  value === undefined
    ? '—'
    : new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(value));

const formatMoney = (value: string, currency: string, locale: WebLocale): string =>
  new Intl.NumberFormat(locale, { currency, style: 'currency' }).format(Number(value) / 100);

const initialsFor = (displayName: string): string =>
  displayName
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

const AuthorityStatus = ({
  locale,
  status,
}: Readonly<{ locale: WebLocale; status: AccountAuthorityReadResult['status'] }>) => {
  const labels = copy[locale];
  const detail =
    status === 'online'
      ? labels.connected
      : status === 'pending'
        ? labels.pending
        : status === 'offline'
          ? labels.offline
          : status === 'stale'
            ? labels.stale
            : labels.error;
  return (
    <span
      aria-label={labels.authority}
      className="account-live-status"
      data-authority-tone={status === 'online' ? 'positive' : 'attention'}
    >
      <ProductIcon name={status === 'online' ? 'check' : 'info'} size={16} />
      <span>{detail}</span>
    </span>
  );
};

const ProfileAuthority = ({
  authority,
  authorityBaseUrl,
  locale,
  projection,
}: Readonly<{
  authority: LiveAccountAuthority;
  authorityBaseUrl: string;
  locale: WebLocale;
  projection: AccountAuthorityProjection;
}>) => {
  const labels = copy[locale];
  const [displayName, setDisplayName] = useState(projection.account.displayName);
  const [phase, setPhase] = useState<AccountMutationPhase>('idle');
  const [draft, setDraft] = useState<AccountProfileDraft | null>(null);
  const [failure, setFailure] = useState<
    'csrf' | 'invalid-authority' | 'unauthorized' | 'unavailable' | null
  >(null);
  const normalizedDisplayName = displayName.trim();
  const displayNameLength = [
    ...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(normalizedDisplayName),
  ].length;
  const invalidDisplayName = displayNameLength < 2 || displayNameLength > 80;
  const unchangedDisplayName = normalizedDisplayName === projection.account.displayName;
  const editing = ['reviewing', 'issuing', 'offline', 'stale', 'error'].includes(phase);
  useEffect(() => {
    if (phase === 'idle' || phase === 'complete') {
      setDisplayName(projection.account.displayName);
    }
  }, [phase, projection.account.aggregateVersion, projection.account.displayName]);

  const edit = () => {
    setDraft(null);
    setFailure(null);
    setPhase(advanceAccountMutationPhase(phase, 'review'));
  };
  const cancel = () => {
    setDisplayName(projection.account.displayName);
    setDraft(null);
    setFailure(null);
    setPhase('idle');
  };
  const save = async () => {
    if (invalidDisplayName || unchangedDisplayName) return;
    setDraft(null);
    setFailure(null);
    setPhase(advanceAccountMutationPhase('reviewing', 'issue'));
    if (!(await primeAccountCsrfToken(authorityBaseUrl))) {
      setFailure('csrf');
      setPhase(advanceAccountMutationPhase('issuing', 'error'));
      return;
    }
    const result = await authority.updateProfile({
      displayName,
      localDraftToken: `profile-${globalThis.crypto.randomUUID()}`,
      locale,
      projection,
    });
    if (result.status === 'conflict') setDraft(result.draft);
    if (result.status === 'error') setFailure(result.code);
    const event =
      result.status === 'complete'
        ? 'complete'
        : result.status === 'pending'
          ? 'pending'
          : result.status === 'conflict'
            ? 'conflict'
            : result.status === 'offline'
              ? 'offline'
              : result.status === 'stale'
                ? 'stale'
                : 'error';
    setPhase(advanceAccountMutationPhase('issuing', event));
  };

  const failureMessage =
    phase === 'offline'
      ? locale === 'pt-BR'
        ? 'A conexão caiu antes da confirmação. Seu texto continua aqui para você tentar novamente.'
        : 'The connection dropped before confirmation. Your text is still here so you can retry.'
      : phase === 'stale'
        ? locale === 'pt-BR'
          ? 'A conta recebeu uma atualização. Revise o nome e tente salvar novamente.'
          : 'The account received an update. Review the name and save again.'
        : failure === 'unauthorized'
          ? locale === 'pt-BR'
            ? 'Sua sessão precisa ser renovada antes de salvar este perfil.'
            : 'Your session must be renewed before this profile can be saved.'
          : failure === 'csrf'
            ? locale === 'pt-BR'
              ? 'Não foi possível preparar a proteção da alteração. Tente novamente em instantes.'
              : 'We could not prepare change protection. Try again in a moment.'
            : locale === 'pt-BR'
              ? 'Não foi possível confirmar a alteração. Nada foi perdido; revise e tente novamente.'
              : 'We could not confirm the change. Nothing was lost; review and try again.';

  return (
    <div className="account-live-grid" data-layout="7-5">
      <section
        className="account-live-card account-live-card--focus account-profile-workspace"
        data-workspace-region="focal"
      >
        <header className="account-live-card__header account-live-card__header--row">
          <span>
            <span className="account-live-kicker">
              {locale === 'pt-BR' ? 'Identidade pública' : 'Public identity'}
            </span>
            <h2>{locale === 'pt-BR' ? 'Como você aparece' : 'How you appear'}</h2>
            <p>
              {locale === 'pt-BR'
                ? 'Uma identidade consistente no aplicativo, na conta e no suporte.'
                : 'One consistent identity across the app, account, and support.'}
            </p>
          </span>
          <span className="account-live-badge" data-tone="positive">
            <ProductIcon name="check" size={14} />
            {locale === 'pt-BR' ? 'Confirmado' : 'Confirmed'}
          </span>
        </header>

        <div className="account-profile-identity-stage">
          <span className="account-live-profile-preview__avatar">
            {initialsFor(normalizedDisplayName || projection.account.displayName)}
          </span>
          <span>
            <small>{locale === 'pt-BR' ? 'Nome exibido' : 'Display name'}</small>
            <strong>{normalizedDisplayName || projection.account.displayName}</strong>
            <small>{projection.account.emailRedacted}</small>
          </span>
          <span className="account-profile-identity-stage__scope">
            <ProductIcon name="shield" size={16} />
            {locale === 'pt-BR'
              ? 'Visível só nas áreas autenticadas'
              : 'Visible only when signed in'}
          </span>
        </div>

        <div className="account-profile-editor-panel" data-editing={editing || undefined}>
          <span className="account-profile-editor-panel__copy">
            <strong>{locale === 'pt-BR' ? 'Nome de exibição' : 'Display name'}</strong>
            <small>
              {locale === 'pt-BR'
                ? 'Use o nome pelo qual você quer ser reconhecido no Liiiraa Boost.'
                : 'Use the name you want to be known by in Liiiraa Boost.'}
            </small>
          </span>
          {editing ? (
            <div className="account-profile-editor-panel__form">
              <LbTextField
                autoFocus={phase === 'reviewing'}
                description={
                  locale === 'pt-BR'
                    ? `${String(displayNameLength)} de 80 caracteres · mínimo de 2`
                    : `${String(displayNameLength)} of 80 characters · 2 minimum`
                }
                errorMessage={
                  invalidDisplayName
                    ? locale === 'pt-BR'
                      ? 'Digite um nome entre 2 e 80 caracteres.'
                      : 'Enter a name between 2 and 80 characters.'
                    : undefined
                }
                isDisabled={phase === 'issuing'}
                isInvalid={invalidDisplayName}
                isRequired
                label={locale === 'pt-BR' ? 'Nome de exibição' : 'Display name'}
                maxLength={80}
                onChange={(value) => {
                  setDisplayName(value);
                  if (phase === 'offline' || phase === 'stale' || phase === 'error') {
                    setFailure(null);
                    setPhase(advanceAccountMutationPhase(phase, 'review'));
                  }
                }}
                value={displayName}
              />
              <div className="account-profile__actions">
                <LbButton isDisabled={phase === 'issuing'} onPress={cancel} variant="quiet">
                  {locale === 'pt-BR' ? 'Cancelar' : 'Cancel'}
                </LbButton>
                <LbButton
                  isDisabled={invalidDisplayName || unchangedDisplayName}
                  isLoading={phase === 'issuing'}
                  loadingLabel={locale === 'pt-BR' ? 'Salvando' : 'Saving'}
                  onPress={() => void save()}
                  variant="primary"
                >
                  {locale === 'pt-BR' ? 'Salvar alterações' : 'Save changes'}
                </LbButton>
              </div>
            </div>
          ) : (
            <LbButton onPress={edit} variant="secondary">
              <ProductIcon name="settings" size={16} /> {labels.edit}
            </LbButton>
          )}
        </div>

        {phase === 'complete' || phase === 'pending' ? (
          <p
            className="account-live-feedback account-profile-feedback--success"
            aria-label={labels.receipt}
            role="status"
          >
            <ProductIcon name="check" size={17} />
            {phase === 'complete'
              ? locale === 'pt-BR'
                ? `${labels.saved}. Perfil sincronizado em todas as áreas.`
                : `${labels.saved}. Profile synchronized across all areas.`
              : labels.pending}
          </p>
        ) : null}
        {phase === 'conflict' && draft !== null ? (
          <div
            aria-label={
              locale === 'pt-BR' ? 'Conflito na atualização do perfil' : 'Profile update conflict'
            }
            className="account-live-feedback"
            role="alert"
          >
            <strong>{labels.conflict}</strong>
            <span>{projection.account.displayName}</span>
            <span>{draft.displayName}</span>
            <div className="account-profile__actions">
              <LbButton onPress={cancel} variant="quiet">
                {locale === 'pt-BR' ? 'Manter nome atual' : 'Keep current name'}
              </LbButton>
              <LbButton onPress={edit}>
                {locale === 'pt-BR' ? 'Revisar rascunho' : 'Review draft'}
              </LbButton>
            </div>
          </div>
        ) : null}
        {phase === 'offline' || phase === 'stale' || phase === 'error' ? (
          <p className="account-live-feedback account-profile-feedback--error" role="alert">
            <ProductIcon name="warning" size={17} /> {failureMessage}
          </p>
        ) : null}

        <footer className="account-profile-assurance">
          <span>
            <ProductIcon name="lock" size={18} />
          </span>
          <span>
            <strong>{locale === 'pt-BR' ? 'Alteração protegida' : 'Protected change'}</strong>
            <small>
              {locale === 'pt-BR'
                ? 'O e-mail e as permissões da conta não mudam ao editar este nome.'
                : 'Your email and account permissions do not change when editing this name.'}
            </small>
          </span>
        </footer>
      </section>
      <aside className="account-live-card account-live-card--quiet account-profile-record">
        <header className="account-live-card__header">
          <span className="account-live-kicker">
            {locale === 'pt-BR' ? 'Registro da conta' : 'Account record'}
          </span>
          <h2>{locale === 'pt-BR' ? 'Ficha confirmada' : 'Confirmed record'}</h2>
          <p>
            {locale === 'pt-BR'
              ? 'Dados lidos diretamente da autoridade da sua conta.'
              : 'Data read directly from your account authority.'}
          </p>
        </header>
        <dl className="account-live-definition">
          <div>
            <dt>{locale === 'pt-BR' ? 'E-mail' : 'Email'}</dt>
            <dd>{projection.account.emailRedacted}</dd>
          </div>
          <div>
            <dt>{locale === 'pt-BR' ? 'Idioma' : 'Language'}</dt>
            <dd>{projection.account.locale === 'pt-BR' ? 'Português (Brasil)' : 'English'}</dd>
          </div>
          <div>
            <dt>{locale === 'pt-BR' ? 'Membro desde' : 'Member since'}</dt>
            <dd>{formatDate(projection.account.createdAt, locale)}</dd>
          </div>
          <div>
            <dt>{locale === 'pt-BR' ? 'Última atualização' : 'Last update'}</dt>
            <dd>{formatDate(projection.account.updatedAt, locale)}</dd>
          </div>
        </dl>
        <div className="account-profile-record__version">
          <span>
            <ProductIcon name="history" size={17} />
          </span>
          <span>
            <small>{locale === 'pt-BR' ? 'Versão auditável' : 'Auditable version'}</small>
            <strong>v{projection.account.aggregateVersion}</strong>
          </span>
          <span className="account-live-badge" data-tone="positive">
            <ProductIcon name="check" size={13} /> {locale === 'pt-BR' ? 'Atual' : 'Current'}
          </span>
        </div>
      </aside>
    </div>
  );
};

const DeviceAuthority = ({
  locale,
  projection,
}: Readonly<{ locale: WebLocale; projection: AccountAuthorityProjection }>) => {
  const labels = copy[locale];
  const device = projection.activeDevice;
  const [blocked, setBlocked] = useState(false);
  const eligibleAt =
    device?.replacementEligibleAt === undefined ? 0 : Date.parse(device.replacementEligibleAt);
  const cooldownDays = Math.max(1, Math.ceil((eligibleAt - Date.now()) / 86_400_000));
  const cooldown = device?.replacementEligibleAt !== undefined && Date.now() < eligibleAt;
  return (
    <div className="account-live-grid" data-layout="7-5">
      <section
        className="account-live-card account-live-card--focus"
        aria-label={locale === 'pt-BR' ? 'Dispositivo ativo' : 'Active device'}
      >
        {device === null ? (
          <div className="account-live-empty">
            <span className="account-live-empty__icon">
              <ProductIcon name="device" size={30} />
            </span>
            <span className="account-live-kicker">
              {locale === 'pt-BR' ? 'Licença disponível' : 'License available'}
            </span>
            <h2>{locale === 'pt-BR' ? 'Nenhum PC vinculado' : 'No PC linked yet'}</h2>
            <p>
              {locale === 'pt-BR'
                ? 'Baixe o aplicativo neste computador e entre com esta conta para concluir o primeiro vínculo.'
                : 'Download the app on this computer and sign in with this account to complete the first binding.'}
            </p>
            <Link
              className="account-live-primary-action"
              href={hrefFor('account-downloads', locale) as Route}
            >
              <ProductIcon name="download" size={18} />
              {locale === 'pt-BR' ? 'Baixar aplicativo' : 'Download the app'}
              <ProductIcon name="arrowRight" size={16} />
            </Link>
          </div>
        ) : (
          <>
            <header className="account-live-device-heading">
              <span className="account-live-device-heading__icon">
                <ProductIcon name="device" size={28} />
              </span>
              <span>
                <span className="account-live-kicker">
                  {locale === 'pt-BR' ? 'PC principal' : 'Primary PC'}
                </span>
                <h2>{device.deviceLabel}</h2>
                <small>{locale === 'pt-BR' ? 'Vínculo verificado' : 'Verified binding'}</small>
              </span>
              <span className="account-live-badge" data-tone="positive">
                <ProductIcon name="check" size={15} /> {labels.active}
              </span>
            </header>
            <dl className="account-live-definition account-live-definition--columns">
              <div>
                <dt>{locale === 'pt-BR' ? 'Vinculado em' : 'Linked on'}</dt>
                <dd>{formatDate(device.boundAt, locale)}</dd>
              </div>
              <div>
                <dt>{locale === 'pt-BR' ? 'Troca disponível em' : 'Replacement available'}</dt>
                <dd>{formatDate(device.replacementEligibleAt, locale)}</dd>
              </div>
              <div>
                <dt>{locale === 'pt-BR' ? 'Evidência protegida' : 'Protected evidence'}</dt>
                <dd>v{device.evidenceVersion}</dd>
              </div>
            </dl>
            <div className="account-live-danger-zone">
              <span>
                <strong>{locale === 'pt-BR' ? 'Trocar este PC' : 'Replace this PC'}</strong>
                <small>
                  {locale === 'pt-BR'
                    ? 'A troca exige revisão e pode estar sujeita a período de espera.'
                    : 'Replacement requires review and may be subject to a cooldown.'}
                </small>
              </span>
              <LbButton
                onPress={() => {
                  setBlocked(cooldown);
                }}
                variant="destructive"
              >
                {labels.replace}
              </LbButton>
            </div>
            {blocked ? (
              <p className="account-live-feedback" aria-label={labels.cooldown} role="alert">
                {labels.cooldown}: {cooldownDays} {locale === 'pt-BR' ? 'dias' : 'days'}.
              </p>
            ) : null}
          </>
        )}
      </section>
      <aside className="account-live-card account-live-card--quiet">
        <header className="account-live-card__header">
          <span className="account-live-kicker">
            {locale === 'pt-BR' ? 'Como funciona' : 'How it works'}
          </span>
          <h2>{locale === 'pt-BR' ? 'Um PC ativo por licença' : 'One active PC per license'}</h2>
          <p>
            {locale === 'pt-BR'
              ? 'O vínculo protege sua licença e evita que mudanças sejam aplicadas no computador errado.'
              : 'The binding protects your license and prevents changes from being applied to the wrong computer.'}
          </p>
        </header>
        <ol className="account-live-steps">
          <li>
            <span>1</span>
            {locale === 'pt-BR' ? 'Instale o aplicativo.' : 'Install the app.'}
          </li>
          <li>
            <span>2</span>
            {locale === 'pt-BR' ? 'Entre com esta conta.' : 'Sign in with this account.'}
          </li>
          <li>
            <span>3</span>
            {locale === 'pt-BR'
              ? 'Confirme o vínculo no próprio PC.'
              : 'Confirm the binding on the PC.'}
          </li>
        </ol>
      </aside>
    </div>
  );
};

export const InternalDownloadsAuthority = ({ locale }: Readonly<{ locale: WebLocale }>) => (
  <section className="account-live-download" data-internal-download="restricted">
    <div className="account-live-download__main">
      <div className="account-live-download__topline">
        <span className="account-live-badge" data-tone="accent">
          <ProductIcon name="shield" size={15} />
          {locale === 'pt-BR' ? 'Beta fechado' : 'Closed beta'}
        </span>
        <span>{locale === 'pt-BR' ? 'Windows 10 e 11 · x64' : 'Windows 10 and 11 · x64'}</span>
      </div>
      <span className="account-live-download__icon">
        <ProductIcon name="download" size={34} />
      </span>
      <div className="account-live-download__copy">
        <span className="account-live-kicker">
          {locale === 'pt-BR'
            ? 'Canal interno · acesso convidado'
            : 'Internal channel · invited access'}
        </span>
        <h2>{locale === 'pt-BR' ? 'Liiiraa Boost para Windows' : 'Liiiraa Boost for Windows'}</h2>
        <p>
          {locale === 'pt-BR'
            ? 'Instalador exclusivo para participantes convidados. O arquivo é entregue somente por esta sessão autenticada.'
            : 'Exclusive installer for invited participants. The file is delivered only through this authenticated session.'}
        </p>
      </div>
      <a
        className="account-live-primary-action account-live-download__action"
        href="/api/internal-download"
      >
        <ProductIcon name="download" size={18} />
        {locale === 'pt-BR' ? 'Baixar para Windows' : 'Download for Windows'}
        <ProductIcon name="arrowRight" size={16} />
      </a>
      <div className="account-live-download__assurance">
        <span>
          <ProductIcon name="lock" size={16} />
          {locale === 'pt-BR' ? 'Entrega autenticada' : 'Authenticated delivery'}
        </span>
        <span>
          <ProductIcon name="check" size={16} />
          {locale === 'pt-BR' ? 'Build verificado pelo projeto' : 'Project-verified build'}
        </span>
      </div>
    </div>
    <aside className="account-live-download__notice" role="note">
      <span className="account-live-download__notice-icon">
        <ProductIcon name="warning" size={22} />
      </span>
      <div>
        <span className="account-live-kicker">
          {locale === 'pt-BR' ? 'Antes de instalar' : 'Before installing'}
        </span>
        <h2>
          {locale === 'pt-BR'
            ? 'Versão de testes sem assinatura pública'
            : 'Test build without public signing'}
        </h2>
        <p>
          {locale === 'pt-BR'
            ? 'O Windows pode exibir um aviso durante a instalação. Confira se o arquivo foi baixado por esta página antes de continuar.'
            : 'Windows may show a warning during installation. Confirm the file came from this page before continuing.'}
        </p>
      </div>
      <ol className="account-live-steps">
        <li>
          <span>1</span>
          {locale === 'pt-BR'
            ? 'Baixe somente por esta conta.'
            : 'Download only through this account.'}
        </li>
        <li>
          <span>2</span>
          {locale === 'pt-BR' ? 'Feche jogos antes de instalar.' : 'Close games before installing.'}
        </li>
        <li>
          <span>3</span>
          {locale === 'pt-BR' ? 'Entre no app para vincular o PC.' : 'Sign in to link the PC.'}
        </li>
      </ol>
    </aside>
  </section>
);

const OverviewAuthority = ({
  locale,
  projection,
}: Readonly<{ locale: WebLocale; projection: AccountAuthorityProjection }>) => {
  const view = mapAccountAuthorityProjection(projection, new Date().toISOString());
  const billingKind = subscriptionBillingKind(projection.subscription);
  const noDevice = projection.activeDevice === null;
  const nextHref = noDevice
    ? hrefFor('account-downloads', locale)
    : !view.security.mfa || !view.security.passkey
      ? hrefFor('account-security', locale)
      : hrefFor('account-profile', locale);
  const nextCopy = noDevice
    ? locale === 'pt-BR'
      ? 'Baixe o aplicativo e vincule seu primeiro PC.'
      : 'Download the app and link your first PC.'
    : !view.security.mfa || !view.security.passkey
      ? locale === 'pt-BR'
        ? 'Complete os métodos de segurança da sua conta.'
        : 'Complete your account security methods.'
      : locale === 'pt-BR'
        ? 'Sua conta está pronta. Revise seu perfil quando precisar.'
        : 'Your account is ready. Review your profile whenever needed.';
  const planLabel =
    billingKind === 'permanent'
      ? locale === 'pt-BR'
        ? 'Acesso permanente'
        : 'Permanent access'
      : view.billing.plan === 'premium'
        ? 'Premium'
        : 'Essential';
  return (
    <>
      <section className="account-live-overview-hero">
        <div className="account-live-overview-identity">
          <span className="account-live-overview-identity__avatar">
            {initialsFor(view.identity.displayName)}
          </span>
          <span>
            <span className="account-live-kicker">
              {locale === 'pt-BR' ? 'Bem-vindo de volta' : 'Welcome back'}
            </span>
            <h2>{view.identity.displayName}</h2>
            <p>{view.identity.emailRedacted}</p>
          </span>
        </div>
        <div className="account-live-overview-identity__meta">
          <span className="account-live-badge" data-tone="accent">
            <ProductIcon name="crown" size={15} /> {planLabel}
          </span>
          {projection.account.administrativeRole === undefined ? null : (
            <span className="account-live-badge">
              <ProductIcon name="shield" size={15} />
              {locale === 'pt-BR' ? 'Membro administrativo' : 'Administrative member'}
            </span>
          )}
        </div>
      </section>

      <section
        className="account-live-health"
        aria-label={locale === 'pt-BR' ? 'Estado da conta' : 'Account health'}
      >
        <Link href={hrefFor('account-subscription', locale) as Route}>
          <span className="account-live-health__icon">
            <ProductIcon name="crown" size={22} />
          </span>
          <span>
            <small>{locale === 'pt-BR' ? 'Plano' : 'Plan'}</small>
            <strong>{planLabel}</strong>
            <span>{locale === 'pt-BR' ? 'Sem pendências' : 'No pending action'}</span>
          </span>
          <ProductIcon name="arrowRight" size={17} />
        </Link>
        <Link href={hrefFor('account-device', locale) as Route}>
          <span className="account-live-health__icon">
            <ProductIcon name="device" size={22} />
          </span>
          <span>
            <small>{locale === 'pt-BR' ? 'Dispositivo' : 'Device'}</small>
            <strong>
              {view.device.label ?? (locale === 'pt-BR' ? 'Nenhum PC vinculado' : 'No PC linked')}
            </strong>
            <span>
              {view.device.isCurrent
                ? locale === 'pt-BR'
                  ? 'Vínculo ativo'
                  : 'Active binding'
                : locale === 'pt-BR'
                  ? 'Configuração pendente'
                  : 'Setup pending'}
            </span>
          </span>
          <ProductIcon name="arrowRight" size={17} />
        </Link>
        <Link href={hrefFor('account-security', locale) as Route}>
          <span className="account-live-health__icon">
            <ProductIcon name="shield" size={22} />
          </span>
          <span>
            <small>{locale === 'pt-BR' ? 'Segurança' : 'Security'}</small>
            <strong>
              {view.security.mfa
                ? locale === 'pt-BR'
                  ? 'MFA ativa'
                  : 'MFA active'
                : locale === 'pt-BR'
                  ? 'Proteção incompleta'
                  : 'Protection incomplete'}
            </strong>
            <span>
              {view.security.passkey
                ? locale === 'pt-BR'
                  ? 'Chave de acesso configurada'
                  : 'Passkey configured'
                : locale === 'pt-BR'
                  ? 'Chave de acesso pendente'
                  : 'Passkey pending'}
            </span>
          </span>
          <ProductIcon name="arrowRight" size={17} />
        </Link>
      </section>

      <section className="account-live-next-step">
        <span className="account-live-next-step__icon">
          <ProductIcon name={noDevice ? 'download' : 'shield'} size={24} />
        </span>
        <span>
          <span className="account-live-kicker">
            {locale === 'pt-BR' ? 'Próximo passo recomendado' : 'Recommended next step'}
          </span>
          <h2>{nextCopy}</h2>
          <p>
            {locale === 'pt-BR'
              ? 'Você pode continuar de onde parou sem perder as configurações da conta.'
              : 'Continue where you left off without losing your account settings.'}
          </p>
        </span>
        <Link className="account-live-primary-action" href={nextHref as Route}>
          {noDevice
            ? locale === 'pt-BR'
              ? 'Ir para downloads'
              : 'Go to downloads'
            : locale === 'pt-BR'
              ? 'Revisar agora'
              : 'Review now'}
          <ProductIcon name="arrowRight" size={16} />
        </Link>
      </section>
    </>
  );
};

const SecurityAuthority = ({
  locale,
  projection,
}: Readonly<{ locale: WebLocale; projection: AccountAuthorityProjection }>) => {
  const has = (factor: AccountAuthorityProjection['securityMethods'][number]['factor']): boolean =>
    projection.securityMethods.some((method) => method.factor === factor);
  const methods = [
    {
      description:
        locale === 'pt-BR'
          ? 'Acesso rápido e resistente a phishing.'
          : 'Fast, phishing-resistant access.',
      icon: 'key' as const,
      ready: has('passkey'),
      title: locale === 'pt-BR' ? 'Chave de acesso' : 'Passkey',
    },
    {
      description:
        locale === 'pt-BR'
          ? 'Código temporário pelo seu autenticador.'
          : 'Temporary code from your authenticator.',
      icon: 'lock' as const,
      ready: has('totp'),
      title: locale === 'pt-BR' ? 'Autenticação em duas etapas' : 'Two-factor authentication',
    },
    {
      description:
        locale === 'pt-BR'
          ? 'Códigos seguros para recuperar o acesso.'
          : 'Secure codes to recover access.',
      icon: 'history' as const,
      ready: has('recovery-code'),
      title: locale === 'pt-BR' ? 'Códigos de recuperação' : 'Recovery codes',
    },
    {
      description: `${String(projection.sessions.length)} ${locale === 'pt-BR' ? 'sessão autenticada nesta conta.' : 'authenticated session on this account.'}`,
      icon: 'device' as const,
      ready: projection.sessions.length > 0,
      title: locale === 'pt-BR' ? 'Sessões ativas' : 'Active sessions',
    },
  ];
  const readyCount = methods.filter(({ ready }) => ready).length;
  return (
    <div className="account-live-grid" data-layout="7-5">
      <section
        aria-label={locale === 'pt-BR' ? 'Autoridade de segurança' : 'Security authority'}
        className="account-live-card account-live-card--focus"
      >
        <header className="account-live-card__header">
          <span className="account-live-kicker">
            {locale === 'pt-BR' ? 'Métodos de acesso' : 'Access methods'}
          </span>
          <h2>{locale === 'pt-BR' ? 'Proteções da sua conta' : 'Your account protections'}</h2>
          <p>
            {locale === 'pt-BR'
              ? 'Cada método confirmado é validado pela autoridade da conta.'
              : 'Each confirmed method is validated by the account authority.'}
          </p>
        </header>
        <ul className="account-live-methods">
          {methods.map((method) => (
            <li key={method.title} data-ready={method.ready || undefined}>
              <span className="account-live-methods__icon">
                <ProductIcon name={method.icon} size={21} />
              </span>
              <span>
                <strong>{method.title}</strong>
                <small>{method.description}</small>
              </span>
              <span
                className="account-live-badge"
                data-tone={method.ready ? 'positive' : 'neutral'}
              >
                <ProductIcon name={method.ready ? 'check' : 'info'} size={14} />
                {method.ready
                  ? locale === 'pt-BR'
                    ? 'Configurado'
                    : 'Configured'
                  : locale === 'pt-BR'
                    ? 'Não configurado'
                    : 'Not configured'}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <aside className="account-live-security-score">
        <span
          className="account-live-security-score__ring"
          aria-label={`${String(readyCount)} / ${String(methods.length)}`}
        >
          <strong>{readyCount}</strong>
          <small>/ {methods.length}</small>
        </span>
        <span className="account-live-kicker">
          {locale === 'pt-BR' ? 'Postura atual' : 'Current posture'}
        </span>
        <h2>
          {readyCount >= 3
            ? locale === 'pt-BR'
              ? 'Conta bem protegida'
              : 'Well-protected account'
            : locale === 'pt-BR'
              ? 'Proteção pode melhorar'
              : 'Protection can improve'}
        </h2>
        <p>
          {locale === 'pt-BR'
            ? 'Mantenha pelo menos dois métodos fortes e códigos de recuperação guardados fora do computador.'
            : 'Keep at least two strong methods and recovery codes stored away from this computer.'}
        </p>
        <Link className="account-context-link" href={hrefFor('account-privacy', locale) as Route}>
          {locale === 'pt-BR' ? 'Revisar privacidade' : 'Review privacy'}{' '}
          <ProductIcon name="arrowRight" size={16} />
        </Link>
      </aside>
    </div>
  );
};

const InvoiceAuthority = ({
  locale,
  projection,
}: Readonly<{ locale: WebLocale; projection: AccountAuthorityProjection }>) => (
  <section
    className="account-live-card account-live-card--focus"
    aria-label={locale === 'pt-BR' ? 'Faturas autoritativas' : 'Authoritative invoices'}
  >
    <header className="account-live-card__header account-live-card__header--row">
      <span>
        <span className="account-live-kicker">
          {locale === 'pt-BR' ? 'Cobranças confirmadas' : 'Confirmed billing'}
        </span>
        <h2>{copy[locale].invoice}</h2>
      </span>
      <span className="account-live-badge">
        {projection.invoices.length} {locale === 'pt-BR' ? 'registro(s)' : 'record(s)'}
      </span>
    </header>
    {projection.invoices.length === 0 ? (
      <div className="account-live-empty account-live-empty--compact">
        <span className="account-live-empty__icon">
          <ProductIcon name="receipt" size={28} />
        </span>
        <h2>{locale === 'pt-BR' ? 'Nenhuma fatura emitida' : 'No invoices issued'}</h2>
        <p>
          {locale === 'pt-BR'
            ? 'Seu acesso atual não gerou cobranças ou documentos fiscais.'
            : 'Your current access has not generated charges or billing documents.'}
        </p>
      </div>
    ) : (
      <div className="account-live-table" role="region" aria-label={copy[locale].invoice}>
        <table>
          <thead>
            <tr>
              <th>{locale === 'pt-BR' ? 'Referência' : 'Reference'}</th>
              <th>{locale === 'pt-BR' ? 'Estado' : 'Status'}</th>
              <th>{locale === 'pt-BR' ? 'Valor' : 'Amount'}</th>
              <th>{locale === 'pt-BR' ? 'Emissão' : 'Issued'}</th>
            </tr>
          </thead>
          <tbody>
            {projection.invoices.map((invoice) => (
              <tr key={invoice.invoiceId}>
                <td>
                  <code>{invoice.invoiceId}</code>
                </td>
                <td>
                  <span
                    className="account-live-badge"
                    data-tone={invoice.state === 'paid' ? 'positive' : 'neutral'}
                  >
                    {invoiceStateLabels[locale][invoice.state]}
                  </span>
                </td>
                <td>{formatMoney(invoice.amountPaidMinor, invoice.currency, locale)}</td>
                <td>{formatDate(invoice.issuedAt, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </section>
);

const SupportAuthority = ({
  locale,
  projection,
}: Readonly<{ locale: WebLocale; projection: AccountAuthorityProjection }>) => {
  const openCases = projection.supportCases.filter(({ state }) => state === 'open').length;
  return (
    <div className="account-live-grid" data-layout="7-5">
      <section
        className="account-live-card account-live-card--focus"
        aria-label={locale === 'pt-BR' ? 'Autoridade de suporte' : 'Support authority'}
      >
        <header className="account-live-card__header account-live-card__header--row">
          <span>
            <span className="account-live-kicker">
              {locale === 'pt-BR' ? 'Atendimento protegido' : 'Protected support'}
            </span>
            <h2>{locale === 'pt-BR' ? 'Seus chamados' : 'Your support cases'}</h2>
          </span>
          <span className="account-live-badge" data-tone={openCases > 0 ? 'attention' : 'positive'}>
            {openCases} {locale === 'pt-BR' ? 'aberto(s)' : 'open'}
          </span>
        </header>
        {projection.supportCases.length === 0 ? (
          <div className="account-live-empty">
            <span className="account-live-empty__icon">
              <ProductIcon name="lifebuoy" size={30} />
            </span>
            <h2>{locale === 'pt-BR' ? 'Tudo certo por aqui' : 'Everything looks good'}</h2>
            <p>
              {locale === 'pt-BR'
                ? 'Você não possui solicitações abertas. Quando o atendimento online for liberado, seus chamados aparecerão nesta área.'
                : 'You have no open requests. When online support is enabled, your cases will appear here.'}
            </p>
          </div>
        ) : (
          <ul className="account-live-cases">
            {projection.supportCases.map((supportCase) => (
              <li key={supportCase.supportCaseId}>
                <span className="account-live-cases__icon">
                  <ProductIcon name="lifebuoy" size={20} />
                </span>
                <span>
                  <strong>{supportCase.subjectRedacted}</strong>
                  <small>
                    {supportCase.supportCaseId} · {formatDate(supportCase.updatedAt, locale)}
                  </small>
                </span>
                <span
                  className="account-live-badge"
                  data-tone={supportCase.state === 'open' ? 'attention' : 'neutral'}
                >
                  {supportCaseStateLabels[locale][supportCase.state]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <aside className="account-live-card account-live-card--quiet">
        <header className="account-live-card__header">
          <span className="account-live-kicker">
            {locale === 'pt-BR' ? 'Suporte do beta' : 'Beta support'}
          </span>
          <h2>{locale === 'pt-BR' ? 'O que enviar' : 'What to send'}</h2>
          <p>
            {locale === 'pt-BR'
              ? 'Explique o problema e o momento em que ocorreu. Nunca envie senha, código MFA ou dados completos do computador.'
              : 'Describe the issue and when it happened. Never send passwords, MFA codes, or complete computer data.'}
          </p>
        </header>
        <ul className="account-live-guidance">
          <li>
            <ProductIcon name="check" size={17} />
            {locale === 'pt-BR' ? 'Passos para reproduzir' : 'Steps to reproduce'}
          </li>
          <li>
            <ProductIcon name="check" size={17} />
            {locale === 'pt-BR' ? 'Tela e rota afetadas' : 'Affected screen and route'}
          </li>
          <li>
            <ProductIcon name="lock" size={17} />
            {locale === 'pt-BR'
              ? 'Sem segredos ou códigos de acesso'
              : 'No secrets or access codes'}
          </li>
        </ul>
      </aside>
    </div>
  );
};

const PrivacyAuthority = ({ locale }: Readonly<{ locale: WebLocale }>) => (
  <div className="account-live-grid" data-layout="7-5">
    <section
      aria-label={locale === 'pt-BR' ? 'Autoridade de consentimento' : 'Consent authority'}
      className="account-live-card account-live-card--focus"
    >
      <header className="account-live-card__header">
        <span className="account-live-kicker">
          {locale === 'pt-BR' ? 'Controle dos seus dados' : 'Control your data'}
        </span>
        <h2>{locale === 'pt-BR' ? 'Privacidade por finalidade' : 'Purpose-bound privacy'}</h2>
        <p>
          {locale === 'pt-BR'
            ? 'Diagnósticos, telemetria opcional e suporte usam autorizações independentes, versionadas e revogáveis.'
            : 'Diagnostics, optional telemetry, and support use separate, versioned, revocable permissions.'}
        </p>
      </header>
      <div className="account-live-privacy-cards">
        <article>
          <ProductIcon name="device" size={21} />
          <span>
            <strong>{locale === 'pt-BR' ? 'Dados locais primeiro' : 'Local data first'}</strong>
            <small>
              {locale === 'pt-BR'
                ? 'Histórico e diagnósticos permanecem no PC até uma ação explícita.'
                : 'History and diagnostics stay on the PC until an explicit action.'}
            </small>
          </span>
        </article>
        <article>
          <ProductIcon name="shield" size={21} />
          <span>
            <strong>{locale === 'pt-BR' ? 'Consentimento separado' : 'Separate consent'}</strong>
            <small>
              {locale === 'pt-BR'
                ? 'Cada finalidade possui seu próprio estado e prazo.'
                : 'Each purpose has its own state and expiry.'}
            </small>
          </span>
        </article>
        <article>
          <ProductIcon name="history" size={21} />
          <span>
            <strong>{locale === 'pt-BR' ? 'Histórico auditável' : 'Auditable history'}</strong>
            <small>
              {locale === 'pt-BR'
                ? 'Alterações relevantes geram registros seguros.'
                : 'Relevant changes create secure records.'}
            </small>
          </span>
        </article>
      </div>
    </section>
    <aside className="account-live-card account-live-card--quiet">
      <header className="account-live-card__header">
        <span className="account-live-kicker">
          {locale === 'pt-BR' ? 'Disponibilidade' : 'Availability'}
        </span>
        <h2>
          {locale === 'pt-BR'
            ? 'Central de consentimentos em preparação'
            : 'Consent center in preparation'}
        </h2>
        <p>
          {locale === 'pt-BR'
            ? 'Nenhuma escolha foi simulada nesta tela. Os controles aparecerão somente quando a autoridade de consentimento estiver conectada.'
            : 'No choice is simulated on this screen. Controls will appear only when the consent authority is connected.'}
        </p>
      </header>
      <span className="account-live-badge">
        <ProductIcon name="info" size={14} />
        {locale === 'pt-BR' ? 'Sem alteração remota' : 'No remote change'}
      </span>
    </aside>
  </div>
);

const ProjectionResponsibility = ({
  locale,
  projection,
  routeId,
}: Readonly<{
  locale: WebLocale;
  projection: AccountAuthorityProjection;
  routeId: AccountRoute;
}>) => {
  if (routeId === 'account-security')
    return <SecurityAuthority locale={locale} projection={projection} />;
  if (routeId === 'account-invoices')
    return <InvoiceAuthority locale={locale} projection={projection} />;
  if (routeId === 'account-support')
    return <SupportAuthority locale={locale} projection={projection} />;
  if (routeId === 'account-privacy') return <PrivacyAuthority locale={locale} />;
  return <OverviewAuthority locale={locale} projection={projection} />;
};

export const AccountAuthorityPage = ({
  authorityBaseUrl,
  locale,
  routeId,
}: AccountAuthorityPageProps) => {
  const [result, setResult] = useState<AccountAuthorityReadResult | null>(null);
  const [projection, setProjection] = useState<AccountAuthorityProjection | null>(null);
  const authority = useMemo(() => getLiveAccountAuthority(authorityBaseUrl), [authorityBaseUrl]);
  useEffect(() => {
    return authority.subscribe((next) => {
      if (next === null) return;
      setResult(next);
      if ('projection' in next) setProjection(next.projection);
    });
  }, [authority]);

  const metadata = getAccountRouteMetadata(locale, routeId);
  const signInRoute = routeHref('account-sign-in', { locale });
  if (!signInRoute.ok) throw new Error('ACCOUNT_SIGN_IN_ROUTE_UNAVAILABLE');
  if (result === null) {
    return (
      <article className="account-responsibility account-live-page" aria-busy="true">
        <header className="account-live-header">
          <span>
            <span className="account-live-kicker">
              {locale === 'pt-BR' ? 'Central da conta' : 'Account center'}
            </span>
            <h1>{metadata.title}</h1>
            <p>{metadata.summary}</p>
          </span>
        </header>
        <div className="account-live-skeleton" role="status" aria-label={copy[locale].loading}>
          <span />
          <span />
          <span />
        </div>
      </article>
    );
  }
  if (projection === null || result.status === 'error') {
    return (
      <article className="account-responsibility account-live-page">
        <header className="account-live-header">
          <span>
            <span className="account-live-kicker">
              {locale === 'pt-BR' ? 'Central da conta' : 'Account center'}
            </span>
            <h1>{metadata.title}</h1>
            <p>{metadata.summary}</p>
          </span>
        </header>
        <section className="account-live-card account-live-empty">
          <span className="account-live-empty__icon">
            <ProductIcon name="warning" size={30} />
          </span>
          {'code' in result && result.code === 'unauthorized' ? (
            <>
              <h2>{locale === 'pt-BR' ? 'Entre para continuar' : 'Sign in to continue'}</h2>
              <p>
                {locale === 'pt-BR'
                  ? 'Sua sessão não está disponível nesta área da conta.'
                  : 'Your session is not available in this account area.'}
              </p>
              <Link className="account-live-primary-action" href={signInRoute.value as Route}>
                {locale === 'pt-BR' ? 'Entrar com segurança' : 'Sign in securely'}
                <ProductIcon name="arrowRight" size={16} />
              </Link>
            </>
          ) : (
            <>
              <h2>{copy[locale].error}</h2>
              <p role="alert">
                {locale === 'pt-BR'
                  ? 'Tente atualizar a página. Nenhuma alteração foi aplicada.'
                  : 'Try refreshing the page. No changes were applied.'}
              </p>
            </>
          )}
        </section>
      </article>
    );
  }
  return (
    <article
      className={`account-responsibility account-live-page account-live-page--${routeId}`}
      data-account-runtime="production"
      data-authority-connected="true"
      data-account-state={result.status}
    >
      <header className="account-live-header">
        <span>
          <span className="account-live-kicker">
            {locale === 'pt-BR' ? 'Central da conta' : 'Account center'}
          </span>
          <h1>{metadata.title}</h1>
          <p>{metadata.summary}</p>
        </span>
        <AuthorityStatus locale={locale} status={result.status} />
      </header>
      {routeId === 'account-profile' ? (
        <ProfileAuthority
          authority={authority}
          authorityBaseUrl={authorityBaseUrl}
          locale={locale}
          projection={projection}
        />
      ) : routeId === 'account-device' ? (
        <DeviceAuthority locale={locale} projection={projection} />
      ) : routeId === 'account-subscription' ? (
        <AccountSubscriptionAuthority
          authority={authority}
          authorityBaseUrl={authorityBaseUrl}
          locale={locale}
          projection={projection}
        />
      ) : routeId === 'account-downloads' ? (
        <InternalDownloadsAuthority locale={locale} />
      ) : (
        <ProjectionResponsibility locale={locale} projection={projection} routeId={routeId} />
      )}
    </article>
  );
};

export const AccountAuthorityInspector = ({
  authorityBaseUrl,
  deviceHref,
  locale,
  securityHref,
  subscriptionHref,
  supportHref,
}: Readonly<{
  authorityBaseUrl: string;
  deviceHref: string;
  locale: WebLocale;
  securityHref: string;
  subscriptionHref: string;
  supportHref: string;
}>) => {
  const [result, setResult] = useState<AccountAuthorityReadResult | null>(null);
  const authority = useMemo(() => getLiveAccountAuthority(authorityBaseUrl), [authorityBaseUrl]);
  useEffect(
    () =>
      authority.subscribe((next) => {
        if (next !== null) setResult(next);
      }),
    [authority],
  );

  if (result === null)
    return (
      <div className="account-inspector__loading" role="status">
        {locale === 'pt-BR' ? 'Carregando resumo…' : 'Loading summary…'}
      </div>
    );
  if (!('projection' in result))
    return (
      <section className="account-inspector__section">
        <span className="account-inspector__label">
          {locale === 'pt-BR' ? 'Resumo da conta' : 'Account summary'}
        </span>
        <h2>{locale === 'pt-BR' ? 'Sessão necessária' : 'Session required'}</h2>
        <p>
          {locale === 'pt-BR'
            ? 'Entre para carregar o estado da conta.'
            : 'Sign in to load account status.'}
        </p>
      </section>
    );

  const projection = result.projection;
  const view = mapAccountAuthorityProjection(projection, new Date().toISOString());
  const billingKind = subscriptionBillingKind(projection.subscription);
  const planLabel =
    billingKind === 'permanent'
      ? locale === 'pt-BR'
        ? 'Acesso permanente'
        : 'Permanent access'
      : view.billing.plan === 'premium'
        ? 'Premium'
        : 'Essential';
  const links = [
    {
      detail:
        billingKind === 'permanent'
          ? locale === 'pt-BR'
            ? 'Sem cobrança ou renovação'
            : 'No billing or renewal'
          : subscriptionStateLabels[locale][projection.subscription.state],
      href: subscriptionHref,
      icon: 'crown' as const,
      label: locale === 'pt-BR' ? 'Plano' : 'Plan',
      value: planLabel,
    },
    {
      detail: view.device.isCurrent
        ? locale === 'pt-BR'
          ? 'Vínculo ativo'
          : 'Active binding'
        : locale === 'pt-BR'
          ? 'Configuração pendente'
          : 'Setup pending',
      href: deviceHref,
      icon: 'device' as const,
      label: locale === 'pt-BR' ? 'Dispositivo' : 'Device',
      value: view.device.label ?? (locale === 'pt-BR' ? 'Nenhum PC' : 'No PC'),
    },
    {
      detail: view.security.passkey
        ? locale === 'pt-BR'
          ? 'Chave de acesso ativa'
          : 'Passkey active'
        : locale === 'pt-BR'
          ? 'Chave de acesso pendente'
          : 'Passkey pending',
      href: securityHref,
      icon: 'shield' as const,
      label: locale === 'pt-BR' ? 'Segurança' : 'Security',
      value: view.security.mfa
        ? locale === 'pt-BR'
          ? 'MFA ativa'
          : 'MFA active'
        : locale === 'pt-BR'
          ? 'Proteção incompleta'
          : 'Protection incomplete',
    },
    {
      detail:
        view.support.openCount === 0
          ? locale === 'pt-BR'
            ? 'Nenhum chamado aberto'
            : 'No open cases'
          : `${String(view.support.openCount)} ${locale === 'pt-BR' ? 'chamado(s) aberto(s)' : 'open case(s)'}`,
      href: supportHref,
      icon: 'lifebuoy' as const,
      label: locale === 'pt-BR' ? 'Ajuda' : 'Help',
      value: locale === 'pt-BR' ? 'Suporte' : 'Support',
    },
  ];
  return (
    <div className="account-inspector__content" data-authority-state={result.status}>
      <header className="account-inspector__heading">
        <span>
          <span className="account-inspector__label">
            {locale === 'pt-BR' ? 'Resumo da conta' : 'Account summary'}
          </span>
          <strong>{locale === 'pt-BR' ? 'Tudo em um lugar' : 'Everything in one place'}</strong>
        </span>
        <span className="account-inspector__synced">
          <ProductIcon name="check" size={14} />
          {locale === 'pt-BR' ? 'Sincronizado' : 'Synced'}
        </span>
      </header>
      <nav
        className="account-inspector__quicklinks"
        aria-label={locale === 'pt-BR' ? 'Atalhos da conta' : 'Account shortcuts'}
      >
        {links.map((item) => (
          <Link href={item.href as Route} key={item.href}>
            <span className="account-inspector__quicklink-icon">
              <ProductIcon name={item.icon} size={20} />
            </span>
            <span>
              <small>{item.label}</small>
              <strong className={item.icon === 'device' ? 'account-inspector__machine' : undefined}>
                {item.value}
              </strong>
              <span>{item.detail}</span>
            </span>
            <ProductIcon name="arrowRight" size={16} />
          </Link>
        ))}
      </nav>
    </div>
  );
};
