'use client';

import { createElement, useEffect, useRef } from 'react';
import type { WebLocale } from '@liiiraa/web-core';

import { clientPublicBoundaryHref } from './public-client-boundary';

type PublicLocale = WebLocale;

type NotFoundCopy = Readonly<{
  detail: string;
  diagnostics: string;
  documentation: string;
  home: string;
  recovery: string;
  support: string;
  title: string;
}>;

const COPY = Object.freeze({
  'pt-BR': Object.freeze({
    detail:
      'O endereço não corresponde a uma página pública disponível. Nenhum dado de solicitação foi exibido.',
    diagnostics: 'Código para o suporte',
    documentation: 'Abrir documentação',
    home: 'Voltar ao início',
    recovery: 'Escolha um destino seguro para continuar.',
    support: 'Consultar suporte',
    title: 'Página não encontrada',
  }),
  en: Object.freeze({
    detail:
      'The address does not match an available public page. No request data has been displayed.',
    diagnostics: 'Support code',
    documentation: 'Open documentation',
    home: 'Return home',
    recovery: 'Choose a safe destination to continue.',
    support: 'View support',
    title: 'Page not found',
  }),
} satisfies Record<PublicLocale, NotFoundCopy>);

export const createPublicNotFoundModel = (locale: PublicLocale) =>
  Object.freeze({
    copy: COPY[locale],
    diagnosticId: 'LB-WEB-404',
    destinations: Object.freeze({
      documentation: clientPublicBoundaryHref('docs-index', locale),
      home: clientPublicBoundaryHref('public-home', locale),
      support: clientPublicBoundaryHref('public-support', locale),
    }),
    routeId: 'public-error-404',
  });

export const PublicNotFound = ({ locale }: { readonly locale: PublicLocale }) => {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const model = createPublicNotFoundModel(locale);
  const { copy } = model;

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  return createElement(
    'section',
    {
      'aria-labelledby': 'public-not-found-title',
      className: 'public-not-found',
    },
    createElement(
      'div',
      { className: 'public-not-found__identity' },
      createElement('span', { 'aria-hidden': true }, '404'),
    ),
    createElement(
      'div',
      { className: 'public-not-found__content' },
      createElement(
        'h1',
        {
          id: 'public-not-found-title',
          ref: titleRef,
          tabIndex: -1,
        },
        copy.title,
      ),
      createElement('p', null, copy.detail),
      createElement('p', { className: 'public-not-found__recovery' }, copy.recovery),
      createElement(
        'nav',
        {
          'aria-label': copy.recovery,
          className: 'public-not-found__actions',
        },
        createElement(
          'a',
          {
            className: 'public-action public-action--primary',
            href: model.destinations.home,
          },
          copy.home,
        ),
        createElement(
          'a',
          {
            className: 'public-action',
            href: model.destinations.documentation,
          },
          copy.documentation,
        ),
        createElement(
          'a',
          {
            className: 'public-action',
            href: model.destinations.support,
          },
          copy.support,
        ),
      ),
      createElement(
        'p',
        { className: 'public-not-found__diagnostic' },
        createElement('span', null, copy.diagnostics),
        createElement('code', null, model.diagnosticId),
      ),
    ),
  );
};
