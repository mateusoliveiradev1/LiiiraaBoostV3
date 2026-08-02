import {
  DOCUMENTATION_DOMAINS,
  DOCUMENTATION_PLATFORMS,
  WEB_CHANNELS,
  WEB_VERSIONS,
  resolveDocument,
  searchDocumentation,
  type DocumentIdentity,
  type DocumentationArticle,
  type DocumentationDomain,
  type DocumentationPlatform,
  type DocumentationSearchFilters,
  type WebChannel,
  type WebLocale,
  type WebVersion,
} from '@liiiraa/web-core';
import type { ReactNode } from 'react';

import documentationMetadata from '../content/docs/docs.metadata.json';

type SearchValue = string | readonly string[] | undefined;

export type DocumentationSearchParameters = Readonly<{
  channel?: SearchValue;
  domain?: SearchValue;
  platform?: SearchValue;
  q?: SearchValue;
  risk?: SearchValue;
}>;

export type DocumentationPageRequest = Readonly<{
  locale: WebLocale;
  searchParams?: DocumentationSearchParameters;
  slug?: readonly string[];
  version?: string;
}>;

export type DocumentationPageResolution = Readonly<
  | {
      kind: 'article';
      locale: WebLocale;
      document: DocumentationArticle;
      status: 'current' | 'stale';
      canonicalHref: string;
      href: string;
    }
  | {
      kind: 'index';
      locale: WebLocale;
      domain?: DocumentationDomain;
      version: WebVersion;
      channel: WebChannel;
    }
>;

const RISK_VALUES = Object.freeze(['none', 'low', 'medium', 'high', 'critical'] as const);
const SECTION_KINDS = Object.freeze([
  'purpose',
  'next-action',
  'evidence',
  'risks',
  'compatibility',
  'recovery',
  'technical-detail',
] as const);
const DOCUMENTATION_READING_ORDER = new Map(
  SECTION_KINDS.map((kind, index) => [kind, index] as const),
);

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const isOneOf = <Value extends string>(values: readonly Value[], value: unknown): value is Value =>
  typeof value === 'string' && values.includes(value as Value);

type LinkItem = Readonly<{ href: string; id: string; label: string }>;

const DocumentationIndex = ({
  items,
  label,
}: Readonly<{ items: readonly LinkItem[]; label: string }>) => (
  <nav aria-label={label} className="lb-web-documentation-index">
    <ul>
      {items.map((item) => (
        <li key={item.id}>
          <a href={item.href}>{item.label}</a>
        </li>
      ))}
    </ul>
  </nav>
);

const VersionSelector = ({ children, label }: Readonly<{ children: ReactNode; label: string }>) => (
  <div aria-label={label} className="lb-web-version-selector" role="group">
    {children}
  </div>
);

const ArticleMetadata = ({
  entries,
}: Readonly<{
  entries: readonly Readonly<{ label: string; value: ReactNode }>[];
}>) => (
  <dl className="lb-web-article-metadata">
    {entries.map((entry) => (
      <div key={entry.label}>
        <dt>{entry.label}</dt>
        <dd>{entry.value}</dd>
      </div>
    ))}
  </dl>
);

const BoundaryTransitionNotice = ({
  children,
  description,
  title,
}: Readonly<{ children?: ReactNode; description: string; title: string }>) => (
  <aside className="lb-web-boundary" role="note">
    <strong>{title}</strong>
    <p>{description}</p>
    {children}
  </aside>
);

const StaleDocumentNotice = ({
  canonicalHref,
  version,
}: Readonly<{ canonicalHref: string; version: string }>) => (
  <BoundaryTransitionNotice
    description={`Version ${version} is historical or unsupported. This page has not been redirected.`}
    title="Historical documentation"
  >
    <a href={canonicalHref}>Open the current canonical version</a>
  </BoundaryTransitionNotice>
);

const RouteHeader = ({ description, title }: Readonly<{ description: string; title: string }>) => (
  <header className="lb-web-route-header lb-web-route-header--documentation">
    <h1 tabIndex={-1}>{title}</h1>
    <p>{description}</p>
  </header>
);

const StatusSignal = ({
  label,
  state,
}: Readonly<{ label: string; state: 'stale' | 'success' | 'warning' }>) => (
  <span className="lb-web-status" data-state={state} role="status">
    <span aria-hidden="true">{state === 'success' ? '✓' : '•'}</span>
    <strong>{label}</strong>
  </span>
);

