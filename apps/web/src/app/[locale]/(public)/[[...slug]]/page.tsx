import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { matchWebRoute, type WebLocale, type WebRouteId } from '@liiiraa/web-core';

import {
  getPublicCatalogMetadata,
  PublicCatalogPage,
  type CatalogSearchParameters,
} from '../../../../features/public-catalog';
import { CommandRunwayHome, getHomeContent } from '../../../../features/home';
import { routing } from '../../../../public-boundary';
import '../../../../styles/public.css';

type PublicCatchAllPageProps = Readonly<{
  params: Promise<{
    locale: string;
    slug?: string[];
  }>;
  searchParams: Promise<CatalogSearchParameters>;
}>;

const CATALOG_ROUTES = new Set<WebRouteId>([
  'public-home',
  'public-product',
  'public-evidence',
  'public-compatibility',
  'public-plans',
  'public-search',
  'public-support',
  'public-status',
  'public-policies',
  'public-privacy-policy',
  'public-terms',
  'public-responsible-disclosure',
]);

const resolvePublicCatalogRoute = (
  locale: string,
  slug: readonly string[] | undefined,
): Readonly<{ locale: WebLocale; routeId: WebRouteId }> | undefined => {
  if (!hasLocale(routing.locales, locale)) {
    return undefined;
  }

  const pathname =
    slug === undefined || slug.length === 0 ? `/${locale}` : `/${locale}/${slug.join('/')}`;
  const resolution = matchWebRoute({
    pathname,
    securityBoundary: 'public-origin',
  });

  if (!resolution.ok || !CATALOG_ROUTES.has(resolution.value.route.id)) {
    return undefined;
  }

  return {
    locale,
    routeId: resolution.value.route.id,
  };
};

export const generateMetadata = async ({ params }: PublicCatchAllPageProps): Promise<Metadata> => {
  const { locale, slug } = await params;
  const resolution = resolvePublicCatalogRoute(locale, slug);
  if (resolution === undefined) return {};

  const metadata = getPublicCatalogMetadata(resolution.locale, resolution.routeId);
  const resolvedMetadata =
    resolution.routeId === 'public-home' ? getHomeContent(resolution.locale).metadata : metadata;
  if (resolvedMetadata === undefined) return {};

  const pathname =
    slug === undefined || slug.length === 0
      ? `/${resolution.locale}`
      : `/${resolution.locale}/${slug.join('/')}`;
  return {
    alternates: {
      canonical: pathname,
      languages: {
        en: pathname.replace(`/${resolution.locale}`, '/en'),
        'pt-BR': pathname.replace(`/${resolution.locale}`, '/pt-BR'),
      },
    },
    description: resolvedMetadata.description,
    title: resolvedMetadata.title,
  };
};

export default async function PublicCatchAllPage({
  params,
  searchParams,
}: PublicCatchAllPageProps) {
  const [{ locale, slug }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const resolution = resolvePublicCatalogRoute(locale, slug);

  if (resolution === undefined) {
    notFound();
  }

  if (resolution.routeId === 'public-home') {
    return <CommandRunwayHome locale={resolution.locale} />;
  }

  return (
    <PublicCatalogPage
      locale={resolution.locale}
      routeId={resolution.routeId}
      searchParams={resolvedSearchParams}
    />
  );
}
