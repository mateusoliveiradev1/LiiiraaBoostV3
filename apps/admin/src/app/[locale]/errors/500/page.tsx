import { createAdminFailureModel } from '../../../../admin-errors';
import { AdminFailureView } from '../../../../admin-failure-view';

type AdminFailurePreviewPageProps = Readonly<{
  params: Promise<{ locale: string }>;
}>;

export default async function AdminFailurePreview({ params }: AdminFailurePreviewPageProps) {
  const { locale: requestedLocale } = await params;
  const locale =
    requestedLocale === 'en' || requestedLocale === 'pt-BR' ? requestedLocale : 'pt-BR';
  const model = createAdminFailureModel('500', locale);

  return (
    <AdminFailureView
      action={<a href={model.destinations.role}>{model.copy.action}</a>}
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
