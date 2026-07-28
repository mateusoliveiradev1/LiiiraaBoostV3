import { isDesktopRoute } from '@liiiraa/desktop-client';
import { assign, createActor as createXStateActor, setup } from 'xstate';

import {
  CALIBRATION_DEPENDENT_ACTIONS,
  CALIBRATION_SNAPSHOT_VERSION,
  CALIBRATION_STATES,
  CALIBRATION_STEPS,
  CONNECTED_CONSENT_KEYS,
  DEFAULT_CONNECTED_CONSENT,
  EVIDENCE_STATUSES,
  LIMITED_REASONS,
  OPTIONAL_CALIBRATION_STEPS,
  REQUIRED_CALIBRATION_STEPS,
  type CalibrationContext,
  type CalibrationDependentAction,
  type CalibrationEvent,
  type CalibrationEvidence,
  type CalibrationMachineInput,
  type CalibrationMigrationResult,
  type CalibrationReturnIntent,
  type CalibrationSnapshot,
  type CalibrationState,
  type CalibrationStep,
  type ConnectedConsent,
  type HomeCalibrationState,
} from '../model/calibration.js';

interface InternalCalibrationContext extends CalibrationContext {
  readonly restoredState: CalibrationState;
}

interface UnknownRecord extends Readonly<Record<string, unknown>> {
  readonly action?: unknown;
  readonly affectedSteps?: unknown;
  readonly consent?: unknown;
  readonly consents?: unknown;
  readonly currentStep?: unknown;
  readonly diagnosticMessageId?: unknown;
  readonly evidence?: unknown;
  readonly freshness?: unknown;
  readonly granted?: unknown;
  readonly invalidatedEvidence?: unknown;
  readonly limitedReason?: unknown;
  readonly messageId?: unknown;
  readonly reason?: unknown;
  readonly reasonMessageId?: unknown;
  readonly requiredStep?: unknown;
  readonly returnIntent?: unknown;
  readonly route?: unknown;
  readonly snapshotVersion?: unknown;
  readonly sourceId?: unknown;
  readonly state?: unknown;
  readonly status?: unknown;
  readonly step?: unknown;
  readonly type?: unknown;
}

export interface CalibrationActorSnapshot {
  readonly value: CalibrationState;
  readonly context: CalibrationContext;
}

export interface CalibrationActor {
  start(): CalibrationActor;
  send(event: CalibrationEvent): void;
  getSnapshot(): CalibrationActorSnapshot;
}

const ACTION_REQUIRED_STEPS = Object.freeze({
  reviewPerformancePlan: 'performanceDiagnosis',
  verifyRecoveryReadiness: 'recoveryReadiness',
  personalizeGoals: 'goals',
  preparePriorityGame: 'priorityGames',
} as const satisfies Readonly<Record<CalibrationDependentAction, CalibrationStep>>);

const DEFAULT_CONTEXT: InternalCalibrationContext = Object.freeze({
  snapshotVersion: CALIBRATION_SNAPSHOT_VERSION,
  currentStep: 'trustPrivacy',
  evidence: Object.freeze({}),
  invalidatedEvidence: Object.freeze([]),
  consents: DEFAULT_CONNECTED_CONSENT,
  returnIntent: null,
  limitedReason: null,
  diagnosticMessageId: null,
  restoredState: 'new',
});

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasExactKeys = (
  value: Readonly<Record<string, unknown>>,
  keys: readonly string[],
): boolean => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
};

const isOneOf = <T extends string>(value: unknown, values: readonly T[]): value is T =>
  typeof value === 'string' && (values as readonly string[]).includes(value);

const isSafeIdentifier = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(value);

const isCalibrationStep = (value: unknown): value is CalibrationStep =>
  isOneOf(value, CALIBRATION_STEPS);

