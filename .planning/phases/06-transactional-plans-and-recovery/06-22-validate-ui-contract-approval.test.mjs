import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

import {
  ACKNOWLEDGEMENT_STATEMENT,
  DIMENSIONS,
  buildApprovalRecord,
  canonicalizeUiSpec,
  prepareReviewInput,
  renderApprovedUiSpec,
  sha256,
} from "./06-22-validate-ui-contract-approval.mjs";

const REPOSITORY_ROOT = process.cwd();
const PHASE_ROOT = join(
  REPOSITORY_ROOT,
  ".planning",
  "phases",
  "06-transactional-plans-and-recovery",
);
const SCRIPT_PATH = join(PHASE_ROOT, "06-22-validate-ui-contract-approval.mjs");
const LIVE_UI_SPEC_PATH = join(PHASE_ROOT, "06-UI-SPEC.md");
const REVIEW_INPUT_PATH = join(PHASE_ROOT, "06-22-UI-CONTRACT-REVIEW-INPUT.md");
const CHECKER_REPORT_PATH = join(PHASE_ROOT, "06-22-UI-CONTRACT-CHECKER-REPORT.md");
const ACKNOWLEDGED_AT = "2026-08-13T06:55:38.309Z";

function clone(value) {
  return structuredClone(value);
}

function uiSpec({
  newline = "\n",
  status = "pending-review",
  reviewedAt = "2026-08-12T23:58:47.6539196-03:00",
  heading = "# Review subject",
  body = "Copy remains reviewable.",
  table = "| State | Meaning |\n| --- | --- |\n| safe | admitted |",
  signOff = "- [ ] Dimension 1 Copywriting: PASS\n\n**Approval:** pending",
} = {}) {
  return [
    "---",
    "phase: 6",
    `status: ${status}`,
    `reviewed_at: ${reviewedAt}`,
    "created: 2026-08-12",
    "---",
    "",
    heading,
    "",
    body,
    "",
    table,
    "",
    "## Checker Sign-Off",
    "",
    "Mutable checker explanation.",
    "",
    signOff,
    "",
  ].join(newline);
}

