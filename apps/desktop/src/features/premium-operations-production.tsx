import { ProductIcon, type ProductIconName } from '@liiiraa/design-system';
import type { ShellInstallerIdentityJson } from '@liiiraa/contracts-ts';
import type { ShellLocale } from '@liiiraa/feature-shell';
import type { EvidenceAuthority, EvidenceAuthoritySnapshot } from '@liiiraa/desktop-client';
import { useEffect, useState, useSyncExternalStore } from 'react';

import type { PremiumRouteId } from './control-center-data.js';
import { PremiumSettingsSurface } from './premium-settings.js';
import { PremiumToast, type PremiumToastMessage, type PremiumToastTone } from './premium-toast.js';
import {
  createTauriLiveTelemetryAuthority,
  type LiveTelemetryAuthority,
  type LiveTelemetryAuthoritySnapshot,
  type LiveScalarMetric,
} from '../native/live-telemetry.js';

export interface PremiumOperationsSurfaceProps {
  readonly installerIdentity?: ShellInstallerIdentityJson | undefined;
  readonly evidenceAuthority?: EvidenceAuthority | undefined;
  readonly liveTelemetryAuthority?: LiveTelemetryAuthority | undefined;
  readonly locale: ShellLocale;
  readonly navigate: (pathname: string) => void;
  readonly settingsSection?: string;
  readonly view: PremiumRouteId;
}

const EMPTY_EVIDENCE_SNAPSHOT: EvidenceAuthoritySnapshot = Object.freeze({
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

const EMPTY_TELEMETRY_SNAPSHOT: LiveTelemetryAuthoritySnapshot = Object.freeze({
  revision: 0,
  status: 'idle',
  telemetry: null,
});

const emptySubscribe = (): (() => void) => () => undefined;

const text = (locale: ShellLocale, ptBr: string, en: string): string =>
  locale === 'pt-BR' ? ptBr : en;

const ROUTE_META: Readonly<
  Record<PremiumRouteId, Readonly<{ description: string; icon: ProductIconName; title: string }>>
> = Object.freeze({
  home: { description: 'Estado real dos recursos locais.', icon: 'gauge', title: 'Visão geral' },
  competitive: {
    description: 'Preparação competitiva local.',
    icon: 'competitive',
    title: 'Modo Competitivo',
  },
  toggles: {
    description: 'Controles rápidos do Windows.',
    icon: 'toggles',
    title: 'Controles rápidos',
  },
  shortcuts: { description: 'Atalhos locais.', icon: 'toolbox', title: 'Atalhos' },
  power: { description: 'Planos de energia do Windows.', icon: 'power', title: 'Energia' },
  network: { description: 'Recursos locais de rede.', icon: 'wifi', title: 'Rede' },
  tweaks: { description: 'Ajustes avançados locais.', icon: 'sliders', title: 'Tweaks' },
  security: { description: 'Estado local de segurança.', icon: 'shield', title: 'Segurança' },
  services: { description: 'Serviços locais do Windows.', icon: 'services', title: 'Serviços' },
  restoration: {
    description: 'Recuperação e restauração local.',
    icon: 'recovery',
    title: 'Restauração',
  },
  uninstaller: { description: 'Aplicativos instalados.', icon: 'trash', title: 'Desinstalador' },
  downloads: { description: 'Downloads oficiais.', icon: 'download', title: 'Downloads' },
  settings: {
    description: 'Preferências reais do aplicativo.',
    icon: 'settings',
    title: 'Configurações',
  },
  activity: {
    description: 'Atividade recebida do host nativo.',
    icon: 'activity',
    title: 'Atividade',
  },
  about: { description: 'Identidade validada da instalação.', icon: 'info', title: 'Sobre' },
});

const InstallerIdentitySurface = ({
  identity,
  locale,
}: Readonly<{ identity?: ShellInstallerIdentityJson | undefined; locale: ShellLocale }>) => {
  if (identity === undefined) {
    return (
      <section className="premium-updater-card" data-phase="unavailable" role="status">
        <header className="premium-updater-header">
          <span className="premium-updater-icon">
            <ProductIcon name="warning" size={24} weight="duotone" />
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
          </div>
        </header>
        <p className="premium-updater-error">
          {text(
            locale,
            'Não é possível verificar atualizações sem uma identidade validada pelo host nativo.',
            'Updates cannot be checked without an identity validated by the native host.',
          )}
        </p>
      </section>
    );
  }

  const channel = text(
    locale,
    {
      beta: 'Canal beta',
      development: 'Canal de desenvolvimento',
      experimental: 'Canal experimental',
      stable: 'Canal estável',
    }[identity.channel],
    {
      beta: 'Beta channel',
      development: 'Development channel',
      experimental: 'Experimental channel',
      stable: 'Stable channel',
    }[identity.channel],
  );

  return (
    <div className="premium-about-layout" data-native-installer-identity="validated">
      <section className="premium-about-hero">
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
            {text(locale, 'Versão', 'Version')} {identity.version} · {channel}
          </p>
        </div>
      </section>
      <section className="premium-updater-card" data-phase="native-disabled">
        <div className="premium-updater-overview">
          <div>
            <span>{text(locale, 'Versão instalada', 'Installed version')}</span>
            <strong>{identity.version}</strong>
          </div>
          <div>
            <span>{text(locale, 'Canal', 'Channel')}</span>
            <strong>{channel}</strong>
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
              'Atualizações automáticas ainda não estão habilitadas nesta versão.',
              'Automatic updates are not enabled in this version yet.',
            )}
          </span>
        </footer>
      </section>
    </div>
  );
};

