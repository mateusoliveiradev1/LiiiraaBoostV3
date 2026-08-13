import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import validCorpus from '../../../../packages/contracts-ts/src/fixtures/transactional-plans/valid.json' with { type: 'json' };
import {
  createTransactionalPackagedHarness,
  DeterministicBrokerProbe,
  PROMOTION_STAGES,
  TRANSACTIONAL_TAURI_COMMANDS,
  validateGeneratedTransactionalDocument,
  validateRegisteredTransactionalAuthority,
} from './transactional-plans.ts';

const desktopRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const workspaceRoot = resolve(desktopRoot, '../..');
const BUILD_SHA256 = 'a'.repeat(64);
const OPERATION_VERSION = 'managed-power-scheme-v1';
const PRIOR_GUID = '11111111-1111-4111-8111-111111111111';
const REQUESTED_GUID = '22222222-2222-4222-8222-222222222222';
const OBSERVED_GUID = '22222222-2222-4222-8222-222222222222';
const RESTORED_GUID = '11111111-1111-4111-8111-111111111111';

describe('generated schema and registered command authority', () => {
  it('validates every generated-valid transactional document', () => {
    for (const testCase of validCorpus.cases) {
      expect(() => validateGeneratedTransactionalDocument(testCase.document)).not.toThrow();
    }
  });

  it('binds every named command to the trusted Tauri capability and handler', () => {
    const capability = JSON.parse(
      readFileSync(resolve(desktopRoot, 'src-tauri/capabilities/main.json'), 'utf8'),
    ) as unknown;
    const buildSource = readFileSync(resolve(desktopRoot, 'src-tauri/build.rs'), 'utf8');
    const mainSource = readFileSync(resolve(desktopRoot, 'src-tauri/src/main.rs'), 'utf8');

    expect(() =>
      validateRegisteredTransactionalAuthority({ buildSource, capability, mainSource }),
    ).not.toThrow();
    expect(TRANSACTIONAL_TAURI_COMMANDS).toHaveLength(14);
  });

  it('rejects an omitted command or generic privileged permission', () => {
    const capability = JSON.parse(
      readFileSync(resolve(desktopRoot, 'src-tauri/capabilities/main.json'), 'utf8'),
    ) as { permissions: string[] };
    const buildSource = readFileSync(resolve(desktopRoot, 'src-tauri/build.rs'), 'utf8');
    const mainSource = readFileSync(resolve(desktopRoot, 'src-tauri/src/main.rs'), 'utf8');
    expect(() =>
      validateRegisteredTransactionalAuthority({
        buildSource,
        capability: { ...capability, permissions: [...capability.permissions, 'shell:execute'] },
        mainSource,
      }),
    ).toThrow(/unsafe authority/iu);
    expect(() =>
      validateRegisteredTransactionalAuthority({
        buildSource: buildSource.replace('"apply_plan"', '"missing_apply_plan"'),
        capability,
        mainSource,
      }),
    ).toThrow(/build manifest is missing apply_plan/iu);
  });
});

describe('physical promotion safety gate', () => {
  it('keeps physical mutation disabled by default', async () => {
    const harness = createTransactionalPackagedHarness({
      buildSha256: BUILD_SHA256,
      operationVersion: OPERATION_VERSION,
    });
    const mutation = vi.fn(async () => undefined);

    expect(harness.canExecutePhysicalMutation).toBe(false);
    await expect(harness.executePhysicalMutation(mutation)).rejects.toThrow(
      /physical mutation is disabled/iu,
    );
    expect(mutation).not.toHaveBeenCalled();
    expect(harness.evidence().physicalMutationExecuted).toBe(false);
  });

  it('refuses fixture or deterministic evidence as physical even with an unsafe flag', () => {
    expect(() =>
      createTransactionalPackagedHarness({
        buildSha256: BUILD_SHA256,
        operationVersion: OPERATION_VERSION,
        physicalMutationEnabled: true,
        runKind: 'deterministic-simulation',
      }),
    ).toThrow(/cannot enable physical mutation/iu);
  });

  it('refuses absent, mismatched, and malformed physical checkpoints', () => {
    expect(() =>
      createTransactionalPackagedHarness({
        buildSha256: BUILD_SHA256,
        completedStages: ['deterministic-simulation'],
        operationVersion: OPERATION_VERSION,
        physicalMutationEnabled: true,
        runKind: 'clean-vm',
      }),
    ).toThrow(/exact active promotion checkpoint/iu);
    expect(() =>
      createTransactionalPackagedHarness({
        buildSha256: BUILD_SHA256,
        completedStages: ['deterministic-simulation'],
        operationVersion: OPERATION_VERSION,
        physicalMutationEnabled: true,
        promotionCheckpoint: {
          acknowledgedAtUtc: 'invalid',
          acknowledgedBy: 'Liiiraa',
          checkpointId: 'phase6-clean-vm',
          stage: 'owner-pc',
        },
        runKind: 'clean-vm',
      }),
    ).toThrow(/exact active promotion checkpoint/iu);
  });

  it('enforces exact sequential stage ordering', () => {
    expect(PROMOTION_STAGES).toEqual([
      'deterministic-simulation',
      'clean-vm',
      'owner-pc',
      'friends-pc',
    ]);
    expect(() =>
      createTransactionalPackagedHarness({
        buildSha256: BUILD_SHA256,
        completedStages: ['clean-vm'],
        operationVersion: OPERATION_VERSION,
        runKind: 'owner-pc',
      }),
    ).toThrow(/exact predecessor order/iu);
    expect(() =>
      createTransactionalPackagedHarness({
        buildSha256: BUILD_SHA256,
        completedStages: ['deterministic-simulation', 'owner-pc'],
        operationVersion: OPERATION_VERSION,
        runKind: 'friends-pc',
      }),
    ).toThrow(/exact predecessor order/iu);
  });
});

