import {
  DESKTOP_INSPECTION_CAPABILITY,
  DESKTOP_SCHEMA_VERSION,
  createDesktopInspectionClient,
  type DesktopConformanceScenario,
  type DesktopInspectionClient,
  type DesktopInspectionTransport,
} from '@liiiraa/desktop-client';

import { getDesktopSimulatorScenario, type DesktopSimulatorScenario } from './scenarios.js';

export interface DesktopSimulatorOptions {
  readonly scenario: DesktopConformanceScenario;
  readonly clock: () => string;
  readonly inspectionIds: () => string;
}

export const createDesktopSimulatorClient = (
  options: DesktopSimulatorOptions,
): DesktopInspectionClient => {
  const scenario: DesktopSimulatorScenario = getDesktopSimulatorScenario(options.scenario);
  const transport: DesktopInspectionTransport = {
    identity: Object.freeze({
      adapterId: 'liiiraa-desktop-simulator',
      adapterVersion: '1.0.0',
    }),
    schemaVersion: DESKTOP_SCHEMA_VERSION,
    capabilities: Object.freeze([DESKTOP_INSPECTION_CAPABILITY]),
    inspectSystem(input) {
      return Promise.resolve(
        Object.freeze({
          schemaVersion: DESKTOP_SCHEMA_VERSION,
          messageType: 'desktop.inspect-system.result',
          requestId: input.requestId,
          ...(input.correlationId === undefined ? {} : { correlationId: input.correlationId }),
          issuedAt: input.issuedAt,
          payload: Object.freeze({
            inspectionId: options.inspectionIds(),
            inspectedAt: options.clock(),
            deviceLabel: scenario.deviceLabel,
            logicalProcessorCount: scenario.logicalProcessorCount,
            totalMemoryBytes: scenario.totalMemoryBytes,
          }),
        }),
      );
    },
  };

  return createDesktopInspectionClient(transport);
};

export {
  getDesktopSimulatorScenario,
  type DesktopSimulatorFixtureValue,
  type DesktopSimulatorScenario,
  type DesktopSimulatorUnavailableValue,
} from './scenarios.js';
export {
  DESKTOP_SCENARIOS,
  getDesktopScenario,
  parseDesktopScenarioManifest,
} from './scenarios/catalog.js';
export { SCENARIO_DELTAS } from './scenarios/deltas.js';
export { SCENARIO_FAMILIES, getScenarioFamily } from './scenarios/families.js';
export type { ScenarioDelta } from './scenarios/deltas.js';
export type { ScenarioFamily } from './scenarios/families.js';
