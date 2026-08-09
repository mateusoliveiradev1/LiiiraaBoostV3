import { LbButton, LbSwitch, LbTextField, ProductIcon, RouteHeader } from '@liiiraa/design-system';
import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import type { ShellLocale } from '@liiiraa/feature-shell';
import {
  createDesktopAccountAuthority,
  resolveDesktopAdminHandoff,
  type DesktopAccountAuthority,
  type DesktopAccountAuthoritySnapshot,
  type DesktopAdminHandoffProjection,
} from '../account-authority.js';
import { createDesktopAuth, type DesktopAuth, type DesktopAuthPhase } from '../desktop-auth.js';
import {
  ACCOUNT_PROFILE_UPDATED_EVENT,
  DEFAULT_ACCOUNT_PROFILE,
  LOCAL_ACCOUNT_ID,
  PROFILE_AVATAR_ACCENTS,
  accountProfileInitials,
  clearAccountProfile,
  createAccountProfileExport,
  persistAccountProfile,
  readAccountProfile,
  validateAccountProfile,
  type LocalAccountProfile,
  type ProfileAvatarAccent,
} from './account-profile.js';

export type AccountExperienceView = 'login' | 'overview' | 'subscription' | 'device' | 'security';

export interface AccountExperienceProps {
  readonly locale: ShellLocale;
  readonly navigate: (pathname: string) => void;
  readonly scenarioId: string;
  readonly view: AccountExperienceView;
}

export type DesktopLoginState = 'authenticated' | 'restoring' | 'sign-in' | 'unavailable';

export const resolveDesktopLoginState = (
  snapshot: DesktopAccountAuthoritySnapshot | undefined,
): DesktopLoginState => {
  if (snapshot === undefined || snapshot.state === 'revoked') return 'sign-in';
  if (
    snapshot.projection !== undefined &&
    (snapshot.state === 'online' || snapshot.state === 'stale' || snapshot.state === 'conflict')
  ) {
    return 'authenticated';
  }
  if (snapshot.state === 'pending') return 'restoring';
  return 'unavailable';
};

const copy = (locale: ShellLocale, value: Readonly<{ en: string; 'pt-BR': string }>): string =>
  value[locale];

const DEFAULT_PROFILE_BIO_EN =
  'Competitive player focused on consistency, low latency and reversible decisions.';

const profileBioForLocale = (locale: ShellLocale, bio: string): string => {
  const isDefaultBio = bio === DEFAULT_ACCOUNT_PROFILE.bio || bio === DEFAULT_PROFILE_BIO_EN;

  return isDefaultBio
    ? copy(locale, {
        en: DEFAULT_PROFILE_BIO_EN,
        'pt-BR': DEFAULT_ACCOUNT_PROFILE.bio,
      })
    : bio;
};

const BrandLockup = () => (
  <div className="desktop-auth-brand" aria-label="Liiiraa Boost">
    <svg aria-hidden="true" viewBox="0 0 36 28">
      <path d="M2 25.5 10.6 2h7.2l-5.7 15.2h9.2l-7.1 8.3H2Z" />
      <path d="m20.7 7.2 10.3 7-10.3 7 3-3.7 4.8-3.3-4.8-3.3-3-3.7Z" />
    </svg>
    <span>
      Liiiraa <strong>Boost</strong>
    </span>
  </div>
);

const LoginSurface = ({
  desktopAuth,
  locale,
  navigate,
}: Pick<AccountExperienceProps, 'locale' | 'navigate'> & {
  readonly desktopAuth: DesktopAuth | undefined;
}) => {
  const [email, setEmail] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [phase, setPhase] = useState<DesktopAuthPhase>('idle');
  const validEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(email);

  const continueToBrowserBoundary = async (): Promise<void> => {
    setAttempted(true);
    if (!validEmail) return;
    if (desktopAuth === undefined) {
      setPhase('error');
      return;
    }
    setPhase('opening-browser');
    await Promise.resolve();
    setPhase('waiting-browser');
    const result = await desktopAuth.signIn(email.trim().toLowerCase());
    if (result.status !== 'authenticated') {
      setPhase('error');
      return;
    }
    setPhase('authenticated');
    navigate('/account/overview');
  };

  return (
    <main
      className="desktop-auth-surface"
      data-account-view="login"
      data-auth-mode="system-browser"
    >
      <section className="desktop-auth-story" aria-labelledby="desktop-login-story-title">
        <BrandLockup />
        <div className="desktop-auth-story-copy">
          <span className="desktop-preview-badge">
            <ProductIcon name="shield" size={14} />
            {copy(locale, { en: 'Private beta access', 'pt-BR': 'Acesso ao beta privado' })}
          </span>
          <h1 id="desktop-login-story-title">
            {copy(locale, {
              en: 'Your PC, tuned with proof.',
              'pt-BR': 'Seu PC, otimizado com provas.',
            })}
          </h1>
          <p>
            {copy(locale, {
              en: 'Diagnose, review and recover every performance decision from one precise command environment.',
              'pt-BR':
                'Diagnostique, revise e recupere cada decisão de desempenho em um ambiente de comando preciso.',
            })}
          </p>
        </div>
        <ul className="desktop-auth-promises">
          <li>
            <ProductIcon name="check" size={18} />
            <span>
              <strong>
                {copy(locale, { en: 'Explainable plans', 'pt-BR': 'Planos explicáveis' })}
              </strong>
              {copy(locale, {
                en: 'Compatibility, risk and impact before any change.',
                'pt-BR': 'Compatibilidade, risco e impacto antes de qualquer alteração.',
              })}
            </span>
          </li>
          <li>
            <ProductIcon name="recovery" size={18} />
            <span>
              <strong>
                {copy(locale, { en: 'Recovery by design', 'pt-BR': 'Recuperação desde o início' })}
              </strong>
              {copy(locale, {
                en: 'History and restoration stay available even without Premium.',
                'pt-BR': 'Histórico e restauração continuam disponíveis mesmo sem Premium.',
              })}
            </span>
          </li>
          <li>
            <ProductIcon name="monitor" size={18} />
            <span>
              <strong>
                {copy(locale, { en: 'Local-first control', 'pt-BR': 'Controle local primeiro' })}
              </strong>
              {copy(locale, {
                en: 'Your password stays in the protected browser session.',
                'pt-BR': 'Sua senha permanece na sessão protegida do navegador.',
              })}
            </span>
          </li>
        </ul>
        <p className="desktop-auth-footnote">WINDOWS 10/11 · BETA PRIVADO</p>
      </section>

      <section className="desktop-login-panel" aria-labelledby="desktop-login-title">
        <header>
          <span className="desktop-login-kicker">
            {copy(locale, { en: 'Welcome back', 'pt-BR': 'Bem-vindo de volta' })}
          </span>
          <h2 id="desktop-login-title">
            {copy(locale, {
              en: 'Access your command deck',
              'pt-BR': 'Acesse sua central de comando',
            })}
          </h2>
          <p>
            {copy(locale, {
              en: 'Your plan, devices and recovery history will live here.',
              'pt-BR': 'Seu plano, dispositivos e histórico de recuperação ficarão aqui.',
            })}
          </p>
        </header>

        <div className="desktop-login-form">
          <LbTextField
            errorMessage={
              attempted && !validEmail
                ? copy(locale, {
                    en: 'Enter a valid email address.',
                    'pt-BR': 'Informe um endereço de e-mail válido.',
                  })
                : undefined
            }
            label={copy(locale, { en: 'Account email', 'pt-BR': 'E-mail da conta' })}
            onChange={setEmail}
            value={email}
          />
          <LbButton
            isDisabled={phase === 'opening-browser' || phase === 'waiting-browser'}
            isLoading={phase === 'opening-browser' || phase === 'waiting-browser'}
            loadingLabel={copy(locale, {
              en: 'Finish sign-in in your browser',
              'pt-BR': 'Conclua o login no navegador',
            })}
            onPress={() => {
              void continueToBrowserBoundary();
            }}
            variant="primary"
          >
            <ProductIcon name="arrowRight" size={17} />
            {copy(locale, {
              en: 'Continue securely',
              'pt-BR': 'Continuar com segurança',
            })}
          </LbButton>
        </div>

        {phase === 'opening-browser' || phase === 'waiting-browser' ? (
          <aside className="desktop-auth-boundary" aria-live="polite" role="status">
            <ProductIcon name="shield" size={20} />
            <div>
              <strong>
                {copy(locale, {
                  en: 'Secure browser sign-in is in progress',
                  'pt-BR': 'O login seguro pelo navegador está em andamento',
                })}
              </strong>
              <p>
                {copy(locale, {
                  en: 'Complete the account confirmation in your system browser. This app never receives or stores your password.',
                  'pt-BR':
                    'Conclua a confirmação da conta no navegador do sistema. Este aplicativo nunca recebe nem armazena sua senha.',
                })}
              </p>
            </div>
          </aside>
        ) : null}

        {phase === 'error' ? (
          <p role="alert">
            {copy(locale, {
              en: 'Sign-in could not complete. Confirm the browser window and try again.',
              'pt-BR':
                'Não foi possível concluir o login. Confirme a janela do navegador e tente novamente.',
            })}
          </p>
        ) : null}

        <p className="desktop-login-legal">
          {copy(locale, {
            en: 'By continuing, you acknowledge the Terms of Use and Privacy Policy presented by the installer.',
            'pt-BR':
              'Ao continuar, você reconhece os Termos de Uso e a Política de Privacidade apresentados pelo instalador.',
          })}
        </p>
      </section>
    </main>
  );
};

const SessionRestorationSurface = ({
  locale,
  onRetry,
  state,
}: Readonly<{
  locale: ShellLocale;
  onRetry: () => void;
  state: 'restoring' | 'unavailable';
}>) => (
  <main
    className="desktop-auth-surface"
    data-account-view="login"
    data-auth-mode="native-session-restoration"
    data-session-restoration={state}
  >
    <section className="desktop-auth-story" aria-labelledby="desktop-restoration-story-title">
      <BrandLockup />
      <div className="desktop-auth-story-copy">
        <span className="desktop-preview-badge">
          <ProductIcon name="shield" size={14} />
          {copy(locale, { en: 'Protected local session', 'pt-BR': 'Sessão local protegida' })}
        </span>
        <h1 id="desktop-restoration-story-title">
          {copy(locale, {
            en: 'Your account stays with you.',
            'pt-BR': 'Sua conta continua com você.',
          })}
        </h1>
        <p>
          {copy(locale, {
            en: 'Liiiraa Boost is recovering the credential protected by Windows Credential Manager. Your password is never stored in the app.',
            'pt-BR':
              'O Liiiraa Boost está recuperando a credencial protegida pelo Gerenciador de Credenciais do Windows. Sua senha nunca é armazenada no app.',
          })}
        </p>
      </div>
      <p className="desktop-auth-footnote">WINDOWS 10/11 · BETA PRIVADO</p>
    </section>

    <section className="desktop-login-panel" aria-labelledby="desktop-restoration-title">
      <header>
        <span className="desktop-login-kicker">
          {state === 'restoring'
            ? copy(locale, { en: 'Restoring session', 'pt-BR': 'Restaurando sessão' })
            : copy(locale, { en: 'Connection unavailable', 'pt-BR': 'Conexão indisponível' })}
        </span>
        <h2 id="desktop-restoration-title">
          {state === 'restoring'
            ? copy(locale, { en: 'Opening your command deck', 'pt-BR': 'Abrindo sua central' })
            : copy(locale, {
                en: 'Your saved session is still protected',
                'pt-BR': 'Sua sessão salva continua protegida',
              })}
        </h2>
        <p aria-live="polite" role="status">
          {state === 'restoring'
            ? copy(locale, {
                en: 'Confirming your account and plan. This should only take a moment.',
                'pt-BR': 'Confirmando sua conta e seu plano. Isso deve levar apenas um instante.',
              })
            : copy(locale, {
                en: 'We could not contact the account service. You do not need to sign in again.',
                'pt-BR':
                  'Não foi possível acessar o serviço da conta. Você não precisa fazer login novamente.',
              })}
        </p>
      </header>
      {state === 'restoring' ? (
        <div aria-hidden="true" className="desktop-session-restoration-progress">
          <span />
        </div>
      ) : (
        <LbButton onPress={onRetry} variant="primary">
          <ProductIcon name="recovery" size={17} />
          {copy(locale, { en: 'Try restoring again', 'pt-BR': 'Tentar restaurar novamente' })}
        </LbButton>
      )}
    </section>
  </main>
);

