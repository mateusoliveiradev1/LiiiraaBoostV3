import {
  CapabilityReason,
  ChangeLedger,
  EvidenceList,
  LbButton,
  LbRadioGroup,
  OperationInspector,
  OperationRow,
  PlanDependencyList,
  ProvenanceMark,
  QualityMark,
  RestartPlanner,
  RiskClass,
  RiskGate,
  RouteHeader,
  ScenarioMarker,
  StatusSignal,
  VerificationReceipt,
  type CapabilityState,
  type EvidenceQuality,
  type RiskLevel,
} from '@liiiraa/design-system';
import type {
  DesktopScenarioId,
  PhaseBoundaryExplanation,
  RecommendationState,
} from '@liiiraa/desktop-client';

import type { ShellLocale } from './calibration.js';

export const IMPROVE_VIEWS = Object.freeze([
  'goals',
  'component',
  'operation',
  'plan-review',
  'confirmation',
  'restart',
  'recovery-history',
  'no-change-receipt',
] as const);

export type ImproveView = (typeof IMPROVE_VIEWS)[number];

export const IMPROVE_GOALS = Object.freeze([
  'performance',
  'latency',
  'stability',
  'privacy',
] as const);

export type ImproveGoal = (typeof IMPROVE_GOALS)[number];

export const IMPROVE_RISK_POLICIES = Object.freeze([
  'verified',
  'advanced',
  'experimental',
  'extreme',
] as const);

export const IMPROVE_COMPONENTS = Object.freeze([
  'windows',
  'cpu-power',
  'gpu',
  'memory',
  'storage',
  'thermals',
  'network',
  'audio',
  'input-usb',
  'display',
  'security-privacy',
] as const);

export type ImproveComponent = (typeof IMPROVE_COMPONENTS)[number];

type OperationEligibility = RecommendationState['eligibility'];
type OperationRisk = RecommendationState['risk'];

export interface TechnicalOperation {
  readonly compatibility: string;
  readonly component: ImproveComponent;
  readonly dependencies: readonly string[];
  readonly eligibility: OperationEligibility;
  readonly evidence: string;
  readonly evidenceQuality: EvidenceQuality;
  readonly exclusionReason?: string;
  readonly expectedDirection: string;
  readonly id: string;
  readonly name: string;
  readonly previousValue: string;
  readonly provenance: 'fixture';
  readonly purpose: string;
  readonly recoveryMethod: string;
  readonly restartEffect: string;
  readonly riskClass: OperationRisk;
}

export interface ImproveSurfaceProps {
  readonly locale: ShellLocale;
  readonly onNavigate?: (view: ImproveView, targetId?: string) => void;
  readonly onRiskPolicyChange?: (risk: OperationRisk) => void;
  readonly scenarioId: string;
  readonly selectedComponent?: ImproveComponent;
  readonly selectedGoal?: ImproveGoal;
  readonly selectedOperationId?: string;
  readonly view: ImproveView;
}

interface LocalizedCopy {
  readonly en: string;
  readonly 'pt-BR': string;
}

const localized = (copy: LocalizedCopy, locale: ShellLocale) => copy[locale];

const GOAL_COPY: Readonly<
  Record<ImproveGoal, Readonly<{ detail: LocalizedCopy; label: LocalizedCopy }>>
> = {
  performance: {
    label: { en: 'Performance', 'pt-BR': 'Desempenho' },
    detail: {
      en: 'Review evidence-bound opportunities that may reduce avoidable work.',
      'pt-BR': 'Revise oportunidades baseadas em evidência que podem reduzir trabalho evitável.',
    },
  },
  latency: {
    label: { en: 'Latency', 'pt-BR': 'Latência' },
    detail: {
      en: 'Inspect timing paths without promising zero latency.',
      'pt-BR': 'Inspecione caminhos de tempo sem prometer latência zero.',
    },
  },
  stability: {
    label: { en: 'Stability', 'pt-BR': 'Estabilidade' },
    detail: {
      en: 'Prefer repeatability, thermal margin, and verified recovery.',
      'pt-BR': 'Priorize repetibilidade, margem térmica e recuperação verificada.',
    },
  },
  privacy: {
    label: { en: 'Privacy', 'pt-BR': 'Privacidade' },
    detail: {
      en: 'Review local data behavior and explicit connected consent.',
      'pt-BR': 'Revise dados locais e consentimento explícito para recursos conectados.',
    },
  },
};

