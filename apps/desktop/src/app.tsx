import {
  ActivitySurface,
  AssistantSurface,
  CalibrationWorkspace,
  ContextualHome,
  DocumentationSurface,
  FavoritesManager,
  ImproveSurface,
  MeasureSurface,
  PrepareSurface,
  PreviewWorkflowSurface,
  RecoverSurface,
  SettingsSurface,
  UpdateSurface,
} from '@liiiraa/feature-shell';
import type {
  FavoriteCandidate,
  HomeCalibrationState,
  HomeClaim,
  PreferenceEvent,
  ShellLocale,
} from '@liiiraa/feature-shell';
import type {
  HostToRendererShellEventJson,
  RendererToHostShellCommandJson,
  ShellCloseContextJson,
  ShellCloseResolutionJson,
  ShellInstallerIdentityJson,
  ShellNavigationIntentJson,
  ShellNotificationPreferenceJson,
  ShellStartupStateJson,
  ShellWindowStateJson,
} from '@liiiraa/contracts-ts';
import {
  ContextInspector,
  CriticalStateRail,
  GoalRail,
  LbAlertDialog,
  LbButton,
  LbDialog,
  LbSearchField,
  OPERATIONAL_STATES,
  ProductIcon,
  StatusSignal,
  WindowTitleBar,
} from '@liiiraa/design-system';
import type { ActivityCenter, ActivityItem, OperationalState } from '@liiiraa/design-system';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { detectLocale, formatMessage, pseudoExpand } from './locales/i18n.js';
import { PremiumInstallerHandoff } from './features/premium-installer-handoff.js';
import { AccountExperience, type AccountExperienceView } from './features/account-experience.js';
import { STARTUP_PRESENTATION_STEPS, StartupSurface } from './features/startup.js';
import { NotificationCenter } from './features/notification-center.js';
import { PremiumOperationsSurface } from './features/premium-operations.js';
import type { PremiumRouteId } from './features/control-center-data.js';
import {
  createShellBridge,
  type ShellBridge,
  type ShellBridgeDiagnostic,
  type ShellBridgeTransport,
} from './native/shell-bridge.js';
import {
  DesktopPreferencesProvider,
  PreConsentLocaleControl,
  useDesktopPreferences,
  type HostCommandMetadata,
} from './preferences.js';
import { createDesktopNavigator, resolveDesktopRoute } from './routes.js';
import type { DesktopF6Region, DesktopNavigator, DesktopRouteMatch } from './routes.js';

export const SHELL_OPERATIONAL_STATES = OPERATIONAL_STATES satisfies readonly OperationalState[];
export type ShellOperationalState = (typeof SHELL_OPERATIONAL_STATES)[number];
export type ShellWidth = 'wide' | 'standard' | 'compact' | 'minimum';

interface OperationalPresentation {
  readonly action: Readonly<Record<ShellLocale, string>>;
  readonly reason: Readonly<Record<ShellLocale, string>>;
}

const OPERATIONAL_PRESENTATIONS: Readonly<Record<ShellOperationalState, OperationalPresentation>> =
  Object.freeze({
    loading: {
      reason: {
        en: 'The selected scenario is loading its deterministic local evidence.',
        'pt-BR': 'O cenário selecionado está carregando evidências locais determinísticas.',
      },
      action: { en: 'Wait for the named step', 'pt-BR': 'Aguardar a etapa identificada' },
    },
    empty: {
      reason: {
        en: 'No item exists in this scenario yet; no system change was attempted.',
        'pt-BR': 'Ainda não há item neste cenário; nenhuma alteração no sistema foi tentada.',
      },
      action: { en: 'Open the next guided step', 'pt-BR': 'Abrir a próxima etapa guiada' },
    },
    offline: {
      reason: {
        en: 'Connected validation is unavailable; local history and recovery remain available.',
        'pt-BR':
          'A validação conectada está indisponível; histórico local e recuperação continuam disponíveis.',
      },
      action: {
        en: 'Retry connected validation',
        'pt-BR': 'Tentar a validação conectada novamente',
      },
    },
    permission: {
      reason: {
        en: 'A scoped Windows capability is required; declining keeps the app in safe limited mode.',
        'pt-BR':
          'Uma capacidade limitada do Windows é necessária; recusar mantém o app em modo seguro limitado.',
      },
      action: { en: 'Review capability scope', 'pt-BR': 'Revisar o escopo da capacidade' },
    },
    unsupported: {
      reason: {
        en: 'The scenario hardware or Windows build does not meet this operation contract.',
        'pt-BR':
          'O hardware ou a versão do Windows do cenário não atende ao contrato desta operação.',
      },
      action: {
        en: 'Open compatibility documentation',
        'pt-BR': 'Abrir documentação de compatibilidade',
      },
    },
    'partial-failure': {
      reason: {
        en: 'One dependency failed after completed work was preserved for safe inspection.',
        'pt-BR':
          'Uma dependência falhou após o trabalho concluído ser preservado para inspeção segura.',
      },
      action: { en: 'Review the diagnostic receipt', 'pt-BR': 'Revisar o recibo de diagnóstico' },
    },
    'restart-pending': {
      reason: {
        en: 'Previewed changes are waiting for a scheduled restart; the current state remains safe.',
        'pt-BR':
          'Alterações previstas aguardam reinicialização agendada; o estado atual permanece seguro.',
      },
      action: {
        en: 'Review restart schedule',
        'pt-BR': 'Revisar o agendamento de reinicialização',
      },
    },
    recovery: {
      reason: {
        en: 'An interrupted preview requires verification before normal work can continue.',
        'pt-BR': 'Uma prévia interrompida exige verificação antes que o trabalho normal continue.',
      },
      action: { en: 'Open guided recovery', 'pt-BR': 'Abrir recuperação guiada' },
    },
    'expired-entitlement': {
      reason: {
        en: 'New Premium actions are blocked; history, warnings, and recovery remain available.',
        'pt-BR':
          'Novas ações Premium estão bloqueadas; histórico, alertas e recuperação continuam disponíveis.',
      },
      action: { en: 'Review retained access', 'pt-BR': 'Revisar o acesso mantido' },
    },
    'stale-evidence': {
      reason: {
        en: 'The evidence is older than its freshness policy and cannot support a new recommendation.',
        'pt-BR':
          'A evidência excedeu sua política de atualização e não sustenta uma nova recomendação.',
      },
      action: { en: 'Refresh local evidence', 'pt-BR': 'Atualizar evidências locais' },
    },
    'contradictory-evidence': {
      reason: {
        en: 'Trusted sources disagree, so the result is closed until evidence is collected again.',
        'pt-BR':
          'Fontes confiáveis divergem; o resultado permanece fechado até nova coleta de evidências.',
      },
      action: { en: 'Review collection guidance', 'pt-BR': 'Revisar as orientações de coleta' },
    },
    fixture: {
      reason: {
        en: 'This is deterministic fixture evidence and makes no claim about this PC.',
        'pt-BR':
          'Esta é uma evidência de fixture determinística e não faz afirmações sobre este PC.',
      },
      action: {
        en: 'Inspect scenario provenance',
        'pt-BR': 'Inspecionar a proveniência do cenário',
      },
    },
  });

export const getOperationalPresentation = (
  state: ShellOperationalState,
  locale: ShellLocale,
): Readonly<{ action: string; reason: string }> =>
  Object.freeze({
    action: OPERATIONAL_PRESENTATIONS[state].action[locale],
    reason: OPERATIONAL_PRESENTATIONS[state].reason[locale],
  });

const READY_CALIBRATION = Object.freeze({
  access: 'ready',
  requiredComplete: true,
  optionalProgress: Object.freeze({ completed: 5, total: 5 }),
  trustedSteps: Object.freeze([
    'trustPrivacy',
    'systemInventory',
    'performanceDiagnosis',
    'recoveryReadiness',
    'goals',
    'priorityGames',
    'review',
  ] as const),
  incompleteSteps: Object.freeze([] as const),
  recommendationsAllowed: true,
  continueAction: Object.freeze({
    prominence: 'hidden',
    messageId: 'calibration.action.continue',
    step: null,
  }),
}) satisfies HomeCalibrationState;

const createHomeClaims = (locale: ShellLocale): readonly HomeClaim[] =>
  Object.freeze([
    Object.freeze({
      capturedAt: '2030-01-15T18:00:00.000Z',
      detail:
        locale === 'pt-BR'
          ? 'A evidência simulada de compatibilidade está atualizada para o cenário S01.'
          : 'Synthetic compatibility evidence is current for scenario S01.',
      freshness: 'current',
      id: 'S01-compatibility',
      label: locale === 'pt-BR' ? 'Compatibilidade do cenário' : 'Scenario compatibility',
      source: 'fixture-policy',
      state: 'fixture',
    }),
  ]);

