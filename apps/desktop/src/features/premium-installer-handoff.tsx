import { LbButton, ProductIcon } from '@liiiraa/design-system';
import type { ShellInstallerIdentityJson } from '@liiiraa/contracts-ts';
import { useRef, type ReactNode } from 'react';

import type { ShippingLocale } from '../locales/i18n.js';
import type { InstallerSignatureState, InstallerUpdateIdentity } from './installer-handoff.js';

type LocalizedCopy = Readonly<Record<ShippingLocale, string>>;

export interface PremiumInstallerHandoffProps {
  readonly identity: ShellInstallerIdentityJson;
  readonly locale: ShippingLocale;
  readonly onContinue?: () => void;
  readonly onOpenDocumentation?: () => void;
  readonly onOpenVerification?: () => void;
  readonly signatureState?: InstallerSignatureState;
  readonly updateIdentity?: InstallerUpdateIdentity;
}

const copy = (locale: ShippingLocale, value: LocalizedCopy): string => value[locale];

const BrandLockup = () => (
  <div className="desktop-first-run-brand" aria-label="Liiiraa Boost">
    <svg aria-hidden="true" viewBox="0 0 36 28">
      <path d="M2 25.5 10.6 2h7.2l-5.7 15.2h9.2l-7.1 8.3H2Z" />
      <path d="m20.7 7.2 10.3 7-10.3 7 3-3.7 4.8-3.3-4.8-3.3-3-3.7Z" />
    </svg>
    <span>
      Liiiraa <strong>Boost</strong>
    </span>
  </div>
);

