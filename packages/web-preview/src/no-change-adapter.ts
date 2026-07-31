import {
  validateWebDocument,
  webRoutes,
  type FutureAuthorityCommandJson,
  type NoChangeReceiptJson,
} from '@liiiraa/web-core';

import type { WebScenario } from './scenarios.js';

export const FUTURE_AUTHORITY_ACTION_FAMILIES = Object.freeze([
  'auth',
  'session',
  'billing',
  'device',
  'privacy',
  'support',
  'diagnostic',
  'consent',
  'admin',
] as const);

export type FutureAuthorityActionFamily =
  (typeof FUTURE_AUTHORITY_ACTION_FAMILIES)[number];

export type FutureAuthorityFailureCode =
  | 'ABORTED'
  | 'AUTHORITY_UNAVAILABLE'
  | 'CORRELATION_EXHAUSTED'
  | 'INVALID_COMMAND'
  | 'OFFLINE';

export type CancelledReceipt = Readonly<{
  authority: FutureAuthorityCommandJson;
  correlationId: string;
  nextPhase: 'Phase 4';
  provenance: WebScenario['provenance'];
  reason: 'user-cancelled';
  receiptKind: 'cancelled';
  remoteStateChanged: false;
  requestedAction: string;
  reviewedAt: string;
  reviewedInputs: readonly string[];
}>;

export type FutureAuthorityFailure = Readonly<{
  code: FutureAuthorityFailureCode;
  correlationId: string | null;
  kind: 'failure';
  nextPhase: 'Phase 4';
  remoteStateChanged: false;
}>;

export type FutureAuthorityResult =
  | Readonly<{ kind: 'no-change'; receipt: NoChangeReceiptJson }>
  | Readonly<{ kind: 'cancelled'; receipt: CancelledReceipt }>
  | FutureAuthorityFailure;

export type FutureAuthorityExecution = Readonly<{
  command: unknown;
  disposition: 'cancel' | 'confirm' | 'failure';
  failureCode?: Extract<
    FutureAuthorityFailureCode,
    'AUTHORITY_UNAVAILABLE' | 'OFFLINE'
  >;
  reviewedInputs: readonly string[];
  signal?: AbortSignal;
}>;

export interface FutureAuthorityPort {
  execute(input: FutureAuthorityExecution): Promise<FutureAuthorityResult>;
}

export type WebPreviewAuthorityOptions = Readonly<{
  clock: () => string;
  correlationIds: readonly string[];
  scenario: WebScenario;
}>;

const REVIEWED_IDENTIFIER_PATTERN =
  /^[a-z][a-z0-9.-]{0,118}-reviewed$/u;

const deepFreeze = <Value>(
  value: Value,
  visited = new Set<object>(),
): Readonly<Value> => {
  if (typeof value !== 'object' || value === null || visited.has(value)) {
    return value;
  }
  visited.add(value);
  for (const nested of Object.values(value)) {
    deepFreeze(nested, visited);
  }
  return Object.freeze(value);
};

const failure = (
  code: FutureAuthorityFailureCode,
  correlationId: string | null,
): FutureAuthorityFailure =>
  deepFreeze({
    kind: 'failure',
    code,
    correlationId,
    remoteStateChanged: false,
    nextPhase: 'Phase 4',
  });

const isAborted = (signal: AbortSignal | undefined): boolean =>
  signal?.aborted === true;

const isFutureAuthorityCommand = (
  value: unknown,
): value is FutureAuthorityCommandJson => {
  const validation = validateWebDocument(value);
  return (
    validation.ok &&
    typeof validation.value === 'object' &&
    validation.value !== null &&
    'phase' in validation.value &&
    validation.value.phase === 'Phase 4' &&
    'surface' in validation.value &&
    'command' in validation.value &&
    'description' in validation.value
  );
};

const commandFamily = (
  command: FutureAuthorityCommandJson,
): FutureAuthorityActionFamily | null => {
  const family = FUTURE_AUTHORITY_ACTION_FAMILIES.find(
    (candidate) => command.command === `${candidate}.review`,
  );
  return family ?? null;
};

