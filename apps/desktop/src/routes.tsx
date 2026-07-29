import type { ShellNavigationIntentJson } from '@liiiraa/feature-shell';

export type { ShellNavigationIntentJson as ShellNavigationIntent } from '@liiiraa/feature-shell';

export const DESKTOP_F6_REGIONS = Object.freeze([
  'title-bar',
  'goal-rail',
  'main',
  'inspector',
] as const);

export type DesktopF6Region = (typeof DESKTOP_F6_REGIONS)[number];

export type DesktopFeature =
  | 'account-settings'
  | 'activity'
  | 'assistant'
  | 'calibration'
  | 'documentation'
  | 'home'
  | 'improve'
  | 'measure'
  | 'prepare'
  | 'preview-workflow'
  | 'recover';

export interface DesktopRouteDefinition {
  readonly pattern: string;
  readonly feature: DesktopFeature;
  readonly surface:
    | 'AccountSettingsSurface'
    | 'ActivitySurface'
    | 'AssistantSurface'
    | 'CalibrationWorkspace'
    | 'ContextualHome'
    | 'DocumentationSurface'
    | 'ImproveSurface'
    | 'MeasureSurface'
    | 'PrepareSurface'
    | 'PreviewWorkflowSurface'
    | 'RecoverSurface';
  readonly state: string;
  readonly headingMessageId: string;
  readonly capability: 'navigate';
}

const route = <
  const Pattern extends string,
  const Feature extends DesktopFeature,
  const Surface extends DesktopRouteDefinition['surface'],
  const State extends string,
>(
  pattern: Pattern,
  feature: Feature,
  surface: Surface,
  state: State,
) =>
  Object.freeze({
    pattern,
    feature,
    surface,
    state,
    headingMessageId: `route.${feature}.${state}.heading`,
    capability: 'navigate' as const,
  }) satisfies DesktopRouteDefinition;