const isEvidence = (
  value: unknown,
  expectedStep?: CalibrationStep,
): value is CalibrationEvidence => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['step', 'status', 'freshness', 'sourceId', 'messageId']) ||
    !isCalibrationStep(value.step) ||
    (expectedStep !== undefined && value.step !== expectedStep) ||
    !isOneOf(value.status, EVIDENCE_STATUSES) ||
    !isOneOf(value.freshness, ['current', 'stale', 'unknown'] as const) ||
    !isSafeIdentifier(value.sourceId) ||
    !isSafeIdentifier(value.messageId)
  ) {
    return false;
  }

  return value.status === 'valid' ? value.freshness === 'current' : true;
};

const isConsents = (value: unknown): value is ConnectedConsent =>
  isRecord(value) &&
  hasExactKeys(value, CONNECTED_CONSENT_KEYS) &&
  CONNECTED_CONSENT_KEYS.every((key) => typeof value[key] === 'boolean');

const isReturnIntent = (value: unknown): value is CalibrationReturnIntent => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['action', 'route', 'requiredStep']) ||
    !isOneOf(value.action, CALIBRATION_DEPENDENT_ACTIONS) ||
    !isDesktopRoute(value.route) ||
    !isCalibrationStep(value.requiredStep)
  ) {
    return false;
  }

  return ACTION_REQUIRED_STEPS[value.action] === value.requiredStep;
};

const isEvidenceMap = (
  value: unknown,
): value is Readonly<Partial<Record<CalibrationStep, CalibrationEvidence>>> => {
  if (!isRecord(value)) {
    return false;
  }

  return Object.entries(value).every(
    ([step, candidate]) => isCalibrationStep(step) && isEvidence(candidate, step),
  );
};

const isUniqueStepList = (value: unknown): value is readonly CalibrationStep[] =>
  Array.isArray(value) && value.every(isCalibrationStep) && new Set(value).size === value.length;

const isEvidenceTrusted = (
  evidence: CalibrationContext['evidence'],
  step: CalibrationStep,
): boolean => {
  const stepEvidence = evidence[step];
  return stepEvidence?.status === 'valid' && stepEvidence.freshness === 'current';
};

const requiredEvidenceComplete = (context: CalibrationContext): boolean =>
  REQUIRED_CALIBRATION_STEPS.every((step) => isEvidenceTrusted(context.evidence, step));

const firstIncompleteStep = (
  evidence: CalibrationContext['evidence'],
  steps: readonly CalibrationStep[] = CALIBRATION_STEPS,
): CalibrationStep | null => steps.find((step) => !isEvidenceTrusted(evidence, step)) ?? null;

const freezeEvidence = (evidence: CalibrationContext['evidence']): CalibrationContext['evidence'] =>
  Object.freeze({ ...evidence });

const freezeContext = (context: InternalCalibrationContext): InternalCalibrationContext =>
  Object.freeze({
    ...context,
    evidence: freezeEvidence(context.evidence),
    invalidatedEvidence: Object.freeze([...context.invalidatedEvidence]),
    consents: Object.freeze({ ...context.consents }),
    returnIntent: context.returnIntent === null ? null : Object.freeze({ ...context.returnIntent }),
  });

const contextFromSnapshot = (
  snapshot: CalibrationSnapshot,
  restoredState = snapshot.state,
): InternalCalibrationContext =>
  freezeContext({
    snapshotVersion: CALIBRATION_SNAPSHOT_VERSION,
    currentStep: snapshot.currentStep,
    evidence: snapshot.evidence,
    invalidatedEvidence: snapshot.invalidatedEvidence,
    consents: snapshot.consents,
    returnIntent: snapshot.returnIntent,
    limitedReason: snapshot.limitedReason,
    diagnosticMessageId: snapshot.diagnosticMessageId,
    restoredState,
  });

