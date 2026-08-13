import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, isAbsolute, join, parse, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const CANONICALIZATION = "ui-spec-review-payload-v1";
export const APPROVAL_SCHEMA_VERSION = "ui-contract-approval-v1";
export const CHECKER_REPORT_SCHEMA_VERSION = "ui-contract-checker-report-v1";
export const SUBJECT_PATH =
  ".planning/phases/06-transactional-plans-and-recovery/06-22-UI-CONTRACT-REVIEW-INPUT.md";
export const ACKNOWLEDGEMENT_STATEMENT =
  "I reviewed the independently produced checker report bound by this SHA-256 and approve this exact UI-SPEC.";
export const DIMENSIONS = Object.freeze([
  "copywriting",
  "visuals",
  "color",
  "typography",
  "spacing",
  "registry-safety",
]);

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SCHEMA_PATH = join(dirname(SCRIPT_PATH), "06-22-UI-CONTRACT-APPROVAL.schema.json");
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;

function fail(message) {
  throw new Error(message);
}

function decodeUtf8(bytes, label = "UI-SPEC") {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return fail(`${label} must contain valid UTF-8 without replacement characters`);
  }
}

function normalizeLineEndings(text) {
  const normalized = text.replaceAll("\r\n", "\n");
  if (normalized.includes("\r")) {
    fail("UI-SPEC contains an unsupported bare carriage return");
  }
  return normalized;
}

function parseFrontmatter(lines) {
  if (lines[0] !== "---") {
    fail("UI-SPEC must start with one YAML frontmatter block");
  }

  const closingIndex = lines.indexOf("---", 1);
  if (closingIndex === -1) {
    fail("UI-SPEC YAML frontmatter is not closed");
  }

  const keys = new Map();
  for (let index = 1; index < closingIndex; index += 1) {
    const line = lines[index];
    if (line.length === 0 || /^[ \t]/u.test(line)) {
      continue;
    }

    const keyMatch = /^([A-Za-z0-9_-]+)[ \t]*:/u.exec(line);
    if (!keyMatch) {
      fail(`Malformed YAML frontmatter line ${index + 1}`);
    }

    const key = keyMatch[1];
    if (keys.has(key)) {
      fail(`Duplicate YAML frontmatter key: ${key}`);
    }
    keys.set(key, index);
  }

  for (const requiredMetadataKey of ["status", "reviewed_at"]) {
    if (!keys.has(requiredMetadataKey)) {
      fail(`Missing mutable UI approval metadata key: ${requiredMetadataKey}`);
    }
  }

  return { closingIndex, keys };
}

function findTerminalSignOff(lines, bodyStartIndex) {
  const signOffIndexes = [];
  for (let index = bodyStartIndex; index < lines.length; index += 1) {
    if (lines[index] === "## Checker Sign-Off") {
      signOffIndexes.push(index);
    }
  }

  if (signOffIndexes.length !== 1) {
    fail("UI-SPEC must contain exactly one '## Checker Sign-Off' section");
  }

  const signOffIndex = signOffIndexes[0];
  const signOffLines = lines.slice(signOffIndex + 1);
  const laterHeading = signOffLines.find((line) => /^#{1,6}[ \t]+/u.test(line));
  if (laterHeading !== undefined) {
    fail("Checker Sign-Off must be the terminal UI-SPEC section");
  }

  const approvalIndexes = [];
  for (let index = 0; index < signOffLines.length; index += 1) {
    if (signOffLines[index].startsWith("**Approval:**")) {
      approvalIndexes.push(index);
    }
  }
  if (approvalIndexes.length !== 1) {
    fail("Checker Sign-Off must contain exactly one approval line");
  }

  const lastContentIndex = signOffLines.findLastIndex((line) => line !== "");
  if (lastContentIndex !== approvalIndexes[0]) {
    fail("Checker Sign-Off approval must be its final content");
  }

  return signOffIndex;
}

export function canonicalizeUiSpec(bytes) {
  const normalized = normalizeLineEndings(decodeUtf8(bytes));
  const lines = normalized.split("\n");
  const { closingIndex, keys } = parseFrontmatter(lines);
  const signOffIndex = findTerminalSignOff(lines, closingIndex + 1);

  const excludedIndexes = new Set([keys.get("status"), keys.get("reviewed_at")]);
  const canonicalLines = [];
  for (let index = 0; index < signOffIndex; index += 1) {
    if (!excludedIndexes.has(index)) {
      canonicalLines.push(lines[index]);
    }
  }

  while (canonicalLines.at(-1) === "") {
    canonicalLines.pop();
  }
  return Buffer.from(`${canonicalLines.join("\n")}\n`, "utf8");
}

export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function findRepositoryRoot(startPath = process.cwd()) {
  let candidate = realpathSync(resolve(startPath));
  if (!statSync(candidate).isDirectory()) {
    candidate = dirname(candidate);
  }

  while (true) {
    if (existsSync(join(candidate, ".git"))) {
      return candidate;
    }
    const parent = dirname(candidate);
    if (parent === candidate || candidate === parse(candidate).root) {
      fail("Cannot locate repository root");
    }
    candidate = parent;
  }
}

function assertInsideRepository(candidatePath, repositoryRoot, { mustExist }) {
  const absolutePath = resolve(candidatePath);
  const inspectedPath = mustExist ? realpathSync(absolutePath) : realpathSync(dirname(absolutePath));
  const pathWithinRoot = mustExist ? inspectedPath : join(inspectedPath, basename(absolutePath));
  const relativePath = relative(repositoryRoot, pathWithinRoot);
  if (relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath))) {
    return absolutePath;
  }
  return fail(`Path is outside the repository: ${candidatePath}`);
}

