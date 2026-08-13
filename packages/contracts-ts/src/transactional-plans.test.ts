import { describe, expect, it } from 'vitest';

import invalidCorpus from './fixtures/transactional-plans/invalid.json' with { type: 'json' };
import validCorpus from './fixtures/transactional-plans/valid.json' with { type: 'json' };
import {
  transactionalRecoveryDocumentValidator,
  type TransactionalRecoveryDocument,
} from './generated/index.js';

interface CorpusCase {
  readonly id: string;
  readonly document: unknown;
}

const hasContiguousProgress = (document: unknown): boolean => {
  if (
    typeof document !== 'object' ||
    document === null ||
    !('kind' in document) ||
    document.kind !== 'progress-event'
  ) {
    return true;
  }

  const sequence = 'sequence' in document ? document.sequence : undefined;
  const previousSequence = 'previousSequence' in document ? document.previousSequence : undefined;
  return (
    sequence === 0
      ? previousSequence === undefined
      : typeof sequence === 'number' &&
        typeof previousSequence === 'number' &&
        previousSequence === sequence - 1
  );
};

const validatesTransactionalDocument = (document: unknown): document is TransactionalRecoveryDocument =>
  transactionalRecoveryDocumentValidator(document) && hasContiguousProgress(document);

const validCases = validCorpus.cases as readonly CorpusCase[];
const invalidCases = invalidCorpus.cases as readonly CorpusCase[];

describe('transactional recovery exact JSON corpus', () => {
  it.each(validCases)('accepts $id', ({ document }) => {
    expect(
      validatesTransactionalDocument(document),
      JSON.stringify(transactionalRecoveryDocumentValidator.errors),
    ).toBe(true);

    if (!validatesTransactionalDocument(document)) {
      throw new Error('Generated transactional validator rejected a valid corpus case.');
    }

    const typed: TransactionalRecoveryDocument = document;
    expect(typed.kind).toBe(document.kind);
  });

  it.each(invalidCases)('rejects $id', ({ document }) => {
    expect(validatesTransactionalDocument(document)).toBe(false);
  });

  it('covers every root document kind and every durable journal verdict', () => {
    const kinds = new Set(
      validCases.map(({ document }) =>
        typeof document === 'object' && document !== null && 'kind' in document
          ? document.kind
          : undefined,
      ),
    );
    expect(kinds).toEqual(
      new Set([
        'transactional-plan',
        'plan-approval',
        'plan-transaction',
        'recovery-checkpoint',
        'journal-event',
        'transaction-receipt',
        'progress-snapshot',
        'progress-event',
        'operation-promotion',
        'operation-revocation',
        'observe-power-scheme-request',
        'broker-observation-response',
        'redacted-diagnostic-export',
        'advanced-preference-projection',
        'advanced-preference-intent',
        'advanced-preference-event',
      ]),
    );

    const journalStates = validCases
      .map(({ document }) => document)
      .filter(
        (document): document is Record<string, unknown> =>
          typeof document === 'object' &&
          document !== null &&
          'kind' in document &&
          document.kind === 'journal-event',
      )
      .map(({ state }) => state);
    expect(new Set(journalStates)).toEqual(
      new Set([
        'prepared',
        'dispatch-returned',
        'observed',
        'verified',
        'not-applied',
        'unknown',
        'drift',
        'conflict',
        'restore-prepared',
        'restored',
      ]),
    );
  });
});
