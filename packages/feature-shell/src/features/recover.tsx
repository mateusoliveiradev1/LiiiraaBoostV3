import {
  ChangeLedger,
  LbButton,
  RecoveryCheckpoint,
  RouteHeader,
  ScenarioMarker,
  SystemStateLedger,
  VerificationReceipt,
} from '@liiiraa/design-system';
import { useState } from 'react';

import { createPhaseBoundaryExplanation } from '../model/interaction-policy.js';
import type { ShellLocale } from './calibration.js';

export const RECOVER_VIEWS = Object.freeze([
  'overview',
  'ledger',
  'snapshots',
  'restore-point',
  'interrupted-plan',
  'emergency',
  'guided-recovery',
  'verified-receipt',
] as const);

export type RecoverView = (typeof RECOVER_VIEWS)[number];

const RECOVER_COPY: Readonly<
  Record<
    RecoverView,
    Readonly<{
      en: Readonly<{ detail: string; title: string }>;
      'pt-BR': Readonly<{ detail: string; title: string }>;
    }>
  >
> = Object.freeze({
  overview: {
    en: {
      detail: 'Inspect recovery readiness without creating or restoring system state.',
      title: 'Recovery readiness',
    },
    'pt-BR': {
      detail: 'Revise pontos de segurança, histórico e opções de restauração do sistema.',
      title: 'Recuperação',
    },
  },
  ledger: {
    en: {
      detail: 'Review the append-oriented scenario ledger and exact correlation identifiers.',
      title: 'Change ledger',
    },
    'pt-BR': {
      detail: 'Revise o livro de cenário append-only e identificadores exatos de correlação.',
      title: 'Livro de alterações',
    },
  },
  snapshots: {
    en: {
      detail: 'Compare full-plan, individual-operation, and benign preference snapshots.',
      title: 'Snapshots',
    },
    'pt-BR': {
      detail: 'Compare snapshots de plano completo, operação individual e preferências benignas.',
      title: 'Snapshots',
    },
  },
  'restore-point': {
    en: {
      detail: 'Windows restore-point creation is previewed only; this phase creates nothing.',
      title: 'Restore-point supplement',
    },
    'pt-BR': {
      detail: 'A criação de ponto de restauração é somente prévia; esta fase não cria nada.',
      title: 'Suplemento de ponto de restauração',
    },
  },
  'interrupted-plan': {
    en: {
      detail: 'Resume the preserved review context after a simulated interruption.',
      title: 'Interrupted plan',
    },
    'pt-BR': {
      detail: 'Retome o contexto de revisão preservado após uma interrupção simulada.',
      title: 'Plano interrompido',
    },
  },
  emergency: {
    en: {
      detail: 'Emergency recovery remains visible, but no process, service, or setting is touched.',
      title: 'Emergency recovery',
    },
    'pt-BR': {
      detail:
        'A recuperação de emergência segue visível, mas nenhum processo, serviço ou ajuste é tocado.',
      title: 'Recuperação de emergência',
    },
  },
  'guided-recovery': {
    en: {
      detail: 'Verify dependencies, prior scenario state, affected set, and safe continuation.',
      title: 'Guided recovery',
    },
    'pt-BR': {
      detail: 'Verifique dependências, estado anterior, conjunto afetado e continuação segura.',
      title: 'Recuperação guiada',
    },
  },
  'verified-receipt': {
    en: {
      detail:
        'Recovery path verified in the demonstration — no rollback or system change occurred.',
      title: 'Verified recovery receipt',
    },
    'pt-BR': {
      detail:
        'Caminho de recuperação verificado na demonstração — nenhuma reversão ou mudança ocorreu.',
      title: 'Recibo de recuperação verificado',
    },
  },
});

const nextRecoverView = (view: RecoverView): RecoverView => {
  const index = RECOVER_VIEWS.indexOf(view);
  return RECOVER_VIEWS[Math.min(index + 1, RECOVER_VIEWS.length - 1)] ?? view;
};

export interface RecoverSurfaceProps {
  readonly locale: ShellLocale;
  readonly scenarioId: string;
  readonly view?: RecoverView;
}

