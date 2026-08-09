'use client';

import { ProductIcon } from '@liiiraa/design-system';
import type { WebLocale } from '@liiiraa/web-core';
import type { Route } from 'next';
import Link from 'next/link';

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

const denialCopy = Object.freeze({
  en: Object.freeze({
    action: 'Return to overview',
    detail: 'No protected data was loaded and no hidden workspace identity was disclosed.',
    eyebrow: 'Protected boundary',
    summary:
      'This workspace is not available to the active administrative function. Choose an admitted domain from the navigation.',
    title: 'Workspace unavailable',
  }),
  'pt-BR': Object.freeze({
    action: 'Voltar à visão geral',
    detail: 'Nenhum dado protegido foi carregado e nenhuma identidade oculta da área foi revelada.',
    eyebrow: 'Limite protegido',
    summary:
      'Esta área não está disponível para a função administrativa ativa. Escolha um domínio admitido pela navegação.',
    title: 'Área indisponível',
  }),
});

const SafeWorkspaceDenial = ({ locale }: Readonly<{ locale: WebLocale }>) => {
  const labels = denialCopy[locale];
  return (
    <article className="admin-workspace-denial" data-admin-runtime="production">
      <span className="admin-workspace-denial__eyebrow">{labels.eyebrow}</span>
      <div className="admin-workspace-denial__panel" role="alert">
        <ProductIcon name="lock" size={24} />
        <div>
          <h1>{labels.title}</h1>
          <p>{labels.summary}</p>
          <small>{labels.detail}</small>
          <Link href={`/${locale}/admin` as Route}>{labels.action}</Link>
        </div>
      </div>
    </article>
  );
};

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
