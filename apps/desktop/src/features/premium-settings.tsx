import { ProductIcon } from '@liiiraa/design-system';
import type { ProductIconName } from '@liiiraa/design-system';
import type { ShellLocale } from '@liiiraa/feature-shell';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  PreConsentLocaleControl,
  useDesktopPreferences,
  type DesktopTheme,
} from '../preferences.js';
import { launchOnStartup } from '../native/launch-on-startup.js';

type SettingsSection = 'general' | 'appearance' | 'notifications' | 'privacy' | 'data';
type LocalSetting = 'analytics' | 'autoUpdate' | 'notifications';
type LaunchOnStartupStatus = 'error' | 'loading' | 'ready' | 'updating';

interface LocalSettings {
  readonly analytics: boolean;
  readonly autoUpdate: boolean;
  readonly notifications: boolean;
}

const LOCAL_SETTINGS_KEY = 'liiiraa.desktop.visual-settings.v1';
const DEFAULT_LOCAL_SETTINGS: LocalSettings = Object.freeze({
  analytics: false,
  autoUpdate: true,
  notifications: true,
});

const text = (locale: ShellLocale, ptBr: string, english: string): string =>
  locale === 'pt-BR' ? ptBr : english;

const loadLocalSettings = (): LocalSettings => {
  try {
    const parsed = JSON.parse(
      globalThis.localStorage.getItem(LOCAL_SETTINGS_KEY) ?? 'null',
    ) as Partial<LocalSettings> | null;
    if (parsed === null || typeof parsed !== 'object') return DEFAULT_LOCAL_SETTINGS;
    return Object.freeze({
      analytics: parsed.analytics === true,
      autoUpdate: parsed.autoUpdate !== false,
      notifications: parsed.notifications !== false,
    });
  } catch {
    return DEFAULT_LOCAL_SETTINGS;
  }
};

const SECTION_FROM_ROUTE: Readonly<Record<string, SettingsSection>> = Object.freeze({
  advanced: 'data',
  appearance: 'appearance',
  general: 'general',
  notifications: 'notifications',
  privacy: 'privacy',
});

const ROUTE_FROM_SECTION: Readonly<Record<SettingsSection, string>> = Object.freeze({
  appearance: '/settings/appearance',
  data: '/settings/advanced',
  general: '/settings/general',
  notifications: '/settings/notifications',
  privacy: '/settings/privacy',
});

interface PremiumSettingsSurfaceProps {
  readonly locale: ShellLocale;
  readonly navigate: (pathname: string) => void;
  readonly notify: (message: string, tone?: 'info' | 'success' | 'warning') => void;
  readonly routeState?: string | undefined;
}

interface SettingSwitchProps {
  readonly active: boolean;
  readonly description: string;
  readonly disabled?: boolean;
  readonly label: string;
  readonly locale: ShellLocale;
  readonly onToggle: () => void;
  readonly pending?: boolean;
}

const SettingSwitch = ({
  active,
  description,
  disabled = false,
  label,
  locale,
  onToggle,
  pending = false,
}: SettingSwitchProps): ReactNode => (
  <article>
    <span>
      <strong>{label}</strong>
      <small>{description}</small>
    </span>
    <button
      aria-checked={active}
      aria-busy={pending}
      aria-label={`${active ? text(locale, 'Desativar', 'Disable') : text(locale, 'Ativar', 'Enable')} ${label}`}
      className="premium-switch"
      disabled={disabled}
      onClick={onToggle}
      role="switch"
      type="button"
    >
      <span />
    </button>
  </article>
);

