import {
  BeforeAfterDiff,
  ComparisonPlot,
  DeltaReadout,
  EvidenceTable,
  FrameTimePlot,
  LbButton,
  MetricReadout,
  ProductIcon,
  ProvenanceMark,
  QualityMark,
  RouteHeader,
  ScenarioMarker,
  SessionTimeline,
  StatusSignal,
  TelemetryPlot,
  type ChartSeries,
  type MetricEvidence,
  type OperationalState,
} from '@liiiraa/design-system';

import type { ShellLocale } from './calibration.js';

export const MEASURE_VIEWS = Object.freeze([
  'overview',
  'baseline',
  'capture',
  'session-history',
  'matched-comparison',
  'rejected-comparison',
  'diff',
  'timeline',
  'report-preview',
  'collector-overhead',
  'degraded-coverage',
] as const);

export type MeasureView = (typeof MEASURE_VIEWS)[number];

export interface MeasureSurfaceProps {
  readonly locale: ShellLocale;
  readonly onNavigate?: (view: MeasureView) => void;
  readonly scenarioId: string;
  readonly view: MeasureView;
}

interface LocalizedCopy {
  readonly en: string;
  readonly 'pt-BR': string;
}

const localized = (copy: LocalizedCopy, locale: ShellLocale) => copy[locale];

const MEASURE_VIEW_COPY: Readonly<Record<MeasureView, LocalizedCopy>> = Object.freeze({
  overview: { en: 'Overview', 'pt-BR': 'Visão geral' },
  baseline: { en: 'Baseline', 'pt-BR': 'Linha de base' },
  capture: { en: 'Capture', 'pt-BR': 'Captura' },
  'session-history': { en: 'Session history', 'pt-BR': 'Histórico' },
  'matched-comparison': { en: 'Valid comparison', 'pt-BR': 'Comparação válida' },
  'rejected-comparison': { en: 'Rejected comparison', 'pt-BR': 'Comparação rejeitada' },
  diff: { en: 'Differences', 'pt-BR': 'Diferenças' },
  timeline: { en: 'Timeline', 'pt-BR': 'Linha do tempo' },
  'report-preview': { en: 'Report', 'pt-BR': 'Relatório' },
  'collector-overhead': { en: 'Collector impact', 'pt-BR': 'Impacto do coletor' },
  'degraded-coverage': { en: 'Coverage', 'pt-BR': 'Cobertura' },
});

const CAPTURED_AT = '2030-01-15T18:30:00.000Z';
const ENVIRONMENT = 'Northstar Arena · S01 · Windows 11 · Verified fixture profile';
const SAMPLE_WINDOW = '120 s · 500 ms interval';
const COLLECTOR = 'fixture-frame-time-collector@1';

const FRAME_TIME_SERIES = Object.freeze([
  {
    id: 'baseline',
    label: 'Fixture baseline',
    points: [
      { label: '0 s', value: 9.8 },
      { label: '30 s', value: 10.4 },
      { label: '60 s', value: 9.9 },
      { label: '90 s', value: 10.1 },
    ],
  },
  {
    id: 'preview',
    label: 'Fixture preview',
    points: [
      { label: '0 s', value: 9.6 },
      { label: '30 s', value: 10.1 },
      { label: '60 s', value: 9.7 },
      { label: '90 s', value: 9.9 },
    ],
  },
  {
    id: 'threshold',
    label: 'Scenario warning threshold',
    points: [
      { label: '0 s', value: 12 },
      { label: '30 s', value: 12 },
      { label: '60 s', value: 12 },
      { label: '90 s', value: 12 },
    ],
  },
] as const satisfies readonly ChartSeries[]);

const fixtureMetric = (
  value: string,
  unit: string,
  quality: MetricEvidence['quality'] = 'verified',
): MetricEvidence => ({
  status: 'available',
  value,
  unit,
  source: COLLECTOR,
  capturedAt: CAPTURED_AT,
  provenance: 'fixture',
  quality,
});

const unavailableMetric = (reason: string): MetricEvidence => ({
  status: 'unavailable',
  reason,
  source: COLLECTOR,
  capturedAt: CAPTURED_AT,
  provenance: 'fixture',
  quality: 'degraded',
});

