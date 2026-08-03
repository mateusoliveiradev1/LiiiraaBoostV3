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
  'account-overview': { 'pt-BR': 'Início', en: 'Home' },
  'account-security': { 'pt-BR': 'Segurança e privacidade', en: 'Security and privacy' },
  'account-subscription': { 'pt-BR': 'Plano e pagamentos', en: 'Plan and payments' },
  'account-support': { 'pt-BR': 'Ajuda', en: 'Help' },
} as const satisfies Readonly<Record<AccountGoalRoute, Readonly<Record<WebLocale, string>>>>);

const ACCOUNT_GOAL_RELATED_ROUTES = Object.freeze({
  'account-device': ['account-downloads'],
  'account-overview': ['account-profile'],
  'account-security': ['account-privacy'],
  'account-subscription': ['account-invoices'],
  'account-support': [],
} as const satisfies Readonly<Record<AccountGoalRoute, readonly AccountPreviewRoute[]>>);

export const getAccountGoalNavigation = (
  locale: WebLocale,
): readonly AccountGoalNavigationItem[] =>
  ACCOUNT_GOAL_ROUTE_IDS.map((routeId) => ({
    label: ACCOUNT_GOAL_LABELS[routeId][locale],
    relatedRouteIds: ACCOUNT_GOAL_RELATED_ROUTES[routeId],
    routeId,
  }));

export const accountGoalForRoute = (
  routeId: AccountPreviewRoute,
): AccountGoalRoute | undefined => {
  if (
    routeId === 'account-sign-in' ||
    routeId === 'account-sign-up' ||
    routeId === 'account-onboarding'
  ) {
    return undefined;
  }
  if (routeId === 'account-profile') return 'account-overview';
  if (routeId === 'account-invoices') return 'account-subscription';
  if (routeId === 'account-downloads') return 'account-device';
  if (routeId === 'account-privacy') return 'account-security';
  return routeId;
};

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
