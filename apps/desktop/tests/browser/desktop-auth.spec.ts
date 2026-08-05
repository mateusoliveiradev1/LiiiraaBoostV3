import { expect, test, type Page } from '@playwright/test';

import { openDesktopTestCase } from './fixtures.js';

const OWNER_TASK_ID = '04-38-02';

const session = Object.freeze({
  schemaVersion: '1.0',
  aggregateVersion: '1',
  etag: 'session-desktop-real-v1',
  correlationId: 'desktop-auth-browser',
  provenance: 'postgres-authority',
  kind: 'session-projection',
  sessionId: 'session-desktop-real',
  accountId: 'account-real',
  state: 'active',
  authenticationStrength: 'password',
  scopes: ['session-desktop'],
  authenticatedAt: '2030-01-15T18:00:00.000Z',
  expiresAt: '2030-02-15T18:00:00.000Z',
  lastSeenAt: '2030-01-15T18:00:00.000Z',
});

const installDesktopAuth = async (page: Page, outcome: 'success' | 'failure' = 'success') => {
  await page.addInitScript(
    ({ outcomeValue, sessionValue }) => {
      const calls: unknown[] = [];
      Object.defineProperty(globalThis, '__LIIIRAA_DESKTOP_AUTH_CALLS__', {
        configurable: false,
        value: calls,
        writable: false,
      });
      Object.defineProperty(globalThis, '__LIIIRAA_DESKTOP_AUTH_TEST_TRANSPORT__', {
        configurable: false,
        value: Object.freeze({
          invoke: async (command: string, args?: Record<string, unknown>) => {
            calls.push({ args, command });
            await new Promise((resolve) => globalThis.setTimeout(resolve, 150));
            if (outcomeValue === 'failure') throw new Error('redacted native failure');
            if (command === 'desktop_sign_in') {
              return { session: sessionValue, status: 'authenticated' };
            }
            if (command === 'desktop_sign_out') return { status: 'signed-out' };
            throw new Error('unexpected native command');
          },
        }),
        writable: false,
      });
      Object.defineProperty(globalThis, '__LIIIRAA_ACCOUNT_AUTHORITY_TEST_TRANSPORT__', {
        configurable: false,
        value: Object.freeze({
          invoke: async (command: string) => {
            await Promise.resolve();
            if (command !== 'sync_account') throw new Error('unexpected account command');
            return { state: 'offline' };
          },
        }),
        writable: false,
      });
    },
    { outcomeValue: outcome, sessionValue: session },
  );
};

const openLogin = async (page: Page) =>
  openDesktopTestCase(page, {
    initialPath: '/login',
    operationalState: 'fixture',
    scenarioId: 'S01',
    windowsLocale: 'en-US',
  });

test(`@final @authority-smoke [owner:${OWNER_TASK_ID}] enters the account only after a real native session and stores no credential`, async ({
  page,
}) => {
  await installDesktopAuth(page);
  await openLogin(page);

  await page.getByRole('textbox', { name: 'Account email' }).fill('tester@example.com');
  await page.getByRole('button', { name: 'Continue securely' }).click();
  await expect(page.getByRole('status')).toContainText('browser');
  await expect(page.locator('.desktop-app-shell')).toHaveAttribute(
    'data-route-path',
    '/account/overview',
  );
  await expect
    .poll(() =>
      page.evaluate(() => {
        const calls: unknown = Reflect.get(globalThis, '__LIIIRAA_DESKTOP_AUTH_CALLS__');
        return Array.isArray(calls) ? calls.map((call: unknown) => call) : [];
      }),
    )
    .toEqual([
      {
        args: { email: 'tester@example.com' },
        command: 'desktop_sign_in',
      },
    ]);
  const rendererStorage = await page.evaluate(() => ({
    local: Object.entries(globalThis.localStorage),
    session: Object.entries(globalThis.sessionStorage),
  }));
  expect(JSON.stringify(rendererStorage)).not.toMatch(/credential|bearer|session-desktop-real/iu);
});

test(`@final @authority-smoke [owner:${OWNER_TASK_ID}] keeps failures generic and demo mode unauthenticated`, async ({
  page,
}) => {
  await installDesktopAuth(page, 'failure');
  await openLogin(page);
  await page.getByRole('textbox', { name: 'Account email' }).fill('tester@example.com');
  await page.getByRole('button', { name: 'Continue securely' }).click();
  await expect(page.getByRole('alert')).toContainText('could not complete');
  await expect(page.locator('.desktop-app-shell')).toHaveAttribute('data-route-path', '/login');

  await page.getByRole('button', { name: 'Explore demo mode' }).click();
  await expect(page.locator('.desktop-app-shell')).toHaveAttribute('data-route-path', '/home');
  const calls = await page.evaluate(() => {
    const recordedCalls: unknown = Reflect.get(globalThis, '__LIIIRAA_DESKTOP_AUTH_CALLS__');
    return Array.isArray(recordedCalls) ? recordedCalls.map((call: unknown) => call) : [];
  });
  expect(calls).toHaveLength(1);
});

test(`@final @authority-smoke [owner:${OWNER_TASK_ID}] removes the prepared shortcut and invokes native sign-out`, async ({
  page,
}) => {
  await installDesktopAuth(page);
  await openLogin(page);
  await expect(
    page.getByText(/sign-in is prepared|login seguro pelo navegador está preparado/iu),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: /Open local account preview|Abrir prévia da conta local/iu }),
  ).toHaveCount(0);

  await page.getByRole('textbox', { name: 'Account email' }).fill('tester@example.com');
  await page.getByRole('button', { name: 'Continue securely' }).click();
  await page.getByRole('main').getByRole('button', { exact: true, name: 'Security' }).click();
  await page.getByRole('button', { name: 'Sign out securely' }).click();

  await expect
    .poll(() =>
      page.evaluate(() => {
        const calls: unknown = Reflect.get(globalThis, '__LIIIRAA_DESKTOP_AUTH_CALLS__');
        return Array.isArray(calls) ? calls.map((call: unknown) => call) : [];
      }),
    )
    .toEqual([
      { args: { email: 'tester@example.com' }, command: 'desktop_sign_in' },
      { args: undefined, command: 'desktop_sign_out' },
    ]);
});
