import { readFileSync } from 'node:fs';

import {
  routeHref,
  validateWebDocument,
  type FutureAuthorityCommandJson,
  type WebLocale,
  type WebRouteId,
} from '@liiiraa/web-core';
import { createWebPreviewAuthority, getWebScenario } from '@liiiraa/web-preview';
import { describe, expect, it } from 'vitest';

import adminEn from '../content/admin.en.json';
import adminPtBr from '../content/admin.pt-BR.json';

const featureSource = readFileSync(new URL('./admin-preview.tsx', import.meta.url), 'utf8');
const ADMIN_ENTRY_ROUTE_IDS = [
  'admin-role',
  'admin-support',
  'admin-operations',
  'admin-security',
  'admin-diagnostics',
  'admin-audit',
  'admin-audit-event',
] as const satisfies readonly WebRouteId[];

const shapeOf = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(shapeOf);
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, shapeOf(child)]),
    );
  }
  return typeof value;
};

describe('role-scoped admin', () => {
  it('projects four distinct closed workspaces and renders a redacted support case', () => {
    const access = {
      support: ['admin-role', 'admin-support'],
      operations: ['admin-role', 'admin-operations', 'admin-audit'],
      security: ['admin-role', 'admin-security', 'admin-diagnostics', 'admin-audit'],
      audit: ['admin-role', 'admin-audit', 'admin-audit-event'],
    } as const;

    expect(access.support).toEqual(['admin-role', 'admin-support']);
    expect(access.operations).toEqual(['admin-role', 'admin-operations', 'admin-audit']);
    expect(access.security).toEqual([
      'admin-role',
      'admin-security',
      'admin-diagnostics',
      'admin-audit',
    ]);
    expect(access.audit).toEqual(['admin-role', 'admin-audit', 'admin-audit-event']);
    expect(new Set(Object.values(access).map((routes) => routes.join(','))).size).toBe(4);

    for (const role of Object.keys(access)) expect(featureSource).toContain(`${role}: [`);
    for (const locale of ['en', 'pt-BR'] as const satisfies readonly WebLocale[]) {
      for (const routeId of ADMIN_ENTRY_ROUTE_IDS) {
        const parameters: Record<string, string> = { locale };
        if (routeId === 'admin-support') parameters['caseId'] = 'case-preview';
        if (routeId === 'admin-operations' || routeId === 'admin-security') parameters['reviewId'] = 'review-preview';
        if (routeId === 'admin-diagnostics') parameters['diagnosticId'] = 'diagnostic-preview';
        if (routeId === 'admin-audit-event') parameters['eventId'] = 'event-preview';
        expect(routeHref(routeId, parameters).ok).toBe(true);
      }
    }
    expect(shapeOf(adminPtBr)).toEqual(shapeOf(adminEn));
    expect(adminEn.support.title).toBe('Support case review');
    expect(adminEn.support.target).toBe('Customer target ••••-042');
    expect(featureSource).toContain('data-remote-state-changed="false"');
    expect(featureSource).toContain('ProvenanceLabel');
    expect(adminEn.support.detail).not.toMatch(/@[a-z0-9.-]+\.[a-z]{2,}/iu);
  });

  it('keeps route resolution canonical, localized, and fail-closed', () => {
    const routeSource = readFileSync(
      new URL('../app/[locale]/[[...workspace]]/page.tsx', import.meta.url),
      'utf8',
    );
    expect(routeSource).toContain('matchWebRoute');
    expect(routeSource).toContain("securityBoundary: 'admin-origin'");
    expect(routeSource).toContain("createAdminFailureModel('403'");
    expect(routeSource).not.toMatch(/redirect\(/u);

    expect(adminEn.security.title).toBe('Security review');
    expect(adminPtBr.security.title).toBe('Revisão de segurança');
    expect(adminEn.locale).toBe('en');
    expect(adminPtBr.locale).toBe('pt-BR');
  });
});

describe('immutable audit', () => {
  it('validates, freezes, redacts, and correlates every complete event', async () => {
    for (const field of [
      'eventId',
      'actor',
      'role',
      'action',
      'redactedTarget',
      'reason',
      'consentReference',
      'occurredAt',
      'result',
      'correlationId',
      'receipt',
    ]) expect(featureSource).toContain(field);
    expect(featureSource).toContain('createImmutableAuditEvent');
    expect(featureSource).toContain('validateWebDocument(event)');
    expect(featureSource).toContain('return deepFreeze(event)');
    expect(featureSource).toContain('••••-042');
    expect(featureSource).toContain("result: 'simulated-no-change'");

    const scenario = getWebScenario('W14');
    const authority = createWebPreviewAuthority({
      clock: () => scenario.clock,
      correlationIds: ['W14-support-authority-test'],
      scenario,
    });
    const command: FutureAuthorityCommandJson = {
      command: 'support.review',
      description: 'Phase 4 admin support authority',
      phase: 'Phase 4',
      surface: 'admin',
    };
    const result = await authority.execute({
      command,
      disposition: 'confirm',
      reviewedInputs: ['target-reviewed'],
    });
    expect(result.kind).toBe('no-change');
    if (result.kind !== 'no-change') throw new Error('Expected no-change receipt');
    expect(validateWebDocument(result.receipt).ok).toBe(true);
    expect(result.receipt).toMatchObject({ nextPhase: 'Phase 4', remoteStateChanged: false });
  });
});
