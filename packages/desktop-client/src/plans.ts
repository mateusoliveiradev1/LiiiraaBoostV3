import {
  type PlanApprovalDocumentJson,
  type PlanTransactionDocumentJson,
  type ProgressEventDocumentJson,
  type ProgressSnapshotDocumentJson,
  type RedactedDiagnosticExportDocumentJson,
  type RiskClassJson,
  type TransactionIntentJson,
  type TransactionalPlanDocumentJson,
  type TransactionalRecoveryDocumentJson,
} from '@liiiraa/contracts-ts';
import { transactionalRecoveryDocumentValidator } from '@liiiraa/contracts-ts/generated';

import type { Result } from './errors.js';

export const PLAN_COMMANDS = Object.freeze({
  compose: 'compose_plan',
  revise: 'revise_plan',
  approve: 'approve_plan',
  apply: 'apply_plan',
  restoreOperation: 'restore_plan_operation',
  restorePlan: 'restore_plan',
  restoreCheckpoint: 'restore_recovery_checkpoint',
  readExecution: 'read_plan_execution',
  subscribeExecution: 'subscribe_plan_execution',
  previewDiagnostic: 'preview_plan_diagnostic',
  exportDiagnostic: 'export_plan_diagnostic',
} as const);

export type PlanInvokeCommand = (typeof PLAN_COMMANDS)[keyof typeof PLAN_COMMANDS];

export type PlanInvoke = (
  command: Exclude<PlanInvokeCommand, typeof PLAN_COMMANDS.subscribeExecution>,
  argumentsValue?: Readonly<Record<string, unknown>>,
) => Promise<unknown>;

export type PlanEventListener = (payload: unknown) => void;

export type PlanEventSubscribe = (
  command: typeof PLAN_COMMANDS.subscribeExecution,
  input: Readonly<{ transactionId: string }>,
  listener: PlanEventListener,
) => Promise<() => void> | (() => void);

export type PlanAuthorityOrigin = 'native' | 'deterministic';
export type PlanAuthorityStatus =
  'idle' | 'ready' | 'mutating' | 'reconnecting' | 'unknown' | 'error' | 'disposed';

export type PlanClientError =
  | Readonly<{ code: 'CANCEL_REQUESTED'; dispatched: false }>
  | Readonly<{ code: 'COMMAND_FAILED'; command: PlanInvokeCommand }>
  | Readonly<{
      code: 'CONTRACT_INVALID';
      expectedKind: TransactionalRecoveryDocumentJson['kind'];
      issues: readonly Readonly<{ path: string; keyword: string }>[];
    }>
  | Readonly<{ code: 'DISPOSED' }>
  | Readonly<{ code: 'FIXTURE_PROVENANCE_REFUSED'; path: string }>
  | Readonly<{ code: 'INTENT_INVALID'; path: string }>
  | Readonly<{
      code: 'UNKNOWN_AFTER_DISPATCH';
      command: MutationCommand;
    }>;

export interface PlanAuthoritySnapshot {
  readonly revision: number;
  readonly origin: PlanAuthorityOrigin;
  readonly status: PlanAuthorityStatus;
  readonly plan: TransactionalPlanDocumentJson | null;
  readonly approval: PlanApprovalDocumentJson | null;
  readonly transaction: PlanTransactionDocumentJson | null;
  readonly transactionId: string | null;
  readonly progress: ProgressSnapshotDocumentJson | ProgressEventDocumentJson | null;
  readonly diagnostic: RedactedDiagnosticExportDocumentJson | null;
  readonly sequence: number | null;
  readonly stale: boolean;
  readonly error: PlanClientError | null;
}

export type PlanListener = (snapshot: PlanAuthoritySnapshot) => void;

interface AbortableInput {
  readonly signal?: AbortSignal;
}

export interface ComposePlanInput extends AbortableInput {
  readonly request: Readonly<{
    goalReferences: readonly string[];
    evidenceReferences: readonly string[];
    riskCeiling: RiskClassJson;
  }>;
}

export interface RevisePlanInput extends AbortableInput {
  readonly request: Readonly<{
    planId: string;
    planRevision: number;
    changeReferences: readonly string[];
  }>;
}