const ProductionRouteHeader = ({ view }: Readonly<{ view: PremiumRouteId }>) => {
  const meta = ROUTE_META[view];
  return (
    <header className="premium-route-header">
      <div className="premium-route-heading">
        <span className="premium-route-icon">
          <ProductIcon name={meta.icon} size={24} />
        </span>
        <div>
          <h1 data-route-heading tabIndex={-1}>
            {meta.title}
          </h1>
          <p>{meta.description}</p>
        </div>
      </div>
    </header>
  );
};

const UnavailableSurface = ({
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
        `“${ROUTE_META[view].title}” ainda não possui uma autoridade nativa validada nesta versão. Nenhuma alteração foi aplicada ao computador.`,
        `“${ROUTE_META[view].title}” does not have a validated native authority in this version. No change was applied to the computer.`,
      )}
    </p>
  </section>
);

export const resolveGameDiscovery = (
  value: string | undefined,
): Readonly<{ names: readonly string[]; total: number }> => {
  if (value === undefined) return { names: [], total: 0 };
  const match = /^\d+ installed games · (.+)$/u.exec(value);
  if (match === null) return { names: [], total: 0 };
  const rawNames = match[1];
  if (rawNames === undefined) return { names: [], total: 0 };
  const names = rawNames
    .split(' · ')
    .filter((name) => !/^\+\d+ more$/u.test(name))
    .map((name) => name.trim())
    .filter(Boolean);
  return { names, total: Number.parseInt(value, 10) };
};

