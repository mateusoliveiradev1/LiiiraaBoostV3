import { isValidElement, type ReactNode } from 'react';
// @ts-expect-error The approved runtime includes react-dom, but @types/react-dom is not an approved identity.
import { renderToStaticMarkup as reactRenderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { matchWebRoute, type WebRouteId } from '@liiiraa/web-core';

import {
  getPublicCatalog,
  getPublicCatalogMetadata,
  PublicCatalogPage,
} from './features/public-catalog';

const renderToStaticMarkup = reactRenderToStaticMarkup as (node: ReactNode) => string;
const visibleText = (markup: string): string =>
  markup
    .replace(/<[^>]+>/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();

const CATALOG_ROUTES = [
  'public-product',
  'public-evidence',
  'public-compatibility',
  'public-plans',
  'public-search',
  'public-support',
] as const satisfies readonly WebRouteId[];

describe('public catalog content', () => {
  it.each([
    ['pt-BR', 'public-product', 'Ver como funciona'],
    ['pt-BR', 'public-evidence', 'Ver como medimos'],
    ['pt-BR', 'public-compatibility', 'Checar meu PC'],
    ['pt-BR', 'public-plans', 'Continuar com Premium'],
    ['en', 'public-product', 'See how it works'],
    ['en', 'public-evidence', 'See how we measure'],
    ['en', 'public-compatibility', 'Check my PC'],
    ['en', 'public-plans', 'Continue with Premium'],
  ] as const)(
    'leads %s %s with a route-specific visitor outcome and next action',
    (locale, routeId, action) => {
      const markup = renderToStaticMarkup(<PublicCatalogPage locale={locale} routeId={routeId} />);
      const introduction = markup.slice(0, markup.indexOf('catalog-introduction__provenance'));

      expect(markup).toContain(`data-route-purpose="${routeId}"`);
      expect(markup).toContain('catalog-primary-action');
      expect(visibleText(markup)).toContain(action);
      expect(visibleText(introduction)).not.toMatch(
        /\b(?:Fase|Phase|authority|autoridade|manifest|manifesto|validation state|estado de validação|implementation|implementação)\b/iu,
      );
    },
  );

  it('keeps internal implementation chronology out of bilingual visitor content', () => {
    for (const locale of ['pt-BR', 'en'] as const) {
      const catalog = getPublicCatalog(locale);
      expect(JSON.stringify(catalog)).not.toMatch(/\b(?:Fase|Phase)\s+[0-9]+\b/iu);
    }
  });

  it('frames the four discovery routes in player language before technical detail', () => {
    const expected = [
      ['pt-BR', 'public-product', 'Mais desempenho para jogar, sem perder o controle'],
      ['pt-BR', 'public-evidence', 'Resultados que você consegue conferir'],
      ['pt-BR', 'public-compatibility', 'Seu PC é compatível?'],
      ['pt-BR', 'public-plans', 'O plano para jogar com mais controle'],
      ['en', 'public-product', 'More gaming performance without giving up control'],
      ['en', 'public-evidence', 'Results you can verify'],
      ['en', 'public-compatibility', 'Is your PC compatible?'],
      ['en', 'public-plans', 'The plan for gaming with more control'],
    ] as const;

    for (const [locale, routeId, heading] of expected) {
      const markup = renderToStaticMarkup(<PublicCatalogPage locale={locale} routeId={routeId} />);
      expect(visibleText(markup)).toContain(heading);
    }

    const compatibility = renderToStaticMarkup(
      <PublicCatalogPage locale="pt-BR" routeId="public-compatibility" />,
    );
    expect(visibleText(compatibility)).toContain('O que já podemos verificar');
    expect(visibleText(compatibility)).toContain('O que isso significa');
    expect(visibleText(compatibility)).not.toContain('Matriz de suporte e consequência');
  });

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

      expect(plan?.checkoutBoundary).toMatch(/compra|purchase/iu);
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

  it('renders a purchase-ready Premium offer without pretending checkout authority exists', () => {
    for (const locale of ['pt-BR', 'en'] as const) {
      const markup = renderToStaticMarkup(
        <PublicCatalogPage locale={locale} routeId="public-plans" />,
      );

      expect(markup).toContain('class="plan-purchase-stage"');
      expect(markup).toMatch(/class="[^"]*\bplan-offer\b/u);
      expect(markup).toContain('class="plan-price"');
      expect(markup).toContain('data-checkout-authority="disconnected"');
      expect(markup).toContain('data-icon-library="phosphor"');
      expect(visibleText(markup)).toContain(locale === 'pt-BR' ? 'R$ 29,90' : 'R$29.90');
      expect(visibleText(markup)).toContain(locale === 'pt-BR' ? 'por mês' : 'per month');
      expect(visibleText(markup)).toContain(
        locale === 'pt-BR' ? 'Continuar com Premium' : 'Continue with Premium',
      );
      expect(markup).toContain(`href="https://account.liiiraa.com/${locale}/sign-in"`);
      expect(visibleText(markup)).not.toContain(
        locale === 'pt-BR' ? 'Não está à venda' : 'Not for sale',
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
    expect(source).toContain('className="plan-purchase-stage"');
    expect(source).toContain('<PublicProductIcon');
    expect(source).toContain('<table className="catalog-table"');
    expect(source).toContain('<details className="plan-terms"');
    expect(source).not.toContain('plan-card');
    expect(styles).toMatch(
      /@media \(width < 640px\)[\s\S]*\.catalog-table,[\s\S]*display:\s*block/u,
    );
    expect(styles).not.toMatch(
      /\.plan-comparison-ledger\s*\{[^}]*grid-template-columns:\s*repeat\(3/u,
    );
    expect(styles).toMatch(
      /\.plan-purchase-stage\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1\.15fr\) minmax\(280px, 0\.85fr\)/u,
    );
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

  it('renders W09 with localized human status instead of fixture and enum language', () => {
    const markup = renderToStaticMarkup(
      <PublicCatalogPage locale="pt-BR" routeId="public-status" />,
    );

    expect(markup).toContain('Prévia demonstrativa');
    expect(markup).toContain('sem alterar dados ou ações remotas');
    expect(markup).not.toContain('As prévias da Fase 3');
    expect(markup).not.toMatch(/>demonstrative-preview</u);
  });
});
