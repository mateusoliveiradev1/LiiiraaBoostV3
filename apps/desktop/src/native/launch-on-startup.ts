import {
  disable as disableAutostart,
  enable as enableAutostart,
  isEnabled as isAutostartEnabled,
} from '@tauri-apps/plugin-autostart';

export interface LaunchOnStartupAdapter {
  readonly get: () => Promise<boolean>;
  readonly set: (enabled: boolean) => Promise<boolean>;
}

export interface NativeAutostartApi {
  readonly disable: () => Promise<void>;
  readonly enable: () => Promise<void>;
  readonly isEnabled: () => Promise<boolean>;
}

export const createLaunchOnStartupAdapter = (
  nativeApi: NativeAutostartApi,
  nativeAvailable: boolean,
): LaunchOnStartupAdapter =>
  Object.freeze({
    get: async () => {
      if (!nativeAvailable) {
        throw new Error('NATIVE_AUTOSTART_UNAVAILABLE');
      }
      return nativeApi.isEnabled();
    },
    set: async (enabled: boolean) => {
      if (!nativeAvailable) {
        throw new Error('NATIVE_AUTOSTART_UNAVAILABLE');
      }
      if (enabled) {
        await nativeApi.enable();
      } else {
        await nativeApi.disable();
      }
      return nativeApi.isEnabled();
    },
  });

export const launchOnStartup = createLaunchOnStartupAdapter(
  {
    disable: disableAutostart,
    enable: enableAutostart,
    isEnabled: isAutostartEnabled,
  },
  Reflect.has(globalThis, '__TAURI_INTERNALS__'),
);
