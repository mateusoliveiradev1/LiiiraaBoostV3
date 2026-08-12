import { ProductIcon } from '@liiiraa/design-system';
import type { ProductIconName } from '@liiiraa/design-system';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import type { ShellLocale } from '@liiiraa/feature-shell';
import type {
  HardwareFactJson,
  InventorySnapshotJson,
  ShellInstallerIdentityJson,
} from '@liiiraa/contracts-ts';
import type { EvidenceAuthority, EvidenceAuthoritySnapshot } from '@liiiraa/desktop-client';
import { PreConsentLocaleControl } from '../preferences.js';
import {
  DOWNLOADS,
  INSTALLED_APPS,
  OPERATION_CATALOGS,
  POWER_PLANS,
  SERVICES,
  SHORTCUTS,
  type CatalogRouteId,
  type InstalledAppItem,
  type OperationItem,
  type PremiumRouteId,
} from './control-center-data.js';
import { BrandIcon } from './brand-icons.js';
import {
  GAME_PROFILES,
  type GameProfile,
  persistActiveGameProfile,
  readActiveGameProfile,
  resolveGameProfile,
} from './game-profiles.js';
import { PremiumDownloadsSurface } from './premium-downloads.js';
import {
  createPremiumUpdater,
  type PremiumUpdateCheckStageId,
  type PremiumUpdateManifest,
} from './premium-updater.js';
import { usePremiumLocalization } from './premium-localization.js';
import { areApplicationNotificationsEnabled, PremiumSettingsSurface } from './premium-settings.js';
import { PremiumToast, type PremiumToastMessage, type PremiumToastTone } from './premium-toast.js';
import {
  createTauriLiveTelemetryAuthority,
  type LiveTelemetryAuthority,
  type LiveTelemetryAuthoritySnapshot,
  type LiveScalarMetric,
} from '../native/live-telemetry.js';

interface PremiumOperationsSurfaceProps {
  readonly evidenceAuthority?: EvidenceAuthority | undefined;
  readonly installerIdentity?: ShellInstallerIdentityJson | undefined;
  readonly locale: ShellLocale;
  readonly navigate: (pathname: string) => void;
  readonly settingsSection?: string;
  readonly view: PremiumRouteId;
}

const EMPTY_INTERNAL_EVIDENCE: EvidenceAuthoritySnapshot = Object.freeze({
  revision: 0,
  origin: 'native',
  status: 'idle',
  inventory: null,
  capture: null,
  comparison: null,
  report: null,
  selection: Object.freeze({ beforeSessionId: null, afterSessionId: null }),
  staleInventory: false,
  inventoryActionable: false,
  error: null,
});

const EMPTY_INTERNAL_TELEMETRY: LiveTelemetryAuthoritySnapshot = Object.freeze({
  revision: 0,
  status: 'idle',
  telemetry: null,
});

const emptyInternalSubscribe = (): (() => void) => () => undefined;

interface RouteMeta {
  readonly description: string;
  readonly icon: ProductIconName;
  readonly title: string;
}

const ROUTE_META: Readonly<Record<PremiumRouteId, RouteMeta>> = Object.freeze({
  home: {
    description: 'Estado do computador, próxima ação e evidências em um só lugar.',
    icon: 'gauge',
    title: 'Visão geral',
  },
  competitive: {
    description: 'Prepare recursos, processos e serviços para uma sessão competitiva.',
    icon: 'competitive',
    title: 'Modo Competitivo',
  },
  toggles: {
    description: 'Controles rápidos do Windows organizados por objetivo.',
    icon: 'toggles',
    title: 'Controles rápidos',
  },
  shortcuts: {
    description: 'Acesso direto às configurações e ferramentas nativas do Windows.',
    icon: 'toolbox',
    title: 'Atalhos',
  },
  power: {
    description: 'Planos de energia compatíveis, explicados e reversíveis.',
    icon: 'power',
    title: 'Planos de energia',
  },
  network: {
    description: 'Ajustes próprios para latência, estabilidade e conectividade.',
    icon: 'wifi',
    title: 'Rede',
  },
  tweaks: {
    description: 'Ajustes avançados de GPU, CPU, entrada, memória e armazenamento.',
    icon: 'sliders',
    title: 'Tweaks',
  },
  security: {
    description: 'Equilibre compatibilidade e proteção sem recomendações irresponsáveis.',
    icon: 'shield',
    title: 'Segurança',
  },
  services: {
    description: 'Revise inicialização, dependências e impacto dos serviços do Windows.',
    icon: 'services',
    title: 'Serviços',
  },
  restoration: {
    description: 'Desfaça alterações e recupere componentes com rastreabilidade.',
    icon: 'recovery',
    title: 'Restauração',
  },
  uninstaller: {
    description: 'Remova programas com proteção para componentes essenciais.',
    icon: 'trash',
    title: 'Desinstalador',
  },
  downloads: {
    description: 'Ferramentas confiáveis, licenças claras e fontes oficiais.',
    icon: 'download',
    title: 'Downloads',
  },
  settings: {
    description: 'Preferências do aplicativo, privacidade, aparência e atualizações.',
    icon: 'settings',
    title: 'Configurações',
  },
  about: {
    description: 'Versão, integridade, termos, licenças e canais oficiais.',
    icon: 'info',
    title: 'Sobre',
  },
  activity: {
    description: 'Eventos, alterações pendentes e ações recentes do aplicativo.',
    icon: 'activity',
    title: 'Atividade',
  },
});

const INITIAL_OPERATION_STATE = Object.freeze(
  Object.fromEntries(
    Object.values(OPERATION_CATALOGS)
      .flat()
      .map(({ active, id }) => [id, active]),
  ),
) as Readonly<Record<string, boolean>>;

const humanCount = (count: number, singular: string, plural: string): string =>
  `${String(count)} ${count === 1 ? singular : plural}`;

const text = (locale: ShellLocale, ptBr: string, english: string): string =>
  locale === 'pt-BR' ? ptBr : english;

const getInitialActiveGame = (): GameProfile => {
  try {
    return readActiveGameProfile(globalThis.localStorage);
  } catch {
    return resolveGameProfile(null);
  }
};

const PremiumButton = ({
  children,
  disabled = false,
  onClick,
  tone = 'secondary',
  type = 'button',
}: {
  readonly children: ReactNode;
  readonly disabled?: boolean;
  readonly onClick?: () => void;
  readonly tone?: 'danger' | 'primary' | 'quiet' | 'secondary';
  readonly type?: 'button' | 'submit';
}) => (
  <button
    className="premium-button"
    data-tone={tone}
    disabled={disabled}
    onClick={onClick}
    type={type}
  >
    {children}
  </button>
);

const RouteHeader = ({
  action,
  meta,
  showDemoBadge = true,
}: {
  readonly action?: ReactNode;
  readonly meta: RouteMeta;
  readonly showDemoBadge?: boolean;
}) => (
  <header className="premium-route-header">
    <div className="premium-route-heading">
      <span className="premium-route-icon">
        <ProductIcon name={meta.icon} size={24} weight="duotone" />
      </span>
      <div>
        <h1 data-route-heading tabIndex={-1}>
          {meta.title}
        </h1>
        <p>{meta.description}</p>
      </div>
    </div>
    <div className="premium-route-actions">
      {showDemoBadge ? (
        <span className="premium-demo-badge">
          <span aria-hidden="true" />
          Demonstração segura
        </span>
      ) : null}
      {action}
    </div>
  </header>
);

const HardwareStrip = ({
  inventory,
  locale,
}: Readonly<{ inventory: InventorySnapshotJson | null; locale: ShellLocale }>) => (
  <section
    aria-label={text(locale, 'Hardware observado pelo Windows', 'Hardware observed by Windows')}
    className="premium-hardware-strip"
  >
    {([
      ['Sistema', inventory?.windows, 'windows'],
      ['Processador', inventory?.cpu, 'cpu'],
      ['Placa de vídeo', inventory?.gpu, 'graphics'],
      ['Memória', inventory?.memory, 'memory'],
    ] satisfies readonly (readonly [string, HardwareFactJson | undefined, ProductIconName])[]).map(([label, fact, icon]) => (
      <div key={label}>
        <ProductIcon name={icon as ProductIconName} size={21} weight="duotone" />
        <span>
          <small>{label}</small>
          <strong>
            {typeof fact === 'object' && fact !== null && 'state' in fact && fact.state === 'observed'
              ? fact.value
              : text(locale, 'Não disponível', 'Not available')}
          </strong>
        </span>
      </div>
    ))}
  </section>
);

const SearchAndFilter = ({
  activeFilter,
  categories,
  onFilter,
  onQuery,
  query,
}: {
  readonly activeFilter: string;
  readonly categories: readonly string[];
  readonly onFilter: (value: string) => void;
  readonly onQuery: (value: string) => void;
  readonly query: string;
}) => (
  <div className="premium-filter-bar">
    <label className="premium-search">
      <ProductIcon name="search" size={18} />
      <span className="lb-visually-hidden">Pesquisar nesta rota</span>
      <input
        onChange={(event) => {
          onQuery(event.currentTarget.value);
        }}
        placeholder="Pesquisar ajustes..."
        type="search"
        value={query}
      />
    </label>
    <div aria-label="Filtrar categoria" className="premium-filter-chips" role="group">
      {['Todos', ...categories].map((category) => (
        <button
          aria-pressed={activeFilter === category}
          key={category}
          onClick={() => {
            onFilter(category);
          }}
          type="button"
        >
          {category}
        </button>
      ))}
    </div>
  </div>
);

const OperationRow = ({
  active,
  item,
  onToggle,
}: {
  readonly active: boolean;
  readonly item: OperationItem;
  readonly onToggle: () => void;
}) => (
  <article className="premium-operation-row" data-category={item.category} data-risk={item.risk}>
    <span className="premium-operation-icon" title={item.description}>
      <ProductIcon name={item.icon} size={22} weight="duotone" />
    </span>
    <div className="premium-operation-copy">
      <div>
        <h3>{item.title}</h3>
        {item.recommended ? <span className="premium-recommended">Recomendado</span> : null}
      </div>
      <p>{item.description}</p>
      <ul aria-label="Metadados do ajuste">
        <li>Risco {item.risk}</li>
        {item.restart ? <li>Requer reinicialização</li> : <li>Aplicação sem reiniciar</li>}
        <li>{item.category}</li>
      </ul>
    </div>
    <button
      aria-checked={active}
      aria-label={`${active ? 'Desativar' : 'Ativar'} ${item.title}`}
      className="premium-switch"
      onClick={onToggle}
      role="switch"
      type="button"
    >
      <span />
    </button>
  </article>
);

