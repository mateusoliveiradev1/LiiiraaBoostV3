'use client';

import { LbButton, LbTextArea, LbTextField } from '@liiiraa/design-system';
import {
  EmptyComposition,
  PreviewBoundary,
  PreviewReceipt,
  PreviewWorkflow,
  ProvenanceLabel,
  ResponsiveDataTable,
  StatusSignal,
  createPreviewWorkflowMachine,
  type PreviewActionFamily,
  type PreviewWorkflowOutput,
  type PreviewWorkflowInput,
} from '@liiiraa/web-features';
import { routeHref, WEB_ORIGINS, type WebLocale, type WebRouteId } from '@liiiraa/web-core';
import {
  createWebPreviewAuthority,
  getWebScenario,
  type WebScenarioId,
} from '@liiiraa/web-preview';
import { useMemo, useState, type FormEvent, type ReactNode } from 'react';

import accountEnJson from '../content/account.en.json';
import accountPtBrJson from '../content/account.pt-BR.json';
import {
  ACCOUNT_ENTRY_ROUTE_IDS,
  getAccountPreviewMetadata,
  type AccountPreviewRoute,
} from '../account-preview-model';
export type AccountPreviewState = 'ready' | 'offline' | 'stale' | 'expired-session' | 'failure';

type AccountContent = Readonly<{
  schemaVersion: 1;
  locale: WebLocale;
  fixtureLabel: string;
  states: Readonly<Record<'offline' | 'stale' | 'expired' | 'failure', string>>;
  signIn: Readonly<{
    title: string;
    summary: string;
    emailLabel: string;
    emailHint: string;
    emailAction: string;
    socialAction: string;
    passkeyAction: string;
    security: string;
    invalidEmail: string;
  }>;
  overview: Readonly<{
    title: string;
    summary: string;
    emptyTitle: string;
    emptyBody: string;
  }>;
  profile: Readonly<{
    title: string;
    summary: string;
    nameLabel: string;
    localeLabel: string;
    action: string;
  }>;
  security: Readonly<{
    title: string;
    summary: string;
    verifiedEmail: string;
    passkey: string;
    mfa: string;
    sessions: string;
    recovery: string;
    alerts: string;
    emptyAlerts: string;
    review: string;
    sessionDetail: string;
    recoveryDetail: string;
  }>;
  subscription: Readonly<{
    title: string;
    summary: string;
    plan: string;
    price: string;
    billingPeriod: string;
    renewal: string;
    taxes: string;
    cancellation: string;
    refunds: string;
    deviceRules: string;
    expirationEffects: string;
    action: string;
  }>;
  invoices: Readonly<{ title: string; summary: string; caption: string; empty: string }>;
  device: Readonly<{
    title: string;
    summary: string;
    label: string;
    detail: string;
    cooldown: string;
    action: string;
  }>;
  downloads: Readonly<{ title: string; summary: string; boundary: string; action: string }>;
  privacy: Readonly<{
    title: string;
    summary: string;
    purpose: string;
    retention: string;
    sharing: string;
    revocation: string;
    exportAction: string;
    correctionAction: string;
    deletionAction: string;
    consentAction: string;
  }>;
  support: Readonly<{
    title: string;
    summary: string;
    subjectLabel: string;
    bodyLabel: string;
    action: string;
    purpose: string;
    retention: string;
    sharing: string;
    revocation: string;
    noUpload: string;
    sensitiveReview: string;
  }>;
  recovery: Readonly<{
    title: string;
    safeWork: string;
    signIn: string;
    support: string;
  }>;
}>;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const nonEmpty = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const admitAccountContent = (candidate: unknown, locale: WebLocale): AccountContent => {
  if (
    !isRecord(candidate) ||
    candidate['schemaVersion'] !== 1 ||
    candidate['locale'] !== locale ||
    !nonEmpty(candidate['fixtureLabel']) ||
    !isRecord(candidate['states']) ||
    !isRecord(candidate['signIn']) ||
    !isRecord(candidate['overview']) ||
    !isRecord(candidate['profile']) ||
    !isRecord(candidate['security']) ||
    !isRecord(candidate['subscription']) ||
    !isRecord(candidate['invoices']) ||
    !isRecord(candidate['device']) ||
    !isRecord(candidate['downloads']) ||
    !isRecord(candidate['privacy']) ||
    !isRecord(candidate['support']) ||
    !isRecord(candidate['recovery'])
  ) {
    throw new Error(`ACCOUNT_CONTENT_INVALID:${locale}:root`);
  }
  return candidate as unknown as AccountContent;
};

