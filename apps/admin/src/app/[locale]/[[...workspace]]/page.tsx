import {
  ADMIN_CANONICAL_ROUTE_IDS,
  matchWebRoute,
  WEB_LOCALES,
  type WebLocale,
  type WebRouteId,
} from '@liiiraa/web-core';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { createAdminFailureModel, type AdminFailureKind } from '../../../admin-errors';
import { AdminFailureView } from '../../../admin-failure-view';
import { adminRoleFromHeader } from '../../../admin-shell';
import {
  adminFailureKindForRoute,
  adminRoleCanAccess,
  getAdminPreviewMetadata,
  isAdminErrorRoute,
  isAdminPreviewRoute,
  type AdminErrorRoute,
  type AdminPreviewRoute,
} from '../../../admin-preview-model';
import { AdminAuthorityPage } from '../../../features/admin-authority';
import { AdminWorkspaceRegistry } from '../../../features/admin-workspace-registry';
import type { AdminCanonicalRouteId } from '../../../features/admin-workspace-registry-model';
import { resolveAdminServerRuntimeConfig } from '../../../admin-runtime-server';

type AdminWorkspacePageProps = Readonly<{
  params: Promise<{
    locale: string;
    workspace?: readonly string[];
  }>;
}>;

const pathnameFor = (locale: WebLocale, workspace: readonly string[] | undefined): string =>
  `/${locale}/${workspace?.join('/') ?? ''}`.replace(/\/$/u, '');

type AdminWorkspaceResolution =
  | Readonly<{
      failureKind: AdminFailureKind;
      kind: 'error';
      routeId: AdminErrorRoute;
    }>
  | Readonly<{
      kind: 'workflow';
      parameters: Readonly<Record<string, string>>;
      routeId: AdminCanonicalRouteId | AdminPreviewRoute;
    }>;

const canonicalAdminRoutes = new Set<WebRouteId>(ADMIN_CANONICAL_ROUTE_IDS);
const isCanonicalAdminRoute = (routeId: WebRouteId): routeId is AdminCanonicalRouteId =>
  canonicalAdminRoutes.has(routeId);

const resolveAdminWorkspace = (
  locale: WebLocale,
  workspace: readonly string[] | undefined,
): AdminWorkspaceResolution | null => {
  const match = matchWebRoute({
    pathname: pathnameFor(locale, workspace),
    securityBoundary: 'admin-origin',
  });
  if (!match.ok) return null;

  const routeId = match.value.route.id;
  if (isAdminErrorRoute(routeId)) {
    const failureKind = adminFailureKindForRoute(routeId);
    if (failureKind === undefined) return null;
    return Object.freeze({ failureKind, kind: 'error', routeId });
  }
  return isAdminPreviewRoute(routeId) || isCanonicalAdminRoute(routeId)
    ? Object.freeze({ kind: 'workflow', parameters: match.value.parameters, routeId })
    : null;
};

const canonicalWorkspaceMetadata = (locale: WebLocale, routeId: AdminCanonicalRouteId) => {
  const domain =
    routeId === 'admin-overview'
      ? locale === 'pt-BR'
        ? 'Visão geral'
        : 'Overview'
      : routeId.startsWith('admin-people')
        ? locale === 'pt-BR'
          ? 'Pessoas'
          : 'People'
        : routeId.startsWith('admin-revenue')
          ? locale === 'pt-BR'
            ? 'Receita'
            : 'Revenue'
          : routeId.startsWith('admin-operation')
            ? locale === 'pt-BR'
              ? 'Operação'
              : 'Operation'
            : routeId.startsWith('admin-support')
              ? locale === 'pt-BR'
                ? 'Atendimento'
                : 'Support'
              : routeId.startsWith('admin-security')
                ? locale === 'pt-BR'
                  ? 'Segurança'
                  : 'Security'
                : routeId.startsWith('admin-system')
                  ? locale === 'pt-BR'
                    ? 'Sistema'
                    : 'System'
                  : locale === 'pt-BR'
                    ? 'Fila administrativa'
                    : 'Administrative queue';
  return {
    summary:
      locale === 'pt-BR'
        ? 'Área administrativa isolada, autorizada pelo servidor e auditável.'
        : 'Isolated, server-authorized, and auditable administrative workspace.',
    title: domain,
  };
};

export async function generateMetadata({ params }: AdminWorkspacePageProps): Promise<Metadata> {
  const { locale, workspace } = await params;
  if (!hasLocale(WEB_LOCALES, locale)) return {};
  const resolution = resolveAdminWorkspace(locale, workspace);
  if (resolution === null) return {};
  const metadata =
    resolution.kind === 'error'
      ? (() => {
          const copy = createAdminFailureModel(resolution.failureKind, locale).copy;
          return { summary: copy.detail, title: copy.title };
        })()
      : isCanonicalAdminRoute(resolution.routeId)
        ? canonicalWorkspaceMetadata(locale, resolution.routeId)
        : getAdminPreviewMetadata(locale, resolution.routeId);
  return {
    description: metadata.summary,
    robots: { follow: false, index: false, nocache: true },
    title: `${metadata.title} — Liiiraa Boost Admin`,
  };
}

export default async function AdminWorkspacePage({ params }: AdminWorkspacePageProps) {
  const { locale: requestedLocale, workspace } = await params;
  if (!hasLocale(WEB_LOCALES, requestedLocale)) notFound();
  setRequestLocale(requestedLocale);

  const locale = requestedLocale;
  const resolution = resolveAdminWorkspace(locale, workspace);
  if (resolution === null) notFound();

  if (resolution.kind === 'error') {
    const model = createAdminFailureModel(resolution.failureKind, locale);
    return (
      <AdminFailureView
        action={<a href={model.destinations.role}>{model.copy.action}</a>}
        affected={model.copy.affected}
        correlationId={model.correlationId}
        detail={model.copy.detail}
        kind={model.kind}
        locale={model.locale}
        safeState={model.copy.safeState}
        title={model.copy.title}
      />
    );
  }

  const requestHeaders = await headers();
  const role = adminRoleFromHeader(requestHeaders.get('x-liiiraa-admin-role'));
  const runtime = resolveAdminServerRuntimeConfig();
  if (
    runtime.kind === 'preview' &&
    (!isAdminPreviewRoute(resolution.routeId) || !adminRoleCanAccess(role, resolution.routeId))
  ) {
    const model = createAdminFailureModel('403', locale);
    const roleHref =
      role === 'support' ? model.destinations.role : `${model.destinations.role}?role=${role}`;
    return (
      <AdminFailureView
        action={<a href={roleHref}>{model.copy.action}</a>}
        affected={model.copy.affected}
        correlationId={model.correlationId}
        detail={model.copy.detail}
        kind={model.kind}
        locale={model.locale}
        safeState={model.copy.safeState}
        title={model.copy.title}
      />
    );
  }

  if (runtime.kind === 'preview') {
    const { AdminPreviewPage } = await import('../../../features/admin-preview');
    if (!isAdminPreviewRoute(resolution.routeId)) notFound();
    return <AdminPreviewPage locale={locale} role={role} routeId={resolution.routeId} />;
  }

  return isCanonicalAdminRoute(resolution.routeId) ? (
    <AdminWorkspaceRegistry
      locale={locale}
      routeId={resolution.routeId}
      routeParameters={resolution.parameters}
    />
  ) : (
    <AdminAuthorityPage locale={locale} routeId={resolution.routeId} />
  );
}
