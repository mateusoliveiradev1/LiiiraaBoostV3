import {
  ChangeLedger,
  ExecutionTimeline,
  LbButton,
  LbPanel,
  ProductIcon,
  RecoveryCheckpoint,
  RecoveryTargetList,
  RouteHeader,
  ScenarioMarker,
  StateTripletDiff,
  StatusSignal,
  SystemStateLedger,
  VerifiedReceiptDetails,
  VerificationReceipt,
} from '@liiiraa/design-system';
import type {
  PlanOperationJson,
  TransactionReceiptDocumentJson,
  TransactionalRecoveryDocumentJson,
} from '@liiiraa/contracts-ts';
import type { PlanAuthority, PlanAuthoritySnapshot } from '@liiiraa/desktop-client';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

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
  readonly authority?: PlanAuthority;
  readonly locale: ShellLocale;
  readonly onKeepCurrentState?: (operationVersionId: string) => void;
  readonly scenarioId: string;
  readonly validatedDocuments?: readonly TransactionalRecoveryDocumentJson[];
  readonly view?: RecoverView;
}

type JournalEventDocument = Extract<TransactionalRecoveryDocumentJson, { kind: 'journal-event' }>;
type RecoveryCheckpointDocument = Extract<
  TransactionalRecoveryDocumentJson,
  { kind: 'recovery-checkpoint' }
>;

const recoveryLocalized = (
  copy: Readonly<{ en: string; 'pt-BR': string }>,
  locale: ShellLocale,
): string => copy[locale];

const recoveryExactState = (state: PlanOperationJson['previousValue']): string => {
  if (state.state === 'observed') {
    return `${state.schemeId} · ${state.canonicalStateHash}`;
  }
  return `${state.state}: ${state.reason}`;
};