const COMPONENT_COPY: Readonly<
  Record<ImproveComponent, Readonly<{ label: LocalizedCopy; relevance: readonly ImproveGoal[] }>>
> = {
  windows: {
    label: { en: 'Windows', 'pt-BR': 'Windows' },
    relevance: ['performance', 'latency', 'stability', 'privacy'],
  },
  'cpu-power': {
    label: { en: 'CPU and power', 'pt-BR': 'CPU e energia' },
    relevance: ['performance', 'latency', 'stability'],
  },
  gpu: {
    label: { en: 'GPU', 'pt-BR': 'GPU' },
    relevance: ['performance', 'latency', 'stability'],
  },
  memory: {
    label: { en: 'Memory', 'pt-BR': 'Memória' },
    relevance: ['performance', 'stability'],
  },
  storage: {
    label: { en: 'Storage', 'pt-BR': 'Armazenamento' },
    relevance: ['performance', 'stability', 'privacy'],
  },
  thermals: {
    label: { en: 'Thermals', 'pt-BR': 'Temperaturas' },
    relevance: ['performance', 'stability'],
  },
  network: {
    label: { en: 'Network', 'pt-BR': 'Rede' },
    relevance: ['latency', 'stability', 'privacy'],
  },
  audio: {
    label: { en: 'Audio', 'pt-BR': 'Áudio' },
    relevance: ['latency', 'stability'],
  },
  'input-usb': {
    label: { en: 'Input and USB', 'pt-BR': 'Entrada e USB' },
    relevance: ['latency', 'stability'],
  },
  display: {
    label: { en: 'Display', 'pt-BR': 'Tela' },
    relevance: ['performance', 'latency'],
  },
  'security-privacy': {
    label: { en: 'Security and privacy', 'pt-BR': 'Segurança e privacidade' },
    relevance: ['stability', 'privacy'],
  },
};

const COMPONENT_GLYPHS: Readonly<Record<ImproveComponent, string>> = Object.freeze({
  windows: 'WIN',
  'cpu-power': 'CPU',
  gpu: 'GPU',
  memory: 'RAM',
  storage: 'SSD',
  thermals: '°C',
  network: 'NET',
  audio: 'AUD',
  'input-usb': 'USB',
  display: 'HZ',
  'security-privacy': 'SEC',
});

export const GOLDEN_OPERATIONS = Object.freeze([
  {
    id: 'power-balanced-review',
    name: 'Review balanced game power policy',
    component: 'cpu-power',
    eligibility: 'ready',
    riskClass: 'verified',
    evidenceQuality: 'verified',
    purpose: 'Prefer a validated balanced scenario policy during the selected game.',
    expectedDirection: 'May reduce avoidable scheduling variance; no numeric gain is guaranteed.',
    evidence: 'S01 fixture inventory and recovery readiness are current.',
    compatibility: 'Eligible for the S01 Intel/NVIDIA Windows 11 fixture only.',
    restartEffect: 'No restart in the preview.',
    previousValue: 'Scenario baseline: Windows balanced policy.',
    recoveryMethod: 'Restore the exact prior policy from the scenario checkpoint.',
    provenance: 'fixture',
    dependencies: ['Trusted inventory', 'Recovery checkpoint'],
  },
  {
    id: 'network-latency-review',
    name: 'Review adapter latency policy',
    component: 'network',
    eligibility: 'review-required',
    riskClass: 'advanced',
    evidenceQuality: 'verified',
    purpose: 'Inspect an adapter-specific latency policy without applying it.',
    expectedDirection:
      'May reduce timing variance for the scenario workload; direction is evidence-bound.',
    evidence: 'S02 adapter identity is current; workload evidence remains scenario-only.',
    compatibility: 'Compatible with the S02 fixture after full dependency review.',
    restartEffect:
      'Adapter interruption would be possible in a future real flow; preview changes nothing.',
    previousValue: 'Scenario baseline: system-managed adapter policy.',
    recoveryMethod: 'Restore the captured adapter policy and verify connectivity.',
    provenance: 'fixture',
    dependencies: ['Adapter identity', 'Offline-safe recovery', 'Explicit confirmation'],
  },
  {
    id: 'gpu-driver-hidden',
    name: 'Tune unverified GPU driver source',
    component: 'gpu',
    eligibility: 'excluded',
    riskClass: 'experimental',
    evidenceQuality: 'insufficient',
    exclusionReason:
      'GPU driver source is unavailable in S06, so compatibility cannot be established.',
    purpose: 'Would inspect a vendor-specific setting only after evidence exists.',
    expectedDirection: 'Unknown. No directional claim is permitted while evidence is unavailable.',
    evidence: 'S06 reports an unavailable GPU driver source.',
    compatibility: 'Excluded fail-closed.',
    restartEffect: 'Unknown; the operation is excluded before review.',
    previousValue: 'Unavailable — no defensible value exists.',
    recoveryMethod: 'Not applicable because no operation can be requested.',
    provenance: 'fixture',
    dependencies: ['Verified GPU driver source'],
  },
] as const satisfies readonly TechnicalOperation[]);