export const desktopRouteTree = Object.freeze([
  route('/', 'calibration', 'CalibrationWorkspace', 'welcome'),
  route('/login', 'account-settings', 'AccountSettingsSurface', 'login'),
  route('/calibration/welcome', 'calibration', 'CalibrationWorkspace', 'welcome'),
  route('/calibration/trust', 'calibration', 'CalibrationWorkspace', 'trust'),
  route('/calibration/inventory', 'calibration', 'CalibrationWorkspace', 'inventory'),
  route('/calibration/diagnosis', 'calibration', 'CalibrationWorkspace', 'diagnosis'),
  route('/calibration/recovery', 'calibration', 'CalibrationWorkspace', 'recovery'),
  route('/calibration/goals', 'calibration', 'CalibrationWorkspace', 'goals'),
  route('/calibration/games', 'calibration', 'CalibrationWorkspace', 'games'),
  route('/calibration/summary', 'calibration', 'CalibrationWorkspace', 'summary'),
  route('/home', 'home', 'ContextualHome', 'contextual'),
  route('/prepare', 'prepare', 'PrepareSurface', 'library'),
  route('/games', 'prepare', 'PrepareSurface', 'library'),
  route('/games/add', 'prepare', 'PrepareSurface', 'game-add'),
  route('/games/:gameId/overview', 'prepare', 'PrepareSurface', 'game-overview'),
  route('/games/:gameId/profile', 'prepare', 'PrepareSurface', 'profile'),
  route('/games/:gameId/evidence', 'prepare', 'PrepareSurface', 'evidence'),
  route('/games/:gameId/history', 'prepare', 'PrepareSurface', 'history'),
  route('/games/:gameId/preflight', 'prepare', 'PrepareSurface', 'preflight'),
  route('/session/:sessionId/active', 'prepare', 'PrepareSurface', 'session-active'),
  route('/session/:sessionId/restoring', 'prepare', 'PrepareSurface', 'session-restoring'),
  route('/session/:sessionId/result', 'prepare', 'PrepareSurface', 'session-result'),
  route('/improve', 'improve', 'ImproveSurface', 'goal-overview'),
  route('/goals/performance', 'improve', 'ImproveSurface', 'goal-performance'),
  route('/goals/latency', 'improve', 'ImproveSurface', 'goal-latency'),
  route('/goals/stability', 'improve', 'ImproveSurface', 'goal-stability'),
  route('/goals/privacy', 'improve', 'ImproveSurface', 'goal-privacy'),
  route('/components/:componentId', 'improve', 'ImproveSurface', 'component'),
  route('/operations/:operationId', 'improve', 'ImproveSurface', 'operation'),
  route('/plans/:planId/review', 'preview-workflow', 'PreviewWorkflowSurface', 'review'),
  route('/plans/:planId/confirm', 'preview-workflow', 'PreviewWorkflowSurface', 'confirm'),
  route('/plans/:planId/preview', 'preview-workflow', 'PreviewWorkflowSurface', 'preview'),
  route('/plans/:planId/restart', 'preview-workflow', 'PreviewWorkflowSurface', 'restart'),
  route('/plans/:planId/result', 'preview-workflow', 'PreviewWorkflowSurface', 'result'),
  route('/measure/overview', 'measure', 'MeasureSurface', 'overview'),
  route('/measure/baseline', 'measure', 'MeasureSurface', 'baseline'),
  route('/measure/capture', 'measure', 'MeasureSurface', 'capture'),
  route('/measure/sessions', 'measure', 'MeasureSurface', 'sessions'),
  route('/measure/compare', 'measure', 'MeasureSurface', 'compare'),
  route('/measure/rejected', 'measure', 'MeasureSurface', 'rejected-comparison'),
  route('/measure/diff', 'measure', 'MeasureSurface', 'diff'),
  route('/measure/timeline', 'measure', 'MeasureSurface', 'timeline'),
  route('/measure/reports', 'measure', 'MeasureSurface', 'reports'),
  route('/measure/collector-overhead', 'measure', 'MeasureSurface', 'collector-overhead'),
  route('/measure/degraded-coverage', 'measure', 'MeasureSurface', 'degraded-coverage'),
  route('/recover/overview', 'recover', 'RecoverSurface', 'overview'),
  route('/recover/ledger', 'recover', 'RecoverSurface', 'ledger'),
  route('/recover/snapshots', 'recover', 'RecoverSurface', 'snapshots'),
  route('/recover/plans/:planId', 'recover', 'RecoverSurface', 'plan'),
  route('/recover/emergency', 'recover', 'RecoverSurface', 'emergency'),
  route('/assistant', 'assistant', 'AssistantSurface', 'local'),
  route('/activity', 'activity', 'ActivitySurface', 'timeline'),
  route('/account/overview', 'account-settings', 'AccountSettingsSurface', 'account-overview'),
  route('/account/subscription', 'account-settings', 'AccountSettingsSurface', 'subscription'),
  route('/account/device', 'account-settings', 'AccountSettingsSurface', 'device'),
  route('/account/security', 'account-settings', 'AccountSettingsSurface', 'security'),
  route('/settings/general', 'account-settings', 'AccountSettingsSurface', 'general'),
  route('/settings/background', 'account-settings', 'AccountSettingsSurface', 'background'),
  route('/settings/appearance', 'account-settings', 'AccountSettingsSurface', 'appearance'),
  route('/settings/accessibility', 'account-settings', 'AccountSettingsSurface', 'accessibility'),
  route('/settings/privacy', 'account-settings', 'AccountSettingsSurface', 'privacy'),
  route('/settings/notifications', 'account-settings', 'AccountSettingsSurface', 'notifications'),
  route('/settings/updates', 'account-settings', 'AccountSettingsSurface', 'updates'),
  route('/settings/advanced', 'account-settings', 'AccountSettingsSurface', 'advanced'),
  route('/documentation/:documentId', 'documentation', 'DocumentationSurface', 'document'),
] satisfies readonly DesktopRouteDefinition[]);

export type DesktopRoutePattern = (typeof desktopRouteTree)[number]['pattern'];
export type DesktopRouteState = (typeof desktopRouteTree)[number]['state'];

export interface DesktopSearch {
  readonly filter?: string;
  readonly inspector?: string;
}

export interface ReturnIntent {
  readonly pathname: string;
}

export interface DesktopRouteMatch {
  readonly definition: DesktopRouteDefinition;
  readonly pathname: string;
  readonly feature: DesktopFeature;
  readonly state: DesktopRouteState;
  readonly params: Readonly<Record<string, string>>;
  readonly search: DesktopSearch;
  readonly returnIntent?: ReturnIntent;
}