const AccountTabs = ({
  locale,
  navigate,
  view,
}: Pick<AccountExperienceProps, 'locale' | 'navigate' | 'view'>) => {
  const items = [
    {
      icon: 'profile',
      label: { en: 'Profile', 'pt-BR': 'Perfil' },
      path: '/account/overview',
      view: 'overview',
    },
    {
      icon: 'crown',
      label: { en: 'Plan', 'pt-BR': 'Plano' },
      path: '/account/subscription',
      view: 'subscription',
    },
    {
      icon: 'device',
      label: { en: 'Device', 'pt-BR': 'Dispositivo' },
      path: '/account/device',
      view: 'device',
    },
    {
      icon: 'lock',
      label: { en: 'Security', 'pt-BR': 'Segurança' },
      path: '/account/security',
      view: 'security',
    },
  ] as const;

  return (
    <nav
      className="desktop-account-tabs"
      aria-label={copy(locale, { en: 'Account sections', 'pt-BR': 'Seções da conta' })}
    >
      {items.map((item) => (
        <LbButton
          key={item.view}
          onPress={() => {
            navigate(item.path);
          }}
          variant={view === item.view ? 'primary' : 'quiet'}
        >
          <ProductIcon name={item.icon} size={17} />
          {copy(locale, item.label)}
        </LbButton>
      ))}
    </nav>
  );
};

const AccountShell = ({
  children,
  locale,
  navigate,
  view,
}: Pick<AccountExperienceProps, 'locale' | 'navigate' | 'view'> & {
  readonly children: ReactNode;
}) => (
  <main className="desktop-account-surface" data-account-view={view}>
    <RouteHeader
      purpose={copy(locale, {
        en: 'Manage identity, access and the device connected to your performance workspace.',
        'pt-BR':
          'Gerencie identidade, acesso e o dispositivo conectado ao seu ambiente de desempenho.',
      })}
      title={copy(locale, { en: 'Account', 'pt-BR': 'Sua conta' })}
    />
    <AccountTabs locale={locale} navigate={navigate} view={view} />
    {children}
  </main>
);

type ProfileNotice = Readonly<{
  message: string;
  tone: 'error' | 'success';
}>;

const PROFILE_EMAIL = 'player@liiiraaboost.local';

const ProfileAvatar = ({
  editable = false,
  profile,
}: {
  readonly editable?: boolean;
  readonly profile: LocalAccountProfile;
}) => (
  <div
    className="desktop-profile-avatar"
    data-accent={profile.avatarAccent}
    data-custom-image={String(profile.avatarImage !== null)}
  >
    {profile.avatarImage ? (
      <img alt={editable ? '' : `Avatar de ${profile.displayName}`} src={profile.avatarImage} />
    ) : (
      <span aria-hidden={editable}>{accountProfileInitials(profile.displayName)}</span>
    )}
  </div>
);

const ProfileNoticeBanner = ({
  locale,
  notice,
  onClose,
}: {
  readonly locale: ShellLocale;
  readonly notice: ProfileNotice;
  readonly onClose: () => void;
}) => (
  <aside
    aria-live={notice.tone === 'error' ? 'assertive' : 'polite'}
    className="desktop-profile-notice"
    data-tone={notice.tone}
  >
    <ProductIcon name={notice.tone === 'error' ? 'warning' : 'check'} size={18} />
    <span>{notice.message}</span>
    <button
      aria-label={copy(locale, { en: 'Close message', 'pt-BR': 'Fechar mensagem' })}
      onClick={onClose}
      type="button"
    >
      <ProductIcon name="close" size={16} />
    </button>
  </aside>
);

const ProfileDestination = ({
  action,
  description,
  icon,
  label,
  onPress,
}: {
  readonly action: string;
  readonly description: string;
  readonly icon: 'crown' | 'device' | 'lock';
  readonly label: string;
  readonly onPress: () => void;
}) => (
  <article className="desktop-profile-destination">
    <span className="desktop-profile-destination-icon">
      <ProductIcon name={icon} size={20} />
    </span>
    <div>
      <small>{label}</small>
      <strong>{description}</strong>
    </div>
    <LbButton onPress={onPress} variant="quiet">
      {action}
      <ProductIcon name="chevronRight" size={15} />
    </LbButton>
  </article>
);