const validateReviewedInputs = (
  reviewedInputs: readonly string[],
): reviewedInputs is readonly [string, ...string[]] =>
  reviewedInputs.length >= 1 &&
  reviewedInputs.length <= 32 &&
  new Set(reviewedInputs).size === reviewedInputs.length &&
  reviewedInputs.every((value) => REVIEWED_IDENTIFIER_PATTERN.test(value));

const safeAuthority = (
  command: FutureAuthorityCommandJson,
): FutureAuthorityCommandJson =>
  deepFreeze({
    phase: 'Phase 4',
    surface: command.surface,
    command: command.command,
    description: `Phase 4 ${command.surface} authority`,
  });

const requireClock = (clock: () => string): string => {
  const reviewedAt = clock();
  if (
    typeof reviewedAt !== 'string' ||
    !reviewedAt.endsWith('Z') ||
    Number.isNaN(Date.parse(reviewedAt))
  ) {
    throw new Error('Web preview authority clock must return UTC ISO-8601');
  }
  return reviewedAt;
};

const validateFactoryOptions = (options: WebPreviewAuthorityOptions): void => {
  if (
    options.correlationIds.length === 0 ||
    new Set(options.correlationIds).size !== options.correlationIds.length ||
    options.correlationIds.some(
      (correlationId) =>
        correlationId.length === 0 || correlationId.length > 128,
    )
  ) {
    throw new Error(
      'Web preview authority requires unique bounded correlation IDs',
    );
  }
  requireClock(options.clock);
};

export const createWebPreviewAuthority = (
  options: WebPreviewAuthorityOptions,
): FutureAuthorityPort => {
  validateFactoryOptions(options);
  const correlationIds = Object.freeze([...options.correlationIds]);
  const scenario = options.scenario;
  const scenarioSurface = webRoutes.find(
    ({ id }) => id === scenario.routeId,
  )?.surface;
  let correlationIndex = 0;

  const nextCorrelationId = (): string | null => {
    const correlationId = correlationIds[correlationIndex];
    correlationIndex += 1;
    return correlationId ?? null;
  };

  return deepFreeze({
    execute: async (
      input: FutureAuthorityExecution,
    ): Promise<FutureAuthorityResult> => {
      const correlationId = nextCorrelationId();
      if (correlationId === null) {
        return failure('CORRELATION_EXHAUSTED', null);
      }
      if (isAborted(input.signal)) {
        return failure('ABORTED', correlationId);
      }
      if (
        !isFutureAuthorityCommand(input.command) ||
        commandFamily(input.command) === null ||
        input.command.surface !== scenarioSurface ||
        !validateReviewedInputs(input.reviewedInputs)
      ) {
        return failure('INVALID_COMMAND', correlationId);
      }

      const reviewedAt = requireClock(options.clock);
      const authority = safeAuthority(input.command);
      const reviewedInputs = Object.freeze([...input.reviewedInputs]) as [
        string,
        ...string[],
      ];
      await Promise.resolve();
      if (isAborted(input.signal)) {
        return failure('ABORTED', correlationId);
      }

      if (input.disposition === 'cancel') {
        if (input.failureCode !== undefined) {
          return failure('INVALID_COMMAND', correlationId);
        }
        const receipt: CancelledReceipt = {
          receiptKind: 'cancelled',
          authority,
          requestedAction: authority.command,
          reviewedInputs,
          reviewedAt,
          correlationId,
          provenance: scenario.provenance,
          reason: 'user-cancelled',
          remoteStateChanged: false,
          nextPhase: 'Phase 4',
        };
        return deepFreeze({
          kind: 'cancelled',
          receipt,
        });
      }

      if (input.disposition === 'failure') {
        if (input.failureCode === undefined) {
          return failure('INVALID_COMMAND', correlationId);
        }
        return failure(input.failureCode, correlationId);
      }

      if (input.failureCode !== undefined) {
        return failure('INVALID_COMMAND', correlationId);
      }

      const receipt: NoChangeReceiptJson = {
        receiptVersion: '1.0',
        authority,
        requestedAction: authority.command,
        reviewedInputs,
        reviewedAt,
        correlationId,
        provenance: scenario.provenance,
        remoteStateChanged: false,
        nextPhase: 'Phase 4',
      };
      if (!validateWebDocument(receipt).ok) {
        return failure('INVALID_COMMAND', correlationId);
      }

      return deepFreeze({
        kind: 'no-change',
        receipt,
      });
    },
  });
};
