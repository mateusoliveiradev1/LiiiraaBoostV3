import { describe, expect, it } from 'vitest';

import {
  CALIBRATION_STEPS,
  CALIBRATION_STEP_MESSAGE_IDS,
  DEFAULT_CONNECTED_CONSENT,
  type CalibrationEvent,
  type CalibrationStep,
} from '../model/calibration.js';
import {
  createCalibrationActor,
  isCalibrationEvent,
  requiredStepForAction,
  restoreCalibrationSnapshot,
  selectHomeCalibrationState,
  serializeCalibrationSnapshot,
} from './calibration.machine.js';

const evidence = (
  step: CalibrationStep,
  status: 'valid' | 'deferred' | 'unavailable' | 'invalidated' = 'valid',
) => ({
  step,
  status,
  freshness: status === 'valid' ? ('current' as const) : ('unknown' as const),
  sourceId: `synthetic-${step}`,
  messageId: `calibration.evidence.${status}`,
});

const startActor = () => createCalibrationActor().start();

const sendAll = (events: readonly CalibrationEvent[]) => {
  const actor = startActor();
  for (const event of events) {
    actor.send(event);
  }
  return actor;
};

const requiredEvidenceEvents = Object.freeze([
  { type: 'START' },
  { type: 'RECORD_EVIDENCE', evidence: evidence('trustPrivacy') },
  { type: 'RECORD_EVIDENCE', evidence: evidence('systemInventory') },
] as const satisfies readonly CalibrationEvent[]);

