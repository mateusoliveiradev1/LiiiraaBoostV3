import { useState } from 'react';
import type { ReactNode } from 'react';

import { LbIconButton } from './primitives.js';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface ChartPoint {
  readonly label: string;
  readonly value: number;
}

export interface ChartSeries {
  readonly id: string;
  readonly label: string;
  readonly points: readonly ChartPoint[];
}

export interface AccessiblePlotProps {
  readonly isVisible?: boolean;
  readonly label: string;
  readonly series: readonly ChartSeries[];
  readonly summary: string;
  readonly unit: string;
}

const MAX_SERIES = 3;
const MAX_POINTS_PER_SERIES = 1_000;

const boundSeries = (series: readonly ChartSeries[]): readonly ChartSeries[] =>
  series.slice(0, MAX_SERIES).map((entry) => ({
    ...entry,
    points: entry.points.slice(-MAX_POINTS_PER_SERIES),
  }));

const toPolyline = (points: readonly ChartPoint[]): string => {
  if (points.length === 0) {
    return '';
  }

  const values = points.map(({ value }) => value);
  const minimum = Math.min(...values);
  const range = Math.max(...values) - minimum || 1;
  const denominator = Math.max(points.length - 1, 1);

  return points
    .map(
      ({ value }, index) =>
        `${String((index / denominator) * 100)},${String(38 - ((value - minimum) / range) * 36)}`,
    )
    .join(' ');
};

const PATTERNS = ['solid', 'dashed', 'dotted'] as const;

