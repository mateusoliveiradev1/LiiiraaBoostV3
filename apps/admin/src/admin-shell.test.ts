import { existsSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  adminFailureLocale,
  createAdminFailureModel,
  redactedAdminCorrelationId,
} from './admin-errors';
import {
  ADMIN_ENTRY_ROUTE_IDS,
  ADMIN_ERROR_ROUTE_IDS,
  createAdminQueueHref,
  adminFailureKindForRoute,
  adminRoleCanAccess,
  isAdminErrorRoute,
  isAdminPreviewRoute,
  parseAdminQueueUrlState,
  searchAdminQueue,
} from './admin-preview-model';
import {
  ADMIN_DOMAIN_ORDER,
  adminRoleFromHeader,
  projectAdminDomainNavigation,
  projectAdminRoleNavigation,
} from './admin-shell';
import { ADMIN_WEB_COMPOSITION } from './index';

describe('admin shell', () => {
  it('publishes the official brand favicon from the root app boundary', () => {
    const iconUrl = new URL('./app/icon.svg', import.meta.url);

    expect(existsSync(iconUrl)).toBe(true);
    if (!existsSync(iconUrl)) return;

    const icon = readFileSync(iconUrl, 'utf8');
    expect(icon).toContain('aria-label="Liiiraa Boost"');
    expect(icon).toContain('M2 25.5 10.6 2h7.2l-5.7 15.2h9.2l-7.1 8.3H2Z');
  });

  it('enforces the approved expanded, compact, and mobile shell geometry', () => {
    const styles = readFileSync(new URL('./app/admin-shell.css', import.meta.url), 'utf8');
    const tokens = readFileSync(
      new URL('../../../packages/design-tokens/src/tokens.css', import.meta.url),
      'utf8',
    );

    expect(styles).toMatch(/\.admin-header__bar\s*\{[\s\S]*min-block-size:\s*52px/u);
    expect(styles).not.toContain('.admin-preview-band');
    expect(styles).toMatch(
      /\.admin-workspace\s*\{[\s\S]*grid-template-columns:\s*240px minmax\(0, 1fr\)/u,
    );
    expect(styles).toMatch(
      /\[data-sidebar-mode='compact'\] \.admin-workspace\s*\{[\s\S]*grid-template-columns:\s*72px minmax\(0, 1fr\)/u,
    );
    expect(styles).toMatch(
      /@media \(width <= 959px\)[\s\S]*\.admin-header__bar\s*\{[\s\S]*min-block-size:\s*56px/u,
    );
    expect(tokens).toMatch(/--lb-control-min-size:\s*44px;/u);
  });

  it('keeps operational identity, task, isolated session, role, and locale legible without preview chrome', () => {
    const layout = readFileSync(new URL('./app/[locale]/layout.tsx', import.meta.url), 'utf8');
    const navigation = readFileSync(new URL('./admin-navigation.tsx', import.meta.url), 'utf8');
    const productLockupUrl = new URL('./admin-product-lockup.tsx', import.meta.url);

    expect(existsSync(productLockupUrl)).toBe(true);
    if (!existsSync(productLockupUrl)) return;

    const productLockupSource = readFileSync(productLockupUrl, 'utf8');
    expect(layout).toContain('<ProductLockup />');
    expect(layout).toContain("from '../../admin-product-lockup'");
    expect(layout).not.toContain('packages/design-system/src');
    expect(productLockupSource).toContain("'use client'");
    expect(productLockupSource).toContain("from '@liiiraa/design-system'");
    expect(productLockupSource).toContain('<DesignSystemProductLockup />');
    expect(layout).toContain('admin-brand__surface');
    expect(navigation).toContain('admin-header__task');
    expect(navigation).toContain('admin-header__account');
    expect(navigation).toContain('<ProductIcon');
    expect(navigation).toContain('<LocaleSwitcher');
    expect(layout).toContain('isolatedLabel={copy.isolated}');
    expect(layout).not.toContain('AdminPreviewProvenance');
    expect(layout).not.toMatch(/>\s*(fixture|simulated-no-change)\s*</iu);
  });

  it('puts localized role-scoped search, queue view, alerts, and operator identity in the shell', () => {
    const layout = readFileSync(new URL('./app/[locale]/layout.tsx', import.meta.url), 'utf8');
    const navigation = readFileSync(new URL('./admin-navigation.tsx', import.meta.url), 'utf8');

    expect(layout).toContain('searchLabel={copy.searchLabel}');
    expect(layout).toContain('currentQueueLabel={copy.currentQueue}');
    expect(layout).toContain('alertsLabel={copy.alerts}');
    expect(navigation).toContain('className="admin-header__search"');
    expect(navigation).toContain('type="search"');
    expect(navigation).toContain('data-mobile-open={mobileSearchOpen || undefined}');
    expect(navigation).toContain('aria-expanded={mobileSearchOpen}');
    expect(navigation).toContain("window.matchMedia('(max-width: 959px)').matches");
    expect(navigation).toContain('aria-live="polite"');
    expect(navigation).toContain('{roleLabel}');
    expect(navigation).not.toMatch(/public navigation|account navigation/iu);
  });

  it('keeps the queue and account access inside the 959px and 320px reflow boundaries', () => {
    const styles = readFileSync(new URL('./app/admin-shell.css', import.meta.url), 'utf8');

    expect(styles).toMatch(
      /@media \(width <= 1100px\)[\s\S]*\.admin-queue__filters[\s\S]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/u,
    );
    expect(styles).toMatch(
      /@media \(width < 400px\)[\s\S]*\.admin-header__account\s*\{[\s\S]*display:\s*block/u,
    );
    expect(styles).toMatch(
      /@media \(width < 400px\)[\s\S]*\.admin-header__mobile-context\s*\{[\s\S]*min-inline-size:\s*0/u,
    );
    expect(styles).toMatch(
      /@media \(width < 400px\)[\s\S]*\.admin-header__account > summary\s*\{[\s\S]*min-inline-size:\s*44px[\s\S]*padding-inline:\s*0/u,
    );
    expect(styles).toMatch(
      /@media \(width < 400px\)[\s\S]*\.admin-header__account-chevron\s*\{[\s\S]*display:\s*none/u,
    );
    expect(styles).toMatch(
      /@media \(width < 400px\)[\s\S]*\.admin-header__bar\s*\{[\s\S]*display:\s*grid[\s\S]*grid-template-columns:\s*44px 44px minmax\(0, 1fr\) 44px 44px/u,
    );
    expect(styles).toMatch(
      /@media \(width < 400px\)[\s\S]*\.admin-header__tools\s*\{[\s\S]*margin-inline-start:\s*0/u,
    );
    expect(styles).toMatch(
      /@media \(width <= 959px\)[\s\S]*\.admin-header__mobile-context\s*\{[\s\S]*display:\s*grid/u,
    );
    expect(styles).toMatch(
      /@media \(width <= 959px\)[\s\S]*\.admin-shell-frame\[data-sidebar-mode='compact'\] \.admin-workspace\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)/u,
    );
    expect(styles).toMatch(
      /\.admin-header__search\[data-mobile-open='true'\][\s\S]*\.admin-header__search\[data-mobile-open='true'\] input\[type='search'\][\s\S]*display:\s*block/u,
    );
    expect(styles).toMatch(
      /\.admin-header__search > \.lb-product-icon,[\s\S]*\.admin-header__search input\[type='search'\][\s\S]*display:\s*none/u,
    );
    expect(styles).toContain(
      ".admin-header__search button > span:not(.lb-product-icon)",
    );
    expect(styles).not.toContain('.admin-header__search button > span {');
  });

  it('filters bounded global search by validated role before matching redacted records', () => {
    const supportOwn = searchAdminQueue({ locale: 'en', query: 'SUP-2048', role: 'support' });
    const supportDenied = searchAdminQueue({ locale: 'en', query: 'SEC-083', role: 'support' });
    const securityOwn = searchAdminQueue({ locale: 'en', query: 'SEC-083', role: 'security' });
    const unsafeDiagnostic = searchAdminQueue({
      locale: 'en',
      query: 'C:\\private\\memory.dmp user@example.com',
      role: 'support',
    });

    expect(supportOwn.map(({ id }) => id)).toEqual(['SUP-2048']);
    expect(supportDenied).toEqual([]);
    expect(securityOwn.map(({ id }) => id)).toContain('SEC-083');
    expect(unsafeDiagnostic).toEqual([]);
    expect(JSON.stringify(supportOwn)).not.toMatch(/correlation|diagnosticPayload|occurredAt/iu);
  });

  it('preserves only closed locale, role, query, saved-view, and filter navigation state', () => {
    const state = parseAdminQueueUrlState(
      new URLSearchParams(
        'q=SUP-2048&view=sla-risk&priority=high&status=attention&owner=mine&selected=SUP-2048&returnUrl=https://evil.example&diagnosticPayload=secret',
      ),
    );

    expect(state).toEqual({
      owner: 'mine',
      priority: 'high',
      query: 'SUP-2048',
      savedView: 'sla-risk',
      selectedId: 'SUP-2048',
      status: 'attention',
    });
    expect(createAdminQueueHref('/en/admin', 'support', state)).toBe(
      '/en/admin?q=SUP-2048&view=sla-risk&priority=high&status=attention&owner=mine&selected=SUP-2048',
    );

    const unsafe = parseAdminQueueUrlState(
      new URLSearchParams(
        'q=%00'.padEnd(140, 'x') +
          '&view=administrator&priority=urgent&status=all-data&owner=other&selected=../../audit',
      ),
    );
    expect(unsafe).toEqual({
      owner: 'all',
      priority: 'all',
      query: '',
      savedView: 'assigned',
      selectedId: undefined,
      status: 'all',
    });
  });

  it('owns one role-scoped current task and preserves only validated role context', () => {
    const navigation = readFileSync(new URL('./admin-navigation.tsx', import.meta.url), 'utf8');

    expect(navigation).toContain("'use client'");
    expect(navigation).toContain('usePathname');
    expect(navigation).toContain('useSearchParams');
    expect(navigation).toContain('resolveLocalizedCurrentRoute');
    expect(navigation).toContain("securityBoundary: 'admin-origin'");
    expect(navigation).toContain('createAdminShellHref(alternatePath, queueState, previewRole)');
    expect(navigation).toContain('items.find(');
    expect(navigation).toContain("aria-current={isCurrent ? 'page' : undefined}");
    expect(navigation).toContain('<LocaleSwitcher');
    expect(navigation).toContain('parseAdminQueueUrlState(searchParameters)');
  });

  it('uses a focus-trapped modal drawer below 960px', () => {
    const navigation = readFileSync(new URL('./admin-navigation.tsx', import.meta.url), 'utf8');
    const styles = readFileSync(new URL('./app/admin-shell.css', import.meta.url), 'utf8');

    expect(navigation).toContain('admin-nav__desktop');
    expect(navigation).toContain('<LbDialog');
    expect(navigation).toContain('<LbButton');
    expect(navigation).toContain('buttonRef={drawerTriggerRef}');
    expect(navigation).toContain('data-admin-drawer="true"');
    expect(navigation).toContain('drawerTriggerRef.current?.focus()');
    expect(navigation).toContain('preferenceKeyLoaded !== preferenceKey');
    expect(navigation).toContain('{currentLabel}');
    expect(styles).toMatch(
      /@media \(width <= 959px\)[\s\S]*\.admin-nav__desktop\s*\{[\s\S]*display:\s*none/u,
    );
    expect(styles).toMatch(
      /@media \(width <= 959px\)[\s\S]*\.admin-nav__drawer-trigger\s*\{[\s\S]*display:\s*inline-flex/u,
    );
  });

  it('keeps mobile targets at least 44px and preserves current-route semantics', () => {
    const navigation = readFileSync(new URL('./admin-navigation.tsx', import.meta.url), 'utf8');
    const styles = readFileSync(new URL('./app/admin-shell.css', import.meta.url), 'utf8');

    expect(navigation).toContain("aria-current={isCurrent ? 'page' : undefined}");
    expect(navigation.match(/aria-current=/gu)).toHaveLength(1);
    expect(styles).toMatch(
      /\.admin-nav__drawer-trigger,[\s\S]*min-block-size:\s*var\(--lb-control-min-size\)/u,
    );
    expect(styles).toMatch(
      /\.admin-nav__drawer-trigger\s*\{[\s\S]*inline-size:\s*var\(--lb-control-min-size\)/u,
    );
    expect(styles).toMatch(
      /@media \(width < 640px\)[\s\S]*#admin-main\s*\{[\s\S]*padding-inline:\s*16px/u,
    );
  });

  it('removes duplicate production insets and keeps 320px overview facts compact', () => {
    const authority = readFileSync(
      new URL('./features/admin-authority.tsx', import.meta.url),
      'utf8',
    );
    const shellStyles = readFileSync(new URL('./app/admin-shell.css', import.meta.url), 'utf8');
    const overviewStyles = readFileSync(
      new URL('./features/admin-overview.module.css', import.meta.url),
      'utf8',
    );

    expect(authority).toContain(
      '<main className="admin-production-shell" id="admin-main" tabIndex={-1}>',
    );
    expect(shellStyles).toContain('#admin-main.admin-production-shell');
    expect(shellStyles).toContain('#admin-main:has(.admin-production-loading)');
    expect(overviewStyles).toMatch(
      /@media \(max-width: 360px\)[\s\S]*\.briefingFacts > div,[\s\S]*\.capacity dl > div[\s\S]*grid-template-columns:\s*88px minmax\(0, 1fr\)/u,
    );
    expect(overviewStyles).toMatch(
      /@media \(max-width: 360px\)[\s\S]*\.priorityMetadata > div[\s\S]*grid-template-columns:\s*88px minmax\(0, 1fr\)/u,
    );
  });

  it('keeps high-risk review reachable through zoom-safe vertical semantics', () => {
    const layout = readFileSync(new URL('./app/[locale]/layout.tsx', import.meta.url), 'utf8');
    const navigation = readFileSync(new URL('./admin-navigation.tsx', import.meta.url), 'utf8');
    const styles = readFileSync(new URL('./app/admin-shell.css', import.meta.url), 'utf8');
    const feature = readFileSync(new URL('./features/admin-preview.tsx', import.meta.url), 'utf8');

    expect(layout).not.toContain('viewportPolicy=');
    expect(navigation).not.toContain('viewportPolicy');
    expect(feature).toContain('data-high-risk-sequence="evidence-impact-reauth-confirm-receipt"');
    expect(feature).not.toMatch(/viewportWidth\s*>=\s*960/u);
    expect(styles).toMatch(
      /\.admin-high-risk-flow\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/u,
    );
    expect(styles).not.toMatch(/\[data-high-risk-action='true'\][\s\S]{0,120}display:\s*none/u);
  });

  it('renders a premium task and operator topbar with accessible flag language switching', () => {
    const navigation = readFileSync(new URL('./admin-navigation.tsx', import.meta.url), 'utf8');
    const styles = readFileSync(new URL('./app/admin-shell.css', import.meta.url), 'utf8');

    expect(navigation).toContain('admin-header__task');
    expect(navigation).toContain('admin-header__account');
    expect(navigation).toContain('admin-header__account-panel');
    expect(navigation).toContain('sourceLocale={locale}');
    expect(navigation).toContain('targetLocale={alternateLocale}');
    expect(navigation).toContain('fallbackLocaleHref');
    expect(navigation).toContain('resolveLocalizedCurrentRoute({');
    expect(navigation).toContain('<LocaleSwitcher');
    expect(navigation).not.toContain('aria-label={`${locale');
    expect(styles).toContain('.admin-header__account:not([open]) > .admin-header__account-panel');
    expect(styles).toMatch(
      /@media \(width < 400px\)[\s\S]*\.admin-brand \.lb-product-wordmark\s*\{[\s\S]*display:\s*none/u,
    );
  });

  it('keeps one stable seven-domain order and removes domains absent from server authority', () => {
    expect(ADMIN_WEB_COMPOSITION).toEqual({
      authorityConnected: false,
      ordinaryNavigationLinked: false,
      previewRole: 'support',
      runtimeClass: 'fixture',
      surface: 'admin',
    });

    expect(
      projectAdminDomainNavigation(ADMIN_DOMAIN_ORDER, 'pt-BR').map(({ domain, label }) => ({
        domain,
        label,
      })),
    ).toEqual([
      { domain: 'overview', label: 'Visão geral' },
      { domain: 'people', label: 'Pessoas' },
      { domain: 'revenue', label: 'Receita' },
      { domain: 'operation', label: 'Operação' },
      { domain: 'support', label: 'Atendimento' },
      { domain: 'security', label: 'Segurança' },
      { domain: 'system', label: 'Sistema' },
    ]);
    expect(
      projectAdminDomainNavigation(['system', 'overview', 'security', 'security'], 'en').map(
        ({ domain }) => domain,
      ),
    ).toEqual(['overview', 'security', 'system']);

    const roleIds = {
      audit: projectAdminRoleNavigation('audit', 'en').map(({ routeId }) => routeId),
      operations: projectAdminRoleNavigation('operations', 'en').map(({ routeId }) => routeId),
      security: projectAdminRoleNavigation('security', 'en').map(({ routeId }) => routeId),
      support: projectAdminRoleNavigation('support', 'en').map(({ routeId }) => routeId),
    };

    expect(roleIds.support).toEqual(['admin-overview', 'admin-support-domain']);
    expect(roleIds.operations).toEqual([
      'admin-overview',
      'admin-people',
      'admin-revenue',
      'admin-operation',
      'admin-system',
    ]);
    expect(roleIds.security).toEqual([
      'admin-overview',
      'admin-people',
      'admin-support-domain',
      'admin-security-domain',
      'admin-system',
    ]);
    expect(roleIds.audit).toEqual(['admin-overview', 'admin-security-domain', 'admin-system']);
    expect(new Set(Object.values(roleIds).map((ids) => ids.join(','))).size).toBe(4);
    expect(adminRoleFromHeader('omnipotent')).toBe('support');
  });

  it('does not render preview role chrome before production session authority is verified', () => {
    const layout = readFileSync(new URL('./app/[locale]/layout.tsx', import.meta.url), 'utf8');

    expect(layout).toContain("runtime.kind === 'production'");
    expect(layout).toContain('data-admin-session-state="unverified"');
    expect(layout).toContain('data-runtime-class="server-authority"');
  });

  it('provides skip, focus, protected operator menu, and role-guarded reflow contracts', () => {
    const layout = readFileSync(new URL('./app/[locale]/layout.tsx', import.meta.url), 'utf8');
    const focus = readFileSync(new URL('./admin-focus-handoff.tsx', import.meta.url), 'utf8');
    const styles = readFileSync(new URL('./app/admin-shell.css', import.meta.url), 'utf8');

    expect(layout).toContain('href="#admin-main"');
    expect(layout).toContain('securityLabel={copy.security}');
    expect(layout).not.toContain('className="admin-preview-band"');
    expect(layout).not.toContain('data-viewport-gate="960"');
    expect(layout).toContain('<main id="admin-main" tabIndex={-1}>');
    expect(focus).toContain('#admin-main > h1');
    expect(styles).toContain('.admin-high-risk-flow');
    expect(styles).not.toContain("[data-high-risk-action='true'] {");
    expect(styles).toContain('@media (forced-colors: active)');
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
  });
});

describe('admin 403', () => {
  it('explains role denial without exposing authority or cross-surface links', () => {
    const model = createAdminFailureModel('403', 'pt-BR');

    expect(model.destinations.role).toBe('/pt-BR/admin');
    expect(model.copy.title).toContain('não permitido');
    expect(model.copy.safeState).toContain('Nenhuma credencial');
  });
});

describe('admin 404', () => {
  it('preserves locale and keeps the invalid route visible', () => {
    const model = createAdminFailureModel('404', 'en');
    const route = readFileSync(
      new URL('./app/[locale]/errors/404/page.tsx', import.meta.url),
      'utf8',
    );

    expect(model.destinations.role).toBe('/en/admin');
    expect(model.copy.detail).toContain('do not redirect');
    expect(adminFailureLocale('fr')).toBe('pt-BR');
    expect(route).toContain('notFound()');
    expect(route).not.toMatch(/redirect\(/u);
  });
});

describe('admin 410', () => {
  it('keeps canonical error routes exhaustive and disjoint from role workspaces', () => {
    expect(ADMIN_ERROR_ROUTE_IDS).toEqual([
      'admin-error-404',
      'admin-error-403',
      'admin-error-410',
      'admin-error-500',
    ]);
    expect(ADMIN_ERROR_ROUTE_IDS.map(adminFailureKindForRoute)).toEqual([
      '404',
      '403',
      '410',
      '500',
    ]);
    expect(ADMIN_ERROR_ROUTE_IDS.every(isAdminErrorRoute)).toBe(true);
    expect(ADMIN_ERROR_ROUTE_IDS.some(isAdminPreviewRoute)).toBe(false);
    expect(ADMIN_ENTRY_ROUTE_IDS.some(isAdminErrorRoute)).toBe(false);
    expect(adminFailureKindForRoute('admin-role')).toBeUndefined();
  });

  it('authors distinct bilingual history and same-origin recovery without leaking digests', () => {
    const ptBr = createAdminFailureModel('410', 'pt-BR', 'history_42');
    const en = createAdminFailureModel('410', 'en', 'history_42');
    const unsafe = createAdminFailureModel('410', 'en', 'user@example.com C:\\private');

    expect(ptBr.copy.title).toContain('não está mais disponível');
    expect(ptBr.copy.affected).toContain('histórico');
    expect(ptBr.copy.detail).toContain('permanece preservado');
    expect(ptBr.copy.safeState).toContain('Nenhuma autoridade');
    expect(en.copy.title).toContain('no longer available');
    expect(en.copy.affected).toContain('historical');
    expect(en.copy.detail).toContain('remains preserved');
    expect(en.copy.safeState).toContain('No authority');
    expect(ptBr.copy).not.toEqual(createAdminFailureModel('404', 'pt-BR').copy);
    expect(en.copy).not.toEqual(createAdminFailureModel('500', 'en').copy);
    expect(ptBr.destinations.role).toBe('/pt-BR/admin');
    expect(en.destinations.role).toBe('/en/admin');
    expect(ptBr.correlationId).toBe('LB-ADM-410-history_42');
    expect(unsafe.correlationId).toBe('LB-ADM-410-REDACTED');
  });

  it('preserves the closed cross-role access matrix', () => {
    expect(adminRoleCanAccess('support', 'admin-security')).toBe(false);
    expect(adminRoleCanAccess('security', 'admin-security')).toBe(true);
    expect(isAdminPreviewRoute('admin-error-410')).toBe(false);
  });

  it('dispatches canonical errors before workspace role admission without mutation channels', () => {
    const page = readFileSync(
      new URL('./app/[locale]/[[...workspace]]/page.tsx', import.meta.url),
      'utf8',
    );
    const errorDispatch = page.indexOf("resolution.kind === 'error'");
    const roleAdmission = page.indexOf('adminRoleCanAccess(role, resolution.routeId)');

    expect(page).toContain("securityBoundary: 'admin-origin'");
    expect(page).toContain('adminFailureKindForRoute(routeId)');
    expect(page).toContain('createAdminFailureModel(resolution.failureKind, locale)');
    expect(page).toContain('robots: { follow: false, index: false, nocache: true }');
    expect(errorDispatch).toBeGreaterThan(-1);
    expect(roleAdmission).toBeGreaterThan(errorDispatch);
    expect(page).not.toMatch(/redirect\(|fetch\(|cookies\(/u);
  });
});

describe('admin 500', () => {
  it('redacts diagnostics and offers safe retry recovery', () => {
    const accepted = createAdminFailureModel('500', 'en', 'opaque_42');
    const rejected = redactedAdminCorrelationId(
      '500',
      'user@example.com stack at C:\\private\\secret.ts',
    );
    const errorSource = readFileSync(new URL('./app/[locale]/error.tsx', import.meta.url), 'utf8');

    expect(accepted.correlationId).toBe('LB-ADM-500-opaque_42');
    expect(rejected).toBe('LB-ADM-500-REDACTED');
    expect(errorSource).toContain('onClick={reset}');
    expect(errorSource).not.toMatch(/error\.(message|stack|name)/u);
    expect(errorSource).not.toMatch(/redirect\(|window\.location|http-equiv=.refresh/iu);
    expect(createAdminFailureModel('500', 'en').copy.title).not.toMatch(/preview/iu);
    expect(createAdminFailureModel('500', 'pt-BR').copy.title).not.toMatch(/prévia/iu);
  });
});