const PlanBar = ({
  changeCount,
  onDiscard,
  onReview,
}: {
  readonly changeCount: number;
  readonly onDiscard: () => void;
  readonly onReview: () => void;
}) =>
  changeCount > 0 ? (
    <aside aria-label="Plano de alterações" className="premium-plan-bar">
      <span className="premium-plan-bar-icon">
        <ProductIcon name="list" size={22} weight="duotone" />
      </span>
      <div>
        <strong>{humanCount(changeCount, 'alteração preparada', 'alterações preparadas')}</strong>
        <small>Nada foi aplicado ao Windows. Revise compatibilidade e recuperação primeiro.</small>
      </div>
      <PremiumButton onClick={onDiscard} tone="quiet">
        Descartar
      </PremiumButton>
      <PremiumButton onClick={onReview} tone="primary">
        Revisar plano
      </PremiumButton>
    </aside>
  ) : null;

type HomeAnalysisPhase = 'catalog' | 'complete' | 'hardware' | 'idle' | 'recovery';

const HOME_ANALYSIS_PROGRESS: Readonly<Record<HomeAnalysisPhase, number>> = Object.freeze({
  catalog: 82,
  complete: 100,
  hardware: 24,
  idle: 0,
  recovery: 56,
});

const HomeSurface = ({
  activeGame,
  evidenceAuthority,
  liveTelemetryAuthority,
  locale,
  navigate,
  notify,
}: {
  readonly activeGame: GameProfile;
  readonly evidenceAuthority?: EvidenceAuthority | undefined;
  readonly liveTelemetryAuthority: LiveTelemetryAuthority;
  readonly locale: ShellLocale;
  readonly navigate: (pathname: string) => void;
  readonly notify: (message: string) => void;
}) => {
  const evidence = useSyncExternalStore(
    evidenceAuthority === undefined
      ? emptyInternalSubscribe
      : (notify) => evidenceAuthority.subscribe(() => notify()),
    evidenceAuthority?.snapshot ?? (() => EMPTY_INTERNAL_EVIDENCE),
    () => EMPTY_INTERNAL_EVIDENCE,
  );
  const live = useSyncExternalStore(
    liveTelemetryAuthority.subscribe,
    liveTelemetryAuthority.snapshot,
    () => EMPTY_INTERNAL_TELEMETRY,
  );
  const [analysisPhase, setAnalysisPhase] = useState<HomeAnalysisPhase>('idle');
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const analysisTimersRef = useRef<number[]>([]);
  const isAnalyzing =
    analysisPhase === 'hardware' || analysisPhase === 'recovery' || analysisPhase === 'catalog';
  const analysisProgress = HOME_ANALYSIS_PROGRESS[analysisPhase];
  const analysisLabel =
    analysisPhase === 'hardware'
      ? text(locale, 'Identificando hardware e sistema', 'Identifying hardware and system')
      : analysisPhase === 'recovery'
        ? text(locale, 'Validando caminho de recuperação', 'Validating recovery path')
        : analysisPhase === 'catalog'
          ? text(locale, 'Revisando ajustes compatíveis', 'Reviewing compatible controls')
          : text(locale, 'Análise concluída com segurança', 'Analysis completed safely');

  useEffect(
    () => () => {
      analysisTimersRef.current.forEach((timer) => {
        window.clearTimeout(timer);
      });
    },
    [],
  );

  useEffect(() => {
    if (evidenceAuthority === undefined) return undefined;
    const controller = new AbortController();
    const collectedAt = new Date().toISOString();
    void evidenceAuthority.refreshInventory({
      signal: controller.signal,
      request: {
        schemaVersion: '1.0',
        evidenceId: `home-inventory-${Date.now().toString(36)}`,
        evidenceVersion: (evidenceAuthority.snapshot().inventory?.evidenceVersion ?? 0) + 1,
        collectedAt,
        deadlineAt: new Date(Date.now() + 10_000).toISOString(),
        perSourceTimeoutMs: 750,
        policyDate: Number(collectedAt.slice(0, 10).replaceAll('-', '')),
      },
    });
    return () => controller.abort();
  }, [evidenceAuthority]);

  useEffect(() => {
    let active = true;
    const poll = () => {
      if (active) void liveTelemetryAuthority.read();
    };
    poll();
    const timer = globalThis.setInterval(poll, 1_100);
    return () => {
      active = false;
      globalThis.clearInterval(timer);
    };
  }, [liveTelemetryAuthority]);

  const liveValue = (metric: LiveScalarMetric | undefined): string => {
    if (metric?.state !== 'observed' || metric.value === null) {
      return text(locale, 'Indisponível', 'Unavailable');
    }
    const value = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(metric.value);
    return metric.unit === 'percent' ? `${value}%` : `${value} ms`;
  };
  const memoryValue =
    live.telemetry?.memory.state === 'observed' && live.telemetry.memory.usedBytes !== null
      ? `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(live.telemetry.memory.usedBytes / 1_073_741_824)} GB`
      : text(locale, 'Indisponível', 'Unavailable');
  const memoryDetail =
    live.telemetry?.memory.state === 'observed' && live.telemetry.memory.loadPercent !== null
      ? `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(live.telemetry.memory.loadPercent)}%`
      : live.telemetry?.memory.detail ?? text(locale, 'Aguardando leitura nativa', 'Waiting for native reading');

  const startAnalysis = (): void => {
    if (isAnalyzing) {
      return;
    }

    analysisTimersRef.current.forEach((timer) => {
      window.clearTimeout(timer);
    });
    analysisTimersRef.current = [];
    setAnalysisPhase('hardware');

    analysisTimersRef.current.push(
      window.setTimeout(() => {
        setAnalysisPhase('recovery');
      }, 520),
      window.setTimeout(() => {
        setAnalysisPhase('catalog');
      }, 1040),
      window.setTimeout(() => {
        setAnalysisPhase('complete');
        setHasAnalyzed(true);
        notify(
          text(
            locale,
            'Análise demonstrativa concluída. As evidências foram atualizadas e nenhuma alteração foi aplicada.',
            'Demonstration analysis completed. Evidence was updated and no changes were applied.',
          ),
        );
      }, 1620),
      window.setTimeout(() => {
        setAnalysisPhase('idle');
      }, 3820),
    );
  };

  return (
    <>
      <HardwareStrip inventory={evidence.inventory} locale={locale} />
      <section className="premium-home-grid">
        <article className="premium-readiness-card">
          <div className="premium-readiness-primary">
            <div
              className="premium-readiness-status"
              data-phase={isAnalyzing ? 'analyzing' : 'ready'}
            >
              <span className="premium-readiness-status-icon" aria-hidden="true">
                <ProductIcon name={isAnalyzing ? 'loading' : 'shield'} size={25} weight="duotone" />
              </span>
              <span>
                <strong>
                  {isAnalyzing
                    ? text(locale, 'Verificando', 'Checking')
                    : text(locale, 'Sistema pronto', 'System ready')}
                </strong>
                <small>
                  {isAnalyzing
                    ? text(locale, 'Somente leitura', 'Read-only')
                    : text(locale, 'Cenário compatível', 'Compatible scenario')}
                </small>
              </span>
            </div>
            <div className="premium-readiness-copy">
              <h2>
                {text(locale, 'Pronto para sua próxima sessão', 'Ready for your next session')}
              </h2>
              <p>
                {text(
                  locale,
                  'Hardware, recuperação e compatibilidade foram verificados neste cenário demonstrativo.',
                  'Hardware, recovery, and compatibility were verified in this demonstration scenario.',
                )}
              </p>
              <div className="premium-inline-actions">
                <PremiumButton
                  onClick={() => {
                    navigate('/competitive');
                  }}
                  tone="primary"
                >
                  {text(locale, 'Abrir Modo Competitivo', 'Open Competitive Mode')}
                </PremiumButton>
                <PremiumButton disabled={isAnalyzing} onClick={startAnalysis}>
                  <ProductIcon
                    name={isAnalyzing ? 'loading' : 'recovery'}
                    size={16}
                    weight="bold"
                  />
                  {isAnalyzing
                    ? text(locale, 'Analisando…', 'Analyzing…')
                    : text(locale, 'Analisar novamente', 'Analyze again')}
                </PremiumButton>
              </div>
              {analysisPhase === 'idle' ? null : analysisPhase === 'complete' ? (
                <div aria-live="polite" className="premium-analysis-complete" role="status">
                  <ProductIcon name="check" size={16} weight="bold" />
                  <span>
                    <strong>{text(locale, 'Análise concluída', 'Analysis completed')}</strong>
                    <small>{text(locale, 'Evidências atualizadas', 'Evidence updated')}</small>
                  </span>
                </div>
              ) : (
                <div
                  aria-live="polite"
                  className="premium-analysis-progress"
                  data-phase={analysisPhase}
                  role="status"
                >
                  <div className="premium-analysis-progress-copy">
                    <span>
                      <ProductIcon name="loading" size={15} weight="bold" />
                      {analysisLabel}
                    </span>
                    <strong>{String(analysisProgress)}%</strong>
                  </div>
                  <div
                    aria-label={text(locale, 'Progresso da análise', 'Analysis progress')}
                    aria-valuemax={100}
                    aria-valuemin={0}
                    aria-valuenow={analysisProgress}
                    className="premium-analysis-progress-track"
                    role="progressbar"
                  >
                    <span style={{ inlineSize: `${String(analysisProgress)}%` }} />
                  </div>
                </div>
              )}
            </div>
            <div className="premium-readiness-next">
              <div className="premium-readiness-next-copy">
                <span className="premium-section-label">
                  {text(locale, 'Revisão pendente', 'Pending review')}
                </span>
                <strong>
                  <ProductIcon name="sliders" size={20} weight="duotone" />
                  {text(locale, '5 ajustes compatíveis', '5 compatible controls')}
                </strong>
                <p>
                  {text(
                    locale,
                    'Escolha o que deseja preparar. Nada será aplicado sem sua confirmação.',
                    'Choose what you want to prepare. Nothing will be applied without your confirmation.',
                  )}
                </p>
              </div>
              <PremiumButton
                onClick={() => {
                  navigate('/toggles');
                }}
              >
                {text(locale, 'Revisar ajustes', 'Review controls')}
              </PremiumButton>
            </div>
          </div>
          <aside
            className="premium-readiness-evidence"
            aria-label={text(locale, 'Resumo da prontidão', 'Readiness summary')}
          >
            <header>
              <span>
                <ProductIcon name="shield" size={17} weight="duotone" />
                {text(locale, 'Evidências de prontidão', 'Readiness evidence')}
              </span>
              <strong>
                <span aria-hidden="true" />
                {isAnalyzing
                  ? text(locale, 'Análise em andamento', 'Analysis in progress')
                  : analysisPhase === 'complete' || hasAnalyzed
                    ? text(locale, 'Verificado agora', 'Verified just now')
                    : text(locale, 'Atualizado agora', 'Updated just now')}
              </strong>
            </header>
            <ul>
              <li>
                <span className="premium-readiness-evidence-icon">
                  <ProductIcon name="recovery" size={16} weight="duotone" />
                </span>
                <span>
                  <strong>{text(locale, 'Recuperação pronta', 'Recovery ready')}</strong>
                  <small>
                    {text(locale, 'Ponto de restauração disponível', 'Restore point available')}
                  </small>
                </span>
              </li>
              <li>
                <span className="premium-readiness-evidence-icon">
                  <ProductIcon name="microchip" size={16} weight="duotone" />
                </span>
                <span>
                  <strong>{text(locale, 'Hardware compatível', 'Compatible hardware')}</strong>
                  <small>
                    {text(
                      locale,
                      'Perfil validado para este cenário',
                      'Profile validated for this scenario',
                    )}
                  </small>
                </span>
              </li>
              <li data-tone="attention">
                <span className="premium-readiness-evidence-icon">
                  <ProductIcon name="sliders" size={16} weight="duotone" />
                </span>
                <span>
                  <strong>{text(locale, '5 ajustes para revisar', '5 controls to review')}</strong>
                  <small>
                    {text(locale, 'Nenhuma mudança aplicada ainda', 'No changes applied yet')}
                  </small>
                </span>
              </li>
            </ul>
          </aside>
        </article>
        <article className="premium-game-card">
          <div className="premium-game-visual" data-game-id={activeGame.id}>
            <div aria-hidden="true" className="premium-game-cover-fallback">
              <BrandIcon brand={activeGame.brand} size={42} />
              <span>{activeGame.title}</span>
            </div>
            <img
              alt={`Arte oficial de ${activeGame.title}`}
              decoding="async"
              key={activeGame.id}
              loading="eager"
              onError={(event) => {
                event.currentTarget.hidden = true;
              }}
              src={activeGame.cover}
            />
            <span aria-hidden="true" className="premium-game-brand">
              <BrandIcon brand={activeGame.brand} size={22} />
            </span>
          </div>
          <span className="premium-section-label">Jogo selecionado</span>
          <h2>{activeGame.title}</h2>
          <p>Perfil competitivo · prioridade alta · restauração automática</p>
          <dl>
            <div>
              <dt>Última sessão</dt>
              <dd>{activeGame.sessionSummary}</dd>
            </div>
            <div>
              <dt>Perfil</dt>
              <dd>{activeGame.profileLabel}</dd>
            </div>
          </dl>
        </article>
        <article className="premium-metrics-panel">
          <header>
            <div>
              <span className="premium-section-label">Telemetria local</span>
              <h2>Leitura atual</h2>
            </div>
            <span className="premium-live">
              <span aria-hidden="true" />
              {live.status === 'ready'
                ? text(locale, 'Atualizando', 'Updating')
                : text(locale, 'Lendo', 'Reading')}
            </span>
          </header>
          <div className="premium-metric-grid">
            {[
              ['cpu', 'CPU', liveValue(live.telemetry?.cpu), live.telemetry?.cpu.detail],
              ['graphics', 'GPU', liveValue(live.telemetry?.gpu), live.telemetry?.gpu.detail],
              ['memory', text(locale, 'Memória', 'Memory'), memoryValue, memoryDetail],
              [
                'activity',
                text(locale, 'Tempo da coleta', 'Collection time'),
                liveValue(live.telemetry?.collectionLatency),
                live.telemetry?.collectionLatency.detail,
              ],
            ].map(([icon, label, value, detail]) => (
              <div key={label}>
                <span className="premium-metric-icon">
                  <ProductIcon name={icon as ProductIconName} size={18} weight="duotone" />
                </span>
                <span>
                  <small>{label}</small>
                  <strong>{value}</strong>
                  <em>{detail}</em>
                </span>
              </div>
            ))}
          </div>
          <footer className="premium-telemetry-context">
            <div>
              <ProductIcon name="shield" size={18} weight="duotone" />
              <span>
                <strong>Monitoramento somente leitura</strong>
                <small>{text(locale, 'Dados nativos deste computador', 'Native data from this computer')}</small>
              </span>
            </div>
            <span>
              <ProductIcon name="check" size={14} weight="fill" />
              Nenhuma alteração aplicada
            </span>
          </footer>
        </article>
        <article className="premium-next-actions">
          <header>
            <span className="premium-section-label">Próximas ações</span>
            <strong>3 recomendações</strong>
          </header>
          {[
            ['Rede', 'Revisar DNS medido e moderação de interrupções', '/network'],
            ['Energia', 'Ativar plano Liiiraa Adaptativo', '/power'],
            ['Segurança', 'Verificar compatibilidade do isolamento de núcleo', '/security'],
          ].map(([label, description, path]) => (
            <button
              key={label}
              onClick={() => {
                navigate(path ?? '/home');
              }}
              type="button"
            >
              <span>
                <small>{label}</small>
                <strong>{description}</strong>
              </span>
              <ProductIcon name="arrowRight" size={18} />
            </button>
          ))}
        </article>
      </section>
    </>
  );
};

