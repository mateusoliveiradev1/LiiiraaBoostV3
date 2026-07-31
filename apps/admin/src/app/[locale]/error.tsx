'use client';

import { useParams } from 'next/navigation';

import { createAdminFailureModel } from '../../admin-errors';
import { AdminFailureView } from '../../admin-failure-view';

type AdminErrorProps = Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>;

export default function AdminError({ error, reset }: AdminErrorProps) {
  const params = useParams<{ locale?: string | string[] }>();
  const requestedLocale = Array.isArray(params.locale) ? params.locale[0] : params.locale;
  const locale =
    requestedLocale === 'en' || requestedLocale === 'pt-BR' ? requestedLocale : 'pt-BR';
  const model = createAdminFailureModel('500', locale, error.digest);

  return (
    <AdminFailureView
      action={
        <>
          <button onClick={reset} type="button">
            {model.copy.action}
          </button>
          <a href={model.destinations.role}>
            {locale === 'pt-BR' ? 'Voltar à área da função' : 'Return to role workspace'}
          </a>
        </>
      }
      affected={model.copy.affected}
      correlationId={model.correlationId}
      detail={model.copy.detail}
      kind="500"
      locale={locale}
      safeState={model.copy.safeState}
      title={model.copy.title}
    />
  );
}