const EmptyComposition = ({ description }: Readonly<{ description: string }>) => (
  <section className="lb-web-empty">
    <p>{description}</p>
  </section>
);

const SemanticRegion = ({
  children,
  className,
  title,
}: Readonly<{ children: ReactNode; className: string; title: string }>) => (
  <section className={className}>
    <h2>{title}</h2>
    {children}
  </section>
);

const TroubleshootingPath = ({
  children,
  title,
}: Readonly<{ children: ReactNode; title: string }>) => (
  <SemanticRegion className="lb-web-troubleshooting" title={title}>
    {children}
  </SemanticRegion>
);

const ObservedStatePrompt = ({
  children,
  title,
}: Readonly<{ children: ReactNode; title: string }>) => (
  <SemanticRegion className="lb-web-observed-state" title={title}>
    {children}
  </SemanticRegion>
);

const RecoveryEscalation = ({
  children,
  title,
}: Readonly<{ children: ReactNode; title: string }>) => (
  <SemanticRegion className="lb-web-recovery-escalation" title={title}>
    {children}
  </SemanticRegion>
);

const metadataRoot = documentationMetadata as unknown;

const admitDocumentationCatalog = (candidate: unknown): readonly DocumentationArticle[] => {
  if (
    !isRecord(candidate) ||
    candidate['schemaVersion'] !== 1 ||
    !isString(candidate['lastReviewedAt']) ||
    !isRecord(candidate['sourceFiles']) ||
    candidate['sourceFiles']['en'] !== 'apps/web/src/content/docs/docs.en.mdx' ||
    candidate['sourceFiles']['pt-BR'] !== 'apps/web/src/content/docs/docs.pt-BR.mdx' ||
    !Array.isArray(candidate['records'])
  ) {
    throw new Error('DOCUMENTATION_METADATA_INVALID:root');
  }

  const keyedRecords = candidate['records'];
  const articles: DocumentationArticle[] = [];
  const parity = new Map<string, Map<WebLocale, readonly string[]>>();
  const identities = new Set<string>();

  for (const [index, value] of keyedRecords.entries()) {
    if (
      !isRecord(value) ||
      !isString(value['key']) ||
      !isRecord(value['identity']) ||
      !isOneOf(['pt-BR', 'en'] as const, value['identity']['locale']) ||
      !isOneOf(WEB_VERSIONS, value['identity']['version']) ||
      !isOneOf(WEB_CHANNELS, value['identity']['channel']) ||
      !isString(value['identity']['slug']) ||
      !isOneOf(DOCUMENTATION_DOMAINS, value['identity']['section']) ||
      !Array.isArray(value['sections'])
    ) {
      throw new Error(`DOCUMENTATION_METADATA_INVALID:record:${String(index)}`);
    }

    const identity = value['identity'] as DocumentIdentity;
    const identityKey = [
      identity.locale,
      identity.version,
      identity.channel,
      identity.section,
      identity.slug,
    ].join('|');
    if (identities.has(identityKey)) {
      throw new Error(`DOCUMENTATION_METADATA_INVALID:duplicate:${identityKey}`);
    }
    identities.add(identityKey);

    const sectionSignature = value['sections'].map((section, sectionIndex) => {
      if (
        !isRecord(section) ||
        !isString(section['id']) ||
        !isOneOf(SECTION_KINDS, section['kind']) ||
        !isString(section['heading']) ||
        !isString(section['body'])
      ) {
        throw new Error(
          `DOCUMENTATION_METADATA_INVALID:record:${String(index)}:section:${String(sectionIndex)}`,
        );
      }
      return `${section['id']}|${section['kind']}`;
    });

    const parityKey = `${value['key']}|${identity.version}|${identity.channel}`;
    const localeParity = parity.get(parityKey) ?? new Map<WebLocale, readonly string[]>();
    if (localeParity.has(identity.locale)) {
      throw new Error(`DOCUMENTATION_METADATA_INVALID:locale-duplicate:${parityKey}`);
    }
    localeParity.set(identity.locale, sectionSignature);
    parity.set(parityKey, localeParity);
    articles.push(value as unknown as DocumentationArticle);
  }

  for (const [key, localeParity] of parity) {
    const english = localeParity.get('en');
    const portuguese = localeParity.get('pt-BR');
    if (
      english === undefined ||
      portuguese === undefined ||
      english.join('\u0000') !== portuguese.join('\u0000')
    ) {
      throw new Error(`DOCUMENTATION_METADATA_INVALID:locale-parity:${key}`);
    }
  }

  const admitted = articles.map((article) => {
    if (
      article.metadata.owner !== 'docs-content' ||
      article.metadata.evidenceReferences.length === 0 ||
      article.metadata.releaseReferences.length === 0
    ) {
      throw new Error(`DOCUMENTATION_METADATA_INVALID:metadata:${article.identity.slug}`);
    }
    const resolution = resolveDocument(articles, article.identity);
    if (!resolution.ok) {
      throw new Error(
        `DOCUMENTATION_METADATA_REJECTED:${resolution.error.code}:${resolution.error.path}`,
      );
    }
    return resolution.value.document;
  });

  return Object.freeze(admitted);
};

