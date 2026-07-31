import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  PUBLICATION_GATE_NAMES,
  evaluateWebPublication,
  type PublicationGateName,
  type WebPublicationInput,
} from './publication.js';

const sha = (value: string): string => createHash('sha256').update(value).digest('hex');

const hashInput = (input: WebPublicationInput): string => sha(JSON.stringify(input));

const coherentPublication = (mode: 'planned' | 'final' = 'planned'): WebPublicationInput => {
  const buildId = 'web-build-2026-07-31';
  const contentId = 'web-content-2026-07-31';
  const routeIds = ['public-home', 'docs-index', 'releases-download'];
  const linkIds = ['public-home:docs-index', 'public-home:releases-download'];
  const artifactKinds = [
    'content',
    'routes',
    'release',
    'support',
    'assets',
    'screenshots',
    'channels',
    'policies',
    'evidence',
    'visual',
    'capture',
  ] as const;
  const state = mode === 'final' ? 'passed' : 'planned';
  const appState = mode === 'final' ? 'observed' : 'planned';
  const files = PUBLICATION_GATE_NAMES.map((name) => `quality/evidence/${name}.json`);
  const commands = PUBLICATION_GATE_NAMES.map((name) => `pnpm web:gate:${name}`);

  return {
    appArtifacts: (['public', 'account', 'admin'] as const).map((surface) => ({
      buildId,
      classification: 'production-build',
      contentId,
      hash: sha(`app:${surface}`),
      path: `apps/${surface === 'public' ? 'web' : surface}/.next/standalone`,
      state: appState,
      surface,
    })),
    artifacts: artifactKinds.map((kind) => ({
      buildId,
      contentId,
      hash: sha(`artifact:${kind}`),
      id: `${kind}-v1`,
      kind,
      path: `manifests/${kind}.json`,
    })),
    asOf: '2026-07-31',
    bundle: {
      buildId,
      contentId,
      evidenceId: 'evidence-v1',
      policyId: 'policies-v1',
      releaseId: 'release-v1',
      routeId: 'routes-v1',
      screenshotId: 'screenshots-v1',
    },
    captures: (['pt-BR', 'en'] as const).map((locale) => ({
      approved: true,
      id: `desktop-home-${locale}`,
      imageHash: sha(`capture:${locale}`),
      locale,
      publicationBuildId: buildId,
      scenarioId: 'S01',
      sidecarHash: sha(`sidecar:${locale}`),
      sourceBuildId: 'desktop-production-3c7ebc475638',
    })),
    content: [
      {
        criticalCopyLocales: ['pt-BR', 'en'],
        evidenceIds: ['claim-policy-v1'],
        id: 'public-content',
        imageryLocales: ['pt-BR', 'en'],
        locales: ['pt-BR', 'en'],
        reviewBy: '2026-12-31',
        screenshotIds: ['desktop-home-pt-BR', 'desktop-home-en'],
        warningLocales: ['pt-BR', 'en'],
      },
    ],
    gates: PUBLICATION_GATE_NAMES.map((name, index) => ({
      command: commands[index]!,
      evidenceId: `${name}-evidence-v1`,
      file: files[index]!,
      name,
      state,
    })),
    mode,
    observedCommands: mode === 'final' ? commands : [],
    observedFiles:
      mode === 'final'
        ? [
            ...files,
            'apps/web/.next/standalone',
            'apps/account/.next/standalone',
            'apps/admin/.next/standalone',
          ]
        : [],
    qualityManifests: (['WEB-01', 'WEB-02', 'WEB-03', 'WEB-08'] as const).map(
      (requirement) => ({
        featureId: `${requirement.toLowerCase()}-phase-03`,
        hash: sha(`quality:${requirement}`),
        owner: 'plan-03-32',
        requirement,
        state,
      }),
    ),
    releaseTruth: {
      developmentArtifactDetected: false,
      downloadAvailable: false,
      officialArtifact: 'unavailable',
      previewAuthorityConnected: {
        account: false,
        admin: false,
        public: false,
      },
      publicDistributionApproved: false,
    },
    routeParity: {
      canonicalLinkIds: linkIds,
      canonicalRouteIds: routeIds,
      emittedLinkIds: linkIds,
      emittedRouteIds: routeIds,
    },
    visuals: Array.from({ length: 18 }, (_, index) => {
      const scenarioId = `W${String(index + 1).padStart(2, '0')}`;
      return {
        hash: sha(`visual:${scenarioId}`),
        routeId: index < 9 ? 'public-home' : index < 13 ? 'docs-index' : 'releases-download',
        scenarioId,
        state,
      };
    }),
  };
};

