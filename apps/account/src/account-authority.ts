import {
  controlPlaneDocumentValidator,
  type AccountCommandJson,
  type AccountProjectionJson,
  type DeviceBindingProjectionJson,
  type InvoiceProjectionJson,
  type SessionProjectionJson,
  type SubscriptionProjectionJson,
  type SupportCaseProjectionJson,
} from '@liiiraa/contracts-ts';

export type AccountAuthorityObservation = 'online' | 'offline' | 'stale' | 'pending' | 'conflict';

export type AccountSecurityMethodProjection = Readonly<{
  factor: 'password' | 'passkey' | 'totp' | 'recovery-code';
  methodId: string;
  verifiedAt: string;
}>;

export type AccountAuthorityProjection = Readonly<{
  account: AccountProjectionJson;
  provenance: AccountAuthorityObservation;
  securityMethods: readonly AccountSecurityMethodProjection[];
  sessions: readonly SessionProjectionJson[];
  subscription: SubscriptionProjectionJson;
  invoices: readonly InvoiceProjectionJson[];
  supportCases: readonly SupportCaseProjectionJson[];
  activeDevice: DeviceBindingProjectionJson | null;
}>;

export type AccountAuthorityTransport = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type AccountAuthorityReadResult =
  | Readonly<{
      projection: AccountAuthorityProjection;
      status: AccountAuthorityObservation;
    }>
  | Readonly<{
      code: 'invalid-authority' | 'unauthorized' | 'unavailable';
      status: 'error';
    }>;

export type AccountProfileDraft = Readonly<{
  displayName: string;
  locale: 'pt-BR' | 'en';
  token: string;
}>;

export type AccountProfileMutationInput = Readonly<{
  displayName: string;
  localDraftToken: string;
  locale: 'pt-BR' | 'en';
  projection: AccountAuthorityProjection;
}>;

export type AccountProfileMutationResult =
  | Readonly<{
      projection: AccountAuthorityProjection;
      status: 'complete' | 'pending';
    }>
  | Readonly<{
      draft: AccountProfileDraft;
      projection: AccountAuthorityProjection;
      status: 'conflict';
    }>
  | Readonly<{
      code: 'invalid-authority' | 'unauthorized' | 'unavailable';
      projection?: AccountAuthorityProjection;
      status: 'error' | 'offline' | 'stale';
    }>;

export interface AccountAuthority {
  project(): Promise<AccountAuthorityReadResult>;
  updateProfile(input: AccountProfileMutationInput): Promise<AccountProfileMutationResult>;
}