const SETTINGS_FAVORITE_CANDIDATES: readonly FavoriteCandidate[] = Object.freeze([
  Object.freeze({
    eligibility: 'safe',
    id: 'game-northstar',
    kind: 'game',
    label: 'Northstar Arena',
  }),
  Object.freeze({
    eligibility: 'safe',
    id: 'game-vector-strike',
    kind: 'game',
    label: 'Vector Strike Arena',
  }),
  Object.freeze({
    eligibility: 'safe',
    id: 'metric-frame-time',
    kind: 'metric',
    label: 'Frame time',
  }),
  Object.freeze({
    eligibility: 'safe',
    id: 'safe-open-activity',
    kind: 'safe-action',
    label: 'Open Activity',
  }),
]);

const SETTINGS_INITIAL_FAVORITES = Object.freeze(SETTINGS_FAVORITE_CANDIDATES.slice(0, 3));

const ACTIVITY_EVENTS: Parameters<typeof ActivitySurface>[0]['events'] = Object.freeze([
  Object.freeze({
    correlationId: 'S17-recovery-0001',
    category: 'recovery',
    state: 'requires-action',
    severity: 'warning',
    title: 'Review guided recovery',
    affectedObject: 'Scenario preview',
    occurredAt: '2030-01-15T18:01:00.000Z',
    source: 'fixture-policy',
    acknowledged: false,
    resolved: false,
    dismissed: false,
    scenarioMarked: true,
    notificationCategory: 'recovery-required',
  }),
]);

const activityOverlayItems: Parameters<typeof ActivityCenter>[0]['items'] = Object.freeze([
  Object.freeze({
    detail: 'Scenario S17 recovery receipt is ready for review.',
    id: 'S17-recovery-0001',
    state: 'recovery',
    title: 'Guided recovery requires attention',
  }),
]);

type NativeActivityEvent = Parameters<typeof ActivitySurface>[0]['events'][number];

export const routeForNativeNavigation = (intent: ShellNavigationIntentJson): string => {
  switch (intent.kind) {
    case 'goal': {
      const routes = {
        home: '/home',
        prepare: '/prepare',
        improve: '/improve',
        measure: '/measure/overview',
        recover: '/recover/overview',
        assistant: '/assistant',
        activity: '/activity',
        account: '/account/overview',
      } satisfies Readonly<Record<typeof intent.destination, string>>;
      return routes[intent.destination];
    }
    case 'settings':
      return `/settings/${intent.destination}`;
    case 'calibration':
      return `/calibration/${intent.destination}`;
    case 'documentation':
      return `/documentation/${encodeURIComponent(intent.documentId)}`;
  }
};

export interface NativeShellCompositionCallbacks {
  readonly onCloseRequest: (context: ShellCloseContextJson) => void;
  readonly onDiagnostic: (diagnostic: ShellBridgeDiagnostic) => void;
  readonly onEvent: (event: HostToRendererShellEventJson) => void;
  readonly onHostPreference: (event: PreferenceEvent) => void;
  readonly onInstallerIdentity: (identity: ShellInstallerIdentityJson) => void;
  readonly onNavigation: (pathname: string, requestId: string) => void;
  readonly onNotificationPreference: (preference: ShellNotificationPreferenceJson) => void;
  readonly onStartupState: (state: ShellStartupStateJson) => void;
  readonly onWindowState: (state: ShellWindowStateJson) => void;
}

export interface CreateNativeShellCompositionOptions {
  readonly callbacks: NativeShellCompositionCallbacks;
  readonly transport?: ShellBridgeTransport;
}

export const createNativeShellComposition = ({
  callbacks,
  transport,
}: CreateNativeShellCompositionOptions): ShellBridge => {
  const observe = (event: HostToRendererShellEventJson, project: () => void): void => {
    callbacks.onEvent(event);
    project();
  };

  return createShellBridge({
    handlers: {
      onInstallerIdentity: (event) => {
        observe(event, () => {
          callbacks.onInstallerIdentity(event.payload.installer);
        });
      },
      onStartupState: (event) => {
        observe(event, () => {
          callbacks.onStartupState(event.payload.state);
        });
      },
      onNavigation: (event) => {
        observe(event, () => {
          callbacks.onNavigation(routeForNativeNavigation(event.payload.intent), event.requestId);
        });
      },
      onLocale: (event) => {
        observe(event, () => {
          callbacks.onHostPreference({
            type: 'set-locale',
            locale: event.payload.locale === 'pt-BR' ? 'pt-BR' : 'en-US',
          });
        });
      },
      onTrayPreference: (event) => {
        observe(event, () => {
          callbacks.onHostPreference({
            type: 'set-tray-enabled',
            enabled: event.payload.preference === 'keep-game-detection-in-tray',
          });
        });
      },
      onCloseRequest: (event) => {
        observe(event, () => {
          callbacks.onCloseRequest(event.payload.context);
        });
      },
      onNotificationPreference: (event) => {
        observe(event, () => {
          callbacks.onNotificationPreference(event.payload.preference);
        });
      },
      onWindowState: (event) => {
        observe(event, () => {
          callbacks.onWindowState(event.payload.state);
        });
      },
    },
    onDiagnostic: callbacks.onDiagnostic,
    ...(transport === undefined ? {} : { transport }),
  });
};

export const createHostCommandMetadataFactory = (
  now: () => string = () => new Date().toISOString(),
): (() => HostCommandMetadata) => {
  let sequence = 0;

  return () => {
    sequence += 1;
    return Object.freeze({
      requestId: `renderer-shell-${String(sequence).padStart(6, '0')}`,
      issuedAt: now(),
    });
  };
};

const nativeActivityFor = (event: HostToRendererShellEventJson): NativeActivityEvent => {
  const isFailure =
    event.messageType === 'desktop.shell.startup-state-changed.event' &&
    event.payload.state.kind === 'failure';
  const isClose = event.messageType === 'desktop.shell.close-requested.event';
  const category: NativeActivityEvent['category'] =
    event.messageType === 'desktop.shell.installer-identity.event' ||
    event.messageType === 'desktop.shell.startup-state-changed.event'
      ? 'updates'
      : isClose
        ? 'recovery'
        : event.messageType === 'desktop.shell.notification-preference-changed.event' ||
            event.messageType === 'desktop.shell.locale-changed.event' ||
            event.messageType === 'desktop.shell.tray-preference-changed.event'
          ? 'account'
          : 'plans';

  return Object.freeze({
    correlationId: event.correlationId ?? event.requestId,
    category,
    state: isFailure || isClose ? 'requires-action' : 'completed',
    severity: isFailure ? 'critical' : isClose ? 'warning' : 'normal',
    title: event.messageType,
    affectedObject: 'Native desktop shell',
    occurredAt: event.issuedAt,
    source: 'validated-native-shell',
    acknowledged: false,
    resolved: false,
    dismissed: false,
    scenarioMarked: false,
  });
};

const nativeOverlayItemFor = (event: HostToRendererShellEventJson): ActivityItem | undefined => {
  if (
    event.messageType === 'desktop.shell.startup-state-changed.event' &&
    event.payload.state.kind === 'failure'
  ) {
    return Object.freeze({
      detail: event.payload.state.reason,
      id: event.requestId,
      state: 'partial-failure',
      title: 'Native startup requires attention',
    });
  }

  if (event.messageType === 'desktop.shell.close-requested.event') {
    return Object.freeze({
      detail: event.payload.context.kind,
      id: event.requestId,
      state: event.payload.context.kind === 'recovery-in-progress' ? 'recovery' : 'restart-pending',
      title: 'Close decision requires attention',
    });
  }

  return undefined;
};

interface NativeShellState {
  readonly activityEvents: readonly NativeActivityEvent[];
  readonly activityItems: readonly ActivityItem[];
  readonly closeContext?: ShellCloseContextJson;
  readonly diagnostic?: ShellBridgeDiagnostic;
  readonly hostPreferenceEvent?: PreferenceEvent;
  readonly installerAccepted: boolean;
  readonly installerIdentity?: ShellInstallerIdentityJson;
  readonly navigation?: Readonly<{ pathname: string; requestId: string }>;
  readonly notificationPreference?: ShellNotificationPreferenceJson;
  readonly startupAcknowledged: boolean;
  readonly startupState: ShellStartupStateJson;
  readonly windowState?: ShellWindowStateJson;
}

