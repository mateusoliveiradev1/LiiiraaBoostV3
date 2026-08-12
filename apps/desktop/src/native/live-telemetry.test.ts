import { describe, expect, it, vi } from 'vitest';

import { createTauriLiveTelemetryAuthority, type LiveTelemetrySnapshot } from './live-telemetry.js';

const observedSnapshot = (): LiveTelemetrySnapshot => ({
  schemaVersion: '1.0',
  readOnly: true,
  cpu: {
    state: 'observed',
    value: 12.5,
    unit: 'percent',
    source: 'windows-get-system-times',
    detail: 'Total processor utilization.',
  },
  memory: {
    state: 'observed',
    usedBytes: 10_737_418_240,
    totalBytes: 34_359_738_368,
    loadPercent: 31,
    source: 'windows-global-memory-status-ex',
    detail: 'Physical memory in use.',
  },
  gpu: {
    state: 'unavailable',
    value: null,
    unit: 'percent',
    source: 'none',
    detail: 'No native GPU counter was admitted.',
    reasonCode: 'source-not-admitted',
  },
  collectionLatency: {
    state: 'observed',
    value: 0.7,
    unit: 'milliseconds',
    source: 'native-monotonic-clock',
    detail: 'Time spent on this local reading.',
  },
});

describe('native live telemetry authority', () => {
  it('admits a read-only native snapshot without raw identifiers', async () => {
    const invoke = vi.fn().mockResolvedValue(observedSnapshot());
    const authority = createTauriLiveTelemetryAuthority({ invoke });

    await expect(authority.read()).resolves.toEqual({ ok: true, value: observedSnapshot() });
    expect(invoke).toHaveBeenCalledWith('read_live_telemetry');
    expect(JSON.stringify(authority.snapshot())).not.toMatch(/serial|uuid|deviceId|fixture/iu);
  });

  it('rejects optimistic, malformed, and fixture-derived values', async () => {
    const invoke = vi
      .fn()
      .mockResolvedValueOnce({ ...observedSnapshot(), readOnly: false })
      .mockResolvedValueOnce({
        ...observedSnapshot(),
        cpu: { ...observedSnapshot().cpu, value: 140 },
      })
      .mockResolvedValueOnce({ ...observedSnapshot(), scenarioId: 'fixture-home' });
    const authority = createTauriLiveTelemetryAuthority({ invoke });

    await expect(authority.read()).resolves.toMatchObject({ ok: false });
    await expect(authority.read()).resolves.toMatchObject({ ok: false });
    await expect(authority.read()).resolves.toMatchObject({ ok: false });
  });

  it('keeps polling caller-controlled and marks native failures unavailable', async () => {
    const authority = createTauriLiveTelemetryAuthority({
      invoke: vi.fn().mockRejectedValue(new Error('native unavailable')),
    });

    await expect(authority.read()).resolves.toEqual({
      ok: false,
      error: { code: 'COMMAND_FAILED' },
    });
    expect(authority.snapshot().status).toBe('unavailable');
  });

  it('keeps the last admitted sample stable during background refreshes', async () => {
    let resolveRefresh: ((value: LiveTelemetrySnapshot) => void) | undefined;
    const invoke = vi
      .fn()
      .mockResolvedValueOnce(observedSnapshot())
      .mockImplementationOnce(
        () =>
          new Promise<LiveTelemetrySnapshot>((resolve) => {
            resolveRefresh = resolve;
          }),
      );
    const authority = createTauriLiveTelemetryAuthority({ invoke });

    await authority.read();
    const refresh = authority.read();
    expect(authority.snapshot().status).toBe('ready');
    expect(authority.snapshot().telemetry).toEqual(observedSnapshot());

    resolveRefresh?.({
      ...observedSnapshot(),
      cpu: { ...observedSnapshot().cpu, value: 18.5 },
    });
    await refresh;
    expect(authority.snapshot().status).toBe('ready');
    expect(authority.snapshot().telemetry?.cpu.value).toBe(18.5);
  });
});