export const documentationCatalog = admitDocumentationCatalog(metadataRoot);

const copyFor = (locale: WebLocale) =>
  locale === 'pt-BR'
    ? {
        allDomains: 'Todos os domínios',
        allPlatforms: 'Todas as plataformas',
        allRisks: 'Todos os riscos',
        articleIndex: 'Índice deste documento',
        canonical: 'Orientação atual canônica',
        channel: 'Canal',
        chooseTask: 'Escolha o que você quer fazer',
        compatibility: 'Compatibilidade',
        current: 'Guias atuais',
        documentation: 'Central de ajuda',
        empty: 'Nenhum documento admitido corresponde à busca e aos filtros.',
        evidence: 'Evidências',
        filters: 'Pesquisar na ajuda',
        historical: 'Versões anteriores',
        index: 'Guias rápidos',
        lastReview: 'Última revisão',
        nextAction:
          'Encontre o caminho certo para preparar, medir, otimizar ou restaurar com segurança.',
        observed: 'Estado observado',
        owner: 'Responsável',
        platform: 'Plataforma',
        moreFilters: 'Filtrar por assunto, Windows ou risco',
        query: 'Como podemos ajudar?',
        queryExample: 'Ex.: preparar uma partida ou desfazer um ajuste',
        recovery: 'Recuperação e escalonamento',
        releaseReferences: 'Referências de lançamento',
        reset: 'Limpar filtros',
        results: 'Resultados',
        risk: 'Risco',
        search: 'Pesquisar',
        sections: 'Seções',
        technicalContext: 'Versão, risco e origem deste documento',
        technicalLinks: 'Ajuda técnica e códigos de erro',
        validation: 'Validação',
        version: 'Versão',
      }
    : {
        allDomains: 'All domains',
        allPlatforms: 'All platforms',
        allRisks: 'All risks',
        articleIndex: 'In this document',
        canonical: 'Current canonical guidance',
        channel: 'Channel',
        chooseTask: 'Choose what you want to do',
        compatibility: 'Compatibility',
        current: 'Current guides',
        documentation: 'Help center',
        empty: 'No admitted document matches the query and filters.',
        evidence: 'Evidence',
        filters: 'Search help',
        historical: 'Previous versions',
        index: 'Quick guides',
        lastReview: 'Last reviewed',
        nextAction: 'Find the right path to prepare, measure, optimize, or restore safely.',
        observed: 'Observed state',
        owner: 'Accountable owner',
        platform: 'Platform',
        moreFilters: 'Filter by topic, Windows, or risk',
        query: 'How can we help?',
        queryExample: 'Example: prepare a gaming session or undo a change',
        recovery: 'Recovery and escalation',
        releaseReferences: 'Release references',
        reset: 'Clear filters',
        results: 'Results',
        risk: 'Risk',
        search: 'Search',
        sections: 'Sections',
        technicalContext: 'Document version, risk, and source',
        technicalLinks: 'Technical help and error codes',
        validation: 'Validation',
        version: 'Version',
      };

const firstSearchValue = (value: SearchValue): string =>
  (typeof value === 'string' ? value : (value?.[0] ?? '')).trim();

const relativeHref = (href: string): string => {
  const url = new URL(href);
  return `${url.pathname}${url.hash}`;
};

const domainLabel = (locale: WebLocale, domain: DocumentationDomain): string => {
  const labels =
    locale === 'pt-BR'
      ? {
          'getting-started': 'Primeiros passos',
          measuring: 'Medição e resultados',
          optimizing: 'Otimização',
          preparing: 'Preparação',
          restoring: 'Restauração',
          troubleshooting: 'Resolver problemas',
        }
      : {
          'getting-started': 'Getting started',
          measuring: 'Measurement and results',
          optimizing: 'Optimization',
          preparing: 'Preparation',
          restoring: 'Restoration',
          troubleshooting: 'Troubleshooting',
        };
  return labels[domain];
};

