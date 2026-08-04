import { describe, expect, it } from 'vitest';

import {
  compareDeviceEvidence,
  deriveProtectedDeviceEvidence,
  type LocalDeviceEvidence,
  type ProtectedDeviceEvidence,
} from './device-evidence.js';

const RAW_SENTINELS = {
  platform: 'SMBIOS-BOARD-SERIAL-RAW-9001',
  cpu: 'PROCESSOR-ID-RAW-9002',
  storage: 'NVME-SERIAL-RAW-9003',
  gpu: 'GPU-PNP-ID-RAW-9004',
  memory: 'DIMM-SERIAL-RAW-9005',
} as const;

const localDigest = (byte: string): string => byte.repeat(64);

const canonicalLocalEvidence = (): LocalDeviceEvidence => ({
  deviceClass: 'physical',
  components: [
    { componentClass: 'platform-trust', localDigest: localDigest('1') },
    { componentClass: 'cpu', localDigest: localDigest('2') },
    { componentClass: 'storage-controller', localDigest: localDigest('3') },
    { componentClass: 'gpu', localDigest: localDigest('4') },
    { componentClass: 'memory-topology', localDigest: localDigest('5') },
  ],
});

const derive = (
  evidence: LocalDeviceEvidence = canonicalLocalEvidence(),
  overrides: Partial<{
    accountSalt: string;
    serverWrappingKey: string;
    keyVersion: number;
  }> = {},
): ProtectedDeviceEvidence =>
  deriveProtectedDeviceEvidence({
    evidence,
    accountSalt: overrides.accountSalt ?? 'synthetic-account-salt-alpha',
    serverWrappingKey: overrides.serverWrappingKey ?? 'synthetic-server-wrapping-key-alpha',
    keyVersion: overrides.keyVersion ?? 1,
  });

const replaceComponent = (
  evidence: LocalDeviceEvidence,
  componentClass: LocalDeviceEvidence['components'][number]['componentClass'],
  digestByte: string,
): LocalDeviceEvidence => ({
  ...evidence,
  components: evidence.components.map((component) =>
    component.componentClass === componentClass
      ? { ...component, localDigest: localDigest(digestByte) }
      : component,
  ),
});

describe('protected device evidence tolerance policy', () => {
  it('keeps reinstall and one ordinary minor component change on the same PC', () => {
    const before = derive();
    const afterReinstall = derive();
    const afterGpuChange = derive(replaceComponent(canonicalLocalEvidence(), 'gpu', 'a'));

    expect(compareDeviceEvidence(before, afterReinstall)).toMatchObject({
      outcome: 'same-pc',
      score: 100,
      changedComponents: [],
    });
    expect(compareDeviceEvidence(before, afterGpuChange)).toMatchObject({
      outcome: 'same-pc',
      score: 90,
      changedComponents: ['gpu'],
    });
  });

  it('explains threshold-crossing revalidation and replacement by component class', () => {
    const before = derive();
    const revalidation = derive(
      replaceComponent(canonicalLocalEvidence(), 'platform-trust', 'a'),
    );
    const replacement = derive(
      replaceComponent(
        replaceComponent(canonicalLocalEvidence(), 'platform-trust', 'a'),
        'cpu',
        'b',
      ),
    );

    expect(compareDeviceEvidence(before, revalidation)).toEqual({
      outcome: 'revalidation-required',
      score: 60,
      matchedComponents: ['cpu', 'storage-controller', 'gpu', 'memory-topology'],
      changedComponents: ['platform-trust'],
      reasons: ['component-changed:platform-trust', 'score-requires-online-revalidation'],
    });
    expect(compareDeviceEvidence(before, replacement)).toMatchObject({
      outcome: 'replacement',
      score: 35,
      changedComponents: ['platform-trust', 'cpu'],
      reasons: [
        'component-changed:platform-trust',
        'component-changed:cpu',
        'score-indicates-replacement',
      ],
    });
  });

  it('fails closed for empty, insufficient, contradictory, or VM-crossing evidence', () => {
    const valid = derive();
    const insufficient = deriveProtectedDeviceEvidence({
      evidence: {
        deviceClass: 'physical',
        components: [
          { componentClass: 'gpu', localDigest: localDigest('4') },
          { componentClass: 'memory-topology', localDigest: localDigest('5') },
        ],
      },
      accountSalt: 'synthetic-account-salt-alpha',
      serverWrappingKey: 'synthetic-server-wrapping-key-alpha',
      keyVersion: 1,
    });
    const contradictory = {
      ...valid,
      components: [valid.components[0], { ...valid.components[0], protectedDigest: localDigest('f') }],
    } satisfies ProtectedDeviceEvidence;
    const virtual = derive({
      deviceClass: 'virtual',
      components: [
        { componentClass: 'virtual-platform', localDigest: localDigest('6') },
        { componentClass: 'cpu', localDigest: localDigest('2') },
        { componentClass: 'memory-topology', localDigest: localDigest('5') },
      ],
    });

    expect(compareDeviceEvidence(valid, derive({ deviceClass: 'physical', components: [] }))).toMatchObject({
      outcome: 'rejected',
      reasons: ['evidence-empty'],
    });
    expect(compareDeviceEvidence(valid, insufficient)).toMatchObject({
      outcome: 'rejected',
      reasons: ['evidence-below-minimum'],
    });
    expect(compareDeviceEvidence(valid, contradictory)).toMatchObject({
      outcome: 'rejected',
      reasons: ['evidence-contradictory:platform-trust'],
    });
    expect(compareDeviceEvidence(valid, virtual)).toMatchObject({
      outcome: 'rejected',
      reasons: ['physical-virtual-evidence-mismatch'],
    });
  });
});

describe('protected device evidence privacy', () => {
  it('never returns raw hardware sentinels in transport, comparison, log, or snapshot values', () => {
    const protectedEvidence = derive();
    const comparison = compareDeviceEvidence(protectedEvidence, derive());
    const observableValues = JSON.stringify({
      transport: protectedEvidence,
      comparison,
      logs: [comparison.outcome, ...comparison.reasons],
      snapshot: protectedEvidence.components,
    });

    for (const sentinel of Object.values(RAW_SENTINELS)) {
      expect(observableValues).not.toContain(sentinel);
    }
    for (const component of protectedEvidence.components) {
      expect(component.protectedDigest).toMatch(/^[0-9a-f]{64}$/u);
      expect(component).not.toHaveProperty('localDigest');
    }
  });

  it('makes account salt and key-version rotations unlinkable', () => {
    const baseline = derive();
    const otherAccount = derive(canonicalLocalEvidence(), {
      accountSalt: 'synthetic-account-salt-beta',
    });
    const rotatedKeyVersion = derive(canonicalLocalEvidence(), { keyVersion: 2 });

    expect(otherAccount.components.map(({ protectedDigest }) => protectedDigest)).not.toEqual(
      baseline.components.map(({ protectedDigest }) => protectedDigest),
    );
    expect(rotatedKeyVersion.components.map(({ protectedDigest }) => protectedDigest)).not.toEqual(
      baseline.components.map(({ protectedDigest }) => protectedDigest),
    );
  });
});
