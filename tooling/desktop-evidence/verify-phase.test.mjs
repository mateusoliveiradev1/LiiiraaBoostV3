import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';

import { verifyPhase02 } from './verify-phase.mjs';

const workspaceRoot = resolve(import.meta.dirname, '..', '..');

test('Phase 02 final verifier accepts only the development visual and UX scope', () => {
  const report = verifyPhase02({ workspaceRoot });

  assert.equal(report.acceptance, 'passed');
  assert.equal(report.scope, 'phase-02-development-visual-ux');
  assert.deepEqual(report.requirements, [
    'UX-01',
    'UX-02',
    'UX-03',
    'UX-04',
    'UX-05',
    'UX-06',
    'UX-07',
    'UX-08',
    'UX-09',
    'UX-10',
    'UX-11',
    'UX-12',
  ]);
  assert.equal(report.manualObservations.length, 4);
  assert.equal(report.publicTrust, false);
  assert.equal(report.productionReady, false);
  assert.equal(report.distributionAllowed, false);
});