const riskLabel = (locale: WebLocale, risk: (typeof RISK_VALUES)[number]): string => {
  const labels =
    locale === 'pt-BR'
      ? { critical: 'Crítico', high: 'Alto', low: 'Baixo', medium: 'Médio', none: 'Sem risco' }
      : { critical: 'Critical', high: 'High', low: 'Low', medium: 'Medium', none: 'No risk' };
  return labels[risk];
};

const articleForRoute = (
  locale: WebLocale,
  version: WebVersion,
  kind: DocumentationArticle['kind'],
  slug: string,
): DocumentationArticle | undefined =>
  documentationCatalog.find(
    (article) =>
      article.identity.locale === locale &&
      article.identity.version === version &&
      article.identity.slug === slug &&
      article.kind === kind,
  );

export const resolveDocumentationPage = (
  request: DocumentationPageRequest,
): DocumentationPageResolution | undefined => {
  const { locale, slug = [], version = 'current' } = request;

  if (version === 'tasks') {
    const domain = slug[0];
    if (slug.length !== 1 || !isOneOf(DOCUMENTATION_DOMAINS, domain)) {
      return undefined;
    }
    return { kind: 'index', locale, domain, version: 'current', channel: 'stable' };
  }

  if (version === 'history') {
    const [historicalVersion, articleSlug] = slug;
    if (slug.length !== 2 || historicalVersion !== '1.0.0' || articleSlug === undefined) {
      return undefined;
    }
    const article = documentationCatalog.find(
      (candidate) =>
        candidate.identity.locale === locale &&
        candidate.identity.version === historicalVersion &&
        candidate.identity.slug === articleSlug,
    );
    if (article === undefined) {
      return undefined;
    }
    const resolved = resolveDocument(documentationCatalog, article.identity);
    if (!resolved.ok || resolved.value.status !== 'stale') {
      return undefined;
    }
    return {
      kind: 'article',
      locale,
      document: resolved.value.document,
      status: 'stale',
      href: resolved.value.href,
      canonicalHref: resolved.value.notice.canonical.href,
    };
  }

  if (!isOneOf(WEB_VERSIONS, version)) {
    return undefined;
  }

  if (slug.length === 0) {
    return {
      kind: 'index',
      locale,
      version,
      channel: version === 'current' ? 'stable' : 'beta',
    };
  }

  const [collection, articleSlug] = slug;
  if (slug.length !== 2 || articleSlug === undefined) {
    return undefined;
  }
  const kind =
    collection === 'articles'
      ? 'article'
      : collection === 'reference'
        ? 'reference'
        : collection === 'troubleshooting'
          ? 'troubleshooting'
          : undefined;
  if (kind === undefined) {
    return undefined;
  }

  const article = articleForRoute(locale, version, kind, articleSlug);
  if (article === undefined) {
    return undefined;
  }
  const resolved = resolveDocument(documentationCatalog, article.identity);
  if (!resolved.ok) {
    return undefined;
  }
  return {
    kind: 'article',
    locale,
    document: resolved.value.document,
    status: resolved.value.status,
    href: resolved.value.href,
    canonicalHref:
      resolved.value.status === 'stale'
        ? resolved.value.notice.canonical.href
        : resolved.value.href,
  };
};

const indexItems = (locale: WebLocale, version: WebVersion) =>
  documentationCatalog
    .filter(
      (article) =>
        article.identity.locale === locale &&
        article.identity.version === version &&
        (version === 'current' ? article.supported : true),
    )
    .map((article) => {
      const resolution = resolveDocument(documentationCatalog, article.identity);
      if (!resolution.ok) {
        throw new Error(`DOCUMENTATION_INDEX_REJECTED:${resolution.error.code}`);
      }
      return {
        id: `${article.kind}:${article.identity.slug}`,
        label: article.title,
        summary: article.summary,
        href: relativeHref(resolution.value.href),
        domain: article.domain,
      };
    });

