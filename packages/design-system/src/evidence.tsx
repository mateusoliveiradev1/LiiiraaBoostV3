import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  CircleSlash2,
  Clock3,
  DatabaseZap,
  Eye,
  FlaskConical,
  Gauge,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  OctagonAlert,
  RefreshCw,
  RotateCcw,
  Sigma,
  WifiOff,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export const PROVENANCE_KINDS = Object.freeze([
  'fixture',
  'observed',
  'measured',
  'modeled',
  'unavailable',
] as const);
export type ProvenanceKind = (typeof PROVENANCE_KINDS)[number];

export const EVIDENCE_FRESHNESS_STATES = Object.freeze(['current', 'stale', 'unknown'] as const);
export type EvidenceFreshness = (typeof EVIDENCE_FRESHNESS_STATES)[number];
export const EVIDENCE_QUALITY_STATES = Object.freeze([
  'verified',
  'degraded',
  'insufficient',
  'contradictory',
  'unavailable',
] as const);
export type EvidenceQuality = (typeof EVIDENCE_QUALITY_STATES)[number];

export const OPERATIONAL_STATES = Object.freeze([
  'loading',
  'empty',
  'offline',
  'permission',
  'unsupported',
  'partial-failure',
  'restart-pending',
  'recovery',
  'expired-entitlement',
  'stale-evidence',
  'contradictory-evidence',
  'fixture',
] as const);
export type OperationalState = (typeof OPERATIONAL_STATES)[number];
export type EvidenceLocale = 'pt-BR' | 'en' | 'en-US';

type SignalTone = 'neutral' | 'success' | 'warning' | 'critical' | 'experimental' | 'restricted';
type SignalPattern =
  'solid' | 'dashed' | 'double' | 'dotted' | 'dot-dash' | 'long-dash' | 'diagonal-stripe';

interface VisualProjection {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly pattern: SignalPattern;
  readonly tone: SignalTone;
}

const PROVENANCE_PROJECTION: Readonly<Record<ProvenanceKind, VisualProjection>> = Object.freeze({
  fixture: {
    icon: FlaskConical,
    label: 'Fixture',
    pattern: 'diagonal-stripe',
    tone: 'experimental',
  },
  observed: { icon: Eye, label: 'Observed', pattern: 'solid', tone: 'neutral' },
  measured: { icon: Gauge, label: 'Measured', pattern: 'solid', tone: 'success' },
  modeled: { icon: Sigma, label: 'Modeled', pattern: 'dashed', tone: 'warning' },
  unavailable: {
    icon: CircleSlash2,
    label: 'Unavailable',
    pattern: 'dotted',
    tone: 'restricted',
  },
});

const FRESHNESS_PROJECTION: Readonly<Record<EvidenceFreshness, VisualProjection>> = Object.freeze({
  current: { icon: CheckCircle2, label: 'Current', pattern: 'solid', tone: 'success' },
  stale: { icon: Clock3, label: 'Stale', pattern: 'dashed', tone: 'warning' },
  unknown: { icon: CircleDashed, label: 'Unknown', pattern: 'dotted', tone: 'restricted' },
});

const QUALITY_PROJECTION: Readonly<Record<EvidenceQuality, VisualProjection>> = Object.freeze({
  verified: { icon: CheckCircle2, label: 'Approved', pattern: 'solid', tone: 'success' },
  degraded: { icon: AlertTriangle, label: 'Degraded', pattern: 'dashed', tone: 'warning' },
  insufficient: {
    icon: CircleSlash2,
    label: 'Rejected — insufficient',
    pattern: 'dotted',
    tone: 'critical',
  },
  contradictory: {
    icon: OctagonAlert,
    label: 'Rejected — contradictory',
    pattern: 'double',
    tone: 'critical',
  },
  unavailable: {
    icon: CircleDashed,
    label: 'Not evaluated',
    pattern: 'dotted',
    tone: 'restricted',
  },
});

