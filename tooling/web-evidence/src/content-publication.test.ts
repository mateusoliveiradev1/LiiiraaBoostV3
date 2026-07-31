import { describe, expect, it } from 'vitest';

import {
  inspectContentPublicationEvidence,
  inspectWorkspaceReadiness,
  type ContentPublicationEvidence,
} from './web-evidence-harness.js';

const completeContentEvidence = (): ContentPublicationEvidence => ({
  asOf: '2026-07-31',
  documents: [
    {
      evidenceIds: ['claim-policy-v1'],
      id: 'evidence-policy',
      locales: ['pt-BR', 'en'],
      reviewBy: '2026-12-31',
      screenshotIds: ['W01-home'],
      searchIndexed: true,
    },
  ],
  release: {
    channel: 'stable',
    contentVersion: '1.0.0',
    manifestVersion: '1.0.0',
  },
});

describe('web evidence harness self-test: content publication', () => {
  it('accepts a complete isolated publication fixture', () => {
    expect(inspectContentPublicationEvidence(completeContentEvidence())).toEqual({
      diagnostics: [],
      ok: true,
    });
  });

  it.each([
    [
      'untranslated content',
      (fixture: ContentPublicationEvidence) => ({
        ...fixture,
        documents: fixture.documents.map((document) => ({ ...document, locales: ['pt-BR'] })),
      }),
      'MISSING_CONTENT_LOCALE',
    ],
    [
      'stale content',
      (fixture: ContentPublicationEvidence) => ({
        ...fixture,
        documents: fixture.documents.map((document) => ({
          ...document,
          reviewBy: '2026-01-01',
        })),
      }),
      'STALE_CONTENT',
    ],
    [
      'missing claim evidence',
      (fixture: ContentPublicationEvidence) => ({
        ...fixture,
        documents: fixture.documents.map((document) => ({ ...document, evidenceIds: [] })),
      }),
      'MISSING_CONTENT_EVIDENCE',
    ],
    [
      'missing screenshot evidence',
      (fixture: ContentPublicationEvidence) => ({
        ...fixture,
        documents: fixture.documents.map((document) => ({ ...document, screenshotIds: [] })),
      }),
      'MISSING_VISUAL_EVIDENCE',
    ],
    [
      'missing search index entry',
      (fixture: ContentPublicationEvidence) => ({
        ...fixture,
        documents: fixture.documents.map((document) => ({
          ...document,
          searchIndexed: false,
        })),
      }),
      'MISSING_SEARCH_INDEX_ENTRY',
    ],
    [
      'release/content mismatch',
      (fixture: ContentPublicationEvidence) => ({
        ...fixture,
        release: { ...fixture.release, contentVersion: '0.9.0' },
      }),
      'RELEASE_CONTENT_MISMATCH',
    ],
  ] as const)('detects %s with a stable diagnostic', (_name, mutate, expectedCode) => {
    expect(
      inspectContentPublicationEvidence(mutate(completeContentEvidence())).diagnostics[0]?.code,
    ).toBe(expectedCode);
  });
});

describe('workspace readiness: content publication', () => {
  it('fails closed for omitted WEB-01 publication evidence', () => {
    const result = inspectWorkspaceReadiness({
      requirement: 'WEB-01',
      repositoryRoot: 'Z:/isolated-empty-workspace',
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics.map(({ code }) => code)).toContain('MISSING_BUILD_ROOT');
  });
});
