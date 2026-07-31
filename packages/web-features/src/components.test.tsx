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

  it('meets the locked AA contrast floor for primary and secondary copy', () => {
    expect(contrastRatio('#F4F7FB', '#090B0F')).toBeGreaterThanOrEqual(7);
    expect(contrastRatio('#AAB4C4', '#090B0F')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#AAB4C4', '#121722')).toBeGreaterThanOrEqual(4.5);
  });
});
