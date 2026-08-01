import { existsSync, readFileSync } from 'node:fs';

import {
  routeHref,
  validateWebDocument,
  type FutureAuthorityCommandJson,
  type WebLocale,
} from '@liiiraa/web-core';
import { createWebPreviewAuthority, getWebScenario } from '@liiiraa/web-preview';
import { describe, expect, it } from 'vitest';

import adminEn from '../content/admin.en.json';
import adminPtBr from '../content/admin.pt-BR.json';
import { ADMIN_ENTRY_ROUTE_IDS, ADMIN_ROLE_ROUTE_ACCESS } from '../admin-preview-model';

const featureSource = readFileSync(new URL('./admin-preview.tsx', import.meta.url), 'utf8');
const layoutSource = readFileSync(new URL('../app/[locale]/layout.tsx', import.meta.url), 'utf8');
const stylesSource = readFileSync(new URL('../app/admin-shell.css', import.meta.url), 'utf8');
const navigationUrl = new URL('../admin-navigation.tsx', import.meta.url);
const navigationSource = existsSync(navigationUrl) ? readFileSync(navigationUrl, 'utf8') : '';

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
  it('renders the exact product lockup and a perceivable current role workspace', () => {
    expect(layoutSource).toContain('ProductLockup');
    expect(layoutSource).toContain('<AdminNavigation');
    expect(layoutSource).not.toContain('admin-brand__mark');
    expect(navigationSource).toContain('aria-current');
    expect(navigationSource).toContain("data-current={isCurrent ? 'page' : undefined}");
    expect(layoutSource.match(/AdminPreviewProvenance/gu)).toHaveLength(2);
  });

  it('composes the role landing around next work, recent activity, scope, and workspaces', () => {
    expect(featureSource).toContain('admin-landing__focus');
    expect(featureSource).toContain('admin-landing__scope');
    expect(featureSource).toContain('admin-landing__activity');
    expect(featureSource).toContain('admin-landing__workspaces');
    expect(featureSource).not.toContain('canonical route manifest');
  });

  it('keeps current state non-color-only and reflows the authored landing at 390px', () => {
    expect(navigationSource).toContain("aria-current={isCurrent ? 'page' : undefined}");
    expect(stylesSource).toContain('overflow-x: clip');
    expect(stylesSource).toMatch(
      /@media \(width < 640px\)[\s\S]*\.admin-landing__layout[\s\S]*grid-template-columns: minmax\(0, 1fr\)/u,
    );
    expect(stylesSource).toMatch(
      /@media \(width < 640px\)[\s\S]*\.admin-nav__list[\s\S]*grid-template-columns: minmax\(0, 1fr\)/u,
    );
  });

  it('projects four distinct closed workspaces and renders a redacted support case', () => {
    const access = ADMIN_ROLE_ROUTE_ACCESS;

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

    for (const locale of ['en', 'pt-BR'] as const satisfies readonly WebLocale[]) {
      for (const routeId of ADMIN_ENTRY_ROUTE_IDS) {
        const parameters: Record<string, string> = { locale };
        if (routeId === 'admin-support') parameters['caseId'] = 'case-preview';
        if (routeId === 'admin-operations' || routeId === 'admin-security')
          parameters['reviewId'] = 'review-preview';
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

  it('leads the representative workspace with decision context, evidence, consent, and audit', () => {
    const supportStart = featureSource.indexOf('export const SupportCaseWorkspace');
    const supportEnd = featureSource.indexOf('export const PurposeAndImpactReview');
    const supportSource = featureSource.slice(supportStart, supportEnd);

    expect(supportSource).toContain('admin-decision__context');
    expect(supportSource).toContain('admin-decision__evidence');
    expect(supportSource).toContain('admin-decision__constraints');
    expect(supportSource).toContain('admin-decision__audit');
    expect(supportSource.indexOf('admin-decision__context')).toBeLessThan(
      supportSource.indexOf('admin-decision__evidence'),
    );
    expect(supportSource.indexOf('admin-decision__constraints')).toBeLessThan(
      supportSource.indexOf('admin-decision__audit'),
    );
  });

  it('keeps authority visibly unavailable while allowing only a no-change review', () => {
    expect(featureSource).toContain('data-authority-state="disconnected"');
    expect(featureSource).toContain('data-authority-action="unavailable"');
    expect(featureSource).toMatch(
      /data-authority-action="unavailable"[\s\S]*<LbButton[\s\S]*isDisabled/u,
    );
    expect(adminEn.support.authorityAction).toContain('Unavailable');
    expect(adminPtBr.support.authorityAction).toContain('indisponível');
  });

  it('keeps persistent preview truth singular and localizes human operational meaning', () => {
    const supportStart = featureSource.indexOf('export const SupportCaseWorkspace');
    const supportEnd = featureSource.indexOf('export const PurposeAndImpactReview');
    const supportSource = featureSource.slice(supportStart, supportEnd);

    expect(supportSource).not.toContain('<PreviewBoundary');
    expect(featureSource).toContain('showProvenance={true}');
    expect(adminEn.landing.scopeBody).not.toMatch(/manifest|route/iu);
    expect(adminPtBr.landing.scopeBody).not.toMatch(/manifesto|rota/iu);
    expect(shapeOf(adminPtBr)).toEqual(shapeOf(adminEn));
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
    ])
      expect(featureSource).toContain(field);
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

describe('W15 diagnostic consent guard', () => {
  it('keeps absent, expired, wrong-purpose, wrong-field, actor, and audit scopes blocked', () => {
    const scenario = getWebScenario('W15');
    expect(scenario).toMatchObject({
      consent: 'preview-denied',
      role: 'security',
      terminalState: 'diagnostic-consent-blocked',
    });
    expect(scenario.requiredProof).toEqual([
      'access-blocked',
      'purpose',
      'permitted-fields',
      'expiration',
      'actor',
      'audit-explanation',
    ]);
    expect(featureSource).toContain("return 'missing'");
    expect(featureSource).toContain("return 'expired'");
    expect(featureSource).toContain("return 'wrong-scope'");
    expect(featureSource).toContain('consent.purpose !== requiredPurpose');
    expect(featureSource).toContain('consent.actor !== requiredActor');
    expect(featureSource).toContain('consent.auditEventId !== requiredAuditEventId');
    expect(featureSource).toContain('!consent.permittedFields.includes(field)');
    expect(featureSource).toContain('!requiredFields.includes(field)');
    expect(adminEn.diagnostics.blockedBody).toContain(
      'without revealing diagnostic or customer data',
    );
    expect(adminPtBr.diagnostics.denial).toContain('não revela nenhum campo de diagnóstico');
  });
});

describe('W16 viewport guard and recovery states', () => {
  it('preserves safe review while blocking high-risk administration below 960px', () => {
    const scenario = getWebScenario('W16');
    const styles = readFileSync(new URL('../app/admin-shell.css', import.meta.url), 'utf8');
    expect(scenario).toMatchObject({
      role: 'operations',
      terminalState: 'high-risk-viewport-blocked',
      viewport: '390x844',
    });
    expect(scenario.requiredProof).toEqual(['safe-review', 'high-risk-action-blocked']);
    expect(styles).toMatch(
      /@media \(width < 960px\)[\s\S]*\[data-high-risk-action='true'\][\s\S]*display: none !important/u,
    );
    expect(featureSource).toContain('data-high-risk-action="true"');
    expect(featureSource).toContain('admin-mobile-high-risk-block');
    expect(featureSource).toContain('aria-describedby="admin-mobile-high-risk-block"');
    expect(featureSource).toContain('viewportWidth');
  });

  it('authors offline, stale, expired, permission, and partial-failure recovery safely', () => {
    for (const state of [
      'offline',
      'stale',
      'expired-session',
      'permission-denied',
      'partial-failure',
    ])
      expect(featureSource).toContain(`'${state}'`);
    expect(featureSource).toContain("safeDraftFields: ['case']");
    expect(featureSource).not.toContain("safeDraftFields: ['response']");
    expect(adminEn.recovery.safeDraft).toContain('Response and diagnostic fields are discarded');
    expect(adminPtBr.recovery.safeDraft).toContain(
      'Resposta e campos de diagnóstico são descartados',
    );
  });
});

describe('admin no-change authority', () => {
  it.each([
    ['support', 'W14'],
    ['diagnostic', 'W15'],
    ['admin', 'W16'],
  ] as const)('closes %s actions with a schema-valid receipt', async (family, scenarioId) => {
    const scenario = getWebScenario(scenarioId);
    const authority = createWebPreviewAuthority({
      clock: () => scenario.clock,
      correlationIds: [`${scenarioId}-${family}-receipt-test`],
      scenario,
    });
    const command: FutureAuthorityCommandJson = {
      command: `${family}.review`,
      description: `Phase 4 admin ${family} authority`,
      phase: 'Phase 4',
      surface: 'admin',
    };
    const result = await authority.execute({
      command,
      disposition: 'confirm',
      reviewedInputs: [`${family}-reviewed`],
    });
    expect(result.kind).toBe('no-change');
    if (result.kind !== 'no-change') throw new Error('Expected no-change receipt');
    expect(validateWebDocument(result.receipt).ok).toBe(true);
    expect(result.receipt).toMatchObject({ nextPhase: 'Phase 4', remoteStateChanged: false });
  });

  it('contains no network, upload, cookie, storage, session, or mutation channel', () => {
    expect(featureSource).not.toMatch(
      /\bfetch\s*\(|XMLHttpRequest|WebSocket|document\.cookie|localStorage|sessionStorage|type="file"/u,
    );
    expect(featureSource).toContain('createPreviewWorkflowMachine');
    expect(featureSource).toContain('createWebPreviewAuthority');
    expect(featureSource).toContain('data-remote-state-changed="false"');
    expect(featureSource).toContain('data-immutable="true"');
  });
});
