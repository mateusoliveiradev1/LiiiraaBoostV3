import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import { controlPlaneDocumentValidator, type SessionProjectionJson } from '@liiiraa/contracts-ts';

export type DesktopAuthPhase =
  'idle' | 'opening-browser' | 'waiting-browser' | 'authenticated' | 'signed-out' | 'error';

export type DesktopSignInResult =
  | Readonly<{ session: SessionProjectionJson; status: 'authenticated' }>
  | Readonly<{ status: 'error' }>;

export type DesktopSignOutResult = Readonly<{ status: 'signed-out' | 'error' }>;

export interface DesktopAuthTransport {
  readonly invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown>;
}

export interface DesktopAuth {
  signIn(email: string): Promise<DesktopSignInResult>;
  signOut(): Promise<DesktopSignOutResult>;
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const admitSession = (value: unknown): SessionProjectionJson | undefined =>
  isRecord(value) &&
  value['kind'] === 'session-projection' &&
  value['state'] === 'active' &&
  Array.isArray(value['scopes']) &&
  value['scopes'].includes('session-desktop') &&
  controlPlaneDocumentValidator(value)
    ? (value as unknown as SessionProjectionJson)
    : undefined;

const testTransport = (): DesktopAuthTransport | undefined => {
  if (!import.meta.env.DEV) return undefined;
  const globalRecord = globalThis as unknown as Readonly<Record<PropertyKey, unknown>>;
  const testState = globalRecord['__LIIIRAA_DESKTOP_TEST__'];
  const candidate = globalRecord['__LIIIRAA_DESKTOP_AUTH_TEST_TRANSPORT__'];
  return isRecord(testState) &&
    isRecord(testState['scenario']) &&
    testState['scenario']['marker'] === 'SIMULATED SCENARIO' &&
    isRecord(candidate) &&
    typeof candidate['invoke'] === 'function'
    ? (candidate as unknown as DesktopAuthTransport)
    : undefined;
};

export const resolveDesktopAuthTransport = (): DesktopAuthTransport | undefined => {
  const fixture = testTransport();
  if (fixture !== undefined) return fixture;
  if (!Reflect.has(globalThis, '__TAURI_INTERNALS__')) return undefined;
  return Object.freeze({
    invoke: (command: string, args?: Record<string, unknown>) =>
      command === 'desktop_sign_in'
        ? tauriInvoke<unknown>('desktop_sign_in', args)
        : command === 'desktop_sign_out'
          ? tauriInvoke<unknown>('desktop_sign_out', args)
          : Promise.reject(new Error('DESKTOP_AUTH_COMMAND_REJECTED')),
  });
};

export const createDesktopAuth = (
  transport = resolveDesktopAuthTransport(),
): DesktopAuth | undefined => {
  if (transport === undefined) return undefined;
  return Object.freeze({
    async signIn(email: string): Promise<DesktopSignInResult> {
      try {
        const value = await transport.invoke('desktop_sign_in', { email });
        if (!isRecord(value) || value['status'] !== 'authenticated') return { status: 'error' };
        const session = admitSession(value['session']);
        return session === undefined ? { status: 'error' } : { session, status: 'authenticated' };
      } catch {
        return { status: 'error' };
      }
    },
    async signOut(): Promise<DesktopSignOutResult> {
      try {
        const value = await transport.invoke('desktop_sign_out');
        return isRecord(value) && value['status'] === 'signed-out'
          ? { status: 'signed-out' }
          : { status: 'error' };
      } catch {
        return { status: 'error' };
      }
    },
  });
};
