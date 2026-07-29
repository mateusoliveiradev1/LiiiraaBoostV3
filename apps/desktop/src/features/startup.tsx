import { LbButton, LbProgress, ProductIcon } from '@liiiraa/design-system';
import type {
  ShellStartupFailureStateJson,
  ShellStartupSplashStateJson,
  ShellStartupStateJson,
  ShellStartupUpdatingStateJson,
} from '@liiiraa/contracts-ts';
import type { ReactNode } from 'react';

import type { ShippingLocale } from '../locales/i18n.js';

type LocalizedCopy = Readonly<Record<ShippingLocale, string>>;

export const STARTUP_PRESENTATION_STEPS = Object.freeze([
  'initializing-webview',
  'loading-local-state',
  'validating-installation',
  'opening-shell',
] as const satisfies readonly ShellStartupSplashStateJson['step'][]);

export interface StartupSurfaceProps {
  readonly firstLaunch?: boolean;
  readonly locale: ShippingLocale;
  readonly onContinue?: () => void;
  readonly onOpenDocumentation?: () => void;
  readonly onOpenSupport?: () => void;
  readonly onRecoveryAction?: (action: ShellStartupFailureStateJson['recoveryAction']) => void;
  readonly state: ShellStartupStateJson;
  readonly version: string;
}

const copy = (locale: ShippingLocale, value: LocalizedCopy): string => value[locale];

const SPLASH_COPY: Readonly<Record<ShellStartupSplashStateJson['step'], LocalizedCopy>> =
  Object.freeze({
    'initializing-webview': {
      'en-US': 'Initializing the local Windows interface',
      'pt-BR': 'Inicializando a interface local do Windows',
    },
    'loading-local-state': {
      'en-US': 'Loading protected local preferences',
      'pt-BR': 'Carregando preferências locais protegidas',
    },
    'validating-installation': {
      'en-US': 'Validating installation identity and compatibility',
      'pt-BR': 'Validando a identidade e a compatibilidade da instalação',
    },
    'opening-shell': {
      'en-US': 'Opening the non-elevated application shell',
      'pt-BR': 'Abrindo a interface do aplicativo sem elevação',
    },
  });

const UPDATE_COPY: Readonly<Record<ShellStartupUpdatingStateJson['step'], LocalizedCopy>> =
  Object.freeze({
    'verifying-signature': {
      'en-US': 'Verifying the signed update identity',
      'pt-BR': 'Verificando a identidade da atualização assinada',
    },
    'installing-update': {
      'en-US': 'Installing the verified update',
      'pt-BR': 'Instalando a atualização verificada',
    },
    'preparing-rollback': {
      'en-US': 'Preparing a safe rollback to the previous version',
      'pt-BR': 'Preparando uma reversão segura para a versão anterior',
    },
  });

const FAILURE_COPY: Readonly<Record<ShellStartupFailureStateJson['reason'], LocalizedCopy>> =
  Object.freeze({
    'missing-webview2': {
      'en-US': 'Microsoft Edge WebView2 is missing. The desktop interface cannot start safely.',
      'pt-BR':
        'O Microsoft Edge WebView2 está ausente. A interface não pode iniciar com segurança.',
    },
    'damaged-installation': {
      'en-US': 'Installation files failed integrity checks. No system action was attempted.',
      'pt-BR':
        'Os arquivos da instalação falharam na verificação de integridade. Nenhuma ação no sistema foi tentada.',
    },
    'incompatible-windows-build': {
      'en-US': 'This Windows build is outside the supported compatibility range.',
      'pt-BR': 'Esta compilação do Windows está fora da faixa de compatibilidade aceita.',
    },
    'local-state-migration-failed': {
      'en-US': 'Local preferences could not be migrated. Existing recovery data remains untouched.',
      'pt-BR':
        'Não foi possível migrar as preferências locais. Os dados de recuperação existentes permanecem intactos.',
    },
    'update-signature-failed': {
      'en-US':
        'The update signature does not match the expected publisher. The update was not opened.',
      'pt-BR':
        'A assinatura da atualização não corresponde ao publicador esperado. A atualização não foi aberta.',
    },
    'internal-startup-error': {
      'en-US':
        'The interface stopped during startup. Safe mode remains available without optimization authority.',
      'pt-BR':
        'A interface parou durante a inicialização. O modo seguro continua disponível sem autoridade de otimização.',
    },
  });

