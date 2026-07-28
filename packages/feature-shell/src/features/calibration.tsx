import {
  CalibrationStepRail,
  LbButton,
  LbSwitch,
  RouteHeader,
  ScenarioMarker,
  StatusSignal,
  type OperationalState,
} from '@liiiraa/design-system';
import { useActor } from '@xstate/react';

import { calibrationMachine } from '../machines/calibration.machine.js';
import {
  CALIBRATION_STEPS,
  type CalibrationEvent,
  type CalibrationState,
  type CalibrationStep,
  type ConnectedConsentKey,
} from '../model/calibration.js';

export const CALIBRATION_SURFACE_STATES = Object.freeze([
  'new',
  'running',
  'slow',
  'paused',
  'resumed',
  'offline',
  'permission-requested',
  'permission-denied',
  'partial',
  'unsupported',
  'empty',
  'cancelled',
  'failure',
  'completed',
  'dependency-blocked',
  'limited',
  'revalidation',
] as const);

export type CalibrationSurfaceState = (typeof CALIBRATION_SURFACE_STATES)[number];
export type ShellLocale = 'en' | 'pt-BR';

export interface CalibrationWorkspaceProps {
  readonly elapsed?: string;
  readonly initialSnapshot?: unknown;
  readonly locale: ShellLocale;
  readonly onBoundaryAction?: (action: 'add-game' | 'open-docs' | 'request-permission') => void;
  readonly onComplete?: () => void;
  readonly scenarioId: string;
  readonly surfaceState?: CalibrationSurfaceState;
}

const STEP_LABELS: Readonly<Record<ShellLocale, Readonly<Record<CalibrationStep, string>>>> = {
  en: {
    trustPrivacy: 'Trust and privacy',
    systemInventory: 'System inventory',
    performanceDiagnosis: 'Performance diagnosis',
    recoveryReadiness: 'Recovery readiness',
    goals: 'Your goals',
    priorityGames: 'Priority games',
    review: 'Review',
  },
  'pt-BR': {
    trustPrivacy: 'Confiança e privacidade',
    systemInventory: 'Inventário do sistema',
    performanceDiagnosis: 'Diagnóstico de desempenho',
    recoveryReadiness: 'Prontidão para recuperação',
    goals: 'Seus objetivos',
    priorityGames: 'Jogos prioritários',
    review: 'Revisão',
  },
};

const STATE_COPY: Readonly<
  Record<
    ShellLocale,
    Readonly<Record<CalibrationSurfaceState, Readonly<{ detail: string; title: string }>>>
  >