const contextFromInput = (input: CalibrationMachineInput): InternalCalibrationContext => {
  if (input.snapshot === undefined) {
    return DEFAULT_CONTEXT;
  }

  const restored = restoreCalibrationSnapshot(input.snapshot);
  if (restored.ok) {
    return contextFromSnapshot(restored.snapshot);
  }

  return freezeContext({
    ...DEFAULT_CONTEXT,
    limitedReason: restored.limitedReason,
    diagnosticMessageId: restored.diagnosticMessageId,
    restoredState: 'limited',
  });
};

const recordEvidence = (
  context: InternalCalibrationContext,
  evidence: CalibrationEvidence,
): InternalCalibrationContext => {
  const nextEvidence = {
    ...context.evidence,
    [evidence.step]: Object.freeze({ ...evidence }),
  };
  const invalidatedEvidence =
    evidence.status === 'valid'
      ? context.invalidatedEvidence.filter((step) => step !== evidence.step)
      : context.invalidatedEvidence;

  return freezeContext({
    ...context,
    currentStep: firstIncompleteStep(nextEvidence) ?? 'review',
    evidence: nextEvidence,
    invalidatedEvidence,
    diagnosticMessageId: invalidatedEvidence.length === 0 ? null : context.diagnosticMessageId,
  });
};

const deferStep = (
  context: InternalCalibrationContext,
  event: Extract<CalibrationEvent, { type: 'DEFER_STEP' }>,
): InternalCalibrationContext => {
  const nextEvidence = {
    ...context.evidence,
    [event.step]: Object.freeze({
      step: event.step,
      status: 'deferred',
      freshness: 'unknown',
      sourceId: 'local-user-choice',
      messageId: event.messageId,
    } as const satisfies CalibrationEvidence),
  };

  return freezeContext({
    ...context,
    evidence: nextEvidence,
    currentStep: firstIncompleteStep(nextEvidence) ?? 'review',
  });
};

const enterLimitedMode = (
  context: InternalCalibrationContext,
  reason: Extract<CalibrationEvent, { type: 'FAIL_REQUIRED' }>['reason'],
): InternalCalibrationContext => {
  const nextEvidence = { ...context.evidence };
  if (nextEvidence.systemInventory !== undefined) {
    nextEvidence.systemInventory = Object.freeze({
      ...nextEvidence.systemInventory,
      status: 'invalidated',
      freshness: 'unknown',
      messageId: `calibration.error.${reason}`,
    });
  }

  return freezeContext({
    ...context,
    currentStep: 'systemInventory',
    evidence: nextEvidence,
    invalidatedEvidence: Object.freeze(['systemInventory']),
    returnIntent: null,
    limitedReason: reason,
    diagnosticMessageId: `calibration.error.${reason}`,
  });
};

const beginRevalidation = (
  context: InternalCalibrationContext,
  event: Extract<CalibrationEvent, { type: 'REVALIDATE' }>,
): InternalCalibrationContext => {
  const affectedSteps = CALIBRATION_STEPS.filter((step) => event.affectedSteps.includes(step));
  const nextEvidence = { ...context.evidence };

  for (const step of affectedSteps) {
    const existing = nextEvidence[step];
    if (existing !== undefined) {
      nextEvidence[step] = Object.freeze({
        ...existing,
        status: 'invalidated',
        freshness: 'stale',
        messageId: event.reasonMessageId,
      });
    }
  }

  return freezeContext({
    ...context,
    currentStep: affectedSteps[0] ?? context.currentStep,
    evidence: nextEvidence,
    invalidatedEvidence: Object.freeze(affectedSteps),
    returnIntent: null,
    limitedReason: null,
    diagnosticMessageId: event.reasonMessageId,
  });
};

const resumeContext = (context: InternalCalibrationContext): InternalCalibrationContext =>
  freezeContext({
    ...context,
    currentStep:
      context.returnIntent?.requiredStep ??
      firstIncompleteStep(context.evidence, OPTIONAL_CALIBRATION_STEPS) ??
      'review',
  });

