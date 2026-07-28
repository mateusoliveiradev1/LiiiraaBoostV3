import {
  AccountSurface,
  ActivitySurface,
  AssistantSurface,
  CalibrationWorkspace,
  ContextualHome,
  DocumentationSurface,
  EntitlementSurface,
  ImproveSurface,
  MeasureSurface,
  PrepareSurface,
  PreviewWorkflowSurface,
  RecoverSurface,
  SettingsSurface,
  UpdateSurface,
} from '@liiiraa/feature-shell';
import type { HomeCalibrationState, HomeClaim, ShellLocale } from '@liiiraa/feature-shell';
import {
  ActivityCenter,
  ContextInspector,
  CriticalStateRail,
  GoalRail,
  LbButton,
  LbDialog,
  LbSearchField,
  RouteHeader,
  StatusSignal,
  WindowTitleBar,
} from '@liiiraa/design-system';
import type { OperationalState } from '@liiiraa/design-system';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { formatMessage } from './locales/i18n.js';
import { DesktopPreferencesProvider, useDesktopPreferences } from './preferences.js';
import { createDesktopNavigator, resolveDesktopRoute } from './routes.js';
import type { DesktopF6Region, DesktopNavigator, DesktopRouteMatch } from './routes.js';

type ShellOperationalState = OperationalState;
type ShellWidth = 'wide' | 'standard' | 'compact' | 'minimum';

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

const HOME_CLAIMS: readonly HomeClaim[] = Object.freeze([
  Object.freeze({
    capturedAt: '2030-01-15T18:00:00.000Z',
    detail: 'Synthetic compatibility evidence is current for scenario S01.',
    freshness: 'current',
    id: 'S01-compatibility',
    label: 'Scenario compatibility',
    source: 'fixture-policy',
    state: 'fixture',
  }),
]);

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

