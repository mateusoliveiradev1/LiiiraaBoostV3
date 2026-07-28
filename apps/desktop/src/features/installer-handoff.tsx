import { LbButton } from '@liiiraa/design-system';
import type {
  ShellInstallerIdentityJson,
  ShellReleaseChannelJson,
} from '@liiiraa/contracts-ts';
import type { ReactNode } from 'react';

import type { ShippingLocale } from '../locales/i18n.js';

type LocalizedCopy = Readonly<Record<ShippingLocale, string>>;

export type InstallerSignatureState =
  | 'trusted-publisher'
  | 'development-self-signed'
  | 'invalid'
  | 'unknown';

export type InstallerUpdateIdentity =
  | 'signed-manifest'
  | 'disabled'
  | 'invalid'
  | 'unknown';

export interface InstallerHandoffProps {
  readonly identity: ShellInstallerIdentityJson;
  readonly locale: ShippingLocale;
  readonly onContinue?: () => void;
  readonly onOpenDocumentation?: () => void;
  readonly onOpenVerification?: () => void;
  readonly signatureState?: InstallerSignatureState;
  readonly updateIdentity?: InstallerUpdateIdentity;
}

const copy = (locale: ShippingLocale, value: LocalizedCopy): string =>
  value[locale];

const CHANNEL_COPY: Readonly<
  Record<ShellReleaseChannelJson, LocalizedCopy>
> = Object.freeze({
  development: {
    'en-US': 'Development channel',
    'pt-BR': 'Canal de desenvolvimento',
  },
  stable: { 'en-US': 'Stable channel', 'pt-BR': 'Canal estável' },
  beta: { 'en-US': 'Beta channel', 'pt-BR': 'Canal beta' },
  experimental: {
    'en-US': 'Experimental channel',
    'pt-BR': 'Canal experimental',
  },
});

const SIGNATURE_COPY: Readonly<
  Record<InstallerSignatureState, LocalizedCopy>
> = Object.freeze({
  'trusted-publisher': {
    'en-US': 'Trusted publisher signature',
    'pt-BR': 'Assinatura de publicador confiável',
  },
  'development-self-signed': {
    'en-US': 'Local self-signed development certificate — no public trust',
    'pt-BR':
      'Certificado local autoassinado de desenvolvimento — sem confiança pública',
  },
  invalid: {
    'en-US': 'Signature is invalid. Continuing is blocked.',
    'pt-BR': 'A assinatura é inválida. Não é possível continuar.',
  },
  unknown: {
    'en-US': 'Publisher signature has not been verified.',
    'pt-BR': 'A assinatura do publicador ainda não foi verificada.',
  },
});

const UPDATE_COPY: Readonly<
  Record<InstallerUpdateIdentity, LocalizedCopy>
> = Object.freeze({
  'signed-manifest': {
    'en-US': 'Signed update manifest matches this publisher',
    'pt-BR': 'A atualização assinada corresponde a este publicador',
  },
  disabled: {
    'en-US': 'Updater disabled for this development build',
    'pt-BR': 'Atualizações automáticas desativadas nesta versão de desenvolvimento',
  },
  invalid: {
    'en-US': 'Update identity is invalid. Updates remain disabled.',
    'pt-BR':
      'A assinatura da atualização é inválida. As atualizações continuam desativadas.',
  },
  unknown: {
    'en-US': 'No signed update identity is available.',
    'pt-BR': 'Nenhuma identidade de atualização assinada está disponível.',
  },
});

const COMPATIBILITY_REASON_COPY = Object.freeze({
  'unsupported-build': {
    'en-US': 'unsupported Windows build',
    'pt-BR': 'versão do Windows sem suporte',
  },
  'unsupported-lifecycle': {
    'en-US': 'unsupported Windows lifecycle',
    'pt-BR': 'ciclo de suporte do Windows encerrado',
  },
} satisfies Readonly<Record<string, LocalizedCopy>>);

const defaultSignatureState = (
  channel: ShellReleaseChannelJson,
): InstallerSignatureState =>
  channel === 'development' ? 'development-self-signed' : 'unknown';

const defaultUpdateIdentity = (
  channel: ShellReleaseChannelJson,
): InstallerUpdateIdentity =>
  channel === 'development' ? 'disabled' : 'unknown';

