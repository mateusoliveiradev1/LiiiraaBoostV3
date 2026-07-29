import {
  LbButton,
  LbCheckbox,
  LbSelect,
  LbSwitch,
  LbTextField,
  ProductIcon,
  RouteHeader,
  ScenarioMarker,
  StatusSignal,
  SystemStateLedger,
} from '@liiiraa/design-system';
import { useState, type ReactNode } from 'react';

import {
  DEFAULT_CONNECTED_CONSENT,
  type ConnectedConsent,
  type ConnectedConsentKey,
} from '../model/calibration.js';
import { createPhaseBoundaryExplanation } from '../model/interaction-policy.js';
import type { ShellLocale } from './calibration.js';

export const ACCOUNT_STATES = Object.freeze([
  'signed-out',
  'signed-in',
  'session-expired',
  'offline',
] as const);
export type AccountState = (typeof ACCOUNT_STATES)[number];

export const ENTITLEMENT_STATES = Object.freeze([
  'free',
  'premium-active',
  'offline-window',
  'grace-warning',
  'expired',
  'device-cooldown',
] as const);
export type EntitlementState = (typeof ENTITLEMENT_STATES)[number];

export const SUPPORT_STATES = Object.freeze([
  'preview',
  'redacted',
  'consent',
  'encrypted-preview',
  'upload-boundary',
  'expiry-preview',
] as const);
export type SupportState = (typeof SUPPORT_STATES)[number];

export const UPDATE_STATES = Object.freeze([
  'current',
  'available',
  'signature-failure',
  'safe-continuation',
] as const);
export type UpdateState = (typeof UPDATE_STATES)[number];

const PSEUDO_CHARACTER_MAP: Readonly<Record<string, string>> = Object.freeze({
  a: 'á',
  e: 'ë',
  i: 'ï',
  o: 'ô',
  u: 'ü',
  A: 'Á',
  E: 'Ë',
  I: 'Ï',
  O: 'Ô',
  U: 'Ü',
});

export const pseudoLocalizeFutureCopy = (value: string): string =>
  `［${Array.from(value, (character) => PSEUDO_CHARACTER_MAP[character] ?? character).join('')} ···］`;

const accountCopy = (
  state: AccountState,
  locale: ShellLocale,
): Readonly<{ detail: string; title: string }> => {
  const copy: Readonly<Record<AccountState, Readonly<{ en: string; 'pt-BR': string }>>> = {
    'signed-out': {
      en: 'Signed out. Authentication can only continue in the system browser.',
      'pt-BR': 'Sessão encerrada. A autenticação só pode continuar no navegador do sistema.',
    },
    'signed-in': {
      en: 'Signed-in demonstration fixture. No real account session is claimed.',
      'pt-BR': 'Fixture de sessão iniciada. Nenhuma sessão real de conta é declarada.',
    },
    'session-expired': {
      en: 'Session expired. Local recovery, warnings, and history remain available.',
      'pt-BR': 'Sessão expirada. Recuperação, alertas e histórico locais continuam disponíveis.',
    },
    offline: {
      en: 'Offline. Existing local entitlement evidence is shown with its expiry.',
      'pt-BR': 'Offline. A evidência local de assinatura mostra sua validade.',
    },
  };
  return {
    detail: copy[state][locale],
    title: locale === 'pt-BR' ? 'Conta' : 'Account',
  };
};

export interface AccountSurfaceProps {
  readonly locale: ShellLocale;
  readonly scenarioId: string;
  readonly state?: AccountState;
}

