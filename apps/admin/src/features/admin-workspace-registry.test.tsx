import { ADMIN_CANONICAL_ROUTE_IDS } from '@liiiraa/web-core';
import { describe, expect, it } from 'vitest';

import {
  adminSessionCanOpenWorkspace,
  isAdminCanonicalRoute,
  resolveAdminWorkspaceRecordId,
  resolveAdminWorkspaceDefinition,
} from './admin-workspace-registry-model';

describe('production Admin workspace registry', () => {
  it('maps every canonical Admin route to one stable seven-domain workspace', () => {
    const definitions = ADMIN_CANONICAL_ROUTE_IDS.map(resolveAdminWorkspaceDefinition);
    expect(definitions).not.toContain(null);
    expect(new Set(definitions.map((definition) => definition?.domain))).toEqual(
      new Set(['overview', 'people', 'revenue', 'operation', 'support', 'security', 'system']),
    );
  });

  it('rejects legacy preview and unknown route identities', () => {
    expect(isAdminCanonicalRoute('admin-operations')).toBe(false);
    expect(resolveAdminWorkspaceDefinition('admin-operations')).toBeNull();
    expect(resolveAdminWorkspaceDefinition('public-home')).toBeNull();
  });

  it('keeps invitations separate from administrative access governance', () => {
    expect(resolveAdminWorkspaceDefinition('admin-people-invitations')?.kind).toBe('invitations');
    expect(resolveAdminWorkspaceDefinition('admin-people-invitation')?.kind).toBe('invitations');
    expect(resolveAdminWorkspaceDefinition('admin-people-team')?.kind).toBe('access-governance');
    expect(resolveAdminWorkspaceDefinition('admin-people-access-review')?.kind).toBe(
      'access-governance',
    );
  });

  it('projects domain admission from the server session function', () => {
    const revenue = resolveAdminWorkspaceDefinition('admin-revenue');
    const security = resolveAdminWorkspaceDefinition('admin-security-domain');
    if (revenue === null || security === null) throw new Error('REGISTRY_FIXTURE_INVALID');
    expect(adminSessionCanOpenWorkspace(revenue, 'pt-BR', 'operations')).toBe(true);
    expect(adminSessionCanOpenWorkspace(revenue, 'pt-BR', 'security')).toBe(false);
    expect(adminSessionCanOpenWorkspace(security, 'en', 'security')).toBe(true);
    expect(adminSessionCanOpenWorkspace(security, 'en', 'audit')).toBe(true);
  });

  it('routes cross-domain utilities to the permission-filtered Queue Canvas', () => {
    for (const routeId of [
      'admin-search',
      'admin-inbox',
      'admin-saved-views',
      'admin-activity',
    ] as const)
      expect(resolveAdminWorkspaceDefinition(routeId)).toMatchObject({
        domain: 'overview',
        kind: 'queue',
      });
  });

  it('preserves the canonical record identity for detail routes', () => {
    expect(
      resolveAdminWorkspaceRecordId('admin-operation-job', {
        jobId: 'job-04-61',
        locale: 'pt-BR',
      }),
    ).toBe('job-04-61');
    expect(
      resolveAdminWorkspaceRecordId('admin-security-incident', {
        incidentId: 'incident-critical-1',
        locale: 'en',
      }),
    ).toBe('incident-critical-1');
    expect(
      resolveAdminWorkspaceRecordId('admin-revenue-refunds', { locale: 'pt-BR' }),
    ).toBeUndefined();
  });
});
