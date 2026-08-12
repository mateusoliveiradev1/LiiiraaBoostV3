import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import {
  controlPlaneDocumentValidator,
  type AccountCommandJson,
  type AccountProjectionJson,
  type DeviceBindingProjectionJson,
  type DeviceCommandJson,
  type InvoiceProjectionJson,
  type SessionProjectionJson,
  type ShellLocaleJson,
  type SubscriptionProjectionJson,
  type SupportCaseProjectionJson,
} from '@liiiraa/contracts-ts';

export const ACCOUNT_MUTATION_COMMITTED_EVENT = 'liiiraa:account-mutation-committed' as const;
export const ACCOUNT_AUTHORITY_REVOKED_EVENT = 'liiiraa:account-authority-revoked' as const;
export const ACCOUNT_IDENTITY_PROJECTED_EVENT = 'liiiraa:account-identity-projected' as const;
export const ACCOUNT_SYNC_COMMAND = 'sync_account' as const;
export const BIND_CURRENT_DEVICE_COMMAND = 'bind_current_device' as const;
export const OPEN_ACCOUNT_SUBSCRIPTION_COMMAND = 'open_account_subscription' as const;
export const OPEN_ADMIN_COMMAND = 'open_admin' as const;
export const PREPARE_DEVICE_BINDING_COMMAND = 'prepare_device_binding' as const;
export const ACCOUNT_AUTHORITY_REFRESH_MS = 5_000;
export const ACCOUNT_SYNC_TIMEOUT_MS = 12_000;

const withAccountSyncDeadline = async <T>(operation: Promise<T>): Promise<T> => {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_resolve, reject) => {
        timeout = globalThis.setTimeout(() => {
          reject(new Error('account-sync-timeout'));
        }, ACCOUNT_SYNC_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeout !== undefined) globalThis.clearTimeout(timeout);
  }
};

export type AccountLifecycleTrigger = 'launch' | 'resume' | 'reconnection' | 'mutation';
export type AccountAuthorityState =
  'online' | 'offline' | 'stale' | 'pending' | 'conflict' | 'revoked';

export interface AccountSecurityMethodProjection {
  readonly factor: 'passkey' | 'totp' | 'recovery-code';
  readonly methodId: string;
  readonly verifiedAt: string;
}

export interface SharedAccountProjection {
  readonly account: AccountProjectionJson;
  readonly provenance: Exclude<AccountAuthorityState, 'revoked'>;
  readonly securityMethods: readonly AccountSecurityMethodProjection[];
  readonly sessions: readonly SessionProjectionJson[];
  readonly subscription: SubscriptionProjectionJson;
  readonly invoices: readonly InvoiceProjectionJson[];
  readonly supportCases: readonly SupportCaseProjectionJson[];
  readonly activeDevice: DeviceBindingProjectionJson | null;
}

export interface SafeAccountProfileDraft {
  readonly displayName: string;
  readonly locale: ShellLocaleJson;
}

export type AccountProfileMutationResult =
  | Readonly<{ status: 'committed'; projection: SharedAccountProjection }>
  | Readonly<{
      status: 'conflict';
      projection: SharedAccountProjection;
      localDraft: SafeAccountProfileDraft;
    }>
  | Readonly<{
      status: 'failed';
      error: NonNullable<DesktopAccountAuthoritySnapshot['error']>;
    }>
  | Readonly<{ status: 'invalid' }>;

export interface DesktopAccountAuthoritySnapshot {
  readonly state: AccountAuthorityState;
  readonly projection?: SharedAccountProjection;
  readonly localDraft?: SafeAccountProfileDraft;
  readonly error?:
    | 'invalid-request'
    | 'invalid-response'
    | 'native-credential-unavailable'
    | 'network-unavailable'
    | 'unauthorized';
}

export type DesktopAdminHandoffStatus =
  'eligible' | 'ineligible' | 'offline' | 'expired' | 'revoked';
export type DesktopAdministrativeMembership = 'active' | 'none' | 'offline' | 'expired' | 'revoked';

export interface DesktopAdminHandoffProjection {
  readonly status: DesktopAdminHandoffStatus;
  readonly membership: DesktopAdministrativeMembership;
  readonly activeFunction?: NonNullable<AccountProjectionJson['administrativeRole']>;
  readonly plan?: SubscriptionProjectionJson['plan'];
  readonly actionable: boolean;
}

