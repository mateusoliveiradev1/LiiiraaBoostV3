import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import productionPackage from '../../../packages/desktop-production-reference/package.json' with {
  type: 'json',
};

const formatDiagnostic = (diagnostic: ts.Diagnostic): string => {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
  return `TS${String(diagnostic.code)} ${message}`;
};

describe('type-boundary fixture refusal', () => {
  it('type-boundary compiles the negative fixture through the public package entry', () => {
    const program = ts.createProgram({
      rootNames: ['fixtures/production-fixture-type.ts'],
      options: {
        allowImportingTsExtensions: true,
        exactOptionalPropertyTypes: true,
        module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
        noEmit: true,
        noUncheckedIndexedAccess: true,
        skipLibCheck: false,
        strict: true,
        target: ts.ScriptTarget.ES2024,
      },
    });
    const diagnostics = ts.getPreEmitDiagnostics(program);

    expect(diagnostics.map(formatDiagnostic)).toEqual([]);
  });

  it('type-boundary exposes only the public index as package and build entry', () => {
    expect(productionPackage).toMatchObject({
      main: './src/index.ts',
      types: './src/index.ts',
      exports: {
        '.': {
          types: './src/index.ts',
          default: './src/index.ts',
        },
      },
    });
  });
});
