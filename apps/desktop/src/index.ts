import { createElement, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DesktopApp } from './app.js';

export interface DesktopCompositionBootstrap {
  readonly mount: () => void;
  readonly dispose: () => void;
}

export const createDesktopCompositionBootstrap = (
  rootElement: HTMLElement,
): DesktopCompositionBootstrap => {
  const root = createRoot(rootElement);
  let mounted = false;

  return Object.freeze({
    mount: () => {
      if (mounted) {
        return;
      }
      root.render(createElement(StrictMode, null, createElement(DesktopApp)));
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
): DesktopCompositionBootstrap => {
  if (rootElement === null) {
    throw new Error('Desktop root element "#root" was not found.');
  }
  const bootstrap = createDesktopCompositionBootstrap(rootElement);
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
