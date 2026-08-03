import type { ReactNode } from 'react';
import type { WebLocale, WebRouteId } from '@liiiraa/web-core';

import catalogEnJson from '../content/public/catalog.en.json';
import catalogPtBrJson from '../content/public/catalog.pt-BR.json';
import policiesEnJson from '../content/public/policies.en.json';
import policiesPtBrJson from '../content/public/policies.pt-BR.json';
import { accountBoundaryHref, publicBoundaryHref } from '../public-boundary';
import { PublicProductIcon } from '../public-product-icon';

export type CapabilitySupportState =
  | 'available'
  | 'demonstrative-preview'
  | 'under-validation'
  | 'planned'
  | 'unsupported'
  | 'unavailable';

type EvidenceRecord = Readonly<{
  source: string;
  provenance: string;
  scope: string;
  applicableVersion: string;
  validationState: string;
  unprovenBoundary: string;
}>;

type CapabilityRow = Readonly<{
  capability: string;
  state: CapabilitySupportState;
  consequence: string;
}>;

type CatalogRouteId =
  | 'public-product'
  | 'public-results'
  | 'public-compatibility'
  | 'public-plans'
  | 'public-search'
  | 'public-support';

export type PlanDisclosure = Readonly<{
  id: string;
  name: string;
  price: string;
  billingPeriod: string;
  renewal: string;
  taxes: string;
  cancellation: string;
  refunds: string;
  deviceRules: string;
  expirationEffects: string;
  checkoutBoundary: string;
  capabilities: readonly Readonly<{
    name: string;
    state: CapabilitySupportState;
  }>[];
}>;

export type PublicCatalogRecord = Readonly<{
  routeId: CatalogRouteId;
  contentType: string;
  translationKey: string;
  title: string;
  summary: string;
  body: string;
  availability: CapabilitySupportState;
  validationState: 'validated';
  limitations: readonly string[];
  evidence: readonly EvidenceRecord[];
  sections?: readonly Readonly<{ title: string; body: string }>[];
  supportMatrix?: readonly CapabilityRow[];
  plans?: readonly PlanDisclosure[];
  searchCopy?: Readonly<{
    label: string;
    submit: string;
    emptyTitle: string;
    emptyBody: string;
    filterLabel: string;
  }>;
  collectionPoint?: Readonly<{
    purpose: string;
    requiredFields: string;
    retention: string;
    sharing: string;
    revocation: string;
    policyRouteId: WebRouteId;
  }>;
}>;

type SupportStateCopy = Readonly<{
  label: string;
  consequence: string;
  evidence: string;
}>;

export type PublicCatalog = Readonly<{
  schemaVersion: 1;
  locale: WebLocale;
  version: string;
  lastReviewedAt: string;
  supportStates: Readonly<Record<CapabilitySupportState, SupportStateCopy>>;
  records: readonly PublicCatalogRecord[];
}>;

export type PolicyVersion = Readonly<{
  kind: 'privacy' | 'terms' | 'security';
  routeId: WebRouteId;
  title: string;
  summary: string;
  version: string;
  effectiveDate: string;
  contact: string;
  reviewNotice: string;
  sections: readonly Readonly<{ id: string; heading: string; body: string }>[];
  privacyDetails?: Readonly<{
    controller: Readonly<{
      productIdentity: string;
      formalIdentityStatus: string;
      contact: string;
    }>;
    practices: readonly Readonly<{
      id:
        | 'public-site-delivery'
        | 'essential-authentication-storage'
        | 'optional-telemetry'
        | 'support-diagnostics'
        | 'personalized-ai';
      title: string;
      status: 'necessary-only' | 'consent-required';
      purpose: string;
      data: string;
      legalBasis: string;
      retention: string;
      sharing: string;
      revocation: string;
    }>[];
    processors: string;
    internationalTransfers: string;
    rights: readonly string[];
  }>;
  history: readonly Readonly<{
    version: string;
    effectiveDate: string;
    summary: string;
  }>[];
}>;

export type IncidentRecord = Readonly<{
  id: string;
  component: string;
  impact: string;
  updates: readonly Readonly<{ at: string; body: string }>[];
  resolution: string;
}>;

export type PublicPolicies = Readonly<{
  schemaVersion: 1;
  locale: WebLocale;
  lastReviewedAt: string;
  documents: readonly PolicyVersion[];
  disclosure: Readonly<{
    routeId: WebRouteId;
    title: string;
    summary: string;
    secureChannel: string;
    contact: string;
    version: string;
    effectiveDate: string;
    reviewNotice: string;
    scope: readonly string[];
    prohibitedContent: readonly string[];
    response: string;
    history: readonly Readonly<{
      version: string;
      effectiveDate: string;
      summary: string;
    }>[];
  }>;
  status: Readonly<{
    routeId: WebRouteId;
    title: string;
    overall: string;
    updatedAt: string;
    summary: string;
    components: readonly Readonly<{
      name: string;
      state: CapabilitySupportState | 'operational';
      detail: string;
    }>[];
    incidentHistory: readonly IncidentRecord[];
    incidentHistoryEmpty: string;
  }>;
}>;

export type CatalogSearchParameters = Readonly<{
  q?: string | readonly string[];
  availability?: string | readonly string[];
}>;

type PublicCatalogPageProps = Readonly<{
  locale: WebLocale;
  routeId: WebRouteId;
  searchParams?: CatalogSearchParameters;
}>;

const SUPPORT_STATES = Object.freeze([
  'available',
  'demonstrative-preview',
  'under-validation',
  'planned',
  'unsupported',
  'unavailable',
] as const satisfies readonly CapabilitySupportState[]);

const CATALOG_ROUTE_IDS = Object.freeze([
  'public-product',
  'public-results',
  'public-compatibility',
  'public-plans',
  'public-search',
  'public-support',
] as const satisfies readonly WebRouteId[]);

const POLICY_ROUTE_IDS = Object.freeze([
  'public-privacy-policy',
  'public-terms',
  'public-policies',
] as const satisfies readonly WebRouteId[]);

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const hasExactStrings = (candidate: readonly string[], expected: readonly string[]): boolean =>
  candidate.length === expected.length && expected.every((value) => candidate.includes(value));

const admitCatalog = (candidate: unknown, locale: WebLocale): PublicCatalog => {
  if (
    !isRecord(candidate) ||
    candidate['schemaVersion'] !== 1 ||
    candidate['locale'] !== locale ||
    !isNonEmptyString(candidate['version']) ||
    !isNonEmptyString(candidate['lastReviewedAt']) ||
    !isRecord(candidate['supportStates']) ||
    !Array.isArray(candidate['records'])
  ) {
    throw new Error(`PUBLIC_CATALOG_INVALID:${locale}:root`);
  }

  const supportStates = candidate['supportStates'];
  for (const state of SUPPORT_STATES) {
    const copy = supportStates[state];
    if (
      !isRecord(copy) ||
      !isNonEmptyString(copy['label']) ||
      !isNonEmptyString(copy['consequence']) ||
      !isNonEmptyString(copy['evidence'])
    ) {
      throw new Error(`PUBLIC_CATALOG_INVALID:${locale}:support-state:${state}`);
    }
  }

  const records = candidate['records'];
  const routeIds: string[] = [];
  for (const [index, value] of records.entries()) {
    if (
      !isRecord(value) ||
      !isNonEmptyString(value['routeId']) ||
      !isNonEmptyString(value['translationKey']) ||
      !isNonEmptyString(value['contentType']) ||
      !isNonEmptyString(value['title']) ||
      !isNonEmptyString(value['summary']) ||
      !isNonEmptyString(value['body']) ||
      !SUPPORT_STATES.includes(value['availability'] as CapabilitySupportState) ||
      value['validationState'] !== 'validated' ||
      !Array.isArray(value['limitations']) ||
      value['limitations'].length === 0 ||
      !value['limitations'].every(isNonEmptyString) ||
      !Array.isArray(value['evidence']) ||
      value['evidence'].length === 0
    ) {
      throw new Error(`PUBLIC_CATALOG_INVALID:${locale}:record:${String(index)}`);
    }

    for (const [evidenceIndex, evidence] of value['evidence'].entries()) {
      if (
        !isRecord(evidence) ||
        !isNonEmptyString(evidence['source']) ||
        !evidence['source'].startsWith('https://liiiraa.com/') ||
        !isNonEmptyString(evidence['provenance']) ||
        !isNonEmptyString(evidence['scope']) ||
        evidence['applicableVersion'] !== candidate['version'] ||
        evidence['validationState'] !== 'validated' ||
        !isNonEmptyString(evidence['unprovenBoundary'])
      ) {
        throw new Error(
          `PUBLIC_CATALOG_INVALID:${locale}:record:${String(index)}:evidence:${String(evidenceIndex)}`,
        );
      }
    }

    routeIds.push(value['routeId']);
  }

  if (!hasExactStrings(routeIds, CATALOG_ROUTE_IDS)) {
    throw new Error(`PUBLIC_CATALOG_INVALID:${locale}:route-parity`);
  }

  return candidate as unknown as PublicCatalog;
};

