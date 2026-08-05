import { describe, expect, it } from 'vitest';

import { decideDeviceBinding } from './device-binding.js';
import type {
  BindDeviceCommand,
  DeviceTransferException,
  TransferDeviceCommand,
} from './device-binding.js';
import type { ProtectedDeviceEvidence } from './device-evidence.js';

const NOW = '2030-02-01T12:00:00.000Z';
const ELIGIBLE_AT = '2030-03-03T12:00:00.000Z';

const evidence = (platformByte = 'a'): ProtectedDeviceEvidence => ({
  deviceClass: 'physical',
  keyVersion: 1,
  components: [
    { componentClass: 'platform-trust', protectedDigest: platformByte.repeat(64) },
    { componentClass: 'cpu', protectedDigest: 'b'.repeat(64) },
    { componentClass: 'storage-controller', protectedDigest: 'c'.repeat(64) },
    { componentClass: 'gpu', protectedDigest: 'd'.repeat(64) },
    { componentClass: 'memory-topology', protectedDigest: 'e'.repeat(64) },
  ],
});

describe('D-23 through D-28 device binding decisions', () => {
  it('requires active Premium and both first-bind confirmations', () => {
    const decide = decideDeviceBinding;
    const unbound = { accountId: 'account-player', version: 0n, premiumActive: true };
    const command: BindDeviceCommand = {
      kind: 'bind',
      bindingId: 'binding-new',
      deviceDigest: '1'.repeat(64),
      deviceLabel: 'Liiiraa Rig',
      evidence: evidence(),
      confirmedFriendlyIdentity: true,
      confirmedOnePcConsequences: true,
      now: NOW,
    };

    expect(decide({ ...unbound, premiumActive: false }, command)).toMatchObject({
      outcome: 'denied',
      reason: 'premium-not-active',
    });
    expect(decide(unbound, { ...command, confirmedFriendlyIdentity: false })).toMatchObject({
      outcome: 'denied',
      reason: 'friendly-identity-not-confirmed',
    });
    expect(decide(unbound, { ...command, confirmedOnePcConsequences: false })).toMatchObject({
      outcome: 'denied',
      reason: 'one-pc-consequences-not-confirmed',
    });
    expect(decide(unbound, command)).toMatchObject({
      outcome: 'bind',
      replacementEligibleAt: ELIGIBLE_AT,
    });
  });

  it('keeps the active PC during an ordinary pre-cooldown transfer', () => {
    const decide = decideDeviceBinding;
    const current = {
      accountId: 'account-player',
      version: 7n,
      premiumActive: true,
      activeBinding: {
        bindingId: 'binding-current',
        deviceDigest: '1'.repeat(64),
        deviceLabel: 'Current PC',
        evidence: evidence(),
        boundAt: NOW,
        replacementEligibleAt: ELIGIBLE_AT,
      },
    };

    expect(
      decide(current, {
        kind: 'transfer',
        reason: 'ordinary',
        bindingId: 'binding-replacement',
        deviceDigest: '2'.repeat(64),
        deviceLabel: 'Replacement PC',
        evidence: evidence('f'),
        confirmedByCustomer: true,
        now: '2030-02-15T12:00:00.000Z',
      }),
    ).toMatchObject({
      outcome: 'cooldown',
      activeBindingId: 'binding-current',
      replacementEligibleAt: ELIGIBLE_AT,
      reason: 'replacement-cooldown-active',
    });
  });

  it('revokes theft immediately and permits replacement only with a valid customer-redeemed exception', () => {
    const decide = decideDeviceBinding;
    const state = {
      accountId: 'account-player',
      version: 3n,
      premiumActive: true,
      activeBinding: {
        bindingId: 'binding-stolen',
        deviceDigest: '1'.repeat(64),
        deviceLabel: 'Stolen PC',
        evidence: evidence(),
        boundAt: NOW,
        replacementEligibleAt: ELIGIBLE_AT,
      },
    };
    const theft = decide(state, { kind: 'revoke', reason: 'theft', now: NOW });
    expect(theft).toMatchObject({
      outcome: 'revoke',
      bindingId: 'binding-stolen',
      replacementEligibleAt: ELIGIBLE_AT,
      reason: 'theft-revoked-replacement-waits',
    });

    const validException: DeviceTransferException = {
      exceptionId: 'exception-one',
      accountId: 'account-player',
      reviewed: true,
      issuedAt: NOW,
      expiresAt: '2030-02-02T12:00:00.000Z',
      consumedAt: null,
      strongAuthVerifiedAt: '2030-02-02T10:55:00.000Z',
    };
    const replacement: TransferDeviceCommand = {
      kind: 'transfer',
      reason: 'theft',
      bindingId: 'binding-replacement',
      deviceDigest: '2'.repeat(64),
      deviceLabel: 'Replacement PC',
      evidence: evidence('f'),
      confirmedByCustomer: true,
      now: '2030-02-02T11:00:00.000Z',
      exception: validException,
    };
    expect(decide(state, replacement)).toMatchObject({
      outcome: 'replace',
      revokeBindingId: 'binding-stolen',
      consumeExceptionId: 'exception-one',
    });
    expect(
      decide(state, {
        ...replacement,
        exception: { ...validException, consumedAt: NOW },
      }),
    ).toMatchObject({ outcome: 'denied', reason: 'exception-already-consumed' });
    expect(
      decide(state, {
        ...replacement,
        now: '2030-02-02T12:00:00.001Z',
      }),
    ).toMatchObject({ outcome: 'denied', reason: 'exception-expired' });
    expect(
      decide(state, {
        ...replacement,
        exception: { ...validException, reviewed: false },
      }),
    ).toMatchObject({ outcome: 'denied', reason: 'exception-not-reviewed' });
    expect(
      decide(state, {
        ...replacement,
        exception: { ...validException, accountId: 'account-attacker' },
      }),
    ).toMatchObject({ outcome: 'denied', reason: 'exception-account-mismatch' });
    expect(
      decide(state, {
        ...replacement,
        exception: {
          ...validException,
          expiresAt: '2030-02-03T12:00:00.000Z',
        },
      }),
    ).toMatchObject({ outcome: 'denied', reason: 'exception-invalid-validity-window' });
    expect(
      decide(state, {
        ...replacement,
        exception: {
          ...validException,
          strongAuthVerifiedAt: '2030-02-02T10:30:00.000Z',
        },
      }),
    ).toMatchObject({ outcome: 'denied', reason: 'strong-auth-required' });
    expect(decide(state, { ...replacement, confirmedByCustomer: false })).toMatchObject({
      outcome: 'denied',
      reason: 'customer-confirmation-required',
    });
  });

  it('retains minor evidence changes and opens explainable revalidation for substantial change', () => {
    const decide = decideDeviceBinding;
    const state = {
      accountId: 'account-player',
      version: 1n,
      premiumActive: true,
      activeBinding: {
        bindingId: 'binding-current',
        deviceDigest: '1'.repeat(64),
        deviceLabel: 'Current PC',
        evidence: evidence(),
        boundAt: NOW,
        replacementEligibleAt: ELIGIBLE_AT,
      },
    };
    const minorEvidence = {
      ...evidence(),
      components: evidence().components.map((component) =>
        component.componentClass === 'gpu'
          ? { ...component, protectedDigest: '9'.repeat(64) }
          : component,
      ),
    };

    expect(
      decide(state, { kind: 'revalidate', observedEvidence: minorEvidence, now: NOW }),
    ).toMatchObject({ outcome: 'retain', score: 90 });
    const substantial = decide(state, {
      kind: 'revalidate',
      observedEvidence: evidence('f'),
      now: NOW,
    });
    expect(substantial).toMatchObject({ outcome: 'revalidation-required' });
    expect(substantial.outcome === 'revalidation-required' && substantial.reasons).toContain(
      'component-changed:platform-trust',
    );
  });
});
