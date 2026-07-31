/// <reference lib="dom" />

import { Children, createElement } from 'react';
import type { ReactElement, ReactNode } from 'react';
// @ts-expect-error The approved runtime includes react-dom, but @types/react-dom is not an approved identity.
import { renderToStaticMarkup as reactRenderToStaticMarkup } from 'react-dom/server';
import { DialogTrigger } from 'react-aria-components';
import { describe, expect, it } from 'vitest';

import { createAppearanceTokens } from '@liiiraa/design-tokens';

import { AccessiblePlot, EvidenceTable } from './data.tsx';
import {
  EVIDENCE_QUALITY_STATES,
  OPERATIONAL_STATES,
  PROVENANCE_KINDS,
  MetricReadout,
  ProvenanceMark,
  QualityMark,
  ScenarioMarker,
  StatusSignal,
} from './evidence.tsx';
import {
  LB_INTERACTION_STATES,
  LbButton,
  LbDialog,
  LbDialogActions,
  LbDialogContent,
  LbIconButton,
} from './primitives.tsx';
import { ProductLockup } from './product-lockup.tsx';
import { GoalRail, RouteHeader, WindowTitleBar } from './shell.tsx';

const renderToStaticMarkup = reactRenderToStaticMarkup as (node: ReactNode) => string;

const semanticAudit = (markup: string): readonly string[] => {
  const findings: string[] = [];
  const buttonPattern = /<button([^>]*)>([\s\S]*?)<\/button>/gu;

  for (const match of markup.matchAll(buttonPattern)) {
    const attributes = match[1] ?? '';
    const text = (match[2] ?? '').replace(/<[^>]+>/gu, '').trim();
    if (!attributes.includes('aria-label=') && text.length === 0) {
      findings.push('button has no accessible name');
    }
  }

  if (markup.includes('<table') && !markup.includes('<caption')) {
    findings.push('table has no caption');
  }
  if (markup.includes('role="group"') && !markup.includes('aria-label=')) {
    findings.push('group has no accessible name');
  }
  if (markup.includes('<svg') && !markup.includes('aria-hidden="true"')) {
    findings.push('decorative svg is exposed without an accessible name');
  }

  return findings;
};

const elementProps = (element: ReactElement): Readonly<Record<string, unknown>> =>
  element.props as Readonly<Record<string, unknown>>;

describe('authored primitive interaction states', () => {
  it('keeps the complete default, hover, focus, pressed, disabled, and loading contract', () => {
    expect(LB_INTERACTION_STATES).toEqual([
      'default',
      'hover',
      'focus-visible',
      'pressed',
      'disabled',
      'loading',
    ]);

    const defaultButton = LbButton({ children: 'Prepare launch' });
    const disabledButton = LbButton({ children: 'Prepare launch', isDisabled: true });
    const loadingButton = LbButton({
      children: 'Prepare launch',
      isLoading: true,
      loadingLabel: 'Preparing',
    });

    expect(elementProps(defaultButton)).toMatchObject({
      'data-lb-control': true,
      'data-lb-variant': 'secondary',
      isDisabled: false,
      isPending: false,
    });
    expect(elementProps(disabledButton)).toMatchObject({ isDisabled: true });
    expect(elementProps(loadingButton)).toMatchObject({
      children: 'Preparing',
      isPending: true,
    });
  });

  it('requires accessible names for icon-only controls', () => {
    const iconButton = LbIconButton({
      icon: createElement('span', null, 'x'),
      label: 'Close inspector',
      onPress: () => undefined,
    });

    expect(semanticAudit(renderToStaticMarkup(iconButton))).toEqual([]);
    expect(renderToStaticMarkup(iconButton)).toContain('Close inspector');
  });
});

