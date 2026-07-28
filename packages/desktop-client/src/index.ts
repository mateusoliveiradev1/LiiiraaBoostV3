export {
  DESKTOP_INSPECTION_CAPABILITY,
  DESKTOP_SCHEMA_VERSION,
  createDesktopInspectionClient,
} from './client.js';
export { CONFORMANCE_GROUP_COUNTS, createDesktopClientConformance } from './conformance.js';
export {
  ACTIVITY_STATES,
  CALIBRATION_PROGRESS_STATES,
  DESKTOP_ROUTES,
  ENTITLEMENT_STATES,
  EVIDENCE_FRESHNESS_STATES,
  EVIDENCE_QUALITY_STATES,
  OPERATIONAL_STATES,
  isDesktopRoute,
  isOperationalState,
} from './experience.js';
export type {
  DesktopClientIdentity,
  DesktopInspectionClient,
  DesktopInspectionTransport,
  InspectSystemInput,
} from './client.js';
export type {
  ConformanceCaseResult,
  ConformanceFailure,
  ConformanceGroup,
  DesktopConformanceScenario,
  DesktopClientConformanceCase,
  DesktopClientConformanceDependencies,
  DesktopClientConformanceReport,
  DesktopClientConformanceSuite,
} from './conformance.js';
export type {
  DesktopCapability,
  DesktopInspectionError,
  DesktopSchemaVersion,
  InspectInputField,
  InspectionField,
  Result,
} from './errors.js';
export type {
  ActivityState,
  CalibrationProgress,
  DesktopRoute,
  DesktopScenario,
  DesktopScenarioId,
  EntitlementState,
  EvidenceFreshness,
  EvidenceQuality,
  EvidenceState,
  GameFixture,
  HardwareFixture,
  OperationalState,
  PhaseBoundaryExplanation,
  PreviewReceipt,
  ProfileFixture,
  RecommendationState,
  RouteRequirement,
  ScenarioAdapterIdentity,
  ScenarioFamilyId,
} from './experience.js';
export type { NativeDiagnosticValue, NativeSystemInspection } from './truth.js';
