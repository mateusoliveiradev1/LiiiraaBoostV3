import { matchWebRoute, WEB_LOCALES, type WebLocale } from '@liiiraa/web-core';
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
import { AdminPreviewPage } from '../../../features/admin-preview';

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
      routeId: AdminPreviewRoute;
    }>;

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
  return isAdminPreviewRoute(routeId) ? Object.freeze({ kind: 'workflow', routeId }) : null;
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
  if (!adminRoleCanAccess(role, resolution.routeId)) {
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

  return <AdminPreviewPage locale={locale} role={role} routeId={resolution.routeId} />;
}
