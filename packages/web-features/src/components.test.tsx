/// <reference lib="dom" />
import { Children, isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';
// @ts-expect-error Node built-in types are intentionally not part of the browser package contract.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BoundaryTransitionNotice,
  EvidenceDisclosure,
  FilterBar,
  NoChangeReceipt,
  ProvenanceLabel,
  ResponsiveDataTable,
  StatusSignal,
  VerificationReceipt,
  WEB_PROVENANCE_KINDS,
  WEB_STATUS_STATES,
} from './components.tsx';
import {
  AccountPreviewRail,
  AccountShell,
  AdminShell,
  AdminViewportGate,
  PublicFooter,
  PublicHeader,
  PublicShell,
  RoleScopeRail,
} from './shells.tsx';
import * as storyCatalog from './components.stories.tsx';
import { WEB_STORY_AXES } from './components.stories.tsx';

const readUtf8File = readFileSync as (path: URL, encoding: 'utf8') => string;

type ReviewSurface = 'public' | 'account' | 'admin';

type VisualManifestEntry = Readonly<{
  captureId: string;
  comparisonSource: string;
  locale: 'pt-BR' | 'en';
  localeReview: 'pt-BR-default' | 'en-parity';
  rebaselineOwner: 'plan-03-42' | 'plan-03-43' | 'plan-03-44';
  reviewPurpose: string;
  route: string;
  routeId: string;
  state: string;
  surface: ReviewSurface;
  viewport: string;
}>;

const visualManifest = JSON.parse(
  readUtf8File(
    new URL('../../../tooling/web-evidence/visual-manifest.json', import.meta.url),
    'utf8',
  ),
) as Readonly<{
  entries: readonly VisualManifestEntry[];
  schemaVersion: number;
}>;

const styleSources = Object.freeze([
  {
    files: [
      {
        source: 'apps/web/src/app/public-shell.css',
        url: new URL('../../../apps/web/src/app/public-shell.css', import.meta.url),
      },
      {
        source: 'apps/web/src/styles/public.css',
        url: new URL('../../../apps/web/src/styles/public.css', import.meta.url),
      },
    ],
    surface: 'public',
  },
  {
    files: [
      {
        source: 'apps/account/src/app/account-shell.css',
        url: new URL('../../../apps/account/src/app/account-shell.css', import.meta.url),
      },
    ],
    surface: 'account',
  },
  {
    files: [
      {
        source: 'apps/admin/src/app/admin-shell.css',
        url: new URL('../../../apps/admin/src/app/admin-shell.css', import.meta.url),
      },
    ],
    surface: 'admin',
  },
] as const);

const CANONICAL_TYPE_PIXELS = new Set([13, 15, 20, 28]);
const CANONICAL_SPACE_PIXELS = new Set([0, 4, 8, 16, 24, 32, 48, 64]);

type TokenViolation = Readonly<{
  property: string;
  source: string;
  surface: ReviewSurface | 'shared';
  value: string;
}>;

const tokenViolations = (
  css: string,
  surface: TokenViolation['surface'],
  source: string,
): readonly TokenViolation[] => {
  const violations: TokenViolation[] = [];
  const declarationPattern =
    /(?<property>font-size|gap|margin(?:-(?:block|inline)(?:-(?:start|end))?)?|padding(?:-(?:block|inline)(?:-(?:start|end))?)?):\s*(?<value>[^;]+);/gu;

  for (const match of css.matchAll(declarationPattern)) {
    const property = match.groups?.['property'];
    const value = match.groups?.['value']?.trim();
    if (property === undefined || value === undefined) continue;

    const allowedPixels = property === 'font-size' ? CANONICAL_TYPE_PIXELS : CANONICAL_SPACE_PIXELS;
    const pixels = [...value.matchAll(/(?<pixels>\d+(?:\.\d+)?)px/gu)].map(({ groups }) =>
      Number(groups?.['pixels']),
    );
    if (pixels.some((pixels_) => !allowedPixels.has(pixels_))) {
      violations.push({ property, source, surface, value });
    }
  }

  return violations;
};

