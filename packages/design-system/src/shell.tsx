import {
  Activity,
  Bell,
  Maximize2,
  Minimize2,
  PanelRight,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Button, Toolbar } from 'react-aria-components';

import { LbButton, LbDialog, LbIconButton, LbSearchField, LbTextField } from './primitives.js';
import { QualityMark, RiskClass, ScenarioMarker, StatusSignal } from './evidence.js';
import type { EvidenceLocale, OperationalState, RiskLevel } from './evidence.js';
import { ProductIcon } from './product-icons.js';
import type { ProductIconName } from './product-icons.js';

export interface WindowControlHandlers {
  readonly close?: () => void;
  readonly maximizeRestore?: () => void;
  readonly minimize?: () => void;
}

export interface WindowTitleBarProps {
  readonly accountLabel?: string;
  readonly controls?: WindowControlHandlers;
  readonly globalStatus: string;
  readonly locale?: EvidenceLocale;
  readonly onOpenAccount?: () => void;
  readonly onOpenActivity?: () => void;
  readonly onOpenCommand?: () => void;
  readonly productName?: string;
  readonly scenarioId?: string;
}

export const WindowTitleBar = ({
  accountLabel,
  controls,
  globalStatus,
  locale = 'en',
  onOpenAccount,
  onOpenActivity,
  onOpenCommand,
  productName = 'Liiiraa Boost',
  scenarioId,
}: WindowTitleBarProps) => (
  <header
    aria-label={locale === 'pt-BR' ? 'Barra de título do aplicativo' : 'Application title bar'}
    className="lb-title-bar"
    data-lb-region
  >
    <strong className="lb-product-brand">
      <svg aria-hidden="true" className="lb-product-mark" viewBox="0 0 36 28">
        <path
          className="lb-product-mark-primary"
          d="M2 25.5 10.6 2h7.2l-5.7 15.2h9.2l-7.1 8.3H2Z"
        />
        <path
          className="lb-product-mark-accent"
          d="m20.7 7.2 10.3 7-10.3 7 3-3.7 4.8-3.3-4.8-3.3-3-3.7Z"
        />
      </svg>
      <span className="lb-visually-hidden">{productName}</span>
      <span aria-hidden="true" className="lb-product-wordmark">
        <span>Liiiraa</span>
        <span>Boost</span>
      </span>
    </strong>
    {scenarioId ? <ScenarioMarker scenarioId={scenarioId} /> : null}
    <span className="lb-global-status">{globalStatus}</span>
    <div className="lb-title-actions">
      {onOpenCommand ? (
        <LbIconButton
          icon={<Search />}
          label={locale === 'pt-BR' ? 'Abrir central de comandos' : 'Open command center'}
          onPress={onOpenCommand}
        />
      ) : null}
      {onOpenActivity ? (
        <LbIconButton
          icon={<Bell />}
          label={locale === 'pt-BR' ? 'Abrir atividade' : 'Open activity'}
          onPress={onOpenActivity}
        />
      ) : null}

      {onOpenAccount ? (
        <Button
          aria-label={locale === 'pt-BR' ? 'Abrir perfil e conta' : 'Open profile and account'}
          className="lb-account-trigger"
          data-lb-control
          onPress={onOpenAccount}
        >
          <span aria-hidden="true" className="lb-account-avatar">
            LP
          </span>
          <span className="lb-account-trigger-copy">
            <strong>{accountLabel ?? (locale === 'pt-BR' ? 'Meu perfil' : 'My profile')}</strong>
            <small>Premium</small>
          </span>
        </Button>
      ) : null}
    </div>
    {controls ? (
      <div
        aria-label={locale === 'pt-BR' ? 'Controles da janela' : 'Window controls'}
        className="lb-window-controls"
        role="group"
      >
        {controls.minimize ? (
          <LbIconButton
            icon={<Minimize2 />}
            label={locale === 'pt-BR' ? 'Minimizar janela' : 'Minimize window'}
            onPress={controls.minimize}
          />
        ) : null}
        {controls.maximizeRestore ? (
          <LbIconButton
            icon={<Maximize2 />}
            label={
              locale === 'pt-BR' ? 'Maximizar ou restaurar janela' : 'Maximize or restore window'
            }
            onPress={controls.maximizeRestore}
          />
        ) : null}
        {controls.close ? (
          <LbIconButton
            icon={<X />}
            label={locale === 'pt-BR' ? 'Fechar janela' : 'Close window'}
            onPress={controls.close}
          />
        ) : null}
      </div>
    ) : null}
  </header>
);

