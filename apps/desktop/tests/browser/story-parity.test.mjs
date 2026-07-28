import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  DESKTOP_ROUTES,
  OPERATIONAL_STATES,
} from '../../../../packages/desktop-client/src/experience.ts';

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const manifestPath = resolve(workspaceRoot, 'tooling', 'desktop-evidence', 'story-manifest.json');

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const clone = (value) => JSON.parse(JSON.stringify(value));

const expectedScenarioIds = (range) =>
  Array.from({ length: range.last - range.first + 1 }, (_value, index) => {
    const sequence = String(range.first + index).padStart(range.pad, '0');
    return `${range.prefix}${sequence}`;
  });

const deriveCoverage = (catalog, manifest) => {
  const diagnostics = [];
  const scenarios = Array.isArray(catalog.scenarios) ? catalog.scenarios : [];
  const expectedIds = expectedScenarioIds(manifest.coverage.scenarioRange);
  const expectedIdSet = new Set(expectedIds);
  const seenIds = new Set();
  const routes = new Set(DESKTOP_ROUTES);
  const states = new Set(OPERATIONAL_STATES);
  const derivedPairs = [];

  for (const scenario of scenarios) {
    const scenarioId = String(scenario.id);
    if (seenIds.has(scenarioId)) {
      diagnostics.push(`story parity: duplicate scenario ${scenarioId}`);
      continue;
    }
    seenIds.add(scenarioId);

    if (!expectedIdSet.has(scenarioId)) {
      diagnostics.push(`story parity: extra scenario ${scenarioId}`);
    }

    const requiredRoutes = Array.isArray(scenario.requiredRoutes)
      ? scenario.requiredRoutes.map(String)
      : [];
    const requiredRouteSet = new Set(requiredRoutes);
    if (requiredRouteSet.size !== requiredRoutes.length) {
      diagnostics.push(`story parity: duplicate required route in ${scenarioId}`);
    }

    const pairKeys = new Set();
    const stateRoutes = new Set();
    const requiredStates = Array.isArray(scenario.requiredStates) ? scenario.requiredStates : [];

    for (const requirement of requiredStates) {
      const route = String(requirement.route);
      const state = String(requirement.state);
      const pairKey = `${route}\u0000${state}`;

      if (!routes.has(route)) {
        diagnostics.push(`story parity: unknown route ${route} in ${scenarioId}`);
      }
      if (!states.has(state)) {
        diagnostics.push(`story parity: unknown state ${state} in ${scenarioId}`);
      }
      if (pairKeys.has(pairKey)) {
        diagnostics.push(`story parity: duplicate route/state ${route}::${state} in ${scenarioId}`);
      }

      pairKeys.add(pairKey);
      stateRoutes.add(route);
      derivedPairs.push(Object.freeze({ route, scenarioId, state }));
    }

    for (const route of requiredRouteSet) {
      if (!stateRoutes.has(route)) {
        diagnostics.push(`story parity: route ${route} has no state in ${scenarioId}`);
      }
    }
    for (const route of stateRoutes) {
      if (!requiredRouteSet.has(route)) {
        diagnostics.push(`story parity: state route ${route} is undeclared in ${scenarioId}`);
      }
    }
  }

  for (const scenarioId of expectedIds) {
    if (!seenIds.has(scenarioId)) {
      diagnostics.push(`story parity: missing scenario ${scenarioId}`);
    }
  }

  return Object.freeze({
    diagnostics: Object.freeze(diagnostics.sort()),
    pairs: Object.freeze(derivedPairs),
    scenarioIds: Object.freeze([...seenIds]),
  });
};

const loadStoryParity = () => {
  const manifest = readJson(manifestPath);
  const catalogPath = resolve(dirname(manifestPath), manifest.canonicalCatalog.path);
  const catalog = readJson(catalogPath);
  return { catalog, catalogPath, manifest };
};

describe('story parity canonical derivation', () => {
  it('story parity derives every S01-S24 route/state pair from the canonical catalog', () => {
    const { catalog, catalogPath, manifest } = loadStoryParity();
    const coverage = deriveCoverage(catalog, manifest);

    expect(catalogPath).toBe(
      resolve(workspaceRoot, 'contracts', 'scenarios', 'desktop-scenarios.json'),
    );
    expect(manifest.coverage.strategy).toBe('derive-required-states');
    expect(manifest).not.toHaveProperty('scenarios');
    expect(manifest).not.toHaveProperty('requiredRoutes');
    expect(manifest).not.toHaveProperty('requiredStates');
    expect(coverage.diagnostics).toEqual([]);
    expect(coverage.scenarioIds).toHaveLength(24);
    expect(coverage.pairs.length).toBeGreaterThan(24);
  });

  it('story parity reports stable missing, extra, and duplicate scenario diagnostics', () => {
    const { catalog, manifest } = loadStoryParity();

    const missing = clone(catalog);
    missing.scenarios.shift();
    expect(deriveCoverage(missing, manifest).diagnostics).toContain(
      'story parity: missing scenario S01',
    );

    const extra = clone(catalog);
    extra.scenarios.push({ ...clone(extra.scenarios.at(-1)), id: 'S25' });
    expect(deriveCoverage(extra, manifest).diagnostics).toContain(
      'story parity: extra scenario S25',
    );

    const duplicate = clone(catalog);
    duplicate.scenarios.push(clone(duplicate.scenarios[0]));
    expect(deriveCoverage(duplicate, manifest).diagnostics).toContain(
      'story parity: duplicate scenario S01',
    );
  });

  it('story parity reports stable renamed and duplicate route/state diagnostics', () => {
    const { catalog, manifest } = loadStoryParity();

    const renamedRoute = clone(catalog);
    renamedRoute.scenarios[0].requiredRoutes[0] = '/renamed';
    renamedRoute.scenarios[0].requiredStates[0].route = '/renamed';
    expect(deriveCoverage(renamedRoute, manifest).diagnostics).toContain(
      'story parity: unknown route /renamed in S01',
    );

    const renamedState = clone(catalog);
    renamedState.scenarios[0].requiredStates[0].state = 'renamed';
    expect(deriveCoverage(renamedState, manifest).diagnostics).toContain(
      'story parity: unknown state renamed in S01',
    );

    const duplicatePair = clone(catalog);
    duplicatePair.scenarios[0].requiredStates.push(
      clone(duplicatePair.scenarios[0].requiredStates[0]),
    );
    expect(deriveCoverage(duplicatePair, manifest).diagnostics).toContain(
      'story parity: duplicate route/state /calibration::fixture in S01',
    );
  });
});