const DESKTOP_FIRST_RUN_STORAGE_KEY = 'liiiraa.desktop.first-run.v1';

interface DesktopFirstRunState {
  readonly installerAccepted: boolean;
  readonly startupAcknowledged: boolean;
}

const loadDesktopFirstRunState = (): DesktopFirstRunState => {
  try {
    const parsed = JSON.parse(
      globalThis.localStorage.getItem(DESKTOP_FIRST_RUN_STORAGE_KEY) ?? 'null',
    ) as Partial<DesktopFirstRunState> | null;
    return Object.freeze({
      installerAccepted: parsed?.installerAccepted === true,
      startupAcknowledged: parsed?.startupAcknowledged === true,
    });
  } catch {
    return Object.freeze({ installerAccepted: false, startupAcknowledged: false });
  }
};

const persistDesktopFirstRunState = (state: DesktopFirstRunState): void => {
  try {
    globalThis.localStorage.setItem(DESKTOP_FIRST_RUN_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // A blocked storage backend may repeat onboarding but must never block startup.
  }
};

const createInitialNativeShellState = (nativeShell: boolean): NativeShellState => {
  const startupState: ShellStartupStateJson = nativeShell
    ? { kind: 'splash', step: 'initializing-webview' }
    : { kind: 'ready' };
  const firstRun = nativeShell
    ? loadDesktopFirstRunState()
    : Object.freeze({ installerAccepted: true, startupAcknowledged: true });

  return Object.freeze({
    activityEvents: Object.freeze([]),
    activityItems: Object.freeze([]),
    installerAccepted: firstRun.installerAccepted,
    startupAcknowledged: firstRun.startupAcknowledged,
    startupState,
  });
};

const resolveInitialRoute = (initialPath: string): DesktopRouteMatch => {
  const result = resolveDesktopRoute(initialPath);
  if (result.ok) {
    return result.value;
  }

  const fallback = resolveDesktopRoute('/calibration/welcome');
  if (!fallback.ok) {
    throw new Error('The canonical desktop fallback route is unavailable.');
  }
  return fallback.value;
};

export interface ResponsiveShellLayout {
  readonly inspectorMode: 'overlay' | 'persistent';
  readonly pageHorizontalScroll: 'forbidden';
  readonly railWidth: 64 | 72 | 200 | 216;
  readonly width: ShellWidth;
}

export const getResponsiveShellLayout = (viewportWidth: number): ResponsiveShellLayout => {
  if (viewportWidth >= 1440) {
    return Object.freeze({
      inspectorMode: 'persistent',
      pageHorizontalScroll: 'forbidden',
      railWidth: 216,
      width: 'wide',
    });
  }
  if (viewportWidth >= 1180) {
    return Object.freeze({
      inspectorMode: 'overlay',
      pageHorizontalScroll: 'forbidden',
      railWidth: 200,
      width: 'standard',
    });
  }
  if (viewportWidth >= 960) {
    return Object.freeze({
      inspectorMode: 'overlay',
      pageHorizontalScroll: 'forbidden',
      railWidth: 72,
      width: 'compact',
    });
  }
  return Object.freeze({
    inspectorMode: 'overlay',
    pageHorizontalScroll: 'forbidden',
    railWidth: 64,
    width: 'minimum',
  });
};

const calibrationStateFor = (
  routeState: DesktopRouteMatch['state'],
): NonNullable<Parameters<typeof CalibrationWorkspace>[0]['surfaceState']> => {
  if (routeState === 'summary') {
    return 'completed';
  }
  if (routeState === 'welcome' || routeState === 'trust') {
    return 'new';
  }
  return 'running';
};

const prepareViewFor = (
  routeState: DesktopRouteMatch['state'],
): Parameters<typeof PrepareSurface>[0]['view'] => {
  const views = {
    library: 'library',
    'game-add': 'library',
    'game-overview': 'overview',
    'game-profile': 'profile',
    'game-evidence': 'evidence',
    'game-history': 'history',
    'game-preflight': 'preflight',
    'session-active': 'active-session',
    'session-restoring': 'restoration',
    'session-result': 'result',
  } as const;
  return Object.hasOwn(views, routeState) ? views[routeState as keyof typeof views] : 'library';
};

const improveViewFor = (
  routeState: DesktopRouteMatch['state'],
): Parameters<typeof ImproveSurface>[0]['view'] => {
  if (routeState === 'component') {
    return 'component';
  }
  if (routeState === 'operation') {
    return 'operation';
  }
  return 'goals';
};

const measureViewFor = (
  routeState: DesktopRouteMatch['state'],
): Parameters<typeof MeasureSurface>[0]['view'] => {
  const views = {
    overview: 'overview',
    baseline: 'baseline',
    capture: 'capture',
    sessions: 'session-history',
    compare: 'matched-comparison',
    'rejected-comparison': 'rejected-comparison',
    diff: 'diff',
    timeline: 'timeline',
    reports: 'report-preview',
    'collector-overhead': 'collector-overhead',
    'degraded-coverage': 'degraded-coverage',
  } as const;
  return Object.hasOwn(views, routeState) ? views[routeState as keyof typeof views] : 'overview';
};

const recoverViewFor = (
  routeState: DesktopRouteMatch['state'],
): NonNullable<Parameters<typeof RecoverSurface>[0]['view']> => {
  const views = {
    overview: 'overview',
    ledger: 'ledger',
    snapshots: 'snapshots',
    'plan-detail': 'interrupted-plan',
    emergency: 'emergency',
  } as const;
  return Object.hasOwn(views, routeState) ? views[routeState as keyof typeof views] : 'overview';
};

const previewStateFor = (
  routeState: DesktopRouteMatch['state'],
): NonNullable<Parameters<typeof PreviewWorkflowSurface>[0]['state']> => {
  const states = {
    review: 'review',
    confirmation: 'confirming',
    preview: 'previewing',
    restart: 'restart-pending',
    result: 'preview-complete',
  } as const;
  return Object.hasOwn(states, routeState) ? states[routeState as keyof typeof states] : 'review';
};

const improveGoalFor = (
  routeState: DesktopRouteMatch['state'],
): NonNullable<Parameters<typeof ImproveSurface>[0]['selectedGoal']> => {
  const goals = {
    'goal-performance': 'performance',
    'goal-latency': 'latency',
    'goal-stability': 'stability',
    'goal-privacy': 'privacy',
  } as const;
  return Object.hasOwn(goals, routeState) ? goals[routeState as keyof typeof goals] : 'performance';
};

const accountViewFor = (routeState: DesktopRouteMatch['state']): AccountExperienceView => {
  if (
    routeState === 'login' ||
    routeState === 'subscription' ||
    routeState === 'device' ||
    routeState === 'security'
  ) {
    return routeState;
  }
  return 'overview';
};

const improvePathFor = (
  target: Parameters<NonNullable<Parameters<typeof ImproveSurface>[0]['onNavigate']>>[0],
  id?: string,
): string => {
  switch (target) {
    case 'goals':
      return id === undefined ? '/improve' : `/goals/${id}`;
    case 'component':
      return `/components/${id ?? 'windows'}`;
    case 'operation':
      return `/operations/${id ?? 'power-balanced-review'}`;
    case 'plan-review':
      return `/plans/${id ?? 'recommended-plan'}/review`;
    case 'confirmation':
      return '/plans/recommended-plan/confirm';
    case 'restart':
      return '/plans/recommended-plan/restart';
    case 'recovery-history':
      return '/recover/ledger';
    case 'no-change-receipt':
      return '/plans/recommended-plan/result';
  }
};

const preparePathFor = (
  target: Parameters<NonNullable<Parameters<typeof PrepareSurface>[0]['onNavigate']>>[0],
): string => {
  const paths = {
    library: '/games',
    'manual-add': '/games/add',
    overview: '/games/northstar-arena/overview',
    profile: '/games/northstar-arena/profile',
    evidence: '/games/northstar-arena/evidence',
    history: '/games/northstar-arena/history',
    preflight: '/games/northstar-arena/preflight',
    'active-session': '/session/demo-session/active',
    restoration: '/session/demo-session/restoring',
    result: '/session/demo-session/result',
    recovery: '/recover/overview',
  } as const;
  return paths[target];
};

const measurePathFor = (
  target: Parameters<NonNullable<Parameters<typeof MeasureSurface>[0]['onNavigate']>>[0],
): string => {
  const paths = {
    overview: '/measure/overview',
    baseline: '/measure/baseline',
    capture: '/measure/capture',
    'session-history': '/measure/sessions',
    'matched-comparison': '/measure/compare',
    'rejected-comparison': '/measure/rejected',
    diff: '/measure/diff',
    timeline: '/measure/timeline',
    'report-preview': '/measure/reports',
    'collector-overhead': '/measure/collector-overhead',
    'degraded-coverage': '/measure/degraded-coverage',
  } as const;
  return paths[target];
};

export interface DesktopRouteOutletProps {
  readonly activityEvents?: readonly NativeActivityEvent[];
  readonly locale: ShellLocale;
  readonly navigate: (pathname: string) => void;
  readonly route: DesktopRouteMatch;
  readonly scenarioId: string;
}

export const DesktopRouteOutlet = ({
  activityEvents = ACTIVITY_EVENTS,
  locale,
  navigate,
  route,
  scenarioId,
}: DesktopRouteOutletProps): ReactNode => {
  const surfaceName: string = route.definition.surface;

  if (surfaceName === 'ContextualHome') {
    return <PremiumOperationsSurface locale={locale} navigate={navigate} view="home" />;
  }
  if (surfaceName === 'ActivitySurface') {
    return <PremiumOperationsSurface locale={locale} navigate={navigate} view="activity" />;
  }
  if (
    route.definition.surface === 'AccountSettingsSurface' &&
    route.pathname.startsWith('/settings/')
  ) {
    return (
      <PremiumOperationsSurface
        locale={locale}
        navigate={navigate}
        settingsSection={route.state}
        view="settings"
      />
    );
  }

  switch (surfaceName) {
    case 'CalibrationWorkspace':
      return (
        <CalibrationWorkspace
          locale={locale}
          onComplete={() => {
            navigate('/home');
          }}
          scenarioId={scenarioId}
          surfaceState={calibrationStateFor(route.state)}
        />
      );
    case 'ContextualHome':
      return (
        <ContextualHome
          calibration={READY_CALIBRATION}
          claims={createHomeClaims(locale)}
          locale={locale}
          nextAction={{
            consequence:
              locale === 'pt-BR'
                ? 'Nenhuma alteração será aplicada antes da sua confirmação.'
                : 'No change will be applied before your confirmation.',
            cta: locale === 'pt-BR' ? 'Executar otimização' : 'Run optimization',
            evidence:
              locale === 'pt-BR' ? 'Cenário demonstrativo local.' : 'Local demonstration scenario.',
            onPress: () => {
              navigate('/improve');
            },
            reason:
              locale === 'pt-BR'
                ? 'O plano está disponível para revisão.'
                : 'The plan is available for review.',
            title: locale === 'pt-BR' ? 'Plano recomendado' : 'Recommended plan',
          }}
          scenarioId={scenarioId}
          variant="ready"
        />
      );
    case 'PremiumOperationsSurface':
      return (
        <PremiumOperationsSurface
          locale={locale}
          navigate={navigate}
          view={route.state as PremiumRouteId}
        />
      );
    case 'PrepareSurface':
      return (
        <PrepareSurface
          locale={locale}
          onNavigate={(target) => {
            navigate(preparePathFor(target));
          }}
          scenarioId={scenarioId}
          view={prepareViewFor(route.state)}
        />
      );
    case 'ImproveSurface':
      return (
        <ImproveSurface
          locale={locale}
          onNavigate={(target, id) => {
            navigate(improvePathFor(target, id));
          }}
          scenarioId={scenarioId}
          selectedComponent={
            (route.params['componentId'] as
              NonNullable<Parameters<typeof ImproveSurface>[0]['selectedComponent']> | undefined) ??
            'windows'
          }
          selectedGoal={improveGoalFor(route.state)}
          {...(route.params['operationId'] === undefined
            ? {}
            : { selectedOperationId: route.params['operationId'] })}
          view={improveViewFor(route.state)}
        />
      );
    case 'PreviewWorkflowSurface':
      return (
        <PreviewWorkflowSurface
          locale={locale}
          scenarioId={scenarioId}
          state={previewStateFor(route.state)}
        />
      );
    case 'MeasureSurface':
      return (
        <MeasureSurface
          locale={locale}
          onNavigate={(target) => {
            navigate(measurePathFor(target));
          }}
          scenarioId={scenarioId}
          view={measureViewFor(route.state)}
        />
      );
    case 'RecoverSurface':
      return (
        <RecoverSurface
          locale={locale}
          scenarioId={scenarioId}
          view={recoverViewFor(route.state)}
        />
      );
    case 'AssistantSurface':
      return <AssistantSurface locale={locale} scenarioId={scenarioId} view="local" />;
    case 'ActivitySurface':
      return (
        <ActivitySurface
          events={activityEvents}
          key={activityEvents.map(({ correlationId }) => correlationId).join(':')}
          locale={locale}
          onNavigate={navigate}
          scenarioId={scenarioId}
        />
      );
    case 'AccountSettingsSurface':
      if (route.state === 'general' || route.pathname.startsWith('/settings/')) {
        if (route.state === 'updates') {
          return (
            <SettingsSurface
              activeSection={route.state}
              locale={locale}
              onNavigate={(section) => {
                navigate(`/settings/${section}`);
              }}
              scenarioId={scenarioId}
            >
              <UpdateSurface locale={locale} scenarioId={scenarioId} state="current" />
            </SettingsSurface>
          );
        }
        return (
          <SettingsSurface
            activeSection={route.state}
            locale={locale}
            onNavigate={(section) => {
              navigate(`/settings/${section}`);
            }}
            scenarioId={scenarioId}
          >
            <section
              aria-labelledby="desktop-language-title"
              className="lb-settings-regional"
              data-lb-region
            >
              <header>
                <ProductIcon name="languages" size={20} />
                <div>
                  <h2 id="desktop-language-title">
                    {locale === 'pt-BR' ? 'Preferências regionais' : 'Regional preferences'}
                  </h2>
                  <p>
                    {locale === 'pt-BR'
                      ? 'Idioma aplicado à interface e às mensagens do aplicativo.'
                      : 'Language used by the interface and application messages.'}
                  </p>
                </div>
              </header>
              <PreConsentLocaleControl />
            </section>
            <div className="lb-settings-favorites">
              <ProductIcon name="star" size={20} />
              <FavoritesManager
                candidates={SETTINGS_FAVORITE_CANDIDATES}
                headingLevel="h2"
                initialFavorites={SETTINGS_INITIAL_FAVORITES}
                locale={locale}
              />
            </div>
          </SettingsSurface>
        );
      }
      return (
        <AccountExperience
          locale={locale}
          navigate={navigate}
          scenarioId={scenarioId}
          view={accountViewFor(route.state)}
        />
      );
    case 'DocumentationSurface':
      return (
        <main>
          <DocumentationSurface
            documentId={route.params['documentId'] ?? 'local-overview'}
            locale={locale}
            scenarioId={scenarioId}
          />
        </main>
      );
    default:
      throw new Error(`Unsupported desktop surface: ${surfaceName}`);
  }
};

const criticalStateFor = (
  state: ShellOperationalState,
): Parameters<typeof CriticalStateRail>[0]['state'] | undefined => {
  if (
    state === 'recovery' ||
    state === 'unsupported' ||
    state === 'restart-pending' ||
    state === 'permission' ||
    state === 'contradictory-evidence'
  ) {
    return state;
  }
  return undefined;
};

const activeGoalFor = (route: DesktopRouteMatch): string => {
  if (route.pathname.startsWith('/settings/')) {
    return 'settings';
  }
  if (route.definition.surface === 'PremiumOperationsSurface') {
    return route.state;
  }
  if (route.pathname.startsWith('/account/')) {
    return 'account';
  }
  return route.feature;
};

const deferFocus = (focus: () => void): void => {
  if (typeof globalThis.requestAnimationFrame === 'function') {
    globalThis.requestAnimationFrame(focus);
    return;
  }
  focus();
};

const hasSimulatedScenarioMarker = (): boolean => {
  const testState = Reflect.get(globalThis, '__LIIIRAA_DESKTOP_TEST__') as unknown;
  if (typeof testState !== 'object' || testState === null) {
    return false;
  }
  const scenario = Reflect.get(testState, 'scenario') as unknown;
  return (
    typeof scenario === 'object' &&
    scenario !== null &&
    (Reflect.get(scenario, 'marker') as unknown) === 'SIMULATED SCENARIO'
  );
};

const pseudoLocalizeText = (root: HTMLElement): void => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node !== null) {
    const source = node.nodeValue ?? '';
    const content = source.trim();
    const parent = node.parentElement;
    if (
      content !== '' &&
      !content.startsWith('⟦') &&
      !content.includes('DEMO') &&
      !content.includes('SIMULATED SCENARIO') &&
      !/^S(?:0[1-9]|1[0-9]|2[0-4])$/u.test(content) &&
      parent?.closest('script, style, [aria-hidden="true"]') === null
    ) {
      node.nodeValue = source.replace(content, pseudoExpand(content));
    }
    node = walker.nextNode();
  }
};

