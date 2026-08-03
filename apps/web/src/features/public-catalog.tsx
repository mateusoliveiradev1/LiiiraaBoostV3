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
  | 'public-evidence'
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
  sections: readonly Readonly<{ heading: string; body: string }>[];
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

type Policies = Readonly<{
  schemaVersion: 1;
  locale: WebLocale;
  lastReviewedAt: string;
  documents: readonly PolicyVersion[];
  disclosure: Readonly<{
    routeId: WebRouteId;
    title: string;
    summary: string;
    secureChannel: string;
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
  'public-evidence',
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

const admitPolicies = (candidate: unknown, locale: WebLocale): Policies => {
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
  for (const [index, value] of candidate['documents'].entries()) {
    if (
      !isRecord(value) ||
      !isNonEmptyString(value['routeId']) ||
      !isNonEmptyString(value['title']) ||
      !isNonEmptyString(value['summary']) ||
      !isNonEmptyString(value['version']) ||
      !isNonEmptyString(value['effectiveDate']) ||
      !isNonEmptyString(value['contact']) ||
      !Array.isArray(value['sections']) ||
      value['sections'].length === 0 ||
      !Array.isArray(value['history']) ||
      value['history'].length === 0
    ) {
      throw new Error(`PUBLIC_POLICIES_INVALID:${locale}:document:${String(index)}`);
    }
    routeIds.push(value['routeId']);
  }

  if (
    !hasExactStrings(routeIds, POLICY_ROUTE_IDS) ||
    candidate['disclosure']['routeId'] !== 'public-responsible-disclosure' ||
    candidate['status']['routeId'] !== 'public-status' ||
    !Array.isArray(candidate['status']['components']) ||
    !Array.isArray(candidate['status']['incidentHistory'])
  ) {
    throw new Error(`PUBLIC_POLICIES_INVALID:${locale}:route-parity`);
  }

  return candidate as unknown as Policies;
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
  const policyIdentity = (policies: Policies): string =>
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
    case 'public-evidence':
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
          href: '#catalog-route-body',
          label: portuguese ? 'Checar meu PC' : 'Check my PC',
        },
        secondary: {
          href: href('public-support'),
          label: portuguese ? 'Preciso de ajuda' : 'I need help',
        },
      };
    case 'public-plans':
      return {
        kicker: portuguese ? 'Premium com transparência' : 'Premium with transparency',
        primary: {
          href: accountBoundaryHref(locale),
          label: portuguese ? 'Continuar com Premium' : 'Continue with Premium',
        },
        secondary: {
          href: href('public-compatibility'),
          label: portuguese ? 'Checar meu PC' : 'Check my PC',
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

  return (
    <section aria-labelledby="plan-comparison-title" className="plan-comparison-ledger">
      {plans.map((plan) => (
        <article className="plan-record" id={plan.id} key={plan.id}>
          <div className="plan-purchase-stage">
            <header className="catalog-introduction plan-offer" data-route-purpose={record.routeId}>
              <span className="plan-offer__label">
                <PublicProductIcon name="crown" size={18} weight="bold" />
                {plan.name}
              </span>
              <h1 id="plan-comparison-title">{record.title}</h1>
              <p className="plan-offer__summary">{record.summary}</p>
              <p aria-label={`${plan.price} ${plan.billingPeriod}`} className="plan-price">
                <strong>{plan.price}</strong>
                <span>{plan.billingPeriod}</span>
              </p>
            </header>

            <aside className="plan-checkout" data-checkout-authority="disconnected">
              <span className="plan-checkout__status">
                <PublicProductIcon name="shield" size={18} />
                {catalog.locale === 'pt-BR' ? 'Prévia segura' : 'Safe preview'}
              </span>
              <h2>
                {catalog.locale === 'pt-BR' ? 'Comece pela sua conta' : 'Start with your account'}
              </h2>
              <p>{plan.checkoutBoundary}</p>
              <a
                className="public-action public-action--primary catalog-primary-action plan-checkout__action"
                href={presentation.primary.href}
              >
                {presentation.primary.label}
              </a>
              <a
                className="public-action plan-checkout__secondary"
                href={presentation.secondary.href}
              >
                {presentation.secondary.label}
              </a>
              <small>
                {catalog.locale === 'pt-BR'
                  ? 'Nenhuma cobrança será criada nesta prévia.'
                  : 'No charge will be created in this preview.'}
              </small>
            </aside>
          </div>

          <section className="plan-inclusions">
            <h2>{catalog.locale === 'pt-BR' ? 'O que você recebe' : 'What you get'}</h2>
            <ul
              aria-label={catalog.locale === 'pt-BR' ? 'Recursos do plano' : 'Plan features'}
              className="plan-capabilities"
            >
              {plan.capabilities.map((capability, index) => {
                const icons = ['gauge', 'profile', 'recovery', 'download'] as const;
                return (
                  <li key={capability.name}>
                    <PublicProductIcon name={icons[index] ?? 'check'} size={20} />
                    <span>{capability.name}</span>
                    <SupportState catalog={catalog} state={capability.state} />
                  </li>
                );
              })}
            </ul>
          </section>

          <div className="plan-record__disclosures">
            <details className="plan-terms">
              <summary>
                {catalog.locale === 'pt-BR'
                  ? 'Conferir renovação, cancelamento, dispositivos e reembolso'
                  : 'Review renewal, cancellation, devices, and refunds'}
              </summary>
              <DisclosureList
                items={[
                  { label: catalog.locale === 'pt-BR' ? 'Preço' : 'Price', value: plan.price },
                  {
                    label: catalog.locale === 'pt-BR' ? 'Período de cobrança' : 'Billing period',
                    value: plan.billingPeriod,
                  },
                  {
                    label: catalog.locale === 'pt-BR' ? 'Renovação' : 'Renewal',
                    value: plan.renewal,
                  },
                  { label: catalog.locale === 'pt-BR' ? 'Tributos' : 'Taxes', value: plan.taxes },
                  {
                    label: catalog.locale === 'pt-BR' ? 'Cancelamento' : 'Cancellation',
                    value: plan.cancellation,
                  },
                  {
                    label: catalog.locale === 'pt-BR' ? 'Reembolsos' : 'Refunds',
                    value: plan.refunds,
                  },
                  {
                    label: catalog.locale === 'pt-BR' ? 'Regras de dispositivo' : 'Device rules',
                    value: plan.deviceRules,
                  },
                  {
                    label:
                      catalog.locale === 'pt-BR' ? 'Efeito da expiração' : 'Expiration effects',
                    value: plan.expirationEffects,
                  },
                ]}
              />
            </details>
            <details className="catalog-introduction__provenance plan-provenance">
              <summary>{localeSummary(catalog.locale)}</summary>
              <div className="catalog-introduction__identity">
                <SupportState catalog={catalog} state={record.availability} />
              </div>
              <p>
                {record.contentType} · {catalog.locale} · <code>{catalog.version}</code>
              </p>
            </details>
          </div>
        </article>
      ))}
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
  policies: Policies,
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
  policies: Policies;
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
              ? 'Envie uma busca para consultar apenas o índice público admitido.'
              : 'Submit a query to inspect only the admitted public index.'}
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
                  <dl>
                    <div>
                      <dt>{catalog.locale === 'pt-BR' ? 'Tipo' : 'Type'}</dt>
                      <dd>{result.contentType}</dd>
                    </div>
                    <div>
                      <dt>{catalog.locale === 'pt-BR' ? 'Idioma' : 'Locale'}</dt>
                      <dd>{result.locale}</dd>
                    </div>
                    <div>
                      <dt>{copyFor(catalog.locale).version}</dt>
                      <dd>
                        <code>{result.version}</code>
                      </dd>
                    </div>
                    <div>
                      <dt>{copyFor(catalog.locale).availability}</dt>
                      <dd>{catalog.supportStates[result.availability].label}</dd>
                    </div>
                    <div>
                      <dt>{copyFor(catalog.locale).validation}</dt>
                      <dd>{result.validationState}</dd>
                    </div>
                  </dl>
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
  return (
    <article className="policy-document">
      <header className="policy-document__header">
        <span>{policy.kind}</span>
        <h1>{policy.title}</h1>
        <p>{policy.summary}</p>
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
      <section aria-label={copy.fullText} className="policy-document__body">
        {policy.sections.map((section) => (
          <section key={section.heading}>
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

const ResponsibleDisclosure = ({
  locale,
  policies,
}: Readonly<{ locale: WebLocale; policies: Policies }>) => {
  const disclosure = policies.disclosure;
  return (
    <article className="policy-document">
      <header className="policy-document__header">
        <span>security</span>
        <h1>{disclosure.title}</h1>
        <p>{disclosure.summary}</p>
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
}: Readonly<{ locale: WebLocale; policies: Policies }>) => {
  const status = policies.status;
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
          <time dateTime={status.updatedAt}>{status.updatedAt}</time>
        </p>
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
    {record.sections !== undefined && (
      <div className="catalog-story-sequence">
        {record.sections.map((section) => (
          <section key={section.title}>
            <h2>{section.title}</h2>
            <p>{section.body}</p>
          </section>
        ))}
      </div>
    )}
    {record.supportMatrix !== undefined && (
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