const Metadata = ({
  comparison,
  locale,
  missingCoverage,
  quality = 'verified',
}: {
  readonly comparison: LocalizedCopy;
  readonly locale: ShellLocale;
  readonly missingCoverage?: string;
  readonly quality?: 'verified' | 'degraded' | 'insufficient' | 'contradictory' | 'unavailable';
}) => (
  <aside
    aria-label={localized({ en: 'Measurement metadata', 'pt-BR': 'Metadados da medição' }, locale)}
    data-lb-region
  >
    <ProvenanceMark
      detail={localized(
        {
          en: 'DETERMINISTIC FIXTURE · NOT MEASURED FROM THIS PC',
          'pt-BR': 'CENÁRIO DETERMINÍSTICO · NÃO MEDIDO NESTE PC',
        },
        locale,
      )}
      kind="fixture"
      locale={locale}
    />
    <QualityMark locale={locale} quality={quality} />
    <dl>
      <dt>{localized({ en: 'Source and collector', 'pt-BR': 'Fonte e coletor' }, locale)}</dt>
      <dd>{COLLECTOR}</dd>
      <dt>{localized({ en: 'Captured at', 'pt-BR': 'Capturado em' }, locale)}</dt>
      <dd>
        <time dateTime={CAPTURED_AT}>{CAPTURED_AT}</time>
      </dd>
      <dt>{localized({ en: 'Sample', 'pt-BR': 'Amostra' }, locale)}</dt>
      <dd>{SAMPLE_WINDOW}</dd>
      <dt>{localized({ en: 'Environment', 'pt-BR': 'Ambiente' }, locale)}</dt>
      <dd>
        {locale === 'pt-BR'
          ? 'Northstar Arena · S01 · Windows 11 · perfil simulado verificado'
          : ENVIRONMENT}
      </dd>
      <dt>{localized({ en: 'Collector overhead', 'pt-BR': 'Sobrecarga do coletor' }, locale)}</dt>
      <dd>
        {localized(
          {
            en: 'Fixture budget: below 1 ms per interval',
            'pt-BR': 'Orçamento do cenário: abaixo de 1 ms por intervalo',
          },
          locale,
        )}
      </dd>
      <dt>{localized({ en: 'Missing coverage', 'pt-BR': 'Cobertura ausente' }, locale)}</dt>
      <dd>
        {missingCoverage ??
          localized(
            { en: 'None in this fixture view', 'pt-BR': 'Nenhuma nesta visualização simulada' },
            locale,
          )}
      </dd>
      <dt>{localized({ en: 'Comparison verdict', 'pt-BR': 'Veredito da comparação' }, locale)}</dt>
      <dd>{localized(comparison, locale)}</dd>
    </dl>
  </aside>
);

const ViewStatus = ({
  detail,
  locale,
  onNavigate,
  state,
  target,
}: {
  readonly detail: LocalizedCopy;
  readonly locale: ShellLocale;
  readonly onNavigate?: MeasureSurfaceProps['onNavigate'];
  readonly state: OperationalState;
  readonly target: MeasureView;
}) => (
  <div>
    <StatusSignal detail={localized(detail, locale)} locale={locale} state={state} />
    <LbButton onPress={() => onNavigate?.(target)} variant="secondary">
      {localized({ en: 'Review safe next step', 'pt-BR': 'Revisar próxima etapa segura' }, locale)}
    </LbButton>
  </div>
);

