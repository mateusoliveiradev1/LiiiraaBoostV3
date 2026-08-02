import type { ReactNode } from 'react';
// @ts-expect-error The approved runtime includes react-dom, but @types/react-dom is not an approved identity.
import { renderToStaticMarkup as reactRenderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  documentationCatalog,
  DocumentationExperience,
  resolveDocumentationPage,
} from './features/documentation';

const renderToStaticMarkup = reactRenderToStaticMarkup as (node: ReactNode) => string;
const visibleText = (markup: string): string =>
  markup.replace(/<[^>]+>/gu, ' ').replace(/\s+/gu, ' ').trim();

const currentArticleRequest = () => {
  const document = documentationCatalog.find(
    (candidate) => candidate.identity.locale === 'en' && candidate.identity.version === 'current',
  );
  if (document === undefined) throw new Error('Current English documentation is missing.');
  const collection =
    document.kind === 'article'
      ? 'articles'
      : document.kind === 'reference'
        ? 'reference'
        : 'troubleshooting';
  return {
    document,
    request: {
      locale: 'en' as const,
      slug: [collection, document.identity.slug],
      version: 'current',
    },
  };
};

describe('authored documentation rhythm', () => {
  it('leads with purpose and next action before evidence, risks, compatibility, recovery, and detail', () => {
    const { document, request } = currentArticleRequest();
    expect(resolveDocumentationPage(request)).toMatchObject({ kind: 'article', status: 'current' });

    const markup = renderToStaticMarkup(<DocumentationExperience request={request} />);
    const readingOrder = [
      'purpose',
      'next-action',
      'evidence',
      'risks',
      'compatibility',
      'recovery',
      'technical-detail',
    ];

    expect(document.sections.map(({ kind }) => kind)).toEqual(readingOrder);
    for (const [index, kind] of readingOrder.entries()) {
      const hook = `data-documentation-kind="${kind}"`;
      expect(markup).toContain(hook);
      if (index > 0) {
        expect(markup.indexOf(hook)).toBeGreaterThan(
          markup.indexOf(`data-documentation-kind="${readingOrder[index - 1] ?? ''}"`),
        );
      }
    }
  });

  it('keeps version, ownership, release references, and identifiers in invoked technical context', () => {
    const { request } = currentArticleRequest();
    const markup = renderToStaticMarkup(<DocumentationExperience request={request} />);

    expect(markup).toContain('<details class="documentation-technical-context">');
    expect(markup).not.toContain('<details class="documentation-technical-context" open=""');
    expect(markup.indexOf('lb-web-route-header')).toBeLessThan(
      markup.indexOf('documentation-technical-context'),
    );
    expect(markup).toContain('documentation-deep-detail');
  });

  it('preserves task index, version control, search, and detail at narrow widths', async () => {
    const markup = renderToStaticMarkup(
      <DocumentationExperience request={{ locale: 'pt-BR', version: 'current' }} />,
    );
    const styles = await import('node:fs/promises').then(({ readFile }) =>
      readFile(new URL('./styles/public.css', import.meta.url), 'utf8'),
    );

    expect(markup).toContain('documentation-index-workspace');
    expect(markup).toContain('lb-web-version-selector');
    expect(markup).toContain('role="search"');
    expect(styles).toMatch(
      /@media \(width < 640px\)[\s\S]*\.documentation-index-workspace[\s\S]*min-inline-size:\s*0/u,
    );
    expect(styles).not.toMatch(/\.documentation-article-flow\s*\{[\s\S]*overflow-x:\s*auto/u);
  });

  it('presents the documentation index as visitor tasks without raw route identifiers', () => {
    const markup = renderToStaticMarkup(
      <DocumentationExperience request={{ locale: 'pt-BR', version: 'current' }} />,
    );
    const text = visibleText(markup);

    expect(text).toContain('Central de ajuda');
    expect(text).toContain('Guias atuais');
    expect(text).not.toMatch(/\b(?:current|stable|getting-started|preparing|measuring|optimizing|restoring)\b/u);
    expect(markup).toContain('documentation-task-card');
  });

  it('keeps historical guidance explicit and canonical instead of redirecting it away', () => {
    const historical = documentationCatalog.find(
      (candidate) => candidate.identity.locale === 'en' && candidate.identity.version === '1.0.0',
    );
    if (historical === undefined) throw new Error('Historical documentation is missing.');
    const resolution = resolveDocumentationPage({
      locale: 'en',
      slug: ['1.0.0', historical.identity.slug],
      version: 'history',
    });

    expect(resolution).toMatchObject({ kind: 'article', status: 'stale' });
    if (resolution?.kind !== 'article') throw new Error('Historical route did not resolve.');
    const markup = renderToStaticMarkup(
      <DocumentationExperience
        request={{
          locale: 'en',
          slug: ['1.0.0', historical.identity.slug],
          version: 'history',
        }}
      />,
    );
    expect(markup).toContain('Historical documentation');
    expect(markup).toContain('Open the current canonical version');
  });
});
