import { describe, expect, it } from 'vitest';

import {
  ACTIVITY_STATES,
  CALIBRATION_PROGRESS_STATES,
  ENTITLEMENT_STATES,
  EVIDENCE_FRESHNESS_STATES,
  EVIDENCE_QUALITY_STATES,
  OPERATIONAL_STATES,
  isOperationalState,
} from './experience.js';

describe('closed desktop experience operational state', () => {
  it('keeps every authored operational state exhaustive and rejects ad-hoc values', () => {
    expect(OPERATIONAL_STATES).toEqual([
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
    expect(EVIDENCE_FRESHNESS_STATES).toEqual(['current', 'stale', 'unknown']);
    expect(EVIDENCE_QUALITY_STATES).toEqual([
      'verified',
      'degraded',
      'insufficient',
      'contradictory',
      'unavailable',
    ]);
    expect(ENTITLEMENT_STATES).toEqual(['active', 'offline-grace', 'expired']);
    expect(CALIBRATION_PROGRESS_STATES).toEqual([
      'new',
      'running',
      'slow',
      'paused',
      'resumed',
      'deferred',
      'cancelled',
      'complete',
    ]);
    expect(ACTIVITY_STATES).toEqual(['requires-action', 'in-progress', 'completed', 'history']);

    expect(isOperationalState('recovery')).toBe(true);
    expect(isOperationalState('some-loading-flag')).toBe(false);
    expect(Object.isFrozen(OPERATIONAL_STATES)).toBe(true);
  });
});
