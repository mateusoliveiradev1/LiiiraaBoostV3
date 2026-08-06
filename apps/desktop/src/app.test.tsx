/// <reference types="node" />
import { readFileSync } from 'node:fs';

import type { ReactNode } from 'react';
import type { HostToRendererShellEventJson } from '@liiiraa/contracts-ts';
// @ts-expect-error The approved runtime includes react-dom, but @types/react-dom is not an approved identity.
import { renderToStaticMarkup as reactRenderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  createNativeShellComposition,
  createNativeHostCommandRelay,
  DesktopRouteOutlet,
  DesktopApp,
  SHELL_OPERATIONAL_STATES,
  getOperationalPresentation,
  getResponsiveShellLayout,
  routeForNativeNavigation,
  runDesktopWindowAction,
} from './app.js';
import type { ShellBridgeTransport } from './native/shell-bridge.js';
import {
  DESKTOP_F6_REGIONS,
  createDesktopNavigator,
  desktopRouteTree,
  resolveDesktopRoute,
} from './routes.js';

const renderToStaticMarkup = reactRenderToStaticMarkup as (node: ReactNode) => string;

const concretePathFor = (pattern: string): string =>
  pattern
    .replace(':gameId', 'northstar-arena')
    .replace(':sessionId', 'session-s01')
    .replace(':componentId', 'cpu-power')
    .replace(':operationId', 'balanced-power')
    .replace(':planId', 'plan-s01')
    .replace(':documentId', 'local-overview');

const semanticFindings = (markup: string): readonly string[] => {
  const findings: string[] = [];
  const ids = [...markup.matchAll(/\sid="([^"]+)"/gu)].map((match) => match[1]);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicateIds.length > 0) {
    findings.push(`duplicate ids: ${duplicateIds.join(', ')}`);
  }
  if (markup.match(/<main(?:\s|>)/gu)?.length !== 1) {
    findings.push('main landmark count');
  }
  if (markup.match(/<h1(?:\s|>)/gu)?.length !== 1) {
    findings.push('H1 count');
  }
  if (markup.includes('tabindex="1"')) {
    findings.push('positive tabindex');
  }
  if (markup.includes('undefined')) {
    findings.push('unresolved value');
  }
  return findings;
};

describe('native window controls', () => {
  it('dispatches minimize exactly once to the current window adapter', async () => {
    const windowAdapter = {
      close: vi.fn(() => Promise.resolve()),
      minimize: vi.fn(() => Promise.resolve()),
      toggleMaximize: vi.fn(() => Promise.resolve()),
    };

    await expect(runDesktopWindowAction('minimize', windowAdapter)).resolves.toBe(true);
    expect(windowAdapter.minimize).toHaveBeenCalledTimes(1);
    expect(windowAdapter.close).not.toHaveBeenCalled();
    expect(windowAdapter.toggleMaximize).not.toHaveBeenCalled();
  });

  it('queues startup preferences until the native bridge is ready', () => {
    const relay = createNativeHostCommandRelay();
    const bridge = {
      send: vi.fn(() => Promise.resolve(true)),
    };
    const command = {
      schemaVersion: '1.0',
      messageType: 'desktop.shell.set-tray-preference.command',
      requestId: 'request-tray-relay-0001',
      issuedAt: '2026-08-06T12:00:00.000Z',
      payload: { preference: 'keep-game-detection-in-tray' },
    } as const;

    relay.send(command);
    expect(bridge.send).not.toHaveBeenCalled();

    relay.attach(bridge);
    expect(bridge.send).toHaveBeenCalledOnce();
    expect(bridge.send).toHaveBeenCalledWith(command);
  });
});

