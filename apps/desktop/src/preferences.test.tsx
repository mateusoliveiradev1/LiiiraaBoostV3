import {
  PREFERENCE_VERSION,
  createDefaultPreferences,
  reducePreferences,
} from '@liiiraa/feature-shell';
import { describe, expect, it, vi } from 'vitest';

import {
  DESKTOP_PREFERENCES_STORAGE_KEY,
  PRE_CONSENT_LOCALE_OPTIONS,
  createLocalePreferenceCommand,
  createTrayPreferenceCommand,
  getAppearanceAttributes,
  loadDesktopPreferences,
  persistDesktopPreferences,
} from './preferences.js';

const createMemoryStorage = (initialValue: string | null = null) => {
  let value = initialValue;
  return {
    getItem: vi.fn((key: string) =>
      key === DESKTOP_PREFERENCES_STORAGE_KEY ? value : null,
    ),
    setItem: vi.fn((key: string, nextValue: string) => {
      if (key === DESKTOP_PREFERENCES_STORAGE_KEY) {
        value = nextValue;
      }
    }),
  };
};

describe('preferences D-18 and D-19 defaults', () => {
  it('restores Comfortable, System motion, 100 percent, and exit-on-close', () => {
    const storage = createMemoryStorage();

    expect(loadDesktopPreferences(storage, 'pt-BR')).toEqual({
      version: PREFERENCE_VERSION,
      locale: 'pt-BR',
      interfaceScale: 100,
      motion: 'system',
      density: 'comfortable',
      dataText: 'standard',
      trayEnabled: false,
    });
  });

  it('restores safe defaults when persisted data is corrupt or non-benign', () => {
    const storage = createMemoryStorage(
      JSON.stringify({
        ...createDefaultPreferences('en-US'),
        consent: true,
      }),
    );

    expect(loadDesktopPreferences(storage, 'pt-BR')).toEqual(
      createDefaultPreferences('pt-BR'),
    );
  });

  it('persists only validated benign preference fields', () => {
    const storage = createMemoryStorage();
    const preferences = reducePreferences(createDefaultPreferences('en-US'), {
      type: 'set-tray-enabled',
      enabled: true,
    });

    persistDesktopPreferences(storage, preferences);

    expect(storage.setItem).toHaveBeenCalledOnce();
    const serialized = storage.setItem.mock.calls[0]?.[1] ?? '';
    expect(JSON.parse(serialized)).toEqual(preferences);
    expect(serialized).not.toMatch(/consent|entitlement|account/iu);
  });
});

describe('preferences appearance and generated host commands', () => {
  it('keeps the locale switch visible before consent decisions', () => {
    expect(PRE_CONSENT_LOCALE_OPTIONS).toEqual([
      { locale: 'pt-BR', messageId: 'settings.language.ptBR' },
      { locale: 'en-US', messageId: 'settings.language.enUS' },
    ]);
  });

  it('maps every appearance preference to deterministic document attributes', () => {
    const preferences = [
      { type: 'set-interface-scale', scale: 150 },
      { type: 'set-motion', motion: 'reduced' },
      { type: 'set-density', density: 'compact' },
      { type: 'set-data-text', dataText: 'increased-contrast' },
    ].reduce(
      (current, event) =>
        reducePreferences(
          current,
          event as Parameters<typeof reducePreferences>[1],
        ),
      createDefaultPreferences('en-US'),
    );

    expect(getAppearanceAttributes(preferences)).toEqual({
      lang: 'en-US',
      density: 'compact',
      motion: 'reduced',
      dataText: 'increased-contrast',
      interfaceScale: '150%',
      minimumTargetPx: '44px',
      bodyFontPx: '15px',
    });
  });

  it('creates exact generated renderer-to-host locale and tray commands', () => {
    const metadata = {
      requestId: 'request-preferences-0001',
      correlationId: 'correlation-preferences-0001',
      issuedAt: '2026-07-28T12:00:00.000Z',
    } as const;

    expect(createLocalePreferenceCommand('en-US', metadata)).toEqual({
      schemaVersion: '1.0',
      messageType: 'desktop.shell.set-locale.command',
      ...metadata,
      payload: { locale: 'en' },
    });
    expect(createTrayPreferenceCommand(true, metadata)).toEqual({
      schemaVersion: '1.0',
      messageType: 'desktop.shell.set-tray-preference.command',
      ...metadata,
      payload: { preference: 'keep-game-detection-in-tray' },
    });
    expect(createTrayPreferenceCommand(false, metadata).payload.preference).toBe(
      'close-window',
    );
  });
});
