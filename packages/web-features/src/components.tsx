import type { ReactNode, SyntheticEvent } from 'react';
import {
  LbButton,
  LbDialog,
  LbDialogActions,
  LbIconButton,
  LbLink,
  LbMenu,
  ProductLockup,
  LbSearchField,
  LbSelect,
  LbSheet,
  LbTabs,
  LbTextField,
} from '@liiiraa/design-system';

export {
  LbButton,
  LbDialog,
  LbDialogActions,
  LbIconButton,
  LbLink,
  LbMenu,
  ProductLockup,
  LbSearchField,
  LbSelect,
  LbTabs,
  LbTextField,
};

export interface LbPopoverProps {
  readonly children: ReactNode;
  readonly description?: string;
  readonly isOpen?: boolean;
  readonly onOpenChange?: (isOpen: boolean) => void;
  readonly title: string;
  readonly trigger: ReactNode;
}

export const LbPopover = ({
  children,
  description,
  isOpen,
  onOpenChange,
  title,
  trigger,
}: LbPopoverProps) => (
  <LbSheet
    {...(description === undefined ? {} : { description })}
    {...(isOpen === undefined ? {} : { isOpen })}
    {...(onOpenChange === undefined ? {} : { onOpenChange })}
    title={title}
    trigger={trigger}
  >
    {children}
  </LbSheet>
);

export const LbDisclosure = ({
  children,
  label,
}: {
  readonly children: ReactNode;
  readonly label: string;
}) => (
  <details className="lb-web-disclosure">
    <summary data-lb-control>{label}</summary>
    <div className="lb-web-disclosure-content">{children}</div>
  </details>
);

export const LbToast = ({
  children,
  tone = 'neutral',
}: {
  readonly children: ReactNode;
  readonly tone?: 'neutral' | 'success' | 'warning' | 'critical';
}) => (
  <div
    aria-live={tone === 'critical' ? 'assertive' : 'polite'}
    className="lb-web-toast"
    data-tone={tone}
    role={tone === 'critical' ? 'alert' : 'status'}
  >
    {children}
  </div>
);

export const WEB_STATUS_STATES = Object.freeze([
  'default',
  'loading',
  'empty',
  'error',
  'warning',
  'success',
  'unavailable',
  'stale',
  'offline',
  'preview',
] as const);
export type WebStatusState = (typeof WEB_STATUS_STATES)[number];

export const WEB_PROVENANCE_KINDS = Object.freeze([
  'measured',
  'simulated',
  'derived',
  'user-provided',
  'unavailable',
] as const);
export type WebProvenanceKind = (typeof WEB_PROVENANCE_KINDS)[number];

export type WebLocale = 'pt-BR' | 'en' | 'pseudo';

const STATUS_COPY: Readonly<
  Record<WebStatusState, Readonly<{ label: string; pattern: string; tone: string }>>
> = Object.freeze({
  default: { label: 'Ready', pattern: 'solid', tone: 'neutral' },
  loading: { label: 'Loading', pattern: 'dashed', tone: 'neutral' },
  empty: { label: 'Nothing needs your attention', pattern: 'dotted', tone: 'neutral' },
  error: { label: 'Could not load this part', pattern: 'double', tone: 'critical' },
  warning: { label: 'Review required', pattern: 'dashed', tone: 'warning' },
  success: { label: 'Verified', pattern: 'solid', tone: 'success' },
  unavailable: { label: 'Unavailable', pattern: 'dotted', tone: 'restricted' },
  stale: { label: 'Data is stale', pattern: 'dot-dash', tone: 'warning' },
  offline: { label: 'Offline', pattern: 'long-dash', tone: 'warning' },
  preview: { label: 'Deterministic preview', pattern: 'diagonal-stripe', tone: 'experimental' },
});

const PROVENANCE_COPY: Readonly<Record<WebProvenanceKind, Readonly<Record<WebLocale, string>>>> =
  Object.freeze({
    measured: { 'pt-BR': 'Medido', en: 'Measured', pseudo: '[Ḿéáşúŕéđ]' },
    simulated: {
      'pt-BR': 'Prévia simulada',
      en: 'Simulated preview',
      pseudo: '[Şíḿúĺáţéđ ṕŕévíéŵ]',
    },
    derived: { 'pt-BR': 'Derivado', en: 'Derived', pseudo: '[Đéŕívéđ]' },
    'user-provided': {
      'pt-BR': 'Informado pelo usuário',
      en: 'User-provided',
      pseudo: '[Úşéŕ-ṕŕóvíđéđ]',
    },
    unavailable: { 'pt-BR': 'Indisponível', en: 'Unavailable', pseudo: '[Úńáváíĺáƀĺé]' },
  });