const operationById = (id: string | undefined): TechnicalOperation =>
  GOLDEN_OPERATIONS.find((operation) => operation.id === id) ?? GOLDEN_OPERATIONS[0];

const capabilityStateFor = (eligibility: OperationEligibility): CapabilityState => {
  switch (eligibility) {
    case 'ready':
      return 'compatible';
    case 'review-required':
      return 'restricted';
    case 'excluded':
      return 'unsupported';
  }
};

const riskForDesignSystem = (risk: OperationRisk): RiskLevel => risk;

const exclusionReasonFor = (operation: TechnicalOperation): string | undefined =>
  operation.exclusionReason;

const createBoundary = (
  scenarioId: string,
  locale: ShellLocale,
  capability: string,
  owningPhase: string,
): PhaseBoundaryExplanation =>
  Object.freeze({
    kind: 'phase-boundary',
    capability,
    owningPhase,
    availableScenarioId: scenarioId as DesktopScenarioId,
    explanation:
      locale === 'pt-BR'
        ? `A interface está completa, mas ${capability} depende da ${owningPhase}. Revise o cenário disponível sem executar nada.`
        : `The interface is complete, but ${capability} belongs to ${owningPhase}. Review the available scenario without executing anything.`,
  });

const GoalsView = ({
  locale,
  onNavigate,
  selectedGoal,
}: {
  readonly locale: ShellLocale;
  readonly onNavigate?: ImproveSurfaceProps['onNavigate'];
  readonly selectedGoal: ImproveGoal;
}) => (
  <section
    aria-labelledby="improve-goals-title"
    className="lb-optimization-overview"
    data-lb-region
    data-selected-goal={selectedGoal}
  >
    <h2 id="improve-goals-title">
      {localized(
        { en: 'What should improve first?', 'pt-BR': 'O que deve melhorar primeiro?' },
        locale,
      )}
    </h2>
    <nav
      aria-label={localized({ en: 'Improvement goals', 'pt-BR': 'Objetivos de melhoria' }, locale)}
    >
      {IMPROVE_GOALS.map((goal) => (
        <LbButton
          key={goal}
          onPress={() => onNavigate?.('goals', goal)}
          variant={goal === selectedGoal ? 'primary' : 'quiet'}
        >
          {localized(GOAL_COPY[goal].label, locale)}
        </LbButton>
      ))}
    </nav>
    <p>{localized(GOAL_COPY[selectedGoal].detail, locale)}</p>
    <FreshFinding locale={locale} selectedGoal={selectedGoal} />
    <section
      aria-label={localized(
        { en: 'Applicable components', 'pt-BR': 'Componentes aplicáveis' },
        locale,
      )}
      className="lb-component-grid"
    >
      {IMPROVE_COMPONENTS.map((component) => {
        const copy = COMPONENT_COPY[component];
        const applicable = copy.relevance.includes(selectedGoal);
        return (
          <article className="lb-component-card" data-component-id={component} key={component}>
            <span aria-hidden="true" className="lb-component-glyph">
              {COMPONENT_GLYPHS[component]}
            </span>
            <h3>{localized(copy.label, locale)}</h3>
            <CapabilityReason
              capability={localized(copy.label, locale)}
              reason={
                applicable
                  ? localized(
                      {
                        en: `Relevant to the ${GOAL_COPY[selectedGoal].label.en} goal; inspect evidence before review.`,
                        'pt-BR': `Relevante para ${GOAL_COPY[selectedGoal].label['pt-BR']}; inspecione a evidência antes da revisão.`,
                      },
                      locale,
                    )
                  : localized(
                      {
                        en: 'Available through another goal; nothing is hidden.',
                        'pt-BR': 'Disponível em outro objetivo; nada fica oculto.',
                      },
                      locale,
                    )
              }
              state={applicable ? 'compatible' : 'hidden'}
            />
            <LbButton onPress={() => onNavigate?.('component', component)} variant="secondary">
              {localized({ en: 'Open', 'pt-BR': 'Abrir' }, locale)}
            </LbButton>
          </article>
        );
      })}
    </section>
  </section>
);

