import { describe, expect, it } from 'vitest';

import {
  CONFORMANCE_GROUP_COUNTS,
  createDesktopClientConformance,
} from '@liiiraa/desktop-client';

import { createDesktopSimulatorClient } from './index.js';

const clock = (): string => '2000-01-01T00:00:00.000Z';
const inspectionIds = (): string => 'inspection-simulator';

describe('desktop simulator adapter', () => {
  it('passes every shared adapter conformance case', async () => {
    const suite = createDesktopClientConformance({
      createClient: (scenario) =>
        createDesktopSimulatorClient({ scenario, clock, inspectionIds }),
      clock,
      requestIds: () => 'request-simulator',
    });

    const report = await suite.run();

    expect(report).toMatchObject({
      ok: true,
      passed: Object.values(CONFORMANCE_GROUP_COUNTS).reduce(
        (total, count) => total + count,
        0,
      ),
      failed: 0,
    });
  });

  it('freezes fixture values with the selected scenario identity', async () => {
    const client = createDesktopSimulatorClient({
      scenario: 'standard',
      clock,
      inspectionIds,
    });
    const input = {
      requestId: 'request-simulator',
      issuedAt: clock(),
    };

    const first = await client.inspectSystem(input);
    const second = await client.inspectSystem(input);

    expect(first).toEqual(second);
    expect(first.ok).toBe(true);

    if (first.ok) {
      expect(Object.isFrozen(first.value)).toBe(true);
      expect(
        [
          first.value.deviceLabel,
          first.value.logicalProcessorCount,
          first.value.totalMemoryBytes,
        ].every(
          (value) =>
            value.kind === 'fixture' &&
            value.provenance.scenarioId === 'synthetic-standard',
        ),
      ).toBe(true);
    }
  });
});