> = {
  en: {
    new: {
      title: 'Ready to build a trusted baseline',
      detail: 'Start with local trust choices and a basic system inventory.',
    },
    running: {
      title: 'Calibration is running',
      detail: 'The current local step is collecting scenario evidence.',
    },
    slow: {
      title: 'This step is taking longer',
      detail: 'Progress is preserved. You can pause without losing completed evidence.',
    },
    paused: {
      title: 'Calibration is paused',
      detail: 'Completed evidence is saved locally and can be resumed safely.',
    },
    resumed: {
      title: 'Calibration resumed',
      detail: 'Continuing from the first incomplete step with saved progress.',
    },
    offline: {
      title: 'Connected processing is unavailable',
      detail: 'Local calibration steps remain available; optional connected steps stay off.',
    },
    'permission-requested': {
      title: 'Permission is needed for this source',
      detail: 'Only this dependent step is blocked. No other safe local action is restricted.',
    },
    'permission-denied': {
      title: 'Inventory permission was denied',
      detail: 'Recommendations are suppressed until the required inventory can be retried.',
    },
    partial: {
      title: 'Calibration has partial evidence',
      detail: 'Completed sources remain trusted; the unavailable source is named below.',
    },
    unsupported: {
      title: 'This source is unsupported',
      detail: 'The current hardware or Windows lifecycle cannot provide this evidence.',
    },
    empty: {
      title: 'No games were found',
      detail: 'Add a game manually or continue with the other local steps.',
    },
    cancelled: {
      title: 'Calibration stopped safely',
      detail: 'Progress was saved locally. Resume whenever you are ready.',
    },
    failure: {
      title: 'Calibration could not continue',
      detail: 'No change occurred. Review the diagnostic reference before retrying.',
    },
    completed: {
      title: 'Calibration complete',
      detail: 'We reviewed 8 sources; 2 remain unavailable.',
    },
    'dependency-blocked': {
      title: 'This action needs one more calibration step',
      detail: 'Complete the highlighted step, then return to the original task.',
    },
    limited: {
      title: 'Safe limited mode',
      detail: 'Recommendations are hidden; safe local functions and recovery remain available.',
    },
    revalidation: {
      title: 'Partial revalidation required',
      detail: 'A hardware or freshness change affected only the highlighted evidence.',
    },
  },
  'pt-BR': {
    new: {
      title: 'Pronto para criar uma linha de base confiável',
      detail: 'Comece pelas escolhas locais de confiança e pelo inventário básico do sistema.',
    },
    running: {
      title: 'Calibração em andamento',
      detail: 'A etapa local atual está coletando evidência do cenário.',
    },
    slow: {
      title: 'Esta etapa está demorando mais',
      detail: 'O progresso está salvo. Você pode pausar sem perder evidências concluídas.',
    },
    paused: {
      title: 'Calibração pausada',
      detail: 'A evidência concluída foi salva localmente e pode ser retomada com segurança.',
    },
    resumed: {
      title: 'Calibração retomada',
      detail: 'Continuando da primeira etapa incompleta com o progresso salvo.',
    },
    offline: {
      title: 'O processamento conectado está indisponível',
      detail:
        'As etapas locais continuam disponíveis; etapas conectadas opcionais ficam desligadas.',
    },
    'permission-requested': {
      title: 'Esta fonte precisa de permissão',
      detail:
        'Somente esta etapa dependente está bloqueada. Outras ações locais seguras continuam.',
    },
    'permission-denied': {
      title: 'A permissão do inventário foi negada',
      detail: 'As recomendações ficam ocultas até uma nova tentativa do inventário obrigatório.',
    },
    partial: {
      title: 'A calibração tem evidência parcial',
      detail: 'Fontes concluídas continuam confiáveis; a fonte indisponível aparece abaixo.',
    },
    unsupported: {
      title: 'Esta fonte não é compatível',
      detail: 'O hardware atual ou o ciclo de vida do Windows não fornece esta evidência.',
    },
    empty: {
      title: 'Nenhum jogo foi encontrado',
      detail: 'Adicione um jogo manualmente ou continue com as outras etapas locais.',
    },
    cancelled: {
      title: 'Calibração interrompida com segurança',
      detail: 'O progresso foi salvo localmente. Retome quando quiser.',
    },
    failure: {
      title: 'A calibração não pôde continuar',
      detail:
        'Nenhuma alteração ocorreu. Revise a referência de diagnóstico antes de tentar novamente.',
    },
    completed: {
      title: 'Calibração concluída',
      detail: 'Revisamos 8 fontes; 2 permanecem indisponíveis.',
    },
    'dependency-blocked': {
      title: 'Esta ação precisa de mais uma etapa',
      detail: 'Conclua a etapa destacada e depois retorne à tarefa original.',
    },
    limited: {
      title: 'Modo limitado seguro',
      detail:
        'Recomendações estão ocultas; funções locais seguras e recuperação continuam disponíveis.',
    },
    revalidation: {
      title: 'Revalidação parcial necessária',
      detail: 'Uma mudança de hardware ou validade afetou apenas a evidência destacada.',
    },
  },
};

const CONSENT_LABELS: Readonly<Record<ShellLocale, Readonly<Record<ConnectedConsentKey, string>>>> =
  {
    en: {
      telemetry: 'Optional product telemetry',
      cloudAi: 'Optional cloud AI',
      diagnosticSharing: 'Optional diagnostic sharing',
    },
    'pt-BR': {
      telemetry: 'Telemetria opcional do produto',
      cloudAi: 'IA em nuvem opcional',
      diagnosticSharing: 'Compartilhamento opcional de diagnóstico',
    },
  };

const MACHINE_TO_SURFACE: Readonly<Record<CalibrationState, CalibrationSurfaceState>> = {
  new: 'new',
  running: 'running',
  offlineLocal: 'offline',
  deferred: 'paused',
  partial: 'partial',
  cancelled: 'cancelled',
  resumed: 'resumed',
  home: 'paused',
  dependencyBlocked: 'dependency-blocked',
  limited: 'limited',
  completed: 'completed',
  revalidation: 'revalidation',
};

