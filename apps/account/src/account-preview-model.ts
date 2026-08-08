import type { WebLocale, WebRouteId } from '@liiiraa/web-core';

import accountEn from './content/account.en.json';
import accountPtBr from './content/account.pt-BR.json';
import type { AccountFailureKind } from './account-errors';

export const ACCOUNT_ENTRY_ROUTE_IDS = Object.freeze([
  'account-sign-in',
  'account-sign-up',
  'account-onboarding',
  'account-overview',
  'account-profile',
  'account-security',
  'account-subscription',
  'account-invoices',
  'account-device',
  'account-downloads',
  'account-privacy',
  'account-support',
] as const satisfies readonly WebRouteId[]);

export type AccountPreviewRoute = (typeof ACCOUNT_ENTRY_ROUTE_IDS)[number];

export const ACCOUNT_GOAL_ROUTE_IDS = Object.freeze([
  'account-overview',
  'account-device',
  'account-downloads',
  'account-subscription',
  'account-security',
  'account-support',
] as const satisfies readonly AccountPreviewRoute[]);

export type AccountGoalRoute = (typeof ACCOUNT_GOAL_ROUTE_IDS)[number];

type AccountGoalNavigationItem = Readonly<{
  label: string;
  relatedRouteIds: readonly AccountPreviewRoute[];
  routeId: AccountGoalRoute;
}>;

const ACCOUNT_GOAL_LABELS = Object.freeze({
  'account-device': { 'pt-BR': 'PCs e licenças', en: 'PCs and licenses' },
  'account-downloads': { 'pt-BR': 'Downloads', en: 'Downloads' },
  'account-overview': { 'pt-BR': 'Início', en: 'Home' },
  'account-security': { 'pt-BR': 'Segurança e privacidade', en: 'Security and privacy' },
  'account-subscription': { 'pt-BR': 'Plano e pagamentos', en: 'Plan and payments' },
  'account-support': { 'pt-BR': 'Ajuda', en: 'Help' },
} as const satisfies Readonly<Record<AccountGoalRoute, Readonly<Record<WebLocale, string>>>>);

const ACCOUNT_GOAL_RELATED_ROUTES = Object.freeze({
  'account-device': [],
  'account-downloads': [],
  'account-overview': ['account-profile'],
  'account-security': ['account-privacy'],
  'account-subscription': ['account-invoices'],
  'account-support': [],
} as const satisfies Readonly<Record<AccountGoalRoute, readonly AccountPreviewRoute[]>>);

export const getAccountGoalNavigation = (locale: WebLocale): readonly AccountGoalNavigationItem[] =>
  ACCOUNT_GOAL_ROUTE_IDS.map((routeId) => ({
    label: ACCOUNT_GOAL_LABELS[routeId][locale],
    relatedRouteIds: ACCOUNT_GOAL_RELATED_ROUTES[routeId],
    routeId,
  }));

export const accountGoalForRoute = (routeId: AccountPreviewRoute): AccountGoalRoute | undefined => {
  if (
    routeId === 'account-sign-in' ||
    routeId === 'account-sign-up' ||
    routeId === 'account-onboarding'
  ) {
    return undefined;
  }
  if (routeId === 'account-profile') return 'account-overview';
  if (routeId === 'account-invoices') return 'account-subscription';
  if (routeId === 'account-privacy') return 'account-security';
  return routeId;
};

export type AccountHomeScenarioId = 'essential' | 'premium-active' | 'premium-pending';

export type AccountMutationPhase =
  | 'idle'
  | 'reviewing'
  | 'reauth'
  | 'confirming'
  | 'issuing'
  | 'pending'
  | 'conflict'
  | 'offline'
  | 'stale'
  | 'error'
  | 'complete';

export type AccountMutationEvent =
  | 'review'
  | 'require-reauth'
  | 'confirm'
  | 'issue'
  | 'pending'
  | 'conflict'
  | 'offline'
  | 'stale'
  | 'error'
  | 'complete';

const ACCOUNT_MUTATION_TRANSITIONS = Object.freeze({
  idle: Object.freeze({ review: 'reviewing' }),
  reviewing: Object.freeze({
    'require-reauth': 'reauth',
    confirm: 'confirming',
    issue: 'issuing',
  }),
  reauth: Object.freeze({ confirm: 'confirming' }),
  confirming: Object.freeze({ issue: 'issuing' }),
  issuing: Object.freeze({
    complete: 'complete',
    conflict: 'conflict',
    error: 'error',
    offline: 'offline',
    pending: 'pending',
    stale: 'stale',
  }),
  pending: Object.freeze({
    complete: 'complete',
    error: 'error',
    offline: 'offline',
    stale: 'stale',
  }),
  conflict: Object.freeze({ review: 'reviewing' }),
  offline: Object.freeze({ review: 'reviewing' }),
  stale: Object.freeze({ review: 'reviewing' }),
  error: Object.freeze({ review: 'reviewing' }),
  complete: Object.freeze({ review: 'reviewing' }),
} as const satisfies Readonly<
  Record<
    AccountMutationPhase,
    Readonly<Partial<Record<AccountMutationEvent, AccountMutationPhase>>>
  >
>);