const clearLimitedMode = (context: InternalCalibrationContext): InternalCalibrationContext =>
  freezeContext({
    ...context,
    currentStep: firstIncompleteStep(context.evidence, REQUIRED_CALIBRATION_STEPS) ?? 'review',
    limitedReason: null,
    diagnosticMessageId: null,
  });

const transitionByRestoredState = CALIBRATION_STATES.map((state) => ({
  guard: ({ context }: { context: InternalCalibrationContext }) => context.restoredState === state,
  target: state,
}));

const commonActiveTransitions = {
  FAIL_REQUIRED: {
    target: 'limited',
    actions: 'enterLimitedMode',
  },
  SET_CONSENT: {
    actions: 'setConsent',
  },
} as const;

export const calibrationMachine = setup({
  types: {
    context: {} as InternalCalibrationContext,
    events: {} as CalibrationEvent,
    input: {},
  },
  guards: {
    requiredEvidenceComplete: ({ context }) => requiredEvidenceComplete(context),
    evidenceUnavailable: ({ event }) =>
      event.type === 'RECORD_EVIDENCE' && event.evidence.status === 'unavailable',
    blockedEvidenceSatisfied: ({ context, event }) =>
      event.type === 'RECORD_EVIDENCE' &&
      event.evidence.status === 'valid' &&
      event.evidence.step === context.returnIntent?.requiredStep,
    revalidationWillComplete: ({ context, event }) =>
      event.type === 'RECORD_EVIDENCE' &&
      event.evidence.status === 'valid' &&
      context.invalidatedEvidence.every((step) => step === event.evidence.step),
    actionNeedsEvidence: ({ context, event }) =>
      event.type === 'REQUIRE_ACTION' &&
      !isEvidenceTrusted(context.evidence, requiredStepForAction(event)),
  },
  actions: {
    recordEvidence: assign(({ context, event }) =>
      event.type === 'RECORD_EVIDENCE' ? recordEvidence(context, event.evidence) : context,
    ),
    deferStep: assign(({ context, event }) =>
      event.type === 'DEFER_STEP' ? deferStep(context, event) : context,
    ),
    setConsent: assign(({ context, event }) =>
      event.type === 'SET_CONSENT'
        ? freezeContext({
            ...context,
            consents: {
              ...context.consents,
              [event.consent]: event.granted,
            },
          })
        : context,
    ),
    rememberReturnIntent: assign(({ context, event }) =>
      event.type === 'REQUIRE_ACTION'
        ? freezeContext({
            ...context,
            currentStep: requiredStepForAction(event),
            returnIntent: {
              action: event.action,
              route: event.route,
              requiredStep: requiredStepForAction(event),
            },
          })
        : context,
    ),
    enterLimitedMode: assign(({ context, event }) =>
      event.type === 'FAIL_REQUIRED' ? enterLimitedMode(context, event.reason) : context,
    ),
    beginRevalidation: assign(({ context, event }) =>
      event.type === 'REVALIDATE' ? beginRevalidation(context, event) : context,
    ),
    resumeContext: assign(({ context }) => resumeContext(context)),
    clearLimitedMode: assign(({ context }) => clearLimitedMode(context)),
  },
}).createMachine({
  id: 'calibration',
  initial: 'restoring',
  context: ({ input }) => contextFromInput(input),
  states: {
    restoring: {
      always: transitionByRestoredState,
    },
    new: {
      on: {
        START: 'running',
        SET_CONSENT: { actions: 'setConsent' },
      },
    },
    running: {
      on: {
        ...commonActiveTransitions,
        RECORD_EVIDENCE: [
          {
            guard: 'evidenceUnavailable',
            target: 'partial',
            actions: 'recordEvidence',
          },
          { actions: 'recordEvidence' },
        ],
        DEFER_STEP: {
          target: 'deferred',
          actions: 'deferStep',
        },
        GO_HOME: {
          guard: 'requiredEvidenceComplete',
          target: 'home',
        },
        GO_OFFLINE: 'offlineLocal',
        CANCEL: 'cancelled',
        COMPLETE: {
          guard: 'requiredEvidenceComplete',
          target: 'completed',
        },
      },
    },
    offlineLocal: {
      on: {
        ...commonActiveTransitions,
        RESUME: {
          target: 'resumed',
          actions: 'resumeContext',
        },
        CANCEL: 'cancelled',
      },
    },
    deferred: {
      on: {
        ...commonActiveTransitions,
        RESUME: {
          target: 'resumed',
          actions: 'resumeContext',
        },
        GO_HOME: {
          guard: 'requiredEvidenceComplete',
          target: 'home',
        },
        REQUIRE_ACTION: {
          guard: 'actionNeedsEvidence',
          target: 'dependencyBlocked',
          actions: 'rememberReturnIntent',
        },
      },
    },
    partial: {
      on: {
        ...commonActiveTransitions,
        RETRY: 'running',
        RESUME: {
          target: 'resumed',
          actions: 'resumeContext',
        },
        CANCEL: 'cancelled',
      },
    },
    cancelled: {
      on: {
        SET_CONSENT: { actions: 'setConsent' },
        RESUME: {
          target: 'resumed',
          actions: 'resumeContext',
        },
      },
    },
    resumed: {
      on: {
        ...commonActiveTransitions,
        RECORD_EVIDENCE: [
          {
            guard: 'evidenceUnavailable',
            target: 'partial',
            actions: 'recordEvidence',
          },
          { actions: 'recordEvidence' },
        ],
        DEFER_STEP: {
          target: 'deferred',
          actions: 'deferStep',
        },
        GO_HOME: {
          guard: 'requiredEvidenceComplete',
          target: 'home',
        },
        GO_OFFLINE: 'offlineLocal',
        CANCEL: 'cancelled',
        COMPLETE: {
          guard: 'requiredEvidenceComplete',
          target: 'completed',
        },
      },
    },
    home: {
      on: {
        ...commonActiveTransitions,
        REQUIRE_ACTION: {
          guard: 'actionNeedsEvidence',
          target: 'dependencyBlocked',
          actions: 'rememberReturnIntent',
        },
        RESUME: {
          target: 'resumed',
          actions: 'resumeContext',
        },
        REVALIDATE: {
          target: 'revalidation',
          actions: 'beginRevalidation',
        },
      },
    },
    dependencyBlocked: {
      on: {
        ...commonActiveTransitions,
        RECORD_EVIDENCE: [
          {
            guard: 'blockedEvidenceSatisfied',
            target: 'home',
            actions: 'recordEvidence',
          },
          {
            guard: 'evidenceUnavailable',
            target: 'partial',
            actions: 'recordEvidence',
          },
          { actions: 'recordEvidence' },
        ],
        CANCEL: 'cancelled',
      },
    },
    limited: {
      on: {
        SET_CONSENT: { actions: 'setConsent' },
        RETRY: {
          target: 'running',
          actions: 'clearLimitedMode',
        },
      },
    },
    completed: {
      on: {
        ...commonActiveTransitions,
        REQUIRE_ACTION: {
          guard: 'actionNeedsEvidence',
          target: 'dependencyBlocked',
          actions: 'rememberReturnIntent',
        },
        REVALIDATE: {
          target: 'revalidation',
          actions: 'beginRevalidation',
        },
      },
    },
    revalidation: {
      on: {
        ...commonActiveTransitions,
        RECORD_EVIDENCE: [
          {
            guard: 'revalidationWillComplete',
            target: 'home',
            actions: 'recordEvidence',
          },
          {
            guard: 'evidenceUnavailable',
            target: 'partial',
            actions: 'recordEvidence',
          },
          { actions: 'recordEvidence' },
        ],
        CANCEL: 'cancelled',
      },
    },
  },
});

