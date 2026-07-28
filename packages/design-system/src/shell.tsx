import { Activity, Bell, Maximize2, Minimize2, PanelRight, Search, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button, Toolbar } from 'react-aria-components';

import { LbButton, LbDialog, LbIconButton, LbSearchField, LbTextField } from './primitives.js';
import { QualityMark, RiskClass, ScenarioMarker, StatusSignal } from './evidence.js';
import type { OperationalState, RiskLevel } from './evidence.js';

export interface WindowControlHandlers {
  readonly close?: () => void;
  readonly maximizeRestore?: () => void;
  readonly minimize?: () => void;
}

export interface WindowTitleBarProps {
  readonly controls?: WindowControlHandlers;
  readonly globalStatus: string;
  readonly onOpenActivity?: () => void;
  readonly onOpenCommand?: () => void;
  readonly productName?: string;
  readonly scenarioId?: string;
}

export const WindowTitleBar = ({
  controls,
  globalStatus,
  onOpenActivity,
  onOpenCommand,
  productName = 'Liiiraa Boost',
  scenarioId,
}: WindowTitleBarProps) => (
  <header aria-label="Application title bar" className="lb-title-bar" data-lb-region>
    <strong>{productName}</strong>
    {scenarioId ? <ScenarioMarker scenarioId={scenarioId} /> : null}
    <span className="lb-global-status">{globalStatus}</span>
    <div className="lb-title-actions">
      {onOpenCommand ? (
        <LbIconButton icon={<Search />} label="Open command center" onPress={onOpenCommand} />
      ) : null}
      {onOpenActivity ? (
        <LbIconButton icon={<Bell />} label="Open activity" onPress={onOpenActivity} />
      ) : null}
    </div>
    {controls ? (
      <div aria-label="Window controls" className="lb-window-controls" role="group">
        {controls.minimize ? (
          <LbIconButton icon={<Minimize2 />} label="Minimize window" onPress={controls.minimize} />
        ) : null}
        {controls.maximizeRestore ? (
          <LbIconButton
            icon={<Maximize2 />}
            label="Maximize or restore window"
            onPress={controls.maximizeRestore}
          />
        ) : null}
        {controls.close ? (
          <LbIconButton icon={<X />} label="Close window" onPress={controls.close} />
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
  readonly utilities?: readonly GoalRailItem[];
}

const GoalButtons = ({
  activeId,
  items,
}: {
  readonly activeId: string;
  readonly items: readonly GoalRailItem[];
}) => (
  <>
    {items.map((item) => (
      <Button
        className="lb-goal"
        data-lb-control
        key={item.id}
        onPress={item.onPress}
        {...(item.id === activeId ? { 'aria-current': 'page' as const } : {})}
      >
        {item.label}
      </Button>
    ))}
  </>
);

export const GoalRail = ({ activeId, goals, utilities = [] }: GoalRailProps) => (
  <nav aria-label="Primary goals" className="lb-goal-rail" data-lb-region>
    <Toolbar aria-label="Product goals" orientation="vertical">
      <GoalButtons activeId={activeId} items={goals} />
    </Toolbar>
    {utilities.length > 0 ? (
      <Toolbar
        aria-label="Account and settings"
        className="lb-goal-utilities"
        orientation="vertical"
      >
        <GoalButtons activeId={activeId} items={utilities} />
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
          <li key={`${index}:${item.label}`}>
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
        ? ` — ${input.activityRequiringAttention} item(s) require attention`
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

export const SystemStateLedger = ({ entries }: { readonly entries: readonly LedgerEntry[] }) => (
  <section aria-label="System state ledger" className="lb-workflow" data-lb-region>
    {entries.map((entry) => (
      <div className="lb-ledger-row" key={entry.id}>
        <strong>{entry.label}</strong>
        <StatusSignal detail={entry.detail} state={entry.state} />
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
  readonly detail: string;
  readonly name: string;
  readonly onInspect?: () => void;
  readonly risk: RiskLevel;
}

export const OperationRow = ({ detail, name, onInspect, risk }: OperationRowProps) => (
  <div className="lb-operation-row" data-lb-region>
    <div>
      <strong>{name}</strong>
      <p>{detail}</p>
    </div>
    <RiskClass level={risk} />
    {onInspect ? <LbButton onPress={onInspect}>Inspect operation</LbButton> : null}
  </div>
);

export const OperationInspector = ({
  children,
  operation,
}: {
  readonly children: ReactNode;
  readonly operation: string;
}) => <ContextInspector title={`Operation: ${operation}`}>{children}</ContextInspector>;

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
  scheduledFor,
}: {
  readonly children?: ReactNode;
  readonly scheduledFor?: string;
}) => (
  <section aria-label="Restart planner" className="lb-workflow" data-lb-region>
    <h2>Restart planner</h2>
    <StatusSignal
      detail={scheduledFor ? `Scheduled for ${scheduledFor}` : 'No restart time selected.'}
      state="restart-pending"
    />
    {children}
  </section>
);

export const RecoveryCheckpoint = ({
  detail,
  title,
}: {
  readonly detail: string;
  readonly title: string;
}) => (
  <section aria-label={title} className="lb-workflow" data-lb-region>
    <h2>{title}</h2>
    <StatusSignal detail={detail} state="recovery" />
  </section>
);

export const VerificationReceipt = ({
  detail,
  receiptId,
}: {
  readonly detail: string;
  readonly receiptId: string;
}) => (
  <section aria-label="Verification receipt" className="lb-receipt" data-lb-region>
    <h2>Verification complete</h2>
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
