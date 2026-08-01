import { readFileSync } from 'node:fs';

import {
  projectNavigation,
  routeHref,
  validateWebDocument,
  WEB_ORIGINS,
  type FutureAuthorityCommandJson,
  type WebLocale,
} from '@liiiraa/web-core';
import { createWebPreviewAuthority, getWebScenario } from '@liiiraa/web-preview';
import { describe, expect, it } from 'vitest';

import accountEn from '../content/account.en.json';
import accountPtBr from '../content/account.pt-BR.json';

const featureSource = readFileSync(new URL('./account-preview.tsx', import.meta.url), 'utf8');
const pageSource = readFileSync(
  new URL('../app/[locale]/[[...responsibility]]/page.tsx', import.meta.url),
  'utf8',
);
const layoutSource = readFileSync(new URL('../app/[locale]/layout.tsx', import.meta.url), 'utf8');
const accountStyles = readFileSync(new URL('../app/account-shell.css', import.meta.url), 'utf8');
const ACCOUNT_ENTRY_ROUTE_IDS = [
  'account-sign-in',
  'account-overview',
  'account-profile',
  'account-security',
  'account-subscription',
  'account-invoices',
  'account-device',
  'account-downloads',
  'account-privacy',
  'account-support',
] as const;

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

const sourceBetween = (start: string, end: string): string => {
  const startIndex = featureSource.indexOf(start);
  const endIndex = featureSource.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return featureSource.slice(startIndex, endIndex);
};

describe('account responsibility routes and locales', () => {
  it('covers sign-in plus every canonical account responsibility in both locales', () => {
    expect(ACCOUNT_ENTRY_ROUTE_IDS.slice(1)).toEqual(
      projectNavigation('account').map(({ id }) => id),
    );
    for (const locale of ['pt-BR', 'en'] as const satisfies readonly WebLocale[]) {
      for (const routeId of ACCOUNT_ENTRY_ROUTE_IDS) {
        expect(routeHref(routeId, { locale }).ok).toBe(true);
      }
    }
    expect(shapeOf(accountPtBr)).toEqual(shapeOf(accountEn));
    for (const routeId of ACCOUNT_ENTRY_ROUTE_IDS) expect(featureSource).toContain(`'${routeId}'`);
  });

  it('validates complete email input and provides an accessible correction target', () => {
    expect(featureSource).toContain('value.length <= 254 && EMAIL_PATTERN.test(value)');
    expect(featureSource).toContain('const EMAIL_PATTERN = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/u');
    expect(featureSource).toContain('href="#preview-email"');
    expect(featureSource).toMatch(/role="alert" tabIndex=\{-1\}/u);
    expect(featureSource).toContain('PreviewWorkflow');
  });
});

describe('W11 and W12 complete account states', () => {
  it('renders ready responsibility data and degraded recovery without hiding preview provenance', () => {
    expect(getWebScenario('W11').requiredRouteIds).toEqual(ACCOUNT_ENTRY_ROUTE_IDS.slice(1));
    expect(getWebScenario('W12')).toMatchObject({ terminalState: 'authority-unavailable' });
    expect(featureSource).toContain('data-authority-connected="false"');
    expect(featureSource).toContain(
      'data-account-state="offline stale expired-session partial-failure"',
    );
    expect(featureSource).toContain("hrefFor('account-sign-in', content.locale)");
    expect(featureSource).toContain("hrefFor('account-support', content.locale)");
  });

  it('uses accessible compact invoice details and a public stable download boundary', () => {
    const stable = routeHref('releases-channel', { channel: 'stable', locale: 'en' });
    expect(stable).toEqual({ ok: true, value: '/en/releases/stable' });
    expect(`${WEB_ORIGINS['public-origin']}${stable.ok ? stable.value : ''}`).toBe(
      'https://liiiraa.com/en/releases/stable',
    );
    expect(featureSource).toContain('ResponsiveDataTable');
    expect(featureSource).toContain('essential: false');
    expect(accountEn.downloads.boundary).toContain('No session, account context, or form data');
  });
});

