import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const DEFAULT_CORPUS_ROOT = resolve(REPOSITORY_ROOT, 'contracts', 'corpus');
const MANIFEST_NAME = 'manifest.json';
const SYNTHETIC_SENTINEL = 'LIIIRAA_SYNTHETIC_CONTRACT_VECTOR_ONLY';
const FROZEN_CLOCK = '2000-01-01T00:00:00.000Z';
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const SAFE_PATH_SEGMENT = /^[a-z0-9][a-z0-9.-]*$/u;
const VECTOR_ID_PATTERN = /^synthetic-(?:valid|invalid)-[a-z0-9-]+$/u;

class CorpusIntegrityError extends Error {
  constructor(message) {
    super(`Corpus integrity failed: ${message}`);
    this.name = 'CorpusIntegrityError';
  }
}

function assertIntegrity(condition, message) {
  if (!condition) {
    throw new CorpusIntegrityError(message);
  }
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertObject(value, label) {
  assertIntegrity(isObject(value), `${label} must be a JSON object.`);
  return value;
}

function assertExactKeys(value, expectedKeys, label) {
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  assertIntegrity(
    JSON.stringify(actual) === JSON.stringify(expected),
    `${label} must contain exactly: ${expected.join(', ')}.`,
  );
}

function assertNonEmptyString(value, label) {
  assertIntegrity(typeof value === 'string' && value.trim().length > 0, `${label} is required.`);
  return value;
}

function resolveSafeRelativePath(base, path, label) {
  const candidate = assertNonEmptyString(path, label);
  assertIntegrity(!isAbsolute(candidate), `${label} must be relative.`);
  assertIntegrity(!candidate.includes('\\'), `${label} must use forward slashes.`);

  const segments = candidate.split('/');
  assertIntegrity(
    segments.every(
      (segment) =>
        segment !== '' && segment !== '.' && segment !== '..' && SAFE_PATH_SEGMENT.test(segment),
    ),
    `${label} contains an unsafe path segment.`,
  );

  const resolved = resolve(base, ...segments);
  const relation = relative(base, resolved);
  assertIntegrity(
    relation !== '' && !relation.startsWith('..') && !isAbsolute(relation),
    `${label} escapes its owned root.`,
  );
  return resolved;
}

async function readJson(path, label) {
  let text;
  try {
    text = await readFile(path, 'utf8');
  } catch {
    throw new CorpusIntegrityError(`${label} is missing or unreadable.`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new CorpusIntegrityError(`${label} is not valid JSON.`);
  }
}

async function listJsonFiles(root, prefix = '') {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    throw new CorpusIntegrityError(`matrix directory ${prefix || '.'} is missing or unreadable.`);
  }

  const paths = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const portablePath = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    const absolutePath = resolve(root, entry.name);
    if (entry.isDirectory()) {
      paths.push(...(await listJsonFiles(absolutePath, portablePath)));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      paths.push(portablePath);
    }
  }
  return paths;
}

function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

async function loadCorpusBundle(corpusRoot) {
  const manifest = await readJson(resolve(corpusRoot, MANIFEST_NAME), MANIFEST_NAME);
  const matrices = new Map();
  const manifestObject = assertObject(manifest, 'manifest');

  if (Array.isArray(manifestObject.matrices)) {
    for (const matrix of manifestObject.matrices) {
      if (isObject(matrix) && typeof matrix.path === 'string') {
        const path = resolveSafeRelativePath(corpusRoot, matrix.path, 'matrix path');
        matrices.set(matrix.path, await readJson(path, `matrix ${matrix.path}`));
      }
    }
  }

  const diskMatrixPaths = [
    ...(await listJsonFiles(resolve(corpusRoot, 'valid'), 'valid')),
    ...(await listJsonFiles(resolve(corpusRoot, 'invalid'), 'invalid')),
  ].sort();

  const schemaTexts = new Map();
  if (Array.isArray(manifestObject.schemas)) {
    for (const schema of manifestObject.schemas) {
      if (isObject(schema) && typeof schema.path === 'string') {
        const path = resolveSafeRelativePath(REPOSITORY_ROOT, schema.path, 'schema path');
        let text;
        try {
          text = await readFile(path, 'utf8');
        } catch {
          throw new CorpusIntegrityError(`schema ${schema.path} is missing or unreadable.`);
        }
        schemaTexts.set(schema.path, text);
      }
    }
  }

  return { manifest, matrices, diskMatrixPaths, schemaTexts };
}

