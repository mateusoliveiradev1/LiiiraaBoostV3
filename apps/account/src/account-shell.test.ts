import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { projectNavigation } from '@liiiraa/web-core';
import { ACCOUNT_WEB_COMPOSITION } from './index';
import {
  accountFailureLocale,
  createAccountFailureModel,
  redactedAccountCorrelationId,
} from './account-errors';

describe('account shell', () => {
  it('projects every canonical account responsibility and keeps preview authority visible', () => {
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
      authorityConnected: false,
      runtimeClass: 'fixture',
      surface: 'account',
    });
    expect((layoutSource.match(/<main\b/gu) ?? [])).toHaveLength(1);
    expect(layoutSource).toContain('href="#account-main"');
    expect(layoutSource).toContain('account-preview-rail');
    expect(layoutSource).toContain('data-authority="disconnected"');
    expect(layoutSource).toContain('ACCOUNT_WEB_COMPOSITION');
    for (const routeId of routeIds) {
      expect(layoutSource).toContain(routeId);
    }
    expect(styles).toMatch(/@media \(width < 760px\)[\s\S]*grid-auto-flow: column/u);
    expect(styles).toContain('@media (forced-colors: active)');
    expect(styles).toContain('min-block-size: 44px');
    expect(styles).not.toMatch(/account-nav[\s\S]*icon-only/iu);
  });
});

describe('account errors', () => {
  it('preserves locale, redacts diagnostics, and offers explicit safe recovery', () => {
    const portuguese = createAccountFailureModel('404', 'pt-BR');
    const english = createAccountFailureModel('500', 'en', 'opaque_42');
    const rejected = redactedAccountCorrelationId(
      '500',
      'user@example.com stack at C:\\private\\secret.ts',
    );
    const errorSource = readFileSync(
      new URL('./app/[locale]/error.tsx', import.meta.url),
      'utf8',
    );
    const notFoundRouteSource = readFileSync(
      new URL('./app/[locale]/errors/404/page.tsx', import.meta.url),
      'utf8',
    );

    expect(portuguese.destinations.overview).toBe('/pt-BR/account');
    expect(portuguese.destinations.support).toBe('/pt-BR/account/support');
    expect(english.destinations.support).toBe('/en/account/support');
    expect(english.correlationId).toBe('LB-A500-opaque_42');
    expect(rejected).toBe('LB-A500-REDACTED');
    expect(accountFailureLocale('fr')).toBe('pt-BR');
    expect(errorSource).toContain('role="alert"');
    expect(errorSource).toContain('onClick={reset}');
    expect(errorSource).not.toMatch(/error\.(message|stack|name)/u);
    expect(errorSource).not.toMatch(/redirect\(|window\.location|http-equiv=.refresh/iu);
    expect(notFoundRouteSource).toContain('notFound()');
    expect(notFoundRouteSource).not.toMatch(/redirect\(/u);
  });
});
