import { describe, expect, it } from 'vitest';

import {
  admitContentBundle,
  type AdmittedContentBundle,
  type ContentAsset,
  type RepositoryContentRecord,
} from './content-admission.js';
import { buildPublicSearchIndex, searchPublicContent, type SearchFilters } from './search.js';
import { webRoutes } from './routes.js';

const CLOCK = new Date('2026-07-31T12:00:00.000Z');

const route = (routeId: string) => {
  const match = webRoutes.find(({ id }) => id === routeId);
  if (match === undefined) {
    throw new Error(`Missing test route ${routeId}`);
  }
  return match;
};

const sidecar = (locale: 'pt-BR' | 'en', seed: string) => ({
  version: '1.0.0',
  locale,
  scenarioId: `public-search-${locale.toLowerCase()}`,
  viewport: '1440x900',
  captureCommand: 'pnpm desktop:capture --scenario public-search',
  sourceCommit: 'abcdef123456',
  checksum: seed.repeat(64),
  crop: 'full-frame',
  reviewState: 'approved' as const,
});

const assets: readonly ContentAsset[] = [
  {
    id: 'search-social-pt',
    path: '/media/search-social-pt.avif',
    purpose: 'social',
    provenance: sidecar('pt-BR', 'a'),
  },
  {
    id: 'search-social-en',
    path: '/media/search-social-en.avif',
    purpose: 'social',
    provenance: sidecar('en', 'b'),
  },
  {
    id: 'search-shot-pt',
    path: '/media/search-shot-pt.webp',
    purpose: 'screenshot',
    provenance: sidecar('pt-BR', 'c'),
  },
  {
    id: 'search-shot-en',
    path: '/media/search-shot-en.webp',
    purpose: 'screenshot',
    provenance: sidecar('en', 'd'),
  },
];

type SearchFixture = Readonly<{
  key: string;
  routeId: string;
  contentType: RepositoryContentRecord['contentType'];
  domain: string;
  risk: RepositoryContentRecord['risk'];
  title: Readonly<Record<'pt-BR' | 'en', string>>;
  summary: Readonly<Record<'pt-BR' | 'en', string>>;
  identifiers?: readonly string[];
  errorCodes?: readonly string[];
}>;

const fixtures: readonly SearchFixture[] = [
  {
    key: 'product-optimization',
    routeId: 'public-product',
    contentType: 'product',
    domain: 'product',
    risk: 'low',
    title: {
      'pt-BR': 'Otimização térmica com controle',
      en: 'Controlled thermal optimization',
    },
    summary: {
      'pt-BR': 'Meça antes e depois de otimizar.',
      en: 'Measure before and after optimization.',
    },
    identifiers: ['LB-PRODUCT', '1.0.0'],
  },
  {
    key: 'capability-restore',
    routeId: 'public-product',
    contentType: 'capability',
    domain: 'capability',
    risk: 'medium',
    title: { 'pt-BR': 'Restauração verificável', en: 'Verifiable restore' },
    summary: {
      'pt-BR': 'Reverta mudanças com histórico.',
      en: 'Revert changes with history.',
    },
    identifiers: ['LB-RESTORE'],
  },
  {
    key: 'compatibility-windows',
    routeId: 'public-compatibility',
    contentType: 'compatibility',
    domain: 'compatibility',
    risk: 'none',
    title: { 'pt-BR': 'Compatibilidade Windows', en: 'Windows compatibility' },
    summary: {
      'pt-BR': 'Verifique suporte antes de alterar.',
      en: 'Verify support before changing anything.',
    },
    identifiers: ['WIN11-24H2'],
  },
  {
    key: 'plan-comparison',
    routeId: 'public-plans',
    contentType: 'plan',
    domain: 'plans',
    risk: 'none',
    title: { 'pt-BR': 'Comparar planos', en: 'Compare plans' },
    summary: {
      'pt-BR': 'Compare capacidades sem pressão.',
      en: 'Compare capabilities without pressure.',
    },
  },
  {
    key: 'docs-error-code',
    routeId: 'docs-troubleshooting',
    contentType: 'documentation',
    domain: 'troubleshooting',
    risk: 'high',
    title: {
      'pt-BR': 'Diagnóstico do código LB-ERR:0x80070005',
      en: 'Diagnose code LB-ERR:0x80070005',
    },
    summary: {
      'pt-BR': 'Confirme o estado observado antes da recuperação.',
      en: 'Confirm observed state before recovery.',
    },
    identifiers: ['SHA-256:ABCD.EF', '1.0.0'],
    errorCodes: ['LB-ERR:0x80070005'],
  },
  {
    key: 'release-stable',
    routeId: 'releases-channel',
    contentType: 'release',
    domain: 'release',
    risk: 'medium',
    title: { 'pt-BR': 'Canal estável', en: 'Stable channel' },
    summary: {
      'pt-BR': 'Notas e integridade da versão.',
      en: 'Version notes and integrity.',
    },
    identifiers: ['stable-1.0.0'],
  },
  {
    key: 'support-recovery',
    routeId: 'public-support',
    contentType: 'support',
    domain: 'support',
    risk: 'low',
    title: { 'pt-BR': 'Suporte e recuperação', en: 'Support and recovery' },
    summary: {
      'pt-BR': 'Encontre a próxima ação segura.',
      en: 'Find the next safe action.',
    },
  },
];