export interface DesktopAppProps {
  readonly appScale?: 100 | 125 | 150;
  readonly catalogLocale?: 'pseudo';
  readonly forcedColors?: boolean;
  readonly initialPath?: string;
  readonly nativeBridgeTransport?: ShellBridgeTransport;
  readonly nativeCommandMetadata?: () => HostCommandMetadata;
  readonly nativeShell?: boolean;
  readonly operationalState?: ShellOperationalState;
  readonly reducedMotion?: boolean;
  readonly scenarioId?: string;
  readonly textScale?: 100 | 200;
  readonly viewportWidth?: number;
  readonly windowsLocale?: string;
}

type DesktopAppContentProps = Omit<
  DesktopAppProps,
  'nativeBridgeTransport' | 'nativeCommandMetadata' | 'nativeShell' | 'windowsLocale'
> &
  Readonly<{
    nativeState?: NativeShellState;
    onSendHostCommand?: (command: RendererToHostShellCommandJson) => void;
    commandMetadata?: () => HostCommandMetadata;
  }>;

const DesktopAppContent = ({
  appScale,
  catalogLocale,
  forcedColors = false,
  initialPath = '/login',
  nativeState,
  onSendHostCommand,
  commandMetadata,
  operationalState = 'fixture',
  reducedMotion,
  scenarioId = 'S01',
  textScale = 100,
  viewportWidth,
}: DesktopAppContentProps) => {
  const { preferences } = useDesktopPreferences();
  const locale: ShellLocale = preferences.locale === 'pt-BR' ? 'pt-BR' : 'en';
  const [route, setRoute] = useState(() => resolveInitialRoute(initialPath));
  const [announcement, setAnnouncement] = useState(route.definition.headingMessageId);
  const [activityOpen, setActivityOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [measuredWidth, setMeasuredWidth] = useState(
    viewportWidth ?? (typeof globalThis.innerWidth === 'number' ? globalThis.innerWidth : 1280),
  );
  const titleRegionRef = useRef<HTMLDivElement>(null);
  const goalRegionRef = useRef<HTMLDivElement>(null);
  const workCanvasRef = useRef<HTMLDivElement>(null);
  const inspectorRegionRef = useRef<HTMLDivElement>(null);
  const lastOverlayInvoker = useRef<HTMLElement | null>(null);
  const navigatorRef = useRef<DesktopNavigator | null>(null);

  useEffect(() => {
    if (catalogLocale !== 'pseudo' || !hasSimulatedScenarioMarker()) {
      return;
    }

    const applyPseudoLocale = (): void => {
      document.documentElement.lang = 'x-pseudo';
      const shell = document.querySelector<HTMLElement>('.desktop-app-shell');
      if (shell !== null) {
        pseudoLocalizeText(shell);
      }
    };
    const frame = globalThis.requestAnimationFrame(applyPseudoLocale);
    return () => {
      globalThis.cancelAnimationFrame(frame);
    };
  }, [catalogLocale, locale, operationalState, route.pathname]);

  const focusHeading = useCallback(() => {
    deferFocus(() => {
      const workCanvas = workCanvasRef.current;
      workCanvas?.scrollTo({ left: 0, top: 0 });
      workCanvas?.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true });
    });
  }, []);

  const focusRegion = useCallback((region: DesktopF6Region) => {
    if (region === 'inspector') {
      setInspectorOpen(true);
    }
    deferFocus(() => {
      const regions: Readonly<Record<DesktopF6Region, HTMLElement | null>> = {
        'title-bar': titleRegionRef.current,
        'goal-rail': goalRegionRef.current,
        main: workCanvasRef.current,
        inspector: inspectorRegionRef.current,
      };
      regions[region]?.focus();
    });
  }, []);

  navigatorRef.current ??= createDesktopNavigator({
    announce: setAnnouncement,
    focusHeading,
    focusRegion,
    ...(typeof globalThis.history === 'undefined'
      ? {}
      : {
          history: {
            back: () => {
              globalThis.history.back();
            },
            forward: () => {
              globalThis.history.forward();
            },
            pushState: (pathname) => {
              globalThis.history.pushState(null, '', pathname);
            },
          },
        }),
    initialPath: route.pathname,
  });

  const navigate = useCallback((pathname: string) => {
    const result = navigatorRef.current?.navigate(pathname);
    if (result?.ok === true) {
      setRoute(result.value);
    }
  }, []);

  useEffect(() => {
    if (nativeState?.navigation !== undefined) {
      navigate(nativeState.navigation.pathname);
    }
  }, [nativeState?.navigation, navigate]);

  const sendNotificationPreference = useCallback(() => {
    if (
      nativeState === undefined ||
      onSendHostCommand === undefined ||
      commandMetadata === undefined
    ) {
      return;
    }

    const enabled = !(nativeState.notificationPreference?.enabled ?? false);
    onSendHostCommand({
      schemaVersion: '1.0',
      messageType: 'desktop.shell.set-notification-preference.command',
      ...commandMetadata(),
      payload: {
        preference: {
          enabled,
          focusAssist: 'respect',
          categories: enabled
            ? [
                'recovery-required',
                'restart-deadline',
                'game-profile-restore-failed',
                'signed-update-action-required',
                'account-security',
              ]
            : [],
        },
      },
    });
  }, [commandMetadata, nativeState, onSendHostCommand]);

  const saveNativeWindowState = useCallback(() => {
    if (
      nativeState?.windowState === undefined ||
      onSendHostCommand === undefined ||
      commandMetadata === undefined
    ) {
      return;
    }

    onSendHostCommand({
      schemaVersion: '1.0',
      messageType: 'desktop.shell.save-window-state.command',
      ...commandMetadata(),
      payload: { state: nativeState.windowState },
    });
  }, [commandMetadata, nativeState?.windowState, onSendHostCommand]);

  const rememberOverlayInvoker = useCallback(() => {
    lastOverlayInvoker.current =
      typeof document === 'undefined' || !(document.activeElement instanceof HTMLElement)
        ? null
        : document.activeElement;
  }, []);

  const restoreOverlayFocus = useCallback(() => {
    const invoker = lastOverlayInvoker.current;
    deferFocus(() => invoker?.focus());
  }, []);

  useEffect(() => {
    if (viewportWidth !== undefined || typeof globalThis.addEventListener !== 'function') {
      return;
    }
    const onResize = () => {
      setMeasuredWidth(globalThis.innerWidth);
    };
    globalThis.addEventListener('resize', onResize);
    return () => {
      globalThis.removeEventListener('resize', onResize);
    };
  }, [viewportWidth]);

  useEffect(() => {
    if (typeof globalThis.addEventListener !== 'function') {
      return;
    }
    const onPopState = () => {
      const result = resolveDesktopRoute(globalThis.location.pathname);
      if (result.ok) {
        setRoute(result.value);
        setAnnouncement(result.value.definition.headingMessageId);
        focusHeading();
      }
    };
    globalThis.addEventListener('popstate', onPopState);
    return () => {
      globalThis.removeEventListener('popstate', onPopState);
    };
  }, [focusHeading]);

  useEffect(() => {
    if (typeof globalThis.addEventListener !== 'function') {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const targetIsTextEntry =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable);
      const result = navigatorRef.current?.handleKeyboard({
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        key: event.key,
        shiftKey: event.shiftKey,
        targetIsTextEntry,
      });
      if (!result?.handled) {
        return;
      }
      event.preventDefault();
      if (result.action === 'navigate') {
        const current = navigatorRef.current?.current();
        if (current !== undefined) {
          setRoute(current);
        }
      } else if (result.action === 'open-command-center') {
        rememberOverlayInvoker();
        setCommandOpen(true);
      } else if (result.action === 'toggle-inspector') {
        setInspectorOpen((current) => !current);
      } else if (result.action === 'open-shortcuts') {
        rememberOverlayInvoker();
        setShortcutsOpen(true);
      } else if (result.action === 'close-layer') {
        if (activityOpen || commandOpen || shortcutsOpen) {
          setActivityOpen(false);
          setCommandOpen(false);
          setShortcutsOpen(false);
          restoreOverlayFocus();
        } else {
          setInspectorOpen(false);
        }
      }
    };
    globalThis.addEventListener('keydown', onKeyDown);
    return () => {
      globalThis.removeEventListener('keydown', onKeyDown);
    };
  }, [activityOpen, commandOpen, rememberOverlayInvoker, restoreOverlayFocus, shortcutsOpen]);

  const goals = useMemo(
    () => [
      {
        id: 'home',
        label: preferences.locale === 'pt-BR' ? 'Visão geral' : 'Overview',
        onPress: () => {
          navigate('/home');
        },
      },
      {
        id: 'competitive',
        label: preferences.locale === 'pt-BR' ? 'Modo Competitivo' : 'Competitive Mode',
        onPress: () => {
          navigate('/competitive');
        },
      },
      {
        id: 'toggles',
        label: preferences.locale === 'pt-BR' ? 'Controles rápidos' : 'Quick Controls',
        onPress: () => {
          navigate('/toggles');
        },
      },
      {
        id: 'shortcuts',
        label: preferences.locale === 'pt-BR' ? 'Atalhos' : 'Shortcuts',
        onPress: () => {
          navigate('/shortcuts');
        },
      },
      {
        id: 'power',
        label: preferences.locale === 'pt-BR' ? 'Planos de energia' : 'Power Plans',
        onPress: () => {
          navigate('/power');
        },
      },
      {
        id: 'network',
        label: preferences.locale === 'pt-BR' ? 'Rede' : 'Network',
        onPress: () => {
          navigate('/network');
        },
      },
      {
        id: 'tweaks',
        label: 'Tweaks',
        onPress: () => {
          navigate('/tweaks');
        },
      },
      {
        id: 'security',
        label: preferences.locale === 'pt-BR' ? 'Segurança' : 'Security',
        onPress: () => {
          navigate('/security');
        },
      },
      {
        id: 'services',
        label: preferences.locale === 'pt-BR' ? 'Serviços' : 'Services',
        onPress: () => {
          navigate('/services');
        },
      },
      {
        id: 'restoration',
        label: preferences.locale === 'pt-BR' ? 'Restauração' : 'Restoration',
        onPress: () => {
          navigate('/restoration');
        },
      },
      {
        id: 'uninstaller',
        label: preferences.locale === 'pt-BR' ? 'Desinstalador' : 'Uninstaller',
        onPress: () => {
          navigate('/uninstaller');
        },
      },
      {
        id: 'downloads',
        label: 'Downloads',
        onPress: () => {
          navigate('/downloads');
        },
      },
    ],
    [navigate, preferences.locale],
  );

  const utilities = useMemo(
    () => [
      {
        id: 'settings',
        label: preferences.locale === 'pt-BR' ? 'Configurações' : 'Settings',
        onPress: () => {
          navigate('/settings/general');
        },
      },
      {
        id: 'about',
        label: preferences.locale === 'pt-BR' ? 'Sobre' : 'About',
        onPress: () => {
          navigate('/about');
        },
      },
    ],
    [navigate, preferences.locale],
  );

  const commandItems = useMemo(
    () =>
      [
        ...goals,
        ...utilities,
        {
          id: 'assistant',
          label: preferences.locale === 'pt-BR' ? 'Assistente' : 'Assistant',
          onPress: () => {
            navigate('/assistant');
          },
        },
        {
          id: 'account',
          label: preferences.locale === 'pt-BR' ? 'Conta' : 'Account',
          onPress: () => {
            navigate('/account/overview');
          },
        },
      ].map((item) => ({
        id: item.id,
        label: item.label,
        onAction: () => {
          item.onPress();
          setCommandOpen(false);
          restoreOverlayFocus();
        },
      })),
    [goals, navigate, preferences.locale, restoreOverlayFocus, utilities],
  );

  const layout = getResponsiveShellLayout(measuredWidth);
  const presentation = getOperationalPresentation(operationalState, locale);
  const criticalState = criticalStateFor(operationalState);
  const effectiveScale = appScale ?? preferences.interfaceScale;
  const motion = reducedMotion ?? preferences.motion === 'reduced';
  const routeActivityEvents = useMemo(
    () =>
      nativeState === undefined
        ? ACTIVITY_EVENTS
        : Object.freeze([...nativeState.activityEvents, ...ACTIVITY_EVENTS]),
    [nativeState],
  );
  const overlayActivityItems = useMemo(
    () =>
      nativeState === undefined
        ? activityOverlayItems
        : Object.freeze([...nativeState.activityItems, ...activityOverlayItems]),
    [nativeState],
  );

  if (route.pathname === '/login') {
    return (
      <div
        className="desktop-app-shell desktop-auth-root"
        data-app-scale={String(effectiveScale)}
        data-forced-colors={forcedColors ? 'active' : 'system'}
        data-motion={motion ? 'reduced' : 'responsive'}
        data-route-path={route.pathname}
        data-route-state={route.state}
        data-shell-width={layout.width}
        data-text-scale={String(textScale)}
        data-viewport-width={String(measuredWidth)}
      >
        <div className="desktop-title-region" data-focus-region="title-bar">
          <WindowTitleBar
            globalStatus={
              locale === 'pt-BR' ? 'Ambiente local protegido' : 'Protected local environment'
            }
            locale={locale}
          />
        </div>
        <span className="lb-visually-hidden">{`DEMO · ${scenarioId}`}</span>
        <AccountExperience
          locale={locale}
          navigate={navigate}
          scenarioId={scenarioId}
          view="login"
        />
      </div>
    );
  }

  return (
    <div
      className="desktop-app-shell"
      data-app-scale={String(effectiveScale)}
      data-forced-colors={forcedColors ? 'active' : 'system'}
      data-goal-rail-width={String(layout.railWidth)}
      data-inspector-mode={layout.inspectorMode}
      data-motion={motion ? 'reduced' : 'responsive'}
      data-operational-state={operationalState}
      data-page-horizontal-scroll={layout.pageHorizontalScroll}
      data-route-path={route.pathname}
      data-route-state={route.state}
      data-shell-width={layout.width}
      data-text-scale={String(textScale)}
      data-viewport-width={String(measuredWidth)}
    >
      <div
        className="desktop-title-region"
        data-focus-region="title-bar"
        ref={titleRegionRef}
        tabIndex={-1}
      >
        <WindowTitleBar
          accountLabel={locale === 'pt-BR' ? 'Liiiraa Player' : 'Liiiraa Player'}
          globalStatus={presentation.reason}
          locale={locale}
          onOpenAccount={() => {
            navigate('/account/overview');
          }}
          onOpenActivity={() => {
            rememberOverlayInvoker();
            setActivityOpen(true);
          }}
          onOpenCommand={() => {
            rememberOverlayInvoker();
            setCommandOpen(true);
          }}
          scenarioId={scenarioId}
        />
      </div>

      {criticalState === undefined ? null : (
        <CriticalStateRail detail={presentation.reason} state={criticalState} />
      )}

      <section
        aria-label={locale === 'pt-BR' ? 'Estado operacional atual' : 'Current operational state'}
        className="desktop-operational-state"
        data-lb-region
      >
        <StatusSignal detail={presentation.reason} locale={locale} state={operationalState} />
        {route.pathname === '/home' ? (
          <span>{presentation.action}</span>
        ) : (
          <LbButton
            onPress={() => {
              navigate(
                operationalState === 'recovery'
                  ? '/recover/emergency'
                  : '/documentation/local-operational-state',
              );
            }}
            variant="quiet"
          >
            {presentation.action}
          </LbButton>
        )}
      </section>

      <div className="desktop-shell-body">
        <div
          className="desktop-goal-region"
          data-focus-region="goal-rail"
          ref={goalRegionRef}
          tabIndex={-1}
        >
          <GoalRail
            activeId={activeGoalFor(route)}
            goals={goals}
            locale={locale}
            utilities={utilities}
          />
        </div>

        <div
          className="desktop-work-canvas"
          data-focus-region="main"
          ref={workCanvasRef}
          tabIndex={-1}
        >
          <DesktopRouteOutlet
            activityEvents={routeActivityEvents}
            locale={locale}
            navigate={navigate}
            route={route}
            scenarioId={scenarioId}
          />
        </div>

        <div
          className="desktop-inspector-region"
          data-focus-region="inspector"
          data-open={String(inspectorOpen)}
          ref={inspectorRegionRef}
          tabIndex={-1}
        >
          <ContextInspector
            title={locale === 'pt-BR' ? 'Contexto e evidências' : 'Context and evidence'}
          >
            <p>{presentation.reason}</p>
            <p>
              <strong>{`DEMO · ${scenarioId}`}</strong>
            </p>
            {nativeState === undefined ? null : (
              <>
                <p data-native-shell-diagnostic>
                  {nativeState.diagnostic === undefined
                    ? locale === 'pt-BR'
                      ? 'Ponte nativa validada e ativa.'
                      : 'Validated native bridge is active.'
                    : `${nativeState.diagnostic.code} · ${
                        nativeState.diagnostic.messageType ?? 'unknown-message'
                      }`}
                </p>
                <p data-native-notification-state>
                  {locale === 'pt-BR' ? 'Notificações do Windows' : 'Windows notifications'}
                  {': '}
                  {nativeState.notificationPreference?.enabled === true
                    ? locale === 'pt-BR'
                      ? 'ativadas'
                      : 'enabled'
                    : locale === 'pt-BR'
                      ? 'desativadas'
                      : 'disabled'}
                </p>
                <LbButton onPress={sendNotificationPreference} variant="secondary">
                  {locale === 'pt-BR'
                    ? 'Alterar notificações do Windows'
                    : 'Change Windows notifications'}
                </LbButton>
                {nativeState.windowState === undefined ? null : (
                  <>
                    <p data-native-window-state>{nativeState.windowState.kind}</p>
                    <LbButton onPress={saveNativeWindowState} variant="secondary">
                      {locale === 'pt-BR' ? 'Salvar estado desta janela' : 'Save this window state'}
                    </LbButton>
                  </>
                )}
              </>
            )}
            <LbButton
              onPress={() => {
                setInspectorOpen(false);
              }}
              variant="quiet"
            >
              {formatMessage(preferences.locale, 'action.close')}
            </LbButton>
          </ContextInspector>
        </div>
      </div>

      <div aria-atomic="true" aria-live="polite" className="lb-visually-hidden">
        {announcement}
      </div>
      <div aria-atomic="true" aria-live="assertive" className="lb-visually-hidden">
        {criticalState === undefined ? '' : presentation.reason}
      </div>

      {activityOpen ? (
        <NotificationCenter
          items={overlayActivityItems}
          locale={locale}
          onClose={() => {
            setActivityOpen(false);
            restoreOverlayFocus();
          }}
          onOpenActivity={() => {
            navigate('/activity');
          }}
        />
      ) : null}

      <LbDialog
        description={
          locale === 'pt-BR'
            ? 'Pesquise rotas locais e abra somente ações seguras.'
            : 'Search local routes and open safe actions only.'
        }
        isOpen={commandOpen}
        onOpenChange={(open) => {
          setCommandOpen(open);
          if (!open) {
            restoreOverlayFocus();
          }
        }}
        title={formatMessage(preferences.locale, 'navigation.commandCenter')}
        trigger={
          <button className="lb-visually-hidden" tabIndex={-1} type="button">
            {formatMessage(preferences.locale, 'navigation.commandCenter')}
          </button>
        }
      >
        <LbSearchField
          autoFocus
          label={locale === 'pt-BR' ? 'Pesquisar comandos' : 'Search commands'}
        />
        <ul className="desktop-command-list">
          {commandItems.map((item) => (
            <li key={item.id}>
              <LbButton onPress={item.onAction}>{item.label}</LbButton>
            </li>
          ))}
        </ul>
      </LbDialog>

      <LbDialog
        description={
          locale === 'pt-BR'
            ? 'Atalhos não executam alterações no sistema.'
            : 'Shortcuts never execute system changes.'
        }
        isOpen={shortcutsOpen}
        onOpenChange={(open) => {
          setShortcutsOpen(open);
          if (!open) {
            restoreOverlayFocus();
          }
        }}
        title={locale === 'pt-BR' ? 'Atalhos de teclado' : 'Keyboard shortcuts'}
        trigger={
          <button className="lb-visually-hidden" tabIndex={-1} type="button">
            {locale === 'pt-BR' ? 'Abrir atalhos' : 'Open shortcuts'}
          </button>
        }
      >
        <dl className="desktop-shortcuts">
          <div>
            <dt>Ctrl+K</dt>
            <dd>{formatMessage(preferences.locale, 'navigation.commandCenter')}</dd>
          </div>
          <div>
            <dt>F6</dt>
            <dd>
              {locale === 'pt-BR' ? 'Alternar regiões do aplicativo' : 'Cycle application regions'}
            </dd>
          </div>
          <div>
            <dt>Ctrl+1…6</dt>
            <dd>{locale === 'pt-BR' ? 'Abrir objetivos principais' : 'Open primary goals'}</dd>
          </div>
        </dl>
      </LbDialog>
    </div>
  );
};

