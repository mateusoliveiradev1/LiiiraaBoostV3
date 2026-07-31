import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  routeReachabilityTargets,
  validateRouteReachabilityEvidence,
  writeRouteReachabilityEvidence,
  type RouteReachabilityEvidence,
  type RouteReachabilityObservation,
  type RouteReachabilitySurface,
} from './route-reachability.js';

const repositoryRoot = join(import.meta.dirname, '../../..');
const evidenceDirectories: string[] = [];
const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

const observationFor = (
  target: ReturnType<typeof routeReachabilityTargets>[number],
): RouteReachabilityObservation => ({
  authorityConnected: false,
  contentSha256: sha256(`${target.surface}:${target.routeId}:${target.locale}`),
  diagnosticsRedacted: true,
  locale: target.locale,
  localePreserved: true,
  pathname: target.pathname,
  recoveryValid: true,
  redirected: false,
  responseStatus: target.semanticStatus === 404 ? 404 : 200,
  routeId: target.routeId,
  semanticStatus: target.semanticStatus,
  surface: target.surface,
});

const completeObservations = (): RouteReachabilityObservation[] =>
  routeReachabilityTargets().map(observationFor);

const writeCompleteEvidence = (): Readonly<{
  evidence: RouteReachabilityEvidence;
  evidencePath: string;
}> => {
  const directory = mkdtempSync(join(tmpdir(), 'liiiraa-route-reachability-'));
  evidenceDirectories.push(directory);
  const evidencePath = join(directory, 'route-reachability.json');
  let evidence: RouteReachabilityEvidence | undefined;
  for (const surface of ['public', 'account', 'admin'] as const) {
    evidence = writeRouteReachabilityEvidence({
      evidencePath,
      observations: completeObservations().filter((observation) => observation.surface === surface),
      repositoryRoot,
      surface,
    });
  }
  if (evidence === undefined) throw new Error('Expected evidence to be written.');
  return { evidence, evidencePath };
};

