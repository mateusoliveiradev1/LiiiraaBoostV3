import type { ReactNode } from 'react';
// @ts-expect-error The approved runtime includes react-dom, but @types/react-dom is not an approved identity.
import { renderToStaticMarkup as reactRenderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  DesktopApp,
  SHELL_OPERATIONAL_STATES,
  getOperationalPresentation,
  getResponsiveShellLayout,
} from './app.js';
import { DESKTOP_F6_REGIONS, createDesktopNavigator, desktopRouteTree } from './routes.js';

const renderToStaticMarkup = reactRenderToStaticMarkup as (node: ReactNode) => string;

const concretePathFor = (pattern: string): string =>
  pattern
    .replace(':gameId', 'northstar-arena')
    .replace(':sessionId', 'session-s01')
    .replace(':componentId', 'cpu-power')
    .replace(':operationId', 'balanced-power')
    .replace(':planId', 'plan-s01')
    .replace(':documentId', 'local-overview');

const semanticFindings = (markup: string): readonly string[] => {
  const findings: string[] = [];
  const ids = [...markup.matchAll(/\sid="([^"]+)"/gu)].map((match) => match[1]);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicateIds.length > 0) {
    findings.push(`duplicate ids: ${duplicateIds.join(', ')}`);
  }
  if (markup.match(/<main(?:\s|>)/gu)?.length !== 1) {
    findings.push('main landmark count');
  }
  if (markup.match(/<h1(?:\s|>)/gu)?.length !== 1) {
    findings.push('H1 count');
  }
  if (markup.includes('tabindex="1"')) {
    findings.push('positive tabindex');
  }
  if (markup.includes('undefined')) {
    findings.push('unresolved value');
  }
  return findings;
};

describe('app shell smoke', () => {
  it('mounts every typed route at every locked responsive width with one main and one H1', () => {
    const lockedWidths = [1440, 1280, 960, 760] as const;

    for (const definition of desktopRouteTree) {
      for (const viewportWidth of lockedWidths) {
        const markup = renderToStaticMarkup(
          <DesktopApp
            initialPath={concretePathFor(definition.pattern)}
            scenarioId="S01"
            viewportWidth={viewportWidth}
          />,
        );

        const routeCase = `${definition.pattern} at ${String(viewportWidth)}px`;
        expect(
          markup.match(/<main(?:\s|>)/gu),
          `${routeCase} must expose exactly one main landmark`,
        ).toHaveLength(1);
        expect(
          markup.match(/<h1(?:\s|>)/gu),
          `${routeCase} must expose exactly one H1`,
        ).toHaveLength(1);
        expect(markup).toContain(`data-viewport-width="${String(viewportWidth)}"`);
        expect(markup).toContain('DEMO');
        expect(markup).toContain('S01');
        expect(markup).not.toContain('undefined');
      }
    }
  });
});

describe('shell semantics', () => {
  it('renders every closed operational state with a localized reason and safe next action', () => {
    expect(SHELL_OPERATIONAL_STATES).toEqual([
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
    ]);

    for (const state of SHELL_OPERATIONAL_STATES) {
      for (const locale of ['pt-BR', 'en-US'] as const) {
        const presentation = getOperationalPresentation(state, locale === 'pt-BR' ? 'pt-BR' : 'en');
        const markup = renderToStaticMarkup(
          <DesktopApp
            appScale={150}
            forcedColors
            initialPath="/home"
            operationalState={state}
            reducedMotion
            scenarioId="S24"
            textScale={200}
            viewportWidth={760}
            windowsLocale={locale}
          />,
        );

        expect(markup).toContain(`data-operational-state="${state}"`);
        expect(markup).toContain('data-app-scale="150"');
        expect(markup).toContain('data-text-scale="200"');
        expect(markup).toContain('data-forced-colors="active"');
        expect(markup).toContain('data-motion="reduced"');
        expect(markup).toContain('data-page-horizontal-scroll="forbidden"');
        expect(markup).toContain(presentation.action);
        expect(markup).toContain('S24');
        expect(semanticFindings(markup)).toEqual([]);
      }
    }
  });

  it('keeps all F6 regions ordered and cycles them without skipping the inspector', () => {
    const focused: string[] = [];
    const navigator = createDesktopNavigator({
      focusRegion: (region) => {
        focused.push(region);
      },
      initialPath: '/home',
    });

    for (const _region of DESKTOP_F6_REGIONS) {
      navigator.handleKeyboard({ key: 'F6' });
    }

    expect(focused).toEqual(DESKTOP_F6_REGIONS);

    const markup = renderToStaticMarkup(<DesktopApp initialPath="/home" viewportWidth={1280} />);
    expect([...markup.matchAll(/data-focus-region="([^"]+)"/gu)].map((match) => match[1])).toEqual(
      DESKTOP_F6_REGIONS,
    );
  });
});

describe('scale smoke', () => {
  it.each([
    [1440, 'wide', 216, 'persistent'],
    [1280, 'standard', 200, 'overlay'],
    [960, 'compact', 72, 'overlay'],
    [760, 'minimum', 64, 'overlay'],
  ] as const)(
    'projects %ipx to the locked responsive shell contract',
    (viewportWidth, width, railWidth, inspectorMode) => {
      expect(getResponsiveShellLayout(viewportWidth)).toEqual({
        inspectorMode,
        pageHorizontalScroll: 'forbidden',
        railWidth,
        width,
      });

      const markup = renderToStaticMarkup(
        <DesktopApp
          appScale={150}
          initialPath="/recover/emergency"
          operationalState="recovery"
          textScale={200}
          viewportWidth={viewportWidth}
        />,
      );
      expect(markup).toContain(`data-shell-width="${width}"`);
      expect(markup).toContain(`data-goal-rail-width="${String(railWidth)}"`);
      expect(markup).toContain(`data-inspector-mode="${inspectorMode}"`);
      expect(markup).toContain('data-page-horizontal-scroll="forbidden"');
      expect(semanticFindings(markup)).toEqual([]);
    },
  );
});
