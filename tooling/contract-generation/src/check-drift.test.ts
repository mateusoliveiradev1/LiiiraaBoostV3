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
      path: 'packages/example/src/domain.ts',
      contents: 'export interface InspectionSummary { status: string }',
    },
  ]),
  [
    'crates/example/src/lib.rs: handwritten DiagnosticValue declaration',
    'packages/example/src/transport.ts: handwritten InspectSystemRequest declaration',
  ],
  'Handwritten transport declarations must fail without flagging unrelated domain types.',
);

console.log('Contract drift comparison tests passed.');