function assertSyntheticPayload(payload, vectorId) {
  const serialized = JSON.stringify(payload);
  assertIntegrity(
    serialized.includes('SYNTHETIC'),
    `vector ${vectorId} payload lacks the synthetic sentinel.`,
  );

  if (Object.hasOwn(payload, 'value')) {
    assertIntegrity(
      typeof payload.value === 'string' && payload.value.startsWith('SYNTHETIC_'),
      `vector ${vectorId} value must be an unmistakably synthetic string.`,
    );
  }

  const visit = (value, key = '') => {
    if (Array.isArray(value)) {
      value.forEach((entry) => visit(entry, key));
      return;
    }
    if (!isObject(value)) {
      if (key.endsWith('At')) {
        assertIntegrity(
          value === FROZEN_CLOCK,
          `vector ${vectorId} timestamp ${key} must use the frozen corpus clock.`,
        );
      }
      return;
    }
    for (const [childKey, childValue] of Object.entries(value)) {
      visit(childValue, childKey);
    }
  };
  visit(payload);
}

function validateCorpusBundle(bundle) {
  const manifest = assertObject(bundle.manifest, 'manifest');
  assertExactKeys(
    manifest,
    [
      'corpusVersion',
      'syntheticSentinel',
      'schemas',
      'matrices',
      'requiredClasses',
      'expectedCounts',
    ],
    'manifest',
  );

  const corpusVersion = assertNonEmptyString(manifest.corpusVersion, 'manifest corpusVersion');
  assertIntegrity(
    manifest.syntheticSentinel === SYNTHETIC_SENTINEL,
    'manifest synthetic sentinel is missing or changed.',
  );

  assertIntegrity(
    Array.isArray(manifest.schemas) && manifest.schemas.length > 0,
    'schemas are required.',
  );
  const knownSchemaIds = new Set();
  const knownSchemaPaths = new Set();
  for (const [index, schemaValue] of manifest.schemas.entries()) {
    const schema = assertObject(schemaValue, `schema ${String(index)}`);
    assertExactKeys(schema, ['id', 'path', 'sha256'], `schema ${String(index)}`);
    const id = assertNonEmptyString(schema.id, `schema ${String(index)} id`);
    const path = assertNonEmptyString(schema.path, `schema ${id} path`);
    resolveSafeRelativePath(REPOSITORY_ROOT, path, `schema ${id} path`);
    assertIntegrity(
      path.startsWith('contracts/generated/'),
      `schema ${id} path must remain under contracts/generated.`,
    );
    assertIntegrity(!knownSchemaIds.has(id), `duplicate schema id ${id}.`);
    assertIntegrity(!knownSchemaPaths.has(path), `duplicate schema path ${path}.`);
    assertIntegrity(
      typeof schema.sha256 === 'string' && SHA256_PATTERN.test(schema.sha256),
      `schema ${id} must declare a lowercase SHA-256 digest.`,
    );
    const schemaText = bundle.schemaTexts.get(path);
    assertIntegrity(schemaText !== undefined, `schema ${path} was not loaded.`);
    assertIntegrity(sha256(schemaText) === schema.sha256, `schema ${id} digest does not match.`);
    knownSchemaIds.add(id);
    knownSchemaPaths.add(path);
  }

  const requiredClasses = assertObject(manifest.requiredClasses, 'requiredClasses');
  assertExactKeys(requiredClasses, ['valid', 'invalid'], 'requiredClasses');
  const expectedCounts = assertObject(manifest.expectedCounts, 'expectedCounts');
  assertExactKeys(expectedCounts, ['valid', 'invalid', 'total'], 'expectedCounts');

  assertIntegrity(Array.isArray(manifest.matrices), 'matrices must be an array.');
  const listedMatrixPaths = [];
  const seenVectorIds = new Set();
  const actualClasses = { valid: [], invalid: [] };
  const actualCounts = { valid: 0, invalid: 0 };

  for (const [matrixIndex, matrixValue] of manifest.matrices.entries()) {
    const matrix = assertObject(matrixValue, `matrix ${String(matrixIndex)}`);
    assertExactKeys(
      matrix,
      ['path', 'expectedVerdict', 'expectedCount'],
      `matrix ${String(matrixIndex)}`,
    );
    const path = assertNonEmptyString(matrix.path, `matrix ${String(matrixIndex)} path`);
    resolveSafeRelativePath(DEFAULT_CORPUS_ROOT, path, `matrix ${String(matrixIndex)} path`);
    assertIntegrity(!listedMatrixPaths.includes(path), `duplicate matrix path ${path}.`);
    listedMatrixPaths.push(path);

    const verdict = matrix.expectedVerdict;
    assertIntegrity(
      verdict === 'valid' || verdict === 'invalid',
      `matrix ${path} has an unsupported expected verdict.`,
    );
    assertIntegrity(
      Number.isSafeInteger(matrix.expectedCount) && matrix.expectedCount >= 0,
      `matrix ${path} expectedCount must be a non-negative integer.`,
    );

    const matrixDocument = assertObject(bundle.matrices.get(path), `matrix ${path}`);
    assertExactKeys(
      matrixDocument,
      ['corpusVersion', 'syntheticSentinel', 'vectors'],
      `matrix ${path}`,
    );
    assertIntegrity(
      matrixDocument.corpusVersion === corpusVersion,
      `matrix ${path} corpus version does not match manifest.`,
    );
    assertIntegrity(
      matrixDocument.syntheticSentinel === SYNTHETIC_SENTINEL,
      `matrix ${path} synthetic sentinel is missing or changed.`,
    );
    assertIntegrity(
      Array.isArray(matrixDocument.vectors),
      `matrix ${path} vectors must be an array.`,
    );
    assertIntegrity(
      matrixDocument.vectors.length === matrix.expectedCount,
      `matrix ${path} expected ${String(matrix.expectedCount)} vectors but found ${String(matrixDocument.vectors.length)}.`,
    );

    for (const [vectorIndex, vectorValue] of matrixDocument.vectors.entries()) {
      const vector = assertObject(vectorValue, `vector ${path}#${String(vectorIndex)}`);
      assertExactKeys(
        vector,
        ['id', 'class', 'schema', 'payload', 'expectedVerdict', 'reason'],
        `vector ${path}#${String(vectorIndex)}`,
      );
      const id = assertNonEmptyString(vector.id, `vector ${path}#${String(vectorIndex)} id`);
      assertIntegrity(VECTOR_ID_PATTERN.test(id), `vector id ${id} is not synthetic and stable.`);
      assertIntegrity(!seenVectorIds.has(id), `duplicate vector id ${id}.`);
      seenVectorIds.add(id);

      const vectorClass = assertNonEmptyString(vector.class, `vector ${id} class`);
      const schema = assertNonEmptyString(vector.schema, `vector ${id} schema`);
      assertIntegrity(
        vector.expectedVerdict === verdict,
        `vector ${id} verdict does not match matrix ${path}.`,
      );
      assertNonEmptyString(vector.reason, `vector ${id} reason`);
      const payload = assertObject(vector.payload, `vector ${id} payload`);
      assertSyntheticPayload(payload, id);

      if (verdict === 'valid') {
        assertIntegrity(
          knownSchemaIds.has(schema),
          `valid vector ${id} uses unknown schema ${schema}.`,
        );
      } else if (vectorClass === 'unknown-schema-version') {
        assertIntegrity(
          !knownSchemaIds.has(schema),
          `unknown-schema-version vector ${id} must name an unknown schema.`,
        );
      } else {
        assertIntegrity(
          knownSchemaIds.has(schema),
          `invalid vector ${id} unexpectedly uses unknown schema ${schema}.`,
        );
      }

      actualClasses[verdict].push(vectorClass);
      actualCounts[verdict] += 1;
    }
  }

  const listedPaths = [...listedMatrixPaths].sort();
  assertIntegrity(
    JSON.stringify(listedPaths) === JSON.stringify(bundle.diskMatrixPaths),
    `manifest matrix inventory differs from disk: listed [${listedPaths.join(', ')}], disk [${bundle.diskMatrixPaths.join(', ')}].`,
  );

  for (const verdict of ['valid', 'invalid']) {
    const required = requiredClasses[verdict];
    assertIntegrity(Array.isArray(required), `requiredClasses.${verdict} must be an array.`);
    assertIntegrity(
      required.every((entry) => typeof entry === 'string' && entry.length > 0),
      `requiredClasses.${verdict} must contain non-empty strings.`,
    );
    assertIntegrity(
      new Set(required).size === required.length,
      `requiredClasses.${verdict} contains duplicate classes.`,
    );
    assertIntegrity(
      JSON.stringify([...actualClasses[verdict]].sort()) === JSON.stringify([...required].sort()),
      `${verdict} classes must each be represented exactly once.`,
    );
    assertIntegrity(
      expectedCounts[verdict] === actualCounts[verdict],
      `expected ${String(expectedCounts[verdict])} ${verdict} vectors but executed ${String(actualCounts[verdict])}.`,
    );
  }

  const total = actualCounts.valid + actualCounts.invalid;
  assertIntegrity(expectedCounts.total === total, `expected total does not equal executed total.`);
  assertIntegrity(
    expectedCounts.total === expectedCounts.valid + expectedCounts.invalid,
    'manifest expected counts do not add up.',
  );

  return { ...actualCounts, total };
}

