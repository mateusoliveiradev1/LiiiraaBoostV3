import { describe, expect, it } from 'vitest';

import {
  inspectReleaseEvidence,
  inspectWorkspaceReadiness,
  type ReleaseEvidence,
} from './web-evidence-harness.js';

const completeReleaseEvidence = (): ReleaseEvidence => ({
  artifact: {
    channel: 'stable',
    classification: 'public-signed',
    digest: 'a'.repeat(64),
    version: '1.0.0',
  },
  bypassAllowed: false,
  integrityStatus: 'verified',
  manifest: {
    channel: 'stable',
    evidenceIds: ['signature', 'sha256', 'release-notes'],
    version: '1.0.0',
  },
});

describe('web evidence harness self-test: release gate', () => {
  it('accepts a complete isolated release fixture', () => {
    expect(inspectReleaseEvidence(completeReleaseEvidence())).toEqual({
      diagnostics: [],
      ok: true,
    });
  });

  it.each([
    [
      'missing release evidence',
      (fixture: ReleaseEvidence) => ({
        ...fixture,
        manifest: { ...fixture.manifest, evidenceIds: [] },
      }),
      'MISSING_RELEASE_EVIDENCE',
    ],
    [
      'development artifact',
      (fixture: ReleaseEvidence) => ({
        ...fixture,
        artifact: { ...fixture.artifact, classification: 'development' as const },
      }),
      'DEVELOPMENT_ARTIFACT_REJECTED',
    ],
    [
      'release version mismatch',
      (fixture: ReleaseEvidence) => ({
        ...fixture,
        artifact: { ...fixture.artifact, version: '0.9.0' },
      }),
      'RELEASE_MISMATCH',
    ],
    [
      'release channel mismatch',
      (fixture: ReleaseEvidence) => ({
        ...fixture,
        artifact: { ...fixture.artifact, channel: 'beta' },
      }),
      'RELEASE_MISMATCH',
    ],
    [
      'integrity mismatch',
      (fixture: ReleaseEvidence) => ({ ...fixture, integrityStatus: 'mismatch' as const }),
      'INTEGRITY_MISMATCH',
    ],
    [
      'download bypass',
      (fixture: ReleaseEvidence) => ({ ...fixture, bypassAllowed: true }),
      'RELEASE_BYPASS_REJECTED',
    ],
  ] as const)('detects %s with a stable diagnostic', (_name, mutate, expectedCode) => {
    expect(inspectReleaseEvidence(mutate(completeReleaseEvidence())).diagnostics[0]?.code).toBe(
      expectedCode,
    );
  });
});

describe('workspace readiness: release gate', () => {
  it('fails closed for omitted WEB-03 release evidence', () => {
    const result = inspectWorkspaceReadiness({
      requirement: 'WEB-03',
      repositoryRoot: 'Z:/isolated-empty-workspace',
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics.map(({ code }) => code)).toContain('MISSING_BUILD_ROOT');
  });
});
