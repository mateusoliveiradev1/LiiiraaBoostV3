import { readFileSync } from 'node:fs';

import { createElement } from 'react';
// @ts-expect-error The workspace intentionally omits ReactDOM server declarations from desktop production types.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type {
  DesktopAccountAuthoritySnapshot,
  DesktopAdminHandoffProjection,
} from '../account-authority.js';
import { DesktopAdminHandoff, resolveDesktopLoginState } from './account-experience.js';

const projected = (state: DesktopAccountAuthoritySnapshot['state']) =>
  ({ state, projection: {} }) as DesktopAccountAuthoritySnapshot;

describe('desktop account session restoration', () => {
  it('keeps the sign-in form hidden while native credential restoration is pending', () => {
    expect(resolveDesktopLoginState({ state: 'pending' })).toBe('restoring');
  });

  it('enters the authenticated account when the saved native credential resolves', () => {
    expect(resolveDesktopLoginState(projected('online'))).toBe('authenticated');
    expect(resolveDesktopLoginState(projected('stale'))).toBe('authenticated');
  });

  it('shows sign-in only after the native credential is confirmed absent or revoked', () => {
    expect(resolveDesktopLoginState({ state: 'revoked', error: 'unauthorized' })).toBe('sign-in');
    expect(resolveDesktopLoginState({ state: 'offline', error: 'network-unavailable' })).toBe(
      'unavailable',
    );
  });

  it('renders the real account and administrative role without production fixture copy', () => {
    const source = readFileSync(new URL('./account-experience.tsx', import.meta.url), 'utf8');

    expect(source).toContain('className="desktop-authority-identity"');
    expect(source).toContain('administrativeRole');
    expect(source).toContain("en: 'Administrator'");
    expect(source).toContain("'pt-BR': 'Administrador'");
    expect(source).toContain('data-account-runtime="production"');
  });

  it('offers real plan management from the authoritative desktop Plan route', () => {
    const source = readFileSync(new URL('./account-experience.tsx', import.meta.url), 'utf8');

    expect(source).toContain('authority.openSubscription(locale)');
    expect(source).toContain("'pt-BR': 'Ver planos e assinar'");
    expect(source).toContain("'pt-BR': 'Gerenciar assinatura'");
    expect(source).toContain('O pagamento abre no navegador seguro');
    expect(source).not.toContain('liiiraa-boost-account-staging.vercel.app');
  });

  it('confirms the revoked authority before routing back to sign-in', () => {
    const source = readFileSync(new URL('./account-experience.tsx', import.meta.url), 'utf8');
    const signOutBranch = source.slice(source.indexOf("result.status === 'signed-out'"));

    expect(signOutBranch.indexOf('authority.confirmSignedOut()')).toBeGreaterThan(-1);
    expect(signOutBranch.indexOf('authority.confirmSignedOut()')).toBeLessThan(
      signOutBranch.indexOf("navigate('/login')"),
    );
  });
});

const handoff = (
  overrides: Partial<DesktopAdminHandoffProjection> = {},
): DesktopAdminHandoffProjection => ({
  status: 'eligible',
  membership: 'active',
  activeFunction: 'security',
  plan: 'premium',
  actionable: true,
  ...overrides,
});

describe('desktop Admin handoff presentation', () => {
  it('shows authoritative membership and active function with one bounded action', () => {
    const markup = renderToStaticMarkup(
      createElement(DesktopAdminHandoff, {
        handoff: handoff(),
        locale: 'pt-BR',
        onOpen: () => undefined,
      }),
    );

    expect(markup).toContain('data-administrative-membership="active"');
    expect(markup).toContain('data-admin-active-function="security"');
    expect(markup).toContain('Membro administrativo');
    expect(markup).toContain('Função ativa');
    expect(markup).toContain('Segurança');
    expect(markup).toContain('Abrir Admin');
  });

  it.each(['ineligible', 'offline', 'expired', 'revoked'] as const)(
    'does not render an actionable Admin handoff while authority is %s',
    (status) => {
      const membership = status === 'ineligible' ? 'none' : status;
      const unavailableHandoff: DesktopAdminHandoffProjection = {
        status,
        membership,
        plan: 'premium',
        actionable: false,
      };
      const markup = renderToStaticMarkup(
        createElement(DesktopAdminHandoff, {
          handoff: unavailableHandoff,
          locale: 'en',
          onOpen: () => undefined,
        }),
      );

      expect(markup).not.toContain('Open Admin');
      expect(markup).not.toContain('<button');
    },
  );

  it('keeps the Admin origin, records, commands, sessions, and credentials out of the WebView', () => {
    const source = readFileSync(new URL('./account-experience.tsx', import.meta.url), 'utf8');

    expect(source).toContain('authority.openAdmin()');
    expect(source).not.toContain('liiiraa-boost-admin-staging.vercel.app');
    expect(source).not.toContain('<iframe');
    expect(source).not.toMatch(/adminRecords|adminSearchResults|adminCommands|adminCookie/u);
  });
});