export interface StatusSignalProps {
  readonly detail?: string;
  readonly label?: string;
  readonly state: WebStatusState;
}

export const StatusSignal = ({ detail, label, state }: StatusSignalProps) => {
  const projection = STATUS_COPY[state];
  const isBlocking = state === 'error';
  return (
    <span
      aria-live={isBlocking ? 'assertive' : 'polite'}
      className="lb-web-status"
      data-pattern={projection.pattern}
      data-state={state}
      data-tone={projection.tone}
      role={isBlocking ? 'alert' : 'status'}
    >
      <span aria-hidden="true" className="lb-web-status-symbol">
        {state === 'success' ? '✓' : state === 'error' ? '!' : '•'}
      </span>
      <strong>{label ?? projection.label}</strong>
      {detail ? <span>{detail}</span> : null}
    </span>
  );
};

export interface QualityMarkProps {
  readonly detail?: string;
  readonly quality: 'verified' | 'warning' | 'critical' | 'experimental' | 'unavailable';
}

export const QualityMark = ({ detail, quality }: QualityMarkProps) => (
  <StatusSignal
    {...(detail === undefined ? {} : { detail })}
    label={
      quality === 'verified'
        ? 'Verified'
        : quality === 'warning'
          ? 'Review required'
          : quality === 'critical'
            ? 'Blocked'
            : quality === 'experimental'
              ? 'Experimental'
              : 'Unavailable'
    }
    state={
      quality === 'verified'
        ? 'success'
        : quality === 'warning'
          ? 'warning'
          : quality === 'critical'
            ? 'error'
            : quality === 'experimental'
              ? 'preview'
              : 'unavailable'
    }
  />
);

export interface ProvenanceLabelProps {
  readonly detail?: string;
  readonly kind: WebProvenanceKind;
  readonly locale?: WebLocale;
}

export const ProvenanceLabel = ({ detail, kind, locale = 'en' }: ProvenanceLabelProps) => (
  <span className="lb-web-provenance" data-provenance={kind}>
    <span aria-hidden="true">{kind === 'simulated' ? '◇' : kind === 'measured' ? '●' : '○'}</span>
    <strong>{PROVENANCE_COPY[kind][locale]}</strong>
    {detail ? <span>{detail}</span> : null}
  </span>
);

export interface EvidenceDisclosureProps {
  readonly children: ReactNode;
  readonly label: string;
  readonly provenance: WebProvenanceKind;
  readonly summary?: string;
}

export const EvidenceDisclosure = ({
  children,
  label,
  provenance,
  summary,
}: EvidenceDisclosureProps) => (
  <details className="lb-web-disclosure">
    <summary data-lb-control>
      <span>{label}</span>
      <ProvenanceLabel kind={provenance} />
    </summary>
    {summary ? <p>{summary}</p> : null}
    <div className="lb-web-disclosure-content">{children}</div>
  </details>
);

export interface RouteHeaderProps {
  readonly actions?: ReactNode;
  readonly description: string;
  readonly title: string;
}

export const RouteHeader = ({ actions, description, title }: RouteHeaderProps) => (
  <header className="lb-web-route-header">
    <div>
      <h1 tabIndex={-1}>{title}</h1>
      <p>{description}</p>
    </div>
    {actions ? <div className="lb-web-route-actions">{actions}</div> : null}
  </header>
);

export interface EmptyCompositionProps {
  readonly action?: ReactNode;
  readonly description: string;
  readonly title?: string;
}

export const EmptyComposition = ({
  action,
  description,
  title = 'Nothing needs your attention',
}: EmptyCompositionProps) => (
  <section className="lb-web-empty" aria-labelledby="lb-web-empty-title">
    <h2 id="lb-web-empty-title">{title}</h2>
    <p>{description}</p>
    {action}
  </section>
);

export interface OperationalFailureProps {
  readonly affectedCapability: string;
  readonly recovery?: ReactNode;
  readonly safeState: string;
}

export const OperationalFailure = ({
  affectedCapability,
  recovery,
  safeState,
}: OperationalFailureProps) => (
  <section className="lb-web-failure" role="alert">
    <h2>This part could not be loaded</h2>
    <p>
      <strong>Affected capability:</strong> {affectedCapability}
    </p>
    <p>
      <strong>What remains safe:</strong> {safeState}
    </p>
    {recovery}
  </section>
);