const DocumentationNavigation = ({
  locale,
  version,
}: Readonly<{ locale: WebLocale; version: WebVersion }>) => {
  const copy = copyFor(locale);
  const items = indexItems(locale, version).map(({ id, label, href }) => ({ id, label, href }));
  return (
    <aside aria-label={copy.index}>
      <details open>
        <summary>{copy.index}</summary>
        <DocumentationIndex items={items.slice(0, 5)} label={copy.index} />
      </details>
      <details className="documentation-technical-links">
        <summary>{copy.technicalLinks}</summary>
        <DocumentationIndex items={items.slice(5)} label={copy.technicalLinks} />
      </details>
    </aside>
  );
};

const DocumentationVersionControl = ({
  locale,
  selectedVersion,
}: Readonly<{ locale: WebLocale; selectedVersion: WebVersion }>) => {
  const copy = copyFor(locale);
  return (
    <VersionSelector label={`${copy.version} · ${copy.channel}`}>
      <strong>{selectedVersion === 'current' ? copy.current : copy.historical}</strong>
      <span>
        {selectedVersion === 'current'
          ? locale === 'pt-BR'
            ? 'Recomendado para uso agora'
            : 'Recommended for use now'
          : locale === 'pt-BR'
            ? 'Somente para consulta'
            : 'For reference only'}
      </span>
      {selectedVersion === 'current' ? (
        <a className="public-action" href={`/${locale}/docs/history/1.0.0/legacy-capture`}>
          {copy.historical}
        </a>
      ) : (
        <a className="public-action" href={`/${locale}/docs/current`}>
          {copy.current}
        </a>
      )}
    </VersionSelector>
  );
};

