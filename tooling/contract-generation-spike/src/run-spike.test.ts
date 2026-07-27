import { describe, expect, test } from 'vitest';

import {
  GENERATED_SCHEMA_PATH,
  emitSpikeSchema,
  readPersistedSchema,
} from './run-spike.ts';

describe('schema semantics', () => {
  test('emits a closed reusable envelope with five provenance discriminators and bounds', async () => {
    const evidence = await emitSpikeSchema();
    const schemaText = await readPersistedSchema();
    const schema = JSON.parse(schemaText) as Record<string, unknown>;

    expect(evidence.representation).toBe('reusable-envelope');
    expect(evidence.provenanceKinds).toEqual([
      'ai',
      'benchmark',
      'profile',
      'system',
      'user',
    ]);
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
  });
});

describe('schema determinism', () => {
  test('writes byte-identical output across repeated generation', async () => {
    await emitSpikeSchema();
    const first = await readPersistedSchema();
    await emitSpikeSchema();
    const second = await readPersistedSchema();

    expect(second).toBe(first);
    expect(first.endsWith('\n')).toBe(true);
  });
});