function cloneBundle(bundle) {
  const cloneJson = (value) => JSON.parse(JSON.stringify(value));
  return {
    manifest: cloneJson(bundle.manifest),
    matrices: new Map(
      [...bundle.matrices.entries()].map(([path, matrix]) => [path, cloneJson(matrix)]),
    ),
    diskMatrixPaths: [...bundle.diskMatrixPaths],
    schemaTexts: new Map(bundle.schemaTexts),
  };
}

function runMutationProofs(bundle) {
  const proofs = [
    {
      name: 'missing',
      mutate(copy) {
        copy.matrices.delete('valid/provenance-vectors.json');
      },
      expected: 'matrix valid/provenance-vectors.json must be a JSON object',
    },
    {
      name: 'duplicate',
      mutate(copy) {
        const matrix = copy.matrices.get('valid/provenance-vectors.json');
        matrix.vectors[1].id = matrix.vectors[0].id;
      },
      expected: 'duplicate vector id',
    },
    {
      name: 'unsafe-path',
      mutate(copy) {
        copy.manifest.matrices[0].path = '../valid/provenance-vectors.json';
      },
      expected: 'contains an unsafe path segment',
    },
    {
      name: 'unlisted',
      mutate(copy) {
        copy.diskMatrixPaths.push('valid/unlisted.json');
        copy.diskMatrixPaths.sort();
      },
      expected: 'manifest matrix inventory differs from disk',
    },
    {
      name: 'non-synthetic',
      mutate(copy) {
        const matrix = copy.matrices.get('valid/provenance-vectors.json');
        matrix.vectors[0].payload.value = 'real-machine-value';
      },
      expected: 'lacks the synthetic sentinel',
    },
    {
      name: 'reasonless',
      mutate(copy) {
        const matrix = copy.matrices.get('invalid/rejection-vectors.json');
        matrix.vectors[0].reason = '';
      },
      expected: 'reason is required',
    },
    {
      name: 'schema-tamper',
      mutate(copy) {
        copy.manifest.schemas[0].sha256 = '0'.repeat(64);
      },
      expected: 'digest does not match',
    },
    {
      name: 'count-tamper',
      mutate(copy) {
        copy.manifest.expectedCounts.total += 1;
      },
      expected: 'expected total does not equal executed total',
    },
  ];

  for (const proof of proofs) {
    const copy = cloneBundle(bundle);
    proof.mutate(copy);
    let diagnostic = '';
    try {
      validateCorpusBundle(copy);
    } catch (error) {
      diagnostic = error instanceof Error ? error.message : String(error);
    }
    assertIntegrity(
      diagnostic.includes(proof.expected),
      `mutation proof ${proof.name} did not fail with its stable diagnostic.`,
    );
  }

  return proofs.length;
}