afterEach(() => {
  for (const directory of evidenceDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe('canonical reachability projection', () => {
  it('derives exactly four statuses across three surfaces and two locales', () => {
    const targets = routeReachabilityTargets();

    expect(targets).toHaveLength(24);
    expect(new Set(targets.map(({ routeId }) => routeId)).size).toBe(12);
    expect(new Set(targets.map(({ locale }) => locale))).toEqual(new Set(['pt-BR', 'en']));
    expect(new Set(targets.map(({ semanticStatus }) => semanticStatus))).toEqual(
      new Set([403, 404, 410, 500]),
    );
    expect(
      targets.every(({ pathname }) =>
        /^\/(?:pt-BR|en)\/errors\/(?:403|404|410|500)$/u.test(pathname),
      ),
    ).toBe(true);
  });
});

describe('route reachability validation', () => {
  it('accepts the exact source-bound browser observation set', () => {
    const { evidence } = writeCompleteEvidence();
    const result = validateRouteReachabilityEvidence(evidence, repositoryRoot);

    expect(result).toEqual({ diagnostics: [], ok: true });
    expect(evidence.status).toBe('passed');
    expect(evidence.observations).toHaveLength(24);
  });

  it.each([
    ['missing', (values: RouteReachabilityObservation[]) => values.slice(1)],
    ['duplicate', (values: RouteReachabilityObservation[]) => [...values, values[0]!]],
    [
      'unknown route',
      (values: RouteReachabilityObservation[]) => [
        { ...values[0]!, routeId: 'public-error-418' },
        ...values.slice(1),
      ],
    ],
    [
      'wrong surface',
      (values: RouteReachabilityObservation[]) => [
        {
          ...values[0]!,
          surface: (values[0]!.surface === 'account'
            ? 'public'
            : 'account') as RouteReachabilitySurface,
        },
        ...values.slice(1),
      ],
    ],
    [
      'wrong locale',
      (values: RouteReachabilityObservation[]) => [
        { ...values[0]!, locale: 'es' },
        ...values.slice(1),
      ],
    ],
    [
      'collapsed authored state',
      (values: RouteReachabilityObservation[]) => [
        { ...values[0]!, responseStatus: 404 },
        ...values.slice(1),
      ],
    ],
    [
      'redirect',
      (values: RouteReachabilityObservation[]) => [
        { ...values[0]!, redirected: true },
        ...values.slice(1),
      ],
    ],
    [
      'unredacted content',
      (values: RouteReachabilityObservation[]) => [
        { ...values[0]!, diagnosticsRedacted: false },
        ...values.slice(1),
      ],
    ],
    [
      'dead recovery',
      (values: RouteReachabilityObservation[]) => [
        { ...values[0]!, recoveryValid: false },
        ...values.slice(1),
      ],
    ],
    [
      'connected authority',
      (values: RouteReachabilityObservation[]) => [
        { ...values[0]!, authorityConnected: true },
        ...values.slice(1),
      ],
    ],
  ])('rejects a %s mutation', (_label, mutate) => {
    const { evidence } = writeCompleteEvidence();
    const result = validateRouteReachabilityEvidence(
      { ...evidence, observations: mutate([...evidence.observations]) },
      repositoryRoot,
    );

    expect(result.ok).toBe(false);
  });

  it('rejects stale or malformed source and content fingerprints', () => {
    const { evidence } = writeCompleteEvidence();

    expect(
      validateRouteReachabilityEvidence(
        { ...evidence, canonicalRouteSourceSha256: '0'.repeat(64) },
        repositoryRoot,
      ).ok,
    ).toBe(false);
    expect(
      validateRouteReachabilityEvidence(
        {
          ...evidence,
          observations: [
            { ...evidence.observations[0]!, contentSha256: 'not-a-hash' },
            ...evidence.observations.slice(1),
          ],
        },
        repositoryRoot,
      ).ok,
    ).toBe(false);
  });

  it.each(['diagnostics', 'stack', 'email', 'credential', 'url', 'requestBody'])(
    'rejects an undeclared sensitive-capable %s field',
    (field) => {
      const { evidence } = writeCompleteEvidence();
      const unsafe = {
        ...evidence,
        observations: [
          { ...evidence.observations[0]!, [field]: 'must never persist' },
          ...evidence.observations.slice(1),
        ],
      };

      expect(validateRouteReachabilityEvidence(unsafe, repositoryRoot).ok).toBe(false);
    },
  );
});

describe('deterministic atomic evidence writing', () => {
  it('merges complete surface slices and reaches passed only at the exact closed set', () => {
    const directory = mkdtempSync(join(tmpdir(), 'liiiraa-route-reachability-'));
    evidenceDirectories.push(directory);
    const evidencePath = join(directory, 'route-reachability.json');
    const observations = completeObservations();

    const publicEvidence = writeRouteReachabilityEvidence({
      evidencePath,
      observations: observations.filter(({ surface }) => surface === 'public'),
      repositoryRoot,
      surface: 'public',
    });
    expect(publicEvidence.status).toBe('planned');
    expect(publicEvidence.observations).toHaveLength(8);

    const accountEvidence = writeRouteReachabilityEvidence({
      evidencePath,
      observations: observations.filter(({ surface }) => surface === 'account'),
      repositoryRoot,
      surface: 'account',
    });
    expect(accountEvidence.status).toBe('planned');
    expect(accountEvidence.observations).toHaveLength(16);

    const adminEvidence = writeRouteReachabilityEvidence({
      evidencePath,
      observations: observations.filter(({ surface }) => surface === 'admin'),
      repositoryRoot,
      surface: 'admin',
    });
    expect(adminEvidence.status).toBe('passed');
    expect(adminEvidence.observations).toHaveLength(24);
    expect(
      adminEvidence.observations.map(({ surface, routeId, locale }) =>
        [surface, routeId, locale].join(':'),
      ),
    ).toEqual(
      [...adminEvidence.observations]
        .toSorted(
          (left, right) =>
            left.surface.localeCompare(right.surface) ||
            left.routeId.localeCompare(right.routeId) ||
            left.locale.localeCompare(right.locale),
        )
        .map(({ surface, routeId, locale }) => [surface, routeId, locale].join(':')),
    );
  });

  it('serializes reordered equivalent slices byte-identically without temp-file residue', () => {
    const first = writeCompleteEvidence();
    const secondDirectory = mkdtempSync(join(tmpdir(), 'liiiraa-route-reachability-'));
    evidenceDirectories.push(secondDirectory);
    const secondPath = join(secondDirectory, 'route-reachability.json');
    const reversed = completeObservations().toReversed();

    for (const surface of ['admin', 'public', 'account'] as const) {
      writeRouteReachabilityEvidence({
        evidencePath: secondPath,
        observations: reversed.filter((observation) => observation.surface === surface),
        repositoryRoot,
        surface,
      });
    }

    expect(readFileSync(secondPath, 'utf8')).toBe(readFileSync(first.evidencePath, 'utf8'));
    expect(readFileSync(secondPath, 'utf8')).not.toMatch(/must never persist|file:\/\//u);
  });
});