export interface ApprovePlanInput extends AbortableInput {
  readonly request: Readonly<{
    planId: string;
    planRevision: number;
    intent: TransactionIntentJson;
    proofReference: string;
  }>;
}

export interface ApplyPlanInput extends AbortableInput {
  readonly request: Readonly<{
    planId: string;
    planRevision: number;
    approvalId: string;
  }>;
}

export interface RestoreOperationInput extends AbortableInput {
  readonly request: Readonly<{
    planId: string;
    operationVersionId: string;
  }>;
}

export interface RestorePlanInput extends AbortableInput {
  readonly request: Readonly<{ planId: string }>;
}

export interface RestoreCheckpointInput extends AbortableInput {
  readonly request: Readonly<{ checkpointId: string }>;
}

export interface ReadExecutionInput {
  readonly transactionId: string;
  readonly signal?: AbortSignal;
}

export interface SubscribeExecutionInput {
  readonly transactionId: string;
}

export interface PreviewDiagnosticInput extends AbortableInput {
  readonly request: Readonly<{ planId: string }>;
}

export interface ExportDiagnosticInput extends AbortableInput {
  readonly request: Readonly<{ planId: string; exportId: string }>;
}

export interface PlanAuthority {
  readonly origin: PlanAuthorityOrigin;
  snapshot(): PlanAuthoritySnapshot;
  subscribe(listener: PlanListener): () => void;
  compose(input: ComposePlanInput): Promise<Result<TransactionalPlanDocumentJson, PlanClientError>>;
  revise(input: RevisePlanInput): Promise<Result<TransactionalPlanDocumentJson, PlanClientError>>;
  approve(input: ApprovePlanInput): Promise<Result<PlanApprovalDocumentJson, PlanClientError>>;
  apply(input: ApplyPlanInput): Promise<Result<PlanTransactionDocumentJson, PlanClientError>>;
  restoreOperation(
    input: RestoreOperationInput,
  ): Promise<Result<PlanTransactionDocumentJson, PlanClientError>>;
  restorePlan(
    input: RestorePlanInput,
  ): Promise<Result<PlanTransactionDocumentJson, PlanClientError>>;
  restoreCheckpoint(
    input: RestoreCheckpointInput,
  ): Promise<Result<PlanTransactionDocumentJson, PlanClientError>>;
  readExecution(
    input: ReadExecutionInput,
  ): Promise<Result<ProgressSnapshotDocumentJson, PlanClientError>>;
  subscribeExecution(input: SubscribeExecutionInput): Promise<Result<() => void, PlanClientError>>;
  previewDiagnostic(
    input: PreviewDiagnosticInput,
  ): Promise<Result<RedactedDiagnosticExportDocumentJson, PlanClientError>>;
  exportDiagnostic(
    input: ExportDiagnosticInput,
  ): Promise<Result<RedactedDiagnosticExportDocumentJson, PlanClientError>>;
  reconnect(transactionId: string): Promise<Result<ProgressSnapshotDocumentJson, PlanClientError>>;
  dispose(): void;
}

export interface TauriPlanAuthorityOptions {
  readonly invoke: PlanInvoke;
  readonly subscribe: PlanEventSubscribe;
}

export interface DeterministicPlanAuthorityOptions {
  readonly invoke: PlanInvoke;
  readonly subscribe: PlanEventSubscribe;
}

type MutableSnapshot = {
  -readonly [Key in keyof PlanAuthoritySnapshot]: PlanAuthoritySnapshot[Key];
};

type ExpectedDocument<Kind extends TransactionalRecoveryDocumentJson['kind']> = Extract<
  TransactionalRecoveryDocumentJson,
  { kind: Kind }
>;

type MutationCommand =
  | typeof PLAN_COMMANDS.compose
  | typeof PLAN_COMMANDS.revise
  | typeof PLAN_COMMANDS.approve
  | typeof PLAN_COMMANDS.apply
  | typeof PLAN_COMMANDS.restoreOperation
  | typeof PLAN_COMMANDS.restorePlan
  | typeof PLAN_COMMANDS.restoreCheckpoint;

type InvokeOutcome =
  | Readonly<{ kind: 'value'; value: unknown }>
  | Readonly<{ kind: 'cancel-requested' }>
  | Readonly<{ kind: 'unknown-after-dispatch' }>
  | Readonly<{ kind: 'failure' }>;

