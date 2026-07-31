'use client';

import { LbButton, LbTextField } from '@liiiraa/design-system';
import {
  EmptyComposition,
  PreviewBoundary,
  PreviewWorkflow,
  ProvenanceLabel,
  ResponsiveDataTable,
  StatusSignal,
  createPreviewWorkflowMachine,
  type PreviewActionFamily,
  type PreviewWorkflowInput,
} from '@liiiraa/web-features';
import { routeHref, type WebLocale, type WebRouteId } from '@liiiraa/web-core';
import { createWebPreviewAuthority, getWebScenario, type WebScenarioId } from '@liiiraa/web-preview';
import { useMemo, useState, type FormEvent, type ReactNode } from 'react';

import accountEnJson from '../content/account.en.json';
import accountPtBrJson from '../content/account.pt-BR.json';

export const ACCOUNT_ENTRY_ROUTE_IDS = Object.freeze([
  'account-sign-in',
  'account-overview',
  'account-profile',
  'account-security',
] as const satisfies readonly WebRouteId[]);

export type AccountPreviewRoute = (typeof ACCOUNT_ENTRY_ROUTE_IDS)[number];
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

export const isAccountPreviewRoute = (routeId: WebRouteId): routeId is AccountPreviewRoute =>
  ACCOUNT_ENTRY_ROUTE_IDS.includes(routeId as AccountPreviewRoute);

const hrefFor = (routeId: WebRouteId, locale: WebLocale): string => {
  const result = routeHref(routeId, { locale });
  if (!result.ok) throw new Error(`ACCOUNT_ROUTE_UNAVAILABLE:${routeId}`);
  return result.value;
};

const titleFor = (content: AccountContent, routeId: AccountPreviewRoute) => {
  switch (routeId) {
    case 'account-sign-in':
      return { title: content.signIn.title, summary: content.signIn.summary };
    case 'account-overview':
      return { title: content.overview.title, summary: content.overview.summary };
    case 'account-profile':
      return { title: content.profile.title, summary: content.profile.summary };
    case 'account-security':
      return { title: content.security.title, summary: content.security.summary };
  }
};

export const getAccountPreviewMetadata = (locale: WebLocale, routeId: AccountPreviewRoute) =>
  titleFor(getAccountContent(locale), routeId);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export const validatePreviewEmail = (value: string): boolean =>
  value.length <= 254 && EMAIL_PATTERN.test(value);

const actionInput = ({
  family,
  fields,
  label,
  review,
  safeDraftFields = [],
}: Readonly<{
  family: PreviewActionFamily;
  fields: Readonly<Record<string, string>>;
  label: string;
  review: readonly Readonly<{ field: string; label: string; before: string; after: string }>[];
  safeDraftFields?: readonly string[];
}>): PreviewWorkflowInput => ({
  action: { family, id: `${family}.review`, objectLabel: label, surface: 'account' },
  fields,
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

const FixtureHeader = ({ content, summary, title }: Readonly<{
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
    <FixtureHeader content={content} summary={content.states.failure} title={content.recovery.title} />
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
        review: [{ field: 'email', label: content.signIn.emailLabel, before: 'Not reviewed', after: email }],
      }),
    );
  };

  if (workflow !== null) {
    return <PreviewWorkflowRunner input={workflow} locale={content.locale} scenarioId={scenarioId} />;
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
      <FixtureHeader content={content} summary={content.signIn.summary} title={content.signIn.title} />
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
      <div aria-label={content.locale === 'pt-BR' ? 'Outras opções futuras' : 'Other future choices'} role="group">
        <LbButton
          onPress={() => startChoice('social', 'social-provider-preview', content.signIn.socialAction)}
          variant="secondary"
        >
          {content.signIn.socialAction}
        </LbButton>
        <LbButton
          onPress={() => startChoice('passkey', 'windows-hello-preview', content.signIn.passkeyAction)}
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
    <FixtureHeader content={content} summary={content.overview.summary} title={content.overview.title} />
    <ResponsiveDataTable
      caption={content.locale === 'pt-BR' ? 'Responsabilidades da conta' : 'Account responsibilities'}
      columns={[
        { id: 'responsibility', label: content.locale === 'pt-BR' ? 'Responsabilidade' : 'Responsibility' },
        { id: 'state', label: content.locale === 'pt-BR' ? 'Estado' : 'State' },
        { id: 'action', label: content.locale === 'pt-BR' ? 'Ação' : 'Action', essential: false },
      ]}
      rows={ACCOUNT_ENTRY_ROUTE_IDS.filter((id) => id !== 'account-sign-in').map((routeId) => {
        const metadata = titleFor(content, routeId);
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
    <EmptyComposition description={content.overview.emptyBody} title={content.overview.emptyTitle} />
  </article>
);

const ProfilePreview = ({
  content,
  scenarioId,
}: Readonly<{ content: AccountContent; scenarioId: WebScenarioId }>) => {
  const [displayName, setDisplayName] = useState('Astra Preview');
  const [workflow, setWorkflow] = useState<PreviewWorkflowInput | null>(null);
  if (workflow !== null) {
    return <PreviewWorkflowRunner input={workflow} locale={content.locale} scenarioId={scenarioId} />;
  }
  return (
    <article data-account-state="ready">
      <FixtureHeader content={content} summary={content.profile.summary} title={content.profile.title} />
      <LbTextField
        description={content.fixtureLabel}
        isRequired
        label={content.profile.nameLabel}
        maxLength={80}
        onChange={setDisplayName}
        value={displayName}
      />
      <dl>
        <div><dt>{content.profile.localeLabel}</dt><dd>{content.locale}</dd></div>
      </dl>
      <LbButton
        onPress={() => {
          setWorkflow(
            actionInput({
              family: 'auth',
              fields: { displayName, locale: content.locale },
              label: content.profile.action,
              review: [
                { field: 'displayName', label: content.profile.nameLabel, before: 'Astra Preview', after: displayName },
                { field: 'locale', label: content.profile.localeLabel, before: content.locale, after: content.locale },
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
          <LbButton onPress={() => onReview(family)} variant="quiet">{content.security.review}</LbButton>
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
    <ul><li><span>{content.security.sessionDetail}</span>{' '}<LbButton onPress={onReview} variant="quiet">{content.security.review}</LbButton></li></ul>
  </section>
);

const SecurityPreview = ({
  content,
  scenarioId,
}: Readonly<{ content: AccountContent; scenarioId: WebScenarioId }>) => {
  const [workflow, setWorkflow] = useState<PreviewWorkflowInput | null>(null);
  const reviewSecurity = (family: 'passkey' | 'mfa' | 'session') => {
    const label = family === 'passkey' ? content.security.passkey : family === 'mfa' ? content.security.mfa : content.security.sessions;
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
    return <PreviewWorkflowRunner input={workflow} locale={content.locale} scenarioId={scenarioId} />;
  }
  return (
    <article data-account-state="ready">
      <FixtureHeader content={content} summary={content.security.summary} title={content.security.title} />
      <PreviewBoundary description={content.signIn.security} />
      <SecurityMethodList content={content} onReview={reviewSecurity} />
      <SessionList content={content} onReview={() => reviewSecurity('session')} />
      <section aria-labelledby="recovery-title" className="lb-web-recovery-review">
        <h2 id="recovery-title">{content.security.recovery}</h2><p>{content.security.recoveryDetail}</p>
      </section>
      <EmptyComposition description={content.security.emptyAlerts} title={content.security.alerts} />
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
  const activeScenarioId = scenarioId ?? (routeId === 'account-sign-in' ? 'W10' : 'W11');
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
