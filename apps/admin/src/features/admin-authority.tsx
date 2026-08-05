'use client';

import type { AdminRoleJson, AuditEventJson, AuthorityReceiptJson } from '@liiiraa/contracts-ts';
import type { WebLocale } from '@liiiraa/web-core';
import { useEffect, useMemo, useState } from 'react';

import {
  createAdminAuthority,
  type AdminAuthority,
  type AdminDiagnosticProjection,
  type AdminProjectionCollection,
  type AdminProjectionRecord,
  type AdminSessionProjection,
  type AdminStepUp,
} from '../admin-authority';
import type { AdminPreviewRoute } from '../admin-preview-model';
import { adminRoleCanAccessRoute } from '../admin-runtime';

type AdminAuthorityPageProps = Readonly<{
  authorityBaseUrl: string;
  locale: WebLocale;
  routeId: AdminPreviewRoute;
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
    operations: 'Operations queue',
    reason: 'Reason',
    receipt: 'Immutable authority receipt',
    revoked: 'Diagnostic access revoked',
    security: 'Security queue',
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
    operations: 'Fila de operações',
    reason: 'Motivo',
    receipt: 'Comprovante de autoridade imutável',
    revoked: 'Acesso ao diagnóstico revogado',
    security: 'Fila de segurança',
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

const collectionFor = (routeId: AdminPreviewRoute): AdminProjectionCollection => {
  if (routeId === 'admin-support') return 'support-cases';
  if (routeId === 'admin-operations') return 'entitlements';
  if (routeId === 'admin-security') return 'sessions';
  if (routeId === 'admin-diagnostics') return 'diagnostic-metadata';
  return 'audit-events';
};

const routeHref = (locale: WebLocale, suffix: string): string => `/${locale}/admin${suffix}`;

const RoleNavigation = ({
  locale,
  role,
}: Readonly<{ locale: WebLocale; role: AdminRoleJson }>) => {
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
  const [clearReason, setClearReason] = useState<'expired' | 'revoked' | 'unauthorized' | 'invalid'>();
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
      <button onClick={() => setOpen(true)} type="button">
        Review publication hold
      </button>
      {open ? (
        <section aria-label={labels.stepUpDialog} role="dialog">
          <h2>{labels.stepUpDialog}</h2>
          <label>
            {labels.reason}
            <input onChange={(event) => setReason(event.currentTarget.value)} value={reason} />
          </label>
          <label>
            <input
              checked={impactReviewed}
              onChange={(event) => setImpactReviewed(event.currentTarget.checked)}
              type="checkbox"
            />
            {labels.impact}
          </label>
          <button
            onClick={() =>
              setStepUp({
                authorizationContextId: correlationId(),
                verifiedAt: new Date().toISOString(),
              })
            }
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
          return () => window.clearInterval(interval);
        },
      }),
    [authorityBaseUrl],
  );
  useEffect(() => {
    let active = true;
    void authority.session().then(async (next) => {
      if (!active) return;
      setSession(next);
      if (next === null || routeId === 'admin-diagnostics') return;
      const result = await authority.list(collectionFor(routeId));
      if (active) setRecords(result.records);
    });
    return () => {
      active = false;
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
      <article data-admin-runtime="production">
        <h1>{copy[locale].denied}</h1>
        <p role="alert">{copy[locale].denied}</p>
      </article>
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
        session.role === 'security' ? (
          <DiagnosticAuthority authority={authority} locale={locale} />
        ) : (
          <p role="alert">{copy[locale].denied}</p>
        )
      ) : null}
      {routeId === 'admin-operations' && session.role === 'operations' ? (
        <CriticalCommand authority={authority} locale={locale} session={session} />
      ) : null}
      {routeId === 'admin-security' && session.role === 'security' ? (
        <BreakGlassReview authority={authority} locale={locale} />
      ) : null}
      {routeId !== 'admin-diagnostics' && routeId !== 'admin-operations' ? (
        <section aria-label={copy[locale].activeRole}>
          <ul>
            {records.map((record) => (
              <li key={record.id}>
                <strong>{record.id}</strong>{' '}
                {typeof record.redactedTarget === 'string' ? record.redactedTarget : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
};
