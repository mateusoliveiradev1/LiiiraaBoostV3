import { matchWebRoute, WEB_LOCALES, type WebLocale } from '@liiiraa/web-core';
import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import {
  AccountPreviewPage,
  getAccountPreviewMetadata,
  isAccountPreviewRoute,
  type AccountPreviewRoute,
} from '../../../features/account-preview';

type AccountResponsibilityPageProps = Readonly<{
  params: Promise<{
    locale: string;
    responsibility?: readonly string[];
  }>;
}>;

const pathnameFor = (locale: WebLocale, responsibility: readonly string[] | undefined): string =>
  `/${locale}/${responsibility?.join('/') ?? ''}`.replace(/\/$/u, '');

const resolveAccountResponsibility = (
  locale: WebLocale,
  responsibility: readonly string[] | undefined,
): AccountPreviewRoute | null => {
  const match = matchWebRoute({
    pathname: pathnameFor(locale, responsibility),
    securityBoundary: 'account-origin',
  });
  return match.ok && isAccountPreviewRoute(match.value.route.id) ? match.value.route.id : null;
};

export async function generateMetadata({
  params,
}: AccountResponsibilityPageProps): Promise<Metadata> {
  const { locale, responsibility } = await params;
  if (!hasLocale(WEB_LOCALES, locale)) return {};
  const routeId = resolveAccountResponsibility(locale, responsibility);
  if (routeId === null) return {};
  const metadata = getAccountPreviewMetadata(locale, routeId);
  return {
    description: metadata.summary,
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
  const routeId = resolveAccountResponsibility(locale, responsibility);
  if (routeId === null) notFound();
  return <AccountPreviewPage locale={locale} routeId={routeId} />;
}
