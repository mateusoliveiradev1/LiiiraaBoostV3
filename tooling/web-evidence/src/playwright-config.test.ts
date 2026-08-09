import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolvePublishedAdminOrigin, selectWebTestSurfaces } from '../playwright.config.js';

const names = (arguments_: readonly string[]): string[] =>
  selectWebTestSurfaces(arguments_).map(({ surface }) => surface);

const originalArguments = [...process.argv];
const originalEnvironment = { ...process.env };

const configuredProjectNames = async (arguments_: readonly string[]) => {
  process.argv = ['node', 'playwright', ...arguments_];
  vi.resetModules();
  const { default: config } = await import('../playwright.config.js');
  return (config.projects ?? []).map(({ name }) => name);
};

afterEach(() => {
  process.argv = [...originalArguments];
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnvironment)) delete process.env[key];
  }
  Object.assign(process.env, originalEnvironment);
  vi.resetModules();
});

describe('Playwright web-server selection', () => {
  it('starts every surface for bare and reporter-only full-suite commands', () => {
    expect(names([])).toEqual(['public', 'account', 'admin']);
    expect(names(['--reporter=line'])).toEqual(['public', 'account', 'admin']);
  });

  it('keeps focused public, account, and admin runs bounded', () => {
    expect(names(['tests/public.spec.ts'])).toEqual(['public']);
    expect(names(['--project=account-final-wide-1440'])).toEqual(['account']);
    expect(names(['tests/admin.spec.ts'])).toEqual(['admin']);
  });

  it('starts every origin for cross-surface evidence specifications', () => {
    expect(names(['tests/security-artifacts.spec.ts', '--project=public-final-wide-1440'])).toEqual(
      ['public', 'account', 'admin'],
    );
  });

  it('starts no local daemons for static or deployed staging-origin probes', () => {
    expect(names(['tests/security-artifacts.spec.ts', '--grep', '@staging-origin-smoke'])).toEqual(
      [],
    );
    expect(names(['tests/security-artifacts.spec.ts', '--grep', '@staging-origin-live'])).toEqual(
      [],
    );
    expect(names(['tests/admin-operations.spec.ts', '--grep', '@published-authority'])).toEqual([]);
  });

  it('requires a canonical HTTPS origin for the published Admin project', () => {
    expect(() => resolvePublishedAdminOrigin({})).toThrow(
      'PUBLISHED_AUTHORITY_REQUIRES_CANONICAL_HTTPS_ADMIN_STAGING_ORIGIN',
    );
    expect(() =>
      resolvePublishedAdminOrigin({ ADMIN_STAGING_ORIGIN: 'http://admin.example.test' }),
    ).toThrow('PUBLISHED_AUTHORITY_REQUIRES_CANONICAL_HTTPS_ADMIN_STAGING_ORIGIN');
    expect(
      resolvePublishedAdminOrigin({
        ADMIN_STAGING_ORIGIN: 'https://liiiraa-boost-admin-staging.vercel.app',
      }),
    ).toBe('https://liiiraa-boost-admin-staging.vercel.app');
  });

  it.each([
    {
      arguments_: ['tests/security-artifacts.spec.ts', '--grep', '@staging-origin-smoke'],
      project: 'staging-origin',
    },
    {
      arguments_: ['tests/admin-operations.spec.ts', '--grep', '@production-authority'],
      project: 'production-authority',
    },
    {
      arguments_: ['tests/admin-operations.spec.ts', '--grep', '@published-authority'],
      project: 'published-authority',
    },
  ])(
    'keeps the $project project when a worker reloads config without CLI filters',
    async ({ arguments_, project }) => {
      if (project === 'published-authority') {
        process.env['ADMIN_STAGING_ORIGIN'] = 'https://liiiraa-boost-admin-staging.vercel.app';
      }
      expect(await configuredProjectNames(arguments_)).toContain(project);
      expect(await configuredProjectNames([])).toContain(project);
    },
  );
});
