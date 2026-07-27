export {
  DESKTOP_INSPECTION_CAPABILITY,
  DESKTOP_SCHEMA_VERSION,
  createDesktopInspectionClient,
} from './client.js';
export type {
  DesktopClientIdentity,
  DesktopInspectionClient,
  DesktopInspectionTransport,
  InspectSystemInput,
} from './client.js';
export type {
  DesktopCapability,
  DesktopInspectionError,
  DesktopSchemaVersion,
  InspectionField,
  Result,
} from './errors.js';
export type { NativeDiagnosticValue, NativeSystemInspection } from './truth.js';
