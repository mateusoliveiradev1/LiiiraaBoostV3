import { expect, test, type Page } from '@playwright/test';

import { openDesktopTestCase } from './fixtures.js';

const OWNER_TASK_ID = '04-35-01';

type AuthorityState = 'online' | 'offline' | 'stale' | 'pending' | 'conflict' | 'revoked';

const projection = (displayName = 'Astra Player', aggregateVersion = '7') => ({
  account: {
    schemaVersion: '1.0',
    aggregateVersion,
    etag: `account-account-01-v${aggregateVersion}`,
    correlationId: 'desktop-account-authority',
    provenance: 'postgres-authority',
    kind: 'account-projection',
    accountId: 'account-01',
    state: 'active',
    displayName,
    emailRedacted: 'a***@example.com',
    locale: 'en',
    createdAt: '2030-01-01T00:00:00.000Z',
    updatedAt: '2030-01-15T18:00:00.000Z',
  },
  provenance: 'online',
  securityMethods: [
    { factor: 'passkey', methodId: 'method-passkey', verifiedAt: '2030-01-15T10:00:00.000Z' },
    { factor: 'totp', methodId: 'method-mfa', verifiedAt: '2030-01-15T10:05:00.000Z' },
  ],
  sessions: [
    {
      schemaVersion: '1.0',
      aggregateVersion: '3',
      etag: 'session-session-01-v3',
      correlationId: 'desktop-account-authority',
      provenance: 'postgres-authority',
      kind: 'session-projection',
      sessionId: 'session-01',
      accountId: 'account-01',
      state: 'active',
      authenticationStrength: 'passkey',
      scopes: ['session-desktop'],
      authenticatedAt: '2030-01-15T10:00:00.000Z',
      expiresAt: '2030-01-16T10:00:00.000Z',
      lastSeenAt: '2030-01-15T18:00:00.000Z',
    },
  ],
  subscription: {
    schemaVersion: '1.0',
    aggregateVersion: '4',
    etag: 'subscription-account-01-v4',
    correlationId: 'desktop-account-authority',
    provenance: 'postgres-authority',
    kind: 'subscription-projection',
    subscriptionId: 'subscription-01',
    accountId: 'account-01',
    state: 'active',
    plan: 'premium',
    entitlements: ['premium-actions'],
    currentPeriodEndsAt: '2030-02-15T18:00:00.000Z',
    cancelAtPeriodEnd: false,
  },
  invoices: [],
  supportCases: [],
  activeDevice: {
    schemaVersion: '1.0',
    aggregateVersion: '5',
    etag: 'device-binding-01-v5',
    correlationId: 'desktop-account-authority',
    provenance: 'device-verified',
    kind: 'device-binding-projection',
    deviceBindingId: 'binding-01',
    accountId: 'account-01',
    state: 'active',
    deviceLabel: 'Astra-PC',
    evidenceVersion: '2',
    boundAt: '2030-01-01T00:00:00.000Z',
    replacementEligibleAt: '2030-02-14T00:00:00.000Z',
  },
});

const installNativeAccountAuthority = async (
  page: Page,
  options: Readonly<{
    conflict?: boolean;
    initialState?: AuthorityState;
    revokeOnReconnect?: boolean;
  }> = {},
): Promise<void> => {
  await page.addInitScript(
    ({ conflict, initialProjection, initialState, remoteProjection, revokeOnReconnect }) => {
      const calls: unknown[] = [];
      Object.defineProperty(globalThis, '__LIIIRAA_ACCOUNT_AUTHORITY_CALLS__', {
        configurable: false,
        value: calls,
        writable: false,
      });
      Object.defineProperty(globalThis, '__LIIIRAA_ACCOUNT_AUTHORITY_TEST_TRANSPORT__', {
        configurable: false,
        value: Object.freeze({
          invoke: async (command: string, args?: Record<string, unknown>) => {
            if (command !== 'sync_account') throw new Error('unexpected native command');
            const request = args?.['request'] as
              | {
                  mutation?: { draft?: { displayName?: string; locale?: string } };
                  trigger?: string;
                }
              | undefined;
            calls.push({ command, request });
            if (revokeOnReconnect && request?.trigger === 'reconnection') {
              return { state: 'revoked' };
            }
            if (conflict && request?.mutation !== undefined) {
              return {
                localDraft: request.mutation.draft,
                projection: remoteProjection,
                state: 'conflict',
              };
            }
            return { projection: initialProjection, state: initialState };
          },
        }),
        writable: false,
      });
    },
    {
      conflict: options.conflict === true,
      initialProjection: projection(),
      initialState: options.initialState ?? 'online',
      remoteProjection: projection('Remote Player', '8'),
      revokeOnReconnect: options.revokeOnReconnect === true,
    },
  );
};

