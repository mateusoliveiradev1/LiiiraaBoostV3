'use client';

import {
  LbButton,
  LbCheckbox,
  LbSkeletonRegion,
  LbTextArea,
  LbTextField,
  ProductIcon,
  type ProductIconName,
} from '@liiiraa/design-system';
import {
  EmptyComposition,
  PreviewReceipt,
  PreviewWorkflow,
  ResponsiveDataTable,
  StatusSignal,
  createPreviewWorkflowMachine,
  type PreviewActionFamily,
  type PreviewWorkflowOutput,
  type PreviewWorkflowInput,
} from '@liiiraa/web-features';
import {
  createDesktopAnalyzeLink,
  routeHref,
  WEB_ORIGINS,
  type WebLocale,
  type WebRouteId,
} from '@liiiraa/web-core';
import {
  createWebPreviewAuthority,
  getWebScenario,
  type WebScenarioId,
} from '@liiiraa/web-preview';
import { useMemo, useState, type FormEvent, type ReactNode } from 'react';

import accountEnJson from '../content/account.en.json';
import accountPtBrJson from '../content/account.pt-BR.json';
import {
  getAccountHomeScenario,
  type AccountPreviewRoute,
} from '../account-preview-model';
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
  signUp: Readonly<{
    title: string;
    summary: string;
    nameLabel: string;
    nameHint: string;
    emailLabel: string;
    emailHint: string;
    passwordLabel: string;
    passwordHint: string;
    confirmLabel: string;
    consentLabel: string;
    action: string;
    entryPrompt: string;
    entryAction: string;
    signInPrompt: string;
    signInAction: string;
    security: string;
    invalidName: string;
    invalidEmail: string;
    invalidPassword: string;
    invalidConfirmation: string;
    invalidConsent: string;
  }>;
  onboarding: Readonly<{
    title: string;
    summary: string;
    progressLabel: string;
    nextAction: string;
    backAction: string;
    completeAction: string;
    identityTitle: string;
    identityBody: string;
    verifyTitle: string;
    verifyBody: string;
    planTitle: string;
    planBody: string;
    essentialPlan: string;
    essentialDetail: string;
    premiumPlan: string;
    premiumDetail: string;
    paymentTitle: string;
    premiumPayment: string;
    essentialPayment: string;
    downloadTitle: string;
    downloadBody: string;
    activateTitle: string;
    activateBody: string;
    manageTitle: string;
    manageBody: string;
    browserBoundary: string;
    localPrivacy: string;
    openAppAction: string;
    downloadAction: string;
    installedPrompt: string;
    notInstalledPrompt: string;
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
    planTitle: string;
    planValue: string;
    billingValue: string;
    pcTitle: string;
    pcValue: string;
    securityTitle: string;
    passkeyValue: string;
    mfaValue: string;
    recommendedTitle: string;
    recommendedBody: string;
    recommendedAction: string;
    continuityTitle: string;
    continuityBody: string;
    degradedTitle: string;
    degradedBody: string;
    recoveryAction: string;
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
    essentialPlan: string;
    premiumBenefits: string;
    price: string;
    billingPeriod: string;
    renewal: string;
    taxes: string;
    cancellation: string;
    refunds: string;
    deviceRules: string;
    expirationEffects: string;
    paymentMethods: string;
    action: string;
  }>;
  invoices: Readonly<{
    title: string;
    summary: string;
    caption: string;
    empty: string;
    paymentMethods: string;
    billingHelp: string;
  }>;
  device: Readonly<{
    title: string;
    summary: string;
    label: string;
    detail: string;
    cooldown: string;
    motherboard: string;
    supportException: string;
    offlineGrace: string;
    permanentAccess: string;
    action: string;
  }>;
  downloads: Readonly<{
    title: string;
    summary: string;
    boundary: string;
    stableChannel: string;
    betaChannel: string;
    updates: string;
    action: string;
  }>;
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
    telemetryAction: string;
    telemetry: string;
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
    standardResponse: string;
    premiumResponse: string;
    exceptionPath: string;
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
    !isRecord(candidate['signUp']) ||
    !isRecord(candidate['onboarding']) ||
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

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,128}$/u;