export const AccountSurface = ({
  locale,
  scenarioId,
  state = 'signed-out',
}: AccountSurfaceProps) => {
  const [email, setEmail] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [boundaryVisible, setBoundaryVisible] = useState(false);
  const validEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(email);
  const copy = accountCopy(state, locale);
  const boundary = createPhaseBoundaryExplanation({
    availableScenarioId: scenarioId,
    capability: 'System-browser authentication callback',
    locale: locale === 'pt-BR' ? 'pt-BR' : 'en-US',
    owningPhase: 'Phase 4',
  });

  return (
    <main data-account-state={state}>
      <RouteHeader purpose={copy.detail} title={copy.title} />
      <ScenarioMarker scenarioId={scenarioId} />
      <LbTextField
        errorMessage={
          attempted && !validEmail
            ? locale === 'pt-BR'
              ? 'Informe um e-mail válido.'
              : 'Enter a valid email.'
            : undefined
        }
        label={locale === 'pt-BR' ? 'E-mail da conta' : 'Account email'}
        onChange={setEmail}
        value={email}
      />
      <LbButton
        onPress={() => {
          setAttempted(true);
          if (validEmail) setBoundaryVisible(true);
        }}
        variant="primary"
      >
        {locale === 'pt-BR' ? 'Continuar no navegador do sistema' : 'Continue in system browser'}
      </LbButton>
      {boundaryVisible ? (
        <PhaseBoundaryNotice
          capability={boundary.capability}
          locale={locale}
          owningPhase={boundary.owningPhase}
          scenarioId={boundary.availableScenarioId}
        />
      ) : null}
    </main>
  );
};

const ENTITLEMENT_COPY: Readonly<
  Record<EntitlementState, Readonly<{ en: string; 'pt-BR': string }>>
> = Object.freeze({
  free: {
    en: 'Free plan fixture. Premium previews remain review-only.',
    'pt-BR': 'Fixture do plano Free. Prévias Premium seguem somente para revisão.',
  },
  'premium-active': {
    en: 'Premium fixture active. This is not a billing confirmation.',
    'pt-BR': 'Fixture Premium ativa. Isto não é confirmação de cobrança.',
  },
  'offline-window': {
    en: 'Offline day 3 of 7. Local Premium functions remain available.',
    'pt-BR': 'Offline: dia 3 de 7. Funções Premium locais seguem disponíveis.',
  },
  'grace-warning': {
    en: 'Offline entitlement approaches expiry; reconnect before day 7.',
    'pt-BR': 'A assinatura offline se aproxima da expiração; reconecte antes do dia 7.',
  },
  expired: {
    en: 'Premium actions blocked. History, warnings, diagnostics, and recovery remain available.',
    'pt-BR':
      'Ações Premium bloqueadas. Histórico, alertas, diagnósticos e recuperação continuam disponíveis.',
  },
  'device-cooldown': {
    en: 'Device reset is inside the 30-day cooldown. No device was changed.',
    'pt-BR': 'A redefinição está no intervalo de 30 dias. Nenhum dispositivo foi alterado.',
  },
});

export interface EntitlementSurfaceProps {
  readonly locale: ShellLocale;
  readonly scenarioId: string;
  readonly state: EntitlementState;
}

export const EntitlementSurface = ({ locale, scenarioId, state }: EntitlementSurfaceProps) => (
  <section aria-labelledby="entitlement-title" data-entitlement-state={state} data-lb-region>
    <h2 id="entitlement-title">
      {locale === 'pt-BR' ? 'Assinatura e dispositivo' : 'Subscription and device'}
    </h2>
    <ScenarioMarker scenarioId={scenarioId} />
    <StatusSignal
      detail={ENTITLEMENT_COPY[state][locale]}
      locale={locale}
      state={
        state === 'expired'
          ? 'expired-entitlement'
          : state === 'grace-warning' || state === 'device-cooldown'
            ? 'stale-evidence'
            : 'fixture'
      }
    />
    <dl>
      <div>
        <dt>{locale === 'pt-BR' ? 'Dispositivo ativo' : 'Active device'}</dt>
        <dd>DEMO-PC-S12 · 1 / 1</dd>
      </div>
      <div>
        <dt>{locale === 'pt-BR' ? 'Faturas' : 'Invoices'}</dt>
        <dd>
          {locale === 'pt-BR'
            ? 'Prévia indisponível sem conta real'
            : 'Preview unavailable without real account'}
        </dd>
      </div>
    </dl>
    <PhaseBoundaryNotice
      capability={
        locale === 'pt-BR' ? 'Cobrança e redefinição de dispositivo' : 'Billing and device reset'
      }
      locale={locale}
      owningPhase="Phase 4"
      scenarioId={scenarioId}
    />
  </section>
);