export const AccessiblePlot = ({
  isVisible = true,
  label,
  series,
  summary,
  unit,
}: AccessiblePlotProps) => {
  const bounded = boundSeries(series);
  const cursorSeries = bounded[0];
  const [cursor, setCursor] = useState(0);
  const cursorLimit = Math.max((cursorSeries?.points.length ?? 1) - 1, 0);
  const safeCursor = Math.min(cursor, cursorLimit);
  const cursorPoint = cursorSeries?.points[safeCursor];

  const moveCursor = (direction: -1 | 1) => {
    setCursor((current) => Math.min(Math.max(current + direction, 0), cursorLimit));
  };

  return (
    <figure aria-labelledby={`${label}-title`} className="lb-plot" data-lb-region>
      <figcaption>
        <h2 id={`${label}-title`}>{label}</h2>
        <p>{summary}</p>
      </figcaption>
      {isVisible ? (
        <svg aria-hidden="true" className="lb-plot-canvas" role="img" viewBox="0 0 100 40">
          {bounded.map((entry, index) => (
            <polyline
              className="lb-plot-series"
              data-pattern={PATTERNS[index]}
              key={entry.id}
              points={toPolyline(entry.points)}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      ) : (
        <p>Chart rendering suspended while hidden or minimized.</p>
      )}
      {cursorSeries && cursorSeries.points.length > 0 ? (
        <div aria-label={`${label} keyboard cursor`} className="lb-chart-cursor" role="group">
          <LbIconButton
            icon={<ChevronLeft />}
            isDisabled={safeCursor === 0}
            label="Previous chart sample"
            onPress={() => moveCursor(-1)}
          />
          <output aria-live="polite">
            {cursorPoint?.label}: {cursorPoint?.value} {unit}
          </output>
          <LbIconButton
            icon={<ChevronRight />}
            isDisabled={safeCursor === cursorLimit}
            label="Next chart sample"
            onPress={() => moveCursor(1)}
          />
        </div>
      ) : null}
      <table>
        <caption>{label} data table</caption>
        <thead>
          <tr>
            <th scope="col">Sample</th>
            {bounded.map((entry) => (
              <th key={entry.id} scope="col">
                {entry.label} ({unit})
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(bounded[0]?.points ?? []).map((point, pointIndex) => (
            <tr key={`${pointIndex}:${point.label}`}>
              <th scope="row">{point.label}</th>
              {bounded.map((entry) => (
                <td key={entry.id}>{entry.points[pointIndex]?.value ?? 'Unavailable'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
};

export const TelemetryPlot = (props: AccessiblePlotProps) => (
  <AccessiblePlot {...props} label={props.label || 'Telemetry'} />
);

export const FrameTimePlot = (props: AccessiblePlotProps) => (
  <AccessiblePlot {...props} label={props.label || 'Frame time'} />
);

export type ComparisonPlotProps =
  | (AccessiblePlotProps & {
      readonly comparisonStatus: 'accepted';
    })
  | {
      readonly comparisonStatus: 'rejected';
      readonly label: string;
      readonly reason: string;
    };

export const ComparisonPlot = (props: ComparisonPlotProps) => {
  if (props.comparisonStatus === 'rejected') {
    return (
      <section aria-label={props.label} className="lb-plot-rejected" data-lb-region>
        <h2>{props.label}</h2>
        <strong>Comparison rejected</strong>
        <p>{props.reason}</p>
      </section>
    );
  }

  return <AccessiblePlot {...props} />;
};

export interface EvidenceColumn {
  readonly id: string;
  readonly label: string;
}

export interface EvidenceRow {
  readonly cells: Readonly<Record<string, ReactNode>>;
  readonly id: string;
}

export interface EvidenceTableProps {
  readonly caption: string;
  readonly columns: readonly EvidenceColumn[];
  readonly onSort?: (columnId: string) => void;
  readonly rows: readonly EvidenceRow[];
  readonly sort?: Readonly<{ columnId: string; direction: 'ascending' | 'descending' }>;
}

export const EvidenceTable = ({ caption, columns, onSort, rows, sort }: EvidenceTableProps) => (
  <div className="lb-table-viewport" data-lb-region role="region" aria-label={caption} tabIndex={0}>
    <table>
      <caption>{caption}</caption>
      <thead>
        <tr>
          {columns.map((column) => (
            <th
              aria-sort={sort?.columnId === column.id ? sort.direction : undefined}
              key={column.id}
              scope="col"
            >
              {onSort ? (
                <button data-lb-control onClick={() => onSort(column.id)} type="button">
                  {column.label}
                </button>
              ) : (
                column.label
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} tabIndex={0}>
            {columns.map((column) => (
              <td key={column.id}>{row.cells[column.id] ?? 'Unavailable'}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export interface ChangeLedgerEntry {
  readonly change: string;
  readonly id: string;
  readonly result: 'applied' | 'failed' | 'reverted' | 'no-change';
  readonly timestamp: string;
}

export const ChangeLedger = ({ entries }: { readonly entries: readonly ChangeLedgerEntry[] }) => (
  <EvidenceTable
    caption="Change ledger"
    columns={[
      { id: 'timestamp', label: 'Timestamp' },
      { id: 'change', label: 'Change' },
      { id: 'result', label: 'Result' },
    ]}
    rows={entries.map((entry) => ({
      cells: {
        change: entry.change,
        result: entry.result,
        timestamp: <time dateTime={entry.timestamp}>{entry.timestamp}</time>,
      },
      id: entry.id,
    }))}
  />
);

export interface TimelineEntry {
  readonly detail: string;
  readonly id: string;
  readonly timestamp: string;
  readonly title: string;
}

export const SessionTimeline = ({ entries }: { readonly entries: readonly TimelineEntry[] }) => (
  <ol aria-label="Session timeline" className="lb-timeline" data-lb-region>
    {entries.map((entry) => (
      <li key={entry.id}>
        <time dateTime={entry.timestamp}>{entry.timestamp}</time>
        <strong>{entry.title}</strong>
        <p>{entry.detail}</p>
      </li>
    ))}
  </ol>
);

export interface HardwareNode {
  readonly children?: readonly HardwareNode[];
  readonly id: string;
  readonly label: string;
  readonly status: string;
}

const HardwareNodeList = ({ nodes }: { readonly nodes: readonly HardwareNode[] }) => (
  <ul>
    {nodes.map((node) => (
      <li key={node.id}>
        <span>
          <strong>{node.label}</strong> — {node.status}
        </span>
        {node.children ? <HardwareNodeList nodes={node.children} /> : null}
      </li>
    ))}
  </ul>
);

export const HardwareTopology = ({ nodes }: { readonly nodes: readonly HardwareNode[] }) => (
  <section aria-label="Hardware topology" className="lb-topology" data-lb-region>
    <HardwareNodeList nodes={nodes} />
  </section>
);