const OverviewView = ({
  locale,
  onNavigate,
}: {
  readonly locale: ShellLocale;
  readonly onNavigate?: MeasureSurfaceProps['onNavigate'];
}) => (
  <section aria-labelledby="measure-overview-title" className="lb-measure-overview" data-lb-region>
    <h2 id="measure-overview-title">
      {localized({ en: 'Evidence overview', 'pt-BR': 'Visão geral da evidência' }, locale)}
    </h2>
    <p>
      {localized(
        {
          en: 'Choose a baseline, capture, session, comparison, or report. Every value remains fixture-marked.',
          'pt-BR':
            'Escolha linha de base, captura, sessão, comparação ou relatório. Cada valor permanece marcado como cenário.',
        },
        locale,
      )}
    </p>
    <div
      aria-label={localized(
        { en: 'Simulated performance summary', 'pt-BR': 'Resumo de desempenho simulado' },
        locale,
      )}
      className="lb-measure-snapshot"
    >
      <article>
        <ProductIcon name="timer" size={18} />
        <span>Frametime</span>
        <strong>
          16,7 <small>ms</small>
        </strong>
        <p>{localized({ en: 'simulated average', 'pt-BR': 'média simulada' }, locale)}</p>
      </article>
      <article>
        <ProductIcon name="gauge" size={18} />
        <span>1% low</span>
        <strong>
          11,2 <small>ms</small>
        </strong>
        <p>{localized({ en: 'simulated sample', 'pt-BR': 'amostra simulada' }, locale)}</p>
      </article>
      <article>
        <ProductIcon name="activity" size={18} />
        <span>FPS</span>
        <strong>121</strong>
        <p>{localized({ en: 'simulated average', 'pt-BR': 'média simulada' }, locale)}</p>
      </article>
      <article>
        <ProductIcon name="check" size={18} />
        <span>{localized({ en: 'Quality', 'pt-BR': 'Qualidade' }, locale)}</span>
        <strong>{localized({ en: 'Valid', 'pt-BR': 'Válida' }, locale)}</strong>
        <p>{localized({ en: 'fixture evidence', 'pt-BR': 'evidência de cenário' }, locale)}</p>
      </article>
    </div>
    <nav
      aria-label={localized(
        { en: 'Measurement destinations', 'pt-BR': 'Destinos de medição' },
        locale,
      )}
    >
      {MEASURE_VIEWS.filter((view) => view !== 'overview').map((view) => (
        <LbButton key={view} onPress={() => onNavigate?.(view)} variant="quiet">
          {localized(MEASURE_VIEW_COPY[view], locale)}
        </LbButton>
      ))}
    </nav>
    <Metadata
      comparison={{ en: 'Not requested', 'pt-BR': 'Não solicitada' }}
      locale={locale}
      quality="verified"
    />
  </section>
);

const BaselineView = ({ locale }: { readonly locale: ShellLocale }) => (
  <section aria-labelledby="measure-baseline-title" data-lb-region>
    <h2 id="measure-baseline-title">
      {localized({ en: 'System baseline', 'pt-BR': 'Linha de base do sistema' }, locale)}
    </h2>
    <MetricReadout
      evidence={fixtureMetric('10.1', 'ms')}
      label={localized(
        { en: 'Median fixture frame time', 'pt-BR': 'Tempo mediano de quadro do cenário' },
        locale,
      )}
      locale={locale}
      sampleWindow={SAMPLE_WINDOW}
    />
    <MetricReadout
      evidence={fixtureMetric('62', '°C')}
      label={localized(
        { en: 'Fixture GPU temperature', 'pt-BR': 'Temperatura de GPU do cenário' },
        locale,
      )}
      locale={locale}
      sampleWindow={SAMPLE_WINDOW}
    />
    <TelemetryPlot
      label={localized(
        { en: 'Baseline telemetry', 'pt-BR': 'Telemetria da linha de base' },
        locale,
      )}
      series={[FRAME_TIME_SERIES[0]]}
      summary={localized(
        {
          en: 'A deterministic fixture sequence with keyboard and table alternatives.',
          'pt-BR': 'Uma sequência determinística com alternativas por teclado e tabela.',
        },
        locale,
      )}
      unit="ms"
    />
    <Metadata comparison={{ en: 'Not requested', 'pt-BR': 'Não solicitada' }} locale={locale} />
  </section>
);

