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
import { Ajv2020, type ValidateFunction } from 'ajv/dist/2020.js';
import { compile as compileTypeScript } from 'json-schema-to-typescript';

const PACKAGE_ROOT = fileURLToPath(new URL('../', import.meta.url));
const FIXTURE_PATH = join(PACKAGE_ROOT, 'fixtures', 'spike.tsp');
const VALID_FIXTURE_PATH = join(PACKAGE_ROOT, 'fixtures', 'valid.json');
const INVALID_FIXTURE_PATH = join(PACKAGE_ROOT, 'fixtures', 'invalid.json');

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

export interface SpikeVectorEvidence {
  readonly representation: 'reusable-envelope';
  readonly validCases: readonly string[];
  readonly invalidCases: readonly string[];
  readonly generatedTypeScript: string;
}

interface VectorCase {
  readonly name: string;
  readonly value: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readVectorCases(value: unknown, fixtureName: string): readonly VectorCase[] {
  if (!isRecord(value) || !Array.isArray(value['cases'])) {
    throw new Error(`${fixtureName} must contain a cases array.`);
  }

  return value['cases'].map((entry, index) => {
    if (
      !isRecord(entry) ||
      typeof entry['name'] !== 'string' ||
      !('value' in entry)
    ) {
      throw new Error(`${fixtureName} case ${String(index)} is malformed.`);
    }

    return {
      name: entry['name'],
      value: entry['value'],
    };
  });
}

function schemaDefinitions(
  schema: Record<string, unknown>,
): Record<string, Record<string, unknown>> {
  const definitions = schema['$defs'];
  if (!isRecord(definitions)) {
    throw new Error('Persisted schema does not contain a $defs object.');
  }

  const result: Record<string, Record<string, unknown>> = {};
  for (const [name, definition] of Object.entries(definitions)) {
    if (!isRecord(definition)) {
      throw new Error(`Persisted schema definition ${name} is not an object.`);
    }
    result[name] = definition;
  }
  return result;
}

function createEnvelopeValidator(
  definitions: Record<string, Record<string, unknown>>,
): ValidateFunction {
  const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
    validateSchema: true,
  });

  for (const definition of Object.values(definitions)) {
    ajv.addSchema(definition);
  }

  const validator = ajv.getSchema('SpikeEnvelope.json');
  if (validator === undefined) {
    throw new Error('Ajv could not resolve the persisted SpikeEnvelope definition.');
  }
  return validator;
}

function rebaseForTypeScript(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => rebaseForTypeScript(entry));
  }

  if (!isRecord(value)) {
    return value;
  }

  const rebased: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (key === '$ref' && typeof entry === 'string' && entry.endsWith('.json')) {
      rebased[key] = `#/$defs/${entry.slice(0, -'.json'.length)}`;
      continue;
    }

    if (key === 'unevaluatedProperties' && isClosedObjectSchema(value)) {
      rebased['additionalProperties'] = false;
      continue;
    }

    rebased[key] = rebaseForTypeScript(entry);
  }
  return rebased;
}

async function generateTypeScript(
  definitions: Record<string, Record<string, unknown>>,
): Promise<string> {
  const envelope = definitions['SpikeEnvelope'];
  if (envelope === undefined) {
    throw new Error('Persisted schema does not contain SpikeEnvelope.');
  }

  const generatorSchema = rebaseForTypeScript({
    ...envelope,
    $defs: definitions,
  });
  if (!isRecord(generatorSchema)) {
    throw new Error('Could not build the TypeScript generator schema.');
  }

  return compileTypeScript(
    generatorSchema,
    'SpikeEnvelope',
    {
      additionalProperties: false,
      bannerComment: '',
      style: {
        singleQuote: true,
      },
      unknownAny: false,
    },
  );
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

export async function validateSpikeVectors(): Promise<SpikeVectorEvidence> {
  await emitSpikeSchema();
  const schemaValue = JSON.parse(await readPersistedSchema()) as unknown;
  if (!isRecord(schemaValue)) {
    throw new Error('Persisted schema is not a JSON object.');
  }

  const definitions = schemaDefinitions(schemaValue);
  const validateEnvelope = createEnvelopeValidator(definitions);
  const validCases = readVectorCases(
    JSON.parse(await readFile(VALID_FIXTURE_PATH, 'utf8')) as unknown,
    'valid.json',
  );
  const invalidCases = readVectorCases(
    JSON.parse(await readFile(INVALID_FIXTURE_PATH, 'utf8')) as unknown,
    'invalid.json',
  );

  for (const vector of validCases) {
    if (!validateEnvelope(vector.value)) {
      throw new Error(
        `Expected valid vector "${vector.name}" to pass: ${JSON.stringify(validateEnvelope.errors)}`,
      );
    }
  }

  for (const vector of invalidCases) {
    if (validateEnvelope(vector.value)) {
      throw new Error(`Expected invalid vector "${vector.name}" to fail.`);
    }
  }

  return {
    representation: 'reusable-envelope',
    validCases: validCases.map((vector) => vector.name),
    invalidCases: invalidCases.map((vector) => vector.name),
    generatedTypeScript: await generateTypeScript(definitions),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const evidence = await validateSpikeVectors();
  console.log(
    JSON.stringify({
      representation: evidence.representation,
      validCases: evidence.validCases,
      invalidCases: evidence.invalidCases,
      generatedTypeScriptBytes: evidence.generatedTypeScript.length,
    }),
  );
}