describe('app shell smoke', () => {
  it('renders the native About route from the validated installer identity without demo copy', () => {
    const route = resolveDesktopRoute('/about');
    expect(route.ok).toBe(true);
    if (!route.ok) return;

    const markup = renderToStaticMarkup(
      <DesktopRouteOutlet
        installerIdentity={{
          publisher: 'Liiiraa Boost',
          version: '0.0.1',
          channel: 'development',
          windowsCompatibility: { kind: 'supported', detectedBuild: 26_200, minimumBuild: 19_045 },
        }}
        locale="pt-BR"
        navigate={() => undefined}
        route={route.value}
        scenarioId="S01"
      />,
    );

    expect(markup).toContain('0.0.1');
    expect(markup).toContain('Canal de desenvolvimento');
    expect(markup).not.toMatch(/0\.0\.0|Fase 2|SIMULAÇÃO SEGURA|Demonstração segura/iu);
  });

  it('mounts every typed route at every locked responsive width with one main and one H1', () => {
    const lockedWidths = [1440, 1280, 960, 760] as const;

    for (const definition of desktopRouteTree) {
      for (const viewportWidth of lockedWidths) {
        const markup = renderToStaticMarkup(
          <DesktopApp
            initialPath={concretePathFor(definition.pattern)}
            scenarioId="S01"
            viewportWidth={viewportWidth}
          />,
        );

        const routeCase = `${definition.pattern} at ${String(viewportWidth)}px`;
        expect(
          markup.match(/<main(?:\s|>)/gu),
          `${routeCase} must expose exactly one main landmark`,
        ).toHaveLength(1);
        expect(
          markup.match(/<h1(?:\s|>)/gu),
          `${routeCase} must expose exactly one H1`,
        ).toHaveLength(1);
        expect(markup).toContain(`data-viewport-width="${String(viewportWidth)}"`);
        expect(markup).toContain('DEMO');
        expect(markup).toContain('S01');
        expect(markup).not.toContain('undefined');
      }
    }
  });
});

describe('shell semantics', () => {
  it('renders every closed operational state with a localized reason and safe next action', () => {
    expect(SHELL_OPERATIONAL_STATES).toEqual([
      'loading',
      'empty',
      'offline',
      'permission',
      'unsupported',
      'partial-failure',
      'restart-pending',
      'recovery',
      'expired-entitlement',
      'stale-evidence',
      'contradictory-evidence',
      'fixture',
    ]);

    for (const state of SHELL_OPERATIONAL_STATES) {
      for (const locale of ['pt-BR', 'en-US'] as const) {
        const presentation = getOperationalPresentation(state, locale === 'pt-BR' ? 'pt-BR' : 'en');
        const markup = renderToStaticMarkup(
          <DesktopApp
            appScale={150}
            forcedColors
            initialPath="/home"
            operationalState={state}
            reducedMotion
            scenarioId="S24"
            textScale={200}
            viewportWidth={760}
            windowsLocale={locale}
          />,
        );

        expect(markup).toContain(`data-operational-state="${state}"`);
        expect(markup).toContain('data-app-scale="150"');
        expect(markup).toContain('data-text-scale="200"');
        expect(markup).toContain('data-forced-colors="active"');
        expect(markup).toContain('data-motion="reduced"');
        expect(markup).toContain('data-page-horizontal-scroll="forbidden"');
        expect(markup).toContain(presentation.action);
        expect(markup).toContain('S24');
        expect(semanticFindings(markup)).toEqual([]);
      }
    }
  });

  it('keeps all F6 regions ordered and cycles them without skipping the inspector', () => {
    const focused: string[] = [];
    const navigator = createDesktopNavigator({
      focusRegion: (region) => {
        focused.push(region);
      },
      initialPath: '/home',
    });

    DESKTOP_F6_REGIONS.forEach(() => {
      navigator.handleKeyboard({ key: 'F6' });
    });

    expect(focused).toEqual(DESKTOP_F6_REGIONS);

    const markup = renderToStaticMarkup(<DesktopApp initialPath="/home" viewportWidth={1280} />);
    expect([...markup.matchAll(/data-focus-region="([^"]+)"/gu)].map((match) => match[1])).toEqual(
      DESKTOP_F6_REGIONS,
    );
  });
});

