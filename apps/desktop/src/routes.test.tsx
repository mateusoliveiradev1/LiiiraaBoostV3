import { describe, expect, it, vi } from 'vitest';

import {
  DESKTOP_F6_REGIONS,
  createDesktopNavigator,
  desktopRouteTree,
  resolveDesktopRoute,
  routeFromValidatedShellNavigationIntent,
  type DesktopF6Region,
  type ShellNavigationIntent,
} from './routes.js';
import {
  DESKTOP_TEST_SCENARIO_STORAGE_KEY,
  createDesktopComposition,
  type DesktopCompositionRefusedError,
} from './composition.js';

const EXPECTED_ROUTE_PATTERNS = Object.freeze([
  '/',
  '/calibration/welcome',
  '/calibration/trust',
  '/calibration/inventory',
  '/calibration/diagnosis',
  '/calibration/recovery',
  '/calibration/goals',
  '/calibration/games',
  '/calibration/summary',
  '/home',
  '/prepare',
  '/games',
  '/games/add',
  '/games/:gameId/overview',
  '/games/:gameId/profile',
  '/games/:gameId/evidence',
  '/games/:gameId/history',
  '/games/:gameId/preflight',
  '/session/:sessionId/active',
  '/session/:sessionId/restoring',
  '/session/:sessionId/result',
  '/improve',
  '/goals/performance',
  '/goals/latency',
  '/goals/stability',
  '/goals/privacy',
  '/components/:componentId',
  '/operations/:operationId',
  '/plans/:planId/review',
  '/plans/:planId/confirm',
  '/plans/:planId/preview',
  '/plans/:planId/restart',
  '/plans/:planId/result',
  '/measure/overview',
  '/measure/baseline',
  '/measure/sessions',
  '/measure/compare',
  '/measure/reports',
  '/recover/overview',
  '/recover/ledger',
  '/recover/snapshots',
  '/recover/plans/:planId',
  '/recover/emergency',
  '/assistant',
  '/activity',
  '/account/overview',
  '/account/subscription',
  '/account/device',
  '/account/security',
  '/settings/general',
  '/settings/background',
  '/settings/appearance',
  '/settings/accessibility',
  '/settings/privacy',
  '/settings/notifications',
  '/settings/updates',
  '/settings/advanced',
  '/documentation/:documentId',
]);

describe('routes: complete typed desktop route tree', () => {
  it('covers the locked Section 6 route map exactly once without action routes', () => {
    expect(desktopRouteTree.map(({ pattern }) => pattern)).toEqual(EXPECTED_ROUTE_PATTERNS);
    expect(new Set(desktopRouteTree.map(({ pattern }) => pattern)).size).toBe(
      EXPECTED_ROUTE_PATTERNS.length,
    );
    const capabilities: readonly string[] = desktopRouteTree.map(({ capability }) => capability);
    expect(capabilities).toEqual(
      Array.from({ length: EXPECTED_ROUTE_PATTERNS.length }, () => 'navigate'),
    );
  });

  it('validates dynamic parameters, search, and bounded return intent', () => {
    expect(
      resolveDesktopRoute(
        '/games/vector-strike-arena/profile?filter=trusted&inspector=gpu-driver&returnTo=%2Fhome',
      ),
    ).toMatchObject({
      ok: true,
      value: {
        feature: 'prepare',
        params: { gameId: 'vector-strike-arena' },
        returnIntent: { pathname: '/home' },
        search: { filter: 'trusted', inspector: 'gpu-driver' },
      },
    });

    expect(resolveDesktopRoute('/operations/../../unsafe')).toMatchObject({
      ok: false,
      error: { code: 'UNKNOWN_ROUTE' },
    });
    expect(resolveDesktopRoute('/documentation/https:%2F%2Fevil.example')).toMatchObject({
      ok: false,
    });
    expect(resolveDesktopRoute('/home?execute=optimizer')).toMatchObject({
      ok: false,
      error: { code: 'UNKNOWN_SEARCH_KEY' },
    });
    expect(resolveDesktopRoute('/home?returnTo=%2Fplans%2Falpha%2Fconfirm')).toMatchObject({
      ok: false,
      error: { code: 'UNSAFE_RETURN_INTENT' },
    });
  });

  it('projects every route to a public feature surface and authored state', () => {
    const features = new Set(desktopRouteTree.map(({ feature }) => feature));

    expect(features).toEqual(
      new Set([
        'account-settings',
        'activity',
        'assistant',
        'calibration',
        'documentation',
        'home',
        'improve',
        'measure',
        'prepare',
        'preview-workflow',
        'recover',
      ]),
    );
    expect(desktopRouteTree.every(({ state }) => state.length > 0)).toBe(true);
  });
});