const ProfileOverview = ({
  locale,
  navigate,
}: Pick<AccountExperienceProps, 'locale' | 'navigate'>) => {
  const initialProfile = (): LocalAccountProfile => {
    try {
      return readAccountProfile(globalThis.localStorage);
    } catch {
      return DEFAULT_ACCOUNT_PROFILE;
    }
  };

  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState<LocalAccountProfile>(initialProfile);
  const [draft, setDraft] = useState<LocalAccountProfile>(profile);
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<ProfileNotice | null>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const saveTimerRef = useRef<number | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const validation = validateAccountProfile(draft);
  const dirty = JSON.stringify(draft) !== JSON.stringify(profile);

  useEffect(
    () => () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (notice === null) {
      return undefined;
    }

    const timer = globalThis.setTimeout(() => {
      setNotice(null);
    }, 4200);
    return () => {
      globalThis.clearTimeout(timer);
    };
  }, [notice]);

  const announceProfileUpdate = (): void => {
    globalThis.dispatchEvent(new CustomEvent(ACCOUNT_PROFILE_UPDATED_EVENT));
  };

  const beginEditing = (): void => {
    setDraft({
      ...profile,
      bio: profileBioForLocale(locale, profile.bio),
    });
    setAttempted(false);
    setEditing(true);
    setResetConfirmOpen(false);
  };

  const cancelEditing = (): void => {
    setDraft(profile);
    setAttempted(false);
    setEditing(false);
  };

  const saveProfile = (): void => {
    setAttempted(true);
    if (Object.keys(validation).length > 0 || !dirty) {
      if (Object.keys(validation).length > 0) {
        setNotice({
          message: copy(locale, {
            en: 'Review the highlighted fields before saving.',
            'pt-BR': 'Revise os campos destacados antes de salvar.',
          }),
          tone: 'error',
        });
      }
      return;
    }

    setSaving(true);
    saveTimerRef.current = window.setTimeout(() => {
      const nextProfile: LocalAccountProfile = {
        ...draft,
        bio: draft.bio.trim(),
        displayName: draft.displayName.trim(),
        playerTag: draft.playerTag.trim().toLocaleLowerCase('pt-BR'),
        updatedAt: new Date().toISOString(),
      };
      const persisted = persistAccountProfile(globalThis.localStorage, nextProfile);
      setSaving(false);

      if (!persisted) {
        setNotice({
          message: copy(locale, {
            en: 'The local profile could not be saved. Check app storage access.',
            'pt-BR':
              'Não foi possível salvar o perfil local. Verifique o acesso ao armazenamento do app.',
          }),
          tone: 'error',
        });
        return;
      }

      setProfile(nextProfile);
      setDraft(nextProfile);
      setEditing(false);
      setAttempted(false);
      announceProfileUpdate();
      setNotice({
        message: copy(locale, {
          en: 'Profile saved on this device.',
          'pt-BR': 'Perfil salvo neste dispositivo.',
        }),
        tone: 'success',
      });
    }, 520);
  };

  const updatePreference = (
    preference: keyof LocalAccountProfile['preferences'],
    selected: boolean,
  ): void => {
    const nextProfile: LocalAccountProfile = {
      ...profile,
      preferences: {
        ...profile.preferences,
        [preference]: selected,
      },
      updatedAt: new Date().toISOString(),
    };

    if (!persistAccountProfile(globalThis.localStorage, nextProfile)) {
      setNotice({
        message: copy(locale, {
          en: 'This preference could not be saved locally.',
          'pt-BR': 'Não foi possível salvar esta preferência localmente.',
        }),
        tone: 'error',
      });
      return;
    }

    setProfile(nextProfile);
    setDraft(nextProfile);
    announceProfileUpdate();
  };

  const selectAvatarAccent = (accent: ProfileAvatarAccent): void => {
    setDraft((current) => ({
      ...current,
      avatarAccent: accent,
      avatarImage: null,
    }));
  };

  const loadAvatarImage = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) {
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 1_000_000) {
      setNotice({
        message: copy(locale, {
          en: 'Choose a PNG, JPG or WebP image up to 1 MB.',
          'pt-BR': 'Escolha uma imagem PNG, JPG ou WebP de até 1 MB.',
        }),
        tone: 'error',
      });
      return;
    }

    const reader = new FileReader();
    reader.addEventListener('load', () => {
      if (typeof reader.result !== 'string') {
        return;
      }
      setDraft((current) => ({
        ...current,
        avatarImage: reader.result as string,
      }));
    });
    reader.addEventListener('error', () => {
      setNotice({
        message: copy(locale, {
          en: 'The selected image could not be read.',
          'pt-BR': 'Não foi possível ler a imagem selecionada.',
        }),
        tone: 'error',
      });
    });
    reader.readAsDataURL(file);
  };

  const copyAccountId = async (): Promise<void> => {
    try {
      await globalThis.navigator.clipboard.writeText(LOCAL_ACCOUNT_ID);
      setNotice({
        message: copy(locale, {
          en: 'Account identifier copied.',
          'pt-BR': 'Identificador da conta copiado.',
        }),
        tone: 'success',
      });
    } catch {
      setNotice({
        message: copy(locale, {
          en: `Account identifier: ${LOCAL_ACCOUNT_ID}`,
          'pt-BR': `Identificador da conta: ${LOCAL_ACCOUNT_ID}`,
        }),
        tone: 'error',
      });
    }
  };

  const exportProfile = (): void => {
    const payload = createAccountProfileExport(profile, new Date().toISOString());
    const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.download = `liiiraa-boost-perfil-${profile.playerTag}.json`;
    anchor.href = url;
    anchor.click();
    globalThis.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 0);
    setNotice({
      message: copy(locale, {
        en: 'Local profile package exported.',
        'pt-BR': 'Pacote do perfil local exportado.',
      }),
      tone: 'success',
    });
  };

  const clearLocalPreview = (): void => {
    if (!clearAccountProfile(globalThis.localStorage)) {
      setNotice({
        message: copy(locale, {
          en: 'The local preview could not be cleared.',
          'pt-BR': 'Não foi possível limpar a prévia local.',
        }),
        tone: 'error',
      });
      return;
    }

    setProfile(DEFAULT_ACCOUNT_PROFILE);
    setDraft(DEFAULT_ACCOUNT_PROFILE);
    setEditing(false);
    setAttempted(false);
    setResetConfirmOpen(false);
    announceProfileUpdate();
    setNotice({
      message: copy(locale, {
        en: 'Local profile restored to its default state.',
        'pt-BR': 'Perfil local restaurado ao estado padrão.',
      }),
      tone: 'success',
    });
  };
  const updatedLabel = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(profile.updatedAt));

  return (
    <div className="desktop-account-layout">
      {notice ? (
        <ProfileNoticeBanner
          locale={locale}
          notice={notice}
          onClose={() => {
            setNotice(null);
          }}
        />
      ) : null}

      <section className="desktop-profile-hero">
        <div className="desktop-profile-avatar-wrap">
          <ProfileAvatar profile={profile} />
          <span
            aria-label={copy(locale, {
              en: profile.preferences.showPlayerTag ? 'Profile visible' : 'Profile private',
              'pt-BR': profile.preferences.showPlayerTag ? 'Perfil visível' : 'Perfil privado',
            })}
            className="desktop-profile-presence"
            data-visible={String(profile.preferences.showPlayerTag)}
          />
        </div>
        <div className="desktop-profile-identity">
          <span className="desktop-profile-status">
            <ProductIcon name="check" size={14} />
            {copy(locale, { en: 'Local profile active', 'pt-BR': 'Perfil local ativo' })}
          </span>
          <h2>{profile.displayName}</h2>
          <p>
            {profile.preferences.showPlayerTag ? `@${profile.playerTag} · ` : ''}
            {PROFILE_EMAIL}
          </p>
          <div
            className="desktop-profile-chips"
            aria-label={copy(locale, {
              en: 'Profile status',
              'pt-BR': 'Status do perfil',
            })}
          >
            <span>
              <ProductIcon name="crown" size={13} />
              Premium
            </span>
            <span>
              <ProductIcon name="device" size={13} />
              DESKTOP-LR07
            </span>
            <span>
              <ProductIcon name="shield" size={13} />
              {copy(locale, { en: 'Protected locally', 'pt-BR': 'Protegido localmente' })}
            </span>
          </div>
        </div>
        <div className="desktop-profile-hero-actions">
          <LbButton onPress={editing ? cancelEditing : beginEditing} variant="secondary">
            <ProductIcon name={editing ? 'close' : 'profile'} size={17} />
            {editing
              ? copy(locale, { en: 'Close editor', 'pt-BR': 'Fechar editor' })
              : copy(locale, { en: 'Edit profile', 'pt-BR': 'Editar perfil' })}
          </LbButton>
          <LbButton onPress={exportProfile} variant="quiet">
            <ProductIcon name="download" size={17} />
            {copy(locale, { en: 'Export', 'pt-BR': 'Exportar' })}
          </LbButton>
        </div>
      </section>

      {editing ? (
        <section className="desktop-profile-editor" aria-labelledby="desktop-profile-edit-title">
          <header>
            <div>
              <span className="desktop-profile-section-icon">
                <ProductIcon name="profile" size={19} />
              </span>
              <div>
                <h3 id="desktop-profile-edit-title">
                  {copy(locale, { en: 'Profile details', 'pt-BR': 'Dados do perfil' })}
                </h3>
                <p>
                  {copy(locale, {
                    en: 'Changes are stored only on this Windows device.',
                    'pt-BR': 'As alterações ficam armazenadas somente neste dispositivo Windows.',
                  })}
                </p>
              </div>
            </div>
            {dirty ? (
              <span className="desktop-profile-unsaved">
                <ProductIcon name="history" size={14} />
                {copy(locale, { en: 'Unsaved changes', 'pt-BR': 'Alterações não salvas' })}
              </span>
            ) : null}
          </header>

          <div className="desktop-profile-editor-body">
            <aside className="desktop-profile-avatar-editor">
              <ProfileAvatar editable profile={draft} />
              <div>
                <strong>
                  {copy(locale, { en: 'Profile image', 'pt-BR': 'Imagem do perfil' })}
                </strong>
                <small>
                  {copy(locale, {
                    en: 'PNG, JPG or WebP up to 1 MB.',
                    'pt-BR': 'PNG, JPG ou WebP de até 1 MB.',
                  })}
                </small>
              </div>
              <input
                accept="image/jpeg,image/png,image/webp"
                aria-label={copy(locale, {
                  en: 'Choose profile image',
                  'pt-BR': 'Escolher imagem do perfil',
                })}
                className="lb-visually-hidden"
                onChange={loadAvatarImage}
                ref={photoInputRef}
                type="file"
              />
              <div className="desktop-profile-avatar-actions">
                <LbButton
                  onPress={() => {
                    photoInputRef.current?.click();
                  }}
                  variant="secondary"
                >
                  {copy(locale, { en: 'Choose image', 'pt-BR': 'Escolher imagem' })}
                </LbButton>
                {draft.avatarImage ? (
                  <LbButton
                    onPress={() => {
                      setDraft((current) => ({ ...current, avatarImage: null }));
                    }}
                    variant="quiet"
                  >
                    {copy(locale, { en: 'Remove', 'pt-BR': 'Remover' })}
                  </LbButton>
                ) : null}
              </div>
              <div
                aria-label={copy(locale, { en: 'Avatar color', 'pt-BR': 'Cor do avatar' })}
                className="desktop-profile-avatar-presets"
                role="group"
              >
                {PROFILE_AVATAR_ACCENTS.map((accent) => (
                  <button
                    aria-label={copy(locale, {
                      en: `Use ${accent} avatar`,
                      'pt-BR': `Usar avatar ${accent}`,
                    })}
                    aria-pressed={draft.avatarAccent === accent && draft.avatarImage === null}
                    data-accent={accent}
                    key={accent}
                    onClick={() => {
                      selectAvatarAccent(accent);
                    }}
                    type="button"
                  >
                    <span />
                  </button>
                ))}
              </div>
            </aside>

            <div className="desktop-profile-fields">
              <LbTextField
                errorMessage={
                  attempted && validation.displayName
                    ? copy(locale, {
                        en: 'Use between 2 and 40 characters.',
                        'pt-BR': 'Use entre 2 e 40 caracteres.',
                      })
                    : undefined
                }
                isInvalid={attempted && Boolean(validation.displayName)}
                label={copy(locale, { en: 'Display name', 'pt-BR': 'Nome de exibição' })}
                maxLength={40}
                onChange={(value) => {
                  setDraft((current) => ({ ...current, displayName: value }));
                }}
                value={draft.displayName}
              />
              <LbTextField
                description={copy(locale, {
                  en: 'Letters, numbers, dot, dash or underscore.',
                  'pt-BR': 'Letras, números, ponto, hífen ou sublinhado.',
                })}
                errorMessage={
                  attempted && validation.playerTag
                    ? copy(locale, {
                        en: 'Use a valid identifier between 3 and 20 characters.',
                        'pt-BR': 'Use um identificador válido de 3 a 20 caracteres.',
                      })
                    : undefined
                }
                isInvalid={attempted && Boolean(validation.playerTag)}
                label={copy(locale, {
                  en: 'Player identifier',
                  'pt-BR': 'Identificador do jogador',
                })}
                maxLength={20}
                onChange={(value) => {
                  setDraft((current) => ({ ...current, playerTag: value }));
                }}
                value={draft.playerTag}
              />
              <label className="desktop-profile-bio-field">
                <span>{copy(locale, { en: 'Short bio', 'pt-BR': 'Apresentação curta' })}</span>
                <textarea
                  aria-invalid={attempted && validation.bio ? 'true' : 'false'}
                  maxLength={120}
                  onChange={(event) => {
                    const bio = event.currentTarget.value;
                    setDraft((current) => ({ ...current, bio }));
                  }}
                  rows={3}
                  value={draft.bio}
                />
                <small>
                  {attempted && validation.bio
                    ? copy(locale, {
                        en: 'Use up to 120 characters.',
                        'pt-BR': 'Use no máximo 120 caracteres.',
                      })
                    : copy(locale, {
                        en: `${String(draft.bio.length)} of 120 characters`,
                        'pt-BR': `${String(draft.bio.length)} de 120 caracteres`,
                      })}
                </small>
              </label>
            </div>
          </div>

          <footer>
            <span>
              <ProductIcon name="shield" size={15} />
              {copy(locale, {
                en: 'No cloud synchronization in this preview',
                'pt-BR': 'Sem sincronização em nuvem nesta prévia',
              })}
            </span>
            <div className="desktop-inline-actions">
              <LbButton onPress={cancelEditing} variant="quiet">
                {copy(locale, { en: 'Cancel', 'pt-BR': 'Cancelar' })}
              </LbButton>
              <LbButton
                isDisabled={!dirty || saving}
                isLoading={saving}
                loadingLabel={copy(locale, { en: 'Saving profile', 'pt-BR': 'Salvando perfil' })}
                onPress={saveProfile}
                variant="primary"
              >
                <ProductIcon name="check" size={16} />
                {copy(locale, { en: 'Save changes', 'pt-BR': 'Salvar alterações' })}
              </LbButton>
            </div>
          </footer>
        </section>
      ) : null}

      <section className="desktop-profile-overview-grid">
        <article className="desktop-profile-about">
          <header>
            <span className="desktop-profile-section-icon">
              <ProductIcon name="profile" size={19} />
            </span>
            <div>
              <h3>{copy(locale, { en: 'About your profile', 'pt-BR': 'Sobre seu perfil' })}</h3>
              <p>
                {copy(locale, {
                  en: 'Identity shown across this local app.',
                  'pt-BR': 'Identidade exibida neste aplicativo local.',
                })}
              </p>
            </div>
          </header>
          <p className="desktop-profile-bio">
            {profileBioForLocale(locale, profile.bio) ||
              copy(locale, {
                en: 'Add a short bio to complete your profile.',
                'pt-BR': 'Adicione uma apresentação curta para completar seu perfil.',
              })}
          </p>
          <dl className="desktop-profile-facts">
            <div>
              <dt>{copy(locale, { en: 'Account email', 'pt-BR': 'E-mail da conta' })}</dt>
              <dd>{PROFILE_EMAIL}</dd>
            </div>
            <div>
              <dt>{copy(locale, { en: 'Local account ID', 'pt-BR': 'ID local da conta' })}</dt>
              <dd>
                <code>{LOCAL_ACCOUNT_ID}</code>
                <LbButton
                  onPress={() => {
                    void copyAccountId();
                  }}
                  variant="quiet"
                >
                  {copy(locale, { en: 'Copy', 'pt-BR': 'Copiar' })}
                </LbButton>
              </dd>
            </div>
            <div>
              <dt>{copy(locale, { en: 'Last saved', 'pt-BR': 'Último salvamento' })}</dt>
              <dd>{updatedLabel}</dd>
            </div>
          </dl>
        </article>

        <aside className="desktop-profile-preferences">
          <header>
            <span className="desktop-profile-section-icon">
              <ProductIcon name="sliders" size={19} />
            </span>
            <div>
              <h3>
                {copy(locale, { en: 'Profile preferences', 'pt-BR': 'Preferências do perfil' })}
              </h3>
              <p>
                {copy(locale, {
                  en: 'Changes are saved immediately.',
                  'pt-BR': 'As mudanças são salvas imediatamente.',
                })}
              </p>
            </div>
          </header>
          <div className="desktop-profile-preference-list">
            <LbSwitch
              isSelected={profile.preferences.showPlayerTag}
              onChange={(selected) => {
                updatePreference('showPlayerTag', selected);
              }}
            >
              <span>
                <strong>
                  {copy(locale, {
                    en: 'Show player identifier',
                    'pt-BR': 'Mostrar identificador do jogador',
                  })}
                </strong>
                <small>
                  {copy(locale, {
                    en: 'Displays your tag beside the account email.',
                    'pt-BR': 'Exibe sua tag ao lado do e-mail da conta.',
                  })}
                </small>
              </span>
            </LbSwitch>
            <LbSwitch
              isSelected={profile.preferences.showRecentActivity}
              onChange={(selected) => {
                updatePreference('showRecentActivity', selected);
              }}
            >
              <span>
                <strong>
                  {copy(locale, {
                    en: 'Show recent local activity',
                    'pt-BR': 'Mostrar atividade local recente',
                  })}
                </strong>
                <small>
                  {copy(locale, {
                    en: 'Keeps the activity summary visible on this page.',
                    'pt-BR': 'Mantém o resumo de atividades visível nesta página.',
                  })}
                </small>
              </span>
            </LbSwitch>
          </div>
        </aside>
      </section>

      {profile.preferences.showRecentActivity ? (
        <section
          className="desktop-profile-activity"
          aria-labelledby="desktop-profile-activity-title"
        >
          <header>
            <div>
              <span className="desktop-profile-section-icon">
                <ProductIcon name="history" size={19} />
              </span>
              <div>
                <h3 id="desktop-profile-activity-title">
                  {copy(locale, {
                    en: 'Recent local activity',
                    'pt-BR': 'Atividade local recente',
                  })}
                </h3>
                <p>
                  {copy(locale, {
                    en: 'Events generated only by this demonstration device.',
                    'pt-BR': 'Eventos gerados somente por este dispositivo demonstrativo.',
                  })}
                </p>
              </div>
            </div>
            <LbButton
              onPress={() => {
                navigate('/activity');
              }}
              variant="quiet"
            >
              {copy(locale, { en: 'View activity', 'pt-BR': 'Ver atividade' })}
              <ProductIcon name="chevronRight" size={15} />
            </LbButton>
          </header>
          <ul>
            <li>
              <ProductIcon name="check" size={16} />
              <span>
                <strong>
                  {copy(locale, {
                    en: 'Readiness analysis completed',
                    'pt-BR': 'Análise de prontidão concluída',
                  })}
                </strong>
                <small>{copy(locale, { en: 'Today, 08:42', 'pt-BR': 'Hoje, 08:42' })}</small>
              </span>
            </li>
            <li>
              <ProductIcon name="recovery" size={16} />
              <span>
                <strong>
                  {copy(locale, {
                    en: 'Recovery path verified',
                    'pt-BR': 'Caminho de recuperação verificado',
                  })}
                </strong>
                <small>{copy(locale, { en: 'Yesterday, 21:16', 'pt-BR': 'Ontem, 21:16' })}</small>
              </span>
            </li>
            <li>
              <ProductIcon name="device" size={16} />
              <span>
                <strong>
                  {copy(locale, {
                    en: 'Device identity validated',
                    'pt-BR': 'Identidade do dispositivo validada',
                  })}
                </strong>
                <small>DESKTOP-LR07</small>
              </span>
            </li>
          </ul>
        </section>
      ) : null}

      <section
        aria-label={copy(locale, {
          en: 'Connected account areas',
          'pt-BR': 'Áreas conectadas da conta',
        })}
        className="desktop-profile-destinations"
      >
        <ProfileDestination
          action={copy(locale, { en: 'Manage', 'pt-BR': 'Gerenciar' })}
          description="Premium"
          icon="crown"
          label={copy(locale, { en: 'Current plan', 'pt-BR': 'Plano atual' })}
          onPress={() => {
            navigate('/account/subscription');
          }}
        />
        <ProfileDestination
          action={copy(locale, { en: 'Open', 'pt-BR': 'Abrir' })}
          description="DESKTOP-LR07"
          icon="device"
          label={copy(locale, { en: 'Active device', 'pt-BR': 'Dispositivo ativo' })}
          onPress={() => {
            navigate('/account/device');
          }}
        />
        <ProfileDestination
          action={copy(locale, { en: 'Review', 'pt-BR': 'Revisar' })}
          description={copy(locale, {
            en: '2 protections pending',
            'pt-BR': '2 proteções pendentes',
          })}
          icon="lock"
          label={copy(locale, { en: 'Account security', 'pt-BR': 'Segurança da conta' })}
          onPress={() => {
            navigate('/account/security');
          }}
        />
      </section>

      <section className="desktop-profile-account-actions">
        <header>
          <div>
            <span className="desktop-profile-section-icon">
              <ProductIcon name="shield" size={19} />
            </span>
            <div>
              <h3>
                {copy(locale, { en: 'Account and local data', 'pt-BR': 'Conta e dados locais' })}
              </h3>
              <p>
                {copy(locale, {
                  en: 'Export, leave the session or restore this preview.',
                  'pt-BR': 'Exporte, encerre a sessão ou restaure esta prévia.',
                })}
              </p>
            </div>
          </div>
        </header>
        <div className="desktop-profile-account-action-list">
          <button onClick={exportProfile} type="button">
            <ProductIcon name="download" size={19} />
            <span>
              <strong>
                {copy(locale, { en: 'Export local profile', 'pt-BR': 'Exportar perfil local' })}
              </strong>
              <small>
                {copy(locale, {
                  en: 'Downloads a readable JSON package.',
                  'pt-BR': 'Baixa um pacote JSON legível.',
                })}
              </small>
            </span>
            <ProductIcon name="chevronRight" size={16} />
          </button>
          <button
            onClick={() => {
              navigate('/login');
            }}
            type="button"
          >
            <ProductIcon name="logout" size={19} />
            <span>
              <strong>
                {copy(locale, { en: 'Sign out of preview', 'pt-BR': 'Sair da prévia' })}
              </strong>
              <small>
                {copy(locale, {
                  en: 'Returns to sign-in without deleting local data.',
                  'pt-BR': 'Volta ao login sem apagar os dados locais.',
                })}
              </small>
            </span>
            <ProductIcon name="chevronRight" size={16} />
          </button>
          <button
            data-tone="danger"
            onClick={() => {
              setResetConfirmOpen(true);
            }}
            type="button"
          >
            <ProductIcon name="trash" size={19} />
            <span>
              <strong>
                {copy(locale, { en: 'Clear local preview', 'pt-BR': 'Limpar prévia local' })}
              </strong>
              <small>
                {copy(locale, {
                  en: 'Removes profile edits and restores defaults.',
                  'pt-BR': 'Remove edições do perfil e restaura os padrões.',
                })}
              </small>
            </span>
            <ProductIcon name="chevronRight" size={16} />
          </button>
        </div>

        {resetConfirmOpen ? (
          <aside className="desktop-profile-reset-confirm" aria-live="polite">
            <ProductIcon name="warning" size={21} />
            <div>
              <strong>
                {copy(locale, {
                  en: 'Clear this local profile?',
                  'pt-BR': 'Limpar este perfil local?',
                })}
              </strong>
              <p>
                {copy(locale, {
                  en: 'Name, avatar and profile preferences will return to their default values.',
                  'pt-BR': 'Nome, avatar e preferências do perfil voltarão aos valores padrão.',
                })}
              </p>
            </div>
            <div className="desktop-inline-actions">
              <LbButton
                onPress={() => {
                  setResetConfirmOpen(false);
                }}
                variant="quiet"
              >
                {copy(locale, { en: 'Cancel', 'pt-BR': 'Cancelar' })}
              </LbButton>
              <LbButton onPress={clearLocalPreview} variant="destructive">
                {copy(locale, { en: 'Clear local data', 'pt-BR': 'Limpar dados locais' })}
              </LbButton>
            </div>
          </aside>
        ) : null}
      </section>
    </div>
  );
};