const FreshFinding = ({
  locale,
  selectedGoal,
}: {
  readonly locale: ShellLocale;
  readonly selectedGoal: ImproveGoal;
}) => (
  <aside aria-label={localized({ en: 'Current finding', 'pt-BR': 'Constatação atual' }, locale)}>
    <StatusSignal
      detail={localized(
        {
          en: `Fixture evidence for ${GOAL_COPY[selectedGoal].label.en} is current; one recommendation is ready.`,
          'pt-BR': `A evidência de cenário para ${GOAL_COPY[selectedGoal].label['pt-BR']} está atual; uma recomendação está pronta.`,
        },
        locale,
      )}
      locale={locale}
      state="fixture"
    />
    <ProvenanceMark detail="S01 · FIXTURE · 2030-01-15T18:00:00Z" kind="fixture" locale={locale} />
  </aside>
);

const ComponentView = ({
  component,
  locale,
  onNavigate,
}: {
  readonly component: ImproveComponent;
  readonly locale: ShellLocale;
  readonly onNavigate?: ImproveSurfaceProps['onNavigate'];
}) => {
  const operations = GOLDEN_OPERATIONS.filter((operation) => operation.component === component);

  return (
    <section aria-labelledby="improve-component-title" data-component-id={component} data-lb-region>
      <h2 id="improve-component-title">{localized(COMPONENT_COPY[component].label, locale)}</h2>
      <section
        aria-label={localized({ en: 'Observed state', 'pt-BR': 'Estado observado' }, locale)}
      >
        <ProvenanceMark
          detail="FIXTURE — NOT OBSERVED FROM THIS PC"
          kind="fixture"
          locale={locale}
        />
        <p>
          {localized(
            {
              en: 'The scenario projection is internally consistent and current.',
              'pt-BR': 'A projeção do cenário está atual e internamente consistente.',
            },
            locale,
          )}
        </p>
      </section>
      <p>
        {localized(
          {
            en: 'This component is shown inside the selected goal because its evidence can affect that outcome.',
            'pt-BR':
              'Este componente aparece dentro do objetivo porque sua evidência pode afetar esse resultado.',
          },
          locale,
        )}
      </p>

      <section
        aria-label={localized(
          { en: 'Operation candidates', 'pt-BR': 'Operações candidatas' },
          locale,
        )}
      >
        {operations.map((operation) => (
          <div data-eligibility={operation.eligibility} key={operation.id}>
            <OperationRow
              detail={operation.expectedDirection}
              name={operation.name}
              onInspect={() => onNavigate?.('operation', operation.id)}
              risk={riskForDesignSystem(operation.riskClass)}
            />
            <CapabilityReason
              capability={operation.name}
              reason={exclusionReasonFor(operation) ?? operation.compatibility}
              state={capabilityStateFor(operation.eligibility)}
            />
          </div>
        ))}
        {operations.length === 0 ? (
          <StatusSignal
            detail={localized(
              {
                en: 'No operation is authored for this component in the golden scenario. Phase 7 owns the verified catalog; inspect the component evidence now.',
                'pt-BR':
                  'Nenhuma operação foi criada para este componente no cenário principal. A Fase 7 é responsável pelo catálogo verificado; inspecione agora a evidência do componente.',
              },
              locale,
            )}
            locale={locale}
            state="empty"
          />
        ) : null}
      </section>

      <EvidenceList
        items={[
          {
            source: `scenario:S01/${component}`,
            version: '1',
            timestamp: '2030-01-15T18:00:00.000Z',
            confidence: 'fixture',
          },
        ]}
      />
      <ChangeLedger
        entries={[
          {
            id: `${component}-history`,
            change: 'Scenario review only',
            result: 'no-change',
            timestamp: '2030-01-15T18:00:00.000Z',
          },
        ]}
      />
    </section>
  );
};

