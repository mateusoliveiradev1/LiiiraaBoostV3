declare const desktopScenarioIdBrand: unique symbol;
declare const scenarioFamilyIdBrand: unique symbol;

export type DesktopScenarioId = string & {
  readonly [desktopScenarioIdBrand]: 'DesktopScenarioId';
};

export type ScenarioFamilyId = string & {
  readonly [scenarioFamilyIdBrand]: 'ScenarioFamilyId';
};

export const OPERATIONAL_STATES = Object.freeze([
  'loading',
  'empty',
  'offline',
  'permission',
  'unsupported',
  'partial-failure',
  'restart-pending',
  'recovery',
  'expired-entitlement',
  'stale-evidence',
  'contradictory-evidence',
  'fixture',
] as const);

export type OperationalState = (typeof OPERATIONAL_STATES)[number];

export const EVIDENCE_FRESHNESS_STATES = Object.freeze(['current', 'stale', 'unknown'] as const);

export type EvidenceFreshness = (typeof EVIDENCE_FRESHNESS_STATES)[number];

export const EVIDENCE_QUALITY_STATES = Object.freeze([
  'verified',
  'degraded',
  'insufficient',
  'contradictory',
  'unavailable',
] as const);

export type EvidenceQuality = (typeof EVIDENCE_QUALITY_STATES)[number];

export const ENTITLEMENT_STATES = Object.freeze(['active', 'offline-grace', 'expired'] as const);

export type EntitlementState = (typeof ENTITLEMENT_STATES)[number];

export const CALIBRATION_PROGRESS_STATES = Object.freeze([
  'new',
  'running',
  'slow',
  'paused',
  'resumed',
  'deferred',
  'cancelled',
  'complete',
] as const);

export type CalibrationProgress = (typeof CALIBRATION_PROGRESS_STATES)[number];

export const ACTIVITY_STATES = Object.freeze([
  'requires-action',
  'in-progress',
  'completed',
  'history',
] as const);

export type ActivityState = (typeof ACTIVITY_STATES)[number];

export const DESKTOP_ROUTES = Object.freeze([
  '/startup',
  '/calibration',
  '/home',
  '/improve',
  '/improve/component',
  '/games',
  '/games/detail',
  '/session/active',
  '/measure',
  '/measure/comparison',
  '/plans/review',
  '/activity',
  '/restart',
  '/recover',
  '/ai',
  '/support',
  '/updates',
  '/settings/appearance',
] as const);

export type DesktopRoute = (typeof DESKTOP_ROUTES)[number];

export const isOperationalState = (value: unknown): value is OperationalState =>
  typeof value === 'string' && (OPERATIONAL_STATES as readonly string[]).includes(value);

export const isDesktopRoute = (value: unknown): value is DesktopRoute =>
  typeof value === 'string' && (DESKTOP_ROUTES as readonly string[]).includes(value);

export interface ScenarioAdapterIdentity {
  readonly kind: 'fixture';
  readonly adapterId: string;
  readonly adapterVersion: string;
  readonly scenarioMarker: 'SIMULATED SCENARIO';
}

export interface HardwareFixture {
  readonly id: string;
  readonly platform: 'windows-10' | 'windows-11';
  readonly build: string;
  readonly cpuVendor: 'AMD' | 'Intel';
  readonly cpuModel: string;
  readonly gpuVendor: 'AMD' | 'Intel' | 'NVIDIA';
  readonly gpuModel: string;
  readonly tier: 'mid-range' | 'high-end';
}

export type GameFixture =
  | Readonly<{
      id: string;
      displayName: string;
      kind: 'fictional-anchor';
      integrationQualification: 'deterministic-fixture';
      integrationValidated: false;
    }>
  | Readonly<{
      id: string;
      displayName: string;
      kind: 'real-discovery';
      integrationQualification: 'discovery-only-unqualified';
      integrationValidated: false;
    }>
  | Readonly<{
      id: string;
      displayName: string;
      kind: 'none-detected';
      integrationQualification: 'not-applicable';
      integrationValidated: false;
    }>;

export interface ProfileFixture {
  readonly id: string;
  readonly displayName: string;
  readonly riskPolicy: 'verified' | 'advanced' | 'experimental' | 'extreme';
}

export interface EvidenceState {
  readonly freshness: EvidenceFreshness;
  readonly quality: EvidenceQuality;
  readonly completeness: 'partial' | 'complete';
  readonly unavailableSources: readonly string[];
}

export interface RecommendationState {
  readonly id: string;
  readonly risk: 'verified' | 'advanced' | 'experimental' | 'extreme';
  readonly eligibility: 'ready' | 'review-required' | 'excluded';
  readonly evidenceQuality: EvidenceQuality;
}

export interface RouteRequirement {
  readonly route: DesktopRoute;
  readonly state: OperationalState;
}

export interface PreviewReceipt {
  readonly receiptKind: 'scenario-preview';
  readonly scenarioId: DesktopScenarioId;
  readonly changed: false;
  readonly summary: string;
}

export interface PhaseBoundaryExplanation {
  readonly kind: 'phase-boundary';
  readonly capability: string;
  readonly owningPhase: string;
  readonly availableScenarioId: DesktopScenarioId;
  readonly explanation: string;
}

export interface DesktopScenario {
  readonly id: DesktopScenarioId;
  readonly familyId: ScenarioFamilyId;
  readonly name: string;
  readonly seed: number;
  readonly clock: string;
  readonly locale: 'en-US' | 'pt-BR';
  readonly latencyMs: number;
  readonly adapterIdentity: ScenarioAdapterIdentity;
  readonly hardware: HardwareFixture;
  readonly game: GameFixture;
  readonly profile: ProfileFixture;
  readonly evidence: EvidenceState;
  readonly entitlement: EntitlementState;
  readonly calibration: CalibrationProgress;
  readonly activity: ActivityState;
  readonly recommendations: readonly RecommendationState[];
  readonly requiredRoutes: readonly DesktopRoute[];
  readonly requiredStates: readonly RouteRequirement[];
  readonly deltaPaths: readonly string[];
  readonly noEffect: PreviewReceipt;
}
