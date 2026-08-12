import { invoke as tauriInvoke } from '@tauri-apps/api/core';

export type TelemetryMetricState = 'observed' | 'warming-up' | 'unavailable';

export interface LiveScalarMetric {
  readonly state: TelemetryMetricState;
  readonly value: number | null;
  readonly unit: 'percent' | 'milliseconds';
  readonly source: string;
  readonly detail: string;
  readonly reasonCode?: string;
}

export interface LiveMemoryMetric {
  readonly state: 'observed' | 'unavailable';
  readonly usedBytes: number | null;
  readonly totalBytes: number | null;
  readonly loadPercent: number | null;
  readonly source: string;
  readonly detail: string;
  readonly reasonCode?: string;
}

export interface LiveTelemetrySnapshot {
  readonly schemaVersion: '1.0';
  readonly readOnly: true;
  readonly cpu: LiveScalarMetric;
  readonly memory: LiveMemoryMetric;
  readonly gpu: LiveScalarMetric;
  readonly collectionLatency: LiveScalarMetric;
}

export type LiveTelemetryStatus = 'idle' | 'reading' | 'ready' | 'unavailable';

export interface LiveTelemetryAuthoritySnapshot {
  readonly revision: number;
  readonly status: LiveTelemetryStatus;
  readonly telemetry: LiveTelemetrySnapshot | null;
}

export type LiveTelemetryResult =
  | Readonly<{ ok: true; value: LiveTelemetrySnapshot }>
  | Readonly<{ ok: false; error: Readonly<{ code: 'COMMAND_FAILED' | 'CONTRACT_INVALID' }> }>;

export interface LiveTelemetryInvoke {
  (command: 'read_live_telemetry' | 'sample_measurement_capture'): Promise<unknown>;
}

export interface LiveTelemetryAuthority {
  snapshot(): LiveTelemetryAuthoritySnapshot;
  subscribe(listener: () => void): () => void;
  read(): Promise<LiveTelemetryResult>;
  sampleCapture(): Promise<LiveTelemetryResult>;
}

const ROOT_KEYS = ['collectionLatency', 'cpu', 'gpu', 'memory', 'readOnly', 'schemaVersion'];
const SCALAR_KEYS = ['detail', 'reasonCode', 'source', 'state', 'unit', 'value'];
const MEMORY_KEYS = [
  'detail',
  'loadPercent',
  'reasonCode',
  'source',
  'state',
  'totalBytes',
  'usedBytes',
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasOnlyKeys = (value: Record<string, unknown>, allowed: readonly string[]): boolean =>
  Object.keys(value).every((key) => allowed.includes(key)) &&
  allowed.filter((key) => key !== 'reasonCode').every((key) => Object.hasOwn(value, key));

const finiteWithin = (value: unknown, minimum: number, maximum: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum;

const validText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= 256;

const validScalar = (value: unknown, expectedUnit: 'percent' | 'milliseconds'): value is LiveScalarMetric => {
  if (!isRecord(value) || !hasOnlyKeys(value, SCALAR_KEYS)) return false;
  if (!['observed', 'warming-up', 'unavailable'].includes(String(value['state']))) return false;
  if (value['unit'] !== expectedUnit || !validText(value['source']) || !validText(value['detail'])) return false;
  if (value['state'] === 'observed') {
    const maximum = expectedUnit === 'percent' ? 100 : 10_000;
    return finiteWithin(value['value'], 0, maximum) && value['reasonCode'] === undefined;
  }
  return value['value'] === null && validText(value['reasonCode']);
};

const validMemory = (value: unknown): value is LiveMemoryMetric => {
  if (!isRecord(value) || !hasOnlyKeys(value, MEMORY_KEYS)) return false;
  if (!['observed', 'unavailable'].includes(String(value['state']))) return false;
  if (!validText(value['source']) || !validText(value['detail'])) return false;
  if (value['state'] === 'unavailable') {
    return value['usedBytes'] === null && value['totalBytes'] === null && value['loadPercent'] === null && validText(value['reasonCode']);
  }
  return (
    finiteWithin(value['usedBytes'], 0, Number.MAX_SAFE_INTEGER) &&
    finiteWithin(value['totalBytes'], 1, Number.MAX_SAFE_INTEGER) &&
    value['usedBytes'] <= value['totalBytes'] &&
    finiteWithin(value['loadPercent'], 0, 100) &&
    value['reasonCode'] === undefined
  );
};

const validSnapshot = (value: unknown): value is LiveTelemetrySnapshot =>
  isRecord(value) &&
  hasOnlyKeys(value, ROOT_KEYS) &&
  value['schemaVersion'] === '1.0' &&
  value['readOnly'] === true &&
  validScalar(value['cpu'], 'percent') &&
  validMemory(value['memory']) &&
  validScalar(value['gpu'], 'percent') &&
  validScalar(value['collectionLatency'], 'milliseconds');

const freezeSnapshot = (value: LiveTelemetrySnapshot): LiveTelemetrySnapshot =>
  Object.freeze({
    ...value,
    cpu: Object.freeze({ ...value.cpu }),
    memory: Object.freeze({ ...value.memory }),
    gpu: Object.freeze({ ...value.gpu }),
    collectionLatency: Object.freeze({ ...value.collectionLatency }),
  });

export const createTauriLiveTelemetryAuthority = ({
  invoke = (command) => tauriInvoke(command),
}: Readonly<{ invoke?: LiveTelemetryInvoke }> = {}): LiveTelemetryAuthority => {
  const listeners = new Set<() => void>();
  let snapshot: LiveTelemetryAuthoritySnapshot = Object.freeze({ revision: 0, status: 'idle', telemetry: null });

  const publish = (status: LiveTelemetryStatus, telemetry = snapshot.telemetry): void => {
    snapshot = Object.freeze({ revision: snapshot.revision + 1, status, telemetry });
    for (const listener of listeners) listener();
  };

  const execute = async (
    command: 'read_live_telemetry' | 'sample_measurement_capture',
  ): Promise<LiveTelemetryResult> => {
    publish('reading');
    let value: unknown;
    try {
      value = await invoke(command);
    } catch {
      publish('unavailable');
      return Object.freeze({ ok: false, error: Object.freeze({ code: 'COMMAND_FAILED' }) });
    }
    if (!validSnapshot(value)) {
      publish('unavailable');
      return Object.freeze({ ok: false, error: Object.freeze({ code: 'CONTRACT_INVALID' }) });
    }
    const telemetry = freezeSnapshot(value);
    publish('ready', telemetry);
    return Object.freeze({ ok: true, value: telemetry });
  };

  return Object.freeze({
    snapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    read: () => execute('read_live_telemetry'),
    sampleCapture: () => execute('sample_measurement_capture'),
  });
};
