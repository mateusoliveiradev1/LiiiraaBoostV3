export {
  CALIBRATION_SNAPSHOT_VERSION,
  CALIBRATION_STATES,
  CALIBRATION_STEPS,
  CALIBRATION_STEP_MESSAGE_IDS,
  CONNECTED_CONSENT_KEYS,
  DEFAULT_CONNECTED_CONSENT,
  OPTIONAL_CALIBRATION_STEPS,
  REQUIRED_CALIBRATION_STEPS,
} from './model/calibration.js';
export type {
  CalibrationContext,
  CalibrationDependentAction,
  CalibrationEvent,
  CalibrationEvidence,
  CalibrationEvidenceStatus,
  CalibrationLimitedReason,
  CalibrationMachineInput,
  CalibrationMigrationResult,
  CalibrationReturnIntent,
  CalibrationSnapshot,
  CalibrationState,
  CalibrationStep,
  ConnectedConsent,
  ConnectedConsentKey,
  HomeCalibrationState,
} from './model/calibration.js';
export {
  calibrationMachine,
  createCalibrationActor,
  isCalibrationEvent,
  requiredStepForAction,
  restoreCalibrationSnapshot,
  selectHomeCalibrationState,
  serializeCalibrationSnapshot,
} from './machines/calibration.machine.js';
export type {
  CalibrationActor,
  CalibrationActorSnapshot,
  CalibrationMachine,
} from './machines/calibration.machine.js';
export {
  DATA_TEXT_PREFERENCES,
  DENSITY_PREFERENCES,
  DESKTOP_LOCALES,
  INTERFACE_SCALES,
  MOTION_PREFERENCES,
  PREFERENCE_VERSION,
  createDefaultPreferences,
  detectDesktopLocale,
  reducePreferences,
  restorePreferences,
  selectCloseBehavior,
  selectDensityMetrics,
  serializePreferences,
} from './model/preferences.js';
export type {
  DataTextPreference,
  DensityMetrics,
  DensityPreference,
  DesktopLocale,
  DesktopPreferences,
  InterfaceScale,
  MotionPreference,
  PreferenceEvent,
  PreferenceRestoreResult,
} from './model/preferences.js';

export * from './features/account-settings.js';
export * from './features/activity.js';
export * from './features/assistant.js';
export * from './features/calibration.js';
export * from './features/command-center.js';
export * from './features/favorites.js';
export * from './features/home.js';
export * from './features/improve.js';
export * from './features/measure.js';
export * from './features/prepare.js';
export * from './features/preview-workflows.js';
export * from './features/recover.js';
export type {
  RendererToHostShellCommandJson,
  ShellNavigationIntentJson,
  ShellSetLocaleCommandJson,
  ShellSetTrayPreferenceCommandJson,
} from '@liiiraa/contracts-ts';