export const advanceAccountMutationPhase = (
  phase: AccountMutationPhase,
  event: AccountMutationEvent,
): AccountMutationPhase => {
  const next = ACCOUNT_MUTATION_TRANSITIONS[phase][
    event as keyof (typeof ACCOUNT_MUTATION_TRANSITIONS)[typeof phase]
  ] as AccountMutationPhase | undefined;
  if (next === undefined) throw new Error(`ACCOUNT_MUTATION_TRANSITION_INVALID:${phase}:${event}`);
  return next;
};

export type AccountHomeScenario = Readonly<{
  billing: Readonly<{ state: 'active' | 'none' | 'pending' }>;
  id: AccountHomeScenarioId;
  pc: Readonly<{ label?: string; state: 'linked' | 'unlinked' }>;
  plan: Readonly<{ kind: 'essential' | 'premium'; state: 'active' | 'pending' }>;
  recommendedAction: Readonly<{
    kind: 'complete-payment' | 'configure-passkey' | 'link-pc';
    routeId: AccountGoalRoute;
  }>;
  remoteStateChanged: false;
  security: Readonly<{
    mfa: 'configured' | 'not-configured';
    passkey: 'configured' | 'not-configured';
  }>;
}>;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const ACCOUNT_HOME_SCENARIOS = Object.freeze({
  essential: Object.freeze({
    billing: Object.freeze({ state: 'none' }),
    id: 'essential',
    pc: Object.freeze({ state: 'unlinked' }),
    plan: Object.freeze({ kind: 'essential', state: 'active' }),
    recommendedAction: Object.freeze({ kind: 'link-pc', routeId: 'account-device' }),
    remoteStateChanged: false,
    security: Object.freeze({ mfa: 'not-configured', passkey: 'not-configured' }),
  }),
  'premium-active': Object.freeze({
    billing: Object.freeze({ state: 'active' }),
    id: 'premium-active',
    pc: Object.freeze({ label: 'Astra-PC', state: 'linked' }),
    plan: Object.freeze({ kind: 'premium', state: 'active' }),
    recommendedAction: Object.freeze({
      kind: 'configure-passkey',
      routeId: 'account-security',
    }),
    remoteStateChanged: false,
    security: Object.freeze({ mfa: 'configured', passkey: 'not-configured' }),
  }),
  'premium-pending': Object.freeze({
    billing: Object.freeze({ state: 'pending' }),
    id: 'premium-pending',
    pc: Object.freeze({ state: 'unlinked' }),
    plan: Object.freeze({ kind: 'premium', state: 'pending' }),
    recommendedAction: Object.freeze({
      kind: 'complete-payment',
      routeId: 'account-subscription',
    }),
    remoteStateChanged: false,
    security: Object.freeze({ mfa: 'configured', passkey: 'configured' }),
  }),
} as const satisfies Readonly<Record<AccountHomeScenarioId, AccountHomeScenario>>);

const contradiction = (reason: string): never => {
  throw new Error(`ACCOUNT_HOME_SCENARIO_CONTRADICTION:${reason}`);
};

