import {
  FreshnessStamp,
  GameRunway,
  LbButton,
  NextActionBrief,
  RouteHeader,
  ScenarioMarker,
  StatusSignal,
  type EvidenceFreshness,
  type OperationalState,
} from '@liiiraa/design-system';

import type { HomeCalibrationState } from '../model/calibration.js';
import type { ShellLocale } from './calibration.js';

export const HOME_VARIANTS = Object.freeze([
  'ready',
  'recommendations',
  'game-ready',
  'game-running',
  'restart-pending',
  'recovery-required',
  'offline-entitled',
  'expired-entitlement',
  'unsupported-windows',
  'critical-security',
  'calibration-incomplete',
  'evidence-stale',
] as const);

export type HomeVariant = (typeof HOME_VARIANTS)[number];

export interface HomeClaim {
  readonly capturedAt: string;
  readonly detail: string;
  readonly freshness: EvidenceFreshness;
  readonly id: string;
  readonly label: string;
  readonly source: string;
  readonly state: OperationalState;
}

export interface SelectedGame {
  readonly capturedAt: string;
  readonly freshness: EvidenceFreshness;
  readonly lastReliableResult: string;
  readonly launchRoute: string;
  readonly name: string;
  readonly profileState: string;
  readonly readiness: readonly string[];
  readonly source: string;
}

export interface HomeNextAction {
  readonly consequence: string;
  readonly cta: string;
  readonly evidence: string;
  readonly onPress?: () => void;
  readonly reason: string;
  readonly title: string;
}

export interface ContextualHomeProps {
  readonly calibration: HomeCalibrationState;
  readonly claims: readonly HomeClaim[];
  readonly locale: ShellLocale;
  readonly limitationReason?: string;
  readonly nextAction?: HomeNextAction;
  readonly onContinueCalibration?: () => void;
  readonly onRetry?: () => void;
  readonly scenarioId: string;
  readonly selectedGame?: SelectedGame;
  readonly variant: HomeVariant;
}

const isLimitedVariant = (variant: HomeVariant) =>
  variant === 'unsupported-windows' || variant === 'critical-security';

const VARIANT_STATE: Readonly<Record<HomeVariant, OperationalState>> = {
  ready: 'fixture',
  recommendations: 'fixture',
  'game-ready': 'fixture',
  'game-running': 'loading',
  'restart-pending': 'restart-pending',
  'recovery-required': 'recovery',
  'offline-entitled': 'offline',
  'expired-entitlement': 'expired-entitlement',
  'unsupported-windows': 'unsupported',
  'critical-security': 'contradictory-evidence',
  'calibration-incomplete': 'empty',
  'evidence-stale': 'stale-evidence',
};

const DEFAULT_VARIANT_COPY: Readonly<Record<ShellLocale, Readonly<Record<HomeVariant, string>>>> = {
  en: {
    ready: 'No urgent finding requires action.',
    recommendations: 'A safe scenario recommendation is ready for review.',
    'game-ready': 'The selected game has a scenario-ready profile.',
    'game-running': 'The selected game is running; disruptive work is deferred.',
    'restart-pending': 'A reviewed scenario plan is waiting for restart.',
    'recovery-required': 'Recovery needs attention before new work continues.',
    'offline-entitled': 'Offline access remains inside the valid entitlement window.',
    'expired-entitlement': 'Premium actions are blocked; recovery and history remain available.',
    'unsupported-windows': 'This Windows lifecycle is unsupported for recommendations.',
    'critical-security': 'Conflicting evidence requires a fail-closed review.',
    'calibration-incomplete': 'Calibration needs more trusted local evidence.',
    'evidence-stale': 'Some evidence is stale and needs partial revalidation.',
  },
  'pt-BR': {
    ready: 'Nenhuma descoberta urgente exige ação.',
    recommendations: 'Uma recomendação segura do cenário está pronta para revisão.',
    'game-ready': 'O jogo selecionado tem um perfil pronto no cenário.',
    'game-running': 'O jogo selecionado está em execução; trabalho disruptivo foi adiado.',
    'restart-pending': 'Um plano revisado do cenário aguarda reinicialização.',
    'recovery-required': 'A recuperação precisa de atenção antes de novos trabalhos.',
    'offline-entitled': 'O acesso offline continua dentro da janela válida da assinatura.',
    'expired-entitlement': 'Ações Premium estão bloqueadas; recuperação e histórico continuam.',
    'unsupported-windows': 'Este ciclo de vida do Windows não recebe recomendações.',
    'critical-security': 'Evidências conflitantes exigem uma revisão segura.',
    'calibration-incomplete': 'A calibração precisa de mais evidência local confiável.',
    'evidence-stale': 'Parte da evidência está vencida e precisa de revalidação parcial.',
  },
};

