import { describe, expect, it } from 'vitest';

import omissionMatrix from '../fixtures/omission-matrix.json' with { type: 'json' };
import {
  evaluateQualityManifest,
  parsePolicyMode,
  QUALITY_DIMENSIONS,
  type QualityDimension,
  type QualityPolicyContext,
} from './policy.ts';

interface EvidenceFixture {
  id: string;
  command: string;
  file: string;
  owner: string;
  status: 'planned' | 'passed';
}

interface TestedDimensionFixture {
  status: 'tested';
  evidence: EvidenceFixture[];
}

interface ExemptDimensionFixture {
  status: 'not_applicable';
  exemption: {
    rationale: string;
    residualRisk: string;
    reviewer: string;
    reopeningTrigger: {
      condition: string;
      reviewBy: string;
    };
  };
}

interface ManifestFixture {
  schemaVersion: number;
  featureId: string;
  requirements: string[];
  owner: string;
  acceptance: Partial<
    Record<QualityDimension, TestedDimensionFixture | ExemptDimensionFixture>
  >;
}

const commandFor = (dimension: QualityDimension): string =>
  `pnpm --filter @liiiraa/example test -- --run ${dimension}`;

const fileFor = (dimension: QualityDimension): string =>
  `packages/example/src/${dimension}.test.ts`;

const testedDimension = (dimension: QualityDimension): TestedDimensionFixture => ({
  status: 'tested',
  evidence: [
    {
      id: `${dimension}-evidence`,
      command: commandFor(dimension),
      file: fileFor(dimension),
      owner: 'quality-team',
      status: 'passed',
    },
  ],
});

const validManifest = (): ManifestFixture => ({
  schemaVersion: 1,
  featureId: 'quality-policy',
  requirements: ['FOUND-06'],
  owner: 'quality-team',
  acceptance: Object.fromEntries(
    QUALITY_DIMENSIONS.map((dimension) => [dimension, testedDimension(dimension)]),
  ),
});

const exemptionDimension = (reviewer = 'independent-reviewer'): ExemptDimensionFixture => ({
  status: 'not_applicable',
  exemption: {
    rationale: 'This quality dimension does not apply to the bounded feature.',
    residualRisk: 'A future boundary change could make this dimension applicable.',
    reviewer,
    reopeningTrigger: {
      condition: 'Reopen when this feature crosses a new data or runtime boundary.',
      reviewBy: '2027-07-27',
    },
  },
});

const stagedManifest = (status: 'planned' | 'passed'): ManifestFixture => {
  const manifest = validManifest();
  tested(manifest, 'security').evidence[0]!.status = status;
  for (const dimension of QUALITY_DIMENSIONS.filter((value) => value !== 'security')) {
    manifest.acceptance[dimension] = exemptionDimension();
  }
  return manifest;
};

const tested = (
  manifest: ManifestFixture,
  dimension: QualityDimension,
): TestedDimensionFixture => {
  const value = manifest.acceptance[dimension];
  if (value?.status !== 'tested') {
    throw new Error(`Expected tested fixture for ${dimension}.`);
  }
  return value;
};

const exempted = (
  manifest: ManifestFixture,
  dimension: QualityDimension,
): ExemptDimensionFixture => {
  const value = manifest.acceptance[dimension];
  if (value?.status !== 'not_applicable') {
    throw new Error(`Expected exemption fixture for ${dimension}.`);
  }
  return value;
};

const context = (overrides: Partial<QualityPolicyContext> = {}): QualityPolicyContext => ({
  mode: 'planned',
  knownRequirements: ['FOUND-06'],
  requiredRequirements: ['FOUND-06'],
  asOf: '2026-07-27',
  ...overrides,
});

const expectOnlyCode = (input: unknown, expectedCode: string): void => {
  const result = evaluateQualityManifest(input, context());

  expect(result.ok).toBe(false);
  expect(result.diagnostics).toHaveLength(1);
  expect(result.diagnostics[0]?.code).toBe(expectedCode);
};

describe('quality manifest schema and dimension policy', () => {
  it('accepts a schema-complete manifest with every required dimension', () => {
    expect(evaluateQualityManifest(validManifest(), context())).toEqual({
      ok: true,
      diagnostics: [],
    });
  });

  it.each(QUALITY_DIMENSIONS)('rejects schema omission of the %s dimension', (dimension) => {
    const manifest = validManifest();
    delete manifest.acceptance[dimension];

    expectOnlyCode(manifest, 'MANIFEST_SCHEMA_INVALID');
  });

  it.each(['command', 'file', 'owner', 'status'] as const)(
    'requires exact tested evidence field %s',
    (field) => {
      const manifest = validManifest();
      delete (tested(manifest, 'security').evidence[0] as
        | Partial<EvidenceFixture>
        | undefined)?.[field];

      expectOnlyCode(manifest, 'MANIFEST_SCHEMA_INVALID');
    },
  );

  it('rejects wildcard evidence paths with a stable dimension reason', () => {
    const manifest = validManifest();
    tested(manifest, 'security').evidence[0]!.file = 'packages/**/security.test.ts';

    expectOnlyCode(manifest, 'EVIDENCE_PATH_NOT_EXACT');
  });

  it('rejects watch-mode commands with a stable dimension reason', () => {
    const manifest = validManifest();
    tested(manifest, 'security').evidence[0]!.command =
      'pnpm --filter @liiiraa/example test --watch';

    expectOnlyCode(manifest, 'EVIDENCE_COMMAND_NOT_TERMINATING');
  });

  it('rejects duplicate evidence identifiers across dimensions', () => {
    const manifest = validManifest();
    tested(manifest, 'privacy').evidence[0]!.id = tested(
      manifest,
      'security',
    ).evidence[0]!.id;

    expectOnlyCode(manifest, 'DUPLICATE_EVIDENCE_ID');
  });

  it('rejects evidence owned by anyone other than the manifest owner', () => {
    const manifest = validManifest();
    tested(manifest, 'security').evidence[0]!.owner = 'other-team';

    expectOnlyCode(manifest, 'EVIDENCE_OWNER_MISMATCH');
  });

  it('rejects unknown requirements before accepting dimension evidence', () => {
    const manifest = validManifest();
    manifest.requirements = ['UNKNOWN-01'];

    expectOnlyCode(manifest, 'UNKNOWN_REQUIREMENT');
  });
});

