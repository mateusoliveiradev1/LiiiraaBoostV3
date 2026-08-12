import {
  hardwareEvidenceDocumentValidator,
  type EvidenceComparisonJson,
  type EvidenceQualityJson,
  type EvidenceReportJson,
  type EvidenceSchemaVersionJson,
  type HardwareEvidenceDocumentJson,
  type IncompleteMeasurementSessionJson,
  type InventorySnapshotJson,
  type MeasurementSessionJson,
  type MetricKindJson,
  type MetricUnitJson,
} from '@liiiraa/contracts-ts';

import type { Result } from './errors.js';

export const EVIDENCE_COMMANDS = Object.freeze({
  refreshInventory: 'refresh_hardware_inventory',
  readInventory: 'read_hardware_inventory',
  startCapture: 'start_measurement_capture',
  sampleCapture: 'sample_measurement_capture',
  cancelCapture: 'cancel_measurement_capture',
  finishCapture: 'finish_measurement_capture',
  compareSessions: 'compare_measurement_sessions',
  renderReport: 'render_evidence_report',
  exportReport: 'export_evidence_report',
  readHealth: 'read_evidence_health',
} as const);

export type EvidenceInvokeCommand = (typeof EVIDENCE_COMMANDS)[keyof typeof EVIDENCE_COMMANDS];

export interface EvidenceInvoke {
  (
    command: EvidenceInvokeCommand,
    argumentsValue?: Readonly<Record<string, unknown>>,
  ): Promise<unknown>;
}

export type EvidenceAuthorityOrigin = 'native' | 'deterministic';
export type EvidenceAuthorityStatus =
  'idle' | 'refreshing' | 'capturing' | 'cancelling' | 'ready' | 'error' | 'disposed';

export type EvidenceClientError =
  | Readonly<{ code: 'CANCELLED' }>
  | Readonly<{ code: 'COMMAND_FAILED'; command: EvidenceInvokeCommand }>
  | Readonly<{
      code: 'CONTRACT_INVALID';
      expectedKind: HardwareEvidenceDocumentJson['kind'];
      issues: readonly Readonly<{ path: string; keyword: string }>[];
    }>
  | Readonly<{ code: 'DISPOSED' }>
  | Readonly<{ code: 'FIXTURE_PROVENANCE_REFUSED'; path: string }>
  | Readonly<{ code: 'RECEIPT_INVALID'; command: EvidenceInvokeCommand }>;

export interface EvidenceSelection {
  readonly beforeSessionId: string | null;
  readonly afterSessionId: string | null;
}

export interface EvidenceAuthoritySnapshot {
  readonly revision: number;
  readonly origin: EvidenceAuthorityOrigin;
  readonly status: EvidenceAuthorityStatus;
  readonly inventory: InventorySnapshotJson | null;
  readonly capture: MeasurementSessionJson | null;
  readonly comparison: EvidenceComparisonJson | null;
  readonly report: EvidenceReportJson | null;
  readonly selection: EvidenceSelection;
  readonly staleInventory: boolean;
  readonly inventoryActionable: boolean;
  readonly error: EvidenceClientError | null;
}

export type EvidenceListener = (snapshot: EvidenceAuthoritySnapshot) => void;

interface AbortableInput {
  readonly signal?: AbortSignal;
}

export type RefreshInventoryRequest = Readonly<
  Pick<
    InventorySnapshotJson,
    'schemaVersion' | 'evidenceId' | 'evidenceVersion' | 'collectedAt'
  > & {
    readonly deadlineAt: string;
    readonly perSourceTimeoutMs: number;
    readonly policyDate: number;
  }
>;

export interface RefreshInventoryInput extends AbortableInput {
  readonly request: RefreshInventoryRequest;
}

export type StartCaptureRequest = Readonly<
  Pick<
    IncompleteMeasurementSessionJson,
    'schemaVersion' | 'sessionId' | 'evidenceVersion' | 'startedAt'
  > &
    Pick<
      IncompleteMeasurementSessionJson['baseline'],
      'baselineId' | 'inventoryEvidenceId' | 'inventoryEvidenceHash'
    > & {
      readonly deadlineAt: string;
      readonly collectorVersion: string;
    }