const mutateGate = (
  input: WebPublicationInput,
  gateName: PublicationGateName,
): WebPublicationInput => ({
  ...input,
  gates: input.gates.map((gate) =>
    gate.name === gateName ? { ...gate, state: 'failed' as const } : gate,
  ),
});

describe('atomic publication', () => {
  it('admits one exact planned bundle without mutating its source artifacts', () => {
    const input = coherentPublication();
    const before = hashInput(input);

    expect(evaluateWebPublication(input)).toEqual({
      failures: [],
      fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/u),
      ok: true,
    });
    expect(hashInput(input)).toBe(before);
  });

  it.each(PUBLICATION_GATE_NAMES)(
    'blocks a failed %s gate with a stable dimension code',
    (gateName) => {
      const result = evaluateWebPublication(mutateGate(coherentPublication(), gateName));

      expect(result.ok).toBe(false);
      expect(result.failures).toContainEqual({
        code: `${gateName.toUpperCase()}_GATE_FAILED`,
        path: `$.gates.${gateName}.state`,
      });
    },
  );

  it.each([
    [
      'a missing manifest artifact',
      (input: WebPublicationInput) => ({ ...input, artifacts: input.artifacts.slice(1) }),
      'MISSING_CONTENT_ARTIFACT',
    ],
    [
      'a stale content record',
      (input: WebPublicationInput) => ({
        ...input,
        content: input.content.map((record) => ({ ...record, reviewBy: input.asOf })),
      }),
      'STALE_CONTENT',
    ],
    [
      'a mismatched artifact identity',
      (input: WebPublicationInput) => ({
        ...input,
        artifacts: input.artifacts.map((artifact) =>
          artifact.kind === 'routes' ? { ...artifact, buildId: 'stale-build' } : artifact,
        ),
      }),
      'ARTIFACT_COHERENCE_MISMATCH',
    ],
    [
      'an unlocalized critical field',
      (input: WebPublicationInput) => ({
        ...input,
        content: input.content.map((record) => ({ ...record, criticalCopyLocales: ['pt-BR'] })),
      }),
      'LOCALIZATION_INCOMPLETE',
    ],
    [
      'an unreviewed capture',
      (input: WebPublicationInput) => ({
        ...input,
        captures: input.captures.map((capture, index) =>
          index === 0 ? { ...capture, approved: false } : capture,
        ),
      }),
      'CAPTURE_NOT_APPROVED',
    ],
    [
      'a development build artifact',
      (input: WebPublicationInput) => ({
        ...input,
        appArtifacts: input.appArtifacts.map((artifact, index) =>
          index === 0 ? { ...artifact, classification: 'development' as const } : artifact,
        ),
      }),
      'DEVELOPMENT_ARTIFACT_REJECTED',
    ],
    [
      'an unsafe Phase 3 release truth',
      (input: WebPublicationInput) => ({
        ...input,
        releaseTruth: { ...input.releaseTruth, downloadAvailable: true },
      }),
      'PHASE_3_RELEASE_TRUTH_VIOLATION',
    ],
    [
      'route drift',
      (input: WebPublicationInput) => ({
        ...input,
        routeParity: { ...input.routeParity, emittedRouteIds: ['public-home'] },
      }),
      'ROUTE_PARITY_MISMATCH',
    ],
    [
      'a missing golden visual',
      (input: WebPublicationInput) => ({ ...input, visuals: input.visuals.slice(1) }),
      'GOLDEN_MATRIX_INCOMPLETE',
    ],
    [
      'a missing final quality manifest',
      (input: WebPublicationInput) => ({
        ...input,
        qualityManifests: input.qualityManifests.slice(1),
      }),
      'QUALITY_MANIFEST_SET_INCOMPLETE',
    ],
  ] as const)('blocks %s', (_name, mutate, expectedCode) => {
    const result = evaluateWebPublication(mutate(coherentPublication()));

    expect(result.ok).toBe(false);
    expect(result.failures.map(({ code }) => code)).toContain(expectedCode);
  });

  it('fails final mode closed when evidence and build observations are unresolved', () => {
    const planned = coherentPublication();
    const result = evaluateWebPublication({ ...planned, mode: 'final' });

    expect(result.ok).toBe(false);
    expect(result.failures.map(({ code }) => code)).toContain('GATE_NOT_FINAL');
    expect(result.failures.map(({ code }) => code)).toContain('BUILD_ARTIFACT_NOT_OBSERVED');
  });

  it('admits the same exact bundle in final mode only with passed observed evidence', () => {
    expect(evaluateWebPublication(coherentPublication('final')).ok).toBe(true);
  });
});
