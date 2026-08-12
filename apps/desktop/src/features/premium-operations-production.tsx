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
      : (notify) => evidenceAuthority.subscribe(() => notify()),
    evidenceAuthority?.snapshot ?? (() => EMPTY_EVIDENCE_SNAPSHOT),
    () => EMPTY_EVIDENCE_SNAPSHOT,
  );
  const live = useSyncExternalStore(
    liveTelemetryAuthority.subscribe,
    liveTelemetryAuthority.snapshot,
    () => EMPTY_TELEMETRY_SNAPSHOT,
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
          `${decimal(locale, telemetry.memory.loadPercent)}% da memória física em uso`,
          `${decimal(locale, telemetry.memory.loadPercent)}% of physical memory in use`,
        )
      : text(locale, 'Aguardando leitura nativa do Windows', 'Waiting for native Windows reading');
  const liveLabel =
    live.status === 'ready'
      ? text(locale, 'Atualizando', 'Updating')
      : live.status === 'reading'
        ? text(locale, 'Lendo', 'Reading')
        : text(locale, 'Indisponível', 'Unavailable');
  const metrics: readonly Readonly<{
    icon: ProductIconName;
    label: string;
    value: string;
    detail: string | undefined;
  }>[] = [
    {
      icon: 'cpu',
      label: 'CPU',
      value: scalarValue(locale, telemetry?.cpu),
      detail:
        telemetry?.cpu.state === 'observed'
          ? text(locale, 'Uso total medido pelo Windows', 'Total usage measured by Windows')
          : text(locale, 'Aguardando contador nativo da CPU', 'Waiting for the native CPU counter'),
    },
    {
      icon: 'graphics',
      label: 'GPU',
      value: scalarValue(locale, telemetry?.gpu),
      detail:
        telemetry?.gpu.state === 'observed'
          ? text(
              locale,
              'Motor gráfico mais ocupado, medido pelo Windows',
              'Busiest graphics engine measured by Windows',
            )
          : text(
              locale,
              'O Windows ainda não entregou uma amostra confiável da GPU',
              'Windows has not provided a trustworthy GPU sample yet',
            ),
    },
    {
      icon: 'memory',
      label: text(locale, 'Memória', 'Memory'),
      value: memoryValue,
      detail: memoryDetail,
    },
    {
      icon: 'activity',
      label: text(locale, 'Tempo da coleta', 'Collection time'),
      value: scalarValue(locale, telemetry?.collectionLatency),
      detail: text(
        locale,
        'Tempo gasto para concluir esta leitura local',
        'Time spent completing this local reading',
      ),
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
            <h2>{text(locale, 'Leitura atual', 'Current reading')}</h2>
          </div>
          <span className="premium-live" data-state={live.status}>
            <span aria-hidden="true" />
            {liveLabel}
          </span>
        </header>
        <div className="premium-metric-grid">
          {metrics.map(({ icon, label, value, detail }) => (
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
