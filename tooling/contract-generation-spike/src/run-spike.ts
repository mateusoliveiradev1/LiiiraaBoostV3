import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  NodeHost,
  compile,
  formatDiagnostic,
  type CompilerOptions,
} from '@typespec/compiler';

const PACKAGE_ROOT = fileURLToPath(new URL('../', import.meta.url));
const FIXTURE_PATH = join(PACKAGE_ROOT, 'fixtures', 'spike.tsp');

export const GENERATED_SCHEMA_PATH = join(
  PACKAGE_ROOT,
  'generated',
  'spike.schema.json',
);

export interface SpikeSchemaEvidence {
  readonly representation: 'reusable-envelope';
  readonly provenanceKinds: readonly string[];
  readonly closedObjectCount: number;
  readonly minimum: number;
  readonly maximum: number;
  readonly minItems: number;
  readonly maxItems: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }

  return value;
}

function stableJson(value: unknown): string {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

function isClosedObjectSchema(schema: Record<string, unknown>): boolean {
  if (schema['additionalProperties'] === false) {
    return true;
  }

  const unevaluated = schema['unevaluatedProperties'];
  return (
    isRecord(unevaluated) &&
    isRecord(unevaluated['not']) &&
    Object.keys(unevaluated['not']).length === 0
  );
}

function collectEvidence(schema: Record<string, unknown>): SpikeSchemaEvidence {
  const provenanceKinds = new Set<string>();
  let closedObjectCount = 0;
  let minimum: number | undefined;
  let maximum: number | undefined;
  let minItems: number | undefined;
  let maxItems: number | undefined;

  function visit(value: unknown): void {
    if (Array.isArray(value)) {
      for (const entry of value) {
        visit(entry);
      }
      return;
    }

    if (!isRecord(value)) {
      return;
    }

    if (isClosedObjectSchema(value)) {
      closedObjectCount += 1;
    }

    const properties = value['properties'];
    if (isRecord(properties)) {
      const kind = properties['kind'];
      if (
        isRecord(kind) &&
        typeof kind['const'] === 'string' &&
        kind['const'] !== 'spike'
      ) {
        provenanceKinds.add(kind['const']);
      }

      const confidence = properties['confidence'];
      if (isRecord(confidence)) {
        if (typeof confidence['minimum'] === 'number') {
          minimum = confidence['minimum'];
        }
        if (typeof confidence['maximum'] === 'number') {
          maximum = confidence['maximum'];
        }
      }

      const samples = properties['samples'];
      if (isRecord(samples)) {
        if (typeof samples['minItems'] === 'number') {
          minItems = samples['minItems'];
        }
        if (typeof samples['maxItems'] === 'number') {
          maxItems = samples['maxItems'];
        }
      }
    }

    for (const entry of Object.values(value)) {
      visit(entry);
    }
  }

  visit(schema);

  if (
    minimum === undefined ||
    maximum === undefined ||
    minItems === undefined ||
    maxItems === undefined
  ) {
    throw new Error('Emitted schema lost one or more declared numeric or array bounds.');
  }

  if (provenanceKinds.size !== 5) {
    throw new Error(
      `Emitted schema has ${String(provenanceKinds.size)} provenance discriminators; expected 5.`,
    );
  }

  if (closedObjectCount < 8) {
    throw new Error(
      `Emitted schema has ${String(closedObjectCount)} closed object definitions; expected at least 8.`,
    );
  }

  return {
    representation: 'reusable-envelope',
    provenanceKinds: [...provenanceKinds].sort(),
    closedObjectCount,
    minimum,
    maximum,
    minItems,
    maxItems,
  };
}

async function compileSchema(): Promise<Record<string, unknown>> {
  const stagingDirectory = await mkdtemp(join(tmpdir(), 'liiiraa-typespec-spike-'));
  const emittedPath = join(stagingDirectory, 'spike.schema.json');
  const compilerOptions: CompilerOptions = {
    emit: ['@typespec/json-schema'],
    options: {
      '@typespec/json-schema': {
        'emitter-output-dir': stagingDirectory,
        'file-type': 'json',
        'seal-object-schemas': true,
        bundleId: 'spike.schema.json',
        emitAllRefs: true,
      },
    },
    outputDir: stagingDirectory,
    warningAsError: true,
  };

  try {
    const program = await compile(NodeHost, FIXTURE_PATH, compilerOptions);
    if (program.hasError()) {
      const diagnostics = program.diagnostics.map((diagnostic) =>
        formatDiagnostic(diagnostic),
      );
      throw new Error(`TypeSpec compilation failed:\n${diagnostics.join('\n')}`);
    }

    const emitted = JSON.parse(await readFile(emittedPath, 'utf8')) as unknown;
    if (!isRecord(emitted)) {
      throw new Error('TypeSpec emitted a non-object JSON Schema document.');
    }
    return emitted;
  } finally {
    await rm(stagingDirectory, { force: true, recursive: true });
  }
}

async function atomicWrite(path: string, contents: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${String(process.pid)}.tmp`;

  try {
    await writeFile(temporaryPath, contents, 'utf8');
    await rename(temporaryPath, path);
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

export async function emitSpikeSchema(): Promise<SpikeSchemaEvidence> {
  const schema = await compileSchema();
  const evidence = collectEvidence(schema);
  await atomicWrite(GENERATED_SCHEMA_PATH, stableJson(schema));
  return evidence;
}

export async function readPersistedSchema(): Promise<string> {
  return readFile(GENERATED_SCHEMA_PATH, 'utf8');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const evidence = await emitSpikeSchema();
  console.log(JSON.stringify(evidence));
}