const CompetitiveSurface = ({
  activeGame,
  notify,
  onActiveGameChange,
}: {
  readonly activeGame: GameProfile;
  readonly notify: (message: string) => void;
  readonly onActiveGameChange: (profile: GameProfile) => void;
}) => {
  const [sessionActive, setSessionActive] = useState(false);
  const [settings, setSettings] = useState({
    cpuSets: true,
    focus: true,
    ioPriority: true,
    network: false,
    pauseServices: true,
  });

  return (
    <div className="premium-competitive-layout">
      <section className="premium-competitive-hero">
        <div>
          <span className="premium-section-label">Perfil de sessão</span>
          <h2>{sessionActive ? 'Sessão competitiva ativa' : 'Prepare o ambiente do jogo'}</h2>
          <p>
            A Liiiraa organiza as mudanças num plano temporário e restaura o estado anterior ao
            encerrar.
          </p>
        </div>
        <div className="premium-game-selector">
          <label htmlFor="competitive-game">Jogo</label>
          <div className="premium-game-select-control" data-game-id={activeGame.id}>
            <span aria-hidden="true" className="premium-game-select-brand">
              <BrandIcon brand={activeGame.brand} size={20} />
            </span>
            <select
              id="competitive-game"
              onChange={(event) => {
                onActiveGameChange(resolveGameProfile(event.currentTarget.value));
              }}
              value={activeGame.id}
            >
              {GAME_PROFILES.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.title}
                </option>
              ))}
            </select>
          </div>
          <PremiumButton
            onClick={() => {
              notify('Biblioteca reexaminada no cenário demonstrativo.');
            }}
          >
            Reexaminar jogos
          </PremiumButton>
        </div>
      </section>
      <section className="premium-session-status" data-active={String(sessionActive)}>
        <span className="premium-session-orbit">
          <ProductIcon name={sessionActive ? 'rocket' : 'competitive'} size={34} weight="duotone" />
        </span>
        <div>
          <small>{activeGame.title}</small>
          <strong>{sessionActive ? 'Ambiente priorizado' : 'Pronto para iniciar'}</strong>
          <p>
            {sessionActive
              ? '5 ações simuladas ativas · recuperação preparada'
              : '5 ações selecionadas · nenhum risco crítico detectado'}
          </p>
        </div>
        <PremiumButton
          onClick={() => {
            setSessionActive((current) => !current);
            notify(
              sessionActive
                ? 'Sessão encerrada e estado demonstrativo restaurado.'
                : 'Sessão competitiva simulada iniciada.',
            );
          }}
          tone={sessionActive ? 'danger' : 'primary'}
        >
          {sessionActive ? 'Encerrar e restaurar' : 'Iniciar sessão'}
        </PremiumButton>
      </section>
      <section className="premium-session-options">
        <header>
          <div>
            <span className="premium-section-label">Ações da sessão</span>
            <h2>Prioridade e foco</h2>
          </div>
          <span>Aplicação temporária</span>
        </header>
        {[
          ['focus', 'Foco no jogo', 'Prioriza o processo em primeiro plano.', 'competitive'],
          [
            'ioPriority',
            'Prioridade de processo e I/O',
            'Eleva prioridades dentro de limites seguros.',
            'cpu',
          ],
          [
            'cpuSets',
            'CPU Sets',
            'Reserva afinidade preferencial conforme a topologia.',
            'microchip',
          ],
          [
            'pauseServices',
            'Pausar serviços não essenciais',
            'Interrompe apenas serviços aprovados para a sessão.',
            'services',
          ],
          [
            'network',
            'Perfil de rede competitivo',
            'Aplica somente ajustes compatíveis com o adaptador.',
            'wifi',
          ],
        ].map(([id, title, description, icon]) => {
          const key = id as keyof typeof settings;
          return (
            <article key={id}>
              <ProductIcon name={icon as ProductIconName} size={22} weight="duotone" />
              <span>
                <strong>{title}</strong>
                <small>{description}</small>
              </span>
              <button
                aria-checked={settings[key]}
                aria-label={`${settings[key] ? 'Desativar' : 'Ativar'} ${String(title)}`}
                className="premium-switch"
                onClick={() => {
                  setSettings((current) => ({ ...current, [key]: !current[key] }));
                }}
                role="switch"
                type="button"
              >
                <span />
              </button>
            </article>
          );
        })}
      </section>
    </div>
  );
};

const CatalogSurface = ({
  activeFilter,
  operationState,
  query,
  setActiveFilter,
  setOperationState,
  setQuery,
  view,
}: {
  readonly activeFilter: string;
  readonly operationState: Readonly<Record<string, boolean>>;
  readonly query: string;
  readonly setActiveFilter: (value: string) => void;
  readonly setOperationState: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  readonly setQuery: (value: string) => void;
  readonly view: CatalogRouteId;
}) => {
  const items = OPERATION_CATALOGS[view];
  const categories = useMemo(
    () => Array.from(new Set(items.map(({ category }) => category))),
    [items],
  );
  const filtered = items.filter((item) => {
    const matchesCategory = activeFilter === 'Todos' || item.category === activeFilter;
    const searchable = `${item.title} ${item.description} ${item.category}`.toLocaleLowerCase(
      'pt-BR',
    );
    return matchesCategory && searchable.includes(query.toLocaleLowerCase('pt-BR').trim());
  });
  const activeCount = items.filter(({ id }) => operationState[id] ?? false).length;

  return (
    <>
      {view === 'security' ? (
        <section className="premium-security-notice">
          <ProductIcon name="shield" size={24} weight="duotone" />
          <div>
            <strong>Proteções não são “FPS grátis”</strong>
            <p>Alterações críticas exigem confirmação, compatibilidade e caminho de restauração.</p>
          </div>
        </section>
      ) : null}
      <section className="premium-catalog-summary">
        <div>
          <strong>{activeCount}</strong>
          <span>de {items.length} ativos</span>
        </div>
        <div>
          <strong>{items.filter(({ recommended }) => recommended).length}</strong>
          <span>recomendados</span>
        </div>
        <div>
          <strong>{items.filter(({ restart }) => restart).length}</strong>
          <span>exigem reinício</span>
        </div>
      </section>
      <SearchAndFilter
        activeFilter={activeFilter}
        categories={categories}
        onFilter={setActiveFilter}
        onQuery={setQuery}
        query={query}
      />
      <section
        aria-label={`Catálogo de ${ROUTE_META[view].title}`}
        className="premium-operation-list"
      >
        {filtered.length > 0 ? (
          filtered.map((item) => (
            <OperationRow
              active={operationState[item.id] ?? false}
              item={item}
              key={item.id}
              onToggle={() => {
                setOperationState((current) => ({
                  ...current,
                  [item.id]: !(current[item.id] ?? false),
                }));
              }}
            />
          ))
        ) : (
          <div className="premium-empty-state">
            <ProductIcon name="search" size={28} weight="duotone" />
            <h2>Nenhum ajuste encontrado</h2>
            <p>Tente outro termo ou remova o filtro atual.</p>
          </div>
        )}
      </section>
    </>
  );
};