const consentLabel = (key: ConnectedConsentKey, locale: ShellLocale): string => {
  const labels: Readonly<Record<ConnectedConsentKey, Readonly<{ en: string; 'pt-BR': string }>>> = {
    telemetry: { en: 'Connected telemetry', 'pt-BR': 'Telemetria conectada' },
    cloudAi: { en: 'Cloud AI', 'pt-BR': 'IA em nuvem' },
    diagnosticSharing: {
      en: 'Diagnostic sharing',
      'pt-BR': 'Compartilhamento de diagnósticos',
    },
  };
  return labels[key][locale];
};

export interface SettingsSurfaceProps {
  readonly children?: ReactNode;
  readonly locale: ShellLocale;
  readonly scenarioId: string;
}

export const SettingsSurface = ({ children, locale, scenarioId }: SettingsSurfaceProps) => {
  const [consents, setConsents] = useState<ConnectedConsent>(DEFAULT_CONNECTED_CONSENT);
  const [scale, setScale] = useState('100');
  const [density, setDensity] = useState('comfortable');
  const [motion, setMotion] = useState('system');

  return (
    <main
      className="lb-settings-surface"
      data-cloud-ai={String(consents.cloudAi)}
      data-diagnostic-sharing={String(consents.diagnosticSharing)}
      data-forced-colors-ready="true"
      data-interface-scales="100,112.5,125,150"
      data-reduced-motion-ready="true"
      data-telemetry={String(consents.telemetry)}
    >
      <RouteHeader
        purpose={
          locale === 'pt-BR'
            ? 'Preferências locais e consentimentos conectados independentes.'
            : 'Local preferences and independent connected consents.'
        }
        title={locale === 'pt-BR' ? 'Configurações' : 'Settings'}
      />
      <ScenarioMarker scenarioId={scenarioId} />
      <div className="lb-settings-grid">
        <section
          aria-labelledby="connected-consent-title"
          className="lb-settings-panel lb-settings-consent"
          data-lb-region
        >
          <h2 id="connected-consent-title">
            <ProductIcon name="shield" size={20} />
            <span>{locale === 'pt-BR' ? 'Privacidade e conexão' : 'Privacy and connection'}</span>
          </h2>
          <p>
            {locale === 'pt-BR'
              ? 'Cada opção começa desligada e precisa ser escolhida separadamente.'
              : 'Each option starts off and must be selected separately.'}
          </p>
          {(
            [
              'telemetry',
              'cloudAi',
              'diagnosticSharing',
            ] as const satisfies readonly ConnectedConsentKey[]
          ).map((key) => (
            <LbSwitch
              isSelected={consents[key]}
              key={key}
              onChange={(selected) => {
                setConsents((current) => ({ ...current, [key]: selected }));
              }}
            >
              {consentLabel(key, locale)}
            </LbSwitch>
          ))}
        </section>
        <section
          aria-labelledby="appearance-title"
          className="lb-settings-panel lb-settings-appearance"
          data-lb-region
        >
          <h2 id="appearance-title">
            <ProductIcon name="sliders" size={20} />
            <span>{locale === 'pt-BR' ? 'Aparência e acesso' : 'Appearance and access'}</span>
          </h2>
          <LbSelect
            label={locale === 'pt-BR' ? 'Escala da interface' : 'Interface scale'}
            onSelectionChange={(key) => {
              if (key !== null) setScale(String(key));
            }}
            options={[
              { id: '100', label: '100%' },
              { id: '112.5', label: '112.5%' },
              { id: '125', label: '125%' },
              { id: '150', label: '150%' },
            ]}
            selectedKey={scale}
          />
          <LbSelect
            label={locale === 'pt-BR' ? 'Densidade' : 'Density'}
            onSelectionChange={(key) => {
              if (key !== null) setDensity(String(key));
            }}
            options={[
              { id: 'comfortable', label: locale === 'pt-BR' ? 'Confortável' : 'Comfortable' },
              { id: 'compact', label: locale === 'pt-BR' ? 'Compacta' : 'Compact' },
            ]}
            selectedKey={density}
          />
          <LbSelect
            label={locale === 'pt-BR' ? 'Movimento' : 'Motion'}
            onSelectionChange={(key) => {
              if (key !== null) setMotion(String(key));
            }}
            options={[
              { id: 'system', label: locale === 'pt-BR' ? 'Sistema' : 'System' },
              { id: 'reduced', label: locale === 'pt-BR' ? 'Reduzido' : 'Reduced' },
              { id: 'responsive', label: locale === 'pt-BR' ? 'Responsivo' : 'Responsive' },
            ]}
            selectedKey={motion}
          />
        </section>
      </div>
      {children ? <section className="lb-settings-extensions">{children}</section> : null}
    </main>
  );
};