export type DesktopRouteErrorCode =
  | 'EMPTY_NAVIGATION'
  | 'INVALID_NAVIGATION_INTENT'
  | 'INVALID_PARAMETER'
  | 'INVALID_SEARCH_VALUE'
  | 'UNKNOWN_ROUTE'
  | 'UNKNOWN_SEARCH_KEY'
  | 'UNSAFE_RETURN_INTENT';

export interface DesktopRouteError {
  readonly code: DesktopRouteErrorCode;
  readonly path: string;
}

export type DesktopRouteResult =
  | Readonly<{ ok: true; value: DesktopRouteMatch }>
  | Readonly<{ ok: false; error: DesktopRouteError }>;

const PARAMETER_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/u;
const SEARCH_VALUE_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/u;
const ALLOWED_SEARCH_KEYS = new Set(['filter', 'inspector', 'returnTo']);
const UNSAFE_RETURN_STATES = new Set(['confirm', 'preview', 'restart']);

const failure = (code: DesktopRouteErrorCode, path: string): DesktopRouteResult =>
  Object.freeze({ ok: false, error: Object.freeze({ code, path }) });

const decodedSegments = (pathname: string): readonly string[] | undefined => {
  try {
    return pathname
      .split('/')
      .filter((segment) => segment.length > 0)
      .map((segment) => decodeURIComponent(segment));
  } catch {
    return undefined;
  }
};

const matchDefinition = (
  definition: DesktopRouteDefinition,
  pathname: string,
): Readonly<Record<string, string>> | undefined => {
  const patternSegments = decodedSegments(definition.pattern);
  const pathSegments = decodedSegments(pathname);
  if (patternSegments === undefined || pathSegments?.length !== patternSegments.length) {
    return undefined;
  }

  const params: Record<string, string> = {};
  for (const [index, patternSegment] of patternSegments.entries()) {
    const pathSegment = pathSegments[index];
    if (pathSegment === undefined) {
      return undefined;
    }
    if (patternSegment.startsWith(':')) {
      if (!PARAMETER_PATTERN.test(pathSegment)) {
        return undefined;
      }
      params[patternSegment.slice(1)] = pathSegment;
      continue;
    }
    if (pathSegment !== patternSegment) {
      return undefined;
    }
  }
  return Object.freeze(params);
};

const parseSearch = (
  searchParams: URLSearchParams,
  pathname: string,
):
  | Readonly<{ ok: true; search: DesktopSearch; returnIntent?: ReturnIntent }>
  | Readonly<{ ok: false; error: DesktopRouteError }> => {
  for (const key of searchParams.keys()) {
    if (!ALLOWED_SEARCH_KEYS.has(key)) {
      return { ok: false, error: { code: 'UNKNOWN_SEARCH_KEY', path: `$.search.${key}` } };
    }
    if (searchParams.getAll(key).length !== 1) {
      return { ok: false, error: { code: 'INVALID_SEARCH_VALUE', path: `$.search.${key}` } };
    }
  }

  const search: { filter?: string; inspector?: string } = {};
  for (const key of ['filter', 'inspector'] as const) {
    const value = searchParams.get(key);
    if (value !== null) {
      if (!SEARCH_VALUE_PATTERN.test(value)) {
        return { ok: false, error: { code: 'INVALID_SEARCH_VALUE', path: `$.search.${key}` } };
      }
      search[key] = value;
    }
  }

  const returnTo = searchParams.get('returnTo');
  if (returnTo === null) {
    return { ok: true, search: Object.freeze(search) };
  }
  if (!returnTo.startsWith('/') || returnTo.includes('?') || returnTo.includes('#')) {
    return {
      ok: false,
      error: { code: 'UNSAFE_RETURN_INTENT', path: '$.search.returnTo' },
    };
  }
  const resolvedReturn = resolveDesktopRoute(returnTo);
  if (
    !resolvedReturn.ok ||
    UNSAFE_RETURN_STATES.has(resolvedReturn.value.state) ||
    resolvedReturn.value.pathname === pathname
  ) {
    return {
      ok: false,
      error: { code: 'UNSAFE_RETURN_INTENT', path: '$.search.returnTo' },
    };
  }
  return {
    ok: true,
    search: Object.freeze(search),
    returnIntent: Object.freeze({ pathname: resolvedReturn.value.pathname }),
  };
};

