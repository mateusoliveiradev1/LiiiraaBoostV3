import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';

import {
  getPublicDownloadPageMetadata,
  PublicDownloadExperience,
} from '../../../features/releases';
import { routing } from '../../../public-boundary';

type PublicDownloadPageProps = Readonly<{
  params: Promise<{ locale: string }>;
}>;

export const generateMetadata = async ({ params }: PublicDownloadPageProps): Promise<Metadata> => {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};

  const copy = getPublicDownloadPageMetadata(locale);
  const canonical = `/${locale}/download`;
  const alternateLocale = locale === 'pt-BR' ? 'en' : 'pt-BR';

  return {
    alternates: {
      canonical,
      languages: {
        [locale]: canonical,
        [alternateLocale]: `/${alternateLocale}/download`,
      },
    },
    description: copy.description,
    robots: { follow: true, index: true },
    title: copy.title,
  };
};

export default async function PublicDownloadPage({ params }: PublicDownloadPageProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return <PublicDownloadExperience locale={locale} />;
}
