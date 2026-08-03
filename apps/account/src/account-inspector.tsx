'use client';

import { ProductIcon } from '@liiiraa/design-system';

type AccountInspectorCopy = Readonly<{
  accountIdentity: string;
  accountState: string;
  deviceAction: string;
  deviceDetail: string;
  deviceTitle: string;
  mfa: string;
  passkey: string;
  planAction: string;
  planDetail: string;
  planPeriod: string;
  planSection: string;
  planTitle: string;
  securityAction: string;
  securityTitle: string;
  supportAction: string;
  supportTitle: string;
}>;

export type AccountInspectorProps = Readonly<{
  copy: AccountInspectorCopy;
  deviceHref: string;
  securityHref: string;
  subscriptionHref: string;
  supportHref: string;
}>;

export function AccountInspector({
  copy,
  deviceHref,
  securityHref,
  subscriptionHref,
  supportHref,
}: AccountInspectorProps) {
  return (
    <div className="account-inspector__content">
      <div className="account-inspector__account">
        <span aria-hidden="true" className="account-identity__avatar">
          AP
        </span>
        <span className="account-identity__copy">
          <strong>Astra Player</strong>
          <span>{copy.accountIdentity}</span>
          <span>{copy.accountState}</span>
        </span>
      </div>

      <section className="account-inspector__section">
        <span className="account-inspector__label">{copy.planSection}</span>
        <h2>{copy.planTitle}</h2>
        <p>{copy.planDetail}</p>
        <p>{copy.planPeriod}</p>
        <a href={subscriptionHref}>
          {copy.planAction} <ProductIcon name="arrowRight" size={16} />
        </a>
      </section>

      <section className="account-inspector__section">
        <span className="account-inspector__label">{copy.deviceTitle}</span>
        <div className="account-inspector__fact">
          <ProductIcon name="device" size={20} />
          <span>
            <strong className="account-inspector__machine">ASTRA-PC-01</strong>
            <span>{copy.deviceDetail}</span>
          </span>
        </div>
        <a href={deviceHref}>
          {copy.deviceAction} <ProductIcon name="arrowRight" size={16} />
        </a>
      </section>

      <section className="account-inspector__section">
        <span className="account-inspector__label">{copy.securityTitle}</span>
        <ul className="account-inspector__list">
          <li>
            <ProductIcon name="key" size={18} />
            <span>{copy.passkey}</span>
          </li>
          <li>
            <ProductIcon name="lock" size={18} />
            <span>{copy.mfa}</span>
          </li>
        </ul>
        <a href={securityHref}>
          {copy.securityAction} <ProductIcon name="arrowRight" size={16} />
        </a>
      </section>

      <section className="account-inspector__section account-inspector__support">
        <span className="account-inspector__label">{copy.supportTitle}</span>
        <a href={supportHref}>
          {copy.supportAction} <ProductIcon name="arrowRight" size={16} />
        </a>
      </section>
    </div>
  );
}
