import '@liiiraa/design-tokens/tokens.css';
import '../public-shell.css';
import '../../styles/public.css';
import '../../styles/home.css';

import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { publicBoundaryHref, routing } from '../../public-boundary';
import {
  PublicFooter,
  type PublicFooterCopy,
  PublicNavigation,
  type PublicNavigationCopy,
} from '../../public-navigation';
import { ProductLockup } from '../../public-product-lockup';

type PublicLocaleLayoutProps = Readonly<{
  children: ReactNode;
  params: Promise<{ locale: string }>;
}>;

type PublicCopy = PublicFooterCopy &
  PublicNavigationCopy &
  Readonly<{
    brandDescription: string;
    skip: string;
  }>;

const COPY = Object.freeze({
  'pt-BR': Object.freeze({
    brandDescription: 'Otimização de jogos explicável, mensurável e reversível para Windows.',
    copyright: '© Liiiraa Boost · Web v1.0.0',
    current: 'página atual',
    cta: 'Baixar grátis',
    download: 'Baixar grátis',
    footerNavigation: 'Navegação de produto, recursos, empresa e confiança',
    groupLabels: Object.freeze({
      company: 'Empresa',
      legal: 'Legal',
      product: 'Produto',
      resources: 'Recursos',
    }),
    linkLabels: Object.freeze({
      about: 'Nossa história',
      contact: 'Contato',
      documentation: 'Documentação',
      download: 'Download',
      'essential-storage': 'Armazenamento essencial',
      help: 'Ajuda',
      'how-it-works': 'Como funciona',
      plans: 'Planos',
      principles: 'Princípios',
      privacy: 'Privacidade',
      releases: 'Versões',
      'responsible-disclosure': 'Divulgação responsável',
      results: 'Resultados',
      security: 'Segurança',
      status: 'Status',
      terms: 'Termos',
      'your-pc': 'Seu PC',
    }),
    menu: 'Menu',
    navigation: Object.freeze({
      'public-compatibility': 'Seu PC',
      'public-download': 'Download',
      'public-results': 'Resultados',
      'public-plans': 'Planos',
      'public-product': 'Como funciona',
      'public-support': 'Ajuda',
    }),
    primaryNavigation: 'Navegação principal',
    promise: 'Prepare seu PC. Prove o resultado. Restaure com controle.',
    search: 'Pesquisar',
    skip: 'Ir para o conteúdo principal',
  }),
  en: Object.freeze({
    brandDescription: 'Explainable, measurable, reversible Windows gaming optimization.',
    copyright: '© Liiiraa Boost · Web v1.0.0',
    current: 'current page',
    cta: 'Download free',
    download: 'Download free',
    footerNavigation: 'Product, resources, company, and trust navigation',
    groupLabels: Object.freeze({
      company: 'Company',
      legal: 'Legal',
      product: 'Product',
      resources: 'Resources',
    }),
    linkLabels: Object.freeze({
      about: 'Our story',
      contact: 'Contact',
      documentation: 'Documentation',
      download: 'Download',
      'essential-storage': 'Essential storage',
      help: 'Help',
      'how-it-works': 'How it works',
      plans: 'Plans',
      principles: 'Principles',
      privacy: 'Privacy',
      releases: 'Releases',
      'responsible-disclosure': 'Responsible disclosure',
      results: 'Results',
      security: 'Security',
      status: 'Status',
      terms: 'Terms',
      'your-pc': 'Your PC',
    }),
    menu: 'Menu',
    navigation: Object.freeze({
      'public-compatibility': 'Your PC',
      'public-download': 'Download',
      'public-results': 'Results',
      'public-plans': 'Plans',
      'public-product': 'How it works',
      'public-support': 'Help',
    }),
    primaryNavigation: 'Primary navigation',
    promise: 'Prepare your PC. Prove the result. Restore with control.',
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

        <PublicFooter copy={copy} locale={locale} />
      </body>
    </html>
  );
}