export type DesktopAdminOpenResult = Readonly<{
  status: 'opened' | DesktopAdminHandoffStatus | 'unavailable';
}>;

export type DesktopSubscriptionOpenResult = Readonly<{
  status: 'opened' | 'offline' | 'revoked' | 'unavailable';
}>;

export type DeviceComponentClass =
  'platform-trust' | 'virtual-platform' | 'cpu' | 'storage-controller' | 'gpu' | 'memory-topology';

export interface DesktopDeviceBindingPreview {
  readonly readiness: 'ready';
  readonly deviceLabel: string;
  readonly deviceClass: 'physical' | 'virtual';
  readonly admittedComponents: readonly DeviceComponentClass[];
}

export type DesktopDevicePreparationResult =
  | Readonly<{ status: 'ready'; preview: DesktopDeviceBindingPreview }>
  | Readonly<{
      status:
        | 'already-linked'
        | 'busy'
        | 'evidence-insufficient'
        | 'offline'
        | 'premium-required'
        | 'revoked'
        | 'unavailable';
    }>;

export interface DesktopDeviceBindingConfirmation {
  readonly confirmedFriendlyIdentity: boolean;
  readonly confirmedOnePcConsequences: boolean;
}

export type DesktopDeviceBindingResult =
  | Readonly<{ status: 'committed'; projection: DeviceBindingProjectionJson }>
  | Readonly<{
      status: 'conflict' | 'policy-denied' | 'revalidation-required';
      reason?: string;
      projection?: DeviceBindingProjectionJson;
    }>
  | Readonly<{
      status:
        | 'already-linked'
        | 'busy'
        | 'confirmation-required'
        | 'failed'
        | 'offline'
        | 'premium-required'
        | 'revoked';
    }>;

export interface AccountAuthorityTransport {
  readonly invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown>;
}

type AccountAuthorityListener = (snapshot: DesktopAccountAuthoritySnapshot) => void;

const AUTHORITY_STATES = new Set<AccountAuthorityState>([
  'online',
  'offline',
  'stale',
  'pending',
  'conflict',
  'revoked',
]);
const PROJECTION_STATES = new Set<SharedAccountProjection['provenance']>([
  'online',
  'offline',
  'stale',
  'pending',
  'conflict',
]);
const ERROR_CODES = new Set<NonNullable<DesktopAccountAuthoritySnapshot['error']>>([
  'invalid-request',
  'invalid-response',
  'native-credential-unavailable',
  'network-unavailable',
  'unauthorized',
]);
const OUTER_PROJECTION_KEYS = new Set([
  'account',
  'activeDevice',
  'invoices',
  'provenance',
  'securityMethods',
  'sessions',
  'subscription',
  'supportCases',
]);
const DEVICE_COMPONENT_CLASSES = new Set<DeviceComponentClass>([
  'platform-trust',
  'virtual-platform',
  'cpu',
  'storage-controller',
  'gpu',
  'memory-topology',
]);

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isGeneratedDocument = (value: unknown, kind: string): boolean =>
  isRecord(value) && value['kind'] === kind && controlPlaneDocumentValidator(value);

const deviceBindingProjection = (value: unknown): DeviceBindingProjectionJson | undefined =>
  isGeneratedDocument(value, 'device-binding-projection')
    ? (value as DeviceBindingProjectionJson)
    : undefined;

const deviceBindingPreview = (value: unknown): DesktopDeviceBindingPreview | undefined => {
  if (
    !isRecord(value) ||
    Object.keys(value).some(
      (key) =>
        !['readiness', 'deviceLabel', 'deviceClass', 'admittedComponents', 'error'].includes(key),
    ) ||
    value['readiness'] !== 'ready' ||
    typeof value['deviceLabel'] !== 'string' ||
    value['deviceLabel'].length < 1 ||
    value['deviceLabel'].length > 128 ||
    (value['deviceClass'] !== 'physical' && value['deviceClass'] !== 'virtual') ||
    !Array.isArray(value['admittedComponents']) ||
    value['admittedComponents'].length < 3 ||
    value['admittedComponents'].length > DEVICE_COMPONENT_CLASSES.size ||
    !value['admittedComponents'].every((component) =>
      DEVICE_COMPONENT_CLASSES.has(component as DeviceComponentClass),
    ) ||
    new Set(value['admittedComponents']).size !== value['admittedComponents'].length ||
    value['error'] !== undefined
  ) {
    return undefined;
  }
  return Object.freeze({
    readiness: 'ready',
    deviceLabel: value['deviceLabel'],
    deviceClass: value['deviceClass'],
    admittedComponents: Object.freeze(
      value['admittedComponents'] as readonly DeviceComponentClass[],
    ),
  });
};

