'use client';

import { useParams } from 'next/navigation';

import { ForbiddenState, localeFromFailureParams } from '../../../features/public-failure';

export default function ForbiddenPage() {
  const params = useParams<{ locale?: string | string[] }>();
  return <ForbiddenState locale={localeFromFailureParams(params.locale)} />;
}
