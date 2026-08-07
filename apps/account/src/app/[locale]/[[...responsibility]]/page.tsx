import { matchWebRoute, routeHref, WEB_LOCALES, type WebLocale } from '@liiiraa/web-core';
import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { createAccountFailureModel, type AccountFailureKind } from '../../../account-errors';
import { AccountFailureView } from '../../../account-failure-view';
import {
  accountFailureKindForRoute,
  getAccountRouteMetadata,
  isAccountErrorRoute,
  isAccountRoute,
  type AccountErrorRoute,
  type AccountRoute,
} from '../../../account-production-model';
import { AccountAuthPage, type AccountAuthRoute } from '../../../features/account-auth';
import { AccountAuthorityPage } from '../../../features/account-authority';
import { ACCOUNT_BROWSER_AUTHORITY_BASE_URL } from '../../../account-runtime';

type AccountResponsibilityPageProps = Readonly<{
  params: Promise<{
    locale: string;
    responsibility?: readonly string[];
  }>;
}>;

const isAccountAuthRoute = (routeId: AccountRoute): routeId is AccountAuthRoute =>
  routeId === 'account-sign-in' || routeId === 'account-sign-up';

const pathnameFor = (locale: WebLocale, responsibility: readonly string[] | undefined): string =>
  `/${locale}/${responsibility?.join('/') ?? ''}`.replace(/\/$/u, '');

type AccountRouteResolution =
  | Readonly<{ kind: 'workflow'; routeId: AccountRoute }>
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
  if (isAccountRoute(match.value.route.id)) {
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
  if (resolution.kind === 'unknown') {
    const metadata = createAccountFailureModel('404', locale).copy;
    return {
      description: metadata.detail,
      title: `${metadata.title} — Liiiraa Boost`,
    };
  }
  if (resolution.kind === 'workflow') {
    const metadata = getAccountRouteMetadata(locale, resolution.routeId);
    return {
      description: metadata.summary,
      title: `${metadata.title} — Liiiraa Boost`,
    };
  }
  const metadata = createAccountFailureModel(resolution.failureKind, locale).copy;
  return {
    description: metadata.detail,
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
  if (resolution.kind !== 'workflow') {
    const failureKind = resolution.kind === 'unknown' ? '404' : resolution.failureKind;
    const model = createAccountFailureModel(failureKind, locale);
    const canonicalRoute =
      resolution.kind === 'error' ? routeHref(resolution.routeId, { locale }) : undefined;
    if (canonicalRoute !== undefined && !canonicalRoute.ok) notFound();
    const primaryHref =
      failureKind === '500' && canonicalRoute?.ok
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
        kind={failureKind}
        locale={model.locale}
        recovery={model.copy.recovery}
        safeWork={model.copy.safeWork}
        title={model.copy.title}
      />
    );
  }
  if (isAccountAuthRoute(resolution.routeId)) {
    return (
      <Suspense fallback={null}>
        <AccountAuthPage
          authorityBaseUrl={ACCOUNT_BROWSER_AUTHORITY_BASE_URL}
          locale={locale}
          routeId={resolution.routeId}
        />
      </Suspense>
    );
  }
  return (
    <AccountAuthorityPage
      authorityBaseUrl={ACCOUNT_BROWSER_AUTHORITY_BASE_URL}
      locale={locale}
      routeId={resolution.routeId}
    />
  );
}
