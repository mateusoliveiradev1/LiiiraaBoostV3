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
import {
  AccountNavigation,
  type AccountNavigationGroup,
  type AccountNavigationItem,
} from '../../account-navigation';
import { AccountInspector } from '../../account-inspector';
import { createAccountFailureModel } from '../../account-errors';
import { ProductLockup } from '../../account-product-lockup';
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
  {
    ids: ['account-overview', 'account-profile', 'account-security'],
    label: { 'pt-BR': 'Essencial', en: 'Core' },
  },
  {
    ids: ['account-subscription', 'account-invoices'],
    label: { 'pt-BR': 'Plano e cobrança', en: 'Plan and billing' },
  },
  {
    ids: ['account-device', 'account-downloads'],
    label: { 'pt-BR': 'Produto', en: 'Product' },
  },
  {
    ids: ['account-privacy', 'account-support'],
    label: { 'pt-BR': 'Conta e ajuda', en: 'Account and help' },
  },
] as const satisfies readonly NavigationGroup[]);

const NAVIGATION_LABELS = Object.freeze({
  'account-device': { 'pt-BR': 'Dispositivo', en: 'Device' },
  'account-downloads': { 'pt-BR': 'Downloads', en: 'Downloads' },
  'account-invoices': { 'pt-BR': 'Faturas', en: 'Invoices' },
  'account-overview': { 'pt-BR': 'Visão geral', en: 'Overview' },
  'account-privacy': { 'pt-BR': 'Privacidade', en: 'Privacy' },
  'account-profile': { 'pt-BR': 'Perfil', en: 'Profile' },
  'account-security': { 'pt-BR': 'Segurança', en: 'Security' },
  'account-subscription': { 'pt-BR': 'Assinatura', en: 'Subscription' },
  'account-support': { 'pt-BR': 'Suporte', en: 'Support' },
});

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
    deviceAction: 'Revisar dispositivo',
    deviceDetail: 'Windows 11 · não vinculado',
    deviceTitle: 'Dispositivo',
    help: 'Ajuda',
    inspectorLabel: 'Resumo contextual da conta',
    mfa: 'MFA — revisar',
    navigation: 'Responsabilidades da conta',
    passkey: 'Chave de acesso — revisar',
    planAction: 'Ver assinatura',
    planDetail: 'R$ 29,90 · ilustrativo',
    planPeriod: 'Mensal',
    planSection: 'Plano',
    planTitle: 'Prévia Premium',
    preview:
      'Você pode revisar o fluxo com dados sintéticos; nada será alterado fora desta prévia.',
    previewLabel: 'Alterações remotas desconectadas',
    publicLink: 'Ir para a superfície pública',
    securityAction: 'Revisar segurança',
    securityTitle: 'Segurança',
    signIn: 'Entrar',
    skip: 'Ir para o conteúdo da conta',
    supportAction: 'Abrir suporte',
    supportTitle: 'Suporte',
    surface: 'Conta',
  }),
  en: Object.freeze({
    accountIdentity: 'Demonstration account',
    accountState: 'No session connected',
    currentTask: 'Current responsibility',
    deviceAction: 'Review device',
    deviceDetail: 'Windows 11 · not linked',
    deviceTitle: 'Device',
    help: 'Help',
    inspectorLabel: 'Contextual account summary',
    mfa: 'MFA — review',
    navigation: 'Account responsibilities',
    passkey: 'Passkey — review',
    planAction: 'View subscription',
    planDetail: 'R$ 29.90 · illustrative',
    planPeriod: 'Monthly',
    planSection: 'Plan',
    planTitle: 'Premium preview',
    preview: 'You can review the flow with synthetic data; nothing changes outside this preview.',
    previewLabel: 'Remote changes disconnected',
    publicLink: 'Go to the public surface',
    securityAction: 'Review security',
    securityTitle: 'Security',
    signIn: 'Sign in',
    skip: 'Skip to account content',
    supportAction: 'Open support',
    supportTitle: 'Support',
    surface: 'Account',
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
    label: group.label[locale],
    items: group.ids.map((routeId) => ({
      href: localizedHref(routeId, locale),
      icon: NAVIGATION_ICONS[routeId],
      label: NAVIGATION_LABELS[routeId][locale],
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
          brand={
            <a className="account-brand" href={localizedHref('account-overview', locale)}>
              <ProductLockup />
              <span className="account-brand__surface">{copy.surface}</span>
            </a>
          }
          currentTaskLabel={copy.currentTask}
          entryItems={signInEntryItems}
          fallbackLocaleHref={localizedHref('account-overview', alternateLocale)}
          groups={navigationGroups}
          identity={
            <>
              <span aria-hidden="true" className="account-identity__avatar">
                AP
              </span>
              <span className="account-identity__copy">
                <strong>Astra Preview</strong>
                <span>{copy.accountIdentity}</span>
              </span>
            </>
          }
          inspector={
            <AccountInspector
              copy={copy}
              deviceHref={localizedHref('account-device', locale)}
              securityHref={localizedHref('account-security', locale)}
              subscriptionHref={localizedHref('account-subscription', locale)}
              supportHref={localizedHref('account-support', locale)}
            />
          }
          inspectorLabel={copy.inspectorLabel}
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
          publicLink={
            <a href={publicHomeHref(locale)}>
              {copy.publicLink} <span aria-hidden="true">↗</span>
            </a>
          }
          supportHref={localizedHref('account-support', locale)}
          supportLabel={copy.help}
          surfaceLabel={copy.surface}
        >
          {children}
        </AccountNavigation>
      </body>
    </html>
  );
}
