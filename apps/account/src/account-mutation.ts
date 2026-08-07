export type AccountMutationPhase =
  | 'idle' | 'reviewing' | 'reauth' | 'confirming' | 'issuing' | 'pending'
  | 'conflict' | 'offline' | 'stale' | 'error' | 'complete';

export type AccountMutationEvent =
  | 'review' | 'require-reauth' | 'confirm' | 'issue' | 'pending'
  | 'conflict' | 'offline' | 'stale' | 'error' | 'complete';

const ACCOUNT_MUTATION_TRANSITIONS = Object.freeze({
  idle: Object.freeze({ review: 'reviewing' }),
  reviewing: Object.freeze({ 'require-reauth': 'reauth', confirm: 'confirming', issue: 'issuing' }),
  reauth: Object.freeze({ confirm: 'confirming' }),
  confirming: Object.freeze({ issue: 'issuing' }),
  issuing: Object.freeze({ complete: 'complete', conflict: 'conflict', error: 'error', offline: 'offline', pending: 'pending', stale: 'stale' }),
  pending: Object.freeze({ complete: 'complete', error: 'error', offline: 'offline', stale: 'stale' }),
  conflict: Object.freeze({ review: 'reviewing' }),
  offline: Object.freeze({ review: 'reviewing' }),
  stale: Object.freeze({ review: 'reviewing' }),
  error: Object.freeze({ review: 'reviewing' }),
  complete: Object.freeze({ review: 'reviewing' }),
} as const satisfies Readonly<Record<AccountMutationPhase, Readonly<Partial<Record<AccountMutationEvent, AccountMutationPhase>>>>>);

export const advanceAccountMutationPhase = (phase: AccountMutationPhase, event: AccountMutationEvent): AccountMutationPhase => {
  const next = ACCOUNT_MUTATION_TRANSITIONS[phase][event as keyof (typeof ACCOUNT_MUTATION_TRANSITIONS)[typeof phase]] as AccountMutationPhase | undefined;
  if (next === undefined) throw new Error(`ACCOUNT_MUTATION_TRANSITION_INVALID:${phase}:${event}`);
  return next;
};
