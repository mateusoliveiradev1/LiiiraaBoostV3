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
const degradedSource = readFileSync(
  new URL('./account-degraded-preview.tsx', import.meta.url),
  'utf8',
);
const scenarioSource = readFileSync(new URL('./account-scenario.ts', import.meta.url), 'utf8');
const captureSource = readFileSync(new URL('../capture/w12.ts', import.meta.url), 'utf8');
const pageSource = readFileSync(
  new URL('../app/[locale]/[[...responsibility]]/page.tsx', import.meta.url),
  'utf8',
);
const layoutSource = readFileSync(new URL('../app/[locale]/layout.tsx', import.meta.url), 'utf8');
const navigationSource = readFileSync(new URL('../account-navigation.tsx', import.meta.url), 'utf8');
const accountStyles = readFileSync(new URL('../app/account-shell.css', import.meta.url), 'utf8');
const ACCOUNT_ENTRY_ROUTE_IDS = [
  'account-sign-in',
  'account-sign-up',
  'account-onboarding',
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
  it('covers sign-in, account creation, and every canonical responsibility in both locales', () => {
    expect(ACCOUNT_ENTRY_ROUTE_IDS.slice(3)).toEqual(
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
    expect(featureSource).toContain('export const SignUpPreview');
    expect(featureSource).toContain('data-account-state="sign-up-preview"');
    expect(featureSource).toContain("hrefFor('account-sign-up', content.locale)");
    expect(featureSource).toContain("hrefFor('account-sign-in', content.locale)");
    expect(accountPtBr.signUp.title).toBe('Criar sua conta');
    expect(accountEn.signUp.title).toBe('Create your account');
  });

  it('renders bilingual onboarding and hands deep analysis to the Windows app', () => {
    const onboardingSource = sourceBetween('export const OnboardingPreview', 'const OverviewPreview');

    expect(onboardingSource).toContain('data-session-created="false"');
    expect(onboardingSource).toContain('data-authority-connected="false"');
    expect(onboardingSource).toContain("createDesktopAnalyzeLink()");
    expect(onboardingSource).toContain("routeHref('public-download'");
    expect(onboardingSource).toContain("plan === 'premium'");
    expect(onboardingSource).toContain("data-payment-review={plan === 'premium'");
    expect(accountPtBr.onboarding.browserBoundary).toMatch(
      /não examina hardware, drivers, processos ou jogos/iu,
    );
    expect(accountEn.onboarding.browserBoundary).toMatch(
      /does not inspect hardware, drivers, processes, or games/iu,
    );
    expect(accountPtBr.onboarding.localPrivacy).toMatch(/locais por padrão/iu);
    expect(accountEn.onboarding.localPrivacy).toMatch(/local by default/iu);
    expect(layoutSource).toContain("localizedAuthHref('account-onboarding', locale)");
  });
});

