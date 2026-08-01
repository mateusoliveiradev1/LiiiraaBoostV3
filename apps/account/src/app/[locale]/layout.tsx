import '@liiiraa/design-tokens/tokens.css';
import '../account-shell.css';

import {
  projectNavigation,
  routeHref,
  WEB_LOCALES,
  WEB_ORIGINS,
  type WebLocale,
  type WebRouteId,
} from '@liiiraa/web-core';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { ProductLockup } from '../../../../../packages/design-system/src/product-lockup.tsx';
import {
  AccountNavigation,
  type AccountNavigationGroup,
  type AccountNavigationItem,
} from '../../account-navigation';
import { createAccountFailureModel } from '../../account-errors';
import { AccountPreviewProvenance } from '../../account-preview-provenance';
import { ACCOUNT_WEB_COMPOSITION } from '../../index';

type AccountLocaleLayoutProps = Readonly<{
  children: ReactNode;
  params: Promise<{ locale: string }>;
}>;

type NavigationGroup = Readonly<{
  ids: readonly WebRouteId[];
  label: Readonly<Record<WebLocale, string>>;
}>;

const ACCOUNT_NAVIGATION_IDS = new Set(projectNavigation('account').map(({ id }) => id));

const NAVIGATION_GROUPS = Object.freeze([
  { ids: ['account-overview'], label: { 'pt-BR': 'Visão geral', en: 'Overview' } },
  { ids: ['account-profile'], label: { 'pt-BR': 'Perfil', en: 'Profile' } },
  { ids: ['account-security'], label: { 'pt-BR': 'Segurança', en: 'Security' } },
  {
    ids: ['account-subscription', 'account-invoices'],
    label: { 'pt-BR': 'Assinatura / Faturas', en: 'Subscription / Invoices' },
  },
  { ids: ['account-device'], label: { 'pt-BR': 'Dispositivo', en: 'Device' } },
  { ids: ['account-downloads'], label: { 'pt-BR': 'Downloads', en: 'Downloads' } },
  { ids: ['account-privacy'], label: { 'pt-BR': 'Privacidade', en: 'Privacy' } },
  { ids: ['account-support'], label: { 'pt-BR': 'Suporte', en: 'Support' } },
] as const satisfies readonly NavigationGroup[]);

const NAVIGATION_ICONS = Object.freeze({
  'account-device': 'device',
  'account-downloads': 'download',
  'account-invoices': 'list',
  'account-overview': 'speedometer',
  'account-privacy': 'lock',
  'account-profile': 'profile',
  'account-security': 'shield',
  'account-subscription': 'crown',
  'account-support': 'toolbox',
} as const);

const COPY = Object.freeze({
  'pt-BR': Object.freeze({
    accountIdentity: 'Conta demonstrativa',
    accountState: 'Nenhuma sessão conectada',
    currentTask: 'Responsabilidade atual',
    navigation: 'Responsabilidades da conta',
    preview:
      'Você pode revisar o fluxo com dados sintéticos; nada será alterado fora desta prévia.',
    previewLabel: 'Alterações remotas desconectadas',
    publicLink: 'Ir para a superfície pública',
    signIn: 'Entrar',
    skip: 'Ir para o conteúdo da conta',
  }),
  en: Object.freeze({
    accountIdentity: 'Demonstration account',
    accountState: 'No session connected',
    currentTask: 'Current responsibility',
    navigation: 'Account responsibilities',
    preview: 'You can review the flow with synthetic data; nothing changes outside this preview.',
    previewLabel: 'Remote changes disconnected',
    publicLink: 'Go to the public surface',
    signIn: 'Sign in',
    skip: 'Skip to account content',
  }),
});

const localizedHref = (routeId: WebRouteId, locale: WebLocale): string => {
  if (!ACCOUNT_NAVIGATION_IDS.has(routeId)) {
    throw new Error(`Account navigation route is not canonical: ${routeId}`);
  }
  const result = routeHref(routeId, { locale });
  if (!result.ok) {
    throw new Error(`Account navigation route is unavailable: ${routeId}`);
  }
  return result.value;
};

