import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react';
import {
  createDefaultPreferences,
  reducePreferences,
  restorePreferences,
  selectDensityMetrics,
  serializePreferences,
  type DesktopLocale,
  type DesktopPreferences,
  type PreferenceEvent,
  type RendererToHostShellCommandJson,
  type ShellSetLocaleCommandJson,
  type ShellSetTrayPreferenceCommandJson,
} from '@liiiraa/feature-shell';

import { LocaleProvider, formatMessage, type MessageId } from './locales/i18n.js';

export const DESKTOP_PREFERENCES_STORAGE_KEY = 'liiiraa.desktop.preferences.v3' as const;
export const PREVIOUS_DESKTOP_PREFERENCES_STORAGE_KEY = 'liiiraa.desktop.preferences.v2' as const;
export const LEGACY_DESKTOP_PREFERENCES_STORAGE_KEY = 'liiiraa.desktop.preferences.v1' as const;
export const DESKTOP_THEME_STORAGE_KEY = 'liiiraa.desktop.theme.v1' as const;

export const DESKTOP_THEMES = Object.freeze(['dark', 'light', 'system'] as const);
export type DesktopTheme = (typeof DESKTOP_THEMES)[number];
export type ResolvedDesktopTheme = Exclude<DesktopTheme, 'system'>;

export interface DesktopPreferenceStorage {
  readonly getItem: (key: string) => string | null;
  readonly setItem: (key: string, value: string) => void;
}

export interface HostCommandMetadata {
  readonly requestId: string;
  readonly correlationId?: string;
  readonly issuedAt: string;
}

export interface AppearanceAttributes {
  readonly lang: DesktopLocale;
  readonly density: DesktopPreferences['density'];
  readonly motion: DesktopPreferences['motion'];
  readonly dataText: DesktopPreferences['dataText'];
  readonly interfaceScale: `${DesktopPreferences['interfaceScale']}%`;
  readonly minimumTargetPx: `${number}px`;
  readonly bodyFontPx: `${number}px`;
}

export const PRE_CONSENT_LOCALE_OPTIONS = Object.freeze([
  Object.freeze({
    locale: 'pt-BR',
    messageId: 'settings.language.ptBR',
  }),
  Object.freeze({
    locale: 'en-US',
    messageId: 'settings.language.enUS',
  }),
] as const satisfies readonly Readonly<{
  locale: DesktopLocale;
  messageId: MessageId;
}>[]);

export const loadDesktopPreferences = (
  storage: DesktopPreferenceStorage | undefined,
  windowsLocale: string | undefined,
): DesktopPreferences => {
  const defaults = createDefaultPreferences(windowsLocale);
  if (storage === undefined) {
    return defaults;
  }

  try {
    for (const key of [
      DESKTOP_PREFERENCES_STORAGE_KEY,
      PREVIOUS_DESKTOP_PREFERENCES_STORAGE_KEY,
      LEGACY_DESKTOP_PREFERENCES_STORAGE_KEY,
    ]) {
      const serialized = storage.getItem(key);
      if (serialized !== null) {
        return restorePreferences(JSON.parse(serialized), windowsLocale).preferences;
      }
    }

    return defaults;
  } catch {
    return defaults;
  }
};

export const persistDesktopPreferences = (
  storage: DesktopPreferenceStorage,
  preferences: DesktopPreferences,
): void => {
  storage.setItem(
    DESKTOP_PREFERENCES_STORAGE_KEY,
    JSON.stringify(serializePreferences(preferences)),
  );
};

export const getAppearanceAttributes = (preferences: DesktopPreferences): AppearanceAttributes => {
  const density = selectDensityMetrics(preferences.density);

  return Object.freeze({
    lang: preferences.locale,
    density: preferences.density,
    motion: preferences.motion,
    dataText: preferences.dataText,
    interfaceScale:
      `${String(preferences.interfaceScale)}%` as AppearanceAttributes['interfaceScale'],
    minimumTargetPx:
      `${String(density.minimumTargetPx)}px` as AppearanceAttributes['minimumTargetPx'],
    bodyFontPx: `${String(density.bodyFontPx)}px` as AppearanceAttributes['bodyFontPx'],
  });
};

