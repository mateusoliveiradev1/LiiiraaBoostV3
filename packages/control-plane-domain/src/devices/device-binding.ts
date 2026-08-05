import {
  compareDeviceEvidence,
  type DeviceEvidenceComparison,
  type ProtectedDeviceEvidence,
} from './device-evidence.js';

export const DEVICE_REPLACEMENT_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1_000;
export const DEVICE_EXCEPTION_VALIDITY_MS = 24 * 60 * 60 * 1_000;
export const DEVICE_STRONG_AUTH_FRESHNESS_MS = 15 * 60 * 1_000;

export type DeviceBindingReasonCode =
  | 'premium-not-active'
  | 'friendly-identity-not-confirmed'
  | 'one-pc-consequences-not-confirmed'
  | 'one-active-pc-conflict'
  | 'replacement-cooldown-active'
  | 'customer-confirmation-required'
  | 'exception-account-mismatch'
  | 'exception-not-reviewed'
  | 'exception-invalid-validity-window'
  | 'exception-expired'
  | 'exception-already-consumed'
  | 'strong-auth-required'
  | 'theft-revoked-replacement-waits'
  | 'evidence-rejected';

export interface ActiveDeviceBinding {
  readonly bindingId: string;
  readonly deviceDigest: string;
  readonly deviceLabel: string;
  readonly evidence: ProtectedDeviceEvidence;
  readonly boundAt: string;
  readonly replacementEligibleAt: string;
}

export interface DeviceBindingState {
  readonly accountId: string;
  readonly version: bigint;
  readonly premiumActive: boolean;
  readonly activeBinding?: ActiveDeviceBinding;
}

interface NewDeviceBinding {
  readonly bindingId: string;
  readonly deviceDigest: string;
  readonly deviceLabel: string;
  readonly evidence: ProtectedDeviceEvidence;
  readonly now: string;
}

export interface BindDeviceCommand extends NewDeviceBinding {
  readonly kind: 'bind';
  readonly confirmedFriendlyIdentity: boolean;
  readonly confirmedOnePcConsequences: boolean;
}

export interface RevokeDeviceCommand {
  readonly kind: 'revoke';
  readonly reason: 'theft' | 'customer-request';
  readonly now: string;
}

export interface DeviceTransferException {
  readonly exceptionId: string;
  readonly accountId: string;
  readonly reviewed: boolean;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly consumedAt: string | null;
  readonly strongAuthVerifiedAt: string;
}

export interface TransferDeviceCommand extends NewDeviceBinding {
  readonly kind: 'transfer';
  readonly reason: 'ordinary' | 'theft';
  readonly confirmedByCustomer: boolean;
  readonly exception?: DeviceTransferException;
}

export interface RevalidateDeviceCommand {
  readonly kind: 'revalidate';
  readonly observedEvidence: ProtectedDeviceEvidence;
  readonly now: string;
}

export type DeviceBindingCommand =
  BindDeviceCommand | RevokeDeviceCommand | TransferDeviceCommand | RevalidateDeviceCommand;

export type DeviceBindingDecision =
  | Readonly<{
      outcome: 'denied';
      reason: DeviceBindingReasonCode;
      activeBindingId?: string;
      replacementEligibleAt?: string;
    }>
  | Readonly<{
      outcome: 'bind';
      binding: ActiveDeviceBinding;
      replacementEligibleAt: string;
      reason: 'first-binding-confirmed';
    }>
  | Readonly<{
      outcome: 'cooldown';
      activeBindingId: string;
      replacementEligibleAt: string;
      reason: 'replacement-cooldown-active';
    }>
  | Readonly<{
      outcome: 'revoke';
      bindingId: string;
      revokedAt: string;
      replacementEligibleAt: string;
      reason: 'theft-revoked-replacement-waits' | 'customer-revoked';
    }>
  | Readonly<{
      outcome: 'replace';
      binding: ActiveDeviceBinding;
      revokeBindingId: string;
      consumeExceptionId?: string;
      reason: 'cooldown-eligible' | 'reviewed-exception-redeemed';
    }>
  | Readonly<{
      outcome: 'retain';
      bindingId: string;
      score: number;
      reasons: readonly string[];
    }>
  | Readonly<{
      outcome: 'revalidation-required';
      bindingId: string;
      score: number;
      reasons: readonly string[];
    }>;

const instant = (value: string): number => {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error('device binding requires ISO date-time values');
  return parsed;
};

export const replacementEligibleAt = (boundAt: string): string =>
  new Date(instant(boundAt) + DEVICE_REPLACEMENT_COOLDOWN_MS).toISOString();

const bindingFrom = (command: NewDeviceBinding): ActiveDeviceBinding => ({
  bindingId: command.bindingId,
  deviceDigest: command.deviceDigest,
  deviceLabel: command.deviceLabel,
  evidence: command.evidence,
  boundAt: command.now,
  replacementEligibleAt: replacementEligibleAt(command.now),
});

