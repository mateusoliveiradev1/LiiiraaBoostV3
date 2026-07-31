export const WEB_PREVIEW_ADAPTER_ID = 'liiiraa-web-preview' as const;

export const WEB_PREVIEW_RUNTIME_CLASS = 'fixture' as const;

export {
  FUTURE_AUTHORITY_ACTION_FAMILIES,
  createWebPreviewAuthority,
} from './no-change-adapter.js';
export type {
  CancelledReceipt,
  FutureAuthorityActionFamily,
  FutureAuthorityExecution,
  FutureAuthorityFailure,
  FutureAuthorityFailureCode,
  FutureAuthorityPort,
  FutureAuthorityResult,
  WebPreviewAuthorityOptions,
} from './no-change-adapter.js';
export {
  WEB_SCENARIOS,
  WEB_SCENARIO_IDS,
  getWebScenario,
  parseWebScenarioManifest,
  publishedPreviewScenarioId,
  resolveWebPreviewScenario,
} from './scenarios.js';
export type {
  WebPreviewComposition,
  WebScenario,
  WebScenarioId,
} from './scenarios.js';