function repositoryRelativePath(candidatePath, repositoryRoot, { mustExist = true } = {}) {
  if (isAbsolute(candidatePath) || candidatePath.includes("\\")) {
    fail(`Path must be canonical repository-relative POSIX text: ${candidatePath}`);
  }
  const absolutePath = assertInsideRepository(join(repositoryRoot, candidatePath), repositoryRoot, {
    mustExist,
  });
  const canonical = relative(repositoryRoot, absolutePath).replaceAll("\\", "/");
  if (canonical !== candidatePath) {
    fail(`Path is not canonical repository-relative text: ${candidatePath}`);
  }
  return absolutePath;
}

function atomicWrite(destinationPath, bytes) {
  if (existsSync(destinationPath)) {
    if (lstatSync(destinationPath).isSymbolicLink()) {
      fail(`Refusing to replace symbolic link: ${destinationPath}`);
    }
    if (readFileSync(destinationPath).equals(bytes)) {
      return false;
    }
  }

  const temporaryPath = join(
    dirname(destinationPath),
    `.${parse(destinationPath).base}.${process.pid}.${Date.now()}.tmp`,
  );
  try {
    writeFileSync(temporaryPath, bytes, { flag: "wx", mode: 0o600 });
    renameSync(temporaryPath, destinationPath);
  } finally {
    rmSync(temporaryPath, { force: true });
  }
  return true;
}

export function prepareReviewInput(sourcePath, destinationPath, repositoryRoot = findRepositoryRoot()) {
  const root = realpathSync(repositoryRoot);
  const source = assertInsideRepository(sourcePath, root, { mustExist: true });
  const destination = assertInsideRepository(destinationPath, root, { mustExist: false });
  if (source === destination) {
    fail("UI-SPEC source and frozen review input must be different files");
  }

  const canonicalBytes = canonicalizeUiSpec(readFileSync(source));
  atomicWrite(destination, canonicalBytes);
  return {
    canonicalization: CANONICALIZATION,
    path: relative(root, destination).replaceAll("\\", "/"),
    digest: { algorithm: "sha256", value: sha256(canonicalBytes) },
    bytes: canonicalBytes.length,
  };
}

function readJson(path, label) {
  try {
    return JSON.parse(decodeUtf8(readFileSync(path), label));
  } catch (error) {
    return fail(`${label} is not valid JSON: ${error.message}`);
  }
}

function requireObject(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
  return value;
}

function requireNonemptyString(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail(`${label} must be a nonempty string`);
  }
  return value;
}