const ACCOUNT_CONTENT = Object.freeze({
  en: admitAccountContent(accountEnJson, 'en'),
  'pt-BR': admitAccountContent(accountPtBrJson, 'pt-BR'),
});

export const getAccountContent = (locale: WebLocale): AccountContent => ACCOUNT_CONTENT[locale];

const hrefFor = (routeId: WebRouteId, locale: WebLocale): string => {
  const result = routeHref(routeId, { locale });
  if (!result.ok) throw new Error(`ACCOUNT_ROUTE_UNAVAILABLE:${routeId}`);
  return result.value;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export const validatePreviewEmail = (value: string): boolean =>
  value.length <= 254 && EMAIL_PATTERN.test(value);

const actionInput = ({
  consent,
  family,
  fields,
  impact,
  label,
  purpose,
  review,
  safeDraftFields = [],
}: Readonly<{
  family: PreviewActionFamily;
  consent?: PreviewWorkflowInput['consent'];
  fields: Readonly<Record<string, string>>;
  impact?: string;
  label: string;
  purpose?: string;
  review: readonly Readonly<{ field: string; label: string; before: string; after: string }>[];
  safeDraftFields?: readonly string[];
}>): PreviewWorkflowInput => ({
  action: { family, id: `${family}.review`, objectLabel: label, surface: 'account' },
  ...(consent === undefined ? {} : { consent }),
  fields,
  ...(impact === undefined ? {} : { impact }),
  ...(purpose === undefined ? {} : { purpose }),
  requiredFields: Object.keys(fields),
  review,
  role: 'account-holder',
  safeDraftFields,
  viewport: { width: 1280 },
});

const PreviewWorkflowRunner = ({
  input,
  locale,
  scenarioId,
}: Readonly<{
  input: PreviewWorkflowInput;
  locale: WebLocale;
  scenarioId: WebScenarioId;
}>) => {
  const machine = useMemo(() => {
    const scenario = getWebScenario(scenarioId);
    const clock = () => scenario.clock;
    let cancellationIndex = 0;
    const authority = createWebPreviewAuthority({
      clock,
      correlationIds: Array.from(
        { length: 8 },
        (_, index) => `${scenario.id}-${input.action.family}-authority-${String(index + 1)}`,
      ),
      scenario,
    });
    return createPreviewWorkflowMachine({
      authority,
      clock,
      correlationId: () => {
        cancellationIndex += 1;
        return `${scenario.id}-${input.action.family}-cancel-${String(cancellationIndex)}`;
      },
    });
  }, [input.action.family, scenarioId]);
  return <PreviewWorkflow input={input} locale={locale} machine={machine} />;
};

const FixtureHeader = ({
  content,
  summary,
  title,
}: Readonly<{
  content: AccountContent;
  summary: string;
  title: string;
}>) => (
  <header className="lb-web-route-header">
    <div>
      <h1 tabIndex={-1}>{title}</h1>
      <p>{summary}</p>
    </div>
    <ProvenanceLabel detail={content.fixtureLabel} kind="simulated" locale={content.locale} />
  </header>
);

const DegradedAccountPreview = ({ content }: Readonly<{ content: AccountContent }>) => (
  <article data-account-state="offline stale expired-session partial-failure">
    <FixtureHeader
      content={content}
      summary={content.states.failure}
      title={content.recovery.title}
    />
    <PreviewBoundary
      description={
        content.locale === 'pt-BR'
          ? 'A autoridade da Fase 4 continua desconectada; nenhuma repetição executa uma ação remota.'
          : 'Phase 4 authority remains disconnected; retrying cannot execute a remote action.'
      }
    />
    <ol className="lb-web-timeline">
      {(['offline', 'stale', 'expired', 'failure'] as const).map((state) => (
        <li key={state}>
          <StatusSignal
            label={state === 'failure' ? 'Failure' : state}
            state={state === 'failure' ? 'error' : 'warning'}
          />
          <p>{content.states[state]}</p>
        </li>
      ))}
    </ol>
    <p role="status">
      <strong>{content.recovery.safeWork}:</strong> displayName, locale, supportSubject.
    </p>
    <nav aria-label={content.locale === 'pt-BR' ? 'Recuperação segura' : 'Safe recovery'}>
      <a href={hrefFor('account-sign-in', content.locale)}>{content.recovery.signIn}</a>{' '}
      <a href={hrefFor('account-support', content.locale)}>{content.recovery.support}</a>
    </nav>
  </article>
);

export const SignInPreview = ({
  content,
  scenarioId,
}: Readonly<{ content: AccountContent; scenarioId: WebScenarioId }>) => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [workflow, setWorkflow] = useState<PreviewWorkflowInput | null>(null);

  const startEmail = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validatePreviewEmail(email)) {
      setError(content.signIn.invalidEmail);
      return;
    }
    setError(null);
    setWorkflow(
      actionInput({
        family: 'auth',
        fields: { email },
        label: content.signIn.emailAction,
        review: [
          {
            field: 'email',
            label: content.signIn.emailLabel,
            before: 'Not reviewed',
            after: email,
          },
        ],
      }),
    );
  };

  if (workflow !== null) {
    return (
      <PreviewWorkflowRunner input={workflow} locale={content.locale} scenarioId={scenarioId} />
    );
  }

  const startChoice = (family: 'social' | 'passkey', provider: string, label: string) => {
    setWorkflow(
      actionInput({
        family,
        fields: { provider },
        label,
        review: [{ field: 'provider', label: 'Provider', before: 'Not selected', after: provider }],
      }),
    );
  };

  return (
    <article className="lb-web-sign-in" data-account-state="sign-in-preview">
      <FixtureHeader
        content={content}
        summary={content.signIn.summary}
        title={content.signIn.title}
      />
      <PreviewBoundary description={content.signIn.security} />
      <form noValidate onSubmit={startEmail}>
        {error !== null ? (
          <div aria-labelledby="sign-in-error-title" role="alert" tabIndex={-1}>
            <h2 id="sign-in-error-title">
              {content.locale === 'pt-BR' ? 'Corrija o e-mail' : 'Correct the email address'}
            </h2>
            <a href="#preview-email">{error}</a>
          </div>
        ) : null}
        <div id="preview-email">
          <LbTextField
            description={content.signIn.emailHint}
            errorMessage={error ?? undefined}
            isInvalid={error !== null}
            isRequired
            label={content.signIn.emailLabel}
            maxLength={254}
            onChange={setEmail}
            value={email}
          />
        </div>
        <LbButton type="submit">{content.signIn.emailAction}</LbButton>
      </form>
      <div
        aria-label={content.locale === 'pt-BR' ? 'Outras opções futuras' : 'Other future choices'}
        role="group"
      >
        <LbButton
          onPress={() =>
            startChoice('social', 'social-provider-preview', content.signIn.socialAction)
          }
          variant="secondary"
        >
          {content.signIn.socialAction}
        </LbButton>
        <LbButton
          onPress={() =>
            startChoice('passkey', 'windows-hello-preview', content.signIn.passkeyAction)
          }
          variant="secondary"
        >
          {content.signIn.passkeyAction}
        </LbButton>
      </div>
    </article>
  );
};

