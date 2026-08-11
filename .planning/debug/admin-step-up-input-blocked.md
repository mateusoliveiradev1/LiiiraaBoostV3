---
status: verifying
trigger: 'O campo do código de seis dígitos aparece ao trocar a função administrativa, mas não aceita digitação.'
created: 2026-08-11T23:48:00.0000000Z
updated: 2026-08-11T23:48:00.0000000Z
---

## Current Focus

hypothesis: Confirmed. The function-switch React Aria modal remained open when the separate strong-auth dialog mounted, so its focus scope prevented the new TOTP input from receiving keyboard input.
test: Publish the corrected Admin revision and repeat the Operations-to-Security TOTP UAT.
expecting: The underlying modal closes before the TOTP dialog mounts, allowing its text field to receive focus and six digits.
next_action: Commit, push, wait for the exact Admin revision on the official domain, then request the focused retry.

## Symptoms

expected: After choosing Security and submitting the function switch, the six-digit authenticator field accepts keyboard input.
actual: The authenticator dialog is visible, but its code field cannot be typed into.
errors: No visible error; the input is blocked by the active modal focus scope.
reproduction: From an Operations session, open the account menu, choose Trocar função ativa, select Segurança, submit the reason, then try to type in the strong-auth dialog.
started: First published Operations-to-Security round-trip UAT on 2026-08-11.

## Evidence

- timestamp: 2026-08-11T23:48:00.0000000Z
  observation: `AdminProductionShell` leaves `functionSwitchOpen` true while `authorizeMutation` mounts a second dialog outside the React Aria modal overlay.
  implication: The first dialog remains the active focus scope and rejects interaction with the visually topmost TOTP input.

## Eliminated

None yet.

## Resolution

root_cause: The controlled `LbDialog` for function selection remained open while a sibling strong-auth dialog was mounted. React Aria correctly retained its modal focus scope, making the visually topmost TOTP field non-interactive.
fix: Close the function-switch dialog and defer opening strong authentication to the next browser task, after the modal focus scope has unmounted.
verification: The regression failed before the fix and passes after it. The complete Admin suite passes 196/196, TypeScript and changed-file ESLint pass, `git diff --check` is clean, and the production Next build succeeds. Published owner UAT remains pending.
files_changed: [apps/admin/src/features/admin-authority.tsx, apps/admin/src/admin-shell.test.ts]
