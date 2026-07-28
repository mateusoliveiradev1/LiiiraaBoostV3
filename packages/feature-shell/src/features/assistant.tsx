import {
  ChangeLedger,
  LbButton,
  LbTextArea,
  RouteHeader,
  ScenarioMarker,
  StatusSignal,
} from '@liiiraa/design-system';
import { useState } from 'react';

import { createPhaseBoundaryExplanation } from '../model/interaction-policy.js';
import type { ShellLocale } from './calibration.js';

export const ASSISTANT_VIEWS = Object.freeze([
  'local',
  'cloud-denied',
  'proposal',
  'policy-rejected',
  'offline',
  'history',
  'delete-confirmation',
] as const);

export type AssistantView = (typeof ASSISTANT_VIEWS)[number];

const ASSISTANT_COPY: Readonly<Record<AssistantView, Readonly<{ en: string; 'pt-BR': string }>>> =
  Object.freeze({
    local: {
      en: 'Local guidance uses only synthetic scenario context and never contacts cloud AI.',
      'pt-BR':
        'A orientação local usa somente contexto sintético do cenário e nunca contata IA em nuvem.',
    },
    'cloud-denied': {
      en: 'Cloud AI consent is off. The prompt remains local and preserved.',
      'pt-BR': 'O consentimento de IA em nuvem está desligado. O texto segue local e preservado.',
    },
    proposal: {
      en: 'A typed proposal is ready for review. It cannot execute an operation.',
      'pt-BR': 'Uma proposta tipada está pronta para revisão. Ela não pode executar uma operação.',
    },
    'policy-rejected': {
      en: 'Policy rejected the proposal because required recovery evidence is unavailable.',
      'pt-BR':
        'A política rejeitou a proposta porque a evidência de recuperação necessária está indisponível.',
    },
    offline: {
      en: 'Offline mode can explain local documentation but cannot request connected answers.',
      'pt-BR':
        'O modo offline pode explicar documentação local, mas não solicita respostas conectadas.',
    },
    history: {
      en: 'Encrypted local demonstration history is available. Sync remains off.',
      'pt-BR': 'O histórico local demonstrativo está disponível. A sincronização segue desligada.',
    },
    'delete-confirmation': {
      en: 'Confirm deletion of local demonstration history. Cloud history is not implied.',
      'pt-BR':
        'Confirme a exclusão do histórico demonstrativo local. Nenhum histórico em nuvem é presumido.',
    },
  });

export interface AssistantSurfaceProps {
  readonly locale: ShellLocale;
  readonly scenarioId: string;
  readonly view?: AssistantView;
}