const OverviewPreview = ({ content }: Readonly<{ content: AccountContent }>) => (
  <article data-account-state="ready">
    <FixtureHeader
      content={content}
      summary={content.overview.summary}
      title={content.overview.title}
    />
    <ResponsiveDataTable
      caption={
        content.locale === 'pt-BR' ? 'Responsabilidades da conta' : 'Account responsibilities'
      }
      columns={[
        {
          id: 'responsibility',
          label: content.locale === 'pt-BR' ? 'Responsabilidade' : 'Responsibility',
        },
        { id: 'state', label: content.locale === 'pt-BR' ? 'Estado' : 'State' },
        { id: 'action', label: content.locale === 'pt-BR' ? 'Ação' : 'Action', essential: false },
      ]}
      rows={ACCOUNT_ENTRY_ROUTE_IDS.filter((id) => id !== 'account-sign-in').map((routeId) => {
        const metadata = getAccountPreviewMetadata(content.locale, routeId);
        return {
          id: routeId,
          cells: {
            responsibility: metadata.title,
            state: <StatusSignal label="Fixture" state="preview" />,
            action: <a href={hrefFor(routeId, content.locale)}>{content.security.review}</a>,
          },
          detail: <a href={hrefFor(routeId, content.locale)}>{metadata.summary}</a>,
        };
      })}
    />
    <EmptyComposition
      description={content.overview.emptyBody}
      title={content.overview.emptyTitle}
    />
  </article>
);

