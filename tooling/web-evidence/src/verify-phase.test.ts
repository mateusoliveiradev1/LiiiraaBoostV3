import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  PHASE_3_DECISIONS,
  PHASE_3_EVIDENCE_DIMENSIONS,
  PHASE_3_LOCALES,
  PHASE_3_PROOFS,
  PHASE_3_REQUIREMENTS,
  PHASE_3_ROUTES,
  PHASE_3_SCENARIOS,
  PHASE_3_SOURCE_FILES,
  PHASE_3_SUCCESS_CRITERIA,
  createRepositoryPhase3Input,
  verifyPhase3,
  type Phase3VerificationInput,
} from './verify-phase.js';
import type {
  RouteReachabilityEvidence,
  RouteReachabilityObservation,
} from './route-reachability.js';

const sha = (value: string): string => createHash('sha256').update(value).digest('hex');
const repositoryRoot = join(import.meta.dirname, '../../..');
const routeReachabilityFile = 'quality/evidence/phase-03/web/route-reachability.json';

type Phase3InputWithReachability = Phase3VerificationInput;

const currentRouteReachability = (): RouteReachabilityEvidence =>
  JSON.parse(
    readFileSync(join(repositoryRoot, routeReachabilityFile), 'utf8'),
  ) as RouteReachabilityEvidence;

const evidenceFileByRequirement = Object.freeze({
  'WEB-01': 'tooling/web-evidence/tests/public.spec.ts',
  'WEB-02': 'tooling/web-evidence/tests/documentation.spec.ts',
  'WEB-03': 'tooling/web-evidence/tests/releases.spec.ts',
  'WEB-08': 'tooling/web-evidence/tests/security-artifacts.spec.ts',
} as const);

const completeInput = (): Phase3InputWithReachability => ({
  artifacts: {
    appArtifacts: [
      {
        classification: 'production-build',
        hash: sha('public-build'),
        path: 'apps/web/.next/standalone',
        state: 'observed',
        surface: 'public',
      },
      {
        classification: 'production-build',
        hash: sha('account-build'),
        path: 'apps/account/.next/standalone',
        state: 'observed',
        surface: 'account',
      },
      {
        classification: 'production-build',
        hash: sha('admin-build'),
        path: 'apps/admin/.next/standalone',
        state: 'observed',
        surface: 'admin',
      },
    ],
    authority: {
      adminMutationConnected: false,
      billingConnected: false,
      diagnosticUploadConnected: false,
      identityConnected: false,
      publicDistributionConnected: false,
      supportSubmissionConnected: false,
    },
    captures: PHASE_3_LOCALES.map((locale) => ({
      approved: true,
      hash: sha(`capture:${locale}`),
      locale,
      path: `apps/web/public/product/desktop-home.${locale}.webp`,
      scenarioId: 'S01',
      sidecarPath: `apps/web/public/product/desktop-home.${locale}.json`,
    })),
    decisions: [...PHASE_3_DECISIONS],
    evidence: PHASE_3_EVIDENCE_DIMENSIONS.map((identity) => {
      const [requirement, dimension] = identity.split(':') as [
        (typeof PHASE_3_REQUIREMENTS)[number],
        string,
      ];
      return {
        command:
          dimension === 'security' && requirement !== 'WEB-01'
            ? 'pnpm web:test'
            : 'pnpm --filter @liiiraa/web-evidence exec playwright test',
        file: evidenceFileByRequirement[requirement],
        id: `${requirement.toLowerCase()}-${dimension}`,
        identity,
        owner: 'plan-03-32',
        status: 'passed' as const,
      };
    }),
    locales: [...PHASE_3_LOCALES],
    proofs: PHASE_3_PROOFS.map(({ file, id, owner }) => ({
      file,
      id,
      owner,
      status: 'passed' as const,
    })),
    publication: {
      approved: true,
      bundleFile: 'quality/evidence/phase-03/web/approved-publication-bundle.json',
      developmentArtifactDetected: false,
      downloadAvailable: false,
      officialArtifact: 'unavailable',
      publicDistributionApproved: false,
    },
    requirements: [...PHASE_3_REQUIREMENTS],
    routeReachability: currentRouteReachability(),
    routes: [...PHASE_3_ROUTES],
    scenarios: [...PHASE_3_SCENARIOS],
    sourceHashes: PHASE_3_SOURCE_FILES.map((file) => ({ file, sha256: sha(file) })),
    successCriteria: [...PHASE_3_SUCCESS_CRITERIA],
  },
  commands: [
    'pnpm web:test',
    'pnpm --filter @liiiraa/web-evidence exec playwright test',
    'pnpm web:verify:phase -- --mode final',
    'pnpm verify',
  ],
  mode: 'final',
  repositoryFiles: [
    ...PHASE_3_SOURCE_FILES,
    ...PHASE_3_PROOFS.map(({ file }) => file),
    routeReachabilityFile,
    'apps/web/.next/standalone',
    'apps/account/.next/standalone',
    'apps/admin/.next/standalone',
    'apps/web/public/product/desktop-home.pt-BR.webp',
    'apps/web/public/product/desktop-home.pt-BR.json',
    'apps/web/public/product/desktop-home.en.webp',
    'apps/web/public/product/desktop-home.en.json',
  ],
});

