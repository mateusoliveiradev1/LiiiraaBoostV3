'use client';

import {
  createAccountAuthority,
  type AccountAuthority,
  type AccountAuthorityReadResult,
  type AccountProfileMutationInput,
  type AccountProfileMutationResult,
} from './account-authority';
import { readAccountCsrfToken } from './account-auth';

export const ACCOUNT_LIVE_REFRESH_MS = 5_000;

type LiveAccountAuthorityListener = (result: AccountAuthorityReadResult | null) => void;

export class LiveAccountAuthority {
  readonly #authority: AccountAuthority;
  readonly #listeners = new Set<LiveAccountAuthorityListener>();
  readonly #refreshIntervalMs: number;
  #result: AccountAuthorityReadResult | null = null;
  #refreshInFlight = false;
  #refreshTimer: ReturnType<typeof setInterval> | undefined;

  public constructor(
    authority: AccountAuthority,
    refreshIntervalMs: number = ACCOUNT_LIVE_REFRESH_MS,
  ) {
    this.#authority = authority;
    this.#refreshIntervalMs = refreshIntervalMs;
  }

  public snapshot(): AccountAuthorityReadResult | null {
    return this.#result;
  }

  #publish(result: AccountAuthorityReadResult): void {
    this.#result = result;
    for (const listener of this.#listeners) listener(result);
  }

  public async refresh(): Promise<void> {
    if (this.#refreshInFlight) return;
    this.#refreshInFlight = true;
    try {
      this.#publish(await this.#authority.project());
    } finally {
      this.#refreshInFlight = false;
    }
  }

  public async updateProfile(
    input: AccountProfileMutationInput,
  ): Promise<AccountProfileMutationResult> {
    const result = await this.#authority.updateProfile(input);
    if ('projection' in result) {
      const status =
        result.status === 'complete'
          ? 'online'
          : result.status === 'error'
            ? 'stale'
            : result.status;
      this.#publish({
        projection: result.projection,
        status,
      });
    } else if (result.status === 'error') {
      this.#publish({ code: result.code, status: 'error' });
    }
    return result;
  }

  readonly #onRefresh = (): void => {
    void this.refresh();
  };

  readonly #onVisibilityChange = (): void => {
    if (globalThis.document.visibilityState === 'visible') void this.refresh();
  };

  #start(): void {
    globalThis.addEventListener('focus', this.#onRefresh);
    globalThis.addEventListener('online', this.#onRefresh);
    globalThis.document.addEventListener('visibilitychange', this.#onVisibilityChange);
    this.#refreshTimer = globalThis.setInterval(this.#onRefresh, this.#refreshIntervalMs);
    void this.refresh();
  }

  #stop(): void {
    globalThis.removeEventListener('focus', this.#onRefresh);
    globalThis.removeEventListener('online', this.#onRefresh);
    globalThis.document.removeEventListener('visibilitychange', this.#onVisibilityChange);
    if (this.#refreshTimer !== undefined) {
      globalThis.clearInterval(this.#refreshTimer);
      this.#refreshTimer = undefined;
    }
  }

  public subscribe(listener: LiveAccountAuthorityListener): () => void {
    const start = this.#listeners.size === 0;
    this.#listeners.add(listener);
    listener(this.#result);
    if (start) this.#start();
    return () => {
      this.#listeners.delete(listener);
      if (this.#listeners.size === 0) this.#stop();
    };
  }
}

const authorities = new Map<string, LiveAccountAuthority>();

export const getLiveAccountAuthority = (baseUrl: string): LiveAccountAuthority => {
  const existing = authorities.get(baseUrl);
  if (existing !== undefined) return existing;
  const authority = new LiveAccountAuthority(
    createAccountAuthority({
      baseUrl,
      correlationId: () => `account-live-${globalThis.crypto.randomUUID()}`,
      csrfToken: () => readAccountCsrfToken(baseUrl),
    }),
  );
  authorities.set(baseUrl, authority);
  return authority;
};