type NativeDeviceBindingMutation = Readonly<{
  status: 'applied' | 'revalidation-required' | 'policy-denied' | 'conflict';
  projection?: DeviceBindingProjectionJson;
  reason?: string;
}>;

const nativeDeviceBindingMutation = (value: unknown): NativeDeviceBindingMutation | undefined => {
  if (
    !isRecord(value) ||
    Object.keys(value).some((key) => !['status', 'projection', 'reason'].includes(key)) ||
    !['applied', 'revalidation-required', 'policy-denied', 'conflict'].includes(
      String(value['status']),
    ) ||
    (value['reason'] !== undefined &&
      (typeof value['reason'] !== 'string' || !/^[a-z0-9-]{1,128}$/u.test(value['reason'])))
  ) {
    return undefined;
  }
  const projection =
    value['projection'] === undefined ? undefined : deviceBindingProjection(value['projection']);
  if (value['projection'] !== undefined && projection === undefined) return undefined;
  if (
    (value['status'] === 'applied' || value['status'] === 'revalidation-required') &&
    projection === undefined
  ) {
    return undefined;
  }
  return Object.freeze({
    status: value['status'] as NativeDeviceBindingMutation['status'],
    ...(projection === undefined ? {} : { projection }),
    ...(value['reason'] === undefined ? {} : { reason: value['reason'] }),
  });
};

const hasFixtureProvenance = (value: unknown, seen = new WeakSet<object>()): boolean => {
  if (typeof value !== 'object' || value === null) return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((entry) => hasFixtureProvenance(entry, seen));
  const record = value as Readonly<Record<string, unknown>>;
  if (
    record['kind'] === 'fixture' ||
    Object.hasOwn(record, 'fixtureVersion') ||
    Object.hasOwn(record, 'scenarioId')
  ) {
    return true;
  }
  return Object.values(record).some((entry) => hasFixtureProvenance(entry, seen));
};

const validSecurityMethod = (value: unknown): value is AccountSecurityMethodProjection =>
  isRecord(value) &&
  typeof value['methodId'] === 'string' &&
  value['methodId'].length > 0 &&
  value['methodId'].length <= 128 &&
  (value['factor'] === 'passkey' ||
    value['factor'] === 'totp' ||
    value['factor'] === 'recovery-code') &&
  typeof value['verifiedAt'] === 'string';

const isDesktopSessionDocument = (value: unknown): value is SessionProjectionJson =>
  isGeneratedDocument(value, 'session-projection') &&
  isRecord(value) &&
  Array.isArray(value['scopes']) &&
  value['scopes'].length === 1 &&
  value['scopes'][0] === 'session-desktop';

const sharedProjection = (value: unknown): SharedAccountProjection | undefined => {
  if (
    !isRecord(value) ||
    hasFixtureProvenance(value) ||
    Object.keys(value).some((key) => !OUTER_PROJECTION_KEYS.has(key)) ||
    !PROJECTION_STATES.has(value['provenance'] as SharedAccountProjection['provenance']) ||
    !isGeneratedDocument(value['account'], 'account-projection') ||
    !isGeneratedDocument(value['subscription'], 'subscription-projection') ||
    !Array.isArray(value['securityMethods']) ||
    value['securityMethods'].length > 16 ||
    !value['securityMethods'].every(validSecurityMethod) ||
    !Array.isArray(value['sessions']) ||
    value['sessions'].length > 16 ||
    !value['sessions'].every(isDesktopSessionDocument) ||
    !Array.isArray(value['invoices']) ||
    !value['invoices'].every((invoice) => isGeneratedDocument(invoice, 'invoice-projection')) ||
    !Array.isArray(value['supportCases']) ||
    !value['supportCases'].every((support) =>
      isGeneratedDocument(support, 'support-case-projection'),
    ) ||
    !(
      value['activeDevice'] === null ||
      isGeneratedDocument(value['activeDevice'], 'device-binding-projection')
    )
  ) {
    return undefined;
  }

  const account = value['account'] as AccountProjectionJson;
  const accountId = account.accountId;
  const sameOwner =
    (value['subscription'] as SubscriptionProjectionJson).accountId === accountId &&
    (value['sessions'] as readonly SessionProjectionJson[]).every(
      (session) => session.accountId === accountId,
    ) &&
    (value['invoices'] as readonly InvoiceProjectionJson[]).every(
      (invoice) => invoice.accountId === accountId,
    ) &&
    (value['supportCases'] as readonly SupportCaseProjectionJson[]).every(
      (support) => support.accountId === accountId,
    ) &&
    (value['activeDevice'] === null ||
      (value['activeDevice'] as DeviceBindingProjectionJson).accountId === accountId);
  if (!sameOwner) return undefined;

  return Object.freeze({
    account,
    activeDevice: value['activeDevice'] as DeviceBindingProjectionJson | null,
    invoices: Object.freeze(value['invoices'] as readonly InvoiceProjectionJson[]),
    provenance: value['provenance'] as SharedAccountProjection['provenance'],
    securityMethods: Object.freeze(
      value['securityMethods'] as readonly AccountSecurityMethodProjection[],
    ),
    sessions: Object.freeze(value['sessions'] as readonly SessionProjectionJson[]),
    subscription: value['subscription'] as SubscriptionProjectionJson,
    supportCases: Object.freeze(value['supportCases'] as readonly SupportCaseProjectionJson[]),
  });
};