const openAccount = async (page: Page, initialPath: string): Promise<void> => {
  await openDesktopTestCase(page, {
    initialPath,
    operationalState: 'fixture',
    scenarioId: 'S12',
    windowsLocale: 'en-US',
  });
};

test(`@final @authority-smoke [owner:${OWNER_TASK_ID}] renders generated native authority and synchronizes every lifecycle trigger`, async ({
  page,
}) => {
  await installNativeAccountAuthority(page);
  await openAccount(page, '/account/overview');

  const authority = page.getByRole('region', { name: 'Account authority status' });
  await expect(authority).toContainText('Online');
  await expect(page.getByRole('main')).toContainText('Astra Player');
  await expect(page.getByRole('main')).toContainText('a***@example.com');
  await expect(page.getByRole('main')).toContainText('Astra-PC');
  await expect(page.getByRole('main')).toContainText('Premium');
  await expect(page.getByRole('main')).not.toContainText('player@liiiraaboost.local');
  await expect(page.getByRole('main')).not.toContainText('DESKTOP-LR07');
  await expect(page.getByRole('main')).not.toContainText('FIXTURE');

  await page.evaluate(() => {
    globalThis.dispatchEvent(new Event('focus'));
    globalThis.dispatchEvent(new Event('online'));
    globalThis.dispatchEvent(new CustomEvent('liiiraa:account-mutation-committed'));
  });
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          Reflect.get(globalThis, '__LIIIRAA_ACCOUNT_AUTHORITY_CALLS__') as Array<{
            request?: { trigger?: string };
          }>
        ).map((call) => call.request?.trigger),
      ),
    )
    .toEqual(expect.arrayContaining(['launch', 'resume', 'reconnection', 'mutation']));
});

test(`@final @authority-smoke [owner:${OWNER_TASK_ID}] keeps remote truth and the safe local draft on version conflict`, async ({
  page,
}) => {
  await installNativeAccountAuthority(page, { conflict: true });
  await openAccount(page, '/account/overview');

  await page.getByRole('button', { name: 'Edit profile' }).click();
  await page.getByRole('textbox', { name: 'Display name' }).fill('Safe Local Draft');
  await page.getByRole('button', { name: 'Save changes' }).click();

  const conflict = page.getByRole('alert', { name: 'Account version conflict' });
  await expect(conflict).toContainText('Remote Player');
  await expect(conflict).toContainText('Safe Local Draft');
  await expect(page.locator('[data-account-authority-state]')).toHaveAttribute(
    'data-account-authority-state',
    'conflict',
  );
  await expect(page.getByText('Profile saved on this device.')).toHaveCount(0);
});

test(`@final @authority-smoke [owner:${OWNER_TASK_ID}] signs out on next-contact revocation while local safety remains reachable`, async ({
  page,
}) => {
  await installNativeAccountAuthority(page, { revokeOnReconnect: true });
  await openAccount(page, '/account/subscription');
  await expect(page.getByRole('region', { name: 'Account authority status' })).toContainText(
    'Online',
  );

  await page.evaluate(() => {
    globalThis.dispatchEvent(new Event('online'));
  });

  await expect(page.locator('[data-account-authority-state]')).toHaveAttribute(
    'data-account-authority-state',
    'revoked',
  );
  await expect(page.getByRole('button', { name: 'Start new Premium work' })).toBeDisabled();
  const safety = page.getByRole('region', { name: 'Local safety capabilities' });
  await expect(safety).toContainText('Warnings');
  await expect(safety).toContainText('History');
  await expect(safety).toContainText('Diagnostics');
  await expect(safety).toContainText('Restoration');
  await expect(page.getByRole('main')).not.toContainText('Astra Player');
});
