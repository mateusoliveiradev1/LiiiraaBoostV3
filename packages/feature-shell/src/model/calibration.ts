import type { DesktopRoute } from '@liiiraa/desktop-client';

export const CALIBRATION_SNAPSHOT_VERSION = 1 as const;

export const CALIBRATION_STEPS = Object.freeze([
  'trustPrivacy',
  'systemInventory',
  'performanceDiagnosis',
  'recoveryReadiness',
  'goals',
  'priorityGames',
  'review',
] as const);

export type CalibrationStep = (typeof CALIBRATION_STEPS)[number];

export const REQUIRED_CALIBRATION_STEPS = Object.freeze([
  'trustPrivacy',
  'systemInventory',
] as const satisfies readonly CalibrationStep[]);

export const OPTIONAL_CALIBRATION_STEPS = Object.freeze([
  'performanceDiagnosis',
  'recoveryReadiness',
  'goals',
  'priorityGames',
  'review',
] as const satisfies readonly CalibrationStep[]);

export const CALIBRATION_STEP_MESSAGE_IDS = Object.freeze({
  trustPrivacy: 'calibration.step.trustPrivacy',
  systemInventory: 'calibration.step.systemInventory',
  performanceDiagnosis: 'calibration.step.performanceDiagnosis',
  recoveryReadiness: 'calibration.step.recoveryReadiness',
  goals: 'calibration.step.goals',
  priorityGames: 'calibration.step.priorityGames',
  review: 'calibration.step.review',
} as const satisfies Readonly<Record<CalibrationStep, string>>);

export const CONNECTED_CONSENT_KEYS = Object.freeze([
  'telemetry',
  'cloudAi',
  'diagnosticSharing',
] as const);

export type ConnectedConsentKey = (typeof CONNECTED_CONSENT_KEYS)[number];

export interface ConnectedConsent {
  readonly telemetry: boolean;
  readonly cloudAi: boolean;
  readonly diagnosticSharing: boolean;
}

export const DEFAULT_CONNECTED_CONSENT = Object.freeze({
  telemetry: false,
  cloudAi: false,
  diagnosticSharing: false,
} as const satisfies ConnectedConsent);

export const CALIBRATION_STATES = Object.freeze([
  'new',
  'running',
  'offlineLocal',
  'deferred',
  'partial',
  'cancelled',
  'resumed',
  'home',
  'dependencyBlocked',
  'limited',
  'completed',
  'revalidation',
] as const);

export type CalibrationState = (typeof CALIBRATION_STATES)[number];

export const EVIDENCE_STATUSES = Object.freeze([
  'valid',
  'deferred',
  'unavailable',
  'invalidated',
] as const);

export type CalibrationEvidenceStatus = (typeof EVIDENCE_STATUSES)[number];

export interface CalibrationEvidence {
  readonly step: CalibrationStep;
  readonly status: CalibrationEvidenceStatus;
  readonly freshness: 'current' | 'stale' | 'unknown';
  readonly sourceId: string;
  readonly messageId: string;
}

export const CALIBRATION_DEPENDENT_ACTIONS = Object.freeze([
  'reviewPerformancePlan',
  'verifyRecoveryReadiness',
  'personalizeGoals',
  'preparePriorityGame',
] as const);

export type CalibrationDependentAction = (typeof CALIBRATION_DEPENDENT_ACTIONS)[number];

export interface CalibrationReturnIntent {
  readonly action: CalibrationDependentAction;
  readonly route: DesktopRoute;
  readonly requiredStep: CalibrationStep;
}

export const LIMITED_REASONS = Object.freeze([
  'inventoryFailed',
  'permissionDenied',
  'snapshotInvalid',
] as const);

export type CalibrationLimitedReason = (typeof LIMITED_REASONS)[number];

export interface CalibrationContext {
  readonly snapshotVersion: typeof CALIBRATION_SNAPSHOT_VERSION;
  readonly currentStep: CalibrationStep;
  readonly evidence: Readonly<Partial<Record<CalibrationStep, CalibrationEvidence>>>;
  readonly invalidatedEvidence: readonly CalibrationStep[];
  readonly consents: ConnectedConsent;
  readonly returnIntent: CalibrationReturnIntent | null;
  readonly limitedReason: CalibrationLimitedReason | null;
  readonly diagnosticMessageId: string | null;
}

export interface CalibrationSnapshot {
  readonly snapshotVersion: typeof CALIBRATION_SNAPSHOT_VERSION;
  readonly state: CalibrationState;
  readonly currentStep: CalibrationStep;
  readonly evidence: Readonly<Partial<Record<CalibrationStep, CalibrationEvidence>>>;
  readonly invalidatedEvidence: readonly CalibrationStep[];
  readonly consents: ConnectedConsent;
  readonly returnIntent: CalibrationReturnIntent | null;
  readonly limitedReason: CalibrationLimitedReason | null;
  readonly diagnosticMessageId: string | null;
}

export interface CalibrationMachineInput {
  readonly snapshot?: unknown;
}

export type CalibrationEvent =
  | Readonly<{ type: 'START' }>
  | Readonly<{ type: 'GO_HOME' }>
  | Readonly<{ type: 'GO_OFFLINE' }>
  | Readonly<{ type: 'CANCEL' }>
  | Readonly<{ type: 'RESUME' }>
  | Readonly<{ type: 'COMPLETE' }>
  | Readonly<{ type: 'RETRY' }>
  | Readonly<{
      type: 'RECORD_EVIDENCE';
      evidence: CalibrationEvidence;
    }>
  | Readonly<{
      type: 'DEFER_STEP';
      step: CalibrationStep;
      messageId: string;
    }>
  | Readonly<{
      type: 'REQUIRE_ACTION';
      action: CalibrationDependentAction;
      route: DesktopRoute;
    }>
  | Readonly<{
      type: 'FAIL_REQUIRED';
      reason: Extract<CalibrationLimitedReason, 'inventoryFailed' | 'permissionDenied'>;
    }>
  | Readonly<{
      type: 'SET_CONSENT';
      consent: ConnectedConsentKey;
      granted: boolean;
    }>
  | Readonly<{
      type: 'REVALIDATE';
      affectedSteps: readonly CalibrationStep[];
      reasonMessageId: string;
    }>;

export interface HomeCalibrationState {
  readonly access: 'blocked' | 'limited' | 'progressive' | 'ready';
  readonly requiredComplete: boolean;
  readonly optionalProgress: Readonly<{
    completed: number;
    total: number;
  }>;
  readonly trustedSteps: readonly CalibrationStep[];
  readonly incompleteSteps: readonly CalibrationStep[];
  readonly recommendationsAllowed: boolean;
  readonly continueAction: Readonly<{
    prominence: 'hidden' | 'quiet' | 'dominant';
    messageId: 'calibration.action.continue';
    step: CalibrationStep | null;
  }>;
}

export interface CalibrationMigrationSuccess {
  readonly ok: true;
  readonly snapshot: CalibrationSnapshot;
}

export interface CalibrationMigrationFailure {
  readonly ok: false;
  readonly limitedReason: 'snapshotInvalid';
  readonly diagnosticMessageId: 'calibration.error.snapshotInvalid';
}

export type CalibrationMigrationResult = CalibrationMigrationSuccess | CalibrationMigrationFailure;
