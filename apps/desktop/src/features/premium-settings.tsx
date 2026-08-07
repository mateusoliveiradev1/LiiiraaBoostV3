import { ProductIcon } from '@liiiraa/design-system';
import type { ProductIconName } from '@liiiraa/design-system';
import type { ShellLocale } from '@liiiraa/feature-shell';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  PreConsentLocaleControl,
  useDesktopPreferences,
  type DesktopTheme,
} from '../preferences.js';
import { launchOnStartup } from '../native/launch-on-startup.js';

type SettingsSection = 'general' | 'appearance' | 'notifications' | 'privacy' | 'data';
type LocalSetting =
  | 'analytics'
  | 'autoUpdate'
  | 'crashReports'
  | 'downloadNotifications'
  | 'localHistory'
  | 'notifications'
  | 'planNotifications'
  | 'securityNotifications';
type LaunchOnStartupStatus = 'error' | 'loading' | 'ready' | 'updating';

interface LocalSettings {
  readonly analytics: boolean;
  readonly autoUpdate: boolean;
  readonly crashReports: boolean;
  readonly downloadNotifications: boolean;
  readonly localHistory: boolean;
  readonly notifications: boolean;
  readonly planNotifications: boolean;
  readonly securityNotifications: boolean;
}

const LOCAL_SETTINGS_KEY = 'liiiraa.desktop.visual-settings.v1';
const DEFAULT_LOCAL_SETTINGS: LocalSettings = Object.freeze({
  analytics: false,
  autoUpdate: true,
  crashReports: false,
  downloadNotifications: true,
  localHistory: true,
  notifications: true,
  planNotifications: true,
  securityNotifications: true,
});

interface ImportedSettingsProfile {
  readonly localSettings?: Partial<LocalSettings>;
  readonly preferences?: {
    readonly dataText?: 'increased-contrast' | 'standard';
    readonly density?: 'comfortable' | 'compact';
    readonly interfaceScale?: 100 | 125 | 150;
    readonly locale?: 'pt-BR' | 'en-US';
    readonly motion?: 'responsive' | 'reduced';
    readonly trayEnabled?: boolean;
  };
  readonly schemaVersion?: number;
  readonly theme?: DesktopTheme;
}

const text = (locale: ShellLocale, ptBr: string, english: string): string =>
  locale === 'pt-BR' ? ptBr : english;

const downloadJson = (filename: string, payload: unknown): void => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.download = filename;
  anchor.href = url;
  anchor.click();
  URL.revokeObjectURL(url);
};

const loadLocalSettings = (): LocalSettings => {
  try {
    const parsed = JSON.parse(
      globalThis.localStorage.getItem(LOCAL_SETTINGS_KEY) ?? 'null',
    ) as Partial<LocalSettings> | null;
    if (parsed === null || typeof parsed !== 'object') return DEFAULT_LOCAL_SETTINGS;
    return Object.freeze({
      analytics: parsed.analytics === true,
      autoUpdate: parsed.autoUpdate !== false,
      crashReports: parsed.crashReports === true,
      downloadNotifications: parsed.downloadNotifications !== false,
      localHistory: parsed.localHistory !== false,
      notifications: parsed.notifications !== false,
      planNotifications: parsed.planNotifications !== false,
      securityNotifications: parsed.securityNotifications !== false,
    });
  } catch {
    return DEFAULT_LOCAL_SETTINGS;
  }
};

export const areApplicationNotificationsEnabled = (): boolean => loadLocalSettings().notifications;

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
  readonly installedVersion?: string | undefined;
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
      aria-disabled={disabled || pending}
      aria-label={`${active ? text(locale, 'Desativar', 'Disable') : text(locale, 'Ativar', 'Enable')} ${label}`}
      className="premium-switch"
      disabled={disabled || pending}
      onClick={onToggle}
      role="switch"
      type="button"
    >
      <span />
    </button>
  </article>
);

