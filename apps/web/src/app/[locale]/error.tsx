'use client';

import { useParams } from 'next/navigation';

import {
  localeFromFailureParams,
  opaqueErrorCorrelation,
  ServerFailureState,
} from '../../features/public-failure';

type PublicErrorBoundaryProps = Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>;

export default function PublicErrorBoundary({ error, reset }: PublicErrorBoundaryProps) {
  const params = useParams<{ locale?: string | string[] }>();
  return (
    <ServerFailureState
      correlationId={opaqueErrorCorrelation(error.digest)}
      locale={localeFromFailureParams(params.locale)}
      retry={reset}
    />
  );
}
