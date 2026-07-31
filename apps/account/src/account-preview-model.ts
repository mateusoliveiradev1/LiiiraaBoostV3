import type { WebLocale, WebRouteId } from '@liiiraa/web-core';

import accountEn from './content/account.en.json';
import accountPtBr from './content/account.pt-BR.json';

export const ACCOUNT_ENTRY_ROUTE_IDS = Object.freeze([
  'account-sign-in',
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

export const isAccountPreviewRoute = (routeId: WebRouteId): routeId is AccountPreviewRoute =>
  ACCOUNT_ENTRY_ROUTE_IDS.includes(routeId as AccountPreviewRoute);

const contentByLocale = { en: accountEn, 'pt-BR': accountPtBr } as const;

export const getAccountPreviewMetadata = (locale: WebLocale, routeId: AccountPreviewRoute) => {
  const content = contentByLocale[locale];
  switch (routeId) {
    case 'account-sign-in':
      return { title: content.signIn.title, summary: content.signIn.summary };
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