export const PremiumInstallerHandoff = ({
  identity,
  locale,
  onContinue,
  onOpenDocumentation,
  onOpenVerification,
  signatureState = identity.channel === 'development' ? 'development-self-signed' : 'unknown',
  updateIdentity = identity.channel === 'development' ? 'disabled' : 'unknown',
}: PremiumInstallerHandoffProps): ReactNode => {
  const technicalRef = useRef<HTMLDetailsElement>(null);
  const compatibility = identity.windowsCompatibility;
  const compatible = compatibility.kind === 'supported';
  const identityAccepted =
    signatureState === 'trusted-publisher' ||
    (identity.channel === 'development' && signatureState === 'development-self-signed');
  const canContinue = compatible && identityAccepted && updateIdentity !== 'invalid';

  return (
    <main
      aria-labelledby="premium-installer-title"
      className="desktop-premium-first-run"
      data-compatible={String(compatible)}
      data-lb-region
    >
      <section className="desktop-first-run-intro">
        <BrandLockup />
        <div className="desktop-first-run-copy">
          <span className="desktop-preview-badge">
            <ProductIcon name="check" size={14} />
            {copy(locale, {
              'en-US': 'Installation complete',
              'pt-BR': 'Instalação concluída',
            })}
          </span>
          <h1 id="premium-installer-title">
            {copy(locale, {
              'en-US': 'Everything is ready for your first session.',
              'pt-BR': 'Tudo pronto para sua primeira sessão.',
            })}
          </h1>
          <p>
            {copy(locale, {
              'en-US':
                'Liiiraa Boost will start in protected local mode. You stay in control before any future system change.',
              'pt-BR':
                'O Liiiraa Boost iniciará em modo local protegido. Você mantém o controle antes de qualquer futura alteração no sistema.',
            })}
          </p>
        </div>

        <div className="desktop-first-run-promise">
          <ProductIcon name="shield" size={21} />
          <div>
            <strong>
              {copy(locale, {
                'en-US': 'No optimization has run',
                'pt-BR': 'Nenhuma otimização foi executada',
              })}
            </strong>
            <p>
              {copy(locale, {
                'en-US':
                  'The interface opens without elevated privileges. Every action remains reviewable and reversible.',
                'pt-BR':
                  'A interface abre sem privilégios elevados. Cada ação permanece revisável e reversível.',
              })}
            </p>
          </div>
        </div>

        <span className="desktop-first-run-version">
          {`WINDOWS 10/11 · ${identity.version} · ${identity.channel.toUpperCase()}`}
        </span>
      </section>

      <section aria-labelledby="premium-checkpoint-title" className="desktop-first-run-checkpoint">
        <header>
          <div className="desktop-first-run-check-icon">
            <ProductIcon name={canContinue ? 'check' : 'shield'} size={24} />
          </div>
          <div>
            <span>
              {copy(locale, {
                'en-US': 'Protected startup',
                'pt-BR': 'Inicialização protegida',
              })}
            </span>
            <h2 id="premium-checkpoint-title">
              {canContinue
                ? copy(locale, {
                    'en-US': 'Installation verified',
                    'pt-BR': 'Instalação verificada',
                  })
                : copy(locale, {
                    'en-US': 'Verification needs attention',
                    'pt-BR': 'A verificação precisa de atenção',
                  })}
            </h2>
          </div>
        </header>

        <div className="desktop-first-run-status">
          <article data-status={compatible ? 'ready' : 'blocked'}>
            <ProductIcon name="monitor" size={18} />
            <div>
              <span>{copy(locale, { 'en-US': 'Windows', 'pt-BR': 'Windows' })}</span>
              <strong>
                {compatible
                  ? copy(locale, { 'en-US': 'Compatible', 'pt-BR': 'Compatível' })
                  : copy(locale, { 'en-US': 'Unsupported', 'pt-BR': 'Incompatível' })}
              </strong>
            </div>
            <small>{String(compatibility.detectedBuild)}</small>
          </article>
          <article data-status={identityAccepted ? 'ready' : 'blocked'}>
            <ProductIcon name="shield" size={18} />
            <div>
              <span>
                {copy(locale, { 'en-US': 'Application identity', 'pt-BR': 'Identidade do app' })}
              </span>
              <strong>
                {identityAccepted
                  ? copy(locale, { 'en-US': 'Validated', 'pt-BR': 'Validada' })
                  : copy(locale, { 'en-US': 'Review required', 'pt-BR': 'Exige revisão' })}
              </strong>
            </div>
            <small>{identity.publisher}</small>
          </article>
          <article data-status="ready">
            <ProductIcon name="lock" size={18} />
            <div>
              <span>
                {copy(locale, { 'en-US': 'Privilege model', 'pt-BR': 'Modelo de privilégio' })}
              </span>
              <strong>{copy(locale, { 'en-US': 'Protected', 'pt-BR': 'Protegido' })}</strong>
            </div>
            <small>
              {copy(locale, { 'en-US': 'Non-elevated UI', 'pt-BR': 'Interface sem elevação' })}
            </small>
          </article>
        </div>

        <p aria-live="polite" className="desktop-first-run-decision">
          {canContinue
            ? copy(locale, {
                'en-US': 'Your protected local workspace is ready.',
                'pt-BR': 'Seu ambiente local protegido está pronto.',
              })
            : copy(locale, {
                'en-US': 'Continue is blocked until the verification passes.',
                'pt-BR': 'A continuação está bloqueada até a verificação ser aprovada.',
              })}
        </p>

        <div className="desktop-first-run-actions">
          <LbButton
            isDisabled={!canContinue}
            variant="primary"
            {...(onContinue === undefined ? {} : { onPress: onContinue })}
          >
            <ProductIcon name="arrowRight" size={17} />
            {copy(locale, {
              'en-US': 'Enter Liiiraa Boost',
              'pt-BR': 'Entrar no Liiiraa Boost',
            })}
          </LbButton>
          <LbButton
            onPress={() => {
              const technical = technicalRef.current;
              if (technical !== null) {
                technical.open = true;
                technical.scrollIntoView({
                  behavior:
                    document.documentElement.dataset['motion'] === 'reduced' ? 'auto' : 'smooth',
                  block: 'nearest',
                });
                technical.querySelector('summary')?.focus();
              }
              onOpenVerification?.();
            }}
            variant="secondary"
          >
            {copy(locale, {
              'en-US': 'Review verification',
              'pt-BR': 'Revisar verificação',
            })}
          </LbButton>
        </div>

        <details className="desktop-first-run-technical" ref={technicalRef}>
          <summary>
            {copy(locale, {
              'en-US': 'Technical installation details',
              'pt-BR': 'Detalhes técnicos da instalação',
            })}
          </summary>
          <dl>
            <div>
              <dt>{copy(locale, { 'en-US': 'Publisher', 'pt-BR': 'Publicador' })}</dt>
              <dd>{identity.publisher}</dd>
            </div>
            <div>
              <dt>{copy(locale, { 'en-US': 'Version', 'pt-BR': 'Versão' })}</dt>
              <dd>{identity.version}</dd>
            </div>
            <div>
              <dt>{copy(locale, { 'en-US': 'Minimum build', 'pt-BR': 'Build mínima' })}</dt>
              <dd>{String(compatibility.minimumBuild)}</dd>
            </div>
          </dl>
          {onOpenDocumentation ? (
            <LbButton onPress={onOpenDocumentation} variant="quiet">
              {copy(locale, {
                'en-US': 'Open compatibility documentation',
                'pt-BR': 'Abrir documentação de compatibilidade',
              })}
            </LbButton>
          ) : null}
        </details>
      </section>
    </main>
  );
};
