/// <reference lib="dom" />

import {
  validateWebDocument,
  type FutureAuthorityCommandJson,
  type NoChangeReceiptJson,
} from '@liiiraa/web-core';
import { assign, fromPromise, setup } from 'xstate';

export const PREVIEW_ACTION_FAMILIES = Object.freeze([
  'auth',
  'social',
  'passkey',
  'mfa',
  'session',
  'billing',
  'device',
  'privacy',
  'support',
  'diagnostic',
  'consent',
  'admin',
] as const);

export type PreviewActionFamily = (typeof PREVIEW_ACTION_FAMILIES)[number];
export type PreviewSurface = Extract<FutureAuthorityCommandJson['surface'], 'account' | 'admin'>;
export type PreviewRole = 'account-holder' | 'support' | 'security' | 'operations';
export type PreviewFreshness = 'current' | 'stale';
export type PreviewFailureCode =
  | 'ABORTED'
  | 'AUTHORITY_UNAVAILABLE'
  | 'CORRELATION_EXHAUSTED'
  | 'INVALID_COMMAND'
  | 'OFFLINE';

export interface PreviewConfirmationMetadata {
  readonly kind: 'button' | 'phrase' | 'ambiguous';
  readonly label: Readonly<Record<'en' | 'pt-BR', string>>;
  readonly value: Readonly<Record<'en' | 'pt-BR', string>>;
}

export interface PreviewActionPolicy {
  readonly authority: 'Phase 4';
  readonly confirmation: PreviewConfirmationMetadata;
  readonly requiresConsent: boolean;
  readonly requiresDesktopViewport: boolean;
  readonly requiresImpact: boolean;
  readonly requiresPurpose: boolean;
  readonly requiresReauthentication: boolean;
  readonly requiresRole: boolean;
}

const policy = (
  confirmation: PreviewConfirmationMetadata,
  requirements: Partial<Omit<PreviewActionPolicy, 'authority' | 'confirmation'>> = {},
): PreviewActionPolicy =>
  Object.freeze({
    authority: 'Phase 4',
    confirmation,
    requiresConsent: false,
    requiresDesktopViewport: false,
    requiresImpact: false,
    requiresPurpose: false,
    requiresReauthentication: true,
    requiresRole: false,
    ...requirements,
  });

const buttonConfirmation = (
  ptBR: string,
  en: string,
): PreviewConfirmationMetadata =>
  Object.freeze({
    kind: 'button',
    label: Object.freeze({ en, 'pt-BR': ptBR }),
    value: Object.freeze({ en, 'pt-BR': ptBR }),
  });

const phraseConfirmation = (
  ptBR: string,
  en: string,
): PreviewConfirmationMetadata =>
  Object.freeze({
    kind: 'phrase',
    label: Object.freeze({ en, 'pt-BR': ptBR }),
    value: Object.freeze({ en, 'pt-BR': ptBR }),
  });

export const PREVIEW_ACTION_POLICIES = Object.freeze({
  auth: policy(buttonConfirmation('Revisar entrada', 'Review sign in'), {
    requiresReauthentication: false,
  }),
  social: policy(buttonConfirmation('Revisar provedor social', 'Review social provider'), {
    requiresReauthentication: false,
  }),
  passkey: policy(buttonConfirmation('Revisar chave de acesso', 'Review passkey')),
  mfa: policy(buttonConfirmation('Revisar MFA', 'Review MFA')),
  session: policy(buttonConfirmation('Revogar sessão', 'Revoke session'), {
    requiresImpact: true,
  }),
  billing: policy(buttonConfirmation('Revisar cobrança', 'Review billing'), {
    requiresImpact: true,
  }),
  device: policy(buttonConfirmation('Revogar dispositivo', 'Revoke device'), {
    requiresImpact: true,
  }),
  privacy: policy(phraseConfirmation('ENVIAR SOLICITAÇÃO DE PRIVACIDADE', 'SUBMIT PRIVACY REQUEST'), {
    requiresConsent: true,
    requiresImpact: true,
    requiresPurpose: true,
  }),
  support: policy(buttonConfirmation('Compartilhar dados de suporte', 'Share support data'), {
    requiresConsent: true,
    requiresImpact: true,
    requiresPurpose: true,
  }),
  diagnostic: policy(
    phraseConfirmation('REVISAR ACESSO DE DIAGNÓSTICO', 'REVIEW DIAGNOSTIC ACCESS'),
    {
      requiresConsent: true,
      requiresDesktopViewport: true,
      requiresImpact: true,
      requiresPurpose: true,
      requiresRole: true,
    },
  ),
  consent: policy(buttonConfirmation('Revisar consentimento', 'Review consent'), {
    requiresConsent: true,
    requiresImpact: true,
    requiresPurpose: true,
  }),
  admin: policy(buttonConfirmation('Revisar ação administrativa', 'Review admin action'), {
    requiresConsent: true,
    requiresDesktopViewport: true,
    requiresImpact: true,
    requiresPurpose: true,
    requiresRole: true,
  }),
} satisfies Readonly<Record<PreviewActionFamily, PreviewActionPolicy>>);

