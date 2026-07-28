/// <reference lib="dom" />

import type { ReactNode } from 'react';
// @ts-expect-error The approved runtime includes react-dom, but @types/react-dom is not an approved identity.
import { renderToStaticMarkup as reactRenderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  GAME_LIBRARY_STATES,
  PREPARE_VIEWS,
  RESTORATION_STATES,
  SESSION_RESULT_STATES,
  PrepareSurface,
} from './prepare.js';
import {
  GOLDEN_OPERATIONS,
  IMPROVE_COMPONENTS,
  IMPROVE_GOALS,
  IMPROVE_RISK_POLICIES,
  IMPROVE_VIEWS,
  ImproveSurface,
} from './improve.js';
import { MEASURE_VIEWS, MeasureSurface } from './measure.js';
import type { ShellLocale } from './calibration.js';

const renderToStaticMarkup = reactRenderToStaticMarkup as (node: ReactNode) => string;

const axeAdmissionAudit = (markup: string): readonly string[] => {
  const findings: string[] = [];
  const ids = [...markup.matchAll(/\sid="([^"]+)"/gu)].map((match) => match[1]);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicateIds.length > 0) findings.push(`duplicate ids: ${duplicateIds.join(', ')}`);

  for (const match of markup.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/gu)) {
    const attributes = match[1] ?? '';
    const text = (match[2] ?? '').replace(/<[^>]+>/gu, '').trim();
    if (!attributes.includes('aria-label=') && text.length === 0) {
      findings.push('button has no accessible name');
    }
  }

  for (const match of markup.matchAll(/aria-(?:controls|labelledby)="([^"]+)"/gu)) {
    const references = (match[1] ?? '').split(/\s+/u);
    for (const reference of references) {
      if (reference.length > 0 && !ids.includes(reference)) {
        findings.push(`ARIA relationship points to missing id: ${reference}`);
      }
    }
  }

  if (!markup.includes('<main')) findings.push('surface has no main landmark');
  if (!markup.includes('<h1')) findings.push('surface has no route heading');
  if (markup.includes('tabindex="1"')) findings.push('positive tabindex is forbidden');
  if (markup.includes('undefined') || markup.includes('null</')) {
    findings.push('unresolved copy reached accessible output');
  }

  return findings;
};

describe('Prepare games and session technical surface', () => {
  it('makes every Prepare route and library state reachable with truthful provenance', () => {
    for (const locale of ['pt-BR', 'en'] as const satisfies readonly ShellLocale[]) {
      for (const view of PREPARE_VIEWS) {
        const markup = renderToStaticMarkup(
          <PrepareSurface locale={locale} scenarioId="S01" view={view} />,
        );
        expect(markup).toContain(`data-prepare-view="${view}"`);
        expect(markup).toContain('DEMO · S01');
        expect(markup).not.toContain('undefined');
        expect(axeAdmissionAudit(markup)).toEqual([]);
      }

      for (const libraryState of GAME_LIBRARY_STATES) {
        const markup = renderToStaticMarkup(
          <PrepareSurface
            libraryState={libraryState}
            locale={locale}
            scenarioId={libraryState === 'duplicate-identity' ? 'S08' : 'S07'}
            view="library"
          />,
        );
        expect(markup).toContain(`data-library-state="${libraryState}"`);
        expect(markup).toContain('data-testid="status-signal"');
        expect(markup).toContain('data-pattern=');
        expect(axeAdmissionAudit(markup)).toEqual([]);
      }
    }
  });

  it('keeps fictional and recognizable discovery identities explicitly distinct', () => {
    const markup = renderToStaticMarkup(
      <PrepareSurface libraryState="detected" locale="en" scenarioId="S01" view="library" />,
    );
    expect(markup).toContain('Northstar Arena');
    expect(markup).toContain('FICTIONAL · DETERMINISTIC FIXTURE');
    expect(markup).toContain('Steam');
    expect(markup).toContain('discovery evidence only; integration unvalidated');
    expect(markup).not.toContain('real integration verified');
  });

  it('completes no-effect preflight, external launch, restoration, and result states', () => {
    const preflight = renderToStaticMarkup(
      <PrepareSurface locale="en" scenarioId="S01" view="preflight" />,
    );
    expect(preflight).toContain('data-critical-path="complete"');
    expect(preflight).toContain('No operation or executable will run');

    const external = renderToStaticMarkup(
      <PrepareSurface externalLaunch locale="en" scenarioId="S09" view="active-session" />,
    );
    expect(external).toContain('data-external-launch="true"');
    expect(external).toContain('DEMO · S09');
    expect(external).toContain('performs no process monitoring');

    for (const restorationState of RESTORATION_STATES) {
      const markup = renderToStaticMarkup(
        <PrepareSurface
          locale="en"
          restorationState={restorationState}
          scenarioId="S01"
          view="restoration"
        />,
      );
      expect(markup).toContain(`data-restoration-state="${restorationState}"`);
      if (restorationState === 'verified') {
        expect(markup).toContain('no changes were made to this PC');
        expect(markup).toContain('S01-PREPARE-RESTORE-NO-CHANGE');
      }
    }

    for (const resultState of SESSION_RESULT_STATES) {
      const markup = renderToStaticMarkup(
        <PrepareSurface locale="en" resultState={resultState} scenarioId="S10" view="result" />,
      );
      expect(markup).toContain(`data-result-state="${resultState}"`);
      expect(markup).toContain('SESSION FIXTURE · NOT OBSERVED');
    }
  });

  it('states the anti-cheat and game-file boundary without offering execution', () => {
    const markup = renderToStaticMarkup(
      <PrepareSurface locale="en" scenarioId="S01" view="overview" />,
    );
    expect(markup).toContain(
      'No injection, game-file modification, launcher flags, or anti-cheat interference.',
    );
    expect(markup).not.toContain('Inject');
    expect(markup).not.toContain('Modify game files');
  });
});