interface NativeShellPresentationProps {
  readonly appProps: DesktopAppContentProps;
  readonly commandMetadata: () => HostCommandMetadata;
  readonly nativeState: NativeShellState;
  readonly onAcceptInstaller: () => void;
  readonly onAcknowledgeStartup: (pathname?: string) => void;
  readonly onResolveClose: (resolution: ShellCloseResolutionJson) => void;
  readonly onSendHostCommand: (command: RendererToHostShellCommandJson) => void;
}

const NativeShellPresentation = ({
  appProps,
  commandMetadata,
  nativeState,
  onAcceptInstaller,
  onAcknowledgeStartup,
  onResolveClose,
  onSendHostCommand,
}: NativeShellPresentationProps): ReactNode => {
  const { preferences } = useDesktopPreferences();
  const locale = detectLocale(preferences.locale);
  const version = nativeState.installerIdentity?.version ?? 'development';
  const [startupStepIndex, setStartupStepIndex] = useState(0);
  const [startupPresentationComplete, setStartupPresentationComplete] = useState(false);

  useEffect(() => {
    const stepDuration = preferences.motion === 'reduced' ? 45 : 190;
    const timers = STARTUP_PRESENTATION_STEPS.slice(1).map((_step, index) =>
      globalThis.setTimeout(
        () => {
          setStartupStepIndex(index + 1);
        },
        stepDuration * (index + 1),
      ),
    );
    timers.push(
      globalThis.setTimeout(
        () => {
          setStartupPresentationComplete(true);
        },
        stepDuration * STARTUP_PRESENTATION_STEPS.length +
          (preferences.motion === 'reduced' ? 20 : 140),
      ),
    );
    return () => {
      for (const timer of timers) globalThis.clearTimeout(timer);
    };
  }, [preferences.motion]);

  let content: ReactNode;
  const startupRequiresAttention =
    nativeState.startupState.kind === 'failure' || nativeState.startupState.kind === 'updating';
  const startupStillRunning =
    nativeState.startupState.kind !== 'ready' ||
    nativeState.installerIdentity === undefined ||
    !startupPresentationComplete;
  const presentedStartupState: ShellStartupStateJson = startupRequiresAttention
    ? nativeState.startupState
    : startupPresentationComplete
      ? nativeState.startupState
      : {
          kind: 'splash',
          step: STARTUP_PRESENTATION_STEPS[startupStepIndex] ?? 'opening-shell',
        };

  if (startupStillRunning || startupRequiresAttention) {
    content = (
      <StartupSurface
        firstLaunch={!nativeState.startupAcknowledged}
        locale={locale}
        state={presentedStartupState}
        version={version}
      />
    );
  } else if (!nativeState.installerAccepted) {
    content = (
      <PremiumInstallerHandoff
        identity={nativeState.installerIdentity}
        locale={locale}
        onContinue={onAcceptInstaller}
      />
    );
  } else if (!nativeState.startupAcknowledged) {
    content = (
      <StartupSurface
        firstLaunch
        locale={locale}
        onContinue={() => {
          onAcknowledgeStartup();
        }}
        onOpenDocumentation={() => {
          onAcknowledgeStartup('/documentation/local-startup');
        }}
        onOpenSupport={() => {
          onAcknowledgeStartup('/documentation/local-support');
        }}
        onRecoveryAction={(action) => {
          if (action === 'exit') {
            onResolveClose({
              context: 'ordinary',
              decision: 'close-interface',
            });
            return;
          }

          onAcknowledgeStartup(
            action === 'open-safe-mode' || action === 'rollback'
              ? '/recover/emergency'
              : '/documentation/local-startup',
          );
        }}
        state={nativeState.startupState}
        version={version}
      />
    );
  } else {
    content = (
      <DesktopAppContent
        {...appProps}
        commandMetadata={commandMetadata}
        nativeState={nativeState}
        onSendHostCommand={onSendHostCommand}
      />
    );
  }

  const closeContext = nativeState.closeContext;
  return (
    <>
      {content}
      <LbAlertDialog
        description={
          closeContext?.kind === 'recovery-in-progress'
            ? locale === 'pt-BR'
              ? 'Uma recuperação está em andamento. A interface deve permanecer disponível.'
              : 'Recovery is in progress. The interface must remain available.'
            : locale === 'pt-BR'
              ? 'Escolha entre encerrar a interface ou manter a detecção no tray.'
              : 'Choose whether to close the interface or keep detection in the tray.'
        }
        isOpen={closeContext !== undefined}
        title={locale === 'pt-BR' ? 'Confirmar fechamento' : 'Confirm close'}
        trigger={
          <button className="lb-visually-hidden" tabIndex={-1} type="button">
            {locale === 'pt-BR' ? 'Abrir confirmação de fechamento' : 'Open close confirmation'}
          </button>
        }
      >
        {closeContext?.kind === 'recovery-in-progress' ? (
          <>
            <LbButton
              onPress={() => {
                onResolveClose({
                  context: 'recovery-in-progress',
                  decision: 'stay-here',
                });
              }}
              variant="primary"
            >
              {locale === 'pt-BR' ? 'Permanecer aqui' : 'Stay here'}
            </LbButton>
            <LbButton
              onPress={() => {
                onResolveClose({
                  context: 'recovery-in-progress',
                  decision: 'keep-running-in-tray',
                });
              }}
              variant="secondary"
            >
              {locale === 'pt-BR' ? 'Manter no tray' : 'Keep running in tray'}
            </LbButton>
          </>
        ) : (
          <>
            <LbButton
              onPress={() => {
                onResolveClose({
                  context: 'ordinary',
                  decision: 'close-interface',
                });
              }}
              variant="primary"
            >
              {locale === 'pt-BR' ? 'Encerrar interface' : 'Close interface'}
            </LbButton>
            <LbButton
              onPress={() => {
                onResolveClose({
                  context: 'ordinary',
                  decision: 'keep-running-in-tray',
                });
              }}
              variant="secondary"
            >
              {locale === 'pt-BR' ? 'Manter detecção no tray' : 'Keep detection in tray'}
            </LbButton>
          </>
        )}
      </LbAlertDialog>
    </>
  );
};

