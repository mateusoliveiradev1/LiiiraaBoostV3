'use client';

import { useParams } from 'next/navigation';

import { CLIENT_WEB_LOCALES } from '../../public-client-boundary';
import { PublicNotFound } from '../../public-not-found';

export default function NotFound() {
  const params = useParams<{ locale?: string | string[] }>();
  const requestedLocale = Array.isArray(params.locale) ? params.locale[0] : params.locale;
  const locale = CLIENT_WEB_LOCALES.find((candidate) => candidate === requestedLocale) ?? 'pt-BR';

  return <PublicNotFound locale={locale} />;
}
