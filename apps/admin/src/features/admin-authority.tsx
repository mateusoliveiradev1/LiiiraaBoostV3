'use client';

import type { AdminRoleJson, AuditEventJson, AuthorityReceiptJson } from '@liiiraa/contracts-ts';
import { LbButton, ProductIcon } from '@liiiraa/design-system';
import type { WebLocale } from '@liiiraa/web-core';
import { useEffect, useMemo, useState, type SyntheticEvent } from 'react';

import {
  createAdminAuthority,
  type AdminAuthority,
  type AdminDiagnosticProjection,
  type AdminProjectionCollection,
  type AdminProjectionRecord,
  type AdminSessionProjection,
  type AdminStepUp,
} from '../admin-authority';
import { adminRoleCanAccessRoute, type AdminAuthorityRoute } from '../admin-runtime';

type AdminAuthorityPageProps = Readonly<{
  accountOrigin: string;
  authorityBaseUrl: string;
  locale: WebLocale;
  routeId: AdminAuthorityRoute;
}>;

const copy = Object.freeze({
  en: Object.freeze({
    activeRole: 'Active administrative role',
    audit: 'Immutable administrative audit',
    confirm: 'Confirm publication hold',
    denied: 'Administrative authority unavailable',
    diagnostic: 'Consented diagnostic view',
    diagnosticAccess: 'Diagnostic access',
    expired: 'Diagnostic access expired',
    impact: 'I reviewed the impact and affected authority',
    loading: 'Loading server-authorized administrative projection.',
    noRecords: 'No authorized records are currently available.',
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
  }),
  'pt-BR': Object.freeze({
    activeRole: 'Função administrativa ativa',
    audit: 'Auditoria administrativa imutável',
    confirm: 'Confirmar retenção da publicação',
    denied: 'Autoridade administrativa indisponível',
    diagnostic: 'Visualização de diagnóstico consentida',
    diagnosticAccess: 'Acesso ao diagnóstico',
    expired: 'Acesso ao diagnóstico expirado',
    impact: 'Revisei o impacto e a autoridade afetada',
    loading: 'Carregando projeção administrativa autorizada pelo servidor.',
    noRecords: 'Nenhum registro autorizado está disponível no momento.',
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
    <nav aria-label={labels.activeRole}>
      {links.map(([label, suffix]) => (
        <a href={routeHref(locale, suffix)} key={suffix}>
          {label}
        </a>
      ))}
    </nav>
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
    <section data-high-risk-action="true">
      <button
        onClick={() => {
          setOpen(true);
        }}
        type="button"
      >
        Review publication hold
      </button>
      {open ? (
        <section aria-label={labels.stepUpDialog} role="dialog">
          <h2>{labels.stepUpDialog}</h2>
          <label>
            {labels.reason}
            <input
              onChange={(event) => {
                setReason(event.currentTarget.value);
              }}
              value={reason}
            />
          </label>
          <label>
            <input
              checked={impactReviewed}
              onChange={(event) => {
                setImpactReviewed(event.currentTarget.checked);
              }}
              type="checkbox"
            />
            {labels.impact}
          </label>
          <button
            onClick={() => {
              setStepUp({
                authorizationContextId: correlationId(),
                verifiedAt: new Date().toISOString(),
              });
            }}
            type="button"
          >
            {labels.stepUp}
          </button>
          <button
            disabled={!ready}
            onClick={() => {
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
            type="button"
          >
            {labels.confirm}
          </button>
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
    <section aria-label="Redacted break-glass metadata" data-redaction="allowlist-only">
      <button
        onClick={() => {
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
        type="button"
      >
        {locale === 'pt-BR' ? 'Abrir metadados de emergência' : 'Open break-glass metadata'}
      </button>
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

export const AdminAuthorityPage = ({
  accountOrigin,
  authorityBaseUrl,
  locale,
  routeId,
}: AdminAuthorityPageProps) => {
  const [session, setSession] = useState<AdminSessionProjection | null>();
  const [records, setRecords] = useState<readonly AdminProjectionRecord[]>([]);
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
    const controller = new AbortController();
    void authority.session().then((next) => {
      if (controller.signal.aborted) return;
      setSession(next);
      if (next === null || routeId === 'admin-diagnostics') return;
      void authority.list(collectionFor(routeId)).then((result) => {
        if (!controller.signal.aborted) setRecords(result.records);
      });
    });
    return () => {
      controller.abort();
    };
  }, [authority, routeId]);

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
    <article data-admin-role={session.role} data-admin-runtime="production">
      <header>
        <h1>{copy[locale].activeRole}</h1>
        <p aria-label={copy[locale].activeRole} role="status">
          {roleLabel(locale, session.role)}
        </p>
      </header>
      <RoleNavigation locale={locale} role={session.role} />
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
        <section aria-label={copy[locale].activeRole}>
          {records.length === 0 ? (
            <p role="status">{copy[locale].noRecords}</p>
          ) : (
            <ul>
              {records.map((record) => (
                <li key={record.id}>
                  <strong>{record.id}</strong>{' '}
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
