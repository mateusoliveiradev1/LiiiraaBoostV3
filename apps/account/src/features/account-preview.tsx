'use client';

import {
  LbButton,
  LbSkeletonRegion,
  LbTextArea,
  LbTextField,
  ProductIcon,
  type ProductIconName,
} from '@liiiraa/design-system';
import {
  EmptyComposition,
  PreviewBoundary,
  PreviewReceipt,
  PreviewWorkflow,
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
import type { AccountPreviewRoute } from '../account-preview-model';
import { DegradedAccountPreview, FixtureHeader } from './account-degraded-preview';
import { resolveAccountScenarioId } from './account-scenario';

export { resolveAccountScenarioId } from './account-scenario';
export type AccountPreviewState =
  'loading' | 'ready' | 'empty' | 'offline' | 'stale' | 'expired-session' | 'failure';

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
    responsibilityLabel: string;
    nextTitle: string;
    nextBody: string;
    nextAction: string;
    securityAction: string;
    checklistTitle: string;
    pendingState: string;
    noBillingState: string;
    notLinkedState: string;
    subscriptionAction: string;
    deviceAction: string;
    recentTitle: string;
    localPreviewTitle: string;
    localPreviewBody: string;
    noAuthorityTitle: string;
    noAuthorityBody: string;
    summariesTitle: string;
    reviewState: string;
    openAction: string;
    emptyTitle: string;
    emptyBody: string;
  }>;
  profile: Readonly<{
    title: string;
    summary: string;
    nameLabel: string;
    nameDescription: string;
    localeLabel: string;
    editorTitle: string;
    factsTitle: string;
    authorityState: string;
    limitations: string;
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

const LoadingAccountPreview = ({ content }: Readonly<{ content: AccountContent }>) => (
  <article aria-busy="true" className="account-responsibility" data-account-state="loading">
    <FixtureHeader
      summary={
        content.locale === 'pt-BR'
          ? 'Preparando o espaço de trabalho sem contatar uma autoridade remota.'
          : 'Preparing the workspace without contacting remote authority.'
      }
      title={content.overview.title}
    />
    <LbSkeletonRegion
      label={content.locale === 'pt-BR' ? 'Carregando dados da conta' : 'Loading account data'}
      rows={4}
    />
  </article>
);

const EmptyAccountPreview = ({ content }: Readonly<{ content: AccountContent }>) => (
  <article className="account-responsibility" data-account-state="empty">
    <FixtureHeader summary={content.overview.emptyBody} title={content.overview.emptyTitle} />
    <EmptyComposition description={content.overview.emptyBody} />
    <nav aria-label={content.locale === 'pt-BR' ? 'Próximas ações seguras' : 'Next safe actions'}>
      <a href={hrefFor('account-profile', content.locale)}>{content.overview.nextAction}</a>{' '}
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
      <FixtureHeader summary={content.signIn.summary} title={content.signIn.title} />
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

const OverviewPreview = ({ content }: Readonly<{ content: AccountContent }>) => {
  const readinessItems: readonly Readonly<{
    action: string;
    href: string;
    icon: ProductIconName;
    state: string;
    title: string;
    tone: 'pending' | 'unavailable';
  }>[] = [
    {
      action: content.overview.nextAction,
      href: hrefFor('account-profile', content.locale),
      icon: 'profile',
      state: content.overview.pendingState,
      title: content.profile.title,
      tone: 'pending',
    },
    {
      action: content.overview.securityAction,
      href: hrefFor('account-security', content.locale),
      icon: 'shield',
      state: content.overview.pendingState,
      title: content.security.title,
      tone: 'pending',
    },
    {
      action: content.overview.subscriptionAction,
      href: hrefFor('account-subscription', content.locale),
      icon: 'crown',
      state: content.overview.noBillingState,
      title: content.subscription.title,
      tone: 'unavailable',
    },
    {
      action: content.overview.deviceAction,
      href: hrefFor('account-device', content.locale),
      icon: 'device',
      state: content.overview.notLinkedState,
      title: content.device.title,
      tone: 'unavailable',
    },
  ];

  return (
    <article className="account-responsibility account-overview" data-account-state="ready">
      <FixtureHeader summary={content.overview.summary} title={content.overview.title} />

      <section aria-labelledby="account-next-title" className="account-overview__priority">
        <div className="account-overview__priority-copy">
          <span className="account-overview__responsibility">
            {content.overview.responsibilityLabel}
          </span>
          <h2 id="account-next-title">{content.overview.nextTitle}</h2>
          <p>{content.overview.nextBody}</p>
        </div>
        <nav aria-label={content.overview.nextTitle} className="account-overview__actions">
          <a href={hrefFor('account-profile', content.locale)}>{content.overview.nextAction}</a>
          <a href={hrefFor('account-security', content.locale)}>
            {content.overview.securityAction}
          </a>
        </nav>
      </section>

      <section aria-labelledby="account-readiness-title" className="account-overview__readiness">
        <div className="account-overview__section-heading">
          <h2 id="account-readiness-title">{content.overview.checklistTitle}</h2>
          <StatusSignal label={content.overview.reviewState} state="preview" />
        </div>
        <div className="account-overview__readiness-head" aria-hidden="true">
          <span>{content.locale === 'pt-BR' ? 'Etapa' : 'Step'}</span>
          <span>{content.locale === 'pt-BR' ? 'Estado' : 'State'}</span>
          <span>{content.locale === 'pt-BR' ? 'Próxima ação' : 'Next action'}</span>
        </div>
        <ul>
          {readinessItems.map((item) => (
            <li key={item.href}>
              <span className="account-overview__readiness-title">
                <ProductIcon name={item.icon} size={18} />
                <strong>{item.title}</strong>
              </span>
              <span className="account-overview__readiness-state" data-readiness-tone={item.tone}>
                <span aria-hidden="true" className="account-overview__state-dot" />
                {item.state}
              </span>
              <a href={item.href}>
                {item.action} <ProductIcon name="chevronRight" size={16} />
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="account-activity-title" className="account-overview__activity">
        <h2 id="account-activity-title">{content.overview.recentTitle}</h2>
        <ul>
          <li>
            <ProductIcon name="browser" size={19} />
            <span>
              <strong>{content.overview.localPreviewTitle}</strong>
              <span>{content.overview.localPreviewBody}</span>
            </span>
          </li>
          <li>
            <ProductIcon name="info" size={19} />
            <span>
              <strong>{content.overview.noAuthorityTitle}</strong>
              <span>{content.overview.noAuthorityBody}</span>
            </span>
          </li>
        </ul>
      </section>
    </article>
  );
};

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
    <article className="account-responsibility account-profile" data-account-state="ready">
      <FixtureHeader summary={content.profile.summary} title={content.profile.title} />
      <div className="account-profile__layout account-workspace-split" data-workspace-layout="7/5">
        <section
          aria-labelledby="profile-editor-title"
          className="account-profile__editor"
          data-workspace-region="focal"
        >
          <h2 id="profile-editor-title">{content.profile.editorTitle}</h2>
          <div className="account-profile__control">
            <LbTextField
              description={content.profile.nameDescription}
              isRequired
              label={content.profile.nameLabel}
              maxLength={80}
              onChange={setDisplayName}
              value={displayName}
            />
          </div>
          <dl className="account-profile__facts">
            <div>
              <dt>{content.profile.localeLabel}</dt>
              <dd>{content.locale}</dd>
            </div>
            <div data-authority-action="unavailable">
              <dt>{content.profile.factsTitle}</dt>
              <dd>
                <StatusSignal label={content.profile.authorityState} state="unavailable" />
              </dd>
            </div>
          </dl>
          <div className="account-profile__actions">
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
          </div>
        </section>

        <aside
          aria-labelledby="profile-facts-title"
          className="account-profile__context"
          data-workspace-region="context"
        >
          <h2 id="profile-facts-title">{content.profile.factsTitle}</h2>
          <p>{content.profile.limitations}</p>
          <dl>
            <div>
              <dt>{content.profile.nameLabel}</dt>
              <dd>{displayName}</dd>
            </div>
            <div>
              <dt>{content.profile.localeLabel}</dt>
              <dd>{content.locale}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </article>
  );
};

export const SecurityMethodList = ({
  content,
  onReview,
}: Readonly<{ content: AccountContent; onReview: (family: 'passkey' | 'mfa') => void }>) => (
  <section
    aria-labelledby="security-methods-title"
    className="lb-web-security-methods account-security__methods"
  >
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
  <section
    aria-labelledby="session-list-title"
    className="lb-web-session-list account-security__sessions"
  >
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
    <article className="account-responsibility account-security" data-account-state="ready">
      <FixtureHeader summary={content.security.summary} title={content.security.title} />
      <div
        className="account-security__workspace account-workspace-split"
        data-workspace-layout="7/5"
      >
        <div className="account-security__primary" data-workspace-region="focal">
          <SecurityMethodList content={content} onReview={reviewSecurity} />
          <SessionList content={content} onReview={() => reviewSecurity('session')} />
        </div>
        <aside
          aria-labelledby="recovery-title"
          className="account-security__recovery"
          data-workspace-region="context"
        >
          <h2 id="recovery-title">{content.security.recovery}</h2>
          <p>{content.security.recoveryDetail}</p>
          <StatusSignal
            label={
              content.locale === 'pt-BR' ? 'Indisponível nesta fase' : 'Unavailable in this phase'
            }
            state="unavailable"
          />
        </aside>
      </div>
      <section aria-labelledby="security-alerts-title" className="account-security__alerts">
        <h2 id="security-alerts-title">{content.security.alerts}</h2>
        <EmptyComposition description={content.security.emptyAlerts} />
      </section>
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
    <dl className="account-definition-list">
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
    <article
      className="account-responsibility account-subscription lb-web-subscription"
      data-account-state="ready"
    >
      <FixtureHeader summary={content.subscription.summary} title={content.subscription.title} />
      <div
        className="account-subscription__workspace account-workspace-split"
        data-workspace-layout="7/5"
      >
        <section className="account-subscription__focus" data-workspace-region="focal">
          <div className="account-subscription__summary">
            <strong>{content.subscription.plan}</strong>
            <StatusSignal
              label={content.locale === 'pt-BR' ? 'Termos para revisão' : 'Terms for review'}
              state="preview"
            />
          </div>
          <dl className="account-definition-list">
            {terms.slice(0, 4).map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <div className="account-sensitive-action">
            <p>
              {content.locale === 'pt-BR'
                ? 'A próxima etapa abre uma revisão sem cobrança.'
                : 'The next step opens a review without charging.'}
            </p>
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
          </div>
        </section>
        <aside className="account-subscription__context" data-workspace-region="context">
          <h2>
            {content.locale === 'pt-BR' ? 'Proteções da assinatura' : 'Subscription safeguards'}
          </h2>
          <dl className="account-definition-list">
            {terms.slice(4).map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </div>
    </article>
  );
};

export const InvoiceTable = ({ content }: Readonly<{ content: AccountContent }>) => (
  <article className="account-responsibility account-invoices" data-account-state="empty">
    <FixtureHeader summary={content.invoices.summary} title={content.invoices.title} />
    <div
      className="account-invoices__workspace account-workspace-split"
      data-workspace-layout="8/4"
    >
      <section data-workspace-region="focal">
        <ResponsiveDataTable
          caption={content.invoices.caption}
          columns={[
            { id: 'reference', label: content.locale === 'pt-BR' ? 'Referência' : 'Reference' },
            { id: 'state', label: content.locale === 'pt-BR' ? 'Estado' : 'State' },
            {
              id: 'amount',
              label: content.locale === 'pt-BR' ? 'Valor' : 'Amount',
              essential: false,
            },
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
      </section>
      <aside className="account-invoices__context" data-workspace-region="context">
        <h2>{content.locale === 'pt-BR' ? 'Histórico de cobrança' : 'Billing history'}</h2>
        <EmptyComposition description={content.invoices.empty} />
      </aside>
    </div>
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
    <article
      className="account-responsibility account-device lb-web-device-review"
      data-account-state="sensitive-review"
    >
      <FixtureHeader summary={content.device.summary} title={content.device.title} />
      <div
        className="account-device__workspace account-workspace-split"
        data-workspace-layout="7/5"
      >
        <section className="account-device__focus" data-workspace-region="focal">
          <dl className="account-definition-list">
            <div>
              <dt>
                {content.locale === 'pt-BR' ? 'Dispositivo em revisão' : 'Device under review'}
              </dt>
              <dd>{content.device.label}</dd>
            </div>
            <div>
              <dt>{content.locale === 'pt-BR' ? 'Detalhes coletados' : 'Collected details'}</dt>
              <dd>{content.device.detail}</dd>
            </div>
          </dl>
          <div className="account-sensitive-action">
            <p>{content.device.cooldown}</p>
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
          </div>
        </section>
        <aside data-workspace-region="context">
          <PreviewBoundary description={content.device.cooldown} />
        </aside>
      </div>
    </article>
  );
};

export const DownloadsPreview = ({ content }: Readonly<{ content: AccountContent }>) => {
  const releaseHref = routeHref('releases-channel', { channel: 'stable', locale: content.locale });
  if (!releaseHref.ok) throw new Error('ACCOUNT_PUBLIC_RELEASE_ROUTE_UNAVAILABLE');
  return (
    <article
      className="account-responsibility account-downloads"
      data-account-state="public-transition"
    >
      <FixtureHeader summary={content.downloads.summary} title={content.downloads.title} />
      <div
        className="account-downloads__handoff account-workspace-split"
        data-workspace-layout="7/5"
      >
        <section className="account-downloads__focus" data-workspace-region="focal">
          <h2>{content.locale === 'pt-BR' ? 'Canal público estável' : 'Public stable channel'}</h2>
          <a href={`${WEB_ORIGINS['public-origin']}${releaseHref.value}`}>
            {content.downloads.action}
          </a>
        </section>
        <aside data-workspace-region="context">
          <PreviewBoundary
            description={content.downloads.boundary}
            title={content.locale === 'pt-BR' ? 'Mudança de origem' : 'Origin change'}
          />
        </aside>
      </div>
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
    <article
      className="account-responsibility account-privacy lb-web-privacy-center"
      data-account-state="sensitive-review"
    >
      <FixtureHeader summary={content.privacy.summary} title={content.privacy.title} />
      <div
        className="account-privacy__workspace account-workspace-split"
        data-workspace-layout="7/5"
      >
        <div className="account-privacy__requests" data-workspace-region="focal">
          <DataRequestReview content={content} onSelect={selectRequest} />
        </div>
        <aside className="account-privacy__context" data-workspace-region="context">
          <ConsentReview content={content} />
        </aside>
      </div>
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
    <article
      className="account-responsibility account-support lb-web-support-composer"
      data-account-state="sensitive-review"
    >
      <FixtureHeader summary={content.support.summary} title={content.support.title} />
      <div
        className="account-support__workspace account-workspace-split"
        data-workspace-layout="7/5"
      >
        <div className="account-support__fields" data-workspace-region="focal">
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
          <div className="account-sensitive-action">
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
          </div>
        </div>
        <aside className="account-support__guidance" data-workspace-region="context">
          <CollectionDisclosure
            content={content}
            purpose={content.support.purpose}
            retention={content.support.retention}
            revocation={content.support.revocation}
            sharing={content.support.sharing}
          />
          <SensitiveFieldReview content={content} />
        </aside>
      </div>
    </article>
  );
};

export type AccountPreviewExperienceProps = Readonly<{
  locale: WebLocale;
  routeId: AccountPreviewRoute;
  scenarioId?: WebScenarioId;
  state?: AccountPreviewState;
}>;

export const AccountPreviewExperience = ({
  locale,
  routeId,
  scenarioId,
  state = 'ready',
}: AccountPreviewExperienceProps) => {
  const content = getAccountContent(locale);
  const activeScenarioId = resolveAccountScenarioId(routeId, scenarioId);
  const frame = (view: ReactNode) => (
    <div
      data-account-preview="deterministic"
      data-authority-connected="false"
      data-route-id={routeId}
      data-scenario-id={activeScenarioId}
    >
      {view}
    </div>
  );
  if (state === 'loading') return frame(<LoadingAccountPreview content={content} />);
  if (state === 'empty') return frame(<EmptyAccountPreview content={content} />);
  if (state !== 'ready') return frame(<DegradedAccountPreview content={content} state={state} />);
  if (activeScenarioId === 'W12') return frame(<DegradedAccountPreview content={content} />);
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
  return frame(view);
};

export const AccountPreviewPage = (props: AccountPreviewExperienceProps) => (
  <AccountPreviewExperience {...props} />
);
