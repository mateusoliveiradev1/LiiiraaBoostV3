'use client';

import { LbButton, LbTextField, ProductIcon } from '@liiiraa/design-system';
import type { WebLocale } from '@liiiraa/web-core';
import { useEffect, useMemo, useState } from 'react';

import {
  createAccountAuthority,
  type AccountAuthorityProjection,
  type AccountAuthorityReadResult,
  type AccountProfileDraft,
} from '../account-authority';
import {
  advanceAccountMutationPhase,
  getAccountPreviewMetadata,
  type AccountMutationPhase,
  type AccountPreviewRoute,
} from '../account-preview-model';
import { mapAccountAuthorityProjection } from '../account-runtime';

type AccountAuthorityPageProps = Readonly<{
  authorityBaseUrl: string;
  locale: WebLocale;
  routeId: AccountPreviewRoute;
}>;

const copy = Object.freeze({
  en: Object.freeze({
    active: 'Active',
    authority: 'Account authority status',
    connected: 'Connected',
    conflict: 'The account changed remotely. Review the server value and your safe draft.',
    cooldown: 'Device replacement unavailable',
    edit: 'Edit profile',
    error: 'Account authority is unavailable',
    invoice: 'Authoritative invoices',
    loading: 'Loading account authority',
    offline: 'Offline — showing the last verified account state',
    pending: 'Pending reconciliation',
    receipt: 'Profile update receipt',
    replace: 'Replace device',
    save: 'Save changes',
    saved: 'Saved',
    security: 'Security authority',
    consent: 'Consent authority',
    cancellation: 'Cancellation scheduled',
    recovery: 'Recovery methods',
    stale: 'Stale — refresh before relying on this account state',
    support: 'Support authority',
  }),
  'pt-BR': Object.freeze({
    active: 'Ativo',
    authority: 'Status da autoridade da conta',
    connected: 'Conectada',
    conflict: 'A conta mudou remotamente. Revise o valor do servidor e seu rascunho seguro.',
    cooldown: 'Substituição de dispositivo indisponível',
    edit: 'Editar perfil',
    error: 'A autoridade da conta está indisponível',
    invoice: 'Faturas autoritativas',
    loading: 'Carregando autoridade da conta',
    offline: 'Offline — exibindo o último estado verificado da conta',
    pending: 'Reconciliação pendente',
    receipt: 'Recibo de atualização do perfil',
    replace: 'Substituir dispositivo',
    save: 'Salvar alterações',
    saved: 'Salvo',
    security: 'Autoridade de segurança',
    consent: 'Autoridade de consentimento',
    cancellation: 'Cancelamento agendado',
    recovery: 'Métodos de recuperação',
    stale: 'Desatualizado — atualize antes de confiar neste estado da conta',
    support: 'Autoridade de suporte',
  }),
});

const readCsrfToken = (): string => {
  const token = document.cookie
    .split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith('liiiraa-csrf='))
    ?.slice('liiiraa-csrf='.length);
  return token === undefined ? 'missing-csrf-token' : decodeURIComponent(token);
};

const correlationId = (): string => `account-web-${globalThis.crypto.randomUUID()}`;

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
    <section aria-label={labels.authority} className="account-overview__continuity">
      <ProductIcon name={status === 'online' ? 'check' : 'info'} size={18} />
      <strong>{detail}</strong>
    </section>
  );
};