const OperationView = ({
  locale,
  onNavigate,
  operation,
}: {
  readonly locale: ShellLocale;
  readonly onNavigate?: ImproveSurfaceProps['onNavigate'];
  readonly operation: TechnicalOperation;
}) => (
  <section
    aria-labelledby="improve-operation-title"
    data-eligibility={operation.eligibility}
    data-lb-region
  >
    <h2 id="improve-operation-title">
      {localized({ en: 'Operation detail', 'pt-BR': 'Detalhe da operação' }, locale)}
    </h2>
    <OperationInspector operation={operation.name}>
      <dl>
        <dt>{localized({ en: 'Purpose', 'pt-BR': 'Objetivo' }, locale)}</dt>
        <dd>{operation.purpose}</dd>
        <dt>{localized({ en: 'Expected direction', 'pt-BR': 'Direção esperada' }, locale)}</dt>
        <dd>{operation.expectedDirection}</dd>
        <dt>{localized({ en: 'Risk', 'pt-BR': 'Risco' }, locale)}</dt>
        <dd>
          <RiskClass level={riskForDesignSystem(operation.riskClass)} />
        </dd>
        <dt>{localized({ en: 'Evidence', 'pt-BR': 'Evidência' }, locale)}</dt>
        <dd>{operation.evidence}</dd>
        <dt>{localized({ en: 'Compatibility', 'pt-BR': 'Compatibilidade' }, locale)}</dt>
        <dd>{operation.compatibility}</dd>
        <dt>{localized({ en: 'Restart effect', 'pt-BR': 'Efeito de reinicialização' }, locale)}</dt>
        <dd>{operation.restartEffect}</dd>
        <dt>{localized({ en: 'Previous value', 'pt-BR': 'Valor anterior' }, locale)}</dt>
        <dd>{operation.previousValue}</dd>
        <dt>{localized({ en: 'Recovery method', 'pt-BR': 'Método de recuperação' }, locale)}</dt>
        <dd>{operation.recoveryMethod}</dd>
        <dt>{localized({ en: 'Provenance', 'pt-BR': 'Proveniência' }, locale)}</dt>
        <dd>
          <ProvenanceMark detail="SIMULATED SCENARIO" kind={operation.provenance} locale={locale} />
        </dd>
      </dl>
      <QualityMark locale={locale} quality={operation.evidenceQuality} />
      {operation.eligibility === 'excluded' ? (
        <StatusSignal
          detail={operation.exclusionReason ?? operation.compatibility}
          locale={locale}
          state="unsupported"
        />
      ) : (
        <LbButton onPress={() => onNavigate?.('plan-review', operation.id)} variant="primary">
          {operation.eligibility === 'review-required'
            ? localized(
                { en: 'Open full Advanced review', 'pt-BR': 'Abrir revisão Avançada completa' },
                locale,
              )
            : localized(
                { en: 'Add to preview plan', 'pt-BR': 'Adicionar ao plano de prévia' },
                locale,
              )}
        </LbButton>
      )}
    </OperationInspector>
  </section>
);

