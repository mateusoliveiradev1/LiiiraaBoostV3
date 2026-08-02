import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import {
  getReleasePageMetadata,
  ReleaseExperience,
  resolveDownloadPage,
} from '../../../../../features/releases';

type DownloadPageProps = Readonly<{
  params: Promise<{
    channel: string;
    locale: string;
    version: string;
  }>;
}>;

export const generateMetadata = async ({ params }: DownloadPageProps): Promise<Metadata> => {
  const resolution = resolveDownloadPage(await params);
  if (resolution === undefined) return {};

  const copy = getReleasePageMetadata(resolution.locale);
  const canonical = `/${resolution.locale}/download/${resolution.channel}/${resolution.version}`;
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
    robots: { follow: false, index: false },
    title: copy.title,
  };
};

export default async function DownloadPage({ params }: DownloadPageProps) {
  const resolution = resolveDownloadPage(await params);
  if (resolution === undefined || resolution.routeId !== 'releases-download') {
    notFound();
  }

  return <ReleaseExperience resolution={resolution} />;
}
