export const WEB_EVIDENCE_SCHEMA_VERSION = 1 as const;

export { captureDesktopProduct, verifyDesktopCapture } from './capture-desktop.js';
export type {
  CaptureToolOptions,
  CaptureVerificationResult,
  DesktopCaptureEntry,
  DesktopCaptureManifest,
} from './capture-desktop.js';

export {
  inspectContentPublicationEvidence,
  inspectReleaseEvidence,
  inspectRouteEvidence,
  inspectSecurityBoundaryEvidence,
  inspectWorkspaceReadiness,
} from './web-evidence-harness.js';
export type {
  ContentPublicationEvidence,
  EvidenceDiagnostic,
  EvidenceResult,
  ReleaseEvidence,
  RouteEvidence,
  SecurityBoundaryEvidence,
  WebRequirement,
  WebSurface,
  WorkspaceReadinessInput,
} from './web-evidence-harness.js';
