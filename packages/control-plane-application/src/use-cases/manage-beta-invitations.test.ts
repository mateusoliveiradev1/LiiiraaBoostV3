import { describe, expect, it } from 'vitest';

import type {
  AdminInvitationCommandResult,
  AdminInvitationDependencies,
  AdminInvitationReceipt,
  AdminInvitationTransaction,
  InvitationBatchJob,
  InvitationDeliveryHandoff,
  InvitationLifecycleRecord,
  InvitationOutboxRecord,
} from '../ports/admin-invitations.js';
import {
  acceptBetaInvitation,
  issueBetaInvitation,
  manageBetaInvitation,
  preflightBetaInvitations,
  startBetaInvitationBatch,
} from './manage-beta-invitations.js';
import type { BetaInvitationState, InvitationState } from '@liiiraa/control-plane-domain';

const NOW = '2026-08-07T02:00:00.000Z';

interface Store {
  invitations: Map<string, InvitationState>;
  commands: Map<string, AdminInvitationCommandResult>;
  secretDigests: Map<string, string>;
  lifecycle: InvitationLifecycleRecord[];
  audit: object[];
  outbox: InvitationOutboxRecord[];
  receipts: AdminInvitationReceipt[];
  jobs: InvitationBatchJob[];
  activations: string[];
}

const emptyStore = (): Store => ({
  invitations: new Map(),
  commands: new Map(),
  secretDigests: new Map(),
  lifecycle: [],
  audit: [],
  outbox: [],
  receipts: [],
  jobs: [],
  activations: [],
});

const cloneStore = (store: Store): Store => ({
  invitations: new Map(store.invitations),
  commands: new Map(store.commands),
  secretDigests: new Map(store.secretDigests),
  lifecycle: [...store.lifecycle],
  audit: [...store.audit],
  outbox: [...store.outbox],
  receipts: [...store.receipts],
  jobs: [...store.jobs],
  activations: [...store.activations],
});

const pendingInvitation = (
  overrides: Partial<BetaInvitationState> = {},
): BetaInvitationState => ({
  kind: 'beta',
  invitationId: 'inv-1',
  recipientKey: 'recipient:alice',
  locale: 'pt-BR',
  version: 1n,
  status: 'pending',
  reminderCount: 0,
  reminderWindowStartedAt: '2026-08-01T02:00:00.000Z',
  createdAt: '2026-08-01T02:00:00.000Z',
  updatedAt: '2026-08-01T02:00:00.000Z',
  expiresAt: '2026-08-15T02:00:00.000Z',
  events: [{ kind: 'sent', at: '2026-08-01T02:00:00.000Z' }],
  ...overrides,
});

