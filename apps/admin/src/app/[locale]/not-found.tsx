'use client';

import { useParams } from 'next/navigation';

import { createAdminFailureModel } from '../../admin-errors';
import { AdminFailureView } from '../../admin-failure-view';

export default function AdminNotFound() {
  const params = useParams<{ locale?: string | string[] }>();
  const requestedLocale = Array.isArray(params.locale) ? params.locale[0] : params.locale;
  const locale =
    requestedLocale === 'en' || requestedLocale === 'pt-BR' ? requestedLocale : 'pt-BR';
  const model = createAdminFailureModel('404', locale);

  return (
    <AdminFailureView
      action={<a href={model.destinations.role}>{model.copy.action}</a>}
      affected={model.copy.affected}
      correlationId={model.correlationId}
      detail={model.copy.detail}
      kind="404"
      locale={locale}
      safeState={model.copy.safeState}
      title={model.copy.title}
    />
  );
}