const PlanReviewView = ({
  locale,
  onNavigate,
  onRiskPolicyChange,
}: {
  readonly locale: ShellLocale;
  readonly onNavigate?: ImproveSurfaceProps['onNavigate'];
  readonly onRiskPolicyChange?: ImproveSurfaceProps['onRiskPolicyChange'];
}) => (
  <section aria-labelledby="improve-plan-title" data-critical-path="complete" data-lb-region>
    <h2 id="improve-plan-title">
      {localized(
        { en: 'Golden recommendation review', 'pt-BR': 'Revisão da recomendação principal' },
        locale,
      )}
    </h2>
    <p>
      {localized(
        {
          en: 'One Verified operation is ready, one Advanced operation needs full review, and one option is excluded fail-closed.',
          'pt-BR':
            'Uma operação Verificada está pronta, uma Avançada exige revisão e uma opção está excluída de forma segura.',
        },
        locale,
      )}
    </p>
    <LbRadioGroup
      label={localized({ en: 'Global risk policy', 'pt-BR': 'Política global de risco' }, locale)}
      onChange={(risk) => {
        if ((IMPROVE_RISK_POLICIES as readonly string[]).includes(risk)) {
          onRiskPolicyChange?.(risk as OperationRisk);
        }
      }}
      options={IMPROVE_RISK_POLICIES.map((risk) => ({
        label: risk.charAt(0).toUpperCase() + risk.slice(1),
        value: risk,
      }))}
      value="verified"
    />
    {GOLDEN_OPERATIONS.map((operation) => (
      <article data-eligibility={operation.eligibility} key={operation.id}>
        <OperationRow
          detail={exclusionReasonFor(operation) ?? operation.expectedDirection}
          name={operation.name}
          onInspect={() => onNavigate?.('operation', operation.id)}
          risk={riskForDesignSystem(operation.riskClass)}
        />
        <QualityMark locale={locale} quality={operation.evidenceQuality} />
      </article>
    ))}
    <PlanDependencyList
      dependencies={[
        { id: 'inventory', label: 'Trusted scenario inventory', state: 'complete' },
        { id: 'recovery', label: 'No-effect recovery checkpoint', state: 'ready' },
        { id: 'driver', label: 'GPU driver source', state: 'blocked' },
      ]}
    />
    <p>
      {localized(
        {
          en: 'Expected impact is directional and evidence-bound. No gain is guaranteed.',
          'pt-BR':
            'O impacto esperado é direcional e limitado pela evidência. Nenhum ganho é garantido.',
        },
        locale,
      )}
    </p>
    <LbButton onPress={() => onNavigate?.('confirmation')} variant="primary">
      {localized(
        { en: 'Review preview confirmation', 'pt-BR': 'Revisar confirmação da prévia' },
        locale,
      )}
    </LbButton>
  </section>
);

const ConfirmationView = ({
  locale,
  onNavigate,
  scenarioId,
}: {
  readonly locale: ShellLocale;
  readonly onNavigate?: ImproveSurfaceProps['onNavigate'];
  readonly scenarioId: string;
}) => {
  const boundary = createBoundary(scenarioId, locale, 'Privileged plan execution', 'Phase 6');

  return (
    <section aria-labelledby="improve-confirm-title" data-critical-path="complete" data-lb-region>
      <h2 id="improve-confirm-title">
        {localized({ en: 'Preview confirmation', 'pt-BR': 'Confirmação da prévia' }, locale)}
      </h2>
      <RiskGate
        explanation={localized(
          {
            en: 'Advanced review names dependencies, interruption risk, and exact recovery before any future request.',
            'pt-BR':
              'A revisão Avançada informa dependências, risco de interrupção e recuperação antes de qualquer solicitação futura.',
          },
          locale,
        )}
        risk="advanced"
        snapshotReady
      >
        <p>
          {localized(
            {
              en: 'This Phase 2 action creates only a no-change scenario receipt.',
              'pt-BR': 'Esta ação da Fase 2 cria apenas um recibo de cenário sem alterações.',
            },
            locale,
          )}
        </p>
        <LbButton onPress={() => onNavigate?.('no-change-receipt')} variant="primary">
          {localized(
            { en: 'Complete no-change preview', 'pt-BR': 'Concluir prévia sem alterações' },
            locale,
          )}
        </LbButton>
      </RiskGate>
      <aside aria-label="Phase boundary">
        <strong>{boundary.capability}</strong>
        <p>{boundary.explanation}</p>
        <p>{boundary.owningPhase}</p>
      </aside>
    </section>
  );
};

const RestartView = ({ locale }: { readonly locale: ShellLocale }) => (
  <RestartPlanner>
    <p>
      {localized(
        {
          en: 'The scenario explains restart implications, but no restart is scheduled by this preview.',
          'pt-BR':
            'O cenário explica a reinicialização, mas nenhuma reinicialização é agendada pela prévia.',
        },
        locale,
      )}
    </p>
  </RestartPlanner>
);

