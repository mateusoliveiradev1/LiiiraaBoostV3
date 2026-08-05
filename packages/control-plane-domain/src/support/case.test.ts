import { describe, expect, it } from 'vitest';

import {
  ACCOUNT_DELETION_PENDING_MS,
  SUPPORT_ATTACHMENT_RETENTION_MS,
  SUPPORT_REOPEN_WINDOW_MS,
  decideConsentTransition,
  decideDeletionTransition,
  decideSupportCaseTransition,
  initialDeletionState,
  type DiagnosticConsentState,
} from './case.js';

const NOW = '2030-08-01T12:00:00.000Z';

describe('D-32/D-33 authoritative support cases', () => {
  it('creates a threaded case with plan-independent incident priority and bounded SLA', () => {
    const freeGeneral = decideSupportCaseTransition(null, {
      kind: 'create',
      accountId: 'account-player',
      caseId: 'case-general',
      plan: 'free',
      category: 'general',
      subjectRedacted: 'Startup regression',
      message: 'The application closes after launch.',
      messageId: 'message-general',
      now: NOW,
    });
    const freeSecurity = decideSupportCaseTransition(null, {
      kind: 'create',
      accountId: 'account-player',
      caseId: 'case-security',
      plan: 'free',
      category: 'security',
      subjectRedacted: 'Unexpected session',
      message: 'A session is not recognized.',
      messageId: 'message-security',
      now: NOW,
    });
    const premiumGeneral = decideSupportCaseTransition(null, {
      kind: 'create',
      accountId: 'account-premium',
      caseId: 'case-premium',
      plan: 'premium',
      category: 'general',
      subjectRedacted: 'Optimization question',
      message: 'A receipt needs clarification.',
      messageId: 'message-premium',
      now: NOW,
    });

    expect(freeGeneral).toMatchObject({
      accepted: true,
      state: {
        status: 'open',
        priority: 'normal',
        responseTargetBusinessHours: 72,
        history: [{ author: 'customer' }],
      },
    });
    expect(freeSecurity).toMatchObject({
      accepted: true,
      state: { priority: 'priority', responseTargetBusinessHours: 24 },
    });
    expect(premiumGeneral).toMatchObject({
      accepted: true,
      state: { priority: 'normal', responseTargetBusinessHours: 24 },
    });
    expect(freeGeneral.accepted && freeGeneral.state.expectedResponseAt).toBe(
      '2030-08-06T12:00:00.000Z',
    );
    expect(freeSecurity.accepted && freeSecurity.state.expectedResponseAt).toBe(
      '2030-08-02T12:00:00.000Z',
    );
  });

  it('closes with a <=30-day object purge and permits reopen for exactly 14 days', () => {
    const created = decideSupportCaseTransition(null, {
      kind: 'create',
      accountId: 'account-player',
      caseId: 'case-one',
      plan: 'free',
      category: 'restoration',
      subjectRedacted: 'Restore previous state',
      message: 'A rollback receipt needs review.',
      messageId: 'message-one',
      now: NOW,
    });
    expect(created.accepted).toBe(true);
    if (!created.accepted) return;
    const attached = decideSupportCaseTransition(created.state, {
      kind: 'attach-metadata',
      attachment: {
        attachmentId: 'attachment-one',
        checksumSha256: 'a'.repeat(64),
        fieldClass: 'recovery-journal-excerpt',
        objectKey: 'diagnostics/case-one/attachment-one',
        byteLength: 1_024,
      },
      now: NOW,
    });
    expect(attached.accepted).toBe(true);
    if (!attached.accepted) return;
    expect(JSON.stringify(attached.state.attachments)).not.toContain('content');
    const closedAt = '2030-08-02T12:00:00.000Z';
    const closed = decideSupportCaseTransition(attached.state, { kind: 'close', now: closedAt });
    expect(closed).toMatchObject({
      accepted: true,
      effects: [
        {
          kind: 'schedule-attachment-purge',
          availableAt: new Date(Date.parse(closedAt) + SUPPORT_ATTACHMENT_RETENTION_MS).toISOString(),
        },
      ],
    });
    if (!closed.accepted) return;

    const boundary = new Date(Date.parse(closedAt) + SUPPORT_REOPEN_WINDOW_MS).toISOString();
    expect(decideSupportCaseTransition(closed.state, { kind: 'reopen', now: boundary })).toMatchObject({
      accepted: true,
      outcome: 'reopened',
      effects: [{ kind: 'expire-case-consents' }],
    });
    expect(
      decideSupportCaseTransition(closed.state, {
        kind: 'reopen',
        now: new Date(Date.parse(boundary) + 1).toISOString(),
        relatedCaseId: 'case-related',
      }),
    ).toMatchObject({ accepted: true, outcome: 'related-case-created', state: { caseId: 'case-related' } });
  });
});