export interface GoalRailItem {
  readonly id: string;
  readonly label: string;
  readonly onPress: () => void;
}

export interface GoalRailProps {
  readonly activeId: string;
  readonly goals: readonly GoalRailItem[];
  readonly locale?: EvidenceLocale;
  readonly utilities?: readonly GoalRailItem[];
}

const GOAL_ICONS: Readonly<Record<string, ProductIconName>> = Object.freeze({
  about: 'info',
  account: 'profile',
  assistant: 'sparkle',
  competitive: 'competitive',
  downloads: 'download',
  home: 'gauge',
  improve: 'zap',
  measure: 'activity',
  network: 'wifi',
  power: 'power',
  prepare: 'game',
  recover: 'recovery',
  restoration: 'recovery',
  security: 'shield',
  services: 'services',
  settings: 'settings',
  shortcuts: 'toolbox',
  toggles: 'toggles',
  tweaks: 'sliders',
  uninstaller: 'trash',
});

const GoalButtons = ({
  activeId,
  items,
}: {
  readonly activeId: string;
  readonly items: readonly GoalRailItem[];
}) => (
  <>
    {items.map((item) => {
      const icon = GOAL_ICONS[item.id];
      return (
        <Button
          aria-label={item.label}
          className="lb-goal"
          data-lb-control
          key={item.id}
          onPress={item.onPress}
          {...(item.id === activeId ? { 'aria-current': 'page' as const } : {})}
        >
          {icon === undefined ? null : (
            <ProductIcon className="lb-goal-icon" name={icon} size={20} weight="duotone" />
          )}
          <span className="lb-goal-label">{item.label}</span>
        </Button>
      );
    })}
  </>
);

export const GoalRail = ({ activeId, goals, locale = 'en', utilities = [] }: GoalRailProps) => (
  <nav
    aria-label={locale === 'pt-BR' ? 'Objetivos principais' : 'Primary goals'}
    className="lb-goal-rail"
    data-lb-region
  >
    <Toolbar
      aria-label={locale === 'pt-BR' ? 'Objetivos do produto' : 'Product goals'}
      orientation="vertical"
    >
      <GoalButtons activeId={activeId} items={goals} />
    </Toolbar>
    {utilities.length > 0 ? (
      <Toolbar
        aria-label={locale === 'pt-BR' ? 'Conta e configurações' : 'Account and settings'}
        className="lb-goal-utilities"
        orientation="vertical"
      >
        <GoalButtons activeId={activeId} items={utilities} />
        <p className="lb-goal-safety">
          <ShieldCheck aria-hidden="true" />
          <span>{locale === 'pt-BR' ? 'Sistema protegido' : 'System protected'}</span>
        </p>
      </Toolbar>
    ) : null}
  </nav>
);

export interface BreadcrumbItem {
  readonly label: string;
  readonly onPress?: () => void;
}

export interface BreadcrumbsProps {
  readonly items: readonly BreadcrumbItem[];
}

export const Breadcrumbs = ({ items }: BreadcrumbsProps) => (
  <nav aria-label="Breadcrumb">
    <ol className="lb-breadcrumbs">
      {items.map((item, index) => {
        const isCurrent = index === items.length - 1;
        return (
          <li key={`${String(index)}:${item.label}`}>
            {isCurrent || !item.onPress ? (
              <span aria-current={isCurrent ? 'page' : undefined}>{item.label}</span>
            ) : (
              <Button className="lb-link" onPress={item.onPress}>
                {item.label}
              </Button>
            )}
          </li>
        );
      })}
    </ol>
  </nav>
);

export interface RouteHeaderProps {
  readonly actions?: ReactNode;
  readonly breadcrumbs?: readonly BreadcrumbItem[];
  readonly purpose: string;
  readonly title: string;
}