const FORBIDDEN_INTENT_KEYS = new Set([
  'applied',
  'authenticated',
  'authority',
  'authorized',
  'command',
  'commandName',
  'compatibility',
  'compatible',
  'effectiveRisk',
  'entitlement',
  'file',
  'premium',
  'recoveryReady',
  'registry',
  'restored',
  'risk',
  'script',
  'service',
  'shell',
  'strongAuth',
  'success',
  'successful',
  'verification',
  'verified',
]);

const deepFreeze = <Value>(value: Value, seen = new WeakSet<object>()): Readonly<Value> => {
  if (typeof value !== 'object' || value === null || seen.has(value)) {
    return value;
  }
  seen.add(value);
  for (const nested of Object.values(value)) {
    deepFreeze(nested, seen);
  }
  return Object.freeze(value);
};

const immutableClone = <Value>(value: Value): Value => deepFreeze(structuredClone(value));

const errorResult = <Value>(error: PlanClientError): Result<Value, PlanClientError> =>
  Object.freeze({ ok: false, error: deepFreeze(error) });

const successResult = <Value>(value: Value): Result<Value, PlanClientError> =>
  Object.freeze({ ok: true, value });

type NestedRecordInspector = (
  record: Readonly<Record<string, unknown>>,
  path: string,
) => string | undefined;

const findNestedRecordPath = (
  value: unknown,
  inspect: NestedRecordInspector,
  path = '$',
  seen = new WeakSet<object>(),
): string | undefined => {
  if (typeof value !== 'object' || value === null || seen.has(value)) {
    return undefined;
  }
  seen.add(value);
  if (Array.isArray(value)) {
    for (const [index, nested] of value.entries()) {
      const finding = findNestedRecordPath(nested, inspect, `${path}[${String(index)}]`, seen);
      if (finding !== undefined) {
        return finding;
      }
    }
    return undefined;
  }

  const record = value as Readonly<Record<string, unknown>>;
  const inspected = inspect(record, path);
  if (inspected !== undefined) {
    return inspected;
  }
  for (const key of Object.keys(record).toSorted()) {
    const finding = findNestedRecordPath(record[key], inspect, `${path}.${key}`, seen);
    if (finding !== undefined) {
      return finding;
    }
  }
  return undefined;
};

const findFixturePath = (value: unknown): string | undefined =>
  findNestedRecordPath(value, (record, path) =>
    record['kind'] === 'fixture' ||
    Object.hasOwn(record, 'scenarioId') ||
    Object.hasOwn(record, 'fixtureVersion')
      ? path
      : undefined,
  );

const findForbiddenIntentPath = (input: unknown): string | undefined =>
  findNestedRecordPath(input, (record, path) => {
    const forbiddenKey = Object.keys(record)
      .toSorted()
      .find((key) => FORBIDDEN_INTENT_KEYS.has(key));
    return forbiddenKey === undefined ? undefined : `${path}.${forbiddenKey}`;
  });

const validationIssues = (): readonly Readonly<{ path: string; keyword: string }>[] =>
  Object.freeze(
    (transactionalRecoveryDocumentValidator.errors ?? []).slice(0, 8).map((issue) =>
      Object.freeze({
        path: issue.instancePath.length === 0 ? '$' : `$${issue.instancePath}`,
        keyword: issue.keyword,
      }),
    ),
  );

const validateDocument = <Kind extends TransactionalRecoveryDocumentJson['kind']>(
  input: unknown,
  expectedKind: Kind,
  refuseFixtures: boolean,
): Result<ExpectedDocument<Kind>, PlanClientError> => {
  if (refuseFixtures) {
    const fixturePath = findFixturePath(input);
    if (fixturePath !== undefined) {
      return errorResult({ code: 'FIXTURE_PROVENANCE_REFUSED', path: fixturePath });
    }
  }
  if (!transactionalRecoveryDocumentValidator(input) || input.kind !== expectedKind) {
    return errorResult({ code: 'CONTRACT_INVALID', expectedKind, issues: validationIssues() });
  }
  return successResult(immutableClone(input as ExpectedDocument<Kind>));
};

const transportInput = (input: AbortableInput & Readonly<{ request: unknown }>) =>
  Object.freeze({ request: input.request });

