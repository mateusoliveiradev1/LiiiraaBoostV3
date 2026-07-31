import {
  matchWebRoute,
  WEB_LOCALES,
  type WebLocale,
} from '@liiiraa/web-core';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { createAdminFailureModel } from '../../../admin-errors';
import { AdminFailureView } from '../../../admin-failure-view';
import { adminRoleFromHeader } from '../../../admin-shell';
import {
  AdminPreviewPage,
  adminRoleCanAccess,
  getAdminPreviewMetadata,
  isAdminPreviewRoute,
  type AdminPreviewRoute,
} from '../../../features/admin-preview';

type AdminWorkspacePageProps = Readonly<{
  params: Promise<{
    locale: string;
    workspace?: readonly string[];
  }>;
}>;

const pathnameFor = (locale: WebLocale, workspace: readonly string[] | undefined): string =>
  `/${locale}/${workspace?.join('/') ?? ''}`.replace(/\/$/u, '');

const resolveAdminWorkspace = (
  locale: WebLocale,
  workspace: readonly string[] | undefined,
): AdminPreviewRoute | null => {
  const match = matchWebRoute({
    pathname: pathnameFor(locale, workspace),
    securityBoundary: 'admin-origin',
  });
  return match.ok && isAdminPreviewRoute(match.value.route.id) ? match.value.route.id : null;
};

export async function generateMetadata({ params }: AdminWorkspacePageProps): Promise<Metadata> {
  const { locale, workspace } = await params;
  if (!hasLocale(WEB_LOCALES, locale)) return {};
  const routeId = resolveAdminWorkspace(locale, workspace);
  if (routeId === null) return {};
  const metadata = getAdminPreviewMetadata(locale, routeId);
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

  const locale = requestedLocale as WebLocale;
  const routeId = resolveAdminWorkspace(locale, workspace);
  if (routeId === null) notFound();

  const requestHeaders = await headers();
  const role = adminRoleFromHeader(requestHeaders.get('x-liiiraa-admin-role'));
  if (!adminRoleCanAccess(role, routeId)) {
    const model = createAdminFailureModel('403', locale);
    const roleHref = role === 'support' ? model.destinations.role : `${model.destinations.role}?role=${role}`;
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

  return <AdminPreviewPage locale={locale} role={role} routeId={routeId} />;
}