>;

export interface StartCaptureInput extends AbortableInput {
  readonly request: StartCaptureRequest;
}

export interface CancelCaptureInput extends AbortableInput {
  readonly request: Readonly<{
    schemaVersion: EvidenceSchemaVersionJson;
    monotonicNs: number;
  }>;
}

export interface FinishCaptureInput extends AbortableInput {
  readonly request: Readonly<{
    schemaVersion: EvidenceSchemaVersionJson;
    completedAt: string;
  }>;
}

export interface NativeMetricEvidence {
  readonly kind: MetricKindJson;
  readonly unit: MetricUnitJson;
  readonly value: number;
  readonly quality: EvidenceQualityJson;
}

export interface NativeSessionEvidence {
  readonly sessionId: string;
  readonly evidenceHash: string;
  readonly inventoryEvidenceId: string;
  readonly inventoryEvidenceHash: string;
  readonly workloadId: string;
  readonly environmentId: string;
  readonly methodologyId: string;
  readonly durationMs: number;
  readonly coveragePpm: number;
  readonly sourceHealthy: boolean;
  readonly quality: EvidenceQualityJson;
  readonly metric: NativeMetricEvidence | null;
}

export interface CompareSessionsInput extends AbortableInput {
  readonly request: Readonly<{
    schemaVersion: EvidenceSchemaVersionJson;
    comparisonId: string;
    before: NativeSessionEvidence;
    after: NativeSessionEvidence;
    comparedAt: string;
  }>;
}

export interface RenderReportInput extends AbortableInput {
  readonly request: Readonly<{
    schemaVersion: EvidenceSchemaVersionJson;
    reportId: string;
    comparisonId: string;
    generatedAt: string;
    limitations: readonly string[];
  }>;
}

export type EvidenceExportFormat = 'json' | 'html';

export interface ExportReportInput extends AbortableInput {
  readonly request: Readonly<{
    schemaVersion: EvidenceSchemaVersionJson;
    reportId: string;
    format: EvidenceExportFormat;
    fileName: string;
  }>;
}

export interface CancellationReceipt {
  readonly state: 'acknowledged';
  readonly latencyMs: number;
}

export interface CaptureSampleReceipt {
  readonly schemaVersion: '1.0';
  readonly readOnly: true;
}

export interface ExportReceipt {
  readonly reportId: string;
  readonly format: EvidenceExportFormat;
  readonly fileName: string;
  readonly stored: true;
}

export interface EvidenceHealth {
  readonly authority: 'available';
  readonly inventory: 'ready' | 'not-collected';
  readonly capture: 'idle' | 'active' | 'cancelled';
  readonly comparisons: number;
  readonly reports: number;
  readonly overhead: Readonly<{
    counterPollCeilingHz: number;
    cancellationBudgetMs: number;
    elevated: false;
  }>;
}

export interface EvidenceAuthority {
  readonly origin: EvidenceAuthorityOrigin;
  snapshot(): EvidenceAuthoritySnapshot;
  subscribe(listener: EvidenceListener): () => void;
  setComparisonSelection(beforeSessionId: string | null, afterSessionId: string | null): void;
  refreshInventory(
    input: RefreshInventoryInput,
  ): Promise<Result<InventorySnapshotJson, EvidenceClientError>>;
  readInventory(signal?: AbortSignal): Promise<Result<InventorySnapshotJson, EvidenceClientError>>;
  startCapture(
    input: StartCaptureInput,
  ): Promise<Result<MeasurementSessionJson, EvidenceClientError>>;
  sampleCapture(signal?: AbortSignal): Promise<Result<CaptureSampleReceipt, EvidenceClientError>>;
  cancelCapture(
    input: CancelCaptureInput,
  ): Promise<Result<CancellationReceipt, EvidenceClientError>>;
  finishCapture(
    input: FinishCaptureInput,
  ): Promise<Result<MeasurementSessionJson, EvidenceClientError>>;
  compareSessions(
    input: CompareSessionsInput,
  ): Promise<Result<EvidenceComparisonJson, EvidenceClientError>>;
  renderReport(input: RenderReportInput): Promise<Result<EvidenceReportJson, EvidenceClientError>>;
  exportReport(input: ExportReportInput): Promise<Result<ExportReceipt, EvidenceClientError>>;
  readHealth(signal?: AbortSignal): Promise<Result<EvidenceHealth, EvidenceClientError>>;
  dispose(): void;
}

