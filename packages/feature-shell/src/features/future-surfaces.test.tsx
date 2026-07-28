/// <reference lib="dom" />

import type { ReactNode } from 'react';

// @ts-expect-error The approved runtime includes react-dom, but @types/react-dom is not an approved identity.
import { renderToStaticMarkup as reactRenderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  ACCOUNT_STATES,
  ENTITLEMENT_STATES,
  SUPPORT_STATES,
  UPDATE_STATES,
  AccountSurface,
  DocumentationSurface,
  EntitlementSurface,
  SettingsSurface,
  SupportPackagePreview,
  UpdateSurface,
  pseudoLocalizeFutureCopy,
} from './account-settings.js';
import { ASSISTANT_VIEWS, AssistantSurface } from './assistant.js';
import {
  PREVIEW_RISK_LEVELS,
  PREVIEW_WORKFLOW_STATES,
  PreviewWorkflowSurface,
  advancePreviewWorkflow,
  createPreviewWorkflowReceipt,
  type PreviewWorkflowState,
} from './preview-workflows.js';
import { RECOVER_VIEWS, RecoverSurface } from './recover.js';

const renderToStaticMarkup = reactRenderToStaticMarkup as (node: ReactNode) => string;

const accessibilityAudit = (markup: string): readonly string[] => {
  const findings: string[] = [];
  const ids = [...markup.matchAll(/\sid="([^"]+)"/gu)].map((match) => match[1]);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicateIds.length > 0) findings.push(`duplicate ids: ${duplicateIds.join(', ')}`);
  for (const match of markup.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/gu)) {
    const attributes = match[1] ?? '';
    const text = (match[2] ?? '').replace(/<[^>]+>/gu, '').trim();
    if (!attributes.includes('aria-label=') && text.length === 0) {
      findings.push('button has no accessible name');
    }
  }
  for (const match of markup.matchAll(/aria-(?:controls|labelledby)="([^"]+)"/gu)) {
    for (const reference of (match[1] ?? '').split(/\s+/u)) {
      if (reference.length > 0 && !ids.includes(reference)) {
        findings.push(`ARIA reference missing: ${reference}`);
      }
    }
  }
  if (markup.includes('tabindex="1"')) findings.push('positive tabindex');
  if (markup.includes('undefined') || markup.includes('null</')) {
    findings.push('unresolved runtime value');
  }
  return findings;
};

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

    let state: PreviewWorkflowState = expectedPath[0];
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
    expect(advancePreviewWorkflow('validating', 'FAIL')).toBe('partial-failure');
    expect(advancePreviewWorkflow('partial-failure', 'DIAGNOSE')).toBe('dependency-diagnostic');
    expect(advancePreviewWorkflow('dependency-diagnostic', 'RECOVER')).toBe('guided-recovery');
    expect(advancePreviewWorkflow('ready', 'RESTART')).toBe('restart-pending');
    expect(advancePreviewWorkflow('restart-pending', 'CONTINUE')).toBe('restart-continuation');
    expect(PREVIEW_WORKFLOW_STATES).toEqual(
      expect.arrayContaining([...expectedPath, 'paused', 'guided-recovery', 'verified']),
    );

    for (const workflowState of PREVIEW_WORKFLOW_STATES) {
      const markup = renderToStaticMarkup(
        <PreviewWorkflowSurface locale="en" scenarioId="S15" state={workflowState} />,
      );
      expect(markup).toContain(`data-preview-state="${workflowState}"`);
      expect(markup).toContain('no privileged authority connected');
    }
  });

  it('renders every risk gate and always terminates in an exact no-change receipt', () => {
    for (const riskLevel of PREVIEW_RISK_LEVELS) {
      const confirmationValue =
        riskLevel === 'extreme' ? 'EU ENTENDO QUE ESTA É APENAS UMA PRÉVIA' : undefined;
      const markup = renderToStaticMarkup(
        <PreviewWorkflowSurface
          locale="pt-BR"
          riskLevel={riskLevel}
          scenarioId="S15"
          state="preview-complete"
          {...(confirmationValue === undefined ? {} : { confirmationValue })}
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

describe('Assistant account settings support update future surfaces', () => {
  it('renders every Assistant state locally without Execute or remote success', () => {
    for (const locale of ['en', 'pt-BR'] as const) {
      for (const view of ASSISTANT_VIEWS) {
        const markup = renderToStaticMarkup(
          <AssistantSurface locale={locale} scenarioId="S19" view={view} />,
        );
        expect(markup).toContain(`data-assistant-view="${view}"`);
        expect(markup).toContain('S19');
        expect(markup).not.toMatch(/>Execute<|>Executar</u);
        expect(markup).not.toContain('remote success');
        expect(accessibilityAudit(markup)).toEqual([]);
      }
    }
  });

  it('covers account and entitlement fixtures while preserving recovery after expiry', () => {
    for (const state of ACCOUNT_STATES) {
      const markup = renderToStaticMarkup(
        <AccountSurface locale="en" scenarioId="S12" state={state} />,
      );
      expect(markup).toContain(`data-account-state="${state}"`);
      expect(markup).toContain('system browser');
      expect(accessibilityAudit(markup)).toEqual([]);
    }

    for (const state of ENTITLEMENT_STATES) {
      const markup = renderToStaticMarkup(
        <EntitlementSurface locale="en" scenarioId="S13" state={state} />,
      );
      expect(markup).toContain(`data-entitlement-state="${state}"`);
      expect(markup).toContain('DEMO-PC-S12');
    }

    const expired = renderToStaticMarkup(
      <EntitlementSurface locale="en" scenarioId="S13" state="expired" />,
    );
    expect(expired).toContain('Premium actions blocked');
    expect(expired).toContain('History, warnings, diagnostics, and recovery remain available');
    expect(expired).toContain('No remote success occurred');
  });

  it('keeps telemetry, cloud AI, and diagnostic sharing independent and off by default', () => {
    const markup = renderToStaticMarkup(<SettingsSurface locale="en" scenarioId="S24" />);
    expect(markup).toContain('data-telemetry="false"');
    expect(markup).toContain('data-cloud-ai="false"');
    expect(markup).toContain('data-diagnostic-sharing="false"');
    expect(markup).toContain('data-interface-scales="100,112.5,125,150"');
    expect(markup).toContain('data-forced-colors-ready="true"');
    expect(markup).toContain('data-reduced-motion-ready="true"');
    expect(markup).toContain('Connected telemetry');
    expect(markup).toContain('Cloud AI');
    expect(markup).toContain('Diagnostic sharing');
    expect(accessibilityAudit(markup)).toEqual([]);
  });

  it('covers support redaction, consent, encryption, upload boundary, and expiry', () => {
    for (const state of SUPPORT_STATES) {
      const markup = renderToStaticMarkup(
        <SupportPackagePreview locale="en" scenarioId="S20" state={state} />,
      );
      expect(markup).toContain(`data-support-state="${state}"`);
      expect(markup).toContain('[REDACTED]');
      expect(markup).toContain('S20-SYNTHETIC-DIAGNOSTIC');
      expect(markup).not.toContain('upload succeeded');
      expect(accessibilityAudit(markup)).toEqual([]);
    }

    const boundary = renderToStaticMarkup(
      <SupportPackagePreview locale="en" scenarioId="S20" state="upload-boundary" />,
    );
    expect(boundary).toContain('No remote success occurred');
    expect(boundary).toContain('Phase 4');
  });

  it('blocks invalid update signatures and continues safely on the current version', () => {
    for (const state of UPDATE_STATES) {
      const markup = renderToStaticMarkup(
        <UpdateSurface locale="en" scenarioId="S21" state={state} />,
      );
      expect(markup).toContain(`data-update-state="${state}"`);
      expect(markup).toContain('Continue current version');
    }

    const failure = renderToStaticMarkup(
      <UpdateSurface locale="en" scenarioId="S21" state="signature-failure" />,
    );
    expect(failure).toContain('Invalid signature');
    expect(failure).toContain('S21-UPDATE-SIGNATURE-INVALID');
    expect(failure).toContain('aria-live="assertive"');
  });

  it('ships English, PT-BR, pseudo, contextual docs, focus, and keyboard semantics', () => {
    const english = renderToStaticMarkup(
      <DocumentationSurface documentId="safe-recovery" locale="en" scenarioId="S24" />,
    );
    const portuguese = renderToStaticMarkup(
      <DocumentationSurface documentId="safe-recovery" locale="pt-BR" scenarioId="S23" />,
    );
    const pseudo = pseudoLocalizeFutureCopy('Connected processing requires independent consent');

    expect(english).toContain('Local, contextual, versioned documentation');
    expect(portuguese).toContain('Documentação local, contextual e versionada');
    expect(pseudo).toMatch(/^［.+···］$/u);
    expect(pseudo.length).toBeGreaterThan(
      'Connected processing requires independent consent'.length,
    );
    expect(english).toContain('tabindex="-1"');
    expect(english).not.toContain('tabindex="1"');
    expect(accessibilityAudit(english)).toEqual([]);
    expect(accessibilityAudit(portuguese)).toEqual([]);
  });
});

describe('future surfaces boundary receipt accessibility', () => {
  it('labels partial failure and recovery with live, non-color-only meaning', () => {
    const partialFailure = renderToStaticMarkup(
      <PreviewWorkflowSurface locale="en" scenarioId="S15" state="partial-failure" />,
    );
    const recovery = renderToStaticMarkup(
      <RecoverSurface locale="en" scenarioId="S17" view="guided-recovery" />,
    );

    expect(partialFailure).toContain('role="alert"');
    expect(partialFailure).toContain('aria-live="assertive"');
    expect(partialFailure).toContain('S15-RECOVERY-SOURCE-UNAVAILABLE');
    expect(recovery).toContain('Guided recovery');
    expect(recovery).toContain('data-pattern=');
    expect(accessibilityAudit(partialFailure)).toEqual([]);
    expect(accessibilityAudit(recovery)).toEqual([]);
  });

  it('gives every abbreviated remote or privileged control an actionable phase boundary', () => {
    const surfaces = [
      renderToStaticMarkup(<AssistantSurface locale="en" scenarioId="S19" view="cloud-denied" />),
      renderToStaticMarkup(
        <EntitlementSurface locale="en" scenarioId="S13" state="device-cooldown" />,
      ),
      renderToStaticMarkup(
        <SupportPackagePreview locale="en" scenarioId="S20" state="upload-boundary" />,
      ),
      renderToStaticMarkup(<RecoverSurface locale="en" scenarioId="S17" view="emergency" />),
    ];

    for (const markup of surfaces) {
      expect(markup).toContain('data-boundary-kind="phase-boundary"');
      expect(markup).toMatch(/Phase (4|6|9)/u);
      expect(markup).toMatch(/demonstration|Demonstration/u);
      expect(markup).toMatch(/documentation|Documentation/u);
    }
  });
});