describe('W11 and W12 complete account states', () => {
  it('renders ready responsibility data and degraded recovery without hiding preview provenance', () => {
    expect(getWebScenario('W10').requiredRouteIds).toEqual(ACCOUNT_ENTRY_ROUTE_IDS.slice(0, 3));
    expect(getWebScenario('W11').requiredRouteIds).toEqual(ACCOUNT_ENTRY_ROUTE_IDS.slice(3));
    expect(getWebScenario('W12')).toMatchObject({ terminalState: 'authority-unavailable' });
    expect(featureSource).toContain('data-authority-connected="false"');
    expect(degradedSource).toContain(
      'data-account-state="offline stale expired-session partial-failure"',
    );
    expect(degradedSource).toContain("hrefFor('account-sign-in', content.locale)");
    expect(degradedSource).toContain("hrefFor('account-support', content.locale)");
  });

  it('projects the canonical W12 Overview into an independently renderable offline-stale recovery state', () => {
    expect(scenarioSource).toContain('export const resolveAccountScenarioId');
    expect(featureSource).toContain("if (activeScenarioId === 'W12')");
    expect(degradedSource).toContain(
      'data-account-state="offline stale expired-session partial-failure"',
    );
    expect(degradedSource).toContain('DEGRADED_ACCOUNT_STATE_LABELS');
    expect(accountEn.states.offline).toMatch(/offline/iu);
    expect(accountEn.states.stale).toMatch(/out of date|stale/iu);
    expect(accountEn.states.stale).toMatch(/Reconnect|refresh/iu);
    expect(degradedSource).toContain('<p role="status">');
  });

  it('wires the test-owned W12 capture through the canonical resolver without a selector', () => {
    expect(captureSource).toContain('createW12AccountCaptureProjection = ()');
    expect(captureSource).toContain("resolveAccountScenarioId('account-overview', 'W12')");
    expect(captureSource).toContain('scenarioId,');
    expect(captureSource).not.toMatch(
      /searchParams|process\.env|document\.cookie|localStorage|sessionStorage/iu,
    );
    expect(pageSource).not.toContain('capture/w12');
  });

  it('admits only canonical route-compatible scenarios without exposing a user selector', () => {
    expect(scenarioSource).toContain('getWebScenario(candidate)');
    expect(scenarioSource).toContain('ACCOUNT_SCENARIO_ROUTE_MISMATCH');
    expect(pageSource).not.toMatch(/searchParams|scenarioId|process\.env/u);
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
  it('centers the overview on priority, truthful readiness, and recent activity', () => {
    const overviewSource = sourceBetween('const OverviewPreview', 'const ProfilePreview');

    expect(overviewSource).toContain('account-overview__priority');
    expect(overviewSource).toContain('account-overview__readiness');
    expect(overviewSource).toContain('account-overview__activity');
    expect(overviewSource).not.toContain('account-workspace-split');
    expect(overviewSource).not.toContain('data-workspace-layout="7/5"');
    expect(overviewSource).not.toContain('account-overview__limitations');
    expect(overviewSource).toContain("hrefFor('account-profile', content.locale)");
    expect(overviewSource).toContain("hrefFor('account-security', content.locale)");
    expect(overviewSource).toContain("hrefFor('account-subscription', content.locale)");
    expect(overviewSource).toContain("hrefFor('account-device', content.locale)");
    expect(overviewSource).toContain('readinessItems.map');
    expect(overviewSource).toContain('content.overview.noAuthorityTitle');
    expect(overviewSource).not.toContain('ResponsiveDataTable');
    expect(overviewSource).not.toContain('EmptyComposition');
  });

  it('bounds Profile controls and distinguishes review from unavailable authority', () => {
    const profileSource = sourceBetween('const ProfilePreview', 'export const SecurityMethodList');

    expect(profileSource).toContain('account-profile__editor');
    expect(profileSource).toContain('account-profile__facts');
    expect(profileSource).toContain('account-profile__actions');
    expect(profileSource).toContain('account-workspace-split');
    expect(profileSource).toContain('data-workspace-layout="7/5"');
    expect(profileSource).toContain('content.profile.nameDescription');
    expect(profileSource).toContain('content.profile.authorityState');
    expect(profileSource).toContain('data-authority-action="unavailable"');
    expect(accountStyles).toMatch(/\.account-profile__control\s*\{[\s\S]*max-inline-size:/u);
  });

  it('keeps disconnected behavior quiet and presents a real signed-in account menu', () => {
    expect(layoutSource).not.toContain('<AccountPreviewProvenance');
    expect(layoutSource).not.toContain('className="account-preview-rail"');
    expect(navigationSource).not.toContain('account-preview-slot');
    expect(navigationSource).toContain('className="account-header__account"');
    expect(navigationSource).toContain('{identity}');
    expect(navigationSource).toContain('accountMenuItems');
    expect(featureSource).not.toContain('<ProvenanceLabel');
    expect(featureSource).toContain('<PreviewWorkflow');
  });

  it('keeps the W10 sign-in boundary user-facing and free of implementation ownership', () => {
    expect(accountEn.signIn.security).toBe(
      'Your credentials are sent only over a secure connection and never appear in diagnostics.',
    );
    expect(accountPtBr.signIn.security).toBe(
      'Suas credenciais só são enviadas por uma conexão segura e nunca aparecem em diagnósticos.',
    );
    for (const copy of [accountPtBr.signIn.security, accountEn.signIn.security]) {
      expect(copy).not.toMatch(
        /Phase\s*\d+|Fase\s*\d+|milestone|marco|implementation|implementa(?:ção|r)|\bowns?\b|responsável/iu,
      );
    }
  });

  it('keeps PT-BR and English labels, states, recovery, and limitations equivalent', () => {
    expect(shapeOf(accountPtBr)).toEqual(shapeOf(accountEn));
    for (const content of [accountPtBr, accountEn]) {
      expect(content.overview.nextTitle.length).toBeGreaterThan(0);
      expect(content.overview.summariesTitle.length).toBeGreaterThan(0);
      expect(JSON.stringify(content.overview)).not.toMatch(/Phase\s*[34]|Fase\s*[34]/iu);
      expect(JSON.stringify(content.overview)).not.toMatch(/Preview scope|Escopo da prévia/iu);
      expect(content.overview.emptyBody).not.toMatch(/synthetic|sintético/iu);
      expect(
        [content.subscription.summary, content.device.summary, content.support.summary].join(' '),
      ).not.toMatch(/Phase\s*[34]|Fase\s*[34]|synthetic|sintético|simulated|simulado/iu);
      expect(content.profile.nameDescription.length).toBeGreaterThan(0);
      expect(content.profile.authorityState.length).toBeGreaterThan(0);
      expect(content.profile.limitations.length).toBeGreaterThan(0);
      expect(content.recovery.signIn.length).toBeGreaterThan(0);
      expect(content.recovery.support.length).toBeGreaterThan(0);
    }
  });

  it('explains privacy purpose, availability, retention, sharing, cancellation, and no-change outcomes in human terms', () => {
    for (const content of [accountPtBr, accountEn]) {
      const privacyCopy = JSON.stringify(content.privacy);
      expect(content.privacy.summary).toMatch(/available|dispon(?:i|í)ve/iu);
      expect(content.privacy.purpose.length).toBeGreaterThan(0);
      expect(content.privacy.retention.length).toBeGreaterThan(0);
      expect(content.privacy.sharing.length).toBeGreaterThan(0);
      expect(content.privacy.revocation).toMatch(/cancel/iu);
      expect(content.privacy.revocation).toMatch(/no .*change|nenhum.*muda/iu);
      expect(privacyCopy).not.toMatch(/Phase\s*[34]|Fase\s*[34]/iu);
    }
  });

  it('publishes final plan, one-PC, privacy, download, and support rules in both locales', () => {
    for (const content of [accountPtBr, accountEn]) {
      const subscription = JSON.stringify(content.subscription);
      const device = JSON.stringify(content.device);
      const support = JSON.stringify(content.support);

      expect(subscription).toMatch(/Essential/iu);
      expect(subscription).toMatch(/Premium/iu);
      expect(subscription).toMatch(/29,90|6\.99/iu);
      expect(subscription).toMatch(/seven days|sete dias/iu);
      expect(subscription).toMatch(/through the paid cycle|fim do ciclo pago/iu);
      expect(subscription).toMatch(/30 days|30 dias/iu);
      expect(subscription).toMatch(/history|histórico/iu);
      expect(subscription).toMatch(/restoration|restauração/iu);
      expect(content.subscription.deviceRules).toMatch(/one active PC|um PC ativo/iu);
      expect(device).toMatch(/motherboard|placa-mãe/iu);
      expect(device).toMatch(/support|suporte/iu);
      expect(device).toMatch(/reinstall|reinstalaç/iu);
      expect(content.privacy.telemetry).toMatch(/off by default|desativados por padrão/iu);
      expect(content.downloads.updates).toMatch(/signed|assinados/iu);
      expect(support).toMatch(/72/iu);
      expect(support).toMatch(/24/iu);
      expect(content.invoices.paymentMethods.length).toBeGreaterThan(0);
      expect(content.invoices.billingHelp.length).toBeGreaterThan(0);
    }
    expect(featureSource).not.toMatch(/licenseKey|license-key|input[^\n]+hwid/iu);
    expect(featureSource).toContain("fields: { device: 'protected-device-01' }");
    expect(featureSource).toContain("request === 'telemetry'");
  });

  it('uses the exact 7/5 profile geometry with a field measure no wider than 560px', () => {
    expect(accountStyles).toMatch(
      /\.account-workspace-split\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*7fr\)\s+minmax\(0,\s*5fr\)/u,
    );
    expect(accountStyles).toMatch(
      /\.account-profile__control\s*\{[\s\S]*max-inline-size:\s*min\(100%,\s*560px\)/u,
    );
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
    expect(securitySource).toContain('data-workspace-region="focal"');
    expect(securitySource).toContain('data-workspace-region="context"');
    expect(securitySource).not.toContain('<PreviewBoundary');
    expect(subscriptionSource).toContain('account-responsibility account-subscription');
    expect(subscriptionSource).toContain('account-subscription__workspace');
    expect(subscriptionSource).toContain('data-workspace-region="focal"');
    expect(subscriptionSource).toContain('data-workspace-region="context"');
    expect(subscriptionSource).toContain('account-definition-list');
    expect(subscriptionSource).not.toContain('<PreviewBoundary');
    expect(invoiceSource).toContain('account-responsibility account-invoices');
    expect(invoiceSource).toContain('account-invoices__workspace');
    expect(invoiceSource).toContain('data-workspace-region="focal"');
    expect(invoiceSource).toContain('data-workspace-region="context"');
    expect(invoiceSource).toContain('ResponsiveDataTable');
    expect(deviceSource).toContain('account-responsibility account-device');
    expect(deviceSource).toContain('data-workspace-region="focal"');
    expect(deviceSource).toContain('data-workspace-region="context"');
    expect(deviceSource).toContain('account-sensitive-action');
    expect(downloadsSource).toContain('account-responsibility account-downloads');
    expect(downloadsSource).toContain('data-workspace-region="focal"');
    expect(downloadsSource).toContain('data-workspace-region="context"');
    expect(privacySource).toContain('account-responsibility account-privacy');
    expect(privacySource).toContain('data-workspace-region="focal"');
    expect(privacySource).toContain('data-workspace-region="context"');
    expect(supportSource).toContain('account-responsibility account-support');
    expect(supportSource).toContain('account-support__fields');
    expect(supportSource).toContain('data-workspace-region="focal"');
    expect(supportSource).toContain('data-workspace-region="context"');
    expect(accountStyles).not.toMatch(/box-shadow:\s*0\s+\d+px\s+(?:1[6-9]|[2-9]\d)px/iu);
  });

  it('places each mobile focal task before contextual facts and reflows without page scroll', () => {
    const privacySource = sourceBetween(
      'export const PrivacyCenter',
      'export const SensitiveFieldReview',
    );
    const supportSource = sourceBetween(
      'export const SupportRequestComposer',
      'export type AccountPreviewExperienceProps',
    );

    expect(privacySource.indexOf('<DataRequestReview')).toBeGreaterThanOrEqual(0);
    expect(privacySource.indexOf('<DataRequestReview')).toBeLessThan(
      privacySource.indexOf('<ConsentReview'),
    );
    expect(supportSource.indexOf('account-support__fields')).toBeGreaterThanOrEqual(0);
    expect(supportSource.indexOf('account-support__fields')).toBeLessThan(
      supportSource.indexOf('account-support__guidance'),
    );
    expect(accountStyles).toMatch(
      /@media \(width < 960px\)[\s\S]*\.account-workspace-split\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/u,
    );
    expect(accountStyles).toMatch(/\.account-workspace-split\s*\{[\s\S]*inline-size:\s*100%/u);
  });

  it('keeps privacy review readable inside the three-column account shell', () => {
    expect(accountStyles).toMatch(
      /\.account-privacy__workspace\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/u,
    );
    expect(accountStyles).toMatch(
      /\.account-privacy__context \.account-definition-list\s*\{[\s\S]*repeat\(2,\s*minmax\(0,\s*1fr\)\)/u,
    );
    expect(accountStyles).toMatch(
      /@media \(width < 760px\)[\s\S]*\.account-privacy__context \.account-definition-list[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/u,
    );
  });

  it('composes W10 as a focused two-region entry gateway before mobile reflow', () => {
    expect(accountStyles).toMatch(
      /\.lb-web-sign-in\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*0\.9fr\)\s+minmax\(360px,\s*1\.1fr\)/u,
    );
    expect(accountStyles).toMatch(
      /\.lb-web-sign-in > \.lb-web-boundary\s*\{[\s\S]*grid-column:\s*1[\s\S]*grid-row:\s*2 \/ span 2/u,
    );
  });

  it('keeps every deterministic degraded and terminal path explicit and bilingual', () => {
    expect(featureSource).toContain("'loading'");
    expect(featureSource).toContain('LbSkeletonRegion');
    expect(featureSource).toContain('state?: AccountPreviewState');
    expect(featureSource).toContain("state = 'ready'");
    expect(featureSource).toContain("if (state === 'loading')");
    expect(featureSource).toContain("if (state === 'empty')");
    expect(degradedSource).toContain('DEGRADED_ACCOUNT_STATE_LABELS');
    expect(featureSource).not.toContain("label={state === 'failure' ? 'Failure' : state}");
    expect(featureSource).toContain('data-account-state="empty"');
    expect(degradedSource).toContain(
      'data-account-state="offline stale expired-session partial-failure"',
    );
    expect(featureSource).toContain('PreviewWorkflow');
    expect(featureSource).toContain('safeDraftFields');
    expect(featureSource).toContain('PreviewReceipt');
    expect(shapeOf(accountPtBr)).toEqual(shapeOf(accountEn));
  });

  it('retains only explicitly safe drafts across degraded sensitive workflows', () => {
    const profileSource = sourceBetween('const ProfilePreview', 'export const SecurityMethodList');
    const deviceSource = sourceBetween(
      'export const DeviceBindingReview',
      'export const DownloadsPreview',
    );
    const privacySource = sourceBetween(
      'export const PrivacyCenter',
      'export const SensitiveFieldReview',
    );
    const supportSource = sourceBetween(
      'export const SupportRequestComposer',
      'export type AccountPreviewExperienceProps',
    );

    expect(profileSource).toContain("safeDraftFields: ['displayName', 'locale']");
    expect(deviceSource).not.toContain('safeDraftFields:');
    expect(privacySource).not.toContain('safeDraftFields:');
    expect(supportSource).toContain('fields: { description, subject }');
    expect(supportSource).toContain("safeDraftFields: ['subject']");
    expect(supportSource).not.toContain("safeDraftFields: ['description'");
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
