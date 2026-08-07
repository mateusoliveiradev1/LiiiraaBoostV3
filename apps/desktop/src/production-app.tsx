import type {
  RendererToHostShellCommandJson,
  ShellCloseContextJson,
  ShellCloseResolutionJson,
  ShellInstallerIdentityJson,
  ShellNavigationIntentJson,
} from '@liiiraa/contracts-ts';
import { LbButton, ProductIcon } from '@liiiraa/design-system';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AccountExperience, type AccountExperienceView } from './features/account-experience.js';
import { PremiumOperationsSurface } from './features/premium-operations-production.js';
import type { PremiumRouteId } from './features/control-center-data.js';
import { createShellBridge, type ShellBridge } from './native/shell-bridge.js';
import { DesktopPreferencesProvider, useDesktopPreferences } from './preferences.js';

const ACCOUNT_VIEWS: Readonly<Record<string, AccountExperienceView>> = Object.freeze({
  '/account/device': 'device',
  '/account/devices': 'device',
  '/account/overview': 'overview',
  '/account/security': 'security',
  '/account/subscription': 'subscription',
});

const PREMIUM_VIEWS: Readonly<Record<string, PremiumRouteId>> = Object.freeze({
  '/activity': 'activity',
  '/about': 'about',
  '/competitive': 'competitive',
  '/downloads': 'downloads',
  '/home': 'home',
  '/network': 'network',
  '/power': 'power',
  '/restoration': 'restoration',
  '/security': 'security',
  '/services': 'services',
  '/shortcuts': 'shortcuts',
  '/toggles': 'toggles',
  '/tweaks': 'tweaks',
  '/uninstaller': 'uninstaller',
});

const routeForIntent = (intent: ShellNavigationIntentJson): string => {
  if (intent.kind === 'settings') return `/settings/${intent.destination}`;
  if (intent.kind === 'documentation') return '/home';
  if (intent.kind === 'calibration') return '/home';
  const routes = {
    account: '/account/overview',
    activity: '/activity',
    assistant: '/home',
    home: '/home',
    improve: '/home',
    measure: '/home',
    prepare: '/home',
    recover: '/restoration',
  } satisfies Readonly<Record<typeof intent.destination, string>>;
  return routes[intent.destination];
};

const ProductionWindowTitleBar = ({ locale }: { readonly locale: 'en' | 'pt-BR' }) => {
  const run = (action: 'close' | 'minimize' | 'toggleMaximize'): void => {
    const window = getCurrentWindow();
    void (action === 'close'
      ? window.close()
      : action === 'minimize'
        ? window.minimize()
        : window.toggleMaximize());
  };
  return (
    <div className="lb-title-bar" data-tauri-drag-region>
      <strong className="lb-product-brand">Liiiraa Boost</strong>
      <span>{locale === 'pt-BR' ? 'Ambiente local protegido' : 'Protected local environment'}</span>
      <div className="lb-window-controls">
        <button aria-label={locale === 'pt-BR' ? 'Minimizar' : 'Minimize'} onClick={() => { run('minimize'); }} type="button">
          <ProductIcon name="minus" size={16} />
        </button>
        <button aria-label={locale === 'pt-BR' ? 'Maximizar' : 'Maximize'} onClick={() => { run('toggleMaximize'); }} type="button">
          <ProductIcon name="app" size={16} />
        </button>
        <button aria-label={locale === 'pt-BR' ? 'Fechar' : 'Close'} onClick={() => { run('close'); }} type="button">
          <ProductIcon name="close" size={16} />
        </button>
      </div>
    </div>
  );
};