export const createLocalePreferenceCommand = (
  locale: DesktopLocale,
  metadata: HostCommandMetadata,
): ShellSetLocaleCommandJson =>
  Object.freeze({
    schemaVersion: '1.0',
    messageType: 'desktop.shell.set-locale.command',
    ...metadata,
    payload: Object.freeze({
      locale: locale === 'pt-BR' ? 'pt-BR' : 'en',
    }),
  });

export const createTrayPreferenceCommand = (
  trayEnabled: boolean,
  metadata: HostCommandMetadata,
): ShellSetTrayPreferenceCommandJson =>
  Object.freeze({
    schemaVersion: '1.0',
    messageType: 'desktop.shell.set-tray-preference.command',
    ...metadata,
    payload: Object.freeze({
      preference: trayEnabled ? 'keep-game-detection-in-tray' : 'close-window',
    }),
  });

export interface DesktopPreferencesContextValue {
  readonly preferences: DesktopPreferences;
  readonly dispatch: (event: PreferenceEvent) => void;
  readonly resolvedTheme: ResolvedDesktopTheme;
  readonly setTheme: (theme: DesktopTheme) => void;
  readonly theme: DesktopTheme;
}

const DesktopPreferencesContext = createContext<DesktopPreferencesContextValue | null>(null);

const browserPreferenceStorage = (): DesktopPreferenceStorage | undefined => {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
};

const loadDesktopTheme = (storage: DesktopPreferenceStorage | undefined): DesktopTheme => {
  try {
    const stored = storage?.getItem(DESKTOP_THEME_STORAGE_KEY);
    return DESKTOP_THEMES.some((theme) => theme === stored) ? (stored as DesktopTheme) : 'dark';
  } catch {
    return 'dark';
  }
};

const detectSystemTheme = (): ResolvedDesktopTheme => {
  if (typeof globalThis.matchMedia !== 'function') {
    return 'dark';
  }
  return globalThis.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
};

export const resolveNativeWindowTheme = (
  theme: DesktopTheme,
  resolvedTheme: ResolvedDesktopTheme,
): ResolvedDesktopTheme | null => (theme === 'system' ? null : resolvedTheme);

export interface DesktopPreferencesProviderProps {
  readonly children: ReactNode;
  readonly commandMetadata?: () => HostCommandMetadata;
  readonly documentElement?: HTMLElement | null;
  readonly hostPreferenceEvent?: PreferenceEvent;
  readonly sendHostCommand?: (command: RendererToHostShellCommandJson) => void;
  readonly storage?: DesktopPreferenceStorage;
  readonly windowsLocale?: string;
}