const nextSupportState = (state: SupportState): SupportState => {
  const index = SUPPORT_STATES.indexOf(state);
  return SUPPORT_STATES[Math.min(index + 1, SUPPORT_STATES.length - 1)] ?? state;
};

export interface SupportPackagePreviewProps {
  readonly locale: ShellLocale;
  readonly scenarioId: string;
  readonly state?: SupportState;
}

export const SupportPackagePreview = ({
  locale,
  scenarioId,
  state,
}: SupportPackagePreviewProps) => {
  const [internalState, setInternalState] = useState<SupportState>('preview');
  const [consented, setConsented] = useState(false);
  const activeState = state ?? internalState;

  return (
    <section aria-labelledby="support-title" data-lb-region data-support-state={activeState}>
      <h2 id="support-title">
        {locale === 'pt-BR' ? 'Pacote seguro de suporte' : 'Secure support package'}
      </h2>
      <ScenarioMarker scenarioId={scenarioId} />
      <table>
        <caption>{locale === 'pt-BR' ? 'Prévia de redação' : 'Redaction preview'}</caption>
        <tbody>
          <tr>
            <th scope="row">Windows user</th>
            <td data-redacted="true">[REDACTED]</td>
          </tr>
          <tr>
            <th scope="row">Hardware identifier</th>
            <td data-redacted="true">GPU-…-91A2</td>
          </tr>
          <tr>
            <th scope="row">Scenario diagnostic</th>
            <td>S20-SYNTHETIC-DIAGNOSTIC</td>
          </tr>
        </tbody>
      </table>
      {activeState === 'consent' ? (
        <LbCheckbox isSelected={consented} onChange={setConsented}>
          {locale === 'pt-BR'
            ? 'Concordo com esta seleção redigida'
            : 'I consent to this redacted selection'}
        </LbCheckbox>
      ) : null}
      {activeState === 'encrypted-preview' ? (
        <p>
          {locale === 'pt-BR'
            ? 'Prévia de criptografia local pronta; nenhum arquivo foi enviado.'
            : 'Local encryption preview ready; no file was uploaded.'}
        </p>
      ) : null}
      {activeState === 'upload-boundary' ? (
        <PhaseBoundaryNotice
          capability={locale === 'pt-BR' ? 'Envio do pacote de suporte' : 'Support package upload'}
          locale={locale}
          owningPhase="Phase 4"
          scenarioId={scenarioId}
        />
      ) : null}
      {activeState === 'expiry-preview' ? (
        <p>
          {locale === 'pt-BR'
            ? 'Expiração prevista: 7 dias após um envio futuro confirmado.'
            : 'Preview expiry: 7 days after a future confirmed upload.'}
        </p>
      ) : null}
      {activeState !== 'expiry-preview' ? (
        <LbButton
          isDisabled={activeState === 'consent' && !consented}
          onPress={() => {
            setInternalState(nextSupportState(activeState));
          }}
          variant="primary"
        >
          {locale === 'pt-BR' ? 'Continuar prévia segura' : 'Continue secure preview'}
        </LbButton>
      ) : null}
    </section>
  );
};

export interface UpdateSurfaceProps {
  readonly locale: ShellLocale;
  readonly scenarioId: string;
  readonly state?: UpdateState;
}

