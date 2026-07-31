/// <reference lib="dom" />

import { createActor, toPromise } from 'xstate';
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LbButton, LbTextField } from '@liiiraa/design-system';
import {
  PREVIEW_ACTION_FAMILIES,
  PREVIEW_ACTION_POLICIES,
  PREVIEW_WORKFLOW_STATES,
  PREVIEW_WORKFLOW_TRANSITIONS,
  createPreviewWorkflowMachine,
  type FutureAuthorityPort,
  type PreviewWorkflowEvent,
  type PreviewWorkflowInput,
} from './preview-machine.js';
import {
  PreviewConfirmation,
  PreviewErrorSummary,
  PreviewFailure,
  PreviewReceipt,
  PreviewReview,
} from './preview-workflows.js';
import { PreviewBoundary } from './components.js';

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
    fixtureVersion: 'web-scenarios-v1',
    kind: 'fixture',
    scenarioId: 'W14',
    value: 'SIMULATED SCENARIO',
  },
  receiptVersion: '1.0',
  remoteStateChanged: false,
  requestedAction: 'admin.review',
  reviewedAt: NOW,
  reviewedInputs: ['target-reviewed'] as [string, ...string[]],
} as const;

const adminInput = (overrides: Partial<PreviewWorkflowInput> = {}): PreviewWorkflowInput => ({
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

const elementProps = (element: ReactElement): Readonly<Record<string, unknown>> =>
  element.props as Readonly<Record<string, unknown>>;

const elements = (node: ReactNode): readonly ReactElement[] => {
  const found: ReactElement[] = [];
  const visit = (candidate: ReactNode) => {
    if (!isValidElement(candidate)) {
      return;
    }
    found.push(candidate);
    Children.forEach(elementProps(candidate)['children'] as ReactNode, visit);
  };
  visit(node);
  return found;
};

const intrinsic = (node: ReactNode, tag: string): readonly ReactElement[] =>
  elements(node).filter((element) => element.type === tag);

const contextForAccessibility = () => {
  const actor = createActor(machineWith({ execute: vi.fn<FutureAuthorityPort['execute']>() }), {
    input: adminInput(),
  }).start();
  return actor.getSnapshot().context;
};

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
    expect(Object.values(PREVIEW_ACTION_POLICIES).map((policy) => policy.authority)).toEqual(
      PREVIEW_ACTION_FAMILIES.map(() => 'Phase 4'),
    );
    expect(
      Object.values(PREVIEW_ACTION_POLICIES).every(
        (policy) => policy.confirmation.kind !== 'ambiguous',
      ),
    ).toBe(true);
    expect(Object.keys(PREVIEW_WORKFLOW_TRANSITIONS).sort()).toEqual(
      [...PREVIEW_WORKFLOW_STATES].sort(),
    );
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
    const execution = execute.mock.calls[0]?.[0];
    expect(execution?.disposition).toBe('confirm');
    expect(execution?.reviewedInputs).toEqual(['target-reviewed']);
    expect(execution?.signal).toBeInstanceOf(AbortSignal);
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
    ] as const satisfies readonly (readonly [PreviewWorkflowEvent, string])[];

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

  it('rejects malformed or authority-like terminal results into retryable failure', async () => {
    const execute = vi.fn<FutureAuthorityPort['execute']>().mockResolvedValue({
      kind: 'no-change',
      receipt: {
        ...completeReceipt,
        remoteStateChanged: true,
      },
    } as never);
    const actor = createActor(machineWith({ execute }), {
      input: adminInput(),
    }).start();

    sendToConfirmation(actor);
    actor.send({ confirmation: 'Review admin action', type: 'CONFIRM' });
    await vi.waitFor(() => {
      expect(actor.getSnapshot().value).toBe('partial-failure');
    });

    expect(actor.getSnapshot().context.receipt).toBeNull();
    expect(actor.getSnapshot().context.failureCode).toBe('INVALID_COMMAND');
  });
});

