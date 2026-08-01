import '@liiiraa/design-tokens/tokens.css';
import '../public-shell.css';

import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { ProductLockup } from '../../../../../packages/design-system/src/product-lockup.tsx';

import { accountBoundaryHref, publicBoundaryHref, routing } from '../../public-boundary';
import { PublicNavigation, type PublicNavigationCopy } from '../../public-navigation';

type PublicLocaleLayoutProps = Readonly<{
  children: ReactNode;
  params: Promise<{ locale: string }>;
}>;

type PublicCopy = PublicNavigationCopy &
  Readonly<{
    account: string;
    brandDescription: string;
    footerNavigation: string;
    skip: string;
  }>;

const COPY = Object.freeze({
  'pt-BR': Object.freeze({
    account: 'Conta',
    brandDescription: 'Otimização de jogos explicável, mensurável e reversível para Windows.',
    current: 'página atual',
    compatibility: 'Verificar compatibilidade',
    footerNavigation: 'Navegação complementar',
    menu: 'Menu',
    navigation: Object.freeze({
      'docs-index': 'Documentação',
      'public-compatibility': 'Compatibilidade',
      'public-evidence': 'Evidências',
      'public-plans': 'Planos',
      'public-product': 'Produto',
      'releases-index': 'Download / Versões',
    }),
    primaryNavigation: 'Navegação principal',
    search: 'Pesquisar',
    skip: 'Ir para o conteúdo principal',
  }),
  en: Object.freeze({
    account: 'Account',
    brandDescription: 'Explainable, measurable, reversible Windows gaming optimization.',
    current: 'current page',
    compatibility: 'Check compatibility',
    footerNavigation: 'Supplementary navigation',
    menu: 'Menu',
    navigation: Object.freeze({
      'docs-index': 'Documentation',
      'public-compatibility': 'Compatibility',
      'public-evidence': 'Evidence',
      'public-plans': 'Plans',
      'public-product': 'Product',
      'releases-index': 'Download / Releases',
    }),
    primaryNavigation: 'Primary navigation',
    search: 'Search',
    skip: 'Skip to main content',
  }),
} satisfies Record<(typeof routing.locales)[number], PublicCopy>);

export const dynamicParams = false;
export const revalidate = false;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: Pick<PublicLocaleLayoutProps, 'params'>): Promise<Metadata> {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    return {};
  }

  const copy = COPY[locale];

  return {
    alternates: {
      canonical: `/${locale}`,
      languages: {
        en: '/en',
        'pt-BR': '/pt-BR',
      },
    },
    description: copy.brandDescription,
    metadataBase: new URL('https://liiiraa.com'),
    title: {
      default: 'Liiiraa Boost',
      template: '%s · Liiiraa Boost',
    },
  };
}

const Brand = ({ locale }: { readonly locale: (typeof routing.locales)[number] }) => (
  <a
    aria-label="Liiiraa Boost"
    className="public-brand"
    href={publicBoundaryHref('public-home', locale)}
  >
    <ProductLockup />
  </a>
);

export default async function PublicLocaleLayout({ children, params }: PublicLocaleLayoutProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const copy = COPY[locale];

  return (
    <html data-density="comfortable" lang={locale}>
      <body>
        <a className="public-skip-link" href="#main-content">
          {copy.skip}
        </a>

        <header className="public-header">
          <div className="public-header__bar">
            <Brand locale={locale} />

            <PublicNavigation copy={copy} locale={locale} />
          </div>
        </header>

        <main id="main-content" tabIndex={-1}>
          {children}
        </main>

        <footer className="public-footer">
          <div>
            <Brand locale={locale} />
            <p>{copy.brandDescription}</p>
          </div>
          <nav aria-label={copy.footerNavigation}>
            <a href={publicBoundaryHref('public-support', locale)}>
              {locale === 'pt-BR' ? 'Suporte' : 'Support'}
            </a>
            <a href={publicBoundaryHref('public-status', locale)}>
              {locale === 'pt-BR' ? 'Status' : 'Status'}
            </a>
            <a href={publicBoundaryHref('public-privacy-policy', locale)}>
              {locale === 'pt-BR' ? 'Privacidade' : 'Privacy'}
            </a>
            <a href={publicBoundaryHref('public-responsible-disclosure', locale)}>
              {locale === 'pt-BR' ? 'Divulgação responsável' : 'Responsible disclosure'}
            </a>
          </nav>
          <a className="public-account-link" href={accountBoundaryHref(locale)}>
            {copy.account}
            <span aria-hidden="true">↗</span>
          </a>
        </footer>
      </body>
    </html>
  );
}