describe('deterministic broker and failure drill hooks', () => {
  it('accepts one legitimate message and rejects replay, spoof, wrong-session, and remote clients', () => {
    const probe = new DeterministicBrokerProbe('signed-client-identity-v1', 'session-local-0001');
    const harness = createTransactionalPackagedHarness({
      buildSha256: BUILD_SHA256,
      operationVersion: OPERATION_VERSION,
    });

    harness.attachBrokerProbe(probe);
    const evidence = harness.evidence();
    expect(evidence.clientIdentityHash).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(evidence.drills.map(({ result }) => result)).toEqual([
      'accepted-once',
      'rejected-before-dispatch',
      'rejected-before-dispatch',
      'rejected-before-dispatch',
      'rejected-before-dispatch',
    ]);
    expect(probe.mutationCount).toBe(1);
  });

  it('records crash, reboot, drift, disk-full, and restore-point observations without dispatch', () => {
    const harness = createTransactionalPackagedHarness({
      buildSha256: BUILD_SHA256,
      operationVersion: OPERATION_VERSION,
    });
    harness.recordDrill('crash-before-observation', 'observation-required');
    harness.recordDrill('reboot-reconciliation', 'reconciled-without-redispatch');
    harness.recordDrill('external-drift', 'observed-blocked');
    harness.recordDrill('disk-full', 'observed-blocked');
    harness.recordRestorePoint('observed-ready', 41);
    harness.recordRestorePoint('observed-unavailable', null);
    harness.recordRestorePoint('observed-disabled-by-policy', null);
    harness.recordRestorePoint('observed-frequency-limited', null);
    harness.recordRestorePoint('observation-failed', null);

    const evidence = harness.evidence();
    expect(evidence.drills).toHaveLength(4);
    expect(evidence.drills.every(({ mutationCount }) => mutationCount === 0)).toBe(true);
    expect(evidence.restorePoints).toHaveLength(5);
    expect(evidence.physicalMutationExecuted).toBe(false);
  });
});

describe('exact bounded redacted evidence', () => {
  it('records prior, requested, observed, and restored GUIDs in order', () => {
    const harness = createTransactionalPackagedHarness({
      buildSha256: BUILD_SHA256,
      operationVersion: OPERATION_VERSION,
    });
    harness.recordPowerScheme('prior', PRIOR_GUID);
    harness.recordPowerScheme('requested', REQUESTED_GUID);
    harness.recordPowerScheme('observed', OBSERVED_GUID);
    harness.recordPowerScheme('restored', RESTORED_GUID);

    const evidence = harness.evidence();
    expect(evidence.powerScheme).toEqual({
      observed: OBSERVED_GUID,
      prior: PRIOR_GUID,
      requested: REQUESTED_GUID,
      restored: RESTORED_GUID,
    });
    expect(evidence.build.sha256).toBe(BUILD_SHA256);
    expect(evidence.operationVersion).toBe(OPERATION_VERSION);
    expect(evidence.runKind).toBe('deterministic-simulation');
    expect(evidence.evidenceHash).toMatch(/^sha256:[0-9a-f]{64}$/u);
  });

  it('rejects invalid or out-of-order identities', () => {
    const harness = createTransactionalPackagedHarness({
      buildSha256: BUILD_SHA256,
      operationVersion: OPERATION_VERSION,
    });
    expect(() => harness.recordPowerScheme('observed', OBSERVED_GUID)).toThrow(/out of order/iu);
    expect(() => harness.recordPowerScheme('prior', 'not-a-guid')).toThrow(/exact GUID/iu);
    expect(() => harness.recordRestorePoint('observed-ready', null)).toThrow(
      /positive observed sequence/iu,
    );
    expect(() => harness.recordRestorePoint('observed-unavailable', 7)).toThrow(
      /cannot claim a sequence/iu,
    );
  });

  it('contains exact safe identity hashes and no raw secret or hardware identifier', () => {
    const probe = new DeterministicBrokerProbe('signed-client-identity-v1', 'session-local-0001');
    const harness = createTransactionalPackagedHarness({
      buildSha256: BUILD_SHA256,
      operationVersion: OPERATION_VERSION,
    });
    harness.attachBrokerProbe(probe);
    const serialized = JSON.stringify(harness.evidence());

    expect(Buffer.byteLength(serialized, 'utf8')).toBeLessThanOrEqual(65_536);
    expect(serialized).not.toContain('signed-client-identity-v1');
    expect(serialized).not.toMatch(/password|rawSerial|machineGuid|userSid/iu);
    expect(serialized).toContain('raw-hardware-identifiers');
    expect(resolve(workspaceRoot)).toBeTruthy();
  });
});