const ProfilePreview = ({
  content,
  scenarioId,
}: Readonly<{ content: AccountContent; scenarioId: WebScenarioId }>) => {
  const [displayName, setDisplayName] = useState('Astra Preview');
  const [workflow, setWorkflow] = useState<PreviewWorkflowInput | null>(null);
  if (workflow !== null) {
    return (
      <PreviewWorkflowRunner input={workflow} locale={content.locale} scenarioId={scenarioId} />
    );
  }
  return (
    <article data-account-state="ready">
      <FixtureHeader
        content={content}
        summary={content.profile.summary}
        title={content.profile.title}
      />
      <LbTextField
        description={content.fixtureLabel}
        isRequired
        label={content.profile.nameLabel}
        maxLength={80}
        onChange={setDisplayName}
        value={displayName}
      />
      <dl>
        <div>
          <dt>{content.profile.localeLabel}</dt>
          <dd>{content.locale}</dd>
        </div>
      </dl>
      <LbButton
        onPress={() => {
          setWorkflow(
            actionInput({
              family: 'auth',
              fields: { displayName, locale: content.locale },
              label: content.profile.action,
              review: [
                {
                  field: 'displayName',
                  label: content.profile.nameLabel,
                  before: 'Astra Preview',
                  after: displayName,
                },
                {
                  field: 'locale',
                  label: content.profile.localeLabel,
                  before: content.locale,
                  after: content.locale,
                },
              ],
              safeDraftFields: ['displayName', 'locale'],
            }),
          );
        }}
      >
        {content.profile.action}
      </LbButton>
    </article>
  );
};

export const SecurityMethodList = ({
  content,
  onReview,
}: Readonly<{ content: AccountContent; onReview: (family: 'passkey' | 'mfa') => void }>) => (
  <section aria-labelledby="security-methods-title" className="lb-web-security-methods">
    <h2 id="security-methods-title">{content.security.verifiedEmail}</h2>
    <ul>
      {(['passkey', 'mfa'] as const).map((family) => (
        <li key={family}>
          <strong>{family === 'passkey' ? content.security.passkey : content.security.mfa}</strong>{' '}
          <StatusSignal label="Fixture" state="preview" />{' '}
          <LbButton onPress={() => onReview(family)} variant="quiet">
            {content.security.review}
          </LbButton>
        </li>
      ))}
    </ul>
  </section>
);

export const SessionList = ({
  content,
  onReview,
}: Readonly<{ content: AccountContent; onReview: () => void }>) => (
  <section aria-labelledby="session-list-title" className="lb-web-session-list">
    <h2 id="session-list-title">{content.security.sessions}</h2>
    <ul>
      <li>
        <span>{content.security.sessionDetail}</span>{' '}
        <LbButton onPress={onReview} variant="quiet">
          {content.security.review}
        </LbButton>
      </li>
    </ul>
  </section>
);

