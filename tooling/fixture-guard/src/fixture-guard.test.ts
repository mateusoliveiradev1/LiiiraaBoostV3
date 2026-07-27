import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { createProductionDesktopComposition } from '@liiiraa/desktop-production-reference';

import leakMatrix from '../fixtures/static-runtime-leaks.json' with { type: 'json' };
import { inspectBuiltArtifact } from './artifact-guard.ts';
import { inspectProductionSmokeEvidence, runProductionSmoke } from './production-smoke.ts';
import { inspectProductionRuntimeBoundary } from './runtime-guard.ts';
import { inspectStaticProductionGraph, runLiveStaticProductionGuard } from './static-guard.ts';

const formatDiagnostic = (diagnostic: ts.Diagnostic): string => {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
  return `TS${String(diagnostic.code)} ${message}`;
};

const productionPackageContents = ts.sys.readFile(
  '../../packages/desktop-production-reference/package.json',
);
if (productionPackageContents === undefined) {
  throw new Error('Production package manifest is unavailable.');
}
const productionPackage = JSON.parse(productionPackageContents) as unknown;

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
      main: './dist/index.js',
      types: './src/index.ts',
      exports: {
        '.': {
          types: './src/index.ts',
          default: './dist/index.js',
        },
      },
    });
  });
});

describe('static production fixture refusal', () => {
  it('static group rejects its exact non-zero seeded graph case count', () => {
    expect(leakMatrix.static).toHaveLength(leakMatrix.expectedCaseCounts.static);
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
    expect(leakMatrix.runtime).toHaveLength(leakMatrix.expectedCaseCounts.runtime);
    expect(leakMatrix.runtime.length).toBeGreaterThan(0);

    const results = leakMatrix.runtime.map(({ boundary, expectedCode }) => {
      const result = inspectProductionRuntimeBoundary(boundary);
      expect(result.ok).toBe(false);
      expect(result.findings.map(({ code }) => code)).toContain(expectedCode);
      return result;
    });

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

describe('artifact production fixture refusal', () => {
  it('artifact rejects the exact leaking distribution corpus', () => {
    const result = inspectBuiltArtifact({
      distributionRoot: new URL('../fixtures/leaking-artifact/', import.meta.url),
    });

    expect(result.ok).toBe(false);
    expect(result.scannedFiles).toBe(1);
    expect(result.findings).toEqual([
      {
        code: 'FIXTURE_SENTINEL',
        path: 'fixture-sentinel.txt',
        message: 'Built artifact contains a fixture sentinel.',
      },
    ]);
  });

  it('artifact accepts the exact clean distribution corpus', () => {
    const result = inspectBuiltArtifact({
      distributionRoot: new URL('../fixtures/clean-artifact/', import.meta.url),
    });

    expect(result).toMatchObject({
      ok: true,
      findings: [],
      scannedFiles: 1,
    });
    expect(result.scannedBytes).toBeGreaterThan(0);
  });

  it('artifact requires an explicit absolute distribution root', () => {
    expect(() => inspectBuiltArtifact({ distributionRoot: 'fixtures/clean-artifact' })).toThrow(
      'distributionRoot must be an explicit absolute path or file URL',
    );
  });

  it('artifact refuses source trees as distribution roots', () => {
    const result = inspectBuiltArtifact({
      distributionRoot: new URL('./', import.meta.url),
    });

    expect(result).toMatchObject({
      ok: false,
      scannedFiles: 0,
      findings: [
        {
          code: 'INVALID_DISTRIBUTION_ROOT',
          path: '.',
        },
      ],
    });
  });
});

describe('production smoke subprocess truth', () => {
  it('production smoke builds and launches only the exported distributable', () => {
    const result = runProductionSmoke();

    expect(result).toMatchObject({
      ok: true,
      executedEntry: 'packages/desktop-production-reference/dist/index.js',
      mode: 'production',
      identity: {
        adapterId: 'liiiraa-desktop-production-unavailable',
        adapterVersion: '1.0.0',
      },
      schemaVersion: '1.0',
      result: {
        ok: true,
        value: {
          deviceLabel: { kind: 'unavailable' },
          logicalProcessorCount: { kind: 'unavailable' },
          totalMemoryBytes: { kind: 'unavailable' },
        },
      },
    });
    expect(result.artifactScannedFiles).toBeGreaterThan(0);
  });

  it('production smoke refuses a fixture module load', () => {
    const result = inspectProductionSmokeEvidence({
      expectedEntry: new URL(
        '../../../packages/desktop-production-reference/dist/index.js',
        import.meta.url,
      ),
      loadedModule: new URL('../fixtures/production-fixture-type.ts', import.meta.url).href,
      boundary: {
        mode: 'production',
        identity: {
          adapterId: 'liiiraa-desktop-production-unavailable',
          adapterVersion: '1.0.0',
        },
        schemaVersion: '1.0',
        result: { ok: true },
      },
    });

    expect(result.ok).toBe(false);
    expect(result.findings).toEqual([
      {
        code: 'ENTRY_MISMATCH',
        path: '$.loadedModule',
      },
    ]);
  });

  it('production smoke refuses a fixture response', () => {
    const entry = new URL(
      '../../../packages/desktop-production-reference/dist/index.js',
      import.meta.url,
    );
    const result = inspectProductionSmokeEvidence({
      expectedEntry: entry,
      loadedModule: entry.href,
      boundary: {
        mode: 'production',
        identity: {
          adapterId: 'liiiraa-desktop-production-unavailable',
          adapterVersion: '1.0.0',
        },
        schemaVersion: '1.0',
        result: {
          ok: true,
          value: {
            cpu: {
              kind: 'fixture',
              scenarioId: 'forbidden-smoke-fixture',
            },
          },
        },
      },
    });

    expect(result.ok).toBe(false);
    expect(result.findings).toEqual([
      {
        code: 'FIXTURE_PROVENANCE',
        path: '$.result.value.cpu',
      },
    ]);
  });
});
