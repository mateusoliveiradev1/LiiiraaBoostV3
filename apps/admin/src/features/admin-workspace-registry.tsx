'use client';

import type { WebLocale } from '@liiiraa/web-core';

import { AdminAccessGovernance } from './admin-access-governance';
import { AdminAuthorityPage, useAdminAuthority } from './admin-authority';
import { AdminInvitations } from './admin-invitations';
import { AdminOperationsSystem } from './admin-operations-system';
import { AdminOverview } from './admin-overview';
import { AdminQueueCanvas } from './admin-queue-canvas';
import { AdminRevenueSupport } from './admin-revenue-support';
import {
  adminSessionCanOpenWorkspace,
  resolveAdminWorkspaceRecordId,
  resolveAdminWorkspaceDefinition,
  type AdminCanonicalRouteId,
  type AdminWorkspaceDefinition,
} from './admin-workspace-registry-model';

const SafeWorkspaceDenial = ({ locale }: Readonly<{ locale: WebLocale }>) => (
  <article data-admin-runtime="production">
    <h1>{locale === 'pt-BR' ? 'Área indisponível' : 'Workspace unavailable'}</h1>
    <p role="alert">
      {locale === 'pt-BR'
        ? 'Esta área não está disponível para a função administrativa ativa. Nenhuma existência foi revelada.'
        : 'This workspace is not available to the active administrative function. No existence was disclosed.'}
    </p>
  </article>
);

const Workspace = ({
  definition,
  locale,
  recordId,
}: Readonly<{
  definition: AdminWorkspaceDefinition;
  locale: WebLocale;
  recordId: string | undefined;
}>) => {
  const selection = recordId === undefined ? {} : { initialSelectedId: recordId };
  if (definition.kind === 'overview') return <AdminOverview locale={locale} />;
  if (definition.kind === 'queue') return <AdminQueueCanvas {...selection} locale={locale} />;
  if (definition.kind === 'invitations') return <AdminInvitations {...selection} locale={locale} />;
  if (definition.kind === 'access-governance')
    return <AdminAccessGovernance {...selection} locale={locale} />;
  if (definition.kind === 'revenue')
    return <AdminRevenueSupport {...selection} locale={locale} surface="revenue" />;
  if (definition.kind === 'support')
    return <AdminRevenueSupport {...selection} locale={locale} surface="support" />;
  if (definition.kind === 'operation')
    return <AdminOperationsSystem {...selection} locale={locale} surface="operation" />;
  if (definition.kind === 'security')
    return <AdminOperationsSystem {...selection} locale={locale} surface="security" />;
  return <AdminOperationsSystem {...selection} locale={locale} surface="system" />;
};

export const AdminWorkspaceRegistry = ({
  locale,
  routeId,
  routeParameters = Object.freeze({}),
}: Readonly<{
  locale: WebLocale;
  routeId: AdminCanonicalRouteId;
  routeParameters?: Readonly<Record<string, string>>;
}>) => {
  const { session } = useAdminAuthority();
  const definition = resolveAdminWorkspaceDefinition(routeId);
  if (definition === null) return <SafeWorkspaceDenial locale={locale} />;
  if (session === null || session === undefined)
    return <AdminAuthorityPage locale={locale} routeId="admin-role" />;
  if (!adminSessionCanOpenWorkspace(definition, locale, session.role))
    return <SafeWorkspaceDenial locale={locale} />;
  const recordId = resolveAdminWorkspaceRecordId(routeId, routeParameters);
  return <Workspace definition={definition} locale={locale} recordId={recordId} />;
};