const OPERATIONAL_PROJECTION: Readonly<Record<OperationalState, VisualProjection>> = Object.freeze({
  loading: { icon: LoaderCircle, label: 'Loading', pattern: 'dashed', tone: 'neutral' },
  empty: { icon: CircleDashed, label: 'No records', pattern: 'dotted', tone: 'neutral' },
  offline: { icon: WifiOff, label: 'Offline', pattern: 'dashed', tone: 'warning' },
  permission: {
    icon: KeyRound,
    label: 'Permission required',
    pattern: 'dot-dash',
    tone: 'restricted',
  },
  unsupported: {
    icon: CircleSlash2,
    label: 'Unsupported',
    pattern: 'dotted',
    tone: 'restricted',
  },
  'partial-failure': {
    icon: AlertTriangle,
    label: 'Partially complete',
    pattern: 'dashed',
    tone: 'warning',
  },
  'restart-pending': {
    icon: RefreshCw,
    label: 'Restart pending',
    pattern: 'long-dash',
    tone: 'warning',
  },
  recovery: {
    icon: RotateCcw,
    label: 'Recovery required',
    pattern: 'double',
    tone: 'critical',
  },
  'expired-entitlement': {
    icon: LockKeyhole,
    label: 'Entitlement expired',
    pattern: 'dot-dash',
    tone: 'restricted',
  },
  'stale-evidence': {
    icon: Clock3,
    label: 'Evidence is stale',
    pattern: 'dashed',
    tone: 'warning',
  },
  'contradictory-evidence': {
    icon: OctagonAlert,
    label: 'Evidence is contradictory',
    pattern: 'double',
    tone: 'critical',
  },
  fixture: {
    icon: FlaskConical,
    label: 'Simulated scenario',
    pattern: 'diagonal-stripe',
    tone: 'experimental',
  },
});

const PT_BR_LABELS = Object.freeze({
  provenance: {
    fixture: 'Cenário simulado',
    observed: 'Observado',
    measured: 'Medido',
    modeled: 'Estimado',
    unavailable: 'Indisponível',
  },
  freshness: {
    current: 'Atual',
    stale: 'Desatualizado',
    unknown: 'Validade desconhecida',
  },
  quality: {
    verified: 'Aprovado',
    degraded: 'Qualidade reduzida',
    insufficient: 'Rejeitado — evidência insuficiente',
    contradictory: 'Rejeitado — evidência contraditória',
    unavailable: 'Não avaliado',
  },
  operational: {
    loading: 'Carregando',
    empty: 'Nenhum registro',
    offline: 'Sem conexão',
    permission: 'Permissão necessária',
    unsupported: 'Sem suporte',
    'partial-failure': 'Concluído parcialmente',
    'restart-pending': 'Reinicialização pendente',
    recovery: 'Recuperação necessária',
    'expired-entitlement': 'Assinatura expirada',
    'stale-evidence': 'Evidência desatualizada',
    'contradictory-evidence': 'Evidência contraditória',
    fixture: 'Cenário simulado',
  },
} satisfies {
  readonly provenance: Readonly<Record<ProvenanceKind, string>>;
  readonly freshness: Readonly<Record<EvidenceFreshness, string>>;
  readonly quality: Readonly<Record<EvidenceQuality, string>>;
  readonly operational: Readonly<Record<OperationalState, string>>;
});

const isPtBr = (locale: EvidenceLocale | undefined): boolean => locale === 'pt-BR';

interface MarkProps {
  readonly detail?: string | undefined;
  readonly label?: string | undefined;
  readonly projection: VisualProjection;
  readonly state?: OperationalState;
  readonly testId?: string;
}

