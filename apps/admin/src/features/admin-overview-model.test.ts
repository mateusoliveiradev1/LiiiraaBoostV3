import { describe, expect, it } from 'vitest';

import type { AdminAuthorityDocument } from '../admin-authority';
import { projectAdminBriefing, type AdminBriefingAuthorityState } from './admin-overview-model';

const metadata = Object.freeze({
  schemaVersion: '1.0',
  aggregateVersion: '7',
  etag: 'admin-etag-0007',
  correlationId: 'admin-correlation-0007',
  provenance: 'postgres-authority',
  environment: {
    environmentId: 'staging-brasil',
    kind: 'staging',
    label: 'Staging Brasil',
  },
  freshness: {
    state: 'live',
    source: 'admin-api',
    sequence: '42',
    observedAt: '2026-08-07T05:00:00.000Z',
  },
} as const);

const document = (value: Readonly<Record<string, unknown>>): AdminAuthorityDocument =>
  value as unknown as AdminAuthorityDocument;

const accessContext = document({
  ...metadata,
  kind: 'admin-access-context-projection',
  actorId: 'administrator-0001',
  activeFunction: 'operations',
  domains: ['overview', 'people', 'operation', 'system'],
  capabilities: ['queue.review', 'incident.review', 'job.review', 'invitation.delivery'],
  scopes: ['environment:staging'],
  authenticationStrength: 'passkey',
});

const inbox = (
  id: string,
  severity: 'information' | 'warning' | 'critical',
  deadlineAt: string,
  ownerReference = 'administrator-0001',
): AdminAuthorityDocument =>
  document({
    ...metadata,
    kind: 'admin-inbox-item-projection',
    inboxItemId: id,
    severity,
    state: 'open',
    title: `Priority ${id}`,
    ownerReference,
    relatedRecordReference: `record-${id}`,
    deadlineAt,
    updatedAt: '2026-08-07T05:00:00.000Z',
  });

const incident = document({
  ...metadata,
  kind: 'admin-incident-projection',
  incidentId: 'incident-0001',
  severity: 'critical',
  state: 'open',
  title: 'Invitation delivery degraded',
  ownerReference: 'administrator-0001',
  substituteReference: 'administrator-0002',
  affectedCapabilities: ['invitation.delivery'],
  impactReferences: ['provider:email'],
  nextUpdateAt: '2026-08-07T05:20:00.000Z',
});

const capacity = document({
  ...metadata,
  kind: 'admin-invitation-capacity-projection',
  capacityId: 'invitation-capacity-staging',
  activeCount: 18,
  activeLimit: 25,
  queuedCount: 4,
  forecastExhaustionAt: '2026-08-12T20:00:00.000Z',
});

const project = (
  records: readonly AdminAuthorityDocument[],
  authorityState: AdminBriefingAuthorityState = 'live',
) =>
  projectAdminBriefing({
    authorityState,
    locale: 'pt-BR',
    now: '2026-08-07T05:30:00.000Z',
    queueState: { cursor: 'cursor-7', view: 'assigned' },
    records,
  });

describe('Admin overview authority projection', () => {
  it('orders authorized work by severity, deadline, assignment, and stable identifier', () => {
    const model = project([
      accessContext,
      inbox('inbox-z', 'warning', '2026-08-07T06:00:00.000Z'),
      inbox('inbox-b', 'critical', '2026-08-07T06:00:00.000Z', 'administrator-0009'),
      inbox('inbox-a', 'critical', '2026-08-07T06:00:00.000Z'),
      inbox('inbox-c', 'critical', '2026-08-07T07:00:00.000Z'),
    ]);

    expect(model.priorities.map(({ id }) => id)).toEqual([
      'inbox-a',
      'inbox-b',
      'inbox-c',
      'inbox-z',
    ]);
  });

  it('marks missing and stale business context without inventing zero values or trends', () => {
    const missing = project([accessContext]);
    const stale = project([
      accessContext,
      document({
        ...capacity,
        freshness: { ...metadata.freshness, state: 'stale' },
      }),
    ]);

    expect(missing.context.capacity).toMatchObject({ status: 'unavailable' });
    expect(missing.context.capacity.activeCount).toBeUndefined();
    expect(stale.context.capacity).toMatchObject({ status: 'stale' });
    expect(stale.context.capacity.trend).toBeUndefined();
  });

  it('degrades only affected capabilities and retains trustworthy marked reads', () => {
    const model = project([accessContext, capacity, incident]);

    expect(model.degradedCapabilities).toEqual(['invitation.delivery']);
    expect(model.context.capacity.status).toBe('degraded');
    expect(model.context.capacity.action).toBeNull();
    expect(model.priorities.find(({ id }) => id === 'incident-0001')?.action).not.toBeNull();
  });

  it('projects handoff coverage, escalation, and safe drill-in state without role authority', () => {
    const model = project([
      accessContext,
      incident,
      inbox('inbox-uncovered', 'warning', '2026-08-07T05:10:00.000Z'),
    ]);
    const covered = model.priorities.find(({ id }) => id === 'incident-0001');
    const uncovered = model.priorities.find(({ id }) => id === 'inbox-uncovered');

    expect(covered?.handoff).toEqual({
      escalation: 'overdue',
      ownerReference: 'administrator-0001',
      state: 'covered',
      substituteReference: 'administrator-0002',
    });
    expect(uncovered?.handoff.state).toBe('uncovered');
    expect(covered?.action?.href).toContain('/pt-BR/admin/operation/incidents/incident-0001');
    expect(covered?.action?.href).toContain('function=operations');
    expect(covered?.action?.href).toContain('view=assigned');
    expect(covered?.action?.href).toContain('cursor=cursor-7');
    expect(covered?.action?.href).toContain('version=7');
    expect(covered?.action?.href).not.toContain('role=');
  });

  it('keeps an invalidated briefing stale until authoritative live records return', () => {
    const reconnecting = project([accessContext, incident], 'reconnecting');
    const live = project([accessContext, incident]);

    expect(reconnecting.status).toBe('stale');
    expect(reconnecting.priorities).toHaveLength(1);
    expect(live.status).toBe('live');
  });

  it('uses the admitted API session and projection metadata when access context is unavailable', () => {
    const model = projectAdminBriefing({
      authorityState: 'live',
      locale: 'en',
      now: '2026-08-07T05:30:00.000Z',
      queueState: { view: 'assigned' },
      records: [capacity],
      session: { activeFunction: 'operations', actorId: 'administrator-0001' },
    });

    expect(model.activeFunction).toBe('operations');
    expect(model.context.environment).toEqual({
      id: 'staging-brasil',
      kind: 'staging',
      label: 'Staging Brasil',
    });
    expect(model.context.observedAt).toBe('2026-08-07T05:00:00.000Z');
    expect(model.context.capacity.status).toBe('live');
    expect(model.context.capacity.action).toBeNull();
  });
});
