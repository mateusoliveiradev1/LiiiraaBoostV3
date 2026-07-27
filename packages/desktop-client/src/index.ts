export {
  DESKTOP_INSPECTION_CAPABILITY,
  DESKTOP_SCHEMA_VERSION,
  createDesktopInspectionClient,
} from './client.js';
export { CONFORMANCE_GROUP_COUNTS, createDesktopClientConformance } from './conformance.js';
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
export type { NativeDiagnosticValue, NativeSystemInspection } from './truth.js';
