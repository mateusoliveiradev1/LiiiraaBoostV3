import { describe, expect, test } from 'vitest';

import {
  GENERATED_SCHEMA_PATH,
  emitSpikeSchema,
  readPersistedSchema,
  validateSpikeVectors,
} from './run-spike.ts';

const TYPESPEC_COMPILATION_TIMEOUT_MS = 30_000;

describe('schema semantics', () => {
  test(
    'emits a closed reusable envelope with five provenance discriminators and bounds',
    async () => {
      const evidence = await emitSpikeSchema();
      const schemaText = await readPersistedSchema();
      const schema = JSON.parse(schemaText) as Record<string, unknown>;

      expect(evidence.representation).toBe('reusable-envelope');
      expect(evidence.provenanceKinds).toEqual(['ai', 'benchmark', 'profile', 'system', 'user']);
      expect(evidence.closedObjectCount).toBeGreaterThanOrEqual(8);
      expect(evidence.minimum).toBe(0);
      expect(evidence.maximum).toBe(100);
      expect(evidence.minItems).toBe(1);
      expect(evidence.maxItems).toBe(3);
      expect(schema).toHaveProperty('$defs.SpikeEnvelope');
      expect(
        GENERATED_SCHEMA_PATH.replaceAll('\\', '/').endsWith(
          'tooling/contract-generation-spike/generated/spike.schema.json',
        ),
      ).toBe(true);
    },
    TYPESPEC_COMPILATION_TIMEOUT_MS,
  );
});

describe('schema determinism', () => {
  test(
    'writes byte-identical output across repeated generation',
    async () => {
      await emitSpikeSchema();
      const first = await readPersistedSchema();
      await emitSpikeSchema();
      const second = await readPersistedSchema();

      expect(second).toBe(first);
      expect(first.endsWith('\n')).toBe(true);
    },
    TYPESPEC_COMPILATION_TIMEOUT_MS,
  );
});

describe('persisted schema vectors', () => {
  test(
    'accepts every valid vector and rejects every invalid vector',
    async () => {
      const evidence = await validateSpikeVectors();

      expect(evidence.representation).toBe('reusable-envelope');
      expect(evidence.validCases).toEqual([
        'system provenance',
        'benchmark provenance',
        'user provenance',
        'profile provenance',
        'ai provenance',
      ]);
      expect(evidence.invalidCases).toEqual([
        'unknown version',
        'unknown envelope kind',
        'unknown provenance kind',
        'extra envelope field',
        'extra provenance field',
        'missing metadata',
        'confidence below minimum',
        'confidence above maximum',
        'empty samples',
        'too many samples',
      ]);
      expect(evidence.generatedTypeScript).toContain('export type ProvenanceJson =');
      for (const kind of ['system', 'benchmark', 'user', 'profile', 'ai']) {
        expect(evidence.generatedTypeScript).toContain(`kind: '${kind}'`);
      }
      expect(evidence.generatedTypeScript).toContain("version: '1'");
      expect(evidence.generatedTypeScript).toContain("kind: 'spike'");
    },
    TYPESPEC_COMPILATION_TIMEOUT_MS,
  );
});