const Mark = ({ detail, label, projection, state, testId }: MarkProps) => {
  const Icon = projection.icon;

  return (
    <span
      className="lb-status-mark"
      data-lb-status
      data-pattern={projection.pattern}
      data-state={state}
      data-testid={testId}
      data-tone={projection.tone}
    >
      <Icon aria-hidden="true" size={18} strokeWidth={1.75} />
      <span>{label ?? projection.label}</span>
      {detail ? <span className="lb-status-detail">{detail}</span> : null}
    </span>
  );
};

export interface ProvenanceMarkProps {
  readonly detail?: string;
  readonly kind: ProvenanceKind;
  readonly locale?: EvidenceLocale;
}

export const ProvenanceMark = ({ detail, kind, locale }: ProvenanceMarkProps) => (
  <Mark
    detail={kind === 'fixture' ? (detail ?? 'SIMULATED SCENARIO') : detail}
    label={isPtBr(locale) ? PT_BR_LABELS.provenance[kind] : undefined}
    projection={PROVENANCE_PROJECTION[kind]}
    testId="provenance-mark"
  />
);

export interface FreshnessStampProps {
  readonly capturedAt?: string;
  readonly freshness: EvidenceFreshness;
  readonly locale?: EvidenceLocale;
}

export const FreshnessStamp = ({ capturedAt, freshness, locale }: FreshnessStampProps) => (
  <Mark
    detail={capturedAt}
    label={isPtBr(locale) ? PT_BR_LABELS.freshness[freshness] : undefined}
    projection={FRESHNESS_PROJECTION[freshness]}
    testId="freshness-stamp"
  />
);

export interface QualityMarkProps {
  readonly detail?: string;
  readonly locale?: EvidenceLocale;
  readonly quality: EvidenceQuality;
}

export const QualityMark = ({ detail, locale, quality }: QualityMarkProps) => (
  <Mark
    detail={detail}
    label={isPtBr(locale) ? PT_BR_LABELS.quality[quality] : undefined}
    projection={QUALITY_PROJECTION[quality]}
    testId="quality-mark"
  />
);

export interface StatusSignalProps {
  readonly detail?: string;
  readonly label?: string;
  readonly locale?: EvidenceLocale;
  readonly state: OperationalState;
}

export const StatusSignal = ({ detail, label, locale, state }: StatusSignalProps) => (
  <Mark
    detail={detail}
    label={label ?? (isPtBr(locale) ? PT_BR_LABELS.operational[state] : undefined)}
    projection={OPERATIONAL_PROJECTION[state]}
    state={state}
    testId="status-signal"
  />
);

interface EvidenceIdentity {
  readonly capturedAt: string;
  readonly provenance: ProvenanceKind;
  readonly quality: EvidenceQuality;
  readonly source: string;
}

export type MetricEvidence =
  | (EvidenceIdentity & {
      readonly status: 'available';
      readonly unit: string;
      readonly value: number | string;
    })
  | (EvidenceIdentity & {
      readonly reason: string;
      readonly status: 'incomplete' | 'unavailable';
    });

export interface MetricReadoutProps {
  readonly evidence: MetricEvidence;
  readonly label: string;
  readonly locale?: EvidenceLocale;
  readonly sampleWindow?: string;
}

export const MetricReadout = ({
  evidence,
  label,
  locale = 'en',
  sampleWindow,
}: MetricReadoutProps) => (
  <section aria-label={label} className="lb-metric" data-lb-region>
    <span className="lb-metric-label">{label}</span>
    {evidence.status === 'available' ? (
      <strong className="lb-metric-value">
        {evidence.value} <span>{evidence.unit}</span>
      </strong>
    ) : (
      <strong className="lb-metric-unavailable">
        {locale === 'pt-BR'
          ? evidence.status === 'incomplete'
            ? 'Incompleto'
            : 'Indisponível'
          : evidence.status === 'incomplete'
            ? 'Incomplete'
            : 'Unavailable'}{' '}
        — {evidence.reason}
      </strong>
    )}
    <div className="lb-evidence-line">
      <ProvenanceMark kind={evidence.provenance} locale={locale} />
      <QualityMark locale={locale} quality={evidence.quality} />
      <FreshnessStamp capturedAt={evidence.capturedAt} freshness="current" locale={locale} />
      <span>
        {locale === 'pt-BR' ? 'Fonte' : 'Source'}: {evidence.source}
      </span>
      {sampleWindow ? (
        <span>
          {locale === 'pt-BR' ? 'Amostra' : 'Sample'}: {sampleWindow}
        </span>
      ) : null}
    </div>
  </section>
);