const harness = (initial: Store = emptyStore()) => {
  let store = cloneStore(initial);
  let authorizationCalls = 0;
  let transactionCalls = 0;
  let issuedSecrets = 0;
  const deliveries: InvitationDeliveryHandoff[] = [];
  const failures = new Set<string>();
  let nextId = 0;

  const dependencies: AdminInvitationDependencies = {
    authorization: {
      authorize: async () => {
        authorizationCalls += 1;
        return !failures.has('authorization');
      },
    },
    recipients: {
      hash: (recipient) => `recipient:${recipient.trim().toLowerCase()}`,
    },
    secrets: {
      issue: () => {
        issuedSecrets += 1;
        return { plaintext: `plain-secret-${String(issuedSecrets)}`, digest: `digest-${String(issuedSecrets)}` };
      },
      digest: (plaintext) => `digest:${plaintext}`,
    },
    delivery: {
      handoff: async (input) => {
        if (failures.has('delivery')) throw new Error(`provider leaked ${input.plaintextSecret}`);
        deliveries.push(input);
        return { deliveryReference: `delivery-${String(deliveries.length)}` };
      },
    },
    clock: { now: () => new Date(NOW) },
    ids: { next: () => `id-${String(++nextId)}` },
    repository: {
      findActiveRecipientKeys: async (recipientKeys) =>
        recipientKeys.filter((key) =>
          [...store.invitations.values()].some(
            (invitation) =>
              invitation.kind === 'beta' &&
              invitation.recipientKey === key &&
              (invitation.status === 'pending' || invitation.status === 'queued'),
          ),
        ),
      transaction: async (operation) => {
        transactionCalls += 1;
        const draft = cloneStore(store);
        const transaction: AdminInvitationTransaction = {
          findCommandResult: async (key) => draft.commands.get(key) ?? null,
          rememberCommandResult: async (key, result) => {
            if (failures.has('command')) throw new Error('command persistence leaked');
            draft.commands.set(key, result);
          },
          findActiveRecipient: async (recipientKey) =>
            [...draft.invitations.values()].find(
              (invitation) =>
                invitation.recipientKey === recipientKey &&
                (invitation.status === 'pending' || invitation.status === 'queued'),
            ) ?? null,
          countActiveBetaInvitations: async () =>
            [...draft.invitations.values()].filter(
              (invitation) => invitation.kind === 'beta' && invitation.status === 'pending',
            ).length,
          nextQueuePosition: async () =>
            Math.max(
              0,
              ...[...draft.invitations.values()].map((invitation) =>
                invitation.kind === 'beta' ? (invitation.queuePosition ?? 0) : 0,
              ),
            ) + 1,
          loadInvitation: async (invitationId) => draft.invitations.get(invitationId) ?? null,
          saveInvitation: async (invitation) => {
            if (failures.has('save')) throw new Error('save leaked alice@example.test');
            draft.invitations.set(invitation.invitationId, invitation);
          },
          invalidateSecretDigest: async (invitationId) => {
            draft.secretDigests.delete(invitationId);
          },
          saveSecretDigest: async (invitationId, digest) => {
            draft.secretDigests.set(invitationId, digest);
          },
          verifySecretDigest: async (invitationId, digest) =>
            draft.secretDigests.get(invitationId) === digest,
          appendLifecycleEvent: async (record) => {
            draft.lifecycle.push(record);
          },
          appendAudit: async (record) => {
            if (failures.has('audit')) throw new Error('audit leaked alice@example.test');
            draft.audit.push(record);
          },
          enqueueOutbox: async (record) => {
            if (failures.has('outbox')) throw new Error('outbox leaked plain-secret');
            draft.outbox.push(record);
          },
          saveJob: async (job) => {
            draft.jobs.push(job);
          },
          saveReceipt: async (receipt) => {
            if (failures.has('receipt')) throw new Error('receipt leaked');
            draft.receipts.push(receipt);
          },
          consumeInvitationAndActivateAccount: async (input) => {
            if (draft.activations.includes(input.invitationId)) return false;
            if (draft.secretDigests.get(input.invitationId) !== input.secretDigest) return false;
            draft.secretDigests.delete(input.invitationId);
            draft.activations.push(input.invitationId);
            return true;
          },
        };
        const result = await operation(transaction);
        store = draft;
        return result;
      },
    },
  };

  return {
    dependencies,
    deliveries,
    failures,
    get authorizationCalls() { return authorizationCalls; },
    get issuedSecrets() { return issuedSecrets; },
    get store() { return store; },
    get transactionCalls() { return transactionCalls; },
  };
};

