'use client';

import type { AdminRoleJson, AuditEventJson, AuthorityReceiptJson } from '@liiiraa/contracts-ts';
import { LbButton, LbCheckbox, LbTextField, ProductIcon } from '@liiiraa/design-system';
import type { WebLocale } from '@liiiraa/web-core';
import type { Route } from 'next';
import Link from 'next/link';
import {
  createContext,
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
  type AdminProjectionCollection,
  type AdminProjectionRecord,
  type AdminSessionProjection,
  type AdminStepUp,
} from '../admin-authority';
import { ProductLockup } from '../admin-product-lockup';
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
  routeId,
}: Readonly<{
  accountOrigin: string;
  authority: AdminAuthority;
  locale: WebLocale;
  onAuthenticated: (
    session: AdminSessionProjection,
    records: readonly AdminProjectionRecord[],
  ) => void;
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
    if (next === null || !adminRoleCanAccessRoute(next.role, routeId)) {
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

const routeHref = (locale: WebLocale, suffix: string): string => `/${locale}/admin${suffix}`;

const RoleNavigation = ({ locale, role }: Readonly<{ locale: WebLocale; role: AdminRoleJson }>) => {
  const labels = copy[locale];
  const links: readonly (readonly [string, string])[] =
    role === 'support'
      ? [[labels.support, '/support/case-authority']]
      : role === 'operations'
        ? [[labels.operations, '/operations/OPS-117']]
        : role === 'security'
          ? [
              [labels.security, '/security/SEC-083'],
              [labels.diagnosticAccess, '/diagnostics/DIA-015'],
            ]
          : [[labels.audit, '/audit']];
  return (
    <div className="admin-production-nav">
      <nav aria-label={labels.activeRole} className="admin-authority__navigation">
        <Link href={routeHref(locale, '') as Route}>
          <ProductIcon name="toolbox" size={18} />
          {locale === 'pt-BR' ? 'Visão geral' : 'Overview'}
        </Link>
        {links.map(([label, suffix]) => (
          <Link href={routeHref(locale, suffix) as Route} key={suffix}>
            <ProductIcon
              name={
                suffix.includes('diagnostics')
                  ? 'activity'
                  : role === 'security'
                    ? 'shield'
                    : role === 'support'
                      ? 'lifebuoy'
                      : role === 'operations'
                        ? 'rocket'
                        : 'receipt'
              }
              size={18}
            />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
};

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
  const [receipt, setReceipt] = useState<AuthorityReceiptJson | null>(null);
  const ready = reason.trim().length >= 8 && impactReviewed && stepUp !== null;
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
          <div className="admin-critical-command__actions">
            <LbButton
              onPress={() => {
                setStepUp({
                  authorizationContextId: correlationId(),
                  verifiedAt: new Date().toISOString(),
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
                    redactedTarget: 'Release ••••-017',
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
      <LbButton
        onPress={() => {
          const verifiedAt = new Date().toISOString();
          void authority
            .breakGlass({
              expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
              reason: 'Contain the reviewed security incident',
              stepUp: { authorizationContextId: correlationId(), verifiedAt },
              targetReference: 'security-incident-083',
            })
            .then((result) => {
              if (result.status === 'complete') setMetadata(result.metadata);
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
  session,
}: Readonly<{
  accountOrigin: string;
  authority: AdminAuthority;
  children: ReactNode;
  locale: WebLocale;
  onSignedOut: () => void;
  session: AdminSessionProjection;
}>) => {
  const labels = copy[locale];
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(false);
  useEffect(() => {
    document.documentElement.dataset['adminSessionState'] = 'verified';
    return () => {
      document.documentElement.dataset['adminSessionState'] = 'unverified';
    };
  }, []);
  return (
    <div className="admin-production-shell" data-admin-role={session.role}>
      <header className="admin-production-header">
        <Link className="admin-brand" href={routeHref(locale, '') as Route}>
          <ProductLockup />
          <span className="admin-brand__surface">Admin</span>
        </Link>
        <div className="admin-production-header__session">
          <span className="admin-production-header__identity">
            <ProductIcon name="shield" size={18} />
            <span>
              <strong>{roleLabel(locale, session.role)}</strong>
              <small>
                {labels.sessionUntil} {formatAdminDateTime(session.expiresAt, locale)}
              </small>
            </span>
          </span>
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
        </div>
      </header>
      {signOutError ? (
        <p className="admin-production-header__error" role="alert">
          {labels.signOutError}
        </p>
      ) : null}
      <div className="admin-production-workspace">
        <RoleNavigation locale={locale} role={session.role} />
        <section className="admin-production-main">{children}</section>
      </div>
    </div>
  );
};

type AdminAuthorityContextValue = Readonly<{
  accountOrigin: string;
  authority: AdminAuthority;
  session: AdminSessionProjection | null | undefined;
  setSession: Dispatch<SetStateAction<AdminSessionProjection | null | undefined>>;
}>;

const AdminAuthorityContext = createContext<AdminAuthorityContextValue | null>(null);

export const AdminAuthorityProvider = ({
  accountOrigin,
  authorityBaseUrl,
  children,
  locale,
}: Readonly<{
  accountOrigin: string;
  authorityBaseUrl: string;
  children: ReactNode;
  locale: WebLocale;
}>) => {
  const [session, setSession] = useState<AdminSessionProjection | null>();
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

  useEffect(() => {
    let active = true;
    void authority.session().then((next) => {
      if (active) setSession(next);
    });
    return () => {
      active = false;
    };
  }, [authority]);

  const context = useMemo(
    () => ({ accountOrigin, authority, session, setSession }),
    [accountOrigin, authority, session],
  );

  if (session === undefined) {
    return (
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
    );
  }

  return (
    <AdminAuthorityContext.Provider value={context}>
      {session === null ? (
        children
      ) : (
        <AdminProductionShell
          accountOrigin={accountOrigin}
          authority={authority}
          locale={locale}
          onSignedOut={() => {
            setSession(null);
          }}
          session={session}
        >
          {children}
        </AdminProductionShell>
      )}
    </AdminAuthorityContext.Provider>
  );
};

const useAdminAuthority = (): AdminAuthorityContextValue => {
  const context = useContext(AdminAuthorityContext);
  if (context === null) throw new Error('ADMIN_AUTHORITY_PROVIDER_REQUIRED');
  return context;
};

export const AdminAuthorityPage = ({ locale, routeId }: AdminAuthorityPageProps) => {
  const { accountOrigin, authority, session, setSession } = useAdminAuthority();
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
    return (
      <AdminSignIn
        accountOrigin={accountOrigin}
        authority={authority}
        locale={locale}
        onAuthenticated={(next, nextRecords) => {
          setSession(next);
          setRecords(nextRecords);
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
          <span className="admin-authority__system" aria-hidden="true">
            ADMIN CONTROL PLANE
          </span>
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
