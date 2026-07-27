import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type JsonObject = Record<string, unknown>;

interface MajorTransitionApproval {
  readonly fromMajor: number;
  readonly toMajor: number;
  readonly approvedBy: string;
  readonly decision: string;
}

interface ContractSnapshot {
  readonly contractVersion: string;
  readonly majorTransitionApproval?: MajorTransitionApproval;
  readonly http: JsonObject;
  readonly desktop: Readonly<Record<string, JsonObject>>;
}

export interface CompatibilityResult {
  readonly id: string;
  readonly compatible: boolean;
  readonly diagnostics: readonly string[];
}

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const DEFAULT_BASELINE_PATH = join(
  REPOSITORY_ROOT,
  'tooling',
  'contract-compat',
  'fixtures',
  'versioned-baseline.json',
);
const CURRENT_OPENAPI_PATH = join(
  REPOSITORY_ROOT,
  'contracts',
  'generated',
  'http',
  'openapi.json',
);
const CURRENT_DESKTOP_PATHS = Object.freeze([
  join(REPOSITORY_ROOT, 'contracts', 'generated', 'desktop', 'v1', 'diagnostic-value.schema.json'),
  join(REPOSITORY_ROOT, 'contracts', 'generated', 'desktop', 'v1', 'inspect-system.schema.json'),
  join(REPOSITORY_ROOT, 'contracts', 'generated', 'desktop', 'v1', 'message-envelope.schema.json'),
]);
const EXACT_SCHEMA_KEYWORDS = Object.freeze([
  '$ref',
  'const',
  'enum',
  'type',
  'oneOf',
  'anyOf',
  'allOf',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'minLength',
  'maxLength',
  'minItems',
  'maxItems',
  'additionalProperties',
  'unevaluatedProperties',
]);

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stableValue(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableValue).join(',')}]`;
  }

  if (!isJsonObject(value)) {
    return JSON.stringify(value);
  }

  return `{${Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableValue(entry)}`)
    .join(',')}}`;
}

