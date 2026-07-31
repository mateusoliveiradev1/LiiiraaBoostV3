/// <reference lib="dom" />
import { Children, isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';
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
} from './components.js';
import {
  AccountPreviewRail,
  AccountShell,
  AdminShell,
  AdminViewportGate,
  PublicFooter,
  PublicHeader,
  PublicShell,
  RoleScopeRail,
} from './shells.js';

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
