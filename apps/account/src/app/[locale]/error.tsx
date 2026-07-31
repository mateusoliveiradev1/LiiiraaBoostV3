'use client';

import { useParams } from 'next/navigation';
import { accountFailureLocale, createAccountFailureModel } from '../../account-errors';

type AccountErrorProps = Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>;

export default function AccountError({ error, reset }: AccountErrorProps) {
  const params = useParams<{ locale?: string | string[] }>();
  const requestedLocale = Array.isArray(params.locale) ? params.locale[0] : params.locale;
  const locale = accountFailureLocale(requestedLocale);
  const model = createAccountFailureModel('500', locale, error.digest);

  return (
    <section
      aria-labelledby="account-500-title"
      className="account-failure"
      role="alert"
    >
      <span aria-hidden="true" className="account-failure__code">
        500
      </span>
      <h1 id="account-500-title" tabIndex={-1}>
        {model.copy.title}
      </h1>
      <p className="account-failure__detail">{model.copy.detail}</p>
      <p className="account-failure__safe-work">{model.copy.safeWork}</p>
      <div className="account-failure__actions">
        <button onClick={reset} type="button">
          {model.copy.action}
        </button>
        <a href={model.destinations.support}>{model.copy.support}</a>
      </div>
      <p className="account-failure__correlation">
        {locale === 'pt-BR' ? 'Correlação' : 'Correlation'}: {model.correlationId}
      </p>
    </section>
  );
}
