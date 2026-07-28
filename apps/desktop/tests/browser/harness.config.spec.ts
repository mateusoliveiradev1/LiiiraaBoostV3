import { test, expect } from '@playwright/test';

import {
  DESKTOP_SCENARIO_MARKER,
  FROZEN_CHART_DATA,
  FROZEN_DESKTOP_CLOCK,
  FROZEN_DESKTOP_ID,
  FROZEN_DESKTOP_LATENCY_MS,
  FROZEN_DESKTOP_SEED,
} from './fixtures.ts';

test('@browser-smoke lists the deterministic harness without launching a browser', () => {
  const metadata = test.info().project.metadata;

  expect(metadata).toMatchObject({
    contrastAxes: 2,
    localeAxes: 3,
    motionAxes: 2,
    scaleAxes: 3,
    scenarioMarker: DESKTOP_SCENARIO_MARKER,
    viewportAxes: 4,
  });
  expect(FROZEN_DESKTOP_CLOCK).toBe('2030-01-15T18:00:00.000Z');
  expect(FROZEN_DESKTOP_ID).toMatch(/^00000000-0000-4000-8000-[0-9]{12}$/u);
  expect(FROZEN_DESKTOP_LATENCY_MS).toBe(120);
  expect(FROZEN_DESKTOP_SEED).toBe(2_001);
  expect(FROZEN_CHART_DATA).toHaveLength(4);
});
