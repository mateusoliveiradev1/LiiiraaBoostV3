'use client';

import { useEffect, useRef } from 'react';
import type { WebLocale } from '@liiiraa/web-core';

import {
  CLIENT_WEB_LOCALES,
  clientAccountBoundaryHref,
  clientPublicBoundaryHref,
} from '../public-client-boundary';

type RecoveryDestination = Readonly<{
  href: string;
  label: string;
  primary?: boolean;
}>;

type PublicFailureStateProps = Readonly<{
  code: '403' | '410' | '500';
  correlationId?: string | undefined;
  detail: string;
  diagnosticLabel: string;
  destinations: readonly RecoveryDestination[];
  reason: string;
  reasonLabel: string;
  recovery: string;
  retry?:
    | Readonly<{
        action: () => void;
        label: string;
      }>
    | undefined;
  routeId: 'public-error-403' | 'public-error-410' | 'public-error-500';
  title: string;
}>;

export const localeFromFailureParams = (
  value: string | readonly string[] | undefined,
): WebLocale => {
  const requested = typeof value === 'string' ? value : value?.[0];
  return CLIENT_WEB_LOCALES.find((locale) => locale === requested) ?? 'pt-BR';
};

export const opaqueErrorCorrelation = (digest: string | undefined): string =>
  digest !== undefined && /^[A-Za-z0-9_-]{6,32}$/u.test(digest)
    ? `LB-WEB-${digest}`
    : 'LB-WEB-500-REDACTED';

const PublicFailureState = ({
  code,
  correlationId,
  detail,
  diagnosticLabel,
  destinations,
  reason,
  reasonLabel,
  recovery,
  retry,
  title,
}: PublicFailureStateProps) => {
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  return (
    <section aria-labelledby={`public-failure-${code}-title`} className="public-not-found">
      <div className="public-not-found__identity">
        <span aria-hidden="true">{code}</span>
      </div>
      <div className="public-not-found__content">
        <p className="public-failure__reason">
          <strong>{reasonLabel}:</strong> {reason}
        </p>
        <h1 autoFocus id={`public-failure-${code}-title`} ref={titleRef} tabIndex={-1}>
          {title}
        </h1>
        <p>{detail}</p>
        <p className="public-not-found__recovery">{recovery}</p>
        <nav aria-label={recovery} className="public-not-found__actions">
          {destinations.map((destination) => (
            <a
              className={
                destination.primary ? 'public-action public-action--primary' : 'public-action'
              }
              href={destination.href}
              key={destination.href}
            >
              {destination.label}
            </a>
          ))}
          {retry !== undefined && (
            <button className="public-action" onClick={retry.action} type="button">
              {retry.label}
            </button>
          )}
        </nav>
        <p className="public-not-found__diagnostic">
          <span>{diagnosticLabel}</span>
          <code>{correlationId ?? `LB-WEB-${code}-REDACTED`}</code>
        </p>
      </div>
    </section>
  );
};

export const ForbiddenState = ({ locale }: Readonly<{ locale: WebLocale }>) => {
  const copy =
    locale === 'pt-BR'
      ? {
          detail:
            'Esta página é protegida e não pôde ser aberta com o acesso atual. Nenhum dado da conta foi exibido.',
          diagnosticLabel: 'Código para o suporte',
          home: 'Voltar ao início',
          reason: 'É necessário entrar com a conta correta',
          reasonLabel: 'Motivo',
          recovery:
            'O site público e a documentação continuam seguros para uso. Entre na conta ou escolha outra página; nada será redirecionado sem sua ação.',
          signIn: 'Abrir entrada de conta',
          support: 'Consultar suporte público',
          title: 'Este recurso exige outra permissão',
        }
      : {
          detail:
            'This protected page could not be opened with the current access. No account data was displayed.',
          diagnosticLabel: 'Support code',
          home: 'Return home',
          reason: 'The correct account sign-in is required',
          reasonLabel: 'Reason',
          recovery:
            'The public site and documentation remain safe to use. Sign in or choose another page; nothing redirects without your action.',
          signIn: 'Open account entry',
          support: 'Review public support',
          title: 'This resource requires another permission',
        };

  return (
    <PublicFailureState
      code="403"
      detail={copy.detail}
      diagnosticLabel={copy.diagnosticLabel}
      destinations={[
        {
          href: clientPublicBoundaryHref('public-home', locale),
          label: copy.home,
          primary: true,
        },
        {
          href: clientAccountBoundaryHref(locale),
          label: copy.signIn,
        },
        {
          href: clientPublicBoundaryHref('public-support', locale),
          label: copy.support,
        },
      ]}
      reason={copy.reason}
      reasonLabel={copy.reasonLabel}
      recovery={copy.recovery}
      routeId="public-error-403"
      title={copy.title}
    />
  );
};

