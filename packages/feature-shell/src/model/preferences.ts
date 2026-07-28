export const PREFERENCE_VERSION = 3 as const;

export const DESKTOP_LOCALES = Object.freeze(['pt-BR', 'en-US'] as const);
export const LOCALE_SOURCES = Object.freeze(['automatic', 'explicit'] as const);
export const INTERFACE_SCALES = Object.freeze([100, 112.5, 125, 150] as const);
export const MOTION_PREFERENCES = Object.freeze([
  'system',
  'reduced',
  'responsive',
] as const);
export const DENSITY_PREFERENCES = Object.freeze([
  'comfortable',
  'compact',
] as const);
export const DATA_TEXT_PREFERENCES = Object.freeze([
  'standard',
  'increased-contrast',
] as const);

export type DesktopLocale = (typeof DESKTOP_LOCALES)[number];
export type LocaleSource = (typeof LOCALE_SOURCES)[number];
export type InterfaceScale = (typeof INTERFACE_SCALES)[number];
export type MotionPreference = (typeof MOTION_PREFERENCES)[number];
export type DensityPreference = (typeof DENSITY_PREFERENCES)[number];
export type DataTextPreference = (typeof DATA_TEXT_PREFERENCES)[number];

export interface DesktopPreferences {
  readonly version: typeof PREFERENCE_VERSION;
  readonly locale: DesktopLocale;
  readonly localeSource: LocaleSource;
  readonly interfaceScale: InterfaceScale;
  readonly motion: MotionPreference;
  readonly density: DensityPreference;
  readonly dataText: DataTextPreference;
  readonly trayEnabled: boolean;
}

export type PreferenceEvent =
  | Readonly<{ type: 'set-locale'; locale: DesktopLocale }>
  | Readonly<{ type: 'set-interface-scale'; scale: InterfaceScale }>
  | Readonly<{ type: 'set-motion'; motion: MotionPreference }>
  | Readonly<{ type: 'set-density'; density: DensityPreference }>
  | Readonly<{ type: 'set-data-text'; dataText: DataTextPreference }>
  | Readonly<{ type: 'set-tray-enabled'; enabled: boolean }>;

export type PreferenceRestoreResult =
  | Readonly<{
      ok: true;
      migrated: boolean;
      preferences: DesktopPreferences;
    }>
  | Readonly<{
      ok: false;
      reason: 'invalid-preferences';
      preferences: DesktopPreferences;
    }>;

export interface DensityMetrics {
  readonly minimumTargetPx: 44;
  readonly bodyFontPx: 15;
  readonly standardRowPx: 44 | 52;
}

type LegacyDesktopPreferences = Omit<
  DesktopPreferences,
  'version' | 'localeSource'
> & {
  readonly version: 1 | 2;
};

const CURRENT_PREFERENCE_KEYS = Object.freeze([
  'dataText',
  'density',
  'interfaceScale',
  'locale',
  'localeSource',
  'motion',
  'trayEnabled',
  'version',
] as const);

const LEGACY_PREFERENCE_KEYS = Object.freeze([
  'dataText',
  'density',
  'interfaceScale',
  'locale',
  'motion',
  'trayEnabled',
  'version',
] as const);

const freezePreferences = (
  preferences: DesktopPreferences,
): Readonly<DesktopPreferences> => Object.freeze({ ...preferences });

const includes = <Value>(
  values: readonly Value[],
  candidate: unknown,
): candidate is Value => values.some((value) => value === candidate);

