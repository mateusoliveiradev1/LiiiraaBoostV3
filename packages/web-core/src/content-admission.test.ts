import { describe, expect, it } from 'vitest';

import {
  admitContentBundle,
  type ContentAsset,
  type RepositoryContentRecord,
} from './content-admission.ts';
import { webRoutes } from './routes.ts';

const CLOCK = new Date('2026-07-31T12:00:00.000Z');

const route = (routeId: string) => {
  const match = webRoutes.find(({ id }) => id === routeId);
  if (match === undefined) {
    throw new Error(`Missing test route ${routeId}`);
  }
  return match;
};

const evidence = (version = '1.0.0') => ({
  source: 'https://liiiraa.com/en/evidence',
  provenance: {
    kind: 'observed' as const,
    value: 'repository-review',
    source: 'Reviewed repository evidence',
    observedAt: '2026-07-30T12:00:00.000Z',
  },
  scope: 'Public product behavior and limitations',
  applicableVersion: version,
  validationState: 'validated' as const,
  unproven: false,
});

const screenshot = (locale: 'pt-BR' | 'en', checksum: string) => ({
  version: '1.0.0',
  locale,
  scenarioId: `public-product-${locale.toLowerCase()}`,
  viewport: '1440x900',
  captureCommand: 'pnpm desktop:capture --scenario public-product',
  sourceCommit: 'abcdef123456',
  checksum,
  crop: 'full-frame',
  reviewState: 'approved' as const,
});

const assets: readonly ContentAsset[] = [
  {
    id: 'product-social-pt',
    path: '/media/product-social-pt.avif',
    purpose: 'social',
    provenance: screenshot('pt-BR', 'a'.repeat(64)),
  },
  {
    id: 'product-social-en',
    path: '/media/product-social-en.avif',
    purpose: 'social',
    provenance: screenshot('en', 'b'.repeat(64)),
  },
  {
    id: 'product-shot-pt',
    path: '/media/product-shot-pt.webp',
    purpose: 'screenshot',
    provenance: screenshot('pt-BR', 'c'.repeat(64)),
  },
  {
    id: 'product-shot-en',
    path: '/media/product-shot-en.webp',
    purpose: 'screenshot',
    provenance: screenshot('en', 'd'.repeat(64)),
  },
];

const contentRecord = (
  locale: 'pt-BR' | 'en',
  overrides: Partial<RepositoryContentRecord> = {},
): RepositoryContentRecord => {
  const productRoute = route('public-product');
  const suffix = locale === 'pt-BR' ? 'pt' : 'en';
  return {
    document: {
      id: `product-overview-${suffix}`,
      routeId: productRoute.id,
      locale,
      version: '1.0.0',
      channel: 'stable',
      owner: productRoute.owner,
      lastReviewedAt: '2026-07-30T12:00:00.000Z',
      validationState: 'validated',
      evidence: [evidence()],
      indexing: productRoute.indexing,
      staleTreatment: 'Remove actionable claims and link to current product guidance.',
    },
    translationKey: 'product-overview',
    contentType: 'product',
    source: 'repository',
    title: locale === 'pt-BR' ? 'Desempenho com evidência' : 'Evidence-led performance',
    summary:
      locale === 'pt-BR'
        ? 'Prepare, meça e restaure com controle.'
        : 'Prepare, measure, and restore with control.',
    body:
      locale === 'pt-BR'
        ? 'Compatibilidade e ganhos dependem do hardware validado.'
        : 'Compatibility and gains depend on validated hardware.',
    metadata: {
      title: locale === 'pt-BR' ? 'Liiiraa Boost | Produto' : 'Liiiraa Boost | Product',
      description:
        locale === 'pt-BR' ? 'Visão verificável do produto.' : 'A verifiable product overview.',
      socialImageId: `product-social-${suffix}`,
    },
    warnings: [
      locale === 'pt-BR' ? 'Resultados variam conforme o hardware.' : 'Results vary by hardware.',
    ],
    screenshotAssetIds: [`product-shot-${suffix}`],
    actionableClaims: [
      locale === 'pt-BR'
        ? 'Meça antes e depois da otimização.'
        : 'Measure before and after optimization.',
    ],
    identifiers: ['LB-PRODUCT', '1.0.0'],
    errorCodes: [],
    suggestions: locale === 'pt-BR' ? ['Medir desempenho'] : ['Measure performance'],
    domain: 'product',
    risk: 'low',
    availability: 'available',
    ...overrides,
  };
};

const admit = (
  records: readonly RepositoryContentRecord[],
  assetIndex: readonly ContentAsset[] = assets,
) =>
  admitContentBundle(records, {
    assetIndex,
    clock: CLOCK,
    routeManifest: webRoutes,
  });