export type DeltaEvidence =
  | {
      readonly absolute: string;
      readonly direction: string;
      readonly relative?: string;
      readonly status: 'accepted';
    }
  | {
      readonly reason: string;
      readonly status: 'rejected';
    };

export interface DeltaReadoutProps {
  readonly delta: DeltaEvidence;
  readonly label: string;
}

export const DeltaReadout = ({ delta, label }: DeltaReadoutProps) => (
  <section aria-label={label} className="lb-delta" data-lb-region>
    <span>{label}</span>
    {delta.status === 'accepted' ? (
      <strong>
        {delta.absolute}
        {delta.relative ? ` (${delta.relative})` : ''} — {delta.direction}
      </strong>
    ) : (
      <strong>Comparison rejected — {delta.reason}</strong>
    )}
  </section>
);

export type CapabilityState = 'compatible' | 'unsupported' | 'hidden' | 'restricted';

export interface CapabilityReasonProps {
  readonly capability: string;
  readonly reason: string;
  readonly state: CapabilityState;
}

export const CapabilityReason = ({ capability, reason, state }: CapabilityReasonProps) => (
  <section aria-label={capability} className="lb-capability" data-capability-state={state}>
    <strong>{capability}</strong>
    <span>{state}</span>
    <p>{reason}</p>
  </section>
);

export type RiskLevel = 'verified' | 'advanced' | 'experimental' | 'extreme';

export interface RiskClassProps {
  readonly level: RiskLevel;
}

const RISK_LABELS: Readonly<Record<RiskLevel, string>> = Object.freeze({
  verified: 'Verified',
  advanced: 'Advanced',
  experimental: 'Experimental',
  extreme: 'Extreme',
});

export const RiskClass = ({ level }: RiskClassProps) => (
  <span className="lb-risk" data-risk={level}>
    {RISK_LABELS[level]}
  </span>
);

export interface EvidenceListItem {
  readonly confidence?: string;
  readonly documentation?: ReactNode;
  readonly source: string;
  readonly timestamp: string;
  readonly version: string;
}

export interface EvidenceListProps {
  readonly items: readonly EvidenceListItem[];
}

export const EvidenceList = ({ items }: EvidenceListProps) => (
  <ul className="lb-evidence-list">
    {items.map((item) => (
      <li key={`${item.source}:${item.version}:${item.timestamp}`}>
        <strong>{item.source}</strong>
        <span>Version {item.version}</span>
        <time dateTime={item.timestamp}>{item.timestamp}</time>
        {item.confidence ? <span>Confidence {item.confidence}</span> : null}
        {item.documentation}
      </li>
    ))}
  </ul>
);

export interface ScenarioMarkerProps {
  readonly scenarioId: string;
}

export const ScenarioMarker = ({ scenarioId }: ScenarioMarkerProps) => (
  <span
    aria-label={`Simulated development scenario ${scenarioId}. Values are fixtures, not observed hardware data.`}
    className="lb-scenario-marker"
    data-pattern="diagonal-stripe"
  >
    DEMO · {scenarioId}
  </span>
);

export const EvidenceBoundary = ({ children }: { readonly children: ReactNode }) => (
  <section className="lb-evidence-boundary" data-lb-region>
    <DatabaseZap aria-hidden="true" size={18} strokeWidth={1.75} />
    {children}
  </section>
);
