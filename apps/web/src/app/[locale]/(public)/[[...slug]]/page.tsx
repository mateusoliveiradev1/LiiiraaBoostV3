import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { matchWebRoute, type WebLocale, type WebRouteId } from '@liiiraa/web-core';

import {
  getPublicCatalogMetadata,
  getPublicEvidenceLegacyMetadata,
  PublicCatalogPage,
  PublicEvidenceLegacyPage,
  type CatalogSearchParameters,
} from '../../../../features/public-catalog';
import { DocumentationExperience } from '../../../../features/documentation';
import { CommandRunwayHome, getHomeContent } from '../../../../features/home';
import { ForbiddenState, GoneState, ServerFailureState } from '../../../../features/public-failure';
import { routing } from '../../../../public-boundary';

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
  'public-results',
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
  'public-error-403',
  'public-error-410',
  'public-error-500',
  'docs-index',
  'docs-task',
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
    resolution.routeId === 'public-home'
      ? getHomeContent(resolution.locale).metadata
      : resolution.routeId === 'public-evidence'
        ? getPublicEvidenceLegacyMetadata(resolution.locale)
      : resolution.routeId === 'docs-index' || resolution.routeId === 'docs-task'
        ? {
            title:
              resolution.locale === 'pt-BR' ? 'Documentação técnica' : 'Technical documentation',
            description:
              resolution.locale === 'pt-BR'
                ? 'Orientação versionada por tarefa, evidência, risco, compatibilidade e recuperação.'
                : 'Versioned task guidance with evidence, risk, compatibility, and recovery.',
          }
        : metadata;
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

  if (resolution.routeId === 'public-evidence') {
    return <PublicEvidenceLegacyPage locale={resolution.locale} />;
  }

  if (resolution.routeId === 'docs-index') {
    return (
      <DocumentationExperience
        request={{
          locale: resolution.locale,
          version: 'current',
          searchParams: resolvedSearchParams,
        }}
      />
    );
  }

  if (resolution.routeId === 'docs-task') {
    const section = slug?.at(-1);
    if (section === undefined) {
      notFound();
    }
    return (
      <DocumentationExperience
        request={{
          locale: resolution.locale,
          version: 'tasks',
          slug: [section],
          searchParams: resolvedSearchParams,
        }}
      />
    );
  }

  if (resolution.routeId === 'public-error-403') {
    return <ForbiddenState locale={resolution.locale} />;
  }

  if (resolution.routeId === 'public-error-410') {
    return <GoneState locale={resolution.locale} />;
  }

  if (resolution.routeId === 'public-error-500') {
    return <ServerFailureState locale={resolution.locale} />;
  }

  return (
    <PublicCatalogPage
      locale={resolution.locale}
      routeId={resolution.routeId}
      searchParams={resolvedSearchParams}
    />
  );
}