describe('Improve operation and plan review technical surface', () => {
  it('makes every goal, component, and Improve view reachable', () => {
    for (const goal of IMPROVE_GOALS) {
      const markup = renderToStaticMarkup(
        <ImproveSurface locale="en" scenarioId="S01" selectedGoal={goal} view="goals" />,
      );
      expect(markup).toContain('What should improve first?');
      for (const component of IMPROVE_COMPONENTS) {
        expect(markup).toContain(`data-component-id="${component}"`);
      }
      expect(axeAdmissionAudit(markup)).toEqual([]);
    }

    for (const component of IMPROVE_COMPONENTS) {
      const markup = renderToStaticMarkup(
        <ImproveSurface
          locale="pt-BR"
          scenarioId="S01"
          selectedComponent={component}
          view="component"
        />,
      );
      expect(markup).toContain(`data-component-id="${component}"`);
      expect(markup).toContain('FIXTURE — NOT OBSERVED FROM THIS PC');
      expect(axeAdmissionAudit(markup)).toEqual([]);
    }

    for (const view of IMPROVE_VIEWS) {
      const markup = renderToStaticMarkup(
        <ImproveSurface locale="en" scenarioId="S01" view={view} />,
      );
      expect(markup).toContain(`data-improve-view="${view}"`);
      expect(markup).toContain('DEMO · S01');
      expect(axeAdmissionAudit(markup)).toEqual([]);
    }
  });

  it('projects the complete operation contract and golden eligibility contrast', () => {
    expect(GOLDEN_OPERATIONS.map(({ eligibility }) => eligibility)).toEqual([
      'ready',
      'review-required',
      'excluded',
    ]);
    expect(GOLDEN_OPERATIONS.map(({ riskClass }) => riskClass)).toEqual([
      'verified',
      'advanced',
      'experimental',
    ]);

    for (const operation of GOLDEN_OPERATIONS) {
      expect(operation.purpose).not.toBe('');
      expect(operation.expectedDirection).not.toBe('');
      expect(operation.evidence).not.toBe('');
      expect(operation.compatibility).not.toBe('');
      expect(operation.restartEffect).not.toBe('');
      expect(operation.previousValue).not.toBe('');
      expect(operation.recoveryMethod).not.toBe('');
      expect(operation.provenance).toBe('fixture');

      const markup = renderToStaticMarkup(
        <ImproveSurface
          locale="en"
          scenarioId="S01"
          selectedOperationId={operation.id}
          view="operation"
        />,
      );
      expect(markup).toContain(operation.purpose);
      expect(markup).toContain(operation.expectedDirection);
      expect(markup).toContain(operation.compatibility);
      expect(markup).toContain(operation.restartEffect);
      expect(markup).toContain(operation.previousValue);
      expect(markup).toContain(operation.recoveryMethod);
    }
  });

  it('exposes all risk policies and routes only through complete review to a no-change receipt', () => {
    const review = renderToStaticMarkup(
      <ImproveSurface locale="en" scenarioId="S01" view="plan-review" />,
    );
    for (const risk of IMPROVE_RISK_POLICIES) {
      expect(review.toLowerCase()).toContain(risk);
    }
    expect(review).toContain('data-eligibility="ready"');
    expect(review).toContain('data-eligibility="review-required"');
    expect(review).toContain('data-eligibility="excluded"');
    expect(review).toContain('No gain is guaranteed');

    const confirmation = renderToStaticMarkup(
      <ImproveSurface locale="en" scenarioId="S01" view="confirmation" />,
    );
    expect(confirmation).toContain('data-critical-path="complete"');
    expect(confirmation).toContain('Phase 6');
    expect(confirmation).toContain('no-change scenario receipt');

    const receipt = renderToStaticMarkup(
      <ImproveSurface locale="en" scenarioId="S01" view="no-change-receipt" />,
    );
    expect(receipt).toContain('S01-IMPROVE-NO-CHANGE');
    expect(receipt).toContain('no changes were made to this PC');
  });
});