const ProfileAuthority = ({
  authorityBaseUrl,
  locale,
  onProjection,
  projection,
}: Readonly<{
  authorityBaseUrl: string;
  locale: WebLocale;
  onProjection: (projection: AccountAuthorityProjection) => void;
  projection: AccountAuthorityProjection;
}>) => {
  const labels = copy[locale];
  const [displayName, setDisplayName] = useState(projection.account.displayName);
  const [phase, setPhase] = useState<AccountMutationPhase>('idle');
  const [draft, setDraft] = useState<AccountProfileDraft | null>(null);
  const authority = useMemo(
    () =>
      createAccountAuthority({
        baseUrl: authorityBaseUrl,
        correlationId,
        csrfToken: readCsrfToken,
      }),
    [authorityBaseUrl],
  );

  const edit = () => {
    setPhase(advanceAccountMutationPhase(phase, 'review'));
  };
  const save = async () => {
    setPhase(advanceAccountMutationPhase('reviewing', 'issue'));
    const result = await authority.updateProfile({
      displayName,
      localDraftToken: `profile-${globalThis.crypto.randomUUID()}`,
      locale,
      projection,
    });
    if ('projection' in result) onProjection(result.projection);
    if (result.status === 'conflict') setDraft(result.draft);
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

  return (
    <section className="account-profile__editor" data-workspace-region="focal">
      <dl className="account-profile__facts">
        <div>
          <dt>{locale === 'pt-BR' ? 'E-mail verificado' : 'Verified email'}</dt>
          <dd>{projection.account.emailRedacted}</dd>
        </div>
        <div>
          <dt>{locale === 'pt-BR' ? 'Versão da conta' : 'Account version'}</dt>
          <dd>{projection.account.aggregateVersion}</dd>
        </div>
      </dl>
      {phase === 'idle' || phase === 'complete' ? (
        <LbButton onPress={edit}>{labels.edit}</LbButton>
      ) : null}
      {phase === 'reviewing' ? (
        <div className="account-profile__control">
          <LbTextField
            isRequired
            label={locale === 'pt-BR' ? 'Nome de exibição' : 'Display name'}
            maxLength={80}
            onChange={setDisplayName}
            value={displayName}
          />
          <LbButton onPress={() => void save()}>{labels.save}</LbButton>
        </div>
      ) : null}
      {phase === 'issuing' ? (
        <p role="status">{locale === 'pt-BR' ? 'Emitindo…' : 'Issuing…'}</p>
      ) : null}
      {phase === 'complete' || phase === 'pending' ? (
        <p aria-label={labels.receipt} role="status">
          {phase === 'complete' ? labels.saved : labels.pending}
        </p>
      ) : null}
      {phase === 'conflict' && draft !== null ? (
        <div
          aria-label={
            locale === 'pt-BR' ? 'Conflito na atualização do perfil' : 'Profile update conflict'
          }
          role="alert"
        >
          <strong>{labels.conflict}</strong>
          <p>{projection.account.displayName}</p>
          <p>{draft.displayName}</p>
          <LbButton onPress={edit}>{labels.edit}</LbButton>
        </div>
      ) : null}
      {phase === 'offline' || phase === 'stale' || phase === 'error' ? (
        <p role="alert">
          {phase === 'offline' ? labels.offline : phase === 'stale' ? labels.stale : labels.error}
        </p>
      ) : null}
    </section>
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
    <section aria-label={locale === 'pt-BR' ? 'Dispositivo ativo' : 'Active device'}>
      {device === null ? (
        <p>{locale === 'pt-BR' ? 'Nenhum PC ativo' : 'No active PC'}</p>
      ) : (
        <dl>
          <div>
            <dt>{device.deviceLabel}</dt>
            <dd>{labels.active}</dd>
          </div>
          <div>
            <dt>{locale === 'pt-BR' ? 'Elegível em' : 'Eligible at'}</dt>
            <dd>{device.replacementEligibleAt}</dd>
          </div>
        </dl>
      )}
      <LbButton
        onPress={() => {
          setBlocked(cooldown);
        }}
        variant="destructive"
      >
        {labels.replace}
      </LbButton>
      {blocked ? (
        <p aria-label="Device replacement unavailable" role="alert">
          {labels.cooldown}: {cooldownDays} {locale === 'pt-BR' ? 'dias' : 'days'}.
        </p>
      ) : null}
    </section>
  );
};

const ProjectionResponsibility = ({
  locale,
  projection,
  routeId,
}: Readonly<{
  locale: WebLocale;
  projection: AccountAuthorityProjection;
  routeId: AccountPreviewRoute;
}>) => {
  const view = mapAccountAuthorityProjection(projection, new Date().toISOString());
  const labels = copy[locale];
  if (routeId === 'account-security') {
    return (
      <section aria-label={labels.security}>
        <p>{view.security.passkey ? 'Passkey: active' : 'Passkey: unavailable'}</p>
        <p>{view.security.mfa ? 'MFA: active' : 'MFA: unavailable'}</p>
        <p>
          {labels.recovery}:{' '}
          {projection.securityMethods.some(({ factor }) => factor === 'recovery-code')
            ? labels.active
            : locale === 'pt-BR'
              ? 'Indisponível'
              : 'Unavailable'}
        </p>
        <p>
          {locale === 'pt-BR' ? 'Sessões ativas' : 'Active sessions'}: {view.security.sessionCount}
        </p>
      </section>
    );
  }
  if (routeId === 'account-subscription') {
    return (
      <section
        aria-label={locale === 'pt-BR' ? 'Autoridade da assinatura' : 'Subscription authority'}
      >
        <p>{view.billing.plan === 'premium' ? 'Premium' : 'Essential'}</p>
        <p role="status">
          {view.billing.checkout === 'pending' ? labels.pending : labels.connected}
        </p>
        {projection.subscription.cancelAtPeriodEnd ? <p>{labels.cancellation}</p> : null}
      </section>
    );
  }
  if (routeId === 'account-invoices') {
    return (
      <section aria-label={labels.invoice}>
        <ul>
          {projection.invoices.map((invoice) => (
            <li key={invoice.invoiceId}>
              {invoice.invoiceId}: {invoice.state}
            </li>
          ))}
        </ul>
      </section>
    );
  }
  if (routeId === 'account-support') {
    return (
      <section aria-label={labels.support}>
        <p>
          {locale === 'pt-BR' ? 'Casos abertos' : 'Open cases'}: {view.support.openCount}
        </p>
      </section>
    );
  }
  if (routeId === 'account-privacy') {
    return (
      <section aria-label={labels.consent}>
        <p>
          {locale === 'pt-BR'
            ? 'Escolhas de diagnóstico usam autoridade separada, versionada e revogável.'
            : 'Diagnostic choices use separate versioned, revocable authority.'}
        </p>
      </section>
    );
  }
  return (
    <section aria-label={locale === 'pt-BR' ? 'Resumo autoritativo' : 'Authoritative summary'}>
      <p>{view.identity.displayName}</p>
      <p>{view.identity.emailRedacted}</p>
      <p>{view.billing.plan}</p>
      <p>{view.device.label ?? (locale === 'pt-BR' ? 'Nenhum PC ativo' : 'No active PC')}</p>
    </section>
  );
};

export const AccountAuthorityPage = ({
  authorityBaseUrl,
  locale,
  routeId,
}: AccountAuthorityPageProps) => {
  const [result, setResult] = useState<AccountAuthorityReadResult | null>(null);
  const [projection, setProjection] = useState<AccountAuthorityProjection | null>(null);
  const authority = useMemo(
    () =>
      createAccountAuthority({
        baseUrl: authorityBaseUrl,
        correlationId,
        csrfToken: readCsrfToken,
      }),
    [authorityBaseUrl],
  );
  useEffect(() => {
    let active = true;
    void authority.project().then((next) => {
      if (!active) return;
      setResult(next);
      if ('projection' in next) setProjection(next.projection);
    });
    return () => {
      active = false;
    };
  }, [authority]);

  const metadata = getAccountPreviewMetadata(locale, routeId);
  if (result === null) {
    return (
      <article aria-busy="true">
        <h1>{metadata.title}</h1>
        <p role="status">{copy[locale].loading}</p>
      </article>
    );
  }
  if (projection === null || result.status === 'error') {
    return (
      <article>
        <h1>{metadata.title}</h1>
        <p role="alert">{copy[locale].error}</p>
      </article>
    );
  }
  return (
    <article
      className="account-responsibility"
      data-account-runtime="production"
      data-authority-connected="true"
      data-account-state={result.status}
    >
      <header>
        <h1>{metadata.title}</h1>
        <p>{metadata.summary}</p>
      </header>
      <AuthorityStatus locale={locale} status={result.status} />
      {routeId === 'account-profile' ? (
        <ProfileAuthority
          authorityBaseUrl={authorityBaseUrl}
          locale={locale}
          onProjection={setProjection}
          projection={projection}
        />
      ) : routeId === 'account-device' ? (
        <DeviceAuthority locale={locale} projection={projection} />
      ) : (
        <ProjectionResponsibility locale={locale} projection={projection} routeId={routeId} />
      )}
    </article>
  );
};
