import { describe, expect, it } from 'vitest';

import {
  inspectSecurityBoundaryEvidence,
  inspectWorkspaceReadiness,
  type SecurityBoundaryEvidence,
} from './web-evidence-harness.js';

const completeSecurityEvidence = (): SecurityBoundaryEvidence => ({
  surfaces: [
    {
      cookieScope: 'public.localhost',
      fixtureReferences: [],
      headers: {
        'content-security-policy': "default-src 'self'; frame-ancestors 'none'",
        'referrer-policy': 'strict-origin-when-cross-origin',
        'x-content-type-options': 'nosniff',
      },
      indexing: 'index',
      origin: 'http://public.localhost:3100',
      surface: 'public',
    },
    {
      cookieScope: 'account.localhost',
      fixtureReferences: ['W10'],
      headers: {
        'content-security-policy': "default-src 'self'; frame-ancestors 'none'",
        'referrer-policy': 'no-referrer',
        'x-content-type-options': 'nosniff',
      },
      indexing: 'noindex',
      origin: 'http://account.localhost:3101',
      surface: 'account',
    },
    {
      cookieScope: 'admin.localhost',
      fixtureReferences: ['W14'],
      headers: {
        'content-security-policy': "default-src 'self'; frame-ancestors 'none'",
        'referrer-policy': 'no-referrer',
        'x-content-type-options': 'nosniff',
      },
      indexing: 'noindex',
      origin: 'http://admin.localhost:3102',
      surface: 'admin',
    },
  ],
});

describe('web evidence harness self-test: security boundaries', () => {
  it('accepts a complete isolated three-origin fixture', () => {
    expect(inspectSecurityBoundaryEvidence(completeSecurityEvidence())).toEqual({
      diagnostics: [],
      ok: true,
    });
  });

  it.each([
    [
      'missing security header',
      (fixture: SecurityBoundaryEvidence) => ({
        ...fixture,
        surfaces: fixture.surfaces.map((surface) =>
          surface.surface === 'public'
            ? {
                ...surface,
                headers: {
                  'content-security-policy': surface.headers['content-security-policy'],
                  'referrer-policy': surface.headers['referrer-policy'],
                },
              }
            : surface,
        ),
      }),
      'MISSING_SECURITY_HEADER',
    ],
    [
      'incomplete CSP',
      (fixture: SecurityBoundaryEvidence) => ({
        ...fixture,
        surfaces: fixture.surfaces.map((surface) =>
          surface.surface === 'public'
            ? {
                ...surface,
                headers: {
                  ...surface.headers,
                  'content-security-policy': "default-src 'self'",
                },
              }
            : surface,
        ),
      }),
      'MISSING_CSP_DIRECTIVE',
    ],
    [
      'private surface indexing',
      (fixture: SecurityBoundaryEvidence) => ({
        ...fixture,
        surfaces: fixture.surfaces.map((surface) =>
          surface.surface === 'admin' ? { ...surface, indexing: 'index' } : surface,
        ),
      }),
      'PRIVATE_INDEXING',
    ],
    [
      'cross-origin cookie scope',
      (fixture: SecurityBoundaryEvidence) => ({
        ...fixture,
        surfaces: fixture.surfaces.map((surface) =>
          surface.surface === 'account'
            ? { ...surface, cookieScope: '.localhost' }
            : surface,
        ),
      }),
      'COOKIE_SCOPE_VIOLATION',
    ],
    [
      'duplicate origin',
      (fixture: SecurityBoundaryEvidence) => ({
        ...fixture,
        surfaces: fixture.surfaces.map((surface) =>
          surface.surface === 'admin'
            ? { ...surface, origin: 'http://account.localhost:3101' }
            : surface,
        ),
      }),
      'ORIGIN_BOUNDARY_VIOLATION',
    ],
    [
      'public fixture leakage',
      (fixture: SecurityBoundaryEvidence) => ({
        ...fixture,
        surfaces: fixture.surfaces.map((surface) =>
          surface.surface === 'public'
            ? { ...surface, fixtureReferences: ['W01'] }
            : surface,
        ),
      }),
      'FIXTURE_LEAKAGE',
    ],
  ] as const)('detects %s with a stable diagnostic', (_name, mutate, expectedCode) => {
    expect(
      inspectSecurityBoundaryEvidence(mutate(completeSecurityEvidence())).diagnostics[0]?.code,
    ).toBe(expectedCode);
  });
});

describe('workspace readiness: security boundaries', () => {
  it('fails closed until all WEB-08 build roots exist', () => {
    const result = inspectWorkspaceReadiness({
      requirement: 'WEB-08',
      repositoryRoot: 'Z:/isolated-empty-workspace',
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe('MISSING_BUILD_ROOT');
  });
});