const SecurityPreview = ({
  content,
  scenarioId,
}: Readonly<{ content: AccountContent; scenarioId: WebScenarioId }>) => {
  const [workflow, setWorkflow] = useState<PreviewWorkflowInput | null>(null);
  const reviewSecurity = (family: 'passkey' | 'mfa' | 'session') => {
    const label =
      family === 'passkey'
        ? content.security.passkey
        : family === 'mfa'
          ? content.security.mfa
          : content.security.sessions;
    setWorkflow(
      actionInput({
        family,
        fields: { target: `${family}-fixture` },
        label,
        review: [{ field: 'target', label, before: 'Fixture unchanged', after: 'Reviewed only' }],
      }),
    );
  };
  if (workflow !== null) {
    return (
      <PreviewWorkflowRunner input={workflow} locale={content.locale} scenarioId={scenarioId} />
    );
  }
  return (
    <article data-account-state="ready">
      <FixtureHeader
        content={content}
        summary={content.security.summary}
        title={content.security.title}
      />
      <PreviewBoundary description={content.signIn.security} />
      <SecurityMethodList content={content} onReview={reviewSecurity} />
      <SessionList content={content} onReview={() => reviewSecurity('session')} />
      <section aria-labelledby="recovery-title" className="lb-web-recovery-review">
        <h2 id="recovery-title">{content.security.recovery}</h2>
        <p>{content.security.recoveryDetail}</p>
      </section>
      <EmptyComposition
        description={content.security.emptyAlerts}
        title={content.security.alerts}
      />
    </article>
  );
};

const CollectionDisclosure = ({
  content,
  purpose,
  retention,
  revocation,
  sharing,
}: Readonly<{
  content: AccountContent;
  purpose: string;
  retention: string;
  revocation: string;
  sharing: string;
}>) => (
  <section aria-labelledby="collection-disclosure-title" className="lb-web-consent-review">
    <h2 id="collection-disclosure-title">
      {content.locale === 'pt-BR'
        ? 'Limite de coleta e consentimento'
        : 'Collection and consent boundary'}
    </h2>
    <dl>
      <div>
        <dt>{content.locale === 'pt-BR' ? 'Finalidade' : 'Purpose'}</dt>
        <dd>{purpose}</dd>
      </div>
      <div>
        <dt>{content.locale === 'pt-BR' ? 'Campos obrigatórios' : 'Required fields'}</dt>
        <dd>
          {content.locale === 'pt-BR'
            ? 'Somente campos exibidos na revisão'
            : 'Only fields shown in review'}
        </dd>
      </div>
      <div>
        <dt>{content.locale === 'pt-BR' ? 'Retenção' : 'Retention'}</dt>
        <dd>{retention}</dd>
      </div>
      <div>
        <dt>{content.locale === 'pt-BR' ? 'Compartilhamento' : 'Sharing'}</dt>
        <dd>{sharing}</dd>
      </div>
      <div>
        <dt>{content.locale === 'pt-BR' ? 'Revogação' : 'Revocation'}</dt>
        <dd>{revocation}</dd>
      </div>
    </dl>
    <a href={`${WEB_ORIGINS['public-origin']}${hrefFor('public-privacy-policy', content.locale)}`}>
      {content.locale === 'pt-BR'
        ? 'Ler política de privacidade completa'
        : 'Read the full privacy policy'}
    </a>
  </section>
);