function requireCanonicalUtc(value, label) {
  requireNonemptyString(value, label);
  if (!TIMESTAMP_PATTERN.test(value)) {
    fail(`${label} must use canonical UTC YYYY-MM-DDTHH:mm:ss.sssZ form`);
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    fail(`${label} must parse and re-emit identically`);
  }
  return parsed;
}

function requireDigest(value, label) {
  requireObject(value, label);
  if (
    Object.keys(value).sort().join(",") !== "algorithm,value" ||
    value.algorithm !== "sha256" ||
    !SHA256_PATTERN.test(value.value)
  ) {
    fail(`${label} must be exactly a lowercase SHA-256 digest object`);
  }
  return value;
}

function deepEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function validateWithSchema(value, schema, path = "$") {
  if (Object.hasOwn(schema, "const") && !deepEqual(value, schema.const)) {
    fail(`${path} does not match its schema const`);
  }
  if (schema.enum && !schema.enum.some((candidate) => deepEqual(value, candidate))) {
    fail(`${path} is not in its schema enum`);
  }
  if (schema.type === "object") {
    requireObject(value, path);
    const properties = schema.properties ?? {};
    for (const key of schema.required ?? []) {
      if (!Object.hasOwn(value, key)) {
        fail(`${path}.${key} is required by schema`);
      }
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!Object.hasOwn(properties, key)) {
          fail(`${path}.${key} is an additional property`);
        }
      }
    }
    for (const [key, childSchema] of Object.entries(properties)) {
      if (Object.hasOwn(value, key)) {
        validateWithSchema(value[key], childSchema, `${path}.${key}`);
      }
    }
  } else if (schema.type === "array") {
    if (!Array.isArray(value)) {
      fail(`${path} must be an array`);
    }
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      fail(`${path} has too few items`);
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      fail(`${path} has too many items`);
    }
    if (schema.uniqueItems && new Set(value.map((item) => JSON.stringify(item))).size !== value.length) {
      fail(`${path} must contain unique items`);
    }
    value.forEach((item, index) => validateWithSchema(item, schema.items, `${path}[${index}]`));
  } else if (schema.type === "string") {
    if (typeof value !== "string") {
      fail(`${path} must be a string`);
    }
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      fail(`${path} is shorter than its schema minimum`);
    }
    if (schema.pattern && !new RegExp(schema.pattern, "u").test(value)) {
      fail(`${path} does not match its schema pattern`);
    }
  }
}

function assertClosedSchema(schema, path = "$") {
  if (schema.type === "object") {
    if (schema.additionalProperties !== false) {
      fail(`${path} must set additionalProperties to false`);
    }
    for (const [key, child] of Object.entries(schema.properties ?? {})) {
      assertClosedSchema(child, `${path}.properties.${key}`);
    }
  } else if (schema.type === "array" && schema.items) {
    assertClosedSchema(schema.items, `${path}.items`);
  }
}

function validateDimensionResults(dimensions, label, { exactObjects }) {
  if (!Array.isArray(dimensions) || dimensions.length !== DIMENSIONS.length) {
    fail(`${label} must contain exactly six dimensions`);
  }
  const ids = [];
  for (const [index, dimension] of dimensions.entries()) {
    requireObject(dimension, `${label}[${index}]`);
    if (exactObjects && Object.keys(dimension).sort().join(",") !== "id,verdict") {
      fail(`${label}[${index}] must contain exactly id and verdict`);
    }
    requireNonemptyString(dimension.id, `${label}[${index}].id`);
    if (dimension.verdict !== "PASS") {
      fail(`${label}[${index}].verdict must be exactly PASS`);
    }
    ids.push(dimension.id);
  }
  if (new Set(ids).size !== DIMENSIONS.length) {
    fail(`${label} contains duplicate dimension IDs`);
  }
  for (const required of DIMENSIONS) {
    if (!ids.includes(required)) {
      fail(`${label} is missing canonical dimension ${required}`);
    }
  }
  if (ids.some((id) => !DIMENSIONS.includes(id))) {
    fail(`${label} contains an unknown dimension ID`);
  }
  return dimensions.map(({ id, verdict }) => ({ id, verdict }));
}