export const UpdateSurface = ({ locale, scenarioId, state }: UpdateSurfaceProps) => {
  const [internalState, setInternalState] = useState<UpdateState>('current');
  const activeState = state ?? internalState;

  return (
    <section aria-labelledby="update-title" data-lb-region data-update-state={activeState}>
      <h2 id="update-title">{locale === 'pt-BR' ? 'Atualizações' : 'Updates'}</h2>
      <ScenarioMarker scenarioId={scenarioId} />
      {activeState === 'signature-failure' ? (
        <div aria-live="assertive" role="alert">
          <StatusSignal
            detail={
              locale === 'pt-BR'
                ? 'Assinatura inválida. A atualização foi bloqueada; a versão atual continua segura.'
                : 'Invalid signature. Update blocked; the current version continues safely.'
            }
            locale={locale}
            state="contradictory-evidence"
          />
          <code>S21-UPDATE-SIGNATURE-INVALID</code>
        </div>
      ) : (
        <StatusSignal
          detail={
            activeState === 'available'
              ? locale === 'pt-BR'
                ? 'Manifesto de atualização sintético disponível para revisão.'
                : 'Synthetic update manifest available for review.'
              : locale === 'pt-BR'
                ? 'A versão atual continua em uso.'
                : 'The current version remains in use.'
          }
          locale={locale}
          state="fixture"
        />
      )}
      <LbButton
        onPress={() => {
          setInternalState('safe-continuation');
        }}
        variant="primary"
      >
        {locale === 'pt-BR' ? 'Continuar com a versão atual' : 'Continue current version'}
      </LbButton>
    </section>
  );
};

export interface DocumentationSurfaceProps {
  readonly documentId: string;
  readonly locale: ShellLocale;
  readonly scenarioId: string;
}

export const DocumentationSurface = ({
  documentId,
  locale,
  scenarioId,
}: DocumentationSurfaceProps) => (
  <article data-document-id={documentId} data-lb-region>
    <RouteHeader
      purpose={
        locale === 'pt-BR'
          ? 'Documentação local, contextual e versionada.'
          : 'Local, contextual, versioned documentation.'
      }
      title={locale === 'pt-BR' ? 'Documentação' : 'Documentation'}
    />
    <ScenarioMarker scenarioId={scenarioId} />
    <p>
      {locale === 'pt-BR'
        ? `Documento ${documentId} · versão 1 · demonstração sem autoridade remota.`
        : `Document ${documentId} · version 1 · demonstration without remote authority.`}
    </p>
  </article>
);

export interface PhaseBoundaryNoticeProps {
  readonly capability: string;
  readonly children?: ReactNode;
  readonly locale: ShellLocale;
  readonly owningPhase: string;
  readonly scenarioId: string;
}

export const PhaseBoundaryNotice = ({
  capability,
  children,
  locale,
  owningPhase,
  scenarioId,
}: PhaseBoundaryNoticeProps) => (
  <aside aria-label="Phase boundary" data-boundary-kind="phase-boundary">
    <h2>{capability}</h2>
    <p>
      {locale === 'pt-BR'
        ? `${capability} não está disponível nesta fase. ${owningPhase} é responsável pela capacidade real. Nenhum sucesso remoto ocorreu.`
        : `${capability} is unavailable in this phase. ${owningPhase} owns the real capability. No remote success occurred.`}
    </p>
    <p>
      {locale === 'pt-BR'
        ? `Demonstração: ${scenarioId} · documentação contextual disponível.`
        : `Demonstration: ${scenarioId} · contextual documentation available.`}
    </p>
    {children}
  </aside>
);

export interface AccountSettingsSurfaceProps {
  readonly locale: ShellLocale;
  readonly scenarioId: string;
}

export const AccountSettingsSurface = ({ locale, scenarioId }: AccountSettingsSurfaceProps) => (
  <main>
    <AccountSurface locale={locale} scenarioId={scenarioId} />
    <EntitlementSurface locale={locale} scenarioId={scenarioId} state="offline-window" />
    <SettingsSurface locale={locale} scenarioId={scenarioId} />
    <SupportPackagePreview locale={locale} scenarioId={scenarioId} />
    <UpdateSurface locale={locale} scenarioId={scenarioId} state="current" />
    <DocumentationSurface
      documentId="privacy-connected-processing"
      locale={locale}
      scenarioId={scenarioId}
    />
    <SystemStateLedger
      entries={[
        {
          detail: 'All remote-effect adapters are absent in Phase 2.',
          id: 'remote-boundary',
          label: 'Remote authority',
          state: 'unsupported',
        },
      ]}
    />
  </main>
);