export interface CreateAccountAuthorityOptions {
  readonly baseUrl?: string;
  readonly clock?: () => string;
  readonly commandId?: () => string;
  readonly correlationId: () => string;
  readonly csrfToken: () => string;
  readonly transport?: AccountAuthorityTransport;
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isSecurityMethod = (value: unknown): value is AccountSecurityMethodProjection =>
  isRecord(value) &&
  typeof value['methodId'] === 'string' &&
  ['password', 'passkey', 'totp', 'recovery-code'].includes(String(value['factor'])) &&
  typeof value['verifiedAt'] === 'string';

const isGeneratedDocument = (value: unknown, kind: string): boolean =>
  isRecord(value) && value['kind'] === kind && controlPlaneDocumentValidator(value);

const admitProjection = (value: unknown): AccountAuthorityProjection | null => {
  if (
    !isRecord(value) ||
    !['online', 'offline', 'stale', 'pending', 'conflict'].includes(String(value['provenance'])) ||
    !isGeneratedDocument(value['account'], 'account-projection') ||
    !Array.isArray(value['securityMethods']) ||
    !value['securityMethods'].every(isSecurityMethod) ||
    !Array.isArray(value['sessions']) ||
    !value['sessions'].every((item) => isGeneratedDocument(item, 'session-projection')) ||
    !isGeneratedDocument(value['subscription'], 'subscription-projection') ||
    !Array.isArray(value['invoices']) ||
    !value['invoices'].every((item) => isGeneratedDocument(item, 'invoice-projection')) ||
    !Array.isArray(value['supportCases']) ||
    !value['supportCases'].every((item) => isGeneratedDocument(item, 'support-case-projection')) ||
    (value['activeDevice'] !== null &&
      !isGeneratedDocument(value['activeDevice'], 'device-binding-projection'))
  ) {
    return null;
  }
  const projection = value as unknown as AccountAuthorityProjection;
  const accountId = projection.account.accountId;
  const owned = [
    projection.subscription.accountId,
    ...projection.sessions.map((session) => session.accountId),
    ...projection.invoices.map((invoice) => invoice.accountId),
    ...projection.supportCases.map((supportCase) => supportCase.accountId),
    ...(projection.activeDevice === null ? [] : [projection.activeDevice.accountId]),
  ];
  return owned.every((candidate) => candidate === accountId) ? projection : null;
};

const safeJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const quotedEtag = (etag: string): string => `"${etag.replaceAll('"', '')}"`;

const boundedToken = (value: string): boolean =>
  value.length >= 1 && value.length <= 128 && /^[A-Za-z0-9._:-]+$/u.test(value);

const statusFromProjection = (
  projection: AccountAuthorityProjection,
): AccountAuthorityObservation => projection.provenance;

export const createAccountAuthority = ({
  baseUrl = '',
  clock = () => new Date().toISOString(),
  commandId = () => globalThis.crypto.randomUUID(),
  correlationId,
  csrfToken,
  transport = globalThis.fetch.bind(globalThis),
}: CreateAccountAuthorityOptions): AccountAuthority => {
  let lastKnown: AccountAuthorityProjection | undefined;

  const headers = (correlation: string): Record<string, string> => ({
    accept: 'application/json',
    'x-correlation-id': correlation,
    'x-csrf-token': csrfToken(),
  });

  return Object.freeze({
    async project(): Promise<AccountAuthorityReadResult> {
      try {
        const response = await transport(`${baseUrl}/v1/account`, {
          credentials: 'include',
          headers: headers(correlationId()),
          method: 'GET',
        });
        if (response.status === 401) return { code: 'unauthorized', status: 'error' };
        if (response.status === 503 && lastKnown !== undefined) {
          return { projection: lastKnown, status: 'stale' };
        }
        if (!response.ok) return { code: 'unavailable', status: 'error' };
        const projection = admitProjection(await safeJson(response));
        if (projection === null) return { code: 'invalid-authority', status: 'error' };
        lastKnown = projection;
        return { projection, status: statusFromProjection(projection) };
      } catch {
        return lastKnown === undefined
          ? { code: 'unavailable', status: 'error' }
          : { projection: lastKnown, status: 'offline' };
      }
    },

    async updateProfile(input: AccountProfileMutationInput): Promise<AccountProfileMutationResult> {
      const displayName = input.displayName.trim();
      if (
        displayName.length < 1 ||
        displayName.length > 80 ||
        !boundedToken(input.localDraftToken)
      ) {
        return { code: 'invalid-authority', status: 'error' };
      }
      const correlation = correlationId();
      const command: AccountCommandJson = {
        schemaVersion: '1.0',
        kind: 'account-command',
        commandId: commandId(),
        accountId: input.projection.account.accountId,
        action: 'update-profile',
        expectedVersion: input.projection.account.aggregateVersion,
        correlationId: correlation,
        requestedAt: clock(),
      };
      const draft: AccountProfileDraft = {
        displayName,
        locale: input.locale,
        token: input.localDraftToken,
      };
      try {
        const response = await transport(`${baseUrl}/v1/account`, {
          body: JSON.stringify({
            command,
            localDraftToken: input.localDraftToken,
            patch: { displayName, locale: input.locale },
          }),
          credentials: 'include',
          headers: {
            ...headers(correlation),
            'content-type': 'application/json',
            'if-match': quotedEtag(input.projection.account.etag),
          },
          method: 'PATCH',
        });
        const body = await safeJson(response);
        if (response.status === 401) return { code: 'unauthorized', status: 'error' };
        if (response.status === 409 && isRecord(body)) {
          const projection = admitProjection(body['projection']);
          if (projection === null) return { code: 'invalid-authority', status: 'error' };
          lastKnown = projection;
          return { draft, projection, status: 'conflict' };
        }
        const projection = admitProjection(body);
        if (projection === null) return { code: 'invalid-authority', status: 'error' };
        lastKnown = projection;
        return {
          projection,
          status:
            response.status === 202 || projection.provenance === 'pending' ? 'pending' : 'complete',
        };
      } catch {
        return lastKnown === undefined
          ? { code: 'unavailable', status: 'offline' }
          : { code: 'unavailable', projection: lastKnown, status: 'offline' };
      }
    },
  });
};