const RecoveryHistoryView = ({ locale }: { readonly locale: ShellLocale }) => (
  <section aria-labelledby="improve-recovery-title" data-lb-region>
    <h2 id="improve-recovery-title">
      {localized({ en: 'Recovery history', 'pt-BR': 'Histórico de recuperação' }, locale)}
    </h2>
    <ChangeLedger
      entries={[
        {
          id: 'review-started',
          change: localized(
            { en: 'Golden plan reviewed', 'pt-BR': 'Plano principal revisado' },
            locale,
          ),
          result: 'no-change',
          timestamp: '2030-01-15T18:10:00.000Z',
        },
        {
          id: 'preview-complete',
          change: localized(
            { en: 'No-effect preview verified', 'pt-BR': 'Prévia sem efeito verificada' },
            locale,
          ),
          result: 'no-change',
          timestamp: '2030-01-15T18:12:00.000Z',
        },
      ]}
    />
  </section>
);

const NoChangeReceiptView = ({
  locale,
  scenarioId,
}: {
  readonly locale: ShellLocale;
  readonly scenarioId: string;
}) => (
  <section aria-labelledby="improve-receipt-title" data-lb-region>
    <h2 id="improve-receipt-title">
      {localized({ en: 'Preview result', 'pt-BR': 'Resultado da prévia' }, locale)}
    </h2>
    <VerificationReceipt
      detail={localized(
        {
          en: 'Preview complete — no changes were made to this PC. The Verified and Advanced requests were reviewed; the excluded operation remained blocked.',
          'pt-BR':
            'Prévia concluída — nenhuma alteração foi feita neste PC. As solicitações Verificada e Avançada foram revisadas; a operação excluída permaneceu bloqueada.',
        },
        locale,
      )}
      receiptId={`${scenarioId}-IMPROVE-NO-CHANGE`}
    />
  </section>
);

export const ImproveSurface = ({
  locale,
  onNavigate,
  onRiskPolicyChange,
  scenarioId,
  selectedComponent = 'cpu-power',
  selectedGoal = 'performance',
  selectedOperationId,
  view,
}: ImproveSurfaceProps) => {
  const operation = operationById(selectedOperationId);

  return (
    <main
      aria-label={localized({ en: 'Improve workspace', 'pt-BR': 'Área de melhoria' }, locale)}
      data-improve-view={view}
      data-locale={locale}
      data-scenario-id={scenarioId}
    >
      <ScenarioMarker scenarioId={scenarioId} />
      <RouteHeader
        breadcrumbs={[
          { label: localized({ en: 'Improve', 'pt-BR': 'Melhorar' }, locale) },
          { label: view },
        ]}
        purpose={localized(
          {
            en: 'Choose a performance goal and review every recommended adjustment before applying it.',
            'pt-BR':
              'Escolha um objetivo de desempenho e revise cada ajuste recomendado antes de aplicar.',
          },
          locale,
        )}
        title={localized({ en: 'Optimization', 'pt-BR': 'Otimização' }, locale)}
      />

      {view === 'goals' ? (
        <GoalsView locale={locale} onNavigate={onNavigate} selectedGoal={selectedGoal} />
      ) : null}
      {view === 'component' ? (
        <ComponentView component={selectedComponent} locale={locale} onNavigate={onNavigate} />
      ) : null}
      {view === 'operation' ? (
        <OperationView locale={locale} onNavigate={onNavigate} operation={operation} />
      ) : null}
      {view === 'plan-review' ? (
        <PlanReviewView
          locale={locale}
          onNavigate={onNavigate}
          onRiskPolicyChange={onRiskPolicyChange}
        />
      ) : null}
      {view === 'confirmation' ? (
        <ConfirmationView locale={locale} onNavigate={onNavigate} scenarioId={scenarioId} />
      ) : null}
      {view === 'restart' ? <RestartView locale={locale} /> : null}
      {view === 'recovery-history' ? <RecoveryHistoryView locale={locale} /> : null}
      {view === 'no-change-receipt' ? (
        <NoChangeReceiptView locale={locale} scenarioId={scenarioId} />
      ) : null}
    </main>
  );
};