export const PremiumSettingsSurface = ({
  locale,
  navigate,
  notify,
  routeState = 'general',
}: PremiumSettingsSurfaceProps): ReactNode => {
  const { dispatch, preferences, resolvedTheme, setTheme, theme } = useDesktopPreferences();
  const [section, setSection] = useState<SettingsSection>(
    SECTION_FROM_ROUTE[routeState] ?? 'general',
  );
  const [localSettings, setLocalSettings] = useState<LocalSettings>(loadLocalSettings);
  const [launchEnabled, setLaunchEnabled] = useState(false);
  const [launchStatus, setLaunchStatus] = useState<LaunchOnStartupStatus>('loading');

  useEffect(() => {
    setSection(SECTION_FROM_ROUTE[routeState] ?? 'general');
  }, [routeState]);

  useEffect(() => {
    let active = true;
    void launchOnStartup
      .get()
      .then((enabled) => {
        if (active) {
          setLaunchEnabled(enabled);
          setLaunchStatus('ready');
        }
      })
      .catch(() => {
        if (active) {
          setLaunchStatus('error');
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    try {
      globalThis.localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(localSettings));
    } catch {
      // Settings remain functional for the active session if storage is unavailable.
    }
  }, [localSettings]);

  const sections = useMemo(
    () =>
      [
        ['general', text(locale, 'Geral', 'General')],
        ['appearance', text(locale, 'Aparência', 'Appearance')],
        ['notifications', text(locale, 'Notificações', 'Notifications')],
        ['privacy', text(locale, 'Privacidade', 'Privacy')],
        ['data', text(locale, 'Dados e recuperação', 'Data and recovery')],
      ] as const,
    [locale],
  );

  const sectionLabel = sections.find(([id]) => id === section)?.[1] ?? sections[0][1];

  const updateLocalSetting = (key: LocalSetting): void => {
    setLocalSettings((current) => ({ ...current, [key]: !current[key] }));
  };

  const toggleLaunchOnStartup = async (): Promise<void> => {
    if (launchStatus === 'loading' || launchStatus === 'updating') {
      return;
    }
    const requestedState = !launchEnabled;
    setLaunchStatus('updating');
    try {
      const verifiedState = await launchOnStartup.set(requestedState);
      setLaunchEnabled(verifiedState);
      setLaunchStatus('ready');
      if (verifiedState !== requestedState) {
        notify(
          text(
            locale,
            'O Windows não confirmou a alteração da inicialização.',
            'Windows did not confirm the startup change.',
          ),
          'warning',
        );
        return;
      }
      notify(
        requestedState
          ? text(
              locale,
              'Liiiraa Boost iniciará com o Windows.',
              'Liiiraa Boost will start with Windows.',
            )
          : text(locale, 'Inicialização com o Windows desativada.', 'Start with Windows disabled.'),
        'success',
      );
    } catch {
      setLaunchStatus('error');
      notify(
        text(
          locale,
          'Não foi possível alterar a inicialização do Windows. Tente novamente.',
          'Could not change Windows startup. Please try again.',
        ),
        'warning',
      );
    }
  };

  const openSection = (nextSection: SettingsSection): void => {
    setSection(nextSection);
    navigate(ROUTE_FROM_SECTION[nextSection]);
  };

  return (
    <div className="premium-settings-layout" data-premium-localized>
      <nav aria-label={text(locale, 'Seções de configurações', 'Settings sections')}>
        {sections.map(([id, label]) => (
          <button
            aria-current={section === id ? 'page' : undefined}
            key={id}
            onClick={() => {
              openSection(id);
            }}
            type="button"
          >
            {label}
          </button>
        ))}
      </nav>

      <section>
        <header>
          <span className="premium-section-label">
            {text(locale, 'Preferências do aplicativo', 'Application preferences')}
          </span>
          <h2>{sectionLabel}</h2>
        </header>

        {section === 'data' ? (
          <div className="premium-settings-actions">
            {[
              [
                text(locale, 'Exportar perfil', 'Export profile'),
                text(
                  locale,
                  'Gera um arquivo com preferências e o plano atual.',
                  'Creates a file with preferences and the current plan.',
                ),
                'download',
              ],
              [
                text(locale, 'Importar perfil', 'Import profile'),
                text(
                  locale,
                  'Valida o perfil antes de mostrar as diferenças.',
                  'Validates the profile before showing differences.',
                ),
                'package',
              ],
              [
                text(locale, 'Abrir pasta de logs', 'Open logs folder'),
                text(
                  locale,
                  'Logs locais com dados sensíveis removidos.',
                  'Local logs with sensitive data redacted.',
                ),
                'activity',
              ],
              [
                text(locale, 'Reexaminar hardware', 'Rescan hardware'),
                text(
                  locale,
                  'Atualiza o inventário do cenário demonstrativo.',
                  'Refreshes the demonstration hardware inventory.',
                ),
                'radar',
              ],
              [
                text(locale, 'Rever primeira abertura', 'Review first launch'),
                text(
                  locale,
                  'Reabre a explicação de segurança e verificação.',
                  'Reopens the safety and verification explanation.',
                ),
                'shield',
              ],
            ].map(([title, description, icon]) => (
              <button
                key={title}
                onClick={() => {
                  notify(
                    text(
                      locale,
                      `${String(title)}: fluxo visual concluído.`,
                      `${String(title)}: visual flow completed.`,
                    ),
                    'success',
                  );
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
            {section === 'general' ? (
              <>
                <article>
                  <span>
                    <strong>{text(locale, 'Idioma da interface', 'Interface language')}</strong>
                    <small>
                      {text(
                        locale,
                        'Altera menus, mensagens e controles do aplicativo.',
                        'Changes application menus, messages, and controls.',
                      )}
                    </small>
                  </span>
                  <PreConsentLocaleControl />
                </article>
                <SettingSwitch
                  active={launchEnabled}
                  description={
                    launchStatus === 'loading'
                      ? text(
                          locale,
                          'Verificando a inicialização do Windows…',
                          'Checking Windows startup…',
                        )
                      : launchStatus === 'updating'
                        ? text(locale, 'Aplicando alteração…', 'Applying change…')
                        : launchStatus === 'error'
                          ? text(
                              locale,
                              'Não foi possível verificar. Tente novamente.',
                              'Could not verify the setting. Please try again.',
                            )
                          : text(
                              locale,
                              'Abre o Liiiraa Boost ao entrar na sua conta do Windows.',
                              'Opens Liiiraa Boost when you sign in to Windows.',
                            )
                  }
                  disabled={launchStatus === 'loading' || launchStatus === 'updating'}
                  label={text(locale, 'Iniciar com o Windows', 'Start with Windows')}
                  locale={locale}
                  onToggle={() => {
                    void toggleLaunchOnStartup();
                  }}
                  pending={launchStatus === 'loading' || launchStatus === 'updating'}
                />
                <SettingSwitch
                  active={preferences.trayEnabled}
                  description={text(
                    locale,
                    'Continua disponível sem manter a janela aberta.',
                    'Stays available without keeping the window open.',
                  )}
                  label={text(locale, 'Manter na bandeja', 'Keep in system tray')}
                  locale={locale}
                  onToggle={() => {
                    dispatch({ type: 'set-tray-enabled', enabled: !preferences.trayEnabled });
                  }}
                />
                <SettingSwitch
                  active={localSettings.autoUpdate}
                  description={text(
                    locale,
                    'Busca atualizações assinadas quando disponíveis.',
                    'Checks for signed updates when available.',
                  )}
                  label={text(locale, 'Atualizações automáticas', 'Automatic updates')}
                  locale={locale}
                  onToggle={() => {
                    updateLocalSetting('autoUpdate');
                  }}
                />
              </>
            ) : null}

            {section === 'appearance' ? (
              <>
                <SettingSwitch
                  active={preferences.motion === 'reduced'}
                  description={text(
                    locale,
                    'Remove animações não essenciais e mantém feedback instantâneo.',
                    'Removes non-essential animation while preserving instant feedback.',
                  )}
                  label={text(locale, 'Reduzir movimento', 'Reduce motion')}
                  locale={locale}
                  onToggle={() => {
                    dispatch({
                      type: 'set-motion',
                      motion: preferences.motion === 'reduced' ? 'responsive' : 'reduced',
                    });
                  }}
                />
                <article>
                  <span>
                    <strong>{text(locale, 'Tema do aplicativo', 'Application theme')}</strong>
                    <small>
                      {theme === 'system'
                        ? text(
                            locale,
                            `Seguindo o Windows: ${resolvedTheme === 'light' ? 'claro' : 'escuro'}.`,
                            `Following Windows: ${resolvedTheme}.`,
                          )
                        : text(
                            locale,
                            'Preferência aplicada e salva neste dispositivo.',
                            'Preference applied and saved on this device.',
                          )}
                    </small>
                  </span>
                  <select
                    aria-label={text(locale, 'Tema do aplicativo', 'Application theme')}
                    onChange={(event) => {
                      setTheme(event.currentTarget.value as DesktopTheme);
                    }}
                    value={theme}
                  >
                    <option value="dark">{text(locale, 'Escuro', 'Dark')}</option>
                    <option value="light">{text(locale, 'Claro', 'Light')}</option>
                    <option value="system">
                      {text(locale, 'Sistema (Windows)', 'System (Windows)')}
                    </option>
                  </select>
                </article>
              </>
            ) : null}

            {section === 'notifications' ? (
              <SettingSwitch
                active={localSettings.notifications}
                description={text(
                  locale,
                  'Mostra alertas de plano, sessão, download e atualização.',
                  'Shows plan, session, download, and update alerts.',
                )}
                label={text(locale, 'Notificações do aplicativo', 'Application notifications')}
                locale={locale}
                onToggle={() => {
                  updateLocalSetting('notifications');
                }}
              />
            ) : null}

            {section === 'privacy' ? (
              <SettingSwitch
                active={localSettings.analytics}
                description={text(
                  locale,
                  'Compartilha apenas diagnóstico autorizado e sem dados pessoais.',
                  'Shares only authorized diagnostics without personal data.',
                )}
                label={text(locale, 'Diagnóstico opcional', 'Optional diagnostics')}
                locale={locale}
                onToggle={() => {
                  updateLocalSetting('analytics');
                }}
              />
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
};