const useRecoveryAuthoritySnapshot = (authority: PlanAuthority): PlanAuthoritySnapshot => {
  const subscribe = useCallback(
    (listener: Parameters<PlanAuthority['subscribe']>[0]) => authority.subscribe(listener),
    [authority],
  );
  const getSnapshot = useCallback(() => authority.snapshot(), [authority]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};

const latestJournalEvent = (
  documents: readonly TransactionalRecoveryDocumentJson[],
  transactionId: string | null,
): JournalEventDocument | undefined =>
  documents
    .filter(
      (document): document is JournalEventDocument =>
        document.kind === 'journal-event' && document.transactionId === transactionId,
    )
    .toSorted((left, right) => right.sequence - left.sequence)[0];

const recoveryTimeline = (snapshot: PlanAuthoritySnapshot, locale: ShellLocale) => {
  const state = snapshot.progress?.state ?? 'queued';
  const indexes = {
    applying: 1,
    'awaiting-restart': 2,
    blocked: 2,
    completed: 4,
    observing: 2,
    paused: 2,
    preparing: 0,
    queued: 0,
    recovering: 3,
    verifying: 3,
  } as const;
  const currentIndex = indexes[state];
  const labels =
    locale === 'pt-BR'
      ? [
          'Preparando recuperação',
          'Restaurando estado protegido',
          'Observando o Windows',
          'Verificando restauração',
          'Comprovante imutável',
        ]
      : [
          'Preparing recovery',
          'Restoring protected state',
          'Observing Windows',
          'Verifying restoration',
          'Immutable receipt',
        ];
  return {
    currentStageId: `recovery-stage-${String(currentIndex)}`,
    stages: labels.map((label, index) => ({
      id: `recovery-stage-${String(index)}`,
      label,
      state:
        index < currentIndex
          ? ('complete' as const)
          : index === currentIndex
            ? ('current' as const)
            : ('pending' as const),
      ...(index === currentIndex && snapshot.progress !== null
        ? { detail: snapshot.progress.displayText }
        : {}),
    })),
  };
};

const RecoveryReceipt = ({
  locale,
  receipt,
  snapshot,
}: {
  readonly locale: ShellLocale;
  readonly receipt: TransactionReceiptDocumentJson;
  readonly snapshot: PlanAuthoritySnapshot;
}) => (
  <VerifiedReceiptDetails
    details={{
      completedAt: receipt.completedAt,
      diagnosticIdentity: snapshot.diagnostic?.exportId ?? 'not-exported',
      journalCorrelation: receipt.journalHeadHash,
      observedState: recoveryExactState(receipt.exactObservedState),
      operationVersion: receipt.operationVersionId,
      priorState: recoveryExactState(receipt.exactPriorState),
      recoveryMethod: receipt.recoveryMethod,
      requestedState: recoveryExactState(receipt.exactRequestedState),
      startedAt: snapshot.transaction?.startedAt ?? receipt.completedAt,
      transactionId: receipt.transactionId,
    }}
    locale={locale}
    receiptId={receipt.receiptId}
    summary={receipt.humanSummary}
    verification={recoveryLocalized(
      {
        en: 'Observed restoration state verified',
        'pt-BR': 'Estado restaurado observado e verificado',
      },
      locale,
    )}
  />
);

const DiagnosticReview = ({
  authority,
  locale,
  snapshot,
}: {
  readonly authority: PlanAuthority;
  readonly locale: ShellLocale;
  readonly snapshot: PlanAuthoritySnapshot;
}) => {
  const planId = snapshot.plan?.planId;
  const diagnostic = snapshot.diagnostic;

  return (
    <LbPanel
      label={recoveryLocalized(
        { en: 'Local diagnostic review', 'pt-BR': 'Revisão local do diagnóstico' },
        locale,
      )}
    >
      <h2>
        {recoveryLocalized(
          { en: 'Local redaction preview', 'pt-BR': 'Prévia local de redação' },
          locale,
        )}
      </h2>
      {diagnostic === null ? (
        planId === undefined ? (
          <button
            aria-describedby="diagnostic-preview-blocker"
            className="lb-button"
            data-lb-control
            data-lb-variant="secondary"
            disabled
            type="button"
          >
            {recoveryLocalized(
              {
                en: 'Review diagnostic for export',
                'pt-BR': 'Revisar diagnóstico para exportação',
              },
              locale,
            )}
          </button>
        ) : (
          <LbButton
            onPress={() => {
              void authority.previewDiagnostic({ request: { planId } });
            }}
            variant="secondary"
          >
            {recoveryLocalized(
              {
                en: 'Review diagnostic for export',
                'pt-BR': 'Revisar diagnóstico para exportação',
              },
              locale,
            )}
          </LbButton>
        )
      ) : (
        <>
          <dl data-immutable="true">
            <div>
              <dt>
                {recoveryLocalized(
                  { en: 'Export identity', 'pt-BR': 'Identidade da exportação' },
                  locale,
                )}
              </dt>
              <dd>
                <code>{diagnostic.exportId}</code>
              </dd>
            </div>
            <div>
              <dt>
                {recoveryLocalized(
                  { en: 'Redactions applied', 'pt-BR': 'Redações aplicadas' },
                  locale,
                )}
              </dt>
              <dd>{diagnostic.redactionsApplied.join(' · ')}</dd>
            </div>
            <div>
              <dt>
                {recoveryLocalized({ en: 'Local entries', 'pt-BR': 'Eventos locais' }, locale)}
              </dt>
              <dd>{String(diagnostic.entries.length)}</dd>
            </div>
          </dl>
          <p>
            {recoveryLocalized(
              {
                en: 'The redacted file remains local until you explicitly choose a destination.',
                'pt-BR':
                  'O arquivo redigido permanece local até você escolher explicitamente um destino.',
              },
              locale,
            )}
          </p>
          <LbButton
            onPress={() => {
              void authority.exportDiagnostic({
                request: { planId: diagnostic.planId, exportId: diagnostic.exportId },
              });
            }}
            variant="primary"
          >
            {recoveryLocalized(
              { en: 'Create redacted file', 'pt-BR': 'Criar arquivo redigido' },
              locale,
            )}
          </LbButton>
        </>
      )}
      {planId === undefined ? (
        <p id="diagnostic-preview-blocker">
          {recoveryLocalized(
            {
              en: 'Diagnostic review requires an authoritative plan identity.',
              'pt-BR': 'A revisão do diagnóstico exige uma identidade autorizada do plano.',
            },
            locale,
          )}
        </p>
      ) : null}
    </LbPanel>
  );
};

const AuthoritativeRecoverSurface = ({
  authority,
  locale,
  onKeepCurrentState,
  validatedDocuments = [],
  view = 'overview',
}: RecoverSurfaceProps & Readonly<{ authority: PlanAuthority }>) => {
  const snapshot = useRecoveryAuthoritySnapshot(authority);
  const { plan, progress, transactionId } = snapshot;
  const currentEvent = latestJournalEvent(validatedDocuments, transactionId);
  const checkpoint = validatedDocuments.find(
    (document): document is RecoveryCheckpointDocument =>
      document.kind === 'recovery-checkpoint' && document.planId === plan?.planId,
  );
  const receipts = validatedDocuments.filter(
    (document): document is TransactionReceiptDocumentJson =>
      document.kind === 'transaction-receipt' && document.planId === plan?.planId,
  );
  const revocation = validatedDocuments.find(
    (document) => document.kind === 'operation-revocation',
  );
  const conflict = currentEvent?.state === 'conflict' ? currentEvent : undefined;
  const unresolved =
    snapshot.stale ||
    snapshot.status === 'unknown' ||
    snapshot.status === 'error' ||
    progress?.state === 'blocked' ||
    progress?.state === 'paused' ||
    progress?.state === 'recovering';
  const operationVersionId =
    currentEvent?.operationVersionId ??
    (progress === null
      ? undefined
      : progress.kind === 'progress-snapshot'
        ? progress.currentOperationVersionId
        : progress.operationVersionId) ??
    plan?.operations[0]?.operationVersionId;
  const operation = plan?.operations.find(
    (candidate) => candidate.operationVersionId === operationVersionId,
  );
  const affectedGroup = plan?.dependencyGroups.find(
    (group) => group.dependencyGroupId === operation?.dependencyGroupId,
  );
  const independentOperations =
    plan?.operations.filter(
      (candidate) => candidate.dependencyGroupId !== affectedGroup?.dependencyGroupId,
    ) ?? [];
  const timeline = recoveryTimeline(snapshot, locale);

  useEffect(() => {
    if (transactionId === null) return undefined;
    let active = true;
    let detach = (): void => undefined;
    void authority.reconnect(transactionId);
    void authority.subscribeExecution({ transactionId }).then((result) => {
      if (active && result.ok) detach = result.value;
      else if (result.ok) result.value();
    });
    return () => {
      active = false;
      detach();
    };
  }, [authority, transactionId]);

  const restoreBlocker =
    plan === null
      ? recoveryLocalized(
          {
            en: 'No authoritative plan identity is available.',
            'pt-BR': 'Nenhuma identidade autorizada de plano está disponível.',
          },
          locale,
        )
      : undefined;
  const operationBlocker =
    restoreBlocker ??
    (operation === undefined
      ? recoveryLocalized(
          {
            en: 'No exact operation recovery target is available.',
            'pt-BR': 'Nenhum destino exato de recuperação da operação está disponível.',
          },
          locale,
        )
      : undefined);
  const checkpointBlocker =
    restoreBlocker ??
    (checkpoint === undefined
      ? recoveryLocalized(
          {
            en: 'No authoritative checkpoint identity is available.',
            'pt-BR': 'Nenhuma identidade autorizada de ponto de recuperação está disponível.',
          },
          locale,
        )
      : undefined);

  return (
    <main
      data-authority-origin={snapshot.origin}
      data-recover-view={view}
      data-recovery-available="offline signed-out no-premium"
    >
      <RouteHeader
        purpose={recoveryLocalized(
          {
            en: 'Restore only from validated local authority, with exact prior state and a new auditable transaction.',
            'pt-BR':
              'Restaure somente pela autoridade local validada, com estado anterior exato e uma nova transação auditável.',
          },
          locale,
        )}
        title={recoveryLocalized(
          { en: 'Recovery Center', 'pt-BR': 'Central de Recuperação' },
          locale,
        )}
      />

      <section aria-labelledby="recovery-safety-heading" className="lb-transaction-layout">
        <div>
          <h2 id="recovery-safety-heading" tabIndex={-1}>
            {recoveryLocalized(
              { en: 'Current safety verdict', 'pt-BR': 'Veredito atual de segurança' },
              locale,
            )}
          </h2>
          <div
            aria-live={unresolved && conflict === undefined ? 'assertive' : 'polite'}
            role="status"
          >
            <StatusSignal
              detail={
                unresolved
                  ? recoveryLocalized(
                      {
                        en: 'New mutations are blocked. Recovery stays available while Windows truth is observed.',
                        'pt-BR':
                          'Novas mutações estão bloqueadas. A recuperação permanece disponível enquanto o estado real do Windows é observado.',
                      },
                      locale,
                    )
                  : recoveryLocalized(
                      {
                        en: 'No unresolved recovery blocks a reviewed new transaction.',
                        'pt-BR':
                          'Nenhuma recuperação pendente bloqueia uma nova transação revisada.',
                      },
                      locale,
                    )
              }
              locale={locale}
              state={unresolved ? 'critical' : 'success'}
            />
          </div>
          <h3>
            {recoveryLocalized({ en: 'Next safe action', 'pt-BR': 'Próxima ação segura' }, locale)}
          </h3>
          <p>
            {unresolved
              ? recoveryLocalized(
                  {
                    en: 'Review the observed state and choose one exact recovery target.',
                    'pt-BR': 'Revise o estado observado e escolha um destino exato de recuperação.',
                  },
                  locale,
                )
              : recoveryLocalized(
                  {
                    en: 'Review immutable history or prepare a local diagnostic export.',
                    'pt-BR':
                      'Revise o histórico imutável ou prepare uma exportação local do diagnóstico.',
                  },
                  locale,
                )}
          </p>
        </div>
        <aside>
          <LbPanel
            label={recoveryLocalized(
              { en: 'Recovery availability', 'pt-BR': 'Disponibilidade da recuperação' },
              locale,
            )}
          >
            <p>
              {recoveryLocalized(
                {
                  en: 'Available offline, signed out, and without Premium.',
                  'pt-BR': 'Disponível offline, sem login e sem Premium.',
                },
                locale,
              )}
            </p>
            <p>{`${recoveryLocalized({ en: 'Complementary restore', 'pt-BR': 'Restauração complementar' }, locale)}: ${checkpoint?.restorePointStatus ?? recoveryLocalized({ en: 'not reported', 'pt-BR': 'não informada' }, locale)}`}</p>
            {revocation !== undefined ? (
              <StatusSignal
                detail={recoveryLocalized(
                  {
                    en: 'Signed revocation blocks new apply; local restoration remains enabled.',
                    'pt-BR':
                      'A revogação assinada bloqueia novas aplicações; a restauração local continua habilitada.',
                  },
                  locale,
                )}
                locale={locale}
                state="warning"
              />
            ) : null}
          </LbPanel>
        </aside>
      </section>

      {progress !== null ? (
        <ExecutionTimeline
          currentStageId={timeline.currentStageId}
          label={recoveryLocalized(
            { en: 'Execution timeline', 'pt-BR': 'Linha do tempo da execução' },
            locale,
          )}
          locale={locale}
          stages={timeline.stages}
        />
      ) : null}

      {currentEvent !== undefined && unresolved ? (
        <LbPanel
          label={recoveryLocalized(
            { en: 'Affected dependency group', 'pt-BR': 'Grupo de dependência afetado' },
            locale,
          )}
          tone="focal"
        >
          <dl>
            <div>
              <dt>
                {recoveryLocalized(
                  { en: 'Failed operation', 'pt-BR': 'Operação com falha' },
                  locale,
                )}
              </dt>
              <dd>
                <code>{currentEvent.operationVersionId}</code>
              </dd>
            </div>
            <div>
              <dt>
                {recoveryLocalized(
                  {
                    en: 'Affected dependency closure',
                    'pt-BR': 'Fechamento de dependências afetado',
                  },
                  locale,
                )}
              </dt>
              <dd>
                <code>{affectedGroup?.dependencyGroupId ?? 'not-established'}</code>
              </dd>
            </div>
            <div>
              <dt>
                {recoveryLocalized(
                  {
                    en: 'Independent operations preserved',
                    'pt-BR': 'Operações independentes preservadas',
                  },
                  locale,
                )}
              </dt>
              <dd>
                {independentOperations.map(({ operationVersionId: id }) => id).join(' · ') ||
                  recoveryLocalized(
                    { en: 'none established', 'pt-BR': 'nenhuma estabelecida' },
                    locale,
                  )}
              </dd>
            </div>
            <div>
              <dt>
                {recoveryLocalized(
                  { en: 'Rollback result', 'pt-BR': 'Resultado da reversão' },
                  locale,
                )}
              </dt>
              <dd>{currentEvent.state === 'restored' ? 'verified-restored' : 'not-verified'}</dd>
            </div>
          </dl>
        </LbPanel>
      ) : null}

      {conflict !== undefined ? (
        <section aria-labelledby="conflict-resolution-heading">
          <h2 id="conflict-resolution-heading" tabIndex={-1}>
            {recoveryLocalized(
              { en: 'Conflict requires your decision', 'pt-BR': 'O conflito exige sua decisão' },
              locale,
            )}
          </h2>
          <StateTripletDiff
            locale={locale}
            observed={recoveryExactState(conflict.exactObservedState)}
            prior={recoveryExactState(conflict.exactPriorState)}
            requestedApplied={recoveryExactState(conflict.exactRequestedState)}
            state="conflict"
          />
          {onKeepCurrentState === undefined ? (
            <button
              aria-describedby="keep-current-blocker"
              className="lb-button"
              data-lb-control
              data-lb-variant="secondary"
              disabled
              type="button"
            >
              {recoveryLocalized(
                { en: 'Keep current state', 'pt-BR': 'Manter o estado atual' },
                locale,
              )}
            </button>
          ) : (
            <LbButton
              onPress={() => {
                onKeepCurrentState(conflict.operationVersionId);
              }}
              variant="secondary"
            >
              {recoveryLocalized(
                { en: 'Keep current state', 'pt-BR': 'Manter o estado atual' },
                locale,
              )}
            </LbButton>
          )}
          {onKeepCurrentState === undefined ? (
            <p id="keep-current-blocker">
              {recoveryLocalized(
                {
                  en: 'The current authority does not expose the audited keep-current intent.',
                  'pt-BR':
                    'A autoridade atual não expõe a intenção auditada de manter o estado atual.',
                },
                locale,
              )}
            </p>
          ) : null}
          <LbButton
            onPress={() => {
              if (plan !== null) {
                void authority.restoreOperation({
                  request: {
                    planId: plan.planId,
                    operationVersionId: conflict.operationVersionId,
                  },
                });
              }
            }}
            variant="secondary"
          >
            {recoveryLocalized(
              { en: 'Restore the prior state', 'pt-BR': 'Restaurar o estado anterior' },
              locale,
            )}
          </LbButton>
        </section>
      ) : null}

      <RecoveryTargetList
        checkpoint={{
          id: checkpoint?.checkpointId ?? 'checkpoint-unavailable',
          label:
            checkpoint?.checkpointId ??
            recoveryLocalized(
              { en: 'Checkpoint unavailable', 'pt-BR': 'Ponto de recuperação indisponível' },
              locale,
            ),
          detail: recoveryLocalized(
            {
              en: 'Start a new checkpoint restoration transaction.',
              'pt-BR': 'Iniciar uma nova transação de restauração do ponto de recuperação.',
            },
            locale,
          ),
          protectedState:
            checkpoint === undefined
              ? 'not-established'
              : recoveryExactState(checkpoint.exactPriorState),
          ...(checkpointBlocker === undefined ? {} : { blockedReason: checkpointBlocker }),
          onRestore: () => {
            if (checkpoint !== undefined) {
              void authority.restoreCheckpoint({
                request: { checkpointId: checkpoint.checkpointId },
              });
            }
          },
        }}
        locale={locale}
        operation={{
          id: operation?.operationVersionId ?? 'operation-unavailable',
          label:
            operation?.purpose ??
            recoveryLocalized(
              { en: 'Operation unavailable', 'pt-BR': 'Operação indisponível' },
              locale,
            ),
          detail: recoveryLocalized(
            {
              en: 'Restore only this exact operation as a new transaction.',
              'pt-BR': 'Restaurar somente esta operação exata como uma nova transação.',
            },
            locale,
          ),
          protectedState:
            operation === undefined
              ? 'not-established'
              : recoveryExactState(operation.previousValue),
          ...(operationBlocker === undefined ? {} : { blockedReason: operationBlocker }),
          onRestore: () => {
            if (plan !== null && operation !== undefined) {
              void authority.restoreOperation({
                request: { planId: plan.planId, operationVersionId: operation.operationVersionId },
              });
            }
          },
        }}
        plan={{
          id: plan?.planId ?? 'plan-unavailable',
          label:
            plan?.planId ??
            recoveryLocalized({ en: 'Plan unavailable', 'pt-BR': 'Plano indisponível' }, locale),
          detail: recoveryLocalized(
            {
              en: 'Restore the complete plan and its listed dependency groups as a new transaction.',
              'pt-BR':
                'Restaurar o plano completo e seus grupos de dependência listados como uma nova transação.',
            },
            locale,
          ),
          protectedState: plan?.revisionFingerprint ?? 'not-established',
          ...(restoreBlocker === undefined ? {} : { blockedReason: restoreBlocker }),
          onRestore: () => {
            if (plan !== null) void authority.restorePlan({ request: { planId: plan.planId } });
          },
        }}
      />

      <section aria-labelledby="recovery-history-heading">
        <h2 id="recovery-history-heading">
          {recoveryLocalized({ en: 'Immutable history', 'pt-BR': 'Histórico imutável' }, locale)}
        </h2>
        {receipts.length === 0 ? (
          <StatusSignal
            detail={recoveryLocalized(
              {
                en: 'Verified applies and restores will appear here with their receipts.',
                'pt-BR':
                  'Aplicações e restaurações verificadas aparecerão aqui com seus comprovantes.',
              },
              locale,
            )}
            locale={locale}
            state="empty"
          />
        ) : (
          receipts.map((receipt) => (
            <RecoveryReceipt
              key={receipt.receiptId}
              locale={locale}
              receipt={receipt}
              snapshot={snapshot}
            />
          ))
        )}
      </section>

      <DiagnosticReview authority={authority} locale={locale} snapshot={snapshot} />
    </main>
  );
};

const LegacyRecoverSurface = ({ locale, scenarioId, view }: RecoverSurfaceProps) => {
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
            <ProductIcon className="lb-recovery-emblem" name="shield" size={28} />
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

export const RecoverSurface = ({
  authority,
  locale,
  onKeepCurrentState,
  scenarioId,
  validatedDocuments,
  view,
}: RecoverSurfaceProps) => {
  if (authority !== undefined) {
    return (
      <AuthoritativeRecoverSurface
        authority={authority}
        locale={locale}
        {...(onKeepCurrentState === undefined ? {} : { onKeepCurrentState })}
        scenarioId={scenarioId}
        {...(validatedDocuments === undefined ? {} : { validatedDocuments })}
        {...(view === undefined ? {} : { view })}
      />
    );
  }
  return (
    <LegacyRecoverSurface
      locale={locale}
      scenarioId={scenarioId}
      {...(view === undefined ? {} : { view })}
    />
  );
};
