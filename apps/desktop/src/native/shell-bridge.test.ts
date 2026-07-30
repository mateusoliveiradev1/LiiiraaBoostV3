import { describe, expect, it, vi } from 'vitest';
import type { RendererToHostShellCommandJson } from '@liiiraa/contracts-ts';

import {
  HOST_EVENT_CHANNEL,
  RENDERER_COMMAND_NAME,
  createShellBridge,
  type ShellBridgeHandlers,
  type ShellBridgeTransport,
  type ShellBridgeTransportEvent,
} from './shell-bridge.js';

const ISSUED_AT = '2026-07-28T09:00:00.000Z';

const envelope = <TMessageType extends string, TPayload>(
  messageType: TMessageType,
  payload: TPayload,
) =>
  Object.freeze({
    schemaVersion: '1.0' as const,
    messageType,
    requestId: `request-${messageType}`,
    issuedAt: ISSUED_AT,
    payload: Object.freeze(payload),
  });

const hostEvents = [
  envelope('desktop.shell.installer-identity.event', {
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
  }),
  envelope('desktop.shell.startup-state-changed.event', {
    state: { kind: 'splash', step: 'validating-installation' },
  }),
  envelope('desktop.shell.navigation-requested.event', {
    source: 'second-launch',
    intent: { kind: 'goal', destination: 'home' },
  }),
  envelope('desktop.shell.locale-changed.event', { locale: 'pt-BR' }),
  envelope('desktop.shell.tray-preference-changed.event', {
    preference: 'close-window',
  }),
  envelope('desktop.shell.close-requested.event', {
    context: { kind: 'ordinary' },
  }),
  envelope('desktop.shell.notification-preference-changed.event', {
    preference: {
      enabled: true,
      focusAssist: 'respect',
      categories: ['recovery-required'],
    },
  }),
  envelope('desktop.shell.window-state-changed.event', {
    state: {
      kind: 'normal',
      monitorId: 'primary',
      x: 80,
      y: 60,
      width: 1280,
      height: 800,
    },
  }),
] as const;

const rendererCommands = [
  envelope('desktop.shell.navigate.command', {
    intent: { kind: 'goal', destination: 'activity' },
  }),
  envelope('desktop.shell.set-locale.command', { locale: 'en' }),
  envelope('desktop.shell.set-tray-preference.command', {
    preference: 'keep-game-detection-in-tray',
  }),
  envelope('desktop.shell.resolve-close.command', {
    resolution: { context: 'ordinary', decision: 'close-interface' },
  }),
  envelope('desktop.shell.set-notification-preference.command', {
    preference: {
      enabled: true,
      focusAssist: 'respect',
      categories: ['account-security'],
    },
  }),
  envelope('desktop.shell.show-notification.command', {
    category: 'recovery-required',
    title: 'Recovery requires attention',
    body: 'Open Liiiraa Boost to review the safe recovery path.',
    action: { kind: 'goal', destination: 'recover' },
  }),
  envelope('desktop.shell.save-window-state.command', {
    state: {
      kind: 'maximized',
      monitorId: 'primary',
      x: 80,
      y: 60,
      restoreWidth: 1280,
      restoreHeight: 800,
    },
  }),
] as unknown as readonly RendererToHostShellCommandJson[];

const createHarness = () => {
  let listener: ((event: { readonly payload: unknown }) => void) | undefined;
  const unlisten = vi.fn();
  const transport: ShellBridgeTransport = {
    listen: vi.fn((_event: string, handler: (event: ShellBridgeTransportEvent) => void) => {
      listener = handler;
      return Promise.resolve(unlisten);
    }),
    invoke: vi.fn(() => Promise.resolve(undefined)),
  };
  const handlers: ShellBridgeHandlers = {
    onInstallerIdentity: vi.fn(),
    onStartupState: vi.fn(),
    onNavigation: vi.fn(),
    onLocale: vi.fn(),
    onTrayPreference: vi.fn(),
    onCloseRequest: vi.fn(),
    onNotificationPreference: vi.fn(),
    onWindowState: vi.fn(),
  };
  const onDiagnostic = vi.fn();

  return {
    handlers,
    listener: () => listener,
    onDiagnostic,
    transport,
    unlisten,
  };
};

