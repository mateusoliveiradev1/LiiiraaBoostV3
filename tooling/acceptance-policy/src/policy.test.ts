import { describe, expect, it } from 'vitest';

import {
  evaluateQualityManifest,
  parsePolicyMode,
  QUALITY_DIMENSIONS,
  type QualityDimension,
  type QualityPolicyContext,
} from './policy.ts';

const commandFor = (dimension: QualityDimension): string =>
  `pnpm --filter @liiiraa/example test -- --run ${dimension}`;

const fileFor = (dimension: QualityDimension): string =>
  `packages/example/src/${dimension}.test.ts`;

const testedDimension = (dimension: QualityDimension) => ({
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

const validManifest = () => ({
  schemaVersion: 1,
  featureId: 'quality-policy',
  requirements: ['FOUND-06'],
  owner: 'quality-team',
  acceptance: Object.fromEntries(
    QUALITY_DIMENSIONS.map((dimension) => [dimension, testedDimension(dimension)]),
  ),
});

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
      delete manifest.acceptance.security.evidence[0]?.[field];

      expectOnlyCode(manifest, 'MANIFEST_SCHEMA_INVALID');
    },
  );

  it('rejects wildcard evidence paths with a stable dimension reason', () => {
    const manifest = validManifest();
    manifest.acceptance.security.evidence[0]!.file = 'packages/**/security.test.ts';

    expectOnlyCode(manifest, 'EVIDENCE_PATH_NOT_EXACT');
  });

  it('rejects watch-mode commands with a stable dimension reason', () => {
    const manifest = validManifest();
    manifest.acceptance.security.evidence[0]!.command =
      'pnpm --filter @liiiraa/example test --watch';

    expectOnlyCode(manifest, 'EVIDENCE_COMMAND_NOT_TERMINATING');
  });

  it('rejects duplicate evidence identifiers across dimensions', () => {
    const manifest = validManifest();
    manifest.acceptance.privacy.evidence[0]!.id =
      manifest.acceptance.security.evidence[0]!.id;

    expectOnlyCode(manifest, 'DUPLICATE_EVIDENCE_ID');
  });

  it('rejects evidence owned by anyone other than the manifest owner', () => {
    const manifest = validManifest();
    manifest.acceptance.security.evidence[0]!.owner = 'other-team';

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
    manifest.acceptance.privacy = {
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
    } as never;
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
      delete manifest.acceptance.privacy.exemption[field];

      expectOnlyCode(manifest, 'MANIFEST_SCHEMA_INVALID');
    },
  );

  it('rejects exemption reviewed only by its owner', () => {
    const manifest = exemptPrivacy();
    manifest.acceptance.privacy.exemption.reviewer = manifest.owner;

    expectOnlyCode(manifest, 'UNACCOUNTABLE_EXEMPTION');
  });

  it('rejects stale exemption reopening triggers', () => {
    const manifest = exemptPrivacy();
    manifest.acceptance.privacy.exemption.reopeningTrigger.reviewBy = '2026-07-26';

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
