import { describe, expect, it, vi } from 'vitest';

import { createLaunchOnStartupAdapter } from './launch-on-startup.js';

describe('launch-on-startup adapter', () => {
  it('reads the current native Windows state', async () => {
    const nativeApi = {
      disable: vi.fn(() => Promise.resolve()),
      enable: vi.fn(() => Promise.resolve()),
      isEnabled: vi.fn(() => Promise.resolve(true)),
    };
    const adapter = createLaunchOnStartupAdapter(nativeApi, true);

    await expect(adapter.get()).resolves.toBe(true);
    expect(nativeApi.isEnabled).toHaveBeenCalledOnce();
  });

  it('writes the requested native state and returns the verified result', async () => {
    const nativeApi = {
      disable: vi.fn(() => Promise.resolve()),
      enable: vi.fn(() => Promise.resolve()),
      isEnabled: vi.fn(() => Promise.resolve(false)),
    };
    const adapter = createLaunchOnStartupAdapter(nativeApi, true);

    await expect(adapter.set(false)).resolves.toBe(false);
    expect(nativeApi.disable).toHaveBeenCalledOnce();
    expect(nativeApi.enable).not.toHaveBeenCalled();
    expect(nativeApi.isEnabled).toHaveBeenCalledOnce();
  });

  it('enables native startup before verifying the result', async () => {
    const nativeApi = {
      disable: vi.fn(() => Promise.resolve()),
      enable: vi.fn(() => Promise.resolve()),
      isEnabled: vi.fn(() => Promise.resolve(true)),
    };
    const adapter = createLaunchOnStartupAdapter(nativeApi, true);

    await expect(adapter.set(true)).resolves.toBe(true);
    expect(nativeApi.enable).toHaveBeenCalledOnce();
    expect(nativeApi.disable).not.toHaveBeenCalled();
    expect(nativeApi.isEnabled).toHaveBeenCalledOnce();
  });

  it('fails closed outside Tauri instead of manufacturing in-memory state', async () => {
    const nativeApi = {
      disable: vi.fn(() => Promise.reject(new Error('native host unavailable'))),
      enable: vi.fn(() => Promise.reject(new Error('native host unavailable'))),
      isEnabled: vi.fn(() => Promise.reject(new Error('native host unavailable'))),
    };
    const adapter = createLaunchOnStartupAdapter(nativeApi, false);

    await expect(adapter.get()).rejects.toThrow('NATIVE_AUTOSTART_UNAVAILABLE');
    await expect(adapter.set(true)).rejects.toThrow('NATIVE_AUTOSTART_UNAVAILABLE');
    expect(nativeApi.disable).not.toHaveBeenCalled();
    expect(nativeApi.enable).not.toHaveBeenCalled();
    expect(nativeApi.isEnabled).not.toHaveBeenCalled();
  });

  it('propagates native failures instead of presenting a false state', async () => {
    const nativeApi = {
      disable: vi.fn(() => Promise.resolve()),
      enable: vi.fn(() => Promise.resolve()),
      isEnabled: vi.fn(() => Promise.reject(new Error('access denied'))),
    };
    const adapter = createLaunchOnStartupAdapter(nativeApi, true);

    await expect(adapter.get()).rejects.toThrow('access denied');
  });
});
