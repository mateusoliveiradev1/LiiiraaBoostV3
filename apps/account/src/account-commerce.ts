'use client';

import type { CommerceCommandJson, SubscriptionProjectionJson } from '@liiiraa/contracts-ts';
import type { WebLocale } from '@liiiraa/web-core';

import { primeAccountCsrfToken, readAccountCsrfToken } from './account-auth';

export type CheckoutCadence = 'monthly' | 'annual';
export type CheckoutCurrency = 'BRL' | 'USD';

export const ACCOUNT_COMMERCE_PRICES = Object.freeze({
  BRL: Object.freeze({ annual: 24_990, monthly: 2_990 }),
  USD: Object.freeze({ annual: 5_999, monthly: 699 }),
} as const);

export type AccountCommerceResult =
  | Readonly<{ status: 'redirect'; url: string }>
  | Readonly<{
      code: 'invalid-response' | 'stale' | 'unauthorized' | 'unavailable';
      status: 'error';
    }>;

export interface AccountCommerce {
  openPortal(locale: WebLocale): Promise<AccountCommerceResult>;
  startCheckout(
    input: Readonly<{
      cadence: CheckoutCadence;
      currency: CheckoutCurrency;
      locale: WebLocale;
      subscription: SubscriptionProjectionJson;
    }>,
  ): Promise<AccountCommerceResult>;
}

export type AccountCommerceTransport = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

const safeJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const safeStripeUrl = (value: unknown, hosts: readonly string[]): string | null => {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      url.username.length === 0 &&
      url.password.length === 0 &&
      hosts.includes(url.hostname)
      ? url.toString()
      : null;
  } catch {
    return null;
  }
};

const resultFromResponse = async (
  response: Response,
  key: 'checkoutUrl' | 'url',
  hosts: readonly string[],
): Promise<AccountCommerceResult> => {
  if (response.status === 401) return { code: 'unauthorized', status: 'error' };
  if (response.status === 409) return { code: 'stale', status: 'error' };
  if (!response.ok) return { code: 'unavailable', status: 'error' };
  const body = await safeJson(response);
  const url = isRecord(body) ? safeStripeUrl(body[key], hosts) : null;
  return url === null ? { code: 'invalid-response', status: 'error' } : { status: 'redirect', url };
};

export const createAccountCommerce = ({
  baseUrl = '',
  clock = () => new Date().toISOString(),
  commandId = () => globalThis.crypto.randomUUID(),
  correlationId = () => `account-commerce-${globalThis.crypto.randomUUID()}`,
  transport = globalThis.fetch.bind(globalThis),
}: Readonly<{
  baseUrl?: string;
  clock?: () => string;
  commandId?: () => string;
  correlationId?: () => string;
  transport?: AccountCommerceTransport;
}> = {}): AccountCommerce => {
  const authorizedHeaders = async (): Promise<Record<string, string> | null> => {
    if (!(await primeAccountCsrfToken(baseUrl, transport))) return null;
    const csrf = readAccountCsrfToken(baseUrl);
    return csrf === 'missing-csrf-token'
      ? null
      : {
          accept: 'application/json',
          'content-type': 'application/json',
          'x-correlation-id': correlationId(),
          'x-csrf-token': csrf,
        };
  };

  return Object.freeze({
    async openPortal(locale: WebLocale): Promise<AccountCommerceResult> {
      const headers = await authorizedHeaders();
      if (headers === null) return { code: 'unavailable', status: 'error' };
      try {
        const response = await transport(`${baseUrl}/v1/commerce/portal`, {
          body: JSON.stringify({ locale }),
          credentials: 'include',
          headers,
          method: 'POST',
        });
        return await resultFromResponse(response, 'url', ['billing.stripe.com']);
      } catch {
        return { code: 'unavailable', status: 'error' };
      }
    },

    async startCheckout(
      input: Readonly<{
        cadence: CheckoutCadence;
        currency: CheckoutCurrency;
        locale: WebLocale;
        subscription: SubscriptionProjectionJson;
      }>,
    ): Promise<AccountCommerceResult> {
      const headers = await authorizedHeaders();
      if (headers === null) return { code: 'unavailable', status: 'error' };
      const command: CommerceCommandJson = {
        schemaVersion: '1.0',
        kind: 'commerce-command',
        commandId: commandId(),
        accountId: input.subscription.accountId,
        action: 'start-checkout',
        expectedVersion: input.subscription.aggregateVersion,
        correlationId: correlationId(),
        requestedAt: clock(),
      };
      try {
        const response = await transport(`${baseUrl}/v1/commerce/checkout`, {
          body: JSON.stringify({
            command,
            locale: input.locale,
            selection: {
              cadence: input.cadence,
              currency: input.currency,
              paymentMethod: 'card',
              plan: 'premium',
              priceMinor: ACCOUNT_COMMERCE_PRICES[input.currency][input.cadence],
            },
          }),
          credentials: 'include',
          headers,
          method: 'POST',
        });
        return await resultFromResponse(response, 'checkoutUrl', ['checkout.stripe.com']);
      } catch {
        return { code: 'unavailable', status: 'error' };
      }
    },
  });
};