export const DesktopPreferencesProvider = ({
  children,
  commandMetadata,
  documentElement,
  hostPreferenceEvent,
  sendHostCommand,
  storage = browserPreferenceStorage(),
  windowsLocale,
}: DesktopPreferencesProviderProps): ReactNode => {
  const [preferences, reducerDispatch] = useReducer(reducePreferences, undefined, () =>
    loadDesktopPreferences(storage, windowsLocale),
  );
  const [theme, setThemeState] = useState<DesktopTheme>(() => loadDesktopTheme(storage));
  const [systemTheme, setSystemTheme] = useState<ResolvedDesktopTheme>(detectSystemTheme);
  const resolvedTheme = theme === 'system' ? systemTheme : theme;

  useEffect(() => {
    if (hostPreferenceEvent !== undefined) {
      reducerDispatch(hostPreferenceEvent);
    }
  }, [hostPreferenceEvent]);

  useEffect(() => {
    if (storage !== undefined) {
      persistDesktopPreferences(storage, preferences);
    }
  }, [preferences, storage]);

  useEffect(() => {
    if (typeof globalThis.matchMedia !== 'function') {
      return;
    }
    const media = globalThis.matchMedia('(prefers-color-scheme: light)');
    const updateSystemTheme = (): void => {
      setSystemTheme(media.matches ? 'light' : 'dark');
    };
    updateSystemTheme();
    media.addEventListener('change', updateSystemTheme);
    return () => {
      media.removeEventListener('change', updateSystemTheme);
    };
  }, []);

  useEffect(() => {
    const root =
      documentElement ?? (typeof document === 'undefined' ? null : document.documentElement);
    if (root === null) {
      return;
    }

    const attributes = getAppearanceAttributes(preferences);
    root.lang = attributes.lang;
    root.dataset['density'] = attributes.density;
    root.dataset['motion'] = attributes.motion;
    root.dataset['dataText'] = attributes.dataText;
    root.dataset['theme'] = resolvedTheme;
    root.dataset['themePreference'] = theme;
    root.style.colorScheme = resolvedTheme;
    root.style.setProperty('--lb-interface-scale', attributes.interfaceScale);
    root.style.setProperty('--lb-minimum-target', attributes.minimumTargetPx);
    root.style.setProperty('--lb-body-font-size', attributes.bodyFontPx);
  }, [documentElement, preferences, resolvedTheme, theme]);

  useEffect(() => {
    if (!Reflect.has(globalThis, '__TAURI_INTERNALS__')) {
      return;
    }
    void import('@tauri-apps/api/window')
      .then(async ({ getCurrentWindow }) => {
        await getCurrentWindow().setTheme(resolveNativeWindowTheme(theme, resolvedTheme));
      })
      .catch(() => {
        // The web preview and restricted shells keep the CSS theme without native chrome control.
      });
  }, [resolvedTheme, theme]);

  const setTheme = useCallback(
    (nextTheme: DesktopTheme): void => {
      setThemeState(nextTheme);
      try {
        storage?.setItem(DESKTOP_THEME_STORAGE_KEY, nextTheme);
      } catch {
        // A blocked storage backend must not make appearance controls unusable.
      }
    },
    [storage],
  );

  const dispatch = useCallback(
    (event: PreferenceEvent) => {
      reducerDispatch(event);

      if (sendHostCommand === undefined || commandMetadata === undefined) {
        return;
      }

      if (event.type === 'set-locale') {
        sendHostCommand(createLocalePreferenceCommand(event.locale, commandMetadata()));
      } else if (event.type === 'set-tray-enabled') {
        sendHostCommand(createTrayPreferenceCommand(event.enabled, commandMetadata()));
      }
    },
    [commandMetadata, sendHostCommand],
  );

  const contextValue = useMemo<DesktopPreferencesContextValue>(
    () => Object.freeze({ dispatch, preferences, resolvedTheme, setTheme, theme }),
    [dispatch, preferences, resolvedTheme, setTheme, theme],
  );

  return createElement(
    DesktopPreferencesContext.Provider,
    { value: contextValue },
    createElement(LocaleProvider, {
      children,
      locale: preferences.locale,
      onLocaleChange: (locale: DesktopLocale) => {
        dispatch({ type: 'set-locale', locale });
      },
    }),
  );
};

export const useDesktopPreferences = (): DesktopPreferencesContextValue => {
  const context = useContext(DesktopPreferencesContext);
  if (context === null) {
    throw new Error('useDesktopPreferences must be used inside DesktopPreferencesProvider.');
  }
  return context;
};

export interface PreConsentLocaleControlProps {
  readonly id?: string;
}

export const PreConsentLocaleControl = ({
  id = 'desktop-locale',
}: PreConsentLocaleControlProps): ReactNode => {
  const { dispatch, preferences } = useDesktopPreferences();
  const label = formatMessage(preferences.locale, 'settings.language.label');

  return createElement(
    'label',
    { htmlFor: id },
    label,
    createElement(
      'select',
      {
        'aria-label': label,
        id,
        onChange: (event: ChangeEvent<HTMLSelectElement>) => {
          dispatch({
            type: 'set-locale',
            locale: event.currentTarget.value as DesktopLocale,
          });
        },
        value: preferences.locale,
      },
      PRE_CONSENT_LOCALE_OPTIONS.map(({ locale, messageId }) =>
        createElement(
          'option',
          { key: locale, value: locale },
          formatMessage(preferences.locale, messageId),
        ),
      ),
    ),
  );
};
