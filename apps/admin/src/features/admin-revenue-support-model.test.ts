import { describe, expect, it } from 'vitest';

import {
  projectAdaptiveAbuseState,
  projectRevenueAuthority,
  projectSupportCaseAuthority,
  reconcileRevenueSupportDraft,
  reduceDiagnosticAuthority,
  reviewSensitiveExport,
} from './admin-revenue-support-model';

describe('admin revenue and support presentation policy', () => {
  it('preserves authoritative paid state while distinguishing provider degradation', () => {
    expect(
      projectRevenueAuthority({
        amountMinor: '9990',
        currency: 'BRL',
        observedAt: '2026-08-07T12:00:00.000Z',
        providerState: 'degraded',
        reconciliationState: 'pending',
        subscriptionState: 'paid',
      }),
    ).toEqual({
      amount: { currency: 'BRL', minor: '9990', state: 'known' },
      observedAt: '2026-08-07T12:00:00.000Z',
      paidState: 'paid',
      providerState: 'degraded',
      reconciliationState: 'pending',
    });
  });

  it('never fabricates zero money or paid state from missing authority', () => {
    expect(
      projectRevenueAuthority({
        observedAt: '2026-08-07T12:00:00.000Z',
        providerState: 'unknown',
        reconciliationState: 'unknown',
        subscriptionState: 'unknown',
      }),
    ).toMatchObject({ amount: { state: 'unknown' }, paidState: 'unknown' });
    expect(() =>
      projectRevenueAuthority({
        amountMinor: '-1',
        currency: 'BRL',
        observedAt: '2026-08-07T12:00:00.000Z',
        providerState: 'available',
        reconciliationState: 'reconciled',
        subscriptionState: 'paid',
      }),
    ).toThrow('REVENUE_AMOUNT_INVALID');
  });

  it('projects support ownership, SLA, consent authority, and allowlisted metadata only', () => {
    const projected = projectSupportCaseAuthority({
      caseId: 'case-0001',
      consent: {
        consentId: 'consent-0001',
        expiresAt: '2026-08-07T12:15:00.000Z',
        scopes: ['support-diagnostics'],
        state: 'active',
        version: '7',
      },
      deadlineAt: '2026-08-07T12:10:00.000Z',
      metadata: {
        deviceClass: 'desktop',
        diagnosticPayload: 'must-not-render',
        rawEmail: 'secret@example.test',
        releaseChannel: 'internal',
      },
      now: '2026-08-07T12:00:00.000Z',
      ownerReference: 'administrator-support-0001',
      state: 'waiting-support',
      substituteReference: 'administrator-support-0002',
      subjectRedacted: 'Falha apó aplicar perfil •••0042',
    });
    expect(projected).toMatchObject({
      caseId: 'case-0001',
      consent: { active: true, version: '7' },
      deadline: { overdue: false, remainingMinutes: 10 },
      ownerReference: 'administrator-support-0001',
      substituteReference: 'administrator-support-0002',
    });
    expect(projected.metadata).toEqual({ deviceClass: 'desktop', releaseChannel: 'internal' });
    expect(JSON.stringify(projected)).not.toContain('secret@example.test');
    expect(JSON.stringify(projected)).not.toContain('must-not-render');
  });

  it('clears diagnostic fields synchronously on revoke and rejects late cached projections', () => {
    const active = reduceDiagnosticAuthority(
      { fields: {}, state: 'empty' },
      {
        consentId: 'consent-0001',
        expiresAt: '2026-08-07T12:15:00.000Z',
        fields: { cpu: '7800X3D', sessionReference: 'session-•••0042' },
        now: '2026-08-07T12:00:00.000Z',
        type: 'projection',
        version: '7',
      },
    );
    const revoked = reduceDiagnosticAuthority(active, {
      auditReference: 'audit-consent-revoked-0001',
      consentId: 'consent-0001',
      type: 'revoke',
      version: '8',
    });
    expect(revoked).toEqual({
      abortRequired: true,
      auditReference: 'audit-consent-revoked-0001',
      consentId: 'consent-0001',
      fields: {},
      state: 'cleared',
      version: '8',
    });
    expect(
      reduceDiagnosticAuthority(revoked, {
        consentId: 'consent-0001',
        expiresAt: '2026-08-07T12:15:00.000Z',
        fields: { cpu: 'late-cache' },
        now: '2026-08-07T12:01:00.000Z',
        type: 'projection',
        version: '7',
      }),
    ).toBe(revoked);
  });

  it('expires consent at the exact boundary and leaves only immutable evidence', () => {
    expect(
      reduceDiagnosticAuthority(
        { fields: {}, state: 'empty' },
        {
          consentId: 'consent-0002',
          expiresAt: '2026-08-07T12:15:00.000Z',
          fields: { cpu: 'must-clear' },
          now: '2026-08-07T12:15:00.000Z',
          type: 'projection',
          version: '3',
        },
      ),
    ).toEqual({
      abortRequired: true,
      consentId: 'consent-0002',
      fields: {},
      state: 'cleared',
      version: '3',
    });
  });

  it('requires minimum masked export scope, purpose, approval, encryption, and short expiry', () => {
    const base = {
      approved: true,
      authority: 'live' as const,
      encrypted: true,
      expiresAt: '2026-08-07T12:15:00.000Z',
      masked: true,
      minimumFields: ['case-reference', 'event-time'],
      now: '2026-08-07T12:00:00.000Z',
      previewed: true,
      purpose: 'Investigate the consented support escalation.',
      requestedFields: ['case-reference', 'event-time'],
    };
    expect(reviewSensitiveExport(base)).toMatchObject({
      admitted: true,
      fields: ['case-reference', 'event-time'],
      shortLived: true,
    });
    expect(
      reviewSensitiveExport({ ...base, requestedFields: [...base.requestedFields, 'raw-email'] }),
    ).toEqual({ admitted: false, code: 'EXPORT_SCOPE_NOT_MINIMAL' });
    expect(reviewSensitiveExport({ ...base, authority: 'stale' })).toEqual({
      admitted: false,
      code: 'AUTHORITATIVE_REFRESH_REQUIRED',
    });
  });

  it('projects adaptive abuse response without revealing detection signals', () => {
    const state = projectAdaptiveAbuseState({
      blocked: true,
      rateLimited: true,
      retryAt: '2026-08-07T12:05:00.000Z',
      signals: ['velocity-email-domain', 'internal-rule-42'],
      stepUpRequired: true,
    });
    expect(state).toEqual({
      action: 'blocked',
      retryAt: '2026-08-07T12:05:00.000Z',
      safeCode: 'ADAPTIVE_CONTROL_ACTIVE',
      stepUpRequired: true,
    });
    expect(JSON.stringify(state)).not.toContain('internal-rule-42');
  });

  it('merges independent edits and preserves conflicting support drafts', () => {
    const base = { ownerReference: 'support-1', reason: 'Initial support review' };
    expect(
      reconcileRevenueSupportDraft({
        base,
        current: { ownerReference: 'support-2', reason: base.reason },
        currentVersion: '8',
        draft: { ownerReference: base.ownerReference, reason: 'Add consented diagnostic context' },
        expectedVersion: '7',
      }),
    ).toMatchObject({
      merged: { ownerReference: 'support-2', reason: 'Add consented diagnostic context' },
      status: 'merged',
    });
    expect(
      reconcileRevenueSupportDraft({
        base,
        current: { ...base, reason: 'Remote decision' },
        currentVersion: '8',
        draft: { ...base, reason: 'Local decision' },
        expectedVersion: '7',
      }),
    ).toMatchObject({ preservedDraft: { reason: 'Local decision' }, status: 'review' });
  });
});