describe('shell bridge', () => {
  it('requests a replayable startup snapshot after registering the listener', async () => {
    const harness = createHarness();
    const bridge = createShellBridge(harness);

    await bridge.start();

    expect(harness.transport.listen).toHaveBeenCalledTimes(1);
    expect(harness.transport.invoke).toHaveBeenCalledWith('get_shell_bootstrap');
  });

  it('validates and dispatches every generated host event exactly once', async () => {
    const harness = createHarness();
    const bridge = createShellBridge(harness);

    await Promise.all([bridge.start(), bridge.start()]);

    expect(harness.transport.listen).toHaveBeenCalledTimes(1);
    expect(harness.transport.listen).toHaveBeenCalledWith(HOST_EVENT_CHANNEL, expect.any(Function));

    for (const event of hostEvents) {
      harness.listener()?.({ payload: event });
    }

    expect(harness.handlers.onInstallerIdentity).toHaveBeenCalledTimes(1);
    expect(harness.handlers.onStartupState).toHaveBeenCalledTimes(1);
    expect(harness.handlers.onNavigation).toHaveBeenCalledTimes(1);
    expect(harness.handlers.onLocale).toHaveBeenCalledTimes(1);
    expect(harness.handlers.onTrayPreference).toHaveBeenCalledTimes(1);
    expect(harness.handlers.onCloseRequest).toHaveBeenCalledTimes(1);
    expect(harness.handlers.onNotificationPreference).toHaveBeenCalledTimes(1);
    expect(harness.handlers.onWindowState).toHaveBeenCalledTimes(1);
    expect(harness.onDiagnostic).not.toHaveBeenCalled();

    await bridge.dispose();
    expect(harness.unlisten).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid host payloads with bounded diagnostics and no state change', async () => {
    const harness = createHarness();
    const bridge = createShellBridge(harness);
    await bridge.start();

    harness.listener()?.({
      payload: {
        messageType: 'desktop.shell.navigation-requested.event',
        token: 'must-not-be-reported',
      },
    });

    for (const handler of Object.values(harness.handlers)) {
      expect(handler).not.toHaveBeenCalled();
    }
    expect(harness.onDiagnostic).toHaveBeenCalledWith({
      code: 'invalid-host-event',
      direction: 'host-to-renderer',
      messageType: 'desktop.shell.navigation-requested.event',
    });
    expect(JSON.stringify(harness.onDiagnostic.mock.calls)).not.toContain('must-not-be-reported');
  });

  it('validates every renderer command before invoking the native host', async () => {
    const harness = createHarness();
    const bridge = createShellBridge(harness);

    for (const command of rendererCommands) {
      await expect(bridge.send(command)).resolves.toBe(true);
    }

    expect(harness.transport.invoke).toHaveBeenCalledTimes(rendererCommands.length);
    for (const command of rendererCommands) {
      expect(harness.transport.invoke).toHaveBeenCalledWith(RENDERER_COMMAND_NAME, {
        message: command,
      });
    }

    await expect(
      bridge.send({
        messageType: 'desktop.shell.execute-arbitrary.command',
        payload: { command: 'SENSITIVE_COMMAND' },
      } as unknown as RendererToHostShellCommandJson),
    ).resolves.toBe(false);
    expect(harness.transport.invoke).toHaveBeenCalledTimes(rendererCommands.length);
    expect(harness.onDiagnostic).toHaveBeenCalledWith({
      code: 'invalid-renderer-command',
      direction: 'renderer-to-host',
      messageType: 'desktop.shell.execute-arbitrary.command',
    });
    expect(JSON.stringify(harness.onDiagnostic.mock.calls)).not.toContain('SENSITIVE_COMMAND');
  });
});