const CaptureView = ({
  locale,
  onNavigate,
}: {
  readonly locale: ShellLocale;
  readonly onNavigate?: MeasureSurfaceProps['onNavigate'];
}) => (
  <section aria-labelledby="measure-capture-title" data-lb-region>
    <h2 id="measure-capture-title">
      {localized(
        { en: 'Capture setup and active capture', 'pt-BR': 'Configuração e captura ativa' },
        locale,
      )}
    </h2>
    <ol>
      <li>
        {localized(
          { en: 'Confirm environment identity', 'pt-BR': 'Confirmar identidade do ambiente' },
          locale,
        )}
      </li>
      <li>
        {localized(
          { en: 'Review collector budget', 'pt-BR': 'Revisar orçamento do coletor' },
          locale,
        )}
      </li>
      <li>
        {localized(
          { en: 'Capture deterministic samples', 'pt-BR': 'Capturar amostras determinísticas' },
          locale,
        )}
      </li>
      <li>
        {localized(
          { en: 'Evaluate quality before display', 'pt-BR': 'Avaliar qualidade antes de exibir' },
          locale,
        )}
      </li>
    </ol>
    <ViewStatus
      detail={{
        en: 'Fixture capture is active. Hidden charts suspend expensive rendering.',
        'pt-BR': 'A captura de cenário está ativa. Gráficos ocultos suspendem renderização cara.',
      }}
      locale={locale}
      onNavigate={onNavigate}
      state="loading"
      target="session-history"
    />
    <FrameTimePlot
      label={localized({ en: 'Active frame time', 'pt-BR': 'Tempo de quadro ativo' }, locale)}
      series={[FRAME_TIME_SERIES[0]]}
      summary={localized(
        {
          en: 'Fixture frame time; lower values are directionally better.',
          'pt-BR': 'Tempo de quadro do cenário; valores menores são melhores na direção esperada.',
        },
        locale,
      )}
      unit="ms"
    />
    <Metadata
      comparison={{ en: 'Pending quality gate', 'pt-BR': 'Aguardando gate de qualidade' }}
      locale={locale}
    />
  </section>
);

const SessionHistoryView = ({ locale }: { readonly locale: ShellLocale }) => (
  <section aria-labelledby="measure-history-title" data-lb-region>
    <h2 id="measure-history-title">
      {localized({ en: 'Session history', 'pt-BR': 'Histórico de sessões' }, locale)}
    </h2>
    <EvidenceTable
      caption={localized(
        { en: 'Scenario session evidence', 'pt-BR': 'Evidência de sessões do cenário' },
        locale,
      )}
      columns={[
        { id: 'session', label: localized({ en: 'Session', 'pt-BR': 'Sessão' }, locale) },
        { id: 'environment', label: localized({ en: 'Environment', 'pt-BR': 'Ambiente' }, locale) },
        { id: 'quality', label: localized({ en: 'Quality', 'pt-BR': 'Qualidade' }, locale) },
        { id: 'captured', label: localized({ en: 'Captured', 'pt-BR': 'Capturada' }, locale) },
      ]}
      rows={[
        {
          id: 'S01-A',
          cells: {
            session: 'S01-A',
            environment: ENVIRONMENT,
            quality: localized({ en: 'Fixture approved', 'pt-BR': 'Cenário aprovado' }, locale),
            captured: CAPTURED_AT,
          },
        },
        {
          id: 'S10-A',
          cells: {
            session: 'S10-A',
            environment: 'Northstar Arena · S10 · degraded collector',
            quality: localized({ en: 'Degraded', 'pt-BR': 'Degradada' }, locale),
            captured: '2030-01-15T19:00:00.000Z',
          },
        },
      ]}
    />
    <Metadata
      comparison={{ en: 'Select two sessions', 'pt-BR': 'Selecione duas sessões' }}
      locale={locale}
    />
  </section>
);