const handoffWithoutAction = (
  status: Exclude<DesktopAdminHandoffStatus, 'eligible'>,
  membership: Exclude<DesktopAdministrativeMembership, 'active'>,
  projection?: SharedAccountProjection,
): DesktopAdminHandoffProjection =>
  Object.freeze({
    status,
    membership,
    ...(projection === undefined ? {} : { plan: projection.subscription.plan }),
    actionable: false,
  });

export const resolveDesktopAdminHandoff = (
  snapshot: DesktopAccountAuthoritySnapshot | undefined,
  now = new Date(),
): DesktopAdminHandoffProjection => {
  if (snapshot?.state === 'revoked') {
    return handoffWithoutAction('revoked', 'revoked');
  }
  if (snapshot?.state !== 'online' || snapshot.projection === undefined) {
    return handoffWithoutAction('offline', 'offline', snapshot?.projection);
  }

  const projection = snapshot.projection;
  const activeFunction = projection.account.administrativeRole;
  if (projection.account.state !== 'active' || activeFunction === undefined) {
    return handoffWithoutAction('ineligible', 'none', projection);
  }

  const nowEpoch = now.getTime();
  const hasCurrentDesktopSession =
    Number.isFinite(nowEpoch) &&
    projection.sessions.some((session) => {
      if (session.state !== 'active' || !session.scopes.includes('session-desktop')) return false;
      const expiresAt = Date.parse(session.expiresAt);
      return Number.isFinite(expiresAt) && expiresAt > nowEpoch;
    });
  if (!hasCurrentDesktopSession) {
    return handoffWithoutAction('expired', 'expired', projection);
  }

  return Object.freeze({
    status: 'eligible',
    membership: 'active',
    activeFunction,
    plan: projection.subscription.plan,
    actionable: true,
  });
};

const safeDraft = (value: unknown): SafeAccountProfileDraft | undefined => {
  if (!isRecord(value)) return undefined;
  const displayName = value['displayName'];
  const locale = value['locale'];
  if (
    typeof displayName !== 'string' ||
    displayName.trim().length < 2 ||
    displayName.length > 40 ||
    (locale !== 'en' && locale !== 'pt-BR')
  ) {
    return undefined;
  }
  return Object.freeze({ displayName: displayName.trim(), locale });
};

const authoritySnapshot = (value: unknown): DesktopAccountAuthoritySnapshot | undefined => {
  if (!isRecord(value) || !AUTHORITY_STATES.has(value['state'] as AccountAuthorityState)) {
    return undefined;
  }
  const state = value['state'] as AccountAuthorityState;
  const projection =
    value['projection'] === undefined ? undefined : sharedProjection(value['projection']);
  const localDraft = value['localDraft'] === undefined ? undefined : safeDraft(value['localDraft']);
  const error = value['error'];
  if (
    (value['projection'] !== undefined && projection === undefined) ||
    (value['localDraft'] !== undefined && localDraft === undefined) ||
    (error !== undefined &&
      !ERROR_CODES.has(error as NonNullable<DesktopAccountAuthoritySnapshot['error']>)) ||
    (state === 'revoked' && projection !== undefined) ||
    (state === 'conflict' && (projection === undefined || localDraft === undefined))
  ) {
    return undefined;
  }
  return Object.freeze({
    state,
    ...(projection === undefined ? {} : { projection }),
    ...(localDraft === undefined ? {} : { localDraft }),
    ...(error === undefined
      ? {}
      : { error: error as NonNullable<DesktopAccountAuthoritySnapshot['error']> }),
  });
};

