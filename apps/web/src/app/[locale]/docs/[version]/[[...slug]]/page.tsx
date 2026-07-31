import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';

import {
  DocumentationExperience,
  resolveDocumentationPage,
  type DocumentationSearchParameters,
} from '../../../../../features/documentation';
import { routing } from '../../../../../public-boundary';

type DocumentationRoutePageProps = Readonly<{
  params: Promise<{
    locale: string;
    slug?: string[];
    version: string;
  }>;
  searchParams: Promise<DocumentationSearchParameters>;
}>;

const requestFrom = ({ locale, slug, version }: Awaited<DocumentationRoutePageProps['params']>) => {
  if (!hasLocale(routing.locales, locale)) {
    return undefined;
  }
  return {
    locale,
    version,
    ...(slug === undefined ? {} : { slug }),
  } as const;
};

export const generateMetadata = async ({
  params,
}: DocumentationRoutePageProps): Promise<Metadata> => {
  const request = requestFrom(await params);
  if (request === undefined) {
    return {};
  }
  const resolution = resolveDocumentationPage(request);
  if (resolution === undefined) {
    return {};
  }
  const canonical =
    resolution.kind === 'article'
      ? new URL(resolution.href).pathname
      : `/${resolution.locale}/docs/${resolution.version}`;
  const alternateLocale = resolution.locale === 'pt-BR' ? 'en' : 'pt-BR';
  const alternate = canonical.replace(`/${resolution.locale}/`, `/${alternateLocale}/`);
  const title =
    resolution.kind === 'article'
      ? resolution.document.title
      : resolution.locale === 'pt-BR'
        ? 'Documentação técnica'
        : 'Technical documentation';
  const description =
    resolution.kind === 'article'
      ? resolution.document.summary
      : resolution.locale === 'pt-BR'
        ? 'Orientação versionada por tarefa, evidência, risco, compatibilidade e recuperação.'
        : 'Versioned task guidance with evidence, risk, compatibility, and recovery.';

  return {
    alternates: {
      canonical,
      languages: {
        [resolution.locale]: canonical,
        [alternateLocale]: alternate,
      },
    },
    description,
    robots:
      resolution.kind === 'article' && resolution.status === 'stale'
        ? { follow: true, index: false }
        : { follow: true, index: true },
    title,
  };
};

export default async function DocumentationPage({
  params,
  searchParams,
}: DocumentationRoutePageProps) {
  const request = requestFrom(await params);
  if (request === undefined || resolveDocumentationPage(request) === undefined) {
    notFound();
  }
  return (
    <DocumentationExperience
      request={{
        ...request,
        searchParams: await searchParams,
      }}
    />
  );
}
