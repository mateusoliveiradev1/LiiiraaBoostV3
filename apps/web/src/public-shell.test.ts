import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import * as publicConfig from '../next.config';
import { publicBoundaryHref, publicNavigation, routing } from './public-boundary';
import {
  CLIENT_WEB_LOCALES,
  clientAccountBoundaryHref,
  clientPublicBoundaryHref,
  type ClientRecoveryRouteId,
} from './public-client-boundary';

const layoutSource = readFileSync(new URL('./app/[locale]/layout.tsx', import.meta.url), 'utf8');
const shellStyles = readFileSync(new URL('./app/public-shell.css', import.meta.url), 'utf8');

describe('public shell', () => {
  it('uses the approved product lockup without exposing substitute initials', () => {
    expect(layoutSource).toContain('ProductLockup');
    expect(layoutSource).not.toContain('public-brand__mark');
    expect(layoutSource).not.toMatch(/>\s*LB\s*</u);
  });

  it('keeps internal origin boundaries out of ordinary visitor chrome', () => {
    expect(layoutSource).not.toContain('public-boundary-notice');
    expect(layoutSource).not.toMatch(/>\s*PUBLIC\s*</u);
    expect(shellStyles).not.toContain('.public-boundary-notice');
  });

  it('retains accessible navigation, locale switching, and responsive menu behavior', () => {
    expect(layoutSource).toContain('className="public-skip-link"');
    expect(layoutSource).toContain('hrefLang={alternateLocale}');
    expect(layoutSource).toContain('className="public-mobile-menu"');
    expect(layoutSource).toContain("publicBoundaryHref('public-search', locale)");
    expect(layoutSource).toContain("publicBoundaryHref('releases-index', locale)");
    expect(shellStyles).toMatch(/@media \(width < 960px\)[\s\S]*\.public-mobile-menu/u);
  });

  it('derives every public navigation pillar and both locale roots from route authority', () => {
    expect(routing.locales).toEqual(['pt-BR', 'en']);
    expect(publicNavigation.map(({ id }) => id)).toEqual([
      'public-product',
      'public-evidence',
      'public-compatibility',
      'public-plans',
      'docs-index',
      'releases-index',
    ]);
    expect(publicBoundaryHref('docs-index', 'pt-BR')).toBe('/pt-BR/docs');
    expect(publicBoundaryHref('releases-index', 'en')).toBe('/en/releases');
  });

  it('keeps the client recovery subset byte-equal to canonical server routes', () => {
    const recoveryRoutes = [
      'docs-index',
      'public-compatibility',
      'public-home',
      'public-status',
      'public-support',
    ] as const satisfies readonly ClientRecoveryRouteId[];

    expect(CLIENT_WEB_LOCALES).toEqual(routing.locales);
    for (const locale of routing.locales) {
      for (const routeId of recoveryRoutes) {
        expect(clientPublicBoundaryHref(routeId, locale)).toBe(publicBoundaryHref(routeId, locale));
      }
      expect(clientAccountBoundaryHref(locale)).toBe(
        `https://account.liiiraa.com/${locale}/sign-in`,
      );
    }
  });
});

describe('public CSP', () => {
  const headersFor = (runtimeMode: 'development' | 'production' | 'test') => {
    const builder = Reflect.get(publicConfig, 'buildPublicHeaderContract') as
      | ((mode: typeof runtimeMode) => readonly { key: string; value: string }[])
      | undefined;
    const contract = builder?.(runtimeMode) ?? publicConfig.publicHeaderContract;

    return Object.fromEntries(contract.map(({ key, value }) => [key.toLowerCase(), value]));
  };

  it('constructs an explicit development policy for React and Turbopack debugging', () => {
    expect(Reflect.get(publicConfig, 'buildPublicHeaderContract')).toBeTypeOf('function');

    const enforced = headersFor('development')['content-security-policy'];
    const scriptDirective = enforced
      ?.split(';')
      .find((directive) => directive.trim().startsWith('script-src'));

    expect(scriptDirective).toBe(" script-src 'self' 'unsafe-inline' 'unsafe-eval'");
    expect(scriptDirective?.match(/'unsafe-eval'/gu)).toHaveLength(1);
  });

  it.each(['production', 'test'] as const)(
    'keeps the %s policy no-eval while retaining the public static contract',
    (runtimeMode) => {
      const headers = headersFor(runtimeMode);
      const enforced = headers['content-security-policy'];
      const reportOnly = headers['content-security-policy-report-only'];

      expect(enforced).toContain("script-src 'self' 'unsafe-inline'");
      expect(enforced).not.toContain("'unsafe-eval'");
      expect(reportOnly).toContain("script-src 'self'");
      expect(reportOnly).not.toContain("'unsafe-eval'");
      expect(enforced).toContain("frame-ancestors 'none'");
      expect(enforced).toContain("object-src 'none'");
      expect(enforced).toContain("base-uri 'none'");
      expect(enforced).toContain("form-action 'self'");
      expect(headers['cross-origin-opener-policy']).toBe('same-origin');
      expect(headers['cross-origin-resource-policy']).toBe('same-origin');
      expect(Object.keys(headers)).not.toContain('set-cookie');
    },
  );

  it('keeps the production origin cookie-free, frame-closed, and third-party-free', () => {
    const headers = headersFor('production');
    const enforced = headers['content-security-policy'];

    expect(enforced).toContain("default-src 'self'");
    expect(enforced).toContain("frame-ancestors 'none'");
    expect(enforced).toContain("object-src 'none'");
    expect(enforced).toContain("form-action 'self'");
    const scriptDirective = enforced
      ?.split(';')
      .find((directive) => directive.trim().startsWith('script-src'));

    expect(scriptDirective).not.toMatch(/https?:|data:|nonce-/u);
    expect(Object.keys(headers)).not.toContain('set-cookie');
    expect(publicConfig.publicCspProbe).toMatchObject({
      blockingDirectives: ['script-src', 'style-src'],
      status: 'report-only-blocked',
    });
  });
});
