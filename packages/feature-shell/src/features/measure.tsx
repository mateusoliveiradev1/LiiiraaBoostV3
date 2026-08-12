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

const factReason = (fact: HardwareFactJson, locale: ShellLocale): string => {
  if (fact.state === 'observed') return fact.value;
  const reason = fact.reasonCode.replaceAll('-', ' ');
  return locale === 'pt-BR'
    ? `${fact.detail} Motivo: ${reason}.`
    : `${fact.detail} Reason: ${reason}.`;
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
            {locale === 'pt-BR' ? 'Hardware observado' : 'Observed hardware'}
          </h2>
          <p>
            {locale === 'pt-BR'
              ? 'Identificadores brutos permanecem protegidos no limite nativo.'
              : 'Raw identifiers remain protected inside the native boundary.'}
          </p>
        </div>
        <span className="lb-native-count">
          {
            NATIVE_FACTS.filter(([key]) => {
              const fact = inventory[key];
              return (
                typeof fact === 'object' &&
                fact !== null &&
                'state' in fact &&
                fact.state === 'observed'
              );
            }).length
          }{' '}
          / {NATIVE_FACTS.length} {locale === 'pt-BR' ? 'classes observadas' : 'classes observed'}
        </span>
      </header>
      <div className="lb-native-fact-grid">
        {NATIVE_FACTS.map(([key, en, pt]) => {
          const fact = inventory[key] as HardwareFactJson;
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
                  <strong>{fact.value}</strong>
                ) : (
                  <>
                    <strong>
                      {locale === 'pt-BR' ? `${label} indisponível` : `${label} unavailable`}
                    </strong>
                    <p>{factReason(fact, locale)}</p>
                  </>
                )}
              </div>
              <span className="lb-native-fact-state">
                {fact.state === 'observed'
                  ? locale === 'pt-BR'
                    ? 'Observado'
                    : 'Observed'
                  : locale === 'pt-BR'
                    ? 'Indisponível'
                    : 'Unavailable'}
              </span>
            </article>
          );
        })}
      </div>
    </section>
  );
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
          <dd>{snapshot.status}</dd>
        </div>
        <div>
          <dt>{locale === 'pt-BR' ? 'Coletado em' : 'Collected at'}</dt>
          <dd>
            {inventory === null ? (
              '—'
            ) : (
              <time dateTime={inventory.collectedAt}>{inventory.collectedAt}</time>
            )}
          </dd>
        </div>
        <div>
          <dt>{locale === 'pt-BR' ? 'Saúde da fonte' : 'Source health'}</dt>
          <dd>{inventory?.execution.health.state ?? 'unavailable'}</dd>
        </div>
        <div>
          <dt>{locale === 'pt-BR' ? 'Qualidade' : 'Quality'}</dt>
          <dd>{inventory?.execution.overhead.quality ?? 'unavailable'}</dd>
        </div>
        <div>
          <dt>{locale === 'pt-BR' ? 'Referência' : 'Reference'}</dt>
          <dd className="lb-data-value">{inventory?.evidenceId ?? '—'}</dd>
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
        summary={`${result.before} → ${result.after} ${result.unit}`}
        unit={result.unit}
      />
      <DeltaReadout
        delta={{
          status: 'accepted',
          absolute: `${result.delta} ${result.unit}`,
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
    authority.subscribe,
    authority.snapshot,
    authority.snapshot,
  );
  const [environmentName, setEnvironmentName] = useState('Windows local · sessão controlada');
  const [captureNote, setCaptureNote] = useState('');
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

  const refreshInventory = () => {
    const collectedAt = new Date().toISOString();
    void authority.refreshInventory({
      request: {
        schemaVersion: '1.0',
        evidenceId: `inventory-${Date.now().toString(36)}`,
        evidenceVersion: (snapshot.inventory?.evidenceVersion ?? 0) + 1,
        collectedAt,
        deadlineAt: new Date(Date.now() + 10_000).toISOString(),
        perSourceTimeoutMs: 750,
        policyDate: Number(collectedAt.slice(0, 10).replaceAll('-', '')),
      },
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
                onChange={(event) => setEnvironmentName(event.currentTarget.value)}
                value={environmentName}
              />
            </label>
            <label>
              <span>{locale === 'pt-BR' ? 'Nota da captura' : 'Capture note'}</span>
              <input
                onChange={(event) => setCaptureNote(event.currentTarget.value)}
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
          <LbButton isDisabled={snapshot.report === null} variant="primary">
            {locale === 'pt-BR' ? 'Exportar relatório técnico' : 'Export technical report'}
          </LbButton>
        </section>
      );
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
              : `${snapshot.inventory.execution.overhead.sampleWindowMs} ms`
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
            ? 'Evidência observada e medida neste computador, com limitações explícitas.'
            : 'Evidence observed and measured on this computer with explicit limitations.'
        }
        title={locale === 'pt-BR' ? 'Desempenho real' : 'Real performance'}
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
                  ? 'Leitura local pronta para orientar decisões'
                  : 'Local reading ready to support decisions'
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
                ? 'Valores observados vêm do limite nativo; ausências permanecem explicitamente indisponíveis.'
                : 'Observed values come from the native boundary; absences remain explicitly unavailable.'}
          </p>
        </div>
        <LbButton
          isLoading={snapshot.status === 'refreshing'}
          onPress={refreshInventory}
          variant="primary"
        >
          {locale === 'pt-BR' ? 'Atualizar inventário' : 'Refresh inventory'}
        </LbButton>
      </section>
      <nav
        aria-label={locale === 'pt-BR' ? 'Fluxo de medição' : 'Measurement workflow'}
        className="lb-native-measure-nav"
      >
        {MEASURE_VIEWS.map((target) => (
          <LbButton
            key={target}
            onPress={() => onNavigate?.(target)}
            variant={target === view ? 'primary' : 'quiet'}
          >
            {localized(MEASURE_VIEW_COPY[target], locale)}
          </LbButton>
        ))}
      </nav>
      <div className="lb-native-measure-grid">
        <div className="lb-native-measure-primary">{renderBody()}</div>
        <NativeEvidenceRail locale={locale} snapshot={snapshot} />
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