const invokeAbortable = async (
  invoke: PlanInvoke,
  command: Exclude<PlanInvokeCommand, typeof PLAN_COMMANDS.subscribeExecution>,
  argumentsValue: Readonly<Record<string, unknown>>,
  signal: AbortSignal | undefined,
  mutation: boolean,
): Promise<InvokeOutcome> => {
  if (signal?.aborted === true) {
    return Object.freeze({ kind: 'cancel-requested' });
  }

  let dispatched = false;
  let detach = (): void => undefined;
  const cancellation = new Promise<InvokeOutcome>((resolve) => {
    if (signal === undefined) {
      return;
    }
    const onAbort = (): void => {
      resolve(
        Object.freeze({
          kind: mutation && dispatched ? 'unknown-after-dispatch' : 'cancel-requested',
        }),
      );
    };
    signal.addEventListener('abort', onAbort, { once: true });
    detach = () => {
      signal.removeEventListener('abort', onAbort);
    };
  });
  const operation: Promise<InvokeOutcome> = Promise.resolve()
    .then(async () => {
      dispatched = true;
      return invoke(command, argumentsValue);
    })
    .then(
      (value) => Object.freeze({ kind: 'value', value }),
      () => Object.freeze({ kind: 'failure' }),
    );
  const outcome =
    signal === undefined ? await operation : await Promise.race([operation, cancellation]);
  detach();
  return outcome;
};