export const resolveDesktopRoute = (input: string): DesktopRouteResult => {
  if (input.length === 0 || input.includes('://')) {
    return failure('EMPTY_NAVIGATION', '$.pathname');
  }

  let parsed: URL;
  try {
    parsed = new URL(input, 'https://desktop.invalid');
  } catch {
    return failure('UNKNOWN_ROUTE', '$.pathname');
  }
  if (parsed.hash.length > 0 || (parsed.pathname !== '/' && parsed.pathname.endsWith('/'))) {
    return failure('UNKNOWN_ROUTE', '$.pathname');
  }

  for (const definition of desktopRouteTree) {
    const params = matchDefinition(definition, parsed.pathname);
    if (params === undefined) {
      continue;
    }
    const parsedSearch = parseSearch(parsed.searchParams, parsed.pathname);
    if (!parsedSearch.ok) {
      return Object.freeze({ ok: false, error: Object.freeze(parsedSearch.error) });
    }
    return Object.freeze({
      ok: true,
      value: Object.freeze({
        definition,
        pathname: parsed.pathname,
        feature: definition.feature,
        state: definition.state,
        params,
        search: parsedSearch.search,
        ...(parsedSearch.returnIntent === undefined
          ? {}
          : { returnIntent: parsedSearch.returnIntent }),
      }),
    });
  }

  const hasInvalidParameter = decodedSegments(parsed.pathname)?.some(
    (segment) =>
      segment === '..' || segment.includes('\\') || segment.includes('/') || segment.includes(':'),
  );
  return failure(
    hasInvalidParameter === true ? 'INVALID_PARAMETER' : 'UNKNOWN_ROUTE',
    '$.pathname',
  );
};

const GOAL_PATHS = Object.freeze({
  account: '/account/overview',
  activity: '/activity',
  assistant: '/assistant',
  home: '/home',
  improve: '/improve',
  measure: '/measure/overview',
  prepare: '/prepare',
  recover: '/recover/overview',
} satisfies Record<Extract<ShellNavigationIntentJson, { kind: 'goal' }>['destination'], string>);

const SETTINGS_PATHS = Object.freeze({
  accessibility: '/settings/accessibility',
  advanced: '/settings/advanced',
  appearance: '/settings/appearance',
  background: '/settings/background',
  general: '/settings/general',
  notifications: '/settings/notifications',
  privacy: '/settings/privacy',
  updates: '/settings/updates',
} satisfies Record<
  Extract<ShellNavigationIntentJson, { kind: 'settings' }>['destination'],
  string
>);

const CALIBRATION_PATHS = Object.freeze({
  diagnosis: '/calibration/diagnosis',
  games: '/calibration/games',
  goals: '/calibration/goals',
  inventory: '/calibration/inventory',
  recovery: '/calibration/recovery',
  summary: '/calibration/summary',
  trust: '/calibration/trust',
  welcome: '/calibration/welcome',
} satisfies Record<
  Extract<ShellNavigationIntentJson, { kind: 'calibration' }>['destination'],
  string
>);

export const routeFromValidatedShellNavigationIntent = (
  intent: ShellNavigationIntentJson,
): DesktopRouteResult => {
  let path: string | undefined;
  switch (intent.kind) {
    case 'goal':
      path = GOAL_PATHS[intent.destination];
      break;
    case 'settings':
      path = SETTINGS_PATHS[intent.destination];
      break;
    case 'calibration':
      path = CALIBRATION_PATHS[intent.destination];
      break;
    case 'documentation':
      path = PARAMETER_PATTERN.test(intent.documentId)
        ? `/documentation/${intent.documentId}`
        : undefined;
      break;
  }
  return path === undefined
    ? failure('INVALID_NAVIGATION_INTENT', '$.intent')
    : resolveDesktopRoute(path);
};

export interface DesktopBrowserHistory {
  readonly pushState: (pathname: string) => void;
  readonly back: () => void;
  readonly forward: () => void;
}

export interface DesktopKeyboardInput {
  readonly key: string;
  readonly altKey?: boolean;
  readonly ctrlKey?: boolean;
  readonly shiftKey?: boolean;
  readonly targetIsTextEntry?: boolean;
}

