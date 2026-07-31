'use client';

import { useEffect, useRef } from 'react';
import type { WebLocale } from '@liiiraa/web-core';

import { accountBoundaryHref, publicBoundaryHref, routing } from '../public-boundary';

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
  return routing.locales.find((locale) => locale === requested) ?? 'pt-BR';
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
  routeId,
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
        <code>{routeId}</code>
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
            'Esta origem pública não tem a autoridade necessária para abrir o recurso solicitado. Nenhum dado protegido foi exibido.',
          diagnosticLabel: 'Correlação opaca',
          home: 'Voltar ao início',
          reason: 'Permissão insuficiente nesta fronteira',
          reasonLabel: 'Motivo',
          recovery:
            'Volte ao conteúdo público ou abra a entrada de conta em sua origem própria. Não há redirecionamento automático.',
          signIn: 'Abrir entrada de conta',
          support: 'Consultar suporte público',
          title: 'Este recurso exige outra permissão',
        }
      : {
          detail:
            'This public origin does not have the authority required to open the requested resource. No protected data was displayed.',
          diagnosticLabel: 'Opaque correlation',
          home: 'Return home',
          reason: 'Insufficient permission at this boundary',
          reasonLabel: 'Reason',
          recovery:
            'Return to public content or open account entry on its separate origin. There is no automatic redirect.',
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
          href: publicBoundaryHref('public-home', locale),
          label: copy.home,
          primary: true,
        },
        {
          href: accountBoundaryHref(locale),
          label: copy.signIn,
        },
        {
          href: publicBoundaryHref('public-support', locale),
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
          diagnosticLabel: 'Identidade histórica redigida',
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
          diagnosticLabel: 'Redacted historical identity',
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
          href: publicBoundaryHref('docs-index', locale),
          label: copy.docs,
          primary: true,
        },
        {
          href: publicBoundaryHref('public-compatibility', locale),
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
            'A página não pôde concluir esta solicitação. Nenhuma pilha, caminho, valor de requisição ou detalhe interno foi exibido.',
          diagnosticLabel: 'Correlação opaca',
          home: 'Voltar ao início',
          reason: 'Falha interna redigida',
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
            'The page could not complete this request. No stack, path, request value, or internal detail was displayed.',
          diagnosticLabel: 'Opaque correlation',
          home: 'Return home',
          reason: 'Redacted internal failure',
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
          href: publicBoundaryHref('public-status', locale),
          label: copy.status,
          primary: true,
        },
        {
          href: publicBoundaryHref('public-support', locale),
          label: copy.support,
        },
        {
          href: publicBoundaryHref('public-home', locale),
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
