import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import { listen as tauriListen } from '@tauri-apps/api/event';
import {
  HOST_TO_RENDERER_SHELL_EVENT_SCHEMA_ID,
  RENDERER_TO_HOST_SHELL_COMMAND_SCHEMA_ID,
  validateHostToRendererShellEvent,
  validateRendererToHostShellCommand,
  type HostToRendererShellEventJson,
  type RendererToHostShellCommandJson,
} from '@liiiraa/contracts-ts';

export const HOST_EVENT_CHANNEL = 'desktop-shell-event' as const;
export const RENDERER_COMMAND_NAME = 'dispatch_shell_command' as const;
export const BOOTSTRAP_COMMAND_NAME = 'get_shell_bootstrap' as const;

type HostEventOf<TMessageType extends HostToRendererShellEventJson['messageType']> = Extract<
  HostToRendererShellEventJson,
  { readonly messageType: TMessageType }
>;

export interface ShellBridgeHandlers {
  readonly onInstallerIdentity: (
    event: HostEventOf<'desktop.shell.installer-identity.event'>,
  ) => void;
  readonly onStartupState: (
    event: HostEventOf<'desktop.shell.startup-state-changed.event'>,
  ) => void;
  readonly onNavigation: (event: HostEventOf<'desktop.shell.navigation-requested.event'>) => void;
  readonly onLocale: (event: HostEventOf<'desktop.shell.locale-changed.event'>) => void;
  readonly onTrayPreference: (
    event: HostEventOf<'desktop.shell.tray-preference-changed.event'>,
  ) => void;
  readonly onCloseRequest: (event: HostEventOf<'desktop.shell.close-requested.event'>) => void;
  readonly onNotificationPreference: (
    event: HostEventOf<'desktop.shell.notification-preference-changed.event'>,
  ) => void;
  readonly onWindowState: (event: HostEventOf<'desktop.shell.window-state-changed.event'>) => void;
}

export interface ShellBridgeTransportEvent {
  readonly payload: unknown;
}

export interface ShellBridgeTransport {
  readonly listen: (
    event: string,
    handler: (event: ShellBridgeTransportEvent) => void,
  ) => Promise<() => void>;
  readonly invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown>;
}

export interface ShellBridgeDiagnostic {
  readonly code:
    | 'invalid-host-event'
    | 'invalid-renderer-command'
    | 'host-event-handler-failed'
    | 'host-invoke-failed'
    | 'host-listen-failed';
  readonly direction: 'host-to-renderer' | 'renderer-to-host';
  readonly messageType?: string;
}

export interface ShellBridge {
  readonly start: () => Promise<void>;
  readonly send: (command: RendererToHostShellCommandJson) => Promise<boolean>;
  readonly dispose: () => Promise<void>;
}

export interface CreateShellBridgeOptions {
  readonly handlers: ShellBridgeHandlers;
  readonly onDiagnostic?: (diagnostic: ShellBridgeDiagnostic) => void;
  readonly transport?: ShellBridgeTransport;
}

export const tauriShellBridgeTransport: ShellBridgeTransport = {
  listen: async (event, handler) =>
    tauriListen<unknown>(event, (nativeEvent) => {
      handler({ payload: nativeEvent.payload });
    }),
  invoke: async (command, args) => tauriInvoke(command, args),
};

const boundedMessageType = (value: unknown): string | undefined => {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('messageType' in value) ||
    typeof value.messageType !== 'string'
  ) {
    return undefined;
  }

  return value.messageType.slice(0, 128);
};

const diagnosticFor = (
  code: ShellBridgeDiagnostic['code'],
  direction: ShellBridgeDiagnostic['direction'],
  value: unknown,
): ShellBridgeDiagnostic => {
  const messageType = boundedMessageType(value);
  return Object.freeze({
    code,
    direction,
    ...(messageType === undefined ? {} : { messageType }),
  });
};

const dispatchHostEvent = (
  event: HostToRendererShellEventJson,
  handlers: ShellBridgeHandlers,
): void => {
  switch (event.messageType) {
    case 'desktop.shell.installer-identity.event':
      handlers.onInstallerIdentity(event);
      return;
    case 'desktop.shell.startup-state-changed.event':
      handlers.onStartupState(event);
      return;
    case 'desktop.shell.navigation-requested.event':
      handlers.onNavigation(event);
      return;
    case 'desktop.shell.locale-changed.event':
      handlers.onLocale(event);
      return;
    case 'desktop.shell.tray-preference-changed.event':
      handlers.onTrayPreference(event);
      return;
    case 'desktop.shell.close-requested.event':
      handlers.onCloseRequest(event);
      return;
    case 'desktop.shell.notification-preference-changed.event':
      handlers.onNotificationPreference(event);
      return;
    case 'desktop.shell.window-state-changed.event':
      handlers.onWindowState(event);
      return;
  }
};

export const createShellBridge = ({
  handlers,
  onDiagnostic = () => undefined,
  transport = tauriShellBridgeTransport,
}: CreateShellBridgeOptions): ShellBridge => {
  let startPromise: Promise<void> | undefined;
  let unlisten: (() => void) | undefined;

  const report = (
    code: ShellBridgeDiagnostic['code'],
    direction: ShellBridgeDiagnostic['direction'],
    value: unknown,
  ): void => {
    onDiagnostic(diagnosticFor(code, direction, value));
  };

  const handleHostEvent = ({ payload }: ShellBridgeTransportEvent): void => {
    const result = validateHostToRendererShellEvent(
      HOST_TO_RENDERER_SHELL_EVENT_SCHEMA_ID,
      payload,
    );
    if (!result.ok) {
      report('invalid-host-event', 'host-to-renderer', payload);
      return;
    }

    try {
      dispatchHostEvent(result.value, handlers);
    } catch {
      report('host-event-handler-failed', 'host-to-renderer', result.value);
    }
  };

  const start = (): Promise<void> => {
    if (startPromise !== undefined) {
      return startPromise;
    }

    startPromise = transport
      .listen(HOST_EVENT_CHANNEL, handleHostEvent)
      .then(async (disposeListener) => {
        unlisten = disposeListener;
        const snapshot = await transport.invoke(BOOTSTRAP_COMMAND_NAME);
        if (Array.isArray(snapshot)) {
          for (const payload of snapshot) {
            handleHostEvent({ payload });
          }
        }
      })
      .catch((error: unknown) => {
        startPromise = undefined;
        report('host-listen-failed', 'host-to-renderer', error);
        throw error;
      });

    return startPromise;
  };

  const send = async (command: RendererToHostShellCommandJson): Promise<boolean> => {
    const result = validateRendererToHostShellCommand(
      RENDERER_TO_HOST_SHELL_COMMAND_SCHEMA_ID,
      command,
    );
    if (!result.ok) {
      report('invalid-renderer-command', 'renderer-to-host', command);
      return false;
    }

    try {
      await transport.invoke(RENDERER_COMMAND_NAME, { message: result.value });
      return true;
    } catch (error: unknown) {
      report('host-invoke-failed', 'renderer-to-host', error);
      return false;
    }
  };

  const dispose = async (): Promise<void> => {
    if (startPromise !== undefined) {
      try {
        await startPromise;
      } catch {
        return;
      }
    }

    unlisten?.();
    unlisten = undefined;
    startPromise = undefined;
  };

  return Object.freeze({ dispose, send, start });
};

export type { HostToRendererShellEventJson, RendererToHostShellCommandJson };
