import type { WebLocale } from '@liiiraa/web-core';

import type { AccountAuthorityObservation, AccountAuthorityProjection } from './account-authority';
export { advanceAccountMutationPhase } from './account-preview-model';

export type AccountRuntimeConfig =
  Readonly<{ kind: 'preview' }> | Readonly<{ authorityBaseUrl: string; kind: 'production' }>;

export const resolveAccountRuntimeConfig = ({
  authorityBaseUrl = '',
  previewEnabled = false,
}: Readonly<{
  authorityBaseUrl?: string;
  previewEnabled?: boolean;
}>): AccountRuntimeConfig =>
  previewEnabled ? { kind: 'preview' } : { authorityBaseUrl, kind: 'production' };

export type AccountAuthorityViewModel = Readonly<{
  authorityState: AccountAuthorityObservation;
  billing: Readonly<{
    checkout: 'pending' | 'reconciled';
    invoiceCount: number;
    plan: 'free' | 'premium';
    state: string;
  }>;
  device: Readonly<{
    isCurrent: boolean;
    label?: string;
    replacement: 'cooldown' | 'eligible';
    replacementEligibleAt?: string;
  }>;
  identity: Readonly<{
    displayName: string;
    emailRedacted: string;
    locale: WebLocale;
  }>;
  security: Readonly<{
    mfa: boolean;
    passkey: boolean;
    sessionCount: number;
  }>;
  support: Readonly<{ openCount: number }>;
}>;

export const mapAccountAuthorityProjection = (
  projection: AccountAuthorityProjection,
  observedAt: string,
): AccountAuthorityViewModel => {
  const device = projection.activeDevice;
  const replacementEligible =
    device?.replacementEligibleAt === undefined ||
    Date.parse(observedAt) >= Date.parse(device.replacementEligibleAt);
  return Object.freeze({
    authorityState: projection.provenance,
    billing: Object.freeze({
      checkout: projection.subscription.state === 'trialing' ? 'pending' : 'reconciled',
      invoiceCount: projection.invoices.length,
      plan: projection.subscription.plan,
      state: projection.subscription.state,
    }),
    device: Object.freeze({
      isCurrent: device?.state === 'active',
      ...(device === null ? {} : { label: device.deviceLabel }),
      replacement: replacementEligible ? 'eligible' : 'cooldown',
      ...(device?.replacementEligibleAt === undefined
        ? {}
        : { replacementEligibleAt: device.replacementEligibleAt }),
    }),
    identity: Object.freeze({
      displayName: projection.account.displayName,
      emailRedacted: projection.account.emailRedacted,
      locale: projection.account.locale,
    }),
    security: Object.freeze({
      mfa: projection.securityMethods.some(({ factor }) => factor === 'totp'),
      passkey: projection.securityMethods.some(({ factor }) => factor === 'passkey'),
      sessionCount: projection.sessions.filter(({ state }) => state === 'active').length,
    }),
    support: Object.freeze({
      openCount: projection.supportCases.filter(({ state }) => state === 'open').length,
    }),
  });
};