const TOKEN_MIGRATION_LEDGER = Object.freeze([
  {
    owner: 'plan-03-38',
    property: 'padding-block-start',
    source: 'apps/web/src/app/public-shell.css',
    surface: 'public',
    value: '144px',
  },
  {
    owner: 'plan-03-38',
    property: 'padding',
    source: 'apps/web/src/app/public-shell.css',
    surface: 'public',
    value: '11px var(--lb-space-2)',
  },
  {
    owner: 'plan-03-38',
    property: 'margin-block-start',
    source: 'apps/web/src/app/public-shell.css',
    surface: 'public',
    value: '144px',
  },
  {
    owner: 'plan-03-38',
    property: 'padding-block',
    source: 'apps/web/src/app/public-shell.css',
    surface: 'public',
    value: '10px',
  },
  {
    owner: 'plan-03-38',
    property: 'font-size',
    source: 'apps/web/src/app/public-shell.css',
    surface: 'public',
    value: '64px',
  },
  {
    owner: 'plan-03-38',
    property: 'font-size',
    source: 'apps/web/src/app/public-shell.css',
    surface: 'public',
    value: 'clamp(32px, 5vw, 56px)',
  },
  {
    owner: 'plan-03-38',
    property: 'padding-block-start',
    source: 'apps/web/src/app/public-shell.css',
    surface: 'public',
    value: '124px',
  },
  {
    owner: 'plan-03-38',
    property: 'font-size',
    source: 'apps/web/src/app/public-shell.css',
    surface: 'public',
    value: '48px',
  },
  {
    owner: 'plan-03-38',
    property: 'padding',
    source: 'apps/web/src/styles/public.css',
    surface: 'public',
    value: 'clamp(var(--lb-space-6), 8vw, 112px) var(--lb-screen-padding)',
  },
  {
    owner: 'plan-03-38',
    property: 'font-size',
    source: 'apps/web/src/styles/public.css',
    surface: 'public',
    value: 'clamp(44px, 6vw, 88px)',
  },
  {
    owner: 'plan-03-38',
    property: 'font-size',
    source: 'apps/web/src/styles/public.css',
    surface: 'public',
    value: 'clamp(18px, 1.8vw, 22px)',
  },
  {
    owner: 'plan-03-38',
    property: 'font-size',
    source: 'apps/web/src/styles/public.css',
    surface: 'public',
    value: 'clamp(28px, 4vw, 48px)',
  },
  {
    owner: 'plan-03-38',
    property: 'padding',
    source: 'apps/web/src/styles/public.css',
    surface: 'public',
    value: 'clamp(80px, 10vw, 144px) var(--lb-screen-padding)',
  },
  {
    owner: 'plan-03-38',
    property: 'gap',
    source: 'apps/web/src/styles/public.css',
    surface: 'public',
    value: 'var(--lb-space-4) clamp(var(--lb-space-5), 8vw, 112px)',
  },
  {
    owner: 'plan-03-38',
    property: 'padding-block-end',
    source: 'apps/web/src/styles/public.css',
    surface: 'public',
    value: 'clamp(var(--lb-space-6), 8vw, 96px)',
  },
  {
    owner: 'plan-03-38',
    property: 'font-size',
    source: 'apps/web/src/styles/public.css',
    surface: 'public',
    value: 'clamp(36px, 5vw, 68px)',
  },
  {
    owner: 'plan-03-38',
    property: 'font-size',
    source: 'apps/web/src/styles/public.css',
    surface: 'public',
    value: '18px',
  },
  {
    owner: 'plan-03-38',
    property: 'gap',
    source: 'apps/web/src/styles/public.css',
    surface: 'public',
    value: 'var(--lb-space-5) clamp(var(--lb-space-5), 7vw, 96px)',
  },
  {
    owner: 'plan-03-38',
    property: 'padding-block',
    source: 'apps/web/src/styles/public.css',
    surface: 'public',
    value: 'clamp(var(--lb-space-6), 8vw, 96px)',
  },
  {
    owner: 'plan-03-38',
    property: 'font-size',
    source: 'apps/web/src/styles/public.css',
    surface: 'public',
    value: 'clamp(30px, 4vw, 52px)',
  },
  {
    owner: 'plan-03-38',
    property: 'font-size',
    source: 'apps/web/src/styles/public.css',
    surface: 'public',
    value: 'clamp(22px, 2.4vw, 32px)',
  },
  {
    owner: 'plan-03-38',
    property: 'gap',
    source: 'apps/web/src/styles/public.css',
    surface: 'public',
    value: 'var(--lb-space-5) clamp(var(--lb-space-5), 8vw, 112px)',
  },
  {
    owner: 'plan-03-38',
    property: 'padding',
    source: 'apps/web/src/styles/public.css',
    surface: 'public',
    value: 'clamp(var(--lb-space-6), 8vw, 96px) var(--lb-screen-padding)',
  },
  {
    owner: 'plan-03-38',
    property: 'font-size',
    source: 'apps/web/src/styles/public.css',
    surface: 'public',
    value: 'clamp(34px, 5vw, 64px)',
  },
  {
    owner: 'plan-03-38',
    property: 'font-size',
    source: 'apps/web/src/styles/public.css',
    surface: 'public',
    value: 'clamp(42px, 10vw, 72px)',
  },
  {
    owner: 'plan-03-38',
    property: 'font-size',
    source: 'apps/web/src/styles/public.css',
    surface: 'public',
    value: 'clamp(38px, 13vw, 58px)',
  },
  {
    owner: 'plan-03-38',
    property: 'font-size',
    source: 'apps/web/src/styles/public.css',
    surface: 'public',
    value: 'clamp(40px, 6vw, 72px)',
  },
  {
    owner: 'plan-03-38',
    property: 'font-size',
    source: 'apps/web/src/styles/public.css',
    surface: 'public',
    value: 'clamp(36px, 5vw, 64px)',
  },
  {
    owner: 'plan-03-38',
    property: 'font-size',
    source: 'apps/web/src/styles/public.css',
    surface: 'public',
    value: '18px',
  },
  {
    owner: 'plan-03-39',
    property: 'padding-block-start',
    source: 'apps/account/src/app/account-shell.css',
    surface: 'account',
    value: '152px',
  },
  {
    owner: 'plan-03-39',
    property: 'margin-block-start',
    source: 'apps/account/src/app/account-shell.css',
    surface: 'account',
    value: '152px',
  },
  {
    owner: 'plan-03-39',
    property: 'font-size',
    source: 'apps/account/src/app/account-shell.css',
    surface: 'account',
    value: '64px',
  },
] as const);

