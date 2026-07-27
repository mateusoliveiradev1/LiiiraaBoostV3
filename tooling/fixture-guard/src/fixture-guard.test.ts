import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import productionPackage from '../../../packages/desktop-production-reference/package.json' with {
  type: 'json',
};
import { createProductionDesktopComposition } from '@liiiraa/desktop-production-reference';

import leakMatrix from '../fixtures/static-runtime-leaks.json' with {
  type: 'json',
};
import { inspectProductionRuntimeBoundary } from './runtime-guard.ts';
import {
  inspectStaticProductionGraph,
  runLiveStaticProductionGuard,
} from './static-guard.ts';

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

describe('static production fixture refusal', () => {
  it('static group rejects its exact non-zero seeded graph case count', () => {
    expect(leakMatrix.static).toHaveLength(
      leakMatrix.expectedCaseCounts.static,
    );
    expect(leakMatrix.static.length).toBeGreaterThan(0);

    const results = leakMatrix.static.map(({ graph, expectedCode }) => {
      const result = inspectStaticProductionGraph(graph);
      expect(result.ok).toBe(false);
      expect(result.findings.map(({ code }) => code)).toContain(expectedCode);
      return result;
    });

    expect(results).toHaveLength(leakMatrix.expectedCaseCounts.static);
  });

  it('static guard accepts the actual clean workspace graph', async () => {
    await expect(runLiveStaticProductionGuard()).resolves.toEqual({
      ok: true,
      findings: [],
    });
  });
});

describe('runtime production fixture refusal', () => {
  it('runtime group rejects its exact non-zero seeded response case count', () => {
    expect(leakMatrix.runtime).toHaveLength(
      leakMatrix.expectedCaseCounts.runtime,
    );
    expect(leakMatrix.runtime.length).toBeGreaterThan(0);

    const results = leakMatrix.runtime.map(
      ({ boundary, expectedCode }) => {
        const result = inspectProductionRuntimeBoundary(boundary);
        expect(result.ok).toBe(false);
        expect(result.findings.map(({ code }) => code)).toContain(expectedCode);
        return result;
      },
    );

    expect(results).toHaveLength(leakMatrix.expectedCaseCounts.runtime);
  });

  it('runtime guard accepts unavailable truth from production composition', async () => {
    const composition = createProductionDesktopComposition({
      clock: () => '2000-01-01T00:00:00.000Z',
      inspectionIds: () => 'inspection-runtime-proof',
    });
    const result = await composition.client.inspectSystem({
      requestId: 'request-runtime-proof',
      issuedAt: '2000-01-01T00:00:00.000Z',
    });

    expect(
      inspectProductionRuntimeBoundary({
        mode: composition.mode,
        identity: composition.client.identity,
        schemaVersion: composition.client.schemaVersion,
        result,
      }),
    ).toEqual({
      ok: true,
      findings: [],
    });
  });
});