export interface TauriEvidenceAuthorityOptions {
  readonly invoke: EvidenceInvoke;
}

export interface DeterministicEvidenceAuthorityOptions {
  readonly invoke: EvidenceInvoke;
}

type MutableSnapshot = {
  -readonly [Key in keyof EvidenceAuthoritySnapshot]: EvidenceAuthoritySnapshot[Key];
};

type ExpectedDocument<Kind extends HardwareEvidenceDocumentJson['kind']> = Extract<
  HardwareEvidenceDocumentJson,
  { kind: Kind }
>;

type InvokeOutcome =
  | Readonly<{ kind: 'value'; value: unknown }>
  | Readonly<{ kind: 'cancelled' }>
  | Readonly<{ kind: 'failure' }>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

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

const immutableClone = <Value>(value: Value): Value => deepFreeze(structuredClone(value)) as Value;

const errorResult = <Value>(error: EvidenceClientError): Result<Value, EvidenceClientError> =>
  Object.freeze({ ok: false, error: deepFreeze(error) });

const successResult = <Value>(value: Value): Result<Value, EvidenceClientError> =>
  Object.freeze({ ok: true, value });

const findFixturePath = (
  value: unknown,
  path = '$',
  seen = new WeakSet<object>(),
): string | undefined => {
  if (typeof value !== 'object' || value === null || seen.has(value)) {
    return undefined;
  }
  seen.add(value);
  if (Array.isArray(value)) {
    for (const [index, nested] of value.entries()) {
      const finding = findFixturePath(nested, `${path}[${String(index)}]`, seen);
      if (finding !== undefined) {
        return finding;
      }
    }
    return undefined;
  }

  const record = value as Readonly<Record<string, unknown>>;
  if (
    record['kind'] === 'fixture' ||
    Object.hasOwn(record, 'scenarioId') ||
    Object.hasOwn(record, 'fixtureVersion')
  ) {
    return path;
  }
  for (const key of Object.keys(record).toSorted()) {
    const finding = findFixturePath(record[key], `${path}.${key}`, seen);
    if (finding !== undefined) {
      return finding;
    }
  }
  return undefined;
};

const validationIssues = (): readonly Readonly<{ path: string; keyword: string }>[] =>
  Object.freeze(
    (hardwareEvidenceDocumentValidator.errors ?? []).slice(0, 8).map((issue) =>
      Object.freeze({
        path: issue.instancePath.length === 0 ? '$' : `$${issue.instancePath}`,
        keyword: issue.keyword,
      }),
    ),
  );

const validateDocument = <Kind extends HardwareEvidenceDocumentJson['kind']>(
  input: unknown,
  expectedKind: Kind,
  refuseFixtures: boolean,
): Result<ExpectedDocument<Kind>, EvidenceClientError> => {
  if (refuseFixtures) {
    const fixturePath = findFixturePath(input);
    if (fixturePath !== undefined) {
      return errorResult({ code: 'FIXTURE_PROVENANCE_REFUSED', path: fixturePath });
    }
  }
  if (!hardwareEvidenceDocumentValidator(input) || input.kind !== expectedKind) {
    return errorResult({
      code: 'CONTRACT_INVALID',
      expectedKind,
      issues: validationIssues(),
    });
  }
  return successResult(immutableClone(input as ExpectedDocument<Kind>));
};

