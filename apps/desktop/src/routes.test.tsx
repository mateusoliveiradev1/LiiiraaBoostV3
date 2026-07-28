import { describe, expect, it, vi } from 'vitest';

import {
  DESKTOP_F6_REGIONS,
  createDesktopNavigator,
  desktopRouteTree,
  resolveDesktopRoute,
  routeFromValidatedShellNavigationIntent,
  type ShellNavigationIntent,
} from './routes.js';

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
    expect(desktopRouteTree.every(({ capability }) => capability === 'navigate')).toBe(true);
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
    const focusRegion = vi.fn();
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
