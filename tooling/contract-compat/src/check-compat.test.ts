import acceptedFixture from '../fixtures/accepted-change.json' with { type: 'json' };
import breakingFixture from '../fixtures/breaking-change.json' with { type: 'json' };
import { checkApprovedBaseline, evaluateCompatibilityFixture } from './check-compat.ts';

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

assert(
  acceptedFixture.cases.length === acceptedFixture.expectedCaseCount,
  `Accepted fixture count drifted: expected ${String(acceptedFixture.expectedCaseCount)}.`,
);
assert(
  breakingFixture.cases.length === breakingFixture.expectedCaseCount,
  `Breaking fixture count drifted: expected ${String(breakingFixture.expectedCaseCount)}.`,
);

const acceptedResults = evaluateCompatibilityFixture(acceptedFixture);
const breakingResults = evaluateCompatibilityFixture(breakingFixture);

assert(
  acceptedResults.length === acceptedFixture.expectedCaseCount,
  'Every accepted compatibility case must execute.',
);
assert(
  breakingResults.length === breakingFixture.expectedCaseCount,
  'Every breaking compatibility case must execute.',
);
assert(
  acceptedResults.every((result) => result.compatible),
  `Accepted cases failed: ${JSON.stringify(acceptedResults)}`,
);
assert(
  breakingResults.every((result) => !result.compatible),
  `Breaking cases passed: ${JSON.stringify(breakingResults)}`,
);
assert(
  breakingResults.every((result) => result.diagnostics.length > 0),
  'Every rejected case must explain the incompatibility.',
);

const approvedBaselineResult = await checkApprovedBaseline();
assert(
  approvedBaselineResult.compatible,
  `Approved baseline must pass: ${JSON.stringify(approvedBaselineResult)}`,
);

console.log(
  `Contract compatibility fixture tests passed (${String(acceptedResults.length)} accepted, ${String(breakingResults.length)} breaking).`,
);
