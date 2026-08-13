import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  canonicalizeUiSpec,
  prepareReviewInput,
  sha256,
} from "./06-22-validate-ui-contract-approval.mjs";

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

test("canonicalization normalizes CRLF and emits exactly one final LF", () => {
  const lf = canonicalizeUiSpec(Buffer.from(uiSpec(), "utf8"));
  const crlf = canonicalizeUiSpec(Buffer.from(uiSpec({ newline: "\r\n" }), "utf8"));

  assert.deepEqual(crlf, lf);
  assert.equal(lf.toString("utf8"), [
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
  ].join("\n"));
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
    ["duplicate sign-off", uiSpec().replace("**Approval:** pending", "## Checker Sign-Off\n\n**Approval:** pending")],
    ["content after sign-off", uiSpec().replace("**Approval:** pending\n", "**Approval:** pending\n\n## Later contract\n")],
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
  assert.throws(() => canonicalizeUiSpec(Buffer.from(uiSpec().replace("phase: 6", "phase:\r6"), "utf8")), /bare carriage/u);
});

test("preparation is deterministic and rejects paths outside the repository", () => {
  const repositoryRoot = process.cwd();
  const fixtureRoot = mkdtempSync(join(repositoryRoot, ".planning", "06-22-review-input-test-"));
  const sourcePath = join(fixtureRoot, "UI-SPEC.md");
  const destinationPath = join(fixtureRoot, "REVIEW-INPUT.md");
  const outsideRoot = mkdtempSync(join(tmpdir(), "06-22-outside-"));
  const outsideSource = join(outsideRoot, "UI-SPEC.md");

  try {
    writeFileSync(sourcePath, uiSpec(), "utf8");
    writeFileSync(outsideSource, uiSpec(), "utf8");

    const first = prepareReviewInput(sourcePath, destinationPath, repositoryRoot);
    const firstBytes = readFileSync(destinationPath);
    const second = prepareReviewInput(sourcePath, destinationPath, repositoryRoot);
    const secondBytes = readFileSync(destinationPath);

    assert.deepEqual(secondBytes, firstBytes);
    assert.deepEqual(second, first);
    assert.equal(first.digest.value, sha256(firstBytes));

    writeFileSync(sourcePath, uiSpec({ body: "Updated before independent review." }), "utf8");
    const refreshed = prepareReviewInput(sourcePath, destinationPath, repositoryRoot);
    assert.notEqual(refreshed.digest.value, first.digest.value);
    assert.equal(refreshed.digest.value, sha256(readFileSync(destinationPath)));

    assert.throws(
      () => prepareReviewInput(outsideSource, destinationPath, repositoryRoot),
      /outside the repository/u,
    );
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
    rmSync(outsideRoot, { recursive: true, force: true });
  }
});
