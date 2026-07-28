import { describe, expect, it } from 'vitest';

import {
  PREFERENCE_VERSION,
  createDefaultPreferences,
  detectDesktopLocale,
  reducePreferences,
  restorePreferences,
  selectCloseBehavior,
  selectDensityMetrics,
  serializePreferences,
} from './preferences.js';

describe('UX-12 preferences', () => {
  it('implements D-17 with PT-BR only for the Brazilian Portuguese locale', () => {
    expect(detectDesktopLocale('pt-BR')).toBe('pt-BR');
    expect(detectDesktopLocale('PT-br')).toBe('pt-BR');
    expect(detectDesktopLocale('pt-PT')).toBe('en-US');
    expect(detectDesktopLocale('en-US')).toBe('en-US');
    expect(detectDesktopLocale(undefined)).toBe('en-US');
  });

  it('implements D-18 and D-19 with Comfortable, System, and exit defaults', () => {
    const preferences = createDefaultPreferences('pt-BR');

    expect(preferences).toEqual({
      version: PREFERENCE_VERSION,
      locale: 'pt-BR',
      interfaceScale: 100,
      motion: 'system',
      density: 'comfortable',
      dataText: 'standard',
      trayEnabled: false,
    });
    expect(selectCloseBehavior(preferences)).toBe('exit');
    expect(Object.isFrozen(preferences)).toBe(true);
  });

  it('makes tray persistence an explicit opt-in', () => {
    const preferences = reducePreferences(createDefaultPreferences('en-US'), {
      type: 'set-tray-enabled',
      enabled: true,
    });

    expect(preferences.trayEnabled).toBe(true);
    expect(selectCloseBehavior(preferences)).toBe('keep-in-tray');
  });

  it('round-trips every benign preference without consent or entitlement data', () => {
    const changed = [
      { type: 'set-locale', locale: 'en-US' },
      { type: 'set-interface-scale', scale: 150 },
      { type: 'set-motion', motion: 'reduced' },
      { type: 'set-density', density: 'compact' },
      { type: 'set-data-text', dataText: 'increased-contrast' },
      { type: 'set-tray-enabled', enabled: true },
    ].reduce(
      (preferences, event) =>
        reducePreferences(preferences, event as Parameters<typeof reducePreferences>[1]),
      createDefaultPreferences('pt-BR'),
    );

    const persisted = serializePreferences(changed);
    const restored = restorePreferences(JSON.parse(JSON.stringify(persisted)), 'pt-BR');
    const serialized = JSON.stringify(persisted);

    expect(restored).toEqual({ ok: true, preferences: changed });
    expect(serialized).not.toContain('consent');
    expect(serialized).not.toContain('entitlement');
    expect(serialized).not.toContain('account');
  });

  it.each([
    null,
    {},
    { version: 2 },
    {
      version: 1,
      locale: 'pt-BR',
      interfaceScale: 90,
      motion: 'system',
      density: 'comfortable',
      dataText: 'standard',
      trayEnabled: false,
    },
    {
      version: 1,
      locale: 'en-US',
      interfaceScale: 100,
      motion: 'animated',
      density: 'compact',
      dataText: 'standard',
      trayEnabled: false,
    },
    {
      version: 1,
      locale: 'en-US',
      interfaceScale: 100,
      motion: 'system',
      density: 'comfortable',
      dataText: 'standard',
      trayEnabled: false,
      consent: true,
    },
  ])('restores corrupt or non-benign data to safe defaults: %j', (candidate) => {
    expect(restorePreferences(candidate, 'pt-BR')).toEqual({
      ok: false,
      reason: 'invalid-preferences',
      preferences: createDefaultPreferences('pt-BR'),
    });
  });

  it('keeps Compact target and type sizes accessible', () => {
    expect(selectDensityMetrics('comfortable')).toEqual({
      minimumTargetPx: 44,
      bodyFontPx: 15,
      standardRowPx: 52,
    });
    expect(selectDensityMetrics('compact')).toEqual({
      minimumTargetPx: 44,
      bodyFontPx: 15,
      standardRowPx: 44,
    });
  });
});
