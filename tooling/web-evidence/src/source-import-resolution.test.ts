import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const rawSourceDirectories = [
  'design-system',
  'design-tokens',
  'web-core',
  'web-features',
  'web-preview',
].map((packageName) =>
  fileURLToPath(new URL(`../../../packages/${packageName}/src/`, import.meta.url)),
);

const sourceFiles = (directory: string): readonly string[] => {
  const sourceExtensions = ['.ts', '.tsx'];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(path);
    }
    return entry.isFile() && sourceExtensions.includes(extname(entry.name)) ? [path] : [];
  });
};

const rawSourceFiles = rawSourceDirectories.flatMap((directory) => sourceFiles(directory));
const contractsSourceDirectory = fileURLToPath(
  new URL('../../../packages/contracts-ts/src/', import.meta.url),
);
const contractsSourceFiles = sourceFiles(contractsSourceDirectory);

const relativeSpecifiers = (source: string): string[] =>
  [
    ...source.matchAll(/\bfrom\s+['"](\.[^'"]+)['"]/gmu),
    ...source.matchAll(/^\s*import\s+['"](\.[^'"]+)['"]/gmu),
    ...source.matchAll(/\bimport\s*\(\s*['"](\.[^'"]+)['"]\s*\)/gmu),
  ].map((match) => match[1] ?? '');

const emittedSourceTargetExists = (sourceFile: string, specifier: string): boolean => {
  const literalTarget = resolve(dirname(sourceFile), specifier);
  if (existsSync(literalTarget)) {
    return true;
  }
  if (!specifier.endsWith('.js')) {
    return false;
  }
  const sourceStem = specifier.slice(0, -'.js'.length);
  return ['.ts', '.tsx'].some((extension) =>
    existsSync(resolve(dirname(sourceFile), `${sourceStem}${extension}`)),
  );
};

describe('Turbopack-compatible workspace source imports', () => {
  it('uses exact source extensions that resolve without webpack extension aliases', () => {
    const diagnostics: string[] = [];

    for (const sourceFile of rawSourceFiles) {
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

  it('preserves NodeNext emitted JavaScript specifiers in contracts source', () => {
    const diagnostics: string[] = [];

    for (const sourceFile of contractsSourceFiles) {
      const source = readFileSync(sourceFile, 'utf8');
      for (const specifier of relativeSpecifiers(source)) {
        if (specifier.endsWith('.ts') || specifier.endsWith('.tsx')) {
          diagnostics.push(`${sourceFile}: source extension ${specifier}`);
          continue;
        }
        if (!emittedSourceTargetExists(sourceFile, specifier)) {
          diagnostics.push(`${sourceFile}: unresolved ${specifier}`);
        }
      }
    }

    expect(diagnostics).toEqual([]);
  });

  it('keeps generated contract indexes compatible with emitting consumers', () => {
    const generator = readFileSync(
      fileURLToPath(new URL('../../contract-generation/src/generate.ts', import.meta.url)),
      'utf8',
    );
    const generatedIndex = readFileSync(
      resolve(contractsSourceDirectory, 'generated', 'index.ts'),
      'utf8',
    );
    const desktopBuildConfig = JSON.parse(
      readFileSync(
        fileURLToPath(
          new URL(
            '../../../packages/desktop-production-reference/tsconfig.build.json',
            import.meta.url,
          ),
        ),
        'utf8',
      ),
    ) as { readonly compilerOptions?: { readonly allowImportingTsExtensions?: boolean } };

    expect(desktopBuildConfig.compilerOptions?.allowImportingTsExtensions).toBe(false);
    expect(generator).toContain("export type * from './models.js';");
    expect(generator).not.toContain("export type * from './models.ts';");
    expect(generatedIndex).toContain("export type * from './models.js';");
  });
});
