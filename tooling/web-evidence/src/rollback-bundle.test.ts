import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  createApprovedWebBundle,
  resolveWebRollback,
  type ApprovedWebBundle,
} from './rollback-bundle.js';
import {
  PUBLICATION_GATE_NAMES,
  evaluateWebPublication,
  type WebPublicationInput,
} from './publication.js';

const sha = (value: string): string => createHash('sha256').update(value).digest('hex');

const finalPublication = (): WebPublicationInput => {
  const buildId = 'web-build-approved-v1';
  const contentId = 'web-content-approved-v1';
  const routes = ['public-home', 'docs-index', 'releases-download'];
  const links = ['public-home:docs-index', 'public-home:releases-download'];
  const observedFiles = [
    ...PUBLICATION_GATE_NAMES.map((name) => `quality/evidence/${name}.json`),
    'apps/web/.next/standalone',
    'apps/account/.next/standalone',
    'apps/admin/.next/standalone',
  ];

  return {
    appArtifacts: (['public', 'account', 'admin'] as const).map((surface) => ({
      buildId,
      classification: 'production-build',
      contentId,
      hash: sha(`app:${surface}`),
      path: `apps/${surface === 'public' ? 'web' : surface}/.next/standalone`,
      state: 'observed',
      surface,
    })),
    artifacts: (
      [
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
      ] as const
    ).map((kind) => ({
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
      sourceBuildId: 'desktop-production-approved-v1',
    })),
    content: [
      {
        criticalCopyLocales: ['pt-BR', 'en'],
        evidenceIds: ['claim-evidence'],
        id: contentId,
        imageryLocales: ['pt-BR', 'en'],
        locales: ['pt-BR', 'en'],
        reviewBy: '2027-12-31',
        screenshotIds: ['desktop-home-pt-BR', 'desktop-home-en'],
        warningLocales: ['pt-BR', 'en'],
      },
    ],
    gates: PUBLICATION_GATE_NAMES.map((name) => ({
      command: `pnpm web:gate:${name}`,
      evidenceId: `${name}-evidence-v1`,
      file: `quality/evidence/${name}.json`,
      name,
      state: 'passed',
    })),
    mode: 'final',
    observedCommands: PUBLICATION_GATE_NAMES.map((name) => `pnpm web:gate:${name}`),
    observedFiles,
    qualityManifests: (['WEB-01', 'WEB-02', 'WEB-03', 'WEB-08'] as const).map(
      (requirement) => ({
        featureId: `${requirement.toLowerCase()}-final`,
        hash: sha(`quality:${requirement}`),
        owner: 'plan-03-32',
        requirement,
        state: 'passed',
      }),
    ),
    releaseTruth: {
      developmentArtifactDetected: false,
      downloadAvailable: false,
      officialArtifact: 'unavailable',
      previewAuthorityConnected: { account: false, admin: false, public: false },
      publicDistributionApproved: false,
    },
    routeParity: {
      canonicalLinkIds: links,
      canonicalRouteIds: routes,
      emittedLinkIds: links,
      emittedRouteIds: routes,
    },
    visuals: Array.from({ length: 18 }, (_, index) => {
      const scenarioId = `W${String(index + 1).padStart(2, '0')}`;
      return {
        hash: sha(`visual:${scenarioId}`),
        routeId: routes[index % routes.length] ?? 'public-home',
        scenarioId,
        state: 'passed',
      };
    }),
  };
};

const approvedBundle = (): ApprovedWebBundle => {
  const input = finalPublication();
  const publication = evaluateWebPublication(input);
  const result = createApprovedWebBundle({
    approvedAt: '2026-07-31T13:30:00.000Z',
    commit: '0123456789abcdef0123456789abcdef01234567',
    input,
    publication,
  });
  if (!result.ok) throw new Error(`Fixture approval failed: ${JSON.stringify(result.failures)}`);
  return result.bundle;
};

const cloneBundle = (
  bundle: ApprovedWebBundle,
  overrides: Partial<ApprovedWebBundle>,
): ApprovedWebBundle => ({ ...bundle, ...overrides });

