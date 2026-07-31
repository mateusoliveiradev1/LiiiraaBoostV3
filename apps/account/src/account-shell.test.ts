import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { projectNavigation } from '@liiiraa/web-core';
import { ACCOUNT_WEB_COMPOSITION } from './index';
import {
  accountFailureLocale,
  createAccountFailureModel,
  redactedAccountCorrelationId,
} from './account-errors';
import {
  ACCOUNT_ENTRY_ROUTE_IDS,
  ACCOUNT_ERROR_ROUTE_IDS,
  accountFailureKindForRoute,
  isAccountErrorRoute,
} from './account-preview-model';

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
    expect(createAccountFailureModel('410', 'en').copy.detail).toMatch(
      /historical|no longer/iu,
    );
    expect(createAccountFailureModel('410', 'pt-BR').copy.recovery).toMatch(
      /vis[aã]o geral|suporte/iu,
    );
    expect(createAccountFailureModel('500', 'en').copy.recovery).toMatch(
      /try again|support/iu,
    );
    expect(createAccountFailureModel('404', 'en').copy.detail).toMatch(
      /address|route/iu,
    );
  });

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
    expect(
      redactedAccountCorrelationId('500', 'stack at /srv/account/private.ts'),
    ).toBe('LB-A500-REDACTED');
    expect(redactedAccountCorrelationId('500', '{"request":"profile"}')).toBe(
      'LB-A500-REDACTED',
    );
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
    expect(layoutSource).toContain("x-liiiraa-account-failure-kind");
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
    expect(pageSource).toContain('isAccountPreviewRoute');
    expect(pageSource).toContain('isAccountErrorRoute');
    expect(pageSource).toContain('accountFailureKindForRoute');
    expect(pageSource).toContain('createAccountFailureModel');
    expect(pageSource).toContain('<AccountFailureView');
    expect(pageSource).toContain("failureKind === '500'");
    expect(pageSource).toContain("resolution.kind === 'unknown' ? '404'");
    expect(pageSource).not.toMatch(/redirect\(|cookies\(|fetch\(|window\.location/iu);

    expect((failureViewSource.match(/<h1\b/gu) ?? [])).toHaveLength(1);
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
