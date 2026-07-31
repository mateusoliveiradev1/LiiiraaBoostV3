import '@liiiraa/design-tokens/tokens.css';
import '../admin-shell.css';

import { routeHref, WEB_LOCALES, type WebLocale } from '@liiiraa/web-core';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { AdminFocusHandoff } from '../../admin-focus-handoff';
import { AdminPreviewProvenance } from '../../admin-preview-provenance';
import {
  ADMIN_ROLE_COPY,
  adminRoleFromHeader,
  projectAdminRoleNavigation,
} from '../../admin-shell';
import { ADMIN_WEB_COMPOSITION } from '../../index';

type AdminLocaleLayoutProps = Readonly<{
  children: ReactNode;
  params: Promise<{ locale: string }>;
}>;

const COPY = Object.freeze({
  'pt-BR': Object.freeze({
    boundary: 'Origem administrativa dedicada. Cookies públicos e da conta não são aceitos.',
    desktop: 'Ações de alto risco exigem uma viewport de classe desktop com pelo menos 960 px.',
    footer:
      'Prévia operacional determinística. Nenhuma credencial ou autoridade administrativa está conectada.',
    language: 'English',
    mobile:
      'Revisão segura, triagem, casos e auditoria permanecem disponíveis. Ações de alto risco estão bloqueadas nesta viewport.',
    navigation: 'Escopo da função',
    preview:
      'Autoridade desconectada — o escopo é demonstrativo e nenhuma mutação remota pode ocorrer.',
    previewLabel: 'Prévia administrativa',
    skip: 'Ir para o conteúdo administrativo',
    viewport: 'Política de viewport',
  }),
  en: Object.freeze({
    boundary: 'Dedicated administrative origin. Public and account cookies are not accepted.',
    desktop: 'High-risk actions require a desktop-class viewport at least 960px wide.',
    footer:
      'Deterministic operational preview. No credential or administrative authority is connected.',
    language: 'Português',
    mobile:
      'Safe review, triage, cases, and audit remain available. High-risk actions are blocked in this viewport.',
    navigation: 'Role scope',
    preview: 'Disconnected authority — scope is demonstrative and no remote mutation can occur.',
    previewLabel: 'Administrative preview',
    skip: 'Skip to administrative content',
    viewport: 'Viewport policy',
  }),
});

const localizedRoleHref = (locale: WebLocale, role: keyof typeof ADMIN_ROLE_COPY): string => {
  const result = routeHref('admin-role', { locale });

  if (!result.ok) {
    throw new Error('Canonical admin role route unavailable.');
  }

  return role === 'support' ? result.value : `${result.value}?role=${role}`;
};

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
    noarchive: true,
  },
  title: {
    default: 'Admin preview · Liiiraa Boost',
    template: '%s · Admin · Liiiraa Boost',
  },
};

export function generateStaticParams() {
  return WEB_LOCALES.map((locale) => ({ locale }));
}

export default async function AdminLocaleLayout({ children, params }: AdminLocaleLayoutProps) {
  const { locale: requestedLocale } = await params;

  if (!hasLocale(WEB_LOCALES, requestedLocale)) {
    notFound();
  }

  setRequestLocale(requestedLocale);

  const locale = requestedLocale as WebLocale;
  const requestHeaders = await headers();
  const role = adminRoleFromHeader(requestHeaders.get('x-liiiraa-admin-role'));
  const copy = COPY[locale];
  const alternateLocale: WebLocale = locale === 'pt-BR' ? 'en' : 'pt-BR';
  const navigation = projectAdminRoleNavigation(role, locale);

  return (
    <html
      data-authoritative-access-connected={String(ADMIN_WEB_COMPOSITION.authorityConnected)}
      data-ordinary-navigation-linked={String(ADMIN_WEB_COMPOSITION.ordinaryNavigationLinked)}
      data-runtime-class={ADMIN_WEB_COMPOSITION.runtimeClass}
      data-surface={ADMIN_WEB_COMPOSITION.surface}
      lang={locale}
    >
      <body>
        <a className="admin-skip-link" href="#admin-main">
          {copy.skip}
        </a>

        <header className="admin-header">
          <div className="admin-header__bar">
            <a className="admin-brand" href={localizedRoleHref(locale, role)}>
              <span aria-hidden="true" className="admin-brand__mark">
                LB
              </span>
              <span>
                <strong>Liiiraa Boost</strong>
                <small> Admin</small>
              </span>
            </a>
            <p className="admin-header__origin" role="note">
              {copy.boundary}
            </p>
            <a
              aria-label={`${locale === 'pt-BR' ? 'Idioma' : 'Language'}: ${copy.language}`}
              className="admin-locale"
              href={localizedRoleHref(alternateLocale, role)}
              hrefLang={alternateLocale}
              lang={alternateLocale}
            >
              {copy.language}
            </a>
          </div>
        </header>

        <aside
          aria-label={copy.previewLabel}
          className="admin-role-rail"
          data-authority="disconnected"
          data-preview-role={role}
        >
          <AdminPreviewProvenance detail={copy.previewLabel} locale={locale} />
          <strong>{ADMIN_ROLE_COPY[role][locale]}</strong>
          <p>{copy.preview}</p>
        </aside>

        <div className="admin-workspace">
          <nav aria-label={copy.navigation} className="admin-nav">
            <p className="admin-nav__label">{copy.navigation}</p>
            <ol className="admin-nav__list">
              {navigation.map((item) => (
                <li key={item.routeId}>
                  <a href={item.href}>{item.label}</a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="admin-main-column">
            <section
              aria-labelledby="admin-viewport-policy"
              className="admin-viewport-gate"
              data-viewport-gate="960"
              role="region"
            >
              <h2 id="admin-viewport-policy">{copy.viewport}</h2>
              <p className="admin-viewport-gate__desktop">{copy.desktop}</p>
              <p className="admin-viewport-gate__mobile" role="status">
                {copy.mobile}
              </p>
            </section>

            <main id="admin-main" tabIndex={-1}>
              <AdminFocusHandoff />
              {children}
            </main>
          </div>
        </div>

        <footer className="admin-footer">
          <span>{copy.footer}</span>
          <span>
            {locale === 'pt-BR' ? 'Função' : 'Role'}: {ADMIN_ROLE_COPY[role][locale]}
          </span>
        </footer>
      </body>
    </html>
  );
}