export const InstallerHandoff = ({
  identity,
  locale,
  onContinue,
  onOpenDocumentation,
  onOpenVerification,
  signatureState = defaultSignatureState(identity.channel),
  updateIdentity = defaultUpdateIdentity(identity.channel),
}: InstallerHandoffProps): ReactNode => {
  const compatibility = identity.windowsCompatibility;
  const canContinue =
    compatibility.kind === 'supported' &&
    (signatureState === 'trusted-publisher' ||
      (identity.channel === 'development' &&
        signatureState === 'development-self-signed')) &&
    updateIdentity !== 'invalid';
  const compatibilityText =
    compatibility.kind === 'supported'
      ? copy(locale, {
          'en-US': `Supported Windows build ${String(compatibility.detectedBuild)} (minimum ${String(compatibility.minimumBuild)})`,
          'pt-BR': `Compilação do Windows compatível ${String(compatibility.detectedBuild)} (mínima ${String(compatibility.minimumBuild)})`,
        })
      : copy(locale, {
          'en-US': `Unsupported Windows build ${String(compatibility.detectedBuild)} (minimum ${String(compatibility.minimumBuild)}; ${compatibility.reason})`,
          'pt-BR': `Windows incompatível: compilação ${String(compatibility.detectedBuild)}. É necessária a compilação ${String(compatibility.minimumBuild)} ou mais recente (${copy(locale, COMPATIBILITY_REASON_COPY[compatibility.reason])}).`,
        });

  return (
    <main
      aria-labelledby="installer-handoff-title"
      className="desktop-installer-handoff"
      data-compatible={String(compatibility.kind === 'supported')}
      data-lb-region
    >
      <header className="desktop-startup-header">
        <span className="desktop-startup-context">
          {copy(locale, CHANNEL_COPY[identity.channel])}
        </span>
        <h1 id="installer-handoff-title">
          {copy(locale, {
            'en-US': 'Verify this installation before first launch',
            'pt-BR': 'Confira a instalação antes de começar',
          })}
        </h1>
        <p>
          {copy(locale, {
            'en-US':
              'Confirm the exact publisher, build, Windows compatibility, and update identity. No optimization has run.',
            'pt-BR':
              'Confirme o publicador exato, a compilação, a compatibilidade do Windows e a identidade de atualização. Nenhuma otimização foi executada.',
          })}
        </p>
      </header>

      <dl className="desktop-installer-details">
        <div>
          <dt>{copy(locale, { 'en-US': 'Publisher', 'pt-BR': 'Publicador' })}</dt>
          <dd>{identity.publisher}</dd>
        </div>
        <div>
          <dt>{copy(locale, { 'en-US': 'Version', 'pt-BR': 'Versão' })}</dt>
          <dd>{identity.version}</dd>
        </div>
        <div>
          <dt>{copy(locale, { 'en-US': 'Channel', 'pt-BR': 'Canal' })}</dt>
          <dd>{copy(locale, CHANNEL_COPY[identity.channel])}</dd>
        </div>
        <div>
          <dt>
            {copy(locale, {
              'en-US': 'Windows compatibility',
              'pt-BR': 'Compatibilidade do Windows',
            })}
          </dt>
          <dd data-status={compatibility.kind}>{compatibilityText}</dd>
        </div>
        <div>
          <dt>
            {copy(locale, {
              'en-US': 'Publisher signature',
              'pt-BR': 'Assinatura do publicador',
            })}
          </dt>
          <dd data-status={signatureState}>
            {copy(locale, SIGNATURE_COPY[signatureState])}
          </dd>
        </div>
        <div>
          <dt>
            {copy(locale, {
              'en-US': 'Update identity',
              'pt-BR': 'Identidade de atualização',
            })}
          </dt>
          <dd data-status={updateIdentity}>
            {copy(locale, UPDATE_COPY[updateIdentity])}
          </dd>
        </div>
      </dl>

      <p aria-live="polite" className="desktop-startup-decision">
        {canContinue
          ? copy(locale, {
              'en-US':
                'This identity is acceptable for the current channel. Continue to local startup.',
              'pt-BR':
                'Esta identidade é aceitável para o canal atual. Continue para a inicialização local.',
            })
          : copy(locale, {
              'en-US':
                'Safe continuation is blocked until identity and compatibility checks pass.',
              'pt-BR':
                'A continuação segura está bloqueada até que as verificações de identidade e compatibilidade sejam aprovadas.',
            })}
      </p>

      <div className="desktop-startup-actions">
        <LbButton
          isDisabled={!canContinue}
          variant="primary"
          {...(onContinue === undefined ? {} : { onPress: onContinue })}
        >
          {copy(locale, {
            'en-US': 'Continue to first launch',
            'pt-BR': 'Continuar para a primeira abertura',
          })}
        </LbButton>
        <LbButton
          variant="secondary"
          {...(onOpenVerification === undefined
            ? {}
            : { onPress: onOpenVerification })}
        >
          {copy(locale, {
            'en-US': 'Review verification path',
            'pt-BR': 'Revisar caminho de verificação',
          })}
        </LbButton>
        <LbButton
          variant="quiet"
          {...(onOpenDocumentation === undefined
            ? {}
            : { onPress: onOpenDocumentation })}
        >
          {copy(locale, {
            'en-US': 'Open compatibility documentation',
            'pt-BR': 'Abrir documentação de compatibilidade',
          })}
        </LbButton>
      </div>
    </main>
  );
};