const MatchedComparisonView = ({ locale }: { readonly locale: ShellLocale }) => (
  <section
    aria-labelledby="measure-matched-title"
    data-comparison-verdict="accepted"
    data-lb-region
  >
    <h2 id="measure-matched-title">
      {localized(
        { en: 'Matched fixture comparison', 'pt-BR': 'Comparação compatível de cenário' },
        locale,
      )}
    </h2>
    <ComparisonPlot
      comparisonStatus="accepted"
      label={localized(
        { en: 'Frame-time comparison', 'pt-BR': 'Comparação de tempo de quadro' },
        locale,
      )}
      series={FRAME_TIME_SERIES.slice(0, 2)}
      summary={localized(
        {
          en: 'The same fixture game version, settings, workload, environment, thermal state, and collector health passed the gate.',
          'pt-BR':
            'Versão, ajustes, carga, ambiente, estado térmico e coletor do mesmo cenário passaram pelo gate.',
        },
        locale,
      )}
      unit="ms"
    />
    <DeltaReadout
      delta={{
        status: 'accepted',
        absolute: '-0.2 ms fixture delta',
        relative: '-2.0% fixture delta',
        direction: localized(
          {
            en: 'lower frame time is directionally better; no real gain is claimed',
            'pt-BR':
              'menor tempo de quadro é melhor na direção esperada; nenhum ganho real é alegado',
          },
          locale,
        ),
      }}
      label={localized(
        { en: 'Accepted fixture delta', 'pt-BR': 'Delta de cenário aceito' },
        locale,
      )}
    />
    <Metadata
      comparison={{ en: 'Accepted — fixture only', 'pt-BR': 'Aceita — somente cenário' }}
      locale={locale}
    />
  </section>
);

const REJECTION_REASONS = Object.freeze([
  'Game version differs',
  'Graphics settings differ',
  'Workload route differs',
  'Thermal state is not comparable',
  'Collector health is degraded',
] as const);

const RejectedComparisonView = ({
  locale,
  onNavigate,
}: {
  readonly locale: ShellLocale;
  readonly onNavigate?: MeasureSurfaceProps['onNavigate'];
}) => (
  <section
    aria-labelledby="measure-rejected-title"
    data-comparison-verdict="rejected"
    data-lb-region
  >
    <h2 id="measure-rejected-title">
      {localized({ en: 'Comparison rejected', 'pt-BR': 'Comparação rejeitada' }, locale)}
    </h2>
    <ComparisonPlot
      comparisonStatus="rejected"
      label={localized(
        { en: 'Session comparability gate', 'pt-BR': 'Gate de comparabilidade das sessões' },
        locale,
      )}
      reason={localized(
        {
          en: REJECTION_REASONS.join('; '),
          'pt-BR':
            'Versão do jogo diferente; ajustes gráficos diferentes; rota de carga diferente; estado térmico incompatível; coletor degradado',
        },
        locale,
      )}
    />
    <ul>
      {REJECTION_REASONS.map((reason) => (
        <li key={reason}>{reason}</li>
      ))}
    </ul>
    <p>
      {localized(
        {
          en: 'No delta or percentage is shown because the evidence is not comparable.',
          'pt-BR': 'Nenhum delta ou valor relativo é exibido porque a evidência não é comparável.',
        },
        locale,
      )}
    </p>
    <ViewStatus
      detail={{
        en: 'Align the environment and collect again.',
        'pt-BR': 'Alinhe o ambiente e colete novamente.',
      }}
      locale={locale}
      onNavigate={onNavigate}
      state="contradictory-evidence"
      target="capture"
    />
    <Metadata
      comparison={{
        en: 'Rejected — exact reasons above',
        'pt-BR': 'Rejeitada — motivos exatos acima',
      }}
      locale={locale}
      missingCoverage="Comparable workload and healthy collector"
      quality="contradictory"
    />
  </section>
);

const DiffView = ({ locale }: { readonly locale: ShellLocale }) => (
  <section aria-labelledby="measure-diff-title" data-lb-region>
    <h2 id="measure-diff-title">
      {localized(
        { en: 'Detailed accepted diff', 'pt-BR': 'Diferenças aceitas em detalhe' },
        locale,
      )}
    </h2>
    <BeforeAfterDiff
      entries={[
        { label: 'Game version', before: 'fixture-1.0', after: 'fixture-1.0' },
        { label: 'Profile', before: 'Scenario baseline', after: 'Scenario preview' },
        { label: 'Median frame time', before: '10.1 ms', after: '9.9 ms' },
      ]}
    />
    <p>
      {localized(
        {
          en: 'Values are deterministic fixtures. The diff proves presentation and gating only.',
          'pt-BR':
            'Os valores são cenários determinísticos. A diferença prova somente apresentação e gates.',
        },
        locale,
      )}
    </p>
    <Metadata
      comparison={{ en: 'Accepted — fixture only', 'pt-BR': 'Aceita — somente cenário' }}
      locale={locale}
    />
  </section>
);

