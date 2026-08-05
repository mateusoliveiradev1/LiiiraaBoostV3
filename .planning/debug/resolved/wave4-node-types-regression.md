---
status: resolved
trigger: "Diagnose and fix the Wave 4 integration regression where apps/account and apps/admin TypeScript checks fail to resolve Node globals/modules (`process`, `node:fs`) after the Phase 4 dependency graph was installed."
created: 2026-08-04T23:30:33.9470575-03:00
updated: 2026-08-04T23:45:19.3430538-03:00
---

## Current Focus

hypothesis: resolved — confirmed and verified across all affected Next app importers
test: complete
expecting: complete
next_action: none — session archived after execute-phase orchestrator confirmation

## Symptoms

expected: apps/account and apps/admin strict TypeScript checks resolve Node globals and `node:` built-in modules after the Phase 4 dependency graph installation
actual: apps/account and apps/admin TypeScript checks fail to resolve `process` and `node:fs`
errors: TypeScript cannot find Node global `process` and module `node:fs`
reproduction: run the focused TypeScript checks for apps/account and apps/admin from the post-merge gate
started: after the Phase 4 dependency graph was installed during Wave 4 integration

## Eliminated

## Evidence

- timestamp: 2026-08-04T23:31:04.4264681-03:00
  checked: debug knowledge base
  found: no entry overlaps the `process`, `node:fs`, or Node-type-resolution symptoms
  implication: there is no known-pattern shortcut; test the repository dependency/configuration directly

- timestamp: 2026-08-04T23:31:04.4264681-03:00
  checked: apps/account and apps/admin package manifests and tsconfigs
  found: both manifests declare `@types/react` but no `@types/node`; neither tsconfig explicitly restricts `compilerOptions.types`
  implication: ambient Node types can only arrive accidentally through another package, which is unstable under a strict pnpm dependency graph

- timestamp: 2026-08-04T23:31:04.4264681-03:00
  checked: dependency allowlist and generated review
  found: exact identity `@types/node@24.13.3` is already approved and reviewed; no new dependency identity or version is required
  implication: adding package-local ownership at the approved pin can remain inside supply-chain policy

- timestamp: 2026-08-04T23:31:49.2641365-03:00
  checked: pre-fix focused TypeScript checks
  found: account fails at `proxy.ts` plus three tests on `process`/`node:fs`; admin fails at `proxy.ts`, `admin-runtime.ts`, and three tests on the same missing Node declarations
  implication: the symptom is reproduced deterministically in both apps and is confined to Node declaration resolution

- timestamp: 2026-08-04T23:31:49.2641365-03:00
  checked: workspace-wide Node type ownership search
  found: desktop, design-tokens, contracts-ts, and web-evidence explicitly declare approved `@types/node@24.13.3`; Node-aware tsconfigs explicitly opt into `node`; the base config declares `types: []`
  implication: both explicit dependency ownership and an app-level `types` override are expected repository patterns

- timestamp: 2026-08-04T23:31:49.2641365-03:00
  checked: pnpm lock references around account/admin
  found: their Vitest resolutions mention `@types/node@24.13.3` as a peer context, but neither importer visibly owns it
  implication: peer-resolution context does not make the type package a stable direct dependency under strict pnpm isolation

- timestamp: 2026-08-04T23:33:09.6363096-03:00
  checked: effective TypeScript configuration for both apps
  found: both inherit the root's intentional `types: []` exactly
  implication: adding a manifest dependency alone cannot activate Node declarations; each app needs an explicit narrow `types: ["node"]` override

- timestamp: 2026-08-04T23:33:09.6363096-03:00
  checked: command-line counterfactual enabling only `--types node`
  found: TypeScript changes from TS2591 usage errors to TS2688 `Cannot find type definition file for node`
  implication: the config override alone is also insufficient; the app importers must own the approved type package directly

- timestamp: 2026-08-04T23:36:34.8760270-03:00
  checked: post-fix focused app verification
  found: both strict TypeScript checks pass; account has 68/68 passing tests and admin has 76/76 passing tests
  implication: the original Node global/module resolution regression is fixed with no focused functional regression

