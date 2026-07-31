import type { ReactNode } from 'react';

import type { AdminFailureKind } from './admin-errors';

type AdminFailureViewProps = Readonly<{
  action: ReactNode;
  affected: string;
  correlationId: string;
  detail: string;
  kind: AdminFailureKind;
  locale: 'pt-BR' | 'en';
  safeState: string;
  title: string;
}>;

export function AdminFailureView({
  action,
  affected,
  correlationId,
  detail,
  kind,
  locale,
  safeState,
  title,
}: AdminFailureViewProps) {
  return (
    <section
      aria-labelledby={`admin-${kind}-title`}
      className="admin-failure"
      role={kind === '500' ? 'alert' : undefined}
    >
      <span aria-hidden="true" className="admin-failure__code">
        {kind}
      </span>
      <h1 data-route-heading id={`admin-${kind}-title`} tabIndex={-1}>
        {title}
      </h1>
      <p className="admin-failure__affected">{affected}</p>
      <p className="admin-failure__detail">{detail}</p>
      <p className="admin-failure__safe-state" role="status">
        {safeState}
      </p>
      <div className="admin-failure__actions">{action}</div>
      <p className="admin-failure__correlation">
        {locale === 'pt-BR' ? 'Correlação redigida' : 'Redacted correlation'}: {correlationId}
      </p>
    </section>
  );
}
