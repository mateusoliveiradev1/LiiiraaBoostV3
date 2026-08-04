import type {
  IdentityProviderPort,
  IdentityProviderResult,
} from '@liiiraa/control-plane-application';

const unavailable = <T>(): IdentityProviderResult<T> => ({
  ok: false,
  code: 'ADAPTER_UNAVAILABLE',
  retryable: false,
});

/**
 * RED witness only. Plan 04-05 replaces this closed adapter with the bounded
 * Better Auth probe after the D-01 through D-10 matrix has failed through the
 * framework-neutral port.
 */
export const createBetterAuthSpikeAdapter = (): IdentityProviderPort => ({
  beginSignIn: async () => unavailable(),
  completeSignIn: async () => unavailable(),
  verifyEmail: async () => unavailable(),
  enrollFactor: async () => unavailable(),
  stepUp: async () => unavailable(),
  listSessions: async () => unavailable(),
  revokeSession: async () => unavailable(),
  beginRecovery: async () => unavailable(),
  completeRecovery: async () => unavailable(),
});