const PlanFeature = ({
  children,
  included,
}: {
  readonly children: ReactNode;
  readonly included: boolean;
}) => (
  <li data-included={String(included)}>
    <ProductIcon name={included ? 'check' : 'minus'} size={16} />
    <span>{children}</span>
  </li>
);

const SubscriptionView = ({ locale }: Pick<AccountExperienceProps, 'locale'>) => {
  const [annual, setAnnual] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div className="desktop-plan-view">
      <section className="desktop-plan-heading">
        <div>
          <span className="desktop-profile-eyebrow">
            <ProductIcon name="crown" size={15} />
            FREEMIUM
          </span>
          <h2>
            {copy(locale, {
              en: 'Choose your level of control',
              'pt-BR': 'Escolha seu nível de controle',
            })}
          </h2>
          <p>
            {copy(locale, {
              en: 'Safety, diagnostics history and recovery are never held behind Premium.',
              'pt-BR':
                'Segurança, histórico de diagnósticos e recuperação nunca ficam presos ao Premium.',
            })}
          </p>
        </div>
        <div
          className="desktop-billing-toggle"
          aria-label={copy(locale, {
            en: 'Billing period preview',
            'pt-BR': 'Prévia do período de cobrança',
          })}
        >
          <button
            aria-pressed={!annual}
            onClick={() => {
              setAnnual(false);
            }}
            type="button"
          >
            {copy(locale, { en: 'Monthly', 'pt-BR': 'Mensal' })}
          </button>
          <button
            aria-pressed={annual}
            onClick={() => {
              setAnnual(true);
            }}
            type="button"
          >
            {copy(locale, { en: 'Annual', 'pt-BR': 'Anual' })}
            <span>-20%</span>
          </button>
        </div>
      </section>

      <section
        className="desktop-plan-grid"
        aria-label={copy(locale, { en: 'Available plans', 'pt-BR': 'Planos disponíveis' })}
      >
        <article className="desktop-plan-card">
          <header>
            <ProductIcon name="shield" size={22} />
            <div>
              <h3>Free</h3>
              <p>
                {copy(locale, {
                  en: 'Clarity and safety first',
                  'pt-BR': 'Clareza e segurança primeiro',
                })}
              </p>
            </div>
          </header>
          <div className="desktop-plan-price">
            <strong>R$ 0</strong>
            <span>{copy(locale, { en: 'forever', 'pt-BR': 'para sempre' })}</span>
          </div>
          <PlanFeature included>
            {copy(locale, { en: 'Hardware diagnosis', 'pt-BR': 'Diagnóstico de hardware' })}
          </PlanFeature>
          <PlanFeature included>
            {copy(locale, { en: 'Manual plan review', 'pt-BR': 'Revisão manual dos planos' })}
          </PlanFeature>
          <PlanFeature included>
            {copy(locale, {
              en: 'History and full recovery',
              'pt-BR': 'Histórico e recuperação completa',
            })}
          </PlanFeature>
          <PlanFeature included={false}>
            {copy(locale, {
              en: 'Automatic game profiles',
              'pt-BR': 'Perfis automáticos por jogo',
            })}
          </PlanFeature>
          <PlanFeature included={false}>
            {copy(locale, {
              en: 'Advanced optimization catalog',
              'pt-BR': 'Catálogo avançado de otimizações',
            })}
          </PlanFeature>
          <LbButton
            onPress={() => {
              setNotice(
                copy(locale, {
                  en: 'Free selected in the local preview.',
                  'pt-BR': 'Free selecionado na prévia local.',
                }),
              );
            }}
            variant="secondary"
          >
            {copy(locale, { en: 'Continue with Free', 'pt-BR': 'Continuar no Free' })}
          </LbButton>
        </article>

        <article className="desktop-plan-card desktop-plan-card-premium">
          <span className="desktop-plan-recommended">
            {copy(locale, { en: 'Recommended', 'pt-BR': 'Recomendado' })}
          </span>
          <header>
            <ProductIcon name="crown" size={22} />
            <div>
              <h3>Premium</h3>
              <p>
                {copy(locale, {
                  en: 'Maximum performance control',
                  'pt-BR': 'Controle máximo de desempenho',
                })}
              </p>
            </div>
          </header>
          <div className="desktop-plan-price">
            <strong>{annual ? 'R$ 19,90' : 'R$ 24,90'}</strong>
            <span>
              {copy(locale, {
                en: '/ month · price preview',
                'pt-BR': '/ mês · preço ilustrativo',
              })}
            </span>
          </div>
          <PlanFeature included>
            {copy(locale, { en: 'Everything in Free', 'pt-BR': 'Tudo do Free' })}
          </PlanFeature>
          <PlanFeature included>
            {copy(locale, {
              en: 'Hardware-specific recommendations',
              'pt-BR': 'Recomendações específicas para o hardware',
            })}
          </PlanFeature>
          <PlanFeature included>
            {copy(locale, {
              en: 'Automatic profiles per game',
              'pt-BR': 'Perfis automáticos por jogo',
            })}
          </PlanFeature>
          <PlanFeature included>
            {copy(locale, {
              en: 'Advanced evidence and comparisons',
              'pt-BR': 'Evidências e comparações avançadas',
            })}
          </PlanFeature>
          <PlanFeature included>
            {copy(locale, { en: 'Priority support', 'pt-BR': 'Suporte prioritário' })}
          </PlanFeature>
          <LbButton
            onPress={() => {
              setNotice(
                copy(locale, {
                  en: 'Premium checkout is prepared for Phase 4. No charge was made.',
                  'pt-BR':
                    'O checkout Premium está preparado para a Fase 4. Nenhuma cobrança foi feita.',
                }),
              );
            }}
            variant="primary"
          >
            <ProductIcon name="crown" size={17} />
            {copy(locale, { en: 'Choose Premium', 'pt-BR': 'Escolher Premium' })}
          </LbButton>
        </article>
      </section>

      {notice ? (
        <div className="desktop-plan-notice" aria-live="polite">
          <ProductIcon name="shield" size={18} />
          <span>{notice}</span>
          <button
            aria-label={copy(locale, { en: 'Close notice', 'pt-BR': 'Fechar aviso' })}
            onClick={() => {
              setNotice(null);
            }}
            type="button"
          >
            ×
          </button>
        </div>
      ) : null}
    </div>
  );
};