const SearchControls = ({
  action,
  locale,
  searchParams,
}: Readonly<{
  action: string;
  locale: WebLocale;
  searchParams: DocumentationSearchParameters | undefined;
}>) => {
  const copy = copyFor(locale);
  return (
    <form
      aria-label={copy.filters}
      action={action}
      className="lb-web-filter-bar documentation-help-search"
      method="get"
      role="search"
    >
      <div className="documentation-help-search__query">
        <label htmlFor="documentation-query">{copy.query}</label>
        <input
          defaultValue={firstSearchValue(searchParams?.q)}
          id="documentation-query"
          name="q"
          placeholder={copy.queryExample}
          type="search"
        />
      </div>
      <button className="public-action public-action--primary" type="submit">
        {copy.search}
      </button>
      <details className="documentation-help-search__filters">
        <summary>{copy.moreFilters}</summary>
        <div className="documentation-help-search__filter-grid">
          <div>
            <label htmlFor="documentation-domain">{copy.sections}</label>
            <select
              defaultValue={firstSearchValue(searchParams?.domain)}
              id="documentation-domain"
              name="domain"
            >
              <option value="">{copy.allDomains}</option>
              {DOCUMENTATION_DOMAINS.map((domain) => (
                <option key={domain} value={domain}>
                  {domainLabel(locale, domain)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="documentation-platform">{copy.platform}</label>
            <select
              defaultValue={firstSearchValue(searchParams?.platform)}
              id="documentation-platform"
              name="platform"
            >
              <option value="">{copy.allPlatforms}</option>
              {DOCUMENTATION_PLATFORMS.map((platform) => (
                <option key={platform} value={platform}>
                  {platform === 'windows-10' ? 'Windows 10' : 'Windows 11'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="documentation-risk">{copy.risk}</label>
            <select
              defaultValue={firstSearchValue(searchParams?.risk)}
              id="documentation-risk"
              name="risk"
            >
              <option value="">{copy.allRisks}</option>
              {RISK_VALUES.map((risk) => (
                <option key={risk} value={risk}>
                  {riskLabel(locale, risk)}
                </option>
              ))}
            </select>
          </div>
          <a className="public-action" href={action}>
            {copy.reset}
          </a>
        </div>
      </details>
    </form>
  );
};

const searchFilters = (
  locale: WebLocale,
  version: WebVersion,
  channel: WebChannel,
  searchParams: DocumentationSearchParameters | undefined,
): DocumentationSearchFilters => {
  const platform = firstSearchValue(searchParams?.platform);
  const risk = firstSearchValue(searchParams?.risk);
  const domain = firstSearchValue(searchParams?.domain);
  return {
    locale,
    version,
    channel,
    ...(isOneOf(DOCUMENTATION_PLATFORMS, platform)
      ? { platform: platform as DocumentationPlatform }
      : {}),
    ...(isOneOf(RISK_VALUES, risk) ? { risk } : {}),
    ...(isOneOf(DOCUMENTATION_DOMAINS, domain) ? { domain } : {}),
  };
};

const SearchResults = ({
  channel,
  locale,
  searchParams,
  version,
}: Readonly<{
  channel: WebChannel;
  locale: WebLocale;
  searchParams: DocumentationSearchParameters | undefined;
  version: WebVersion;
}>) => {
  const copy = copyFor(locale);
  const query = firstSearchValue(searchParams?.q);
  if (query.length === 0) {
    return null;
  }
  const response = searchDocumentation(documentationCatalog, {
    query,
    filters: searchFilters(locale, version, channel, searchParams),
  });
  return (
    <section aria-labelledby="documentation-results-title" aria-live="polite">
      <h2 id="documentation-results-title">
        {copy.results}: {response.results.length}
      </h2>
      {response.state === 'no-results' ? (
        <EmptyComposition description={copy.empty} />
      ) : (
        <ol className="lb-web-documentation-index">
          {response.results.map((result) => (
            <li key={`${result.document.identity.version}:${result.document.identity.slug}`}>
              <a href={relativeHref(result.href)}>{result.document.title}</a>
              <p>{result.document.summary}</p>
              <small>
                {domainLabel(locale, result.document.domain)} ·{' '}
                {riskLabel(locale, result.document.risk)}
              </small>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
};

const ArticleSection = ({
  children,
  heading,
  id,
  kind,
}: Readonly<{
  children: ReactNode;
  heading: string;
  id: string;
  kind: DocumentationArticle['sections'][number]['kind'];
}>) => (
  <section
    className={kind === 'technical-detail' ? 'documentation-deep-detail' : undefined}
    data-documentation-kind={kind}
    id={id}
    tabIndex={-1}
  >
    <h2>{heading}</h2>
    {children}
  </section>
);

const TroubleshootingComposition = ({
  document,
  locale,
}: Readonly<{ document: DocumentationArticle; locale: WebLocale }>) => {
  if (document.troubleshooting === undefined) {
    return null;
  }
  const copy = copyFor(locale);
  const path = document.troubleshooting;
  return (
    <TroubleshootingPath title={copy.recovery}>
      <ObservedStatePrompt title={copy.observed}>
        <p>{path.observedState}</p>
        <h3>{copy.evidence}</h3>
        <ul>
          {path.evidence.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </ObservedStatePrompt>
      <section>
        <h3>{locale === 'pt-BR' ? 'Etapas seguras' : 'Safe steps'}</h3>
        <ol>
          {path.safeSteps.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </section>
      <RecoveryEscalation title={copy.recovery}>
        <ul>
          {path.recovery.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p>
          <strong>{locale === 'pt-BR' ? 'Escalonamento:' : 'Escalation:'}</strong> {path.escalation}
        </p>
      </RecoveryEscalation>
    </TroubleshootingPath>
  );
};

const DocumentationArticleView = ({
  resolution,
}: Readonly<{
  resolution: Extract<DocumentationPageResolution, { kind: 'article' }>;
}>) => {
  const { document, locale } = resolution;
  const copy = copyFor(locale);
  const isStale = resolution.status === 'stale';
  return (
    <div className="lb-web-product-frame">
      <DocumentationNavigation locale={locale} version={document.identity.version} />
      <article className="public-catalog lb-web-policy">
        <DocumentationVersionControl locale={locale} selectedVersion={document.identity.version} />
        {isStale ? (
          locale === 'en' ? (
            <StaleDocumentNotice
              canonicalHref={relativeHref(resolution.canonicalHref)}
              version={document.identity.version}
            />
          ) : (
            <BoundaryTransitionNotice
              description="Esta versão é histórica ou não compatível. A página não foi redirecionada e a alternativa atual está explícita."
              title="Documentação histórica"
            >
              <a href={relativeHref(resolution.canonicalHref)}>{copy.canonical}</a>
            </BoundaryTransitionNotice>
          )
        ) : null}
        <RouteHeader description={document.summary} title={document.title} />
        <details className="documentation-technical-context">
          <summary>{copy.technicalContext}</summary>
          <ArticleMetadata
            entries={[
              { label: copy.version, value: <code>{document.identity.version}</code> },
              { label: copy.channel, value: <code>{document.identity.channel}</code> },
              {
                label: copy.lastReview,
                value: (
                  <time dateTime={document.metadata.lastReviewedAt}>
                    {document.metadata.lastReviewedAt.slice(0, 10)}
                  </time>
                ),
              },
              { label: copy.owner, value: document.metadata.owner },
              {
                label: copy.validation,
                value: (
                  <StatusSignal
                    label={document.metadata.validationState}
                    state={
                      document.metadata.validationState === 'validated'
                        ? 'success'
                        : document.metadata.validationState === 'unsupported'
                          ? 'stale'
                          : 'warning'
                    }
                  />
                ),
              },
              { label: copy.risk, value: document.risk },
              {
                label: copy.platform,
                value: document.platform.map((platform) => <code key={platform}>{platform} </code>),
              },
              {
                label: copy.releaseReferences,
                value: document.metadata.releaseReferences.map((reference) => (
                  <code key={reference}>{reference} </code>
                )),
              },
            ]}
          />
        </details>
        <details open>
          <summary>{copy.articleIndex}</summary>
          <DocumentationIndex
            items={document.sections.map((section) => ({
              id: section.id,
              href: `#${section.id}`,
              label: section.heading,
            }))}
            label={copy.articleIndex}
          />
        </details>
        <TroubleshootingComposition document={document} locale={locale} />
        <div className="documentation-article-flow">
          {[...document.sections]
            .sort(
              (left, right) =>
                (DOCUMENTATION_READING_ORDER.get(left.kind) ?? Number.MAX_SAFE_INTEGER) -
                (DOCUMENTATION_READING_ORDER.get(right.kind) ?? Number.MAX_SAFE_INTEGER),
            )
            .map((section) => (
              <ArticleSection
                heading={section.heading}
                id={section.id}
                key={section.id}
                kind={section.kind}
              >
                <p>{section.body}</p>
                {section.kind === 'evidence' ? (
                  <ul aria-label={copy.evidence}>
                    {document.metadata.evidenceReferences.map((reference) => (
                      <li key={reference}>
                        <code>{reference}</code>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {section.kind === 'technical-detail' && document.identifiers.length > 0 ? (
                  <p className="lb-web-table-region" tabIndex={0}>
                    {document.identifiers.map((identifier) => (
                      <code key={identifier}>{identifier} </code>
                    ))}
                  </p>
                ) : null}
              </ArticleSection>
            ))}
        </div>
      </article>
    </div>
  );
};

const DocumentationIndexView = ({
  request,
  resolution,
}: Readonly<{
  request: DocumentationPageRequest;
  resolution: Extract<DocumentationPageResolution, { kind: 'index' }>;
}>) => {
  const { channel, domain, locale, version } = resolution;
  const copy = copyFor(locale);
  const action =
    domain === undefined ? `/${locale}/docs/${version}` : `/${locale}/docs/tasks/${domain}`;
  const items = indexItems(locale, version).filter((item) =>
    domain === undefined ? true : item.domain === domain,
  );
  const taskItems = domain === undefined ? items.slice(0, 5) : items;
  return (
    <div className="lb-web-product-frame">
      <DocumentationNavigation locale={locale} version={version} />
      <article className="public-catalog">
        <DocumentationVersionControl locale={locale} selectedVersion={version} />
        <RouteHeader description={copy.nextAction} title={copy.documentation} />
        <SearchControls action={action} locale={locale} searchParams={request.searchParams} />
        <SearchResults
          channel={channel}
          locale={locale}
          searchParams={request.searchParams}
          version={version}
        />
        <section
          aria-labelledby="documentation-task-index-title"
          className="documentation-index-workspace"
        >
          <h2 id="documentation-task-index-title">
            {domain === undefined ? copy.chooseTask : domainLabel(locale, domain)}
          </h2>
          <ol className="lb-web-documentation-index">
            {taskItems.map((item) => (
              <li className="documentation-task-card" key={item.id}>
                <a href={item.href}>{item.label}</a>
                <p>{item.summary}</p>
                <small>{domainLabel(locale, item.domain)}</small>
              </li>
            ))}
          </ol>
        </section>
      </article>
    </div>
  );
};

export const DocumentationExperience = ({
  request,
}: Readonly<{ request: DocumentationPageRequest }>) => {
  const resolution = resolveDocumentationPage(request);
  if (resolution === undefined) {
    return null;
  }
  return resolution.kind === 'article' ? (
    <DocumentationArticleView resolution={resolution} />
  ) : (
    <DocumentationIndexView request={request} resolution={resolution} />
  );
};