const TimelineView = ({ locale }: { readonly locale: ShellLocale }) => (
  <section aria-labelledby="measure-timeline-title" data-lb-region>
    <h2 id="measure-timeline-title">
      {localized({ en: 'Session timeline', 'pt-BR': 'Linha do tempo da sessão' }, locale)}
    </h2>
    <SessionTimeline
      entries={[
        {
          id: 'capture-start',
          timestamp: '2030-01-15T18:30:00.000Z',
          title: localized(
            { en: 'Fixture capture started', 'pt-BR': 'Captura de cenário iniciada' },
            locale,
          ),
          detail: localized(
            { en: 'Environment identity frozen.', 'pt-BR': 'Identidade do ambiente congelada.' },
            locale,
          ),
        },
        {
          id: 'quality-gate',
          timestamp: '2030-01-15T18:32:00.000Z',
          title: localized(
            { en: 'Quality gate completed', 'pt-BR': 'Gate de qualidade concluído' },
            locale,
          ),
          detail: localized(
            {
              en: 'All required fixture samples were present.',
              'pt-BR': 'Todas as amostras necessárias estavam presentes.',
            },
            locale,
          ),
        },
      ]}
    />
    <Metadata comparison={{ en: 'Not requested', 'pt-BR': 'Não solicitada' }} locale={locale} />
  </section>
);

const ReportPreviewView = ({
  locale,
  onNavigate,
}: {
  readonly locale: ShellLocale;
  readonly onNavigate?: MeasureSurfaceProps['onNavigate'];
}) => (
  <section aria-labelledby="measure-report-title" data-lb-region>
    <h2 id="measure-report-title">
      {localized(
        { en: 'Technical report preview', 'pt-BR': 'Prévia do relatório técnico' },
        locale,
      )}
    </h2>
    <EvidenceTable
      caption={localized({ en: 'Report contents', 'pt-BR': 'Conteúdo do relatório' }, locale)}
      columns={[
        { id: 'section', label: localized({ en: 'Section', 'pt-BR': 'Seção' }, locale) },
        { id: 'status', label: localized({ en: 'Status', 'pt-BR': 'Estado' }, locale) },
      ]}
      rows={[
        { id: 'method', cells: { section: 'Methodology and environment', status: 'Included' } },
        { id: 'samples', cells: { section: 'Fixture samples and quality', status: 'Included' } },
        {
          id: 'limits',
          cells: { section: 'Limitations and missing coverage', status: 'Included' },
        },
      ]}
    />
    <p>
      {localized(
        {
          en: 'Local export is owned by Phase 5. This complete preview does not create or upload a report.',
          'pt-BR':
            'A exportação local pertence à Fase 5. Esta prévia completa não cria nem envia um relatório.',
        },
        locale,
      )}
    </p>
    <LbButton onPress={() => onNavigate?.('overview')} variant="secondary">
      {localized(
        { en: 'Return to evidence overview', 'pt-BR': 'Voltar à visão de evidências' },
        locale,
      )}
    </LbButton>
    <Metadata
      comparison={{ en: 'Documented in report', 'pt-BR': 'Documentada no relatório' }}
      locale={locale}
    />
  </section>
);

const CollectorOverheadView = ({ locale }: { readonly locale: ShellLocale }) => (
  <section aria-labelledby="measure-overhead-title" data-lb-region>
    <h2 id="measure-overhead-title">
      {localized({ en: 'Collector overhead', 'pt-BR': 'Sobrecarga do coletor' }, locale)}
    </h2>
    <MetricReadout
      evidence={fixtureMetric('<1', 'ms/interval')}
      label={localized(
        { en: 'Fixture collector budget', 'pt-BR': 'Orçamento do coletor de cenário' },
        locale,
      )}
      locale={locale}
      sampleWindow={SAMPLE_WINDOW}
    />
    <p>
      {localized(
        {
          en: 'This is a deterministic budget assertion, not observed process performance.',
          'pt-BR':
            'Esta é uma asserção determinística de orçamento, não desempenho observado do processo.',
        },
        locale,
      )}
    </p>
    <Metadata comparison={{ en: 'Not requested', 'pt-BR': 'Não solicitada' }} locale={locale} />
  </section>
);

