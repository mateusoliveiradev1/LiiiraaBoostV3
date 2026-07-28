import type { ReactNode } from 'react';
// @ts-expect-error The approved runtime includes react-dom, but @types/react-dom is not an approved identity.
import { renderToStaticMarkup as reactRenderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DesktopApp } from './app.js';
import { desktopRouteTree } from './routes.js';

const renderToStaticMarkup = reactRenderToStaticMarkup as (node: ReactNode) => string;

const concretePathFor = (pattern: string): string =>
  pattern
    .replace(':gameId', 'northstar-arena')
    .replace(':sessionId', 'session-s01')
    .replace(':componentId', 'cpu-power')
    .replace(':operationId', 'balanced-power')
    .replace(':planId', 'plan-s01')
    .replace(':documentId', 'local-overview');

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
