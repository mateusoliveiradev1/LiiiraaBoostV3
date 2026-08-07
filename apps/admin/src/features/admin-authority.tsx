'use client';

import type {
  AdminEnvironmentKindJson,
  AdminRoleJson,
  AuditEventJson,
  AuthorityReceiptJson,
} from '@liiiraa/contracts-ts';
import { LbButton, LbCheckbox, LbTextField, ProductIcon } from '@liiiraa/design-system';
import type { WebLocale } from '@liiiraa/web-core';
import type { Route } from 'next';
import Link from 'next/link';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  type SyntheticEvent,
} from 'react';

import {
  createAdminAuthority,
  type AdminAuthority,
  type AdminDiagnosticProjection,
  type AdminMutationInput,
  type AdminProjectionCollection,
  type AdminProjectionRecord,
  type AdminQueryFamily,
  type AdminQueryResult,
  type AdminSessionProjection,
  type AdminStepUp,
  type AdminTotpEnrollment,
} from '../admin-authority';
import { AdminFocusHandoff } from '../admin-focus-handoff';
import { AdminNavigation } from '../admin-navigation';
import { ProductLockup } from '../admin-product-lockup';
import { projectAdminRoleNavigation } from '../admin-shell';
import { adminRoleCanAccessRoute, type AdminAuthorityRoute } from '../admin-runtime';

type AdminAuthorityPageProps = Readonly<{
  locale: WebLocale;
  routeId: AdminAuthorityRoute;
}>;

const copy = Object.freeze({
  en: Object.freeze({
    activeRole: 'Active administrative role',
    authoritySummary:
      'Server-admitted authority for this isolated session. Every operation remains role-scoped and auditable.',
    audit: 'Immutable administrative audit',
    confirm: 'Confirm publication hold',
    denied: 'Administrative authority unavailable',
    diagnostic: 'Consented diagnostic view',
    diagnosticAccess: 'Diagnostic access',
    expired: 'Diagnostic access expired',
    impact: 'I reviewed the impact and affected authority',
    loading: 'Loading server-authorized administrative projection.',
    noRecords: 'No authorized records are currently available.',
    noRecordsDescription:
      'This queue is clear. New authorized events will appear here without exposing data outside your role.',
    noRecordsTitle: 'No pending records',
    operations: 'Operations queue',
    reason: 'Reason',
    receipt: 'Immutable authority receipt',
    revoked: 'Diagnostic access revoked',
    security: 'Security queue',
    signIn: 'Sign in to the administrative panel',
    signInAction: 'Sign in securely',
    signInDescription:
      'Use your authorized Liiiraa Boost credentials. Access is admitted by the server for this isolated administrative origin.',
    signInEmail: 'Administrative email',
    signInError: 'We could not verify these credentials or administrative access.',
    signInPassword: 'Password',
    signingIn: 'Verifying access',
    signInSecurity: 'Encrypted session · restricted administrative origin · immutable audit',
    signInScope: 'Administrative access is separate from your public account session.',
    backToAccount: 'Back to account portal',
    stepUp: 'Verify with a strong credential',
    stepUpDialog: 'Verify critical operation',
    support: 'Support case queue',
    signOut: 'Sign out of Admin',
    signOutError: 'The administrative session could not be closed. Try again.',
    sessionUntil: 'Protected session until',
    accountPortal: 'Account portal',
    enrollmentCode: 'Six-digit authenticator code',
    enrollmentConfirm: 'Activate protected Admin access',
    enrollmentDescription:
      'Add this key to your authenticator, then enter the current code. Admin remains locked until the server verifies it.',
    enrollmentError: 'The code could not be verified. Wait for a new code and try again.',
    enrollmentKey: 'Manual setup key',
    enrollmentLoading: 'Preparing protected access',
    enrollmentTitle: 'Protect your administrative account',
    enrollmentVerifying: 'Verifying authenticator',
  }),
  'pt-BR': Object.freeze({
    activeRole: 'Função administrativa ativa',
    authoritySummary:
      'Autoridade validada pelo servidor para esta sessão isolada. Toda operação permanece limitada à função e auditável.',
    audit: 'Auditoria administrativa imutável',
    confirm: 'Confirmar retenção da publicação',
    denied: 'Autoridade administrativa indisponível',
    diagnostic: 'Visualização de diagnóstico consentida',
    diagnosticAccess: 'Acesso ao diagnóstico',
    expired: 'Acesso ao diagnóstico expirado',
    impact: 'Revisei o impacto e a autoridade afetada',
    loading: 'Carregando projeção administrativa autorizada pelo servidor.',
    noRecords: 'Nenhum registro autorizado está disponível no momento.',
    noRecordsDescription:
      'Esta fila está limpa. Novos eventos autorizados aparecerão aqui sem expor dados fora da sua função.',
    noRecordsTitle: 'Nenhum registro pendente',
    operations: 'Fila de operações',
    reason: 'Motivo',
    receipt: 'Comprovante de autoridade imutável',
    revoked: 'Acesso ao diagnóstico revogado',
    security: 'Fila de segurança',
    signIn: 'Entrar no painel administrativo',
    signInAction: 'Entrar com segurança',
    signInDescription:
      'Use suas credenciais autorizadas do Liiiraa Boost. O servidor valida o acesso neste domínio administrativo isolado.',
    signInEmail: 'E-mail administrativo',
    signInError: 'Não foi possível validar as credenciais ou o acesso administrativo.',
    signInPassword: 'Senha',
    signingIn: 'Validando acesso',
    signInSecurity: 'Sessão criptografada · domínio administrativo restrito · auditoria imutável',
    signInScope: 'O acesso administrativo é separado da sessão da sua conta pública.',
    backToAccount: 'Voltar ao portal da conta',
    stepUp: 'Verificar com credencial forte',
    stepUpDialog: 'Verificar operação crítica',
    support: 'Fila de casos de suporte',
    signOut: 'Sair do painel',
    signOutError: 'Não foi possível encerrar a sessão administrativa. Tente novamente.',
    sessionUntil: 'Sessão protegida até',
    accountPortal: 'Portal da conta',
    enrollmentCode: 'Código de seis dígitos do autenticador',
    enrollmentConfirm: 'Ativar acesso protegido ao Admin',
    enrollmentDescription:
      'Adicione esta chave ao seu autenticador e informe o código atual. O Admin continua bloqueado até a verificação do servidor.',
    enrollmentError: 'Não foi possível validar o código. Aguarde um novo código e tente novamente.',
    enrollmentKey: 'Chave para configuração manual',
    enrollmentLoading: 'Preparando acesso protegido',
    enrollmentTitle: 'Proteja sua conta administrativa',
    enrollmentVerifying: 'Validando autenticador',
  }),
});