const record = (fixture: SearchFixture, locale: 'pt-BR' | 'en'): RepositoryContentRecord => {
  const canonicalRoute = route(fixture.routeId);
  const suffix = locale === 'pt-BR' ? 'pt' : 'en';
  return {
    document: {
      id: `${fixture.key}-${suffix}`,
      routeId: canonicalRoute.id,
      locale,
      version: '1.0.0',
      channel: 'stable',
      owner: canonicalRoute.owner,
      lastReviewedAt: '2026-07-30T12:00:00.000Z',
      validationState: 'validated',
      evidence: [
        {
          source: 'https://liiiraa.com/en/evidence',
          provenance: {
            kind: 'observed',
            value: fixture.key,
            source: 'Reviewed repository evidence',
            observedAt: '2026-07-30T12:00:00.000Z',
          },
          scope: 'Public search fixture evidence',
          applicableVersion: '1.0.0',
          validationState: 'validated',
          unproven: false,
        },
      ],
      indexing: canonicalRoute.indexing,
      staleTreatment: 'Remove claims and route to current guidance.',
    },
    translationKey: fixture.key,
    contentType: fixture.contentType,
    source: 'repository',
    title: fixture.title[locale],
    summary: fixture.summary[locale],
    body: `${fixture.summary[locale]} ${fixture.title[locale]}`,
    metadata: {
      title: fixture.title[locale],
      description: fixture.summary[locale],
      socialImageId: `search-social-${suffix}`,
    },
    warnings: [
      locale === 'pt-BR'
        ? 'Confirme a aplicabilidade ao seu hardware.'
        : 'Confirm applicability to your hardware.',
    ],
    screenshotAssetIds: [`search-shot-${suffix}`],
    actionableClaims: [],
    identifiers: fixture.identifiers ?? [],
    errorCodes: fixture.errorCodes ?? [],
    suggestions:
      locale === 'pt-BR'
        ? ['Medir desempenho', 'Verificar compatibilidade']
        : ['Measure performance', 'Check compatibility'],
    domain: fixture.domain,
    risk: fixture.risk,
    availability: 'available',
  };
};

const admittedBundle = async (): Promise<AdmittedContentBundle> => {
  const records = fixtures.flatMap((fixture) => [record(fixture, 'pt-BR'), record(fixture, 'en')]);
  const result = await admitContentBundle(records, {
    assetIndex: assets,
    clock: CLOCK,
    routeManifest: webRoutes,
  });
  if (!result.ok) {
    throw new Error(`Fixture admission failed: ${result.error.code}`);
  }
  return result.value;
};

const filters = (overrides: Partial<SearchFilters> = {}): SearchFilters => ({
  locale: 'en',
  version: '1.0.0',
  ...overrides,
});

