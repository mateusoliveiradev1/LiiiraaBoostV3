/* eslint @typescript-eslint/no-unnecessary-type-assertion: "off" -- Next.js typed Link requires Route assertions that Linux ESLint misclassifies. */
import '@liiiraa/design-tokens/tokens.css';
import '../account-shell.css';

import {
  projectNavigation,
  routeHref,
  WEB_LOCALES,
  type WebLocale,
  type WebRouteId,
} from '@liiiraa/web-core';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
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
import { createAccountFailureModel } from '../../account-errors';
import { resolveAdminBoundaryOrigin, resolvePublicBoundaryOrigin } from '../../account-origins';
import { ProductLockup } from '../../account-product-lockup';
import { ACCOUNT_BROWSER_AUTHORITY_BASE_URL } from '../../account-runtime';
import { AccountIdentityChrome, AccountRoleGateway } from '../../features/account-auth';
import { AccountAuthorityInspector } from '../../features/account-authority';
import { ACCOUNT_WEB_COMPOSITION } from '../../account-production-composition';

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
  'account-invoices': 'receipt',
  'account-overview': 'gauge',
  'account-privacy': 'lock',
  'account-profile': 'profile',
  'account-security': 'shield',
  'account-subscription': 'crown',
  'account-support': 'lifebuoy',
} as const);