function deriveFindingsDisposition(report) {
  if (!Array.isArray(report.findings)) {
    fail("checker report findings must be an array");
  }
  const reportDisposition = requireObject(
    report.findingsDisposition,
    "checker report findingsDisposition",
  );
  const detail = requireNonemptyString(
    reportDisposition.detail,
    "checker report findingsDisposition.detail",
  );
  let status;
  if (report.findings.length === 0) {
    status = "none-raised";
  } else {
    const ids = new Set();
    for (const [index, finding] of report.findings.entries()) {
      requireObject(finding, `checker report findings[${index}]`);
      const id = requireNonemptyString(finding.id, `checker report findings[${index}].id`);
      if (ids.has(id)) {
        fail("checker report finding IDs must be unique");
      }
      ids.add(id);
      if (finding.disposition !== "resolved") {
        fail("every checker finding must have disposition exactly resolved");
      }
    }
    status = "all-resolved";
  }
  if (reportDisposition.status !== status) {
    fail("checker report findingsDisposition contradicts its findings array");
  }
  return { status, detail };
}

function validateSubjectObject(subject, expectedDigest) {
  requireObject(subject, "subject");
  if (Object.keys(subject).sort().join(",") !== "canonicalization,digest,path") {
    fail("subject must contain exactly canonicalization, path, and digest");
  }
  if (subject.canonicalization !== CANONICALIZATION || subject.path !== SUBJECT_PATH) {
    fail("subject canonicalization or path mismatch");
  }
  requireDigest(subject.digest, "subject.digest");
  if (subject.digest.value !== expectedDigest) {
    fail("subject digest mismatch");
  }
}

function expectedApprovalLine(record) {
  return `**Approval:** approved by ${record.humanAcknowledgement.acknowledgedBy} at ${record.humanAcknowledgement.acknowledgedAtUtc}; subject=${record.subject.path}; subjectSha256=${record.subject.digest.value}; report=${record.checkerEvidence.report.path}; reportSha256=${record.checkerEvidence.report.digest.value}`;
}

const SIGN_OFF_LINES = Object.freeze([
  "- [x] Dimension 1 Copywriting: PASS",
  "- [x] Dimension 2 Visuals: PASS",
  "- [x] Dimension 3 Color: PASS",
  "- [x] Dimension 4 Typography: PASS",
  "- [x] Dimension 5 Spacing: PASS",
  "- [x] Dimension 6 Registry Safety: PASS",
]);

function validateUiSpecAgreement(uiSpecBytes, record) {
  const normalized = normalizeLineEndings(decodeUtf8(uiSpecBytes));
  const lines = normalized.split("\n");
  const { closingIndex, keys } = parseFrontmatter(lines);
  const signOffIndex = findTerminalSignOff(lines, closingIndex + 1);
  const status = lines[keys.get("status")].replace(/^status:[ \t]*/u, "");
  const reviewedAt = lines[keys.get("reviewed_at")].replace(/^reviewed_at:[ \t]*/u, "");
  if (status !== "approved") {
    fail("UI-SPEC status must be approved");
  }
  if (reviewedAt !== record.humanAcknowledgement.acknowledgedAtUtc) {
    fail("UI-SPEC reviewed_at does not match acknowledgement time");
  }

  const signOffContent = lines.slice(signOffIndex + 1);
  const checkboxLines = signOffContent.filter((line) => /^- \[[ xX]\] Dimension/u.test(line));
  if (!deepEqual(checkboxLines, SIGN_OFF_LINES)) {
    fail("UI-SPEC must contain exactly the six canonical checked sign-off lines");
  }
  if (signOffContent.some((line) => /^- \[ \]/u.test(line))) {
    fail("UI-SPEC cannot retain unchecked sign-off lines");
  }
  const approvalLines = signOffContent.filter((line) => line.startsWith("**Approval:**"));
  if (approvalLines.length !== 1 || approvalLines[0] !== expectedApprovalLine(record)) {
    fail("UI-SPEC approval line does not match the validated record");
  }
}

