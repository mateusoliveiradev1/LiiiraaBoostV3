import type { DesktopConformanceScenario } from '@liiiraa/desktop-client';

export interface DesktopSimulatorFixtureValue {
  readonly kind: 'fixture';
  readonly value: string | number | boolean;
  readonly scenarioId: string;
  readonly fixtureVersion: string;
}

export interface DesktopSimulatorUnavailableValue {
  readonly kind: 'unavailable';
  readonly reason: string;
}

export interface DesktopSimulatorScenario {
  readonly scenarioId: string;
  readonly fixtureVersion: string;
  readonly deviceLabel:
    | DesktopSimulatorFixtureValue
    | DesktopSimulatorUnavailableValue;
  readonly logicalProcessorCount:
    | DesktopSimulatorFixtureValue
    | DesktopSimulatorUnavailableValue;
  readonly totalMemoryBytes:
    | DesktopSimulatorFixtureValue
    | DesktopSimulatorUnavailableValue;
}

const fixture = (
  scenarioId: string,
  fixtureVersion: string,
  value: string | number | boolean,
): DesktopSimulatorFixtureValue =>
  Object.freeze({
    kind: 'fixture',
    value,
    scenarioId,
    fixtureVersion,
  });

const unavailable = (reason: string): DesktopSimulatorUnavailableValue =>
  Object.freeze({
    kind: 'unavailable',
    reason,
  });

const standardScenarioId = 'synthetic-standard';
const unavailableScenarioId = 'synthetic-unavailable';
const fixtureVersion = '1.0.0';

const scenarios: Readonly<
  Record<DesktopConformanceScenario, DesktopSimulatorScenario>
> = Object.freeze({
  standard: Object.freeze({
    scenarioId: standardScenarioId,
    fixtureVersion,
    deviceLabel: fixture(
      standardScenarioId,
      fixtureVersion,
      'SYNTHETIC GAMING DEVICE',
    ),
    logicalProcessorCount: fixture(standardScenarioId, fixtureVersion, 16),
    totalMemoryBytes: fixture(
      standardScenarioId,
      fixtureVersion,
      32_000_000_000,
    ),
  }),
  unavailable: Object.freeze({
    scenarioId: unavailableScenarioId,
    fixtureVersion,
    deviceLabel: fixture(
      unavailableScenarioId,
      fixtureVersion,
      'SYNTHETIC UNAVAILABLE DEVICE',
    ),
    logicalProcessorCount: unavailable(
      'Synthetic scenario intentionally omits processor facts',
    ),
    totalMemoryBytes: unavailable(
      'Synthetic scenario intentionally omits memory facts',
    ),
  }),
});

export const getDesktopSimulatorScenario = (
  scenario: DesktopConformanceScenario,
): DesktopSimulatorScenario => scenarios[scenario];