describe('scale smoke', () => {
  it.each([
    [1440, 'wide', 216, 'persistent'],
    [1280, 'standard', 200, 'overlay'],
    [960, 'compact', 72, 'overlay'],
    [760, 'minimum', 64, 'overlay'],
  ] as const)(
    'projects %ipx to the locked responsive shell contract',
    (viewportWidth, width, railWidth, inspectorMode) => {
      expect(getResponsiveShellLayout(viewportWidth)).toEqual({
        inspectorMode,
        pageHorizontalScroll: 'forbidden',
        railWidth,
        width,
      });

      const markup = renderToStaticMarkup(
        <DesktopApp
          appScale={150}
          initialPath="/recover/emergency"
          operationalState="recovery"
          textScale={200}
          viewportWidth={viewportWidth}
        />,
      );
      const responsiveWidth = viewportWidth / 1.5;
      const scaledLayout = getResponsiveShellLayout(responsiveWidth);
      expect(markup).toContain(`data-responsive-width="${String(Math.round(responsiveWidth))}"`);
      expect(markup).toContain(`data-shell-width="${scaledLayout.width}"`);
      expect(markup).toContain(`data-goal-rail-width="${String(scaledLayout.railWidth)}"`);
      expect(markup).toContain(`data-inspector-mode="${scaledLayout.inspectorMode}"`);
      expect(markup).toContain('data-page-horizontal-scroll="forbidden"');
      expect(semanticFindings(markup)).toEqual([]);
    },
  );
});

