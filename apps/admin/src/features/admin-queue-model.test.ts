import type { AdminJobProjectionJson } from '@liiiraa/contracts-ts';
import { describe, expect, it } from 'vitest';

import {
  createQueueHref,
  deriveQueueAuthorityState,
  parseQueueUrlState,
  projectQueueJob,
  reconcileQueueConflict,
  validateSavedViewWrite,
  type QueueSavedView,
} from './admin-queue-model';

describe('admin Queue Canvas model', () => {
  it('round-trips only bounded non-sensitive URL state', () => {
    const parsed = parseQueueUrlState(
      new URLSearchParams({
        cursor: 'cursor_018',
        density: 'compact',
        diagnostic: 'private-diagnostic',
        draft: 'must-not-leak',
        filter: 'status:open,severity:critical,owner:mine',
        page: '3',
        q: 'receipt 2048',
        reason: 'private reason',
        selected: 'job_019',
        sort: 'deadline:asc',
        tab: 'jobs',
        token: 'secret',
        view: 'view_personal_01',
      }),
    );

    expect(parsed).toEqual({
      cursor: 'cursor_018',
      density: 'compact',
      filters: ['status:open', 'severity:critical', 'owner:mine'],
      page: 3,
      query: 'receipt 2048',
      selectedId: 'job_019',
      sort: { direction: 'asc', field: 'deadline' },
      tab: 'jobs',
      viewId: 'view_personal_01',
    });

    const href = createQueueHref('/pt-BR/admin/operation', parsed);
    expect(parseQueueUrlState(new URL(href, 'https://admin.test').searchParams)).toEqual(parsed);
    expect(href).not.toMatch(/diagnostic|draft|email|reason|role|secret|token/iu);
  });

  it('falls back safely for malformed, oversized, or personal URL values', () => {
    const parsed = parseQueueUrlState(
      new URLSearchParams({
        cursor: 'contains@email.test',
        density: 'tiny',
        filter: 'email:user@example.com,reason:because,status:open',
        page: '-80',
        q: 'x'.repeat(161),
        selected: '../record',
        sort: 'unknown:sideways',
        tab: '<script>',
        view: 'secret bearer',
      }),
    );

    expect(parsed).toEqual({
      density: 'comfortable',
      filters: ['status:open'],
      page: 1,
      query: '',
      sort: { direction: 'desc', field: 'updated' },
      tab: 'queue',
    });
  });

  it('keeps official views immutable and personal views owner/version-bound', () => {
    const official: QueueSavedView = {
      aggregateVersion: '7',
      ownerReference: undefined,
      savedViewId: 'view_official_risk',
      visibility: 'official',
    };
    const personal: QueueSavedView = {
      aggregateVersion: '3',
      ownerReference: 'admin_mateus',
      savedViewId: 'view_personal_01',
      visibility: 'personal',
    };

    expect(
      validateSavedViewWrite({ actorReference: 'admin_mateus', expectedVersion: '7', view: official }),
    ).toEqual({ allowed: false, reason: 'official-read-only' });
    expect(
      validateSavedViewWrite({ actorReference: 'admin_other', expectedVersion: '3', view: personal }),
    ).toEqual({ allowed: false, reason: 'owner-mismatch' });
    expect(
      validateSavedViewWrite({ actorReference: 'admin_mateus', expectedVersion: '2', view: personal }),
    ).toEqual({ allowed: false, reason: 'version-conflict' });
    expect(
      validateSavedViewWrite({ actorReference: 'admin_mateus', expectedVersion: '3', view: personal }),
    ).toEqual({ allowed: true, expectedVersion: '3' });
  });

  it('marks invalidated and reconnecting reads stale while failing uncertain mutations closed', () => {
    expect(deriveQueueAuthorityState({ freshness: 'live', invalidated: false })).toEqual({
      canMutate: true,
      requiresRefetch: false,
      state: 'live',
    });
    expect(deriveQueueAuthorityState({ freshness: 'live', invalidated: true })).toEqual({
      canMutate: false,
      requiresRefetch: true,
      state: 'stale',
    });
    expect(deriveQueueAuthorityState({ freshness: 'reconnecting', invalidated: false })).toEqual({
      canMutate: false,
      requiresRefetch: true,
      state: 'reconnecting',
    });
    expect(deriveQueueAuthorityState({ freshness: 'degraded', invalidated: false })).toEqual({
      canMutate: false,
      requiresRefetch: true,
      state: 'degraded',
    });
  });

  it('merges independent edits but preserves incompatible drafts for deliberate review', () => {
    const base = { owner: 'admin_a', priority: 'normal', state: 'open' };
    const independent = reconcileQueueConflict({
      base,
      current: { owner: 'admin_a', priority: 'high', state: 'open' },
      draft: { owner: 'admin_b', priority: 'normal', state: 'open' },
    });
    expect(independent).toEqual({
      merged: { owner: 'admin_b', priority: 'high', state: 'open' },
      status: 'merged',
    });

    const incompatible = reconcileQueueConflict({
      base,
      current: { owner: 'admin_c', priority: 'normal', state: 'open' },
      draft: { owner: 'admin_b', priority: 'normal', state: 'open' },
    });
    expect(incompatible).toEqual({
      before: base,
      conflictingFields: ['owner'],
      current: { owner: 'admin_c', priority: 'normal', state: 'open' },
      draft: { owner: 'admin_b', priority: 'normal', state: 'open' },
      status: 'review',
    });
  });

  it('projects truthful durable job progress, partial failure, and final receipts', () => {
    const job: AdminJobProjectionJson = {
      aggregateVersion: '11',
      completedAt: '2026-08-07T06:20:00.000Z',
      completedItems: 18,
      correlationId: 'corr-job-01',
      environment: { environmentId: 'staging', kind: 'staging', label: 'Staging' },
      etag: 'etag-job-11',
      failedItems: 2,
      freshness: {
        observedAt: '2026-08-07T06:20:00.000Z',
        sequence: '18',
        source: 'admin-jobs',
        state: 'live',
      },
      jobId: 'job_export_01',
      jobType: 'export',
      kind: 'admin-job-projection',
      ownerReference: 'admin_mateus',
      progressPercent: 100,
      provenance: { kind: 'observed', source: 'admin-jobs' },
      receiptReference: 'receipt_export_01',
      schemaVersion: '1.0',
      state: 'partial',
      totalItems: 20,
    };

    expect(projectQueueJob(job)).toEqual({
      aggregateVersion: '11',
      completedItems: 18,
      failedItems: 2,
      jobId: 'job_export_01',
      ownerReference: 'admin_mateus',
      progressPercent: 100,
      receiptReference: 'receipt_export_01',
      state: 'partial',
      totalItems: 20,
    });
  });
});