const DegradedCoverageView = ({
  locale,
  onNavigate,
}: {
  readonly locale: ShellLocale;
  readonly onNavigate?: MeasureSurfaceProps['onNavigate'];
}) => (
  <section aria-labelledby="measure-degraded-title" data-lb-region>
    <h2 id="measure-degraded-title">
      {localized(
        { en: 'Degraded capture coverage', 'pt-BR': 'Cobertura de captura degradada' },
        locale,
      )}
    </h2>
    <MetricReadout
      evidence={unavailableMetric(
        localized(
          {
            en: 'Collector health did not meet the approved sample-quality threshold.',
            'pt-BR': 'A saúde do coletor não atingiu o limite aprovado de qualidade da amostra.',
          },
          locale,
        ),
      )}
      label="1% low"
      locale={locale}
      sampleWindow={SAMPLE_WINDOW}
    />
    <MetricReadout
      evidence={fixtureMetric('10.4', 'ms', 'degraded')}
      label={localized(
        { en: 'Available frame-time median', 'pt-BR': 'Mediana disponível de tempo de quadro' },
        locale,
      )}
      locale={locale}
      sampleWindow={SAMPLE_WINDOW}
    />
    <ViewStatus
      detail={{
        en: 'Reliable values remain visible; unavailable values are not estimated.',
        'pt-BR': 'Valores confiáveis continuam visíveis; valores indisponíveis não são estimados.',
      }}
      locale={locale}
      onNavigate={onNavigate}
      state="partial-failure"
      target="capture"
    />
    <Metadata
      comparison={{ en: 'Rejected — degraded collector', 'pt-BR': 'Rejeitada — coletor degradado' }}
      locale={locale}
      missingCoverage={localized(
        { en: 'Approved 1% low samples', 'pt-BR': 'Amostras de 1% low aprovadas' },
        locale,
      )}
      quality="degraded"
    />
  </section>
);

export const MeasureSurface = ({ locale, onNavigate, scenarioId, view }: MeasureSurfaceProps) => (
  <main
    aria-label={localized({ en: 'Measure workspace', 'pt-BR': 'Área de medição' }, locale)}
    data-locale={locale}
    data-measure-view={view}
    data-scenario-id={scenarioId}
  >
    <ScenarioMarker scenarioId={scenarioId} />
    <RouteHeader
      breadcrumbs={[
        { label: localized({ en: 'Measure', 'pt-BR': 'Medir' }, locale) },
        { label: view },
      ]}
      purpose={localized(
        {
          en: 'Follow performance, capture sessions, and compare reliable results.',
          'pt-BR': 'Acompanhe o desempenho, capture sessões e compare resultados confiáveis.',
        },
        locale,
      )}
      title={localized({ en: 'Performance', 'pt-BR': 'Desempenho' }, locale)}
    />

    {view === 'overview' ? <OverviewView locale={locale} onNavigate={onNavigate} /> : null}
    {view === 'baseline' ? <BaselineView locale={locale} /> : null}
    {view === 'capture' ? <CaptureView locale={locale} onNavigate={onNavigate} /> : null}
    {view === 'session-history' ? <SessionHistoryView locale={locale} /> : null}
    {view === 'matched-comparison' ? <MatchedComparisonView locale={locale} /> : null}
    {view === 'rejected-comparison' ? (
      <RejectedComparisonView locale={locale} onNavigate={onNavigate} />
    ) : null}
    {view === 'diff' ? <DiffView locale={locale} /> : null}
    {view === 'timeline' ? <TimelineView locale={locale} /> : null}
    {view === 'report-preview' ? (
      <ReportPreviewView locale={locale} onNavigate={onNavigate} />
    ) : null}
    {view === 'collector-overhead' ? <CollectorOverheadView locale={locale} /> : null}
    {view === 'degraded-coverage' ? (
      <DegradedCoverageView locale={locale} onNavigate={onNavigate} />
    ) : null}
  </main>
);