const localizedSignInHref = (locale: WebLocale): string => {
  const result = routeHref('account-sign-in', { locale });
  if (!result.ok) {
    throw new Error('Canonical account sign-in route is unavailable.');
  }
  return result.value;
};

const publicHomeHref = (locale: WebLocale): string => {
  const result = routeHref('public-home', { locale });
  if (!result.ok) {
    throw new Error('Canonical public home route is unavailable.');
  }
  return `${WEB_ORIGINS['public-origin']}${result.value}`;
};

export function generateStaticParams() {
  return WEB_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: Pick<AccountLocaleLayoutProps, 'params'>): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(WEB_LOCALES, locale)) {
    return {};
  }
  const requestHeaders = await headers();
  if (requestHeaders.get('x-liiiraa-account-failure-kind') === '404') {
    const model = createAccountFailureModel('404', locale);
    return {
      description: model.copy.detail,
      robots: {
        follow: false,
        index: false,
        nocache: true,
      },
      title: `${model.copy.title} — Liiiraa Boost`,
    };
  }
  return {
    description: COPY[locale].preview,
    robots: {
      follow: false,
      index: false,
      nocache: true,
    },
    title: locale === 'pt-BR' ? 'Conta — Liiiraa Boost' : 'Account — Liiiraa Boost',
  };
}

export default async function AccountLocaleLayout({ children, params }: AccountLocaleLayoutProps) {
  const { locale } = await params;
  if (!hasLocale(WEB_LOCALES, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const copy = COPY[locale];
  const alternateLocale = locale === 'pt-BR' ? 'en' : 'pt-BR';
  const navigationGroups = NAVIGATION_GROUPS.map((group): AccountNavigationGroup => ({
    ...(group.ids.length > 1 ? { label: group.label[locale] } : {}),
    items: group.ids.map((routeId) => ({
      href: localizedHref(routeId, locale),
      icon: NAVIGATION_ICONS[routeId],
      label:
        routeId === 'account-subscription'
          ? locale === 'pt-BR'
            ? 'Assinatura'
            : 'Subscription'
          : routeId === 'account-invoices'
            ? locale === 'pt-BR'
              ? 'Faturas'
              : 'Invoices'
            : group.label[locale],
    })),
  }));
  const signInEntryItems: readonly AccountNavigationItem[] = [
    {
      href: localizedSignInHref(locale),
      icon: 'profile',
      label: copy.signIn,
    },
  ];

  return (
    <html
      data-authority-connected={String(ACCOUNT_WEB_COMPOSITION.authorityConnected)}
      data-runtime-class={ACCOUNT_WEB_COMPOSITION.runtimeClass}
      data-surface={ACCOUNT_WEB_COMPOSITION.surface}
      lang={locale}
    >
      <body>
        <a className="account-skip-link" href="#account-main">
          {copy.skip}
        </a>

        <AccountNavigation
          alternateLocale={alternateLocale}
          currentTaskLabel={copy.currentTask}
          entryItems={signInEntryItems}
          fallbackLocaleHref={localizedHref('account-overview', alternateLocale)}
          groups={navigationGroups}
          header={
            <>
              <a className="account-brand" href={localizedHref('account-overview', locale)}>
                <ProductLockup />
                <span className="account-brand__surface">
                  {locale === 'pt-BR' ? 'Conta' : 'Account'}
                </span>
              </a>
              <div className="account-header__identity">
                <strong>{copy.accountIdentity}</strong>
                <span className="account-header__identity-state">{copy.accountState}</span>
              </div>
            </>
          }
          label={copy.navigation}
          locale={locale}
          preview={
            <aside
              aria-label={copy.previewLabel}
              className="account-preview-rail"
              data-authority="disconnected"
              role="note"
            >
              <AccountPreviewProvenance detail={copy.previewLabel} locale={locale} />
              <p>{copy.preview}</p>
            </aside>
          }
        >
          {children}
        </AccountNavigation>

        <footer className="account-footer">
          <div className="account-footer__bar">
            <a href={publicHomeHref(locale)}>
              {copy.publicLink} <span aria-hidden="true">↗</span>
            </a>
          </div>
        </footer>
      </body>
    </html>
  );
}
