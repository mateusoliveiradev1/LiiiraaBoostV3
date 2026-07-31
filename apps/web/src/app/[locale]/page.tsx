import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';

import { CommandRunwayHome, getHomeContent } from '../../features/home';
import { routing } from '../../public-boundary';
import '../../styles/public.css';

type HomePageProps = Readonly<{
  params: Promise<{ locale: string }>;
}>;

export const generateMetadata = async ({ params }: HomePageProps): Promise<Metadata> => {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    return {};
  }

  const content = getHomeContent(locale);
  return {
    alternates: {
      canonical: `/${locale}`,
      languages: {
        en: '/en',
        'pt-BR': '/pt-BR',
      },
    },
    description: content.metadata.description,
    title: content.metadata.title,
  };
};

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return <CommandRunwayHome locale={locale} />;
}
