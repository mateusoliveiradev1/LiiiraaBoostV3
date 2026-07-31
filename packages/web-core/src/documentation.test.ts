import { describe, expect, it } from 'vitest';

import {
  resolveDesktopDocumentationLink,
  resolveDocument,
  searchDocumentation,
  type DocumentationArticle,
} from './documentation.ts';

const section = (
  id: string,
  kind: DocumentationArticle['sections'][number]['kind'],
  body: string,
) => ({ id, kind, heading: id, body });

const article = (
  locale: 'pt-BR' | 'en',
  overrides: Partial<DocumentationArticle> = {},
): DocumentationArticle => ({
  identity: {
    locale,
    version: 'current',
    channel: 'stable',
    slug: 'measure-before-optimizing',
    section: 'measuring',
  },
  domain: 'measuring',
  kind: 'article',
  title: locale === 'pt-BR' ? 'Meça antes de otimizar' : 'Measure before optimizing',
  summary:
    locale === 'pt-BR'
      ? 'Crie uma linha de base antes de mudar o sistema.'
      : 'Create a baseline before changing the system.',
  platform: ['windows-10', 'windows-11'],
  risk: 'low',
  metadata: {
    lastReviewedAt: '2026-07-30T12:00:00.000Z',
    owner: 'docs-content',
    validationState: 'validated',
    evidenceReferences: ['LB-EVIDENCE-001'],
    releaseReferences: ['1.0.0'],
  },
  sections: [
    section('technical', 'technical-detail', 'Collector identifier LB-COLLECTOR.'),
    section('compatibility', 'compatibility', 'Windows 10 and Windows 11.'),
    section('purpose', 'purpose', 'Understand the current baseline.'),
    section('recovery', 'recovery', 'Discard the capture and collect again.'),
    section('risks', 'risks', 'Collection has low overhead.'),
    section('evidence', 'evidence', 'Review frametime evidence.'),
    section('next-action', 'next-action', 'Start a baseline capture.'),
  ],
  identifiers: ['LB-COLLECTOR', 'WIN11-24H2'],
  errorCodes: [],
  supported: true,
  ...overrides,
});

const historical = (locale: 'pt-BR' | 'en'): DocumentationArticle =>
  article(locale, {
    identity: {
      locale,
      version: '1.0.0',
      channel: 'beta',
      slug: 'legacy-capture',
      section: 'measuring',
    },
    title: locale === 'pt-BR' ? 'Captura beta histórica' : 'Historical beta capture',
    supported: false,
    canonicalIdentity: {
      locale,
      version: 'current',
      channel: 'stable',
      slug: 'measure-before-optimizing',
      section: 'measuring',
    },
  });

const troubleshooting = (locale: 'pt-BR' | 'en'): DocumentationArticle =>
  article(locale, {
    identity: {
      locale,
      version: 'current',
      channel: 'stable',
      slug: 'lb-err-0x80070005',
      section: 'troubleshooting',
    },
    domain: 'troubleshooting',
    kind: 'troubleshooting',
    title: locale === 'pt-BR' ? 'Diagnosticar LB-ERR:0x80070005' : 'Diagnose LB-ERR:0x80070005',
    summary:
      locale === 'pt-BR'
        ? 'Confirme o estado observado antes da recuperação.'
        : 'Confirm the observed state before recovery.',
    risk: 'high',
    identifiers: ['ACL-WIN32'],
    errorCodes: ['LB-ERR:0x80070005'],
    troubleshooting: {
      observedState: 'The capture cannot read the selected source.',
      evidence: ['Confirm the exact error code in the local activity record.'],
      safeSteps: ['Close the active capture and verify the selected source.'],
      recovery: ['Return to the previous verified capture.'],
      escalation: 'Export the redacted diagnostic receipt for support.',
    },
  });

const catalog: readonly DocumentationArticle[] = [
  article('pt-BR'),
  article('en'),
  historical('pt-BR'),
  historical('en'),
  troubleshooting('pt-BR'),
  troubleshooting('en'),
];

