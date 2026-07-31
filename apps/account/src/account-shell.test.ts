import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { projectNavigation } from '@liiiraa/web-core';
import { ACCOUNT_WEB_COMPOSITION } from './index';
import * as accountErrorContract from './account-errors';
import {
  accountFailureLocale,
  createAccountFailureModel,
  redactedAccountCorrelationId,
} from './account-errors';
import * as accountRouteContract from './account-preview-model';
import { ACCOUNT_ENTRY_ROUTE_IDS } from './account-preview-model';

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
    const routes = accountRouteContract as typeof accountRouteContract & {
      readonly ACCOUNT_ERROR_ROUTE_IDS: readonly string[];
      accountFailureKindForRoute: (routeId: string) => string;
      isAccountErrorRoute: (routeId: string) => boolean;
    };

    expect(routes.ACCOUNT_ERROR_ROUTE_IDS).toEqual([
      'account-error-404',
      'account-error-403',
      'account-error-410',
      'account-error-500',
    ]);
    expect(
      routes.ACCOUNT_ERROR_ROUTE_IDS.map((routeId) => [
        routeId,
        routes.isAccountErrorRoute(routeId),
        routes.accountFailureKindForRoute(routeId),
      ]),
    ).toEqual([
      ['account-error-404', true, '404'],
      ['account-error-403', true, '403'],
      ['account-error-410', true, '410'],
      ['account-error-500', true, '500'],
    ]);
    expect(routes.isAccountErrorRoute('account-security')).toBe(false);
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
    const failureContract = accountErrorContract as typeof accountErrorContract & {
      createAccountFailureModel: (
        kind: '403' | '404' | '410' | '500',
        locale: 'pt-BR' | 'en',
      ) => ReturnType<typeof createAccountFailureModel> & {
        copy: ReturnType<typeof createAccountFailureModel>['copy'] & {
          affectedCapability: string;
          recovery: string;
        };
      };
    };
    const kinds = ['403', '404', '410', '500'] as const;

    for (const locale of ['pt-BR', 'en'] as const) {
      const outcomes = kinds.map((kind) =>
        failureContract.createAccountFailureModel(kind, locale),
      );

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

    expect(failureContract.createAccountFailureModel('403', 'en').copy.detail).toMatch(
      /permission|responsibility/iu,
    );
    expect(failureContract.createAccountFailureModel('410', 'en').copy.detail).toMatch(
      /historical|no longer/iu,
    );
    expect(failureContract.createAccountFailureModel('410', 'pt-BR').copy.recovery).toMatch(
      /vis[aã]o geral|suporte/iu,
    );
    expect(failureContract.createAccountFailureModel('500', 'en').copy.recovery).toMatch(
      /try again|support/iu,
    );
    expect(failureContract.createAccountFailureModel('404', 'en').copy.detail).toMatch(
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
    const notFoundRouteSource = readFileSync(
      new URL('./app/[locale]/errors/404/page.tsx', import.meta.url),
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
    expect(notFoundRouteSource).toContain('notFound()');
    expect(notFoundRouteSource).not.toMatch(/redirect\(/u);
  });
});
