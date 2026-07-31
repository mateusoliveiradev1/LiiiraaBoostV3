'use client';

import { useParams } from 'next/navigation';
import { accountFailureLocale, createAccountFailureModel } from '../../account-errors';

export default function AccountNotFound() {
  const params = useParams<{ locale?: string | string[] }>();
  const requestedLocale = Array.isArray(params.locale) ? params.locale[0] : params.locale;
  const locale = accountFailureLocale(requestedLocale);
  const model = createAccountFailureModel('404', locale);

  return (
    <section aria-labelledby="account-404-title" className="account-failure">
      <span aria-hidden="true" className="account-failure__code">
        404
      </span>
      <h1 id="account-404-title" tabIndex={-1}>
        {model.copy.title}
      </h1>
      <p className="account-failure__detail">{model.copy.detail}</p>
      <p className="account-failure__safe-work" role="status">
        {model.copy.safeWork}
      </p>
      <div className="account-failure__actions">
        <a href={model.destinations.overview}>{model.copy.action}</a>
        <a href={model.destinations.support}>{model.copy.support}</a>
      </div>
      <p className="account-failure__correlation">
        {locale === 'pt-BR' ? 'Correlação' : 'Correlation'}: {model.correlationId}
      </p>
    </section>
  );
}
