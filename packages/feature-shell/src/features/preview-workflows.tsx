import {
  ChangeLedger,
  LbButton,
  LbTextField,
  RecoveryCheckpoint,
  RestartPlanner,
  RiskClass,
  RouteHeader,
  ScenarioMarker,
  VerificationReceipt,
} from '@liiiraa/design-system';
import { useState } from 'react';

import {
  createNoChangeReceipt,
  createPhaseBoundaryExplanation,
  type NoChangeReceiptResult,
} from '../model/interaction-policy.js';
import type { ShellLocale } from './calibration.js';

export const PREVIEW_WORKFLOW_STATES = Object.freeze([
  'review',
  'validating',
  'ready',
  'confirming',
  'previewing',
  'verifying',
  'preview-complete',
  'partial-failure',
  'dependency-diagnostic',
  'restart-pending',
  'restart-continuation',
  'paused',
  'guided-recovery',
  'verified',
] as const);

export type PreviewWorkflowState = (typeof PREVIEW_WORKFLOW_STATES)[number];

export const PREVIEW_WORKFLOW_EVENTS = Object.freeze([
  'VALIDATE',
  'VALID',
  'REVIEW_CONFIRMATION',
  'CONFIRM',
  'PREVIEW',
  'FAIL',
  'DIAGNOSE',
  'RESTART',
  'PAUSE',
  'RECOVER',
  'CONTINUE',
  'VERIFIED',
] as const);

export type PreviewWorkflowEvent = (typeof PREVIEW_WORKFLOW_EVENTS)[number];

export const PREVIEW_RISK_LEVELS = Object.freeze([
  'verified',
  'advanced',
  'experimental',
  'extreme',
] as const);

export type PreviewRiskLevel = (typeof PREVIEW_RISK_LEVELS)[number];

const EXTREME_CONFIRMATION_PHRASE = 'EU ENTENDO QUE ESTA É APENAS UMA PRÉVIA';

const TRANSITIONS: Readonly<
  Record<PreviewWorkflowState, Partial<Record<PreviewWorkflowEvent, PreviewWorkflowState>>>
> = Object.freeze({
  review: Object.freeze({ VALIDATE: 'validating' }),
  validating: Object.freeze({ VALID: 'ready', FAIL: 'partial-failure' }),
  ready: Object.freeze({
    REVIEW_CONFIRMATION: 'confirming',
    RESTART: 'restart-pending',
  }),
  confirming: Object.freeze({ CONFIRM: 'previewing' }),
  previewing: Object.freeze({ PREVIEW: 'verifying', PAUSE: 'paused' }),
  verifying: Object.freeze({ VERIFIED: 'preview-complete', FAIL: 'partial-failure' }),
  'preview-complete': Object.freeze({}),
  'partial-failure': Object.freeze({ DIAGNOSE: 'dependency-diagnostic' }),
  'dependency-diagnostic': Object.freeze({ RECOVER: 'guided-recovery' }),
  'restart-pending': Object.freeze({ CONTINUE: 'restart-continuation' }),
  'restart-continuation': Object.freeze({ REVIEW_CONFIRMATION: 'confirming' }),
  paused: Object.freeze({ CONTINUE: 'previewing', RECOVER: 'guided-recovery' }),
  'guided-recovery': Object.freeze({ VERIFIED: 'verified' }),
  verified: Object.freeze({ CONTINUE: 'review' }),
});

export const advancePreviewWorkflow = (
  state: PreviewWorkflowState,
  event: PreviewWorkflowEvent,
): PreviewWorkflowState => TRANSITIONS[state][event] ?? state;

interface PreviewReceiptInput {
  readonly createdAt: string;
  readonly locale: ShellLocale;
  readonly requestedOperations: readonly string[];
  readonly scenarioId: string;
}

export const createPreviewWorkflowReceipt = (
  input: PreviewReceiptInput,
): Readonly<NoChangeReceiptResult> =>
  createNoChangeReceipt({
    correlationId: `${input.scenarioId}-PREVIEW-NO-CHANGE`,
    createdAt: input.createdAt,
    locale: input.locale === 'pt-BR' ? 'pt-BR' : 'en-US',
    requestedOperations: input.requestedOperations,
    scenarioId: input.scenarioId,
  });

const REQUESTED_OPERATIONS = Object.freeze([
  'Review balanced game power policy',
  'Review adapter latency policy',
] as const);

const STATE_COPY: Readonly<
  Record<PreviewWorkflowState, Readonly<{ en: string; 'pt-BR': string }>>
