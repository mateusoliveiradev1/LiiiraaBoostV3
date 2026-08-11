import { readFileSync } from 'node:fs';

import { ADMIN_CANONICAL_ROUTE_IDS } from '@liiiraa/web-core';
import { describe, expect, it } from 'vitest';

import {
  adminSessionCanOpenWorkspace,
  isAdminCanonicalRoute,
  resolveAdminWorkspaceRecordId,
  resolveAdminWorkspaceDefinition,
} from './admin-workspace-registry-model';

describe('production Admin workspace registry', () => {
  it('renders denial as a complete masked workspace with a safe recovery path', () => {
    const source = readFileSync(new URL('./admin-workspace-registry.tsx', import.meta.url), 'utf8');
    expect(source).toContain('className="admin-workspace-denial"');
    expect(source).toContain('Voltar à visão geral');
    expect(source).toContain('Return to overview');
    expect(source).toContain('Nenhum dado protegido foi carregado');
    expect(source).toContain('No protected data was loaded');
  });

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
    const people = resolveAdminWorkspaceDefinition('admin-people');
    const security = resolveAdminWorkspaceDefinition('admin-security-domain');
    if (people === null || revenue === null || security === null)
      throw new Error('REGISTRY_FIXTURE_INVALID');
    expect(adminSessionCanOpenWorkspace(revenue, 'pt-BR', 'operations')).toBe(true);
    expect(adminSessionCanOpenWorkspace(revenue, 'pt-BR', 'security')).toBe(false);
    expect(adminSessionCanOpenWorkspace(people, 'pt-BR', 'operations')).toBe(false);
    expect(adminSessionCanOpenWorkspace(people, 'pt-BR', 'security')).toBe(true);
    expect(adminSessionCanOpenWorkspace(security, 'en', 'security')).toBe(true);
    expect(adminSessionCanOpenWorkspace(security, 'en', 'audit')).toBe(false);
  });

  it('admits cross-domain queue utilities only for the operations function', () => {
    for (const routeId of [
      'admin-search',
      'admin-inbox',
      'admin-saved-views',
      'admin-activity',
    ] as const) {
      const definition = resolveAdminWorkspaceDefinition(routeId);
      expect(definition).toMatchObject({
        domain: 'overview',
        kind: 'queue',
      });
      if (definition === null) throw new Error('REGISTRY_FIXTURE_INVALID');
      expect(adminSessionCanOpenWorkspace(definition, 'pt-BR', 'operations')).toBe(true);
      expect(adminSessionCanOpenWorkspace(definition, 'pt-BR', 'security')).toBe(false);
      expect(adminSessionCanOpenWorkspace(definition, 'pt-BR', 'support')).toBe(false);
      expect(adminSessionCanOpenWorkspace(definition, 'pt-BR', 'audit')).toBe(false);
    }
  });

  it('composes each admitted non-operations workspace from its native authority projection', () => {
    const source = readFileSync(new URL('./admin-workspace-registry.tsx', import.meta.url), 'utf8');

    expect(source).toContain("role === 'operations'");
    expect(source).toContain('routeId="admin-role"');
    expect(source).toContain('routeId="admin-security"');
    expect(source).toContain('routeId="admin-audit"');
  });

  it('loads support without requesting operations-only revenue or job authority', () => {
    const source = readFileSync(new URL('./admin-revenue-support.tsx', import.meta.url), 'utf8');

    expect(source).toContain("surface === 'support'");
    expect(source).toContain('createEmptyQueryResult');
    expect(source).toContain("authority.list('support-cases')");
    expect(source).toContain("authority.list('entitlements')");
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
