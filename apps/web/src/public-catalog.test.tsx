import { isValidElement, type ReactNode } from 'react';
// @ts-expect-error The approved runtime includes react-dom, but @types/react-dom is not an approved identity.
import { renderToStaticMarkup as reactRenderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { matchWebRoute, type WebRouteId } from '@liiiraa/web-core';

import {
  getPublicCatalog,
  getPublicCatalogMetadata,
  getPublicPolicies,
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
  'public-results',
  'public-compatibility',
  'public-plans',
  'public-search',
  'public-support',
] as const satisfies readonly WebRouteId[];

describe('public catalog content', () => {
  it.each([
    ['pt-BR', 'public-product', 'Ver como funciona'],
    ['pt-BR', 'public-results', 'Ver como medimos'],
    ['pt-BR', 'public-compatibility', 'Baixar app grátis'],
    ['pt-BR', 'public-plans', 'Baixar grátis'],
    ['en', 'public-product', 'See how it works'],
    ['en', 'public-results', 'See how we measure'],
    ['en', 'public-compatibility', 'Download the app free'],
    ['en', 'public-plans', 'Download free'],
  ] as const)(
    'leads %s %s with a route-specific visitor outcome and next action',
    (locale, routeId, action) => {
      const markup = renderToStaticMarkup(<PublicCatalogPage locale={locale} routeId={routeId} />);
      const introduction = markup.slice(0, markup.indexOf('catalog-introduction__provenance'));

      expect(markup).toContain(`data-route-purpose="${routeId}"`);
      expect(markup).toContain('public-action--primary');
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
      ['pt-BR', 'public-product', 'Mais estabilidade para jogar. Controle para voltar atrás.'],
      ['pt-BR', 'public-results', 'Resultados que você consegue conferir'],
      ['pt-BR', 'public-compatibility', 'Veja se o Liiiraa Boost combina com o seu PC'],
      ['pt-BR', 'public-plans', 'Comece grátis. Ative o modo competitivo quando fizer sentido.'],
      ['en', 'public-product', 'More stability for gaming. Control when you need to go back.'],
      ['en', 'public-results', 'Results you can verify'],
      ['en', 'public-compatibility', 'See whether Liiiraa Boost fits your PC'],
      ['en', 'public-plans', 'Start free. Unlock competitive mode when it makes sense.'],
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

  it('gives Product, Results, and Compatibility distinct customer decisions', () => {
    const product = visibleText(
      renderToStaticMarkup(<PublicCatalogPage locale="pt-BR" routeId="public-product" />),
    );
    const results = visibleText(
      renderToStaticMarkup(<PublicCatalogPage locale="pt-BR" routeId="public-results" />),
    );
    const compatibility = visibleText(
      renderToStaticMarkup(<PublicCatalogPage locale="pt-BR" routeId="public-compatibility" />),
    );

    expect(product).toContain('Do diagnóstico à restauração, sem pular etapas');
    expect(product).toContain('Modo Competitivo prepara a sessão — e termina junto com ela');
    expect(product).toContain('Prioridade, CPU, serviços e rede dentro de limites seguros');
    expect(product).toContain('Fim da sessão visível com restauração automática');
    expect(results).toContain('Uma comparação que merece confiança');
    expect(results).toContain('Mesmo PC');
    expect(results).toContain('Mesmo jogo');
    expect(results).toContain('Condições visíveis');
    expect(compatibility).toContain('A análise acontece no desktop');
    expect(compatibility).toContain('A web não examina a sua máquina');
    expect(compatibility).toContain('Baixar app grátis');
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

  it('discloses every commercial consequence before the checkout boundary', () => {
    for (const locale of ['pt-BR', 'en'] as const) {
      const record = getPublicCatalog(locale).records.find(
        ({ routeId }) => routeId === 'public-plans',
      );
      const plans = record?.plans;

      expect(plans).toHaveLength(2);
      for (const plan of plans ?? []) {
        expect(plan.checkoutBoundary.length).toBeGreaterThan(0);
        expect(plan.price.length).toBeGreaterThan(0);
        expect(plan.billingPeriod.length).toBeGreaterThan(0);
        expect(plan.renewal.length).toBeGreaterThan(0);
        expect(plan.taxes.length).toBeGreaterThan(0);
        expect(plan.cancellation.length).toBeGreaterThan(0);
        expect(plan.refunds.length).toBeGreaterThan(0);
        expect(plan.deviceRules.length).toBeGreaterThan(0);
        expect(plan.expirationEffects.length).toBeGreaterThan(0);
      }
      expect(JSON.stringify(record)).not.toMatch(
        /countdown|contagem regressiva de \d|limited offer|oferta limitada/iu,
      );
    }
  });

  it('locks the final Free and Premium commercial contract in both locales', () => {
    const portuguese = getPublicCatalog('pt-BR').records.find(
      ({ routeId }) => routeId === 'public-plans',
    )?.plans;
    const english = getPublicCatalog('en').records.find(
      ({ routeId }) => routeId === 'public-plans',
    )?.plans;

    expect(portuguese?.map(({ id }) => id)).toEqual(['essential-free', 'competitive-premium']);
    expect(english?.map(({ id }) => id)).toEqual(['essential-free', 'competitive-premium']);
    expect(portuguese?.[0]).toMatchObject({ billingPeriod: 'grátis para sempre', price: 'R$ 0' });
    expect(english?.[0]).toMatchObject({ billingPeriod: 'free forever', price: 'US$ 0' });
    expect(portuguese?.[1]).toMatchObject({
      billingPeriod: 'ou R$ 249,90/ano',
      price: 'R$ 29,90/mês',
    });
    expect(english?.[1]).toMatchObject({
      billingPeriod: 'or US$ 59.99/year',
      price: 'US$ 6.99/month',
    });

    for (const plan of [portuguese?.[1], english?.[1]]) {
      expect(plan?.renewal).toMatch(/card|cartão/iu);
      expect(plan?.renewal).toMatch(/Pix/iu);
      expect(plan?.renewal).toMatch(/boleto/iu);
      expect(plan?.cancellation).toMatch(/fim do ciclo|through the paid cycle/iu);
      expect(plan?.refunds).toMatch(/sete dias|seven days/iu);
      expect(plan?.deviceRules).toMatch(/um PC|one active PC/iu);
      expect(plan?.deviceRules).toMatch(/30 days|30 dias/iu);
      expect(plan?.expirationEffects).toMatch(/offline.*30|30 dias|30 days/iu);
      expect(plan?.expirationEffects).toMatch(/histórico|history/iu);
      expect(plan?.expirationEffects).toMatch(/restauração|restoration/iu);
    }

    for (const catalog of [getPublicCatalog('pt-BR'), getPublicCatalog('en')]) {
      expect(JSON.stringify(catalog)).not.toMatch(
        /preço ilustrativo|illustrative price|preview demonstrativa|Phase 4|Fase 4|fixture|adapter/iu,
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
      expect(markup).toContain('class="plan-choice-grid"');
      expect(markup).toContain('name="billing"');
      expect(markup).toContain('value="monthly"');
      expect(markup).toContain('value="annual"');
      expect(markup).toContain('method="get"');
      expect(markup).toContain('data-icon-library="phosphor"');
      expect(visibleText(markup)).toContain(locale === 'pt-BR' ? 'R$ 29,90' : 'US$ 6.99');
      expect(visibleText(markup)).toContain(locale === 'pt-BR' ? 'R$ 249,90' : 'US$ 59.99');
      expect(visibleText(markup)).toContain(
        locale === 'pt-BR' ? 'Escolher Premium' : 'Choose Premium',
      );
      expect(markup).toContain(`action="https://account.liiiraa.com/${locale}/login"`);
      expect(visibleText(markup)).toMatch(/30 dias|30 days/iu);
      expect(visibleText(markup)).toMatch(/sete dias|seven days/iu);
      expect(visibleText(markup)).toMatch(/24 horas úteis|24 business hours/iu);
      expect(visibleText(markup)).not.toContain(
        locale === 'pt-BR' ? 'Não está à venda' : 'Not for sale',
      );
      expect(visibleText(markup)).not.toContain('disconnected');
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

  it('presents search results as customer guidance without internal publication metadata', () => {
    for (const locale of ['pt-BR', 'en'] as const) {
      const markup = renderToStaticMarkup(
        <PublicCatalogPage
          locale={locale}
          routeId="public-search"
          searchParams={{ q: locale === 'pt-BR' ? 'produto' : 'product' }}
        />,
      );
      const results = markup.slice(markup.indexOf('global-search__results'));

      expect(results).toContain(locale === 'pt-BR' ? 'Conteúdo público' : 'Public guidance');
      expect(results).not.toMatch(
        /<dt>(?:Tipo|Type|Idioma|Locale|Versão|Version|Validação|Validation)<\/dt>/iu,
      );
      expect(results).not.toMatch(/validated|demonstrative-preview|translationKey/iu);
    }
  });

  it('offers documentation, live status, and email support with exact response expectations', () => {
    for (const locale of ['pt-BR', 'en'] as const) {
      const markup = renderToStaticMarkup(
        <PublicCatalogPage locale={locale} routeId="public-support" />,
      );
      const text = visibleText(markup);

      expect(markup).toContain(`href="/${locale}/docs"`);
      expect(markup).toContain(`href="/${locale}/status"`);
      expect(markup).toContain('href="mailto:support@liiiraa.com"');
      expect(text).toMatch(/72 horas úteis|72 business hours/iu);
      expect(text).toMatch(/24 horas úteis|24 business hours/iu);
      expect(text).toMatch(/cobrança|billing/iu);
      expect(text).toMatch(/segurança|security/iu);
      expect(text).toMatch(/restauração|restoration/iu);
      expect(markup).toContain('class="support-service__options"');
    }
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
    expect(source).toContain('className="plan-terms"');
    expect(source).toContain('className="plan-checkout"');
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
  it('publishes review-safe Terms, Privacy, and Security records with complete version context', () => {
    for (const locale of ['pt-BR', 'en'] as const) {
      const policies = getPublicPolicies(locale);

      expect(policies.documents.map(({ kind }) => kind).sort()).toEqual([
        'privacy',
        'security',
        'terms',
      ]);

      for (const policy of policies.documents) {
        expect(policy.summary.length).toBeGreaterThan(60);
        expect(policy.sections.length).toBeGreaterThanOrEqual(5);
        expect(
          policy.sections.every(({ body, heading }) => body.length > 80 && heading.length > 0),
        ).toBe(true);
        expect(policy.version).toMatch(/^\d+\.\d+\.\d+$/u);
        expect(policy.effectiveDate).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
        expect(policy.history.at(-1)).toMatchObject({
          effectiveDate: policy.effectiveDate,
          version: policy.version,
        });
        expect(policy.contact).toMatch(/^[^@\s]+@liiiraa\.com$/u);
        expect(policy.reviewNotice).toMatch(
          /revis[aã]o jur[ií]dica profissional|professional legal review/iu,
        );

        const markup = renderToStaticMarkup(
          <PublicCatalogPage locale={locale} routeId={policy.routeId} />,
        );
        expect(markup).toContain('class="policy-review-notice"');
        expect(visibleText(markup)).toContain(policy.reviewNotice);
      }
    }
  });

  it('separates every D-106 privacy purpose, consent, retention, and rights topic', () => {
    const expectedPracticeIds = [
      'public-site-delivery',
      'essential-authentication-storage',
      'optional-telemetry',
      'support-diagnostics',
      'personalized-ai',
    ];

    for (const locale of ['pt-BR', 'en'] as const) {
      const privacy = getPublicPolicies(locale).documents.find(({ kind }) => kind === 'privacy');
      expect(privacy?.privacyDetails).toBeDefined();
      if (privacy?.privacyDetails === undefined) continue;

      expect(privacy.privacyDetails.controller.productIdentity).toBe('Liiiraa Boost');
      expect(privacy.privacyDetails.controller.formalIdentityStatus).toMatch(
        /antes da publica[cç][aã]o|before publication/iu,
      );
      expect(privacy.privacyDetails.controller.contact).toBe('privacy@liiiraa.com');
      expect(privacy.privacyDetails.practices.map(({ id }) => id)).toEqual(expectedPracticeIds);
      expect(
        privacy.privacyDetails.practices.every(
          ({ data, legalBasis, purpose, retention, revocation, sharing }) =>
            [data, legalBasis, purpose, retention, revocation, sharing].every(
              (value) => value.length > 30,
            ),
        ),
      ).toBe(true);
      expect(
        privacy.privacyDetails.practices.find(
          ({ id }) => id === 'essential-authentication-storage',
        ),
      ).toMatchObject({ status: 'necessary-only' });
      for (const id of ['optional-telemetry', 'support-diagnostics', 'personalized-ai']) {
        expect(
          privacy.privacyDetails.practices.find((practice) => practice.id === id),
        ).toMatchObject({ status: 'consent-required' });
      }
      expect(privacy.privacyDetails.rights.length).toBeGreaterThanOrEqual(7);
      expect(privacy.privacyDetails.processors).toMatch(/n[aã]o recebe|does not receive/iu);
      expect(privacy.privacyDetails.internationalTransfers).toMatch(
        /n[aã]o.*transfer|not.*transfer/iu,
      );

      const markup = renderToStaticMarkup(
        <PublicCatalogPage locale={locale} routeId="public-privacy-policy" />,
      );
      expect(markup).toContain('class="privacy-practice-ledger"');
      expect(markup).toContain('id="essential-storage"');
    }
  });

  it('defines responsible disclosure expectations without a bounty or invented authority', async () => {
    const source = await import('node:fs/promises').then(({ readFile }) =>
      readFile(new URL('./features/public-catalog.tsx', import.meta.url), 'utf8'),
    );

    for (const locale of ['pt-BR', 'en'] as const) {
      const policies = getPublicPolicies(locale);
      const disclosure = policies.disclosure;
      const serialized = JSON.stringify(policies);

      expect(disclosure.secureChannel).toBe('security@liiiraa.com');
      expect(disclosure.scope.length).toBeGreaterThanOrEqual(3);
      expect(disclosure.prohibitedContent.length).toBeGreaterThanOrEqual(3);
      expect(disclosure.response).toMatch(/confirma|acknowledge/iu);
      expect(disclosure.response).toMatch(/atualiza|update/iu);
      expect(disclosure.response).toMatch(/nenhuma recompensa|no bounty/iu);
      expect(disclosure.reviewNotice).toMatch(
        /revis[aã]o jur[ií]dica profissional|professional legal review/iu,
      );
      expect(disclosure.history.at(-1)).toMatchObject({
        effectiveDate: disclosure.effectiveDate,
        version: disclosure.version,
      });
      expect(serialized).not.toMatch(
        /ISO\s*27001|SOC\s*2|certificad[oa]|certified|registered office|CNPJ|processor:\s*(?:AWS|Cloudflare|Neon)/iu,
      );
    }

    expect(source).not.toMatch(/cookie-banner|CookieBanner/u);
  });

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

  it('renders human operational status and safe escalation without enum language', () => {
    for (const locale of ['pt-BR', 'en'] as const) {
      const markup = renderToStaticMarkup(
        <PublicCatalogPage locale={locale} routeId="public-status" />,
      );
      const text = visibleText(markup);

      expect(text).toContain(
        locale === 'pt-BR' ? 'Conta e gerenciamento online' : 'Account and online management',
      );
      expect(text).toContain(locale === 'pt-BR' ? 'Indisponível agora' : 'Unavailable now');
      expect(markup).toContain(`href="/${locale}/support"`);
      expect(markup).toContain(`href="/${locale}/releases"`);
      expect(markup).not.toMatch(/>demonstrative-preview</u);
      expect(text).not.toMatch(/Fase|Phase|prévia determinística|deterministic preview/iu);
    }
  });

  it('keeps versioned policies readable and free of internal delivery language', () => {
    const policyRoutes = [
      'public-privacy-policy',
      'public-terms',
      'public-responsible-disclosure',
    ] as const satisfies readonly WebRouteId[];

    for (const locale of ['pt-BR', 'en'] as const) {
      for (const routeId of policyRoutes) {
        const markup = renderToStaticMarkup(
          <PublicCatalogPage locale={locale} routeId={routeId} />,
        );
        const text = visibleText(markup);

        expect(text).toMatch(/1\.0\.0/u);
        expect(text).toContain('2026-07-31');
        expect(text).not.toMatch(
          /Fase\s*\d|Phase\s*\d|prévia determinística|deterministic preview|fixture|adapter/iu,
        );
        expect(markup).not.toMatch(/>privacy<|>security<|>terms</u);
      }
    }
  });
});
