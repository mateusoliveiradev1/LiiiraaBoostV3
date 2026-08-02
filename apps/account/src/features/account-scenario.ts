import { getWebScenario, type WebScenarioId } from '@liiiraa/web-preview';

import type { AccountPreviewRoute } from '../account-preview-model';

const defaultAccountScenarioId = (routeId: AccountPreviewRoute): WebScenarioId =>
  routeId === 'account-sign-in' || routeId === 'account-sign-up'
    ? 'W10'
    : routeId === 'account-device' || routeId === 'account-privacy' || routeId === 'account-support'
      ? 'W13'
      : 'W11';

export const resolveAccountScenarioId = (
  routeId: AccountPreviewRoute,
  scenarioId?: WebScenarioId,
): WebScenarioId => {
  const candidate = scenarioId ?? defaultAccountScenarioId(routeId);
  const scenario = getWebScenario(candidate);
  if (
    scenario.family !== 'account' ||
    (scenario.routeId !== routeId && !scenario.requiredRouteIds.includes(routeId))
  ) {
    throw new Error(`ACCOUNT_SCENARIO_ROUTE_MISMATCH:${candidate}:${routeId}`);
  }
  return candidate;
};