export const PREVIEW_WORKFLOW_STATES = Object.freeze([
  'editing',
  'validating',
  'validation-error',
  'reviewing',
  'reauth-preview',
  'confirming',
  'issuing',
  'offline',
  'stale',
  'expired-session',
  'partial-failure',
  'cancelled',
  'complete',
] as const);

export type PreviewWorkflowState = (typeof PREVIEW_WORKFLOW_STATES)[number];

export const PREVIEW_WORKFLOW_TRANSITIONS = Object.freeze({
  editing: Object.freeze(['SUBMIT', 'GO_OFFLINE', 'MARK_STALE', 'EXPIRE_SESSION', 'CANCEL']),
  validating: Object.freeze([
    'VALIDATION_PASSED',
    'VALIDATION_FAILED',
    'GO_OFFLINE',
    'MARK_STALE',
    'EXPIRE_SESSION',
    'CANCEL',
  ]),
  'validation-error': Object.freeze([
    'EDIT_FIELD',
    'EDIT_PURPOSE',
    'EDIT_IMPACT',
    'SUBMIT',
    'GO_OFFLINE',
    'MARK_STALE',
    'EXPIRE_SESSION',
    'CANCEL',
  ]),
  reviewing: Object.freeze([
    'EDIT',
    'REVIEW',
    'GO_OFFLINE',
    'MARK_STALE',
    'EXPIRE_SESSION',
    'CANCEL',
  ]),
  'reauth-preview': Object.freeze([
    'REAUTHENTICATED',
    'REAUTHENTICATION_FAILED',
    'CANCEL',
    'EXPIRE_SESSION',
  ]),
  confirming: Object.freeze([
    'CONFIRM',
    'EDIT',
    'GO_OFFLINE',
    'MARK_STALE',
    'EXPIRE_SESSION',
    'CANCEL',
  ]),
  issuing: Object.freeze(['CANCEL']),
  offline: Object.freeze(['RETRY', 'CANCEL']),
  stale: Object.freeze(['REFRESH', 'CANCEL']),
  'expired-session': Object.freeze(['RESUME_SESSION', 'CANCEL']),
  'partial-failure': Object.freeze(['RETRY', 'CANCEL']),
  cancelled: Object.freeze([]),
  complete: Object.freeze([]),
} satisfies Readonly<Record<PreviewWorkflowState, readonly string[]>>);

export interface PreviewAction {
  readonly family: PreviewActionFamily;
  readonly id: string;
  readonly objectLabel: string;
  readonly surface: PreviewSurface;
}

export interface PreviewConsent {
  readonly expiresAt: string;
  readonly granted: boolean;
  readonly permittedFields: readonly string[];
  readonly purpose: string;
  readonly requestingActor: string;
}

export interface PreviewReviewItem {
  readonly after: string;
  readonly before: string;
  readonly field: string;
  readonly label: string;
}

export interface PreviewViewport {
  readonly width: number;
}

