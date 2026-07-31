import type { ReactNode } from 'react';

import type { AccountFailureKind } from './account-errors';

type AccountFailureViewProps = Readonly<{
  action: ReactNode;
  affected: string;
  correlationId: string;
  detail: string;
  kind: AccountFailureKind;
  locale: 'pt-BR' | 'en';
  recovery: string;
  safeWork: string;
  title: string;
}>;

export function AccountFailureView({
  action,
  affected,
  correlationId,
  detail,
  kind,
  locale,
  recovery,
  safeWork,
  title,
}: AccountFailureViewProps) {
  return (
    <section
      aria-labelledby={`account-${kind}-title`}
      className="account-failure"
      role={kind === '500' ? 'alert' : undefined}
    >
      <span aria-hidden="true" className="account-failure__code">
        {kind}
      </span>
      <h1 data-route-heading id={`account-${kind}-title`} tabIndex={-1}>
        {title}
      </h1>
      <p className="account-failure__affected">{affected}</p>
      <p className="account-failure__detail">{detail}</p>
      <p className="account-failure__recovery">{recovery}</p>
      <p className="account-failure__safe-work" role="status">
        {safeWork}
      </p>
      <div className="account-failure__actions">{action}</div>
      <p className="account-failure__correlation">
        {locale === 'pt-BR' ? 'Correlação redigida' : 'Redacted correlation'}: {correlationId}
      </p>
    </section>
  );
}