const SURFACE_TO_OPERATIONAL: Readonly<Record<CalibrationSurfaceState, OperationalState>> = {
  new: 'empty',
  running: 'loading',
  slow: 'loading',
  paused: 'stale-evidence',
  resumed: 'loading',
  offline: 'offline',
  'permission-requested': 'permission',
  'permission-denied': 'permission',
  partial: 'partial-failure',
  unsupported: 'unsupported',
  empty: 'empty',
  cancelled: 'recovery',
  failure: 'partial-failure',
  completed: 'fixture',
  'dependency-blocked': 'permission',
  limited: 'permission',
  revalidation: 'stale-evidence',
};

const actionForState = (
  state: CalibrationSurfaceState,
  send: (event: CalibrationEvent) => void,
  props: CalibrationWorkspaceProps,
) => {
  const isPtBr = props.locale === 'pt-BR';

  switch (state) {
    case 'new':
      return (
        <LbButton
          onPress={() => {
            send({ type: 'START' });
          }}
          variant="primary"
        >
          {isPtBr ? 'Iniciar calibração' : 'Start calibration'}
        </LbButton>
      );
    case 'running':
    case 'slow':
      return (
        <LbButton
          onPress={() => {
            send({ type: 'CANCEL' });
          }}
          variant="secondary"
        >
          {isPtBr ? 'Pausar e salvar' : 'Pause and save'}
        </LbButton>
      );
    case 'paused':
    case 'cancelled':
      return (
        <LbButton
          onPress={() => {
            send({ type: 'RESUME' });
          }}
          variant="primary"
        >
          {isPtBr ? 'Retomar calibração' : 'Resume calibration'}
        </LbButton>
      );
    case 'permission-requested':
      return (
        <LbButton onPress={() => props.onBoundaryAction?.('request-permission')} variant="primary">
          {isPtBr ? 'Revisar permissão' : 'Review permission'}
        </LbButton>
      );
    case 'permission-denied':
    case 'limited':
    case 'failure':
      return (
        <LbButton
          onPress={() => {
            send({ type: 'RETRY' });
          }}
          variant="primary"
        >
          {isPtBr ? 'Tentar novamente' : 'Retry'}
        </LbButton>
      );
    case 'empty':
      return (
        <LbButton onPress={() => props.onBoundaryAction?.('add-game')} variant="primary">
          {isPtBr ? 'Adicionar jogo manualmente' : 'Add a game manually'}
        </LbButton>
      );
    case 'unsupported':
      return (
        <LbButton onPress={() => props.onBoundaryAction?.('open-docs')} variant="secondary">
          {isPtBr ? 'Ver compatibilidade' : 'View compatibility'}
        </LbButton>
      );
    case 'completed':
      return (
        <LbButton onPress={() => props.onComplete?.()} variant="primary">
          {isPtBr ? 'Ir para o início' : 'Go to Home'}
        </LbButton>
      );
    case 'offline':
    case 'partial':
    case 'resumed':
    case 'dependency-blocked':
    case 'revalidation':
      return (
        <LbButton
          onPress={() => {
            send({ type: 'RESUME' });
          }}
          variant="primary"
        >
          {isPtBr ? 'Continuar etapa local' : 'Continue local step'}
        </LbButton>
      );
  }
};