const pendingSnapshot = (
  current: DesktopAccountAuthoritySnapshot,
  localDraft?: SafeAccountProfileDraft,
): DesktopAccountAuthoritySnapshot =>
  Object.freeze({
    state: 'pending',
    ...(current.projection === undefined ? {} : { projection: current.projection }),
    ...(localDraft === undefined ? {} : { localDraft }),
  });

const browserHarnessEnabled = import.meta.env.DEV || import.meta.env.MODE === 'browser-test';

const testTransport = (): AccountAuthorityTransport | undefined => {
  if (!browserHarnessEnabled) return undefined;
  const globalRecord = globalThis as unknown as Readonly<Record<PropertyKey, unknown>>;
  const testState = globalRecord['__LIIIRAA_DESKTOP_TEST__'];
  const candidate = globalRecord['__LIIIRAA_ACCOUNT_AUTHORITY_TEST_TRANSPORT__'];
  if (
    !isRecord(testState) ||
    !isRecord(testState['scenario']) ||
    testState['scenario']['marker'] !== 'SIMULATED SCENARIO' ||
    !isRecord(candidate) ||
    typeof candidate['invoke'] !== 'function'
  ) {
    return undefined;
  }
  return candidate as unknown as AccountAuthorityTransport;
};

export const resolveDesktopAccountAuthorityTransport = ():
  AccountAuthorityTransport | undefined => {
  const fixtureTransport = testTransport();
  if (fixtureTransport !== undefined) return fixtureTransport;
  if (!Reflect.has(globalThis, '__TAURI_INTERNALS__')) return undefined;
  return Object.freeze({
    invoke: async (command: string, args?: Record<string, unknown>) =>
      tauriInvoke<unknown>(command, args),
  });
};

export class DesktopAccountAuthority {
  readonly #listeners = new Set<AccountAuthorityListener>();
  readonly #transport: AccountAuthorityTransport;
  #snapshot: DesktopAccountAuthoritySnapshot = Object.freeze({ state: 'pending' });
  #started = false;
  #sequence = 0;
  #mutationInFlight = false;
  #synchronizationInFlight = false;
  readonly #queuedSynchronizations: AccountLifecycleTrigger[] = [];
  #refreshTimer: ReturnType<typeof setInterval> | undefined;

  public constructor(transport: AccountAuthorityTransport) {
    this.#transport = transport;
  }

  public snapshot(): DesktopAccountAuthoritySnapshot {
    return this.#snapshot;
  }