export const RouteHeader = ({ actions, breadcrumbs, purpose, title }: RouteHeaderProps) => (
  <header className="lb-route-header">
    {breadcrumbs ? <Breadcrumbs items={breadcrumbs} /> : null}
    <div>
      <h1 tabIndex={-1}>{title}</h1>
      <p>{purpose}</p>
    </div>
    {actions ? <div className="lb-route-actions">{actions}</div> : null}
  </header>
);

export interface CriticalStateRailProps {
  readonly detail: string;
  readonly state:
    'recovery' | 'unsupported' | 'restart-pending' | 'permission' | 'contradictory-evidence';
}

export const CriticalStateRail = ({ detail, state }: CriticalStateRailProps) => (
  <aside aria-label="Critical application state" className="lb-critical-state-rail">
    <StatusSignal detail={detail} state={state} />
  </aside>
);

export interface CommandItem {
  readonly id: string;
  readonly label: string;
  readonly onAction: () => void;
  readonly shortcut?: string;
}

export interface CommandCenterProps {
  readonly commands: readonly CommandItem[];
  readonly trigger?: ReactNode;
}

export const CommandCenter = ({
  commands,
  trigger = <LbButton variant="quiet">Open command center</LbButton>,
}: CommandCenterProps) => (
  <LbDialog
    description="Search local routes and safe actions."
    title="Command center"
    trigger={trigger}
  >
    <LbSearchField label="Search commands" placeholder="Type a route or action" />
    <ul className="lb-command-list">
      {commands.map((command) => (
        <li key={command.id}>
          <Button className="lb-command" data-lb-control onPress={command.onAction}>
            <span>{command.label}</span>
            {command.shortcut ? <kbd>{command.shortcut}</kbd> : null}
          </Button>
        </li>
      ))}
    </ul>
  </LbDialog>
);

export interface ContextInspectorProps {
  readonly children: ReactNode;
  readonly title: string;
}

export const ContextInspector = ({ children, title }: ContextInspectorProps) => (
  <aside aria-label={title} className="lb-context-inspector" data-lb-region>
    <header>
      <PanelRight aria-hidden="true" size={18} strokeWidth={1.75} />
      <h2>{title}</h2>
    </header>
    {children}
  </aside>
);

export interface ActivityItem {
  readonly detail: string;
  readonly id: string;
  readonly state: OperationalState;
  readonly title: string;
}

export interface ActivityCenterProps {
  readonly items: readonly ActivityItem[];
}

export const ActivityCenter = ({ items }: ActivityCenterProps) => (
  <section aria-labelledby="lb-activity-title" className="lb-activity-center" data-lb-region>
    <header>
      <Activity aria-hidden="true" size={18} strokeWidth={1.75} />
      <h2 id="lb-activity-title">Activity</h2>
    </header>
    {items.length === 0 ? (
      <StatusSignal detail="No activity requires attention." state="empty" />
    ) : (
      <ol>
        {items.map((item) => (
          <li key={item.id}>
            <strong>{item.title}</strong>
            <StatusSignal detail={item.detail} state={item.state} />
          </li>
        ))}
      </ol>
    )}
  </section>
);

export interface TrayStateInput {
  readonly activityRequiringAttention: number;
  readonly automaticProfilesPaused: boolean;
  readonly currentProfile: string;
  readonly selectedGame?: string;
  readonly status: 'normal' | 'warning' | 'critical';
}

export interface TrayStateModel extends TrayStateInput {
  readonly tooltip: string;
}

export const createTrayStateModel = (input: TrayStateInput): TrayStateModel =>
  Object.freeze({
    ...input,
    tooltip: `Liiiraa Boost — ${input.status}${
      input.activityRequiringAttention > 0
        ? ` — ${String(input.activityRequiringAttention)} item(s) require attention`
        : ''
    }`,
  });

export interface NextActionBriefProps {
  readonly action: ReactNode;
  readonly detail: string;
  readonly title: string;
}

