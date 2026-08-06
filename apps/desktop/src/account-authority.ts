import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import {
  controlPlaneDocumentValidator,
  type AccountCommandJson,
  type AccountProjectionJson,
  type DeviceBindingProjectionJson,
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

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isGeneratedDocument = (value: unknown, kind: string): boolean =>
  isRecord(value) && value['kind'] === kind && controlPlaneDocumentValidator(value);

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
    !value['sessions'].every((session) => isGeneratedDocument(session, 'session-projection')) ||
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

const testTransport = (): AccountAuthorityTransport | undefined => {
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
          }),
        }),
      );
    }
  }

  public async synchronize(trigger: AccountLifecycleTrigger): Promise<void> {
    const sequence = ++this.#sequence;
    this.#publish(pendingSnapshot(this.#snapshot));
    try {
      const raw = await this.#transport.invoke(ACCOUNT_SYNC_COMMAND, { request: { trigger } });
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
    }
  }

  public async updateProfile(draft: SafeAccountProfileDraft): Promise<void> {
    const projection = this.#snapshot.projection;
    const normalizedDraft = safeDraft(draft);
    if (projection === undefined || normalizedDraft === undefined) return;
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
      if (sequence !== this.#sequence) return;
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
        return;
      }
      this.#publish(next);
    } catch {
      if (sequence !== this.#sequence) return;
      this.#publish(
        Object.freeze({
          state: 'stale',
          projection,
          localDraft: normalizedDraft,
          error: 'network-unavailable',
        }),
      );
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

  public start(): void {
    if (this.#started) return;
    this.#started = true;
    globalThis.addEventListener('focus', this.#onResume);
    globalThis.addEventListener('online', this.#onReconnect);
    globalThis.addEventListener(ACCOUNT_MUTATION_COMMITTED_EVENT, this.#onMutation);
    void this.synchronize('launch');
  }

  public dispose(): void {
    if (!this.#started) return;
    this.#started = false;
    this.#sequence += 1;
    globalThis.removeEventListener('focus', this.#onResume);
    globalThis.removeEventListener('online', this.#onReconnect);
    globalThis.removeEventListener(ACCOUNT_MUTATION_COMMITTED_EVENT, this.#onMutation);
    this.#listeners.clear();
  }
}

export const createDesktopAccountAuthority = (): DesktopAccountAuthority | undefined => {
  const transport = resolveDesktopAccountAuthorityTransport();
  return transport === undefined ? undefined : new DesktopAccountAuthority(transport);
};
