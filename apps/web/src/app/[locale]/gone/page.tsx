'use client';

import { useParams } from 'next/navigation';

import { GoneState, localeFromFailureParams } from '../../../features/public-failure';

export default function GonePage() {
  const params = useParams<{ locale?: string | string[] }>();
  return <GoneState locale={localeFromFailureParams(params.locale)} />;
}