export interface PreviewWorkflowInput {
  readonly action: PreviewAction;
  readonly consent?: PreviewConsent | null;
  readonly fields: Readonly<Record<string, string>>;
  readonly freshness?: PreviewFreshness;
  readonly impact?: string;
  readonly purpose?: string;
  readonly requiredFields: readonly string[];
  readonly review: readonly PreviewReviewItem[];
  readonly role?: PreviewRole | null;
  readonly safeDraftFields: readonly string[];
  readonly viewport: PreviewViewport;
}

export interface PreviewValidationError {
  readonly field: string;
  readonly messageId: string;
}

export interface PreviewCancellationReceipt {
  readonly authority: FutureAuthorityCommandJson;
  readonly correlationId: string;
  readonly nextPhase: 'Phase 4';
  readonly reason: 'user-cancelled';
  readonly receiptKind: 'cancelled';
  readonly remoteStateChanged: false;
  readonly requestedAction: string;
  readonly reviewedAt: string;
  readonly reviewedInputs: readonly string[];
}

export interface FutureAuthorityExecution {
  readonly command: unknown;
  readonly disposition: 'cancel' | 'confirm' | 'failure';
  readonly failureCode?: Extract<
    PreviewFailureCode,
    'AUTHORITY_UNAVAILABLE' | 'OFFLINE'
  >;
  readonly reviewedInputs: readonly string[];
  readonly signal?: AbortSignal;
}

export type FutureAuthorityResult =
  | Readonly<{ readonly kind: 'no-change'; readonly receipt: NoChangeReceiptJson }>
  | Readonly<{
      readonly kind: 'cancelled';
      readonly receipt: PreviewCancellationReceipt;
    }>
  | Readonly<{
      readonly code: PreviewFailureCode;
      readonly correlationId: string | null;
      readonly kind: 'failure';
      readonly nextPhase: 'Phase 4';
      readonly remoteStateChanged: false;
    }>;

/**
 * Structural port implemented by the deterministic preview adapter. Keeping this
 * browser-safe contract here prevents preview runtime code entering production.
 */
export interface FutureAuthorityPort {
  execute(input: FutureAuthorityExecution): Promise<FutureAuthorityResult>;
}

export interface PreviewWorkflowDependencies {
  readonly authority: FutureAuthorityPort;
  readonly clock: () => string;
  readonly correlationId: () => string;
}

export interface PreviewWorkflowContext {
  readonly action: PreviewAction;
  readonly confirmation: PreviewConfirmationMetadata;
  readonly consent: PreviewConsent | null;
  readonly failureCode: PreviewFailureCode | null;
  readonly fields: Readonly<Record<string, string>>;
  readonly freshness: PreviewFreshness;
  readonly impact: string;
  readonly purpose: string;
  readonly receipt: NoChangeReceiptJson | null;
  readonly cancellation: PreviewCancellationReceipt | null;
  readonly requiredFields: readonly string[];
  readonly review: readonly PreviewReviewItem[];
  readonly role: PreviewRole | null;
  readonly safeDraft: Readonly<Record<string, string>>;
  readonly safeDraftFields: readonly string[];
  readonly validationErrors: readonly PreviewValidationError[];
  readonly viewport: PreviewViewport;
}

export type PreviewWorkflowEvent =
  | Readonly<{ readonly field: string; readonly type: 'EDIT_FIELD'; readonly value: string }>
  | Readonly<{ readonly type: 'EDIT_PURPOSE'; readonly value: string }>
  | Readonly<{ readonly type: 'EDIT_IMPACT'; readonly value: string }>
  | Readonly<{ readonly type: 'EDIT' }>
  | Readonly<{ readonly type: 'SUBMIT' }>
  | Readonly<{ readonly type: 'VALIDATION_PASSED' }>
  | Readonly<{
      readonly errors: readonly PreviewValidationError[];
      readonly type: 'VALIDATION_FAILED';
    }>
  | Readonly<{ readonly type: 'REVIEW' }>
  | Readonly<{ readonly type: 'REAUTHENTICATED' }>
  | Readonly<{ readonly type: 'REAUTHENTICATION_FAILED' }>
  | Readonly<{ readonly confirmation: string; readonly type: 'CONFIRM' }>
  | Readonly<{ readonly type: 'GO_OFFLINE' }>
  | Readonly<{ readonly type: 'MARK_STALE' }>
  | Readonly<{ readonly type: 'EXPIRE_SESSION' }>
  | Readonly<{ readonly code: PreviewFailureCode; readonly type: 'FAIL' }>
  | Readonly<{ readonly type: 'RETRY' }>
  | Readonly<{ readonly type: 'REFRESH' }>
  | Readonly<{ readonly type: 'RESUME_SESSION' }>
  | Readonly<{ readonly type: 'CANCEL' }>;