const cloneInput = (input: Phase3InputWithReachability): Phase3InputWithReachability =>
  structuredClone(input);

describe('Phase 3 final source coverage', () => {
  it('accepts the exact closed Phase 3 evidence graph without mutating source input', () => {
    const input = completeInput();
    const before = sha(JSON.stringify(input));
    const result = verifyPhase3(input);

    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual([]);
    if (result.ok) {
      expect(result.counts).toEqual({
        decisions: 110,
        evidenceDimensions: 20,
        requirements: 4,
        routeOutcomes: 24,
        routes: 58,
        scenarios: 18,
        successCriteria: 4,
      });
      expect(result.fingerprint).toMatch(/^[a-f0-9]{64}$/u);
    }
    expect(sha(JSON.stringify(input))).toBe(before);
  });

  it('accepts the checked-in proof graph across canonical repository line endings', () => {
    const input = createRepositoryPhase3Input('planned', repositoryRoot);

    expect(verifyPhase3(input, repositoryRoot)).toMatchObject({ ok: true });
  });
});

describe('Phase 3 route reachability', () => {
  const replaceObservations = (
    input: Phase3InputWithReachability,
    mutate: (observations: RouteReachabilityObservation[]) => RouteReachabilityObservation[],
  ): void => {
    const evidence = input.artifacts.routeReachability;
    if (evidence === undefined) throw new Error('Expected route reachability fixture.');
    input.artifacts.routeReachability = {
      ...evidence,
      observations: mutate([...evidence.observations]),
    };
  };

  it('rejects the complete 54-route declaration when browser reachability proof is absent', () => {
    const input = cloneInput(completeInput());
    delete (input.artifacts as Partial<Phase3VerificationInput['artifacts']>).routeReachability;

    expect(verifyPhase3(input).diagnostics.map(({ code }) => code)).toContain(
      'ROUTE_REACHABILITY_EVIDENCE_SHAPE_INVALID',
    );
  });

  it.each([
    ['missing observation', (values: RouteReachabilityObservation[]) => values.slice(1)],
    ['duplicate observation', (values: RouteReachabilityObservation[]) => [...values, values[0]!]],
    [
      'route identity drift',
      (values: RouteReachabilityObservation[]) => [
        { ...values[0]!, routeId: 'public-error-418' },
        ...values.slice(1),
      ],
    ],
    [
      'surface drift',
      (values: RouteReachabilityObservation[]) => [
        {
          ...values[0]!,
          surface: values[0]!.surface === 'account' ? ('public' as const) : ('account' as const),
        },
        ...values.slice(1),
      ],
    ],
    [
      'locale drift',
      (values: RouteReachabilityObservation[]) => [
        { ...values[0]!, locale: 'es' as never },
        ...values.slice(1),
      ],
    ],
    [
      'semantic status drift',
      (values: RouteReachabilityObservation[]) => [
        { ...values[0]!, semanticStatus: 500 as const },
        ...values.slice(1),
      ],
    ],
    [
      'collapsed response',
      (values: RouteReachabilityObservation[]) => [
        { ...values[0]!, responseStatus: 404 },
        ...values.slice(1),
      ],
    ],
    [
      'redirected outcome',
      (values: RouteReachabilityObservation[]) => [
        { ...values[0]!, redirected: true },
        ...values.slice(1),
      ],
    ],
    [
      'unredacted diagnostics',
      (values: RouteReachabilityObservation[]) => [
        { ...values[0]!, diagnosticsRedacted: false },
        ...values.slice(1),
      ],
    ],
    [
      'unrecoverable outcome',
      (values: RouteReachabilityObservation[]) => [
        { ...values[0]!, recoveryValid: false },
        ...values.slice(1),
      ],
    ],
    [
      'authority-connected outcome',
      (values: RouteReachabilityObservation[]) => [
        { ...values[0]!, authorityConnected: true },
        ...values.slice(1),
      ],
    ],
  ])('rejects a %s mutation', (_label, mutate) => {
    const input = cloneInput(completeInput());
    replaceObservations(input, mutate);

    expect(
      verifyPhase3(input).diagnostics.some(({ code }) => code.startsWith('ROUTE_REACHABILITY_')),
    ).toBe(true);
  });

  it.each([
    ['canonical route source', 'canonicalRouteSourceSha256'],
    ['public browser spec', 'tooling/web-evidence/tests/public.spec.ts'],
    ['account browser spec', 'tooling/web-evidence/tests/account.spec.ts'],
    ['admin browser spec', 'tooling/web-evidence/tests/admin.spec.ts'],
  ] as const)('rejects stale %s binding', (_label, source) => {
    const input = cloneInput(completeInput());
    const evidence = input.artifacts.routeReachability!;
    input.artifacts.routeReachability =
      source === 'canonicalRouteSourceSha256'
        ? { ...evidence, canonicalRouteSourceSha256: '0'.repeat(64) }
        : {
            ...evidence,
            specSourceHashes: { ...evidence.specSourceHashes, [source]: '0'.repeat(64) },
          };

    expect(verifyPhase3(input).diagnostics.map(({ code }) => code)).toContain(
      source === 'canonicalRouteSourceSha256'
        ? 'ROUTE_REACHABILITY_CANONICAL_ROUTE_SOURCE_HASH_MISMATCH'
        : 'ROUTE_REACHABILITY_SPEC_SOURCE_HASH_MISMATCH',
    );
  });

  it('rejects route proof owner, status, path, and artifact identity drift', () => {
    const owner = cloneInput(completeInput());
    const routeProof = owner.artifacts.proofs.find(({ id }) => id === 'route-reachability');
    if (routeProof !== undefined) routeProof.owner = 'plan-03-32';
    const status = cloneInput(completeInput());
    const statusProof = status.artifacts.proofs.find(({ id }) => id === 'route-reachability');
    if (statusProof !== undefined) statusProof.status = 'planned';
    const path = cloneInput(completeInput());
    const pathProof = path.artifacts.proofs.find(({ id }) => id === 'route-reachability');
    if (pathProof !== undefined) pathProof.file = 'quality/evidence/phase-03/web/routes.json';
    const identity = cloneInput(completeInput());
    identity.artifacts.routeReachability = {
      ...identity.artifacts.routeReachability!,
      owner: 'plan-03-34' as never,
    };
    const schema = cloneInput(completeInput());
    schema.artifacts.routeReachability = {
      ...schema.artifacts.routeReachability!,
      schemaVersion: 2 as never,
    };

    expect(verifyPhase3(owner).diagnostics.map(({ code }) => code)).toContain(
      'PROOF_OWNER_MISMATCH',
    );
    expect(verifyPhase3(status).diagnostics.map(({ code }) => code)).toContain('PROOF_NOT_FINAL');
    expect(verifyPhase3(path).diagnostics.map(({ code }) => code)).toContain('PROOF_PATH_MISMATCH');
    expect(verifyPhase3(identity).diagnostics.map(({ code }) => code)).toContain(
      'ROUTE_REACHABILITY_EVIDENCE_IDENTITY_INVALID',
    );
    expect(verifyPhase3(schema).diagnostics.map(({ code }) => code)).toContain(
      'ROUTE_REACHABILITY_EVIDENCE_IDENTITY_INVALID',
    );
  });
});

