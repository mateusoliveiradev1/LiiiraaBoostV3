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
}: Readonly<{ definition: AdminWorkspaceDefinition; locale: WebLocale }>) => {
  if (definition.kind === 'overview') return <AdminOverview locale={locale} />;
  if (definition.kind === 'queue') return <AdminQueueCanvas locale={locale} />;
  if (definition.kind === 'invitations') return <AdminInvitations locale={locale} />;
  if (definition.kind === 'access-governance') return <AdminAccessGovernance locale={locale} />;
  if (definition.kind === 'revenue')
    return <AdminRevenueSupport locale={locale} surface="revenue" />;
  if (definition.kind === 'support')
    return <AdminRevenueSupport locale={locale} surface="support" />;
  if (definition.kind === 'operation')
    return <AdminOperationsSystem locale={locale} surface="operation" />;
  if (definition.kind === 'security')
    return <AdminOperationsSystem locale={locale} surface="security" />;
  return <AdminOperationsSystem locale={locale} surface="system" />;
};

export const AdminWorkspaceRegistry = ({
  locale,
  routeId,
}: Readonly<{ locale: WebLocale; routeId: AdminCanonicalRouteId }>) => {
  const { session } = useAdminAuthority();
  const definition = resolveAdminWorkspaceDefinition(routeId);
  if (definition === null) return <SafeWorkspaceDenial locale={locale} />;
  if (session === null || session === undefined)
    return <AdminAuthorityPage locale={locale} routeId="admin-role" />;
  if (!adminSessionCanOpenWorkspace(definition, locale, session.role))
    return <SafeWorkspaceDenial locale={locale} />;
  return <Workspace definition={definition} locale={locale} />;
};