export const NextActionBrief = ({ action, detail, title }: NextActionBriefProps) => (
  <section aria-labelledby="lb-next-action-title" className="lb-next-action" data-lb-region>
    <div>
      <h2 id="lb-next-action-title">{title}</h2>
      <p>{detail}</p>
    </div>
    {action}
  </section>
);

export interface GameRunwayProps {
  readonly game: string;
  readonly steps: readonly string[];
}

export const GameRunway = ({ game, steps }: GameRunwayProps) => (
  <section aria-label={`Launch runway for ${game}`} className="lb-workflow" data-lb-region>
    <h2>{game}</h2>
    <ol>
      {steps.map((step) => (
        <li key={step}>{step}</li>
      ))}
    </ol>
  </section>
);

export interface LedgerEntry {
  readonly detail: string;
  readonly id: string;
  readonly label: string;
  readonly state: OperationalState;
}

export const SystemStateLedger = ({
  entries,
  locale = 'en',
}: {
  readonly entries: readonly LedgerEntry[];
  readonly locale?: EvidenceLocale;
}) => (
  <section
    aria-label={locale === 'pt-BR' ? 'Registro do estado do sistema' : 'System state ledger'}
    className="lb-workflow"
    data-lb-region
  >
    {entries.map((entry) => (
      <div className="lb-ledger-row" key={entry.id}>
        <strong>{entry.label}</strong>
        <StatusSignal detail={entry.detail} locale={locale} state={entry.state} />
      </div>
    ))}
  </section>
);

export interface CalibrationStepRailProps {
  readonly activeStep: number;
  readonly steps: readonly string[];
}

export const CalibrationStepRail = ({ activeStep, steps }: CalibrationStepRailProps) => (
  <nav aria-label="Calibration progress" className="lb-step-rail">
    <ol>
      {steps.map((step, index) => (
        <li aria-current={index === activeStep ? 'step' : undefined} key={step}>
          <span>{index + 1}</span>
          {step}
        </li>
      ))}
    </ol>
  </nav>
);

export interface OperationRowProps {
  readonly actionLabel?: string;
  readonly detail: string;
  readonly name: string;
  readonly onInspect?: () => void;
  readonly risk: RiskLevel;
  readonly riskLabel?: string;
}

export const OperationRow = ({
  actionLabel = 'Inspect operation',
  detail,
  name,
  onInspect,
  risk,
  riskLabel,
}: OperationRowProps) => (
  <div className="lb-operation-row" data-lb-region>
    <div>
      <strong>{name}</strong>
      <p>{detail}</p>
    </div>
    <RiskClass {...(riskLabel === undefined ? {} : { label: riskLabel })} level={risk} />
    {onInspect ? <LbButton onPress={onInspect}>{actionLabel}</LbButton> : null}
  </div>
);

export const OperationInspector = ({
  children,
  operation,
  operationLabel = 'Operation',
}: {
  readonly children: ReactNode;
  readonly operation: string;
  readonly operationLabel?: string;
}) => <ContextInspector title={`${operationLabel}: ${operation}`}>{children}</ContextInspector>;

export interface PlanDependency {
  readonly id: string;
  readonly label: string;
  readonly state: 'ready' | 'blocked' | 'complete';
}

export const PlanDependencyList = ({
  dependencies,
}: {
  readonly dependencies: readonly PlanDependency[];
}) => (
  <section aria-label="Plan dependencies" className="lb-workflow" data-lb-region>
    <ul>
      {dependencies.map((dependency) => (
        <li key={dependency.id}>
          <strong>{dependency.label}</strong>
          <span>{dependency.state}</span>
        </li>
      ))}
    </ul>
  </section>
);

export interface DiffEntry {
  readonly after: string;
  readonly before: string;
  readonly label: string;
}

export const BeforeAfterDiff = ({ entries }: { readonly entries: readonly DiffEntry[] }) => (
  <section aria-label="Before and after differences" className="lb-workflow" data-lb-region>
    <dl>
      {entries.map((entry) => (
        <div key={entry.label}>
          <dt>{entry.label}</dt>
          <dd>
            <del>{entry.before}</del> → <ins>{entry.after}</ins>
          </dd>
        </div>
      ))}
    </dl>
  </section>
);

