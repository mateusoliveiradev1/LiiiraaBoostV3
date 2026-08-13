/// <reference lib="dom" />

import type { ReactNode } from 'react';
// @ts-expect-error The approved runtime includes react-dom, but @types/react-dom is not an approved identity.
import { renderToStaticMarkup as reactRenderToStaticMarkup } from 'react-dom/server';
// @ts-expect-error Vitest executes on Node, while this browser-facing package intentionally excludes Node types.
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

import {
  ExecutionTimeline,
  PlanRevisionSummary,
  RecoveryTargetList,
  StateTripletDiff,
  VerifiedReceiptDetails,
} from './index.ts';

const renderToStaticMarkup = reactRenderToStaticMarkup as (node: ReactNode) => string;
const componentStyles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

describe('transactional design-system components', () => {
  it('summarizes immutable plan identity before exact values and never offers Extreme execution', () => {
    const markup = renderToStaticMarkup(
      <PlanRevisionSummary
        action={<button type="button">Apply extreme plan</button>}
        approvalValid={false}
        evidenceFingerprint="sha256:evidence-2048"
        evidenceState="stale"
        extremeExplanation="Extreme operations are visible for explanation only."
        highestRisk="extreme"
        operationCount={7}
        recoveryReady={false}
        revisionId="revision-06-17-a"
      />,
    );

    expect(markup).toContain('Plan revision');
    expect(markup.indexOf('Revision ID')).toBeLessThan(markup.indexOf('revision-06-17-a'));
    expect(markup.indexOf('Evidence fingerprint')).toBeLessThan(
      markup.indexOf('sha256:evidence-2048'),
    );
    expect(markup).toContain('Extreme operations are visible for explanation only.');
    expect(markup).toContain('data-pattern="double"');
    expect(markup).toContain('data-icon-library="phosphor"');
    expect(markup).toContain('tabindex="-1"');
    expect(markup).not.toContain('<button');
    expect(markup).not.toMatch(/apply|confirm/iu);
  });

  it('renders a chronological timeline with exactly one current step and no percentage theater', () => {
    const markup = renderToStaticMarkup(
      <ExecutionTimeline
        currentStageId="observe"
        stages={[
          {
            id: 'prepare',
            label: 'Preparing recovery',
            state: 'complete',
            timestamp: '2030-01-15T18:00:00.000Z',
          },
          { id: 'observe', label: 'Checking the actual Windows state', state: 'current' },
          { id: 'verify', label: 'Verifying result', state: 'pending' },
        ]}
      />,
    );

    expect(markup).toContain('<ol');
    expect(markup.match(/aria-current="step"/gu)).toHaveLength(1);
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain('Completed');
    expect(markup).toContain('Current');
    expect(markup).toContain('Pending');
    expect(markup.indexOf('Timestamp')).toBeLessThan(markup.indexOf('2030-01-15T18:00:00.000Z'));
    expect(markup).not.toContain('%');
  });

  it('keeps operation, full-plan, and checkpoint recovery as separate named controls', () => {
    const markup = renderToStaticMarkup(
      <RecoveryTargetList
        checkpoint={{
          detail: 'Restore the protected Windows checkpoint.',
          id: 'checkpoint-9',
          label: 'Checkpoint before network changes',
          onRestore: vi.fn(),
          protectedState: 'Restore point 90210',
        }}
        operation={{
          detail: 'Restore only the selected operation.',
          id: 'operation-power-1',
          label: 'Balanced power scheme',
          onRestore: vi.fn(),
          protectedState: 'Balanced',
        }}
        plan={{
          blockedReason: 'Observe Windows before restoring the complete plan.',
          detail: 'Restore every verified operation in this revision.',
          id: 'plan-17',
          label: 'Revision 17',
          onRestore: vi.fn(),
          protectedState: 'Seven protected prior values',
        }}
      />,
    );

    expect(markup).toContain('Restore this operation');
    expect(markup).toContain('Restore full plan');
    expect(markup).toContain('Restore checkpoint');
    expect(markup).toContain('aria-describedby="lb-recovery-plan-plan-17-blocker"');
    expect(markup).toContain('Observe Windows before restoring the complete plan.');
    expect(markup.match(/<button/gu)).toHaveLength(3);
  });

  it('repeats all three exact state labels so meaning survives narrow reflow', () => {
    const markup = renderToStaticMarkup(
      <StateTripletDiff
        observed="External high-performance scheme"
        prior="Balanced"
        requestedApplied="Liiiraa competitive scheme"
        state="conflict"
      />,
    );

    for (const label of ['Prior', 'Requested / Applied', 'Observed']) {
      expect(markup).toContain(`<dt>${label}</dt>`);
    }
    expect(markup.indexOf('Prior')).toBeLessThan(markup.indexOf('Balanced'));
    expect(markup.indexOf('Requested / Applied')).toBeLessThan(
      markup.indexOf('Liiiraa competitive scheme'),
    );
    expect(markup.indexOf('Observed')).toBeLessThan(
      markup.indexOf('External high-performance scheme'),
    );
    expect(markup).toContain('data-pattern="double"');
    expect(markup).toContain('aria-live="assertive"');
    expect(markup).toContain('tabindex="-1"');
  });

  it('puts a verified human summary before immutable receipt disclosure and exact IDs', () => {
    const markup = renderToStaticMarkup(
      <VerifiedReceiptDetails
        details={{
          completedAt: '2030-01-15T18:01:00.000Z',
          diagnosticIdentity: 'diagnostic-redacted-4',
          journalCorrelation: 'journal-44',
          observedState: 'Balanced',
          operationVersion: 'power.scheme@2',
          priorState: 'High performance',
          recoveryMethod: 'Operation manifest rollback',
          requestedState: 'Balanced',
          startedAt: '2030-01-15T18:00:00.000Z',
          transactionId: 'transaction-17',
        }}
        receiptId="receipt-verified-17"
        summary="Windows now matches the reviewed plan."
        verification="Observed state equals the requested state."
      />,
    );

    expect(markup.indexOf('Windows now matches the reviewed plan.')).toBeLessThan(
      markup.indexOf('View technical details'),
    );
    expect(markup).toContain('<details');
    expect(markup).toContain('data-immutable="true"');
    expect(markup.indexOf('Receipt ID')).toBeLessThan(markup.indexOf('receipt-verified-17'));
    expect(markup.indexOf('Transaction ID')).toBeLessThan(markup.indexOf('transaction-17'));
    expect(markup).not.toContain('<input');
    expect(markup).not.toContain('<textarea');
  });

  it('localizes the primary transactional labels in PT-BR', () => {
    const timeline = renderToStaticMarkup(
      <ExecutionTimeline
        currentStageId="apply"
        locale="pt-BR"
        stages={[{ id: 'apply', label: 'Aplicando alteração', state: 'current' }]}
      />,
    );
    const diff = renderToStaticMarkup(
      <StateTripletDiff
        locale="pt-BR"
        observed="Equilibrado"
        prior="Alto desempenho"
        requestedApplied="Equilibrado"
        state="drift"
      />,
    );

    expect(timeline).toContain('Linha do tempo da execução');
    expect(timeline).toContain('Atual');
    expect(diff).toContain('Anterior');
    expect(diff).toContain('Solicitado / Aplicado');
    expect(diff).toContain('Observado');
  });

  it('uses only the admitted Cobalt token authority and exact typography roles', () => {
    for (const token of [
      '--lb-canvas-inset',
      '--lb-panel',
      '--lb-panel-raised',
      '--lb-accent-electric',
      '--lb-success',
      '--lb-warning',
      '--lb-critical',
      '--lb-font-body',
      '--lb-font-data',
      '--lb-product-label-size',
      '--lb-product-body-size',
      '--lb-product-task-heading-size',
    ]) {
      expect(componentStyles).toContain(`var(${token})`);
    }

    expect(componentStyles).not.toMatch(/#[\da-f]{3,8}/iu);
    expect(componentStyles).not.toMatch(/Saira|shadcn|dashboard|card/iu);
  });

  it('keeps exact target, row, motion, responsive, and non-color state contracts', () => {
    for (const token of [
      '--lb-control-min-size',
      '--lb-row-standard-size',
      '--lb-row-primary-size',
      '--lb-motion-hover-duration',
      '--lb-motion-control-duration',
      '--lb-motion-panel-duration',
      '--lb-motion-route-duration',
    ]) {
      expect(componentStyles).toContain(`var(${token})`);
    }

    expect(componentStyles).toContain("[data-pattern='dashed']");
    expect(componentStyles).toContain("[data-pattern='double']");
    expect(componentStyles).toContain('@media (width < 960px)');
    expect(componentStyles).toContain('@media (width < 640px)');
    expect(componentStyles).not.toMatch(/overflow-x:\s*(?:auto|scroll)/u);
    expect(componentStyles).not.toMatch(/block-size:\s*\d+px/u);
  });

  it('removes translation, glow opportunities, and delay under reduced motion', () => {
    expect(componentStyles).toContain("[data-motion='reduced'] .lb-execution-stage");
    expect(componentStyles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(componentStyles).toContain('transition-duration: 0ms');
    expect(componentStyles).toContain('transition-delay: 0ms');
    expect(componentStyles).toContain('transform: none');
    expect(componentStyles).not.toMatch(/animation(?:-name)?:/u);
    expect(componentStyles).not.toMatch(/glow/iu);
  });

  it('preserves text, icons, and border patterns in forced colors', () => {
    const forcedColors = componentStyles.slice(componentStyles.indexOf('@media (forced-colors'));

    expect(forcedColors).toContain('border-color: CanvasText');
    expect(forcedColors).toContain('color: CanvasText');
    expect(forcedColors).toContain('background: Canvas');
    expect(forcedColors).toContain('border-color: Highlight');
    expect(forcedColors).toContain('forced-color-adjust: auto');
  });
});
