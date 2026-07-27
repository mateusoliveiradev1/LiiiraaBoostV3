import { describe, expect, it } from 'vitest';

import {
  DIAGNOSTIC_VALUE_SCHEMA_ID,
  validateDiagnosticValue,
  type DiagnosticValueJson,
} from '@liiiraa/contracts-ts';
import invalidCorpus from '../../../contracts/corpus/invalid/rejection-vectors.json' with { type: 'json' };
import validCorpus from '../../../contracts/corpus/valid/provenance-vectors.json' with { type: 'json' };

describe('public diagnostic value validator', () => {
  it.each(validCorpus.vectors)('accepts $id through the package root', (vector) => {
    const result = validateDiagnosticValue(vector.schema, vector.payload);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const transport: DiagnosticValueJson = result.value;
      expect(transport).toEqual(vector.payload);
    }
  });

  it.each(invalidCorpus.vectors)('rejects $id through the package root', (vector) => {
    const result = validateDiagnosticValue(vector.schema, vector.payload);

    expect(result.ok).toBe(false);
  });

  it('returns bounded structural errors without payload values', () => {
    const secret = 'SENSITIVE_PAYLOAD_VALUE_MUST_NOT_LEAK';
    const result = validateDiagnosticValue(DIAGNOSTIC_VALUE_SCHEMA_ID, {
      kind: 'unavailable',
      reason: 'SYNTHETIC reason',
      unexpected: secret,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.issues.length).toBeGreaterThan(0);
      expect(result.error.issues.length).toBeLessThanOrEqual(8);
      expect(
        result.error.issues.every(
          (issue) => issue.path.length <= 256 && issue.keyword.length <= 64,
        ),
      ).toBe(true);
      expect(JSON.stringify(result.error)).not.toContain(secret);
    }
  });
});