describe('state, provenance, and locale projections', () => {
  it('renders every operational state with text, icon, and a non-color pattern', () => {
    for (const state of OPERATIONAL_STATES) {
      const markup = renderToStaticMarkup(
        <StatusSignal detail={`Detail for ${state}`} state={state} />,
      );

      expect(markup).toContain('data-pattern=');
      expect(markup).toContain('data-tone=');
      expect(markup).toContain('aria-hidden="true"');
      expect(markup).toContain(`Detail for ${state}`);
      expect(semanticAudit(markup)).toEqual([]);
    }
  });

  it('keeps fixture markers persistent and unavailable regions explicit', () => {
    for (const kind of PROVENANCE_KINDS) {
      const markup = renderToStaticMarkup(<ProvenanceMark kind={kind} />);
      expect(markup).toContain('data-testid="provenance-mark"');
    }

    expect(renderToStaticMarkup(<ProvenanceMark kind="fixture" />)).toContain('SIMULATED SCENARIO');
    expect(renderToStaticMarkup(<ScenarioMarker scenarioId="S02" />)).toContain('DEMO · S02');

    const unavailable = renderToStaticMarkup(
      <MetricReadout
        evidence={{
          capturedAt: '2030-01-15T18:00:00.000Z',
          provenance: 'unavailable',
          quality: 'unavailable',
          reason: 'Collector did not cover this region.',
          source: 'Local diagnostic adapter',
          status: 'unavailable',
        }}
        label="Frame-time low"
      />,
    );
    expect(unavailable).toContain('Unavailable — Collector did not cover this region.');
    expect(unavailable).not.toContain('0 ms');
  });

  it('renders every quality and all three authored locale axes without missing copy', () => {
    for (const quality of EVIDENCE_QUALITY_STATES) {
      expect(renderToStaticMarkup(<QualityMark quality={quality} />)).not.toContain('undefined');
    }

    const localeSamples = [
      ['pt-BR', 'Preparar sessão', 'Revise as condições antes de iniciar.'],
      ['en', 'Prepare session', 'Review conditions before starting.'],
      ['pseudo', '[Ṕŕéṕáŕéé şéşşíóóń]', '[Ŕévíéŵ ćóńđíţíóńş ƀéƒóŕé şţáŕţíńğ.]'],
    ] as const;

    for (const [locale, title, purpose] of localeSamples) {
      const markup = renderToStaticMarkup(
        <div data-locale={locale}>
          <RouteHeader purpose={purpose} title={title} />
        </div>,
      );
      expect(markup).toContain(title);
      expect(markup).toContain(purpose);
    }
  });
});

describe('approved product identity', () => {
  it('renders the approved mark paths and wordmark with an accessible product name', () => {
    const markup = renderToStaticMarkup(<ProductLockup />);

    expect(markup).toContain('aria-label="Liiiraa Boost"');
    expect(markup).toContain('class="lb-product-mark"');
    expect(markup).toContain('class="lb-product-mark-primary"');
    expect(markup).toContain('d="M2 25.5 10.6 2h7.2l-5.7 15.2h9.2l-7.1 8.3H2Z"');
    expect(markup).toContain('class="lb-product-mark-accent"');
    expect(markup).toContain('d="m20.7 7.2 10.3 7-10.3 7 3-3.7 4.8-3.3-4.8-3.3-3-3.7Z"');
    expect(markup).toContain('class="lb-product-wordmark"');
    expect(markup).toContain('<span>Liiiraa</span><span>Boost</span>');
  });

  it('preserves approved geometry in compact and full variants without letter-box branding', () => {
    for (const variant of ['compact', 'full'] as const) {
      const markup = renderToStaticMarkup(<ProductLockup variant={variant} />);

      expect(markup).toContain(`data-variant="${variant}"`);
      expect(markup).toContain('viewBox="0 0 36 28"');
      expect(markup).not.toMatch(/class="[^"]*(?:letter|monogram|initial)[^"]*"/iu);
    }

    expect(renderToStaticMarkup(<ProductLockup variant="compact" />)).not.toContain(
      'class="lb-product-wordmark"',
    );
    expect(renderToStaticMarkup(<ProductLockup variant="full" />)).toContain(
      'class="lb-product-wordmark"',
    );
  });

  it('keeps WindowTitleBar named and wired to the shared ProductLockup', () => {
    const markup = renderToStaticMarkup(
      <WindowTitleBar globalStatus="Ready" locale="pt-BR" productName="Liiiraa Boost" />,
    );

    expect(markup).toContain('aria-label="Barra de título do aplicativo"');
    expect(markup).toContain('data-tauri-drag-region="true"');
    expect(markup).toContain('data-variant="full"');
    expect(markup).toContain('aria-label="Liiiraa Boost"');
    expect(markup).toContain('Ready');
  });
});