const shellWidthFor = (viewportWidth: number): ShellWidth => {
  if (viewportWidth >= 1440) {
    return 'wide';
  }
  if (viewportWidth >= 1180) {
    return 'standard';
  }
  if (viewportWidth >= 960) {
    return 'compact';
  }
  return 'minimum';
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
    sessions: 'session-history',
    compare: 'matched-comparison',
    reports: 'report-preview',
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

interface StandaloneSectionProps {
  readonly children: ReactNode;
  readonly locale: ShellLocale;
  readonly purpose: Readonly<Record<ShellLocale, string>>;
  readonly title: Readonly<Record<ShellLocale, string>>;
}

const StandaloneSection = ({ children, locale, purpose, title }: StandaloneSectionProps) => (
  <main>
    <RouteHeader purpose={purpose[locale]} title={title[locale]} />
    {children}
  </main>
);

export interface DesktopRouteOutletProps {
  readonly locale: ShellLocale;
  readonly navigate: (pathname: string) => void;
  readonly route: DesktopRouteMatch;
  readonly scenarioId: string;
}

export const DesktopRouteOutlet = ({
  locale,
  navigate,
  route,
  scenarioId,
}: DesktopRouteOutletProps): ReactNode => {
  switch (route.definition.surface) {
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
          claims={HOME_CLAIMS}
          locale={locale}
          scenarioId={scenarioId}
          variant="ready"
        />
      );
    case 'PrepareSurface':
      return (
        <PrepareSurface
          locale={locale}
          scenarioId={scenarioId}
          view={prepareViewFor(route.state)}
        />
      );
    case 'ImproveSurface':
      return (
        <ImproveSurface
          locale={locale}
          scenarioId={scenarioId}
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
          events={ACTIVITY_EVENTS}
          locale={locale}
          onNavigate={navigate}
          scenarioId={scenarioId}
        />
      );
    case 'AccountSettingsSurface':
      if (route.state === 'subscription') {
        return (
          <StandaloneSection
            locale={locale}
            purpose={{
              en: 'Review retained access, offline windows, and subscription state.',
              'pt-BR': 'Revise o acesso mantido, janelas offline e o estado da assinatura.',
            }}
            title={{ en: 'Subscription', 'pt-BR': 'Assinatura' }}
          >
            <EntitlementSurface locale={locale} scenarioId={scenarioId} state="offline-window" />
          </StandaloneSection>
        );
      }
      if (route.state === 'general' || route.pathname.startsWith('/settings/')) {
        if (route.state === 'updates') {
          return (
            <StandaloneSection
              locale={locale}
              purpose={{
                en: 'Verify signed update status without weakening the current version.',
                'pt-BR':
                  'Verifique o estado de atualizações assinadas sem enfraquecer a versão atual.',
              }}
              title={{ en: 'Updates', 'pt-BR': 'Atualizações' }}
            >
              <UpdateSurface locale={locale} scenarioId={scenarioId} state="current" />
            </StandaloneSection>
          );
        }
        return <SettingsSurface locale={locale} scenarioId={scenarioId} />;
      }
      return (
        <AccountSurface
          locale={locale}
          scenarioId={scenarioId}
          state={route.state === 'security' ? 'session-expired' : 'signed-out'}
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

export interface DesktopAppProps {
  readonly appScale?: 100 | 125 | 150;
  readonly forcedColors?: boolean;
  readonly initialPath?: string;
  readonly operationalState?: ShellOperationalState;
  readonly reducedMotion?: boolean;
  readonly scenarioId?: string;
  readonly textScale?: 100 | 200;
  readonly viewportWidth?: number;
}

const DesktopAppContent = ({
  appScale,
  forcedColors = false,
  initialPath = '/calibration/welcome',
  operationalState = 'fixture',
  reducedMotion,
  scenarioId = 'S01',
  textScale = 100,
  viewportWidth,
}: DesktopAppProps) => {
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

  const focusHeading = useCallback(() => {
    deferFocus(() => {
      workCanvasRef.current?.querySelector<HTMLElement>('h1')?.focus();
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
        main:
          workCanvasRef.current?.querySelector<HTMLElement>('main,[role="main"]') ??
          workCanvasRef.current,
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
        label: formatMessage(preferences.locale, 'navigation.home'),
        onPress: () => {
          navigate('/home');
        },
      },
      {
        id: 'prepare',
        label: formatMessage(preferences.locale, 'navigation.prepare'),
        onPress: () => {
          navigate('/prepare');
        },
      },
      {
        id: 'improve',
        label: formatMessage(preferences.locale, 'navigation.improve'),
        onPress: () => {
          navigate('/improve');
        },
      },
      {
        id: 'measure',
        label: formatMessage(preferences.locale, 'navigation.measure'),
        onPress: () => {
          navigate('/measure/overview');
        },
      },
      {
        id: 'recover',
        label: formatMessage(preferences.locale, 'navigation.recover'),
        onPress: () => {
          navigate('/recover/overview');
        },
      },
      {
        id: 'assistant',
        label: formatMessage(preferences.locale, 'navigation.assistant'),
        onPress: () => {
          navigate('/assistant');
        },
      },
    ],
    [navigate, preferences.locale],
  );

  const utilities = useMemo(
    () => [
      {
        id: 'account',
        label: formatMessage(preferences.locale, 'navigation.account'),
        onPress: () => {
          navigate('/account/overview');
        },
      },
      {
        id: 'settings',
        label: formatMessage(preferences.locale, 'navigation.settings'),
        onPress: () => {
          navigate('/settings/general');
        },
      },
    ],
    [navigate, preferences.locale],
  );

  const commandItems = useMemo(
    () =>
      [...goals, ...utilities].map((item) => ({
        id: item.id,
        label: item.label,
        onAction: () => {
          item.onPress();
          setCommandOpen(false);
          restoreOverlayFocus();
        },
      })),
    [goals, restoreOverlayFocus, utilities],
  );

  const shellWidth = shellWidthFor(measuredWidth);
  const presentation = OPERATIONAL_PRESENTATIONS[operationalState];
  const criticalState = criticalStateFor(operationalState);
  const effectiveScale = appScale ?? preferences.interfaceScale;
  const motion = reducedMotion ?? preferences.motion === 'reduced';

  return (
    <div
      className="desktop-app-shell"
      data-app-scale={String(effectiveScale)}
      data-forced-colors={forcedColors ? 'active' : 'system'}
      data-motion={motion ? 'reduced' : 'responsive'}
      data-operational-state={operationalState}
      data-shell-width={shellWidth}
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
          globalStatus={presentation.reason[locale]}
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
        <CriticalStateRail detail={presentation.reason[locale]} state={criticalState} />
      )}

      <section
        aria-label={locale === 'pt-BR' ? 'Estado operacional atual' : 'Current operational state'}
        className="desktop-operational-state"
        data-lb-region
      >
        <StatusSignal detail={presentation.reason[locale]} state={operationalState} />
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
          {presentation.action[locale]}
        </LbButton>
      </section>

      <div className="desktop-shell-body">
        <div
          className="desktop-goal-region"
          data-focus-region="goal-rail"
          ref={goalRegionRef}
          tabIndex={-1}
        >
          <GoalRail activeId={activeGoalFor(route)} goals={goals} utilities={utilities} />
        </div>

        <div
          className="desktop-work-canvas"
          data-focus-region="main"
          ref={workCanvasRef}
          tabIndex={-1}
        >
          <DesktopRouteOutlet
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
            <p>{presentation.reason[locale]}</p>
            <p>
              <strong>{`DEMO · ${scenarioId}`}</strong>
            </p>
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
        {criticalState === undefined ? '' : presentation.reason[locale]}
      </div>

      {activityOpen ? (
        <aside
          aria-label={formatMessage(preferences.locale, 'navigation.activity')}
          className="desktop-activity-overlay"
          data-lb-region
        >
          <ActivityCenter items={activityOverlayItems} />
          <LbButton
            onPress={() => {
              setActivityOpen(false);
              restoreOverlayFocus();
            }}
            variant="quiet"
          >
            {formatMessage(preferences.locale, 'action.close')}
          </LbButton>
        </aside>
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
        <LbSearchField label={locale === 'pt-BR' ? 'Pesquisar comandos' : 'Search commands'} />
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

export const DesktopApp = (props: DesktopAppProps) => (
  <DesktopPreferencesProvider>
    <DesktopAppContent {...props} />
  </DesktopPreferencesProvider>
);