export type CalibrationMachine = typeof calibrationMachine;

export const createCalibrationActor = (input: CalibrationMachineInput = {}): CalibrationActor => {
  const actor = createXStateActor(calibrationMachine, { input });
  const calibrationActor: CalibrationActor = {
    start: () => {
      actor.start();
      return calibrationActor;
    },
    send: (event) => {
      if (isCalibrationEvent(event)) {
        actor.send(event);
      }
    },
    getSnapshot: () => {
      const snapshot = actor.getSnapshot();
      return Object.freeze({
        value: snapshot.value as CalibrationState,
        context: snapshot.context,
      });
    },
  };

  return Object.freeze(calibrationActor);
};

export const requiredStepForAction = (
  event: Extract<CalibrationEvent, { type: 'REQUIRE_ACTION' }>,
): CalibrationStep => ACTION_REQUIRED_STEPS[event.action];

export const selectHomeCalibrationState = (
  snapshot: CalibrationActorSnapshot,
): HomeCalibrationState => {
  const trustedSteps = CALIBRATION_STEPS.filter((step) =>
    isEvidenceTrusted(snapshot.context.evidence, step),
  );
  const incompleteSteps = CALIBRATION_STEPS.filter((step) => !trustedSteps.includes(step));
  const requiredComplete = requiredEvidenceComplete(snapshot.context);
  const optionalCompleted = OPTIONAL_CALIBRATION_STEPS.filter((step) =>
    trustedSteps.includes(step),
  ).length;
  const dependencyStep =
    snapshot.context.returnIntent !== null &&
    !isEvidenceTrusted(snapshot.context.evidence, snapshot.context.returnIntent.requiredStep)
      ? snapshot.context.returnIntent.requiredStep
      : null;
  const nextOptionalStep = firstIncompleteStep(
    snapshot.context.evidence,
    OPTIONAL_CALIBRATION_STEPS,
  );
  const continueStep = dependencyStep ?? nextOptionalStep;
  const access =
    snapshot.value === 'limited'
      ? 'limited'
      : !requiredComplete
        ? 'blocked'
        : snapshot.value === 'completed' || nextOptionalStep === null
          ? 'ready'
          : 'progressive';

  return Object.freeze({
    access,
    requiredComplete,
    optionalProgress: Object.freeze({
      completed: optionalCompleted,
      total: OPTIONAL_CALIBRATION_STEPS.length,
    }),
    trustedSteps: Object.freeze(trustedSteps),
    incompleteSteps: Object.freeze(incompleteSteps),
    recommendationsAllowed: requiredComplete && snapshot.value !== 'limited',
    continueAction: Object.freeze({
      prominence:
        continueStep === null
          ? 'hidden'
          : dependencyStep !== null || snapshot.value === 'resumed'
            ? 'dominant'
            : 'quiet',
      messageId: 'calibration.action.continue',
      step: continueStep,
    }),
  });
};

