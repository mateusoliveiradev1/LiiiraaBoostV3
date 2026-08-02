import { routeHref } from '@liiiraa/web-core';
import accountEnJson from '../content/account.en.json' with { type: 'json' };
import { resolveAccountScenarioId } from '../features/account-scenario';

type CaptureContent = Readonly<{
  locale: 'en';
  states: Readonly<Record<'expired' | 'failure' | 'offline' | 'stale', string>>;
  recovery: Readonly<{
    safeWork: string;
    signIn: string;
    support: string;
    title: string;
  }>;
}>;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const nonEmpty = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const admitCaptureContent = (candidate: unknown): CaptureContent => {
  if (
    !isRecord(candidate) ||
    candidate['locale'] !== 'en' ||
    !isRecord(candidate['states']) ||
    !nonEmpty(candidate['states']['expired']) ||
    !nonEmpty(candidate['states']['failure']) ||
    !nonEmpty(candidate['states']['offline']) ||
    !nonEmpty(candidate['states']['stale']) ||
    !isRecord(candidate['recovery']) ||
    !nonEmpty(candidate['recovery']['safeWork']) ||
    !nonEmpty(candidate['recovery']['signIn']) ||
    !nonEmpty(candidate['recovery']['support']) ||
    !nonEmpty(candidate['recovery']['title'])
  ) {
    throw new Error('W12_CAPTURE_CONTENT_INVALID');
  }
  return candidate as unknown as CaptureContent;
};

const escapeCaptureText = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const hrefFor = (routeId: 'account-sign-in' | 'account-support'): string => {
  const result = routeHref(routeId, { locale: 'en' });
  if (!result.ok) throw new Error(`W12_CAPTURE_ROUTE_UNAVAILABLE:${routeId}`);
  return escapeCaptureText(result.value);
};

const statusSignal = ({
  label,
  pattern,
  state,
  tone,
}: Readonly<{ label: string; pattern: string; state: string; tone: string }>): string =>
  `<span aria-live="${state === 'error' ? 'assertive' : 'polite'}" class="lb-web-status" data-pattern="${pattern}" data-state="${state}" data-tone="${tone}" role="${state === 'error' ? 'alert' : 'status'}"><span aria-hidden="true" class="lb-web-status-symbol">${state === 'error' ? '!' : '•'}</span><strong>${escapeCaptureText(label)}</strong></span>`;

export const createW12AccountCaptureProjection = () => {
  const locale = 'en' as const;
  const routeId = 'account-overview' as const;
  const scenarioId = resolveAccountScenarioId('account-overview', 'W12');
  const content = admitCaptureContent(accountEnJson);
  const degradedStates = [
    {
      copy: content.states.offline,
      label: 'Offline',
      pattern: 'long-dash',
      state: 'offline',
      tone: 'warning',
    },
    {
      copy: content.states.stale,
      label: 'Review required',
      pattern: 'dot-dash',
      state: 'stale',
      tone: 'warning',
    },
    {
      copy: content.states.expired,
      label: 'Session expired',
      pattern: 'dashed',
      state: 'warning',
      tone: 'warning',
    },
    {
      copy: content.states.failure,
      label: 'Retryable failure',
      pattern: 'double',
      state: 'error',
      tone: 'critical',
    },
  ] as const;
  const markup = `<div data-account-preview="deterministic" data-authority-connected="false" data-route-id="${routeId}" data-scenario-id="${scenarioId}"><article data-account-state="offline stale expired-session partial-failure"><header class="lb-web-route-header"><div><h1 tabindex="-1">${escapeCaptureText(content.recovery.title)}</h1><p>${escapeCaptureText(content.states.failure)}</p></div></header><aside class="lb-web-boundary" role="note"><strong>Preview boundary</strong><p>Account information cannot be refreshed right now. Retrying only checks availability; it does not submit an account change.</p>${statusSignal({ label: 'Deterministic preview', pattern: 'diagonal-stripe', state: 'preview', tone: 'experimental' })}</aside><ol class="lb-web-timeline">${degradedStates.map((state) => `<li>${statusSignal(state)}<p>${escapeCaptureText(state.copy)}</p></li>`).join('')}</ol><p role="status"><strong>${escapeCaptureText(content.recovery.safeWork)}:</strong> Display name, language, and support subject remain available; message details are cleared.</p><nav aria-label="Safe recovery"><a href="${hrefFor('account-sign-in')}">${escapeCaptureText(content.recovery.signIn)}</a> <a href="${hrefFor('account-support')}">${escapeCaptureText(content.recovery.support)}</a></nav></article></div>`;
  return Object.freeze({
    locale,
    markup,
    routeId,
    scenarioId,
  });
};