describe('navigation intent: generated allowlist conversion', () => {
  it.each([
    [{ kind: 'goal', destination: 'home' }, '/home'],
    [{ kind: 'goal', destination: 'account' }, '/account/overview'],
    [{ kind: 'settings', destination: 'accessibility' }, '/settings/accessibility'],
    [{ kind: 'calibration', destination: 'inventory' }, '/calibration/inventory'],
    [
      { kind: 'documentation', documentId: 'privacy-connected-processing' },
      '/documentation/privacy-connected-processing',
    ],
  ] satisfies readonly (readonly [ShellNavigationIntent, string])[])(
    'maps %j to %s',
    (intent, expectedPath) => {
      expect(routeFromValidatedShellNavigationIntent(intent)).toMatchObject({
        ok: true,
        value: { pathname: expectedPath },
      });
    },
  );

  it('rejects malformed, traversal, and privileged intent even if JavaScript bypasses types', () => {
    expect(
      routeFromValidatedShellNavigationIntent({
        kind: 'goal',
        destination: 'run-optimizer',
      } as unknown as ShellNavigationIntent),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_NAVIGATION_INTENT' } });
    expect(
      routeFromValidatedShellNavigationIntent({
        kind: 'documentation',
        documentId: '../secrets',
      }),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_NAVIGATION_INTENT' } });
    expect(
      routeFromValidatedShellNavigationIntent({
        kind: 'execute',
        destination: 'power-plan',
      } as unknown as ShellNavigationIntent),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_NAVIGATION_INTENT' } });
  });
});

describe('routes: keyboard, focus, announcements, and browser history', () => {
  it('moves focus once, announces once, and preserves browser-like back/forward behavior', () => {
    const focusHeading = vi.fn();
    const announce = vi.fn();
    const pushState = vi.fn();
    const back = vi.fn();
    const forward = vi.fn();
    const navigator = createDesktopNavigator({
      announce,
      focusHeading,
      history: { back, forward, pushState },
      initialPath: '/home',
    });

    expect(navigator.navigate('/measure/overview')).toMatchObject({ ok: true });
    expect(focusHeading).toHaveBeenCalledOnce();
    expect(announce).toHaveBeenCalledOnce();
    expect(pushState).toHaveBeenCalledWith('/measure/overview');

    expect(navigator.handleKeyboard({ altKey: true, key: 'ArrowLeft' })).toEqual({
      handled: true,
      action: 'history-back',
    });
    expect(navigator.handleKeyboard({ altKey: true, key: 'ArrowRight' })).toEqual({
      handled: true,
      action: 'history-forward',
    });
    expect(back).toHaveBeenCalledOnce();
    expect(forward).toHaveBeenCalledOnce();
  });

  it('implements goal shortcuts and cycles only the four locked F6 regions', () => {
    const focusRegion = vi.fn<(region: DesktopF6Region) => void>();
    const navigator = createDesktopNavigator({
      focusRegion,
      initialPath: '/home',
    });

    expect(navigator.handleKeyboard({ ctrlKey: true, key: '4' })).toMatchObject({
      handled: true,
      action: 'navigate',
      pathname: '/measure/overview',
    });

    for (const region of DESKTOP_F6_REGIONS) {
      expect(navigator.handleKeyboard({ key: 'F6' })).toEqual({
        handled: true,
        action: 'focus-region',
        region,
      });
    }
    expect(focusRegion.mock.calls.map(([region]) => region)).toEqual(DESKTOP_F6_REGIONS);
  });
});

describe('composition: D-20 S01 clean start and remembered test selection', () => {
  const createStorage = (initial?: Readonly<Record<string, string>>) => {
    const values = new Map(Object.entries(initial ?? {}));
    return {
      values,
      storage: {
        getItem: vi.fn((key: string) => values.get(key) ?? null),
        setItem: vi.fn((key: string, value: string) => {
          values.set(key, value);
        }),
      },
    };
  };

  it.each(['development', 'test'] as const)(
    'starts a clean %s composition at S01 first calibration',
    (mode) => {
      const { storage } = createStorage();
      const composition = createDesktopComposition({ mode, storage });

      expect(composition).toMatchObject({
        mode,
        initialPath: '/calibration/welcome',
      });
      expect(composition.scenarioSelection.current()).toBe('S01');
      expect(storage.setItem).not.toHaveBeenCalled();
    },
  );

  it('remembers only a later validated test scenario selection', () => {
    const { storage, values } = createStorage();
    const composition = createDesktopComposition({ mode: 'development', storage });

    expect(composition.scenarioSelection.select('S15')).toEqual({ ok: true, value: 'S15' });
    expect(values).toEqual(new Map([[DESKTOP_TEST_SCENARIO_STORAGE_KEY, 'S15']]));

    const resumed = createDesktopComposition({ mode: 'development', storage });
    expect(resumed.scenarioSelection.current()).toBe('S15');
    expect(resumed.scenarioSelection.select('S99')).toMatchObject({
      ok: false,
      error: { code: 'INVALID_TEST_SCENARIO' },
    });
    expect(values).toEqual(new Map([[DESKTOP_TEST_SCENARIO_STORAGE_KEY, 'S15']]));
  });

  it('ignores corrupt persisted selection and restores safe S01 without rewriting storage', () => {
    const { storage } = createStorage({
      [DESKTOP_TEST_SCENARIO_STORAGE_KEY]: '../fixture',
    });
    const composition = createDesktopComposition({ mode: 'test', storage });

    expect(composition.scenarioSelection.current()).toBe('S01');
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});

describe('composition: production unavailable reference and fixture refusal', () => {
  const productionOptions = {
    clock: () => '2030-01-15T18:00:00.000Z',
    inspectionIds: () => 'production-unavailable-0001',
  };

  it('uses the fail-closed public production reference without scenario storage', () => {
    const storage = {
      getItem: vi.fn(() => 'S15'),
      setItem: vi.fn(),
    };
    const composition = createDesktopComposition({
      mode: 'production',
      productionOptions,
    });

    expect(composition.mode).toBe('production');
    expect(composition.client.identity.adapterId).toBe('liiiraa-desktop-production-unavailable');
    expect(composition.client.schemaVersion).toBe('1.0');
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('refuses fixture identity before production startup even when JavaScript bypasses types', () => {
    expect(() =>
      createDesktopComposition({
        mode: 'production',
        productionOptions,
        productionReferenceFactory: () => ({
          mode: 'production',
          client: {
            identity: {
              adapterId: 'liiiraa-desktop-simulator',
              adapterVersion: '2.0.0',
            },
            schemaVersion: '1.0',
            capabilities: [],
            inspectSystem: vi.fn(),
          },
        }),
      }),
    ).toThrow(
      expect.objectContaining<Partial<DesktopCompositionRefusedError>>({
        code: 'FIXTURE_IDENTITY_REFUSED',
      }),
    );
  });

  it('refuses nested fixture provenance at the runtime composition boundary', () => {
    expect(() =>
      createDesktopComposition({
        mode: 'production',
        productionOptions,
        productionReferenceFactory: () => ({
          mode: 'production',
          client: {
            identity: {
              adapterId: 'liiiraa-desktop-production-unavailable',
              adapterVersion: '1.0.0',
            },
            schemaVersion: '1.0',
            capabilities: [],
            fixtureVersion: 'forbidden',
            inspectSystem: vi.fn(),
          },
        }),
      }),
    ).toThrow(
      expect.objectContaining<Partial<DesktopCompositionRefusedError>>({
        code: 'FIXTURE_PROVENANCE_REFUSED',
      }),
    );
  });
});
