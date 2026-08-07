import { ProductIcon, type ProductIconName } from '@liiiraa/design-system';
import type { ShellInstallerIdentityJson } from '@liiiraa/contracts-ts';
import type { ShellLocale } from '@liiiraa/feature-shell';
import { useEffect, useState } from 'react';

import type { PremiumRouteId } from './control-center-data.js';
import { PremiumSettingsSurface } from './premium-settings.js';
import { PremiumToast, type PremiumToastMessage, type PremiumToastTone } from './premium-toast.js';

export interface PremiumOperationsSurfaceProps {
  readonly installerIdentity?: ShellInstallerIdentityJson | undefined;
  readonly locale: ShellLocale;
  readonly navigate: (pathname: string) => void;
  readonly settingsSection?: string;
  readonly view: PremiumRouteId;
}

const text = (locale: ShellLocale, ptBr: string, en: string): string =>
  locale === 'pt-BR' ? ptBr : en;

const ROUTE_META: Readonly<
  Record<PremiumRouteId, Readonly<{ description: string; icon: ProductIconName; title: string }>>
> = Object.freeze({
  home: { description: 'Estado real dos recursos locais.', icon: 'gauge', title: 'Visão geral' },
  competitive: { description: 'Preparação competitiva local.', icon: 'competitive', title: 'Modo Competitivo' },
  toggles: { description: 'Controles rápidos do Windows.', icon: 'toggles', title: 'Controles rápidos' },
  shortcuts: { description: 'Atalhos locais.', icon: 'toolbox', title: 'Atalhos' },
  power: { description: 'Planos de energia do Windows.', icon: 'power', title: 'Energia' },
  network: { description: 'Recursos locais de rede.', icon: 'wifi', title: 'Rede' },
  tweaks: { description: 'Ajustes avançados locais.', icon: 'sliders', title: 'Tweaks' },
  security: { description: 'Estado local de segurança.', icon: 'shield', title: 'Segurança' },
  services: { description: 'Serviços locais do Windows.', icon: 'services', title: 'Serviços' },
  restoration: { description: 'Recuperação e restauração local.', icon: 'recovery', title: 'Restauração' },
  uninstaller: { description: 'Aplicativos instalados.', icon: 'trash', title: 'Desinstalador' },
  downloads: { description: 'Downloads oficiais.', icon: 'download', title: 'Downloads' },
  settings: { description: 'Preferências reais do aplicativo.', icon: 'settings', title: 'Configurações' },
  activity: { description: 'Atividade recebida do host nativo.', icon: 'activity', title: 'Atividade' },
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
              {text(locale, 'Identidade da instalação indisponível', 'Installation identity unavailable')}
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
          <h2>{text(locale, 'Identidade real desta instalação', 'Real identity for this installation')}</h2>
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

const UnavailableSurface = ({ locale, view }: Readonly<{ locale: ShellLocale; view: PremiumRouteId }>) => (
  <section className="premium-updater-card" data-phase="unavailable" role="status">
    <header className="premium-updater-header">
      <span className="premium-updater-icon">
        <ProductIcon name="warning" size={24} weight="duotone" />
      </span>
      <div>
        <span className="premium-section-label">{text(locale, 'RECURSO NATIVO', 'NATIVE FEATURE')}</span>
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

export const PremiumOperationsSurface = ({
  installerIdentity,
  locale,
  navigate,
  settingsSection,
  view,
}: PremiumOperationsSurfaceProps) => {
  const [toast, setToast] = useState<PremiumToastMessage | null>(null);
  useEffect(() => {
    if (toast === null) return undefined;
    const timer = globalThis.setTimeout(() => setToast(null), 4200);
    return () => globalThis.clearTimeout(timer);
  }, [toast]);

  const notify = (message: string, tone: PremiumToastTone = 'success'): void => {
    setToast({ id: Date.now(), message, tone });
  };
  const content =
    view === 'about' ? (
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
        <PremiumToast locale={locale} onClose={() => setToast(null)} toast={toast} />
      )}
    </main>
  );
};