describe('preview workflow accessibility', () => {
  it('renders a captioned review diff with purpose, impact, role, and scoped consent', () => {
    const review = PreviewReview({
      context: contextForAccessibility(),
      locale: 'en',
    });

    expect(intrinsic(review, 'table')).toHaveLength(1);
    expect(intrinsic(review, 'caption')).toHaveLength(1);
    expect(
      intrinsic(review, 'th').every(
        (heading) =>
          elementProps(heading)['scope'] === 'col' || elementProps(heading)['scope'] === 'row',
      ),
    ).toBe(true);
    expect(JSON.stringify(review)).toContain('Requesting actor');
    expect(JSON.stringify(review)).toContain('Immutable no-change event preview');
  });

  it('repeats the preview boundary and exposes an object-specific proportional confirmation', () => {
    const confirmation = PreviewConfirmation({
      confirmationValue: '',
      context: contextForAccessibility(),
      locale: 'en',
      onCancel: vi.fn(),
      onChangeConfirmation: vi.fn(),
      onConfirm: vi.fn(),
    });
    const tree = elements(confirmation);
    const buttons = tree.filter((element) => element.type === LbButton);

    expect(tree.some((element) => element.type === PreviewBoundary)).toBe(true);
    expect(buttons).toHaveLength(2);
    expect(
      buttons.some((button) => elementProps(button)['children'] === 'Review admin action'),
    ).toBe(true);
    expect(intrinsic(confirmation, 'h2')[0]?.props).toMatchObject({ tabIndex: -1 });
  });

  it('links every validation error to its labeled field without color-only status', () => {
    const summary = PreviewErrorSummary({
      actionId: 'admin.review',
      errors: [
        { field: 'target', messageId: 'preview.validation.required' },
        { field: 'consent', messageId: 'preview.validation.consent-required' },
      ],
      locale: 'en',
    });
    const links = intrinsic(summary, 'a');

    expect(elementProps(summary)['role']).toBe('alert');
    expect(elementProps(summary)['tabIndex']).toBe(-1);
    expect(links.map((link) => elementProps(link)['href'])).toEqual([
      '#preview-admin-review-target',
      '#preview-admin-review-consent',
    ]);
  });

  it('announces safety failures assertively and preserves named safe work', () => {
    const context = contextForAccessibility();
    const failure = PreviewFailure({
      context,
      locale: 'en',
      onCancel: vi.fn(),
      onRecover: vi.fn(),
      projection: {
        canCancel: true,
        canConfirm: false,
        canRetry: true,
        isBlocking: true,
        state: 'offline',
        validationErrors: [],
      },
    });

    expect(elementProps(failure)).toMatchObject({
      'aria-live': 'assertive',
      role: 'alert',
    });
    expect(JSON.stringify(failure)).toContain('target');
    expect(elements(failure).filter((element) => element.type === LbButton)).toHaveLength(2);
  });

  it.each([
    ['en', 'Preview complete — no change was made'],
    ['pt-BR', 'Prévia concluída — nenhuma alteração foi feita'],
  ] as const)(
    'renders a polite immutable no-change receipt in %s with Phase 4 named',
    (locale, heading) => {
      const receipt = PreviewReceipt({
        actionLabel: 'redacted support case',
        locale,
        output: {
          kind: 'no-change',
          receipt: completeReceipt,
          remoteStateChanged: false,
        },
      });
      const serialized = JSON.stringify(receipt);
      const ledger = intrinsic(receipt, 'ol')[0];

      expect(elementProps(receipt)).toMatchObject({
        'aria-live': 'polite',
        'data-remote-state-changed': 'false',
        tabIndex: -1,
      });
      expect(ledger).toBeDefined();
      if (ledger === undefined) {
        throw new Error('No-change receipt must render an immutable ledger');
      }
      expect(elementProps(ledger)['data-immutable']).toBe('true');
      expect(serialized).toContain(heading);
      expect(serialized).toContain('Phase 4');
      expect(serialized).not.toMatch(/\b(?:submitted|success|mutated)\b/iu);
    },
  );

  it('renders cancellation as a Phase 4 no-change terminal state', () => {
    const context = contextForAccessibility();
    const receipt = PreviewReceipt({
      actionLabel: context.action.objectLabel,
      locale: 'en',
      output: {
        kind: 'cancelled',
        receipt: {
          authority: completeReceipt.authority,
          correlationId: CORRELATION_ID,
          nextPhase: 'Phase 4',
          reason: 'user-cancelled',
          receiptKind: 'cancelled',
          remoteStateChanged: false,
          requestedAction: context.action.id,
          reviewedAt: NOW,
          reviewedInputs: ['target-reviewed'],
        },
        remoteStateChanged: false,
      },
    });
    const serialized = JSON.stringify(receipt);

    expect(serialized).toContain('Preview cancelled — no change was made');
    expect(serialized).toContain('Phase 4');
    expect(elementProps(receipt)['data-remote-state-changed']).toBe('false');
    expect(serialized).not.toMatch(/\b(?:submitted|success|mutated)\b/iu);
  });

  it('uses the accessible design-system text field for typed confirmation', () => {
    const privacyContext = {
      ...contextForAccessibility(),
      action: {
        family: 'privacy',
        id: 'privacy.delete',
        objectLabel: 'privacy request',
        surface: 'account',
      },
      confirmation: PREVIEW_ACTION_POLICIES.privacy.confirmation,
    } as const;
    const confirmation = PreviewConfirmation({
      confirmationValue: '',
      context: privacyContext,
      locale: 'pt-BR',
      onCancel: vi.fn(),
      onChangeConfirmation: vi.fn(),
      onConfirm: vi.fn(),
    });

    expect(elements(confirmation).some((element) => element.type === LbTextField)).toBe(true);
    expect(JSON.stringify(confirmation)).toContain('ENVIAR SOLICITAÇÃO DE PRIVACIDADE');
  });
});
