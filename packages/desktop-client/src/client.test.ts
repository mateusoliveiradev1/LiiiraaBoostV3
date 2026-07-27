import { describe, expect, it, vi } from 'vitest';

import {
  DESKTOP_INSPECTION_CAPABILITY,
  DESKTOP_SCHEMA_VERSION,
  createDesktopInspectionClient,
  type DesktopInspectionTransport,
} from './index.js';

const validResult = {
  schemaVersion: DESKTOP_SCHEMA_VERSION,
  messageType: 'desktop.inspect-system.result',
  requestId: 'request-01',
  correlationId: 'correlation-01',
  issuedAt: '2000-01-01T00:00:00.000Z',
  payload: {
    inspectionId: 'inspection-01',
    inspectedAt: '2000-01-01T00:00:00.000Z',
    deviceLabel: {
      kind: 'observed',
      value: 'SYNTHETIC DEVICE',
      source: 'synthetic inventory',
      observedAt: '2000-01-01T00:00:00.000Z',
    },
    logicalProcessorCount: {
      kind: 'measured',
      value: 8,
      method: 'synthetic count',
      measuredAt: '2000-01-01T00:00:00.000Z',
      quality: 'valid',
    },
    totalMemoryBytes: {
      kind: 'modeled',
      value: 16_000_000_000,
      modelId: 'synthetic-memory-model',
      confidence: 0.5,
      assumptions: ['synthetic input only'],
    },
  },
} as const;

const createTransport = (
  inspectSystem: DesktopInspectionTransport['inspectSystem'] = vi
    .fn()
    .mockResolvedValue(validResult),
): DesktopInspectionTransport => ({
  identity: {
    adapterId: 'synthetic-adapter',
    adapterVersion: '1.0.0',
  },
  schemaVersion: DESKTOP_SCHEMA_VERSION,
  capabilities: [DESKTOP_INSPECTION_CAPABILITY],
  inspectSystem,
});

describe('desktop inspection client boundary', () => {
  it('validates unknown diagnostics before mapping distinct immutable native truth', async () => {
    const transport = createTransport();
    const client = createDesktopInspectionClient(transport);

    const result = await client.inspectSystem({
      requestId: 'request-01',
      issuedAt: '2000-01-01T00:00:00.000Z',
      correlationId: 'correlation-01',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.deviceLabel).toEqual({
        kind: 'observed',
        value: 'SYNTHETIC DEVICE',
        provenance: {
          source: 'synthetic inventory',
          observedAt: '2000-01-01T00:00:00.000Z',
        },
      });
      expect(result.value.logicalProcessorCount).toEqual({
        kind: 'measured',
        value: 8,
        provenance: {
          method: 'synthetic count',
          measuredAt: '2000-01-01T00:00:00.000Z',
          quality: 'valid',
        },
      });
      expect(result.value.totalMemoryBytes).toEqual({
        kind: 'modeled',
        value: 16_000_000_000,
        provenance: {
          modelId: 'synthetic-memory-model',
          confidence: 0.5,
          assumptions: ['synthetic input only'],
        },
      });
      expect('payload' in result.value).toBe(false);
      expect(Object.isFrozen(result.value)).toBe(true);
      expect(Object.isFrozen(result.value.deviceLabel)).toBe(true);
      expect(Object.isFrozen(result.value.deviceLabel.provenance)).toBe(true);
      expect(
        result.value.totalMemoryBytes.kind === 'modeled' &&
          Object.isFrozen(result.value.totalMemoryBytes.provenance.assumptions),
      ).toBe(true);
    }
  });

  it('rejects missing provenance through the public contract validator', async () => {
    const invalidResult = structuredClone(validResult) as Record<string, unknown>;
    const payload = invalidResult['payload'] as Record<string, unknown>;
    payload['deviceLabel'] = {
      kind: 'observed',
      value: 'SYNTHETIC DEVICE',
      observedAt: '2000-01-01T00:00:00.000Z',
    };
    const client = createDesktopInspectionClient(
      createTransport(vi.fn().mockResolvedValue(invalidResult)),
    );

    await expect(
      client.inspectSystem({
        requestId: 'request-01',
        issuedAt: '2000-01-01T00:00:00.000Z',
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: {
        code: 'INVALID_TRANSPORT',
        field: 'deviceLabel',
      },
    });
  });

  it('exposes frozen identity, capabilities, schema version, and cancellation', async () => {
    const inspectSystem = vi.fn().mockResolvedValue(validResult);
    const client = createDesktopInspectionClient(createTransport(inspectSystem));
    const controller = new AbortController();
    controller.abort();

    expect(client.identity).toEqual({
      adapterId: 'synthetic-adapter',
      adapterVersion: '1.0.0',
    });
    expect(client.schemaVersion).toBe(DESKTOP_SCHEMA_VERSION);
    expect(client.capabilities).toEqual([DESKTOP_INSPECTION_CAPABILITY]);
    expect(Object.isFrozen(client.identity)).toBe(true);
    expect(Object.isFrozen(client.capabilities)).toBe(true);
    await expect(
      client.inspectSystem({
        requestId: 'request-01',
        issuedAt: '2000-01-01T00:00:00.000Z',
        signal: controller.signal,
      }),
    ).resolves.toEqual({
      ok: false,
      error: { code: 'CANCELLED' },
    });
    expect(inspectSystem).not.toHaveBeenCalled();
  });

  it('converts raw adapter failures into value-free typed errors', async () => {
    const secret = 'SENSITIVE_RAW_ADAPTER_ERROR';
    const client = createDesktopInspectionClient(
      createTransport(vi.fn().mockRejectedValue(new Error(secret))),
    );

    const result = await client.inspectSystem({
      requestId: 'request-01',
      issuedAt: '2000-01-01T00:00:00.000Z',
    });

    expect(result).toEqual({
      ok: false,
      error: { code: 'TRANSPORT_FAILURE' },
    });
    expect(JSON.stringify(result)).not.toContain(secret);
  });
});