describe('beta invitation application authority', () => {
  it('keeps preflight read-only and authorizes before hashing recipient details', async () => {
    const test = harness();
    const result = await preflightBetaInvitations(test.dependencies, {
      actorId: 'admin-1',
      rows: [
        { rowId: '1', recipient: 'Alice@example.test', emailValid: true, eligible: true },
        { rowId: '2', recipient: 'alice@example.test', emailValid: true, eligible: true },
      ],
    });

    expect(result).toEqual({
      ok: true,
      rows: [
        { rowId: '1', recipientKey: 'recipient:alice@example.test', classification: 'valid' },
        { rowId: '2', recipientKey: 'recipient:alice@example.test', classification: 'duplicate' },
      ],
    });
    expect(test.authorizationCalls).toBe(1);
    expect(test.transactionCalls).toBe(0);
    expect(test.issuedSecrets).toBe(0);
    expect(test.store.audit).toHaveLength(0);
    expect(test.store.outbox).toHaveLength(0);
  });

  it('serializes issue, stores only a digest and replays the durable receipt idempotently', async () => {
    const test = harness();
    const command = {
      actorId: 'admin-1', commandId: 'command-1', idempotencyKey: 'idem-1', expectedVersion: 0n,
      invitationId: 'inv-1', recipient: 'Alice@example.test', locale: 'pt-BR' as const,
    };
    const first = await issueBetaInvitation(test.dependencies, command);
    const replay = await issueBetaInvitation(test.dependencies, command);

    expect(first).toEqual(replay);
    expect(first).toMatchObject({ ok: true, outcome: 'issued' });
    expect(test.issuedSecrets).toBe(1);
    expect(test.deliveries).toHaveLength(1);
    expect(test.deliveries[0]).toMatchObject({ plaintextSecret: 'plain-secret-1', locale: 'pt-BR' });
    expect(test.store.secretDigests.get('inv-1')).toBe('digest-1');
    expect(JSON.stringify([...test.store.secretDigests, ...test.store.audit, ...test.store.outbox, ...test.store.receipts])).not.toContain('plain-secret-1');
    expect(test.store.lifecycle).toHaveLength(2);
    expect(test.store.audit).toHaveLength(1);
    expect(test.store.outbox).toHaveLength(1);
    expect(test.store.receipts).toHaveLength(1);
  });

  it('rolls back every authority and returns a privacy-safe failure', async () => {
    const test = harness();
    test.failures.add('audit');
    const result = await issueBetaInvitation(test.dependencies, {
      actorId: 'admin-1', commandId: 'command-1', idempotencyKey: 'idem-1', expectedVersion: 0n,
      invitationId: 'inv-1', recipient: 'Alice@example.test', locale: 'pt-BR',
    });

    expect(result).toEqual({ ok: false, code: 'INVITATION_OPERATION_FAILED' });
    expect(JSON.stringify(result)).not.toMatch(/alice|secret|provider/iu);
    expect(test.store.invitations).toHaveLength(0);
    expect(test.store.secretDigests).toHaveLength(0);
    expect(test.store.lifecycle).toHaveLength(0);
    expect(test.store.outbox).toHaveLength(0);
    expect(test.store.receipts).toHaveLength(0);
  });

  it('rotates resend secrets, enforces expected version and rejects administrative invitations', async () => {
    const initial = emptyStore();
    initial.invitations.set('inv-1', pendingInvitation());
    initial.secretDigests.set('inv-1', 'digest-old');
    initial.invitations.set('admin-inv', {
      kind: 'administrative-team', invitationId: 'admin-inv', recipientKey: 'recipient:ops',
      role: 'support', status: 'pending', version: 1n, createdAt: NOW, updatedAt: NOW,
    });
    const test = harness(initial);

    const stale = await manageBetaInvitation(test.dependencies, {
      actorId: 'admin-1', commandId: 'stale', idempotencyKey: 'stale', invitationId: 'inv-1',
      expectedVersion: 0n, action: { kind: 'resend', expiryMode: 'preserve', justification: 'requested' },
    });
    const rotated = await manageBetaInvitation(test.dependencies, {
      actorId: 'admin-1', commandId: 'resend', idempotencyKey: 'resend', invitationId: 'inv-1',
      expectedVersion: 1n, action: { kind: 'resend', expiryMode: 'restart', justification: 'requested' },
    });
    const administrative = await manageBetaInvitation(test.dependencies, {
      actorId: 'admin-1', commandId: 'admin', idempotencyKey: 'admin', invitationId: 'admin-inv',
      expectedVersion: 1n, action: { kind: 'revoke', reason: 'no longer needed' },
    });

    expect(stale).toEqual({ ok: false, code: 'STALE' });
    expect(rotated).toMatchObject({ ok: true, outcome: 'resent' });
    expect(test.store.secretDigests.get('inv-1')).toBe('digest-1');
    expect(administrative).toEqual({ ok: false, code: 'INVITATION_KIND_UNSUPPORTED' });
  });

  it('accepts once only after possession, terms and activation complete in the same transaction', async () => {
    const initial = emptyStore();
    initial.invitations.set('inv-1', pendingInvitation());
    initial.secretDigests.set('inv-1', 'digest:token-1');
    const test = harness(initial);
    const input = {
      commandId: 'accept-1', idempotencyKey: 'accept-1', invitationId: 'inv-1', expectedVersion: 1n,
      plaintextSecret: 'token-1', recipientPossessionVerified: true,
      possessionEvidenceExpiresAt: '2026-08-07T02:05:00.000Z', accountActivationCompleted: true,
      essentialTermsAccepted: true, accountReference: 'account-1',
    };

    const accepted = await acceptBetaInvitation(test.dependencies, input);
    const replay = await acceptBetaInvitation(test.dependencies, input);

    expect(accepted).toEqual(replay);
    expect(accepted).toMatchObject({ ok: true, outcome: 'accepted' });
    expect(test.store.activations).toEqual(['inv-1']);
    expect(test.store.secretDigests.has('inv-1')).toBe(false);
    expect(test.store.invitations.get('inv-1')).toMatchObject({ status: 'accepted', accountReference: 'account-1' });
  });

  it('commits revoke, reminder and decline transitions with lifecycle, audit, outbox and receipt', async () => {
    for (const [action, expected] of [
      [{ kind: 'revoke', reason: 'owner request' } as const, 'revoked'],
      [{ kind: 'remind' } as const, 'reminded'],
      [{ kind: 'decline' } as const, 'declined'],
    ] as const) {
      const initial = emptyStore();
      initial.invitations.set('inv-1', pendingInvitation());
      const test = harness(initial);
      const result = await manageBetaInvitation(test.dependencies, {
        actorId: 'admin-1', commandId: expected, idempotencyKey: expected,
        invitationId: 'inv-1', expectedVersion: 1n, action,
      });
      expect(result).toMatchObject({ ok: true, outcome: expected });
      expect(test.store.lifecycle.length).toBeGreaterThan(0);
      expect(test.store.audit).toHaveLength(1);
      expect(test.store.outbox).toHaveLength(1);
      expect(test.store.receipts).toHaveLength(1);
    }
  });

  it('creates one durable batch receipt with explicit issued, queued, skipped and failed results', async () => {
    const initial = emptyStore();
    initial.invitations.set('inv-1', pendingInvitation());
    const test = harness(initial);
    const result = await startBetaInvitationBatch(test.dependencies, {
      actorId: 'admin-1', commandId: 'batch-1', idempotencyKey: 'batch-1', action: 'resend',
      impactReviewed: true, reason: 'beta campaign', risk: 'standard', approvalGranted: false,
      items: [
        { invitationId: 'inv-1', disposition: 'issued' },
        { invitationId: 'inv-2', disposition: 'queued' },
        { invitationId: 'inv-3', disposition: 'skipped' },
        { invitationId: 'inv-4', disposition: 'failed' },
      ],
    });

    expect(result).toMatchObject({
      ok: true,
      outcome: 'batch-started',
      results: { issued: ['inv-1'], queued: ['inv-2'], skipped: ['inv-3'], failed: ['inv-4'] },
    });
    expect(test.store.jobs).toHaveLength(1);
    expect(test.store.outbox).toHaveLength(1);
    expect(test.store.receipts).toHaveLength(1);
  });
});
