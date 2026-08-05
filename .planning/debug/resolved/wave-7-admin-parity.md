---
status: resolved
trigger: "Fix the Wave 7 post-merge architecture regression selected by the user (option 1)."
created: 2026-08-05T13:01:30.9588821-03:00
updated: 2026-08-05T13:16:12.9940581-03:00
---

## Current Focus

reasoning_checkpoint:
  hypothesis: Plan 04-19 causes the strict Phase 3 parity test to fail because it added the legitimately imported @liiiraa/contracts-ts workspace dependency to apps/admin/package.json without adding the same dependency to the admin-app expected workspaceDependencies witness.
  confirming_evidence:
    - The unchanged focused suite fails only the named Phase 3 manifest/dependency parity test.
    - The admin manifest declares @liiiraa/contracts-ts as workspace:* and five admin source files import contract types or validators from it.
    - Commit 03e8385 introduced the manifest dependency with the admin authority implementation, while commit eb8dc31 shows the established one-entry witness correction for the analogous account adoption.
  falsification_test: Adding only @liiiraa/contracts-ts to the admin-app witness would fail to make all 46 focused architecture tests pass, or a second manifest/witness difference would remain.
  fix_rationale: Updating the versioned admin expected dependency array restores exact parity while retaining both the legitimate dependency and the strict assertion.
  blind_spots: The full root suite could expose an unrelated post-merge failure outside this architecture witness; that must be classified separately rather than folded into this fix.
next_action: Archive the human-approved debug session under .planning/debug/resolved.

## Symptoms

expected: Root pnpm test passes all 46 architecture checks, including exact manifest and dependency parity for every Phase 3 web root.
actual: Architecture tests pass 45 of 46; apps/admin has @liiiraa/contracts-ts in its actual workspace dependencies but the versioned expected Phase 3 witness omits it.
errors: "tooling/architecture-tests/src/check-workspace.test.ts > Phase 3 live web activation > activates every web root exactly once with manifest and dependency parity"
reproduction: Run pnpm test from the repository root.
started: After the Wave 7 merge containing Plan 04-19 admin contract adoption.

## Eliminated

## Evidence

- timestamp: 2026-08-05T13:01:55.9350360-03:00
  checked: .planning/debug/knowledge-base.md
  found: No entry overlaps the admin dependency parity symptom.
  implication: There is no known-pattern shortcut; direct manifest-to-witness comparison is required.
- timestamp: 2026-08-05T13:01:55.9350360-03:00
  checked: apps/admin/package.json and phase3WebModules in tooling/architecture-tests/src/check-workspace.test.ts
  found: The admin manifest includes @liiiraa/contracts-ts at workspace:*, but the admin-app workspaceDependencies witness lists only design-system, design-tokens, web-core, web-features, and web-preview.
  implication: The versioned expected structure is stale while the strict parity assertion remains correct.
- timestamp: 2026-08-05T13:01:55.9350360-03:00
  checked: commit eb8dc31 and apps/account/package.json
  found: Plan 04-18 resolved the same account-side drift by inserting @liiiraa/contracts-ts into the account-app witness, and account/admin manifests now have identical internal dependency sets.
  implication: The minimal established correction is one sorted witness entry under admin-app.
- timestamp: 2026-08-05T13:03:08.7074081-03:00
  checked: pnpm --filter @liiiraa/architecture-tests test --run before modification
  found: The check-workspace file ran 21 tests with exactly one failure, activates every web root exactly once with manifest and dependency parity.
  implication: The supplied regression is reproducible and isolated within the focused architecture suite.
- timestamp: 2026-08-05T13:03:08.7074081-03:00
  checked: Plan 04-19 commit 03e8385 and current apps/admin imports
  found: The commit added @liiiraa/contracts-ts to the admin manifest alongside production authority code; five current admin files directly import it.
  implication: Removing the dependency would break legitimate source ownership; the expected witness is the stale side.
- timestamp: 2026-08-05T13:04:45.4969858-03:00
  checked: pnpm --filter @liiiraa/architecture-tests test --run after the one-line witness update
  found: Both test files passed and all 46 architecture tests passed.
  implication: The counterfactual succeeded; the one stale expected dependency was the complete cause of the architecture regression.
- timestamp: 2026-08-05T13:06:22.3527993-03:00
  checked: Root pnpm test after the focused architecture pass
  found: Turbo completed 52 of 52 tasks successfully; architecture tests again passed 46 of 46.
  implication: The correction resolves the original regression without introducing a root-suite failure.
- timestamp: 2026-08-05T13:06:22.3527993-03:00
  checked: Commit 4e3265f and post-commit git status
  found: The commit contains only the one-line architecture witness change; .impeccable and apps/desktop/src-tauri/gen remain untracked and untouched.
  implication: The requested commit scope and protected-path constraints were preserved.
- timestamp: 2026-08-05T13:16:12.9940581-03:00
  checked: Human verification checkpoint response
  found: The user responded "aprovado" and accepted the verified fix.
  implication: The session is resolved and eligible for archival.

## Resolution

root_cause: Plan 04-19 added a required contracts workspace dependency to apps/admin but did not update the strict Phase 3 admin-app dependency witness, leaving expected and actual dependency sets out of sync.
fix: Added @liiiraa/contracts-ts to the admin-app expected workspaceDependencies witness without changing the manifest or parity assertion.
verification: Focused architecture package passed 46/46; root pnpm test passed 52/52 Turbo tasks, including architecture 46/46; user approved the human verification checkpoint.
files_changed: [tooling/architecture-tests/src/check-workspace.test.ts]