export function renderApprovedUiSpec(uiSpecBytes, record) {
  const normalized = normalizeLineEndings(decodeUtf8(uiSpecBytes));
  const lines = normalized.split("\n");
  const { closingIndex, keys } = parseFrontmatter(lines);
  const signOffIndex = findTerminalSignOff(lines, closingIndex + 1);
  lines[keys.get("status")] = "status: approved";
  lines[keys.get("reviewed_at")] =
    `reviewed_at: ${record.humanAcknowledgement.acknowledgedAtUtc}`;
  const promoted = [
    ...lines.slice(0, signOffIndex),
    "## Checker Sign-Off",
    "",
    "The independent six-dimension checker report and separate human acknowledgement bind this exact contract.",
    "",
    ...SIGN_OFF_LINES,
    "",
    expectedApprovalLine(record),
    "",
  ].join("\n");
  return Buffer.from(promoted, "utf8");
}

function validateCheckerReport(report, record, subjectDigest, reportDigest) {
  requireObject(report, "checker report");
  if (report.schemaVersion !== CHECKER_REPORT_SCHEMA_VERSION) {
    fail("checker report schemaVersion mismatch");
  }
  if (report.overallStatus !== undefined && report.overallStatus !== "APPROVED") {
    fail("checker report overallStatus must be APPROVED");
  }
  validateSubjectObject(report.subject, subjectDigest);
  if (!deepEqual(report.subject, record.subject)) {
    fail("checker report subject does not match approval record subject");
  }

  const identity = requireObject(report.checkerIdentity, "checker report checkerIdentity");
  for (const key of ["name", "provider", "runId"]) {
    requireNonemptyString(identity[key], `checker report checkerIdentity.${key}`);
  }
  requireCanonicalUtc(report.completedAtUtc, "checker report completedAtUtc");
  const dimensions = validateDimensionResults(report.dimensions, "checker report dimensions", {
    exactObjects: false,
  });
  const findingsDisposition = deriveFindingsDisposition(report);

  if (!deepEqual(record.checkerEvidence.checkerIdentity, identity)) {
    fail("approval checker identity does not match checker report");
  }
  if (record.checkerEvidence.completedAtUtc !== report.completedAtUtc) {
    fail("approval checker completion does not match checker report");
  }
  if (!deepEqual(record.checkerEvidence.dimensions, dimensions)) {
    fail("approval dimensions do not match checker report");
  }
  if (!deepEqual(record.checkerEvidence.findingsDisposition, findingsDisposition)) {
    fail("approval findings disposition does not match checker report");
  }
  if (record.checkerEvidence.report.digest.value !== reportDigest) {
    fail("approval checker report digest mismatch");
  }
}

function validateApprovalRecordShape(record) {
  const schema = readJson(SCHEMA_PATH, "approval schema");
  assertClosedSchema(schema);
  validateWithSchema(record, schema);
  if (record.schemaVersion !== APPROVAL_SCHEMA_VERSION) {
    fail("approval schemaVersion mismatch");
  }
  validateDimensionResults(record.checkerEvidence.dimensions, "approval dimensions", {
    exactObjects: true,
  });
  requireDigest(record.subject.digest, "approval subject.digest");
  requireDigest(record.checkerEvidence.report.digest, "approval checkerEvidence.report.digest");
  requireCanonicalUtc(record.checkerEvidence.completedAtUtc, "approval checker completion");
  const acknowledgementTime = requireCanonicalUtc(
    record.humanAcknowledgement.acknowledgedAtUtc,
    "human acknowledgement time",
  );
  const checkerTime = Date.parse(record.checkerEvidence.completedAtUtc);
  if (acknowledgementTime <= checkerTime) {
    fail("human acknowledgement must be strictly after checker completion");
  }
  const acknowledgedBy = requireNonemptyString(
    record.humanAcknowledgement.acknowledgedBy,
    "human acknowledgement identity",
  );
  const checkerIdentityValues = Object.values(record.checkerEvidence.checkerIdentity);
  if (checkerIdentityValues.includes(acknowledgedBy)) {
    fail("human acknowledgement identity must be distinct from checker identity");
  }
  if (record.humanAcknowledgement.statement !== ACKNOWLEDGEMENT_STATEMENT) {
    fail("human acknowledgement statement mismatch");
  }
  if (record.humanAcknowledgement.reportSha256 !== record.checkerEvidence.report.digest.value) {
    fail("human acknowledgement report SHA-256 mismatch");
  }
  if (record.humanAcknowledgement.subjectSha256 !== record.subject.digest.value) {
    fail("human acknowledgement subject SHA-256 mismatch");
  }
}

