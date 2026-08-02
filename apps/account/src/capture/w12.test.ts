import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { createW12AccountCaptureProjection } from './w12';

const captureSource = readFileSync(new URL('./w12.ts', import.meta.url), 'utf8');

describe('W12 account evidence projection', () => {
  it('serializes the closed canonical degraded state with accessible recovery names', () => {
    const projection = createW12AccountCaptureProjection();
    expect(projection).toMatchObject({
      locale: 'en',
      routeId: 'account-overview',
      scenarioId: 'W12',
    });
    expect(projection.markup).toContain(
      'data-account-state="offline stale expired-session partial-failure"',
    );
    expect(projection.markup).toContain('aria-label="Safe recovery"');
    expect(projection.markup).toContain('<strong>Offline</strong>');
    expect(projection.markup).toContain('<strong>Review required</strong>');
    expect(projection.markup).toContain('Account information cannot be refreshed right now.');
    expect(projection.markup).toContain(
      'Display name, language, and support subject remain available',
    );
  });

  it('has no input selector and escapes canonical copy before interpolation', () => {
    expect(captureSource).toContain("resolveAccountScenarioId('account-overview', 'W12')");
    expect(captureSource).toContain('escapeCaptureText(content.states.failure)');
    expect(captureSource).toContain('escapeCaptureText(state.copy)');
    expect(captureSource).toContain('escapeCaptureText(content.recovery.signIn)');
    expect(captureSource).not.toMatch(
      /searchParams|process\.env|document\.cookie|localStorage|sessionStorage/iu,
    );
  });
});
