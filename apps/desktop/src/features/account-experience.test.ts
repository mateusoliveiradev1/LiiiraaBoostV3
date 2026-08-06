import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import type { DesktopAccountAuthoritySnapshot } from '../account-authority.js';
import { resolveDesktopLoginState } from './account-experience.js';

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
});
