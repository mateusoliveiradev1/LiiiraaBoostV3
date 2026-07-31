import { matchWebRoute, routeHref, WEB_LOCALES, type WebLocale } from '@liiiraa/web-core';
import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { createAccountFailureModel, type AccountFailureKind } from '../../../account-errors';
import { AccountFailureView } from '../../../account-failure-view';
import {
  accountFailureKindForRoute,
  getAccountPreviewMetadata,
  isAccountErrorRoute,
  isAccountPreviewRoute,
  type AccountErrorRoute,
  type AccountPreviewRoute,
} from '../../../account-preview-model';
import { AccountPreviewPage } from '../../../features/account-preview';

type AccountResponsibilityPageProps = Readonly<{
  params: Promise<{
    locale: string;
    responsibility?: readonly string[];
  }>;
}>;

const pathnameFor = (locale: WebLocale, responsibility: readonly string[] | undefined): string =>
  `/${locale}/${responsibility?.join('/') ?? ''}`.replace(/\/$/u, '');

type AccountRouteResolution =
  | Readonly<{ kind: 'workflow'; routeId: AccountPreviewRoute }>
  | Readonly<{
      failureKind: AccountFailureKind;
      kind: 'error';
      routeId: AccountErrorRoute;
    }>
  | Readonly<{ kind: 'unknown' }>;

const resolveAccountRoute = (
  locale: WebLocale,
  responsibility: readonly string[] | undefined,
): AccountRouteResolution => {
  const match = matchWebRoute({
    pathname: pathnameFor(locale, responsibility),
    securityBoundary: 'account-origin',
  });
  if (!match.ok) return { kind: 'unknown' };
  if (isAccountPreviewRoute(match.value.route.id)) {
    return { kind: 'workflow', routeId: match.value.route.id };
  }
  if (isAccountErrorRoute(match.value.route.id)) {
    return {
      failureKind: accountFailureKindForRoute(match.value.route.id),
      kind: 'error',
      routeId: match.value.route.id,
    };
  }
  return { kind: 'unknown' };
};

export async function generateMetadata({
  params,
}: AccountResponsibilityPageProps): Promise<Metadata> {
  const { locale, responsibility } = await params;
  if (!hasLocale(WEB_LOCALES, locale)) return {};
  const resolution = resolveAccountRoute(locale, responsibility);
  if (resolution.kind === 'unknown') return {};
  if (resolution.kind === 'workflow') {
    const metadata = getAccountPreviewMetadata(locale, resolution.routeId);
    return {
      description: metadata.summary,
      robots: { follow: false, index: false, nocache: true },
      title: `${metadata.title} — Liiiraa Boost`,
    };
  }
  const metadata = createAccountFailureModel(resolution.failureKind, locale).copy;
  return {
    description: metadata.detail,
    robots: { follow: false, index: false, nocache: true },
    title: `${metadata.title} — Liiiraa Boost`,
  };
}

export default async function AccountResponsibilityPage({
  params,
}: AccountResponsibilityPageProps) {
  const { locale, responsibility } = await params;
  if (!hasLocale(WEB_LOCALES, locale)) notFound();
  setRequestLocale(locale);
  const resolution = resolveAccountRoute(locale, responsibility);
  if (resolution.kind === 'unknown') notFound();
  if (resolution.kind === 'error') {
    const model = createAccountFailureModel(resolution.failureKind, locale);
    const canonicalRoute = routeHref(resolution.routeId, { locale });
    if (!canonicalRoute.ok) notFound();
    const primaryHref =
      resolution.failureKind === '500'
        ? canonicalRoute.value
        : model.destinations.overview;
    return (
      <AccountFailureView
        action={
          <>
            <a href={primaryHref}>{model.copy.action}</a>
            <a href={model.destinations.support}>{model.copy.support}</a>
          </>
        }
        affected={model.copy.affectedCapability}
        correlationId={model.correlationId}
        detail={model.copy.detail}
        kind={model.code}
        locale={model.locale}
        recovery={model.copy.recovery}
        safeWork={model.copy.safeWork}
        title={model.copy.title}
      />
    );
  }
  return <AccountPreviewPage locale={locale} routeId={resolution.routeId} />;
}
