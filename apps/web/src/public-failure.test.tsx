import { isValidElement, type ReactNode } from 'react';
// @ts-expect-error The approved runtime includes react-dom, but @types/react-dom is not an approved identity.
import { renderToStaticMarkup as reactRenderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  ForbiddenState,
  GoneState,
  opaqueErrorCorrelation,
  PublicLoadingState,
  PublicOfflineState,
  PublicPartialFailureState,
  ServerFailureState,
} from './features/public-failure';
import { createPublicNotFoundModel, PublicNotFound } from './public-not-found';

const renderToStaticMarkup = reactRenderToStaticMarkup as (node: ReactNode) => string;
const visibleText = (markup: string): string =>
  markup
    .replace(/<[^>]+>/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();

type FailureElementProps = Readonly<{
  code: string;
  correlationId?: string;
  detail: string;
  destinations: readonly Readonly<{ href: string; label: string }>[];
  reason: string;
  recovery: string;
  routeId: string;
  title: string;
}>;

const failureProps = (element: unknown): FailureElementProps => {
  if (!isValidElement<FailureElementProps>(element)) {
    throw new Error('Expected authored public failure element.');
  }
  return element.props;
};

describe('403 404 410 500 authored public recovery', () => {
  it('keeps each failure class semantically distinct and locale-preserving', () => {
    for (const locale of ['pt-BR', 'en'] as const) {
      const forbidden = failureProps(ForbiddenState({ locale }));
      const notFound = createPublicNotFoundModel(locale);
      const gone = failureProps(GoneState({ locale }));
      const server = failureProps(ServerFailureState({ locale }));

      expect([forbidden.code, gone.code, server.code]).toEqual(['403', '410', '500']);
      expect([forbidden.routeId, gone.routeId, server.routeId]).toEqual([
        'public-error-403',
        'public-error-410',
        'public-error-500',
      ]);
      expect(new Set([forbidden.title, gone.title, server.title]).size).toBe(3);
      expect(new Set([forbidden.reason, gone.reason, server.reason]).size).toBe(3);
      expect(notFound.routeId).toBe('public-error-404');
      expect(notFound.copy.title).not.toBe(forbidden.title);
      expect(notFound.copy.title).not.toBe(gone.title);
      expect(notFound.copy.title).not.toBe(server.title);
      expect(gone.recovery).toMatch(/can[oô]nic|canônica/iu);
      expect(
        [forbidden, gone, server].every((state) =>
          state.destinations.every(({ href }) => href.includes(`/${locale}`)),
        ),
      ).toBe(true);
    }
  });

  it('explains what failed, what remains safe, and a localized recovery path', () => {
    for (const locale of ['pt-BR', 'en'] as const) {
      const forbidden = failureProps(ForbiddenState({ locale }));
      const server = failureProps(ServerFailureState({ locale }));

      expect(forbidden.detail).toMatch(/Nenhum dado da conta|No account data/iu);
      expect(forbidden.recovery).toMatch(/documentação|documentation/iu);
      expect(server.detail).toMatch(/restante do site público|rest of the public site/iu);
      expect(server.recovery).toMatch(/status/iu);
      expect(forbidden.destinations.some(({ href }) => href.includes(`/${locale}/login`))).toBe(
        true,
      );
      expect(server.destinations.some(({ href }) => href === `/${locale}/status`)).toBe(true);

      const renderedStates = [
        renderToStaticMarkup(ForbiddenState({ locale })),
        renderToStaticMarkup(<PublicNotFound locale={locale} />),
        renderToStaticMarkup(GoneState({ locale })),
        renderToStaticMarkup(ServerFailureState({ locale })),
      ];
      expect(renderedStates.every((markup) => !visibleText(markup).includes('public-error-'))).toBe(
        true,
      );
    }
  });

  it('redacts unsafe diagnostics and preserves only an opaque bounded digest', () => {
    expect(opaqueErrorCorrelation(undefined)).toBe('LB-WEB-500-REDACTED');
    expect(opaqueErrorCorrelation('C:\\private\\stack.ts:42')).toBe('LB-WEB-500-REDACTED');
    expect(opaqueErrorCorrelation('safeDigest_123')).toBe('LB-WEB-safeDigest_123');

    const markupSource = JSON.stringify(
      failureProps(ServerFailureState({ correlationId: 'LB-WEB-500-REDACTED', locale: 'en' })),
    );
    expect(markupSource).not.toMatch(/C:\\|\/Users\/|\.tsx?:\d+/u);
  });
});

describe('loading, offline, and partial availability', () => {
  it('renders a quiet loading state without fabricated content or diagnostics', () => {
    for (const locale of ['pt-BR', 'en'] as const) {
      const markup = renderToStaticMarkup(<PublicLoadingState locale={locale} />);

      expect(markup).toContain('aria-busy="true"');
      expect(markup).toContain('public-loading-state__title');
      expect(visibleText(markup)).toBe('');
      expect(markup).not.toMatch(/LB-WEB|version|versão|available|disponível/iu);
    }
  });

  it('names the affected capability, preserves safe content, and provides recovery', () => {
    for (const locale of ['pt-BR', 'en'] as const) {
      const offline = renderToStaticMarkup(<PublicOfflineState locale={locale} />);
      const partial = renderToStaticMarkup(<PublicPartialFailureState locale={locale} />);

      expect(visibleText(offline)).toMatch(/Busca, status|Search, live status/iu);
      expect(visibleText(offline)).toMatch(/Páginas já carregadas|Loaded pages/iu);
      expect(offline).toContain(`href="/${locale}/docs"`);
      expect(visibleText(partial)).toMatch(/parte desta página|part of this page/iu);
      expect(visibleText(partial)).toMatch(/conteúdo identificado|Content identified/iu);
      expect(partial).toContain(`href="/${locale}/status"`);
      expect(offline).not.toMatch(/stack|request-id|correlation/iu);
      expect(partial).not.toMatch(/stack|request-id|correlation/iu);
    }
  });
});
