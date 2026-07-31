import { createAdminFailureModel } from '../../../../admin-errors';
import { AdminFailureView } from '../../../../admin-failure-view';

type AdminForbiddenPageProps = Readonly<{
  params: Promise<{ locale: string }>;
}>;

export default async function AdminForbidden({ params }: AdminForbiddenPageProps) {
  const { locale: requestedLocale } = await params;
  const locale =
    requestedLocale === 'en' || requestedLocale === 'pt-BR' ? requestedLocale : 'pt-BR';
  const model = createAdminFailureModel('403', locale);

  return (
    <AdminFailureView
      action={<a href={model.destinations.role}>{model.copy.action}</a>}
      affected={model.copy.affected}
      correlationId={model.correlationId}
      detail={model.copy.detail}
      kind="403"
      locale={locale}
      safeState={model.copy.safeState}
      title={model.copy.title}
    />
  );
}