const exceptionProblem = (
  state: DeviceBindingState,
  command: TransferDeviceCommand,
): DeviceBindingReasonCode | undefined => {
  const exception = command.exception;
  if (!exception) return 'replacement-cooldown-active';
  if (!command.confirmedByCustomer) return 'customer-confirmation-required';
  if (exception.accountId !== state.accountId) return 'exception-account-mismatch';
  if (!exception.reviewed) return 'exception-not-reviewed';
  if (exception.consumedAt !== null) return 'exception-already-consumed';
  const issuedAt = instant(exception.issuedAt);
  const expiresAt = instant(exception.expiresAt);
  const now = instant(command.now);
  if (expiresAt - issuedAt !== DEVICE_EXCEPTION_VALIDITY_MS) {
    return 'exception-invalid-validity-window';
  }
  if (now >= expiresAt || now < issuedAt) return 'exception-expired';
  const strongAuthAt = instant(exception.strongAuthVerifiedAt);
  if (strongAuthAt > now || now - strongAuthAt > DEVICE_STRONG_AUTH_FRESHNESS_MS) {
    return 'strong-auth-required';
  }
  return undefined;
};

const revalidationDecision = (
  activeBinding: ActiveDeviceBinding,
  comparison: DeviceEvidenceComparison,
): DeviceBindingDecision => {
  if (comparison.outcome === 'same-pc') {
    return {
      outcome: 'retain',
      bindingId: activeBinding.bindingId,
      score: comparison.score,
      reasons: comparison.reasons,
    };
  }
  if (comparison.outcome === 'revalidation-required' || comparison.outcome === 'replacement') {
    return {
      outcome: 'revalidation-required',
      bindingId: activeBinding.bindingId,
      score: comparison.score,
      reasons: comparison.reasons,
    };
  }
  return { outcome: 'denied', reason: 'evidence-rejected' };
};

export const decideDeviceBinding = (
  state: DeviceBindingState,
  command: DeviceBindingCommand,
): DeviceBindingDecision => {
  if (!state.premiumActive) return { outcome: 'denied', reason: 'premium-not-active' };

  if (command.kind === 'bind') {
    if (!command.confirmedFriendlyIdentity) {
      return { outcome: 'denied', reason: 'friendly-identity-not-confirmed' };
    }
    if (!command.confirmedOnePcConsequences) {
      return { outcome: 'denied', reason: 'one-pc-consequences-not-confirmed' };
    }
    if (state.activeBinding) {
      if (state.activeBinding.deviceDigest === command.deviceDigest) {
        return {
          outcome: 'retain',
          bindingId: state.activeBinding.bindingId,
          score: 100,
          reasons: [],
        };
      }
      return {
        outcome: 'denied',
        reason: 'one-active-pc-conflict',
        activeBindingId: state.activeBinding.bindingId,
        replacementEligibleAt: state.activeBinding.replacementEligibleAt,
      };
    }
    const binding = bindingFrom(command);
    return {
      outcome: 'bind',
      binding,
      replacementEligibleAt: binding.replacementEligibleAt,
      reason: 'first-binding-confirmed',
    };
  }

  const activeBinding = state.activeBinding;
  if (!activeBinding) return { outcome: 'denied', reason: 'one-active-pc-conflict' };

  if (command.kind === 'revalidate') {
    return revalidationDecision(
      activeBinding,
      compareDeviceEvidence(activeBinding.evidence, command.observedEvidence),
    );
  }

  if (command.kind === 'revoke') {
    return {
      outcome: 'revoke',
      bindingId: activeBinding.bindingId,
      revokedAt: command.now,
      replacementEligibleAt: activeBinding.replacementEligibleAt,
      reason: command.reason === 'theft' ? 'theft-revoked-replacement-waits' : 'customer-revoked',
    };
  }

  if (!command.confirmedByCustomer) {
    return { outcome: 'denied', reason: 'customer-confirmation-required' };
  }
  const now = instant(command.now);
  const eligibleAt = instant(activeBinding.replacementEligibleAt);
  if (now < eligibleAt) {
    const problem = exceptionProblem(state, command);
    if (problem !== undefined) {
      if (command.reason === 'ordinary' && problem === 'replacement-cooldown-active') {
        return {
          outcome: 'cooldown',
          activeBindingId: activeBinding.bindingId,
          replacementEligibleAt: activeBinding.replacementEligibleAt,
          reason: 'replacement-cooldown-active',
        };
      }
      return {
        outcome: 'denied',
        reason: problem,
        activeBindingId: activeBinding.bindingId,
        replacementEligibleAt: activeBinding.replacementEligibleAt,
      };
    }
    return {
      outcome: 'replace',
      binding: bindingFrom(command),
      revokeBindingId: activeBinding.bindingId,
      ...(command.exception ? { consumeExceptionId: command.exception.exceptionId } : {}),
      reason: 'reviewed-exception-redeemed',
    };
  }
  return {
    outcome: 'replace',
    binding: bindingFrom(command),
    revokeBindingId: activeBinding.bindingId,
    reason: 'cooldown-eligible',
  };
};