type NativeDesktopAppProps = Omit<
  DesktopAppProps,
  'nativeBridgeTransport' | 'nativeCommandMetadata' | 'nativeShell'
> &
  Readonly<{
    nativeBridgeTransport?: ShellBridgeTransport;
    nativeCommandMetadata?: () => HostCommandMetadata;
  }>;

const NativeDesktopApp = ({
  nativeBridgeTransport,
  nativeCommandMetadata,
  windowsLocale,
  ...appProps
}: NativeDesktopAppProps): ReactNode => {
  const [nativeState, setNativeState] = useState(() => createInitialNativeShellState(true));
  const bridgeRef = useRef<ShellBridge | null>(null);
  const commandMetadata = useMemo(
    () => nativeCommandMetadata ?? createHostCommandMetadataFactory(),
    [nativeCommandMetadata],
  );

  const sendHostCommand = useCallback((command: RendererToHostShellCommandJson): void => {
    void bridgeRef.current?.send(command);
  }, []);

  useEffect(() => {
    const bridge = createNativeShellComposition({
      callbacks: {
        onCloseRequest: (closeContext) => {
          setNativeState((current) => Object.freeze({ ...current, closeContext }));
        },
        onDiagnostic: (diagnostic) => {
          setNativeState((current) => Object.freeze({ ...current, diagnostic }));
        },
        onEvent: (event) => {
          setNativeState((current) => {
            const activityEvent = nativeActivityFor(event);
            const overlayItem = nativeOverlayItemFor(event);
            return Object.freeze({
              ...current,
              activityEvents: Object.freeze(
                [activityEvent, ...current.activityEvents].slice(0, 32),
              ),
              activityItems:
                overlayItem === undefined
                  ? current.activityItems
                  : Object.freeze([overlayItem, ...current.activityItems].slice(0, 16)),
            });
          });
        },
        onHostPreference: (hostPreferenceEvent) => {
          setNativeState((current) => Object.freeze({ ...current, hostPreferenceEvent }));
        },
        onInstallerIdentity: (installerIdentity) => {
          setNativeState((current) =>
            Object.freeze({
              ...current,
              installerIdentity,
            }),
          );
        },
        onNavigation: (pathname, requestId) => {
          setNativeState((current) =>
            Object.freeze({
              ...current,
              navigation: Object.freeze({ pathname, requestId }),
            }),
          );
        },
        onNotificationPreference: (notificationPreference) => {
          setNativeState((current) => Object.freeze({ ...current, notificationPreference }));
        },
        onStartupState: (startupState) => {
          setNativeState((current) =>
            Object.freeze({
              ...current,
              startupState,
            }),
          );
        },
        onWindowState: (windowState) => {
          setNativeState((current) => Object.freeze({ ...current, windowState }));
        },
      },
      ...(nativeBridgeTransport === undefined ? {} : { transport: nativeBridgeTransport }),
    });

    bridgeRef.current = bridge;
    void bridge.start();
    return () => {
      void bridge.dispose();
      if (bridgeRef.current === bridge) {
        bridgeRef.current = null;
      }
    };
  }, [nativeBridgeTransport]);

  const resolveClose = useCallback(
    (resolution: ShellCloseResolutionJson): void => {
      sendHostCommand({
        schemaVersion: '1.0',
        messageType: 'desktop.shell.resolve-close.command',
        ...commandMetadata(),
        payload: { resolution },
      });
      setNativeState((current) => {
        const updated = { ...current };
        delete updated.closeContext;
        return Object.freeze(updated);
      });
    },
    [commandMetadata, sendHostCommand],
  );

  const acknowledgeStartup = useCallback((pathname?: string): void => {
    setNativeState((current) => {
      const next = Object.freeze({
        ...current,
        startupAcknowledged: true,
        ...(pathname === undefined
          ? {}
          : {
              navigation: Object.freeze({
                pathname,
                requestId: `local-startup-${pathname}`,
              }),
            }),
      });
      persistDesktopFirstRunState({
        installerAccepted: next.installerAccepted,
        startupAcknowledged: true,
      });
      return next;
    });
  }, []);

  return (
    <DesktopPreferencesProvider
      commandMetadata={commandMetadata}
      sendHostCommand={sendHostCommand}
      {...(nativeState.hostPreferenceEvent === undefined
        ? {}
        : { hostPreferenceEvent: nativeState.hostPreferenceEvent })}
      {...(windowsLocale === undefined ? {} : { windowsLocale })}
    >
      <NativeShellPresentation
        appProps={appProps}
        commandMetadata={commandMetadata}
        nativeState={nativeState}
        onAcceptInstaller={() => {
          setNativeState((current) => {
            const next = Object.freeze({
              ...current,
              installerAccepted: true,
              startupAcknowledged: true,
            });
            persistDesktopFirstRunState({
              installerAccepted: true,
              startupAcknowledged: true,
            });
            return next;
          });
        }}
        onAcknowledgeStartup={acknowledgeStartup}
        onResolveClose={resolveClose}
        onSendHostCommand={sendHostCommand}
      />
    </DesktopPreferencesProvider>
  );
};

export const DesktopApp = ({
  nativeBridgeTransport,
  nativeCommandMetadata,
  nativeShell,
  windowsLocale,
  ...props
}: DesktopAppProps): ReactNode => {
  const useNativeShell = nativeShell ?? Reflect.has(globalThis, '__TAURI_INTERNALS__');

  if (useNativeShell) {
    return (
      <NativeDesktopApp
        {...props}
        {...(nativeBridgeTransport === undefined ? {} : { nativeBridgeTransport })}
        {...(nativeCommandMetadata === undefined ? {} : { nativeCommandMetadata })}
        {...(windowsLocale === undefined ? {} : { windowsLocale })}
      />
    );
  }

  return (
    <DesktopPreferencesProvider {...(windowsLocale === undefined ? {} : { windowsLocale })}>
      <DesktopAppContent {...props} />
    </DesktopPreferencesProvider>
  );
};