export function validateAuthority(
  record,
  uiSpecBytes,
  reviewInputBytes,
  { approvalPath, uiSpecPath, reviewInputPath, repositoryRoot = findRepositoryRoot() },
) {
  const root = realpathSync(repositoryRoot);
  validateApprovalRecordShape(record);

  const reviewAbsolute = assertInsideRepository(reviewInputPath, root, { mustExist: true });
  const reviewRelative = relative(root, reviewAbsolute).replaceAll("\\", "/");
  if (reviewRelative !== SUBJECT_PATH) {
    fail("saved review input path does not match canonical subject path");
  }
  const liveCanonical = canonicalizeUiSpec(uiSpecBytes);
  if (!liveCanonical.equals(reviewInputBytes)) {
    fail("live substantive UI-SPEC does not byte-match the frozen review input");
  }
  const subjectDigest = sha256(reviewInputBytes);
  validateSubjectObject(record.subject, subjectDigest);

  const reportPath = record.checkerEvidence.report.path;
  const reportAbsolute = repositoryRelativePath(reportPath, root, { mustExist: true });
  const forbiddenPaths = [approvalPath, uiSpecPath, reviewInputPath, SCHEMA_PATH, SCRIPT_PATH]
    .filter(Boolean)
    .map((path) => resolve(path));
  if (forbiddenPaths.includes(resolve(reportAbsolute))) {
    fail("checker report path points to forbidden self-authored evidence");
  }
  const reportBytes = readFileSync(reportAbsolute);
  const reportDigest = sha256(reportBytes);
  requireDigest(record.checkerEvidence.report.digest, "checkerEvidence.report.digest");
  if (record.checkerEvidence.report.digest.value !== reportDigest) {
    fail("checker report exact-byte SHA-256 mismatch");
  }
  const report = readJson(reportAbsolute, "checker report");
  validateCheckerReport(report, record, subjectDigest, reportDigest);
  validateUiSpecAgreement(uiSpecBytes, record);

  return {
    status: "approved",
    subjectSha256: subjectDigest,
    reportSha256: reportDigest,
    dimensions: [...DIMENSIONS],
    acknowledgedBy: record.humanAcknowledgement.acknowledgedBy,
    acknowledgedAtUtc: record.humanAcknowledgement.acknowledgedAtUtc,
  };
}

export function buildApprovalRecord({ reportPath, reportBytes, subjectBytes, acknowledgedBy, acknowledgedAtUtc, statement }) {
  const report = JSON.parse(decodeUtf8(reportBytes, "checker report"));
  const subjectDigest = sha256(subjectBytes);
  const reportDigest = sha256(reportBytes);
  const dimensions = validateDimensionResults(report.dimensions, "checker report dimensions", {
    exactObjects: false,
  });
  const findingsDisposition = deriveFindingsDisposition(report);
  validateSubjectObject(report.subject, subjectDigest);
  const identity = requireObject(report.checkerIdentity, "checker report checkerIdentity");
  for (const key of ["name", "provider", "runId"]) {
    requireNonemptyString(identity[key], `checker report checkerIdentity.${key}`);
  }
  requireCanonicalUtc(report.completedAtUtc, "checker report completedAtUtc");

  return {
    schemaVersion: APPROVAL_SCHEMA_VERSION,
    subject: report.subject,
    checkerEvidence: {
      checkerIdentity: { name: identity.name, provider: identity.provider, runId: identity.runId },
      completedAtUtc: report.completedAtUtc,
      report: {
        path: reportPath,
        digest: { algorithm: "sha256", value: reportDigest },
      },
      dimensions,
      findingsDisposition,
    },
    humanAcknowledgement: {
      acknowledgedBy,
      acknowledgedAtUtc,
      reportSha256: reportDigest,
      subjectSha256: subjectDigest,
      statement,
    },
  };
}