const admitPolicies = (candidate: unknown, locale: WebLocale): PublicPolicies => {
  if (
    !isRecord(candidate) ||
    candidate['schemaVersion'] !== 1 ||
    candidate['locale'] !== locale ||
    !isNonEmptyString(candidate['lastReviewedAt']) ||
    !Array.isArray(candidate['documents']) ||
    !isRecord(candidate['disclosure']) ||
    !isRecord(candidate['status'])
  ) {
    throw new Error(`PUBLIC_POLICIES_INVALID:${locale}:root`);
  }

  const routeIds: string[] = [];
  const kinds: string[] = [];
  for (const [index, value] of candidate['documents'].entries()) {
    if (
      !isRecord(value) ||
      !isNonEmptyString(value['routeId']) ||
      !isNonEmptyString(value['title']) ||
      !isNonEmptyString(value['summary']) ||
      !isNonEmptyString(value['version']) ||
      !isNonEmptyString(value['effectiveDate']) ||
      !isNonEmptyString(value['contact']) ||
      !isNonEmptyString(value['reviewNotice']) ||
      !Array.isArray(value['sections']) ||
      value['sections'].length === 0 ||
      !value['sections'].every(
        (section) =>
          isRecord(section) &&
          isNonEmptyString(section['id']) &&
          isNonEmptyString(section['heading']) &&
          isNonEmptyString(section['body']),
      ) ||
      !Array.isArray(value['history']) ||
      value['history'].length === 0 ||
      !value['history'].every(
        (entry) =>
          isRecord(entry) &&
          isNonEmptyString(entry['version']) &&
          isNonEmptyString(entry['effectiveDate']) &&
          isNonEmptyString(entry['summary']),
      )
    ) {
      throw new Error(`PUBLIC_POLICIES_INVALID:${locale}:document:${String(index)}`);
    }

    if (value['kind'] === 'privacy') {
      const details = value['privacyDetails'];
      if (
        !isRecord(details) ||
        !isRecord(details['controller']) ||
        !isNonEmptyString(details['controller']['productIdentity']) ||
        !isNonEmptyString(details['controller']['formalIdentityStatus']) ||
        !isNonEmptyString(details['controller']['contact']) ||
        !Array.isArray(details['practices']) ||
        details['practices'].length !== 5 ||
        !details['practices'].every(
          (practice) =>
            isRecord(practice) &&
            [
              'id',
              'title',
              'status',
              'purpose',
              'data',
              'legalBasis',
              'retention',
              'sharing',
              'revocation',
            ].every((key) => isNonEmptyString(practice[key])),
        ) ||
        !isNonEmptyString(details['processors']) ||
        !isNonEmptyString(details['internationalTransfers']) ||
        !Array.isArray(details['rights']) ||
        details['rights'].length < 7 ||
        !details['rights'].every(isNonEmptyString)
      ) {
        throw new Error(`PUBLIC_POLICIES_INVALID:${locale}:privacy-details`);
      }
    }

    routeIds.push(value['routeId']);
    kinds.push(String(value['kind']));
  }

  if (
    !hasExactStrings(routeIds, POLICY_ROUTE_IDS) ||
    !hasExactStrings(kinds, ['privacy', 'terms', 'security']) ||
    candidate['disclosure']['routeId'] !== 'public-responsible-disclosure' ||
    !isNonEmptyString(candidate['disclosure']['secureChannel']) ||
    !isNonEmptyString(candidate['disclosure']['contact']) ||
    !isNonEmptyString(candidate['disclosure']['version']) ||
    !isNonEmptyString(candidate['disclosure']['effectiveDate']) ||
    !isNonEmptyString(candidate['disclosure']['reviewNotice']) ||
    !Array.isArray(candidate['disclosure']['scope']) ||
    !Array.isArray(candidate['disclosure']['prohibitedContent']) ||
    !isNonEmptyString(candidate['disclosure']['response']) ||
    !Array.isArray(candidate['disclosure']['history']) ||
    candidate['status']['routeId'] !== 'public-status' ||
    !Array.isArray(candidate['status']['components']) ||
    !Array.isArray(candidate['status']['incidentHistory'])
  ) {
    throw new Error(`PUBLIC_POLICIES_INVALID:${locale}:route-parity`);
  }

  return candidate as unknown as PublicPolicies;
};

const CATALOGS = Object.freeze({
  en: admitCatalog(catalogEnJson, 'en'),
  'pt-BR': admitCatalog(catalogPtBrJson, 'pt-BR'),
});

const POLICIES = Object.freeze({
  en: admitPolicies(policiesEnJson, 'en'),
  'pt-BR': admitPolicies(policiesPtBrJson, 'pt-BR'),
});

const statusStateLabel = (
  locale: WebLocale,
  state: CapabilitySupportState | 'operational',
): string =>
  state === 'operational'
    ? locale === 'pt-BR'
      ? 'Operacional'
      : 'Operational'
    : CATALOGS[locale].supportStates[state].label;

const assertLocaleParity = (): void => {
  const recordIdentity = (catalog: PublicCatalog): string =>
    catalog.records.map(({ routeId, translationKey }) => `${routeId}:${translationKey}`).join('|');
  const policyIdentity = (policies: PublicPolicies): string =>
    policies.documents.map(({ kind, routeId }) => `${kind}:${routeId}`).join('|');

  if (
    recordIdentity(CATALOGS.en) !== recordIdentity(CATALOGS['pt-BR']) ||
    policyIdentity(POLICIES.en) !== policyIdentity(POLICIES['pt-BR'])
  ) {
    throw new Error('PUBLIC_CONTENT_LOCALE_PARITY_MISMATCH');
  }
};

assertLocaleParity();

export const getPublicCatalog = (locale: WebLocale): PublicCatalog => CATALOGS[locale];
export const getPublicPolicies = (locale: WebLocale): PublicPolicies => POLICIES[locale];

const copyFor = (locale: WebLocale) =>
  locale === 'pt-BR'
    ? {
        availability: 'Disponibilidade',
        consequence: 'Consequência',
        evidence: 'Evidência',
        limitations: 'Limites',
        source: 'Fonte e escopo',
        version: 'Versão',
        validation: 'Estado de validação',
        unproven: 'O que permanece não comprovado',
        reviewed: 'Revisado',
        details: 'Ver detalhes',
        history: 'Histórico de versões',
        contact: 'Contato responsável',
        fullText: 'Texto completo',
        current: 'Versão atual',
        incidents: 'Histórico de incidentes',
        components: 'Componentes',
        results: 'Resultados',
      }
    : {
        availability: 'Availability',
        consequence: 'Consequence',
        evidence: 'Evidence',
        limitations: 'Limits',
        source: 'Source and scope',
        version: 'Version',
        validation: 'Validation state',
        unproven: 'What remains unproven',
        reviewed: 'Reviewed',
        details: 'View details',
        history: 'Version history',
        contact: 'Accountable contact',
        fullText: 'Full text',
        current: 'Current version',
        incidents: 'Incident history',
        components: 'Components',
        results: 'Results',
      };

