import {
  FreshnessStamp,
  LbButton,
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

const DEFAULT_VARIANT_COPY: Readonly<Record<ShellLocale, Readonly<Record<HomeVariant, string>>>> = {
  en: {
    ready: 'Analysis complete · no critical action',
    recommendations: 'A safe simulated plan is ready for review',
    'game-ready': 'The selected game has a scenario-ready profile',
    'game-running': 'Game detected · disruptive actions paused',
    'restart-pending': 'A reviewed scenario plan is waiting for restart',
    'recovery-required': 'Recovery needs attention before new work continues',
    'offline-entitled': 'Offline access remains inside the valid entitlement window',
    'expired-entitlement': 'Premium actions are blocked; recovery remains available',
    'unsupported-windows': 'This Windows lifecycle is unsupported for recommendations',
    'critical-security': 'Conflicting evidence requires a fail-closed review',
    'calibration-incomplete': 'Calibration needs more trusted local evidence',
    'evidence-stale': 'Some evidence needs partial revalidation',
  },
  'pt-BR': {
    ready: 'Análise concluída · nenhuma ação crítica',
    recommendations: 'Um plano simulado seguro está pronto para revisão',
    'game-ready': 'O jogo selecionado tem um perfil pronto no cenário',
    'game-running': 'Jogo detectado · ações disruptivas pausadas',
    'restart-pending': 'Um plano revisado do cenário aguarda reinicialização',
    'recovery-required': 'A recuperação precisa de atenção antes de novos trabalhos',
    'offline-entitled': 'O acesso offline continua dentro da janela válida',
    'expired-entitlement': 'Ações Premium estão bloqueadas; a recuperação continua disponível',
    'unsupported-windows': 'Este ciclo de vida do Windows não recebe recomendações',
    'critical-security': 'Evidências conflitantes exigem uma revisão segura',
    'calibration-incomplete': 'A calibração precisa de mais evidência local confiável',
    'evidence-stale': 'Parte da evidência precisa de revalidação',
  },
};

const Icon = ({
  name,
}: {
  readonly name:
    'chip' | 'gauge' | 'memory' | 'pulse' | 'target' | 'temperature' | 'window' | 'zap';
}) => {
  const paths = {
    chip: (
      <>
        <rect height="12" rx="1" width="12" x="6" y="6" />
        <path d="M9 9h6v6H9zM9 2v4m3-4v4m3-4v4M9 18v4m3-4v4m3-4v4M2 9h4m-4 3h4m-4 3h4m12-6h4m-4 3h4m-4 3h4" />
      </>
    ),
    gauge: (
      <>
        <path d="M4.9 19a9 9 0 1 1 14.2 0" />
        <path d="m12 13 4-4M7 16h.01M12 6h.01M17 16h.01" />
      </>
    ),
    memory: (
      <>
        <rect height="10" rx="1" width="16" x="4" y="7" />
        <path d="M8 10h8v4H8zM7 4v3m4-3v3m4-3v3m2 10v3m-5-3v3m-5-3v3M2 10h2m-2 4h2m16-4h2m-2 4h2" />
      </>
    ),
    pulse: <path d="M3 12h4l2-6 4 12 2-6h6" />,
    target: (
      <>
        <circle cx="12" cy="12" r="7" />
        <circle cx="12" cy="12" r="2" />
        <path d="M12 2v3m0 14v3M2 12h3m14 0h3" />
      </>
    ),
    temperature: (
      <>
        <path d="M10 14.5V5a2 2 0 1 1 4 0v9.5a4 4 0 1 1-4 0Z" />
        <path d="M12 8v8" />
      </>
    ),
    window: (
      <>
        <rect height="16" rx="1" width="18" x="3" y="4" />
        <path d="M3 9h18M9 9v11" />
      </>
    ),
    zap: <path d="m13 2-8 12h6l-1 8 9-13h-6V2Z" />,
  } as const;

  return (
    <svg aria-hidden="true" className="lb-home-line-icon" viewBox="0 0 24 24">
      {paths[name]}
    </svg>
  );
};

const TelemetryChart = ({ isPtBr }: { readonly isPtBr: boolean }) => (
  <figure className="lb-home-telemetry">
    <header>
      <div>
        <h2>{isPtBr ? 'Telemetria' : 'Telemetry'}</h2>
        <p>
          {isPtBr ? 'Frametime (ms)' : 'Frametime (ms)'}
          <span aria-label={isPtBr ? 'Informação' : 'Information'}>i</span>
        </p>
      </div>
      <p className="lb-home-telemetry-average">
        <span>{isPtBr ? 'MÉDIA' : 'AVERAGE'}</span>
        <strong>16.7 ms</strong>
      </p>
    </header>
    <svg
      aria-label={
        isPtBr
          ? 'Gráfico demonstrativo de frametime dos últimos sessenta segundos'
          : 'Demonstration frametime chart for the last sixty seconds'
      }
      className="lb-home-chart"
      role="img"
      viewBox="0 0 620 220"
    >
      <g className="lb-home-chart-grid">
        <path d="M36 20H610M36 70H610M36 120H610M36 170H610" />
      </g>
      <g className="lb-home-chart-axis">
        <text x="4" y="25">
          40
        </text>
        <text x="4" y="75">
          30
        </text>
        <text x="4" y="125">
          20
        </text>
        <text x="4" y="175">
          10
        </text>
        <text x="4" y="211">
          0
        </text>
        <text x="36" y="211">
          −60s
        </text>
        <text textAnchor="end" x="610" y="211">
          0s
        </text>
      </g>
      <path
        className="lb-home-chart-line"
        d="M36 139l9-3 8 5 8-7 8 4 8 1 8-3 8 5 8-8 8 4 8-9 8 12 8-1 8-4 8 6 8-3 8 1 8-6 8 4 8 5 8-2 8 4 8-7 8 2 8-3 8 4 8-2 8 7 8-4 8-2 8 4 8-8 8 3 8-1 8 6 8-7 8 4 8-1 8 5 8-4 8-1 8 7 8-5 8 1 8-3 8 6 8-2 8-3 8 4 8-7 8 3 8-1 8 5 8-5 8 3 8-2 8 1 8-4 8 6 8-2 8 4 8-9 8 6 8-3 8 2 8-5 8 7 8-2"
      />
    </svg>
    <figcaption className="lb-home-telemetry-stats">
      {[
        ['1% LOW', '11.2 ms'],
        ['0.1% LOW', '8.3 ms'],
        [isPtBr ? 'FPS MÉDIO' : 'AVG FPS', '121'],
        [isPtBr ? 'FPS ATUAL' : 'CURRENT FPS', '118'],
      ].map(([label, value]) => (
        <span key={label}>
          <small>{label}</small>
          <strong>{value}</strong>
        </span>
      ))}
    </figcaption>
  </figure>
);

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
  const planAction = nextAction?.onPress ?? onContinueCalibration;
  const scoreAvailable = !limited && !incomplete;
  const actionLabel = limited
    ? isPtBr
      ? 'Tentar novamente'
      : 'Retry'
    : incomplete
      ? isPtBr
        ? 'Continuar calibração'
        : 'Continue calibration'
      : isPtBr
        ? 'Executar otimização'
        : 'Run optimization';
  const action = limited ? onRetry : incomplete ? onContinueCalibration : planAction;
  const title = limited
    ? isPtBr
      ? 'Modo limitado seguro'
      : 'Safe limited mode'
    : incomplete
      ? isPtBr
        ? 'Calibração incompleta'
        : 'Calibration incomplete'
      : isPtBr
        ? 'Sistema pronto para desempenho máximo'
        : 'System ready for maximum performance';

  const metrics = [
    { icon: 'gauge' as const, label: isPtBr ? 'Latência' : 'Latency', value: '18', unit: 'ms' },
    {
      icon: 'temperature' as const,
      label: isPtBr ? 'Temperatura GPU' : 'GPU temperature',
      value: '64',
      unit: '°C',
    },
    { icon: 'chip' as const, label: 'CPU', value: '52', unit: '°C' },
    { icon: 'memory' as const, label: isPtBr ? 'Memória' : 'Memory', value: '9,2', unit: 'GB' },
    {
      icon: 'pulse' as const,
      label: isPtBr ? 'Processos ativos' : 'Active processes',
      value: '12',
      unit: isPtBr ? 'processos' : 'processes',
    },
  ];
  const planRows = [
    {
      icon: 'target' as const,
      label: isPtBr ? 'Prioridade de jogo' : 'Game priority',
      detail: isPtBr
        ? 'Otimizar alocação de CPU e threads para o jogo ativo'
        : 'Optimize CPU and thread allocation for the active game',
    },
    {
      icon: 'window' as const,
      label: isPtBr ? 'Processos de fundo' : 'Background processes',
      detail: isPtBr
        ? 'Reduzir atividades desnecessárias em segundo plano'
        : 'Reduce unnecessary background activity',
    },
    {
      icon: 'zap' as const,
      label: isPtBr ? 'Plano de energia' : 'Power plan',
      detail: isPtBr ? 'Aplicar perfil de desempenho máximo' : 'Apply maximum performance profile',
    },
  ];

  return (
    <main
      aria-labelledby="contextual-home-title"
      className="lb-contextual-home"
      data-home-variant={variant}
      data-locale={locale}
      data-scenario-id={scenarioId}
    >
      <span className="lb-visually-hidden">scenario:{scenarioId}</span>

      <header className="lb-home-heading">
        <h1 id="contextual-home-title" tabIndex={-1}>
          {title}
        </h1>
        <p>{limitationReason ?? DEFAULT_VARIANT_COPY[locale][variant]}</p>
      </header>

      <section
        aria-label={isPtBr ? 'Resumo e telemetria' : 'Summary and telemetry'}
        className="lb-home-overview"
        data-home-region-order="1"
      >
        <div className="lb-home-score">
          <span className="lb-home-simulation-label">
            {isPtBr ? 'Cenário simulado' : 'Simulated scenario'} · {scenarioId}
          </span>
          <p
            aria-label={isPtBr ? 'Pontuação simulada' : 'Simulated score'}
            className="lb-home-score-value"
          >
            <strong>{scoreAvailable ? '92' : '—'}</strong>
            <span>/ 100</span>
          </p>
          <p className="lb-home-score-status">
            {limited
              ? isPtBr
                ? 'Protegido'
                : 'Protected'
              : incomplete
                ? isPtBr
                  ? 'Pendente'
                  : 'Pending'
                : isPtBr
                  ? 'Excelente'
                  : 'Excellent'}
          </p>
          <LbButton
            isDisabled={action === undefined}
            onPress={() => {
              action?.();
            }}
            variant="primary"
          >
            {actionLabel}
          </LbButton>
          <p className="lb-home-action-note">
            {limited
              ? isPtBr
                ? 'Nenhuma recomendação é exibida.'
                : 'No recommendation is shown.'
              : isPtBr
                ? 'Você revisará cada alteração antes de aplicar.'
                : 'You will review every change before applying it.'}
          </p>
        </div>
        <TelemetryChart isPtBr={isPtBr} />
      </section>

      <section
        aria-label={isPtBr ? 'Métricas demonstrativas' : 'Demonstration metrics'}
        className="lb-home-metrics"
        data-home-region-order="2"
      >
        {metrics.map((metric) => (
          <article key={metric.label}>
            <Icon name={metric.icon} />
            <span>
              <small>{metric.label}</small>
              <strong>{scoreAvailable ? metric.value : '—'}</strong>
              <em>{metric.unit}</em>
            </span>
          </article>
        ))}
      </section>

      <section
        aria-labelledby="recommended-plan-title"
        className="lb-home-plan"
        data-home-region-order="3"
        data-lb-region
      >
        <h2 id="recommended-plan-title">{isPtBr ? 'Plano recomendado' : 'Recommended plan'}</h2>
        <div className="lb-home-plan-rows">
          {limited ? (
            <div className="lb-home-plan-blocked">
              <StatusSignal locale={locale} state="permission" />
              <p>{limitationReason ?? DEFAULT_VARIANT_COPY[locale][variant]}</p>
            </div>
          ) : (
            planRows.map((row) => {
              const content = (
                <>
                  <Icon name={row.icon} />
                  <strong>{row.label}</strong>
                  <span>{row.detail}</span>
                  <span aria-hidden="true" className="lb-home-plan-chevron">
                    ›
                  </span>
                </>
              );

              return planAction === undefined ? (
                <div className="lb-home-plan-row" key={row.label}>
                  {content}
                </div>
              ) : (
                <button
                  className="lb-home-plan-row"
                  key={row.label}
                  onClick={planAction}
                  type="button"
                >
                  {content}
                </button>
              );
            })
          )}
        </div>

        <details className="lb-home-evidence">
          <summary>
            {isPtBr ? 'Detalhes do cenário simulado' : 'Simulated scenario details'}
          </summary>
          <div>
            {selectedGame ? (
              <section aria-label={isPtBr ? 'Jogo selecionado' : 'Selected game'}>
                <h3>{selectedGame.name}</h3>
                <p>{selectedGame.profileState}</p>
                <FreshnessStamp
                  capturedAt={selectedGame.capturedAt}
                  freshness={selectedGame.freshness}
                  locale={locale}
                />
              </section>
            ) : null}
            <ul>
              {claims.map((claim) => (
                <li data-claim-source={claim.source} key={claim.id}>
                  <strong>{claim.label}</strong>
                  <span>{claim.detail}</span>
                </li>
              ))}
            </ul>
          </div>
        </details>
      </section>

      <footer className="lb-home-safety">
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M12 3 5 6v5c0 4.8 2.8 8.2 7 10 4.2-1.8 7-5.2 7-10V6l-7-3Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
        {isPtBr ? 'Alterações seguras e reversíveis' : 'Safe and reversible changes'}
      </footer>
    </main>
  );
};