export function checkApproval(approvalPath, uiSpecPath, reviewInputPath, repositoryRoot = findRepositoryRoot()) {
  const root = realpathSync(repositoryRoot);
  const approval = assertInsideRepository(approvalPath, root, { mustExist: true });
  const uiSpec = assertInsideRepository(uiSpecPath, root, { mustExist: true });
  const reviewInput = assertInsideRepository(reviewInputPath, root, { mustExist: true });
  const record = readJson(approval, "approval record");
  return validateAuthority(record, readFileSync(uiSpec), readFileSync(reviewInput), {
    approvalPath: approval,
    uiSpecPath: uiSpec,
    reviewInputPath: reviewInput,
    repositoryRoot: root,
  });
}

export function promoteApproval(
  approvalPath,
  uiSpecPath,
  reviewInputPath,
  reportPath,
  acknowledgedBy,
  acknowledgedAtUtc,
  statement,
  repositoryRoot = findRepositoryRoot(),
) {
  const root = realpathSync(repositoryRoot);
  const approval = assertInsideRepository(approvalPath, root, { mustExist: false });
  const uiSpec = assertInsideRepository(uiSpecPath, root, { mustExist: true });
  const reviewInput = assertInsideRepository(reviewInputPath, root, { mustExist: true });
  const reportAbsolute = repositoryRelativePath(reportPath, root, { mustExist: true });
  const originalApproval = existsSync(approval) ? readFileSync(approval) : null;
  const originalUiSpec = readFileSync(uiSpec);
  const reviewInputBytes = readFileSync(reviewInput);
  const reportBytes = readFileSync(reportAbsolute);
  const record = buildApprovalRecord({
    reportPath,
    reportBytes,
    subjectBytes: reviewInputBytes,
    acknowledgedBy,
    acknowledgedAtUtc,
    statement,
  });
  const promotedUiSpec = renderApprovedUiSpec(originalUiSpec, record);
  validateAuthority(record, promotedUiSpec, reviewInputBytes, {
    approvalPath: approval,
    uiSpecPath: uiSpec,
    reviewInputPath: reviewInput,
    repositoryRoot: root,
  });
  const approvalBytes = Buffer.from(`${JSON.stringify(record, null, 2)}\n`, "utf8");

  try {
    atomicWrite(approval, approvalBytes);
    atomicWrite(uiSpec, promotedUiSpec);
    checkApproval(approval, uiSpec, reviewInput, root);
  } catch (error) {
    if (originalApproval === null) {
      rmSync(approval, { force: true });
    } else {
      atomicWrite(approval, originalApproval);
    }
    atomicWrite(uiSpec, originalUiSpec);
    throw error;
  }
  return record;
}

function printUsage() {
  process.stderr.write(
    [
      "Usage:",
      "  node 06-22-validate-ui-contract-approval.mjs --prepare-review-input <UI-SPEC.md> <review-input.md>",
      "  node 06-22-validate-ui-contract-approval.mjs --promote <approval.json> <UI-SPEC.md> <review-input.md> <report-path> <acknowledged-by> <acknowledged-at-utc> <statement>",
      "  node 06-22-validate-ui-contract-approval.mjs --check <approval.json> <UI-SPEC.md> <review-input.md>",
      "",
    ].join("\n"),
  );
}

function main(argv) {
  try {
    if (argv.length === 3 && argv[0] === "--prepare-review-input") {
      process.stdout.write(`${JSON.stringify(prepareReviewInput(argv[1], argv[2]))}\n`);
      return;
    }
    if (argv.length === 8 && argv[0] === "--promote") {
      const record = promoteApproval(...argv.slice(1));
      process.stdout.write(
        `${JSON.stringify({ status: "approved", subjectSha256: record.subject.digest.value, reportSha256: record.checkerEvidence.report.digest.value })}\n`,
      );
      return;
    }
    if (argv.length === 4 && argv[0] === "--check") {
      process.stdout.write(`${JSON.stringify(checkApproval(argv[1], argv[2], argv[3]))}\n`);
      return;
    }
    printUsage();
    process.exitCode = 2;
  } catch (error) {
    process.stderr.write(`UI contract approval validation failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2));
}