export interface VerificationReceiptProps {
  readonly changed: boolean;
  readonly children?: ReactNode;
  readonly receiptId: string;
  readonly title: string;
}

export const VerificationReceipt = ({
  changed,
  children,
  receiptId,
  title,
}: VerificationReceiptProps) => (
  <section aria-labelledby={`${receiptId}-title`} className="lb-web-receipt">
    <StatusSignal state={changed ? 'success' : 'preview'} />
    <h2 id={`${receiptId}-title`}>{title}</h2>
    {children}
    <dl>
      <div>
        <dt>Receipt</dt>
        <dd>
          <code>{receiptId}</code>
        </dd>
      </div>
      <div>
        <dt>Remote state changed</dt>
        <dd>{changed ? 'Yes' : 'No'}</dd>
      </div>
    </dl>
  </section>
);

export interface ResponsiveColumn {
  readonly essential?: boolean;
  readonly id: string;
  readonly label: string;
}

export interface ResponsiveRow {
  readonly cells: Readonly<Record<string, ReactNode>>;
  readonly detail?: ReactNode;
  readonly id: string;
}

export interface ResponsiveDataTableProps {
  readonly caption: string;
  readonly columns: readonly ResponsiveColumn[];
  readonly rows: readonly ResponsiveRow[];
}

export const DetailRow = ({
  children,
  label = 'View complete row',
}: {
  readonly children: ReactNode;
  readonly label?: string;
}) => (
  <details className="lb-web-detail-row">
    <summary data-lb-control>{label}</summary>
    <div>{children}</div>
  </details>
);