describe('versioned documentation', () => {
  it('resolves exact current locale, version, channel and progressively ordered sections', () => {
    const result = resolveDocument(catalog, {
      locale: 'pt-BR',
      version: 'current',
      channel: 'stable',
      slug: 'measure-before-optimizing',
      section: 'measuring',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.status).toBe('current');
    expect(result.value.document.metadata).toMatchObject({
      owner: 'docs-content',
      validationState: 'validated',
      evidenceReferences: ['LB-EVIDENCE-001'],
    });
    expect(result.value.document.sections.map(({ kind }) => kind)).toEqual([
      'purpose',
      'next-action',
      'evidence',
      'risks',
      'compatibility',
      'recovery',
      'technical-detail',
    ]);
    expect(result.value.href).toBe(
      'https://liiiraa.com/pt-BR/docs/current/articles/measure-before-optimizing',
    );
  });

  it('keeps historical unsupported documentation reachable with a persistent canonical notice', () => {
    const result = resolveDocument(catalog, {
      locale: 'en',
      version: '1.0.0',
      channel: 'beta',
      slug: 'legacy-capture',
      section: 'measuring',
    });

    expect(result.ok).toBe(true);
    if (!result.ok || result.value.status !== 'stale') return;

    expect(result.value.href).toBe('https://liiiraa.com/en/docs/history/1.0.0/legacy-capture');
    expect(result.value.notice).toMatchObject({
      persistent: true,
      reason: 'unsupported',
      canonical: {
        identity: {
          locale: 'en',
          version: 'current',
          channel: 'stable',
          slug: 'measure-before-optimizing',
          section: 'measuring',
        },
        href: 'https://liiiraa.com/en/docs/current/articles/measure-before-optimizing',
      },
    });
  });

  it('offers explicit locale and version fallbacks without silently changing identity', () => {
    const missingLocale = resolveDocument(catalog, {
      locale: 'pt-BR',
      version: 'current',
      channel: 'stable',
      slug: 'lb-err-0x80070005',
      section: 'troubleshooting',
    });
    const missingVersion = resolveDocument(catalog, {
      locale: 'en',
      version: '1.0.0',
      channel: 'stable',
      slug: 'measure-before-optimizing',
      section: 'measuring',
    });

    expect(missingLocale.ok).toBe(true);
    expect(missingVersion).toMatchObject({
      ok: false,
      error: {
        code: 'INCOMPATIBLE_VERSION',
        fallbackIdentity: {
          locale: 'en',
          version: 'current',
          channel: 'stable',
          slug: 'measure-before-optimizing',
          section: 'measuring',
        },
      },
    });

    const englishOnly = catalog.filter(
      ({ identity }) =>
        !(identity.locale === 'pt-BR' && identity.slug === 'measure-before-optimizing'),
    );
    expect(
      resolveDocument(englishOnly, {
        locale: 'pt-BR',
        version: 'current',
        channel: 'stable',
        slug: 'measure-before-optimizing',
        section: 'measuring',
      }),
    ).toMatchObject({
      ok: false,
      error: {
        code: 'INCOMPATIBLE_LOCALE',
        fallbackIdentity: {
          locale: 'en',
          version: 'current',
        },
      },
    });
  });

  it('searches natural terms, identifiers and error codes with exact filters', () => {
    const natural = searchDocumentation(catalog, {
      query: 'linha de base',
      filters: {
        locale: 'pt-BR',
        version: 'current',
        channel: 'stable',
        platform: 'windows-11',
        risk: 'low',
        domain: 'measuring',
      },
    });
    const technical = searchDocumentation(catalog, {
      query: 'ACL-WIN32',
      filters: {
        locale: 'en',
        version: 'current',
        platform: 'windows-10',
        risk: 'high',
        domain: 'troubleshooting',
      },
    });
    const errorCode = searchDocumentation(catalog, {
      query: 'LB-ERR:0x80070005',
      filters: { locale: 'en', domain: 'troubleshooting' },
    });

    expect(natural.results[0]?.document.identity.slug).toBe('measure-before-optimizing');
    expect(technical.results[0]?.document.identity.slug).toBe('lb-err-0x80070005');
    expect(errorCode.results[0]).toMatchObject({
      matchedBy: 'error-code',
      document: {
        troubleshooting: {
          observedState: 'The capture cannot read the selected source.',
          recovery: ['Return to the previous verified capture.'],
          escalation: 'Export the redacted diagnostic receipt for support.',
        },
      },
    });
  });

  it('resolves only an exact compatible desktop article section', () => {
    const result = resolveDesktopDocumentationLink(catalog, {
      locale: 'en',
      version: 'current',
      channel: 'stable',
      slug: 'measure-before-optimizing',
      section: 'measuring',
      articleSectionId: 'evidence',
    });

    expect(result).toEqual({
      ok: true,
      value: {
        identity: {
          locale: 'en',
          version: 'current',
          channel: 'stable',
          slug: 'measure-before-optimizing',
          section: 'measuring',
        },
        articleSectionId: 'evidence',
        href: 'https://liiiraa.com/en/docs/current/articles/measure-before-optimizing#evidence',
        routeId: 'docs-article',
      },
    });
  });

  it.each([
    {
      name: 'incompatible historical article',
      intent: {
        locale: 'en',
        version: '1.0.0',
        channel: 'beta',
        slug: 'legacy-capture',
        section: 'measuring',
        articleSectionId: 'evidence',
      },
      code: 'INCOMPATIBLE_VERSION',
    },
    {
      name: 'unknown article section',
      intent: {
        locale: 'en',
        version: 'current',
        channel: 'stable',
        slug: 'measure-before-optimizing',
        section: 'measuring',
        articleSectionId: 'missing',
      },
      code: 'UNKNOWN_SECTION',
    },
    {
      name: 'unsafe path input',
      intent: {
        locale: 'en',
        version: 'current',
        channel: 'stable',
        slug: '../measure-before-optimizing',
        section: 'measuring',
        articleSectionId: 'evidence',
      },
      code: 'UNSAFE_IDENTITY',
    },
  ])('fails closed for $name', ({ intent, code }) => {
    expect(resolveDesktopDocumentationLink(catalog, intent as never)).toMatchObject({
      ok: false,
      error: { code },
    });
  });

  it('rejects generic mutation recipes instead of exposing them as technical content', () => {
    const unsafe = article('en', {
      sections: [
        section(
          'technical',
          'technical-detail',
          '```powershell\nSet-ItemProperty -Path HKLM:\\Software\\Example -Name Enabled -Value 1\n```',
        ),
      ],
    });

    expect(resolveDocument([unsafe], unsafe.identity)).toMatchObject({
      ok: false,
      error: { code: 'UNSAFE_CONTENT' },
    });
    expect(
      searchDocumentation([unsafe], {
        query: 'Set-ItemProperty',
        filters: { locale: 'en' },
      }).results,
    ).toEqual([]);
  });
});