> = Object.freeze({
  review: {
    en: 'Review requested operations, evidence, dependencies, risk, and recovery.',
    'pt-BR': 'Revise operações solicitadas, evidências, dependências, risco e recuperação.',
  },
  validating: {
    en: 'Validating the scenario contract without contacting privileged authority.',
    'pt-BR': 'Validando o contrato do cenário sem contatar autoridade privilegiada.',
  },
  ready: {
    en: 'The no-effect preview is ready for proportional confirmation.',
    'pt-BR': 'A prévia sem efeito está pronta para confirmação proporcional.',
  },
  confirming: {
    en: 'Confirm only the local demonstration. No system change is authorized.',
    'pt-BR': 'Confirme somente a demonstração local. Nenhuma mudança é autorizada.',
  },
  previewing: {
    en: 'Composing requested operations locally. Nothing is being applied.',
    'pt-BR': 'Compondo operações solicitadas localmente. Nada está sendo aplicado.',
  },
  verifying: {
    en: 'Verifying the no-change receipt and Activity correlation.',
    'pt-BR': 'Verificando recibo sem alteração e correlação da Atividade.',
  },
  'preview-complete': {
    en: 'Preview complete — no changes made to this PC.',
    'pt-BR': 'Prévia concluída — nenhuma alteração foi feita neste PC.',
  },
  'partial-failure': {
    en: 'Preview paused: recovery readiness could not be validated.',
    'pt-BR': 'Prévia pausada: a prontidão de recuperação não pôde ser validada.',
  },
  'dependency-diagnostic': {
    en: 'Dependency diagnostic: the recovery snapshot source is unavailable.',
    'pt-BR': 'Diagnóstico de dependência: a origem do snapshot está indisponível.',
  },
  'restart-pending': {
    en: 'Restart would be required by a future operation; no restart is scheduled.',
    'pt-BR': 'Uma operação futura exigiria reinício; nenhum reinício foi agendado.',
  },
  'restart-continuation': {
    en: 'Restart continuation restored the review context without changing Windows.',
    'pt-BR': 'A continuação após reinício restaurou a revisão sem alterar o Windows.',
  },
  paused: {
    en: 'Preview paused with the requested operation list preserved.',
    'pt-BR': 'Prévia pausada com a lista de operações solicitadas preservada.',
  },
  'guided-recovery': {
    en: 'Guided recovery checks the scenario ledger; it performs no rollback.',
    'pt-BR': 'A recuperação guiada verifica o livro do cenário; não executa reversão.',
  },
  verified: {
    en: 'Recovery path verified in the demonstration; the PC remains unchanged.',
    'pt-BR': 'Caminho de recuperação verificado na demonstração; o PC segue inalterado.',
  },
});

const eventForState = (
  state: PreviewWorkflowState,
): Readonly<{ event: PreviewWorkflowEvent; label: string }> | null => {
  switch (state) {
    case 'review':
      return { event: 'VALIDATE', label: 'Validate preview' };
    case 'validating':
      return { event: 'VALID', label: 'Continue to confirmation review' };
    case 'ready':
      return { event: 'REVIEW_CONFIRMATION', label: 'Review confirmation' };
    case 'confirming':
      return { event: 'CONFIRM', label: 'Confirm no-effect preview' };
    case 'previewing':
      return { event: 'PREVIEW', label: 'Compose preview receipt' };
    case 'verifying':
      return { event: 'VERIFIED', label: 'Verify receipt' };
    case 'partial-failure':
      return { event: 'DIAGNOSE', label: 'Open dependency diagnostic' };
    case 'dependency-diagnostic':
      return { event: 'RECOVER', label: 'Open guided recovery' };
    case 'restart-pending':
      return { event: 'CONTINUE', label: 'Continue after restart preview' };
    case 'restart-continuation':
      return { event: 'REVIEW_CONFIRMATION', label: 'Return to confirmation' };
    case 'paused':
      return { event: 'RECOVER', label: 'Open guided recovery' };
    case 'guided-recovery':
      return { event: 'VERIFIED', label: 'Verify recovery path' };
    case 'verified':
      return { event: 'CONTINUE', label: 'Return to review' };
    case 'preview-complete':
      return null;
  }
};

export interface PreviewWorkflowSurfaceProps {
  readonly confirmationValue?: string;
  readonly locale: ShellLocale;
  readonly riskLevel?: PreviewRiskLevel;
  readonly scenarioId: string;
  readonly state?: PreviewWorkflowState;
}

