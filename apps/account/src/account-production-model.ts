import type { WebLocale, WebRouteId } from '@liiiraa/web-core';

import type { AccountFailureKind } from './account-errors';

export const ACCOUNT_ROUTE_IDS = Object.freeze([
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

export type AccountRoute = (typeof ACCOUNT_ROUTE_IDS)[number];

export const ACCOUNT_ERROR_ROUTE_IDS = Object.freeze([
  'account-error-404',
  'account-error-403',
  'account-error-410',
  'account-error-500',
] as const satisfies readonly WebRouteId[]);

export type AccountErrorRoute = (typeof ACCOUNT_ERROR_ROUTE_IDS)[number];

export const isAccountRoute = (routeId: WebRouteId): routeId is AccountRoute =>
  ACCOUNT_ROUTE_IDS.includes(routeId as AccountRoute);

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

const ACCOUNT_METADATA = Object.freeze({
  en: Object.freeze({
    'account-device': { title: 'Device', summary: 'Manage the PC linked to your license.' },
    'account-downloads': { title: 'Downloads', summary: 'Download verified product releases.' },
    'account-invoices': { title: 'Invoices', summary: 'Review authoritative billing records.' },
    'account-onboarding': { title: 'Getting started', summary: 'Finish setting up your account.' },
    'account-overview': { title: 'Overview', summary: 'Review your account and product status.' },
    'account-privacy': { title: 'Privacy', summary: 'Manage consent and privacy requests.' },
    'account-profile': { title: 'Profile', summary: 'Keep your account identity up to date.' },
    'account-security': { title: 'Security', summary: 'Review sessions and stronger sign-in methods.' },
    'account-sign-in': { title: 'Sign in', summary: 'Access your Liiiraa Boost account securely.' },
    'account-sign-up': { title: 'Create account', summary: 'Create your invited Liiiraa Boost account.' },
    'account-subscription': { title: 'Subscription', summary: 'Manage your plan and payment status.' },
    'account-support': { title: 'Support', summary: 'Open and follow support requests.' },
  }),
  'pt-BR': Object.freeze({
    'account-device': { title: 'Dispositivo', summary: 'Gerencie o PC vinculado à sua licença.' },
    'account-downloads': { title: 'Downloads', summary: 'Baixe versões verificadas do produto.' },
    'account-invoices': { title: 'Faturas', summary: 'Consulte os registros reais de cobrança.' },
    'account-onboarding': { title: 'Primeiros passos', summary: 'Conclua a configuração da sua conta.' },
    'account-overview': { title: 'Visão geral', summary: 'Consulte sua conta e o estado do produto.' },
    'account-privacy': { title: 'Privacidade', summary: 'Gerencie consentimentos e solicitações de privacidade.' },
    'account-profile': { title: 'Perfil', summary: 'Mantenha a identidade da sua conta atualizada.' },
    'account-security': { title: 'Segurança', summary: 'Revise sessões e métodos fortes de acesso.' },
    'account-sign-in': { title: 'Entrar', summary: 'Acesse sua conta Liiiraa Boost com segurança.' },
    'account-sign-up': { title: 'Criar conta', summary: 'Crie sua conta Liiiraa Boost convidada.' },
    'account-subscription': { title: 'Assinatura', summary: 'Gerencie seu plano e estado do pagamento.' },
    'account-support': { title: 'Suporte', summary: 'Abra e acompanhe solicitações de suporte.' },
  }),
} as const satisfies Readonly<
  Record<WebLocale, Readonly<Record<AccountRoute, Readonly<{ summary: string; title: string }>>>>
>);

export const getAccountRouteMetadata = (locale: WebLocale, routeId: AccountRoute) =>
  ACCOUNT_METADATA[locale][routeId];

export const ACCOUNT_GOAL_ROUTE_IDS = Object.freeze([
  'account-overview',
  'account-device',
  'account-subscription',
  'account-security',
  'account-support',
] as const satisfies readonly AccountRoute[]);

export type AccountGoalRoute = (typeof ACCOUNT_GOAL_ROUTE_IDS)[number];

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
} as const satisfies Readonly<Record<AccountGoalRoute, readonly AccountRoute[]>>);

export const getAccountGoalNavigation = (locale: WebLocale) =>
  ACCOUNT_GOAL_ROUTE_IDS.map((routeId) => ({
    label: ACCOUNT_GOAL_LABELS[routeId][locale],
    relatedRouteIds: ACCOUNT_GOAL_RELATED_ROUTES[routeId],
    routeId,
  }));

export const accountGoalForRoute = (routeId: AccountRoute): AccountGoalRoute | undefined => {
  if (
    routeId === 'account-sign-in' ||
    routeId === 'account-sign-up' ||
    routeId === 'account-onboarding'
  ) return undefined;
  if (routeId === 'account-profile') return 'account-overview';
  if (routeId === 'account-invoices') return 'account-subscription';
  if (routeId === 'account-downloads') return 'account-device';
  if (routeId === 'account-privacy') return 'account-security';
  return routeId;
};