export const serializeCalibrationSnapshot = (
  snapshot: CalibrationActorSnapshot,
): CalibrationSnapshot =>
  Object.freeze({
    snapshotVersion: CALIBRATION_SNAPSHOT_VERSION,
    state: snapshot.value,
    currentStep: snapshot.context.currentStep,
    evidence: freezeEvidence(snapshot.context.evidence),
    invalidatedEvidence: Object.freeze([...snapshot.context.invalidatedEvidence]),
    consents: Object.freeze({ ...snapshot.context.consents }),
    returnIntent:
      snapshot.context.returnIntent === null
        ? null
        : Object.freeze({ ...snapshot.context.returnIntent }),
    limitedReason: snapshot.context.limitedReason,
    diagnosticMessageId: snapshot.context.diagnosticMessageId,
  });

export const restoreCalibrationSnapshot = (value: unknown): CalibrationMigrationResult => {
  const failure = Object.freeze({
    ok: false,
    limitedReason: 'snapshotInvalid',
    diagnosticMessageId: 'calibration.error.snapshotInvalid',
  } as const);

  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      'snapshotVersion',
      'state',
      'currentStep',
      'evidence',
      'invalidatedEvidence',
      'consents',
      'returnIntent',
      'limitedReason',
      'diagnosticMessageId',
    ]) ||
    value.snapshotVersion !== CALIBRATION_SNAPSHOT_VERSION ||
    !isOneOf(value.state, CALIBRATION_STATES) ||
    !isCalibrationStep(value.currentStep) ||
    !isEvidenceMap(value.evidence) ||
    !isUniqueStepList(value.invalidatedEvidence) ||
    !isConsents(value.consents) ||
    !(value.returnIntent === null || isReturnIntent(value.returnIntent)) ||
    !(value.limitedReason === null || isOneOf(value.limitedReason, LIMITED_REASONS)) ||
    !(value.diagnosticMessageId === null || isSafeIdentifier(value.diagnosticMessageId))
  ) {
    return failure;
  }

  const snapshot = Object.freeze({
    snapshotVersion: CALIBRATION_SNAPSHOT_VERSION,
    state: value.state,
    currentStep: value.currentStep,
    evidence: freezeEvidence(value.evidence),
    invalidatedEvidence: Object.freeze([...value.invalidatedEvidence]),
    consents: Object.freeze({ ...value.consents }),
    returnIntent: value.returnIntent === null ? null : Object.freeze({ ...value.returnIntent }),
    limitedReason: value.limitedReason,
    diagnosticMessageId: value.diagnosticMessageId,
  } satisfies CalibrationSnapshot);

  const restoredContext = contextFromSnapshot(snapshot);
  if (
    ((snapshot.state === 'home' ||
      snapshot.state === 'completed' ||
      snapshot.state === 'dependencyBlocked') &&
      !requiredEvidenceComplete(restoredContext)) ||
    (snapshot.state === 'limited' && snapshot.limitedReason === null) ||
    (snapshot.state === 'dependencyBlocked' && snapshot.returnIntent === null)
  ) {
    return failure;
  }

  return Object.freeze({ ok: true, snapshot });
};

