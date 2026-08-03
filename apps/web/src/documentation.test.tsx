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
  markup
    .replace(/<[^>]+>/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();

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
    expect(markup).toContain('class="documentation-navigation"');
    expect(markup).toContain('class="documentation-quick-guides" open=""');
    expect(markup).toContain('role="search"');
    expect(markup).toMatch(/<nav aria-label="Guias rápidos"/u);
    expect(markup).toMatch(/<a href="\/pt-BR\/docs\/current\//u);
    expect(styles).toMatch(
      /@media \(width < 640px\)[\s\S]*\.documentation-index-workspace[\s\S]*min-inline-size:\s*0/u,
    );
    expect(styles).not.toMatch(/\.documentation-article-flow\s*\{[\s\S]*overflow-x:\s*auto/u);
    expect(styles).toMatch(
      /\.documentation-navigation[\s\S]*min-inline-size:\s*0[\s\S]*overflow-wrap:\s*anywhere/u,
    );
    expect(styles).toMatch(
      /\.documentation-navigation a[\s\S]*min-block-size:\s*44px[\s\S]*text-underline-offset/u,
    );
    expect(styles).toMatch(/\.documentation-navigation a:focus-visible/u);
  });

  it('presents the documentation index as visitor tasks without raw route identifiers', async () => {
    const markup = renderToStaticMarkup(
      <DocumentationExperience request={{ locale: 'pt-BR', version: 'current' }} />,
    );
    const text = visibleText(markup);
    const styles = await import('node:fs/promises').then(({ readFile }) =>
      readFile(new URL('./styles/public.css', import.meta.url), 'utf8'),
    );

    expect(text).toContain('Central de ajuda');
    expect(text).toContain('Guias atuais');
    expect(text).toContain('Como podemos ajudar?');
    expect(text).toContain('Escolha o que você quer fazer');
    expect(text).toContain('Instalar o Liiiraa Boost');
    expect(text).toContain('Usar o Modo Competitivo');
    expect(text).toContain('Medir e comparar desempenho');
    expect(text).toContain('Restaurar alterações');
    expect(text).toContain('Verificar PC e dispositivo');
    expect(text).toContain('Controlar dados e privacidade');
    expect(text).toContain('Atualizar o aplicativo');
    expect(text).toContain('Resolver um código de erro');
    expect(text).not.toContain('Índice da documentação');
    expect(text).not.toMatch(
      /\b(?:current|stable|getting-started|preparing|measuring|optimizing|restoring)\b/u,
    );
    expect(markup).toContain('documentation-help-paths');
    expect(markup).toContain('documentation-technical-links');
    const taskWorkspace = markup.slice(markup.indexOf('documentation-index-workspace'));
    expect(visibleText(taskWorkspace)).not.toContain('LB-ERR:0x80070005');
    expect(visibleText(taskWorkspace)).not.toContain('identificadores de evidência');
    expect(markup).toContain('class="lb-web-route-header lb-web-route-header--documentation"');
    expect(styles).toMatch(
      /\.lb-web-route-header\.lb-web-route-header--documentation\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)/u,
    );
  });

  it('finds customer tasks beyond the admitted article corpus', () => {
    const markup = renderToStaticMarkup(
      <DocumentationExperience
        request={{ locale: 'pt-BR', searchParams: { q: 'modo competitivo' }, version: 'current' }}
      />,
    );

    expect(markup).toContain('data-result-kind="help-path"');
    expect(visibleText(markup)).toContain('Usar o Modo Competitivo');
    expect(markup).toContain('href="/pt-BR/product#competitive-mode"');
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