const RECOVERY_ACTION_COPY: Readonly<
  Record<ShellStartupFailureStateJson['recoveryAction'], LocalizedCopy>
> = Object.freeze({
  'install-webview2': {
    'en-US': 'Install WebView2',
    'pt-BR': 'Instalar o WebView2',
  },
  'view-offline-instructions': {
    'en-US': 'View offline instructions',
    'pt-BR': 'Ver instruções offline',
  },
  retry: { 'en-US': 'Try startup again', 'pt-BR': 'Tentar iniciar novamente' },
  rollback: {
    'en-US': 'Return to the previous version',
    'pt-BR': 'Voltar para a versão anterior',
  },
  'open-safe-mode': {
    'en-US': 'Open safe mode',
    'pt-BR': 'Abrir modo seguro',
  },
  exit: { 'en-US': 'Exit interface', 'pt-BR': 'Sair da interface' },
});

const StartupHeader = ({
  firstLaunch,
  locale,
  version,
}: Pick<StartupSurfaceProps, 'firstLaunch' | 'locale' | 'version'>) => (
  <header className="desktop-startup-header">
    <span className="desktop-startup-context">
      {firstLaunch
        ? copy(locale, {
            'en-US': 'First local launch',
            'pt-BR': 'Primeira abertura local',
          })
        : copy(locale, {
            'en-US': 'Local startup',
            'pt-BR': 'Inicialização local',
          })}
    </span>
    <div className="desktop-startup-brand">
      <svg aria-hidden="true" viewBox="0 0 36 28">
        <path d="M2 25.5 10.6 2h7.2l-5.7 15.2h9.2l-7.1 8.3H2Z" />
        <path d="m20.7 7.2 10.3 7-10.3 7 3-3.7 4.8-3.3-4.8-3.3-3-3.7Z" />
      </svg>
      <h1 id="startup-surface-title">
        Liiiraa <strong>Boost</strong>
      </h1>
    </div>
    <p className="desktop-startup-version">
      {copy(locale, { 'en-US': 'Version', 'pt-BR': 'Versão' })} {version}
    </p>
  </header>
);

const StartupTrust = ({ locale }: Pick<StartupSurfaceProps, 'locale'>) => (
  <div
    aria-label={copy(locale, {
      'en-US': 'Startup safety guarantees',
      'pt-BR': 'Garantias de segurança da inicialização',
    })}
    className="desktop-startup-trust"
  >
    <span>
      <ProductIcon name="shield" size={15} />
      {copy(locale, { 'en-US': 'Protected local state', 'pt-BR': 'Estado local protegido' })}
    </span>
    <span>
      <ProductIcon name="lock" size={15} />
      {copy(locale, { 'en-US': 'Non-elevated interface', 'pt-BR': 'Interface sem elevação' })}
    </span>
    <span>
      <ProductIcon name="recovery" size={15} />
      {copy(locale, { 'en-US': 'Recovery preserved', 'pt-BR': 'Recuperação preservada' })}
    </span>
  </div>
);

