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
import { pathToFileURL } from "node:url";

export const CANONICALIZATION = "ui-spec-review-payload-v1";

function fail(message) {
  throw new Error(message);
}

function decodeUtf8(bytes) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return fail("UI-SPEC must contain valid UTF-8 without replacement characters");
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

function printUsage() {
  process.stderr.write(
    "Usage: node 06-22-validate-ui-contract-approval.mjs --prepare-review-input <UI-SPEC.md> <review-input.md>\n",
  );
}

function main(argv) {
  if (argv.length !== 3 || argv[0] !== "--prepare-review-input") {
    printUsage();
    process.exitCode = 2;
    return;
  }

  try {
    const result = prepareReviewInput(argv[1], argv[2]);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`UI contract review input preparation failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2));
}
