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

const COPY = Object.freeze({
  'pt-BR': Object.freeze({
    boundary:
      'Origem dedicada da conta. Conteúdo público abre em outra origem e nenhum estado de sessão é transferido.',
    footer:
      'Prévia local e determinística. Esta origem não autentica, cobra, vincula dispositivos ou envia suporte.',
    language: 'English',
    navigation: 'Responsabilidades da conta',
    preview:
      'Autoridade desconectada: validações e revisões são demonstrativas; nenhuma mudança remota é executada.',
    previewLabel: 'Prévia determinística',
    publicLink: 'Ir para a superfície pública',
    skip: 'Ir para o conteúdo da conta',
  }),
  en: Object.freeze({
    boundary:
      'Dedicated account origin. Public content opens on another origin and no session state transfers.',
    footer:
      'Local deterministic preview. This origin does not authenticate, charge, bind devices, or submit support.',
    language: 'Português',
    navigation: 'Account responsibilities',
    preview:
      'Disconnected authority: validation and review are demonstrative; no remote change is executed.',
    previewLabel: 'Deterministic preview',
    publicLink: 'Go to the public surface',
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

export default async function AccountLocaleLayout({
  children,
  params,
}: AccountLocaleLayoutProps) {
  const { locale } = await params;
  if (!hasLocale(WEB_LOCALES, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const copy = COPY[locale];
  const alternateLocale = locale === 'pt-BR' ? 'en' : 'pt-BR';

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

        <header className="account-header">
          <div className="account-header__bar">
            <a className="account-brand" href={localizedHref('account-overview', locale)}>
              <span aria-hidden="true" className="account-brand__mark">
                LB
              </span>
              <span>
                <strong>Liiiraa Boost</strong>
                <small> Account</small>
              </span>
            </a>
            <p className="account-header__origin" role="note">
              {copy.boundary}
            </p>
            <a
              aria-label={`${locale === 'pt-BR' ? 'Idioma' : 'Language'}: ${copy.language}`}
              className="account-locale"
              href={localizedHref('account-overview', alternateLocale)}
              hrefLang={alternateLocale}
              lang={alternateLocale}
            >
              {copy.language}
            </a>
          </div>
        </header>

        <aside
          aria-label={copy.previewLabel}
          className="account-preview-rail"
          data-authority="disconnected"
        >
          <AccountPreviewProvenance detail={copy.previewLabel} locale={locale} />
          <strong>{copy.previewLabel}</strong>
          <p>{copy.preview}</p>
        </aside>

        <div className="account-workspace">
          <nav aria-label={copy.navigation} className="account-nav">
            <p className="account-nav__label">{copy.navigation}</p>
            <ol className="account-nav__list">
              {NAVIGATION_GROUPS.map((group) => (
                <li key={group.ids.join(':')}>
                  {group.ids.length === 1 ? (
                    <a href={localizedHref(group.ids[0], locale)}>{group.label[locale]}</a>
                  ) : (
                    <>
                      <strong className="account-nav__group-label">{group.label[locale]}</strong>
                      <ul className="account-nav__group">
                        {group.ids.map((routeId) => (
                          <li key={routeId}>
                            <a href={localizedHref(routeId, locale)}>
                              {routeId === 'account-subscription'
                                ? locale === 'pt-BR'
                                  ? 'Assinatura'
                                  : 'Subscription'
                                : locale === 'pt-BR'
                                  ? 'Faturas'
                                  : 'Invoices'}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </li>
              ))}
            </ol>
          </nav>

          <main id="account-main" tabIndex={-1}>
            {children}
          </main>
        </div>

        <footer className="account-footer">
          <span>{copy.footer}</span>
          <a href={publicHomeHref(locale)}>
            {copy.publicLink} <span aria-hidden="true">↗</span>
          </a>
        </footer>
      </body>
    </html>
  );
}
