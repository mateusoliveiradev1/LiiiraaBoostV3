import { createElement, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DesktopApp, SHELL_OPERATIONAL_STATES } from './app.js';
import type { DesktopAppProps, ShellOperationalState } from './app.js';

export interface DesktopCompositionBootstrap {
  readonly mount: () => void;
  readonly dispose: () => void;
}

const TEST_SCENARIO_PATTERN = /^S(?:0[1-9]|1[0-9]|2[0-4])$/u;
const TEST_SCALE_VALUES = new Set([100, 125, 150]);
const TEST_TEXT_SCALE_VALUES = new Set([100, 200]);
const TEST_OPERATIONAL_STATES = new Set<ShellOperationalState>(SHELL_OPERATIONAL_STATES);
const TEST_PREMIUM_AUTHORITY_STATES = new Set([
  'approaching-expiry',
  'clock-rollback',
  'contradictory',
  'expired',
  'offline-valid',
  'revoked',
  'stale',
  'tampered',
  'verified',
]);

const asRecord = (value: unknown): Readonly<Record<string, unknown>> | undefined =>
  typeof value === 'object' && value !== null
    ? (value as Readonly<Record<string, unknown>>)
    : undefined;

const readDesktopTestComposition = (): DesktopAppProps => {
  if (!import.meta.env.DEV) return Object.freeze({});
  const testState = asRecord(Reflect.get(globalThis, '__LIIIRAA_DESKTOP_TEST__'));
  const scenario = asRecord(testState?.['scenario']);
  const composition = asRecord(Reflect.get(globalThis, '__LIIIRAA_DESKTOP_COMPOSITION__'));

  if (scenario?.['marker'] !== 'SIMULATED SCENARIO' || composition === undefined) {
    return Object.freeze({});
  }

  const appScale = composition['appScale'];
  const catalogLocale = composition['catalogLocale'];
  const initialPath = composition['initialPath'];
  const operationalState = composition['operationalState'];
  const premiumAuthorityState = composition['premiumAuthorityState'];
  const scenarioId = composition['scenarioId'];
  const textScale = composition['textScale'];
  const viewportWidth = composition['viewportWidth'];
  const windowsLocale = composition['windowsLocale'];

  if (
    typeof initialPath !== 'string' ||
    typeof operationalState !== 'string' ||
    !TEST_OPERATIONAL_STATES.has(operationalState as ShellOperationalState) ||
    typeof scenarioId !== 'string' ||
    !TEST_SCENARIO_PATTERN.test(scenarioId) ||
    typeof windowsLocale !== 'string'
  ) {
    return Object.freeze({});
  }

  return Object.freeze({
    initialPath,
    operationalState: operationalState as ShellOperationalState,
    ...(TEST_PREMIUM_AUTHORITY_STATES.has(premiumAuthorityState as string)
      ? {
          premiumAuthorityState: premiumAuthorityState as NonNullable<
            DesktopAppProps['premiumAuthorityState']
          >,
        }
      : {}),
    scenarioId,
    windowsLocale,
    ...(catalogLocale === 'pseudo' ? { catalogLocale } : {}),
    ...(TEST_SCALE_VALUES.has(appScale as number) ? { appScale: appScale as 100 | 125 | 150 } : {}),
    ...(typeof composition['forcedColors'] === 'boolean'
      ? { forcedColors: composition['forcedColors'] }
      : {}),
    ...(typeof composition['reducedMotion'] === 'boolean'
      ? { reducedMotion: composition['reducedMotion'] }
      : {}),
    ...(TEST_TEXT_SCALE_VALUES.has(textScale as number)
      ? { textScale: textScale as 100 | 200 }
      : {}),
    ...(typeof viewportWidth === 'number' && viewportWidth >= 320 && viewportWidth <= 7680
      ? { viewportWidth }
      : {}),
  });
};

export const createDesktopCompositionBootstrap = (
  rootElement: HTMLElement,
  appProps: DesktopAppProps = {},
): DesktopCompositionBootstrap => {
  const root = createRoot(rootElement);
  let mounted = false;

  return Object.freeze({
    mount: () => {
      if (mounted) {
        return;
      }
      root.render(createElement(StrictMode, null, createElement(DesktopApp, appProps)));
      mounted = true;
    },
    dispose: () => {
      if (!mounted) {
        return;
      }
      root.unmount();
      mounted = false;
    },
  });
};

export const mountDesktopApp = (
  rootElement: HTMLElement | null = typeof document === 'undefined'
    ? null
    : document.getElementById('root'),
  appProps: DesktopAppProps = readDesktopTestComposition(),
): DesktopCompositionBootstrap => {
  if (rootElement === null) {
    throw new Error('Desktop root element "#root" was not found.');
  }
  const bootstrap = createDesktopCompositionBootstrap(rootElement, appProps);
  bootstrap.mount();
  return bootstrap;
};

if (typeof document !== 'undefined' && document.getElementById('root') !== null) {
  mountDesktopApp();
}

export {
  DesktopApp,
  DesktopRouteOutlet,
  SHELL_OPERATIONAL_STATES,
  getOperationalPresentation,
  getResponsiveShellLayout,
} from './app.js';
export type {
  DesktopAppProps,
  DesktopRouteOutletProps,
  ResponsiveShellLayout,
  ShellOperationalState,
  ShellWidth,
} from './app.js';
export {
  DESKTOP_F6_REGIONS,
  createDesktopNavigator,
  desktopRouteTree,
  resolveDesktopRoute,
} from './routes.js';
export {
  DesktopPreferencesProvider,
  PreConsentLocaleControl,
  useDesktopPreferences,
} from './preferences.js';
