/// <reference lib="dom" />

import type { ReactNode } from 'react';

// @ts-expect-error The approved runtime includes react-dom, but @types/react-dom is not an approved identity.
import { renderToStaticMarkup as reactRenderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  PREVIEW_RISK_LEVELS,
  PREVIEW_WORKFLOW_STATES,
  PreviewWorkflowSurface,
  advancePreviewWorkflow,
  createPreviewWorkflowReceipt,
} from './preview-workflows.js';
import { RECOVER_VIEWS, RecoverSurface } from './recover.js';

const renderToStaticMarkup = reactRenderToStaticMarkup as (node: ReactNode) => string;

describe('preview recovery restart future surfaces', () => {
  it('reaches the complete review, confirmation, preview, failure, recovery, and receipt path', () => {
    const expectedPath = [
      'review',
      'validating',
      'ready',
      'confirming',
      'previewing',
      'verifying',
      'preview-complete',
    ] as const;

    let state = expectedPath[0];
    for (const event of [
      'VALIDATE',
      'VALID',
      'REVIEW_CONFIRMATION',
      'CONFIRM',
      'PREVIEW',
      'VERIFIED',
    ] as const) {
      state = advancePreviewWorkflow(state, event);
    }
    expect(state).toBe('preview-complete');

    expect(advancePreviewWorkflow('previewing', 'PAUSE')).toBe('paused');
    expect(advancePreviewWorkflow('paused', 'RECOVER')).toBe('guided-recovery');
    expect(advancePreviewWorkflow('guided-recovery', 'VERIFIED')).toBe('verified');
    expect(PREVIEW_WORKFLOW_STATES).toEqual(
      expect.arrayContaining([...expectedPath, 'paused', 'guided-recovery', 'verified']),
    );
  });

  it('renders every risk gate and always terminates in an exact no-change receipt', () => {
    for (const riskLevel of PREVIEW_RISK_LEVELS) {
      const confirmationValue =
        riskLevel === 'extreme' ? 'EU ENTENDO QUE ESTA É APENAS UMA PRÉVIA' : undefined;
      const markup = renderToStaticMarkup(
        <PreviewWorkflowSurface
          confirmationValue={confirmationValue}
          locale="pt-BR"
          riskLevel={riskLevel}
          scenarioId="S15"
          state="preview-complete"
        />,
      );

      expect(markup).toContain(`data-risk-level="${riskLevel}"`);
      expect(markup).toContain('nenhuma alteração foi feita neste PC');
      expect(markup).toContain('data-changed="false"');
      expect(markup).toContain('S15-PREVIEW-NO-CHANGE');
    }
  });

  it('creates an auditable no-change receipt and Activity event from one policy source', () => {
    const result = createPreviewWorkflowReceipt({
      createdAt: '2030-01-15T18:00:00.000Z',
      locale: 'en',
      requestedOperations: ['Review balanced power policy', 'Review adapter latency policy'],
      scenarioId: 'S15',
    });

    expect(result.receipt.changed).toBe(false);
    expect(result.receipt.requestedOperations).toEqual([
      'Review balanced power policy',
      'Review adapter latency policy',
    ]);
    expect(result.activity.correlationId).toBe('S15-PREVIEW-NO-CHANGE');
    expect(result.activity.scenarioMarked).toBe(true);
    expect(result.activity.state).toBe('completed');
  });

  it('covers the recovery ledger, snapshots, restore point, interrupted plan, emergency, and verified receipt', () => {
    expect(RECOVER_VIEWS).toEqual(
      expect.arrayContaining([
        'overview',
        'ledger',
        'snapshots',
        'restore-point',
        'interrupted-plan',
        'emergency',
        'guided-recovery',
        'verified-receipt',
      ]),
    );

    for (const view of RECOVER_VIEWS) {
      const markup = renderToStaticMarkup(
        <RecoverSurface locale="en" scenarioId="S17" view={view} />,
      );

      expect(markup).toContain(`data-recover-view="${view}"`);
      expect(markup).toContain('DEMO · S17');
      expect(markup).not.toContain('data-authority="privileged"');
    }
  });
});