export const CalibrationWorkspace = (props: CalibrationWorkspaceProps) => {
  const [snapshot, send] = useActor(calibrationMachine, {
    input: { snapshot: props.initialSnapshot },
  });
  const machineState =
    snapshot.value === 'restoring' ? ('new' as const) : MACHINE_TO_SURFACE[snapshot.value];
  const state = props.surfaceState ?? machineState;
  const copy = STATE_COPY[props.locale][state];
  const stepLabels = STEP_LABELS[props.locale];
  const activeStep = CALIBRATION_STEPS.indexOf(snapshot.context.currentStep);
  const currentEvidence = snapshot.context.evidence[snapshot.context.currentStep];
  const isPtBr = props.locale === 'pt-BR';

  return (
    <main
      aria-labelledby="calibration-workspace-title"
      className="lb-calibration-workspace"
      data-calibration-state={state}
      data-locale={props.locale}
      data-scenario-id={props.scenarioId}
    >
      <ScenarioMarker scenarioId={props.scenarioId} />
      <RouteHeader
        purpose={
          isPtBr
            ? 'Crie uma linha de base local explicável antes de receber recomendações.'
            : 'Build an explainable local baseline before receiving recommendations.'
        }
        title={isPtBr ? 'Calibração guiada' : 'Guided calibration'}
      />

      <div className="lb-calibration-layout">
        <CalibrationStepRail
          activeStep={Math.max(activeStep, 0)}
          steps={CALIBRATION_STEPS.map((step) => stepLabels[step])}
        />

        <section
          aria-labelledby="calibration-workspace-title"
          className="lb-calibration-stage"
          data-lb-region
        >
          <header className="lb-calibration-stage-header">
            <p>
              {isPtBr
                ? `Etapa ${String(activeStep + 1)} de ${String(CALIBRATION_STEPS.length)}`
                : `Step ${String(activeStep + 1)} of ${String(CALIBRATION_STEPS.length)}`}
            </p>
            <h2 id="calibration-workspace-title">{stepLabels[snapshot.context.currentStep]}</h2>
            <StatusSignal label={copy.title} state={SURFACE_TO_OPERATIONAL[state]} />
          </header>

          <div aria-live="polite" className="lb-calibration-message" role="status">
            <p>{copy.detail}</p>
          </div>

          {props.elapsed ? (
            <p>
              {isPtBr ? 'Tempo decorrido' : 'Elapsed'}: <time>{props.elapsed}</time>
            </p>
          ) : null}

          <details className="lb-calibration-technical">
            <summary>{isPtBr ? 'Detalhes técnicos' : 'Technical details'}</summary>
            {currentEvidence ? (
              <dl>
                <dt>{isPtBr ? 'Fonte' : 'Source'}</dt>
                <dd>{currentEvidence.sourceId}</dd>
                <dt>{isPtBr ? 'Estado' : 'State'}</dt>
                <dd>{currentEvidence.status}</dd>
                <dt>{isPtBr ? 'Validade' : 'Freshness'}</dt>
                <dd>{currentEvidence.freshness}</dd>
                <dt>{isPtBr ? 'Referência' : 'Reference'}</dt>
                <dd>{currentEvidence.messageId}</dd>
              </dl>
            ) : (
              <p>
                {isPtBr
                  ? 'Nenhuma evidência de cenário foi registrada para esta etapa.'
                  : 'No scenario evidence has been recorded for this step.'}
              </p>
            )}
          </details>

          {snapshot.context.invalidatedEvidence.length > 0 ? (
            <aside aria-label={isPtBr ? 'Explicação da revalidação' : 'Revalidation explanation'}>
              <strong>{isPtBr ? 'Evidência preservada' : 'Preserved evidence'}</strong>
              <p>
                {isPtBr
                  ? 'Somente as etapas listadas abaixo serão reabertas; as demais continuam válidas.'
                  : 'Only the steps listed below reopen; all other evidence remains valid.'}
              </p>
              <ul>
                {snapshot.context.invalidatedEvidence.map((step) => (
                  <li key={step}>{stepLabels[step]}</li>
                ))}
              </ul>
            </aside>
          ) : null}

          {snapshot.context.returnIntent ? (
            <aside aria-label={isPtBr ? 'Caminho de retorno' : 'Return path'}>
              <strong>{isPtBr ? 'Retorno preservado' : 'Return preserved'}</strong>
              <p>
                {isPtBr
                  ? `Após concluir esta etapa, volte para ${snapshot.context.returnIntent.route}.`
                  : `After this step, return to ${snapshot.context.returnIntent.route}.`}
              </p>
            </aside>
          ) : null}

          <div className="lb-calibration-actions">{actionForState(state, send, props)}</div>
        </section>
      </div>

      <section
        aria-labelledby="connected-processing-title"
        className="lb-calibration-consent"
        data-lb-region
      >
        <h2 id="connected-processing-title">
          {isPtBr ? 'Processamento opcional conectado' : 'Optional connected processing'}
        </h2>
        <p>
          {isPtBr
            ? 'O inventário básico é local. Cada opção conectada exige consentimento independente e começa desligada.'
            : 'Basic inventory is local. Each connected option needs separate consent and starts off.'}
        </p>
        {(Object.keys(snapshot.context.consents) as ConnectedConsentKey[]).map((consent) => (
          <LbSwitch
            isSelected={snapshot.context.consents[consent]}
            key={consent}
            onChange={(granted) => {
              send({ type: 'SET_CONSENT', consent, granted });
            }}
          >
            {CONSENT_LABELS[props.locale][consent]}
          </LbSwitch>
        ))}
      </section>
    </main>
  );
};
