import '@liiiraa/design-tokens/tokens.css';
import '../admin-shell.css';

import { WEB_LOCALES } from '@liiiraa/web-core';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { AdminAuthorityProvider } from '../../features/admin-authority';
import { resolveAdminProductionAccountOrigin } from '../../admin-production-runtime-server';
import { ADMIN_BROWSER_AUTHORITY_BASE_URL } from '../../admin-runtime';

type AdminLocaleLayoutProps = Readonly<{
  children: ReactNode;
  params: Promise<{ locale: string }>;
}>;

const COPY = Object.freeze({
  'pt-BR': Object.freeze({
    skip: 'Ir para o conteúdo administrativo',
  }),
  en: Object.freeze({
    skip: 'Skip to administrative content',
  }),
});

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
    noarchive: true,
  },
  title: {
    default: 'Admin · Liiiraa Boost',
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

  const locale = requestedLocale;
  const requestHeaders = await headers();
  const nonce = requestHeaders.get('x-nonce');
  const copy = COPY[locale];
  const accountOrigin = resolveAdminProductionAccountOrigin();

  return (
    <html
      data-admin-session-state="unverified"
      data-authoritative-access-connected="true"
      data-ordinary-navigation-linked="false"
      data-runtime-class="server-authority"
      data-surface="admin"
      lang={locale}
    >
      <head>{nonce === null ? null : <meta content={nonce} property="csp-nonce" />}</head>
      <body>
        <a className="admin-skip-link" href="#admin-main">
          {copy.skip}
        </a>
        <AdminAuthorityProvider
          accountOrigin={accountOrigin}
          authorityBaseUrl={ADMIN_BROWSER_AUTHORITY_BASE_URL}
          locale={locale}
        >
          {children}
        </AdminAuthorityProvider>
      </body>
    </html>
  );
}