describe('approved web rollback', () => {
  it('creates a deeply immutable record bound to exact final publication approval', () => {
    const bundle = approvedBundle();

    expect(bundle.finalApproved).toBe(true);
    expect(bundle.bundleHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(Object.isFrozen(bundle)).toBe(true);
    expect(Object.isFrozen(bundle.appArtifacts)).toBe(true);
    expect(Object.isFrozen(bundle.manifestHashes)).toBe(true);
    expect(bundle.appArtifacts.map(({ surface }) => surface)).toEqual([
      'public',
      'account',
      'admin',
    ]);
  });

  it('resolves exactly one prior approved bundle into deployment inputs only', () => {
    const bundle = approvedBundle();
    const before = sha(JSON.stringify(bundle));
    const result = resolveWebRollback({
      approvedBundles: [bundle],
      currentCommit: 'ffffffffffffffffffffffffffffffffffffffff',
      rollbackExternalData: false,
      rollbackMigrations: false,
      targetCommit: bundle.commit,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.operation).toBe('redeploy-approved-web-bundle');
      expect(result.plan.appArtifacts).toHaveLength(3);
      expect(result.plan.externalStatePolicy).toEqual({
        databases: 'excluded',
        externalData: 'excluded',
        migrations: 'excluded',
      });
      expect('execute' in result.plan).toBe(false);
    }
    expect(sha(JSON.stringify(bundle))).toBe(before);
  });

  it.each([
    [
      'tampered manifest hash',
      (bundle: ApprovedWebBundle) =>
        cloneBundle(bundle, {
          manifestHashes: { ...bundle.manifestHashes, routes: sha('tampered') },
        }),
      'BUNDLE_INTEGRITY_MISMATCH',
    ],
    [
      'missing application',
      (bundle: ApprovedWebBundle) =>
        cloneBundle(bundle, { appArtifacts: bundle.appArtifacts.slice(1) }),
      'APP_ARTIFACT_SET_INCOMPLETE',
    ],
    [
      'mixed build identity',
      (bundle: ApprovedWebBundle) =>
        cloneBundle(bundle, {
          appArtifacts: bundle.appArtifacts.map((artifact, index) =>
            index === 0 ? { ...artifact, buildId: 'foreign-build' } : artifact,
          ),
        }),
      'MIXED_BUNDLE_VERSION',
    ],
    [
      'unapproved target',
      (bundle: ApprovedWebBundle) => cloneBundle(bundle, { finalApproved: false }),
      'TARGET_NOT_APPROVED',
    ],
  ] as const)('rejects a %s bundle', (_name, mutate, expectedCode) => {
    const target = mutate(approvedBundle());
    const result = resolveWebRollback({
      approvedBundles: [target],
      currentCommit: 'ffffffffffffffffffffffffffffffffffffffff',
      rollbackExternalData: false,
      rollbackMigrations: false,
      targetCommit: target.commit,
    });

    expect(result.ok).toBe(false);
    expect(result.failures.map(({ code }) => code)).toContain(expectedCode);
  });

  it('rejects any request to revert external data or migrations', () => {
    const bundle = approvedBundle();
    const result = resolveWebRollback({
      approvedBundles: [bundle],
      currentCommit: 'ffffffffffffffffffffffffffffffffffffffff',
      rollbackExternalData: true,
      rollbackMigrations: true,
      targetCommit: bundle.commit,
    });

    expect(result.ok).toBe(false);
    expect(result.failures.map(({ code }) => code)).toContain(
      'EXTERNAL_STATE_ROLLBACK_REJECTED',
    );
  });

  it('rejects the latest faulty deployment and a target absent from approval history', () => {
    const bundle = approvedBundle();
    const currentResult = resolveWebRollback({
      approvedBundles: [bundle],
      currentCommit: bundle.commit,
      rollbackExternalData: false,
      rollbackMigrations: false,
      targetCommit: bundle.commit,
    });
    const absentResult = resolveWebRollback({
      approvedBundles: [bundle],
      currentCommit: 'ffffffffffffffffffffffffffffffffffffffff',
      rollbackExternalData: false,
      rollbackMigrations: false,
      targetCommit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    });

    expect(currentResult.ok).toBe(false);
    expect(currentResult.failures.map(({ code }) => code)).toContain(
      'CURRENT_DEPLOYMENT_REJECTED',
    );
    expect(absentResult.ok).toBe(false);
    expect(absentResult.failures.map(({ code }) => code)).toContain(
      'APPROVED_BUNDLE_NOT_FOUND',
    );
  });

  it('refuses to create approval from planned or forged evaluator output', () => {
    const finalInput = finalPublication();
    const plannedInput = { ...finalInput, mode: 'planned' as const };
    const planned = evaluateWebPublication(plannedInput);
    const forged = { failures: [], fingerprint: sha('forged'), ok: true as const };

    const plannedResult = createApprovedWebBundle({
      approvedAt: '2026-07-31T13:30:00.000Z',
      commit: '0123456789abcdef0123456789abcdef01234567',
      input: plannedInput,
      publication: planned,
    });
    const forgedResult = createApprovedWebBundle({
      approvedAt: '2026-07-31T13:30:00.000Z',
      commit: '0123456789abcdef0123456789abcdef01234567',
      input: finalInput,
      publication: forged,
    });

    expect(plannedResult.ok).toBe(false);
    expect(plannedResult.failures.map(({ code }) => code)).toContain(
      'FINAL_PUBLICATION_REQUIRED',
    );
    expect(forgedResult.ok).toBe(false);
    expect(forgedResult.failures.map(({ code }) => code)).toContain(
      'PUBLICATION_APPROVAL_MISMATCH',
    );
  });
});