const DeviceView = ({
  locale,
  scenarioId,
}: Pick<AccountExperienceProps, 'locale' | 'scenarioId'>) => {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [cooldownVisible, setCooldownVisible] = useState(false);

  return (
    <div className="desktop-device-view">
      <section className="desktop-device-hero">
        <div className="desktop-device-icon">
          <ProductIcon name="device" size={28} />
        </div>
        <div>
          <span className="desktop-profile-eyebrow">
            <ProductIcon name="check" size={14} />
            {copy(locale, { en: 'ACTIVE DEVICE', 'pt-BR': 'DISPOSITIVO ATIVO' })}
          </span>
          <h2>DESKTOP-LR07</h2>
          <p>Windows 11 Pro · Ryzen 7 7800X3D · RTX 4070 Super</p>
        </div>
        <span className="desktop-device-slot">1 / 1</span>
      </section>

      <section className="desktop-device-ledger">
        <div>
          <span>
            {copy(locale, { en: 'Last local validation', 'pt-BR': 'Última validação local' })}
          </span>
          <strong>Hoje, 08:42</strong>
        </div>
        <div>
          <span>
            {copy(locale, { en: 'Recovery readiness', 'pt-BR': 'Prontidão de recuperação' })}
          </span>
          <strong>{copy(locale, { en: 'Protected', 'pt-BR': 'Protegido' })}</strong>
        </div>
        <div>
          <span>{copy(locale, { en: 'Scenario source', 'pt-BR': 'Origem do cenário' })}</span>
          <strong>{scenarioId} · FIXTURE</strong>
        </div>
      </section>

      <div className="desktop-inline-actions">
        <LbButton
          onPress={() => {
            setDetailsOpen((current) => !current);
          }}
          variant="secondary"
        >
          {detailsOpen
            ? copy(locale, { en: 'Hide technical details', 'pt-BR': 'Ocultar detalhes técnicos' })
            : copy(locale, { en: 'View technical details', 'pt-BR': 'Ver detalhes técnicos' })}
        </LbButton>
        <LbButton
          onPress={() => {
            setCooldownVisible(true);
          }}
          variant="quiet"
        >
          {copy(locale, { en: 'Replace device', 'pt-BR': 'Trocar dispositivo' })}
        </LbButton>
      </div>

      {detailsOpen ? (
        <section className="desktop-device-details">
          <h3>{copy(locale, { en: 'Device identity', 'pt-BR': 'Identidade do dispositivo' })}</h3>
          <dl>
            <div>
              <dt>ID local</dt>
              <dd>LR07-S01-7F2A</dd>
            </div>
            <div>
              <dt>WebView2</dt>
              <dd>Validado</dd>
            </div>
            <div>
              <dt>{copy(locale, { en: 'App channel', 'pt-BR': 'Canal do app' })}</dt>
              <dd>Stable</dd>
            </div>
            <div>
              <dt>{copy(locale, { en: 'Privilege model', 'pt-BR': 'Modelo de privilégio' })}</dt>
              <dd>{copy(locale, { en: 'Non-elevated UI', 'pt-BR': 'Interface sem elevação' })}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      {cooldownVisible ? (
        <aside className="desktop-account-callout" aria-live="polite">
          <ProductIcon name="timer" size={20} />
          <div>
            <strong>
              {copy(locale, {
                en: 'Device replacement is protected',
                'pt-BR': 'A troca de dispositivo é protegida',
              })}
            </strong>
            <p>
              {copy(locale, {
                en: 'The real 30-day cooldown and identity verification arrive with Phase 4. No device was changed.',
                'pt-BR':
                  'O intervalo real de 30 dias e a verificação de identidade chegam na Fase 4. Nenhum dispositivo foi alterado.',
              })}
            </p>
          </div>
          <LbButton
            onPress={() => {
              setCooldownVisible(false);
            }}
            variant="quiet"
          >
            {copy(locale, { en: 'Understood', 'pt-BR': 'Entendi' })}
          </LbButton>
        </aside>
      ) : null}
    </div>
  );
};

const SecurityView = ({ locale }: Pick<AccountExperienceProps, 'locale'>) => {
  const [notice, setNotice] = useState<string | null>(null);
  const securityItems = [
    {
      icon: 'key',
      title: { en: 'Passkey', 'pt-BR': 'Chave de acesso' },
      detail: {
        en: 'Fast sign-in protected by Windows Hello.',
        'pt-BR': 'Entrada rápida protegida pelo Windows Hello.',
      },
      action: { en: 'Configure', 'pt-BR': 'Configurar' },
    },
    {
      icon: 'shield',
      title: { en: 'Two-factor authentication', 'pt-BR': 'Autenticação em dois fatores' },
      detail: {
        en: 'Add a second verification step to sensitive actions.',
        'pt-BR': 'Adicione uma segunda verificação às ações sensíveis.',
      },
      action: { en: 'Enable', 'pt-BR': 'Ativar' },
    },
    {
      icon: 'history',
      title: { en: 'Active sessions', 'pt-BR': 'Sessões ativas' },
      detail: {
        en: 'Review browsers and devices connected to your account.',
        'pt-BR': 'Revise navegadores e dispositivos conectados à sua conta.',
      },
      action: { en: 'Review', 'pt-BR': 'Revisar' },
    },
  ] as const;

  return (
    <div className="desktop-security-view">
      <section className="desktop-security-score">
        <div className="desktop-security-ring">
          <div className="desktop-security-value">
            <span>72</span>
            <small>/100</small>
          </div>
        </div>
        <div>
          <span className="desktop-profile-eyebrow">
            {copy(locale, { en: 'SECURITY READINESS', 'pt-BR': 'PRONTIDÃO DE SEGURANÇA' })}
          </span>
          <h2>
            {copy(locale, {
              en: 'Strong foundation, two steps pending',
              'pt-BR': 'Base forte, duas etapas pendentes',
            })}
          </h2>
          <p>
            {copy(locale, {
              en: 'This score describes the designed fixture, not a real cloud account.',
              'pt-BR': 'Esta nota descreve o cenário projetado, não uma conta real em nuvem.',
            })}
          </p>
        </div>
      </section>

      <section className="desktop-security-list">
        {securityItems.map((item) => (
          <article key={item.icon}>
            <div className="desktop-security-item-icon">
              <ProductIcon name={item.icon} size={20} />
            </div>
            <div>
              <h3>{copy(locale, item.title)}</h3>
              <p>{copy(locale, item.detail)}</p>
            </div>
            <LbButton
              onPress={() => {
                setNotice(
                  copy(locale, {
                    en: `${item.action.en} flow is visually ready and will connect to the Phase 4 identity service.`,
                    'pt-BR': `O fluxo “${item.action['pt-BR']}” está visualmente pronto e será conectado ao serviço de identidade da Fase 4.`,
                  }),
                );
              }}
              variant="secondary"
            >
              {copy(locale, item.action)}
            </LbButton>
          </article>
        ))}
      </section>

      {notice ? (
        <aside className="desktop-account-callout" aria-live="polite">
          <ProductIcon name="lock" size={20} />
          <p>{notice}</p>
          <LbButton
            onPress={() => {
              setNotice(null);
            }}
            variant="quiet"
          >
            {copy(locale, { en: 'Close', 'pt-BR': 'Fechar' })}
          </LbButton>
        </aside>
      ) : null}
    </div>
  );
};

const LocalSafetyCapabilities = ({ locale }: { readonly locale: ShellLocale }) => (
  <section
    aria-label={
      locale === 'pt-BR' ? 'Capacidades locais de segurança' : 'Local safety capabilities'
    }
    data-local-only="true"
  >
    <h2>
      {copy(locale, {
        en: 'Local safety remains available',
        'pt-BR': 'A segurança local continua disponível',
      })}
    </h2>
    <ul>
      <li>{copy(locale, { en: 'Warnings', 'pt-BR': 'Alertas' })}</li>
      <li>{copy(locale, { en: 'History', 'pt-BR': 'Histórico' })}</li>
      <li>{copy(locale, { en: 'Diagnostics', 'pt-BR': 'Diagnósticos' })}</li>
      <li>{copy(locale, { en: 'Restoration', 'pt-BR': 'Restauração' })}</li>
    </ul>
  </section>
);

const AuthoritativeProfile = ({
  authority,
  locale,
  snapshot,
}: {
  readonly authority: DesktopAccountAuthority;
  readonly locale: ShellLocale;
  readonly snapshot: DesktopAccountAuthoritySnapshot;
}) => {
  const remoteName = snapshot.projection?.account.displayName ?? '';
  const [displayName, setDisplayName] = useState(remoteName);
  const [notice, setNotice] = useState<
    Readonly<{ tone: 'error' | 'success'; title: string; message: string }> | undefined
  >();
  const normalizedName = displayName.trim();
  const isDirty = normalizedName !== remoteName;
  const isValid = normalizedName.length >= 2 && normalizedName.length <= 40;
  const isSaving = snapshot.state === 'pending' && snapshot.localDraft !== undefined;
  const localDraftName = snapshot.localDraft?.displayName;

  useEffect(() => {
    if (isSaving) return;
    if (localDraftName !== undefined) {
      setDisplayName(localDraftName);
      return;
    }
    if (remoteName !== '') setDisplayName(remoteName);
  }, [isSaving, localDraftName, remoteName]);

  const saveProfile = async (): Promise<void> => {
    setNotice(undefined);
    const result = await authority.updateProfile({ displayName: normalizedName, locale });
    if (result.status === 'committed') {
      setDisplayName(result.projection.account.displayName);
      setNotice({
        tone: 'success',
        title: copy(locale, { en: 'Profile saved', 'pt-BR': 'Perfil salvo' }),
        message: copy(locale, {
          en: 'The new name is confirmed by the account API and will persist after restart.',
          'pt-BR': 'O novo nome foi confirmado pela API e continuará salvo após reiniciar.',
        }),
      });
      return;
    }
    if (result.status === 'conflict') {
      setDisplayName(result.localDraft.displayName);
      setNotice(undefined);
      return;
    }
    setNotice({
      tone: 'error',
      title: copy(locale, { en: 'The profile was not saved', 'pt-BR': 'O perfil não foi salvo' }),
      message: copy(locale, {
        en: 'Your typed name is still here. Check the connection and try again.',
        'pt-BR': 'O nome digitado continua aqui. Verifique a conexão e tente novamente.',
      }),
    });
  };

  return (
    <div className="desktop-authority-profile-form">
      {snapshot.state === 'conflict' && snapshot.projection && snapshot.localDraft ? (
        <aside className="desktop-authority-notice" data-tone="error" role="alert">
          <ProductIcon name="warning" size={18} />
          <div>
            <strong>
              {copy(locale, { en: 'Version conflict', 'pt-BR': 'Conflito de versão' })}
            </strong>
            <p>
              {copy(locale, { en: 'Account', 'pt-BR': 'Conta' })}:{' '}
              {snapshot.projection.account.displayName}
              {' · '}
              {copy(locale, { en: 'Your draft', 'pt-BR': 'Seu rascunho' })}:{' '}
              {snapshot.localDraft.displayName}
            </p>
            <p>
              {copy(locale, {
                en: 'Your typed name was preserved. Review it and save again.',
                'pt-BR': 'O nome digitado foi preservado. Revise e salve novamente.',
              })}
            </p>
          </div>
        </aside>
      ) : null}
      {notice ? (
        <aside className="desktop-authority-notice" data-tone={notice.tone} aria-live="polite">
          <ProductIcon name={notice.tone === 'success' ? 'check' : 'warning'} size={18} />
          <div>
            <strong>{notice.title}</strong>
            <p>{notice.message}</p>
          </div>
        </aside>
      ) : null}
      <section aria-label={copy(locale, { en: 'Profile name', 'pt-BR': 'Nome do perfil' })}>
        <header>
          <div>
            <span className="desktop-authority-kicker">
              {copy(locale, { en: 'PUBLIC IDENTITY', 'pt-BR': 'IDENTIDADE PÚBLICA' })}
            </span>
            <h3>{copy(locale, { en: 'Display name', 'pt-BR': 'Nome de exibição' })}</h3>
            <p>
              {copy(locale, {
                en: 'Shown in this app and in every authenticated Liiiraa Boost surface.',
                'pt-BR': 'Exibido neste app e em todas as áreas autenticadas do Liiiraa Boost.',
              })}
            </p>
          </div>
          <span className="desktop-authority-save-state" data-dirty={String(isDirty)}>
            {isSaving
              ? copy(locale, { en: 'Saving…', 'pt-BR': 'Salvando…' })
              : isDirty
                ? copy(locale, { en: 'Unsaved change', 'pt-BR': 'Alteração não salva' })
                : copy(locale, { en: 'Up to date', 'pt-BR': 'Atualizado' })}
          </span>
        </header>
        <div className="desktop-authority-profile-controls">
          <LbTextField
            label={copy(locale, { en: 'Display name', 'pt-BR': 'Nome de exibição' })}
            maxLength={40}
            onChange={(value) => {
              setDisplayName(value);
              setNotice(undefined);
            }}
            value={displayName}
          />
          <div className="desktop-authority-profile-actions">
            {isDirty ? (
              <LbButton
                isDisabled={isSaving}
                onPress={() => {
                  setDisplayName(remoteName);
                  setNotice(undefined);
                }}
                variant="quiet"
              >
                {copy(locale, { en: 'Discard', 'pt-BR': 'Descartar' })}
              </LbButton>
            ) : null}
            <LbButton
              isDisabled={!isDirty || !isValid || isSaving}
              isLoading={isSaving}
              loadingLabel={copy(locale, { en: 'Saving', 'pt-BR': 'Salvando' })}
              onPress={() => void saveProfile()}
              variant="primary"
            >
              {copy(locale, { en: 'Save profile', 'pt-BR': 'Salvar perfil' })}
            </LbButton>
          </div>
        </div>
        {!isValid && displayName.length > 0 ? (
          <p className="desktop-authority-field-error" role="alert">
            {copy(locale, {
              en: 'Use between 2 and 40 characters.',
              'pt-BR': 'Use entre 2 e 40 caracteres.',
            })}
          </p>
        ) : null}
      </section>
      <dl className="desktop-authority-profile-meta">
        <div>
          <dt>{copy(locale, { en: 'Account language', 'pt-BR': 'Idioma da conta' })}</dt>
          <dd>{locale === 'pt-BR' ? 'Português (Brasil)' : 'English'}</dd>
        </div>
        <div>
          <dt>{copy(locale, { en: 'Persistence', 'pt-BR': 'Persistência' })}</dt>
          <dd>
            <ProductIcon name="lock" size={14} />
            PostgreSQL
          </dd>
        </div>
      </dl>
    </div>
  );
};

const authorityInitials = (displayName: string, locale: ShellLocale): string =>
  displayName
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase(locale) ?? '')
    .join('') || 'LB';

const administrativeRoleLabel = (
  locale: ShellLocale,
  role: 'audit' | 'operations' | 'security' | 'support',
): string => {
  const labels = {
    en: {
      audit: 'Audit',
      operations: 'Operations',
      security: 'Security',
      support: 'Support',
    },
    'pt-BR': {
      audit: 'Auditoria',
      operations: 'Operações',
      security: 'Segurança',
      support: 'Suporte',
    },
  } as const;
  return labels[locale][role];
};

const administrativeMembershipStateLabel = (
  locale: ShellLocale,
  membership: DesktopAdminHandoffProjection['membership'],
): string => {
  const labels = {
    en: {
      active: 'Active',
      expired: 'Expired',
      none: 'Standard account',
      offline: 'Authority unavailable',
      revoked: 'Revoked',
    },
    'pt-BR': {
      active: 'Ativa',
      expired: 'Expirada',
      none: 'Conta padrão',
      offline: 'Autoridade indisponível',
      revoked: 'Revogada',
    },
  } as const;
  return labels[locale][membership];
};

export const DesktopAdminHandoff = ({
  handoff,
  locale,
  onOpen,
}: Readonly<{
  handoff: DesktopAdminHandoffProjection;
  locale: ShellLocale;
  onOpen: () => void;
}>) => (
  <aside
    aria-label={copy(locale, {
      en: 'Administrative membership',
      'pt-BR': 'Associação administrativa',
    })}
    className="desktop-authority-admin-handoff"
    data-admin-handoff={handoff.status}
  >
    <span data-administrative-membership={handoff.membership}>
      <ProductIcon name="shield" size={16} />
      <span>
        <strong>
          {copy(locale, {
            en: 'Administrative member',
            'pt-BR': 'Membro administrativo',
          })}
        </strong>
        <small>{administrativeMembershipStateLabel(locale, handoff.membership)}</small>
      </span>
    </span>
    {handoff.activeFunction === undefined ? null : (
      <span data-admin-active-function={handoff.activeFunction}>
        <ProductIcon name="sliders" size={16} />
        <span>
          <strong>{copy(locale, { en: 'Active function', 'pt-BR': 'Função ativa' })}</strong>
          <small>{administrativeRoleLabel(locale, handoff.activeFunction)}</small>
        </span>
      </span>
    )}
    {handoff.actionable ? (
      <LbButton onPress={onOpen} variant="primary">
        <ProductIcon name="arrowRight" size={16} />
        {copy(locale, { en: 'Open Admin', 'pt-BR': 'Abrir Admin' })}
      </LbButton>
    ) : null}
  </aside>
);

const formatAuthorityDate = (value: string, locale: ShellLocale): string =>
  new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));