const COPY = Object.freeze({
  'pt-BR': Object.freeze({
    authBody:
      'Gerencie sua assinatura, mantenha seus dispositivos protegidos e acesse o aplicativo para Windows.',
    authEyebrow: 'Sua conta Liiiraa Boost',
    authPoints: ['Assinatura e downloads', 'Dispositivos autorizados', 'Segurança e suporte'],
    authTitle: 'Seu desempenho começa com uma conta confiável.',
    currentTask: 'Seção atual',
    deviceAction: 'Gerenciar PC',
    deviceTitle: 'Dispositivo',
    help: 'Ajuda',
    inspectorLabel: 'Resumo contextual da conta',
    navigation: 'Sua conta',
    onboarding: 'Primeiros passos',
    planAction: 'Gerenciar assinatura',
    planSection: 'Plano',
    preview: 'Sua conta reúne plano, segurança, dispositivo, downloads e suporte.',
    publicLink: 'Voltar ao site',
    securityAction: 'Configurar segurança',
    securityTitle: 'Segurança',
    signIn: 'Entrar',
    signOut: 'Sair',
    signUp: 'Criar conta',
    skip: 'Ir para o conteúdo da conta',
    supportAction: 'Abrir suporte',
    supportTitle: 'Suporte',
    surface: 'Conta',
  }),
  en: Object.freeze({
    authBody:
      'Manage your subscription, keep devices protected, and access the Windows application.',
    authEyebrow: 'Your Liiiraa Boost account',
    authPoints: ['Subscription and downloads', 'Authorized devices', 'Security and support'],
    authTitle: 'Your performance starts with an account you can trust.',
    currentTask: 'Current section',
    deviceAction: 'Manage PC',
    deviceTitle: 'Device',
    help: 'Help',
    inspectorLabel: 'Contextual account summary',
    navigation: 'Your account',
    onboarding: 'Getting started',
    planAction: 'Manage subscription',
    planSection: 'Plan',
    preview: 'Your account brings plan, security, device, downloads, and support together.',
    publicLink: 'Back to website',
    securityAction: 'Set up security',
    securityTitle: 'Security',
    signIn: 'Sign in',
    signOut: 'Sign out',
    signUp: 'Create account',
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

const localizedAuthHref = (
  routeId: 'account-onboarding' | 'account-sign-in' | 'account-sign-up',
  locale: WebLocale,
): string => {
  const result = routeHref(routeId, { locale });
  if (!result.ok) {
    throw new Error(`Canonical account auth route is unavailable: ${routeId}`);
  }
  return result.value;
};

const publicHomeHref = (locale: WebLocale, publicOrigin: string): string => {
  const result = routeHref('public-home', { locale });
  if (!result.ok) {
    throw new Error('Canonical public home route is unavailable.');
  }
  return `${publicOrigin}${result.value}`;
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
  const requestHeaders = await headers();
  const nonce = requestHeaders.get('x-nonce');
  const webComposition = ACCOUNT_WEB_COMPOSITION;
  const publicOrigin = resolvePublicBoundaryOrigin(
    process.env['LIIIRAA_PUBLIC_ORIGIN'],
    process.env['VERCEL'] === '1',
  );
  const adminOrigin = resolveAdminBoundaryOrigin(
    process.env['LIIIRAA_ADMIN_ORIGIN'],
    process.env['VERCEL'] === '1',
  );
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
  const authRouteItems: readonly AccountNavigationItem[] = [
    {
      href: localizedAuthHref('account-sign-in', locale),
      icon: 'profile',
      label: copy.signIn,
    },
    {
      href: localizedAuthHref('account-sign-up', locale),
      icon: 'userAdd',
      label: copy.signUp,
    },
    {
      href: localizedAuthHref('account-onboarding', locale),
      icon: 'rocket',
      label: copy.onboarding,
    },
  ];
  const authenticatedAction: AccountNavigationItem = {
    href: `${localizedAuthHref('account-sign-in', locale)}?action=sign-out`,
    icon: 'logout',
    label: copy.signOut,
  };

  return (
    <html
      data-authority-connected={String(webComposition.authorityConnected)}
      data-runtime-class={webComposition.runtimeClass}
      data-surface={webComposition.surface}
      lang={locale}
    >
      <head>{nonce === null ? null : <meta content={nonce} property="csp-nonce" />}</head>
      <body>
        <a className="account-skip-link" href="#account-main">
          {copy.skip}
        </a>

        <AccountNavigation
          alternateLocale={alternateLocale}
          authenticatedAction={authenticatedAction}
          authBrand={
            <a className="account-brand" href={publicHomeHref(locale, publicOrigin)}>
              <ProductLockup />
            </a>
          }
          authIntro={
            <div className="account-auth-intro">
              <span>{copy.authEyebrow}</span>
              <strong>{copy.authTitle}</strong>
              <p>{copy.authBody}</p>
              <ul>
                {copy.authPoints.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </div>
          }
          brand={
            <Link
              className="account-brand"
              href={localizedHref('account-overview', locale) as Route}
            >
              <ProductLockup />
              <span className="account-brand__surface">{copy.surface}</span>
            </Link>
          }
          currentTaskLabel={copy.currentTask}
          authRouteItems={authRouteItems}
          fallbackLocaleHref={localizedHref('account-overview', alternateLocale)}
          groups={navigationGroups}
          identity={
            <AccountIdentityChrome
              authorityBaseUrl={ACCOUNT_BROWSER_AUTHORITY_BASE_URL}
              locale={locale}
            />
          }
          inspector={
            <AccountAuthorityInspector
              authorityBaseUrl={ACCOUNT_BROWSER_AUTHORITY_BASE_URL}
              deviceHref={localizedHref('account-device', locale)}
              locale={locale}
              securityHref={localizedHref('account-security', locale)}
              subscriptionHref={localizedHref('account-subscription', locale)}
              supportHref={localizedHref('account-support', locale)}
            />
          }
          inspectorLabel={copy.inspectorLabel}
          label={copy.navigation}
          locale={locale}
          publicLink={
            <a href={publicHomeHref(locale, publicOrigin)}>
              {copy.publicLink} <span aria-hidden="true">↗</span>
            </a>
          }
          roleGateway={
            <AccountRoleGateway
              adminOrigin={adminOrigin}
              authorityBaseUrl={ACCOUNT_BROWSER_AUTHORITY_BASE_URL}
              locale={locale}
            />
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