export type PreviewWorkflowOutput =
  | Readonly<{
      readonly kind: 'no-change';
      readonly receipt: NoChangeReceiptJson;
      readonly remoteStateChanged: false;
    }>
  | Readonly<{
      readonly kind: 'cancelled';
      readonly receipt: PreviewCancellationReceipt;
      readonly remoteStateChanged: false;
    }>;

export interface PreviewStateProjection {
  readonly canCancel: boolean;
  readonly canConfirm: boolean;
  readonly canRetry: boolean;
  readonly isBlocking: boolean;
  readonly state: PreviewWorkflowState;
  readonly validationErrors: readonly PreviewValidationError[];
}

interface AuthorityActorInput {
  readonly context: PreviewWorkflowContext;
}

const nonEmpty = (value: string | undefined): boolean =>
  value !== undefined && value.trim().length > 0;

const safeIdentifier = (value: string): boolean =>
  /^[a-z][a-z0-9.-]{0,118}$/u.test(value);

const commandFor = (context: PreviewWorkflowContext): FutureAuthorityCommandJson => ({
  command: context.action.id,
  description: `Phase 4 ${context.action.surface} authority for ${context.action.objectLabel}`,
  phase: 'Phase 4',
  surface: context.action.surface,
});

const reviewedInputsFor = (context: PreviewWorkflowContext): readonly string[] => {
  const fields = context.requiredFields.length > 0 ? context.requiredFields : ['action'];
  return Object.freeze(
    fields.map((field) => `${safeIdentifier(field) ? field : 'field'}-reviewed`),
  );
};

const safeDraftFrom = (input: PreviewWorkflowInput): Readonly<Record<string, string>> =>
  Object.freeze(
    Object.fromEntries(
      input.safeDraftFields.flatMap((field) => {
        const value = input.fields[field];
        return value === undefined ? [] : [[field, value]];
      }),
    ),
  );

const contextFromInput = (input: PreviewWorkflowInput): PreviewWorkflowContext => ({
  action: Object.freeze({ ...input.action }),
  cancellation: null,
  confirmation: PREVIEW_ACTION_POLICIES[input.action.family].confirmation,
  consent: input.consent === undefined || input.consent === null
    ? null
    : Object.freeze({
        ...input.consent,
        permittedFields: Object.freeze([...input.consent.permittedFields]),
      }),
  failureCode: null,
  fields: Object.freeze({ ...input.fields }),
  freshness: input.freshness ?? 'current',
  impact: input.impact ?? '',
  purpose: input.purpose ?? '',
  receipt: null,
  requiredFields: Object.freeze([...input.requiredFields]),
  review: Object.freeze(input.review.map((item) => Object.freeze({ ...item }))),
  role: input.role ?? null,
  safeDraft: safeDraftFrom(input),
  safeDraftFields: Object.freeze([...input.safeDraftFields]),
  validationErrors: Object.freeze([]),
  viewport: Object.freeze({ ...input.viewport }),
});

