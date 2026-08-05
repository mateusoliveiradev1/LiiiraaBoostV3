import { describe, expect, it } from 'vitest';

import { selectWebTestSurfaces } from '../playwright.config.js';

const names = (arguments_: readonly string[]): string[] =>
  selectWebTestSurfaces(arguments_).map(({ surface }) => surface);

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
  });
});