function parseArguments(args) {
  let corpusRoot = DEFAULT_CORPUS_ROOT;
  let selfTestMutations = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--corpus-root') {
      const value = args[index + 1];
      assertIntegrity(value !== undefined, '--corpus-root requires a path.');
      corpusRoot = resolve(value);
      index += 1;
    } else if (argument === '--self-test-mutations') {
      selfTestMutations = true;
    } else {
      throw new CorpusIntegrityError(`unknown argument ${argument}.`);
    }
  }

  return { corpusRoot, selfTestMutations };
}

export async function checkCorpusIntegrity(options = {}) {
  const corpusRoot = options.corpusRoot ?? DEFAULT_CORPUS_ROOT;
  const bundle = await loadCorpusBundle(corpusRoot);
  const counts = validateCorpusBundle(bundle);
  const mutationProofCount = options.selfTestMutations ? runMutationProofs(bundle) : 0;
  return { counts, mutationProofCount };
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isDirectExecution) {
  try {
    const options = parseArguments(process.argv.slice(2));
    const result = await checkCorpusIntegrity(options);
    console.log(
      `Corpus integrity passed: ${String(result.counts.valid)} valid, ${String(result.counts.invalid)} invalid, ${String(result.counts.total)} total vectors.`,
    );
    if (result.mutationProofCount > 0) {
      console.log(
        `Corpus mutation proofs passed: ${String(result.mutationProofCount)} deterministic failures.`,
      );
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
