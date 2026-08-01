import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  adminFailureLocale,
  createAdminFailureModel,
  redactedAdminCorrelationId,
} from './admin-errors';
import {
  ADMIN_ENTRY_ROUTE_IDS,
  ADMIN_ERROR_ROUTE_IDS,
  adminFailureKindForRoute,
  adminRoleCanAccess,
  isAdminErrorRoute,
  isAdminPreviewRoute,
} from './admin-preview-model';
import { adminRoleFromHeader, projectAdminRoleNavigation } from './admin-shell';
import { ADMIN_WEB_COMPOSITION } from './index';

describe('admin shell', () => {
  it('enforces the exact desktop operations shell geometry', () => {
    const styles = readFileSync(new URL('./app/admin-shell.css', import.meta.url), 'utf8');

    expect(styles).toMatch(/\.admin-header__bar\s*\{[\s\S]*min-block-size:\s*72px/u);
    expect(styles).toMatch(/\.admin-preview-band\s*\{[\s\S]*block-size:\s*40px/u);
    expect(styles).toMatch(
      /\.admin-workspace\s*\{[\s\S]*grid-template-columns:\s*280px minmax\(0, 1fr\)/u,
    );
    expect(styles).toMatch(/\.admin-workspace\s*\{[\s\S]*max-inline-size:\s*1320px/u);
    expect(styles).toMatch(
      /@media \(width < 960px\)[\s\S]*\.admin-header__bar\s*\{[\s\S]*min-block-size:\s*60px/u,
    );
  });

  it('keeps operational identity, task, origin, role, and locale legible without raw fixture chrome', () => {
    const layout = readFileSync(new URL('./app/[locale]/layout.tsx', import.meta.url), 'utf8');
    const navigation = readFileSync(new URL('./admin-navigation.tsx', import.meta.url), 'utf8');

    expect(layout).toContain('<ProductLockup />');
    expect(layout).toContain('admin-brand__surface');
    expect(layout).toContain('admin-header__role');
    expect(layout).toContain('admin-header__origin');
    expect(navigation).toContain('admin-header__task');
    expect(navigation).toContain('<LocaleSwitcher');
    expect(layout).toContain('data-authority="disconnected"');
    expect(layout).not.toMatch(/>\s*(fixture|simulated-no-change)\s*</iu);
  });

  it('owns one role-scoped current task and preserves only validated role context', () => {
    const navigation = readFileSync(new URL('./admin-navigation.tsx', import.meta.url), 'utf8');

    expect(navigation).toContain("'use client'");
    expect(navigation).toContain('usePathname');
    expect(navigation).toContain('useSearchParams');
    expect(navigation).toContain('resolveLocalizedCurrentRoute');
    expect(navigation).toContain("securityBoundary: 'admin-origin'");
    expect(navigation).toContain('roleParameter === role');
    expect(navigation).toContain('currentItems.length === 1');
    expect(navigation).toContain("aria-current={isCurrent ? 'page' : undefined}");
    expect(navigation).toContain('<LocaleSwitcher');
    expect(navigation).toContain("searchParameters.get('role')");
  });

  it('collapses narrow role navigation into a compact current-task disclosure', () => {
    const navigation = readFileSync(new URL('./admin-navigation.tsx', import.meta.url), 'utf8');
    const styles = readFileSync(new URL('./app/admin-shell.css', import.meta.url), 'utf8');

    expect(navigation).toContain('admin-nav__desktop');
    expect(navigation).toContain('admin-nav__mobile');
    expect(navigation).toContain('<details');
    expect(navigation).toContain('<summary>');
    expect(navigation).toContain('{currentLabel}');
    expect(styles).toMatch(/\.admin-nav__mobile\s*\{[\s\S]*display:\s*none/u);
    expect(styles).toMatch(
      /@media \(width < 960px\)[\s\S]*\.admin-nav__desktop\s*\{[\s\S]*display:\s*none/u,
    );
    expect(styles).toMatch(
      /@media \(width < 960px\)[\s\S]*\.admin-nav__mobile\s*\{[\s\S]*display:\s*block/u,
    );
    expect(styles).not.toMatch(
      /@media \(width < 960px\)[\s\S]*\.admin-nav__list\s*\{[\s\S]*flex-wrap:\s*wrap/u,
    );
  });

  it('keeps the mobile disclosure exactly 48px and preserves one canonical current task', () => {
    const navigation = readFileSync(new URL('./admin-navigation.tsx', import.meta.url), 'utf8');
    const styles = readFileSync(new URL('./app/admin-shell.css', import.meta.url), 'utf8');

    expect(navigation).toContain('<details className="admin-nav admin-nav__mobile">');
    expect(navigation).toContain('markCurrent={false}');
    expect(navigation.match(/aria-current=/gu)).toHaveLength(1);
    expect(styles).toMatch(
      /@media \(width < 960px\)[\s\S]*\.admin-nav__mobile > summary\s*\{[\s\S]*block-size:\s*48px/u,
    );
    expect(styles).toMatch(
      /@media \(width < 640px\)[\s\S]*#admin-main\s*\{[\s\S]*padding-inline:\s*16px/u,
    );
  });

  it('keeps safe mobile review while removing high-risk semantics with a contextual reason', () => {
    const layout = readFileSync(new URL('./app/[locale]/layout.tsx', import.meta.url), 'utf8');
    const navigation = readFileSync(new URL('./admin-navigation.tsx', import.meta.url), 'utf8');
    const styles = readFileSync(new URL('./app/admin-shell.css', import.meta.url), 'utf8');
    const feature = readFileSync(new URL('./features/admin-preview.tsx', import.meta.url), 'utf8');

    expect(layout).not.toContain('viewportPolicy=');
    expect(navigation).not.toContain('viewportPolicy');
    expect(feature).toContain('id="admin-mobile-high-risk-block"');
    expect(feature).toContain('aria-describedby="admin-mobile-high-risk-block"');
    expect(feature).toContain('viewportWidth');
    expect(styles).toMatch(
      /@media \(width < 960px\)[\s\S]*\[data-high-risk-action='true'\]\s*\{[\s\S]*display:\s*none !important/u,
    );
  });

  it('renders a premium role and task topbar with accessible flag language switching', () => {
    const layout = readFileSync(new URL('./app/[locale]/layout.tsx', import.meta.url), 'utf8');
    const navigation = readFileSync(new URL('./admin-navigation.tsx', import.meta.url), 'utf8');

    expect(layout).toContain('admin-header__role');
    expect(navigation).toContain('admin-header__task');
    expect(navigation).toContain('sourceLocale={locale}');
    expect(navigation).toContain('targetLocale={alternateLocale}');
    expect(navigation).toContain('fallbackLocaleHref');
    expect(navigation).toContain('resolveLocalizedCurrentRoute({');
    expect(navigation).toContain('<LocaleSwitcher');
    expect(navigation).not.toContain('aria-label={`${locale');
  });

  it('persists disconnected fixture provenance and scopes every role', () => {
    expect(ADMIN_WEB_COMPOSITION).toEqual({
      authorityConnected: false,
      ordinaryNavigationLinked: false,
      previewRole: 'support',
      runtimeClass: 'fixture',
      surface: 'admin',
    });

    const roleIds = {
      audit: projectAdminRoleNavigation('audit', 'en').map(({ routeId }) => routeId),
      operations: projectAdminRoleNavigation('operations', 'en').map(({ routeId }) => routeId),
      security: projectAdminRoleNavigation('security', 'en').map(({ routeId }) => routeId),
      support: projectAdminRoleNavigation('support', 'en').map(({ routeId }) => routeId),
    };

    expect(roleIds.support).toEqual(['admin-role', 'admin-support']);
    expect(roleIds.operations).toEqual(['admin-role', 'admin-operations', 'admin-audit']);
    expect(roleIds.security).toEqual([
      'admin-role',
      'admin-security',
      'admin-diagnostics',
      'admin-audit',
    ]);
    expect(roleIds.audit).toEqual(['admin-role', 'admin-audit', 'admin-audit-event']);
    expect(new Set(Object.values(roleIds).map((ids) => ids.join(','))).size).toBe(4);
    expect(adminRoleFromHeader('omnipotent')).toBe('support');
  });

  it('provides skip, focus, preview, and semantic viewport gate contracts', () => {
    const layout = readFileSync(new URL('./app/[locale]/layout.tsx', import.meta.url), 'utf8');
    const focus = readFileSync(new URL('./admin-focus-handoff.tsx', import.meta.url), 'utf8');
    const styles = readFileSync(new URL('./app/admin-shell.css', import.meta.url), 'utf8');

    expect(layout).toContain('href="#admin-main"');
    expect(layout).toContain('className="admin-preview-band"');
    expect(layout).toContain('data-authority="disconnected"');
    expect(layout).not.toContain('data-viewport-gate="960"');
    expect(layout).toContain('<main id="admin-main" tabIndex={-1}>');
    expect(focus).toContain('#admin-main > h1');
    expect(styles).toMatch(
      /@media \(width < 960px\)[\s\S]*\[data-high-risk-action='true'\][\s\S]*display: none !important/u,
    );
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
  });
});