export const ResponsiveDataTable = ({ caption, columns, rows }: ResponsiveDataTableProps) => (
  <div aria-label={caption} className="lb-web-table-region" role="region" tabIndex={0}>
    <table>
      <caption>{caption}</caption>
      <thead>
        <tr>
          {columns.map((column) => (
            <th data-essential={column.essential !== false} key={column.id} scope="col">
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            {columns.map((column, columnIndex) => (
              <td data-essential={column.essential !== false} key={column.id}>
                {row.cells[column.id] ?? <span>Unavailable</span>}
                {columnIndex === 0 && row.detail ? <DetailRow>{row.detail}</DetailRow> : null}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export interface FilterBarProps {
  readonly children: ReactNode;
  readonly label?: string;
  readonly onSubmit?: () => void;
}

export const FilterBar = ({ children, label = 'Filter results', onSubmit }: FilterBarProps) => {
  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit?.();
  };
  return (
    <form aria-label={label} className="lb-web-filter-bar" onSubmit={handleSubmit} role="search">
      {children}
    </form>
  );
};

export interface BoundaryNoticeProps {
  readonly children?: ReactNode;
  readonly description: string;
  readonly title: string;
}

export const BoundaryTransitionNotice = ({ children, description, title }: BoundaryNoticeProps) => (
  <aside className="lb-web-boundary" role="note">
    <strong>{title}</strong>
    <p>{description}</p>
    {children}
  </aside>
);

export const PreviewBoundary = ({
  children,
  description = 'Deterministic preview — no remote authority is connected.',
  title = 'Preview boundary',
}: Partial<BoundaryNoticeProps>) => (
  <BoundaryTransitionNotice description={description} title={title}>
    <StatusSignal state="preview" />
    {children}
  </BoundaryTransitionNotice>
);

export interface NoChangeReceiptProps {
  readonly authority: string;
  readonly receiptId: string;
  readonly reviewedObject: string;
}

export const NoChangeReceipt = ({ authority, receiptId, reviewedObject }: NoChangeReceiptProps) => (
  <VerificationReceipt
    changed={false}
    receiptId={receiptId}
    title="Preview complete — no change was made"
  >
    <p>
      Review of <strong>{reviewedObject}</strong> is complete. {authority} is not connected; no
      remote state was changed.
    </p>
  </VerificationReceipt>
);

export interface SemanticRegionProps {
  readonly children?: ReactNode;
  readonly description?: string;
  readonly title: string;
}

const createSemanticRegion = (className: string) => {
  const Region = ({ children, description, title }: SemanticRegionProps) => (
    <section className={className}>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
      {children}
    </section>
  );
  return Region;
};

export interface CommandRunwayHeroProps {
  readonly artifact: ReactNode;
  readonly boundary: ReactNode;
  readonly cta: ReactNode;
  readonly promise: string;
  readonly summary: string;
}

export const CommandRunwayHero = ({
  artifact,
  boundary,
  cta,
  promise,
  summary,
}: CommandRunwayHeroProps) => (
  <section className="lb-web-command-runway">
    <div className="lb-web-command-copy">
      <h1>{promise}</h1>
      <p>{summary}</p>
      <div className="lb-web-command-action">{cta}</div>
      {boundary}
    </div>
    <div className="lb-web-command-artifact">{artifact}</div>
  </section>
);

export interface RealProductStageProps {
  readonly alt: string;
  readonly completeScreenshotHref: string;
  readonly completeScreenshotLabel?: string;
  readonly height: number;
  readonly loading?: 'eager' | 'lazy';
  readonly provenance: string;
  readonly src: string;
  readonly width: number;
}

export const RealProductStage = ({
  alt,
  completeScreenshotHref,
  completeScreenshotLabel = 'View complete screenshot',
  height,
  loading = 'eager',
  provenance,
  src,
  width,
}: RealProductStageProps) => (
  <figure className="lb-web-product-stage">
    <img alt={alt} decoding="async" height={height} loading={loading} src={src} width={width} />
    <figcaption>
      <ProvenanceLabel detail={provenance} kind="measured" />
      <LbLink href={completeScreenshotHref}>{completeScreenshotLabel}</LbLink>
    </figcaption>
  </figure>
);

export interface ClaimEvidenceRowProps {
  readonly claim: string;
  readonly labels?: Readonly<{
    readonly scope: string;
    readonly source: string;
    readonly unprovenBoundary: string;
    readonly validationState: string;
    readonly version: string;
  }>;
  readonly provenance: WebProvenanceKind;
  readonly scope: string;
  readonly source: string;
  readonly unprovenBoundary?: string;
  readonly validationState: string;
  readonly version: string;
}

export const ClaimEvidenceRow = ({
  claim,
  labels = {
    scope: 'Scope',
    source: 'Source',
    unprovenBoundary: 'What remains unproven',
    validationState: 'Validation state',
    version: 'Version',
  },
  provenance,
  scope,
  source,
  unprovenBoundary,
  validationState,
  version,
}: ClaimEvidenceRowProps) => (
  <article className="lb-web-claim-row">
    <h3>{claim}</h3>
    <ProvenanceLabel kind={provenance} />
    <dl>
      <div>
        <dt>{labels.source}</dt>
        <dd>{source}</dd>
      </div>
      <div>
        <dt>{labels.scope}</dt>
        <dd>{scope}</dd>
      </div>
      <div>
        <dt>{labels.version}</dt>
        <dd>
          <code>{version}</code>
        </dd>
      </div>
      <div>
        <dt>{labels.validationState}</dt>
        <dd>{validationState}</dd>
      </div>
      {unprovenBoundary ? (
        <div>
          <dt>{labels.unprovenBoundary}</dt>
          <dd>{unprovenBoundary}</dd>
        </div>
      ) : null}
    </dl>
  </article>
);

export const CapabilitySupportMatrix = createSemanticRegion('lb-web-support-matrix');
export const CompatibilityWizard = createSemanticRegion('lb-web-compatibility-wizard');
export const PlanComparison = createSemanticRegion('lb-web-plan-comparison');

export interface SearchResultProps {
  readonly description: string;
  readonly href: string;
  readonly metadata?: ReactNode;
  readonly title: string;
}

export const SearchResult = ({ description, href, metadata, title }: SearchResultProps) => (
  <article className="lb-web-search-result">
    <h3>
      <LbLink href={href}>{title}</LbLink>
    </h3>
    <p>{description}</p>
    {metadata}
  </article>
);

export const GlobalSearch = createSemanticRegion('lb-web-global-search');
export const SearchFilters = FilterBar;

export interface LinkItem {
  readonly href: string;
  readonly id: string;
  readonly label: string;
}

export const DocumentationIndex = ({
  items,
  label = 'Documentation index',
}: {
  readonly items: readonly LinkItem[];
  readonly label?: string;
}) => (
  <nav aria-label={label} className="lb-web-documentation-index">
    <ul>
      {items.map((item) => (
        <li key={item.id}>
          <LbLink href={item.href}>{item.label}</LbLink>
        </li>
      ))}
    </ul>
  </nav>
);

export const VersionSelector = ({
  children,
  label = 'Documentation version',
}: {
  readonly children: ReactNode;
  readonly label?: string;
}) => (
  <div aria-label={label} className="lb-web-version-selector" role="group">
    {children}
  </div>
);

export const ArticleMetadata = ({
  entries,
}: {
  readonly entries: readonly { readonly label: string; readonly value: ReactNode }[];
}) => (
  <dl className="lb-web-article-metadata">
    {entries.map((entry) => (
      <div key={entry.label}>
        <dt>{entry.label}</dt>
        <dd>{entry.value}</dd>
      </div>
    ))}
  </dl>
);

export const StaleDocumentNotice = ({
  canonicalHref,
  version,
}: {
  readonly canonicalHref: string;
  readonly version: string;
}) => (
  <BoundaryTransitionNotice
    description={`Version ${version} is historical or unsupported. This page has not been redirected.`}
    title="Historical documentation"
  >
    <LbLink href={canonicalHref}>Open the current canonical version</LbLink>
  </BoundaryTransitionNotice>
);

export const TroubleshootingPath = createSemanticRegion('lb-web-troubleshooting');
export const ObservedStatePrompt = createSemanticRegion('lb-web-observed-state');
export const RecoveryEscalation = createSemanticRegion('lb-web-recovery-escalation');
export const ReleaseChannelSelector = createSemanticRegion('lb-web-release-channel');
export const ReleaseIntegrityPanel = createSemanticRegion('lb-web-release-integrity');

export const ManifestFieldList = ({
  fields,
}: {
  readonly fields: readonly { readonly label: string; readonly value: string }[];
}) => (
  <dl className="lb-web-manifest">
    {fields.map((field) => (
      <div key={field.label}>
        <dt>{field.label}</dt>
        <dd>
          <code>{field.value}</code>
        </dd>
      </div>
    ))}
  </dl>
);

export const DownloadAvailabilityGate = ({
  children,
  description = 'No publicly trusted installer has been approved. There is no continue option.',
  reason,
  statusLabel = 'Blocked',
  title = 'Public download is not available yet',
}: {
  readonly children?: ReactNode;
  readonly description?: string;
  readonly reason: string;
  readonly statusLabel?: string;
  readonly title?: string;
}) => (
  <section className="lb-web-download-gate" role="alert">
    <StatusSignal detail={reason} label={statusLabel} state="error" />
    <h2>{title}</h2>
    <p>{description}</p>
    {children}
  </section>
);

export const SignatureVerificationGuide = createSemanticRegion('lb-web-signature-guide');
export const PostDownloadGuide = createSemanticRegion('lb-web-post-download');
export const PolicyDocument = createSemanticRegion('lb-web-policy');
export const StatusSummary = createSemanticRegion('lb-web-status-summary');

export interface TimelineItem {
  readonly detail: string;
  readonly id: string;
  readonly timestamp: string;
  readonly title: string;
}

export const IncidentTimeline = ({
  entries,
  label = 'Incident timeline',
}: {
  readonly entries: readonly TimelineItem[];
  readonly label?: string;
}) => (
  <ol aria-label={label} className="lb-web-timeline">
    {entries.map((entry) => (
      <li key={entry.id}>
        <time dateTime={entry.timestamp}>{entry.timestamp}</time>
        <strong>{entry.title}</strong>
        <p>{entry.detail}</p>
      </li>
    ))}
  </ol>
);

export const SignInPreview = createSemanticRegion('lb-web-sign-in');
export const SecurityMethodList = createSemanticRegion('lb-web-security-methods');
export const SessionList = createSemanticRegion('lb-web-session-list');
export const RecoveryMethodReview = createSemanticRegion('lb-web-recovery-review');
export const SubscriptionSummary = createSemanticRegion('lb-web-subscription');
export const InvoiceTable = ResponsiveDataTable;
export const DeviceBindingReview = createSemanticRegion('lb-web-device-review');
export const PrivacyCenter = createSemanticRegion('lb-web-privacy-center');
export const ConsentReview = createSemanticRegion('lb-web-consent-review');
export const DataRequestReview = createSemanticRegion('lb-web-data-request');
export const SupportRequestComposer = createSemanticRegion('lb-web-support-composer');
export const SensitiveFieldReview = createSemanticRegion('lb-web-sensitive-fields');
export const SubmissionReceipt = VerificationReceipt;
export const SupportCaseWorkspace = createSemanticRegion('lb-web-support-case');
export const ConsentScopePanel = createSemanticRegion('lb-web-consent-scope');
export const DiagnosticFieldDisclosure = EvidenceDisclosure;
export const OperationsReview = createSemanticRegion('lb-web-operations-review');
export const SecurityReview = createSemanticRegion('lb-web-security-review');
export const PurposeAndImpactReview = createSemanticRegion('lb-web-purpose-impact');
export const ImmutableAuditTimeline = IncidentTimeline;
export const CorrelatedEventDetail = createSemanticRegion('lb-web-correlated-event');
export const AdminNoChangeReceipt = NoChangeReceipt;
