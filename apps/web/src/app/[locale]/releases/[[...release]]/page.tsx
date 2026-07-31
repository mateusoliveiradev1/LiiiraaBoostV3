import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import {
  getReleasePageMetadata,
  ReleaseExperience,
  resolveReleasePage,
} from '../../../../features/releases';
import '../../../../styles/public.css';

type ReleasePageProps = Readonly<{
  params: Promise<{
    locale: string;
    release?: string[];
  }>;
}>;

const resolutionFrom = async (params: ReleasePageProps['params']) =>
  resolveReleasePage(await params);

const pathnameFrom = (locale: string, release: readonly string[] | undefined): string =>
  `/${locale}/releases${release === undefined || release.length === 0 ? '' : `/${release.join('/')}`}`;

export const generateMetadata = async ({ params }: ReleasePageProps): Promise<Metadata> => {
  const resolvedParams = await params;
  const resolution = resolveReleasePage(resolvedParams);
  if (resolution === undefined) return {};

  const copy = getReleasePageMetadata(resolution.locale);
  const canonical = pathnameFrom(resolution.locale, resolvedParams.release);
  const alternateLocale = resolution.locale === 'pt-BR' ? 'en' : 'pt-BR';

  return {
    alternates: {
      canonical,
      languages: {
        [resolution.locale]: canonical,
        [alternateLocale]: canonical.replace(`/${resolution.locale}/`, `/${alternateLocale}/`),
      },
    },
    description: copy.description,
    robots: { follow: true, index: true },
    title: copy.title,
  };
};

export default async function ReleasePage({ params }: ReleasePageProps) {
  const resolution = await resolutionFrom(params);
  if (resolution === undefined || resolution.routeId === 'releases-download') {
    notFound();
  }

  return <ReleaseExperience resolution={resolution} />;
}