function createAuthorityFixture() {
  const directory = mkdtempSync(join(PHASE_ROOT, ".06-22-approval-test-"));
  const reportPath = join(directory, "checker-report.json");
  const approvalPath = join(directory, "approval.json");
  const uiSpecPath = join(directory, "UI-SPEC.md");
  const reportRelativePath = relative(REPOSITORY_ROOT, reportPath).replaceAll("\\", "/");
  const reportBytes = readFileSync(CHECKER_REPORT_PATH);
  const reviewInputBytes = readFileSync(REVIEW_INPUT_PATH);
  const pendingUiSpecBytes = readFileSync(LIVE_UI_SPEC_PATH);
  writeFileSync(reportPath, reportBytes);
  const record = buildApprovalRecord({
    reportPath: reportRelativePath,
    reportBytes,
    subjectBytes: reviewInputBytes,
    acknowledgedBy: "Liiiraa",
    acknowledgedAtUtc: ACKNOWLEDGED_AT,
    statement: ACKNOWLEDGEMENT_STATEMENT,
  });
  const approvedUiSpecBytes = renderApprovedUiSpec(pendingUiSpecBytes, record);
  writeFileSync(approvalPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  writeFileSync(uiSpecPath, approvedUiSpecBytes);
  return {
    directory,
    reportPath,
    reportRelativePath,
    approvalPath,
    uiSpecPath,
    record,
    report: JSON.parse(reportBytes.toString("utf8")),
    approvedUiSpecBytes,
  };
}

function persistFixture(fixture) {
  writeFileSync(fixture.reportPath, `${JSON.stringify(fixture.report, null, 2)}\n`, "utf8");
  writeFileSync(fixture.approvalPath, `${JSON.stringify(fixture.record, null, 2)}\n`, "utf8");
  if (fixture.uiSpecText !== undefined) {
    writeFileSync(fixture.uiSpecPath, fixture.uiSpecText, "utf8");
  }
}

function bindChangedReport(fixture) {
  const reportBytes = Buffer.from(`${JSON.stringify(fixture.report, null, 2)}\n`, "utf8");
  const digest = sha256(reportBytes);
  fixture.record.checkerEvidence.report.digest.value = digest;
  fixture.record.humanAcknowledgement.reportSha256 = digest;
}

function runCheck(fixture, reviewInputPath = REVIEW_INPUT_PATH) {
  return spawnSync(
    process.execPath,
    [SCRIPT_PATH, "--check", fixture.approvalPath, fixture.uiSpecPath, reviewInputPath],
    { cwd: REPOSITORY_ROOT, encoding: "utf8" },
  );
}

function withFixture(callback) {
  const fixture = createAuthorityFixture();
  try {
    return callback(fixture);
  } finally {
    rmSync(fixture.directory, { recursive: true, force: true });
  }
}

function assertRejected(name, mutate) {
  test(name, () =>
    withFixture((fixture) => {
      mutate(fixture);
      persistFixture(fixture);
      const result = runCheck(fixture);
      assert.notEqual(result.status, 0, `${name} unexpectedly passed\n${result.stdout}\n${result.stderr}`);
    }));
}

test("canonicalization normalizes CRLF and emits exactly one final LF", () => {
  const lf = canonicalizeUiSpec(Buffer.from(uiSpec(), "utf8"));
  const crlf = canonicalizeUiSpec(Buffer.from(uiSpec({ newline: "\r\n" }), "utf8"));

  assert.deepEqual(crlf, lf);
  assert.equal(
    lf.toString("utf8"),
    [
      "---",
      "phase: 6",
      "created: 2026-08-12",
      "---",
      "",
      "# Review subject",
      "",
      "Copy remains reviewable.",
      "",
      "| State | Meaning |",
      "| --- | --- |",
      "| safe | admitted |",
      "",
    ].join("\n"),
  );
  assert.equal(lf.at(-1), 0x0a);
  assert.notEqual(lf.at(-2), 0x0a);
});

test("status, reviewed timestamp, and sign-off-only changes preserve the digest", () => {
  const baseline = sha256(canonicalizeUiSpec(Buffer.from(uiSpec(), "utf8")));
  const changedMetadata = uiSpec({
    status: "approved",
    reviewedAt: "2026-08-13T10:11:12.123Z",
    signOff: [
      "- [x] Dimension 1 Copywriting: PASS",
      "- [x] Dimension 2 Visuals: PASS",
      "",
      "**Approval:** approved by independent human",
    ].join("\n"),
  });

  assert.equal(sha256(canonicalizeUiSpec(Buffer.from(changedMetadata, "utf8"))), baseline);
});

for (const [name, mutation] of [
  ["heading", { heading: "# Mutated review subject" }],
  ["body", { body: "Copy was substantively changed." }],
  ["table", { table: "| State | Meaning |\n| --- | --- |\n| unsafe | blocked |" }],
  ["copy", { body: "Copy remains reviewable!" }],
]) {
  test(`a substantive ${name} mutation changes the digest`, () => {
    const baseline = sha256(canonicalizeUiSpec(Buffer.from(uiSpec(), "utf8")));
    const mutated = sha256(canonicalizeUiSpec(Buffer.from(uiSpec(mutation), "utf8")));
    assert.notEqual(mutated, baseline);
  });
}

test("malformed approval boundaries fail closed", async (t) => {
  const cases = [
    ["duplicate frontmatter key", uiSpec().replace("created: 2026-08-12", "status: approved")],
    ["missing frontmatter close", uiSpec().replace("---\n\n# Review subject", "# Review subject")],
    ["missing sign-off", uiSpec().replace("## Checker Sign-Off", "## Independent Review")],
    [
      "duplicate sign-off",
      uiSpec().replace("**Approval:** pending", "## Checker Sign-Off\n\n**Approval:** pending"),
    ],
    [
      "content after sign-off",
      uiSpec().replace("**Approval:** pending\n", "**Approval:** pending\n\n## Later contract\n"),
    ],
    ["content after approval", uiSpec().replace("**Approval:** pending\n", "**Approval:** pending\nextra\n")],
  ];

  for (const [name, input] of cases) {
    await t.test(name, () => {
      assert.throws(() => canonicalizeUiSpec(Buffer.from(input, "utf8")));
    });
  }
});

test("invalid UTF-8 and bare carriage returns fail closed", () => {
  assert.throws(() => canonicalizeUiSpec(Buffer.from([0xc3, 0x28])), /valid UTF-8/u);
  assert.throws(
    () => canonicalizeUiSpec(Buffer.from(uiSpec().replace("phase: 6", "phase:\r6"), "utf8")),
    /bare carriage/u,
  );
});

test("preparation is deterministic and rejects paths outside the repository", () => {
  const fixtureRoot = mkdtempSync(join(REPOSITORY_ROOT, ".planning", "06-22-review-input-test-"));
  const sourcePath = join(fixtureRoot, "UI-SPEC.md");
  const destinationPath = join(fixtureRoot, "REVIEW-INPUT.md");
  const outsideRoot = mkdtempSync(join(tmpdir(), "06-22-outside-"));
  const outsideSource = join(outsideRoot, "UI-SPEC.md");

  try {
    writeFileSync(sourcePath, uiSpec(), "utf8");
    writeFileSync(outsideSource, uiSpec(), "utf8");

    const first = prepareReviewInput(sourcePath, destinationPath, REPOSITORY_ROOT);
    const firstBytes = readFileSync(destinationPath);
    const second = prepareReviewInput(sourcePath, destinationPath, REPOSITORY_ROOT);
    const secondBytes = readFileSync(destinationPath);

    assert.deepEqual(secondBytes, firstBytes);
    assert.deepEqual(second, first);
    assert.equal(first.digest.value, sha256(firstBytes));

    writeFileSync(sourcePath, uiSpec({ body: "Updated before independent review." }), "utf8");
    const refreshed = prepareReviewInput(sourcePath, destinationPath, REPOSITORY_ROOT);
    assert.notEqual(refreshed.digest.value, first.digest.value);
    assert.equal(refreshed.digest.value, sha256(readFileSync(destinationPath)));

    assert.throws(
      () => prepareReviewInput(outsideSource, destinationPath, REPOSITORY_ROOT),
      /outside the repository/u,
    );
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
    rmSync(outsideRoot, { recursive: true, force: true });
  }
});

test("valid independent report, six PASS verdicts, and later acknowledgement pass read-only check", () =>
  withFixture((fixture) => {
    const result = runCheck(fixture);
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.deepEqual(output.dimensions, DIMENSIONS);
    assert.equal(output.acknowledgedBy, "Liiiraa");
    assert.equal(output.acknowledgedAtUtc, ACKNOWLEDGED_AT);
  }));

for (const verdict of ["FAIL", "BLOCK", "FLAG", "UNKNOWN", "FAIL — not PASS"]) {
  assertRejected(`checker verdict ${verdict} exits nonzero`, (fixture) => {
    fixture.report.dimensions[0].verdict = verdict;
    bindChangedReport(fixture);
  });
}

assertRejected("duplicate dimensions exit nonzero", (fixture) => {
  fixture.report.dimensions[5].id = fixture.report.dimensions[0].id;
  bindChangedReport(fixture);
});

for (const dimension of DIMENSIONS) {
  assertRejected(`missing dimension ${dimension} exits nonzero`, (fixture) => {
    fixture.report.dimensions = fixture.report.dimensions.filter((item) => item.id !== dimension);
    bindChangedReport(fixture);
  });
}

assertRejected("unknown extra dimension exits nonzero", (fixture) => {
  fixture.report.dimensions[5].id = "animation";
  bindChangedReport(fixture);
});

for (const key of ["name", "provider", "runId"]) {
  assertRejected(`absent checker identity ${key} exits nonzero`, (fixture) => {
    delete fixture.record.checkerEvidence.checkerIdentity[key];
  });
}

assertRejected("absent report path exits nonzero", (fixture) => {
  delete fixture.record.checkerEvidence.report.path;
});

assertRejected("absent report digest exits nonzero", (fixture) => {
  delete fixture.record.checkerEvidence.report.digest;
});

for (const timestamp of ["2026-08-13T06:54:54Z", "2026-08-13T03:54:54.967-03:00", "invalid"]) {
  assertRejected(`invalid checker timestamp ${timestamp} exits nonzero`, (fixture) => {
    fixture.record.checkerEvidence.completedAtUtc = timestamp;
  });
}

for (const timestamp of ["2026-08-13T06:55:38Z", "2026-08-13T03:55:38.309-03:00", "invalid"]) {
  assertRejected(`invalid acknowledgement timestamp ${timestamp} exits nonzero`, (fixture) => {
    fixture.record.humanAcknowledgement.acknowledgedAtUtc = timestamp;
  });
}

for (const timestamp of ["2026-08-13T06:54:54.966Z", "2026-08-13T06:54:54.967Z"]) {
  assertRejected(`acknowledgement chronology ${timestamp} exits nonzero`, (fixture) => {
    fixture.record.humanAcknowledgement.acknowledgedAtUtc = timestamp;
  });
}

assertRejected("open finding exits nonzero", (fixture) => {
  fixture.report.findings = [{ id: "finding-1", disposition: "open" }];
  fixture.report.findingsDisposition = { status: "all-resolved", detail: "Incorrectly claimed resolved." };
  bindChangedReport(fixture);
});

assertRejected("missing findings disposition exits nonzero", (fixture) => {
  delete fixture.report.findingsDisposition;
  bindChangedReport(fixture);
});

assertRejected("missing human acknowledgement exits nonzero", (fixture) => {
  delete fixture.record.humanAcknowledgement;
});

assertRejected("mismatched acknowledgement identity exits nonzero", (fixture) => {
  fixture.record.humanAcknowledgement.acknowledgedBy =
    fixture.record.checkerEvidence.checkerIdentity.name;
});

assertRejected("mismatched acknowledgement statement exits nonzero", (fixture) => {
  fixture.record.humanAcknowledgement.statement = "approved";
});

assertRejected("report hash mismatch exits nonzero", (fixture) => {
  fixture.record.checkerEvidence.report.digest.value = "0".repeat(64);
  fixture.record.humanAcknowledgement.reportSha256 = "0".repeat(64);
});

assertRejected("report and record semantic mismatch exits nonzero", (fixture) => {
  fixture.record.checkerEvidence.checkerIdentity.runId = "different-run";
});

assertRejected("substantive UI-SPEC body mutation after review exits nonzero", (fixture) => {
  fixture.uiSpecText = fixture.approvedUiSpecBytes
    .toString("utf8")
    .replace("Phase 6 is an authority transition", "Phase 6 is a changed authority transition");
});

assertRejected("stale checker report reuse against newly derived content exits nonzero", (fixture) => {
  fixture.uiSpecText = fixture.approvedUiSpecBytes
    .toString("utf8")
    .replace("## Design Intent", "## Changed Design Intent");
});

assertRejected("checker report subject path mismatch exits nonzero", (fixture) => {
  fixture.report.subject.path = ".planning/phases/06-transactional-plans-and-recovery/other.md";
  bindChangedReport(fixture);
});

assertRejected("checker report subject digest mismatch exits nonzero", (fixture) => {
  fixture.report.subject.digest.value = "1".repeat(64);
  bindChangedReport(fixture);
});

assertRejected("approval subject digest mismatch exits nonzero", (fixture) => {
  fixture.record.subject.digest.value = "2".repeat(64);
  fixture.record.humanAcknowledgement.subjectSha256 = "2".repeat(64);
});

test("saved review-input byte mutation exits nonzero and is restored", () =>
  withFixture((fixture) => {
    const original = readFileSync(REVIEW_INPUT_PATH);
    try {
      writeFileSync(REVIEW_INPUT_PATH, Buffer.concat([original, Buffer.from("mutated\n", "utf8")]));
      const result = runCheck(fixture);
      assert.notEqual(result.status, 0);
    } finally {
      writeFileSync(REVIEW_INPUT_PATH, original);
    }
  }));

assertRejected("approved status with incomplete checkboxes exits nonzero", (fixture) => {
  fixture.uiSpecText = fixture.approvedUiSpecBytes
    .toString("utf8")
    .replace("- [x] Dimension 4 Typography: PASS", "- [ ] Dimension 4 Typography: PASS");
});

assertRejected("checked boxes with pending status exit nonzero", (fixture) => {
  fixture.uiSpecText = fixture.approvedUiSpecBytes
    .toString("utf8")
    .replace("status: approved", "status: pending-review");
});

assertRejected("wrong sign-off label exits nonzero", (fixture) => {
  fixture.uiSpecText = fixture.approvedUiSpecBytes
    .toString("utf8")
    .replace("Dimension 5 Spacing", "Dimension 5 Layout");
});

assertRejected("duplicate sign-off label exits nonzero", (fixture) => {
  fixture.uiSpecText = fixture.approvedUiSpecBytes
    .toString("utf8")
    .replace("Dimension 6 Registry Safety", "Dimension 5 Spacing");
});

assertRejected("approval-line disagreement exits nonzero", (fixture) => {
  fixture.uiSpecText = fixture.approvedUiSpecBytes
    .toString("utf8")
    .replace("approved by Liiiraa", "approved by someone-else");
});

assertRejected("reviewed_at disagreement exits nonzero", (fixture) => {
  fixture.uiSpecText = fixture.approvedUiSpecBytes
    .toString("utf8")
    .replace(`reviewed_at: ${ACKNOWLEDGED_AT}`, "reviewed_at: 2026-08-13T06:56:00.000Z");
});

assertRejected("metadata-only approval cannot authorize changed substantive content", (fixture) => {
  fixture.uiSpecText = fixture.approvedUiSpecBytes
    .toString("utf8")
    .replace("## Performance Contract", "## Altered Performance Contract")
    .replace("approved by Liiiraa", "approved by Liiiraa");
});

assertRejected("additional approval properties exit nonzero", (fixture) => {
  fixture.record.checkerEvidence.extraAuthority = true;
});
