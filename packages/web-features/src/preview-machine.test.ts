/// <reference lib="dom" />

import { createActor, toPromise } from 'xstate';
import { describe, expect, it, vi } from 'vitest';
import {
  PREVIEW_ACTION_FAMILIES,
  PREVIEW_ACTION_POLICIES,
  createPreviewWorkflowMachine,
  type FutureAuthorityPort,
  type PreviewWorkflowEvent,
  type PreviewWorkflowInput,
} from './preview-machine.js';

const NOW = '2030-01-15T18:00:00.000Z';
const CORRELATION_ID = 'preview-correlation-03-26';

const completeReceipt = {
  authority: {
    command: 'admin.review',
    description: 'Phase 4 admin authority',
    phase: 'Phase 4',
    surface: 'admin',
  },
  correlationId: CORRELATION_ID,
  nextPhase: 'Phase 4',
  provenance: {
    kind: 'simulated',
    scenarioId: 'W14',
  },
  receiptVersion: '1.0',
  remoteStateChanged: false,
  requestedAction: 'admin.review',
  reviewedAt: NOW,
  reviewedInputs: ['target-reviewed'],
} as const;

const adminInput = (
  overrides: Partial<PreviewWorkflowInput> = {},
): PreviewWorkflowInput => ({
  action: {
    family: 'admin',
    id: 'admin.review',
    objectLabel: 'redacted support case',
    surface: 'admin',
  },
  consent: {
    expiresAt: '2030-01-15T18:30:00.000Z',
    granted: true,
    permittedFields: ['target-reviewed'],
    purpose: 'Review a redacted support case',
    requestingActor: 'security-reviewer',
  },
  fields: {
    target: 'case-redacted-14',
  },
  impact: 'Review the immutable audit event without changing the case.',
  purpose: 'Investigate the redacted support case.',
  requiredFields: ['target'],
  review: [
    {
      after: 'case-redacted-14',
      before: 'No reviewed target',
      field: 'target',
      label: 'Redacted target',
    },
  ],
  role: 'security',
  safeDraftFields: ['target'],
  viewport: {
    width: 1280,
  },
  ...overrides,
});

const machineWith = (authority: FutureAuthorityPort) =>
  createPreviewWorkflowMachine({
    authority,
    clock: () => NOW,
    correlationId: () => CORRELATION_ID,
  });

const sendToConfirmation = (
  actor: ReturnType<typeof createActor<ReturnType<typeof machineWith>>>,
) => {
  actor.send({ type: 'SUBMIT' });
  expect(actor.getSnapshot().value).toBe('validating');
  actor.send({ type: 'VALIDATION_PASSED' });
  expect(actor.getSnapshot().value).toBe('reviewing');
  actor.send({ type: 'REVIEW' });
  expect(actor.getSnapshot().value).toBe('reauth-preview');
  actor.send({ type: 'REAUTHENTICATED' });
  expect(actor.getSnapshot().value).toBe('confirming');
};