const NativeCompetitiveSurface = ({
  evidenceAuthority,
  locale,
}: Readonly<{
  evidenceAuthority?: EvidenceAuthority | undefined;
  locale: ShellLocale;
}>) => {
  const evidence = useSyncExternalStore(
    evidenceAuthority === undefined
      ? emptySubscribe
      : (notify) =>
          evidenceAuthority.subscribe(() => {
            notify();
          }),
    () => evidenceAuthority?.snapshot() ?? EMPTY_EVIDENCE_SNAPSHOT,
    () => EMPTY_EVIDENCE_SNAPSHOT,
  );
  const gamesFact = evidence.inventory?.games;
  const gameDiscovery = resolveGameDiscovery(
    gamesFact?.state === 'observed' ? gamesFact.value : undefined,
  );
  const games = gameDiscovery.names;
  const refreshing = evidence.status === 'refreshing';

  useEffect(() => {
    if (
      evidenceAuthority === undefined ||
      evidence.inventory !== null ||
      evidence.status !== 'idle'
    ) {
      return;
    }

    const collectedAt = new Date().toISOString();
    void evidenceAuthority.refreshInventory({
      request: {
        schemaVersion: '1.0',
        evidenceId: `games-inventory-${Date.now().toString(36)}`,
        evidenceVersion: 1,
        collectedAt,
        deadlineAt: new Date(Date.now() + 10_000).toISOString(),
        perSourceTimeoutMs: 2_000,
        policyDate: Number(collectedAt.slice(0, 10).replaceAll('-', '')),
      },
    });
  }, [evidence.inventory, evidence.status, evidenceAuthority]);

  const refresh = (): void => {
    if (evidenceAuthority === undefined || refreshing) return;
    const collectedAt = new Date().toISOString();
    void evidenceAuthority.refreshInventory({
      request: {
        schemaVersion: '1.0',
        evidenceId: `games-inventory-${Date.now().toString(36)}`,
        evidenceVersion: (evidence.inventory?.evidenceVersion ?? 0) + 1,
        collectedAt,
        deadlineAt: new Date(Date.now() + 10_000).toISOString(),
        perSourceTimeoutMs: 2_000,
        policyDate: Number(collectedAt.slice(0, 10).replaceAll('-', '')),
      },
    });
  };

  return (
    <div className="premium-competitive-layout" data-game-discovery={gamesFact?.state ?? 'pending'}>
      <section className="premium-competitive-hero">
        <div>
          <span className="premium-section-label">
            {text(locale, 'BIBLIOTECA LOCAL', 'LOCAL LIBRARY')}
          </span>
          <h2>
            {gameDiscovery.total > 0
              ? text(
                  locale,
                  `${String(gameDiscovery.total)} ${gameDiscovery.total === 1 ? 'jogo encontrado' : 'jogos encontrados'}`,
                  `${String(gameDiscovery.total)} ${gameDiscovery.total === 1 ? 'game found' : 'games found'}`,
                )
              : text(locale, 'Procurando jogos instalados', 'Looking for installed games')}
          </h2>
          <p>
            {text(
              locale,
              'A leitura consulta somente manifestos locais da Steam, Epic, Xbox, EA e Ubisoft. Caminhos de instalação não saem deste computador.',
              'The scan only reads local Steam, Epic, Xbox, EA and Ubisoft manifests. Installation paths never leave this computer.',
            )}
          </p>
        </div>
        <div className="premium-game-discovery-status">
          <span className="premium-game-discovery-icon">
            <ProductIcon name={games.length > 0 ? 'game' : 'recovery'} size={25} weight="duotone" />
          </span>
          <div>
            <small>{text(locale, 'Estado da leitura', 'Scan status')}</small>
            <strong>
              {refreshing
                ? text(locale, 'Atualizando biblioteca…', 'Refreshing library…')
                : gamesFact?.state === 'observed'
                  ? text(locale, 'Biblioteca verificada', 'Library verified')
                  : text(locale, 'Nenhum jogo encontrado', 'No game found')}
            </strong>
          </div>
          <button
            className="premium-button"
            data-tone="secondary"
            disabled={refreshing || evidenceAuthority === undefined}
            onClick={refresh}
            type="button"
          >
            <ProductIcon name="recovery" size={16} />
            {refreshing
              ? text(locale, 'Verificando…', 'Scanning…')
              : text(locale, 'Verificar novamente', 'Scan again')}
          </button>
        </div>
      </section>

      <section
        className="premium-discovered-games"
        aria-labelledby="premium-discovered-games-title"
      >
        <header>
          <div>
            <span className="premium-section-label">
              {text(locale, 'JOGOS INSTALADOS', 'INSTALLED GAMES')}
            </span>
            <h2 id="premium-discovered-games-title">
              {text(locale, 'Prontos para receber um perfil', 'Ready for a profile')}
            </h2>
          </div>
          <span>{text(locale, 'Somente leitura', 'Read only')}</span>
        </header>
        {games.length === 0 ? (
          <div className="premium-games-empty" role="status">
            <ProductIcon name="game" size={26} weight="duotone" />
            <div>
              <strong>{text(locale, 'Biblioteca ainda vazia', 'Library is still empty')}</strong>
              <p>
                {text(
                  locale,
                  'Abra um launcher ao menos uma vez e use “Verificar novamente”. Nenhuma otimização é aplicada nesta etapa.',
                  'Open a launcher at least once and use “Scan again”. No optimization is applied at this stage.',
                )}
              </p>
            </div>
          </div>
        ) : (
          <div className="premium-games-grid">
            {games.map((game) => (
              <article key={game}>
                <span>
                  <ProductIcon name="game" size={20} weight="duotone" />
                </span>
                <div>
                  <strong>{game}</strong>
                  <small>{text(locale, 'Detectado no Windows', 'Detected on Windows')}</small>
                </div>
                <span className="premium-status-pill">{text(locale, 'Encontrado', 'Found')}</span>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

const decimal = (locale: ShellLocale, value: number, digits = 1): string =>
  new Intl.NumberFormat(locale, { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(
    value,
  );

const scalarValue = (locale: ShellLocale, metric: LiveScalarMetric | undefined): string => {
  if (metric?.state !== 'observed' || metric.value === null) {
    return locale === 'pt-BR' ? 'Indisponível' : 'Unavailable';
  }
  return metric.unit === 'percent'
    ? `${decimal(locale, metric.value)}%`
    : `${decimal(locale, metric.value, 3)} ms`;
};

const appendSample = (
  values: readonly number[],
  value: number | null | undefined,
): readonly number[] =>
  value === null || value === undefined ? values : [...values.slice(-23), value];

const TelemetrySparkline = ({
  label,
  maximum,
  values,
}: Readonly<{ label: string; maximum: number; values: readonly number[] }>) => {
  const usableMaximum = Math.max(maximum, ...values, 1);
  const coordinates = values.map((value, index) => {
    const x = values.length <= 1 ? 100 : (index / (values.length - 1)) * 100;
    const y = 34 - (Math.min(value, usableMaximum) / usableMaximum) * 29;
    return { x, y };
  });
  const points = coordinates.map(({ x, y }) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const areaPoints = points.length === 0 ? '' : `0,36 ${points} 100,36`;
  const lastPoint = coordinates.at(-1);
  return (
    <span className="premium-metric-chart">
      <svg
        aria-label={label}
        className="premium-metric-sparkline"
        preserveAspectRatio="none"
        role="img"
        viewBox="0 0 100 36"
      >
        <title>{label}</title>
        <path d="M0 12H100 M0 24H100 M0 35.5H100" />
        {areaPoints === '' ? null : <polygon points={areaPoints} />}
        {points === '' ? null : <polyline points={points} />}
        {lastPoint === undefined ? null : (
          <circle cx={lastPoint.x} cy={lastPoint.y} r="1.8" vectorEffect="non-scaling-stroke" />
        )}
      </svg>
      <span aria-hidden="true" className="premium-metric-chart-range">
        <span>0</span>
        <span>{Math.round(usableMaximum)}</span>
      </span>
    </span>
  );
};

const NativeLiveTelemetrySurface = ({
  evidenceAuthority,
  liveTelemetryAuthority,
  locale,
}: Readonly<{
  evidenceAuthority?: EvidenceAuthority | undefined;
  liveTelemetryAuthority: LiveTelemetryAuthority;
  locale: ShellLocale;
}>) => {
  const evidence = useSyncExternalStore(
    evidenceAuthority === undefined
      ? emptySubscribe
      : (notify) =>
          evidenceAuthority.subscribe(() => {
            notify();
          }),
    () => evidenceAuthority?.snapshot() ?? EMPTY_EVIDENCE_SNAPSHOT,
    () => EMPTY_EVIDENCE_SNAPSHOT,
  );
  const live = useSyncExternalStore(
    (notify) => liveTelemetryAuthority.subscribe(notify),
    () => liveTelemetryAuthority.snapshot(),
    () => EMPTY_TELEMETRY_SNAPSHOT,
  );
  const [history, setHistory] = useState<{
    readonly cpu: readonly number[];
    readonly gpu: readonly number[];
    readonly memory: readonly number[];
    readonly latency: readonly number[];
  }>(() => ({ cpu: [], gpu: [], memory: [], latency: [] }));

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
        perSourceTimeoutMs: 2_000,
        policyDate: Number(collectedAt.slice(0, 10).replaceAll('-', '')),
      },
    });
    return () => {
      controller.abort();
    };
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

  useEffect(() => {
    const telemetry = live.telemetry;
    if (telemetry === null) return;
    setHistory((current) => ({
      cpu: appendSample(
        current.cpu,
        telemetry.cpu.state === 'observed' ? telemetry.cpu.value : null,
      ),
      gpu: appendSample(
        current.gpu,
        telemetry.gpu.state === 'observed' ? telemetry.gpu.value : null,
      ),
      memory: appendSample(
        current.memory,
        telemetry.memory.state === 'observed' ? telemetry.memory.loadPercent : null,
      ),
      latency: appendSample(
        current.latency,
        telemetry.collectionLatency.state === 'observed' ? telemetry.collectionLatency.value : null,
      ),
    }));
  }, [live.revision, live.telemetry]);

  const inventory = evidence.inventory;
  const telemetry = live.telemetry;
  const hardware = [
    ['windows', text(locale, 'Sistema', 'System'), inventory?.windows],
    ['cpu', text(locale, 'Processador', 'Processor'), inventory?.cpu],
    ['graphics', 'GPU', inventory?.gpu],
    ['memory', text(locale, 'Memória instalada', 'Installed memory'), inventory?.memory],
  ] as const;
  const memoryValue =
    telemetry?.memory.state === 'observed' && telemetry.memory.usedBytes !== null
      ? `${decimal(locale, telemetry.memory.usedBytes / 1_073_741_824)} GB`
      : text(locale, 'Indisponível', 'Unavailable');
  const memoryDetail =
    telemetry?.memory.state === 'observed' && telemetry.memory.loadPercent !== null
      ? text(
          locale,
          `${decimal(locale, telemetry.memory.loadPercent)}% em uso${inventory?.memory.state === 'observed' ? ` · ${inventory.memory.value}` : ''}`,
          `${decimal(locale, telemetry.memory.loadPercent)}% in use${inventory?.memory.state === 'observed' ? ` · ${inventory.memory.value}` : ''}`,
        )
      : text(locale, 'Aguardando leitura nativa do Windows', 'Waiting for native Windows reading');
  const liveLabel =
    live.status === 'ready'
      ? text(locale, 'Ao vivo', 'Live')
      : live.status === 'reading'
        ? text(locale, 'Preparando leitura', 'Preparing reading')
        : text(locale, 'Telemetria indisponível', 'Telemetry unavailable');
  const metrics: readonly Readonly<{
    icon: ProductIconName;
    label: string;
    value: string;
    detail: string | undefined;
    history: readonly number[];
    maximum: number;
  }>[] = [
    {
      icon: 'cpu',
      label: 'CPU',
      value: scalarValue(locale, telemetry?.cpu),
      detail:
        telemetry?.cpu.state === 'observed'
          ? text(locale, 'Carga total do processador', 'Total processor load')
          : text(locale, 'Aguardando contador nativo da CPU', 'Waiting for the native CPU counter'),
      history: history.cpu,
      maximum: 100,
    },
    {
      icon: 'graphics',
      label: 'GPU',
      value: scalarValue(locale, telemetry?.gpu),
      detail:
        telemetry?.gpu.state === 'observed'
          ? text(locale, 'Motor gráfico mais exigido agora', 'Busiest graphics engine right now')
          : text(
              locale,
              'O Windows ainda não entregou uma amostra confiável da GPU',
              'Windows has not provided a trustworthy GPU sample yet',
            ),
      history: history.gpu,
      maximum: 100,
    },
    {
      icon: 'memory',
      label: text(locale, 'Memória', 'Memory'),
      value: memoryValue,
      detail: memoryDetail,
      history: history.memory,
      maximum: 100,
    },
    {
      icon: 'activity',
      label: text(locale, 'Tempo da coleta', 'Collection time'),
      value: scalarValue(locale, telemetry?.collectionLatency),
      detail: text(
        locale,
        'Custo do monitoramento nesta amostra',
        'Monitoring cost for this sample',
      ),
      history: history.latency,
      maximum: Math.max(4, ...history.latency),
    },
  ];

  return (
    <div
      data-evidence-origin={evidenceAuthority?.origin ?? 'unavailable'}
      data-telemetry-authority={live.status === 'idle' ? 'unavailable' : live.status}
    >
      <section
        aria-label={text(locale, 'Hardware observado pelo Windows', 'Hardware observed by Windows')}
        className="premium-hardware-strip"
      >
        {hardware.map(([icon, label, fact]) => (
          <div data-evidence-state={fact?.state ?? 'unavailable'} key={label}>
            <ProductIcon name={icon as ProductIconName} size={21} weight="duotone" />
            <span>
              <small>{label}</small>
              <strong>
                {fact?.state === 'observed'
                  ? fact.value
                  : text(locale, 'Não disponível', 'Not available')}
              </strong>
            </span>
          </div>
        ))}
      </section>

      <article className="premium-metrics-panel">
        <header>
          <div>
            <span className="premium-section-label">
              {text(locale, 'TELEMETRIA NATIVA LOCAL', 'LOCAL NATIVE TELEMETRY')}
            </span>
            <h2>{text(locale, 'Desempenho em tempo real', 'Live performance')}</h2>
          </div>
          <span className="premium-live" data-state={live.status}>
            <span aria-hidden="true" />
            {liveLabel}
          </span>
        </header>
        <div className="premium-metric-grid">
          {metrics.map(({ icon, label, value, detail, history: metricHistory, maximum }) => (
            <div
              data-metric-state={
                value.includes('dispon') || value.includes('available') ? 'unavailable' : 'observed'
              }
              key={label}
            >
              <span className="premium-metric-icon">
                <ProductIcon name={icon} size={18} weight="duotone" />
              </span>
              <span>
                <small>{label}</small>
                <strong>{value}</strong>
                <em>
                  {detail ??
                    text(locale, 'Aguardando leitura nativa', 'Waiting for native reading')}
                </em>
                <TelemetrySparkline
                  label={text(locale, `Histórico recente de ${label}`, `Recent ${label} history`)}
                  maximum={maximum}
                  values={metricHistory}
                />
              </span>
            </div>
          ))}
        </div>
        <footer className="premium-telemetry-context">
          <div>
            <ProductIcon name="shield" size={18} weight="duotone" />
            <span>
              <strong>
                {text(locale, 'Monitoramento somente leitura', 'Read-only monitoring')}
              </strong>
              <small>
                {text(locale, 'Dados nativos deste computador', 'Native data from this computer')}
              </small>
            </span>
          </div>
          <span>
            <ProductIcon name="check" size={14} weight="fill" />
            {text(locale, 'Nenhuma alteração aplicada', 'No changes applied')}
          </span>
        </footer>
      </article>
    </div>
  );
};

export const PremiumOperationsSurface = ({
  evidenceAuthority,
  installerIdentity,
  liveTelemetryAuthority: injectedLiveTelemetryAuthority,
  locale,
  navigate,
  settingsSection,
  view,
}: PremiumOperationsSurfaceProps) => {
  const [ownedLiveTelemetryAuthority] = useState(
    () => injectedLiveTelemetryAuthority ?? createTauriLiveTelemetryAuthority(),
  );
  const [toast, setToast] = useState<PremiumToastMessage | null>(null);
  useEffect(() => {
    if (toast === null) return undefined;
    const timer = globalThis.setTimeout(() => {
      setToast(null);
    }, 4200);
    return () => {
      globalThis.clearTimeout(timer);
    };
  }, [toast]);

  const notify = (message: string, tone: PremiumToastTone = 'success'): void => {
    setToast({ id: Date.now(), message, tone });
  };
  const content =
    view === 'home' ? (
      <NativeLiveTelemetrySurface
        evidenceAuthority={evidenceAuthority}
        liveTelemetryAuthority={ownedLiveTelemetryAuthority}
        locale={locale}
      />
    ) : view === 'competitive' ? (
      <NativeCompetitiveSurface evidenceAuthority={evidenceAuthority} locale={locale} />
    ) : view === 'about' ? (
      <InstallerIdentitySurface identity={installerIdentity} locale={locale} />
    ) : view === 'settings' ? (
      <PremiumSettingsSurface
        installedVersion={installerIdentity?.version}
        locale={locale}
        navigate={navigate}
        notify={notify}
        routeState={settingsSection}
      />
    ) : (
      <UnavailableSurface locale={locale} view={view} />
    );

  return (
    <main className="premium-operations" data-premium-route={view}>
      <ProductionRouteHeader view={view} />
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