export const PreviewWorkflowSurface = ({
  confirmationValue,
  locale,
  riskLevel = 'verified',
  scenarioId,
  state,
}: PreviewWorkflowSurfaceProps) => {
  const [internalState, setInternalState] = useState<PreviewWorkflowState>('review');
  const [internalConfirmation, setInternalConfirmation] = useState('');
  const activeState = state ?? internalState;
  const phraseValue = confirmationValue ?? internalConfirmation;
  const next = eventForState(activeState);
  const receipt = createPreviewWorkflowReceipt({
    createdAt: '2030-01-15T18:00:00.000Z',
    locale,
    requestedOperations: REQUESTED_OPERATIONS,
    scenarioId,
  });
  const boundary = createPhaseBoundaryExplanation({
    availableScenarioId: scenarioId,
    capability: 'Privileged optimization engine',
    locale: locale === 'pt-BR' ? 'pt-BR' : 'en-US',
    owningPhase: 'Phase 6',
  });
  const extremeBlocked =
    activeState === 'confirming' &&
    riskLevel === 'extreme' &&
    phraseValue !== EXTREME_CONFIRMATION_PHRASE;

  return (
    <main data-changed="false" data-preview-state={activeState} data-risk-level={riskLevel}>
      <RouteHeader
        purpose={STATE_COPY[activeState][locale]}
        title={locale === 'pt-BR' ? 'Prévia de plano' : 'Plan preview'}
      />
      <ScenarioMarker scenarioId={scenarioId} />
      <p>
        {locale === 'pt-BR'
          ? 'DEMO · nenhuma autoridade privilegiada conectada'
          : 'DEMO · no privileged authority connected'}
      </p>

      <section aria-labelledby="preview-request-title" data-lb-region>
        <h2 id="preview-request-title">
          {locale === 'pt-BR' ? 'Operações solicitadas' : 'Requested operations'}
        </h2>
        <ol>
          {receipt.receipt.requestedOperations.map((operation) => (
            <li key={operation}>{operation}</li>
          ))}
        </ol>
        <RiskClass level={riskLevel} />
      </section>

      {activeState === 'confirming' && riskLevel === 'extreme' ? (
        <section aria-label="Extreme preview confirmation" data-lb-region>
          <p>
            {locale === 'pt-BR'
              ? `Digite ${EXTREME_CONFIRMATION_PHRASE} exatamente.`
              : `Enter ${EXTREME_CONFIRMATION_PHRASE} exactly.`}
          </p>
          <LbTextField
            label={locale === 'pt-BR' ? 'Frase de confirmação' : 'Confirmation phrase'}
            onChange={setInternalConfirmation}
            value={phraseValue}
          />
        </section>
      ) : null}

      {activeState === 'restart-pending' || activeState === 'restart-continuation' ? (
        <RestartPlanner locale={locale}>
          <p>
            {locale === 'pt-BR'
              ? 'O agendamento real pertence à Fase 6.'
              : 'Real scheduling belongs to Phase 6.'}
          </p>
        </RestartPlanner>
      ) : null}

      {activeState === 'partial-failure' || activeState === 'dependency-diagnostic' ? (
        <section aria-live="assertive" data-lb-region role="alert">
          <h2>{locale === 'pt-BR' ? 'Falha parcial' : 'Partial failure'}</h2>
          <p>{STATE_COPY[activeState][locale]}</p>
          <code>S15-RECOVERY-SOURCE-UNAVAILABLE</code>
        </section>
      ) : null}

      {activeState === 'guided-recovery' || activeState === 'verified' ? (
        <RecoveryCheckpoint
          detail={STATE_COPY[activeState][locale]}
          locale={locale}
          title={locale === 'pt-BR' ? 'Recuperação guiada' : 'Guided recovery'}
        />
      ) : null}

      {activeState === 'preview-complete' ? (
        <>
          <VerificationReceipt
            detail={receipt.receipt.summary}
            locale={locale}
            receiptId={receipt.activity.correlationId}
          />
          <ChangeLedger
            entries={[
              {
                change: receipt.receipt.summary,
                id: receipt.activity.correlationId,
                result: 'no-change',
                timestamp: '2030-01-15T18:00:00.000Z',
              },
            ]}
            locale={locale}
          />
        </>
      ) : null}

      {next ? (
        <LbButton
          isDisabled={extremeBlocked}
          onPress={() => {
            setInternalState(advancePreviewWorkflow(activeState, next.event));
          }}
          variant={activeState === 'confirming' ? 'destructive' : 'primary'}
        >
          {next.label}
        </LbButton>
      ) : null}

      <aside aria-label="Phase boundary" data-boundary-kind={boundary.kind}>
        <h2>{boundary.capability}</h2>
        <p>{boundary.explanation}</p>
        <p>
          {locale === 'pt-BR'
            ? `Demonstração disponível: ${boundary.availableScenarioId}. Consulte a documentação de segurança.`
            : `Available demonstration: ${boundary.availableScenarioId}. See the security documentation.`}
        </p>
      </aside>
    </main>
  );
};
