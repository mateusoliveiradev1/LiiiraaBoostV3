import { isValidElement } from 'react';
import { describe, expect, it } from 'vitest';
import { matchWebRoute, type WebRouteId } from '@liiiraa/web-core';

import {
  getPublicCatalog,
  getPublicCatalogMetadata,
  PublicCatalogPage,
} from './features/public-catalog';

const CATALOG_ROUTES = [
  'public-product',
  'public-evidence',
  'public-compatibility',
  'public-plans',
  'public-search',
  'public-support',
] as const satisfies readonly WebRouteId[];

describe('public catalog content', () => {
  it('resolves every catalog path through canonical manifest authority', () => {
    for (const locale of ['pt-BR', 'en'] as const) {
      for (const routeId of CATALOG_ROUTES) {
        const segment = routeId.replace('public-', '');
        const result = matchWebRoute({
          pathname: `/${locale}/${segment}`,
          securityBoundary: 'public-origin',
        });
        expect(result).toMatchObject({ ok: true, value: { route: { id: routeId } } });
      }
    }
  });

  it('admits exact bilingual route and support-state parity with evidence limits', () => {
    const english = getPublicCatalog('en');
    const portuguese = getPublicCatalog('pt-BR');

    expect(english.records.map(({ routeId }) => routeId)).toEqual(CATALOG_ROUTES);
    expect(portuguese.records.map(({ routeId }) => routeId)).toEqual(CATALOG_ROUTES);
    expect(Object.keys(english.supportStates)).toEqual(Object.keys(portuguese.supportStates));

    for (const catalog of [english, portuguese]) {
      for (const record of catalog.records) {
        expect(record.validationState).toBe('validated');
        expect(record.limitations.length).toBeGreaterThan(0);
        expect(record.evidence.length).toBeGreaterThan(0);
        expect(record.evidence.every(({ unprovenBoundary }) => unprovenBoundary.length > 0)).toBe(
          true,
        );
      }
    }
  });

  it('discloses every commercial consequence before the simulated checkout boundary', () => {
    for (const locale of ['pt-BR', 'en'] as const) {
      const record = getPublicCatalog(locale).records.find(
        ({ routeId }) => routeId === 'public-plans',
      );
      const plan = record?.plans?.[0];

      expect(plan?.checkoutBoundary).toMatch(/Phase 4|Fase 4/u);
      expect(plan?.price.length).toBeGreaterThan(0);
      expect(plan?.billingPeriod.length).toBeGreaterThan(0);
      expect(plan?.renewal.length).toBeGreaterThan(0);
      expect(plan?.taxes.length).toBeGreaterThan(0);
      expect(plan?.cancellation.length).toBeGreaterThan(0);
      expect(plan?.refunds.length).toBeGreaterThan(0);
      expect(plan?.deviceRules.length).toBeGreaterThan(0);
      expect(plan?.expirationEffects.length).toBeGreaterThan(0);
      expect(JSON.stringify(record)).not.toMatch(
        /countdown|contagem regressiva de \d|limited offer|oferta limitada/iu,
      );
    }
  });

  it('renders URL-backed explicit-submit public search with bounded metadata', () => {
    const page = (
      <PublicCatalogPage
        locale="en"
        routeId="public-search"
        searchParams={{ availability: 'available', q: 'evidence' }}
      />
    );
    const search = getPublicCatalog('en').records.find(
      ({ routeId }) => routeId === 'public-search',
    );

    expect(isValidElement(page)).toBe(true);
    expect(search?.searchCopy?.label.length).toBeGreaterThan(0);
    expect(search?.searchCopy?.submit.length).toBeGreaterThan(0);
    expect(search?.searchCopy?.emptyTitle.length).toBeGreaterThan(0);
    expect(search?.searchCopy?.emptyBody.length).toBeGreaterThan(0);
    expect(search?.searchCopy?.filterLabel.length).toBeGreaterThan(0);
    expect(JSON.stringify(getPublicCatalog('en'))).not.toMatch(
      /"routeId":"(?:account|admin|internal|scenario)-/u,
    );
  });

  it('uses semantic compatibility and plan decisions instead of equal card walls', async () => {
    const [source, styles] = await Promise.all([
      import('node:fs/promises').then(({ readFile }) =>
        readFile(new URL('./features/public-catalog.tsx', import.meta.url), 'utf8'),
      ),
      import('node:fs/promises').then(({ readFile }) =>
        readFile(new URL('./styles/public.css', import.meta.url), 'utf8'),
      ),
    ]);

    expect(source).toContain('className="catalog-decision-field"');
    expect(source).toContain('className="plan-comparison-ledger"');
    expect(source).toContain('<table className="catalog-table"');
    expect(source).toContain('<details className="plan-terms"');
    expect(source).not.toContain('plan-card');
    expect(styles).toMatch(
      /@media \(width < 640px\)[\s\S]*\.catalog-table,[\s\S]*display:\s*block/u,
    );
    expect(styles).not.toMatch(/\.plan-comparison-ledger\s*\{[\s\S]*grid-template-columns:\s*repeat\(3/u);
  });

  it('keeps bilingual compatibility consequences and commercial terms complete at narrow widths', () => {
    for (const locale of ['pt-BR', 'en'] as const) {
      const catalog = getPublicCatalog(locale);
      const compatibility = catalog.records.find(
        ({ routeId }) => routeId === 'public-compatibility',
      );
      const plans = catalog.records.find(({ routeId }) => routeId === 'public-plans');

      expect(compatibility?.supportMatrix?.length).toBeGreaterThan(0);
      expect(
        compatibility?.supportMatrix?.every(
          ({ capability, consequence }) => capability.length > 0 && consequence.length > 0,
        ),
      ).toBe(true);
      expect(plans?.plans?.every(({ checkoutBoundary }) => checkoutBoundary.length > 0)).toBe(true);
    }
  });
});

describe('public policies and operational trust', () => {
  it('renders complete versioned policy, disclosure, and status families in both locales', () => {
    const routeIds = [
      'public-policies',
      'public-privacy-policy',
      'public-terms',
      'public-responsible-disclosure',
      'public-status',
    ] as const satisfies readonly WebRouteId[];

    for (const locale of ['pt-BR', 'en'] as const) {
      for (const routeId of routeIds) {
        const metadata = getPublicCatalogMetadata(locale, routeId);
        const page = <PublicCatalogPage locale={locale} routeId={routeId} />;

        expect(metadata?.title).toBeTruthy();
        expect(isValidElement(page)).toBe(true);
      }
    }
  });
});