  public subscribe(listener: AccountAuthorityListener): () => void {
    this.#listeners.add(listener);
    listener(this.#snapshot);
    return () => this.#listeners.delete(listener);
  }

  #publish(snapshot: DesktopAccountAuthoritySnapshot): void {
    this.#snapshot = snapshot;
    for (const listener of this.#listeners) listener(snapshot);
    if (snapshot.state === 'revoked') {
      globalThis.dispatchEvent(new CustomEvent(ACCOUNT_AUTHORITY_REVOKED_EVENT));
    }
    if (snapshot.projection !== undefined) {
      globalThis.dispatchEvent(
        new CustomEvent(ACCOUNT_IDENTITY_PROJECTED_EVENT, {
          detail: Object.freeze({
            accountId: snapshot.projection.account.accountId,
            displayName: snapshot.projection.account.displayName,
            emailRedacted: snapshot.projection.account.emailRedacted,
            plan: snapshot.projection.subscription.plan,
          }),
        }),
      );
    }
  }

  public confirmSignedOut(): void {
    this.#sequence += 1;
    this.#queuedSynchronizations.splice(0);
    if (this.#snapshot.state === 'revoked' && this.#snapshot.error === 'unauthorized') return;
    this.#publish(Object.freeze({ state: 'revoked', error: 'unauthorized' }));
  }

  public async synchronize(trigger: AccountLifecycleTrigger): Promise<void> {
    if (this.#mutationInFlight || this.#synchronizationInFlight) {
      if (!this.#queuedSynchronizations.includes(trigger)) {
        this.#queuedSynchronizations.push(trigger);
      }
      return;
    }
    this.#synchronizationInFlight = true;
    const sequence = ++this.#sequence;
    if (this.#snapshot.state !== 'revoked' && this.#snapshot.projection === undefined) {
      this.#publish(pendingSnapshot(this.#snapshot));
    }
    try {
      const raw = await withAccountSyncDeadline(
        this.#transport.invoke(ACCOUNT_SYNC_COMMAND, { request: { trigger } }),
      );
      if (sequence !== this.#sequence) return;
      const next = authoritySnapshot(raw);
      if (next === undefined) {
        this.#publish(
          Object.freeze({
            state: this.#snapshot.projection === undefined ? 'offline' : 'stale',
            ...(this.#snapshot.projection === undefined
              ? {}
              : { projection: this.#snapshot.projection }),
            error: 'invalid-response',
          }),
        );
        return;
      }
      this.#publish(next);
    } catch {
      if (sequence !== this.#sequence) return;
      this.#publish(
        Object.freeze({
          state: this.#snapshot.projection === undefined ? 'offline' : 'stale',
          ...(this.#snapshot.projection === undefined
            ? {}
            : { projection: this.#snapshot.projection }),
          error: 'network-unavailable',
        }),
      );
    } finally {
      this.#synchronizationInFlight = false;
      const queuedTrigger = this.#queuedSynchronizations.shift();
      if (queuedTrigger !== undefined) void this.synchronize(queuedTrigger);
    }
  }

  public async updateProfile(
    draft: SafeAccountProfileDraft,
  ): Promise<AccountProfileMutationResult> {
    const projection = this.#snapshot.projection;
    const normalizedDraft = safeDraft(draft);
    if (projection === undefined || normalizedDraft === undefined || this.#mutationInFlight) {
      return Object.freeze({ status: 'invalid' });
    }
    const command: AccountCommandJson = {
      schemaVersion: '1.0',
      kind: 'account-command',
      commandId: globalThis.crypto.randomUUID(),
      accountId: projection.account.accountId,
      action: 'update-profile',
      expectedVersion: projection.account.aggregateVersion,
      correlationId: globalThis.crypto.randomUUID(),
      requestedAt: new Date().toISOString(),
    };
    const sequence = ++this.#sequence;
    this.#mutationInFlight = true;
    this.#publish(pendingSnapshot(this.#snapshot, normalizedDraft));
    try {
      const raw = await this.#transport.invoke(ACCOUNT_SYNC_COMMAND, {
        request: {
          trigger: 'mutation',
          mutation: {
            command,
            draft: normalizedDraft,
            localDraftToken: globalThis.crypto.randomUUID(),
          },
        },
      });
      if (sequence !== this.#sequence) {
        return Object.freeze({ status: 'failed', error: 'network-unavailable' });
      }
      const next = authoritySnapshot(raw);
      if (next === undefined) {
        this.#publish(
          Object.freeze({
            state: 'stale',
            projection,
            localDraft: normalizedDraft,
            error: 'invalid-response',
          }),
        );
        return Object.freeze({ status: 'failed', error: 'invalid-response' });
      }
      if (next.state === 'online' && next.projection !== undefined) {
        const committedAccount = next.projection.account;
        if (
          committedAccount.accountId !== projection.account.accountId ||
          committedAccount.aggregateVersion === projection.account.aggregateVersion ||
          committedAccount.displayName !== normalizedDraft.displayName ||
          committedAccount.locale !== normalizedDraft.locale
        ) {
          this.#publish(
            Object.freeze({
              state: 'stale',
              projection,
              localDraft: normalizedDraft,
              error: 'invalid-response',
            }),
          );
          return Object.freeze({ status: 'failed', error: 'invalid-response' });
        }
        this.#publish(next);
        return Object.freeze({ status: 'committed', projection: next.projection });
      }
      if (
        next.state === 'conflict' &&
        next.projection !== undefined &&
        next.localDraft !== undefined
      ) {
        this.#publish(next);
        return Object.freeze({
          status: 'conflict',
          projection: next.projection,
          localDraft: next.localDraft,
        });
      }
      this.#publish(next);
      return Object.freeze({
        status: 'failed',
        error: next.error ?? 'invalid-response',
      });
    } catch {
      if (sequence !== this.#sequence) {
        return Object.freeze({ status: 'failed', error: 'network-unavailable' });
      }
      this.#publish(
        Object.freeze({
          state: 'stale',
          projection,
          localDraft: normalizedDraft,
          error: 'network-unavailable',
        }),
      );
      return Object.freeze({ status: 'failed', error: 'network-unavailable' });
    } finally {
      this.#mutationInFlight = false;
      const queuedTrigger = this.#queuedSynchronizations.shift();
      if (queuedTrigger !== undefined) void this.synchronize(queuedTrigger);
    }
  }

  public async openAdmin(now = new Date()): Promise<DesktopAdminOpenResult> {
    const handoff = resolveDesktopAdminHandoff(this.#snapshot, now);
    if (!handoff.actionable) return Object.freeze({ status: handoff.status });
    try {
      const raw = await this.#transport.invoke(OPEN_ADMIN_COMMAND);
      if (!isRecord(raw) || Object.keys(raw).length !== 1 || raw['status'] !== 'opened') {
        return Object.freeze({ status: 'unavailable' });
      }
      return Object.freeze({ status: 'opened' });
    } catch {
      return Object.freeze({ status: 'unavailable' });
    }
  }

  public async openSubscription(locale: ShellLocaleJson): Promise<DesktopSubscriptionOpenResult> {
    if (this.#snapshot.state === 'revoked') return Object.freeze({ status: 'revoked' });
    if (this.#snapshot.state !== 'online' || this.#snapshot.projection === undefined) {
      return Object.freeze({ status: 'offline' });
    }
    try {
      const raw = await this.#transport.invoke(OPEN_ACCOUNT_SUBSCRIPTION_COMMAND, { locale });
      if (!isRecord(raw) || Object.keys(raw).length !== 1 || raw['status'] !== 'opened') {
        return Object.freeze({ status: 'unavailable' });
      }
      return Object.freeze({ status: 'opened' });
    } catch {
      return Object.freeze({ status: 'unavailable' });
    }
  }

  public async prepareDeviceBinding(): Promise<DesktopDevicePreparationResult> {
    if (this.#snapshot.state === 'revoked') return Object.freeze({ status: 'revoked' });
    const projection = this.#snapshot.projection;
    if (this.#snapshot.state !== 'online' || projection === undefined) {
      return Object.freeze({ status: 'offline' });
    }
    if (projection.subscription.plan !== 'premium' || projection.subscription.state !== 'active') {
      return Object.freeze({ status: 'premium-required' });
    }
    if (projection.activeDevice !== null) return Object.freeze({ status: 'already-linked' });
    if (this.#mutationInFlight) return Object.freeze({ status: 'busy' });
    try {
      const raw = await this.#transport.invoke(PREPARE_DEVICE_BINDING_COMMAND);
      const preview = deviceBindingPreview(raw);
      if (preview !== undefined) return Object.freeze({ status: 'ready', preview });
      if (
        isRecord(raw) &&
        raw['readiness'] === 'unavailable' &&
        raw['error'] === 'evidence-insufficient'
      ) {
        return Object.freeze({ status: 'evidence-insufficient' });
      }
      return Object.freeze({ status: 'unavailable' });
    } catch {
      return Object.freeze({ status: 'unavailable' });
    }
  }

  public async bindCurrentDevice(
    confirmation: DesktopDeviceBindingConfirmation,
  ): Promise<DesktopDeviceBindingResult> {
    if (this.#snapshot.state === 'revoked') return Object.freeze({ status: 'revoked' });
    const projection = this.#snapshot.projection;
    if (this.#snapshot.state !== 'online' || projection === undefined) {
      return Object.freeze({ status: 'offline' });
    }
    if (projection.subscription.plan !== 'premium' || projection.subscription.state !== 'active') {
      return Object.freeze({ status: 'premium-required' });
    }
    if (projection.activeDevice !== null) return Object.freeze({ status: 'already-linked' });
    if (!confirmation.confirmedFriendlyIdentity || !confirmation.confirmedOnePcConsequences) {
      return Object.freeze({ status: 'confirmation-required' });
    }
    if (this.#mutationInFlight) return Object.freeze({ status: 'busy' });

    const deviceBindingId = globalThis.crypto.randomUUID();
    const command: DeviceCommandJson = {
      schemaVersion: '1.0',
      kind: 'device-command',
      commandId: globalThis.crypto.randomUUID(),
      accountId: projection.account.accountId,
      deviceBindingId,
      action: 'bind',
      expectedVersion: projection.subscription.aggregateVersion,
      correlationId: globalThis.crypto.randomUUID(),
      requestedAt: new Date().toISOString(),
    };
    const sequence = ++this.#sequence;
    this.#mutationInFlight = true;
    this.#publish(pendingSnapshot(this.#snapshot));
    try {
      const raw = await this.#transport.invoke(BIND_CURRENT_DEVICE_COMMAND, {
        request: { command, ...confirmation },
      });
      if (sequence !== this.#sequence) return Object.freeze({ status: 'failed' });
      const mutation = nativeDeviceBindingMutation(raw);
      if (mutation === undefined) {
        this.#publish(Object.freeze({ state: 'stale', projection, error: 'invalid-response' }));
        return Object.freeze({ status: 'failed' });
      }
      if (mutation.status !== 'applied') {
        this.#publish(Object.freeze({ state: 'online', projection }));
        return Object.freeze({
          status: mutation.status,
          ...(mutation.projection === undefined ? {} : { projection: mutation.projection }),
          ...(mutation.reason === undefined ? {} : { reason: mutation.reason }),
        });
      }

      const synchronizedRaw = await this.#transport.invoke(ACCOUNT_SYNC_COMMAND, {
        request: { trigger: 'mutation' },
      });
      if (sequence !== this.#sequence) return Object.freeze({ status: 'failed' });
      const synchronized = authoritySnapshot(synchronizedRaw);
      const confirmedDevice = synchronized?.projection?.activeDevice;
      if (
        synchronized?.state !== 'online' ||
        confirmedDevice === null ||
        confirmedDevice === undefined ||
        confirmedDevice.deviceBindingId !== mutation.projection?.deviceBindingId ||
        confirmedDevice.accountId !== projection.account.accountId ||
        confirmedDevice.state !== 'active'
      ) {
        this.#publish(Object.freeze({ state: 'stale', projection, error: 'invalid-response' }));
        return Object.freeze({ status: 'failed' });
      }
      this.#publish(synchronized);
      return Object.freeze({ status: 'committed', projection: confirmedDevice });
    } catch {
      if (sequence === this.#sequence) {
        this.#publish(Object.freeze({ state: 'stale', projection, error: 'network-unavailable' }));
      }
      return Object.freeze({ status: 'failed' });
    } finally {
      this.#mutationInFlight = false;
      const queuedTrigger = this.#queuedSynchronizations.shift();
      if (queuedTrigger !== undefined) void this.synchronize(queuedTrigger);
    }
  }

  readonly #onResume = (): void => {
    void this.synchronize('resume');
  };
  readonly #onReconnect = (): void => {
    void this.synchronize('reconnection');
  };
  readonly #onMutation = (): void => {
    void this.synchronize('mutation');
  };
  readonly #onRefresh = (): void => {
    void this.synchronize('reconnection');
  };

  public start(): void {
    if (this.#started) return;
    this.#started = true;
    globalThis.addEventListener('focus', this.#onResume);
    globalThis.addEventListener('online', this.#onReconnect);
    globalThis.addEventListener(ACCOUNT_MUTATION_COMMITTED_EVENT, this.#onMutation);
    this.#refreshTimer = globalThis.setInterval(this.#onRefresh, ACCOUNT_AUTHORITY_REFRESH_MS);
    void this.synchronize('launch');
  }

  public dispose(): void {
    if (!this.#started) return;
    this.#started = false;
    this.#sequence += 1;
    globalThis.removeEventListener('focus', this.#onResume);
    globalThis.removeEventListener('online', this.#onReconnect);
    globalThis.removeEventListener(ACCOUNT_MUTATION_COMMITTED_EVENT, this.#onMutation);
    if (this.#refreshTimer !== undefined) {
      globalThis.clearInterval(this.#refreshTimer);
      this.#refreshTimer = undefined;
    }
    this.#queuedSynchronizations.splice(0);
    this.#listeners.clear();
  }
}

let applicationAccountAuthority: DesktopAccountAuthority | undefined;

export const createDesktopAccountAuthority = (): DesktopAccountAuthority | undefined => {
  if (applicationAccountAuthority !== undefined) return applicationAccountAuthority;
  const transport = resolveDesktopAccountAuthorityTransport();
  if (transport === undefined) return undefined;
  applicationAccountAuthority = new DesktopAccountAuthority(transport);
  return applicationAccountAuthority;
};