describe('content admission', () => {
  it('admits bilingual route-owned evidence deterministically', async () => {
    const pt = contentRecord('pt-BR');
    const en = contentRecord('en');

    const first = await admit([en, pt]);
    const second = await admit([pt, en]);

    expect(first.ok).toBe(true);
    expect(second).toEqual(first);
    if (first.ok && second.ok) {
      expect(first.value.schemaVersion).toBe(1);
      expect(first.value.buildId).toMatch(/^build-[a-f0-9]{64}$/u);
      expect(first.value.contentId).toMatch(/^content-[a-f0-9]{64}$/u);
      expect(first.value.records.map(({ document }) => document.locale)).toEqual(['en', 'pt-BR']);
      expect(first.value.searchableRouteIds).toEqual(['public-product']);
      expect(Object.isFrozen(first.value)).toBe(true);
    }
  });

  it.each([
    {
      name: 'missing locale',
      mutate: () => [contentRecord('en')],
      code: 'LOCALE_PARITY_MISSING',
    },
    {
      name: 'unknown route',
      mutate: () => [
        contentRecord('pt-BR', {
          document: {
            ...contentRecord('pt-BR').document,
            routeId: 'private-preview',
          },
        }),
        contentRecord('en'),
      ],
      code: 'ROUTE_UNKNOWN',
    },
    {
      name: 'route owner drift',
      mutate: () => [
        contentRecord('pt-BR', {
          document: {
            ...contentRecord('pt-BR').document,
            owner: 'other-owner',
          },
        }),
        contentRecord('en'),
      ],
      code: 'ROUTE_OWNER_MISMATCH',
    },
    {
      name: 'stale review',
      mutate: () => [
        contentRecord('pt-BR', {
          document: {
            ...contentRecord('pt-BR').document,
            lastReviewedAt: '2025-01-01T00:00:00.000Z',
          },
        }),
        contentRecord('en'),
      ],
      code: 'REVIEW_STALE',
    },
    {
      name: 'unproven evidence',
      mutate: () => [
        contentRecord('pt-BR', {
          document: {
            ...contentRecord('pt-BR').document,
            evidence: [
              {
                ...evidence(),
                validationState: 'unproven',
                unproven: true,
              },
            ],
          },
        }),
        contentRecord('en'),
      ],
      code: 'EVIDENCE_UNTRUSTED',
    },
    {
      name: 'missing warning',
      mutate: () => [contentRecord('pt-BR', { warnings: [] }), contentRecord('en')],
      code: 'WARNING_MISSING',
    },
    {
      name: 'missing content metadata',
      mutate: () => [
        contentRecord('pt-BR', {
          metadata: {
            ...contentRecord('pt-BR').metadata,
            description: '',
          },
        }),
        contentRecord('en'),
      ],
      code: 'METADATA_INCOMPLETE',
    },
    {
      name: 'missing screenshot sidecar',
      mutate: () => [
        contentRecord('pt-BR', {
          screenshotAssetIds: ['missing-screenshot'],
        }),
        contentRecord('en'),
      ],
      code: 'ASSET_MISSING',
    },
    {
      name: 'mutable CMS source',
      mutate: () => [contentRecord('pt-BR', { source: 'cms' }), contentRecord('en')],
      code: 'SOURCE_NOT_REPOSITORY',
    },
    {
      name: 'raw executable content',
      mutate: () => [
        contentRecord('pt-BR', {
          body: '<script>window.location=\"https://attacker.invalid\"</script>',
        }),
        contentRecord('en'),
      ],
      code: 'EXECUTABLE_CONTENT',
    },
    {
      name: 'generic PowerShell mutation recipe',
      mutate: () => [
        contentRecord('pt-BR', {
          body: '```powershell\nSet-ItemProperty HKLM:\\Software\\Example\n```',
        }),
        contentRecord('en'),
      ],
      code: 'MUTATION_RECIPE',
    },
  ])('fails closed for $name', async ({ mutate, code }) => {
    const result = await admit(mutate());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(code);
      expect(result.error.path).toMatch(/^\$/u);
    }
  });

  it('does not leak rejected payload values in stable errors', async () => {
    const secret = 'SENSITIVE_CONTENT_VALUE_MUST_NOT_LEAK';
    const invalid = contentRecord('pt-BR', {
      document: {
        ...contentRecord('pt-BR').document,
        id: `${secret}-${'x'.repeat(128)}`,
      },
    });

    const first = await admit([invalid, contentRecord('en')]);
    const second = await admit([invalid, contentRecord('en')]);

    expect(first).toEqual(second);
    expect(first.ok).toBe(false);
    expect(JSON.stringify(first)).not.toContain(secret);
  });

  it('keeps stale history non-actionable and routes readers to current content', async () => {
    const historicalRoute = route('docs-history');
    const currentRoute = route('docs-article');
    const historical = (locale: 'pt-BR' | 'en'): RepositoryContentRecord => {
      const base = contentRecord(locale);
      const suffix = locale === 'pt-BR' ? 'pt' : 'en';
      return {
        ...base,
        document: {
          ...base.document,
          id: `history-overview-${suffix}`,
          routeId: historicalRoute.id,
          owner: historicalRoute.owner,
          indexing: historicalRoute.indexing,
          validationState: 'stale',
          evidence: [
            {
              ...evidence(),
              provenance: {
                kind: 'unavailable',
                reason: 'Original evidence is no longer available.',
              },
              validationState: 'stale',
              unproven: true,
            },
          ],
        },
        translationKey: 'history-overview',
        contentType: 'documentation',
        canonicalRouteId: currentRoute.id,
        actionableClaims: ['This must be removed by admission.'],
        availability: 'obsolete',
      };
    };

    const result = await admit([historical('pt-BR'), historical('en')]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.searchableRouteIds).toEqual([]);
      expect(
        result.value.records.every(
          (record) =>
            record.actionableClaims.length === 0 &&
            record.historyState === 'stale-history' &&
            record.canonicalRouteId === 'docs-article',
        ),
      ).toBe(true);
    }
  });
});