describe('Measure technical surfaces', () => {
  it('makes every evidence, capture, comparison, timeline, and report state reachable', () => {
    for (const view of MEASURE_VIEWS) {
      const markup = renderToStaticMarkup(
        <MeasureSurface
          locale="en"
          scenarioId={view === 'degraded-coverage' ? 'S10' : 'S01'}
          view={view}
        />,
      );
      expect(markup).toContain(`data-measure-view="${view}"`);
      expect(markup).toContain('DEMO ·');
      expect(markup).toContain('Measurement metadata');
      expect(markup).toContain('Source and collector');
      expect(markup).toContain('Captured at');
      expect(markup).toContain('Sample');
      expect(markup).toContain('Environment');
      expect(markup).toContain('Collector overhead');
      expect(markup).toContain('Missing coverage');
      expect(markup).toContain('Comparison verdict');
      expect(axeAdmissionAudit(markup)).toEqual([]);
    }
  });

  it('provides keyboard chart cursors, accessible tables, units, and at most three patterned series', () => {
    const markup = renderToStaticMarkup(
      <MeasureSurface locale="en" scenarioId="S01" view="matched-comparison" />,
    );
    expect(markup).toContain('keyboard cursor');
    expect(markup).toContain('Previous chart sample');
    expect(markup).toContain('Next chart sample');
    expect(markup).toContain('<table>');
    expect(markup).toContain('(ms)');
    expect(markup.match(/class="lb-plot-series"/gu)).toHaveLength(2);
    expect(markup).toContain('data-pattern="solid"');
    expect(markup).toContain('data-pattern="dashed"');
  });

  it('fails rejected comparison closed with exact reasons and no relative badge', () => {
    const markup = renderToStaticMarkup(
      <MeasureSurface locale="en" scenarioId="S11" view="rejected-comparison" />,
    );
    expect(markup).toContain('data-comparison-verdict="rejected"');
    expect(markup).toContain('Game version differs');
    expect(markup).toContain('Graphics settings differ');
    expect(markup).toContain('Workload route differs');
    expect(markup).toContain('Thermal state is not comparable');
    expect(markup).toContain('Collector health is degraded');
    expect(markup).not.toMatch(/[+-]?\d+(?:\.\d+)?%/u);
    expect(markup).not.toContain('lb-delta');
  });

  it('keeps degraded 1% low unavailable with a reason instead of an estimate', () => {
    const markup = renderToStaticMarkup(
      <MeasureSurface locale="en" scenarioId="S10" view="degraded-coverage" />,
    );
    expect(markup).toContain('1% low');
    expect(markup).toContain('Unavailable — Collector health did not meet');
    expect(markup).toContain('Reliable values remain visible');
    expect(markup).not.toContain('Estimated 1% low');
  });
});

describe('technical surfaces locale scale forced-colors reduced-motion and axe admission', () => {
  it('preserves complete semantics in PT-BR and English across visual accessibility axes', () => {
    for (const locale of ['pt-BR', 'en'] as const satisfies readonly ShellLocale[]) {
      const samples = [
        renderToStaticMarkup(
          <div
            data-forced-colors="active"
            data-motion="reduced"
            data-scale="150"
            lang={locale === 'pt-BR' ? 'pt-BR' : 'en'}
          >
            <PrepareSurface locale={locale} scenarioId="S24" view="preflight" />
          </div>,
        ),
        renderToStaticMarkup(
          <div
            data-forced-colors="active"
            data-motion="reduced"
            data-scale="150"
            lang={locale === 'pt-BR' ? 'pt-BR' : 'en'}
          >
            <ImproveSurface locale={locale} scenarioId="S24" view="plan-review" />
          </div>,
        ),
        renderToStaticMarkup(
          <div
            data-forced-colors="active"
            data-motion="reduced"
            data-scale="150"
            lang={locale === 'pt-BR' ? 'pt-BR' : 'en'}
          >
            <MeasureSurface locale={locale} scenarioId="S24" view="degraded-coverage" />
          </div>,
        ),
      ];

      for (const markup of samples) {
        expect(markup).toContain('data-scale="150"');
        expect(markup).toContain('data-motion="reduced"');
        expect(markup).toContain('data-forced-colors="active"');
        expect(markup).toContain('data-pattern=');
        expect(axeAdmissionAudit(markup)).toEqual([]);
      }
    }
  });

  it('reports zero serious or critical axe-admission findings for all authored technical views', () => {
    const samples = [
      ...PREPARE_VIEWS.map((view) =>
        renderToStaticMarkup(<PrepareSurface locale="pt-BR" scenarioId="S01" view={view} />),
      ),
      ...IMPROVE_VIEWS.map((view) =>
        renderToStaticMarkup(<ImproveSurface locale="pt-BR" scenarioId="S01" view={view} />),
      ),
      ...MEASURE_VIEWS.map((view) =>
        renderToStaticMarkup(<MeasureSurface locale="pt-BR" scenarioId="S01" view={view} />),
      ),
    ];

    expect(samples.flatMap(axeAdmissionAudit)).toEqual([]);
  });
});