describe('public-only search', () => {
  it('indexes every admitted public content class without serializing forbidden records', async () => {
    const bundle = await admittedBundle();
    const built = buildPublicSearchIndex(bundle);

    expect(built.ok).toBe(true);
    if (built.ok) {
      expect(built.value.documentCount).toBe(14);
      expect(built.value.serialized).not.toMatch(
        /account-|admin-|scenario-|docs-history|private-preview/iu,
      );
      expect(built.value.serialized).toContain('public-product');
      expect(built.value.serialized).toContain('docs-troubleshooting');
    }
  });

  it.each([
    {
      query: 'otimizacao',
      selectedFilters: filters({ locale: 'pt-BR', domain: 'product' }),
      expectedRoute: 'public-product',
    },
    {
      query: 'LB-ERR:0x80070005',
      selectedFilters: filters({ domain: 'troubleshooting', risk: 'high' }),
      expectedRoute: 'docs-troubleshooting',
    },
    {
      query: 'SHA-256:ABCD.EF',
      selectedFilters: filters({ domain: 'troubleshooting' }),
      expectedRoute: 'docs-troubleshooting',
    },
    {
      query: 'WIN11-24H2',
      selectedFilters: filters({ domain: 'compatibility' }),
      expectedRoute: 'public-compatibility',
    },
  ])(
    'normalizes bilingual and technical query $query predictably',
    async ({ query, selectedFilters, expectedRoute }) => {
      const built = buildPublicSearchIndex(await admittedBundle());
      expect(built.ok).toBe(true);
      if (!built.ok) return;

      const result = searchPublicContent(built.value, {
        query,
        filters: selectedFilters,
      });

      expect(result.state).toBe('results');
      expect(result.submittedQuery).toBe(query);
      expect(result.filters).toEqual(selectedFilters);
      expect(result.results[0]?.routeId).toBe(expectedRoute);
    },
  );

  it('applies locale, version, domain, risk, and availability filters together', async () => {
    const built = buildPublicSearchIndex(await admittedBundle());
    expect(built.ok).toBe(true);
    if (!built.ok) return;

    const selectedFilters = filters({
      locale: 'pt-BR',
      domain: 'release',
      risk: 'medium',
      availability: 'available',
    });
    const result = searchPublicContent(built.value, {
      query: 'canal',
      filters: selectedFilters,
    });

    expect(result.state).toBe('results');
    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({
      locale: 'pt-BR',
      version: '1.0.0',
      domain: 'release',
      risk: 'medium',
      availability: 'available',
    });
  });

  it('uses stable title and search ID ordering for equal-score results', async () => {
    const built = buildPublicSearchIndex(await admittedBundle());
    expect(built.ok).toBe(true);
    if (!built.ok) return;

    const first = searchPublicContent(built.value, {
      query: 'before',
      filters: filters(),
    });
    const second = searchPublicContent(built.value, {
      query: 'before',
      filters: filters(),
    });

    expect(second).toEqual(first);
    expect(first.results.map(({ searchId }) => searchId)).toEqual(
      [...first.results]
        .sort((left, right) =>
          left.score === right.score
            ? left.title.localeCompare(right.title) || left.searchId.localeCompare(right.searchId)
            : right.score - left.score,
        )
        .map(({ searchId }) => searchId),
    );
  });

  it('preserves an explicit submitted query and filters in authored no-result state', async () => {
    const built = buildPublicSearchIndex(await admittedBundle());
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const selectedFilters = filters({
      locale: 'pt-BR',
      domain: 'compatibility',
    });

    const result = searchPublicContent(built.value, {
      query: 'consulta-sem-correspondencia',
      filters: selectedFilters,
    });

    expect(result).toMatchObject({
      state: 'no-results',
      submittedQuery: 'consulta-sem-correspondencia',
      filters: selectedFilters,
      results: [],
    });
    expect(result.suggestions).toContain('Verificar compatibilidade');
  });

  it.each([
    {
      name: 'account route',
      mutate: (bundle: AdmittedContentBundle) => ({
        ...bundle,
        records: [
          {
            ...bundle.records[0],
            document: {
              ...bundle.records[0]?.document,
              routeId: 'account-profile',
              owner: 'account-navigation',
              indexing: 'noindex',
            },
          },
          ...bundle.records.slice(1),
        ],
      }),
      code: 'PRIVATE_RECORD',
    },
    {
      name: 'scenario route',
      mutate: (bundle: AdmittedContentBundle) => ({
        ...bundle,
        records: [
          {
            ...bundle.records[0],
            document: {
              ...bundle.records[0]?.document,
              routeId: 'releases-download',
              owner: 'release-content',
              indexing: 'noindex',
            },
          },
          ...bundle.records.slice(1),
        ],
      }),
      code: 'SCENARIO_RECORD',
    },
    {
      name: 'forged searchable route',
      mutate: (bundle: AdmittedContentBundle) => ({
        ...bundle,
        searchableRouteIds: [...bundle.searchableRouteIds, 'admin-audit'],
      }),
      code: 'SEARCHABLE_ROUTE_DRIFT',
    },
  ])('fails closed when a $name enters the bundle', async ({ mutate, code }) => {
    const secret = 'SENSITIVE_PRIVATE_SEARCH_VALUE';
    const bundle = mutate(await admittedBundle()) as AdmittedContentBundle;
    const mutated = {
      ...bundle,
      records: bundle.records.map((item, index) =>
        index === 0 ? { ...item, body: `${item.body} ${secret}` } : item,
      ),
    } as AdmittedContentBundle;

    const result = buildPublicSearchIndex(mutated);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(code);
      expect(JSON.stringify(result.error)).not.toContain(secret);
    }
  });
});
