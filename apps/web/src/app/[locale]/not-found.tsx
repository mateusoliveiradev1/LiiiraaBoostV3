'use client';

import { useParams } from 'next/navigation';

import { routing } from '../../public-boundary';
import { PublicNotFound } from '../../public-not-found';

export default function NotFound() {
  const params = useParams<{ locale?: string | string[] }>();
  const requestedLocale = Array.isArray(params.locale) ? params.locale[0] : params.locale;
  const locale = routing.locales.find((candidate) => candidate === requestedLocale) ?? 'pt-BR';

  return <PublicNotFound locale={locale} />;
}
