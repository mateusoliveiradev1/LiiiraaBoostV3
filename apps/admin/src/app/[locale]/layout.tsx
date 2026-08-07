import '@liiiraa/design-tokens/tokens.css';
import '../admin-shell.css';

import { routeHref, WEB_LOCALES, type WebLocale, type WebRouteId } from '@liiiraa/web-core';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { AdminFocusHandoff } from '../../admin-focus-handoff';
import { AdminAuthorityProvider } from '../../features/admin-authority';
import { AdminNavigation } from '../../admin-navigation';
import { ProductLockup } from '../../admin-product-lockup';
import {
  ADMIN_ROLE_COPY,
  adminRoleFromHeader,
  projectAdminRoleNavigation,
} from '../../admin-shell';
import { adminWebComposition } from '../../index';
import { ADMIN_BROWSER_AUTHORITY_BASE_URL } from '../../admin-runtime';
import { resolveAdminServerRuntimeConfig } from '../../admin-runtime-server';

type AdminLocaleLayoutProps = Readonly<{
  children: ReactNode;
  params: Promise<{ locale: string }>;
}>;

const COPY = Object.freeze({
  'pt-BR': Object.freeze({
    accountLabel: 'Menu do operador',
    accountName: 'Operador seguro',
    alerts: 'Alertas de SLA',
    boundary: 'Origem administrativa dedicada. Cookies públicos e da conta não são aceitos.',
    currentQueue: 'Fila atual',
    environment: 'Prévia isolada',
    inbox: 'Caixa de entrada',
    isolated: 'Origem isolada e sem cookies públicos',
    jobs: 'Atividade e tarefas',
    navigation: 'Escopo da função',
    currentTask: 'Tarefa atual',
    roleHome: 'Área da função',
    savedViews: Object.freeze({
      assigned: 'Trabalho atribuído',
      'sla-risk': 'SLA em risco',
      unowned: 'Sem responsável',
      'all-permitted': 'Todos permitidos',
    }),
    searchAction: 'Buscar',
    searchLabel: 'Buscar casos, eventos e alvos permitidos',
    searchPlaceholder: 'Caso, evento ou alvo redigido',
    security: 'Sessão administrativa protegida',
    surface: 'Operações',
    skip: 'Ir para o conteúdo administrativo',
  }),
  en: Object.freeze({
    accountLabel: 'Operator menu',
    accountName: 'Secure operator',
    alerts: 'SLA alerts',
    boundary: 'Dedicated administrative origin. Public and account cookies are not accepted.',
    currentQueue: 'Current queue',
    environment: 'Isolated preview',
    inbox: 'Inbox',
    isolated: 'Isolated origin with no public cookies',
    jobs: 'Activity and jobs',
    navigation: 'Role scope',
    currentTask: 'Current task',
    roleHome: 'Role workspace',
    savedViews: Object.freeze({
      assigned: 'Assigned work',
      'sla-risk': 'SLA at risk',
      unowned: 'Unassigned',
      'all-permitted': 'All permitted',
    }),
    searchAction: 'Search',
    searchLabel: 'Search permitted cases, events, and targets',
    searchPlaceholder: 'Case, event, or redacted target',
    security: 'Protected administrative session',
    surface: 'Operations',
    skip: 'Skip to administrative content',
  }),
});

const localizedRoleHref = (locale: WebLocale, role: keyof typeof ADMIN_ROLE_COPY): string => {
  const result = routeHref('admin-role', { locale });

  if (!result.ok) {
    throw new Error('Canonical admin role route unavailable.');
  }

  return role === 'support' ? result.value : `${result.value}?role=${role}`;
};

const localizedAdminHref = (locale: WebLocale, routeId: WebRouteId): string => {
  const result = routeHref(routeId, { locale });
  if (!result.ok) throw new Error(`Canonical Admin route unavailable: ${routeId}`);
  return result.value;
};

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
  const runtime = resolveAdminServerRuntimeConfig();
  const copy = COPY[locale];

  if (runtime.kind === 'production') {
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
            accountOrigin={runtime.accountOrigin}
            authorityBaseUrl={ADMIN_BROWSER_AUTHORITY_BASE_URL}
            locale={locale}
          >
            {children}
          </AdminAuthorityProvider>
        </body>
      </html>
    );
  }

  const role = adminRoleFromHeader(requestHeaders.get('x-liiiraa-admin-role'));
  const alternateLocale: WebLocale = locale === 'pt-BR' ? 'en' : 'pt-BR';
  const navigation = projectAdminRoleNavigation(role, locale);
  const composition = adminWebComposition(runtime.kind);

  return (
    <html
      data-authoritative-access-connected={String(composition.authorityConnected)}
      data-ordinary-navigation-linked={String(composition.ordinaryNavigationLinked)}
      data-runtime-class={composition.runtimeClass}
      data-surface={composition.surface}
      lang={locale}
    >
      <head>{nonce === null ? null : <meta content={nonce} property="csp-nonce" />}</head>
      <body>
        <a className="admin-skip-link" href="#admin-main">
          {copy.skip}
        </a>

        <AdminNavigation
          accountLabel={copy.accountLabel}
          accountName={copy.accountName}
          actorId={`preview-${role}`}
          alertsLabel={copy.alerts}
          alternateLocale={alternateLocale}
          currentQueueLabel={copy.currentQueue}
          currentTaskLabel={copy.currentTask}
          environmentId="preview"
          environmentLabel={copy.environment}
          fallbackLocaleHref={localizedRoleHref(alternateLocale, role)}
          freshness="offline"
          header={
            <>
              <a className="admin-brand" href={localizedRoleHref(locale, role)}>
                <ProductLockup />
                <span className="admin-brand__surface">{copy.surface}</span>
              </a>
            </>
          }
          isolatedLabel={copy.isolated}
          items={navigation}
          inboxHref={localizedAdminHref(locale, 'admin-inbox')}
          inboxLabel={copy.inbox}
          jobsHref={localizedAdminHref(locale, 'admin-activity')}
          jobsLabel={copy.jobs}
          label={copy.navigation}
          locale={locale}
          previewRole={role}
          roleHomeHref={localizedRoleHref(locale, role)}
          roleHomeLabel={copy.roleHome}
          roleLabel={ADMIN_ROLE_COPY[role][locale]}
          savedViewLabels={copy.savedViews}
          searchAction={copy.searchAction}
          searchHref={localizedAdminHref(locale, 'admin-search')}
          searchLabel={copy.searchLabel}
          searchPlaceholder={copy.searchPlaceholder}
          securityLabel={copy.security}
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