function parseSemver(version: string): readonly [number, number, number] {
  const match = /^(\d+)\.(\d+)\.(\d+)$/u.exec(version);
  if (match === null) {
    throw new Error(`Invalid contract SemVer: ${version}`);
  }

  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareVersions(
  baselineVersion: string,
  candidateVersion: string,
  artifactsChanged: boolean,
): string[] {
  const baseline = parseSemver(baselineVersion);
  const candidate = parseSemver(candidateVersion);
  const baselineNumber = baseline[0] * 1_000_000 + baseline[1] * 1_000 + baseline[2];
  const candidateNumber = candidate[0] * 1_000_000 + candidate[1] * 1_000 + candidate[2];
  const diagnostics: string[] = [];

  if (candidateNumber < baselineNumber) {
    diagnostics.push(`contract version regressed from ${baselineVersion} to ${candidateVersion}`);
  } else if (artifactsChanged && candidateNumber === baselineNumber) {
    diagnostics.push(`contract artifacts changed without advancing ${baselineVersion}`);
  }

  return diagnostics;
}

function compareRequired(path: string, baseline: unknown, candidate: unknown): string[] {
  const baselineRequired = Array.isArray(baseline)
    ? baseline.filter((entry): entry is string => typeof entry === 'string').sort()
    : [];
  const candidateRequired = Array.isArray(candidate)
    ? candidate.filter((entry): entry is string => typeof entry === 'string').sort()
    : [];

  return stableValue(baselineRequired) === stableValue(candidateRequired)
    ? []
    : [`${path}.required changed`];
}

function compareSchemaNode(path: string, baseline: unknown, candidate: unknown): string[] {
  if (!isJsonObject(baseline) || !isJsonObject(candidate)) {
    return stableValue(baseline) === stableValue(candidate) ? [] : [`${path} changed shape`];
  }

  const diagnostics: string[] = [];
  for (const keyword of EXACT_SCHEMA_KEYWORDS) {
    if (
      Object.hasOwn(baseline, keyword) &&
      stableValue(baseline[keyword]) !== stableValue(candidate[keyword])
    ) {
      diagnostics.push(`${path}.${keyword} changed`);
    }
  }

  diagnostics.push(...compareRequired(path, baseline['required'], candidate['required']));

  const baselineProperties = baseline['properties'];
  const candidateProperties = candidate['properties'];
  if (isJsonObject(baselineProperties)) {
    if (!isJsonObject(candidateProperties)) {
      diagnostics.push(`${path}.properties removed`);
    } else {
      for (const [propertyName, propertySchema] of Object.entries(baselineProperties)) {
        if (!Object.hasOwn(candidateProperties, propertyName)) {
          diagnostics.push(`${path}.properties.${propertyName} removed`);
        } else {
          diagnostics.push(
            ...compareSchemaNode(
              `${path}.properties.${propertyName}`,
              propertySchema,
              candidateProperties[propertyName],
            ),
          );
        }
      }
    }
  }

  const baselineDefinitions = baseline['$defs'];
  const candidateDefinitions = candidate['$defs'];
  if (isJsonObject(baselineDefinitions)) {
    if (!isJsonObject(candidateDefinitions)) {
      diagnostics.push(`${path}.$defs removed`);
    } else {
      for (const [definitionName, definition] of Object.entries(baselineDefinitions)) {
        if (!Object.hasOwn(candidateDefinitions, definitionName)) {
          diagnostics.push(`${path}.$defs.${definitionName} removed`);
        } else {
          diagnostics.push(
            ...compareSchemaNode(
              `${path}.$defs.${definitionName}`,
              definition,
              candidateDefinitions[definitionName],
            ),
          );
        }
      }
    }
  }

  return diagnostics;
}

function hasApprovedMajorTransition(
  baseline: ContractSnapshot,
  candidate: ContractSnapshot,
): boolean {
  const baselineMajor = parseSemver(baseline.contractVersion)[0];
  const candidateMajor = parseSemver(candidate.contractVersion)[0];
  const approval = candidate.majorTransitionApproval;

  if (approval === undefined) {
    return false;
  }

  return (
    candidateMajor > baselineMajor &&
    approval.fromMajor === baselineMajor &&
    approval.toMajor === candidateMajor &&
    approval.approvedBy.trim().length > 0 &&
    approval.decision === 'ADR-0002'
  );
}

export function evaluateContractCompatibility(
  id: string,
  baseline: ContractSnapshot,
  candidate: ContractSnapshot,
  httpDiagnostics: readonly string[] = [],
): CompatibilityResult {
  const diagnostics = [...httpDiagnostics];
  const artifactsChanged =
    stableValue(baseline.http) !== stableValue(candidate.http) ||
    stableValue(baseline.desktop) !== stableValue(candidate.desktop);

  diagnostics.push(
    ...compareVersions(baseline.contractVersion, candidate.contractVersion, artifactsChanged),
  );

  for (const [schemaName, baselineSchema] of Object.entries(baseline.desktop)) {
    const candidateSchema = candidate.desktop[schemaName];
    if (candidateSchema === undefined) {
      diagnostics.push(`desktop.${schemaName} removed`);
    } else {
      diagnostics.push(
        ...compareSchemaNode(`desktop.${schemaName}`, baselineSchema, candidateSchema),
      );
    }
  }

  const uniqueDiagnostics = [...new Set(diagnostics)].sort();
  if (uniqueDiagnostics.length > 0 && hasApprovedMajorTransition(baseline, candidate)) {
    return {
      id,
      compatible: true,
      diagnostics: [],
    };
  }

  return {
    id,
    compatible: uniqueDiagnostics.length === 0,
    diagnostics: uniqueDiagnostics,
  };
}

function requireSnapshot(value: unknown, label: string): ContractSnapshot {
  if (
    !isJsonObject(value) ||
    typeof value['contractVersion'] !== 'string' ||
    !isJsonObject(value['http']) ||
    !isJsonObject(value['desktop'])
  ) {
    throw new Error(`${label} is not a valid contract snapshot.`);
  }

  return value as unknown as ContractSnapshot;
}

export function evaluateCompatibilityFixture(value: unknown): readonly CompatibilityResult[] {
  if (
    !isJsonObject(value) ||
    !Number.isInteger(value['expectedCaseCount']) ||
    !Array.isArray(value['cases']) ||
    value['cases'].length !== value['expectedCaseCount']
  ) {
    throw new Error('Compatibility fixture case count is invalid.');
  }

  return value['cases'].map((entry, index) => {
    if (!isJsonObject(entry) || typeof entry['id'] !== 'string') {
      throw new Error(`Compatibility fixture case ${String(index)} is invalid.`);
    }

    return evaluateContractCompatibility(
      entry['id'],
      requireSnapshot(entry['baseline'], `${entry['id']}.baseline`),
      requireSnapshot(entry['candidate'], `${entry['id']}.candidate`),
    );
  });
}

function executeOasdiff(arguments_: string[]): Promise<string> {
  return new Promise((resolvePromise, rejectPromise) => {
    execFile(
      'oasdiff',
      arguments_,
      {
        cwd: REPOSITORY_ROOT,
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        if (error === null) {
          resolvePromise('');
          return;
        }

        if (error.code === 'ENOENT') {
          rejectPromise(
            new Error('oasdiff 1.26.0 is required when the approved HTTP baseline changes.'),
          );
          return;
        }

        resolvePromise((stdout.trim() || stderr.trim() || error.message).trim());
      },
    );
  });
}

async function compareHttpWithOasdiff(
  baseline: JsonObject,
  candidate: JsonObject,
): Promise<string[]> {
  if (stableValue(baseline) === stableValue(candidate)) {
    return [];
  }

  const stagingRoot = await mkdtemp(join(tmpdir(), 'liiiraa-oasdiff-'));
  const baselinePath = join(stagingRoot, 'baseline.json');
  const candidatePath = join(stagingRoot, 'candidate.json');

  try {
    await writeFile(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8');
    await writeFile(candidatePath, `${JSON.stringify(candidate, null, 2)}\n`, 'utf8');
    const report = await executeOasdiff([
      'breaking',
      baselinePath,
      candidatePath,
      '--format',
      'json',
    ]);

    return report.length === 0 ? [] : [`HTTP oasdiff: ${report}`];
  } finally {
    await rm(stagingRoot, { force: true, recursive: true });
  }
}

async function readJsonObject(path: string): Promise<JsonObject> {
  const value: unknown = JSON.parse(await readFile(path, 'utf8'));
  if (!isJsonObject(value)) {
    throw new Error(`${path} must contain a JSON object.`);
  }
  return value;
}

async function readCurrentSnapshot(): Promise<ContractSnapshot> {
  const http = await readJsonObject(CURRENT_OPENAPI_PATH);
  const info = http['info'];
  if (!isJsonObject(info) || typeof info['version'] !== 'string') {
    throw new Error('Current OpenAPI artifact does not declare info.version.');
  }

  const desktopEntries = await Promise.all(
    CURRENT_DESKTOP_PATHS.map(
      async (path) => [basename(path), await readJsonObject(path)] as const,
    ),
  );

  return {
    contractVersion: info['version'],
    http,
    desktop: Object.fromEntries(desktopEntries),
  };
}

export async function checkApprovedBaseline(
  baselinePath = DEFAULT_BASELINE_PATH,
): Promise<CompatibilityResult> {
  const baselineDocument = await readJsonObject(baselinePath);
  const baseline = requireSnapshot(baselineDocument, 'approved baseline');
  const candidate = await readCurrentSnapshot();
  const httpDiagnostics = await compareHttpWithOasdiff(baseline.http, candidate.http);

  return evaluateContractCompatibility(
    'approved-versioned-baseline',
    baseline,
    candidate,
    httpDiagnostics,
  );
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isDirectExecution) {
  const baselineArgumentIndex = process.argv.indexOf('--baseline');
  const baselinePath =
    baselineArgumentIndex === -1 ? DEFAULT_BASELINE_PATH : process.argv[baselineArgumentIndex + 1];

  if (baselinePath === undefined) {
    console.error('--baseline requires a path.');
    process.exitCode = 1;
  } else {
    try {
      const result = await checkApprovedBaseline(resolve(baselinePath));
      if (!result.compatible) {
        throw new Error(`Contract compatibility failed:\n${result.diagnostics.join('\n')}`);
      }
      console.log('Contract compatibility check passed against approved baseline.');
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  }
}
