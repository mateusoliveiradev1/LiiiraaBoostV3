import { Activity, Bell, Minus, PanelRight, Search, ShieldCheck, Square, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button, Toolbar } from 'react-aria-components';

import {
  LbButton,
  LbDetailRow,
  LbDialog,
  LbDisclosure,
  LbIconButton,
  LbPanel,
  LbRowList,
  LbSearchField,
  LbTextField,
} from './primitives.tsx';
import { QualityMark, RiskClass, ScenarioMarker, StatusSignal } from './evidence.tsx';
import type { EvidenceLocale, OperationalState, RiskLevel } from './evidence.tsx';
import { ProductLockup } from './product-lockup.tsx';
import { ProductIcon } from './product-icons.tsx';
import type { ProductIconName } from './product-icons.tsx';

export interface WindowControlHandlers {
  readonly close?: () => void;
  readonly maximizeRestore?: () => void;
  readonly minimize?: () => void;
}

export interface WindowTitleBarProps {
  readonly accountInitials?: string;
  readonly accountLabel?: string;
  readonly accountTierLabel?: string;
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
  accountInitials,
  accountLabel,
  accountTierLabel,
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
    data-tauri-drag-region
  >
    <ProductLockup productName={productName} />
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
            {accountInitials ?? 'LP'}
          </span>
          <span className="lb-account-trigger-copy">
            <strong>{accountLabel ?? (locale === 'pt-BR' ? 'Meu perfil' : 'My profile')}</strong>
            {accountTierLabel === undefined ? null : <small>{accountTierLabel}</small>}
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
            icon={<Minus />}
            label={locale === 'pt-BR' ? 'Minimizar janela' : 'Minimize window'}
            onPress={controls.minimize}
          />
        ) : null}
        {controls.maximizeRestore ? (
          <LbIconButton
            icon={<Square />}
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
          data-tooltip={item.label}
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

type TransactionalLocale = EvidenceLocale;

const TRANSACTIONAL_COPY = Object.freeze({
  en: Object.freeze({
    approval: 'Approval',
    approvalInvalid: 'Review required',
    approvalValid: 'Approval is valid',
    blocked: 'Blocked',
    cancel: 'Cancel',
    checkpoint: 'Checkpoint',
    completed: 'Completed',
    completedAt: 'Completed at',
    confirmCheckpoint: 'Confirm checkpoint restoration',
    confirmOperation: 'Confirm operation restoration',
    confirmPlan: 'Confirm full-plan restoration',
    current: 'Current',
    diagnosticIdentity: 'Diagnostic / export identity',
    evidenceBlocked: 'Evidence blocks this revision',
    evidenceCurrent: 'Evidence is current',
    evidenceFingerprint: 'Evidence fingerprint',
    evidenceStale: 'Evidence is stale',
    highestRisk: 'Highest risk',
    journalCorrelation: 'Journal correlation',
    observed: 'Observed',
    operationCount: 'Operation count',
    operationVersion: 'Operation version',
    pending: 'Pending',
    planRevision: 'Plan revision',
    prior: 'Prior',
    protectedState: 'Protected prior state',
    receipt: 'Verified receipt',
    receiptId: 'Receipt ID',
    recovery: 'Recovery readiness',
    recoveryMethod: 'Recovery method',
    recoveryNotReady: 'Recovery is not ready',
    recoveryReady: 'Recovery is ready',
    recoveryTargets: 'Recovery targets',
    requestedApplied: 'Requested / Applied',
    requestedState: 'Requested state',
    observedState: 'Observed state',
    priorState: 'Prior state',
    restoreCheckpoint: 'Restore checkpoint',
    restoreOperation: 'Restore this operation',
    restorePlan: 'Restore full plan',
    revisionId: 'Revision ID',
    startedAt: 'Started at',
    stateConflict: 'The observed state conflicts with the protected transaction.',
    stateDrift: 'The observed state differs from the expected prior state.',
    stateTriplet: 'Protected state comparison',
    technicalDetails: 'View technical details',
    timeline: 'Execution timeline',
    timestamp: 'Timestamp',
    transactionId: 'Transaction ID',
  }),
  'pt-BR': Object.freeze({
    approval: 'Aprovação',
    approvalInvalid: 'Nova revisão necessária',
    approvalValid: 'A aprovação é válida',
    blocked: 'Bloqueado',
    cancel: 'Cancelar',
    checkpoint: 'Ponto de recuperação',
    completed: 'Concluído',
    completedAt: 'Concluído em',
    confirmCheckpoint: 'Confirmar restauração do ponto',
    confirmOperation: 'Confirmar restauração da operação',
    confirmPlan: 'Confirmar restauração do plano completo',
    current: 'Atual',
    diagnosticIdentity: 'Identidade do diagnóstico / exportação',
    evidenceBlocked: 'As evidências bloqueiam esta revisão',
    evidenceCurrent: 'As evidências estão atuais',
    evidenceFingerprint: 'Impressão digital das evidências',
    evidenceStale: 'As evidências estão desatualizadas',
    highestRisk: 'Maior risco',
    journalCorrelation: 'Correlação do diário',
    observed: 'Observado',
    operationCount: 'Quantidade de operações',
    operationVersion: 'Versão da operação',
    pending: 'Pendente',
    planRevision: 'Revisão do plano',
    prior: 'Anterior',
    protectedState: 'Estado anterior protegido',
    receipt: 'Comprovante verificado',
    receiptId: 'ID do comprovante',
    recovery: 'Prontidão de recuperação',
    recoveryMethod: 'Método de recuperação',
    recoveryNotReady: 'A recuperação não está pronta',
    recoveryReady: 'A recuperação está pronta',
    recoveryTargets: 'Destinos de recuperação',
    requestedApplied: 'Solicitado / Aplicado',
    requestedState: 'Estado solicitado',
    observedState: 'Estado observado',
    priorState: 'Estado anterior',
    restoreCheckpoint: 'Restaurar ponto de recuperação',
    restoreOperation: 'Restaurar esta operação',
    restorePlan: 'Restaurar plano completo',
    revisionId: 'ID da revisão',
    startedAt: 'Iniciado em',
    stateConflict: 'O estado observado conflita com a transação protegida.',
    stateDrift: 'O estado observado difere do estado anterior esperado.',
    stateTriplet: 'Comparação de estados protegidos',
    technicalDetails: 'Ver detalhes técnicos',
    timeline: 'Linha do tempo da execução',
    timestamp: 'Horário',
    transactionId: 'ID da transação',
  }),
});

const transactionalCopy = (locale: TransactionalLocale | undefined) =>
  locale === 'pt-BR' ? TRANSACTIONAL_COPY['pt-BR'] : TRANSACTIONAL_COPY.en;

export type PlanEvidenceState = 'current' | 'stale' | 'blocked';

export interface PlanRevisionSummaryProps {
  readonly action?: ReactNode;
  readonly approvalValid: boolean;
  readonly evidenceFingerprint: string;
  readonly evidenceState: PlanEvidenceState;
  readonly extremeExplanation?: string;
  readonly highestRisk: RiskLevel;
  readonly locale?: TransactionalLocale;
  readonly operationCount: number;
  readonly recoveryReady: boolean;
  readonly revisionId: string;
}

const EVIDENCE_SIGNAL = Object.freeze({
  blocked: 'critical',
  current: 'success',
  stale: 'stale',
} satisfies Record<PlanEvidenceState, 'critical' | 'stale' | 'success'>);

export const PlanRevisionSummary = ({
  action,
  approvalValid,
  evidenceFingerprint,
  evidenceState,
  extremeExplanation,
  highestRisk,
  locale,
  operationCount,
  recoveryReady,
  revisionId,
}: PlanRevisionSummaryProps) => {
  const copy = transactionalCopy(locale);
  const evidenceDetail =
    evidenceState === 'current'
      ? copy.evidenceCurrent
      : evidenceState === 'stale'
        ? copy.evidenceStale
        : copy.evidenceBlocked;

  return (
    <LbPanel label={copy.planRevision} tone="focal">
      <div className="lb-transaction-heading">
        <ProductIcon aria-hidden="true" name="list" size={20} weight="duotone" />
        <h2>{copy.planRevision}</h2>
      </div>
      <LbRowList label={copy.planRevision}>
        <LbDetailRow
          label={copy.revisionId}
          value={<code className="lb-transaction-exact">{revisionId}</code>}
        />
        <LbDetailRow
          detail={
            <StatusSignal
              detail={evidenceDetail}
              state={EVIDENCE_SIGNAL[evidenceState]}
              {...(locale === undefined ? {} : { locale })}
            />
          }
          label={copy.evidenceFingerprint}
          value={<code className="lb-transaction-exact">{evidenceFingerprint}</code>}
        />
        <LbDetailRow label={copy.highestRisk} value={<RiskClass level={highestRisk} />} />
        <LbDetailRow label={copy.operationCount} value={operationCount.toLocaleString(locale)} />
        <LbDetailRow
          label={copy.recovery}
          value={
            <StatusSignal
              detail={recoveryReady ? copy.recoveryReady : copy.recoveryNotReady}
              state={recoveryReady ? 'success' : 'critical'}
              {...(locale === undefined ? {} : { locale })}
            />
          }
        />
        <LbDetailRow
          label={copy.approval}
          value={
            <StatusSignal
              detail={approvalValid ? copy.approvalValid : copy.approvalInvalid}
              state={approvalValid ? 'success' : 'critical'}
              {...(locale === undefined ? {} : { locale })}
            />
          }
        />
      </LbRowList>
      {highestRisk === 'extreme' ? (
        <StatusSignal
          detail={
            extremeExplanation ??
            (locale === 'pt-BR'
              ? 'Operações Extremas ficam visíveis somente para explicação.'
              : 'Extreme operations remain visible for explanation only.')
          }
          state="critical"
          {...(locale === undefined ? {} : { locale })}
        />
      ) : (
        action
      )}
    </LbPanel>
  );
};

export type ExecutionStageState = 'complete' | 'current' | 'pending';

export interface ExecutionTimelineStage {
  readonly detail?: string;
  readonly id: string;
  readonly label: string;
  readonly state: ExecutionStageState;
  readonly timestamp?: string;
}

export interface ExecutionTimelineProps {
  readonly currentStageId: string;
  readonly label?: string;
  readonly locale?: TransactionalLocale;
  readonly stages: readonly ExecutionTimelineStage[];
}

const TIMELINE_PRESENTATION = Object.freeze({
  complete: Object.freeze({ icon: 'check' as const, pattern: 'solid' }),
  current: Object.freeze({ icon: 'activity' as const, pattern: 'double' }),
  pending: Object.freeze({ icon: 'timer' as const, pattern: 'dotted' }),
});

export const ExecutionTimeline = ({
  currentStageId,
  label,
  locale,
  stages,
}: ExecutionTimelineProps) => {
  const copy = transactionalCopy(locale);
  const currentStages = stages.filter(
    (stage) => stage.id === currentStageId && stage.state === 'current',
  );
  if (currentStages.length !== 1 || stages.filter((stage) => stage.state === 'current').length !== 1) {
    throw new Error('ExecutionTimeline requires exactly one matching current stage.');
  }

  const stateLabels = {
    complete: copy.completed,
    current: copy.current,
    pending: copy.pending,
  } satisfies Record<ExecutionStageState, string>;

  return (
    <LbPanel label={label ?? copy.timeline}>
      <div className="lb-transaction-heading">
        <ProductIcon aria-hidden="true" name="activity" size={20} weight="duotone" />
        <h2>{label ?? copy.timeline}</h2>
      </div>
      <ol className="lb-execution-timeline">
        {stages.map((stage) => {
          const presentation = TIMELINE_PRESENTATION[stage.state];
          return (
            <li
              aria-current={stage.id === currentStageId ? 'step' : undefined}
              className="lb-execution-stage"
              data-pattern={presentation.pattern}
              data-state={stage.state}
              key={stage.id}
            >
              <ProductIcon
                aria-hidden="true"
                className="lb-execution-stage-icon"
                name={presentation.icon}
                size={20}
                weight="duotone"
              />
              <div>
                <strong>{stage.label}</strong>
                <span className="lb-execution-stage-state">{stateLabels[stage.state]}</span>
                {stage.detail ? <p>{stage.detail}</p> : null}
                {stage.timestamp ? (
                  <span className="lb-transaction-time">
                    <span>{copy.timestamp}</span>
                    <time dateTime={stage.timestamp}>{stage.timestamp}</time>
                  </span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </LbPanel>
  );
};

export interface RecoveryTarget {
  readonly blockedReason?: string;
  readonly detail: string;
  readonly id: string;
  readonly label: string;
  readonly onRestore: () => void;
  readonly protectedState: string;
}

export interface RecoveryTargetListProps {
  readonly checkpoint: RecoveryTarget;
  readonly locale?: TransactionalLocale;
  readonly operation: RecoveryTarget;
  readonly plan: RecoveryTarget;
}

type RecoveryTargetKind = 'operation' | 'plan' | 'checkpoint';

const RecoveryTargetAction = ({
  kind,
  locale,
  target,
}: {
  readonly kind: RecoveryTargetKind;
  readonly locale?: TransactionalLocale;
  readonly target: RecoveryTarget;
}) => {
  const copy = transactionalCopy(locale);
  const blockerId = `lb-recovery-${kind}-${target.id}-blocker`;
  const actionLabel =
    kind === 'operation'
      ? copy.restoreOperation
      : kind === 'plan'
        ? copy.restorePlan
        : copy.restoreCheckpoint;
  const confirmationLabel =
    kind === 'operation'
      ? copy.confirmOperation
      : kind === 'plan'
        ? copy.confirmPlan
        : copy.confirmCheckpoint;

  return (
    <li className="lb-recovery-target" data-kind={kind}>
      <div>
        <h3>{target.label}</h3>
        <p>{target.detail}</p>
        <span className="lb-transaction-exact-pair">
          <span>{copy.protectedState}</span>
          <code>{target.protectedState}</code>
        </span>
      </div>
      {target.blockedReason ? (
        <>
          <Button
            aria-describedby={blockerId}
            className="lb-button"
            data-lb-control
            data-lb-variant="secondary"
            isDisabled
            type="button"
          >
            {actionLabel}
          </Button>
          <p className="lb-recovery-blocker" id={blockerId}>
            <ProductIcon aria-hidden="true" name="warning" size={16} weight="duotone" />
            <span>{target.blockedReason}</span>
          </p>
        </>
      ) : (
        <LbDialog
          description={`${target.detail} ${copy.protectedState}: ${target.protectedState}`}
          title={`${actionLabel}: ${target.label}`}
          trigger={<LbButton>{actionLabel}</LbButton>}
        >
          <div className="lb-recovery-confirmation">
            <span className="lb-transaction-exact-pair">
              <span>{copy.protectedState}</span>
              <code>{target.protectedState}</code>
            </span>
            <footer className="lb-dialog-actions">
              <Button className="lb-button" data-lb-control slot="close" type="button">
                {copy.cancel}
              </Button>
              <Button
                className="lb-button"
                data-lb-control
                data-lb-variant="destructive"
                onPress={target.onRestore}
                slot="close"
                type="button"
              >
                {confirmationLabel}
              </Button>
            </footer>
          </div>
        </LbDialog>
      )}
    </li>
  );
};

export const RecoveryTargetList = ({
  checkpoint,
  locale,
  operation,
  plan,
}: RecoveryTargetListProps) => {
  if (new Set([operation.id, plan.id, checkpoint.id]).size !== 3) {
    throw new Error('RecoveryTargetList requires three distinct target IDs.');
  }
  const copy = transactionalCopy(locale);

  return (
    <LbPanel label={copy.recoveryTargets}>
      <div className="lb-transaction-heading">
        <ProductIcon aria-hidden="true" name="recovery" size={20} weight="duotone" />
        <h2>{copy.recoveryTargets}</h2>
      </div>
      <ul className="lb-recovery-target-list">
        <RecoveryTargetAction
          kind="operation"
          target={operation}
          {...(locale === undefined ? {} : { locale })}
        />
        <RecoveryTargetAction
          kind="plan"
          target={plan}
          {...(locale === undefined ? {} : { locale })}
        />
        <RecoveryTargetAction
          kind="checkpoint"
          target={checkpoint}
          {...(locale === undefined ? {} : { locale })}
        />
      </ul>
    </LbPanel>
  );
};

export interface StateTripletDiffProps {
  readonly locale?: TransactionalLocale;
  readonly observed: string;
  readonly prior: string;
  readonly requestedApplied: string;
  readonly state: 'drift' | 'conflict';
}

export const StateTripletDiff = ({
  locale,
  observed,
  prior,
  requestedApplied,
  state,
}: StateTripletDiffProps) => {
  const copy = transactionalCopy(locale);

  return (
    <LbPanel label={copy.stateTriplet} tone="focal">
      <div className="lb-transaction-heading">
        <ProductIcon aria-hidden="true" name="arrowsMerge" size={20} weight="duotone" />
        <h2>{copy.stateTriplet}</h2>
      </div>
      <StatusSignal
        detail={state === 'conflict' ? copy.stateConflict : copy.stateDrift}
        state={state === 'conflict' ? 'critical' : 'warning'}
        {...(locale === undefined ? {} : { locale })}
      />
      <dl className="lb-state-triplet" data-pattern={state === 'conflict' ? 'double' : 'dashed'}>
        <div>
          <dt>{copy.prior}</dt>
          <dd>{prior}</dd>
        </div>
        <div>
          <dt>{copy.requestedApplied}</dt>
          <dd>{requestedApplied}</dd>
        </div>
        <div>
          <dt>{copy.observed}</dt>
          <dd>{observed}</dd>
        </div>
      </dl>
    </LbPanel>
  );
};

export interface VerifiedReceiptTechnicalDetails {
  readonly completedAt: string;
  readonly diagnosticIdentity: string;
  readonly journalCorrelation: string;
  readonly observedState: string;
  readonly operationVersion: string;
  readonly priorState: string;
  readonly recoveryMethod: string;
  readonly requestedState: string;
  readonly startedAt: string;
  readonly transactionId: string;
}

export interface VerifiedReceiptDetailsProps {
  readonly details: VerifiedReceiptTechnicalDetails;
  readonly locale?: TransactionalLocale;
  readonly receiptId: string;
  readonly summary: string;
  readonly verification: string;
}

export const VerifiedReceiptDetails = ({
  details,
  locale,
  receiptId,
  summary,
  verification,
}: VerifiedReceiptDetailsProps) => {
  const copy = transactionalCopy(locale);
  const fields = [
    [copy.receiptId, receiptId],
    [copy.transactionId, details.transactionId],
    [copy.operationVersion, details.operationVersion],
    [copy.priorState, details.priorState],
    [copy.requestedState, details.requestedState],
    [copy.observedState, details.observedState],
    [copy.recoveryMethod, details.recoveryMethod],
    [copy.journalCorrelation, details.journalCorrelation],
    [copy.startedAt, details.startedAt],
    [copy.completedAt, details.completedAt],
    [copy.diagnosticIdentity, details.diagnosticIdentity],
  ] as const;

  return (
    <LbPanel label={copy.receipt}>
      <div className="lb-transaction-heading">
        <ProductIcon aria-hidden="true" name="receipt" size={20} weight="duotone" />
        <h2>{copy.receipt}</h2>
      </div>
      <p className="lb-receipt-summary">{summary}</p>
      <StatusSignal
        detail={verification}
        state="success"
        {...(locale === undefined ? {} : { locale })}
      />
      <LbDisclosure label={copy.technicalDetails}>
        <dl className="lb-receipt-details" data-immutable="true">
          {fields.map(([fieldLabel, value]) => (
            <div key={fieldLabel}>
              <dt>{fieldLabel}</dt>
              <dd>
                <code className="lb-transaction-exact">{value}</code>
              </dd>
            </div>
          ))}
        </dl>
      </LbDisclosure>
    </LbPanel>
  );
};