const createPlanAuthority = (
  origin: PlanAuthorityOrigin,
  invoke: PlanInvoke,
  subscribeToEvents: PlanEventSubscribe,
): PlanAuthority => {
  const listeners = new Set<PlanListener>();
  const nativeDetachers = new Set<() => void>();
  let disposed = false;
  let refetch: Readonly<{
    transactionId: string;
    promise: Promise<Result<ProgressSnapshotDocumentJson, PlanClientError>>;
  }> | null = null;
  let snapshot: PlanAuthoritySnapshot = deepFreeze({
    revision: 0,
    origin,
    status: 'idle',
    plan: null,
    approval: null,
    transaction: null,
    transactionId: null,
    progress: null,
    diagnostic: null,
    sequence: null,
    stale: false,
    error: null,
  });

  const publish = (patch: Partial<MutableSnapshot>): void => {
    if (disposed) {
      return;
    }
    snapshot = deepFreeze({ ...snapshot, ...patch, revision: snapshot.revision + 1 });
    for (const listener of listeners) {
      listener(snapshot);
    }
  };

  const disposedResult = <Value>(): Result<Value, PlanClientError> =>
    errorResult({ code: 'DISPOSED' });

  const invalidIntent = <Value>(input: unknown): Result<Value, PlanClientError> | undefined => {
    const path = findForbiddenIntentPath(input);
    return path === undefined ? undefined : errorResult({ code: 'INTENT_INVALID', path });
  };

  const registerNativeDetacher = (detach: () => void): (() => void) => {
    let detached = false;
    const detachOnce = (): void => {
      if (detached) {
        return;
      }
      detached = true;
      nativeDetachers.delete(detachOnce);
      detach();
    };
    nativeDetachers.add(detachOnce);
    return detachOnce;
  };

  const runDocumentCommand = async <Kind extends TransactionalRecoveryDocumentJson['kind']>(
    command: Exclude<PlanInvokeCommand, typeof PLAN_COMMANDS.subscribeExecution>,
    input: AbortableInput & Readonly<{ request: unknown }>,
    expectedKind: Kind,
    mutation: boolean,
    expectedIntent?: TransactionIntentJson,
  ): Promise<Result<ExpectedDocument<Kind>, PlanClientError>> => {
    if (disposed) {
      return disposedResult();
    }
    const rejected = invalidIntent<ExpectedDocument<Kind>>(input);
    if (rejected !== undefined) {
      return rejected;
    }
    if (mutation) {
      publish({ status: 'mutating', error: null });
    }
    const outcome = await invokeAbortable(
      invoke,
      command,
      transportInput(input),
      input.signal,
      mutation,
    );
    if (outcome.kind === 'cancel-requested') {
      const error = deepFreeze({ code: 'CANCEL_REQUESTED' as const, dispatched: false as const });
      publish({ status: 'ready', error });
      return errorResult(error);
    }
    if (outcome.kind === 'unknown-after-dispatch') {
      const error = deepFreeze({
        code: 'UNKNOWN_AFTER_DISPATCH' as const,
        command: command as MutationCommand,
      });
      publish({ status: 'unknown', stale: true, error });
      return errorResult(error);
    }
    if (outcome.kind === 'failure') {
      const error = deepFreeze({ code: 'COMMAND_FAILED' as const, command });
      publish({ status: 'error', error });
      return errorResult(error);
    }
    const validated = validateDocument(outcome.value, expectedKind, origin === 'native');
    if (!validated.ok) {
      publish({ status: 'error', error: validated.error });
      return validated;
    }
    if (
      expectedIntent !== undefined &&
      (!('intent' in validated.value) || validated.value.intent !== expectedIntent)
    ) {
      const error = deepFreeze({
        code: 'CONTRACT_INVALID' as const,
        expectedKind,
        issues: Object.freeze([Object.freeze({ path: '$.intent', keyword: 'const' })]),
      });
      publish({ status: 'error', error });
      return errorResult(error);
    }
    publish({ status: 'ready', error: null });
    return validated;
  };

  const readExecution = async (
    input: ReadExecutionInput,
  ): Promise<Result<ProgressSnapshotDocumentJson, PlanClientError>> => {
    if (disposed) {
      return disposedResult();
    }
    const rejected = invalidIntent<ProgressSnapshotDocumentJson>(input);
    if (rejected !== undefined) {
      return rejected;
    }
    let value: unknown;
    try {
      value = await invoke(PLAN_COMMANDS.readExecution, {
        transactionId: input.transactionId,
      });
    } catch {
      const error = deepFreeze({
        code: 'COMMAND_FAILED' as const,
        command: PLAN_COMMANDS.readExecution,
      });
      publish({ status: 'error', stale: true, error });
      return errorResult(error);
    }
    if (input.signal?.aborted === true) {
      const error = deepFreeze({ code: 'CANCEL_REQUESTED' as const, dispatched: false as const });
      publish({ status: 'reconnecting', stale: true, error });
      return errorResult(error);
    }
    const validated = validateDocument(value, 'progress-snapshot', origin === 'native');
    if (!validated.ok) {
      publish({ status: 'error', stale: true, error: validated.error });
      return validated;
    }
    publish({
      status: 'ready',
      transactionId: validated.value.transactionId,
      progress: validated.value,
      sequence: validated.value.sequence,
      stale: false,
      error: null,
    });
    return validated;
  };

  const authoritativeRefetch = (
    transactionId: string,
  ): Promise<Result<ProgressSnapshotDocumentJson, PlanClientError>> => {
    if (refetch?.transactionId === transactionId) {
      return refetch.promise;
    }
    if (refetch !== null) {
      return refetch.promise.then(async () => authoritativeRefetch(transactionId));
    }
    publish({ status: 'reconnecting', stale: true, error: null });
    const pending = readExecution({ transactionId }).finally(() => {
      if (refetch?.promise === pending) {
        refetch = null;
      }
    });
    refetch = Object.freeze({ transactionId, promise: pending });
    return pending;
  };

  const applyProgressEvent = (payload: unknown, transactionId: string): void => {
    const validated = validateDocument(payload, 'progress-event', origin === 'native');
    if (!validated.ok) {
      publish({ status: 'error', stale: true, error: validated.error });
      void authoritativeRefetch(transactionId);
      return;
    }
    const progressEvent = validated.value;
    const contiguous =
      progressEvent.transactionId === transactionId &&
      (snapshot.sequence === null
        ? progressEvent.sequence === 0 && progressEvent.previousSequence === undefined
        : progressEvent.sequence === snapshot.sequence + 1 &&
          progressEvent.previousSequence === snapshot.sequence);
    if (!contiguous) {
      publish({ status: 'reconnecting', stale: true, error: null });
      void authoritativeRefetch(transactionId);
      return;
    }
    publish({
      status: 'ready',
      transactionId,
      progress: progressEvent,
      sequence: progressEvent.sequence,
      stale: false,
      error: null,
    });
  };

  return Object.freeze({
    origin,
    snapshot: () => snapshot,
    subscribe(listener: PlanListener) {
      if (disposed) {
        return () => undefined;
      }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async compose(input: ComposePlanInput) {
      const result = await runDocumentCommand(
        PLAN_COMMANDS.compose,
        input,
        'transactional-plan',
        true,
      );
      if (result.ok) {
        publish({ plan: result.value });
      }
      return result;
    },
    async revise(input: RevisePlanInput) {
      const result = await runDocumentCommand(
        PLAN_COMMANDS.revise,
        input,
        'transactional-plan',
        true,
      );
      if (result.ok) {
        publish({ plan: result.value });
      }
      return result;
    },
    async approve(input: ApprovePlanInput) {
      const result = await runDocumentCommand(PLAN_COMMANDS.approve, input, 'plan-approval', true);
      if (result.ok) {
        publish({ approval: result.value });
      }
      return result;
    },
    async apply(input: ApplyPlanInput) {
      const result = await runDocumentCommand(
        PLAN_COMMANDS.apply,
        input,
        'plan-transaction',
        true,
        'apply',
      );
      if (result.ok) {
        publish({ transaction: result.value, transactionId: result.value.transactionId });
      }
      return result;
    },
    async restoreOperation(input: RestoreOperationInput) {
      const result = await runDocumentCommand(
        PLAN_COMMANDS.restoreOperation,
        input,
        'plan-transaction',
        true,
        'restore-operation',
      );
      if (result.ok) {
        publish({ transaction: result.value, transactionId: result.value.transactionId });
      }
      return result;
    },
    async restorePlan(input: RestorePlanInput) {
      const result = await runDocumentCommand(
        PLAN_COMMANDS.restorePlan,
        input,
        'plan-transaction',
        true,
        'restore-plan',
      );
      if (result.ok) {
        publish({ transaction: result.value, transactionId: result.value.transactionId });
      }
      return result;
    },
    async restoreCheckpoint(input: RestoreCheckpointInput) {
      const result = await runDocumentCommand(
        PLAN_COMMANDS.restoreCheckpoint,
        input,
        'plan-transaction',
        true,
        'restore-checkpoint',
      );
      if (result.ok) {
        publish({ transaction: result.value, transactionId: result.value.transactionId });
      }
      return result;
    },
    readExecution,
    async subscribeExecution(input: SubscribeExecutionInput) {
      if (disposed) {
        return disposedResult<() => void>();
      }
      const rejected = invalidIntent<() => void>(input);
      if (rejected !== undefined) {
        return rejected;
      }
      try {
        const detach = await subscribeToEvents(
          PLAN_COMMANDS.subscribeExecution,
          Object.freeze({ transactionId: input.transactionId }),
          (payload) => {
            applyProgressEvent(payload, input.transactionId);
          },
        );
        const detachOnce = registerNativeDetacher(detach);
        return successResult<() => void>(detachOnce);
      } catch {
        const error = deepFreeze({
          code: 'COMMAND_FAILED' as const,
          command: PLAN_COMMANDS.subscribeExecution,
        });
        publish({ status: 'error', stale: true, error });
        return errorResult<() => void>(error);
      }
    },
    async previewDiagnostic(input: PreviewDiagnosticInput) {
      const result = await runDocumentCommand(
        PLAN_COMMANDS.previewDiagnostic,
        input,
        'redacted-diagnostic-export',
        false,
      );
      if (result.ok) {
        publish({ diagnostic: result.value });
      }
      return result;
    },
    async exportDiagnostic(input: ExportDiagnosticInput) {
      const result = await runDocumentCommand(
        PLAN_COMMANDS.exportDiagnostic,
        input,
        'redacted-diagnostic-export',
        false,
      );
      if (result.ok) {
        publish({ diagnostic: result.value });
      }
      return result;
    },
    reconnect: authoritativeRefetch,
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      for (const detach of [...nativeDetachers]) {
        detach();
      }
      nativeDetachers.clear();
      listeners.clear();
      snapshot = deepFreeze({ ...snapshot, status: 'disposed', revision: snapshot.revision + 1 });
    },
  });
};

export const createTauriPlanAuthority = (options: TauriPlanAuthorityOptions): PlanAuthority =>
  createPlanAuthority('native', options.invoke, options.subscribe);

export const createDeterministicPlanAuthority = (
  options: DeterministicPlanAuthorityOptions,
): PlanAuthority => createPlanAuthority('deterministic', options.invoke, options.subscribe);
