export const WEB_EVIDENCE_SCHEMA_VERSION = 1 as const;

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
