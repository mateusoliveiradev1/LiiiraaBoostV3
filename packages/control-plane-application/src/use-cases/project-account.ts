import type {
  AccountProjectionJson,
  DeviceBindingProjectionJson,
  InvoiceProjectionJson,
  SessionProjectionJson,
  SubscriptionProjectionJson,
  SupportCaseProjectionJson,
} from '@liiiraa/contracts-ts';
import type { SubscriptionState } from '@liiiraa/control-plane-domain';

import type { SessionAuthorityRecord } from './authenticate.js';
import type { DeviceBindingRecord } from './bind-device.js';
import type { CommerceInvoiceRecord } from './reconcile-commerce.js';
import type { SecurityMethodRecord } from './security-methods.js';
import type { SupportCaseState } from './manage-support-case.js';

export type AccountProjectionProvenance = 'online' | 'offline' | 'stale' | 'pending' | 'conflict';

export interface AccountAuthorityRecord {
  readonly accountId: string;
  readonly version: bigint;
  readonly state: AccountProjectionJson['state'];
  readonly displayName: string;
  readonly email: string;
  readonly locale: AccountProjectionJson['locale'];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AccountProjectionSnapshot {
  readonly account: AccountAuthorityRecord;
  readonly securityMethods: readonly SecurityMethodRecord[];
  readonly sessions: readonly SessionAuthorityRecord[];
  readonly subscription: SubscriptionState;
  readonly invoices: readonly CommerceInvoiceRecord[];
  readonly supportCases: readonly SupportCaseState[];
  readonly activeDevice: DeviceBindingRecord | null;
}

export interface AccountProjectionSnapshotReader {
  loadSnapshot(accountId: string): Promise<AccountProjectionSnapshot | null>;
}

export interface AccountProjectionRepository {
  snapshot<T>(
    accountId: string,
    operation: (reader: AccountProjectionSnapshotReader) => Promise<T>,
  ): Promise<T>;
}

export interface AccountOwnerAuthorizer {
  authorizeOwner(input: Readonly<{ actorAccountId: string; accountId: string }>): Promise<boolean>;
}

export interface ProjectAccountDependencies {
  readonly repository: AccountProjectionRepository;
  readonly authorizer: AccountOwnerAuthorizer;
}

export interface ProjectAccountInput {
  readonly actorAccountId: string;
  readonly accountId: string;
  readonly correlationId: string;
  readonly provenance?: Exclude<AccountProjectionProvenance, 'pending' | 'conflict'>;
}

export interface AccountSecurityMethodProjection {
  readonly methodId: string;
  readonly factor: SecurityMethodRecord['factor'];
  readonly verifiedAt: string;
}

export interface SharedAccountProjection {
  readonly account: AccountProjectionJson;
  readonly provenance: AccountProjectionProvenance;
  readonly securityMethods: readonly AccountSecurityMethodProjection[];
  readonly sessions: readonly SessionProjectionJson[];
  readonly subscription: SubscriptionProjectionJson;
  readonly invoices: readonly InvoiceProjectionJson[];
  readonly supportCases: readonly SupportCaseProjectionJson[];
  readonly activeDevice: DeviceBindingProjectionJson | null;
}

export type ProjectAccountResult =
  | Readonly<{ ok: true; projection: SharedAccountProjection }>
  | Readonly<{ ok: false; code: 'UNAUTHORIZED' | 'NOT_FOUND' | 'CONTRADICTORY_SNAPSHOT' }>;

const contradiction = (reason: string): never => {
  throw new Error(`ACCOUNT_PROJECTION_CONTRADICTION:${reason}`);
};

const accountEtag = (accountId: string, version: bigint): string =>
  `account-${accountId}-v${version.toString()}`;

const redactEmail = (email: string): string => {
  const separator = email.lastIndexOf('@');
  if (separator <= 0 || separator === email.length - 1) return contradiction('identity:email');
  const local = email.slice(0, separator);
  return `${local.slice(0, 1)}***@${email.slice(separator + 1)}`;
};

const assertOwner = (snapshot: AccountProjectionSnapshot, accountId: string): void => {
  const owned = [
    snapshot.account.accountId,
    snapshot.subscription.accountId,
    ...snapshot.securityMethods.map((method) => method.accountId),
    ...snapshot.sessions.map((session) => session.accountId),
    ...snapshot.invoices.map((invoice) => invoice.accountId),
    ...snapshot.supportCases.map((supportCase) => supportCase.accountId),
    ...(snapshot.activeDevice === null ? [] : [snapshot.activeDevice.accountId]),
  ];
  if (owned.some((candidate) => candidate !== accountId)) contradiction('owner-scope');
};

const assertSubscription = (subscription: SubscriptionState): void => {
  const pending = subscription.status === 'payment-pending';
  if (pending !== (subscription.checkoutStatus === 'pending-reconciliation')) {
    contradiction('subscription:pending-reconciliation');
  }
  if (subscription.plan === 'free' && subscription.status !== 'free' && !pending) {
    contradiction('subscription:free-plan');
  }
  if (subscription.plan === 'premium' && (subscription.status === 'free' || pending)) {
    contradiction('subscription:premium-plan');
  }
  if (subscription.status === 'active' && !subscription.capabilities.newPremiumActions) {
    contradiction('subscription:active-capabilities');
  }
};

const subscriptionState = (state: SubscriptionState): SubscriptionProjectionJson['state'] => {
  switch (state.status) {
    case 'free':
      return 'none';
    case 'payment-pending':
      return 'trialing';
    case 'active':
      return 'active';
    case 'grace':
      return 'past-due';
    case 'canceled':
      return 'canceled';
    case 'expired':
    case 'refund-review':
    case 'disputed':
      return 'expired';
  }
};

const sessionProjection = (
  session: SessionAuthorityRecord,
  correlationId: string,
): SessionProjectionJson => ({
  schemaVersion: '1.0',
  aggregateVersion: session.version.toString(),
  etag: `session-${session.sessionId}-v${session.version.toString()}`,
  correlationId,
  provenance: 'postgres-authority',
  kind: 'session-projection',
  sessionId: session.sessionId,
  accountId: session.accountId,
  state: session.state,
  authenticationStrength: session.method === 'passkey' ? 'passkey' : 'password',
  scopes: [`session-${session.kind}`],
  authenticatedAt: session.issuedAt,
  expiresAt: session.expiresAt,
  lastSeenAt: session.lastSeenAt,
});

const subscriptionProjection = (
  subscription: SubscriptionState,
  correlationId: string,
): SubscriptionProjectionJson => ({
  schemaVersion: '1.0',
  aggregateVersion: subscription.version.toString(),
  etag: `subscription-${subscription.accountId}-v${subscription.version.toString()}`,
  correlationId,
  provenance: 'postgres-authority',
  kind: 'subscription-projection',
  subscriptionId: subscription.subscriptionId ?? `subscription-${subscription.accountId}`,
  accountId: subscription.accountId,
  state: subscriptionState(subscription),
  plan: subscription.plan,
  entitlements: subscription.capabilities.newPremiumActions ? ['premium-actions'] : [],
  ...(subscription.currentPeriodEnd === undefined
    ? {}
    : { currentPeriodEndsAt: subscription.currentPeriodEnd }),
  cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
});

const invoiceProjection = (
  invoice: CommerceInvoiceRecord,
  correlationId: string,
): InvoiceProjectionJson => ({
  schemaVersion: '1.0',
  aggregateVersion: invoice.version.toString(),
  etag: `invoice-${invoice.invoiceId}-v${invoice.version.toString()}`,
  correlationId,
  provenance: 'postgres-authority',
  kind: 'invoice-projection',
  invoiceId: invoice.invoiceId,
  accountId: invoice.accountId,
  subscriptionId: invoice.subscriptionId,
  state:
    invoice.state === 'refunded' ? 'void' : invoice.state === 'disputed' ? 'open' : invoice.state,
  currency: invoice.currency,
  amountDueMinor: String(invoice.amountDueMinor),
  amountPaidMinor: String(invoice.amountPaidMinor),
  issuedAt: invoice.issuedAt,
  ...(invoice.settledAt === undefined ? {} : { settledAt: invoice.settledAt }),
});

const supportProjection = (
  supportCase: SupportCaseState,
  correlationId: string,
): SupportCaseProjectionJson => ({
  schemaVersion: '1.0',
  aggregateVersion: supportCase.version.toString(),
  etag: `support-${supportCase.caseId}-v${supportCase.version.toString()}`,
  correlationId,
  provenance: 'postgres-authority',
  kind: 'support-case-projection',
  supportCaseId: supportCase.caseId,
  accountId: supportCase.accountId,
  state: supportCase.status,
  subjectRedacted: supportCase.subjectRedacted,
  auditReference: `support-audit-${supportCase.caseId}`,
  createdAt: supportCase.createdAt,
  updatedAt: supportCase.updatedAt,
});

const deviceProjection = (
  device: DeviceBindingRecord,
  correlationId: string,
): DeviceBindingProjectionJson => ({
  schemaVersion: '1.0',
  aggregateVersion: device.version.toString(),
  etag: `device-${device.bindingId}-v${device.version.toString()}`,
  correlationId,
  provenance: 'device-verified',
  kind: 'device-binding-projection',
  deviceBindingId: device.bindingId,
  accountId: device.accountId,
  state: device.revokedAt === null ? 'active' : 'revoked',
  deviceLabel: device.deviceLabel,
  evidenceVersion: String(device.evidence.keyVersion),
  boundAt: device.boundAt,
  replacementEligibleAt: device.replacementEligibleAt,
});

export const assembleAccountProjection = (
  snapshot: AccountProjectionSnapshot,
  correlationId: string,
  requestedProvenance: Exclude<AccountProjectionProvenance, 'pending' | 'conflict'> = 'online',
): SharedAccountProjection => {
  assertOwner(snapshot, snapshot.account.accountId);
  assertSubscription(snapshot.subscription);
  if (
    snapshot.activeDevice !== null &&
    snapshot.activeDevice.revokedAt === null &&
    snapshot.subscription.status !== 'active' &&
    snapshot.subscription.status !== 'grace'
  ) {
    contradiction('device:active-without-premium');
  }
  const pending = snapshot.subscription.checkoutStatus === 'pending-reconciliation';
  const account = snapshot.account;
  return Object.freeze({
    account: Object.freeze({
      schemaVersion: '1.0',
      aggregateVersion: account.version.toString(),
      etag: accountEtag(account.accountId, account.version),
      correlationId,
      provenance: 'postgres-authority',
      kind: 'account-projection',
      accountId: account.accountId,
      state: account.state,
      displayName: account.displayName,
      emailRedacted: redactEmail(account.email),
      locale: account.locale,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    }),
    provenance: pending ? 'pending' : requestedProvenance,
    securityMethods: Object.freeze(
      snapshot.securityMethods
        .filter((method) => method.revokedAt === null)
        .map((method) =>
          Object.freeze({
            methodId: method.methodId,
            factor: method.factor,
            verifiedAt: method.verifiedAt,
          }),
        ),
    ),
    sessions: Object.freeze(
      snapshot.sessions.map((session) => sessionProjection(session, correlationId)),
    ),
    subscription: Object.freeze(subscriptionProjection(snapshot.subscription, correlationId)),
    invoices: Object.freeze(
      snapshot.invoices.map((invoice) => invoiceProjection(invoice, correlationId)),
    ),
    supportCases: Object.freeze(
      snapshot.supportCases.map((supportCase) => supportProjection(supportCase, correlationId)),
    ),
    activeDevice:
      snapshot.activeDevice === null
        ? null
        : Object.freeze(deviceProjection(snapshot.activeDevice, correlationId)),
  });
};

export const projectAccount = async (
  dependencies: ProjectAccountDependencies,
  input: ProjectAccountInput,
): Promise<ProjectAccountResult> => {
  if (
    input.actorAccountId !== input.accountId ||
    !(await dependencies.authorizer.authorizeOwner({
      actorAccountId: input.actorAccountId,
      accountId: input.accountId,
    }))
  ) {
    return { ok: false, code: 'UNAUTHORIZED' };
  }
  return dependencies.repository.snapshot(input.accountId, async (reader) => {
    const snapshot = await reader.loadSnapshot(input.accountId);
    if (snapshot === null) return { ok: false, code: 'NOT_FOUND' } as const;
    try {
      return {
        ok: true,
        projection: assembleAccountProjection(
          snapshot,
          input.correlationId,
          input.provenance ?? 'online',
        ),
      } as const;
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('ACCOUNT_PROJECTION_CONTRADICTION:')) {
        return { ok: false, code: 'CONTRADICTORY_SNAPSHOT' } as const;
      }
      throw error;
    }
  });
};