const ledgerGroup = (state: OperationalState): 'attention' | 'ready' | 'unavailable' => {
  if (state === 'fixture' || state === 'loading') return 'ready';
  if (state === 'empty' || state === 'unsupported' || state === 'permission') return 'unavailable';
  return 'attention';
};

export const ContextualHome = ({
  calibration,
  claims,
  locale,
  limitationReason,
  nextAction,
  onContinueCalibration,
  onRetry,
  scenarioId,
  selectedGame,
  variant,
}: ContextualHomeProps) => {
  const isPtBr = locale === 'pt-BR';
  const limited = calibration.access === 'limited' || isLimitedVariant(variant);
  const incomplete = !calibration.requiredComplete || variant === 'calibration-incomplete';
  const recommendationVisible = calibration.recommendationsAllowed && !limited && nextAction;
  const continueDominant =
    calibration.continueAction.prominence === 'dominant' || variant === 'calibration-incomplete';
  const groups = {
    ready: claims.filter((claim) => ledgerGroup(claim.state) === 'ready'),
    attention: claims.filter((claim) => ledgerGroup(claim.state) === 'attention'),
    unavailable: claims.filter((claim) => ledgerGroup(claim.state) === 'unavailable'),
  };

  const nextActionRegion = limited ? (
    <NextActionBrief
      action={
        <LbButton onPress={() => onRetry?.()} variant="primary">
          {isPtBr ? 'Tentar novamente' : 'Retry'}
        </LbButton>
      }
      detail={`${limitationReason ?? DEFAULT_VARIANT_COPY[locale][variant]} ${
        isPtBr ? 'Nenhuma recomendação é exibida.' : 'No recommendation is shown.'
      }`}
      title={isPtBr ? 'Modo limitado seguro' : 'Safe limited mode'}
    />
  ) : incomplete ? (
    <NextActionBrief
      action={
        <LbButton onPress={() => onContinueCalibration?.()} variant="primary">
          {isPtBr ? 'Continuar calibração' : 'Continue calibration'}
        </LbButton>
      }
      detail={
        isPtBr
          ? 'Conclua a calibração para receber uma próxima ação baseada neste PC.'
          : 'Complete calibration to receive a next action based on this PC.'
      }
      title={
        isPtBr ? 'Ainda não há evidência suficiente' : 'There is not enough evidence yet'
      }
    />
  ) : recommendationVisible ? (
    <NextActionBrief
      action={
        <LbButton onPress={() => nextAction.onPress?.()} variant="primary">
          {nextAction.cta}
        </LbButton>
      }
      detail={`${nextAction.evidence} ${nextAction.reason} ${nextAction.consequence}`}
      title={nextAction.title}
    />
  ) : (
    <NextActionBrief
      action={
        continueDominant ? (
          <LbButton onPress={() => onContinueCalibration?.()} variant="primary">
            {isPtBr ? 'Continuar calibração' : 'Continue calibration'}
          </LbButton>
        ) : null
      }
      detail={DEFAULT_VARIANT_COPY[locale][variant]}
      title={isPtBr ? 'Próxima ação' : 'Next action'}
    />
  );

  return (
    <main
      aria-labelledby="contextual-home-title"
      data-home-variant={variant}
      data-locale={locale}
      data-scenario-id={scenarioId}
    >
      <ScenarioMarker scenarioId={scenarioId} />
      <RouteHeader
        purpose={
          isPtBr
            ? 'Veja a próxima ação confiável, o jogo selecionado e o estado concreto do sistema.'
            : 'See the next trusted action, selected game, and concrete system state.'
        }
        title={isPtBr ? 'Início contextual' : 'Contextual Home'}
      />
      <h1 className="lb-visually-hidden" id="contextual-home-title">
        {isPtBr ? 'Início contextual' : 'Contextual Home'}
      </h1>

      <section aria-label={isPtBr ? 'Próxima ação' : 'Next action'} data-home-region-order="1">
        {nextActionRegion}
        <StatusSignal detail={DEFAULT_VARIANT_COPY[locale][variant]} state={VARIANT_STATE[variant]} />
      </section>

      <section
        aria-label={isPtBr ? 'Jogo selecionado' : 'Selected game'}
        data-evidence={selectedGame ? 'trusted-or-stale' : 'unavailable'}
        data-home-region-order="2"
      >
        {selectedGame ? (
          <>
            <GameRunway
              game={selectedGame.name}
              steps={[
                selectedGame.profileState,
                ...selectedGame.readiness,
                selectedGame.launchRoute,
                selectedGame.lastReliableResult,
              ]}
            />
            <p>
              {isPtBr ? 'Fonte' : 'Source'}: {selectedGame.source}
            </p>
            <FreshnessStamp
              capturedAt={selectedGame.capturedAt}
              freshness={selectedGame.freshness}
            />
          </>
        ) : (
          <>
            <h2>{isPtBr ? 'Nenhum jogo selecionado' : 'No selected game'}</h2>
            <StatusSignal
              detail={
                isPtBr
                  ? 'A calibração ainda não forneceu um jogo confiável.'
                  : 'Calibration has not provided a trusted game yet.'
              }
              state="empty"
            />
          </>
        )}
      </section>

      <section
        aria-labelledby="system-state-ledger-title"
        data-home-region-order="3"
        data-lb-region
      >
        <h2 id="system-state-ledger-title">
          {isPtBr ? 'Registro do estado do sistema' : 'System state ledger'}
        </h2>
        {(
          [
            ['ready', isPtBr ? 'Pronto' : 'Ready'],
            ['attention', isPtBr ? 'Precisa de atenção' : 'Needs attention'],
            ['unavailable', isPtBr ? 'Indisponível' : 'Unavailable'],
          ] as const
        ).map(([group, label]) => (
          <section aria-labelledby={`ledger-${group}`} key={group}>
            <h3 id={`ledger-${group}`}>{label}</h3>
            {groups[group].length === 0 ? (
              <p>{isPtBr ? 'Nenhuma descoberta nesta categoria.' : 'No finding in this group.'}</p>
            ) : (
              <ul>
                {groups[group].map((claim) => (
                  <li data-claim-source={claim.source} key={claim.id}>
                    <strong>{claim.label}</strong>
                    <StatusSignal detail={claim.detail} state={claim.state} />
                    <span>
                      {isPtBr ? 'Fonte' : 'Source'}: {claim.source}
                    </span>
                    <FreshnessStamp
                      capturedAt={claim.capturedAt}
                      freshness={claim.freshness}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </section>

      {calibration.incompleteSteps.length > 0 ? (
        <aside
          aria-label={isPtBr ? 'Progresso opcional da calibração' : 'Optional calibration progress'}
          data-prominence={continueDominant ? 'dominant' : 'quiet'}
        >
          <p>
            {isPtBr ? 'Etapas opcionais concluídas' : 'Optional steps complete'}:{' '}
            {String(calibration.optionalProgress.completed)}/
            {String(calibration.optionalProgress.total)}
          </p>
          {continueDominant ? (
            <LbButton onPress={() => onContinueCalibration?.()} variant="primary">
              {isPtBr ? 'Continuar calibração' : 'Continue calibration'}
            </LbButton>
          ) : null}
        </aside>
      ) : null}
    </main>
  );
};
