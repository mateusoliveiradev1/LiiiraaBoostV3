import {
  admitContentBundle,
  validateWebDocument,
  webRoutes,
  type RepositoryContentRecord,
} from '@liiiraa/web-core';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

import homeEn from './content/public/home.en.json';
import homePtBr from './content/public/home.pt-BR.json';

const objectKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(objectKeys);
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, objectKeys(child)]),
    );
  }

  return typeof value;
};

const authoredText = (record: typeof homeEn): string =>
  [
    record.title,
    record.summary,
    record.body,
    record.hero.promise,
    record.hero.summary,
    record.hero.primaryAction.label,
    record.hero.secondaryAction.label,
    record.hero.trustBoundary.title,
    record.hero.trustBoundary.body,
    ...record.warnings,
    ...record.actionableClaims,
    ...record.suggestions,
    ...record.chapters.flatMap((chapter) => [
      chapter.title,
      chapter.summary,
      chapter.claim,
      chapter.unprovenBoundary,
    ]),
    record.productStage.unavailableTitle,
    record.productStage.unavailableBody,
    record.finalJourney.title,
    record.finalJourney.body,
    record.finalJourney.actionLabel,
    record.finalJourney.distributionNote,
  ].join('\n');

describe('Home content contract', () => {
  it('keeps exact bilingual structure, metadata, and evidence parity', () => {
    expect(objectKeys(homePtBr)).toEqual(objectKeys(homeEn));
    expect(homePtBr.translationKey).toBe(homeEn.translationKey);
    expect(homePtBr.document.routeId).toBe('public-home');
    expect(homeEn.document.routeId).toBe('public-home');
    expect(homePtBr.document.version).toBe(homeEn.document.version);
    expect(homePtBr.document.channel).toBe(homeEn.document.channel);
    expect(homePtBr.document.owner).toBe(homeEn.document.owner);
    expect(Object.keys(homePtBr.metadata).sort()).toEqual(Object.keys(homeEn.metadata).sort());
    expect(homePtBr.document.evidence).toHaveLength(homeEn.document.evidence.length);
    expect(homePtBr.document.evidence.map(({ provenance }) => provenance.kind)).toEqual(
      homeEn.document.evidence.map(({ provenance }) => provenance.kind),
    );
    expect(homePtBr.document.evidence.map(({ provenance }) => provenance.value)).toEqual(
      homeEn.document.evidence.map(({ provenance }) => provenance.value),
    );
    expect(homePtBr.chapters.map(({ id, evidenceIndex }) => ({ id, evidenceIndex }))).toEqual(
      homeEn.chapters.map(({ id, evidenceIndex }) => ({ id, evidenceIndex })),
    );
  });

  it('uses the approved promise and gated compatibility action exactly', () => {
    expect(homePtBr.hero.promise).toBe('Prepare seu PC. Prove o resultado. Restaure com controle.');
    expect(homeEn.hero.promise).toBe('Prepare your PC. Prove result. Restore control.');
    expect(homePtBr.hero.primaryAction.label).toBe('Verificar compatibilidade');
    expect(homeEn.hero.primaryAction.label).toBe('Check compatibility');
    expect(homePtBr.finalJourney.actionLabel).toBe('Verificar compatibilidade');
    expect(homeEn.finalJourney.actionLabel).toBe('Check compatibility');
    expect(homePtBr.availability).toBe('under-validation');
    expect(homeEn.availability).toBe('under-validation');
  });

  it('validates every evidence-bearing document and names every unproven boundary', () => {
    for (const record of [homePtBr, homeEn]) {
      const result = validateWebDocument(record.document);
      expect(result.ok).toBe(true);
      expect(record.document.validationState).toBe('validated');

      for (const chapter of record.chapters) {
        const evidence = record.document.evidence[chapter.evidenceIndex];
        expect(evidence).toBeDefined();
        expect(evidence?.source).toMatch(/^https:\/\/(?:www\.)?liiiraa\.com\//u);
        expect(evidence?.applicableVersion).toBe(record.document.version);
        expect(evidence?.validationState).toBe('validated');
        expect(evidence?.unproven).toBe(false);
        expect(chapter.unprovenBoundary.length).toBeGreaterThan(30);
      }
    }
  });

  it('fails the editorial anti-deception gate for forbidden commercial patterns', () => {
    const forbidden =
      /(?:\b\d+(?:[.,]\d+)?\s*%|\bcountdown\b|\btestimonial|\bone[- ]click\b|\bboost now\b|\bcontinue anyway\b|\bmilagre\b|\burgência\b|\bdepoimento\b|\bganho garantido\b|\bproblemas? encontrados?\b|\bum clique\b)/iu;

    expect(authoredText(homePtBr)).not.toMatch(forbidden);
    expect(authoredText(homeEn)).not.toMatch(forbidden);
  });

  it('binds the admitted real captures to Home screenshot and social asset records', async () => {
    const [ptBrProvenance, enProvenance] = await Promise.all([
      readFile(new URL('../public/product/desktop-home.pt-BR.json', import.meta.url), 'utf8').then(
        (source) => JSON.parse(source) as unknown,
      ),
      readFile(new URL('../public/product/desktop-home.en.json', import.meta.url), 'utf8').then(
        (source) => JSON.parse(source) as unknown,
      ),
    ]);
    const result = await admitContentBundle(
      [homePtBr, homeEn] as unknown as readonly RepositoryContentRecord[],
      {
        assetIndex: [
          {
            id: 'desktop-home-pt-BR-social',
            path: '/product/desktop-home.pt-BR.webp',
            purpose: 'social',
            provenance: ptBrProvenance,
          },
          {
            id: 'desktop-home-pt-BR',
            path: '/product/desktop-home.pt-BR.webp',
            purpose: 'screenshot',
            provenance: ptBrProvenance,
          },
          {
            id: 'desktop-home-en-social',
            path: '/product/desktop-home.en.webp',
            purpose: 'social',
            provenance: enProvenance,
          },
          {
            id: 'desktop-home-en',
            path: '/product/desktop-home.en.webp',
            purpose: 'screenshot',
            provenance: enProvenance,
          },
        ],
        clock: new Date('2026-07-31T12:00:00.000Z'),
        routeManifest: webRoutes,
      },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.records).toHaveLength(2);
    }
  });
});
