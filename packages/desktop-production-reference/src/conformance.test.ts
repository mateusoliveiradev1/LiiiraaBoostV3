import { describe, expect, it } from 'vitest';

import {
  CONFORMANCE_GROUP_COUNTS,
  createDesktopClientConformance,
} from '@liiiraa/desktop-client';

import { createProductionUnavailableClient } from './index.js';

const clock = (): string => '2000-01-01T00:00:00.000Z';
const inspectionIds = (): string => 'inspection-production-unavailable';

describe('desktop production-unavailable adapter', () => {
  it('passes exactly the same shared conformance case count', async () => {
    const suite = createDesktopClientConformance({
      createClient: () =>
        createProductionUnavailableClient({ clock, inspectionIds }),
      clock,
      requestIds: () => 'request-production-unavailable',
    });

    const expectedCases = Object.values(CONFORMANCE_GROUP_COUNTS).reduce(
      (total, count) => total + count,
      0,
    );
    const report = await suite.run();

    expect(suite.cases).toHaveLength(expectedCases);
    expect(report).toMatchObject({
      ok: true,
      passed: expectedCases,
      failed: 0,
    });
  });

  it('returns only unavailable truth under immutable production identity', async () => {
    const client = createProductionUnavailableClient({ clock, inspectionIds });
    const result = await client.inspectSystem({
      requestId: 'request-production-unavailable',
      issuedAt: clock(),
    });

    expect(client.identity).toEqual({
      adapterId: 'liiiraa-desktop-production-unavailable',
      adapterVersion: '1.0.0',
    });
    expect(Object.isFrozen(client.identity)).toBe(true);
    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(
        [
          result.value.deviceLabel,
          result.value.logicalProcessorCount,
          result.value.totalMemoryBytes,
        ].every((value) => value.kind === 'unavailable'),
      ).toBe(true);
      expect(JSON.stringify(result.value)).not.toContain('fixture');
      expect(JSON.stringify(result.value)).not.toContain('simulator');
    }
  });
});