// Resolved entries remain immutable audit history; only unresolved owners are admitted by the gate.
const KNOWN_TOKEN_MIGRATION_DEBT = Object.freeze(
  TOKEN_MIGRATION_LEDGER.filter(({ owner }) => owner !== 'plan-03-38' && owner !== 'plan-03-39'),
);

const elementProps = (element: ReactElement): Readonly<Record<string, unknown>> =>
  element.props as Readonly<Record<string, unknown>>;

const intrinsicTags = (node: ReactNode): readonly string[] => {
  const tags: string[] = [];
  const visit = (candidate: ReactNode) => {
    if (!isValidElement(candidate)) {
      return;
    }
    if (typeof candidate.type === 'string') {
      tags.push(candidate.type);
    }
    Children.forEach(elementProps(candidate)['children'] as ReactNode, visit);
  };
  visit(node);
  return tags;
};

const relativeLuminance = (hex: string): number => {
  const channels = hex
    .replace('#', '')
    .match(/.{2}/gu)
    ?.map((channel) => Number.parseInt(channel, 16) / 255);
  if (channels?.length !== 3) {
    throw new Error(`Invalid color: ${hex}`);
  }
  const linear = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * (linear[0] ?? 0) + 0.7152 * (linear[1] ?? 0) + 0.0722 * (linear[2] ?? 0);
};

const contrastRatio = (foreground: string, background: string): number => {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
};

const navigation = Object.freeze([
  { href: '/product', id: 'product', label: 'Product' },
  { href: '/docs', id: 'docs', label: 'Documentation' },
]);

