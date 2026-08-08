import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { projectNavigation } from '@liiiraa/web-core';
import { ACCOUNT_WEB_COMPOSITION, accountWebComposition } from './index';
import {
  accountFailureLocale,
  createAccountFailureModel,
  redactedAccountCorrelationId,
} from './account-errors';
import {
  ACCOUNT_ENTRY_ROUTE_IDS,
  ACCOUNT_ERROR_ROUTE_IDS,
  ACCOUNT_GOAL_ROUTE_IDS,
  accountGoalForRoute,
  accountFailureKindForRoute,
  getAccountGoalNavigation,
  isAccountErrorRoute,
} from './account-preview-model';

describe('account shell', () => {
  it('keeps downloads as a permanent account goal while secondary routes stay contextual', () => {
    expect(ACCOUNT_GOAL_ROUTE_IDS).toEqual([
      'account-overview',
      'account-device',
      'account-downloads',
      'account-subscription',
      'account-security',
      'account-support',
    ]);
    expect(getAccountGoalNavigation('pt-BR').map(({ label }) => label)).toEqual([
      'Início',
      'PCs e licenças',
      'Downloads',
      'Plano e pagamentos',
      'Segurança e privacidade',
      'Ajuda',
    ]);
    expect(getAccountGoalNavigation('en').map(({ label }) => label)).toEqual([
      'Home',
      'PCs and licenses',
      'Downloads',
      'Plan and payments',
      'Security and privacy',
      'Help',
    ]);
    expect(accountGoalForRoute('account-profile')).toBe('account-overview');
    expect(accountGoalForRoute('account-invoices')).toBe('account-subscription');
    expect(accountGoalForRoute('account-downloads')).toBe('account-downloads');
    expect(accountGoalForRoute('account-privacy')).toBe('account-security');
    expect(ACCOUNT_ENTRY_ROUTE_IDS).toEqual(
      expect.arrayContaining([
        'account-profile',
        'account-invoices',
        'account-downloads',
        'account-privacy',
      ]),
    );
  });

  it('uses the goal projection for desktop and compact navigation without public auth prompts', () => {
    const navigationSource = readFileSync(
      new URL('./account-navigation.tsx', import.meta.url),
      'utf8',
    );
    const styles = readFileSync(new URL('./app/account-shell.css', import.meta.url), 'utf8');

    expect(navigationSource).toContain('getAccountGoalNavigation(locale)');
    expect(navigationSource).toContain('accountGoalForRoute');
    expect(navigationSource).toContain('goalGroups');
    expect(navigationSource).toContain("icon === 'profile'");
    expect(navigationSource).not.toContain("icon === 'profile' || icon === 'shield'");
    expect(navigationSource).toContain('className="account-nav account-nav__mobile"');
    expect(navigationSource).toContain('markCurrent={false}');
    expect(navigationSource).not.toMatch(/create account|sign up|criar conta/iu);
    expect(styles).toContain('overflow-x: clip');
    expect(styles).not.toContain('100vw');
  });

  it('uses the approved workspace, persistent sidebar, and inspector geometry', () => {
    const styles = readFileSync(new URL('./app/account-shell.css', import.meta.url), 'utf8');

    expect(styles).toMatch(
      /\.account-app-shell\s*\{[\s\S]*grid-template-columns:\s*248px minmax\(0, 1fr\) 320px[\s\S]*grid-template-rows:\s*64px/u,
    );
    expect(styles).toMatch(
      /\.account-sidebar\s*\{[\s\S]*grid-column:\s*1[\s\S]*min-block-size:\s*100dvh/u,
    );
    expect(styles).toMatch(/\.account-workspace\s*\{[\s\S]*grid-column:\s*2[\s\S]*grid-row:\s*2/u);
    expect(styles).toMatch(/\.account-inspector\s*\{[\s\S]*grid-column:\s*3[\s\S]*grid-row:\s*2/u);
    expect(styles).not.toMatch(/\.account-inspector\s*\{[^}]*overflow-y:\s*auto/u);
    expect(styles).not.toMatch(/\.account-sidebar \.account-nav\s*\{[^}]*overflow-y:\s*auto/u);
    expect(styles).toMatch(/html\s*\{[^}]*overflow-x:\s*clip/u);
    expect(styles).toMatch(/\.account-preview-slot\s*\{[\s\S]*padding:/u);
    expect(styles).toMatch(/\.account-app-shell\s*\{[\s\S]*inline-size:\s*100%/u);
    expect(styles).not.toMatch(
      /\.account-app-shell\s*\{[^}]*inline-size:\s*min\(100%,\s*1760px\)/u,
    );
    expect(styles).not.toMatch(/\.account-app-shell\s*\{[^}]*margin-inline:\s*auto/u);
  });

  it('keeps one compact utility topbar with route context, help, and visible locale control', () => {
    const layoutSource = readFileSync(
      new URL('./app/[locale]/layout.tsx', import.meta.url),
      'utf8',
    );
    const productLockupSource = readFileSync(
      new URL('./account-product-lockup.tsx', import.meta.url),
      'utf8',
    );
    const navigationSource = readFileSync(
      new URL('./account-navigation.tsx', import.meta.url),
      'utf8',
    );

    expect(layoutSource).toContain('<ProductLockup />');
    expect(layoutSource).toContain("from '../../account-product-lockup'");
    expect(layoutSource).not.toContain('packages/design-system/src');
    expect(productLockupSource).toContain("'use client'");
    expect(productLockupSource).toContain("from '@liiiraa/design-system'");
    expect(productLockupSource).toContain('<DesignSystemProductLockup />');
    expect(layoutSource).toContain(
      '<span className="account-brand__surface">{copy.surface}</span>',
    );
    expect(layoutSource).toContain('<AccountIdentityChrome');
    expect(layoutSource).not.toContain('Astra Player');
    expect(navigationSource).toContain('account-header__route');
    expect(navigationSource).toContain('account-header__support');
    expect(navigationSource).toContain('href={supportHref as Route}');
    expect(navigationSource).toContain("import Link from 'next/link'");
    expect(navigationSource).toContain('<LocaleSwitcher');
    expect(navigationSource).toContain('sourceLocale={locale}');
    expect(navigationSource).toContain('targetLocale={alternateLocale}');
    expect(navigationSource).not.toContain('account-header__fragment');
  });

  it('gives every responsibility an icon and the current route a full-surface selection', () => {
    const navigationSource = readFileSync(
      new URL('./account-navigation.tsx', import.meta.url),
      'utf8',
    );
    const styles = readFileSync(new URL('./app/account-shell.css', import.meta.url), 'utf8');

    expect(navigationSource).toContain('<ResponsibilityIcon');
    expect(navigationSource).toContain("aria-current={isCurrent ? 'page' : undefined}");
    expect(styles).toMatch(
      /\.account-nav__list a\[aria-current='page'\]\s*\{[\s\S]*background:\s*var\(--lb-surface-raised\)/u,
    );
    expect(styles).not.toContain(".account-nav__list a[aria-current='page']::before");
    expect(styles).toMatch(
      /\.account-nav__list a:not\(\[aria-current='page'\]\)\s*\{[\s\S]*color:\s*var\(--lb-text-secondary\)/u,
    );
  });

  it('uses customer account metadata without implementation vocabulary or a preview rail', () => {
    const layoutSource = readFileSync(
      new URL('./app/[locale]/layout.tsx', import.meta.url),
      'utf8',
    );
    const pageSource = readFileSync(
      new URL('./app/[locale]/[[...responsibility]]/page.tsx', import.meta.url),
      'utf8',
    );

    expect(layoutSource).not.toContain('previewLabel:');
    expect(layoutSource).not.toContain('account-preview-rail');
    expect(layoutSource).toContain(
      'Sua conta reúne plano, segurança, dispositivo, downloads e suporte.',
    );
    expect(layoutSource).toContain(
      'Your account brings plan, security, device, downloads, and support together.',
    );
    expect(layoutSource).not.toMatch(/phase|fixture|adapter|manifest/iu);
    expect(layoutSource).toContain('robots:');
    expect(pageSource).not.toContain('robots:');
  });

  it('marks exactly the pathname-matched responsibility as the current page', () => {
    const navigationUrl = new URL('./account-navigation.tsx', import.meta.url);
    expect(existsSync(navigationUrl)).toBe(true);

    const navigationSource = existsSync(navigationUrl) ? readFileSync(navigationUrl, 'utf8') : '';
    expect(navigationSource).toContain("'use client'");
    expect(navigationSource).toContain('usePathname');
    expect(navigationSource).toContain('resolveLocalizedCurrentRoute');
    expect(navigationSource).toContain("securityBoundary: 'account-origin'");
    expect(navigationSource).toContain("aria-current={isCurrent ? 'page' : undefined}");
    expect(navigationSource).toContain("data-current={isCurrent ? 'page' : undefined}");
    expect(navigationSource).toContain('currentItems.length === 1');
    expect(navigationSource).toContain('<LocaleSwitcher');
  });

  it('gives sign-in and account creation canonical routes in a dedicated auth shell', () => {
    const layoutSource = readFileSync(
      new URL('./app/[locale]/layout.tsx', import.meta.url),
      'utf8',
    );
    const navigationSource = readFileSync(
      new URL('./account-navigation.tsx', import.meta.url),
      'utf8',
    );
    const styles = readFileSync(new URL('./app/account-shell.css', import.meta.url), 'utf8');

    expect(layoutSource).toContain("signIn: 'Entrar'");
    expect(layoutSource).toContain("signIn: 'Sign in'");
    expect(layoutSource).toContain("signUp: 'Criar conta'");
    expect(layoutSource).toContain("signUp: 'Create account'");
    expect(layoutSource).toContain("localizedAuthHref('account-sign-in', locale)");
    expect(layoutSource).toContain("localizedAuthHref('account-sign-up', locale)");
    expect(layoutSource).toContain('authRouteItems={authRouteItems}');
    expect(layoutSource).toContain('authenticatedAction={authenticatedAction}');
    expect(layoutSource).toContain("icon: 'logout'");
    expect(layoutSource).toContain("signOut: 'Sair'");
    expect(layoutSource).toContain("signOut: 'Sign out'");
    expect(navigationSource).toContain('authRouteItems: readonly AccountNavigationItem[]');
    expect(navigationSource).toContain('authenticatedAction: AccountNavigationItem');
    expect(navigationSource).toContain(
      'const allItems = [...authRouteItems, ...responsibilityItems]',
    );
    expect(navigationSource).toContain('const isAuthRoute = currentAuthRouteItems.length === 1');
    expect(navigationSource).toContain('className="account-auth-shell"');
    expect(navigationSource).toContain('className="account-auth-shell__main"');
    expect(navigationSource).toContain('groups={[{ items: [authenticatedAction] }]}');
    expect(navigationSource).not.toContain('groups={[{ items: authRouteItems }]}');
    expect(navigationSource.match(/aria-current=/gu) ?? []).toHaveLength(1);
    expect(styles).toMatch(
      /\.account-auth-shell\s*\{[\s\S]*min-block-size:\s*100dvh[\s\S]*inline-size:\s*100%/u,
    );
    expect(layoutSource).toContain('<AccountIdentityChrome');
    expect(layoutSource).not.toContain('astra.player@example.com');
  });

  it('uses explicit Phosphor semantics for every authenticated responsibility', () => {
    const layoutSource = readFileSync(
      new URL('./app/[locale]/layout.tsx', import.meta.url),
      'utf8',
    );
    const navigationSource = readFileSync(
      new URL('./account-navigation.tsx', import.meta.url),
      'utf8',
    );

    expect(layoutSource).toContain("'account-overview': 'gauge'");
    expect(layoutSource).toContain("'account-profile': 'profile'");
    expect(layoutSource).toContain("'account-security': 'shield'");
    expect(layoutSource).toContain("'account-subscription': 'crown'");
    expect(layoutSource).toContain("'account-invoices': 'receipt'");
    expect(layoutSource).toContain("'account-device': 'device'");
    expect(layoutSource).toContain("'account-downloads': 'download'");
    expect(layoutSource).toContain("'account-privacy': 'lock'");
    expect(layoutSource).toContain("'account-support': 'lifebuoy'");
    expect(navigationSource).toContain('<ProductIcon name="lifebuoy" size={18} />');
    expect(layoutSource).not.toContain("icon: 'sparkle'");
  });

  it('publishes the official brand favicon for every account route', () => {
    const iconUrl = new URL('./app/icon.svg', import.meta.url);

    expect(existsSync(iconUrl)).toBe(true);
    if (!existsSync(iconUrl)) return;

    const icon = readFileSync(iconUrl, 'utf8');
    expect(icon).toContain('aria-label="Liiiraa Boost"');
    expect(icon).toContain('M2 25.5 10.6 2h7.2l-5.7 15.2h9.2l-7.1 8.3H2Z');
    expect(icon).toContain('m20.7 7.2 10.3 7-10.3 7 3-3.7 4.8-3.3-4.8-3.3-3-3.7Z');
  });

  it('collapses the sidebar and reflows the inspector below the task on narrower screens', () => {
    const navigationSource = readFileSync(
      new URL('./account-navigation.tsx', import.meta.url),
      'utf8',
    );
    const styles = readFileSync(new URL('./app/account-shell.css', import.meta.url), 'utf8');

    expect(navigationSource).toContain('account-nav__desktop');
    expect(navigationSource).toContain('account-nav__mobile');
    expect(navigationSource).toContain('<details');
    expect(navigationSource).toContain('<summary>');
    expect(navigationSource).toContain('{currentLabel}');
    expect(styles).toMatch(/\.account-nav__mobile\s*\{[\s\S]*display:\s*none/u);
    expect(styles).toMatch(
      /@media \(width < 1180px\)[\s\S]*\.account-sidebar\s*\{[\s\S]*display:\s*none/u,
    );
    expect(styles).toMatch(
      /@media \(width < 1180px\)[\s\S]*\.account-nav__mobile\s*\{[\s\S]*display:\s*block/u,
    );
    expect(styles).toMatch(
      /@media \(width < 1180px\)[\s\S]*\.account-inspector\s*\{[\s\S]*grid-row:\s*3[\s\S]*\.account-inspector__disclosure:not\(\[open\]\) > \.account-inspector__body\s*\{[\s\S]*display:\s*none/u,
    );
    expect(styles).not.toMatch(
      /@media \(width < 960px\)[\s\S]*\.account-nav__list\s*\{[\s\S]*flex-wrap:\s*wrap/u,
    );
  });

  it('renders closed native disclosures for mobile navigation and the contextual inspector', () => {
    const navigationSource = readFileSync(
      new URL('./account-navigation.tsx', import.meta.url),
      'utf8',
    );
    const styles = readFileSync(new URL('./app/account-shell.css', import.meta.url), 'utf8');

    expect(navigationSource.match(/<details\b/gu) ?? []).toHaveLength(3);
    expect(navigationSource).toContain('className="account-header__account"');
    expect(navigationSource).toContain("window.matchMedia('(min-width: 1180px)')");
    expect(navigationSource).toContain('inspectorDisclosureRef.current.open = wideShell.matches');
    expect(navigationSource).toContain('<strong>{currentLabel}</strong>');
    expect(navigationSource).toContain('className="account-inspector__disclosure"');
    expect(navigationSource).toContain('<span>{inspectorLabel}</span>');
    expect(styles).toMatch(
      /@media \(width < 960px\)[\s\S]*\.account-nav__desktop\s*\{[\s\S]*display:\s*none[\s\S]*\.account-nav__mobile summary\s*\{[\s\S]*min-block-size:\s*48px/u,
    );
  });

  it('opens the native disclosure to every customer goal while retaining one current page', () => {
    const navigationSource = readFileSync(
      new URL('./account-navigation.tsx', import.meta.url),
      'utf8',
    );

    expect(navigationSource).toContain('<details className="account-nav account-nav__mobile">');
    expect(navigationSource).toContain('<nav aria-label={label}>');
    expect(navigationSource).toContain('groups={goalGroups}');
    expect(navigationSource).toContain('markCurrent={false}');
    expect(navigationSource.match(/aria-current=/gu) ?? []).toHaveLength(1);
    expect(navigationSource).not.toMatch(/onKeyDown|onClick|role="button"/u);
  });

  it('reflows at 320px with compact utilities and no page overflow', () => {
    const styles = readFileSync(new URL('./app/account-shell.css', import.meta.url), 'utf8');

    expect(styles).toContain('overflow-x: clip');
    expect(styles).toMatch(
      /@media \(width < 760px\)[\s\S]*\.account-header__route,[\s\S]*\.account-header__support span\s*\{[\s\S]*display:\s*none/u,
    );
    expect(styles).toMatch(
      /@media \(width < 960px\)[\s\S]*\.account-nav__mobile\s*\{[\s\S]*min-inline-size:\s*0/u,
    );
    expect(styles).toMatch(
      /@media \(width < 360px\)[\s\S]*\.account-header__mobile-brand \.lb-product-wordmark\s*\{[\s\S]*display:\s*none/u,
    );
    expect(styles).not.toContain('100vw');
  });

  it('groups navigation by responsibility without collapsing route labels into group labels', () => {
    const layoutSource = readFileSync(
      new URL('./app/[locale]/layout.tsx', import.meta.url),
      'utf8',
    );

    expect(layoutSource).toContain(
      "ids: ['account-overview', 'account-profile', 'account-security']",
    );
    expect(layoutSource).toContain("ids: ['account-subscription', 'account-invoices']");
    expect(layoutSource).toContain("ids: ['account-device', 'account-downloads']");
    expect(layoutSource).toContain("ids: ['account-privacy', 'account-support']");
    expect(layoutSource).toContain('label: NAVIGATION_LABELS[routeId][locale]');
  });

  it('keeps avatar initials readable against the cobalt identity surface', () => {
    const styles = readFileSync(new URL('./app/account-shell.css', import.meta.url), 'utf8');

    expect(styles).toMatch(
      /\.account-identity__avatar\s*\{[\s\S]*color:\s*var\(--lb-surface-canvas\)[\s\S]*background:\s*var\(--lb-cobalt-action\)/u,
    );
  });

  it('maps avatar initials to system colors in Windows forced-colors mode', () => {
    const styles = readFileSync(new URL('./app/account-shell.css', import.meta.url), 'utf8');

    expect(styles).toMatch(
      /@media \(forced-colors: active\)[\s\S]*\.account-identity__avatar\s*\{[\s\S]*color:\s*ButtonText[\s\S]*background:\s*ButtonFace/u,
    );
  });

  it('wraps the complete preview status at 320px and 400% text reflow', () => {
    const styles = readFileSync(new URL('./app/account-shell.css', import.meta.url), 'utf8');

    expect(styles).toMatch(
      /@media \(width < 760px\)[\s\S]*\.account-preview-rail \.lb-status-mark\s*\{[\s\S]*flex-wrap:\s*wrap[\s\S]*min-inline-size:\s*0/u,
    );
    expect(styles).toMatch(
      /@media \(width < 760px\)[\s\S]*\.account-preview-rail \.lb-status-detail\s*\{[\s\S]*min-inline-size:\s*0[\s\S]*overflow:\s*visible[\s\S]*overflow-wrap:\s*anywhere[\s\S]*text-overflow:\s*clip[\s\S]*white-space:\s*normal/u,
    );
    expect(styles).toMatch(
      /@media \(width < 960px\)[\s\S]*\.account-nav__mobile summary\s*\{[\s\S]*min-block-size:\s*48px/u,
    );
    expect(styles).toContain('overflow-x: clip');
  });

  it('preserves the canonical account route when switching locale on mobile', () => {
    const navigationSource = readFileSync(
      new URL('./account-navigation.tsx', import.meta.url),
      'utf8',
    );

    expect(navigationSource.match(/resolveLocalizedCurrentRoute\(\{/gu) ?? []).toHaveLength(2);
    expect(navigationSource).toContain("securityBoundary: 'account-origin'");
    expect(navigationSource).toContain('targetLocale: alternateLocale');
    expect(navigationSource).toContain('localizedAlternateRoute.ok');
    expect(navigationSource).toContain(': fallbackLocaleHref');
  });

  it('keeps the topbar contextual, bilingual, and signed in without a public auth prompt', () => {
    const layoutSource = readFileSync(
      new URL('./app/[locale]/layout.tsx', import.meta.url),
      'utf8',
    );
    const navigationSource = readFileSync(
      new URL('./account-navigation.tsx', import.meta.url),
      'utf8',
    );
    const inspectorSource = readFileSync(
      new URL('./account-inspector.tsx', import.meta.url),
      'utf8',
    );

    expect(layoutSource).toContain('inspectorLabel={copy.inspectorLabel}');
    expect(layoutSource).toContain('<AccountAuthorityInspector');
    expect(inspectorSource).not.toContain('account-inspector__account');
    expect(inspectorSource).toContain('account-inspector__machine');
    expect(navigationSource).toContain('account-header__route');
    expect(navigationSource).toContain('aria-label={inspectorLabel}');
    expect(layoutSource).not.toContain('data-authority="disconnected"');
    expect(layoutSource).not.toContain('<AccountPreviewProvenance');
    expect(navigationSource).toContain('className="account-header__account"');
    expect(navigationSource).toContain('sourceLocale={locale}');
    expect(navigationSource).toContain('targetLocale={alternateLocale}');
    expect(navigationSource).toContain('resolveLocalizedCurrentRoute({');
    expect(navigationSource).toContain('fallbackLocaleHref');
  });

  it('projects every canonical account responsibility without persistent preview chrome', () => {
    const layoutSource = readFileSync(
      new URL('./app/[locale]/layout.tsx', import.meta.url),
      'utf8',
    );
    const styles = readFileSync(new URL('./app/account-shell.css', import.meta.url), 'utf8');
    const routeIds = projectNavigation('account').map(({ id }) => id);

    expect(routeIds).toEqual([
      'account-overview',
      'account-profile',
      'account-security',
      'account-subscription',
      'account-invoices',
      'account-device',
      'account-downloads',
      'account-privacy',
      'account-support',
    ]);
    expect(ACCOUNT_WEB_COMPOSITION).toMatchObject({
      authorityConnected: true,
      runtimeClass: 'server-authority',
      surface: 'account',
    });
    expect(accountWebComposition('preview')).toMatchObject({
      authorityConnected: false,
      runtimeClass: 'fixture',
      surface: 'account',
    });
    const navigationSource = readFileSync(
      new URL('./account-navigation.tsx', import.meta.url),
      'utf8',
    );
    expect(layoutSource.match(/<main\b/gu) ?? []).toHaveLength(0);
    expect(navigationSource.match(/<main\b/gu) ?? []).toHaveLength(2);
    expect(navigationSource).toContain('if (isAuthRoute)');
    expect(layoutSource).toContain('href="#account-main"');
    expect(layoutSource).not.toContain('account-preview-rail');
    expect(layoutSource).not.toContain('data-authority="disconnected"');
    expect(layoutSource).toContain('ACCOUNT_WEB_COMPOSITION');
    expect(layoutSource).toContain('ProductLockup');
    expect(layoutSource).toContain('<AccountNavigation');
    expect(layoutSource).not.toContain('account-header__origin');
    expect(layoutSource).not.toContain('copy.footer');
    expect(layoutSource).not.toContain('<AccountPreviewProvenance');
    for (const routeId of routeIds) {
      expect(layoutSource).toContain(routeId);
    }
    expect(styles).toMatch(/\.account-app-shell\s*\{[\s\S]*inline-size:\s*100%/u);
    expect(styles).toContain('overflow-x: clip');
    expect(styles).toMatch(/@media \(width < 960px\)[\s\S]*account-nav__mobile/u);
    expect(styles).not.toContain('grid-auto-flow: column');
    expect(styles).not.toContain('overflow-x: auto');
    expect(styles).toContain('@media (forced-colors: active)');
    expect(styles).toContain('min-block-size: 44px');
    expect(styles).toContain("a[aria-current='page']");
    expect(styles).not.toMatch(/account-nav[\s\S]*icon-only/iu);
  });
});

describe('account errors', () => {
  it('maps the closed canonical error route set one-to-one without changing responsibilities', () => {
    expect(ACCOUNT_ERROR_ROUTE_IDS).toEqual([
      'account-error-404',
      'account-error-403',
      'account-error-410',
      'account-error-500',
    ]);
    expect(
      ACCOUNT_ERROR_ROUTE_IDS.map((routeId) => [
        routeId,
        isAccountErrorRoute(routeId),
        accountFailureKindForRoute(routeId),
      ]),
    ).toEqual([
      ['account-error-404', true, '404'],
      ['account-error-403', true, '403'],
      ['account-error-410', true, '410'],
      ['account-error-500', true, '500'],
    ]);
    expect(isAccountErrorRoute('account-security')).toBe(false);
    expect(ACCOUNT_ENTRY_ROUTE_IDS).toEqual([
      'account-sign-in',
      'account-sign-up',
      'account-onboarding',
      'account-overview',
      'account-profile',
      'account-security',
      'account-subscription',
      'account-invoices',
      'account-device',
      'account-downloads',
      'account-privacy',
      'account-support',
    ]);
  });

  it('authors distinct bilingual outcomes with safe same-origin recovery for every status', () => {
    const kinds = ['403', '404', '410', '500'] as const;

    for (const locale of ['pt-BR', 'en'] as const) {
      const outcomes = kinds.map((kind) => createAccountFailureModel(kind, locale));

      expect(new Set(outcomes.map(({ code }) => code)).size).toBe(4);
      expect(new Set(outcomes.map(({ copy }) => copy.title)).size).toBe(4);
      for (const outcome of outcomes) {
        expect(outcome.copy.affectedCapability.length).toBeGreaterThan(0);
        expect(outcome.copy.detail.length).toBeGreaterThan(0);
        expect(outcome.copy.safeWork.length).toBeGreaterThan(0);
        expect(outcome.copy.recovery.length).toBeGreaterThan(0);
        expect(outcome.destinations.overview).toBe(`/${locale}/account`);
        expect(outcome.destinations.support).toBe(`/${locale}/account/support`);
      }
    }

    expect(createAccountFailureModel('403', 'en').copy.detail).toMatch(
      /permission|responsibility/iu,
    );
    expect(createAccountFailureModel('410', 'en').copy.detail).toMatch(/historical|no longer/iu);
    expect(createAccountFailureModel('410', 'pt-BR').copy.recovery).toMatch(
      /vis[aã]o geral|suporte/iu,
    );
    expect(createAccountFailureModel('500', 'en').copy.recovery).toMatch(/try again|support/iu);
    expect(createAccountFailureModel('404', 'en').copy.detail).toMatch(/address|route/iu);
  });

  it('preserves locale, redacts diagnostics, and offers explicit safe recovery', () => {
    const portuguese = createAccountFailureModel('404', 'pt-BR');
    const english = createAccountFailureModel('500', 'en', 'opaque_42');
    const rejected = redactedAccountCorrelationId(
      '500',
      'user@example.com stack at C:\\private\\secret.ts',
    );
    const errorSource = readFileSync(new URL('./app/[locale]/error.tsx', import.meta.url), 'utf8');
    const pageSource = readFileSync(
      new URL('./app/[locale]/[[...responsibility]]/page.tsx', import.meta.url),
      'utf8',
    );
    const proxySource = readFileSync(new URL('../proxy.ts', import.meta.url), 'utf8');
    const layoutSource = readFileSync(
      new URL('./app/[locale]/layout.tsx', import.meta.url),
      'utf8',
    );

    expect(portuguese.destinations.overview).toBe('/pt-BR/account');
    expect(portuguese.destinations.support).toBe('/pt-BR/account/support');
    expect(english.destinations.support).toBe('/en/account/support');
    expect(english.correlationId).toBe('LB-A500-opaque_42');
    expect(rejected).toBe('LB-A500-REDACTED');
    expect(redactedAccountCorrelationId('500', 'stack at /srv/account/private.ts')).toBe(
      'LB-A500-REDACTED',
    );
    expect(redactedAccountCorrelationId('500', '{"request":"profile"}')).toBe('LB-A500-REDACTED');
    expect(redactedAccountCorrelationId('500', 'arbitrary diagnostic text')).toBe(
      'LB-A500-REDACTED',
    );
    expect(accountFailureLocale('fr')).toBe('pt-BR');
    expect(errorSource).toContain('role="alert"');
    expect(errorSource).toContain('onClick={reset}');
    expect(errorSource).not.toMatch(/error\.(message|stack|name)/u);
    expect(errorSource).not.toMatch(/redirect\(|window\.location|http-equiv=.refresh/iu);
    expect(pageSource).toContain("resolution.kind === 'unknown' ? '404'");
    expect(pageSource).not.toMatch(/redirect\(/u);
    expect(proxySource).toContain("requestHeaders.set('x-liiiraa-account-failure-kind', '404')");
    expect(proxySource).toContain('isNotFound ? { status: 404 }');
    expect(layoutSource).toContain('x-liiiraa-account-failure-kind');
    expect(layoutSource).toContain("createAccountFailureModel('404', locale)");
  });

  it('dispatches canonical failures before the genuine localized 404 fallback', () => {
    const pageSource = readFileSync(
      new URL('./app/[locale]/[[...responsibility]]/page.tsx', import.meta.url),
      'utf8',
    );
    const failureViewSource = readFileSync(
      new URL('./account-failure-view.tsx', import.meta.url),
      'utf8',
    );

    expect(pageSource).toContain("kind: 'workflow'");
    expect(pageSource).toContain("kind: 'error'");
    expect(pageSource).toContain("kind: 'unknown'");
    expect(pageSource).toContain('isAccountRoute');
    expect(pageSource).not.toContain('account-preview-model');
    expect(pageSource).toContain('isAccountErrorRoute');
    expect(pageSource).toContain('accountFailureKindForRoute');
    expect(pageSource).toContain('createAccountFailureModel');
    expect(pageSource).toContain('<AccountFailureView');
    expect(pageSource).toContain("failureKind === '500'");
    expect(pageSource).toContain("resolution.kind === 'unknown' ? '404'");
    expect(pageSource).not.toMatch(/redirect\(|cookies\(|fetch\(|window\.location/iu);

    expect(failureViewSource.match(/<h1\b/gu) ?? []).toHaveLength(1);
    expect(failureViewSource).toContain('data-route-heading');
    expect(failureViewSource).toContain("role={kind === '500' ? 'alert' : undefined}");
    expect(failureViewSource).toContain('account-failure__affected');
    expect(failureViewSource).toContain('account-failure__detail');
    expect(failureViewSource).toContain('account-failure__recovery');
    expect(failureViewSource).toContain('account-failure__safe-work');
    expect(failureViewSource).toContain('account-failure__actions');
    expect(failureViewSource).toContain('Redacted correlation');
    expect(failureViewSource).not.toContain("'use client'");
  });
});