const ProductionShell = () => {
  const { preferences } = useDesktopPreferences();
  const locale = preferences.locale === 'pt-BR' ? 'pt-BR' : 'en';
  const [path, setPath] = useState(() => globalThis.location.pathname || '/login');
  const [installerIdentity, setInstallerIdentity] = useState<ShellInstallerIdentityJson>();
  const [closeContext, setCloseContext] = useState<ShellCloseContextJson>();
  const bridgeRef = useRef<ShellBridge | undefined>(undefined);
  const sequenceRef = useRef(0);

  const navigate = useCallback((nextPath: string): void => {
    globalThis.history.pushState(null, '', nextPath);
    setPath(nextPath);
  }, []);

  useEffect(() => {
    const onPopState = () => { setPath(globalThis.location.pathname); };
    globalThis.addEventListener('popstate', onPopState);
    return () => { globalThis.removeEventListener('popstate', onPopState); };
  }, []);

  useEffect(() => {
    if (!Reflect.has(globalThis, '__TAURI_INTERNALS__')) return undefined;
    const bridge = createShellBridge({
      handlers: {
        onCloseRequest: (event) => { setCloseContext(event.payload.context); },
        onInstallerIdentity: (event) => { setInstallerIdentity(event.payload.installer); },
        onLocale: () => undefined,
        onNavigation: (event) => { navigate(routeForIntent(event.payload.intent)); },
        onNotificationPreference: () => undefined,
        onStartupState: () => undefined,
        onTrayPreference: () => undefined,
        onWindowState: () => undefined,
      },
    });
    bridgeRef.current = bridge;
    void bridge.start();
    return () => {
      bridgeRef.current = undefined;
      void bridge.dispose();
    };
  }, [navigate]);

  const resolveClose = (resolution: ShellCloseResolutionJson): void => {
    sequenceRef.current += 1;
    const command: RendererToHostShellCommandJson = {
      schemaVersion: '1.0',
      messageType: 'desktop.shell.resolve-close.command',
      requestId: `production-renderer-${String(sequenceRef.current).padStart(6, '0')}`,
      issuedAt: new Date().toISOString(),
      payload: { resolution },
    };
    void bridgeRef.current?.send(command);
    setCloseContext(undefined);
  };

  const settingsSection = path.startsWith('/settings/') ? path.slice('/settings/'.length) : undefined;
  const accountView = ACCOUNT_VIEWS[path];
  const premiumView = PREMIUM_VIEWS[path];
  const content =
    path === '/login' ? (
      <AccountExperience locale={locale} navigate={navigate} scenarioId="production" view="login" />
    ) : accountView !== undefined ? (
      <AccountExperience locale={locale} navigate={navigate} scenarioId="production" view={accountView} />
    ) : settingsSection !== undefined ? (
      <PremiumOperationsSurface
        installerIdentity={installerIdentity}
        locale={locale}
        navigate={navigate}
        settingsSection={settingsSection}
        view="settings"
      />
    ) : (
      <PremiumOperationsSurface
        installerIdentity={installerIdentity}
        locale={locale}
        navigate={navigate}
        view={premiumView ?? 'home'}
      />
    );

  const navigation = useMemo(
    () => [
      ['/home', locale === 'pt-BR' ? 'Visão geral' : 'Overview', 'gauge'],
      ['/account/overview', locale === 'pt-BR' ? 'Conta' : 'Account', 'profile'],
      ['/settings/general', locale === 'pt-BR' ? 'Configurações' : 'Settings', 'settings'],
      ['/about', locale === 'pt-BR' ? 'Sobre' : 'About', 'info'],
    ] as const,
    [locale],
  );

  return (
    <div className="desktop-app-shell" data-operational-state="loading" data-route-path={path}>
      <div className="desktop-title-region">
        <ProductionWindowTitleBar locale={locale} />
      </div>
      {path === '/login' ? null : (
        <aside className="desktop-goal-region">
          <nav aria-label={locale === 'pt-BR' ? 'Navegação principal' : 'Primary navigation'}>
            <ul>
              {navigation.map(([href, label, icon]) => (
                <li key={href}>
                  <button aria-current={path === href ? 'page' : undefined} onClick={() => { navigate(href); }} type="button">
                    <ProductIcon name={icon} size={19} />
                    <span>{label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
      )}
      <div className="desktop-work-canvas">{content}</div>
      {closeContext === undefined ? null : (
        <div className="premium-dialog-backdrop" role="presentation">
          <section aria-modal="true" className="premium-review-dialog" role="dialog">
            <h2>{locale === 'pt-BR' ? 'Confirmar fechamento' : 'Confirm close'}</h2>
            {closeContext.kind === 'recovery-in-progress' ? (
              <>
                <p>{locale === 'pt-BR' ? 'Uma recuperação está em andamento.' : 'Recovery is in progress.'}</p>
                <LbButton onPress={() => { resolveClose({ context: 'recovery-in-progress', decision: 'keep-running-in-tray' }); }} variant="secondary">
                  {locale === 'pt-BR' ? 'Manter no tray' : 'Keep running in tray'}
                </LbButton>
                <LbButton onPress={() => { resolveClose({ context: 'recovery-in-progress', decision: 'stay-here' }); }} variant="primary">
                  {locale === 'pt-BR' ? 'Permanecer aqui' : 'Stay here'}
                </LbButton>
              </>
            ) : (
              <>
                <LbButton onPress={() => { resolveClose({ context: 'ordinary', decision: 'keep-running-in-tray' }); }} variant="secondary">
                  {locale === 'pt-BR' ? 'Manter no tray' : 'Keep running in tray'}
                </LbButton>
                <LbButton onPress={() => { resolveClose({ context: 'ordinary', decision: 'close-interface' }); }} variant="destructive">
                  {locale === 'pt-BR' ? 'Encerrar interface' : 'Close interface'}
                </LbButton>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

export const ProductionDesktopApp = () => (
  <DesktopPreferencesProvider>
    <ProductionShell />
  </DesktopPreferencesProvider>
);