const AuthoritativeAccountContent = ({
  authority,
  desktopAuth,
  locale,
  navigate,
  snapshot,
  view,
}: {
  readonly authority: DesktopAccountAuthority;
  readonly desktopAuth: DesktopAuth | undefined;
  readonly locale: ShellLocale;
  readonly navigate: (pathname: string) => void;
  readonly snapshot: DesktopAccountAuthoritySnapshot;
  readonly view: Exclude<AccountExperienceView, 'login'>;
}) => {
  const [signOutFailed, setSignOutFailed] = useState(false);
  const [adminOpenFailed, setAdminOpenFailed] = useState(false);
  const [subscriptionOpenFailed, setSubscriptionOpenFailed] = useState(false);
  const projection = snapshot.projection;
  const account = projection?.account;
  const subscription = projection?.subscription;
  const administrativeRole = account?.administrativeRole;
  const isPremium = subscription?.plan === 'premium' && subscription.state === 'active';
  const activeSessions = projection?.sessions.filter((session) => session.state === 'active') ?? [];
  const primarySession = activeSessions[0];
  const accountIsCurrent = snapshot.state === 'online';
  const adminHandoff = resolveDesktopAdminHandoff(snapshot);

  return (
    <div
      className="desktop-authority-account"
      data-account-authority-state={snapshot.state}
      data-account-runtime="production"
    >
      {account === undefined || subscription === undefined ? (
        <section className="desktop-authority-loading" aria-busy="true">
          <span className="desktop-authority-loading__pulse" />
          <div>
            <h2>
              {copy(locale, { en: 'Restoring your account', 'pt-BR': 'Restaurando sua conta' })}
            </h2>
            <p>
              {copy(locale, {
                en: 'Reading the latest authorized account projection.',
                'pt-BR': 'Lendo a projeção autorizada mais recente da conta.',
              })}
            </p>
          </div>
        </section>
      ) : (
        <section className="desktop-authority-identity" aria-labelledby="desktop-account-name">
          <div className="desktop-authority-identity__avatar" aria-hidden="true">
            {authorityInitials(account.displayName, locale)}
          </div>
          <div className="desktop-authority-identity__body">
            <span className="desktop-authority-identity__status" data-state={snapshot.state}>
              <ProductIcon name={accountIsCurrent ? 'check' : 'warning'} size={14} />
              {accountIsCurrent
                ? copy(locale, {
                    en: 'Confirmed by the account API',
                    'pt-BR': 'Confirmado pela API da conta',
                  })
                : copy(locale, {
                    en: 'Showing the last confirmed version',
                    'pt-BR': 'Exibindo a última versão confirmada',
                  })}
            </span>
            <h2 id="desktop-account-name">{account.displayName}</h2>
            <p>{account.emailRedacted}</p>
            <div className="desktop-authority-identity__badges">
              <span data-entitlement={subscription.plan}>
                <ProductIcon name="crown" size={14} />
                {isPremium ? 'Premium' : 'Free'}
              </span>
              {administrativeRole === undefined ? null : (
                <span data-administrative-role={administrativeRole}>
                  <ProductIcon name="shield" size={14} />
                  {copy(locale, { en: 'Administrator', 'pt-BR': 'Administrador' })}
                  {' · '}
                  {administrativeRoleLabel(locale, administrativeRole)}
                </span>
              )}
            </div>
          </div>
          <dl className="desktop-authority-identity__facts">
            <div>
              <dt>{copy(locale, { en: 'Member since', 'pt-BR': 'Membro desde' })}</dt>
              <dd>{formatAuthorityDate(account.createdAt, locale)}</dd>
            </div>
            <div>
              <dt>{copy(locale, { en: 'Access level', 'pt-BR': 'Nível de acesso' })}</dt>
              <dd>{isPremium ? 'Premium' : 'Free'}</dd>
            </div>
            <div>
              <dt>
                {copy(locale, { en: 'Authorized device', 'pt-BR': 'Dispositivo autorizado' })}
              </dt>
              <dd>
                {projection?.activeDevice?.deviceLabel ??
                  copy(locale, { en: 'Not linked', 'pt-BR': 'Não vinculado' })}
              </dd>
            </div>
          </dl>
        </section>
      )}
      <DesktopAdminHandoff
        handoff={adminHandoff}
        locale={locale}
        onOpen={() => {
          setAdminOpenFailed(false);
          void authority.openAdmin().then((result) => {
            if (result.status !== 'opened') setAdminOpenFailed(true);
          });
        }}
      />
      {adminOpenFailed ? (
        <p role="alert">
          {copy(locale, {
            en: 'Admin could not open in the system browser. Confirm your connection and try again.',
            'pt-BR':
              'Não foi possível abrir o Admin no navegador do sistema. Confirme sua conexão e tente novamente.',
          })}
        </p>
      ) : null}
      {view === 'overview' ? (
        <div className="desktop-authority-route desktop-authority-route--profile">
          <section className="desktop-authority-section desktop-authority-section--primary">
            <header>
              <span className="desktop-authority-section__icon">
                <ProductIcon name="profile" size={19} />
              </span>
              <div>
                <span className="desktop-authority-kicker">
                  {copy(locale, { en: 'ACCOUNT PROFILE', 'pt-BR': 'PERFIL DA CONTA' })}
                </span>
                <h2>{copy(locale, { en: 'Your identity', 'pt-BR': 'Sua identidade' })}</h2>
                <p>
                  {copy(locale, {
                    en: 'One authoritative profile shared by the desktop and account portal.',
                    'pt-BR':
                      'Um perfil autoritativo compartilhado pelo desktop e pelo portal da conta.',
                  })}
                </p>
              </div>
            </header>
            <AuthoritativeProfile authority={authority} locale={locale} snapshot={snapshot} />
          </section>
          <aside
            className="desktop-authority-context"
            aria-label={copy(locale, { en: 'Account record', 'pt-BR': 'Registro da conta' })}
          >
            <span className="desktop-authority-kicker">
              {copy(locale, { en: 'AUTHORITATIVE RECORD', 'pt-BR': 'REGISTRO AUTORITATIVO' })}
            </span>
            <h3>{copy(locale, { en: 'Account details', 'pt-BR': 'Detalhes da conta' })}</h3>
            <dl>
              <div>
                <dt>E-mail</dt>
                <dd>{account?.emailRedacted ?? '—'}</dd>
              </div>
              <div>
                <dt>{copy(locale, { en: 'Last update', 'pt-BR': 'Última atualização' })}</dt>
                <dd>{account ? formatAuthorityDate(account.updatedAt, locale) : '—'}</dd>
              </div>
              <div>
                <dt>{copy(locale, { en: 'Account version', 'pt-BR': 'Versão da conta' })}</dt>
                <dd>v{account?.aggregateVersion ?? '—'}</dd>
              </div>
            </dl>
            <p>
              <ProductIcon name="lock" size={15} />
              {copy(locale, {
                en: 'Only confirmed server data is presented here.',
                'pt-BR': 'Somente dados confirmados pelo servidor aparecem aqui.',
              })}
            </p>
          </aside>
        </div>
      ) : null}
      {view === 'subscription' ? (
        <div className="desktop-authority-route desktop-authority-route--plan">
          <section className="desktop-authority-plan-hero" data-plan={subscription?.plan ?? 'free'}>
            <div className="desktop-authority-plan-mark" aria-hidden="true">
              <ProductIcon name="crown" size={28} />
            </div>
            <div>
              <span className="desktop-authority-kicker">
                {copy(locale, { en: 'CURRENT ACCESS', 'pt-BR': 'ACESSO ATUAL' })}
              </span>
              <h2>{isPremium ? 'Premium' : 'Free'}</h2>
              <p>
                {isPremium
                  ? copy(locale, {
                      en: 'Full access is active for this account.',
                      'pt-BR': 'O acesso completo está ativo para esta conta.',
                    })
                  : copy(locale, {
                      en: 'This account currently has essential access.',
                      'pt-BR': 'Esta conta possui atualmente o acesso essencial.',
                    })}
              </p>
            </div>
            <span className="desktop-authority-plan-state">
              <ProductIcon name="check" size={15} />
              {subscription?.state === 'active'
                ? copy(locale, { en: 'Active', 'pt-BR': 'Ativo' })
                : (subscription?.state ?? '—')}
            </span>
          </section>
          <section
            className="desktop-authority-plan-handoff"
            data-plan-action={isPremium ? 'manage' : 'upgrade'}
          >
            <span className="desktop-authority-plan-handoff__icon">
              <ProductIcon name={isPremium ? 'sliders' : 'crown'} size={22} />
            </span>
            <div>
              <span className="desktop-authority-kicker">
                {copy(locale, { en: 'PLANS AND BILLING', 'pt-BR': 'PLANOS E COBRANÇA' })}
              </span>
              <h3>
                {isPremium
                  ? copy(locale, {
                      en: 'Manage your subscription',
                      'pt-BR': 'Gerencie sua assinatura',
                    })
                  : copy(locale, {
                      en: 'Unlock the complete experience',
                      'pt-BR': 'Libere a experiência completa',
                    })}
              </h3>
              <p>
                {copy(locale, {
                  en: 'Payment opens in the secure browser. The desktop never receives card data.',
                  'pt-BR':
                    'O pagamento abre no navegador seguro. O desktop nunca recebe dados do cartão.',
                })}
              </p>
            </div>
            <LbButton
              onPress={() => {
                setSubscriptionOpenFailed(false);
                void authority.openSubscription(locale).then((result) => {
                  if (result.status !== 'opened') setSubscriptionOpenFailed(true);
                });
              }}
              variant="primary"
            >
              {isPremium
                ? copy(locale, { en: 'Manage subscription', 'pt-BR': 'Gerenciar assinatura' })
                : copy(locale, { en: 'View plans and subscribe', 'pt-BR': 'Ver planos e assinar' })}
              <ProductIcon name="arrowRight" size={16} />
            </LbButton>
          </section>
          {subscriptionOpenFailed ? (
            <p className="desktop-authority-plan-handoff__error" role="alert">
              {copy(locale, {
                en: 'The secure Account portal could not open. Confirm your connection and try again.',
                'pt-BR':
                  'Não foi possível abrir o portal seguro da Conta. Confirme sua conexão e tente novamente.',
              })}
            </p>
          ) : null}
          <section className="desktop-authority-section desktop-authority-section--ledger">
            <header>
              <span className="desktop-authority-section__icon">
                <ProductIcon name="shield" size={19} />
              </span>
              <div>
                <span className="desktop-authority-kicker">
                  {copy(locale, { en: 'SERVER ENTITLEMENTS', 'pt-BR': 'DIREITOS DO SERVIDOR' })}
                </span>
                <h2>
                  {copy(locale, {
                    en: 'What this account unlocks',
                    'pt-BR': 'O que esta conta libera',
                  })}
                </h2>
                <p>
                  {copy(locale, {
                    en: 'The list below comes directly from the subscription authority.',
                    'pt-BR': 'A lista abaixo vem diretamente da autoridade de assinatura.',
                  })}
                </p>
              </div>
            </header>
            <ul className="desktop-authority-entitlements">
              {(subscription?.entitlements ?? []).map((entitlement) => (
                <li key={entitlement}>
                  <ProductIcon name="check" size={16} />
                  <span>
                    <strong>{entitlement.replaceAll('-', ' ')}</strong>
                    <small>{copy(locale, { en: 'Authorized', 'pt-BR': 'Autorizado' })}</small>
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <dl className="desktop-authority-plan-facts">
            <div>
              <dt>{copy(locale, { en: 'Validity', 'pt-BR': 'Validade' })}</dt>
              <dd>
                {subscription?.currentPeriodEndsAt
                  ? formatAuthorityDate(subscription.currentPeriodEndsAt, locale)
                  : copy(locale, {
                      en: 'Permanent on this account',
                      'pt-BR': 'Permanente nesta conta',
                    })}
              </dd>
            </div>
            <div>
              <dt>
                {copy(locale, { en: 'Automatic cancellation', 'pt-BR': 'Cancelamento automático' })}
              </dt>
              <dd>
                {subscription?.cancelAtPeriodEnd
                  ? copy(locale, { en: 'Scheduled', 'pt-BR': 'Agendado' })
                  : copy(locale, { en: 'No', 'pt-BR': 'Não' })}
              </dd>
            </div>
            <div>
              <dt>{copy(locale, { en: 'Authority', 'pt-BR': 'Autoridade' })}</dt>
              <dd>PostgreSQL · API</dd>
            </div>
          </dl>
        </div>
      ) : null}
      {view === 'device' ? (
        <div className="desktop-authority-route desktop-authority-route--device">
          <section
            className="desktop-authority-device-state"
            data-linked={String(projection?.activeDevice !== null)}
          >
            <div className="desktop-authority-device-visual" aria-hidden="true">
              <ProductIcon name="monitor" size={34} />
              <span />
            </div>
            <div>
              <span className="desktop-authority-kicker">
                {copy(locale, { en: 'DEVICE AUTHORITY', 'pt-BR': 'AUTORIDADE DO DISPOSITIVO' })}
              </span>
              <h2>
                {projection?.activeDevice?.deviceLabel ??
                  copy(locale, {
                    en: 'This PC is not linked yet',
                    'pt-BR': 'Este PC ainda não está vinculado',
                  })}
              </h2>
              <p>
                {projection?.activeDevice
                  ? copy(locale, {
                      en: 'This device was confirmed by the account API.',
                      'pt-BR': 'Este dispositivo foi confirmado pela API da conta.',
                    })
                  : copy(locale, {
                      en: 'Device binding has not been enabled in this beta. Your account and Premium access remain active.',
                      'pt-BR':
                        'A vinculação de dispositivo ainda não foi liberada nesta beta. Sua conta e o acesso Premium continuam ativos.',
                    })}
              </p>
            </div>
            <span className="desktop-authority-device-badge">
              {projection?.activeDevice
                ? copy(locale, { en: 'Linked', 'pt-BR': 'Vinculado' })
                : copy(locale, { en: 'Awaiting beta', 'pt-BR': 'Aguardando beta' })}
            </span>
          </section>
          <section className="desktop-authority-section desktop-authority-section--device-explainer">
            <header>
              <span className="desktop-authority-section__icon">
                <ProductIcon name="shield" size={19} />
              </span>
              <div>
                <h2>
                  {copy(locale, {
                    en: 'What linking will protect',
                    'pt-BR': 'O que a vinculação vai proteger',
                  })}
                </h2>
                <p>
                  {copy(locale, {
                    en: 'When released, binding will associate licenses and optimization history with one verified PC.',
                    'pt-BR':
                      'Quando liberada, a vinculação associará licenças e histórico de otimização a um PC verificado.',
                  })}
                </p>
              </div>
            </header>
            <div className="desktop-authority-device-capabilities">
              <div>
                <ProductIcon name="lock" size={18} />
                <strong>
                  {copy(locale, { en: 'License custody', 'pt-BR': 'Custódia da licença' })}
                </strong>
                <p>
                  {copy(locale, {
                    en: 'Prevents silent device swaps.',
                    'pt-BR': 'Impede trocas silenciosas de dispositivo.',
                  })}
                </p>
              </div>
              <div>
                <ProductIcon name="history" size={18} />
                <strong>
                  {copy(locale, {
                    en: 'Recovery continuity',
                    'pt-BR': 'Continuidade de recuperação',
                  })}
                </strong>
                <p>
                  {copy(locale, {
                    en: 'Keeps device evidence traceable.',
                    'pt-BR': 'Mantém as evidências do dispositivo rastreáveis.',
                  })}
                </p>
              </div>
              <div>
                <ProductIcon name="shield" size={18} />
                <strong>
                  {copy(locale, { en: 'Verified changes', 'pt-BR': 'Alterações verificadas' })}
                </strong>
                <p>
                  {copy(locale, {
                    en: 'Confirms which PC received a plan.',
                    'pt-BR': 'Confirma qual PC recebeu um plano.',
                  })}
                </p>
              </div>
            </div>
          </section>
          {projection?.activeDevice ? (
            <dl className="desktop-authority-plan-facts">
              <div>
                <dt>Status</dt>
                <dd>{projection.activeDevice.state}</dd>
              </div>
              <div>
                <dt>{copy(locale, { en: 'Evidence version', 'pt-BR': 'Versão da evidência' })}</dt>
                <dd>v{projection.activeDevice.evidenceVersion}</dd>
              </div>
              <div>
                <dt>{copy(locale, { en: 'Binding', 'pt-BR': 'Vínculo' })}</dt>
                <dd>{projection.activeDevice.deviceBindingId}</dd>
              </div>
            </dl>
          ) : null}
        </div>
      ) : null}
      {view === 'security' ? (
        <div className="desktop-authority-route desktop-authority-route--security">
          <section className="desktop-authority-security-hero">
            <span className="desktop-authority-security-mark">
              <ProductIcon name="shield" size={28} />
            </span>
            <div>
              <span className="desktop-authority-kicker">
                {copy(locale, { en: 'SECURITY POSTURE', 'pt-BR': 'POSTURA DE SEGURANÇA' })}
              </span>
              <h2>{copy(locale, { en: 'Account protected', 'pt-BR': 'Conta protegida' })}</h2>
              <p>
                {copy(locale, {
                  en: 'Session and role information below comes from the identity service.',
                  'pt-BR': 'As informações de sessão e função abaixo vêm do serviço de identidade.',
                })}
              </p>
            </div>
            <span className="desktop-authority-security-state">
              <ProductIcon name="check" size={15} />
              {copy(locale, { en: 'Authenticated', 'pt-BR': 'Autenticada' })}
            </span>
          </section>
          <div className="desktop-authority-security-grid">
            <section className="desktop-authority-section desktop-authority-section--sessions">
              <header>
                <span className="desktop-authority-section__icon">
                  <ProductIcon name="monitor" size={19} />
                </span>
                <div>
                  <h2>{copy(locale, { en: 'Active sessions', 'pt-BR': 'Sessões ativas' })}</h2>
                  <p>
                    {activeSessions.length}{' '}
                    {copy(locale, { en: 'confirmed connection', 'pt-BR': 'conexão confirmada' })}
                    {activeSessions.length === 1 ? '' : 's'}
                  </p>
                </div>
              </header>
              <ul className="desktop-authority-session-list">
                {activeSessions.map((session) => (
                  <li key={session.sessionId}>
                    <span className="desktop-authority-session-icon">
                      <ProductIcon name="monitor" size={18} />
                    </span>
                    <div>
                      <strong>
                        {session.scopes.includes('session-desktop')
                          ? copy(locale, {
                              en: 'Liiiraa Boost desktop',
                              'pt-BR': 'Desktop Liiiraa Boost',
                            })
                          : copy(locale, { en: 'Account browser', 'pt-BR': 'Navegador da conta' })}
                      </strong>
                      <small>
                        {copy(locale, { en: 'Authenticated with', 'pt-BR': 'Autenticado com' })}{' '}
                        {session.authenticationStrength}
                      </small>
                    </div>
                    <time dateTime={session.lastSeenAt}>
                      {formatAuthorityDate(session.lastSeenAt, locale)}
                    </time>
                  </li>
                ))}
              </ul>
            </section>
            <section className="desktop-authority-section desktop-authority-section--methods">
              <header>
                <span className="desktop-authority-section__icon">
                  <ProductIcon name="lock" size={19} />
                </span>
                <div>
                  <h2>
                    {copy(locale, { en: 'Verified methods', 'pt-BR': 'Métodos verificados' })}
                  </h2>
                  <p>
                    {copy(locale, {
                      en: 'No simulated security score.',
                      'pt-BR': 'Sem nota de segurança simulada.',
                    })}
                  </p>
                </div>
              </header>
              {projection?.securityMethods.length ? (
                <ul className="desktop-authority-methods">
                  {projection.securityMethods.map((method) => (
                    <li key={method.methodId}>
                      <ProductIcon name="check" size={15} />
                      <span>
                        <strong>{method.factor}</strong>
                        <small>{copy(locale, { en: 'Verified', 'pt-BR': 'Verificado' })}</small>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="desktop-authority-method-empty">
                  <ProductIcon name="lock" size={20} />
                  <strong>
                    {copy(locale, {
                      en: 'No additional method',
                      'pt-BR': 'Nenhum método adicional',
                    })}
                  </strong>
                  <p>
                    {copy(locale, {
                      en: 'Passkeys and two-factor authentication are not registered yet.',
                      'pt-BR':
                        'Chaves de acesso e autenticação em dois fatores ainda não estão cadastradas.',
                    })}
                  </p>
                </div>
              )}
            </section>
          </div>
          <dl className="desktop-authority-plan-facts">
            <div>
              <dt>
                {copy(locale, { en: 'Current authentication', 'pt-BR': 'Autenticação atual' })}
              </dt>
              <dd>{primarySession?.authenticationStrength ?? '—'}</dd>
            </div>
            <div>
              <dt>
                {copy(locale, { en: 'Administrative role', 'pt-BR': 'Função administrativa' })}
              </dt>
              <dd>
                {administrativeRole
                  ? administrativeRoleLabel(locale, administrativeRole)
                  : copy(locale, { en: 'Standard account', 'pt-BR': 'Conta padrão' })}
              </dd>
            </div>
            <div>
              <dt>{copy(locale, { en: 'Session expires', 'pt-BR': 'Sessão expira' })}</dt>
              <dd>
                {primarySession ? formatAuthorityDate(primarySession.expiresAt, locale) : '—'}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}
      {snapshot.state === 'revoked' ? <LocalSafetyCapabilities locale={locale} /> : null}
      <footer className="desktop-authority-footer">
        <p>
          <ProductIcon name="lock" size={15} />
          {copy(locale, {
            en: 'Account authority: PostgreSQL via secure API',
            'pt-BR': 'Autoridade da conta: PostgreSQL via API segura',
          })}
        </p>
        {desktopAuth === undefined ? null : (
          <LbButton
            onPress={() => {
              void desktopAuth.signOut().then((result) => {
                if (result.status === 'signed-out') {
                  authority.confirmSignedOut();
                  navigate('/login');
                } else {
                  setSignOutFailed(true);
                }
              });
            }}
            variant="secondary"
          >
            {copy(locale, { en: 'Sign out securely', 'pt-BR': 'Sair com segurança' })}
          </LbButton>
        )}
      </footer>
      {signOutFailed ? (
        <p role="alert">
          {copy(locale, {
            en: 'Sign-out could not complete. Your secure session remains protected.',
            'pt-BR': 'Não foi possível sair. Sua sessão segura continua protegida.',
          })}
        </p>
      ) : null}
    </div>
  );
};

const isExplicitSimulatedScenario = (): boolean => {
  const candidate: unknown = Reflect.get(globalThis, '__LIIIRAA_DESKTOP_TEST__');
  if (typeof candidate !== 'object' || candidate === null) return false;
  const scenario: unknown = Reflect.get(candidate, 'scenario');
  return (
    typeof scenario === 'object' &&
    scenario !== null &&
    Reflect.get(scenario, 'marker') === 'SIMULATED SCENARIO'
  );
};

const AccountAuthorityUnavailable = ({ locale }: Readonly<{ locale: ShellLocale }>) => (
  <section className="desktop-account-authority-unavailable" role="alert">
    <ProductIcon name="warning" size={20} />
    <div>
      <h2>
        {copy(locale, {
          en: 'The secure account service is unavailable',
          'pt-BR': 'O serviço seguro da conta está indisponível',
        })}
      </h2>
      <p>
        {copy(locale, {
          en: 'No local profile was substituted. Reopen the app or check your connection to restore the real account.',
          'pt-BR':
            'Nenhum perfil local foi substituído. Reabra o app ou verifique sua conexão para restaurar a conta real.',
        })}
      </p>
    </div>
  </section>
);

export const AccountExperience = ({
  locale,
  navigate,
  scenarioId,
  view,
}: AccountExperienceProps): ReactNode => {
  const [authority] = useState(() => createDesktopAccountAuthority());
  const [desktopAuth] = useState(() => createDesktopAuth());
  const [authoritySnapshot, setAuthoritySnapshot] = useState<
    DesktopAccountAuthoritySnapshot | undefined
  >(() => authority?.snapshot());

  useEffect(() => {
    if (authority === undefined) return undefined;
    const unsubscribe = authority.subscribe(setAuthoritySnapshot);
    authority.start();
    return () => {
      unsubscribe();
    };
  }, [authority]);

  const loginState = resolveDesktopLoginState(authoritySnapshot);

  useEffect(() => {
    if (view === 'login' && loginState === 'authenticated') {
      navigate('/account/overview');
    }
  }, [loginState, navigate, view]);

  if (view === 'login') {
    if (authority !== undefined && loginState !== 'sign-in') {
      return (
        <SessionRestorationSurface
          locale={locale}
          onRetry={() => {
            void authority.synchronize('reconnection');
          }}
          state={loginState === 'unavailable' ? 'unavailable' : 'restoring'}
        />
      );
    }
    return <LoginSurface desktopAuth={desktopAuth} locale={locale} navigate={navigate} />;
  }

  if (authority !== undefined && authoritySnapshot !== undefined) {
    return (
      <AccountShell locale={locale} navigate={navigate} view={view}>
        <AuthoritativeAccountContent
          authority={authority}
          desktopAuth={desktopAuth}
          locale={locale}
          navigate={navigate}
          snapshot={authoritySnapshot}
          view={view}
        />
      </AccountShell>
    );
  }

  if (
    (import.meta.env.DEV || import.meta.env.MODE === 'browser-test') &&
    isExplicitSimulatedScenario()
  ) {
    return (
      <AccountShell locale={locale} navigate={navigate} view={view}>
        {view === 'overview' ? <ProfileOverview locale={locale} navigate={navigate} /> : null}
        {view === 'subscription' ? <SubscriptionView locale={locale} /> : null}
        {view === 'device' ? <DeviceView locale={locale} scenarioId={scenarioId} /> : null}
        {view === 'security' ? <SecurityView locale={locale} /> : null}
      </AccountShell>
    );
  }

  return (
    <AccountShell locale={locale} navigate={navigate} view={view}>
      <AccountAuthorityUnavailable locale={locale} />
    </AccountShell>
  );
};
