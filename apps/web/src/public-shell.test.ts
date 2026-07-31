import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { publicCspProbe, publicHeaderContract } from '../next.config';
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
  it('keeps the production origin cookie-free, frame-closed, and third-party-free', () => {
    const headers = Object.fromEntries(
      publicHeaderContract.map(({ key, value }) => [key.toLowerCase(), value]),
    );
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
    expect(publicCspProbe).toMatchObject({
      blockingDirectives: ['script-src', 'style-src'],
      status: 'report-only-blocked',
    });
  });
});