export const RecoverSurface = ({ locale, scenarioId, view }: RecoverSurfaceProps) => {
  const [internalView, setInternalView] = useState<RecoverView>('overview');
  const activeView = view ?? internalView;
  const copy = RECOVER_COPY[activeView][locale];
  const boundary = createPhaseBoundaryExplanation({
    availableScenarioId: scenarioId,
    capability: 'Privileged rollback and restore-point creation',
    locale: locale === 'pt-BR' ? 'pt-BR' : 'en-US',
    owningPhase: 'Phase 6',
  });

  return (
    <main data-changed="false" data-recover-view={activeView}>
      <RouteHeader purpose={copy.detail} title={copy.title} />
      <ScenarioMarker scenarioId={scenarioId} />
      <p>{`DEMO · ${scenarioId}`}</p>

      {activeView === 'overview' ? (
        <>
          <section
            aria-label={locale === 'pt-BR' ? 'Resumo de proteção' : 'Protection summary'}
            className="lb-recovery-summary"
          >
            <div aria-hidden="true" className="lb-recovery-emblem">
              ✓
            </div>
            <div>
              <p className="lb-section-kicker">
                {locale === 'pt-BR' ? 'Estado do sistema' : 'System state'}
              </p>
              <h2>{locale === 'pt-BR' ? 'Proteção preparada' : 'Protection ready'}</h2>
              <p>
                {locale === 'pt-BR'
                  ? 'O histórico simulado e o snapshot de recuperação estão íntegros para revisão.'
                  : 'The simulated history and recovery snapshot are intact for review.'}
              </p>
            </div>
            <dl>
              <div>
                <dt>{locale === 'pt-BR' ? 'Alterações' : 'Changes'}</dt>
                <dd>0</dd>
              </div>
              <div>
                <dt>Snapshots</dt>
                <dd>2</dd>
              </div>
              <div>
                <dt>{locale === 'pt-BR' ? 'Última verificação' : 'Last check'}</dt>
                <dd>{locale === 'pt-BR' ? 'Agora' : 'Now'}</dd>
              </div>
            </dl>
          </section>
          <SystemStateLedger
            entries={[
              {
                detail:
                  locale === 'pt-BR'
                    ? 'O registro do cenário está disponível.'
                    : 'Scenario ledger is available.',
                id: 'ledger',
                label: locale === 'pt-BR' ? 'Registro de alterações' : 'Change ledger',
                state: 'fixture',
              },
              {
                detail:
                  locale === 'pt-BR'
                    ? 'Os metadados simulados do snapshot estão prontos para revisão.'
                    : 'Synthetic snapshot metadata is ready for review.',
                id: 'snapshot',
                label: locale === 'pt-BR' ? 'Snapshot de recuperação' : 'Recovery snapshot',
                state: 'fixture',
              },
              {
                detail:
                  locale === 'pt-BR'
                    ? 'A autorização privilegiada de recuperação não está disponível na Fase 2.'
                    : 'Privileged recovery authority is unavailable in Phase 2.',
                id: 'authority',
                label: locale === 'pt-BR' ? 'Autorização de recuperação' : 'Recovery authority',
                state: 'unsupported',
              },
            ]}
            locale={locale}
          />
        </>
      ) : null}

      {activeView === 'ledger' ? (
        <ChangeLedger
          entries={[
            {
              change:
                locale === 'pt-BR'
                  ? 'Revisão aberta. Nenhuma operação do sistema foi solicitada.'
                  : 'Review opened. No system operation requested.',
              id: `${scenarioId}-RECOVER-REVIEW`,
              result: 'no-change',
              timestamp: '2030-01-15T18:00:00.000Z',
            },
            {
              change:
                locale === 'pt-BR'
                  ? 'Recibo da prévia adicionado. O PC permanece sem alterações.'
                  : 'Preview receipt appended. PC remains unchanged.',
              id: `${scenarioId}-PREVIEW-NO-CHANGE`,
              result: 'no-change',
              timestamp: '2030-01-15T18:00:01.000Z',
            },
          ]}
          locale={locale}
        />
      ) : null}

      {activeView === 'snapshots' ? (
        <section aria-labelledby="snapshot-title" data-lb-region>
          <h2 id="snapshot-title">
            {locale === 'pt-BR' ? 'Snapshots disponíveis' : 'Available snapshots'}
          </h2>
          <dl>
            <div>
              <dt>{locale === 'pt-BR' ? 'Plano completo' : 'Full plan'}</dt>
              <dd>fixture://S17/full-plan/v1</dd>
            </div>
            <div>
              <dt>{locale === 'pt-BR' ? 'Operação individual' : 'Individual operation'}</dt>
              <dd>fixture://S17/operation/power-policy/v1</dd>
            </div>
          </dl>
        </section>
      ) : null}

      {activeView === 'restore-point' || activeView === 'emergency' ? (
        <aside aria-label="Phase boundary" data-boundary-kind={boundary.kind}>
          <h2>{boundary.capability}</h2>
          <p>{boundary.explanation}</p>
          <p>
            {locale === 'pt-BR'
              ? `Capacidade: indisponível · responsável: ${boundary.owningPhase} · demonstração: ${boundary.availableScenarioId} · documentação: recuperação segura.`
              : `Capability: unavailable · owner: ${boundary.owningPhase} · demonstration: ${boundary.availableScenarioId} · documentation: safe recovery.`}
          </p>
        </aside>
      ) : null}

      {activeView === 'interrupted-plan' || activeView === 'guided-recovery' ? (
        <RecoveryCheckpoint detail={copy.detail} locale={locale} title={copy.title} />
      ) : null}

      {activeView === 'verified-receipt' ? (
        <VerificationReceipt
          detail={copy.detail}
          locale={locale}
          receiptId={`${scenarioId}-RECOVERY-VERIFIED-NO-CHANGE`}
        />
      ) : null}

      {activeView !== 'verified-receipt' ? (
        <LbButton
          onPress={() => {
            setInternalView(nextRecoverView(activeView));
          }}
          variant="primary"
        >
          {locale === 'pt-BR' ? 'Continuar revisão de recuperação' : 'Continue recovery review'}
        </LbButton>
      ) : null}
    </main>
  );
};
