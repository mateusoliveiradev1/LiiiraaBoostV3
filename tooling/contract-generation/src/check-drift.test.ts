import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { compareGeneratedArtifacts, findHandwrittenTransportDeclarations } from './check-drift.ts';

function assertDeepEqual(actual: unknown, expected: unknown, message: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${message}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`,
    );
  }
}

const expectedArtifacts = new Map([
  ['contracts/generated/desktop/v1/message-envelope.schema.json', 'expected\n'],
  ['contracts/generated/desktop/v1/shell-message.schema.json', 'shell\n'],
  ['packages/contracts-ts/src/generated/models.ts', 'models\n'],
]);

assertDeepEqual(
  compareGeneratedArtifacts(
    expectedArtifacts,
    new Map([
      ['contracts/generated/desktop/v1/message-envelope.schema.json', 'changed\n'],
      ['crates/contracts-rust/src/extra.rs', 'extra\n'],
    ]),
  ),
  [
    'changed: contracts/generated/desktop/v1/message-envelope.schema.json',
    'extra: crates/contracts-rust/src/extra.rs',
    'missing: contracts/generated/desktop/v1/shell-message.schema.json',
    'missing: packages/contracts-ts/src/generated/models.ts',
  ],
  'Drift diagnostics must be complete and deterministically sorted.',
);

assertDeepEqual(
  compareGeneratedArtifacts(expectedArtifacts, new Map(expectedArtifacts)),
  [],
  'Identical generated artifacts must pass.',
);

assertDeepEqual(
  findHandwrittenTransportDeclarations([
    {
      path: 'packages/example/src/transport.ts',
      contents: 'export interface InspectSystemRequest { payload: unknown }',
    },
    {
      path: 'crates/example/src/lib.rs',
      contents: 'pub struct DiagnosticValue {}',
    },
    {
      path: 'packages/example/src/shell.ts',
      contents:
        'export type HostToRendererShellEvent = unknown; export interface ShellWindowState {}',
    },
    {
      path: 'packages/example/src/domain.ts',
      contents: 'export interface InspectionSummary { status: string }',
    },
  ]),
  [
    'crates/example/src/lib.rs: handwritten DiagnosticValue declaration',
    'packages/example/src/shell.ts: handwritten HostToRendererShellEvent declaration',
    'packages/example/src/shell.ts: handwritten ShellWindowState declaration',
    'packages/example/src/transport.ts: handwritten InspectSystemRequest declaration',
  ],
  'Handwritten transport declarations must fail without flagging unrelated domain types.',
);

const WEB_CONTRACT_PATH = new URL(
  '../../../packages/contracts-source/src/web.tsp',
  import.meta.url,
);

const REQUIRED_WEB_DECLARATIONS = [
  'WebSurface',
  'WebShell',
  'IndexingPolicy',
  'ValidationState',
  'CapabilityAvailability',
  'SafeContextKey',
  'WebRouteRecord',
  'ContentRecord',
  'ClaimEvidence',
  'ScreenshotProvenance',
  'ReleaseArtifactEvidence',
  'ReleaseRecord',
  'FutureAuthorityCommand',
  'NoChangeReceipt',
  'AdminAuditEvent',
] as const;

function extractDeclarationBody(
  source: string,
  declarationKind: 'model' | 'union',
  declarationName: string,
): string | undefined {
  const declaration = new RegExp(
    `\\b${declarationKind}\\s+${declarationName}\\s*\\{`,
  ).exec(source);
  if (declaration === null) {
    return undefined;
  }

  const openingBrace = source.indexOf('{', declaration.index);
  let depth = 0;
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === '{') {
      depth += 1;
    } else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(openingBrace + 1, index);
      }
    }
  }

  return undefined;
}

function extractUnionLiterals(source: string, unionName: string): string[] {
  const body = extractDeclarationBody(source, 'union', unionName);
  return body === undefined
    ? []
    : [...body.matchAll(/"([^"]+)"/g)].map((match) => match[1] ?? '');
}

function webContractSourceDiagnostics(source: string): string[] {
  const diagnostics: string[] = [];

  for (const declarationName of REQUIRED_WEB_DECLARATIONS) {
    if (
      !new RegExp(`\\b(?:model|union)\\s+${declarationName}\\s*\\{`).test(source)
    ) {
      diagnostics.push(`missing declaration: ${declarationName}`);
    }
  }

  const exactUnions = new Map<string, readonly string[]>([
    ['WebSurface', ['public', 'account', 'admin']],
    ['WebShell', ['public', 'account', 'admin']],
    ['IndexingPolicy', ['index', 'noindex']],
    [
      'ValidationState',
      ['validated', 'under-validation', 'unproven', 'stale'],
    ],
    [
      'CapabilityAvailability',
      [
        'available',
        'demonstrative-preview',
        'under-validation',
        'planned',
        'unsupported',
        'unavailable',
      ],
    ],
    [
      'SafeContextKey',
      ['locale', 'version', 'channel', 'destination', 'return-path'],
    ],
    [
      'OfficialReleaseOrigin',
      ['liiiraa-download-origin', 'liiiraa-release-origin'],
    ],
  ]);

  for (const [unionName, expectedLiterals] of exactUnions) {
    const actualLiterals = extractUnionLiterals(source, unionName);
    if (JSON.stringify(actualLiterals) !== JSON.stringify(expectedLiterals)) {
      diagnostics.push(`${unionName} literals widened or reordered`);
    }
  }

  for (const scalarName of [
    'WebIdentifier',
    'WebText',
    'WebPathnameTemplate',
    'WebUri',
    'Sha256Digest',
  ]) {
    if (
      !new RegExp(
        `@minLength\\([1-9]\\d*\\)\\s*@maxLength\\([1-9]\\d*\\)(?:\\s*@[a-zA-Z]+\\([^\\n]*\\))*\\s*scalar\\s+${scalarName}\\s+extends\\s+string`,
      ).test(source)
    ) {
      diagnostics.push(`unbounded scalar: ${scalarName}`);
    }
  }

  for (const modelName of [
    'WebRouteRecord',
    'ContentRecord',
    'ClaimEvidence',
    'ScreenshotProvenance',
    'ReleaseArtifactEvidence',
    'ReleaseRecord',
    'FutureAuthorityCommand',
    'NoChangeReceipt',
    'AdminAuditEvent',
  ]) {
    const body = extractDeclarationBody(source, 'model', modelName);
    if (body !== undefined && /(?:\.\.\.|\[[^\]]+\]\s*:)/.test(body)) {
      diagnostics.push(`open model: ${modelName}`);
    }
  }

  const routeBody = extractDeclarationBody(source, 'model', 'WebRouteRecord') ?? '';
  if (!/\bsurface\s*:\s*WebSurface\s*;/.test(routeBody)) {
    diagnostics.push('WebRouteRecord.surface must use WebSurface');
  }
  if (
    !/@minItems\(0\)\s*@maxItems\(\d+\)\s*safeContextKeys\s*:\s*SafeContextKey\[\]\s*;/.test(
      routeBody,
    )
  ) {
    diagnostics.push('WebRouteRecord.safeContextKeys must be bounded');
  }

  const receiptBody =
    extractDeclarationBody(source, 'model', 'NoChangeReceipt') ?? '';
  if (!/\bremoteStateChanged\s*:\s*false\s*;/.test(receiptBody)) {
    diagnostics.push('NoChangeReceipt.remoteStateChanged must be literal false');
  }
  if (!/\bprovenance\s*:\s*FixtureDiagnosticValue\s*;/.test(receiptBody)) {
    diagnostics.push('NoChangeReceipt.provenance must be fixture-only');
  }
  if (!/\bnextPhase\s*:\s*"Phase 4"\s*;/.test(receiptBody)) {
    diagnostics.push('NoChangeReceipt.nextPhase must remain Phase 4');
  }

  const futureAuthorityBody =
    extractDeclarationBody(source, 'model', 'FutureAuthorityCommand') ?? '';
  if (!/\bphase\s*:\s*"Phase 4"\s*;/.test(futureAuthorityBody)) {
    diagnostics.push('FutureAuthorityCommand.phase must remain Phase 4');
  }

  const contentBody =
    extractDeclarationBody(source, 'model', 'ContentRecord') ?? '';
  if (
    !/\blocale\s*:\s*ShellLocale\s*;/.test(contentBody) ||
    !/\bversion\s*:\s*ShellVersion\s*;/.test(contentBody) ||
    !/\bchannel\s*:\s*ShellReleaseChannel\s*;/.test(contentBody)
  ) {
    diagnostics.push('ContentRecord must reuse closed shell locale/version/channel');
  }

  const artifactBody =
    extractDeclarationBody(source, 'model', 'ReleaseArtifactEvidence') ?? '';
  if (!/\borigin\s*:\s*OfficialReleaseOrigin\s*;/.test(artifactBody)) {
    diagnostics.push('ReleaseArtifactEvidence.origin must be official-only');
  }

  const releaseBody = extractDeclarationBody(source, 'model', 'ReleaseRecord') ?? '';
  if (!/\bpublicDistributionApproved\s*:\s*false\s*;/.test(releaseBody)) {
    diagnostics.push('ReleaseRecord approval must remain literal false');
  }
  if (!/\bofficialArtifact\s*:\s*"unavailable"\s*;/.test(releaseBody)) {
    diagnostics.push('ReleaseRecord official artifact must remain unavailable');
  }

  if (
    /@(?:route|get|post|put|patch|delete)\b|\bop\s+\w+|\b(?:script|commandText)\s*:|https?:\/\/(?:localhost|127\.0\.0\.1)/i.test(
      source,
    )
  ) {
    diagnostics.push('web contract grants forbidden operation or development artifact');
  }

  return diagnostics.sort();
}

const webContractSource = await readFile(
  fileURLToPath(WEB_CONTRACT_PATH),
  'utf8',
);

assertDeepEqual(
  webContractSourceDiagnostics(webContractSource),
  [],
  'web contract source must remain closed and authority-safe.',
);

const webContractMutations = [
  {
    name: 'fixture provenance widening',
    source: webContractSource.replace(
      'provenance: FixtureDiagnosticValue;',
      'provenance: DiagnosticValue;',
    ),
  },
  {
    name: 'remote state widening',
    source: webContractSource.replace(
      'remoteStateChanged: false;',
      'remoteStateChanged: boolean;',
    ),
  },
  {
    name: 'official origin widening',
    source: webContractSource.replace(
      'origin: OfficialReleaseOrigin;',
      'origin: WebUri;',
    ),
  },
  {
    name: 'route surface widening',
    source: webContractSource.replace(
      'admin: "admin",',
      'admin: "admin", support: "support",',
    ),
  },
  {
    name: 'distribution approval widening',
    source: webContractSource.replace(
      'publicDistributionApproved: false;',
      'publicDistributionApproved: boolean;',
    ),
  },
] as const;

for (const mutation of webContractMutations) {
  if (webContractSourceDiagnostics(mutation.source).length === 0) {
    throw new Error(`web contract source mutation survived: ${mutation.name}`);
  }
}

console.log('Contract drift comparison tests passed.');