const roleLabel = (locale: WebLocale, role: AdminRoleJson): string => {
  const labels = {
    en: { audit: 'Audit', operations: 'Operations', security: 'Security', support: 'Support' },
    'pt-BR': {
      audit: 'Auditoria',
      operations: 'Operações',
      security: 'Segurança',
      support: 'Suporte',
    },
  } as const;
  return labels[locale][role];
};

const productionShellCopy = Object.freeze({
  en: Object.freeze({
    account: 'Operator menu',
    alerts: 'Actionable inbox',
    currentQueue: 'Current view',
    currentTask: 'Current task',
    environment: 'Staging',
    inbox: 'Inbox',
    isolated: 'Isolated Admin origin',
    jobs: 'Activity and jobs',
    navigation: 'Administrative domains',
    roleHome: 'Overview',
    savedViews: Object.freeze({
      assigned: 'Assigned work',
      'sla-risk': 'SLA at risk',
      unowned: 'Unassigned',
      'all-permitted': 'All permitted',
    }),
    searchAction: 'Search',
    searchLabel: 'Search server-authorized administrative records',
    searchPlaceholder: 'Search permitted records',
    security: 'Protected administrative session',
  }),
  'pt-BR': Object.freeze({
    account: 'Menu do operador',
    alerts: 'Caixa de entrada acionável',
    currentQueue: 'Visão atual',
    currentTask: 'Tarefa atual',
    environment: 'Staging',
    inbox: 'Caixa de entrada',
    isolated: 'Origem Admin isolada',
    jobs: 'Atividade e tarefas',
    navigation: 'Domínios administrativos',
    roleHome: 'Visão geral',
    savedViews: Object.freeze({
      assigned: 'Trabalho atribuído',
      'sla-risk': 'SLA em risco',
      unowned: 'Sem responsável',
      'all-permitted': 'Todos permitidos',
    }),
    searchAction: 'Buscar',
    searchLabel: 'Buscar registros administrativos autorizados pelo servidor',
    searchPlaceholder: 'Buscar registros permitidos',
    security: 'Sessão administrativa protegida',
  }),
});

const formatAdminDateTime = (value: string, locale: WebLocale): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime()))
    return locale === 'pt-BR' ? 'horário indisponível' : 'time unavailable';
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const formatRecordReference = (value: string, locale: WebLocale): string => {
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/iu.test(value)) return value;
  const ending = value.replaceAll('-', '').slice(-6).toLocaleUpperCase(locale);
  return `${locale === 'pt-BR' ? 'Referência' : 'Reference'} ••••${ending}`;
};

const csrfToken = (): string =>
  document.cookie
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith('liiiraa-csrf='))
    ?.slice('liiiraa-csrf='.length) ?? 'csrf-unavailable';

let sequence = 0;
const correlationId = (): string => {
  sequence += 1;
  return `admin-browser-${String(sequence)}`;
};

const collectionFor = (routeId: AdminAuthorityRoute): AdminProjectionCollection => {
  if (routeId === 'admin-support') return 'support-cases';
  if (routeId === 'admin-operations') return 'entitlements';
  if (routeId === 'admin-security') return 'sessions';
  if (routeId === 'admin-diagnostics') return 'diagnostic-metadata';
  return 'audit-events';
};

const ADMIN_RESOURCE_QUERY: Readonly<Record<string, AdminQueryFamily>> = Object.freeze({
  'access-context': 'briefing',
  alerts: 'alerts',
  'audit-events': 'audit',
  capacity: 'capacity',
  configurations: 'configurations',
  conflicts: 'configurations',
  'emergency-stops': 'emergency',
  environments: 'environments',
  exports: 'exports',
  governance: 'approvals',
  incidents: 'incidents',
  inbox: 'briefing',
  invitations: 'invitations',
  jobs: 'jobs',
  'privacy-cases': 'privacy',
  queues: 'briefing',
  team: 'team',
  views: 'briefing',
});

