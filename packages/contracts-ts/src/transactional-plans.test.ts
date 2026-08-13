import { describe, expect, it } from 'vitest';

import invalidCorpus from './fixtures/transactional-plans/invalid.json' with { type: 'json' };
import validCorpus from './fixtures/transactional-plans/valid.json' with { type: 'json' };
import {
  transactionalRecoveryDocumentValidator,
  type TransactionalRecoveryDocument,
} from './generated/index.js';

interface CorpusCase {
  readonly id: string;
  readonly document?: unknown;
  readonly baseId?: string;
  readonly mutation?: CorpusMutation;
}

interface CorpusMutation {
  readonly op: 'set' | 'remove' | 'append';
  readonly path: string;
  readonly value?: unknown;
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
  return sequence === 0
    ? previousSequence === undefined
    : typeof sequence === 'number' &&
        typeof previousSequence === 'number' &&
        previousSequence === sequence - 1;
};

const validatesTransactionalDocument = (
  document: unknown,
): document is TransactionalRecoveryDocument =>
  transactionalRecoveryDocumentValidator(document) && hasContiguousProgress(document);

const validCases = validCorpus.cases as readonly (CorpusCase & { readonly document: unknown })[];
const invalidCases = invalidCorpus.cases as readonly CorpusCase[];
const validDocuments = new Map(validCases.map(({ id, document }) => [id, document]));

const pointerSegments = (pointer: string): readonly string[] => {
  if (!pointer.startsWith('/')) throw new Error(`Invalid corpus pointer: ${pointer}`);
  return pointer
    .slice(1)
    .split('/')
    .map((segment) => segment.replaceAll('~1', '/').replaceAll('~0', '~'));
};

const materializeCase = ({ id, document, baseId, mutation }: CorpusCase): unknown => {
  if (document !== undefined) return document;
  if (baseId === undefined || mutation === undefined) {
    throw new Error(`Corpus case ${id} has neither a document nor a base mutation.`);
  }

  const base = validDocuments.get(baseId);
  if (base === undefined) throw new Error(`Corpus case ${id} references missing base ${baseId}.`);
  const mutated = structuredClone(base);
  const segments = pointerSegments(mutation.path);
  const leaf = segments.at(-1);
  if (leaf === undefined) throw new Error(`Corpus case ${id} has an empty mutation path.`);

  let parent: unknown = mutated;
  for (const segment of segments.slice(0, -1)) {
    if (Array.isArray(parent)) parent = parent[Number(segment)];
    else if (typeof parent === 'object' && parent !== null) {
      parent = (parent as Record<string, unknown>)[segment];
    } else throw new Error(`Corpus case ${id} cannot traverse ${mutation.path}.`);
  }

  if (mutation.op === 'append') {
    const target =
      Array.isArray(parent) && /^\d+$/u.test(leaf)
        ? parent[Number(leaf)]
        : typeof parent === 'object' && parent !== null
          ? (parent as Record<string, unknown>)[leaf]
          : undefined;
    if (!Array.isArray(target)) throw new Error(`Corpus case ${id} append target is not an array.`);
    target.push(mutation.value);
  } else if (Array.isArray(parent)) {
    const index = Number(leaf);
    if (mutation.op === 'remove') parent.splice(index, 1);
    else parent[index] = mutation.value;
  } else if (typeof parent === 'object' && parent !== null) {
    if (mutation.op === 'remove') delete (parent as Record<string, unknown>)[leaf];
    else (parent as Record<string, unknown>)[leaf] = mutation.value;
  } else throw new Error(`Corpus case ${id} mutation parent is not a container.`);

  return mutated;
};

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

  it.each(invalidCases)('rejects $id', (corpusCase) => {
    expect(validatesTransactionalDocument(materializeCase(corpusCase))).toBe(false);
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
        'installation-manifest',
        'artifact-manifest',
        'friends-roster',
        'physical-run-config',
        'physical-continuation',
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