describe('accountable exemption policy', () => {
  const exemptPrivacy = () => {
    const manifest = validManifest();
    manifest.acceptance['privacy'] = {
      status: 'not_applicable',
      exemption: {
        rationale: 'No personal information crosses this feature boundary.',
        residualRisk: 'Future telemetry could introduce personal information.',
        reviewer: 'privacy-reviewer',
        reopeningTrigger: {
          condition: 'Reopen when telemetry or user identifiers are introduced.',
          reviewBy: '2027-07-27',
        },
      },
    };
    return manifest;
  };

  it('accepts a bounded, independently reviewed exemption', () => {
    expect(evaluateQualityManifest(exemptPrivacy(), context())).toEqual({
      ok: true,
      diagnostics: [],
    });
  });

  it.each(['rationale', 'residualRisk', 'reviewer', 'reopeningTrigger'] as const)(
    'rejects schema exemption missing %s',
    (field) => {
      const manifest = exemptPrivacy();
      delete (exempted(manifest, 'privacy').exemption as Partial<
        ExemptDimensionFixture['exemption']
      >)[field];

      expectOnlyCode(manifest, 'MANIFEST_SCHEMA_INVALID');
    },
  );

  it('rejects exemption reviewed only by its owner', () => {
    const manifest = exemptPrivacy();
    exempted(manifest, 'privacy').exemption.reviewer = manifest.owner;

    expectOnlyCode(manifest, 'UNACCOUNTABLE_EXEMPTION');
  });

  it('rejects stale exemption reopening triggers', () => {
    const manifest = exemptPrivacy();
    exempted(manifest, 'privacy').exemption.reopeningTrigger.reviewBy = '2026-07-26';

    expectOnlyCode(manifest, 'STALE_REOPENING_TRIGGER');
  });
});

describe('explicit policy mode parsing', () => {
  it('requires --mode planned or --mode final rather than inferring a mode', () => {
    expect(() => parsePolicyMode([])).toThrowError('Missing required --mode planned|final.');
    expect(parsePolicyMode(['--mode', 'planned'])).toBe('planned');
    expect(parsePolicyMode(['--mode', 'final'])).toBe('final');
  });
});

describe('planned and final omission matrix', () => {
  it.each(omissionMatrix.omissionCases)(
    'planned mode rejects omission case $id with one stable reason',
    (fixture) => {
      const manifest = validManifest();
      const dimension = fixture.dimension as QualityDimension;

      if (fixture.kind === 'omit-dimension') {
        delete manifest.acceptance[dimension];
      } else {
        manifest.acceptance[dimension] = exemptionDimension(manifest.owner);
      }

      const result = evaluateQualityManifest(manifest, context({ mode: 'planned' }));
      expect(result.diagnostics.map(({ code }) => code)).toEqual(fixture.expectedCodes);
      expect(result.ok).toBe(false);
    },
  );

  it.each(omissionMatrix.transitionStages)(
    '$id proves the planned/final transition policy',
    (fixture) => {
      const manifest = stagedManifest(fixture.evidenceStatus as 'planned' | 'passed');
      const evidence = tested(manifest, 'security').evidence[0]!;
      const policyContext = {
        ...context(),
        mode: fixture.mode,
        availableFiles: fixture.resolveFile ? [evidence.file] : [],
        availableCommands: fixture.resolveCommand ? [evidence.command] : [],
      } as unknown as QualityPolicyContext;

      const result = evaluateQualityManifest(manifest, policyContext);
      expect(result.diagnostics.map(({ code }) => code)).toEqual(fixture.expectedCodes);
      expect(result.ok).toBe(fixture.expectedCodes.length === 0);
    },
  );

  it('planned and final fixture groups execute exact non-vacuous case counts', () => {
    expect(omissionMatrix.omissionCases).toHaveLength(
      omissionMatrix.expectedCounts.omissionCases,
    );
    expect(omissionMatrix.transitionStages).toHaveLength(
      omissionMatrix.expectedCounts.transitionStages,
    );
    expect(
      omissionMatrix.omissionCases.length + omissionMatrix.transitionStages.length,
    ).toBe(omissionMatrix.expectedCounts.totalCases);
    expect(omissionMatrix.expectedCounts.omissionCases).toBe(6);
    expect(omissionMatrix.expectedCounts.transitionStages).toBeGreaterThan(0);
  });

  it('planned mode still requires complete requirement coverage', () => {
    const manifest = validManifest();
    manifest.requirements = [];

    const result = evaluateQualityManifest(manifest, context({ mode: 'planned' }));
    expect(result.diagnostics.map(({ code }) => code)).toEqual([
      'MANIFEST_SCHEMA_INVALID',
    ]);
  });
});
