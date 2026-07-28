import {
  BeforeAfterDiff,
  CapabilityReason,
  EvidenceList,
  FreshnessStamp,
  GameRunway,
  LbButton,
  OperationalFailure,
  ProvenanceMark,
  QualityMark,
  RouteHeader,
  ScenarioMarker,
  SessionTimeline,
  StatusSignal,
  VerificationReceipt,
  type OperationalState,
} from '@liiiraa/design-system';
import type { DesktopScenarioId, PhaseBoundaryExplanation } from '@liiiraa/desktop-client';

import type { ShellLocale } from './calibration.js';

export const PREPARE_VIEWS = Object.freeze([
  'library',
  'overview',
  'profile',
  'evidence',
  'history',
  'preflight',
  'active-session',
  'restoration',
  'result',
] as const);

export type PrepareView = (typeof PREPARE_VIEWS)[number];

export const GAME_LIBRARY_STATES = Object.freeze([
  'detected',
  'empty',
  'scanning',
  'launcher-unavailable',
  'duplicate-identity',
  'manual-add',
] as const);

export type GameLibraryState = (typeof GAME_LIBRARY_STATES)[number];

export const RESTORATION_STATES = Object.freeze([
  'restoring',
  'game-still-running',
  'process-ambiguity',
  'partial-failure',
  'verified',
] as const);

export type RestorationState = (typeof RESTORATION_STATES)[number];

export const SESSION_RESULT_STATES = Object.freeze([
  'quality-approved',
  'degraded-capture',
  'incomparable',
  'unsupported-game',
] as const);

export type SessionResultState = (typeof SESSION_RESULT_STATES)[number];

export interface PrepareSurfaceProps {
  readonly externalLaunch?: boolean;
  readonly libraryState?: GameLibraryState;
  readonly locale: ShellLocale;
  readonly onNavigate?: (target: PrepareView | 'manual-add' | 'recovery') => void;
  readonly restorationState?: RestorationState;
  readonly resultState?: SessionResultState;
  readonly scenarioId: string;
  readonly view: PrepareView;
}

interface LocalizedCopy {
  readonly en: string;
  readonly 'pt-BR': string;
}

const localized = (copy: LocalizedCopy, locale: ShellLocale) => copy[locale];

const GAME = Object.freeze({
  fictional: 'Northstar Arena',
  realDiscoveries: ['Steam', 'Epic Games Launcher', 'Riot Client'],
  executableIdentity: 'fixture://northstar-arena/game.exe',
  launcherIdentity: 'fixture://northstar-launcher',
  profile: 'Northstar Competitive · Verified fixture profile',
});

const LIBRARY_PROJECTION: Readonly<
  Record<
    GameLibraryState,
    Readonly<{ detail: LocalizedCopy; state: OperationalState; title: LocalizedCopy }>
  >
> = {
  detected: {
    title: {
      en: 'One scenario game is ready for review',
      'pt-BR': 'Um jogo de cenário está pronto para revisão',
    },
    detail: {
      en: 'Northstar Arena is fictional and exists only as deterministic fixture evidence.',
      'pt-BR':
        'Northstar Arena é fictício e existe apenas como evidência determinística de cenário.',
    },
    state: 'fixture',
  },
  empty: {
    title: { en: 'No games were detected', 'pt-BR': 'Nenhum jogo foi detectado' },
    detail: {
      en: 'This can be normal on a new installation. Add a local identity for scenario review.',
      'pt-BR':
        'Isso pode ser normal em uma instalação nova. Adicione uma identidade local para revisar o cenário.',
    },
    state: 'empty',
  },
  scanning: {
    title: {
      en: 'Reviewing launcher identities',
      'pt-BR': 'Revisando identidades de inicializadores',
    },
    detail: {
      en: 'The deterministic scan is active. No game files are opened or modified.',
      'pt-BR':
        'A varredura determinística está ativa. Nenhum arquivo de jogo é aberto ou modificado.',
    },
    state: 'loading',
  },
  'launcher-unavailable': {
    title: { en: 'One launcher is unavailable', 'pt-BR': 'Um inicializador está indisponível' },
    detail: {
      en: 'Discovery evidence is incomplete; no integration qualification is inferred.',
      'pt-BR': 'A evidência de descoberta está incompleta; nenhuma integração é presumida.',
    },
    state: 'partial-failure',
  },
  'duplicate-identity': {
    title: {
      en: 'Two launchers report the same game',
      'pt-BR': 'Dois inicializadores relatam o mesmo jogo',
    },
    detail: {
      en: 'The identities remain separate until a user reviews the deterministic match.',
      'pt-BR': 'As identidades ficam separadas até a revisão da correspondência determinística.',
    },
    state: 'contradictory-evidence',
  },
  'manual-add': {
    title: { en: 'Review a manual game identity', 'pt-BR': 'Revise uma identidade manual de jogo' },
    detail: {
      en: 'The executable label is user-provided and is not proof of compatibility.',
      'pt-BR': 'O rótulo do executável é fornecido pelo usuário e não prova compatibilidade.',
    },
    state: 'permission',
  },
};

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
        ? `Esta prévia demonstra o fluxo. ${capability} será conectado na ${owningPhase}.`
        : `This preview demonstrates the flow. ${capability} will be connected in ${owningPhase}.`,
  });