export const StartupSurface = ({
  firstLaunch = false,
  locale,
  onContinue,
  onOpenDocumentation,
  onOpenSupport,
  onRecoveryAction,
  state,
  version,
}: StartupSurfaceProps): ReactNode => {
  if (state.kind === 'failure') {
    return (
      <main
        aria-labelledby="startup-surface-title"
        aria-live="assertive"
        className="desktop-startup-surface"
        data-lb-region
        data-startup-kind={state.kind}
      >
        <StartupHeader firstLaunch={firstLaunch} locale={locale} version={version} />
        <section aria-labelledby="startup-failure-title" role="alert">
          <h2 id="startup-failure-title">
            {copy(locale, {
              'en-US': 'Startup needs attention',
              'pt-BR': 'A inicialização precisa de atenção',
            })}
          </h2>
          <p>{copy(locale, FAILURE_COPY[state.reason])}</p>
          <p className="desktop-startup-safety">
            {copy(locale, {
              'en-US':
                'The app remains non-elevated. No optimization or privileged change was performed.',
              'pt-BR':
                'O aplicativo permanece sem elevação. Nenhuma otimização ou alteração privilegiada foi executada.',
            })}
          </p>
        </section>
        <StartupTrust locale={locale} />
        <div className="desktop-startup-actions">
          <LbButton
            onPress={() => {
              onRecoveryAction?.(state.recoveryAction);
            }}
            variant="primary"
          >
            {copy(locale, RECOVERY_ACTION_COPY[state.recoveryAction])}
          </LbButton>
          <LbButton
            variant="secondary"
            {...(onOpenDocumentation === undefined ? {} : { onPress: onOpenDocumentation })}
          >
            {copy(locale, {
              'en-US': 'Open startup documentation',
              'pt-BR': 'Abrir documentação de inicialização',
            })}
          </LbButton>
          <LbButton
            variant="quiet"
            {...(onOpenSupport === undefined ? {} : { onPress: onOpenSupport })}
          >
            {copy(locale, {
              'en-US': 'Open support',
              'pt-BR': 'Abrir suporte',
            })}
          </LbButton>
        </div>
      </main>
    );
  }

  const statusCopy =
    state.kind === 'splash'
      ? SPLASH_COPY[state.step]
      : state.kind === 'updating'
        ? UPDATE_COPY[state.step]
        : ({
            'en-US': 'The local interface is ready.',
            'pt-BR': 'A interface local está pronta.',
          } satisfies LocalizedCopy);
  const loadingSteps =
    state.kind === 'splash'
      ? (Object.entries(SPLASH_COPY) as readonly [
          ShellStartupSplashStateJson['step'],
          LocalizedCopy,
        ][])
      : state.kind === 'updating'
        ? (Object.entries(UPDATE_COPY) as readonly [
            ShellStartupUpdatingStateJson['step'],
            LocalizedCopy,
          ][])
        : [];
  const activeLoadingIndex =
    state.kind === 'splash' || state.kind === 'updating'
      ? loadingSteps.findIndex(([step]) => step === state.step)
      : -1;
  return (
    <main
      aria-labelledby="startup-surface-title"
      aria-live="polite"
      className="desktop-startup-surface"
      data-lb-region
      data-startup-kind={state.kind}
    >
      <StartupHeader firstLaunch={firstLaunch} locale={locale} version={version} />
      <section
        aria-labelledby="startup-status-title"
        className={state.kind === 'ready' ? undefined : 'desktop-loading-stage'}
      >
        <h2 id="startup-status-title">{copy(locale, statusCopy)}</h2>
        {state.kind === 'ready' ? (
          <p>
            {copy(locale, {
              'en-US':
                'Continue to the application. System changes still require a separate reviewed workflow.',
              'pt-BR':
                'Continue para o aplicativo. Alterações no sistema ainda exigem um fluxo separado e revisado.',
            })}
          </p>
        ) : (
          <>
            <div aria-hidden="true" className="desktop-loading-visual">
              <span className="desktop-loading-core">
                <ProductIcon name="lightning" size={30} weight="duotone" />
              </span>
              <span className="desktop-loading-orbit" />
              <span className="desktop-loading-orbit desktop-loading-orbit-secondary" />
            </div>
            <div className="desktop-loading-progress">
              <LbProgress
                label={copy(locale, statusCopy)}
                maxValue={loadingSteps.length}
                value={activeLoadingIndex + 1}
              />
            </div>
            <ol className="desktop-loading-steps">
              {loadingSteps.map(([step, label], index) => (
                <li
                  aria-current={index === activeLoadingIndex ? 'step' : undefined}
                  data-state={
                    index < activeLoadingIndex
                      ? 'complete'
                      : index === activeLoadingIndex
                        ? 'active'
                        : 'pending'
                  }
                  key={step}
                >
                  <ProductIcon
                    name={index < activeLoadingIndex ? 'check' : 'loading'}
                    size={15}
                    weight={index === activeLoadingIndex ? 'fill' : 'regular'}
                  />
                  <span>{copy(locale, label)}</span>
                </li>
              ))}
            </ol>
          </>
        )}
      </section>
      <StartupTrust locale={locale} />
      {state.kind === 'ready' ? (
        <div className="desktop-startup-actions">
          <LbButton
            variant="primary"
            {...(onContinue === undefined ? {} : { onPress: onContinue })}
          >
            {copy(locale, {
              'en-US': 'Open Liiiraa Boost',
              'pt-BR': 'Abrir o Liiiraa Boost',
            })}
          </LbButton>
        </div>
      ) : null}
    </main>
  );
};