export interface RiskGateProps {
  readonly children: ReactNode;
  readonly explanation: string;
  readonly risk: RiskLevel;
  readonly snapshotReady: boolean;
}

export const RiskGate = ({ children, explanation, risk, snapshotReady }: RiskGateProps) => (
  <section aria-label={`${risk} risk gate`} className="lb-risk-gate" data-lb-region>
    <RiskClass level={risk} />
    <p>{explanation}</p>
    <QualityMark
      detail={snapshotReady ? 'Recovery snapshot ready.' : 'Recovery snapshot is not ready.'}
      quality={snapshotReady ? 'verified' : 'unavailable'}
    />
    {children}
  </section>
);

export interface TypedConfirmationProps {
  readonly confirmationPhrase: string;
  readonly onChange: (value: string) => void;
  readonly onConfirm: () => void;
  readonly value: string;
}

export const TypedConfirmation = ({
  confirmationPhrase,
  onChange,
  onConfirm,
  value,
}: TypedConfirmationProps) => (
  <section aria-label="Typed confirmation" className="lb-workflow" data-lb-region>
    <p>
      Enter <strong>{confirmationPhrase}</strong> exactly to continue.
    </p>
    <LbTextField label="Confirmation phrase" onChange={onChange} value={value} />
    <LbButton isDisabled={value !== confirmationPhrase} onPress={onConfirm} variant="destructive">
      Confirm high-risk action
    </LbButton>
  </section>
);

export const RestartPlanner = ({
  children,
  locale = 'en',
  scheduledFor,
}: {
  readonly children?: ReactNode;
  readonly locale?: EvidenceLocale;
  readonly scheduledFor?: string;
}) => (
  <section
    aria-label={locale === 'pt-BR' ? 'Planejamento de reinicialização' : 'Restart planner'}
    className="lb-workflow"
    data-lb-region
  >
    <h2>{locale === 'pt-BR' ? 'Planejamento de reinicialização' : 'Restart planner'}</h2>
    <StatusSignal
      detail={
        scheduledFor
          ? locale === 'pt-BR'
            ? `Agendado para ${scheduledFor}`
            : `Scheduled for ${scheduledFor}`
          : locale === 'pt-BR'
            ? 'Nenhum horário de reinicialização foi escolhido.'
            : 'No restart time selected.'
      }
      locale={locale}
      state="restart-pending"
    />
    {children}
  </section>
);

export const RecoveryCheckpoint = ({
  detail,
  locale = 'en',
  title,
}: {
  readonly detail: string;
  readonly locale?: EvidenceLocale;
  readonly title: string;
}) => (
  <section aria-label={title} className="lb-workflow" data-lb-region>
    <h2>{title}</h2>
    <StatusSignal detail={detail} locale={locale} state="recovery" />
  </section>
);

export const VerificationReceipt = ({
  detail,
  locale = 'en',
  receiptId,
}: {
  readonly detail: string;
  readonly locale?: EvidenceLocale;
  readonly receiptId: string;
}) => (
  <section
    aria-label={locale === 'pt-BR' ? 'Recibo de verificação' : 'Verification receipt'}
    className="lb-receipt"
    data-lb-region
  >
    <h2>{locale === 'pt-BR' ? 'Verificação concluída' : 'Verification complete'}</h2>
    <p>{detail}</p>
    <code>{receiptId}</code>
  </section>
);

export const EmptyComposition = ({
  action,
  detail,
  title,
}: {
  readonly action?: ReactNode;
  readonly detail: string;
  readonly title: string;
}) => (
  <section aria-label={title} className="lb-empty" data-lb-region>
    <h2>{title}</h2>
    <StatusSignal detail={detail} state="empty" />
    {action}
  </section>
);

export const OperationalFailure = ({
  detail,
  recover,
  title,
}: {
  readonly detail: string;
  readonly recover?: ReactNode;
  readonly title: string;
}) => (
  <section aria-label={title} className="lb-failure" data-lb-region role="alert">
    <h2>{title}</h2>
    <StatusSignal detail={detail} state="partial-failure" />
    {recover}
  </section>
);