describe('UX-02 calibration contract', () => {
  it('defines the seven ordered steps with stable message IDs', () => {
    expect(CALIBRATION_STEPS).toEqual([
      'trustPrivacy',
      'systemInventory',
      'performanceDiagnosis',
      'recoveryReadiness',
      'goals',
      'priorityGames',
      'review',
    ]);
    expect(Object.keys(CALIBRATION_STEP_MESSAGE_IDS)).toEqual(CALIBRATION_STEPS);
    expect(Object.values(CALIBRATION_STEP_MESSAGE_IDS)).not.toContain('');
  });

  it('D-01 gates Home on trust and inventory only', () => {
    const actor = sendAll([...requiredEvidenceEvents, { type: 'GO_HOME' }]);
    const snapshot = actor.getSnapshot();

    expect(snapshot.value).toBe('home');
    expect(selectHomeCalibrationState(snapshot)).toMatchObject({
      access: 'progressive',
      requiredComplete: true,
      optionalProgress: { completed: 0, total: 5 },
      recommendationsAllowed: true,
    });
  });

  it('D-01 refuses Home when either required evidence item is absent', () => {
    const actor = sendAll([
      { type: 'START' },
      { type: 'RECORD_EVIDENCE', evidence: evidence('trustPrivacy') },
      { type: 'GO_HOME' },
    ]);

    expect(actor.getSnapshot().value).toBe('running');
    expect(selectHomeCalibrationState(actor.getSnapshot()).requiredComplete).toBe(false);
  });

  it('D-02 blocks only the dependent action and preserves its return intent', () => {
    const actor = sendAll([
      ...requiredEvidenceEvents,
      { type: 'DEFER_STEP', step: 'performanceDiagnosis', messageId: 'calibration.defer.saved' },
      { type: 'GO_HOME' },
      {
        type: 'REQUIRE_ACTION',
        action: 'reviewPerformancePlan',
        route: '/plans/review',
      },
    ]);

    expect(actor.getSnapshot()).toMatchObject({
      value: 'dependencyBlocked',
      context: {
        currentStep: 'performanceDiagnosis',
        returnIntent: {
          action: 'reviewPerformancePlan',
          route: '/plans/review',
          requiredStep: 'performanceDiagnosis',
        },
      },
    });
    expect(
      requiredStepForAction({
        type: 'REQUIRE_ACTION',
        action: 'reviewPerformancePlan',
        route: '/plans/review',
      }),
    ).toBe('performanceDiagnosis');
  });

  it('D-03 and D-04 resume through contextual Home with trusted and incomplete regions', () => {
    const actor = sendAll([
      ...requiredEvidenceEvents,
      { type: 'RECORD_EVIDENCE', evidence: evidence('performanceDiagnosis') },
      { type: 'CANCEL' },
      { type: 'RESUME' },
    ]);
    const home = selectHomeCalibrationState(actor.getSnapshot());

    expect(actor.getSnapshot().value).toBe('resumed');
    expect(home.trustedSteps).toEqual(['trustPrivacy', 'systemInventory', 'performanceDiagnosis']);
    expect(home.incompleteSteps).toEqual(['recoveryReadiness', 'goals', 'priorityGames', 'review']);
    expect(home.continueAction).toEqual({
      prominence: 'dominant',
      messageId: 'calibration.action.continue',
      step: 'recoveryReadiness',
    });
  });

  it('D-05 enters retryable limited mode and suppresses recommendations', () => {
    const actor = sendAll([
      { type: 'START' },
      { type: 'FAIL_REQUIRED', reason: 'permissionDenied' },
    ]);
    const limited = selectHomeCalibrationState(actor.getSnapshot());

    expect(actor.getSnapshot()).toMatchObject({
      value: 'limited',
      context: {
        limitedReason: 'permissionDenied',
        diagnosticMessageId: 'calibration.error.permissionDenied',
      },
    });
    expect(limited).toMatchObject({
      access: 'limited',
      recommendationsAllowed: false,
    });

    actor.send({ type: 'RETRY' });
    expect(actor.getSnapshot().value).toBe('running');
  });

  it('D-06 starts every connected consent disabled and changes them independently', () => {
    const actor = startActor();

    expect(actor.getSnapshot().context.consents).toEqual(DEFAULT_CONNECTED_CONSENT);
    actor.send({ type: 'SET_CONSENT', consent: 'cloudAi', granted: true });

    expect(actor.getSnapshot().context.consents).toEqual({
      telemetry: false,
      cloudAi: true,
      diagnosticSharing: false,
    });
  });

  it('D-07 invalidates only affected evidence during partial revalidation', () => {
    const actor = sendAll([
      ...requiredEvidenceEvents,
      { type: 'RECORD_EVIDENCE', evidence: evidence('performanceDiagnosis') },
      { type: 'RECORD_EVIDENCE', evidence: evidence('goals') },
      { type: 'COMPLETE' },
      {
        type: 'REVALIDATE',
        affectedSteps: ['systemInventory', 'performanceDiagnosis'],
        reasonMessageId: 'calibration.revalidation.hardwareChanged',
      },
    ]);

    expect(actor.getSnapshot()).toMatchObject({
      value: 'revalidation',
      context: {
        invalidatedEvidence: ['systemInventory', 'performanceDiagnosis'],
        diagnosticMessageId: 'calibration.revalidation.hardwareChanged',
      },
    });
    expect(actor.getSnapshot().context.evidence.goals?.status).toBe('valid');
    expect(actor.getSnapshot().context.evidence.systemInventory?.status).toBe('invalidated');
  });

  it('D-08 keeps optional work quiet until the active decision depends on it', () => {
    const actor = sendAll([
      ...requiredEvidenceEvents,
      { type: 'DEFER_STEP', step: 'priorityGames', messageId: 'calibration.defer.saved' },
      { type: 'GO_HOME' },
    ]);

    expect(selectHomeCalibrationState(actor.getSnapshot()).continueAction.prominence).toBe('quiet');

    actor.send({
      type: 'REQUIRE_ACTION',
      action: 'preparePriorityGame',
      route: '/games/detail',
    });

    expect(selectHomeCalibrationState(actor.getSnapshot()).continueAction).toEqual({
      prominence: 'dominant',
      messageId: 'calibration.action.continue',
      step: 'priorityGames',
    });
  });

  it('reaches offline, deferred, partial, cancelled, resumed, completed, and revalidation safely', () => {
    const cases = [
      [{ type: 'START' }, { type: 'GO_OFFLINE' }],
      [
        { type: 'START' },
        { type: 'DEFER_STEP', step: 'goals', messageId: 'calibration.defer.saved' },
      ],
      [
        { type: 'START' },
        { type: 'RECORD_EVIDENCE', evidence: evidence('performanceDiagnosis', 'unavailable') },
      ],
      [{ type: 'START' }, { type: 'CANCEL' }],
      [{ type: 'START' }, { type: 'CANCEL' }, { type: 'RESUME' }],
      [...requiredEvidenceEvents, { type: 'COMPLETE' }],
      [
        ...requiredEvidenceEvents,
        { type: 'COMPLETE' },
        {
          type: 'REVALIDATE',
          affectedSteps: ['systemInventory'],
          reasonMessageId: 'calibration.revalidation.stale',
        },
      ],
    ] as const satisfies readonly (readonly CalibrationEvent[])[];

    expect(cases.map((events) => sendAll(events).getSnapshot().value)).toEqual([
      'offlineLocal',
      'deferred',
      'partial',
      'cancelled',
      'resumed',
      'completed',
      'revalidation',
    ]);
  });

  it('round-trips a versioned snapshot without actor internals or diagnostic values', () => {
    const actor = sendAll([
      ...requiredEvidenceEvents,
      { type: 'DEFER_STEP', step: 'goals', messageId: 'calibration.defer.saved' },
    ]);
    const persisted = serializeCalibrationSnapshot(actor.getSnapshot());
    const serialized = JSON.stringify(persisted);

    expect(persisted.snapshotVersion).toBe(1);
    expect(serialized).not.toContain('"children"');
    expect(serialized).not.toContain('xstate');
    expect(serialized).not.toContain('cpuModel');

    const restored = restoreCalibrationSnapshot(JSON.parse(serialized));
    expect(restored).toEqual({ ok: true, snapshot: persisted });

    const restoredActor = createCalibrationActor({ snapshot: persisted }).start();
    expect(serializeCalibrationSnapshot(restoredActor.getSnapshot())).toEqual(persisted);
  });

  it.each([
    null,
    {},
    { snapshotVersion: 99 },
    { snapshotVersion: 1, state: 'made-up' },
    { snapshotVersion: 1, state: 'home', evidence: { systemInventory: { secret: 'raw' } } },
  ])('fails corrupt or unknown snapshots closed into limited startup: %j', (candidate) => {
    expect(restoreCalibrationSnapshot(candidate)).toEqual({
      ok: false,
      limitedReason: 'snapshotInvalid',
      diagnosticMessageId: 'calibration.error.snapshotInvalid',
    });

    const actor = createCalibrationActor({ snapshot: candidate }).start();
    expect(actor.getSnapshot()).toMatchObject({
      value: 'limited',
      context: {
        limitedReason: 'snapshotInvalid',
        diagnosticMessageId: 'calibration.error.snapshotInvalid',
      },
    });
  });

  it('rejects malformed runtime events without changing authority', () => {
    const actor = startActor();
    const before = serializeCalibrationSnapshot(actor.getSnapshot());
    const malformed = {
      type: 'SET_CONSENT',
      consent: 'all',
      granted: true,
    };

    expect(isCalibrationEvent(malformed)).toBe(false);
    actor.send(malformed as CalibrationEvent);
    expect(serializeCalibrationSnapshot(actor.getSnapshot())).toEqual(before);
  });

  it('preserves the recommendation invariant across deterministic event sequences', () => {
    const sequences = [
      [],
      [{ type: 'START' }],
      [{ type: 'START' }, { type: 'FAIL_REQUIRED', reason: 'inventoryFailed' }],
      [...requiredEvidenceEvents, { type: 'GO_HOME' }],
      [
        ...requiredEvidenceEvents,
        { type: 'COMPLETE' },
        {
          type: 'REVALIDATE',
          affectedSteps: ['systemInventory'],
          reasonMessageId: 'calibration.revalidation.hardwareChanged',
        },
      ],
    ] as const satisfies readonly (readonly CalibrationEvent[])[];

    for (const sequence of sequences) {
      const snapshot = sendAll(sequence).getSnapshot();
      const home = selectHomeCalibrationState(snapshot);
      const requiredEvidenceIsValid =
        snapshot.context.evidence.trustPrivacy?.status === 'valid' &&
        snapshot.context.evidence.systemInventory?.status === 'valid';

      expect(home.recommendationsAllowed).toBe(
        requiredEvidenceIsValid && snapshot.value !== 'limited',
      );
    }
  });
});
