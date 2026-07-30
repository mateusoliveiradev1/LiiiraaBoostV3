import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import enCatalog from './en.json' with { type: 'json' };
import pseudoCatalog from './pseudo.json' with { type: 'json' };
import ptBrCatalog from './pt-BR.json' with { type: 'json' };

export const SHIPPING_LOCALES = Object.freeze(['pt-BR', 'en-US'] as const);
export type ShippingLocale = (typeof SHIPPING_LOCALES)[number];
export type CatalogLocale = ShippingLocale | 'pseudo';
export type MessageId = keyof typeof ptBrCatalog;
export type MessageValues = Readonly<Record<string, string | number>>;

type MessageCatalog = Readonly<Record<MessageId, string>>;

export const MESSAGE_CATALOGS = Object.freeze({
  'pt-BR': Object.freeze(ptBrCatalog) as MessageCatalog,
  'en-US': Object.freeze(enCatalog) as MessageCatalog,
  pseudo: Object.freeze(pseudoCatalog) as MessageCatalog,
} satisfies Readonly<Record<CatalogLocale, MessageCatalog>>);

export const FEATURE_MESSAGE_IDS = Object.freeze([
  'calibration.step.trustPrivacy',
  'calibration.step.systemInventory',
  'calibration.step.performanceDiagnosis',
  'calibration.step.recoveryReadiness',
  'calibration.step.goals',
  'calibration.step.priorityGames',
  'calibration.step.review',
  'calibration.action.continue',
  'calibration.defer.saved',
  'calibration.error.inventoryFailed',
  'calibration.error.permissionDenied',
  'calibration.error.snapshotInvalid',
  'calibration.revalidation.hardwareChanged',
  'calibration.revalidation.stale',
  'calibration.evidence.complete',
  'calibration.evidence.unavailable',
  'calibration.evidence.stale',
  'calibration.evidence.unknown',
] as const satisfies readonly MessageId[]);

export const CRITICAL_MESSAGE_IDS = Object.freeze([
  'navigation.home',
  'navigation.prepare',
  'navigation.improve',
  'navigation.measure',
  'navigation.recover',
  'navigation.assistant',
  'dialog.confirm.title',
  'dialog.confirm.body',
  'dialog.permission.title',
  'dialog.permission.body',
  'dialog.restart.title',
  'dialog.restart.body',
  'dialog.recovery.title',
  'dialog.recovery.body',
  'error.offline',
  'error.unsupported',
  'error.permissionDenied',
  'error.partialFailure',
  'error.invalidPreferences',
  'error.translationMissing',
  'confirmation.verified.token',
  'confirmation.advanced.token',
  'confirmation.extreme.token',
] as const satisfies readonly MessageId[]);

const localeKeys = (locale: CatalogLocale): readonly string[] =>
  Object.keys(MESSAGE_CATALOGS[locale]).toSorted();

export const assertCatalogParity = (): Readonly<{
  localeCount: 3;
  messageCount: number;
}> => {
  const referenceKeys = localeKeys('pt-BR');

  for (const locale of ['en-US', 'pseudo'] as const) {
    const candidateKeys = localeKeys(locale);
    if (
      candidateKeys.length !== referenceKeys.length ||
      candidateKeys.some((key, index) => key !== referenceKeys[index])
    ) {
      throw new Error(`Catalog parity failed for ${locale}.`);
    }
  }

  for (const messageId of CRITICAL_MESSAGE_IDS) {
    for (const locale of SHIPPING_LOCALES) {
      if (MESSAGE_CATALOGS[locale][messageId].trim() === '') {
        throw new Error(`Missing product-critical message "${messageId}" for ${locale}.`);
      }
    }
  }

  return Object.freeze({
    localeCount: 3,
    messageCount: referenceKeys.length,
  });
};

export const CATALOG_PARITY = assertCatalogParity();

export const detectLocale = (windowsLocale: string | undefined): ShippingLocale =>
  windowsLocale?.trim().toLocaleLowerCase('en-US') === 'pt-br' ? 'pt-BR' : 'en-US';

