import type {
  CalibrationContext,
  CalibrationEvent,
  CalibrationMachineInput,
  CalibrationMigrationResult,
  CalibrationSnapshot,
  CalibrationState,
  HomeCalibrationState,
} from '../model/calibration.js';

export interface CalibrationActorSnapshot {
  readonly value: CalibrationState;
  readonly context: CalibrationContext;
}

export interface CalibrationActor {
  start(): CalibrationActor;
  send(event: CalibrationEvent): void;
  getSnapshot(): CalibrationActorSnapshot;
}

const missingImplementation = (): never => {
  throw new Error('CALIBRATION_MACHINE_NOT_IMPLEMENTED');
};

export const createCalibrationActor = (_input: CalibrationMachineInput = {}): CalibrationActor =>
  missingImplementation();

export const serializeCalibrationSnapshot = (
  _snapshot: CalibrationActorSnapshot,
): CalibrationSnapshot => missingImplementation();

export const restoreCalibrationSnapshot = (_value: unknown): CalibrationMigrationResult =>
  missingImplementation();

export const selectHomeCalibrationState = (
  _snapshot: CalibrationActorSnapshot,
): HomeCalibrationState => missingImplementation();

export const requiredStepForAction = (
  _event: Extract<CalibrationEvent, { type: 'REQUIRE_ACTION' }>,
) => missingImplementation();

export const isCalibrationEvent = (_value: unknown): _value is CalibrationEvent =>
  missingImplementation();