const queryFamiliesForResources = (resources: readonly string[]): readonly AdminQueryFamily[] =>
  Object.freeze([
    ...new Set(
      resources
        .map((resource) => ADMIN_RESOURCE_QUERY[resource])
        .filter((family) => family !== undefined),
    ),
  ]);

const loadAuthorizedRecords = async (
  authority: AdminAuthority,
  routeId: AdminAuthorityRoute,
): Promise<readonly AdminProjectionRecord[]> => {
  if (routeId === 'admin-diagnostics') return [];
  const result = await authority.list(collectionFor(routeId));
  return result.status === 'online' ? result.records : [];
};

const AdminSignIn = ({
  accountOrigin,
  authority,
  locale,
  onAuthenticated,
  onEnrollmentRequired,
  routeId,
}: Readonly<{
  accountOrigin: string;
  authority: AdminAuthority;
  locale: WebLocale;
  onAuthenticated: (
    session: AdminSessionProjection,
    records: readonly AdminProjectionRecord[],
  ) => void;
  onEnrollmentRequired: () => void;
  routeId: AdminAuthorityRoute;
}>) => {
  const labels = copy[locale];
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    const next = await authority.signIn({ email, password });
    if (next === null) {
      setPassword('');
      setError(labels.signInError);
      setLoading(false);
      return;
    }
    if ('kind' in next) {
      setPassword('');
      setLoading(false);
      onEnrollmentRequired();
      return;
    }
    if (!adminRoleCanAccessRoute(next.role, routeId)) {
      setPassword('');
      setError(labels.signInError);
      setLoading(false);
      return;
    }
    const records = await loadAuthorizedRecords(authority, routeId);
    onAuthenticated(next, records);
  };

  return (
    <article className="admin-auth" data-admin-runtime="production">
      <section className="admin-auth__primary" aria-labelledby="admin-auth-title">
        <div className="admin-auth__mark" aria-hidden="true">
          <ProductIcon name="lock" size={20} />
        </div>
        <header className="admin-auth__header">
          <h1 id="admin-auth-title">{labels.signIn}</h1>
          <p>{labels.signInDescription}</p>
        </header>
        <form className="admin-auth__form" noValidate onSubmit={(event) => void submit(event)}>
          {error === null ? null : (
            <p className="admin-auth__error" role="alert">
              {error}
            </p>
          )}
          <label className="lb-field">
            <span>{labels.signInEmail}</span>
            <input
              autoComplete="username"
              autoFocus
              className="lb-input"
              disabled={loading}
              maxLength={254}
              name="email"
              onChange={(event) => {
                setEmail(event.currentTarget.value);
              }}
              required
              type="email"
              value={email}
            />
          </label>
          <label className="lb-field">
            <span>{labels.signInPassword}</span>
            <input
              autoComplete="current-password"
              className="lb-input"
              disabled={loading}
              maxLength={128}
              name="password"
              onChange={(event) => {
                setPassword(event.currentTarget.value);
              }}
              required
              type="password"
              value={password}
            />
          </label>
          <LbButton
            isDisabled={loading || email.trim().length === 0 || password.length === 0}
            isLoading={loading}
            loadingLabel={labels.signingIn}
            type="submit"
            variant="primary"
          >
            {labels.signInAction}
          </LbButton>
        </form>
        <p className="admin-auth__security" role="note">
          <ProductIcon name="shield" size={16} />
          <span>{labels.signInSecurity}</span>
        </p>
      </section>
      <aside className="admin-auth__boundary" aria-label={labels.signInScope}>
        <span aria-hidden="true">ADMIN / RESTRICTED</span>
        <p>{labels.signInScope}</p>
        <a href={`${accountOrigin}/${locale}/login`}>{labels.backToAccount}</a>
      </aside>
    </article>
  );
};