export const PremiumSettingsSurface = ({
  installedVersion,
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
  const importInputRef = useRef<HTMLInputElement>(null);

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
        ['general', text(locale, 'Geral', 'General'), 'settings'],
        ['appearance', text(locale, 'Aparência', 'Appearance'), 'palette'],
        ['notifications', text(locale, 'Notificações', 'Notifications'), 'bell'],
        ['privacy', text(locale, 'Privacidade', 'Privacy'), 'shield'],
        ['data', text(locale, 'Dados e recuperação', 'Data and recovery'), 'recovery'],
      ] as const,
    [locale],
  );

  const sectionLabel = sections.find(([id]) => id === section)?.[1] ?? sections[0][1];
  const sectionDescription: Record<SettingsSection, string> = {
    appearance: text(
      locale,
      'Tema, escala, densidade e movimento aplicados imediatamente.',
      'Theme, scale, density, and motion applied immediately.',
    ),
    data: text(
      locale,
      'Portabilidade das preferências, diagnóstico local e recuperação.',
      'Preference portability, local diagnostics, and recovery.',
    ),
    general: text(
      locale,
      'Comportamento do aplicativo neste computador.',
      'Application behavior on this computer.',
    ),
    notifications: text(
      locale,
      'Escolha quais eventos merecem interromper sua atenção.',
      'Choose which events deserve your attention.',
    ),
    privacy: text(
      locale,
      'Dados locais por padrão e compartilhamento sempre opcional.',
      'Local data by default and sharing always optional.',
    ),
  };

  const updateLocalSetting = (key: LocalSetting): void => {
    setLocalSettings((current) => ({ ...current, [key]: !current[key] }));
  };

  const exportSettingsProfile = (): void => {
    downloadJson(`liiiraa-boost-perfil-${new Date().toISOString().slice(0, 10)}.json`, {
      exportedAt: new Date().toISOString(),
      localSettings,
      preferences,
      resolvedTheme,
      schemaVersion: 1,
      theme,
    });
    notify(
      text(locale, 'Perfil exportado para Downloads.', 'Profile exported to Downloads.'),
      'success',
    );
  };

  const importSettingsProfile = async (file: File): Promise<void> => {
    try {
      const imported = JSON.parse(await file.text()) as ImportedSettingsProfile;
      if (imported.schemaVersion !== 1) {
        throw new Error('unsupported profile schema');
      }

      if (imported.theme === 'dark' || imported.theme === 'light' || imported.theme === 'system') {
        setTheme(imported.theme);
      }

      const importedPreferences = imported.preferences;
      if (importedPreferences?.locale === 'pt-BR' || importedPreferences?.locale === 'en-US') {
        dispatch({ locale: importedPreferences.locale, type: 'set-locale' });
      }
      if (
        importedPreferences?.interfaceScale === 100 ||
        importedPreferences?.interfaceScale === 125 ||
        importedPreferences?.interfaceScale === 150
      ) {
        dispatch({
          scale: importedPreferences.interfaceScale,
          type: 'set-interface-scale',
        });
      }
      if (
        importedPreferences?.motion === 'responsive' ||
        importedPreferences?.motion === 'reduced'
      ) {
        dispatch({ motion: importedPreferences.motion, type: 'set-motion' });
      }
      if (
        importedPreferences?.density === 'comfortable' ||
        importedPreferences?.density === 'compact'
      ) {
        dispatch({ density: importedPreferences.density, type: 'set-density' });
      }
      if (
        importedPreferences?.dataText === 'standard' ||
        importedPreferences?.dataText === 'increased-contrast'
      ) {
        dispatch({ dataText: importedPreferences.dataText, type: 'set-data-text' });
      }
      if (typeof importedPreferences?.trayEnabled === 'boolean') {
        dispatch({ enabled: importedPreferences.trayEnabled, type: 'set-tray-enabled' });
      }

      if (imported.localSettings) {
        setLocalSettings((current) => {
          const next = { ...current };
          for (const key of Object.keys(current) as LocalSetting[]) {
            const value = imported.localSettings?.[key];
            if (typeof value === 'boolean') {
              next[key] = value;
            }
          }
          return next;
        });
      }

      notify(
        text(locale, 'Perfil validado e aplicado.', 'Profile validated and applied.'),
        'success',
      );
    } catch {
      notify(
        text(
          locale,
          'O arquivo não é um perfil válido do Liiiraa Boost.',
          'The file is not a valid Liiiraa Boost profile.',
        ),
        'warning',
      );
    } finally {
      if (importInputRef.current) {
        importInputRef.current.value = '';
      }
    }
  };

  const exportSupportReport = (): void => {
    if (installedVersion === undefined) {
      notify(
        text(
          locale,
          'O host nativo não forneceu a versão instalada. O diagnóstico não foi exportado.',
          'The native host did not provide the installed version. Diagnostics were not exported.',
        ),
        'warning',
      );
      return;
    }
    downloadJson(`liiiraa-boost-diagnostico-${new Date().toISOString().slice(0, 10)}.json`, {
      application: {
        locale: preferences.locale,
        resolvedTheme,
        themePreference: theme,
        version: installedVersion,
      },
      generatedAt: new Date().toISOString(),
      privacy: {
        accountDataIncluded: false,
        personalFilesIncluded: false,
        sensitiveValuesRedacted: true,
      },
      schemaVersion: 1,
    });
    notify(
      text(
        locale,
        'Diagnóstico sanitizado exportado para Downloads.',
        'Sanitized diagnostics exported to Downloads.',
      ),
      'success',
    );
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
        {sections.map(([id, label, icon]) => (
          <button
            aria-current={section === id ? 'page' : undefined}
            key={id}
            onClick={() => {
              openSection(id);
            }}
            type="button"
          >
            <ProductIcon name={icon} size={17} weight="duotone" />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <section>
        <header>
          <span className="premium-section-label">
            {text(locale, 'Preferências do aplicativo', 'Application preferences')}
          </span>
          <h2>{sectionLabel}</h2>
          <p>{sectionDescription[section]}</p>
        </header>

        {section === 'data' ? (
          <>
            <input
              accept="application/json,.json"
              aria-label={text(
                locale,
                'Selecionar perfil para importar',
                'Select profile to import',
              )}
              hidden
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) {
                  void importSettingsProfile(file);
                }
              }}
              ref={importInputRef}
              type="file"
            />
            <div className="premium-settings-actions">
              <button onClick={exportSettingsProfile} type="button">
                <ProductIcon name="download" size={21} weight="duotone" />
                <span>
                  <strong>{text(locale, 'Exportar perfil', 'Export profile')}</strong>
                  <small>
                    {text(
                      locale,
                      'Baixa um JSON com preferências visuais e alertas.',
                      'Downloads a JSON file with appearance and alert preferences.',
                    )}
                  </small>
                </span>
                <ProductIcon name="chevronRight" size={17} />
              </button>
              <button
                onClick={() => {
                  importInputRef.current?.click();
                }}
                type="button"
              >
                <ProductIcon name="package" size={21} weight="duotone" />
                <span>
                  <strong>{text(locale, 'Importar perfil', 'Import profile')}</strong>
                  <small>
                    {text(
                      locale,
                      'Valida o arquivo antes de aplicar cada preferência.',
                      'Validates the file before applying each preference.',
                    )}
                  </small>
                </span>
                <ProductIcon name="chevronRight" size={17} />
              </button>
              <button onClick={exportSupportReport} type="button">
                <ProductIcon name="activity" size={21} weight="duotone" />
                <span>
                  <strong>{text(locale, 'Exportar diagnóstico', 'Export diagnostics')}</strong>
                  <small>
                    {text(
                      locale,
                      'Relatório local sem conta, arquivos pessoais ou valores sensíveis.',
                      'Local report without account data, personal files, or sensitive values.',
                    )}
                  </small>
                </span>
                <ProductIcon name="chevronRight" size={17} />
              </button>
              <button
                aria-disabled="true"
                disabled
                type="button"
              >
                <ProductIcon name="radar" size={21} weight="duotone" />
                <span>
                  <strong>{text(locale, 'Reexaminar hardware', 'Rescan hardware')}</strong>
                  <small>
                    {text(
                      locale,
                      'Indisponível até a conexão do inventário nativo real.',
                      'Unavailable until the real native inventory is connected.',
                    )}
                  </small>
                </span>
                <ProductIcon name="chevronRight" size={17} />
              </button>
              <button
                onClick={() => {
                  navigate('/calibration/welcome');
                }}
                type="button"
              >
                <ProductIcon name="shield" size={21} weight="duotone" />
                <span>
                  <strong>{text(locale, 'Rever primeira abertura', 'Review first launch')}</strong>
                  <small>
                    {text(
                      locale,
                      'Reabre a explicação de segurança e verificação.',
                      'Reopens the safety and verification explanation.',
                    )}
                  </small>
                </span>
                <ProductIcon name="chevronRight" size={17} />
              </button>
            </div>
          </>
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
                  <div
                    aria-label={text(locale, 'Tema do aplicativo', 'Application theme')}
                    className="premium-theme-choice"
                    role="radiogroup"
                  >
                    {[
                      ['dark', 'moon', text(locale, 'Escuro', 'Dark')],
                      ['light', 'sun', text(locale, 'Claro', 'Light')],
                      ['system', 'device', text(locale, 'Sistema', 'System')],
                    ].map(([value, icon, label]) => (
                      <button
                        aria-checked={theme === value}
                        key={value}
                        onClick={() => {
                          setTheme(value as DesktopTheme);
                        }}
                        role="radio"
                        type="button"
                      >
                        <ProductIcon
                          name={icon as ProductIconName}
                          size={16}
                          weight={theme === value ? 'fill' : 'duotone'}
                        />
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                </article>
                <article>
                  <span>
                    <strong>{text(locale, 'Escala da interface', 'Interface scale')}</strong>
                    <small>
                      {text(
                        locale,
                        'Aumenta controles e textos sem alterar a resolução.',
                        'Enlarges controls and text without changing resolution.',
                      )}
                    </small>
                  </span>
                  <select
                    aria-label={text(locale, 'Escala da interface', 'Interface scale')}
                    onChange={(event) => {
                      const scale = Number(event.currentTarget.value) as 100 | 125 | 150;
                      dispatch({
                        scale,
                        type: 'set-interface-scale',
                      });
                      notify(
                        text(
                          locale,
                          `Escala da interface ajustada para ${String(scale)}%.`,
                          `Interface scale adjusted to ${String(scale)}%.`,
                        ),
                        'success',
                      );
                    }}
                    value={preferences.interfaceScale}
                  >
                    <option value={100}>100%</option>
                    <option value={125}>125%</option>
                    <option value={150}>150%</option>
                  </select>
                </article>
                <article>
                  <span>
                    <strong>{text(locale, 'Densidade', 'Density')}</strong>
                    <small>
                      {text(
                        locale,
                        'Controla a quantidade de informação visível.',
                        'Controls how much information is visible.',
                      )}
                    </small>
                  </span>
                  <select
                    aria-label={text(locale, 'Densidade da interface', 'Interface density')}
                    onChange={(event) => {
                      const density = event.currentTarget.value as 'comfortable' | 'compact';
                      dispatch({
                        density,
                        type: 'set-density',
                      });
                      notify(
                        density === 'compact'
                          ? text(locale, 'Densidade compacta aplicada.', 'Compact density applied.')
                          : text(
                              locale,
                              'Densidade confortável aplicada.',
                              'Comfortable density applied.',
                            ),
                        'success',
                      );
                    }}
                    value={preferences.density}
                  >
                    <option value="comfortable">
                      {text(locale, 'Confortável', 'Comfortable')}
                    </option>
                    <option value="compact">{text(locale, 'Compacta', 'Compact')}</option>
                  </select>
                </article>
                <SettingSwitch
                  active={preferences.dataText === 'increased-contrast'}
                  description={text(
                    locale,
                    'Eleva contraste de métricas, unidades e metadados técnicos.',
                    'Increases contrast for metrics, units, and technical metadata.',
                  )}
                  label={text(locale, 'Contraste de dados', 'Data contrast')}
                  locale={locale}
                  onToggle={() => {
                    const increased = preferences.dataText !== 'increased-contrast';
                    dispatch({
                      dataText: increased ? 'increased-contrast' : 'standard',
                      type: 'set-data-text',
                    });
                    notify(
                      increased
                        ? text(locale, 'Contraste de dados reforçado.', 'Data contrast increased.')
                        : text(
                            locale,
                            'Contraste de dados padrão restaurado.',
                            'Standard data contrast restored.',
                          ),
                      'success',
                    );
                  }}
                />
                <article
                  aria-label={text(locale, 'Prévia das preferências', 'Preference preview')}
                  className="premium-appearance-preview"
                >
                  <span>
                    <small>{text(locale, 'Prévia ao vivo', 'Live preview')}</small>
                    <strong>12,4 ms</strong>
                  </span>
                  <span className="premium-appearance-preview-meta">
                    <ProductIcon name="activity" size={18} weight="duotone" />
                    <small>
                      {text(
                        locale,
                        'Latência estimada · leitura técnica',
                        'Estimated latency · technical reading',
                      )}
                    </small>
                  </span>
                </article>
              </>
            ) : null}

            {section === 'notifications' ? (
              <>
                <SettingSwitch
                  active={localSettings.notifications}
                  description={text(
                    locale,
                    'Controle principal para avisos dentro do aplicativo.',
                    'Master control for in-app notifications.',
                  )}
                  label={text(locale, 'Notificações do aplicativo', 'Application notifications')}
                  locale={locale}
                  onToggle={() => {
                    updateLocalSetting('notifications');
                  }}
                />
                <SettingSwitch
                  active={localSettings.planNotifications}
                  description={text(
                    locale,
                    'Revisão de planos, aplicação concluída e restauração disponível.',
                    'Plan review, completed application, and available recovery.',
                  )}
                  disabled={!localSettings.notifications}
                  label={text(locale, 'Planos e recuperação', 'Plans and recovery')}
                  locale={locale}
                  onToggle={() => {
                    updateLocalSetting('planNotifications');
                  }}
                />
                <SettingSwitch
                  active={localSettings.downloadNotifications}
                  description={text(
                    locale,
                    'Progresso concluído, pausa, falha e pacote pronto.',
                    'Completed progress, pause, failure, and package readiness.',
                  )}
                  disabled={!localSettings.notifications}
                  label={text(locale, 'Downloads e atualizações', 'Downloads and updates')}
                  locale={locale}
                  onToggle={() => {
                    updateLocalSetting('downloadNotifications');
                  }}
                />
                <SettingSwitch
                  active={localSettings.securityNotifications}
                  description={text(
                    locale,
                    'Falhas de integridade e ações que exigem sua confirmação.',
                    'Integrity failures and actions requiring confirmation.',
                  )}
                  disabled={!localSettings.notifications}
                  label={text(locale, 'Segurança e integridade', 'Security and integrity')}
                  locale={locale}
                  onToggle={() => {
                    updateLocalSetting('securityNotifications');
                  }}
                />
              </>
            ) : null}

            {section === 'privacy' ? (
              <>
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
                <SettingSwitch
                  active={localSettings.crashReports}
                  description={text(
                    locale,
                    'Envia falhas técnicas sanitizadas somente após sua autorização.',
                    'Sends sanitized technical failures only with your permission.',
                  )}
                  label={text(locale, 'Relatórios de falha', 'Crash reports')}
                  locale={locale}
                  onToggle={() => {
                    updateLocalSetting('crashReports');
                  }}
                />
                <SettingSwitch
                  active={localSettings.localHistory}
                  description={text(
                    locale,
                    'Mantém neste computador o histórico necessário para desfazer mudanças.',
                    'Keeps the history needed to undo changes on this computer.',
                  )}
                  label={text(locale, 'Histórico local de recuperação', 'Local recovery history')}
                  locale={locale}
                  onToggle={() => {
                    updateLocalSetting('localHistory');
                  }}
                />
                <article className="premium-settings-privacy-note">
                  <ProductIcon name="lock" size={19} weight="duotone" />
                  <span>
                    <strong>{text(locale, 'Local por padrão', 'Local by default')}</strong>
                    <small>
                      {text(
                        locale,
                        'Nenhuma preferência acima inclui documentos, jogos salvos ou credenciais.',
                        'None of these preferences include documents, game saves, or credentials.',
                      )}
                    </small>
                  </span>
                </article>
              </>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
};