export const GoneState = ({ locale }: Readonly<{ locale: WebLocale }>) => {
  const copy =
    locale === 'pt-BR'
      ? {
          compatibility: 'Ver compatibilidade atual',
          detail:
            'O conteúdo existiu, mas não é mais uma fonte atual ou acionável. O contexto histórico foi preservado sem manter uma instrução obsoleta ativa.',
          diagnosticLabel: 'Código para o suporte',
          docs: 'Abrir documentação atual',
          reason: 'Versão ou conteúdo retirado',
          reasonLabel: 'Estado',
          recovery:
            'Use a alternativa canônica atual abaixo. A página não redireciona automaticamente para esconder a retirada.',
          title: 'Este conteúdo foi retirado',
        }
      : {
          compatibility: 'Review current compatibility',
          detail:
            'The content existed, but it is no longer a current or actionable source. Historical context is preserved without keeping obsolete guidance active.',
          diagnosticLabel: 'Support code',
          docs: 'Open current documentation',
          reason: 'Retired version or content',
          reasonLabel: 'State',
          recovery:
            'Use the current canonical alternative below. The page does not redirect automatically to hide the retirement.',
          title: 'This content has been retired',
        };

  return (
    <PublicFailureState
      code="410"
      detail={copy.detail}
      diagnosticLabel={copy.diagnosticLabel}
      destinations={[
        {
          href: clientPublicBoundaryHref('docs-index', locale),
          label: copy.docs,
          primary: true,
        },
        {
          href: clientPublicBoundaryHref('public-compatibility', locale),
          label: copy.compatibility,
        },
      ]}
      reason={copy.reason}
      reasonLabel={copy.reasonLabel}
      recovery={copy.recovery}
      routeId="public-error-410"
      title={copy.title}
    />
  );
};

export const ServerFailureState = ({
  correlationId,
  locale,
  retry,
}: Readonly<{
  correlationId?: string | undefined;
  locale: WebLocale;
  retry?: (() => void) | undefined;
}>) => {
  const copy =
    locale === 'pt-BR'
      ? {
          detail:
            'A página não conseguiu concluir esta solicitação. O restante do site público e a documentação continuam disponíveis.',
          diagnosticLabel: 'Código para o suporte',
          home: 'Voltar ao início',
          reason: 'Falha temporária nesta solicitação',
          reasonLabel: 'Estado',
          recovery:
            'Tente novamente uma vez. Se a falha continuar, consulte o status e use o suporte público com o identificador opaco.',
          retry: 'Tentar novamente',
          status: 'Consultar status',
          support: 'Abrir suporte',
          title: 'Não foi possível concluir',
        }
      : {
          detail:
            'The page could not complete this request. The rest of the public site and documentation remain available.',
          diagnosticLabel: 'Support code',
          home: 'Return home',
          reason: 'Temporary failure for this request',
          reasonLabel: 'State',
          recovery:
            'Try once more. If the failure continues, check status and use public support with the opaque identifier.',
          retry: 'Try again',
          status: 'Check status',
          support: 'Open support',
          title: 'The request could not be completed',
        };

  return (
    <PublicFailureState
      code="500"
      correlationId={correlationId}
      detail={copy.detail}
      diagnosticLabel={copy.diagnosticLabel}
      destinations={[
        {
          href: clientPublicBoundaryHref('public-status', locale),
          label: copy.status,
          primary: true,
        },
        {
          href: clientPublicBoundaryHref('public-support', locale),
          label: copy.support,
        },
        {
          href: clientPublicBoundaryHref('public-home', locale),
          label: copy.home,
        },
      ]}
      reason={copy.reason}
      reasonLabel={copy.reasonLabel}
      recovery={copy.recovery}
      retry={retry === undefined ? undefined : { action: retry, label: copy.retry }}
      routeId="public-error-500"
      title={copy.title}
    />
  );
};