describe('preview workflow machine', () => {
  it('defines a closed policy for every account and admin action family', () => {
    expect(PREVIEW_ACTION_FAMILIES).toEqual([
      'auth',
      'social',
      'passkey',
      'mfa',
      'session',
      'billing',
      'device',
      'privacy',
      'support',
      'diagnostic',
      'consent',
      'admin',
    ]);
    expect(Object.keys(PREVIEW_ACTION_POLICIES).sort()).toEqual(
      [...PREVIEW_ACTION_FAMILIES].sort(),
    );
    expect(
      Object.values(PREVIEW_ACTION_POLICIES).every(
        (policy) =>
          policy.authority === 'Phase 4' &&
          policy.confirmation.kind !== 'ambiguous',
      ),
    ).toBe(true);
  });

  it('reaches only a schema-valid no-change receipt after proportional confirmation', async () => {
    const execute = vi.fn<FutureAuthorityPort['execute']>().mockResolvedValue({
      kind: 'no-change',
      receipt: completeReceipt,
    });
    const actor = createActor(machineWith({ execute }), {
      input: adminInput(),
    }).start();

    sendToConfirmation(actor);
    actor.send({ confirmation: 'Review admin action', type: 'CONFIRM' });

    const output = await toPromise(actor);

    expect(actor.getSnapshot().value).toBe('complete');
    expect(output).toEqual({
      kind: 'no-change',
      receipt: completeReceipt,
      remoteStateChanged: false,
    });
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        disposition: 'confirm',
        reviewedInputs: ['target-reviewed'],
        signal: expect.any(AbortSignal),
      }),
    );
    expect(JSON.stringify(output)).not.toContain('authority-success');
  });

  it.each([
    ['purpose', { purpose: '' }],
    ['consent', { consent: null }],
    ['role', { role: null }],
    ['desktop viewport', { viewport: { width: 959 } }],
    ['stale input', { freshness: 'stale' }],
    ['required field', { fields: { target: '' } }],
  ] satisfies readonly (readonly [string, Partial<PreviewWorkflowInput>])[])(
    'fails %s closed before confirmation',
    (_condition, override) => {
      const execute = vi.fn<FutureAuthorityPort['execute']>();
      const actor = createActor(machineWith({ execute }), {
        input: adminInput(override),
      }).start();

      actor.send({ type: 'SUBMIT' });
      actor.send({ type: 'VALIDATION_PASSED' });

      expect(actor.getSnapshot().value).toBe('validation-error');
      expect(actor.getSnapshot().context.validationErrors.length).toBeGreaterThan(0);
      expect(execute).not.toHaveBeenCalled();
    },
  );

  it('preserves explicitly safe work through offline, stale, expired, and retryable failure states', () => {
    const actor = createActor(
      machineWith({
        execute: vi.fn<FutureAuthorityPort['execute']>(),
      }),
      { input: adminInput() },
    ).start();
    const safeDraft = { target: 'case-redacted-14' };

    const cases = [
      [{ type: 'GO_OFFLINE' }, 'offline'],
      [{ type: 'RETRY' }, 'editing'],
      [{ type: 'MARK_STALE' }, 'stale'],
      [{ type: 'REFRESH' }, 'editing'],
      [{ type: 'EXPIRE_SESSION' }, 'expired-session'],
      [{ type: 'RESUME_SESSION' }, 'editing'],
      [{ code: 'AUTHORITY_UNAVAILABLE', type: 'FAIL' }, 'partial-failure'],
    ] as const satisfies readonly (
      readonly [PreviewWorkflowEvent, string]
    )[];

    for (const [event, expectedState] of cases) {
      actor.send(event);
      expect(actor.getSnapshot().value).toBe(expectedState);
      expect(actor.getSnapshot().context.safeDraft).toEqual(safeDraft);
    }
  });

  it('aborts an in-flight authority actor and emits cancellation without mutation', async () => {
    let observedSignal: AbortSignal | undefined;
    const execute = vi.fn<FutureAuthorityPort['execute']>(
      ({ signal }) =>
        new Promise((resolve) => {
          observedSignal = signal;
          signal?.addEventListener(
            'abort',
            () => {
              resolve({
                code: 'ABORTED',
                correlationId: CORRELATION_ID,
                kind: 'failure',
                nextPhase: 'Phase 4',
                remoteStateChanged: false,
              });
            },
            { once: true },
          );
        }),
    );
    const actor = createActor(machineWith({ execute }), {
      input: adminInput(),
    }).start();

    sendToConfirmation(actor);
    actor.send({ confirmation: 'Review admin action', type: 'CONFIRM' });
    expect(actor.getSnapshot().value).toBe('issuing');
    actor.send({ type: 'CANCEL' });

    const output = await toPromise(actor);
    expect(observedSignal?.aborted).toBe(true);
    expect(output).toMatchObject({
      kind: 'cancelled',
      receipt: {
        nextPhase: 'Phase 4',
        reason: 'user-cancelled',
        remoteStateChanged: false,
      },
      remoteStateChanged: false,
    });
  });

  it('ignores illegal and ambiguous transitions without invoking authority', () => {
    const execute = vi.fn<FutureAuthorityPort['execute']>();
    const actor = createActor(machineWith({ execute }), {
      input: adminInput(),
    }).start();

    actor.send({ confirmation: 'Review admin action', type: 'CONFIRM' });
    actor.send({ type: 'VALIDATION_PASSED' });
    actor.send({ type: 'REAUTHENTICATED' });

    expect(actor.getSnapshot().value).toBe('editing');
    expect(execute).not.toHaveBeenCalled();
  });
});
