import { LbButton, LbTextField, ProductIcon, RouteHeader } from '@liiiraa/design-system';
import { useState, type ReactNode } from 'react';
import type { ShellLocale } from '@liiiraa/feature-shell';

export type AccountExperienceView = 'login' | 'overview' | 'subscription' | 'device' | 'security';

export interface AccountExperienceProps {
  readonly locale: ShellLocale;
  readonly navigate: (pathname: string) => void;
  readonly scenarioId: string;
  readonly view: AccountExperienceView;
}

const copy = (locale: ShellLocale, value: Readonly<{ en: string; 'pt-BR': string }>): string =>
  value[locale];

const LocalPreviewBadge = ({ locale }: { readonly locale: ShellLocale }) => (
  <span className="desktop-preview-badge">
    <ProductIcon name="shield" size={14} />
    {copy(locale, { en: 'Protected local preview', 'pt-BR': 'Prévia local protegida' })}
  </span>
);

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
  locale,
  navigate,
}: Pick<AccountExperienceProps, 'locale' | 'navigate'>) => {
  const [email, setEmail] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [browserBoundary, setBrowserBoundary] = useState(false);
  const validEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(email);

  const continueToBrowserBoundary = (): void => {
    setAttempted(true);
    if (validEmail) {
      setBrowserBoundary(true);
    }
  };

  return (
    <main className="desktop-auth-surface" data-account-view="login">
      <section className="desktop-auth-story" aria-labelledby="desktop-login-story-title">
        <BrandLockup />
        <div className="desktop-auth-story-copy">
          <LocalPreviewBadge locale={locale} />
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
                en: 'No optimization runs from this sign-in preview.',
                'pt-BR': 'Nenhuma otimização é executada nesta prévia de entrada.',
              })}
            </span>
          </li>
        </ul>
        <p className="desktop-auth-footnote">WINDOWS 10/11 · DESKTOP · v0.0.0</p>
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
          <LbButton onPress={continueToBrowserBoundary} variant="primary">
            <ProductIcon name="arrowRight" size={17} />
            {copy(locale, {
              en: 'Continue securely',
              'pt-BR': 'Continuar com segurança',
            })}
          </LbButton>
        </div>

        <div className="desktop-auth-separator">
          <span>
            {copy(locale, { en: 'or preview the product', 'pt-BR': 'ou conheça o produto' })}
          </span>
        </div>

        <LbButton
          onPress={() => {
            navigate('/home');
          }}
          variant="secondary"
        >
          {copy(locale, { en: 'Explore demo mode', 'pt-BR': 'Explorar modo demonstração' })}
        </LbButton>

        {browserBoundary ? (
          <aside className="desktop-auth-boundary" aria-live="polite">
            <ProductIcon name="shield" size={20} />
            <div>
              <strong>
                {copy(locale, {
                  en: 'Secure browser sign-in is prepared',
                  'pt-BR': 'O login seguro pelo navegador está preparado',
                })}
              </strong>
              <p>
                {copy(locale, {
                  en: 'Real authentication arrives with the Phase 4 identity service. Continue with the deterministic local account for now.',
                  'pt-BR':
                    'A autenticação real chega com o serviço de identidade da Fase 4. Por enquanto, continue com a conta local determinística.',
                })}
              </p>
              <LbButton
                onPress={() => {
                  navigate('/account/overview');
                }}
                variant="primary"
              >
                {copy(locale, {
                  en: 'Open local account preview',
                  'pt-BR': 'Abrir prévia da conta local',
                })}
              </LbButton>
            </div>
          </aside>
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

const ProfileOverview = ({
  locale,
  navigate,
}: Pick<AccountExperienceProps, 'locale' | 'navigate'>) => {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('Liiiraa Player');
  const [draftName, setDraftName] = useState(name);

  return (
    <div className="desktop-account-layout">
      <section className="desktop-profile-hero">
        <div className="desktop-profile-avatar" aria-hidden="true">
          LP
        </div>
        <div className="desktop-profile-identity">
          <span className="desktop-profile-eyebrow">
            <ProductIcon name="crown" size={15} />
            PREMIUM · PRÉVIA LOCAL
          </span>
          <h2>{name}</h2>
          <p>player@liiiraaboost.local</p>
        </div>
        <LbButton
          onPress={() => {
            setEditing((current) => !current);
          }}
          variant="secondary"
        >
          <ProductIcon name="profile" size={17} />
          {copy(locale, { en: 'Edit profile', 'pt-BR': 'Editar perfil' })}
        </LbButton>
      </section>

      {editing ? (
        <section className="desktop-account-editor" aria-labelledby="desktop-profile-edit-title">
          <div>
            <h3 id="desktop-profile-edit-title">
              {copy(locale, { en: 'Profile details', 'pt-BR': 'Dados do perfil' })}
            </h3>
            <p>
              {copy(locale, {
                en: 'This edit stays only in the current local preview.',
                'pt-BR': 'Esta edição permanece apenas na prévia local atual.',
              })}
            </p>
          </div>
          <LbTextField
            label={copy(locale, { en: 'Display name', 'pt-BR': 'Nome de exibição' })}
            onChange={setDraftName}
            value={draftName}
          />
          <div className="desktop-inline-actions">
            <LbButton
              onPress={() => {
                if (draftName.trim().length > 1) {
                  setName(draftName.trim());
                  setEditing(false);
                }
              }}
              variant="primary"
            >
              {copy(locale, { en: 'Save locally', 'pt-BR': 'Salvar localmente' })}
            </LbButton>
            <LbButton
              onPress={() => {
                setDraftName(name);
                setEditing(false);
              }}
              variant="quiet"
            >
              {copy(locale, { en: 'Cancel', 'pt-BR': 'Cancelar' })}
            </LbButton>
          </div>
        </section>
      ) : null}

      <section
        className="desktop-account-grid"
        aria-label={copy(locale, { en: 'Account summary', 'pt-BR': 'Resumo da conta' })}
      >
        <article className="desktop-account-summary-card">
          <header>
            <ProductIcon name="crown" size={19} />
            <span>{copy(locale, { en: 'Current plan', 'pt-BR': 'Plano atual' })}</span>
          </header>
          <strong>Premium</strong>
          <p>
            {copy(locale, {
              en: 'All visual capabilities unlocked in this local scenario.',
              'pt-BR': 'Todos os recursos visuais liberados neste cenário local.',
            })}
          </p>
          <LbButton
            onPress={() => {
              navigate('/account/subscription');
            }}
            variant="secondary"
          >
            {copy(locale, { en: 'Manage plan', 'pt-BR': 'Gerenciar plano' })}
          </LbButton>
        </article>
        <article className="desktop-account-summary-card">
          <header>
            <ProductIcon name="device" size={19} />
            <span>{copy(locale, { en: 'Active device', 'pt-BR': 'Dispositivo ativo' })}</span>
          </header>
          <strong>DESKTOP-LR07</strong>
          <p>Windows 11 · 1 de 1 dispositivo</p>
          <LbButton
            onPress={() => {
              navigate('/account/device');
            }}
            variant="secondary"
          >
            {copy(locale, { en: 'View device', 'pt-BR': 'Ver dispositivo' })}
          </LbButton>
        </article>
        <article className="desktop-account-summary-card">
          <header>
            <ProductIcon name="lock" size={19} />
            <span>{copy(locale, { en: 'Account security', 'pt-BR': 'Segurança da conta' })}</span>
          </header>
          <strong>
            {copy(locale, { en: 'Ready to configure', 'pt-BR': 'Pronta para configurar' })}
          </strong>
          <p>
            {copy(locale, {
              en: 'Passkeys and MFA are represented before the identity backend arrives.',
              'pt-BR': 'Passkeys e MFA já estão representados antes da chegada do backend.',
            })}
          </p>
          <LbButton
            onPress={() => {
              navigate('/account/security');
            }}
            variant="secondary"
          >
            {copy(locale, { en: 'Review security', 'pt-BR': 'Revisar segurança' })}
          </LbButton>
        </article>
      </section>

      <section className="desktop-account-footer">
        <div>
          <strong>
            {copy(locale, { en: 'Local account preview', 'pt-BR': 'Prévia local da conta' })}
          </strong>
          <p>
            {copy(locale, {
              en: 'No cloud identity or billing record was created.',
              'pt-BR': 'Nenhuma identidade em nuvem ou cobrança foi criada.',
            })}
          </p>
        </div>
        <LbButton
          onPress={() => {
            navigate('/login');
          }}
          variant="quiet"
        >
          <ProductIcon name="logout" size={17} />
          {copy(locale, { en: 'Return to sign in', 'pt-BR': 'Voltar para o login' })}
        </LbButton>
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
          <span>72</span>
          <small>/100</small>
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

export const AccountExperience = ({
  locale,
  navigate,
  scenarioId,
  view,
}: AccountExperienceProps): ReactNode => {
  if (view === 'login') {
    return <LoginSurface locale={locale} navigate={navigate} />;
  }

  return (
    <AccountShell locale={locale} navigate={navigate} view={view}>
      {view === 'overview' ? <ProfileOverview locale={locale} navigate={navigate} /> : null}
      {view === 'subscription' ? <SubscriptionView locale={locale} /> : null}
      {view === 'device' ? <DeviceView locale={locale} scenarioId={scenarioId} /> : null}
      {view === 'security' ? <SecurityView locale={locale} /> : null}
    </AccountShell>
  );
};
