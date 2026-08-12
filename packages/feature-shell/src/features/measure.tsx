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
import type { HardwareFactJson, InventorySnapshotJson } from '@liiiraa/contracts-ts';
import type { EvidenceAuthority, EvidenceAuthoritySnapshot } from '@liiiraa/desktop-client';
import { useEffect, useState, useSyncExternalStore } from 'react';

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
  readonly authority?: EvidenceAuthority;
  readonly locale: ShellLocale;
  readonly onNavigate?: (view: MeasureView) => void;
  readonly scenarioId?: string;
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

const MEASURE_VIEW_GROUPS = Object.freeze([
  {
    label: { en: 'Measure', 'pt-BR': 'Medir' },
    views: ['overview', 'baseline', 'capture', 'session-history'],
  },
  {
    label: { en: 'Analyze', 'pt-BR': 'Analisar' },
    views: ['matched-comparison', 'rejected-comparison', 'diff', 'timeline', 'report-preview'],
  },
  {
    label: { en: 'Trust', 'pt-BR': 'Confiabilidade' },
    views: ['collector-overhead', 'degraded-coverage'],
  },
] as const satisfies readonly {
  readonly label: LocalizedCopy;
  readonly views: readonly MeasureView[];
}[]);

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

const FixtureMeasureSurface = ({
  locale,
  onNavigate,
  scenarioId = 'S01',
  view,
}: MeasureSurfaceProps) => (
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

const NATIVE_FACTS = Object.freeze([
  ['cpu', 'CPU', 'CPU'],
  ['gpu', 'GPU', 'GPU'],
  ['memory', 'Memory', 'Memória'],
  ['storage', 'Storage', 'Armazenamento'],
  ['network', 'Network', 'Rede'],
  ['display', 'Display', 'Tela'],
  ['audio', 'Audio', 'Áudio'],
  ['usb', 'USB', 'USB'],
  ['windows', 'Windows', 'Windows'],
  ['drivers', 'Drivers', 'Drivers'],
  ['security', 'Security', 'Segurança'],
  ['games', 'Games', 'Jogos'],
] as const satisfies readonly (readonly [keyof InventorySnapshotJson, string, string])[]);

type NativeFactKey = (typeof NATIVE_FACTS)[number][0];

const FACT_SOURCE_COPY: Readonly<Partial<Record<NativeFactKey, LocalizedCopy>>> = Object.freeze({
  network: {
    en: 'Network adapters are not connected to the protected collector in this version yet.',
    'pt-BR': 'Os adaptadores de rede ainda não estão conectados ao coletor protegido desta versão.',
  },
  audio: {
    en: 'The Windows audio-device reader is still pending integration.',
    'pt-BR': 'A leitura dos dispositivos de áudio do Windows ainda aguarda integração.',
  },
  usb: {
    en: 'USB inventory through the Windows device API is still pending integration.',
    'pt-BR': 'O inventário USB pela API de dispositivos do Windows ainda aguarda integração.',
  },
  drivers: {
    en: 'The signed-driver inventory is not connected to this collector yet.',
    'pt-BR': 'O inventário de drivers assinados ainda não está conectado a este coletor.',
  },
  security: {
    en: 'Windows security posture is not connected to this collector yet.',
    'pt-BR': 'A postura de segurança do Windows ainda não está conectada a este coletor.',
  },
  games: {
    en: 'Steam, Epic, Xbox, EA and Ubisoft locations were checked, but no installed game was found.',
    'pt-BR':
      'Steam, Epic, Xbox, EA e Ubisoft foram verificados, mas nenhum jogo instalado foi encontrado.',
  },
});

const formatFactValue = (key: NativeFactKey, value: string, locale: ShellLocale): string => {
  if (key === 'storage') {
    const storage = /^System volume (\d+) GiB total, (\d+) GiB free$/u.exec(value);
    if (storage !== null) {
      const total = storage[1] ?? '0';
      const free = storage[2] ?? '0';
      return locale === 'pt-BR'
        ? `Disco do sistema · ${total} GB total · ${free} GB livres`
        : `System drive · ${total} GB total · ${free} GB free`;
    }
  }
  if (key === 'memory') {
    const physical = /^(\d+(?:\.\d+)?) GiB physical memory$/u.exec(value);
    if (physical !== null) {
      const amount = Number(physical[1]).toLocaleString(locale, { maximumFractionDigits: 1 });
      return locale === 'pt-BR' ? `${amount} GB de memória física` : `${amount} GB physical memory`;
    }
  }
  if (key === 'games') {
    const games = /^(\d+) installed games · (.+)$/u.exec(value);
    if (games !== null) {
      const count = Number(games[1] ?? '0');
      const names = (games[2] ?? '').replace(
        / · \+(\d+) more$/u,
        locale === 'pt-BR' ? ' · +$1 outros' : ' · +$1 more',
      );
      return locale === 'pt-BR'
        ? `${String(count)} ${count === 1 ? 'jogo encontrado' : 'jogos encontrados'} · ${names}`
        : `${String(count)} ${count === 1 ? 'game found' : 'games found'} · ${names}`;
    }
  }
  return value;
};

const unavailableStateLabel = (
  fact: Extract<HardwareFactJson, { readonly state: 'unavailable' }>,
  locale: ShellLocale,
): string => {
  const labels: Readonly<Record<string, LocalizedCopy>> = {
    'not-discovered': { en: 'Not found', 'pt-BR': 'Não encontrado' },
    'not-present': { en: 'Not present', 'pt-BR': 'Não presente' },
    'permission-denied': { en: 'No permission', 'pt-BR': 'Sem permissão' },
    'timed-out': { en: 'Timed out', 'pt-BR': 'Tempo esgotado' },
    unsupported: { en: 'Unsupported', 'pt-BR': 'Incompatível' },
    'collector-unavailable': { en: 'Not connected', 'pt-BR': 'Não conectado' },
  };
  return localized(
    labels[fact.reasonCode] ?? {
      en: 'Not connected',
      'pt-BR': 'Não conectado',
    },
    locale,
  );
};

const factReason = (key: NativeFactKey, fact: HardwareFactJson, locale: ShellLocale): string => {
  if (fact.state === 'observed') return formatFactValue(key, fact.value, locale);
  if (fact.reasonCode === 'collector-unavailable' || key === 'games') {
    const sourceCopy = FACT_SOURCE_COPY[key];
    if (sourceCopy !== undefined) return localized(sourceCopy, locale);
  }
  const copy: Readonly<Record<string, LocalizedCopy>> = {
    'collector-unavailable': {
      en: 'This complementary Windows source is not connected in this build yet.',
      'pt-BR': 'Esta fonte complementar do Windows ainda não está conectada nesta versão.',
    },
    'not-discovered': {
      en: 'No compatible device was found during this reading.',
      'pt-BR': 'Nenhum dispositivo compatível foi encontrado nesta leitura.',
    },
    'not-present': {
      en: 'No corresponding device is present on this computer.',
      'pt-BR': 'Nenhum dispositivo correspondente está presente neste computador.',
    },
    'permission-denied': {
      en: 'Windows did not authorize this complementary reading.',
      'pt-BR': 'O Windows não autorizou esta leitura complementar.',
    },
    'timed-out': {
      en: 'The source did not respond within the protected collection window.',
      'pt-BR': 'A fonte não respondeu dentro do tempo protegido de coleta.',
    },
    unsupported: {
      en: 'This source is not supported by the current Windows environment.',
      'pt-BR': 'Esta fonte não é compatível com o ambiente atual do Windows.',
    },
  };
  return localized(
    copy[fact.reasonCode] ?? {
      en: 'This complementary information was not admitted in the current reading.',
      'pt-BR': 'Esta informação complementar não foi admitida na leitura atual.',
    },
    locale,
  );
};

const NativeInventory = ({
  locale,
  snapshot,
}: {
  readonly locale: ShellLocale;
  readonly snapshot: EvidenceAuthoritySnapshot;
}) => {
  const inventory = snapshot.inventory;
  if (inventory === null) {
    return (
      <section className="lb-native-empty" data-evidence-state="not-collected" role="status">
        <ProductIcon name="gauge" size={24} />
        <div>
          <h2>
            {locale === 'pt-BR' ? 'Inventário ainda não coletado' : 'Inventory not collected yet'}
          </h2>
          <p>
            {locale === 'pt-BR'
              ? 'Faça uma leitura local para descobrir exatamente o que este PC suporta.'
              : 'Run a local read to discover exactly what this PC supports.'}
          </p>
        </div>
      </section>
    );
  }

  const observedFacts = NATIVE_FACTS.filter(([key]) => inventory[key].state === 'observed');
  const unavailableFacts = NATIVE_FACTS.filter(([key]) => inventory[key].state !== 'observed');

  const renderFact = ([key, en, pt]: (typeof NATIVE_FACTS)[number]) => {
    const fact = inventory[key];
    const label = locale === 'pt-BR' ? pt : en;
    return (
      <article
        className="lb-native-fact"
        data-evidence-state={fact.state}
        id={`evidence-${key}`}
        key={key}
        tabIndex={-1}
      >
        <div className="lb-native-fact-icon">
          <ProductIcon name={fact.state === 'observed' ? 'check' : 'warning'} size={18} />
        </div>
        <div>
          <span>{label}</span>
          {fact.state === 'observed' ? (
            <strong>{formatFactValue(key, fact.value, locale)}</strong>
          ) : (
            <>
              <strong>
                {locale === 'pt-BR' ? `${label} indisponível` : `${label} unavailable`}
              </strong>
              <p>{factReason(key, fact, locale)}</p>
            </>
          )}
        </div>
        <span className="lb-native-fact-state">
          {fact.state === 'observed'
            ? locale === 'pt-BR'
              ? 'Observado'
              : 'Observed'
            : unavailableStateLabel(fact, locale)}
        </span>
      </article>
    );
  };

  return (
    <section
      aria-labelledby="native-inventory-title"
      className="lb-native-inventory"
      data-lb-region
    >
      <header className="lb-native-section-heading">
        <div>
          <span className="lb-native-eyebrow">
            {locale === 'pt-BR' ? 'LEITURA LOCAL DO WINDOWS' : 'LOCAL WINDOWS READING'}
          </span>
          <h2 id="native-inventory-title">
            {locale === 'pt-BR' ? 'Inventário verificado' : 'Verified inventory'}
          </h2>
          <p>
            {locale === 'pt-BR'
              ? 'Hardware e jogos detectados localmente, sem expor caminhos ou identificadores brutos.'
              : 'Hardware and games detected locally without exposing paths or raw identifiers.'}
          </p>
        </div>
        <span className="lb-native-count">
          {observedFacts.length} / {NATIVE_FACTS.length}{' '}
          {locale === 'pt-BR' ? 'classes observadas' : 'classes observed'}
        </span>
      </header>
      <div className="lb-native-fact-grid">{observedFacts.map(renderFact)}</div>
      {unavailableFacts.length > 0 ? (
        <details className="lb-native-coverage-details">
          <summary>
            {locale === 'pt-BR'
              ? `${String(unavailableFacts.length)} leituras avançadas ainda não conectadas`
              : `${String(unavailableFacts.length)} advanced readings are not connected yet`}
          </summary>
          <p>
            {locale === 'pt-BR'
              ? 'Elas não bloqueiam CPU, GPU, memória, disco, tela, Windows ou jogos. Nenhum valor ausente é inventado.'
              : 'They do not block CPU, GPU, memory, storage, display, Windows or games. Missing values are never invented.'}
          </p>
          <div className="lb-native-fact-grid lb-native-fact-grid--secondary">
            {unavailableFacts.map(renderFact)}
          </div>
        </details>
      ) : null}
    </section>
  );
};

const evidenceStatusLabel = (status: EvidenceAuthoritySnapshot['status'], locale: ShellLocale) => {
  const labels: Record<EvidenceAuthoritySnapshot['status'], LocalizedCopy> = {
    cancelling: { en: 'Cancelling', 'pt-BR': 'Cancelando' },
    capturing: { en: 'Measuring', 'pt-BR': 'Medindo' },
    disposed: { en: 'Closed', 'pt-BR': 'Encerrada' },
    error: { en: 'Needs attention', 'pt-BR': 'Requer atenção' },
    idle: { en: 'Waiting', 'pt-BR': 'Aguardando' },
    ready: { en: 'Ready', 'pt-BR': 'Pronto' },
    refreshing: { en: 'Updating', 'pt-BR': 'Atualizando' },
  };
  return localized(labels[status], locale);
};

const evidenceHealthLabel = (value: string | undefined, locale: ShellLocale) => {
  const labels: Readonly<Record<string, LocalizedCopy>> = {
    degraded: { en: 'Partial coverage', 'pt-BR': 'Cobertura parcial' },
    healthy: { en: 'Complete', 'pt-BR': 'Completa' },
    unavailable: { en: 'Unavailable', 'pt-BR': 'Indisponível' },
    valid: { en: 'Verified', 'pt-BR': 'Verificada' },
    insufficient: { en: 'Insufficient', 'pt-BR': 'Insuficiente' },
  };
  return localized(
    labels[value ?? 'unavailable'] ?? {
      en: 'Unavailable',
      'pt-BR': 'Indisponível',
    },
    locale,
  );
};

const formatEvidenceDate = (value: string, locale: ShellLocale) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const NativeEvidenceRail = ({
  locale,
  snapshot,
}: {
  readonly locale: ShellLocale;
  readonly snapshot: EvidenceAuthoritySnapshot;
}) => {
  const inventory = snapshot.inventory;
  const deterministic = snapshot.origin === 'deterministic';
  return (
    <aside
      aria-label={locale === 'pt-BR' ? 'Autoridade da evidência' : 'Evidence authority'}
      className="lb-native-evidence-rail"
    >
      <div className="lb-native-rail-title">
        <ProductIcon name="shield" size={18} />
        <div>
          <span>
            {deterministic
              ? locale === 'pt-BR'
                ? 'CENÁRIO DETERMINÍSTICO'
                : 'DETERMINISTIC SCENARIO'
              : locale === 'pt-BR'
                ? 'AUTORIDADE NATIVA'
                : 'NATIVE AUTHORITY'}
          </span>
          <strong>
            {deterministic
              ? locale === 'pt-BR'
                ? 'Dados controlados de teste'
                : 'Controlled test data'
              : locale === 'pt-BR'
                ? 'Dados deste computador'
                : 'Data from this computer'}
          </strong>
        </div>
      </div>
      <dl>
        <div>
          <dt>{locale === 'pt-BR' ? 'Estado' : 'State'}</dt>
          <dd>{evidenceStatusLabel(snapshot.status, locale)}</dd>
        </div>
        <div>
          <dt>{locale === 'pt-BR' ? 'Coletado em' : 'Collected at'}</dt>
          <dd>
            {inventory === null ? (
              '—'
            ) : (
              <time dateTime={inventory.collectedAt}>
                {formatEvidenceDate(inventory.collectedAt, locale)}
              </time>
            )}
          </dd>
        </div>
        <div>
          <dt>{locale === 'pt-BR' ? 'Saúde da fonte' : 'Source health'}</dt>
          <dd>{evidenceHealthLabel(inventory?.execution.health.state, locale)}</dd>
        </div>
        <div>
          <dt>{locale === 'pt-BR' ? 'Qualidade' : 'Quality'}</dt>
          <dd>{evidenceHealthLabel(inventory?.execution.overhead.quality, locale)}</dd>
        </div>
        <div>
          <dt>{locale === 'pt-BR' ? 'Referência' : 'Reference'}</dt>
          <dd className="lb-data-value">
            {inventory === null ? '—' : `••••${inventory.evidenceId.slice(-8)}`}
          </dd>
        </div>
      </dl>
    </aside>
  );
};

const NativeComparison = ({
  locale,
  snapshot,
}: {
  readonly locale: ShellLocale;
  readonly snapshot: EvidenceAuthoritySnapshot;
}) => {
  const comparison = snapshot.comparison;
  if (comparison === null) {
    return (
      <section className="lb-native-empty" data-comparison-verdict="none" role="status">
        <ProductIcon name="chart" size={24} />
        <div>
          <h2>{locale === 'pt-BR' ? 'Nenhuma comparação concluída' : 'No completed comparison'}</h2>
          <p>
            {locale === 'pt-BR'
              ? 'Selecione duas capturas compatíveis no histórico.'
              : 'Select two compatible captures in history.'}
          </p>
        </div>
      </section>
    );
  }
  if (comparison.state === 'rejected') {
    return (
      <section className="lb-native-comparison" data-comparison-verdict="rejected">
        <span className="lb-native-eyebrow">{comparison.comparisonId}</span>
        <h2>
          {locale === 'pt-BR'
            ? 'Estas sessões não podem ser comparadas'
            : 'These sessions cannot be compared'}
        </h2>
        <p>
          {locale === 'pt-BR'
            ? 'Nenhum delta é exibido porque a evidência falhou na verificação de comparabilidade.'
            : 'No delta is shown because the evidence failed comparability checks.'}
        </p>
        <ul>
          {comparison.blockers.map((blocker) => (
            <li key={blocker}>{blocker.replaceAll('-', ' ')}</li>
          ))}
        </ul>
      </section>
    );
  }
  const result = comparison.acceptedResult;
  const relative = result.before === 0 ? 0 : (result.delta / result.before) * 100;
  const series: readonly ChartSeries[] = [
    {
      id: comparison.beforeSessionId,
      label: 'Before',
      points: [{ label: 'Result', value: result.before }],
    },
    {
      id: comparison.afterSessionId,
      label: 'After',
      points: [{ label: 'Result', value: result.after }],
    },
  ];
  return (
    <section
      className="lb-native-comparison"
      data-comparison-id={comparison.comparisonId}
      data-comparison-verdict="accepted"
    >
      <span className="lb-native-eyebrow">{comparison.comparisonId}</span>
      <h2>{locale === 'pt-BR' ? 'Comparação admitida' : 'Admitted comparison'}</h2>
      <ComparisonPlot
        comparisonStatus="accepted"
        label={locale === 'pt-BR' ? 'Resultado antes e depois' : 'Before and after result'}
        series={series}
        summary={`${String(result.before)} → ${String(result.after)} ${result.unit}`}
        unit={result.unit}
      />
      <DeltaReadout
        delta={{
          status: 'accepted',
          absolute: `${String(result.delta)} ${result.unit}`,
          relative: `${relative.toFixed(1)}%`,
          direction:
            locale === 'pt-BR'
              ? 'Resultado calculado pela autoridade nativa.'
              : 'Result calculated by native authority.',
        }}
        label={locale === 'pt-BR' ? 'Diferença medida' : 'Measured difference'}
      />
    </section>
  );
};

const AuthorityMeasureSurface = ({
  authority,
  locale,
  onNavigate,
  scenarioId,
  view,
}: Required<Pick<MeasureSurfaceProps, 'authority' | 'locale' | 'view'>> &
  Pick<MeasureSurfaceProps, 'onNavigate' | 'scenarioId'>) => {
  const snapshot = useSyncExternalStore(
    (notify) => authority.subscribe(notify),
    () => authority.snapshot(),
    () => authority.snapshot(),
  );
  const [environmentName, setEnvironmentName] = useState('Windows local · sessão controlada');
  const [captureNote, setCaptureNote] = useState('');
  const [refreshFeedback, setRefreshFeedback] = useState<{
    readonly tone: 'success' | 'error';
    readonly message: string;
  } | null>(null);
  const [reportFeedback, setReportFeedback] = useState<{
    readonly tone: 'success' | 'error';
    readonly message: string;
  } | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const busy = snapshot.status === 'refreshing' || snapshot.status === 'cancelling';
  const captureActive = snapshot.capture?.status === 'incomplete';

  useEffect(() => {
    const controller = new AbortController();
    void authority.readInventory(controller.signal);
    return () => {
      controller.abort();
    };
  }, [authority]);

  useEffect(() => {
    if (!captureActive) return undefined;
    const controller = new AbortController();
    const poll = () => {
      void authority.sampleCapture(controller.signal);
    };
    poll();
    const timer = globalThis.setInterval(poll, 1_100);
    return () => {
      controller.abort();
      globalThis.clearInterval(timer);
    };
  }, [authority, captureActive]);

  const refreshInventory = async () => {
    setRefreshFeedback(null);
    const collectedAt = new Date().toISOString();
    const result = await authority.refreshInventory({
      request: {
        schemaVersion: '1.0',
        evidenceId: `inventory-${Date.now().toString(36)}`,
        evidenceVersion: (snapshot.inventory?.evidenceVersion ?? 0) + 1,
        collectedAt,
        deadlineAt: new Date(Date.now() + 10_000).toISOString(),
        perSourceTimeoutMs: 2_000,
        policyDate: Number(collectedAt.slice(0, 10).replaceAll('-', '')),
      },
    });
    if (result.ok) {
      const observed = NATIVE_FACTS.filter(
        ([key]) => result.value[key].state === 'observed',
      ).length;
      const games = result.value.games;
      const gameCount =
        games.state === 'observed'
          ? Number.parseInt(/^(\d+)/u.exec(games.value)?.[1] ?? '0', 10)
          : 0;
      setRefreshFeedback({
        tone: 'success',
        message:
          locale === 'pt-BR'
            ? `Leitura concluída · ${String(observed)} de ${String(NATIVE_FACTS.length)} fontes confirmadas · ${String(gameCount)} ${gameCount === 1 ? 'jogo encontrado' : 'jogos encontrados'}.`
            : `Reading complete · ${String(observed)} of ${String(NATIVE_FACTS.length)} sources confirmed · ${String(gameCount)} ${gameCount === 1 ? 'game found' : 'games found'}.`,
      });
      return;
    }
    setRefreshFeedback({
      tone: 'error',
      message:
        locale === 'pt-BR'
          ? 'Não foi possível concluir a nova leitura. A última evidência válida foi preservada.'
          : 'The new reading could not be completed. The last valid evidence was preserved.',
    });
  };

  const startCapture = () => {
    if (snapshot.inventory === null) return;
    const startedAt = new Date().toISOString();
    void authority.startCapture({
      request: {
        schemaVersion: '1.0',
        sessionId: `session-${Date.now().toString(36)}`,
        evidenceVersion: 1,
        startedAt,
        deadlineAt: new Date(Date.now() + 5 * 60_000).toISOString(),
        baselineId: `baseline-${snapshot.inventory.evidenceId}`,
        inventoryEvidenceId: snapshot.inventory.evidenceId,
        inventoryEvidenceHash: snapshot.inventory.evidenceHash,
        collectorVersion: 'liiiraa-native-evidence@1',
      },
    });
  };

  const finishCapture = () => {
    void authority.finishCapture({
      request: {
        schemaVersion: '1.0',
        completedAt: new Date().toISOString(),
      },
    });
  };

  const cancelCapture = () => {
    void authority.cancelCapture({
      request: {
        schemaVersion: '1.0',
        monotonicNs: Math.max(0, Math.round(globalThis.performance.now() * 1_000_000)),
      },
    });
  };

  const generateReport = async () => {
    if (snapshot.comparison?.state !== 'accepted') return;
    setReportBusy(true);
    setReportFeedback(null);
    const reportId = `report-${Date.now().toString(36)}`;
    const result = await authority.renderReport({
      request: {
        schemaVersion: '1.0',
        reportId,
        comparisonId: snapshot.comparison.comparisonId,
        generatedAt: new Date().toISOString(),
        limitations: [
          locale === 'pt-BR'
            ? 'Válido apenas para as sessões locais admitidas nesta comparação.'
            : 'Valid only for the local sessions admitted in this comparison.',
        ],
      },
    });
    setReportBusy(false);
    setReportFeedback({
      tone: result.ok ? 'success' : 'error',
      message: result.ok
        ? locale === 'pt-BR'
          ? 'Relatório gerado e pronto para exportação.'
          : 'Report generated and ready to export.'
        : locale === 'pt-BR'
          ? 'Não foi possível gerar o relatório. A evidência existente foi preservada.'
          : 'The report could not be generated. Existing evidence was preserved.',
    });
  };

  const exportReport = async () => {
    if (snapshot.report === null) return;
    setReportBusy(true);
    setReportFeedback(null);
    const result = await authority.exportReport({
      request: {
        schemaVersion: '1.0',
        reportId: snapshot.report.reportId,
        format: 'html',
        fileName: `liiiraa-boost-${snapshot.report.reportId}.html`,
      },
    });
    setReportBusy(false);
    setReportFeedback({
      tone: result.ok ? 'success' : 'error',
      message: result.ok
        ? locale === 'pt-BR'
          ? `Relatório salvo como ${result.value.fileName}.`
          : `Report saved as ${result.value.fileName}.`
        : locale === 'pt-BR'
          ? 'Não foi possível exportar o relatório.'
          : 'The report could not be exported.',
    });
  };

  const renderBody = () => {
    if (view === 'overview') return <NativeInventory locale={locale} snapshot={snapshot} />;
    if (view === 'matched-comparison' || view === 'rejected-comparison' || view === 'diff') {
      return <NativeComparison locale={locale} snapshot={snapshot} />;
    }
    if (view === 'capture' || view === 'baseline') {
      return (
        <section
          aria-labelledby="native-capture-title"
          className="lb-native-capture"
          data-capture-active={String(captureActive)}
        >
          <div className="lb-native-section-heading">
            <div>
              <span className="lb-native-eyebrow">
                {locale === 'pt-BR' ? 'CAPTURA CONTROLADA' : 'CONTROLLED CAPTURE'}
              </span>
              <h2 id="native-capture-title">
                {view === 'baseline'
                  ? locale === 'pt-BR'
                    ? 'Linha de base'
                    : 'Baseline'
                  : locale === 'pt-BR'
                    ? 'Nova captura'
                    : 'New capture'}
              </h2>
            </div>
            <StatusSignal
              detail={
                captureActive
                  ? locale === 'pt-BR'
                    ? 'Coleta ativa; o encerramento permanece disponível.'
                    : 'Collection active; stop remains available.'
                  : locale === 'pt-BR'
                    ? 'Pronta para uma captura local.'
                    : 'Ready for a local capture.'
              }
              locale={locale}
              state={
                captureActive ? 'loading' : snapshot.inventoryActionable ? 'success' : 'unsupported'
              }
            />
          </div>
          <div className="lb-native-capture-form">
            <label>
              <span>{locale === 'pt-BR' ? 'Ambiente confirmado' : 'Confirmed environment'}</span>
              <input
                onChange={(event) => {
                  setEnvironmentName(event.currentTarget.value);
                }}
                value={environmentName}
              />
            </label>
            <label>
              <span>{locale === 'pt-BR' ? 'Nota da captura' : 'Capture note'}</span>
              <input
                onChange={(event) => {
                  setCaptureNote(event.currentTarget.value);
                }}
                value={captureNote}
              />
            </label>
          </div>
          <div aria-live="polite" className="lb-native-capture-actions">
            {captureActive ? (
              <>
                <LbButton isDisabled={busy} onPress={finishCapture} variant="primary">
                  {locale === 'pt-BR' ? 'Concluir e salvar captura' : 'Finish and save capture'}
                </LbButton>
                <LbButton isDisabled={busy} onPress={cancelCapture} variant="secondary">
                  {locale === 'pt-BR' ? 'Cancelar coleta' : 'Cancel collection'}
                </LbButton>
              </>
            ) : (
              <LbButton
                isDisabled={!snapshot.inventoryActionable || busy}
                onPress={startCapture}
                variant="primary"
              >
                {view === 'baseline'
                  ? locale === 'pt-BR'
                    ? 'Capturar linha de base'
                    : 'Capture baseline'
                  : locale === 'pt-BR'
                    ? 'Iniciar captura'
                    : 'Start capture'}
              </LbButton>
            )}
          </div>
        </section>
      );
    }
    if (view === 'session-history') {
      return (
        <section className="lb-native-history">
          <h2>{locale === 'pt-BR' ? 'Histórico local' : 'Local history'}</h2>
          {snapshot.capture === null ? (
            <div className="lb-native-empty" role="status">
              <ProductIcon name="history" size={24} />
              <div>
                <h3>
                  {locale === 'pt-BR' ? 'Nenhuma captura concluída' : 'No completed captures'}
                </h3>
                <p>
                  {locale === 'pt-BR'
                    ? 'Faça uma linha de base ou uma captura compatível para começar.'
                    : 'Capture a baseline or supported session to begin.'}
                </p>
              </div>
            </div>
          ) : (
            <EvidenceTable
              caption={locale === 'pt-BR' ? 'Capturas locais admitidas' : 'Admitted local captures'}
              columns={[
                { id: 'session', label: locale === 'pt-BR' ? 'Sessão' : 'Session' },
                { id: 'status', label: 'Status' },
                { id: 'started', label: locale === 'pt-BR' ? 'Iniciada' : 'Started' },
              ]}
              rows={[
                {
                  id: snapshot.capture.sessionId,
                  cells: {
                    session: snapshot.capture.sessionId,
                    status: snapshot.capture.status,
                    started: snapshot.capture.startedAt,
                  },
                },
              ]}
            />
          )}
        </section>
      );
    }
    if (view === 'timeline') {
      return (
        <section className="lb-native-history">
          <h2>{locale === 'pt-BR' ? 'Linha do tempo da evidência' : 'Evidence timeline'}</h2>
          <SessionTimeline
            entries={
              snapshot.capture === null
                ? []
                : [
                    {
                      id: snapshot.capture.sessionId,
                      timestamp: snapshot.capture.startedAt,
                      title: locale === 'pt-BR' ? 'Captura iniciada' : 'Capture started',
                      detail: snapshot.capture.status,
                    },
                  ]
            }
          />
        </section>
      );
    }
    if (view === 'report-preview') {
      const canGenerate = snapshot.comparison?.state === 'accepted';
      return (
        <section className="lb-native-report">
          <span className="lb-native-eyebrow">
            {snapshot.report?.reportId ?? (locale === 'pt-BR' ? 'SEM RELATÓRIO' : 'NO REPORT')}
          </span>
          <h2>{locale === 'pt-BR' ? 'Relatório técnico local' : 'Local technical report'}</h2>
          <p>
            {snapshot.report === null
              ? locale === 'pt-BR'
                ? 'Conclua uma comparação admitida antes de gerar o relatório.'
                : 'Complete an admitted comparison before generating the report.'
              : locale === 'pt-BR'
                ? 'O relatório permanece local e não será aberto nem enviado automaticamente.'
                : 'The report stays local and will not be opened or uploaded automatically.'}
          </p>
          <LbButton
            isDisabled={snapshot.report === null ? !canGenerate || reportBusy : reportBusy}
            isLoading={reportBusy}
            onPress={() => void (snapshot.report === null ? generateReport() : exportReport())}
            variant="primary"
          >
            {snapshot.report === null
              ? locale === 'pt-BR'
                ? 'Gerar relatório local'
                : 'Generate local report'
              : locale === 'pt-BR'
                ? 'Exportar HTML'
                : 'Export HTML'}
          </LbButton>
          <div
            aria-live="polite"
            className="lb-native-operation-feedback"
            data-tone={reportFeedback?.tone}
          >
            {reportFeedback?.message ??
              (snapshot.report === null && !canGenerate
                ? locale === 'pt-BR'
                  ? 'Conclua uma comparação válida para liberar esta ação.'
                  : 'Complete a valid comparison to enable this action.'
                : null)}
          </div>
        </section>
      );
    }
    if (view === 'degraded-coverage') {
      return <NativeInventory locale={locale} snapshot={snapshot} />;
    }
    return (
      <section className="lb-native-overhead">
        <h2>
          {locale === 'pt-BR' ? 'Saúde e cobertura do coletor' : 'Collector health and coverage'}
        </h2>
        <MetricReadout
          evidence={
            snapshot.inventory === null
              ? {
                  status: 'unavailable',
                  reason:
                    locale === 'pt-BR'
                      ? 'Inventário ainda não coletado.'
                      : 'Inventory not collected yet.',
                  source: 'native authority',
                  capturedAt: new Date(0).toISOString(),
                  provenance: 'observed',
                  quality: 'unavailable',
                }
              : {
                  status: 'available',
                  value: String(snapshot.inventory.execution.overhead.cpuTimeMs),
                  unit: 'ms',
                  source: snapshot.inventory.execution.sourceCapability,
                  capturedAt: snapshot.inventory.collectedAt,
                  provenance: 'observed',
                  quality:
                    snapshot.inventory.execution.overhead.quality === 'valid'
                      ? 'verified'
                      : 'degraded',
                }
          }
          label={locale === 'pt-BR' ? 'Tempo de CPU do coletor' : 'Collector CPU time'}
          locale={locale}
          sampleWindow={
            snapshot.inventory === null
              ? '—'
              : `${String(snapshot.inventory.execution.overhead.sampleWindowMs)} ms`
          }
        />
      </section>
    );
  };

  return (
    <main
      aria-label={locale === 'pt-BR' ? 'Área de medição real' : 'Real measurement workspace'}
      className="lb-native-measure"
      data-evidence-origin={snapshot.origin}
      data-evidence-stale={String(snapshot.staleInventory)}
      data-locale={locale}
      data-measure-view={view}
    >
      {snapshot.origin === 'deterministic' ? (
        <ScenarioMarker scenarioId={scenarioId ?? 'S01'} />
      ) : null}
      <RouteHeader
        breadcrumbs={[
          { label: locale === 'pt-BR' ? 'Medir' : 'Measure' },
          { label: localized(MEASURE_VIEW_COPY[view], locale) },
        ]}
        purpose={
          locale === 'pt-BR'
            ? 'Meça, compare e exporte evidências reais deste computador.'
            : 'Measure, compare and export real evidence from this computer.'
        }
        title={locale === 'pt-BR' ? 'Medições do seu PC' : 'Your PC measurements'}
      />
      <section
        className="lb-native-verdict"
        data-evidence-actionable={String(snapshot.inventoryActionable)}
      >
        <div>
          <span className="lb-native-eyebrow">
            {locale === 'pt-BR' ? 'ESTADO DA EVIDÊNCIA' : 'EVIDENCE STATE'}
          </span>
          <h2>
            {snapshot.staleInventory
              ? locale === 'pt-BR'
                ? 'Inventário desatualizado'
                : 'Inventory is out of date'
              : snapshot.inventoryActionable
                ? locale === 'pt-BR'
                  ? 'Inventário local pronto'
                  : 'Local inventory is ready'
                : locale === 'pt-BR'
                  ? 'Atualize antes de iniciar uma medição'
                  : 'Refresh before starting a measurement'}
          </h2>
          <p>
            {snapshot.staleInventory
              ? locale === 'pt-BR'
                ? 'A última leitura continua visível, mas nenhuma nova ação será admitida até a atualização terminar.'
                : 'The last reading remains visible, but no new action is admitted until refresh completes.'
              : locale === 'pt-BR'
                ? 'CPU, GPU, memória, disco, tela, Windows e jogos são lidos localmente. Fontes ainda não conectadas são explicadas abaixo.'
                : 'CPU, GPU, memory, storage, display, Windows and games are read locally. Sources not connected yet are explained below.'}
          </p>
        </div>
        <LbButton
          isDisabled={busy}
          isLoading={snapshot.status === 'refreshing'}
          onPress={() => void refreshInventory()}
          variant="primary"
        >
          {snapshot.status === 'refreshing'
            ? locale === 'pt-BR'
              ? 'Lendo hardware…'
              : 'Reading hardware…'
            : locale === 'pt-BR'
              ? 'Atualizar inventário'
              : 'Refresh inventory'}
        </LbButton>
        <div
          aria-atomic="true"
          aria-live="polite"
          className="lb-native-refresh-feedback"
          data-tone={refreshFeedback?.tone}
        >
          {refreshFeedback?.message ??
            (snapshot.inventory === null
              ? locale === 'pt-BR'
                ? 'A primeira leitura será feita neste computador.'
                : 'The first reading will run on this computer.'
              : locale === 'pt-BR'
                ? `Última leitura: ${formatEvidenceDate(snapshot.inventory.collectedAt, locale)}`
                : `Last reading: ${formatEvidenceDate(snapshot.inventory.collectedAt, locale)}`)}
        </div>
      </section>
      <nav
        aria-label={locale === 'pt-BR' ? 'Fluxo de medição' : 'Measurement workflow'}
        className="lb-native-measure-nav"
      >
        {MEASURE_VIEW_GROUPS.map((group) => (
          <div className="lb-native-measure-nav-group" key={group.label.en}>
            <span>{localized(group.label, locale)}</span>
            <div>
              {group.views.map((target) => (
                <LbButton
                  key={target}
                  onPress={() => onNavigate?.(target)}
                  variant={target === view ? 'primary' : 'quiet'}
                >
                  {localized(MEASURE_VIEW_COPY[target], locale)}
                </LbButton>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="lb-native-measure-grid">
        <NativeEvidenceRail locale={locale} snapshot={snapshot} />
        <div className="lb-native-measure-primary">{renderBody()}</div>
      </div>
      <div
        aria-atomic="true"
        aria-live={snapshot.status === 'error' ? 'assertive' : 'polite'}
        className="lb-native-live-status"
      >
        {snapshot.error === null
          ? null
          : locale === 'pt-BR'
            ? `A evidência não foi atualizada: ${snapshot.error.code}.`
            : `Evidence was not updated: ${snapshot.error.code}.`}
      </div>
    </main>
  );
};

export const MeasureSurface = (props: MeasureSurfaceProps) =>
  props.authority === undefined ? (
    <FixtureMeasureSurface {...props} />
  ) : (
    <AuthorityMeasureSurface
      authority={props.authority}
      locale={props.locale}
      {...(props.onNavigate === undefined ? {} : { onNavigate: props.onNavigate })}
      {...(props.scenarioId === undefined ? {} : { scenarioId: props.scenarioId })}
      view={props.view}
    />
  );
