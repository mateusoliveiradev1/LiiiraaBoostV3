import type { NativeDiagnosticValue } from '@liiiraa/desktop-client';
import {
  createProductionDesktopComposition,
  type ProductionDiagnosticValue,
} from '@liiiraa/desktop-production-reference';

const fixtureValue = {
  kind: 'fixture',
  value: 'SYNTHETIC TYPE LEAK',
  provenance: {
    scenarioId: 'synthetic-type-leak',
    fixtureVersion: '1.0.0',
  },
} as const satisfies NativeDiagnosticValue;

// @ts-expect-error fixture provenance must never satisfy the production boundary
const rejectedFixture: ProductionDiagnosticValue = fixtureValue;

const composition = createProductionDesktopComposition({
  clock: () => '2000-01-01T00:00:00.000Z',
  inspectionIds: () => 'inspection-production-type-proof',
});

void composition;
void rejectedFixture;
