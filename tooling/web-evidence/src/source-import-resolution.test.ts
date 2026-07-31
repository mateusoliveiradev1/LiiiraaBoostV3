import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const packageSourceDirectories = [
  'contracts-ts',
  'design-system',
  'design-tokens',
  'web-core',
  'web-features',
  'web-preview',
].map((packageName) =>
  fileURLToPath(new URL(`../../../packages/${packageName}/src/`, import.meta.url)),
);

const sourceFiles = packageSourceDirectories.flatMap((directory) => {
  const sourceExtensions = ['.ts', '.tsx'];
  return readdirSync(directory, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() && sourceExtensions.some((extension) => entry.name.endsWith(extension)),
    )
    .map((entry) => resolve(directory, entry.name));
});

const relativeSpecifiers = (source: string): string[] =>
  [...source.matchAll(/\bfrom\s+['"](\.[^'"]+)['"]|^\s*import\s+['"](\.[^'"]+)['"]/gmu)].map(
    (match) => match[1] ?? match[2] ?? '',
  );

describe('Turbopack-compatible workspace source imports', () => {
  it('uses exact source extensions that resolve without webpack extension aliases', () => {
    const diagnostics: string[] = [];

    for (const sourceFile of sourceFiles) {
      const source = readFileSync(sourceFile, 'utf8');
      for (const specifier of relativeSpecifiers(source)) {
        const target = resolve(dirname(sourceFile), specifier);
        if (!existsSync(target)) {
          diagnostics.push(`${sourceFile}: ${specifier}`);
        }
      }
    }

    expect(diagnostics).toEqual([]);
  });
});