export const SubscriptionSummary = ({
  content,
  scenarioId,
}: Readonly<{ content: AccountContent; scenarioId: WebScenarioId }>) => {
  const [workflow, setWorkflow] = useState<PreviewWorkflowInput | null>(null);
  if (workflow !== null) {
    return (
      <PreviewWorkflowRunner input={workflow} locale={content.locale} scenarioId={scenarioId} />
    );
  }
  const terms = [
    [content.locale === 'pt-BR' ? 'Preço' : 'Price', content.subscription.price],
    [
      content.locale === 'pt-BR' ? 'Período de cobrança' : 'Billing period',
      content.subscription.billingPeriod,
    ],
    [content.locale === 'pt-BR' ? 'Renovação' : 'Renewal', content.subscription.renewal],
    [content.locale === 'pt-BR' ? 'Tributos' : 'Taxes', content.subscription.taxes],
    [
      content.locale === 'pt-BR' ? 'Cancelamento' : 'Cancellation',
      content.subscription.cancellation,
    ],
    [content.locale === 'pt-BR' ? 'Reembolsos' : 'Refunds', content.subscription.refunds],
    [
      content.locale === 'pt-BR' ? 'Regras de dispositivo' : 'Device rules',
      content.subscription.deviceRules,
    ],
    [
      content.locale === 'pt-BR' ? 'Efeitos da expiração' : 'Expiration effects',
      content.subscription.expirationEffects,
    ],
  ] as const;
  return (
    <article className="lb-web-subscription" data-account-state="ready">
      <FixtureHeader
        content={content}
        summary={content.subscription.summary}
        title={content.subscription.title}
      />
      <StatusSignal label={content.subscription.plan} state="preview" />
      <dl>
        {terms.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <PreviewBoundary description={content.subscription.summary} />
      <LbButton
        onPress={() => {
          setWorkflow(
            actionInput({
              family: 'billing',
              fields: { plan: 'premium-preview' },
              impact: content.subscription.expirationEffects,
              label: content.subscription.action,
              review: [
                {
                  field: 'plan',
                  label: content.subscription.plan,
                  before: 'No authoritative plan',
                  after: 'Premium review only',
                },
              ],
            }),
          );
        }}
      >
        {content.subscription.action}
      </LbButton>
    </article>
  );
};

export const InvoiceTable = ({ content }: Readonly<{ content: AccountContent }>) => (
  <article data-account-state="empty">
    <FixtureHeader
      content={content}
      summary={content.invoices.summary}
      title={content.invoices.title}
    />
    <ResponsiveDataTable
      caption={content.invoices.caption}
      columns={[
        { id: 'reference', label: content.locale === 'pt-BR' ? 'Referência' : 'Reference' },
        { id: 'state', label: content.locale === 'pt-BR' ? 'Estado' : 'State' },
        { id: 'amount', label: content.locale === 'pt-BR' ? 'Valor' : 'Amount', essential: false },
        { id: 'date', label: content.locale === 'pt-BR' ? 'Data' : 'Date', essential: false },
      ]}
      rows={[
        {
          id: 'invoice-schema-preview',
          cells: {
            reference: <code>INV-PREVIEW</code>,
            state: (
              <StatusSignal
                label={content.locale === 'pt-BR' ? 'Não emitida' : 'Not issued'}
                state="preview"
              />
            ),
            amount: 'R$ 0,00',
            date: '—',
          },
          detail: <p>{content.invoices.empty}</p>,
        },
      ]}
    />
    <EmptyComposition description={content.invoices.empty} />
  </article>
);

export const DeviceBindingReview = ({
  content,
  scenarioId,
}: Readonly<{ content: AccountContent; scenarioId: WebScenarioId }>) => {
  const [workflow, setWorkflow] = useState<PreviewWorkflowInput | null>(null);
  if (workflow !== null) {
    return (
      <PreviewWorkflowRunner input={workflow} locale={content.locale} scenarioId={scenarioId} />
    );
  }
  return (
    <article className="lb-web-device-review" data-account-state="sensitive-review">
      <FixtureHeader
        content={content}
        summary={content.device.summary}
        title={content.device.title}
      />
      <dl>
        <div>
          <dt>{content.device.label}</dt>
          <dd>{content.device.detail}</dd>
        </div>
      </dl>
      <PreviewBoundary description={content.device.cooldown} />
      <LbButton
        onPress={() =>
          setWorkflow(
            actionInput({
              family: 'device',
              fields: { device: 'desktop-preview-01' },
              impact: content.device.cooldown,
              label: content.device.action,
              review: [
                {
                  field: 'device',
                  label: content.device.label,
                  before: 'Synthetic binding retained',
                  after: 'Replacement reviewed only',
                },
              ],
            }),
          )
        }
        variant="destructive"
      >
        {content.device.action}
      </LbButton>
    </article>
  );
};

export const DownloadsPreview = ({ content }: Readonly<{ content: AccountContent }>) => {
  const releaseHref = routeHref('releases-channel', { channel: 'stable', locale: content.locale });
  if (!releaseHref.ok) throw new Error('ACCOUNT_PUBLIC_RELEASE_ROUTE_UNAVAILABLE');
  return (
    <article data-account-state="public-transition">
      <FixtureHeader
        content={content}
        summary={content.downloads.summary}
        title={content.downloads.title}
      />
      <PreviewBoundary
        description={content.downloads.boundary}
        title={content.locale === 'pt-BR' ? 'Mudança de origem' : 'Origin change'}
      />
      <a href={`${WEB_ORIGINS['public-origin']}${releaseHref.value}`}>{content.downloads.action}</a>
    </article>
  );
};

export const ConsentReview = ({ content }: Readonly<{ content: AccountContent }>) => (
  <CollectionDisclosure
    content={content}
    purpose={content.privacy.purpose}
    retention={content.privacy.retention}
    revocation={content.privacy.revocation}
    sharing={content.privacy.sharing}
  />
);

export const DataRequestReview = ({
  content,
  onSelect,
}: Readonly<{
  content: AccountContent;
  onSelect: (request: 'consent' | 'correction' | 'deletion' | 'export') => void;
}>) => (
  <section aria-labelledby="data-request-title" className="lb-web-data-request">
    <h2 id="data-request-title">
      {content.locale === 'pt-BR' ? 'Solicitações disponíveis' : 'Available requests'}
    </h2>
    <div
      role="group"
      aria-label={content.locale === 'pt-BR' ? 'Solicitações de privacidade' : 'Privacy requests'}
    >
      <LbButton onPress={() => onSelect('export')} variant="secondary">
        {content.privacy.exportAction}
      </LbButton>
      <LbButton onPress={() => onSelect('correction')} variant="secondary">
        {content.privacy.correctionAction}
      </LbButton>
      <LbButton onPress={() => onSelect('consent')} variant="secondary">
        {content.privacy.consentAction}
      </LbButton>
      <LbButton onPress={() => onSelect('deletion')} variant="destructive">
        {content.privacy.deletionAction}
      </LbButton>
    </div>
  </section>
);

export const PrivacyCenter = ({
  content,
  scenarioId,
}: Readonly<{ content: AccountContent; scenarioId: WebScenarioId }>) => {
  const [workflow, setWorkflow] = useState<PreviewWorkflowInput | null>(null);
  if (workflow !== null) {
    return (
      <PreviewWorkflowRunner input={workflow} locale={content.locale} scenarioId={scenarioId} />
    );
  }
  const selectRequest = (request: 'consent' | 'correction' | 'deletion' | 'export') => {
    const family = request === 'consent' ? 'consent' : 'privacy';
    const labels = {
      consent: content.privacy.consentAction,
      correction: content.privacy.correctionAction,
      deletion: content.privacy.deletionAction,
      export: content.privacy.exportAction,
    } as const;
    setWorkflow(
      actionInput({
        consent: {
          expiresAt: '2026-01-15T13:00:00.000Z',
          granted: true,
          permittedFields: ['request-type'],
          purpose: content.privacy.purpose,
          requestingActor: 'account-holder',
        },
        family,
        fields: { requestType: request },
        impact: content.privacy.revocation,
        label: labels[request],
        purpose: content.privacy.purpose,
        review: [
          {
            field: 'requestType',
            label: labels[request],
            before: 'No request',
            after: 'Review prepared',
          },
        ],
      }),
    );
  };
  return (
    <article className="lb-web-privacy-center" data-account-state="sensitive-review">
      <FixtureHeader
        content={content}
        summary={content.privacy.summary}
        title={content.privacy.title}
      />
      <ConsentReview content={content} />
      <DataRequestReview content={content} onSelect={selectRequest} />
    </article>
  );
};

export const SensitiveFieldReview = ({ content }: Readonly<{ content: AccountContent }>) => (
  <aside className="lb-web-sensitive-fields" role="note">
    <h2>{content.locale === 'pt-BR' ? 'Revisão de campos sensíveis' : 'Sensitive-field review'}</h2>
    <p>{content.support.sensitiveReview}</p>
    <p>
      <strong>{content.support.noUpload}</strong>
    </p>
  </aside>
);

export const SubmissionReceipt = ({
  actionLabel,
  locale,
  output,
}: Readonly<{ actionLabel: string; locale: WebLocale; output: PreviewWorkflowOutput }>) => (
  <PreviewReceipt actionLabel={actionLabel} locale={locale} output={output} />
);

export const SupportRequestComposer = ({
  content,
  scenarioId,
}: Readonly<{ content: AccountContent; scenarioId: WebScenarioId }>) => {
  const [subject, setSubject] = useState('Synthetic startup question');
  const [description, setDescription] = useState('The fixture shows a startup state for review.');
  const [workflow, setWorkflow] = useState<PreviewWorkflowInput | null>(null);
  if (workflow !== null) {
    return (
      <PreviewWorkflowRunner input={workflow} locale={content.locale} scenarioId={scenarioId} />
    );
  }
  return (
    <article className="lb-web-support-composer" data-account-state="sensitive-review">
      <FixtureHeader
        content={content}
        summary={content.support.summary}
        title={content.support.title}
      />
      <CollectionDisclosure
        content={content}
        purpose={content.support.purpose}
        retention={content.support.retention}
        revocation={content.support.revocation}
        sharing={content.support.sharing}
      />
      <SensitiveFieldReview content={content} />
      <LbTextField
        label={content.support.subjectLabel}
        maxLength={120}
        onChange={setSubject}
        value={subject}
      />
      <LbTextArea
        label={content.support.bodyLabel}
        maxLength={600}
        onChange={setDescription}
        value={description}
      />
      <LbButton
        onPress={() =>
          setWorkflow(
            actionInput({
              consent: {
                expiresAt: '2026-01-15T13:00:00.000Z',
                granted: true,
                permittedFields: ['subject', 'description'],
                purpose: content.support.purpose,
                requestingActor: 'account-holder',
              },
              family: 'support',
              fields: { description, subject },
              impact: content.support.sharing,
              label: content.support.action,
              purpose: content.support.purpose,
              review: [
                {
                  field: 'subject',
                  label: content.support.subjectLabel,
                  before: 'No request',
                  after: subject,
                },
                {
                  field: 'description',
                  label: content.support.bodyLabel,
                  before: 'No request',
                  after: description,
                },
              ],
              safeDraftFields: ['subject'],
            }),
          )
        }
      >
        {content.support.action}
      </LbButton>
    </article>
  );
};

export type AccountPreviewExperienceProps = Readonly<{
  locale: WebLocale;
  routeId: AccountPreviewRoute;
  scenarioId?: WebScenarioId;
}>;

export const AccountPreviewExperience = ({
  locale,
  routeId,
  scenarioId,
}: AccountPreviewExperienceProps) => {
  const content = getAccountContent(locale);
  const activeScenarioId =
    scenarioId ??
    (routeId === 'account-sign-in'
      ? 'W10'
      : routeId === 'account-device' ||
          routeId === 'account-privacy' ||
          routeId === 'account-support'
        ? 'W13'
        : 'W11');
  if (activeScenarioId === 'W12') return <DegradedAccountPreview content={content} />;
  let view: ReactNode;
  switch (routeId) {
    case 'account-sign-in':
      view = <SignInPreview content={content} scenarioId={activeScenarioId} />;
      break;
    case 'account-overview':
      view = <OverviewPreview content={content} />;
      break;
    case 'account-profile':
      view = <ProfilePreview content={content} scenarioId={activeScenarioId} />;
      break;
    case 'account-security':
      view = <SecurityPreview content={content} scenarioId={activeScenarioId} />;
      break;
    case 'account-subscription':
      view = <SubscriptionSummary content={content} scenarioId={activeScenarioId} />;
      break;
    case 'account-invoices':
      view = <InvoiceTable content={content} />;
      break;
    case 'account-device':
      view = <DeviceBindingReview content={content} scenarioId={activeScenarioId} />;
      break;
    case 'account-downloads':
      view = <DownloadsPreview content={content} />;
      break;
    case 'account-privacy':
      view = <PrivacyCenter content={content} scenarioId={activeScenarioId} />;
      break;
    case 'account-support':
      view = <SupportRequestComposer content={content} scenarioId={activeScenarioId} />;
      break;
  }
  return (
    <div
      data-account-preview="deterministic"
      data-authority-connected="false"
      data-route-id={routeId}
      data-scenario-id={activeScenarioId}
    >
      {view}
    </div>
  );
};

export const AccountPreviewPage = (props: AccountPreviewExperienceProps) => (
  <AccountPreviewExperience {...props} />
);