const SupportState = ({
  catalog,
  state,
}: Readonly<{ catalog: PublicCatalog; state: CapabilitySupportState }>) => {
  const copy = catalog.supportStates[state];
  return (
    <span className="catalog-state" data-state={state}>
      <strong>{copy.label}</strong>
    </span>
  );
};

const EvidenceDisclosure = ({
  evidence,
  locale,
}: Readonly<{ evidence: EvidenceRecord; locale: WebLocale }>) => {
  const copy = copyFor(locale);
  return (
    <details className="catalog-evidence">
      <summary>{copy.source}</summary>
      <dl>
        <div>
          <dt>{copy.source}</dt>
          <dd>
            <a href={evidence.source}>{evidence.source}</a>
            <span>{evidence.scope}</span>
          </dd>
        </div>
        <div>
          <dt>{copy.version}</dt>
          <dd>
            <code>{evidence.applicableVersion}</code>
          </dd>
        </div>
        <div>
          <dt>{copy.validation}</dt>
          <dd>{evidence.validationState}</dd>
        </div>
        <div>
          <dt>{copy.unproven}</dt>
          <dd>{evidence.unprovenBoundary}</dd>
        </div>
      </dl>
    </details>
  );
};

type CatalogRoutePresentation = Readonly<{
  kicker: string;
  primary: Readonly<{ href: string; label: string }>;
  secondary: Readonly<{ href: string; label: string }>;
}>;

const routePresentation = (
  locale: WebLocale,
  routeId: CatalogRouteId,
): CatalogRoutePresentation => {
  const href = (id: WebRouteId) => publicBoundaryHref(id, locale);
  const portuguese = locale === 'pt-BR';

  switch (routeId) {
    case 'public-product':
      return {
        kicker: portuguese ? 'Feito para jogar' : 'Built for gaming',
        primary: {
          href: '#catalog-route-body',
          label: portuguese ? 'Ver como funciona' : 'See how it works',
        },
        secondary: {
          href: href('public-compatibility'),
          label: portuguese ? 'Checar meu PC' : 'Check my PC',
        },
      };
    case 'public-results':
      return {
        kicker: portuguese ? 'Sem números inventados' : 'No invented numbers',
        primary: {
          href: '#catalog-route-body',
          label: portuguese ? 'Ver como medimos' : 'See how we measure',
        },
        secondary: {
          href: href('public-product'),
          label: portuguese ? 'Como funciona' : 'How it works',
        },
      };
    case 'public-compatibility':
      return {
        kicker: portuguese ? 'Comece pelo seu PC' : 'Start with your PC',
        primary: {
          href: href('public-download'),
          label: portuguese ? 'Baixar app grátis' : 'Download the app free',
        },
        secondary: {
          href: '#catalog-route-body',
          label: portuguese ? 'Ver requisitos' : 'View requirements',
        },
      };
    case 'public-plans':
      return {
        kicker: portuguese ? 'Premium com transparência' : 'Premium with transparency',
        primary: {
          href: '#premium-checkout',
          label: portuguese ? 'Escolher Premium' : 'Choose Premium',
        },
        secondary: {
          href: href('public-download'),
          label: portuguese ? 'Começar grátis' : 'Start free',
        },
      };
    case 'public-search':
      return {
        kicker: portuguese ? 'Conteúdo confiável' : 'Trusted content',
        primary: {
          href: '#catalog-route-body',
          label: portuguese ? 'Buscar agora' : 'Search now',
        },
        secondary: {
          href: href('public-product'),
          label: portuguese ? 'Conhecer o produto' : 'Explore the product',
        },
      };
    case 'public-support':
      return {
        kicker: portuguese ? 'Ajuda com contexto' : 'Help with context',
        primary: {
          href: '#catalog-route-body',
          label: portuguese ? 'Ver opções de suporte' : 'View support options',
        },
        secondary: {
          href: href('docs-index'),
          label: portuguese ? 'Abrir documentação' : 'Open documentation',
        },
      };
  }
};

const RouteIntroduction = ({
  catalog,
  record,
}: Readonly<{ catalog: PublicCatalog; record: PublicCatalogRecord }>) => {
  const copy = copyFor(catalog.locale);
  const presentation = routePresentation(catalog.locale, record.routeId);
  return (
    <header className="catalog-introduction" data-route-purpose={record.routeId}>
      <p className="catalog-introduction__kicker">{presentation.kicker}</p>
      <h1>{record.title}</h1>
      <p className="catalog-introduction__summary">{record.summary}</p>
      <p className="catalog-introduction__body">{record.body}</p>
      <nav
        aria-label={catalog.locale === 'pt-BR' ? 'Próximos passos' : 'Next steps'}
        className="catalog-introduction__actions"
      >
        <a
          className="public-action public-action--primary catalog-primary-action"
          href={presentation.primary.href}
        >
          {presentation.primary.label}
        </a>
        <a className="public-action" href={presentation.secondary.href}>
          {presentation.secondary.label}
        </a>
      </nav>
      <details className="catalog-introduction__provenance">
        <summary>{localeSummary(catalog.locale)}</summary>
        <div className="catalog-introduction__identity">
          <SupportState catalog={catalog} state={record.availability} />
        </div>
        <p>
          {record.contentType} · {catalog.locale} · <code>{catalog.version}</code>
        </p>
        <p className="catalog-introduction__review">
          {copy.reviewed}:{' '}
          <time dateTime={catalog.lastReviewedAt}>{catalog.lastReviewedAt.slice(0, 10)}</time> ·{' '}
          {copy.validation}: {record.validationState}
        </p>
      </details>
    </header>
  );
};

const localeSummary = (locale: WebLocale): string =>
  locale === 'pt-BR' ? 'Detalhes técnicos e revisão' : 'Technical details and review';

const Limitations = ({
  locale,
  limitations,
}: Readonly<{ locale: WebLocale; limitations: readonly string[] }>) => (
  <section aria-labelledby="catalog-limitations-title" className="catalog-limitations">
    <h2 id="catalog-limitations-title">{copyFor(locale).limitations}</h2>
    <ul>
      {limitations.map((limitation) => (
        <li key={limitation}>{limitation}</li>
      ))}
    </ul>
  </section>
);

