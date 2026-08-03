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
import { publicBoundaryHref } from '../../../../public-boundary';
import catalogEnJson from '../../../../content/public/catalog.en.json';
import catalogPtBrJson from '../../../../content/public/catalog.pt-BR.json';

type PublicCatchAllPageProps = Readonly<{
  params: Promise<{
    locale: string;
    slug?: string[];
  }>;
  searchParams: Promise<CatalogSearchParameters>;
}>;

const CATALOG_ROUTES = new Set<WebRouteId>([
  'public-home',
  'public-about',
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

const ABOUT_CHAPTER_IDS = Object.freeze([
  'motivation',
  'principles',
  'trust',
  'reversibility',
  'ambition',
] as const);

type AboutChapterId = (typeof ABOUT_CHAPTER_IDS)[number];

type AboutContent = Readonly<{
  routeId: 'public-about';
  metadata: Readonly<{ title: string; description: string }>;
  title: string;
  lead: string;
  chapters: readonly Readonly<{ id: AboutChapterId; title: string; body: string }>[];
  cta: Readonly<{ label: string; routeId: 'public-product' }>;
}>;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const admitAboutContent = (candidate: unknown, locale: WebLocale): AboutContent => {
  if (
    !isRecord(candidate) ||
    candidate['routeId'] !== 'public-about' ||
    !isRecord(candidate['metadata']) ||
    !isNonEmptyString(candidate['metadata']['title']) ||
    !isNonEmptyString(candidate['metadata']['description']) ||
    !isNonEmptyString(candidate['title']) ||
    !isNonEmptyString(candidate['lead']) ||
    !Array.isArray(candidate['chapters']) ||
    candidate['chapters'].length !== ABOUT_CHAPTER_IDS.length ||
    !isRecord(candidate['cta']) ||
    !isNonEmptyString(candidate['cta']['label']) ||
    candidate['cta']['routeId'] !== 'public-product'
  ) {
    throw new Error(`PUBLIC_ABOUT_INVALID:${locale}:root`);
  }

  for (const [index, chapter] of candidate['chapters'].entries()) {
    if (
      !isRecord(chapter) ||
      chapter['id'] !== ABOUT_CHAPTER_IDS[index] ||
      !isNonEmptyString(chapter['title']) ||
      !isNonEmptyString(chapter['body'])
    ) {
      throw new Error(`PUBLIC_ABOUT_INVALID:${locale}:chapter:${String(index)}`);
    }
  }

  return candidate as unknown as AboutContent;
};

const ABOUT_CONTENT = Object.freeze({
  en: admitAboutContent(catalogEnJson.about, 'en'),
  'pt-BR': admitAboutContent(catalogPtBrJson.about, 'pt-BR'),
});

const PublicAboutPage = ({ locale }: Readonly<{ locale: WebLocale }>) => {
  const content = ABOUT_CONTENT[locale];

  return (
    <article className="public-about">
      <header className="public-about__hero">
        <div className="public-about__introduction">
          <h1>{content.title}</h1>
          <p>{content.lead}</p>
        </div>
        <a
          className="public-action public-action--quiet public-about__action"
          href={publicBoundaryHref(content.cta.routeId, locale)}
        >
          {content.cta.label}
          <span aria-hidden="true">→</span>
        </a>
      </header>

      <div className="public-about__chapters">
        {content.chapters.map((chapter) => (
          <section
            aria-labelledby={`about-${chapter.id}`}
            className="public-about__chapter"
            data-chapter={chapter.id}
            id={chapter.id === 'principles' ? 'principles' : undefined}
            key={chapter.id}
          >
            <h2 id={`about-${chapter.id}`}>{chapter.title}</h2>
            <p>{chapter.body}</p>
          </section>
        ))}
      </div>
    </article>
  );
};

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
      : resolution.routeId === 'public-about'
        ? ABOUT_CONTENT[resolution.locale].metadata
        : resolution.routeId === 'public-evidence'
          ? getPublicEvidenceLegacyMetadata(resolution.locale)
          : resolution.routeId === 'docs-index' || resolution.routeId === 'docs-task'
            ? {
                title:
                  resolution.locale === 'pt-BR'
                    ? 'Documentação técnica'
                    : 'Technical documentation',
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

  if (resolution.routeId === 'public-about') {
    return <PublicAboutPage locale={resolution.locale} />;
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