const ShortcutsSurface = ({ notify }: { readonly notify: (message: string) => void }) => {
  const [query, setQuery] = useState('');
  const filtered = SHORTCUTS.filter(({ description, title }) =>
    `${title} ${description}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')),
  );

  return (
    <>
      <SearchAndFilter
        activeFilter="Todos"
        categories={[]}
        onFilter={() => undefined}
        onQuery={setQuery}
        query={query}
      />
      {Array.from(new Set(filtered.map(({ category }) => category))).map((category) => (
        <section className="premium-shortcut-section" key={category}>
          <h2>{category}</h2>
          <div className="premium-card-grid">
            {filtered
              .filter((item) => item.category === category)
              .map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    notify(`${item.title} seria aberto pelo host nativo na versão funcional.`);
                  }}
                  type="button"
                >
                  <ProductIcon name={item.icon} size={23} weight="duotone" />
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.description}</small>
                  </span>
                  <ProductIcon name="arrowRight" size={17} />
                </button>
              ))}
          </div>
        </section>
      ))}
    </>
  );
};

const PowerSurface = ({
  locale,
  notify,
}: {
  readonly locale: ShellLocale;
  readonly notify: (message: string) => void;
}) => {
  const [currentPlan, setCurrentPlan] = useState('liiiraa-adaptive');
  const currentPlanItem =
    POWER_PLANS.find(({ id }) => id === currentPlan) ?? POWER_PLANS[1] ?? POWER_PLANS[0];

  if (!currentPlanItem) {
    return null;
  }
  return (
    <>
      <section className="premium-current-plan">
        <span className="premium-current-plan-icon">
          <ProductIcon name={currentPlanItem.icon} size={28} weight="duotone" />
        </span>
        <div>
          <small>{text(locale, 'Plano selecionado', 'Selected plan')}</small>
          <h2>{currentPlanItem.title}</h2>
          <p>{currentPlanItem.description}</p>
        </div>
        <div className="premium-current-plan-state">
          <span className="premium-status-pill">
            <ProductIcon name="check" size={13} weight="fill" />
            {text(locale, 'Ativo', 'Active')}
          </span>
          <small>{text(locale, 'Restauração disponível', 'Restore point available')}</small>
        </div>
      </section>
      <section className="premium-power-grid">
        {POWER_PLANS.map((plan) => (
          <article
            data-current={String(plan.id === currentPlan)}
            data-recommended={String(plan.recommended === true)}
            key={plan.id}
          >
            <header>
              <span className="premium-power-plan-icon">
                <ProductIcon name={plan.icon} size={24} weight="duotone" />
              </span>
              <div>
                {plan.recommended ? (
                  <span className="premium-power-plan-badge">
                    <ProductIcon name="crown" size={12} weight="fill" />
                    {text(locale, 'Recomendado', 'Recommended')}
                  </span>
                ) : null}
                {plan.id === currentPlan ? (
                  <span className="premium-power-plan-badge" data-tone="active">
                    <ProductIcon name="check" size={12} weight="fill" />
                    {text(locale, 'Em uso', 'In use')}
                  </span>
                ) : null}
              </div>
            </header>
            <h2>{plan.title}</h2>
            <p>{plan.description}</p>
            <div className="premium-power-plan-stats">
              <span>
                <small>{text(locale, 'Resposta', 'Response')}</small>
                <strong>{plan.response}</strong>
              </span>
              <span>
                <small>{text(locale, 'Consumo', 'Power use')}</small>
                <strong>{plan.consumption}</strong>
              </span>
              <span>
                <small>{text(locale, 'Térmico', 'Thermal')}</small>
                <strong>{plan.thermal}</strong>
              </span>
            </div>
            <PremiumButton
              disabled={plan.id === currentPlan}
              onClick={() => {
                setCurrentPlan(plan.id);
                notify(
                  text(
                    locale,
                    `${plan.title} preparado para revisão.`,
                    `${plan.title} prepared for review.`,
                  ),
                );
              }}
              tone={plan.recommended ? 'primary' : 'secondary'}
            >
              {plan.id === currentPlan
                ? text(locale, 'Plano atual', 'Current plan')
                : text(locale, 'Selecionar plano', 'Select plan')}
            </PremiumButton>
          </article>
        ))}
      </section>
    </>
  );
};

const ServicesSurface = () => {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(SERVICES.map(({ id, recommended }) => [id, recommended])),
  );
  const [query, setQuery] = useState('');
  const filtered = SERVICES.filter(({ category, description, title }) =>
    `${title} ${description} ${category}`
      .toLocaleLowerCase('pt-BR')
      .includes(query.toLocaleLowerCase('pt-BR')),
  );

  return (
    <>
      <SearchAndFilter
        activeFilter="Todos"
        categories={[]}
        onFilter={() => undefined}
        onQuery={setQuery}
        query={query}
      />
      <section className="premium-service-list">
        {filtered.map((service) => (
          <article key={service.id}>
            <ProductIcon name="services" size={22} weight="duotone" />
            <div>
              <span>
                <small>{service.category}</small>
                <strong>{service.title}</strong>
              </span>
              <p>{service.description}</p>
            </div>
            <label>
              <span className="lb-visually-hidden">Inicialização de {service.title}</span>
              <select
                onChange={(event) => {
                  setValues((current) => ({ ...current, [service.id]: event.currentTarget.value }));
                }}
                value={values[service.id]}
              >
                <option>Automático</option>
                <option>Automático (atraso)</option>
                <option>Manual</option>
                <option>Desativado</option>
              </select>
            </label>
          </article>
        ))}
      </section>
    </>
  );
};

const RestorationSurface = ({ notify }: { readonly notify: (message: string) => void }) => (
  <>
    <section className="premium-restore-readiness">
      <div>
        <ProductIcon name="check" size={25} weight="duotone" />
        <span>
          <strong>Recuperação pronta</strong>
          <small>Último ponto de restauração: hoje, 18:42</small>
        </span>
      </div>
      <PremiumButton
        onClick={() => {
          notify('Ponto de restauração demonstrativo criado.');
        }}
        tone="primary"
      >
        Criar ponto de restauração
      </PremiumButton>
    </section>
    <section className="premium-restore-grid">
      <article>
        <span className="premium-section-label">Histórico Liiiraa</span>
        <h2>Alterações reversíveis</h2>
        {[
          ['Perfil de rede competitivo', 'Hoje, 18:32', '3 alterações'],
          ['Plano Liiiraa Adaptativo', 'Ontem, 21:14', '1 alteração'],
          ['Ajustes de entrada', '27 jul., 19:06', '2 alterações'],
        ].map(([title, date, detail]) => (
          <button
            key={title}
            onClick={() => {
              notify(`Detalhes de “${String(title)}” abertos no cenário.`);
            }}
            type="button"
          >
            <ProductIcon name="history" size={20} />
            <span>
              <strong>{title}</strong>
              <small>
                {date} · {detail}
              </small>
            </span>
            <ProductIcon name="chevronRight" size={17} />
          </button>
        ))}
      </article>
      <article>
        <span className="premium-section-label">Componentes do Windows</span>
        <h2>Aplicativos recuperáveis</h2>
        {['Ferramenta de Captura', 'Xbox Game Bar', 'Microsoft Store'].map((app) => (
          <div key={app}>
            <ProductIcon name="store" size={20} />
            <span>
              <strong>{app}</strong>
              <small>Disponível para reinstalação</small>
            </span>
            <PremiumButton
              onClick={() => {
                notify(`${app} preparado para restauração demonstrativa.`);
              }}
              tone="quiet"
            >
              Restaurar
            </PremiumButton>
          </div>
        ))}
      </article>
    </section>
  </>
);

const parseInstalledSizeToMb = (size: string): number => {
  const numericValue = Number.parseFloat(size.replace(',', '.'));
  return size.toLocaleUpperCase('en-US').includes('GB') ? numericValue * 1024 : numericValue;
};

const formatInstalledSize = (sizeInMb: number, locale: ShellLocale): string => {
  if (sizeInMb >= 1024) {
    return `${(sizeInMb / 1024).toLocaleString(locale, {
      maximumFractionDigits: 1,
      minimumFractionDigits: 1,
    })} GB`;
  }
  return `${Math.round(sizeInMb).toLocaleString(locale)} MB`;
};

interface UninstallReviewDialogProps {
  readonly apps: readonly InstalledAppItem[];
  readonly locale: ShellLocale;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
  readonly working: boolean;
}

const UninstallReviewDialog = ({
  apps,
  locale,
  onClose,
  onConfirm,
  working,
}: UninstallReviewDialogProps) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const estimatedSpace = formatInstalledSize(
    apps.reduce((total, app) => total + parseInstalledSizeToMb(app.size), 0),
    locale,
  );

  useEffect(() => {
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !working) {
        onClose();
      }
    };
    globalThis.addEventListener('keydown', onKeyDown);
    return () => {
      globalThis.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, working]);

  return (
    <div
      className="premium-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !working) {
          onClose();
        }
      }}
    >
      <div
        aria-labelledby="premium-uninstall-review-title"
        aria-modal="true"
        className="premium-review-dialog premium-uninstall-dialog"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <header>
          <span>
            <ProductIcon name="trash" size={24} weight="duotone" />
          </span>
          <div>
            <small>{text(locale, 'Ação destrutiva', 'Destructive action')}</small>
            <h2 id="premium-uninstall-review-title">
              {text(locale, 'Confirmar desinstalação', 'Confirm uninstall')}
            </h2>
          </div>
          <button
            aria-label={text(locale, 'Fechar confirmação', 'Close confirmation')}
            disabled={working}
            onClick={onClose}
            type="button"
          >
            <ProductIcon name="close" size={20} />
          </button>
        </header>

        <div className="premium-uninstall-summary">
          <div>
            <span>{text(locale, 'Selecionados', 'Selected')}</span>
            <strong>{apps.length}</strong>
          </div>
          <div>
            <span>{text(locale, 'Espaço estimado', 'Estimated space')}</span>
            <strong>{estimatedSpace}</strong>
          </div>
        </div>

        <ul className="premium-uninstall-selection">
          {apps.map((app) => (
            <li key={app.id}>
              <span className="premium-app-icon">
                <BrandIcon brand={app.id} label={app.title} size={20} />
              </span>
              <span>
                <strong>{app.title}</strong>
                <small>{app.publisher}</small>
              </span>
              <b>{app.size}</b>
            </li>
          ))}
        </ul>

        <div className="premium-uninstall-warning">
          <ProductIcon name="shield" size={19} weight="duotone" />
          <p>
            <strong>
              {text(
                locale,
                'Nenhuma alteração real será feita nesta fase.',
                'No real changes will be made in this phase.',
              )}
            </strong>
            <span>
              {text(
                locale,
                'O motor privilegiado ainda não está conectado. Itens protegidos do sistema permanecem bloqueados.',
                'The privileged engine is not connected yet. Protected system items remain locked.',
              )}
            </span>
          </p>
        </div>

        <footer>
          <PremiumButton disabled={working} onClick={onClose}>
            {text(locale, 'Cancelar', 'Cancel')}
          </PremiumButton>
          <PremiumButton disabled={working} onClick={onConfirm} tone="danger">
            {working
              ? text(locale, 'Desinstalando…', 'Uninstalling…')
              : text(locale, 'Confirmar desinstalação', 'Confirm uninstall')}
          </PremiumButton>
        </footer>
      </div>
    </div>
  );
};

const UninstallerSurface = ({
  locale,
  notify,
}: {
  readonly locale: ShellLocale;
  readonly notify: (message: string, tone?: PremiumToastTone) => void;
}) => {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  const [reviewOpen, setReviewOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const selectedApps = INSTALLED_APPS.filter((app) => selected.has(app.id));
  const removableApps = INSTALLED_APPS.filter((app) => !app.protected && !removed.has(app.id));
  const allRemovableSelected =
    removableApps.length > 0 && removableApps.every((app) => selected.has(app.id));
  const filtered = INSTALLED_APPS.filter(
    ({ id, publisher, title }) =>
      !removed.has(id) &&
      `${title} ${publisher}`
        .toLocaleLowerCase(locale)
        .includes(query.trim().toLocaleLowerCase(locale)),
  );

  useEffect(
    () => () => {
      if (timer.current !== undefined) {
        window.clearTimeout(timer.current);
      }
    },
    [],
  );

  const confirmUninstall = (): void => {
    const appsToRemove = selectedApps;
    if (appsToRemove.length === 0 || working) {
      return;
    }
    setWorking(true);
    timer.current = window.setTimeout(() => {
      setRemoved((current) => new Set([...current, ...appsToRemove.map(({ id }) => id)]));
      setSelected(new Set());
      setWorking(false);
      setReviewOpen(false);
      timer.current = undefined;

      const totalSpace = formatInstalledSize(
        appsToRemove.reduce((total, app) => total + parseInstalledSizeToMb(app.size), 0),
        locale,
      );
      const message =
        appsToRemove.length === 1
          ? text(
              locale,
              `${appsToRemove[0]?.title ?? ''} foi removido no cenário demonstrativo. ${totalSpace} liberado.`,
              `${appsToRemove[0]?.title ?? ''} was removed in the demo scenario. ${totalSpace} freed.`,
            )
          : text(
              locale,
              `${String(appsToRemove.length)} aplicativos foram removidos no cenário demonstrativo. ${totalSpace} liberados.`,
              `${String(appsToRemove.length)} apps were removed in the demo scenario. ${totalSpace} freed.`,
            );
      notify(message, 'success');
    }, 720);
  };

  const selectedSize = selected.size;
  return (
    <>
      <div className="premium-uninstall-toolbar">
        <label className="premium-search">
          <ProductIcon name="search" size={18} />
          <span className="lb-visually-hidden">
            {text(locale, 'Pesquisar aplicativo instalado', 'Search installed app')}
          </span>
          <input
            onChange={(event) => {
              setQuery(event.currentTarget.value);
            }}
            placeholder={text(locale, 'Pesquisar aplicativo...', 'Search app...')}
            type="search"
            value={query}
          />
        </label>
        <label className="premium-select-all">
          <input
            aria-label={text(
              locale,
              'Selecionar todos os aplicativos removíveis',
              'Select all removable apps',
            )}
            checked={allRemovableSelected}
            onChange={() => {
              setSelected((current) => {
                const next = new Set(current);
                if (allRemovableSelected) {
                  for (const app of removableApps) {
                    next.delete(app.id);
                  }
                } else {
                  for (const app of removableApps) {
                    next.add(app.id);
                  }
                }
                return next;
              });
            }}
            type="checkbox"
          />
          <span>{text(locale, 'Selecionar todos', 'Select all')}</span>
        </label>
        <span>
          {humanCount(
            selectedSize,
            text(locale, 'selecionado', 'selected'),
            text(locale, 'selecionados', 'selected'),
          )}
        </span>
        <PremiumButton
          disabled={selectedSize === 0}
          onClick={() => {
            setReviewOpen(true);
          }}
          tone="danger"
        >
          {text(locale, 'Desinstalar selecionado', 'Uninstall selected')}
        </PremiumButton>
      </div>
      <section className="premium-app-list">
        {filtered.map((app) => (
          <label data-protected={String(app.protected ?? false)} key={app.id}>
            <input
              checked={selected.has(app.id)}
              disabled={app.protected}
              onChange={() => {
                setSelected((current) => {
                  const next = new Set(current);
                  if (next.has(app.id)) {
                    next.delete(app.id);
                  } else {
                    next.add(app.id);
                  }
                  return next;
                });
              }}
              type="checkbox"
            />
            <span className="premium-app-icon">
              <BrandIcon brand={app.id} label={app.title} size={21} />
            </span>
            <span>
              <strong>{app.title}</strong>
              <small>
                {app.publisher} · {app.category}
              </small>
            </span>
            {app.protected ? <em>{text(locale, 'Protegido', 'Protected')}</em> : <b>{app.size}</b>}
          </label>
        ))}
      </section>

      {reviewOpen ? (
        <UninstallReviewDialog
          apps={selectedApps}
          locale={locale}
          onClose={() => {
            setReviewOpen(false);
          }}
          onConfirm={confirmUninstall}
          working={working}
        />
      ) : null}
    </>
  );
};

/** @deprecated Retained for fixture compatibility; the premium download state machine is used. */
export const LegacyDownloadsSurface = ({
  notify,
}: {
  readonly notify: (message: string) => void;
}) => {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<Record<string, 'concluído' | 'ocioso' | 'preparando'>>({});
  const filtered = DOWNLOADS.filter(({ category, description, title }) =>
    `${title} ${description} ${category}`
      .toLocaleLowerCase('pt-BR')
      .includes(query.toLocaleLowerCase('pt-BR')),
  );

  const startDownload = (id: string, title: string): void => {
    setStatus((current) => ({ ...current, [id]: 'preparando' }));
    globalThis.setTimeout(() => {
      setStatus((current) => ({ ...current, [id]: 'concluído' }));
      notify(`${title}: demonstração concluída. Nenhum arquivo foi baixado.`);
    }, 700);
  };

  return (
    <>
      <SearchAndFilter
        activeFilter="Todos"
        categories={[]}
        onFilter={() => undefined}
        onQuery={setQuery}
        query={query}
      />
      <section className="premium-download-grid">
        {filtered.map((item) => {
          const itemStatus = status[item.id] ?? 'ocioso';
          return (
            <article key={item.id}>
              <span className="premium-download-icon">
                <BrandIcon brand={item.id} label={item.title} size={25} />
              </span>
              <div>
                <small>{item.category}</small>
                <h2>{item.title}</h2>
                <p>{item.description}</p>
                <span>{item.license} · fonte oficial</span>
              </div>
              <PremiumButton
                disabled={itemStatus === 'preparando'}
                onClick={() => {
                  startDownload(item.id, item.title);
                }}
                tone={itemStatus === 'concluído' ? 'quiet' : 'secondary'}
              >
                {itemStatus === 'preparando'
                  ? 'Preparando...'
                  : itemStatus === 'concluído'
                    ? 'Concluído'
                    : 'Preparar download'}
              </PremiumButton>
            </article>
          );
        })}
      </section>
    </>
  );
};

const SETTINGS_SECTION_BY_STATE: Readonly<Record<string, string>> = Object.freeze({
  advanced: 'Dados e recuperação',
  appearance: 'Aparência',
  general: 'Geral',
  notifications: 'Notificações',
  privacy: 'Privacidade',
});

const SETTINGS_ROUTE_BY_SECTION: Readonly<Record<string, string>> = Object.freeze({
  Aparência: '/settings/appearance',
  'Dados e recuperação': '/settings/advanced',
  Geral: '/settings/general',
  Notificações: '/settings/notifications',
  Privacidade: '/settings/privacy',
});

/** @deprecated Retained only for fixture compatibility while settings migrate to typed preferences. */
export const LegacySettingsSurface = ({
  navigate,
  notify,
  routeState = 'general',
}: {
  readonly navigate: (pathname: string) => void;
  readonly notify: (message: string) => void;
  readonly routeState?: string | undefined;
}) => {
  const [section, setSection] = useState(SETTINGS_SECTION_BY_STATE[routeState] ?? 'Geral');
  const [settings, setSettings] = useState({
    analytics: false,
    autoUpdate: true,
    launch: false,
    notifications: true,
    reducedMotion: false,
    tray: true,
  });
  const options: Readonly<Record<string, readonly [keyof typeof settings, string, string][]>> =
    Object.freeze({
      Geral: [
        ['launch', 'Iniciar com o Windows', 'Abre a Liiiraa ao entrar na sua conta.'],
        ['tray', 'Manter na bandeja', 'Continua disponível sem manter a janela aberta.'],
        [
          'autoUpdate',
          'Atualizações automáticas',
          'Baixa atualizações assinadas quando disponíveis.',
        ],
      ],
      Aparência: [
        ['reducedMotion', 'Reduzir movimento', 'Substitui transições por mudanças instantâneas.'],
      ],
      Notificações: [
        [
          'notifications',
          'Notificações do aplicativo',
          'Mostra alertas de plano, sessão e atualização.',
        ],
      ],
      Privacidade: [
        [
          'analytics',
          'Diagnóstico opcional',
          'Compartilha somente diagnóstico autorizado e redigido.',
        ],
      ],
    });

  useEffect(() => {
    setSection(SETTINGS_SECTION_BY_STATE[routeState] ?? 'Geral');
  }, [routeState]);

  const openSection = (nextSection: string): void => {
    setSection(nextSection);
    const pathname = SETTINGS_ROUTE_BY_SECTION[nextSection];
    if (pathname !== undefined) {
      navigate(pathname);
    }
  };

  return (
    <div className="premium-settings-layout">
      <nav aria-label="Seções de configurações">
        {Object.keys(options).map((item) => (
          <button
            aria-current={section === item ? 'page' : undefined}
            key={item}
            onClick={() => {
              openSection(item);
            }}
            type="button"
          >
            {item}
          </button>
        ))}
        <button
          aria-current={section === 'Dados e recuperação' ? 'page' : undefined}
          onClick={() => {
            openSection('Dados e recuperação');
          }}
          type="button"
        >
          Dados e recuperação
        </button>
      </nav>
      <section>
        <header>
          <span className="premium-section-label">Preferências do aplicativo</span>
          <h2>{section}</h2>
        </header>
        {section === 'Dados e recuperação' ? (
          <div className="premium-settings-actions">
            {[
              ['Exportar perfil', 'Gera um arquivo com preferências e plano atual.', 'download'],
              ['Importar perfil', 'Valida um perfil antes de apresentar as diferenças.', 'package'],
              ['Abrir pasta de logs', 'Logs locais com dados sensíveis redigidos.', 'activity'],
              ['Reexaminar hardware', 'Atualiza o inventário do cenário demonstrativo.', 'radar'],
              ['Redefinir aplicativo', 'Volta as preferências da interface ao padrão.', 'recovery'],
            ].map(([title, description, icon]) => (
              <button
                key={title}
                onClick={() => {
                  notify(`${String(title)}: fluxo demonstrativo concluído.`);
                }}
                type="button"
              >
                <ProductIcon name={icon as ProductIconName} size={21} weight="duotone" />
                <span>
                  <strong>{title}</strong>
                  <small>{description}</small>
                </span>
                <ProductIcon name="chevronRight" size={17} />
              </button>
            ))}
          </div>
        ) : (
          <div className="premium-settings-list">
            {section === 'Geral' ? (
              <article>
                <span>
                  <strong>Idioma da interface</strong>
                  <small>Altera menus, mensagens e controles do aplicativo.</small>
                </span>
                <PreConsentLocaleControl />
              </article>
            ) : null}
            {(options[section] ?? []).map(([key, title, description]) => (
              <article key={key}>
                <span>
                  <strong>{title}</strong>
                  <small>{description}</small>
                </span>
                <button
                  aria-checked={settings[key]}
                  aria-label={`${settings[key] ? 'Desativar' : 'Ativar'} ${title}`}
                  className="premium-switch"
                  onClick={() => {
                    setSettings((current) => ({ ...current, [key]: !current[key] }));
                  }}
                  role="switch"
                  type="button"
                >
                  <span />
                </button>
              </article>
            ))}
            {section === 'Aparência' ? (
              <article>
                <span>
                  <strong>Tema do aplicativo</strong>
                  <small>Grafite profundo com sinal cobalto.</small>
                </span>
                <select aria-label="Tema do aplicativo" defaultValue="Grafite">
                  <option>Grafite</option>
                  <option>Sistema</option>
                </select>
              </article>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
};

const ActivitySurface = ({
  identity,
  locale,
  notify,
}: {
  readonly identity?: ShellInstallerIdentityJson | undefined;
  readonly locale: ShellLocale;
  readonly notify: (message: string) => void;
}) => (
  <section className="premium-activity-timeline">
    {[
      ['Agora', 'Plano competitivo preparado', '5 alterações aguardam revisão', 'list'],
      ['18:42', 'Ponto de restauração verificado', 'Recuperação disponível', 'recovery'],
      ['18:31', 'Hardware reexaminado', 'Nenhuma mudança de compatibilidade', 'radar'],
      [
        'Ontem',
        `Atualização ${identity?.version ?? '0.0.0'} verificada`,
        identity === undefined
          ? 'Canal estável · assinatura de desenvolvimento'
          : text(
              locale,
              NATIVE_CHANNEL_LABELS[identity.channel][0],
              NATIVE_CHANNEL_LABELS[identity.channel][1],
            ),
        'check',
      ],
    ].map(([time, title, detail, icon], index) => (
      <article key={`${String(time)}-${String(title)}`}>
        <time>{time}</time>
        <span className="premium-activity-icon">
          <ProductIcon name={icon as ProductIconName} size={20} weight="duotone" />
        </span>
        <div>
          <strong>{title}</strong>
          <p>{detail}</p>
        </div>
        <PremiumButton
          onClick={() => {
            notify(`Detalhes de “${String(title)}” abertos.`);
          }}
          tone={index === 0 ? 'primary' : 'quiet'}
        >
          Ver detalhes
        </PremiumButton>
      </article>
    ))}
  </section>
);

type PremiumUpdaterPhase =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'preparing'
  | 'scheduled'
  | 'up-to-date'
  | 'error';

const updateStageLabel = (locale: ShellLocale, stage: PremiumUpdateCheckStageId | null) => {
  const labels: Record<PremiumUpdateCheckStageId, readonly [string, string]> = {
    channel: ['Conectando ao canal estável', 'Connecting to the stable channel'],
    manifest: ['Validando o manifesto da versão', 'Validating the release manifest'],
    signature: ['Verificando a assinatura digital', 'Verifying the digital signature'],
    version: ['Comparando as versões instaladas', 'Comparing installed versions'],
  };

  return stage
    ? text(locale, labels[stage][0], labels[stage][1])
    : text(locale, 'Preparando verificação segura', 'Preparing secure check');
};

const formatUpdateSize = (bytes: number, locale: ShellLocale) =>
  new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  }).format(bytes / 1_000_000);

const DemonstrationAboutSurface = ({
  locale,
  notify,
}: {
  readonly locale: ShellLocale;
  readonly notify: (message: string, tone?: PremiumToastTone) => void;
}) => {
  const updater = useMemo(() => createPremiumUpdater(), []);
  const controllerRef = useRef<AbortController | null>(null);
  const [phase, setPhase] = useState<PremiumUpdaterPhase>('idle');
  const [progress, setProgress] = useState(0);
  const [checkStage, setCheckStage] = useState<PremiumUpdateCheckStageId | null>(null);
  const [manifest, setManifest] = useState<PremiumUpdateManifest | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(
    () => () => {
      controllerRef.current?.abort();
    },
    [],
  );

  const isWorking = phase === 'checking' || phase === 'downloading' || phase === 'preparing';

  const startCheck = async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setPhase('checking');
    setProgress(0);
    setCheckStage(null);
    setManifest(null);
    setErrorMessage('');

    try {
      const result = await updater.check({
        onProgress: (update) => {
          setCheckStage(update.stage);
          setProgress(update.progress);
        },
        signal: controller.signal,
      });

      if (result.kind === 'available') {
        setManifest(result.manifest);
        setPhase('available');
        notify(
          text(locale, 'Atualização 0.1.0 encontrada com segurança.', 'Update 0.1.0 found safely.'),
          'success',
        );
      } else {
        setPhase('up-to-date');
        notify(
          text(locale, 'Você já está na versão mais recente.', 'You are already up to date.'),
          'success',
        );
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      setErrorMessage(
        text(
          locale,
          'Não foi possível concluir a verificação demonstrativa.',
          'The demonstration check could not be completed.',
        ),
      );
      setPhase('error');
    }
  };

  const startDownload = async () => {
    if (!manifest) {
      return;
    }

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setPhase('downloading');
    setProgress(0);

    try {
      await updater.download(manifest, {
        onProgress: (update) => {
          setProgress(update.progress);
        },
        signal: controller.signal,
      });
      setPhase('ready');
      notify(
        text(
          locale,
          'Pacote demonstrativo validado e pronto.',
          'Demo package validated and ready.',
        ),
        'success',
      );
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setPhase('available');
        setProgress(0);
        notify(text(locale, 'Download demonstrativo cancelado.', 'Demo download cancelled.'));
        return;
      }
      setErrorMessage(
        text(
          locale,
          'O download demonstrativo foi interrompido. Tente novamente.',
          'The demo download was interrupted. Try again.',
        ),
      );
      setPhase('error');
    }
  };

  const cancelDownload = () => {
    controllerRef.current?.abort();
  };

  const prepareInstall = async () => {
    const controller = new AbortController();
    controllerRef.current = controller;
    setPhase('preparing');

    try {
      await updater.prepareInstall(controller.signal);
      setPhase('scheduled');
      notify(
        text(
          locale,
          'Instalação demonstrativa preparada para o encerramento.',
          'Demo installation prepared for app exit.',
        ),
        'success',
      );
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      setErrorMessage(
        text(
          locale,
          'Não foi possível preparar a instalação.',
          'Installation could not be prepared.',
        ),
      );
      setPhase('error');
    }
  };

  const updateAction = (() => {
    if (phase === 'available') {
      return (
        <PremiumButton
          onClick={() => {
            void startDownload();
          }}
          tone="primary"
        >
          <ProductIcon name="download" size={17} weight="bold" />
          {text(locale, 'Baixar atualização', 'Download update')}
        </PremiumButton>
      );
    }
    if (phase === 'downloading') {
      return (
        <PremiumButton onClick={cancelDownload} tone="quiet">
          {text(locale, 'Cancelar download', 'Cancel download')}
        </PremiumButton>
      );
    }
    if (phase === 'ready') {
      return (
        <PremiumButton
          onClick={() => {
            void prepareInstall();
          }}
          tone="primary"
        >
          <ProductIcon name="package" size={17} weight="bold" />
          {text(locale, 'Instalar ao fechar', 'Install on exit')}
        </PremiumButton>
      );
    }
    if (phase === 'scheduled') {
      return (
        <PremiumButton
          onClick={() => {
            setPhase('available');
          }}
          tone="quiet"
        >
          {text(locale, 'Cancelar instalação', 'Cancel installation')}
        </PremiumButton>
      );
    }
    return (
      <PremiumButton
        disabled={isWorking}
        onClick={() => {
          void startCheck();
        }}
        tone="primary"
      >
        {phase === 'checking' ? (
          <ProductIcon name="loading" size={17} weight="bold" />
        ) : (
          <ProductIcon name="recovery" size={17} weight="bold" />
        )}
        {phase === 'checking'
          ? text(locale, 'Verificando…', 'Checking…')
          : text(locale, 'Verificar atualizações', 'Check for updates')}
      </PremiumButton>
    );
  })();

  const releaseNotes = manifest?.releaseNotes[locale === 'pt-BR' ? 'ptBr' : 'en'] ?? [];

  return (
    <div className="premium-about-layout">
      <section className="premium-about-hero">
        <span className="premium-about-mark" aria-hidden="true">
          <svg viewBox="0 0 36 28">
            <path d="M2 25.5 10.6 2h7.2l-5.7 15.2h9.2l-7.1 8.3H2Z" />
            <path d="m20.7 7.2 10.3 7-10.3 7 3-3.7 4.8-3.3-4.8-3.3-3-3.7Z" />
          </svg>
        </span>
        <div>
          <span className="premium-section-label">Liiiraa Boost</span>
          <h2>
            {text(
              locale,
              'Controle preciso. Recuperação sempre disponível.',
              'Precise control. Recovery always available.',
            )}
          </h2>
          <p>
            {text(
              locale,
              'Versão 0.0.0 · canal estável · compilação visual da Fase 2',
              'Version 0.0.0 · stable channel · Phase 2 visual build',
            )}
          </p>
        </div>
        {updateAction}
      </section>

      <section
        aria-live="polite"
        className="premium-updater-card"
        data-phase={phase}
        data-testid="premium-updater"
      >
        <header className="premium-updater-header">
          <span className="premium-updater-icon">
            <ProductIcon
              name={
                phase === 'scheduled' || phase === 'ready'
                  ? 'check'
                  : phase === 'error'
                    ? 'warning'
                    : phase === 'available'
                      ? 'download'
                      : 'shield'
              }
              size={24}
              weight="duotone"
            />
          </span>
          <div>
            <span className="premium-section-label">
              {text(locale, 'ATUALIZAÇÃO DO APLICATIVO', 'APP UPDATE')}
            </span>
            <h3>
              {phase === 'idle' && text(locale, 'Pronto para verificar', 'Ready to check')}
              {phase === 'checking' && updateStageLabel(locale, checkStage)}
              {phase === 'available' &&
                text(locale, 'Nova versão disponível', 'New version available')}
              {phase === 'downloading' &&
                text(locale, 'Baixando pacote verificado', 'Downloading verified package')}
              {phase === 'ready' && text(locale, 'Pronto para instalar', 'Ready to install')}
              {phase === 'preparing' &&
                text(locale, 'Preparando instalação segura', 'Preparing safe installation')}
              {phase === 'scheduled' &&
                text(locale, 'Instalação preparada', 'Installation prepared')}
              {phase === 'up-to-date' &&
                text(locale, 'Liiiraa Boost está atualizado', 'Liiiraa Boost is up to date')}
              {phase === 'error' &&
                text(locale, 'A verificação precisa de atenção', 'The check needs attention')}
            </h3>
          </div>
          <span className="premium-updater-demo-badge">
            {text(locale, 'SIMULAÇÃO SEGURA', 'SAFE DEMO')}
          </span>
        </header>

        {phase === 'idle' || phase === 'up-to-date' ? (
          <div className="premium-updater-overview">
            <div>
              <span>{text(locale, 'Versão instalada', 'Installed version')}</span>
              <strong>0.0.0</strong>
            </div>
            <div>
              <span>{text(locale, 'Canal', 'Channel')}</span>
              <strong>{text(locale, 'Estável', 'Stable')}</strong>
            </div>
            <div>
              <span>{text(locale, 'Integridade', 'Integrity')}</span>
              <strong>
                <ProductIcon name="check" size={14} weight="fill" />
                {text(locale, 'Verificada', 'Verified')}
              </strong>
            </div>
          </div>
        ) : null}

        {phase === 'checking' || phase === 'downloading' || phase === 'preparing' ? (
          <div className="premium-updater-progress">
            <div className="premium-updater-progress-copy">
              <span>
                {phase === 'checking'
                  ? updateStageLabel(locale, checkStage)
                  : phase === 'downloading'
                    ? text(
                        locale,
                        `${formatUpdateSize(((manifest?.sizeBytes ?? 0) * progress) / 100, locale)} de ${formatUpdateSize(manifest?.sizeBytes ?? 0, locale)} MB`,
                        `${formatUpdateSize(((manifest?.sizeBytes ?? 0) * progress) / 100, locale)} of ${formatUpdateSize(manifest?.sizeBytes ?? 0, locale)} MB`,
                      )
                    : text(
                        locale,
                        'Validando o pacote e registrando a próxima ação',
                        'Validating package and registering the next action',
                      )}
              </span>
              <strong>{phase === 'preparing' ? '100%' : `${String(progress)}%`}</strong>
            </div>
            <div
              aria-label={text(locale, 'Progresso da atualização', 'Update progress')}
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={phase === 'preparing' ? 100 : progress}
              className="premium-updater-progress-track"
              role="progressbar"
            >
              <span style={{ inlineSize: `${String(phase === 'preparing' ? 100 : progress)}%` }} />
            </div>
          </div>
        ) : null}

        {manifest && ['available', 'ready', 'scheduled'].includes(phase) ? (
          <div className="premium-updater-release">
            <div className="premium-updater-version">
              <span>v{manifest.currentVersion}</span>
              <ProductIcon name="arrowRight" size={16} weight="bold" />
              <strong>v{manifest.version}</strong>
              <small>
                {formatUpdateSize(manifest.sizeBytes, locale)} MB ·{' '}
                {text(locale, 'assinatura verificada', 'signature verified')}
              </small>
            </div>
            <ul>
              {releaseNotes.map((note) => (
                <li key={note}>
                  <ProductIcon name="check" size={15} weight="bold" />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
            {phase === 'scheduled' ? (
              <div className="premium-updater-ready-note">
                <ProductIcon name="history" size={18} weight="duotone" />
                <span>
                  <strong>
                    {text(locale, 'Nenhuma reinicialização agora', 'No restart right now')}
                  </strong>
                  <small>
                    {text(
                      locale,
                      'A demonstração será concluída quando o aplicativo for encerrado.',
                      'The demonstration will complete when the app exits.',
                    )}
                  </small>
                </span>
              </div>
            ) : null}
          </div>
        ) : null}

        {phase === 'error' ? <p className="premium-updater-error">{errorMessage}</p> : null}

        <footer className="premium-updater-footnote">
          <ProductIcon name="info" size={15} weight="duotone" />
          <span>
            {text(
              locale,
              'Demonstração da Fase 2: nenhum servidor, arquivo ou instalador real é acionado.',
              'Phase 2 demo: no real server, file, or installer is used.',
            )}
          </span>
        </footer>
      </section>

      <section className="premium-about-grid">
        {[
          ['Integridade', 'Assinatura de desenvolvimento', 'check'],
          ['Termos de uso', 'Contrato completo do aplicativo', 'list'],
          ['Privacidade', 'Política LGPD e GDPR', 'shield'],
          ['Licenças', 'Bibliotecas, fontes e ícones', 'code'],
          ['Suporte', 'Documentação e diagnóstico', 'info'],
          ['Versão do WebView2', 'Runtime 138.0 · compatível', 'browser'],
        ].map(([title, description, icon]) => (
          <button
            key={title}
            onClick={() => {
              notify(`${String(title)} aberto no cenário demonstrativo.`);
            }}
            type="button"
          >
            <ProductIcon name={icon as ProductIconName} size={22} weight="duotone" />
            <span>
              <strong>{title}</strong>
              <small>{description}</small>
            </span>
            <ProductIcon name="chevronRight" size={17} />
          </button>
        ))}
      </section>
    </div>
  );
};

const NATIVE_CHANNEL_LABELS = Object.freeze({
  development: ['Canal de desenvolvimento', 'Development channel'],
  stable: ['Canal estável', 'Stable channel'],
  beta: ['Canal beta', 'Beta channel'],
  experimental: ['Canal experimental', 'Experimental channel'],
} satisfies Readonly<Record<ShellInstallerIdentityJson['channel'], readonly [string, string]>>);

const UnavailableAboutSurface = ({ locale }: { readonly locale: ShellLocale }) => (
  <div className="premium-about-layout" data-native-installer-identity="unavailable">
    <section className="premium-about-hero">
      <span className="premium-about-mark" aria-hidden="true">
        <svg viewBox="0 0 36 28">
          <path d="M2 25.5 10.6 2h7.2l-5.7 15.2h9.2l-7.1 8.3H2Z" />
          <path d="m20.7 7.2 10.3 7-10.3 7 3-3.7 4.8-3.3-4.8-3.3-3-3.7Z" />
        </svg>
      </span>
      <div>
        <span className="premium-section-label">Liiiraa Boost</span>
        <h2>
          {text(
            locale,
            'Identidade da instalação indisponível',
            'Installation identity unavailable',
          )}
        </h2>
        <p>
          {text(
            locale,
            'O host nativo não forneceu uma identidade validada para esta instalação.',
            'The native host did not provide a validated identity for this installation.',
          )}
        </p>
      </div>
    </section>

    <section className="premium-updater-card" data-phase="unavailable" role="status">
      <header className="premium-updater-header">
        <span className="premium-updater-icon">
          <ProductIcon name="warning" size={24} weight="duotone" />
        </span>
        <div>
          <span className="premium-section-label">
            {text(locale, 'ATUALIZAÇÃO DO APLICATIVO', 'APP UPDATE')}
          </span>
          <h3>
            {text(
              locale,
              'Não é possível verificar atualizações',
              'Updates cannot be checked',
            )}
          </h3>
        </div>
      </header>
      <footer className="premium-updater-footnote">
        <ProductIcon name="info" size={15} weight="duotone" />
        <span>
          {text(
            locale,
            'Feche e abra o aplicativo novamente. Se o problema continuar, reinstale uma compilação oficial.',
            'Close and reopen the app. If the problem persists, reinstall an official build.',
          )}
        </span>
      </footer>
    </section>
  </div>
);

const explicitDevelopmentScenarioEnabled = (): boolean => {
  if (!(import.meta.env.DEV || import.meta.env.MODE === 'browser-test')) return false;
  const testState = Reflect.get(globalThis, '__LIIIRAA_DESKTOP_TEST__') as unknown;
  if (typeof testState !== 'object' || testState === null) return false;
  const scenario = Reflect.get(testState, 'scenario') as unknown;
  return (
    typeof scenario === 'object' &&
    scenario !== null &&
    Reflect.get(scenario, 'marker') === 'SIMULATED SCENARIO'
  );
};

const NativeAboutSurface = ({
  identity,
  locale,
  notify,
}: {
  readonly identity: ShellInstallerIdentityJson;
  readonly locale: ShellLocale;
  readonly notify: (message: string, tone?: PremiumToastTone) => void;
}) => {
  const channelLabel = text(
    locale,
    NATIVE_CHANNEL_LABELS[identity.channel][0],
    NATIVE_CHANNEL_LABELS[identity.channel][1],
  );
  const compatibility = identity.windowsCompatibility;

  return (
    <div className="premium-about-layout" data-native-installer-identity="validated">
      <section className="premium-about-hero">
        <span className="premium-about-mark" aria-hidden="true">
          <svg viewBox="0 0 36 28">
            <path d="M2 25.5 10.6 2h7.2l-5.7 15.2h9.2l-7.1 8.3H2Z" />
            <path d="m20.7 7.2 10.3 7-10.3 7 3-3.7 4.8-3.3-4.8-3.3-3-3.7Z" />
          </svg>
        </span>
        <div>
          <span className="premium-section-label">Liiiraa Boost</span>
          <h2>
            {text(
              locale,
              'Identidade real desta instalação',
              'Real identity for this installation',
            )}
          </h2>
          <p>
            {text(locale, 'Versão', 'Version')} {identity.version} · {channelLabel}
          </p>
        </div>
      </section>

      <section className="premium-updater-card" data-phase="native-disabled">
        <header className="premium-updater-header">
          <span className="premium-updater-icon">
            <ProductIcon name="shield" size={24} weight="duotone" />
          </span>
          <div>
            <span className="premium-section-label">
              {text(locale, 'IDENTIDADE DO APLICATIVO', 'APP IDENTITY')}
            </span>
            <h3>{text(locale, 'Compilação instalada', 'Installed build')}</h3>
          </div>
        </header>

        <div className="premium-updater-overview">
          <div>
            <span>{text(locale, 'Versão instalada', 'Installed version')}</span>
            <strong>{identity.version}</strong>
          </div>
          <div>
            <span>{text(locale, 'Canal', 'Channel')}</span>
            <strong>{channelLabel}</strong>
          </div>
          <div>
            <span>{text(locale, 'Publicador', 'Publisher')}</span>
            <strong>{identity.publisher}</strong>
          </div>
        </div>

        <footer className="premium-updater-footnote">
          <ProductIcon name="info" size={15} weight="duotone" />
          <span>
            {text(
              locale,
              'Atualizações automáticas ainda não estão habilitadas nesta compilação de teste.',
              'Automatic updates are not enabled yet for this test build.',
            )}
          </span>
        </footer>
      </section>

      <section className="premium-about-grid">
        {[
          [
            text(locale, 'Compatibilidade do Windows', 'Windows compatibility'),
            compatibility.kind === 'supported'
              ? text(locale, 'Sistema compatível', 'Compatible system')
              : text(locale, 'Sistema não compatível', 'Unsupported system'),
            'windows',
          ],
          [text(locale, 'Canal', 'Channel'), channelLabel, 'radar'],
          [text(locale, 'Publicador', 'Publisher'), identity.publisher, 'shield'],
        ].map(([title, description, icon]) => (
          <button
            key={title}
            onClick={() => {
              notify(
                text(
                  locale,
                  `${String(title)} confirmado pela identidade nativa.`,
                  `${String(title)} confirmed by the native identity.`,
                ),
              );
            }}
            type="button"
          >
            <ProductIcon name={icon as ProductIconName} size={22} weight="duotone" />
            <span>
              <strong>{title}</strong>
              <small>{description}</small>
            </span>
            <ProductIcon name="chevronRight" size={17} />
          </button>
        ))}
      </section>
    </div>
  );
};

const AboutSurface = ({
  identity,
  locale,
  notify,
}: {
  readonly identity?: ShellInstallerIdentityJson | undefined;
  readonly locale: ShellLocale;
  readonly notify: (message: string, tone?: PremiumToastTone) => void;
}) =>
  identity === undefined ? (
    explicitDevelopmentScenarioEnabled() ? (
      <DemonstrationAboutSurface locale={locale} notify={notify} />
    ) : (
      <UnavailableAboutSurface locale={locale} />
    )
  ) : (
    <NativeAboutSurface identity={identity} locale={locale} notify={notify} />
  );

const ReviewDialog = ({
  changeCount,
  onClose,
  onConfirm,
}: {
  readonly changeCount: number;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  return (
    <div
      className="premium-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        aria-labelledby="premium-review-title"
        aria-modal="true"
        className="premium-review-dialog"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <header>
          <span>
            <ProductIcon name="list" size={24} weight="duotone" />
          </span>
          <div>
            <small>Plano demonstrativo</small>
            <h2 id="premium-review-title">Revise antes de continuar</h2>
          </div>
          <button aria-label="Fechar revisão" onClick={onClose} type="button">
            <ProductIcon name="close" size={20} />
          </button>
        </header>
        <p>
          {humanCount(changeCount, 'alteração foi preparada', 'alterações foram preparadas')}. O
          motor real ainda não está conectado nesta fase.
        </p>
        <ul>
          <li>
            <ProductIcon name="check" size={18} /> Compatibilidade verificada no cenário
          </li>
          <li>
            <ProductIcon name="recovery" size={18} /> Caminho de restauração disponível
          </li>
          <li>
            <ProductIcon name="shield" size={18} /> Nenhuma operação privilegiada será executada
          </li>
        </ul>
        <footer>
          <PremiumButton onClick={onClose}>Voltar aos ajustes</PremiumButton>
          <PremiumButton onClick={onConfirm} tone="primary">
            Confirmar demonstração
          </PremiumButton>
        </footer>
      </div>
    </div>
  );
};

const DevelopmentPremiumOperationsSurface = ({
  evidenceAuthority,
  installerIdentity,
  locale,
  navigate,
  settingsSection,
  view,
}: PremiumOperationsSurfaceProps) => {
  const rootRef = useRef<HTMLElement>(null);
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('Todos');
  const [operationState, setOperationState] = useState<Record<string, boolean>>({
    ...INITIAL_OPERATION_STATE,
  });
  const [activeGame, setActiveGame] = useState<GameProfile>(getInitialActiveGame);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [toast, setToast] = useState<PremiumToastMessage | null>(null);
  const [liveTelemetryAuthority] = useState(() => createTauriLiveTelemetryAuthority());
  usePremiumLocalization(rootRef, locale);

  useEffect(() => {
    setQuery('');
    setActiveFilter('Todos');
  }, [view]);

  useEffect(() => {
    if (!reviewOpen) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setReviewOpen(false);
      }
    };
    globalThis.addEventListener('keydown', onKeyDown);
    return () => {
      globalThis.removeEventListener('keydown', onKeyDown);
    };
  }, [reviewOpen]);

  useEffect(() => {
    if (toast === null) {
      return undefined;
    }
    const timer = globalThis.setTimeout(() => {
      setToast(null);
    }, 4200);
    return () => {
      globalThis.clearTimeout(timer);
    };
  }, [toast]);

  const changeCount = Object.entries(operationState).filter(
    ([id, active]) => INITIAL_OPERATION_STATE[id] !== active,
  ).length;

  const notify = (message: string, tone: PremiumToastTone = 'success'): void => {
    if (tone !== 'warning' && !areApplicationNotificationsEnabled()) {
      return;
    }
    setToast({ id: Date.now(), message, tone });
  };

  const selectActiveGame = (profile: GameProfile): void => {
    setActiveGame(profile);
    try {
      persistActiveGameProfile(globalThis.localStorage, profile);
    } catch {
      // The selected profile still remains active for this session.
    }
    notify(`${profile.title} agora é o jogo ativo do Modo Competitivo.`);
  };

  let content: ReactNode;
  if (view === 'home') {
    content = (
      <HomeSurface
        activeGame={activeGame}
        evidenceAuthority={evidenceAuthority}
        liveTelemetryAuthority={liveTelemetryAuthority}
        locale={locale}
        navigate={navigate}
        notify={notify}
      />
    );
  } else if (view === 'competitive') {
    content = (
      <CompetitiveSurface
        activeGame={activeGame}
        notify={notify}
        onActiveGameChange={selectActiveGame}
      />
    );
  } else if (view === 'toggles' || view === 'network' || view === 'tweaks' || view === 'security') {
    content = (
      <CatalogSurface
        activeFilter={activeFilter}
        operationState={operationState}
        query={query}
        setActiveFilter={setActiveFilter}
        setOperationState={setOperationState}
        setQuery={setQuery}
        view={view}
      />
    );
  } else if (view === 'shortcuts') {
    content = <ShortcutsSurface notify={notify} />;
  } else if (view === 'power') {
    content = <PowerSurface locale={locale} notify={notify} />;
  } else if (view === 'services') {
    content = <ServicesSurface />;
  } else if (view === 'restoration') {
    content = <RestorationSurface notify={notify} />;
  } else if (view === 'uninstaller') {
    content = <UninstallerSurface locale={locale} notify={notify} />;
  } else if (view === 'downloads') {
    content = <PremiumDownloadsSurface locale={locale} notify={notify} />;
  } else if (view === 'settings') {
    content = (
      <PremiumSettingsSurface
        locale={locale}
        navigate={navigate}
        notify={notify}
        routeState={settingsSection}
      />
    );
  } else if (view === 'activity') {
    content = <ActivitySurface identity={installerIdentity} locale={locale} notify={notify} />;
  } else {
    content = <AboutSurface identity={installerIdentity} locale={locale} notify={notify} />;
  }

  return (
    <main className="premium-operations" data-premium-route={view} ref={rootRef}>
      <RouteHeader
        action={
          view === 'downloads' ? (
            <PremiumButton
              onClick={() => {
                notify('Pasta de downloads aberta no cenário demonstrativo.');
              }}
            >
              Abrir pasta
            </PremiumButton>
          ) : undefined
        }
        meta={ROUTE_META[view]}
        showDemoBadge={view !== 'about' && view !== 'home'}
      />
      <div className="premium-route-content">{content}</div>
      <PlanBar
        changeCount={changeCount}
        onDiscard={() => {
          setOperationState({ ...INITIAL_OPERATION_STATE });
          notify('Alterações demonstrativas descartadas.');
        }}
        onReview={() => {
          setReviewOpen(true);
        }}
      />
      {reviewOpen ? (
        <ReviewDialog
          changeCount={changeCount}
          onClose={() => {
            setReviewOpen(false);
          }}
          onConfirm={() => {
            setReviewOpen(false);
            setOperationState({ ...INITIAL_OPERATION_STATE });
            notify('Plano demonstrativo confirmado. Nenhuma mudança real foi aplicada.');
          }}
        />
      ) : null}
      {toast === null ? null : (
        <PremiumToast
          locale={locale}
          onClose={() => {
            setToast(null);
          }}
          toast={toast}
        />
      )}
    </main>
  );
};

const ProductionUnavailableSurface = ({
  locale,
  view,
}: Readonly<{ locale: ShellLocale; view: PremiumRouteId }>) => (
  <section className="premium-updater-card" data-phase="unavailable" role="status">
    <header className="premium-updater-header">
      <span className="premium-updater-icon">
        <ProductIcon name="warning" size={24} weight="duotone" />
      </span>
      <div>
        <span className="premium-section-label">
          {text(locale, 'RECURSO NATIVO', 'NATIVE FEATURE')}
        </span>
        <h2>{text(locale, 'Ainda não disponível', 'Not available yet')}</h2>
      </div>
    </header>
    <p className="premium-updater-error">
      {text(
        locale,
        `A operação “${ROUTE_META[view].title}” ainda não possui uma autoridade nativa validada nesta versão. Nenhuma alteração foi aplicada ao computador.`,
        `“${ROUTE_META[view].title}” does not have a validated native authority in this version. No change was applied to the computer.`,
      )}
    </p>
  </section>
);

const ProductionPremiumOperationsSurface = ({
  installerIdentity,
  locale,
  navigate,
  settingsSection,
  view,
}: PremiumOperationsSurfaceProps) => {
  const [toast, setToast] = useState<PremiumToastMessage | null>(null);

  useEffect(() => {
    if (toast === null) return undefined;
    const timer = globalThis.setTimeout(() => { setToast(null); }, 4200);
    return () => { globalThis.clearTimeout(timer); };
  }, [toast]);

  const notify = (message: string, tone: PremiumToastTone = 'success'): void => {
    setToast({ id: Date.now(), message, tone });
  };

  const content =
    view === 'about' ? (
      <AboutSurface identity={installerIdentity} locale={locale} notify={notify} />
    ) : view === 'settings' ? (
      <PremiumSettingsSurface
        locale={locale}
        navigate={navigate}
        notify={notify}
        routeState={settingsSection}
      />
    ) : (
      <ProductionUnavailableSurface locale={locale} view={view} />
    );

  return (
    <main className="premium-operations" data-premium-route={view}>
      <RouteHeader meta={ROUTE_META[view]} showDemoBadge={false} />
      <div className="premium-route-content">{content}</div>
      {toast === null ? null : (
        <PremiumToast
          locale={locale}
          onClose={() => {
            setToast(null);
          }}
          toast={toast}
        />
      )}
    </main>
  );
};

export const PremiumOperationsSurface = (props: PremiumOperationsSurfaceProps) =>
  import.meta.env.PROD &&
  import.meta.env.MODE !== 'browser-test' &&
  import.meta.env.MODE !== 'internal' ? (
    <ProductionPremiumOperationsSurface {...props} />
  ) : (
    <DevelopmentPremiumOperationsSurface {...props} />
  );