describe('keyboard, dialogs, charts, and accessibility axes', () => {
  it('uses the React Aria dialog trigger for focus return and a title slot for naming', () => {
    const dialog = LbDialog({
      children: createElement('p', null, 'Review evidence before continuing.'),
      description: 'Evidence review',
      isOpen: false,
      title: 'Plan review',
      trigger: createElement('button', { type: 'button' }, 'Open review'),
    });

    expect(dialog.type).toBe(DialogTrigger);
    expect(Children.count(elementProps(dialog)['children'] as ReactNode)).toBe(2);

    const content = renderToStaticMarkup(
      <LbDialogContent description="Evidence review" title="Plan review">
        <p>Review evidence before continuing.</p>
      </LbDialogContent>,
    );
    expect(content).toContain('slot="title"');
    expect(content).toContain('Plan review');
  });

  it('keeps dialog actions in a dedicated semantic footer', () => {
    const actions = renderToStaticMarkup(
      <LbDialogActions>
        <LbButton variant="secondary">Keep running</LbButton>
        <LbButton variant="destructive">Close interface</LbButton>
      </LbDialogActions>,
    );

    expect(actions).toContain('class="lb-dialog-actions"');
    expect(actions).toContain('Keep running');
    expect(actions).toContain('Close interface');
    expect(semanticAudit(actions)).toEqual([]);
  });

  it('delegates roving tab stops to a vertical React Aria toolbar', () => {
    const markup = renderToStaticMarkup(
      <GoalRail
        activeId="prepare"
        goals={[
          { id: 'home', label: 'Home', onPress: () => undefined },
          { id: 'prepare', label: 'Prepare', onPress: () => undefined },
          { id: 'recover', label: 'Recover', onPress: () => undefined },
        ]}
      />,
    );

    expect(markup).toContain('role="toolbar"');
    expect(markup).toContain('aria-orientation="vertical"');
    expect(markup).toContain('aria-current="page"');
    expect(semanticAudit(markup)).toEqual([]);
  });

  it('provides a keyboard cursor, summary, and table alternative for chart data', () => {
    const markup = renderToStaticMarkup(
      <AccessiblePlot
        label="Frame time"
        series={[
          {
            id: 'current',
            label: 'Current session',
            points: [
              { label: '00:01', value: 8.2 },
              { label: '00:02', value: 8.5 },
            ],
          },
        ]}
        summary="Lower frame time is better."
        unit="ms"
      />,
    );

    expect(markup).toContain('Frame time keyboard cursor');
    expect(markup).toContain('<caption>Frame time data table</caption>');
    expect(markup).toContain('Lower frame time is better.');
    expect(semanticAudit(markup)).toEqual([]);
  });

  it('keeps sortable tables named and avoids decorative-only information', () => {
    const markup = renderToStaticMarkup(
      <EvidenceTable
        caption="Evidence sources"
        columns={[{ id: 'source', label: 'Source' }]}
        onSort={() => undefined}
        rows={[{ cells: { source: 'Synthetic collector' }, id: 'source-1' }]}
      />,
    );

    expect(markup).toContain('<caption>Evidence sources</caption>');
    expect(markup).toContain('aria-label="Evidence sources"');
    expect(semanticAudit(markup)).toEqual([]);
  });

  it('resolves reduced motion, forced colors, compact density, and scale axes deterministically', () => {
    const output = createAppearanceTokens({
      density: 'compact',
      forcedColors: true,
      motion: 'reduced',
      scale: 150,
      textScale: 200,
    });

    expect(output['--lb-motion-translate']).toBe('0px');
    expect(output['--lb-motion-route-duration']).toBe('100ms');
    expect(output['--lb-forced-canvas']).toBe('Canvas');
    expect(output['--lb-forced-canvas-text']).toBe('CanvasText');
    expect(output['--lb-app-scale']).toBe('1.5');
    expect(output['--lb-text-scale']).toBe('2');
    expect(output['--lb-control-min-size']).toBe('44px');
  });

  it('reports no serious or critical semantic admission findings in the combined catalog sample', () => {
    const sample = renderToStaticMarkup(
      <main>
        <RouteHeader purpose="Review measured evidence." title="Measure" />
        <StatusSignal detail="Evidence is ready." state="fixture" />
        <EvidenceTable
          caption="Measured evidence"
          columns={[{ id: 'value', label: 'Value' }]}
          rows={[{ cells: { value: '8.2 ms' }, id: 'row-1' }]}
        />
      </main>,
    );

    const seriousOrCriticalFindings = semanticAudit(sample);
    expect(seriousOrCriticalFindings).toEqual([]);
  });
});