export const formatMessage = (
  locale: CatalogLocale,
  messageId: MessageId,
  values: MessageValues = {},
): string => {
  const template = (MESSAGE_CATALOGS[locale] as Partial<MessageCatalog>)[messageId];

  if (typeof template !== 'string' || template.trim() === '') {
    throw new Error(`Missing product-critical message "${messageId}" for ${locale}.`);
  }

  return template.replaceAll(/\{([A-Za-z][A-Za-z0-9]*)\}/gu, (token: string, key: string) => {
    const value = values[key];
    return value === undefined ? token : String(value);
  });
};

export const formatNumber = (value: number, locale: ShippingLocale): string =>
  new Intl.NumberFormat(locale, {
    maximumFractionDigits: 3,
  }).format(value);

export const formatDate = (value: Date | number, locale: ShippingLocale): string =>
  new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    hour: '2-digit',
    hour12: locale === 'en-US',
    minute: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(value);

export const formatStorage = (gigabytes: number, locale: ShippingLocale): string =>
  new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
    style: 'unit',
    unit: 'gigabyte',
    unitDisplay: 'short',
  }).format(gigabytes);

export const formatTemperature = (celsius: number, locale: ShippingLocale): string =>
  new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    style: 'unit',
    unit: 'celsius',
    unitDisplay: 'short',
  }).format(celsius);

export const formatDuration = (milliseconds: number, locale: ShippingLocale): string =>
  new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
    style: 'unit',
    unit: 'millisecond',
    unitDisplay: 'short',
  }).format(milliseconds);

const PSEUDO_ACCENTS: Readonly<Record<string, string>> = Object.freeze({
  A: 'Å',
  E: 'Ë',
  I: 'Ï',
  O: 'Ø',
  U: 'Û',
  a: 'á',
  e: 'ë',
  i: 'ï',
  o: 'ø',
  u: 'ü',
});

export const pseudoExpand = (source: string): string => {
  const accented = Array.from(source, (character) => {
    return PSEUDO_ACCENTS[character] ?? character;
  }).join('');
  const targetLength = Math.ceil(source.length * 1.35);
  const paddingLength = Math.max(0, targetLength - accented.length);

  return `⟦${accented}${'~'.repeat(paddingLength)}⟧`;
};

export interface LocaleContextValue {
  readonly locale: ShippingLocale;
  readonly setLocale: (locale: ShippingLocale) => void;
  readonly message: (messageId: MessageId, values?: MessageValues) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export interface LocaleProviderProps {
  readonly children: ReactNode;
  readonly initialWindowsLocale?: string;
  readonly locale?: ShippingLocale;
  readonly onLocaleChange?: (locale: ShippingLocale) => void;
}

export const LocaleProvider = ({
  children,
  initialWindowsLocale,
  locale: controlledLocale,
  onLocaleChange,
}: LocaleProviderProps): ReactNode => {
  const [uncontrolledLocale, setUncontrolledLocale] = useState<ShippingLocale>(() =>
    detectLocale(initialWindowsLocale),
  );
  const locale = controlledLocale ?? uncontrolledLocale;
  const setLocale = useCallback(
    (nextLocale: ShippingLocale) => {
      if (controlledLocale === undefined) {
        setUncontrolledLocale(nextLocale);
      }
      onLocaleChange?.(nextLocale);
    },
    [controlledLocale, onLocaleChange],
  );
  const message = useCallback(
    (messageId: MessageId, values?: MessageValues) => formatMessage(locale, messageId, values),
    [locale],
  );
  const value = useMemo<LocaleContextValue>(
    () => Object.freeze({ locale, message, setLocale }),
    [locale, message, setLocale],
  );

  return createElement(LocaleContext.Provider, { value }, children);
};

export const useLocale = (): LocaleContextValue => {
  const context = useContext(LocaleContext);
  if (context === null) {
    throw new Error('useLocale must be used inside LocaleProvider.');
  }
  return context;
};