const AdminTotpEnrollment = ({
  authority,
  locale,
  onComplete,
}: Readonly<{
  authority: AdminAuthority;
  locale: WebLocale;
  onComplete: (session: AdminSessionProjection) => void;
}>) => {
  const labels = copy[locale];
  const [enrollment, setEnrollment] = useState<AdminTotpEnrollment | null>();
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    let active = true;
    void authority.beginTotpEnrollment().then((next) => {
      if (active) setEnrollment(next);
    });
    return () => {
      active = false;
    };
  }, [authority]);

  const confirm = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (enrollment === null || enrollment === undefined || verifying) return;
    setVerifying(true);
    setError(false);
    const session = await authority.confirmTotpEnrollment({
      code,
      enrollmentToken: enrollment.enrollmentToken,
    });
    if (session === null) {
      setCode('');
      setError(true);
      setVerifying(false);
      return;
    }
    onComplete(session);
  };

  return (
    <article className="admin-auth admin-auth--enrollment" data-admin-runtime="production">
      <section className="admin-auth__primary" aria-labelledby="admin-enrollment-title">
        <div className="admin-auth__mark" aria-hidden="true">
          <ProductIcon name="shield" size={20} />
        </div>
        <header className="admin-auth__header">
          <h1 id="admin-enrollment-title">{labels.enrollmentTitle}</h1>
          <p>{labels.enrollmentDescription}</p>
        </header>
        {enrollment === undefined ? (
          <p aria-live="polite" role="status">
            {labels.enrollmentLoading}
          </p>
        ) : enrollment === null ? (
          <p className="admin-auth__error" role="alert">
            {labels.enrollmentError}
          </p>
        ) : (
          <form className="admin-auth__form" onSubmit={(event) => void confirm(event)}>
            <label className="lb-field">
              <span>{labels.enrollmentKey}</span>
              <output className="admin-auth__totp-secret">{enrollment.secret}</output>
            </label>
            <label className="lb-field">
              <span>{labels.enrollmentCode}</span>
              <input
                autoComplete="one-time-code"
                autoFocus
                className="lb-input admin-auth__totp-code"
                disabled={verifying}
                inputMode="numeric"
                maxLength={6}
                onChange={(event) => {
                  setCode(event.currentTarget.value.replace(/\D/gu, '').slice(0, 6));
                  setError(false);
                }}
                pattern="[0-9]{6}"
                required
                value={code}
              />
            </label>
            {error ? (
              <p className="admin-auth__error" role="alert">
                {labels.enrollmentError}
              </p>
            ) : null}
            <LbButton
              isDisabled={code.length !== 6 || verifying}
              isLoading={verifying}
              loadingLabel={labels.enrollmentVerifying}
              type="submit"
              variant="primary"
            >
              {labels.enrollmentConfirm}
            </LbButton>
          </form>
        )}
      </section>
      <aside className="admin-auth__boundary" aria-label={labels.signInSecurity}>
        <span aria-hidden="true">TOTP / RFC 6238</span>
        <p>{labels.signInSecurity}</p>
      </aside>
    </article>
  );
};

const routeHref = (locale: WebLocale, suffix: string): string => `/${locale}/admin${suffix}`;