describe('D-34 through D-36 consent lifecycle', () => {
  it('binds consent to case, purpose, explicit fields and no more than 72 hours', () => {
    const grant = decideConsentTransition(null, {
      kind: 'grant',
      consentId: 'consent-one',
      accountId: 'account-player',
      caseId: 'case-one',
      purpose: 'investigate startup regression',
      fieldClasses: ['hardware-summary', 'application-log-redacted'],
      grantedAt: NOW,
      expiresAt: '2030-08-04T12:00:00.000Z',
    });
    expect(grant).toMatchObject({
      accepted: true,
      state: { status: 'active', version: 1n, caseId: 'case-one' },
    });
    expect(
      decideConsentTransition(null, {
        kind: 'grant',
        consentId: 'consent-too-long',
        accountId: 'account-player',
        caseId: 'case-one',
        purpose: 'investigate startup regression',
        fieldClasses: ['hardware-summary'],
        grantedAt: NOW,
        expiresAt: '2030-08-04T12:00:00.001Z',
      }),
    ).toEqual({ accepted: false, code: 'CONSENT_WINDOW_INVALID' });
  });

  it('revokes or expires once and emits immutable receipt plus active-stream notification effects', () => {
    const active: DiagnosticConsentState = {
      consentId: 'consent-one',
      accountId: 'account-player',
      caseId: 'case-one',
      purpose: 'investigate startup regression',
      fieldClasses: ['hardware-summary'],
      grantedAt: NOW,
      expiresAt: '2030-08-04T12:00:00.000Z',
      status: 'active',
      version: 1n,
    };
    expect(decideConsentTransition(active, { kind: 'revoke', now: '2030-08-02T12:00:00.000Z' })).toMatchObject({
      accepted: true,
      state: { status: 'revoked', version: 2n },
      effects: [{ kind: 'notify-active-streams' }, { kind: 'append-revocation-receipt' }],
    });
    expect(decideConsentTransition(active, { kind: 'expire', now: active.expiresAt })).toMatchObject({
      accepted: true,
      state: { status: 'expired', version: 2n },
      effects: [{ kind: 'notify-active-streams' }],
    });
  });
});

describe('D-48 through D-51 account deletion and retention', () => {
  it('requires strong auth and schedules a cancelable seven-day finalization', () => {
    const initial = initialDeletionState('account-player');
    expect(decideDeletionTransition(initial, { kind: 'request', strongAuthVerified: false, now: NOW })).toEqual({
      accepted: false,
      code: 'STRONG_AUTH_REQUIRED',
    });
    const requested = decideDeletionTransition(initial, {
      kind: 'request',
      strongAuthVerified: true,
      requestId: 'deletion-one',
      now: NOW,
    });
    expect(requested).toMatchObject({
      accepted: true,
      state: {
        status: 'pending',
        finalizeAt: new Date(Date.parse(NOW) + ACCOUNT_DELETION_PENDING_MS).toISOString(),
      },
      effects: [{ kind: 'schedule-account-finalization' }],
    });
    if (!requested.accepted) return;
    expect(decideDeletionTransition(requested.state, { kind: 'cancel', now: '2030-08-05T12:00:00.000Z' })).toMatchObject({
      accepted: true,
      state: { status: 'canceled' },
      effects: [{ kind: 'cancel-account-finalization' }],
    });
  });

  it('finalizes ordinary data and preserves only exact minimized bounded evidence', () => {
    const requested = decideDeletionTransition(initialDeletionState('account-player'), {
      kind: 'request',
      strongAuthVerified: true,
      requestId: 'deletion-one',
      now: NOW,
    });
    expect(requested.accepted).toBe(true);
    if (!requested.accepted) return;
    const result = decideDeletionTransition(requested.state, {
      kind: 'finalize',
      now: new Date(Date.parse(NOW) + ACCOUNT_DELETION_PENDING_MS).toISOString(),
      evidence: [
        { evidenceClass: 'billing-invoice-tax', sourceAt: '2030-01-02T00:00:00.000Z' },
        { evidenceClass: 'antifraud-dispute', sourceAt: '2030-02-03T00:00:00.000Z' },
        { evidenceClass: 'security-recovery', sourceAt: '2030-03-04T00:00:00.000Z' },
        { evidenceClass: 'administrative-audit', sourceAt: '2030-04-05T00:00:00.000Z' },
      ],
    });
    expect(result).toMatchObject({
      accepted: true,
      state: { status: 'partially-retained' },
      effects: [{ kind: 'erase-ordinary-account-data' }],
    });
    if (!result.accepted) return;
    expect(result.state.retentionRecords).toEqual([
      expect.objectContaining({ evidenceClass: 'billing-invoice-tax', retainUntil: '2035-01-02T00:00:00.000Z' }),
      expect.objectContaining({ evidenceClass: 'antifraud-dispute', retainUntil: '2035-02-03T00:00:00.000Z' }),
      expect.objectContaining({ evidenceClass: 'security-recovery', retainUntil: '2032-03-04T00:00:00.000Z' }),
      expect.objectContaining({ evidenceClass: 'administrative-audit', retainUntil: '2035-04-05T00:00:00.000Z' }),
    ]);
    expect(JSON.stringify(result.state.retentionRecords)).not.toMatch(/diagnostic|message|profile|session|token/iu);
  });
});