describe('semantic web components', () => {
  it('projects every state and provenance with persistent text and non-color signals', () => {
    for (const state of WEB_STATUS_STATES) {
      const status = StatusSignal({ detail: 'State detail', state });
      const props = elementProps(status);
      expect(props['data-state']).toBe(state);
      expect(props['data-pattern']).toBeTruthy();
      expect(props['role']).toMatch(/^(?:status|alert)$/u);
    }

    for (const kind of WEB_PROVENANCE_KINDS) {
      const provenance = ProvenanceLabel({ kind });
      expect(elementProps(provenance)['data-provenance']).toBe(kind);
    }
  });

  it('uses semantic disclosure, filtering, table detail, boundary, and receipt structures', () => {
    const filter = FilterBar({
      children: (
        <label>
          Query
          <input name="query" />
        </label>
      ),
    });
    const disclosure = EvidenceDisclosure({
      children: 'Source detail',
      label: 'Evidence',
      provenance: 'measured',
    });
    const table = ResponsiveDataTable({
      caption: 'Release integrity',
      columns: [
        { id: 'version', label: 'Version' },
        { essential: false, id: 'hash', label: 'SHA-256' },
      ],
      rows: [
        {
          cells: { hash: 'a'.repeat(64), version: '1.0.0' },
          detail: <p>Complete manifest detail</p>,
          id: 'release-1',
        },
      ],
    });
    const boundary = BoundaryTransitionNotice({
      description: 'Authority changes here.',
      title: 'Boundary',
    });
    const receipt = NoChangeReceipt({
      authority: 'Phase 4 authority',
      receiptId: 'receipt-03-18',
      reviewedObject: 'device',
    });

    expect(elementProps(filter)['role']).toBe('search');
    expect(disclosure.type).toBe('details');
    expect(intrinsicTags(table)).toEqual(
      expect.arrayContaining(['div', 'table', 'caption', 'thead', 'tbody', 'th', 'td']),
    );
    expect(elementProps(boundary)['role']).toBe('note');
    expect(receipt.type).toBe(VerificationReceipt);
    expect(elementProps(receipt)['changed']).toBe(false);
  });

  it('keeps public, account, and admin shells semantically distinct', () => {
    const publicShell = PublicShell({
      children: 'Public content',
      footer: PublicFooter({
        legal: <small>Policy reviewed</small>,
        navigation,
        status: <span>All systems operational</span>,
      }),
      header: PublicHeader({
        cta: <a href="/compatibility">Check compatibility</a>,
        localeControl: <button type="button">English</button>,
        navigation,
        search: <input aria-label="Search" />,
      }),
    });
    const accountShell = AccountShell({
      children: 'Account responsibility',
      header: <header>Account</header>,
      navigation,
      previewRail: AccountPreviewRail({}),
    });
    const adminShell = AdminShell({
      children: AdminViewportGate({
        children: 'Safe review',
        highRiskAction: <button type="button">Review action</button>,
      }),
      header: <header>Administration</header>,
      navigation,
      roleRail: RoleScopeRail({ role: 'Support', scope: ['Cases'] }),
    });

    expect(elementProps(publicShell)['data-register']).toBe('brand');
    expect(intrinsicTags(publicShell)).toContain('main');
    expect(elementProps(accountShell)['data-register']).toBe('product');
    expect(intrinsicTags(accountShell)).toEqual(expect.arrayContaining(['nav', 'main']));
    expect(elementProps(adminShell)['data-register']).toBe('product');
    expect(intrinsicTags(adminShell)).toEqual(expect.arrayContaining(['nav', 'main']));
  });
});