const validateContext = (
  context: PreviewWorkflowContext,
  now: string,
): readonly PreviewValidationError[] => {
  const errors: PreviewValidationError[] = [];
  const policyForAction = PREVIEW_ACTION_POLICIES[context.action.family];

  for (const field of context.requiredFields) {
    if (!nonEmpty(context.fields[field])) {
      errors.push({ field, messageId: 'preview.validation.required' });
    }
  }
  if (policyForAction.requiresPurpose && !nonEmpty(context.purpose)) {
    errors.push({ field: 'purpose', messageId: 'preview.validation.purpose-required' });
  }
  if (policyForAction.requiresImpact && !nonEmpty(context.impact)) {
    errors.push({ field: 'impact', messageId: 'preview.validation.impact-required' });
  }
  if (policyForAction.requiresRole && context.role === null) {
    errors.push({ field: 'role', messageId: 'preview.validation.role-required' });
  }
  if (policyForAction.requiresDesktopViewport && context.viewport.width < 960) {
    errors.push({ field: 'viewport', messageId: 'preview.validation.desktop-required' });
  }
  if (context.freshness !== 'current') {
    errors.push({ field: 'freshness', messageId: 'preview.validation.stale' });
  }
  if (policyForAction.requiresConsent) {
    const expiresAt = context.consent?.expiresAt;
    const validExpiration =
      expiresAt !== undefined &&
      !Number.isNaN(Date.parse(expiresAt)) &&
      Date.parse(expiresAt) > Date.parse(now);
    if (
      context.consent?.granted !== true ||
      !nonEmpty(context.consent.purpose) ||
      !nonEmpty(context.consent.requestingActor) ||
      context.consent.permittedFields.length === 0 ||
      !validExpiration
    ) {
      errors.push({ field: 'consent', messageId: 'preview.validation.consent-required' });
    }
  }

  return Object.freeze(errors.map((error) => Object.freeze(error)));
};

const isNoChangeResult = (
  value: FutureAuthorityResult,
): value is Extract<FutureAuthorityResult, { readonly kind: 'no-change' }> =>
  value.kind === 'no-change' &&
  value.receipt.remoteStateChanged === false &&
  value.receipt.nextPhase === 'Phase 4' &&
  validateWebDocument(value.receipt).ok;

const failureCodeFor = (value: FutureAuthorityResult): PreviewFailureCode =>
  value.kind === 'failure' ? value.code : 'INVALID_COMMAND';

const confirmationMatches = (
  context: PreviewWorkflowContext,
  event: PreviewWorkflowEvent,
): boolean => {
  if (event.type !== 'CONFIRM' || context.confirmation.kind === 'ambiguous') {
    return false;
  }
  return Object.values(context.confirmation.value).includes(event.confirmation);
};

const cancellationFor = (
  context: PreviewWorkflowContext,
  dependencies: PreviewWorkflowDependencies,
): PreviewCancellationReceipt =>
  Object.freeze({
    authority: Object.freeze(commandFor(context)),
    correlationId: dependencies.correlationId(),
    nextPhase: 'Phase 4',
    reason: 'user-cancelled',
    receiptKind: 'cancelled',
    remoteStateChanged: false,
    requestedAction: context.action.id,
    reviewedAt: dependencies.clock(),
    reviewedInputs: reviewedInputsFor(context),
  });

const commonInterruptions = {
  CANCEL: {
    actions: 'recordCancellation',
    target: 'cancelled',
  },
  EXPIRE_SESSION: {
    actions: 'recordExpiredSession',
    target: 'expired-session',
  },
  FAIL: {
    actions: 'assignAuthorityFailure',
    target: 'partial-failure',
  },
  GO_OFFLINE: {
    actions: 'recordOffline',
    target: 'offline',
  },
  MARK_STALE: {
    actions: 'markStale',
    target: 'stale',
  },
} as const;