export type DesktopKeyboardResult =
  | Readonly<{ handled: false }>
  | Readonly<{
      handled: true;
      action: 'close-layer' | 'open-command-center' | 'open-shortcuts' | 'toggle-inspector';
    }>
  | Readonly<{ handled: true; action: 'focus-region'; region: DesktopF6Region }>
  | Readonly<{ handled: true; action: 'history-back' | 'history-forward' }>
  | Readonly<{ handled: true; action: 'navigate'; pathname: string }>;

export interface DesktopNavigatorOptions {
  readonly initialPath: string;
  readonly announce?: (messageId: string) => void;
  readonly focusHeading?: (headingMessageId: string) => void;
  readonly focusRegion?: (region: DesktopF6Region) => void;
  readonly history?: DesktopBrowserHistory;
}

export interface DesktopNavigator {
  readonly current: () => DesktopRouteMatch;
  readonly navigate: (target: string) => DesktopRouteResult;
  readonly handleKeyboard: (input: DesktopKeyboardInput) => DesktopKeyboardResult;
}

const GOAL_SHORTCUTS = Object.freeze({
  '1': '/home',
  '2': '/prepare',
  '3': '/improve',
  '4': '/measure/overview',
  '5': '/recover/overview',
  '6': '/assistant',
} satisfies Readonly<Record<string, string>>);

const isGoalShortcut = (key: string): key is keyof typeof GOAL_SHORTCUTS =>
  Object.hasOwn(GOAL_SHORTCUTS, key);

export const createDesktopNavigator = (options: DesktopNavigatorOptions): DesktopNavigator => {
  const initial = resolveDesktopRoute(options.initialPath);
  if (!initial.ok) {
    throw new Error(`Invalid initial desktop route: ${initial.error.code}`);
  }
  let currentRoute = initial.value;
  let f6Index = 0;

  const navigate = (target: string): DesktopRouteResult => {
    const result = resolveDesktopRoute(target);
    if (!result.ok) {
      return result;
    }
    currentRoute = result.value;
    options.history?.pushState(result.value.pathname);
    options.focusHeading?.(result.value.definition.headingMessageId);
    options.announce?.(result.value.definition.headingMessageId);
    return result;
  };

  const navigateFromKeyboard = (pathname: string): DesktopKeyboardResult => {
    const result = navigate(pathname);
    return result.ok
      ? Object.freeze({ handled: true, action: 'navigate', pathname: result.value.pathname })
      : Object.freeze({ handled: false });
  };

  const handleKeyboard = (input: DesktopKeyboardInput): DesktopKeyboardResult => {
    if (input.altKey === true && input.key === 'ArrowLeft') {
      options.history?.back();
      return Object.freeze({ handled: true, action: 'history-back' });
    }
    if (input.altKey === true && input.key === 'ArrowRight') {
      options.history?.forward();
      return Object.freeze({ handled: true, action: 'history-forward' });
    }
    if (input.ctrlKey === true && input.shiftKey === true && input.key.toLowerCase() === 'a') {
      return navigateFromKeyboard('/activity');
    }
    if (input.ctrlKey === true) {
      const shortcut = isGoalShortcut(input.key) ? GOAL_SHORTCUTS[input.key] : undefined;
      if (shortcut !== undefined) {
        return navigateFromKeyboard(shortcut);
      }
      if (input.key.toLowerCase() === 'k') {
        return Object.freeze({ handled: true, action: 'open-command-center' });
      }
      if (input.key === ',') {
        return navigateFromKeyboard('/settings/general');
      }
      if (input.key === '.') {
        return Object.freeze({ handled: true, action: 'toggle-inspector' });
      }
    }
    if (input.key === 'F6') {
      const region = DESKTOP_F6_REGIONS[f6Index];
      if (region === undefined) {
        return Object.freeze({ handled: false });
      }
      f6Index = (f6Index + 1) % DESKTOP_F6_REGIONS.length;
      options.focusRegion?.(region);
      return Object.freeze({ handled: true, action: 'focus-region', region });
    }
    if (input.key === 'Escape') {
      return Object.freeze({ handled: true, action: 'close-layer' });
    }
    if (input.key === '?' && input.targetIsTextEntry !== true) {
      return Object.freeze({ handled: true, action: 'open-shortcuts' });
    }
    return Object.freeze({ handled: false });
  };

  return Object.freeze({
    current: () => currentRoute,
    navigate,
    handleKeyboard,
  });
};