export const validatePreviewPassword = (value: string): boolean => PASSWORD_PATTERN.test(value);

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
            inputType="email"
            label={content.signIn.emailLabel}
            maxLength={254}
            onChange={setEmail}
            value={email}
          />
        </div>
        <LbButton type="submit">{content.signIn.emailAction}</LbButton>
      </form>
      <div className="account-auth-divider" role="separator">
        <span>{content.locale === 'pt-BR' ? 'ou escolha outra opção' : 'or choose another option'}</span>
      </div>
      <div
        aria-label={content.locale === 'pt-BR' ? 'Outras opções de acesso' : 'Other access options'}
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
      <p className="account-auth-switch">
        <span>{content.signUp.entryPrompt}</span>{' '}
        <a href={hrefFor('account-sign-up', content.locale)}>{content.signUp.entryAction}</a>
      </p>
      <p className="account-auth-security" role="note">
        <ProductIcon name="lock" size={16} />
        <span>{content.signIn.security}</span>
      </p>
    </article>
  );
};

type SignUpField = 'confirmation' | 'consent' | 'email' | 'name' | 'password';

export const SignUpPreview = ({
  content,
  scenarioId,
}: Readonly<{ content: AccountContent; scenarioId: WebScenarioId }>) => {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<SignUpField, string>>>({});
  const [workflow, setWorkflow] = useState<PreviewWorkflowInput | null>(null);

  if (workflow !== null) {
    return (
      <PreviewWorkflowRunner input={workflow} locale={content.locale} scenarioId={scenarioId} />
    );
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: Partial<Record<SignUpField, string>> = {};
    if (displayName.trim().length < 2) nextErrors.name = content.signUp.invalidName;
    if (!validatePreviewEmail(email)) nextErrors.email = content.signUp.invalidEmail;
    if (!validatePreviewPassword(password)) nextErrors.password = content.signUp.invalidPassword;
    if (password !== confirmation) nextErrors.confirmation = content.signUp.invalidConfirmation;
    if (!consent) nextErrors.consent = content.signUp.invalidConsent;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setWorkflow(
      actionInput({
        family: 'auth',
        fields: { displayName: displayName.trim(), email },
        label: content.signUp.action,
        purpose: content.signUp.security,
        review: [
          {
            field: 'displayName',
            label: content.signUp.nameLabel,
            before: 'Not provided',
            after: displayName.trim(),
          },
          {
            field: 'email',
            label: content.signUp.emailLabel,
            before: 'Not provided',
            after: email,
          },
        ],
      }),
    );
  };

  const errorMessages = Object.values(errors);
  return (
    <article className="lb-web-sign-up" data-account-state="sign-up-preview">
      <FixtureHeader summary={content.signUp.summary} title={content.signUp.title} />
      <form noValidate onSubmit={submit}>
        {errorMessages.length > 0 ? (
          <div className="account-auth-errors" role="alert" tabIndex={-1}>
            <strong>
              {content.locale === 'pt-BR'
                ? 'Revise os dados para continuar'
                : 'Review your details to continue'}
            </strong>
            <ul>
              {errorMessages.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <LbTextField
          description={content.signUp.nameHint}
          errorMessage={errors.name}
          isInvalid={errors.name !== undefined}
          isRequired
          label={content.signUp.nameLabel}
          maxLength={80}
          onChange={setDisplayName}
          value={displayName}
        />
        <LbTextField
          description={content.signUp.emailHint}
          errorMessage={errors.email}
          inputType="email"
          isInvalid={errors.email !== undefined}
          isRequired
          label={content.signUp.emailLabel}
          maxLength={254}
          onChange={setEmail}
          value={email}
        />
        <div className="account-auth-passwords">
          <LbTextField
            description={content.signUp.passwordHint}
            errorMessage={errors.password}
            inputType="password"
            isInvalid={errors.password !== undefined}
            isRequired
            label={content.signUp.passwordLabel}
            maxLength={128}
            onChange={setPassword}
            value={password}
          />
          <LbTextField
            errorMessage={errors.confirmation}
            inputType="password"
            isInvalid={errors.confirmation !== undefined}
            isRequired
            label={content.signUp.confirmLabel}
            maxLength={128}
            onChange={setConfirmation}
            value={confirmation}
          />
        </div>
        <div className="account-auth-consent">
          <LbCheckbox isSelected={consent} onChange={setConsent} value="terms">
            {content.signUp.consentLabel}
          </LbCheckbox>
          {errors.consent === undefined ? null : <p role="status">{errors.consent}</p>}
        </div>
        <LbButton type="submit">{content.signUp.action}</LbButton>
      </form>
      <p className="account-auth-switch">
        <span>{content.signUp.signInPrompt}</span>{' '}
        <a href={hrefFor('account-sign-in', content.locale)}>{content.signUp.signInAction}</a>
      </p>
      <p className="account-auth-security" role="note">
        <ProductIcon name="lock" size={16} />
        <span>{content.signUp.security}</span>
      </p>
    </article>
  );
};

type OnboardingPlan = 'essential' | 'premium';

export const OnboardingPreview = ({ content }: Readonly<{ content: AccountContent }>) => {
  const [activeStep, setActiveStep] = useState(0);
  const [plan, setPlan] = useState<OnboardingPlan>('essential');
  const publicDownload = routeHref('public-download', { locale: content.locale });
  if (!publicDownload.ok) throw new Error('ACCOUNT_PUBLIC_DOWNLOAD_ROUTE_UNAVAILABLE');

  const steps: readonly Readonly<{
    body: string;
    icon: ProductIconName;
    title: string;
  }>[] = [
    {
      body: content.onboarding.identityBody,
      icon: 'profile',
      title: content.onboarding.identityTitle,
    },
    {
      body: content.onboarding.verifyBody,
      icon: 'shield',
      title: content.onboarding.verifyTitle,
    },
    {
      body: content.onboarding.planBody,
      icon: 'crown',
      title: content.onboarding.planTitle,
    },
    {
      body:
        plan === 'premium'
          ? content.onboarding.premiumPayment
          : content.onboarding.essentialPayment,
      icon: 'receipt',
      title: content.onboarding.paymentTitle,
    },
    {
      body: content.onboarding.downloadBody,
      icon: 'download',
      title: content.onboarding.downloadTitle,
    },
    {
      body: content.onboarding.activateBody,
      icon: 'device',
      title: content.onboarding.activateTitle,
    },
    {
      body: content.onboarding.manageBody,
      icon: 'gauge',
      title: content.onboarding.manageTitle,
    },
  ];
  const step = steps[activeStep] ?? steps[0];
  if (step === undefined) throw new Error('ACCOUNT_ONBOARDING_STEP_UNAVAILABLE');
  const isFirst = activeStep === 0;
  const isLast = activeStep === steps.length - 1;

  return (
    <article
      className="account-onboarding"
      data-account-state="onboarding"
      data-authority-connected="false"
      data-session-created="false"
    >
      <FixtureHeader summary={content.onboarding.summary} title={content.onboarding.title} />

      <div className="account-onboarding__workspace">
        <nav aria-label={content.onboarding.progressLabel} className="account-onboarding__steps">
          <ol>
            {steps.map((item, index) => (
              <li key={item.title}>
                <button
                  aria-current={index === activeStep ? 'step' : undefined}
                  data-complete={index < activeStep || undefined}
                  onClick={() => setActiveStep(index)}
                  type="button"
                >
                  <span className="account-onboarding__step-index">
                    {index < activeStep ? (
                      <ProductIcon name="check" size={17} />
                    ) : (
                      String(index + 1).padStart(2, '0')
                    )}
                  </span>
                  <span>{item.title}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <section
          aria-labelledby="account-onboarding-step-title"
          className="account-onboarding__focus"
        >
          <div className="account-onboarding__step-heading">
            <ProductIcon name={step.icon} size={24} />
            <div>
              <span>
                {content.onboarding.progressLabel} {activeStep + 1}/{steps.length}
              </span>
              <h2 id="account-onboarding-step-title">{step.title}</h2>
            </div>
          </div>
          <p className="account-onboarding__body">{step.body}</p>

          {activeStep === 0 ? (
            <nav
              aria-label={content.onboarding.identityTitle}
              className="account-onboarding__inline-actions"
            >
              <a data-action="primary" href={hrefFor('account-sign-in', content.locale)}>
                {content.signUp.signInAction}
              </a>
              <a href={hrefFor('account-sign-up', content.locale)}>{content.signUp.entryAction}</a>
            </nav>
          ) : null}

          {activeStep === 1 ? (
            <ul className="account-onboarding__security-list">
              <li>
                <ProductIcon name="check" size={18} /> {content.security.verifiedEmail}
              </li>
              <li>
                <ProductIcon name="key" size={18} /> {content.security.passkey}
              </li>
              <li>
                <ProductIcon name="shield" size={18} /> {content.security.mfa}
              </li>
            </ul>
          ) : null}

          {activeStep === 2 ? (
            <div aria-label={content.onboarding.planTitle} className="account-onboarding__plans">
              <button
                aria-pressed={plan === 'essential'}
                onClick={() => setPlan('essential')}
                type="button"
              >
                <span>
                  <strong>{content.onboarding.essentialPlan}</strong>
                  <ProductIcon name="check" size={18} />
                </span>
                <span>{content.onboarding.essentialDetail}</span>
              </button>
              <button
                aria-pressed={plan === 'premium'}
                onClick={() => setPlan('premium')}
                type="button"
              >
                <span>
                  <strong>{content.onboarding.premiumPlan}</strong>
                  <ProductIcon name="crown" size={18} />
                </span>
                <span>{content.onboarding.premiumDetail}</span>
              </button>
            </div>
          ) : null}

          {activeStep === 3 ? (
            <div
              className="account-onboarding__payment"
              data-payment-review={plan === 'premium' ? 'required' : 'not-required'}
              role="note"
            >
              <ProductIcon name={plan === 'premium' ? 'receipt' : 'check'} size={20} />
              <span>
                <strong>
                  {plan === 'premium'
                    ? content.onboarding.premiumPlan
                    : content.onboarding.essentialPlan}
                </strong>
                {plan === 'premium'
                  ? content.onboarding.premiumPayment
                  : content.onboarding.essentialPayment}
              </span>
            </div>
          ) : null}

          {activeStep === 4 || activeStep === 5 ? (
            <div className="account-onboarding__desktop-handoff">
              <div role="note">
                <ProductIcon name="lock" size={20} />
                <span>
                  <strong>{content.onboarding.browserBoundary}</strong>
                  {content.onboarding.localPrivacy}
                </span>
              </div>
              <div className="account-onboarding__handoff-actions">
                <span>{content.onboarding.installedPrompt}</span>
                <a data-action="primary" href={createDesktopAnalyzeLink()}>
                  <ProductIcon name="windows" size={18} />
                  {content.onboarding.openAppAction}
                </a>
                <span>{content.onboarding.notInstalledPrompt}</span>
                <a
                  href={`${WEB_ORIGINS['public-origin']}${publicDownload.value}`}
                  rel="noreferrer"
                >
                  <ProductIcon name="download" size={18} />
                  {content.onboarding.downloadAction}
                </a>
              </div>
            </div>
          ) : null}

          {isLast ? (
            <nav
              aria-label={content.onboarding.manageTitle}
              className="account-onboarding__manage-links"
            >
              <a data-action="primary" href={hrefFor('account-overview', content.locale)}>
                {content.onboarding.completeAction}
              </a>
              <a href={hrefFor('account-device', content.locale)}>{content.device.title}</a>
              <a href={hrefFor('account-support', content.locale)}>{content.support.title}</a>
            </nav>
          ) : null}

          <div className="account-onboarding__controls">
            <LbButton
              isDisabled={isFirst}
              onPress={() => setActiveStep((current) => Math.max(0, current - 1))}
              variant="quiet"
            >
              {content.onboarding.backAction}
            </LbButton>
            {isLast ? null : (
              <LbButton
                onPress={() =>
                  setActiveStep((current) => Math.min(steps.length - 1, current + 1))
                }
                variant="primary"
              >
                {content.onboarding.nextAction}
              </LbButton>
            )}
          </div>
        </section>
      </div>
      <p className="account-onboarding__truth" role="status">
        <ProductIcon name="info" size={17} />
        {content.locale === 'pt-BR'
          ? 'Este guia não cria conta, sessão, cobrança ou vínculo de dispositivo.'
          : 'This guide does not create an account, session, charge, or device binding.'}
      </p>
    </article>
  );
};

const OverviewPreview = ({ content }: Readonly<{ content: AccountContent }>) => {
  const scenario = getAccountHomeScenario('premium-active');
  return (
    <article
      className="account-responsibility account-overview"
      data-account-scenario={scenario.id}
      data-account-state="ready"
    >
      <FixtureHeader summary={content.overview.summary} title={content.overview.title} />

      <section
        aria-labelledby="account-recommendation-title"
        className="account-overview__command"
        data-account-home-region="primary"
      >
        <div className="account-overview__recommendation">
          <ProductIcon name="shield" size={24} />
          <div>
            <h2 id="account-recommendation-title">{content.overview.recommendedTitle}</h2>
            <p>{content.overview.recommendedBody}</p>
          </div>
          <a
            data-recommended-action={scenario.recommendedAction.kind}
            href={hrefFor(scenario.recommendedAction.routeId, content.locale)}
          >
            {content.overview.recommendedAction}
            <ProductIcon name="arrowRight" size={16} />
          </a>
        </div>
        <dl className="account-overview__facts">
          <div data-account-home-fact="plan">
            <dt>{content.overview.planTitle}</dt>
            <dd>
              <strong>{content.overview.planValue}</strong>
              <span>{content.overview.billingValue}</span>
            </dd>
          </div>
          <div data-account-home-fact="pc">
            <dt>{content.overview.pcTitle}</dt>
            <dd>
              <strong>{scenario.pc.label}</strong>
              <span>{content.overview.pcValue}</span>
            </dd>
          </div>
          <div data-account-home-fact="security">
            <dt>{content.overview.securityTitle}</dt>
            <dd>
              <strong>{content.overview.mfaValue}</strong>
              <span>{content.overview.passkeyValue}</span>
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="account-continuity-title" className="account-overview__continuity">
        <ProductIcon name="history" size={20} />
        <div>
          <h2 id="account-continuity-title">{content.overview.continuityTitle}</h2>
          <p>{content.overview.continuityBody}</p>
        </div>
      </section>
    </article>
  );
};

const DegradedOverviewPreview = ({ content }: Readonly<{ content: AccountContent }>) => {
  const lastTrustworthyScenario = getAccountHomeScenario('premium-active');
  return (
    <article
      className="account-responsibility account-overview account-overview--degraded"
      data-account-home-state="degraded"
    >
      <FixtureHeader summary={content.overview.degradedBody} title={content.overview.degradedTitle} />
      <dl className="account-overview__facts" aria-label={content.overview.summary}>
        <div>
          <dt>{content.overview.planTitle}</dt>
          <dd>{content.overview.planValue}</dd>
        </div>
        <div>
          <dt>{content.overview.pcTitle}</dt>
          <dd>{lastTrustworthyScenario.pc.label}</dd>
        </div>
        <div>
          <dt>{content.overview.securityTitle}</dt>
          <dd>{content.overview.mfaValue}</dd>
        </div>
      </dl>
      <a
        className="account-overview__recovery"
        data-overview-recovery-action
        href={hrefFor('account-support', content.locale)}
      >
        {content.overview.recoveryAction}
        <ProductIcon name="arrowRight" size={16} />
      </a>
    </article>
  );
};

const ProfilePreview = ({
  content,
  scenarioId,
}: Readonly<{ content: AccountContent; scenarioId: WebScenarioId }>) => {
  const [displayName, setDisplayName] = useState('Astra Player');
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
                        before: 'Astra Player',
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
          <StatusSignal
            label={
              family === 'passkey'
                ? content.locale === 'pt-BR'
                  ? 'Nenhuma cadastrada'
                  : 'None added'
                : content.locale === 'pt-BR'
                  ? 'Não configurado'
                  : 'Not configured'
            }
            state="preview"
          />{' '}
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
  const reviewSecurity = (family: 'passkey' | 'mfa' | 'recovery' | 'session') => {
    const label =
      family === 'passkey'
        ? content.security.passkey
        : family === 'mfa'
          ? content.security.mfa
          : family === 'recovery'
            ? content.security.recovery
            : content.security.sessions;
    setWorkflow(
      actionInput({
        family: family === 'recovery' ? 'auth' : family,
        fields: { target: `${family}-method` },
        label,
        review: [
          {
            field: 'target',
            label,
            before: content.locale === 'pt-BR' ? 'Nenhuma configuração ativa' : 'No active setup',
            after:
              content.locale === 'pt-BR' ? 'Pronto para confirmação' : 'Ready for confirmation',
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
            label={content.locale === 'pt-BR' ? 'Configuração disponível' : 'Setup available'}
            state="preview"
          />
          <LbButton onPress={() => reviewSecurity('recovery')} variant="quiet">
            {content.security.review}
          </LbButton>
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
    [content.locale === 'pt-BR' ? 'Plano Essential' : 'Essential plan', content.subscription.essentialPlan],
    [content.locale === 'pt-BR' ? 'Benefícios Premium' : 'Premium benefits', content.subscription.premiumBenefits],
    [content.locale === 'pt-BR' ? 'Preço' : 'Price', content.subscription.price],
    [
      content.locale === 'pt-BR' ? 'Período de cobrança' : 'Billing period',
      content.subscription.billingPeriod,
    ],
    [content.locale === 'pt-BR' ? 'Renovação' : 'Renewal', content.subscription.renewal],
    [content.locale === 'pt-BR' ? 'Tributos' : 'Taxes', content.subscription.taxes],
    [content.locale === 'pt-BR' ? 'Formas de pagamento' : 'Payment methods', content.subscription.paymentMethods],
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
            {terms.slice(0, 7).map(([label, value]) => (
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
                        before: 'Essential',
                        after:
                          content.locale === 'pt-BR'
                            ? 'Premium selecionado para confirmação'
                            : 'Premium selected for confirmation',
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
          <a className="account-context-link" href={hrefFor('account-invoices', content.locale)}>
            {content.locale === 'pt-BR' ? 'Ver pagamentos e faturas' : 'View payments and invoices'}
            <ProductIcon name="chevronRight" size={16} />
          </a>
          <dl className="account-definition-list">
            {terms.slice(7).map(([label, value]) => (
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
        <dl className="account-definition-list">
          <div>
            <dt>{content.locale === 'pt-BR' ? 'Formas de pagamento' : 'Payment methods'}</dt>
            <dd>{content.invoices.paymentMethods}</dd>
          </div>
          <div>
            <dt>{content.locale === 'pt-BR' ? 'Precisa de ajuda?' : 'Need help?'}</dt>
            <dd>{content.invoices.billingHelp}</dd>
          </div>
        </dl>
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
                    fields: { device: 'protected-device-01' },
                    impact: content.device.cooldown,
                    label: content.device.action,
                    review: [
                      {
                        field: 'device',
                        label: content.device.label,
                        before:
                          content.locale === 'pt-BR'
                            ? 'PC atual permanece ativo'
                            : 'Current PC remains active',
                        after:
                          content.locale === 'pt-BR'
                            ? 'Transferência preparada para confirmação'
                            : 'Transfer prepared for confirmation',
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
        <aside className="account-device__rules" data-workspace-region="context">
          <h2>{content.locale === 'pt-BR' ? 'Regras da licença' : 'License rules'}</h2>
          <a className="account-context-link" href={hrefFor('account-downloads', content.locale)}>
            {content.locale === 'pt-BR' ? 'Downloads e versões' : 'Downloads and releases'}
            <ProductIcon name="chevronRight" size={16} />
          </a>
          <dl className="account-definition-list">
            <div>
              <dt>{content.locale === 'pt-BR' ? 'Mudança de hardware' : 'Hardware change'}</dt>
              <dd>{content.device.motherboard}</dd>
            </div>
            <div>
              <dt>{content.locale === 'pt-BR' ? 'Exceção pelo suporte' : 'Support exception'}</dt>
              <dd>{content.device.supportException}</dd>
            </div>
            <div>
              <dt>{content.locale === 'pt-BR' ? 'Uso offline' : 'Offline use'}</dt>
              <dd>{content.device.offlineGrace}</dd>
            </div>
            <div>
              <dt>{content.locale === 'pt-BR' ? 'Acesso permanente' : 'Permanent access'}</dt>
              <dd>{content.device.permanentAccess}</dd>
            </div>
          </dl>
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
          <p>{content.downloads.stableChannel}</p>
          <a href={`${WEB_ORIGINS['public-origin']}${releaseHref.value}`}>
            {content.downloads.action}
          </a>
        </section>
        <aside data-workspace-region="context">
          <h2>{content.locale === 'pt-BR' ? 'Canais e atualizações' : 'Channels and updates'}</h2>
          <p>{content.downloads.betaChannel}</p>
          <p>{content.downloads.updates}</p>
          <p>{content.downloads.boundary}</p>
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
  onSelect: (request: 'consent' | 'correction' | 'deletion' | 'export' | 'telemetry') => void;
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
      <LbButton onPress={() => onSelect('telemetry')} variant="secondary">
        {content.privacy.telemetryAction}
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
  const selectRequest = (
    request: 'consent' | 'correction' | 'deletion' | 'export' | 'telemetry',
  ) => {
    const family = request === 'consent' || request === 'telemetry' ? 'consent' : 'privacy';
    const labels = {
      consent: content.privacy.consentAction,
      correction: content.privacy.correctionAction,
      deletion: content.privacy.deletionAction,
      export: content.privacy.exportAction,
      telemetry: content.privacy.telemetryAction,
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
            before:
              content.locale === 'pt-BR' ? 'Nenhuma solicitação iniciada' : 'No request started',
            after:
              content.locale === 'pt-BR'
                ? 'Solicitação preparada para confirmação'
                : 'Request prepared for confirmation',
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
          <p className="account-privacy__telemetry" role="note">
            {content.privacy.telemetry}
          </p>
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
  const [subject, setSubject] = useState(
    content.locale === 'pt-BR' ? 'Ajuda com o primeiro acesso' : 'Help with first access',
  );
  const [description, setDescription] = useState(
    content.locale === 'pt-BR'
      ? 'Preciso de ajuda para concluir a ativação do meu primeiro PC.'
      : 'I need help completing activation for my first PC.',
  );
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
                        before:
                          content.locale === 'pt-BR' ? 'Nenhuma solicitação iniciada' : 'No request started',
                        after: subject,
                      },
                      {
                        field: 'description',
                        label: content.support.bodyLabel,
                        before:
                          content.locale === 'pt-BR' ? 'Nenhuma solicitação iniciada' : 'No request started',
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
          <section className="account-support__service-level" aria-labelledby="support-service-title">
            <h2 id="support-service-title">
              {content.locale === 'pt-BR' ? 'Prazo de atendimento' : 'Response time'}
            </h2>
            <p>{content.support.standardResponse}</p>
            <p>{content.support.premiumResponse}</p>
            <p>{content.support.exceptionPath}</p>
          </section>
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
  if (state !== 'ready') {
    return frame(
      routeId === 'account-overview' ? (
        <DegradedOverviewPreview content={content} />
      ) : (
        <DegradedAccountPreview content={content} state={state} />
      ),
    );
  }
  if (activeScenarioId === 'W12') {
    return frame(
      routeId === 'account-overview' ? (
        <DegradedOverviewPreview content={content} />
      ) : (
        <DegradedAccountPreview content={content} />
      ),
    );
  }
  let view: ReactNode;
  switch (routeId) {
    case 'account-sign-in':
      view = <SignInPreview content={content} scenarioId={activeScenarioId} />;
      break;
    case 'account-sign-up':
      view = <SignUpPreview content={content} scenarioId={activeScenarioId} />;
      break;
    case 'account-onboarding':
      view = <OnboardingPreview content={content} />;
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