const hasExactKeys = (
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean => {
  const keys = Object.keys(value).sort();
  return (
    keys.length === expected.length &&
    keys.every((key, index) => key === expected[index])
  );
};

const hasValidBenignFields = (
  value: Record<string, unknown>,
): boolean =>
  includes(DESKTOP_LOCALES, value['locale']) &&
  includes(INTERFACE_SCALES, value['interfaceScale']) &&
  includes(MOTION_PREFERENCES, value['motion']) &&
  includes(DENSITY_PREFERENCES, value['density']) &&
  includes(DATA_TEXT_PREFERENCES, value['dataText']) &&
  typeof value['trayEnabled'] === 'boolean';

export const detectDesktopLocale = (
  windowsLocale: string | undefined,
): DesktopLocale => {
  if (windowsLocale === undefined || windowsLocale.trim() === '') {
    return 'pt-BR';
  }

  return windowsLocale.trim().toLocaleLowerCase('en-US') === 'pt-br'
    ? 'pt-BR'
    : 'en-US';
};

export const createDefaultPreferences = (
  windowsLocale: string | undefined,
): Readonly<DesktopPreferences> =>
  freezePreferences({
    version: PREFERENCE_VERSION,
    locale: detectDesktopLocale(windowsLocale),
    localeSource: 'automatic',
    interfaceScale: 100,
    motion: 'system',
    density: 'comfortable',
    dataText: 'standard',
    trayEnabled: false,
  });

export const reducePreferences = (
  current: DesktopPreferences,
  event: PreferenceEvent,
): Readonly<DesktopPreferences> => {
  switch (event.type) {
    case 'set-locale':
      return freezePreferences({
        ...current,
        locale: event.locale,
        localeSource: 'explicit',
      });
    case 'set-interface-scale':
      return freezePreferences({
        ...current,
        interfaceScale: event.scale,
      });
    case 'set-motion':
      return freezePreferences({ ...current, motion: event.motion });
    case 'set-density':
      return freezePreferences({ ...current, density: event.density });
    case 'set-data-text':
      return freezePreferences({ ...current, dataText: event.dataText });
    case 'set-tray-enabled':
      return freezePreferences({
        ...current,
        trayEnabled: event.enabled,
      });
  }
};

const isDesktopPreferences = (
  candidate: unknown,
): candidate is DesktopPreferences => {
  if (
    candidate === null ||
    typeof candidate !== 'object' ||
    Array.isArray(candidate)
  ) {
    return false;
  }

  const value = candidate as Record<string, unknown>;
  return (
    hasExactKeys(value, CURRENT_PREFERENCE_KEYS) &&
    value['version'] === PREFERENCE_VERSION &&
    includes(LOCALE_SOURCES, value['localeSource']) &&
    hasValidBenignFields(value)
  );
};

const isLegacyDesktopPreferences = (
  candidate: unknown,
): candidate is LegacyDesktopPreferences => {
  if (
    candidate === null ||
    typeof candidate !== 'object' ||
    Array.isArray(candidate)
  ) {
    return false;
  }

  const value = candidate as Record<string, unknown>;
  return (
    hasExactKeys(value, LEGACY_PREFERENCE_KEYS) &&
    (value['version'] === 1 || value['version'] === 2) &&
    hasValidBenignFields(value)
  );
};

export const serializePreferences = (
  preferences: DesktopPreferences,
): Readonly<DesktopPreferences> =>
  freezePreferences({
    version: PREFERENCE_VERSION,
    locale: preferences.locale,
    localeSource: preferences.localeSource,
    interfaceScale: preferences.interfaceScale,
    motion: preferences.motion,
    density: preferences.density,
    dataText: preferences.dataText,
    trayEnabled: preferences.trayEnabled,
  });

const migrateLegacyPreferences = (
  preferences: LegacyDesktopPreferences,
): Readonly<DesktopPreferences> =>
  freezePreferences({
    version: PREFERENCE_VERSION,
    locale: 'pt-BR',
    localeSource: 'automatic',
    interfaceScale: preferences.interfaceScale,
    motion: preferences.motion,
    density: preferences.density,
    dataText: preferences.dataText,
    trayEnabled: preferences.trayEnabled,
  });

export const restorePreferences = (
  candidate: unknown,
  windowsLocale: string | undefined,
): PreferenceRestoreResult => {
  if (isDesktopPreferences(candidate)) {
    return Object.freeze({
      ok: true,
      migrated: false,
      preferences: serializePreferences(candidate),
    });
  }

  if (isLegacyDesktopPreferences(candidate)) {
    return Object.freeze({
      ok: true,
      migrated: true,
      preferences: migrateLegacyPreferences(candidate),
    });
  }

  return Object.freeze({
    ok: false,
    reason: 'invalid-preferences',
    preferences: createDefaultPreferences(windowsLocale),
  });
};

export const selectCloseBehavior = (
  preferences: DesktopPreferences,
): 'exit' | 'keep-in-tray' =>
  preferences.trayEnabled ? 'keep-in-tray' : 'exit';

export const selectDensityMetrics = (
  density: DensityPreference,
): Readonly<DensityMetrics> =>
  Object.freeze({
    minimumTargetPx: 44,
    bodyFontPx: 15,
    standardRowPx: density === 'compact' ? 44 : 52,
  });
