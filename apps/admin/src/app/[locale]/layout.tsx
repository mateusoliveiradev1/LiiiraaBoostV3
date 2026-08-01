import '@liiiraa/design-tokens/tokens.css';
import '../admin-shell.css';

import { routeHref, WEB_LOCALES, type WebLocale } from '@liiiraa/web-core';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { ProductLockup } from '../../../../../packages/design-system/src/product-lockup.tsx';

import { AdminFocusHandoff } from '../../admin-focus-handoff';
import { AdminNavigation } from '../../admin-navigation';
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
    mobile:
      'Revisão segura, triagem, casos e auditoria permanecem disponíveis. Ações de alto risco estão bloqueadas nesta viewport.',
    navigation: 'Escopo da função',
    currentTask: 'Tarefa atual',
    preview: 'Alterações remotas desconectadas',
    previewDetail:
      'Dados sintéticos sustentam esta revisão; esta prévia não pode alterar sistemas remotos.',
    previewLabel: 'Prévia administrativa',
    surface: 'Operações',
    skip: 'Ir para o conteúdo administrativo',
    viewport: 'Política de viewport',
  }),
  en: Object.freeze({
    boundary: 'Dedicated administrative origin. Public and account cookies are not accepted.',
    desktop: 'High-risk actions require a desktop-class viewport at least 960px wide.',
    mobile:
      'Safe review, triage, cases, and audit remain available. High-risk actions are blocked in this viewport.',
    navigation: 'Role scope',
    currentTask: 'Current task',
    preview: 'Remote changes disconnected',
    previewDetail:
      'Synthetic data supports this review; this preview cannot change remote systems.',
    previewLabel: 'Administrative preview',
    surface: 'Operations',
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

        <AdminNavigation
          alternateLocale={alternateLocale}
          currentTaskLabel={copy.currentTask}
          fallbackLocaleHref={localizedRoleHref(alternateLocale, role)}
          header={
            <>
              <a className="admin-brand" href={localizedRoleHref(locale, role)}>
                <ProductLockup />
                <span className="admin-brand__surface">{copy.surface}</span>
              </a>
              <div className="admin-header__role">
                <span>{locale === 'pt-BR' ? 'Função ativa' : 'Active role'}</span>
                <strong>{ADMIN_ROLE_COPY[role][locale]}</strong>
              </div>
              <p className="admin-header__origin" role="note">
                {copy.boundary}
              </p>
            </>
          }
          items={navigation}
          label={copy.navigation}
          locale={locale}
          preview={
            <aside
              aria-label={copy.previewLabel}
              className="admin-preview-band"
              data-authority="disconnected"
              data-preview-role={role}
              role="status"
            >
              <AdminPreviewProvenance detail={copy.previewLabel} locale={locale} />
              <strong>{copy.preview}</strong>
              <span className="admin-preview-band__detail">{copy.previewDetail}</span>
            </aside>
          }
          role={role}
          roleLabel={ADMIN_ROLE_COPY[role][locale]}
          viewportPolicy={
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
          }
        >
          <main id="admin-main" tabIndex={-1}>
            <AdminFocusHandoff />
            {children}
          </main>
        </AdminNavigation>
      </body>
    </html>
  );
}