describe('visual contract and story axes', () => {
  it('lists and imports every Storybook catalog composition as a smoke gate', () => {
    expect(Object.keys(storyCatalog).sort()).toEqual([
      'AccessibilityModes',
      'InteractionStates',
      'LocaleCatalog',
      'ProvenanceCatalog',
      'ResponsiveTableCatalog',
      'StateCatalog',
      'ViewportCatalog',
      'WEB_STORY_AXES',
      'default',
    ]);
    for (const storyName of [
      'AccessibilityModes',
      'InteractionStates',
      'LocaleCatalog',
      'ProvenanceCatalog',
      'ResponsiveTableCatalog',
      'StateCatalog',
      'ViewportCatalog',
    ] as const) {
      expect(storyCatalog[storyName]).toBeTypeOf('function');
    }
  });

  it('enumerates every locked state, locale, viewport, preference, and interaction axis', () => {
    expect(WEB_STORY_AXES.interaction).toEqual([
      'default',
      'hover',
      'focus-visible',
      'pressed',
      'disabled',
      'loading',
    ]);
    expect(WEB_STORY_AXES.state).toEqual(WEB_STATUS_STATES);
    expect(WEB_STORY_AXES.locale).toEqual(['pt-BR', 'en', 'pseudo']);
    expect(WEB_STORY_AXES.viewport).toEqual([320, 390, 768, 960, 1440]);
    expect(WEB_STORY_AXES.preference).toEqual([
      'default',
      'reduced-motion',
      'forced-colors',
      'keyboard',
      'screen-reader',
    ]);
  });

  it('uses approved tokens, responsive gates, and anti-template constraints', () => {
    const css = readUtf8File(new URL('./web.css', import.meta.url), 'utf8');
    expect(css).toContain('var(--lb-space-7)');
    expect(css).toContain('var(--lb-radius-default)');
    expect(css).toContain('var(--lb-layer-modal)');
    expect(css).toContain('@media (width < 640px)');
    expect(css).toContain('@media (width < 960px)');
    expect(css).toContain('@media (width < 1280px)');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('@media (forced-colors: active)');
    expect(css).toContain('min-block-size: var(--lb-control-min-size)');
    expect(css).toContain('max-inline-size: 75ch');
    expect(css).toContain('max-inline-size: 68ch');
    expect(css).toContain('overflow-x: auto');
    expect(css).toContain("[data-essential='false']");
    expect(css).not.toMatch(/linear-gradient|radial-gradient|repeating-linear-gradient/iu);
    expect(css).not.toMatch(/border-radius:\s*(?:2[4-9]|[3-9]\d)px/iu);
    expect(css).not.toMatch(/z-index:\s*\d+/iu);
    expect(css).not.toMatch(/box-shadow:/iu);
  });

  it('enforces the canonical type and spacing scales across shared and app-local CSS', () => {
    const sources = [
      {
        css: readUtf8File(new URL('./web.css', import.meta.url), 'utf8'),
        source: 'packages/web-features/src/web.css',
        surface: 'shared' as const,
      },
      ...styleSources.flatMap(({ files, surface }) =>
        files.map(({ source, url }) => ({ css: readUtf8File(url, 'utf8'), source, surface })),
      ),
    ];

    const admittedDebt = KNOWN_TOKEN_MIGRATION_DEBT.map(
      ({ owner: _owner, ...violation }) => violation,
    );
    expect(
      sources.flatMap(({ css, source, surface }) => tokenViolations(css, surface, source)),
    ).toEqual(admittedDebt);
    expect(
      KNOWN_TOKEN_MIGRATION_DEBT.every(({ owner }) => /^plan-03-(?:38|39|41)$/u.test(owner)),
    ).toBe(true);
  });

  it('binds W01-W18 and G01-G07 to complete qualitative-review metadata', () => {
    const expectedCaptureIds = [
      ...Array.from({ length: 18 }, (_, index) => `W${String(index + 1).padStart(2, '0')}`),
      ...Array.from({ length: 7 }, (_, index) => `G${String(index + 1).padStart(2, '0')}`),
    ];

    expect(visualManifest.schemaVersion).toBe(2);
    expect(visualManifest.entries.map(({ captureId }) => captureId)).toEqual(expectedCaptureIds);

    for (const entry of visualManifest.entries) {
      expect(entry).toMatchObject({
        comparisonSource: 'phase-02-approved-desktop-captures',
        rebaselineOwner:
          entry.surface === 'public'
            ? 'plan-03-42'
            : entry.surface === 'account'
              ? 'plan-03-43'
              : 'plan-03-44',
      });
      expect(entry.route).toMatch(new RegExp(`^/${entry.locale}(?:/|$)`, 'u'));
      expect(entry.reviewPurpose.length).toBeGreaterThan(12);
      expect(entry.state.length).toBeGreaterThan(0);
    }

    for (const surface of ['public', 'account', 'admin'] as const) {
      const entries = visualManifest.entries.filter((entry) => entry.surface === surface);
      expect(entries.map(({ localeReview }) => localeReview)).toEqual(
        expect.arrayContaining(['pt-BR-default', 'en-parity']),
      );
      expect(entries.some(({ viewport }) => viewport.startsWith('1440'))).toBe(true);
      expect(entries.some(({ viewport }) => viewport.startsWith('390'))).toBe(true);
    }
  });

  it('meets the locked AA contrast floor for primary and secondary copy', () => {
    expect(contrastRatio('#F4F7FB', '#090B0F')).toBeGreaterThanOrEqual(7);
    expect(contrastRatio('#AAB4C4', '#090B0F')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#AAB4C4', '#121722')).toBeGreaterThanOrEqual(4.5);
  });
});