export const isCalibrationEvent = (value: unknown): value is CalibrationEvent => {
  if (!isRecord(value) || typeof value.type !== 'string') {
    return false;
  }

  switch (value.type) {
    case 'START':
    case 'GO_HOME':
    case 'GO_OFFLINE':
    case 'CANCEL':
    case 'RESUME':
    case 'COMPLETE':
    case 'RETRY':
      return hasExactKeys(value, ['type']);
    case 'RECORD_EVIDENCE':
      return hasExactKeys(value, ['type', 'evidence']) && isEvidence(value.evidence);
    case 'DEFER_STEP':
      return (
        hasExactKeys(value, ['type', 'step', 'messageId']) &&
        isCalibrationStep(value.step) &&
        OPTIONAL_CALIBRATION_STEPS.includes(
          value.step as (typeof OPTIONAL_CALIBRATION_STEPS)[number],
        ) &&
        isSafeIdentifier(value.messageId)
      );
    case 'REQUIRE_ACTION':
      return (
        hasExactKeys(value, ['type', 'action', 'route']) &&
        isOneOf(value.action, CALIBRATION_DEPENDENT_ACTIONS) &&
        isDesktopRoute(value.route)
      );
    case 'FAIL_REQUIRED':
      return (
        hasExactKeys(value, ['type', 'reason']) &&
        isOneOf(value.reason, ['inventoryFailed', 'permissionDenied'] as const)
      );
    case 'SET_CONSENT':
      return (
        hasExactKeys(value, ['type', 'consent', 'granted']) &&
        isOneOf(value.consent, CONNECTED_CONSENT_KEYS) &&
        typeof value.granted === 'boolean'
      );
    case 'REVALIDATE':
      return (
        hasExactKeys(value, ['type', 'affectedSteps', 'reasonMessageId']) &&
        isUniqueStepList(value.affectedSteps) &&
        value.affectedSteps.length > 0 &&
        isSafeIdentifier(value.reasonMessageId)
      );
    default:
      return false;
  }
};