const AuditTable = ({
  events,
  locale,
}: Readonly<{ events: readonly AuditEventJson[]; locale: WebLocale }>) => (
  <section aria-label={copy[locale].audit} data-immutable="true">
    <table>
      <caption>{copy[locale].audit}</caption>
      <thead>
        <tr>
          <th scope="col">Event</th>
          <th scope="col">Action</th>
          <th scope="col">Target</th>
        </tr>
      </thead>
      <tbody>
        {events.map((event) => (
          <tr key={event.auditEventId}>
            <td>{event.auditEventId}</td>
            <td>{event.action.replaceAll('-', ' ')}</td>
            <td>{event.redactedTarget}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </section>
);

const DiagnosticAuthority = ({
  authority,
  locale,
}: Readonly<{ authority: AdminAuthority; locale: WebLocale }>) => {
  const [projection, setProjection] = useState<AdminDiagnosticProjection | null>(null);
  const [events, setEvents] = useState<readonly AuditEventJson[]>([]);
  const [clearReason, setClearReason] = useState<
    'expired' | 'revoked' | 'unauthorized' | 'invalid'
  >();
  useEffect(() => {
    const controller = new AbortController();
    let lifecycle: Awaited<ReturnType<AdminAuthority['openDiagnostic']>> | undefined;
    void authority
      .openDiagnostic({
        diagnosticId: 'DIA-015',
        onClear: ({ auditEvents, reason }) => {
          setProjection(null);
          setEvents(auditEvents);
          setClearReason(reason);
        },
        onProjection: (next) => {
          setProjection(next);
          setEvents(next.auditEvents);
          setClearReason(undefined);
        },
        signal: controller.signal,
      })
      .then((next) => {
        lifecycle = next;
      });
    return () => {
      controller.abort();
      lifecycle?.stop();
      setProjection(null);
    };
  }, [authority]);

  const status =
    clearReason === 'revoked'
      ? copy[locale].revoked
      : clearReason === 'expired'
        ? copy[locale].expired
        : copy[locale].denied;
  return (
    <section>
      {projection === null ? (
        <p aria-label={status} role="status">
          {status}
        </p>
      ) : (
        <section
          aria-label={copy[locale].diagnostic}
          data-cache-policy="no-store"
          data-consent-version={projection.consent.aggregateVersion}
        >
          <h2>{copy[locale].diagnostic}</h2>
          <dl>
            {Object.entries(projection.fields).map(([field, value]) => (
              <div key={field}>
                <dt>{field}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      <AuditTable events={events} locale={locale} />
    </section>
  );
};

const CriticalCommand = ({
  authority,
  locale,
  session,
}: Readonly<{
  authority: AdminAuthority;
  locale: WebLocale;
  session: AdminSessionProjection;
}>) => {
  const labels = copy[locale];
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [impactReviewed, setImpactReviewed] = useState(false);
  const [stepUp, setStepUp] = useState<AdminStepUp | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [stepUpPending, setStepUpPending] = useState(false);
  const [stepUpError, setStepUpError] = useState(false);
  const [receipt, setReceipt] = useState<AuthorityReceiptJson | null>(null);
  const ready = reason.trim().length >= 8 && impactReviewed && stepUp !== null;
  const redactedTarget = 'Release-redacted-017';
  return (
    <section className="admin-critical-command" data-high-risk-action="true">
      <LbButton
        onPress={() => {
          setOpen(true);
        }}
        variant="destructive"
      >
        {locale === 'pt-BR' ? 'Revisar retenção de publicação' : 'Review publication hold'}
      </LbButton>
      {open ? (
        <section
          aria-label={labels.stepUpDialog}
          className="admin-critical-command__review"
          role="dialog"
        >
          <h2>{labels.stepUpDialog}</h2>
          <LbTextField label={labels.reason} maxLength={240} onChange={setReason} value={reason} />
          <LbCheckbox isSelected={impactReviewed} onChange={setImpactReviewed} value="impact">
            {labels.impact}
          </LbCheckbox>
          <LbTextField
            label={labels.enrollmentCode}
            maxLength={6}
            onChange={(value) => {
              setTotpCode(value.replace(/\D/gu, '').slice(0, 6));
              setStepUp(null);
              setStepUpError(false);
            }}
            value={totpCode}
          />
          {stepUpError ? (
            <p className="admin-auth__error" role="alert">
              {labels.enrollmentError}
            </p>
          ) : null}
          <div className="admin-critical-command__actions">
            <LbButton
              isDisabled={totpCode.length !== 6 || stepUpPending}
              isLoading={stepUpPending}
              onPress={() => {
                setStepUpPending(true);
                setStepUpError(false);
                void authority
                  .verifyStepUp({
                    action: 'correct-entitlement',
                    authorizationContextId: correlationId(),
                    code: totpCode,
                    redactedTarget,
                    resource: 'entitlement',
                  })
                  .then((evidence) => {
                    setStepUp(evidence);
                    setStepUpError(evidence === null);
                    setStepUpPending(false);
                  });
              }}
              variant="secondary"
            >
              {labels.stepUp}
            </LbButton>
            <LbButton
              isDisabled={!ready}
              onPress={() => {
                void authority
                  .execute({
                    action: 'correct-entitlement',
                    actorId: session.actorId,
                    assumedRole: session.role,
                    confirmed: true,
                    expectedVersion: '7',
                    impactReviewed,
                    reason,
                    redactedTarget,
                    stepUp,
                  })
                  .then((result) => {
                    if (result.status === 'complete') setReceipt(result.receipt);
                  });
              }}
              variant="destructive"
            >
              {labels.confirm}
            </LbButton>
          </div>
        </section>
      ) : null}
      {receipt === null ? null : (
        <p aria-label={labels.receipt} data-immutable="true" role="status">
          {receipt.auditReference}
        </p>
      )}
    </section>
  );
};

const BreakGlassReview = ({
  authority,
  locale,
}: Readonly<{ authority: AdminAuthority; locale: WebLocale }>) => {
  const [metadata, setMetadata] = useState<Readonly<Record<string, string>> | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);
  const targetReference = 'security-incident-083';
  return (
    <section
      aria-label="Redacted break-glass metadata"
      className="admin-break-glass"
      data-redaction="allowlist-only"
    >
      <header>
        <ProductIcon name="shield" size={20} />
        <div>
          <h2>{locale === 'pt-BR' ? 'Acesso emergencial' : 'Emergency access'}</h2>
          <p>
            {locale === 'pt-BR'
              ? 'Exibe somente metadados autorizados, por tempo limitado e com auditoria imutável.'
              : 'Shows only allowlisted metadata for a limited time with immutable audit.'}
          </p>
        </div>
      </header>
      <LbTextField
        label={copy[locale].enrollmentCode}
        maxLength={6}
        onChange={(value) => {
          setTotpCode(value.replace(/\D/gu, '').slice(0, 6));
          setError(false);
        }}
        value={totpCode}
      />
      {error ? (
        <p className="admin-auth__error" role="alert">
          {copy[locale].enrollmentError}
        </p>
      ) : null}
      <LbButton
        isDisabled={totpCode.length !== 6 || pending}
        isLoading={pending}
        onPress={() => {
          setPending(true);
          setError(false);
          void authority
            .verifyStepUp({
              action: 'export-audit-reference',
              authorizationContextId: correlationId(),
              code: totpCode,
              redactedTarget: targetReference,
              resource: 'audit-event',
            })
            .then(async (stepUp) => {
              if (stepUp === null) return null;
              return authority.breakGlass({
                expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
                reason: 'Contain the reviewed security incident',
                stepUp,
                targetReference,
              });
            })
            .then((result) => {
              if (result?.status === 'complete') setMetadata(result.metadata);
              else setError(true);
              setPending(false);
            });
        }}
        variant="destructive"
      >
        {locale === 'pt-BR' ? 'Abrir metadados de emergência' : 'Open break-glass metadata'}
      </LbButton>
      {metadata === null ? null : (
        <dl>
          {Object.entries(metadata).map(([field, value]) => (
            <div key={field}>
              <dt>{field}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
};

const AdminProductionShell = ({
  accountOrigin,
  authority,
  children,
  locale,
  onSignedOut,
  freshness,
  inboxCount,
  session,
}: Readonly<{
  accountOrigin: string;
  authority: AdminAuthority;
  children: ReactNode;
  locale: WebLocale;
  onSignedOut: () => void;
  freshness: AdminAuthorityContextValue['freshness'];
  inboxCount: number;
  session: AdminSessionProjection;
}>) => {
  const labels = copy[locale];
  const shellLabels = productionShellCopy[locale];
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(false);
  const alternateLocale: WebLocale = locale === 'pt-BR' ? 'en' : 'pt-BR';
  const navigation = projectAdminRoleNavigation(session.role, locale);
  useEffect(() => {
    document.documentElement.dataset['adminSessionState'] = 'verified';
    return () => {
      document.documentElement.dataset['adminSessionState'] = 'unverified';
    };
  }, []);
  return (
    <AdminNavigation
      accountActions={
        <>
          <a href={`${accountOrigin}/${locale}/account`}>{labels.accountPortal}</a>
          <LbButton
            isDisabled={signingOut}
            isLoading={signingOut}
            loadingLabel={locale === 'pt-BR' ? 'Encerrando' : 'Signing out'}
            onPress={() => {
              setSigningOut(true);
              setSignOutError(false);
              void authority.signOut().then((signedOut) => {
                setSigningOut(false);
                if (signedOut) onSignedOut();
                else setSignOutError(true);
              });
            }}
            variant="quiet"
          >
            {labels.signOut}
          </LbButton>
          {signOutError ? <span role="alert">{labels.signOutError}</span> : null}
        </>
      }
      accountLabel={shellLabels.account}
      accountName={roleLabel(locale, session.role)}
      actorId={session.actorId}
      alertsLabel={shellLabels.alerts}
      alternateLocale={alternateLocale}
      currentQueueLabel={shellLabels.currentQueue}
      currentTaskLabel={shellLabels.currentTask}
      environmentId="staging"
      environmentLabel={shellLabels.environment}
      fallbackLocaleHref={routeHref(alternateLocale, '/overview')}
      freshness={freshness}
      header={
        <Link className="admin-brand" href={routeHref(locale, '/overview') as Route}>
          <ProductLockup />
          <span className="admin-brand__surface">Admin</span>
        </Link>
      }
      inboxCount={inboxCount}
      inboxHref={routeHref(locale, '/inbox')}
      inboxLabel={shellLabels.inbox}
      isolatedLabel={`${shellLabels.isolated} · ${labels.sessionUntil} ${formatAdminDateTime(session.expiresAt, locale)}`}
      items={navigation}
      jobsHref={routeHref(locale, '/activity')}
      jobsLabel={shellLabels.jobs}
      label={shellLabels.navigation}
      locale={locale}
      roleHomeHref={routeHref(locale, '/overview')}
      roleHomeLabel={shellLabels.roleHome}
      roleLabel={roleLabel(locale, session.role)}
      savedViewLabels={shellLabels.savedViews}
      searchAction={shellLabels.searchAction}
      searchHref={routeHref(locale, '/search')}
      searchLabel={shellLabels.searchLabel}
      searchPlaceholder={shellLabels.searchPlaceholder}
      securityLabel={shellLabels.security}
    >
      <main className="admin-production-shell" id="admin-main" tabIndex={-1}>
        <AdminFocusHandoff />
        {children}
      </main>
    </AdminNavigation>
  );
};

type AdminAuthorityContextValue = Readonly<{
  accountOrigin: string;
  authorizeMutation: (input: AdminMutationInput) => Promise<AdminMutationInput | null>;
  authority: AdminAuthority;
  enrollmentRequired: boolean;
  freshness: 'live' | 'reconnecting' | 'offline' | 'degraded';
  projections: Readonly<Partial<Record<AdminQueryFamily, AdminQueryResult>>>;
  revision: number;
  session: AdminSessionProjection | null | undefined;
  setEnrollmentRequired: Dispatch<SetStateAction<boolean>>;
  setSession: Dispatch<SetStateAction<AdminSessionProjection | null | undefined>>;
}>;

const AdminAuthorityContext = createContext<AdminAuthorityContextValue | null>(null);

export const AdminAuthorityProvider = ({
  accountOrigin,
  authorityBaseUrl,
  children,
  environment = 'staging',
  locale,
}: Readonly<{
  accountOrigin: string;
  authorityBaseUrl: string;
  children: ReactNode;
  environment?: AdminEnvironmentKindJson;
  locale: WebLocale;
}>) => {
  const [session, setSession] = useState<AdminSessionProjection | null>();
  const [enrollmentRequired, setEnrollmentRequired] = useState(false);
  const [freshness, setFreshness] = useState<AdminAuthorityContextValue['freshness']>('offline');
  const [projections, setProjections] = useState<
    Readonly<Partial<Record<AdminQueryFamily, AdminQueryResult>>>
  >({});
  const [revision, setRevision] = useState(0);
  const [mutationStepUp, setMutationStepUp] = useState<Readonly<{
    input: AdminMutationInput;
    resolve: (input: AdminMutationInput | null) => void;
  }> | null>(null);
  const [mutationStepUpCode, setMutationStepUpCode] = useState('');
  const [mutationStepUpPending, setMutationStepUpPending] = useState(false);
  const [mutationStepUpError, setMutationStepUpError] = useState(false);
  const authority = useMemo(
    () =>
      createAdminAuthority({
        baseUrl: authorityBaseUrl,
        correlationId,
        csrfToken,
        subscribeToConsent: (listener) => {
          const interval = window.setInterval(listener, 150);
          return () => {
            window.clearInterval(interval);
          };
        },
      }),
    [authorityBaseUrl],
  );

  const refetchAdminResources = useCallback(
    async (resources: readonly string[], signal: AbortSignal): Promise<void> => {
      const families = queryFamiliesForResources(resources);
      if (families.length === 0 || signal.aborted) return;
      const results = await Promise.all(
        families.map(
          async (family) =>
            [family, await authority.query(family, { environment, signal })] as const,
        ),
      );
      signal.throwIfAborted();
      setProjections((current) => Object.freeze({ ...current, ...Object.fromEntries(results) }));
      setRevision((current) => current + 1);
    },
    [authority, environment],
  );

  const authorizeMutation = useCallback(
    (input: AdminMutationInput): Promise<AdminMutationInput | null> =>
      new Promise((resolve) => {
        setMutationStepUp((current) => {
          current?.resolve(null);
          return { input, resolve };
        });
        setMutationStepUpCode('');
        setMutationStepUpError(false);
      }),
    [],
  );

  useEffect(() => {
    let active = true;
    void authority.session().then((next) => {
      if (!active) return;
      if (next === null) {
        setEnrollmentRequired(false);
        setSession(null);
      } else if ('kind' in next) {
        setEnrollmentRequired(true);
        setSession(null);
      } else {
        setEnrollmentRequired(false);
        setSession(next);
      }
    });
    return () => {
      active = false;
    };
  }, [authority]);

  useEffect(() => {
    if (session === null || session === undefined) return undefined;
    const controller = new AbortController();
    void refetchAdminResources(
      [
        'access-context',
        'inbox',
        'governance',
        'jobs',
        'incidents',
        'exports',
        'configurations',
        'capacity',
        'invitations',
        'environments',
        'audit-events',
        'alerts',
        'privacy-cases',
        'emergency-stops',
      ],
      controller.signal,
    );
    return () => {
      controller.abort();
    };
  }, [refetchAdminResources, session]);

  useEffect(() => {
    if (session === null || session === undefined) {
      setFreshness('offline');
      return undefined;
    }
    const controller = new AbortController();
    const lifecycle = authority.openFreshness({
      environment,
      onInvalidate: () => {
        setFreshness('reconnecting');
      },
      onState: setFreshness,
      refetch: refetchAdminResources,
      signal: controller.signal,
    });
    return () => {
      controller.abort();
      lifecycle.stop();
    };
  }, [authority, environment, refetchAdminResources, session]);

  const context = useMemo(
    () => ({
      accountOrigin,
      authorizeMutation,
      authority,
      enrollmentRequired,
      freshness,
      projections,
      revision,
      session,
      setEnrollmentRequired,
      setSession,
    }),
    [
      accountOrigin,
      authorizeMutation,
      authority,
      enrollmentRequired,
      freshness,
      projections,
      revision,
      session,
    ],
  );

  if (session === undefined) {
    return (
      <main id="admin-main" tabIndex={-1}>
        <section
          aria-busy="true"
          aria-label={copy[locale].loading}
          className="admin-production-loading"
          data-admin-runtime="production"
        >
          <header>
            <span className="admin-production-loading__brand" />
            <span className="admin-production-loading__session" />
          </header>
          <div>
            <aside aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </aside>
            <div className="admin-production-loading__main">
              <span className="admin-production-loading__title" />
              <span className="admin-production-loading__copy" />
              <span className="admin-production-loading__content" />
            </div>
          </div>
          <span className="lb-visually-hidden" role="status">
            {copy[locale].loading}
          </span>
        </section>
      </main>
    );
  }

  return (
    <AdminAuthorityContext.Provider value={context}>
      {session === null ? (
        <main id="admin-main" tabIndex={-1}>
          <AdminFocusHandoff />
          {children}
        </main>
      ) : (
        <AdminProductionShell
          accountOrigin={accountOrigin}
          authority={authority}
          locale={locale}
          onSignedOut={() => {
            setEnrollmentRequired(false);
            setSession(null);
          }}
          freshness={freshness}
          inboxCount={
            projections.briefing?.status === 'online' ? projections.briefing.records.length : 0
          }
          session={session}
        >
          {children}
        </AdminProductionShell>
      )}
      {mutationStepUp === null ? null : (
        <div className="admin-step-up" role="presentation">
          <section
            aria-labelledby="admin-step-up-title"
            aria-modal="true"
            className="admin-step-up__dialog"
            role="dialog"
          >
            <header>
              <div className="admin-auth__mark" aria-hidden="true">
                <ProductIcon name="shield" size={20} />
              </div>
              <div>
                <h2 id="admin-step-up-title">{copy[locale].stepUpDialog}</h2>
                <p>{copy[locale].enrollmentDescription}</p>
              </div>
            </header>
            <p className="admin-step-up__scope">
              <span>{mutationStepUp.input.family}</span>
              <strong>
                {mutationStepUp.input.targetId ?? mutationStepUp.input.idempotencyKey}
              </strong>
            </p>
            <LbTextField
              label={copy[locale].enrollmentCode}
              maxLength={6}
              onChange={(value) => {
                setMutationStepUpCode(value.replace(/\D/gu, '').slice(0, 6));
                setMutationStepUpError(false);
              }}
              value={mutationStepUpCode}
            />
            {mutationStepUpError ? (
              <p className="admin-auth__error" role="alert">
                {copy[locale].enrollmentError}
              </p>
            ) : null}
            <div className="admin-step-up__actions">
              <LbButton
                isDisabled={mutationStepUpPending}
                onPress={() => {
                  mutationStepUp.resolve(null);
                  setMutationStepUp(null);
                }}
                variant="secondary"
              >
                {locale === 'pt-BR' ? 'Cancelar' : 'Cancel'}
              </LbButton>
              <LbButton
                isDisabled={mutationStepUpCode.length !== 6 || mutationStepUpPending}
                isLoading={mutationStepUpPending}
                loadingLabel={copy[locale].enrollmentVerifying}
                onPress={() => {
                  setMutationStepUpPending(true);
                  void authority
                    .verifyMutationStepUp({
                      ...mutationStepUp.input,
                      code: mutationStepUpCode,
                    })
                    .then((stepUp) => {
                      if (stepUp === null) {
                        setMutationStepUpCode('');
                        setMutationStepUpError(true);
                        setMutationStepUpPending(false);
                        return;
                      }
                      mutationStepUp.resolve({ ...mutationStepUp.input, stepUp });
                      setMutationStepUp(null);
                      setMutationStepUpPending(false);
                    });
                }}
                variant="primary"
              >
                {copy[locale].stepUp}
              </LbButton>
            </div>
          </section>
        </div>
      )}
    </AdminAuthorityContext.Provider>
  );
};

export const useAdminAuthority = (): AdminAuthorityContextValue => {
  const context = useContext(AdminAuthorityContext);
  if (context === null) throw new Error('ADMIN_AUTHORITY_PROVIDER_REQUIRED');
  return context;
};

export const AdminAuthorityPage = ({ locale, routeId }: AdminAuthorityPageProps) => {
  const {
    accountOrigin,
    authority,
    enrollmentRequired,
    session,
    setEnrollmentRequired,
    setSession,
  } = useAdminAuthority();
  const [records, setRecords] = useState<readonly AdminProjectionRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    if (session === null || session === undefined || routeId === 'admin-diagnostics') {
      setRecords([]);
      setRecordsLoading(false);
      return () => {
        controller.abort();
      };
    }
    setRecords([]);
    setRecordsLoading(true);
    void authority.list(collectionFor(routeId)).then((result) => {
      if (controller.signal.aborted) return;
      setRecords(result.records);
      setRecordsLoading(false);
    });
    return () => {
      controller.abort();
    };
  }, [authority, routeId, session]);

  if (session === undefined) {
    return (
      <article aria-busy="true" data-admin-runtime="production">
        <h1>{copy[locale].activeRole}</h1>
        <p role="status">{copy[locale].loading}</p>
      </article>
    );
  }
  if (session === null) {
    if (enrollmentRequired) {
      return (
        <AdminTotpEnrollment
          authority={authority}
          locale={locale}
          onComplete={(next) => {
            setEnrollmentRequired(false);
            setSession(next);
          }}
        />
      );
    }
    return (
      <AdminSignIn
        accountOrigin={accountOrigin}
        authority={authority}
        locale={locale}
        onAuthenticated={(next, nextRecords) => {
          setEnrollmentRequired(false);
          setSession(next);
          setRecords(nextRecords);
        }}
        onEnrollmentRequired={() => {
          setEnrollmentRequired(true);
        }}
        routeId={routeId}
      />
    );
  }
  if (!adminRoleCanAccessRoute(session.role, routeId)) {
    return (
      <article data-admin-runtime="production">
        <h1>{copy[locale].denied}</h1>
        <p role="alert">{copy[locale].denied}</p>
      </article>
    );
  }
  return (
    <article
      className="admin-authority"
      data-admin-role={session.role}
      data-admin-runtime="production"
    >
      <header className="admin-authority__header">
        <div>
          <h1>{copy[locale].activeRole}</h1>
          <p>{copy[locale].authoritySummary}</p>
        </div>
        <p aria-label={copy[locale].activeRole} className="admin-authority__role" role="status">
          <ProductIcon name="shield" size={16} />
          <span>{roleLabel(locale, session.role)}</span>
        </p>
      </header>
      {routeId === 'admin-diagnostics' ? (
        <DiagnosticAuthority authority={authority} locale={locale} />
      ) : null}
      {routeId === 'admin-operations' && session.role === 'operations' ? (
        <CriticalCommand authority={authority} locale={locale} session={session} />
      ) : null}
      {routeId === 'admin-security' && session.role === 'security' ? (
        <BreakGlassReview authority={authority} locale={locale} />
      ) : null}
      {routeId !== 'admin-diagnostics' && routeId !== 'admin-operations' ? (
        <section aria-label={copy[locale].activeRole} className="admin-authority__content">
          {recordsLoading ? (
            <div className="admin-authority__records-loading" aria-busy="true">
              <span />
              <span />
              <span />
            </div>
          ) : records.length === 0 ? (
            <div className="admin-authority__empty" role="status">
              <ProductIcon name="check" size={20} />
              <div>
                <strong>{copy[locale].noRecordsTitle}</strong>
                <p>{copy[locale].noRecordsDescription}</p>
                <span>{copy[locale].noRecords}</span>
              </div>
            </div>
          ) : (
            <ul className="admin-authority__records">
              {records.map((record) => (
                <li key={record.id}>
                  <strong className="admin-authority__record-reference">
                    {formatRecordReference(record.id, locale)}
                  </strong>{' '}
                  {typeof record.redactedTarget === 'string'
                    ? record.redactedTarget
                    : typeof record.summary === 'string'
                      ? record.summary
                      : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </article>
  );
};