const invokeAbortable = async (
  invoke: EvidenceInvoke,
  command: EvidenceInvokeCommand,
  argumentsValue: Readonly<Record<string, unknown>> | undefined,
  signal: AbortSignal | undefined,
): Promise<InvokeOutcome> => {
  if (signal?.aborted === true) {
    return Object.freeze({ kind: 'cancelled' });
  }

  let detach = (): void => undefined;
  const cancellation = new Promise<InvokeOutcome>((resolve) => {
    if (signal === undefined) {
      return;
    }
    const onAbort = (): void => resolve(Object.freeze({ kind: 'cancelled' }));
    signal.addEventListener('abort', onAbort, { once: true });
    detach = () => signal.removeEventListener('abort', onAbort);
  });
  const operation: Promise<InvokeOutcome> = Promise.resolve()
    .then(async () => invoke(command, argumentsValue))
    .then(
      (value) => Object.freeze({ kind: 'value', value }),
      () => Object.freeze({ kind: 'failure' }),
    );
  const outcome =
    signal === undefined ? await operation : await Promise.race([operation, cancellation]);
  detach();
  return outcome;
};

const validCancellationReceipt = (value: unknown): value is CancellationReceipt =>
  isRecord(value) &&
  value['state'] === 'acknowledged' &&
  typeof value['latencyMs'] === 'number' &&
  Number.isInteger(value['latencyMs']) &&
  value['latencyMs'] >= 0 &&
  value['latencyMs'] <= 250;

const validCaptureSampleReceipt = (value: unknown): value is CaptureSampleReceipt =>
  isRecord(value) &&
  value['schemaVersion'] === '1.0' &&
  value['readOnly'] === true &&
  isRecord(value['cpu']) &&
  isRecord(value['memory']) &&
  isRecord(value['gpu']) &&
  isRecord(value['collectionLatency']) &&
  findFixturePath(value) === undefined;

const validExportReceipt = (value: unknown): value is ExportReceipt =>
  isRecord(value) &&
  typeof value['reportId'] === 'string' &&
  (value['format'] === 'json' || value['format'] === 'html') &&
  typeof value['fileName'] === 'string' &&
  value['stored'] === true &&
  value['fileName'] === `${value['reportId']}.${value['format']}`;

const validHealth = (value: unknown): value is EvidenceHealth => {
  if (!isRecord(value) || !isRecord(value['overhead'])) {
    return false;
  }
  const overhead = value['overhead'];
  return (
    value['authority'] === 'available' &&
    (value['inventory'] === 'ready' || value['inventory'] === 'not-collected') &&
    ['idle', 'active', 'cancelled'].includes(String(value['capture'])) &&
    typeof value['comparisons'] === 'number' &&
    typeof value['reports'] === 'number' &&
    overhead['counterPollCeilingHz'] === 1 &&
    typeof overhead['cancellationBudgetMs'] === 'number' &&
    overhead['cancellationBudgetMs'] <= 250 &&
    overhead['elevated'] === false
  );
};

const INVENTORY_CAPTURE_REQUIREMENTS = ['cpu', 'gpu', 'memory', 'storage', 'windows'] as const;

const inventoryIsActionable = (inventory: InventorySnapshotJson): boolean =>
  inventory.execution.health.state !== 'unavailable' &&
  inventory.execution.overhead.quality !== 'insufficient' &&
  INVENTORY_CAPTURE_REQUIREMENTS.every((key) => inventory[key].state === 'observed');