export const CapabilitySupportMatrix = ({
  catalog,
  rows,
}: Readonly<{ catalog: PublicCatalog; rows: readonly CapabilityRow[] }>) => {
  return (
    <div className="catalog-decision-field">
      <div className="catalog-table-wrap">
        <table className="catalog-table">
          <caption>
            {catalog.locale === 'pt-BR' ? 'O que já podemos verificar' : 'What we can check today'}
          </caption>
          <thead>
            <tr>
              <th scope="col">{catalog.locale === 'pt-BR' ? 'Verificação' : 'Check'}</th>
              <th scope="col">{catalog.locale === 'pt-BR' ? 'Situação' : 'Status'}</th>
              <th scope="col">
                {catalog.locale === 'pt-BR' ? 'O que isso significa' : 'What this means'}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.capability}>
                <th scope="row">{row.capability}</th>
                <td data-label={catalog.locale === 'pt-BR' ? 'Situação' : 'Status'}>
                  <SupportState catalog={catalog} state={row.state} />
                </td>
                <td
                  data-label={
                    catalog.locale === 'pt-BR' ? 'O que isso significa' : 'What this means'
                  }
                >
                  {row.consequence}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const DisclosureList = ({
  items,
}: Readonly<{ items: readonly Readonly<{ label: string; value: string }>[] }>) => (
  <dl className="catalog-disclosure-list">
    {items.map((item) => (
      <div key={item.label}>
        <dt>{item.label}</dt>
        <dd>{item.value}</dd>
      </div>
    ))}
  </dl>
);

export const PlanComparison = ({
  catalog,
  plans,
  record,
}: Readonly<{
  catalog: PublicCatalog;
  plans: readonly PlanDisclosure[];
  record: PublicCatalogRecord;
}>) => {
  const presentation = routePresentation(catalog.locale, record.routeId);
  const free = plans.find(({ id }) => id === 'essential-free');
  const premium = plans.find(({ id }) => id === 'competitive-premium');
  const support = catalog.records.find(({ routeId }) => routeId === 'public-support');

  if (free === undefined || premium === undefined || support === undefined) {
    throw new Error(`PUBLIC_CATALOG_INVALID:${catalog.locale}:plan-comparison`);
  }

  const portuguese = catalog.locale === 'pt-BR';
  const downloadHref = publicBoundaryHref('public-download', catalog.locale);
  const accountHref = accountBoundaryHref(catalog.locale);
  const visibleTerms = [
    { label: portuguese ? 'Pagamento e renovação' : 'Payment and renewal', value: premium.renewal },
    { label: portuguese ? 'Tributos' : 'Taxes', value: premium.taxes },
    { label: portuguese ? 'Cancelamento' : 'Cancellation', value: premium.cancellation },
    { label: portuguese ? 'Reembolso' : 'Refund', value: premium.refunds },
    { label: portuguese ? 'PC e reset de HWID' : 'PC and HWID reset', value: premium.deviceRules },
    {
      label: portuguese ? 'Uso offline e expiração' : 'Offline use and expiration',
      value: premium.expirationEffects,
    },
    { label: portuguese ? 'Suporte' : 'Support', value: support.body },
  ] as const;

  return (
    <section aria-labelledby="plan-comparison-title" className="plan-comparison-ledger">
      <header className="plan-comparison-introduction" data-route-purpose={record.routeId}>
        <p>{presentation.kicker}</p>
        <h1 id="plan-comparison-title">{record.title}</h1>
        <div>
          <p>{record.summary}</p>
          <span>{record.body}</span>
        </div>
        <nav aria-label={portuguese ? 'Escolher como começar' : 'Choose how to start'}>
          <a className="public-action public-action--primary" href={downloadHref}>
            {portuguese ? 'Baixar grátis' : 'Download free'}
          </a>
          <a className="public-action" href="#premium-checkout">
            {portuguese ? 'Ver Premium' : 'See Premium'}
          </a>
        </nav>
      </header>

      <div className="plan-choice-grid">
        {[free, premium].map((plan) => (
          <article className="plan-choice" data-plan={plan.id} id={plan.id} key={plan.id}>
            <header>
              <span>
                <PublicProductIcon
                  name={plan.id === 'essential-free' ? 'gauge' : 'crown'}
                  size={22}
                  weight="duotone"
                />
                {plan.name}
              </span>
              <p aria-label={`${plan.price} ${plan.billingPeriod}`} className="plan-price">
                <strong>{plan.price}</strong>
                <small>{plan.billingPeriod}</small>
              </p>
            </header>
            <ul className="plan-capabilities">
              {plan.capabilities.map((capability) => (
                <li key={capability.name}>
                  <PublicProductIcon name="check" size={18} weight="bold" />
                  <span>{capability.name}</span>
                </li>
              ))}
            </ul>
            <a
              className={
                plan.id === 'competitive-premium'
                  ? 'public-action public-action--primary'
                  : 'public-action'
              }
              href={plan.id === 'competitive-premium' ? '#premium-checkout' : downloadHref}
            >
              {plan.id === 'competitive-premium'
                ? portuguese
                  ? 'Escolher Premium'
                  : 'Choose Premium'
                : portuguese
                  ? 'Começar grátis'
                  : 'Start free'}
            </a>
          </article>
        ))}
      </div>

      <div className="plan-purchase-stage" id="premium-checkout">
        <header className="plan-offer">
          <span className="plan-offer__label">
            <PublicProductIcon name="competitive" size={20} weight="bold" />
            {portuguese ? 'Premium · Modo Competitivo' : 'Premium · Competitive Mode'}
          </span>
          <h2>
            {portuguese ? 'Prepare cada partida com contexto' : 'Prepare every match with context'}
          </h2>
          <p className="plan-offer__summary">{premium.checkoutBoundary}</p>
          <p className="plan-price">
            <strong>{premium.price}</strong>
            <small>{premium.billingPeriod}</small>
          </p>
        </header>

        <form
          action={accountHref}
          className="plan-checkout"
          data-checkout-authority="disconnected"
          method="get"
        >
          <fieldset>
            <legend>{portuguese ? 'Escolha o ciclo' : 'Choose a billing cycle'}</legend>
            <label>
              <input
                defaultChecked
                name="billing"
                suppressHydrationWarning
                type="radio"
                value="monthly"
              />
              <span>
                <strong>{portuguese ? 'Mensal' : 'Monthly'}</strong>
                <small>{premium.price}</small>
              </span>
            </label>
            <label>
              <input name="billing" suppressHydrationWarning type="radio" value="annual" />
              <span>
                <strong>{portuguese ? 'Anual' : 'Annual'}</strong>
                <small>{premium.billingPeriod.replace(/^(?:ou|or)\s+/iu, '')}</small>
              </span>
            </label>
          </fieldset>
          <p className="plan-checkout__payment">
            <PublicProductIcon name="receipt" size={18} />
            {portuguese
              ? 'Cartão no mensal ou anual. Pix no anual. Sem boleto no lançamento.'
              : 'Card for monthly or annual billing. Pix for annual billing in Brazil. No boleto at launch.'}
          </p>
          <button className="public-action public-action--primary" type="submit">
            {portuguese ? 'Continuar para criar conta' : 'Continue to create account'}
          </button>
          <small>
            {portuguese
              ? 'Você revisa preço, pagamento e renovação antes de confirmar.'
              : 'You review price, payment, and renewal before confirming.'}
          </small>
        </form>
      </div>

      <section aria-labelledby="plan-terms-title" className="plan-terms">
        <header>
          <PublicProductIcon name="shield" size={26} weight="duotone" />
          <div>
            <h2 id="plan-terms-title">
              {portuguese ? 'Tudo claro antes de assinar' : 'Everything clear before subscribing'}
            </h2>
            <p>
              {portuguese
                ? 'Histórico e restauração nunca ficam presos ao pagamento.'
                : 'History and restoration are never locked behind payment.'}
            </p>
          </div>
        </header>
        <DisclosureList items={visibleTerms} />
      </section>

      <details className="catalog-introduction__provenance plan-provenance">
        <summary>{localeSummary(catalog.locale)}</summary>
        <div className="catalog-introduction__identity">
          <SupportState catalog={catalog} state={record.availability} />
        </div>
        <p>
          {record.contentType} · {catalog.locale} · <code>{catalog.version}</code>
        </p>
      </details>
    </section>
  );
};

const normalizeSearchValue = (value: string | readonly string[] | undefined): string =>
  typeof value === 'string' ? value : (value?.[0] ?? '');

const normalizeSearchText = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLocaleLowerCase('en-US');

type SearchEntry = Readonly<{
  id: string;
  routeId: WebRouteId;
  title: string;
  summary: string;
  contentType: string;
  availability: CapabilitySupportState;
  validationState: 'validated';
  locale: WebLocale;
  version: string;
}>;

const createSearchEntries = (
  catalog: PublicCatalog,
  policies: PublicPolicies,
): readonly SearchEntry[] => [
  ...catalog.records.map((record) => ({
    id: record.translationKey,
    routeId: record.routeId,
    title: record.title,
    summary: record.summary,
    contentType: record.contentType,
    availability: record.availability,
    validationState: record.validationState,
    locale: catalog.locale,
    version: catalog.version,
  })),
  ...policies.documents.map((policy) => ({
    id: `policy-${policy.kind}`,
    routeId: policy.routeId,
    title: policy.title,
    summary: policy.summary,
    contentType: 'policy',
    availability: 'available' as const,
    validationState: 'validated' as const,
    locale: catalog.locale,
    version: policy.version,
  })),
  {
    id: 'responsible-disclosure',
    routeId: policies.disclosure.routeId,
    title: policies.disclosure.title,
    summary: policies.disclosure.summary,
    contentType: 'security',
    availability: 'available',
    validationState: 'validated',
    locale: catalog.locale,
    version: policies.disclosure.history[0]?.version ?? catalog.version,
  },
  {
    id: 'public-status',
    routeId: policies.status.routeId,
    title: policies.status.title,
    summary: policies.status.summary,
    contentType: 'status',
    availability: 'available',
    validationState: 'validated',
    locale: catalog.locale,
    version: catalog.version,
  },
];

export const GlobalSearch = ({
  catalog,
  policies,
  searchParams,
}: Readonly<{
  catalog: PublicCatalog;
  policies: PublicPolicies;
  searchParams: CatalogSearchParameters | undefined;
}>) => {
  const searchRecord = catalog.records.find(({ routeId }) => routeId === 'public-search');
  if (searchRecord?.searchCopy === undefined) {
    throw new Error(`PUBLIC_SEARCH_COPY_MISSING:${catalog.locale}`);
  }

  const query = normalizeSearchValue(searchParams?.q).trim();
  const availability = normalizeSearchValue(searchParams?.availability);
  const selectedAvailability = SUPPORT_STATES.includes(availability as CapabilitySupportState)
    ? (availability as CapabilitySupportState)
    : '';
  const normalizedQuery = normalizeSearchText(query);
  const results =
    normalizedQuery.length === 0
      ? []
      : createSearchEntries(catalog, policies).filter((entry) => {
          const searchable = normalizeSearchText(
            `${entry.title} ${entry.summary} ${entry.contentType}`,
          );
          return (
            searchable.includes(normalizedQuery) &&
            (selectedAvailability.length === 0 || entry.availability === selectedAvailability)
          );
        });

  return (
    <section aria-labelledby="public-search-title" className="global-search">
      <form action={publicBoundaryHref('public-search', catalog.locale)} method="get" role="search">
        <div className="global-search__query">
          <label htmlFor="public-search-query">{searchRecord.searchCopy.label}</label>
          <input
            defaultValue={query}
            id="public-search-query"
            name="q"
            placeholder={catalog.locale === 'pt-BR' ? 'Ex.: compatibilidade' : 'E.g. compatibility'}
            type="search"
          />
        </div>
        <div className="global-search__filter">
          <label htmlFor="public-search-availability">{searchRecord.searchCopy.filterLabel}</label>
          <select
            defaultValue={selectedAvailability}
            id="public-search-availability"
            name="availability"
          >
            <option value="">
              {catalog.locale === 'pt-BR' ? 'Todos os estados' : 'All states'}
            </option>
            {SUPPORT_STATES.map((state) => (
              <option key={state} value={state}>
                {catalog.supportStates[state].label}
              </option>
            ))}
          </select>
        </div>
        <button className="public-action public-action--primary" type="submit">
          {searchRecord.searchCopy.submit}
        </button>
      </form>

      <div aria-live="polite" className="global-search__results">
        {query.length === 0 ? (
          <p>
            {catalog.locale === 'pt-BR'
              ? 'Pesquise por uma tarefa, dúvida ou recurso do Liiiraa Boost.'
              : 'Search for a task, question, or Liiiraa Boost feature.'}
          </p>
        ) : results.length === 0 ? (
          <div className="global-search__empty">
            <h2 id="public-search-title">{searchRecord.searchCopy.emptyTitle}</h2>
            <p>{searchRecord.searchCopy.emptyBody}</p>
          </div>
        ) : (
          <>
            <h2 id="public-search-title">
              {copyFor(catalog.locale).results}: {results.length}
            </h2>
            <ol>
              {results.map((result) => (
                <li key={result.id}>
                  <a href={publicBoundaryHref(result.routeId, catalog.locale)}>{result.title}</a>
                  <p>{result.summary}</p>
                  <small>
                    {catalog.locale === 'pt-BR' ? 'Conteúdo público' : 'Public guidance'} ·{' '}
                    {catalog.supportStates[result.availability].label}
                  </small>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </section>
  );
};

export const PolicyDocument = ({
  locale,
  policy,
}: Readonly<{ locale: WebLocale; policy: PolicyVersion }>) => {
  const copy = copyFor(locale);
  const policyLabel =
    locale === 'pt-BR'
      ? { privacy: 'Privacidade', security: 'Segurança', terms: 'Termos' }[policy.kind]
      : { privacy: 'Privacy', security: 'Security', terms: 'Terms' }[policy.kind];
  return (
    <article className="policy-document">
      <header className="policy-document__header">
        <span>{policyLabel}</span>
        <h1>{policy.title}</h1>
        <p>{policy.summary}</p>
        <aside className="policy-review-notice" role="note">
          <strong>{locale === 'pt-BR' ? 'Revisão necessária' : 'Review required'}</strong>
          <p>{policy.reviewNotice}</p>
        </aside>
        <dl>
          <div>
            <dt>{copy.current}</dt>
            <dd>
              <code>{policy.version}</code>
            </dd>
          </div>
          <div>
            <dt>{locale === 'pt-BR' ? 'Vigência' : 'Effective date'}</dt>
            <dd>
              <time dateTime={policy.effectiveDate}>{policy.effectiveDate}</time>
            </dd>
          </div>
          <div>
            <dt>{copy.contact}</dt>
            <dd>
              <a href={`mailto:${policy.contact}`}>{policy.contact}</a>
            </dd>
          </div>
        </dl>
      </header>
      {policy.privacyDetails !== undefined && (
        <PrivacyDetails details={policy.privacyDetails} locale={locale} />
      )}
      <section aria-label={copy.fullText} className="policy-document__body">
        {policy.sections.map((section) => (
          <section id={section.id} key={section.id}>
            <h2>{section.heading}</h2>
            <p>{section.body}</p>
          </section>
        ))}
      </section>
      <section aria-labelledby="policy-history-title" className="policy-history">
        <h2 id="policy-history-title">{copy.history}</h2>
        <ol>
          {policy.history.map((entry) => (
            <li key={`${entry.version}-${entry.effectiveDate}`}>
              <code>{entry.version}</code>
              <time dateTime={entry.effectiveDate}>{entry.effectiveDate}</time>
              <p>{entry.summary}</p>
            </li>
          ))}
        </ol>
      </section>
    </article>
  );
};

const PrivacyDetails = ({
  details,
  locale,
}: Readonly<{
  details: NonNullable<PolicyVersion['privacyDetails']>;
  locale: WebLocale;
}>) => {
  const portuguese = locale === 'pt-BR';
  const labels = portuguese
    ? {
        controller: 'Quem responde pelo tratamento',
        data: 'Dados',
        legalBasis: 'Base legal',
        purpose: 'Finalidade',
        retention: 'Retenção',
        revocation: 'Escolha e revogação',
        sharing: 'Compartilhamento',
        status: 'Condição',
      }
    : {
        controller: 'Who is accountable for processing',
        data: 'Data',
        legalBasis: 'Legal basis',
        purpose: 'Purpose',
        retention: 'Retention',
        revocation: 'Choice and withdrawal',
        sharing: 'Sharing',
        status: 'Condition',
      };

  return (
    <section aria-labelledby="privacy-practices-title" className="privacy-governance">
      <header id="essential-storage">
        <h2 id="privacy-practices-title">
          {portuguese ? 'Como cada finalidade é tratada' : 'How each purpose is handled'}
        </h2>
        <p>
          {portuguese
            ? 'Armazenamento necessário e usos opcionais têm condições diferentes. O site não transforma silêncio em consentimento.'
            : 'Necessary storage and optional uses have different conditions. The site never treats silence as consent.'}
        </p>
      </header>
      <section aria-labelledby="privacy-controller-title" className="privacy-controller">
        <h3 id="privacy-controller-title">{labels.controller}</h3>
        <dl>
          <div>
            <dt>{portuguese ? 'Produto' : 'Product'}</dt>
            <dd>{details.controller.productIdentity}</dd>
          </div>
          <div>
            <dt>{portuguese ? 'Identificação formal' : 'Formal identification'}</dt>
            <dd>{details.controller.formalIdentityStatus}</dd>
          </div>
          <div>
            <dt>{portuguese ? 'Contato' : 'Contact'}</dt>
            <dd>
              <a href={`mailto:${details.controller.contact}`}>{details.controller.contact}</a>
            </dd>
          </div>
        </dl>
      </section>
      <div className="privacy-practice-ledger">
        {details.practices.map((practice) => (
          <article id={practice.id} key={practice.id}>
            <header>
              <h3>{practice.title}</h3>
              <span data-practice-status={practice.status}>
                {practice.status === 'necessary-only'
                  ? portuguese
                    ? 'Estritamente necessário'
                    : 'Strictly necessary'
                  : portuguese
                    ? 'Consentimento prévio'
                    : 'Prior consent'}
              </span>
            </header>
            <dl>
              {(
                [
                  ['purpose', labels.purpose],
                  ['data', labels.data],
                  ['legalBasis', labels.legalBasis],
                  ['retention', labels.retention],
                  ['sharing', labels.sharing],
                  ['revocation', labels.revocation],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd>{practice[key]}</dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>
      <div className="privacy-accountability">
        <section>
          <h3>{portuguese ? 'Operadores e transferências' : 'Processors and transfers'}</h3>
          <p>{details.processors}</p>
          <p>{details.internationalTransfers}</p>
        </section>
        <section>
          <h3>{portuguese ? 'Seus direitos' : 'Your rights'}</h3>
          <ul>
            {details.rights.map((right) => (
              <li key={right}>{right}</li>
            ))}
          </ul>
        </section>
      </div>
    </section>
  );
};

const ResponsibleDisclosure = ({
  locale,
  policies,
}: Readonly<{ locale: WebLocale; policies: PublicPolicies }>) => {
  const disclosure = policies.disclosure;
  return (
    <article className="policy-document">
      <header className="policy-document__header">
        <span>{locale === 'pt-BR' ? 'Segurança' : 'Security'}</span>
        <h1>{disclosure.title}</h1>
        <p>{disclosure.summary}</p>
        <aside className="policy-review-notice" role="note">
          <strong>{locale === 'pt-BR' ? 'Revisão necessária' : 'Review required'}</strong>
          <p>{disclosure.reviewNotice}</p>
        </aside>
        <dl>
          <div>
            <dt>{copyFor(locale).current}</dt>
            <dd>
              <code>{disclosure.version}</code>
            </dd>
          </div>
          <div>
            <dt>{locale === 'pt-BR' ? 'Vigência' : 'Effective date'}</dt>
            <dd>
              <time dateTime={disclosure.effectiveDate}>{disclosure.effectiveDate}</time>
            </dd>
          </div>
          <div>
            <dt>{copyFor(locale).contact}</dt>
            <dd>
              <a href={`mailto:${disclosure.contact}`}>{disclosure.contact}</a>
            </dd>
          </div>
        </dl>
        <a
          className="public-action public-action--primary"
          href={`mailto:${disclosure.secureChannel}`}
        >
          {locale === 'pt-BR' ? 'Usar canal seguro' : 'Use secure channel'}
        </a>
      </header>
      <div className="disclosure-columns">
        <section>
          <h2>{locale === 'pt-BR' ? 'Escopo' : 'Scope'}</h2>
          <ul>
            {disclosure.scope.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
        <section>
          <h2>{locale === 'pt-BR' ? 'Conteúdo proibido' : 'Prohibited content'}</h2>
          <ul>
            {disclosure.prohibitedContent.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>
      <section>
        <h2>{locale === 'pt-BR' ? 'Resposta esperada' : 'Expected response'}</h2>
        <p>{disclosure.response}</p>
      </section>
      <section className="policy-history">
        <h2>{copyFor(locale).history}</h2>
        <ol>
          {disclosure.history.map((entry) => (
            <li key={entry.version}>
              <code>{entry.version}</code>
              <time dateTime={entry.effectiveDate}>{entry.effectiveDate}</time>
              <p>{entry.summary}</p>
            </li>
          ))}
        </ol>
      </section>
    </article>
  );
};

export const IncidentTimeline = ({
  incidents,
  empty,
  locale,
}: Readonly<{ incidents: readonly IncidentRecord[]; empty: string; locale: WebLocale }>) => (
  <section aria-labelledby="incident-history-title" className="incident-history">
    <h2 id="incident-history-title">{copyFor(locale).incidents}</h2>
    {incidents.length === 0 ? (
      <p className="incident-history__empty">{empty}</p>
    ) : (
      <ol>
        {incidents.map((incident) => (
          <li key={incident.id}>
            <h3>{incident.component}</h3>
            <p>{incident.impact}</p>
            <ol>
              {incident.updates.map((update) => (
                <li key={update.at}>
                  <time dateTime={update.at}>{update.at}</time>
                  <p>{update.body}</p>
                </li>
              ))}
            </ol>
            <p>{incident.resolution}</p>
          </li>
        ))}
      </ol>
    )}
  </section>
);

export const StatusSummary = ({
  locale,
  policies,
}: Readonly<{ locale: WebLocale; policies: PublicPolicies }>) => {
  const status = policies.status;
  const updatedAt = new Intl.DateTimeFormat(locale, {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(status.updatedAt));
  return (
    <article className="status-summary">
      <header>
        <span className="catalog-state" data-state="available">
          <strong>{status.overall}</strong>
        </span>
        <h1>{status.title}</h1>
        <p>{status.summary}</p>
        <p>
          {locale === 'pt-BR' ? 'Atualizado' : 'Updated'}:{' '}
          <time dateTime={status.updatedAt}>{updatedAt}</time>
        </p>
        <nav aria-label={locale === 'pt-BR' ? 'Ajuda operacional' : 'Operational help'}>
          <a
            className="public-action public-action--primary"
            href={publicBoundaryHref('public-support', locale)}
          >
            {locale === 'pt-BR' ? 'Preciso de ajuda' : 'I need help'}
          </a>
          <a className="public-action" href={publicBoundaryHref('releases-index', locale)}>
            {locale === 'pt-BR' ? 'Ver versões' : 'View releases'}
          </a>
        </nav>
      </header>
      <section aria-labelledby="status-components-title">
        <h2 id="status-components-title">{copyFor(locale).components}</h2>
        <div className="status-components">
          {status.components.map((component) => (
            <article key={component.name}>
              <div>
                <h3>{component.name}</h3>
                <span className="catalog-state" data-state={component.state}>
                  {statusStateLabel(locale, component.state)}
                </span>
              </div>
              <p>{component.detail}</p>
            </article>
          ))}
        </div>
      </section>
      <IncidentTimeline
        empty={status.incidentHistoryEmpty}
        incidents={status.incidentHistory}
        locale={locale}
      />
    </article>
  );
};

const CollectionPoint = ({
  locale,
  record,
}: Readonly<{ locale: WebLocale; record: PublicCatalogRecord }>) => {
  if (record.collectionPoint === undefined) return null;
  const point = record.collectionPoint;
  return (
    <section aria-labelledby="collection-point-title" className="collection-point">
      <h2 id="collection-point-title">
        {locale === 'pt-BR' ? 'Limite de coleta' : 'Collection boundary'}
      </h2>
      <DisclosureList
        items={[
          { label: locale === 'pt-BR' ? 'Finalidade' : 'Purpose', value: point.purpose },
          {
            label: locale === 'pt-BR' ? 'Campos obrigatórios' : 'Required fields',
            value: point.requiredFields,
          },
          { label: locale === 'pt-BR' ? 'Retenção' : 'Retention', value: point.retention },
          {
            label: locale === 'pt-BR' ? 'Compartilhamento' : 'Sharing',
            value: point.sharing,
          },
          { label: locale === 'pt-BR' ? 'Revogação' : 'Revocation', value: point.revocation },
        ]}
      />
      <a href={publicBoundaryHref(point.policyRouteId, locale)}>
        {locale === 'pt-BR' ? 'Ler política completa' : 'Read full policy'}
      </a>
    </section>
  );
};

const ProductExperience = ({
  catalog,
  record,
}: Readonly<{ catalog: PublicCatalog; record: PublicCatalogRecord }>) => {
  const portuguese = catalog.locale === 'pt-BR';
  return (
    <div className="catalog-product-experience">
      <section aria-labelledby="product-flow-title" className="catalog-product-flow">
        <header>
          <h2 id="product-flow-title">
            {portuguese
              ? 'Do diagnóstico à restauração, sem pular etapas'
              : 'From diagnosis to restoration, without skipping steps'}
          </h2>
          <p>
            {portuguese
              ? 'Você entende o plano antes de aplicar e confere o resultado no mesmo PC.'
              : 'You understand the plan before applying it and verify the result on the same PC.'}
          </p>
        </header>
        <ol className="catalog-story-sequence">
          {(record.sections ?? []).map((section) => (
            <li key={section.title}>
              <h3>{section.title}</h3>
              <p>{section.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="competitive-session-title" className="competitive-session">
        <div className="competitive-session__introduction">
          <PublicProductIcon name="competitive" size={34} weight="duotone" />
          <div>
            <h2 id="competitive-session-title">
              {portuguese
                ? 'Modo Competitivo prepara a sessão — e termina junto com ela'
                : 'Competitive Mode prepares the session — and ends with it'}
            </h2>
            <p>
              {portuguese
                ? 'O jogo escolhido recebe um plano temporário, revisado e limitado ao que pode ser restaurado com segurança.'
                : 'The selected game receives a temporary, reviewed plan limited to what can be restored safely.'}
            </p>
          </div>
        </div>
        <ul>
          {(portuguese
            ? [
                'Jogo e perfil selecionados antes do início',
                'Ações temporárias revisadas antes de ativar',
                'Prioridade, CPU, serviços e rede dentro de limites seguros',
                'Fim da sessão visível com restauração automática',
              ]
            : [
                'Game and profile selected before the session starts',
                'Temporary actions reviewed before activation',
                'Priority, CPU, services, and network kept within safe limits',
                'Visible session end with automatic restoration',
              ]
          ).map((item) => (
            <li key={item}>
              <PublicProductIcon name="check" size={18} weight="bold" />
              {item}
            </li>
          ))}
        </ul>
        <a className="public-action" href={publicBoundaryHref('public-plans', catalog.locale)}>
          {portuguese ? 'Comparar Essencial e Competitivo' : 'Compare Essential and Competitive'}
        </a>
      </section>
    </div>
  );
};

const ResultsExperience = ({
  catalog,
  record,
}: Readonly<{ catalog: PublicCatalog; record: PublicCatalogRecord }>) => {
  const portuguese = catalog.locale === 'pt-BR';
  const conditions = portuguese
    ? [
        ['Mesmo PC', 'O hardware não muda entre a referência e a comparação.'],
        ['Mesmo jogo', 'Versão, cenário e perfil ficam identificados.'],
        ['Condições visíveis', 'Medição, estimativa e dado indisponível nunca se misturam.'],
      ]
    : [
        ['Same PC', 'Hardware stays unchanged between the baseline and comparison.'],
        ['Same game', 'Version, scenario, and profile remain identified.'],
        ['Visible conditions', 'Measurement, estimate, and unavailable data never blur together.'],
      ];

  return (
    <div className="catalog-results-experience">
      <section aria-labelledby="results-method-title" className="results-method">
        <header>
          <PublicProductIcon name="chart" size={30} weight="duotone" />
          <div>
            <h2 id="results-method-title">
              {portuguese ? 'Uma comparação que merece confiança' : 'A comparison worth trusting'}
            </h2>
            <p>
              {portuguese
                ? 'O resultado nasce de uma referência repetível — não de uma porcentagem de marketing.'
                : 'The result starts with a repeatable baseline — not a marketing percentage.'}
            </p>
          </div>
        </header>
        <ul>
          {conditions.map(([title, body]) => (
            <li key={title}>
              <strong>{title}</strong>
              <span>{body}</span>
            </li>
          ))}
        </ul>
      </section>
      <div className="results-guardrails">
        {(record.sections ?? []).map((section) => (
          <section key={section.title}>
            <h2>{section.title}</h2>
            <p>{section.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
};

const CompatibilityExperience = ({
  catalog,
  record,
}: Readonly<{ catalog: PublicCatalog; record: PublicCatalogRecord }>) => {
  const portuguese = catalog.locale === 'pt-BR';
  return (
    <div className="catalog-compatibility-experience">
      <aside className="compatibility-boundary" role="note">
        <PublicProductIcon name="windows" size={28} weight="duotone" />
        <div>
          <strong>
            {portuguese ? 'A análise acontece no desktop' : 'Analysis happens on the desktop'}
          </strong>
          <p>
            {portuguese
              ? 'A web não examina a sua máquina. O aplicativo desktop verifica hardware, drivers e limites seguros localmente antes de recomendar qualquer ajuste.'
              : 'The website does not inspect your machine. The desktop app checks hardware, drivers, and safe limits locally before recommending any adjustment.'}
          </p>
        </div>
      </aside>
      {record.supportMatrix !== undefined && (
        <CapabilitySupportMatrix catalog={catalog} rows={record.supportMatrix} />
      )}
    </div>
  );
};

const SupportExperience = ({
  catalog,
  record,
}: Readonly<{ catalog: PublicCatalog; record: PublicCatalogRecord }>) => {
  const portuguese = catalog.locale === 'pt-BR';
  const sections = record.sections ?? [];
  return (
    <section aria-labelledby="support-options-title" className="support-service">
      <header>
        <h2 id="support-options-title">
          {portuguese ? 'Escolha o melhor caminho' : 'Choose the best path'}
        </h2>
        <p>
          {portuguese
            ? 'Comece pela opção mais rápida. Se você precisar de acompanhamento, o e-mail mantém o contexto da solicitação.'
            : 'Start with the fastest option. When you need follow-through, email keeps the request context together.'}
        </p>
      </header>
      <div className="support-service__options">
        <a href={publicBoundaryHref('docs-index', catalog.locale)}>
          <strong>{portuguese ? 'Resolver com um guia' : 'Solve it with a guide'}</strong>
          <span>
            {portuguese
              ? 'Instalação, medição, restauração e erros'
              : 'Installation, measurement, restoration, and errors'}
          </span>
          <small>{portuguese ? 'Disponível agora' : 'Available now'}</small>
        </a>
        <a href={publicBoundaryHref('public-status', catalog.locale)}>
          <strong>{portuguese ? 'Verificar o serviço' : 'Check the service'}</strong>
          <span>
            {portuguese
              ? 'Saúde atual e histórico de incidentes'
              : 'Current health and incident history'}
          </span>
          <small>{portuguese ? 'Atualização imediata' : 'Immediate update'}</small>
        </a>
        <a href="mailto:support@liiiraa.com">
          <strong>{portuguese ? 'Falar com o suporte' : 'Contact support'}</strong>
          <span>
            {portuguese
              ? 'Dúvidas que precisam de acompanhamento'
              : 'Questions that need follow-through'}
          </span>
          <small>support@liiiraa.com</small>
        </a>
      </div>
      <section aria-labelledby="support-response-title" className="support-response-ledger">
        <h2 id="support-response-title">
          {portuguese ? 'Prazos e prioridades' : 'Response times and priorities'}
        </h2>
        <div>
          {sections.map((section) => (
            <article key={section.title}>
              <h3>{section.title}</h3>
              <p>{section.body}</p>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
};

const CatalogAcquisitionExperience = ({
  catalog,
  record,
}: Readonly<{ catalog: PublicCatalog; record: PublicCatalogRecord }>) => {
  switch (record.routeId) {
    case 'public-product':
      return <ProductExperience catalog={catalog} record={record} />;
    case 'public-results':
      return <ResultsExperience catalog={catalog} record={record} />;
    case 'public-compatibility':
      return <CompatibilityExperience catalog={catalog} record={record} />;
    case 'public-plans':
    case 'public-search':
      return null;
    case 'public-support':
      return <SupportExperience catalog={catalog} record={record} />;
  }
};

const CatalogBody = ({
  catalog,
  includePlans = true,
  record,
}: Readonly<{
  catalog: PublicCatalog;
  includePlans?: boolean;
  record: PublicCatalogRecord;
}>) => (
  <div id="catalog-route-body">
    <CatalogAcquisitionExperience catalog={catalog} record={record} />
    {record.sections !== undefined &&
      !['public-product', 'public-results', 'public-support'].includes(record.routeId) && (
        <div className="catalog-story-sequence">
          {record.sections.map((section) => (
            <section key={section.title}>
              <h2>{section.title}</h2>
              <p>{section.body}</p>
            </section>
          ))}
        </div>
      )}
    {record.supportMatrix !== undefined && record.routeId !== 'public-compatibility' && (
      <CapabilitySupportMatrix catalog={catalog} rows={record.supportMatrix} />
    )}
    {includePlans && record.plans !== undefined && (
      <PlanComparison catalog={catalog} plans={record.plans} record={record} />
    )}
    <CollectionPoint locale={catalog.locale} record={record} />
    <Limitations limitations={record.limitations} locale={catalog.locale} />
    <section aria-labelledby="catalog-evidence-title" className="catalog-evidence-list">
      <h2 id="catalog-evidence-title">{copyFor(catalog.locale).evidence}</h2>
      {record.evidence.map((evidence) => (
        <EvidenceDisclosure
          evidence={evidence}
          key={`${evidence.source}-${evidence.scope}`}
          locale={catalog.locale}
        />
      ))}
    </section>
  </div>
);

const PublicCatalogComposition = ({
  children,
  routeId,
}: Readonly<{ children: ReactNode; routeId: WebRouteId }>) => (
  <div className="public-catalog" data-route-id={routeId}>
    {children}
  </div>
);

export const PublicCatalogPage = ({ locale, routeId, searchParams }: PublicCatalogPageProps) => {
  const catalog = CATALOGS[locale];
  const policies = POLICIES[locale];

  if (routeId === 'public-search') {
    const record = catalog.records.find((candidate) => candidate.routeId === routeId);
    if (record === undefined) throw new Error(`PUBLIC_CATALOG_ROUTE_MISSING:${routeId}`);
    return (
      <PublicCatalogComposition routeId={routeId}>
        <RouteIntroduction catalog={catalog} record={record} />
        <GlobalSearch catalog={catalog} policies={policies} searchParams={searchParams} />
      </PublicCatalogComposition>
    );
  }

  if (
    routeId === 'public-policies' ||
    routeId === 'public-privacy-policy' ||
    routeId === 'public-terms'
  ) {
    const policy = policies.documents.find((candidate) => candidate.routeId === routeId);
    if (policy === undefined) throw new Error(`PUBLIC_POLICY_ROUTE_MISSING:${routeId}`);
    return (
      <PublicCatalogComposition routeId={routeId}>
        <PolicyDocument locale={locale} policy={policy} />
      </PublicCatalogComposition>
    );
  }

  if (routeId === 'public-responsible-disclosure') {
    return (
      <PublicCatalogComposition routeId={routeId}>
        <ResponsibleDisclosure locale={locale} policies={policies} />
      </PublicCatalogComposition>
    );
  }

  if (routeId === 'public-status') {
    return (
      <PublicCatalogComposition routeId={routeId}>
        <StatusSummary locale={locale} policies={policies} />
      </PublicCatalogComposition>
    );
  }

  const record = catalog.records.find((candidate) => candidate.routeId === routeId);
  if (record === undefined) throw new Error(`PUBLIC_CATALOG_ROUTE_MISSING:${routeId}`);

  if (routeId === 'public-plans' && record.plans !== undefined) {
    return (
      <PublicCatalogComposition routeId={routeId}>
        <PlanComparison catalog={catalog} plans={record.plans} record={record} />
        <CatalogBody catalog={catalog} includePlans={false} record={record} />
      </PublicCatalogComposition>
    );
  }

  return (
    <PublicCatalogComposition routeId={routeId}>
      <RouteIntroduction catalog={catalog} record={record} />
      <CatalogBody catalog={catalog} record={record} />
    </PublicCatalogComposition>
  );
};

const PUBLIC_EVIDENCE_LEGACY_COPY = Object.freeze({
  en: Object.freeze({
    body: 'Liiiraa Boost compares the same PC, game, and visible conditions before presenting a result. Estimates, measurements, and unavailable data are always identified separately.',
    docs: 'Read the measurement guide',
    eyebrow: 'Evidence you can inspect',
    results: 'See how results are proven',
    summary:
      'This address remains available for old links. The complete, current explanation now lives in Results.',
    title: 'How proof is built.',
  }),
  'pt-BR': Object.freeze({
    body: 'O Liiiraa Boost compara o mesmo PC, o mesmo jogo e condições visíveis antes de apresentar um resultado. Estimativa, medição e dado indisponível aparecem sempre separados.',
    docs: 'Ler o guia de medição',
    eyebrow: 'Evidência que você pode conferir',
    results: 'Ver como comprovamos resultados',
    summary:
      'Este endereço continua disponível para links antigos. A explicação completa e atual agora está em Resultados.',
    title: 'Como a prova é construída.',
  }),
});

export const PublicEvidenceLegacyPage = ({ locale }: Readonly<{ locale: WebLocale }>) => {
  const catalog = CATALOGS[locale];
  const results = catalog.records.find(({ routeId }) => routeId === 'public-results');
  if (results === undefined) throw new Error('PUBLIC_EVIDENCE_RESULTS_MISSING');
  const copy = PUBLIC_EVIDENCE_LEGACY_COPY[locale];

  return (
    <PublicCatalogComposition routeId="public-evidence">
      <section className="public-evidence-legacy">
        <p>{copy.eyebrow}</p>
        <h1 tabIndex={-1}>{copy.title}</h1>
        <p>{copy.body}</p>
        <p>{copy.summary}</p>
        <nav aria-label={copy.title}>
          <a
            className="public-action public-action--primary"
            href={publicBoundaryHref('public-results', locale)}
          >
            {copy.results}
          </a>
          <a className="public-action" href={publicBoundaryHref('docs-index', locale)}>
            {copy.docs}
          </a>
        </nav>
      </section>
      <ResultsExperience catalog={catalog} record={results} />
    </PublicCatalogComposition>
  );
};

export const getPublicEvidenceLegacyMetadata = (locale: WebLocale) => {
  const copy = PUBLIC_EVIDENCE_LEGACY_COPY[locale];
  return { description: copy.body, title: copy.title };
};

export const getPublicCatalogMetadata = (
  locale: WebLocale,
  routeId: WebRouteId,
): Readonly<{ title: string; description: string }> | undefined => {
  const catalog = CATALOGS[locale];
  const policies = POLICIES[locale];
  const record = catalog.records.find((candidate) => candidate.routeId === routeId);
  if (record !== undefined) return { title: record.title, description: record.summary };
  const policy = policies.documents.find((candidate) => candidate.routeId === routeId);
  if (policy !== undefined) return { title: policy.title, description: policy.summary };
  if (routeId === policies.disclosure.routeId) {
    return { title: policies.disclosure.title, description: policies.disclosure.summary };
  }
  if (routeId === policies.status.routeId) {
    return { title: policies.status.title, description: policies.status.summary };
  }
  return undefined;
};