describe('authored overview and Profile workspaces', () => {
  it('groups next actions, account summaries, and limitations around a clear overview focus', () => {
    const overviewSource = sourceBetween('const OverviewPreview', 'const ProfilePreview');

    expect(overviewSource).toContain('account-overview__focus');
    expect(overviewSource).toContain('account-overview__summaries');
    expect(overviewSource).toContain('account-overview__limitations');
    expect(overviewSource).toContain("hrefFor('account-profile', content.locale)");
    expect(overviewSource).toContain("hrefFor('account-subscription', content.locale)");
    expect(overviewSource).toContain("hrefFor('account-device', content.locale)");
    expect(overviewSource).toContain("hrefFor('account-support', content.locale)");
    expect(overviewSource).not.toContain('ResponsiveDataTable');
    expect(overviewSource).not.toContain('EmptyComposition');
  });

  it('bounds Profile controls and distinguishes review from unavailable authority', () => {
    const profileSource = sourceBetween('const ProfilePreview', 'export const SecurityMethodList');

    expect(profileSource).toContain('account-profile__editor');
    expect(profileSource).toContain('account-profile__facts');
    expect(profileSource).toContain('account-profile__actions');
    expect(profileSource).toContain('content.profile.nameDescription');
    expect(profileSource).toContain('content.profile.authorityState');
    expect(profileSource).toContain('data-authority-action="unavailable"');
    expect(accountStyles).toMatch(/\.account-profile__control\s*\{[\s\S]*max-inline-size:/u);
  });

  it('keeps global preview truth once and reserves route copy for distinct context', () => {
    expect(layoutSource.match(/<AccountPreviewProvenance\b/gu) ?? []).toHaveLength(1);
    expect(layoutSource.match(/className="account-preview-rail"/gu) ?? []).toHaveLength(1);
    expect(featureSource).not.toContain('<ProvenanceLabel');
    expect(featureSource).toContain('<PreviewBoundary');
  });

  it('keeps PT-BR and English labels, states, recovery, and limitations equivalent', () => {
    expect(shapeOf(accountPtBr)).toEqual(shapeOf(accountEn));
    for (const content of [accountPtBr, accountEn]) {
      expect(content.overview.nextTitle.length).toBeGreaterThan(0);
      expect(content.overview.summariesTitle.length).toBeGreaterThan(0);
      expect(content.overview.limitationsTitle.length).toBeGreaterThan(0);
      expect(content.profile.nameDescription.length).toBeGreaterThan(0);
      expect(content.profile.authorityState.length).toBeGreaterThan(0);
      expect(content.profile.limitations.length).toBeGreaterThan(0);
      expect(content.recovery.signIn.length).toBeGreaterThan(0);
      expect(content.recovery.support.length).toBeGreaterThan(0);
    }
  });
});

describe('task-specific account workspace density', () => {
  it('uses semantic structures matched to each responsibility instead of repeated cards', () => {
    const securitySource = sourceBetween('const SecurityPreview', 'const CollectionDisclosure');
    const subscriptionSource = sourceBetween(
      'export const SubscriptionSummary',
      'export const InvoiceTable',
    );
    const invoiceSource = sourceBetween(
      'export const InvoiceTable',
      'export const DeviceBindingReview',
    );
    const deviceSource = sourceBetween(
      'export const DeviceBindingReview',
      'export const DownloadsPreview',
    );
    const downloadsSource = sourceBetween(
      'export const DownloadsPreview',
      'export const ConsentReview',
    );
    const privacySource = sourceBetween(
      'export const PrivacyCenter',
      'export const SensitiveFieldReview',
    );
    const supportSource = sourceBetween(
      'export const SupportRequestComposer',
      'export type AccountPreviewExperienceProps',
    );

    expect(securitySource).toContain('account-responsibility account-security');
    expect(securitySource).toContain('account-security__workspace');
    expect(securitySource).not.toContain('<PreviewBoundary');
    expect(subscriptionSource).toContain('account-responsibility account-subscription');
    expect(subscriptionSource).toContain('account-definition-list');
    expect(subscriptionSource).not.toContain('<PreviewBoundary');
    expect(invoiceSource).toContain('account-responsibility account-invoices');
    expect(invoiceSource).toContain('ResponsiveDataTable');
    expect(deviceSource).toContain('account-responsibility account-device');
    expect(deviceSource).toContain('account-sensitive-action');
    expect(downloadsSource).toContain('account-responsibility account-downloads');
    expect(privacySource).toContain('account-responsibility account-privacy');
    expect(supportSource).toContain('account-responsibility account-support');
    expect(supportSource).toContain('account-support__fields');
    expect(accountStyles).not.toMatch(/box-shadow:\s*0\s+\d+px\s+(?:1[6-9]|[2-9]\d)px/iu);
  });

  it('keeps every deterministic degraded and terminal path explicit and bilingual', () => {
    expect(featureSource).toContain("'loading'");
    expect(featureSource).toContain('data-account-state="empty"');
    expect(featureSource).toContain(
      'data-account-state="offline stale expired-session partial-failure"',
    );
    expect(featureSource).toContain('PreviewWorkflow');
    expect(featureSource).toContain('safeDraftFields');
    expect(featureSource).toContain('PreviewReceipt');
    expect(shapeOf(accountPtBr)).toEqual(shapeOf(accountEn));
  });

  it('constrains form and detail measures while preserving semantic reflow', () => {
    expect(accountStyles).toMatch(/#account-main\s*\{[\s\S]*max-inline-size:/u);
    expect(accountStyles).toMatch(/\.account-definition-list\s*\{[\s\S]*display:\s*grid/u);
    expect(accountStyles).toMatch(/\.account-support__fields\s*\{[\s\S]*max-inline-size:/u);
    expect(accountStyles).toMatch(
      /@media \(width < 760px\)[\s\S]*\.account-definition-list\s*>\s*div/u,
    );
  });
});

describe('W13 sensitive account no-change authority', () => {
  const command = (family: 'device' | 'privacy' | 'support'): FutureAuthorityCommandJson => ({
    command: `${family}.review`,
    description: `Phase 4 account ${family} authority`,
    phase: 'Phase 4',
    surface: 'account',
  });

  it.each(['device', 'privacy', 'support'] as const)(
    'emits a schema-valid no-change %s receipt only after review',
    async (family) => {
      const scenario = getWebScenario('W13');
      const authority = createWebPreviewAuthority({
        clock: () => scenario.clock,
        correlationIds: [`W13-${family}-receipt`],
        scenario,
      });
      const result = await authority.execute({
        command: command(family),
        disposition: 'confirm',
        reviewedInputs: [`${family}-reviewed`],
      });
      expect(result.kind).toBe('no-change');
      if (result.kind !== 'no-change') throw new Error('Expected no-change result');
      expect(validateWebDocument(result.receipt).ok).toBe(true);
      expect(result.receipt).toMatchObject({ nextPhase: 'Phase 4', remoteStateChanged: false });
    },
  );

  it('supports explicit cancellation and contains no mutation, upload, cookie, or session channel', async () => {
    const scenario = getWebScenario('W13');
    const authority = createWebPreviewAuthority({
      clock: () => scenario.clock,
      correlationIds: ['W13-cancel-receipt'],
      scenario,
    });
    const result = await authority.execute({
      command: command('privacy'),
      disposition: 'cancel',
      reviewedInputs: ['privacy-reviewed'],
    });
    expect(result).toMatchObject({
      kind: 'cancelled',
      receipt: { nextPhase: 'Phase 4', remoteStateChanged: false },
    });
    expect(featureSource).not.toMatch(
      /\bfetch\s*\(|XMLHttpRequest|WebSocket|document\.cookie|localStorage|sessionStorage|type="file"/u,
    );
    expect(featureSource).toContain("safeDraftFields: ['subject']");
    expect(featureSource).toContain('ResponsiveDataTable');
    expect(pageSource).not.toMatch(/redirect\(|searchParams|process\.env/u);
  });
});