const PhaseBoundary = ({
  boundary,
  locale,
}: {
  readonly boundary: PhaseBoundaryExplanation;
  readonly locale: ShellLocale;
}) => (
  <aside aria-label={localized({ en: 'Phase boundary', 'pt-BR': 'Limite de fase' }, locale)}>
    <strong>{boundary.capability}</strong>
    <p>{boundary.explanation}</p>
    <p>
      {localized({ en: 'Owning phase', 'pt-BR': 'Fase responsável' }, locale)}:{' '}
      {boundary.owningPhase}
    </p>
  </aside>
);

const LibraryView = ({
  locale,
  onNavigate,
  scenarioId,
  state,
}: {
  readonly locale: ShellLocale;
  readonly onNavigate?: PrepareSurfaceProps['onNavigate'];
  readonly scenarioId: string;
  readonly state: GameLibraryState;
}) => {
  const projection = LIBRARY_PROJECTION[state];
  const boundary = createBoundary(scenarioId, locale, 'Real launcher discovery', 'Phase 8');

  return (
    <section aria-labelledby="prepare-library-title" data-library-state={state} data-lb-region>
      <h2 id="prepare-library-title">
        {localized({ en: 'Game library', 'pt-BR': 'Biblioteca de jogos' }, locale)}
      </h2>
      <StatusSignal
        detail={localized(projection.detail, locale)}
        locale={locale}
        state={projection.state}
      />
      <p>{localized(projection.title, locale)}</p>

      {state === 'detected' ? (
        <>
          <article>
            <h3>{GAME.fictional}</h3>
            <ProvenanceMark
              detail="FICTIONAL · DETERMINISTIC FIXTURE"
              kind="fixture"
              locale={locale}
            />
            <p>
              {localized(
                {
                  en: 'Golden competitive-shooter narrative for a mid-range Intel/NVIDIA Windows 11 fixture.',
                  'pt-BR':
                    'Narrativa competitiva fictícia para um cenário Windows 11 intermediário Intel/NVIDIA.',
                },
                locale,
              )}
            </p>
            <LbButton onPress={() => onNavigate?.('overview')} variant="primary">
              {localized({ en: 'Review game', 'pt-BR': 'Revisar jogo' }, locale)}
            </LbButton>
          </article>
          <section aria-label="Real discovery identities">
            <h3>
              {localized(
                {
                  en: 'Recognizable discovery evidence',
                  'pt-BR': 'Evidência de descoberta reconhecível',
                },
                locale,
              )}
            </h3>
            <ul>
              {GAME.realDiscoveries.map((identity) => (
                <li key={identity}>
                  <strong>{identity}</strong> —{' '}
                  {localized(
                    {
                      en: 'discovery evidence only; integration unvalidated',
                      'pt-BR': 'somente evidência de descoberta; integração não validada',
                    },
                    locale,
                  )}
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}

      {state === 'empty' || state === 'manual-add' ? (
        <LbButton onPress={() => onNavigate?.('manual-add')} variant="primary">
          {localized({ en: 'Add a game manually', 'pt-BR': 'Adicionar jogo manualmente' }, locale)}
        </LbButton>
      ) : null}

      {state === 'duplicate-identity' ? (
        <LbButton onPress={() => onNavigate?.('overview')} variant="primary">
          {localized(
            { en: 'Review both identities', 'pt-BR': 'Revisar as duas identidades' },
            locale,
          )}
        </LbButton>
      ) : null}

      {state === 'launcher-unavailable' ? (
        <PhaseBoundary boundary={boundary} locale={locale} />
      ) : null}
    </section>
  );
};

const GameOverview = ({ locale }: { readonly locale: ShellLocale }) => (
  <section aria-labelledby="prepare-overview-title" data-lb-region>
    <h2 id="prepare-overview-title">{GAME.fictional}</h2>
    <p>
      {localized(
        {
          en: 'Fictional anchor for navigation and recovery validation. No real-game integration is claimed.',
          'pt-BR':
            'Referência fictícia para validar navegação e recuperação. Nenhuma integração real é alegada.',
        },
        locale,
      )}
    </p>
    <dl>
      <dt>
        {localized({ en: 'Executable identity', 'pt-BR': 'Identidade do executável' }, locale)}
      </dt>
      <dd>{GAME.executableIdentity}</dd>
      <dt>
        {localized({ en: 'Launcher identity', 'pt-BR': 'Identidade do inicializador' }, locale)}
      </dt>
      <dd>{GAME.launcherIdentity}</dd>
      <dt>{localized({ en: 'Compatibility', 'pt-BR': 'Compatibilidade' }, locale)}</dt>
      <dd>
        {localized(
          { en: 'Scenario-qualified only', 'pt-BR': 'Qualificada apenas no cenário' },
          locale,
        )}
      </dd>
    </dl>
    <CapabilityReason
      capability="Anti-cheat boundary"
      reason="No injection, game-file modification, launcher flags, or anti-cheat interference."
      state="restricted"
    />
    <FreshnessStamp capturedAt="2030-01-15T18:00:00.000Z" freshness="current" locale={locale} />
    <QualityMark detail="Deterministic fixture review" locale={locale} quality="verified" />
  </section>
);

const ProfileView = ({ locale }: { readonly locale: ShellLocale }) => (
  <section aria-labelledby="prepare-profile-title" data-lb-region>
    <h2 id="prepare-profile-title">
      {localized({ en: 'Profile composition', 'pt-BR': 'Composição do perfil' }, locale)}
    </h2>
    <p>{GAME.profile}</p>
    <ol>
      <li>
        <strong>
          {localized({ en: 'Signed official base', 'pt-BR': 'Base oficial assinada' }, locale)}
        </strong>
        <p>
          {localized(
            { en: 'Scenario signature verified.', 'pt-BR': 'Assinatura do cenário verificada.' },
            locale,
          )}
        </p>
      </li>
      <li>
        <strong>{localized({ en: 'Local adaptation', 'pt-BR': 'Adaptação local' }, locale)}</strong>
        <p>
          {localized(
            {
              en: 'Derived from fixture capabilities.',
              'pt-BR': 'Derivada das capacidades do cenário.',
            },
            locale,
          )}
        </p>
      </li>
      <li>
        <strong>
          {localized({ en: 'User overrides', 'pt-BR': 'Preferências do usuário' }, locale)}
        </strong>
        <p>
          {localized(
            {
              en: 'One reversible presentation choice.',
              'pt-BR': 'Uma escolha reversível de apresentação.',
            },
            locale,
          )}
        </p>
      </li>
    </ol>
    <BeforeAfterDiff
      entries={[
        {
          label: localized(
            { en: 'Frame limiter policy', 'pt-BR': 'Política de limite de quadros' },
            locale,
          ),
          before: localized(
            { en: 'Official base: automatic', 'pt-BR': 'Base oficial: automática' },
            locale,
          ),
          after: localized(
            {
              en: 'User override: review each session',
              'pt-BR': 'Preferência: revisar a cada sessão',
            },
            locale,
          ),
        },
      ]}
    />
    <ProvenanceMark
      detail="SIGNED BASE + FIXTURE ADAPTATION + USER OVERRIDE"
      kind="fixture"
      locale={locale}
    />
  </section>
);

const GameEvidence = ({ locale }: { readonly locale: ShellLocale }) => (
  <section aria-labelledby="prepare-evidence-title" data-lb-region>
    <h2 id="prepare-evidence-title">
      {localized({ en: 'Game evidence', 'pt-BR': 'Evidência do jogo' }, locale)}
    </h2>
    <EvidenceList
      items={[
        {
          source: 'scenario:S01/game-identity',
          version: '1',
          timestamp: '2030-01-15T18:00:00.000Z',
          confidence: 'fixture-approved',
        },
        {
          source: 'scenario:S01/profile-envelope',
          version: '3',
          timestamp: '2030-01-15T18:00:00.000Z',
          confidence: 'fixture-approved',
        },
      ]}
    />
    <p>
      {localized(
        {
          en: 'These sources validate the interface contract, not a real launcher or game.',
          'pt-BR':
            'Estas fontes validam o contrato da interface, não um jogo ou inicializador real.',
        },
        locale,
      )}
    </p>
  </section>
);

const GameHistory = ({ locale }: { readonly locale: ShellLocale }) => (
  <section aria-labelledby="prepare-history-title" data-lb-region>
    <h2 id="prepare-history-title">
      {localized({ en: 'Scenario history', 'pt-BR': 'Histórico do cenário' }, locale)}
    </h2>
    <SessionTimeline
      entries={[
        {
          id: 'preflight',
          timestamp: '2030-01-15T18:00:00.000Z',
          title: localized({ en: 'Preflight reviewed', 'pt-BR': 'Pré-voo revisado' }, locale),
          detail: localized(
            { en: 'No changes requested.', 'pt-BR': 'Nenhuma alteração solicitada.' },
            locale,
          ),
        },
        {
          id: 'restoration',
          timestamp: '2030-01-15T18:40:00.000Z',
          title: localized(
            { en: 'Restoration verified', 'pt-BR': 'Restauração verificada' },
            locale,
          ),
          detail: localized(
            {
              en: 'Scenario receipt confirms no change.',
              'pt-BR': 'O recibo de cenário confirma nenhuma alteração.',
            },
            locale,
          ),
        },
      ]}
    />
  </section>
);

const PreflightView = ({
  locale,
  onNavigate,
}: {
  readonly locale: ShellLocale;
  readonly onNavigate?: PrepareSurfaceProps['onNavigate'];
}) => (
  <section aria-labelledby="prepare-preflight-title" data-critical-path="complete" data-lb-region>
    <h2 id="prepare-preflight-title">
      {localized({ en: 'No-effect preflight', 'pt-BR': 'Pré-voo sem efeito' }, locale)}
    </h2>
    <GameRunway
      game={GAME.fictional}
      steps={[
        localized(
          {
            en: 'Validate fixture profile envelope',
            'pt-BR': 'Validar envelope do perfil de cenário',
          },
          locale,
        ),
        localized(
          {
            en: 'Review temporary operation requests',
            'pt-BR': 'Revisar solicitações temporárias',
          },
          locale,
        ),
        localized(
          {
            en: 'Resolve conflicts and restart constraints',
            'pt-BR': 'Resolver conflitos e restrições de reinicialização',
          },
          locale,
        ),
        localized(
          { en: 'Verify recovery readiness', 'pt-BR': 'Verificar prontidão para recuperação' },
          locale,
        ),
        localized(
          {
            en: 'Confirm preview only — no launch',
            'pt-BR': 'Confirmar somente prévia — sem iniciar',
          },
          locale,
        ),
      ]}
    />
    <StatusSignal
      detail={localized(
        {
          en: 'Recovery receipt path is ready. No operation or executable will run.',
          'pt-BR': 'O caminho de recibo está pronto. Nenhuma operação ou executável será iniciado.',
        },
        locale,
      )}
      locale={locale}
      state="fixture"
    />
    <LbButton onPress={() => onNavigate?.('active-session')} variant="primary">
      {localized({ en: 'Review session preview', 'pt-BR': 'Revisar prévia da sessão' }, locale)}
    </LbButton>
  </section>
);

const ActiveSessionView = ({
  externalLaunch,
  locale,
  onNavigate,
  scenarioId,
}: {
  readonly externalLaunch: boolean;
  readonly locale: ShellLocale;
  readonly onNavigate?: PrepareSurfaceProps['onNavigate'];
  readonly scenarioId: string;
}) => (
  <section
    aria-labelledby="prepare-session-title"
    data-external-launch={externalLaunch}
    data-lb-region
  >
    <h2 id="prepare-session-title">
      {externalLaunch
        ? localized(
            {
              en: 'External launch detected in scenario',
              'pt-BR': 'Abertura externa detectada no cenário',
            },
            locale,
          )
        : localized({ en: 'Session preview active', 'pt-BR': 'Prévia de sessão ativa' }, locale)}
    </h2>
    <ScenarioMarker scenarioId={externalLaunch ? 'S09' : scenarioId} />
    <p>
      {localized(
        {
          en: 'The same fixture profile and preflight semantics are displayed. Detection is scenario-marked and performs no process monitoring.',
          'pt-BR':
            'O mesmo perfil de cenário e pré-voo são exibidos. A detecção é marcada como cenário e não monitora processos.',
        },
        locale,
      )}
    </p>
    <dl>
      <dt>{localized({ en: 'Active profile', 'pt-BR': 'Perfil ativo' }, locale)}</dt>
      <dd>{GAME.profile}</dd>
      <dt>{localized({ en: 'Telemetry', 'pt-BR': 'Telemetria' }, locale)}</dt>
      <dd>
        {localized(
          { en: 'Minimized fixture preview', 'pt-BR': 'Prévia mínima de cenário' },
          locale,
        )}
      </dd>
      <dt>{localized({ en: 'Temporary operations', 'pt-BR': 'Operações temporárias' }, locale)}</dt>
      <dd>
        {localized(
          {
            en: 'Requested: none; applied: none',
            'pt-BR': 'Solicitadas: nenhuma; aplicadas: nenhuma',
          },
          locale,
        )}
      </dd>
    </dl>
    <LbButton onPress={() => onNavigate?.('recovery')} variant="secondary">
      {localized(
        { en: 'Open emergency recovery route', 'pt-BR': 'Abrir rota de recuperação de emergência' },
        locale,
      )}
    </LbButton>
  </section>
);

const RESTORATION_PROJECTION: Readonly<
  Record<RestorationState, Readonly<{ detail: LocalizedCopy; state: OperationalState }>>
> = {
  restoring: {
    detail: {
      en: 'Verifying the scenario prior state.',
      'pt-BR': 'Verificando o estado anterior do cenário.',
    },
    state: 'loading',
  },
  'game-still-running': {
    detail: {
      en: 'The scenario game is still marked active; restoration waits safely.',
      'pt-BR': 'O jogo do cenário ainda está ativo; a restauração aguarda com segurança.',
    },
    state: 'restart-pending',
  },
  'process-ambiguity': {
    detail: {
      en: 'Process identity is ambiguous, so restoration fails closed.',
      'pt-BR': 'A identidade do processo é ambígua; a restauração falha de forma segura.',
    },
    state: 'contradictory-evidence',
  },
  'partial-failure': {
    detail: {
      en: 'One verification dependency did not respond; no change occurred.',
      'pt-BR': 'Uma dependência de verificação não respondeu; nenhuma alteração ocorreu.',
    },
    state: 'partial-failure',
  },
  verified: {
    detail: {
      en: 'Prior state verified. The receipt confirms that no change occurred.',
      'pt-BR': 'Estado anterior verificado. O recibo confirma que nenhuma alteração ocorreu.',
    },
    state: 'fixture',
  },
};

const RestorationView = ({
  locale,
  state,
}: {
  readonly locale: ShellLocale;
  readonly state: RestorationState;
}) => {
  const projection = RESTORATION_PROJECTION[state];

  return (
    <section
      aria-labelledby="prepare-restoration-title"
      data-lb-region
      data-restoration-state={state}
    >
      <h2 id="prepare-restoration-title">
        {localized({ en: 'Session restoration', 'pt-BR': 'Restauração da sessão' }, locale)}
      </h2>
      {state === 'partial-failure' ? (
        <OperationalFailure
          detail={localized(projection.detail, locale)}
          title={localized(
            {
              en: 'Restoration verification paused',
              'pt-BR': 'Verificação da restauração pausada',
            },
            locale,
          )}
        />
      ) : (
        <StatusSignal
          detail={localized(projection.detail, locale)}
          locale={locale}
          state={projection.state}
        />
      )}
      {state === 'verified' ? (
        <VerificationReceipt
          detail={localized(
            {
              en: 'Preview complete — no changes were made to this PC.',
              'pt-BR': 'Prévia concluída — nenhuma alteração foi feita neste PC.',
            },
            locale,
          )}
          receiptId="S01-PREPARE-RESTORE-NO-CHANGE"
        />
      ) : null}
    </section>
  );
};

const ResultView = ({
  locale,
  state,
}: {
  readonly locale: ShellLocale;
  readonly state: SessionResultState;
}) => {
  const approved = state === 'quality-approved';
  const degraded = state === 'degraded-capture';
  const incomparable = state === 'incomparable';

  return (
    <section aria-labelledby="prepare-result-title" data-lb-region data-result-state={state}>
      <h2 id="prepare-result-title">
        {localized({ en: 'Session result', 'pt-BR': 'Resultado da sessão' }, locale)}
      </h2>
      <QualityMark
        detail={
          approved
            ? localized(
                { en: 'Fixture methodology approved', 'pt-BR': 'Metodologia de cenário aprovada' },
                locale,
              )
            : localized(
                {
                  en: 'No performance claim permitted',
                  'pt-BR': 'Nenhuma alegação de desempenho permitida',
                },
                locale,
              )
        }
        locale={locale}
        quality={
          approved
            ? 'verified'
            : degraded
              ? 'degraded'
              : incomparable
                ? 'contradictory'
                : 'unavailable'
        }
      />
      <p>
        {approved
          ? localized(
              {
                en: 'The deterministic session completed with approved fixture quality; it is not a real measurement.',
                'pt-BR':
                  'A sessão determinística terminou com qualidade de cenário aprovada; não é uma medição real.',
              },
              locale,
            )
          : degraded
            ? localized(
                {
                  en: 'Capture coverage is degraded. 1% low remains unavailable.',
                  'pt-BR':
                    'A cobertura da captura está degradada. O 1% low permanece indisponível.',
                },
                locale,
              )
            : incomparable
              ? localized(
                  {
                    en: 'The session cannot be compared because workload and thermal state differ. No percentage is shown.',
                    'pt-BR':
                      'A sessão não pode ser comparada porque carga e estado térmico diferem. Nenhuma porcentagem é exibida.',
                  },
                  locale,
                )
              : localized(
                  {
                    en: 'This game has no approved capture method. No estimate is substituted.',
                    'pt-BR':
                      'Este jogo não tem método de captura aprovado. Nenhuma estimativa é substituída.',
                  },
                  locale,
                )}
      </p>
      <ProvenanceMark detail="SESSION FIXTURE · NOT OBSERVED" kind="fixture" locale={locale} />
    </section>
  );
};

export const PrepareSurface = ({
  externalLaunch = false,
  libraryState = 'detected',
  locale,
  onNavigate,
  restorationState = 'verified',
  resultState = 'quality-approved',
  scenarioId,
  view,
}: PrepareSurfaceProps) => (
  <main
    aria-label={localized({ en: 'Prepare workspace', 'pt-BR': 'Área de preparação' }, locale)}
    data-locale={locale}
    data-prepare-view={view}
    data-scenario-id={scenarioId}
  >
    <ScenarioMarker scenarioId={scenarioId} />
    <RouteHeader
      breadcrumbs={[
        { label: localized({ en: 'Prepare', 'pt-BR': 'Preparar' }, locale) },
        { label: view },
      ]}
      purpose={localized(
        {
          en: 'Review game identity, profile, preflight, session, and restoration without running privileged work.',
          'pt-BR':
            'Revise identidade, perfil, pré-voo, sessão e restauração sem executar trabalho privilegiado.',
        },
        locale,
      )}
      title={localized({ en: 'Prepare', 'pt-BR': 'Preparar' }, locale)}
    />

    {view === 'library' ? (
      <LibraryView
        locale={locale}
        onNavigate={onNavigate}
        scenarioId={scenarioId}
        state={libraryState}
      />
    ) : null}
    {view === 'overview' ? <GameOverview locale={locale} /> : null}
    {view === 'profile' ? <ProfileView locale={locale} /> : null}
    {view === 'evidence' ? <GameEvidence locale={locale} /> : null}
    {view === 'history' ? <GameHistory locale={locale} /> : null}
    {view === 'preflight' ? <PreflightView locale={locale} onNavigate={onNavigate} /> : null}
    {view === 'active-session' ? (
      <ActiveSessionView
        externalLaunch={externalLaunch}
        locale={locale}
        onNavigate={onNavigate}
        scenarioId={scenarioId}
      />
    ) : null}
    {view === 'restoration' ? <RestorationView locale={locale} state={restorationState} /> : null}
    {view === 'result' ? <ResultView locale={locale} state={resultState} /> : null}
  </main>
);