export const AssistantSurface = ({ locale, scenarioId, view }: AssistantSurfaceProps) => {
  const [internalView, setInternalView] = useState<AssistantView>('local');
  const [prompt, setPrompt] = useState('');
  const [validationAttempted, setValidationAttempted] = useState(false);
  const activeView = view ?? internalView;
  const boundary = createPhaseBoundaryExplanation({
    availableScenarioId: scenarioId,
    capability: 'Connected cloud-AI response',
    locale: locale === 'pt-BR' ? 'pt-BR' : 'en-US',
    owningPhase: 'Phase 9',
  });
  const promptIsValid = prompt.trim().length >= 8;

  return (
    <main data-assistant-view={activeView} data-cloud-consent="false">
      <RouteHeader
        purpose={ASSISTANT_COPY[activeView][locale]}
        title={locale === 'pt-BR' ? 'Assistente' : 'Assistant'}
      />
      <ScenarioMarker scenarioId={scenarioId} />
      <p>{`DEMO · ${scenarioId} · LOCAL-FIRST`}</p>

      <LbTextArea
        description={
          locale === 'pt-BR'
            ? 'O texto fica neste componente até você revisar uma proposta.'
            : 'Text stays in this component until you review a proposal.'
        }
        errorMessage={
          validationAttempted && !promptIsValid
            ? locale === 'pt-BR'
              ? 'Descreva a dúvida em pelo menos 8 caracteres.'
              : 'Describe the question using at least 8 characters.'
            : undefined
        }
        label={locale === 'pt-BR' ? 'Pergunta local' : 'Local question'}
        onChange={setPrompt}
        value={prompt}
      />

      {activeView === 'local' ? (
        <LbButton
          onPress={() => {
            setValidationAttempted(true);
            if (promptIsValid) setInternalView('proposal');
          }}
          variant="primary"
        >
          {locale === 'pt-BR' ? 'Criar proposta local' : 'Create local proposal'}
        </LbButton>
      ) : null}

      {activeView === 'cloud-denied' || activeView === 'offline' ? (
        <aside aria-label="Cloud AI boundary" data-boundary-kind={boundary.kind}>
          <h2>{boundary.capability}</h2>
          <p>{boundary.explanation}</p>
          <p>
            {locale === 'pt-BR'
              ? `Responsável: ${boundary.owningPhase} · demonstração: ${boundary.availableScenarioId} · documentação local disponível · consentimento continua desligado.`
              : `Owner: ${boundary.owningPhase} · demonstration: ${boundary.availableScenarioId} · local documentation available · consent remains off.`}
          </p>
        </aside>
      ) : null}

      {activeView === 'proposal' ? (
        <section aria-labelledby="assistant-proposal-title" data-lb-region>
          <h2 id="assistant-proposal-title">
            {locale === 'pt-BR' ? 'Proposta tipada' : 'Typed proposal'}
          </h2>
          <dl>
            <div>
              <dt>{locale === 'pt-BR' ? 'Objetivo' : 'Goal'}</dt>
              <dd>
                {locale === 'pt-BR' ? 'Estabilidade antes da sessão' : 'Pre-session stability'}
              </dd>
            </div>
            <div>
              <dt>{locale === 'pt-BR' ? 'Limite' : 'Boundary'}</dt>
              <dd>
                {locale === 'pt-BR'
                  ? 'Somente revisão; nenhuma autoridade de execução'
                  : 'Review only; no execution authority'}
              </dd>
            </div>
          </dl>
          <LbButton
            onPress={() => {
              setInternalView('policy-rejected');
            }}
            variant="primary"
          >
            {locale === 'pt-BR' ? 'Revisar proposta' : 'Review proposal'}
          </LbButton>
        </section>
      ) : null}

      {activeView === 'policy-rejected' ? (
        <section aria-live="assertive" data-lb-region role="alert">
          <h2>{locale === 'pt-BR' ? 'Proposta rejeitada' : 'Proposal rejected'}</h2>
          <StatusSignal
            detail={ASSISTANT_COPY['policy-rejected'][locale]}
            locale={locale}
            state="contradictory-evidence"
          />
          <code>S19-POLICY-RECOVERY-EVIDENCE-REQUIRED</code>
        </section>
      ) : null}

      {activeView === 'history' || activeView === 'delete-confirmation' ? (
        <section aria-labelledby="assistant-history-title" data-lb-region>
          <h2 id="assistant-history-title">
            {locale === 'pt-BR' ? 'Histórico local' : 'Local history'}
          </h2>
          <ChangeLedger
            entries={[
              {
                change: 'Local scenario explanation reviewed',
                id: `${scenarioId}-ASSISTANT-LOCAL`,
                result: 'no-change',
                timestamp: '2030-01-15T18:00:00.000Z',
              },
            ]}
          />
          {activeView === 'history' ? (
            <LbButton
              onPress={() => {
                setInternalView('delete-confirmation');
              }}
              variant="destructive"
            >
              {locale === 'pt-BR' ? 'Revisar exclusão' : 'Review deletion'}
            </LbButton>
          ) : (
            <LbButton
              onPress={() => {
                setInternalView('local');
              }}
              variant="destructive"
            >
              {locale === 'pt-BR' ? 'Excluir histórico local' : 'Delete local history'}
            </LbButton>
          )}
        </section>
      ) : null}

      <p aria-live="polite">
        {locale === 'pt-BR'
          ? 'O Assistente nunca oferece Executar.'
          : 'Assistant never offers Execute.'}
      </p>
    </main>
  );
};
