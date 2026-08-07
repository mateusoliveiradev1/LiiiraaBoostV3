import { describe, expect, it } from 'vitest';

import {
  classifyInvitationActions,
  projectInvitationJob,
  projectInvitationRetention,
  projectInvitationTimeline,
  reconcileInvitationDraft,
  reviewInvitationBatch,
  reviewInvitationPreflight,
  reviewInvitationResend,
  reviewInvitationRevoke,
} from './admin-invitations-model';

const invitation = Object.freeze({
  aggregateVersion: '7',
  deliveryState: 'delivered' as const,
  expiresAt: '2026-08-21T10:00:00.000Z',
  invitationId: 'invitation_0001',
  lifecycleState: 'active' as const,
  recipientMasked: 'ma••••@example.com',
  reminderCount: 1,
});

describe('admin invitation presentation policy', () => {
  it('classifies single and CSV preflight rows without retaining raw recipients', () => {
    const single = reviewInvitationPreflight({
      capacity: { activeCount: 12, activeLimit: 25, queuedCount: 0 },
      mode: 'individual',
      rows: [{ classification: 'valid', recipient: 'single@example.com', rowId: 'single-1' }],
    });
    expect(single.counts).toMatchObject({ valid: 1, willActivate: 1, queued: 0 });
    expect(JSON.stringify(single)).not.toContain('single@example.com');

    const review = reviewInvitationPreflight({
      capacity: { activeCount: 23, activeLimit: 25, queuedCount: 4 },
      mode: 'csv',
      rows: [
        { classification: 'valid', recipient: 'alpha@example.com', rowId: '1' },
        { classification: 'valid', recipient: 'beta@example.com', rowId: '2' },
        { classification: 'valid', recipient: 'gamma@example.com', rowId: '3' },
        { classification: 'duplicate', recipient: 'alpha@example.com', rowId: '4' },
        { classification: 'active', recipient: 'active@example.com', rowId: '5' },
        { classification: 'invalid', recipient: 'broken-address', rowId: '6' },
        { classification: 'ineligible', recipient: 'blocked@example.com', rowId: '7' },
      ],
    });

    expect(review.counts).toEqual({
      active: 1,
      duplicate: 1,
      ineligible: 1,
      invalid: 1,
      queued: 1,
      skipped: 4,
      valid: 3,
      willActivate: 2,
    });
    expect(review.capacity).toEqual({ activeAfter: 25, activeLimit: 25, queuedAfter: 5 });
    expect(review.canIssue).toBe(true);
    expect(JSON.stringify(review)).not.toContain('alpha@example.com');
    expect(review.rows[0]?.recipientMasked).toMatch(/@example\.com$/u);
  });

  it('fails closed for unbounded, malformed, or server-inconsistent preflight authority', () => {
    expect(() =>
      reviewInvitationPreflight({
        capacity: { activeCount: 26, activeLimit: 25, queuedCount: 0 },
        mode: 'individual',
        rows: [{ classification: 'valid', recipient: 'a@example.com', rowId: '1' }],
      }),
    ).toThrow('INVITATION_CAPACITY_INVALID');
    expect(() =>
      reviewInvitationPreflight({
        capacity: { activeCount: 0, activeLimit: 25, queuedCount: 0 },
        mode: 'csv',
        rows: Array.from({ length: 101 }, (_, index) => ({
          classification: 'valid' as const,
          recipient: `person-${String(index)}@example.com`,
          rowId: String(index),
        })),
      }),
    ).toThrow('INVITATION_PREFLIGHT_BOUNDS_INVALID');
  });

  it('keeps beta and administrative-team invitation capabilities disjoint', () => {
    const activeActions = classifyInvitationActions({
      invitation,
      invitationKind: 'beta',
      now: '2026-08-07T10:00:00.000Z',
    });
    expect(activeActions).toMatchObject({
      canCorrectAddress: true,
      canRemind: true,
      canResend: true,
      canRevoke: true,
      recipientImmutable: true,
    });
    expect(
      classifyInvitationActions({
        invitation: {
          ...invitation,
          lifecycleState: 'accepted',
          reminderCount: 2,
        },
        invitationKind: 'beta',
        now: '2026-08-07T10:00:00.000Z',
      }),
    ).toMatchObject({ canRemind: false, canResend: false, canRevoke: false });
    expect(
      classifyInvitationActions({
        invitation,
        invitationKind: 'administrative-team',
        now: '2026-08-07T10:00:00.000Z',
      }),
    ).toEqual({ code: 'INVITATION_CAPABILITY_SEPARATE', admitted: false });
  });

  it('requires explicit resend expiry choice, rotates the secret, and preserves recipient identity', () => {
    expect(
      reviewInvitationResend({
        authority: 'live',
        expiryMode: 'preserve',
        invitation,
        reason: 'Delivery verification requested by the recipient.',
      }),
    ).toMatchObject({
      admitted: true,
      expiryDays: 14,
      expiryMode: 'preserve',
      recipientImmutable: true,
      secretRotated: true,
    });
    expect(
      reviewInvitationResend({
        authority: 'live',
        expiryMode: 'restart',
        invitation,
        reason: 'Address correction',
      }),
    ).toMatchObject({ admitted: true, expiryMode: 'restart', expiryDays: 14 });
    expect(
      reviewInvitationResend({
        authority: 'stale',
        expiryMode: 'restart',
        invitation,
        reason: 'Restart the requested invitation window.',
      }),
    ).toEqual({ admitted: false, code: 'AUTHORITATIVE_REFRESH_REQUIRED' });
  });

  it('models irreversible revoke and durable high-risk batch review without shortcuts', () => {
    expect(
      reviewInvitationRevoke({
        authority: 'live',
        invitation,
        reason: 'Recipient requested immediate revocation.',
      }),
    ).toMatchObject({
      admitted: true,
      accountUnaffected: true,
      irreversible: true,
      secretStopsImmediately: true,
    });
    expect(
      reviewInvitationBatch({
        action: 'revoke',
        approvalGranted: false,
        authority: 'live',
        impactReviewed: true,
        reason: 'Contain the affected private beta cohort.',
        risk: 'high',
        targetCount: 12,
      }),
    ).toEqual({ admitted: false, code: 'APPROVAL_REQUIRED' });
    expect(
      reviewInvitationBatch({
        action: 'revoke',
        approvalGranted: true,
        authority: 'live',
        impactReviewed: true,
        reason: 'Contain the affected private beta cohort.',
        risk: 'high',
        targetCount: 12,
      }),
    ).toMatchObject({
      admitted: true,
      durableJobRequired: true,
      finalReceiptRequired: true,
      partialFailureReportingRequired: true,
    });
  });

  it('masks timeline evidence and exposes retention or legal-hold authority explicitly', () => {
    expect(
      projectInvitationTimeline([
        {
          at: '2026-08-07T10:00:00.000Z',
          kind: 'delivery-failed',
          outcome: 'provider-ref-••••A19F',
          rawAddress: 'secret@example.com',
          token: 'never-render-me',
        },
      ]),
    ).toEqual([
      {
        at: '2026-08-07T10:00:00.000Z',
        kind: 'delivery-failed',
        outcome: 'provider-ref-••••A19F',
      },
    ]);
    expect(
      projectInvitationRetention({
        afterRetention: 'pseudonymize-personal-data',
        legalHoldUntil: '2026-09-01T00:00:00.000Z',
        lifecycleState: 'revoked',
        now: '2026-08-07T10:00:00.000Z',
        purposeRetentionUntil: '2026-08-01T00:00:00.000Z',
      }),
    ).toEqual({ action: 'retain', basis: 'legal-hold' });
  });

  it('merges independent edits but preserves incompatible drafts for conflict review', () => {
    expect(
      reconcileInvitationDraft({
        base: { expiryMode: 'preserve', reason: 'Original reason' },
        current: { expiryMode: 'restart', reason: 'Original reason' },
        draft: { expiryMode: 'preserve', reason: 'Operator clarification' },
        currentVersion: '8',
        expectedVersion: '7',
      }),
    ).toMatchObject({
      status: 'merged',
      merged: { expiryMode: 'restart', reason: 'Operator clarification' },
    });
    expect(
      reconcileInvitationDraft({
        base: { expiryMode: 'preserve', reason: 'Original reason' },
        current: { expiryMode: 'preserve', reason: 'Remote reason' },
        draft: { expiryMode: 'preserve', reason: 'Local reason' },
        currentVersion: '8',
        expectedVersion: '7',
      }),
    ).toMatchObject({ status: 'review', preservedDraft: { reason: 'Local reason' } });
  });

  it('keeps partial job subsets and final receipts explicit', () => {
    expect(
      projectInvitationJob({
        completedItems: 18,
        failedItems: 2,
        jobId: 'job_invitation_0001',
        progressPercent: 100,
        receiptReference: 'receipt_invitation_0001',
        state: 'partial',
        totalItems: 20,
      }),
    ).toEqual({
      completedItems: 18,
      failedItems: 2,
      jobId: 'job_invitation_0001',
      progressPercent: 100,
      receiptReference: 'receipt_invitation_0001',
      retryEligibleFailures: 2,
      state: 'partial',
      totalItems: 20,
    });
  });
});
