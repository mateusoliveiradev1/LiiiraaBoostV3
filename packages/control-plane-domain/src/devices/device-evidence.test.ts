import { describe, expect, it } from 'vitest';

import {
  compareDeviceEvidence,
  deriveDeviceDigest,
  deriveProtectedDeviceEvidence,
  type LocalDeviceEvidence,
  type ProtectedDeviceEvidence,
} from './device-evidence.js';

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
): Promise<ProtectedDeviceEvidence> =>
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
  it('keeps reinstall and one ordinary minor component change on the same PC', async () => {
    const before = await derive();
    const afterReinstall = await derive();
    const afterGpuChange = await derive(replaceComponent(canonicalLocalEvidence(), 'gpu', 'a'));

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

  it('explains threshold-crossing revalidation and replacement by component class', async () => {
    const before = await derive();
    const revalidation = await derive(
      replaceComponent(canonicalLocalEvidence(), 'platform-trust', 'a'),
    );
    const replacement = await derive(
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

  it('fails closed for empty, insufficient, contradictory, or VM-crossing evidence', async () => {
    const valid = await derive();
    const insufficient: ProtectedDeviceEvidence = {
      ...valid,
      components: valid.components.filter(({ componentClass }) =>
        ['gpu', 'memory-topology'].includes(componentClass),
      ),
    };
    const firstComponent = valid.components[0];
    if (firstComponent === undefined) {
      throw new Error('canonical evidence must contain a platform component');
    }
    const contradictory = {
      ...valid,
      components: [firstComponent, { ...firstComponent, protectedDigest: localDigest('f') }],
    } satisfies ProtectedDeviceEvidence;
    const virtual = await derive({
      deviceClass: 'virtual',
      components: [
        { componentClass: 'virtual-platform', localDigest: localDigest('6') },
        { componentClass: 'cpu', localDigest: localDigest('2') },
        { componentClass: 'memory-topology', localDigest: localDigest('5') },
      ],
    });

    expect(compareDeviceEvidence(valid, { ...valid, components: [] })).toMatchObject({
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
    await expect(derive({ deviceClass: 'physical', components: [] })).rejects.toThrow(
      'evidence-empty',
    );
    await expect(
      derive({
        deviceClass: 'physical',
        components: [
          { componentClass: 'cpu', localDigest: localDigest('1') },
          { componentClass: 'cpu', localDigest: localDigest('2') },
          { componentClass: 'gpu', localDigest: localDigest('3') },
        ],
      }),
    ).rejects.toThrow('evidence-contradictory:cpu');
  });
});

describe('protected device evidence privacy', () => {
  it('derives one canonical aggregate digest without retaining local evidence', async () => {
    const protectedEvidence = await derive();

    await expect(deriveDeviceDigest(protectedEvidence)).resolves.toMatch(/^[0-9a-f]{64}$/u);
    await expect(deriveDeviceDigest(protectedEvidence)).resolves.toBe(
      await deriveDeviceDigest(await derive()),
    );
    expect(JSON.stringify(protectedEvidence)).not.toContain('localDigest');
  });

  it('never returns raw hardware sentinels in transport, comparison, log, or snapshot values', async () => {
    const protectedEvidence = await derive();
    const comparison = compareDeviceEvidence(protectedEvidence, await derive());
    const observableValues = JSON.stringify({
      transport: protectedEvidence,
      comparison,
      logs: [comparison.outcome, ...comparison.reasons],
      snapshot: protectedEvidence.components,
    });

    expect(observableValues).not.toContain('localDigest');
    expect(observableValues).not.toContain('rawValue');
    for (const component of protectedEvidence.components) {
      expect(component.protectedDigest).toMatch(/^[0-9a-f]{64}$/u);
      expect(component).not.toHaveProperty('localDigest');
    }
  });

  it('makes account salt and key-version rotations unlinkable', async () => {
    const baseline = await derive();
    const otherAccount = await derive(canonicalLocalEvidence(), {
      accountSalt: 'synthetic-account-salt-beta',
    });
    const rotatedKeyVersion = await derive(canonicalLocalEvidence(), { keyVersion: 2 });

    expect(otherAccount.components.map(({ protectedDigest }) => protectedDigest)).not.toEqual(
      baseline.components.map(({ protectedDigest }) => protectedDigest),
    );
    expect(rotatedKeyVersion.components.map(({ protectedDigest }) => protectedDigest)).not.toEqual(
      baseline.components.map(({ protectedDigest }) => protectedDigest),
    );
  });
});