const createEvidenceAuthority = (
  origin: EvidenceAuthorityOrigin,
  invoke: EvidenceInvoke,
): EvidenceAuthority => {
  const listeners = new Set<EvidenceListener>();
  let disposed = false;
  let snapshot: EvidenceAuthoritySnapshot = deepFreeze({
    revision: 0,
    origin,
    status: 'idle',
    inventory: null,
    capture: null,
    comparison: null,
    report: null,
    selection: deepFreeze({ beforeSessionId: null, afterSessionId: null }),
    staleInventory: false,
    inventoryActionable: false,
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

  const disposedResult = <Value>(): Result<Value, EvidenceClientError> =>
    errorResult({ code: 'DISPOSED' });

  const commandFailure = <Value>(
    command: EvidenceInvokeCommand,
    outcome: Exclude<InvokeOutcome, { kind: 'value' }>,
  ): Result<Value, EvidenceClientError> => {
    const error: EvidenceClientError =
      outcome.kind === 'cancelled' ? { code: 'CANCELLED' } : { code: 'COMMAND_FAILED', command };
    publish({
      status: 'error',
      staleInventory: snapshot.inventory !== null,
      inventoryActionable: false,
      error,
    });
    return errorResult(error);
  };

  const invokeDocument = async <Kind extends HardwareEvidenceDocumentJson['kind']>(
    command: EvidenceInvokeCommand,
    expectedKind: Kind,
    request: Readonly<Record<string, unknown>> | undefined,
    signal: AbortSignal | undefined,
  ): Promise<Result<ExpectedDocument<Kind>, EvidenceClientError>> => {
    if (disposed) {
      return disposedResult();
    }
    const outcome = await invokeAbortable(invoke, command, request, signal);
    if (outcome.kind !== 'value') {
      return commandFailure(command, outcome);
    }
    return validateDocument(outcome.value, expectedKind, origin === 'native');
  };

  return Object.freeze({
    origin,
    snapshot: () => snapshot,
    subscribe(listener: EvidenceListener) {
      if (disposed) {
        return () => undefined;
      }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setComparisonSelection(beforeSessionId: string | null, afterSessionId: string | null) {
      if (disposed) {
        return;
      }
      publish({ selection: deepFreeze({ beforeSessionId, afterSessionId }) });
    },
    async refreshInventory(input: RefreshInventoryInput) {
      if (disposed) {
        return disposedResult<InventorySnapshotJson>();
      }
      publish({
        status: 'refreshing',
        staleInventory: snapshot.inventory !== null,
        inventoryActionable: false,
        error: null,
      });
      const result = await invokeDocument(
        EVIDENCE_COMMANDS.refreshInventory,
        'inventory-snapshot',
        { request: input.request },
        input.signal,
      );
      if (!result.ok) {
        publish({
          status: 'error',
          staleInventory: snapshot.inventory !== null,
          inventoryActionable: false,
          error: result.error,
        });
        return result;
      }
      publish({
        status: 'ready',
        inventory: result.value,
        staleInventory: false,
        inventoryActionable: inventoryIsActionable(result.value),
        error: null,
      });
      return result;
    },
    async readInventory(signal?: AbortSignal) {
      const result = await invokeDocument(
        EVIDENCE_COMMANDS.readInventory,
        'inventory-snapshot',
        undefined,
        signal,
      );
      if (result.ok) {
        publish({
          status: 'ready',
          inventory: result.value,
          staleInventory: false,
          inventoryActionable: inventoryIsActionable(result.value),
          error: null,
        });
      }
      return result;
    },
    async startCapture(input: StartCaptureInput) {
      publish({ status: 'capturing', error: null });
      const result = await invokeDocument(
        EVIDENCE_COMMANDS.startCapture,
        'measurement-session',
        { request: input.request },
        input.signal,
      );
      if (result.ok) {
        publish({ status: 'capturing', capture: result.value, error: null });
      }
      return result;
    },
    async sampleCapture(signal?: AbortSignal) {
      if (disposed) {
        return disposedResult<CaptureSampleReceipt>();
      }
      const outcome = await invokeAbortable(
        invoke,
        EVIDENCE_COMMANDS.sampleCapture,
        undefined,
        signal,
      );
      if (outcome.kind !== 'value') {
        return commandFailure<CaptureSampleReceipt>(EVIDENCE_COMMANDS.sampleCapture, outcome);
      }
      if (!validCaptureSampleReceipt(outcome.value)) {
        const error = deepFreeze({
          code: 'RECEIPT_INVALID' as const,
          command: EVIDENCE_COMMANDS.sampleCapture,
        });
        publish({ status: 'error', error });
        return errorResult<CaptureSampleReceipt>(error);
      }
      return successResult<CaptureSampleReceipt>(
        Object.freeze({ schemaVersion: '1.0', readOnly: true }),
      );
    },
    async cancelCapture(input: CancelCaptureInput) {
      if (disposed) {
        return disposedResult<CancellationReceipt>();
      }
      publish({ status: 'cancelling', error: null });
      const outcome = await invokeAbortable(
        invoke,
        EVIDENCE_COMMANDS.cancelCapture,
        { request: input.request },
        input.signal,
      );
      if (outcome.kind !== 'value') {
        return commandFailure<CancellationReceipt>(EVIDENCE_COMMANDS.cancelCapture, outcome);
      }
      if (!validCancellationReceipt(outcome.value)) {
        const error = deepFreeze({
          code: 'RECEIPT_INVALID' as const,
          command: EVIDENCE_COMMANDS.cancelCapture,
        });
        publish({ status: 'error', error });
        return errorResult<CancellationReceipt>(error);
      }
      const receipt = immutableClone(outcome.value as CancellationReceipt);
      publish({ status: 'ready', capture: null, error: null });
      return successResult(receipt);
    },
    async finishCapture(input: FinishCaptureInput) {
      const result = await invokeDocument(
        EVIDENCE_COMMANDS.finishCapture,
        'measurement-session',
        { request: input.request },
        input.signal,
      );
      if (result.ok) {
        publish({ status: 'ready', capture: result.value, error: null });
      }
      return result;
    },
    async compareSessions(input: CompareSessionsInput) {
      const result = await invokeDocument(
        EVIDENCE_COMMANDS.compareSessions,
        'comparison',
        { request: input.request },
        input.signal,
      );
      if (result.ok) {
        publish({ status: 'ready', comparison: result.value, error: null });
      }
      return result;
    },
    async renderReport(input: RenderReportInput) {
      const result = await invokeDocument(
        EVIDENCE_COMMANDS.renderReport,
        'evidence-report',
        { request: input.request },
        input.signal,
      );
      if (result.ok) {
        publish({ status: 'ready', report: result.value, error: null });
      }
      return result;
    },
    async exportReport(input: ExportReportInput) {
      if (disposed) {
        return disposedResult<ExportReceipt>();
      }
      const outcome = await invokeAbortable(
        invoke,
        EVIDENCE_COMMANDS.exportReport,
        { request: input.request },
        input.signal,
      );
      if (outcome.kind !== 'value') {
        return commandFailure<ExportReceipt>(EVIDENCE_COMMANDS.exportReport, outcome);
      }
      if (!validExportReceipt(outcome.value)) {
        return errorResult<ExportReceipt>({
          code: 'RECEIPT_INVALID',
          command: EVIDENCE_COMMANDS.exportReport,
        });
      }
      return successResult(immutableClone(outcome.value as ExportReceipt));
    },
    async readHealth(signal?: AbortSignal) {
      if (disposed) {
        return disposedResult<EvidenceHealth>();
      }
      const outcome = await invokeAbortable(
        invoke,
        EVIDENCE_COMMANDS.readHealth,
        undefined,
        signal,
      );
      if (outcome.kind !== 'value') {
        return commandFailure<EvidenceHealth>(EVIDENCE_COMMANDS.readHealth, outcome);
      }
      if (!validHealth(outcome.value)) {
        return errorResult<EvidenceHealth>({
          code: 'RECEIPT_INVALID',
          command: EVIDENCE_COMMANDS.readHealth,
        });
      }
      return successResult(immutableClone(outcome.value as EvidenceHealth));
    },
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      listeners.clear();
      snapshot = deepFreeze({ ...snapshot, status: 'disposed', revision: snapshot.revision + 1 });
    },
  });
};

export const createTauriEvidenceAuthority = (
  options: TauriEvidenceAuthorityOptions,
): EvidenceAuthority => createEvidenceAuthority('native', options.invoke);

export const createDeterministicEvidenceAuthority = (
  options: DeterministicEvidenceAuthorityOptions,
): EvidenceAuthority => createEvidenceAuthority('deterministic', options.invoke);