- timestamp: 2026-08-04T23:36:34.8760270-03:00
  checked: deterministic install and dependency policy gates
  found: frozen-lockfile install succeeds; architecture tests pass 46/46; supply-chain verifier accepts all 72 exact pins including the existing approved `@types/node@24.13.3`
  implication: importer ownership is deterministic and introduces no unapproved identity or version

- timestamp: 2026-08-04T23:37:47.9630057-03:00
  checked: root `pnpm check`
  found: root TypeScript version check passes, then ESLint stops the aggregate with 384 repository-wide errors in untouched files; the reported errors are lint policy/project-service issues rather than TS2591 `process`/`node:fs` resolution failures
  implication: this is a distinct pre-existing root lint backlog outside the Wave 4 Node-type regression; package strict checks must be invoked directly to complete scoped verification

- timestamp: 2026-08-04T23:38:45.3110065-03:00
  checked: direct Turbo package checks and root tests
  found: account/admin now pass, but web fails on the identical TS2591 pattern for `process`, `Buffer`, `node:crypto`, `node:fs/promises`, `node:path`, `node:os`, and `node:url`; root test otherwise exposes exactly 11 explicitly tagged EXPECTED_RED failures owned by 04-12-01, 04-16-01, and 04-17-01
  implication: the causal regression spans all three Node-using Next apps; web must receive the same narrow correction before the root test distinction is clean

- timestamp: 2026-08-04T23:38:45.3110065-03:00
  checked: apps/web manifest and tsconfig
  found: web lacks direct `@types/node` and inherits base `types: []`, exactly matching the confirmed pre-fix account/admin state
  implication: no new hypothesis or dependency identity is needed; extend the confirmed fix to the third affected importer

- timestamp: 2026-08-04T23:40:04.4021532-03:00
  checked: post-fix focused and direct Turbo TypeScript checks
  found: account, admin, and web focused checks pass; frozen install passes; all 26 Turbo check tasks pass
  implication: no Node declaration resolution failure remains in the package TypeScript graph

- timestamp: 2026-08-04T23:40:04.4021532-03:00
  checked: post-fix root test gate
  found: the only 11 failing tests are explicitly tagged EXPECTED_RED: 5 owned by 04-12-01, 4 owned by 04-16-01, and 2 owned by 04-17-01; no other test or package check fails
  implication: the real Wave 4 integration regression is gone while all intentional pre-implementation witnesses remain unchanged and visible

- timestamp: 2026-08-04T23:43:18.3969217-03:00
  checked: closing verification
  found: web passes 125/125 tests; architecture passes 46/46; supply chain verifies 72 exact pins; frozen install, targeted formatting, diff whitespace audit, all three focused checks, and all 26 Turbo package checks pass
  implication: the fix is deterministic, policy-compliant, formatted, and regression-tested without Docker or live PostgreSQL

- timestamp: 2026-08-04T23:44:06.9088998-03:00
  checked: atomic commit
  found: commit `b073022` contains exactly the seven approved app manifest/config and lockfile changes with message `fix: resolve post-merge conflicts from wave 4`
  implication: unrelated `.impeccable/` and `apps/desktop/src-tauri/gen/` remain untracked and untouched

## Resolution

root_cause: Wave 4 installed a strict pnpm graph in which the three Next apps consumed Node APIs but did not own `@types/node`; their inherited base config also deliberately disables all ambient type packages with `types: []`, so Vitest's peer-context copy could neither be resolved nor loaded
fix: added approved exact `@types/node@24.13.3` as a devDependency of each affected Next app, opted each app tsconfig into only `node`, and regenerated only those lockfile importer entries
verification: exact pre-fix checks now pass for account/admin; web sibling discovered by the root gate also passes; account/admin/web tests pass 68/76/125; frozen install, 26/26 Turbo checks, 46/46 architecture tests, and 72-pin supply-chain gate pass; root tests fail only on the 11 unchanged EXPECTED_RED witnesses
files_changed: [apps/account/package.json, apps/account/tsconfig.json, apps/admin/package.json, apps/admin/tsconfig.json, apps/web/package.json, apps/web/tsconfig.json, pnpm-lock.yaml]