const PublicAvailabilityState = ({
  affected,
  destinations,
  locale,
  preserved,
  state,
  title,
}: Readonly<{
  affected: string;
  destinations: readonly RecoveryDestination[];
  locale: WebLocale;
  preserved: string;
  state: 'offline' | 'partial';
  title: string;
}>) => (
  <section
    aria-labelledby={`public-${state}-title`}
    className="public-availability-state"
    data-state={state}
  >
    <span
      className="catalog-state"
      data-state={state === 'offline' ? 'unavailable' : 'under-validation'}
    >
      {state === 'offline' ? 'Offline' : locale === 'pt-BR' ? 'Parcial' : 'Partial'}
    </span>
    <h1 id={`public-${state}-title`} tabIndex={-1}>
      {title}
    </h1>
    <dl>
      <div>
        <dt>
          {state === 'offline'
            ? locale === 'pt-BR'
              ? 'Indisponível agora'
              : 'Unavailable now'
            : locale === 'pt-BR'
              ? 'Recurso afetado'
              : 'Affected capability'}
        </dt>
        <dd>{affected}</dd>
      </div>
      <div>
        <dt>{locale === 'pt-BR' ? 'Continua seguro e disponível' : 'Still safe and available'}</dt>
        <dd>{preserved}</dd>
      </div>
    </dl>
    <nav aria-label={title} className="public-not-found__actions">
      {destinations.map((destination) => (
        <a
          className={destination.primary ? 'public-action public-action--primary' : 'public-action'}
          href={destination.href}
          key={destination.href}
        >
          {destination.label}
        </a>
      ))}
    </nav>
  </section>
);

export const PublicLoadingState = ({ locale }: Readonly<{ locale: WebLocale }>) => (
  <section
    aria-busy="true"
    aria-label={locale === 'pt-BR' ? 'Carregando conteúdo' : 'Loading content'}
    className="public-loading-state"
  >
    <span className="public-loading-state__line" />
    <span className="public-loading-state__title" />
    <span className="public-loading-state__copy" />
    <span className="public-loading-state__copy public-loading-state__copy--short" />
  </section>
);

export const PublicOfflineState = ({ locale }: Readonly<{ locale: WebLocale }>) => (
  <PublicAvailabilityState
    affected={
      locale === 'pt-BR'
        ? 'Busca, status ao vivo e abertura de links externos'
        : 'Search, live status, and external links'
    }
    destinations={[
      {
        href: clientPublicBoundaryHref('docs-index', locale),
        label: locale === 'pt-BR' ? 'Abrir ajuda disponível' : 'Open available help',
        primary: true,
      },
      {
        href: clientPublicBoundaryHref('public-home', locale),
        label: locale === 'pt-BR' ? 'Voltar ao início' : 'Return home',
      },
    ]}
    locale={locale}
    preserved={
      locale === 'pt-BR'
        ? 'Páginas já carregadas e orientação pública que está neste navegador'
        : 'Loaded pages and public guidance already in this browser'
    }
    state="offline"
    title={locale === 'pt-BR' ? 'Você está sem conexão' : 'You are offline'}
  />
);

export const PublicPartialFailureState = ({ locale }: Readonly<{ locale: WebLocale }>) => (
  <PublicAvailabilityState
    affected={
      locale === 'pt-BR'
        ? 'Uma parte desta página não pôde ser atualizada'
        : 'One part of this page could not be refreshed'
    }
    destinations={[
      {
        href: clientPublicBoundaryHref('public-status', locale),
        label: locale === 'pt-BR' ? 'Ver status' : 'Check status',
        primary: true,
      },
      {
        href: clientPublicBoundaryHref('public-support', locale),
        label: locale === 'pt-BR' ? 'Abrir suporte' : 'Open support',
      },
    ]}
    locale={locale}
    preserved={
      locale === 'pt-BR'
        ? 'O conteúdo identificado como atual permanece disponível; ações ambíguas continuam bloqueadas'
        : 'Content identified as current remains available; ambiguous actions stay blocked'
    }
    state="partial"
    title={
      locale === 'pt-BR'
        ? 'Parte do serviço está indisponível'
        : 'Part of the service is unavailable'
    }
  />
);