describe('native composition smoke', () => {
  it('keeps the packaged authentication surface real and removes the demo escape hatch', () => {
    const accountSource = readFileSync(
      new URL('./features/account-experience.tsx', import.meta.url),
      'utf8',
    );
    const loginSurface = accountSource.slice(
      accountSource.indexOf('const LoginSurface'),
      accountSource.indexOf('const AccountTabs'),
    );
    const mainSource = readFileSync(new URL('../src-tauri/src/main.rs', import.meta.url), 'utf8');

    expect(loginSurface).not.toContain('Protected local preview');
    expect(loginSurface).not.toContain('Prévia local protegida');
    expect(loginSurface).not.toContain('Explore demo mode');
    expect(loginSurface).not.toContain('Explorar modo demonstração');
    expect(loginSurface).not.toContain('data-auth-action="offline-demo"');
    expect(loginSurface).toContain('data-auth-mode="system-browser"');
    expect(mainSource).toContain('DesktopRuntimeOrigins');
    expect(mainSource).not.toContain('WindowsDesktopIdentityApi::from_environment()');
  });

  it('projects every validated host event and disposes one deduplicated listener', async () => {
    let listener: ((event: { readonly payload: unknown }) => void) | undefined;
    let listenCalls = 0;
    const unlisten = vi.fn();
    const transport: ShellBridgeTransport = {
      listen: (_channel, handler) => {
        listenCalls += 1;
        listener = handler;
        return Promise.resolve(unlisten);
      },
      invoke: () => Promise.resolve(undefined),
    };
    const observed: HostToRendererShellEventJson[] = [];
    const installerIdentities: unknown[] = [];
    const startupStates: unknown[] = [];
    const navigations: unknown[] = [];
    const hostPreferences: unknown[] = [];
    const closeContexts: unknown[] = [];
    const notificationPreferences: unknown[] = [];
    const windowStates: unknown[] = [];
    const diagnostics: unknown[] = [];
    const events = [
      {
        schemaVersion: '1.0',
        messageType: 'desktop.shell.installer-identity.event',
        requestId: 'native-smoke-installer',
        issuedAt: '2026-07-28T09:00:00.000Z',
        payload: {
          installer: {
            publisher: 'Liiiraa Boost Development',
            version: '0.2.0',
            channel: 'development',
            windowsCompatibility: {
              kind: 'supported',
              detectedBuild: 26100,
              minimumBuild: 19045,
            },
          },
        },
      },
      {
        schemaVersion: '1.0',
        messageType: 'desktop.shell.startup-state-changed.event',
        requestId: 'native-smoke-startup',
        issuedAt: '2026-07-28T09:00:01.000Z',
        payload: {
          state: { kind: 'splash', step: 'validating-installation' },
        },
      },
      {
        schemaVersion: '1.0',
        messageType: 'desktop.shell.navigation-requested.event',
        requestId: 'native-smoke-navigation',
        issuedAt: '2026-07-28T09:00:02.000Z',
        payload: {
          source: 'tray',
          intent: { kind: 'settings', destination: 'privacy' },
        },
      },
      {
        schemaVersion: '1.0',
        messageType: 'desktop.shell.locale-changed.event',
        requestId: 'native-smoke-locale',
        issuedAt: '2026-07-28T09:00:03.000Z',
        payload: { locale: 'pt-BR' },
      },
      {
        schemaVersion: '1.0',
        messageType: 'desktop.shell.tray-preference-changed.event',
        requestId: 'native-smoke-tray',
        issuedAt: '2026-07-28T09:00:04.000Z',
        payload: { preference: 'keep-game-detection-in-tray' },
      },
      {
        schemaVersion: '1.0',
        messageType: 'desktop.shell.close-requested.event',
        requestId: 'native-smoke-close',
        issuedAt: '2026-07-28T09:00:05.000Z',
        payload: { context: { kind: 'recovery-in-progress' } },
      },
      {
        schemaVersion: '1.0',
        messageType: 'desktop.shell.notification-preference-changed.event',
        requestId: 'native-smoke-notification',
        issuedAt: '2026-07-28T09:00:06.000Z',
        payload: {
          preference: {
            enabled: true,
            focusAssist: 'respect',
            categories: ['recovery-required'],
          },
        },
      },
      {
        schemaVersion: '1.0',
        messageType: 'desktop.shell.window-state-changed.event',
        requestId: 'native-smoke-window',
        issuedAt: '2026-07-28T09:00:07.000Z',
        payload: {
          state: {
            kind: 'normal',
            monitorId: 'primary-monitor',
            x: 80,
            y: 60,
            width: 1280,
            height: 800,
          },
        },
      },
    ] as const satisfies readonly HostToRendererShellEventJson[];
    const bridge = createNativeShellComposition({
      callbacks: {
        onCloseRequest: (context) => {
          closeContexts.push(context);
        },
        onDiagnostic: (diagnostic) => {
          diagnostics.push(diagnostic);
        },
        onEvent: (event) => {
          observed.push(event);
        },
        onHostPreference: (event) => {
          hostPreferences.push(event);
        },
        onInstallerIdentity: (identity) => {
          installerIdentities.push(identity);
        },
        onNavigation: (pathname, requestId) => {
          navigations.push({ pathname, requestId });
        },
        onNotificationPreference: (preference) => {
          notificationPreferences.push(preference);
        },
        onStartupState: (state) => {
          startupStates.push(state);
        },
        onWindowState: (state) => {
          windowStates.push(state);
        },
      },
      transport,
    });

    await Promise.all([bridge.start(), bridge.start()]);
    for (const event of events) {
      listener?.({ payload: event });
    }

    expect(listenCalls).toBe(1);
    expect(observed).toEqual(events);
    expect(installerIdentities).toHaveLength(1);
    expect(startupStates).toEqual([{ kind: 'splash', step: 'validating-installation' }]);
    expect(navigations).toEqual([
      {
        pathname: '/settings/privacy',
        requestId: 'native-smoke-navigation',
      },
    ]);
    expect(hostPreferences).toEqual([
      { type: 'set-locale', locale: 'pt-BR' },
      { type: 'set-tray-enabled', enabled: true },
    ]);
    expect(closeContexts).toEqual([{ kind: 'recovery-in-progress' }]);
    expect(notificationPreferences).toHaveLength(1);
    expect(windowStates).toEqual([
      {
        kind: 'normal',
        monitorId: 'primary-monitor',
        x: 80,
        y: 60,
        width: 1280,
        height: 800,
      },
    ]);
    expect(diagnostics).toEqual([]);

    await bridge.dispose();
    expect(unlisten).toHaveBeenCalledTimes(1);
  });

  it('maps every navigation family and shows native startup before the route shell', () => {
    expect(routeForNativeNavigation({ kind: 'goal', destination: 'activity' })).toBe('/activity');
    expect(routeForNativeNavigation({ kind: 'settings', destination: 'updates' })).toBe(
      '/settings/updates',
    );
    expect(routeForNativeNavigation({ kind: 'calibration', destination: 'summary' })).toBe(
      '/calibration/summary',
    );
    expect(
      routeForNativeNavigation({
        kind: 'documentation',
        documentId: 'startup recovery',
      }),
    ).toBe('/documentation/startup%20recovery');

    const markup = renderToStaticMarkup(
      <DesktopApp nativeShell viewportWidth={1280} windowsLocale="pt-BR" />,
    );
    expect(markup).toContain('data-startup-kind="splash"');
    expect(markup).toContain('Primeira abertura local');
    expect(markup).not.toContain('data-viewport-width="1280"');
  });
});
