import { type WebLocale, routeHref } from '@liiiraa/web-core';
import { PreviewBoundary, StatusSignal } from '@liiiraa/web-features/components';

import type { AccountPreviewRoute } from '../account-preview-model';

export type DegradedAccountState = 'offline' | 'stale' | 'expired-session' | 'failure';

export type DegradedAccountContent = Readonly<{
  locale: WebLocale;
  states: Readonly<Record<'offline' | 'stale' | 'expired' | 'failure', string>>;
  recovery: Readonly<{
    title: string;
    safeWork: string;
    signIn: string;
    support: string;
  }>;
}>;

const DEGRADED_ACCOUNT_STATES = Object.freeze([
  'offline',
  'stale',
  'expired-session',
  'failure',
] as const satisfies readonly DegradedAccountState[]);

const DEGRADED_ACCOUNT_STATE_LABELS = Object.freeze({
  offline: Object.freeze({ en: 'Offline', 'pt-BR': 'Sem conexão' }),
  stale: Object.freeze({ en: 'Review required', 'pt-BR': 'Revisão necessária' }),
  'expired-session': Object.freeze({ en: 'Session expired', 'pt-BR': 'Sessão expirada' }),
  failure: Object.freeze({ en: 'Retryable failure', 'pt-BR': 'Falha recuperável' }),
} satisfies Readonly<Record<DegradedAccountState, Readonly<Record<WebLocale, string>>>>);

const hrefFor = (routeId: AccountPreviewRoute, locale: WebLocale): string => {
  const result = routeHref(routeId, { locale });
  if (!result.ok) throw new Error(`ACCOUNT_ROUTE_UNAVAILABLE:${routeId}`);
  return result.value;
};

export const FixtureHeader = ({
  summary,
  title,
}: Readonly<{
  summary: string;
  title: string;
}>) => (
  <header className="lb-web-route-header">
    <div>
      <h1 tabIndex={-1}>{title}</h1>
      <p>{summary}</p>
    </div>
  </header>
);

const stateContentKey = (state: DegradedAccountState): keyof DegradedAccountContent['states'] =>
  state === 'expired-session' ? 'expired' : state;

const stateSignal = (state: DegradedAccountState): 'error' | 'offline' | 'stale' | 'warning' =>
  state === 'failure'
    ? 'error'
    : state === 'offline'
      ? 'offline'
      : state === 'stale'
        ? 'stale'
        : 'warning';

const DegradedAccountBody = ({
  content,
  states,
}: Readonly<{ content: DegradedAccountContent; states: readonly DegradedAccountState[] }>) => (
  <>
    <FixtureHeader summary={content.states.failure} title={content.recovery.title} />
    <PreviewBoundary
      description={
        content.locale === 'pt-BR'
          ? 'Os dados da conta não podem ser atualizados agora. Tentar novamente apenas verifica a disponibilidade; nenhuma alteração é enviada.'
          : 'Account information cannot be refreshed right now. Retrying only checks availability; it does not submit an account change.'
      }
    />
    <ol className="lb-web-timeline">
      {states.map((state) => (
        <li key={state}>
          <StatusSignal
            label={DEGRADED_ACCOUNT_STATE_LABELS[state][content.locale]}
            state={stateSignal(state)}
          />
          <p>{content.states[stateContentKey(state)]}</p>
        </li>
      ))}
    </ol>
    <p role="status">
      <strong>{content.recovery.safeWork}:</strong>{' '}
      {content.locale === 'pt-BR'
        ? 'Nome de exibição, idioma e assunto do suporte permanecem disponíveis; os detalhes da mensagem são apagados.'
        : 'Display name, language, and support subject remain available; message details are cleared.'}
    </p>
    <nav aria-label={content.locale === 'pt-BR' ? 'Recuperação segura' : 'Safe recovery'}>
      <a href={hrefFor('account-sign-in', content.locale)}>{content.recovery.signIn}</a>{' '}
      <a href={hrefFor('account-support', content.locale)}>{content.recovery.support}</a>
    </nav>
  </>
);

export const DegradedAccountPreview = ({
  content,
  state,
}: Readonly<{ content: DegradedAccountContent; state?: DegradedAccountState }>) => {
  if (state === undefined) {
    return (
      <article data-account-state="offline stale expired-session partial-failure">
        <DegradedAccountBody content={content} states={DEGRADED_ACCOUNT_STATES} />
      </article>
    );
  }
  return (
    <article data-account-state={state === 'failure' ? 'partial-failure' : state}>
      <DegradedAccountBody content={content} states={[state]} />
    </article>
  );
};