describe('Phase 3 omission coverage', () => {
  it.each([
    [
      'requirement',
      (input: Phase3VerificationInput) => input.artifacts.requirements.pop(),
      'MISSING_REQUIREMENT',
    ],
    [
      'decision',
      (input: Phase3VerificationInput) => input.artifacts.decisions.pop(),
      'MISSING_DECISION',
    ],
    [
      'success criterion',
      (input: Phase3VerificationInput) => input.artifacts.successCriteria.pop(),
      'MISSING_SUCCESS_CRITERION',
    ],
    [
      'scenario',
      (input: Phase3VerificationInput) => input.artifacts.scenarios.pop(),
      'MISSING_SCENARIO',
    ],
    ['route', (input: Phase3VerificationInput) => input.artifacts.routes.pop(), 'MISSING_ROUTE'],
    ['locale', (input: Phase3VerificationInput) => input.artifacts.locales.pop(), 'MISSING_LOCALE'],
    [
      'evidence dimension',
      (input: Phase3VerificationInput) => input.artifacts.evidence.pop(),
      'MISSING_EVIDENCE_DIMENSION',
    ],
    [
      'app artifact',
      (input: Phase3VerificationInput) => input.artifacts.appArtifacts.pop(),
      'MISSING_APP_ARTIFACT',
    ],
    [
      'capture',
      (input: Phase3VerificationInput) => input.artifacts.captures.pop(),
      'MISSING_CAPTURE',
    ],
    ['proof', (input: Phase3VerificationInput) => input.artifacts.proofs.pop(), 'MISSING_PROOF'],
    [
      'source hash',
      (input: Phase3VerificationInput) => input.artifacts.sourceHashes.pop(),
      'MISSING_SOURCE_HASH',
    ],
  ] as const)('rejects one omitted %s with a stable diagnostic', (_name, mutate, code) => {
    const input = cloneInput(completeInput());
    mutate(input);

    expect(verifyPhase3(input).diagnostics.map(({ code: actual }) => actual)).toContain(code);
  });

  it('rejects renamed and duplicated closed identities', () => {
    const renamed = cloneInput(completeInput());
    renamed.artifacts.routes[0] = 'renamed-route';
    const duplicated = cloneInput(completeInput());
    duplicated.artifacts.decisions[1] = duplicated.artifacts.decisions[0] ?? 'D-01';

    expect(verifyPhase3(renamed).diagnostics.map(({ code }) => code)).toContain('MISSING_ROUTE');
    expect(verifyPhase3(duplicated).diagnostics.map(({ code }) => code)).toContain(
      'DUPLICATE_DECISION',
    );
  });

  it('rejects deferred authority or public development distribution claims', () => {
    const authority = cloneInput(completeInput());
    authority.artifacts.authority.identityConnected = true;
    const distribution = cloneInput(completeInput());
    distribution.artifacts.publication.publicDistributionApproved = true;
    distribution.artifacts.publication.developmentArtifactDetected = true;

    expect(verifyPhase3(authority).diagnostics.map(({ code }) => code)).toContain(
      'DEFERRED_AUTHORITY_CONNECTED',
    );
    expect(verifyPhase3(distribution).diagnostics.map(({ code }) => code)).toContain(
      'PUBLIC_DISTRIBUTION_TRUTH_VIOLATION',
    );
  });
});

describe('Phase 3 recursive gate', () => {
  it('requires the final phase command and root verify command to resolve exactly', () => {
    const input = cloneInput(completeInput());
    input.commands = input.commands.filter((command) => command !== 'pnpm verify');

    expect(verifyPhase3(input).diagnostics.map(({ code }) => code)).toContain(
      'ROOT_COMMAND_UNREACHABLE',
    );
  });

  it('rejects an unresolved evidence command and an absent exact evidence file', () => {
    const unresolved = cloneInput(completeInput());
    unresolved.commands = unresolved.commands.filter((command) => command !== 'pnpm web:test');
    const missing = cloneInput(completeInput());
    const evidenceFile = missing.artifacts.evidence[0]?.file ?? '';
    missing.repositoryFiles = missing.repositoryFiles.filter((file) => file !== evidenceFile);

    expect(verifyPhase3(unresolved).diagnostics.map(({ code }) => code)).toContain(
      'EVIDENCE_COMMAND_UNRESOLVED',
    );
    expect(verifyPhase3(missing).diagnostics.map(({ code }) => code)).toContain(
      'EVIDENCE_FILE_MISSING',
    );
  });
});
