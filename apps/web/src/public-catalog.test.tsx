import { isValidElement, type ReactNode } from 'react';
// @ts-expect-error The approved runtime includes react-dom, but @types/react-dom is not an approved identity.
import { renderToStaticMarkup as reactRenderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { matchWebRoute, type WebRouteId } from '@liiiraa/web-core';

import {
  admitPolicyPair,
  admitPolicies,
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
  it('publishes final Terms, Privacy, Essential Storage, and Security records without editorial review banners', () => {
    for (const locale of ['pt-BR', 'en'] as const) {
      const policies = getPublicPolicies(locale);

      expect(policies.documents.map(({ kind }) => kind).sort()).toEqual([
        'privacy',
        'security',
        'storage',
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
        const markup = renderToStaticMarkup(
          <PublicCatalogPage locale={locale} routeId={policy.routeId} />,
        );
        expect(markup).not.toContain('policy-review-notice');
        expect(visibleText(markup)).not.toMatch(
          /revis[aã]o necess[aá]ria|review required|professional legal review/iu,
        );
      }
    }
  });

  it('fails closed for unknown locale, kind, route, practice, and consent status', () => {
    const source = JSON.parse(JSON.stringify(getPublicPolicies('en'))) as {
      documents: Array<{
        kind: string;
        privacyDetails?: { practices: Array<{ id: string; status: string }> };
        routeId: string;
      }>;
      locale: string;
    };
    const mutate = (apply: (candidate: typeof source) => void) => {
      const candidate = JSON.parse(JSON.stringify(source)) as typeof source;
      apply(candidate);
      return candidate;
    };

    expect(() => admitPolicies(mutate((value) => (value.locale = 'es')), 'en')).toThrow(
      /PUBLIC_POLICIES_INVALID:en:root/u,
    );
    expect(() =>
      admitPolicies(mutate((value) => (value.documents[0]!.kind = 'cookies')), 'en'),
    ).toThrow(/PUBLIC_POLICIES_INVALID/u);
    expect(() =>
      admitPolicies(mutate((value) => (value.documents[0]!.routeId = 'public-home')), 'en'),
    ).toThrow(/PUBLIC_POLICIES_INVALID/u);
    expect(() =>
      admitPolicies(
        mutate((value) => {
          value.documents[0]!.privacyDetails!.practices[0]!.id = 'unknown-practice';
        }),
        'en',
      ),
    ).toThrow(/PUBLIC_POLICIES_INVALID/u);
    expect(() =>
      admitPolicies(
        mutate((value) => {
          value.documents[0]!.privacyDetails!.practices[0]!.status = 'optional';
        }),
        'en',
      ),
    ).toThrow(/PUBLIC_POLICIES_INVALID/u);
  });

  it('fails closed for valid kinds paired to the wrong routes, section drift, and locale drift', () => {
    const english = structuredClone(getPublicPolicies('en'));
    const portuguese = structuredClone(getPublicPolicies('pt-BR'));

    const swappedRoutes = structuredClone(english);
    const firstRoute = swappedRoutes.documents[0]!.routeId;
    swappedRoutes.documents[0]!.routeId = swappedRoutes.documents[1]!.routeId;
    swappedRoutes.documents[1]!.routeId = firstRoute;
    expect(() => admitPolicies(swappedRoutes, 'en')).toThrow(/kind-route/u);

    const missingSection = structuredClone(english);
    missingSection.documents[0]!.sections = missingSection.documents[0]!.sections.slice(1);
    expect(() => admitPolicies(missingSection, 'en')).toThrow(/section-contract/u);

    const reorderedSections = structuredClone(english);
    reorderedSections.documents[0]!.sections = [
      ...reorderedSections.documents[0]!.sections,
    ].reverse();
    expect(() => admitPolicies(reorderedSections, 'en')).toThrow(/section-contract/u);

    const localeDrift = structuredClone(portuguese);
    localeDrift.documents[0]!.sections[0]!.id = 'localized-only-id';
    expect(() => admitPolicyPair(english, localeDrift)).toThrow(/locale-parity/u);
  });

  it('separates every D-106 privacy purpose, consent, retention, and rights topic', () => {
    const expectedPracticeIds = [
      'public-site-delivery',
      'account-and-subscription',
      'essential-authentication-storage',
      'device-licensing',
      'local-performance-data',
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
        /antes da abertura|before production accounts/iu,
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
      expect(privacy.privacyDetails.processors).toMatch(/ser[aá] identificad|will be identified/iu);
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

      expect(disclosure.coordinationContact).toBe('security@liiiraa.com');
      expect(disclosure.coordinationStatus).toBe('preflight-required');
      expect(disclosure.scope.length).toBeGreaterThanOrEqual(3);
      expect(disclosure.prohibitedContent.length).toBeGreaterThanOrEqual(3);
      expect(disclosure.response).toMatch(/ap[oó]s o preflight|after preflight/iu);
      expect(disclosure.response).toMatch(/nenhuma recompensa|no bounty/iu);
      expect(disclosure.history.at(-1)).toMatchObject({
        effectiveDate: disclosure.effectiveDate,
        version: disclosure.version,
      });
      expect(serialized).not.toMatch(
        /(?:somos|é|is|are)\s+(?:certificad[oa]|certified|ISO\s*27001|SOC\s*2)|registered office|CNPJ|processor:\s*(?:AWS|Cloudflare|Neon)/iu,
      );
      expect(serialized).not.toMatch(/secureChannel|canal seguro|secure channel/iu);

      const markup = renderToStaticMarkup(
        <PublicCatalogPage locale={locale} routeId="public-responsible-disclosure" />,
      );
      expect(markup).not.toContain('mailto:security@liiiraa.com');
      expect(visibleText(markup)).toMatch(/contato designado|designated contact/iu);
      expect(visibleText(markup)).toMatch(/preflight/iu);
    }

    expect(source).not.toMatch(/cookie-banner|CookieBanner/u);
  });

  it('binds present-tense product facts to existing repository evidence and keeps future services conditional', async () => {
    const { readFile } = await import('node:fs/promises');
    const evidence = new URL(
      '../../../.planning/phases/03-complete-web-experience/03-CONTEXT.md',
      import.meta.url,
    );
    const matrix = [
      { claim: 'O Free é o Modo Essencial', evidenceId: 'D-90', locale: 'pt-BR' },
      { claim: 'Free is Essential Mode', evidenceId: 'D-90', locale: 'en' },
      { claim: 'R$ 29,90 por mês', evidenceId: 'D-92', locale: 'pt-BR' },
      { claim: 'US$6.99 monthly', evidenceId: 'D-92', locale: 'en' },
      { claim: 'O HWID bruto não é armazenado', evidenceId: 'D-93', locale: 'pt-BR' },
      { claim: 'raw HWID is not stored', evidenceId: 'D-93', locale: 'en' },
    ] as const;
    const source = await readFile(evidence, 'utf8');

    for (const entry of matrix) {
      expect(source).toContain(entry.evidenceId);
      expect(JSON.stringify(getPublicPolicies(entry.locale))).toContain(entry.claim);
    }

    for (const locale of ['pt-BR', 'en'] as const) {
      const policies = getPublicPolicies(locale);
      const privacy = policies.documents.find(({ kind }) => kind === 'privacy');
      const account = privacy?.privacyDetails?.practices.find(
        ({ id }) => id === 'account-and-subscription',
      );
      const authentication = privacy?.privacyDetails?.practices.find(
        ({ id }) => id === 'essential-authentication-storage',
      );
      expect(JSON.stringify(account)).toMatch(/quando|ser[aã]o|will|before activation/iu);
      expect(JSON.stringify(authentication)).toMatch(/quando|poder[aá]|when|may/iu);
      expect(JSON.stringify(policies)).not.toMatch(
        /checkout (?:est[aá] ativo|is available)|telemetria (?:est[aá] ativa|is active)|cloud AI is active/iu,
      );
    }
  });

  it('binds every narrative assertion to traceable evidence and rejects unreviewed claims', async () => {
    const { access, readFile } = await import('node:fs/promises');
    const { fileURLToPath } = await import('node:url');

    for (const locale of ['pt-BR', 'en'] as const) {
      const policies = getPublicPolicies(locale);
      const evidenceIds = new Set(policies.evidenceSources.map(({ id }) => id));

      expect(policies.claims.length).toBeGreaterThan(100);
      expect(new Set(policies.claims.map(({ id }) => id)).size).toBe(policies.claims.length);
      expect(
        policies.claims.every(
          ({ evidenceIds: claimEvidence, id, location, statement }) =>
            id.length > 0 &&
            location.length > 0 &&
            statement.length > 0 &&
            claimEvidence.length > 0 &&
            claimEvidence.every((evidenceId) => evidenceIds.has(evidenceId)),
        ),
      ).toBe(true);

      for (const source of policies.evidenceSources) {
        if (source.reference.startsWith('https://')) continue;
        const [relativePath, anchor] = source.reference.split('#');
        const target = new URL(`../../../${relativePath}`, import.meta.url);
        await access(target);
        if (anchor !== undefined) {
          expect(await readFile(fileURLToPath(target), 'utf8')).toContain(anchor);
        }
      }

      const unreviewed = JSON.parse(JSON.stringify(policies)) as {
        documents: Array<{ sections: Array<{ body: string }> }>;
      };
      unreviewed.documents[0]!.sections[0]!.body += ' An unreviewed current assertion exists.';
      expect(() => admitPolicies(unreviewed, locale)).toThrow(/claim-coverage/u);

      const futureAsCurrent = JSON.parse(JSON.stringify(policies)) as {
        claims: Array<{ temporal: string }>;
      };
      const futureClaim = futureAsCurrent.claims.find(({ temporal }) => temporal === 'future');
      expect(futureClaim).toBeDefined();
      if (futureClaim !== undefined) futureClaim.temporal = 'current';
      expect(() => admitPolicies(futureAsCurrent, locale)).toThrow(/claim-temporal/u);

      const evidenceRemoved = JSON.parse(JSON.stringify(policies)) as {
        claims: Array<{ evidenceIds: string[] }>;
      };
      evidenceRemoved.claims[0]!.evidenceIds = [];
      expect(() => admitPolicies(evidenceRemoved, locale)).toThrow(/claim-evidence/u);
    }

    const english = getPublicPolicies('en');
    const portuguese = getPublicPolicies('pt-BR');
    expect(english.claims.map(({ id }) => id)).toEqual(portuguese.claims.map(({ id }) => id));
    expect(english.claims.map(({ location }) => location)).toEqual(
      portuguese.claims.map(({ location }) => location),
    );
  });

  it('renders complete versioned policy, disclosure, and status families in both locales', () => {
    const routeIds = [
      'public-policies',
      'public-privacy-policy',
      'public-terms',
      'public-essential-storage',
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
      'public-essential-storage',
      'public-responsible-disclosure',
    ] as const satisfies readonly WebRouteId[];

    for (const locale of ['pt-BR', 'en'] as const) {
      for (const routeId of policyRoutes) {
        const markup = renderToStaticMarkup(
          <PublicCatalogPage locale={locale} routeId={routeId} />,
        );
        const text = visibleText(markup);

        expect(text).toMatch(/1\.0\.0/u);
        expect(text).toContain(
          routeId === 'public-essential-storage' ? '2026-08-03' : '2026-07-31',
        );
        expect(text).not.toMatch(
          /Fase\s*\d|Phase\s*\d|prévia determinística|deterministic preview|fixture|adapter/iu,
        );
        expect(markup).not.toMatch(/>privacy<|>security<|>terms</u);
      }
    }
  });
});
