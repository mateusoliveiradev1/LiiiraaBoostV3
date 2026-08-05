export type AccountAuthTransport = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type AccountAuthActor = Readonly<{
  accountId: string;
  displayName: string;
  email: string;
  locale: 'pt-BR' | 'en';
  role: 'tester' | 'support' | 'operations' | 'security' | 'audit';
  sessionId: string;
  sessionKind: 'web' | 'admin' | 'desktop';
  expiresAt: string;
}>;

export type AccountAuthResult =
  | Readonly<{ actor: AccountAuthActor; status: 'authenticated' }>
  | Readonly<{
      code: 'authentication-failed' | 'invalid-response' | 'unavailable';
      status: 'error';
    }>;

export type AccountSessionResult =
  | Readonly<{ actor: AccountAuthActor; status: 'authenticated' }>
  | Readonly<{ status: 'unauthenticated' }>
  | Readonly<{ code: 'invalid-response' | 'unavailable'; status: 'error' }>;

export interface AccountAuth {
  session(): Promise<AccountSessionResult>;
  signIn(input: Readonly<{ email: string; password: string }>): Promise<AccountAuthResult>;
  signOut(): Promise<Readonly<{ status: 'signed-out' }> | Readonly<{ status: 'error' }>>;
  signUp(
    input: Readonly<{
      displayName: string;
      email: string;
      invitationToken: string;
      locale: 'pt-BR' | 'en';
      password: string;
    }>,
  ): Promise<AccountAuthResult>;
}

export interface CreateAccountAuthOptions {
  readonly baseUrl?: string;
  readonly correlationId: () => string;
  readonly transport?: AccountAuthTransport;
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const safeJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const roles = new Set(['tester', 'support', 'operations', 'security', 'audit']);
const sessionKinds = new Set(['web', 'admin', 'desktop']);

const admitActor = (value: unknown): AccountAuthActor | null => {
  if (
    !isRecord(value) ||
    typeof value['accountId'] !== 'string' ||
    typeof value['displayName'] !== 'string' ||
    typeof value['email'] !== 'string' ||
    (value['locale'] !== 'pt-BR' && value['locale'] !== 'en') ||
    typeof value['role'] !== 'string' ||
    !roles.has(value['role']) ||
    typeof value['sessionId'] !== 'string' ||
    typeof value['sessionKind'] !== 'string' ||
    !sessionKinds.has(value['sessionKind']) ||
    typeof value['expiresAt'] !== 'string'
  ) {
    return null;
  }
  return value as AccountAuthActor;
};

const actorFromBody = (value: unknown): AccountAuthActor | null =>
  isRecord(value) ? admitActor(value['actor']) : null;

const validCsrfToken = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length >= 43 &&
  value.length <= 256 &&
  /^[A-Za-z0-9._-]+$/u.test(value);

const csrfTokens = new Map<string, string>();

const requestCsrfToken = async (
  baseUrl: string,
  correlationId: string,
  transport: AccountAuthTransport,
): Promise<string | null> => {
  const response = await transport(`${baseUrl}/v1/identity/csrf`, {
    credentials: 'include',
    headers: { accept: 'application/json', 'x-correlation-id': correlationId },
    method: 'GET',
  });
  if (!response.ok) return null;
  const body = await safeJson(response);
  const token = isRecord(body) ? body['token'] : undefined;
  if (!validCsrfToken(token)) return null;
  csrfTokens.set(baseUrl, token);
  return token;
};

export const readAccountCsrfToken = (baseUrl = ''): string =>
  csrfTokens.get(baseUrl) ?? 'missing-csrf-token';

export const primeAccountCsrfToken = async (
  baseUrl = '',
  transport: AccountAuthTransport = globalThis.fetch.bind(globalThis),
): Promise<boolean> => {
  if (csrfTokens.has(baseUrl)) return true;
  try {
    return (
      (await requestCsrfToken(
        baseUrl,
        `account-csrf-${globalThis.crypto.randomUUID()}`,
        transport,
      )) !== null
    );
  } catch {
    return false;
  }
};

export const admitInvitationToken = (candidate: string | undefined): string | null => {
  const token = candidate?.trim();
  return token !== undefined &&
    token.length >= 43 &&
    token.length <= 256 &&
    /^[A-Za-z0-9_-]+$/u.test(token)
    ? token
    : null;
};

export const createAccountAuth = ({
  baseUrl = '',
  correlationId,
  transport = globalThis.fetch.bind(globalThis),
}: CreateAccountAuthOptions): AccountAuth => {
  let csrfToken: string | undefined;
  const headers = (): Record<string, string> => ({
    accept: 'application/json',
    'x-correlation-id': correlationId(),
  });
  const ensureCsrf = async (): Promise<string | null> => {
    if (csrfToken !== undefined) return csrfToken;
    csrfToken = (await requestCsrfToken(baseUrl, correlationId(), transport)) ?? undefined;
    return csrfToken ?? null;
  };
  const authenticate = async (path: string, body: Readonly<Record<string, unknown>>) => {
    try {
      const csrf = await ensureCsrf();
      if (csrf === null) return { code: 'unavailable', status: 'error' } as const;
      const response = await transport(`${baseUrl}${path}`, {
        body: JSON.stringify(body),
        credentials: 'include',
        headers: {
          ...headers(),
          'content-type': 'application/json',
          'x-csrf-token': csrf,
        },
        method: 'POST',
      });
      if (response.status === 401 || response.status === 403) {
        return { code: 'authentication-failed', status: 'error' } as const;
      }
      if (!response.ok) return { code: 'unavailable', status: 'error' } as const;
      const actor = actorFromBody(await safeJson(response));
      return actor === null
        ? ({ code: 'invalid-response', status: 'error' } as const)
        : ({ actor, status: 'authenticated' } as const);
    } catch {
      return { code: 'unavailable', status: 'error' } as const;
    }
  };

  return Object.freeze({
    async session(): Promise<AccountSessionResult> {
      try {
        const response = await transport(`${baseUrl}/v1/identity/session`, {
          credentials: 'include',
          headers: headers(),
          method: 'GET',
        });
        if (response.status === 401) return { status: 'unauthenticated' };
        if (!response.ok) return { code: 'unavailable', status: 'error' };
        const actor = actorFromBody(await safeJson(response));
        return actor === null
          ? { code: 'invalid-response', status: 'error' }
          : { actor, status: 'authenticated' };
      } catch {
        return { code: 'unavailable', status: 'error' };
      }
    },
    signIn: (input: Readonly<{ email: string; password: string }>) =>
      authenticate('/v1/identity/sign-in', input),
    async signOut() {
      try {
        const csrf = await ensureCsrf();
        if (csrf === null) return { status: 'error' } as const;
        const response = await transport(`${baseUrl}/v1/identity/sign-out`, {
          credentials: 'include',
          headers: { ...headers(), 'x-csrf-token': csrf },
          method: 'POST',
        });
        if (!response.ok) return { status: 'error' } as const;
        csrfToken = undefined;
        csrfTokens.delete(baseUrl);
        return { status: 'signed-out' } as const;
      } catch {
        return { status: 'error' } as const;
      }
    },
    signUp: (
      input: Readonly<{
        displayName: string;
        email: string;
        invitationToken: string;
        locale: 'pt-BR' | 'en';
        password: string;
      }>,
    ) => authenticate('/v1/identity/sign-up', input),
  });
};