export const createPreviewWorkflowMachine = (
  dependencies: PreviewWorkflowDependencies,
) => {
  const authorityActor = fromPromise<FutureAuthorityResult, AuthorityActorInput>(
    ({ input, signal }) =>
      dependencies.authority.execute({
        command: commandFor(input.context),
        disposition: 'confirm',
        reviewedInputs: reviewedInputsFor(input.context),
        signal,
      }),
  );

  return setup({
    types: {
      context: {} as PreviewWorkflowContext,
      events: {} as PreviewWorkflowEvent,
      input: {} as PreviewWorkflowInput,
      output: {} as PreviewWorkflowOutput,
    },
    actors: {
      issuePreview: authorityActor,
    },
    actions: {
      applyImpactEdit: assign(({ context, event }) =>
        event.type === 'EDIT_IMPACT'
          ? {
              ...context,
              impact: event.value,
              validationErrors: Object.freeze([]),
            }
          : context,
      ),
      applyFieldEdit: assign(({ context, event }) => {
        if (event.type !== 'EDIT_FIELD') {
          return context;
        }
        const fields = Object.freeze({ ...context.fields, [event.field]: event.value });
        const safeDraft = context.safeDraftFields.includes(event.field)
          ? Object.freeze({ ...context.safeDraft, [event.field]: event.value })
          : context.safeDraft;
        return {
          ...context,
          fields,
          safeDraft,
          validationErrors: Object.freeze([]),
        };
      }),
      applyPurposeEdit: assign(({ context, event }) =>
        event.type === 'EDIT_PURPOSE'
          ? {
              ...context,
              purpose: event.value,
              validationErrors: Object.freeze([]),
            }
          : context,
      ),
      assignAuthorityFailure: assign(({ context, event }) =>
        event.type === 'FAIL'
          ? { ...context, failureCode: event.code }
          : context,
      ),
      assignValidationErrors: assign(({ context, event }) => ({
        ...context,
        validationErrors:
          event.type === 'VALIDATION_FAILED'
            ? Object.freeze([...event.errors])
            : validateContext(context, dependencies.clock()),
      })),
      clearFailure: assign(({ context }) => ({
        ...context,
        failureCode: null,
      })),
      markCurrent: assign(({ context }) => ({
        ...context,
        failureCode: null,
        freshness: 'current' as const,
      })),
      markStale: assign(({ context }) => ({
        ...context,
        failureCode: null,
        freshness: 'stale' as const,
      })),
      recordCancellation: assign(({ context }) => ({
        ...context,
        cancellation: cancellationFor(context, dependencies),
      })),
      recordExpiredSession: assign(({ context }) => ({
        ...context,
        failureCode: 'AUTHORITY_UNAVAILABLE' as const,
      })),
      recordOffline: assign(({ context }) => ({
        ...context,
        failureCode: 'OFFLINE' as const,
      })),
      recordResultFailure: assign(({ context }) => ({
        ...context,
        failureCode: 'AUTHORITY_UNAVAILABLE',
      })),
    },
    guards: {
      confirmationMatches: ({ context, event }) =>
        validateContext(context, dependencies.clock()).length === 0 &&
        confirmationMatches(context, event),
      validationPasses: ({ context }) =>
        validateContext(context, dependencies.clock()).length === 0,
    },
  }).createMachine({
    id: 'preview-workflow',
    initial: 'editing',
    context: ({ input }) => contextFromInput(input),
    output: ({ context }) => {
      if (context.receipt !== null) {
        return Object.freeze({
          kind: 'no-change',
          receipt: context.receipt,
          remoteStateChanged: false,
        });
      }
      if (context.cancellation === null) {
        throw new Error('Preview workflow reached a final state without a closed output');
      }
      return Object.freeze({
        kind: 'cancelled',
        receipt: context.cancellation,
        remoteStateChanged: false,
      });
    },
    states: {
      editing: {
        on: {
          ...commonInterruptions,
          EDIT_FIELD: {
            actions: 'applyFieldEdit',
          },
          EDIT_IMPACT: {
            actions: 'applyImpactEdit',
          },
          EDIT_PURPOSE: {
            actions: 'applyPurposeEdit',
          },
          SUBMIT: 'validating',
        },
      },
      validating: {
        on: {
          ...commonInterruptions,
          VALIDATION_FAILED: {
            actions: 'assignValidationErrors',
            target: 'validation-error',
          },
          VALIDATION_PASSED: [
            {
              guard: 'validationPasses',
              target: 'reviewing',
            },
            {
              actions: 'assignValidationErrors',
              target: 'validation-error',
            },
          ],
        },
      },
      'validation-error': {
        on: {
          ...commonInterruptions,
          EDIT_FIELD: {
            actions: 'applyFieldEdit',
            target: 'editing',
          },
          EDIT_IMPACT: {
            actions: 'applyImpactEdit',
            target: 'editing',
          },
          EDIT_PURPOSE: {
            actions: 'applyPurposeEdit',
            target: 'editing',
          },
          SUBMIT: 'validating',
        },
      },
      reviewing: {
        on: {
          ...commonInterruptions,
          EDIT: 'editing',
          REVIEW: 'reauth-preview',
        },
      },
      'reauth-preview': {
        on: {
          CANCEL: {
            actions: 'recordCancellation',
            target: 'cancelled',
          },
          EXPIRE_SESSION: {
            actions: 'recordExpiredSession',
            target: 'expired-session',
          },
          REAUTHENTICATED: 'confirming',
          REAUTHENTICATION_FAILED: {
            actions: 'recordResultFailure',
            target: 'partial-failure',
          },
        },
      },
      confirming: {
        on: {
          ...commonInterruptions,
          CONFIRM: {
            guard: 'confirmationMatches',
            target: 'issuing',
          },
          EDIT: 'editing',
        },
      },
      issuing: {
        invoke: {
          id: 'issuePreview',
          input: ({ context }) => ({ context }),
          onDone: [
            {
              actions: assign(({ context, event }) => ({
                ...context,
                failureCode: null,
                receipt: isNoChangeResult(event.output)
                  ? Object.freeze(event.output.receipt)
                  : null,
              })),
              guard: ({ event }) => isNoChangeResult(event.output),
              target: 'complete',
            },
            {
              actions: assign(({ context, event }) => ({
                ...context,
                failureCode: failureCodeFor(event.output),
              })),
              target: 'partial-failure',
            },
          ],
          onError: {
            actions: assign(({ context }) => ({
              ...context,
              failureCode: 'AUTHORITY_UNAVAILABLE' as const,
            })),
            target: 'partial-failure',
          },
          src: 'issuePreview',
        },
        on: {
          CANCEL: {
            actions: 'recordCancellation',
            target: 'cancelled',
          },
        },
      },
      offline: {
        on: {
          CANCEL: {
            actions: 'recordCancellation',
            target: 'cancelled',
          },
          RETRY: {
            actions: 'clearFailure',
            target: 'editing',
          },
        },
      },
      stale: {
        on: {
          CANCEL: {
            actions: 'recordCancellation',
            target: 'cancelled',
          },
          REFRESH: {
            actions: 'markCurrent',
            target: 'editing',
          },
        },
      },
      'expired-session': {
        on: {
          CANCEL: {
            actions: 'recordCancellation',
            target: 'cancelled',
          },
          RESUME_SESSION: {
            actions: 'clearFailure',
            target: 'editing',
          },
        },
      },
      'partial-failure': {
        on: {
          CANCEL: {
            actions: 'recordCancellation',
            target: 'cancelled',
          },
          RETRY: {
            actions: 'clearFailure',
            target: 'editing',
          },
        },
      },
      cancelled: {
        type: 'final',
      },
      complete: {
        type: 'final',
      },
    },
  });
};

export const selectPreviewState = (
  snapshot: Readonly<{ context: PreviewWorkflowContext; value: unknown }>,
): PreviewStateProjection => {
  const state = PREVIEW_WORKFLOW_STATES.includes(snapshot.value as PreviewWorkflowState)
    ? (snapshot.value as PreviewWorkflowState)
    : 'partial-failure';
  return Object.freeze({
    canCancel: state !== 'cancelled' && state !== 'complete',
    canConfirm: state === 'confirming',
    canRetry:
      state === 'offline' ||
      state === 'stale' ||
      state === 'expired-session' ||
      state === 'partial-failure',
    isBlocking:
      state === 'validation-error' ||
      state === 'offline' ||
      state === 'stale' ||
      state === 'expired-session' ||
      state === 'partial-failure',
    state,
    validationErrors: snapshot.context.validationErrors,
  });
};