export const admitAccountHomeScenario = (candidate: unknown): AccountHomeScenario => {
  if (
    !isRecord(candidate) ||
    !isRecord(candidate['billing']) ||
    !isRecord(candidate['pc']) ||
    !isRecord(candidate['plan']) ||
    !isRecord(candidate['recommendedAction']) ||
    !isRecord(candidate['security']) ||
    candidate['remoteStateChanged'] !== false
  ) {
    throw new Error('ACCOUNT_HOME_SCENARIO_INVALID:shape');
  }
  const id = candidate['id'];
  if (id !== 'essential' && id !== 'premium-active' && id !== 'premium-pending') {
    throw new Error('ACCOUNT_HOME_SCENARIO_INVALID:id');
  }
  const billingState = candidate['billing']['state'];
  const pcState = candidate['pc']['state'];
  const planKind = candidate['plan']['kind'];
  const planState = candidate['plan']['state'];
  const actionKind = candidate['recommendedAction']['kind'];
  const actionRouteId = candidate['recommendedAction']['routeId'];
  const mfaState = candidate['security']['mfa'];
  const passkeyState = candidate['security']['passkey'];

  if (
    (billingState !== 'active' && billingState !== 'none' && billingState !== 'pending') ||
    (pcState !== 'linked' && pcState !== 'unlinked') ||
    (planKind !== 'essential' && planKind !== 'premium') ||
    (planState !== 'active' && planState !== 'pending') ||
    (actionKind !== 'complete-payment' &&
      actionKind !== 'configure-passkey' &&
      actionKind !== 'link-pc') ||
    (mfaState !== 'configured' && mfaState !== 'not-configured') ||
    (passkeyState !== 'configured' && passkeyState !== 'not-configured')
  ) {
    throw new Error('ACCOUNT_HOME_SCENARIO_INVALID:state');
  }
  if (
    (actionKind === 'link-pc' && actionRouteId !== 'account-device') ||
    (actionKind === 'configure-passkey' && actionRouteId !== 'account-security') ||
    (actionKind === 'complete-payment' && actionRouteId !== 'account-subscription')
  ) {
    throw new Error('ACCOUNT_HOME_SCENARIO_INVALID:recommended-action');
  }

  if (id === 'essential' && (planKind !== 'essential' || planState !== 'active')) {
    return contradiction('essential:plan');
  }
  if (id === 'essential' && billingState !== 'none') return contradiction('essential:billing');
  if (id === 'premium-active' && (planKind !== 'premium' || planState !== 'active')) {
    return contradiction('premium-active:plan');
  }
  if (id === 'premium-active' && billingState !== 'active') {
    return contradiction('premium-active:billing');
  }
  if (id === 'premium-pending' && (planKind !== 'premium' || planState !== 'pending')) {
    return contradiction('premium-pending:plan');
  }
  if (id === 'premium-pending' && billingState !== 'pending') {
    return contradiction('premium-pending:billing');
  }
  if (pcState === 'linked' && actionKind === 'link-pc') {
    return contradiction('linked-pc:link-action');
  }
  if (passkeyState === 'configured' && actionKind === 'configure-passkey') {
    return contradiction('configured-passkey:configure-action');
  }
  if (actionKind === 'complete-payment' && billingState !== 'pending') {
    return contradiction('payment-action:billing');
  }
  return candidate as AccountHomeScenario;
};

export const getAccountHomeScenario = (id: AccountHomeScenarioId): AccountHomeScenario =>
  admitAccountHomeScenario(ACCOUNT_HOME_SCENARIOS[id]);

export const ACCOUNT_ERROR_ROUTE_IDS = Object.freeze([
  'account-error-404',
  'account-error-403',
  'account-error-410',
  'account-error-500',
] as const satisfies readonly WebRouteId[]);

export type AccountErrorRoute = (typeof ACCOUNT_ERROR_ROUTE_IDS)[number];

export const isAccountPreviewRoute = (routeId: WebRouteId): routeId is AccountPreviewRoute =>
  ACCOUNT_ENTRY_ROUTE_IDS.includes(routeId as AccountPreviewRoute);

export const isAccountErrorRoute = (routeId: WebRouteId): routeId is AccountErrorRoute =>
  ACCOUNT_ERROR_ROUTE_IDS.includes(routeId as AccountErrorRoute);

export const accountFailureKindForRoute = (routeId: AccountErrorRoute): AccountFailureKind => {
  switch (routeId) {
    case 'account-error-403':
      return '403';
    case 'account-error-404':
      return '404';
    case 'account-error-410':
      return '410';
    case 'account-error-500':
      return '500';
  }
};

const contentByLocale = { en: accountEn, 'pt-BR': accountPtBr } as const;

export const getAccountPreviewMetadata = (locale: WebLocale, routeId: AccountPreviewRoute) => {
  const content = contentByLocale[locale];
  switch (routeId) {
    case 'account-sign-in':
      return { title: content.signIn.title, summary: content.signIn.summary };
    case 'account-sign-up':
      return { title: content.signUp.title, summary: content.signUp.summary };
    case 'account-onboarding':
      return { title: content.onboarding.title, summary: content.onboarding.summary };
    case 'account-overview':
      return { title: content.overview.title, summary: content.overview.summary };
    case 'account-profile':
      return { title: content.profile.title, summary: content.profile.summary };
    case 'account-security':
      return { title: content.security.title, summary: content.security.summary };
    case 'account-subscription':
      return { title: content.subscription.title, summary: content.subscription.summary };
    case 'account-invoices':
      return { title: content.invoices.title, summary: content.invoices.summary };
    case 'account-device':
      return { title: content.device.title, summary: content.device.summary };
    case 'account-downloads':
      return { title: content.downloads.title, summary: content.downloads.summary };
    case 'account-privacy':
      return { title: content.privacy.title, summary: content.privacy.summary };
    case 'account-support':
      return { title: content.support.title, summary: content.support.summary };
  }
};
