import { describe, expect, it } from 'vitest';

import {
  CONFORMANCE_GROUP_COUNTS,
  DESKTOP_INSPECTION_CAPABILITY,
  DESKTOP_SCHEMA_VERSION,
  createDesktopClientConformance,
  type DesktopInspectionClient,
  type DesktopInspectionError,
  type InspectSystemInput,
  type NativeSystemInspection,
  type Result,
} from './index.js';
import {
  EVIDENCE_COMMANDS,
  createTauriEvidenceAuthority,
  type EvidenceInvoke,
} from './evidence.js';

const frozenInspection: NativeSystemInspection = Object.freeze({
  inspectionId: 'inspection-conformance',
  inspectedAt: '2000-01-01T00:00:00.000Z',
  deviceLabel: Object.freeze({
    kind: 'observed',
    value: 'SYNTHETIC DEVICE',
    provenance: Object.freeze({
      source: 'synthetic conformance source',
      observedAt: '2000-01-01T00:00:00.000Z',
    }),
  }),
  logicalProcessorCount: Object.freeze({
    kind: 'fixture',
    value: 8,
    provenance: Object.freeze({
      scenarioId: 'synthetic-conformance',
      fixtureVersion: '1.0.0',
    }),
  }),
  totalMemoryBytes: Object.freeze({
    kind: 'unavailable',
    provenance: Object.freeze({
      reason: 'Synthetic conformance value intentionally unavailable',
    }),
  }),
});

const successfulInspect = (
  input: InspectSystemInput,
): Promise<Result<NativeSystemInspection, DesktopInspectionError>> => {
  if (input.requestId.length === 0 || input.issuedAt.length === 0 || input.correlationId === '') {
    return Promise.resolve({
      ok: false,
      error: {
        code: 'INVALID_INPUT',
        field: input.requestId.length === 0 ? 'requestId' : 'issuedAt',
      },
    });
  }
  if (input.signal?.aborted === true) {
    return Promise.resolve({ ok: false, error: { code: 'CANCELLED' } });
  }
  return Promise.resolve({ ok: true, value: frozenInspection });
};

const createSubject = (overrides: Partial<DesktopInspectionClient> = {}): DesktopInspectionClient =>
  Object.freeze({
    identity: Object.freeze({
      adapterId: 'synthetic-conformance-adapter',
      adapterVersion: '1.0.0',
    }),
    schemaVersion: DESKTOP_SCHEMA_VERSION,
    capabilities: Object.freeze([DESKTOP_INSPECTION_CAPABILITY]),
    inspectSystem: successfulInspect,
    ...overrides,
  });

const runSubject = async (createClient: () => DesktopInspectionClient) =>
  createDesktopClientConformance({
    createClient,
    clock: () => '2000-01-01T00:00:00.000Z',
    requestIds: () => 'request-conformance',
  }).run();

describe('desktop client conformance factory', () => {
  it('publishes fixed adapter parity counts and accepts a conforming fake', async () => {
    const suite = createDesktopClientConformance({
      createClient: () => createSubject(),
      clock: () => '2000-01-01T00:00:00.000Z',
      requestIds: () => 'request-conformance',
    });

    expect(CONFORMANCE_GROUP_COUNTS).toEqual({
      metadata: 3,
      lifecycle: 5,
      truth: 2,
      determinism: 1,
    });
    expect(suite.groupCounts).toEqual(CONFORMANCE_GROUP_COUNTS);
    expect(suite.cases).toHaveLength(
      Object.values(CONFORMANCE_GROUP_COUNTS).reduce((total, count) => total + count, 0),
    );
    await expect(suite.run()).resolves.toMatchObject({
      ok: true,
      passed: 11,
      failed: 0,
    });
  });

  it.each([
    {
      defect: 'raw throws',
      expectedFailure: 'RAW_THROW',
      createClient: () =>
        createSubject({
          inspectSystem: () => {
            throw new Error('RAW_SECRET');
          },
        }),
    },
    {
      defect: 'wrong versions',
      expectedFailure: 'SCHEMA_MISMATCH',
      createClient: () =>
        createSubject({
          schemaVersion: '999.0' as typeof DESKTOP_SCHEMA_VERSION,
        }),
    },
    {
      defect: 'mutable results',
      expectedFailure: 'MUTABLE_RESULT',
      createClient: () =>
        createSubject({
          inspectSystem: () =>
            Promise.resolve({
              ok: true,
              value: structuredClone(frozenInspection),
            }),
        }),
    },
    {
      defect: 'missing provenance',
      expectedFailure: 'PROVENANCE_INVALID',
      createClient: () =>
        createSubject({
          inspectSystem: () =>
            Promise.resolve({
              ok: true,
              value: {
                ...frozenInspection,
                deviceLabel: {
                  kind: 'observed',
                  value: 'SYNTHETIC DEVICE',
                },
              } as NativeSystemInspection,
            }),
        }),
    },
    {
      defect: 'capability lies',
      expectedFailure: 'CAPABILITY_MISMATCH',
      createClient: () =>
        createSubject({
          capabilities: Object.freeze([]),
        }),
    },
    {
      defect: 'nondeterminism',
      expectedFailure: 'NONDETERMINISTIC',
      createClient: () => {
        let call = 0;
        return createSubject({
          inspectSystem: () =>
            Promise.resolve({
              ok: true,
              value: Object.freeze({
                ...frozenInspection,
                inspectionId: `inspection-${String(++call)}`,
              }),
            }),
        });
      },
    },
  ])('rejects $defect', async ({ createClient, expectedFailure }) => {
    const report = await runSubject(createClient);

    expect(report.ok).toBe(false);
    expect(report.results.flatMap((result) => result.failures)).toContain(expectedFailure);
    expect(JSON.stringify(report)).not.toContain('RAW_SECRET');
  });
});

describe('production evidence truth conformance', () => {
  it('rejects fixture provenance recursively instead of relabeling it as native', async () => {
    const invoke: EvidenceInvoke = async () => ({
      kind: 'inventory-snapshot',
      schemaVersion: '1.0',
      evidenceId: 'inventory-spoofed',
      evidenceVersion: 1,
      collectedAt: '2000-01-01T00:00:00.000Z',
      nested: { history: [{ provenance: { kind: 'fixture', scenarioId: 'S01' } }] },
    });
    const authority = createTauriEvidenceAuthority({ invoke });

    const result = await authority.refreshInventory({
      request: {
        schemaVersion: '1.0',
        evidenceId: 'inventory-spoofed',
        evidenceVersion: 1,
        collectedAt: '2000-01-01T00:00:00.000Z',
        deadlineAt: '2000-01-01T00:00:10.000Z',
        perSourceTimeoutMs: 500,
        policyDate: 20000101,
      },
    });

    expect(EVIDENCE_COMMANDS.refreshInventory).toBe('refresh_hardware_inventory');
    expect(result).toEqual({
      ok: false,
      error: {
        code: 'FIXTURE_PROVENANCE_REFUSED',
        path: '$.nested.history[0].provenance',
      },
    });
  });
});
